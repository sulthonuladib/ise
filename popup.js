const CACHE_KEY = 'indodax_pairs';
const CACHE_EXPIRY_KEY = 'indodax_pairs_expiry';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const API_URL = 'https://indodax.com/api/pairs';

let pairsData = [];

async function fetchPairs() {
  try {
    showStatus('Fetching coin pairs...');
    const response = await fetch(API_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Store in chrome.storage.local with expiry
    const expiry = Date.now() + CACHE_DURATION;
    await chrome.storage.local.set({
      [CACHE_KEY]: data,
      [CACHE_EXPIRY_KEY]: expiry
    });
    
    pairsData = data;
    updateLastUpdated(Date.now());
    showStatus('');
    return data;
  } catch (error) {
    console.error('Error fetching pairs:', error);
    showStatus('Error fetching data. Please try again.');
    return null;
  }
}

async function loadCachedPairs() {
  try {
    const result = await chrome.storage.local.get([CACHE_KEY, CACHE_EXPIRY_KEY]);
    const cachedData = result[CACHE_KEY];
    const expiry = result[CACHE_EXPIRY_KEY];
    
    if (cachedData && expiry && Date.now() < expiry) {
      pairsData = cachedData;
      updateLastUpdated(expiry - CACHE_DURATION);
      return cachedData;
    }
    
    // Cache expired or doesn't exist
    return await fetchPairs();
  } catch (error) {
    console.error('Error loading cached pairs:', error);
    return await fetchPairs();
  }
}

function showStatus(message) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.style.display = message ? 'block' : 'none';
}

function updateLastUpdated(timestamp) {
  const lastUpdatedEl = document.getElementById('lastUpdated');
  const date = new Date(timestamp);
  const timeAgo = getTimeAgo(date);
  lastUpdatedEl.textContent = `Last updated: ${timeAgo}`;
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function formatPairDisplay(pair) {
  // Convert pair format for display
  const base = pair.traded_currency || pair.base_currency;
  const quote = pair.base_currency || pair.quote_currency;
  const description = pair.description || '';
  const symbol = pair.symbol || `${base}_${quote}`;
  
  return {
    symbol: symbol.toUpperCase(),
    base: base.toUpperCase(),
    quote: quote.toUpperCase(),
    description: description,
    id: pair.id || symbol.toLowerCase()
  };
}

function filterPairs(searchTerm) {
  if (!searchTerm) return pairsData;
  
  const term = searchTerm.toLowerCase();
  return pairsData.filter(pair => {
    const formatted = formatPairDisplay(pair);
    return formatted.symbol.toLowerCase().includes(term) ||
           formatted.base.toLowerCase().includes(term) ||
           formatted.quote.toLowerCase().includes(term) ||
           formatted.description.toLowerCase().includes(term);
  });
}

function displayResults(pairs) {
  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';
  
  if (pairs.length === 0) {
    resultsList.innerHTML = '<li class="no-results">No pairs found</li>';
    return;
  }
  
  pairs.forEach(pair => {
    const formatted = formatPairDisplay(pair);
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
      <div class="pair-info">
        <span class="pair-symbol">${formatted.symbol}</span>
        <span class="pair-description">${formatted.description}</span>
      </div>
      <span class="pair-quote">${formatted.base}/${formatted.quote}</span>
    `;
    
    li.addEventListener('click', () => {
      const marketUrl = `https://indodax.com/market/${formatted.id}`;
      chrome.tabs.create({ url: marketUrl });
    });
    
    resultsList.appendChild(li);
  });
}

function handleSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchTerm = searchInput.value.trim();
  const filteredPairs = filterPairs(searchTerm);
  displayResults(filteredPairs);
}

async function handleRefresh() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.classList.add('rotating');
  
  await fetchPairs();
  handleSearch(); // Re-run current search with new data
  
  setTimeout(() => {
    refreshBtn.classList.remove('rotating');
  }, 500);
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('searchInput');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Load pairs data
  showStatus('Loading...');
  await loadCachedPairs();
  showStatus('');
  
  // Display all pairs initially
  displayResults(pairsData);
  
  // Set up event listeners
  searchInput.addEventListener('input', handleSearch);
  refreshBtn.addEventListener('click', handleRefresh);
  
  // Focus search input
  searchInput.focus();
});