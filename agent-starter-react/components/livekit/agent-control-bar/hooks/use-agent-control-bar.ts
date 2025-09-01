import * as React from 'react';
import { Track } from 'livekit-client';
import {
  type TrackReferenceOrPlaceholder,
  useLocalParticipant,
  usePersistentUserChoices,
  useRoomContext,
  useTrackToggle,
} from '@livekit/components-react';
import { usePublishPermissions } from './use-publish-permissions';

export interface ControlBarControls {
  microphone?: boolean;
  screenShare?: boolean;
  chat?: boolean;
  camera?: boolean;
  leave?: boolean;
}

export interface UseAgentControlBarProps {
  controls?: ControlBarControls;
  saveUserChoices?: boolean;
  onDeviceError?: (error: { source: Track.Source; error: Error }) => void;
}

export interface UseAgentControlBarReturn {
  micTrackRef: TrackReferenceOrPlaceholder;
  visibleControls: ControlBarControls;
  microphoneToggle: ReturnType<typeof useTrackToggle<Track.Source.Microphone>>;
  cameraToggle: ReturnType<typeof useTrackToggle<Track.Source.Camera>>;
  screenShareToggle: ReturnType<typeof useTrackToggle<Track.Source.ScreenShare>>;
  handleDisconnect: () => void;
  handleAudioDeviceChange: (deviceId: string) => void;
  handleVideoDeviceChange: (deviceId: string) => void;
}

export function useAgentControlBar(props: UseAgentControlBarProps = {}): UseAgentControlBarReturn {
  const { controls, saveUserChoices = true } = props;
  const visibleControls = {
    leave: true,
    ...controls,
  };
  const { microphoneTrack, localParticipant } = useLocalParticipant();
  const publishPermissions = usePublishPermissions();
  const room = useRoomContext();

  const microphoneToggle = useTrackToggle({
    source: Track.Source.Microphone,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.Microphone, error }),
  });
  const cameraToggle = useTrackToggle({
    source: Track.Source.Camera,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.Camera, error }),
  });
  const screenShareToggle = useTrackToggle({
    source: Track.Source.ScreenShare,
    onDeviceError: (error) => props.onDeviceError?.({ source: Track.Source.ScreenShare, error }),
  });

  const micTrackRef = React.useMemo(() => {
    return {
      participant: localParticipant,
      source: Track.Source.Microphone,
      publication: microphoneTrack,
    };
  }, [localParticipant, microphoneTrack]);

  visibleControls.microphone ??= publishPermissions.microphone;
  visibleControls.screenShare ??= publishPermissions.screenShare;
  visibleControls.camera ??= publishPermissions.camera;
  visibleControls.chat ??= publishPermissions.data;

  const {
    saveAudioInputEnabled,
    saveAudioInputDeviceId,
    saveVideoInputEnabled,
    saveVideoInputDeviceId,
  } = usePersistentUserChoices({
    preventSave: !saveUserChoices,
  });

  const handleDisconnect = React.useCallback(async () => {
    if (room) {
      await room.disconnect();
    }
  }, [room]);

  const handleAudioDeviceChange = React.useCallback(
    async (deviceId: string) => {
      try {
        console.log('Changing audio device to:', deviceId);
        
        // Save the device preference
        saveAudioInputDeviceId(deviceId ?? 'default');
        
        // If we have an active microphone track, restart it with the new device
        const micPublication = localParticipant.getTrackPublication(Track.Source.Microphone);
        if (microphoneToggle.enabled && micPublication) {
          console.log('Restarting microphone track with new device');
          // Stop the current track
          await microphoneToggle.toggle(false);
          // Wait a bit for the track to fully stop
          await new Promise(resolve => setTimeout(resolve, 100));
          // Start with new device
          await microphoneToggle.toggle(true);
        }
      } catch (error) {
        console.error('Failed to change audio device:', error);
        props.onDeviceError?.({ source: Track.Source.Microphone, error: error as Error });
      }
    },
    [saveAudioInputDeviceId, microphoneToggle, localParticipant, props]
  );

  const handleVideoDeviceChange = React.useCallback(
    async (deviceId: string) => {
      try {
        console.log('Changing video device to:', deviceId);
        
        // Save the device preference
        saveVideoInputDeviceId(deviceId ?? 'default');
        
        // If we have an active camera track, restart it with the new device
        const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraToggle.enabled && cameraPublication) {
          console.log('Restarting camera track with new device');
          // Stop the current track
          await cameraToggle.toggle(false);
          // Wait a bit for the track to fully stop
          await new Promise(resolve => setTimeout(resolve, 100));
          // Start with new device
          await cameraToggle.toggle(true);
        }
      } catch (error) {
        console.error('Failed to change video device:', error);
        props.onDeviceError?.({ source: Track.Source.Camera, error: error as Error });
      }
    },
    [saveVideoInputDeviceId, cameraToggle, localParticipant, props]
  );

  const handleToggleCamera = React.useCallback(
    async (enabled?: boolean) => {
      try {
        if (screenShareToggle.enabled) {
          console.log('Stopping screen share before enabling camera');
          await screenShareToggle.toggle(false);
          // Wait for screen share to stop
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await cameraToggle.toggle(enabled);
        // persist video input enabled preference
        saveVideoInputEnabled(enabled ?? !cameraToggle.enabled);
      } catch (error) {
        console.error('Failed to toggle camera:', error);
        props.onDeviceError?.({ source: Track.Source.Camera, error: error as Error });
      }
    },
    [cameraToggle, screenShareToggle, saveVideoInputEnabled, props]
  );

  const handleToggleMicrophone = React.useCallback(
    async (enabled?: boolean) => {
      try {
        await microphoneToggle.toggle(enabled);
        // persist audio input enabled preference
        saveAudioInputEnabled(enabled ?? !microphoneToggle.enabled);
      } catch (error) {
        console.error('Failed to toggle microphone:', error);
        props.onDeviceError?.({ source: Track.Source.Microphone, error: error as Error });
      }
    },
    [microphoneToggle, saveAudioInputEnabled, props]
  );

  const handleToggleScreenShare = React.useCallback(
    async (enabled?: boolean) => {
      try {
        if (cameraToggle.enabled) {
          console.log('Stopping camera before enabling screen share');
          await cameraToggle.toggle(false);
          // Wait for camera to stop
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await screenShareToggle.toggle(enabled);
      } catch (error) {
        console.error('Failed to toggle screen share:', error);
        props.onDeviceError?.({ source: Track.Source.ScreenShare, error: error as Error });
      }
    },
    [screenShareToggle, cameraToggle, props]
  );

  return {
    micTrackRef,
    visibleControls,
    cameraToggle: {
      ...cameraToggle,
      toggle: handleToggleCamera,
    },
    microphoneToggle: {
      ...microphoneToggle,
      toggle: handleToggleMicrophone,
    },
    screenShareToggle: {
      ...screenShareToggle,
      toggle: handleToggleScreenShare,
    },
    handleDisconnect,
    handleAudioDeviceChange,
    handleVideoDeviceChange,
  };
}
