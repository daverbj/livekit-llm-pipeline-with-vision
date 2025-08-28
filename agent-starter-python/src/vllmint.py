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
    JobProcess,
    AgentFalseInterruptionEvent,
    metrics,
    MetricsCollectedEvent,
    NOT_GIVEN
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
import asyncio
from faster_whisper import WhisperModel
from livekit.plugins import aws

from livekit import rtc
from livekit.agents import ModelSettings, stt, Agent
from livekit.agents.utils import AudioBuffer
from typing import AsyncIterable, Optional
from livekit.agents.utils.images import encode, EncodeOptions, ResizeOptions
from livekit.agents.llm import ImageContent, function_tool

logger = logging.getLogger("agent")

load_dotenv()

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
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list[llm.FunctionTool],
        model_settings: ModelSettings,
    ) -> AsyncIterable[llm.ChatChunk] :

        async for chunk in super().llm_node(chat_ctx, tools, model_settings):
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
        # See all providers at https://docs.livekit.io/agents/integrations/llm/
        llm=openai.LLM(
            base_url="http://160.250.71.216:20591/v1",
            model="google/gemma-3-27b-it"
        ),
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all providers at https://docs.livekit.io/agents/integrations/stt/
        stt=FasterWhisperSTT(model_size="small", device="cpu"),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all providers at https://docs.livekit.io/agents/integrations/tts/
        tts=openai.TTS(),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        # See more at https://docs.livekit.io/agents/build/turns
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # allow the LLM to generate a response while waiting for the end of turn
        # See more at https://docs.livekit.io/agents/build/audio/#preemptive-generation
        preemptive_generation=True,
    )

    # To use a realtime model instead of a voice pipeline, use the following session setup instead:
    # session = AgentSession(
    #     # See all providers at https://docs.livekit.io/agents/integrations/realtime/
    #     llm=openai.realtime.RealtimeModel()
    # )

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

    # # Add a virtual avatar to the session, if desired
    # # For other providers, see https://docs.livekit.io/agents/integrations/avatar/
    # avatar = hedra.AvatarSession(
    #   avatar_id="...",  # See https://docs.livekit.io/agents/integrations/avatar/hedra
    # )
    # # Start the avatar and wait for it to join
    # await avatar.start(session, room=ctx.room)

    # Start the session, which initializes the voice pipeline and warms up the models
    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_input_options=RoomInputOptions(
            # LiveKit Cloud enhanced noise cancellation
            # - If self-hosting, omit this parameter
            # - For telephony applications, use `BVCTelephony` for best results
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Join the room and connect to the user
    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))