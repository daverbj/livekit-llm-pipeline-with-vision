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
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false)
  const [showMicModal, setShowMicModal] = useState<boolean>(false)

  // Room event handlers
  useEffect(() => {
    console.log('🔧 Setting up room event handlers in injected context')
    
    // Check for existing permissions on mount
    const checkExistingPermissions = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasDeviceLabels = devices.some(device => device.label && device.label.length > 0)
        
        if (hasDeviceLabels) {
          console.log('✅ Permissions already granted - device labels available')
          setPermissionsGranted(true)
          await enumerateAudioDevices()
        } else {
          console.log('⚠️ Permissions not yet granted - device labels empty')
        }
      } catch (error) {
        console.log('❌ Error checking permissions:', error)
      }
    }
    
    checkExistingPermissions()
    
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
      
      // Check if we have device labels (indicates permissions granted)
      const hasDeviceLabels = audioInputs.some(device => device.label && device.label.length > 0)
      if (hasDeviceLabels) {
        setPermissionsGranted(true)
      }
      
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
      
      setPermissionsGranted(true)
      
      // Note: Screen sharing permission is requested on-demand when user clicks "Share Screen"
      // This is because getDisplayMedia() must be called in response to user interaction
      
      setErrorMessage('Microphone and camera permissions granted!')
      
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
    setShowMicModal(false) // Close modal after selection
  }

  // Get selected microphone name
  const getSelectedMicName = () => {
    const selectedDevice = audioDevices.find(device => device.deviceId === selectedMicId)
    return selectedDevice?.label || 'Default Microphone'
  }

  const isConnected = connectionStatus === 'connected'

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 font-sans text-sm relative overflow-hidden">
      {/* Sophisticated Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.1),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.08),transparent_50%)]"></div>
      <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0deg,rgba(59,130,246,0.03)_60deg,transparent_120deg,rgba(168,85,247,0.03)_240deg,transparent_300deg)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_49%,rgba(255,255,255,0.01)_50%,transparent_51%)] bg-[length:60px_60px]"></div>
      
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 backdrop-blur-3xl bg-gradient-to-b from-white/5 to-white/[0.02]"></div>
      
      <div className="relative z-10 h-full flex flex-col text-white">
        <RoomContext.Provider value={room}>
          <RoomAudioRenderer />
          <StartAudio label="Start Audio" />
        
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border-b border-white/10 shadow-xl">
          <div className="px-4 py-3">
            {/* Compact Brand & Status Row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Volume2 className="w-3 h-3 text-white" />
                  </div>
                  <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${
                    connectionStatus === 'connected' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40' :
                    connectionStatus === 'connecting' ? 'bg-amber-500 shadow-lg shadow-amber-500/40' :
                    connectionStatus === 'error' ? 'bg-red-500 shadow-lg shadow-red-500/40' : 'bg-slate-500'
                  }`}></div>
                  {connectionStatus === 'connected' && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-30" />
                  )}
                </div>
                <div>
                  <h1 className="text-base font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                    JMimi AI
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">
                      {connectionStatus === 'connected' ? 'Connected' :
                       connectionStatus === 'connecting' ? 'Connecting...' :
                       connectionStatus === 'error' ? 'Error' : 'Disconnected'}
                    </span>
                    {connectionStatus === 'connecting' && (
                      <Loader className="w-3 h-3 animate-spin text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400 font-medium">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="text-xs text-slate-500">
                  {sessionStarted ? 'Active' : 'Ready'}
                </div>
              </div>
            </div>
            
            {/* Status Messages */}
            {errorMessage && (
              <div className={`p-2 rounded-lg mb-2 border backdrop-blur-sm transition-all duration-500 ${
                errorMessage.includes('granted') 
                  ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/30' 
                  : 'bg-gradient-to-r from-red-500/20 to-red-600/10 text-red-300 border-red-500/30'
              }`}>
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {errorMessage.includes('granted') ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium leading-relaxed text-xs">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Microphone Selector - Always visible when devices available */}
            {audioDevices.length > 0 && (
              <div className="mb-2">
                <div className="text-xs text-slate-400 font-medium mb-1">Microphone</div>
                <button
                  onClick={() => setShowMicModal(true)}
                  className="group flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg transition-all duration-300 hover:shadow-lg w-full"
                  title="Select microphone device"
                >
                  <Mic className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-white truncate flex-1 text-left">
                    {getSelectedMicName()}
                  </span>
                  <Settings className="w-4 h-4 text-slate-400 group-hover:text-white group-hover:rotate-90 transition-all duration-300 flex-shrink-0" />
                </button>
              </div>
            )}

            
            {/* Compact Action Controls - Only Permissions */}
            {!permissionsGranted && (
              <div className="mb-2">
                <button
                  onClick={requestPermissions}
                  className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white px-3 py-2 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] font-medium border border-blue-500/20 w-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative flex items-center justify-center gap-1.5">
                    <Settings className="w-3 h-3 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="text-xs">Grant Permissions</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {sessionStarted && isConnected ? (
            <div className="h-full flex flex-col">
              <InjectedVideoArea />
              <InjectedMediaControls 
                audioDevices={audioDevices}
                setShowMicModal={setShowMicModal}
              />
              <InjectedAgentStatus />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                {/* Hero Logo */}
                <div className="relative mb-6">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 transform rotate-3 hover:rotate-0 transition-all duration-500">
                    <Volume2 className="w-10 h-10 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center shadow-xl border-2 border-slate-900">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  </div>
                  <div className="absolute -bottom-2 -left-2 w-5 h-5 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full shadow-lg animate-bounce" style={{ animationDelay: '1s' }}></div>
                </div>
                
                {/* Welcome Message */}
                <div className="mb-6">
                  <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                    Welcome to JMimi AI
                  </h1>
                  <p className="text-slate-300 text-base font-medium leading-relaxed mb-1">
                    Your Professional AI Voice Assistant
                  </p>
                  <p className="text-slate-400 text-xs">
                    Experience seamless voice interactions with advanced AI technology
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Bar - Start/End Session */}
        <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border-t border-white/10 shadow-2xl">
          <div className="px-4 py-3">
            {!sessionStarted ? (
              <button
                onClick={startSession}
                disabled={connectionStatus === 'connecting'}
                className={`group relative overflow-hidden px-4 py-3 rounded-xl transition-all duration-300 font-semibold border text-sm w-full ${
                  connectionStatus === 'connecting'
                    ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed shadow-lg border-slate-600/30'
                    : 'bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border-emerald-500/20'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  {connectionStatus === 'connecting' ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                      <span>Start Session</span>
                    </>
                  )}
                </div>
              </button>
            ) : (
              <button
                onClick={endSession}
                className="group relative overflow-hidden bg-gradient-to-r from-red-600 to-pink-700 hover:from-red-700 hover:to-pink-800 text-white px-4 py-3 rounded-xl transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] font-semibold border border-red-500/20 w-full"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <PhoneOff className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                  <span className="text-sm">End Session</span>
                </div>
              </button>
            )}
          </div>
        </div>
        </RoomContext.Provider>
      </div>
      
      {/* Microphone Selection Modal */}
      {showMicModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl max-w-sm w-full mx-4">
            <div className="p-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-white font-semibold text-base">Select Microphone</h3>
                </div>
                <button
                  onClick={() => setShowMicModal(false)}
                  className="w-6 h-6 bg-slate-600/50 hover:bg-slate-500 rounded-lg flex items-center justify-center transition-colors duration-200"
                >
                  <span className="text-white text-sm">×</span>
                </button>
              </div>
              
              {/* Device List */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {audioDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => changeMicrophoneDevice(device.deviceId)}
                    className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${
                      selectedMicId === device.deviceId
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        selectedMicId === device.deviceId ? 'bg-blue-400' : 'bg-slate-500'
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                        </div>
                        {selectedMicId === device.deviceId && (
                          <div className="text-xs text-blue-400 mt-1">Currently selected</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Modal Footer */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <button
                  onClick={() => setShowMicModal(false)}
                  className="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors duration-200 text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
      {/* Professional Video Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64 mb-4">
        {/* AI Agent Video */}
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-xl border border-white/10">
          {hasAgentVideo ? (
            <VideoTrack trackRef={agentVideoTrack} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/5"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl mb-4">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <div className="text-lg font-bold text-white mb-2">AI Agent</div>
                <div className="text-sm text-blue-400 capitalize font-medium px-3 py-1.5 bg-blue-500/20 rounded-full border border-blue-500/30">
                  {agentState}
                </div>
              </div>
            </div>
          )}
          <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-white/10">
            <Bot className="w-3 h-3 text-blue-400" />
            <span className="font-medium">AI Agent</span>
          </div>
        </div>
        
        {/* Local User Video */}
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-xl border border-white/10">
          {isScreenSharing ? (
            <>
              <VideoTrack trackRef={screenTrack} className="w-full h-full object-contain" />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-white/10">
                <Monitor className="w-3 h-3 text-purple-400" />
                <span className="font-medium">Screen Share</span>
              </div>
            </>
          ) : isCameraEnabled ? (
            <>
              <VideoTrack trackRef={cameraTrack} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1 border border-white/10">
                <Video className="w-3 h-3 text-emerald-400" />
                <span className="font-medium">Camera</span>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-blue-500/5"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-xl mb-4 border border-white/10">
                  <User className="w-8 h-8 text-slate-300" />
                </div>
                <div className="text-lg font-bold text-white mb-2">You</div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-emerald-400 font-medium">Audio Only</span>
                  <span className="text-xs text-slate-400">Use controls below</span>
                </div>
              </div>
            </div>
          )}
          <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-xs font-medium border border-white/10">
            You
          </div>
        </div>
      </div>
    </div>
  )
}

function InjectedMediaControls({ 
  audioDevices, 
  setShowMicModal 
}: { 
  audioDevices: MediaDeviceInfo[], 
  setShowMicModal: (show: boolean) => void 
}) {
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
    <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border-t border-white/10">
      <div className="px-4 py-4">
        {/* Media Controls */}
        <div className="flex items-center justify-center gap-8">
          {/* Microphone Control */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => audioDevices.length > 0 ? setShowMicModal(true) : undefined}
              className={`relative group p-4 rounded-2xl transition-all duration-300 shadow-xl border ${
                isMicMuted 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-red-500/30 shadow-red-600/25' 
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white border-emerald-500/30 shadow-emerald-600/25'
              } hover:scale-110 active:scale-95`}
              title={audioDevices.length > 0 ? "Click to toggle mute or long-press for settings" : "Microphone"}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                {isMicMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </div>
              <TrackToggle
                source={Track.Source.Microphone}
                className="absolute inset-0 opacity-0"
              />
            </button>
            <span className="text-xs text-slate-300 font-medium text-center">
              Active
            </span>
          </div>
          
          {/* Camera Control */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleCamera}
              disabled={isScreenSharing}
              className={`relative group p-4 rounded-2xl transition-all duration-300 shadow-xl border ${
                isScreenSharing 
                  ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed border-slate-600/30 shadow-lg' 
                  : isCameraEnabled 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-blue-500/30 shadow-blue-600/25 hover:scale-110 active:scale-95' 
                    : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white border-slate-500/30 shadow-slate-600/25 hover:scale-110 active:scale-95'
              }`}
              title={isScreenSharing ? 'Stop screen sharing to use camera' : isCameraEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                {isCameraEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
              </div>
            </button>
            <span className="text-xs text-slate-300 font-medium text-center">
              Camera
            </span>
          </div>

          {/* Screen Share Control */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={toggleScreenShare}
              disabled={isCameraEnabled}
              className={`relative group p-4 rounded-2xl transition-all duration-300 shadow-xl border ${
                isCameraEnabled 
                  ? 'bg-slate-600/50 text-slate-400 cursor-not-allowed border-slate-600/30 shadow-lg' 
                  : isScreenSharing 
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white border-purple-500/30 shadow-purple-600/25 hover:scale-110 active:scale-95' 
                    : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white border-slate-500/30 shadow-slate-600/25 hover:scale-110 active:scale-95'
              }`}
              title={isCameraEnabled ? 'Turn off camera to share screen' : isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
            >
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="relative">
                {isScreenSharing ? <Monitor className="w-6 h-6" /> : <MonitorOff className="w-6 h-6" />}
              </div>
            </button>
            <span className="text-xs text-slate-300 font-medium text-center">
              Screen
            </span>
          </div>
        </div>
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
  
  
  const getAgentStatusIcon = (state: string) => {
    switch (state) {
      case 'listening': return <Mic className="w-3 h-3" />
      case 'thinking': return <Loader className="w-3 h-3 animate-spin" />
      case 'speaking': return <Volume2 className="w-3 h-3" />
      default: return <Bot className="w-3 h-3" />
    }
  }
  
  return (
    <div className="bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-xl border-t border-white/10">
      <div className="px-4 py-3">
        {/* Session Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Participants Card */}
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 shadow-xl hover:shadow-2xl hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg">
                <User className="w-3 h-3 text-blue-400" />
              </div>
              <span className="text-slate-300 font-medium text-xs">Participants</span>
            </div>
            <div className="text-lg font-bold text-white">{participants.length + 1}</div>
            <div className="text-xs text-slate-400">Active in session</div>
          </div>
          
          {/* Mode Card */}
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 shadow-xl hover:shadow-2xl hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${
                isScreenSharing ? 'bg-gradient-to-br from-purple-500/20 to-purple-600/10' :
                isCameraEnabled ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10' :
                'bg-gradient-to-br from-slate-500/20 to-slate-600/10'
              }`}>
                {isScreenSharing ? <Monitor className="w-3 h-3 text-purple-400" /> :
                 isCameraEnabled ? <Video className="w-3 h-3 text-emerald-400" /> :
                 <Volume2 className="w-3 h-3 text-slate-400" />}
              </div>
              <span className="text-slate-300 font-medium text-xs">Current Mode</span>
            </div>
            <div className="text-sm font-bold text-white">
              {isScreenSharing ? 'Screen Share' : isCameraEnabled ? 'Video Call' : 'Audio Only'}
            </div>
            <div className="text-xs text-slate-400">
              {isScreenSharing ? 'Sharing display' : isCameraEnabled ? 'Camera active' : 'Voice conversation'}
            </div>
          </div>
          
          {/* Connection Quality */}
          <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 shadow-xl hover:shadow-2xl hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 rounded-lg">
                <Wifi className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-slate-300 font-medium text-xs">Connection</span>
            </div>
            <div className="text-sm font-bold text-emerald-400">Excellent</div>
            <div className="text-xs text-slate-400">Low latency</div>
          </div>
        </div>
      </div>
    </div>
  )
}
