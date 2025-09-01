import json
import logging
from typing import AsyncIterable, Dict, Any, List
from livekit.agents import llm
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.language_models.base import BaseLanguageModel
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from typing_extensions import TypedDict, Annotated

logger = logging.getLogger("langgraph-processor")


@tool
def get_weather(location: str) -> str:
    """Get current weather information for a given location.
    
    Args:
        location: The city or location to get weather for
        
    Returns:
        Weather information as a string
    """
    # Hardcoded weather data for demonstration
    weather_data = {
        "temperature": "22°C",
        "condition": "Partly Cloudy", 
        "humidity": "65%",
        "wind": "10 km/h SW",
        "feels_like": "24°C"
    }
    
    weather_report = f"""Weather for {location}:
🌤️ Temperature: {weather_data['temperature']} (feels like {weather_data['feels_like']})
☁️ Conditions: {weather_data['condition']}
💧 Humidity: {weather_data['humidity']}
💨 Wind: {weather_data['wind']}"""
    
    logger.info(f"Weather requested for {location}")
    return weather_report


class ChatState(TypedDict):
    """State for the chatbot graph."""
    messages: Annotated[List, add_messages]
    response: str


class LangGraphChatbot:
    """Simple LangGraph-based chatbot processor with tools."""
    
    def __init__(self, model: BaseLanguageModel = None):
        """
        Initialize the LangGraph chatbot.
        
        Args:
            model: The language model to use. Defaults to OpenAI GPT-3.5-turbo
        """
        self.model = model or ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.7,
            streaming=True
        )
        
        # Define available tools
        self.tools = [get_weather]
        
        # Bind tools to the model
        self.model_with_tools = self.model.bind_tools(self.tools)
        
        self.graph = self._create_graph()
    
    def _create_graph(self) -> StateGraph:
        """Create the LangGraph conversation graph with tool support."""
        
        def chat_node(state: ChatState) -> Dict[str, Any]:
            """Main chat processing node."""
            try:
                # Get the latest messages
                messages = state["messages"]
                
                # Call the language model with tools
                response = self.model_with_tools.invoke(messages)
                
                return {"messages": [response]}
                
            except Exception as e:
                logger.error(f"Error in chat node: {e}")
                error_msg = "I'm experiencing technical difficulties. Please try again."
                return {
                    "messages": [AIMessage(content=error_msg)],
                    "response": error_msg
                }
        
        def tool_node(state: ChatState) -> Dict[str, Any]:
            """Execute tool calls."""
            messages = state["messages"]
            last_message = messages[-1]
            
            tool_results = []
            
            if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                for tool_call in last_message.tool_calls:
                    tool_name = tool_call["name"]
                    tool_args = tool_call["args"]
                    tool_id = tool_call["id"]
                    
                    # Find and execute the tool
                    tool_result = None
                    for tool in self.tools:
                        if tool.name == tool_name:
                            try:
                                tool_result = tool.invoke(tool_args)
                                logger.info(f"Tool {tool_name} executed successfully: {tool_result}")
                            except Exception as e:
                                tool_result = f"Error executing {tool_name}: {str(e)}"
                                logger.error(f"Tool execution error: {e}")
                            break
                    
                    if tool_result is None:
                        tool_result = f"Tool {tool_name} not found"
                    
                    # Create tool message
                    tool_message = ToolMessage(
                        content=str(tool_result),
                        tool_call_id=tool_id
                    )
                    tool_results.append(tool_message)
            
            return {"messages": tool_results}
        
        def should_continue(state: ChatState) -> str:
            """Determine if we should continue to tools or end."""
            messages = state["messages"]
            last_message = messages[-1]
            
            # If the last message has tool calls, go to tools
            if hasattr(last_message, 'tool_calls') and last_message.tool_calls:
                return "tools"
            
            # Otherwise, end the conversation
            return END
        
        # Create the graph
        workflow = StateGraph(ChatState)
        
        # Add nodes
        workflow.add_node("chat", chat_node)
        workflow.add_node("tools", tool_node)
        
        # Set entry point
        workflow.set_entry_point("chat")
        
        # Add edges
        workflow.add_conditional_edges(
            "chat",
            should_continue,
            {
                "tools": "tools",
                END: END
            }
        )
        
        # After tools, go back to chat for final response
        workflow.add_edge("tools", "chat")
        
        return workflow.compile()
    
    async def process_streaming(self, state: ChatState) -> AsyncIterable[str]:
        """Process chat with streaming response."""
        try:
            # Execute the graph
            result = await self.graph.ainvoke(state)
            
            # Get the final response
            messages = result.get("messages", [])
            if messages:
                last_message = messages[-1]
                if hasattr(last_message, 'content') and last_message.content:
                    # For streaming, we'll yield the content in chunks
                    content = last_message.content
                    if hasattr(self.model, 'astream') and not hasattr(last_message, 'tool_calls'):
                        # Try to stream if possible and not a tool call
                        try:
                            # Re-run with streaming for the final response
                            final_messages = result["messages"][:-1] + [last_message]
                            async for chunk in self.model.astream(final_messages):
                                if hasattr(chunk, 'content') and chunk.content:
                                    yield chunk.content
                            return
                        except:
                            pass
                    
                    # Fallback: yield the complete content
                    yield content
                else:
                    yield "I've completed the task."
            else:
                yield "I'm experiencing technical difficulties. Please try again."
                    
        except Exception as e:
            logger.error(f"Error in streaming process: {e}")
            yield "I'm experiencing technical difficulties. Please try again."


