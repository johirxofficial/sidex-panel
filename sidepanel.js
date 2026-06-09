// ডিফল্ট শর্টকাট ডেটা
const defaultSites = [
  { title: "Google", url: "https://www.google.com", icon: "🔍" },
  { title: "Facebook", url: "https://.m.facebook.com", icon: "👥" },
  { title: "YouTube", url: "https://m.youtube.com", icon: "📺" },
  { title: "Wikipedia", url: "https://en.m.wikipedia.org", icon: "🌐" }
];

let currentTabs = [];

// এলিমেন্ট সিলেক্টর সমূহ
const shortcutsGrid = document.getElementById('shortcuts-grid');
const urlInput = document.getElementById('url-input');
const btnGo = document.getElementById('btn-go');
const btnHome = document.getElementById('btn-home');
const btnPopup = document.getElementById('btn-popup');
const tabBar = document.getElementById('tab-bar');
const viewHome = document.getElementById('view-home');
const viewIframeContainer = document.getElementById('view-iframe-container');
const btnAddSite = document.getElementById('btn-add-site');

// ১. ইনিশিয়াল লোড এবং ড্যাশবোর্ড রেন্ডার
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

// ২. কাস্টম সাইট অ্যাড করা
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

// ৩. নতুন ট্যাব বা আইফ্রেম ওপেন মেকানিজম
function loadUrlInNewTab(url, title = "Loading...") {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  
  const tabId = 'tab-' + Date.now();
  
  // নতুন আইফ্রেম এলিমেন্ট তৈরি
  const iframe = document.createElement('iframe');
  iframe.id = `iframe-${tabId}`;
  iframe.src = url;
  iframe.style.display = 'none';
  viewIframeContainer.appendChild(iframe);

  // নতুন ট্যাব বাটন তৈরি
  const tabButton = document.createElement('div');
  tabButton.className = 'tab';
  tabButton.id = tabId;
  tabButton.innerText = title.substring(0, 10);
  tabButton.addEventListener('click', () => switchTab(tabId));
  tabBar.appendChild(tabButton);

  currentTabs.push({ id: tabId, url: url });
  switchTab(tabId);
}

// ৪. ট্যাব সুইচিং মেকানিজম
function switchTab(tabId) {
  // সব ট্যাব এবং আইফ্রেম ইন-অ্যাক্টিভ করা
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#view-iframe-container iframe').forEach(f => f.style.display = 'none');

  if (tabId === 'home') {
    document.getElementById('btn-home').parentElement.classList.add('active'); // fallback inline tracking
    viewHome.classList.add('active');
    viewIframeContainer.classList.remove('active');
    urlInput.value = '';
  } else {
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

// ৫. কন্ট্রোল বাটন ইভেন্ট লিসেনারস
btnGo.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadUrlInNewTab(url, url);
});

urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') btnGo.click();
});

btnHome.addEventListener('click', () => switchTab('home'));

// ৬. পপ-আউট (Full Separate / Floating Popup Window) মেকানিজম
btnPopup.addEventListener('click', () => {
  chrome.windows.create({
    url: chrome.runtime.getURL('sidepanel.html'),
    type: 'popup',
    width: 420,
    height: 750
  });
});
