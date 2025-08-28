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
    <div className="h-full flex flex-col bg-gray-50 font-sans text-sm">
      <RoomContext.Provider value={room}>
        <RoomAudioRenderer />
        <StartAudio label="Start Audio" />
        
        {/* Header Section - Microphone Selection */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                connectionStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="font-medium text-gray-700 capitalize">
                {connectionStatus}
              </span>
              {connectionStatus === 'connecting' && (
                <Loader className="w-4 h-4 animate-spin text-blue-500" />
              )}
              {connectionStatus === 'connected' && (
                <Wifi className="w-4 h-4 text-green-500" />
              )}
              {connectionStatus === 'error' && (
                <WifiOff className="w-4 h-4 text-red-500" />
              )}
            </div>
          </div>
          
          {/* Error Message */}
          {errorMessage && (
            <div className={`p-3 rounded-lg mb-3 text-sm border ${
              errorMessage.includes('granted') 
                ? 'bg-green-50 text-green-800 border-green-200' 
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                {errorMessage.includes('granted') ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
          
          {/* Controls */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={requestPermissions}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
              >
                <Settings className="w-4 h-4" />
                Grant Permissions
              </button>
              
              {!sessionStarted ? (
                <button
                  onClick={startSession}
                  disabled={connectionStatus === 'connecting'}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                    connectionStatus === 'connecting'
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      Start Session
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={endSession}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Session
                </button>
              )}
            </div>
            
            {/* Microphone Selector */}
            {audioDevices.length > 0 && (
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-gray-600" />
                <select
                  value={selectedMicId}
                  onChange={(e) => changeMicrophoneDevice(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
        <div className="flex-1 overflow-auto">
          {sessionStarted && isConnected ? (
            <div className="h-full flex flex-col">
              <InjectedVideoArea />
              <InjectedMediaControls />
              <InjectedAgentStatus />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Volume2 className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to JMimi</h3>
                <p className="text-gray-600 mb-6">Your AI Voice Assistant</p>
                <div className="text-sm text-gray-500 space-y-2">
                  <div className="flex items-center gap-2 justify-center">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                    <span>Grant microphone and camera permissions</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                    <span>Select your preferred microphone</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
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
    <div className="flex-1 p-4">
      {/* Video Grid */}
      <div className="grid grid-cols-2 gap-4 h-64 mb-4">
        {/* Agent Video */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg">
          {hasAgentVideo ? (
            <VideoTrack trackRef={agentVideoTrack} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white">
              <Bot className="w-12 h-12 mb-2 text-blue-400" />
              <div className="text-sm font-medium">AI Agent</div>
              <div className="text-xs text-gray-400 capitalize mt-1">{agentState}</div>
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
            <Bot className="w-3 h-3" />
            Agent
          </div>
        </div>
        
        {/* Local Video */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg">
          {isScreenSharing ? (
            <>
              <VideoTrack trackRef={screenTrack} className="w-full h-full object-contain" />
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
                <Monitor className="w-3 h-3" />
                Screen
              </div>
            </>
          ) : isCameraEnabled ? (
            <>
              <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3 bg-black bg-opacity-50 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
                <Video className="w-3 h-3" />
                Camera
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white">
              <User className="w-12 h-12 mb-2 text-gray-400" />
              <div className="text-sm font-medium">You</div>
              <div className="text-xs text-gray-400 text-center mt-1">
                Audio Only
                <br />
                <span className="text-gray-500">Use controls below to share video</span>
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
    <div className="bg-white border-t border-gray-200 p-4">
      {/* Media Controls Bar */}
      <div className="flex items-center justify-center gap-3">
        {/* Microphone */}
        <TrackToggle
          source={Track.Source.Microphone}
          className={`p-3 rounded-full transition-all duration-200 shadow-lg ${
            isMicMuted 
              ? 'bg-red-500 hover:bg-red-600 text-white' 
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </TrackToggle>
        
        {/* Camera */}
        <button
          onClick={toggleCamera}
          disabled={isScreenSharing}
          className={`p-3 rounded-full transition-all duration-200 ${
            isScreenSharing 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : isCameraEnabled 
                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:scale-105' 
                : 'bg-gray-500 hover:bg-gray-600 text-white shadow-lg hover:scale-105'
          }`}
          title={isScreenSharing ? 'Stop screen sharing to use camera' : isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Screen Share */}
        <button
          onClick={toggleScreenShare}
          disabled={isCameraEnabled}
          className={`p-3 rounded-full transition-all duration-200 ${
            isCameraEnabled 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : isScreenSharing 
                ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:scale-105' 
                : 'bg-gray-500 hover:bg-gray-600 text-white shadow-lg hover:scale-105'
          }`}
          title={isCameraEnabled ? 'Turn off camera to share screen' : isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
        >
          {isScreenSharing ? <Monitor className="w-5 h-5" /> : <MonitorOff className="w-5 h-5" />}
        </button>
      </div>
      
      {/* Status Text */}
      <div className="text-center mt-3">
        <p className="text-xs text-gray-600">
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
  
  const getAgentStatusColor = (state: string) => {
    switch (state) {
      case 'listening': return 'text-green-600 bg-green-50 border-green-200'
      case 'thinking': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'speaking': return 'text-purple-600 bg-purple-50 border-purple-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }
  
  const getAgentStatusIcon = (state: string) => {
    switch (state) {
      case 'listening': return <Mic className="w-4 h-4" />
      case 'thinking': return <Loader className="w-4 h-4 animate-spin" />
      case 'speaking': return <Volume2 className="w-4 h-4" />
      default: return <Bot className="w-4 h-4" />
    }
  }
  
  return (
    <div className="bg-gray-50 border-t border-gray-200 p-4">
      <div className="space-y-3">
        {/* Agent Status */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${getAgentStatusColor(agentState)}`}>
          <div className="flex items-center gap-2">
            {getAgentStatusIcon(agentState)}
            <span className="font-medium text-sm">AI Agent</span>
          </div>
          <div className="flex-1">
            <span className="text-sm capitalize font-medium">{agentState}</span>
          </div>
        </div>
        
        {/* Session Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
              <User className="w-3 h-3" />
              <span>Participants</span>
            </div>
            <div className="font-semibold text-lg text-gray-800">{participants.length + 1}</div>
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 text-gray-600 text-xs mb-1">
              {isScreenSharing ? <Monitor className="w-3 h-3" /> : 
               isCameraEnabled ? <Video className="w-3 h-3" /> : 
               <Volume2 className="w-3 h-3" />}
              <span>Mode</span>
            </div>
            <div className="font-semibold text-sm text-gray-800">
              {isScreenSharing ? 'Screen' : isCameraEnabled ? 'Video' : 'Audio'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
