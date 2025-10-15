/*
=====================================================================
REQUEST FORM - CORE JAVASCRIPT
=====================================================================
Core functionality for the request form including:
- Request type management and switching
- Parent-child communication via postMessage
- Common utilities and state management
=====================================================================
*/

// Global state
let currentRequestType = null;
let requestData = {};
let formState = {
  isLoading: false,
  hasUnsavedChanges: false,
  allowEdits: true
};

// Address and business data storage (aligned with client-details.html)
let currentAddressObject = null;
let previousAddressObject = null;
let businessData = null;
let addressDebounceTimer = null;
let previousAddressDebounceTimer = null;
let companyNameDebounceTimer = null;
let companyNumberDebounceTimer = null;

// DOM elements
const elements = {
  dynamicContentContainer: document.getElementById('dynamicContentContainer'),
  errorPopup: document.getElementById('errorPopup'),
  errorMessage: document.getElementById('errorMessage'),
  closeError: document.getElementById('closeError'),
  requestTags: document.querySelectorAll('.request-tag')
};

// Request type modules registry
const requestTypeModules = {};

// Initialize the form
document.addEventListener('DOMContentLoaded', function() {
  initializeForm();
});

function initializeForm() {
  // Set up event listeners
  setupEventListeners();
  
  // Listen for parent messages
  window.addEventListener('message', handleParentMessage);
  
  // Initialize request tags
  initializeRequestTags();
}

function setupEventListeners() {
  // Error popup close
  if (elements.closeError) {
    elements.closeError.addEventListener('click', hideError);
  }
  
  // Request tag selection
  elements.requestTags.forEach(tag => {
    tag.addEventListener('click', () => selectRequestType(tag.dataset.type));
  });
  
  // File input handling
  setupFileHandlers();
  
  // Matter details handling
  setupMatterDetailsHandlers();
  
  // Client details handling
  setupClientDetailsHandlers();
  
  // Business/Charity details handling
  setupBusinessCharityHandlers();
  
  // Contact details handling
  setupContactDetailsHandlers();
}

function initializeRequestTags() {
  // Add click handlers to request type tags
  elements.requestTags.forEach(tag => {
    tag.classList.remove('selected');
  });
}

function selectRequestType(type) {
  // Validate request type
  if (!requestTypeModules[type]) {
    showError(`Request type "${type}" is not available`);
    return;
  }
  
  const clickedTag = document.querySelector(`[data-type="${type}"]`);
  const isCurrentlySelected = clickedTag.classList.contains('selected');
  const allowedCombinations = ['formE', 'esof'];
  
  // Handle Form E & eSoF combination logic
  if (allowedCombinations.includes(type)) {
    // Check if we're trying to select a second allowed combination
    const currentSelected = Array.from(elements.requestTags)
      .filter(tag => tag.classList.contains('selected'))
      .map(tag => tag.dataset.type);
    
    const hasFormE = currentSelected.includes('formE');
    const hasEsoF = currentSelected.includes('esof');
    
    if (isCurrentlySelected) {
      // If clicking on an already selected Form E or eSoF, deselect it
      clickedTag.classList.remove('selected');
      if (type === currentRequestType) {
        currentRequestType = null;
        elements.dynamicContentContainer.innerHTML = '';
      }
    } else if ((type === 'formE' && hasEsoF) || (type === 'esof' && hasFormE)) {
      // Allow combining Form E & eSoF
      clickedTag.classList.add('selected');
      currentRequestType = type; // Set primary type for content loading
      loadRequestTypeContent(type);
    } else {
      // Single selection for other allowed combinations, or first selection
      elements.requestTags.forEach(tag => tag.classList.remove('selected'));
      clickedTag.classList.add('selected');
      currentRequestType = type;
      loadRequestTypeContent(type);
    }
  } else {
    // Standard single selection behavior for all other tags
    if (isCurrentlySelected) {
      // If already selected, deselect
      clickedTag.classList.remove('selected');
      currentRequestType = null;
      elements.dynamicContentContainer.innerHTML = '';
    } else {
      // Deselect all others and select this one
      elements.requestTags.forEach(tag => tag.classList.remove('selected'));
      clickedTag.classList.add('selected');
      currentRequestType = type;
      loadRequestTypeContent(type);
    }
  }
}


function loadRequestTypeContent(type) {
  const module = requestTypeModules[type];
  if (!module) {
    showError(`Module for request type "${type}" not found`);
    return;
  }
  
  try {
    // Clear current content
    elements.dynamicContentContainer.innerHTML = '';
    
    // Initialize the module
    if (module.init) {
      module.init(requestData);
    }
    
    // Render the content
    if (module.render) {
      const content = module.render();
      elements.dynamicContentContainer.innerHTML = content;
    }
    
    // Set up module-specific event listeners
    if (module.setupEventListeners) {
      module.setupEventListeners();
    }
    
    // Notify parent of type change
    sendMessageToParent({
      type: 'request-type-selected',
      requestType: type
    });
    
  } catch (error) {
    console.error(`Error loading request type ${type}:`, error);
    showError(`Failed to load request type: ${type}`);
  }
}

// Register a request type module
function registerRequestType(type, module) {
  requestTypeModules[type] = module;
}

// Get current request data
function getRequestData() {
  if (!currentRequestType || !requestTypeModules[currentRequestType]) {
    return null;
  }
  
  const module = requestTypeModules[currentRequestType];
  if (module.getData) {
    return module.getData();
  }
  
  return null;
}

