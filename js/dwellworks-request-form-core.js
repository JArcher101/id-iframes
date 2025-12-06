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
  sdltFeeEmployerMatch: true // Defaults to Yes (matches legal fee)
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
  
  // Check required checkboxes
  const requiredCheckboxes = document.querySelectorAll('input[type="checkbox"][required]');
  requiredCheckboxes.forEach(checkbox => {
    if (!checkbox.checked && !checkbox.closest('.hidden')) {
      isValid = false;
    }
  });
  
  // Check YES/NO buttons that are required
  const yesNoContainers = document.querySelectorAll('.yes-no-container');
  yesNoContainers.forEach(container => {
    if (!container.closest('.hidden')) {
      const buttons = container.querySelectorAll('.yes-no-btn');
      const hasSelected = Array.from(buttons).some(btn => btn.classList.contains('selected'));
      // Only validate if the container is visible and part of required flow
      // (addSecondTenant and addAdditionalDocuments are optional, so we don't validate them)
    }
  });
  
  // Check radio buttons
  const requiredRadios = document.querySelectorAll('input[type="radio"][required]');
  const radioGroups = new Set();
  requiredRadios.forEach(radio => {
    if (!radio.closest('.hidden')) {
      radioGroups.add(radio.name);
    }
  });
  
  radioGroups.forEach(groupName => {
    const checked = document.querySelector(`input[name="${groupName}"]:checked`);
    if (!checked) {
      isValid = false;
    }
  });
  
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
  
  // Update submit button
  if (elements.submitBtn) {
    elements.submitBtn.disabled = !isValid;
  }
  
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
  if (!validateForm()) {
    showError('Please complete all required fields');
    return;
  }
  
  // Collect form data
  const formData = collectFormData();
  
  // Collect documents
  const documents = collectDocuments();
  
  // Send to parent
  window.parent.postMessage({
    type: 'dwellworks-form-data',
    formData: formData,
    documents: documents
  }, '*');
}

