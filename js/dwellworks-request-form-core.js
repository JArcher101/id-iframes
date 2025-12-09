/*
=====================================================================
DWELLWORKS REQUEST FORM - CORE JAVASCRIPT
=====================================================================
Core functionality for the dwellworks request form including:
- Form field management and validation
- Parent-child communication via postMessage
- File upload handling
- Address autocomplete
- Companies House integration
=====================================================================
*/

// Global state
let formState = {
  addSecondTenant: undefined, // YES = true, NO = undefined
  addAdditionalDocuments: undefined, // YES = true, NO = undefined
  additionalDocuments: [],
  leaseDocument: null,
  documents: [],
  legalFeeDirectSend: undefined, // YES = true, NO = undefined
  sdltFeeDirectSend: undefined, // YES = true, NO = undefined
  sdltFeeEmployerMatch: true, // Defaults to Yes (matches legal fee) - YES = true, NO = undefined
  submitterDataReceived: false, // Track if submitter data has been received
  companyData: null, // Full Companies House company data object
  uploadedDocuments: [], // Documents with s3Keys from put-links response (data.images)
  isEditMode: false, // Track if we're editing an existing submission
  originalSubmission: null // Store original submission data for comparison
};

// Upload state
let uploadInProgress = false;
let uploadResolve = null;
let uploadReject = null;
let pendingFilesForUpload = [];

// Session countdown state
let sessionCountdown = {
  totalSeconds: 600, // 10 minutes
  remainingSeconds: 600,
  intervalId: null,
  overlayIntervalId: null,
  overlaySeconds: 60,
  isRenewing: false
};

// Address data storage
let sdltAddressObject = null;
let previousAddressObject = null;
let addressDebounceTimer = null;
let previousAddressDebounceTimer = null;
let companyNameDebounceTimer = null;
let companyNumberDebounceTimer = null;

// DOM elements
const elements = {
  errorPopup: document.getElementById('errorPopup'),
  errorMessage: document.getElementById('errorMessage'),
  closeError: document.getElementById('closeError'),
  submitBtn: document.getElementById('submitBtn')
};

// Initialize the form
document.addEventListener('DOMContentLoaded', function() {
  initializeForm();
});

function initializeForm() {
  // Set up event listeners
  setupEventListeners();
  
  // Listen for parent messages
  window.addEventListener('message', handleParentMessage);
  
  // Setup DOB inputs
  setupDOBInputs();
  
  // Setup address autocomplete
  setupAddressAutocomplete();
  
  // Setup Companies House integration
  setupCompaniesHouseIntegration();
  
  // Setup form validation
  setupFormValidation();
  
  // Setup SDLT address validation
  setupSDLTAddressValidation();
  
  // Setup session countdown (but don't start until submitter data received)
  setupSessionCountdown();
  
  // Submit button disabled until submitter data received
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
  }
  
  // Notify parent that iframe is ready
  notifyParentReady();
}

function setupEventListeners() {
  // Error popup close
  if (elements.closeError) {
    elements.closeError.addEventListener('click', hideError);
  }
  
  // YES/NO buttons
  document.querySelectorAll('.yes-no-btn').forEach(btn => {
    btn.addEventListener('click', handleYesNoButton);
  });
  
  // Radio buttons
  document.querySelectorAll('input[type="radio"][name="leaseUnder"]').forEach(radio => {
    radio.addEventListener('change', handleLeaseUnderChange);
  });
  
  document.querySelectorAll('input[type="radio"][name="legalFeePayee"]').forEach(radio => {
    radio.addEventListener('change', handleLegalFeePayeeChange);
  });
  
  document.querySelectorAll('input[type="radio"][name="sdltFeePayee"]').forEach(radio => {
    radio.addEventListener('change', handleSdltFeePayeeChange);
  });
  
  // YES/NO buttons for SDLT fee employer match are handled by handleYesNoButton
  
  // Submit button
  if (elements.submitBtn) {
    elements.submitBtn.addEventListener('click', handleSubmit);
  }
  
  // Form inputs for validation
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });
  
  // Checkboxes for validation
  document.querySelectorAll('input[type="checkbox"][required]').forEach(checkbox => {
    checkbox.addEventListener('change', validateForm);
  });
  
  // Real-time validation for tenant mobile numbers with libphonenumber
  const tenant1Mobile = document.getElementById('tenant1Mobile');
  const tenant1MobileCountryCode = document.getElementById('tenant1MobileCountryCode');
  if (tenant1Mobile && tenant1MobileCountryCode) {
    const validateTenant1Mobile = () => {
      const phoneCode = tenant1MobileCountryCode.dataset.phoneCode || '';
      const phoneNumber = tenant1Mobile.value.trim();
      if (phoneNumber) {
        const fullNumber = phoneCode + phoneNumber;
        const isValid = validatePhoneNumberWithLibPhone(fullNumber);
        if (isValid) {
          tenant1Mobile.setCustomValidity('');
          tenant1Mobile.classList.remove('invalid-phone');
        } else {
          tenant1Mobile.setCustomValidity('Please enter a valid mobile number');
          tenant1Mobile.classList.add('invalid-phone');
        }
      } else {
        tenant1Mobile.setCustomValidity('');
        tenant1Mobile.classList.remove('invalid-phone');
      }
      validateForm();
    };
    tenant1Mobile.addEventListener('input', validateTenant1Mobile);
    tenant1Mobile.addEventListener('change', validateTenant1Mobile);
    if (tenant1MobileCountryCode) {
      tenant1MobileCountryCode.addEventListener('change', validateTenant1Mobile);
    }
  }
  
  const tenant2Mobile = document.getElementById('tenant2Mobile');
  const tenant2MobileCountryCode = document.getElementById('tenant2MobileCountryCode');
  if (tenant2Mobile && tenant2MobileCountryCode) {
    const validateTenant2Mobile = () => {
      if (!formState.addSecondTenant) return;
      const phoneCode = tenant2MobileCountryCode.dataset.phoneCode || '';
      const phoneNumber = tenant2Mobile.value.trim();
      if (phoneNumber) {
        const fullNumber = phoneCode + phoneNumber;
        const isValid = validatePhoneNumberWithLibPhone(fullNumber);
        if (isValid) {
          tenant2Mobile.setCustomValidity('');
          tenant2Mobile.classList.remove('invalid-phone');
        } else {
          tenant2Mobile.setCustomValidity('Please enter a valid mobile number');
          tenant2Mobile.classList.add('invalid-phone');
        }
      } else {
        tenant2Mobile.setCustomValidity('');
        tenant2Mobile.classList.remove('invalid-phone');
      }
      validateForm();
    };
    tenant2Mobile.addEventListener('input', validateTenant2Mobile);
    tenant2Mobile.addEventListener('change', validateTenant2Mobile);
    if (tenant2MobileCountryCode) {
      tenant2MobileCountryCode.addEventListener('change', validateTenant2Mobile);
    }
  }
}

// ===== YES/NO BUTTON HANDLING =====

function handleYesNoButton(event) {
  const btn = event.currentTarget;
  const field = btn.dataset.field;
  const value = btn.dataset.value;
  
  // Update button states
  const buttons = document.querySelectorAll(`[data-field="${field}"]`);
  buttons.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  
  // Update form state - YES = true, NO = undefined
  formState[field] = value === 'yes' ? true : undefined;
  
  // Handle specific field logic
  if (field === 'addSecondTenant') {
    const tenant2Fields = document.getElementById('tenant2Fields');
    if (tenant2Fields) {
      if (value === 'yes') {
        tenant2Fields.classList.remove('hidden');
        // Make fields required
        document.getElementById('tenant2FirstName').required = true;
        document.getElementById('tenant2LastName').required = true;
        document.getElementById('tenant2Mobile').required = true;
        // Setup DOB for tenant 2
        setupDOBInputsForTenant(2);
      } else {
        tenant2Fields.classList.add('hidden');
        // Remove required
        document.getElementById('tenant2FirstName').required = false;
        document.getElementById('tenant2LastName').required = false;
        document.getElementById('tenant2Mobile').required = false;
        // Clear values
        document.getElementById('tenant2FirstName').value = '';
        document.getElementById('tenant2LastName').value = '';
        document.getElementById('tenant2Mobile').value = '';
        document.getElementById('tenant2Email').value = '';
      }
    }
  } else if (field === 'addAdditionalDocuments') {
    const container = document.getElementById('additionalDocumentsContainer');
    if (container) {
      if (value === 'yes') {
        container.classList.remove('hidden');
        if (formState.additionalDocuments.length === 0) {
          addAnotherDocument();
        }
      } else {
        container.classList.add('hidden');
        formState.additionalDocuments = [];
        document.getElementById('additionalDocumentsList').innerHTML = '';
      }
    }
  } else if (field === 'legalFeeDirectSend' || field === 'sdltFeeDirectSend') {
    // These are handled by their respective payee change handlers
  } else if (field === 'sdltFeeEmployerMatch') {
    // Handle SDLT fee employer match
    handleSdltFeeEmployerMatchChange();
  }
  
  validateForm();
}

// ===== LEASE SECTION HANDLING =====

function handleLeaseUnderChange(event) {
  const value = event.target.value;
  const otherFields = document.getElementById('leaseOtherFields');
  
  if (otherFields) {
    if (value === 'other') {
      otherFields.classList.remove('hidden');
      document.getElementById('leaseOtherName').required = true;
      document.getElementById('leaseOtherRelation').required = true;
      document.getElementById('leaseOtherDobEntity').required = true;
    } else {
      otherFields.classList.add('hidden');
      document.getElementById('leaseOtherName').required = false;
      document.getElementById('leaseOtherRelation').required = false;
      document.getElementById('leaseOtherDobEntity').required = false;
      // Clear values
      document.getElementById('leaseOtherName').value = '';
      document.getElementById('leaseOtherRelation').value = '';
      document.getElementById('leaseOtherDobEntity').value = '';
      document.getElementById('leaseOtherEmail').value = '';
      document.getElementById('leaseOtherTel').value = '';
    }
  }
  
  validateForm();
}

// ===== LEGAL FEE SECTION HANDLING =====

function handleLegalFeePayeeChange(event) {
  const value = event.target.value;
  const otherFields = document.getElementById('legalFeeOtherFields');
  const employerFields = document.getElementById('legalFeeEmployerFields');
  const directSendContainer = document.getElementById('legalFeeDirectSendContainer');
  
  // Hide all first
  if (otherFields) otherFields.classList.add('hidden');
  if (employerFields) employerFields.classList.add('hidden');
  if (directSendContainer) directSendContainer.classList.add('hidden');
  
  if (value === 'other') {
    if (otherFields) otherFields.classList.remove('hidden');
    if (directSendContainer) directSendContainer.classList.remove('hidden');
    document.getElementById('legalFeeOtherName').required = true;
    document.getElementById('legalFeeOtherRelation').required = true;
    document.getElementById('legalFeeOtherDobEntity').required = true;
  } else if (value === 'tenant-employer') {
    if (employerFields) employerFields.classList.remove('hidden');
    if (directSendContainer) directSendContainer.classList.remove('hidden');
    document.getElementById('legalFeeEmployerName').required = true;
    // Email or phone is required (either/or) - no individual required attribute
  } else if (value === 'tenant' || value === 'dwellworks') {
    if (directSendContainer && value === 'tenant') {
      directSendContainer.classList.remove('hidden');
    }
  }
  
  // Update SDLT fee direct send prefilled value if needed
  if (value !== 'dwellworks' && directSendContainer) {
    const sdltDirectSend = document.querySelector('[data-field="sdltFeeDirectSend"]');
    if (sdltDirectSend && !document.querySelector('[data-field="sdltFeeDirectSend"].selected')) {
      // Prefill with same value as legal fee if not already set
      const legalFeeDirectSend = document.querySelector('[data-field="legalFeeDirectSend"].selected');
      if (legalFeeDirectSend) {
        const legalValue = legalFeeDirectSend.dataset.value;
        const sdltBtn = document.querySelector(`[data-field="sdltFeeDirectSend"][data-value="${legalValue}"]`);
        if (sdltBtn) {
          document.querySelectorAll('[data-field="sdltFeeDirectSend"]').forEach(b => b.classList.remove('selected'));
          sdltBtn.classList.add('selected');
          formState.sdltFeeDirectSend = legalValue === 'yes' ? true : undefined;
        }
      }
    }
  }
  
  validateForm();
}

// ===== SDLT FEE SECTION HANDLING =====

function handleSdltFeePayeeChange(event) {
  const value = event.target.value;
  const otherFields = document.getElementById('sdltFeeOtherFields');
  const employerMatchContainer = document.getElementById('sdltFeeEmployerMatchContainer');
  const employerFields = document.getElementById('sdltFeeEmployerFields');
  const directSendContainer = document.getElementById('sdltFeeDirectSendContainer');
  
  // Hide all first
  if (otherFields) otherFields.classList.add('hidden');
  if (employerMatchContainer) employerMatchContainer.classList.add('hidden');
  if (employerFields) employerFields.classList.add('hidden');
  if (directSendContainer) directSendContainer.classList.add('hidden');
  
  if (value === 'other') {
    if (otherFields) otherFields.classList.remove('hidden');
    if (directSendContainer) directSendContainer.classList.remove('hidden');
    document.getElementById('sdltFeeOtherName').required = true;
    document.getElementById('sdltFeeOtherRelation').required = true;
    document.getElementById('sdltFeeOtherDobEntity').required = true;
  } else if (value === 'tenant-employer') {
    // Check if legal fee payee is also tenant-employer and has details
    const legalFeePayee = document.querySelector('input[name="legalFeePayee"]:checked');
    if (legalFeePayee && legalFeePayee.value === 'tenant-employer' && 
        document.getElementById('legalFeeEmployerName').value.trim()) {
      if (employerMatchContainer) employerMatchContainer.classList.remove('hidden');
      // Handle match state - if match is true, fields are hidden and not required
      handleSdltFeeEmployerMatchChange();
    } else {
      if (employerFields) employerFields.classList.remove('hidden');
      // Both required when not matching
      document.getElementById('sdltFeeEmployerName').required = true;
      document.getElementById('sdltFeeEmployerContact').required = true;
    }
    if (directSendContainer) directSendContainer.classList.remove('hidden');
  } else if (value === 'tenant' || value === 'dwellworks') {
    if (directSendContainer && value === 'tenant') {
      directSendContainer.classList.remove('hidden');
    }
  }
  
  validateForm();
}

function handleSdltFeeEmployerMatchChange() {
  const matchValue = formState.sdltFeeEmployerMatch;
  const employerFields = document.getElementById('sdltFeeEmployerFields');
  
  if (employerFields) {
    if (matchValue === true) {
      employerFields.classList.add('hidden');
      // Copy values from legal fee employer
      document.getElementById('sdltFeeEmployerName').value = document.getElementById('legalFeeEmployerName').value;
      document.getElementById('sdltFeeEmployerEmail').value = document.getElementById('legalFeeEmployerEmail').value;
      document.getElementById('sdltFeeEmployerTel').value = document.getElementById('legalFeeEmployerTel').value;
      const legalTelCountryCode = document.getElementById('legalFeeEmployerTelCountryCode');
      const sdltTelCountryCode = document.getElementById('sdltFeeEmployerTelCountryCode');
      if (legalTelCountryCode && sdltTelCountryCode) {
        sdltTelCountryCode.value = legalTelCountryCode.value;
        sdltTelCountryCode.dataset.phoneCode = legalTelCountryCode.dataset.phoneCode || '';
        sdltTelCountryCode.dataset.countryCode = legalTelCountryCode.dataset.countryCode || '';
      }
      // Remove required when matching
      document.getElementById('sdltFeeEmployerName').required = false;
    } else {
      employerFields.classList.remove('hidden');
      // Name required when not matching, email or phone required (either/or)
      document.getElementById('sdltFeeEmployerName').required = true;
    }
  }
  
  validateForm();
}

// ===== DATE OF BIRTH INPUT HANDLING =====

function setupDOBInputs() {
  setupDOBInputsForTenant(1);
  setupDOBInputsForTenant(2);
}

function setupDOBInputsForTenant(tenantNum) {
  const inputs = [];
  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`tenant${tenantNum}Dob${i}`);
    if (input) inputs.push(input);
  }
  
  if (inputs.length !== 8) return;
  
  inputs.forEach((input, index) => {
    input.addEventListener('input', function(e) {
      const value = e.target.value.replace(/[^0-9]/g, '');
      e.target.value = value;
      
      if (value.length === 1 && index < 7) {
        inputs[index + 1].focus();
      }
    });
    
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
    
    input.addEventListener('paste', function(e) {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
      if (pasted.length === 8) {
        for (let i = 0; i < 8; i++) {
          inputs[i].value = pasted[i];
        }
        inputs[7].focus();
      }
    });
  });
}

// ===== ADDRESS AUTOCOMPLETE =====

