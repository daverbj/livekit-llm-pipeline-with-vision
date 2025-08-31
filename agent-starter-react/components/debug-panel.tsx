'use client';

import React, { useState, useEffect } from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant, useTracks } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DebugPanelProps {
  className?: string;
}

export function DebugPanel({ className }: DebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks();

  // Capture console logs for debugging
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = (...args) => {
      originalLog(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      if (message.includes('device') || message.includes('track') || message.includes('Changing')) {
        setLogs(prev => [...prev.slice(-19), `[LOG] ${new Date().toLocaleTimeString()}: ${message}`]);
      }
    };

    console.error = (...args) => {
      originalError(...args);
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      setLogs(prev => [...prev.slice(-19), `[ERROR] ${new Date().toLocaleTimeString()}: ${message}`]);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);

  // Track state changes
  useEffect(() => {
    const trackStates = tracks.map(track => ({
      source: track.source,
      trackSid: track.publication?.trackSid,
      isMuted: track.publication?.isMuted,
      isSubscribed: track.publication?.isSubscribed,
    }));

    if (trackStates.length > 0) {
      setLogs(prev => [...prev.slice(-19), `[TRACKS] ${new Date().toLocaleTimeString()}: ${JSON.stringify(trackStates)}`]);
    }
  }, [tracks]);

  const getDeviceInfo = () => {
    const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
    const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
    const screenPublication = localParticipant.getTrackPublication(Track.Source.ScreenShare);

    return {
      camera: {
        enabled: cameraPublication && !cameraPublication.isMuted,
        trackSid: cameraPublication?.trackSid,
        deviceId: cameraPublication?.track?.mediaStreamTrack?.getSettings()?.deviceId,
      },
      microphone: {
        enabled: micPublication && !micPublication.isMuted,
        trackSid: micPublication?.trackSid,
        deviceId: micPublication?.track?.mediaStreamTrack?.getSettings()?.deviceId,
      },
      screenShare: {
        enabled: screenPublication && !screenPublication.isMuted,
        trackSid: screenPublication?.trackSid,
      },
    };
  };

  if (!isOpen) {
    return (
      <div className={cn('fixed bottom-4 left-4 z-50', className)}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="bg-black/50 backdrop-blur-sm border-white/20 text-white hover:bg-black/70"
        >
          Debug
        </Button>
      </div>
    );
  }

  const deviceInfo = getDeviceInfo();

  return (
    <div className={cn('fixed bottom-4 left-4 z-50 w-96 max-h-80 bg-black/90 backdrop-blur-sm rounded-lg border border-white/20 p-4 text-white text-xs font-mono', className)}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold">Device Debug Panel</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0 text-white hover:bg-white/20"
        >
          ×
        </Button>
      </div>

      <div className="mb-3 space-y-1">
        <div className="text-yellow-400">Current Device States:</div>
        <div>Camera: {deviceInfo.camera.enabled ? '✅' : '❌'} (ID: {deviceInfo.camera.deviceId || 'none'})</div>
        <div>Mic: {deviceInfo.microphone.enabled ? '✅' : '❌'} (ID: {deviceInfo.microphone.deviceId || 'none'})</div>
        <div>Screen: {deviceInfo.screenShare.enabled ? '✅' : '❌'}</div>
      </div>

      <div className="border-t border-white/20 pt-2">
        <div className="text-yellow-400 mb-1">Recent Logs:</div>
        <div className="overflow-y-auto max-h-32 space-y-1">
          {logs.length === 0 && <div className="text-gray-400">No logs yet...</div>}
          {logs.map((log, index) => (
            <div key={index} className={cn(
              'text-xs break-words',
              log.includes('[ERROR]') ? 'text-red-400' : 'text-green-400'
            )}>
              {log}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-white/20">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogs([])}
          className="h-6 text-xs bg-transparent border-white/20 text-white hover:bg-white/20"
        >
          Clear Logs
        </Button>
      </div>
    </div>
  );
}
