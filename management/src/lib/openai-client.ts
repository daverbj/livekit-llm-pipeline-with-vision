import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Check for API key and provide helpful error message
if (!process.env.OPENAI_API_KEY) {
  console.warn('OPENAI_API_KEY environment variable is missing. OpenAI features will not work.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-api-key',
});

// OpenAI Whisper has a 25MB file size limit
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
const CHUNK_DURATION = 600; // 10 minutes per chunk (adjustable based on file size)

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Calculate optimal chunk duration based on file size
 */
function calculateChunkDuration(fileSize: number): number {
  // Calculate number of chunks needed to keep each chunk under 25MB with safety margin
  const safetyMargin = 0.8; // Use 80% of max size to be safe
  const safeMaxSize = MAX_FILE_SIZE * safetyMargin;
  const numChunks = Math.ceil(fileSize / safeMaxSize);
  
  // Estimate duration in seconds based on file size (rough estimate for WAV files)
  // WAV file: ~16KB per second at 16kHz mono, 16-bit
  const estimatedDuration = fileSize / (16 * 1024); // seconds
  
  // Calculate chunk duration with extra safety margin
  const chunkDuration = Math.max(180, Math.floor(estimatedDuration / (numChunks * 1.2))); // At least 3 minutes per chunk, 20% extra safety
  
  console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB, Estimated duration: ${estimatedDuration.toFixed(0)}s, Chunks needed: ${numChunks}, Chunk duration: ${chunkDuration}s (with safety margin)`);
  
  return chunkDuration;
}

/**
 * Split audio file into chunks using FFmpeg
 */
async function splitAudioIntoChunks(audioPath: string, chunkDuration: number = CHUNK_DURATION): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(audioPath);
    const baseName = path.basename(audioPath, path.extname(audioPath));
    const ext = path.extname(audioPath);
    const chunkPattern = path.join(dir, `${baseName}_chunk_%03d${ext}`);
    
    console.log(`Splitting audio file into ${chunkDuration}-second chunks...`);
    
    ffmpeg(audioPath)
      .outputOptions([
        '-f', 'segment',
        '-segment_time', chunkDuration.toString(),
        '-segment_format', ext.substring(1), // Remove the dot from extension
        '-reset_timestamps', '1'
      ])
      .output(chunkPattern)
      .on('start', (commandLine) => {
        console.log('FFmpeg chunking command:', commandLine);
      })
      .on('end', async () => {
        try {
          // Find all created chunk files
          const chunkFiles: string[] = [];
          let chunkIndex = 0;
          
          while (true) {
            const chunkFile = path.join(dir, `${baseName}_chunk_${chunkIndex.toString().padStart(3, '0')}${ext}`);
            if (fs.existsSync(chunkFile)) {
              chunkFiles.push(chunkFile);
              chunkIndex++;
            } else {
              break;
            }
          }
          
          console.log(`Created ${chunkFiles.length} audio chunks`);
          
          // Check if any chunks are still too large and need further splitting
          const validChunks: string[] = [];
          
          for (let i = 0; i < chunkFiles.length; i++) {
            const chunkFile = chunkFiles[i];
            const chunkSize = getFileSize(chunkFile);
            
            console.log(`Checking chunk ${i + 1}: ${(chunkSize / 1024 / 1024).toFixed(2)}MB`);
            
            if (chunkSize > MAX_FILE_SIZE) {
              console.log(`Chunk ${i + 1} is still too large (${(chunkSize / 1024 / 1024).toFixed(2)}MB), splitting further...`);
              
              // Calculate smaller chunk duration for this oversized chunk
              const smallerDuration = Math.max(60, Math.floor(chunkDuration * (MAX_FILE_SIZE * 0.8) / chunkSize));
              
              try {
                const subChunks = await splitAudioIntoChunks(chunkFile, smallerDuration);
                validChunks.push(...subChunks);
                
                // Clean up the oversized chunk
                fs.unlinkSync(chunkFile);
              } catch (subChunkError) {
                console.error(`Failed to split oversized chunk ${i + 1}:`, subChunkError);
                // Keep the oversized chunk and let the transcription handle the error
                validChunks.push(chunkFile);
              }
            } else {
              validChunks.push(chunkFile);
            }
          }
          
          console.log(`Final result: ${validChunks.length} valid chunks`);
          resolve(validChunks);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (err) => {
        console.error('Error splitting audio:', err);
        reject(new Error(`FFmpeg audio splitting failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Transcribe a single audio file (must be under 25MB)
 */
async function transcribeSingleFile(audioPath: string): Promise<string> {
  const fileSize = getFileSize(audioPath);
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`Audio file too large: ${fileSize} bytes (max: ${MAX_FILE_SIZE} bytes)`);
  }

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: 'whisper-1',
    language: 'en', // Can be made configurable
    response_format: 'text',
  });

  return transcription;
}

/**
 * Clean up chunk files
 */
