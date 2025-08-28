// LiveKit Injected App - Runs in webpage context for better media permissions
import React, { useEffect, useState, useMemo } from 'react'
import { Room, RoomEvent, Track, DisconnectReason } from 'livekit-client'
import {
  RoomAudioRenderer,
  RoomContext,
  StartAudio,
  useVoiceAssistant,
  useRemoteParticipants,
  TrackToggle,
  BarVisualizer,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  type TrackReference,
} from '@livekit/components-react'
import { generateLiveKitToken } from '../utils/tokenUtils'

export function LiveKitInjectedApp() {
  const room = useMemo(() => {
    console.log('🏠 Creating new Room instance in injected context')
    return new Room()
  }, [])
  
  const [sessionStarted, setSessionStarted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedMicId, setSelectedMicId] = useState<string>('')

  // Room event handlers
  useEffect(() => {
    console.log('🔧 Setting up room event handlers in injected context')
    
    const onConnected = () => {
      console.log('✅ Room.onConnected fired in injected context')
      setConnectionStatus('connected')
    }

    const onDisconnected = (reason?: DisconnectReason) => {
      console.log('🔌 Room.onDisconnected fired with reason:', reason)
      setSessionStarted(false)
      setConnectionStatus('disconnected')
    }

    const onMediaDevicesError = (error: Error) => {
      console.error('📱 Media devices error in injected context:', error)
      setErrorMessage(`Media device error: ${error.message}`)
    }

    const onConnectionStateChanged = (state: string) => {
      console.log('🔄 Connection state changed to:', state)
      if (state === 'connecting') {
        setConnectionStatus('connecting')
      } else if (state === 'connected') {
        setConnectionStatus('connected')
      } else if (state === 'disconnected') {
        setConnectionStatus('disconnected')
      }
    }

    // Listen for end session event from content script
    const onEndSession = () => {
      console.log('🛑 End session event received')
      endSession()
    }

    // Add all event listeners
    room.on(RoomEvent.Connected, onConnected)
    room.on(RoomEvent.Disconnected, onDisconnected)
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError)
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
    document.addEventListener('jmimi-end-session', onEndSession)

    return () => {
      console.log('🧹 Cleaning up room event handlers in injected context')
      room.off(RoomEvent.Connected, onConnected)
      room.off(RoomEvent.Disconnected, onDisconnected)
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
      document.removeEventListener('jmimi-end-session', onEndSession)
    }
  }, [room])

  // Start session function
  const startSession = async () => {
    try {
      console.log('=== INJECTED LIVEKIT CONNECTION ===')
      console.log('🏠 Current room state:', room.state)
      
      // Disconnect if already connected
      if (room.state !== 'disconnected') {
        console.log('🔌 Disconnecting existing connection first...')
        await room.disconnect()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      setConnectionStatus('connecting')
      setErrorMessage(null)
      
      // Generate token
      console.log('🔑 Generating token...')
      const token = await generateLiveKitToken(
        'devkey',
        'secret',
        'injected_room_' + Date.now(),
        'injected_user_' + Date.now(),
        'Injected User'
      )
      console.log('🎫 Token generated:', token.substring(0, 50) + '...')
      
      // Connect to room
      const serverUrl = 'ws://localhost:7880'
      console.log('🌐 Connecting to:', serverUrl)
      
      // Use connection options like the React app
      const connectOptions = {
        publishDefaults: {
          videoCodec: 'vp8' as const,
          videoSimulcast: false,
          audioPreset: {
            maxBitrate: 64000,
          },
        },
        autoSubscribe: true,
      }
      
      console.log('⚙️ Connection options:', connectOptions)
      await room.connect(serverUrl, token, connectOptions)
      console.log('✅ Room connected successfully!')
      
      // Enable media after connection
      setTimeout(async () => {
        if (room.state === 'connected') {
          console.log('🎤 Enabling microphone in injected context...')
          try {
            // First enable microphone
            await room.localParticipant.setMicrophoneEnabled(true)
            
            // Then switch to selected device if available
            if (selectedMicId) {
              console.log('🎤 Switching to selected microphone device:', selectedMicId)
              await room.switchActiveDevice('audioinput', selectedMicId)
            }
            
            console.log('✅ Microphone enabled successfully with device:', selectedMicId || 'default')
          } catch (micError) {
            console.error('⚠️ Microphone enable failed:', micError)
            setErrorMessage(`Microphone failed: ${micError.message}`)
          }
          
          // Do not enable camera automatically - let user choose between camera or screen share
          console.log('📹 Camera and screen share will be controlled by user buttons')
          
          setSessionStarted(true)
          console.log('🎉 Injected session fully started!')
        }
      }, 1000)
      
    } catch (error) {
      console.error('❌ Injected connection failed:', error)
      setErrorMessage(`Connection failed: ${error?.message || error}`)
      setConnectionStatus('error')
    }
  }

  const endSession = () => {
    setSessionStarted(false)
    room.disconnect()
  }

  // Enumerate audio devices
  const enumerateAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      setAudioDevices(audioInputs)
      
      // Set default device if none selected
      if (!selectedMicId && audioInputs.length > 0) {
        setSelectedMicId(audioInputs[0].deviceId)
      }
      
      console.log('🎤 Found audio devices:', audioInputs.map(d => d.label || d.deviceId))
    } catch (error) {
      console.error('❌ Failed to enumerate audio devices:', error)
    }
  }

  // Request media permissions
  const requestPermissions = async () => {
    try {
      console.log('🎥 Requesting media permissions in injected context...')
      
      // Request microphone
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('✅ Microphone permission granted')
      micStream.getTracks().forEach(track => track.stop())
      
      // Request camera
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
      console.log('✅ Camera permission granted')
      camStream.getTracks().forEach(track => track.stop())
      
      // Enumerate devices after getting permissions
      await enumerateAudioDevices()
      
      // Note: Screen sharing permission is requested on-demand when user clicks "Share Screen"
      // This is because getDisplayMedia() must be called in response to user interaction
      
      setErrorMessage('Microphone and camera permissions granted! Use the buttons below to choose camera or screen sharing.')
      
    } catch (error) {
      console.error('❌ Media permission failed in injected context:', error)
      setErrorMessage(`Permission failed: ${error.message}`)
    }
  }

  // Change microphone device
  const changeMicrophoneDevice = async (deviceId: string) => {
    if (room.state === 'connected' && sessionStarted) {
      try {
        console.log('🎤 Changing microphone to device:', deviceId)
        await room.switchActiveDevice('audioinput', deviceId)
        console.log('✅ Microphone device changed successfully')
      } catch (error) {
        console.error('❌ Failed to change microphone device:', error)
        setErrorMessage(`Failed to change microphone: ${error.message}`)
      }
    }
    setSelectedMicId(deviceId)
  }

  const isConnected = connectionStatus === 'connected'

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px'
    }}>
      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        
        {/* Header */}
        <div style={{ 
          padding: '12px', 
          borderBottom: '1px solid #e5e7eb', 
          background: '#f9fafb' 
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: connectionStatus === 'connected' ? '#10b981' :
                           connectionStatus === 'connecting' ? '#f59e0b' :
                           connectionStatus === 'error' ? '#ef4444' : '#6b7280'
              }} />
              <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                {connectionStatus}
              </span>
            </div>
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{ 
              padding: '8px', 
              background: errorMessage.includes('granted') ? '#dcfce7' : '#fee2e2',
              color: errorMessage.includes('granted') ? '#166534' : '#991b1b',
              borderRadius: '6px', 
              fontSize: '12px',
              marginBottom: '8px'
            }}>
              {errorMessage}
            </div>
          )}
          
          {/* Controls */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={requestPermissions}
              style={{
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              📱 Permissions
            </button>
            
            {/* Microphone Selection */}
            {audioDevices.length > 0 && (
              <select
                value={selectedMicId}
                onChange={(e) => changeMicrophoneDevice(e.target.value)}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  background: 'white',
                  cursor: 'pointer',
                  maxWidth: '150px'
                }}
                title="Select microphone device"
              >
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    🎤 {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                  </option>
                ))}
              </select>
            )}
            
            {!sessionStarted ? (
              <button
                onClick={startSession}
                disabled={connectionStatus === 'connecting'}
                style={{
                  background: connectionStatus === 'connecting' ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: connectionStatus === 'connecting' ? 'not-allowed' : 'pointer'
                }}
              >
                {connectionStatus === 'connecting' ? 'Connecting...' : '🚀 Start Session'}
              </button>
            ) : (
              <button
                onClick={endSession}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                🛑 End Session
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sessionStarted && isConnected && (
            <>
              <InjectedVideoArea />
              <InjectedMediaControls />
              <InjectedChatArea />
            </>
          )}
          
          {!sessionStarted && (
            <div style={{ 
              padding: '20px', 
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎙️</div>
              <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Welcome to JMimi</div>
              <div style={{ fontSize: '14px', marginBottom: '16px' }}>Your AI Voice Assistant</div>
              <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                1. Click "📱 Permissions" to grant access<br/>
                2. Click "🚀 Start Session" to begin<br/>
                3. Choose camera or screen sharing as needed
              </div>
            </div>
          )}
        </div>
      </RoomContext.Provider>
    </div>
  )
}

// Simplified components for the injected UI
function InjectedVideoArea() {
  const { state: agentState, videoTrack: agentVideoTrack } = useVoiceAssistant()
  const { localParticipant } = useLocalParticipant()
  
  const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera)
  const screenPublication = localParticipant.getTrackPublication(Track.Source.ScreenShare)
  
  const cameraTrack = cameraPublication ? {
    source: Track.Source.Camera,
    participant: localParticipant,
    publication: cameraPublication
  } : undefined

  const screenTrack = screenPublication ? {
    source: Track.Source.ScreenShare,
    participant: localParticipant,
    publication: screenPublication
  } : undefined

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted
  const isScreenSharing = screenTrack && !screenTrack.publication.isMuted
  const hasAgentVideo = agentVideoTrack !== undefined
  const hasLocalVideo = isCameraEnabled || isScreenSharing

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
        Video Streams 
        {isScreenSharing && ' (Screen Sharing)'}
        {isCameraEnabled && ' (Camera)'}
        {!hasLocalVideo && ' (Audio Only)'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '200px' }}>
        {/* Agent Video */}
        <div style={{ 
          background: '#f3f4f6', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative'
        }}>
          {hasAgentVideo ? (
            <VideoTrack trackRef={agentVideoTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '20px' }}>🤖</div>
              <div style={{ fontSize: '10px' }}>Agent ({agentState})</div>
            </div>
          )}
        </div>
        
        {/* Local Video or Placeholder */}
        <div style={{ 
          background: '#f3f4f6', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative'
        }}>
          {isScreenSharing ? (
            <>
              <VideoTrack trackRef={screenTrack} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{ 
                position: 'absolute', 
                top: '4px', 
                left: '4px', 
                background: 'rgba(0,0,0,0.7)', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '10px' 
              }}>
                🖥️ Screen
              </div>
            </>
          ) : isCameraEnabled ? (
            <>
              <VideoTrack trackRef={cameraTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ 
                position: 'absolute', 
                top: '4px', 
                left: '4px', 
                background: 'rgba(0,0,0,0.7)', 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '10px' 
              }}>
                📹 Camera
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '20px' }}>🔇</div>
              <div style={{ fontSize: '10px' }}>Audio Only</div>
              <div style={{ fontSize: '9px', marginTop: '4px', color: '#9ca3af' }}>
                Use buttons below to share camera or screen
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InjectedMediaControls() {
  const micTrack = useTracks([Track.Source.Microphone])[0]
  const cameraTrack = useTracks([Track.Source.Camera])[0]
  const screenTrack = useTracks([Track.Source.ScreenShare])[0]
  const { localParticipant } = useLocalParticipant()
  
  const isMicMuted = micTrack?.publication?.isMuted ?? true
  const isCameraEnabled = cameraTrack && !cameraTrack.publication?.isMuted
  const isScreenSharing = screenTrack && !screenTrack.publication?.isMuted

  const toggleCamera = async () => {
    try {
      if (isCameraEnabled) {
        // Turn off camera
        await localParticipant.setCameraEnabled(false)
        console.log('✅ Camera disabled')
      } else {
        // Turn off screen share first if it's active
        if (isScreenSharing) {
          await localParticipant.setScreenShareEnabled(false)
          console.log('✅ Screen sharing stopped to enable camera')
        }
        // Turn on camera
        await localParticipant.setCameraEnabled(true)
        console.log('✅ Camera enabled')
      }
    } catch (error) {
      console.error('❌ Camera toggle error:', error)
    }
  }

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        await localParticipant.setScreenShareEnabled(false)
        console.log('✅ Screen sharing stopped')
      } else {
        // Turn off camera first if it's active
        if (isCameraEnabled) {
          await localParticipant.setCameraEnabled(false)
          console.log('✅ Camera stopped to enable screen sharing')
        }
        // Start screen sharing
        await localParticipant.setScreenShareEnabled(true)
        console.log('✅ Screen sharing started')
      }
    } catch (error) {
      console.error('❌ Screen sharing error:', error)
    }
  }

  return (
    <div style={{ 
      padding: '12px', 
      borderTop: '1px solid #e5e7eb',
      borderBottom: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>Media Controls</div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <TrackToggle
          source={Track.Source.Microphone}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isMicMuted ? '#ef4444' : '#10b981',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {isMicMuted ? '🔇 Mic Off' : '🎤 Mic On'}
        </TrackToggle>
        
        <button
          onClick={toggleCamera}
          disabled={isScreenSharing}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isScreenSharing ? '#9ca3af' : (isCameraEnabled ? '#10b981' : '#6b7280'),
            color: 'white',
            fontSize: '12px',
            cursor: isScreenSharing ? 'not-allowed' : 'pointer',
            opacity: isScreenSharing ? 0.6 : 1
          }}
        >
          {isCameraEnabled ? '� Cam On' : '� Camera'}
        </button>

        <button
          onClick={toggleScreenShare}
          disabled={isCameraEnabled}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isCameraEnabled ? '#9ca3af' : (isScreenSharing ? '#10b981' : '#6b7280'),
            color: 'white',
            fontSize: '12px',
            cursor: isCameraEnabled ? 'not-allowed' : 'pointer',
            opacity: isCameraEnabled ? 0.6 : 1
          }}
        >
          {isScreenSharing ? '🖥️ Stop Share' : '📱 Share Screen'}
        </button>
      </div>
      
      {/* Helper text */}
      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
        {(isCameraEnabled || isScreenSharing) 
          ? `${isCameraEnabled ? 'Camera' : 'Screen sharing'} active. Turn off to use the other option.`
          : 'Choose camera or screen sharing (not both). Change microphone in header controls.'
        }
      </div>
    </div>
  )
}

