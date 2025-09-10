#!/usr/bin/env python3
"""
Test script for vision agent system instructions.
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

async def test_vision_agent_system_instructions():
    """Test that vision agent system instructions work with our processor"""
    try:
        from utils.openai_processor import process_openai_chat
        from livekit.agents import llm
        
        print("=" * 60)
        print("VISION AGENT SYSTEM INSTRUCTIONS TEST")
        print("=" * 60)
        
        # Simulate what the vision agent would send
        chat_ctx = llm.ChatContext()
        
        # Add the same system instructions as the vision agent
        system_instructions = """You are an advanced AI assistant with vision and weather capabilities. 

Key capabilities:
- You can see and analyze images from the video stream
- You can provide weather information for any city using the get_weather function
- You can look up contextual information for user queries
- You are helpful, friendly, and provide detailed explanations

Instructions:
- When users ask about weather, use the get_weather function to get current data
- When you can see video content, describe what you observe in detail
- Always be conversational and engaging
- Provide comprehensive answers that are easy to understand
- If you use any functions, explain the results in a natural, user-friendly way

Remember: You have access to real-time video and can provide accurate weather information!"""
        
        chat_ctx.add_message(
            role="system",
            content=system_instructions
        )
        
        # Test different types of queries
        test_queries = [
            "What's the weather like in New York?",
            "Hello! How are you today?",
            "Can you tell me about the weather in Tokyo and explain what that means for someone visiting?"
        ]
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{'-'*50}")
            print(f"TEST {i}: {query}")
            print(f"{'-'*50}")
            
            # Add user message
            chat_ctx.add_message(role="user", content=query)
            
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
            
            # Add the response to chat context for next iteration
            if full_response.strip():
                chat_ctx.add_message(role="assistant", content=full_response)
            
            print(f"\n\nResponse length: {len(full_response)} characters")
            print(f"Chat context now has: {len(chat_ctx.items)} messages")
            
            # Wait a bit between queries
            await asyncio.sleep(1)
        
        print(f"\n{'='*60}")
        print("VISION AGENT SYSTEM INSTRUCTIONS TEST COMPLETED")
        print(f"{'='*60}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_vision_agent_system_instructions())
