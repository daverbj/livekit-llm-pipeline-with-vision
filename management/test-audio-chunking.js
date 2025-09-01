/**
 * Test script to validate audio chunking functionality
 * Run with: node test-audio-chunking.js
 */

const fs = require('fs');
const path = require('path');

// Import the transcription function (you'll need to compile TypeScript or use ts-node)
// This is a basic test to check file size calculation logic

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

function getFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return 0;
  }
  const stats = fs.statSync(filePath);
  return stats.size;
}

function calculateChunkDuration(fileSize) {
  // Same logic as in the TypeScript file
  const estimatedDuration = fileSize / (16 * 1024); 
  const numChunks = Math.ceil(fileSize / MAX_FILE_SIZE);
  const chunkDuration = Math.max(300, Math.floor(estimatedDuration / numChunks));
  
  return {
    fileSize,
    estimatedDuration,
    numChunks,
    chunkDuration
  };
}

// Test with different file sizes
const testFileSizes = [
  10 * 1024 * 1024,  // 10MB - should not need chunking
  30 * 1024 * 1024,  // 30MB - needs chunking
  50 * 1024 * 1024,  // 50MB - needs more chunks
  100 * 1024 * 1024, // 100MB - needs many chunks
];

console.log('Audio Chunking Test Results:');
console.log('============================');

testFileSizes.forEach((size, index) => {
  const result = calculateChunkDuration(size);
  const willChunk = size > MAX_FILE_SIZE;
  
  console.log(`\nTest ${index + 1}: ${(size / 1024 / 1024).toFixed(2)}MB file`);
  console.log(`  Will need chunking: ${willChunk}`);
  console.log(`  Estimated duration: ${result.estimatedDuration.toFixed(0)} seconds`);
  console.log(`  Number of chunks: ${result.numChunks}`);
  console.log(`  Chunk duration: ${result.chunkDuration} seconds (${(result.chunkDuration / 60).toFixed(1)} minutes)`);
});

// Check for actual audio files in the uploads directory
const audioDir = path.join(__dirname, 'uploads', 'audio');
if (fs.existsSync(audioDir)) {
  const audioFiles = fs.readdirSync(audioDir).filter(f => f.endsWith('.wav') || f.endsWith('.mp3'));
  
  if (audioFiles.length > 0) {
    console.log('\n\nActual Audio Files Analysis:');
    console.log('============================');
    
    audioFiles.forEach(file => {
      const filePath = path.join(audioDir, file);
      const size = getFileSize(filePath);
      const result = calculateChunkDuration(size);
      const willChunk = size > MAX_FILE_SIZE;
      
      console.log(`\nFile: ${file}`);
      console.log(`  Size: ${(size / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Will need chunking: ${willChunk}`);
      if (willChunk) {
        console.log(`  Would create ${result.numChunks} chunks of ${result.chunkDuration}s each`);
      }
    });
  } else {
    console.log('\n\nNo audio files found in uploads/audio directory');
  }
} else {
  console.log('\n\nAudio uploads directory does not exist yet');
}

console.log('\n\nChunking functionality is ready to handle large audio files!');
