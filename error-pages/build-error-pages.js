/**
 * Error Page Builder
 * Generates error pages for all error codes and bucket types
 * 
 * Usage: node build-error-pages.js
 */

const fs = require('fs');
const path = require('path');

// Error code configurations with emojis and causes
const errorConfigs = {
  400: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The request URL was malformed or invalid',
      'Missing required parameters in the request',
      'Invalid file format or encoding',
      'The request was rejected by the server'
    ]
  },
  403: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The URL has expired or the access token is invalid',
      'You do not have permission to access this resource',
      'The signed URL has been revoked',
      'Authentication credentials are missing or incorrect'
    ]
  },
  404: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The file has been moved or deleted',
      'The URL path is incorrect',
      'The file was never uploaded to the system',
      'The file may have been archived or removed'
    ]
  },
  405: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The HTTP method used is not allowed for this resource',
      'Only GET requests are supported for file access',
      'The request method is not permitted for this endpoint'
    ]
  },
  414: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The request URL is too long',
      'The URL exceeds the maximum allowed length',
      'Too many query parameters in the request'
    ]
  },
  416: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The requested byte range is not available',
      'The file size does not match the requested range',
      'Invalid range headers in the request'
    ]
  },
  500: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'An internal server error occurred',
      'The server is temporarily unavailable',
      'A database or storage system error occurred',
      'Please try again in a few moments'
    ]
  },
  501: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'This feature is not yet implemented',
      'The requested functionality is not available',
      'The server does not support this operation'
    ]
  },
  502: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The server received an invalid response from an upstream server',
      'A gateway or proxy server error occurred',
      'The service is temporarily unavailable',
      'Please try again in a few moments'
    ]
  },
  504: {
    emoji: '📄',
    title: "We're sorry but an error occurred getting that document/image",
    causes: [
      'The request timed out waiting for a response',
      'The server took too long to process the request',
      'A timeout occurred while retrieving the file',
      'Please try again'
    ]
  }
};

// System/Bucket configurations
const systemConfigs = {
  'id-images': {
    name: 'ID Images CDN',
    emoji: '🖼️',
    isDocument: false
  },
  'id-documents': {
    name: 'ID Documents CDN',
    emoji: '📄',
    isDocument: true
  },
  'sdlt-documents': {
    name: 'SDLT Documents CDN',
    emoji: '📄',
    isDocument: true
  }
};

// Footer text content
const footerTexts = {
  'sdlt-documents': `
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a> on behalf of Dwellworks.
    </p>
    <p class="footer-paragraph">
      By accessing this page, you agree to our <a href="https://thurstanhoskin.co.uk/file-upload/log-in/?system=Dwellworks&terms=true" class="footer-link">Terms of Use</a> and <a href="https://thurstanhoskin.co.uk/privacy" class="footer-link">Privacy Policy</a>.
    </p>
  `,
  'id-documents': `
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a>.
    </p>
  `,
  'id-images': `
    <p class="footer-paragraph">
      This page is managed and owned by <a href="https://www.thurstanhoskin.co.uk" class="footer-link">Thurstan Hoskin Solicitors</a>.
    </p>
  `
};

// Read template files
function readTemplate(name) {
  const templatePath = path.join(__dirname, 'templates', `${name}.html`);
  return fs.readFileSync(templatePath, 'utf8');
}

// Build error page HTML
function buildErrorPage(errorCode, systemKey) {
  const config = errorConfigs[errorCode];
  const system = systemConfigs[systemKey];
  
  // Determine emoji based on system type
  const emoji = system.isDocument ? '📄' : '🖼️';
  
  // Build causes list HTML
  const causesList = config.causes.map(cause => 
    `<li>${cause}</li>`
  ).join('\n            ');
  
  // Read templates
  const header = readTemplate('header');
  const systemStrip = readTemplate('system-strip');
  const errorBody = readTemplate('error-body');
  const footer = readTemplate('footer');
  
  // Replace placeholders in header
  let html = header.replace('{{ERROR_TITLE}}', `${errorCode} Error - ${system.name}`);
  
  // Replace placeholders in system strip
  html += systemStrip.replace('{{SYSTEM_NAME}}', system.name);
  
  // Replace placeholders in error body
  html += errorBody
    .replace('{{ERROR_EMOJI}}', emoji)
    .replace('{{ERROR_TITLE}}', config.title)
    .replace('{{ERROR_CODE}}', errorCode)
    .replace('{{ERROR_CAUSES}}', causesList);
  
  // Replace placeholders in footer
  let footerHtml = footer
    .replace('<!-- FOOTER_TEXT_CONTENT -->', footerTexts[systemKey]);
  
  // Add Terms of Use link only for SDLT documents
  if (systemKey === 'sdlt-documents') {
    footerHtml = footerHtml.replace(
      '<!-- <a href="https://thurstanhoskin.co.uk/file-upload/log-in/?system=Dwellworks&terms=true" class="footer-link-item">Terms of Use</a> -->',
      '<a href="https://thurstanhoskin.co.uk/file-upload/log-in/?system=Dwellworks&terms=true" class="footer-link-item">Terms of Use</a>'
    );
  }
  
  html += footerHtml;
  
  return html;
}

// Main build function
function buildAllErrorPages() {
  const outputBaseDir = path.join(__dirname, 'generated');
  
  // Create base output directory if it doesn't exist
  if (!fs.existsSync(outputBaseDir)) {
    fs.mkdirSync(outputBaseDir, { recursive: true });
  }
  
  const errorCodes = Object.keys(errorConfigs).map(Number).sort((a, b) => a - b);
  const systemKeys = Object.keys(systemConfigs);
  
  console.log('🔨 Building error pages...\n');
  
  let totalCount = 0;
  
  // Generate pages for each system type
  systemKeys.forEach(systemKey => {
    const systemDir = path.join(outputBaseDir, systemKey);
    
    // Create system directory if it doesn't exist
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }
    
    console.log(`📁 Generating pages for ${systemKey}...`);
    
    // Generate pages for each error code
    errorCodes.forEach(errorCode => {
      const html = buildErrorPage(errorCode, systemKey);
      const filename = `${errorCode}.html`;
      const filepath = path.join(systemDir, filename);
      
      fs.writeFileSync(filepath, html, 'utf8');
      console.log(`  ✅ ${filename}`);
      totalCount++;
    });
    
    console.log('');
  });
  
  console.log(`✨ Generated ${totalCount} error pages`);
  console.log(`📂 Output directory: ${outputBaseDir}/`);
  console.log('\n📁 Directory structure:');
  systemKeys.forEach(systemKey => {
    console.log(`   ${systemKey}/`);
    errorCodes.forEach(errorCode => {
      console.log(`     - ${errorCode}.html`);
    });
  });
  console.log('\n📝 Next steps:');
  console.log('   1. Review the generated pages in your browser');
  console.log('   2. Test all error pages locally');
  console.log('   3. Upload to S3 using: scripts/sync-error-pages-to-s3.ps1');
}

// Run if called directly
if (require.main === module) {
  buildAllErrorPages();
}

module.exports = { buildErrorPage, buildAllErrorPages };
