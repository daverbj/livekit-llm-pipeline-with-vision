# 🎙️ LiveKit Browser Extension - Final Usage Guide

## ✅ What's Included (Clean Build)

The extension now contains only the essential working components:

### Core Files
- **`src/background.ts`** - Handles extension icon clicks
- **`src/content.ts`** - Injects the floating UI into webpages  
- **`src/components/LiveKitInjectedApp.tsx`** - Complete LiveKit React interface
- **`src/utils/tokenUtils.ts`** - JWT token generation

### Removed (Cleanup Complete)
- ❌ Side panel components
- ❌ Test components and utilities
- ❌ Old hook files
- ❌ Popup interface
- ❌ Debug/testing features

## 🚀 How to Use

### 1. Install Extension
```bash
# In chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select: build/chrome-mv3-prod (or chrome-mv3-dev for development)
```

### 2. Start LiveKit Server
```bash
livekit-server --dev
```

### 3. Use Extension
1. **Navigate to any website** (google.com, github.com, etc.)
2. **Click the LiveKit extension icon** in Chrome toolbar
3. **Floating UI appears** - draggable, resizable window
4. **Click "📱 Permissions"** - grants microphone/camera access
5. **Click "🚀 Start Session"** - connects to LiveKit server
6. **Real-time communication** is now active!

## 🎯 Key Features Working

✅ **Injected UI**: Runs in webpage context for proper media permissions  
✅ **WebRTC Connection**: Uses `ws://localhost:7880` for LiveKit server  
✅ **Media Controls**: Microphone/camera toggle with visual feedback  
✅ **Video Streaming**: Real-time video tiles for participants  
✅ **Voice Assistant**: Compatible with LiveKit agent integration  
✅ **Draggable Interface**: Movable and resizable floating window  

## 🔧 Connection Details

- **Server**: `ws://localhost:7880`
- **API Key**: `devkey` 
- **API Secret**: `secret`
- **Room**: Auto-generated with timestamp
- **User**: Auto-generated identity

## 📁 Final File Structure

```
browser-plugin/
├── src/
│   ├── background.ts              # Extension service worker
│   ├── content.ts                 # Content script injection
│   ├── components/
│   │   └── LiveKitInjectedApp.tsx # Main React UI component
│   ├── utils/
│   │   └── tokenUtils.ts          # JWT token generation
│   └── style.css                  # Basic styling
├── package.json                   # Clean manifest configuration
└── README.md                      # Updated documentation
```

## 🎉 Success!

The extension is now **clean, focused, and fully functional** with only the working LiveKit injected interface. No more testing components, side panels, or debugging code - just a pure, working real-time communication extension!

**Total files**: 4 core TypeScript files + configuration
**Bundle size**: Optimized and minimal  
**Functionality**: Complete LiveKit integration with media permissions working properly
