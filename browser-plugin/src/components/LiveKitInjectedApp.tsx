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

    // Add all event listeners
    room.on(RoomEvent.Connected, onConnected)
    room.on(RoomEvent.Disconnected, onDisconnected)
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError)
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)

    return () => {
      console.log('🧹 Cleaning up room event handlers in injected context')
      room.off(RoomEvent.Connected, onConnected)
      room.off(RoomEvent.Disconnected, onDisconnected)
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError)
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged)
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
            await room.localParticipant.setMicrophoneEnabled(true)
            console.log('✅ Microphone enabled successfully')
          } catch (micError) {
            console.error('⚠️ Microphone enable failed:', micError)
            setErrorMessage(`Microphone failed: ${micError.message}`)
          }
          
          console.log('📹 Enabling camera in injected context...')
          try {
            await room.localParticipant.setCameraEnabled(true)
            console.log('✅ Camera enabled successfully')
          } catch (camError) {
            console.error('⚠️ Camera enable failed:', camError)
            // Camera failure is not critical
          }
          
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
      
      setErrorMessage('Media permissions granted! You can now start the session.')
      
    } catch (error) {
      console.error('❌ Media permission failed in injected context:', error)
      setErrorMessage(`Permission failed: ${error.message}`)
    }
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
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎙️</div>
              <div>Click "Permissions" first, then "Start Session"</div>
              <div style={{ fontSize: '12px', marginTop: '8px' }}>
                Running in webpage context for better media access
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
  const cameraTrack = cameraPublication ? {
    source: Track.Source.Camera,
    participant: localParticipant,
    publication: cameraPublication
  } : undefined

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted
  const hasAgentVideo = agentVideoTrack !== undefined

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>Video Streams</div>
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
        
        {/* Local Video */}
        <div style={{ 
          background: '#f3f4f6', 
          borderRadius: '8px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center' 
        }}>
          {isCameraEnabled ? (
            <VideoTrack trackRef={cameraTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#6b7280' }}>
              <div style={{ fontSize: '20px' }}>📹</div>
              <div style={{ fontSize: '10px' }}>You</div>
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
  
  const isMicMuted = micTrack?.publication?.isMuted ?? true
  const isCameraMuted = cameraTrack?.publication?.isMuted ?? true

  return (
    <div style={{ 
      padding: '12px', 
      borderTop: '1px solid #e5e7eb',
      borderBottom: '1px solid #e5e7eb'
    }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>Media Controls</div>
      <div style={{ display: 'flex', gap: '8px' }}>
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
        
        <TrackToggle
          source={Track.Source.Camera}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: isCameraMuted ? '#ef4444' : '#10b981',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {isCameraMuted ? '📹 Cam Off' : '📸 Cam On'}
        </TrackToggle>
      </div>
    </div>
  )
}

function InjectedChatArea() {
  const participants = useRemoteParticipants()
  const { state: agentState } = useVoiceAssistant()
  
  return (
    <div style={{ padding: '12px' }}>
      <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
        Chat & Status
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
        <div style={{ marginTop: '4px', fontSize: '10px' }}>
          Full chat implementation coming soon...
        </div>
      </div>
    </div>
  )
}
