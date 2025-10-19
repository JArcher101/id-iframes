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
let previousRequestType = null;
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

// ID Documents storage
let idDocuments = [];
let idImages = [];

// Form J validation flags
let formJSufficientPhotos = false;
let formJConditionsMet = false;

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
  
  // Check if tag is disabled (e.g., entity-invalid types)
  if (clickedTag.disabled) {
    console.log(`⚠️ Request type "${type}" is not available for this client type`);
    return;
  }
  
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
      
      // Handle hint visibility when deselecting eSoF (Form E stays selected)
      if (type === 'esof' && hasFormE) {
        const eSoFHint = document.getElementById('eSoFHint');
        const eSoFSkipHint = document.getElementById('eSoFSkipHint');
        const ejHint = document.getElementById('ejHint');
        const messageInput = document.getElementById('messageInput');
        
        // Hide eSoFHint, show eSoFSkipHint
        if (eSoFHint) eSoFHint.classList.add('hidden');
        if (eSoFSkipHint) eSoFSkipHint.classList.remove('hidden');
        
        // Update message to Form E only text
        if (messageInput) {
          messageInput.value = 'The client has requested an electronic check during onboarding, we attach their CDF and recent OFSI along with the BCDs entered';
        }
        
        // Preserve ejHint visibility based on Form J flags
        if (ejHint) {
          const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
          const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
          
          if (formJSufficientPhotos && formJConditionsMet) {
            ejHint.classList.remove('hidden');
          }
        }
        
        console.log('🗑️ eSoF deselected manually → eSoFSkipHint shown, message updated, ejHint preserved');
        
        // Don't call resetFormUI - Form E stays active
        return;
      }
      
      // Handle deselecting Form E (also deselect eSoF and hide hints)
      if (type === 'formE') {
        const esofTag = document.querySelector('[data-type="esof"]');
        const eSoFHint = document.getElementById('eSoFHint');
        const eSoFSkipHint = document.getElementById('eSoFSkipHint');
        
        // Deselect eSoF tag
        if (esofTag && esofTag.classList.contains('selected')) {
          esofTag.classList.remove('selected');
          console.log('🗑️ eSoF also deselected (Form E deselected)');
        }
        
        // Hide both eSoF hints
        if (eSoFHint) eSoFHint.classList.add('hidden');
        if (eSoFSkipHint) eSoFSkipHint.classList.add('hidden');
      }
      
      if (type === currentRequestType) {
        previousRequestType = currentRequestType;
        currentRequestType = null;
        elements.dynamicContentContainer.innerHTML = '';
        // Reset UI when deselecting
        resetFormUI(previousRequestType, null);
      }
    } else if ((type === 'formE' && hasEsoF) || (type === 'esof' && hasFormE)) {
      // Allow combining Form E & eSoF
      clickedTag.classList.add('selected');
      
      // If selecting eSoF when Form E already selected, just toggle hints (don't init eSoF module)
      if (type === 'esof' && hasFormE) {
        const eSoFHint = document.getElementById('eSoFHint');
        const eSoFSkipHint = document.getElementById('eSoFSkipHint');
        const ejHint = document.getElementById('ejHint');
        const messageInput = document.getElementById('messageInput');
        
        // Show eSoFHint, hide eSoFSkipHint
        if (eSoFHint) eSoFHint.classList.remove('hidden');
        if (eSoFSkipHint) eSoFSkipHint.classList.add('hidden');
        
        // Update message to Form E + eSoF text (same as Form E alone)
        if (messageInput) {
          messageInput.value = 'The client has requested an electronic check during onboarding, we attach their CDF and recent OFSI along with the BCDs entered';
        }
        
        // Preserve ejHint visibility based on Form J flags
        if (ejHint) {
          const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
          const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
          
          if (formJSufficientPhotos && formJConditionsMet) {
            ejHint.classList.remove('hidden');
          }
        }
        
        console.log('✅ eSoF selected manually → eSoFHint shown, message updated, ejHint preserved');
        
        // Don't change currentRequestType or call loadRequestTypeContent
        // Form E remains the active module
        return;
      }
      
      // If selecting Form E when eSoF already selected, init Form E normally
      previousRequestType = currentRequestType;
      currentRequestType = type; // Set primary type for content loading
      // Reset UI before loading new content
      resetFormUI(previousRequestType, type);
      loadRequestTypeContent(type);
    } else {
      // Single selection for other allowed combinations, or first selection
      elements.requestTags.forEach(tag => tag.classList.remove('selected'));
      clickedTag.classList.add('selected');
      previousRequestType = currentRequestType;
      currentRequestType = type;
      // Reset UI before loading new content
      resetFormUI(previousRequestType, type);
      loadRequestTypeContent(type);
    }
  } else {
    // Standard single selection behavior for all other tags
    if (isCurrentlySelected) {
      // If already selected, deselect
      clickedTag.classList.remove('selected');
      previousRequestType = currentRequestType;
      currentRequestType = null;
      elements.dynamicContentContainer.innerHTML = '';
      // Reset UI when deselecting
      resetFormUI(previousRequestType, null);
    } else {
      // Deselect all others and select this one
      elements.requestTags.forEach(tag => tag.classList.remove('selected'));
      clickedTag.classList.add('selected');
      previousRequestType = currentRequestType;
      currentRequestType = type;
      // Reset UI before loading new content
      resetFormUI(previousRequestType, type);
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

/**
 * Validates and formats date of birth
 * @param {string} day - Day value (DD)
 * @param {string} month - Month value (MM)
 * @param {string} year - Year value (YYYY)
 * @returns {Object} - { valid: boolean, formatted: 'DD-MM-YYYY' or null, error: string or null }
 */
function validateAndFormatDOB(day, month, year) {
  console.log('🔍 DOB Validation - Input values:', { day, month, year });
  
  // Convert to strings and trim
  const dayStr = day ? String(day).trim() : '';
  const monthStr = month ? String(month).trim() : '';
  const yearStr = year ? String(year).trim() : '';
  
  console.log('🔍 DOB Validation - After trim:', { dayStr, monthStr, yearStr });
  console.log('🔍 DOB Validation - Lengths:', { 
    day: dayStr.length, 
    month: monthStr.length, 
    year: yearStr.length 
  });
  
  // Check if all fields have values after trimming
  if (!dayStr || !monthStr || !yearStr) {
    console.log('❌ DOB Validation - Incomplete (empty string)');
    return { valid: false, formatted: null, error: 'Date of Birth is incomplete' };
  }
  
  // Check if all digits are filled (DD/MM/YYYY = 8 digits)
  if (dayStr.length !== 2 || monthStr.length !== 2 || yearStr.length !== 4) {
    console.log('❌ DOB Validation - Wrong format');
    return { valid: false, formatted: null, error: 'Date of Birth must be in DD/MM/YYYY format' };
  }
  
  // Parse to numbers
  const dayNum = parseInt(dayStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const yearNum = parseInt(yearStr, 10);
  
  // Check ranges
  if (dayNum < 1 || dayNum > 31) {
    return { valid: false, formatted: null, error: 'Day must be between 01 and 31' };
  }
  
  if (monthNum < 1 || monthNum > 12) {
    return { valid: false, formatted: null, error: 'Month must be between 01 and 12' };
  }
  
  if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
    return { valid: false, formatted: null, error: 'Year must be between 1900 and current year' };
  }
  
  // Create Date object (month is 0-indexed in JS)
  const date = new Date(yearNum, monthNum - 1, dayNum);
  
  // Verify the date is valid (checks for things like Feb 31st)
  if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
    return { valid: false, formatted: null, error: 'Date of Birth is not a valid date (e.g., February 31st doesn\'t exist)' };
  }
  
  // Check if date is in the future
  if (date > new Date()) {
    return { valid: false, formatted: null, error: 'Date of Birth cannot be in the future' };
  }
  
  // Format as DD-MM-YYYY
  const formatted = `${dayStr}-${monthStr}-${yearStr}`;
  
  console.log('✅ DOB Validation - Valid date:', formatted);
  return { valid: true, formatted: formatted, error: null };
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
        
      case 'client-data':
        // Handle client data sent from parent
        handleClientData(message);
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

/**
 * Handle client data from parent
 * Populates form with known client information
 * 
 * Expected structure:
 * {
 *   type: 'client-data',
 *   user: 'staff@domain.com',
 *   data: {
 *     _id, idI[], idD[], cD{}, mD, r, wT, c, b, s, i{}, cI{}
 *   }
 * }
 */
function handleClientData(message) {
  const data = message.data || message;
  
  console.log('📥 Received client data from parent:', data);
  
  // Store user from message
  if (message.user) {
    requestData.user = message.user;
  }
  
  // Store data globally
  requestData = { ...requestData, ...data };
  
  // === HEADER INFO ===
  const headerData = {
    title: data.cD?.fe || '',
    clientName: data.cD?.n || '',
    matterNumber: `${data.cD?.cN || ''}-${data.cD?.mN || ''}`.replace(/^-|-$/g, ''), // Remove leading/trailing dashes if either is missing
    hasAddressID: data.i?.a || false,
    hasPhotoID: data.i?.p || false,
    likenessConfirmed: !data.i?.l // NOTE: i.l is "likenessNOTConfirmed", so invert it
  };
  updateHeaderInfo(headerData);
  
  // === MATTER DETAILS ===
  if (data.wT) {
    const worktypeInput = document.getElementById('worktype');
    if (worktypeInput) worktypeInput.value = data.wT;
  }
  
  if (data.r) {
    const relationInput = document.getElementById('relation');
    if (relationInput) relationInput.value = data.r;
  }
  
  if (data.mD) {
    const matterDescInput = document.getElementById('matterDescription');
    if (matterDescInput) matterDescInput.value = data.mD;
  }
  
  if (data.c) {
    const charityCheckbox = document.getElementById('charityCheckbox');
    if (charityCheckbox) charityCheckbox.checked = true;
  }
  
  if (data.b) {
    const businessCheckbox = document.getElementById('businessCheckbox');
    if (businessCheckbox) businessCheckbox.checked = true;
  }
  
  // === CLIENT DETAILS ===
  if (data.cI?.n) {
    const titlePrefix = document.getElementById('titlePrefix');
    const firstName = document.getElementById('firstName');
    const middleName = document.getElementById('middleName');
    const lastName = document.getElementById('lastName');
    
    if (titlePrefix && data.cI.n.t) titlePrefix.value = data.cI.n.t;
    if (firstName && data.cI.n.f) firstName.value = data.cI.n.f;
    if (middleName && data.cI.n.m) middleName.value = data.cI.n.m;
    if (lastName && data.cI.n.l) lastName.value = data.cI.n.l;
  }
  
  // Date of Birth - format: DDMMYYYY
  if (data.cI?.b) {
    const dob = data.cI.b.replace(/\D/g, ''); // Remove non-digits
    if (dob.length === 8) {
      for (let i = 0; i < 8; i++) {
        const dobInput = document.getElementById(`dob${i + 1}`);
        if (dobInput) dobInput.value = dob[i];
      }
    }
  }
  
  // Recent Name Change
  if (data.cI?.nC) {
    const recentNameChange = document.getElementById('recentNameChange');
    const nameChangeFields = document.getElementById('nameChangeFields');
    if (recentNameChange) {
      recentNameChange.checked = true;
      if (nameChangeFields) nameChangeFields.classList.remove('hidden');
    }
    
    if (data.cI.pN) {
      const previousName = document.getElementById('previousName');
      if (previousName) previousName.value = data.cI.pN;
    }
    
    if (data.cI.rNC) {
      const reasonForNameChange = document.getElementById('reasonForNameChange');
      if (reasonForNameChange) reasonForNameChange.value = data.cI.rNC;
    }
  }
  
  // === BUSINESS/CHARITY DETAILS ===
  if (data.cI?.n?.b) {
    const businessName = document.getElementById('businessName');
    if (businessName) businessName.value = data.cI.n.b;
  }
  
  if (data.cI?.eN) {
    const entityNumber = document.getElementById('entityNumber');
    if (entityNumber) {
      entityNumber.value = data.cI.eN;
    }
  }
  
  if (data.cI?.bD) {
    // Store business data globally
    businessData = data.cI.bD;
    updateCompanyButtons();
    
    // For charities, extract organisation_number from businessData (used only for URLs, not saved to DB)
    const entityNumber = document.getElementById('entityNumber');
    const isCharity = document.getElementById('charityCheckbox')?.checked || false;
    if (isCharity && businessData?.organisation_number && entityNumber) {
      entityNumber.dataset.organisationNumber = businessData.organisation_number;
      console.log(`🏷️ Extracted organisation_number from businessData for URLs: ${businessData.organisation_number}`);
    }
    
    // Populate people cards with officers and PSCs
    populatePeopleCards(data.cI.bD);
  }
  
  // === CONTACT DETAILS ===
  // Mobile number - validate and format using google-libphonenumber
  if (data.cI?.m) {
    const mobileStr = data.cI.m.toString().trim();
    const formattedPhone = parseAndFormatPhoneNumber(mobileStr);
    
    if (formattedPhone) {
      const phoneCountryCode = document.getElementById('phoneCountryCode');
      const phoneNumber = document.getElementById('phoneNumber');
      
      if (phoneCountryCode) setPhoneCode('phoneCountryCode', formattedPhone.countryCode);
      if (phoneNumber) phoneNumber.value = formattedPhone.nationalNumber;
      
      console.log(`📞 Formatted phone: ${mobileStr} → ${formattedPhone.countryCode} ${formattedPhone.nationalNumber}`);
    } else {
      // Fallback to basic parsing if libphonenumber fails
      const phoneNumber = document.getElementById('phoneNumber');
      if (phoneNumber) phoneNumber.value = mobileStr;
      console.warn(`⚠️ Could not format phone number: ${mobileStr}`);
    }
  }
  
  if (data.cI?.e) {
    const email = document.getElementById('email');
    if (email) email.value = data.cI.e;
  }
  
  // Current Address (Thirdfort format object)
  if (data.cI?.a) {
    currentAddressObject = data.cI.a;
    const currentAddress = document.getElementById('currentAddress');
    const currentCountry = document.getElementById('currentCountry');
    
    if (currentAddress && currentAddressObject) {
      // Set country
      if (currentCountry && currentAddressObject.country) {
        setCountry('currentCountry', currentAddressObject.country);
      }
      
      // Check if address object is properly formatted
      const isValidAddress = validateThirdfortAddress(currentAddressObject);
      
      if (isValidAddress) {
        // Valid address - just display it
        currentAddress.value = formatAddressForDisplay(currentAddressObject);
        console.log('✅ Current address is valid, displaying without API call');
      } else {
        // Invalid/incomplete address - try to search for it via API
        console.warn('⚠️ Current address object is incomplete, attempting to search via API');
        const searchTerm = formatAddressForDisplay(currentAddressObject);
        if (searchTerm && searchTerm.length >= 7) {
          currentAddress.value = searchTerm;
          // Trigger API search to get proper address
          window.parent.postMessage({
            type: 'address-search',
            searchTerm: searchTerm,
            field: 'current'
          }, '*');
        } else {
          currentAddress.value = searchTerm || '';
        }
      }
    }
  }
  
  // Previous Address & Recent Move
  if (data.cI?.rM) {
    const recentMove = document.getElementById('recentMove');
    const previousAddressFields = document.getElementById('previousAddressFields');
    if (recentMove) {
      recentMove.checked = true;
      if (previousAddressFields) previousAddressFields.classList.remove('hidden');
    }
    
    if (data.cI.pA) {
      previousAddressObject = data.cI.pA;
      const previousAddress = document.getElementById('previousAddress');
      const previousCountry = document.getElementById('previousCountry');
      
      if (previousAddress && previousAddressObject) {
        // Set country
        if (previousCountry && previousAddressObject.country) {
          setCountry('previousCountry', previousAddressObject.country);
        }
        
        // Check if address object is properly formatted
        const isValidAddress = validateThirdfortAddress(previousAddressObject);
        
        if (isValidAddress) {
          // Valid address - just display it
          previousAddress.value = formatAddressForDisplay(previousAddressObject);
          console.log('✅ Previous address is valid, displaying without API call');
        } else {
          // Invalid/incomplete address - try to search for it via API
          console.warn('⚠️ Previous address object is incomplete, attempting to search via API');
          const searchTerm = formatAddressForDisplay(previousAddressObject);
          if (searchTerm && searchTerm.length >= 7) {
            previousAddress.value = searchTerm;
            // Trigger API search to get proper address
            window.parent.postMessage({
              type: 'address-search',
              searchTerm: searchTerm,
              field: 'previous'
            }, '*');
          } else {
            previousAddress.value = searchTerm || '';
          }
        }
      }
    }
  }
  
  // === ID IMAGES ===
  if (data.idI && Array.isArray(data.idI) && data.idI.length > 0) {
    idImages = data.idI;
    
    // Clear existing carousel
    const carousel = document.getElementById('idImagesCarousel');
    if (carousel) {
      carousel.innerHTML = '';
      
      // Add each image to carousel
      data.idI.forEach((image, index) => {
        addIDImageToCarousel({
          id: image._id || image.s3Key || index,
          url: image.liveUrl || image.url, // Use liveUrl if available, fallback to url
          document: image.document || 'ID Document',
          side: image.side || '',
          uploader: image.uploader || message.user || 'Unknown',
          date: image.date || new Date().toISOString(),
          uploadInfo: image.uploadInfo,
          type: image.type
        });
      });
      
      updateCarouselNavigation();
    }
    
    // Update Form J validation flags based on images
    updateFormJFlags(data.idI, data.i);
  }
  
  // === ID DOCUMENTS ===
  if (data.idD && Array.isArray(data.idD)) {
    idDocuments = data.idD;
  }
  
  // Update ID Documents UI (cards and hints)
  updateIDDocumentsUI(data);
  
  // Show appropriate section: Client Details OR Business/Charity Details
  updateClientOrBusinessSection();
  
  console.log('✅ Client data loaded and form populated');
  console.log('📊 Form J Flags - Sufficient Photos:', formJSufficientPhotos, '| Conditions Met:', formJConditionsMet);
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

/**
 * Reset form UI to default state
 * This function hides all sections and hints but preserves:
 * - Header text and icons (client info)
 * - All input values across all sections (EXCEPT message input in some cases)
 * Called when changing request types or deselecting
 * 
 * @param {string|null} previousType - The previous request type (if any)
 * @param {string|null} newType - The new request type (if any)
 */
function resetFormUI(previousType = null, newType = null) {
  // Define message-based request types (note, update, updatePep)
  const messageTypes = ['note', 'update', 'updatePep'];
  
  // Determine if we should clear the message input
  // Clear message UNLESS switching between message-based types
  const previousIsMessage = previousType && messageTypes.includes(previousType);
  const newIsMessage = newType && messageTypes.includes(newType);
  const shouldClearMessage = !(previousIsMessage && newIsMessage);
  
  // Clear message input if switching between different categories
  if (shouldClearMessage) {
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    if (messageInput) {
      messageInput.value = '';
    }
    if (fileInput) {
      fileInput.value = '';
    }
    console.log('🗑️ Message input cleared (switching between different request categories)');
  } else {
    console.log('📝 Message input preserved (switching between message-based types)');
  }
  
  // Hide request-type-controlled sections only
  const sectionsToHide = [
    'idDocumentsSection',
    'idImagesSection'
    // NOTE: clientDetailsSection and businessCharitySection are controlled by checkbox state, not request type
  ];
  
  sectionsToHide.forEach(sectionId => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.add('hidden');
    }
  });
  
  // Hide all request type hints
  const hintsToHide = [
    'k3Hint',
    'ejHint',
    'eSoFHint',
    'eSoFSkipHint',
    'eSoFOnlyHint',
    'nameVerificationHint',
    'cdfPeopleHint',
    'cdfEntityHint',
    'entityLinkedHint',
    'ofsiHint'
  ];
  
  hintsToHide.forEach(hintId => {
    const hint = document.getElementById(hintId);
    if (hint) {
      hint.classList.add('hidden');
    }
  });
  
  // Hide document cards
  const cardsToHide = [
    'cdfDocumentCard',
    'ofsiDocumentCard'
  ];
  
  cardsToHide.forEach(cardId => {
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.add('hidden');
    }
  });
  
  // Hide Form K dropdown
  const formKSelector = document.getElementById('formKruleSelector');
  if (formKSelector) {
    formKSelector.classList.add('hidden');
  }
  
  // Disable submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
  }
  
  console.log('✅ Form UI reset to default state (preserving input values and header)');
}