function InjectedChatArea() {
  const participants = useRemoteParticipants()
  const { state: agentState } = useVoiceAssistant()
  const screenTrack = useTracks([Track.Source.ScreenShare])[0]
  const cameraTrack = useTracks([Track.Source.Camera])[0]
  const isScreenSharing = screenTrack && !screenTrack.publication?.isMuted
  const isCameraEnabled = cameraTrack && !cameraTrack.publication?.isMuted
  
  const getVideoModeStatus = () => {
    if (isScreenSharing) return '🖥️ Screen Sharing Mode'
    if (isCameraEnabled) return '📹 Camera Mode'
    return '🔊 Audio Only Mode'
  }
  
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
        Session Status
      </div>
      <div style={{ 
        background: '#f9fafb', 
        padding: '8px', 
        borderRadius: '6px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        <div>Participants: {participants.length}</div>
        <div>Agent State: {agentState}</div>
        <div style={{ 
          color: isScreenSharing ? '#10b981' : isCameraEnabled ? '#3b82f6' : '#6b7280', 
          fontWeight: 500 
        }}>
          {getVideoModeStatus()}
        </div>
        <div style={{ marginTop: '4px', fontSize: '10px' }}>
          Full chat implementation coming soon...
        </div>
      </div>
    </div>
  )
}
