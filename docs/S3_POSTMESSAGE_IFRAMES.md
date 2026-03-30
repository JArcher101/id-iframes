# S3 presigns & `postMessage` — iframe bundles

This document describes how Wix Velo (or any parent) should exchange **`file-data` / `image-data`**, **`put-links` / `put-error`**, and success callbacks with each HtmlComponent bundle in this repo. It also covers **v2** envelopes `{ type, data }`, **`s3Keys`** shape (`string[]` vs objects with `.s3Key`), and **SDLT**-specific behavior.

**Bundle names used here**

| Name | File(s) |
|------|---------|
| **Messages / chat** | `message-iframe.html` |
| **Documents** | `document-viewer.html` |
| **Images** | `image-viewer.html` |
| **In person form** | `image-uploader.html` |
| **Sanctions checker** | `uk-sanctions-checker.html` |
| **Request form** | `request-form.html` |
| **SDLT workflow** | `sdlt-workflow.html` + `js/sdlt-workflow.js` |
| **Dwellworks request form** | `dwellworks-request-form.html` + `js/dwellworks-request-form-core.js` |

Velo slot IDs (`#messageHtml`, `#documentHtml`, etc.) are **not** defined in these files; map slots to bundles in your page code.

---

## 1. Core flow (ID-style uploads)

Typical sequence:

1. Child → parent: **`file-data`** or **`image-data`** (metadata; `File` bodies stay in the iframe).
2. Parent → child: **`put-links`** (presigned PUT URLs + parallel metadata) or **`put-error`**.
3. Child: `PUT` each file to `links[i]`.
4. Child → parent: success payload (type varies by bundle — see §2).

---

## 2. Per-bundle: `put-links` handling & reply to parent

| Bundle | After `put-links` | Back to parent on success |
|--------|-------------------|---------------------------|
| **Messages / chat** | Reads `links` + `s3Keys`, calls `uploadFileToS3(links[0], s3Keys[0].s3Key)` | **`message-sent`** (not `upload-success`) with `message` including `file.s3Key` when a file was attached |
| **Documents** | Main `message` listener → `normalizeMessageData` → **`handlePutLinks`** → `uploadFiles(links)` | **`upload-success`**: `{ type, files, _id, uploader }` from `handleUploadSuccess()` |
| **Images** | During upload, **`handlePutResponse`** is attached; it uses `normalizeParentMessage` and `uploadFiles(links)`. The main listener routes `put-links` to a **stub `handlePutLinks`** — real work is **`handlePutResponse`** only while uploading | **`upload-success`**: `{ type, files, _id, uploader, photoIdUploaded, addressIdUploaded, likenessNOTConfirmed }` |
| **In person form** | `getNormalizedMessage` → **`handlePutResponse`** → `uploadFiles(links)` | **`upload-success`**: `{ type: 'upload-success', data: finalFormData, idImages: s3Keys }` from `sendUploadSuccessMessage()` |
| **Sanctions checker** | `normalizeParentMessage` → **`handlePutLinks`** (single PUT) | **`upload-success`**: `{ type, files: data.s3Keys \|\| data.images, _id, entryId, uploader, returnToRequest }` |
| **Request form** | **No** `file-data` / `put-links` / S3 flow in this file | N/A |

### Documents: duplicate `put-links` handler (fixed)

Previously, **Documents** registered a **second** `message` listener (`handlePutResponse`) while the main listener already called **`handlePutLinks`** for the same `put-links` event, which could run **`uploadFiles` twice** and **double-PUT** one-shot presigns. That was **removed**; only the main listener path runs (`handlePutLinks` / `handlePutError`), with `put-error` restoring uploading UI via `hideUploadingState` + `showUploader`.

---

## 3. `put-links` payload: top-level vs `{ type, data }`

