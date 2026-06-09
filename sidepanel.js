/* ============================================================
   SideX Panel — Main Application Logic
   Multi-tab browsing, station management, view modes, pop-out
   ============================================================ */

(function () {
  'use strict';

  // ---- Default Quick-Access Shortcuts ----
  const DEFAULT_SHORTCUTS = [
    { id: 's_google',   title: 'Google',    url: 'https://www.google.com' },
    { id: 's_youtube',  title: 'YouTube',   url: 'https://www.youtube.com' },
    { id: 's_facebook', title: 'Facebook',  url: 'https://www.facebook.com' },
    { id: 's_messenger',title: 'Messenger', url: 'https://www.messenger.com' },
    { id: 's_reddit',   title: 'Reddit',    url: 'https://www.reddit.com' },
    { id: 's_x',        title: 'X',         url: 'https://www.x.com' },
    { id: 's_gmail',    title: 'Gmail',     url: 'https://mail.google.com' },
    { id: 's_github',   title: 'GitHub',    url: 'https://github.com' }
  ];

  // ---- Application State ----
  let state = {
    tabs: [],          // { id, url, title }
    activeTabId: null,
    viewMode: 'desktop',
    stations: [],      // user-added stations
    isPopOut: false
  };

  // ---- DOM References ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const btnHome      = $('#btn-home');
  const btnRefresh   = $('#btn-refresh');
  const urlInput     = $('#url-input');
  const urlIcon      = $('#url-icon');
  const btnGo        = $('#btn-go');
  const btnViewMode  = $('#btn-view-mode');
  const btnPopOut    = $('#btn-popout');
  const tabsContainer = $('#tabs-container');
  const btnNewTab    = $('#btn-new-tab');
  const mainContent  = $('#main-content');
  const homeView     = $('#home-view');
  const webView      = $('#web-view');
  const loadingOverlay = $('#loading-overlay');
  const iframeError  = $('#iframe-error');
  const errorOpenLink = $('#error-open-link');
  const shortcutsGrid = $('#shortcuts-grid');
  const stationsGrid  = $('#stations-grid');
  const btnAddStation = $('#btn-add-station');
  const stationModal  = $('#station-modal');
  const btnCloseModal = $('#btn-close-modal');
  const stationForm   = $('#station-form');
  const inputTitle    = $('#input-title');
  const inputUrl      = $('#input-url');
  const modalBackdrop = $('.modal-backdrop');

  // ---- Utility Functions ----

  /** Generate a unique tab ID */
  function uid() {
    return 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  /** Extract domain from a URL string */
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (_) {
      return url;
    }
  }

  /** Get Google favicon URL for a domain */
  function getFaviconUrl(url) {
    const domain = getDomain(url);
    return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(domain) + '&sz=64';
  }

  /** Check if a string looks like a URL */
  function isUrl(str) {
    if (/^https?:\/\//i.test(str)) return true;
    if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.[a-z]{2,}/i.test(str)) return true;
    return false;
  }

  /** Normalize a string into a proper URL, or build a Google search URL */
  function normalizeUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (isUrl(trimmed)) return 'https://' + trimmed;
    return 'https://www.google.com/search?q=' + encodeURIComponent(trimmed);
  }

  /** Truncate a string to maxLen with ellipsis */
  function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen - 1) + '\u2026' : str;
  }

  // ---- Storage ----

  async function loadState() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['stations', 'viewMode', 'popOutState'], (result) => {
        if (result.stations && Array.isArray(result.stations)) {
          state.stations = result.stations;
        }
        if (result.viewMode === 'mobile' || result.viewMode === 'desktop') {
          state.viewMode = result.viewMode;
        }
        // If opened as pop-out, restore tab state
        const params = new URLSearchParams(window.location.search);
        if (params.get('popout') === '1') {
          state.isPopOut = true;
          if (result.popOutState) {
            const ps = result.popOutState;
            if (ps.tabs && Array.isArray(ps.tabs)) {
              state.tabs = ps.tabs;
            }
            if (ps.activeTabId) {
              state.activeTabId = ps.activeTabId;
            }
          }
        }
        resolve();
      });
    });
  }

  async function saveState() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        stations: state.stations,
        viewMode: state.viewMode
      }, resolve);
    });
  }

  // ---- Rendering: Home Dashboard ----

  function renderShortcuts() {
    shortcutsGrid.innerHTML = '';
    DEFAULT_SHORTCUTS.forEach((sc) => {
      const card = document.createElement('div');
      card.className = 'shortcut-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Open ' + sc.title);
      card.innerHTML =
        '<img class="shortcut-icon" src="' + getFaviconUrl(sc.url) + '" alt="" loading="lazy">' +
        '<span class="shortcut-name">' + truncate(sc.title, 12) + '</span>';
      card.addEventListener('click', () => openInTab(sc.url, sc.title));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInTab(sc.url, sc.title); }
      });
      shortcutsGrid.appendChild(card);
    });
  }

  function renderStations() {
    stationsGrid.innerHTML = '';
    if (state.stations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<span class="material-icons-round">bookmark_border</span>No custom stations yet';
      stationsGrid.appendChild(empty);
      return;
    }
    state.stations.forEach((st) => {
      const card = document.createElement('div');
      card.className = 'station-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Open ' + st.title);
      card.innerHTML =
        '<img class="station-icon" src="' + getFaviconUrl(st.url) + '" alt="" loading="lazy">' +
        '<span class="station-name">' + truncate(st.title, 12) + '</span>' +
        '<button class="station-delete" title="Remove station" aria-label="Remove ' + st.title + '">' +
          '<span class="material-icons-round">close</span>' +
        '</button>';
      // Click to open
      card.addEventListener('click', (e) => {
        if (e.target.closest('.station-delete')) return;
        openInTab(st.url, st.title);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openInTab(st.url, st.title); }
      });
      // Delete button
      card.querySelector('.station-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        removeStation(st.id);
      });
      stationsGrid.appendChild(card);
    });
  }

  // ---- Station Management ----

  function addStation(title, url) {
    const station = {
      id: 'st_' + Date.now().toString(36),
      title: title.trim(),
      url: url.trim()
    };
    state.stations.push(station);
    saveState();
    renderStations();
  }

  function removeStation(id) {
    state.stations = state.stations.filter((s) => s.id !== id);
    saveState();
    renderStations();
  }

  // ---- Tab Management ----

  function openInTab(url, title) {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl) return;

    // If there's an active tab that is still on home (url empty), reuse it
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (activeTab && !activeTab.url) {
      activeTab.url = normalizedUrl;
      activeTab.title = title || getDomain(normalizedUrl);
      reloadIframe(activeTab);
    } else {
      // Create a new tab
      const tab = {
        id: uid(),
        url: normalizedUrl,
        title: title || getDomain(normalizedUrl)
      };
      state.tabs.push(tab);
      state.activeTabId = tab.id;
      createIframe(tab);
    }

    renderTabs();
    showWebView();
    updateUrlBar();
    saveState();
  }

  function createIframe(tab) {
    // Remove any existing iframe for this tab ID (safety)
    const existing = webView.querySelector('iframe[data-tab-id="' + tab.id + '"]');
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.setAttribute('data-tab-id', tab.id);
    iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox');
    iframe.setAttribute('allow', 'accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; clipboard-write');
    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframe.src = tab.url;

    // Loading events
    iframe.addEventListener('load', onIframeLoad);
    iframe.addEventListener('error', onIframeError);

    webView.appendChild(iframe);
    showLoading();
  }

  function reloadIframe(tab) {
    const iframe = webView.querySelector('iframe[data-tab-id="' + tab.id + '"]');
    if (iframe) {
      showLoading();
      hideError();
      iframe.src = tab.url;
    } else {
      createIframe(tab);
    }
  }

  function destroyIframe(tabId) {
    const iframe = webView.querySelector('iframe[data-tab-id="' + tabId + '"]');
    if (iframe) {
      iframe.removeEventListener('load', onIframeLoad);
      iframe.removeEventListener('error', onIframeError);
      iframe.remove();
    }
  }

  function onIframeLoad() {
    hideLoading();
    hideError();
    // Try to update the tab title from the iframe (same-origin only)
    const tabId = this.getAttribute('data-tab-id');
    try {
      const doc = this.contentDocument;
      if (doc && doc.title) {
        const tab = state.tabs.find((t) => t.id === tabId);
        if (tab) {
          tab.title = doc.title;
          renderTabs();
        }
      }
    } catch (_) {
      // Cross-origin: title stays as domain
    }
  }

  function onIframeError() {
    hideLoading();
    const tabId = this.getAttribute('data-tab-id');
    const tab = state.tabs.find((t) => t.id === tabId);
    if (tab) {
      showError(tab.url);
    }
  }

  function switchTab(tabId) {
    state.activeTabId = tabId;
    // Show the correct iframe
    webView.querySelectorAll('iframe').forEach((f) => {
      f.classList.toggle('active', f.getAttribute('data-tab-id') === tabId);
    });
    renderTabs();
    updateUrlBar();

    const tab = state.tabs.find((t) => t.id === tabId);
    if (tab && tab.url) {
      showWebView();
    } else {
      showHome();
    }
    saveState();
  }

  function closeTab(tabId) {
    const index = state.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    state.tabs.splice(index, 1);
    destroyIframe(tabId);

    if (state.activeTabId === tabId) {
      if (state.tabs.length > 0) {
        const newIndex = Math.min(index, state.tabs.length - 1);
        state.activeTabId = state.tabs[newIndex].id;
      } else {
        state.activeTabId = null;
      }
    }

    renderTabs();
    updateUrlBar();

    if (state.tabs.length === 0 || !state.activeTabId) {
      showHome();
    } else {
      switchTab(state.activeTabId);
    }
    saveState();
  }

  function addNewEmptyTab() {
    const tab = { id: uid(), url: '', title: 'New Tab' };
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderTabs();
    showHome();
    urlInput.focus();
    updateUrlBar();
    saveState();
  }

  // ---- Rendering: Tabs ----

  function renderTabs() {
    tabsContainer.innerHTML = '';
    state.tabs.forEach((tab) => {
      const el = document.createElement('div');
      el.className = 'tab-item' + (tab.id === state.activeTabId ? ' active' : '');
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', tab.id === state.activeTabId ? 'true' : 'false');

      const faviconSrc = tab.url ? getFaviconUrl(tab.url) : '';
      const faviconHtml = faviconSrc
        ? '<img class="tab-favicon" src="' + faviconSrc + '" alt="" loading="lazy">'
        : '<span class="material-icons-round tab-favicon" style="font-size:14px;color:var(--text-muted);">public</span>';

      el.innerHTML =
        faviconSrc
          ? '<img class="tab-favicon" src="' + faviconSrc + '" alt="" loading="lazy">'
          : '<span class="material-icons-round" style="font-size:14px;color:var(--text-muted);">public</span>' +
        '<span class="tab-title">' + truncate(tab.title || 'New Tab', 20) + '</span>' +
        '<button class="tab-close" title="Close tab" aria-label="Close tab">' +
          '<span class="material-icons-round">close</span>' +
        '</button>';

      // Click to switch tab
      el.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) return;
        switchTab(tab.id);
      });

      // Close button
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });

      tabsContainer.appendChild(el);
    });

    // Scroll active tab into view
    const activeEl = tabsContainer.querySelector('.tab-item.active');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // ---- View Switching ----

  function showHome() {
    homeView.style.display = '';
    webView.classList.remove('visible');
    webView.classList.remove('mobile-frame');
    hideLoading();
    hideError();
  }

  function showWebView() {
    homeView.style.display = 'none';
    webView.classList.add('visible');
    if (state.viewMode === 'mobile') {
      webView.classList.add('mobile-frame');
    } else {
      webView.classList.remove('mobile-frame');
    }
    // Ensure the active iframe is shown
    webView.querySelectorAll('iframe').forEach((f) => {
      f.classList.toggle('active', f.getAttribute('data-tab-id') === state.activeTabId);
    });
  }

  // ---- URL Bar ----

  function updateUrlBar() {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (tab && tab.url) {
      urlInput.value = tab.url;
      urlIcon.textContent = 'language';
    } else {
      urlInput.value = '';
      urlIcon.textContent = 'search';
    }
  }

  function navigateFromInput() {
    const raw = urlInput.value.trim();
    if (!raw) return;

    const url = normalizeUrl(raw);
    if (!url) return;

    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (activeTab) {
      activeTab.url = url;
      activeTab.title = getDomain(url);
      reloadIframe(activeTab);
      showWebView();
    } else {
      openInTab(url);
    }
    renderTabs();
    updateUrlBar();
    saveState();
    urlInput.blur();
  }

  // ---- Loading & Error States ----

  function showLoading() {
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showError(url) {
    iframeError.classList.remove('hidden');
    errorOpenLink.href = url;
  }

  function hideError() {
    iframeError.classList.add('hidden');
  }

  // ---- View Mode Toggle ----

  async function toggleViewMode() {
    const newMode = state.viewMode === 'desktop' ? 'mobile' : 'desktop';
    state.viewMode = newMode;

    // Update DNR session rules via background
    try {
      await chrome.runtime.sendMessage({ action: 'setViewMode', mode: newMode });
    } catch (_) {
      // Fallback: try direct API
      try {
        const existing = await chrome.declarativeNetRequest.getSessionRules();
        const ids = existing.map((r) => r.id);
        if (ids.length) await chrome.declarativeNetRequest.removeSessionRules(ids);

        if (newMode === 'mobile') {
          const MOBILE_UA =
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
            'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 ' +
            'Mobile/15E148 Safari/604.1';
          await chrome.declarativeNetRequest.updateSessionRules([{
            id: 1000,
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
          }]);
        }
      } catch (_2) { /* ignore */ }
    }

    // Update UI button
    updateViewModeButton();

    // Update web view frame style
    if (state.activeTabId) {
      const tab = state.tabs.find((t) => t.id === state.activeTabId);
      if (tab && tab.url) {
        if (newMode === 'mobile') {
          webView.classList.add('mobile-frame');
        } else {
          webView.classList.remove('mobile-frame');
        }
        // Reload the active iframe so the UA change takes effect
        reloadIframe(tab);
      }
    }

    saveState();
  }

  function updateViewModeButton() {
    if (state.viewMode === 'mobile') {
      btnViewMode.classList.add('mobile-active');
      btnViewMode.querySelector('.material-icons-round').textContent = 'smartphone';
      btnViewMode.title = 'Switch to desktop view';
    } else {
      btnViewMode.classList.remove('mobile-active');
      btnViewMode.querySelector('.material-icons-round').textContent = 'devices';
      btnViewMode.title = 'Switch to mobile view';
    }
  }

  // ---- Pop-Out Window ----

  function popOut() {
    // Save current tab state for the pop-out window to inherit
    const popOutState = {
      tabs: state.tabs.map((t) => ({ id: t.id, url: t.url, title: t.title })),
      activeTabId: state.activeTabId
    };

    chrome.runtime.sendMessage({
      action: 'popOut',
      state: popOutState
    }).catch(() => {});
  }

  // ---- Refresh Active Tab ----

  function refreshActiveTab() {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (tab && tab.url) {
      reloadIframe(tab);
    }
  }

  // ---- Go Home ----

  function goHome() {
    state.activeTabId = null;
    renderTabs();
    showHome();
    updateUrlBar();
    urlInput.value = '';
    urlIcon.textContent = 'search';
    saveState();
  }

  // ---- Event Bindings ----

  function bindEvents() {
    // Navigation buttons
    btnHome.addEventListener('click', goHome);
    btnRefresh.addEventListener('click', refreshActiveTab);
    btnViewMode.addEventListener('click', toggleViewMode);
    btnPopOut.addEventListener('click', popOut);
    btnNewTab.addEventListener('click', addNewEmptyTab);

    // URL bar navigation
    btnGo.addEventListener('click', navigateFromInput);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateFromInput();
      }
    });

    // Focus URL bar: select all text for easy replacement
    urlInput.addEventListener('focus', () => {
      urlInput.select();
    });

    // Station modal
    btnAddStation.addEventListener('click', () => {
      stationModal.classList.remove('hidden');
      inputTitle.focus();
    });

    btnCloseModal.addEventListener('click', closeModal);
    modalBackdrop.addEventListener('click', closeModal);

    stationForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = inputTitle.value.trim();
      const url = inputUrl.value.trim();
      if (title && url) {
        addStation(title, url);
        stationForm.reset();
        closeModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl+L or / to focus URL bar (only when not typing in an input)
      if ((e.ctrlKey && e.key === 'l') || (e.key === '/' && document.activeElement.tagName !== 'INPUT')) {
        e.preventDefault();
        urlInput.focus();
      }
      // Escape to go home or close modal
      if (e.key === 'Escape') {
        if (!stationModal.classList.contains('hidden')) {
          closeModal();
        } else if (document.activeElement === urlInput) {
          urlInput.blur();
          updateUrlBar();
        }
      }
      // Ctrl+W to close active tab
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (state.activeTabId) {
          closeTab(state.activeTabId);
        }
      }
    });

    // Listen for storage changes (e.g., when pop-out modifies stations)
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.stations) {
        state.stations = changes.stations.newValue || [];
        renderStations();
      }
    });
  }

  function closeModal() {
    stationModal.classList.add('hidden');
    stationForm.reset();
  }

  // ---- Initialization ----

  async function init() {
    await loadState();
    renderShortcuts();
    renderStations();
    updateViewModeButton();
    bindEvents();

    // Restore tabs from pop-out state or saved state
    if (state.tabs.length > 0) {
      // Recreate iframes for saved tabs
      state.tabs.forEach((tab) => {
        if (tab.url) {
          createIframe(tab);
        }
      });

      if (state.activeTabId) {
        switchTab(state.activeTabId);
      } else {
        showHome();
      }
      renderTabs();
      updateUrlBar();
    } else {
      showHome();
    }

    // Sync view mode with background (DNR session rules)
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getViewMode' });
      if (response && response.mode) {
        state.viewMode = response.mode;
        updateViewModeButton();
      }
    } catch (_) { /* background might not be ready yet */ }
  }

  // Start the application
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
