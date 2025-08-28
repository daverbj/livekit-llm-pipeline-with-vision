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
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: move;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 999999;
    user-select: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  miniButton.innerHTML = `
    <div style="
      color: white; 
      font-size: 12px; 
      font-weight: 600; 
      text-align: center;
      line-height: 1.2;
    ">
      <div style="font-size: 16px; margin-bottom: 2px;">🎭</div>
      <div>JMimi</div>
    </div>
  `;

  // Add hover effects
  miniButton.addEventListener('mouseenter', () => {
    if (!isDragging) {
      miniButton.style.transform = 'scale(1.1)';
      miniButton.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.2)';
    }
  });

  miniButton.addEventListener('mouseleave', () => {
    if (!isDragging) {
      miniButton.style.transform = 'scale(1)';
      miniButton.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
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
