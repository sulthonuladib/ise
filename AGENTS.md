# AGENTS.md

Chrome extension (Manifest V3) for searching crypto trading pairs across 8 exchanges. Vanilla JS/HTML/CSS — no build step, no bundler, no tests, no linter.

## Architecture

- `popup.js` — all logic: exchange adapters, API fetching, caching, tab detection, search, UI
- `popup.html` / `popup.css` — popup shell and styles
- `manifest.json` — MV3 config, host permissions for exchange APIs
- `BASE_URL.md` — API reference for each exchange's symbol-list endpoint

Every exchange is defined in the `EXCHANGES` object in `popup.js`. Each entry has: `name`, `quote` (target quote currency), `apiUrl`, `hosts` (for tab detection), `formatUrl` (market link builder), and `normalize` (raw API pair → `NormalizedPair`).

## Quirks

- Indodax and Pintu use IDR pairs; all others use USDT.
- Cache key is versioned (`exchange_pair_cache_v3`). Bump the version when changing the normalized pair schema.
- Each exchange API returns a different shape — see `extractPairs()` for the extraction logic.
- MEXC normalizer handles both `baseAsset`/`quoteAsset` and `baseCoin`/`quoteCoin` fields.
- Popup is fixed 400×520px (set in CSS `body` and `.app`).
- No dev server. To test: load as unpacked extension in `chrome://extensions/`, then reload after edits.

## Adding an Exchange

1. Add entry to `EXCHANGES` in `popup.js` with `name`, `quote`, `apiUrl`, `hosts`, `formatUrl`, `normalize`.
2. Add extraction case in `extractPairs()` if the API response shape doesn't match the default array pattern.
3. Add host permissions in `manifest.json`.
4. Document the API in `BASE_URL.md`.
