import React from 'react';
import { motion } from 'motion/react';
import { VideoTrack } from '@livekit/components-react';
import { cn } from '@/lib/utils';

const MotionVideoTrack = motion.create(VideoTrack);

export const VideoTile = ({
  trackRef,
  className,
  ref,
}: React.ComponentProps<'div'> & React.ComponentProps<typeof VideoTrack>) => {
  return (
    <div ref={ref} className={cn(
      'relative overflow-hidden rounded-2xl shadow-2xl border border-white/10',
      'bg-gradient-to-br from-slate-800/80 to-slate-900/60 backdrop-blur-xl',
      className
    )}>
      {/* Video content */}
      <MotionVideoTrack
        trackRef={trackRef}
        width={trackRef?.publication.dimensions?.width ?? 0}
        height={trackRef?.publication.dimensions?.height ?? 0}
        className="h-full w-full object-cover rounded-2xl"
      />
      
      {/* Overlay for better integration */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/10 pointer-events-none" />
      
      {/* Source indicator */}
      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-white/10">
        {trackRef?.source === 'screen_share' ? (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 2v6h12V6H4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Screen</span>
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Camera</span>
          </>
        )}
      </div>
    </div>
  );
};
