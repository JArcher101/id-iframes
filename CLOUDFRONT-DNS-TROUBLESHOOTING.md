# CloudFront DNS Troubleshooting Guide

## Issue: "Domain not found" error for sdlt-documents.thurstanhoskin.app

### Root Cause
The DNS CNAME record hasn't been added or hasn't propagated yet.

### Solution Steps

#### 1. Verify CloudFront Distribution Setup

**In AWS CloudFront Console:**
1. Go to: https://console.aws.amazon.com/cloudfront/
2. Find your distribution for `sdlt-documents.thurstanhoskin.app`
3. Click on the distribution ID
4. Go to **Settings** tab
5. Verify:
   - **Alternate domain names (CNAMEs)**: Should include `sdlt-documents.thurstanhoskin.app`
   - **SSL certificate**: Should show "Issued" status (not "Pending validation")
   - **Status**: Should be "Deployed" (not "In Progress")

**Copy the Distribution domain name** (e.g., `d1234abcd.cloudfront.net`)

#### 2. Add DNS CNAME Record

**Where to add:**
- Your DNS provider for `thurstanhoskin.app` domain
- Same place where you added GitHub Pages records

**DNS Record to Add:**
```
Type: CNAME
Name: sdlt-documents
Value: [your-cloudfront-domain].cloudfront.net
TTL: 300
```

**Examples by DNS Provider:**

**Cloudflare:**
- Type: CNAME
- Name: `sdlt-documents`
- Target: `d1234abcd.cloudfront.net`
- Proxy status: DNS only (gray cloud) - NOT proxied
- TTL: Auto

**AWS Route 53:**
- Record type: CNAME
- Record name: `sdlt-documents`
- Value: `d1234abcd.cloudfront.net`
- TTL: 300

**Other DNS Providers:**
- Host/Name: `sdlt-documents`
- Points to/Value: `d1234abcd.cloudfront.net`
- Type: CNAME

#### 3. Verify DNS Propagation

**Wait 5-30 minutes** after adding the record, then test:

**Windows (PowerShell):**
```powershell
nslookup sdlt-documents.thurstanhoskin.app
```

**Expected output:**
```
Name:    sdlt-documents.thurstanhoskin.app
Addresses:  [CloudFront IP addresses]
Aliases:  d1234abcd.cloudfront.net
```

**Online Tools:**
- https://dnschecker.org/#CNAME/sdlt-documents.thurstanhoskin.app
- https://www.whatsmydns.net/#CNAME/sdlt-documents.thurstanhoskin.app

#### 4. Test CloudFront Direct Access

**Before DNS propagates, test directly:**
```
https://[your-cloudfront-domain].cloudfront.net/protected/[your-signed-url-params]
```

**Expected:**
- If signed URL is correct: File downloads
- If no signed URL: "Missing Key-Pair-Id" error

**This confirms CloudFront is working, just DNS needs to propagate.**

#### 5. Test Custom Domain (After DNS Propagation)

Once DNS resolves:
```
https://sdlt-documents.thurstanhoskin.app/protected/[your-signed-url-params]
```

**Expected:**
- HTTPS connection (green padlock)
- File downloads (if signed URL is valid)
- Or "Missing Key-Pair-Id" (if accessing without signed URL)

---

## Common Issues

### Issue: DNS still not resolving after 30 minutes

**Check:**
1. CNAME record name is exactly `sdlt-documents` (no trailing dot)
2. CNAME value points to CloudFront domain (ends in `.cloudfront.net`)
3. No typo in the CloudFront domain name
4. DNS provider saved the record correctly

**Fix:**
- Double-check the record in your DNS provider
- Try using a different DNS server: `nslookup sdlt-documents.thurstanhoskin.app 8.8.8.8`

### Issue: SSL Certificate Error

**If you see "Certificate not valid" or "Connection not secure":**

1. Check ACM certificate status:
   - Go to AWS Certificate Manager (us-east-1 region)
   - Verify certificate for `*.thurstanhoskin.app` is "Issued"
   - If "Pending validation", add the DNS validation record

2. Verify CloudFront distribution:
   - Settings → SSL certificate should show the certificate
   - Status should be "Deployed"

### Issue: CloudFront returns 403

**This is different from DNS - means DNS is working but CloudFront is blocking:**

1. Check S3 bucket policy:
   - CloudFront → Distribution → Settings → Copy bucket policy
   - S3 → Bucket → Permissions → Bucket policy → Paste

2. Check signed URL:
   - Verify key pair ID matches CloudFront key group
   - Verify URL hasn't expired
   - Verify domain in signed URL matches distribution

---

## Quick Verification Commands

**Check DNS resolution:**
```powershell
nslookup sdlt-documents.thurstanhoskin.app
```

**Check HTTPS connection:**
```powershell
curl -I https://sdlt-documents.thurstanhoskin.app
```

**Test with signed URL (replace with your actual URL):**
```powershell
curl -I "https://sdlt-documents.thurstanhoskin.app/protected/[key]?Expires=...&Key-Pair-Id=...&Signature=..."
```

---

## Next Steps After DNS Works

1. ✅ DNS resolves correctly
2. ✅ HTTPS connection works
3. ✅ Test signed URL generation in your backend
4. ✅ Verify files are accessible via custom domain
5. ✅ Update Wix Secrets if needed:
   - `CLOUDFRONT_SDLT_DOCUMENTS_DOMAIN` = `sdlt-documents.thurstanhoskin.app`


