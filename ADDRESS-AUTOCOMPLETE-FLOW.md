# Address Autocomplete Message Flow

All iframes use the **same message types** for address autocomplete functionality. This document describes the complete flow.

## Message Types (Standardized Across All Iframes)

### Child → Parent (Outgoing)

#### 1. `address-search`
**When:** User types in address field (after 300ms debounce, minimum 7 characters for UK, 3 characters for international)

**Format:**
```javascript
window.parent.postMessage({
  type: 'address-search',
  searchTerm: '94 TR15',  // The search query
  field: 'current' | 'previous' | 'lite',  // Which address field
  countryCode: 'gbr'  // Optional: lowercase 3-letter ISO code (e.g., 'gbr', 'usa', 'can'). Defaults to 'gbr' if omitted.
}, '*');
```

**Note:** All 240+ countries are supported by Ideal Postcodes, so autocomplete is available for all countries.

**Used by:**
- `image-uploader.html` - field: `'current'` or `'previous'`
- `client-details.html` - field: `'current'` or `'previous'`
- `request-form.html` (via `js/request-form-core.js`) - field: `'current'` or `'previous'`
- `thirdfort-check.html` (via `js/thirdfort-check-core.js`) - field: `'lite'`

#### 2. `address-lookup`
**When:** User selects an address from the autocomplete dropdown

**Format:**
```javascript
window.parent.postMessage({
  type: 'address-lookup',
  addressId: 'abc123',  // ID from selected suggestion
  field: 'current' | 'previous' | 'lite',  // Which address field
  countryCode: 'gbr'  // Optional: lowercase 3-letter ISO code (e.g., 'gbr', 'usa', 'can'). Defaults to 'gbr' if omitted.
}, '*');
```

**Used by:** Same iframes as above

---

### Parent → Child (Incoming)

#### 1. `address-results`
**When:** Parent receives `address-search` and calls backend API, returns autocomplete suggestions

**Format:**
```javascript
// Parent sends:
{
  type: 'address-results',
  field: 'current' | 'previous' | 'lite',
  searchTerm: '94 TR15',  // Original search term (for caching)
  suggestions: [
    { id: 'abc123', address: '94 Southgate Street, Redruth, TR15 2ND' },
    { id: 'def456', address: '94 High Street, London, SW1A 1AA' }
  ],
  error: undefined  // Optional: error message if search failed
}
```

**Child handles by:**
- Displaying suggestions in dropdown
- Caching results using `searchTerm` as key
- Showing "No addresses found" if `suggestions` is empty or missing

#### 2. `address-data`
**When:** Parent receives `address-lookup` and calls backend API, returns full address object

**Format:**
```javascript
// Parent sends:
{
  type: 'address-data',
  field: 'current' | 'previous' | 'lite',
  addressId: 'abc123',  // ID that was requested (for caching)
  address: {
    // Address is already in Thirdfort format (no conversion needed)
    // Format depends on country:
    
    // UK (GBR) Format:
    {
      building_name: 'Oak House',
      building_number: '42',
      flat_number: '10',
      street: 'Downing Street',
      sub_street: '',
      town: 'London',
      postcode: 'SW1A 2AA',
      country: 'GBR'
      // No address_1 or address_2
    }
    
    // International (non-USA/Canada) Format:
    {
      address_1: '5, 42, Palazzo, Via Roma',
      address_2: 'Building B',
      street: 'Via Roma',
      sub_street: 'Building B',
      town: 'Rome',
      state: '',
      postcode: '00100',
      country: 'ITA'
      // No building_name, building_number, flat_number
    }
    
    // USA/Canada Format:
    {
      address_1: '123 Main Street, Apt 4B',
      address_2: 'Building A',
      street: 'Main Street',
      sub_street: 'Building A',
      town: 'New York',
      state: 'NY',  // Required for USA/Canada
      postcode: '10001',
      country: 'USA'  // or 'CAN'
      // No building_name, building_number, flat_number
    }
  }
}
```

**Child handles by:**
- Using address directly (already in Thirdfort format from parent)
- Storing in `currentAddressObject` or `previousAddressObject`
- Setting country dropdown based on `address.country`
- Caching using `addressId` as key

---

## Complete Flow

### Step 1: User Types Address
```
User types "94 TR15" in address field
↓
Iframe debounces 300ms
↓
Iframe checks cache first
↓
If not cached: Iframe sends 'address-search' to parent
```

### Step 2: Parent Processes Search
```
Parent receives 'address-search'
↓
Parent calls backend: searchAddress(searchTerm, countryCode)
↓
Backend calls Ideal Postcodes API
↓
Backend formats response: { success, suggestions: [{id, address}, ...] }
↓
Parent sends 'address-results' to iframe
```

### Step 3: Iframe Displays Suggestions
```
Iframe receives 'address-results'
↓
Iframe caches suggestions using searchTerm
↓
Iframe displays dropdown with suggestions
↓
User sees: "94 Southgate Street, Redruth, TR15 2ND"
```

### Step 4: User Selects Address
```
User clicks on suggestion
↓
Iframe sends 'address-lookup' with suggestion.id and countryCode
↓
Parent receives 'address-lookup'
↓
Parent calls backend: getFullAddress(addressId, countryCode)
↓
Backend calls Ideal Postcodes API
↓
Backend formats response to Thirdfort format: { success, address: {...} }
↓
Parent sends 'address-data' to iframe (address already in Thirdfort format)
```

### Step 5: Iframe Stores Address
```
Iframe receives 'address-data'
↓
Iframe caches full address using addressId
↓
Iframe uses address directly (already in Thirdfort format from parent)
↓
Iframe sets country dropdown based on address.country
↓
Iframe stores in currentAddressObject or previousAddressObject
↓
Address is ready for form submission
```

---

## Field Values

The `field` parameter indicates which address field is being used:

- **`'current'`** - Current/primary address field
  - Used in: `image-uploader.html`, `client-details.html`, `request-form.html`

- **`'previous'`** - Previous address field (for recent moves)
  - Used in: `image-uploader.html`, `client-details.html`, `request-form.html`

- **`'lite'`** - Lite screen address field
  - Used in: `thirdfort-check.html` (Electronic ID check)

---

## Error Handling

### If Backend Returns Error
```javascript
// Parent sends:
{
  type: 'address-results',
  field: 'current',
  searchTerm: '94 TR15',
  suggestions: [],
  error: 'API error: 401 - Invalid API key'
}
```

### If No Results Found
```javascript
// Parent sends:
{
  type: 'address-results',
  field: 'current',
  searchTerm: '94 TR15',
  suggestions: []  // Empty array
}
```

### Iframe Response
- If `error` exists: Display error message in dropdown
- If `suggestions` is empty: Display "No addresses found"
- If `suggestions` has items: Display dropdown list

---

## Caching Strategy

### Autocomplete Results Cache
- **Key:** `'auto_' + searchTerm.toLowerCase()`
- **Stored when:** `address-results` received with suggestions
- **Used when:** User types same search term again
- **Type:** `'autocomplete'`

### Full Address Cache
- **Key:** `'addr_' + addressId`
- **Stored when:** `address-data` received
- **Used when:** User selects same address again
- **Type:** `'address'`

---

## Summary

✅ **All iframes use identical message types:**
- `address-search` (child → parent)
- `address-lookup` (child → parent)
- `address-results` (parent → child)
- `address-data` (parent → child)

✅ **Only difference:** `field` value (`'current'`, `'previous'`, or `'lite'`)

✅ **Flow is consistent:** Search → Results → Select → Full Data

✅ **Caching works the same:** All iframes cache both autocomplete results and full addresses
