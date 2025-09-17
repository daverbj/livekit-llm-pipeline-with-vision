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
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
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
@tool
def get_documentation(query: str) -> str:
    """Get the documentation for based on user query.

    Args:
        query: The user query to get documentation for
    """
    return get_context_qdrant(query, project_name="hubspot")

# Define the state for our LangGraph
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

# Set up tools
tools = [get_weather, get_documentation]

checkpointer = InMemorySaver()

async def process_mistral_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> AsyncIterable[llm.ChatChunk]:
    
    # Create ChatOpenAI with tools enabled
    _llm = ChatOpenAI(model=model, temperature=1, base_url=base_url, streaming=True)
    llm_with_tools = _llm.bind_tools(tools)
    
    # Define the chatbot node (equivalent to the main LLM node)
    async def chatbot(state: State) -> State:
        """LLM decides whether to call a tool or not"""
        response = await llm_with_tools.ainvoke(state["messages"])
        return {"messages": [response]}
    
    # Use prebuilt ToolNode instead of custom tool_node
    tool_node = ToolNode(tools=tools)
    
    # Build workflow with tools using prebuilt components
    workflow = StateGraph(State)
    
    # Add nodes
    workflow.add_node("chatbot", chatbot)
    workflow.add_node("tools", tool_node)
    
    # Add edges to connect nodes using prebuilt tools_condition
    workflow.add_edge(START, "chatbot")
    workflow.add_conditional_edges(
        "chatbot",
        tools_condition,
        # The tools_condition returns "tools" if tool calls are present, "__end__" if not
        {"tools": "tools", "__end__": END}
    )
    # Any time a tool is called, we return to the chatbot to decide the next step
    workflow.add_edge("tools", "chatbot")
    
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
                SystemMessage(content="""
                              You are a helpful calling assistant.
                              User can share his screen image in video call with you.
                              You have to solve or guide user to help them to their issues.
                              You must guide user one step at a time.
                              Your workflow is:
                                1. User asks a question or shares an issue.
                                2. Get documentation by calling the get_documentation tool.
                                3. Check the image of the screen shared by user.
                                4. Analyse and determine user's current screen.
                                5. Guide user the next step.
                                6. Repeat until issue is resolved.
                              IMPORTANT: 
                                1. Always call the get_documentation function to get relevant documentation and context based on user's query.
                                2. Stick to the provided documentation and do not make up steps.
                                3. DO NOT format your response in markdown or any other format - plain text only.
                                4. ONE STEP AT A TIME - Do not provide multiple steps in one response.
                              """),
                new_human_message
            ]
            logger.info("New conversation: including system message")
        else:
            messages_to_send = [new_human_message]
            logger.info("Continuing conversation: appending user message only")
        
        # Stream from the LangGraph
        accumulated_content = ""
        in_tool_call_json = False
        bracket_count = 0
        
        async for event in graph.astream(
            {"messages": messages_to_send},
            config=config,
            stream_mode="messages"
        ):
            message_chunk, metadata = event
            
            # Only process AIMessage chunks that have actual text content
            if (isinstance(message_chunk, AIMessage) and 
                isinstance(message_chunk.content, str) and 
                message_chunk.content.strip() and 
                not getattr(message_chunk, 'tool_calls', None)):
                
                content = message_chunk.content
                accumulated_content += content
                
                # Check if we're starting a JSON structure
                if '[' in content and not in_tool_call_json:
                    in_tool_call_json = True
                    bracket_count = content.count('[') - content.count(']')
                    print(f"❌ Starting JSON block detection")
                    continue
                
                # If we're in a JSON block, track brackets
                if in_tool_call_json:
                    bracket_count += content.count('[') - content.count(']')
                    
                    # Check if JSON block is complete
                    if bracket_count <= 0:
                        in_tool_call_json = False
                        bracket_count = 0
                        accumulated_content = ""
                        print(f"❌ Ending JSON block detection")
                        continue
                    else:
                        print(f"❌ Skipping JSON content: {content}")
                        continue
                
                # If we're not in a JSON block, check for other tool call indicators
                if ('"name":' in content or '"arguments":' in content or
                    'get_documentation' in content or 'get_weather' in content or
                    content.strip() in ['{', '}', '"]', '"}']):
                    print(f"❌ Skipping tool call indicator: {content}")
                    continue
                
                # If we get here, it's legitimate content
                print(f"✅ Yielding AI content: {content}")
                yield llm.ChatChunk(
                    id="",
                    delta=llm.ChoiceDelta(
                        role="assistant",
                        content=content,
                        tool_calls=[]
                    ),
                    usage=None,
                )
            else:
                print(f"❌ Skipping message: {type(message_chunk).__name__}")
                
    else:
        yield llm.ChatChunk(
            request_id="",
            delta=llm.ChoiceDelta(
                role="assistant",
                content="No messages in chat context"
            ),
            index=0
        )