# CloudFront Custom Error Pages Setup

## ⚠️ Single Dynamic Error Page (Not Recommended - Query Params Don't Work)

**This approach does NOT work** because CloudFront Custom Error Responses strip query parameters.

### Why This Doesn't Work

1. **CloudFront strips query parameters** from Custom Error Response paths
2. When you configure `/error.html?code=403&type=id-documents`:
   - CloudFront fetches `/error.html` (parameters removed)
   - JavaScript never receives the `code` or `type` parameters
   - Error page shows "Unknown" for all errors
3. **This is a CloudFront limitation**, not a configuration issue

### The Problem

```
Error Code: 403
Response Page Path: /error.html?code=403&type=id-documents  ❌
HTTP Response Code: 403

CloudFront actually fetches: /error.html (params stripped!)
```

**See `aws-setup/CLOUDFRONT-ERROR-PARAMS-ISSUE.md` for detailed explanation and solutions.**

## ✅ Static Error Pages (Recommended - This Works!)

**Best Approach**: Use pre-generated static error pages with all content embedded.

### How It Works

1. **Build script generates static pages** in `error-pages/generated/`
2. **Each CDN has its own folder:**
   - `id-images/403.html`
   - `id-documents/403.html`
   - `sdlt-documents/403.html`
3. **CloudFront serves the correct static page:**
   - Error Code: 403 → `/id-images/403.html`
   - No query parameters needed!

### Benefits

- ✅ **Actually works** - No CloudFront query string issues
- ✅ **Pre-rendered** - All content is already in the HTML
- ✅ **No JavaScript parsing** - Faster page load
- ✅ **Better SEO** - Each error has a unique URL
- ✅ **Easy to maintain** - Update templates and rebuild

### CloudFront Configuration

Configure Custom Error Responses to use static paths:

```
Error Code: 403
Response Page Path: /id-images/403.html
HTTP Response Code: 403
Error Caching Minimum TTL: 300
```

**Important**: CloudFront Custom Error Responses do NOT preserve query strings. When you configure a response path like `/error.html?code=403&type=id-documents`, CloudFront strips the query parameters before fetching the error page. This is why we recommend using static error pages (e.g., `/id-images/403.html`) instead of dynamic parameters. See [AWS CloudFront documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages.html) for details.

### Setup Steps

1. **Add base64 font data** to `error.html`:
   - Replace `{{TRANSPORT_HEAVY_BASE64}}` with the Transport Heavy font base64
   - Replace `{{ROTIS_REGULAR_BASE64}}` with the Rotis Regular font base64
   - (You can copy these from `templates/id-documents-template.html`)

2. **Upload to S3**: Upload `error.html` to your CDN buckets:
   - `thurstan-hoskin-cdn-prod-london` (root of bucket)
   - `thurstan-hoskin-cdn-backup-frankfurt` (root of bucket)
   - The existing IAM permissions (`wixPreSignUser` and `s3-crr-role`) allow CloudFront to access `error.html` for Custom Error Responses

3. **Configure CloudFront**: Set up Custom Error Responses with query parameters (see below)

---

## The Problem

When S3 buckets are **private** and CloudFront requires **signed URLs**, there's a critical issue:

**If a signed URL is rejected (403 Forbidden), CloudFront needs to serve a custom error page. However, if the error pages are in the same private bucket, CloudFront cannot access them because the bucket blocks all public access.**

## Current Setup

- ✅ Origin Group: `id-images-prod-london` (primary) → `id-images-backup-frankfurt` (secondary)
- ✅ Both buckets are private (block all public access)
- ✅ CloudFront requires signed URLs for all requests
- ✅ Origin failover works for availability (503, 504, 502, 500 errors)
- ❌ **Problem**: Error pages in private buckets cannot be accessed by CloudFront when serving 403/404 errors
- ❌ **Problem**: Cannot add public bucket to origin group (would try to serve actual files from it when origins fail)

## Important: Origin Groups vs Custom Error Responses

**These are TWO SEPARATE features:**

1. **Origin Groups** - Handle failover when origins are **unavailable** (503, 504, 502, 500)
   - London fails → Frankfurt serves
   - Used for actual file requests
   - **DO NOT add error pages bucket here** - CloudFront would try to serve actual files from it!

2. **Custom Error Responses** - Handle specific HTTP error codes (403, 404, etc.)
   - When signed URL is rejected → serve custom error page
   - When file not found → serve custom error page
   - **This is where error pages bucket is used**

## Solution: Error Pages in Same Buckets with IAM Permissions

**Your setup uses IAM permissions to allow CloudFront access:**

