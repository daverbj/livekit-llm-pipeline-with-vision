import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_HOST = process.env.QDRANT_HOST || 'localhost';
const QDRANT_PORT = process.env.QDRANT_PORT || '6333';

// Create Qdrant client instance
export const qdrantClient = new QdrantClient({
  url: `http://${QDRANT_HOST}:${QDRANT_PORT}`,
});

/**
 * Normalize collection name to be URL-safe and Qdrant-compatible
 * - Replace spaces with underscores
 * - Remove special characters except underscores and hyphens
 * - Convert to lowercase
 * - Ensure it starts with a letter or underscore
 */
export function normalizeCollectionName(name: string): string {
  // Replace spaces with underscores
  let normalized = name.replace(/\s+/g, '_');
  
  // Remove special characters except letters, numbers, underscores, and hyphens
  normalized = normalized.replace(/[^a-zA-Z0-9_-]/g, '');
  
  // Convert to lowercase
  normalized = normalized.toLowerCase();
  
  // Ensure it starts with a letter or underscore
  if (normalized && !/^[a-z_]/.test(normalized)) {
    normalized = '_' + normalized;
  }
  
  // Ensure it's not empty
  if (!normalized) {
    normalized = 'default_collection';
  }
  
  return normalized;
}

// Create a collection for a project
export async function createProjectCollection(projectName: string): Promise<void> {
  try {
    const normalizedName = normalizeCollectionName(projectName);
    
    // Check if collection already exists
    const collections = await qdrantClient.getCollections();
    const existingCollection = collections.collections.find(
      (collection) => collection.name === normalizedName
    );

    if (existingCollection) {
      console.log(`Collection "${normalizedName}" already exists, skipping creation`);
      return;
    }

    // Create the collection with vector configuration for BGE large model
    // Using 1024 dimensions for BGE large model (BAAI/bge-large-en-v1.5)
    await qdrantClient.createCollection(normalizedName, {
      vectors: {
        size: 1024,
        distance: 'Cosine',
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    console.log(`Created Qdrant collection: ${normalizedName} (from "${projectName}")`);
  } catch (error) {
    console.error(`Failed to create Qdrant collection "${projectName}":`, error);
    throw error;
  }
}

// Delete a collection for a project
export async function deleteProjectCollection(projectName: string): Promise<void> {
  try {
    const normalizedName = normalizeCollectionName(projectName);
    await qdrantClient.deleteCollection(normalizedName);
    console.log(`Deleted Qdrant collection: ${normalizedName} (from "${projectName}")`);
  } catch (error) {
    console.error(`Failed to delete Qdrant collection "${projectName}":`, error);
    throw error;
  }
}

// Check if a collection exists
export async function collectionExists(projectName: string): Promise<boolean> {
  try {
    const normalizedName = normalizeCollectionName(projectName);
    const collections = await qdrantClient.getCollections();
    return collections.collections.some(
      (collection) => collection.name === normalizedName
    );
  } catch (error) {
    console.error(`Failed to check if collection "${projectName}" exists:`, error);
    return false;
  }
}