// Validate address fields based on API requirements
function validateAddressFields() {
  const errors = [];
  
  // Get current address elements
  const addressNotListed = document.getElementById('addressNotListed');
  const currentCountry = document.getElementById('currentCountry');
  const town = document.getElementById('town');
  const postcode = document.getElementById('postcode');
  const flatNumber = document.getElementById('flatNumber');
  const buildingNumber = document.getElementById('buildingNumber');
  const buildingName = document.getElementById('buildingName');
  const street = document.getElementById('street');
  const subStreet = document.getElementById('subStreet');
  const currentAddress = document.getElementById('currentAddress');
  
  // Get previous address elements
  const recentMove = document.getElementById('recentMove');
  const previousAddress = document.getElementById('previousAddress');
  const previousAddressNotListed = document.getElementById('previousAddressNotListed');
  const previousCountry = document.getElementById('previousCountry');
  const prevTown = document.getElementById('prevTown');
  const prevPostcode = document.getElementById('prevPostcode');
  const prevFlatNumber = document.getElementById('prevFlatNumber');
  const prevBuildingNumber = document.getElementById('prevBuildingNumber');
  const prevBuildingName = document.getElementById('prevBuildingName');
  const prevStreet = document.getElementById('prevStreet');
  const prevSubStreet = document.getElementById('prevSubStreet');
  
  // Current address validation
  // Current address is NOT required when "not listed" is not checked
  // Manual address fields only required if "Address not listed" is checked
  if (addressNotListed?.checked) {
    const country = currentCountry?.value || 'GBR';
    const isUK = country === 'GBR';
    const isUSA = country === 'USA';
    const isCanada = country === 'CAN';
    
    // Always required per API: country and town
    if (!country) {
      errors.push('You have indicated current address not listed, please select a country.');
    }
    
    if (!town?.value?.trim()) {
      errors.push('You have indicated current address not listed, please enter the Town/City.');
    }
    
    if (isUK) {
      // Great Britain: town, postcode, country and one of flat_number, building_number, building_name
      if (!postcode?.value?.trim()) {
        errors.push('You have indicated current address not listed, please enter the Postcode.');
      }
      
      // Must have ONE OF flat_number, building_number, or building_name
      if (!flatNumber?.value?.trim() && !buildingNumber?.value?.trim() && !buildingName?.value?.trim()) {
        errors.push('You have indicated current address not listed, please enter at least one of: Flat Number, Building Number, or Building Name.');
      }
    } else if (isUSA || isCanada) {
      // USA/Canada: town, state, postcode, address_1, country
      if (!postcode?.value?.trim()) {
        errors.push('You have indicated current address not listed, please enter the Postcode.');
      }
      
      // For USA/Canada, we need address_1 (which is typically building name/number or street)
      const address1 = buildingName?.value?.trim() || buildingNumber?.value?.trim() || flatNumber?.value?.trim() || street?.value?.trim();
      if (!address1) {
        errors.push('You have indicated current address not listed, please enter the address (building name/number or street).');
      }
    } else {
      // Default: town, address_1, country
      const address1 = buildingName?.value?.trim() || buildingNumber?.value?.trim() || flatNumber?.value?.trim() || street?.value?.trim();
      if (!address1) {
        errors.push('You have indicated current address not listed, please enter the address (building name/number or street).');
      }
    }
  }
  
  // Previous address validation - only if recent move toggle is on
  if (recentMove?.checked) {
    const isPreviousUK = previousCountry?.value === 'GBR';
    
    // Previous address autocomplete only required if UK and "not listed" is NOT checked
    if (isPreviousUK && !previousAddressNotListed?.checked) {
      if (!previousAddress?.value?.trim()) {
        errors.push('You have indicated a recent move, please enter the previous address or check "Address not listed" to enter manually.');
      }
    }
    
    // Previous address manual fields only required if "not listed" is checked
    if (previousAddressNotListed?.checked) {
      const country = previousCountry?.value || 'GBR';
      const isUK = country === 'GBR';
      const isUSA = country === 'USA';
      const isCanada = country === 'CAN';
      
      // Always required per API: country and town
      if (!country) {
        errors.push('You have indicated previous address not listed, please select a country.');
      }
      
      if (!prevTown?.value?.trim()) {
        errors.push('You have indicated previous address not listed, please enter the Town/City.');
      }
      
      if (isUK) {
        // Great Britain: town, postcode, country and one of flat_number, building_number, building_name
        if (!prevPostcode?.value?.trim()) {
          errors.push('You have indicated previous address not listed, please enter the Postcode.');
        }
        
        // Must have ONE OF flat_number, building_number, or building_name
        if (!prevFlatNumber?.value?.trim() && !prevBuildingNumber?.value?.trim() && !prevBuildingName?.value?.trim()) {
          errors.push('You have indicated previous address not listed, please enter at least one of: Flat Number, Building Number, or Building Name.');
        }
      } else if (isUSA || isCanada) {
        // USA/Canada: town, state, postcode, address_1, country
        if (!prevPostcode?.value?.trim()) {
          errors.push('You have indicated previous address not listed, please enter the Postcode.');
        }
        
        // For USA/Canada, we need address_1 (which is typically building name/number or street)
        const address1 = prevBuildingName?.value?.trim() || prevBuildingNumber?.value?.trim() || prevFlatNumber?.value?.trim() || prevStreet?.value?.trim();
        if (!address1) {
          errors.push('You have indicated previous address not listed, please enter the address (building name/number or street).');
        }
      } else {
        // Default: town, address_1, country
        const address1 = prevBuildingName?.value?.trim() || prevBuildingNumber?.value?.trim() || prevFlatNumber?.value?.trim() || prevStreet?.value?.trim();
        if (!address1) {
          errors.push('You have indicated previous address not listed, please enter the address (building name/number or street).');
        }
      }
    }
  }
  
  return errors;
}

// Validate client details fields
function validateClientDetailsFields() {
  const errors = [];
  
  // Get name change elements
  const recentNameChange = document.getElementById('recentNameChange');
  const previousName = document.getElementById('previousName');
  const reasonForNameChange = document.getElementById('reasonForNameChange');
  
  // Previous/Known as name validation - only if toggle is on
  if (recentNameChange?.checked) {
    if (!previousName?.value?.trim()) {
      errors.push('You have indicated a recent name change, please enter the client\'s previous name.');
    }
    
    if (!reasonForNameChange?.value?.trim()) {
      errors.push('You have indicated a recent name change, please enter the reason for the change.');
    }
  }
  
  return errors;
}

// Validate current form
function validateCurrentForm() {
  const errors = [];
  
  // Add client details validation errors
  errors.push(...validateClientDetailsFields());
  
  // Add address validation errors
  errors.push(...validateAddressFields());
  
  if (!currentRequestType || !requestTypeModules[currentRequestType]) {
    errors.push('No request type selected');
    return { valid: false, errors: errors };
  }
  
  const module = requestTypeModules[currentRequestType];
  if (module.validate) {
    const validation = module.validate();
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
  }
  
  return { valid: errors.length === 0, errors: errors };
}

