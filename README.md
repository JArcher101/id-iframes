# ID iFrames

A collection of standalone HTML iframe utilities for image viewing, document management, and cashier logging. These lightweight components are designed to be embedded as iframes in larger applications.

## Components

### Check Management
- **`thirdfort-check.html`** - Thirdfort Check Manager ⭐ NEW
  - Comprehensive check creation interface for Thirdfort API
  - Four check types: IDV, Lite Screen, Electronic ID, KYB
  - Matter category routing with intelligent auto-selection
  - Electronic ID with dynamic task configuration
  - IDV image selection with popup viewer
  - Google libphonenumber mobile validation
  - Searchable autocomplete for phone/country/jurisdiction
  - Full Thirdfort API compliance and validation
  - Parent communication: client-data, request-thirdfort-check

- **`uk-sanctions-checker.html`** - UK Sanctions List Search ⭐ NEW
  - Search FCDO UK Sanctions List for individuals and entities
  - Live XML data fetching with session caching
  - Exact and fuzzy name matching (Levenshtein distance)
  - Year of birth filtering for individuals
  - Comprehensive result display with expandable details
  - PDF report generation with jsPDF
  - Optional S3 upload integration for client entries
  - Matches Thirdfort design system styling
  - Parent communication: init-sanctions-search, file-data, upload-success

### Audit & Logging
- **`audit-log.html`** - Audit Log Viewer
  - Timeline-based audit trail display
  - Status badges (Pending, In Progress, Pass, Fail, Completed)
  - Risk indicators and PEP status tracking (CPEP, PPEP, NPEP)
  - Safe Harbour and PEP Monitoring flags
  - Matter details with expandable addresses
  - Latest cashiers log entry (`lastLog`) display with attachments
  - Latest chat message (`lastMessage`) display with attachments
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
- **`migration-tagger.html`** - ID Image Migration Tool ⭐ NEW
  - Migrate existing Wix Media Gallery images to S3
  - Hotkey-based tagging (P, DF, DB, OS, OF, OB, A)
  - Batch processing (1-10 entries at a time)
  - Split layout: Image list (left) + Main tagging area (right)
  - Simplified tagging: Passport, Driving Licence, Other Photo ID, Address ID
  - Auto-progression through images with Enter key confirmation
  - S3 upload with wixData.bulkSave() integration
  - Parent communication: migration-batch, image-data, migration-complete

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
  - Searchable autocomplete for country selection with blue code badges
  - Form-based interface with S3 direct upload
  - Address lookup via getaddress.io integration
  - Thirdfort API format support
  
- **`client-details.html`** - Lightweight Client Details & Address Form
  - Streamlined client details collection (NO uploads)
  - Personal information and address history only
  - Searchable autocomplete for phone codes, countries, jurisdictions
  - Address autocomplete with getaddress.io
  - Automatic Thirdfort address formatting
  - Google libphonenumber phone validation
  - Entity mode for business/charity clients
  - Blue code badge styling for country/jurisdiction codes

- **`request-form.html`** - Comprehensive Request Management Form
  - Dynamic multi-request type form system (7 request types)
  - Modular architecture with separate request type handlers
  - Request types: Form J, Form K, Form E, eSoF, Note, Issue Update, PEP Update
  - Form K includes 11 conditional rules with dynamic filtering
  - Smart section visibility based on client type and selected request
  - Automatic Form E + eSoF combination for purchase worktypes
  - Searchable autocomplete for phone codes, countries, jurisdictions with blue code badges
  - Comprehensive validation with detailed error messages
  - CDF and OFSI document upload and management
  - ID Images carousel display with side tags
  - Business/Charity people cards with 10px spacing (directors, officers, trustees, PSCs)
  - Companies House and Charity Register integration
  - Google libphonenumber integration for mobile validation
  - 25/25/50 grid layout for manual address fields
  - Global file upload system with progress tracking
  - Full Velo frontend integration with shorthand field names
  - Message object with `type: 'Staff'` flag
  - eSoF flag at top level for Form E requests
  - Parent communication: client-data, request-data, address-search, company-search, charity-search, file-data, put-links

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
- **Searchable autocomplete dropdowns** - Phone codes, countries, jurisdictions across all forms
- **Blue code badge styling** - Consistent visual design for country/jurisdiction codes
- **Custom typography** - Uses Transport and Rotis font families with base64 embedding
- **Fallback fonts** - Automatically falls back to Google Fonts (Quicksand)
- **Responsive design** - Works across different screen sizes
- **Google libphonenumber** - International phone validation and formatting
- **Thirdfort API compliance** - Proper address formatting and validation
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

