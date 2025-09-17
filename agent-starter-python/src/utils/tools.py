import json
import logging
import aiohttp
import os
import re

logger = logging.getLogger("tools")


async def perform_similarity_search(query_text: str, collection_name: str = None, limit: int = 5, project_name: str = None) -> list:
    """
    Perform similarity search using Qdrant with Ollama embeddings (mxbai-embed-large model)
    
    Args:
        query_text: The text to search for
        collection_name: Optional collection name, uses project-based collection if not provided
        limit: Number of results to return
        project_name: Project name to use for collection if collection_name not provided
        
    Returns:
        List of search results with scores and payloads
    """
    try:
        # Use project-based collection name if not provided
        if collection_name is None:
            if project_name:
                # Convert project name to canonical collection name
                collection_name = normalize_collection_name(project_name)
            else:
                logger.warning("No project name and no collection name provided")
                return []
        
        # Generate embedding using Ollama
        embedding = await get_ollama_embedding(query_text)
        if not embedding:
            logger.error("Failed to generate embedding")
            return []
        
        # Perform Qdrant search
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        search_url = f"{qdrant_url}/collections/{collection_name}/points/search"
        
        search_payload = {
            "vector": embedding,
            "limit": limit,
            "with_payload": True,
            "with_vector": False
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(search_url, json=search_payload) as response:
                if response.status == 200:
                    result = await response.json()
                    search_results = result.get("result", [])
                    logger.info(f"Found {len(search_results)} similar documents")
                    return search_results
                else:
                    logger.error(f"Qdrant search failed with status {response.status}")
                    return []
                    
    except Exception as e:
        logger.error(f"Error performing similarity search: {e}")
        return []


async def get_ollama_embedding(text: str) -> list:
    """
    Generate embedding using Ollama with mxbai-embed-large model
    
    Args:
        text: Text to embed
        
    Returns:
        Embedding vector as list of floats
    """
    try:
        ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        embed_url = f"{ollama_url}/api/embeddings"
        
        payload = {
            "model": "mxbai-embed-large",
            "prompt": text
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(embed_url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    embedding = result.get("embedding", [])
                    logger.debug(f"Generated embedding of dimension {len(embedding)}")
                    return embedding
                else:
                    logger.error(f"Ollama embedding failed with status {response.status}")
                    return []
                    
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        return []


def normalize_collection_name(project_name: str) -> str:
    """
    Convert project name to canonical collection name
    - Convert to lowercase
    - Replace spaces and special characters with underscores
    - Remove consecutive underscores
    - Strip leading/trailing underscores
    
    Args:
        project_name: The project name to normalize
        
    Returns:
        Normalized collection name
    """
    # Convert to lowercase and replace non-alphanumeric chars with underscores
    normalized = re.sub(r'[^a-zA-Z0-9]+', '_', project_name.lower())
    # Remove consecutive underscores
    normalized = re.sub(r'_+', '_', normalized)
    # Strip leading/trailing underscores
    normalized = normalized.strip('_')
    logger.debug(f"Normalized '{project_name}' to '{normalized}'")
    return normalized


async def get_context_qdrant(query: str, project_name: str = None) -> str:
    """
    Get relevant context from the project's knowledge base using similarity search
    
    Args:
        query: The user's query to search for context
        project_name: Name of the project to search in
        
    Returns:
        Formatted context string from the search results
    """
    try:
        logger.info(f"Getting context for query: {query}")
        
        # Perform similarity search
        search_results = await perform_similarity_search(query, limit=3, project_name=project_name)
        
        if not search_results:
            return "No relevant context found in the knowledge base."
        
        # Format the context from search results
        context_parts = []
        for i, result in enumerate(search_results, 1):
            score = result.get('score', 0)
            payload = result.get('payload', {})
            
            # Only include results with reasonable similarity scores
            if score > 0.1:  # Adjust threshold as needed
                # Extract specific fields from payload
                description = payload.get('description', '')
                tutorial_steps = payload.get('tutorialSteps', [])
                
                # Format the context as simple text
                context_text = ""
                if description:
                    context_text += f"documentation:\n{description}\n"
                
                if tutorial_steps:
                    context_text += "-----------------------\nSteps:\n"
                    for step in tutorial_steps:
                        context_text += f"{step}\n"
                
                if context_text:
                    context_parts.append(f"Context {i} (relevance: {score:.2f}):\n{context_text}")
        
        if not context_parts:
            return "No highly relevant context found in the knowledge base."
        
        formatted_context = "\n\n".join(context_parts)
        logger.info(f"Found {len(context_parts)} relevant context pieces")
        
        return formatted_context
        
    except Exception as e:
        logger.error(f"Error getting context: {e}")
        return f"Error retrieving context: {str(e)}"
