from livekit.agents import (
    AgentSession,
    RoomInputOptions,
    Agent,
    JobContext,
    cli,
    WorkerOptions,
    JobProcess,
    ChatContext,
    ChatMessage
)
from livekit.plugins import google
import asyncio
import logging
from livekit import rtc
from livekit.agents import Agent, get_job_context
from livekit.agents.llm import ImageContent
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

from dotenv import load_dotenv

load_dotenv()

class VideoAssistant(Agent):
    def __init__(self) -> None:
        self._latest_frame = None
        self._video_stream = None
        self._tasks = []
        super().__init__(
            instructions="You are a helpful voice assistant with live video input from your user.",
        )
    async def on_enter(self):
        await self.session.generate_reply(
            instructions="Greet the user with very short welcome message.",
        )
        room = get_job_context().room

        remote_participant = list(room.remote_participants.values())[0]
        video_tracks = [publication.track for publication in list(remote_participant.track_publications.values()) if publication.track.kind == rtc.TrackKind.KIND_VIDEO]
        if video_tracks:
            self._create_video_stream(video_tracks[0])

        
        @room.on("track_subscribed")
        def on_track_subscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                logger.info(f"Subscribed to video track from participant {participant.identity}")
                self._create_video_stream(track)
    
    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        # Add the latest video frame, if any, to the new message
        if self._latest_frame:
            new_message.content.append(ImageContent(image=self._latest_frame))
            self._latest_frame = None
    def _create_video_stream(self, track: rtc.Track):
        # Close any existing stream (we only want one at a time)
        if self._video_stream is not None:
            self._video_stream.close()

        # Create a new stream to receive frames    
        self._video_stream = rtc.VideoStream(track)
        async def read_stream():
            async for event in self._video_stream:
                # Store the latest frame for use later
                self._latest_frame = event.frame
        
        # Store the async task
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t))
        self._tasks.append(task)
                
            
def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()

async def entrypoint(ctx: JobContext):
    session = AgentSession(
        llm=openai.LLM.with_ollama(
            model="gemma3:4b",
        ),
        stt=openai.STT(model="whisper-1"),
        tts=openai.TTS(),
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(
        agent=VideoAssistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            video_enabled=True
        ),
    )
if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))