# SDLT Workflow Iframe - Messaging API

**File:** `sdlt-workflow.html`

## Overview

The SDLT Workflow iframe provides a staff-facing interface for managing SDLT processing workflows. It uses `window.postMessage()` for bidirectional communication with the parent window (Wix Velo code). The iframe manages workflow state, handles document uploads, and communicates status updates back to the parent.

## Communication Flow

### Initialization
1. Parent sends `entry-data` message with full entry data from SDLTProcessing collection
2. Iframe processes data, determines current workflow stage, and renders appropriate UI
3. Iframe sends `workflow-ready` message when ready to receive messages

### Save Flow
1. User makes changes in the iframe
2. Iframe sends `disable-close` message to prevent parent close button from being enabled
3. User clicks Save button in parent (iframe has no save button)
4. Parent sends `save-data` message to iframe
5. If files need uploading:
   - Iframe sends `file-data` message with file metadata
   - Parent responds with `put-links` (S3 upload URLs) or `put-error`
   - Iframe uploads files to S3
   - Iframe sends `save-data-response` with updates including file objects
6. If no files to upload:
   - Iframe immediately sends `save-data-response` with updates
7. Parent saves data and may send updated `entry-data` back to reinitialize

---

## Messages FROM Parent (Incoming)

### `entry-data`

Full entry data from the SDLTProcessing collection. Initializes the workflow state.

```javascript
{
  type: 'entry-data',
  data: {
    user: 'staff.email@example.com',  // Current user email (for file uploads)
    data: {  // Full entry data from SDLTProcessing collection
      _id: 'entry-id-123',
      _createdDate: '2025-12-09T16:54:23.281Z',
    _updatedDate: '2025-12-27T19:48:44.432Z',
    
    // Status array (contains one status at a time)
    status: ['New Submission'],  // or 'Submission Received', 'Calculating SDLT', etc.
    
    // Workflow tracking flags
    thsNotification: true,           // Boolean - true if first time opening
    idCheckSent: false,              // Boolean - ID checks requested
    sdltCalculated: false,           // Boolean - SDLT calculation completed
    sdltRequired: false,             // Boolean - SDLT is required
    sdltDue: 0,                     // Number - SDLT amount due (0 if none)
    sdltPaid: false,                // Boolean - SDLT payment received
    sdlt5Uploaded: false,           // Boolean - SDLT5 certificate uploaded
    feeInvoiceSent: false,          // Boolean - THS fee invoice sent
    sdltInvoiceSent: false,         // Boolean - SDLT invoice sent
    completionStatementSent: false, // Boolean - Completion statement sent
    dwellworksNotification: false,  // Boolean - Notification flag
    
    // Dates
    ukMoveInDate: '2025-12-09',     // String - Move-in date (YYYY-MM-DD format)
    invoiceDate: '2025-12-15',      // String - Invoice date (YYYY-MM-DD format)
    sdltPaid1: '2025-12-23',        // String - SDLT payment date (YYYY-MM-DD format)
    
    // Our Details
    fe: 'Emma Lockie',              // String - Fee earner name
    clientNumber: 12345,            // Number - Client number
    matterNumber: 'M-12345',        // String - Matter number
    
    // Property Address
    sdltAddress: {
      postcode: 'TR15 2ND',
      country: 'GBR',
      building_name: '',
      flat_number: '',
      street: 'Southgate Street',
      building_number: '94',
      sub_street: '',
      town: 'Redruth'
    },
    
    // Tenant/Lessee Details
    tenantsFirstName: 'Se',
    tenantLastName: 'Stewart',
    lessee: "The Tenant",           // One of: 'The Tenant', "The Tenant's Employer", 'Dwellworks', 'Other'
    lesseeOther: 'Barbara Archer',  // Name if lessee is 'Other'
    lesseeOtherRelation: 'Mother',  // Relation if lessee is 'Other'
    tenantsEmployer: 'THURSTAN HOSKIN SOLICITORS LLP',  // Employer name
    
    // ID Checks
    idEntries: [
      {
        _id: 'id-entry-1',
        name: 'S Stewart',
        status: 'Completed',  // or 'Not sent', 'Pending', etc.
        updated: '[object Promise]'
      }
    ],
    
    // Fee Payers
    thsFeePayer: "The Tenant's Employer",  // One of: 'The Tenant', "The Tenant's Employer", 'Dwellworks', 'Other'
    sdltFeePayer: "The Tenant's Employer",
    thsFeePayerOther: 'Lee Smithers',      // If thsFeePayer is 'Other'
    thsFeePayerRelationToTenant: 'Father',
    sdltFeePayerOther: 'Name',             // If sdltFeePayer is 'Other'
    sdltFeePayerRelationToTenant: 'Relation',
    sdltFeeEmployerDetailsMatchThsLlpFeePayer: true,  // Boolean - use THS employer details if true
    
    // Contact Information
    thsFeePayerEmail: 'name@domain.uk',
    thsFeePayerPhoneNumber: '01209321234',
    sdltFeePayerEmail: 'name@domain.org',
    sdltFeePayerPhone: '01209321234',
    thsFeeEmployersAcocuntsEmail: 'barbara@thurstanhoskin.co.uk',
    thsFeeEmployersAccountsContactPhone: '01209213646',
    thsFeeEmployersAccountsContactName: 'lindsey mary',
    sdltFeeEmployersAccountEmail: 'name@account.com',
    sdltFeeEmployersAccountsContactName: 'Contact Name',
    
    // Invoice Sending Flags
    sdltFeeInvoiceSending: true,    // Boolean - send SDLT invoice directly to payer
    thsFeesInvoiceSending: true,    // Boolean - send THS invoice directly to payer
    
    // Documents (with s3Key and liveUrl)
    sdltCalculation: {
      description: 'SDLT Calculation.pdf',
      s3Key: 'protected/SHRDS7q',
      liveUrl: 'https://sdlt-documents.thurstanhoskin.app/protected/SHRDS7q?...',
      url: 'https://sdlt-documents.thurstanhoskin.app/protected/SHRDS7q?...'
    },
    thsInvoice: {
      description: 'THS Invoice.pdf',
      s3Key: 'protected/ABC123',
      liveUrl: 'https://sdlt-documents.thurstanhoskin.app/protected/ABC123?...'
    },
    sdltInvoice: {
      description: 'SDLT Invoice.pdf',
      s3Key: 'protected/DEF456',
      liveUrl: 'https://sdlt-documents.thurstanhoskin.app/protected/DEF456?...'
    },
    completionStatement: {
      description: 'Completion Statement.pdf',
      s3Key: 'protected/GHI789',
      liveUrl: 'https://sdlt-documents.thurstanhoskin.app/protected/GHI789?...'
    },
    sdlt5Certificate: {
      description: 'SDLT5 Certificate.pdf',
      s3Key: 'protected/JKL012',
      liveUrl: 'https://sdlt-documents.thurstanhoskin.app/protected/JKL012?...'
    },
    
    // Other fields
    note: 'Staff notes',
    supportingDocuments: [],
    chatLog: []
    }
  }
}
```

