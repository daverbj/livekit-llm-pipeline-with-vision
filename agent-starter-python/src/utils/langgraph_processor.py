import json
import logging
from typing import AsyncIterable, Dict, Any, List
from livekit.agents import llm
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.language_models.base import BaseLanguageModel
from langchain_openai import ChatOpenAI
from typing_extensions import TypedDict, Annotated

logger = logging.getLogger("langgraph-processor")


class ChatState(TypedDict):
    """State for the chatbot graph."""
    messages: Annotated[List, add_messages]
    response: str


class LangGraphChatbot:
    """Simple LangGraph-based chatbot processor."""
    
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
        self.graph = self._create_graph()
    
    def _create_graph(self) -> StateGraph:
        """Create the LangGraph conversation graph."""
        
        def chat_node(state: ChatState) -> Dict[str, Any]:
            """Main chat processing node."""
            try:
                # Get the latest messages
                messages = state["messages"]
                
                # Call the language model
                response = self.model.invoke(messages)
                
                # Extract content from response
                if hasattr(response, 'content'):
                    response_text = response.content
                else:
                    response_text = str(response)
                
                return {
                    "messages": [AIMessage(content=response_text)],
                    "response": response_text
                }
            except Exception as e:
                logger.error(f"Error in chat node: {e}")
                error_msg = "I'm experiencing technical difficulties. Please try again."
                return {
                    "messages": [AIMessage(content=error_msg)],
                    "response": error_msg
                }
        
        def should_continue(state: ChatState) -> str:
            """Determine if conversation should continue."""
            # For a simple chatbot, we always end after generating a response
            return END
        
        # Create the graph
        workflow = StateGraph(ChatState)
        
        # Add nodes
        workflow.add_node("chat", chat_node)
        
        # Set entry point
        workflow.set_entry_point("chat")
        
        # Add edges
        workflow.add_conditional_edges(
            "chat",
            should_continue,
            {END: END}
        )
        
        return workflow.compile()
    
    async def process_streaming(self, state: ChatState) -> AsyncIterable[str]:
        """Process chat with streaming response."""
        try:
            messages = state["messages"]
            
            # Use streaming if available
            if hasattr(self.model, 'astream'):
                async for chunk in self.model.astream(messages):
                    if hasattr(chunk, 'content') and chunk.content:
                        yield chunk.content
            else:
                # Fallback to non-streaming
                response = await self.model.ainvoke(messages)
                content = response.content if hasattr(response, 'content') else str(response)
                yield content
                    
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
            messages.append(SystemMessage(content=system_prompt))
        
        # Convert chat context messages
        for msg in chat_ctx.items:
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
        logger.info(f"Processing {len(messages)} messages with LangGraph")
        
        # Log message types for debugging
        for i, msg in enumerate(messages):
            if hasattr(msg, 'content'):
                if isinstance(msg.content, list):
                    content_types = [item.get('type', 'unknown') for item in msg.content if isinstance(item, dict)]
                    logger.debug(f"Message {i} ({msg.__class__.__name__}): {len(msg.content)} items - types: {content_types}")
                else:
                    logger.debug(f"Message {i} ({msg.__class__.__name__}): text content")
        
        # Stream the response
        async for chunk in chatbot.process_streaming(initial_state):
            if chunk:
                yield chunk
                
    except Exception as e:
        logger.error(f"Error in LangGraph processing: {e}")
        yield "I'm experiencing technical difficulties. Please try again."
