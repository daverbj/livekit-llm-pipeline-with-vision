// Content script with injected LiveKit UI
// This runs in the actual web page context where media permissions work properly

import { createRoot } from 'react-dom/client'
import React from 'react'
import { LiveKitInjectedApp } from './components/LiveKitInjectedApp'

export {};

let injectedUI: HTMLElement | null = null;
let miniButton: HTMLElement | null = null;
let isUIVisible = false;
let isUIExpanded = false;
let isDragging = false;

// Initialize content script
console.log('LiveKit content script loaded');

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    if (message.type === 'TOGGLE_LIVEKIT_UI') {
      showMiniButton();
      sendResponse({ success: true, visible: isUIVisible });
      return true;
    }
  } catch (error) {
    console.error('Content script error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true;
});

function showMiniButton() {
  if (miniButton) {
    miniButton.style.display = 'block';
    return;
  }

  // Create the mini draggable button
  miniButton = document.createElement('div');
  miniButton.id = 'jmimi-mini-button';
  miniButton.style.cssText = `
    position: fixed;
    top: 50%;
    right: 20px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1);
    z-index: 999998;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    user-select: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateY(-50%);
  `;

  miniButton.innerHTML = `
    <div style="text-align: center; color: white;">
      <div style="font-size: 16px; margin-bottom: 2px;">🎙️</div>
      <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.5px;">JMimi</div>
    </div>
  `;

  // Add hover effects
  miniButton.onmouseenter = () => {
    miniButton!.style.transform = 'translateY(-50%) scale(1.1)';
    miniButton!.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2), 0 3px 6px rgba(0, 0, 0, 0.15)';
  };

  miniButton.onmouseleave = () => {
    miniButton!.style.transform = 'translateY(-50%) scale(1)';
    miniButton!.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
  };

  // Click handler to toggle main UI
  miniButton.onclick = (e) => {
    // Only toggle if it's a click, not the end of a drag
    if (!isDragging) {
      toggleMainUI();
    }
  };

  // Make draggable
  makeDraggable(miniButton, miniButton);

  document.body.appendChild(miniButton);
  isUIVisible = true;
  console.log('JMimi mini button created');
}

function toggleMainUI() {
  if (isUIExpanded) {
    hideMainUI();
  } else {
    showMainUI();
  }
}

function showMainUI() {
  if (injectedUI) {
    // Slide in from right
    injectedUI.style.display = 'block';
    injectedUI.style.transform = 'translateX(0)';
    isUIExpanded = true;
    return;
  }

  // Create the main UI container
  injectedUI = document.createElement('div');
  injectedUI.id = 'livekit-injected-ui';
  injectedUI.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    height: 600px;
    background: white;
    border: 2px solid #667eea;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    resize: both;
    min-width: 350px;
    min-height: 400px;
    transform: translateX(450px);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  `;

  // Add drag handle (not draggable, just for styling)
  const dragHandle = document.createElement('div');
  dragHandle.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 14px;
  `;
  dragHandle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px;">🎙️</span>
      <span>JMimi - LiveKit</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="minimize-jmimi" style="background: rgba(255,255,255,0.2); border: none; color: white; cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;" title="Minimize">−</button>
      <button id="close-jmimi" style="background: #ef4444; border: none; color: white; cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 4px; transition: background 0.2s;" title="End Session">×</button>
    </div>
  `;

  // Add React app container
  const appContainer = document.createElement('div');
  appContainer.id = 'livekit-app-container';
  appContainer.style.cssText = `
    height: calc(100% - 52px);
    overflow: hidden;
  `;

  injectedUI.appendChild(dragHandle);
  injectedUI.appendChild(appContainer);
  document.body.appendChild(injectedUI);

  // Don't make the main panel draggable - only the mini button should be draggable

  // Button handlers
  const minimizeBtn = dragHandle.querySelector('#minimize-jmimi');
  const closeBtn = dragHandle.querySelector('#close-jmimi');
  
  minimizeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideMainUI(); // Just minimize/slide out
  });
  
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    endSession(); // End the LiveKit session completely
  });

  // Add hover effects to buttons
  [minimizeBtn, closeBtn].forEach(btn => {
    if (btn) {
      btn.addEventListener('mouseenter', () => {
        (btn as HTMLElement).style.background = 'rgba(255,255,255,0.3)';
      });
      btn.addEventListener('mouseleave', () => {
        (btn as HTMLElement).style.background = 'rgba(255,255,255,0.2)';
      });
    }
  });

  // Render React app
  const root = createRoot(appContainer);
  root.render(React.createElement(LiveKitInjectedApp));

  // Slide in animation
  requestAnimationFrame(() => {
    injectedUI!.style.transform = 'translateX(0)';
  });

  isUIExpanded = true;
  console.log('JMimi main UI created and sliding in');
}

function hideMainUI() {
  if (injectedUI) {
    // Slide out to right
    injectedUI.style.transform = 'translateX(450px)';
    
    // Hide after animation
    setTimeout(() => {
      if (injectedUI) {
        injectedUI.style.display = 'none';
      }
    }, 400);
    
    isUIExpanded = false;
  }
}

function endSession() {
  // Send message to React component to end session
  const event = new CustomEvent('jmimi-end-session');
  document.dispatchEvent(event);
  
  // Hide the main UI
  hideMainUI();
  
  // Optionally hide the mini button too
  // if (miniButton) {
  //   miniButton.style.display = 'none';
  //   isUIVisible = false;
  // }
}

function makeDraggable(element: HTMLElement, handle: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let startX = 0, startY = 0;
  
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    isDragging = false;
    
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    
    // Check if we've moved enough to consider this a drag
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);
    if (deltaX > 5 || deltaY > 5) {
      isDragging = true;
    }
    
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // For mini button, maintain its transform
    if (element === miniButton) {
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    } else {
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
    }
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    
    // Reset isDragging after a short delay to allow click handler to check it
    setTimeout(() => {
      isDragging = false;
    }, 10);
  }
}

// Auto-inject UI when extension is loaded (optional)
// showLiveKitUI();
