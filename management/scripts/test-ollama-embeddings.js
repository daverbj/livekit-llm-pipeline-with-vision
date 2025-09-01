const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large';

async function testOllamaEmbeddings() {
  try {
    console.log('Testing Ollama embeddings...');
    console.log(`Ollama URL: ${OLLAMA_BASE_URL}`);
    console.log(`Embedding Model: ${OLLAMA_EMBEDDING_MODEL}`);

    // Test if Ollama is running
    console.log('\n1. Testing Ollama connection...');
    const healthResponse = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!healthResponse.ok) {
      throw new Error(`Ollama health check failed: ${healthResponse.status} ${healthResponse.statusText}`);
    }
    
    const models = await healthResponse.json();
    console.log('✓ Ollama is running');
    console.log('Available models:', models.models?.map(m => m.name) || []);

    // Check if the embedding model is available
    const hasEmbeddingModel = models.models?.some(m => m.name.includes(OLLAMA_EMBEDDING_MODEL));
    if (!hasEmbeddingModel) {
      console.log(`⚠️  Warning: ${OLLAMA_EMBEDDING_MODEL} not found in available models`);
      console.log(`You may need to pull it with: ollama pull ${OLLAMA_EMBEDDING_MODEL}`);
    } else {
      console.log(`✓ ${OLLAMA_EMBEDDING_MODEL} is available`);
    }

    // Test embedding generation
    console.log('\n2. Testing embedding generation...');
    const testText = "This is a test video about machine learning and artificial intelligence.";
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OLLAMA_EMBEDDING_MODEL,
        prompt: testText,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama embedding API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Unexpected response format from Ollama embedding model');
    }

    console.log('✓ Embedding generation successful');
    console.log(`  - Text: "${testText}"`);
    console.log(`  - Embedding dimensions: ${data.embedding.length}`);
    console.log(`  - First 5 values: [${data.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);
    console.log(`  - Model used: ${OLLAMA_EMBEDDING_MODEL}`);

    console.log('\n✅ All tests passed! Ollama embeddings are working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure Ollama is running: ollama serve');
    console.log(`2. Pull the embedding model: ollama pull ${OLLAMA_EMBEDDING_MODEL}`);
    console.log('3. Check if Ollama is accessible at:', OLLAMA_BASE_URL);
    console.log('4. Verify the model name is correct:', OLLAMA_EMBEDDING_MODEL);
    
    process.exit(1);
  }
}

testOllamaEmbeddings();
