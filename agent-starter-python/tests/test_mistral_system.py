#!/usr/bin/env python3
"""
Test script for Mistral system instruction handling.
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

async def test_mistral_system_instructions():
    """Test that system instructions are properly converted for Mistral"""
    try:
        from utils.openai_processor import process_openai_chat
        from livekit.agents import llm
        
        print("=" * 60)
        print("MISTRAL SYSTEM INSTRUCTION TEST")
        print("=" * 60)
        
        chat_ctx = llm.ChatContext()
        
        # Add system message (should be converted to user message for Mistral)
        chat_ctx.add_message(
            role="system",
            content="You are a helpful assistant that can provide weather information. When asked about weather, use the get_weather function to get current data. Always be friendly and detailed in your responses."
        )
        
        # Add user message
        chat_ctx.add_message(
            role="user", 
            content="What's the weather like in London?"
        )
        
        print("Original Chat Context:")
        for i, msg in enumerate(chat_ctx.items):
            print(f"  {i+1}. Role: {msg.role}")
            content_preview = str(msg.content)[:100] + "..." if len(str(msg.content)) > 100 else str(msg.content)
            print(f"     Content: {content_preview}")
        
        print(f"\nQuery: What's the weather like in London?")
        print("Response (should include system instructions in first user message):")
        print("-" * 50)
        
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
        
        full_response = ''.join(response_chunks)
        print(f"\n\nFull response length: {len(full_response)} characters")
        print(f"Chat context messages after processing: {len(chat_ctx.items)}")
        
        # Show final chat context
        print("\nFinal Chat Context:")
        for i, msg in enumerate(chat_ctx.items):
            print(f"  {i+1}. Role: {msg.role}")
            content_preview = str(msg.content)[:100] + "..." if len(str(msg.content)) > 100 else str(msg.content)
            print(f"     Content: {content_preview}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_regular_conversation():
    """Test regular conversation without function calls"""
    try:
        from utils.openai_processor import process_openai_chat
        from livekit.agents import llm
        
        print("\n" + "=" * 60)
        print("MISTRAL REGULAR CONVERSATION TEST")
        print("=" * 60)
        
        chat_ctx = llm.ChatContext()
        
        # Add system message
        chat_ctx.add_message(
            role="system",
            content="You are a creative writing assistant. Help users write interesting stories."
        )
        
        # Add user message
        chat_ctx.add_message(
            role="user", 
            content="Help me write a short poem about the ocean."
        )
        
        print("Query: Help me write a short poem about the ocean.")
        print("Response:")
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
        
        full_response = ''.join(response_chunks)
        print(f"\n\nTotal response length: {len(full_response)} characters")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def main():
    """Run both tests"""
    await test_mistral_system_instructions()
    await test_regular_conversation()
    
    print("\n" + "=" * 60)
    print("MISTRAL TESTS COMPLETED")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
