import { HfInference } from '@huggingface/inference';
import { hashStringToInt } from './hash-utils';

// Initialize with error handling
let hf: HfInference | null = null;
try {
  if (process.env.HF_API_TOKEN) {
    hf = new HfInference(process.env.HF_API_TOKEN);
  }
} catch (error) {
  console.warn('Failed to initialize HuggingFace client:', error);
}

/**
 * Generate embeddings using BGE Large model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!process.env.HF_API_TOKEN) {
      throw new Error('HF_API_TOKEN environment variable is missing. Please add your HuggingFace API token to the .env file.');
    }

    if (!hf) {
      throw new Error('HuggingFace client not initialized. Please check HF_API_TOKEN environment variable.');
    }

    console.log('Generating embedding for text:', text.substring(0, 100) + '...');

    const response = await hf.featureExtraction({
      model: 'BAAI/bge-large-en-v1.5',
      inputs: text,
    });

    console.log('HuggingFace response type:', typeof response, 'isArray:', Array.isArray(response));

    // The response should be a number array for single input
    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0] as number[];
    } else if (Array.isArray(response)) {
      return response as number[];
    }

    throw new Error('Unexpected response format from embedding model');
  } catch (error) {
    console.error('Error generating embedding:', error);
    
    // For development: return a dummy embedding vector of correct size (1024 dimensions)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Using dummy embedding vector for development');
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

    // Ensure collection exists
    try {
      await qdrantClient.getCollection(normalizedCollectionName);
    } catch (error) {
      console.log(`Collection ${normalizedCollectionName} doesn't exist, creating it...`);
      await createProjectCollection(collectionName);
    }

    // Generate embedding for the video description only
    const embedding = await generateEmbedding(description);
    console.log('Generated embedding:', { 
      length: embedding.length, 
      isArray: Array.isArray(embedding),
      firstFew: embedding.slice(0, 5) 
    });

    // Validate embedding
    if (!Array.isArray(embedding) || embedding.length !== 1024) {
      throw new Error(`Invalid embedding: expected array of 1024 numbers, got ${typeof embedding} with length ${embedding.length}`);
    }

    // Validate all values are numbers
    const hasNonNumbers = embedding.some(val => typeof val !== 'number' || isNaN(val));
    if (hasNonNumbers) {
      throw new Error('Embedding contains non-numeric values');
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
