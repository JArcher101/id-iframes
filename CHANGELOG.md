# Changelog

All notable changes to the ID iFrames project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`uk-sanctions-checker.html`** - UK Sanctions List Search ⭐ NEW FEATURE
  - Search and query the UK FCDO Sanctions List for individuals and entities
  - Live XML data fetching from https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml
  - Session-based caching (XML parsed once on load, cached for session duration)
  - Two search modes: Exact match (case-insensitive substring) and Fuzzy match (Levenshtein distance with 70%+ threshold)
  - Search types: Individual or Entity (Ships automatically filtered out)
  - Year of birth filtering for individuals with support for dd/mm/yyyy and yyyy formats
  - Comprehensive result cards with expandable details
  - Result display: Primary name, aliases, nationality, DOB, regime, sanctions, addresses
  - Expandable full details: All names (Latin + non-Latin), positions, addresses, other information, UK Statement of Reasons
  - Professional PDF report generation with jsPDF including all search results
  - Conditional S3 upload integration when connected to client entry (using document-viewer pattern)
  - Download-only mode when no client entry provided
  - Matches Thirdfort design system with Transport/Rotis fonts and blue/tan color scheme
  - Loading states, error handling, success notifications
  - Parent communication: init-sanctions-search, file-data, put-links, upload-success
  - Pre-population of search fields from parent (client name, year of birth, search type)
  - Automatic button text change based on upload context ("Generate PDF" vs "Generate PDF & Upload")
- **`migration-tagger.html`** - ID Image Migration Tool ⭐ NEW FEATURE
  - Migrate existing Wix Media Gallery images to S3 storage
  - Hotkey-based tagging system (P, DF, DB, OS, OF, OB, A)
  - Batch processing (1-10 entries at a time)
  - Split layout: Image list (left) + Main tagging area (right)
  - Simplified tagging: Passport, Driving Licence, Other Photo ID, Address ID
  - Auto-progression through images with automatic advancement
  - Entry confirmation with Enter key to move to next entry
  - Visual feedback: Tagged images show badges, completed entries turn green
  - Backspace navigation to re-tag previous images
  - Card-based upload progress with status badges (Pending/Uploading/Success/Error)
  - "System transfer" uploader marker to distinguish legacy migrations
  - Red error popup for backend/network errors with retry capability
  - Clickable hotkey hints for mouse/touch users
  - wixData.bulkSave() integration for efficient database updates
  - Minimal update objects (only _id, idImages, imagesTransferred fields)
  - Parent communication: migration-batch, image-data, migration-complete, backend-error, network-error
  - Mock data button with 10 test entries for development testing
- **`thirdfort-check.html`** - Thirdfort Check Manager ⭐ MAJOR NEW FEATURE
  - Comprehensive check creation and management interface for Thirdfort API integration
  - Four check types: IDV (Identity Verification), Lite Screen, Electronic ID, KYB (Know Your Business)
  - Matter category routing: Conveyancing, Property Other, Private Client, Other
  - Intelligent auto-selection based on work type, relation, and client tags (Form E, eSoF Requested)
  - Electronic ID types: Standard ID (KYC + IDV) and Additional Tasks Only
  - Dynamic checkbox configuration for Proof of Ownership, eSoF Questionnaire, eSoW Bank Linking, PEP Monitoring, International Address Verification
  - IDV image selection with exact document type matching and front/back side handling
  - Popup window image viewer integration with `single-image-viewer.html`
  - Matter details display card (work type, matter description, relation)
  - Latest message display from staff/cashier chat
  - Google libphonenumber integration for mobile validation (country-aware, mobile-specific)
  - Searchable autocomplete dropdowns for phone codes, countries, and jurisdictions with blue code badges
  - Address autocomplete with getaddress.io integration via parent proxy
  - Full Thirdfort API compliance with validation functions
  - Request construction for multiple endpoints (Lite Screen/Electronic ID, IDV check, IDV documents, KYB)
  - Core JavaScript module: `js/thirdfort-check-core.js` (~3,000 lines)
  - Mock data buttons for testing different client scenarios
  - Parent communication: client-data, request-thirdfort-check, address-search, address-lookup
