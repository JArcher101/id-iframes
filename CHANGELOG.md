# Changelog

All notable changes to the ID iFrames project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`request-form.html`** - Comprehensive Request Management Form ⭐ MAJOR NEW FEATURE
  - Dynamic multi-request type form system supporting 7 distinct request types
  - Modular JavaScript architecture with core + request type modules (2,800+ lines)
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
  - Parent communication: client-data, request-data, company-lookup, charity-lookup, file-data, put-links
  - Deleted old request-iframe.html files (replaced by modular system)

### Fixed
- Chart Viewer: Fixed doughnut chart expansion - serialize functions for postMessage
- Cashiers Log: Container height fully responsive with dynamic card loading
- Form K: Fixed "sale" worktype detection bug (was matching "Purchase" due to substring "se")

### Enhanced
- Image Viewer: Added button-enable/button-disable messages for upload button control
- Document Viewer: Added button-enable/button-disable messages for upload button control  
- Message iframe: Added button-enable/button-disable messages for send button control
- All viewers now support dynamic button state management from parent
- Client Details Form: Integrated Google libphonenumber library for mobile phone validation
  - Phone numbers are validated before sending new-data message
  - Numbers are formatted in E.164 international format
  - Validation errors are sent via validation-error message

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


