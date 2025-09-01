interface WebRTCClientOptions {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onMessage?: (message: any) => void;
    onAudioStream?: (stream: MediaStream) => void;
    onVideoStream?: (stream: MediaStream) => void;
    onAudioLevel?: (level: number) => void;
    audioInputDeviceId?: string;
    audioOutputDeviceId?: string;
    serverUrl?: string;
    existingMediaStream?: MediaStream;
}

export class WebRTCClient {
    private peerConnection: RTCPeerConnection | null = null;
    private mediaStream: MediaStream | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private options: WebRTCClientOptions;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private dataArray: Uint8Array | null = null;
    private animationFrameId: number | null = null;
    private currentInputDeviceId: string | undefined = undefined;
    private currentOutputDeviceId: string | undefined = undefined;
    private serverUrl: string;
    private webrtcId: string;
    private isManuallyDisconnecting: boolean = false;

    constructor(options: WebRTCClientOptions = {}) {
        this.options = options;
        this.currentInputDeviceId = options.audioInputDeviceId;
        this.currentOutputDeviceId = options.audioOutputDeviceId;
        this.serverUrl = options.serverUrl || 'http://localhost:8000';
        this.webrtcId = Math.random().toString(36).substring(7);
    }

    // Method to change audio input device
    setAudioInputDevice(deviceId: string) {
        this.currentInputDeviceId = deviceId;
        
        // If we're already connected, reconnect with the new device
        if (this.peerConnection) {
            this.disconnect();
            this.connect();
        }
    }

    // Method to change audio output device
    setAudioOutputDevice(deviceId: string) {
        this.currentOutputDeviceId = deviceId;
        
        // Apply to any current audio elements
        if (this.options.onAudioStream) {
            this.options.audioOutputDeviceId = deviceId;
        }
    }

