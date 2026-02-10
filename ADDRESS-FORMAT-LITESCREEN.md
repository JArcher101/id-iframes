# Address Format Differences: UK vs International (Litescreen)

This document explains how address formats differ between UK and international addresses when submitting a litescreen check in `thirdfort-check.html`.

## Overview

The Thirdfort API requires different address field structures depending on the country:
- **UK (GBR)**: Uses individual building fields - **must NOT include** `address_1` or `address_2`
- **International (including Italy/IT)**: Uses `address_1` and `address_2` fields instead of individual building fields

This format difference is automatically handled by the `buildAddressFromManualInputs()` and `formatToThirdfort()` functions in `js/thirdfort-check-core.js`.

---

## UK Address Format (GBR)

UK addresses use individual building fields and **must not** include `address_1` or `address_2`:

```javascript
{
  building_name: 'Oak House',
  building_number: '42',
  flat_number: '10',
  street: 'Baker Street',
  sub_street: '',
  town: 'London',
  postcode: 'NW1 6XE',
  country: 'GBR'
  // Note: address_1 and address_2 are NOT included for UK addresses
}
```

### Field Mapping

When building from manual inputs or autocomplete:
- `building_name` - Building name (e.g., "Oak House")
- `building_number` - Building/house number (e.g., "42")
- `flat_number` - Flat/apartment number (e.g., "10")
- `street` - Street name (e.g., "Baker Street")
- `sub_street` - Sub-street or locality
- `town` - Town or city
- `postcode` - UK postcode
- `country` - Always "GBR" for UK addresses

### Implementation

```3714:3726:js/thirdfort-check-core.js
  // UK addresses: Individual fields only (no address_1, address_2)
  if (isUK) {
    return {
      building_name: buildingName,
      building_number: buildingNumber,
      flat_number: flatNumber,
      postcode: postcode,
      street: street,
      sub_street: subStreet,
      town: town,
      country: country
    };
  }
```

---

## International Address Format (Non-UK)

International addresses (including Italy/IT, France, Germany, etc.) use `address_1` and `address_2` fields:

```javascript
{
  address_1: 'Via Roma, 42, Apartment 5',
  address_2: 'Building B',
  street: 'Via Roma',
  sub_street: '',
  town: 'Rome',
  postcode: '00100',
  state: '',
  country: 'ITA'
}
```

### Field Mapping

When building from manual inputs or autocomplete:
- `address_1` - Combined address line 1 (includes flat number, building number, building name, and street)
- `address_2` - Address line 2 (typically sub-street or additional address info)
- `street` - Street name
- `sub_street` - Sub-street or locality
- `town` - Town or city
- `postcode` - Postal code
- `state` - State/province (empty for most countries, used for USA/CAN)
- `country` - ISO 3-letter country code (e.g., "ITA" for Italy)

### How `address_1` is Built

The `address_1` field is constructed by combining:
1. Flat number
2. Building number
3. Building name
4. Street name

These are joined with commas and filtered to remove empty values.

### Implementation

```3751:3769:js/thirdfort-check-core.js
  // Other countries: address_1, address_2 (no individual building fields)
  const address1Parts = [
    flatNumber,
    buildingNumber,
    buildingName,
    street
  ].filter(p => p && p.trim());
  const address1 = address1Parts.join(', ') || street || '';
  
  return {
    address_1: address1,
    address_2: subStreet,
    postcode: postcode,
    street: street,
    sub_street: subStreet,
    town: town,
    state: '',
    country: country
  };
```

---

## USA/Canada Address Format

USA and Canada addresses also use `address_1` and `address_2`, but include a `state` field:

```javascript
{
  address_1: '123 Main Street, Apt 4B',
  address_2: 'Building A',
  street: 'Main Street',
  town: 'New York',
  state: 'NY',
  postcode: '10001',
  country: 'USA'
}
```

### Implementation

```3728:3748:js/thirdfort-check-core.js
  // USA/Canada: address_1, address_2, state required
  if (isUSAOrCAN) {
    // Build address_1 from available fields (prioritize building name/number, then street)
    const address1Parts = [
      flatNumber,
      buildingNumber,
      buildingName,
      street
    ].filter(p => p && p.trim());
    const address1 = address1Parts.join(', ') || street || '';
    
    return {
      address_1: address1,
      address_2: subStreet,
      postcode: postcode,
      street: street,
      sub_street: subStreet,
      town: town,
      state: '', // State field not in lite screen manual inputs, leave empty
      country: country
    };
  }
```

---

## Address Conversion Functions

### `formatToThirdfort()`

Converts getaddress.io autocomplete address data to Thirdfort format. Automatically detects country and formats accordingly:

```792:892:js/thirdfort-check-core.js
/**
 * Format getaddress.io address object to Thirdfort API format
 * - UK (GBR): Uses individual fields (building_name, building_number, flat_number, street, etc.)
 * - USA/CAN: Uses address_1, address_2, state
 * - Other: Uses address_1, address_2
 * - Per Thirdfort API spec: UK addresses must NOT include address_1/address_2
 */
function formatToThirdfort(getAddressData, country = 'GBR') {
  if (!getAddressData) return null;
  
  // Normalize country code to 3-letter ISO format
  const normalizedCountry = normalizeCountryCode(country);
  
  // UK addresses: Individual fields only (no address_1, address_2)
  if (normalizedCountry === 'GBR') {
    // ... UK formatting logic ...
  }
  
  // USA/Canada: address_1, address_2, state required
  if (normalizedCountry === 'USA' || normalizedCountry === 'CAN') {
    // ... USA/CAN formatting logic ...
  }
  
  // Other countries: address_1, address_2 (no individual building fields)
  return {
    address_1: getAddressData.line_1 || '',
    address_2: getAddressData.line_2 || getAddressData.line_3 || getAddressData.line_4 || '',
    postcode: getAddressData.postcode || '',
    street: getAddressData.thoroughfare || getAddressData.street || '',
    sub_street: getAddressData.sub_street || '',
    town: getAddressData.town_or_city || getAddressData.town || '',
    state: '',
    country: normalizedCountry
  };
}
```