- **`request-form.html`** - Comprehensive Request Management Form ⭐ MAJOR NEW FEATURE
  - Dynamic multi-request type form system supporting 7 distinct request types
  - Modular JavaScript architecture with core + request type modules (~4,500 lines)
  - Request types: Form J, Form K (11 rules), Form E, eSoF Request, Note, Issue Update, PEP Update
  - Smart section visibility based on client type (individual/business/charity) and selected request
  - Form K conditional rule filtering (Rules 1-3, 10-11 for individuals; all 11 for entities)
  - Form K Rule 1/2 disabled for "Sale" worktypes with validation
  - Form K Rule 3 limited to Will/LPA/Deeds worktypes with Form J ID requirements
  - Automatic Form E + eSoF combination for "Purchase" worktypes
  - Dynamic hint system (k3Hint, ejHint, eSoFHint, eSoFSkipHint, eSoFOnlyHint, nameVerificationHint)
  - CDF and OFSI document upload with dropdown type selection
  - ID Images carousel with side tags (FRONT/BACK) in brand tan/brown color
  - ID Documents section with entity-aware hints (people vs entity)
  - Business/Charity details with people cards (directors, officers, PSCs, trustees)
  - Smart people card merging (deduplicates same person with multiple roles)
  - Companies House and Charity Register popup integration
  - Google libphonenumber for robust mobile number validation
  - Smart address handling with Thirdfort format validation
  - Global file upload system with S3 integration and progress tracking
  - Comprehensive validation with detailed multi-line error messages
  - Global DOB validator (validates real dates, rejects future dates, formats DD-MM-YYYY)
  - Form state management with message input preservation
  - Full Velo frontend integration with shorthand field names (`cD`, `cI`, `r`, `wT`, `mD`, etc.)
  - Message object includes `type: 'Staff'` flag for all request types
  - `eSoF` flag at top level of request-data (only for Form E, based on eSoF Request tag selection)
  - Parent communication: client-data, request-data, address-search, address-lookup, company-search, charity-search, company-lookup, charity-lookup, file-data, put-links
  - Deleted old request-iframe.html files (replaced by modular system)
- **`audit-log.html`** - Enhanced with Latest Activity Display
  - Added `lastLog` support - displays most recent cashiers log entry in expanded view
  - Added `lastMessage` support - displays most recent chat message in expanded view
  - Both include optional file attachments with badge display
  - Helps provide immediate context without navigating to separate sections

### Fixed
- **Image Viewer & Single Image Viewer**: Fixed download buttons opening images in current tab instead of downloading
  - Updated `downloadImage()` function to open in new tab if fetch() fails due to CORS
  - Added `target="_blank"` and `rel="noopener noreferrer"` to fallback link
  - Documented CloudFront Response Headers Policy requirement in AWS setup guides
  - Created `aws-setup/06-cloudfront-response-headers.json` for CORS configuration
  - **Root cause**: CloudFront doesn't forward S3 CORS headers by default
  - **Solution**: Apply Response Headers Policy to both CloudFront distributions
- **Image Uploader**: Fixed `sendUploadSuccessMessage is not defined` error
  - Created missing function to send upload success message to parent
  - Function compiles form data and sends `upload-success` message with S3 keys
- Chart Viewer: Fixed doughnut chart expansion - serialize functions for postMessage
- Cashiers Log: Container height fully responsive with dynamic card loading
- Form K: Fixed "sale" worktype detection bug (was matching "Purchase" due to substring "se")

