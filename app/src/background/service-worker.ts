/**
 * Background Service Worker for Glide Reader Extension
 * Handles Alt+F hotkey and coordinates with content scripts
 */

// Listen for hotkey command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-glide') {
    // Send message to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'toggle-glide' });
      }
    });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'toggle-glide' });
  }
});

// Service worker installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Glide Reader extension installed');
});

// Keep service worker alive (Chrome will terminate it when idle)
// This is a simple heartbeat to maintain state
let heartbeatInterval: number;

self.addEventListener('activate', () => {
  heartbeatInterval = setInterval(() => {
    // Lightweight heartbeat - just a no-op to prevent termination
  }, 20000) as unknown as number;
});

self.addEventListener('deactivate', () => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
});

export {};
