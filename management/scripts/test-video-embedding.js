// Test Ollama embeddings integration
const path = require('path');

// Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large';

/**
 * Generate embeddings using Ollama embedding model
 */
async function generateEmbedding(text) {
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
    throw error;
  }
}

async function testVideoEmbedding() {
  try {
    console.log('Testing video embedding with Ollama...');

    // Test data
    const testData = {
      description: 'This is a test video about machine learning and deep neural networks. It covers the basics of training models and optimization techniques.',
    };

    console.log('Test data:', {
      descriptionLength: testData.description.length,
    });

    // Test embedding generation
    console.log('\n1. Testing embedding generation...');
    const embedding = await generateEmbedding(testData.description);
    console.log('✓ Embedding generated successfully');
    console.log(`  - Dimensions: ${embedding.length}`);
    console.log(`  - First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    console.log('\n✅ Embedding generation test passed! Ollama embeddings integration is working.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testVideoEmbedding();
