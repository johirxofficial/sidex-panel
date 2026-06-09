/* ============================================================
   SideX Panel — Background Service Worker
   Handles: sidePanel behavior, UA session rules, pop-out window
   ============================================================ */

// Open side panel when the extension action icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Default side panel options
chrome.sidePanel.setOptions({
  path: 'sidepanel.html',
  enabled: true
}).catch(() => {});

// Mobile User-Agent string (iOS Safari)
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 ' +
  'Mobile/15E148 Safari/604.1';

// Rule IDs for session-based UA switching
const MOBILE_UA_RULE_ID = 1000;

// Listen for messages from sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'setViewMode') {
    setViewMode(message.mode).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  }

  if (message.action === 'popOut') {
    handlePopOut(message.state).then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.action === 'getViewMode') {
    getViewMode().then((mode) => {
      sendResponse({ mode: mode });
    }).catch(() => {
      sendResponse({ mode: 'desktop' });
    });
    return true;
  }
});

// Apply or remove the mobile UA session rule
async function setViewMode(mode) {
  // Remove any existing session UA rules
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const idsToRemove = existing.map((r) => r.id);
  if (idsToRemove.length > 0) {
    await chrome.declarativeNetRequest.removeSessionRules(idsToRemove);
  }

  if (mode === 'mobile') {
    await chrome.declarativeNetRequest.updateSessionRules([
      {
        id: MOBILE_UA_RULE_ID,
        priority: 2,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'User-Agent', operation: 'set', value: MOBILE_UA }
          ]
        },
        condition: {
          urlFilter: '*',
          resourceTypes: ['sub_frame', 'main_frame']
        }
      }
    ]);
  }

  // Persist the view mode
  await chrome.storage.local.set({ viewMode: mode });
}

// Read the current view mode from session rules
async function getViewMode() {
  const existing = await chrome.declarativeNetRequest.getSessionRules();
  const hasMobileRule = existing.some((r) => r.id === MOBILE_UA_RULE_ID);
  return hasMobileRule ? 'mobile' : 'desktop';
}

// Spawn a detached popup window with the same panel content
async function handlePopOut(state) {
  // Save the pop-out state so the new window can read it
  if (state) {
    await chrome.storage.local.set({ popOutState: state });
  }

  const width = 480;
  const height = 720;
  const left = screen.availWidth - width - 20;
  const top = 80;

  await chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html?popout=1'),
    type: 'popup',
    width: width,
    height: height,
    left: left,
    top: top,
    focused: true
  });
}

// On install, set default view mode
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ viewMode: 'desktop' });
});
