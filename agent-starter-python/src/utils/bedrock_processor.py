import json
import logging
import base64
import boto3
from typing import AsyncIterable
from livekit.agents import llm
import asyncio
from concurrent.futures import ThreadPoolExecutor
from botocore.config import Config
from pytest import Config

logger = logging.getLogger("bedrock-processor")


async def process_bedrock_chat(
    chat_ctx: llm.ChatContext,
    model: str = "us.anthropic.claude-sonnet-4-20250514-v1:0",
    region_name: str = "us-east-1"
) -> AsyncIterable[str]:
    """
    Process chat context with AWS Bedrock, sending only the latest message's image data.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The Bedrock model to use
        region_name: AWS region for Bedrock
        
    Yields:
        str: Text chunks from Bedrock response
    """
    # Convert chat context to Bedrock format
    messages = []
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        if role == "system":
            # System messages are handled separately in Bedrock
            continue
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
                                # Extract format and base64 data from data URL
                                header, image_data = item.image.split(',', 1)
                                # Extract media type (e.g., "image/jpeg")
                                media_type = header.split(';')[0].split(':')[1]
                                
                                content_blocks.append({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": media_type,
                                        "data": image_data
                                    }
                                })
                            else:
                                # If it's raw image data, convert to base64
                                if hasattr(item.image, 'encode'):
                                    image_data = base64.b64encode(item.image.encode()).decode('utf-8')
                                else:
                                    image_data = base64.b64encode(str(item.image).encode()).decode('utf-8')
                                
                                content_blocks.append({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": "image/jpeg",  # Default to JPEG
                                        "data": image_data
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
            messages.append({
                "role": role,
                "content": content_blocks
            })
    
    # Prepare the Bedrock request
    native_request = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 512,
        "temperature": 0.5,
        "messages": messages
    }
    
    # Add system message if present
    system_messages = [msg for msg in chat_ctx.items if msg.role == "system"]
    if system_messages:
        # Combine all system messages
        system_content = " ".join([str(msg.content) for msg in system_messages])
        native_request["system"] = system_content
    
    # Debug: Print the formatted messages
    logger.info(f"Sending messages to Bedrock: {json.dumps(native_request, indent=2)}")
    
    try:
        # Create Bedrock client
        client = boto3.client("bedrock-runtime", region_name=region_name)

        # Convert the native request to JSON
        request_body = json.dumps(native_request)
        
        # Use thread pool to run blocking boto3 call in async context
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor() as executor:
            # Invoke the model with streaming response
            streaming_response = await loop.run_in_executor(
                executor,
                lambda: client.invoke_model_with_response_stream(
                    modelId=model,
                    body=request_body
                )
            )
            
            # Extract and yield the response text in real-time
            for event in streaming_response["body"]:
                chunk = json.loads(event["chunk"]["bytes"])
                
                if chunk["type"] == "content_block_delta":
                    text_content = chunk["delta"].get("text", "")
                    if text_content:
                        # Just yield the text content directly
                        yield text_content
                elif chunk["type"] == "message_delta":
                    # Handle any message-level deltas if needed
                    continue
                elif chunk["type"] == "message_stop":
                    # End of message
                    break
                    
    except Exception as e:
        logger.error(f"Error calling Bedrock: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties with the language model."
