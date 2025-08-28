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

// Auto-initialize the mini button on page load
initializeMiniButton();

function initializeMiniButton() {
  // Wait a bit for the page to load completely
  setTimeout(() => {
    showMiniButton();
  }, 1500);
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message);
  
  try {
    if (message.type === 'TOGGLE_LIVEKIT_UI') {
      // If mini button doesn't exist, create it
      if (!miniButton) {
        showMiniButton();
      }
      // Toggle the main UI panel
      toggleMainUI();
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

  // Get saved position or use defaults
  const savedPosition = localStorage.getItem('jmimi-position');
  let position = { bottom: 20, right: 20 };
  
  if (savedPosition) {
    try {
      position = JSON.parse(savedPosition);
    } catch (e) {
      console.log('Failed to parse saved position, using defaults');
    }
  }

  // Create the mini floating button
  miniButton = document.createElement('div');
  miniButton.id = 'jmimi-mini-button';
  miniButton.style.cssText = `
    position: fixed;
    bottom: ${position.bottom}px;
    right: ${position.right}px;
    width: 56px;
    height: 56px;
    background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    z-index: 999999;
    user-select: none;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 2px solid rgba(255, 255, 255, 0.2);
  `;

  miniButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  // Add hover effects
  miniButton.addEventListener('mouseenter', () => {
    if (!isDragging) {
      miniButton.style.transform = 'scale(1.05)';
      miniButton.style.boxShadow = '0 20px 40px -10px rgba(59, 130, 246, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    }
  });

  miniButton.addEventListener('mouseleave', () => {
    if (!isDragging) {
      miniButton.style.transform = 'scale(1)';
      miniButton.style.boxShadow = '0 10px 25px -5px rgba(59, 130, 246, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
    }
  });

  // Add click handler to toggle main UI
  // Removed - handled in drag function now

  // Make draggable
  makeMiniButtonDraggable(miniButton);

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
    width: 420px;
    height: 650px;
    background: white;
    border: none;
    border-radius: 20px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    resize: both;
    min-width: 380px;
    min-height: 500px;
    max-width: 600px;
    max-height: 800px;
    transform: translateX(450px);
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    backdrop-filter: blur(10px);
  `;

  // Add drag handle with modern design
  const dragHandle = document.createElement('div');
  dragHandle.style.cssText = `
    background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
    color: white;
    padding: 16px 20px;
    user-select: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
    font-size: 15px;
    border-radius: 20px 20px 0 0;
  `;
  
  dragHandle.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>JMimi AI Assistant</span>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="minimize-jmimi" style="
        background: rgba(255,255,255,0.15); 
        border: none; 
        color: white; 
        cursor: pointer; 
        width: 32px;
        height: 32px;
        border-radius: 8px; 
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        font-weight: 300;
      " title="Minimize">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button id="close-jmimi" style="
        background: rgba(239, 68, 68, 0.9); 
        border: none; 
        color: white; 
        cursor: pointer; 
        width: 32px;
        height: 32px;
        border-radius: 8px; 
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      " title="End Session">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Add React app container
  const appContainer = document.createElement('div');
  appContainer.id = 'livekit-app-container';
  appContainer.style.cssText = `
    height: calc(100% - 64px);
    overflow: hidden;
    background: #f8fafc;
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
        if (btn === minimizeBtn) {
          (btn as HTMLElement).style.background = 'rgba(255,255,255,0.25)';
        } else {
          (btn as HTMLElement).style.background = 'rgba(239, 68, 68, 1)';
          (btn as HTMLElement).style.transform = 'scale(1.05)';
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (btn === minimizeBtn) {
          (btn as HTMLElement).style.background = 'rgba(255,255,255,0.15)';
        } else {
          (btn as HTMLElement).style.background = 'rgba(239, 68, 68, 0.9)';
          (btn as HTMLElement).style.transform = 'scale(1)';
        }
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

function makeMiniButtonDraggable(element: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let startX = 0, startY = 0;
  let hasMoved = false;
  
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    hasMoved = false;
    // Don't set isDragging yet - wait until we actually move
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    
    // Calculate distance moved
    const deltaX = Math.abs(e.clientX - startX);
    const deltaY = Math.abs(e.clientY - startY);
    
    // Only start dragging if moved more than 5px
    if (deltaX > 5 || deltaY > 5) {
      hasMoved = true;
      isDragging = true;
      
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      
      // Update position
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    
    // If we moved, save position
    if (hasMoved) {
      const rect = element.getBoundingClientRect();
      const position = {
        bottom: window.innerHeight - rect.bottom,
        right: window.innerWidth - rect.right
      };
      localStorage.setItem('jmimi-position', JSON.stringify(position));
    } else {
      // If we didn't move, it's a click - toggle the main UI
      console.log('JMimi clicked - toggling main UI');
      toggleMainUI();
    }
    
    // Reset isDragging after a short delay
    setTimeout(() => {
      isDragging = false;
    }, 100);
  }
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
    
    // Save the new position to localStorage
    if (miniButton) {
      const rect = miniButton.getBoundingClientRect();
      const position = {
        bottom: window.innerHeight - rect.bottom,
        right: window.innerWidth - rect.right
      };
      localStorage.setItem('jmimi-position', JSON.stringify(position));
    }
    
    // Reset isDragging after a short delay to allow click handler to check it
    setTimeout(() => {
      isDragging = false;
    }, 10);
  }
}
