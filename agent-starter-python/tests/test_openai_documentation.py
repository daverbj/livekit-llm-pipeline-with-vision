#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append('src')

from livekit.agents import llm
from src.utils.openai_processor import process_openai_chat

async def test_documentation_function():
    """Test the get_documentation function calling with OpenAI processor"""
    
    # Create a chat context
    chat_ctx = llm.ChatContext()
    
    # Add system message (will be converted for Mistral compatibility)
    chat_ctx.add_message(
        role="system",
        content="You are a helpful HubSpot assistant."
    )
    
    # Add user message asking for HubSpot documentation
    chat_ctx.add_message(
        role="user", 
        content="How do I create a workflow in HubSpot?"
    )
    
    print("Testing OpenAI processor with get_documentation function...")
    print("Chat context:")
    for i, msg in enumerate(chat_ctx.items):
        print(f"  {i+1}. {msg.role}: {msg.content}")
    print()
    
    try:
        # Process with Mistral model via vllm
        response_chunks = []
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
            print(chunk, end="", flush=True)
        
        print("\n" + "="*50)
        print("Full response:", "".join(response_chunks))
        print(f"Total messages in chat context after processing: {len(chat_ctx.items)}")
        
        # Print updated chat context
        print("\nFinal chat context:")
        for i, msg in enumerate(chat_ctx.items):
            content = str(msg.content)
            if len(content) > 200:
                content = content[:200] + "..."
            print(f"  {i+1}. {msg.role}: {content}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_weather_function():
    """Test the get_weather function calling with OpenAI processor"""
    
    # Create a new chat context
    chat_ctx = llm.ChatContext()
    
    # Add user message asking for weather
    chat_ctx.add_message(
        role="user", 
        content="What's the weather like in Tokyo?"
    )
    
    print("\n" + "="*70)
    print("Testing OpenAI processor with get_weather function...")
    print("Chat context:")
    for i, msg in enumerate(chat_ctx.items):
        print(f"  {i+1}. {msg.role}: {msg.content}")
    print()
    
    try:
        # Process with Mistral model via vllm
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
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_casual_conversation():
    """Test casual conversation without function calling"""
    
    # Create a new chat context
    chat_ctx = llm.ChatContext()
    
    # Add casual user message
    chat_ctx.add_message(
        role="user", 
        content="Hello, how are you today?"
    )
    
    print("\n" + "="*70)
    print("Testing OpenAI processor with casual conversation...")
    print("Chat context:")
    for i, msg in enumerate(chat_ctx.items):
        print(f"  {i+1}. {msg.role}: {msg.content}")
    print()
    
    try:
        # Process with Mistral model via vllm
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
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_documentation_function())
    asyncio.run(test_weather_function())
    asyncio.run(test_casual_conversation())