function setupAddressAutocomplete() {
  // SDLT Address (always UK)
  const sdltAddressInput = document.getElementById('sdltAddress');
  const sdltAddressDropdown = document.getElementById('sdltAddressDropdown');
  const sdltAddressNotListed = document.getElementById('sdltAddressNotListed');
  
  if (sdltAddressInput && sdltAddressDropdown) {
    setupAddressAutocompleteField(sdltAddressInput, sdltAddressDropdown, 'sdlt', () => {
      if (sdltAddressNotListed) {
        sdltAddressNotListed.checked = false;
        document.getElementById('sdltManualAddressFields').classList.add('hidden');
      }
    });
  }
  
  if (sdltAddressNotListed) {
    sdltAddressNotListed.addEventListener('change', function() {
      const manualFields = document.getElementById('sdltManualAddressFields');
      if (this.checked) {
        manualFields.classList.remove('hidden');
        sdltAddressInput.value = '';
        sdltAddressDropdown.classList.add('hidden');
      } else {
        manualFields.classList.add('hidden');
      }
    });
  }
  
  // Previous Address
  const previousAddressInput = document.getElementById('previousAddress');
  const previousAddressDropdown = document.getElementById('previousAddressDropdown');
  const previousAddressCountry = document.getElementById('previousAddressCountry');
  const previousAddressNotListed = document.getElementById('previousAddressNotListed');
  
  if (previousAddressInput && previousAddressDropdown && previousAddressCountry) {
    // Function to handle country change and setup autocomplete
    const handleCountryChange = function() {
      const countryCode = this.dataset.countryCode;
      const isUK = countryCode === 'GBR' || this.value.toLowerCase().includes('united kingdom');
      
      if (isUK) {
        document.getElementById('previousAddressUkRow').classList.remove('hidden');
        document.getElementById('previousAddressUkControls').classList.remove('hidden');
        setupAddressAutocompleteField(previousAddressInput, previousAddressDropdown, 'previous', () => {
          if (previousAddressNotListed) {
            previousAddressNotListed.checked = false;
            document.getElementById('previousManualAddressFields').classList.add('hidden');
          }
        });
      } else {
        document.getElementById('previousAddressUkRow').classList.add('hidden');
        document.getElementById('previousAddressUkControls').classList.add('hidden');
        previousAddressInput.value = '';
        previousAddressDropdown.classList.add('hidden');
        if (previousAddressNotListed) {
          previousAddressNotListed.checked = true;
          document.getElementById('previousManualAddressFields').classList.remove('hidden');
        }
      }
    };
    
    // Set up change event listener
    previousAddressCountry.addEventListener('change', handleCountryChange);
    
    // Also check initial state and set up autocomplete if country is already UK
    const countryCode = previousAddressCountry.dataset.countryCode;
    const isUK = countryCode === 'GBR' || previousAddressCountry.value.toLowerCase().includes('united kingdom');
    if (isUK) {
      // Trigger the handler to set up autocomplete for initial UK state
      handleCountryChange.call(previousAddressCountry);
    }
  }
  
  if (previousAddressNotListed) {
    previousAddressNotListed.addEventListener('change', function() {
      const manualFields = document.getElementById('previousManualAddressFields');
      if (this.checked) {
        manualFields.classList.remove('hidden');
        previousAddressInput.value = '';
        previousAddressDropdown.classList.add('hidden');
      } else {
        manualFields.classList.add('hidden');
      }
    });
  }
}

function setupAddressAutocompleteField(input, dropdown, fieldType, onSelect) {
  let selectedIndex = -1;
  
  input.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    if (fieldType === 'sdlt') {
      if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
    } else {
      if (previousAddressDebounceTimer) clearTimeout(previousAddressDebounceTimer);
    }
    
    if (fieldType === 'sdlt') {
      sdltAddressObject = null;
    } else {
      previousAddressObject = null;
    }
    
    if (searchTerm.length < 7) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }
    
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = '<div class="address-loading">Searching addresses...</div>';
    
    const timer = setTimeout(() => {
      window.parent.postMessage({
        type: 'address-search',
        searchTerm: searchTerm,
        field: fieldType
      }, '*');
    }, 300);
    
    if (fieldType === 'sdlt') {
      addressDebounceTimer = timer;
    } else {
      previousAddressDebounceTimer = timer;
    }
  });
  
  input.addEventListener('keydown', function(e) {
    const items = dropdown.querySelectorAll('.address-dropdown-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      items[selectedIndex].scrollIntoView({ block: 'nearest' });
      items.forEach((item, idx) => {
        item.style.background = idx === selectedIndex ? '#f0f0f0' : '';
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      items.forEach((item, idx) => {
        item.style.background = idx === selectedIndex ? '#f0f0f0' : '';
      });
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    }
  });
}

// ===== COMPANIES HOUSE INTEGRATION =====

function setupCompaniesHouseIntegration() {
  const employerNameInput = document.getElementById('employerName');
  const employerNameDropdown = document.getElementById('employerNameDropdown');
  const employerNumberInput = document.getElementById('employerNumber');
  const employerNumberDropdown = document.getElementById('employerNumberDropdown');
  const employerCountry = document.getElementById('employerCountry');
  const employerLinkBtn = document.getElementById('employerLinkBtn');
  const employerRefreshBtn = document.getElementById('employerRefreshBtn');
  
  if (!employerNameInput || !employerCountry) return;
  
  // Function to handle country change and setup autocomplete
  const handleCountryChange = function() {
    const countryCode = this.dataset.jurisdictionCode;
    const isUK = countryCode === 'GB';
    
    if (isUK && employerNameInput && employerNameDropdown) {
      setupCompanyNameAutocomplete(employerNameInput, employerNameDropdown);
    } else {
      // Clear company data if not UK
      if (employerLinkBtn) employerLinkBtn.classList.add('hidden');
      if (employerRefreshBtn) employerRefreshBtn.classList.add('hidden');
      if (employerNameDropdown) employerNameDropdown.classList.add('hidden');
      if (employerNumberDropdown) employerNumberDropdown.classList.add('hidden');
    }
  };
  
  // Set up change event listener
  employerCountry.addEventListener('change', handleCountryChange);
  
  // Also check initial state and set up autocomplete if country is already UK
  const countryCode = employerCountry.dataset.jurisdictionCode;
  const isUK = countryCode === 'GB';
  if (isUK && employerNameInput && employerNameDropdown) {
    setupCompanyNameAutocomplete(employerNameInput, employerNameDropdown);
  }
  
  if (employerNumberInput && employerNumberDropdown) {
    setupCompanyNumberAutocomplete(employerNumberInput, employerNumberDropdown);
  }
  
  if (employerLinkBtn) {
    employerLinkBtn.addEventListener('click', function() {
      const companyNumber = employerNumberInput.dataset.organisationNumber;
      if (companyNumber) {
        window.open(`https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`, '_blank');
      }
    });
  }
  
  if (employerRefreshBtn) {
    employerRefreshBtn.addEventListener('click', function() {
      const companyNumber = employerNumberInput.dataset.organisationNumber;
      if (companyNumber) {
        window.parent.postMessage({
          type: 'company-lookup',
          companyNumber: companyNumber
        }, '*');
      }
    });
  }
}

function setupCompanyNameAutocomplete(input, dropdown) {
  // Check if already set up to avoid duplicate listeners
  if (input.dataset.autocompleteSetup === 'true') {
    return;
  }
  input.dataset.autocompleteSetup = 'true';
  
  input.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    if (companyNameDebounceTimer) clearTimeout(companyNameDebounceTimer);
    
    // Hide the number dropdown when searching by name
    const numberDropdown = document.getElementById('employerNumberDropdown');
    if (numberDropdown) {
      numberDropdown.classList.add('hidden');
      numberDropdown.innerHTML = '';
    }
    
    if (searchTerm.length < 3) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }
    
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
    
    companyNameDebounceTimer = setTimeout(() => {
      window.parent.postMessage({
        type: 'company-search',
        searchTerm: searchTerm
      }, '*');
    }, 300);
  });
}

function setupCompanyNumberAutocomplete(input, dropdown) {
  input.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    if (companyNumberDebounceTimer) clearTimeout(companyNumberDebounceTimer);
    
    // Hide the name dropdown when searching by number
    const nameDropdown = document.getElementById('employerNameDropdown');
    if (nameDropdown) {
      nameDropdown.classList.add('hidden');
      nameDropdown.innerHTML = '';
    }
    
    if (searchTerm.length < 2) {
      dropdown.classList.add('hidden');
      dropdown.innerHTML = '';
      return;
    }
    
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
    
    companyNumberDebounceTimer = setTimeout(() => {
      window.parent.postMessage({
        type: 'company-search',
        searchTerm: searchTerm,
        byNumber: true
      }, '*');
    }, 300);
  });
}

// ===== FILE UPLOAD HANDLING =====

function triggerLeaseFileInput() {
  if (formState.isEditMode) {
    showError('Cannot upload new lease document in edit mode. Please use the documents viewer to add additional documents.');
    return;
  }
  const fileInput = document.getElementById('leaseFileInput');
  if (fileInput) fileInput.click();
}

function handleLeaseFileSelect(event) {
  if (formState.isEditMode) {
    showError('Cannot upload new lease document in edit mode. Please use the documents viewer to add additional documents.');
    return;
  }
  const file = event.target.files[0];
  if (file) {
    handleFileUpload(file, 'lease');
  }
}

function handleLeaseDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  if (formState.isEditMode) {
    showError('Cannot upload new lease document in edit mode. Please use the documents viewer to add additional documents.');
    return;
  }
  const uploadArea = document.getElementById('leaseUploadArea');
  if (uploadArea) uploadArea.classList.remove('dragover');
  
  const file = event.dataTransfer.files[0];
  if (file) {
    handleFileUpload(file, 'lease');
  }
}

function handleLeaseDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  const uploadArea = document.getElementById('leaseUploadArea');
  if (uploadArea) uploadArea.classList.add('dragover');
}

function handleLeaseDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  const uploadArea = document.getElementById('leaseUploadArea');
  if (uploadArea) uploadArea.classList.remove('dragover');
}

function handleFileUpload(file, type) {
  // Request PUT URL from parent
  window.parent.postMessage({
    type: 'request-upload-url',
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    uploadType: type,
    bucket: 'sdlt-documents'
  }, '*');
  
  // Store file temporarily
  if (type === 'lease') {
    formState.leaseDocument = {
      file: file,
      name: file.name,
      type: file.type,
      size: file.size
    };
    updateLeaseUploadUI(file.name);
  } else if (type === 'additional') {
    // Will be handled by addAnotherDocument
  }
}

function updateLeaseUploadUI(fileName) {
  const uploadText = document.getElementById('leaseUploadText');
  if (uploadText) {
    uploadText.textContent = fileName;
  }
}

// ===== ADDITIONAL DOCUMENTS =====

let additionalDocumentCounter = 0;

