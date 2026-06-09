const defaultSites = [
  { title: "Google", url: "https://www.google.com", icon: "🔍" },
  { title: "Facebook", url: "https://m.facebook.com", icon: "👥" },
  { title: "Messenger", url: "https://www.messenger.com", icon: "💬" },
  { title: "YouTube", url: "https://m.youtube.com", icon: "📺" }
];

let currentTabs = [];

const shortcutsGrid = document.getElementById('shortcuts-grid');
const urlInput = document.getElementById('url-input');
const btnGo = document.getElementById('btn-go');
const btnHome = document.getElementById('btn-home');
const btnPopup = document.getElementById('btn-popup');
const tabBar = document.getElementById('tab-bar');
const viewHome = document.getElementById('view-home');
const viewIframeContainer = document.getElementById('view-iframe-container');
const btnAddSite = document.getElementById('btn-add-site');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['customSites'], (result) => {
    const sites = result.customSites || defaultSites;
    renderShortcuts(sites);
  });
});

function renderShortcuts(sites) {
  shortcutsGrid.innerHTML = '';
  sites.forEach(site => {
    const card = document.createElement('div');
    card.className = 'shortcut-card';
    card.innerHTML = `
      <div class="icon">${site.icon || '🔗'}</div>
      <div class="title">${site.title}</div>
    `;
    card.addEventListener('click', () => loadUrlInNewTab(site.url, site.title));
    shortcutsGrid.appendChild(card);
  });
}

btnAddSite.addEventListener('click', () => {
  const title = document.getElementById('new-title').value.trim();
  let url = document.getElementById('new-url').value.trim();

  if (!title || !url) return alert('Please enter both name and URL');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  chrome.storage.local.get(['customSites'], (result) => {
    const sites = result.customSites || [...defaultSites];
    sites.push({ title, url, icon: '🔗' });
    chrome.storage.local.set({ customSites: sites }, () => {
      renderShortcuts(sites);
      document.getElementById('new-title').value = '';
      document.getElementById('new-url').value = '';
    });
  });
});

function loadUrlInNewTab(url, title = "Loading...") {
  // যদি ভ্যালিড ডোমেন না হয়, তবে গুগল সার্চে পাঠিয়ে দেবে (Search Fallback)
  if (!/^https?:\/\//i.test(url)) {
    if (url.includes('.') && !url.includes(' ')) {
      url = 'https://' + url;
    } else {
      url = 'https://www.google.com/search?q=' + encodeURIComponent(url);
      title = "Google Search";
    }
  }
  
  const tabId = 'tab-' + Date.now();
  
  const iframe = document.createElement('iframe');
  iframe.id = `iframe-${tabId}`;
  iframe.src = url;
  iframe.style.display = 'none';
  viewIframeContainer.appendChild(iframe);

  const tabButton = document.createElement('div');
  tabButton.className = 'tab';
  tabButton.id = tabId;
  tabButton.innerHTML = `
    <span class="tab-title-text">${title.substring(0, 10)}</span>
    <span class="close-tab" data-tab="${tabId}">×</span>
  `;
  
  // ট্যাব সুইচার ক্লিক
  tabButton.addEventListener('click', (e) => {
    if (e.target.classList.contains('close-tab')) return;
    switchTab(tabId);
  });

  // ট্যাব ক্লোজ ক্লিক
  tabButton.querySelector('.close-tab').addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabBar.appendChild(tabButton);
  currentTabs.push({ id: tabId, url: url });
  switchTab(tabId);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#view-iframe-container iframe').forEach(f => f.style.display = 'none');

  if (tabId === 'home') {
    btnHome.classList.add('active'); 
    viewHome.classList.add('active');
    viewIframeContainer.classList.remove('active');
    urlInput.value = '';
  } else {
    btnHome.classList.remove('active');
    viewHome.classList.remove('active');
    viewIframeContainer.classList.add('active');
    
    const activeTabButton = document.getElementById(tabId);
    if(activeTabButton) activeTabButton.classList.add('active');
    
    const activeIframe = document.getElementById(`iframe-${tabId}`);
    if(activeIframe) {
      activeIframe.style.display = 'block';
      urlInput.value = activeIframe.src;
    }
  }
}

function closeTab(tabId) {
  const tabButton = document.getElementById(tabId);
  const iframe = document.getElementById(`iframe-${tabId}`);
  
  if (tabButton) tabButton.remove();
  if (iframe) iframe.remove();

  const wasActive = tabButton ? tabButton.classList.contains('active') : false;
  currentTabs = currentTabs.filter(t => t.id !== tabId);

  if (wasActive) {
    if (currentTabs.length > 0) {
      switchTab(currentTabs[currentTabs.length - 1].id);
    } else {
      switchTab('home');
    }
  }
}

btnGo.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadUrlInNewTab(url, url);
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnGo.click();
});

btnHome.addEventListener('click', () => switchTab('home'));

btnPopup.addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html'),
    type: 'popup',
    width: 420,
    height: 750
  });
});