async def process_langgraph_chat(
    chat_ctx: llm.ChatContext,
    model: BaseLanguageModel = None,
    system_prompt: str = None
) -> AsyncIterable[str]:
    """
    Process chat context with LangGraph chatbot.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The language model to use
        system_prompt: Optional system prompt to use
        
    Yields:
        str: Text chunks from the chatbot response
    """
    try:
        # Initialize the chatbot
        chatbot = LangGraphChatbot(model=model)
        
        # Convert LiveKit chat context to LangChain messages
        messages = []
        
        # Add system prompt if provided
        if system_prompt:
            # Enhance system prompt with tool information
            enhanced_prompt = f"""{system_prompt}

You have access to the following tools:
- get_weather: Get current weather information for any location

Use the weather tool when users ask about weather conditions, temperature, or climate for any city or location."""
            messages.append(SystemMessage(content=enhanced_prompt))
        
        # Convert chat context messages
        # Find the index of the last message (most recent)
        last_message_index = len(chat_ctx.items) - 1
        
        for idx, msg in enumerate(chat_ctx.items):
            role = msg.role
            
            # Handle content - could be string or list
            if isinstance(msg.content, list):
                # Handle mixed content (text + images)
                message_content = []
                
                for item in msg.content:
                    if isinstance(item, str):
                        # Text content
                        if item.strip():  # Only add non-empty text
                            message_content.append({"type": "text", "text": item})
                    elif hasattr(item, 'type') and item.type == 'image_content':
                        # Only include images for the last message
                        if idx == last_message_index:
                            # Image content
                            if hasattr(item, 'image') and item.image:
                                image_data = item.image
                                # Handle different image formats
                                if isinstance(image_data, str):
                                    if image_data.startswith('data:image'):
                                        # Data URL format - use directly
                                        message_content.append({
                                            "type": "image_url",
                                            "image_url": {"url": image_data}
                                        })
                                    else:
                                        # Base64 string - convert to data URL
                                        message_content.append({
                                            "type": "image_url", 
                                            "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}
                                        })
                                else:
                                    # Other image formats - convert to string and assume base64
                                    image_str = str(image_data)
                                    message_content.append({
                                        "type": "image_url",
                                        "image_url": {"url": f"data:image/jpeg;base64,{image_str}"}
                                    })
                        # For older messages, skip image content entirely
                    elif hasattr(item, 'type') and item.type != 'image_content':
                        # Handle other content types as text
                        text_content = str(item)
                        if text_content.strip():
                            message_content.append({"type": "text", "text": text_content})
                
                # Use the structured content if we have it, otherwise fallback to text
                if message_content:
                    content = message_content
                else:
                    content = ""
            else:
                # Simple string content
                content = str(msg.content)
            
            # Convert to appropriate message type
            if role == "system":
                messages.append(SystemMessage(content=content))
            elif role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                # Default to human message
                messages.append(HumanMessage(content=content))
        
        # Create initial state
        initial_state = ChatState(
            messages=messages,
            response=""
        )
        
        # Debug logging
        logger.info(f"Processing {len(messages)} messages with LangGraph (images only in last message)")
        
        # Log message types for debugging
        for i, msg in enumerate(messages):
            if hasattr(msg, 'content'):
                if isinstance(msg.content, list):
                    content_types = [item.get('type', 'unknown') for item in msg.content if isinstance(item, dict)]
                    has_images = 'image_url' in content_types
                    logger.debug(f"Message {i} ({msg.__class__.__name__}): {len(msg.content)} items - types: {content_types} {'(has images)' if has_images else ''}")
                else:
                    logger.debug(f"Message {i} ({msg.__class__.__name__}): text content")
        
        # Stream the response
        async for chunk in chatbot.process_streaming(initial_state):
            if chunk:
                yield chunk
                
    except Exception as e:
        logger.error(f"Error in LangGraph processing: {e}")
        yield "I'm experiencing technical difficulties. Please try again."
