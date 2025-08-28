// Content script with injected LiveKit UI
// This runs in the actual web page context where media permissions work properly

import { createRoot } from 'react-dom/client'
import React from 'react'
import { LiveKitInjectedApp } from './components/LiveKitInjectedApp'

// Import Tailwind CSS as text
const cssText = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles for better injection */
#livekit-injected-ui * {
  box-sizing: border-box;
}

/* Custom animations */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Basic Tailwind utility classes for the injected content */
.fixed { position: fixed; }
.top-5 { top: 1.25rem; }
.right-5 { right: 1.25rem; }
.w-full { width: 100%; }
.h-full { height: 100%; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.flex-1 { flex: 1 1 0%; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: 0.5rem; }
.gap-3 { gap: 0.75rem; }
.gap-4 { gap: 1rem; }
.p-3 { padding: 0.75rem; }
.p-4 { padding: 1rem; }
.p-8 { padding: 2rem; }
.px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-6 { margin-bottom: 1.5rem; }
.mt-1 { margin-top: 0.25rem; }
.mt-3 { margin-top: 0.75rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.w-2 { width: 0.5rem; }
.h-2 { height: 0.5rem; }
.w-3 { width: 0.75rem; }
.h-3 { height: 0.75rem; }
.w-4 { width: 1rem; }
.h-4 { height: 1rem; }
.w-5 { width: 1.25rem; }
.h-5 { height: 1.25rem; }
.w-8 { width: 2rem; }
.h-8 { height: 2rem; }
.w-12 { width: 3rem; }
.h-12 { height: 3rem; }
.w-16 { width: 4rem; }
.h-16 { height: 4rem; }
.w-64 { width: 16rem; }
.h-64 { height: 16rem; }
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-sans { font-family: ui-sans-serif, system-ui, sans-serif; }
.text-center { text-align: center; }
.capitalize { text-transform: capitalize; }
.rounded-full { border-radius: 9999px; }
.rounded-lg { border-radius: 0.5rem; }
.rounded-xl { border-radius: 0.75rem; }
.border { border-width: 1px; }
.border-t { border-top-width: 1px; }
.border-b { border-bottom-width: 1px; }
.bg-white { background-color: rgb(255 255 255); }
.bg-gray-50 { background-color: rgb(249 250 251); }
.bg-gray-200 { background-color: rgb(229 231 235); }
.bg-gray-300 { background-color: rgb(209 213 219); }
.bg-gray-400 { background-color: rgb(156 163 175); }
.bg-gray-500 { background-color: rgb(107 114 128); }
.bg-gray-600 { background-color: rgb(75 85 99); }
.bg-gray-900 { background-color: rgb(17 24 39); }
.bg-blue-50 { background-color: rgb(239 246 255); }
.bg-blue-100 { background-color: rgb(219 234 254); }
.bg-blue-500 { background-color: rgb(59 130 246); }
.bg-blue-600 { background-color: rgb(37 99 235); }
.bg-green-50 { background-color: rgb(240 253 244); }
.bg-green-500 { background-color: rgb(34 197 94); }
.bg-green-600 { background-color: rgb(22 163 74); }
.bg-red-50 { background-color: rgb(254 242 242); }
.bg-red-500 { background-color: rgb(239 68 68); }
.bg-red-600 { background-color: rgb(220 38 38); }
.bg-yellow-500 { background-color: rgb(234 179 8); }
.bg-purple-50 { background-color: rgb(250 245 255); }
.bg-purple-500 { background-color: rgb(168 85 247); }
.border-gray-200 { border-color: rgb(229 231 235); }
.border-green-200 { border-color: rgb(187 247 208); }
.border-red-200 { border-color: rgb(254 202 202); }
.border-blue-200 { border-color: rgb(191 219 254); }
.text-white { color: rgb(255 255 255); }
.text-gray-400 { color: rgb(156 163 175); }
.text-gray-500 { color: rgb(107 114 128); }
.text-gray-600 { color: rgb(75 85 99); }
.text-gray-700 { color: rgb(55 65 81); }
.text-gray-800 { color: rgb(31 41 55); }
.text-blue-400 { color: rgb(96 165 250); }
.text-blue-500 { color: rgb(59 130 246); }
.text-blue-600 { color: rgb(37 99 235); }
.text-green-500 { color: rgb(34 197 94); }
.text-green-600 { color: rgb(22 163 74); }
.text-green-800 { color: rgb(22 101 52); }
.text-red-500 { color: rgb(239 68 68); }
.text-red-800 { color: rgb(153 27 27); }
.text-purple-600 { color: rgb(147 51 234); }
.shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
.shadow-lg { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
.overflow-auto { overflow: auto; }
.overflow-hidden { overflow: hidden; }
.cursor-pointer { cursor: pointer; }
.cursor-not-allowed { cursor: not-allowed; }
.transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
.transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
.duration-200 { transition-duration: 200ms; }
.hover\\:bg-blue-600:hover { background-color: rgb(37 99 235); }
.hover\\:bg-blue-700:hover { background-color: rgb(29 78 216); }
.hover\\:bg-green-600:hover { background-color: rgb(22 163 74); }
.hover\\:bg-green-700:hover { background-color: rgb(21 128 61); }
.hover\\:bg-red-600:hover { background-color: rgb(220 38 38); }
.hover\\:bg-red-700:hover { background-color: rgb(185 28 28); }
.hover\\:bg-gray-600:hover { background-color: rgb(75 85 99); }
.hover\\:bg-purple-600:hover { background-color: rgb(147 51 234); }
.hover\\:scale-105:hover { transform: scale(1.05); }
.focus\\:ring-2:focus { box-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color); }
.focus\\:ring-blue-500:focus { --tw-ring-color: rgb(59 130 246); }
.focus\\:border-blue-500:focus { border-color: rgb(59 130 246); }
.outline-none { outline: 2px solid transparent; outline-offset: 2px; }
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.relative { position: relative; }
.absolute { position: absolute; }
.bottom-3 { bottom: 0.75rem; }
.left-3 { left: 0.75rem; }
.bg-black { background-color: rgb(0 0 0); }
.bg-opacity-50 { background-color: rgb(0 0 0 / 0.5); }
.object-cover { object-fit: cover; }
.object-contain { object-fit: contain; }
.space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
.space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
`

export {};

let injectedUI: HTMLElement | null = null;
let miniButton: HTMLElement | null = null;
let reactRoot: any = null;
let isReactAppRendered = false;
let isUIVisible = false;
let isUIExpanded = false;
let isDragging = false;

// Initialize content script
console.log('LiveKit content script loaded');
console.log('Initial state - isUIExpanded:', isUIExpanded, 'isUIVisible:', isUIVisible);

// Global cleanup function
function globalCleanup() {
  console.log('Global cleanup of all UI elements');
  
  // Remove all existing UI elements
  const existingUIs = document.querySelectorAll('#livekit-injected-ui');
  existingUIs.forEach((ui, index) => {
    console.log(`Removing UI instance ${index + 1}`);
    ui.remove();
  });
  
  const existingButtons = document.querySelectorAll('#jmimi-mini-button');
  existingButtons.forEach((btn, index) => {
    console.log(`Removing mini button instance ${index + 1}`);
    btn.remove();
  });
  
  // Clean up React root
  if (reactRoot) {
    console.log('Unmounting React root');
    reactRoot.unmount();
    reactRoot = null;
    isReactAppRendered = false;
  }
  
  // Reset all state
  injectedUI = null;
  miniButton = null;
  isUIVisible = false;
  isUIExpanded = false;
  isDragging = false;
  
  console.log('Global cleanup completed');
}

// Inject Tailwind CSS into the page
function injectTailwindCSS() {
  if (document.getElementById('jmimi-tailwind-styles')) {
    return; // Already injected
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'jmimi-tailwind-styles';
  styleElement.textContent = cssText;
  document.head.appendChild(styleElement);
  console.log('JMimi Tailwind CSS injected');
}

// Auto-initialize the mini button on page load
globalCleanup(); // Ensure clean state first
initializeMiniButton();

function initializeMiniButton() {
  console.log('Initializing mini button - using global cleanup');
  
  // Use global cleanup to ensure clean state
  globalCleanup();
  
  console.log('State reset - isUIExpanded:', isUIExpanded, 'isUIVisible:', isUIVisible);
  
  // Inject CSS first
  injectTailwindCSS();
  
  // Wait a bit for the page to load completely
  setTimeout(() => {
    showMiniButton();
    // Don't auto-show the main UI - only show mini button
    // User will click the mini button to toggle the main UI
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
      sendResponse({ success: true, visible: isUIExpanded }); // Return main UI state
      return true;
    }
  } catch (error) {
    console.error('Content script error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true;
});

function showMiniButton() {
  // Check if mini button already exists and is valid
  if (miniButton && document.contains(miniButton)) {
    miniButton.style.display = 'block';
    return;
  }
  
  // Safety check - ensure no existing mini button exists
  const existingButton = document.getElementById('jmimi-mini-button');
  if (existingButton) {
    console.log('Found existing mini button, removing it first');
    existingButton.remove();
  }

  console.log('Creating mini button - main UI should NOT be visible yet');
  console.log('isUIExpanded before mini button creation:', isUIExpanded);

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
  isUIVisible = true; // Mini button is now visible
  console.log('JMimi mini button created');
}

function toggleMainUI() {
  console.log('toggleMainUI called - isUIExpanded:', isUIExpanded);
  console.log('toggleMainUI called - injectedUI exists:', !!injectedUI);
  
  if (isUIExpanded) {
    console.log('Calling hideMainUI()');
    hideMainUI();
  } else {
    console.log('Calling showMainUI()');
    showMainUI();
  }
}

function showMainUI() {
  console.log('showMainUI called - injectedUI exists:', !!injectedUI);
  
  // First, ensure no duplicate UIs exist by removing ALL existing instances
  const existingUIs = document.querySelectorAll('#livekit-injected-ui, [id^="livekit-injected-ui"]');
  if (existingUIs.length > 0) {
    console.log(`Found ${existingUIs.length} existing UI instances, removing all...`);
    existingUIs.forEach((ui, index) => {
      console.log(`Removing existing UI instance ${index + 1}`);
      ui.remove();
    });
    // Reset state
    injectedUI = null;
    isReactAppRendered = false;
    if (reactRoot) {
      console.log('Unmounting existing React root');
      reactRoot.unmount();
      reactRoot = null;
    }
  }
  
  // Always create a fresh UI to prevent duplicates
  console.log('Creating fresh main UI (no reuse to prevent duplicates)');

  console.log('Creating fresh main UI (no reuse to prevent duplicates)');
  
  // Ensure CSS is injected
  injectTailwindCSS();

  // Create the main UI container - starts hidden off-screen to the right
  injectedUI = document.createElement('div');
  injectedUI.id = 'livekit-injected-ui';
  injectedUI.style.cssText = `
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    width: 420px;
    height: 650px;
    background-color: white;
    border: none;
    border-radius: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden;
    resize: both;
    min-width: 380px;
    min-height: 500px;
    max-width: 600px;
    max-height: 800px;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(450px);
    display: block;
  `;
  
  console.log('Main UI element created with transform:', injectedUI.style.transform);

  // Add drag handle with modern design
  const dragHandle = document.createElement('div');
  dragHandle.className = 'bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 flex justify-between items-center font-semibold text-sm rounded-t-2xl';
  
  dragHandle.innerHTML = `
    <div class="flex items-center gap-3">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: white;">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="currentColor"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19v4M8 23h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>JMimi AI Assistant</span>
    </div>
    <div class="flex gap-2">
      <button id="minimize-jmimi" class="bg-white bg-opacity-15 hover:bg-opacity-25 text-white w-8 h-8 rounded-lg transition-all flex items-center justify-center" title="Minimize">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 12h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      <button id="close-jmimi" class="bg-red-500 bg-opacity-90 hover:bg-opacity-100 hover:scale-105 text-white w-8 h-8 rounded-lg transition-all flex items-center justify-center" title="End Session">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Add React app container
  const appContainer = document.createElement('div');
  appContainer.id = 'livekit-app-container';
  appContainer.className = 'h-[calc(100%-64px)] overflow-hidden bg-gray-50';

  injectedUI.appendChild(dragHandle);
  injectedUI.appendChild(appContainer);
  document.body.appendChild(injectedUI);

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

  // Render React app - always create fresh to prevent duplicate Room instances
  console.log('Creating fresh React root and rendering app');
  reactRoot = createRoot(appContainer);
  reactRoot.render(React.createElement(LiveKitInjectedApp));
  isReactAppRendered = true;

  // Slide in animation after a short delay to ensure DOM is ready
  setTimeout(() => {
    if (injectedUI) {
      console.log('Starting slide in animation');
      injectedUI.style.transform = 'translateX(0)';
    }
  }, 100);

  isUIExpanded = true;
  console.log('JMimi main UI created and sliding in - isUIExpanded set to true');
}

function makeMiniButtonDraggable(element: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let startX = 0, startY = 0;
  let hasMoved = false;
  let dragStartTime = 0;
  
  element.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startY = e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    hasMoved = false;
    dragStartTime = Date.now();
    
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
    
    const dragDuration = Date.now() - dragStartTime;
    
    // If we moved, save position
    if (hasMoved) {
      const rect = element.getBoundingClientRect();
      const position = {
        bottom: window.innerHeight - rect.bottom,
        right: window.innerWidth - rect.right
      };
      localStorage.setItem('jmimi-position', JSON.stringify(position));
      console.log('JMimi button position saved');
    } else if (dragDuration < 500) {
      // If we didn't move and it was a quick click, toggle the main UI
      console.log('JMimi mini button clicked - toggling main UI');
      console.log('Current state before toggle - isUIExpanded:', isUIExpanded, 'hasMoved:', hasMoved, 'dragDuration:', dragDuration);
      toggleMainUI();
    } else {
      console.log('Click not registered - dragDuration too long:', dragDuration);
    }
    
    // Reset isDragging after a short delay
    setTimeout(() => {
      isDragging = false;
    }, 100);
  }
}