| Bundle | Envelope |
|--------|----------|
| **Messages / chat** | **`normalizeMessage`**: flattens `{ type, data }` to one object; then reads `msg.links`, `msg.s3Keys`, `msg.message`. |
| **Documents** | **`normalizeMessageData`**: merges `message.data` onto top level; then reads `links`, `s3Keys`, `images`, `_id`, `message`. |
| **Images** | **`normalizeParentMessage`** → read from **`data.links`**, **`data.s3Keys`**, **`data.images`**, **`data.message`**. |
| **In person form** | Same as Images: **`getNormalizedMessage`** / fallback → **`data.*`**. |
| **Sanctions checker** | Same as Images: **`normalizeParentMessage`** → **`data.*`**. |
| **SDLT workflow** | **`normalizeParentMessage`** in `sdlt-workflow.js` → **`handlePutLinks(data)`** where `data` is the unwrapped payload; handler also does `message.data \|\| message` for an extra nesting level. |
| **Dwellworks request form** | **`normalizeParentMessageFallback`** (+ optional global `normalizeParentMessage`) → **`handlePutLinks(data)`**; inner `message.data \|\| message`. |

**Conclusion:** v2 **`{ type, data }`** is supported across these bundles; **`legacyFlat` is not required** for the envelope on them.

---

## 4. `s3Keys` element shape: `string` vs `{ …, s3Key }`

| Bundle | Expectation |
|--------|-------------|
| **Messages / chat** | **Objects** with **`.s3Key`**. **`string[]` breaks** (`s3Keys[0].s3Key`). |
| **Documents** | Upload only needs **`links[i]`**. **`upload-success`** forwards **`s3Keys` or `uploadedImages`**. In **SDLT** mode, comments allow **`s3Keys` as key strings** but **`upload-success.files`** is taken from **`uploadedImages`** (from **`images`**). **ID mode** expects parent-shaped **document objects** in practice. |
| **Images** | Assumes **full file objects** with **`.s3Key`** for `upload-success.files` (`s3Keys \|\| uploadedImages`). |
| **In person form** | **Strongly object-shaped** (`img.s3Key`, `img.type`, `img.document`, …). **`string[]` does not match**. |
| **Sanctions checker** | **Echoes** `data.s3Keys \|\| data.images` as **`files`**; no `.s3Key` read in iframe. **`string[]` OK** if parent accepts that `files` shape. |

---

## 5. `data.s3Keys || data.images` and `.s3Key`

- **Sanctions checker** — uses **`files: data.s3Keys || data.images`**; **no** `.s3Key` requirement inside the iframe.
- **Documents** / **Images** — forward **`s3Keys || uploadedImages`**; other code (e.g. open-by-key) expects **`.s3Key`** on documents.
- **In person form** — builds submission from **`s3Keys`** as **rich image objects**.
- **Messages / chat** — no `upload-success`; uses **`s3Keys[0].s3Key`** after presign.

---

## 6. Velo / parent mapping (typical)

| Slot (example) | Bundle |
|----------------|--------|
| `#messageHtml` | **Messages / chat** |
| `#documentHtml` | **Documents** |
| `#imageHtml` | **Images** or **In person form** (product-dependent) |
| `#iframeRequest` | **Request form** |
| Separate component | **Sanctions checker**, **SDLT workflow**, **Dwellworks request form** |

**Key functions (for navigation)**

- **Messages / chat:** `normalizeMessage`, `uploadFileToS3`, **`message-sent`**
- **Documents:** `normalizeMessageData`, `handlePutLinks`, `uploadFiles`, `handleUploadSuccess`
- **Images:** `normalizeParentMessage`, `handlePutResponse`, `uploadFiles`, `handleUploadSuccess`; stub `handlePutLinks` on main listener
- **In person form:** `getNormalizedMessage`, `handlePutResponse`, `uploadFiles`, `sendUploadSuccessMessage`
- **Sanctions checker:** `normalizeParentMessage`, `handlePutLinks`
- **Request form:** no S3 presign handlers in the HTML file

---

## 7. v2 `generateIdPutLinks` (`string[]` + `{ type, data }`)