**First-Time Opening Behavior:**
- If `status` includes `'New Submission'` AND `thsNotification === true`:
  - Iframe automatically sends `disable-close` and `dont-notify` messages
  - Iframe creates pending update: `status: ['Submission Received']`, `thsNotification: false`
  - These updates are returned when parent sends `save-data` message

---

### `save-data`

Request from parent for current form data to save. Parent initiates save process.

```javascript
{
  type: 'save-data'
}
```

**Iframe Response Options:**
1. **If files need uploading**: Send `file-data` message first
2. **If validation error**: Send `validation-error` message
3. **If ready to save**: Send `save-data-response` message (after file uploads if needed)

---

### `put-links`

Response from parent after `file-data` message. Provides S3 pre-signed URLs for file upload.

```javascript
{
  type: 'put-links',
  links: ['https://s3.amazonaws.com/...?signature=...'],  // Array of S3 PUT URLs
  s3Keys: ['protected/file1.pdf', 'protected/file2.pdf'], // Array of S3 keys
  documents: [  // Array of document objects (with s3Key and fieldKey)
    {
      fieldKey: 'sdltCalculation',  // Identifies which field this document belongs to
      s3Key: 'protected/file1.pdf',
      description: 'SDLT Calculation.pdf',
      // ... other document fields
    }
  ]
}
```

**Iframe Action:**
- Uploads files to S3 using provided URLs
- Maps documents back to `pendingUpdates` using `fieldKey`
- Sends `save-data-response` with all updates including document objects

---

### `put-error`

Error response from parent if S3 upload URLs cannot be generated.

```javascript
{
  type: 'put-error',
  message: 'Error generating upload URLs'
}
```

**Iframe Action:**
- Hides upload progress overlay
- Sends `upload-error` message back to parent
- Does not proceed with save

---

## Messages TO Parent (Outgoing)

### `workflow-ready`

Notifies parent that iframe is initialized and ready to receive messages.

```javascript
{
  type: 'workflow-ready'
}
```

**When Sent:**
- After iframe initialization is complete
- After handling `entry-data` message

---

### `disable-close`

Requests parent to disable the close button (prevents user from closing without saving).

```javascript
{
  type: 'disable-close'
}
```