    async connect() {
        try {
            // Prevent multiple simultaneous connection attempts
            if (this.peerConnection && this.peerConnection.connectionState === 'connecting') {
                throw new Error('Connection already in progress');
            }

            // Ensure we start with a clean state - use internal cleanup to avoid triggering callbacks
            this.cleanup();

            console.log('Creating new RTCPeerConnection...');
            // Create peer connection with TURN/STUN servers for better connectivity
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Verify peer connection was created successfully
            if (!this.peerConnection) {
                throw new Error('Failed to create RTCPeerConnection');
            }
            
            console.log('RTCPeerConnection created successfully, state:', this.peerConnection.connectionState);
            
            // Get user media with specific device if specified
            console.log('Setting up media stream...');
            try {
                if (this.options.existingMediaStream) {
                    console.log('Using existing media stream');
                    this.mediaStream = this.options.existingMediaStream;
                } else {
                    console.log('Requesting new user media...');
                    const constraints: MediaStreamConstraints = {
                        audio: this.currentInputDeviceId 
                            ? { deviceId: { exact: this.currentInputDeviceId } } 
                            : true,
                        video: {
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            frameRate: { ideal: 30 }
                        }
                    };
                    
                    this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
                }
                console.log('Media stream ready:', this.mediaStream);
                console.log('Video tracks:', this.mediaStream.getVideoTracks());
                console.log('Audio tracks:', this.mediaStream.getAudioTracks());
            } catch (mediaError: any) {
                console.error('Media error:', mediaError);
                if (mediaError.name === 'NotAllowedError') {
                    throw new Error('Camera and microphone access denied. Please allow access and try again.');
                } else if (mediaError.name === 'NotFoundError') {
                    throw new Error('No camera or microphone detected. Please connect devices and try again.');
                } else {
                    throw mediaError;
                }
            }
            
            this.setupAudioAnalysis();
            
            console.log('Adding tracks to peer connection...');
            // Add tracks to peer connection
            if (!this.mediaStream) {
                throw new Error('Media stream is not available');
            }
            
            if (!this.peerConnection) {
                throw new Error('PeerConnection was lost after media setup');
            }
            
            this.mediaStream.getTracks().forEach(track => {
                if (this.peerConnection && this.mediaStream) {
                    console.log('Adding track:', track.kind);
                    this.peerConnection.addTrack(track, this.mediaStream);
                }
            });
            
            console.log('Setting up event listeners...');
            // Handle incoming streams
            if (this.peerConnection) {
                this.peerConnection.addEventListener('track', (event) => {
                    console.log('Received track:', event.track.kind);
                    const stream = event.streams[0];
                    const track = event.track;
                    
                    if (track.kind === 'audio' && this.options.onAudioStream) {
                        // Handle audio output device selection
                        if (this.currentOutputDeviceId && 'setSinkId' in HTMLAudioElement.prototype) {
                            this.options.audioOutputDeviceId = this.currentOutputDeviceId;
                        }
                        this.options.onAudioStream(stream);
                    } else if (track.kind === 'video' && this.options.onVideoStream) {
                        this.options.onVideoStream(stream);
                    }
                });
            }
            
            // Create data channel for text messages
            if (this.peerConnection) {
                console.log('Creating data channel...');
                this.dataChannel = this.peerConnection.createDataChannel('text');
                
                if (this.dataChannel) {
                    this.dataChannel.addEventListener('message', (event) => {
                        try {
                            const message = JSON.parse(event.data);
                            console.log('Received message:', message);
                            
                            if (this.options.onMessage) {
                                this.options.onMessage(message);
                            }
                        } catch (error) {
                            console.error('Error parsing message:', error);
                        }
                    });
                }
            }
            
            // Handle connection state changes
            if (this.peerConnection) {
                this.peerConnection.addEventListener('connectionstatechange', () => {
                    const state = this.peerConnection?.connectionState;
                    console.log('Connection state changed to:', state);
                    console.log('isManuallyDisconnecting:', this.isManuallyDisconnecting);
                    
                    if (state === 'connected') {
                        if (this.options.onConnected) {
                            this.options.onConnected();
                        }
                    } else if ((state === 'failed' || state === 'closed') && !this.isManuallyDisconnecting) {
                        // Only treat 'failed' and 'closed' as actual disconnections
                        // 'disconnected' can be a temporary state during negotiation
                        console.log('Connection failed or closed, calling onDisconnected');
                        if (this.options.onDisconnected) {
                            this.options.onDisconnected();
                        }
                    } else {
                        console.log('Connection state change ignored:', state, 'manual disconnect:', this.isManuallyDisconnecting);
                    }
                });
            }
            
            // Create and send offer
            console.log('Creating offer...');
            if (!this.peerConnection) {
                throw new Error('PeerConnection was lost before creating offer');
            }
            
            const offer = await this.peerConnection.createOffer();
            console.log('Offer created successfully');
            await this.peerConnection.setLocalDescription(offer);
            console.log('Local description set');
            
            // Send offer to server
            console.log('Sending offer to server...');
            const response = await fetch(`${this.serverUrl}/webrtc/offer`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors',
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type,
                    webrtc_id: this.webrtcId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
             const serverResponse = await response.json();
            console.log('Received server response:', serverResponse);
            console.log('PeerConnection state before setRemoteDescription:', this.peerConnection?.connectionState);
            
            if (!this.peerConnection) {
                throw new Error('PeerConnection was closed during negotiation');
            }

            // Validate server response
            if (!serverResponse || !serverResponse.type || !serverResponse.sdp) {
                throw new Error('Invalid server response: missing type or sdp');
            }

            console.log('Setting remote description...');
            await this.peerConnection.setRemoteDescription(serverResponse);
            console.log('Remote description set, WebRTC connection established');
            console.log('PeerConnection state after setRemoteDescription:', this.peerConnection?.connectionState);
            
            console.log('WebRTC connection established');
            
        } catch (error) {
            console.error('Error connecting:', error);
            this.cleanup();
            throw error;
        }
    }

    private setupAudioAnalysis() {
        if (!this.mediaStream) return;
        
        try {
            this.audioContext = new AudioContext();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            source.connect(this.analyser);
            
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            
            this.startAnalysis();
        } catch (error) {
            console.error('Error setting up audio analysis:', error);
        }
    }

    private startAnalysis() {
        if (!this.analyser || !this.dataArray || !this.options.onAudioLevel) return;
        
        let lastUpdateTime = 0;
        const throttleInterval = 100; // Only update every 100ms
        
        const analyze = () => {
            if (!this.analyser || !this.dataArray) {
                return; // Stop if analyser was cleaned up
            }
            
            try {
                this.analyser.getByteFrequencyData(this.dataArray);
                
                const currentTime = Date.now();
                if (currentTime - lastUpdateTime > throttleInterval) {
                    // Calculate average volume level (0-1)
                    let sum = 0;
                    for (let i = 0; i < this.dataArray.length; i++) {
                        sum += this.dataArray[i];
                    }
                    const average = sum / this.dataArray.length / 255;
                    
                    if (this.options.onAudioLevel) {
                        this.options.onAudioLevel(average);
                    }
                    lastUpdateTime = currentTime;
                }
                
                this.animationFrameId = requestAnimationFrame(analyze);
            } catch (error) {
                console.error('Error in audio analysis:', error);
                // Stop analysis on error
                if (this.animationFrameId !== null) {
                    cancelAnimationFrame(this.animationFrameId);
                    this.animationFrameId = null;
                }
            }
        };
        
        this.animationFrameId = requestAnimationFrame(analyze);
    }

    private stopAnalysis() {
        try {
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close().catch((err) => {
                    console.warn('Error closing audio context:', err);
                });
                this.audioContext = null;
            }
            
            this.analyser = null;
            this.dataArray = null;
        } catch (error) {
            console.error('Error stopping audio analysis:', error);
        }
    }

    sendMessage(message: any) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
        }
    }

    private cleanup() {
        console.log('cleanup() called');
        console.trace('cleanup() call stack');
        
        this.stopAnalysis();
        
        // Only stop tracks if we created the media stream ourselves
        // If using existingMediaStream, let the caller manage the tracks
        if (this.mediaStream && !this.options.existingMediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        this.mediaStream = null;
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.dataChannel = null;
    }

    disconnect() {
        this.isManuallyDisconnecting = true;
        this.cleanup();
        this.isManuallyDisconnecting = false;
        
        // Don't call onDisconnected here as this is a manual disconnect
        // onDisconnected should only be called for unexpected connection failures
    }

    // Get available media devices
    static async getMediaDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return {
                audioInputs: devices.filter(device => device.kind === 'audioinput'),
                audioOutputs: devices.filter(device => device.kind === 'audiooutput')
            };
        } catch (error) {
            console.error('Error getting media devices:', error);
            return { audioInputs: [], audioOutputs: [] };
        }
    }

    // Getter for webrtcId
    getWebRtcId(): string {
        return this.webrtcId;
    }

    private isPeerConnectionValid(): boolean {
        return this.peerConnection !== null && 
               this.peerConnection.connectionState !== 'closed' &&
               this.peerConnection.connectionState !== 'failed';
    }

    private isPeerConnectionReady(): boolean {
        return this.peerConnection !== null;
    }
}
