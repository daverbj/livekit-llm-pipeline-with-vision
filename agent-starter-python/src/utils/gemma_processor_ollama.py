import json
import logging
import base64
import aiohttp
import os
import re
from typing import AsyncIterable
from livekit.agents import llm
from .tools import get_context_qdrant

logger = logging.getLogger("gemma-ollama-processor")


async def process_gemma_ollama_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gemma3:12b",
    ollama_url: str = "http://localhost:11434/api/chat",
    project_name: str = None
) -> AsyncIterable[str]:
    """
    Process chat context with Ollama for Gemma models, handling system messages properly.
    Gemma doesn't support system messages, so they are concatenated with the first user message.
    Sends only the latest message's image data.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The Gemma model to use
        ollama_url: The Ollama API endpoint URL
        
    Yields:
        str: Text chunks from Ollama response
    """
    # Convert chat context to Ollama format for Gemma
    messages = []
    system_content = ""
    
    # Add the detailed instructions about get_context function as system content
    function_instructions = """
You have to guide user to resolve their issues and problems.                        
Your response should be **one step at a time**.
Always find the documentation steps for the problem to solve.
If user objects or unable to do what you are suggesting, you must fetch documentation steps for the problem.
Strictly follow the documentation steps.
User always provides you the latest screenshot of his screen.
You must analyse the screen and answer user based on the current screen situation.
Response user as if you are a human in a call so do not format your answer, it should be raw text only.
You have access to functions. If you decide to invoke any of the function(s),
You MUST put it in the format of
{"name": function name, "parameters": dictionary of argument name and its value}
You SHOULD NOT include any other text in the response if you call a function.
**Available functions**
[
    {
        "name": "get_context",
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
"""
    system_content += function_instructions.strip() + " "
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    # First pass: collect system content and process other messages
    raw_messages = []
    
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        
        # Handle content - could be string or list
        if isinstance(msg.content, list):
            # Check if we have both text and images
            text_parts = []
            image_parts = []
            
            for item in msg.content:
                if isinstance(item, str):
                    text_parts.append(item)
                elif hasattr(item, 'type') and item.type == 'image_content':
                    # Only include images for the last message
                    if idx == last_message_index:
                        # Handle ImageContent object
                        if hasattr(item, 'image') and item.image:
                            if isinstance(item.image, str) and item.image.startswith('data:image'):
                                # Extract base64 data from data URL
                                image_data = item.image.split(',')[1] if ',' in item.image else item.image
                                image_parts.append(image_data)
                            else:
                                # If it's raw image data, convert to base64
                                if hasattr(item.image, 'encode'):
                                    image_data = base64.b64encode(item.image.encode()).decode('utf-8')
                                else:
                                    image_data = base64.b64encode(str(item.image).encode()).decode('utf-8')
                                image_parts.append(image_data)
                    # For older messages, skip image content entirely
            
            # Collect text content
            text_content = " ".join(text_parts) if text_parts else ""
            
            if role == "system":
                # Collect system content separately
                system_content += text_content + " "
            else:
                # Keep assistant and user roles as they are
                if role == "assistant":
                    role = "assistant"
                elif role == "user":
                    role = "user"
                
                # Build message for Ollama
                if image_parts and idx == last_message_index:
                    # Ollama format: text in content, images in separate array (only for last message)
                    message = {
                        "role": role,
                        "content": text_content,
                        "images": image_parts
                    }
                    raw_messages.append(message)
                else:
                    # Text only (for all messages, and older messages without images)
                    raw_messages.append({
                        "role": role,
                        "content": text_content
                    })
        else:
            # Simple string content
            content = str(msg.content)
            
            if role == "system":
                # Collect system content separately
                system_content += content + " "
            else:
                # Keep assistant and user roles as they are
                if role == "assistant":
                    role = "assistant"
                elif role == "user":
                    role = "user"
                
                raw_messages.append({
                    "role": role,
                    "content": content
                })
    
    # Second pass: merge system content with first user message
    first_user_message_processed = False
    
    for message in raw_messages:
        if message["role"] == "user":
            if not first_user_message_processed and system_content:
                # Prepend system content to the first user message
                original_content = message["content"]
                combined_content = system_content.strip()
                if original_content:
                    combined_content += " " + original_content
                
                # Create new message with combined content
                new_message = {
                    "role": "user",
                    "content": combined_content
                }
                
                # Preserve images if they exist
                if "images" in message:
                    new_message["images"] = message["images"]
                
                messages.append(new_message)
                first_user_message_processed = True
            else:
                # Add regular user message
                messages.append(message)
        else:
            # Add assistant messages as they are
            messages.append(message)
    
    # If no user messages were found but we have system content, create a user message
    if not first_user_message_processed and system_content:
        messages.append({
            "role": "user",
            "content": system_content.strip()
        })
    
    # Make streaming call to Ollama
    ollama_payload = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    # Debug: Print the formatted messages (with truncated image data for readability)
    messages_for_log = []
    for msg in messages:
        msg_copy = {"role": msg["role"], "content": msg["content"]}
        if "images" in msg:
            # Show number of images instead of full data
            msg_copy["images"] = f"[{len(msg['images'])} image(s)]"
        messages_for_log.append(msg_copy)
    
    logger.info(f"Sending messages to Gemma via Ollama: {json.dumps(messages_for_log, indent=2)}")
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                ollama_url,
                json=ollama_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    function_buffer = ""
                    in_function_call = False
                    
                    async for line in response.content:
                        if line:
                            try:
                                line_text = line.decode('utf-8').strip()
                                if line_text:
                                    data = json.loads(line_text)
                                    if "message" in data and "content" in data["message"]:
                                        chunk_content = data["message"]["content"]
                                        
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
                                                    # Feed result back to LLM and yield its response
                                                    async for response_chunk in feed_function_result_to_llm(function_result, messages, model, ollama_url):
                                                        yield response_chunk
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
                                                    # Feed result back to LLM and yield its response
                                                    async for response_chunk in feed_function_result_to_llm(function_result, messages, model, ollama_url):
                                                        yield response_chunk
                                                # Reset state
                                                function_buffer = ""
                                                in_function_call = False
                                        else:
                                            # Regular content, yield it
                                            yield chunk_content
                            except json.JSONDecodeError:
                                continue
                            except Exception as e:
                                logger.error(f"Error processing chunk: {e}")
                                continue
                else:
                    logger.error(f"Ollama API error: {response.status}")
                    # Fallback response
                    yield "I'm having trouble connecting to the language model."
    except Exception as e:
        logger.error(f"Error calling Ollama: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties."


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
        
        if function_name == "get_context":
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


async def feed_function_result_to_llm(function_result: str, original_messages: list, model: str, ollama_url: str) -> AsyncIterable[str]:
    """
    Feed function result back to LLM as a user message and stream the response
    
    Args:
        function_result: The result from the function call
        original_messages: The original messages from the conversation
        model: The model to use
        ollama_url: The Ollama API endpoint URL
        
    Yields:
        str: Text chunks from LLM response
    """
    try:
        # Create a new messages list with the function result as a user message
        new_messages = original_messages.copy()
        
        # Extract function name from the result if possible
        function_name = "get_context"  # Default, could be extracted from function_result
        
        # Add the function result as a user message
        result_message = {
            "role": "user",
            "content": f"{function_name} has a result:\n{function_result}"
        }
        new_messages.append(result_message)
        
        # Make a new call to Ollama
        ollama_payload = {
            "model": model,
            "messages": new_messages,
            "stream": True
        }
        
        logger.info(f"Feeding function result back to LLM: {function_result[:100]}...")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                ollama_url,
                json=ollama_payload,
                headers={"Content-Type": "application/json"}
            ) as response:
                if response.status == 200:
                    async for line in response.content:
                        if line:
                            try:
                                line_text = line.decode('utf-8').strip()
                                if line_text:
                                    data = json.loads(line_text)
                                    if "message" in data and "content" in data["message"]:
                                        chunk_content = data["message"]["content"]
                                        yield chunk_content
                            except json.JSONDecodeError:
                                continue
                            except Exception as e:
                                logger.error(f"Error processing LLM response chunk: {e}")
                                continue
                else:
                    logger.error(f"Ollama API error when feeding function result: {response.status}")
                    yield "I had trouble processing the context information."
                    
    except Exception as e:
        logger.error(f"Error feeding function result to LLM: {e}")
        yield "I encountered an error while processing the function result."