**When Sent:**
- When form input changes (via `notifyFormChanged()`)
- On first-time opening (when `status === 'New Submission'` and `thsNotification === true`)
- When SDLT5 certificate file is selected
- When accounting documents are selected

---

### `dont-notify`

Requests parent not to send notifications for current changes.

```javascript
{
  type: 'dont-notify'
}
```

**When Sent:**
- On first-time opening (auto-status change to "Submission Received")
- When marking entry as "Calculating SDLT"
- When requesting ID checks (`idCheckSent: true`)
- When ID checks are completed and moving to "Generating Invoices" stage

---

### `do-notify`

Requests parent to send notifications for current changes.

```javascript
{
  type: 'do-notify'
}
```

**When Sent:**
- After SDLT calculation is completed (calculation results stored)
- When ID checks are marked as "in Progress"
- When any accounting document is selected
- When SDLT payment date is entered

---

### `request-checks`

Requests parent to initiate ID checks via Val'ID'ate/Thirdfort.

```javascript
{
  type: 'request-checks'
  // No additional data
}
```

**When Sent:**
- When user clicks "Request ID Checks" button (after SDLT calculation when SDLT is due)
- Always sent after `dont-notify` message in the same workflow step

---

### `file-data`

Request for S3 upload URLs. Contains file metadata for files that need to be uploaded.

```javascript
{
  type: 'file-data',
  files: [
    {
      type: 'user',
      document: 'SDLT Calculation',
      uploader: 'staff.email@example.com',
      date: '09/12/2025, 16:54:15',
      data: {
        type: 'application/pdf',
        size: 82923,
        name: 'SDLT Calculation.pdf',
        lastModified: 1745418857987
      },
      file: {},
      isCalculation: true,        // Optional - indicates this is a calculation PDF
      fieldKey: 'sdltCalculation' // Identifies which field this file belongs to
    },
    {
      type: 'user',
      document: 'THS Invoice',
      uploader: 'staff.email@example.com',
      date: '10/12/2025, 12:30:00',
      data: {
        type: 'application/pdf',
        size: 45678,
        name: 'invoice.pdf',
        lastModified: 1745423400000
      },
      file: {},
      fieldKey: 'thsInvoice'
    }
    // ... more files
  ]
}
```

**Field Keys:**
- `sdltCalculation` - SDLT calculation PDF
- `thsInvoice` - THS legal fee invoice
- `sdltInvoice` - SDLT invoice (if different payer)
- `completionStatement` - Completion statement
- `sdlt5Certificate` - SDLT5 certificate

**Parent Response:**
- `put-links` - Success (with S3 URLs and document objects)
- `put-error` - Error generating URLs

---

### `save-data-response`

Response to parent's `save-data` request. Contains all pending updates to save. Matches the format used by `dwellworks-request-form.html`.

```javascript
{
  type: 'save-data-response',
  success: true,
  updatedFields: ['thsNotification', 'sdltCalculated', 'sdltRequired', 'sdltDue', 'sdltCalculation', 'idCheckSent'],  // Array of field names that changed (excluding status)
  updates: {
    // Notification flags
    thsNotification: false,
    dwellworksNotification: true,
    
    // SDLT Calculation results
    sdltCalculated: true,
    sdltRequired: true,
    sdltDue: 1234.56,
    
    // SDLT Calculation document (after S3 upload)
    sdltCalculation: {
      fieldKey: 'sdltCalculation',
      s3Key: 'protected/ABC123',
      description: 'SDLT Calculation.pdf',
      // ... other document fields from parent
    },
    
    // ID Checks
    idCheckSent: true,
    
    // Payment
    sdltPaid: true,
    sdltPaid1: '2025-12-23',  // Date string (YYYY-MM-DD)
    
    // Accounting documents (after S3 upload)
    thsInvoice: {
      fieldKey: 'thsInvoice',
      s3Key: 'protected/DEF456',
      // ... other document fields
    },
    sdltInvoice: {
      fieldKey: 'sdltInvoice',
      s3Key: 'protected/GHI789',
      // ... other document fields
    },
    completionStatement: {
      fieldKey: 'completionStatement',
      s3Key: 'protected/JKL012',
      // ... other document fields
    },
    invoiceDate: '2025-12-15',
    feeInvoiceSent: true,
    sdltInvoiceSent: true,
    completionStatementSent: true,
    
    // SDLT5 Certificate
    sdlt5Uploaded: true,
    sdlt5Certificate: {
      fieldKey: 'sdlt5Certificate',
      s3Key: 'protected/MNO345',
      // ... other document fields
    },
    
    // Our Details (if changed)
    fe: 'Emma Lockie',
    clientNumber: 12345,
    matterNumber: 'M-12345'
  },
  status: ['Submission Received'],  // Status array (separate from updates object)
  newMessage: 'I have calculated the SDLT due on this matter to be £1234.56. We will now proceed to opening a matter and completing the relevant checks.'  // Optional chat message string
}
```

