import io
import logging
import wave
import numpy as np
from dotenv import load_dotenv
import base64
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
from livekit.plugins import google
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from typing import AsyncIterable
import asyncio
import asyncio
from faster_whisper import WhisperModel
from livekit.plugins import aws

from livekit import rtc
from livekit.agents import ModelSettings, stt, Agent
from livekit.agents.utils import AudioBuffer
from typing import AsyncIterable, Optional
from livekit.agents.utils.images import encode, EncodeOptions, ResizeOptions
from livekit.agents.llm import ImageContent, function_tool, ChatMessage

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
        super().__init__(instructions="""
        You are a helpful voice AI assistant.
        You answer should be 1 step at a time. Do not format your answer with markdown or any other syntax as if you are speaking in a call.
        You have to help user with their queries.
        User is providing his current screen via video feed. So never mention image/screenshot as if you see the live screen. 
        You have to solve his problems based on the image and queries.
        ***DO NOT ANSWER ANYTHING WITHOUT LOOKING THE LATEST IMAGE***
        """)
        
    async def on_enter(self):
        room = get_job_context().room

        # Find the first video track (if any) from the remote participant
        if room.remote_participants:
            remote_participant = list(room.remote_participants.values())[0]
            video_tracks = [publication.track for publication in list(remote_participant.track_publications.values()) 
                          if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO]
            if video_tracks:
                self._create_video_stream(video_tracks[0])
        
        # Watch for new video tracks not yet published
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                self._create_video_stream(track)
                        
    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        # Add the latest video frame, if any, to the new message
        if self._latest_frame:
            # Ensure content is a list
            if isinstance(new_message.content, str):
                new_message.content = [new_message.content]
            elif new_message.content is None:
                new_message.content = []
            
            # Add the image to the message content
            new_message.content.append(ImageContent(image=self._latest_frame))
            logger.debug("Added latest video frame to user message")
    
    # Helper method to buffer the latest video frame from the user's track
    def _create_video_stream(self, track: rtc.Track):
        # Close any existing stream (we only want one at a time)
        if self._video_stream is not None:
            self._video_stream.aclose()

        # Create a new stream to receive frames    
        self._video_stream = rtc.VideoStream(track)
        async def read_stream():
            async for event in self._video_stream:
                if event.frame:
                    try:
                        # Compress the frame to 1024x1024 pixels
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
                        
                        # Convert to base64 for LLM consumption
                        compressed_base64 = base64.b64encode(compressed_image_bytes).decode('utf-8')
                        self._latest_frame = f"data:image/jpeg;base64,{compressed_base64}"
                        
                        logger.debug(f"Updated latest frame, size: {len(compressed_image_bytes)} bytes")
                        
                    except Exception as compression_error:
                        logger.error(f"Failed to compress frame: {compression_error}")
        
        # Store the async task
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
        self._tasks.append(task)

async def entrypoint(ctx: JobContext):
    session = AgentSession(
        # Use our custom FasterWhisper STT
        stt=FasterWhisperSTT(
            model_size="small",  # Options: tiny, base, small, medium, large
            device="cpu",       # Use "cuda" if you have GPU support
            language="en"       # Set to None for auto-detection
        ),
        # stt=groq.STT(),
        # llm=aws.LLM(
        #     model="us.anthropic.claude-sonnet-4-20250514-v1:0"
        # ),
        # llm=openai.LLM(
        #     base_url="http://160.250.71.216:20591/v1",
        #     model="google/gemma-3-27b-it"
        # ),
        llm=openai.LLM(
            base_url="http://160.250.71.216:20591/v1",
            model="google/gemma-3-27b-it"
        ),
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
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))