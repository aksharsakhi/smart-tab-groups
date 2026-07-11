// Smart Tab Groups - Popup JS Logic

// Constants
const TAB_ACTIVITY_KEY = 'tab_activity_data';
const WORKSPACES_KEY = 'saved_workspaces';
const SETTINGS_KEY = 'extension_settings';
const CUSTOM_RULES_KEY = 'custom_grouping_rules';

// Default rules for grouping
const defaultGroupingRules = [
  { domain: 'github.com', category: 'coding' },
  { domain: 'stackoverflow.com', category: 'coding' },
  { domain: 'localhost', category: 'coding' },
  { domain: 'gitlab.com', category: 'coding' },
  { domain: 'developer.mozilla.org', category: 'coding' },
  { domain: 'codepen.io', category: 'coding' },
  { domain: 'npmtrends.com', category: 'coding' },
  { domain: 'amazon.com', category: 'shopping' },
  { domain: 'ebay.com', category: 'shopping' },
  { domain: 'target.com', category: 'shopping' },
  { domain: 'walmart.com', category: 'shopping' },
  { domain: 'shopify.com', category: 'shopping' },
  { domain: 'youtube.com', category: 'media' },
  { domain: 'netflix.com', category: 'media' },
  { domain: 'spotify.com', category: 'media' },
  { domain: 'vimeo.com', category: 'media' },
  { domain: 'wikipedia.org', category: 'college' },
  { domain: 'scholar.google.com', category: 'college' },
  { domain: 'notion.so', category: 'college' },
  { domain: 'arxiv.org', category: 'college' },
  { domain: 'twitter.com', category: 'social' },
  { domain: 'x.com', category: 'social' },
  { domain: 'reddit.com', category: 'social' },
  { domain: 'linkedin.com', category: 'social' },
  { domain: 'facebook.com', category: 'social' }
];

const categoryConfig = {
  coding: { name: 'Coding', color: 'cyan', class: 'coding' },
  shopping: { name: 'Shopping', color: 'orange', class: 'shopping' },
  college: { name: 'College', color: 'purple', class: 'college' },
  media: { name: 'YouTube', color: 'red', class: 'media' },
  social: { name: 'Social', color: 'green', class: 'social' }
};

const tips = [
  "Grouping tabs reduces visual clutter and frees up memory.",
  "You can save your current session as a 'Workspace' to restore it later.",
  "Tabs inactive for a long time are flagged as 'Stale' under the Cleaner tab.",
  "Exact duplicate tabs can be closed in bulk using the Duplicates tab.",
  "Add your own domain rules in Settings to customize how tabs group automatically."
];

// State variables
let activeTabId = 'dashboard';
let currentTabs = [];
let currentGroups = [];
let duplicateGroups = {};
let staleTabs = [];
let savedWorkspaces = [];
let customRules = [];
let activityData = {};
let settings = {
  staleThresholdMins: 120 // 2 hours
};

// Initialize UI and load states
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadData();
  renderDashboard();
  renderGroupsList();
  renderCleaner();
  renderWorkspaces();
  renderSettings();
  showRandomTip();
  
  // Bind Header Button
  document.getElementById('quick-group-btn').addEventListener('click', performAutoGrouping);
});

