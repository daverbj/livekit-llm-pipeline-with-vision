import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"
import { useState, useEffect } from "react"

import { LiveKitInjectedApp } from '../components/LiveKitInjectedApp'

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText
  return style
}

const LiveKitOverlay = () => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Listen for messages from background script
    const messageListener = (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void
    ) => {
      console.log('Content script received message:', message)
      
      if (message.type === 'TOGGLE_LIVEKIT_UI') {
        setIsVisible(prev => {
          const newState = !prev
          console.log('Toggling LiveKit UI:', prev, '->', newState)
          sendResponse({ success: true, visible: newState })
          return newState
        })
        return true // Keep message channel open for async response
      }
    }

    // Add message listener
    chrome.runtime.onMessage.addListener(messageListener)

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener)
    }
  }, [])

  // Always render the component but control visibility with CSS
  return (
    <div 
      className={`fixed top-5 right-5 w-[420px] h-[calc(100vh-40px)] border-none rounded-2xl shadow-2xl z-[999999] font-sans overflow-hidden resize min-w-[380px] min-h-[600px] max-w-[600px] max-h-[calc(100vh-40px)] transition-all duration-300 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <LiveKitInjectedApp />
    </div>
  )
}

export default LiveKitOverlay