function updateHeaderInfo(data) {
  // Update client info display if elements exist
  const clientNameEl = document.getElementById('clientName');
  const clientMatterEl = document.getElementById('clientMatterNumber');
  const titleBadgeEl = document.getElementById('titleBadge');
  const addressIcon = document.getElementById('addressIcon');
  const photoIcon = document.getElementById('photoIcon');
  const liknessIcon = document.getElementById('liknessIcon');
  
  if (data.clientName && clientNameEl) {
    clientNameEl.textContent = data.clientName;
  }
  
  if (data.matterNumber && clientMatterEl) {
    clientMatterEl.textContent = data.matterNumber;
  }
  
  if (data.title && titleBadgeEl) {
    titleBadgeEl.querySelector('span').textContent = data.title;
  }
  
  // Show/hide icons based on data
  if (addressIcon) {
    if (data.hasAddressID) {
      addressIcon.classList.remove('hidden');
    } else {
      addressIcon.classList.add('hidden');
    }
  }
  
  if (photoIcon) {
    if (data.hasPhotoID) {
      photoIcon.classList.remove('hidden');
    } else {
      photoIcon.classList.add('hidden');
    }
  }
  
  // Likeness icon ONLY shows when:
  // - Has Photo ID (data.i.p === true)
  // - AND Likeness is confirmed (data.i.l === false or undefined)
  if (liknessIcon) {
    if (data.hasPhotoID && data.likenessConfirmed) {
      liknessIcon.classList.remove('hidden');
    } else {
      liknessIcon.classList.add('hidden');
    }
  }
}

// Utility functions
function sendMessageToParent(message) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

