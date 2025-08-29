import io
import logging
import wave
import numpy as np
from dotenv import load_dotenv
import base64
import asyncio
import aiohttp
import json
import uuid
from openai import OpenAI
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
class Assistant(Agent):
    def __init__(self) -> None:
        self._latest_frame = None
        self._video_stream = None
        self._tasks = []
        super().__init__(instructions="""You are a helpful voice AI assistant.""")
    
    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[FunctionTool],
        model_settings: ModelSettings
    ) -> AsyncIterable[llm.ChatChunk]:
        # Insert custom preprocessing here
        async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
            # Insert custom postprocessing here
            yield chunk

    async def on_enter(self):
        self.session.generate_reply(user_input="Greet the user with just 4 words.", allow_interruptions=False)
        room = get_job_context().room
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
        
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        # Add the latest video frame, if any, to the new message
        if self._latest_frame:
            new_message.content.append(ImageContent(image=self._latest_frame))
            self._latest_frame = None
    
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
        llm=openai.LLM(
            
            model="gpt-4o",
            timeout=5000
        ),
        tts=openai.TTS(),
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
        preemptive_generation=False
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(), 
            video_enabled=True
        ),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
