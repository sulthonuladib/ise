# Indodax Search Chrome Extension

A fast Chrome extension for searching Indodax cryptocurrency pairs with local caching.

## Features

- **Fast Search**: Instantly search through all Indodax trading pairs
- **Local Caching**: Stores pair data locally for 24 hours to avoid repeated API calls
- **Quick Access**: Click on any pair to open it directly on Indodax
- **Manual Refresh**: Refresh button to update the pair list on demand
- **Clean UI**: Simple and responsive interface

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `indodax-search-extension` folder
5. The extension will appear in your browser toolbar

## Generating Icons

1. Open `create-icons.html` in your browser
2. The icons will be automatically downloaded
3. Move the downloaded icons to the extension folder

## Usage

1. Click the extension icon in your toolbar
2. Start typing to search for coin pairs (e.g., "BTC", "ETH", "USDT")
3. Click on any result to open that market on Indodax
4. Use the refresh button to update the pair list manually

## Technical Details

- **API**: Uses Indodax public API endpoint: `https://indodax.com/api/pairs`
- **Cache Duration**: 24 hours (automatically refreshes after expiry)
- **Storage**: Chrome's local storage API
- **Permissions**: Only requires storage permission and access to indodax.com

## Development

The extension consists of:
- `manifest.json` - Chrome extension configuration
- `popup.html` - Extension popup interface
- `popup.js` - Main logic for fetching, caching, and searching
- `popup.css` - Styling for the popup
- `icon*.png` - Extension icons (16x16, 48x48, 128x128)