// Setup Panel Navigation
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update Tab CSS
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update Panel Visibility
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${targetTab}`).classList.add('active');
      
      activeTabId = targetTab;
      refreshCurrentState().then(() => {
        if (targetTab === 'dashboard') renderDashboard();
        if (targetTab === 'groups') renderGroupsList();
        if (targetTab === 'cleaner') renderCleaner();
        if (targetTab === 'workspaces') renderWorkspaces();
        if (targetTab === 'settings') renderSettings();
      });
    });
  });
}

// Load configurations and states from Chrome Storage
async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get([WORKSPACES_KEY, SETTINGS_KEY, CUSTOM_RULES_KEY, TAB_ACTIVITY_KEY], (res) => {
      savedWorkspaces = res[WORKSPACES_KEY] || [];
      settings = res[SETTINGS_KEY] || { staleThresholdMins: 120 };
      customRules = res[CUSTOM_RULES_KEY] || [];
      activityData = res[TAB_ACTIVITY_KEY] || {};
      
      refreshCurrentState().then(resolve);
    });
  });
}

// Fetch live window tabs, groups and update local cache
async function refreshCurrentState() {
  return new Promise((resolve) => {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      currentTabs = tabs;
      
      chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (groups) => {
        currentGroups = groups;
        analyzeDuplicates();
        analyzeStaleTabs();
        resolve();
      });
    });
  });
}

// Random tip rotator
function showRandomTip() {
  const tipEl = document.getElementById('dynamic-tip');
  if (tipEl) {
    const rand = Math.floor(Math.random() * tips.length);
    tipEl.textContent = tips[rand];
  }
}

// -------------------------------------------------------------
// Core Feature 1: Smart Tab Grouping Engine (Offline Heuristic)
// -------------------------------------------------------------
function classifyTab(tab) {
  if (!tab.url) return null;
  
  let urlObj;
  try {
    urlObj = new URL(tab.url);
  } catch (e) {
    return null;
  }
  
  const hostname = urlObj.hostname.toLowerCase();
  const pathname = urlObj.pathname.toLowerCase();
  const title = (tab.title || '').toLowerCase();
  
  // 1. Check custom rules first
  for (const rule of customRules) {
    if (hostname.includes(rule.domain.toLowerCase())) {
      return rule.category;
    }
  }
  
  // 2. Check default domain rules
  for (const rule of defaultGroupingRules) {
    if (hostname.includes(rule.domain)) {
      return rule.category;
    }
  }
  
  // 3. Keyword / Regex checks on URL path and title (Offline NLP heuristics)
  const keywords = {
    coding: ['code', 'git', 'dev', 'api', 'npm', 'program', 'rust', 'python', 'javascript', 'console', 'deploy', 'aws', 'docker', 'stack', 'editor'],
    shopping: ['shop', 'store', 'buy', 'cart', 'checkout', 'product', 'deal', 'order', 'price', 'purchase'],
    college: ['edu', 'university', 'school', 'paper', 'research', 'thesis', 'lecture', 'course', 'class', 'scholar', 'study', 'science', 'wiki', 'journal', 'pdf'],
    media: ['youtube', 'video', 'music', 'play', 'watch', 'stream', 'movie', 'tv', 'listen', 'audio', 'podcast', 'netflix', 'spotify'],
    social: ['social', 'chat', 'mail', 'reddit', 'twitter', 'facebook', 'linkedin', 'instagram', 'message', 'feed', 'slack', 'discord']
  };
  
  // Check title & path against keyword lists
  for (const [category, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (title.includes(word) || pathname.includes(word) || hostname.includes(word)) {
        return category;
      }
    }
  }
  
  return null;
}

// Execute Auto Grouping
async function performAutoGrouping() {
  showToast("Analyzing tabs...", "info");
  await refreshCurrentState();
  
  const groupedTabs = {
    coding: [],
    shopping: [],
    college: [],
    media: [],
    social: []
  };
  
  let matchCount = 0;
  
  currentTabs.forEach(tab => {
    // Avoid re-grouping tabs that are pinned unless they ask
    if (tab.pinned) return;
    
    const cat = classifyTab(tab);
    if (cat && groupedTabs[cat]) {
      groupedTabs[cat].push(tab.id);
      matchCount++;
    }
  });
  
  if (matchCount === 0) {
    showToast("No tabs matched default categories.", "warning");
    return;
  }
  
  // Group matching tabs in Chrome API
  for (const [cat, tabIds] of Object.entries(groupedTabs)) {
    if (tabIds.length === 0) continue;
    
    try {
      const newGroupId = await new Promise((resolve) => {
        chrome.tabs.group({ tabIds: tabIds }, resolve);
      });
      
      const config = categoryConfig[cat];
      await new Promise((resolve) => {
        chrome.tabGroups.update(newGroupId, { title: config.name, color: config.color }, resolve);
      });
    } catch (e) {
      console.error(`Failed to group ${cat} tabs:`, e);
    }
  }
  
  showToast(`Successfully grouped ${matchCount} tabs!`, "success");
  await refreshCurrentState();
  renderDashboard();
  renderGroupsList();
}

// -------------------------------------------------------------
// Core Feature 2: Find Duplicate Tabs
// -------------------------------------------------------------
function normalizeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    // Strip hash anchors and trailing slashes to check duplicates
    return url.origin + url.pathname.replace(/\/$/, '') + url.search;
  } catch (e) {
    return urlStr;
  }
}

function analyzeDuplicates() {
  duplicateGroups = {};
  const urlMap = {};
  
  currentTabs.forEach(tab => {
    if (!tab.url) return;
    const normalized = normalizeUrl(tab.url);
    if (!urlMap[normalized]) {
      urlMap[normalized] = [];
    }
    urlMap[normalized].push(tab);
  });
  
  // Keep only groups with more than 1 tab
  for (const [url, tabs] of Object.entries(urlMap)) {
    if (tabs.length > 1) {
      duplicateGroups[url] = tabs;
    }
  }
}

// Close individual duplicate instances
function closeTab(tabId) {
  chrome.tabs.remove(tabId, async () => {
    showToast("Tab closed", "success");
    await refreshCurrentState();
    renderDashboard();
    renderCleaner();
    renderGroupsList();
  });
}

// Close all but one tab in a duplicate group
function closeDuplicatesForUrl(url) {
  const tabs = duplicateGroups[url];
  if (!tabs || tabs.length <= 1) return;
  
  // Keep the active tab if possible, otherwise keep the first one
  const activeIndex = tabs.findIndex(t => t.active);
  const keepIndex = activeIndex !== -1 ? activeIndex : 0;
  const keepTab = tabs[keepIndex];
  
  const closeIds = tabs
    .filter((_, idx) => idx !== keepIndex)
    .map(t => t.id);
    
  chrome.tabs.remove(closeIds, async () => {
    showToast(`Closed ${closeIds.length} duplicates`, "success");
    await refreshCurrentState();
    renderDashboard();
    renderCleaner();
  });
}

// Bulk close all duplicates
function closeAllDuplicates() {
  const closeIds = [];
  
  Object.values(duplicateGroups).forEach(tabs => {
    const activeIndex = tabs.findIndex(t => t.active);
    const keepIndex = activeIndex !== -1 ? activeIndex : 0;
    
    tabs.forEach((tab, idx) => {
      if (idx !== keepIndex) {
        closeIds.push(tab.id);
      }
    });
  });
  
  if (closeIds.length === 0) return;
  
  chrome.tabs.remove(closeIds, async () => {
    showToast(`Cleaned up ${closeIds.length} duplicate tabs`, "success");
    await refreshCurrentState();
    renderDashboard();
    renderCleaner();
  });
}

// -------------------------------------------------------------
// Core Feature 3: Stale Tabs Cleaner
// -------------------------------------------------------------
function analyzeStaleTabs() {
  staleTabs = [];
  const thresholdMs = settings.staleThresholdMins * 60 * 1000;
  const now = Date.now();
  
  currentTabs.forEach(tab => {
    // Active or pinned tabs shouldn't be closed as stale
    if (tab.active || tab.pinned) return;
    
    const lastActive = activityData[tab.id];
    
    // If we have track record and it exceeds threshold
    if (lastActive) {
      const idleTime = now - lastActive;
      if (idleTime > thresholdMs) {
        staleTabs.push({
          tab: tab,
          idleTimeMs: idleTime
        });
      }
    } else {
      // Fallback: If no activity data, count as stale if tab was created a while ago (heuristically)
      // Chrome tab objects don't expose created time directly, so we don't treat them as stale
      // unless registered in activity data (which background.js does immediately on launch).
    }
  });
  
  // Sort stale tabs by idle time descending (longest idle first)
  staleTabs.sort((a, b) => b.idleTimeMs - a.idleTimeMs);
}

// Bulk close all stale tabs
function closeAllStaleTabs() {
  const ids = staleTabs.map(s => s.tab.id);
  if (ids.length === 0) return;
  
  chrome.tabs.remove(ids, async () => {
    showToast(`Closed ${ids.length} inactive tabs`, "success");
    await refreshCurrentState();
    renderDashboard();
    renderCleaner();
  });
}

// Format milliseconds to readable string
function formatIdleTime(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m idle`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h idle`;
  
  const days = Math.floor(hours / 24);
  return `${days}d idle`;
}

// -------------------------------------------------------------
// Core Feature 4: Workspaces (Save / Restore)
// -------------------------------------------------------------
async function saveWorkspace() {
  const inputEl = document.getElementById('workspace-name-input');
  const name = inputEl.value.trim();
  
  if (!name) {
    showToast("Please enter a workspace name", "warning");
    return;
  }
  
  await refreshCurrentState();
  
  // Map group details for lookup
  const groupMap = {};
  currentGroups.forEach(g => {
    groupMap[g.id] = {
      title: g.title,
      color: g.color
    };
  });
  
  const tabsToSave = currentTabs.map(t => {
    const tabData = {
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      pinned: t.pinned,
      active: t.active
    };
    
    // Add group info if grouped
    if (t.groupId && t.groupId !== -1 && groupMap[t.groupId]) {
      tabData.group = groupMap[t.groupId];
    }
    
    return tabData;
  });
  
  const newWorkspace = {
    id: 'ws_' + Date.now(),
    name: name,
    timestamp: Date.now(),
    tabs: tabsToSave
  };
  
  savedWorkspaces.push(newWorkspace);
  
  // Save to Chrome Storage
  chrome.storage.local.set({ [WORKSPACES_KEY]: savedWorkspaces }, () => {
    showToast(`Workspace "${name}" saved!`, "success");
    inputEl.value = '';
    renderWorkspaces();
  });
}

// Restore saved workspace
async function restoreWorkspace(wsId) {
  const workspace = savedWorkspaces.find(ws => ws.id === wsId);
  if (!workspace) return;
  
  showToast("Restoring workspace...", "info");
  
  // Open new tabs
  const createdTabs = [];
  for (const tabData of workspace.tabs) {
    try {
      const tab = await new Promise((resolve) => {
        chrome.tabs.create({
          url: tabData.url,
          pinned: tabData.pinned,
          active: false // don't focus immediately
        }, resolve);
      });
      createdTabs.push({ id: tab.id, group: tabData.group });
    } catch (err) {
      console.error("Failed to restore tab:", err);
    }
  }
  
  // Focus the first restored tab or active one
  const activeTab = workspace.tabs.find(t => t.active);
  if (createdTabs.length > 0) {
    const focusIndex = activeTab ? workspace.tabs.indexOf(activeTab) : 0;
    if (createdTabs[focusIndex]) {
      chrome.tabs.update(createdTabs[focusIndex].id, { active: true });
    }
  }
  
  // Regroup tabs
  const groupsToCreate = {};
  createdTabs.forEach(item => {
    if (item.group) {
      const key = `${item.group.title}::${item.group.color}`;
      if (!groupsToCreate[key]) {
        groupsToCreate[key] = {
          title: item.group.title,
          color: item.group.color,
          tabIds: []
        };
      }
      groupsToCreate[key].tabIds.push(item.id);
    }
  });
  
  for (const groupData of Object.values(groupsToCreate)) {
    try {
      const newGroupId = await new Promise((resolve) => {
        chrome.tabs.group({ tabIds: groupData.tabIds }, resolve);
      });
      await new Promise((resolve) => {
        chrome.tabGroups.update(newGroupId, {
          title: groupData.title,
          color: groupData.color
        }, resolve);
      });
    } catch (e) {
      console.error("Failed to recreate tab group:", e);
    }
  }
  
  showToast("Workspace restored successfully!", "success");
  await refreshCurrentState();
  renderDashboard();
}

// Delete saved workspace
function deleteWorkspace(wsId) {
  savedWorkspaces = savedWorkspaces.filter(ws => ws.id !== wsId);
  chrome.storage.local.set({ [WORKSPACES_KEY]: savedWorkspaces }, () => {
    showToast("Workspace deleted", "success");
    renderWorkspaces();
  });
}

// -------------------------------------------------------------
// Core Feature 5: Custom Grouping Rules
// -------------------------------------------------------------
function addCustomRule() {
  const domainInput = document.getElementById('new-rule-domain');
  const catSelect = document.getElementById('new-rule-category');
  
  const domain = domainInput.value.trim().toLowerCase();
  const category = catSelect.value;
  
  if (!domain) {
    showToast("Please enter a domain", "warning");
    return;
  }
  
  // Avoid duplicate domains
  if (customRules.some(r => r.domain === domain)) {
    showToast("Rule for domain already exists", "warning");
    return;
  }
  
  customRules.push({ domain, category });
  chrome.storage.local.set({ [CUSTOM_RULES_KEY]: customRules }, () => {
    showToast("Custom rule added!", "success");
    domainInput.value = '';
    renderSettings();
  });
}

function deleteCustomRule(domain) {
  customRules = customRules.filter(r => r.domain !== domain);
  chrome.storage.local.set({ [CUSTOM_RULES_KEY]: customRules }, () => {
    showToast("Rule removed", "success");
    renderSettings();
  });
}

function resetDefaultRules() {
  customRules = [];
  chrome.storage.local.set({ [CUSTOM_RULES_KEY]: [] }, () => {
    showToast("Reset to default rules", "success");
    renderSettings();
  });
}

// -------------------------------------------------------------
// Rendering Functions
// -------------------------------------------------------------

function renderDashboard() {
  document.getElementById('stat-total-tabs').textContent = currentTabs.length;
  document.getElementById('stat-total-groups').textContent = currentGroups.length;
  
  const duplicatesCount = Object.values(duplicateGroups).reduce((acc, tabs) => acc + (tabs.length - 1), 0);
  document.getElementById('stat-duplicate-tabs').textContent = duplicatesCount;
  
  document.getElementById('stat-stale-tabs').textContent = staleTabs.length;
  
  // Limits indicators
  const ratio = Math.min(Math.round((currentTabs.length / 50) * 100), 100);
  document.getElementById('stat-tabs-ratio').textContent = `${ratio}% of limit (50)`;
  document.getElementById('stat-groups-ratio').textContent = `${currentGroups.length} active tab groups`;
  
  // Highlight cleaner tab warnings if values are high
  const dupCard = document.getElementById('stat-card-duplicates');
  const staleCard = document.getElementById('stat-card-stale');
  
  if (duplicatesCount > 0) {
    dupCard.classList.add('glow-red');
  } else {
    dupCard.classList.remove('glow-red');
  }
  
  if (staleTabs.length > 0) {
    staleCard.classList.add('glow-orange');
  } else {
    staleCard.classList.remove('glow-orange');
  }
  
  // Wire up quick actions
  const bindClick = (id, handler) => {
    const el = document.getElementById(id);
    el.replaceWith(el.cloneNode(true)); // remove old listener
    document.getElementById(id).addEventListener('click', handler);
  };
  
  bindClick('dash-group-btn', performAutoGrouping);
  bindClick('dash-duplicates-btn', () => document.getElementById('tab-cleaner').click());
  bindClick('dash-stale-btn', () => {
    document.getElementById('tab-cleaner').click();
    document.getElementById('cleaner-stale-tab').click();
  });
}

function renderGroupsList() {
  const container = document.getElementById('groups-list');
  container.innerHTML = '';
  
  document.getElementById('active-groups-count').textContent = `${currentGroups.length} Groups`;
  
  if (currentGroups.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No active tab groups. Click "Auto-Group" to sort them!</p>
      </div>
    `;
    return;
  }
  
  // Create mapping of group tabs
  const groupTabsMap = {};
  currentTabs.forEach(tab => {
    if (tab.groupId && tab.groupId !== -1) {
      if (!groupTabsMap[tab.groupId]) {
        groupTabsMap[tab.groupId] = [];
      }
      groupTabsMap[tab.groupId].push(tab);
    }
  });
  
  currentGroups.forEach(group => {
    const tabsInGroup = groupTabsMap[group.id] || [];
    
    // Resolve CSS group colors
    const colorHexes = {
      grey: '#70757a',
      blue: '#1a73e8',
      red: '#d93025',
      yellow: '#f29900',
      green: '#188038',
      pink: '#d01716',
      purple: '#a142f4',
      cyan: '#007b83',
      orange: '#fa903e'
    };
    const colorHex = colorHexes[group.color] || '#70757a';
    
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    
    // Setup group header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `
      <div class="group-header-left">
        <span class="group-color-dot" style="background-color: ${colorHex}"></span>
        <span class="group-title">${group.title || 'Untitled Group'}</span>
        <span class="group-tab-count">(${tabsInGroup.length} tabs)</span>
      </div>
      <div class="group-actions">
        <button class="group-action-btn close-grp" title="Close entire group">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
        <button class="group-action-btn toggle-expand" title="Expand/Collapse">
          <svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </div>
    `;
    
    // Click expand/collapse
    header.addEventListener('click', (e) => {
      if (e.target.closest('.group-action-btn')) return; // ignore buttons
      groupItem.classList.toggle('expanded');
    });
    
    // Close group action
    header.querySelector('.close-grp').addEventListener('click', () => {
      const ids = tabsInGroup.map(t => t.id);
      chrome.tabs.remove(ids, async () => {
        showToast(`Closed group "${group.title}"`, "success");
        await refreshCurrentState();
        renderGroupsList();
        renderDashboard();
      });
    });
    
    // Expand toggle icon click
    header.querySelector('.toggle-expand').addEventListener('click', () => {
      groupItem.classList.toggle('expanded');
    });
    
    // Tab list container
    const tabList = document.createElement('div');
    tabList.className = 'group-tabs-list';
    
    tabsInGroup.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = 'tab-item';
      
      const favicon = tab.favIconUrl || 'chrome://favicon/';
      
      tabEl.innerHTML = `
        <div class="tab-info">
          <img class="tab-favicon" src="${favicon}" onerror="this.src='icon.svg'" />
          <span class="tab-title" title="${tab.title}">${tab.title}</span>
        </div>
        <button class="tab-close-btn" title="Close Tab">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      
      // Navigate to tab on click
      tabEl.querySelector('.tab-title').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
      });
      
      // Close tab button
      tabEl.querySelector('.tab-close-btn').addEventListener('click', () => {
        closeTab(tab.id);
      });
      
      tabList.appendChild(tabEl);
    });
    
    groupItem.appendChild(header);
    groupItem.appendChild(tabList);
    container.appendChild(groupItem);
  });
}

