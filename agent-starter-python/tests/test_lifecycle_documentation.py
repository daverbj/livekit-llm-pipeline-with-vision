#!/usr/bin/env python3

import asyncio
import sys
import os
sys.path.append('src')

from livekit.agents import llm
from src.utils.openai_processor import process_openai_chat

async def test_lifecycle_stage_documentation():
    """Test the get_documentation function with lifecycle stage question"""
    
    # Create a chat context
    chat_ctx = llm.ChatContext()
    
    # Add system message (will be converted for Mistral compatibility)
    chat_ctx.add_message(
        role="system",
        content="You are a helpful HubSpot assistant."
    )
    
    # Add user message asking about lifecycle stage
    chat_ctx.add_message(
        role="user", 
        content="How to change life cycle stage of a contact?"
    )
    
    print("Testing OpenAI processor with lifecycle stage documentation question...")
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
            if len(content) > 300:
                content = content[:300] + "..."
            print(f"  {i+1}. {msg.role}: {content}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

async def test_different_project_names():
    """Test documentation search with different project names"""
    
    project_names = ["hubspot_docs", "hubspot", "test_project", None]
    
    for project_name in project_names:
        print(f"\n{'='*70}")
        print(f"Testing with project_name: {project_name}")
        print("="*70)
        
        # Create a new chat context for each test
        chat_ctx = llm.ChatContext()
        
        chat_ctx.add_message(
            role="user", 
            content="How to change life cycle stage of a contact?"
        )
        
        try:
            response_chunks = []
            async for chunk in process_openai_chat(
                chat_ctx=chat_ctx,
                model="mistralai/Pixtral-12B-2409",
                base_url="http://10.31.20.36:8000/v1",
                api_key="dummy-key",
                temperature=0.1,
                max_tokens=256,  # Shorter for testing multiple
                project_name=project_name,
                enable_functions=True
            ):
                response_chunks.append(chunk)
                print(chunk, end="", flush=True)
            
            print(f"\n--- Project '{project_name}' completed ---")
            
        except Exception as e:
            print(f"Error with project '{project_name}': {e}")

if __name__ == "__main__":
    asyncio.run(test_lifecycle_stage_documentation())
    print("\n" + "="*80)
    print("Now testing with different project names...")
    asyncio.run(test_different_project_names())
