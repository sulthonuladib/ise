const CACHE_DURATION = 24 * 60 * 60 * 1000;
const CACHE_KEY = 'exchange_pair_cache';
const SELECTED_EXCHANGE_KEY = 'selected_exchange';

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
		name: 'Indodax', quote: 'IDR', favicon: 'https://indodax.com/favicon.ico', apiUrl: 'https://indodax.com/api/pairs',
		hosts: ['indodax.com'],
		formatUrl: pair => `https://indodax.com/market/${pair.id}`,
		normalize: pair => ({ base: pair.traded_currency_unit, quote: pair.base_currency, symbol: pair.symbol, description: pair.description, id: pair.id })
	},
	pintu: {
		name: 'Pintu', quote: 'IDR', favicon: 'https://pintu.com/favicon.ico', apiUrl: 'https://api.pintu.pro/v1/public/get-symbols-reference',
		hosts: ['pintu.com'],
		formatUrl: pair => `https://pintu.com/pro/id/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.base_asset, quote: pair.quote_asset, symbol: pair.symbol, description: pair.symbol, id: pair.symbol })
	},
	binance: {
		name: 'Binance', quote: 'USDT', favicon: 'https://www.binance.com/favicon.ico', apiUrl: 'https://api.binance.com/api/v3/exchangeInfo',
		hosts: ['binance.com'],
		formatUrl: pair => `https://www.binance.com/en/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.baseAsset, quote: pair.quoteAsset, symbol: pair.symbol, description: `${pair.baseAsset}/${pair.quoteAsset}`, id: pair.symbol })
	},
	mexc: {
		name: 'MEXC', quote: 'USDT', favicon: 'https://www.mexc.fm/favicon.ico', apiUrl: 'https://api.mexc.com/api/v3/exchangeInfo',
		hosts: ['mexc.com', 'mexc.fm'],
		formatUrl: pair => `https://www.mexc.fm/exchange/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.baseAsset, quote: pair.quoteAsset, symbol: pair.symbol, description: `${pair.baseAsset}/${pair.quoteAsset}`, id: pair.symbol })
	},
	kucoin: {
		name: 'KuCoin', quote: 'USDT', favicon: 'https://www.kucoin.com/favicon.ico', apiUrl: 'https://api.kucoin.com/api/v2/symbols',
		hosts: ['kucoin.com'],
		formatUrl: pair => `https://www.kucoin.com/trade/${pair.baseCurrency}-${pair.quoteCurrency}`,
		normalize: pair => ({ base: pair.baseCurrency, quote: pair.quoteCurrency, symbol: pair.symbol, description: pair.symbol, id: pair.symbol })
	},
	gateio: {
		name: 'GateIO', quote: 'USDT', favicon: 'https://www.gate.com/favicon.ico', apiUrl: 'https://api.gateio.ws/api/v4/spot/currency_pairs',
		hosts: ['gate.io', 'gate.com', 'gateio.com'],
		formatUrl: pair => `https://www.gate.com/trade/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.base, quote: pair.quote, symbol: pair.id, description: pair.id, id: pair.id })
	},
	bitget: {
		name: 'Bitget', quote: 'USDT', favicon: 'https://www.bitget.com/favicon.ico', apiUrl: 'https://api.bitget.com/api/v2/spot/public/symbols',
		hosts: ['bitget.com'],
		formatUrl: pair => `https://www.bitget.com/spot/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.baseCoin, quote: pair.quoteCoin, symbol: pair.symbol, description: `${pair.baseCoin}/${pair.quoteCoin}`, id: pair.symbol })
	},
	bybit: {
		name: 'Bybit', quote: 'USDT', favicon: 'https://www.bybit.com/favicon.ico', apiUrl: 'https://api.bybit.com/v5/market/instruments-info?category=spot',
		hosts: ['bybit.com'],
		formatUrl: pair => `https://www.bybit.com/trade/spot/${pair.base}_${pair.quote}`,
		normalize: pair => ({ base: pair.baseCoin, quote: pair.quoteCoin, symbol: pair.symbol, description: `${pair.baseCoin}/${pair.quoteCoin}`, id: pair.symbol })
	}
};

let selectedExchange = 'indodax';
let pairsData = [];

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

/** @param {string} exchangeKey @param {Object|Array} data @returns {Object[]} */
function extractPairs(exchangeKey, data) {
	if (exchangeKey === 'pintu') return data?.data?.symbols || [];
	if (exchangeKey === 'binance') return data?.symbols || [];
	if (exchangeKey === 'kucoin' || exchangeKey === 'bitget') return data?.data || [];
	if (exchangeKey === 'bybit') return data?.result?.list || [];
	if (exchangeKey === 'mexc') return data?.symbols || [];
	return Array.isArray(data) ? data : [];
}

