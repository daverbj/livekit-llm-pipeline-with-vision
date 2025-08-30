import { type AgentState, BarVisualizer, type TrackReference } from '@livekit/components-react';
import { cn } from '@/lib/utils';

interface AgentAudioTileProps {
  state: AgentState;
  audioTrack: TrackReference;
  className?: string;
}

export const AgentTile = ({
  state,
  audioTrack,
  className,
  ref,
}: React.ComponentProps<'div'> & AgentAudioTileProps) => {
  return (
    <div ref={ref} className={cn(className)}>
      {/* Glassmorphism container for agent tile */}
      <div className="relative bg-gradient-to-br from-slate-800/80 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 overflow-hidden aspect-video flex flex-col justify-center">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.1),transparent_70%)]" />
        
        {/* Agent info */}
        <div className="relative z-10 flex flex-col items-center text-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl mb-4 border border-white/10">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v-.07zM17.9 17.39c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <div className="text-lg font-bold text-white mb-2">AI Agent</div>
          <div className={cn(
            "text-sm font-medium px-3 py-1.5 rounded-full border transition-all duration-300",
            state === 'listening' && "text-emerald-400 bg-emerald-500/20 border-emerald-500/30",
            state === 'thinking' && "text-amber-400 bg-amber-500/20 border-amber-500/30",
            state === 'speaking' && "text-blue-400 bg-blue-500/20 border-blue-500/30",
            (state === 'connecting' || state === 'disconnected') && "text-slate-400 bg-slate-500/20 border-slate-500/30"
          )}>
            {state.charAt(0).toUpperCase() + state.slice(1)}
          </div>
        </div>

        {/* Audio visualizer */}
        <div className="relative z-10 flex justify-center">
          <BarVisualizer
            barCount={5}
            state={state}
            options={{ minHeight: 8 }}
            trackRef={audioTrack}
            className="flex items-center justify-center gap-2"
          >
            <span
              className={cn([
                'min-h-6 w-3 rounded-full transition-all duration-300 ease-out',
                'origin-center',
                'data-[lk-highlighted=true]:bg-gradient-to-t data-[lk-highlighted=true]:from-blue-400 data-[lk-highlighted=true]:to-blue-500 data-[lk-highlighted=true]:shadow-lg data-[lk-highlighted=true]:shadow-blue-500/25',
                'data-[lk-muted=true]:bg-slate-600',
                !audioTrack && 'bg-slate-600'
              ])}
            />
          </BarVisualizer>
        </div>
        
        {/* Status indicator */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full transition-all duration-300",
            state === 'listening' && "bg-emerald-500 shadow-lg shadow-emerald-500/40 animate-pulse",
            state === 'thinking' && "bg-amber-500 shadow-lg shadow-amber-500/40 animate-pulse",
            state === 'speaking' && "bg-blue-500 shadow-lg shadow-blue-500/40 animate-pulse",
            (state === 'connecting' || state === 'disconnected') && "bg-slate-500"
          )} />
        </div>
      </div>
    </div>
  );
};