### `buildAddressFromManualInputs()`

Builds address object from manual input fields (used when user types address manually or edits autocomplete result):

```3689:3770:js/thirdfort-check-core.js
/**
 * Build address object from manual input fields
 * Always reads current values from form inputs to ensure edited addresses are used
 * @param {string} prefix - Field prefix ('lite' for lite screen)
 * @returns {Object|null} - Thirdfort-formatted address object or null if invalid
 */
function buildAddressFromManualInputs(prefix) {
  // Get country from element
  const countryElement = document.getElementById(`${prefix}Country`);
  if (!countryElement) return null;
  
  const countryRaw = countryElement.dataset.countryCode || countryElement.value || 'GBR';
  const country = normalizeCountryCode(countryRaw);
  const isUK = country === 'GBR';
  const isUSAOrCAN = country === 'USA' || country === 'CAN';
  
  // Read values from manual input fields
  const flatNumber = document.getElementById(`${prefix}FlatNumber`)?.value?.trim() || '';
  const buildingNumber = document.getElementById(`${prefix}BuildingNumber`)?.value?.trim() || '';
  const buildingName = document.getElementById(`${prefix}BuildingName`)?.value?.trim() || '';
  const street = document.getElementById(`${prefix}Street`)?.value?.trim() || '';
  const subStreet = document.getElementById(`${prefix}SubStreet`)?.value?.trim() || '';
  const town = document.getElementById(`${prefix}Town`)?.value?.trim() || '';
  const postcode = document.getElementById(`${prefix}Postcode`)?.value?.trim() || '';
  
  // Format based on country...
}
```

---

## Usage in Litescreen Submission

When submitting a litescreen check, the address is built using `buildAddressFromManualInputs('lite')`:

```5249:5251:js/thirdfort-check-core.js
  // Build address from manual input fields (always use current form values)
  // This ensures edited addresses or manually entered addresses are correctly submitted
  const address = buildAddressFromManualInputs('lite');
```

The function automatically:
1. Reads the country from the `liteCountry` field
2. Determines if it's UK, USA/CAN, or other international
3. Formats the address accordingly
4. Returns the properly formatted address object for Thirdfort API submission

---

## Key Differences Summary

| Aspect | UK (GBR) | International (e.g., Italy/IT) |
|--------|----------|-------------------------------|
| **Format** | Individual building fields | `address_1` and `address_2` |
| **Fields Used** | `building_name`, `building_number`, `flat_number`, `street`, `sub_street`, `town`, `postcode` | `address_1`, `address_2`, `street`, `sub_street`, `town`, `postcode`, `state` |
| **address_1** | ❌ **Must NOT be included** | ✅ Required (combines flat, building number, building name, street) |
| **address_2** | ❌ **Must NOT be included** | ✅ Required (typically sub-street) |
| **State Field** | N/A | Empty string (except USA/CAN) |

---

## Thirdfort API Specification

According to the Thirdfort API specification:
- **UK addresses must NOT include `address_1` or `address_2`** - they must use individual building fields only
- **International addresses must use `address_1` and `address_2`** - individual building fields are not supported

This format difference is enforced automatically by the code to ensure API compliance.

---

## Examples

### UK Address Example

**Input (from form):**
- Building Name: "Oak House"
- Building Number: "42"
- Flat Number: "10"
- Street: "Baker Street"
- Town: "London"
- Postcode: "NW1 6XE"
- Country: "United Kingdom" (GBR)

**Output (submitted to Thirdfort):**
```javascript
{
  building_name: 'Oak House',
  building_number: '42',
  flat_number: '10',
  street: 'Baker Street',
  sub_street: '',
  town: 'London',
  postcode: 'NW1 6XE',
  country: 'GBR'
}
```

### Italian Address Example

**Input (from form):**
- Flat Number: "5"
- Building Number: "42"
- Building Name: "Palazzo"
- Street: "Via Roma"
- Sub Street: "Building B"
- Town: "Rome"
- Postcode: "00100"
- Country: "Italy" (ITA)

**Output (submitted to Thirdfort):**
```javascript
{
  address_1: '5, 42, Palazzo, Via Roma',
  address_2: 'Building B',
  street: 'Via Roma',
  sub_street: 'Building B',
  town: 'Rome',
  postcode: '00100',
  state: '',
  country: 'ITA'
}
```

---

## Related Documentation

- [ADDRESS-AUTOCOMPLETE-FLOW.md](./ADDRESS-AUTOCOMPLETE-FLOW.md) - Address autocomplete message flow
- [API.md](./API.md) - Complete API documentation including address formats
- [MANUAL-ADDRESS-FEATURES.md](./MANUAL-ADDRESS-FEATURES.md) - Manual address entry features