- **Envelope `{ type, data }`:** Supported by **Messages / chat** (flatten), **Documents**, **Images**, **In person form**, **Sanctions checker**, **SDLT workflow**, **Dwellworks request form**.
- **`s3Keys` as `string[]`:** **Unsafe** for **Messages / chat** and **In person form**; **risky** for **Images** / **Documents (ID mode)** if the parent expects rich `files` on **`upload-success`**; **OK for pass-through** on **Sanctions checker** if the parent accepts that shape.

Tightest consumers: **Messages / chat** (needs **`.s3Key` on an object**) and **In person form** (full image objects).

---

## 8. SDLT workflow (`sdlt-workflow.html` + `js/sdlt-workflow.js`)

**Role:** Staff SDLT workflow; **not** the same as Documents/Images “display + `upload-success`” loops.

**S3-related messages**

| Direction | Type | Notes |
|-----------|------|--------|
| Child → parent | **`file-data`** | From `handleSaveData` when there are pending blobs/files: metadata `files` + `_id: entryData._id`. Optional: **`sdltCalculationSaveMeta`** (§8.1), **`accountingDocumentReplacements`** (§8.2). |
| Parent → child | **`put-links`** | `handlePutLinks` (via `handleParentMessage`). |
| Parent → child | **`put-error`** | `handlePutError` → child may post **`upload-error`**. |
| Child → parent | **`upload-error`** | S3 or presign failure path. |
| Child → parent | **`save-data-response`** | After successful uploads, `sendSaveDataResponse()` — **not** `upload-success`. |

**`links` / `s3Keys` / `images` / `documents`**

- Reads `data.links`, `data.s3Keys`, **`data.images || data.documents`**.
- **Requires** equal lengths: `links.length === s3Keys.length === documents.length` (otherwise mismatch error).
- PUT uses **`links[i]`**. **`documents[i]`** (from `images`/`documents`) is merged into **`pendingUpdates`** by slot (e.g. `sdltCalculation`, `thsInvoice`). Parent should send **full document objects** there; bare `string[]` for `s3Keys` alone is insufficient for that merge if `images`/`documents` are wrong or missing.

**Alternate path:** `handleFiles` sends **`workflow-document-upload`** (not `file-data`) — **separate** parent contract.

Header comments may mention **`workflow-upload-success`**; there is no matching outgoing type in the JS — treat as documentation / future unless implemented.

### 8.1. SDLT calculation replacement & `save-data-response` extras

When the iframe uploads a **new** SDLT calculation PDF (in-app generated or user file), the parent may need to **archive the previous** `sdltCalculation` document (e.g. push into a `documents` / history array on the collection item) instead of overwriting and losing the old S3 key.

- **`file-data`** may include **`sdltCalculationSaveMeta`** (same object shape as below) so the parent can prepare **before** presign / PUT.
- **`save-data-response`** may include these **top-level** fields (in addition to `updates`, `newMessage`, etc.):

| Field | Meaning |
|-------|--------|
| **`sdltRecalculation`** | `true` if the entry already had a calculation (`sdltCalculated` and/or existing `sdltCalculation.s3Key`) before this save. |
| **`previousSdltDue`** | Numeric SDLT amount previously stored on the entry (for chat / audit). |
| **`previousSdltRequired`** | Previous `sdltRequired` boolean. |
| **`newSdltDue`** | Amount being saved with this upload (mirrors `updates.sdltDue` when present). |
| **`newSdltRequired`** | Mirrors `updates.sdltRequired`. |
| **`previousSdltCalculationDocument`** | Shallow snapshot of the prior doc: `s3Key`, `description`, `fieldKey`, optional `url` / `liveUrl` — use to append to history before replacing `sdltCalculation`. |

**Iframe behaviour (summary):** Manual upload requires an explicit amount in the amount field (empty no longer implies £0 / “no SDLT due”). Recalculation chat messages include **previous vs new** figures. When SDLT becomes due after a recalculation, status is set to **Calculating SDLT** (not left on **No SDLT Due**).

### 8.2. Accounting documents — THS invoice, SDLT invoice, completion statement, SDLT5

