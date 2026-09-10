const CACHE_DURATION = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'exchange_pair_cache_v3';
const SELECTED_EXCHANGE_KEY = 'selected_exchange';
const SEARCH_DEBOUNCE_MS = 150;

/**
 * @typedef {Object} NormalizedPair
 * @property {string} base
 * @property {string} quote
 * @property {string} symbol
 * @property {string} description
 * @property {string} id
 */

/**
 * @typedef {Object} ExchangeConfig
 * @property {string} name
 * @property {string} quote
 * @property {string} apiUrl
 * @property {string[]} hosts
 * @property {(pair: NormalizedPair) => string} formatUrl
 * @property {(pair: Object) => NormalizedPair} normalize
 */

/** @type {Object<string, ExchangeConfig>} */
const EXCHANGES = {
	indodax: {
		name: 'Indodax', quote: 'IDR', apiUrl: 'https://indodax.com/api/pairs',
		hosts: ['indodax.com'],
		formatUrl: pair => `https://indodax.com/market/${pair.symbol}`,
		normalize: pair => ({ base: pair.traded_currency_unit, quote: pair.base_currency, symbol: pair.symbol, description: pair.description, id: pair.id })
	},
	pintu: {
		name: 'Pintu', quote: 'IDR', apiUrl: 'https://api.pintu.pro/v1/public/get-symbols-reference',
		hosts: ['pintu.com'],
		formatUrl: pair => `https://pintu.co.id/pro/id/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.base_asset, quote: pair.quote_asset, symbol: pair.symbol, description: pair.symbol, id: pair.symbol })
	},
	binance: {
		name: 'Binance', quote: 'USDT', apiUrl: 'https://api.binance.com/api/v3/exchangeInfo',
		hosts: ['binance.com'],
		formatUrl: pair => `https://www.binance.com/en/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.baseAsset, quote: pair.quoteAsset, symbol: pair.symbol, description: `${pair.baseAsset}/${pair.quoteAsset}`, id: pair.symbol })
	},
	mexc: {
		name: 'MEXC', quote: 'USDT', apiUrl: 'https://api.mexc.com/api/v3/exchangeInfo',
		hosts: ['mexc.com', 'mexc.fm'],
		formatUrl: pair => `https://www.mexc.fm/exchange/${pair.base}_${pair.quote}`,
		normalize: pair => {
			const base = pair.baseAsset || pair.baseCoin;
			const quote = pair.quoteAsset || pair.quoteCoin;
			return { base, quote, symbol: pair.symbol, description: `${base}/${quote}`, id: pair.symbol };
		}
	},
	kucoin: {
		name: 'KuCoin', quote: 'USDT', apiUrl: 'https://api.kucoin.com/api/v2/symbols',
		hosts: ['kucoin.com'],
		formatUrl: pair => `https://www.kucoin.com/trade/${pair.base}-${pair.quote}`,
		normalize: pair => ({ base: pair.baseCurrency, quote: pair.quoteCurrency, symbol: pair.symbol, description: pair.symbol, id: pair.symbol })
	},
	gateio: {
		name: 'GateIO', quote: 'USDT', apiUrl: 'https://api.gateio.ws/api/v4/spot/currency_pairs',
		hosts: ['gate.io', 'gate.com', 'gateio.com'],
		formatUrl: pair => `https://www.gate.com/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.base, quote: pair.quote, symbol: pair.id, description: pair.id, id: pair.id })
	},
	bitget: {
		name: 'Bitget', quote: 'USDT', apiUrl: 'https://api.bitget.com/api/v2/spot/public/symbols',
		hosts: ['bitget.com'],
		formatUrl: pair => `https://www.bitget.com/spot/${pair.base}${pair.quote}`,
		normalize: pair => ({ base: pair.baseCoin, quote: pair.quoteCoin, symbol: pair.symbol, description: `${pair.baseCoin}${pair.quoteCoin}`, id: pair.symbol })
	},
	bybit: {
		name: 'Bybit', quote: 'USDT', apiUrl: 'https://api.bybit.com/v5/market/instruments-info?category=spot',
		hosts: ['bybit.com'],
		formatUrl: pair => `https://www.bybit.com/en/trade/spot/${pair.base}/${pair.quote}`,
		normalize: pair => ({ base: pair.baseCoin, quote: pair.quoteCoin, symbol: pair.symbol, description: `${pair.baseCoin}/${pair.quoteCoin}`, id: pair.symbol })
	}
};

// ── State ────────────────────────────────────────────────────────────────────
let selectedExchange = 'indodax';
let pairsData = [];
let searchTimer = null;
const CHUNK_SIZE = 10;
let renderedCount = 0;
let filteredPairs = [];