function collectFormData() {
  const data = {
    // Your Details
    submitter: {
      firstName: document.getElementById('submitterFirstName').value,
      lastName: document.getElementById('submitterLastName').value,
      dwellworksReference: document.getElementById('dwellworksReference').value,
      phone: {
        countryCode: document.getElementById('submitterPhoneCountryCode').dataset.phoneCode,
        number: document.getElementById('submitterPhone').value
      },
      email: document.getElementById('submitterEmail').value,
      shareEmail: document.getElementById('shareEmail').value || null
    },
    
    // Tenant Details
    tenant1: {
      firstName: document.getElementById('tenant1FirstName').value,
      lastName: document.getElementById('tenant1LastName').value,
      dateOfBirth: getDOBValue(1),
      mobile: {
        countryCode: document.getElementById('tenant1MobileCountryCode').dataset.phoneCode,
        number: document.getElementById('tenant1Mobile').value
      },
      email: document.getElementById('tenant1Email').value || null
    },
    
    sdltAddress: sdltAddressObject || getManualAddress('sdlt'),
    moveInDate: document.getElementById('moveInDate').value,
    previousAddress: previousAddressObject || getManualAddress('previous'),
    
    // Second Tenant (if added)
    tenant2: formState.addSecondTenant ? {
      firstName: document.getElementById('tenant2FirstName').value,
      lastName: document.getElementById('tenant2LastName').value,
      dateOfBirth: getDOBValue(2),
      mobile: {
        countryCode: document.getElementById('tenant2MobileCountryCode').dataset.phoneCode,
        number: document.getElementById('tenant2Mobile').value
      },
      email: document.getElementById('tenant2Email').value || null
    } : null,
    
    // Employers Details
    employer: {
      country: document.getElementById('employerCountry').value,
      countryCode: document.getElementById('employerCountry').dataset.jurisdictionCode,
      name: document.getElementById('employerName').value,
      number: document.getElementById('employerNumber').value,
      organisationNumber: document.getElementById('employerNumber').dataset.organisationNumber || null
    },
    
    // Lease
    lease: {
      under: document.querySelector('input[name="leaseUnder"]:checked')?.value,
      other: document.querySelector('input[name="leaseUnder"]:checked')?.value === 'other' ? {
        name: document.getElementById('leaseOtherName').value,
        relation: document.getElementById('leaseOtherRelation').value,
        dobEntity: document.getElementById('leaseOtherDobEntity').value || null,
        email: document.getElementById('leaseOtherEmail').value || null,
        tel: document.getElementById('leaseOtherTel').value || null
      } : null,
      note: document.getElementById('leaseNote').value || null
    },
    
    // Legal Fee
    legalFee: {
      payee: document.querySelector('input[name="legalFeePayee"]:checked')?.value,
      other: document.querySelector('input[name="legalFeePayee"]:checked')?.value === 'other' ? {
        name: document.getElementById('legalFeeOtherName').value,
        relation: document.getElementById('legalFeeOtherRelation').value,
        dobEntity: document.getElementById('legalFeeOtherDobEntity').value || null,
        email: document.getElementById('legalFeeOtherEmail').value || null,
        tel: document.getElementById('legalFeeOtherTel').value || null
      } : null,
      employer: document.querySelector('input[name="legalFeePayee"]:checked')?.value === 'tenant-employer' ? {
        name: document.getElementById('legalFeeEmployerName').value,
        contact: document.getElementById('legalFeeEmployerContact').value || null
      } : null,
      directSend: formState.legalFeeDirectSend || null
    },
    
    // SDLT Fee
    sdltFee: {
      payee: document.querySelector('input[name="sdltFeePayee"]:checked')?.value,
      other: document.querySelector('input[name="sdltFeePayee"]:checked')?.value === 'other' ? {
        name: document.getElementById('sdltFeeOtherName').value,
        relation: document.getElementById('sdltFeeOtherRelation').value,
        dobEntity: document.getElementById('sdltFeeOtherDobEntity').value || null,
        email: document.getElementById('sdltFeeOtherEmail').value || null,
        tel: document.getElementById('sdltFeeOtherTel').value || null
      } : null,
      employer: document.querySelector('input[name="sdltFeePayee"]:checked')?.value === 'tenant-employer' ? {
        name: document.getElementById('sdltFeeEmployerName').value,
        contact: document.getElementById('sdltFeeEmployerContact').value || null,
        matchesLegalFee: formState.sdltFeeEmployerMatch || false
      } : null,
      directSend: formState.sdltFeeDirectSend || null
    },
    
    // Additional Documents
    additionalDocuments: formState.addAdditionalDocuments ? formState.additionalDocuments.map(doc => ({
      title: document.getElementById(`${doc.id}_title`).value,
      description: document.getElementById(`${doc.id}_description`).value || null,
      s3Key: doc.s3Key || null
    })) : [],
    
    // Additional Details
    additionalDetails: document.getElementById('additionalDetails').value || null,
    
    // Confirmations
    confirmations: {
      terms: document.getElementById('termsCheckbox').checked,
      privacy: document.getElementById('privacyCheckbox').checked,
      consent: document.getElementById('consentCheckbox').checked
    }
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
  const documents = [];
  
  // Lease document
  if (formState.leaseDocument && formState.leaseDocument.s3Key) {
    documents.push({
      type: 'lease',
      s3Key: formState.leaseDocument.s3Key,
      fileName: formState.leaseDocument.name,
      fileType: formState.leaseDocument.type,
      fileSize: formState.leaseDocument.size
    });
  }
  
  // Additional documents
  formState.additionalDocuments.forEach(doc => {
    if (doc.s3Key) {
      documents.push({
        type: 'additional',
        s3Key: doc.s3Key,
        fileName: doc.name,
        fileType: doc.type,
        fileSize: doc.size,
        title: document.getElementById(`${doc.id}_title`)?.value || '',
        description: document.getElementById(`${doc.id}_description`)?.value || null
      });
    }
  });
  
  return documents;
}

// ===== UTILITY FUNCTIONS =====

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

