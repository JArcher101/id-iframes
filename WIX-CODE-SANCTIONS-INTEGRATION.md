# Wix Code for Request Form Sanctions Integration

## Files Modified (Already Committed)
- &#x2705; `js/request-form-core.js` - Request form sends sanctions-check-request to parent
- &#x2705; `frontend-sanctions-integration.js` - Passes returnToRequest flag
- &#x2705; `backend-sanctions-integration.web.js` - Returns uploadedFile object
- &#x2705; `uk-sanctions-checker.html` - Stores and passes returnToRequest flag

## Wix Code Changes Needed

### 1. Add to `handleIframeMessage()` in `request.js`

Add this new case to handle sanctions check requests from request form:

```javascript
case 'sanctions-check-request':
    await requestSanctionsCheck(message);
    break;
```

### 2. Complete `requestSanctionsCheck()` in `request.js`

Fill in your started function:

```javascript
export async function requestSanctionsCheck(message) {
    $w('#loadingSwirl-v2-lightbox').show();
    $w('#lightboxTitle').text = "UK Sanctions Search Tool";
    $w('#states').changeState("Sanctions");
    
    // Build context object for sanctions checker
    const context = {
        clientData: {
            clientName: message.clientName,  // Already formatted by request form
            yearOfBirth: message.yearOfBirth,
            searchType: message.searchType    // 'individual' or 'entity'
        },
        openEntryId: message.entryId,
        currentUser: {
            email: await session.getItem('userEmail')
        },
        returnToRequest: true  // Flag to return to request form after upload
    };
    
    // Reuse existing initiateSanctions() function
    await initiateSanctions(context);
    
    $w('#loadingSwirl-v2-lightbox').hide();
}
```

### 3. Complete `returnToRequest()` in `request.js`

Fill in your started function:

```javascript
export async function returnToRequest(uploadedFile) {
    $w('#loadingSwirl-v2-lightbox').show();
    $w('#lightboxTitle').text = "New Note, Request or Update";
    $w('#states').changeState("Request");
    
    // Send full file object to request form iframe
    $w('#iframeRequest').postMessage({
        type: 'sanctions-file-uploaded',
        s3Key: uploadedFile.s3Key,
        liveUrl: uploadedFile.liveUrl,
        date: uploadedFile.date,
        uploader: uploadedFile.uploader,
        fileName: uploadedFile.fileName,
        fileSize: uploadedFile.fileSize
    });
    
    $w('#loadingSwirl-v2-lightbox').hide();
    console.log('&#x2705; Returned to request form with file object');
}
```

### 4. Update Sanctions `onMessage` Handler

Modify the `upload-success` case to check for returnToRequest flag:

```javascript
case 'upload-success':
    // Update entry with uploaded sanctions PDF
    const updateRes = await handleUploadSuccess(message);
    
    // Check if we need to return to request form
    if (message.returnToRequest && updateRes?.uploadedFile) {
        await returnToRequest(updateRes.uploadedFile);
    }
    break;
```

## Complete Message Flow

```
1. User clicks "OFSI Search" button in request form
   &#x2193;
2. Request Form iframe &#x2192; Parent
   Message: 'sanctions-check-request'
   Data: { clientName, yearOfBirth, searchType, entryId, returnToRequest: true }
   &#x2193;
3. Parent: requestSanctionsCheck()
   - Switches lightbox to "Sanctions" state
   - Calls initiateSanctions(context) with returnToRequest: true
   &#x2193;
4. Parent &#x2192; Sanctions Iframe
   Message: 'init-sanctions-search'
   Data: { clientName, yearOfBirth, searchType, clientEntryId, userEmail, returnToRequest: true }
   &#x2193;
5. User performs sanctions search and generates PDF
   &#x2193;
6. Sanctions Iframe uploads PDF to S3
   &#x2193;
7. Sanctions Iframe &#x2192; Parent
   Message: 'upload-success'
   Data: { files, _id, uploader, returnToRequest: true }
   &#x2193;
8. Parent: handleUploadSuccess()
   - Backend saves PDF to entry's idDocuments array
   - Backend returns uploadedFile object { s3Key, liveUrl, date, uploader, fileName, fileSize }
   &#x2193;
9. Parent: returnToRequest(uploadedFile)
   - Switches lightbox back to "Request" state
   &#x2193;
10. Parent &#x2192; Request Form Iframe
    Message: 'sanctions-file-uploaded'
    Data: { s3Key, liveUrl, date, uploader, fileName, fileSize }
    &#x2193;
11. Request Form: handleSanctionsFileUploaded()
    - Adds file object to idDocuments array
    - Updates OFSI UI to show uploaded document
    - Re-evaluates validation (OFSI requirement now met)
```

## Key Benefits

- &#x2705; Request form state preserved (no refresh, no data loss)
- &#x2705; PDF automatically uploaded to entry
- &#x2705; Request form immediately recognizes OFSI upload
- &#x2705; Validation automatically updates
- &#x2705; Seamless user experience

## Testing Steps

1. Open request form with client data
2. Fill in some fields (to verify state preservation)
3. Click "OFSI Search" button
4. Verify lightbox switches to sanctions state
5. Perform search and generate PDF
6. Verify lightbox returns to request form state
7. Verify OFSI document card appears
8. Verify all previously entered data is still present
9. Verify request can now be submitted (OFSI requirement met)

