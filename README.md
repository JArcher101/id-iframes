# ID iFrames

A collection of standalone HTML iframe utilities for image viewing, document management, and cashier logging. These lightweight components are designed to be embedded as iframes in larger applications.

## Components

### Image Management
- **`image-viewer.html`** - ID Images Display
  - View and display identification images
  - Modern, responsive interface
  - Custom typography with Transport and Rotis fonts

- **`image-uploader.html`** - Client Details Form
  - Upload client identification images
  - Form-based interface for client data entry
  - Embedded font support with Google Fonts fallback

- **`document-viewer.html`** - Document Display
  - View and display document images
  - Similar styling to image viewer

### Utilities
- **`cashiers-log.html`** - Cashiers Log
  - Track cashier activities and events
  - Custom fonts for user emails, log messages, and timestamps
  - Responsive design

### Additional Files
- **`message-iframe.html`** - Message display interface
- **`report-uploader.html`** - Report upload utility
- **`test-responsive.html`** - Responsive testing tool

## Features

- **Standalone HTML files** - No build process required
- **Custom typography** - Uses Transport and Rotis font families with base64 embedding
- **Fallback fonts** - Automatically falls back to Google Fonts (Quicksand)
- **Responsive design** - Works across different screen sizes
- **iframe-ready** - Designed to be embedded in parent applications

## Usage

Simply open any HTML file in a web browser or embed it as an iframe:

```html
<iframe src="image-viewer.html" width="100%" height="600"></iframe>
```

## Documentation

- **[Interactive API Documentation](api-docs.html)** - Live examples with embedded iframes and interactive demos (open in browser)
- **[API.md](API.md)** - Comprehensive postMessage API reference, message types, and data structures (markdown format)
- **[CHANGELOG.md](CHANGELOG.md)** - Version history, release notes, and future roadmap

For the best developer experience, start with the interactive documentation which includes live examples you can test in your browser.

## Typography

The project uses a custom font stack:
- **Transport Medium** - For headings, buttons, and user identifiers
- **Rotis Sans Serif Light** - For body text and log messages
- **Rotis Sans Serif Italic** - For timestamps and metadata
- **Rotis Sans Serif Bold** - For tags and emphasis

All fonts are embedded as base64 data URIs with automatic fallback to Google Fonts (Quicksand family).

## Browser Compatibility

These components work in all modern browsers that support:
- HTML5
- CSS3
- Modern JavaScript (ES6+)
- Base64 font embedding

## License

All rights reserved. Fonts are licensed by Adobe Systems Incorporated and Monotype Imaging Inc.

