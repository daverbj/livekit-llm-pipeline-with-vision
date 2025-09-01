import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

/**
 * Extract audio from video file using FFmpeg
 */
export async function extractAudioFromVideo(
  videoPath: string,
  outputDir: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const videoName = path.basename(videoPath, path.extname(videoPath));
    const audioPath = path.join(outputDir, `${videoName}.wav`); // Use WAV instead of MP3

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec('pcm_s16le') // Use PCM codec (widely supported)
      .audioChannels(1) // Mono for better transcription
      .audioFrequency(16000) // 16kHz for Whisper
      .format('wav') // Explicitly set format to WAV
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log('Processing progress:', progress.percent, '% done');
      })
      .on('end', () => {
        console.log(`Audio extracted successfully: ${audioPath}`);
        resolve(audioPath);
      })
      .on('error', (err) => {
        console.error('Error extracting audio:', err);
        console.error('FFmpeg stderr:', err.message);
        reject(new Error(`FFmpeg audio extraction failed: ${err.message}`));
      })
      .run();
  });
}

/**
 * Get video duration and basic info
 */
export async function getVideoInfo(videoPath: string): Promise<{
  duration: number;
  format: string;
  size: number;
}> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const duration = metadata.format.duration || 0;
      const format = metadata.format.format_name || 'unknown';
      const size = metadata.format.size || 0;

      resolve({ duration, format, size });
    });
  });
}

/**
 * Check FFmpeg installation and capabilities
 */
export async function checkFFmpegInstallation(): Promise<{
  installed: boolean;
  version?: string;
  codecs: string[];
  error?: string;
}> {
  return new Promise((resolve) => {
    ffmpeg.getAvailableCodecs((err, codecs) => {
      if (err) {
        resolve({
          installed: false,
          codecs: [],
          error: err.message
        });
        return;
      }

      // Get FFmpeg version
      ffmpeg()
        .on('start', () => {})
        .on('stderr', (stderrLine) => {
          const versionMatch = stderrLine.match(/ffmpeg version ([^\s]+)/);
          if (versionMatch) {
            resolve({
              installed: true,
              version: versionMatch[1],
              codecs: Object.keys(codecs)
            });
          }
        })
        .on('error', () => {
          resolve({
            installed: true,
            codecs: Object.keys(codecs)
          });
        })
        .format('null')
        .save('/dev/null')
        .run();
    });
  });
}

/**
 * Extract audio with fallback options
 */
export async function extractAudioWithFallback(
  videoPath: string,
  outputDir: string
): Promise<string> {
  const videoName = path.basename(videoPath, path.extname(videoPath));
  
  // Try different audio extraction methods in order of preference
  const extractionMethods = [
    {
      name: 'WAV PCM',
      audioPath: path.join(outputDir, `${videoName}.wav`),
      config: (ffmpegCmd: any) => ffmpegCmd
        .audioCodec('pcm_s16le')
        .format('wav')
        .audioChannels(1)
        .audioFrequency(16000)
    },
    {
      name: 'WAV default',
      audioPath: path.join(outputDir, `${videoName}.wav`),
      config: (ffmpegCmd: any) => ffmpegCmd
        .format('wav')
        .audioChannels(1)
        .audioFrequency(16000)
    },
    {
      name: 'MP3 libmp3lame',
      audioPath: path.join(outputDir, `${videoName}.mp3`),
      config: (ffmpegCmd: any) => ffmpegCmd
        .audioCodec('libmp3lame')
        .format('mp3')
        .audioChannels(1)
        .audioFrequency(16000)
    },
    {
      name: 'AAC',
      audioPath: path.join(outputDir, `${videoName}.aac`),
      config: (ffmpegCmd: any) => ffmpegCmd
        .audioCodec('aac')
        .format('adts')
        .audioChannels(1)
        .audioFrequency(16000)
    }
  ];

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const method of extractionMethods) {
    try {
      console.log(`Trying audio extraction method: ${method.name}`);
      const result = await tryExtractAudio(videoPath, method);
      console.log(`Successfully extracted audio using ${method.name}: ${result}`);
      return result;
    } catch (error) {
      console.log(`Method ${method.name} failed:`, error);
      continue;
    }
  }

  throw new Error('All audio extraction methods failed. Please check FFmpeg installation and codec support.');
}

/**
 * Try a specific audio extraction method
 */
function tryExtractAudio(
  videoPath: string,
  method: { name: string; audioPath: string; config: (cmd: any) => any }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ffmpegCmd = ffmpeg(videoPath).output(method.audioPath);
    method.config(ffmpegCmd);

    ffmpegCmd
      .on('start', (commandLine) => {
        console.log(`FFmpeg command (${method.name}):`, commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Processing progress (${method.name}):`, Math.round(progress.percent), '% done');
        }
      })
      .on('end', () => {
        resolve(method.audioPath);
      })
      .on('error', (err) => {
        reject(new Error(`${method.name} extraction failed: ${err.message}`));
      })
      .run();
  });
}