// Handle messages from parent
function handleParentMessage(event) {
  try {
    const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    
    switch (message.type) {
      case 'init-data':
        handleInitData(message);
        break;
        
      case 'request-data':
        handleDataRequest();
        break;
        
      case 'clear-form':
        clearForm();
        break;
        
      case 'address-results':
        // Handle address autocomplete results from getaddress.io
        displayAddressSuggestions(message.suggestions, message.field);
        break;
        
      case 'address-data':
        // Handle full address data from getaddress.io
        handleAddressData(message.address, message.field);
        break;
        
      case 'company-results':
      case 'charity-results':
        // Handle company/charity search results (placeholder for now)
        console.log('Received company/charity results:', message);
        break;
        
      case 'company-data':
      case 'charity-data':
        // Handle full company/charity data
        handleCompanyData(message.companyData || message.charityData);
        break;
        
      default:
        // Forward to current module if it has a message handler
        if (currentRequestType && requestTypeModules[currentRequestType]?.handleMessage) {
          requestTypeModules[currentRequestType].handleMessage(message);
        }
        break;
    }
  } catch (error) {
    console.error('Error handling parent message:', error);
  }
}

function handleInitData(message) {
  requestData = message.data || {};
  
  // Update header info if available
  updateHeaderInfo(requestData);
  
  // If specific request type is provided, select it
  if (message.requestType && requestTypeModules[message.requestType]) {
    selectRequestType(message.requestType);
  }
}

function handleDataRequest() {
  const validation = validateCurrentForm();
  
  if (!validation.valid) {
    sendMessageToParent({
      type: 'validation-error',
      errors: validation.errors
    });
    return;
  }
  
  const data = getRequestData();
  
  sendMessageToParent({
    type: 'request-data-response',
    requestType: currentRequestType,
    data: data
  });
}

function clearForm() {
  currentRequestType = null;
  requestData = {};
  
  // Clear UI
  elements.dynamicContentContainer.innerHTML = '';
  elements.requestTags.forEach(tag => tag.classList.remove('selected'));
}

function updateHeaderInfo(data) {
  // Update client info display if elements exist
  const clientNameEl = document.getElementById('clientName');
  const clientMatterEl = document.getElementById('clientMatterNumber');
  const titleBadgeEl = document.getElementById('titleBadge');
  
  if (data.clientName && clientNameEl) {
    clientNameEl.textContent = data.clientName;
  }
  
  if (data.matterNumber && clientMatterEl) {
    clientMatterEl.textContent = data.matterNumber;
  }
  
  if (data.title && titleBadgeEl) {
    titleBadgeEl.querySelector('span').textContent = data.title;
  }
}

// Utility functions
function sendMessageToParent(message) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
  if (elements.errorPopup) {
    elements.errorPopup.classList.remove('hidden');
  }
  
  // Auto-hide after 5 seconds
  setTimeout(hideError, 5000);
}

function hideError() {
  if (elements.errorPopup) {
    elements.errorPopup.classList.add('hidden');
  }
}

function setLoading(loading) {
  formState.isLoading = loading;
  
  // Toggle loading class on dynamic content container
  if (loading) {
    elements.dynamicContentContainer.classList.add('loading');
  } else {
    elements.dynamicContentContainer.classList.remove('loading');
  }
}

// File handling functions
function setupFileHandlers() {
  // Setup file input trigger
  window.triggerFileInput = function() {
    document.getElementById('fileInput').click();
  };
  
  // Setup file selection handler
  window.handleFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name);
    
    // Validate file type (documents only, NO images)
    if (!isValidDocumentType(file)) {
      // Invalid file type - show error and reset
      showError('Please open the entry in the ID system to upload ID images');
      resetUploadArea();
      return;
    }
    
    // Valid document - update UI to show success
    updateUploadAreaWithFile(file);
  };
  
  // Setup drag and drop handlers
  window.handleDragOver = function(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  };
  
  window.handleDragLeave = function(event) {
    event.currentTarget.classList.remove('dragover');
  };
  
  window.handleDrop = function(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    
    if (files.length > 0) {
      const file = files[0];
      console.log('File dropped:', file.name);
      
      // Validate file type (documents only, NO images)
      if (!isValidDocumentType(file)) {
        // Invalid file type - show error and reset
        showError('Please open the entry in the ID system to upload ID images');
        resetUploadArea();
        return;
      }
      
      // Valid document - update file input and UI
      const fileInput = document.getElementById('fileInput');
      // Set the dropped file to the input using a different approach
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      updateUploadAreaWithFile(file);
    }
  };

  // Setup CDF file handlers
  window.triggerCDFFileInput = function() {
    document.getElementById('cdfFileInput').click();
  };

  window.handleCDFFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('CDF File selected:', file.name);
    
    // Validate file type (documents only, NO images)
    if (!isValidDocumentType(file)) {
      // Invalid file type - show error and reset
      showError('Please open the entry in the ID system to upload ID images');
      resetCDFUploadArea();
      return;
    }
    
    // Valid document - update UI to show success
    updateCDFUploadAreaWithFile(file);
  };

  window.handleCDFDragOver = function(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  };

  window.handleCDFDragLeave = function(event) {
    event.currentTarget.classList.remove('dragover');
  };

  window.handleCDFDrop = function(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    
    if (files.length > 0) {
      const file = files[0];
      console.log('CDF File dropped:', file.name);
      
      // Validate file type (documents only, NO images)
      if (!isValidDocumentType(file)) {
        // Invalid file type - show error and reset
        showError('Please open the entry in the ID system to upload ID images');
        resetCDFUploadArea();
        return;
      }
      
      // Valid document - update file input and UI
      const fileInput = document.getElementById('cdfFileInput');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      updateCDFUploadAreaWithFile(file);
    }
  };

  // Setup OFSI file handlers
  window.triggerOFSIFileInput = function() {
    document.getElementById('ofsiFileInput').click();
  };

  window.handleOFSIFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('OFSI File selected:', file.name);
    
    // Validate file type (documents only, NO images)
    if (!isValidDocumentType(file)) {
      // Invalid file type - show error and reset
      showError('Please open the entry in the ID system to upload ID images');
      resetOFSIUploadArea();
      return;
    }
    
    // Valid document - update UI to show success
    updateOFSIUploadAreaWithFile(file);
  };

  window.handleOFSIDragOver = function(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  };

  window.handleOFSIDragLeave = function(event) {
    event.currentTarget.classList.remove('dragover');
  };

  window.handleOFSIDrop = function(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    
    if (files.length > 0) {
      const file = files[0];
      console.log('OFSI File dropped:', file.name);
      
      // Validate file type (documents only, NO images)
      if (!isValidDocumentType(file)) {
        // Invalid file type - show error and reset
        showError('Please open the entry in the ID system to upload ID images');
        resetOFSIUploadArea();
        return;
      }
      
      // Valid document - update file input and UI
      const fileInput = document.getElementById('ofsiFileInput');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      updateOFSIUploadAreaWithFile(file);
    }
  };
}