**Message Structure:**
- `updatedFields`: Array of field names that changed (excludes `status`)
- `updates`: Object with updated values (excludes `status`)
- `status`: Array with the new status value (separate field)
- `newMessage`: Optional chat message string

**Note:** 
- The `newMessage` field contains only the message string. The parent (Velo code) will transform it into a full message object for the chat log.
- Fields that are `undefined` are excluded from the response.

---

### `validation-error`

Validation error before saving. Prevents save operation.

```javascript
{
  type: 'validation-error',
  message: 'Required field is missing'
}
```

**When Sent:**
- When `save-data` is received but entry data is not available
- When other validation checks fail (custom validation can be added)

---

### `upload-error`

Error during file upload to S3.

```javascript
{
  type: 'upload-error',
  message: 'Failed to upload file to S3'
}
```

**When Sent:**
- After receiving `put-links` but S3 upload fails
- Hides upload progress overlay
- Save operation does not proceed

---

## Status Values

The `status` field is always an array containing one status string:

- `'New Submission'` - Initial state
- `'Submission Received'` - Auto-set on first open
- `'Calculating SDLT'` - SDLT calculation in progress
- `'No SDLT Due'` - No SDLT payable (workflow ends here)
- `'ID Checks in Progress'` - ID checks are being processed
- `'Generating Invoices'` - Invoices being prepared
- `'Invoices Sent'` - Invoices have been sent to payers
- `'SDLT Paid'` - SDLT payment received
- `'SDLT Paid'` - Final state (with SDLT5 certificate uploaded)

---

## Workflow Stages

The iframe dynamically shows/hides workflow cards based on the current status:

1. **Initial Review** - New submissions, awaiting initial processing
2. **SDLT Preparation** - Calculating SDLT, uploading calculation PDF
3. **ID Checks** - Requesting and monitoring ID check completion
4. **Accounting** - Generating and uploading invoices/completion statements
5. **Payment** - Recording SDLT payment date
6. **Certificate Upload** - Uploading SDLT5 certificate
7. **Completion** - All documents uploaded, matter complete

---

## File Upload Flow

1. User selects file(s) in iframe
2. File(s) stored in `accountingFiles` or `pendingPdfBlob`
3. User clicks Save in parent
4. Parent sends `save-data`
5. Iframe sends `file-data` with file metadata
6. Parent responds with `put-links` (S3 URLs + document objects)
7. Iframe uploads files to S3
8. Iframe maps document objects to `pendingUpdates` using `fieldKey`
9. Iframe sends `save-data-response` with all updates including document objects
10. Parent saves data and may send updated `entry-data` to reinitialize

---

## Example Integration (Velo Code)

```javascript
import wixWindow from 'wix-window';

// Listen for messages from iframe
$w.onReady(function () {
  wixWindow.addEventListener("message", (event) => {
    const message = event.data;
    
    switch (message.type) {
      case 'workflow-ready':
        // Iframe is ready, can send entry-data
        sendEntryData();
        break;
        
      case 'disable-close':
        // Disable close button
        $w('#closeButton').disable();
        break;
        
      case 'save-data-response':
        // Save updates to collection
        saveToCollection(message.updates, message.newMessage);
        break;
        
      case 'file-data':
        // Generate S3 upload URLs
        generateS3Urls(message.files).then((result) => {
          $w('#sdltWorkflowIframe').postMessage({
            type: 'put-links',
            links: result.links,
            s3Keys: result.s3Keys,
            documents: result.documents
          });
        });
        break;
        
      case 'request-checks':
        // Trigger ID checks via Thirdfort/Val'ID'ate
        requestIdChecks();
        break;
    }
  });
});

// Send entry data to iframe
function sendEntryData() {
  $w('#sdltWorkflowIframe').postMessage({
    type: 'entry-data',
    data: {
      user: wixUsers.currentUser.email,  // Current user email (for file uploads)
      data: entryData  // Full entry from SDLTProcessing collection
    }
  });
}

// Handle save button click
export function saveButton_click() {
  $w('#sdltWorkflowIframe').postMessage({
    type: 'save-data'
  });
}
```

---

## Notes

- All messages use `window.postMessage()` with `'*'` origin (origin validation should be added in production)
- File uploads use S3 pre-signed URLs for security
- The iframe manages its own UI state - parent only needs to provide data and handle save
- Status array always contains one value - the iframe overwrites the entire array
- Document objects from parent include `s3Key` and `liveUrl` for viewing/downloading
- The `newMessage` string is optional and only sent when workflow actions generate chat messages

