import json
import logging
import base64
import aiohttp
from typing import AsyncIterable
from livekit.agents import llm

logger = logging.getLogger("ollama-processor")


async def process_ollama_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gemma3:4b",
    ollama_url: str = "http://localhost:11434/api/chat"
) -> AsyncIterable[str]:
    """
    Process chat context with Ollama, sending only the latest message's image data.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The Ollama model to use
        ollama_url: The Ollama API endpoint URL
        
    Yields:
        str: Text chunks from Ollama response
    """
    # Convert chat context to Ollama format
    messages = []
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        if role == "system":
            role = "system"
        elif role == "user":
            role = "user"
        elif role == "assistant":
            role = "assistant"
        
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
            
            # Build content for Ollama
            if image_parts and idx == last_message_index:
                # Ollama format: text in content, images in separate array (only for last message)
                message = {
                    "role": role,
                    "content": " ".join(text_parts) if text_parts else "",
                    "images": image_parts
                }
                messages.append(message)
            else:
                # Text only (for all messages, and older messages without images)
                content = " ".join(text_parts)
                messages.append({
                    "role": role,
                    "content": content
                })
        else:
            # Simple string content
            content = str(msg.content)
            messages.append({
                "role": role,
                "content": content
            })
    
    # Make streaming call to Ollama
    ollama_payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    # Debug: Print the formatted messages
    logger.info(f"Sending messages to Ollama: {json.dumps(messages, indent=2)}")
    
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
