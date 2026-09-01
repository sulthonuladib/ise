# Exchange Coin Search Chrome Extension

A fast Chrome extension for searching cryptocurrency trading pairs across multiple exchanges without waiting for exchange websites to load.

## Features

- **Multi-exchange search**: Switch between Indodax, Pintu, Binance, MEXC, KuCoin, GateIO, Bitget, and Bybit.
- **Exchange tabs**: Use compact, fixed-size tabs with clear active-state highlighting. Tabs wrap across rows instead of scrolling horizontally.
- **Current-tab detection**: Automatically selects the exchange matching the active browser tab. GateIO detection supports `gate.com`, `gate.io`, and `gateio.com`; MEXC supports `mexc.fm` and `mexc.com`.
- **Exchange-specific API adapters**: Handles each exchange's different symbol-list response format and normalizes pairs for one search experience.
- **Target-quote filtering**: Shows IDR pairs for Indodax and Pintu, and USDT pairs for the other supported exchanges.
- **Fast local caching**: Stores each exchange's pair list locally for 24 hours, reducing repeated API requests.
- **Instant search**: Searches pair symbols, base currencies, quote currencies, and descriptions as you type.
- **Direct market links**: Click a result to open the corresponding market on the selected exchange.
- **Manual refresh**: Refresh one exchange's cached pair list on demand.
- **Responsive popup UI**: Includes an accessible search field, empty results state, error messages, and a modern compact layout.

## Supported Exchanges

| Exchange | Target quote | Market URL |
| --- | --- | --- |
| Indodax | IDR | `https://indodax.com/market/{pairquote}` |
| Pintu | IDR | `https://pintu.com/pro/id/trade/{pair_quote}` |
| Binance | USDT | `https://www.binance.com/en/trade/{pair_quote}` |
| MEXC | USDT | `https://www.mexc.fm/exchange/{pair_quote}` |
| KuCoin | USDT | `https://www.kucoin.com/trade/{pair_quote}` |
| GateIO | USDT | `https://www.gate.com/trade/{pair_quote}` |
| Bitget | USDT | `https://www.bitget.com/spot/{pairquote}` |
| Bybit | USDT | `https://www.bybit.com/en/trade/spot/{base}/{quote}` |

The symbol-list API URLs and response notes are documented in [`BASE_URL.md`](BASE_URL.md).

## Installation

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository directory.
5. Pin **Exchange Coin Search** to the browser toolbar.

After changing the source files, click **Reload** for the extension on the extensions page.

## Usage

1. Open the extension popup.
2. Choose an exchange tab, or use the automatically detected exchange.
3. Type a coin, symbol, quote currency, or description into the search field.
4. Click a result to open its market page in a new tab.
5. Click the refresh button to fetch the selected exchange's latest pair list.

## Technical Details

- **Manifest**: Chrome Manifest V3.
- **Storage**: `chrome.storage.local`, with a separate cached list for each exchange.
- **Cache duration**: 24 hours. The current cache schema uses a versioned key so API format changes trigger a fresh download.
- **Networking**: Public exchange symbol APIs; no authentication or account access is required.
- **Permissions**: `storage`, `tabs`, and host access for the supported exchange websites and public APIs.
- **API configuration**: Exchange definitions, target quotes, normalizers, and market URL builders are in `popup.js`.

## Development

- `manifest.json` - Chrome extension configuration and permissions
- `popup.html` - Popup markup
- `popup.js` - Exchange adapters, tab detection, caching, fetching, filtering, and search
- `popup.css` - Popup layout and styling
- `BASE_URL.md` - Supported exchange market and symbol-list API references
- `icon16.png`, `icon48.png`, `icon128.png` - Extension icons
- `create-icons.html` - Icon generation helper
