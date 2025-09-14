import json
import logging
import base64
import re
import uuid
from typing import AsyncIterable, Optional, Dict, Any, Annotated, Literal
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI
from .tools import get_context_qdrant

import os
from langchain.chat_models import init_chat_model
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

logger = logging.getLogger("mistral-processor")


# Define weather tool
@tool
def get_weather(city: str) -> str:
    """Get the current weather for a city.

    Args:
        city: The name of the city to get weather for
    """
    # This is a mock weather service - in a real application you'd call an actual weather API
    weather_data = {
        "new york": "Sunny, 72°F (22°C)",
        "london": "Cloudy, 59°F (15°C)", 
        "tokyo": "Rainy, 68°F (20°C)",
        "paris": "Partly cloudy, 65°F (18°C)",
        "sydney": "Sunny, 75°F (24°C)",
        "moscow": "Snow, 28°F (-2°C)",
        "mumbai": "Hot, 86°F (30°C)",
        "berlin": "Overcast, 55°F (13°C)"
    }
    
    city_lower = city.lower()
    if city_lower in weather_data:
        return f"The weather in {city} is: {weather_data[city_lower]}"
    else:
        return f"Sorry, I don't have weather data for {city}. Available cities: {', '.join(weather_data.keys())}"


# Define the state for our LangGraph
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# Set up tools
tools = [get_weather]
tools_by_name = {tool.name: tool for tool in tools}

checkpointer = InMemorySaver()