function renderCleaner() {
  const duplicatesBadge = document.getElementById('count-duplicates-badge');
  const staleBadge = document.getElementById('count-stale-badge');
  
  const dupCount = Object.values(duplicateGroups).reduce((acc, tabs) => acc + (tabs.length - 1), 0);
  duplicatesBadge.textContent = dupCount;
  staleBadge.textContent = staleTabs.length;
  
  // Cleaner Subtab Switching
  const dupBtn = document.getElementById('cleaner-duplicates-tab');
  const staleBtn = document.getElementById('cleaner-stale-tab');
  const dupContent = document.getElementById('cleaner-duplicates-content');
  const staleContent = document.getElementById('cleaner-stale-content');
  
  const setupSubtab = (btnActive, btnInactive, contActive, contInactive) => {
    btnActive.replaceWith(btnActive.cloneNode(true));
    const newBtn = document.getElementById(btnActive.id);
    newBtn.addEventListener('click', () => {
      newBtn.classList.add('active');
      btnInactive.classList.remove('active');
      contActive.classList.add('active');
      contInactive.classList.remove('active');
    });
  };
  
  setupSubtab(dupBtn, staleBtn, dupContent, staleContent);
  setupSubtab(staleBtn, dupBtn, staleContent, dupContent);
  
  // Render Duplicates List
  const dupList = document.getElementById('duplicates-list-container');
  dupList.innerHTML = '';
  
  if (dupCount === 0) {
    dupList.innerHTML = `
      <div class="empty-state">
        <p>Excellent! No duplicate tabs found.</p>
      </div>
    `;
    document.getElementById('dup-bulk-bar').style.display = 'none';
  } else {
    document.getElementById('dup-bulk-bar').style.display = 'flex';
    
    // Wire bulk clear button
    const bulkClearBtn = document.getElementById('close-all-duplicates-btn');
    bulkClearBtn.replaceWith(bulkClearBtn.cloneNode(true));
    document.getElementById('close-all-duplicates-btn').addEventListener('click', closeAllDuplicates);
    
    for (const [url, tabs] of Object.entries(duplicateGroups)) {
      const firstTab = tabs[0];
      const dupGroup = document.createElement('div');
      dupGroup.className = 'duplicate-group';
      
      const domain = new URL(url).hostname;
      
      dupGroup.innerHTML = `
        <div class="duplicate-group-header">
          <span class="duplicate-url-text" title="${url}">${domain} - ${tabs.length} tabs</span>
          <button class="warning-btn compact-btn keep-one-btn">Keep 1</button>
        </div>
        <div class="duplicate-list">
          <!-- Rows will insert here -->
        </div>
      `;
      
      dupGroup.querySelector('.keep-one-btn').addEventListener('click', () => {
        closeDuplicatesForUrl(url);
      });
      
      const listDiv = dupGroup.querySelector('.duplicate-list');
      tabs.forEach(tab => {
        const row = document.createElement('div');
        row.className = 'duplicate-tab-row';
        const favicon = tab.favIconUrl || 'chrome://favicon/';
        
        row.innerHTML = `
          <div class="duplicate-title-info">
            <img class="tab-favicon" src="${favicon}" onerror="this.src='icon.svg'" />
            <span class="tab-title" title="${tab.title}">${tab.title}</span>
          </div>
          <button class="tab-close-btn" title="Close duplicate">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        `;
        
        row.querySelector('.tab-title').addEventListener('click', () => {
          chrome.tabs.update(tab.id, { active: true });
        });
        
        row.querySelector('.tab-close-btn').addEventListener('click', () => {
          closeTab(tab.id);
        });
        
        listDiv.appendChild(row);
      });
      
      dupList.appendChild(dupGroup);
    }
  }
  
  // Render Stale Tabs List
  const staleList = document.getElementById('stale-list-container');
  staleList.innerHTML = '';
  
  // Label for stale threshold
  document.getElementById('stale-threshold-desc').textContent = `Inactive for > ${settings.staleThresholdMins}m`;
  
  if (staleTabs.length === 0) {
    staleList.innerHTML = `
      <div class="empty-state">
        <p>No stale tabs found! Adjust threshold in Settings if needed.</p>
      </div>
    `;
    document.getElementById('stale-bulk-bar').style.display = 'none';
  } else {
    document.getElementById('stale-bulk-bar').style.display = 'flex';
    
    // Wire bulk stale button
    const bulkStaleBtn = document.getElementById('close-all-stale-btn');
    bulkStaleBtn.replaceWith(bulkStaleBtn.cloneNode(true));
    document.getElementById('close-all-stale-btn').addEventListener('click', closeAllStaleTabs);
    
    staleTabs.forEach(item => {
      const tab = item.tab;
      const row = document.createElement('div');
      row.className = 'duplicate-tab-row glass-card';
      row.style.marginBottom = '6px';
      
      const favicon = tab.favIconUrl || 'chrome://favicon/';
      const idleStr = formatIdleTime(item.idleTimeMs);
      
      row.innerHTML = `
        <div class="duplicate-title-info">
          <img class="tab-favicon" src="${favicon}" onerror="this.src='icon.svg'" />
          <div style="display: flex; flex-direction: column; overflow: hidden;">
            <span class="tab-title" style="font-weight: 500;" title="${tab.title}">${tab.title}</span>
            <span class="stale-inactive-tag" style="width: fit-content; margin-top: 2px;">${idleStr}</span>
          </div>
        </div>
        <button class="tab-close-btn" title="Close stale tab">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;
      
      row.querySelector('.tab-title').addEventListener('click', () => {
        chrome.tabs.update(tab.id, { active: true });
      });
      
      row.querySelector('.tab-close-btn').addEventListener('click', () => {
        closeTab(tab.id);
      });
      
      staleList.appendChild(row);
    });
  }
}

function renderWorkspaces() {
  const container = document.getElementById('workspaces-list-container');
  container.innerHTML = '';
  
  document.getElementById('workspaces-count').textContent = `${savedWorkspaces.length} Saved`;
  
  // Wire Save button
  const saveBtn = document.getElementById('save-workspace-btn');
  saveBtn.replaceWith(saveBtn.cloneNode(true));
  document.getElementById('save-workspace-btn').addEventListener('click', saveWorkspace);
  
  if (savedWorkspaces.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No saved workspaces yet. Give it a name above and click Save!</p>
      </div>
    `;
    return;
  }
  
  // Sort saved workspaces by timestamp desc (newest first)
  const sorted = [...savedWorkspaces].sort((a, b) => b.timestamp - a.timestamp);
  
  sorted.forEach(ws => {
    const card = document.createElement('div');
    card.className = 'workspace-item';
    
    const dateStr = new Date(ws.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    card.innerHTML = `
      <div class="workspace-info">
        <h4>${ws.name}</h4>
        <p>${ws.tabs.length} tabs • Saved ${dateStr}</p>
      </div>
      <div class="workspace-item-actions">
        <button class="workspace-btn restore" data-id="${ws.id}">Restore</button>
        <button class="workspace-btn delete" data-id="${ws.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
    
    card.querySelector('.restore').addEventListener('click', () => {
      restoreWorkspace(ws.id);
    });
    
    card.querySelector('.delete').addEventListener('click', () => {
      deleteWorkspace(ws.id);
    });
    
    container.appendChild(card);
  });
}

function renderSettings() {
  // Stale threshold setting
  const select = document.getElementById('setting-stale-time');
  select.value = settings.staleThresholdMins;
  
  select.replaceWith(select.cloneNode(true));
  const newSelect = document.getElementById('setting-stale-time');
  newSelect.addEventListener('change', () => {
    settings.staleThresholdMins = parseInt(newSelect.value);
    chrome.storage.local.set({ [SETTINGS_KEY]: settings }, () => {
      showToast("Threshold updated", "success");
      analyzeStaleTabs();
    });
  });
  
  // Custom rules wireup
  const addBtn = document.getElementById('add-rule-btn');
  addBtn.replaceWith(addBtn.cloneNode(true));
  document.getElementById('add-rule-btn').addEventListener('click', addCustomRule);
  
  const resetBtn = document.getElementById('reset-settings-btn');
  resetBtn.replaceWith(resetBtn.cloneNode(true));
  document.getElementById('reset-settings-btn').addEventListener('click', resetDefaultRules);
  
  // Custom rules list
  const rulesContainer = document.getElementById('rules-list-container');
  rulesContainer.innerHTML = '';
  
  if (customRules.length === 0) {
    rulesContainer.innerHTML = `<div class="empty-state" style="height: 60px;"><p>No custom domain rules added yet.</p></div>`;
    return;
  }
  
  customRules.forEach(rule => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    
    const catName = categoryConfig[rule.category]?.name || rule.category;
    const catClass = categoryConfig[rule.category]?.class || '';
    
    item.innerHTML = `
      <span class="rule-domain" title="${rule.domain}">${rule.domain}</span>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="rule-cat-badge ${catClass}">${catName}</span>
        <button class="tab-close-btn remove-rule" title="Delete Rule">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
    
    item.querySelector('.remove-rule').addEventListener('click', () => {
      deleteCustomRule(rule.domain);
    });
    
    rulesContainer.appendChild(item);
  });
}

// -------------------------------------------------------------
// Toast banner controller
// -------------------------------------------------------------
let toastTimer;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgSpan = document.getElementById('toast-message');
  
  msgSpan.textContent = message;
  toast.className = 'toast-notification'; // Reset classes
  
  // Colors for toast border based on type
  if (type === 'success') {
    toast.style.borderColor = 'var(--success-color)';
  } else if (type === 'warning') {
    toast.style.borderColor = 'var(--warning-color)';
  } else if (type === 'info') {
    toast.style.borderColor = 'var(--info-color)';
  }
  
  // Show toast
  toast.classList.remove('hidden');
  
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}
