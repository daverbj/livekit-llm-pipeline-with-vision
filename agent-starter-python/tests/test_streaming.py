#!/usr/bin/env python3
"""
Test script for streaming behavior - normal text vs function calls.
"""

import asyncio
import logging
import sys
import os

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_normal_streaming():
    """Test normal text streaming (should yield deltas immediately)"""
    try:
        from utils.openai_processor import process_openai_chat
        from livekit.agents import llm
        
        print("=" * 50)
        print("TEST 1: NORMAL TEXT STREAMING")
        print("=" * 50)
        
        chat_ctx = llm.ChatContext()
        
        chat_ctx.add_message(
            role="system",
            content="You are a helpful assistant. Answer questions directly without using any functions."
        )
        
        chat_ctx.add_message(
            role="user", 
            content="Tell me a short story about a cat."
        )
        
        print("Query: Tell me a short story about a cat.")
        print("Response (streaming):")
        print("-" * 30)
        
        response_chunks = []
        async for chunk in process_openai_chat(
            chat_ctx=chat_ctx,
            model="mistralai/Pixtral-12B-2409",
            base_url="http://10.31.20.36:8000/v1",
            api_key="dummy-key",
            temperature=0.7,
            enable_functions=True
        ):
            print(chunk, end="", flush=True)
            response_chunks.append(chunk)
        
        print(f"\n\nTotal chunks received: {len(response_chunks)}")
        print(f"Total response length: {len(''.join(response_chunks))} characters")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_function_call_streaming():
    """Test function call behavior (should accumulate, execute, then stream explanation)"""
    try:
        from utils.openai_processor import process_openai_chat
        from livekit.agents import llm
        
        print("\n" + "=" * 50)
        print("TEST 2: FUNCTION CALL STREAMING")
        print("=" * 50)
        
        chat_ctx = llm.ChatContext()
        
        chat_ctx.add_message(
            role="system",
            content="You are a helpful assistant that can provide weather information. Use the get_weather function when asked about weather."
        )
        
        chat_ctx.add_message(
            role="user", 
            content="What's the weather like in Tokyo?"
        )
        
        print("Query: What's the weather like in Tokyo?")
        print("Response (should be explanation after function call):")
        print("-" * 30)
        
        response_chunks = []
        async for chunk in process_openai_chat(
            chat_ctx=chat_ctx,
            model="mistralai/Pixtral-12B-2409",
            base_url="http://10.31.20.36:8000/v1",
            api_key="dummy-key",
            temperature=0.7,
            enable_functions=True
        ):
            print(chunk, end="", flush=True)
            response_chunks.append(chunk)
        
        print(f"\n\nTotal chunks received: {len(response_chunks)}")
        print(f"Total response length: {len(''.join(response_chunks))} characters")
        print(f"Chat context messages: {len(chat_ctx.items)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Run both tests"""
    await test_normal_streaming()
    await test_function_call_streaming()
    
    print("\n" + "=" * 50)
    print("ALL TESTS COMPLETED")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(main())
