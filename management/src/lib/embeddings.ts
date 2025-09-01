import { hashStringToInt } from './hash-utils';

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large';

/**
 * Generate embeddings using Ollama embedding model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    console.log('Generating embedding for text using Ollama:', text.substring(0, 100) + '...');

    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Unexpected response format from Ollama embedding model');
    }

    const embedding = data.embedding;
    console.log('Ollama embedding generated:', { 
      length: embedding.length, 
      model: OLLAMA_EMBEDDING_MODEL,
      firstFew: embedding.slice(0, 5) 
    });

    return embedding;
  } catch (error) {
    console.error('Error generating embedding with Ollama:', error);
    
    // For development: return a dummy embedding vector
    // Note: mxbai-embed-large produces 1024-dimensional embeddings
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using dummy embedding vector for development (1024 dimensions)');
      return new Array(1024).fill(0).map(() => Math.random() - 0.5);
    }
    
    throw error;
  }
}

/**
 * Store video content in Qdrant with embeddings
 */
export async function storeVideoInQdrant(
  collectionName: string,
  videoId: string,
  description: string,
  tutorialSteps: string[],
  transcription: string
): Promise<void> {
  try {
    // Import Qdrant client and normalize collection name
    const { qdrantClient, normalizeCollectionName, createProjectCollection } = await import('./qdrant');
    const normalizedCollectionName = normalizeCollectionName(collectionName);

    // Generate embedding for the video description only
    const embedding = await generateEmbedding(description);
    console.log('Generated embedding:', { 
      length: embedding.length, 
      isArray: Array.isArray(embedding),
      firstFew: embedding.slice(0, 5) 
    });

    // Validate embedding
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error(`Invalid embedding: expected non-empty array, got ${typeof embedding} with length ${embedding.length}`);
    }

    // Validate all values are numbers
    const hasNonNumbers = embedding.some(val => typeof val !== 'number' || isNaN(val));
    if (hasNonNumbers) {
      throw new Error('Embedding contains non-numeric values');
    }

    // Ensure collection exists
    try {
      await qdrantClient.getCollection(normalizedCollectionName);
    } catch (error) {
      console.log(`Collection ${normalizedCollectionName} doesn't exist, creating it...`);
      // Create collection with dynamic vector size based on the actual embedding
      await createProjectCollection(collectionName, embedding.length);
    }

    // Store the video content with metadata
    // Convert videoId string to a valid Qdrant ID (unsigned integer)
    const pointId = hashStringToInt(videoId);
    
    console.log('Upserting to Qdrant:', {
      collection: normalizedCollectionName,
      pointsCount: 1,
      vectorLength: embedding.length,
      originalVideoId: videoId,
      hashedPointId: pointId
    });

    // Use the correct format for Qdrant JS client upsert
    await qdrantClient.upsert(normalizedCollectionName, {
      wait: true,
      points: [
        {
          id: pointId,
          vector: embedding,
          payload: {
            type: 'video',
            videoId: videoId,
            description: description,
            tutorialSteps: tutorialSteps,
            transcription: transcription,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    });

    console.log(`Stored video ${videoId} in Qdrant collection ${normalizedCollectionName} (from "${collectionName}")`);
  } catch (error) {
    console.error('Error storing video in Qdrant:', error);
    
    // Log detailed error information
    if (error && typeof error === 'object') {
      if ('data' in error) {
        console.error('Qdrant error data:', JSON.stringify(error.data, null, 2));
      }
      if ('response' in error) {
        console.error('Qdrant response:', error.response);
      }
    }
    
    throw error;
  }
}
