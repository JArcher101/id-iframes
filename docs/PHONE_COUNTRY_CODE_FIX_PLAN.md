# Phone country code (shared +1 USA/Canada) fix – plan

## Problem
Where the mobile country autocomplete is used, choosing a shared dial code (e.g. **+1 USA**) and saving causes the wrong country to show on reload (e.g. **+1 Canada**) because only the dial code (+1) is persisted. The parent stores **each field**, not extra fields, so we cannot add a separate `mIso` or `*Iso` field.

## Approach
- **Encode the 2-letter ISO in the phone string** before sending to the parent: store as `"CC:E164"` (e.g. `"US:+12025551234"`). The parent stores this single string in the existing phone field.
- **On load in each iframe**: parse the stored value with `parseStoredPhoneWithIso(stored)`; if it has the `CC:` prefix, **strip** it, use `CC` for `setPhoneCode(inputId, iso)` and use the E.164 part for the national number. Legacy values (plain E.164 with no prefix) still work.
- **Thirdfort API**: When building the request, use only the form fields (dial code + national number) to build E.164. **Never** send the stored string or the letter code to the API.

## Stored format
- **Convention**: `"CC:E164"` where `CC` is 2-letter ISO (e.g. `US`, `CA`, `GB`) and `E164` is the full number (e.g. `+12025551234`).
- **Helpers** (in `js/jurisdiction-autocomplete.js`):
  - `parseStoredPhoneWithIso(stored)` → `{ iso: string|null, e164: string }`
  - `buildStoredPhoneWithIso(iso, e164)` → `"CC:E164"`

## Files and behavior

| File | Save | Load |
|------|------|------|
| **request-form-core.js** | `cI.m = buildStoredPhoneWithIso(iso, e164)` (e.g. `"US:+12025551234"`) | N/A (client-details consumes) |
| **client-details.html** | N/A | `parseStoredPhoneWithIso(formData.m)`; if `iso` then `setPhoneCode(..., iso)` and set national from `e164`; else legacy parse |
| **thirdfort-check-core.js** | N/A | `parseStoredPhoneWithIso(data.cI.m)`; strip prefix, set dropdown from `iso`, national from `e164`. API request uses form only (E.164). |
| **dwellworks-request-form-core.js** | `formatPhone` returns `buildStoredPhoneWithIso(iso, full)` for each phone field | For each phone field: `parseStoredPhoneWithIso(stored)`; if `iso` then `setPhoneCode` + national; else legacy `parsePhoneNumber(e164)` |

## Parent (Velo)
**No schema change.** The parent continues to store the same field names (e.g. `cI.m`, `dwellworksContactNumber`, `tenantsMobileNumber`). The **value** is now sometimes a string like `"US:+12025551234"` instead of `"+12025551234"`. If the parent or any backend needs plain E.164 for an external API, strip the `CC:` prefix (first 3 characters when pattern matches `XX:`).

## Thirdfort API
- Build request from form: `countryCodeInput.dataset.phoneCode` + `electronicIdMobile.value` → E.164. No letter code in the payload.
