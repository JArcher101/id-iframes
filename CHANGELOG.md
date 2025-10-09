# Changelog

All notable changes to the ID iFrames project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- README.md with project overview and component descriptions
- API.md with comprehensive postMessage API documentation
- Interactive API documentation page (api-docs.html)
- CHANGELOG.md for tracking project changes

## [1.0.0] - 2025-10-09

### Initial Release

#### Components
- `image-viewer.html` - ID Images Display with upload functionality
- `image-uploader.html` - Client Details Form for onboarding
- `document-viewer.html` - Document Display and management
- `message-iframe.html` - Staff-Cashier chat interface
- `report-uploader.html` - Standard report upload system
- `cashiers-log.html` - Cashier activity logging
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


