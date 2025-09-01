import json
import logging
import base64
import aiohttp
from typing import AsyncIterable
from livekit.agents import llm

logger = logging.getLogger("gemma-ollama-processor")


async def process_gemma_ollama_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gemma3:4b",
    ollama_url: str = "http://localhost:11434/api/chat"
) -> AsyncIterable[str]:
    """
    Process chat context with Ollama for Gemma models, handling system messages properly.
    Gemma doesn't support system messages, so they are concatenated with the first user message.
    Sends only the latest message's image data.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The Gemma model to use
        ollama_url: The Ollama API endpoint URL
        
    Yields:
        str: Text chunks from Ollama response
    """
    # Convert chat context to Ollama format for Gemma
    messages = []
    system_content = ""
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    # First pass: collect system content and process other messages
    raw_messages = []
    
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        
        # Handle content - could be string or list
        if isinstance(msg.content, list):
            # Check if we have both text and images
            text_parts = []
            image_parts = []
            
            for item in msg.content:
                if isinstance(item, str):
                    text_parts.append(item)
                elif hasattr(item, 'type') and item.type == 'image_content':
                    # Only include images for the last message
                    if idx == last_message_index:
                        # Handle ImageContent object
                        if hasattr(item, 'image') and item.image:
                            if isinstance(item.image, str) and item.image.startswith('data:image'):
                                # Extract base64 data from data URL
                                image_data = item.image.split(',')[1] if ',' in item.image else item.image
                                image_parts.append(image_data)
                            else:
                                # If it's raw image data, convert to base64
                                if hasattr(item.image, 'encode'):
                                    image_data = base64.b64encode(item.image.encode()).decode('utf-8')
                                else:
                                    image_data = base64.b64encode(str(item.image).encode()).decode('utf-8')
                                image_parts.append(image_data)
                    # For older messages, skip image content entirely
            
            # Collect text content
            text_content = " ".join(text_parts) if text_parts else ""
            
            if role == "system":
                # Collect system content separately
                system_content += text_content + " "
            else:
                # Keep assistant and user roles as they are
                if role == "assistant":
                    role = "assistant"
                elif role == "user":
                    role = "user"
                
                # Build message for Ollama
                if image_parts and idx == last_message_index:
                    # Ollama format: text in content, images in separate array (only for last message)
                    message = {
                        "role": role,
                        "content": text_content,
                        "images": image_parts
                    }
                    raw_messages.append(message)
                else:
                    # Text only (for all messages, and older messages without images)
                    raw_messages.append({
                        "role": role,
                        "content": text_content
                    })
        else:
            # Simple string content
            content = str(msg.content)
            
            if role == "system":
                # Collect system content separately
                system_content += content + " "
            else:
                # Keep assistant and user roles as they are
                if role == "assistant":
                    role = "assistant"
                elif role == "user":
                    role = "user"
                
                raw_messages.append({
                    "role": role,
                    "content": content
                })
    
    # Second pass: merge system content with first user message
    first_user_message_processed = False
    
    for message in raw_messages:
        if message["role"] == "user":
            if not first_user_message_processed and system_content:
                # Prepend system content to the first user message
                original_content = message["content"]
                combined_content = system_content.strip()
                if original_content:
                    combined_content += " " + original_content
                
                # Create new message with combined content
                new_message = {
                    "role": "user",
                    "content": combined_content
                }
                
                # Preserve images if they exist
                if "images" in message:
                    new_message["images"] = message["images"]
                
                messages.append(new_message)
                first_user_message_processed = True
            else:
                # Add regular user message
                messages.append(message)
        else:
            # Add assistant messages as they are
            messages.append(message)
    
    # If no user messages were found but we have system content, create a user message
    if not first_user_message_processed and system_content:
        messages.append({
            "role": "user",
            "content": system_content.strip()
        })
    
    # Make streaming call to Ollama
    ollama_payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    # Debug: Print the formatted messages (with truncated image data for readability)
    messages_for_log = []
    for msg in messages:
        msg_copy = {"role": msg["role"], "content": msg["content"]}
        if "images" in msg:
            # Show number of images instead of full data
            msg_copy["images"] = f"[{len(msg['images'])} image(s)]"
        messages_for_log.append(msg_copy)
    
    logger.info(f"Sending messages to Gemma via Ollama: {json.dumps(messages_for_log, indent=2)}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                ollama_url,
                json=ollama_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                line_text = line.decode('utf-8').strip()
                                if line_text:
                                    data = json.loads(line_text)
                                    if "message" in data and "content" in data["message"]:
                                        chunk_content = data["message"]["content"]
                                        if chunk_content:
                                            # Just yield the text content directly
                                            yield chunk_content
                            except json.JSONDecodeError:
                                continue
                            except Exception as e:
                                logger.error(f"Error processing chunk: {e}")
                                continue
                else:
                    logger.error(f"Ollama API error: {response.status}")
                    # Fallback response
                    yield "I'm having trouble connecting to the language model."
    except Exception as e:
        logger.error(f"Error calling Ollama: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties."
