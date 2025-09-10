import json
import logging
import base64
import re
import uuid
from typing import AsyncIterable, Optional, Dict, Any
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI
from .tools import get_context_qdrant

logger = logging.getLogger("openai-processor")


# Define function definitions for function calling
FUNCTION_DEFINITIONS = [
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


def get_weather(city: str, unit: str = "celsius") -> Dict[str, Any]:
    """
    Mock weather function that returns static weather data.
    In a real implementation, this would call a weather API.
    """
    # Static weather data for testing
    weather_data = {
        "new york": {"temp": 22, "condition": "sunny", "humidity": 65},
        "london": {"temp": 15, "condition": "cloudy", "humidity": 78},
        "tokyo": {"temp": 28, "condition": "partly cloudy", "humidity": 70},
        "sydney": {"temp": 25, "condition": "rainy", "humidity": 85},
        "paris": {"temp": 18, "condition": "overcast", "humidity": 72}
    }
    
    city_lower = city.lower()
    base_data = weather_data.get(city_lower, {"temp": 20, "condition": "clear", "humidity": 60})
    
    # Convert temperature if needed
    temp = base_data["temp"]
    if unit == "fahrenheit":
        temp = (temp * 9/5) + 32
    
    return {
        "city": city,
        "temperature": temp,
        "unit": unit,
        "condition": base_data["condition"],
        "humidity": base_data["humidity"]
    }


def generate_tool_call_id() -> str:
    """Generate a valid tool call ID for vllm (9 alphanumeric characters)"""
    return str(uuid.uuid4()).replace('-', '')[:9]


def parse_mistral_function_calls(content: str) -> list:
    """
    Parse Mistral-style function calls from text content.
    Expected format: [TOOL_CALLS][{"name": "function_name", "arguments": {...}}]
    """
    try:
        # Look for [TOOL_CALLS] followed by JSON
        pattern = r'\[TOOL_CALLS\]\s*(\[.*?\])'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            json_str = match.group(1)
            function_calls = json.loads(json_str)
            return function_calls if isinstance(function_calls, list) else [function_calls]
    except (json.JSONDecodeError, AttributeError) as e:
        logger.error(f"Failed to parse Mistral function calls from content: {content[:100]}..., error: {e}")
    
    return []


def execute_function_call(function_name: str, arguments: Dict[str, Any]) -> str:
    """
    Execute a function call and return the result as a JSON string.
    """
    try:
        if function_name == "get_weather":
            result = get_weather(**arguments)
            return json.dumps(result)
        else:
            return json.dumps({"error": f"Unknown function: {function_name}"})
    except Exception as e:
        logger.error(f"Error executing function {function_name}: {e}")
        return json.dumps({"error": str(e)})


async def process_openai_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
    api_key: Optional[str] = None,
    max_tokens: int = 512,
    temperature: float = 0.5,
    session = None,
    enable_functions: bool = True
) -> AsyncIterable[str]:
    """
    Process chat context with OpenAI API, sending only the latest message's image data.
    Supports function calling with static weather data.
    
    Args:
        chat_ctx: The chat context from livekit (will be modified to add function results)
        model: The OpenAI model to use (e.g., "gpt-4o", "gpt-4-vision-preview", etc.)
        base_url: Custom base URL for OpenAI-compatible APIs (e.g., local servers)
        api_key: API key for authentication
        max_tokens: Maximum tokens to generate
        temperature: Temperature for response generation
        session: Session object (unused in this implementation)
        enable_functions: Whether to enable function calling
        
    Yields:
        str: Text chunks from OpenAI response
    """
    # Convert chat context to OpenAI format with proper role alternation
    # For Mistral compatibility, convert system messages to user messages with clear instructions
    messages = []
    
    # Find the index of the last message (most recent)
    last_message_index = len(chat_ctx.items) - 1
    
    # First pass: collect all messages and handle system message conversion
    raw_messages = []
    system_instructions = []
    
    for idx, msg in enumerate(chat_ctx.items):
        role = msg.role
        
        # Collect system instructions separately for Mistral compatibility
        if role == "system":
            if isinstance(msg.content, list):
                for item in msg.content:
                    if isinstance(item, str):
                        system_instructions.append(item)
            else:
                system_instructions.append(str(msg.content))
            continue  # Skip adding system messages to raw_messages
        elif role == "user":
            role = "user"
        elif role == "assistant":
            role = "assistant"
        
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
                                # OpenAI accepts data URLs directly
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
            raw_messages.append({
                "role": role,
                "content": content_blocks
            })
    
    # Process messages and inject system instructions into the first user message for Mistral compatibility
    i = 0
    while i < len(raw_messages):
        current_msg = raw_messages[i]
        
        # For user/assistant messages, check for consecutive same-role messages
        if current_msg["role"] in ["user", "assistant"]:
            merged_content = []
            
            # If this is the first user message and we have system instructions, prepend them
            if current_msg["role"] == "user" and len(messages) == 0 and system_instructions:
                # Create system instruction text for Mistral
                system_text = "System Instructions:\n" + "\n".join(system_instructions) + "\n\nUser: "
                merged_content.append({
                    "type": "text",
                    "text": system_text
                })
                logger.info(f"Added system instructions to first user message for Mistral compatibility")
            
            # Collect all consecutive messages with the same role
            while i < len(raw_messages) and raw_messages[i]["role"] == current_msg["role"]:
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
                    "role": current_msg["role"],
                    "content": merged_content
                })
        else:
            i += 1
    
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
    
    logger.info(f"Sending messages to OpenAI: {json.dumps(messages_for_log, indent=2)}")
    
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
        
        # Add function calling if enabled
        if enable_functions:
            request_params["tools"] = [
                {"type": "function", "function": func_def} 
                for func_def in FUNCTION_DEFINITIONS
            ]
            request_params["tool_choice"] = "auto"
            logger.info(f"Function calling enabled with {len(FUNCTION_DEFINITIONS)} functions")
        
        logger.info(f"Request params: {json.dumps({k: v for k, v in request_params.items() if k != 'messages'}, indent=2)}")
        
        # Create streaming completion
        stream = await client.chat.completions.create(**request_params)
        
        # Track function calls across chunks for both OpenAI and Mistral formats
        current_tool_calls = {}
        accumulated_content = ""  # Only for Mistral function call detection
        is_function_call = False  # Flag to track if we're in a function call
        
        # Process the streaming response
        async for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                
                # Handle regular text content
                if hasattr(delta, 'content') and delta.content:
                    
                    # Check if this might be the start of a function call
                    if not is_function_call and "[TOOL_CALLS]" in delta.content:
                        is_function_call = True
                        accumulated_content = delta.content
                        # Don't yield, start accumulating
                        continue
                    
                    # If we're in a function call, accumulate
                    if is_function_call:
                        accumulated_content += delta.content
                        
                        # Check if we have complete function call data
                        if "]" in delta.content and "[TOOL_CALLS]" in accumulated_content:
                            # Try to parse the complete function call
                            function_calls = parse_mistral_function_calls(accumulated_content)
                            
                            if function_calls:
                                logger.info(f"Detected Mistral function calls: {function_calls}")
                                
                                # Execute each function call and collect results
                                function_results = []
                                for i, func_call in enumerate(function_calls):
                                    try:
                                        function_name = func_call.get("name")
                                        arguments = func_call.get("arguments", {})
                                        
                                        logger.info(f"Executing function: {function_name} with args: {arguments}")
                                        
                                        # Execute the function
                                        result = execute_function_call(function_name, arguments)
                                        function_results.append({
                                            "function_name": function_name,
                                            "arguments": arguments,
                                            "result": result
                                        })
                                        
                                    except Exception as e:
                                        logger.error(f"Error executing function call: {func_call}, error: {e}")
                                        continue
                                
                                # Add function results to chat context
                                if function_results:
                                    # Format the results nicely
                                    results_text = ""
                                    for func_result in function_results:
                                        results_text += f"Function {func_result['function_name']} called with {func_result['arguments']}: {func_result['result']}\n"
                                    
                                    # Add assistant message with the function results
                                    chat_ctx.add_message(
                                        role="assistant",
                                        content=f"I called the following functions:\n{results_text.strip()}"
                                    )
                                    logger.info(f"Added function results to chat context")
                                    
                                    # Add user message asking for explanation
                                    chat_ctx.add_message(
                                        role="user",
                                        content="You got the weather result, explain this."
                                    )
                                    logger.info(f"Added explanation request to chat context")
                                    
                                    # Now make a new request to get the explanation and yield it
                                    # Convert chat context to messages for the explanation request
                                    explanation_messages = []
                                    for msg in chat_ctx.items:
                                        role = msg.role
                                        if role == "system":
                                            role = "system"
                                        elif role == "user":
                                            role = "user"
                                        elif role == "assistant":
                                            role = "assistant"
                                        
                                        # Handle content
                                        content_blocks = []
                                        if isinstance(msg.content, list):
                                            for item in msg.content:
                                                if isinstance(item, str):
                                                    content_blocks.append({
                                                        "type": "text",
                                                        "text": item
                                                    })
                                        else:
                                            content_blocks.append({
                                                "type": "text",
                                                "text": str(msg.content)
                                            })
                                        
                                        if content_blocks:
                                            explanation_messages.append({
                                                "role": role,
                                                "content": content_blocks
                                            })
                                    
                                    # Make explanation request
                                    explanation_params = {
                                        "model": model,
                                        "messages": explanation_messages,
                                        "max_tokens": max_tokens,
                                        "temperature": temperature,
                                        "stream": True
                                    }
                                    
                                    logger.info("Making explanation request after function call")
                                    explanation_stream = await client.chat.completions.create(**explanation_params)
                                    
                                    # Yield the explanation response in streaming fashion
                                    async for explanation_chunk in explanation_stream:
                                        if explanation_chunk.choices and len(explanation_chunk.choices) > 0:
                                            explanation_delta = explanation_chunk.choices[0].delta
                                            if hasattr(explanation_delta, 'content') and explanation_delta.content:
                                                yield explanation_delta.content
                                
                                # Return after handling function calls and explanation
                                return
                        
                        # Continue accumulating if we haven't found the end yet
                        continue
                    
                    else:
                        # Regular content, yield immediately for full streaming
                        yield delta.content
                
                # Handle standard OpenAI-style tool calls (fallback)
                if hasattr(delta, 'tool_calls') and delta.tool_calls:
                    for tool_call in delta.tool_calls:
                        call_id = tool_call.id
                        
                        if call_id not in current_tool_calls:
                            current_tool_calls[call_id] = {
                                'function_name': '',
                                'arguments': ''
                            }
                        
                        # Accumulate function name
                        if tool_call.function and tool_call.function.name:
                            current_tool_calls[call_id]['function_name'] += tool_call.function.name
                        
                        # Accumulate function arguments
                        if tool_call.function and tool_call.function.arguments:
                            current_tool_calls[call_id]['arguments'] += tool_call.function.arguments
                
                # Check if this is the end of the stream and we have standard OpenAI function calls to execute
                if chunk.choices[0].finish_reason == "tool_calls" and current_tool_calls:
                    # Execute all accumulated function calls
                    for call_id, call_data in current_tool_calls.items():
                        function_name = call_data['function_name']
                        arguments_str = call_data['arguments']
                        
                        try:
                            arguments = json.loads(arguments_str)
                            logger.info(f"Executing function: {function_name} with args: {arguments}")
                            
                            # Execute the function
                            result = execute_function_call(function_name, arguments)
                            
                            # Add function result to messages and get a new response
                            messages.append({
                                "role": "assistant",
                                "content": None,
                                "tool_calls": [{
                                    "id": call_id,
                                    "type": "function",
                                    "function": {
                                        "name": function_name,
                                        "arguments": arguments_str
                                    }
                                }]
                            })
                            
                            messages.append({
                                "role": "tool",
                                "content": result,
                                "tool_call_id": call_id
                            })
                            
                        except json.JSONDecodeError as e:
                            logger.error(f"Failed to parse function arguments: {arguments_str}, error: {e}")
                            continue
                    
                    # Make a new request with the function results
                    new_request_params = {
                        "model": model,
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": temperature,
                        "stream": True
                    }
                    
                    if enable_functions:
                        new_request_params["tools"] = [
                            {"type": "function", "function": func_def} 
                            for func_def in FUNCTION_DEFINITIONS
                        ]
                        new_request_params["tool_choice"] = "auto"
                    
                    # Get the follow-up response and stream it
                    follow_up_stream = await client.chat.completions.create(**new_request_params)
                    
                    async for follow_chunk in follow_up_stream:
                        if follow_chunk.choices and len(follow_chunk.choices) > 0:
                            follow_delta = follow_chunk.choices[0].delta
                            if hasattr(follow_delta, 'content') and follow_delta.content:
                                yield follow_delta.content
                    
    except Exception as e:
        logger.error(f"Error calling OpenAI: {e}")
        # Fallback response
        yield "I'm experiencing technical difficulties with the language model."
