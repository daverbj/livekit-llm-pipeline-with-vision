import json
import logging
import base64
from typing import AsyncIterable, Optional
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI
from .tools import get_context_qdrant

logger = logging.getLogger("gemma-processor")


async def process_gemma_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gemma3:4b",
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 512,
    temperature: float = 1,
    session = None,
    project_name: str = None
) -> AsyncIterable[str]:
    """
    Process chat context with Gemma model, handling system messages properly.
    Gemma doesn't support system messages, so they are concatenated with the first user message.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The Gemma model to use (e.g., "gemma3:4b")
        base_url: Custom base URL for OpenAI-compatible APIs (e.g., local servers)
        api_key: API key for authentication
        max_tokens: Maximum tokens to generate
        temperature: Temperature for response generation
        project_name: Current project name for context
        
    Yields:
        str: Text chunks from Gemma response
    """
    # Convert chat context to Gemma format with proper role handling
    messages = []
    system_content = ""
    
    # Add the detailed instructions about get_context function as system content
    function_instructions = """
You have to guide user to resolve their issues and problems.                        
Your response should be **one step at a time**.
Your answers must be within 60 tokens "except function call"
Always find the documentation steps for the problem to solve the moment you get the problem statement or user query.
Do not use your own knowledge at first instance.
If user objects or unable to do what you are suggesting, you must fetch documentation steps for the problem.
Strictly follow the documentation steps.
User always provides you the latest screenshot of his screen through continuous video call.
You must analyse the screen and answer user based on the current screen situation.
Response user as if you are a human in a call so do not format your answer with markdown, it should be raw text only.

You have access to functions. If you decide to invoke any of the function(s),
You MUST put it in the format of
{"name": function name, "parameters": dictionary of argument name and its value}
You SHOULD NOT include any other text in the response if you call a function.
**Available functions**
[
    {
        "name": "get_documentation",
        "description": "Use to fetch context and documentation steps for the problem to solve",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string"
                }
            },
            "required": [
                "query"
            ]
        }
    }
]
** ALWAYS SEARCH FOR DOCUMENTATION **
"""
    system_content += function_instructions.strip() + " "
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    # First pass: collect system messages and other messages separately
    raw_messages = []
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        
        # Handle content - could be string or list
        content_blocks = []
        
        if isinstance(msg.content, list):
            # Check if we have both text and images
            text_parts = []
            
            for item in msg.content:
                if isinstance(item, str):
                    text_parts.append(item)
                elif hasattr(item, 'type') and item.type == 'image_content':
                    # Only include images for the last message
                    if idx == last_message_index:
                        # Handle ImageContent object
                        if hasattr(item, 'image') and item.image:
                            if isinstance(item.image, str) and item.image.startswith('data:image'):
                                # OpenAI-compatible API accepts data URLs directly
                                content_blocks.append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": item.image
                                    }
                                })
                            else:
                                # If it's raw image data, convert to data URL
                                if hasattr(item.image, 'encode'):
                                    image_data = base64.b64encode(item.image.encode()).decode('utf-8')
                                else:
                                    image_data = base64.b64encode(str(item.image).encode()).decode('utf-8')
                                
                                data_url = f"data:image/jpeg;base64,{image_data}"
                                content_blocks.append({
                                    "type": "image_url",
                                    "image_url": {
                                        "url": data_url
                                    }
                                })
                    # For older messages, skip image content entirely
            
            # Add text content if any
            if text_parts:
                text_content = " ".join(text_parts)
                content_blocks.insert(0, {  # Insert text before images
                    "type": "text",
                    "text": text_content
                })
                
        else:
            # Simple string content
            content_blocks.append({
                "type": "text",
                "text": str(msg.content)
            })
        
        if content_blocks:
            if role == "system":
                # Collect system content separately
                for block in content_blocks:
                    if block["type"] == "text":
                        system_content += block["text"] + " "
            else:
                # Keep proper role distinction - don't convert assistant to user
                if role == "assistant":
                    role = "assistant"
                elif role == "user":
                    role = "user"
                
                raw_messages.append({
                    "role": role,
                    "content": content_blocks
                })
    
    # Second pass: merge consecutive messages with the same role and handle system content
    i = 0
    first_user_message_processed = False
    
    while i < len(raw_messages):
        current_msg = raw_messages[i]
        
        if current_msg["role"] == "user":
            merged_content = []
            
            # If this is the first user message and we have system content, prepend it
            if not first_user_message_processed and system_content:
                merged_content.append({
                    "type": "text",
                    "text": system_content.strip()
                })
                first_user_message_processed = True
            
            # Collect all consecutive user messages
            while i < len(raw_messages) and raw_messages[i]["role"] == "user":
                # Merge content blocks
                for content_block in raw_messages[i]["content"]:
                    if content_block["type"] == "text":
                        # Merge text blocks
                        existing_text = next((block for block in merged_content if block["type"] == "text"), None)
                        if existing_text:
                            existing_text["text"] += " " + content_block["text"]
                        else:
                            merged_content.append(content_block)
                    else:
                        # Add non-text blocks (like images) directly
                        merged_content.append(content_block)
                i += 1
            
            if merged_content:
                messages.append({
                    "role": "user",
                    "content": merged_content
                })
        else:
            # Handle assistant messages properly - don't merge them into user messages
            messages.append(current_msg)
            i += 1
    
    # If no user messages were found but we have system content, create a user message
    if not first_user_message_processed and system_content:
        messages.append({
            "role": "user",
            "content": [{"type": "text", "text": system_content.strip()}]
        })
    
    # Debug: Print the formatted messages with truncated image data
    messages_for_log = []
    for msg in messages:
        msg_copy = {"role": msg["role"], "content": []}
        for content_item in msg["content"]:
            if content_item["type"] == "image_url":
                # Truncate image URL to first 20 characters
                truncated_url = content_item["image_url"]["url"][:20] + "..." if len(content_item["image_url"]["url"]) > 20 else content_item["image_url"]["url"]
                msg_copy["content"].append({
                    "type": "image_url",
                    "image_url": {"url": truncated_url}
                })
            else:
                msg_copy["content"].append(content_item)
        messages_for_log.append(msg_copy)
    
    logger.info(f"Sending messages to Gemma: {json.dumps(messages_for_log, indent=2)}")
    
    try:
        # Create OpenAI client with custom base URL if provided
        client_kwargs = {}
        if base_url:
            client_kwargs["base_url"] = base_url
        if api_key:
            client_kwargs["api_key"] = api_key
        
        client = AsyncOpenAI(**client_kwargs)
        
        # Prepare the request
        request_params = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": True
        }
        
        # Create streaming completion
        stream = await client.chat.completions.create(**request_params)
        
        # Process the streaming response
        function_buffer = ""
        in_function_call = False
        
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, 'content') and delta.content:
                    chunk_content = delta.content
                    
                    # Check if we're currently in a function call or starting one
                    if "{" in chunk_content and not in_function_call:
                        # Start of function call
                        in_function_call = True
                        function_buffer = chunk_content
                        
                        # Check if the function call is complete in this chunk
                        # Count braces to see if it's complete
                        brace_count = 0
                        for char in chunk_content:
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                        
                        if brace_count == 0:
                            # Complete function call in single chunk
                            function_result = await process_function_call(function_buffer, project_name)
                            if function_result:
                                # Add function result to current conversation and continue with same stream
                                # Extract function name for better context
                                function_name = "get_documentation"  # Default
                                try:
                                    import json as json_lib
                                    func_data = json_lib.loads(function_buffer[function_buffer.find('{'):])
                                    function_name = func_data.get("name", "get_documentation")
                                except:
                                    pass
                                
                                # Add function result as assistant message to maintain alternating roles
                                assistant_result_message = {
                                    "role": "assistant", 
                                    "content": [{"type": "text", "text": f"{function_name} has a result:\n{function_result}"}]
                                }
                                messages.append(assistant_result_message)
                                
                                # Add user message to inform about context
                                user_context_message = {
                                    "role": "user",
                                    "content": [{"type": "text", "text": "You have got the context"}]
                                }
                                messages.append(user_context_message)
                                
                                # Debug: Log the updated messages with function result
                                logger.info(f"[SINGLE CHUNK] Function result added. Total messages: {len(messages)}")
                                
                                # Debug: Show updated conversation with function result
                                messages_for_log = []
                                for msg in messages:
                                    msg_copy = {"role": msg["role"], "content": []}
                                    for content_item in msg["content"]:
                                        if content_item["type"] == "image_url":
                                            truncated_url = content_item["image_url"]["url"][:20] + "..." if len(content_item["image_url"]["url"]) > 20 else content_item["image_url"]["url"]
                                            msg_copy["content"].append({
                                                "type": "image_url",
                                                "image_url": {"url": truncated_url}
                                            })
                                        else:
                                            msg_copy["content"].append(content_item)
                                    messages_for_log.append(msg_copy)
                                logger.info(f"[SINGLE CHUNK] Updated messages with function result: {json.dumps(messages_for_log, indent=2)}")
                                
                                # Make a new request with updated messages
                                request_params["messages"] = messages
                                new_stream = await client.chat.completions.create(**request_params)
                                
                                # Stream the new response
                                async for new_chunk in new_stream:
                                    if new_chunk.choices and len(new_chunk.choices) > 0:
                                        new_delta = new_chunk.choices[0].delta
                                        if hasattr(new_delta, 'content') and new_delta.content:
                                            yield new_delta.content
                                
                                return  # Exit the current stream processing
                            # Reset state
                            function_buffer = ""
                            in_function_call = False
                    elif in_function_call:
                        # Continue accumulating function call
                        function_buffer += chunk_content
                        
                        # Check if function call is complete by counting braces
                        brace_count = 0
                        for char in function_buffer:
                            if char == '{':
                                brace_count += 1
                            elif char == '}':
                                brace_count -= 1
                        
                        if brace_count == 0:
                            # Function call complete, process it
                            function_result = await process_function_call(function_buffer, project_name)
                            if function_result:
                                # Add function result to current conversation and continue with same stream
                                # Extract function name for better context
                                function_name = "get_documentation"  # Default
                                try:
                                    import json as json_lib
                                    func_data = json_lib.loads(function_buffer[function_buffer.find('{'):])
                                    function_name = func_data.get("name", "get_documentation")
                                except:
                                    pass
                                
                                # Add function result as assistant message to maintain alternating roles
                                assistant_result_message = {
                                    "role": "assistant", 
                                    "content": [{"type": "text", "text": f"{function_name} has a result:\n{function_result}"}]
                                }
                                messages.append(assistant_result_message)
                                
                                # Add user message to inform about context
                                user_context_message = {
                                    "role": "user",
                                    "content": [{"type": "text", "text": "You have got the context"}]
                                }
                                messages.append(user_context_message)
                                
                                # Debug: Log the updated messages with function result
                                logger.info(f"[MULTI CHUNK] Function result added. Total messages: {len(messages)}")
                                
                                # Debug: Show updated conversation with function result
                                messages_for_log = []
                                for msg in messages:
                                    msg_copy = {"role": msg["role"], "content": []}
                                    for content_item in msg["content"]:
                                        if content_item["type"] == "image_url":
                                            truncated_url = content_item["image_url"]["url"][:20] + "..." if len(content_item["image_url"]["url"]) > 20 else content_item["image_url"]["url"]
                                            msg_copy["content"].append({
                                                "type": "image_url",
                                                "image_url": {"url": truncated_url}
                                            })
                                        else:
                                            msg_copy["content"].append(content_item)
                                    messages_for_log.append(msg_copy)
                                logger.info(f"[MULTI CHUNK] Updated messages with function result: {json.dumps(messages_for_log, indent=2)}")
                                
                                # Make a new request with updated messages
                                request_params["messages"] = messages
                                new_stream = await client.chat.completions.create(**request_params)
                                
                                # Stream the new response
                                async for new_chunk in new_stream:
                                    if new_chunk.choices and len(new_chunk.choices) > 0:
                                        new_delta = new_chunk.choices[0].delta
                                        if hasattr(new_delta, 'content') and new_delta.content:
                                            yield new_delta.content
                                
                                return  # Exit the current stream processing
                            # Reset state
                            function_buffer = ""
                            in_function_call = False
                    else:
                        # Regular content, yield it
                        yield chunk_content
                    
    except Exception as e:
        logger.error(f"Error calling Gemma: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties with the language model."


async def process_function_call(content: str, project_name: str = None) -> str:
    """
    Process function calls from LLM response
    
    Args:
        content: The content containing function call
        project_name: Current project name for context
        
    Returns:
        Function result or empty string if no function call
    """
    try:
        # Extract function call from content - now it's direct JSON
        import re
        
        # Find the first opening brace
        json_start = content.find("{")
        if json_start == -1:
            logger.warning(f"No opening brace found in content: {content[:200]}...")
            return ""
        
        # Count braces to find the complete JSON
        brace_count = 0
        json_end = -1
        
        for i in range(json_start, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    json_end = i + 1
                    break
        
        if json_end == -1:
            logger.warning(f"No closing brace found for function call in content: {content[:200]}...")
            return ""
        
        # Extract the complete JSON
        function_call_json = content[json_start:json_end]
        
        # Clean up potential streaming artifacts
        function_call_json = re.sub(r'\s+', ' ', function_call_json)  # Replace multiple spaces/newlines with single space
        function_call_json = function_call_json.strip()
        
        logger.info(f"Extracted function call JSON: {function_call_json}")
        
        try:
            function_call = json.loads(function_call_json)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse function call JSON: {function_call_json}, error: {je}")
            return "Error: Invalid function call format"
        
        function_name = function_call.get("name")
        parameters = function_call.get("parameters", {})
        
        logger.info(f"Processing function call: {function_name} with params: {parameters}")
        
        if function_name == "get_documentation":
            query = parameters.get("query", "")
            if query:
                context_result = await get_context_qdrant(query, project_name)
                return f"Context found: {context_result}"
            else:
                return "Error: No query provided for context search"
        else:
            return f"Error: Unknown function '{function_name}'"
            
    except Exception as e:
        logger.error(f"Error processing function call: {e}")
        return f"Error processing function call: {str(e)}"
