// Background service worker for tracking tab activity
const TAB_ACTIVITY_KEY = 'tab_activity_data';

// Helper to get tab activity state
async function getTabActivity() {
  return new Promise((resolve) => {
    chrome.storage.local.get([TAB_ACTIVITY_KEY], (result) => {
      resolve(result[TAB_ACTIVITY_KEY] || {});
    });
  });
}

// Helper to save tab activity state
async function saveTabActivity(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [TAB_ACTIVITY_KEY]: data }, () => {
      resolve();
    });
  });
}

// Update last active time for a tab
async function updateTabActiveTime(tabId) {
  if (!tabId) return;
  const data = await getTabActivity();
  data[tabId] = Date.now();
  await saveTabActivity(data);
}

// Remove tab from activity record
async function removeTabActivity(tabId) {
  if (!tabId) return;
  const data = await getTabActivity();
  if (data[tabId]) {
    delete data[tabId];
    await saveTabActivity(data);
  }
}

// On extension install or service worker start, initialize tab tracking
chrome.runtime.onInstalled.addListener(async () => {
  await initializeTracking();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeTracking();
});

async function initializeTracking() {
  const data = await getTabActivity();
  chrome.tabs.query({}, async (tabs) => {
    const now = Date.now();
    const currentTabIds = new Set();

    tabs.forEach((tab) => {
      currentTabIds.add(tab.id.toString());
      if (!data[tab.id]) {
        // Use current time as fallback for active tab, and slightly staggered times for others
        data[tab.id] = tab.active ? now : now - 10000;
      }
    });

    // Clean up IDs in storage that are no longer open tabs
    Object.keys(data).forEach((id) => {
      if (!currentTabIds.has(id)) {
        delete data[id];
      }
    });

    await saveTabActivity(data);
  });
}

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener((activeInfo) => {
  updateTabActiveTime(activeInfo.tabId);
});

// Listen for tab updates (e.g. loading URL)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || tab.active) {
    updateTabActiveTime(tabId);
  }
});

// Listen for tab creation
chrome.tabs.onCreated.addListener((tab) => {
  updateTabActiveTime(tab.id);
});

// Listen for tab closure
chrome.tabs.onRemoved.addListener((tabId) => {
  removeTabActivity(tabId);
});