1. **Keep origin group as-is** (London → Frankfurt for actual files)
2. **Upload `error.html` to both buckets** (`thurstan-hoskin-cdn-prod-london` and `thurstan-hoskin-cdn-backup-frankfurt`)
3. **Existing IAM permissions** (`wixPreSignUser` and `s3-crr-role`) allow CloudFront to access `error.html` for Custom Error Responses
4. **Configure Custom Error Responses** to point to `error.html` in the origin buckets

This way:
- ✅ Origin failover only affects actual file requests (London → Frankfurt)
- ✅ Error pages are served via Custom Error Responses from the same buckets
- ✅ CloudFront can access `error.html` via IAM permissions when serving error responses
- ✅ No separate bucket needed - error pages live alongside content

## Step-by-Step Setup

### Step 1: Upload error.html to Your CDN Buckets

1. **Upload `error.html` to both buckets:**
   - `thurstan-hoskin-cdn-prod-london` (root of bucket)
   - `thurstan-hoskin-cdn-backup-frankfurt` (root of bucket)

2. **Before uploading, replace placeholders in `error.html`:**
   - Replace `{{TRANSPORT_HEAVY_BASE64}}` with the Transport Heavy font base64
   - Replace `{{ROTIS_REGULAR_BASE64}}` with the Rotis Regular font base64
   - (You can copy these from `templates/id-documents-template.html`)

3. **IAM Permissions:**
   - Your existing IAM roles (`wixPreSignUser` and `s3-crr-role`) already allow CloudFront to access objects in these buckets
   - CloudFront will use these permissions when fetching `error.html` for Custom Error Responses
   - No additional bucket policy needed

### Step 2: Verify CloudFront Origin Access

**Your existing origins should already be configured:**

1. **CloudFront Console → Your Distribution → Origins tab**
2. **Verify your origin group includes:**
   - Primary: `thurstan-hoskin-cdn-prod-london`
   - Secondary: `thurstan-hoskin-cdn-backup-frankfurt`
3. **Origin access should be configured with OAC/OAI** that uses your IAM roles
4. **No changes needed** - CloudFront will access `error.html` using the same permissions

### Step 3: Configure Custom Error Responses

#### ✅ Option A: Static Error Pages per CDN (Recommended - This Works!)

1. **CloudFront Console → Your Distribution → Error Pages tab**
2. **Click "Create Custom Error Response"**
3. **Configure for each error code with static paths:**

   **For ID Documents CDN:**
   - **HTTP Error Code**: `403`
   - **Customize Error Response**: `Yes`
   - **Response Page Path**: `/id-documents/403.html`
   - **HTTP Response Code**: `403`
   - **Error Caching Minimum TTL**: `300`

   Repeat for all error codes (400, 404, 405, 414, 416, 500, 501, 502, 504)

   **For ID Images CDN:**
   - **Response Page Path**: `/id-images/403.html`
   - Example paths:
     - `/id-images/403.html`
     - `/id-images/404.html`
     - `/id-images/500.html`

   **For SDLT Documents CDN:**
   - **Response Page Path**: `/sdlt-documents/403.html`
   - Example paths:
     - `/sdlt-documents/403.html`
     - `/sdlt-documents/404.html`
     - `/sdlt-documents/500.html`

4. **Benefits:**
   - ✅ **Actually works** - No CloudFront query string issues
   - ✅ Pre-generated pages already exist in `error-pages/generated/`
   - ✅ All content (branding, icons, messages) is embedded
   - ✅ Faster than dynamic JavaScript rendering
   - ✅ Better caching - CloudFront can cache each error separately

#### ❌ Option B: Dynamic Error Page (Doesn't Work with CloudFront)

**This approach doesn't work** because CloudFront strips query parameters.

If you try to use `/error.html?code=403&type=id-images`:
- CloudFront fetches `/error.html` (removes parameters)
- JavaScript never receives `code` or `type`
- Error page shows "Unknown error"

**Why this limitation exists:**
- CloudFront Custom Error Responses fetch the error page from origin
- Query parameters are **always stripped** before the fetch
- This is CloudFront's design, not a bug
- No workaround exists using query parameters

**What works instead:**
- ✅ Use static error pages (Option A above)
- ✅ Use separate HTML files for each system/code combination
- ✅ Pre-generate all error pages with your build script

**If you need dynamic parameters:**
- Use Lambda@Edge (complex, expensive)
- Or encode parameters in the path: `/error-id-images-403.html`
- See `aws-setup/CLOUDFRONT-ERROR-PARAMS-ISSUE.md` for details

## How It Works

