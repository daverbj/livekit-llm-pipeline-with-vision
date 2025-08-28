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
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  MonitorOff, 
  Phone, 
  PhoneOff, 
  Settings, 
  Wifi,
  WifiOff,
  Loader,
  User,
  Bot,
  AlertCircle,
  CheckCircle,
  Volume2
} from 'lucide-react'
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
      background: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px'
    }}>
      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        
        {/* Header Section - Microphone Selection */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          padding: '16px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: connectionStatus === 'connected' ? '#10b981' :
                           connectionStatus === 'connecting' ? '#f59e0b' :
                           connectionStatus === 'error' ? '#ef4444' : '#9ca3af'
              }} />
              <span style={{ 
                fontWeight: 500, 
                color: '#374151',
                textTransform: 'capitalize'
              }}>
                {connectionStatus}
              </span>
              {connectionStatus === 'connecting' && (
                <Loader style={{ width: '16px', height: '16px', color: '#3b82f6' }} className="animate-spin" />
              )}
              {connectionStatus === 'connected' && (
                <Wifi style={{ width: '16px', height: '16px', color: '#10b981' }} />
              )}
              {connectionStatus === 'error' && (
                <WifiOff style={{ width: '16px', height: '16px', color: '#ef4444' }} />
              )}
            </div>
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px',
              fontSize: '13px',
              background: errorMessage.includes('granted') ? '#f0fdf4' : '#fef2f2',
              color: errorMessage.includes('granted') ? '#166534' : '#991b1b',
              border: `1px solid ${errorMessage.includes('granted') ? '#bbf7d0' : '#fecaca'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {errorMessage.includes('granted') ? (
                  <CheckCircle style={{ width: '16px', height: '16px' }} />
                ) : (
                  <AlertCircle style={{ width: '16px', height: '16px' }} />
                )}
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
          
          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={requestPermissions}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#1d4ed8'}
                onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#2563eb'}
              >
                <Settings style={{ width: '16px', height: '16px' }} />
                Grant Permissions
              </button>
              
              {!sessionStarted ? (
                <button
                  onClick={startSession}
                  disabled={connectionStatus === 'connecting'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: connectionStatus === 'connecting' ? '#9ca3af' : '#059669',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: connectionStatus === 'connecting' ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (connectionStatus !== 'connecting') {
                      (e.target as HTMLButtonElement).style.background = '#047857'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (connectionStatus !== 'connecting') {
                      (e.target as HTMLButtonElement).style.background = '#059669'
                    }
                  }}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Loader style={{ width: '16px', height: '16px' }} className="animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Phone style={{ width: '16px', height: '16px' }} />
                      Start Session
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={endSession}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => (e.target as HTMLButtonElement).style.background = '#b91c1c'}
                  onMouseLeave={(e) => (e.target as HTMLButtonElement).style.background = '#dc2626'}
                >
                  <PhoneOff style={{ width: '16px', height: '16px' }} />
                  End Session
                </button>
              )}
            </div>
            
            {/* Microphone Selector */}
            {audioDevices.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mic style={{ width: '16px', height: '16px', color: '#6b7280' }} />
                <select
                  value={selectedMicId}
                  onChange={(e) => changeMicrophoneDevice(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '13px',
                    background: 'white',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {sessionStarted && isConnected ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <InjectedVideoArea />
              <InjectedMediaControls />
              <InjectedAgentStatus />
            </div>
          ) : (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '32px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  background: '#dbeafe',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Volume2 style={{ width: '32px', height: '32px', color: '#2563eb' }} />
                </div>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  color: '#1f2937', 
                  marginBottom: '8px' 
                }}>
                  Welcome to JMimi
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '24px' }}>
                  Your AI Voice Assistant
                </p>
                <div style={{ fontSize: '13px', color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}>1</span>
                    <span>Grant microphone and camera permissions</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}>2</span>
                    <span>Select your preferred microphone</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <span style={{
                      width: '20px',
                      height: '20px',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px'
                    }}>3</span>
                    <span>Start your voice session</span>
                  </div>
                </div>
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

  return (
    <div style={{ flex: 1, padding: '16px' }}>
      {/* Video Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        height: '256px',
        marginBottom: '16px'
      }}>
        {/* Agent Video */}
        <div style={{
          position: 'relative',
          background: '#1f2937',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          {hasAgentVideo ? (
            <VideoTrack trackRef={agentVideoTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <Bot style={{ width: '48px', height: '48px', marginBottom: '8px', color: '#60a5fa' }} />
              <div style={{ fontSize: '14px', fontWeight: 500 }}>AI Agent</div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                textTransform: 'capitalize',
                marginTop: '4px'
              }}>
                {agentState}
              </div>
            </div>
          )}
          <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <Bot style={{ width: '12px', height: '12px' }} />
            Agent
          </div>
        </div>
        
        {/* Local Video */}
        <div style={{
          position: 'relative',
          background: '#1f2937',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
        }}>
          {isScreenSharing ? (
            <>
              <VideoTrack trackRef={screenTrack} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Monitor style={{ width: '12px', height: '12px' }} />
                Screen
              </div>
            </>
          ) : isCameraEnabled ? (
            <>
              <VideoTrack trackRef={cameraTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                background: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Video style={{ width: '12px', height: '12px' }} />
                Camera
              </div>
            </>
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <User style={{ width: '48px', height: '48px', marginBottom: '8px', color: '#9ca3af' }} />
              <div style={{ fontSize: '14px', fontWeight: 500 }}>You</div>
              <div style={{
                fontSize: '12px',
                color: '#9ca3af',
                textAlign: 'center',
                marginTop: '4px'
              }}>
                Audio Only
                <br />
                <span style={{ color: '#6b7280' }}>Use controls below to share video</span>
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
        await localParticipant.setCameraEnabled(false)
        console.log('✅ Camera disabled')
      } else {
        if (isScreenSharing) {
          await localParticipant.setScreenShareEnabled(false)
          console.log('✅ Screen sharing stopped to enable camera')
        }
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
        await localParticipant.setScreenShareEnabled(false)
        console.log('✅ Screen sharing stopped')
      } else {
        if (isCameraEnabled) {
          await localParticipant.setCameraEnabled(false)
          console.log('✅ Camera stopped to enable screen sharing')
        }
        await localParticipant.setScreenShareEnabled(true)
        console.log('✅ Screen sharing started')
      }
    } catch (error) {
      console.error('❌ Screen sharing error:', error)
    }
  }

  return (
    <div style={{
      background: 'white',
      borderTop: '1px solid #e2e8f0',
      padding: '16px'
    }}>
      {/* Media Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        {/* Microphone */}
        <TrackToggle
          source={Track.Source.Microphone}
          style={{
            padding: '12px',
            borderRadius: '50%',
            border: 'none',
            background: isMicMuted ? '#dc2626' : '#059669',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isMicMuted ? <MicOff style={{ width: '20px', height: '20px' }} /> : <Mic style={{ width: '20px', height: '20px' }} />}
        </TrackToggle>
        
        {/* Camera */}
        <button
          onClick={toggleCamera}
          disabled={isScreenSharing}
          style={{
            padding: '12px',
            borderRadius: '50%',
            border: 'none',
            background: isScreenSharing ? '#d1d5db' : (isCameraEnabled ? '#2563eb' : '#6b7280'),
            color: 'white',
            cursor: isScreenSharing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: isScreenSharing ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={isScreenSharing ? 'Stop screen sharing to use camera' : isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
          onMouseEnter={(e) => {
            if (!isScreenSharing) {
              (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isScreenSharing) {
              (e.target as HTMLButtonElement).style.transform = 'scale(1)';
            }
          }}
        >
          {isCameraEnabled ? <Video style={{ width: '20px', height: '20px' }} /> : <VideoOff style={{ width: '20px', height: '20px' }} />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          disabled={isCameraEnabled}
          style={{
            padding: '12px',
            borderRadius: '50%',
            border: 'none',
            background: isCameraEnabled ? '#d1d5db' : (isScreenSharing ? '#7c3aed' : '#6b7280'),
            color: 'white',
            cursor: isCameraEnabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            boxShadow: isCameraEnabled ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={isCameraEnabled ? 'Turn off camera to share screen' : isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          onMouseEnter={(e) => {
            if (!isCameraEnabled) {
              (e.target as HTMLButtonElement).style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isCameraEnabled) {
              (e.target as HTMLButtonElement).style.transform = 'scale(1)';
            }
          }}
        >
          {isScreenSharing ? <Monitor style={{ width: '20px', height: '20px' }} /> : <MonitorOff style={{ width: '20px', height: '20px' }} />}
        </button>
      </div>
      
      {/* Status Text */}
      <div style={{ textAlign: 'center', marginTop: '12px' }}>
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          {(isCameraEnabled || isScreenSharing) 
            ? `${isCameraEnabled ? 'Camera' : 'Screen sharing'} active • Turn off to use the other option`
            : 'Audio only • Choose camera or screen sharing above'
          }
        </p>
      </div>
    </div>
  )
}

function InjectedAgentStatus() {
  const participants = useRemoteParticipants()
  const { state: agentState } = useVoiceAssistant()
  const screenTrack = useTracks([Track.Source.ScreenShare])[0]
  const cameraTrack = useTracks([Track.Source.Camera])[0]
  const isScreenSharing = screenTrack && !screenTrack.publication?.isMuted
  const isCameraEnabled = cameraTrack && !cameraTrack.publication?.isMuted
  
  const getAgentStatusStyles = (state: string) => {
    switch (state) {
      case 'listening': 
        return {
          color: '#059669',
          background: '#f0fdf4',
          borderColor: '#bbf7d0'
        }
      case 'thinking': 
        return {
          color: '#2563eb',
          background: '#eff6ff',
          borderColor: '#bfdbfe'
        }
      case 'speaking': 
        return {
          color: '#7c3aed',
          background: '#f5f3ff',
          borderColor: '#c4b5fd'
        }
      default: 
        return {
          color: '#6b7280',
          background: '#f9fafb',
          borderColor: '#e5e7eb'
        }
    }
  }
  
  const getAgentStatusIcon = (state: string) => {
    switch (state) {
      case 'listening': return <Mic style={{ width: '16px', height: '16px' }} />
      case 'thinking': return <Loader style={{ width: '16px', height: '16px' }} className="animate-spin" />
      case 'speaking': return <Volume2 style={{ width: '16px', height: '16px' }} />
      default: return <Bot style={{ width: '16px', height: '16px' }} />
    }
  }

  const statusStyles = getAgentStatusStyles(agentState)
  
  return (
    <div style={{
      background: '#f8fafc',
      borderTop: '1px solid #e2e8f0',
      padding: '16px'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Agent Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px',
          borderRadius: '8px',
          border: `1px solid ${statusStyles.borderColor}`,
          background: statusStyles.background,
          color: statusStyles.color
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getAgentStatusIcon(agentState)}
            <span style={{ fontWeight: 500, fontSize: '14px' }}>AI Agent</span>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: '14px',
              textTransform: 'capitalize',
              fontWeight: 500
            }}>
              {agentState}
            </span>
          </div>
        </div>
        
        {/* Session Info */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px'
        }}>
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6b7280',
              fontSize: '12px',
              marginBottom: '4px'
            }}>
              <User style={{ width: '12px', height: '12px' }} />
              <span>Participants</span>
            </div>
            <div style={{
              fontWeight: 600,
              fontSize: '18px',
              color: '#1f2937'
            }}>
              {participants.length + 1}
            </div>
          </div>
          
          <div style={{
            background: 'white',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#6b7280',
              fontSize: '12px',
              marginBottom: '4px'
            }}>
              {isScreenSharing ? <Monitor style={{ width: '12px', height: '12px' }} /> : 
               isCameraEnabled ? <Video style={{ width: '12px', height: '12px' }} /> : 
               <Volume2 style={{ width: '12px', height: '12px' }} />}
              <span>Mode</span>
            </div>
            <div style={{
              fontWeight: 600,
              fontSize: '14px',
              color: '#1f2937'
            }}>
              {isScreenSharing ? 'Screen' : isCameraEnabled ? 'Video' : 'Audio'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
