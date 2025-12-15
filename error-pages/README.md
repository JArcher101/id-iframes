# Error Pages System

This directory contains a modular error page system for CloudFront distributions.

## Structure

```
error-pages/
├── templates/           # Reusable template components
│   ├── header.html      # Page header with logo and navigation
│   ├── system-strip.html # System identifier strip (ID Images, ID Documents, etc.)
│   ├── error-body.html  # Main error content area
│   └── footer.html      # Page footer with links
├── generated/           # Generated error pages (created by build script)
├── build-error-pages.js # Build script to generate all error pages
└── README.md           # This file
```

## How It Works

1. **Templates** define reusable components (header, footer, system strip, error body)
2. **Build script** (`build-error-pages.js`) generates error pages for:
   - All error codes: 400, 403, 404, 405, 414, 416, 500, 501, 502, 504
   - All systems: id-images, id-documents, sdlt-documents
   - Generic pages (no system-specific content)

3. **Generated pages** are uploaded to S3 buckets

## Building Error Pages

```bash
# Install Node.js dependencies (if needed)
npm install

# Generate all error pages
node build-error-pages.js
```

This will create error pages in the `generated/` directory:
- `403-id-images.html` - 403 error for ID Images system
- `403-id-documents.html` - 403 error for ID Documents system
- `403-sdlt-documents.html` - 403 error for SDLT Documents system
- `403.html` - Generic 403 error (no system-specific content)
- ... and so on for all error codes

## Customizing

### Edit Templates

Modify the template files in `templates/` to change:
- **Header**: Logo, navigation, styling
- **System Strip**: How the system name is displayed
- **Error Body**: Error icon, code, title, description layout
- **Footer**: Footer content and links

### Edit Error Configurations

Modify `build-error-pages.js` to change:
- Error icons, titles, and descriptions
- System-specific error messages
- System names and descriptions

### Edit System-Specific Messages

In `build-error-pages.js`, update `systemSpecificDescriptions` to customize error messages per system type.

## Uploading to S3

After generating pages, upload them to all 6 buckets:

```powershell
# Upload generated pages to protected/errors/ (recommended)
powershell -ExecutionPolicy Bypass -File scripts/sync-error-pages-to-s3.ps1 -ErrorPagesPath "error-pages/generated" -S3Prefix "protected/errors"
```

## CloudFront Configuration

Configure CloudFront error responses to use:
- `/protected/errors/403.html` for generic 403 errors
- Or system-specific pages if you want different content per system

## Design System

The error pages use:
- **Colors**: Purple gradient background (#667eea to #764ba2)
- **Typography**: Quicksand font family
- **Layout**: Responsive, mobile-friendly
- **Components**: Modular header, system strip, error body, footer
