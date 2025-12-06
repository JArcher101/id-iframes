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
  addSecondTenant: false,
  addAdditionalDocuments: false,
  additionalDocuments: [],
  leaseDocument: null,
  documents: [],
  sdltFeeEmployerMatch: true, // Defaults to Yes (matches legal fee)
  submitterDataReceived: false, // Track if submitter data has been received
  companyData: null // Full Companies House company data object
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
  
  // Update form state
  formState[field] = value === 'yes';
  
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
    document.getElementById('legalFeeEmployerContact').required = true;
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
          formState.sdltFeeDirectSend = legalValue === 'yes';
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
      document.getElementById('sdltFeeEmployerContact').value = document.getElementById('legalFeeEmployerContact').value;
      // Remove required when matching
      document.getElementById('sdltFeeEmployerName').required = false;
      document.getElementById('sdltFeeEmployerContact').required = false;
    } else {
      employerFields.classList.remove('hidden');
      // Both required when not matching
      document.getElementById('sdltFeeEmployerName').required = true;
      document.getElementById('sdltFeeEmployerContact').required = true;
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
    previousAddressCountry.addEventListener('change', function() {
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
    });
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
  
  employerCountry.addEventListener('change', function() {
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
  });
  
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
  input.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    if (companyNameDebounceTimer) clearTimeout(companyNameDebounceTimer);
    
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
  const fileInput = document.getElementById('leaseFileInput');
  if (fileInput) fileInput.click();
}

function handleLeaseFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    handleFileUpload(file, 'lease');
  }
}

