import io
import logging
import wave
import numpy as np
from dotenv import load_dotenv
import base64
import asyncio
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


class FasterWhisperSTT(stt.STT):
    def __init__(
        self,
        model_size: str = "large-v3",
        device: str = "mps",
        language: str | None = None,
    ):
        super().__init__(
            capabilities=stt.STTCapabilities(streaming=False, interim_results=False)
        )
        self.model = WhisperModel(model_size, device=device)
        self.language = language

    async def _recognize_impl(
        self, 
        buffer: AudioBuffer, 
        *, 
        language: str | None = None,
        conn_options: dict | None = None
    ) -> stt.SpeechEvent:
        
        # Merge audio frames into a single buffer
        buffer = utils.merge_frames(buffer)
        
        # Create a WAV file in memory (following your reference pattern)
        io_buffer = io.BytesIO()
        
        with wave.open(io_buffer, "wb") as wav:
            wav.setnchannels(buffer.num_channels)
            wav.setsampwidth(2)  # 16-bit
            wav.setframerate(buffer.sample_rate)
            wav.writeframes(buffer.data)
        
        # Save WAV file to disk for debugging
        import os
        import time
        debug_dir = "tmp/audio_debug"
        os.makedirs(debug_dir, exist_ok=True)
        timestamp = int(time.time() * 1000)
        wav_filename = f"{debug_dir}/debug_audio_{timestamp}.wav"
        
        with open(wav_filename, "wb") as f:
            f.write(io_buffer.getvalue())
        
        logger.info(f"Saved debug audio file: {wav_filename}")
        
        # Use the language parameter if provided, otherwise fall back to instance language
        target_language = language or self.language
        
        logger.info(f"Processing WAV file directly with FasterWhisper: {wav_filename}")
        
        try:
            # Run FasterWhisper transcription directly on the WAV file
            segments, info = self.model.transcribe(
                wav_filename,  # Pass the WAV file path directly
                beam_size=5,
                language=target_language,
                condition_on_previous_text=False,
                temperature=0.0
            )
            
            # Combine all segments into a single text
            result_text = ""
            for segment in segments:
                segment_text = segment.text.strip()
                if segment_text:
                    result_text += segment_text + " "
            
            result_text = result_text.strip()
            
            logger.info(f"FasterWhisper transcription: '{result_text}'")
            
            return stt.SpeechEvent(
                type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[
                    stt.SpeechData(
                        text=result_text or "", 
                        language=info.language if hasattr(info, 'language') else (target_language or "")
                    )
                ],
            )
            
        except Exception as e:
            logger.error(f"FasterWhisper transcription error: {e}")
            return stt.SpeechEvent(
                type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[
                    stt.SpeechData(text="", language=target_language or "")
                ],
            )


class Assistant(Agent):
    def __init__(self) -> None:
        self._latest_frame = None
        self._video_stream = None
        self._tasks = []
        super().__init__(instructions="""You are a helpful voice AI assistant.
        You answer should be 1 step at a time. Do not format your answer with markdown or any other syntax as if you are speaking in a call.
        You have to help user with their queries.
        User is providing his current screen via video feed. So never mention image/screenshot as if you see the live screen. 
        You have to solve his problems based on the image and queries.
        ***DO NOT ANSWER ANYTHING WITHOUT LOOKING THE LATEST IMAGE***""")
    
    async def on_enter(self):
        room = get_job_context().room

        # Find the first video track (if any) from existing remote participants
        if room.remote_participants:
            for participant in room.remote_participants.values():
                video_tracks = [
                    publication.track 
                    for publication in participant.track_publications.values() 
                    if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO
                ]
                if video_tracks:
                    logger.info(f"Found existing video track from participant {participant.identity}")
                    self._create_video_stream(video_tracks[0])
                    break
        
        # Watch for new video tracks not yet published
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            logger.info(f"Track subscribed: {track.kind} from participant {participant.identity}")
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                logger.info("Setting up video stream for new video track")
                self._create_video_stream(track)
        
        # Also watch for when participants join
        @room.on("participant_connected")
        def on_participant_connected(participant: rtc.RemoteParticipant):
            logger.info(f"Participant connected: {participant.identity}")
        
        logger.info(f"Agent entered room. Current participants: {len(room.remote_participants)}")
                        
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        # Add the latest video frame, if any, to the new message
        if self._latest_frame:
            logger.info("Adding latest frame to user message")
            
            # Ensure content is a list so we can append the image
            if isinstance(new_message.content, str):
                # Convert string content to list with text and image in VLLM format
                new_message.content = [
                    {"type": "text", "text": new_message.content},  # Text in VLLM format
                    {"type": "image_url", "image_url": {"url": self._latest_frame}}  # Image in VLLM format
                ]
            elif isinstance(new_message.content, list):
                # Already a list, just append the image in VLLM format
                new_message.content.append({
                    "type": "image_url", 
                    "image_url": {"url": self._latest_frame}
                })
            else:
                # Content is None or other type, create new list with image
                new_message.content = [{
                    "type": "image_url", 
                    "image_url": {"url": self._latest_frame}
                }]
            
            logger.info(f"Message content structure: {type(new_message.content)}")
            logger.debug(f"Full message content: {new_message.content}")
            
            self._latest_frame = None
            logger.debug("Successfully added frame to user message")
    
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
                            logger.debug(f"Received and encoded video frame: {event.frame.width}x{event.frame.height}, size: {len(compressed_image_bytes)} bytes")
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
        # Use our custom FasterWhisper STT
        # stt=FasterWhisperSTT(
        #     model_size="small",  # Options: tiny, base, small, medium, large
        #     device="cpu",       # Use "cuda" if you have GPU support
        #     language="en"       # Set to None for auto-detection
        # ),
        stt=groq.STT(),
        # llm=aws.LLM(
        #     model="us.anthropic.claude-sonnet-4-20250514-v1:0"
        # ),
        llm=openai.LLM(
            base_url="http://160.250.71.216:20591/v1",
            model="google/gemma-3-27b-it"
        ),
        # llm=openai.LLM(
        #     model="gpt-4o"
        # ),
        tts=deepgram.TTS(),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
        preemptive_generation=False
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(), 
            video_enabled=True
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