async def process_mistral_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> AsyncIterable[llm.ChatChunk]:
    
    # Create ChatOpenAI with tools enabled
    _llm = ChatOpenAI(model=model, temperature=0.7, base_url=base_url, streaming=True)
    llm_with_tools = _llm.bind_tools(tools)
    
    # Define the LLM node
    async def llm_call(state: State) -> State:
        """LLM decides whether to call a tool or not"""
        response = await llm_with_tools.ainvoke(state["messages"])
        return {"messages": [response]}
    
    # Define the tool node
    async def tool_node(state: State) -> State:
        """Performs the tool call"""
        result = []
        last_message = state["messages"][-1]
        
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                tool = tools_by_name[tool_call["name"]]
                try:
                    observation = await asyncio.to_thread(tool.invoke, tool_call["args"])
                    result.append(ToolMessage(
                        content=str(observation), 
                        tool_call_id=tool_call["id"]
                    ))
                except Exception as e:
                    logger.error(f"Error executing tool {tool_call['name']}: {e}")
                    result.append(ToolMessage(
                        content=f"Error executing tool: {str(e)}", 
                        tool_call_id=tool_call["id"]
                    ))
        
        return {"messages": result}
    
    # Define logic to determine whether to continue or end
    def should_continue(state: State):
        """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
        messages = state["messages"]
        last_message = messages[-1]
        
        # If the LLM makes a tool call, then perform an action
        if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
            return "tool_node"
        # Otherwise, we stop (reply to the user)
        return END
    
    # Build workflow with tools
    workflow = StateGraph(State)
    
    # Add nodes
    workflow.add_node("llm_call", llm_call)
    workflow.add_node("tool_node", tool_node)
    
    # Add edges to connect nodes
    workflow.add_edge(START, "llm_call")
    workflow.add_conditional_edges(
        "llm_call",
        should_continue,
        ["tool_node", END]
    )
    workflow.add_edge("tool_node", "llm_call")
    
    # Compile with checkpointer
    graph = workflow.compile(checkpointer=checkpointer)
    
    # Create a unique thread ID for this conversation
    if thread_id is None:
        thread_id = f"thread_{uuid.uuid4().hex[:8]}"
    config = {"configurable": {"thread_id": thread_id}}
    
    # Get the last message from chat context and format it properly
    if chat_ctx.items:
        last_message = chat_ctx.items[-1]
        
        # Handle multimodal content (text + images)
        message_content = []
        
        if isinstance(last_message.content, list):
            # Process each content item
            for item in last_message.content:
                if isinstance(item, str):
                    # Text content
                    if item.strip():
                        message_content.append({"type": "text", "text": item})
                elif hasattr(item, 'type'):
                    if item.type == 'image_content':
                        # Image content - the image is directly in item.image as a data URL
                        try:
                            if hasattr(item, 'image'):
                                image_data = item.image
                                
                                # Check if it's already a data URL
                                if isinstance(image_data, str) and image_data.startswith('data:image'):
                                    data_url = image_data
                                elif isinstance(image_data, str):
                                    # Assume it's base64 encoded, add data URL prefix
                                    data_url = f"data:image/jpeg;base64,{image_data}"
                                elif isinstance(image_data, bytes):
                                    # Convert bytes to base64
                                    image_b64 = base64.b64encode(image_data).decode('utf-8')
                                    data_url = f"data:image/jpeg;base64,{image_b64}"
                                else:
                                    logger.warning(f"Unexpected image data type: {type(image_data)}")
                                    continue
                                
                                message_content.append({
                                    "type": "image",
                                    "source_type": "url",
                                    "url": data_url
                                })
                                logger.info(f"Added image to message content: {data_url[:50]}...")
                        except Exception as e:
                            logger.error(f"Error processing image: {e}")
                    else:
                        # Other content types (convert to text)
                        text_content = str(item)
                        if text_content.strip():
                            message_content.append({"type": "text", "text": text_content})
        else:
            # Simple string content
            content_text = str(last_message.content)
            if content_text.strip():
                message_content.append({"type": "text", "text": content_text})
        
        # Create messages for the graph - only append the new human message
        if message_content:
            new_human_message = HumanMessage(content=message_content)
            logger.info(f"Appending multimodal message with {len(message_content)} content items")
        else:
            new_human_message = HumanMessage(content="Hello")
            logger.info("Appending default message")
        
        # Check if this is a new conversation (no existing state)
        try:
            # Try to get the current state to see if conversation exists
            current_state = graph.get_state(config)
            is_new_conversation = not current_state.values.get("messages", [])
        except:
            # If we can't get state, assume it's a new conversation
            is_new_conversation = True
        
        # Prepare messages - include system message only for new conversations
        if is_new_conversation:
            messages_to_send = [
                SystemMessage(content="You are a helpful assistant. You are excellent at understanding and describing images. You can also get weather information for cities using the get_weather tool. When you receive tool results, interpret them and provide a natural, helpful response to the user."),
                new_human_message
            ]
            logger.info("New conversation: including system message")
        else:
            messages_to_send = [new_human_message]
            logger.info("Continuing conversation: appending user message only")
        
        # Stream from the LangGraph
        async for event in graph.astream(
            {"messages": messages_to_send},
            config=config,
            stream_mode="messages"
        ):
            # Handle the tuple structure (message_chunk, metadata)
            if isinstance(event, tuple) and len(event) == 2:
                message_chunk, metadata = event
                
                # Log message type for debugging
                logger.debug(f"Message chunk type: {type(message_chunk)}, has content: {hasattr(message_chunk, 'content')}")
                if hasattr(message_chunk, 'type'):
                    logger.debug(f"Message type: {message_chunk.type}")
                
                # Only process messages with content
                if hasattr(message_chunk, 'content') and message_chunk.content:
                    # Skip ToolMessage instances - these are internal
                    if isinstance(message_chunk, ToolMessage):
                        logger.debug("Skipping ToolMessage")
                        continue
                    
                    # Skip SystemMessage and HumanMessage instances
                    if isinstance(message_chunk, (SystemMessage, HumanMessage)):
                        logger.debug(f"Skipping {type(message_chunk).__name__}")
                        continue
                    
                    # Yield all other messages (should be AI assistant responses)
                    logger.debug(f"Yielding message content: {str(message_chunk.content)[:50]}...")
                    yield llm.ChatChunk(
                        id="",
                        delta=llm.ChoiceDelta(
                            role="assistant",
                            content=message_chunk.content,
                            tool_calls=[]
                        ),
                        usage=None,
                    )
    else:
        yield llm.ChatChunk(
            request_id="",
            delta=llm.ChoiceDelta(
                role="assistant",
                content="No messages in chat context"
            ),
            index=0
        )


    