### Enhanced
- **All Forms: Autocomplete Dropdown System** 🎯 MAJOR UX IMPROVEMENT
  - Replaced all static dropdowns with searchable autocomplete inputs
  - **Phone Country Codes**: Flag emoji + code + country name (e.g., "🇬🇧 +44 UK")
  - **Address Countries**: Country name with blue code badge (e.g., "United Kingdom [GBR]")
  - **Business Jurisdictions**: Jurisdiction name with blue code badge (e.g., "United Kingdom [GB]")
  - Blue code badge styling: `#e8f4f8` background, `rgb(0,60,113)` text, Transport font
  - Shared infrastructure: `js/jurisdiction-autocomplete.js` powers all dropdowns
  - Data handling via dataset attributes: `data-country-code`, `data-phone-code`, `data-jurisdiction-code`
  - Helper functions: `setCountry()`, `setPhoneCode()`, `setJurisdiction()` for proper data loading
  - Applied to: `thirdfort-check.html`, `client-details.html`, `request-form.html`, `image-uploader.html`
- **Manual Address Fields Layout**: 25/25/50 grid for flat number, building number, building name
  - Applied to current and previous address fields in all forms
  - Responsive breakpoints for tablet (20/20/1fr) and mobile (stacked)
  - Improves data entry UX for manual address input
- Image Viewer: Added button-enable/button-disable messages for upload button control
- Document Viewer: Added button-enable/button-disable messages for upload button control  
- Message iframe: Added button-enable/button-disable messages for send button control
- All viewers now support dynamic button state management from parent
- Client Details Form: Enhanced with autocomplete dropdowns and improved address handling
  - Google libphonenumber library for mobile phone validation
  - Phone numbers validated and formatted in E.164 international format
  - Business data returns basic info (name, number, country) even without API link
  - Validation errors sent via validation-error message
- Image Uploader Form: Enhanced with autocomplete country dropdowns
  - Consistent autocomplete UX with other forms
  - Proper country code handling for address objects
  - Blue code badge styling matching repository standard
- Request Form: Enhanced with autocomplete dropdowns for all country/phone/jurisdiction fields
  - People cards now have 10px vertical spacing between items
  - Consistent data handling with dataset attributes across all fields

### Removed
- Deleted old request-iframe.html, request-iframe-clean.html, request-iframe-temp.html
- Deleted old request-iframe.js and request-iframe-styles.css
- Replaced monolithic iframe with modular request-form.html system

### Added
- README.md with project overview and component descriptions
- API.md with comprehensive postMessage API documentation
- Interactive API documentation page (api-docs.html)
- CHANGELOG.md for tracking project changes
- `audit-log.html` - Audit Log Viewer iframe
  - Timeline-based display of case activity and status changes
  - Visual badges for status (Pending, In Progress, Pass, Fail, Completed)
  - Risk indicators and PEP status badges (CPEP, PPEP, NPEP)
  - Safe Harbour and PEP Monitoring flags
  - Matter details display (client info, addresses, documents)
  - Expandable matter details with formatted addresses
  - PDF export functionality with jsPDF integration
  - Relative timestamps ("2 hours ago") with full date/time
  - Custom Transport and Rotis fonts for professional appearance
  - Empty state handling when no log entries exist
- `wallboard-iframe.html` - Metrics Dashboard & Analytics
  - Real-time metrics dashboard with fee earner breakdown
  - Auto-refresh with 5-minute countdown timer
  - Interactive fee earner dropdown selection
  - Detailed analytics view with chart visualizations
  - Aggregate (ALL) and individual fee earner analytics
  - PDF export with formatted metrics table
  - Parent communication: wallboard-data, analytics-data, analytics-error, refresh-request, fe-analytics
  - Responsive design with custom fonts
  - Seamless view switching between dashboard and analytics
- `single-image-viewer.html` - Single Image Viewer
  - Standalone image viewer with zoom and pan controls
  - URL hash-based data loading (base64 encoded JSON)
  - Pan with mouse drag or touch gestures
  - Zoom with mouse wheel, buttons, or pinch gestures
  - Double-click to reset zoom and pan
  - Fullscreen image display
  - Document details banner (type, side, uploader, date)
  - No postMessage API - uses URL parameters
  - Responsive controls with touch support