function isValidDocumentType(file) {
  if (!file) return true; // No file is valid
  
  // List of allowed MIME types (documents only, NO images)
  const allowedTypes = [
    'application/pdf',                                                          // PDF
    'application/msword',                                                       // Word (.doc)
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // Word (.docx)
    'application/vnd.ms-excel',                                                 // Excel (.xls)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',        // Excel (.xlsx)
    'application/vnd.ms-powerpoint',                                            // PowerPoint (.ppt)
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',// PowerPoint (.pptx)
    'text/plain',                                                               // Text files
    'text/rtf'                                                                  // Rich Text Format
  ];
  
  // File extensions as fallback (some browsers may not set MIME type correctly)
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf'];
  
  // Primary check: MIME type
  if (allowedTypes.includes(file.type)) {
    return true;
  }
  
  // Fallback check: File extension
  const fileName = file.name.toLowerCase();
  return allowedExtensions.some(ext => fileName.endsWith(ext));
}

function updateUploadAreaWithFile(file) {
  const uploadIcon = document.getElementById('uploadIcon');
  const uploadText = document.getElementById('uploadText');
  
  if (!uploadIcon || !uploadText) return;
  
  // Change icon to checkmark/tick
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  
  // Update text to show filename
  const maxLength = 15;
  const displayName = file.name.length > maxLength 
    ? file.name.substring(0, maxLength) + '...' 
    : file.name;
  uploadText.textContent = displayName;
  uploadText.title = file.name; // Show full name on hover
}

function resetUploadArea() {
  const uploadIcon = document.getElementById('uploadIcon');
  const uploadText = document.getElementById('uploadText');
  const fileInput = document.getElementById('fileInput');
  
  if (!uploadIcon || !uploadText || !fileInput) return;
  
  // Reset icon to upload arrow
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  `;
  
  // Reset text to "Upload"
  uploadText.textContent = 'Upload';
  uploadText.title = '';
  
  // Clear file input
  fileInput.value = '';
}

// CDF upload area helper functions
function updateCDFUploadAreaWithFile(file) {
  const uploadIcon = document.getElementById('cdfUploadIcon');
  const uploadText = document.getElementById('cdfUploadText');
  
  if (!uploadIcon || !uploadText) return;
  
  // Change icon to checkmark/tick
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  
  // Update text to show filename
  const maxLength = 15;
  const displayName = file.name.length > maxLength 
    ? file.name.substring(0, maxLength) + '...' 
    : file.name;
  uploadText.textContent = displayName;
  uploadText.title = file.name;
}

function resetCDFUploadArea() {
  const uploadIcon = document.getElementById('cdfUploadIcon');
  const uploadText = document.getElementById('cdfUploadText');
  const fileInput = document.getElementById('cdfFileInput');
  
  if (!uploadIcon || !uploadText || !fileInput) return;
  
  // Reset icon to upload arrow
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  `;
  
  // Reset text to "Upload Document"
  uploadText.textContent = 'Upload Document';
  uploadText.title = '';
  
  // Clear file input
  fileInput.value = '';
}

// OFSI upload area helper functions
function updateOFSIUploadAreaWithFile(file) {
  const uploadIcon = document.getElementById('ofsiUploadIcon');
  const uploadText = document.getElementById('ofsiUploadText');
  
  if (!uploadIcon || !uploadText) return;
  
  // Change icon to checkmark/tick
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;
  
  // Update text to show filename
  const maxLength = 15;
  const displayName = file.name.length > maxLength 
    ? file.name.substring(0, maxLength) + '...' 
    : file.name;
  uploadText.textContent = displayName;
  uploadText.title = file.name;
}

