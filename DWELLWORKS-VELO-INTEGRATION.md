# Dwellworks Request Form - Velo Integration Guide

This document explains how to implement the Wix Velo backend and frontend code to support the `dwellworks-request-form.html` iframe. It details the messaging protocol, API integrations (getAddress.io and Companies House), and S3 PUT link generation.

## Table of Contents

1. [Message Protocol Overview](#message-protocol-overview)
2. [Messages FROM Iframe to Parent](#messages-from-iframe-to-parent)
3. [Messages FROM Parent to Iframe](#messages-from-parent-to-iframe)
4. [getAddress.io API Integration](#getaddressio-api-integration)
5. [Companies House API Integration](#companies-house-api-integration)
6. [S3 PUT Link Generation](#s3-put-link-generation)
7. [Session Management](#session-management)

---

## Message Protocol Overview

The iframe communicates with the parent Wix page using `window.postMessage()`. All messages are JSON objects with a `type` property that identifies the message type.

**Message Format:**
```javascript
{
  type: 'message-type',
  // ... additional properties
}
```

---

## Messages FROM Iframe to Parent

These are messages the iframe sends that the parent must handle.

### 1. `iframe-ready`

**When:** Sent when the iframe loads and is ready to receive data.

**Message:**
```javascript
{
  type: 'iframe-ready',
  iframeType: 'dwellworks-request-form'
}
```

**Parent Action:** 
- Store reference to iframe
- Optionally send `submitter-data` to prefill form

---

### 2. `submitter-data` (Not sent by iframe)

**Note:** This is actually sent FROM parent TO iframe. See below.

---

### 3. `address-search`

**When:** User types in an address field (SDLT address or previous address). Debounced 300ms.

**Message:**
```javascript
{
  type: 'address-search',
  searchTerm: '123 Baker Street',  // User's search input
  field: 'sdlt' | 'previous'       // Which address field
}
```

**Parent Action:**
1. Call getAddress.io API with `searchTerm`
2. Return results via `address-results` message

**Example Implementation:**
```javascript
import { getSecret } from 'wix-secrets-backend';

export async function handleAddressSearch(searchTerm, field) {
  const apiKey = await getSecret('GETADDRESS_API_KEY');
  
  const response = await fetch(
    `https://api.getAddress.io/autocomplete/${encodeURIComponent(searchTerm)}?api-key=${apiKey}`
  );
  
  const data = await response.json();
  
  // Send results back to iframe
  iframe.contentWindow.postMessage({
    type: 'address-results',
    suggestions: data.suggestions || [],
    field: field
  }, '*');
}
```

---

### 4. `address-lookup`

**When:** User selects an address from the autocomplete dropdown.

**Message:**
```javascript
{
  type: 'address-lookup',
  addressId: 'gid://getAddress.io/Address/12345',  // ID from getAddress.io
  field: 'sdlt' | 'previous'
}
```

**Parent Action:**
1. Call getAddress.io API to get full address details using `addressId`
2. Format address to Thirdfort standards
3. Return via `address-data` message

**Example Implementation:**
```javascript
export async function handleAddressLookup(addressId, field) {
  const apiKey = await getSecret('GETADDRESS_API_KEY');
  
  const response = await fetch(
    `https://api.getAddress.io/get/${addressId}?api-key=${apiKey}`
  );
  
  const addressData = await response.json();
  
  // Format to Thirdfort standards (see getAddress.io section)
  const thirdfortAddress = formatToThirdfort(addressData);
  
  // Send to iframe
  iframe.contentWindow.postMessage({
    type: 'address-data',
    address: thirdfortAddress,
    field: field
  }, '*');
}
```

---

### 5. `company-search`

**When:** User types in employer name or number field (UK companies only). Debounced 300ms.

**Message:**
```javascript
{
  type: 'company-search',
  searchTerm: 'Acme Corporation',  // User's search input
  byNumber: false                  // true if searching by company number
}
```

**Parent Action:**
1. Call Companies House API
2. Return results via `company-results` message

**Example Implementation:**
```javascript
import { getSecret } from 'wix-secrets-backend';

export async function handleCompanySearch(searchTerm, byNumber) {
  const apiKey = await getSecret('COMPANIES_HOUSE_API_KEY');
  
  let url;
  if (byNumber) {
    url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}`;
  } else {
    url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`
    }
  });
  
  const data = await response.json();
  
  // Send results back to iframe
  iframe.contentWindow.postMessage({
    type: 'company-results',
    companies: data.items || [],
    byNumber: byNumber
  }, '*');
}
```

---

### 6. `company-lookup`

**When:** User selects a company from dropdown or clicks refresh button.

**Message:**
```javascript
{
  type: 'company-lookup',
  companyNumber: '12345678'  // Companies House company number
}
```

**Parent Action:**
1. Call Companies House API to get full company details
2. Return via `company-data` message

**Example Implementation:**
```javascript
export async function handleCompanyLookup(companyNumber) {
  const apiKey = await getSecret('COMPANIES_HOUSE_API_KEY');
  
  const response = await fetch(
    `https://api.company-information.service.gov.uk/company/${companyNumber}`,
    {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`
      }
    }
  );
  
  const companyData = await response.json();
  
  // Send full Companies House object to iframe
  // The iframe will store this and return it in form submission if UK company
  iframe.contentWindow.postMessage({
    type: 'company-data',
    company: companyData  // Send full API response object
  }, '*');
}
```

---

### 7. `file-data`

**When:** User submits form and files need to be uploaded. Sent with file metadata (not File objects).

**Message:**
```javascript
{
  type: 'file-data',
  files: [
    {
      name: 'lease-agreement.pdf',
      size: 1024000,
      type: 'application/pdf',
      document: 'Lease Agreement',
      description: 'Optional description',
      uploader: 'User',
      date: '15/12/2023, 14:30:45',
      isLease: true,           // true for lease document
      isAdditional: false,     // true for additional documents
      docId: 'doc-123'         // ID for additional documents only
    }
    // ... more files
  ]
}
```

**Note:** The iframe does not send a `bucket` property. The parent should determine the bucket based on the iframe context. For `dwellworks-request-form`, use `sdlt-documents` (or `sdlt-documents-prod-london` for production).

**Parent Action:**
1. Generate S3 PUT links for each file
2. Return via `put-links` message (or `put-error` on failure)

**Example Implementation:**
```javascript
import { getSecret } from 'wix-secrets-backend';
import { uploadFiles } from 'public/functions/file-upload.js';

export async function handleFileData(files, iframeType) {
  try {
    // Determine bucket based on iframe type
    const bucket = iframeType === 'dwellworks-request-form' 
      ? 'sdlt-documents-prod-london'  // or 'sdlt-documents' for dev
      : 'id-documents';  // Default bucket for other iframes
    
    const links = [];
    const s3Keys = [];
    
    for (const file of files) {
      // Generate S3 PUT link (see S3 PUT Link Generation section)
      const { putUrl, s3Key } = await generateS3PutLink(file, bucket);
      
      links.push(putUrl);
      s3Keys.push({
        name: file.name,
        size: file.size,
        type: file.type,
        s3Key: s3Key,
        document: file.document,
        description: file.description,
        uploader: file.uploader,
        date: file.date,
        isLease: file.isLease || false,
        isAdditional: file.isAdditional || false,
        docId: file.docId || undefined
      });
    }
    
    // Send PUT links to iframe
    iframe.contentWindow.postMessage({
      type: 'put-links',
      links: links,
      s3Keys: s3Keys
    }, '*');
    
  } catch (error) {
    // Send error to iframe
    iframe.contentWindow.postMessage({
      type: 'put-error',
      message: error.message || 'Failed to generate upload links'
    }, '*');
  }
}
```

---

### 8. `dwellworks-form-data`

**When:** Form submission is complete and all files are uploaded.

**Message:**
```javascript
{
  type: 'dwellworks-form-data',
  formData: {
    status: ["New Submission"],
    submitterFirstName: 'John',
    submitterLastName: 'Doe',
    dwellworksReference: 'REF123',
    dwellworksContactNumber: '+447700900123',
    dwellworksEmail: 'john@example.com',
    sharedEmail: 'share@example.com',
    // ... all form fields (see Wix backend format)
    leaseAgreement: {
      name: 'lease.pdf',
      size: 1024000,
      type: 'application/pdf',
      s3Key: 'sdlt-documents/lease-123.pdf'
    },
    sdltDocuments: [
      {
        name: 'doc1.pdf',
        size: 512000,
        type: 'application/pdf',
        s3Key: 'sdlt-documents/doc1-123.pdf',
        document: 'Supporting Document',
        description: 'Additional info',
        uploader: 'User',
        date: '15/12/2023, 14:30:45'
      }
    ],
    addSupportingDocuments: true,
    privacyPolicy: true,
    gdprIndividualsAgreement: true,
    terms: true
  }
}
```

**Parent Action:**
1. Save form data to Wix database
2. On success: Handle success response (e.g., show success message, redirect)
3. On failure: Send `upload-error` message back to iframe so user can retry

**Important Notes:**
- `sdltAddress` and `tenantsPreviousAddress` are returned as **full Thirdfort address objects**, not formatted strings
- `companyData` contains the **full Companies House API response object** (only present if UK company)
- All fields are always present in the object, even if their value is `undefined`

**Example Implementation:**
```javascript
import { insertEntry } from 'backend/sdlt-requests/insert.web.js';

export async function handleDwellworksFormData(formData) {
  try {
    const result = await insertEntry(formData);
    
    if (result.success) {
      // Show success message or redirect
      console.log('Form submitted successfully:', result.submission_id);
      // Optionally send success message to iframe
    } else {
      // Send error back to iframe so user can retry
      iframe.postMessage({
        type: 'upload-error',
        message: result.error || 'Failed to insert form data'
      }, '*');
    }
  } catch (error) {
    console.error('Error submitting form:', error);
    // Send error back to iframe so user can retry
    iframe.postMessage({
      type: 'upload-error',
      message: error.message || 'Form submission failed. Please try again.'
    }, '*');
  }
}
```

---

### 9. `renew-session`

**When:** User clicks "Renew Session" button in expiry warning overlay.

**Message:**
```javascript
{
  type: 'renew-session'
}
```

**Parent Action:**
1. Generate new session token
2. Return via `session-updated` message

**Example Implementation:**
```javascript
import { updateSession } from 'public/sdlt-requests/helpers.js';

export async function handleRenewSession() {
  try {
    const { newAuth, newToken } = await updateSession();
    
    // Send updated session to iframe
    iframe.contentWindow.postMessage({
      type: 'session-updated',
      authCode: newAuth,
      token: newToken
    }, '*');
  } catch (error) {
    console.error('Session renewal failed:', error);
  }
}
```

---

### 10. `cancel-submission`

**When:** User clicks "Cancel Submission" button in expiry warning overlay.

**Message:**
```javascript
{
  type: 'cancel-submission'
}
```

**Parent Action:**
- Handle cancellation (e.g., redirect, close iframe, clear session)

---

### 11. `session-expiry`

**When:** Session countdown reaches 0 without renewal.

**Message:**
```javascript
{
  type: 'session-expiry'
}
```

**Parent Action:**
- Handle session expiry (e.g., redirect to login, show error)

---

## Messages FROM Parent to Iframe

These are messages the parent sends that the iframe handles.

### 1. `submitter-data`

**When:** Parent wants to prefill the "Your details" section.

**Message:**
```javascript
{
  type: 'submitter-data',
  data: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+447700900123',
    phoneCountryCode: '+44',
    countryCode: 'GB'
    // Note: dwellworksReference is NOT included
  }
}
```

**Example Implementation:**
```javascript
// In Wix frontend code
const iframe = $w('#dwellworksRequestForm');

iframe.postMessage({
  type: 'submitter-data',
  data: {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    phoneCountryCode: user.phoneCountryCode,
    countryCode: user.countryCode
  }
});
```

---

### 2. `address-results`

**When:** Response to `address-search` message.

**Message:**
```javascript
{
  type: 'address-results',
  suggestions: [
    {
      id: 'gid://getAddress.io/Address/12345',
      formatted_address: '123 Baker Street, London, W1U 6SB',
      description: '123 Baker Street, London, W1U 6SB'
    }
    // ... more suggestions
  ],
  field: 'sdlt' | 'previous'
}
```

---

### 3. `address-data`

**When:** Response to `address-lookup` message.

**Message:**
```javascript
{
  type: 'address-data',
  address: {
    // Thirdfort format address object
    flat_number: '1',
    building_number: '123',
    building_name: undefined,
    street: 'Baker Street',
    sub_street: undefined,
    town: 'London',
    postcode: 'W1U 6SB',
    country: 'GBR'
  },
  field: 'sdlt' | 'previous'
}
```

---

### 4. `company-results`

**When:** Response to `company-search` message.

**Message:**
```javascript
{
  type: 'company-results',
  companies: [
    {
      title: 'ACME CORPORATION LIMITED',
      company_number: '12345678',
      company_status: 'active',
      company_type: 'ltd'
    }
    // ... more companies
  ],
  byNumber: false
}
```

---

### 5. `company-data`

**When:** Response to `company-lookup` message.

**Message:**
```javascript
{
  type: 'company-data',
  company: {
    title: 'ACME CORPORATION LIMITED',
    company_number: '12345678',
    company_status: 'active',
    company_type: 'ltd',
    date_of_creation: '2020-01-01',
    registered_office_address: {
      address_line_1: '123 Business Street',
      locality: 'London',
      postal_code: 'SW1A 1AA',
      country: 'England'
    }
    // ... other relevant fields
  }
}
```

---

### 6. `put-links`

**When:** Response to `file-data` message (success).

**Message:**
```javascript
{
  type: 'put-links',
  links: [
    'https://s3.amazonaws.com/bucket/file.pdf?X-Amz-Algorithm=...',
    // ... more PUT URLs
  ],
  s3Keys: [
    {
      name: 'lease.pdf',
      size: 1024000,
      type: 'application/pdf',
      s3Key: 'sdlt-documents/lease-123.pdf',
      document: 'Lease Agreement',
      description: undefined,
      uploader: 'User',
      date: '15/12/2023, 14:30:45',
      isLease: true,
      isAdditional: false,
      docId: undefined
    }
    // ... more file objects
  ]
}
```

---

### 7. `put-error`

**When:** Response to `file-data` message (failure).

**Message:**
```javascript
{
  type: 'put-error',
  message: 'Failed to generate upload links: Invalid file type'
}
```

---

### 8. `session-updated`

**When:** Response to `renew-session` message.

**Message:**
```javascript
{
  type: 'session-updated',
  authCode: 'new-auth-code',
  token: 'new-session-token'
}
```

---

### 9. `upload-error`

**When:** Response to `dwellworks-form-data` (failure).

**Message:**
```javascript
{
  type: 'upload-error',
  message: 'Failed to insert form data: Database error' || 'error: ...'
}
```

**Parent Action:** Send this if form submission/database insertion fails. The iframe will show the error and allow the user to retry.

---

## getAddress.io API Integration

This pattern is **reusable** from the ID system (`request-form.html`). The iframe sends `address-search` and `address-lookup` messages, and the parent handles the API calls.

### Setup

1. **Get API Key:** Sign up at https://www.getaddress.io/ and get your API key
2. **Store Secret:** Add `GETADDRESS_API_KEY` to Wix Secrets

### Implementation Pattern

```javascript
// backend/address-lookup.web.js
import { getSecret } from 'wix-secrets-backend';

export async function searchAddress(searchTerm) {
  const apiKey = await getSecret('GETADDRESS_API_KEY');
  
  const response = await fetch(
    `https://api.getAddress.io/autocomplete/${encodeURIComponent(searchTerm)}?api-key=${apiKey}`
  );
  
  if (!response.ok) {
    throw new Error(`getAddress.io API error: ${response.status}`);
  }
  
  return await response.json();
}

export async function lookupAddress(addressId) {
  const apiKey = await getSecret('GETADDRESS_API_KEY');
  
  const response = await fetch(
    `https://api.getAddress.io/get/${addressId}?api-key=${apiKey}`
  );
  
  if (!response.ok) {
    throw new Error(`getAddress.io API error: ${response.status}`);
  }
  
  return await response.json();
}

// Format getAddress.io response to Thirdfort standards
export function formatToThirdfort(getAddressData, country = 'GBR') {
  const address = getAddressData.address || getAddressData;
  
  return {
    flat_number: address.flat_number || undefined,
    building_number: address.building_number || undefined,
    building_name: address.building_name || undefined,
    street: address.line_1 || address.thoroughfare || undefined,
    sub_street: address.line_2 || address.dependent_thoroughfare || undefined,
    town: address.town_or_city || address.post_town || undefined,
    postcode: address.postcode || undefined,
    country: country
  };
}
```

### Frontend Message Handler

```javascript
// In your Wix page code
import { searchAddress, lookupAddress, formatToThirdfort } from 'backend/address-lookup.web.js';

$w.onReady(function () {
  const iframe = $w('#dwellworksRequestForm');
  
  window.addEventListener('message', async (event) => {
    // Verify origin for security
    if (event.origin !== 'https://your-domain.com') return;
    
    const message = event.data;
    
    if (message.type === 'address-search') {
      try {
        const results = await searchAddress(message.searchTerm);
        
        iframe.postMessage({
          type: 'address-results',
          suggestions: results.suggestions || [],
          field: message.field
        });
      } catch (error) {
        console.error('Address search failed:', error);
      }
    }
    
    if (message.type === 'address-lookup') {
      try {
        const addressData = await lookupAddress(message.addressId);
        const thirdfortAddress = formatToThirdfort(addressData);
        
        iframe.postMessage({
          type: 'address-data',
          address: thirdfortAddress,
          field: message.field
        });
      } catch (error) {
        console.error('Address lookup failed:', error);
      }
    }
  });
});
```

---

## Companies House API Integration

This pattern is **reusable** from the ID system (`request-form.html`). The iframe sends `company-search` and `company-lookup` messages, and the parent handles the API calls.

### Setup

1. **Get API Key:** Sign up at https://developer.company-information.service.gov.uk/ and get your API key
2. **Store Secret:** Add `COMPANIES_HOUSE_API_KEY` to Wix Secrets

### Implementation Pattern

```javascript
// backend/companies-house.web.js
import { getSecret } from 'wix-secrets-backend';

export async function searchCompany(searchTerm, byNumber = false) {
  const apiKey = await getSecret('COMPANIES_HOUSE_API_KEY');
  
  let url;
  if (byNumber) {
    // Search by company number
    url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}`;
  } else {
    // Search by company name
    url = `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchTerm)}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`
    }
  });
  
  if (!response.ok) {
    throw new Error(`Companies House API error: ${response.status}`);
  }
  
  return await response.json();
}

export async function lookupCompany(companyNumber) {
  const apiKey = await getSecret('COMPANIES_HOUSE_API_KEY');
  
  const response = await fetch(
    `https://api.company-information.service.gov.uk/company/${companyNumber}`,
    {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':')}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Companies House API error: ${response.status}`);
  }
  
  return await response.json();
}
```

### Frontend Message Handler

```javascript
// In your Wix page code
import { searchCompany, lookupCompany } from 'backend/companies-house.web.js';

$w.onReady(function () {
  const iframe = $w('#dwellworksRequestForm');
  
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'https://your-domain.com') return;
    
    const message = event.data;
    
    if (message.type === 'company-search') {
      try {
        const results = await searchCompany(message.searchTerm, message.byNumber);
        
        iframe.postMessage({
          type: 'company-results',
          companies: results.items || [],
          byNumber: message.byNumber
        });
      } catch (error) {
        console.error('Company search failed:', error);
      }
    }
    
    if (message.type === 'company-lookup') {
      try {
        const companyData = await lookupCompany(message.companyNumber);
        
        // Send full Companies House object
        iframe.postMessage({
          type: 'company-data',
          company: companyData  // Full API response object
        });
      } catch (error) {
        console.error('Company lookup failed:', error);
      }
    }
  });
});
```

---

## S3 PUT Link Generation

This pattern is **reusable** from the ID system. The iframe sends `file-data` with file metadata, and the parent generates S3 PUT links.

### Setup

1. **AWS Credentials:** Store AWS access key and secret in Wix Secrets
2. **S3 Bucket:** Use `sdlt-documents-prod-london` (or appropriate bucket name)
3. **Region:** Configure for your S3 region (e.g., `eu-west-2` for London)

### Implementation Pattern

```javascript
// backend/s3-upload.web.js
import { getSecret } from 'wix-secrets-backend';
import CryptoJS from 'crypto-js';

export async function generateS3PutLink(file, bucket = 'sdlt-documents-prod-london') {
  const accessKey = await getSecret('AWS_ACCESS_KEY_ID');
  const secretKey = await getSecret('AWS_SECRET_ACCESS_KEY');
  const region = 'eu-west-2'; // London region
  
  // Generate unique S3 key
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const s3Key = `${bucket}/${timestamp}-${randomId}-${file.name}`;
  
  // Generate presigned PUT URL
  const expiresIn = 3600; // 1 hour
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
  
  const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = date.substr(0, 8);
  
  const credential = `${accessKey}/${dateStamp}/${region}/s3/aws4_request`;
  
  const policy = {
    expiration: new Date(Date.now() + expiresIn * 1000).toISOString(),
    conditions: [
      { bucket: bucket },
      ['starts-with', '$key', ''],
      { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
      { 'x-amz-credential': credential },
      { 'x-amz-date': date },
      ['content-length-range', 0, 104857600] // 100MB max
    ]
  };
  
  const policyBase64 = btoa(JSON.stringify(policy));
  const signature = signPolicy(policyBase64, secretKey, dateStamp, region);
  
  const putUrl = `${url}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${date}&Policy=${encodeURIComponent(policyBase64)}&X-Amz-Signature=${signature}`;
  
  return {
    putUrl: putUrl,
    s3Key: s3Key
  };
}

function signPolicy(policy, secretKey, dateStamp, region) {
  const kDate = CryptoJS.HmacSHA256(dateStamp, 'AWS4' + secretKey);
  const kRegion = CryptoJS.HmacSHA256(region, kDate);
  const kService = CryptoJS.HmacSHA256('s3', kRegion);
  const kSigning = CryptoJS.HmacSHA256('aws4_request', kService);
  return CryptoJS.HmacSHA256(policy, kSigning).toString();
}
```

### Alternative: Using AWS SDK (if available in Velo)

```javascript
// backend/s3-upload.web.js
import { getSecret } from 'wix-secrets-backend';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function generateS3PutLink(file, bucket = 'sdlt-documents-prod-london') {
  const accessKey = await getSecret('AWS_ACCESS_KEY_ID');
  const secretKey = await getSecret('AWS_SECRET_ACCESS_KEY');
  const region = 'eu-west-2';
  
  const s3Client = new S3Client({
    region: region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey
    }
  });
  
  // Generate unique S3 key
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const s3Key = `${timestamp}-${randomId}-${file.name}`;
  
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: file.type
  });
  
  const putUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  
  return {
    putUrl: putUrl,
    s3Key: s3Key
  };
}
```

### Frontend Message Handler

```javascript
// In your Wix page code
import { generateS3PutLink } from 'backend/s3-upload.web.js';

$w.onReady(function () {
  const iframe = $w('#dwellworksRequestForm');
  
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'https://your-domain.com') return;
    
    const message = event.data;
    
    if (message.type === 'file-data') {
      try {
        // Determine bucket based on iframe context
        // For dwellworks-request-form, use sdlt-documents bucket
        const bucket = 'sdlt-documents-prod-london';  // or determine from iframe type
        
        const links = [];
        const s3Keys = [];
        
        for (const file of message.files) {
          const { putUrl, s3Key } = await generateS3PutLink(file, bucket);
          
          links.push(putUrl);
          s3Keys.push({
            ...file,
            s3Key: s3Key
          });
        }
        
        iframe.postMessage({
          type: 'put-links',
          links: links,
          s3Keys: s3Keys
        });
      } catch (error) {
        iframe.postMessage({
          type: 'put-error',
          message: error.message || 'Failed to generate upload links'
        });
      }
    }
  });
});
```

### Adapting for `sdlt-documents-prod-london` Bucket

Simply change the bucket name in the `generateS3PutLink` function:

```javascript
const { putUrl, s3Key } = await generateS3PutLink(file, 'sdlt-documents-prod-london');
```

Or make it configurable:

```javascript
const bucket = message.bucket || 'sdlt-documents-prod-london';
const { putUrl, s3Key } = await generateS3PutLink(file, bucket);
```

---

## Session Management

The iframe implements a 10-minute session countdown. When 60 seconds remain, it shows a warning overlay.

### Handling Session Renewal

```javascript
// backend/session-management.web.js
import { updateSession } from 'public/sdlt-requests/helpers.js';

export async function renewSession() {
  try {
    const { newAuth, newToken } = await updateSession();
    
    return {
      success: true,
      authCode: newAuth,
      token: newToken
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Frontend Message Handler

```javascript
// In your Wix page code
import { renewSession } from 'backend/session-management.web.js';

$w.onReady(function () {
  const iframe = $w('#dwellworksRequestForm');
  
  window.addEventListener('message', async (event) => {
    if (event.origin !== 'https://your-domain.com') return;
    
    const message = event.data;
    
    if (message.type === 'renew-session') {
      const result = await renewSession();
      
      if (result.success) {
        iframe.postMessage({
          type: 'session-updated',
          authCode: result.authCode,
          token: result.token
        });
      }
    }
    
    if (message.type === 'cancel-submission') {
      // Handle cancellation (e.g., redirect, close iframe)
      $w('#dwellworksRequestForm').collapse();
    }
    
    if (message.type === 'session-expiry') {
      // Handle session expiry (e.g., redirect to login)
      wixLocation.to('/login');
    }
  });
});
```

---

## Complete Example: Message Handler Setup

Here's a complete example of setting up all message handlers in your Wix page:

```javascript
// In your Wix page code
import { searchAddress, lookupAddress, formatToThirdfort } from 'backend/address-lookup.web.js';
import { searchCompany, lookupCompany } from 'backend/companies-house.web.js';
import { generateS3PutLink } from 'backend/s3-upload.web.js';
import { renewSession } from 'backend/session-management.web.js';
import { insertEntry } from 'backend/sdlt-requests/insert.web.js';

$w.onReady(function () {
  const iframe = $w('#dwellworksRequestForm');
  
  // Listen for messages from iframe
  window.addEventListener('message', async (event) => {
    // Verify origin for security
    if (event.origin !== 'https://your-domain.com') return;
    
    const message = event.data;
    
    // Address Search
    if (message.type === 'address-search') {
      try {
        const results = await searchAddress(message.searchTerm);
        iframe.postMessage({
          type: 'address-results',
          suggestions: results.suggestions || [],
          field: message.field
        });
      } catch (error) {
        console.error('Address search failed:', error);
      }
    }
    
    // Address Lookup
    if (message.type === 'address-lookup') {
      try {
        const addressData = await lookupAddress(message.addressId);
        const thirdfortAddress = formatToThirdfort(addressData);
        iframe.postMessage({
          type: 'address-data',
          address: thirdfortAddress,
          field: message.field
        });
      } catch (error) {
        console.error('Address lookup failed:', error);
      }
    }
    
    // Company Search
    if (message.type === 'company-search') {
      try {
        const results = await searchCompany(message.searchTerm, message.byNumber);
        iframe.postMessage({
          type: 'company-results',
          companies: results.items || [],
          byNumber: message.byNumber
        });
      } catch (error) {
        console.error('Company search failed:', error);
      }
    }
    
    // Company Lookup
    if (message.type === 'company-lookup') {
      try {
        const companyData = await lookupCompany(message.companyNumber);
        // Send full Companies House object
        iframe.postMessage({
          type: 'company-data',
          company: companyData  // Full API response object
        });
      } catch (error) {
        console.error('Company lookup failed:', error);
      }
    }
    
    // File Data (S3 PUT Links)
    if (message.type === 'file-data') {
      try {
        // Determine bucket based on iframe context
        // For dwellworks-request-form, use sdlt-documents bucket
        const bucket = 'sdlt-documents-prod-london';  // or determine from iframe type
        
        const links = [];
        const s3Keys = [];
        
        for (const file of message.files) {
          const { putUrl, s3Key } = await generateS3PutLink(file, bucket);
          links.push(putUrl);
          s3Keys.push({ ...file, s3Key: s3Key });
        }
        
        iframe.postMessage({
          type: 'put-links',
          links: links,
          s3Keys: s3Keys
        });
      } catch (error) {
        iframe.postMessage({
          type: 'put-error',
          message: error.message || 'Failed to generate upload links'
        });
      }
    }
    
    // Form Submission
    if (message.type === 'dwellworks-form-data') {
      try {
        const result = await insertEntry(message.formData);
        if (result.success) {
          console.log('Form submitted successfully:', result.submission_id);
          // Show success message or redirect
        } else {
          // Send error back to iframe so user can retry
          iframe.postMessage({
            type: 'upload-error',
            message: result.error || 'Failed to insert form data'
          });
        }
      } catch (error) {
        console.error('Error submitting form:', error);
        // Send error back to iframe so user can retry
        iframe.postMessage({
          type: 'upload-error',
          message: error.message || 'Form submission failed. Please try again.'
        });
      }
    }
    
    // Session Renewal
    if (message.type === 'renew-session') {
      const result = await renewSession();
      if (result.success) {
        iframe.postMessage({
          type: 'session-updated',
          authCode: result.authCode,
          token: result.token
        });
      }
    }
    
    // Cancel Submission
    if (message.type === 'cancel-submission') {
      iframe.collapse();
      // Or redirect, etc.
    }
    
    // Session Expiry
    if (message.type === 'session-expiry') {
      wixLocation.to('/login');
    }
  });
  
  // Optionally send submitter data when iframe is ready
  iframe.onMessage((event) => {
    if (event.data.type === 'iframe-ready') {
      // Prefill form with user data
      iframe.postMessage({
        type: 'submitter-data',
        data: {
          firstName: $w('#userFirstName').text,
          lastName: $w('#userLastName').text,
          email: $w('#userEmail').text,
          phone: $w('#userPhone').text
        }
      });
    }
  });
});
```

---

## Summary

This integration follows the same patterns used in the ID system (`request-form.html`):

1. **getAddress.io:** Reuse `address-search` → `address-results` and `address-lookup` → `address-data` pattern
2. **Companies House:** Reuse `company-search` → `company-results` and `company-lookup` → `company-data` pattern
3. **S3 Uploads:** Reuse `file-data` → `put-links` pattern, just change bucket to `sdlt-documents-prod-london`
4. **Session Management:** Handle `renew-session`, `cancel-submission`, and `session-expiry` messages

All message types and data structures are documented above. The iframe handles all UI logic; the parent only needs to handle API calls and database operations.

