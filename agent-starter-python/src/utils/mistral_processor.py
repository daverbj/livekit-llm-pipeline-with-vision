import json
import logging
import base64
import re
import uuid
from typing import AsyncIterable, Optional, Dict, Any, Annotated
from livekit.agents import llm
import asyncio
import openai
from openai import AsyncOpenAI
from .tools import get_context_qdrant

import os
from langchain.chat_models import init_chat_model
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

logger = logging.getLogger("mistral-processor")


# Define the state for our LangGraph
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]

checkpointer = InMemorySaver()

async def process_mistral_chat(
    chat_ctx: llm.ChatContext,
    model: str = "gpt-4o",
    base_url: Optional[str] = None,
    thread_id: Optional[str] = None,
) -> AsyncIterable[llm.ChatChunk]:
    
    # Create ChatOpenAI with streaming enabled
    _llm = ChatOpenAI(model=model, temperature=0.7, base_url=base_url, streaming=True)
    
    # Define the single node function
    async def chat_node(state: State) -> State:
        response = await _llm.ainvoke(state["messages"])
        return {"messages": [response]}
    
    # Create the workflow
    workflow = StateGraph(State)
    workflow.add_node("chat", chat_node)
    workflow.add_edge(START, "chat")
    workflow.add_edge("chat", END)
    
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
                SystemMessage(content="You are a helpful assistant. You are excellent at understanding and describing images."),
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
                # Yield AI message content directly
                if hasattr(message_chunk, 'content') and message_chunk.content:
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


    