function hideMainUI() {
  console.log('hideMainUI called - injectedUI exists:', !!injectedUI);
  
  // Find all UI instances and hide them
  const allUIs = document.querySelectorAll('#livekit-injected-ui, [id^="livekit-injected-ui"]');
  
  if (allUIs.length > 0) {
    console.log(`Found ${allUIs.length} UI instance(s) to hide`);
    
    allUIs.forEach((ui, index) => {
      console.log(`Sliding out UI instance ${index + 1}`);
      const htmlElement = ui as HTMLElement;
      htmlElement.style.transform = 'translateX(450px)';
      
      // Hide after animation completes
      setTimeout(() => {
        if (document.contains(htmlElement)) {
          htmlElement.style.display = 'none';
          console.log(`UI instance ${index + 1} hidden after animation`);
        }
      }, 300);
    });
    
    // Clean up React state
    if (reactRoot) {
      console.log('Unmounting React root during hide');
      setTimeout(() => {
        if (reactRoot) {
          reactRoot.unmount();
          reactRoot = null;
          isReactAppRendered = false;
        }
      }, 300);
    }
    
    isUIExpanded = false;
    console.log('All main UI instances sliding out - isUIExpanded set to false');
  }
}

function endSession() {
  console.log('Ending session - cleaning up all UI elements');
  
  // Send message to React component to end session
  const event = new CustomEvent('jmimi-end-session');
  document.dispatchEvent(event);
  
  // Hide the main UI
  hideMainUI();
  
  // Clean up any remaining UI elements after a delay
  setTimeout(() => {
    const remainingUIs = document.querySelectorAll('#livekit-injected-ui, [id^="livekit-injected-ui"]');
    remainingUIs.forEach((ui, index) => {
      console.log(`Removing remaining UI element ${index + 1}`);
      ui.remove();
    });
    injectedUI = null;
    isUIExpanded = false;
  }, 500);
  
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
