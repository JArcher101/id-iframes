# Manual Address Input Features

This document describes the CSS styling and validation features for manual address inputs that can be applied to other iframes.

## Overview

These features provide:
- Visual grouping of manual address fields with a container
- Real-time validation according to Thirdfort minimum requirements
- Visual feedback (green container) when address is validated
- Clear indication that only one of three building identifier fields is required

## CSS Features

### Manual Address Container

The container wraps all manual address fields to visually group them:

```css
/* Manual Address Fields */
.manual-address-container {
  margin-top: 20px;
  padding: 20px;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.manual-address-container.validated {
  background: #e8f5e9;
  border-color: #4caf50;
}
```

**Features:**
- Light grey background (`#f5f5f5`) by default
- Light green background (`#e8f5e9`) with green border when validated
- Smooth transition animation (0.3s ease)
- Padding and border radius for visual separation

### OR Separators for Building Identifier Fields

When three building identifier fields are shown (Flat Number, Building Number, Building Name) where only one is required, use OR separators:

```css
.row-grid-25-25-50 {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 2fr;
  gap: 20px;
  align-items: end;
}

.or-separator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 8px;
}

.or-text {
  font-family: 'RotisRegular', 'Quicksand', sans-serif;
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
  font-weight: 400;
}
```

**HTML Structure:**
```html
<div class="row row-grid-25-25-50">
  <div>
    <label for="flatNumber" class="required">Flat Number</label>
    <input type="text" id="flatNumber" name="flatNumber" />
  </div>
  <div class="or-separator">
    <span class="or-text">OR</span>
  </div>
  <div>
    <label for="buildingNumber" class="required">Building Number</label>
    <input type="text" id="buildingNumber" name="buildingNumber" />
  </div>
  <div class="or-separator">
    <span class="or-text">OR</span>
  </div>
  <div>
    <label for="buildingName" class="required">Building Name</label>
    <input type="text" id="buildingName" name="buildingName" />
  </div>
</div>
```

**Notes:**
- All three labels should have the `required` class to show asterisks, even though only one field is actually required
- Grid uses `1fr auto 1fr auto 2fr` to accommodate the OR separators
- OR text is styled in small, italic, gray to indicate it's helper text

## JavaScript Validation

### Thirdfort Minimum Requirements

According to Thirdfort API specifications, manual addresses must meet these minimum requirements:

1. **At least ONE OF:**
   - Flat Number, OR
   - Building Number, OR
   - Building Name

2. **Required fields:**
   - Town/City (required)
   - Postcode (required)

### Validation Function

```javascript
function setupAddressValidation(containerId, fieldIds) {
  const manualFields = document.getElementById(containerId);
  if (!manualFields) return;
  
  const container = manualFields.querySelector('.manual-address-container');
  if (!container) return;
  
  // Get all manual address input fields
  const flatNumber = document.getElementById(fieldIds.flatNumber);
  const buildingNumber = document.getElementById(fieldIds.buildingNumber);
  const buildingName = document.getElementById(fieldIds.buildingName);
  const town = document.getElementById(fieldIds.town);
  const postcode = document.getElementById(fieldIds.postcode);
  
  // Function to validate address according to Thirdfort minimum requirements
  function validateAddress() {
    // Thirdfort minimum requirements:
    // 1. Must have ONE OF: flat_number, building_number, or building_name
    // 2. Must have: town (required)
    // 3. Must have: postcode (required)
    
    const hasFlatNumber = flatNumber && flatNumber.value.trim() !== '';
    const hasBuildingNumber = buildingNumber && buildingNumber.value.trim() !== '';
    const hasBuildingName = buildingName && buildingName.value.trim() !== '';
    const hasOneOf = hasFlatNumber || hasBuildingNumber || hasBuildingName;
    
    const hasTown = town && town.value.trim() !== '';
    const hasPostcode = postcode && postcode.value.trim() !== '';
    
    const isValid = hasOneOf && hasTown && hasPostcode;
    
    // Update container class
    if (isValid) {
      container.classList.add('validated');
    } else {
      container.classList.remove('validated');
    }
    
    return isValid;
  }
  
  // Add event listeners to all manual address fields
  const fields = [flatNumber, buildingNumber, buildingName, town, postcode];
  fields.forEach(field => {
    if (field) {
      field.addEventListener('input', validateAddress);
      field.addEventListener('keyup', validateAddress);
      field.addEventListener('change', validateAddress);
    }
  });
  
  // Initial validation
  validateAddress();
}
```

### Usage Example

```javascript
// In your initialization function
setupAddressValidation('sdltManualAddressFields', {
  flatNumber: 'sdltFlatNumber',
  buildingNumber: 'sdltBuildingNumber',
  buildingName: 'sdltBuildingName',
  town: 'sdltTown',
  postcode: 'sdltPostcode'
});
```

## Implementation Checklist

When applying these features to a new iframe:

- [ ] Add `.manual-address-container` CSS class
- [ ] Add `.manual-address-container.validated` CSS class for green state
- [ ] Wrap manual address fields in a container with class `manual-address-container`
- [ ] Add `required` class to all three building identifier labels (Flat Number, Building Number, Building Name)
- [ ] Add OR separators between building identifier fields
- [ ] Update grid layout to `1fr auto 1fr auto 2fr` for the building identifier row
- [ ] Add `.or-separator` and `.or-text` CSS classes
- [ ] Implement validation function that checks Thirdfort minimum requirements
- [ ] Add event listeners (`input`, `keyup`, `change`) to all manual address fields
- [ ] Call validation function on initialization

## Notes

- The validation runs in real-time as the user types
- The container turns green immediately when all requirements are met
- The validation is based on Thirdfort API minimum requirements
- Street and Sub Street fields are optional and not included in validation
- The OR separators help clarify that only one building identifier is needed

