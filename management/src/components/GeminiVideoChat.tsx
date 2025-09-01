'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WebRTCClient } from '@/lib/webrtc-client';
import ProjectSelector from './ProjectSelector';

interface Project {
  id: string;
  name: string;
  description?: string;
  collectionName: string;
}

interface VideoStreamProps {
    stream: MediaStream | null;
    muted?: boolean;
    className?: string;
}

const VideoStream: React.FC<VideoStreamProps> = ({ stream, muted = false, className = '' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const videoElement = videoRef.current;
        
        if (videoElement && stream) {
            try {
                console.log('Setting video stream:', stream);
                console.log('Video tracks:', stream.getVideoTracks());
                
                // Check if video tracks are enabled
                const videoTracks = stream.getVideoTracks();
                videoTracks.forEach((track, index) => {
                    console.log(`Video track ${index}:`, {
                        enabled: track.enabled,
                        readyState: track.readyState,
                        muted: track.muted,
                        settings: track.getSettings()
                    });
                });
                
                videoElement.srcObject = stream;
                
                // Handle video play promise
                const playPromise = videoElement.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('Video started playing successfully');
                        })
                        .catch((err: any) => {
                            console.warn('Failed to play video:', err);
                        });
                }
            } catch (err) {
                console.error('Error setting video stream:', err);
            }
        } else if (videoElement && !stream) {
            // Clear the stream if no stream is provided
            console.log('Clearing video stream');
            videoElement.srcObject = null;
        }
    }, [stream]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted={muted}
            playsInline
            className={`rounded-lg bg-gray-900 ${className}`}
            style={{ minHeight: '200px' }}
        />
    );
};

interface AudioLevelIndicatorProps {
    level: number;
}

const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({ level }) => {
    const bars = 10;
    const activeBars = Math.floor(level * bars);

    return (
        <div className="flex items-end gap-1 h-8">
            {Array.from({ length: bars }, (_, i) => (
                <div
                    key={i}
                    className={`w-2 rounded-sm transition-colors duration-150 ${
                        i < activeBars 
                            ? i < bars * 0.7 
                                ? 'bg-green-500' 
                                : 'bg-yellow-500'
                            : 'bg-gray-300'
                    }`}
                    style={{ height: `${((i + 1) / bars) * 100}%` }}
                />
            ))}
        </div>
    );
};