function handleLeaseDrop(event) {
  event.preventDefault();
  event.stopPropagation();
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
    const legalFeeEmployerContact = document.getElementById('legalFeeEmployerContact');
    
    if (!legalFeeEmployerName?.value.trim() || !legalFeeEmployerContact?.value.trim()) {
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
      if (formState.sdltFeeEmployerMatch === false) {
        const sdltFeeEmployerName = document.getElementById('sdltFeeEmployerName');
        const sdltFeeEmployerContact = document.getElementById('sdltFeeEmployerContact');
        
        if (!sdltFeeEmployerName?.value.trim() || !sdltFeeEmployerContact?.value.trim()) {
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
      displayAddressSuggestions(message.suggestions, message.field);
      break;
    case 'address-data':
      handleAddressData(message.address, message.field);
      break;
    case 'company-results':
      displayCompanySuggestions(message.companies, message.byNumber);
      break;
    case 'company-data':
      handleCompanyData(message.company);
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

function displayAddressSuggestions(suggestions, field) {
  const dropdown = field === 'sdlt' 
    ? document.getElementById('sdltAddressDropdown')
    : document.getElementById('previousAddressDropdown');
  
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
    item.textContent = suggestion.formatted_address || suggestion.description;
    item.addEventListener('click', () => {
      selectAddressSuggestion(suggestion.id || suggestion.place_id, suggestion.formatted_address || suggestion.description, field);
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

function handleAddressData(address, field) {
  if (field === 'sdlt') {
    sdltAddressObject = address;
  } else {
    previousAddressObject = address;
  }
  
  validateForm();
}

function displayCompanySuggestions(companies, byNumber) {
  const dropdown = byNumber 
    ? document.getElementById('employerNumberDropdown')
    : document.getElementById('employerNameDropdown');
  
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
  const { url, fileName, uploadType, docId } = message;
  
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
    const s3Key = message.s3Key || extractS3KeyFromUrl(url);
    
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
    const legalFeeEmployerContact = document.getElementById('legalFeeEmployerContact');
    
    if (!legalFeeEmployerName?.value.trim()) errors.push('Legal fee employer name is required');
    if (!legalFeeEmployerContact?.value.trim()) errors.push('Legal fee employer contact is required');
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
      if (formState.sdltFeeEmployerMatch === false) {
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
    secondTenant: formState.addSecondTenant || false,
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
    lessee: leaseUnder || undefined,
    lesseeOther: leaseUnder === 'other' ? document.getElementById('leaseOtherName').value : undefined,
    lesseeDateOfBirthEntityNumber: leaseUnder === 'other' ? (document.getElementById('leaseOtherDobEntity').value || undefined) : undefined,
    lesseePhoneNumber: leaseUnder === 'other' ? (document.getElementById('leaseOtherTel').value || undefined) : undefined,
    lesseeEmail: leaseUnder === 'other' ? (document.getElementById('leaseOtherEmail').value || undefined) : undefined,
    lesseeRelationToTenant: leaseUnder === 'other' ? document.getElementById('leaseOtherRelation').value : undefined,
    leaseAgreementNote: document.getElementById('leaseNote').value || undefined,
    
    // Legal Fee (THS Fee)
    thsFeePayer: legalFeePayee || undefined,
    thsFeePayerOther: legalFeePayee === 'other' ? document.getElementById('legalFeeOtherName').value : undefined,
    thsFeePayerDateOfBirthEntityNumber: legalFeePayee === 'other' ? (document.getElementById('legalFeeOtherDobEntity').value || undefined) : undefined,
    thsFeePayerPhoneNumber: legalFeePayee === 'other' ? (document.getElementById('legalFeeOtherTel').value || undefined) : undefined,
    thsFeePayerEmail: legalFeePayee === 'other' ? (document.getElementById('legalFeeOtherEmail').value || undefined) : undefined,
    thsFeePayerRelationToTenant: legalFeePayee === 'other' ? document.getElementById('legalFeeOtherRelation').value : undefined,
    thsFeesInvoiceSending: legalFeePayee && legalFeePayee !== 'dwellworks' ? (formState.legalFeeDirectSend || undefined) : undefined,
    thsFeeEmployersAcocuntsEmail: legalFeePayee === 'tenant-employer' ? (document.getElementById('legalFeeEmployerContact').value || undefined) : undefined,
    thsFeeEmployersAccountsContactName: legalFeePayee === 'tenant-employer' ? document.getElementById('legalFeeEmployerName').value : undefined,
    
    // SDLT Fee
    sdltFeePayer: sdltFeePayee || undefined,
    sdltFeePayerOther: sdltFeePayee === 'other' ? document.getElementById('sdltFeeOtherName').value : undefined,
    sdltFeePayerDateOfBirthEntityNumber: sdltFeePayee === 'other' ? (document.getElementById('sdltFeeOtherDobEntity').value || undefined) : undefined,
    sdltFeePayerEmail: sdltFeePayee === 'other' ? (document.getElementById('sdltFeeOtherEmail').value || undefined) : undefined,
    sdltFeePayerPhone: sdltFeePayee === 'other' ? (document.getElementById('sdltFeeOtherTel').value || undefined) : undefined,
    sdltFeePayerRelationToTenant: sdltFeePayee === 'other' ? document.getElementById('sdltFeeOtherRelation').value : undefined,
    sdltFeeInvoiceSending: sdltFeePayee && sdltFeePayee !== 'dwellworks' ? (formState.sdltFeeDirectSend || undefined) : undefined,
    sdltFeeEmployerDetailsMatchThsLlpFeePayer: (sdltFeePayee === 'tenant-employer' && legalFeePayee === 'tenant-employer') ? formState.sdltFeeEmployerMatch : undefined,
    sdltFeeEmployersAccountContactName: (sdltFeePayee === 'tenant-employer' && !formState.sdltFeeEmployerMatch) ? document.getElementById('sdltFeeEmployerName').value : undefined,
    sdltFeeEmployersAccountEmail: (sdltFeePayee === 'tenant-employer' && !formState.sdltFeeEmployerMatch) ? (document.getElementById('sdltFeeEmployerContact').value || undefined) : undefined,
    
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
  
  return {
    flat_number: document.getElementById(`${prefix}FlatNumber`)?.value || '',
    building_number: document.getElementById(`${prefix}BuildingNumber`)?.value || '',
    building_name: document.getElementById(`${prefix}BuildingName`)?.value || '',
    street: document.getElementById(`${prefix}Street`)?.value || '',
    sub_street: document.getElementById(`${prefix}SubStreet`)?.value || '',
    town: document.getElementById(`${prefix}Town`)?.value || '',
    postcode: document.getElementById(`${prefix}Postcode`)?.value || '',
    country: type === 'sdlt' ? 'GBR' : (document.getElementById('previousAddressCountry')?.dataset.countryCode || 'GBR')
  };
}


function collectDocuments() {
  // Lease document (single file object)
  const leaseAgreement = formState.leaseDocument && formState.leaseDocument.s3Key ? {
    name: formState.leaseDocument.name,
    size: formState.leaseDocument.size,
    type: formState.leaseDocument.type,
    s3Key: formState.leaseDocument.s3Key
  } : undefined;
  
  // Supporting documents (array)
  const sdltDocuments = [];
  formState.additionalDocuments.forEach(doc => {
    if (doc.s3Key) {
      const titleEl = document.getElementById(`${doc.id}_title`);
      const descEl = document.getElementById(`${doc.id}_description`);
      
      sdltDocuments.push({
        name: doc.name,
        size: doc.size,
        type: doc.type,
        s3Key: doc.s3Key,
        document: titleEl?.value || 'Supporting Document',
        description: descEl?.value || undefined,
        uploader: 'User', // User upload, not staff
        date: new Date().toLocaleString('en-GB')
      });
    }
  });
  
  return { leaseAgreement, sdltDocuments };
}

// ===== FILE UPLOAD FUNCTIONS =====

/**
 * Collect files that need to be uploaded (files without s3Key)
 * @returns {Array} Array of file objects with file, name, size, type, and metadata
 */
function collectFilesForUpload() {
  const files = [];
  
  // Lease document (always required)
  if (formState.leaseDocument && formState.leaseDocument.file && !formState.leaseDocument.s3Key) {
    files.push({
      file: formState.leaseDocument.file,
      name: formState.leaseDocument.name,
      size: formState.leaseDocument.size,
      type: formState.leaseDocument.type,
      document: 'Lease Agreement',
      uploader: 'User',
      date: new Date().toLocaleString('en-GB'),
      isLease: true
    });
  }
  
  // Additional documents
  formState.additionalDocuments.forEach(doc => {
    if (doc.file && !doc.s3Key) {
      const titleEl = document.getElementById(`${doc.id}_title`);
      const descEl = document.getElementById(`${doc.id}_description`);
      
      files.push({
        file: doc.file,
        name: doc.name,
        size: doc.size,
        type: doc.type,
        document: titleEl?.value || 'Supporting Document',
        description: descEl?.value || undefined,
        uploader: 'User',
        date: new Date().toLocaleString('en-GB'),
        docId: doc.id,
        isAdditional: true
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
  
  // Prepare file metadata (without File objects)
  const fileMetadata = files.map(f => ({
    name: f.name,
    size: f.size,
    type: f.type,
    document: f.document,
    description: f.description,
    uploader: f.uploader,
    date: f.date,
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
  
  const links = message.links || [];
  const s3Keys = message.s3Keys || [];
  
  if (links.length !== pendingFilesForUpload.length || s3Keys.length !== pendingFilesForUpload.length) {
    handlePutError({ message: 'Mismatch between files and upload links' });
    return;
  }
  
  // Upload files to S3
  uploadFilesToS3(pendingFilesForUpload, links, s3Keys)
    .then((uploadedS3Keys) => {
      console.log('✅ All files uploaded to S3');
      
      // Update document objects with s3Keys
      updateDocumentsWithS3Keys(uploadedS3Keys);
      
      // Hide upload progress
      hideUploadProgress();
      
      // Reset upload state
      uploadInProgress = false;
      pendingFilesForUpload = [];
      
      // Submit form data with updated documents
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
  
  console.error('❌ PUT error from parent:', message);
  
  // Stop, reset, and restart session countdown at 10 minutes
  stopSessionCountdown();
  startSessionCountdown();
  
  // Hide upload progress
  hideUploadProgress();
  
  // Show error with retry option
  const errorMsg = message.message || 'Failed to generate upload links';
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
 * Update document objects with s3Keys from uploaded files
 */
function updateDocumentsWithS3Keys(uploadedS3Keys) {
  uploadedS3Keys.forEach((uploadedFile, index) => {
    const originalFile = pendingFilesForUpload[index];
    
    if (originalFile.isLease && formState.leaseDocument) {
      formState.leaseDocument.s3Key = uploadedFile.s3Key;
    } else if (originalFile.isAdditional && originalFile.docId) {
      const docItem = formState.additionalDocuments.find(doc => doc.id === originalFile.docId);
      if (docItem) {
        docItem.s3Key = uploadedFile.s3Key;
      }
    }
  });
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
        console.error('S3 upload error for file:', fileData.name, error);
        
        if (fileItem && statusText) {
          fileItem.style.borderLeftColor = '#e02424';
          statusText.textContent = `Error: ${error.message}`;
        }
        
        hasErrors = true;
        uploadErrors.push({ file: fileData.name, error: error.message });
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
    const fileName = fileData.name;
    const fileSize = ((fileData.size || 0) / 1024 / 1024).toFixed(2);
    
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
  // Collect form data
  const formData = collectFormData();
  
  // Collect documents (now with s3Keys)
  const { leaseAgreement, sdltDocuments } = collectDocuments();
  
  // Add documents to form data
  formData.leaseAgreement = leaseAgreement;
  formData.sdltDocuments = sdltDocuments;
  formData.addSupportingDocuments = formState.addAdditionalDocuments || false;
  
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
  console.error('❌ Upload error from parent:', message);
  
  // Show error message
  const errorMsg = message.message || message.error || 'Form submission failed. Please try again.';
  showError(errorMsg);
  
  // Re-enable submit button so user can retry
  if (elements.submitBtn) {
    elements.submitBtn.disabled = false;
  }
  
  // Reset and restart session countdown
  stopSessionCountdown();
  startSessionCountdown();
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

function handleSessionUpdated() {
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

