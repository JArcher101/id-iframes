# Dwellworks Request Form - Message Reference

Quick reference guide for all messages between the iframe and parent.

---

## Messages FROM Iframe to Parent

### 1. `iframe-ready`
**When:** Iframe loads and is ready

**Message:**
```javascript
{
  type: 'iframe-ready',
  iframeType: 'dwellworks-request-form'
}
```

**Parent Action:** 
- Store iframe reference
- Optionally send `submitter-data` to prefill form

---

### 2. `address-search`
**When:** User types in address field (debounced 300ms)

**Message:**
```javascript
{
  type: 'address-search',
  searchTerm: '123 Baker Street',
  field: 'sdlt' | 'previous'
}
```

**Parent Action:**
1. Call getAddress.io API with `searchTerm`
2. Send `address-results` back to iframe

---

### 3. `address-lookup`
**When:** User selects address from dropdown

**Message:**
```javascript
{
  type: 'address-lookup',
  addressId: 'gid://getAddress.io/Address/12345',
  field: 'sdlt' | 'previous'
}
```

**Parent Action:**
1. Call getAddress.io API to get full address using `addressId`
2. Format to Thirdfort standards
3. Send `address-data` back to iframe

---

### 4. `company-search`
**When:** User types in employer name/number field (debounced 300ms, UK only)

**Message:**
```javascript
{
  type: 'company-search',
  searchTerm: 'Acme Corporation',
  byNumber: false  // true if searching by company number
}
```

**Parent Action:**
1. Call Companies House API with `searchTerm`
2. Send `company-results` back to iframe

---

### 5. `company-lookup`
**When:** User selects company from dropdown or clicks refresh

**Message:**
```javascript
{
  type: 'company-lookup',
  companyNumber: '12345678'
}
```

**Parent Action:**
1. Call Companies House API to get full company details
2. Send `company-data` back to iframe

---

### 6. `file-data`
**When:** Form submitted, files need S3 upload links

**Message:**
```javascript
{
  type: 'file-data',
  files: [
    {
      name: 'lease.pdf',
      size: 1024000,
      type: 'application/pdf',
      document: 'Lease Agreement',
      description: undefined,
      uploader: 'User',
      date: '15/12/2023, 14:30:45',
      isLease: true,
      isAdditional: false,
      docId: undefined
    }
  ]
}
```

**Parent Action:**
1. Determine S3 bucket based on iframe context (should use `sdlt-documents` or `sdlt-documents-prod-london` for this iframe)
2. Generate S3 PUT links for each file
3. Send `put-links` (success) or `put-error` (failure) back to iframe

---

### 7. `dwellworks-form-data`
**When:** Form submission complete, all files uploaded

