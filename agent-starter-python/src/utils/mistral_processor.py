import json
import logging
import base64
import re
import uuid
from typing import AsyncIterable, Optional, Dict, Any
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI
from .tools import get_context_qdrant

import os
from langchain.chat_models import init_chat_model
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

logger = logging.getLogger("mistral-processor")


async def process_mistral_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
) -> AsyncIterable[llm.ChatChunk]:
    
    # Create ChatOpenAI with streaming enabled
    _llm = ChatOpenAI(model=model, temperature=0.7, base_url=base_url, streaming=True)
    
    # Get the last message from chat context and format it properly
    if chat_ctx.items:
        last_message = chat_ctx.items[-1]
        
        # Handle multimodal content (text + images)
        message_content = []
        
        if isinstance(last_message.content, list):
            # Process each content item
            for item in last_message.content:
                if isinstance(item, str):
                    # Text content
                    if item.strip():
                        message_content.append({"type": "text", "text": item})
                elif hasattr(item, 'type'):
                    if item.type == 'image_content':
                        # Image content - the image is directly in item.image as a data URL
                        try:
                            if hasattr(item, 'image'):
                                image_data = item.image
                                
                                # Check if it's already a data URL
                                if isinstance(image_data, str) and image_data.startswith('data:image'):
                                    data_url = image_data
                                elif isinstance(image_data, str):
                                    # Assume it's base64 encoded, add data URL prefix
                                    data_url = f"data:image/jpeg;base64,{image_data}"
                                elif isinstance(image_data, bytes):
                                    # Convert bytes to base64
                                    image_b64 = base64.b64encode(image_data).decode('utf-8')
                                    data_url = f"data:image/jpeg;base64,{image_b64}"
                                else:
                                    logger.warning(f"Unexpected image data type: {type(image_data)}")
                                    continue
                                
                                message_content.append({
                                    "type": "image",
                                    "source_type": "url",
                                    "url": data_url
                                })
                                logger.info(f"Added image to message content: {data_url[:50]}...")
                        except Exception as e:
                            logger.error(f"Error processing image: {e}")
                    else:
                        # Other content types (convert to text)
                        text_content = str(item)
                        if text_content.strip():
                            message_content.append({"type": "text", "text": text_content})
        else:
            # Simple string content
            content_text = str(last_message.content)
            if content_text.strip():
                message_content.append({"type": "text", "text": content_text})
        
        # Create HumanMessage with multimodal content
        if message_content:
            messages = [
                SystemMessage(content="You are a helpful assistant. You are excellent at understanding and describing images."),
                HumanMessage(content=message_content)
            ]
            logger.info(f"Sending multimodal message with {len(message_content)} content items")
        
        # Stream directly from the LLM
        async for chunk in _llm.astream(messages):
            if chunk.content:
                yield llm.ChatChunk(
                    id="",
                    delta=llm.ChoiceDelta(
                        role="assistant",
                        content=chunk.content,
                        tool_calls=[]
                    ),
                    usage=None,
                )
    else:
        yield llm.ChatChunk(
            request_id="",
            delta=llm.ChoiceDelta(
                role="assistant",
                content="No messages in chat context"
            ),
            index=0
        )


    