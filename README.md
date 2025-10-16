# ID iFrames

A collection of standalone HTML iframe utilities for image viewing, document management, and cashier logging. These lightweight components are designed to be embedded as iframes in larger applications.

## Components

### Audit & Logging
- **`audit-log.html`** - Audit Log Viewer
  - Timeline-based audit trail display
  - Status badges (Pending, In Progress, Pass, Fail, Completed)
  - Risk indicators and PEP status tracking (CPEP, PPEP, NPEP)
  - Safe Harbour and PEP Monitoring flags
  - Matter details with expandable addresses
  - PDF export functionality with jsPDF
  - Relative timestamps with full date/time display

- **`cashiers-log.html`** - Cashiers Log
  - Track cashier activities and events
  - Custom fonts for user emails, log messages, and timestamps
  - Responsive design with dynamic card loading

- **`wallboard-iframe.html`** - Metrics Dashboard
  - Real-time metrics dashboard with fee earner breakdown
  - Auto-refresh every 5 minutes with countdown timer
  - Interactive analytics view with charts
  - PDF export functionality
  - Aggregate and individual fee earner analytics

### Image Management
- **`image-viewer.html`** - ID Images Display
  - View and display identification images
  - Modern, responsive interface
  - Custom typography with Transport and Rotis fonts

- **`single-image-viewer.html`** - Single Image Viewer
  - Standalone fullscreen image viewer
  - URL hash-based data loading (base64 JSON)
  - Zoom and pan controls with mouse/touch support
  - Document details banner display
  - No postMessage - uses URL parameters

- **`image-uploader.html`** - Full Client Onboarding Form
  - Complete onboarding with 4 sections (Details, Photo ID, Address, Address ID)
  - Upload client identification images and documents
  - Form-based interface with S3 direct upload
  - Address lookup via getaddress.io integration
  - Thirdfort API format support
  
- **`client-details.html`** - Lightweight Client Details & Address Form
  - Streamlined client details collection (NO uploads)
  - Personal information and address history only
  - Address autocomplete with getaddress.io
  - Automatic Thirdfort address formatting
  - Entity mode for business/charity clients

- **`request-form.html`** - Comprehensive Request Management Form ⭐ NEW
  - Dynamic multi-request type form system (7 request types)
  - Modular architecture with separate request type handlers
  - Request types: Form J, Form K, Form E, eSoF, Note, Issue Update, PEP Update
  - Form K includes 11 conditional rules with dynamic filtering
  - Smart section visibility based on client type and selected request
  - Automatic Form E + eSoF combination for purchase worktypes
  - Comprehensive validation with detailed error messages
  - CDF and OFSI document upload and management
  - ID Images carousel display with side tags
  - Business/Charity people cards (directors, officers, trustees, PSCs)
  - Companies House and Charity Register integration
  - Google libphonenumber integration for mobile validation
  - Global file upload system with progress tracking
  - Parent communication for client-data, request-data, file uploads

- **`document-viewer.html`** - Document Display
  - View and display document images
  - Similar styling to image viewer

### Data Visualization
- **`single-chart-viewer.html`** - Chart Viewer
  - Dynamic Chart.js visualization
  - Supports multiple chart types (pie, doughnut, bar, line, etc.)
  - Responsive charts with custom fonts
  - Handles empty data states gracefully

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

