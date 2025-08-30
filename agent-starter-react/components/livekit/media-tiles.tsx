import React, { useMemo } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, motion } from 'motion/react';
import {
  type TrackReference,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { cn } from '@/lib/utils';
import { AgentTile } from './agent-tile';
import { AvatarTile } from './avatar-tile';
import { VideoTile } from './video-tile';

const MotionVideoTile = motion.create(VideoTile);
const MotionAgentTile = motion.create(AgentTile);
const MotionAvatarTile = motion.create(AvatarTile);

const animationProps = {
  initial: {
    opacity: 0,
    scale: 0,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0,
  },
  transition: {
    type: 'spring',
    stiffness: 675,
    damping: 75,
    mass: 1,
  },
};

const classNames = {
  // GRID
  // 2 Columns x 3 Rows
  grid: [
    'h-full w-full',
    'grid gap-x-2 place-content-center',
    'grid-cols-[1fr_1fr] grid-rows-[90px_1fr_90px]',
  ],
  // Agent
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 1 / Row 1
  // align: x-end y-center
  agentChatOpenWithSecondTile: ['col-start-1 row-start-1', 'self-center justify-self-end'],
  // Agent
  // chatOpen: true,
  // hasSecondTile: false
  // layout: Column 1 / Row 1 / Column-Span 2
  // align: x-center y-center
  agentChatOpenWithoutSecondTile: ['col-start-1 row-start-1', 'col-span-2', 'place-content-center'],
  // Agent
  // chatOpen: false
  // layout: Column 1 / Row 1 / Column-Span 2 / Row-Span 3
  // align: x-center y-center
  agentChatClosed: ['col-start-1 row-start-1', 'col-span-2 row-span-3', 'place-content-center'],
  // Second tile
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 2 / Row 1
  // align: x-start y-center
  secondTileChatOpen: ['col-start-2 row-start-1', 'self-center justify-self-start'],
  // Second tile
  // chatOpen: false,
  // hasSecondTile: false
  // layout: Column 2 / Row 2
  // align: x-end y-end
  secondTileChatClosed: ['col-start-2 row-start-3', 'place-content-end'],
};

export function useLocalTrackRef(source: Track.Source) {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(source);
  const trackRef = useMemo<TrackReference | undefined>(
    () => (publication ? { source, participant: localParticipant, publication } : undefined),
    [source, publication, localParticipant]
  );
  return trackRef;
}

interface MediaTilesProps {
  chatOpen: boolean;
}

export function MediaTiles({ chatOpen }: MediaTilesProps) {
  const {
    state: agentState,
    audioTrack: agentAudioTrack,
    videoTrack: agentVideoTrack,
  } = useVoiceAssistant();
  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted;
  const isScreenShareEnabled = screenShareTrack && !screenShareTrack.publication.isMuted;
  const hasUserVideo = isCameraEnabled || isScreenShareEnabled;

  const transition = {
    type: 'spring' as const,
    stiffness: 675,
    damping: 75,
    mass: 1,
    delay: chatOpen ? 0 : 0.15,
  };

  const agentAnimate = {
    opacity: 1,
    scale: chatOpen ? 1 : 1.2,
  };

  const userAnimate = {
    opacity: 1,
    scale: 1,
  };

  const isAvatar = agentVideoTrack !== undefined;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-8 bottom-32 z-50 md:top-12 md:bottom-40">
      <div className="relative mx-auto h-full max-w-4xl px-4 md:px-0">
        {/* Two-box layout: Always show both agent and user boxes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center justify-center">
          
          {/* Agent Box */}
          <div className="flex justify-center">
            <AnimatePresence mode="popLayout">
              {!isAvatar && (
                // Audio-only agent
                <MotionAgentTile
                  key="agent"
                  layoutId="agent"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={agentAnimate}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={transition}
                  state={agentState}
                  audioTrack={agentAudioTrack}
                  className="w-full max-w-sm aspect-video"
                />
              )}
              {isAvatar && (
                // Avatar agent
                <MotionAvatarTile
                  key="avatar"
                  layoutId="avatar"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={userAnimate}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={transition}
                  videoTrack={agentVideoTrack}
                  className="w-full max-w-sm aspect-video"
                />
              )}
            </AnimatePresence>
          </div>

          {/* User Box */}
          <div className="flex justify-center">
            <AnimatePresence>
              {hasUserVideo ? (
                // User has video (camera or screen share)
                <div>
                  {isCameraEnabled && (
                    <MotionVideoTile
                      key="camera"
                      layout="position"
                      layoutId="camera"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      trackRef={cameraTrack}
                      transition={transition}
                      className="w-full max-w-sm aspect-video"
                    />
                  )}
                  {isScreenShareEnabled && (
                    <MotionVideoTile
                      key="screen"
                      layout="position"
                      layoutId="screen"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      trackRef={screenShareTrack}
                      transition={transition}
                      className="w-full max-w-sm aspect-video"
                    />
                  )}
                </div>
              ) : (
                // User audio-only placeholder
                <motion.div
                  key="user-placeholder"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={userAnimate}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={transition}
                  className="w-full max-w-sm"
                >
                  <div className="relative bg-gradient-to-br from-slate-700/80 to-slate-800/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 overflow-hidden aspect-video flex items-center justify-center">
                    {/* Background effects */}
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/5" />
                    
                    {/* User info */}
                    <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-xl mb-4 border border-white/10">
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-lg font-bold text-white mb-2">You</div>
                      <div className="text-sm font-medium px-3 py-1.5 rounded-full border text-emerald-400 bg-emerald-500/20 border-emerald-500/30">
                        Audio Only
                      </div>
                    </div>
                    
                    {/* Status indicator */}
                    <div className="absolute top-3 right-3">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/40 animate-pulse" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
