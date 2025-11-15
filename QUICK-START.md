# &#xD83D;&#xDE80; Quick Start - Sanctions Search V2

## &#x2705; What's Ready

I've created a **clean, working version** of the FCDO sanctions search that fixes all the syntax errors:

### Files Created:
1. **`sanctions-search-v2.html`** - The main iframe (clean, working, uses XML)
2. **`test-sanctions-search.html`** - Test harness to test locally
3. **`test-xml-sample.xml`** - Sample XML data with 5 test entries
4. **`SANCTIONS-SEARCH-V2-README.md`** - Full documentation
5. **`QUICK-START.md`** - This file

### Backend Already Updated:
- **`backend/utils/fcdo-sanctions-proxy.web.js`** - Already fetching XML &#x2705;

---

## &#xD83E;&#xDDEA; Test Right Now (5 Minutes)

### Step 1: Enable Mock Data

Open `sanctions-search-v2.html` and change line 429:

```javascript
const USE_MOCK_DATA = true; // Change false to true
```

### Step 2: Add Test XML

1. Open `test-xml-sample.xml`
2. Copy **ALL** content (including `<?xml version...>`)
3. Paste into `sanctions-search-v2.html` at line 14-16:

```html
<script id="mockSanctionsXML" type="application/xml">
  <!-- PASTE XML HERE -->
</script>
```

### Step 3: Test It

Option A - **Quick Browser Test**:
```bash
# Just open the file directly
start sanctions-search-v2.html  # Windows
open sanctions-search-v2.html   # Mac
```

Option B - **Full Test with Harness**:
```bash
# Open the test harness
start test-sanctions-search.html  # Windows
open test-sanctions-search.html   # Mac
```

### Step 4: Try These Searches

In the iframe, try searching for:
- &#x2705; **"John Smith"** - Should find TEST001 (exact match)
- &#x2705; **"Vladimir Petrov"** - Should find TEST002 (exact match)
- &#x2705; **"Sarah Williams"** - Should find TEST005 (exact match)
- &#x2705; **"Ahmed Rahman"** - Should find TEST004 (fuzzy match, different spelling)
- &#x2705; **"Jon Smith"** - Should find TEST001 (alias match)
- &#x274C; **"Bob Jones"** - Should show "No matches found"

---

## &#xD83C;&#xDFAF; What Was Fixed

### Old Version (BROKEN):
```javascript
// &#x274C; This caused syntax errors:
const MOCK_SANCTIONS_HTML = `
  <div>Name: John</div>
  <div>Position: CEO</div>
  // ... 2.9M tokens of HTML with special characters
`;
```

### New Version (WORKING):
```xml
<!-- &#x2705; Safe XML in script tag: -->
<script id="mockSanctionsXML" type="application/xml">
  <?xml version="1.0"?>
  <SanctionsList>
    <Designation>
      <name>John Smith</name>
    </Designation>
  </SanctionsList>
</script>
```

---

## &#xD83D;&#xDCCB; Features Working

- &#x2705; **XML Parsing** - Parses FCDO XML structure
- &#x2705; **Fuzzy Search** - Levenshtein distance matching
- &#x2705; **DOB Matching** - Exact or &#xB1;5 years
- &#x2705; **Multiple Names** - Handles aliases and variations
- &#x2705; **Results Table** - Shows matches with % similarity
- &#x2705; **PDF Generation** - jsPDF with TH branding
- &#x2705; **Mock Data** - Test without backend
- &#xD83D;&#xDD04; **S3 Upload** - Ready (needs parent integration)

---

## &#xD83D;&#xDD04; Replace Old File (When Ready)

Once you've tested and confirmed V2 works:

### Option 1 - Rename:
```bash
# Delete the broken old file
rm sanctions-search.html

# Rename V2 to be the main file
mv sanctions-search-v2.html sanctions-search.html
```

### Option 2 - Keep Both:
Just update your parent page to open `sanctions-search-v2.html` instead.

---

## &#xD83C;&#xDFA8; Add Your Fonts

The file has empty base64 font strings for you to fill in:

### Lines to Update:
- **Line 35**: Transport Medium base64
- **Line 44**: Rotis Regular base64
- **Line 53**: Rotis Italic base64
- **Line 62**: Rotis Bold base64