### Scenario 1: Invalid/Expired Signed URL (403)
1. User requests file with invalid signed URL
2. CloudFront tries origin group: London → returns 403 (invalid signature)
3. CloudFront sees 403 error code
4. **Custom Error Response triggers** → CloudFront fetches `/error.html?code=403&type=id-documents` from London bucket using IAM permissions
5. JavaScript in `error.html` reads parameters and renders appropriate error content
6. User sees custom error page ✅

### Scenario 2: File Not Found (404)
1. User requests file that doesn't exist
2. CloudFront tries origin group: London → returns 404 (file not found)
3. CloudFront sees 404 error code
4. **Custom Error Response triggers** → CloudFront fetches `/error.html?code=404&type=id-images` from London bucket using IAM permissions
5. JavaScript dynamically renders error page with image icon
6. User sees custom error page ✅

### Scenario 3: London & Frankfurt Both Down (503)
1. User requests file with valid signed URL
2. CloudFront tries origin group: London → 503 (unavailable)
3. CloudFront tries Frankfurt → 503 (unavailable)
4. Origin group returns 503 to CloudFront
5. **Custom Error Response triggers** → CloudFront fetches `/error.html?code=500&type=id-documents` from London bucket (or Frankfurt if London is down)
6. JavaScript renders error page
7. User sees custom error page ✅
8. **CloudFront does NOT try to serve actual files when using Custom Error Responses** ✅

### Scenario 4: Valid Request, Origins Available
1. User requests file with valid signed URL
2. CloudFront tries origin group: London → serves file successfully
3. No error response needed ✅

This is the simplest and most cost-effective solution:

### Updated Sync Script

Create a new sync script or update existing one to upload to the public error pages bucket:

```powershell
# New script: scripts/sync-error-pages-to-public-bucket.ps1
$ErrorPagesPath = "error-pages\generated"
$PublicBucket = "error-pages-public"  # Or separate buckets per CDN

# Upload all error pages to public bucket
aws s3 sync "$ErrorPagesPath" "s3://$PublicBucket/" --exclude "*" --include "*.html" --public-read
```

**Or organize by CDN:**
- `error-pages-public/id-images/400.html`
- `error-pages-public/id-documents/403.html`
- `error-pages-public/sdlt-documents/404.html`

## Testing

### Test 1: Invalid Signed URL
```bash
# This should return your custom 403 error page
curl https://id-images.thurstanhoskin.app/protected/invalid-file
```

### Test 2: Expired Signed URL
```bash
# Wait for URL to expire, then access
# Should return custom 403 error page
```

### Test 3: Missing Signature
```bash
# Access without signed URL parameters
curl https://id-images.thurstanhoskin.app/protected/some-file
# Should return custom 403 error page
```

## Important Notes

1. **DO NOT add error pages bucket to origin group** - This would cause CloudFront to try serving actual files from it when origins fail
2. **Error pages bucket must be public** - CloudFront cannot access private resources when serving error responses
3. **Separate origin, not in origin group** - Error pages origin is standalone, only used by Custom Error Responses
4. **Path must match** - The path in CloudFront Custom Error Response must match the S3 path in error pages bucket
5. **Cache behavior** - Set longer cache time for error pages (300+ seconds) - they don't change often
6. **CDN-specific pages** - You have different error pages for each CDN (id-images, id-documents, sdlt-documents), so:
   - Option A: One public bucket with subfolders (`/id-images/`, `/id-documents/`, `/sdlt-documents/`)
   - Option B: Three separate public buckets (one per CDN)
7. **Origin group unchanged** - Your existing origin group (London → Frankfurt) remains exactly as-is

## Next Steps

1. ✅ Create public S3 bucket for error pages (`error-pages-public` or separate per CDN)
2. ✅ Upload error pages to public bucket (use sync script)
3. ✅ Add error pages bucket as **separate origin** in CloudFront (NOT in origin group)
4. ✅ Configure Custom Error Responses for each error code (400, 403, 404, etc.)
5. ✅ Test error pages are served correctly
6. ✅ Verify origin group still works for actual files (London → Frankfurt failover)

## Architecture Summary

```
CloudFront Distribution
├── Origin Group (for actual files)
│   ├── Primary: id-images-prod-london (private, signed URLs)
│   └── Secondary: id-images-backup-frankfurt (private, signed URLs)
│
└── Separate Origin (for error pages only)
    └── error-pages-public (public, no signed URLs)
        └── Used ONLY by Custom Error Responses
            └── Never used for actual file requests
```

**Key Points:**
- Origin group handles file requests and failover
- Error pages origin handles error responses only
- These are completely separate - no interference

## References

- [AWS CloudFront Custom Error Responses](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages.html)
- [S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)

