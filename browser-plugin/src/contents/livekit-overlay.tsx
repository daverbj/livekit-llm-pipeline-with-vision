import cssText from "data-text:~style.css"
import type { PlasmoCSConfig } from "plasmo"

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
  return (
    <div className="fixed top-5 right-5 w-[420px] h-[650px] border-none rounded-2xl shadow-2xl z-[999999] font-sans overflow-hidden resize min-w-[380px] min-h-[500px] max-w-[600px] max-h-[800px]">
      <LiveKitInjectedApp />
    </div>
  )
}

export default LiveKitOverlay