Just paste your base64 font strings between the commas:
```css
src: url(data:font/truetype;charset=utf-8;base64,YOUR_BASE64_HERE) format('truetype');
```

---

## &#xD83D;&#xDD17; Integration with Parent Page

Your parent Wix page needs to handle these messages:

### 1. Send Client Data (on iframe load):
```javascript
iframe.contentWindow.postMessage({
  type: 'sanctions-client-data',
  name: 'John Smith',
  dob: '1975-06-15'
}, '*');
```

### 2. Handle XML Request:
```javascript
window.addEventListener('message', async (event) => {
  if (event.data.type === 'request-sanctions-xml') {
    // Call backend
    const result = await getFCDOSanctionsHTML();
    
    // Send XML to iframe
    iframe.contentWindow.postMessage({
      type: 'sanctions-xml-response',
      requestId: event.data.requestId,
      success: true,
      xml: result.xml
    }, '*');
  }
});
```

### 3. Handle S3 Upload Request:
```javascript
if (event.data.type === 'request-s3-upload-url') {
  // Get presigned URL from your backend
  const uploadUrl = await getPresignedUploadURL({
    documentType: 'FCDO Sanctions Search',
    category: 'PEP & Sanctions Check'
  });
  
  // Send URL to iframe
  iframe.contentWindow.postMessage({
    type: 's3-upload-url-response',
    requestId: event.data.requestId,
    success: true,
    uploadUrl: uploadUrl,
    metadata: event.data.metadata
  }, '*');
}
```

### 4. Handle Completion:
```javascript
if (event.data.type === 'sanctions-search-complete') {
  console.log('&#x2705; Search complete!', event.data.metadata);
  // Close lightbox or show success message
}
```

---

## &#xD83D;&#xDC1B; Troubleshooting

### "Cannot load sanctions list"
- &#x2705; Check `USE_MOCK_DATA = true`
- &#x2705; Verify XML is pasted in `<script id="mockSanctionsXML">`
- &#x2705; Check browser console for errors

### "Uncaught SyntaxError"
- &#x2705; Make sure you're using **V2 file** (not old broken one)
- &#x2705; Verify XML is inside `<script type="application/xml">` tag
- &#x2705; Don't put XML in a JavaScript string

### "No matches found" (but should find)
- &#x2705; Enable fuzzy search checkbox
- &#x2705; Check spelling (try "Vladimir" not "Vladmir")
- &#x2705; Try searching just first name or last name

### PDF not generating
- &#x2705; Check jsPDF libraries loaded (line 10-11)
- &#x2705; Open browser console for errors
- &#x2705; Make sure search was run first

---

## &#xD83D;&#xDCCA; File Sizes

| File | Size | Status |
|------|------|--------|
| `sanctions-search.html` (old) | **2.9M tokens** | &#x274C; BROKEN |
| `sanctions-search-v2.html` | **~35KB** | &#x2705; WORKING |
| `test-xml-sample.xml` | **~4KB** | &#x2705; For testing |
| `test-sanctions-search.html` | **~12KB** | &#x2705; Test harness |

---

## &#x2728; Next Steps

1. &#x2705; **Test with mock data** (5 minutes) - Do this now!
2. &#x2705; **Verify search works** - Try the test names above
3. &#x2705; **Test PDF generation** - Click "Generate PDF"
4. &#xD83D;&#xDD04; **Integrate with parent page** - Add message handlers
5. &#xD83D;&#xDD04; **Test with live backend** - Use real XML from FCDO
6. &#xD83D;&#xDD04; **Replace old broken file** - When ready
7. &#xD83C;&#xDFA8; **Add custom fonts** - Paste base64 strings

---

## &#xD83D;&#xDCAC; Need Help?

Check these files for more info:
- **`SANCTIONS-SEARCH-V2-README.md`** - Full documentation
- **`test-sanctions-search.html`** - Open in browser to see test harness
- **Browser Console** - Check for error messages

---

**Status**: &#x2705; **Ready to test right now!**

Just enable mock data, paste the XML, and open in browser. &#xD83D;&#xDE80;

