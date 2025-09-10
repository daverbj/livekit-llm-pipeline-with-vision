#!/usr/bin/env python3

import asyncio
import sys
import os
import json
sys.path.append('src')

import logging
logging.basicConfig(level=logging.DEBUG)

from livekit.agents import llm
from openai import AsyncOpenAI

async def test_raw_mistral_function_calling():
    """Test raw function calling with Mistral to see the exact format"""
    
    print("Testing raw Mistral function calling via vllm OpenAI API...")
    
    # Function definitions
    functions = [
        {
            "name": "get_weather",
            "description": "Get current weather information for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The city name to get weather for"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit preference",
                        "default": "celsius"
                    }
                },
                "required": ["city"]
            }
        }
    ]
    
    messages = [
        {
            "role": "user",
            "content": "What's the weather like in New York City?"
        }
    ]
    
    try:
        client = AsyncOpenAI(
            base_url="http://10.31.20.36:8000/v1",
            api_key="dummy-key"
        )
        
        print("Making request to Mistral with function calling enabled...")
        print(f"Functions: {json.dumps(functions, indent=2)}")
        print(f"Messages: {json.dumps(messages, indent=2)}")
        print()
        
        stream = await client.chat.completions.create(
            model="mistralai/Pixtral-12B-2409",
            messages=messages,
            tools=[{"type": "function", "function": func} for func in functions],
            tool_choice="auto",
            stream=True,
            temperature=0.1,
            max_tokens=512
        )
        
        print("Streaming response:")
        tool_calls = {}
        
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                
                # Check for content
                if hasattr(delta, 'content') and delta.content:
                    print(f"CONTENT: {repr(delta.content)}")
                
                # Check for tool calls
                if hasattr(delta, 'tool_calls') and delta.tool_calls:
                    print(f"TOOL_CALLS: {delta.tool_calls}")
                    for tool_call in delta.tool_calls:
                        print(f"  - ID: {tool_call.id}")
                        print(f"  - Type: {tool_call.type}")
                        if tool_call.function:
                            print(f"  - Function Name: {tool_call.function.name}")
                            print(f"  - Function Args: {repr(tool_call.function.arguments)}")
                
                # Check finish reason
                if chunk.choices[0].finish_reason:
                    print(f"FINISH_REASON: {chunk.choices[0].finish_reason}")
        
        print("\nDone streaming.")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_raw_mistral_function_calling())