Staff can **overwrite** these via the same `file-data` → `put-links` batch. When any of them are in the upload queue, the iframe may send:

- **`accountingDocumentReplacements`** on **`file-data`** (and again on **`save-data-response`** after success): an **array** of rows, **one per pending accounting file** in upload order (`thsInvoice`, `sdltInvoice`, `completionStatement`, `sdlt5Certificate` — only fields that have a new file selected):

| Property | Meaning |
|----------|--------|
| **`fieldKey`** | `thsInvoice` \| `sdltInvoice` \| `completionStatement` \| `sdlt5Certificate` |
| **`replacesExisting`** | `true` if the entry already had that document with an `s3Key` before this upload |
| **`previousDocument`** | Same shape as §8.1 (`s3Key`, `description`, `fieldKey`, optional `url` / `liveUrl`) or `null` if first upload |

**Parent:** Before applying the new document object from `updates`, append each `previousDocument` (when `replacesExisting`) to your **documents / history** array so the old file is not lost.

---

## 9. Dwellworks request form (`dwellworks-request-form.html` + `js/dwellworks-request-form-core.js`)

The HTML only echoes **`health-ping`**. Logic is in **`dwellworks-request-form-core.js`**.

- **`normalizeParentMessageFallback`** (+ optional global **`normalizeParentMessage`**) — v2 envelope.
- **`requestPutLinks`** → **`file-data`** with metadata `files`.
- **`handlePutLinks`:** `links`, `s3Keys`, **`images`** must match **`pendingFilesForUpload.length`**; **`formState.uploadedDocuments = images`** (full objects with `s3Key`).
- After S3: **`submitFormData()`** → **`dwellworks-form-data`** (new) or **`update-submission`** (edit) — **not** `upload-success`.

---

## 10. Documents (`document-viewer.html`) in SDLT mode

- **`documentSystemMode === 'sdlt'`** when parent sends **`sdlt-documents-display`**.
- Same **`file-data` → `put-links` → PUT** path; **`handlePutLinks`** sets `s3Keys`, `uploadedImages` from **`data.images`**.
- **`handleUploadSuccess`:** **SDLT** uses **`documentsWithS3Keys = uploadedImages || []`** (full rows from **`images`**). **ID** uses **`s3Keys || uploadedImages`**.
- Child → parent: **`upload-success`** with `{ files, _id, uploader }`.

---

## 11. Messages / chat (`message-iframe.html`) in SDLT mode

- **`sdlt-message-viewer`** enables **`isSdltMode`**, **`sdltWhiteType`**, UI tweaks.
- **Attachments disabled:** if **`isSdltMode && file`**, user sees an error — **no** `file-data` / `put-links` / `s3Keys` path for matter chat.
- **Text:** **`message-sent`** without **`_id`**; SDLT time format (12h en-GB).
- **`message-value`** response only when **`isSdltMode`**.
- **ID mode** unchanged: **`file-data` → `put-links`**, **`s3Keys[0].s3Key`**, **`message-sent`** with **`_id`** when applicable.

---

## 12. Quick reference: SDLT vs ID uploads

| Bundle | `put-links` envelope | Critical arrays | Success to parent |
|--------|---------------------|-----------------|-------------------|
| **SDLT workflow** | v2 OK | `links` + `s3Keys` + **`images`/`documents`** (same length; objects in `images`/`documents`) | **`save-data-response`**, **`upload-error`** |
| **Dwellworks request form** | v2 OK | Same triple length; **`images`** → `uploadedDocuments` | **`dwellworks-form-data`** / **`update-submission`** |
| **Documents (SDLT)** | v2 via `normalizeMessageData` | Prefer **`images` → uploadedImages** for **`upload-success.files`** | **`upload-success`** |
| **Messages / chat (SDLT)** | N/A for files | — | **`message-sent`** (text only) |

---

*Last updated: SDLT §8.1–8.2 (calc + accounting document replacement meta on `file-data` / `save-data-response`), Documents duplicate `put-links` fix, Dwellworks workflow detail.*