function resetOFSIUploadArea() {
  const uploadIcon = document.getElementById('ofsiUploadIcon');
  const uploadText = document.getElementById('ofsiUploadText');
  const fileInput = document.getElementById('ofsiFileInput');
  
  if (!uploadIcon || !uploadText || !fileInput) return;
  
  // Reset icon to upload arrow
  uploadIcon.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17,8 12,3 7,8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  `;
  
  // Reset text to "Upload Document"
  uploadText.textContent = 'Upload Document';
  uploadText.title = '';
  
  // Clear file input
  fileInput.value = '';
}

// Client details handlers
function setupClientDetailsHandlers() {
  // Handle date of birth input navigation
  const dobInputs = [
    document.getElementById('dob1'),
    document.getElementById('dob2'),
    document.getElementById('dob3'),
    document.getElementById('dob4'),
    document.getElementById('dob5'),
    document.getElementById('dob6'),
    document.getElementById('dob7'),
    document.getElementById('dob8')
  ];
  
  dobInputs.forEach((input, index) => {
    if (!input) return;
    
    // Handle input navigation
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !this.value && index > 0) {
        // Move to previous input on backspace when current is empty
        dobInputs[index - 1].focus();
      } else if (this.value.length === 1 && index < dobInputs.length - 1) {
        // Move to next input when current is filled
        dobInputs[index + 1].focus();
      }
    });
    
    // Handle only numeric input
    input.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^0-9]/g, '');
    });
  });
  
  // Handle recent name change toggle
  const recentNameChange = document.getElementById('recentNameChange');
  const nameChangeFields = document.getElementById('nameChangeFields');
  
  if (recentNameChange && nameChangeFields) {
    recentNameChange.addEventListener('change', function() {
      if (this.checked) {
        nameChangeFields.classList.remove('hidden');
      } else {
        nameChangeFields.classList.add('hidden');
      }
    });
  }
}

// Business/Charity details handlers
function setupBusinessCharityHandlers() {
  // Handle business name autocomplete
  const businessName = document.getElementById('businessName');
  const businessNameDropdown = document.getElementById('businessNameDropdown');
  const registrationCountry = document.getElementById('registrationCountry');
  
  if (businessName && businessNameDropdown) {
    businessName.addEventListener('input', function() {
      const searchTerm = this.value.trim();
      
      // Clear timer
      if (companyNameDebounceTimer) clearTimeout(companyNameDebounceTimer);
      
      // Clear stored company data when user types
      businessData = null;
      updateCompanyButtons();
      
      // Hide dropdown if too short or not UK
      if (searchTerm.length < 2 || (registrationCountry && registrationCountry.value !== 'GB')) {
        businessNameDropdown.classList.add('hidden');
        businessNameDropdown.innerHTML = '';
        return;
      }
      
      // Show loading
      businessNameDropdown.classList.remove('hidden');
      businessNameDropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
      
      // Debounce 300ms
      companyNameDebounceTimer = setTimeout(() => {
        console.log('📡 API call for company search:', searchTerm);
        window.parent.postMessage({
          type: 'company-search',
          searchTerm: searchTerm,
          searchBy: 'name',
          entityType: 'business'
        }, '*');
      }, 300);
    });
  }
  
  // Handle entity number autocomplete
  const entityNumber = document.getElementById('entityNumber');
  const entityNumberDropdown = document.getElementById('entityNumberDropdown');
  
  if (entityNumber && entityNumberDropdown) {
    entityNumber.addEventListener('input', function() {
      const searchTerm = this.value.trim();
      
      // Clear timer
      if (companyNumberDebounceTimer) clearTimeout(companyNumberDebounceTimer);
      
      // Clear stored company data when user types
      businessData = null;
      updateCompanyButtons();
      
      // Hide dropdown if too short or not UK
      if (searchTerm.length < 2 || (registrationCountry && registrationCountry.value !== 'GB')) {
        entityNumberDropdown.classList.add('hidden');
        entityNumberDropdown.innerHTML = '';
        return;
      }
      
      // Show loading
      entityNumberDropdown.classList.remove('hidden');
      entityNumberDropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
      
      // Debounce 300ms
      companyNumberDebounceTimer = setTimeout(() => {
        console.log('📡 API call for company number search:', searchTerm);
        window.parent.postMessage({
          type: 'company-search',
          searchTerm: searchTerm,
          searchBy: 'number',
          entityType: 'business'
        }, '*');
      }, 300);
    });
  }
}

// Contact details handlers
function setupContactDetailsHandlers() {
  // Handle address not listed checkbox
  const addressNotListed = document.getElementById('addressNotListed');
  const manualAddressFields = document.getElementById('manualAddressFields');
  
  if (addressNotListed && manualAddressFields) {
    addressNotListed.addEventListener('change', function() {
      if (this.checked) {
        manualAddressFields.classList.remove('hidden');
      } else {
        manualAddressFields.classList.add('hidden');
        // Clear manual address fields when hidden
        const manualInputs = manualAddressFields.querySelectorAll('input');
        manualInputs.forEach(input => input.value = '');
      }
    });
  }
  
  // Handle recent move toggle
  const recentMove = document.getElementById('recentMove');
  const previousAddressFields = document.getElementById('previousAddressFields');
  const previousManualAddressFields = document.getElementById('previousManualAddressFields');
  
  if (recentMove && previousAddressFields) {
    recentMove.addEventListener('change', function() {
      if (this.checked) {
        previousAddressFields.classList.remove('hidden');
      } else {
        previousAddressFields.classList.add('hidden');
        previousManualAddressFields?.classList.add('hidden');
        // Clear previous address fields when hidden
        const prevInputs = previousAddressFields.querySelectorAll('input');
        prevInputs.forEach(input => input.value = '');
      }
    });
  }
  
  // Handle current address autocomplete
  setupAddressAutocomplete('current');
  
  // Handle previous address "not listed" checkbox
  const previousAddressNotListed = document.getElementById('previousAddressNotListed');
  
  if (previousAddressNotListed && previousManualAddressFields) {
    previousAddressNotListed.addEventListener('change', function() {
      if (this.checked) {
        previousManualAddressFields.classList.remove('hidden');
      } else {
        previousManualAddressFields.classList.add('hidden');
        // Clear previous manual address fields when hidden
        const prevManualInputs = previousManualAddressFields.querySelectorAll('input');
        prevManualInputs.forEach(input => input.value = '');
      }
    });
  }
  
  // Handle previous address autocomplete
  setupAddressAutocomplete('previous');
  
  // Clear address objects when manual fields change (triggers rebuild from manual data)
  const manualAddressInputs = [
    'flatNumber', 'buildingNumber', 'buildingName', 'street', 'subStreet', 'town', 'postcode'
  ];
  const previousManualAddressInputs = [
    'prevFlatNumber', 'prevBuildingNumber', 'prevBuildingName', 'prevStreet', 'prevSubStreet', 'prevTown', 'prevPostcode'
  ];
  
  // Add listeners for manual address fields
  manualAddressInputs.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.addEventListener('input', function() {
        // Clear current address object when manual fields change
        currentAddressObject = null;
      });
    }
  });
  
  previousManualAddressInputs.forEach(fieldId => {
    const element = document.getElementById(fieldId);
    if (element) {
      element.addEventListener('input', function() {
        // Clear previous address object when manual fields change
        previousAddressObject = null;
      });
    }
  });
  
  // Clear address objects when "not listed" is unchecked and we're back to autocomplete
  if (addressNotListed) {
    addressNotListed.addEventListener('change', function() {
      if (!this.checked) {
        // Clear current address object when switching back to autocomplete
        currentAddressObject = null;
      }
    });
  }
  
  if (previousAddressNotListed) {
    previousAddressNotListed.addEventListener('change', function() {
      if (!this.checked) {
        // Clear previous address object when switching back to autocomplete
        previousAddressObject = null;
      }
    });
  }
}

// Matter details handlers
function setupMatterDetailsHandlers() {
  // Handle worktype dropdown selection
  const worktypeDropdown = document.getElementById('worktypeDropdown');
  const worktypeInput = document.getElementById('worktype');
  
  if (worktypeDropdown && worktypeInput) {
    worktypeDropdown.addEventListener('change', function() {
      if (this.value) {
        worktypeInput.value = this.value;
      }
    });
  }
  
  // Handle relation dropdown selection
  const relationDropdown = document.getElementById('relationDropdown');
  const relationInput = document.getElementById('relation');
  
  if (relationDropdown && relationInput) {
    relationDropdown.addEventListener('change', function() {
      if (this.value) {
        relationInput.value = this.value;
      }
    });
  }
}

// ===== ADDRESS AND BUSINESS DATA HANDLING =====

/*
Setup address autocomplete for current or previous address
*/
function setupAddressAutocomplete(field) {
  const inputElement = document.getElementById(field === 'current' ? 'currentAddress' : 'previousAddress');
  const dropdownElement = document.getElementById(field === 'current' ? 'currentAddressDropdown' : 'previousAddressDropdown');
  
  if (!inputElement || !dropdownElement) return;
  
  const isCurrentAddress = field === 'current';
  let selectedIndex = -1;
  
  inputElement.addEventListener('input', function(e) {
    const searchTerm = e.target.value.trim();
    
    // Clear appropriate timer
    if (isCurrentAddress) {
      if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
    } else {
      if (previousAddressDebounceTimer) clearTimeout(previousAddressDebounceTimer);
    }
    
    // Clear stored object when user types
    if (isCurrentAddress) {
      currentAddressObject = null;
    } else {
      previousAddressObject = null;
    }
    
    // Hide dropdown if too short
    if (searchTerm.length < 7) {
      dropdownElement.classList.add('hidden');
      dropdownElement.innerHTML = '';
      return;
    }
    
    // Show loading
    dropdownElement.classList.remove('hidden');
    dropdownElement.innerHTML = '<div class="address-loading">Searching addresses...</div>';
    
    // Debounce 300ms
    const timer = setTimeout(() => {
      console.log('📡 API call for autocomplete:', searchTerm);
      window.parent.postMessage({
        type: 'address-search',
        searchTerm: searchTerm,
        field: field
      }, '*');
    }, 300);
    
    if (isCurrentAddress) {
      addressDebounceTimer = timer;
    } else {
      previousAddressDebounceTimer = timer;
    }
  });
  
  // Keyboard navigation
  inputElement.addEventListener('keydown', (e) => {
    const items = dropdownElement.querySelectorAll('.address-dropdown-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelectedItem(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelectedItem(items, selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      dropdownElement.classList.add('hidden');
      selectedIndex = -1;
    }
  });
  
  // Click outside to close
  document.addEventListener('click', (e) => {
    if (!inputElement.contains(e.target) && !dropdownElement.contains(e.target)) {
      dropdownElement.classList.add('hidden');
      selectedIndex = -1;
    }
  });
  
  function updateSelectedItem(items, index) {
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }
}

/*
Format getaddress.io address data to Thirdfort format
- UK (GBR): Uses individual fields (building_name, building_number, flat_number, street, etc.)
- USA/CAN: Uses address_1, address_2, state
- Other: Uses address_1, address_2
- Per Thirdfort API spec: UK addresses must NOT include address_1/address_2
*/
function formatToThirdfort(getAddressData, country = 'GBR') {
  if (!getAddressData) return null;
  
  // UK addresses: Individual fields only (no address_1, address_2)
  if (country === 'GBR') {
    return {
      building_name: getAddressData.building_name || '',
      building_number: getAddressData.building_number || '',
      flat_number: getAddressData.flat_number || '',
      postcode: getAddressData.postcode || '',
      street: getAddressData.thoroughfare || getAddressData.street || '',
      sub_street: getAddressData.sub_street || '',
      town: getAddressData.town_or_city || getAddressData.town || '',
      country: country
    };
  }
  
  // USA/Canada: address_1, address_2, state required
  if (country === 'USA' || country === 'CAN') {
    return {
      address_1: getAddressData.line_1 || '',
      address_2: getAddressData.line_2 || getAddressData.line_3 || getAddressData.line_4 || '',
      postcode: getAddressData.postcode || '',
      street: getAddressData.thoroughfare || getAddressData.street || '',
      sub_street: getAddressData.sub_street || '',
      town: getAddressData.town_or_city || getAddressData.town || '',
      state: getAddressData.state || getAddressData.province || '',
      country: country
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
    country: country
  };
}

/*
Handle full address data from parent (address-data message)
*/
function handleAddressData(addressData, field) {
  const currentCountry = document.getElementById('currentCountry');
  const previousCountry = document.getElementById('previousCountry');
  const country = field === 'current' ? (currentCountry?.value || 'GBR') : (previousCountry?.value || 'GBR');
  const thirdfortAddress = formatToThirdfort(addressData, country);
  
  if (field === 'current') {
    currentAddressObject = thirdfortAddress;
    console.log('✅ Stored current address object:', currentAddressObject);
  } else {
    previousAddressObject = thirdfortAddress;
    console.log('✅ Stored previous address object:', previousAddressObject);
  }
}

/*
Handle full company/charity data from parent (company-data/charity-data message)
*/
function handleCompanyData(data) {
  businessData = data;
  console.log('✅ Received full company/charity data:', businessData);
  
  // Update company buttons visibility if they exist
  updateCompanyButtons();
  
  // Auto-populate registered office address if no current address exists
  if (businessData && businessData.registered_office_address) {
    autoPopulateRegisteredAddress();
  }
}

/*
Update company buttons visibility
*/
function updateCompanyButtons() {
  const companyLinkBtn = document.getElementById('companyLinkBtn');
  const companyRefreshBtn = document.getElementById('companyRefreshBtn');
  const entityNumber = document.getElementById('entityNumber');
  
  if (companyLinkBtn && companyRefreshBtn && entityNumber) {
    if (businessData && entityNumber.value?.trim()) {
      companyLinkBtn.classList.remove('hidden');
      companyRefreshBtn.classList.remove('hidden');
    } else {
      companyLinkBtn.classList.add('hidden');
      companyRefreshBtn.classList.add('hidden');
    }
  }
}

/*
Auto-populate registered office address if no current address exists
*/
function autoPopulateRegisteredAddress() {
  if (!businessData || !businessData.registered_office_address) return;
  
  const currentAddress = document.getElementById('currentAddress');
  const currentCountry = document.getElementById('currentCountry');
  
  // Only auto-populate if current address field is empty
  if (!currentAddress?.value?.trim()) {
    const regOffice = businessData.registered_office_address;
    
    // Build address string for search
    const addressParts = [
      regOffice.premises,
      regOffice.address_line_1,
      regOffice.address_line_2,
      regOffice.locality,
      regOffice.postal_code
    ].filter(p => p && p.trim());
    
    const addressString = addressParts.join(', ');
    
    if (addressString) {
      console.log('📍 Auto-populating registered office address:', addressString);
      
      // Set UK as country if not set
      if (currentCountry) {
        currentCountry.value = 'GBR';
      }
      
      // Populate the autocomplete field
      currentAddress.value = addressString;
    }
  }
}

/*
Display address suggestions in dropdown
*/
function displayAddressSuggestions(suggestions, field) {
  const dropdownElement = document.getElementById(field === 'current' ? 'currentAddressDropdown' : 'previousAddressDropdown');
  
  if (!dropdownElement) return;
  
  if (!suggestions || suggestions.length === 0) {
    dropdownElement.innerHTML = '<div class="address-no-results">No addresses found</div>';
    dropdownElement.classList.remove('hidden');
    return;
  }
  
  dropdownElement.innerHTML = '';
  
  suggestions.forEach((suggestion) => {
    const item = document.createElement('div');
    item.className = 'address-dropdown-item';
    item.textContent = suggestion.address;
    
    item.addEventListener('click', () => {
      selectAddressSuggestion(suggestion.id, suggestion.address, field === 'current');
    });
    
    dropdownElement.appendChild(item);
  });
  
  dropdownElement.classList.remove('hidden');
}

/*
Handle address selection from dropdown
*/
function selectAddressSuggestion(addressId, displayText, isCurrentAddress) {
  const inputElement = document.getElementById(isCurrentAddress ? 'currentAddress' : 'previousAddress');
  const dropdownElement = document.getElementById(isCurrentAddress ? 'currentAddressDropdown' : 'previousAddressDropdown');
  
  if (!inputElement || !dropdownElement) return;
  
  inputElement.value = displayText;
  dropdownElement.classList.add('hidden');
  
  // Request full address from parent
  console.log('📡 API call for full address:', addressId);
  window.parent.postMessage({
    type: 'address-lookup',
    addressId: addressId,
    field: isCurrentAddress ? 'current' : 'previous'
  }, '*');
}

/*
Build address objects from manual fields when needed
This is called before form submission to ensure we have proper address data
*/
function buildAddressObjects() {
  // Build current address object
  const addressNotListed = document.getElementById('addressNotListed');
  const currentCountry = document.getElementById('currentCountry');
  const isCurrentUK = currentCountry?.value === 'GBR';
  
  if (addressNotListed?.checked || !document.getElementById('currentAddress')?.value?.trim()) {
    // Build from manual fields or if no autocomplete address
    if (isCurrentUK) {
      // UK manual: Individual fields only (no address_1/address_2)
      currentAddressObject = {
        building_name: document.getElementById('buildingName')?.value?.trim() || '',
        building_number: document.getElementById('buildingNumber')?.value?.trim() || '',
        flat_number: document.getElementById('flatNumber')?.value?.trim() || '',
        postcode: document.getElementById('postcode')?.value?.trim() || '',
        street: document.getElementById('street')?.value?.trim() || '',
        sub_street: document.getElementById('subStreet')?.value?.trim() || '',
        town: document.getElementById('town')?.value?.trim() || '',
        country: 'GBR'
      };
    } else {
      // Non-UK: address_1, address_2 (no individual building fields)
      currentAddressObject = {
        address_1: document.getElementById('buildingName')?.value?.trim() || 
                  document.getElementById('buildingNumber')?.value?.trim() || 
                  document.getElementById('flatNumber')?.value?.trim() || 
                  document.getElementById('street')?.value?.trim() || '',
        address_2: document.getElementById('subStreet')?.value?.trim() || '',
        postcode: document.getElementById('postcode')?.value?.trim() || '',
        street: document.getElementById('street')?.value?.trim() || '',
        sub_street: document.getElementById('subStreet')?.value?.trim() || '',
        town: document.getElementById('town')?.value?.trim() || '',
        state: '',
        country: currentCountry?.value || 'GBR'
      };
    }
  }
  
  // Ensure country is set even if object was from API
  if (currentAddressObject) {
    currentAddressObject.country = currentCountry?.value || 'GBR';
  }
  
  // Build previous address object
  const recentMove = document.getElementById('recentMove');
  if (recentMove?.checked) {
    const previousCountry = document.getElementById('previousCountry');
    const isPreviousUK = previousCountry?.value === 'GBR';
    const previousAddressNotListed = document.getElementById('previousAddressNotListed');
    
    if (!isPreviousUK || previousAddressNotListed?.checked) {
      // Build from manual fields
      if (isPreviousUK) {
        // UK manual: Individual fields only (no address_1/address_2)
        previousAddressObject = {
          building_name: document.getElementById('prevBuildingName')?.value?.trim() || '',
          building_number: document.getElementById('prevBuildingNumber')?.value?.trim() || '',
          flat_number: document.getElementById('prevFlatNumber')?.value?.trim() || '',
          postcode: document.getElementById('prevPostcode')?.value?.trim() || '',
          street: document.getElementById('prevStreet')?.value?.trim() || '',
          sub_street: document.getElementById('prevSubStreet')?.value?.trim() || '',
          town: document.getElementById('prevTown')?.value?.trim() || '',
          country: 'GBR'
        };
      } else {
        // Non-UK: address_1, address_2 (no individual building fields)
        previousAddressObject = {
          address_1: document.getElementById('prevBuildingName')?.value?.trim() || 
                    document.getElementById('prevBuildingNumber')?.value?.trim() || 
                    document.getElementById('prevFlatNumber')?.value?.trim() || 
                    document.getElementById('prevStreet')?.value?.trim() || '',
          address_2: document.getElementById('prevSubStreet')?.value?.trim() || '',
          postcode: document.getElementById('prevPostcode')?.value?.trim() || '',
          street: document.getElementById('prevStreet')?.value?.trim() || '',
          sub_street: document.getElementById('prevSubStreet')?.value?.trim() || '',
          town: document.getElementById('prevTown')?.value?.trim() || '',
          state: '',
          country: previousCountry?.value || 'GBR'
        };
      }
      
      // Ensure country is set
      if (previousAddressObject) {
        previousAddressObject.country = previousCountry?.value || 'GBR';
      }
    }
  }
}

/*
Get current address and business data objects for form submission
This function should be called when preparing form data
*/
function getFormDataObjects() {
  // Build address objects from manual fields if needed
  buildAddressObjects();
  
  return {
    currentAddressObject,
    previousAddressObject,
    businessData
  };
}

/*
Open document in a new popup window
This is a placeholder function that will be connected to data later
*/
function openDocument(documentType) {
  console.log('Opening document:', documentType);
  
  // For now, just show an alert - will be replaced with actual document opening logic
  alert(`Opening ${documentType} document...`);
  
  // TODO: Implement actual document opening in new popup window
  // This will connect to document URLs and viewer functionality later
}

// Make openDocument globally available for onclick handlers
window.openDocument = openDocument;

/*
Open OFSI Consolidated Sanctions Search in popup window
*/
function openOFSISearch() {
  console.log('Opening OFSI Consolidated Sanctions Search');
  const popup = window.open(
    'https://sanctionssearchapp.ofsi.hmtreasury.gov.uk/', 
    'ofsiSearch', 
    'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=yes,toolbar=yes,location=yes,status=yes'
  );
  
  // Focus the popup window
  if (popup) {
    popup.focus();
  }
}

// Make openOFSISearch globally available for onclick handlers
window.openOFSISearch = openOFSISearch;

// ID Images Carousel Functions
let currentCarouselIndex = 0;
let idImages = [];

// Initialize ID Images carousel
function initializeIDImagesCarousel() {
  const carousel = document.getElementById('idImagesCarousel');
  const prevBtn = document.getElementById('idImagesPrevBtn');
  const nextBtn = document.getElementById('idImagesNextBtn');
  
  if (!carousel || !prevBtn || !nextBtn) return;
  
  updateCarouselNavigation();
}

// Navigate carousel
window.navigateCarousel = function(direction) {
  const carousel = document.getElementById('idImagesCarousel');
  const cards = carousel.querySelectorAll('.id-image-card');
  
  if (!carousel || cards.length === 0) return;
  
  const containerWidth = carousel.parentElement.offsetWidth;
  const cardWidth = 220 + 15; // card width + gap (updated for new max-width)
  
  if (direction === 'prev' && currentCarouselIndex > 0) {
    currentCarouselIndex--;
  } else if (direction === 'next' && currentCarouselIndex < cards.length - 1) {
    currentCarouselIndex++;
  }
  
  const translateX = -currentCarouselIndex * cardWidth;
  carousel.style.transform = `translateX(${translateX}px)`;
  
  updateCarouselNavigation();
};

// Update carousel navigation buttons
function updateCarouselNavigation() {
  const prevBtn = document.getElementById('idImagesPrevBtn');
  const nextBtn = document.getElementById('idImagesNextBtn');
  const carousel = document.getElementById('idImagesCarousel');
  const cards = carousel ? carousel.querySelectorAll('.id-image-card') : [];
  
  if (!prevBtn || !nextBtn) return;
  
  prevBtn.disabled = currentCarouselIndex === 0;
  nextBtn.disabled = currentCarouselIndex >= cards.length - 1;
}

// Open ID Image in single image viewer
window.openIDImage = function(button) {
  try {
    const imageId = button.getAttribute('data-image-id');
    const card = button.closest('.id-image-card');
    
    if (!card || !imageId) {
      console.error('Cannot find image card or ID for button:', button);
      return;
    }
    
    // Get image data from the card
    const imagePreview = card.querySelector('.image-preview img');
    const documentTitle = card.querySelector('.document-type-title');
    const sideTag = card.querySelector('.side-tag');
    
    if (!imagePreview || !documentTitle) {
      console.error('Missing image preview or document title');
      return;
    }
    
    const imageUrl = imagePreview.src;
    const documentType = documentTitle.textContent;
    const side = sideTag ? sideTag.textContent.replace(/[\[\]]/g, '') : null; // Remove brackets from side tag
    
    // Prepare data for single-image-viewer.html (matching the pattern from image-viewer.html)
    const viewerData = {
      document: documentType,
      side: side,
      name: `${documentType}${side ? ` ${side}` : ''}`,
      liveUrl: imageUrl,
      uploader: 'uploader@domain.com', // This would come from actual data
      date: new Date().toISOString()
    };
    
    // Encode data as base64 JSON for URL hash (matching image-viewer pattern)
    const dataHash = btoa(JSON.stringify(viewerData));
    
    // Construct the iframe URL using hash instead of query params
    const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
    const viewerUrl = `${baseUrl}/single-image-viewer.html#${dataHash}`;
    
    console.log('Opening ID image viewer:', viewerUrl);
    
    // Open in centered popup window (matching image-viewer pattern)
    const width = 1000;
    const height = 800;
    const left = (screen.width - width) / 2;
    const top = (screen.height - height) / 2;
    const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    
    const popup = window.open(viewerUrl, 'idImageViewer', features);
    
    if (!popup) {
      console.error('Failed to open popup window');
      alert('Please allow popups for this site to view images');
    }
    
  } catch (error) {
    console.error('Error opening ID image:', error);
    alert('Error opening image viewer');
  }
};