export default function GeminiVideoChat() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [audioLevel, setAudioLevel] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [devices, setDevices] = useState<{
        audioInputs: MediaDeviceInfo[];
        audioOutputs: MediaDeviceInfo[];
    }>({ audioInputs: [], audioOutputs: [] });
    const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
    const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');
    const [isInitializingStream, setIsInitializingStream] = useState(false);
    const [streamInitialized, setStreamInitialized] = useState(false);

    const webrtcClientRef = useRef<WebRTCClient | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);

    // Function to initialize stream with collection_name and project_description
    const initializeStream = useCallback(async (collectionName: string, projectDescription?: string) => {
        setIsInitializingStream(true);
        setStreamInitialized(false);
        setError(null);
        
        try {
            console.log(`Initializing stream with collection: ${collectionName}, description: ${projectDescription}`);
            
            const response = await fetch('http://localhost:8000/startup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    collection_name: collectionName,
                    project_description: projectDescription
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            if (result.status !== 'success') {
                throw new Error(result.message || 'Failed to initialize stream');
            }

            console.log('Stream initialized successfully:', result);
            setStreamInitialized(true);
            return true;
        } catch (error) {
            console.error('Error initializing stream:', error);
            setStreamInitialized(false);
            throw error;
        } finally {
            setIsInitializingStream(false);
        }
    }, []);

    // Function to send collection_name and project_description to backend
    const sendProjectDataToBackend = useCallback(async (collectionName: string, projectDescription?: string, webrtcId?: string) => {
        if (!webrtcClientRef.current && !webrtcId) {
            console.log('No WebRTC client available to send project data');
            return;
        }

        const targetWebrtcId = webrtcId || webrtcClientRef.current?.getWebRtcId();
        
        if (!targetWebrtcId) {
            console.error('No webrtc_id available to send project data');
            return;
        }

        try {
            console.log(`Sending project data to backend for webrtc_id: ${targetWebrtcId}`);
            
            const response = await fetch('http://localhost:8000/input_hook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    webrtc_id: targetWebrtcId,
                    collection_name: collectionName,
                    project_description: projectDescription,
                    conf_threshold: 0.5
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Successfully sent project data to backend:', result);
        } catch (error) {
            console.error('Error sending project data to backend:', error);
        }
    }, []);

    // Load available devices
    useEffect(() => {
        const loadDevices = async () => {
            try {
                const deviceList = await WebRTCClient.getMediaDevices();
                setDevices(deviceList);
                
                // Set default devices
                if (deviceList.audioInputs.length > 0) {
                    setSelectedAudioInput(deviceList.audioInputs[0].deviceId);
                }
                if (deviceList.audioOutputs.length > 0) {
                    setSelectedAudioOutput(deviceList.audioOutputs[0].deviceId);
                }
            } catch (err) {
                console.error('Error loading devices:', err);
            }
        };

        loadDevices();
    }, []);

    // Handle remote audio stream
    useEffect(() => {
        if (remoteStream && remoteAudioRef.current) {
            const audioElement = remoteAudioRef.current;
            
            try {
                audioElement.srcObject = remoteStream;
                
                // Set audio output device if supported
                if (selectedAudioOutput && 'setSinkId' in audioElement) {
                    (audioElement as any).setSinkId(selectedAudioOutput).catch((err: any) => {
                        console.warn('Failed to set audio output device:', err);
                    });
                }
                
                // Ensure audio plays
                audioElement.play().catch((err: any) => {
                    console.warn('Failed to play audio:', err);
                });
            } catch (err) {
                console.error('Error setting up remote audio:', err);
            }
        }
    }, [remoteStream, selectedAudioOutput]);

    const handleConnect = useCallback(async () => {
        if (isConnecting || isConnected) return;

        // Check if project is selected
        if (!selectedProject) {
            setError('Please select a project before sharing your screen. The AI needs project context to provide relevant assistance.');
            return;
        }

        setIsConnecting(true);
        setError(null);

        try {
            // Check if WebRTC is supported
            if (!window.RTCPeerConnection) {
                throw new Error('WebRTC is not supported in this browser');
            }

            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Media devices are not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
            }

            // Check if getDisplayMedia is supported
            if (!navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Screen sharing is not supported in this browser. Please use Chrome 72+, Firefox 66+, or Safari 13+.');
            }

            // Check if running in secure context (HTTPS or localhost)
            if (!window.isSecureContext) {
                throw new Error('Screen sharing requires a secure connection (HTTPS). Please use HTTPS or localhost.');
            }

            // Get screen share and audio stream
            console.log('Getting screen share and audio stream...');
            
            let screenStream: MediaStream;
            let audioStream: MediaStream;
            
            try {
                // Get screen sharing stream with more conservative settings initially
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        width: { max: 1920, ideal: 1280 },
                        height: { max: 1080, ideal: 720 },
                        frameRate: { max: 30, ideal: 15 }
                    },
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        sampleRate: 44100
                    }
                });
                
                console.log('Screen sharing started successfully');
                console.log('Screen stream tracks:', screenStream.getTracks().map(track => ({
                    kind: track.kind,
                    label: track.label,
                    enabled: track.enabled,
                    readyState: track.readyState
                })));
                
            } catch (screenError: any) {
                console.error('Screen sharing error:', screenError);
                
                if (screenError.name === 'NotAllowedError') {
                    throw new Error('Screen sharing was cancelled or denied. Please try again and click "Share" in the browser dialog.');
                } else if (screenError.name === 'NotFoundError') {
                    throw new Error('No screens available for sharing. Please check your display settings.');
                } else if (screenError.name === 'NotSupportedError') {
                    throw new Error('Screen sharing is not supported on this device/browser. Please try Chrome, Firefox, or Safari on desktop.');
                } else if (screenError.name === 'NotReadableError') {
                    throw new Error('Screen sharing device is already in use. Please close other applications using screen sharing.');
                } else if (screenError.name === 'AbortError') {
                    throw new Error('Screen sharing was interrupted. Please try again.');
                } else {
                    throw new Error(`Failed to access screen sharing: ${screenError.message || screenError.name || 'Unknown error'}. Please try refreshing the page.`);
                }
            }
            
            try {
                // Get audio stream separately only if screen stream doesn't include audio
                const hasAudio = screenStream.getAudioTracks().length > 0;
                
                if (!hasAudio && selectedAudioInput) {
                    console.log('Getting separate audio stream...');
                    audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
                        video: false
                    });
                } else if (hasAudio) {
                    console.log('Using audio from screen sharing');
                    audioStream = screenStream;
                } else {
                    console.log('No audio stream requested');
                    audioStream = screenStream; // Use screen stream even without audio
                }
            } catch (audioError: any) {
                // Clean up screen stream if audio fails
                screenStream.getTracks().forEach(track => track.stop());
                
                if (audioError.name === 'NotAllowedError') {
                    throw new Error('Microphone access denied. Please allow microphone access and try again.');
                } else if (audioError.name === 'NotFoundError') {
                    throw new Error('No microphone detected. Please connect a microphone and try again.');
                } else {
                    throw new Error('Failed to access microphone: ' + (audioError.message || 'Unknown error'));
                }
            }
            
            // Combine screen video with microphone audio
            const localMediaStream = new MediaStream([
                ...screenStream.getVideoTracks(),
                ...audioStream.getAudioTracks()
            ]);
            
            console.log('Local media stream obtained:', localMediaStream);
            console.log('Video tracks:', localMediaStream.getVideoTracks());
            console.log('Audio tracks:', localMediaStream.getAudioTracks());
            
            // Listen for screen share ending (user clicked "Stop sharing" in browser)
            const videoTrack = localMediaStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.onended = () => {
                    console.log('Screen sharing ended by user');
                    handleDisconnect();
                };
            }
            
            setLocalStream(localMediaStream);
            
            // Create WebRTC client with the existing stream
            const client = new WebRTCClient({
                serverUrl: 'http://localhost:8000',
                audioInputDeviceId: selectedAudioInput,
                audioOutputDeviceId: selectedAudioOutput,
                existingMediaStream: localMediaStream, // Pass the existing stream
                onConnected: () => {
                    console.log('Connected to Gemini');
                    setIsConnected(true);
                    setIsConnecting(false);
                },
                onDisconnected: () => {
                    console.log('Disconnected from Gemini');
                    setIsConnected(false);
                    setIsConnecting(false);
                    // Keep localStream for preview, only clear remoteStream
                    setRemoteStream(null);
                    // Reset audio level but don't cleanup the WebRTC client yet
                    setAudioLevel(0);
                },
                onAudioStream: (stream) => {
                    console.log('Received audio stream');
                    setRemoteStream(stream);
                },
                onVideoStream: (stream) => {
                    console.log('Received video stream from server - ignoring as only preview needed');
                    // We don't want to display server video response, only preview our screen share
                    // Just log it and ignore
                },
                onAudioLevel: (level) => {
                    setAudioLevel(level);
                },
                onMessage: (message) => {
                    console.log('Received message:', message);
                }
            });

            webrtcClientRef.current = client;
            
            // Connect to backend
            await client.connect();
            
        } catch (err: any) {
            console.error('Connection error:', err);
            setError(err.message || 'Failed to connect');
            setIsConnecting(false);
            
            // Clean up on error
            if (webrtcClientRef.current) {
                webrtcClientRef.current.disconnect();
                webrtcClientRef.current = null;
            }
        }
    }, [isConnecting, isConnected, selectedAudioInput, selectedAudioOutput, selectedProject, sendProjectDataToBackend]);

    const handleDisconnect = useCallback(() => {
        if (webrtcClientRef.current) {
            webrtcClientRef.current.disconnect();
            webrtcClientRef.current = null;
        }
        
        if (localStream) {
            // Stop all tracks (screen share and audio)
            localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped ${track.kind} track`);
            });
            setLocalStream(null);
        }
        
        setIsConnected(false);
        setIsConnecting(false);
        setRemoteStream(null);
        setAudioLevel(0);
        setError(null);
    }, [localStream]);

    // Send collection_name when project changes (initialize stream with new collection)
    useEffect(() => {
        if (selectedProject?.collectionName) {
            console.log('Project selected, initializing stream with collection:', selectedProject.collectionName);
            initializeStream(selectedProject.collectionName, selectedProject.description)
                .then(() => {
                    console.log('Stream initialized successfully for project:', selectedProject.name);
                })
                .catch((error) => {
                    console.error('Failed to initialize stream for project:', selectedProject.name, error);
                    setError(`Failed to initialize project context: ${error.message}`);
                });
        } else {
            // No project selected, reset stream state
            setStreamInitialized(false);
        }
    }, [selectedProject, initializeStream]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            console.log('Component unmounting, cleaning up...');
            if (webrtcClientRef.current) {
                webrtcClientRef.current.disconnect();
                webrtcClientRef.current = null;
            }
            
            // Don't stop localStream tracks here since they might be used elsewhere
            // The user can manually disconnect if needed
        };
    }, []); // Empty dependency array - only run on mount/unmount

    return (
        <div className="h-full flex flex-col max-w-7xl mx-auto p-6">
            {/* Header Section */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Mimi AI Assistant</h1>
                <p className="text-gray-600">Share your screen and interact with Mimi, your AI-powered support assistant</p>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Video Preview - Main Area */}
                <div className="lg:col-span-3">
                    <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video relative shadow-2xl">
                        {localStream ? (
                            <>
                                <VideoStream 
                                    stream={localStream} 
                                    muted={true}
                                    className="w-full h-full object-cover"
                                />
                                {/* Live Indicator */}
                                {isConnected && (
                                    <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                        LIVE
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center text-white space-y-4">
                                    <div className="w-20 h-20 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4">
                                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-semibold">Ready to Share</h3>
                                    <p className="text-white/70 max-w-sm">Your screen will appear here once you start sharing</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Control Panel */}
                    <div className="mt-6 flex items-center justify-center">
                        <button
                            onClick={isConnected ? handleDisconnect : handleConnect}
                            disabled={isConnecting || !streamInitialized || isInitializingStream}
                            className={`inline-flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg ${
                                isConnected 
                                    ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-red-500/25' 
                                    : !streamInitialized || isInitializingStream
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-500/25'
                            } ${(isConnecting || !streamInitialized || isInitializingStream) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                            {isConnecting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Connecting...
                                </>
                            ) : isInitializingStream ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Initializing...
                                </>
                            ) : isConnected ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                    </svg>
                                    Stop Sharing
                                </>
                            ) : !streamInitialized ? (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    Select Project First
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                    </svg>
                                    Share your screen
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Sidebar - Controls & Settings */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Project Selector */}
                    <ProjectSelector 
                        selectedProject={selectedProject}
                        onProjectSelect={setSelectedProject}
                    />

                    {/* Status Card */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Session Status</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Project</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    selectedProject 
                                        ? 'bg-indigo-100 text-indigo-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {selectedProject ? selectedProject.name : 'None'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Stream</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    isInitializingStream
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : streamInitialized 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {isInitializingStream ? 'Initializing...' : streamInitialized ? 'Ready' : 'Not Ready'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Connection</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    isConnected 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    {isConnected ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            {isConnected && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Audio Level</span>
                                    <AudioLevelIndicator level={audioLevel} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Device Settings */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="text-lg font-semibold text-gray-900">Device Settings</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                        Microphone
                                    </div>
                                </label>
                                <select 
                                    value={selectedAudioInput} 
                                    onChange={(e) => setSelectedAudioInput(e.target.value)}
                                    className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {devices.audioInputs.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.05 6.464A6.975 6.975 0 003 12a6.975 6.975 0 002.05 5.536m0-11.072A6.975 6.975 0 008 4a6.975 6.975 0 013 .536" />
                                        </svg>
                                        Speaker
                                    </div>
                                </label>
                                <select 
                                    value={selectedAudioOutput} 
                                    onChange={(e) => setSelectedAudioOutput(e.target.value)}
                                    className="w-full p-3 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {devices.audioOutputs.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Speaker ${device.deviceId.slice(0, 8)}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Help Card */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-6 border border-indigo-100">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h4 className="font-medium text-indigo-900">Quick Tips</h4>
                        </div>
                        <ul className="text-sm text-indigo-700 space-y-1">
                            <li>• Select a project for AI context</li>
                            <li>• Ensure microphone permissions are granted</li>
                            <li>• Choose your best audio devices</li>
                            <li>• Click "Share your screen" to begin</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-red-800">
                            <strong>Error:</strong> {error}
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden audio element for remote audio */}
            <audio ref={remoteAudioRef} autoPlay hidden />
        </div>
    );
}