- `client-details.html` - Lightweight Client Details & Address Form
  - Streamlined client details collection (NO file uploads)
  - Personal information form with DOB, name changes, entity selection
  - Address lookup integration with getaddress.io via parent proxy
  - Automatic Thirdfort API format conversion for UK/USA/CAN/Other addresses
  - Current and previous address support
  - LRU cache with 30-day expiry for addresses
  - Parent communication: new-data, address-search, address-lookup, disable-close
  - Validation messages and error handling
  - Entity mode support (business/charity vs individual)
- `single-chart-viewer.html` - Dynamic Chart.js visualization iframe
  - Supports multiple chart types (bar, line, pie, doughnut, radar, polarArea, bubble, scatter)
  - Responsive design with custom Transport and Rotis fonts
  - Real-time chart updates via postMessage
  - Automatic chart destruction and recreation when receiving new data
  - Empty data state handling (remains blank when all values are 0)
  - Integration with Chart.js 4.4.0 CDN
  - Expand to popup window feature with unique ID handshake
  - Real-time popup synchronization when data updates
  - Automatic bullet point list formatting in descriptions
  - Support for horizontal stacked bar charts for dashboard views

## [1.0.0] - 2025-10-09

### Initial Release

#### Components
- `image-viewer.html` - ID Images Display with upload functionality
- `image-uploader.html` - Full Client Onboarding Form (with uploads)
- `client-details.html` - Lightweight Client Details & Address Form (no uploads)
- `document-viewer.html` - Document Display and management
- `message-iframe.html` - Staff-Cashier chat interface
- `report-uploader.html` - Standard report upload system
- `cashiers-log.html` - Cashier activity logging with responsive height
- `wallboard-iframe.html` - Metrics Dashboard with analytics
- `audit-log.html` - Audit trail viewer with timeline display
- `single-image-viewer.html` - Standalone fullscreen image viewer
- `test-responsive.html` - Testing utility for iframes

#### Features
- postMessage API for parent-child communication
- S3 direct upload with presigned URLs
- Custom Transport and Rotis font embedding with base64
- Google Fonts (Quicksand) fallback system
- Responsive design across all components
- Error handling with automatic retry logic
- Real-time upload progress tracking
- Document type validation
- File size and type restrictions

#### Typography
- Transport Medium font for headings and buttons
- Rotis Sans Serif Light for body text
- Rotis Sans Serif Italic for timestamps
- Rotis Sans Serif Bold for emphasis
- Unicode-range based fallback system

#### Communication
- Standardized message types across all iframes
- Consistent data structures for client info
- File metadata transmission without File object cloning
- Origin validation ready for production deployment

---

## Future Roadmap

### Planned Features
- [ ] Batch upload support for multiple files
- [ ] Drag-and-drop file upload interface
- [ ] Image preview before upload
- [ ] PDF thumbnail generation
- [ ] Accessibility improvements (ARIA labels)
- [ ] Internationalization (i18n) support
- [ ] Dark mode theme
- [ ] Offline support with service workers
- [ ] Progressive enhancement for older browsers

### Under Consideration
- [ ] WebSocket support for real-time updates
- [ ] Image compression before upload
- [ ] OCR integration for document text extraction
- [ ] Digital signature support
- [ ] Multi-factor authentication integration
- [ ] Audit trail logging
- [ ] Export functionality (PDF reports)

---

## Notes

### Version Numbering
- **Major version** (X.0.0): Breaking changes to API or message structure
- **Minor version** (0.X.0): New features, backwards compatible
- **Patch version** (0.0.X): Bug fixes, no API changes

### Communication Breaking Changes
Any changes to message types, data structures, or communication patterns will be clearly marked as **BREAKING CHANGE** in the changelog.

### Font Updates
Font file updates are considered patch-level changes unless they affect rendering significantly.

---

[Unreleased]: https://github.com/yourusername/id-iframes/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/id-iframes/releases/tag/v1.0.0