// ── DOM refs (populated on DOMContentLoaded) ─────────────────────────────────
let dom = {};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** @param {string} hostname @returns {string|undefined} */
function exchangeFromHostname(hostname) {
	return Object.entries(EXCHANGES).find(([, exchange]) =>
		exchange.hosts.some(host => hostname === host || hostname.endsWith(`.${host}`))
	)?.[0];
}

async function getDefaultExchange() {
	const stored = await chrome.storage.local.get(SELECTED_EXCHANGE_KEY);
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		return exchangeFromHostname(new URL(tab?.url || '').hostname) || stored[SELECTED_EXCHANGE_KEY] || 'indodax';
	} catch {
		return stored[SELECTED_EXCHANGE_KEY] || 'indodax';
	}
}

function getTimeAgo(date) {
	const seconds = Math.floor((Date.now() - date) / 1000);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ── Cache ────────────────────────────────────────────────────────────────────

async function readCache(exchangeKey) {
	const all = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
	const entry = all[exchangeKey];
	if (!entry) return null;
	if (Date.now() - entry.timestamp >= CACHE_DURATION) return null;
	return entry;
}

async function writeCache(exchangeKey, pairs, timestamp) {
	const all = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
	all[exchangeKey] = { pairs, timestamp };
	await chrome.storage.local.set({ [CACHE_KEY]: all });
}

// ── Fetch & normalize ───────────────────────────────────────────────────────

/** @param {string} exchangeKey @param {Object|Array} data @returns {Object[]} */
function extractPairs(exchangeKey, data) {
	if (exchangeKey === 'pintu') return data?.data?.symbols || [];
	if (exchangeKey === 'binance') return data?.symbols || [];
	if (exchangeKey === 'kucoin' || exchangeKey === 'bitget') return data?.data || [];
	if (exchangeKey === 'bybit') return data?.result?.list || [];
	if (exchangeKey === 'mexc') return data?.symbols || [];
	return Array.isArray(data) ? data : [];
}

/**
 * Fetch fresh pairs from the API, normalize, filter by quote, sort, and cache.
 * Returns the normalized pairs or null on error.
 */
async function fetchAndNormalize(exchangeKey) {
	const exchange = EXCHANGES[exchangeKey];
	try {
		const response = await fetch(exchange.apiUrl);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);
		const raw = await response.json();
		const normalized = extractPairs(exchangeKey, raw)
			.map(pair => exchange.normalize(pair))
			.filter(pair => String(pair.quote).toUpperCase() === exchange.quote)
			.sort((a, b) => a.symbol.localeCompare(b.symbol));
		const timestamp = Date.now();
		await writeCache(exchangeKey, normalized, timestamp);
		return { pairs: normalized, timestamp };
	} catch (err) {
		console.error(`Error fetching ${exchange.name}:`, err);
		return null;
	}

}

// ── UI ───────────────────────────────────────────────────────────────────────

function showSkeleton(show) {
	dom.skeleton.classList.toggle('hidden', !show);
	dom.resultsList.classList.toggle('hidden', show);
}

function showStatus(message) {
	dom.status.textContent = message;
	dom.status.classList.toggle('hidden', !message);
}

function updateLastUpdated(timestamp) {
	dom.lastUpdated.textContent = timestamp
		? `Last updated: ${getTimeAgo(new Date(timestamp))}`
		: '';
}

function renderResults(pairs, append = false) {
	if (!append) {
		dom.resultsList.innerHTML = '';
		filteredPairs = pairs;
		renderedCount = 0;
		dom.resultsList.parentElement.scrollTop = 0;
	}

	if (!filteredPairs.length && !append) {
		dom.resultsList.innerHTML = '<li class="no-results">No pairs found</li>';
		showSkeleton(false);
		return;
	}

	const exchange = EXCHANGES[selectedExchange];
	const end = Math.min(renderedCount + CHUNK_SIZE, filteredPairs.length);
	const fragment = document.createDocumentFragment();
	for (let i = renderedCount; i < end; i++) {
		const pair = filteredPairs[i];
		const li = document.createElement('li');
		li.className = 'result-item';
		li.innerHTML = `<div class="pair-info"><span class="pair-symbol">${pair.symbol}</span><span class="pair-description">${pair.description}</span></div><span class="pair-quote">${pair.base}/${pair.quote}</span>`;
		li.addEventListener('click', () => chrome.tabs.create({ url: exchange.formatUrl(pair) }));
		fragment.appendChild(li);
	}
	dom.resultsList.appendChild(fragment);
	renderedCount = end;
	showSkeleton(false);
}

