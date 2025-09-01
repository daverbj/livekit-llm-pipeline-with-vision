import io
import logging
import os
import wave
import numpy as np
from dotenv import load_dotenv
import base64
import asyncio
import uuid
from openai import OpenAI
from livekit.plugins import google
from livekit.plugins import groq
from livekit.agents import (
    Agent,
    AgentSession,
    RoomInputOptions,
    llm,
    ModelSettings,
    cli,
    WorkerOptions,
    JobContext,
    stt,
    utils,
    get_job_context,
    FunctionTool
)
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import (
    openai,
    cartesia,
    deepgram,
    noise_cancellation,
    silero,
)
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from typing import AsyncIterable
from faster_whisper import WhisperModel
from livekit.plugins import aws

from livekit import rtc
from livekit.agents import ModelSettings, stt, Agent
from livekit.agents.utils import AudioBuffer
from typing import AsyncIterable, Optional
from livekit.agents.utils.images import encode, EncodeOptions, ResizeOptions
from livekit.agents.llm import ImageContent, function_tool, ChatContext, ChatMessage

load_dotenv()
logger = logging.getLogger("voice-agent")
logger.setLevel(logging.DEBUG)

# Also set up console handler for better visibility
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)


from langchain.chat_models import init_chat_model
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from utils.bedrock_processor import process_bedrock_chat
from utils.openai_processor import process_openai_chat
from utils.langgraph_processor import process_langgraph_chat
from utils.lg_react_agent_processor import process_langgraph_react_chat
from utils.gemma_processor_ollama import process_gemma_ollama_chat
class Assistant(Agent):
    def __init__(self) -> None:
        self._latest_frame = None
        self._video_stream = None
        self._tasks = []
        self._current_audio_buffer = []  # Store current audio session
        self._current_audio_session_id = None
        super().__init__(instructions="""
                        You are a helpful voice AI assistant.
                        You have to guide user to resolve their issues.
                        Your response should be **one step at a time**.
                        User always provides you the latest screenshot of his screen.
                        You must analyse the screen and answer user based on the current screen situation.
                        Response user as if you are a human in a call so do not format your answer, it should be raw text only.

                """)

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[FunctionTool],
        model_settings: ModelSettings
    ) -> AsyncIterable[llm.ChatChunk]:
        # Use the Gemma Ollama processor for direct Ollama integration
        # This handles Gemma's system message limitations properly
        
        async for chunk_content in process_gemma_ollama_chat(
            chat_ctx, 
            model="gemma3:4b",
            ollama_url="http://localhost:11434/api/chat"
        ):
            yield chunk_content
        
        # LangGraph ReAct processor (commented out)
        # async for chunk_content in process_langgraph_react_chat(
        #     chat_ctx, 
        #     model=ChatOllama(
        #         model="gemma3:4b",
        #         temperature=0.7
        #     ),
        # ):
        #     yield chunk_content
        
        # Original LangGraph processor (commented out - doesn't work with Gemma3)
        # async for chunk_content in process_langgraph_chat(
        #     chat_ctx, 
        #     model=ChatOllama(
        #         model="gemma3:4b",
        #         streaming=True
        #     )
        # ):
        #     yield chunk_content
        
        # Original OpenAI processor (commented out)
        # async for chunk_content in process_openai_chat(chat_ctx, base_url="http://209.170.80.132:18084/v1", model="google/gemma-3-12b-it", session=self.session):
        #     yield chunk_content

    async def on_enter(self):
        self.session.generate_reply(user_input="Greet the user short and crisp.", allow_interruptions=False)
        room = get_job_context().room
        
        # Handle existing participants
        if room.remote_participants:
            for participant in room.remote_participants.values():
                await self._handle_participant_tracks(participant)
        
        # Watch for new tracks
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            logger.info(f"Track subscribed: {track.kind} from participant {participant.identity}")
            asyncio.create_task(self._handle_new_track(track, participant))
        
        # Also watch for when participants join
        @room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant connected: {participant.identity}")
            
        # Handle participant disconnection to clean up streams
        @room.on("participant_disconnected")
        def on_participant_disconnected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant disconnected: {participant.identity}")
            asyncio.create_task(self._cleanup_participant_streams(participant.identity))
    
    async def on_exit(self):
        """Called when the agent session ends"""
        logger.info("Agent session ending, saving any pending audio")
        await self._save_current_audio_session()
        
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        # Add the latest video frame, if any, to the new message
        if self._latest_frame:
            new_message.content.append(ImageContent(image=self._latest_frame))
            self._latest_frame = None
    
    async def stt_node(self, audio: AsyncIterable[rtc.AudioFrame], model_settings: ModelSettings) -> Optional[AsyncIterable[stt.SpeechEvent]]:
        # Create a unique filename for this audio session
        session_id = str(uuid.uuid4())[:8]
        logger.info(f"Starting new audio session: {session_id}")
        
        # Initialize current session
        self._current_audio_session_id = session_id
        self._current_audio_buffer = []
        
        # Create a wrapper that tees the audio stream - one for STT, one for saving
        async def tee_audio_stream():
            frame_count = 0
            async for frame in audio:
                # Save frame for WAV file
                self._current_audio_buffer.append(frame)
                frame_count += 1
                if frame_count % 100 == 0:  # Log every 100 frames
                    logger.debug(f"Collected {frame_count} audio frames")
                # Yield frame for STT processing
                yield frame
            
            logger.info(f"Audio stream completed naturally. Total frames collected: {frame_count}")
            # Save immediately when stream completes naturally
            await self._save_current_audio_session()
        
        # Process STT with the teed audio stream
        async for event in Agent.default.stt_node(self, tee_audio_stream(), model_settings):
            yield event
    
    async def _handle_participant_tracks(self, participant: rtc.RemoteParticipant):
        """Handle existing tracks for a participant"""
        video_tracks = []
        audio_tracks = []
        
        for publication in participant.track_publications.values():
            if publication.track:
                if publication.track.kind == rtc.TrackKind.KIND_VIDEO:
                    video_tracks.append(publication.track)
                elif publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                    audio_tracks.append(publication.track)
        
        # Handle video tracks
        if video_tracks:
            logger.info(f"Found existing video track from participant {participant.identity}")
            self._create_video_stream(video_tracks[0])
        
        # Handle audio tracks
        for audio_track in audio_tracks:
            logger.info(f"Found existing audio track from participant {participant.identity}")
            # Audio will be processed by session-level noise cancellation
    
    async def _handle_new_track(self, track: rtc.Track, participant: rtc.RemoteParticipant):
        """Handle newly subscribed tracks"""
        if track.kind == rtc.TrackKind.KIND_VIDEO:
            logger.info("Setting up video stream for new video track")
            self._create_video_stream(track)
        elif track.kind == rtc.TrackKind.KIND_AUDIO:
            logger.info(f"Audio track detected for participant {participant.identity}")
            # Audio will be processed by session-level noise cancellation
    
    async def _cleanup_participant_streams(self, participant_identity: str):
        """Clean up streams when a participant disconnects"""
        logger.info(f"Cleaned up streams for disconnected participant {participant_identity}")
        # Save any pending audio when participant disconnects
        # await self._save_current_audio_session()
    
    async def _save_current_audio_session(self):
        """Save the current audio session to WAV file"""
        if not self._current_audio_buffer or not self._current_audio_session_id:
            logger.info("No current audio session to save")
            return
            
        audio_filename = f"tmp/audio_debug/stt_audio_{self._current_audio_session_id}.wav"
        logger.info(f"Saving current audio session with {len(self._current_audio_buffer)} frames to {audio_filename}")
        
        try:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(audio_filename), exist_ok=True)
            
            # Combine all audio frames
            combined_audio = []
            sample_rate = None
            
            for frame in self._current_audio_buffer:
                if sample_rate is None:
                    sample_rate = frame.sample_rate
                
                # Convert frame data to numpy array
                audio_data = np.frombuffer(frame.data, dtype=np.int16)
                combined_audio.extend(audio_data)
            
            if combined_audio and sample_rate:
                # Write to WAV file
                with wave.open(audio_filename, 'wb') as wav_file:
                    wav_file.setnchannels(1)  # Mono
                    wav_file.setsampwidth(2)  # 16-bit
                    wav_file.setframerate(sample_rate)
                    wav_file.writeframes(np.array(combined_audio, dtype=np.int16).tobytes())
                
                logger.info(f"Successfully saved audio to {audio_filename} ({len(combined_audio)} samples, {sample_rate}Hz)")
            else:
                logger.warning("No valid audio data to save")
                
        except Exception as e:
            logger.error(f"Failed to save current audio session: {e}")
        finally:
            # Clear the current session
            self._current_audio_buffer = []
            self._current_audio_session_id = None
    
    # Helper method to buffer the latest video frame from the user's track
    def _create_video_stream(self, track: rtc.Track):
        logger.info(f"Creating video stream for track: {track.sid}")
        
        # Close any existing stream (we only want one at a time)
        if self._video_stream is not None:
            logger.info("Closing existing video stream")
            self._video_stream.close()

        # Create a new stream to receive frames    
        self._video_stream = rtc.VideoStream(track)
        
        async def read_stream():
            logger.info("Starting video stream reader")
            try:
                async for event in self._video_stream:
                    if event.frame:
                        try:
                            # Encode the frame to base64 data URL for VLLM compatibility
                            compressed_image_bytes = encode(
                                event.frame,
                                EncodeOptions(
                                    format="JPEG",
                                    resize_options=ResizeOptions(
                                        width=1024,
                                        height=1024,
                                        strategy="scale_aspect_fit"
                                    )
                                )
                            )
                            
                            # Convert to base64 data URL
                            compressed_base64 = base64.b64encode(compressed_image_bytes).decode('utf-8')
                            data_url = f"data:image/jpeg;base64,{compressed_base64}"
                            
                            # Store the latest frame as data URL for use later
                            self._latest_frame = data_url
                            
                        except Exception as encode_error:
                            logger.error(f"Failed to encode video frame: {encode_error}")
                            # Store raw frame as fallback
                            self._latest_frame = event.frame
                    else:
                        logger.debug("Received video event but no frame")
            except Exception as e:
                logger.error(f"Error in video stream reader: {e}")
        
        # Store the async task
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
        self._tasks.append(task)
        logger.info(f"Video stream task created. Total tasks: {len(self._tasks)}")


async def entrypoint(ctx: JobContext):
    session = AgentSession(
        stt=groq.STT(),
        # llm=openai.LLM(
            
        #     model="gpt-4o",
        #     timeout=5000
        # ),
        # llm=openai.realtime.RealtimeModel(
        #     model="gpt-realtime-2025-08-28"
            
        # ),
        # llm=google.beta.realtime.RealtimeModel(
        #     model="gemini-2.5-flash-preview-native-audio-dialog",
        #     voice="Puck",
        #     temperature=0.8,
        #     instructions="You are a helpful assistant",
        # ),
        # llm=openai.LLM(timeout=5000).with_ollama(
        #     model="gemma3:4b"
        # ),
        llm=aws.LLM(
            # doesnt matter now
        ),
        tts=deepgram.TTS(),
        vad=silero.VAD.load(
            activation_threshold=0.7
        ),
        turn_detection=MultilingualModel(),
        preemptive_generation=False
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            # Apply noise cancellation to all audio going to STT
            noise_cancellation=noise_cancellation.BVC(),
            video_enabled=True,
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
