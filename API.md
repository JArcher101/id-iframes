# iframe API Documentation

This document describes the communication interface for each iframe component. All iframes use the [`window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) API for bidirectional communication with their parent window.

## Table of Contents

1. [Image Viewer](#image-viewer)
2. [Image Uploader](#image-uploader)
3. [Document Viewer](#document-viewer)
4. [Message iframe](#message-iframe)
5. [Report Uploader](#report-uploader)
6. [Cashiers Log](#cashiers-log)
7. [Chart Viewer](#chart-viewer)
8. [General Integration Guide](#general-integration-guide)

---

## Image Viewer

**File:** `image-viewer.html`

### Description
Displays ID images (Photo ID and Address ID documents) with upload capabilities.

### Parent → iframe (Incoming Messages)

#### `display-images`
Initial display of existing images with upload permissions.

```javascript
window.frames[0].postMessage({
  type: 'display-images',
  data: [
    {
      url: 'https://example.com/image1.jpg',
      documentType: 'Passport',
      date: '2025-10-01T12:00:00Z'
    }
  ],
  allowUploads: true,
  clientData: {
    fe: 'TL',
    clientNumber: '12345',
    matterNumber: 'M001',
    name: 'John Doe'
  },
  userEmail: 'user@example.com',
  _id: 'item-database-id'
}, '*');
```

#### `image-display`
Alternative message type for displaying images.

```javascript
window.frames[0].postMessage({
  type: 'image-display',
  data: [...],  // Array of image objects
  allowUploads: true,
  clientData: {...},
  userEmail: 'user@example.com'
}, '*');
```

#### `put-links`
Response with S3 PUT URLs for uploading images.

```javascript
window.frames[0].postMessage({
  type: 'put-links',
  links: [
    {
      url: 'https://s3.amazonaws.com/bucket/presigned-put-url',
      contentType: 'image/jpeg'
    }
  ],
  s3Keys: [
    {
      s3Key: 'uploads/abc123.jpg',
      documentType: 'Passport',
      // ... other metadata
    }
  ],
  images: [...],  // Full image metadata
  _id: 'item-database-id'
}, '*');
```

#### `put-error`
Error response when PUT link generation fails.

```javascript
window.frames[0].postMessage({
  type: 'put-error',
  error: 'Error message describing the issue'
}, '*');
```

### iframe → Parent (Outgoing Messages)

#### `image-data`
Sends image metadata to request PUT links for upload.

```javascript
{
  type: 'image-data',
  images: [
    {
      documentType: 'Passport',
      s3Key: null,
      date: '2025-10-09T10:30:00.000Z',
      fe: 'TL',
      clientNumber: '12345',
      matterNumber: 'M001',
      name: 'John Doe',
      file: {
        name: 'passport.jpg',
        type: 'image/jpeg',
        size: 1024000,
        lastModified: 1234567890000
      }
    }
  ],
  _id: 'item-database-id'
}
```

#### `upload-success`
Notifies parent that upload completed successfully.

```javascript
{
  type: 'upload-success',
  files: [
    {
      s3Key: 'uploads/abc123.jpg',
      documentType: 'Passport',
      date: '2025-10-09T10:30:00.000Z',
      // ... other metadata
    }
  ],
  _id: 'item-database-id',
  docType: 'Photo ID'
}
```

#### `refresh-images`
Requests parent to refresh the image display.

```javascript
{
  type: 'refresh-images'
}
```

---

## Image Uploader

**File:** `image-uploader.html`

### Description
Client onboarding form for collecting personal details and ID documents.

### Parent → iframe (Incoming Messages)

#### `initiation-data`
Initial client data to populate the form.

```javascript
window.frames[0].postMessage({
  type: 'initiation-data',
  clientData: {
    fe: 'TL',
    clientNumber: '12345',
    matterNumber: 'M001',
    name: 'John Doe',
    titlePrefix: 'Mr',
    firstName: 'John',
    middleNames: '',
    surname: 'Doe',
    worktype: 'Purchase',
    images: [...]  // Existing images if any
  }
}, '*');
```

#### `put-links`
S3 upload URLs in response to `image-data` message.

```javascript
window.frames[0].postMessage({
  type: 'put-links',
  links: [{url: '...', contentType: 'image/jpeg'}],
  s3Keys: [...],
  images: [...]
}, '*');
```

#### `put-error`
Upload error notification.

```javascript
window.frames[0].postMessage({
  type: 'put-error',
  error: 'Error message'
}, '*');
```

### iframe → Parent (Outgoing Messages)

#### `image-data`
Sends form data and image metadata for processing.

```javascript
{
  type: 'image-data',
  images: [
    {
      documentType: 'Passport',
      file: {
        name: 'passport.jpg',
        type: 'image/jpeg',
        size: 1024000,
        lastModified: 1234567890000
      },
      date: '2025-10-09T10:30:00.000Z'
    }
  ]
}
```

#### `upload-success`
Final submission with all form data and uploaded images.

```javascript
{
  type: 'upload-success',
  formData: {
    fe: 'TL',
    clientNumber: '12345',
    // ... all form fields
  },
  images: [...]  // Images with s3Keys
}
```

---

## Document Viewer

**File:** `document-viewer.html`

### Description
Displays and manages compliance documents and other file uploads.

### Parent → iframe (Incoming Messages)

#### `display-documents`
Display existing documents in list view.

```javascript
window.frames[0].postMessage({
  type: 'display-documents',
  documents: [
    {
      url: 'https://example.com/doc.pdf',
      documentType: 'Bank Statement',
      date: '2025-10-01T12:00:00Z'
    }
  ],
  allowUploads: true,
  clientData: {...},
  userEmail: 'user@example.com',
  _id: 'item-database-id'
}, '*');
```

#### `display-images`
Alternative: display documents as images.

```javascript
window.frames[0].postMessage({
  type: 'display-images',
  data: [...],  // Array of document objects
  allowUploads: true,
  clientData: {...},
  userEmail: 'user@example.com'
}, '*');
```

#### `put-links`
S3 upload URLs for document upload.

#### `put-error`
Upload error notification.

### iframe → Parent (Outgoing Messages)

#### `file-data`
Sends document metadata to request PUT links.

```javascript
{
  type: 'file-data',
  files: [
    {
      documentType: 'Bank Statement',
      issuer: 'Barclays',
      recipientName: 'John Doe',
      recipientAddress: '123 Main St',
      dateOfDocument: '2025-09-15',
      file: {
        name: 'bank-statement.pdf',
        type: 'application/pdf',
        size: 2048000
      }
    }
  ],
  _id: 'item-database-id'
}
```

#### `upload-success`
Notifies completion of document upload.

```javascript
{
  type: 'upload-success',
  files: [...],  // Documents with s3Keys
  _id: 'item-database-id',
  docType: 'Address ID'
}
```

#### `refresh-images`
Requests parent to refresh the display.

---

## Message iframe

**File:** `message-iframe.html`

### Description
Chat interface for communication between staff and cashiers.

### Parent → iframe (Incoming Messages)

#### `message-data`
Complete chat data including messages and notifications.

```javascript
window.frames[0].postMessage({
  type: 'message-data',
  userEmail: 'staff@example.com',
  _id: 'item-database-id',
  notification: true,
  white: 'Staff',  // Which user type appears on right (white background)
  tags: ['note', 'pepUpdate', 'formJ'],
  chat: [
    {
      user: 'staff@example.com',
      timestamp: '2025-10-09T10:30:00Z',
      message: 'Hello from staff',
      type: 'text',
      attachments: []
    },
    {
      user: 'cashier@example.com',
      timestamp: '2025-10-09T10:35:00Z',
      message: 'Response from cashier',
      type: 'text',
      attachments: [
        {
          url: 'https://example.com/file.pdf',
          name: 'document.pdf',
          size: 1024000
        }
      ]
    }
  ]
}, '*');
```

#### `put-links`
S3 upload URLs for file attachments.

```javascript
window.frames[0].postMessage({
  type: 'put-links',
  links: [{url: '...', contentType: 'application/pdf'}],
  s3Keys: [...],
  _id: 'item-database-id'
}, '*');
```

#### `put-error`
Attachment upload error.

### iframe → Parent (Outgoing Messages)

#### `file-data`
Request PUT link for file attachment.

```javascript
{
  type: 'file-data',
  files: [
    {
      name: 'attachment.pdf',
      type: 'application/pdf',
      size: 1024000,
      lastModified: 1234567890000
    }
  ],
  _id: 'item-database-id'
}
```

#### `message-sent`
New message to be saved to database.

```javascript
{
  type: 'message-sent',
  message: {
    user: 'staff@example.com',
    timestamp: '2025-10-09T10:30:00Z',
    message: 'Message text',
    type: 'text',  // or 'attachment'
    attachments: [
      {
        s3Key: 'uploads/file.pdf',
        name: 'document.pdf',
        size: 1024000,
        url: 'https://s3.amazonaws.com/...'
      }
    ]
  },
  _id: 'item-database-id'
}
```

#### `dismiss-notification`
Request to clear notification indicator.

```javascript
{
  type: 'dismiss-notification',
  _id: 'item-database-id',
  userEmail: 'staff@example.com'
}
```

---

## Report Uploader

**File:** `report-uploader.html`

### Description
Upload system for standard report documents (EID, SA302, P60, etc.).

### Parent → iframe (Incoming Messages)

#### `display-data`
Initial data to enable the uploader.

```javascript
window.frames[0].postMessage({
  type: 'display-data',
  clientData: {
    fe: 'TL',
    clientNumber: '12345',
    matterNumber: 'M001',
    name: 'John Doe'
  },
  userEmail: 'user@example.com',
  _id: 'item-database-id'
}, '*');
```

#### `put-links`
S3 upload URLs for reports.

#### `put-error`
Upload error notification.

### iframe → Parent (Outgoing Messages)

#### `file-data`
Request PUT links for report files.

```javascript
{
  type: 'file-data',
  files: [
    {
      documentType: 'EID Report',
      file: {
        name: 'eid-report.pdf',
        type: 'application/pdf',
        size: 2048000
      }
    }
  ],
  _id: 'item-database-id'
}
```

#### `upload-success`
Report upload completion.

```javascript
{
  type: 'upload-success',
  files: [...],  // Reports with s3Keys
  _id: 'item-database-id',
  docType: 'Reports'
}
```

---

## Cashiers Log

**File:** `cashiers-log.html`

### Description
Activity log display for cashier operations.

### Communication
Currently operates independently without postMessage communication (standalone display).

---

## Chart Viewer

**File:** `single-chart-viewer.html`

### Description
Dynamic chart visualization component powered by Chart.js. Displays data in various chart formats including pie, doughnut, bar, line, radar, and more. The iframe starts with a blank screen and renders charts based on incoming data.

### Parent → iframe (Incoming Messages)

#### `chart-data`
Sends chart configuration and data to render a visualization.

```javascript
window.frames[0].postMessage({
  type: 'chart-data',
  chartType: 'doughnut',  // 'bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea', etc.
  title: 'Outstanding & Requests Breakdown',
  description: 'Total: 223 items',
  chartData: {
    labels: [
      'Added in last 7 days',
      '8 - 30 Days',
      'Over 30 Days Old'
    ],
    datasets: [{
      label: 'Outstanding Items',
      data: [8, 21, 127],
      backgroundColor: [
        'rgba(0, 204, 102, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(0, 204, 102, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  },
  options: {
    // Optional: Chart.js configuration options
    plugins: {
      legend: {
        position: 'right'
      }
    }
  }
}, '*');
```

### iframe → Parent (Outgoing Messages)

The Chart Viewer is a display-only component and does not send messages back to the parent.

### Chart Behavior

#### Chart Replacement
When a new `chart-data` message is received:
1. The existing chart is destroyed
2. A new chart is created with the updated data
3. This allows real-time chart updates without reloading the iframe
4. If a popup window is open, it receives the updated data automatically

#### Empty Data Handling
If all data values in the datasets are `0`, the iframe:
- Remains blank (empty state)
- Does not render the chart
- Waits for meaningful data

#### Expand to Popup Window
Charts can be expanded to a larger popup window:
- Click the **"⤢ Expand"** button (top-right when chart is displayed)
- Opens the chart in a 1400x900px popup window
- Uses unique ID handshake via sessionStorage for secure data transfer
- Popup stays synchronized - updates when iframe receives new data
- Multiple popups supported simultaneously (each with unique ID)
- Data auto-deleted after popup loads (prevents reload issues)

#### Bullet Point Lists
When the `description` field contains bullet points (`•`), they are automatically:
- Split into separate lines
- Displayed as a vertical list
- Each item on its own line for better readability

#### Supported Chart Types
- `bar` - Vertical bar chart
- `line` - Line chart
- `pie` - Circular pie chart
- `doughnut` - Pie chart with hollow center
- `radar` - Radar/spider chart
- `polarArea` - Polar area chart
- `bubble` - Bubble chart
- `scatter` - Scatter plot

### Chart.js Data Format

The `chartData` object follows the standard Chart.js data structure:

```javascript
chartData: {
  labels: ['Label 1', 'Label 2', 'Label 3'],
  datasets: [{
    label: 'Dataset Name',
    data: [value1, value2, value3],
    backgroundColor: ['color1', 'color2', 'color3'],
    borderColor: ['borderColor1', 'borderColor2', 'borderColor3'],
    borderWidth: 1
  }]
}
```

### Custom Options

You can override default chart options by providing an `options` object. These will be merged with the default configuration:

```javascript
options: {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',  // 'top', 'right', 'bottom', 'left'
      labels: {
        font: {
          size: 14
        }
      }
    },
    tooltip: {
      enabled: true
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
}
```

### Example Integration

```javascript
// Send doughnut chart data
const chartIframe = document.getElementById('chartViewer').contentWindow;

chartIframe.postMessage({
  type: 'chart-data',
  chartType: 'doughnut',
  title: 'Passes by Type',
  description: 'Last 90 days - 117 total passes',
  chartData: {
    labels: ['Pass', 'ePass', 'ID Held'],
    datasets: [{
      label: 'Passes by Type',
      data: [59, 39, 19],
      backgroundColor: [
        'rgba(166, 157, 108, 0.6)',
        'rgba(0, 57, 96, 0.6)',
        'rgba(0, 255, 128, 0.6)'
      ]
    }]
  }
}, '*');
```

### Typography

The Chart Viewer uses:
- **Transport Medium** - For chart title and axis labels
- **Rotis Sans Serif Light** - For chart descriptions and data labels

---

## General Integration Guide

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>Parent Application</title>
</head>
<body>
  <iframe 
    id="imageViewer"
    src="image-viewer.html"
    width="100%"
    height="800"
    frameborder="0">
  </iframe>

  <script>
    const iframe = document.getElementById('imageViewer').contentWindow;
    
    // Listen for messages from iframe
    window.addEventListener('message', function(event) {
      console.log('Received:', event.data);
      
      switch(event.data.type) {
        case 'image-data':
          handleImageDataRequest(event.data);
          break;
        case 'upload-success':
          handleUploadSuccess(event.data);
          break;
        case 'refresh-images':
          refreshImageDisplay();
          break;
      }
    });
    
    // Send initial data to iframe
    function initializeViewer() {
      iframe.postMessage({
        type: 'display-images',
        data: [],
        allowUploads: true,
        clientData: {
          fe: 'TL',
          clientNumber: '12345',
          matterNumber: 'M001',
          name: 'John Doe'
        },
        userEmail: 'user@example.com',
        _id: 'abc123'
      }, '*');
    }
    
    // Wait for iframe to load
    document.getElementById('imageViewer').addEventListener('load', initializeViewer);
  </script>
</body>
</html>
```

### S3 Upload Flow

All upload-enabled iframes follow this pattern:

1. **User selects files** in iframe
2. **iframe sends metadata** to parent (`image-data`, `file-data`, etc.)
3. **Parent generates S3 PUT URLs** (presigned URLs)
4. **Parent responds** with `put-links` message containing URLs and s3Keys
5. **iframe uploads directly to S3** using PUT requests
6. **iframe notifies parent** with `upload-success` message
7. **Parent saves** s3Keys to database

### Security Considerations

#### Origin Validation
Always validate the message origin in production:

```javascript
window.addEventListener('message', function(event) {
  // Validate origin
  const allowedOrigins = [
    'https://yourdomain.com',
    'http://localhost:3000'  // Development only
  ];
  
  if (!allowedOrigins.includes(event.origin)) {
    console.warn('Blocked message from unauthorized origin:', event.origin);
    return;
  }
  
  // Process message
  handleMessage(event.data);
});
```

#### Wildcard Origin
Current implementation uses `'*'` for development convenience:

```javascript
window.parent.postMessage({...}, '*');
```

**Production recommendation:** Replace with specific origin:

```javascript
window.parent.postMessage({...}, 'https://yourdomain.com');
```

### Error Handling

#### PUT Link Generation
When parent cannot generate PUT links:

```javascript
iframe.postMessage({
  type: 'put-error',
  error: 'Failed to generate upload URLs. Please try again.'
}, '*');
```

The iframe will:
- Display error message to user
- Reset to previous state
- Allow user to retry

#### Upload Failures
Iframes handle S3 upload failures with automatic retry logic (typically 3 attempts).

### Data Structures

#### Client Data Object
```javascript
{
  fe: 'TL',              // Fee earner initials
  clientNumber: '12345', // Client reference
  matterNumber: 'M001',  // Matter reference
  name: 'John Doe'       // Client full name
}
```

#### Image/Document Object
```javascript
{
  url: 'https://example.com/image.jpg',  // Display URL
  s3Key: 'uploads/abc123.jpg',           // S3 storage key
  documentType: 'Passport',              // Document type
  date: '2025-10-01T12:00:00Z',         // Upload timestamp
  fe: 'TL',                              // Fee earner
  clientNumber: '12345',                 // Client reference
  matterNumber: 'M001',                  // Matter reference
  name: 'John Doe'                       // Client name
}
```

#### File Metadata Object
```javascript
{
  name: 'document.pdf',        // Original filename
  type: 'application/pdf',     // MIME type
  size: 1024000,              // Size in bytes
  lastModified: 1234567890000 // Unix timestamp
}
```

### Common Message Types

All iframes support these message patterns:

| Message Type | Direction | Purpose |
|-------------|-----------|---------|
| `display-*` | Parent → iframe | Initialize/update display |
| `*-data` | iframe → Parent | Request PUT links |
| `put-links` | Parent → iframe | Provide S3 upload URLs |
| `put-error` | Parent → iframe | Signal upload error |
| `upload-success` | iframe → Parent | Confirm upload completion |
| `refresh-*` | iframe → Parent | Request data refresh |

### Document Types Supported

#### Photo ID Types
- Passport
- Driving Licence
- ID Card (EU)
- Biometric Residence Permit
- Firearms Certificate
- Other Photo ID

#### Address ID Types
- Bank Statement
- Utility Bill
- GOV Letter
- Official Letter
- NHS Letter
- Home Insurance
- Council Tax Bill
- Voter Registration
- Tenancy Agreement
- Other

#### Report Types
- EID Report
- SA302
- P60
- Payslips
- Bank Statements (Reports)
- Other Reports

### Best Practices

1. **Always validate** message data before processing
2. **Handle errors gracefully** with user-friendly messages
3. **Provide loading states** during async operations
4. **Validate file types and sizes** before upload
5. **Use unique `_id`** values to track each transaction
6. **Implement retry logic** for failed uploads
7. **Log messages** for debugging (remove in production)

### Example: Full Upload Workflow

```javascript
// Parent window code
class ImageViewerController {
  constructor(iframeElement) {
    this.iframe = iframeElement.contentWindow;
    this.setupListeners();
  }
  
  setupListeners() {
    window.addEventListener('message', (event) => {
      switch(event.data.type) {
        case 'image-data':
          this.generatePutLinks(event.data);
          break;
        case 'upload-success':
          this.saveToDatabase(event.data);
          break;
      }
    });
  }
  
  async generatePutLinks(data) {
    try {
      // Call your backend to generate presigned URLs
      const response = await fetch('/api/generate-put-links', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          images: data.images,
          _id: data._id
        })
      });
      
      const result = await response.json();
      
      // Send PUT links back to iframe
      this.iframe.postMessage({
        type: 'put-links',
        links: result.putUrls,
        s3Keys: result.s3Keys,
        images: result.images,
        _id: data._id
      }, '*');
      
    } catch (error) {
      // Send error to iframe
      this.iframe.postMessage({
        type: 'put-error',
        error: error.message
      }, '*');
    }
  }
  
  async saveToDatabase(data) {
    // Save uploaded files to your database
    await fetch('/api/save-images', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    });
  }
  
  displayImages(images, clientData) {
    this.iframe.postMessage({
      type: 'display-images',
      data: images,
      allowUploads: true,
      clientData: clientData,
      userEmail: 'current-user@example.com',
      _id: 'item-id'
    }, '*');
  }
}

// Usage
const viewer = new ImageViewerController(
  document.getElementById('imageViewer')
);
```

### TypeScript Type Definitions

```typescript
// Message Types
type MessageType = 
  | 'display-images'
  | 'image-display'
  | 'display-documents'
  | 'image-data'
  | 'file-data'
  | 'put-links'
  | 'put-error'
  | 'upload-success'
  | 'refresh-images'
  | 'message-data'
  | 'message-sent'
  | 'dismiss-notification'
  | 'chart-data';

// Client Data
interface ClientData {
  fe: string;
  clientNumber: string;
  matterNumber: string;
  name: string;
}

// Image Object
interface ImageObject {
  url?: string;
  s3Key?: string;
  documentType: string;
  date: string;
  fe: string;
  clientNumber: string;
  matterNumber: string;
  name: string;
}

// File Metadata
interface FileMetadata {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
}

// Incoming Message
interface IncomingMessage {
  type: MessageType;
  data?: ImageObject[];
  documents?: ImageObject[];
  allowUploads?: boolean;
  clientData?: ClientData;
  userEmail?: string;
  _id?: string;
  links?: {url: string; contentType: string}[];
  s3Keys?: any[];
  images?: any[];
  error?: string;
}

// Outgoing Message
interface OutgoingMessage {
  type: MessageType;
  images?: any[];
  files?: any[];
  _id?: string;
  message?: any;
  userEmail?: string;
  docType?: string;
}

// Chart Data Message
interface ChartDataMessage {
  type: 'chart-data';
  chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'polarArea' | 'bubble' | 'scatter';
  title: string;
  description?: string;
  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string[];
      borderColor?: string[];
      borderWidth?: number;
    }[];
  };
  options?: any;  // Chart.js options object
}
```

### Testing

Use the included `test-responsive.html` for iframe testing:

```html
<!-- test-responsive.html demonstrates iframe integration -->
<iframe src="image-viewer.html"></iframe>
```

The test page includes example message listeners and demonstrates proper integration patterns.

---

## Troubleshooting

### Common Issues

**iframe not receiving messages**
- Ensure iframe has loaded: use `iframe.addEventListener('load', ...)`
- Check console for CORS errors
- Verify `contentWindow` is accessible

**Messages not sending from iframe**
- Verify `window.parent` is accessible
- Check browser console for postMessage errors
- Ensure message data is serializable (no circular references)

**File objects not transferring**
- File objects cannot be cloned by postMessage
- Send only file metadata, keep File objects in iframe
- Upload directly from iframe using PUT URLs

**Upload failures**
- Check S3 presigned URL expiration
- Verify CORS configuration on S3 bucket
- Ensure content-type matches between metadata and actual upload

---

## Version History

- **v1.0** - Initial iframe implementations with postMessage API
- All iframes use consistent communication patterns
- Supports modern browsers with ES6+

---

## Support

For issues or questions about iframe integration:
1. Check browser console for errors
2. Verify message structure matches API specs
3. Test with `test-responsive.html` page
4. Review inline code comments in HTML files