function cleanupChunkFiles(chunkPaths: string[]): void {
  chunkPaths.forEach(chunkPath => {
    try {
      if (fs.existsSync(chunkPath)) {
        fs.unlinkSync(chunkPath);
        console.log(`Cleaned up chunk file: ${chunkPath}`);
      }
    } catch (error) {
      console.warn(`Failed to clean up chunk file ${chunkPath}:`, error);
    }
  });
}

/**
 * Transcribe audio file using OpenAI Whisper with automatic chunking for large files
 */
export async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is missing. Please add your OpenAI API key to the .env file.');
    }

    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const fileSize = getFileSize(audioPath);
    console.log(`Audio file size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // If file is small enough, transcribe directly
    if (fileSize <= MAX_FILE_SIZE) {
      console.log('File size is within limits, transcribing directly...');
      return await transcribeSingleFile(audioPath);
    }

    // File is too large, need to split into chunks
    console.log('File size exceeds limit, splitting into chunks...');
    
    // Calculate optimal chunk duration
    let chunkDuration = calculateChunkDuration(fileSize);
    
    // For very large files, be more aggressive with smaller chunks
    if (fileSize > MAX_FILE_SIZE * 3) {
      chunkDuration = Math.max(120, chunkDuration / 2); // Halve the duration for very large files
      console.log(`Very large file detected, using aggressive chunking: ${chunkDuration}s per chunk`);
    }
    
    let chunkPaths: string[] = [];
    try {
      // Split audio into chunks
      chunkPaths = await splitAudioIntoChunks(audioPath, chunkDuration);
      
      if (chunkPaths.length === 0) {
        throw new Error('No chunks were created during audio splitting');
      }

      // Transcribe each chunk
      const transcriptions: string[] = [];
      const errors: string[] = [];
      
      for (let i = 0; i < chunkPaths.length; i++) {
        const chunkPath = chunkPaths[i];
        const chunkSize = getFileSize(chunkPath);
        console.log(`Transcribing chunk ${i + 1}/${chunkPaths.length}: ${path.basename(chunkPath)} (${(chunkSize / 1024 / 1024).toFixed(2)}MB)`);
        
        try {
          const chunkTranscription = await transcribeSingleFile(chunkPath);
          transcriptions.push(chunkTranscription);
          console.log(`✅ Chunk ${i + 1} transcribed successfully (${chunkTranscription.length} characters)`);
        } catch (chunkError) {
          const errorMsg = `Error transcribing chunk ${i + 1}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
          // Add placeholder to maintain order
          transcriptions.push(`[CHUNK_${i + 1}_FAILED]`);
        }
      }

      // Filter out failed chunks and combine transcriptions
      const validTranscriptions = transcriptions.filter(t => !t.startsWith('[CHUNK_') && !t.startsWith('[Error'));
      
      if (validTranscriptions.length === 0) {
        throw new Error(`All ${chunkPaths.length} chunks failed to transcribe. Errors: ${errors.join('; ')}`);
      }

      const fullTranscription = validTranscriptions.join(' ').trim();

      if (errors.length > 0) {
        console.warn(`⚠️ ${errors.length} chunks failed, but ${validTranscriptions.length} succeeded`);
      }

      console.log(`✅ Successfully transcribed ${validTranscriptions.length}/${chunkPaths.length} chunks. Total length: ${fullTranscription.length} characters`);
      return fullTranscription;

    } finally {
      // Clean up chunk files
      if (chunkPaths.length > 0) {
        cleanupChunkFiles(chunkPaths);
      }
    }

  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Generate tutorial steps from transcription using OpenAI GPT
 */
export async function generateTutorialSteps(
  transcription: string,
  videoDescription: string
): Promise<string[]> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is missing. Please add your OpenAI API key to the .env file.');
    }

    const prompt = `Based on the following video transcription and description, generate a clear, step-by-step tutorial guide. 

Video Description: ${videoDescription}

Transcription: ${transcription}

Please provide a structured list of tutorial steps that someone could follow. Each step should be clear and actionable. Format the response as a JSON array of strings, where each string is one step.

Example format:
["Step 1: Open the application", "Step 2: Navigate to settings", "Step 3: Configure the options"]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert tutorial creator. Generate clear, step-by-step instructions based on video content. Always respond with valid JSON array format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response - handle markdown code blocks
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const steps = JSON.parse(cleanedResponse);
      if (!Array.isArray(steps)) {
        throw new Error('Response is not an array');
      }
      return steps;
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.log('Raw response:', response);
      // Fallback: split by lines and extract step-like content
      const lines = response.split('\n').filter(line => line.trim().length > 0);
      const steps = lines
        .filter(line => line.match(/step\s*\d+/i) || line.includes(':'))
        .map(line => line.replace(/^[\s\-\*\d\.\[\]`"]+/, '').trim())
        .filter(step => step.length > 10); // Filter out very short steps
      
      if (steps.length > 0) {
        return steps;
      }
      
      // Final fallback: return the raw response split by sentences
      return response.split(/[.!?]+/).filter(sentence => sentence.trim().length > 20);
    }
  } catch (error) {
    console.error('Error generating tutorial steps:', error);
    throw error;
  }
}