// Add ID image to carousel (for dynamic loading)
function addIDImageToCarousel(imageData) {
  const carousel = document.getElementById('idImagesCarousel');
  if (!carousel || !imageData) return;
  
  const card = document.createElement('div');
  card.className = 'id-image-card';
  card.setAttribute('data-image-id', imageData.id || Date.now());
  
  const sideTag = imageData.side ? `<span class="side-tag">[${imageData.side}]</span>` : '';
  const uploadInfo = imageData.uploadInfo || `Uploaded by ${imageData.uploader || 'email@domain.com'} on ${imageData.date || new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})}`;
  
  card.innerHTML = `
    <div class="image-preview">
      <img src="${imageData.url}" alt="${imageData.document} ${imageData.side || ''}" />
    </div>
    <div class="image-details">
      <div class="details-row">
        <span class="document-type-title">${imageData.document}</span>
        ${sideTag}
        <button class="open-image-btn" onclick="openIDImage(this)" title="Open image" data-image-id="${imageData.id || Date.now()}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <div class="upload-info">${uploadInfo}</div>
    </div>
  `;
  
  carousel.appendChild(card);
  idImages.push(imageData);
  updateCarouselNavigation();
}

// Initialize carousel when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(initializeIDImagesCarousel, 100);
  
  // Setup submit button handler
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleFormSubmit);
  }
});

