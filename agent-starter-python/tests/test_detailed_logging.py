#!/usr/bin/env python3

import asyncio
import sys
import os
import logging
sys.path.append('src')

# Set up detailed logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("test")

from livekit.agents import llm
from src.utils.openai_processor import process_openai_chat

async def test_detailed_logging():
    """Test with detailed logging to see what's being sent to API and received"""
    
    # Create a chat context
    chat_ctx = llm.ChatContext()
    
    # Add system message (will be converted for Mistral compatibility)
    chat_ctx.add_message(
        role="system",
        content="You are a helpful assistant."
    )
    
    # Add user message asking about lifecycle stage
    chat_ctx.add_message(
        role="user", 
        content="How to change life cycle stage of a contact?"
    )
    
    print("Testing OpenAI processor with detailed logging...")
    print("Chat context:")
    for i, msg in enumerate(chat_ctx.items):
        print(f"  {i+1}. {msg.role}: {msg.content}")
    print()
    
    try:
        # Process with Mistral model via vllm
        response_chunks = []
        print("Starting streaming response:")
        print("-" * 50)
        
        async for chunk in process_openai_chat(
            chat_ctx=chat_ctx,
            model="mistralai/Pixtral-12B-2409",
            base_url="http://10.31.20.36:8000/v1",
            api_key="dummy-key",
            temperature=0.1,
            max_tokens=512,
            project_name="hubspot",  # For documentation search
            enable_functions=True
        ):
            response_chunks.append(chunk)
            print(f"CHUNK: {repr(chunk)}")
        
        print("-" * 50)
        print("Streaming completed.")
        print("\n" + "="*50)
        print("Full response:", "".join(response_chunks))
        print(f"Total messages in chat context after processing: {len(chat_ctx.items)}")
        
        # Print updated chat context
        print("\nFinal chat context:")
        for i, msg in enumerate(chat_ctx.items):
            content = str(msg.content)
            if len(content) > 300:
                content = content[:300] + "..."
            print(f"  {i+1}. {msg.role}: {content}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_detailed_logging())
