#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append('src')

from livekit.agents import llm
from src.utils.openai_processor import process_openai_chat

async def test_simple_function_call():
    """Test to see what Mistral actually outputs for function calling"""
    
    # Create a chat context
    chat_ctx = llm.ChatContext()
    
    # Add a simple user message asking for weather
    chat_ctx.add_message(
        role="user", 
        content="What's the weather like in New York?"
    )
    
    print("Testing what Mistral actually outputs for function calling...")
    print("Chat context:")
    for i, msg in enumerate(chat_ctx.items):
        print(f"  {i+1}. {msg.role}: {msg.content}")
    print()
    
    try:
        # Process with Mistral model via vllm with detailed logging
        response_chunks = []
        async for chunk in process_openai_chat(
            chat_ctx=chat_ctx,
            model="mistralai/Pixtral-12B-2409",
            base_url="http://10.31.20.36:8000/v1",
            api_key="dummy-key",
            temperature=0.1,
            max_tokens=512,
            enable_functions=True
        ):
            response_chunks.append(chunk)
            print(chunk, end="", flush=True)
        
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
    asyncio.run(test_simple_function_call())
