'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, FileText, List } from 'lucide-react';

interface TranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptionData {
  text: string;
  segments: TranscriptionSegment[];
  words: TranscriptionWord[];
}

interface VideoPlayerProps {
  videoPath: string;
  transcriptionData?: TranscriptionData | null;
  tutorialSteps?: string[];
  className?: string;
}

export default function VideoPlayer({ 
  videoPath, 
  transcriptionData, 
  tutorialSteps, 
  className = '' 
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSegment, setActiveSegment] = useState<TranscriptionSegment | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateTime = () => setCurrentTime(video.currentTime);
    const updateDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('durationchange', updateDuration);

    return () => {
      video.removeEventListener('timeupdate', updateTime);
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
    };
  }, []);

  // Update active segment based on current time
  useEffect(() => {
    if (!transcriptionData?.segments) return;

    const current = transcriptionData.segments.find(
      segment => currentTime >= segment.start && currentTime <= segment.end
    );
    setActiveSegment(current || null);
  }, [currentTime, transcriptionData]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (time: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const skipBackward = () => {
    handleSeek(Math.max(0, currentTime - 10));
  };

  const skipForward = () => {
    handleSeek(Math.min(duration, currentTime + 10));
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const seekToSegment = (segment: TranscriptionSegment) => {
    handleSeek(segment.start);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden ${className}`}>
      {/* Main Content Grid - Video and Transcription Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6 p-6">
        {/* Video Section */}
        <div className="space-y-4">
          {/* Video Container */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-auto"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
            >
              <source src={videoPath} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            {/* Video Controls Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
              {/* Progress Bar */}
              <div className="mb-3">
                <div className="w-full bg-white/20 rounded-full h-1 cursor-pointer"
                     onClick={(e) => {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const percent = (e.clientX - rect.left) / rect.width;
                       handleSeek(percent * duration);
                     }}>
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all"
                    style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={skipBackward}
                    className="text-white hover:text-blue-400 transition-colors"
                    title="Skip back 10s"
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>

                  <button
                    onClick={togglePlayPause}
                    className="text-white hover:text-blue-400 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6" />
                    ) : (
                      <Play className="w-6 h-6" />
                    )}
                  </button>

                  <button
                    onClick={skipForward}
                    className="text-white hover:text-blue-400 transition-colors"
                    title="Skip forward 10s"
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>

                  <div className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-blue-400 transition-colors"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 accent-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Current Segment Display */}
          {activeSegment && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-800">
                  Current Segment
                </span>
                <span className="text-xs text-blue-600">
                  {formatTime(activeSegment.start)} - {formatTime(activeSegment.end)}
                </span>
              </div>
              <p className="text-blue-900 leading-relaxed">
                {activeSegment.text.trim()}
              </p>
            </div>
          )}
        </div>

        {/* Interactive Transcription Section */}
        {transcriptionData?.segments && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Interactive Transcription
            </h3>
            <div className="h-96 overflow-y-auto space-y-2 pr-2">
              {transcriptionData.segments.map((segment) => (
                <div
                  key={segment.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    activeSegment?.id === segment.id
                      ? 'bg-blue-100 border-l-4 border-blue-500 shadow-md'
                      : 'bg-gray-50 hover:bg-gray-100 border-l-4 border-transparent'
                  }`}
                  onClick={() => seekToSegment(segment)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-blue-600 font-medium">
                      {formatTime(segment.start)} - {formatTime(segment.end)}
                    </span>
                    <span className="text-xs text-gray-500">
                      Click to seek
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {segment.text.trim()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tutorial Steps Section - Below the main content */}
      {tutorialSteps && tutorialSteps.length > 0 && (
        <div className="border-t border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <List className="w-5 h-5 text-purple-600" />
            Tutorial Steps
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tutorialSteps.map((step, index) => (
              <div key={index} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-700 text-sm font-medium rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-700 leading-relaxed">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
