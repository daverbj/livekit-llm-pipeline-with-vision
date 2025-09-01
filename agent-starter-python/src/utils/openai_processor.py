import json
import logging
import base64
from typing import AsyncIterable, Optional
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI

logger = logging.getLogger("openai-processor")


async def process_openai_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 512,
    temperature: float = 0.5,
    session = None
) -> AsyncIterable[str]:
    """
    Process chat context with OpenAI API, sending only the latest message's image data.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The OpenAI model to use (e.g., "gpt-4o", "gpt-4-vision-preview", etc.)
        base_url: Custom base URL for OpenAI-compatible APIs (e.g., local servers)
        api_key: API key for authentication
        max_tokens: Maximum tokens to generate
        temperature: Temperature for response generation
        
    Yields:
        str: Text chunks from OpenAI response
    """
    # Convert chat context to OpenAI format with proper role alternation
    messages = []
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    # First pass: collect all messages and handle role alternation
    raw_messages = []
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        if role == "system":
            role = "system"
        elif role == "user":
            role = "user"
        elif role == "assistant":
            role = "assistant"
        
        # Handle content - could be string or list
        content_blocks = []
        
        if isinstance(msg.content, list):
            # Check if we have both text and images
            text_parts = []
            
            for item in msg.content:
                if isinstance(item, str):
                    text_parts.append(item)
                elif hasattr(item, 'type') and item.type == 'image_content':
                    # Only include images for the last message
                    if idx == last_message_index:
                        # Handle ImageContent object
                        if hasattr(item, 'image') and item.image:
                            if isinstance(item.image, str) and item.image.startswith('data:image'):
                                # OpenAI accepts data URLs directly
                                content_blocks.append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": item.image
                                    }
                                })
                            else:
                                # If it's raw image data, convert to data URL
                                if hasattr(item.image, 'encode'):
                                    image_data = base64.b64encode(item.image.encode()).decode('utf-8')
                                else:
                                    image_data = base64.b64encode(str(item.image).encode()).decode('utf-8')
                                
                                data_url = f"data:image/jpeg;base64,{image_data}"
                                content_blocks.append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": data_url
                                    }
                                })
                    # For older messages, skip image content entirely
            
            # Add text content if any
            if text_parts:
                text_content = " ".join(text_parts)
                content_blocks.insert(0, {  # Insert text before images
                    "type": "text",
                    "text": text_content
                })
                
        else:
            # Simple string content
            content_blocks.append({
                "type": "text",
                "text": str(msg.content)
            })
        
        if content_blocks:
            raw_messages.append({
                "role": role,
                "content": content_blocks
            })
    session.say(text="Give me a moment please")
    # Second pass: merge consecutive messages with the same role
    i = 0
    while i < len(raw_messages):
        current_msg = raw_messages[i]
        
        # Handle system messages first (they should be at the beginning)
        if current_msg["role"] == "system":
            messages.append(current_msg)
            i += 1
            continue
        
        # For user/assistant messages, check for consecutive same-role messages
        if current_msg["role"] in ["user", "assistant"]:
            merged_content = []
            
            # Collect all consecutive messages with the same role
            while i < len(raw_messages) and raw_messages[i]["role"] == current_msg["role"]:
                # Merge content blocks
                for content_block in raw_messages[i]["content"]:
                    if content_block["type"] == "text":
                        # Merge text blocks
                        existing_text = next((block for block in merged_content if block["type"] == "text"), None)
                        if existing_text:
                            existing_text["text"] += " " + content_block["text"]
                        else:
                            merged_content.append(content_block)
                    else:
                        # Add non-text blocks (like images) directly
                        merged_content.append(content_block)
                i += 1
            
            if merged_content:
                messages.append({
                    "role": current_msg["role"],
                    "content": merged_content
                })
        else:
            i += 1
    
    # Debug: Print the formatted messages with truncated image data
    messages_for_log = []
    for msg in messages:
        msg_copy = {"role": msg["role"], "content": []}
        for content_item in msg["content"]:
            if content_item["type"] == "image_url":
                # Truncate image URL to first 20 characters
                truncated_url = content_item["image_url"]["url"][:20] + "..." if len(content_item["image_url"]["url"]) > 20 else content_item["image_url"]["url"]
                msg_copy["content"].append({
                    "type": "image_url",
                    "image_url": {"url": truncated_url}
                })
            else:
                msg_copy["content"].append(content_item)
        messages_for_log.append(msg_copy)
    
    logger.info(f"Sending messages to OpenAI: {json.dumps(messages_for_log, indent=2)}")
    
    try:
        # Create OpenAI client with custom base URL if provided
        client_kwargs = {}
        if base_url:
            client_kwargs["base_url"] = base_url
        if api_key:
            client_kwargs["api_key"] = api_key
        
        client = AsyncOpenAI(**client_kwargs)
        
        # Prepare the request
        request_params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }
        
        # Create streaming completion
        stream = await client.chat.completions.create(**request_params)
        
        # Process the streaming response
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    # Just yield the text content directly
                    yield delta.content
                    
    except Exception as e:
        logger.error(f"Error calling OpenAI: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties with the language model."
