# Video Upload and Processing System

This system provides comprehensive video upload, processing, and management capabilities for training projects.

## Features

### 🎥 Video Upload
- **Multi-format support**: MP4, AVI, MOV, WMV, WebM
- **Drag & drop interface**: Modern, intuitive upload experience
- **File validation**: Automatic file type and size checking
- **Progress tracking**: Real-time processing status updates

### 🔊 Audio Processing
- **FFmpeg integration**: Extracts audio from uploaded videos
- **Optimized for transcription**: Converts to 16kHz mono MP3 for best Whisper results
- **Background processing**: Non-blocking audio extraction

### 📝 AI-Powered Transcription
- **OpenAI Whisper**: High-quality speech-to-text conversion
- **Multiple languages**: Configurable language support (default: English)
- **Automatic processing**: Seamless integration with upload workflow

### 🧠 Tutorial Step Generation
- **GPT-4 powered**: Intelligent step-by-step tutorial creation
- **Context-aware**: Uses both video description and transcription
- **Structured output**: JSON-formatted steps for easy consumption

### 🔍 Vector Search Integration
- **BGE Large embeddings**: State-of-the-art embedding model (1024 dimensions)
- **Qdrant storage**: High-performance vector database
- **Semantic search**: Description-based content discovery
- **Metadata storage**: Tutorial steps and transcriptions stored as searchable content

## System Architecture

```
Video Upload → Audio Extraction → Transcription → Step Generation → Embedding → Vector Storage
     ↓              ↓                ↓               ↓              ↓           ↓
   Database    FFmpeg Processing   OpenAI Whisper  GPT-4 API    BGE Large   Qdrant
```

## Database Schema

### Projects Table
- `id`: Unique identifier
- `name`: Project name (unique)
- `collectionName`: Corresponding Qdrant collection name
- `description`: Optional project description
- `userId`: Owner reference

### Videos Table
- `id`: Unique identifier
- `filename`: Generated unique filename
- `originalName`: User's original filename
- `description`: Video description (used for embeddings)
- `filePath`: Local storage path
- `audioPath`: Extracted audio file path
- `transcription`: Generated transcription text
- `tutorialSteps`: JSON array of tutorial steps
- `processingStatus`: Current processing stage
- `projectId`: Parent project reference

### Processing Status Flow
1. `UPLOADED` → Initial upload complete
2. `EXTRACTING_AUDIO` → FFmpeg processing audio
3. `TRANSCRIBING` → OpenAI Whisper generating transcription
4. `GENERATING_STEPS` → GPT-4 creating tutorial steps
5. `EMBEDDING` → BGE Large generating embeddings
6. `COMPLETED` → All processing finished
7. `FAILED` → Error occurred during processing

## API Endpoints

### Project Videos
- `GET /api/projects/[id]/videos` - List project videos
- `POST /api/projects/[id]/videos` - Upload new video

### Individual Videos
- `GET /api/projects/[id]/videos/[videoId]` - Get video details
- `PUT /api/projects/[id]/videos/[videoId]` - Update video description
- `DELETE /api/projects/[id]/videos/[videoId]` - Delete video and cleanup files

## Frontend Pages

### Video Management
- `/training/projects/[id]/videos` - Video list with status indicators
- `/training/projects/[id]/videos/upload` - Drag & drop upload interface
- `/training/projects/[id]/videos/[videoId]` - Video details and processing results
- `/training/projects/[id]/videos/[videoId]/edit` - Edit video description

## Configuration

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY="sk-your-openai-api-key-here"

# HuggingFace Configuration  
HF_API_TOKEN="hf_your-huggingface-api-token-here"

# Qdrant Configuration
QDRANT_HOST="localhost"
QDRANT_PORT="6333"
```

### Required Services
1. **PostgreSQL**: Primary database
2. **Qdrant**: Vector database (port 6333)
3. **FFmpeg**: Audio extraction (must be installed on system)

## File Storage

### Directory Structure
```
uploads/
├── videos/          # Raw video files
│   ├── .gitkeep
│   └── [uuid].mp4
└── audio/           # Extracted audio files
    ├── .gitkeep
    └── [uuid].mp3
```

### File Naming
- Videos: `[UUID].[extension]` (e.g., `abc123-def456.mp4`)
- Audio: `[UUID].mp3` (matches video UUID)

## Processing Pipeline

### 1. Upload Validation
- File type checking against allowed formats
- File size validation
- Description requirement enforcement

### 2. Background Processing
```javascript
// Async processing pipeline
async function processVideo(videoId, collectionName) {
  // 1. Extract audio with FFmpeg
  const audioPath = await extractAudioFromVideo(videoPath);
  
  // 2. Transcribe with OpenAI Whisper
  const transcription = await transcribeAudio(audioPath);
  
  // 3. Generate steps with GPT-4
  const steps = await generateTutorialSteps(transcription, description);
  
  // 4. Create embeddings with BGE Large
  const embedding = await generateEmbedding(description);
  
  // 5. Store in Qdrant
  await storeVideoInQdrant(collectionName, videoId, data);
}
```

### 3. Error Handling
- Automatic status updates for each processing stage
- Failed status marking with error logging
- Partial cleanup on processing failures
- User-friendly error messages in UI

## Vector Database Integration

### Qdrant Configuration
- **Collection per project**: Isolated vector spaces
- **1024 dimensions**: BGE Large model compatibility
- **Cosine similarity**: Optimal for text embeddings
- **Metadata storage**: Tutorial steps, transcriptions, descriptions

### Search Capabilities
- **Semantic search**: Find videos by description similarity
- **Content filtering**: Search within specific projects
- **Metadata queries**: Filter by processing status, creation date

## Usage Examples

### Creating a Project
1. Navigate to `/training/projects/create`
2. Enter project name (must be unique)
3. Add optional description
4. Submit to create Qdrant collection automatically

### Uploading Videos
1. Go to project detail page
2. Click "Manage Videos" or upload directly
3. Drag & drop video files or browse
4. Add descriptive text for each video
5. Monitor processing status in real-time

### Viewing Results
1. Access video detail page after processing
2. Review generated transcription
3. Examine AI-generated tutorial steps
4. Content automatically indexed for search

## Development Notes

### Key Dependencies
- `@qdrant/js-client-rest`: Vector database client
- `fluent-ffmpeg`: Video/audio processing
- `openai`: GPT-4 and Whisper integration
- `@huggingface/inference`: BGE Large embeddings
- `multer`: File upload handling

### Performance Considerations
- Background processing prevents UI blocking
- Efficient audio conversion (16kHz mono)
- Optimized vector dimensions for BGE Large
- Proper error handling and cleanup

### Security Features
- User authentication for all operations
- Project ownership verification
- File type validation
- Path traversal protection

## Future Enhancements

### Potential Improvements
1. **Batch processing**: Multiple video uploads
2. **Progress websockets**: Real-time status updates
3. **Video streaming**: In-browser video playback
4. **Advanced search**: Full-text search across transcriptions
5. **Export features**: Download transcriptions and steps
6. **Video thumbnails**: Automatic thumbnail generation
7. **Compression**: Automatic video optimization

### Scalability Considerations
- Cloud storage integration (AWS S3, Google Cloud)
- Queue-based processing (Redis, Bull)
- Microservices architecture
- CDN integration for video delivery

---

This comprehensive video upload and AI processing system provides a complete solution for creating searchable, AI-enhanced video training libraries.