**Message:**
```javascript
{
  type: 'dwellworks-form-data',
  formData: {
    // Status
    status: ["New Submission"],
    
    // Your Details
    submitterFirstName: 'John',
    submitterLastName: 'Doe',
    dwellworksReference: 'REF123',
    dwellworksContactNumber: '+447700900123',
    dwellworksEmail: 'john@example.com',
    sharedEmail: 'share@example.com' || undefined,
    
    // Tenant Details
    tenantsFirstName: 'Jane',
    tenantLastName: 'Smith',
    tenantDateOfBirth: '01/01/1990' || undefined,
    tenantsMobileNumber: '+447700900456',
    tenantsEmail: 'jane@example.com' || undefined,
    
    // SDLT Address and Move-in Date
    sdltAddress: {
      flat_number: '1' || undefined,
      building_number: '123' || undefined,
      building_name: undefined,
      street: 'Baker Street',
      sub_street: undefined,
      town: 'London',
      postcode: 'W1U 6SB',
      country: 'GBR'
    } || undefined,
    ukMoveInDate: '2024-01-15' || undefined,
    tenantsPreviousAddress: {
      flat_number: '2' || undefined,
      building_number: '456' || undefined,
      building_name: undefined,
      street: 'Old Street',
      sub_street: undefined,
      town: 'London',
      postcode: 'EC1V 9AB',
      country: 'GBR'
    } || undefined,
    
    // Second Tenant
    secondTenant: true || false,
    secondTenantFirstName: 'Bob' || undefined,
    secondTenantLastName: 'Jones' || undefined,
    secondTenantDateOfBirth: '15/05/1985' || undefined,
    secondTenantMobile: '+447700900789' || undefined,
    secondTenantEmail: 'bob@example.com' || undefined,
    
    // Employers Details
    tenantsEmployer: 'ACME Corporation',
    employersCountryOfRegistration: 'United Kingdom',
    employersRegistrationNumber: '12345678',
    companyData: {
      title: 'ACME CORPORATION LIMITED',
      company_number: '12345678',
      company_status: 'active',
      company_type: 'ltd',
      date_of_creation: '2020-01-01',
      registered_office_address: {
        address_line_1: '123 Business Street',
        address_line_2: undefined,
        locality: 'London',
        postal_code: 'SW1A 1AA',
        country: 'England'
      },
      // ... full Companies House API response object
    } || undefined,  // Only present if UK company
    
    // Lease
    lessee: 'tenant' || 'tenants-employer' || 'dwellworks' || 'other' || undefined,
    lesseeOther: 'John Company Ltd' || undefined,
    lesseeDateOfBirthEntityNumber: '01/01/1980' || '12345678' || undefined,
    lesseePhoneNumber: '+447700900111' || undefined,
    lesseeEmail: 'lessee@example.com' || undefined,
    lesseeRelationToTenant: 'Parent Company' || undefined,
    leaseAgreement: {
      name: 'lease.pdf',
      size: 1024000,
      type: 'application/pdf',
      s3Key: 'sdlt-documents/lease-123.pdf'
    } || undefined,
    leaseAgreementNote: 'Additional lease notes' || undefined,
    
    // Legal Fee (THS Fee)
    thsFeePayer: 'tenant' || 'tenant-employer' || 'dwellworks' || 'other' || undefined,
    thsFeePayerOther: 'Other Company Ltd' || undefined,
    thsFeePayerDateOfBirthEntityNumber: '01/01/1975' || '87654321' || undefined,
    thsFeePayerPhoneNumber: '+447700900222' || undefined,
    thsFeePayerEmail: 'payer@example.com' || undefined,
    thsFeePayerRelationToTenant: 'Sister Company' || undefined,
    thsFeesInvoiceSending: 'yes' || 'no' || undefined,
    thsFeeEmployersAcocuntsEmail: 'accounts@employer.com' || undefined,
    thsFeeEmployersAccountsContactName: 'Accounts Department' || undefined,
    
    // SDLT Fee
    sdltFeePayer: 'tenant' || 'tenant-employer' || 'dwellworks' || 'other' || undefined,
    sdltFeePayerOther: 'SDLT Company Ltd' || undefined,
    sdltFeePayerDateOfBirthEntityNumber: '01/01/1970' || '11223344' || undefined,
    sdltFeePayerEmail: 'sdlt@example.com' || undefined,
    sdltFeePayerPhone: '+447700900333' || undefined,
    sdltFeePayerRelationToTenant: 'Related Entity' || undefined,
    sdltFeeInvoiceSending: 'yes' || 'no' || undefined,
    sdltFeeEmployerDetailsMatchThsLlpFeePayer: true || false || undefined,
    sdltFeeEmployersAccountContactName: 'SDLT Accounts' || undefined,
    sdltFeeEmployersAccountEmail: 'sdlt-accounts@employer.com' || undefined,
    
    // Additional Details
    note: 'Additional information' || undefined,
    
    // Documents
    addSupportingDocuments: true || false,
    sdltDocuments: [
      {
        name: 'doc1.pdf',
        size: 512000,
        type: 'application/pdf',
        s3Key: 'sdlt-documents/doc1-123.pdf',
        document: 'Supporting Document',
        description: 'Additional info' || undefined,
        uploader: 'User',
        date: '15/12/2023, 14:30:45'
      }
    ] || [],
    
    // Confirmations
    privacyPolicy: true,
    gdprIndividualsAgreement: true,
    terms: true
  }
}
```

**Parent Action:**
1. Save form data to Wix database
2. Handle success/error response

**Note:** All fields are always present in the object, even if their value is `undefined`. This ensures consistent data structure for database operations.

---

### 8. `renew-session`
**When:** User clicks "Renew Session" in expiry warning

**Message:**
```javascript
{
  type: 'renew-session'
}
```

