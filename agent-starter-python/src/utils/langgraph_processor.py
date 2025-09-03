import json
import logging
from typing import AsyncIterable, Dict, Any, List
from livekit.agents import llm
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.language_models.base import BaseLanguageModel
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from typing_extensions import TypedDict, Annotated
from .tools import get_context_qdrant
logger = logging.getLogger("langgraph-processor")

class ChatState(TypedDict):
    """State for the chatbot graph."""
    messages: Annotated[List, add_messages]
    response: str

@tool
async def get_context(query: str) -> str:
    """Get context based on the user's query."""
    return await get_context_qdrant(query=query, project_name="hubspot")

class LangGraphChatbot:
    """Simple LangGraph-based chatbot processor with tools."""

    def __init__(self, model: BaseLanguageModel = None, project_name: str = None, session = None):
        """
        Initialize the LangGraph chatbot.
        
        Args:
            model: The language model to use. Defaults to OpenAI gpt-4o
            project_name: Name of the project for context retrieval
            session: Session information for thread management
        """
        self.model = model
        self.project_name = project_name
        self.session = session
        # Define available tools
        self.tools = [get_context]

        # Bind tools to the model
        self.model_with_tools = self.model.bind_tools(self.tools)
        
        # Create memory for persistent checkpointing
        self.memory = InMemorySaver()
        
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
        
        async def tool_node(state: ChatState) -> Dict[str, Any]:
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
                                # Check if the tool function is async
                                if hasattr(tool.func, '__call__') and hasattr(tool.func, '__code__'):
                                    if tool.func.__code__.co_flags & 0x80:  # CO_COROUTINE flag
                                        tool_result = await tool.ainvoke(tool_args)
                                    else:
                                        tool_result = tool.invoke(tool_args)
                                else:
                                    # Try async first, fall back to sync
                                    try:
                                        tool_result = await tool.ainvoke(tool_args)
                                    except:
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
        
        # Compile with memory checkpointer for persistent conversations
        return workflow.compile(checkpointer=self.memory)
    
    async def process_streaming(self, state: ChatState, thread_id: str = "default") -> AsyncIterable[str]:
        """Process chat with streaming response and persistent memory."""
        try:
            # Create config for this conversation thread
            config = {"configurable": {"thread_id": thread_id}}
            
            # Execute the graph with memory persistence
            result = await self.graph.ainvoke(state, config=config)
            
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

    def get_conversation_state(self, thread_id: str = "default") -> dict:
        """Get the current state of a conversation thread."""
        try:
            config = {"configurable": {"thread_id": thread_id}}
            snapshot = self.graph.get_state(config)
            return {
                "messages": snapshot.values.get("messages", []),
                "thread_id": thread_id,
                "config": snapshot.config,
                "created_at": snapshot.created_at
            }
        except Exception as e:
            logger.error(f"Error getting conversation state: {e}")
            return {"messages": [], "thread_id": thread_id}


async def process_langgraph_chat(
    chat_ctx: llm.ChatContext,
    model: BaseLanguageModel = None,
    system_prompt: str = None,
    project_name: str = None,
    session = None
) -> AsyncIterable[str]:
    """
    Process chat context with LangGraph chatbot with persistent memory.
    
    Args:
        chat_ctx: The chat context from livekit
        model: The language model to use
        system_prompt: Optional system prompt to use
        project_name: Name of the project for context retrieval
        session: Session information for thread management
        
    Yields:
        str: Text chunks from the chatbot response
    """
    try:
        # Initialize the chatbot
        chatbot = LangGraphChatbot(model=model, project_name=project_name, session=session)

        # Generate thread_id from session info if available
        thread_id = "default"
        if session:
            # Use session room name or participant identity as thread_id
            if hasattr(session, 'room') and hasattr(session.room, 'name'):
                thread_id = session.room.name
            elif hasattr(session, 'participant') and hasattr(session.participant, 'identity'):
                thread_id = session.participant.identity
            else:
                thread_id = str(getattr(session, 'session_id', 'default'))
        
        logger.info(f"Using thread_id: {thread_id} for conversation memory")

        # For new conversations, we only add the latest user message
        # The memory system will handle maintaining conversation history
        messages = []
        
        # Add system prompt if provided (only for new conversations)
        if system_prompt:
            # Enhanced system prompt with tool information
            enhanced_prompt = f"""{system_prompt}
            You have to guide user to resolve their issues.
            Workflow:
            - For a question or issue, get context first by calling "get_context" function.
            - Do not answer any query without context.
            - User provides you the latest screenshot of his screen through continuous screenshare feed.
            - You must analyse the screen and answer/guide user based on the current screen situation.

            Rule:
            Your response should be **one step at a time**.
            Response user as if you are a human in a call so do not format your answer, it should be raw text only.
            """
            messages.append(SystemMessage(content=enhanced_prompt))
        
        # Get the current conversation state to see if we have history
        current_state = chatbot.get_conversation_state(thread_id)
        existing_messages = current_state.get("messages", [])
        
        # Only add new messages that aren't already in the conversation history
        # Convert chat context messages (usually just the latest user message)
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
                # Only add system messages if no existing conversation
                if not existing_messages:
                    messages.append(SystemMessage(content=content))
            elif role == "user":
                messages.append(HumanMessage(content=content))
            elif role == "assistant":
                messages.append(AIMessage(content=content))
            else:
                # Default to human message
                messages.append(HumanMessage(content=content))
        
        # Create initial state with new messages
        # The memory system will merge these with existing conversation history
        initial_state = ChatState(
            messages=messages,
            response=""
        )
        
        # Debug logging
        logger.info(f"Processing {len(messages)} new messages with LangGraph memory (thread: {thread_id})")
        logger.info(f"Existing conversation has {len(existing_messages)} messages")
        
        # Log message types for debugging
        for i, msg in enumerate(messages):
            if hasattr(msg, 'content'):
                if isinstance(msg.content, list):
                    content_types = [item.get('type', 'unknown') for item in msg.content if isinstance(item, dict)]
                    has_images = 'image_url' in content_types
                    logger.debug(f"New message {i} ({msg.__class__.__name__}): {len(msg.content)} items - types: {content_types} {'(has images)' if has_images else ''}")
                else:
                    logger.debug(f"New message {i} ({msg.__class__.__name__}): text content")
        
        # Stream the response with persistent memory
        async for chunk in chatbot.process_streaming(initial_state, thread_id=thread_id):
            if chunk:
                yield chunk
                
    except Exception as e:
        logger.error(f"Error in LangGraph processing: {e}")
        yield "I'm experiencing technical difficulties. Please try again."