function showError(message, title = 'Error') {
  // Update error title if it exists
  const errorHeader = document.querySelector('.error-popup-header');
  if (errorHeader) {
    errorHeader.textContent = title;
  }
  
  // Update error message
  if (elements.errorMessage) {
    // Preserve line breaks by using white-space: pre-wrap
    elements.errorMessage.style.whiteSpace = 'pre-wrap';
    elements.errorMessage.textContent = message;
  }
  
  // Show error popup
  if (elements.errorPopup) {
    elements.errorPopup.classList.remove('hidden');
  }
  
  // Auto-hide after 10 seconds (longer for validation errors with multiple lines)
  setTimeout(hideError, 10000);
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
    
    // Get document type from dropdown
    const cdfDocumentType = document.getElementById('cdfDocumentType');
    if (!cdfDocumentType || !cdfDocumentType.value) {
      showError('Please select a document type before uploading');
      resetCDFUploadArea();
      return;
    }
    
    // Create document object
    const docObject = {
      document: cdfDocumentType.options[cdfDocumentType.selectedIndex].text,
      data: {
        type: file.type,
        size: file.size,
        name: file.name,
        lastModified: file.lastModified
      },
      date: new Date().toLocaleString('en-GB'),
      uploader: requestData.user || 'Unknown',
      file: file,
      type: 'Details form',
      s3Key: null, // Will be set after upload to S3
      liveUrl: null // Will be set after upload to S3
    };
    
    // Add to idDocuments array
    idDocuments.push(docObject);
    
    // Update UI to show success
    updateCDFUploadAreaWithFile(file);
    
    // Re-evaluate ID Documents UI
    updateIDDocumentsUI(requestData);
    
    console.log('✅ CDF document added:', docObject);
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
    
    // Create OFSI document object
    const docObject = {
      document: 'OFSI Sanctions Search',
      data: {
        type: file.type,
        size: file.size,
        name: file.name,
        lastModified: file.lastModified
      },
      date: new Date().toLocaleString('en-GB'),
      uploader: requestData.user || 'Unknown',
      file: file,
      type: 'PEP & Sanctions Check',
      s3Key: null, // Will be set after upload to S3
      liveUrl: null // Will be set after upload to S3
    };
    
    // Add to idDocuments array
    idDocuments.push(docObject);
    
    // Update UI to show success
    updateOFSIUploadAreaWithFile(file);
    
    // Re-evaluate ID Documents UI
    updateIDDocumentsUI(requestData);
    
    console.log('✅ OFSI document added:', docObject);
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
      if (searchTerm.length < 2 || (registrationCountry && registrationCountry.dataset.jurisdictionCode !== 'GB')) {
        businessNameDropdown.classList.add('hidden');
        businessNameDropdown.innerHTML = '';
        return;
      }
      
      // Show loading
      businessNameDropdown.classList.remove('hidden');
      businessNameDropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
      
      // Debounce 300ms
      companyNameDebounceTimer = setTimeout(() => {
        const isCharity = document.getElementById('charityCheckbox')?.checked || false;
        const searchType = isCharity ? 'charity-search' : 'company-search';
        console.log(`📡 API call for ${isCharity ? 'charity' : 'company'} search:`, searchTerm);
        
        window.parent.postMessage({
          type: searchType,
          searchTerm: searchTerm,
          searchBy: 'name'
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
      if (searchTerm.length < 2 || (registrationCountry && registrationCountry.dataset.jurisdictionCode !== 'GB')) {
        entityNumberDropdown.classList.add('hidden');
        entityNumberDropdown.innerHTML = '';
        return;
      }
      
      // Show loading
      entityNumberDropdown.classList.remove('hidden');
      entityNumberDropdown.innerHTML = '<div class="address-loading">Searching companies...</div>';
      
      // Debounce 300ms
      companyNumberDebounceTimer = setTimeout(() => {
        const isCharity = document.getElementById('charityCheckbox')?.checked || false;
        const searchType = isCharity ? 'charity-search' : 'company-search';
        console.log(`📡 API call for ${isCharity ? 'charity' : 'company'} number search:`, searchTerm);
        
        window.parent.postMessage({
          type: searchType,
          searchTerm: searchTerm,
          searchBy: 'number'
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
  
  // Handle business/charity checkbox changes - update ID Documents UI and section visibility
  const businessCheckbox = document.getElementById('businessCheckbox');
  const charityCheckbox = document.getElementById('charityCheckbox');
  
  if (businessCheckbox) {
    businessCheckbox.addEventListener('change', function() {
      // Update requestData
      requestData.b = this.checked;
      // Show/hide appropriate section
      updateClientOrBusinessSection();
      // Re-evaluate ID Documents UI
      updateIDDocumentsUI(requestData);
    });
  }
  
  if (charityCheckbox) {
    charityCheckbox.addEventListener('change', function() {
      // Update requestData
      requestData.c = this.checked;
      // Show/hide appropriate section
      updateClientOrBusinessSection();
      // Re-evaluate ID Documents UI
      updateIDDocumentsUI(requestData);
    });
  }
  
  // Handle company link and refresh buttons
  const companyLinkBtn = document.getElementById('companyLinkBtn');
  const companyRefreshBtn = document.getElementById('companyRefreshBtn');
  
  if (companyLinkBtn) {
    companyLinkBtn.addEventListener('click', function(e) {
      e.preventDefault();
      openCompanyRegisterPage();
    });
  }
  
  if (companyRefreshBtn) {
    companyRefreshBtn.addEventListener('click', function(e) {
      e.preventDefault();
      refreshCompanyData();
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
  const country = field === 'current' ? (currentCountry?.dataset.countryCode || 'GBR') : (previousCountry?.dataset.countryCode || 'GBR');
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
  
  // Store in requestData
  if (!requestData.cI) requestData.cI = {};
  requestData.cI.bD = data;
  
  // For charities, extract organisation_number from data (used only for URLs, not saved to DB)
  const entityNumberEl = document.getElementById('entityNumber');
  const isCharity = document.getElementById('charityCheckbox')?.checked || false;
  
  if (isCharity && data.organisation_number && entityNumberEl) {
    entityNumberEl.dataset.organisationNumber = data.organisation_number;
    console.log(`🏷️ Stored organisation_number for URLs: ${data.organisation_number} (display: ${data.reg_charity_number || data.company_number})`);
  }
  
  // Update company buttons visibility if they exist
  updateCompanyButtons();
  
  // Auto-populate registered office address if no current address exists
  if (businessData && businessData.registered_office_address) {
    autoPopulateRegisteredAddress();
  }
  
  // Re-evaluate ID Documents UI (may affect entity linked hint)
  updateIDDocumentsUI(requestData);
  
  // Populate people cards with officers and PSCs
  if (businessData) {
    populatePeopleCards(businessData);
  }
}

/**
 * Populate people cards in Business/Charity section
 * Shows officers, directors, trustees, and PSCs
 * Merges duplicates by normalized name (handles variations like "SMITH, John" vs "Mr John Smith")
 */
function populatePeopleCards(companyData) {
  const peopleRepeater = document.getElementById('peopleRepeater');
  if (!peopleRepeater || !companyData) return;
  
  peopleRepeater.innerHTML = '';
  
  // Use a map to merge duplicates by normalized name
  const peopleMap = new Map();
  
  /*
  Normalize name for matching (remove titles, punctuation, sort words alphabetically)
  Handles variations like "HODIVALA, Olly" vs "Mr Olly Hodivala"
  */
  function normalizeName(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/^(mr|mrs|ms|miss|dr|rev|sir|lord|dame|prof|professor)\s+/i, '') // Remove titles
      .replace(/[,\.]/g, '') // Remove punctuation
      .split(/\s+/) // Split into words
      .filter(w => w) // Remove empty strings
      .sort() // Sort alphabetically
      .join(' ') // Join back
      .trim();
  }
  
  // Extract Officers, Directors, and Trustees
  if (companyData.officers && Array.isArray(companyData.officers)) {
    companyData.officers.forEach(officer => {
      // Skip resigned officers
      if (officer.resigned_on) return;
      
      const normalizedName = normalizeName(officer.name);
      const existing = peopleMap.get(normalizedName);
      
      // Determine role type
      let roleType;
      if (officer.officer_role === 'director') roleType = 'director';
      else if (officer.officer_role === 'trustee') roleType = 'trustee';
      else roleType = 'officer';
      
      if (existing) {
        // Add role if not already present
        if (!existing.types.includes(roleType)) {
          existing.types.push(roleType);
        }
        // Store officer link if not already set
        if (!existing.appointmentsUrl && officer.links?.officer?.appointments) {
          existing.appointmentsUrl = officer.links.officer.appointments;
        }
      } else {
        peopleMap.set(normalizedName, {
          displayName: officer.name,
          types: [roleType],
          share: null,
          appointmentsUrl: officer.links?.officer?.appointments || null
        });
      }
    });
  }
  
  // Extract PSCs (with ownership info)
  if (companyData.pscs && Array.isArray(companyData.pscs)) {
    companyData.pscs.forEach(psc => {
      // Skip ceased PSCs
      if (psc.ceased) return;
      
      const normalizedName = normalizeName(psc.name);
      const existing = peopleMap.get(normalizedName);
      
      // Extract ownership percentage from natures_of_control
      let shareInfo = null;
      if (psc.natures_of_control && Array.isArray(psc.natures_of_control)) {
        const control = psc.natures_of_control[0];
        if (control.includes('25-to-50')) shareInfo = '25-50%';
        else if (control.includes('50-to-75')) shareInfo = '50-75%';
        else if (control.includes('75-to-100')) shareInfo = '75-100%';
        else if (control.includes('ownership-of-shares')) shareInfo = 'Significant';
      }
      
      if (existing) {
        // Add PSC role and share info
        if (!existing.types.includes('psc')) {
          existing.types.push('psc');
        }
        existing.share = shareInfo;
        // Store PSC link if not already set
        if (!existing.appointmentsUrl && psc.links?.officer?.appointments) {
          existing.appointmentsUrl = psc.links.officer.appointments;
        }
      } else {
        peopleMap.set(normalizedName, {
          displayName: psc.name,
          types: ['psc'],
          share: shareInfo,
          appointmentsUrl: psc.links?.officer?.appointments || null
        });
      }
    });
  }
  
  const allPeople = Array.from(peopleMap.values());
  
  // Create cards
  if (allPeople.length === 0) {
    peopleRepeater.innerHTML = '<div class="no-people-message">No active officers or PSCs found</div>';
    return;
  }
  
  allPeople.forEach(person => {
    const card = document.createElement('div');
    card.className = 'people-card';
    
    // Make card clickable
    // Companies: Click opens individual officer appointments page
    // Charities: Click opens charity trustees tab
    const isCharity = document.getElementById('charityCheckbox')?.checked || false;
    
    if (person.appointmentsUrl || isCharity) {
      card.style.cursor = 'pointer';
      card.title = isCharity
        ? 'Click to view all trustees'
        : 'Click to view all appointments';
      
      card.addEventListener('click', () => {
        openOfficerAppointments(person.appointmentsUrl);
      });
    }
    
    // Create badges for all roles
    let badgesHtml = '';
    person.types.forEach(type => {
      const badgeClass = type === 'director' ? 'badge-director' : 
                        type === 'trustee' ? 'badge-trustee' :
                        type === 'psc' ? 'badge-psc' : 'badge-officer';
      const badgeText = type === 'director' ? 'Director' : 
                       type === 'trustee' ? 'Trustee' :
                       type === 'psc' ? 'PSC' : 'Officer';
      badgesHtml += `<span class="people-card-badge ${badgeClass}">${badgeText}</span>`;
    });
    
    let html = `
      <div class="people-card-header">
        <div class="people-card-name">${person.displayName}</div>
        <div style="display: flex; gap: 4px;">${badgesHtml}</div>
      </div>
    `;
    
    if (person.share) {
      html += `<div class="people-card-share">📊 ${person.share}</div>`;
    }
    
    card.innerHTML = html;
    peopleRepeater.appendChild(card);
  });
  
  console.log(`✅ Populated ${allPeople.length} people cards (merged duplicates)`);
}

/*
Open officer appointments page in Companies House (or charity page for trustees)
*/
function openOfficerAppointments(appointmentsPath) {
  if (!appointmentsPath) {
    // Charity trustees don't have individual pages, open charity trustees tab instead
    const entityNumberEl = document.getElementById('entityNumber');
    const isCharity = document.getElementById('charityCheckbox')?.checked || false;
    
    if (isCharity && entityNumberEl?.value?.trim()) {
      // Use organisation_number for URL (not reg_charity_number)
      const orgNum = entityNumberEl.dataset.organisationNumber || entityNumberEl.value.trim();
      const url = `https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/${orgNum}/trustees`;
      
      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
      
      window.open(url, 'charityTrustees', features);
      console.log('👤 Opening charity trustees tab:', url);
    }
    return;
  }
  
  const url = `https://find-and-update.company-information.service.gov.uk${appointmentsPath}`;
  
  // Open in centered popup window
  const width = 1000;
  const height = 800;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;
  const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
  
  window.open(url, 'officerAppointments', features);
  console.log('👤 Opening officer appointments:', url);
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
Open Companies House or Charity Register page for the linked entity
*/
function openCompanyRegisterPage() {
  const entityNumber = document.getElementById('entityNumber');
  const charityCheckbox = document.getElementById('charityCheckbox');
  
  if (!entityNumber?.value?.trim()) {
    console.warn('No entity number to open');
    return;
  }
  
  const entityNum = entityNumber.value.trim();
  const isCharity = charityCheckbox?.checked || requestData.c;
  let url;
  
  if (isCharity) {
    url = `https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/${entityNum}`;
  } else {
    url = `https://find-and-update.company-information.service.gov.uk/company/${entityNum}`;
  }
  
  // Open in centered popup window
  const width = 1000;
  const height = 800;
  const left = (screen.width - width) / 2;
  const top = (screen.height - height) / 2;
  const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
  
  const popup = window.open(url, isCharity ? 'charityRegister' : 'companiesHouse', features);
  
  if (popup) {
    popup.focus();
    console.log(`🔗 Opened ${isCharity ? 'Charity Register' : 'Companies House'} for: ${entityNum}`);
  } else {
    console.error('Failed to open popup - please allow popups for this site');
  }
}

/*
Refresh company data from Companies House or Charity Register
*/
function refreshCompanyData() {
  const entityNumber = document.getElementById('entityNumber');
  const charityCheckbox = document.getElementById('charityCheckbox');
  
  if (!entityNumber?.value?.trim()) {
    console.warn('No entity number to refresh');
    return;
  }
  
  const companyNumber = entityNumber.value.trim();
  const isCharity = charityCheckbox?.checked || requestData.c;
  const apiType = isCharity ? 'charity-lookup' : 'company-lookup';
  const entityTypeStr = isCharity ? 'charity' : 'business';
  
  console.log(`🔄 Refreshing ${entityTypeStr} data for:`, companyNumber);
  
  window.parent.postMessage({
    type: apiType,
    companyNumber: companyNumber,
    entityType: entityTypeStr
  }, '*');
}

/*
Auto-populate registered office address if no current address exists
*/
function autoPopulateRegisteredAddress() {
  if (!businessData || !businessData.registered_office_address) return;
  
  const currentAddress = document.getElementById('currentAddress');
  const currentCountry = document.getElementById('currentCountry');
  
  if (!currentAddress) return;
  
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
  
  // Check if new address is different from current (skip if identical)
  const currentAddressText = currentAddress?.value?.trim() || '';
  const isDifferentAddress = currentAddressText !== addressString;
  
  if (addressString && isDifferentAddress) {
    console.log('📍 Auto-populating registered office address:', addressString);
    
    // Set UK as country
    if (currentCountry) {
      setCountry('currentCountry', 'GBR');
    }
    
    // Populate the autocomplete field
    currentAddress.value = addressString;
    
    // Trigger address search to find exact match in getaddress.io
    if (addressString.length >= 7) {
      console.log('📡 Searching for registered office address in getaddress.io');
      window.parent.postMessage({
        type: 'address-search',
        searchTerm: addressString,
        field: 'current'
      }, '*');
    }
  } else if (!isDifferentAddress && addressString) {
    console.log('ℹ️ Registered office address is identical to current address, keeping existing');
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

/**
 * Update Form J validation flags based on ID images
 */
function updateFormJFlags(images, iconData) {
  if (!images || !Array.isArray(images)) {
    formJSufficientPhotos = false;
    formJConditionsMet = false;
    return;
  }
  
  // Count Address ID and Photo ID images
  const addressIDs = images.filter(img => img.type === 'Address ID');
  const photoIDs = images.filter(img => img.type === 'PhotoID');
  
  // Check if we have sufficient photos
  const hasTwoAddressIDs = addressIDs.length >= 2;
  
  // Check Photo ID conditions:
  // Either: 1 Photo ID with side undefined/single
  // Or: 2 Photo IDs with one front and one back
  let hasValidPhotoIDs = false;
  
  if (photoIDs.length === 1) {
    const side = photoIDs[0].side?.toLowerCase();
    hasValidPhotoIDs = !side || side === 'single' || side === '';
  } else if (photoIDs.length >= 2) {
    const hasFront = photoIDs.some(img => img.side?.toLowerCase() === 'front');
    const hasBack = photoIDs.some(img => img.side?.toLowerCase() === 'back');
    hasValidPhotoIDs = hasFront && hasBack;
  }
  
  formJSufficientPhotos = hasTwoAddressIDs && hasValidPhotoIDs;
  
  // Check if conditions are met from icon data
  // data.i.p = has photo ID taken
  // data.i.a = has address ID taken
  // data.i.l = likeness NOT confirmed (so we want this to be false/undefined)
  formJConditionsMet = !!(iconData?.p && iconData?.a && !iconData?.l);
  
  console.log('📊 Form J Flags Updated:');
  console.log('  - Sufficient Photos:', formJSufficientPhotos);
  console.log('    - Address IDs:', addressIDs.length, '(need 2)');
  console.log('    - Photo IDs valid:', hasValidPhotoIDs);
  console.log('  - Conditions Met:', formJConditionsMet);
  console.log('    - Has Photo ID:', iconData?.p);
  console.log('    - Has Address ID:', iconData?.a);
  console.log('    - Likeness Confirmed:', !iconData?.l);
}

/**
 * Update Client Details or Business/Charity Details section visibility
 * Based on business/charity checkbox state
 * Also enables/disables request type tags that are not valid for entities
 */
function updateClientOrBusinessSection() {
  const businessCheckbox = document.getElementById('businessCheckbox');
  const charityCheckbox = document.getElementById('charityCheckbox');
  const clientDetailsSection = document.getElementById('clientDetailsSection');
  const businessCharitySection = document.getElementById('businessCharitySection');
  
  const isBusiness = businessCheckbox?.checked || requestData.b;
  const isCharity = charityCheckbox?.checked || requestData.c;
  const isEntity = isBusiness || isCharity;
  
  // Request types not valid for businesses/charities
  const entityInvalidTypes = ['formJ', 'formE', 'esof'];
  
  if (isEntity) {
    // Show Business/Charity section, hide Client Details
    if (businessCharitySection) businessCharitySection.classList.remove('hidden');
    if (clientDetailsSection) clientDetailsSection.classList.add('hidden');
    
    // Disable request types not valid for entities
    let deselectedType = null;
    
    entityInvalidTypes.forEach(type => {
      const tag = document.querySelector(`[data-type="${type}"]`);
      if (tag) {
        tag.disabled = true;
        tag.style.opacity = '0.5';
        tag.style.cursor = 'not-allowed';
        tag.title = 'Not available for businesses/charities';
        
        // If this type is currently selected, deselect it
        if (tag.classList.contains('selected')) {
          deselectedType = type; // Track which type was deselected
          tag.classList.remove('selected');
          if (currentRequestType === type) {
            previousRequestType = currentRequestType;
            currentRequestType = null;
            elements.dynamicContentContainer.innerHTML = '';
            resetFormUI(previousRequestType, null);
          }
        }
      }
    });
    
    // Show error if a request type was deselected
    if (deselectedType) {
      const typeNames = {
        'formJ': 'Form J',
        'formE': 'Form E',
        'esof': 'eSoF'
      };
      const typeName = typeNames[deselectedType] || deselectedType;
      const entityType = isCharity ? 'Charities' : 'Businesses';
      
      showError(`${typeName} is not available for ${entityType}`, 'Request Type Not Available');
    }
    
    console.log('👔 Showing Business/Charity Details section | Disabled: Form J, Form E, eSoF');
  } else {
    // Show Client Details section, hide Business/Charity
    if (clientDetailsSection) clientDetailsSection.classList.remove('hidden');
    if (businessCharitySection) businessCharitySection.classList.add('hidden');
    
    // Enable all request types for individuals
    entityInvalidTypes.forEach(type => {
      const tag = document.querySelector(`[data-type="${type}"]`);
      if (tag) {
        tag.disabled = false;
        tag.style.opacity = '';
        tag.style.cursor = '';
        tag.title = '';
      }
    });
    
    console.log('👤 Showing Client Details section | All request types available');
  }
}

/**
 * Update ID Documents UI (cards and hints)
 * Handles OFSI and CDF columns based on uploaded documents and entity type
 */
function updateIDDocumentsUI(data) {
  // === OFSI COLUMN (Right) ===
  const ofsiDocumentCard = document.getElementById('ofsiDocumentCard');
  const ofsiHint = document.getElementById('ofsiHint');
  
  // Look for OFSI document (type: "PEP & Sanctions Check")
  const ofsiDoc = idDocuments.find(doc => doc.type === 'PEP & Sanctions Check');
  
  if (ofsiDoc && ofsiDocumentCard && ofsiHint) {
    // Populate and show OFSI card
    const titleEl = ofsiDocumentCard.querySelector('.document-title');
    const uploadInfoEl = ofsiDocumentCard.querySelector('.document-upload-info');
    
    if (titleEl) titleEl.textContent = ofsiDoc.document || 'OFSI Screening';
    if (uploadInfoEl) {
      const uploadText = `Uploaded by ${ofsiDoc.uploader || 'Unknown'} ${ofsiDoc.date || ''}`;
      uploadInfoEl.textContent = uploadText;
    }
    
    ofsiDocumentCard.classList.remove('hidden');
    ofsiHint.classList.add('hidden');
  } else if (ofsiDocumentCard && ofsiHint) {
    // No OFSI document - show hint
    ofsiDocumentCard.classList.add('hidden');
    ofsiHint.classList.remove('hidden');
  }
  
  // === CDF COLUMN (Left) ===
  const cdfDocumentCard = document.getElementById('cdfDocumentCard');
  const cdfPeopleHint = document.getElementById('cdfPeopleHint');
  const cdfEntityHint = document.getElementById('cdfEntityHint');
  const entityLinkedHint = document.getElementById('entityLinkedHint');
  
  // Look for CDF document (type: "Details form")
  const cdfDoc = idDocuments.find(doc => doc.type === 'Details form');
  
  // Valid CDF document types from dropdown (case-insensitive check)
  const validCDFTypes = [
    'client details form',
    'beneficiary details form',
    'proof of address',
    'sra registration',
    'fca registration',
    'companies house printout',
    'charity register printout',
    'proof of address for partnerships',
    'proof of authority for commercial work'
  ];
  
  const cdfDocumentName = cdfDoc?.document?.toLowerCase() || '';
  
  if (cdfDoc && validCDFTypes.includes(cdfDocumentName) && cdfDocumentCard) {
    // Populate and show CDF card
    const titleEl = cdfDocumentCard.querySelector('.document-title');
    const uploadInfoEl = cdfDocumentCard.querySelector('.document-upload-info');
    
    if (titleEl) titleEl.textContent = cdfDoc.document || 'Client Details Form';
    if (uploadInfoEl) {
      const uploadText = `Uploaded by ${cdfDoc.uploader || 'Unknown'} ${cdfDoc.date || ''}`;
      uploadInfoEl.textContent = uploadText;
    }
    
    cdfDocumentCard.classList.remove('hidden');
    cdfPeopleHint.classList.add('hidden');
    cdfEntityHint.classList.add('hidden');
    entityLinkedHint.classList.add('hidden');
  } else {
    // No CDF document - show appropriate hint based on entity type
    if (cdfDocumentCard) cdfDocumentCard.classList.add('hidden');
    
    const isBusiness = data?.b === true;
    const isCharity = data?.c === true;
    const isEntity = isBusiness || isCharity;
    const hasLinkedData = !!(data?.cI?.bD);
    
    if (!isEntity) {
      // Individual - show people hint
      if (cdfPeopleHint) cdfPeopleHint.classList.remove('hidden');
      if (cdfEntityHint) cdfEntityHint.classList.add('hidden');
      if (entityLinkedHint) entityLinkedHint.classList.add('hidden');
    } else if (hasLinkedData) {
      // Entity with linked data - show entity linked hint
      if (cdfPeopleHint) cdfPeopleHint.classList.add('hidden');
      if (cdfEntityHint) cdfEntityHint.classList.add('hidden');
      if (entityLinkedHint) entityLinkedHint.classList.remove('hidden');
    } else {
      // Entity without linked data - show entity hint
      if (cdfPeopleHint) cdfPeopleHint.classList.add('hidden');
      if (cdfEntityHint) cdfEntityHint.classList.remove('hidden');
      if (entityLinkedHint) entityLinkedHint.classList.add('hidden');
    }
  }
  
  console.log('✅ ID Documents UI updated');
}

/**
 * Validate Thirdfort address object has required fields
 * UK: Requires town, postcode, country and one of (flat_number, building_number, building_name)
 * USA/CAN: Requires town, state, postcode, address_1, country
 * Other: Requires town, address_1, country
 */
function validateThirdfortAddress(addressObject) {
  if (!addressObject || typeof addressObject !== 'object') return false;
  
  const country = addressObject.country || 'GBR';
  
  // UK validation
  if (country === 'GBR') {
    const hasRequiredFields = addressObject.town && addressObject.postcode && addressObject.country;
    const hasOneBuilding = addressObject.flat_number || addressObject.building_number || addressObject.building_name;
    return hasRequiredFields && hasOneBuilding;
  }
  
  // USA/Canada validation
  if (country === 'USA' || country === 'CAN') {
    return !!(addressObject.town && addressObject.state && addressObject.postcode && addressObject.address_1 && addressObject.country);
  }
  
  // Default validation (other countries)
  return !!(addressObject.town && addressObject.address_1 && addressObject.country);
}

/**
 * Format Thirdfort address object for display in input field
 */
function formatAddressForDisplay(addressObject) {
  if (!addressObject) return '';
  
  const parts = [];
  
  // UK addresses have individual fields
  if (addressObject.country === 'GBR') {
    if (addressObject.flat_number) parts.push(addressObject.flat_number);
    if (addressObject.building_number) parts.push(addressObject.building_number);
    if (addressObject.building_name) parts.push(addressObject.building_name);
    if (addressObject.street) parts.push(addressObject.street);
    if (addressObject.sub_street) parts.push(addressObject.sub_street);
    if (addressObject.town) parts.push(addressObject.town);
    if (addressObject.postcode) parts.push(addressObject.postcode);
  } else {
    // Non-UK addresses use address_1, address_2
    if (addressObject.address_1) parts.push(addressObject.address_1);
    if (addressObject.address_2) parts.push(addressObject.address_2);
    if (addressObject.town) parts.push(addressObject.town);
    if (addressObject.state) parts.push(addressObject.state);
    if (addressObject.postcode) parts.push(addressObject.postcode);
  }
  
  return parts.filter(p => p && p.trim()).join(', ');
}

/**
 * Parse and format phone number using google-libphonenumber
 * Handles various formats:
 * - UK: 07700900123 → +44 7700900123
 * - International: +447700900123 → +44 7700900123
 * - Already formatted: +44 7700900123 → +44 7700900123
 * Returns: { countryCode: '+44', nationalNumber: '7700900123', e164: '+447700900123' } or null
 */
function parseAndFormatPhoneNumber(phoneString) {
  if (!phoneString || !phoneString.trim()) return null;
  
  // Check if libphonenumber is loaded
  if (typeof libphonenumber === 'undefined') {
    console.warn('⚠️ libphonenumber not loaded, using basic parsing');
    return basicPhoneParse(phoneString);
  }
  
  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const cleanPhone = phoneString.trim();
    let parsedNumber = null;
    
    // Try to parse with international format first
    if (cleanPhone.startsWith('+')) {
      try {
        parsedNumber = phoneUtil.parseAndKeepRawInput(cleanPhone, null);
      } catch (e) {
        console.warn('Failed to parse international number:', e.message);
      }
    }
    
    // If not international or parsing failed, try common regions
    if (!parsedNumber) {
      const commonRegions = ['GB', 'US', 'CA', 'AU', 'IE', 'FR', 'DE'];
      for (const region of commonRegions) {
        try {
          parsedNumber = phoneUtil.parseAndKeepRawInput(cleanPhone, region);
          if (phoneUtil.isValidNumber(parsedNumber)) {
            break;
          }
          parsedNumber = null;
        } catch (e) {
          // Try next region
          continue;
        }
      }
    }
    
    // If we have a parsed number, format it
    if (parsedNumber && phoneUtil.isValidNumber(parsedNumber)) {
      const countryCode = '+' + parsedNumber.getCountryCode();
      const nationalNumber = parsedNumber.getNationalNumber().toString();
      // Use integer 0 for E164 format (CDN doesn't expose enum)
      const e164 = phoneUtil.format(parsedNumber, 0);
      
      return {
        countryCode: countryCode,
        nationalNumber: nationalNumber,
        e164: e164
      };
    }
    
    // If all else fails, use basic parsing
    console.warn('⚠️ libphonenumber validation failed, using basic parsing');
    return basicPhoneParse(phoneString);
    
  } catch (error) {
    console.error('Error parsing phone number:', error);
    return basicPhoneParse(phoneString);
  }
}

/**
 * Basic phone parsing fallback (when libphonenumber fails or is not loaded)
 */
function basicPhoneParse(phoneString) {
  if (!phoneString || !phoneString.trim()) return null;
  
  const cleanPhone = phoneString.trim();
  
  // Already in international format
  if (cleanPhone.startsWith('+')) {
    const match = cleanPhone.match(/^(\+\d{1,3})(.+)$/);
    if (match) {
      return {
        countryCode: match[1],
        nationalNumber: match[2].replace(/\D/g, ''), // Remove non-digits
        e164: match[1] + match[2].replace(/\D/g, '')
      };
    }
  }
  
  // UK mobile format (07XXX)
  if (cleanPhone.match(/^0[7-9]\d{9}$/)) {
    return {
      countryCode: '+44',
      nationalNumber: cleanPhone.substring(1), // Remove leading 0
      e164: '+44' + cleanPhone.substring(1)
    };
  }
  
  // UK format with leading 0
  if (cleanPhone.startsWith('0')) {
    return {
      countryCode: '+44',
      nationalNumber: cleanPhone.substring(1),
      e164: '+44' + cleanPhone.substring(1)
    };
  }
  
  // Default: assume UK
  return {
    countryCode: '+44',
    nationalNumber: cleanPhone.replace(/\D/g, ''),
    e164: '+44' + cleanPhone.replace(/\D/g, '')
  };
}

// ID Images Carousel Functions
let currentCarouselIndex = 0;

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
  
  // Only show side tag for Front or Back, not for Single
  const sideTag = (imageData.side === 'Front' || imageData.side === 'Back') ? `<span class="side-tag">${imageData.side}</span>` : '';
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
    // Disable submit button temporarily during validation
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = true;
    
    // Validate the form before submission
    const validation = validateCurrentForm();
    
    if (!validation || !validation.valid) {
      // Re-enable submit button to allow retry
      if (submitBtn) submitBtn.disabled = false;
      
      // Show specific validation errors
      const errorMessages = validation?.errors || ['Please complete all required fields before submitting.'];
      const errorText = errorMessages.join('\n• ');
      showError('• ' + errorText, 'Validation Error');
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
      
      // Re-enable submit button after successful submission
      if (submitBtn) submitBtn.disabled = false;
      
      alert('Request submitted successfully!');
      sendMessageToParent('form-submitted', formData);
    }, 1000);
    
  } catch (error) {
    console.error('Error submitting form:', error);
    setLoading(false);
    
    // Re-enable submit button on error
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = false;
    
    showError('An error occurred while submitting the form. Please try again.');
  }
}

// Make submit handler globally available
window.handleFormSubmit = handleFormSubmit;

/*
=====================================================================
GLOBAL FILE UPLOAD UTILITIES
=====================================================================
Shared upload logic for all request types that need to upload files.
Handles message files and document files (CDF/OFSI) separately.

FLOW:
1. Form type collects files and calls uploadFormFiles([...])
2. Shows upload progress UI
3. Sends 'file-data' to parent
4. Parent responds with 'put-links' (s3Keys with s3Key property added)
5. Uploads all files to S3
6. Separates message files from document files
7. Returns Promise with { messageFile, documentFiles }

FILE TAGGING:
- Message files: Set isMessageFile: true
- Document files (CDF/OFSI): isMessageFile: false or undefined
=====================================================================
*/

// Global upload state
let uploadInProgress = false;
let uploadResolve = null;
let uploadReject = null;
let localFilesForUpload = [];

/**
 * Main upload function - handles complete upload flow
 * @param {Array} files - Array of file objects with isMessageFile flag
 * @returns {Promise} - Resolves with { messageFile, documentFiles }
 */
function uploadFormFiles(files) {
  return new Promise((resolve, reject) => {
    // Store resolve/reject for later use
    uploadResolve = resolve;
    uploadReject = reject;
    
    // Store files locally (preserves actual File objects)
    localFilesForUpload = files;
    
    // Show upload progress UI
    showUploadProgress(files);
    
    // Send file-data request to parent
    const fileMetadata = files.map(f => ({
      type: f.type,
      document: f.document,
      uploader: f.uploader,
      date: f.date,
      data: f.data,
      isMessageFile: f.isMessageFile || false,
      file: {} // File object can't be serialized
    }));
    
    console.log('📤 Requesting PUT links for files:', fileMetadata);
    
    sendMessageToParent({
      type: 'file-data',
      files: fileMetadata,
      _id: requestData._id
    });
    
    uploadInProgress = true;
  });
}

/**
 * Shows upload progress UI (matching message-iframe.html)
 */
function showUploadProgress(files) {
  // Create uploading container
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
    const fileName = fileData.data.name;
    const fileSize = ((fileData.file?.size || 0) / 1024 / 1024).toFixed(2);
    
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
 * Hides upload progress UI
 */
function hideUploadProgress() {
  const uploadContainer = document.getElementById('uploadProgressContainer');
  if (uploadContainer) {
    uploadContainer.remove();
  }
}

/**
 * Updates upload progress bar and file statuses
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
 * Uploads files to S3 using PUT links
 * @param {Array} files - Local files array with File objects
 * @param {Array} links - S3 PUT URLs from parent
 * @param {Array} s3Keys - Enhanced file objects with s3Key from parent
 * @returns {Promise} - Resolves when all uploads complete
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
                // Return the s3Keys with s3Key property from parent
                resolve(s3Keys);
              }
            }, 1000);
          }
        } else {
          throw new Error(`Upload failed with status ${response.status}`);
        }
      })
      .catch(error => {
        console.error('S3 upload error for file:', fileData.data.name, error);
        
        if (fileItem && statusText) {
          fileItem.style.borderLeftColor = '#e02424';
          statusText.textContent = `Error: ${error.message}`;
        }
        
        hasErrors = true;
        uploadErrors.push({ file: fileData.data.name, error: error.message });
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
 * Separates message files from document files
 * @param {Array} s3Keys - File objects with s3Key from parent
 * @returns {Object} - { messageFile, documentFiles }
 */
function separateUploadedFiles(s3Keys) {
  const messageFile = s3Keys.find(f => f.isMessageFile === true);
  const documentFiles = s3Keys.filter(f => !f.isMessageFile);
  
  return {
    messageFile: messageFile || null,
    documentFiles: documentFiles.length > 0 ? documentFiles : []
  };
}

/**
 * Handles file upload responses from parent
 */
function handleFileUploadResponse(event) {
  if (!uploadInProgress) return;
  
  const message = event.data;
  
  if (message.type === 'put-links') {
    console.log('📥 Received PUT links from parent:', message);
    
    const links = message.links;
    const s3Keys = message.s3Keys;
    
    // Upload to S3
    uploadFilesToS3(localFilesForUpload, links, s3Keys)
      .then((uploadedS3Keys) => {
        console.log('✅ All files uploaded to S3');
        
        // Hide upload progress
        hideUploadProgress();
        
        // Separate message files from document files
        const separated = separateUploadedFiles(uploadedS3Keys);
        
        // Reset upload state
        uploadInProgress = false;
        localFilesForUpload = [];
        
        // Resolve the promise
        if (uploadResolve) {
          uploadResolve(separated);
          uploadResolve = null;
          uploadReject = null;
        }
      })
      .catch((error) => {
        console.error('❌ S3 upload failed:', error);
        
        // Hide upload progress
        hideUploadProgress();
        
        // Show error
        showError(error.message || 'Upload failed. Please try again.');
        
        // Reset upload state
        uploadInProgress = false;
        localFilesForUpload = [];
        
        // Reject the promise
        if (uploadReject) {
          uploadReject(error);
          uploadResolve = null;
          uploadReject = null;
        }
      });
      
  } else if (message.type === 'put-error') {
    console.error('❌ PUT error from parent:', message);
    
    // Hide upload progress
    hideUploadProgress();
    
    // Show error
    const errorMsg = message.message || 'Failed to generate upload links';
    showError(`Upload preparation failed: ${errorMsg}`);
    
    // Reset upload state
    uploadInProgress = false;
    localFilesForUpload = [];
    
    // Reject the promise
    if (uploadReject) {
      uploadReject(new Error(errorMsg));
      uploadResolve = null;
      uploadReject = null;
    }
  }
}

// Listen for file upload responses
window.addEventListener('message', handleFileUploadResponse);

/**
 * Global submission handler - called by all request types after validation passes
 * Checks for files to upload, uploads them if needed, then sends request-data
 * @param {string} requestType - Type of request ('note', 'update', 'updatePep', 'formJ', etc.)
 * @param {Object} messageObj - Optional message object (for message-based types)
 * @returns {Promise} - Resolves when request-data is sent
 */
async function prepareAndSubmitRequest(requestType, messageObj = null) {
  try {
    console.log(`📤 Preparing ${requestType} submission`);
    
    // Check all 3 file upload inputs
    const messageFileInput = document.getElementById('fileInput');
    const cdfFileInput = document.getElementById('cdfFileInput');
    const ofsiFileInput = document.getElementById('ofsiFileInput');
    const cdfDocumentType = document.getElementById('cdfDocumentType');
    
    const filesToUpload = [];
    
    // 1. Check for message file
    if (messageFileInput?.files[0]) {
      const file = messageFileInput.files[0];
      const userEmail = requestData.user || '';
      
      filesToUpload.push({
        type: 'Message Attachment',
        document: 'Message Attachment',
        uploader: userEmail,
        date: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        data: {
          type: file.type,
          size: file.size,
          name: `${requestType}-attachment-${Date.now()}-${file.name}`,
          lastModified: file.lastModified
        },
        file: file,
        isMessageFile: true  // ← Flag for separation
      });
    }
    
    // 2. Check for CDF file
    if (cdfFileInput?.files[0]) {
      const file = cdfFileInput.files[0];
      const userEmail = requestData.user || '';
      const documentTypeText = cdfDocumentType?.selectedOptions[0]?.text || 'Client Details Form';
      
      filesToUpload.push({
        type: 'Details form',
        document: documentTypeText,
        uploader: userEmail,
        date: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        data: {
          type: file.type,
          size: file.size,
          name: `cdf-${Date.now()}-${file.name}`,
          lastModified: file.lastModified
        },
        file: file,
        isMessageFile: false  // ← Document file
      });
    }
    
    // 3. Check for OFSI file
    if (ofsiFileInput?.files[0]) {
      const file = ofsiFileInput.files[0];
      const userEmail = requestData.user || '';
      
      filesToUpload.push({
        type: 'PEP & Sanctions Check',
        document: 'OFSI Sanctions Search',
        uploader: userEmail,
        date: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        data: {
          type: file.type,
          size: file.size,
          name: `ofsi-${Date.now()}-${file.name}`,
          lastModified: file.lastModified
        },
        file: file,
        isMessageFile: false  // ← Document file
      });
    }
    
    // Decide whether to upload files or go straight to request-data
    if (filesToUpload.length > 0) {
      console.log(`📁 Found ${filesToUpload.length} file(s) to upload`);
      
      // Upload files and wait for completion
      const { messageFile, documentFiles } = await uploadFormFiles(filesToUpload);
      
      // Build and send request-data with uploaded files
      buildAndSendRequestData(requestType, messageObj, messageFile, documentFiles);
      
    } else {
      console.log('📄 No files to upload, sending request-data immediately');
      
      // No files - send request-data immediately
      buildAndSendRequestData(requestType, messageObj, null, []);
    }
    
  } catch (error) {
    console.error('❌ Submission error:', error);
    
    // Re-enable submit button
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = false;
    
    showError(error.message || 'Submission failed. Please try again.');
  }
}

/**
 * Builds and sends request-data message to parent
 * @param {string} requestType - Type of request
 * @param {Object} messageObj - Optional message object
 * @param {Object} messageFile - Uploaded message file with s3Key (or null)
 * @param {Array} documentFiles - Uploaded CDF/OFSI files with s3Keys (or [])
 */
function buildAndSendRequestData(requestType, messageObj, messageFile, documentFiles) {
  // Build base request-data
  const updatedData = buildUpdatedClientData(); // Builds data in shorthand format (cD, r, wT, mD, cI, etc.)
  
  const requestDataMessage = {
    type: 'request-data',
    requestType: requestType,
    user: requestData.user || '',
    _id: requestData._id || requestData.data?._id || '',
    data: updatedData
  };
  
  // Set eSoF flag at top level: only for Form E, check if eSoF tag is also selected
  if (requestType === 'formE') {
    const esofTag = Array.from(document.querySelectorAll('.request-tag'))
      .find(tag => tag.dataset.type === 'esof');
    requestDataMessage.eSoF = esofTag?.classList.contains('selected') || false;
  }
  
  // Add message object if provided
  if (messageObj) {
    // Add file to message if uploaded
    if (messageFile) {
      messageObj.file = {
        name: messageFile.data.name,
        size: messageFile.data.size,
        type: messageFile.data.type,
        s3Key: messageFile.s3Key
      };
    }
    
    requestDataMessage.message = messageObj;
  }
  
  // Add newFiles array only if CDF/OFSI uploaded
  if (documentFiles.length > 0) {
    requestDataMessage.newFiles = documentFiles;
  }
  
  console.log('📤 Sending request-data to parent:', requestDataMessage);
  
  // Send to parent
  sendMessageToParent(requestDataMessage);
  
  // Re-enable submit button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) submitBtn.disabled = false;
  
  console.log('✅ Request submitted successfully');
}

/**
 * Builds updated client data object in shorthand format
 * Excludes idI and idD arrays (not sent in request-data)
 * @returns {Object} - Updated client data
 */
function buildUpdatedClientData() {
  // Get all form values and build updated data object in shorthand format
  
  // Start with existing requestData as base
  const updatedData = {
    _id: requestData._id || requestData.data?._id,
    
    // Client Details (cD)
    cD: {
      cN: requestData.cD?.cN || requestData.data?.cD?.cN,
      mN: requestData.cD?.mN || requestData.data?.cD?.mN,
      fe: requestData.cD?.fe || requestData.data?.cD?.fe,
      n: requestData.cD?.n || requestData.data?.cD?.n
    },
    
    // Relation (r)
    r: document.getElementById('relation')?.value || requestData.r || requestData.data?.r || '',
    
    // Work Type (wT)
    wT: document.getElementById('worktype')?.value || requestData.wT || requestData.data?.wT || '',
    
    // Matter Description (mD)
    mD: document.getElementById('matterDescription')?.value || requestData.mD || requestData.data?.mD || '',
    
    // Business flag (b)
    b: document.getElementById('businessCheckbox')?.checked || false,
    
    // Charity flag (c)
    c: document.getElementById('charityCheckbox')?.checked || false,
    
    // Status array (s) - preserve from requestData
    s: requestData.s || requestData.data?.s || [],
    
    // Indicators (i)
    i: {
      a: requestData.i?.a || requestData.data?.i?.a || false,
      p: requestData.i?.p || requestData.data?.i?.p || false,
      l: requestData.i?.l || requestData.data?.i?.l || false
    }
  };
  
  // Client Info (cI) - Build from form inputs
  const cI = {};
  
  // Check if individual or entity
  const isEntity = updatedData.b || updatedData.c;
  
  // Name object (n) - contains both individual and entity name fields
  cI.n = {};
  
  if (!isEntity) {
    // Individual client name fields
    cI.n.t = document.getElementById('titlePrefix')?.value || requestData.cI?.n?.t || requestData.data?.cI?.n?.t || '';
    cI.n.f = document.getElementById('firstName')?.value || requestData.cI?.n?.f || requestData.data?.cI?.n?.f || '';
    cI.n.m = document.getElementById('middleName')?.value || requestData.cI?.n?.m || requestData.data?.cI?.n?.m || '';
    cI.n.l = document.getElementById('lastName')?.value || requestData.cI?.n?.l || requestData.data?.cI?.n?.l || '';
    
    // Date of birth (b)
    const dobFields = [
      document.getElementById('dob1')?.value || '',
      document.getElementById('dob2')?.value || '',
      document.getElementById('dob3')?.value || '',
      document.getElementById('dob4')?.value || '',
      document.getElementById('dob5')?.value || '',
      document.getElementById('dob6')?.value || '',
      document.getElementById('dob7')?.value || '',
      document.getElementById('dob8')?.value || ''
    ].join('');
    
    if (dobFields.length === 8) {
      cI.b = `${dobFields.slice(0,2)}-${dobFields.slice(2,4)}-${dobFields.slice(4,8)}`;
    } else {
      cI.b = requestData.cI?.b || requestData.data?.cI?.b || '';
    }
    
    // Recent name change flag (nC)
    cI.nC = document.getElementById('recentNameChange')?.checked || false;
    
    // Previous name fields (only if nC is true)
    if (cI.nC) {
      cI.pN = document.getElementById('previousName')?.value || requestData.cI?.pN || requestData.data?.cI?.pN || '';
      cI.rNC = document.getElementById('reasonForNameChange')?.value || requestData.cI?.rNC || requestData.data?.cI?.rNC || '';
    }
  } else {
    // Entity client - business name
    cI.n.b = document.getElementById('businessName')?.value || requestData.cI?.n?.b || requestData.data?.cI?.n?.b || '';
    
    // Entity number (eN)
    cI.eN = document.getElementById('entityNumber')?.value || requestData.cI?.eN || requestData.data?.cI?.eN || '';
    
    // Business data from Companies House/Charity Register (bD) - preserve from requestData
    if (businessData && Object.keys(businessData).length > 0) {
      cI.bD = businessData;
    } else if (requestData.cI?.bD || requestData.data?.cI?.bD) {
      cI.bD = requestData.cI?.bD || requestData.data?.cI?.bD;
    }
  }
  
  // Current address (a) - use global currentAddressObject
  if (currentAddressObject && Object.keys(currentAddressObject).length > 0) {
    cI.a = currentAddressObject;
  } else {
    cI.a = requestData.cI?.a || requestData.data?.cI?.a || {};
  }
  
  // Recent move flag (rM)
  cI.rM = document.getElementById('recentMove')?.checked || false;
  
  // Previous address (pA) - only if rM is true
  if (cI.rM) {
    if (previousAddressObject && Object.keys(previousAddressObject).length > 0) {
      cI.pA = previousAddressObject;
    } else {
      cI.pA = requestData.cI?.pA || requestData.data?.cI?.pA || {};
    }
  }
  
  // Phone number (m) - Format using libphonenumber
  const phoneCodeElement = document.getElementById('phoneCountryCode');
  const phoneCode = phoneCodeElement?.dataset.phoneCode || '+44';
  const phoneNumber = document.getElementById('phoneNumber')?.value || '';
  if (phoneNumber) {
    // Combine country code and number
    const fullPhoneNumber = phoneCode + phoneNumber.replace(/^0/, ''); // Remove leading 0 if present
    
    // Parse and format using libphonenumber
    const parsedPhone = parseAndFormatPhoneNumber(fullPhoneNumber);
    if (parsedPhone && parsedPhone.e164) {
      cI.m = parsedPhone.e164; // Use E.164 format (e.g., "+447506430094")
    } else {
      // Fallback to basic format if parsing fails
      cI.m = fullPhoneNumber;
    }
  } else {
    cI.m = requestData.cI?.m || requestData.data?.cI?.m || '';
  }
  
  // Email (e)
  cI.e = document.getElementById('email')?.value || requestData.cI?.e || requestData.data?.cI?.e || '';
  
  // Add cI to updatedData
  updatedData.cI = cI;
  
  return updatedData;
}

// Listen for file upload responses
window.addEventListener('message', handleFileUploadResponse);

// Expose functions for modules to use
window.RequestFormCore = {
  registerRequestType,
  getRequestData,
  validateCurrentForm,
  sendMessageToParent,
  showError,
  hideError,
  setLoading,
  resetFormUI,
  updateClientOrBusinessSection,
  requestData: () => requestData,
  currentRequestType: () => currentRequestType,
  // Address and business data functions
  getFormDataObjects,
  buildAddressObjects,
  currentAddressObject: () => currentAddressObject,
  previousAddressObject: () => previousAddressObject,
  businessData: () => businessData,
  // ID Images functions
  addIDImageToCarousel,
  // ID Documents functions
  updateIDDocumentsUI,
  idDocuments: () => idDocuments,
  idImages: () => idImages,
  // Form J validation flags
  formJSufficientPhotos: () => formJSufficientPhotos,
  formJConditionsMet: () => formJConditionsMet,
  updateFormJFlags,
  // Global file upload utilities
  uploadFormFiles,
  separateUploadedFiles,
  // Global validation utilities
  validateAndFormatDOB,
  // Global submission utilities
  prepareAndSubmitRequest,
  buildUpdatedClientData
};

// ===== TEMPORARY: MOCK DATA FOR TESTING =====

// Mock data for individual client
const mockClientData = {
  type: 'client-data',
  user: 'staff@domain.com',
  data: {
    "_id": "bd8bee6a-465b-4d43-9a8a-396f9081b649",
    "idI": [
      {
        "side": "Front",
        "name": "50-52 - Master J R Archer-Moran - Driving Licence Front",
        "document": "Driving Licence",
        "data": {
          "type": "image/png",
          "size": 21378,
          "name": "ss-straight-yellow-insert.png",
          "lastModified": 1758829899134
        },
        "date": "10/10/2025, 11:41:42",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "PhotoID",
        "s3Key": "protected/ybwBFKT5eSrpdaiz",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/ybwBFKT5eSrpdaiz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=61cd6c3d580d1f15eca5d8203c903048e34f2dcde706e2599d2aa2750e787fd4&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Back",
        "name": "50-52 - Master J R Archer-Moran - Driving Licence Back",
        "document": "Driving Licence",
        "data": {
          "type": "image/png",
          "size": 895772,
          "name": "retrostyle-cinema-marquee-sign-with-glowing-lights-symbolizing-entertainment-movies-and-classic-theater-experience-in-a-bold-vintage-design-vector.png",
          "lastModified": 1757696547004
        },
        "date": "10/10/2025, 11:41:42",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "PhotoID",
        "s3Key": "protected/UdEHCCFUlkwyPmCh",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/UdEHCCFUlkwyPmCh?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=7c4bdfbbe71f04adf3be184ec19965421e9f943891cb8f2894e71862dea0a10a&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Single",
        "name": "BA-50-52 - Master J R Archer-Moran - Address ID 1 - Tenancy Agreement",
        "document": "Tenancy Agreement",
        "data": {
          "type": "image/jpeg",
          "size": 183232,
          "name": "5990353245_08b19ec64d_c.jpg",
          "lastModified": 1759265544765
        },
        "date": "10/10/2025, 11:40:28",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "type": "Address ID",
        "s3Key": "protected/7s06LuUEtr5fdsMs",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/7s06LuUEtr5fdsMs?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=b14219ced8521450e092e662ea2025f040ee17cfb08a3e81babfd7f32fde1efe&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Single",
        "name": "BA-50-52 - Master J R Archer-Moran - Address ID 1 - Tenancy Agreement",
        "document": "Tenancy Agreement",
        "data": {
          "type": "image/jpeg",
          "size": 183232,
          "name": "5990353245_08b19ec64d_c.jpg",
          "lastModified": 1759265544765
        },
        "date": "10/10/2025, 11:40:28",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "type": "Address ID",
        "s3Key": "protected/7s06LuUEtr5fdsMs",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/7s06LuUEtr5fdsMs?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=b14219ced8521450e092e662ea2025f040ee17cfb08a3e81babfd7f32fde1efe&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Single",
        "name": "BA-50-52 - Master J R Archer-Moran - Passport",
        "document": "Passport",
        "data": {
          "type": "image/jpeg",
          "size": 30652,
          "name": "BA-50-52 - Master J R Archer-Moran - Bank Statement.jpeg",
          "lastModified": 1759867516593
        },
        "date": "10/10/2025, 11:34:14",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "type": "PhotoID",
        "s3Key": "protected/QuPjbtxqHLX9YQWL",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/QuPjbtxqHLX9YQWL?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=782652624b3e0b8c35cdb7f8d67c39d3d5dafe9126212589638c167349471f78&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Single",
        "name": "BA-50-52 - Master J R Archer-Moran - Address ID 1 - NHS Letter",
        "document": "NHS Letter",
        "data": {
          "type": "image/png",
          "size": 40943,
          "name": "Water.PNG",
          "lastModified": 1758831268131
        },
        "date": "10/10/2025, 11:34:56",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "type": "Address ID",
        "s3Key": "protected/TFrnvmrPUcWfJeor",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/TFrnvmrPUcWfJeor?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=d8d6e31c08ad4e0e7b5b5fb0a721869f102d9835cab6fe64674bb791f57a0a85&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "side": "Single",
        "name": "BA-50-52 - Master J R Archer-Moran - Address ID 2 - Bank Statement",
        "document": "Bank Statement",
        "data": {
          "type": "image/png",
          "size": 40982,
          "name": "Co2.PNG",
          "lastModified": 1758831312282
        },
        "date": "10/10/2025, 11:34:56",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "type": "Address ID",
        "s3Key": "protected/kAj11mjAiFttIdXo",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/kAj11mjAiFttIdXo?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=4bfd69cd88b21bfbf9f53ecf4e12a08f27a97f158c3324b47ee8d2b4544c92f5&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      }
    ],
    "idD": [
      {
        "document": "Beneficiary details form",
        "data": {
          "type": "application/pdf",
          "size": 32279,
          "name": "BA-Unknown-Unknown - Unknown - Beneficiary details form",
          "lastModified": 1758798972710
        },
        "date": "14/10/2025, 19:55:42",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "Details form",
        "s3Key": "protected/5hqZxK7RDkcBHwBT",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/5hqZxK7RDkcBHwBT?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=35536230673ecacd7391775ece9a5ea7e470e8e9b6f22eb0bd05e21930131e51&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "document": "OFSI Sanctions Search",
        "data": {
          "type": "application/pdf",
          "size": 32545,
          "name": "BA-Unknown-Unknown - Unknown - OFSI Sanctions Search",
          "lastModified": 1758799014256
        },
        "date": "14/10/2025, 19:53:28",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "PEP & Sanctions Check",
        "s3Key": "protected/WgFX070SKFzaHJ5O",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/WgFX070SKFzaHJ5O?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=8823c4c2d72cb61f8ee7c6e91fef1ccc5b66c01fd39711fbde6746ebb9303b99&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "name": "50-52 - Master J R Archer-Moran - Lite Screen",
        "document": "Lite Screen",
        "data": {
          "type": "document/pdf",
          "size": 1675231,
          "name": "DSC01737.pdf",
          "lastModified": 1698860392000
        },
        "date": "05/10/2025, 17:33:04",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "AML Check",
        "s3Key": "protected/oLLkjjeuIRn9p4QF",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/oLLkjjeuIRn9p4QF?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=64fe56449913a9550980f666382d25c90e1796e0b540a024117e8bceab3d9431&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "document": "Enhanced ID",
        "data": {
          "type": "application/pdf",
          "size": 208237,
          "name": "BA-50-52 - Master J R Archer-Moran - Enhanced ID",
          "lastModified": 1759851790193
        },
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "AML Check",
        "s3Key": "protected/Tk5UvXivOyBr3PP2",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/Tk5UvXivOyBr3PP2?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=cecbffbfe9fcc9134b8dd46984da2cbfd6fc8780f4b63d28f1acc6fe5862a8f9&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      },
      {
        "document": "Client Details form",
        "data": {
          "type": "application/pdf",
          "size": 117237,
          "name": "BA-50-52 - Master J R Archer-Moran - Client Details form",
          "lastModified": 1643802796878
        },
        "date": "08/10/2025, 12:05:22",
        "uploader": "jacob.archer-moran@thurstanhoskin.co.uk",
        "file": {},
        "type": "Details form",
        "s3Key": "protected/Iy2bK2K6xnRuZ4tY",
        "liveUrl": "https://outstanding-id-images-bucket.s3.eu-north-1.amazonaws.com/protected/Iy2bK2K6xnRuZ4tY?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=AKIAZ5QDGL22IHU7VVXM%2F20251016%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Date=20251016T113825Z&X-Amz-Expires=300&X-Amz-Signature=8f081c6410b1571b48370c41eba0432ba515f8533c43a4d4009cd23359e3fa58&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject"
      }
    ],
    "cD": {
      "cN": 50,
      "mN": "52",
      "fe": "BA",
      "n": "Master J R Archer-Moran"
    },
    "r": "Our Client",
    "wT": "Purchase of",
    "s": [
      "AWF"
    ],
    "i": {
      "a": true,
      "p": true,
      "l": false
    },
    "cI": {
      "n": {
        "t": "Master",
        "f": "Jacob",
        "m": "Robert",
        "l": "Archer-Moran"
      },
      "b": "11-01-2001",
      "a": {
        "postcode": "TR15 2ND",
        "country": "GBR",
        "building_name": "",
        "flat_number": "",
        "street": "Southgate Street",
        "building_number": "94",
        "sub_street": "",
        "town": "Redruth"
      },
      "m": "+447506430094",
      "e": "jacob.archer-moran@thurstanhoskin.co.uk"
    },
    "b": false,
    "c": false
  }
};

// Mock data for business
const mockBusinessData = {
  type: 'client-data',
  user: 'staff@domain.com',
  data: {
    "_id": "04f255e4-36fc-40db-a5af-7a9ee3de2712",
    "idI": [],
    "idD": [],
    "cD": {
      "cN": 50,
      "mN": "52",
      "fe": "BA",
      "n": "THURSTAN HOSKIN SOLICITORS LLP"
    },
    "mD": "21 Green lane",
    "r": "Our Client",
    "wT": "Purchase of",
    "b": true,
    "s": [
      "Pending"
    ],
    "i": {},
    "cI": {
      "n": {
        "b": "THURSTAN HOSKIN SOLICITORS LLP"
      },
      "a": {
        "postcode": "TR15 2BY",
        "country": "GBR",
        "building_name": "",
        "flat_number": "",
        "street": "Chynoweth",
        "building_number": "",
        "sub_street": "",
        "town": "Redruth"
      },
      "eN": "OC421980",
      "bD": {
        "company_type": "llp",
        "officers": [
          {
            "etag": "b0b08a3f257cbf6f8994468fa457a22fa7cf94bf",
            "name": "ARCHER, Barbara",
            "appointed_on": "2018-04-12",
            "links": {
              "self": "/company/OC421980/appointments/ghdFOyJWcfPqJQgK8NfDwR7bilM",
              "officer": {
                "appointments": "/officers/bpMu7qGX6X5mbywa163wfmsVQtU/appointments"
              }
            },
            "date_of_birth": {
              "month": 7,
              "year": 1974
            },
            "is_pre_1992_appointment": false,
            "country_of_residence": "United Kingdom",
            "address": {
              "premises": "Chynoweth",
              "country": "United Kingdom",
              "postal_code": "TR15 2BY",
              "region": "Cornwall",
              "locality": "Redruth",
              "address_line_1": "Chapel Street"
            },
            "person_number": "245243370001",
            "officer_role": "llp-designated-member"
          },
          {
            "etag": "b0b08a3f257cbf6f8994468fa457a22fa7cf94bf",
            "name": "MORRISON, Stephen John Duncan",
            "appointed_on": "2018-04-12",
            "links": {
              "self": "/company/OC421980/appointments/cGTjhpGLyetE8EkadB-_wmpQUp4",
              "officer": {
                "appointments": "/officers/GLYKbY1MSXrx-0bckTxUZ-lVExQ/appointments"
              }
            },
            "date_of_birth": {
              "month": 7,
              "year": 1972
            },
            "is_pre_1992_appointment": false,
            "country_of_residence": "United Kingdom",
            "address": {
              "premises": "Chynoweth",
              "country": "United Kingdom",
              "postal_code": "TR15 2BY",
              "region": "Cornwall",
              "locality": "Redruth",
              "address_line_1": "Chapel Street"
            },
            "person_number": "245243350001",
            "officer_role": "llp-designated-member"
          }
        ],
        "confirmation_statement": {
          "last_made_up_to": "2025-04-11",
          "next_due": "2026-04-25",
          "next_made_up_to": "2026-04-11",
          "overdue": false
        },
        "company_name": "THURSTAN HOSKIN SOLICITORS LLP",
        "company_status": "active",
        "registered_office_address": {
          "country": "United Kingdom",
          "address_line_2": "Chapel Street",
          "postal_code": "TR15 2BY",
          "region": "Cornwall",
          "locality": "Redruth",
          "address_line_1": "Chynoweth"
        },
        "date_of_creation": "2018-04-12",
        "sic_codes": [],
        "has_been_liquidated": false,
        "has_insolvency_history": false,
        "company_number": "OC421980",
        "accounts": {
          "overdue": false,
          "next_made_up_to": "2026-03-31",
          "next_accounts": {
            "due_on": "2026-12-31",
            "overdue": false,
            "period_end_on": "2026-03-31",
            "period_start_on": "2025-04-01"
          },
          "accounting_reference_date": {
            "day": "31",
            "month": "03"
          },
          "last_accounts": {
            "made_up_to": "2025-03-31",
            "period_end_on": "2025-03-31",
            "period_start_on": "2024-04-01",
            "type": "total-exemption-full"
          },
          "next_due": "2026-12-31"
        },
        "pscs": [
          {
            "etag": "159127babc57cea133e83a5d6ae0dc8cb6dd8281",
            "name": "Ms Barbara Archer",
            "ceased": false,
            "notified_on": "2018-04-12",
            "links": {
              "self": "/company/OC421980/persons-with-significant-control/individual/BcrfjeumXNsqkEqDDKRKk73DcZQ"
            },
            "date_of_birth": {
              "month": 7,
              "year": 1974
            },
            "natures_of_control": [
              "voting-rights-25-to-50-percent-limited-liability-partnership",
              "right-to-share-surplus-assets-25-to-50-percent-limited-liability-partnership"
            ],
            "nationality": "British",
            "country_of_residence": "United Kingdom",
            "address": {
              "premises": "Chynoweth",
              "country": "United Kingdom",
              "postal_code": "TR15 2BY",
              "region": "Cornwall",
              "locality": "Redruth",
              "address_line_1": "Chapel Street"
            },
            "kind": "individual-person-with-significant-control",
            "name_elements": {
              "title": "Ms",
              "surname": "Archer",
              "forename": "Barbara"
            }
          },
          {
            "etag": "3fe017b054a2c3ae858d3e3122c2b3723b1594b6",
            "name": "Mr Stephen John Duncan Morrison",
            "ceased": false,
            "notified_on": "2018-04-12",
            "links": {
              "self": "/company/OC421980/persons-with-significant-control/individual/yQLo-H0eKa1RTksp-ac31wouYYE"
            },
            "date_of_birth": {
              "month": 7,
              "year": 1972
            },
            "natures_of_control": [
              "voting-rights-25-to-50-percent-limited-liability-partnership",
              "right-to-share-surplus-assets-25-to-50-percent-limited-liability-partnership"
            ],
            "nationality": "British",
            "country_of_residence": "United Kingdom",
            "address": {
              "premises": "Chynoweth",
              "country": "United Kingdom",
              "postal_code": "TR15 2BY",
              "region": "Cornwall",
              "locality": "Redruth",
              "address_line_1": "Chapel Street"
            },
            "kind": "individual-person-with-significant-control",
            "name_elements": {
              "title": "Mr",
              "surname": "Morrison",
              "forename": "Stephen",
              "middle_name": "John Duncan"
            }
          }
        ]
      }
    }
  }
};

// Mock data for charity
const mockCharityData = {
  type: 'client-data',
  user: 'staff@domain.com',
  data: {
    "_id": "b836fd51-cd1f-4c19-9bde-1ab0b2d75e30",
    "idI": [],
    "idD": [],
    "cD": {
      "cN": 50,
      "mN": "52",
      "fe": "BA",
      "n": "Teenage cancer trust"
    },
    "c": true,
    "s": [
      "AWF"
    ],
    "i": {},
    "cI": {
      "n": {
        "b": "TEENAGE CANCER TRUST"
      },
      "a": {
        "postcode": "WC1V 7AA",
        "country": "GBR",
        "building_name": "",
        "flat_number": "",
        "street": "The Place",
        "building_number": "",
        "sub_street": "",
        "town": "London"
      },
      "rNC": "GB",
      "eN": "03350311",
      "bD": {
        "company_type": "private-limited-guarant-nsc-limited-exemption",
        "officers": [
          {
            "etag": "58e523c4b16736ddf84f5fddb74e2019bfe24365",
            "name": "CROCKFORD, George William",
            "appointed_on": "2023-02-24",
            "links": {
              "self": "/company/03350311/appointments/s8uE2dbbZ1lJZTTjkwlvNRWh1SE",
              "officer": {
                "appointments": "/officers/oxV7f9pXg6RzHJEWNwIdD-ouTdI/appointments"
              }
            },
            "is_pre_1992_appointment": false,
            "address": {
              "premises": "The Place",
              "country": "England",
              "postal_code": "WC1V 7AA",
              "locality": "London",
              "address_line_1": "175 High Holborn"
            },
            "person_number": "306384830001",
            "officer_role": "secretary"
          },
          {
            "etag": "58e523c4b16736ddf84f5fddb74e2019bfe24365",
            "name": "CARR, Gurinderjit Kaur",
            "appointed_on": "2022-02-10",
            "links": {
              "self": "/company/03350311/appointments/n-Pp1HtovuE6jz4I9WiYsk9-OKc",
              "officer": {
                "appointments": "/officers/3omf0iBgWPSnPZlIUlJTvg4Vdlg/appointments"
              }
            },
            "date_of_birth": {
              "month": 2,
              "year": 1968
            },
            "is_pre_1992_appointment": false,
            "nationality": "British",
            "country_of_residence": "United Kingdom",
            "address": {
              "premises": "The Place",
              "country": "England",
              "postal_code": "WC1V 7AA",
              "locality": "London",
              "address_line_1": "175 High Holborn"
            },
            "person_number": "292069390001",
            "occupation": "Partner, Consulting",
            "officer_role": "director"
          }
        ],
        "confirmation_statement": {
          "last_made_up_to": "2025-03-02",
          "next_due": "2026-03-16",
          "next_made_up_to": "2026-03-02",
          "overdue": false
        },
        "company_name": "TEENAGE CANCER TRUST",
        "company_status": "active",
        "registered_office_address": {
          "country": "England",
          "address_line_2": "175 High Holborn",
          "postal_code": "WC1V 7AA",
          "locality": "London",
          "address_line_1": "The Place"
        },
        "date_of_creation": "1997-04-10",
        "sic_codes": [
          "86900"
        ],
        "has_been_liquidated": false,
        "has_insolvency_history": false,
        "company_number": "03350311",
        "accounts": {
          "overdue": false,
          "next_made_up_to": "2025-12-31",
          "next_accounts": {
            "due_on": "2026-09-30",
            "overdue": false,
            "period_end_on": "2025-12-31",
            "period_start_on": "2025-01-01"
          },
          "accounting_reference_date": {
            "day": "31",
            "month": "12"
          },
          "last_accounts": {
            "made_up_to": "2024-12-31",
            "period_end_on": "2024-12-31",
            "period_start_on": "2024-01-01",
            "type": "group"
          },
          "next_due": "2026-09-30"
        },
        "pscs": []
      }
    }
  }
};

// Setup mock data buttons
document.addEventListener('DOMContentLoaded', function() {
  const mockClientBtn = document.getElementById('mockClientBtn');
  const mockBusinessBtn = document.getElementById('mockBusinessBtn');
  const mockCharityBtn = document.getElementById('mockCharityBtn');
  
  if (mockClientBtn) {
    mockClientBtn.addEventListener('click', function() {
      console.log('🧪 Loading Individual Mock Data');
      handleClientData(mockClientData);
    });
  }
  
  if (mockBusinessBtn) {
    mockBusinessBtn.addEventListener('click', function() {
      console.log('🧪 Loading Business Mock Data');
      handleClientData(mockBusinessData);
    });
  }
  
  if (mockCharityBtn) {
    mockCharityBtn.addEventListener('click', function() {
      console.log('🧪 Loading Charity Mock Data');
      handleClientData(mockCharityData);
    });
  }
});
