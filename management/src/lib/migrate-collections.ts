// Migration utility to fix collection names with spaces
// Run this once to update existing projects with normalized collection names

import { prisma } from '@/lib/prisma';
import { normalizeCollectionName, createProjectCollection, deleteProjectCollection, qdrantClient } from '@/lib/qdrant';

export async function migrateCollectionNames() {
  try {
    console.log('Starting collection name migration...');
    
    // Get all projects
    const projects = await prisma.project.findMany();
    
    for (const project of projects) {
      const normalizedName = normalizeCollectionName(project.collectionName);
      
      if (project.collectionName !== normalizedName) {
        console.log(`Migrating project "${project.name}": "${project.collectionName}" -> "${normalizedName}"`);
        
        try {
          // Check if old collection exists
          const collections = await qdrantClient.getCollections();
          const oldCollectionExists = collections.collections.some(
            (collection) => collection.name === project.collectionName
          );
          
          if (oldCollectionExists) {
            // Create new collection
            await createProjectCollection(project.name);
            
            // Get all points from old collection
            const scrollResult = await qdrantClient.scroll(project.collectionName, {
              limit: 1000, // Adjust if you have more videos
              with_payload: true,
              with_vector: true
            });
            
            if (scrollResult.points && scrollResult.points.length > 0) {
              // Copy points to new collection
              await qdrantClient.upsert(normalizedName, {
                wait: true,
                points: scrollResult.points.map(point => ({
                  id: point.id,
                  vector: point.vector as number[],
                  payload: point.payload || {}
                }))
              });
              
              console.log(`Copied ${scrollResult.points.length} points from old collection`);
            }
            
            // Delete old collection
            await qdrantClient.deleteCollection(project.collectionName);
            console.log(`Deleted old collection: ${project.collectionName}`);
          } else {
            // Old collection doesn't exist, just create new one
            await createProjectCollection(project.name);
          }
          
          // Update project in database
          await prisma.project.update({
            where: { id: project.id },
            data: { collectionName: normalizedName }
          });
          
          console.log(`Updated project ${project.id} collection name to: ${normalizedName}`);
        } catch (error) {
          console.error(`Failed to migrate project ${project.id}:`, error);
        }
      }
    }
    
    console.log('Collection name migration completed!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Export for use in API endpoint if needed
if (require.main === module) {
  migrateCollectionNames()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}
