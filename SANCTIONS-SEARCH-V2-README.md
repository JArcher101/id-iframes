# FCDO Sanctions Search V2 - XML Version

## ✅ What Was Fixed

The original `sanctions-search.html` was **broken** due to:
1. **Syntax Error**: Pasting large HTML content directly into a JavaScript template literal caused parsing errors
2. **File Size**: The embedded HTML data made the file 2.9M tokens
3. **Special Characters**: HTML content contained backticks, quotes, and special characters that broke JavaScript

## 🔧 Solution: XML Format

The new `sanctions-search-v2.html` uses **XML format** instead of HTML:

### Benefits of XML:
- ✅ **Structured Data**: Proper XML elements are easier to parse than HTML divs
- ✅ **No Syntax Issues**: XML is embedded in `<script type="application/xml">` tag (safe)
- ✅ **Better Parsing**: `DOMParser` handles XML reliably
- ✅ **Cleaner Code**: No escaped quotes or special characters

### Backend Already Updated:
The backend (`backend/utils/fcdo-sanctions-proxy.web.js`) is already fetching XML from:
```
https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml
```

## 📋 Key Features

### 1. XML Parsing
- Extracts `<Designation>` elements
- Parses names, DOB, regimes, addresses, positions
- Handles multiple name variations and aliases

### 2. Fuzzy Search
- **Levenshtein distance** algorithm for name matching
- **Configurable threshold** (75% similarity)
- **Multiple strategies**: full name, first+last, substring, exact

### 3. DOB Matching
- **Exact match**: Same year
- **Fuzzy match**: ±5 years tolerance
- **Optional**: Can search by name only

### 4. PDF Generation
- Uses **jsPDF** and **autoTable** plugin
- TH branding (blue header with logo)
- Search parameters and results table
- Footer with page numbers

### 5. S3 Upload Flow
- Same pattern as `document-viewer.html`
- Uses `postMessage` to communicate with parent
- Parent gets presigned URL from backend
- Iframe uploads PDF directly to S3

### 6. Mock Data Support
Set `USE_MOCK_DATA = true` and paste XML into:
```html
<script id="mockSanctionsXML" type="application/xml">
  <!-- Paste XML content here for testing -->
</script>
```

## 🧪 How to Test

### Option 1: Test with Mock Data

1. **Download XML sample**:
   - Go to: https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml
   - Save the XML file

2. **Enable mock mode**:
   ```javascript
   const USE_MOCK_DATA = true; // Line 429
   ```

3. **Paste XML content**:
   - Open the XML file in a text editor
   - Copy ALL content (including `<?xml version...>`)
   - Paste into the `<script id="mockSanctionsXML">` tag (line 14-16)

4. **Test search**:
   - Open `sanctions-search-v2.html` in browser
   - Should see "✅ Loaded X sanctions entries"
   - Try searching for names from the list

### Option 2: Test with Live Backend

1. **Make sure backend is deployed**:
   - `backend/utils/fcdo-sanctions-proxy.web.js` should be live
   - Function: `getFCDOSanctionsHTML`

2. **Integrate with parent page**:
   - Parent should handle these messages:
     - `request-sanctions-client-data` → send client name/DOB
     - `request-sanctions-xml` → call backend, send XML
     - `request-s3-upload-url` → get presigned URL
     - `sanctions-search-complete` → handle completion

3. **Test flow**:
   - Open iframe from Wix lightbox
   - Should load XML from backend
   - Search for client name
   - Generate PDF
   - Upload to S3

## 🔄 Migration Steps

### If V2 Works Perfectly:

1. **Backup old file** (optional):
   ```bash
   mv sanctions-search.html sanctions-search-OLD-BROKEN.html
   ```

2. **Replace with V2**:
   ```bash
   mv sanctions-search-v2.html sanctions-search.html
   ```

3. **Update parent page** (if iframe path changed):
   - Make sure parent opens correct iframe URL

4. **Test in production**:
   - Open from Wix
   - Search for real client
   - Verify PDF generation
   - Check S3 upload

### If You Want to Keep Both:

- Keep `sanctions-search-v2.html` as the new version
- Update parent page to open the new file
- Delete old broken file later

## 🎨 Customization

### Fonts (Currently Empty):
You mentioned you'll copy in the base64 font strings:
- Lines 29-36: Transport Medium
- Lines 39-45: Rotis Regular
- Lines 48-54: Rotis Italic
- Lines 57-63: Rotis Bold

### Colors:
```css
--primary: rgb(0, 60, 113);  /* TH Blue */
--tan: #D4A574;              /* TH Tan */
```

### Fuzzy Search Threshold:
```javascript
const fuzzyThreshold = 0.75; // Line 698 (75% similarity required)
```

### Fuzzy DOB Range:
```javascript
Math.abs(searchYear - entryYear) <= 5 // Line 745 (±5 years)
```

## 📊 XML Structure

The FCDO XML has this structure:
```xml
<SanctionsList>
  <Designation>
    <uniqueID>AFG0001</uniqueID>
    <entityType>Individual</entityType>
    <Regime>
      <regimeName>...</regimeName>
      <sanctionsImposed>...</sanctionsImposed>
      <dateDesignated>...</dateDesignated>
    </Regime>
    <name>
      <name1>First</name1>
      <name2>Middle</name2>
      <name6>Last</name6>
      <nameType>Primary Name</nameType>
    </name>
    <dob>01/01/1980</dob>
    <address>...</address>
    <position>...</position>
  </Designation>
</SanctionsList>
```

## 🐛 Troubleshooting

### "Sanctions list not loaded"
- Check browser console for errors
- If using mock data: verify XML is pasted correctly
- If using backend: check network tab for API call

### "No matches found" (but should find)
- Try enabling fuzzy search
- Check if name spelling is close
- Verify DOB format (YYYY-MM-DD for input)

### "Failed to parse XML"
- Check XML is valid (no HTML entities mixed in)
- Ensure `<?xml version="1.0"?>` is at the top
- Try validating XML online first

### PDF generation fails
- Check browser console
- Verify jsPDF libraries loaded (lines 10-11)
- Check if `window.jspdf` exists

### S3 upload fails
- Check parent is listening for messages
- Verify presigned URL is correct
- Check CORS settings on S3 bucket

## 📝 Notes

- **Cache**: Backend caches XML for 24 hours (reduces load on FCDO)
- **Performance**: ~3000-4000 entries, search is fast (<1 second)
- **Regex Safety**: XML parsing uses DOM methods (no regex injection)
- **Mobile Responsive**: Layout adjusts for small screens

## 🚀 Next Steps

1. Test with mock data first
2. Test with live backend
3. Integrate with parent page
4. Test end-to-end flow
5. Replace old broken file
6. Copy in custom fonts (base64 strings)

---

**Status**: ✅ Ready for testing
**File**: `sanctions-search-v2.html`
**Backend**: `backend/utils/fcdo-sanctions-proxy.web.js` (already updated)