async function fetchPairs() {
	const exchange = EXCHANGES[selectedExchange];
	try {
		const response = await fetch(exchange.apiUrl);
		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
		const raw = await response.json();
		const pairs = extractPairs(selectedExchange, raw).filter(pair => {
			const normalized = exchange.normalize(pair);
			const isTargetQuote = String(normalized.quote).toUpperCase() === exchange.quote;
			const status = String(pair.status || pair.trade_status || '').toLowerCase();
			const unavailable = pair.is_maintenance === 1 || pair.is_market_suspended === 1;
			return isTargetQuote && !unavailable && !['break', 'offline', 'maintenance', 'suspended'].includes(status);
		});
		const timestamp = Date.now();
		const cache = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
		cache[selectedExchange] = { pairs, timestamp };
		await chrome.storage.local.set({ [CACHE_KEY]: cache });
		pairsData = pairs;
		updateLastUpdated(timestamp);
		showStatus('');
		return pairs;
	} catch (error) {
		console.error(`Error fetching ${exchange.name} pairs:`, error);
		showStatus(`Error fetching ${exchange.name} data. Please try again.`);
		return null;
	}
}

async function loadCachedPairs() {
	const cache = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] || {};
	const cached = cache[selectedExchange];
	if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		pairsData = cached.pairs;
		updateLastUpdated(cached.timestamp);
		return cached.pairs;
	}
	return fetchPairs();
}

function showStatus(message) {
	const statusEl = document.getElementById('status');
	statusEl.textContent = message;
	statusEl.style.display = message ? 'block' : 'none';
}

function updateLastUpdated(timestamp) {
	document.getElementById('lastUpdated').textContent = `Last updated: ${getTimeAgo(new Date(timestamp))}`;
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

/** @param {Object} pair @returns {NormalizedPair} */
function formatPairDisplay(pair) {
	const formatted = EXCHANGES[selectedExchange].normalize(pair);
	return {
		...formatted,
		base: String(formatted.base || '').toUpperCase(),
		quote: String(formatted.quote || '').toUpperCase(),
		symbol: String(formatted.symbol || '').toUpperCase(),
		description: formatted.description || ''
	};
}

function displayResults(pairs) {
	const resultsList = document.getElementById('resultsList');
	resultsList.innerHTML = '';
	if (!pairs.length) {
		resultsList.innerHTML = '<li class="no-results">No pairs found</li>';
		return;
	}
	pairs.forEach(pair => {
		const formatted = formatPairDisplay(pair);
		const li = document.createElement('li');
		li.className = 'result-item';
		li.innerHTML = `<div class="pair-info"><span class="pair-symbol">${formatted.symbol}</span><span class="pair-description">${formatted.description}</span></div><span class="pair-quote">${formatted.base}/${formatted.quote}</span>`;
		li.addEventListener('click', () => chrome.tabs.create({ url: EXCHANGES[selectedExchange].formatUrl(formatted) }));
		resultsList.appendChild(li);
	});
}

function handleSearch() {
	const term = document.getElementById('searchInput').value.trim().toLowerCase();
	displayResults(pairsData.filter(pair => {
		const formatted = formatPairDisplay(pair);
		return !term || [formatted.symbol, formatted.base, formatted.quote, formatted.description].some(value => value.toLowerCase().includes(term));
	}));
}

async function selectExchange(exchangeKey) {
	selectedExchange = exchangeKey;
	pairsData = [];
	await chrome.storage.local.set({ [SELECTED_EXCHANGE_KEY]: exchangeKey });
	document.querySelectorAll('.exchange-tab').forEach(tab => {
		tab.classList.toggle('active', tab.dataset.exchange === exchangeKey);
		tab.setAttribute('aria-selected', String(tab.dataset.exchange === exchangeKey));
	});
	await loadCachedPairs();
	handleSearch();
}

async function handleRefresh() {
	const refreshBtn = document.getElementById('refreshBtn');
	refreshBtn.classList.add('rotating');
	await fetchPairs();
	handleSearch();
	refreshBtn.classList.remove('rotating');
}

document.addEventListener('DOMContentLoaded', async () => {
	const tabs = document.getElementById('exchangeTabs');
	Object.entries(EXCHANGES).forEach(([key, exchange]) => {
		const tab = document.createElement('button');
		tab.className = 'exchange-tab';
		tab.type = 'button';
		tab.dataset.exchange = key;
		tab.setAttribute('role', 'tab');
		tab.setAttribute('aria-label', exchange.name);
		tab.innerHTML = `<img src="${exchange.favicon}" alt="" aria-hidden="true"><span>${exchange.name}</span>`;
		tab.addEventListener('click', () => selectExchange(key));
		tabs.appendChild(tab);
	});
	document.getElementById('searchInput').addEventListener('input', handleSearch);
	document.getElementById('refreshBtn').addEventListener('click', handleRefresh);
	displayResults([]);
	document.getElementById('searchInput').focus();

	// Render the popup first; tab detection and data loading can take a moment.
	selectedExchange = await getDefaultExchange();
	await selectExchange(selectedExchange);
});
