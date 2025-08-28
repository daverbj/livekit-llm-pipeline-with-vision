# LiveKit Browser Extension

A Chrome browser extension that injects a LiveKit real-time communication interface into any webpage, providing voice and video communication capabilities with proper media permissions.

## Features

- **Injected UI**: Floating LiveKit interface that appears on any webpage
- **Real-time Communication**: Voice and video streaming via LiveKit WebRTC
- **Media Permissions**: Runs in webpage context for proper microphone/camera access
- **Draggable Interface**: Resizable and movable floating window
- **Voice Assistant Integration**: Compatible with LiveKit voice assistant agents

## Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Development**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Load in Chrome**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `build/chrome-mv3-dev` folder

## Usage

1. **Start LiveKit Server**:
   ```bash
   livekit-server --dev
   ```

2. **Use Extension**:
   - Navigate to any website
   - Click the LiveKit extension icon in Chrome toolbar
   - A floating LiveKit interface will appear
   - Click "Permissions" to grant media access
   - Click "Start Session" to begin real-time communication

## Architecture

### Core Files

- **`src/background.ts`**: Service worker handling extension icon clicks
- **`src/content.ts`**: Content script that injects the UI into webpages
- **`src/components/LiveKitInjectedApp.tsx`**: Main React component with LiveKit integration
- **`src/utils/tokenUtils.ts`**: JWT token generation for LiveKit authentication

### Key Features

- **Webpage Injection**: Unlike traditional extension popups/sidepanels, this runs directly in the webpage context, solving Chrome's media permission restrictions
- **WebRTC Connection**: Uses `ws://localhost:7880` for LiveKit server communication
- **Token-based Auth**: Generates JWT tokens with proper LiveKit claims
- **Media Controls**: Microphone/camera toggle with visual feedback
- **Video Streaming**: Real-time video tiles for participants

## Configuration

The extension connects to a local LiveKit server with these default settings:

- **Server URL**: `ws://localhost:7880`
- **API Key**: `devkey`
- **API Secret**: `secret`

## Development Notes

- Built with Plasmo framework for modern Chrome extension development
- Uses React 18 with TypeScript for the UI
- LiveKit Client SDK v2.13.3+ for WebRTC functionality
- Tailwind CSS for styling (with Plasmo prefix system)

## Browser Compatibility

- Chrome MV3 extensions
- Requires microphone and camera permissions
- Works on all non-restricted webpages (not chrome:// pages)
