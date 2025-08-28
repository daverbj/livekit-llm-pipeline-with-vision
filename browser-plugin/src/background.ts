// Background script for LiveKit Browser Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log("LiveKit Browser Plugin installed")
})

// Handle extension icon click to show injected LiveKit UI
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    console.error('No tab ID available');
    return;
  }

  // Check if we're on a valid page (not chrome:// or extension pages)
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
    console.warn('Cannot inject content script on special pages:', tab.url);
    return;
  }

  try {
    console.log('Attempting to toggle LiveKit UI on tab:', tab.id);
    
    // Try to send message to existing content script
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_LIVEKIT_UI' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      console.log('LiveKit UI toggled:', response);
      return;
    } catch (messageError) {
      console.log('Content script not responding, waiting for Plasmo injection...');
    }
    
    // Wait for Plasmo auto-injection and try again
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      const response = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_LIVEKIT_UI' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
      console.log('LiveKit UI toggled after waiting:', response);
    } catch (retryError) {
      console.error('Content script still not responding after retry:', retryError);
      
      // Show helpful notification
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const notification = document.createElement('div');
            notification.style.cssText = `
              position: fixed;
              top: 20px;
              right: 20px;
              background: #f59e0b;
              color: white;
              padding: 12px 16px;
              border-radius: 8px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              z-index: 999999;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
            `;
            notification.textContent = 'LiveKit extension is loading... Please refresh the page and try again.';
            document.body.appendChild(notification);
            
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 4000);
          }
        });
      } catch (scriptError) {
        console.error('Failed to inject notification script:', scriptError);
      }
    }
    
  } catch (error) {
    console.error('Failed to inject LiveKit UI:', error);
  }
})

// Clean up message listener - only handle essential messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  if (message.action === "getTabInfo") {
    sendResponse({ 
      success: true, 
      tabId: sender.tab?.id,
      url: sender.tab?.url 
    });
  }
})

export {}
