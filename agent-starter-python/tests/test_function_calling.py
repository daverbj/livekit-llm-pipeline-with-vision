#!/usr/bin/env python3
"""
Test script for function calling with OpenAI processor.
This script demonstrates the complete function calling workflow.
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

async def test_complete_function_calling_workflow():
    """Test the complete function calling workflow including the final assistant response"""
    try:
        from utils.openai_processor import process_openai_chat, get_weather, parse_mistral_function_calls
        from livekit.agents import llm
        
        print("=" * 60)
        print("COMPLETE FUNCTION CALLING WORKFLOW TEST")
        print("=" * 60)
        
        # Test the weather function directly first
        print("\n1. Testing get_weather function directly:")
        weather_result = get_weather("Paris", "celsius")
        print(f"   Weather for Paris: {weather_result}")
        
        # Test parsing function
        test_content = '[TOOL_CALLS][{"name": "get_weather", "arguments": {"city": "Paris"}}]'
        parsed = parse_mistral_function_calls(test_content)
        print(f"   Parsed function calls: {parsed}")
        
        # Now test the complete workflow
        print("\n2. Testing complete workflow with ChatContext:")
        chat_ctx = llm.ChatContext()
        
        # Add initial messages
        chat_ctx.add_message(
            role="system",
            content="You are a helpful assistant that can provide weather information. When asked about weather, use the get_weather function to get current data."
        )
        
        chat_ctx.add_message(
            role="user", 
            content="What's the weather like in Paris?"
        )
        
        print(f"   Initial chat context: {len(chat_ctx.items)} messages")
        
        # STEP 1: First call - should trigger function calling
        print("\n3. STEP 1: Making initial request (should trigger function call)...")
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
        
        first_response = ''.join(response_chunks)
        print(f"\n   First response: '{first_response}' (should be empty for function calls)")
        print(f"   Chat context after function call: {len(chat_ctx.items)} messages")
        
        # Show the new messages added by function calling
        if len(chat_ctx.items) > 2:
            print("\n   Messages added by function calling:")
            for i, msg in enumerate(chat_ctx.items[2:], start=3):
                content_preview = str(msg.content)[:150] + "..." if len(str(msg.content)) > 150 else str(msg.content)
                print(f"     {i}. Role: {msg.role}")
                print(f"        Content: {content_preview}")
        
        # STEP 2: Second call - should get assistant explanation
        print("\n4. STEP 2: Making second request (should get assistant explanation)...")
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
        
        final_response = ''.join(response_chunks)
        print(f"\n\n   Final assistant response:")
        print(f"   '{final_response}'")
        
        # Add the final response to chat context to complete the conversation
        if final_response.strip():
            chat_ctx.add_message(role="assistant", content=final_response)
        
        print(f"\n5. FINAL STATE:")
        print(f"   Total messages in chat context: {len(chat_ctx.items)}")
        print(f"   Complete conversation flow:")
        for i, msg in enumerate(chat_ctx.items, start=1):
            content_preview = str(msg.content)[:100] + "..." if len(str(msg.content)) > 100 else str(msg.content)
            print(f"     {i}. {msg.role}: {content_preview}")
        
        print("\n" + "=" * 60)
        print("WORKFLOW COMPLETE!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("Complete Function Calling Workflow Test")
    print("=====================================")
    
    asyncio.run(test_complete_function_calling_workflow())
