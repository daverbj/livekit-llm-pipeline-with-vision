// Content script with injected LiveKit UI
// This runs in the actual web page context where media permissions work properly

import { createRoot } from 'react-dom/client'
import React from 'react'
import { LiveKitInjectedApp } from './components/LiveKitInjectedApp'

export {};

let injectedUI: HTMLElement | null = null;
let isUIVisible = false;

// Initialize content script
console.log('LiveKit content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    if (message.type === 'TOGGLE_LIVEKIT_UI') {
      toggleLiveKitUI();
      sendResponse({ success: true, visible: isUIVisible });
      return true;
    }
  } catch (error) {
    console.error('Content script error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true;
});

function toggleLiveKitUI() {
  if (isUIVisible) {
    hideLiveKitUI();
  } else {
    showLiveKitUI();
  }
}

function showLiveKitUI() {
  if (injectedUI) {
    injectedUI.style.display = 'block';
    isUIVisible = true;
    return;
  }

  // Create the injected UI container
  injectedUI = document.createElement('div');
  injectedUI.id = 'livekit-injected-ui';
  injectedUI.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    height: 600px;
    background: white;
    border: 2px solid #3b82f6;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    resize: both;
    min-width: 350px;
    min-height: 400px;
  `;

  // Add drag handle
  const dragHandle = document.createElement('div');
  dragHandle.style.cssText = `
    background: #3b82f6;
    color: white;
    padding: 8px 12px;
    cursor: move;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 14px;
  `;
  dragHandle.innerHTML = `
    <span>🎙️ LiveKit</span>
    <button id="close-livekit" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;">×</button>
  `;

  // Add React app container
  const appContainer = document.createElement('div');
  appContainer.id = 'livekit-app-container';
  appContainer.style.cssText = `
    height: calc(100% - 40px);
    overflow: hidden;
  `;

  injectedUI.appendChild(dragHandle);
  injectedUI.appendChild(appContainer);
  document.body.appendChild(injectedUI);

  // Make draggable
  makeDraggable(injectedUI, dragHandle);

  // Close button handler
  const closeBtn = dragHandle.querySelector('#close-livekit');
  closeBtn?.addEventListener('click', hideLiveKitUI);

  // Render React app
  const root = createRoot(appContainer);
  root.render(React.createElement(LiveKitInjectedApp));

  isUIVisible = true;
  console.log('LiveKit UI injected into page');
}

function hideLiveKitUI() {
  if (injectedUI) {
    injectedUI.style.display = 'none';
    isUIVisible = false;
  }
}

function makeDraggable(element: HTMLElement, handle: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Auto-inject UI when extension is loaded (optional)
// showLiveKitUI();