**Parent Action:**
1. Generate new session token
2. Send `session-updated` back to iframe

---

### 10. `cancel-submission`
**When:** User clicks "Cancel Submission" in expiry warning

**Message:**
```javascript
{
  type: 'cancel-submission'
}
```

**Parent Action:**
- Handle cancellation (close iframe - page will auto refresh user submissions and renew session token)

---

### 11. `session-expiry`
**When:** Session countdown reaches 0 without renewal

**Message:**
```javascript
{
  type: 'session-expiry'
}
```

**Parent Action:**
- Handle session expiry (redirect to login)

---

## Messages FROM Parent to Iframe

### 1. `submitter-data`
**When:** Parent wants to prefill "Your details" section

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
  }
}
```

**Parent Action:** Send this message to prefill form (optional)

---

### 2. `address-results`
**When:** Response to `address-search`

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
  ],
  field: 'sdlt' | 'previous'
}
```

**Parent Action:** Send this after calling getAddress.io search API

---

### 3. `address-data`
**When:** Response to `address-lookup`

**Message:**
```javascript
{
  type: 'address-data',
  address: {
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

**Parent Action:** Send this after calling getAddress.io lookup API and formatting to Thirdfort standards

---

### 4. `company-results`
**When:** Response to `company-search`

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
  ],
  byNumber: false
}
```

**Parent Action:** Send this after calling Companies House search API

---

### 5. `company-data`
**When:** Response to `company-lookup`

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
  }
}
```

**Parent Action:** Send this after calling Companies House lookup API

---

### 6. `put-links`
**When:** Response to `file-data` (success)

**Message:**
```javascript
{
  type: 'put-links',
  links: [
    'https://s3.amazonaws.com/bucket/file.pdf?X-Amz-Algorithm=...'
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
  ]
}
```

**Parent Action:** Send this after generating S3 PUT links. Arrays must match in length and order.

---

### 7. `put-error`
**When:** Response to `file-data` (failure)

**Message:**
```javascript
{
  type: 'put-error',
  message: 'Failed to generate upload links: Invalid file type'
}
```

**Parent Action:** Send this if S3 PUT link generation fails

---

### 8. `session-updated`
**When:** Response to `renew-session`

**Message:**
```javascript
{
  type: 'session-updated',
  authCode: 'new-auth-code',
  token: 'new-session-token'
}
```

**Parent Action:** Send this after generating new session token

---

### 9. `upload-error`
**When:** Response to `dwellworks-form-data` (failure)

**Message:**
```javascript
{
  type: 'upload-error',
  message: 'Failed to insert form data: Database error' || 'error: ...'
}
```

**Parent Action:** Send this if form submission/database insertion fails

---

### 9. `upload-error`
**When:** Response to `dwellworks-form-data` (failure)

**Message:**
```javascript
{
  type: 'upload-error',
  message: 'Failed to insert form data: Database error' || 'error: ...'
}
```

**Parent Action:** Send this if form submission/database insertion fails

---

## Message Flow Summary

### Address Autocomplete Flow
1. Iframe → `address-search` → Parent
2. Parent → `address-results` → Iframe
3. Iframe → `address-lookup` → Parent
4. Parent → `address-data` → Iframe

### Company Search Flow
1. Iframe → `company-search` → Parent
2. Parent → `company-results` → Iframe
3. Iframe → `company-lookup` → Parent
4. Parent → `company-data` → Iframe

### File Upload Flow
1. Iframe → `file-data` → Parent
2. Parent → `put-links` (or `put-error`) → Iframe
3. Iframe uploads files to S3 using PUT links
4. Iframe → `dwellworks-form-data` → Parent

### Session Management Flow
1. Iframe → `renew-session` → Parent
2. Parent → `session-updated` → Iframe

Or:

1. Iframe → `cancel-submission` → Parent
2. Iframe → `session-expiry` → Parent

---

## Notes

- All messages use `window.postMessage()` with `'*'` origin (verify origin in production)
- File objects cannot be serialized in `file-data` message - only metadata is sent
- S3 bucket name is `sdlt-documents` (or `sdlt-documents-prod-london` for production)
- Address format must match Thirdfort standards (see full integration guide)
- All API integrations (getAddress.io, Companies House) are reusable from ID system