function addAnotherDocument() {
  if (formState.isEditMode) {
    showError('Cannot add additional documents in edit mode. Please use the documents viewer to add additional documents.');
    return;
  }
  if (formState.additionalDocuments.length >= 10) {
    showError('Maximum 10 additional documents allowed');
    return;
  }
  
  const container = document.getElementById('additionalDocumentsList');
  if (!container) return;
  
  const docId = `doc_${++additionalDocumentCounter}`;
  const docItem = {
    id: docId,
    title: '',
    description: '',
    file: null
  };
  
  formState.additionalDocuments.push(docItem);
  
  const docHTML = `
    <div class="additional-document-item" data-doc-id="${docId}">
      <button type="button" class="remove-document-btn" onclick="removeAdditionalDocument('${docId}')" title="Remove document">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="document-upload-column">
        <label for="${docId}_file" class="required">Document</label>
        <div class="upload-area" onclick="triggerAdditionalFileInput('${docId}')" ondrop="handleAdditionalDrop(event, '${docId}')" ondragover="handleAdditionalDragOver(event)" ondragleave="handleAdditionalDragLeave(event)" id="${docId}_uploadArea">
          <div class="upload-icon" id="${docId}_uploadIcon">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17,8 12,3 7,8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div class="upload-text" id="${docId}_uploadText">Upload Document</div>
          <input type="file" class="file-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/rtf" id="${docId}_fileInput" onchange="handleAdditionalFileSelect(event, '${docId}')">
        </div>
      </div>
      <div class="document-details-column">
        <div>
          <label for="${docId}_title" class="required">Title</label>
          <input type="text" id="${docId}_title" name="${docId}_title" required />
        </div>
        <div>
          <label for="${docId}_description">Description</label>
          <textarea id="${docId}_description" name="${docId}_description" rows="2"></textarea>
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', docHTML);
  
  // Setup event listeners for new inputs
  const titleInput = document.getElementById(`${docId}_title`);
  const descInput = document.getElementById(`${docId}_description`);
  if (titleInput) titleInput.addEventListener('input', validateForm);
  if (descInput) descInput.addEventListener('input', validateForm);
  
  // Hide "Add Another Document" button if we've reached the limit
  const addBtn = document.getElementById('addAnotherDocumentBtn');
  if (addBtn && formState.additionalDocuments.length >= 10) {
    addBtn.style.display = 'none';
  }
  
  validateForm();
}

// Global functions for additional documents (called from HTML)
window.triggerAdditionalFileInput = function(docId) {
  const fileInput = document.getElementById(`${docId}_fileInput`);
  if (fileInput) fileInput.click();
};

window.handleAdditionalFileSelect = function(event, docId) {
  const file = event.target.files[0];
  if (file) {
    handleAdditionalFileUpload(file, docId);
  }
};

window.handleAdditionalDrop = function(event, docId) {
  event.preventDefault();
  event.stopPropagation();
  const uploadArea = document.getElementById(`${docId}_uploadArea`);
  if (uploadArea) uploadArea.classList.remove('dragover');
  
  const file = event.dataTransfer.files[0];
  if (file) {
    handleAdditionalFileUpload(file, docId);
  }
};

window.handleAdditionalDragOver = function(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.add('dragover');
};

window.handleAdditionalDragLeave = function(event) {
  event.preventDefault();
  event.stopPropagation();
  event.currentTarget.classList.remove('dragover');
};

window.removeAdditionalDocument = function(docId) {
  const docItem = document.querySelector(`[data-doc-id="${docId}"]`);
  if (docItem) {
    docItem.remove();
    formState.additionalDocuments = formState.additionalDocuments.filter(doc => doc.id !== docId);
    
    // Show "Add Another Document" button if we're below the limit
    const addBtn = document.getElementById('addAnotherDocumentBtn');
    if (addBtn && formState.additionalDocuments.length < 10) {
      addBtn.style.display = 'block';
    }
    
    validateForm();
  }
};

function handleAdditionalFileUpload(file, docId) {
  const docItem = formState.additionalDocuments.find(doc => doc.id === docId);
  if (docItem) {
    docItem.file = file;
    docItem.name = file.name;
    docItem.type = file.type;
    docItem.size = file.size;
    
    const uploadText = document.getElementById(`${docId}_uploadText`);
    if (uploadText) {
      uploadText.textContent = file.name;
    }
    
    // Request PUT URL from parent
    window.parent.postMessage({
      type: 'request-upload-url',
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      uploadType: 'additional',
      bucket: 'sdlt-documents',
      docId: docId
    }, '*');
  }
  
  validateForm();
}

// ===== CONTACT ITEMS =====
// Note: Employer contact fields are now static inputs, not dynamic containers

// ===== SDLT ADDRESS VALIDATION =====

function setupSDLTAddressValidation() {
  const manualFields = document.getElementById('sdltManualAddressFields');
  if (!manualFields) return;
  
  const container = manualFields.querySelector('.manual-address-container');
  if (!container) return;
  
  // Get all manual address input fields
  const flatNumber = document.getElementById('sdltFlatNumber');
  const buildingNumber = document.getElementById('sdltBuildingNumber');
  const buildingName = document.getElementById('sdltBuildingName');
  const street = document.getElementById('sdltStreet');
  const town = document.getElementById('sdltTown');
  const postcode = document.getElementById('sdltPostcode');
  
  // Function to validate address according to Thirdfort minimum requirements
  function validateSDLTAddress() {
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
  const fields = [flatNumber, buildingNumber, buildingName, street, town, postcode];
  fields.forEach(field => {
    if (field) {
      field.addEventListener('input', validateSDLTAddress);
      field.addEventListener('keyup', validateSDLTAddress);
      field.addEventListener('change', validateSDLTAddress);
    }
  });
  
  // Initial validation
  validateSDLTAddress();
}

// ===== FORM VALIDATION =====

function setupFormValidation() {
  validateForm();
}

function validateForm() {
  let isValid = true;
  
  // Check required fields
  const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
  requiredInputs.forEach(input => {
    if (!input.value.trim() && !input.closest('.hidden')) {
      isValid = false;
    }
  });
  
  // Validate tenant mobile numbers with libphonenumber
  // Tenant 1 mobile (always required)
  const tenant1MobileCountryCode = document.getElementById('tenant1MobileCountryCode');
  const tenant1Mobile = document.getElementById('tenant1Mobile');
  if (tenant1Mobile && tenant1MobileCountryCode && !tenant1Mobile.closest('.hidden')) {
    if (tenant1Mobile.value.trim()) {
      const phoneCode = tenant1MobileCountryCode.dataset.phoneCode || '';
      const phoneNumber = tenant1Mobile.value.trim();
      const fullNumber = phoneCode + phoneNumber;
      
      if (!validatePhoneNumberWithLibPhone(fullNumber)) {
        isValid = false;
        tenant1Mobile.setCustomValidity('Please enter a valid mobile number');
      } else {
        tenant1Mobile.setCustomValidity('');
      }
    }
  }
  
  // Tenant 2 mobile (only if second tenant is added)
  if (formState.addSecondTenant) {
    const tenant2MobileCountryCode = document.getElementById('tenant2MobileCountryCode');
    const tenant2Mobile = document.getElementById('tenant2Mobile');
    if (tenant2Mobile && tenant2MobileCountryCode && !tenant2Mobile.closest('.hidden')) {
      if (tenant2Mobile.value.trim()) {
        const phoneCode = tenant2MobileCountryCode.dataset.phoneCode || '';
        const phoneNumber = tenant2Mobile.value.trim();
        const fullNumber = phoneCode + phoneNumber;
        
        if (!validatePhoneNumberWithLibPhone(fullNumber)) {
          isValid = false;
          tenant2Mobile.setCustomValidity('Please enter a valid mobile number');
        } else {
          tenant2Mobile.setCustomValidity('');
        }
      }
    }
  }
  
  // Check required checkboxes
  const requiredCheckboxes = document.querySelectorAll('input[type="checkbox"][required]');
  requiredCheckboxes.forEach(checkbox => {
    if (!checkbox.checked && !checkbox.closest('.hidden')) {
      isValid = false;
    }
  });
  
  // Check all radio groups are required
  const requiredRadioGroups = ['leaseUnder', 'legalFeePayee', 'sdltFeePayee'];
  requiredRadioGroups.forEach(groupName => {
    const checked = document.querySelector(`input[name="${groupName}"]:checked`);
    const groupContainer = document.querySelector(`input[name="${groupName}"]`)?.closest('.section, .form-grid, .row');
    if (!checked && groupContainer && !groupContainer.classList.contains('hidden')) {
      isValid = false;
    }
  });
  
  // Validate conditional fields based on radio selections
  const leaseUnder = document.querySelector('input[name="leaseUnder"]:checked')?.value;
  if (leaseUnder === 'other') {
    const leaseOtherName = document.getElementById('leaseOtherName');
    const leaseOtherRelation = document.getElementById('leaseOtherRelation');
    const leaseOtherDobEntity = document.getElementById('leaseOtherDobEntity');
    const leaseOtherEmail = document.getElementById('leaseOtherEmail');
    const leaseOtherTel = document.getElementById('leaseOtherTel');
    
    if (!leaseOtherName?.value.trim() || !leaseOtherRelation?.value.trim() || !leaseOtherDobEntity?.value.trim()) {
      isValid = false;
    }
    // Email or tel is required (either/or)
    if ((!leaseOtherEmail?.value.trim() && !leaseOtherTel?.value.trim())) {
      isValid = false;
    }
  }
  
  const legalFeePayee = document.querySelector('input[name="legalFeePayee"]:checked')?.value;
  if (legalFeePayee === 'other') {
    const legalFeeOtherName = document.getElementById('legalFeeOtherName');
    const legalFeeOtherRelation = document.getElementById('legalFeeOtherRelation');
    const legalFeeOtherDobEntity = document.getElementById('legalFeeOtherDobEntity');
    const legalFeeOtherEmail = document.getElementById('legalFeeOtherEmail');
    const legalFeeOtherTel = document.getElementById('legalFeeOtherTel');
    
    if (!legalFeeOtherName?.value.trim() || !legalFeeOtherRelation?.value.trim() || !legalFeeOtherDobEntity?.value.trim()) {
      isValid = false;
    }
    // Email or tel is required (either/or)
    if ((!legalFeeOtherEmail?.value.trim() && !legalFeeOtherTel?.value.trim())) {
      isValid = false;
    }
  }
  
  if (legalFeePayee === 'tenant-employer') {
    const legalFeeEmployerName = document.getElementById('legalFeeEmployerName');
    const legalFeeEmployerEmail = document.getElementById('legalFeeEmployerEmail');
    const legalFeeEmployerTel = document.getElementById('legalFeeEmployerTel');
    
    if (!legalFeeEmployerName?.value.trim()) {
      isValid = false;
    }
    // Either email or phone is required
    if (!legalFeeEmployerEmail?.value.trim() && !legalFeeEmployerTel?.value.trim()) {
      isValid = false;
    }
  }
  
  const sdltFeePayee = document.querySelector('input[name="sdltFeePayee"]:checked')?.value;
  if (sdltFeePayee === 'other') {
    const sdltFeeOtherName = document.getElementById('sdltFeeOtherName');
    const sdltFeeOtherRelation = document.getElementById('sdltFeeOtherRelation');
    const sdltFeeOtherDobEntity = document.getElementById('sdltFeeOtherDobEntity');
    const sdltFeeOtherEmail = document.getElementById('sdltFeeOtherEmail');
    const sdltFeeOtherTel = document.getElementById('sdltFeeOtherTel');
    
    if (!sdltFeeOtherName?.value.trim() || !sdltFeeOtherRelation?.value.trim() || !sdltFeeOtherDobEntity?.value.trim()) {
      isValid = false;
    }
    // Email or tel is required (either/or)
    if ((!sdltFeeOtherEmail?.value.trim() && !sdltFeeOtherTel?.value.trim())) {
      isValid = false;
    }
  }
  
  if (sdltFeePayee === 'tenant-employer') {
    // If match is "no", employer details are required
    const sdltFeeEmployerMatchContainer = document.getElementById('sdltFeeEmployerMatchContainer');
    if (sdltFeeEmployerMatchContainer && !sdltFeeEmployerMatchContainer.classList.contains('hidden')) {
      if (formState.sdltFeeEmployerMatch !== true) {
        const sdltFeeEmployerName = document.getElementById('sdltFeeEmployerName');
        const sdltFeeEmployerEmail = document.getElementById('sdltFeeEmployerEmail');
        const sdltFeeEmployerTel = document.getElementById('sdltFeeEmployerTel');
        
        if (!sdltFeeEmployerName?.value.trim()) {
          isValid = false;
        }
        // Either email or phone is required
        if (!sdltFeeEmployerEmail?.value.trim() && !sdltFeeEmployerTel?.value.trim()) {
          isValid = false;
        }
      }
    }
  }
  
  // Check all YES/NO buttons are required when visible
  // addSecondTenant - always visible, always required
  const addSecondTenantContainer = document.querySelector('[data-field="addSecondTenant"]')?.closest('.yes-no-container');
  if (addSecondTenantContainer && !addSecondTenantContainer.classList.contains('hidden')) {
    const hasSelected = Array.from(addSecondTenantContainer.querySelectorAll('.yes-no-btn')).some(btn => btn.classList.contains('selected'));
    if (!hasSelected) {
      isValid = false;
    }
  }
  
  // addAdditionalDocuments - always visible, always required
  const addAdditionalDocumentsContainer = document.querySelector('[data-field="addAdditionalDocuments"]')?.closest('.yes-no-container');
  if (addAdditionalDocumentsContainer && !addAdditionalDocumentsContainer.classList.contains('hidden')) {
    const hasSelected = Array.from(addAdditionalDocumentsContainer.querySelectorAll('.yes-no-btn')).some(btn => btn.classList.contains('selected'));
    if (!hasSelected) {
      isValid = false;
    }
  }
  
  // legalFeeDirectSend - required when visible (when legalFeePayee is not 'dwellworks')
  const legalFeeDirectSendContainer = document.getElementById('legalFeeDirectSendContainer');
  if (legalFeeDirectSendContainer && !legalFeeDirectSendContainer.classList.contains('hidden')) {
    const hasSelection = formState.legalFeeDirectSend !== null && formState.legalFeeDirectSend !== undefined;
    if (!hasSelection) {
      isValid = false;
    }
  }
  
  // sdltFeeDirectSend - required when visible (when sdltFeePayee is not 'dwellworks')
  const sdltFeeDirectSendContainer = document.getElementById('sdltFeeDirectSendContainer');
  if (sdltFeeDirectSendContainer && !sdltFeeDirectSendContainer.classList.contains('hidden')) {
    const hasSelection = formState.sdltFeeDirectSend !== null && formState.sdltFeeDirectSend !== undefined;
    if (!hasSelection) {
      isValid = false;
    }
  }
  
  // sdltFeeEmployerMatch - required when visible (when both legal and sdlt are 'tenant-employer')
  const sdltFeeEmployerMatchContainer = document.getElementById('sdltFeeEmployerMatchContainer');
  if (sdltFeeEmployerMatchContainer && !sdltFeeEmployerMatchContainer.classList.contains('hidden')) {
    const hasMatchSelection = formState.sdltFeeEmployerMatch !== null && formState.sdltFeeEmployerMatch !== undefined;
    if (!hasMatchSelection) {
      isValid = false;
    }
  }
  
  // Check file uploads
  if (!formState.leaseDocument) {
    const leaseFileInput = document.getElementById('leaseFileInput');
    if (leaseFileInput && !leaseFileInput.closest('.hidden')) {
      isValid = false;
    }
  }
  
  // Check additional documents if enabled
  if (formState.addAdditionalDocuments) {
    formState.additionalDocuments.forEach(doc => {
      const titleInput = document.getElementById(`${doc.id}_title`);
      const fileInput = document.getElementById(`${doc.id}_fileInput`);
      if (titleInput && !titleInput.value.trim()) {
        isValid = false;
      }
      if (!doc.file && fileInput) {
        isValid = false;
      }
    });
  }
  
  // Submit button is always enabled - validation happens on submit
  return isValid;
}

// ===== PARENT MESSAGE HANDLING =====

function handleParentMessage(event) {
  const message = event.data;
  
  if (!message || !message.type) return;
  
  switch (message.type) {
    case 'submitter-data':
      handleSubmitterData(message);
      break;
    case 'address-results':
      const addressResultsData = message.data || message;
      displayAddressSuggestions(addressResultsData.suggestions, addressResultsData.field);
      break;
    case 'address-data':
      const addressDataMsg = message.data || message;
      handleAddressData(addressDataMsg.address, addressDataMsg.field);
      break;
    case 'company-results':
      const companyResultsData = message.data || message;
      displayCompanySuggestions(companyResultsData.companies, companyResultsData.byNumber);
      break;
    case 'company-data':
      const companyData = message.data || message;
      handleCompanyData(companyData.company || companyData);
      break;
    case 'upload-url':
      handleUploadUrl(message);
      break;
    case 'put-links':
      handlePutLinks(message);
      break;
    case 'put-error':
      handlePutError(message);
      break;
    case 'upload-error':
      handleUploadError(message);
      break;
    case 'edit-request':
      handleEditRequest(message);
      break;
    case 'session-updated':
      handleSessionUpdated(message);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

function handleSubmitterData(message) {
  const data = message.data || message;
  
  if (data.firstName) {
    const input = document.getElementById('submitterFirstName');
    if (input) input.value = data.firstName;
  }
  
  if (data.lastName) {
    const input = document.getElementById('submitterLastName');
    if (input) input.value = data.lastName;
  }
  
  if (data.email) {
    const input = document.getElementById('submitterEmail');
    if (input) input.value = data.email;
  }
  
  if (data.phone) {
    const input = document.getElementById('submitterPhone');
    if (input) input.value = data.phone;
  }
  
  if (data.phoneCountryCode) {
    const input = document.getElementById('submitterPhoneCountryCode');
    if (input) {
      input.value = data.phoneCountryCode;
      input.dataset.phoneCode = data.phoneCode || '+44';
      input.dataset.countryCode = data.countryCode || 'GB';
    }
  }
  
  if (data.dwellworksReference) {
    const input = document.getElementById('dwellworksReference');
    if (input) input.value = data.dwellworksReference;
  }
  
  // Mark submitter data as received and enable submit button
  formState.submitterDataReceived = true;
  if (elements.submitBtn) {
    elements.submitBtn.disabled = false;
  }
  
  // Start session countdown
  startSessionCountdown();
  
  validateForm();
}

/**
 * Handle edit-request message - populate form with existing submission data
 */
function handleEditRequest(message) {
  const submissionData = message.data || message;
  
  // Store original submission for comparison
  formState.originalSubmission = JSON.parse(JSON.stringify(submissionData));
  formState.isEditMode = true;
  
  // Populate form with submission data
  populateFormFromSubmission(submissionData);
  
  // Mark submitter data as received and enable submit button
  formState.submitterDataReceived = true;
  if (elements.submitBtn) {
    elements.submitBtn.disabled = false;
    elements.submitBtn.textContent = 'Save Changes';
  }
  
  // Start session countdown (same as submitter-data)
  startSessionCountdown();
  
  // Update UI for edit mode
  updateUIForEditMode(submissionData);
  
  validateForm();
}

/**
 * Populate form fields from submission data
 */
function populateFormFromSubmission(data) {
  // Your Details
  if (data.submitterFirstName) {
    const input = document.getElementById('submitterFirstName');
    if (input) input.value = data.submitterFirstName;
  }
  if (data.submitterLastName) {
    const input = document.getElementById('submitterLastName');
    if (input) input.value = data.submitterLastName;
  }
  if (data.dwellworksReference) {
    const input = document.getElementById('dwellworksReference');
    if (input) input.value = data.dwellworksReference;
  }
  if (data.dwellworksContactNumber) {
    // Parse phone number and country code
    const phoneMatch = data.dwellworksContactNumber?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('submitterPhoneCountryCode');
      const phoneInput = document.getElementById('submitterPhone');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        countryCodeInput.value = phoneMatch[1]; // You may want to format this better
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.dwellworksContactNumber) {
      const phoneInput = document.getElementById('submitterPhone');
      if (phoneInput) phoneInput.value = data.dwellworksContactNumber;
    }
  }
  if (data.dwellworksEmail) {
    const input = document.getElementById('submitterEmail');
    if (input) input.value = data.dwellworksEmail;
  }
  if (data.sharedEmail) {
    const input = document.getElementById('shareEmail');
    if (input) input.value = data.sharedEmail;
  }
  
  // SDLT Address and Move In Date
  if (data.sdltAddressMoveInDate) {
    const input = document.getElementById('moveInDate');
    if (input) {
      // Convert DD-MM-YYYY to YYYY-MM-DD for date input
      const dateParts = data.sdltAddressMoveInDate.split('-');
      if (dateParts.length === 3) {
        input.value = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
      }
    }
  }
  if (data.sdltAddress) {
    sdltAddressObject = data.sdltAddress;
    const input = document.getElementById('sdltAddress');
    if (input) {
      // Format address for display
      const addrParts = [];
      if (data.sdltAddress.building_number) addrParts.push(data.sdltAddress.building_number);
      if (data.sdltAddress.building_name) addrParts.push(data.sdltAddress.building_name);
      if (data.sdltAddress.street) addrParts.push(data.sdltAddress.street);
      if (data.sdltAddress.town) addrParts.push(data.sdltAddress.town);
      if (data.sdltAddress.postcode) addrParts.push(data.sdltAddress.postcode);
      input.value = addrParts.join(', ');
    }
  }
  
  // Lease Note
  if (data.leaseAgreementNote) {
    const input = document.getElementById('leaseNote');
    if (input) input.value = data.leaseAgreementNote;
  }
  
  // Lease Under
  if (data.lessee) {
    const technicalValue = getRadioTechnicalValue(data.lessee);
    const radio = document.querySelector(`input[name="leaseUnder"][value="${technicalValue}"]`);
    if (!radio) {
      // Try alternative value (tenants-employer vs tenant-employer)
      const altValue = technicalValue === 'tenant-employer' ? 'tenants-employer' : (technicalValue === 'tenants-employer' ? 'tenant-employer' : technicalValue);
      const altRadio = document.querySelector(`input[name="leaseUnder"][value="${altValue}"]`);
      if (altRadio) {
        altRadio.checked = true;
        const event = new Event('change', { bubbles: true });
        altRadio.dispatchEvent(event);
      }
    } else {
      radio.checked = true;
      // Trigger change to show/hide other fields
      const event = new Event('change', { bubbles: true });
      radio.dispatchEvent(event);
    }
  }
  
  // Lessee Other fields
  if (data.lesseeOther) {
    const input = document.getElementById('leaseOtherName');
    if (input) input.value = data.lesseeOther;
  }
  if (data.lesseeRelationToTenant) {
    const input = document.getElementById('leaseOtherRelation');
    if (input) input.value = data.lesseeRelationToTenant;
  }
  if (data.lesseeDateOfBirthEntityNumber) {
    const input = document.getElementById('leaseOtherDobEntity');
    if (input) input.value = data.lesseeDateOfBirthEntityNumber;
  }
  if (data.lesseePhoneNumber) {
    // Parse phone number and country code
    const phoneMatch = data.lesseePhoneNumber?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('leaseOtherTelCountryCode');
      const phoneInput = document.getElementById('leaseOtherTel');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        countryCodeInput.value = phoneMatch[1];
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.lesseePhoneNumber) {
      const phoneInput = document.getElementById('leaseOtherTel');
      if (phoneInput) phoneInput.value = data.lesseePhoneNumber;
    }
  }
  if (data.lesseeEmail) {
    const input = document.getElementById('leaseOtherEmail');
    if (input) input.value = data.lesseeEmail;
  }
  
  // Tenant 1
  if (data.tenantsFirstName) {
    const input = document.getElementById('tenant1FirstName');
    if (input) input.value = data.tenantsFirstName;
  }
  if (data.tenantLastName) {
    const input = document.getElementById('tenant1LastName');
    if (input) input.value = data.tenantLastName;
  }
  if (data.tenantDateOfBirth) {
    // Parse DD-MM-YYYY and populate DOB inputs
    const dobParts = data.tenantDateOfBirth.split(/[-\/]/);
    if (dobParts.length === 3) {
      const day = dobParts[0].padStart(2, '0');
      const month = dobParts[1].padStart(2, '0');
      const year = dobParts[2];
      const dobStr = day + month + year;
      for (let i = 0; i < 8 && i < dobStr.length; i++) {
        const input = document.getElementById(`tenant1Dob${i + 1}`);
        if (input) input.value = dobStr[i];
      }
    }
  }
  if (data.tenantsMobileNumber) {
    const phoneMatch = data.tenantsMobileNumber?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('tenant1MobileCountryCode');
      const phoneInput = document.getElementById('tenant1Mobile');
      if (countryCodeInput) countryCodeInput.dataset.phoneCode = phoneMatch[1];
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.tenantsMobileNumber) {
      const phoneInput = document.getElementById('tenant1Mobile');
      if (phoneInput) phoneInput.value = data.tenantsMobileNumber;
    }
  }
  if (data.tenantsEmail) {
    const input = document.getElementById('tenant1Email');
    if (input) input.value = data.tenantsEmail;
  }
  
  // Previous Address
  if (data.previousAddress) {
    previousAddressObject = data.previousAddress;
    const input = document.getElementById('previousAddress');
    if (input) {
      const addrParts = [];
      if (data.previousAddress.building_number) addrParts.push(data.previousAddress.building_number);
      if (data.previousAddress.building_name) addrParts.push(data.previousAddress.building_name);
      if (data.previousAddress.street) addrParts.push(data.previousAddress.street);
      if (data.previousAddress.town) addrParts.push(data.previousAddress.town);
      if (data.previousAddress.postcode) addrParts.push(data.previousAddress.postcode);
      input.value = addrParts.join(', ');
    }
  }
  if (data.previousAddressCountry) {
    const input = document.getElementById('previousAddressCountry');
    if (input) input.value = data.previousAddressCountry;
  }
  
  // Employer
  if (data.employerCountry) {
    const input = document.getElementById('employerCountry');
    if (input) input.value = data.employerCountry;
  }
  if (data.employerName) {
    const input = document.getElementById('employerName');
    if (input) input.value = data.employerName;
  }
  if (data.employerNumber) {
    const input = document.getElementById('employerNumber');
    if (input) input.value = data.employerNumber;
  }
  
  // Second Tenant
  if (data.secondTenant === true) {
    // Enable second tenant
    const yesBtn = document.querySelector('[data-field="addSecondTenant"][data-value="yes"]');
    if (yesBtn) {
      yesBtn.click();
    }
  } else if (data.secondTenant === undefined) {
    const noBtn = document.querySelector('[data-field="addSecondTenant"][data-value="no"]');
    if (noBtn) noBtn.click();
  }
  
  // Populate second tenant fields if they exist
  if (data.secondTenantFirstName || data.secondTenantLastName) {
    if (data.secondTenantFirstName) {
      const input = document.getElementById('tenant2FirstName');
      if (input) input.value = data.secondTenantFirstName;
    }
    if (data.secondTenantLastName) {
      const input = document.getElementById('tenant2LastName');
      if (input) input.value = data.secondTenantLastName;
    }
    if (data.secondTenantDateOfBirth) {
      const dobParts = data.secondTenantDateOfBirth.split(/[-\/]/);
      if (dobParts.length === 3) {
        const day = dobParts[0].padStart(2, '0');
        const month = dobParts[1].padStart(2, '0');
        const year = dobParts[2];
        const dobStr = day + month + year;
        for (let i = 0; i < 8 && i < dobStr.length; i++) {
          const input = document.getElementById(`tenant2Dob${i + 1}`);
          if (input) input.value = dobStr[i];
        }
      }
    }
    if (data.secondTenantMobileNumber) {
      const phoneMatch = data.secondTenantMobileNumber?.match(/^(\+\d+)(.+)$/);
      if (phoneMatch) {
        const countryCodeInput = document.getElementById('tenant2MobileCountryCode');
        const phoneInput = document.getElementById('tenant2Mobile');
        if (countryCodeInput) countryCodeInput.dataset.phoneCode = phoneMatch[1];
        if (phoneInput) phoneInput.value = phoneMatch[2];
      }
    }
    if (data.secondTenantEmail) {
      const input = document.getElementById('tenant2Email');
      if (input) input.value = data.secondTenantEmail;
    }
  }
  
  // Legal Fee Payee
  if (data.thsFeePayer) {
    const technicalValue = getRadioTechnicalValue(data.thsFeePayer);
    const radio = document.querySelector(`input[name="legalFeePayee"][value="${technicalValue}"]`);
    if (radio) {
      radio.checked = true;
      const event = new Event('change', { bubbles: true });
      radio.dispatchEvent(event);
    }
  }
  // Legal Fee Other fields
  if (data.thsFeePayerOther) {
    const input = document.getElementById('legalFeeOtherName');
    if (input) input.value = data.thsFeePayerOther;
  }
  if (data.thsFeePayerRelationToTenant) {
    const input = document.getElementById('legalFeeOtherRelation');
    if (input) input.value = data.thsFeePayerRelationToTenant;
  }
  if (data.thsFeePayerDateOfBirthEntityNumber) {
    const input = document.getElementById('legalFeeOtherDobEntity');
    if (input) input.value = data.thsFeePayerDateOfBirthEntityNumber;
  }
  if (data.thsFeePayerPhoneNumber) {
    // Parse phone number and country code
    const phoneMatch = data.thsFeePayerPhoneNumber?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('legalFeeOtherTelCountryCode');
      const phoneInput = document.getElementById('legalFeeOtherTel');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        countryCodeInput.value = phoneMatch[1];
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.thsFeePayerPhoneNumber) {
      const phoneInput = document.getElementById('legalFeeOtherTel');
      if (phoneInput) phoneInput.value = data.thsFeePayerPhoneNumber;
    }
  }
  if (data.thsFeePayerEmail) {
    const input = document.getElementById('legalFeeOtherEmail');
    if (input) input.value = data.thsFeePayerEmail;
  }
  if (data.thsFeeEmployersAcocuntsEmail) {
    const input = document.getElementById('legalFeeEmployerEmail');
    if (input) input.value = data.thsFeeEmployersAcocuntsEmail;
  }
  if (data.thsFeeEmployersAccountsContactPhone) {
    // Parse phone number and country code
    const phoneMatch = data.thsFeeEmployersAccountsContactPhone?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('legalFeeEmployerTelCountryCode');
      const phoneInput = document.getElementById('legalFeeEmployerTel');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        // You may want to format this better with the country name
        countryCodeInput.value = phoneMatch[1];
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.thsFeeEmployersAccountsContactPhone) {
      const phoneInput = document.getElementById('legalFeeEmployerTel');
      if (phoneInput) phoneInput.value = data.thsFeeEmployersAccountsContactPhone;
    }
  }
  if (data.thsFeeEmployersAccountsContactName) {
    const input = document.getElementById('legalFeeEmployerName');
    if (input) input.value = data.thsFeeEmployersAccountsContactName;
  }
  if (data.thsFeeInvoiceSending !== undefined) {
    const yesBtn = document.querySelector('#legalFeeDirectSendContainer .yes-no-btn[data-value="yes"]');
    const noBtn = document.querySelector('#legalFeeDirectSendContainer .yes-no-btn[data-value="no"]');
    if (data.thsFeeInvoiceSending === true && yesBtn) yesBtn.click();
    else if (data.thsFeeInvoiceSending === undefined && noBtn) noBtn.click();
  }
  
  // SDLT Fee Payee
  if (data.sdltFeePayer) {
    const technicalValue = getRadioTechnicalValue(data.sdltFeePayer);
    const radio = document.querySelector(`input[name="sdltFeePayee"][value="${technicalValue}"]`);
    if (radio) {
      radio.checked = true;
      const event = new Event('change', { bubbles: true });
      radio.dispatchEvent(event);
    }
  }
  // SDLT Fee Other fields
  if (data.sdltFeePayerOther) {
    const input = document.getElementById('sdltFeeOtherName');
    if (input) input.value = data.sdltFeePayerOther;
  }
  if (data.sdltFeePayerRelationToTenant) {
    const input = document.getElementById('sdltFeeOtherRelation');
    if (input) input.value = data.sdltFeePayerRelationToTenant;
  }
  if (data.sdltFeePayerDateOfBirthEntityNumber) {
    const input = document.getElementById('sdltFeeOtherDobEntity');
    if (input) input.value = data.sdltFeePayerDateOfBirthEntityNumber;
  }
  if (data.sdltFeePayerPhone) {
    // Parse phone number and country code
    const phoneMatch = data.sdltFeePayerPhone?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('sdltFeeOtherTelCountryCode');
      const phoneInput = document.getElementById('sdltFeeOtherTel');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        countryCodeInput.value = phoneMatch[1];
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.sdltFeePayerPhone) {
      const phoneInput = document.getElementById('sdltFeeOtherTel');
      if (phoneInput) phoneInput.value = data.sdltFeePayerPhone;
    }
  }
  if (data.sdltFeePayerEmail) {
    const input = document.getElementById('sdltFeeOtherEmail');
    if (input) input.value = data.sdltFeePayerEmail;
  }
  if (data.sdltFeeEmployersAccountEmail) {
    const input = document.getElementById('sdltFeeEmployerEmail');
    if (input) input.value = data.sdltFeeEmployersAccountEmail;
  }
  if (data.sdltFeeEmployersAccountPhone) {
    // Parse phone number and country code
    const phoneMatch = data.sdltFeeEmployersAccountPhone?.match(/^(\+\d+)(.+)$/);
    if (phoneMatch) {
      const countryCodeInput = document.getElementById('sdltFeeEmployerTelCountryCode');
      const phoneInput = document.getElementById('sdltFeeEmployerTel');
      if (countryCodeInput) {
        countryCodeInput.dataset.phoneCode = phoneMatch[1];
        // You may want to format this better with the country name
        countryCodeInput.value = phoneMatch[1];
      }
      if (phoneInput) phoneInput.value = phoneMatch[2];
    } else if (data.sdltFeeEmployersAccountPhone) {
      const phoneInput = document.getElementById('sdltFeeEmployerTel');
      if (phoneInput) phoneInput.value = data.sdltFeeEmployersAccountPhone;
    }
  }
  if (data.sdltFeeEmployerAccountsContactName) {
    const input = document.getElementById('sdltFeeEmployerName');
    if (input) input.value = data.sdltFeeEmployerAccountsContactName;
  }
  if (data.sdltFeeEmployerDetailsMatchThsLlpFeePayer !== undefined) {
    const yesBtn = document.querySelector('#sdltFeeEmployerMatchContainer .yes-no-btn[data-value="yes"]');
    const noBtn = document.querySelector('#sdltFeeEmployerMatchContainer .yes-no-btn[data-value="no"]');
    if (data.sdltFeeEmployerDetailsMatchThsLlpFeePayer === true && yesBtn) yesBtn.click();
    else if (data.sdltFeeEmployerDetailsMatchThsLlpFeePayer === undefined && noBtn) noBtn.click();
  }
  if (data.sdltFeeInvoiceSending !== undefined) {
    const yesBtn = document.querySelector('#sdltFeeDirectSendContainer .yes-no-btn[data-value="yes"]');
    const noBtn = document.querySelector('#sdltFeeDirectSendContainer .yes-no-btn[data-value="no"]');
    if (data.sdltFeeInvoiceSending === true && yesBtn) yesBtn.click();
    else if (data.sdltFeeInvoiceSending === undefined && noBtn) noBtn.click();
  }
  
  // Additional Details
  if (data.note) {
    const input = document.getElementById('additionalDetails');
    if (input) input.value = data.note;
  }
  
  // Additional Documents (will be displayed in updateUIForEditMode)
  if (data.addSupportingDocuments === true) {
    const yesBtn = document.querySelector('[data-field="addAdditionalDocuments"][data-value="yes"]');
    if (yesBtn) yesBtn.click();
  } else if (data.addSupportingDocuments === undefined) {
    const noBtn = document.querySelector('[data-field="addAdditionalDocuments"][data-value="no"]');
    if (noBtn) noBtn.click();
  }
}

/**
 * Update UI for edit mode - disable uploads, show hints, display existing documents
 */
function updateUIForEditMode(data) {
  // Hide lease upload area and show hint
  const leaseUploadArea = document.getElementById('leaseUploadArea');
  const leaseUploadText = document.getElementById('leaseUploadText');
  if (leaseUploadArea) {
    leaseUploadArea.style.display = 'none';
    // Add hint after the label
    const leaseLabel = document.querySelector('label[for="leaseDocument"]');
    if (leaseLabel && !leaseLabel.nextElementSibling?.classList.contains('edit-mode-hint')) {
      const hint = document.createElement('div');
      hint.className = 'edit-mode-hint';
      hint.style.cssText = 'padding: 12px; background: #f0f7ff; border: 1px solid #4A90E2; border-radius: 6px; margin-top: 8px; color: #003c71; font-size: 0.9rem;';
      hint.textContent = 'Lease document already uploaded and cannot be changed. Please upload additional documents via the entry documents viewer.';
      leaseLabel.parentElement.insertBefore(hint, leaseLabel.nextSibling);
    }
  }
  
  // Display existing lease document if present
  if (data.leaseAgreement) {
    const leaseSection = document.querySelector('.lease-document-upload');
    if (leaseSection) {
      const docCard = document.createElement('div');
      docCard.className = 'existing-document-card';
      docCard.style.cssText = 'padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; margin-top: 8px;';
      docCard.innerHTML = `
        <div style="font-weight: 600; color: #003c71; margin-bottom: 4px;">${data.leaseAgreement.document || 'Lease Agreement'}</div>
        <div style="font-size: 0.85rem; color: #6c757d;">${data.leaseAgreement.data?.name || data.leaseAgreement.name || 'Document'}</div>
        ${data.leaseAgreement.description ? `<div style="font-size: 0.85rem; color: #6c757d; margin-top: 4px;">${data.leaseAgreement.description}</div>` : ''}
      `;
      leaseSection.appendChild(docCard);
    }
  }
  
  // Hide additional documents upload button and show hint
  const addAnotherBtn = document.getElementById('addAnotherDocumentBtn');
  if (addAnotherBtn) {
    addAnotherBtn.style.display = 'none';
    const hint = document.createElement('div');
    hint.className = 'edit-mode-hint';
    hint.style.cssText = 'padding: 12px; background: #f0f7ff; border: 1px solid #4A90E2; border-radius: 6px; margin-top: 8px; color: #003c71; font-size: 0.9rem;';
    hint.textContent = 'Please upload additional documents via the view submission page documents viewer.';
    addAnotherBtn.parentElement.appendChild(hint);
  }
  
  // Display existing supporting documents
  if (data.supportingDocuments && Array.isArray(data.supportingDocuments) && data.supportingDocuments.length > 0) {
    const documentsList = document.getElementById('additionalDocumentsList');
    if (documentsList) {
      data.supportingDocuments.forEach((doc) => {
        const docCard = document.createElement('div');
        docCard.className = 'existing-document-card';
        docCard.style.cssText = 'padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; margin-bottom: 8px;';
        docCard.innerHTML = `
          <div style="font-weight: 600; color: #003c71; margin-bottom: 4px;">${doc.document || 'Supporting Document'}</div>
          <div style="font-size: 0.85rem; color: #6c757d;">${doc.data?.name || doc.name || 'Document'}</div>
          ${doc.description ? `<div style="font-size: 0.85rem; color: #6c757d; margin-top: 4px;">${doc.description}</div>` : ''}
        `;
        documentsList.appendChild(docCard);
      });
    }
  }
}

function displayAddressSuggestions(suggestions, field) {
  // Determine which dropdown to update based on field
  const isSdlt = field === 'sdlt';
  const dropdown = isSdlt 
    ? document.getElementById('sdltAddressDropdown')
    : document.getElementById('previousAddressDropdown');
  
  // Clear the other dropdown if it's showing "Searching addresses..."
  const otherDropdown = isSdlt 
    ? document.getElementById('previousAddressDropdown')
    : document.getElementById('sdltAddressDropdown');
  
  if (otherDropdown && otherDropdown.innerHTML.includes('Searching addresses')) {
    otherDropdown.classList.add('hidden');
    otherDropdown.innerHTML = '';
  }
  
  if (!dropdown) return;
  
  if (!suggestions || suggestions.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-item-empty">No addresses found</div>';
    dropdown.classList.remove('hidden');
    return;
  }
  
  dropdown.innerHTML = '';
  suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'address-dropdown-item';
    item.textContent = suggestion.formatted_address || suggestion.description || suggestion.address;
    item.addEventListener('click', () => {
      selectAddressSuggestion(suggestion.id || suggestion.place_id, suggestion.formatted_address || suggestion.description || suggestion.address, field);
    });
    dropdown.appendChild(item);
  });
  
  dropdown.classList.remove('hidden');
}

function selectAddressSuggestion(addressId, displayText, field) {
  const input = field === 'sdlt' 
    ? document.getElementById('sdltAddress')
    : document.getElementById('previousAddress');
  const dropdown = field === 'sdlt' 
    ? document.getElementById('sdltAddressDropdown')
    : document.getElementById('previousAddressDropdown');
  
  if (!input || !dropdown) return;
  
  input.value = displayText;
  dropdown.classList.add('hidden');
  
  // Request full address from parent
  window.parent.postMessage({
    type: 'address-lookup',
    addressId: addressId,
    field: field
  }, '*');
}

/**
 * Normalize country code/name to Thirdfort format (GBR, USA, CAN, etc.)
 */
function normalizeCountryCode(country) {
  if (!country) return 'GBR';
  
  const countryStr = String(country).trim().toUpperCase();
  
  // Already in correct format
  if (['GBR', 'USA', 'CAN'].includes(countryStr)) {
    return countryStr;
  }
  
  // Common mappings
  const mappings = {
    'GB': 'GBR',
    'UK': 'GBR',
    'UNITED KINGDOM': 'GBR',
    'US': 'USA',
    'UNITED STATES': 'USA',
    'UNITED STATES OF AMERICA': 'USA',
    'CA': 'CAN',
    'CANADA': 'CAN'
  };
  
  return mappings[countryStr] || countryStr;
}

/**
 * Format getaddress.io address data to Thirdfort format
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
    let buildingNumber = getAddressData.building_number || getAddressData.sub_building_number || '';
    let buildingNameFromLine1 = '';
    let flatNumber = getAddressData.flat_number || '';
    
    // Parse line_1 intelligently using thoroughfare as the key
    if (getAddressData.line_1 && (!buildingNumber || !getAddressData.building_name)) {
      let addressPrefix = getAddressData.line_1.trim();
      
      // Remove thoroughfare/street from line_1 if present
      if (getAddressData.thoroughfare && addressPrefix.includes(getAddressData.thoroughfare)) {
        addressPrefix = addressPrefix.replace(getAddressData.thoroughfare, '').replace(/,\s*$/, '').trim();
      }
      
      // Now parse the remaining prefix (which has street already removed)
      if (addressPrefix) {
        // Check for flat number (e.g., "Flat 1A", "Flat 1A, Building Name")
        const flatMatch = addressPrefix.match(/^(?:Flat|flat|Apartment|apartment|Unit|unit|Apt|apt)\s+(\d+[a-zA-Z]?)/i);
        if (flatMatch && !flatNumber) {
          flatNumber = flatMatch[1];
          addressPrefix = addressPrefix.substring(flatMatch[0].length).replace(/^[,\s]+/, '').trim();
        }
        
        // Check if remaining starts with a number (building number like "94", "1A", etc.)
        if (!buildingNumber) {
          const numberMatch = addressPrefix.match(/^(\d+[a-zA-Z]?)\b/);
          if (numberMatch) {
            buildingNumber = numberMatch[1];
            addressPrefix = addressPrefix.substring(numberMatch[0].length).replace(/^[,\s]+/, '').trim();
          }
        }
        
        // Whatever remains is the building name
        if (addressPrefix) {
          // Don't use purely numeric values as building names (they're building numbers)
          if (!/^\d+$/.test(addressPrefix)) {
            buildingNameFromLine1 = addressPrefix;
          }
        }
      }
    }
    
    // Building name: Combine all available building name data
    const buildingNameParts = [
      getAddressData.sub_building_name,
      getAddressData.building_name && !/^\d+$/.test(getAddressData.building_name.trim()) ? getAddressData.building_name : buildingNameFromLine1,
      getAddressData.line_2 && getAddressData.line_2 !== getAddressData.thoroughfare ? getAddressData.line_2 : ''
    ].filter(p => p && p.trim());
    
    return {
      building_name: buildingNameParts.join(', ') || '',
      building_number: buildingNumber,
      flat_number: flatNumber,
      postcode: getAddressData.postcode || '',
      street: getAddressData.thoroughfare || getAddressData.line_3 || getAddressData.street || '',
      sub_street: getAddressData.sub_street || '',
      town: getAddressData.town_or_city || getAddressData.town || '',
      country: normalizedCountry
    };
  }
  
  // USA/Canada: address_1, address_2, state required
  if (normalizedCountry === 'USA' || normalizedCountry === 'CAN') {
    return {
      address_1: getAddressData.line_1 || '',
      address_2: getAddressData.line_2 || getAddressData.line_3 || getAddressData.line_4 || '',
      postcode: getAddressData.postcode || '',
      street: getAddressData.thoroughfare || getAddressData.street || '',
      sub_street: getAddressData.sub_street || '',
      town: getAddressData.town_or_city || getAddressData.town || '',
      state: getAddressData.state || getAddressData.province || '',
      country: normalizedCountry
    };
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

function handleAddressData(address, field) {
  // Get country for the address
  let country = 'GBR';
  if (field === 'sdlt') {
    // SDLT address is always UK
    country = 'GBR';
  } else {
    // Previous address - get country from dropdown
    const previousCountryElement = document.getElementById('previousAddressCountry');
    if (previousCountryElement) {
      country = previousCountryElement.dataset.countryCode || previousCountryElement.value || 'GBR';
    }
  }
  
  // Format address to Thirdfort format
  const formattedAddress = formatToThirdfort(address, country);
  
  if (field === 'sdlt') {
    sdltAddressObject = formattedAddress;
  } else {
    previousAddressObject = formattedAddress;
  }
  
  validateForm();
}

function displayCompanySuggestions(companies, byNumber) {
  const dropdown = byNumber 
    ? document.getElementById('employerNumberDropdown')
    : document.getElementById('employerNameDropdown');
  
  // Hide the other dropdown when showing results
  const otherDropdown = byNumber 
    ? document.getElementById('employerNameDropdown')
    : document.getElementById('employerNumberDropdown');
  
  if (otherDropdown) {
    otherDropdown.classList.add('hidden');
    otherDropdown.innerHTML = '';
  }
  
  if (!dropdown) return;
  
  if (!companies || companies.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-item-empty">No companies found</div>';
    dropdown.classList.remove('hidden');
    return;
  }
  
  dropdown.innerHTML = '';
  companies.forEach(company => {
    const item = document.createElement('div');
    item.className = 'address-dropdown-item';
    item.textContent = company.name || company.title;
    item.addEventListener('click', () => {
      selectCompanySuggestion(company, byNumber);
    });
    dropdown.appendChild(item);
  });
  
  dropdown.classList.remove('hidden');
}

function selectCompanySuggestion(company, byNumber) {
  if (byNumber) {
    const input = document.getElementById('employerNumber');
    if (input) {
      input.value = company.company_number || company.number;
      input.dataset.organisationNumber = company.company_number || company.number;
    }
    document.getElementById('employerNumberDropdown').classList.add('hidden');
    
    // Request full company data
    window.parent.postMessage({
      type: 'company-lookup',
      companyNumber: company.company_number || company.number
    }, '*');
  } else {
    const input = document.getElementById('employerName');
    if (input) {
      input.value = company.title || company.name;
    }
    document.getElementById('employerNameDropdown').classList.add('hidden');
    
    // If company number is available, set it
    if (company.company_number || company.number) {
      const numberInput = document.getElementById('employerNumber');
      if (numberInput) {
        numberInput.value = company.company_number || company.number;
        numberInput.dataset.organisationNumber = company.company_number || company.number;
      }
      
      // Request full company data
      window.parent.postMessage({
        type: 'company-lookup',
        companyNumber: company.company_number || company.number
      }, '*');
    }
  }
}

function handleCompanyData(company) {
  const nameInput = document.getElementById('employerName');
  const numberInput = document.getElementById('employerNumber');
  const linkBtn = document.getElementById('employerLinkBtn');
  const refreshBtn = document.getElementById('employerRefreshBtn');
  
  // Store full company data object
  formState.companyData = company;
  
  if (nameInput && company.title) {
    nameInput.value = company.title;
  }
  
  if (numberInput && company.company_number) {
    numberInput.value = company.company_number;
    numberInput.dataset.organisationNumber = company.company_number;
  }
  
  if (linkBtn && company.company_number) {
    linkBtn.classList.remove('hidden');
  }
  
  if (refreshBtn && company.company_number) {
    refreshBtn.classList.remove('hidden');
  }
  
  validateForm();
}

function handleUploadUrl(message) {
  const data = message.data || message;
  const { url, fileName, uploadType, docId } = data;
  
  let file;
  if (uploadType === 'lease') {
    file = formState.leaseDocument?.file;
  } else if (uploadType === 'additional' && docId) {
    const docItem = formState.additionalDocuments.find(doc => doc.id === docId);
    file = docItem?.file;
  }
  
  if (!file || !url) return;
  
  // Upload file to S3
  fetch(url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type
    }
  })
  .then(response => {
    if (!response.ok) throw new Error('Upload failed');
    
    // Extract S3 key from URL or use provided key
    const s3Key = data.s3Key || extractS3KeyFromUrl(url);
    
    if (uploadType === 'lease') {
      formState.leaseDocument.s3Key = s3Key;
      formState.leaseDocument.uploaded = true;
    } else if (uploadType === 'additional' && docId) {
      const docItem = formState.additionalDocuments.find(doc => doc.id === docId);
      if (docItem) {
        docItem.s3Key = s3Key;
        docItem.uploaded = true;
      }
    }
    
    validateForm();
  })
  .catch(error => {
    console.error('Upload error:', error);
    showError('Failed to upload file. Please try again.');
  });
}

function extractS3KeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts.slice(1).join('/');
  } catch (e) {
    return null;
  }
}

// ===== FORM SUBMISSION =====

function handleSubmit() {
  // Collect validation errors
  const errors = collectValidationErrors();
  
  if (errors.length > 0) {
    // Show error popup with all validation errors
    const errorMessage = errors.join('\n');
    showError(errorMessage);
    return;
  }
  
  // Disable submit button during upload
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
  }
  
  // Collect all files that need to be uploaded
  const filesToUpload = collectFilesForUpload();
  
  if (filesToUpload.length === 0) {
    // No files to upload, send form data directly
    submitFormData();
    return;
  }
  
  // Request PUT links from parent
  requestPutLinks(filesToUpload);
}

/**
 * Collect all validation errors into an array
 * @returns {Array<string>} Array of error messages
 */
function collectValidationErrors() {
  const errors = [];
  
  // Check required fields
  const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
  requiredInputs.forEach(input => {
    if (!input.value.trim() && !input.closest('.hidden')) {
      const label = input.closest('.row, .form-grid')?.querySelector('label[for="' + input.id + '"]') || 
                    input.previousElementSibling?.tagName === 'LABEL' ? input.previousElementSibling : null;
      const fieldName = label?.textContent?.replace('*', '').trim() || input.name || 'Field';
      errors.push(`${fieldName} is required`);
    }
  });
  
  // Validate tenant mobile numbers with libphonenumber
  const tenant1MobileCountryCode = document.getElementById('tenant1MobileCountryCode');
  const tenant1Mobile = document.getElementById('tenant1Mobile');
  if (tenant1Mobile && tenant1MobileCountryCode && !tenant1Mobile.closest('.hidden')) {
    if (tenant1Mobile.value.trim()) {
      const phoneCode = tenant1MobileCountryCode.dataset.phoneCode || '';
      const phoneNumber = tenant1Mobile.value.trim();
      const fullNumber = phoneCode + phoneNumber;
      
      if (!validatePhoneNumberWithLibPhone(fullNumber)) {
        errors.push('Tenant mobile number is invalid');
      }
    }
  }
  
  // Tenant 2 mobile (only if second tenant is added)
  if (formState.addSecondTenant) {
    const tenant2MobileCountryCode = document.getElementById('tenant2MobileCountryCode');
    const tenant2Mobile = document.getElementById('tenant2Mobile');
    if (tenant2Mobile && tenant2MobileCountryCode && !tenant2Mobile.closest('.hidden')) {
      if (tenant2Mobile.value.trim()) {
        const phoneCode = tenant2MobileCountryCode.dataset.phoneCode || '';
        const phoneNumber = tenant2Mobile.value.trim();
        const fullNumber = phoneCode + phoneNumber;
        
        if (!validatePhoneNumberWithLibPhone(fullNumber)) {
          errors.push('Second tenant mobile number is invalid');
        }
      }
    }
  }
  
  // Check required checkboxes
  const requiredCheckboxes = document.querySelectorAll('input[type="checkbox"][required]');
  requiredCheckboxes.forEach(checkbox => {
    if (!checkbox.checked && !checkbox.closest('.hidden')) {
      const label = checkbox.closest('label')?.querySelector('.confirmation-text')?.textContent || 
                    checkbox.nextElementSibling?.textContent || 'Checkbox';
      errors.push(`${label} must be checked`);
    }
  });
  
  // Check all radio groups are required
  const requiredRadioGroups = ['leaseUnder', 'legalFeePayee', 'sdltFeePayee'];
  requiredRadioGroups.forEach(groupName => {
    const checked = document.querySelector(`input[name="${groupName}"]:checked`);
    const groupContainer = document.querySelector(`input[name="${groupName}"]`)?.closest('.section, .form-grid, .row');
    if (!checked && groupContainer && !groupContainer.classList.contains('hidden')) {
      const groupLabel = groupName === 'leaseUnder' ? 'Lease under' : 
                        groupName === 'legalFeePayee' ? 'Legal fee payee' : 
                        'SDLT fee payee';
      errors.push(`${groupLabel} selection is required`);
    }
  });
  
  // Validate conditional fields based on radio selections
  const leaseUnder = document.querySelector('input[name="leaseUnder"]:checked')?.value;
  if (leaseUnder === 'other') {
    const leaseOtherName = document.getElementById('leaseOtherName');
    const leaseOtherRelation = document.getElementById('leaseOtherRelation');
    const leaseOtherDobEntity = document.getElementById('leaseOtherDobEntity');
    const leaseOtherEmail = document.getElementById('leaseOtherEmail');
    const leaseOtherTel = document.getElementById('leaseOtherTel');
    
    if (!leaseOtherName?.value.trim()) errors.push('Lease other name is required');
    if (!leaseOtherRelation?.value.trim()) errors.push('Lease other relation is required');
    if (!leaseOtherDobEntity?.value.trim()) errors.push('Lease other DOB/Entity number is required');
    if ((!leaseOtherEmail?.value.trim() && !leaseOtherTel?.value.trim())) {
      errors.push('Lease other email or telephone is required');
    }
  }
  
  const legalFeePayee = document.querySelector('input[name="legalFeePayee"]:checked')?.value;
  if (legalFeePayee === 'other') {
    const legalFeeOtherName = document.getElementById('legalFeeOtherName');
    const legalFeeOtherRelation = document.getElementById('legalFeeOtherRelation');
    const legalFeeOtherDobEntity = document.getElementById('legalFeeOtherDobEntity');
    const legalFeeOtherEmail = document.getElementById('legalFeeOtherEmail');
    const legalFeeOtherTel = document.getElementById('legalFeeOtherTel');
    
    if (!legalFeeOtherName?.value.trim()) errors.push('Legal fee other name is required');
    if (!legalFeeOtherRelation?.value.trim()) errors.push('Legal fee other relation is required');
    if (!legalFeeOtherDobEntity?.value.trim()) errors.push('Legal fee other DOB/Entity number is required');
    if ((!legalFeeOtherEmail?.value.trim() && !legalFeeOtherTel?.value.trim())) {
      errors.push('Legal fee other email or telephone is required');
    }
  }
  
  if (legalFeePayee === 'tenant-employer') {
    const legalFeeEmployerName = document.getElementById('legalFeeEmployerName');
    const legalFeeEmployerEmail = document.getElementById('legalFeeEmployerEmail');
    const legalFeeEmployerTel = document.getElementById('legalFeeEmployerTel');
    
    if (!legalFeeEmployerName?.value.trim()) errors.push('Legal fee employer name is required');
    if (!legalFeeEmployerEmail?.value.trim() && !legalFeeEmployerTel?.value.trim()) {
      errors.push('Legal fee employer email or telephone is required');
    }
  }
  
  const sdltFeePayee = document.querySelector('input[name="sdltFeePayee"]:checked')?.value;
  if (sdltFeePayee === 'other') {
    const sdltFeeOtherName = document.getElementById('sdltFeeOtherName');
    const sdltFeeOtherRelation = document.getElementById('sdltFeeOtherRelation');
    const sdltFeeOtherDobEntity = document.getElementById('sdltFeeOtherDobEntity');
    const sdltFeeOtherEmail = document.getElementById('sdltFeeOtherEmail');
    const sdltFeeOtherTel = document.getElementById('sdltFeeOtherTel');
    
    if (!sdltFeeOtherName?.value.trim()) errors.push('SDLT fee other name is required');
    if (!sdltFeeOtherRelation?.value.trim()) errors.push('SDLT fee other relation is required');
    if (!sdltFeeOtherDobEntity?.value.trim()) errors.push('SDLT fee other DOB/Entity number is required');
    if ((!sdltFeeOtherEmail?.value.trim() && !sdltFeeOtherTel?.value.trim())) {
      errors.push('SDLT fee other email or telephone is required');
    }
  }
  
  if (sdltFeePayee === 'tenant-employer') {
    const sdltFeeEmployerMatchContainer = document.getElementById('sdltFeeEmployerMatchContainer');
    if (sdltFeeEmployerMatchContainer && !sdltFeeEmployerMatchContainer.classList.contains('hidden')) {
      if (formState.sdltFeeEmployerMatch !== true) {
        const sdltFeeEmployerName = document.getElementById('sdltFeeEmployerName');
        const sdltFeeEmployerContact = document.getElementById('sdltFeeEmployerContact');
        
        if (!sdltFeeEmployerName?.value.trim()) errors.push('SDLT fee employer name is required');
        if (!sdltFeeEmployerContact?.value.trim()) errors.push('SDLT fee employer contact is required');
      }
    }
  }
  
  // Check all YES/NO buttons are required when visible
  const addSecondTenantContainer = document.querySelector('[data-field="addSecondTenant"]')?.closest('.yes-no-container');
  if (addSecondTenantContainer && !addSecondTenantContainer.classList.contains('hidden')) {
    const hasSelected = Array.from(addSecondTenantContainer.querySelectorAll('.yes-no-btn')).some(btn => btn.classList.contains('selected'));
    if (!hasSelected) {
      errors.push('Please select whether to add a second tenant');
    }
  }
  
  const addAdditionalDocumentsContainer = document.querySelector('[data-field="addAdditionalDocuments"]')?.closest('.yes-no-container');
  if (addAdditionalDocumentsContainer && !addAdditionalDocumentsContainer.classList.contains('hidden')) {
    const hasSelected = Array.from(addAdditionalDocumentsContainer.querySelectorAll('.yes-no-btn')).some(btn => btn.classList.contains('selected'));
    if (!hasSelected) {
      errors.push('Please select whether to upload additional documents');
    }
  }
  
  const legalFeeDirectSendContainer = document.getElementById('legalFeeDirectSendContainer');
  if (legalFeeDirectSendContainer && !legalFeeDirectSendContainer.classList.contains('hidden')) {
    const hasSelection = formState.legalFeeDirectSend !== null && formState.legalFeeDirectSend !== undefined;
    if (!hasSelection) {
      errors.push('Please select whether to send legal fee invoice directly');
    }
  }
  
  const sdltFeeDirectSendContainer = document.getElementById('sdltFeeDirectSendContainer');
  if (sdltFeeDirectSendContainer && !sdltFeeDirectSendContainer.classList.contains('hidden')) {
    const hasSelection = formState.sdltFeeDirectSend !== null && formState.sdltFeeDirectSend !== undefined;
    if (!hasSelection) {
      errors.push('Please select whether to send SDLT fee invoice directly');
    }
  }
  
  const sdltFeeEmployerMatchContainer = document.getElementById('sdltFeeEmployerMatchContainer');
  if (sdltFeeEmployerMatchContainer && !sdltFeeEmployerMatchContainer.classList.contains('hidden')) {
    const hasMatchSelection = formState.sdltFeeEmployerMatch !== null && formState.sdltFeeEmployerMatch !== undefined;
    if (!hasMatchSelection) {
      errors.push('Please select whether SDLT fee employer details match');
    }
  }
  
  // Check file uploads
  if (!formState.leaseDocument) {
    const leaseFileInput = document.getElementById('leaseFileInput');
    if (leaseFileInput && !leaseFileInput.closest('.hidden')) {
      errors.push('Lease document upload is required');
    }
  }
  
  // Check additional documents if enabled
  if (formState.addAdditionalDocuments) {
    formState.additionalDocuments.forEach((doc, index) => {
      const titleInput = document.getElementById(`${doc.id}_title`);
      const fileInput = document.getElementById(`${doc.id}_fileInput`);
      if (titleInput && !titleInput.value.trim()) {
        errors.push(`Additional document ${index + 1} title is required`);
      }
      if (!doc.file && fileInput) {
        errors.push(`Additional document ${index + 1} file is required`);
      }
    });
  }
  
  return errors;
}

// ===== FORM DATA COLLECTION =====

/**
 * Convert radio button technical value to friendly label
 */
function getRadioFriendlyLabel(technicalValue) {
  const mapping = {
    'tenant': 'The Tenant',
    'tenants-employer': "The Tenant's Employer",
    'tenant-employer': "The Tenant's Employer",
    'dwellworks': 'Dwellworks',
    'other': 'Other'
  };
  return mapping[technicalValue] || technicalValue;
}

/**
 * Convert friendly label back to technical value for radio buttons
 */
function getRadioTechnicalValue(friendlyLabel) {
  const mapping = {
    'The Tenant': 'tenant',
    "The Tenant's Employer": 'tenant-employer',
    'Dwellworks': 'dwellworks',
    'Other': 'other'
  };
  // Also check if it's already a technical value
  if (['tenant', 'tenants-employer', 'tenant-employer', 'dwellworks', 'other'].includes(friendlyLabel)) {
    // Normalize tenants-employer to tenant-employer
    return friendlyLabel === 'tenants-employer' ? 'tenant-employer' : friendlyLabel;
  }
  return mapping[friendlyLabel] || friendlyLabel;
}

/**
 * Collect all form data and return as object
 */
function collectFormData() {
  // Helper to format phone number
  const formatPhone = (countryCodeEl, numberEl) => {
    const code = countryCodeEl?.dataset.phoneCode || '';
    const num = numberEl?.value || '';
    return code && num ? `${code}${num}` : num || undefined;
  };
  
  // Helper to get address object (returns full Thirdfort object, not formatted string)
  const getAddressObject = (addressObj, fallbackFn) => {
    if (addressObj) {
      return addressObj;
    }
    const manualAddress = fallbackFn();
    // Return object if it has any meaningful data
    if (manualAddress && (manualAddress.street || manualAddress.town || manualAddress.postcode)) {
      return manualAddress;
    }
    return undefined;
  };
  
  const leaseUnder = document.querySelector('input[name="leaseUnder"]:checked')?.value;
  const legalFeePayee = document.querySelector('input[name="legalFeePayee"]:checked')?.value;
  const sdltFeePayee = document.querySelector('input[name="sdltFeePayee"]:checked')?.value;
  
  const data = {
    status: ["New Submission"],
    
    // Your Details
    submitterFirstName: document.getElementById('submitterFirstName').value,
    submitterLastName: document.getElementById('submitterLastName').value,
    dwellworksReference: document.getElementById('dwellworksReference').value,
    dwellworksContactNumber: formatPhone(
      document.getElementById('submitterPhoneCountryCode'),
      document.getElementById('submitterPhone')
    ),
    dwellworksEmail: document.getElementById('submitterEmail').value,
    sharedEmail: document.getElementById('shareEmail').value || undefined,
    
    // Tenant Details
    tenantsFirstName: document.getElementById('tenant1FirstName').value,
    tenantLastName: document.getElementById('tenant1LastName').value,
    tenantDateOfBirth: getDOBValue(1) || undefined,
    tenantsMobileNumber: formatPhone(
      document.getElementById('tenant1MobileCountryCode'),
      document.getElementById('tenant1Mobile')
    ),
    tenantsEmail: document.getElementById('tenant1Email').value || undefined,
    
    // SDLT Address and Move-in Date
    sdltAddress: getAddressObject(sdltAddressObject, () => getManualAddress('sdlt')),
    ukMoveInDate: document.getElementById('moveInDate').value || undefined,
    tenantsPreviousAddress: getAddressObject(previousAddressObject, () => getManualAddress('previous')),
    
    // Second Tenant
    secondTenant: formState.addSecondTenant === true ? true : undefined,
    secondTenantFirstName: formState.addSecondTenant ? document.getElementById('tenant2FirstName').value : undefined,
    secondTenantLastName: formState.addSecondTenant ? document.getElementById('tenant2LastName').value : undefined,
    secondTenantDateOfBirth: formState.addSecondTenant ? (getDOBValue(2) || undefined) : undefined,
    secondTenantMobile: formState.addSecondTenant ? formatPhone(
      document.getElementById('tenant2MobileCountryCode'),
      document.getElementById('tenant2Mobile')
    ) : undefined,
    secondTenantEmail: formState.addSecondTenant ? (document.getElementById('tenant2Email').value || undefined) : undefined,
    
    // Employers Details
    tenantsEmployer: document.getElementById('employerName').value,
    employersCountryOfRegistration: document.getElementById('employerCountry').value,
    employersRegistrationNumber: document.getElementById('employerNumber').value,
    companyData: (() => {
      // Return full Companies House data if UK company
      const employerCountry = document.getElementById('employerCountry');
      const isUK = employerCountry?.dataset.jurisdictionCode === 'GB';
      return isUK && formState.companyData ? formState.companyData : undefined;
    })(),
    
    // Lease
    lessee: leaseUnder ? getRadioFriendlyLabel(leaseUnder) : undefined,
    lesseeOther: leaseUnder === 'other' ? document.getElementById('leaseOtherName').value : undefined,
    lesseeDateOfBirthEntityNumber: leaseUnder === 'other' ? (document.getElementById('leaseOtherDobEntity').value || undefined) : undefined,
    lesseePhoneNumber: leaseUnder === 'other' ? formatPhone(
      document.getElementById('leaseOtherTelCountryCode'),
      document.getElementById('leaseOtherTel')
    ) : undefined,
    lesseeEmail: leaseUnder === 'other' ? (document.getElementById('leaseOtherEmail').value || undefined) : undefined,
    lesseeRelationToTenant: leaseUnder === 'other' ? document.getElementById('leaseOtherRelation').value : undefined,
    leaseAgreementNote: document.getElementById('leaseNote').value || undefined,
    
    // Legal Fee (THS Fee)
    thsFeePayer: legalFeePayee ? getRadioFriendlyLabel(legalFeePayee) : undefined,
    thsFeePayerOther: legalFeePayee === 'other' ? document.getElementById('legalFeeOtherName').value : undefined,
    thsFeePayerDateOfBirthEntityNumber: legalFeePayee === 'other' ? (document.getElementById('legalFeeOtherDobEntity').value || undefined) : undefined,
    thsFeePayerPhoneNumber: legalFeePayee === 'other' ? formatPhone(
      document.getElementById('legalFeeOtherTelCountryCode'),
      document.getElementById('legalFeeOtherTel')
    ) : undefined,
    thsFeePayerEmail: legalFeePayee === 'other' ? (document.getElementById('legalFeeOtherEmail').value || undefined) : undefined,
    thsFeePayerRelationToTenant: legalFeePayee === 'other' ? document.getElementById('legalFeeOtherRelation').value : undefined,
    thsFeeInvoiceSending: legalFeePayee && legalFeePayee !== 'dwellworks' ? (formState.legalFeeDirectSend === true ? true : undefined) : undefined,
    thsFeeEmployersAcocuntsEmail: legalFeePayee === 'tenant-employer' ? (document.getElementById('legalFeeEmployerEmail').value || undefined) : undefined,
    thsFeeEmployersAccountsContactPhone: legalFeePayee === 'tenant-employer' ? formatPhone(
      document.getElementById('legalFeeEmployerTelCountryCode'),
      document.getElementById('legalFeeEmployerTel')
    ) : undefined,
    thsFeeEmployersAccountsContactName: legalFeePayee === 'tenant-employer' ? document.getElementById('legalFeeEmployerName').value : undefined,
    
    // SDLT Fee
    sdltFeePayer: sdltFeePayee ? getRadioFriendlyLabel(sdltFeePayee) : undefined,
    sdltFeePayerOther: sdltFeePayee === 'other' ? document.getElementById('sdltFeeOtherName').value : undefined,
    sdltFeePayerDateOfBirthEntityNumber: sdltFeePayee === 'other' ? (document.getElementById('sdltFeeOtherDobEntity').value || undefined) : undefined,
    sdltFeePayerEmail: sdltFeePayee === 'other' ? (document.getElementById('sdltFeeOtherEmail').value || undefined) : undefined,
    sdltFeePayerPhone: sdltFeePayee === 'other' ? formatPhone(
      document.getElementById('sdltFeeOtherTelCountryCode'),
      document.getElementById('sdltFeeOtherTel')
    ) : undefined,
    sdltFeePayerRelationToTenant: sdltFeePayee === 'other' ? document.getElementById('sdltFeeOtherRelation').value : undefined,
    sdltFeeInvoiceSending: sdltFeePayee && sdltFeePayee !== 'dwellworks' ? (formState.sdltFeeDirectSend === true ? true : undefined) : undefined,
    sdltFeeEmployerDetailsMatchThsLlpFeePayer: (sdltFeePayee === 'tenant-employer' && legalFeePayee === 'tenant-employer') ? (formState.sdltFeeEmployerMatch === true ? true : undefined) : undefined,
    sdltFeeEmployersAccountContactName: (sdltFeePayee === 'tenant-employer' && !formState.sdltFeeEmployerMatch) ? document.getElementById('sdltFeeEmployerName').value : undefined,
    sdltFeeEmployersAccountEmail: (sdltFeePayee === 'tenant-employer' && !formState.sdltFeeEmployerMatch) ? (document.getElementById('sdltFeeEmployerEmail').value || undefined) : undefined,
    sdltFeeEmployersAccountPhone: (sdltFeePayee === 'tenant-employer' && !formState.sdltFeeEmployerMatch) ? formatPhone(
      document.getElementById('sdltFeeEmployerTelCountryCode'),
      document.getElementById('sdltFeeEmployerTel')
    ) : undefined,
    
    // Additional Details
    note: document.getElementById('additionalDetails').value || undefined,
    
    // Confirmations
    privacyPolicy: document.getElementById('privacyCheckbox').checked,
    gdprIndividualsAgreement: document.getElementById('consentCheckbox').checked,
    terms: document.getElementById('termsCheckbox').checked
  };
  
  return data;
}

function getDOBValue(tenantNum) {
  const inputs = [];
  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`tenant${tenantNum}Dob${i}`);
    if (input) inputs.push(input.value);
  }
  
  if (inputs.length === 8 && inputs.every(v => v)) {
    return `${inputs[0]}${inputs[1]}/${inputs[2]}${inputs[3]}/${inputs[4]}${inputs[5]}${inputs[6]}${inputs[7]}`;
  }
  
  return null;
}

function getManualAddress(type) {
  const prefix = type === 'sdlt' ? 'sdlt' : 'prev';
  
  // Get country and normalize it
  let country = 'GBR';
  if (type === 'sdlt') {
    // SDLT address is always UK
    country = 'GBR';
  } else {
    // Previous address - get country from dropdown
    const previousCountryElement = document.getElementById('previousAddressCountry');
    if (previousCountryElement) {
      const countryRaw = previousCountryElement.dataset.countryCode || previousCountryElement.value || 'GBR';
      country = normalizeCountryCode(countryRaw);
    }
  }
  
  // Read values from manual input fields
  const flatNumber = document.getElementById(`${prefix}FlatNumber`)?.value?.trim() || '';
  const buildingNumber = document.getElementById(`${prefix}BuildingNumber`)?.value?.trim() || '';
  const buildingName = document.getElementById(`${prefix}BuildingName`)?.value?.trim() || '';
  const street = document.getElementById(`${prefix}Street`)?.value?.trim() || '';
  const subStreet = document.getElementById(`${prefix}SubStreet`)?.value?.trim() || '';
  const town = document.getElementById(`${prefix}Town`)?.value?.trim() || '';
  const postcode = document.getElementById(`${prefix}Postcode`)?.value?.trim() || '';
  
  const isUK = country === 'GBR';
  const isUSAOrCAN = country === 'USA' || country === 'CAN';
  
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
  
  // USA/Canada: address_1, address_2, state required
  if (isUSAOrCAN) {
    // Build address_1 from available fields
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
      state: '', // State field not in manual inputs, leave empty
      country: country
    };
  }
  
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
}


function collectDocuments() {
  // In edit mode, use documents from original submission
  if (formState.isEditMode && formState.originalSubmission) {
    return {
      leaseAgreement: formState.originalSubmission.leaseAgreement,
      supportingDocuments: formState.originalSubmission.supportingDocuments || []
    };
  }
  
  // Use uploaded documents from put-links response (data.images array)
  // This array contains all documents (lease + additional) with s3Keys already included
  const uploadedDocs = formState.uploadedDocuments || [];
  
  if (uploadedDocs.length === 0) {
    return { leaseAgreement: undefined, supportingDocuments: [] };
  }
  
  // Split data.images directly - maintain full object structure
  let leaseAgreement = undefined;
  const supportingDocuments = [];
  
  uploadedDocs.forEach((doc) => {
    // Check if this is the lease document (identified by isLease flag)
    if (doc.isLease === true) {
      // Lease document - set document to "Lease Agreement" and description to file name
      leaseAgreement = {
        ...doc,
        document: "Lease Agreement",
        description: doc.data?.name || doc.name || undefined
      };
    } else {
      // Additional document - pass through full object structure
      supportingDocuments.push(doc);
    }
  });
  
  return { leaseAgreement, supportingDocuments };
}

// ===== FILE UPLOAD FUNCTIONS =====

/**
 * Collect files that need to be uploaded (files without s3Key)
 * @returns {Array} Array of file objects with file, name, size, type, and metadata
 */
function collectFilesForUpload() {
  // In edit mode, no new files can be uploaded
  if (formState.isEditMode) {
    return [];
  }
  
  const files = [];
  const submitterEmail = document.getElementById('submitterEmail').value;
  
  // Helper to format date like document-viewer
  const formatDate = () => {
    return new Date().toLocaleString('en-GB', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };
  
  // Lease document (always required)
  if (formState.leaseDocument && formState.leaseDocument.file && !formState.leaseDocument.s3Key) {
    files.push({
      type: 'user',
      document: formState.leaseDocument.name, // Use file's actual name for lease
      uploader: submitterEmail,
      date: formatDate(),
      data: {
        type: formState.leaseDocument.type,
        size: formState.leaseDocument.size,
        name: formState.leaseDocument.name,
        lastModified: formState.leaseDocument.file.lastModified
      },
      file: formState.leaseDocument.file,
      isLease: true,
      isAdditional: false,
      isCalculation: false,
      isLegalInvoice: false,
      isSDLTInvoice: false,
      isSDLTCertificate: false,
      isCompletionStatement: false
    });
  }
  
  // Additional documents
  formState.additionalDocuments.forEach(doc => {
    if (doc.file && !doc.s3Key) {
      const titleEl = document.getElementById(`${doc.id}_title`);
      const descEl = document.getElementById(`${doc.id}_description`);
      const documentTitle = titleEl?.value || doc.name; // Use title if given, otherwise file name
      
      files.push({
        type: 'user',
        document: documentTitle,
        uploader: submitterEmail,
        date: formatDate(),
        data: {
          type: doc.type,
          size: doc.size,
          name: doc.name,
          lastModified: doc.file.lastModified
        },
        file: doc.file,
        description: descEl?.value || undefined, // Add description if given
        isLease: false,
        isAdditional: true,
        docId: doc.id,
        isCalculation: false,
        isLegalInvoice: false,
        isSDLTInvoice: false,
        isSDLTCertificate: false,
        isCompletionStatement: false
      });
    }
  });
  
  return files;
}

/**
 * Request PUT links from parent for files
 */
function requestPutLinks(files) {
  uploadInProgress = true;
  pendingFilesForUpload = files;
  
  // Show upload progress overlay
  showUploadProgress(files);
  
  // Prepare file metadata (file object will be serialized to {} in postMessage, which is fine)
  const fileMetadata = files.map(f => ({
    type: f.type,
    document: f.document,
    uploader: f.uploader,
    date: f.date,
    data: f.data,
    file: f.file, // Will be serialized to {} in postMessage
    description: f.description || undefined,
    isLease: f.isLease || false,
    isAdditional: f.isAdditional || false,
    docId: f.docId || undefined
  }));
  
  // Request PUT links from parent
  window.parent.postMessage({
    type: 'file-data',
    files: fileMetadata
  }, '*');
}

/**
 * Handle PUT links response from parent
 */
function handlePutLinks(message) {
  if (!uploadInProgress) return;
  
  // Stop session countdown when we receive put-links
  stopSessionCountdown();
  
  // Extract data from message.data (put-links returns data object with links, s3Keys, and images)
  const data = message.data || message;
  const links = data.links || [];
  const s3Keys = data.s3Keys || [];
  const images = data.images || []; // Array of updated documents with s3Keys added
  
  if (links.length !== pendingFilesForUpload.length || s3Keys.length !== pendingFilesForUpload.length || images.length !== pendingFilesForUpload.length) {
    handlePutError({ message: 'Mismatch between files and upload links' });
    return;
  }
  
  // Store the uploaded documents (with s3Keys) for use in formData
  formState.uploadedDocuments = images;
  
  // Upload files to S3
  uploadFilesToS3(pendingFilesForUpload, links, s3Keys)
    .then(() => {
      console.log('✅ All files uploaded to S3');
      
      // Hide upload progress
      hideUploadProgress();
      
      // Reset upload state
      uploadInProgress = false;
      pendingFilesForUpload = [];
      
      // Submit form data with uploaded documents (already have s3Keys from images array)
      submitFormData();
    })
    .catch((error) => {
      console.error('❌ S3 upload failed:', error);
      
      // Hide upload progress
      hideUploadProgress();
      
      // Show error with retry option
      showUploadError(error.message || 'Upload failed. Please try again.');
      
      // Reset upload state
      uploadInProgress = false;
      pendingFilesForUpload = [];
      formState.uploadedDocuments = [];
      
      // Re-enable submit button
      if (elements.submitBtn) {
        elements.submitBtn.disabled = false;
      }
    });
}

/**
 * Handle PUT error response from parent
 */
function handlePutError(message) {
  if (!uploadInProgress) return;
  
  const data = message.data || message;
  console.error('❌ PUT error from parent:', data);
  
  // Stop, reset, and restart session countdown at 10 minutes
  stopSessionCountdown();
  startSessionCountdown();
  
  // Hide upload progress
  hideUploadProgress();
  
  // Show error with retry option
  const errorMsg = data.message || data.error || 'Failed to generate upload links';
  showUploadError(errorMsg);
  
  // Reset upload state
  uploadInProgress = false;
  pendingFilesForUpload = [];
  
  // Re-enable submit button
  if (elements.submitBtn) {
    elements.submitBtn.disabled = false;
  }
}

/**
 * Upload files to S3 using PUT links
 */
function uploadFilesToS3(files, links, s3Keys) {
  return new Promise((resolve, reject) => {
    let completed = 0;
    let hasErrors = false;
    const total = files.length;
    const uploadErrors = [];
    
    files.forEach((fileData, index) => {
      const fileItem = document.getElementById(`upload-file-${index}`);
      const statusText = fileItem?.querySelector('.upload-status-text');
      
      if (fileItem && statusText) {
        fileItem.style.borderLeftColor = '#ffa500';
        statusText.textContent = 'Uploading...';
      }
      
      // Upload to S3
      fetch(links[index], {
        method: 'PUT',
        body: fileData.file,
        headers: {
          'Content-Type': fileData.file.type
        }
      })
      .then(response => {
        if (response.ok) {
          if (fileItem && statusText) {
            fileItem.style.borderLeftColor = '#10a37f';
            statusText.textContent = 'Success';
          }
          completed++;
          updateUploadProgressUI(completed, total, hasErrors);
          
          if (completed === total) {
            setTimeout(() => {
              if (hasErrors) {
                reject(new Error('Some files failed to upload'));
              } else {
                resolve(s3Keys);
              }
            }, 1000);
          }
        } else {
          throw new Error(`Upload failed with status ${response.status}`);
        }
      })
      .catch(error => {
        console.error('S3 upload error for file:', fileData.data?.name || 'unknown', error);
        
        if (fileItem && statusText) {
          fileItem.style.borderLeftColor = '#e02424';
          statusText.textContent = `Error: ${error.message}`;
        }
        
        hasErrors = true;
        uploadErrors.push({ file: fileData.data?.name || 'unknown', error: error.message });
        completed++;
        updateUploadProgressUI(completed, total, hasErrors);
        
        if (completed === total) {
          setTimeout(() => {
            reject(new Error(`Upload failed for ${uploadErrors.length} file(s)`));
          }, 1000);
        }
      });
    });
  });
}

/**
 * Show upload progress overlay
 */
function showUploadProgress(files) {
  // Remove existing overlay if present
  const existing = document.getElementById('uploadProgressContainer');
  if (existing) existing.remove();
  
  const uploadContainer = document.createElement('div');
  uploadContainer.id = 'uploadProgressContainer';
  uploadContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;
  
  // Create file list HTML
  let fileListHTML = '';
  files.forEach((fileData, index) => {
    const fileName = fileData.data?.name || fileData.document || 'Unknown file';
    const fileSize = ((fileData.data?.size || 0) / 1024 / 1024).toFixed(2);
    
    fileListHTML += `
      <div class="file-item" id="upload-file-${index}" style="
        padding: 8px;
        margin: 3px 0;
        background: #f8f9fa;
        border-radius: 6px;
        border-left: 4px solid #4A90E2;
        font-size: 0.75rem;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      ">
        <div>
          <strong style="font-size: 0.7rem; display: block; margin-bottom: 3px;">${fileName}</strong>
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          text-align: right;
        ">
          <div style="font-size: 0.65rem; margin-bottom: 2px;">${fileSize} MB</div>
          <div class="upload-status-text" style="font-size: 0.65rem;">Pending</div>
        </div>
      </div>
    `;
  });
  
  uploadContainer.innerHTML = `
    <div style="
      background: white;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid #e0e0e0;
      max-width: 500px;
      width: 90%;
    ">
      <h3 style="color: #333; margin-bottom: 10px; font-size: 1rem;">Uploading Files</h3>
      <div style="
        width: 100%;
        height: 20px;
        background: #f0f0f0;
        border-radius: 10px;
        overflow: hidden;
        margin: 20px 0;
      ">
        <div id="uploadProgressFill" style="
          height: 100%;
          background: linear-gradient(90deg, #4A90E2, #10a37f);
          width: 0%;
          transition: width 0.3s ease;
        "></div>
      </div>
      <div id="uploadProgressText" style="font-size: 0.8rem; margin: 10px 0;">0% Complete</div>
      <div style="margin: 15px 0; max-height: 250px; overflow-y: auto;">
        ${fileListHTML}
      </div>
      <div id="uploadStatusMessage" style="text-align: center; font-weight: 600; margin: 15px 0; font-size: 0.8rem;"></div>
    </div>
  `;
  
  document.body.appendChild(uploadContainer);
}

/**
 * Hide upload progress overlay
 */
function hideUploadProgress() {
  const uploadContainer = document.getElementById('uploadProgressContainer');
  if (uploadContainer) {
    uploadContainer.remove();
  }
}

/**
 * Update upload progress UI
 */
function updateUploadProgressUI(completed, total, hasErrors = false) {
  const progressFill = document.getElementById('uploadProgressFill');
  const progressText = document.getElementById('uploadProgressText');
  const statusMessage = document.getElementById('uploadStatusMessage');
  
  if (progressFill && progressText) {
    const percentage = Math.round((completed / total) * 100);
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `${percentage}% Complete`;
  }
  
  if (statusMessage && completed === total) {
    if (hasErrors) {
      statusMessage.textContent = 'Upload completed with errors!';
      statusMessage.style.color = '#dc3545';
    } else {
      statusMessage.textContent = 'Upload completed successfully!';
      statusMessage.style.color = '#10a37f';
    }
  }
}

/**
 * Show upload error with retry option
 */
function showUploadError(message) {
  const errorMsg = `Upload Error: ${message}\n\nWould you like to retry?`;
  if (confirm(errorMsg)) {
    // Retry upload
    if (pendingFilesForUpload.length > 0) {
      requestPutLinks(pendingFilesForUpload);
    } else {
      // Re-collect files and retry
      const files = collectFilesForUpload();
      if (files.length > 0) {
        requestPutLinks(files);
      } else {
        showError('No files to upload. Please try submitting again.');
        if (elements.submitBtn) {
          elements.submitBtn.disabled = false;
        }
      }
    }
  } else {
    showError(message);
  }
}

/**
 * Submit form data with uploaded documents
 */
function submitFormData() {
  // In edit mode, send update-submission with only changed fields
  if (formState.isEditMode && formState.originalSubmission) {
    const formData = collectFormData();
    
    // Use original documents (cannot be changed in edit mode)
    const { leaseAgreement, supportingDocuments } = collectDocuments();
    formData.leaseAgreement = leaseAgreement || formState.originalSubmission.leaseAgreement;
    formData.supportingDocuments = supportingDocuments.length > 0 ? supportingDocuments : (formState.originalSubmission.supportingDocuments || []);
    formData.addSupportingDocuments = formState.originalSubmission.addSupportingDocuments || false;
    
    // Build idEntries array
    formData.idEntries = buildIdEntries();
    
    // Compare with original and find changed fields
    const updates = {};
    const updatedFields = [];
    
    // Compare all fields
    Object.keys(formData).forEach(key => {
      const originalValue = formState.originalSubmission[key];
      const newValue = formData[key];
      
      // Deep comparison for objects/arrays
      if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
        updates[key] = newValue;
        updatedFields.push(key);
      }
    });
    
    // Disable submit button during submission
    if (elements.submitBtn) {
      elements.submitBtn.disabled = true;
    }
    
    // Send update-submission message
    window.parent.postMessage({
      type: 'update-submission',
      updatedFields: updatedFields,
      updates: updates
    }, '*');
    
    return;
  }
  
  // New submission mode
  // Collect form data
  const formData = collectFormData();
  
  // Collect documents (now with s3Keys)
  const { leaseAgreement, supportingDocuments } = collectDocuments();
  
  // Add documents to form data
  formData.leaseAgreement = leaseAgreement;
  formData.supportingDocuments = supportingDocuments;
  formData.addSupportingDocuments = formState.addAdditionalDocuments || false;
  
  // Build idEntries array
  formData.idEntries = buildIdEntries();
  
  // Disable submit button during submission
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
  }
  
  // Send to parent
  window.parent.postMessage({
    type: 'dwellworks-form-data',
    formData: formData
  }, '*');
}

/**
 * Handle upload error from parent (when form submission fails)
 */
function handleUploadError(message) {
  const data = message.data || message;
  console.error('❌ Upload error from parent:', data);
  
  // Show error message
  const errorMsg = data.message || data.error || 'Form submission failed. Please try again.';
  showError(errorMsg);
  
  // Re-enable submit button so user can retry
  if (elements.submitBtn) {
    elements.submitBtn.disabled = false;
  }
  
  // Reset and restart session countdown
  stopSessionCountdown();
  startSessionCountdown();
}

// ===== ID ENTRIES BUILDING =====

/**
 * Generate random base62 ID (7 characters)
 */
function generateBase62Id() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format name as "A N Other" style (first letter of each name part)
 */
function formatNameAsInitials(firstName, lastName) {
  const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '';
  const lastParts = lastName ? lastName.split(' ') : [];
  const lastInitials = lastParts.map(part => part.charAt(0).toUpperCase()).join(' ');
  return `${firstInitial} ${lastInitials}`.trim();
}

/**
 * Check if a value is a date (various formats) or entity number
 * Returns true if it looks like a date, false if entity number
 */
function isDateValue(value) {
  if (!value || !value.trim()) return false;
  
  const trimmed = value.trim();
  
  // Check for date patterns: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd month yyyy
  const datePatterns = [
    /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/,  // dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy
    /^\d{1,2}\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{2,4}$/i,  // dd month yyyy
    /^\d{8}$/  // ddmmyyyy
  ];
  
  return datePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Convert DOB from various formats to dd-mm-yyyy
 */
function formatDOBToDDMMYYYY(dobValue) {
  if (!dobValue) return undefined;
  
  // If already in dd/mm/yyyy format, convert to dd-mm-yyyy
  if (dobValue.includes('/')) {
    return dobValue.replace(/\//g, '-');
  }
  
  // If in dd-mm-yyyy format, return as is
  if (dobValue.includes('-') && dobValue.match(/^\d{1,2}-\d{1,2}-\d{2,4}$/)) {
    // Normalize to 4-digit year
    const parts = dobValue.split('-');
    if (parts[2].length === 2) {
      const year = parseInt(parts[2]);
      parts[2] = year < 50 ? `20${parts[2]}` : `19${parts[2]}`;
    }
    return parts.join('-');
  }
  
  // If ddmmyyyy format (8 digits)
  if (dobValue.match(/^\d{8}$/)) {
    return `${dobValue.substring(0, 2)}-${dobValue.substring(2, 4)}-${dobValue.substring(4, 8)}`;
  }
  
  // Try to parse other formats
  const date = new Date(dobValue);
  if (!isNaN(date.getTime())) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
  
  return dobValue; // Return as-is if can't parse
}

/**
 * Build ID check reference from address (building name/no street, postcode)
 */
function buildIdCheckReference(address) {
  if (!address || typeof address !== 'object') return undefined;
  
  const parts = [];
  if (address.building_name) {
    parts.push(address.building_name);
  } else if (address.building_number) {
    parts.push(address.building_number);
  }
  if (address.street) {
    parts.push(address.street);
  }
  if (address.postcode) {
    parts.push(address.postcode);
  }
  
  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Extract mobile number from contact field (checks if it's a mobile number)
 * Handles various formats including international country codes (e.g., 353, +353, etc.)
 * Uses known country codes from phone selectors to identify and format numbers
 */
function extractMobileNumber(contactValue) {
  if (!contactValue) return undefined;
  
  const trimmed = contactValue.trim();
  
  // Check if it contains @ (email)
  if (trimmed.includes('@')) return undefined;
  
  // Remove spaces and common separators
  const cleaned = trimmed.replace(/[\s\-\(\)]/g, '');
  
  // If it already starts with +, it's likely a properly formatted international number
  if (cleaned.startsWith('+')) {
    // Validate it looks like a phone number (at least 7 digits after +)
    if (cleaned.match(/^\+\d{7,}$/)) {
      return cleaned;
    }
  }
  
  // Get known phone country codes (from jurisdiction-autocomplete.js)
  // Create a lookup of country codes without the + prefix
  const knownCountryCodes = [];
  if (typeof PHONE_COUNTRY_CODES !== 'undefined') {
    PHONE_COUNTRY_CODES.forEach(p => {
      // Extract numeric code from phone string (e.g., "+44" -> "44", "+353" -> "353")
      const codeWithoutPlus = p.phone.replace(/^\+/, '');
      knownCountryCodes.push({
        code: codeWithoutPlus,
        fullCode: p.phone,
        name: p.name
      });
    });
  } else {
    // Fallback: common country codes if PHONE_COUNTRY_CODES not available
    knownCountryCodes.push(
      { code: '44', fullCode: '+44', name: 'UK' },
      { code: '353', fullCode: '+353', name: 'Ireland' },
      { code: '1', fullCode: '+1', name: 'US/Canada' },
      { code: '33', fullCode: '+33', name: 'France' },
      { code: '49', fullCode: '+49', name: 'Germany' },
      { code: '39', fullCode: '+39', name: 'Italy' },
      { code: '34', fullCode: '+34', name: 'Spain' },
      { code: '31', fullCode: '+31', name: 'Netherlands' },
      { code: '32', fullCode: '+32', name: 'Belgium' },
      { code: '41', fullCode: '+41', name: 'Switzerland' },
      { code: '43', fullCode: '+43', name: 'Austria' },
      { code: '45', fullCode: '+45', name: 'Denmark' },
      { code: '46', fullCode: '+46', name: 'Sweden' },
      { code: '47', fullCode: '+47', name: 'Norway' },
      { code: '48', fullCode: '+48', name: 'Poland' },
      { code: '351', fullCode: '+351', name: 'Portugal' },
      { code: '352', fullCode: '+352', name: 'Luxembourg' },
      { code: '354', fullCode: '+354', name: 'Iceland' },
      { code: '356', fullCode: '+356', name: 'Malta' },
      { code: '357', fullCode: '+357', name: 'Cyprus' },
      { code: '358', fullCode: '+358', name: 'Finland' },
      { code: '359', fullCode: '+359', name: 'Bulgaria' },
      { code: '370', fullCode: '+370', name: 'Lithuania' },
      { code: '371', fullCode: '+371', name: 'Latvia' },
      { code: '372', fullCode: '+372', name: 'Estonia' },
      { code: '385', fullCode: '+385', name: 'Croatia' },
      { code: '386', fullCode: '+386', name: 'Slovenia' },
      { code: '420', fullCode: '+420', name: 'Czech Republic' },
      { code: '421', fullCode: '+421', name: 'Slovakia' }
    );
  }
  
  // Sort by code length (longest first) to match longer codes first (e.g., 353 before 35)
  knownCountryCodes.sort((a, b) => b.code.length - a.code.length);
  
  // Check if it starts with a known country code (without +)
  for (const country of knownCountryCodes) {
    if (cleaned.startsWith(country.code)) {
      // If it already has the +, return as-is
      if (cleaned.startsWith('+')) {
        return cleaned;
      }
      // Otherwise, add the + prefix using the matched country's full code
      return country.fullCode + cleaned.substring(country.code.length);
    }
  }
  
  // Check if it's a UK mobile (starts with 07 or 447)
  if (cleaned.match(/^(44)?7\d{9}$/)) {
    if (cleaned.startsWith('44')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('07')) {
      return `+44${cleaned.substring(1)}`;
    } else if (cleaned.startsWith('7')) {
      return `+44${cleaned}`;
    }
  }
  
  // If it's all digits and looks like a phone number (7+ digits), assume it needs + prefix
  if (cleaned.match(/^\d{7,}$/)) {
    return `+${cleaned}`;
  }
  
  return undefined;
}

/**
 * Extract email from contact field
 */
function extractEmail(contactValue) {
  if (!contactValue) return undefined;
  const trimmed = contactValue.trim();
  return trimmed.includes('@') ? trimmed : undefined;
}

/**
 * Build idEntries array for form submission
 */
function buildIdEntries() {
  const entries = [];
  const leaseUnder = document.querySelector('input[name="leaseUnder"]:checked')?.value;
  const legalFeePayee = document.querySelector('input[name="legalFeePayee"]:checked')?.value;
  const sdltFeePayee = document.querySelector('input[name="sdltFeePayee"]:checked')?.value;
  
  // Helper to format phone
  const formatPhone = (countryCodeEl, numberEl) => {
    const code = countryCodeEl?.dataset.phoneCode || '';
    const num = numberEl?.value || '';
    return code && num ? `${code}${num}` : num || undefined;
  };
  
  // Helper to get address object (ensures Thirdfort format)
  const getAddressObject = (addressObj, fallbackFn) => {
    // If we have an address object, ensure it's in Thirdfort format
    if (addressObj) {
      // Address should already be in Thirdfort format from handleAddressData or getManualAddress
      // But ensure country is normalized
      if (addressObj.country) {
        const normalized = { ...addressObj };
        normalized.country = normalizeCountryCode(addressObj.country);
        return normalized;
      }
      return addressObj;
    }
    // Fallback to manual address (already in Thirdfort format from getManualAddress)
    const manualAddress = fallbackFn();
    if (manualAddress && (manualAddress.street || manualAddress.town || manualAddress.postcode)) {
      return manualAddress;
    }
    return undefined;
  };
  
  // Helper to create cashier log entry
  const createCashierLogEntry = () => ({
    _id: generateBase62Id(),
    user: 'SDLT System',
    message: 'New Entry added to system from Dwellworks request',
    time: new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  });
  
  // Tenant 1 Entry
  const tenant1FirstName = document.getElementById('tenant1FirstName').value;
  const tenant1LastName = document.getElementById('tenant1LastName').value;
  const tenant1DOB = getDOBValue(1);
  const tenant1Mobile = formatPhone(
    document.getElementById('tenant1MobileCountryCode'),
    document.getElementById('tenant1Mobile')
  );
  const tenant1Email = document.getElementById('tenant1Email').value || undefined;
  const tenant1CurrentAddress = getAddressObject(sdltAddressObject, () => getManualAddress('sdlt'));
  const tenant1PreviousAddress = getAddressObject(previousAddressObject, () => getManualAddress('previous'));
  
  if (tenant1FirstName && tenant1LastName) {
    entries.push({
      title: "BA", // This should come from parent/submitter data
      clientNumber: 99999, // This should come from parent/submitter data
      matterNumber: "999", // This should come from parent/submitter data
      name: formatNameAsInitials(tenant1FirstName, tenant1LastName),
      business: false,
      dateOfBirth: tenant1DOB ? formatDOBToDDMMYYYY(tenant1DOB) : undefined,
      currentAddressNEW: tenant1CurrentAddress,
      previousAddressNEW: tenant1PreviousAddress,
      companyDetails: undefined,
      unassigned: true,
      cashierLog: [createCashierLogEntry()],
      matterDescription: "SDLT Submission",
      relation: "Our client",
      idCheckReference: tenant1CurrentAddress ? buildIdCheckReference(tenant1CurrentAddress) : undefined,
      surname: tenant1LastName,
      firstName: tenant1FirstName,
      email: tenant1Email,
      mobileNumber: tenant1Mobile,
      entityNumber: undefined,
      businessName: undefined
    });
  }
  
  // Tenant 2 Entry (if exists)
  if (formState.addSecondTenant) {
    const tenant2FirstName = document.getElementById('tenant2FirstName').value;
    const tenant2LastName = document.getElementById('tenant2LastName').value;
    const tenant2DOB = getDOBValue(2);
    const tenant2Mobile = formatPhone(
      document.getElementById('tenant2MobileCountryCode'),
      document.getElementById('tenant2Mobile')
    );
    const tenant2Email = document.getElementById('tenant2Email').value || undefined;
    
    if (tenant2FirstName && tenant2LastName) {
      entries.push({
        title: "BA",
        clientNumber: 99999,
        matterNumber: "999",
        name: formatNameAsInitials(tenant2FirstName, tenant2LastName),
        business: false,
        dateOfBirth: tenant2DOB ? formatDOBToDDMMYYYY(tenant2DOB) : undefined,
        currentAddressNEW: tenant1CurrentAddress, // Same as tenant 1
        previousAddressNEW: tenant1PreviousAddress, // Same as tenant 1
        companyDetails: undefined,
        unassigned: true,
        cashierLog: [createCashierLogEntry()],
        matterDescription: "SDLT Submission",
        relation: "Our client",
        idCheckReference: tenant1CurrentAddress ? buildIdCheckReference(tenant1CurrentAddress) : undefined,
        surname: tenant2LastName,
        firstName: tenant2FirstName,
        email: tenant2Email,
        mobileNumber: tenant2Mobile,
        entityNumber: undefined,
        businessName: undefined
      });
    }
  }
  
  // Employer Entry (if selected in any radio button) - only add once
  const employerName = document.getElementById('employerName').value;
  const employerCountry = document.getElementById('employerCountry');
  const employerNumber = document.getElementById('employerNumber').value;
  const isUKEmployer = employerCountry?.dataset.jurisdictionCode === 'GB';
  const employerCompanyData = isUKEmployer && formState.companyData ? formState.companyData : undefined;
  // Normalize both variants to tenant-employer for comparison
  const normalizedLeaseUnder = leaseUnder === 'tenants-employer' ? 'tenant-employer' : leaseUnder;
  const employerSelected = normalizedLeaseUnder === 'tenant-employer' || legalFeePayee === 'tenant-employer' || sdltFeePayee === 'tenant-employer';
  
  if (employerName && employerSelected) {
    entries.push({
      title: "BA", // This should come from parent/submitter data
      clientNumber: 99999, // This should come from parent/submitter data
      matterNumber: "999", // This should come from parent/submitter data
      name: employerName, // Full name for business
      business: true,
      dateOfBirth: undefined,
      currentAddressNEW: undefined,
      previousAddressNEW: undefined,
      companyDetails: employerCompanyData,
      unassigned: true,
      cashierLog: [createCashierLogEntry()],
      matterDescription: "SDLT Submission",
      relation: "Our client",
      idCheckReference: undefined,
      surname: undefined,
      firstName: undefined,
      email: undefined,
      mobileNumber: undefined,
      entityNumber: employerNumber || undefined,
      businessName: employerName
    });
  }
  
  // Other Leasee Entry (if "other" selected)
  if (leaseUnder === 'other') {
    const otherName = document.getElementById('leaseOtherName').value;
    const otherDobEntity = document.getElementById('leaseOtherDobEntity').value;
    const otherTel = formatPhone(
      document.getElementById('leaseOtherTelCountryCode'),
      document.getElementById('leaseOtherTel')
    );
    const otherEmail = document.getElementById('leaseOtherEmail').value || undefined;
    const isBusiness = otherDobEntity && !isDateValue(otherDobEntity);
    
    if (otherName) {
      // Parse name - assume first word is first name, rest is last name
      const nameParts = otherName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const entry = {
        title: "BA", // This should come from parent/submitter data
        clientNumber: 99999, // This should come from parent/submitter data
        matterNumber: "999", // This should come from parent/submitter data
        name: isBusiness ? otherName : formatNameAsInitials(firstName, lastName),
        business: isBusiness,
        dateOfBirth: isBusiness ? undefined : (otherDobEntity ? formatDOBToDDMMYYYY(otherDobEntity) : undefined),
        currentAddressNEW: undefined,
        previousAddressNEW: undefined,
        companyDetails: undefined,
        unassigned: true,
        cashierLog: [createCashierLogEntry()],
        matterDescription: "SDLT Submission",
        relation: document.getElementById('leaseOtherRelation').value || undefined,
        idCheckReference: undefined,
        surname: isBusiness ? undefined : lastName,
        firstName: isBusiness ? undefined : firstName,
        email: otherEmail,
        mobileNumber: otherTel,
        entityNumber: isBusiness ? otherDobEntity : undefined,
        businessName: isBusiness ? otherName : undefined
      };
      entries.push(entry);
    }
  }
  
  // Other Legal Fee Payee Entry (if "other" selected)
  if (legalFeePayee === 'other') {
    const otherName = document.getElementById('legalFeeOtherName').value;
    const otherDobEntity = document.getElementById('legalFeeOtherDobEntity').value;
    const otherTel = formatPhone(
      document.getElementById('legalFeeOtherTelCountryCode'),
      document.getElementById('legalFeeOtherTel')
    );
    const otherEmail = document.getElementById('legalFeeOtherEmail').value || undefined;
    const isBusiness = otherDobEntity && !isDateValue(otherDobEntity);
    
    if (otherName) {
      // Parse name - assume first word is first name, rest is last name
      const nameParts = otherName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const entry = {
        title: "BA", // This should come from parent/submitter data
        clientNumber: 99999, // This should come from parent/submitter data
        matterNumber: "999", // This should come from parent/submitter data
        name: isBusiness ? otherName : formatNameAsInitials(firstName, lastName),
        business: isBusiness,
        dateOfBirth: isBusiness ? undefined : (otherDobEntity ? formatDOBToDDMMYYYY(otherDobEntity) : undefined),
        currentAddressNEW: undefined,
        previousAddressNEW: undefined,
        companyDetails: undefined,
        unassigned: true,
        cashierLog: [createCashierLogEntry()],
        matterDescription: "SDLT Submission",
        relation: document.getElementById('legalFeeOtherRelation').value || undefined,
        idCheckReference: undefined,
        surname: isBusiness ? undefined : lastName,
        firstName: isBusiness ? undefined : firstName,
        email: otherEmail,
        mobileNumber: otherTel,
        entityNumber: isBusiness ? otherDobEntity : undefined,
        businessName: isBusiness ? otherName : undefined
      };
      entries.push(entry);
    }
  }
  
  // Other SDLT Fee Payee Entry (if "other" selected)
  if (sdltFeePayee === 'other') {
    const otherName = document.getElementById('sdltFeeOtherName').value;
    const otherDobEntity = document.getElementById('sdltFeeOtherDobEntity').value;
    const otherTel = formatPhone(
      document.getElementById('sdltFeeOtherTelCountryCode'),
      document.getElementById('sdltFeeOtherTel')
    );
    const otherEmail = document.getElementById('sdltFeeOtherEmail').value || undefined;
    const isBusiness = otherDobEntity && !isDateValue(otherDobEntity);
    
    if (otherName) {
      // Parse name - assume first word is first name, rest is last name
      const nameParts = otherName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const entry = {
        title: "BA", // This should come from parent/submitter data
        clientNumber: 99999, // This should come from parent/submitter data
        matterNumber: "999", // This should come from parent/submitter data
        name: isBusiness ? otherName : formatNameAsInitials(firstName, lastName),
        business: isBusiness,
        dateOfBirth: isBusiness ? undefined : (otherDobEntity ? formatDOBToDDMMYYYY(otherDobEntity) : undefined),
        currentAddressNEW: undefined,
        previousAddressNEW: undefined,
        companyDetails: undefined,
        unassigned: true,
        cashierLog: [createCashierLogEntry()],
        matterDescription: "SDLT Submission",
        relation: document.getElementById('sdltFeeOtherRelation').value || undefined,
        idCheckReference: undefined,
        surname: isBusiness ? undefined : lastName,
        firstName: isBusiness ? undefined : firstName,
        email: otherEmail,
        mobileNumber: otherTel,
        entityNumber: isBusiness ? otherDobEntity : undefined,
        businessName: isBusiness ? otherName : undefined
      };
      entries.push(entry);
    }
  }
  
  return entries;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Validate phone number using google-libphonenumber
 * Only used for tenant mobile numbers (tenant1Mobile and tenant2Mobile)
 * @param {string} phoneNumber - Full phone number with country code (e.g., "+447700900123")
 * @returns {boolean} - True if valid, false otherwise
 */
function validatePhoneNumberWithLibPhone(phoneNumber) {
  if (!phoneNumber || !phoneNumber.trim()) {
    return false;
  }
  
  // Check if libphonenumber is loaded
  if (typeof libphonenumber === 'undefined') {
    console.warn('⚠️ libphonenumber not loaded, skipping phone validation');
    return true; // Don't block submission if library isn't loaded
  }
  
  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const cleanPhone = phoneNumber.trim();
    
    // Try to parse the number
    let parsedNumber = null;
    
    // If it starts with +, parse as international
    if (cleanPhone.startsWith('+')) {
      try {
        parsedNumber = phoneUtil.parseAndKeepRawInput(cleanPhone, null);
      } catch (e) {
        console.warn('Failed to parse international number:', e.message);
        return false;
      }
    } else {
      // Try common regions
      const commonRegions = ['GB', 'US', 'CA', 'AU', 'IE', 'FR', 'DE'];
      for (const region of commonRegions) {
        try {
          parsedNumber = phoneUtil.parseAndKeepRawInput(cleanPhone, region);
          if (phoneUtil.isValidNumber(parsedNumber)) {
            break;
          }
          parsedNumber = null;
        } catch (e) {
          continue;
        }
      }
    }
    
    // Validate the parsed number
    if (parsedNumber && phoneUtil.isValidNumber(parsedNumber)) {
      // Check if it's a mobile number (if possible)
      const numberType = phoneUtil.getNumberType(parsedNumber);
      // Mobile types: 1 = MOBILE, 2 = FIXED_LINE_OR_MOBILE
      // Using integer values as enum may not be available
      if (numberType === 1 || numberType === 2) {
        return true;
      }
      // For other types, still accept if valid (some countries don't distinguish)
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error validating phone number:', error);
    return false;
  }
}

// ===== SESSION COUNTDOWN =====

function setupSessionCountdown() {
  // Setup renew session button
  const renewBtn = document.getElementById('renewSessionBtn');
  if (renewBtn) {
    renewBtn.addEventListener('click', handleRenewSession);
  }
  
  // Setup cancel submission button
  const cancelBtn = document.getElementById('cancelSubmissionBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancelSubmission);
  }
}

function stopSessionCountdown() {
  // Clear main countdown interval
  if (sessionCountdown.intervalId) {
    clearInterval(sessionCountdown.intervalId);
    sessionCountdown.intervalId = null;
  }
  
  // Clear overlay countdown interval
  if (sessionCountdown.overlayIntervalId) {
    clearInterval(sessionCountdown.overlayIntervalId);
    sessionCountdown.overlayIntervalId = null;
  }
  
  // Hide overlay if visible
  hideSessionExpiryOverlay();
}

function startSessionCountdown() {
  // Show countdown header
  const header = document.getElementById('sessionCountdownHeader');
  if (header) {
    header.classList.remove('hidden');
  }
  
  // Reset countdown
  sessionCountdown.remainingSeconds = sessionCountdown.totalSeconds;
  updateCountdownDisplay();
  
  // Clear any existing interval
  if (sessionCountdown.intervalId) {
    clearInterval(sessionCountdown.intervalId);
  }
  
  // Start countdown
  sessionCountdown.intervalId = setInterval(() => {
    sessionCountdown.remainingSeconds--;
    updateCountdownDisplay();
    
    // Show overlay at 60 seconds
    if (sessionCountdown.remainingSeconds === 60) {
      showSessionExpiryOverlay();
    }
    
    // Handle expiry
    if (sessionCountdown.remainingSeconds <= 0) {
      clearInterval(sessionCountdown.intervalId);
      handleSessionExpiry();
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const timer = document.getElementById('countdownTimer');
  if (!timer) return;
  
  const minutes = Math.floor(sessionCountdown.remainingSeconds / 60);
  const seconds = sessionCountdown.remainingSeconds % 60;
  const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  timer.textContent = formatted;
  
  // Update styling based on time remaining
  timer.classList.remove('warning', 'danger');
  if (sessionCountdown.remainingSeconds <= 60) {
    timer.classList.add('danger');
  } else if (sessionCountdown.remainingSeconds <= 120) {
    timer.classList.add('warning');
  }
}

function showSessionExpiryOverlay() {
  const overlay = document.getElementById('sessionExpiryOverlay');
  if (!overlay) return;
  
  // Freeze form - disable submit button
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
  }
  
  // Disable all form inputs
  document.querySelectorAll('input, select, textarea, button').forEach(el => {
    if (el.id !== 'renewSessionBtn' && el.id !== 'cancelSubmissionBtn') {
      el.disabled = true;
    }
  });
  
  // Start overlay countdown (60 seconds)
  sessionCountdown.overlaySeconds = 60;
  updateOverlayCountdown();
  
  overlay.classList.remove('hidden');
  
  // Clear any existing overlay interval
  if (sessionCountdown.overlayIntervalId) {
    clearInterval(sessionCountdown.overlayIntervalId);
  }
  
  // Start overlay countdown
  sessionCountdown.overlayIntervalId = setInterval(() => {
    sessionCountdown.overlaySeconds--;
    updateOverlayCountdown();
    
    if (sessionCountdown.overlaySeconds <= 0) {
      clearInterval(sessionCountdown.overlayIntervalId);
      handleSessionExpiry();
    }
  }, 1000);
}

function updateOverlayCountdown() {
  const overlayTimer = document.getElementById('overlayCountdown');
  if (overlayTimer) {
    overlayTimer.textContent = sessionCountdown.overlaySeconds;
  }
}

function hideSessionExpiryOverlay() {
  const overlay = document.getElementById('sessionExpiryOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
  
  // Clear overlay countdown
  if (sessionCountdown.overlayIntervalId) {
    clearInterval(sessionCountdown.overlayIntervalId);
    sessionCountdown.overlayIntervalId = null;
  }
  
  // Re-enable form inputs
  document.querySelectorAll('input, select, textarea, button').forEach(el => {
    el.disabled = false;
  });
  
  // Re-enable submit button if submitter data received
  if (elements.submitBtn && formState.submitterDataReceived) {
    elements.submitBtn.disabled = false;
  }
}

function handleRenewSession() {
  if (sessionCountdown.isRenewing) return;
  
  sessionCountdown.isRenewing = true;
  
  // Disable buttons during renewal
  const renewBtn = document.getElementById('renewSessionBtn');
  const cancelBtn = document.getElementById('cancelSubmissionBtn');
  if (renewBtn) renewBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  
  // Post message to parent
  window.parent.postMessage({
    type: 'renew-session'
  }, '*');
  
  // Wait for session-updated response (handled in handleSessionUpdated)
}

function handleSessionUpdated(message) {
  // Hide overlay
  hideSessionExpiryOverlay();
  
  // Reset renewal state
  sessionCountdown.isRenewing = false;
  
  // Re-enable buttons
  const renewBtn = document.getElementById('renewSessionBtn');
  const cancelBtn = document.getElementById('cancelSubmissionBtn');
  if (renewBtn) renewBtn.disabled = false;
  if (cancelBtn) cancelBtn.disabled = false;
  
  // Restart countdown with fresh 10 minutes
  startSessionCountdown();
  
  console.log('✅ Session renewed successfully');
}

function handleCancelSubmission() {
  // Post message to parent
  window.parent.postMessage({
    type: 'cancel-submission'
  }, '*');
  
  // Stop countdown
  if (sessionCountdown.intervalId) {
    clearInterval(sessionCountdown.intervalId);
  }
  if (sessionCountdown.overlayIntervalId) {
    clearInterval(sessionCountdown.overlayIntervalId);
  }
  
  // Hide overlay
  hideSessionExpiryOverlay();
  
  // Hide countdown header
  const header = document.getElementById('sessionCountdownHeader');
  if (header) {
    header.classList.add('hidden');
  }
}

function handleSessionExpiry() {
  // Post message to parent
  window.parent.postMessage({
    type: 'session-expiry'
  }, '*');
  
  // Stop countdown
  if (sessionCountdown.intervalId) {
    clearInterval(sessionCountdown.intervalId);
  }
  if (sessionCountdown.overlayIntervalId) {
    clearInterval(sessionCountdown.overlayIntervalId);
  }
  
  // Hide overlay
  hideSessionExpiryOverlay();
  
  // Hide countdown header
  const header = document.getElementById('sessionCountdownHeader');
  if (header) {
    header.classList.add('hidden');
  }
  
  // Disable submit button
  if (elements.submitBtn) {
    elements.submitBtn.disabled = true;
  }
}

function notifyParentReady() {
  window.parent.postMessage({
    type: 'iframe-ready',
    iframeType: 'dwellworks-request-form'
  }, '*');
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
  if (elements.errorPopup) {
    elements.errorPopup.classList.remove('hidden');
    setTimeout(() => {
      elements.errorPopup.classList.add('hidden');
    }, 5000);
  }
}

function hideError() {
  if (elements.errorPopup) {
    elements.errorPopup.classList.add('hidden');
  }
}