// Form submit handler
function handleFormSubmit(event) {
  event.preventDefault();
  
  try {
    // Validate the form before submission
    if (!validateCurrentForm()) {
      showError('Please complete all required fields before submitting.');
      return;
    }
    
    // Get all form data
    const formData = getRequestData();
    
    // Show loading state
    setLoading(true);
    
    // Log the submission data (for debugging)
    console.log('Submitting form data:', formData);
    
    // Here you would typically send the data to your backend
    // For now, we'll simulate a successful submission
    setTimeout(() => {
      setLoading(false);
      alert('Request submitted successfully!');
      sendMessageToParent('form-submitted', formData);
    }, 1000);
    
  } catch (error) {
    console.error('Error submitting form:', error);
    setLoading(false);
    showError('An error occurred while submitting the form. Please try again.');
  }
}

// Make submit handler globally available
window.handleFormSubmit = handleFormSubmit;

// Expose functions for modules to use
window.RequestFormCore = {
  registerRequestType,
  getRequestData,
  validateCurrentForm,
  sendMessageToParent,
  showError,
  hideError,
  setLoading,
  requestData: () => requestData,
  currentRequestType: () => currentRequestType,
  // Address and business data functions
  getFormDataObjects,
  buildAddressObjects,
  currentAddressObject: () => currentAddressObject,
  previousAddressObject: () => previousAddressObject,
  businessData: () => businessData,
  // ID Images functions
  addIDImageToCarousel
};
