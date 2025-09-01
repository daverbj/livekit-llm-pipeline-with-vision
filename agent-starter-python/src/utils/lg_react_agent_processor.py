import json
import logging
from typing import AsyncIterable, Dict, Any, List
from livekit.agents import llm
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.language_models.base import BaseLanguageModel
from langchain_ollama import ChatOllama
from langchain_core.tools import tool
from typing_extensions import TypedDict, Annotated

logger = logging.getLogger("langgraph-react-processor")


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


class LangGraphReActAgent:
    """LangGraph ReAct agent processor that works with models without native tool calling."""
    
    def __init__(self, model: BaseLanguageModel = None, system_prompt: str = None):
        """
        Initialize the LangGraph ReAct agent.
        
        Args:
            model: The language model to use. Defaults to Ollama Gemma3
            system_prompt: System prompt for the agent
        """
        self.model = model or ChatOllama(
            model="gemma3:4b",
            temperature=0.7
        )
        
        # Define available tools
        self.tools = [get_weather]
        
        # Create the ReAct agent
        prompt = system_prompt or "You are a helpful assistant."
        
        # Enhanced prompt with tool information
        enhanced_prompt = f"""{prompt}

You have access to the following tools:
- get_weather: Get current weather information for any location

Use the weather tool when users ask about weather conditions, temperature, or climate for any city or location."""
        
        self.agent = create_react_agent(
            model=self.model,
            tools=self.tools,
            prompt=enhanced_prompt
        )
    
    async def process_streaming(self, messages: List) -> AsyncIterable[str]:
        """Process chat with streaming response using ReAct agent."""
        try:
            # Convert messages to the format expected by LangGraph
            langgraph_messages = []
            for msg in messages:
                if isinstance(msg, SystemMessage):
                    langgraph_messages.append({"role": "system", "content": msg.content})
                elif isinstance(msg, HumanMessage):
                    if isinstance(msg.content, list):
                        # Handle structured content (text + images)
                        text_parts = []
                        for item in msg.content:
                            if isinstance(item, dict) and item.get("type") == "text":
                                text_parts.append(item["text"])
                            elif isinstance(item, dict) and item.get("type") == "image_url":
                                # For ReAct agent, we'll describe the image presence
                                text_parts.append("[Image provided by user]")
                        content = " ".join(text_parts)
                    else:
                        content = str(msg.content)
                    langgraph_messages.append({"role": "user", "content": content})
                elif isinstance(msg, AIMessage):
                    langgraph_messages.append({"role": "assistant", "content": str(msg.content)})
            
            # Execute the agent
            logger.info(f"Processing {len(langgraph_messages)} messages with ReAct agent")
            
            # Invoke the agent
            result = await self.agent.ainvoke({"messages": langgraph_messages})
            
            # Extract the response
            if "messages" in result and result["messages"]:
                last_message = result["messages"][-1]
                if hasattr(last_message, 'content'):
                    content = last_message.content
                elif isinstance(last_message, dict) and "content" in last_message:
                    content = last_message["content"]
                else:
                    content = str(last_message)
                
                # Stream the response by yielding it as chunks
                if content:
                    yield content
                else:
                    yield "I've completed processing your request."
            else:
                yield "I'm experiencing technical difficulties. Please try again."
                
        except Exception as e:
            logger.error(f"Error in ReAct agent processing: {e}")
            yield "I'm experiencing technical difficulties. Please try again."


async def process_langgraph_react_chat(
    chat_ctx: llm.ChatContext,
    model: BaseLanguageModel = None,
    system_prompt: str = None
) -> AsyncIterable[str]:
    """
    Process chat context with LangGraph ReAct agent.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The language model to use
        system_prompt: Optional system prompt to use
        
    Yields:
        str: Text chunks from the agent response
    """
    try:
        # Initialize the ReAct agent
        agent = LangGraphReActAgent(model=model, system_prompt=system_prompt)
        
        # Convert LiveKit chat context to LangChain messages
        messages = []
        
        # Find the index of the last message (most recent) for image handling
        last_message_index = len(chat_ctx.items) - 1
        
        # Convert chat context messages
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
                            # For ReAct agent, we'll add a text description instead of actual image
                            message_content.append({
                                "type": "text", 
                                "text": "[User provided a screenshot/image for analysis]"
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
        
        # Debug logging
        logger.info(f"Processing {len(messages)} messages with LangGraph ReAct agent (images described in text)")
        
        # Stream the response
        async for chunk in agent.process_streaming(messages):
            if chunk:
                yield chunk
                
    except Exception as e:
        logger.error(f"Error in LangGraph ReAct processing: {e}")
        yield "I'm experiencing technical difficulties. Please try again."
