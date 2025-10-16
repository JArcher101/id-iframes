# iframe API Documentation

This document describes the communication interface for each iframe component. All iframes use the [`window.postMessage()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) API for bidirectional communication with their parent window.

## Table of Contents

1. [Audit Log Viewer](#audit-log-viewer)
2. [Wallboard Dashboard](#wallboard-dashboard)
3. [Single Image Viewer](#single-image-viewer)
4. [Image Viewer](#image-viewer)
5. [Image Uploader](#image-uploader)
6. [Document Viewer](#document-viewer)
7. [Message iframe](#message-iframe)
8. [Report Uploader](#report-uploader)
9. [Cashiers Log](#cashiers-log)
10. [Chart Viewer](#chart-viewer)
11. [Request Form](#request-form) ⭐ NEW
12. [Client Details Form](#client-details-form)
13. [General Integration Guide](#general-integration-guide)

---

## Audit Log Viewer

**File:** `audit-log.html`

### Description
Timeline-based audit trail viewer that displays case activity, status changes, and matter details. Features visual badges for status tracking, risk indicators, PEP status, and PDF export capability.

### Parent → iframe (Incoming Messages)

#### `log-data`
Sends audit log entries to display in timeline format.

```javascript
window.frames[0].postMessage({
  type: 'log-data',
  data: [
    {
      timestamp: '2025-10-14T10:30:00Z',
      action: 'Status Change',
      user: 'staff@example.com',
      status: ['InProgress', 'Verified'],
      riskIndicator: false,
      pepStatus: 'NPEP',  // CPEP (Confirmed), PPEP (Potential), NPEP (Not PEP)
      pepMonitoring: false,
      safeHarbour: true,
      matterClient: 'John Doe',
      matterNumber: '12345',
      matterFE: 'TL',
      matterDescription: 'Property Purchase',
      addresses: [
        {
          flat_number: '10',
          building_number: '123',
          building_name: 'Oak House',
          street: 'Main Street',
          sub_street: '',
          town: 'London',
          postcode: 'SW1A 1AA',
          country: 'GBR'
        }
      ],
      documents: [
        {
          documentType: 'Passport',
          url: 'https://example.com/doc.jpg'
        }
      ]
    }
  ]
}, '*');
```

#### `clear-data`
Clears all audit log entries and returns to empty state.

```javascript
window.frames[0].postMessage({
  type: 'clear-data'
}, '*');
```

#### `audit-download`
Triggers PDF download of the audit log.

```javascript
window.frames[0].postMessage({
  type: 'audit-download'
}, '*');
```

### iframe → Parent (Outgoing Messages)

The Audit Log Viewer is a display-only component and does not send messages back to the parent.

### Log Entry Structure

#### Status Values
- `Pending` - Initial state
- `InProgress` - Work in progress
- `Pass` - Checks passed
- `Fail` - Checks failed
- `Completed` - Fully completed

#### PEP Status Values
- `CPEP` - Confirmed PEP (displays as "PEP")
- `PPEP` - Potential PEP (displays as "Potential PEP")
- `NPEP` - Not PEP (displays as "Outruled PEP")

#### Risk & Flags
- `riskIndicator: true` - Shows "High Risk" badge
- `pepMonitoring: true` - Shows "PEP Monitoring Active" badge
- `safeHarbour: true` - Shows "Safe Harbour" badge

### PDF Export
The iframe includes jsPDF integration for exporting audit logs to PDF format. The download includes:
- Complete timeline with all entries
- Status badges and flags
- Matter details and addresses
- Document lists
- Formatted timestamps

### Example Integration

```javascript
const auditFrame = document.getElementById('auditLog').contentWindow;

// Display audit log
auditFrame.postMessage({
  type: 'log-data',
  data: [
    {
      timestamp: new Date().toISOString(),
      action: 'EID Check Completed',
      user: 'system@example.com',
      status: ['Pass'],
      riskIndicator: false,
      pepStatus: 'NPEP',
      matterClient: 'Jane Smith',
      matterNumber: 'M67890',
      matterFE: 'JS',
      addresses: [{
        building_number: '42',
        street: 'Baker Street',
        town: 'London',
        postcode: 'NW1 6XE',
        country: 'GBR'
      }]
    }
  ]
}, '*');

// Clear log
auditFrame.postMessage({ type: 'clear-data' }, '*');

// Download PDF
auditFrame.postMessage({ type: 'audit-download' }, '*');
```

---

## Wallboard Dashboard

**File:** `wallboard-iframe.html`

### Description
Real-time metrics dashboard displaying case statistics across fee earners. Features auto-refresh countdown timer, interactive analytics with charts, and PDF export. Supports both aggregate (ALL) and individual fee earner views.

### Parent → iframe (Incoming Messages)

#### `wallboard-data`
Sends complete metrics data and fee earner dropdown options.

```javascript
window.frames[0].postMessage({
  type: 'wallboard-data',
  wallboard: [
    {
      title: 'Outstanding total',
      sjm: 5,
      mb: 3,
      tl: 8,
      total: 16
    },
    {
      title: 'Outstanding With Photo ID',
      sjm: 2,
      mb: 1,
      tl: 4,
      total: 7
    },
    {
      title: 'Requests',
      sjm: 0,
      mb: 1,
      tl: 2,
      total: 3
    }
  ],
  feeEarnerOptions: [
    { label: 'ALL', value: 'ALL' },
    { label: 'Stephen Morrison', value: 'SJM' },
    { label: 'Mark Brown', value: 'MB' },
    { label: 'Tony Lawrence', value: 'TL' }
  ]
}, '*');
```

#### `analytics-data`
Provides detailed analytics for a specific fee earner (in response to `fe-analytics` request).

```javascript
window.frames[0].postMessage({
  type: 'analytics-data',
  fe: 'SJM',  // or 'ALL' for aggregate
  analyticsData: {
    totalAwaiting: 156,
    totalRequests: 0,
    pass90: 115,
    fail90: 8,
    // Additional analytics metrics...
  }
}, '*');
```

#### `analytics-error`
Error response when analytics data cannot be fetched.

```javascript
window.frames[0].postMessage({
  type: 'analytics-error',
  fe: 'SJM',
  error: {...},
  message: 'Failed to fetch analytics data'
}, '*');
```

### iframe → Parent (Outgoing Messages)

#### `refresh-request`
Requests fresh wallboard data (sent automatically when countdown reaches 0:00).

```javascript
{
  type: 'refresh-request'
}
```

#### `fe-analytics`
Requests detailed analytics for a specific fee earner.

```javascript
{
  type: 'fe-analytics',
  fe: 'SJM'  // or 'ALL' for aggregate analytics
}
```

### Features

#### Auto-Refresh Countdown
- Starts at 5:00 (300 seconds) when data is received
- Updates every second
- Sends `refresh-request` when it reaches 0:00
- Resets to 5:00 after refresh

#### Analytics View
- Select fee earner from dropdown
- Click "Analytics" button to request detailed data
- Displays charts combining wallboard metrics with analytics detail
- "Back to Wallboard" button returns to main dashboard
- Supports both aggregate (ALL) and individual fee earner views

#### PDF Export
- Downloads current wallboard as PDF
- Includes formatted metrics table
- Filename with timestamp
- Uses jsPDF library

### Example Integration

```javascript
const wallboardFrame = document.getElementById('wallboard').contentWindow;

// Send initial wallboard data
wallboardFrame.postMessage({
  type: 'wallboard-data',
  wallboard: [
    { title: 'Outstanding total', sjm: 5, mb: 3, tl: 8, total: 16 },
    { title: 'Requests', sjm: 0, mb: 1, tl: 2, total: 3 }
  ],
  feeEarnerOptions: [
    { label: 'ALL', value: 'ALL' },
    { label: 'Stephen Morrison', value: 'SJM' }
  ]
}, '*');

// Listen for refresh requests
window.addEventListener('message', (event) => {
  if (event.data.type === 'refresh-request') {
    // Fetch fresh data and send updated wallboard-data
    fetchWallboardData().then(data => {
      wallboardFrame.postMessage({
        type: 'wallboard-data',
        wallboard: data.wallboard,
        feeEarnerOptions: data.feeEarnerOptions
      }, '*');
    });
  }
  
  if (event.data.type === 'fe-analytics') {
    // Fetch analytics for specific FE
    fetchAnalytics(event.data.fe).then(analytics => {
      wallboardFrame.postMessage({
        type: 'analytics-data',
        fe: event.data.fe,
        analyticsData: analytics
      }, '*');
    }).catch(error => {
      wallboardFrame.postMessage({
        type: 'analytics-error',
        fe: event.data.fe,
        message: error.message
      }, '*');
    });
  }
});
```

---

## Single Image Viewer

**File:** `single-image-viewer.html`

### Description
Standalone fullscreen image viewer with advanced zoom and pan controls. Unlike other iframes, this component does NOT use postMessage API. Instead, it receives data via URL hash parameter (base64 encoded JSON).

### Integration Method

This viewer uses a different integration pattern - data is passed via URL hash:

```javascript
// Prepare image data
const imageData = {
  url: 'https://example.com/passport-front.jpg',
  documentType: 'Passport',
  side: 'Front',
  uploader: 'staff@example.com',
  date: '2025-10-14 12:30:45'
};

// Encode data as base64 JSON
const jsonString = JSON.stringify(imageData);
const base64Data = btoa(jsonString);

// Open viewer with data in hash
const viewerUrl = `single-image-viewer.html#${base64Data}`;
window.open(viewerUrl, '_blank');

// Or use in iframe
document.getElementById('viewer').src = viewerUrl;
```

### Data Structure

```javascript
{
  url: 'https://example.com/image.jpg',  // Image URL (required)
  documentType: 'Passport',               // Document type (optional)
  side: 'Front',                          // Front/Back/Single (optional)
  uploader: 'user@example.com',          // Who uploaded (optional)
  date: '2025-10-14 12:30:45'            // Upload date (optional)
}
```

### Features

#### Zoom Controls
- **Zoom In/Out buttons** - Increment/decrement zoom by 25%
- **Mouse wheel** - Scroll to zoom
- **Pinch gesture** - Two-finger pinch on touch devices
- **Double-click** - Reset to 100% zoom

#### Pan Controls
- **Mouse drag** - Click and drag to pan
- **Touch drag** - Single finger drag on touch devices
- **Auto-center** - Image centers when zoomed

#### Display
- Fullscreen image display
- Details banner showing document type, side, uploader, date
- Loading spinner during image fetch
- Error handling for failed loads or invalid URLs

### Example Usage

```javascript
// Open image in new window
function openImageViewer(imageUrl, docType, side) {
  const data = {
    url: imageUrl,
    documentType: docType,
    side: side,
    uploader: 'current-user@example.com',
    date: new Date().toLocaleString('en-GB')
  };
  
  const encoded = btoa(JSON.stringify(data));
  const viewerUrl = `single-image-viewer.html#${encoded}`;
  
  window.open(viewerUrl, '_blank', 'width=1200,height=800');
}

// Use in iframe
function loadImageInIframe(imageUrl, docType) {
  const data = {
    url: imageUrl,
    documentType: docType,
    side: 'Single'
  };
  
  const encoded = btoa(JSON.stringify(data));
  document.getElementById('imageIframe').src = `single-image-viewer.html#${encoded}`;
}
```

### No postMessage Communication

⚠️ **Important:** This viewer does not use postMessage API. All data must be provided via URL hash at initialization. The viewer does not send messages back to parent and cannot be updated dynamically after load (requires reload with new hash).

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

#### `button-enable`
Enables the "Add more ID images" button.

```javascript
window.frames[0].postMessage({
  type: 'button-enable'
}, '*');
```

#### `button-disable`
Disables the "Add more ID images" button.

```javascript
window.frames[0].postMessage({
  type: 'button-disable'
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

## Request Form

**File:** `request-form.html`

### Description
Comprehensive request management form supporting 7 distinct request types with dynamic section visibility, conditional validation, and modular JavaScript architecture. This form handles everything from simple notes to complex Form J/K ID verification requests with CDF/OFSI document uploads.

### Architecture
- **Core:** `js/request-form-core.js` (~4,400 lines) - Global state management, UI control, parent communication
- **Modules:** `js/request-types/*.js` - Individual request type handlers (formJ, formK, formE, esof, note, update, updatePep)
- **Styles:** `css/request-form.css` (~1,500 lines) - Responsive design, custom components

### Request Types

#### 1. **Form J Request** - Full Electronic ID Check
- Requires 2 Address IDs + 1 Photo ID (Front/Back or Single)
- Requires likeness confirmed
- Shows ID Images and ID Documents sections
- Pre-populates message with Form J text
- Validates all client details (name, DOB, address, mobile)
- Shows nameVerificationHint
- Shows eSoFSkipHint if worktype includes "purchase"

#### 2. **Form K Request** - 11 Conditional Rules
- **Rules 1-3, 10-11:** Available for individuals
- **All 11 rules:** Available for entities (business/charity)
- **Rule 1 & 2:** NOT valid for "Sale" worktypes
- **Rule 3:** ONLY valid for Will/LPA/Deeds worktypes, requires Form J ID, shows ID Images section
- **Rules 4-9:** Entity-only (Company, Partnership, Charity, PLC, Government, Regulated Institution)
- **Rules 10-11:** Valid for all (Regulated referral, Thirdfort Secure Share)
- Shows ID Documents section
- Dropdown dynamically filters rules based on client type and worktype

#### 3. **Form E Request** - Electronic Check
- Requires name, DOB, address, mobile
- Requires CDF OR OFSI document
- Shows ID Documents section
- Auto-selects eSoF if worktype includes "purchase"
- Shows ejHint if Form J requirements met
- Pre-populates message with Form E text

#### 4. **eSoF Request** - Electronic Source of Funds
- Can be standalone or combined with Form E
- ONLY valid for "Purchase" worktypes
- Requires name, DOB, address, mobile, CDF/OFSI
- Shows eSoFOnlyHint when standalone
- Shows eSoFHint when combined with Form E
- Shows ID Documents section

#### 5. **Note** - Simple Note/Message
- Requires standard 3 fields (worktype, relation, matter description)
- Requires message input (optional file attachment)
- No ID requirements

#### 6. **Issue Update** - Matter Update Message
- Same requirements as Note
- Tagged differently for backend processing

#### 7. **PEP Update** - PEP Status Update
- Same requirements as Note
- Tagged differently for backend processing

### Parent → iframe (Incoming Messages)

#### `client-data`
Loads complete client data into the form, including existing documents and images.

```javascript
window.frames[0].postMessage({
  type: 'client-data',
  user: 'staff@example.com',  // Current user email
  data: {
    // Client Details (cD)
    cD: {
      fe: 'BA',            // Fee earner initials
      n: 'Mr J R Archer',  // Full client name
      cN: '50',            // Client number
      mN: '52'             // Matter number
    },
    
    // Icons (i)
    i: {
      a: true,   // hasAddressID
      p: true,   // hasPhotoID
      l: false   // likenessConfirmed (false = not confirmed, true = confirmed)
    },
    
    // Matter Details
    wT: 'Purchase of',  // workType
    r: 'Our Client',    // relation
    mD: 'Property purchase transaction',  // matterDescription
    c: false,  // charity checkbox
    b: false,  // business checkbox
    
    // Client Information (cI)
    cI: {
      n: {  // name
        t: 'Mr',          // title
        f: 'Jacob',       // firstName
        m: 'Robert',      // middleNames
        l: 'Archer-Moran' // lastName
      },
      b: '11-01-2001',    // birthdate (DD-MM-YYYY)
      nC: false,          // nameChange
      pN: '',             // previousName
      rNC: '',            // reasonNameChange
      m: '+447700900123', // mobile
      e: 'client@example.com',  // email
      a: {  // current address (Thirdfort format)
        building_number: '42',
        street: 'Baker Street',
        town: 'London',
        postcode: 'NW1 6XE',
        country: 'GBR'
      },
      rM: false,  // recentMove
      pA: null,   // previousAddress (Thirdfort format if recent move)
      
      // Business/Charity fields (when b or c is true)
      n: { b: 'Acme Ltd' },  // businessName
      eN: '12345678',        // entityNumber
      bD: {  // businessData (from Companies House/Charity Register)
        officers: [...],
        pscs: [...],
        // Full company/charity data
      }
    },
    
    // ID Images (idI)
    idI: [
      {
        type: 'PhotoID',
        document: 'Driving Licence',
        side: 'Front',  // 'Front', 'Back', or 'Single'
        s3Key: 'protected/image-key.jpg',
        liveUrl: 'https://s3.amazonaws.com/...',
        date: '12/20/2023, 10:30:45',
        uploader: 'reception@example.com'
      }
    ],
    
    // ID Documents (idD)
    idD: [
      {
        type: 'Details form',  // or 'PEP & Sanctions Check'
        document: 'CDF - Individuals',  // Document dropdown type
        data: 'Form data as string or object',
        date: '12/20/2023',
        uploader: 'staff@example.com',
        s3Key: 'protected/cdf-key.pdf',
        liveUrl: 'https://s3.amazonaws.com/...'
      }
    ]
  }
}, '*');
```

#### `put-links`
S3 upload URLs for files (CDF, OFSI, message attachments).

```javascript
window.frames[0].postMessage({
  type: 'put-links',
  links: ['https://s3.amazonaws.com/presigned-put-url-1', ...],
  s3Keys: [
    {
      s3Key: 'protected/file-key.pdf',
      liveUrl: 'https://s3.amazonaws.com/file-key.pdf',
      // ... other file metadata
    }
  ]
}, '*');
```

#### `put-error`
Error response when file upload link generation fails.

```javascript
window.frames[0].postMessage({
  type: 'put-error',
  error: 'Failed to generate upload links'
}, '*');
```

#### `company-data` / `charity-data`
Company or charity details from Companies House/Charity Register API.

```javascript
window.frames[0].postMessage({
  type: 'company-data',  // or 'charity-data'
  data: {
    officers: [
      {
        name: 'JOHN DOE',
        officer_role: 'director',
        appointed_on: '2020-01-15',
        resigned_on: null
      }
    ],
    pscs: [
      {
        name: 'Jane Smith',
        natures_of_control: ['ownership-of-shares-25-to-50-percent'],
        notified_on: '2020-02-01',
        ceased_on: null
      }
    ],
    // ... full company/charity data
  }
}, '*');
```

### iframe → Parent (Outgoing Messages)

#### `request-data`
Sends complete request data after successful validation and file uploads.

```javascript
{
  type: 'request-data',
  requestType: 'formJ',  // or 'formK', 'formE', 'esof', 'note', 'update', 'updatePep'
  data: {
    // Updated client data in same shorthand format as client-data
    // Does NOT include idI or idD arrays
    wT: 'Purchase of',
    r: 'Our Client',
    mD: 'Property purchase',
    cI: {
      n: {t: 'Mr', f: 'Jacob', m: 'Robert', l: 'Archer-Moran'},
      b: '11-01-2001',
      m: '+447700900123',
      // ... all updated fields
    },
    // ... all other updated fields from form
  },
  message: {
    time: '14/10/2025, 14:30:00',
    user: 'staff@example.com',
    message: 'Request message text',
    type: 'Staff',
    file: {  // Optional - if message attachment present
      s3Key: 'protected/message-file.pdf',
      liveUrl: 'https://s3.amazonaws.com/...',
      name: 'attachment.pdf',
      size: 123456
    }
  },
  newFiles: [  // Optional - if new CDF/OFSI uploaded
    {
      type: 'Details form',
      document: 'CDF - Individuals',
      s3Key: 'protected/cdf-key.pdf',
      liveUrl: 'https://s3.amazonaws.com/...',
      date: '14/10/2025',
      uploader: 'staff@example.com'
    }
  ]
}
```

#### `company-lookup` / `charity-lookup`
Requests company or charity data from parent.

```javascript
{
  type: 'company-lookup',  // or 'charity-lookup'
  entityNumber: '12345678',
  country: 'GB'
}
```

#### `file-data`
Requests S3 PUT links for file uploads (before sending request-data).

```javascript
{
  type: 'file-data',
  files: [
    {
      name: 'cdf-document.pdf',
      type: 'application/pdf',
      size: 123456,
      lastModified: 1697123456789,
      isMessageFile: false  // true for message attachments, false for CDF/OFSI
    }
  ]
}
```

### Dynamic Section Visibility

Sections show/hide based on client type and selected request:

| Section | Individual | Entity | Form J | Form K | Form E | eSoF | Note/Update |
|---------|------------|--------|--------|--------|--------|------|-------------|
| Client Details | ✓ | - | ✓ | ✓ | ✓ | ✓ | - |
| Business/Charity | - | ✓ | - | ✓ | - | - | - |
| ID Documents | - | - | ✓ | ✓ | ✓ | ✓ | - |
| ID Images | - | - | ✓ | ✓(Rule3) | - | - | - |

### Validation Requirements

#### All Request Types
- Work Type (dropdown or input)
- Relation (dropdown or input)
- Matter Description
- If name change toggle: Previous name + Reason
- If recent move toggle: Previous address

#### Form J Additional
- First Name, Last Name, DOB
- Current Address
- ID Images checkbox
- ID Documents checkbox
- CDF AND OFSI (both required)
- 2 Address IDs + 1 Photo ID
- Likeness confirmed

#### Form K Additional
- Rule selection required
- **Individuals:** Name, DOB, CDF OR OFSI
- **Entities:** OFSI + (Company link OR CDF), Business Name + Entity Number (if no link)
- **Rule 3:** Same as Form J ID requirements

#### Form E / eSoF Additional
- First Name, Last Name, DOB
- Current Address, Mobile Number
- ID Documents checkbox
- CDF OR OFSI

#### Note / Update / PEP Update
- Message input required
- Optional file attachment

### Form K Rules

| Rule | Label | Valid For | Worktype Restriction |
|------|-------|-----------|---------------------|
| 1 | Pass/ePass already held | All | NOT "Sale" |
| 2 | ID already Held | All | NOT "Sale" |
| 3 | Out of scope | All | Only Will/LPA/Deeds |
| 4 | Company | Entity only | Any |
| 5 | Partnership | Entity only | Any |
| 6 | Charity | Entity only | Any |
| 7 | PLC | Entity only | Any |
| 8 | Government/Council | Entity only | Any |
| 9 | Regulated Institution | Entity only | Any |
| 10 | Regulated referral | All | Any |
| 11 | Thirdfort Secure Share | All | Any |

### Example Integration

```javascript
const requestForm = document.getElementById('requestForm').contentWindow;

// Send client data
requestForm.postMessage({
  type: 'client-data',
  user: 'staff@example.com',
  data: {
    cD: {fe: 'BA', n: 'Mr J Archer', cN: '50', mN: '52'},
    i: {a: true, p: true, l: false},
    wT: 'Purchase of',
    r: 'Our Client',
    mD: 'Property purchase',
    cI: {
      n: {t: 'Mr', f: 'Jacob', m: 'Robert', l: 'Archer-Moran'},
      b: '11-01-2001',
      m: '+447700900123',
      e: 'client@example.com',
      a: {
        building_number: '42',
        street: 'Baker Street',
        town: 'London',
        postcode: 'NW1 6XE',
        country: 'GBR'
      },
      rM: false,
      nC: false
    },
    idI: [...],  // Existing ID images
    idD: [...]   // Existing CDF/OFSI documents
  }
}, '*');

// Listen for request submission
window.addEventListener('message', (event) => {
  if (event.data.type === 'request-data') {
    const {requestType, data, message, newFiles} = event.data;
    
    // Save request to database
    saveRequest(requestType, data, message, newFiles);
  }
  
  if (event.data.type === 'company-lookup') {
    // Fetch company data from Companies House
    fetchCompanyData(event.data.entityNumber, event.data.country)
      .then(companyData => {
        requestForm.postMessage({
          type: 'company-data',
          data: companyData
        }, '*');
      });
  }
  
  if (event.data.type === 'file-data') {
    // Generate S3 PUT links
    generateS3Links(event.data.files)
      .then(({links, s3Keys}) => {
        requestForm.postMessage({
          type: 'put-links',
          links: links,
          s3Keys: s3Keys
        }, '*');
      })
      .catch(error => {
        requestForm.postMessage({
          type: 'put-error',
          error: error.message
        }, '*');
      });
  }
});
```

### Data Structures

#### Client Data Object (Shorthand Format)
```javascript
{
  cD: {fe, n, cN, mN},     // Client display
  i: {a, p, l},             // Icons
  wT, r, mD, c, b,          // Matter details
  cI: {n, b, m, e, a, ...}, // Client info
  idI: [...],               // ID images array
  idD: [...]                // ID documents array
}
```

#### Message Object
```javascript
{
  time: '14/10/2025, 14:30:00',
  user: 'staff@example.com',
  message: 'Message text',
  type: 'Staff',
  file: {...}  // Optional attachment
}
```

### Features
- **Dynamic Hints:** Contextual hints based on request type and client data
- **Smart Validation:** Detailed multi-line error messages with specific field requirements
- **File Upload:** Global upload system with progress tracking and S3 integration
- **People Cards:** Automatic deduplication and role merging for company officers
- **Mobile Validation:** Google libphonenumber integration with country code handling
- **Address Validation:** Thirdfort format validation with API fallback
- **State Management:** Form state preserved when switching between request types
- **Responsive Design:** Mobile-optimized with touch-friendly controls

---

## Client Details Form

**File:** `client-details.html`

### Description
Lightweight client details and address collection form. Unlike `image-uploader.html`, this form does NOT handle file uploads. It focuses solely on collecting client personal information and addresses with Thirdfort API format support. Mobile phone numbers are validated using Google's libphonenumber library before submission.

### Parent → iframe (Incoming Messages)

#### `client-data`
Loads existing client data into the form.

```javascript
window.frames[0].postMessage({
  type: 'client-data',
  entity: false,  // true for business/charity, false for individual
  entityType: 'business',  // 'business' or 'charity' (when entity=true)
  allowEdits: true,  // Controls if form fields are editable
  clientData: {
    n: {  // name object
      t: 'Mr',              // titlePrefix
      f: 'John',            // firstName
      m: 'William',         // middleNames
      l: 'Doe',             // surname
      b: 'Acme Corp'        // businessName (entity mode only)
    },
    b: '01-01-1990',        // dateOfBirth (DD-MM-YYYY)
    a: {  // currentAddressNEW (Thirdfort format)
      building_number: '42',
      street: 'Baker Street',
      town: 'London',
      postcode: 'NW1 6XE',
      country: 'GBR'
    },
    pA: {...},              // previousAddressNEW (optional)
    rM: false,              // clientRecentHomeMove
    nC: false,              // clientRecentNameChange
    pN: '',                 // previousName
    rNC: '',                // reasonForNameChange
    m: '+447700900000',     // mobileNumber
    e: 'john@example.com',  // email
    eN: '12345678',         // entityNumber (company/charity number)
    rC: 'GB',               // registrationCountry
    eT: 'business',         // entityType
    bD: {...}               // businessData (directors/trustees)
  }
}, '*');
```

#### `entity-true`
Switches form to entity mode (business/charity).

```javascript
window.frames[0].postMessage({
  type: 'entity-true',
  entityType: 'business'  // or 'charity'
}, '*');
```

#### `entity-false`
Switches form to individual mode.

```javascript
window.frames[0].postMessage({
  type: 'entity-false'
}, '*');
```

#### `allowEdits-true` / `allowEdits-false`
Enables or disables form editing.

```javascript
window.frames[0].postMessage({
  type: 'allowEdits-true'  // or 'allowEdits-false'
}, '*');
```

#### `request-data`
Requests form data (triggers validation and submission).

```javascript
window.frames[0].postMessage({
  type: 'request-data'
}, '*');
```

#### `address-results`
Autocomplete suggestions from address lookup.

```javascript
window.frames[0].postMessage({
  type: 'address-results',
  results: [
    {
      id: 'address-id-123',
      address: '42 Baker Street, London, NW1 6XE'
    }
  ],
  field: 'current'  // or 'previous'
}, '*');
```

#### `address-data`
Full address object after selection.

```javascript
window.frames[0].postMessage({
  type: 'address-data',
  address: {
    building_number: '42',
    street: 'Baker Street',
    town: 'London',
    postcode: 'NW1 6XE',
    country: 'GBR'
  },
  field: 'current'  // or 'previous'
}, '*');
```

#### `company-results` / `company-data`
Company search results and details from Companies House API.

#### `charity-results` / `charity-data`
Charity search results and details from Charity Commission API.

### iframe → Parent (Outgoing Messages)

#### `new-data`
Sends complete form data (after validation). Phone numbers are validated using Google's libphonenumber library and formatted in E.164 international format.

```javascript
{
  type: 'new-data',
  clientData: {
    n: {t: 'Mr', f: 'John', m: 'William', l: 'Doe'},
    b: '01-01-1990',
    a: {...},  // Thirdfort formatted current address
    pA: {...}, // Thirdfort formatted previous address
    rM: false,
    nC: false,
    m: '+447700900000',  // Validated and formatted in E.164 international format
    e: 'john@example.com',
    eT: 'individual'  // or 'business'/'charity'
  }
}
```

#### `address-search`
Requests address autocomplete suggestions.

```javascript
{
  type: 'address-search',
  searchTerm: 'Baker Street',
  field: 'current',  // or 'previous'
  country: 'GBR'
}
```

#### `address-lookup`
Requests full address by ID.

```javascript
{
  type: 'address-lookup',
  addressId: 'address-id-123',
  field: 'current',  // or 'previous'
  country: 'GBR'
}
```

#### `company-search` / `company-lookup`
Requests company search and full company data.

#### `charity-search` / `charity-lookup`
Requests charity search and full charity data.

#### `validation-error`
Notifies parent of validation failures. Includes phone number validation using Google's libphonenumber library.

```javascript
{
  type: 'validation-error',
  errors: ['Please enter a valid mobile phone number.', 'Please complete all required fields']
}
```

#### `disable-close`
Notifies parent of unsaved changes (prevents accidental close).

```javascript
{
  type: 'disable-close'
}
```

### Thirdfort Address Format

Addresses are automatically converted to Thirdfort API format:

**UK (GBR):**
```javascript
{
  building_name: 'Oak House',
  building_number: '42',
  flat_number: '10',
  street: 'Baker Street',
  sub_street: '',
  town: 'London',
  postcode: 'NW1 6XE',
  country: 'GBR'
  // Note: UK addresses do NOT include address_1/address_2
}
```

**USA/Canada:**
```javascript
{
  address_1: '123 Main Street',
  address_2: 'Apt 4B',
  street: 'Main Street',
  town: 'New York',
  state: 'NY',
  postcode: '10001',
  country: 'USA'
}
```

**Other Countries:**
```javascript
{
  address_1: 'Rue de la Paix',
  address_2: 'Apartment 5',
  town: 'Paris',
  postcode: '75001',
  country: 'FRA'
}
```

### Features

- **Entity Mode Support** - Toggle between individual and business/charity modes
- **Address Autocomplete** - getaddress.io integration via parent proxy
- **Smart Caching** - LRU cache with 30-day expiry for addresses
- **Thirdfort Formatting** - Automatic conversion to Thirdfort API spec
- **Validation** - Real-time field validation with error messages
- **Unsaved Changes Protection** - Sends `disable-close` to prevent data loss

---

## Image Uploader

**File:** `image-uploader.html`

### Description
Complete client onboarding form for collecting personal details AND uploading ID documents. This is the full-featured version that includes everything from `client-details.html` plus file upload capabilities.

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

#### `button-enable`
Enables the "Add more documents" button.

```javascript
window.frames[0].postMessage({
  type: 'button-enable'
}, '*');
```

#### `button-disable`
Disables the "Add more documents" button.

```javascript
window.frames[0].postMessage({
  type: 'button-disable'
}, '*');
```

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

#### `button-enable`
Enables the send message button.

```javascript
window.frames[0].postMessage({
  type: 'button-enable'
}, '*');
```

#### `button-disable`
Disables the send message button.

```javascript
window.frames[0].postMessage({
  type: 'button-disable'
}, '*');
```

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
Activity log display for cashier operations with dynamic pagination. Shows user activities, messages, and timestamps with "Load more" functionality for infinite scroll-free viewing.

### Parent → iframe (Incoming Messages)

#### `log-data`
Sends complete array of log entries to display.

```javascript
window.frames[0].postMessage({
  type: 'log-data',
  logs: [
    {
      user: 'cashier@example.com',
      message: 'Client ID checked and approved',
      time: '10/14/2025, 2:30:00 PM'
    },
    {
      user: 'staff@example.com',
      message: 'Documents uploaded to system',
      time: '10/14/2025, 2:25:15 PM'
    }
  ]
}, '*');
```

### iframe → Parent (Outgoing Messages)

The Cashiers Log is a display-only component and does not send messages back to the parent.

### Features

#### Responsive Height with Dynamic Card Loading
- Container height is fully responsive using calc()
- Automatically calculates how many log entries fit without scrolling
- Dynamically loads initial batch based on available height
- "Load more" button for pagination (loads next batch)
- Recent commit: "Make cashiers-log container height fully responsive with dynamic card loading"

#### Log Display
- Newest logs appear at top
- User email displayed with custom Transport font
- Message text with Rotis Regular font
- Timestamps with Rotis Italic font
- Clean card-based layout

#### Pagination
- Shows as many logs as fit without scrolling initially
- "Load more" button appears if more logs exist
- Button hidden when all logs displayed
- New log array resets to dynamic initial count

### Example Integration

```javascript
const cashiersFrame = document.getElementById('cashiersLog').contentWindow;

// Send log data
cashiersFrame.postMessage({
  type: 'log-data',
  logs: [
    {
      user: 'cashier1@example.com',
      message: 'Pass issued to client',
      time: new Date().toLocaleString('en-US')
    },
    {
      user: 'cashier2@example.com',
      message: 'ID verification completed',
      time: new Date().toLocaleString('en-US')
    }
  ]
}, '*');
```

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
- Uses unique ID handshake via postMessage for secure data transfer
- Functions are serialized before sending (postMessage can't clone functions)
- Supported formatter functions: `percentageLabel` and other predefined formatters
- Popup stays synchronized - updates when iframe receives new data
- Multiple popups supported simultaneously (each with unique ID)
- Recent fix: "Fix doughnut chart expansion - serialize functions for postMessage"

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