function loadMoreChunks() {
	if (renderedCount >= filteredPairs.length) return;
	const scrollEl = dom.resultsList.parentElement;
	if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 50) {
		renderResults(filteredPairs, true);
	}
}

function fadeExchangeSwitch(callback) {
	dom.resultsList.style.opacity = '0';
	setTimeout(() => {
		callback();
		dom.resultsList.style.opacity = '1';
	}, 80);
}

// ── Search ───────────────────────────────────────────────────────────────────

function search(term) {
	if (!term) {
		renderResults(pairsData);
		return;
	}
	const lower = term.toLowerCase();
	const prefixMatches = [];
	const containsMatches = [];
	for (const pair of pairsData) {
		const fields = [pair.symbol, pair.base, pair.quote, pair.description];
		const isPrefix = fields.some(f => f.toLowerCase().startsWith(lower));
		const isContains = fields.some(f => f.toLowerCase().includes(lower));
		if (isPrefix) prefixMatches.push(pair);
		else if (isContains) containsMatches.push(pair);
	}
	renderResults([...prefixMatches, ...containsMatches]);
}

function handleSearchInput() {
	const term = dom.searchInput.value.trim();
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => search(term), SEARCH_DEBOUNCE_MS);
}

// ── Exchange switching ───────────────────────────────────────────────────────

async function selectExchange(exchangeKey, { skipStorage = false } = {}) {
	selectedExchange = exchangeKey;

	// Update tab UI immediately
	dom.tabs.querySelectorAll('.exchange-tab').forEach(tab => {
		const active = tab.dataset.exchange === exchangeKey;
		tab.classList.toggle('active', active);
		tab.setAttribute('aria-selected', String(active));
	});

	if (!skipStorage) {
		await chrome.storage.local.set({ [SELECTED_EXCHANGE_KEY]: exchangeKey });
	}

	// Try cache first — instant swap
	const cached = await readCache(exchangeKey);
	if (cached) {
		pairsData = cached.pairs;
		updateLastUpdated(cached.timestamp);
		fadeExchangeSwitch(() => search(dom.searchInput.value.trim()));
		return;
	}

	// No cache — show skeleton, fetch from API
	pairsData = [];
	showSkeleton(true);
	showStatus(`Loading ${EXCHANGES[exchangeKey].name}...`);
	const result = await fetchAndNormalize(exchangeKey);
	if (result && selectedExchange === exchangeKey) {
		pairsData = result.pairs;
		updateLastUpdated(result.timestamp);
		showStatus('');
		fadeExchangeSwitch(() => search(dom.searchInput.value.trim()));
	} else if (result) {
		// User switched away while fetching — just cache it
		// (already written by fetchAndNormalize)
	}
}

async function handleRefresh() {
	const exchangeKey = selectedExchange;
	dom.refreshBtn.classList.add('rotating');
	showStatus(`Refreshing ${EXCHANGES[exchangeKey].name}...`);
	const result = await fetchAndNormalize(exchangeKey);
	if (result && selectedExchange === exchangeKey) {
		pairsData = result.pairs;
		updateLastUpdated(result.timestamp);
		showStatus('');
		renderResults(pairsData);
	}
	dom.refreshBtn.classList.remove('rotating');
}

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
	dom = {
		tabs: document.getElementById('exchangeTabs'),
		searchInput: document.getElementById('searchInput'),
		resultsList: document.getElementById('resultsList'),
		skeleton: document.getElementById('skeleton'),
		refreshBtn: document.getElementById('refreshBtn'),
		status: document.getElementById('status'),
		lastUpdated: document.getElementById('lastUpdated')
	};

	// Build exchange tabs
	Object.entries(EXCHANGES).forEach(([key, exchange]) => {
		const tab = document.createElement('button');
		tab.className = 'exchange-tab';
		tab.type = 'button';
		tab.dataset.exchange = key;
		tab.setAttribute('role', 'tab');
		tab.setAttribute('aria-label', exchange.name);
		tab.textContent = exchange.name;
		tab.addEventListener('click', () => selectExchange(key));
		dom.tabs.appendChild(tab);
	});

	// Bind events
	dom.searchInput.addEventListener('input', handleSearchInput);
	dom.refreshBtn.addEventListener('click', handleRefresh);
	dom.resultsList.parentElement.addEventListener('scroll', loadMoreChunks);

	// Initial render — show skeleton while first exchange loads
	showSkeleton(true);
	dom.searchInput.focus();

	// Load default exchange (instant from cache if available)
	selectedExchange = await getDefaultExchange();
	await selectExchange(selectedExchange, { skipStorage: true });
});
