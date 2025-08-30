import asyncio
import base64
import logging
import os
from datetime import datetime

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    NOT_GIVEN,
    Agent,
    AgentFalseInterruptionEvent,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    ModelSettings,
    RoomInputOptions,
    RunContext,
    WorkerOptions,
    cli,
    get_job_context,
    llm,
    metrics,
)
from livekit.agents.llm import ImageContent, function_tool
from livekit.agents.utils.images import encode, EncodeOptions, ResizeOptions
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env")


async def get_video_track(room: rtc.Room):
    """Find and return the first available remote video track in the room."""
    if not room.remote_participants:
        logger.debug("No remote participants in the room")
        return None
        
    for participant_id, participant in room.remote_participants.items():
        if not participant.track_publications:
            logger.debug(f"No track publications for participant {participant_id}")
            continue
            
        for track_id, track_publication in participant.track_publications.items():
            if (track_publication.track and 
                isinstance(track_publication.track, rtc.RemoteVideoTrack) and
                track_publication.subscribed):
                logger.info(
                    f"Found video track {track_publication.track.sid} "
                    f"from participant {participant_id}"
                )
                return track_publication.track
    
    logger.debug("No remote video track found in the room")
    return None


async def get_latest_image(room: rtc.Room):
    """Capture and return a single frame from the video track, compressed to 250x250."""
    video_stream = None
    try:
        video_track = await get_video_track(room)
        if not video_track:
            logger.debug("No video track available for frame capture")
            return None
            
        video_stream = rtc.VideoStream(video_track)
        async for event in video_stream:
            if event.frame:
                logger.debug("Captured latest video frame, compressing to 250x250")
                
                # Compress the frame to 250x250 pixels
                try:
                    compressed_image_bytes = encode(
                        event.frame,
                        EncodeOptions(
                            format="JPEG",
                            resize_options=ResizeOptions(
                                width=1024,
                                height=1024,
                                strategy="scale_aspect_fit"  # Maintain aspect ratio
                            )
                        )
                    )
                    
                    # Convert to base64 for LLM consumption
                    compressed_base64 = base64.b64encode(compressed_image_bytes).decode('utf-8')
                    compressed_data_url = f"data:image/jpeg;base64,{compressed_base64}"
                    
                    logger.debug(f"Successfully compressed frame to 250x250, size: {len(compressed_image_bytes)} bytes")
                    return compressed_data_url
                    
                except Exception as compression_error:
                    logger.error(f"Failed to compress frame: {compression_error}")
                    # Fallback to original frame if compression fails
                    return event.frame
            else:
                logger.debug("Received video event but no frame data")
                
        logger.debug("No frames received from video stream")
        return None
        
    except Exception as e:
        logger.warning(f"Failed to get latest image: {e}")
        return None
    finally:
        if video_stream:
            try:
                await video_stream.aclose()
            except Exception as e:
                logger.warning(f"Error closing video stream: {e}")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant with visual capabilities.
        You are being fed with latest image of either from camera or screen of the user.
        You have to answer based on the visual and text input you receive.
        Your answers should be concise not verbose as if you are in a call.
        """,
        )
    async def on_enter(self):
        await self.session.generate_reply(
            instructions="Greet the user with a short welcome. Do not describe your capabilities.",
        )
    from typing import AsyncIterable
    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.FunctionTool],
        model_settings: ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk] :
        """Override the LLM node to add the latest video frame before LLM processing."""
        
        # Safely try to get the latest image from the video track
        latest_image = None
        try:
            room = get_job_context().room
            if room:
                latest_image = await get_latest_image(room)
                
            if latest_image:
                # Add the image to the chat context
                chat_ctx.add_message(
                    role="user",
                    content=[ImageContent(image=latest_image)]
                )
                logger.debug("Added latest video frame to chat context before LLM")
            else:
                logger.debug("No video frame available - proceeding with text-only conversation")
                
        except Exception as e:
            logger.warning(f"Error while trying to add video frame to chat context: {e}")
            # Continue without video - don't let this break the conversation

        # Call the default LLM node implementation
        async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
            # Insert custom postprocessing here
            yield chunk
    # all functions annotated with @function_tool will be passed to the LLM when this
    # agent is active
    # @function_tool
    # async def lookup_weather(self, context: RunContext, location: str):
    #     """Use this tool to look up current weather information in the given location.

    #     If the location is not supported by the weather service, the tool will indicate this. You must tell the user the location's weather is unavailable.

    #     Args:
    #         location: The location to look up weather information for (e.g. city name)
    #     """

    #     logger.info(f"Looking up weather for {location}")

    #     return "sunny with a temperature of 70 degrees."


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    # Logging setup
    # Add any other context you want in all log entries here
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # Set up a voice AI pipeline using OpenAI, Cartesia, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # Using qwen2.5vl which supports vision capabilities with increased timeout
        # See all providers at https://docs.livekit.io/agents/integrations/llm/
        llm=openai.realtime.RealtimeModel(
            model="gpt-realtime-2025-08-28",
        ),
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all providers at https://docs.livekit.io/agents/integrations/stt/
        # stt=openai.STT(model="whisper-1"),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all providers at https://docs.livekit.io/agents/integrations/tts/
        # tts=openai.TTS(),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # sometimes background noise could interrupt the agent session, these are considered false positive interruptions
    # when it's detected, you may resume the agent's speech
    @session.on("agent_false_interruption")
    def _on_agent_false_interruption(ev: AgentFalseInterruptionEvent):
        logger.info("false positive interruption, resuming")
        session.generate_reply(instructions=ev.extra_instructions or NOT_GIVEN)

    # Metrics collection, to measure pipeline performance
    # For more information, see https://docs.livekit.io/agents/build/metrics/
    usage_collector = metrics.UsageCollector()

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent):
        metrics.log_metrics(ev.metrics)
        usage_collector.collect(ev.metrics)

    async def log_usage():
        summary = usage_collector.get_summary()
        logger.info(f"Usage: {summary}")

    ctx.add_shutdown_callback(log_usage)

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
