/* ===================================
   Thirdfort Check Manager - Core
   =================================== */

// Global State
const checkState = {
  clientData: null,
  checkType: null,
  matterCategory: null,
  matterSubCategory: null,
  liteScreenType: 'aml-address', // Default to AML & Address Screening
  includeLiteScreen: true, // Default to YES (user can change to NO)
  includeIDV: null, // No default - user must choose
  idvDocumentType: null,
  idvRequiresBack: false,
  electronicIdType: 'standard', // Default to Standard ID
  kybJurisdiction: null,
  kybCompany: null,
  checkReference: '',
  isValid: false,
  pepMonitoringInitialized: false // Track if PEP monitoring was initialized for this data load
};

// Address objects storage
let liteCurrentAddressObject = null;
let litePreviousAddressObject = null;
let liteActiveAddressType = 'current'; // 'current' or 'previous'

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('Thirdfort Check Manager Initialized');
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Initialize jurisdiction autocomplete
  if (typeof initializeJurisdictionAutocomplete === 'function') {
    initializeJurisdictionAutocomplete('kybJurisdiction', 'kybJurisdictionDropdown');
  }
  
  // Initialize country autocomplete (for address fields)
  if (typeof initializeCountryAutocomplete === 'function') {
    initializeCountryAutocomplete('liteCountry', 'liteCountryDropdown');
    initializeCountryAutocomplete('electronicIdCountry', 'electronicIdCountryDropdown');
  }
  
  // Initialize phone code autocomplete
  if (typeof initializePhoneCodeAutocomplete === 'function') {
    initializePhoneCodeAutocomplete('electronicIdCountryCode', 'electronicIdCountryCodeDropdown');
  }
  
  // Set initial state
  setInitialState();
  
  // Listen for postMessage data from parent
  window.addEventListener('message', handlePostMessage);
  
  // Notify parent that iframe is ready
  notifyParentReady();
});

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Check Type Selection
  const checkTypeCards = document.querySelectorAll('.check-type-card');
  checkTypeCards.forEach(card => {
    card.addEventListener('click', handleCheckTypeSelection);
  });
  
  // Matter Category Selection
  const categoryCards = document.querySelectorAll('.matter-category-card');
  categoryCards.forEach(card => {
    card.addEventListener('click', handleMatterCategorySelection);
  });
  
  // Matter Sub-Category Selection
  const subCategoryCards = document.querySelectorAll('.matter-sub-card');
  subCategoryCards.forEach(card => {
    card.addEventListener('click', handleMatterSubCategorySelection);
  });
  
  // Lite Screen Type Selection
  const liteScreenTypeCards = document.querySelectorAll('.lite-screen-type-card');
  liteScreenTypeCards.forEach(card => {
    card.addEventListener('click', handleLiteScreenTypeSelection);
  });
  
  // IDV Answer Selection
  const idvAnswerCards = document.querySelectorAll('.idv-answer-card[data-idv-answer]');
  idvAnswerCards.forEach(card => {
    card.addEventListener('click', handleIDVAnswerSelection);
  });
  
  // Lite Screen Answer Selection
  const liteAnswerCards = document.querySelectorAll('.idv-answer-card[data-lite-answer]');
  liteAnswerCards.forEach(card => {
    card.addEventListener('click', handleLiteAnswerSelection);
  });
  
  // Check Reference Input
  const checkReferenceInput = document.getElementById('checkReference');
  if (checkReferenceInput) {
    checkReferenceInput.addEventListener('input', handleCheckReferenceChange);
  }
  
  // Lite Screen Date of Birth Auto-Tab
  const liteDobInputs = [
    document.getElementById('liteDob1'),
    document.getElementById('liteDob2'),
    document.getElementById('liteDob3'),
    document.getElementById('liteDob4'),
    document.getElementById('liteDob5'),
    document.getElementById('liteDob6'),
    document.getElementById('liteDob7'),
    document.getElementById('liteDob8')
  ];
  
  liteDobInputs.forEach((input, index) => {
    if (!input) return;
    
    // Handle input navigation
    input.addEventListener('keydown', function(e) {
      // Ignore keyboard shortcuts (Ctrl+V, Ctrl+C, Cmd+V, etc.)
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      
      if (e.key === 'Backspace' && !this.value && index > 0) {
        // Move to previous input on backspace when current is empty
        liteDobInputs[index - 1].focus();
      } else if (this.value.length === 1 && index < liteDobInputs.length - 1) {
        // Move to next input when current is filled
        liteDobInputs[index + 1].focus();
      }
    });
    
    // Handle only numeric input
    input.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^0-9]/g, '');
      // Auto-advance when digit entered
      if (this.value.length === 1 && index < liteDobInputs.length - 1) {
        liteDobInputs[index + 1].focus();
      }
    });
  });
  
  // Handle paste in first DOB field with robust date parsing
  if (liteDobInputs[0]) {
    liteDobInputs[0].addEventListener('paste', function(e) {
      e.preventDefault();
      
      const pastedText = (e.clipboardData || window.clipboardData).getData('text');
      console.log('📋 Pasted DOB text:', pastedText);
      
      // Try to parse the date
      const parsedDate = parseDateString(pastedText);
      
      if (parsedDate) {
        // Fill all 8 DOB inputs with DDMMYYYY format
        liteDobInputs.forEach((input, index) => {
          if (input) {
            input.value = parsedDate[index];
          }
        });
        
        liteDobInputs[7].focus();
        const formattedDate = `${parsedDate.substring(0,2)}/${parsedDate.substring(2,4)}/${parsedDate.substring(4,8)}`;
        console.log('✅ Pasted DOB filled all fields:', parsedDate, '→', formattedDate);
      } else {
        console.warn('⚠️ Could not parse date from pasted text:', pastedText);
      }
    });
  }
  
  // Lite Screen Address Manual Entry Toggle
  const liteAddressNotListed = document.getElementById('liteAddressNotListed');
  if (liteAddressNotListed) {
    liteAddressNotListed.addEventListener('change', toggleLiteManualAddress);
  }
  
  // Lite Screen Country Selection (for International Address Verification)
  const liteCountry = document.getElementById('liteCountry');
  if (liteCountry) {
    liteCountry.addEventListener('change', handleLiteCountryChange);
  }
  
  // Lite Screen Address Autocomplete
  const liteAddress = document.getElementById('liteAddress');
  const liteAddressDropdown = document.getElementById('liteAddressDropdown');
  if (liteAddress && liteAddressDropdown) {
    setupLiteAddressAutocomplete(liteAddress, liteAddressDropdown);
  }
  
  // Lite Screen Manual Address Validation and Change Detection
  const liteManualAddressInputs = [
    'liteFlatNumber', 'liteBuildingNumber', 'liteBuildingName',
    'liteStreet', 'liteSubStreet', 'liteTown', 'litePostcode'
  ];
  liteManualAddressInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('input', () => {
        validateLiteManualAddress();
        detectLiteAddressChange();
      });
      input.addEventListener('change', () => {
        validateLiteManualAddress();
        detectLiteAddressChange();
      });
    }
  });
  
  // Lite Screen Address Card Buttons
  const liteCurrentAddressBtn = document.getElementById('liteCurrentAddressBtn');
  const litePreviousAddressBtn = document.getElementById('litePreviousAddressBtn');
  
  if (liteCurrentAddressBtn) {
    liteCurrentAddressBtn.addEventListener('click', handleLiteCurrentAddressClick);
  }
  
  if (litePreviousAddressBtn) {
    litePreviousAddressBtn.addEventListener('click', handleLitePreviousAddressClick);
  }
  
  // Electronic ID Country Selection (for International Address Verification)
  const electronicIdCountry = document.getElementById('electronicIdCountry');
  if (electronicIdCountry) {
    electronicIdCountry.addEventListener('change', handleElectronicIdCountryChange);
  }
  
  // Electronic ID Type Selection
  const electronicIdTypeCards = document.querySelectorAll('.electronic-id-type-card');
  electronicIdTypeCards.forEach(card => {
    card.addEventListener('click', handleElectronicIdTypeSelection);
  });
  
  // IDV Document Type Selection
  const idvDocumentCards = document.querySelectorAll('.idv-document-card');
  idvDocumentCards.forEach(card => {
    card.addEventListener('click', handleIDVDocumentTypeSelection);
  });
  
  // IDV Section Address Manual Entry Toggle
  const idvAddressNotListed = document.getElementById('idvAddressNotListed');
  if (idvAddressNotListed) {
    idvAddressNotListed.addEventListener('change', toggleIDVManualAddress);
  }
  
  // KYB Jurisdiction Change (for jurisdiction-specific reports)
  const kybJurisdiction = document.getElementById('kybJurisdiction');
  if (kybJurisdiction) {
    kybJurisdiction.addEventListener('change', handleKYBJurisdictionChange);
  }
  
  // KYB Search Button
  const kybSearchBtn = document.getElementById('kybSearchBtn');
  if (kybSearchBtn) {
    kybSearchBtn.addEventListener('click', handleKYBSearch);
  }
  
  // KYB Change Company Button
  const kybChangeCompanyBtn = document.getElementById('kybChangeCompanyBtn');
  if (kybChangeCompanyBtn) {
    kybChangeCompanyBtn.addEventListener('click', handleKYBChangeCompany);
  }
  
  // Confirmation Checkbox
  const confirmationCheckbox = document.getElementById('confirmationCheckbox');
  if (confirmationCheckbox) {
    confirmationCheckbox.addEventListener('change', validateForm);
  }
  
  // Submit Button
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }
  
  // Error Popup Close
  const closeError = document.getElementById('closeError');
  if (closeError) {
    closeError.addEventListener('click', hideError);
  }
  
  // IDV Image Change Buttons
  const idvFrontChangeBtn = document.getElementById('idvFrontChangeBtn');
  if (idvFrontChangeBtn) {
    idvFrontChangeBtn.addEventListener('click', () => showIDVImageList('front'));
  }
  
  const idvBackChangeBtn = document.getElementById('idvBackChangeBtn');
  if (idvBackChangeBtn) {
    idvBackChangeBtn.addEventListener('click', () => showIDVImageList('back'));
  }
  
  // IDV Image Open Buttons
  const idvFrontOpenBtn = document.getElementById('idvFrontOpenBtn');
  if (idvFrontOpenBtn) {
    idvFrontOpenBtn.addEventListener('click', () => openIDVImage('front'));
  }
  
  const idvBackOpenBtn = document.getElementById('idvBackOpenBtn');
  if (idvBackOpenBtn) {
    idvBackOpenBtn.addEventListener('click', () => openIDVImage('back'));
  }
  
  
  // Form Inputs Validation
  const requiredInputs = document.querySelectorAll('input[required], select[required], textarea[required]');
  requiredInputs.forEach(input => {
    input.addEventListener('input', validateForm);
    input.addEventListener('change', validateForm);
  });
}

/**
 * Set initial state - hide all sections except header and check type selector
 */
function setInitialState() {
  // Show only header, check type selector, and confirmation initially
  showSection('headerSection');
  showSection('checkTypeSection');
  showSection('confirmationSection');
  
  // Hide all check-specific sections initially
  hideSection('matterCategorySection');
  hideSection('electronicIdSection');
  hideSection('kybSection');
  hideSection('liteScreenSection');
  hideSection('idvSection');
  
  // Hide ongoing monitoring card initially (shown based on check type)
  const monitoringCard = document.getElementById('monitoringCard');
  if (monitoringCard) {
    monitoringCard.classList.add('hidden');
  }
  
  // Hide KYB Reports & Documents section initially (shown after company selection)
  const kybReportsSection = document.querySelector('.kyb-reports-section');
  if (kybReportsSection) {
    kybReportsSection.classList.add('hidden');
  }
  
  // Electronic ID: Hide optional checkbox cards initially
  // Proof of Address is always visible and checked by default
  // Proof of Ownership shown/checked based on matter category/subtype
  // eSoF cards shown/checked based on eSoF Requested tag
  const proofOfOwnershipCard = document.getElementById('proofOfOwnershipCard');
  const esofQuestionnaireCard = document.getElementById('esofQuestionnaireCard');
  const esowBankLinkingCard = document.getElementById('esowBankLinkingCard');
  
  if (proofOfOwnershipCard) proofOfOwnershipCard.classList.add('hidden');
  if (esofQuestionnaireCard) esofQuestionnaireCard.classList.add('hidden');
  if (esowBankLinkingCard) esowBankLinkingCard.classList.add('hidden');
  
  // Hide header elements initially (shown when client data is loaded)
  const headerRight = document.querySelector('.header-right');
  const requestTagsContainer = document.getElementById('requestTagsContainer');
  const latestMessageCard = document.getElementById('latestMessageCard');
  const matterDetailsCard = document.getElementById('matterDetailsCard');
  
  if (headerRight) headerRight.classList.add('hidden');
  if (requestTagsContainer) requestTagsContainer.classList.add('hidden');
  if (latestMessageCard) latestMessageCard.classList.add('hidden');
  if (matterDetailsCard) matterDetailsCard.classList.add('hidden');
  
  // Keep client number and name containers visible but empty
  const clientNumberBadge = document.getElementById('clientMatterNumber');
  const clientName = document.getElementById('clientName');
  const titleBadge = document.querySelector('#titleBadge span');
  
  if (clientNumberBadge) clientNumberBadge.textContent = '';
  if (clientName) clientName.textContent = '';
  if (titleBadge) titleBadge.textContent = '';
  
  // Keep submit button disabled until form is valid
  document.getElementById('submitBtn').disabled = true;
}

/**
 * Handle postMessage from parent window
 */
function handlePostMessage(event) {
  // TODO: Add origin validation in production
  // if (event.origin !== 'https://expected-domain.com') return;
  
  const data = event.data;
  
  if (data.type === 'client-data') {
    // console.log('Received client data:', data.data); // Commented out to avoid logging client data
    checkState.clientData = data.data;
    populateClientData(data.data);
    
    // If data includes address object, auto-populate lite screen address fields
    // and show manual fields without needing autocomplete API calls
    if (data.data.address) {
      populateLiteScreenAddress(data.data.address);
    }
  }
  
  if (data.type === 'general-error') {
    console.error('General error from parent:', data.message);
    showError(data.message || 'An error occurred. Please try again.');
  }
  
  if (data.type === 'check-response') {
    // console.log('Received check response from parent:', data.data); // Commented out to avoid logging client data
    handleCheckResponse(data.data);
  }
  
  if (data.type === 'company-results') {
    // console.log('Received company search results:', data); // Commented out to avoid logging client data
    // Handle different data structures: data.companies, data.data, or data itself
    let companies = [];
    if (data.companies && Array.isArray(data.companies)) {
      companies = data.companies;
    } else if (data.data && Array.isArray(data.data)) {
      companies = data.data;
    } else if (Array.isArray(data)) {
      companies = data;
    }
    // console.log('Extracted companies array:', companies); // Commented out to avoid logging client data
    displayKYBSearchResults(companies);
  }
  
  if (data.type === 'company-error') {
    console.error('Company search error:', data.error);
    const resultsContainer = document.getElementById('kybResultsContainer');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="kyb-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e02424" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p style="color: #e02424;">${data.error || 'Error searching companies. Please try again.'}</p>
        </div>
      `;
    }
  }
  
  if (data.type === 'address-results') {
    // console.log('Received address autocomplete results:', data.suggestions); // Commented out to avoid logging client data
    displayAddressSuggestions(data.suggestions, data.field);
  }
  
  if (data.type === 'address-data') {
    // console.log('Received full address data:', data.address); // Commented out to avoid logging client data
    handleAddressData(data.address, data.field);
  }
}

/**
 * Handle response from parent after Thirdfort API call
 */
/**
 * Handle check response from parent (after backend creates check)
 * Shows success popup with check-specific details or error message
 */
function handleCheckResponse(response) {
  const submitBtn = document.getElementById('submitBtn');
  
  if (response.success) {
    console.log('✅ Check initiated successfully:', response);
    
    // Build success message based on check type
    let successMessage = response.message || 'Check initiated successfully!';
    let detailsHTML = '';
    
    // Add check-type-specific details
    if (response.checkType === 'electronic-id' && response.transactionId) {
      detailsHTML = `
        <div style="margin-top: 10px; font-size: 0.9rem; color: #fff;">
          <strong>Transaction ID:</strong> ${response.transactionId}<br>
          <strong>Status:</strong> SMS sent to consumer<br>
          Awaiting completion...
        </div>
      `;
    } else if (response.checkType === 'kyb' && response.checkId) {
      detailsHTML = `
        <div style="margin-top: 10px; font-size: 0.9rem; color: #fff;">
          <strong>Check ID:</strong> ${response.checkId}<br>
          <strong>Status:</strong> Processing KYB check...
        </div>
      `;
    } else if (response.checkType === 'lite-idv') {
      let checks = [];
      if (response.liteTransactionId) checks.push('Lite Screen');
      if (response.idvCheckId) checks.push('IDV');
      
      detailsHTML = `
        <div style="margin-top: 10px; font-size: 0.9rem; color: #fff;">
          <strong>Checks initiated:</strong> ${checks.join(' + ')}<br>
          ${response.documentsUploaded ? '<strong>Documents:</strong> Uploaded ✓' : ''}
        </div>
      `;
    }
    
    // Show success popup
    showSuccessPopup(successMessage, detailsHTML);
    
    // Update button state
    submitBtn.textContent = 'Check Initiated!';
    submitBtn.style.background = '#28a745';
    submitBtn.disabled = true;
    
    // Parent will close lightbox after 3 seconds (handled in Velo frontend)
    
  } else {
    // Error from backend
    console.error('❌ Check initiation failed:', response);
    const errorMsg = response.error || 'Failed to initiate check. Please try again.';
    showError(errorMsg);
    
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = 'Initiate Check';
    submitBtn.style.background = '';
  }
}

/**
 * Show success popup with green background
 */
function showSuccessPopup(message, detailsHTML = '') {
  // Create or get existing popup
  let popup = document.getElementById('successPopup');
  
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'successPopup';
    popup.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    document.body.appendChild(popup);
  }
  
  popup.innerHTML = `
    <div style="
      background: #28a745;
      padding: 30px;
      border-radius: 12px;
      text-align: center;
      max-width: 450px;
      width: 90%;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    ">
      <div style="font-size: 3rem; margin-bottom: 15px;">✓</div>
      <h3 style="color: white; margin: 0 0 10px 0; font-size: 1.3rem;">
        ${message}
      </h3>
      ${detailsHTML}
      <p style="color: rgba(255,255,255,0.9); margin: 15px 0 0 0; font-size: 0.85rem;">
        Closing in 3 seconds...
      </p>
    </div>
  `;
  
  popup.style.display = 'flex';
}

/**
 * Hide success popup
 */
function hideSuccessPopup() {
  const popup = document.getElementById('successPopup');
  if (popup) {
    popup.style.display = 'none';
  }
}

/**
 * Notify parent window that iframe is ready
 */
function notifyParentReady() {
  window.parent.postMessage({
    type: 'check-ready',
    timestamp: new Date().toISOString()
  }, '*');
}

/**
 * Format getaddress.io address object to Thirdfort API format
 * - UK (GBR): Uses individual fields (building_name, building_number, flat_number, street, etc.)
 * - USA/CAN: Uses address_1, address_2, state
 * - Other: Uses address_1, address_2
 * - Per Thirdfort API spec: UK addresses must NOT include address_1/address_2
 */
function formatToThirdfort(getAddressData, country = 'GBR') {
  if (!getAddressData) return null;
  
  // UK addresses: Individual fields only (no address_1, address_2)
  if (country === 'GBR') {
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

/**
 * Parse various date formats into DDMMYYYY string
 * Supports: dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy, dd Jan yyyy, January 11 2001, etc.
 */
function parseDateString(dateStr) {
  if (!dateStr) return null;
  
  const text = dateStr.trim().toLowerCase();
  
  // Month name mappings
  const months = {
    'jan': '01', 'january': '01',
    'feb': '02', 'february': '02',
    'mar': '03', 'march': '03',
    'apr': '04', 'april': '04',
    'may': '05',
    'jun': '06', 'june': '06',
    'jul': '07', 'july': '07',
    'aug': '08', 'august': '08',
    'sep': '09', 'sept': '09', 'september': '09',
    'oct': '10', 'october': '10',
    'nov': '11', 'november': '11',
    'dec': '12', 'december': '12'
  };
  
  let day = null, month = null, year = null;
  
  // Try pure 8-digit format first (DDMMYYYY like "22022003")
  const pureDigits = text.replace(/[^0-9]/g, '');
  if (pureDigits.length === 8) {
    day = pureDigits.substring(0, 2);
    month = pureDigits.substring(2, 4);
    year = pureDigits.substring(4, 8);
  }
  
  // Try numeric format with separators (dd/mm/yyyy, dd-mm-yy, dd.mm.yyyy)
  if (!day) {
    const numericMatch = text.match(/(\d{1,2})[\s\-\/.]+(\d{1,2})[\s\-\/.]+(\d{2,4})/);
    if (numericMatch) {
      day = numericMatch[1].padStart(2, '0');
      month = numericMatch[2].padStart(2, '0');
      year = numericMatch[3];
    }
  }
  
  // Try text month formats (11 Jan 2001, January 11th 2001, Jan 11 01)
  if (!day) {
    // Day first: "11 January 2001", "11th Jan 01"
    const dayFirstMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{2,4})/);
    if (dayFirstMatch) {
      day = dayFirstMatch[1].padStart(2, '0');
      const monthName = dayFirstMatch[2];
      month = months[monthName] || months[monthName.substring(0, 3)];
      year = dayFirstMatch[3];
    }
  }
  
  // Try month first: "January 11 2001", "Jan 11th 01"
  if (!day) {
    const monthFirstMatch = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})/);
    if (monthFirstMatch) {
      const monthName = monthFirstMatch[1];
      month = months[monthName] || months[monthName.substring(0, 3)];
      day = monthFirstMatch[2].padStart(2, '0');
      year = monthFirstMatch[3];
    }
  }
  
  // Validate and normalize
  if (!day || !month || !year) return null;
  
  // Convert 2-digit year to 4-digit (assume 1900s for 00-99)
  if (year.length === 2) {
    const yearNum = parseInt(year, 10);
    year = yearNum >= 0 && yearNum <= 30 ? '20' + year : '19' + year;
  }
  
  // Validate ranges
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);
  
  if (dayNum < 1 || dayNum > 31) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  if (yearNum < 1900 || yearNum > 2100) return null;
  
  // Return as DDMMYYYY string
  return day + month + year;
}

/**
 * Display address autocomplete suggestions in dropdown
 */
function displayAddressSuggestions(suggestions, field) {
  const liteAddressDropdown = document.getElementById('liteAddressDropdown');
  
  if (!liteAddressDropdown) return;
  
  if (!suggestions || suggestions.length === 0) {
    liteAddressDropdown.innerHTML = '<div class="address-no-results">No addresses found</div>';
    liteAddressDropdown.classList.remove('hidden');
    return;
  }
  
  liteAddressDropdown.innerHTML = '';
  
  suggestions.forEach((suggestion) => {
    const item = document.createElement('div');
    item.className = 'address-dropdown-item';
    item.textContent = suggestion.address;
    
    item.addEventListener('click', () => {
      selectAddressSuggestion(suggestion.id, suggestion.address);
    });
    
    liteAddressDropdown.appendChild(item);
  });
  
  liteAddressDropdown.classList.remove('hidden');
}

/**
 * Handle address selection from dropdown
 */
function selectAddressSuggestion(addressId, displayText) {
  const liteAddress = document.getElementById('liteAddress');
  const liteAddressDropdown = document.getElementById('liteAddressDropdown');
  
  if (liteAddress) {
    liteAddress.value = displayText;
  }
  
  if (liteAddressDropdown) {
    liteAddressDropdown.classList.add('hidden');
  }
  
  // Request full address from parent
  console.log('📡 Requesting full address for ID:', addressId);
  window.parent.postMessage({
    type: 'address-lookup',
    addressId: addressId,
    field: 'lite'
  }, '*');
}

/**
 * Handle full address data from parent
 */
function handleAddressData(addressData, field) {
  const liteCountry = document.getElementById('liteCountry');
  const country = liteCountry?.dataset.countryCode || 'GBR';
  const thirdfortAddress = formatToThirdfort(addressData, country);
  
  // Store the Thirdfort-formatted address in the appropriate variable
  if (field === 'lite' || field === 'current') {
    liteCurrentAddressObject = thirdfortAddress;
    // console.log('✅ Lite Screen address stored:', liteCurrentAddressObject); // Commented out to avoid logging client data
    
    // Update address card display text
    const currentAddressText = document.getElementById('liteCurrentAddressText');
    if (currentAddressText) {
      currentAddressText.textContent = formatAddressForCard(liteCurrentAddressObject);
    }
    
    // Show current address card if hidden
    const currentAddressCard = document.getElementById('liteCurrentAddressCard');
    if (currentAddressCard) {
      currentAddressCard.classList.remove('hidden');
    }
    
    // Load address into manual fields
    liteActiveAddressType = 'current';
    loadAddressIntoManualFields(liteCurrentAddressObject, 'lite');
    
    // Show manual address fields if hidden
    const liteManualAddressFields = document.getElementById('liteManualAddressFields');
    if (liteManualAddressFields) {
      liteManualAddressFields.classList.remove('hidden');
      
      // Validate fields after DOM updates
      setTimeout(() => {
        validateLiteManualAddress();
      }, 100);
    }
    
    // Update card selection states
    updateLiteAddressCardStates();
  }
  
  // If it's a previous address (in case we add that later)
  if (field === 'previous') {
    litePreviousAddressObject = thirdfortAddress;
    // console.log('✅ Lite Screen previous address stored:', litePreviousAddressObject); // Commented out to avoid logging client data
    
    // Update previous address card display
    const previousAddressText = document.getElementById('litePreviousAddressText');
    if (previousAddressText) {
      previousAddressText.textContent = formatAddressForCard(litePreviousAddressObject);
    }
    
    const previousAddressCard = document.getElementById('litePreviousAddressCard');
    if (previousAddressCard) {
      previousAddressCard.classList.remove('hidden');
    }
  }
}

/**
 * Setup address autocomplete with debouncing for Lite Screen
 */
function setupLiteAddressAutocomplete(inputElement, dropdownElement) {
  let addressDebounceTimer = null;
  let selectedIndex = -1;
  
  inputElement.addEventListener('input', (e) => {
    const searchTerm = e.target.value.trim();
    
    // Clear timer
    if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
    
    // Clear stored object when user types
    liteCurrentAddressObject = null;
    
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
    addressDebounceTimer = setTimeout(() => {
      console.log('📡 API call for address autocomplete:', searchTerm);
      window.parent.postMessage({
        type: 'address-search',
        searchTerm: searchTerm,
        field: 'lite'
      }, '*');
    }, 300);
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

/**
 * Check and populate IDV images from client data
 */
function checkAndPopulateIDVImages(data) {
  // console.log('🔍 Checking IDV images...', data.idI); // Commented out to avoid logging client data
  
  // Get IDV elements
  const idvYesBtn = document.querySelector('[data-idv-answer="yes"]');
  const idvNoBtn = document.querySelector('[data-idv-answer="no"]');
  const idvPhotoIdError = document.getElementById('idvPhotoIdError');
  const idvFrontList = document.getElementById('idvFrontList');
  const idvBackList = document.getElementById('idvBackList');
  
  // Reset IDV state (clear any previous selections)
  checkState.availableIDVImages = null;
  checkState.frontImage = null;
  checkState.backImage = null;
  checkState.idvDocumentType = null;
  
  // Reset button states and hide error by default
  if (idvYesBtn) {
    idvYesBtn.disabled = false;
    idvYesBtn.classList.remove('selected');
  }
  if (idvNoBtn) {
    idvNoBtn.disabled = false;
    idvNoBtn.classList.remove('selected');
  }
  if (idvPhotoIdError) {
    idvPhotoIdError.classList.add('hidden');
  }
  
  // Filter photo ID images from idI array
  const photoIdImages = (data.idI || []).filter(img => img.type === 'PhotoID');
  
  // Check for suitable photo ID types
  const suitableTypes = {
    'Passport': 'passport',
    'Driving Licence': 'driving_licence',
    'Passport Card': 'national_identity_card',
    'National Identity Card': 'national_identity_card',
    'Residence Permit': 'residence_permit',
    'Other Photo ID Card': 'other'
  };
  
  const availableImages = photoIdImages.filter(img => 
    Object.keys(suitableTypes).includes(img.document)
  );
  
  // If NO photo IDs at all OR no suitable types, disable buttons and show error
  if (photoIdImages.length === 0) {
    console.log('❌ No photo ID images found - disabling IDV buttons');
    // Disable IDV buttons and show error
    if (idvYesBtn) idvYesBtn.disabled = true;
    if (idvNoBtn) idvNoBtn.disabled = true;
    if (idvPhotoIdError) idvPhotoIdError.classList.remove('hidden');
    return;
  }
  
  if (availableImages.length === 0) {
    console.log('❌ No suitable photo ID types found - disabling IDV buttons');
    // Disable IDV buttons and show error
    if (idvYesBtn) idvYesBtn.disabled = true;
    if (idvNoBtn) idvNoBtn.disabled = true;
    if (idvPhotoIdError) idvPhotoIdError.classList.remove('hidden');
    return;
  }
  
  // console.log('✅ Found suitable photo ID images:', availableImages); // Commented out to avoid logging client data
  
  // Enable IDV buttons (in case they were disabled)
  if (idvYesBtn) idvYesBtn.disabled = false;
  if (idvNoBtn) idvNoBtn.disabled = false;
  if (idvPhotoIdError) idvPhotoIdError.classList.add('hidden');
  
  // Auto-select document type (prioritize Passport > Driving Licence > Passport Card > National Identity Card > Residence Permit > Other)
  let selectedDocType = null;
  let shouldAutoSelectYes = false;
  const priorityOrder = ['Passport', 'Driving Licence', 'Passport Card', 'National Identity Card', 'Residence Permit', 'Other Photo ID Card'];
  
  for (const docType of priorityOrder) {
    const found = availableImages.find(img => img.document === docType);
    if (found) {
      selectedDocType = suitableTypes[docType];
      console.log(`🎯 Auto-selecting document type: ${docType} (${selectedDocType})`);
      
      // Only auto-select if not "Other"
      if (docType !== 'Other Photo ID Card') {
        shouldAutoSelectYes = true; // Auto-select YES for suitable types
        
        const docCard = document.querySelector(`[data-document-type="${selectedDocType}"]`);
        if (docCard) {
          // Deselect all cards first
          document.querySelectorAll('.idv-document-card').forEach(card => {
            card.classList.remove('selected');
          });
          // Select the matched card
          docCard.classList.add('selected');
          
          // Update column visibility based on document type
          const requiresBack = docCard.dataset.requiresBack === 'true';
          const frontColumnLabel = document.getElementById('idvFrontColumnLabel');
          const backColumn = document.getElementById('idvBackColumn');
          
          if (requiresBack) {
            if (backColumn) backColumn.style.display = 'flex';
            if (frontColumnLabel) frontColumnLabel.textContent = 'Front Photo';
          } else {
            if (backColumn) backColumn.style.display = 'none';
            if (frontColumnLabel) frontColumnLabel.textContent = 'Single Photo';
          }
          
          // Store in state
          checkState.idvDocumentType = selectedDocType;
          checkState.idvRequiresBack = requiresBack;
        }
      }
      break;
    }
  }
  
  // Auto-select "YES" for IDV if we have Passport, Driving Licence, Passport Card, National Identity Card, or Residence Permit
  if (shouldAutoSelectYes && idvYesBtn) {
    console.log('✅ Auto-selecting IDV YES button (suitable photo ID type found)');
    // Deselect all answer cards first
    document.querySelectorAll('[data-idv-answer]').forEach(card => {
      card.classList.remove('selected');
    });
    // Select YES
    idvYesBtn.classList.add('selected');
    checkState.includeIDV = true;
    
    // Show IDV content
    const idvContent = document.getElementById('idvContent');
    if (idvContent) {
      idvContent.classList.remove('hidden');
      console.log('✅ IDV content shown (will remain visible if IDV & Lite Screen is auto-selected)');
    }
  }
  
  // Populate image lists
  populateIDVImageLists(availableImages, selectedDocType);
  
  // Store images in global state
  checkState.availableIDVImages = availableImages;
}

/**
 * Populate IDV image lists and auto-select if possible
 */
function populateIDVImageLists(images, selectedDocType) {
  const idvFrontList = document.getElementById('idvFrontList');
  const idvBackList = document.getElementById('idvBackList');
  
  // Map document types to exact document names
  const documentTypeMap = {
    'passport': 'Passport',
    'driving_licence': 'Driving Licence',
    'national_identity_card': ['Passport Card', 'National Identity Card'],
    'residence_permit': 'Residence Permit',
    'unknown': 'Other Photo ID Card'
  };
  
  // Filter images by selected document type (exact match only)
  let filteredImages = images;
  let hasExactMatches = true;
  
  if (selectedDocType && documentTypeMap[selectedDocType]) {
    const expectedDocName = documentTypeMap[selectedDocType];
    
    // Handle both array and string document names
    if (Array.isArray(expectedDocName)) {
      filteredImages = images.filter(img => expectedDocName.includes(img.document));
      console.log(`🔍 Filtering images for ${selectedDocType} (${expectedDocName.join(' or ')}):`, filteredImages.length);
    } else {
      filteredImages = images.filter(img => img.document === expectedDocName);
      console.log(`🔍 Filtering images for ${selectedDocType} (${expectedDocName}):`, filteredImages.length);
    }
    
    // If no exact matches, show all images but don't auto-select
    if (filteredImages.length === 0) {
      console.log('⚠️ No exact matches found, showing all available images for manual selection');
      filteredImages = images;
      hasExactMatches = false;
    }
  }
  
  // Separate images by side (missing side tag = show in both columns)
  const singleImages = filteredImages.filter(img => img.side === 'Single' || !img.side);
  const frontImages = filteredImages.filter(img => img.side === 'Front' || !img.side);
  const backImages = filteredImages.filter(img => img.side === 'Back' || !img.side);
  
  // Populate front/single column
  if (idvFrontList) {
    idvFrontList.innerHTML = '';
    
    const frontAndSingleImages = [...new Set([...singleImages, ...frontImages])]; // Remove duplicates
    
    if (frontAndSingleImages.length === 0) {
      idvFrontList.innerHTML = '<div class="idv-no-images">No matching photo ID images</div>';
    } else {
      frontAndSingleImages.forEach(img => {
        const imageItem = createIDVImageItem(img, 'front');
        idvFrontList.appendChild(imageItem);
      });
      
      // Auto-select first matching image ONLY if we have exact type matches
      if (hasExactMatches) {
        const firstMatch = frontAndSingleImages[0];
        if (firstMatch) {
          selectIDVImage(firstMatch, 'front');
          console.log('✅ Auto-selected front/single image');
        }
      } else {
        console.log('⏸️ No exact matches - user must manually select image');
      }
    }
  }
  
  // Populate back column
  if (idvBackList) {
    idvBackList.innerHTML = '';
    
    if (backImages.length === 0) {
      idvBackList.innerHTML = '<div class="idv-no-images">No matching back photo ID images</div>';
    } else {
      backImages.forEach(img => {
        const imageItem = createIDVImageItem(img, 'back');
        idvBackList.appendChild(imageItem);
      });
      
      // Auto-select first matching image ONLY if we have exact type matches
      if (hasExactMatches) {
        const firstMatch = backImages[0];
        if (firstMatch) {
          selectIDVImage(firstMatch, 'back');
          console.log('✅ Auto-selected back image');
        }
      } else {
        console.log('⏸️ No exact matches - user must manually select back image');
      }
    }
  }
}

/**
 * Create an IDV image list item
 */
function createIDVImageItem(image, column) {
  const item = document.createElement('div');
  item.className = 'idv-image-item';
  item.dataset.imageName = image.name;
  item.dataset.imageUrl = image.url;
  item.dataset.documentType = image.document;
  item.dataset.side = image.side;
  
  // Only show side tag if it's "Front" or "Back" (not "Single")
  const sideTag = (image.side === 'Front' || image.side === 'Back') 
    ? `<div class="idv-image-item-side">${image.side}</div>` 
    : '';
  
  item.innerHTML = `
    <div class="idv-image-item-preview">
      <img src="${image.url}" alt="${image.document}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA4MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjRjVGNUY1Ii8+CjxwYXRoIGQ9Ik0zMCAyNUgyMEwzMCAyMHYxMHptMzAgMGgxMHYxMEg2MFYyNXptMCAzMEgyMlY0MEg2MFY1NXpNMzAgNjBIMjJ2LTEwaDEwdjEweiIgZmlsbD0iI0NDQ0NDQyIvPgo8L3N2Zz4='" />
    </div>
    <div class="idv-image-item-details">
      <div class="idv-image-item-type">${image.document}</div>
      ${sideTag}
      <div class="idv-image-item-date">${image.date}</div>
    </div>
  `;
  
  // Add click handler
  item.addEventListener('click', () => {
    selectIDVImage(image, column);
  });
  
  return item;
}

/**
 * Select an IDV image
 */
function selectIDVImage(image, column) {
  const prefix = column === 'front' ? 'idvFront' : 'idvBack';
  const selectedView = document.getElementById(`${prefix}Selected`);
  const listView = document.getElementById(`${prefix}List`);
  const preview = document.getElementById(`${prefix}Preview`);
  const type = document.getElementById(`${prefix}Type`);
  const side = document.getElementById(`${prefix}Side`);
  const uploadInfo = document.getElementById(`${prefix}UploadInfo`);
  
  // Update preview
  if (preview) preview.src = image.url;
  if (type) type.textContent = image.document;
  if (side) side.textContent = image.side;
  if (uploadInfo) uploadInfo.textContent = `Uploaded by ${image.uploader} on ${image.date}`;
  
  // Show selected view, hide list
  if (selectedView) selectedView.style.display = 'block';
  if (listView) listView.style.display = 'none';
  
  // Store in state
  checkState[`${column}Image`] = image;
  
  console.log(`✅ Selected ${column} image:`, image.name);
}

/**
 * Show IDV image list (hide selected view)
 */
function showIDVImageList(column) {
  const prefix = column === 'front' ? 'idvFront' : 'idvBack';
  const selectedView = document.getElementById(`${prefix}Selected`);
  const listView = document.getElementById(`${prefix}List`);
  
  if (selectedView) selectedView.style.display = 'none';
  if (listView) listView.style.display = 'block';
  
  console.log(`🔄 Showing ${column} image list`);
}

/**
 * Open IDV image in popup window
 */
function openIDVImage(column) {
  const image = checkState[`${column}Image`];
  if (!image) {
    console.warn(`No ${column} image selected`);
    return;
  }
  
  console.log(`👁️ Opening ${column} image:`, image.name);
  
  // Prepare data for single-image-viewer.html
  const imageData = {
    document: image.document,
    side: image.side,
    name: image.name,
    liveUrl: image.url,
    uploader: image.uploader,
    date: image.date
  };
  
  // Base64 encode the JSON data
  const jsonString = JSON.stringify(imageData);
  const base64Data = btoa(jsonString);
  
  // Construct URL with hash
  const viewerUrl = `single-image-viewer.html#${base64Data}`;
  
  // Open in popup window (800x600, centered)
  const width = 900;
  const height = 700;
  const left = (screen.width / 2) - (width / 2);
  const top = (screen.height / 2) - (height / 2);
  
  window.open(
    viewerUrl,
    'IDImageViewer',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,status=no,menubar=no,toolbar=no,location=no`
  );
}

/**
 * Configure Proof of Ownership checkbox based on matter category and subtype
 */
function configureElectronicIdOptions(category, subtype, workType, relation) {
  const proofOfOwnershipCard = document.getElementById('proofOfOwnershipCard');
  const proofOfOwnershipCheckbox = document.getElementById('proofOfOwnership');
  const esofQuestionnaireCard = document.getElementById('esofQuestionnaireCard');
  const esofQuestionnaireCheckbox = document.getElementById('esofQuestionnaire');
  const esowBankLinkingCard = document.getElementById('esowBankLinkingCard');
  const esowBankLinkingCheckbox = document.getElementById('esowBankLinking');
  
  console.log('🔍 Configuring Electronic ID options:', { category, subtype, workType, relation });
  
  // ===== PROOF OF OWNERSHIP =====
  let showPoO = false;
  let checkPoO = false;
  
  if (category === 'conveyancing') {
    if (subtype === 'seller') {
      showPoO = true;
      checkPoO = true; // Auto-check for sellers
    } else if (subtype === 'other') {
      showPoO = true;
      checkPoO = false; // Show but don't auto-check for "other"
    }
    // purchaser, giftor = HIDDEN (not shown)
  } else if (category === 'property-other') {
    if (subtype === 'seller' || subtype === 'landlord') {
      showPoO = true;
      checkPoO = true; // Auto-check for sellers and landlords
    } else if (subtype === 'tenant') {
      showPoO = true;
      
      // Auto-check for tenant/occupier if Equity Release or Re-mortgaging (they're the owner)
      if (workType) {
        const normalizedWorkType = workType.toLowerCase();
        if (normalizedWorkType.includes('equity release') || normalizedWorkType.includes('re-mortgaging')) {
          checkPoO = true; // They own the property even though classified as tenant/occupier
          console.log('✅ PoO auto-checked for tenant (Equity Release/Re-mortgaging - owner-occupier)');
        } else {
          checkPoO = false; // Standard tenant - don't auto-check
        }
      } else {
        checkPoO = false; // No work type - don't auto-check
      }
    }
    // purchaser = HIDDEN (not shown)
  } else if (category === 'other') {
    showPoO = true;
    checkPoO = false; // Show for "other" category
  }
  // private-client = hidden
  
  if (proofOfOwnershipCard) {
    if (showPoO) {
      proofOfOwnershipCard.classList.remove('hidden');
      if (proofOfOwnershipCheckbox) proofOfOwnershipCheckbox.checked = checkPoO;
      console.log(`✅ Proof of Ownership ${checkPoO ? 'shown and checked' : 'shown (unchecked)'} (${category}/${subtype})`);
    } else {
      proofOfOwnershipCard.classList.add('hidden');
      if (proofOfOwnershipCheckbox) proofOfOwnershipCheckbox.checked = false;
      console.log(`❌ Proof of Ownership hidden (${category}/${subtype || 'none'})`);
    }
  }
  
  // ===== eSoF QUESTIONNAIRE =====
  let showQuestionnaire = false;
  let checkQuestionnaire = false;
  
  // Get client data tags for conditional logic
  const clientData = checkState.clientData;
  // console.log('📊 Client data for tag detection:', { 
  //   uT: clientData?.uT, 
  //   eS: clientData?.eS, 
  //   hasClientData: !!clientData 
  // }); // Commented out to avoid logging client data
  const hasFormE = clientData?.uT && Array.isArray(clientData.uT) && clientData.uT.includes('formE');
  const hasEsofRequested = clientData?.eS && Array.isArray(clientData.eS) && clientData.eS.includes('Requested');
  
  // Determine visibility based on category/subtype
  if (category === 'conveyancing') {
    if (subtype === 'purchaser' || subtype === 'giftor' || subtype === 'other') {
      showQuestionnaire = true;
    }
    // seller = hidden
  } else if (category === 'property-other') {
    if (subtype === 'purchaser') {
      showQuestionnaire = true;
    }
    // seller, landlord, tenant = hidden
  }
  // private-client, other = hidden
  
  // Auto-check logic for Conveyancing Purchaser/Giftor
  if (showQuestionnaire && category === 'conveyancing' && (subtype === 'purchaser' || subtype === 'giftor')) {
    // Auto-check UNLESS we have formE tag without eSoF tag
    // Auto-check if: (no formE) OR (has eSoF) OR (has both) OR (has neither)
    // Don't auto-check if: (has formE AND no eSoF)
    const shouldNotAutoCheck = hasFormE && !hasEsofRequested;
    checkQuestionnaire = !shouldNotAutoCheck;
    
    if (!shouldNotAutoCheck) {
      console.log(`✅ Questionnaire auto-checked for ${subtype} (tags: formE=${hasFormE}, eSoF=${hasEsofRequested})`);
    } else {
      console.log(`⚠️ Questionnaire NOT auto-checked for ${subtype} (formE without eSoF)`);
    }
  } else if (showQuestionnaire && category === 'conveyancing' && subtype === 'other') {
    // For "other" subtype, use old logic based on work type and relation
    if (workType && relation) {
      const isPurchase = workType.toLowerCase().includes('purchase') || workType.toLowerCase().includes('auction');
      const isOurClientOrGiftor = relation === 'Our Client' || relation === 'Gifter';
      
      if (isPurchase && isOurClientOrGiftor) {
        checkQuestionnaire = true;
      }
    }
  } else if (showQuestionnaire && category === 'property-other' && subtype === 'purchaser') {
    // Property Other Purchaser - same logic as Conveyancing Purchaser/Giftor
    // Auto-check UNLESS we have formE tag without eSoF tag
    const shouldNotAutoCheck = hasFormE && !hasEsofRequested;
    checkQuestionnaire = !shouldNotAutoCheck;
    
    if (!shouldNotAutoCheck) {
      console.log(`✅ Questionnaire auto-checked for Property Other Purchaser (tags: formE=${hasFormE}, eSoF=${hasEsofRequested})`);
    } else {
      console.log(`⚠️ Questionnaire NOT auto-checked for Property Other Purchaser (formE without eSoF)`);
    }
  }
  
  if (esofQuestionnaireCard) {
    if (showQuestionnaire) {
      esofQuestionnaireCard.classList.remove('hidden');
      if (esofQuestionnaireCheckbox) esofQuestionnaireCheckbox.checked = checkQuestionnaire;
      console.log(`✅ eSoF Questionnaire ${checkQuestionnaire ? 'shown and checked' : 'shown (unchecked)'} (${category}/${subtype})`);
    } else {
      esofQuestionnaireCard.classList.add('hidden');
      if (esofQuestionnaireCheckbox) esofQuestionnaireCheckbox.checked = false;
      console.log(`❌ eSoF Questionnaire hidden (${category}/${subtype || 'none'})`);
    }
  }
  
  // ===== eSoW BANK LINKING =====
  let showBankLinking = false;
  let checkBankLinking = false;
  
  // Determine visibility - always show for all subtypes in all categories
  if (category === 'conveyancing' || category === 'property-other' || category === 'private-client' || category === 'other') {
    showBankLinking = true;
  }
  
  // Auto-check logic for Conveyancing Purchaser/Giftor
  if (showBankLinking && category === 'conveyancing' && (subtype === 'purchaser' || subtype === 'giftor')) {
    // Auto-check UNLESS we have formE tag without eSoF tag
    const shouldNotAutoCheck = hasFormE && !hasEsofRequested;
    checkBankLinking = !shouldNotAutoCheck;
    
    if (!shouldNotAutoCheck) {
      console.log(`✅ Bank Linking auto-checked for ${subtype} (tags: formE=${hasFormE}, eSoF=${hasEsofRequested})`);
    } else {
      console.log(`⚠️ Bank Linking NOT auto-checked for ${subtype} (formE without eSoF)`);
    }
  } else if (showBankLinking && category === 'conveyancing' && subtype === 'other') {
    // For "other" subtype, use old logic based on work type and relation
    if (workType && relation) {
      const isPurchase = workType.toLowerCase().includes('purchase') || workType.toLowerCase().includes('auction');
      const isOurClientOrGiftor = relation === 'Our Client' || relation === 'Gifter';
      
      if (isPurchase && isOurClientOrGiftor) {
        checkBankLinking = true;
      }
    }
  } else if (showBankLinking && category === 'property-other' && subtype === 'purchaser') {
    // Property Other Purchaser - same logic as Conveyancing Purchaser/Giftor
    // Auto-check UNLESS we have formE tag without eSoF tag
    const shouldNotAutoCheck = hasFormE && !hasEsofRequested;
    checkBankLinking = !shouldNotAutoCheck;
    
    if (!shouldNotAutoCheck) {
      console.log(`✅ Bank Linking auto-checked for Property Other Purchaser (tags: formE=${hasFormE}, eSoF=${hasEsofRequested})`);
    } else {
      console.log(`⚠️ Bank Linking NOT auto-checked for Property Other Purchaser (formE without eSoF)`);
    }
  }
  
  if (esowBankLinkingCard) {
    if (showBankLinking) {
      esowBankLinkingCard.classList.remove('hidden');
      if (esowBankLinkingCheckbox) esowBankLinkingCheckbox.checked = checkBankLinking;
      console.log(`✅ eSoW Bank Linking ${checkBankLinking ? 'shown and checked' : 'shown (unchecked)'} (${category}/${subtype})`);
    } else {
      esowBankLinkingCard.classList.add('hidden');
      if (esowBankLinkingCheckbox) esowBankLinkingCheckbox.checked = false;
      console.log(`❌ eSoW Bank Linking hidden (${category}/${subtype || 'none'})`);
    }
  }
}

/**
 * Legacy function - redirects to comprehensive configuration
 * @deprecated Use configureElectronicIdOptions instead
 */
function configureProofOfOwnership(category, subtype) {
  configureElectronicIdOptions(category, subtype, checkState.clientData?.wT, checkState.clientData?.r);
}

/**
 * Legacy function - Electronic ID checkboxes are now configured by configureElectronicIdOptions
 * This function is kept for backwards compatibility but does minimal work
 * @deprecated Use configureElectronicIdOptions instead
 */
function configureElectronicIdCheckboxes(data) {
  // All checkbox configuration is now handled by configureElectronicIdOptions
  // when matter category and subtype are selected
  // This function is called during initial data load before category/subtype selection
  
  console.log('🔍 Electronic ID checkboxes will be configured when matter category/subtype is selected');
}

/**
 * Populate client data into the form
 */
function populateClientData(data) {
  // console.log('Populating client data:', data); // Commented out to avoid logging client data
  
  // Reset PEP monitoring initialization flag for new client data
  checkState.pepMonitoringInitialized = false;
  
  // ===== HEADER - Client Details (cD) =====
  if (data.cD) {
    const clientNumberBadge = document.getElementById('clientMatterNumber');
    const clientNameElement = document.getElementById('clientName');
    const titleBadge = document.querySelector('#titleBadge span');
    
    // Client/Matter Number (e.g., "12345/67")
    if (clientNumberBadge && (data.cD.cN || data.cD.mN)) {
      const displayNumber = data.cD.mN ? `${data.cD.cN}/${data.cD.mN}` : data.cD.cN;
      clientNumberBadge.textContent = displayNumber;
    }
    
    // Client Name
    if (clientNameElement && data.cD.n) {
      clientNameElement.textContent = data.cD.n;
    }
    
    // FE Tag
    if (titleBadge && data.cD.fe) {
      titleBadge.textContent = data.cD.fe;
    }
  }
  
  // ===== HEADER - Icons (i) =====
  if (data.i) {
    const headerRight = document.querySelector('.header-right');
    const addressIcon = document.getElementById('addressIcon');
    const photoIcon = document.getElementById('photoIcon');
    const liknessIcon = document.getElementById('liknessIcon');
    
    let showHeaderRight = false;
    
    // Address ID Icon
    if (data.i.a && addressIcon) {
      addressIcon.classList.remove('hidden');
      showHeaderRight = true;
    }
    
    // Photo ID Icon
    if (data.i.p && photoIcon) {
      photoIcon.classList.remove('hidden');
      showHeaderRight = true;
    }
    
    // Likeness Confirmed Icon (show if likenessNOTConfirmed is false/undefined AND photo ID is taken)
    if ((data.i.l === false || data.i.l === undefined) && data.i.p && liknessIcon) {
      liknessIcon.classList.remove('hidden');
      showHeaderRight = true;
    }
    
    // Show header-right container if any icons are visible
    if (showHeaderRight && headerRight) {
      headerRight.classList.remove('hidden');
    }
  }
  
  // ===== HEADER - Request Type Tags (uT and eS) =====
  const requestTagsContainer = document.getElementById('requestTagsContainer');
  const formJTag = document.getElementById('formJTag');
  const formETag = document.getElementById('formETag');
  const formKTag = document.getElementById('formKTag');
  const esofTag = document.getElementById('esofTag');
  
  let showTags = false;
  
  // Update Tags (formJ, formE, formK)
  if (data.uT && Array.isArray(data.uT)) {
    if (data.uT.includes('formJ') && formJTag) {
      formJTag.classList.remove('hidden');
      showTags = true;
    } else if (formJTag) {
      formJTag.classList.add('hidden');
    }
    
    if (data.uT.includes('formE') && formETag) {
      formETag.classList.remove('hidden');
      showTags = true;
    } else if (formETag) {
      formETag.classList.add('hidden');
    }
    
    if (data.uT.includes('formK') && formKTag) {
      formKTag.classList.remove('hidden');
      showTags = true;
    } else if (formKTag) {
      formKTag.classList.add('hidden');
    }
  }
  
  // eSoF Tag
  if (data.eS && Array.isArray(data.eS)) {
    if (data.eS.includes('Requested') && esofTag) {
      esofTag.classList.remove('hidden');
      showTags = true;
    } else if (esofTag) {
      esofTag.classList.add('hidden');
    }
  }
  
  // Show tags container if any tags are visible
  if (showTags && requestTagsContainer) {
    requestTagsContainer.classList.remove('hidden');
  }
  
  // ===== HEADER - Latest Message (lM) =====
  if (data.lM) {
    populateLatestMessage(data.lM);
  }
  
  // ===== HEADER - Matter Details Card =====
  const matterDetailsCard = document.getElementById('matterDetailsCard');
  const matterWorkTypeElement = document.getElementById('matterWorkType');
  const matterDescriptionElement = document.getElementById('matterDescription');
  const matterRelationElement = document.getElementById('matterRelation');
  
  if (matterDetailsCard && (data.wT || data.mD || data.r)) {
    // Show the card
    matterDetailsCard.classList.remove('hidden');
    
    // Populate work type
    if (matterWorkTypeElement) {
      matterWorkTypeElement.textContent = data.wT || '—';
    }
    
    // Populate matter description
    if (matterDescriptionElement) {
      matterDescriptionElement.textContent = data.mD || '—';
    }
    
    // Populate relation
    if (matterRelationElement) {
      matterRelationElement.textContent = data.r || '—';
    }
    
    // console.log('✅ Populated matter details card:', { wT: data.wT, mD: data.mD, r: data.r }); // Commented out to avoid logging client data
  }
  
  // ===== Check Reference =====
  const checkReferenceInput = document.getElementById('checkReference');
  if (checkReferenceInput) {
    // Use client/matter number as reference (e.g., "50/52")
    if (data.cD && (data.cD.cN || data.cD.mN)) {
      const reference = data.cD.mN ? `${data.cD.cN}/${data.cD.mN}` : `${data.cD.cN}`;
      checkReferenceInput.value = reference;
      checkState.checkReference = reference;
    }
    // Fallback to mD if no client/matter number
    else if (data.mD) {
      checkReferenceInput.value = data.mD;
      checkState.checkReference = data.mD;
    }
  }
  
  // ===== Populate ALL sections with client data (cI) =====
  // This prepares all sections regardless of which check type is selected
  if (data.cI) {
    populateLiteScreenFields(data);
    populateIDVFields(data);
    populateElectronicIdFields(data);
    // KYB fields populated separately in autoPopulateKYBSection
  }
  
  // ===== Auto-configure Electronic ID checkboxes based on tags =====
  configureElectronicIdCheckboxes(data);
  
  // ===== Enable/Disable Check Types based on entity type =====
  updateCheckTypeAvailability(data);
  
  // ===== Auto-populate KYB section for businesses =====
  if (data.b === true || data.cI?.eT === 'business') {
    autoPopulateKYBSection(data);
  }
  
  // ===== Check and populate IDV images =====
  checkAndPopulateIDVImages(data);
  
  // ===== Auto-select check type for individuals =====
  if (!data.b && !data.c) {
    const hasFormJ = data.uT && Array.isArray(data.uT) && data.uT.includes('formJ');
    const hasFormK = data.uT && Array.isArray(data.uT) && data.uT.includes('formK');
    const hasFormE = data.uT && Array.isArray(data.uT) && data.uT.includes('formE');
    const hasEsofRequested = data.eS && Array.isArray(data.eS) && data.eS.includes('Requested');
    const hasIDDocuments = data.i && data.i.a && data.i.p && (data.i.l === false || data.i.l === undefined);
    const hasNoTags = !data.uT || data.uT.length === 0;
    
    // Auto-select Electronic ID for formE or eSoF routes
    if (hasFormE || hasEsofRequested) {
      console.log('✅ Auto-selecting Electronic ID based on client data (formE/eSoF)');
      autoSelectElectronicId();
    }
    // Auto-select IDV & Lite Screen for formJ/formK routes
    else {
      const shouldAutoSelectIDV = (
        hasFormJ ||  // formJ always triggers (even if no ID docs yet)
        (hasFormK && hasIDDocuments) ||  // formK + ID docs
        (hasNoTags && hasIDDocuments)  // No tags + ID docs
      );
      
      if (shouldAutoSelectIDV) {
        console.log('✅ Auto-selecting IDV & Lite Screen based on client data');
        autoSelectIDVLiteScreen();
      }
    }
  }
}

/**
 * Populate latest message card (lM)
 */
function populateLatestMessage(message) {
  const latestMessageCard = document.getElementById('latestMessageCard');
  const messageSender = document.getElementById('messageSender');
  const messageTimestamp = document.getElementById('messageTimestamp');
  const messageTextElement = document.getElementById('messageText');
  
  if (!latestMessageCard) return;
  
  // Show message card
  latestMessageCard.classList.remove('hidden');
  
  // Populate message details
  if (messageSender && message.user) {
    messageSender.textContent = message.user;
  }
  
  if (messageTimestamp && message.time) {
    messageTimestamp.textContent = message.time;
  }
  
  if (messageTextElement && message.message) {
    messageTextElement.textContent = message.message;
  }
}

/**
 * Auto-populate KYB section with business data from Companies House
 * Checks if bD has Companies House format, auto-fills jurisdiction, company name, and entity number
 * Triggers auto-search if sufficient data is available
 */
function autoPopulateKYBSection(data) {
  // console.log('Auto-populating KYB section with business data:', data); // Commented out to avoid logging client data
  
  const jurisdictionInput = document.getElementById('kybJurisdiction');
  const companyNameInput = document.getElementById('kybCompanyName');
  const companyNumberInput = document.getElementById('kybCompanyNumber');
  
  if (!jurisdictionInput || !companyNameInput || !companyNumberInput) {
    console.warn('KYB inputs not found, skipping auto-population');
    return;
  }
  
  let jurisdictionCode = null;
  let companyName = null;
  let entityNumber = null;
  let shouldAutoSearch = false;
  
  // Check if we have Companies House data (bD with expected format)
  // Check both data.bD and data.cI.bD locations
  const businessData = data.bD || data.cI?.bD || null;
  const hasCompaniesHouseData = businessData && typeof businessData === 'object' && (
    businessData.company_number || 
    businessData.officers || 
    businessData.pscs || 
    businessData.registered_office_address
  );
  
  if (hasCompaniesHouseData) {
    // We have Companies House data - it's definitely UK
    console.log('✅ Companies House data detected - setting jurisdiction to UK');
    jurisdictionCode = 'GB';
    
    // Extract company number from Companies House data or cI
    entityNumber = businessData.company_number || data.cI?.eN || null;
    
    // Extract company name from Companies House data or cI
    companyName = businessData.company_name || data.cI?.n?.b || null;
    
    // Auto-search if we have entity number or company name
    if (entityNumber || companyName) {
      shouldAutoSearch = true;
    }
  } else {
    // No Companies House data - check for manual business data
    console.log('ℹ️ No Companies House data - checking for manual business data');
    
    // Check cI for business details
    if (data.cI) {
      entityNumber = data.cI.eN || null;
      companyName = data.cI.n?.b || null;
      
      // Check registration country
      if (data.cI.rC) {
        jurisdictionCode = data.cI.rC;
        console.log(`ℹ️ Registration country from cI: ${jurisdictionCode}`);
      }
    }
    
    // Only auto-search if we have both jurisdiction and (entity number or company name)
    if (jurisdictionCode && (entityNumber || companyName)) {
      shouldAutoSearch = true;
    }
  }
  
  // Populate jurisdiction if we know it
  if (jurisdictionCode && typeof setJurisdiction === 'function') {
    setJurisdiction('kybJurisdiction', jurisdictionCode);
    checkState.kybJurisdiction = jurisdictionCode;
    console.log(`📍 Set KYB jurisdiction to: ${jurisdictionCode}`);
  }
  
  // Populate company name if we have it
  if (companyName) {
    companyNameInput.value = companyName;
    console.log(`🏢 Set company name to: ${companyName}`);
  }
  
  // Populate entity number if we have it
  if (entityNumber) {
    companyNumberInput.value = entityNumber;
    console.log(`##️⃣ Set entity number to: ${entityNumber}`);
  }
  
  // Auto-trigger search if we have sufficient data
  if (shouldAutoSearch && jurisdictionCode) {
    console.log('🔍 Auto-triggering KYB search...');
    
    // Wait a moment for UI to settle, then trigger search
    setTimeout(() => {
      // Prefer searching by entity number if available
      if (entityNumber) {
        console.log(`📡 Auto-searching by entity number: ${entityNumber}`);
        performKYBSearch(jurisdictionCode, '', entityNumber);
      } else if (companyName) {
        console.log(`📡 Auto-searching by company name: ${companyName}`);
        performKYBSearch(jurisdictionCode, companyName, '');
      }
    }, 500);
  } else {
    console.log('⏸️ Not auto-searching - insufficient data or unknown jurisdiction');
  }
}

/**
 * Auto-select matter category based on work type
 */
function autoSelectMatterCategory(workType) {
  if (!workType) return;
  
  // Get relation for intelligent routing
  const relation = checkState.clientData?.r;
  
  // ===== RELATION-BASED OVERRIDE =====
  // If relation is Tenant, Occupier, or Landlord, always route to Property Other
  // This overrides work type mapping (e.g., "Purchase" + "Tenant" → Property Other, not Conveyancing)
  const propertyOtherRelations = ['Tenant', 'Occupier', 'Leaseholder', 'Freeholder', 'Landlord'];
  
  if (relation && propertyOtherRelations.includes(relation)) {
    console.log(`✅ Relation "${relation}" detected → Routing to Property Other (overrides work type)`);
    const categoryCard = document.querySelector('.matter-category-card[data-category="property-other"]');
    
    if (categoryCard) {
      // Deselect all category cards
      document.querySelectorAll('.matter-category-card').forEach(c => {
        c.classList.remove('selected');
      });
      
      // Select Property Other
      categoryCard.classList.add('selected');
      checkState.matterCategory = 'property-other';
      
      // Show property other subtypes
      const propertyOtherSubCategory = document.getElementById('propertyOtherSubCategory');
      if (propertyOtherSubCategory) propertyOtherSubCategory.style.display = 'block';
      
      // Auto-select subtype based on relation and work type
      autoSelectPropertyOtherSubtype(relation, workType);
      
      return; // Exit early - relation-based routing complete
    }
  }
  
  // ===== WORK TYPE-BASED ROUTING (Standard Logic) =====
  // Define work type to category mapping
  const categoryMapping = {
    // Conveyancing (standard property transactions)
    'Purchase': 'conveyancing',
    'Sale': 'conveyancing',
    'Transfer': 'conveyancing',
    'Auction Sale': 'conveyancing',
    
    // Property Other (property-related, non-standard)
    'Lease': 'property-other',
    'Equity Release': 'property-other',
    'Re-mortgaging': 'property-other',
    'Adverse Possession': 'property-other',
    '1st Registration': 'property-other',
    'Assents': 'property-other',
    
    // Private Client (personal legal matters)
    'Wills': 'private-client',
    'Lasting Powers of Attorney': 'private-client',
    'Probate': 'private-client',
    'Estates': 'private-client',
    'Deeds & Declarations': 'private-client'
    
    // Note: Unrecognized work types are left blank for manual user selection
  };
  
  // Normalize work type (remove "of" suffix if present)
  let normalizedWorkType = workType.trim();
  if (normalizedWorkType.endsWith(' of')) {
    normalizedWorkType = normalizedWorkType.slice(0, -3);
  }
  
  const category = categoryMapping[normalizedWorkType];
  
  if (!category) {
    console.log('⚠️ Unrecognized work type - user must select category manually:', workType);
    return;
  }
  
  // Find and select the category card
  const categoryCard = document.querySelector(`.matter-category-card[data-category="${category}"]`);
  if (!categoryCard) {
    console.warn('Category card not found:', category);
    return;
  }
  
  // Deselect all category cards
  document.querySelectorAll('.matter-category-card').forEach(c => {
    c.classList.remove('selected');
  });
  
  // Select the matched category
  categoryCard.classList.add('selected');
  checkState.matterCategory = category;
  
  console.log('✅ Auto-selected matter category:', category, 'for work type:', normalizedWorkType);
  
  // Handle sub-categories and Electronic ID section display
  const conveyancingSubCategory = document.getElementById('conveyancingSubCategory');
  const propertyOtherSubCategory = document.getElementById('propertyOtherSubCategory');
  
  // Hide all sub-categories first
  if (conveyancingSubCategory) conveyancingSubCategory.style.display = 'none';
  if (propertyOtherSubCategory) propertyOtherSubCategory.style.display = 'none';
  
  if (category === 'conveyancing') {
    // Show conveyancing subtypes
    if (conveyancingSubCategory) conveyancingSubCategory.style.display = 'block';
    
    // Auto-select subtype based on relation and work type (use normalized work type)
    autoSelectConveyancingSubtype(normalizedWorkType, checkState.clientData?.r);
  } else if (category === 'property-other') {
    // Show property other subtypes
    if (propertyOtherSubCategory) propertyOtherSubCategory.style.display = 'block';
    
    // Auto-select subtype based on relation and work type
    autoSelectPropertyOtherSubtype(checkState.clientData?.r, checkState.clientData?.wT);
  } else if (category === 'private-client' || category === 'other') {
    // Show Electronic ID section directly
    if (checkState.checkType === 'electronic-id') {
      showSection('electronicIdSection');
      updateElectronicIdReferenceLabel(category);
      populateElectronicIdReference(category);
      configureProofOfOwnership(category, null); // No subtypes for Private Client/Other
      console.log('✅ Showing Electronic ID section (Private Client/Other auto-selected)');
    }
  }
}

/**
 * Auto-select conveyancing subtype based on work type and relation
 */
function autoSelectConveyancingSubtype(workType, relation) {
  if (!relation) return;
  
  // Map relations to conveyancing subtypes
  const relationMapping = {
    'Our Client': null, // Could be seller or purchaser, need work type
    'Gifter': 'giftor',
    'Executor': 'other',
    'Beneficiary': 'other',
    'Occupier': 'other',
    'Leaseholder': 'other',
    'Freeholder': 'other',
    'Tenant': 'other',
    'Other': 'other'
  };
  
  let subtype = relationMapping[relation];
  
  // For "Our Client", determine from work type
  if (relation === 'Our Client' && workType) {
    if (workType === 'Purchase' || workType === 'Auction Sale') {
      subtype = 'purchaser';
    } else if (workType === 'Sale') {
      subtype = 'seller';
    } else {
      subtype = 'other'; // Transfer, etc.
    }
  }
  
  if (!subtype) {
    console.log('⏸️ Could not determine conveyancing subtype - user must select');
    return;
  }
  
  // Find and select the subtype card within conveyancing subtypes
  const subtypeCard = document.querySelector(`#conveyancingSubCategory .matter-sub-card[data-sub-category="${subtype}"]`);
  if (subtypeCard) {
    document.querySelectorAll('#conveyancingSubCategory .matter-sub-card').forEach(c => {
      c.classList.remove('selected');
    });
    subtypeCard.classList.add('selected');
    checkState.matterSubCategory = subtype;
    console.log('✅ Auto-selected conveyancing subtype:', subtype);
    
    // Show Electronic ID section and configure Proof of Ownership
    if (checkState.checkType === 'electronic-id') {
      showSection('electronicIdSection');
      updateElectronicIdReferenceLabel('conveyancing');
      populateElectronicIdReference('conveyancing');
      configureProofOfOwnership('conveyancing', subtype);
    }
  }
}

/**
 * Auto-select property other subtype based on relation
 */
function autoSelectPropertyOtherSubtype(relation, workType) {
  if (!relation) return;
  
  let subtype = null;
  
  // Map relations to property other subtypes
  const relationMapping = {
    'Our Client': null, // Determined by work type below
    'Gifter': 'seller',
    'Executor': 'seller',
    'Beneficiary': 'purchaser',
    'Occupier': 'tenant',
    'Leaseholder': 'tenant',
    'Freeholder': 'landlord',
    'Tenant': 'tenant',
    'Other': null // User must choose
  };
  
  subtype = relationMapping[relation];
  
  // Special handling for "Our Client" based on work type
  if (relation === 'Our Client' && workType) {
    const normalizedWorkType = workType.toLowerCase();
    
    if (normalizedWorkType.includes('equity release') || normalizedWorkType.includes('re-mortgaging')) {
      // Equity Release / Re-mortgaging = they own/occupy but aren't selling
      subtype = 'tenant';
      console.log('✅ Our Client with Equity Release/Re-mortgaging → Tenant/Occupier (owner-occupier)');
    } else if (normalizedWorkType.includes('purchase')) {
      // Purchase = they're buying
      subtype = 'purchaser';
      console.log('✅ Our Client with Purchase → Purchaser');
    } else if (normalizedWorkType.includes('lease')) {
      // Leasing
      subtype = 'tenant';
      console.log('✅ Our Client with Lease → Tenant');
    }
    // Other work types for "Our Client" fall through to user selection
  }
  
  // Special handling for "Occupier" with Purchase
  if (relation === 'Occupier' && workType) {
    const normalizedWorkType = workType.toLowerCase();
    if (normalizedWorkType.includes('purchase')) {
      // Current occupier purchasing (e.g., tenant buying their rental)
      subtype = 'tenant';
      console.log('✅ Occupier with Purchase → Tenant/Occupier (current occupier buying)');
    }
  }
  
  if (!subtype) {
    console.log('⏸️ Could not determine property other subtype - user must select');
    return;
  }
  
  // Find and select the subtype card within property other subtypes
  const subtypeCard = document.querySelector(`#propertyOtherSubCategory .matter-sub-card[data-sub-category="${subtype}"]`);
  if (subtypeCard) {
    document.querySelectorAll('#propertyOtherSubCategory .matter-sub-card').forEach(c => {
      c.classList.remove('selected');
    });
    subtypeCard.classList.add('selected');
    checkState.matterSubCategory = subtype;
    console.log('✅ Auto-selected property other subtype:', subtype);
    
    // Show Electronic ID section and configure Proof of Ownership
    if (checkState.checkType === 'electronic-id') {
      showSection('electronicIdSection');
      updateElectronicIdReferenceLabel('property-other');
      populateElectronicIdReference('property-other');
      configureProofOfOwnership('property-other', subtype);
    }
  }
}

/**
 * Auto-select Electronic ID check type and show Matter Category
 */
function autoSelectElectronicId() {
  const electronicIdBtn = document.querySelector('.check-type-card[data-check-type="electronic-id"]');
  const matterCategorySection = document.getElementById('matterCategorySection');
  
  if (!electronicIdBtn) {
    console.warn('Electronic ID button not found');
    return;
  }
  
  // Select the Electronic ID button
  document.querySelectorAll('.check-type-card').forEach(c => {
    c.classList.remove('selected');
  });
  electronicIdBtn.classList.add('selected');
  
  // Update state
  checkState.checkType = 'electronic-id';
  
  // Determine if this is Enhanced ID or Additional Tasks Only
  const data = checkState.clientData;
  const hasFormE = data?.uT && Array.isArray(data.uT) && data.uT.includes('formE');
  const hasEsofRequested = data?.eS && Array.isArray(data.eS) && data.eS.includes('Requested');
  
  // Auto-select Electronic ID type
  if (!hasFormE && hasEsofRequested) {
    // eSoF only (no Form E) = Additional Tasks Only
    checkState.electronicIdType = 'additional-only';
    const additionalOnlyCard = document.querySelector('[data-eid-type="additional-only"]');
    const standardCard = document.querySelector('[data-eid-type="standard"]');
    
    if (additionalOnlyCard && standardCard) {
      standardCard.classList.remove('selected');
      additionalOnlyCard.classList.add('selected');
      console.log('✅ Auto-selected Additional Tasks Only (eSoF without Form E)');
    }
  } else {
    // Form E (with or without eSoF) = Standard ID
    checkState.electronicIdType = 'standard';
    console.log('✅ Standard ID selected (default or Form E)');
  }
  
  // Show Matter Category section
  if (matterCategorySection) {
    matterCategorySection.classList.remove('hidden');
    console.log('✅ Matter Category section shown');
  }
  
  // Show/hide PEP Monitoring based on Electronic ID type
  const monitoringCard = document.getElementById('monitoringCard');
  const monitoringCheckbox = document.getElementById('ongoingMonitoring');
  
  if (monitoringCard) {
    if (checkState.electronicIdType === 'standard') {
      // Standard ID includes screening - show and check PEP monitoring
      monitoringCard.classList.remove('hidden');
      if (monitoringCheckbox) monitoringCheckbox.checked = true;
      console.log('✅ PEP Monitoring shown and checked (Electronic ID - Standard ID)');
    } else if (checkState.electronicIdType === 'additional-only') {
      // Additional Tasks Only = no screening = hide PEP monitoring
      monitoringCard.classList.add('hidden');
      if (monitoringCheckbox) monitoringCheckbox.checked = false;
      console.log('❌ PEP Monitoring hidden (Electronic ID - Additional Tasks Only)');
    }
  }
  
  // Auto-select matter category based on work type
  const workType = checkState.clientData?.wT;
  if (workType) {
    autoSelectMatterCategory(workType);
  }
  
  // Show check reference section
  showSection('checkReferenceSection');
  
  console.log('✅ Auto-selected Electronic ID check type');
}

/**
 * Auto-select IDV & Lite Screen check type and show both sections
 * Lite Screen defaults to YES (content shown), IDV has no default (content hidden)
 */
function autoSelectIDVLiteScreen() {
  const idvLiteBtn = document.querySelector('.check-type-card[data-check-type="idv-lite"]');
  const liteScreenSection = document.getElementById('liteScreenSection');
  const idvSection = document.getElementById('idvSection');
  
  if (!idvLiteBtn) {
    console.warn('IDV & Lite Screen button not found');
    return;
  }
  
  // Select the IDV & Lite Screen button
  document.querySelectorAll('.check-type-card').forEach(c => {
    c.classList.remove('selected');
  });
  idvLiteBtn.classList.add('selected');
  
  // Check if IDV was already auto-selected by image check
  const idvYesBtn = document.querySelector('[data-idv-answer="yes"]');
  const idvAlreadyAutoSelected = idvYesBtn && idvYesBtn.classList.contains('selected');
  
  // Update state
  checkState.checkType = 'idv-lite';
  checkState.includeLiteScreen = true; // Default YES
  
  // Only reset includeIDV if it wasn't already auto-selected
  if (!idvAlreadyAutoSelected) {
    checkState.includeIDV = null; // No default - user must choose
  } else {
    // Preserve the auto-selected state
    checkState.includeIDV = true;
    console.log('ℹ️ IDV already auto-selected by image check, preserving includeIDV = true');
  }
  
  // Show both lite screen and IDV sections
  if (liteScreenSection) {
    liteScreenSection.classList.remove('hidden');
    console.log('✅ Lite Screen section shown (YES by default)');
  }
  
  if (idvSection) {
    idvSection.classList.remove('hidden');
    console.log('✅ IDV section shown (no default)');
  }
  
  // Lite Screen content shown by default (YES is selected in HTML)
  const liteContent = document.getElementById('liteScreenContent');
  if (liteContent) {
    liteContent.classList.remove('hidden');
  }
  
  // IDV content: Only hide if IDV YES wasn't already auto-selected
  const idvContent = document.getElementById('idvContent');
  
  if (idvContent && !idvAlreadyAutoSelected) {
    // Hide content if YES wasn't already auto-selected
    idvContent.classList.add('hidden');
  } else if (idvAlreadyAutoSelected) {
    // Keep content visible
    console.log('ℹ️ IDV YES already auto-selected by image check, keeping content visible');
  }
  
  // Show PEP Monitoring card (Lite Screen defaults to YES)
  const monitoringCard = document.getElementById('monitoringCard');
  const monitoringCheckbox = document.getElementById('ongoingMonitoring');
  
  if (monitoringCard) {
    monitoringCard.classList.remove('hidden');
    
    // Auto-check the checkbox ONLY on first show after data load
    if (monitoringCheckbox && !checkState.pepMonitoringInitialized) {
      monitoringCheckbox.checked = true;
      checkState.pepMonitoringInitialized = true;
      console.log('✅ PEP Monitoring card shown and auto-checked (first time)');
    } else {
      console.log('✅ PEP Monitoring card shown (preserving user choice)');
    }
  }
  
  // Show check reference section
  showSection('checkReferenceSection');
  
  console.log('✅ Auto-selected IDV & Lite Screen check type');
}

/**
 * Populate Lite Screen fields with client data
 * Fills name, DOB, address, and shows/hides sections based on data
 */
function populateLiteScreenFields(data) {
  // console.log('Populating Lite Screen fields with client data:', data); // Commented out to avoid logging client data
  
  if (!data.cI) {
    console.warn('No client information (cI) available');
    return;
  }
  
  // ===== Name Inputs =====
  if (data.cI.n) {
    const firstNameInput = document.getElementById('liteFirstName');
    const middleNameInput = document.getElementById('liteMiddleName');
    const lastNameInput = document.getElementById('liteLastName');
    
    if (firstNameInput && data.cI.n.f) {
      firstNameInput.value = data.cI.n.f;
      // console.log('✅ Populated first name:', data.cI.n.f); // Commented out to avoid logging client data
    }
    
    if (middleNameInput && data.cI.n.m) {
      middleNameInput.value = data.cI.n.m;
      // console.log('✅ Populated middle name:', data.cI.n.m); // Commented out to avoid logging client data
    }
    
    if (lastNameInput && data.cI.n.l) {
      lastNameInput.value = data.cI.n.l;
      // console.log('✅ Populated last name:', data.cI.n.l); // Commented out to avoid logging client data
    }
  }
  
  // ===== Date of Birth =====
  if (data.cI.b && typeof data.cI.b === 'string') {
    // Strip all non-digit characters (handles both 'dd-mm-yyyy' and 'ddmmyyyy')
    const digits = data.cI.b.replace(/[^0-9]/g, '').slice(0, 8).split('');
    
    const dobInputs = [
      document.getElementById('liteDob1'),
      document.getElementById('liteDob2'),
      document.getElementById('liteDob3'),
      document.getElementById('liteDob4'),
      document.getElementById('liteDob5'),
      document.getElementById('liteDob6'),
      document.getElementById('liteDob7'),
      document.getElementById('liteDob8')
    ];
    
    dobInputs.forEach((input, i) => {
      if (input && digits[i]) {
        input.value = digits[i];
      }
    });
    
    // console.log('✅ Populated date of birth:', data.cI.b); // Commented out to avoid logging client data
  }
  
  // ===== Current Address =====
  const currentAddressCard = document.getElementById('liteCurrentAddressCard');
  const currentAddressText = document.getElementById('liteCurrentAddressText');
  
  if (data.cI.a && typeof data.cI.a === 'object') {
    // Store current address object
    liteCurrentAddressObject = data.cI.a;
    
    // Update current address card display
    if (currentAddressText) {
      currentAddressText.textContent = formatAddressForCard(liteCurrentAddressObject);
    }
    if (currentAddressCard) {
      currentAddressCard.classList.remove('hidden');
    }
    
    // Load into manual fields (current address is default)
    liteActiveAddressType = 'current';
    loadAddressIntoManualFields(liteCurrentAddressObject, 'lite');
    
    // Show manual address fields
    const liteManualAddressFields = document.getElementById('liteManualAddressFields');
    if (liteManualAddressFields) {
      liteManualAddressFields.classList.remove('hidden');
      
      // Validate after a brief delay to ensure DOM is updated
      setTimeout(() => {
        validateLiteManualAddress();
      }, 100);
    }
    
    console.log('✅ Populated current address');
  } else {
    // No current address - hide the card
    if (currentAddressCard) {
      currentAddressCard.classList.add('hidden');
    }
  }
  
  // ===== Previous Address =====
  if (data.cI.pA && typeof data.cI.pA === 'object') {
    // Store previous address object
    litePreviousAddressObject = data.cI.pA;
    
    // Update previous address card display
    const previousAddressText = document.getElementById('litePreviousAddressText');
    const previousAddressCard = document.getElementById('litePreviousAddressCard');
    if (previousAddressText) {
      previousAddressText.textContent = formatAddressForCard(litePreviousAddressObject);
    }
    if (previousAddressCard) {
      previousAddressCard.classList.remove('hidden');
    }
    
    console.log('✅ Stored previous address');
  } else {
    // No previous address - hide the card
    const previousAddressCard = document.getElementById('litePreviousAddressCard');
    if (previousAddressCard) {
      previousAddressCard.classList.add('hidden');
    }
  }
  
  // Update address card states
  updateLiteAddressCardStates();
  
  // ===== Previous/Known as Name Hint =====
  const previousNameHint = document.getElementById('litePreviousNameHint');
  if (previousNameHint) {
    if (data.cI.pN && data.cI.rNC) {
      previousNameHint.classList.remove('hidden');
      
      // Update the hint text with the previous name and reason
      const reason = data.cI.rNC.toLowerCase();
      const italicText = reason.includes('deed poll') ? 'Changed by deed poll' : data.cI.rNC;
      previousNameHint.innerHTML = `Previous/Known as name: <strong>${data.cI.pN}</strong> <em>- ${italicText}</em>`;
      
      // console.log('✅ Showing previous name hint:', data.cI.pN, '-', data.cI.rNC); // Commented out to avoid logging client data
    } else {
      previousNameHint.classList.add('hidden');
      console.log('ℹ️ Hiding previous name hint (no data)');
    }
  }
}

/**
 * Populate IDV (Identity Document Verification) fields with client data
 * Fills name fields from client data
 */
function populateIDVFields(data) {
  // console.log('Populating IDV fields with client data:', data); // Commented out to avoid logging client data
  
  if (!data.cI) {
    console.warn('No client information (cI) available');
    return;
  }
  
  // ===== Name Inputs =====
  if (data.cI.n) {
    const idvFirstNameInput = document.getElementById('idvFirstName');
    const idvMiddleNameInput = document.getElementById('idvMiddleName');
    const idvLastNameInput = document.getElementById('idvLastName');
    
    if (idvFirstNameInput && data.cI.n.f) {
      idvFirstNameInput.value = data.cI.n.f;
      // console.log('✅ Populated IDV first name:', data.cI.n.f); // Commented out to avoid logging client data
    }
    
    if (idvMiddleNameInput && data.cI.n.m) {
      idvMiddleNameInput.value = data.cI.n.m;
      // console.log('✅ Populated IDV middle name:', data.cI.n.m); // Commented out to avoid logging client data
    }
    
    if (idvLastNameInput && data.cI.n.l) {
      idvLastNameInput.value = data.cI.n.l;
      // console.log('✅ Populated IDV last name:', data.cI.n.l); // Commented out to avoid logging client data
    }
  }
}

/**
 * Update International Address Verification visibility (unified for both Lite Screen and Electronic ID)
 * Shows when:
 * 1. Lite Screen is selected with AML & Address Screening AND country is supported, OR
 * 2. Electronic ID is selected AND country is supported
 */
function updateInternationalAddressVerification() {
  const internationalCard = document.getElementById('internationalAddressCard');
  
  if (!internationalCard) return;
  
  const checkbox = document.getElementById('internationalAddressVerification');
  let shouldShow = false;
  let countryCode = null;
  
  // Check if Lite Screen is active with AML & Address Screening
  const isLiteScreenActive = checkState.checkType === 'idv-lite' && 
                             checkState.includeLiteScreen === true;
  
  if (isLiteScreenActive) {
    const liteScreenType = checkState.liteScreenType || 'aml-address'; // Default
    if (liteScreenType === 'aml-address') {
      const liteCountryInput = document.getElementById('liteCountry');
      countryCode = liteCountryInput?.dataset.countryCode;
    }
  }
  
  // Check if Electronic ID is active
  const isElectronicIdActive = checkState.checkType === 'electronic-id';
  
  if (isElectronicIdActive) {
    const electronicCountryInput = document.getElementById('electronicIdCountry');
    countryCode = electronicCountryInput?.dataset.countryCode;
  }
  
  // Show only for supported international countries (NOT UK)
  if (countryCode && countryCode !== 'GBR' && INTERNATIONAL_VERIFICATION_COUNTRIES.includes(countryCode)) {
    shouldShow = true;
  }
  
  if (shouldShow) {
    internationalCard.classList.remove('hidden');
    // Auto-check when shown
    if (checkbox) checkbox.checked = true;
    console.log('✅ International Address Verification shown and checked for:', countryCode);
  } else {
    internationalCard.classList.add('hidden');
    // Uncheck when hidden
    if (checkbox) checkbox.checked = false;
  }
}

/**
 * Legacy function - redirects to unified function
 * @deprecated Use updateInternationalAddressVerification instead
 */
function updateLiteInternationalAddressVisibility(countryCode) {
  updateInternationalAddressVerification();
}

/**
 * Populate Electronic ID reference field based on matter category
 */
function populateElectronicIdReference(category) {
  const referenceInput = document.getElementById('electronicIdReference');
  if (!referenceInput || !checkState.clientData) return;
  
  const data = checkState.clientData;
  const workType = data.wT || '';
  const matterDescription = data.mD || '';
  
  let referenceValue = '';
  
  if (category === 'conveyancing' || category === 'property-other') {
    // For Conveyancing/Property Other: Use matter description only
    // (work type already includes "Sale of"/"Purchase of")
    referenceValue = matterDescription;
    console.log('✅ Electronic ID reference (Conveyancing/Property Other):', referenceValue);
  } else if (category === 'private-client' || category === 'other') {
    // For Private Client/Other: Use work type + matter description
    // But if they match, use matter description only
    if (workType && matterDescription) {
      if (workType.trim() === matterDescription.trim()) {
        referenceValue = matterDescription;
      } else {
        referenceValue = `${workType} ${matterDescription}`;
      }
    } else {
      referenceValue = matterDescription || workType;
    }
    console.log('✅ Electronic ID reference (Private Client/Other):', referenceValue);
  }
  
  referenceInput.value = referenceValue;
}

/**
 * Populate Electronic ID fields with client data
 * Fills name, phone, email, reference, and shows/hides sections based on data
 */
function populateElectronicIdFields(data) {
  // console.log('Populating Electronic ID fields with client data:', data); // Commented out to avoid logging client data
  
  if (!data.cI) {
    console.warn('No client information (cI) available');
    return;
  }
  
  // ===== Full Name (WITHOUT title) =====
  if (data.cI.n) {
    const fullNameInput = document.getElementById('electronicIdFullName');
    if (fullNameInput) {
      // Build full name from parts (excluding title)
      const nameParts = [
        data.cI.n.f,  // first
        data.cI.n.m,  // middle
        data.cI.n.l   // last
      ].filter(p => p && p.trim());
      
      fullNameInput.value = nameParts.join(' ');
      console.log('✅ Populated full name (no title):', fullNameInput.value);
    }
  }
  
  // ===== Mobile Number =====
  if (data.cI.m && typeof data.cI.m === 'string') {
    const cleanPhone = data.cI.m.trim();
    const electronicIdCountryCodeInput = document.getElementById('electronicIdCountryCode');
    const electronicIdMobileInput = document.getElementById('electronicIdMobile');
    
    // Parse international format phone number
    if (cleanPhone.startsWith('+')) {
      // Extract country code (try known codes, longest first)
      const knownCodes = ['+993', '+992', '+971', '+967', '+966', '+960', '+886', '+880', '+856', '+853', '+852', '+973', '+998', '+996', '+995', '+977', '+968', '+964', '+963', '+962', '+961', '+974', '+594', '+593', '+598', '+595', '+591', '+590', '+507', '+506', '+505', '+504', '+503', '+502', '+501', '+389', '+387', '+386', '+385', '+381', '+380', '+376', '+375', '+374', '+373', '+372', '+371', '+370', '+359', '+358', '+357', '+356', '+355', '+354', '+353', '+352', '+351', '+421', '+420', '+264', '+263', '+262', '+261', '+260', '+258', '+257', '+256', '+255', '+254', '+253', '+252', '+251', '+250', '+249', '+248', '+244', '+243', '+242', '+241', '+240', '+239', '+238', '+237', '+236', '+235', '+234', '+233', '+232', '+231', '+230', '+229', '+228', '+227', '+226', '+225', '+224', '+223', '+222', '+221', '+220', '+218', '+216', '+213', '+212', '+98', '+95', '+94', '+93', '+92', '+91', '+90', '+86', '+84', '+82', '+81', '+66', '+65', '+64', '+63', '+62', '+61', '+60', '+58', '+57', '+56', '+55', '+54', '+52', '+51', '+49', '+48', '+47', '+46', '+45', '+44', '+43', '+41', '+40', '+39', '+36', '+34', '+33', '+32', '+31', '+30', '+27', '+20', '+7', '+1'];
      
      for (const code of knownCodes) {
        if (cleanPhone.startsWith(code)) {
          if (electronicIdCountryCodeInput && typeof setPhoneCode === 'function') {
            setPhoneCode('electronicIdCountryCode', code);
          }
          if (electronicIdMobileInput) {
            electronicIdMobileInput.value = cleanPhone.substring(code.length);
          }
          console.log('✅ Populated mobile:', code, '+', cleanPhone.substring(code.length));
          break;
        }
      }
    } else if (electronicIdMobileInput) {
      // No country code, just set the number
      electronicIdMobileInput.value = cleanPhone;
    }
  }
  
  // ===== Email Address =====
  if (data.cI.e) {
    const emailInput = document.getElementById('electronicIdEmail');
    if (emailInput) {
      emailInput.value = data.cI.e;
      // console.log('✅ Populated email:', data.cI.e); // Commented out to avoid logging client data
    }
  }
  
  // ===== Country (for address/reference) =====
  if (data.cI.a && data.cI.a.country) {
    const countryInput = document.getElementById('electronicIdCountry');
    if (countryInput && typeof setCountry === 'function') {
      setCountry('electronicIdCountry', data.cI.a.country);
      // console.log('✅ Set Electronic ID country:', data.cI.a.country); // Commented out to avoid logging client data
      
      // Update International Address Verification visibility
      updateElectronicIdInternationalAddressVisibility(data.cI.a.country);
    }
  }
  
  // Note: Property Address/ID Check Reference is set based on matter category selection
}

/**
 * Legacy function - redirects to unified function
 * @deprecated Use updateInternationalAddressVerification instead
 */
function updateElectronicIdInternationalAddressVisibility(countryCode) {
  updateInternationalAddressVerification();
}

/**
 * Convert jurisdiction codes from frontend format to Thirdfort API format
 * Handles all known jurisdiction code differences between frontend and Thirdfort API
 */
function convertJurisdictionForThirdfort(frontendCode) {
  // Known jurisdiction code mappings for Thirdfort API
  const jurisdictionMappings = {
    // UK & Crown Dependencies
    'GB': 'UK',           // United Kingdom
    'GG': 'GG',           // Guernsey (same)
    'JE': 'JE',           // Jersey (same)
    'IM': 'IM',           // Isle of Man (same)
    'GI': 'GI',           // Gibraltar (same)
    
    // Europe - most are the same, but some may need conversion
    'AL': 'AL',           // Albania (same)
    'AD': 'AD',           // Andorra (same)
    'AT': 'AT',           // Austria (same)
    'BY': 'BY',           // Belarus (same)
    'BE': 'BE',           // Belgium (same)
    'BA': 'BA',           // Bosnia and Herzegovina (same)
    'BG': 'BG',           // Bulgaria (same)
    'HR': 'HR',           // Croatia (same)
    'CY': 'CY',           // Cyprus (same)
    'CZ': 'CZ',           // Czech Republic (same)
    'DK': 'DK',           // Denmark (same)
    'EE': 'EE',           // Estonia (same)
    'FO': 'FO',           // Faroe Islands (same)
    'FI': 'FI',           // Finland (same)
    'FR': 'FR',           // France (same)
    'DE': 'DE',           // Germany (same)
    'GR': 'GR',           // Greece (same)
    'HU': 'HU',           // Hungary (same)
    'IS': 'IS',           // Iceland (same)
    'IE': 'IE',           // Ireland (same)
    'IT': 'IT',           // Italy (same)
    'XK': 'XK',           // Kosovo (same)
    'LV': 'LV',           // Latvia (same)
    'LI': 'LI',           // Liechtenstein (same)
    'LT': 'LT',           // Lithuania (same)
    'LU': 'LU',           // Luxembourg (same)
    'MK': 'MK',           // North Macedonia (same)
    'MT': 'MT',           // Malta (same)
    'MD': 'MD',           // Moldova (same)
    'MC': 'MC',           // Monaco (same)
    'ME': 'ME',           // Montenegro (same)
    'NL': 'NL',           // Netherlands (same)
    'NO': 'NO',           // Norway (same)
    'PL': 'PL',           // Poland (same)
    'PT': 'PT',           // Portugal (same)
    'RO': 'RO',           // Romania (same)
    'RU': 'RU',           // Russia (same)
    'SM': 'SM',           // San Marino (same)
    'RS': 'RS',           // Serbia (same)
    'SK': 'SK',           // Slovakia (same)
    'SI': 'SI',           // Slovenia (same)
    'ES': 'ES',           // Spain (same)
    'SE': 'SE',           // Sweden (same)
    'CH': 'CH',           // Switzerland (same)
    'TR': 'TR',           // Turkey (same)
    'UA': 'UA',           // Ukraine (same)
    'VA': 'VA',           // Vatican City (same)
    
    // Americas
    'CA': 'CA',           // Canada (same)
    'MX': 'MX',           // Mexico (same)
    
    // United States - all states use US-XX format (same)
    'US-AL': 'US-AL',     // Alabama (same)
    'US-AK': 'US-AK',     // Alaska (same)
    'US-AZ': 'US-AZ',     // Arizona (same)
    'US-AR': 'US-AR',     // Arkansas (same)
    'US-CA': 'US-CA',     // California (same)
    'US-CO': 'US-CO',     // Colorado (same)
    'US-CT': 'US-CT',     // Connecticut (same)
    'US-DE': 'US-DE',     // Delaware (same)
    'US-DC': 'US-DC',     // District of Columbia (same)
    'US-FL': 'US-FL',     // Florida (same)
    'US-GA': 'US-GA',     // Georgia (same)
    'US-HI': 'US-HI',     // Hawaii (same)
    'US-ID': 'US-ID',     // Idaho (same)
    'US-IL': 'US-IL',     // Illinois (same)
    'US-IN': 'US-IN',     // Indiana (same)
    'US-IA': 'US-IA',     // Iowa (same)
    'US-KS': 'US-KS',     // Kansas (same)
    'US-KY': 'US-KY',     // Kentucky (same)
    'US-LA': 'US-LA',     // Louisiana (same)
    'US-ME': 'US-ME',     // Maine (same)
    'US-MD': 'US-MD',     // Maryland (same)
    'US-MA': 'US-MA',     // Massachusetts (same)
    'US-MI': 'US-MI',     // Michigan (same)
    'US-MN': 'US-MN',     // Minnesota (same)
    'US-MS': 'US-MS',     // Mississippi (same)
    'US-MO': 'US-MO',     // Missouri (same)
    'US-MT': 'US-MT',     // Montana (same)
    'US-NE': 'US-NE',     // Nebraska (same)
    'US-NV': 'US-NV',     // Nevada (same)
    'US-NH': 'US-NH',     // New Hampshire (same)
    'US-NJ': 'US-NJ',     // New Jersey (same)
    'US-NM': 'US-NM',     // New Mexico (same)
    'US-NY': 'US-NY',     // New York (same)
    'US-NC': 'US-NC',     // North Carolina (same)
    'US-ND': 'US-ND',     // North Dakota (same)
    'US-OH': 'US-OH',     // Ohio (same)
    'US-OK': 'US-OK',     // Oklahoma (same)
    'US-OR': 'US-OR',     // Oregon (same)
    'US-PA': 'US-PA',     // Pennsylvania (same)
    'US-RI': 'US-RI',     // Rhode Island (same)
    'US-SC': 'US-SC',     // South Carolina (same)
    'US-SD': 'US-SD',     // South Dakota (same)
    'US-TN': 'US-TN',     // Tennessee (same)
    'US-TX': 'US-TX',     // Texas (same)
    'US-UT': 'US-UT',     // Utah (same)
    'US-VT': 'US-VT',     // Vermont (same)
    'US-VA': 'US-VA',     // Virginia (same)
    'US-WA': 'US-WA',     // Washington (same)
    'US-WV': 'US-WV',     // West Virginia (same)
    'US-WI': 'US-WI',     // Wisconsin (same)
    'US-WY': 'US-WY',     // Wyoming (same)
    'US-AS': 'US-AS',     // American Samoa (same)
    'US-GU': 'US-GU',     // Guam (same)
    'US-MP': 'US-MP',     // Northern Mariana Islands (same)
    'US-PR': 'US-PR',     // Puerto Rico (same)
    'US-VI': 'US-VI',     // US Virgin Islands (same)
    
    // Central & South America
    'AR': 'AR',           // Argentina (same)
    'BO': 'BO',           // Bolivia (same)
    'BR': 'BR',           // Brazil (same)
    'CL': 'CL',           // Chile (same)
    'CO': 'CO',           // Colombia (same)
    'CR': 'CR',           // Costa Rica (same)
    'EC': 'EC',           // Ecuador (same)
    'SV': 'SV',           // El Salvador (same)
    'GT': 'GT',           // Guatemala (same)
    'HN': 'HN',           // Honduras (same)
    'NI': 'NI',           // Nicaragua (same)
    'PA': 'PA',           // Panama (same)
    'PY': 'PY',           // Paraguay (same)
    'PE': 'PE',           // Peru (same)
    'UY': 'UY',           // Uruguay (same)
    'VE': 'VE',           // Venezuela (same)
    
    // Caribbean
    'AG': 'AG',           // Antigua and Barbuda (same)
    'BS': 'BS',           // Bahamas (same)
    'BB': 'BB',           // Barbados (same)
    'BZ': 'BZ',           // Belize (same)
    'DM': 'DM',           // Dominica (same)
    'DO': 'DO',           // Dominican Republic (same)
    'GD': 'GD',           // Grenada (same)
    'JM': 'JM',           // Jamaica (same)
    'KN': 'KN',           // Saint Kitts and Nevis (same)
    'LC': 'LC',           // Saint Lucia (same)
    'VC': 'VC',           // Saint Vincent and the Grenadines (same)
    'TT': 'TT',           // Trinidad and Tobago (same)
    
    // Asia-Pacific
    'AU': 'AU',           // Australia (same)
    'NZ': 'NZ',           // New Zealand (same)
    'CN': 'CN',           // China (same)
    'HK': 'HK',           // Hong Kong (same)
    'IN': 'IN',           // India (same)
    'ID': 'ID',           // Indonesia (same)
    'JP': 'JP',           // Japan (same)
    'MY': 'MY',           // Malaysia (same)
    'PH': 'PH',           // Philippines (same)
    'SG': 'SG',           // Singapore (same)
    'KR': 'KR',           // South Korea (same)
    'TW': 'TW',           // Taiwan (same)
    'TH': 'TH',           // Thailand (same)
    'VN': 'VN',           // Vietnam (same)
    
    // Middle East
    'BH': 'BH',           // Bahrain (same)
    'IL': 'IL',           // Israel (same)
    'JO': 'JO',           // Jordan (same)
    'KW': 'KW',           // Kuwait (same)
    'LB': 'LB',           // Lebanon (same)
    'OM': 'OM',           // Oman (same)
    'QA': 'QA',           // Qatar (same)
    'SA': 'SA',           // Saudi Arabia (same)
    
    // United Arab Emirates (all 7 emirates)
    'AE-AZ': 'AE-AZ',     // Abu Dhabi (same)
    'AE-AJ': 'AE-AJ',     // Ajman (same)
    'AE-DU': 'AE-DU',     // Dubai (same)
    'AE-FU': 'AE-FU',     // Fujairah (same)
    'AE-RK': 'AE-RK',     // Ras Al Khaimah (same)
    'AE-SH': 'AE-SH',     // Sharjah (same)
    'AE-UQ': 'AE-UQ',     // Umm Al Quwain (same)
    
    // Africa
    'ZA': 'ZA',           // South Africa (same)
    'EG': 'EG',           // Egypt (same)
    'GH': 'GH',           // Ghana (same)
    'KE': 'KE',           // Kenya (same)
    'MA': 'MA',           // Morocco (same)
    'NG': 'NG'            // Nigeria (same)
  };
  
  // Return mapped code or original if no mapping exists
  return jurisdictionMappings[frontendCode] || frontendCode;
}

/**
 * Perform KYB search (extracted from handleKYBSearch for reusability)
 * Sends 'company-lookup' message to parent for Thirdfort API call
 * Searches by company number (preferred) OR company name (not both)
 */
function performKYBSearch(jurisdictionCode, companyName, companyNumber) {
  const resultsContainer = document.getElementById('kybResultsContainer');
  const resultsCount = document.getElementById('kybResultsCount');
  
  // Show loading state
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="kyb-loading-state">
        <div class="kyb-loading-spinner"></div>
        <p>Searching companies...</p>
      </div>
    `;
  }
  
  // Convert jurisdiction codes to Thirdfort API format
  const thirdfortJurisdiction = convertJurisdictionForThirdfort(jurisdictionCode);
  
  // Prefer company number over name - only search by ONE field
  const searchBy = companyNumber ? 'number' : 'name';
  const searchValue = companyNumber ? companyNumber : companyName;
  
  console.log(`📡 Sending company-lookup to parent: ${searchBy} = "${searchValue}", jurisdiction = ${jurisdictionCode} → ${thirdfortJurisdiction}`);
  
  // Send message to parent for Thirdfort API call
  window.parent.postMessage({
    type: 'company-lookup',
    jurisdictionCode: thirdfortJurisdiction,
    searchBy: searchBy,
    searchValue: searchValue
  }, '*');
}

/**
 * Handle check type selection
 */
function handleCheckTypeSelection(event) {
  const card = event.currentTarget;
  const checkType = card.dataset.checkType;
  
  // Update selection state
  document.querySelectorAll('.check-type-card').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  checkState.checkType = checkType;
  
  // ===== HIDE ALL CHECK-TYPE-SPECIFIC SECTIONS FIRST =====
  hideSection('liteScreenSection');
  hideSection('idvSection');
  hideSection('matterCategorySection');
  hideSection('electronicIdSection');
  hideSection('kybSection');
  
  // Hide sub-categories
  const conveyancingSubCategory = document.getElementById('conveyancingSubCategory');
  const propertyOtherSubCategory = document.getElementById('propertyOtherSubCategory');
  if (conveyancingSubCategory) conveyancingSubCategory.style.display = 'none';
  if (propertyOtherSubCategory) propertyOtherSubCategory.style.display = 'none';
  
  // Show check reference section (common to all)
  showSection('checkReferenceSection');
  
  // ===== SHOW APPROPRIATE SECTIONS BASED ON CHECK TYPE =====
  if (checkType === 'idv-lite') {
    // Show both Lite Screen and IDV sections
    showSection('liteScreenSection');
    showSection('idvSection');
    
    // Lite Screen defaults to YES (content shown)
    checkState.includeLiteScreen = true;
    const liteContent = document.getElementById('liteScreenContent');
    if (liteContent) liteContent.classList.remove('hidden');
    
    // IDV: Only reset to null if not already auto-selected by image check
    const idvContent = document.getElementById('idvContent');
    const idvYesBtn = document.querySelector('[data-idv-answer="yes"]');
    const idvAlreadySelected = idvYesBtn && idvYesBtn.classList.contains('selected');
    
    if (!idvAlreadySelected) {
      checkState.includeIDV = null;
      if (idvContent) idvContent.classList.add('hidden');
      console.log('ℹ️ IDV reset to null (not auto-selected)');
    } else {
      // Preserve the auto-selected state
      console.log('ℹ️ IDV already auto-selected, preserving state:', checkState.includeIDV);
    }
    
    // Show PEP Monitoring card (Lite Screen defaults to YES)
    const monitoringCard = document.getElementById('monitoringCard');
    const monitoringCheckbox = document.getElementById('ongoingMonitoring');
    
    if (monitoringCard) {
      monitoringCard.classList.remove('hidden');
      
      // Auto-check the checkbox ONLY on first show after data load
      if (monitoringCheckbox && !checkState.pepMonitoringInitialized) {
        monitoringCheckbox.checked = true;
        checkState.pepMonitoringInitialized = true;
        console.log('✅ PEP Monitoring card shown and auto-checked (first time)');
      } else {
        console.log('✅ PEP Monitoring card shown (preserving user choice)');
      }
    }
    
    console.log('✅ Showing Lite Screen (YES default) and IDV sections (no default)');
  } else if (checkType === 'electronic-id') {
    // Show Matter Category section instead of Electronic ID details
    showSection('matterCategorySection');
    console.log('✅ Showing Matter Category section for Electronic ID');
    
    // Show PEP Monitoring card for Electronic ID (default: Standard ID includes screening)
    const monitoringCard = document.getElementById('monitoringCard');
    const monitoringCheckbox = document.getElementById('ongoingMonitoring');
    
    if (monitoringCard) {
      // Only show if Standard ID is selected (default), hide if Additional Tasks Only
      if (checkState.electronicIdType === 'standard') {
        monitoringCard.classList.remove('hidden');
        if (monitoringCheckbox) monitoringCheckbox.checked = true;
        console.log('✅ PEP Monitoring shown and checked (Electronic ID - Standard ID)');
      } else {
        monitoringCard.classList.add('hidden');
        if (monitoringCheckbox) monitoringCheckbox.checked = false;
        console.log('❌ PEP Monitoring hidden (Electronic ID - Additional Tasks Only)');
      }
    }
  } else if (checkType === 'kyb') {
    // Show KYB section
    showSection('kybSection');
    console.log('✅ Showing KYB section');
  }
  
  // Initialize check type specific logic
  if (window[`init_${checkType.replace(/-/g, '_')}`]) {
    window[`init_${checkType.replace(/-/g, '_')}`]();
  }
  
  // Update International Address Verification visibility
  updateInternationalAddressVerification();
  
  validateForm();
}

/**
 * Handle matter category selection
 */
function handleMatterCategorySelection(event) {
  const card = event.currentTarget;
  const category = card.dataset.category;
  
  // Update selection state
  document.querySelectorAll('.matter-category-card').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  checkState.matterCategory = category;
  
  // Show/hide sub-category cards based on selection
  const conveyancingSubCategory = document.getElementById('conveyancingSubCategory');
  const propertyOtherSubCategory = document.getElementById('propertyOtherSubCategory');
  
  // Hide all sub-categories first
  conveyancingSubCategory.style.display = 'none';
  propertyOtherSubCategory.style.display = 'none';
  
  // Show appropriate sub-category
  if (category === 'conveyancing') {
    conveyancingSubCategory.style.display = 'block';
  } else if (category === 'property-other') {
    propertyOtherSubCategory.style.display = 'block';
  } else if (category === 'private-client' || category === 'other') {
    // For Private Client or Other, show Electronic ID section directly (no subtypes)
    if (checkState.checkType === 'electronic-id') {
      showSection('electronicIdSection');
      updateElectronicIdReferenceLabel(category);
      populateElectronicIdReference(category);
      configureProofOfOwnership(category, null); // No subtypes
      console.log('✅ Showing Electronic ID section (Private Client/Other selected)');
    }
  }
  
  // Reset sub-category selection when main category changes
  document.querySelectorAll('.matter-sub-card').forEach(c => {
    c.classList.remove('selected');
  });
  checkState.matterSubCategory = null;
  showSection('confirmationSection');
  
  // Update International Address Verification visibility
  updateInternationalAddressVerification();
  
  validateForm();
}

/**
 * Update Electronic ID Reference label based on matter category
 */
function updateElectronicIdReferenceLabel(category) {
  const label = document.getElementById('electronicIdReferenceLabel');
  const input = document.getElementById('electronicIdReference');
  
  if (!label || !input) return;
  
  if (category === 'conveyancing' || category === 'property-other') {
    label.textContent = 'Property Address';
    input.placeholder = 'Enter property address...';
  } else {
    label.textContent = 'ID Check Reference';
    input.placeholder = 'Enter check reference...';
  }
}

/**
 * Handle matter sub-category selection (client role)
 */
function handleMatterSubCategorySelection(event) {
  const card = event.currentTarget;
  const subCategory = card.dataset.subCategory;
  
  // Check if this card is already selected (toggle behavior)
  const wasSelected = card.classList.contains('selected');
  
  // Update selection state within the visible sub-category group
  const parentContainer = card.closest('.matter-sub-category');
  parentContainer.querySelectorAll('.matter-sub-card').forEach(c => {
    c.classList.remove('selected');
  });
  
  if (wasSelected) {
    // Deselecting - clear state and hide Electronic ID section
    checkState.matterSubCategory = null;
    console.log('Matter sub-category deselected');
    
    if (checkState.checkType === 'electronic-id') {
      hideSection('electronicIdSection');
      console.log('✅ Hiding Electronic ID section (subtype deselected)');
    }
  } else {
    // Selecting - update state and show Electronic ID section
    card.classList.add('selected');
    checkState.matterSubCategory = subCategory;
    console.log('Matter sub-category selected:', subCategory);
    
    // Show Electronic ID section when subtype is selected
    if (checkState.checkType === 'electronic-id') {
      showSection('electronicIdSection');
      console.log('✅ Showing Electronic ID section (subtype selected)');
      
      // Populate Electronic ID reference and configure Proof of Ownership
      populateElectronicIdReference(checkState.matterCategory);
      configureProofOfOwnership(checkState.matterCategory, subCategory);
    }
  }
  
  // Update International Address Verification visibility
  updateInternationalAddressVerification();
  
  validateForm();
}

/**
 * Handle lite screen type selection
 */
function handleLiteScreenTypeSelection(event) {
  const card = event.currentTarget;
  const liteType = card.dataset.liteType;
  
  // Update selection state
  document.querySelectorAll('.lite-screen-type-card').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  // Store in state (you can add this to checkState if needed)
  checkState.liteScreenType = liteType;
  
  // Show/hide address fields and toggle DOB based on selection
  const addressAutocompleteRow = document.querySelector('#liteScreenSection .address-autocomplete-row');
  const addressControls = document.querySelector('#liteScreenSection .address-controls-row');
  const manualFields = document.getElementById('liteManualAddressFields');
  const fullDOB = document.querySelector('#liteScreenSection .birthdate-inputs');
  const dobLabel = document.querySelector('#liteScreenSection .dob-container label');
  
  if (liteType === 'aml-only') {
    // Hide address search for AML Screening Only (but keep country dropdown)
    if (addressAutocompleteRow) addressAutocompleteRow.style.display = 'none';
    if (addressControls) addressControls.style.display = 'none';
    if (manualFields) manualFields.style.display = 'none';
    
    // Change to year of birth only (hide first 4 inputs - DDMM, show last 4 - YYYY)
    if (fullDOB) {
      const inputs = fullDOB.querySelectorAll('input');
      inputs.forEach((input, index) => {
        if (index < 4) {
          input.style.display = 'none';
        }
      });
    }
    if (dobLabel) dobLabel.textContent = 'Year of Birth';
  } else {
    // Show address fields for AML & Address Screening
    if (addressAutocompleteRow) addressAutocompleteRow.style.display = 'block';
    if (addressControls) addressControls.style.display = 'block';
    // Manual fields stay hidden unless "not listed" is checked
    
    // Show full date of birth (all 8 inputs)
    if (fullDOB) {
      const inputs = fullDOB.querySelectorAll('input');
      inputs.forEach(input => {
        input.style.display = 'block';
      });
    }
    if (dobLabel) dobLabel.textContent = 'Date of Birth';
  }
  
  // Update International Address Verification visibility
  updateInternationalAddressVerification();
  
  validateForm();
}

/**
 * Handle IDV answer selection (YES/NO)
 */
function handleIDVAnswerSelection(event) {
  const card = event.currentTarget;
  
  // Check if button is disabled
  if (card.disabled) {
    console.log('⚠️ IDV button is disabled - ignoring click');
    return;
  }
  
  const answer = card.dataset.idvAnswer;
  
  // Update selection state (only for IDV answer cards)
  document.querySelectorAll('.idv-answer-card[data-idv-answer]').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  // Store in state
  checkState.includeIDV = (answer === 'yes');
  
  // Show/hide IDV content based on answer
  const idvContent = document.getElementById('idvContent');
  if (idvContent) {
    if (answer === 'yes') {
      idvContent.classList.remove('hidden');
      console.log('✅ IDV content shown');
    } else {
      idvContent.classList.add('hidden');
      console.log('❌ IDV content hidden');
    }
  }
  
  validateForm();
}

/**
 * Handle Lite Screen answer selection
 */
function handleLiteAnswerSelection(event) {
  const card = event.currentTarget;
  const answer = card.dataset.liteAnswer;
  
  // Update selection state (only for Lite answer cards)
  document.querySelectorAll('.idv-answer-card[data-lite-answer]').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  // Store in state
  checkState.includeLiteScreen = (answer === 'yes');
  
  // Show/hide Lite Screen content based on answer
  const liteContent = document.getElementById('liteScreenContent');
  if (liteContent) {
    if (answer === 'yes') {
      liteContent.classList.remove('hidden');
      console.log('✅ Lite Screen content shown');
    } else {
      liteContent.classList.add('hidden');
      console.log('❌ Lite Screen content hidden');
    }
  }
  
  // Show/hide PEP Monitoring card based on Lite Screen answer
  const monitoringCard = document.getElementById('monitoringCard');
  const monitoringCheckbox = document.getElementById('ongoingMonitoring');
  
  if (monitoringCard) {
    if (answer === 'yes') {
      monitoringCard.classList.remove('hidden');
      
      // Auto-check the checkbox ONLY on first show after data load
      if (monitoringCheckbox && !checkState.pepMonitoringInitialized) {
        monitoringCheckbox.checked = true;
        checkState.pepMonitoringInitialized = true;
        console.log('✅ PEP Monitoring card shown and auto-checked (first time)');
      } else {
        console.log('✅ PEP Monitoring card shown (preserving user choice: ' + (monitoringCheckbox?.checked ? 'CHECKED' : 'UNCHECKED') + ')');
      }
    } else {
      monitoringCard.classList.add('hidden');
      console.log('❌ PEP Monitoring card hidden (Lite Screen NO - checkbox state preserved)');
    }
  }
  
  // Update International Address Verification visibility
  updateInternationalAddressVerification();
  
  validateForm();
}

/**
 * Handle check reference input change
 */
function handleCheckReferenceChange(event) {
  checkState.checkReference = event.target.value;
  validateForm();
}

/**
 * Toggle manual address fields for lite screen section
 */
function toggleLiteManualAddress(event) {
  const manualFields = document.getElementById('liteManualAddressFields');
  if (event.target.checked) {
    manualFields.classList.remove('hidden');
    // Validate immediately when shown
    validateLiteManualAddress();
    // Check if we should show International Address Verification
    const liteCountry = document.getElementById('liteCountry');
    if (liteCountry) {
      handleLiteCountryChange({ target: liteCountry });
    }
  } else {
    manualFields.classList.add('hidden');
    // Hide International Address Verification when manual fields are hidden
    const internationalAddressCard = document.getElementById('liteInternationalAddressCard');
    if (internationalAddressCard) {
      internationalAddressCard.style.display = 'none';
    }
  }
}

/**
 * Validate Lite Screen manual address fields
 * Minimum requirements: town + postcode + (flat_number OR building_number OR building_name)
 */
function validateLiteManualAddress() {
  const parentContainer = document.getElementById('liteManualAddressFields');
  
  if (!parentContainer || parentContainer.classList.contains('hidden')) {
    console.log('⏸️ Validation skipped - container hidden or not found');
    return;
  }
  
  // Target the actual .manual-address-grid inside the parent container
  const gridContainer = parentContainer.querySelector('.manual-address-grid');
  
  if (!gridContainer) {
    console.warn('⚠️ .manual-address-grid not found inside container');
    return;
  }
  
  const flatNumber = document.getElementById('liteFlatNumber')?.value?.trim();
  const buildingNumber = document.getElementById('liteBuildingNumber')?.value?.trim();
  const buildingName = document.getElementById('liteBuildingName')?.value?.trim();
  const town = document.getElementById('liteTown')?.value?.trim();
  const postcode = document.getElementById('litePostcode')?.value?.trim();
  
  // console.log('🔍 Validating address:', { flatNumber, buildingNumber, buildingName, town, postcode }); // Commented out to avoid logging client data
  
  // Minimum requirements per Thirdfort API:
  // 1. Must have town
  // 2. Must have postcode
  // 3. Must have at least ONE OF: flat_number, building_number, or building_name
  const hasBuilding = flatNumber || buildingNumber || buildingName;
  const isValid = town && postcode && hasBuilding;
  
  console.log(`🔍 Validation result: ${isValid ? 'VALID ✅' : 'INVALID ❌'} (town: ${!!town}, postcode: ${!!postcode}, hasBuilding: ${hasBuilding})`);
  
  if (isValid) {
    gridContainer.classList.remove('invalid');
    gridContainer.classList.add('valid');
    console.log('✅ Address container turned GREEN');
  } else {
    gridContainer.classList.remove('valid');
    gridContainer.classList.add('invalid');
    console.log('⚠️ Address container remains GREY');
  }
  
  return isValid;
}

/**
 * Handle current address card button click
 */
function handleLiteCurrentAddressClick() {
  // If already selected, do nothing
  if (liteActiveAddressType === 'current') {
    console.log('ℹ️ Current address already active');
    return;
  }
  
  // Switch to current address
  liteActiveAddressType = 'current';
  
  // Load current address into manual fields
  loadAddressIntoManualFields(liteCurrentAddressObject, 'lite');
  
  // Update card states
  updateLiteAddressCardStates();
  
  console.log('✅ Switched to current address');
}

/**
 * Handle previous address card button click
 */
function handleLitePreviousAddressClick() {
  // If already selected, do nothing
  if (liteActiveAddressType === 'previous') {
    console.log('ℹ️ Previous address already active');
    return;
  }
  
  // Check if we have a previous address
  if (!litePreviousAddressObject) {
    console.warn('⚠️ No previous address available');
    return;
  }
  
  // Switch to previous address
  liteActiveAddressType = 'previous';
  
  // Load previous address into manual fields
  loadAddressIntoManualFields(litePreviousAddressObject, 'lite');
  
  // Update card states
  updateLiteAddressCardStates();
  
  console.log('✅ Switched to previous address');
}

/**
 * Load address object into manual fields
 */
function loadAddressIntoManualFields(addressObject, prefix) {
  if (!addressObject) return;
  
  const flatNumber = document.getElementById(`${prefix}FlatNumber`);
  const buildingNumber = document.getElementById(`${prefix}BuildingNumber`);
  const buildingName = document.getElementById(`${prefix}BuildingName`);
  const street = document.getElementById(`${prefix}Street`);
  const subStreet = document.getElementById(`${prefix}SubStreet`);
  const town = document.getElementById(`${prefix}Town`);
  const postcode = document.getElementById(`${prefix}Postcode`);
  const country = document.getElementById(`${prefix}Country`);
  
  if (flatNumber) flatNumber.value = addressObject.flat_number || '';
  if (buildingNumber) buildingNumber.value = addressObject.building_number || '';
  if (buildingName) buildingName.value = addressObject.building_name || '';
  if (street) street.value = addressObject.street || '';
  if (subStreet) subStreet.value = addressObject.sub_street || '';
  if (town) town.value = addressObject.town || '';
  if (postcode) postcode.value = addressObject.postcode || '';
  
  if (country && addressObject.country && typeof setCountry === 'function') {
    setCountry(`${prefix}Country`, addressObject.country);
  }
  
  // Validate after loading
  if (prefix === 'lite') {
    validateLiteManualAddress();
    updateLiteInternationalAddressVisibility(addressObject.country);
  }
}

/**
 * Update address card visual states (selected/unselected)
 */
function updateLiteAddressCardStates() {
  const currentCard = document.getElementById('liteCurrentAddressCard');
  const previousCard = document.getElementById('litePreviousAddressCard');
  const currentBtn = document.getElementById('liteCurrentAddressBtn');
  const previousBtn = document.getElementById('litePreviousAddressBtn');
  
  if (liteActiveAddressType === 'current') {
    // Current address is selected (green)
    if (currentCard) currentCard.classList.add('selected');
    if (currentBtn) currentBtn.textContent = 'Selected address';
    
    // Previous address is not selected (grey)
    if (previousCard) previousCard.classList.remove('selected');
    if (previousBtn) previousBtn.textContent = 'Check previous address';
  } else if (liteActiveAddressType === 'previous') {
    // Previous address is selected (green)
    if (previousCard) previousCard.classList.add('selected');
    if (previousBtn) previousBtn.textContent = 'Selected address';
    
    // Current address is not selected (grey)
    if (currentCard) currentCard.classList.remove('selected');
    if (currentBtn) currentBtn.textContent = 'Check current address';
  } else {
    // Neither address is selected - both grey (user entered a different address)
    if (currentCard) currentCard.classList.remove('selected');
    if (currentBtn) currentBtn.textContent = 'Check current address';
    
    if (previousCard) previousCard.classList.remove('selected');
    if (previousBtn) previousBtn.textContent = 'Check previous address';
  }
}

/**
 * Format address object for display in address card
 */
function formatAddressForCard(addressObject) {
  if (!addressObject) return '—';
  
  const parts = [
    addressObject.flat_number,
    addressObject.building_number,
    addressObject.building_name,
    addressObject.street,
    addressObject.sub_street,
    addressObject.town,
    addressObject.postcode
  ].filter(p => p && p.trim());
  
  return parts.join(', ') || '—';
}

/**
 * Detect if manual address fields have been changed from stored addresses
 * If address doesn't match current or previous, deselect both cards
 */
function detectLiteAddressChange() {
  // Get current values from manual fields
  const currentValues = {
    flat_number: document.getElementById('liteFlatNumber')?.value?.trim() || '',
    building_number: document.getElementById('liteBuildingNumber')?.value?.trim() || '',
    building_name: document.getElementById('liteBuildingName')?.value?.trim() || '',
    street: document.getElementById('liteStreet')?.value?.trim() || '',
    sub_street: document.getElementById('liteSubStreet')?.value?.trim() || '',
    town: document.getElementById('liteTown')?.value?.trim() || '',
    postcode: document.getElementById('litePostcode')?.value?.trim() || ''
  };
  
  // Check if current values match the current address object
  const matchesCurrent = liteCurrentAddressObject && addressObjectsMatch(currentValues, liteCurrentAddressObject);
  
  // Check if current values match the previous address object
  const matchesPrevious = litePreviousAddressObject && addressObjectsMatch(currentValues, litePreviousAddressObject);
  
  if (matchesCurrent) {
    // Manual fields match current address
    liteActiveAddressType = 'current';
    updateLiteAddressCardStates();
  } else if (matchesPrevious) {
    // Manual fields match previous address
    liteActiveAddressType = 'previous';
    updateLiteAddressCardStates();
  } else {
    // Manual fields don't match either stored address - deselect both
    liteActiveAddressType = null;
    updateLiteAddressCardStates();
  }
}

/**
 * Compare two address objects for equality (ignoring empty/undefined fields)
 */
function addressObjectsMatch(addr1, addr2) {
  if (!addr1 || !addr2) return false;
  
  const fields = ['flat_number', 'building_number', 'building_name', 'street', 'sub_street', 'town', 'postcode'];
  
  return fields.every(field => {
    const val1 = (addr1[field] || '').trim().toLowerCase();
    const val2 = (addr2[field] || '').trim().toLowerCase();
    return val1 === val2;
  });
}

/**
 * Valid countries for International Address Verification (excluding UK as that's standard)
 * Using 3-character ISO codes (ISO 3166-1 alpha-3) for address objects
 */
const INTERNATIONAL_VERIFICATION_COUNTRIES = [
  'AUS', // Australia
  'AUT', // Austria
  'BEL', // Belgium
  'BRA', // Brazil
  'CAN', // Canada
  'DNK', // Denmark
  'FRA', // France
  'DEU', // Germany
  'ITA', // Italy
  'NZL', // New Zealand
  'NOR', // Norway
  'ESP', // Spain
  'NLD', // Netherlands
  'SWE', // Sweden
  'CHE', // Switzerland
  'USA'  // United States
];

/**
 * Handle lite screen country change - update International Address Verification
 */
function handleLiteCountryChange(event) {
  updateInternationalAddressVerification();
}

/**
 * Handle Electronic ID type selection
 */
function handleElectronicIdTypeSelection(event) {
  const card = event.currentTarget;
  const eidType = card.dataset.eidType;
  
  // Update selection state
  document.querySelectorAll('.electronic-id-type-card').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  // Store in state
  checkState.electronicIdType = eidType;
  
  console.log('✅ Electronic ID type selected:', eidType);
  
  // Show/hide PEP Monitoring based on type
  const monitoringCard = document.getElementById('monitoringCard');
  const monitoringCheckbox = document.getElementById('ongoingMonitoring');
  
  if (monitoringCard) {
    if (eidType === 'standard') {
      // Standard ID includes screening - show and check PEP monitoring
      monitoringCard.classList.remove('hidden');
      if (monitoringCheckbox) monitoringCheckbox.checked = true;
      console.log('✅ PEP Monitoring shown and checked (Standard ID includes screening)');
    } else if (eidType === 'additional-only') {
      // Additional Tasks Only = no ID check = no screening = hide PEP monitoring
      monitoringCard.classList.add('hidden');
      if (monitoringCheckbox) monitoringCheckbox.checked = false;
      console.log('❌ PEP Monitoring hidden (Additional Tasks Only - no screening)');
    }
  }
  
  validateForm();
}

/**
 * Handle electronic ID country change - update International Address Verification
 */
function handleElectronicIdCountryChange(event) {
  updateInternationalAddressVerification();
}

/**
 * Handle IDV document type selection
 */
function handleIDVDocumentTypeSelection(event) {
  const card = event.currentTarget;
  const documentType = card.dataset.documentType;
  const requiresBack = card.dataset.requiresBack === 'true';
  
  // Update selection state
  document.querySelectorAll('.idv-document-card').forEach(c => {
    c.classList.remove('selected');
  });
  card.classList.add('selected');
  
  // Store in state
  checkState.idvDocumentType = documentType;
  checkState.idvRequiresBack = requiresBack;
  
  console.log('🔄 IDV document type changed to:', documentType, 'Requires back:', requiresBack);
  
  // Update column visibility and labels based on document type
  const frontColumnLabel = document.getElementById('idvFrontColumnLabel');
  const backColumn = document.getElementById('idvBackColumn');
  
  if (requiresBack) {
    // Double-sided document (Driving Licence, National ID, etc.)
    frontColumnLabel.textContent = 'Front Photo';
    backColumn.style.display = 'flex';
  } else {
    // Single-sided document (Passport)
    frontColumnLabel.textContent = 'Single Photo';
    backColumn.style.display = 'none';
  }
  
  // Re-populate image lists if we have images
  if (checkState.availableIDVImages) {
    // Map document types to exact document names
    const documentTypeMap = {
      'passport': 'Passport',
      'driving_licence': 'Driving Licence',
      'national_identity_card': ['Passport Card', 'National Identity Card'],
      'residence_permit': 'Residence Permit',
      'unknown': 'Other Photo ID Card'
    };
    
    // Check if we have exact matches for the selected type
    const expectedDocName = documentTypeMap[documentType];
    const hasExactMatches = expectedDocName && checkState.availableIDVImages.some(img => {
      if (Array.isArray(expectedDocName)) {
        return expectedDocName.includes(img.document);
      }
      return img.document === expectedDocName;
    });
    
    if (!hasExactMatches) {
      console.log(`⚠️ No exact matches for ${expectedDocName}, showing image lists for user to choose`);
      // Clear any selected images and show lists
      checkState.frontImage = null;
      checkState.backImage = null;
      
      // Hide selected views, show lists
      const idvFrontSelected = document.getElementById('idvFrontSelected');
      const idvBackSelected = document.getElementById('idvBackSelected');
      const idvFrontList = document.getElementById('idvFrontList');
      const idvBackList = document.getElementById('idvBackList');
      
      if (idvFrontSelected) idvFrontSelected.style.display = 'none';
      if (idvBackSelected) idvBackSelected.style.display = 'none';
      if (idvFrontList) idvFrontList.style.display = 'block';
      if (idvBackList) idvBackList.style.display = 'block';
    }
    
    populateIDVImageLists(checkState.availableIDVImages, documentType);
  }
  
  validateForm();
}

/**
 * Toggle manual address fields for IDV section
 */
function toggleIDVManualAddress(event) {
  const manualFields = document.getElementById('idvManualAddressFields');
  if (event.target.checked) {
    manualFields.classList.remove('hidden');
  } else {
    manualFields.classList.add('hidden');
  }
}

/**
 * Validate the entire form
 */
function validateForm() {
  // Only check confirmation checkbox to enable button
  const confirmationCheckbox = document.getElementById('confirmationCheckbox');
  const isValid = confirmationCheckbox?.checked || false;
  
  // Update submit button state
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = !isValid;
  checkState.isValid = isValid;
  
  return isValid;
}

/**
 * Validate check based on check type (called when submit button clicked)
 */
function validateCheckByType() {
  const checkType = checkState.checkType;
  
  if (!checkType) {
    return { valid: false, errors: ['Please select a check type'] };
  }
  
  // Call type-specific validation
  switch(checkType) {
    case 'idv-lite':
      return validateIDVLiteCheck();
    case 'electronic-id':
      return validateElectronicIDCheck();
    case 'kyb':
      return validateKYBCheck();
    default:
      return { valid: false, errors: ['Invalid check type'] };
  }
}

/**
 * Validate IDV & Lite Screen check
 */
function validateIDVLiteCheck() {
  const errors = [];
  
  // Check reference required
  if (!checkState.checkReference || checkState.checkReference.trim() === '') {
    errors.push('Check reference is required');
  }
  
  // Matter category NOT required for Form J (IDV & Lite)
  // Form J is for basic ID verification without property transaction context
  
  // TODO: Add more IDV/Lite specific validation
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate Electronic ID check
 */
function validateElectronicIDCheck() {
  const errors = [];
  
  // Check reference required
  if (!checkState.checkReference || checkState.checkReference.trim() === '') {
    errors.push('Check reference is required');
  }
  
  // Matter category required
  if (!checkState.matterCategory) {
    errors.push('Please select a matter category');
  }
  
  // TODO: Add Electronic ID specific validation
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate KYB check
 */
function validateKYBCheck() {
  const errors = [];
  
  // Check reference required
  if (!checkState.checkReference || checkState.checkReference.trim() === '') {
    errors.push('Check reference is required');
  }
  
  // Company must be selected
  if (!checkState.kybCompany) {
    errors.push('Please search and select a company');
  }
  
  // Matter category NOT required for Form K (KYB)
  // Form K is for business verification without property transaction context
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Handle form submission
 */
async function handleSubmit() {
  // Run check type-specific validation
  const validation = validateCheckByType();
  
  if (!validation.valid) {
    // Show errors in popup
    const errorMessage = 'Please fix the following errors:\n\n' + validation.errors.map((err, i) => `${i + 1}. ${err}`).join('\n');
    showError(errorMessage);
    return;
  }
  
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Initiating Check...';
  
  try {
    // Route to appropriate check submission handler
    // This will send the correct message format (kyb-check, electronic-check, or lite-idv-check)
    submitCheckRequest();
    
    // Button will re-enable when parent responds with success/error
    
  } catch (error) {
    console.error('Error submitting check:', error);
    showError('Failed to initiate check. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Initiate Check';
  }
}

/**
 * Collect all form data
 */
function collectFormData() {
  return {
    checkType: checkState.checkType,
    matterCategory: checkState.matterCategory,
    matterSubCategory: checkState.matterSubCategory,
    checkReference: checkState.checkReference,
    liteScreenType: checkState.liteScreenType,
    includeIDV: checkState.includeIDV,
    idvDocumentType: checkState.idvDocumentType,
    kybJurisdiction: checkState.kybJurisdiction,
    kybCompany: checkState.kybCompany,
    originalClientData: checkState.clientData,
    timestamp: new Date().toISOString()
  };
}

/**
 * Show error message
 */
function showError(message) {
  const errorPopup = document.getElementById('errorPopup');
  const errorMessage = document.getElementById('errorMessage');
  const closeButton = document.getElementById('closeError');
  
  if (errorPopup && errorMessage) {
    errorMessage.textContent = message;
    errorPopup.classList.remove('hidden');
    
    // Ensure close button is visible for normal errors
    if (closeButton) {
      closeButton.style.display = 'flex';
    }
  }
}

/**
 * Hide error message
 */
function hideError() {
  const errorPopup = document.getElementById('errorPopup');
  if (errorPopup) {
    errorPopup.classList.add('hidden');
  }
}

/**
 * Show section
 */
function showSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.remove('hidden');
  }
}

/**
 * Hide section
 */
function hideSection(sectionId) {
  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add('hidden');
  }
}

/**
 * Utility: Format date for display
 */
function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Utility: Format phone number
 */
function formatPhoneNumber(countryCode, number) {
  return `${countryCode} ${number}`;
}

/**
 * Show all tasks (used when showing task section)
 */
function showAllTasks() {
  document.querySelectorAll('.task-category').forEach(category => {
    category.style.display = 'block';
  });
  
  document.querySelectorAll('input[name="task"]').forEach(checkbox => {
    checkbox.closest('.task-checkbox-label').style.display = 'flex';
  });
}

/**
 * Populate lite screen address fields from address object
 * Called when parent sends address data in initialization
 */
function populateLiteScreenAddress(address) {
  // console.log('Populating lite screen address:', address); // Commented out to avoid logging client data
  
  // Populate country if available
  if (address.country && typeof setCountry === 'function') {
    setCountry('liteCountry', address.country);
  }
  
  // Populate manual address fields
  if (address.flatNumber) {
    document.getElementById('liteFlatNumber').value = address.flatNumber;
  }
  if (address.buildingNumber) {
    document.getElementById('liteBuildingNumber').value = address.buildingNumber;
  }
  if (address.buildingName) {
    document.getElementById('liteBuildingName').value = address.buildingName;
  }
  if (address.street) {
    document.getElementById('liteStreet').value = address.street;
  }
  if (address.subStreet) {
    document.getElementById('liteSubStreet').value = address.subStreet;
  }
  if (address.town) {
    document.getElementById('liteTown').value = address.town;
  }
  if (address.postcode) {
    document.getElementById('litePostcode').value = address.postcode;
  }
  
  // Show manual address fields since we have data
  const manualFields = document.getElementById('liteManualAddressFields');
  if (manualFields) {
    manualFields.classList.remove('hidden');
  }
  
  // Also populate the search field with a formatted address for display
  const addressParts = [
    address.flatNumber,
    address.buildingNumber,
    address.buildingName,
    address.street,
    address.town,
    address.postcode
  ].filter(part => part); // Remove empty parts
  
  const formattedAddress = addressParts.join(', ');
  if (formattedAddress) {
    document.getElementById('liteAddress').value = formattedAddress;
  }
  
  // Check if International Address Verification should be shown
  const liteCountry = document.getElementById('liteCountry');
  if (liteCountry) {
    handleLiteCountryChange({ target: liteCountry });
  }
}

/* ===================================
   IDV IMAGE SELECTION
   ===================================
   
   FUNCTIONALITY TO IMPLEMENT:
   
   1. On Document Type Selection (handleIDVDocumentTypeSelection):
      - Show/hide back column based on requiresBack flag
      - If single-sided document (passport): 
        * Hide back column (#idvBackColumn)
        * Update left column label to "Single Photo" (#idvFrontColumnLabel)
        * Look for images with side = "Single" or "Front"
      - If double-sided document (driving licence, national ID, etc): 
        * Show both columns (#idvBackColumn)
        * Update left column label to "Front Photo" (#idvFrontColumnLabel)
        * Back column label stays "Back Photo" (#idvBackColumnLabel)
        * Look for images with side = "Front" and side = "Back"
   
   2. On Client Data Load (in handlePostMessage):
      - Extract all Photo ID images from clientData.idImages array
      - Filter for images where category = "Photo ID"
      - Auto-select best match:
        * If passport/single: Find first single/front image
        * If driving licence/double: Find front and back images
        * Match document type if possible (passport images for passport selection, etc)
      - Store in checkState: idvFrontImage, idvBackImage
   
   3. Display Selected Image:
      - Function: displayIDVImage(column, imageData)
      - Update preview: img.src = imageData.liveUrl or imageData.s3Url
      - Update type: imageData.document (e.g., "Passport", "Driving Licence")
      - Update side: imageData.side (e.g., "Front", "Back", "Single")
      - Update upload info: `Uploaded by ${imageData.uploader} on ${imageData.date}`
      - Show selected view, hide list view
      - Store in checkState
   
   4. Display Image List:
      - Function: displayIDVImageList(column, images)
      - For each Photo ID image, create list item with:
        * Thumbnail preview (80x60px)
        * Document type + side tag
        * Upload info
        * "Open" button (opens in single-image-viewer.html)
        * "Select" button (calls selectIDVImage)
      - Hide selected view, show list view
   
   5. Change Button Handler:
      - Function: handleIDVChangeImage(column)
      - Get all Photo ID images from clientData
      - Call displayIDVImageList(column, photoIDImages)
   
   6. Select Button Handler (in list):
      - Function: selectIDVImage(column, imageData)
      - Store selected image in checkState
      - Call displayIDVImage(column, imageData)
   
   7. Open Button Handler:
      - Function: openIDVImageViewer(imageData)
      - Encode imageData as base64 JSON
      - Open single-image-viewer.html#{base64JSON}
      - imageData format:
        {
          document: "Passport",
          side: "Front",
          name: "Filename.jpg",
          liveUrl: "https://s3.amazonaws.com/...",
          uploader: "email@example.com",
          date: "12/20/2023, 10:30:45 AM"
        }
   
   8. State Management:
      - Add to checkState:
        * idvFrontImage: null (full image object)
        * idvBackImage: null (full image object)
        * availablePhotoIDImages: [] (all Photo ID images)
      
   9. Validation:
      - When IDV is required, ensure:
        * Single-sided docs: front/single image selected
        * Double-sided docs: both front AND back images selected
      - Update form validation accordingly
   
   ===================================
*/

/* ===================================
   KYB HANDLERS
   =================================== */

/**
 * Handle KYB jurisdiction change - show/hide jurisdiction-specific reports
 */
function handleKYBJurisdictionChange(event) {
  const input = event.target;
  const jurisdictionCode = input.dataset.jurisdictionCode;
  
  console.log('KYB Jurisdiction changed to:', jurisdictionCode);
  
  // Get all jurisdiction-specific report cards
  const jurisdictionCards = document.querySelectorAll('.monitoring-card[data-jurisdiction]');
  
  jurisdictionCards.forEach(card => {
    const requiredJurisdiction = card.dataset.jurisdiction;
    
    if (jurisdictionCode === requiredJurisdiction) {
      // Show card for matching jurisdiction
      card.classList.remove('hidden');
    } else {
      // Hide card and uncheck if not matching
      card.classList.add('hidden');
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = false;
      }
    }
  });
  
  // Update checkState
  checkState.kybJurisdiction = jurisdictionCode;
}

/**
 * Handle KYB company search
 */
function handleKYBSearch() {
  const jurisdictionInput = document.getElementById('kybJurisdiction');
  const jurisdictionCode = jurisdictionInput?.dataset.jurisdictionCode || 'GB';
  const companyName = document.getElementById('kybCompanyName').value.trim();
  const companyNumber = document.getElementById('kybCompanyNumber').value.trim();
  
  console.log('KYB Search:', { jurisdictionCode, companyName, companyNumber });
  
  // Validation
  if (!companyName && !companyNumber) {
    alert('Please enter either a company name or company number');
    return;
  }
  
  // Use the extracted search function
  performKYBSearch(jurisdictionCode, companyName, companyNumber);
}

/**
 * Display KYB search results
 */
function displayKYBSearchResults(companies) {
  const resultsContainer = document.getElementById('kybResultsContainer');
  const resultsCount = document.getElementById('kybResultsCount');
  
  if (companies.length === 0) {
    resultsContainer.innerHTML = `
      <div class="kyb-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <p>No companies found. Try adjusting your search criteria.</p>
      </div>
    `;
    resultsCount.classList.add('hidden');
    return;
  }
  
  // Show count
  resultsCount.textContent = `${companies.length} ${companies.length === 1 ? 'result' : 'results'}`;
  resultsCount.classList.remove('hidden');
  
  // Build results HTML
  let html = '';
  companies.forEach(company => {
    const statusClass = company.status === 'active' ? 'active' : 'dissolved';
    
    // Debug: Log company data structure to understand what we're getting
    // console.log('Company data structure:', {
    //   name: company.name,
    //   numbers: company.numbers,
    //   number: company.number,
    //   tag: company.tag,
    //   jurisdiction: company.jurisdiction
    // }); // Commented out to avoid logging client data
    
    // Extract company number from numbers array (Thirdfort API uses plural)
    // Handle cases where numbers array might be undefined (name searches)
    let companyNumber = 'N/A';
    let companyTag = 'Company';
    
    if (company.numbers && Array.isArray(company.numbers) && company.numbers.length > 0) {
      companyNumber = company.numbers[0];
      // If there's a second element, use it as company type
      if (company.numbers.length > 1) {
        companyTag = company.numbers[1];
      }
    } else if (company.number) {
      // Fallback to single number field if numbers array doesn't exist
      companyNumber = company.number;
    }
    
    // Use company.tag if available, otherwise keep the extracted tag
    if (company.tag) {
      companyTag = company.tag;
    }
    
    html += `
      <div class="kyb-company-card" data-company-id="${company.id}" data-company-number="${companyNumber}" data-company-name="${company.name}" data-jurisdiction="${company.jurisdiction}">
        <div class="kyb-company-name">${company.name}</div>
        <div class="kyb-company-meta">
          <div class="kyb-company-meta-item">
            <span class="kyb-company-meta-label">Number:</span> ${companyNumber}
          </div>
          <div class="kyb-company-meta-item">
            <span class="kyb-company-meta-label">Jurisdiction:</span> ${company.jurisdiction}
          </div>
          <div class="kyb-company-meta-item">
            <span class="kyb-company-meta-label">Type:</span> ${companyTag}
          </div>
        </div>
        <span class="kyb-company-status ${statusClass}">${company.status}</span>
      </div>
    `;
  });
  
  resultsContainer.innerHTML = html;
  
  // Add click handlers to result cards
  const companyCards = resultsContainer.querySelectorAll('.kyb-company-card');
  companyCards.forEach(card => {
    card.addEventListener('click', handleKYBCompanySelection);
  });
}

/**
 * Handle KYB company selection from results
 */
function handleKYBCompanySelection(event) {
  const card = event.currentTarget;
  
  // Remove previous selection
  document.querySelectorAll('.kyb-company-card').forEach(c => c.classList.remove('selected'));
  
  // Mark as selected
  card.classList.add('selected');
  
  // Get company data
  const companyData = {
    id: card.dataset.companyId,
    name: card.dataset.companyName,
    number: card.dataset.companyNumber,
    jurisdiction: card.dataset.jurisdiction
  };
  
  // console.log('Company selected:', companyData); // Commented out to avoid logging client data
  
  // Store in checkState
  checkState.kybCompany = companyData;
  checkState.kybJurisdiction = companyData.jurisdiction;
  
  // Disable search inputs
  disableKYBSearchInputs();
  
  // Show "Choose New Company" button
  const changeCompanyBtn = document.getElementById('kybChangeCompanyBtn');
  if (changeCompanyBtn) {
    changeCompanyBtn.classList.remove('hidden');
  }
  
  // Hide results count (not needed when company selected)
  const resultsCount = document.getElementById('kybResultsCount');
  if (resultsCount) {
    resultsCount.classList.add('hidden');
  }
  
  // Show Reports & Documents section with jurisdiction-specific cards
  showKYBReports(companyData.jurisdiction);
  
  // Show PEP monitoring checkbox in confirmation section
  const monitoringCard = document.getElementById('monitoringCard');
  if (monitoringCard) {
    monitoringCard.classList.remove('hidden');
    console.log('✅ PEP monitoring card shown after company selection');
  }
  
  // Show confirmation section
  showSection('confirmationSection');
}

/**
 * Disable KYB search inputs after company selection
 */
function disableKYBSearchInputs() {
  const jurisdictionInput = document.getElementById('kybJurisdiction');
  const nameInput = document.getElementById('kybCompanyName');
  const numberInput = document.getElementById('kybCompanyNumber');
  const searchBtn = document.getElementById('kybSearchBtn');
  
  if (jurisdictionInput) jurisdictionInput.disabled = true;
  if (nameInput) nameInput.disabled = true;
  if (numberInput) numberInput.disabled = true;
  if (searchBtn) searchBtn.disabled = true;
}

/**
 * Enable KYB search inputs
 */
function enableKYBSearchInputs() {
  const jurisdictionInput = document.getElementById('kybJurisdiction');
  const nameInput = document.getElementById('kybCompanyName');
  const numberInput = document.getElementById('kybCompanyNumber');
  const searchBtn = document.getElementById('kybSearchBtn');
  
  if (jurisdictionInput) jurisdictionInput.disabled = false;
  if (nameInput) nameInput.disabled = false;
  if (numberInput) numberInput.disabled = false;
  if (searchBtn) searchBtn.disabled = false;
}

/**
 * Show KYB Reports & Documents section with jurisdiction-specific cards
 */
function showKYBReports(jurisdictionCode) {
  const reportsSection = document.querySelector('.kyb-reports-section');
  
  if (!reportsSection) return;
  
  // Show the reports section
  reportsSection.classList.remove('hidden');
  
  // Get all jurisdiction-specific report cards
  const jurisdictionCards = document.querySelectorAll('.monitoring-card[data-jurisdiction]');
  
  jurisdictionCards.forEach(card => {
    const requiredJurisdiction = card.dataset.jurisdiction;
    
    if (jurisdictionCode === requiredJurisdiction) {
      // Show card for matching jurisdiction
      card.classList.remove('hidden');
    } else {
      // Hide card and uncheck if not matching
      card.classList.add('hidden');
      const checkbox = card.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = false;
      }
    }
  });
  
  // Auto-select default reports (first 3)
  // 1. UBO Report - always auto-select
  const uboCheckbox = document.getElementById('kybIncludeUbo');
  if (uboCheckbox) {
    uboCheckbox.checked = true;
    console.log('✅ Auto-selected: UBO Report');
  }
  
  // 2. PSC Extract - auto-select only for UK
  const pscCheckbox = document.getElementById('kybBeneficialCheck');
  if (pscCheckbox && jurisdictionCode === 'GB') {
    pscCheckbox.checked = true;
    console.log('✅ Auto-selected: PSC Extract (UK)');
  }
  
  // 3. Shareholders List - always auto-select
  const shareholdersCheckbox = document.getElementById('kybShareholders');
  if (shareholdersCheckbox) {
    shareholdersCheckbox.checked = true;
    console.log('✅ Auto-selected: Shareholders List');
  }
  
  // Documents 4-6 remain unchecked (can be requested later via PATCH):
  // - Articles of Association
  // - Annual Accounts & Return
  // Official Register Documents
  
  // Scroll to show reports
  reportsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Handle change company button click
 */
function handleKYBChangeCompany() {
  // Clear selection
  checkState.kybCompany = null;
  checkState.kybJurisdiction = null;
  
  // Hide Reports & Documents section
  const reportsSection = document.querySelector('.kyb-reports-section');
  if (reportsSection) {
    reportsSection.classList.add('hidden');
    
    // Uncheck all report checkboxes
    reportsSection.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
  }
  
  // Hide PEP monitoring card
  const monitoringCard = document.getElementById('monitoringCard');
  if (monitoringCard) {
    monitoringCard.classList.add('hidden');
    // Uncheck monitoring checkbox
    const monitoringCheckbox = document.getElementById('monitoringCheckbox');
    if (monitoringCheckbox) {
      monitoringCheckbox.checked = false;
    }
  }
  
  // Hide confirmation section
  hideSection('confirmationSection');
  
  // Clear and hide results
  const resultsContainer = document.getElementById('kybResultsContainer');
  const resultsCount = document.getElementById('kybResultsCount');
  
  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div class="kyb-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <p>Enter a company name or number and click search to find businesses</p>
      </div>
    `;
  }
  
  if (resultsCount) {
    resultsCount.classList.add('hidden');
  }
  
  // Remove selection from cards
  document.querySelectorAll('.kyb-company-card').forEach(c => c.classList.remove('selected'));
  
  // Hide "Choose New Company" button
  const changeCompanyBtn = document.getElementById('kybChangeCompanyBtn');
  if (changeCompanyBtn) {
    changeCompanyBtn.classList.add('hidden');
  }
  
  // Re-enable search inputs
  enableKYBSearchInputs();
  
  console.log('Company selection cleared - ready for new search');
}

/**
 * Enable or disable check type buttons based on entity type
 */
function updateCheckTypeAvailability(data) {
  const idvLiteBtn = document.querySelector('[data-check-type="idv-lite"]');
  const electronicIdBtn = document.querySelector('[data-check-type="electronic-id"]');
  const kybBtn = document.querySelector('[data-check-type="kyb"]');
  
  // Charity - No check types available
  if (data.c === true) {
    // Show uncloseable error
    showCharityError();
    
    // Disable all check type buttons
    if (idvLiteBtn) {
      idvLiteBtn.disabled = true;
      idvLiteBtn.style.opacity = '0.5';
      idvLiteBtn.style.cursor = 'not-allowed';
    }
    if (electronicIdBtn) {
      electronicIdBtn.disabled = true;
      electronicIdBtn.style.opacity = '0.5';
      electronicIdBtn.style.cursor = 'not-allowed';
    }
    if (kybBtn) {
      kybBtn.disabled = true;
      kybBtn.style.opacity = '0.5';
      kybBtn.style.cursor = 'not-allowed';
    }
    return;
  }
  
  // Business - Only KYB available
  if (data.b === true) {
    // Disable individual check types
    if (idvLiteBtn) {
      idvLiteBtn.disabled = true;
      idvLiteBtn.style.opacity = '0.5';
      idvLiteBtn.style.cursor = 'not-allowed';
      idvLiteBtn.classList.remove('selected');
    }
    if (electronicIdBtn) {
      electronicIdBtn.disabled = true;
      electronicIdBtn.style.opacity = '0.5';
      electronicIdBtn.style.cursor = 'not-allowed';
      electronicIdBtn.classList.remove('selected');
    }
    
    // Enable and auto-select KYB
    if (kybBtn) {
      kybBtn.disabled = false;
      kybBtn.style.opacity = '1';
      kybBtn.style.cursor = 'pointer';
      
      // Auto-select KYB
      kybBtn.classList.add('selected');
      checkState.checkType = 'kyb';
      
      // Show KYB section (no matter category needed for business)
      showSection('kybSection');
      hideSection('matterCategorySection');
    }
    return;
  }
  
  // Individual (default) - IDV & Electronic ID available, KYB disabled
  if (idvLiteBtn) {
    idvLiteBtn.disabled = false;
    idvLiteBtn.style.opacity = '1';
    idvLiteBtn.style.cursor = 'pointer';
  }
  if (electronicIdBtn) {
    electronicIdBtn.disabled = false;
    electronicIdBtn.style.opacity = '1';
    electronicIdBtn.style.cursor = 'pointer';
  }
  if (kybBtn) {
    kybBtn.disabled = true;
    kybBtn.style.opacity = '0.5';
    kybBtn.style.cursor = 'not-allowed';
    kybBtn.classList.remove('selected');
  }
  
  // Don't auto-show matter category - keep it hidden until user selects a check type
  // showSection('matterCategorySection');
  hideSection('kybSection');
}

/**
 * Show uncloseable error for charity
 */
function showCharityError() {
  const errorPopup = document.getElementById('errorPopup');
  const errorMessage = document.getElementById('errorMessage');
  const closeButton = document.getElementById('closeError');
  
  if (errorPopup && errorMessage) {
    errorMessage.textContent = 'There are no available check types for charity, please close the request window';
    errorPopup.classList.remove('hidden');
    
    // Hide close button for charity error (uncloseable)
    if (closeButton) {
      closeButton.style.display = 'none';
    }
  }
}

/* ===================================
   VALIDATION & REQUEST CONSTRUCTION
   =================================== */

/**
 * Validate phone number (international format) - basic regex check
 */
function validatePhone(phone) {
  if (!phone) return false;
  const pattern = /^\+[1-9]\d{1,14}$/;
  return pattern.test(phone);
}

/**
 * Enhanced phone validation using Google libphonenumber
 * Returns: { valid: boolean, error: string|null, formatted: string|null }
 */
function validatePhoneWithLibphonenumber(countryCode, nationalNumber) {
  // Check if libphonenumber is loaded
  if (typeof libphonenumber === 'undefined') {
    console.warn('⚠️ libphonenumber not loaded, falling back to basic validation');
    const fullPhone = `${countryCode}${nationalNumber}`;
    return {
      valid: validatePhone(fullPhone),
      error: validatePhone(fullPhone) ? null : 'Invalid phone number format',
      formatted: fullPhone
    };
  }
  
  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const fullPhoneNumber = `${countryCode}${nationalNumber}`;
    
    // Parse the phone number
    const number = phoneUtil.parseAndKeepRawInput(fullPhoneNumber, null);
    
    // Validate the number
    const isValid = phoneUtil.isValidNumber(number);
    
    if (!isValid) {
      return {
        valid: false,
        error: 'Phone number is not valid for the selected country',
        formatted: null
      };
    }
    
    // Check if it's a mobile or mobile-capable number
    // PhoneNumberType values: 0 = FIXED_LINE, 1 = MOBILE, 2 = FIXED_LINE_OR_MOBILE
    const numberType = phoneUtil.getNumberType(number);
    const isMobileType = (numberType === 1 || numberType === 2);
    
    if (!isMobileType) {
      return {
        valid: false,
        error: 'Phone number must be a mobile number (Thirdfort requires mobile for app access)',
        formatted: null
      };
    }
    
    // Format in E.164 format (use integer 0, CDN doesn't expose enum)
    const formatted = phoneUtil.format(number, 0);
    
    return {
      valid: true,
      error: null,
      formatted: formatted
    };
  } catch (error) {
    console.error('libphonenumber validation error:', error);
    return {
      valid: false,
      error: 'Could not parse phone number. Please check the format.',
      formatted: null
    };
  }
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email) return true; // Email is optional
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return pattern.test(email);
}

/**
 * Validate required text field
 */
function validateTextField(value, minLength = 1) {
  return value && value.trim().length >= minLength;
}

/**
 * Validate address object for UK
 */
function validateUKAddress(address) {
  if (!address) return false;
  return (
    address.country === 'GBR' &&
    validateTextField(address.town) &&
    validateTextField(address.postcode) &&
    (validateTextField(address.building_number) || validateTextField(address.building_name) || validateTextField(address.flat_number))
  );
}

/**
 * Validate address object for US/Canada
 */
function validateUSCanadaAddress(address) {
  if (!address) return false;
  return (
    (address.country === 'USA' || address.country === 'CAN') &&
    validateTextField(address.town) &&
    validateTextField(address.state, 2) &&
    validateTextField(address.postcode) &&
    validateTextField(address.address_1)
  );
}

/**
 * Validate address object for other countries
 */
function validateInternationalAddress(address) {
  if (!address) return false;
  return (
    validateTextField(address.country, 3) &&
    validateTextField(address.town) &&
    validateTextField(address.address_1)
  );
}

/**
 * Validate address based on country
 */
function validateAddress(address) {
  if (!address || !address.country) return false;
  
  if (address.country === 'GBR') {
    return validateUKAddress(address);
  } else if (address.country === 'USA' || address.country === 'CAN') {
    return validateUSCanadaAddress(address);
  } else {
    return validateInternationalAddress(address);
  }
}

/**
 * Validate Lite Screen check requirements
 * Returns: { valid: boolean, errors: string[] }
 */
function validateLiteScreen() {
  const errors = [];
  
  // Get form values
  const firstName = document.getElementById('liteFirstName')?.value;
  const lastName = document.getElementById('liteLastName')?.value;
  
  // Get DOB from 8 separate inputs
  const dobDigits = [
    document.getElementById('liteDob1')?.value || '',
    document.getElementById('liteDob2')?.value || '',
    document.getElementById('liteDob3')?.value || '',
    document.getElementById('liteDob4')?.value || '',
    document.getElementById('liteDob5')?.value || '',
    document.getElementById('liteDob6')?.value || '',
    document.getElementById('liteDob7')?.value || '',
    document.getElementById('liteDob8')?.value || ''
  ].join('');
  
  // Get address from stored object
  const address = liteCurrentAddressObject || litePreviousAddressObject;
  
  // Validate name
  if (!validateTextField(firstName)) {
    errors.push('First name is required for Lite Screen');
  }
  if (!validateTextField(lastName)) {
    errors.push('Last name is required for Lite Screen');
  }
  
  // Validate date of birth (must be exactly 8 digits)
  if (dobDigits.length !== 8 || !/^\d{8}$/.test(dobDigits)) {
    errors.push('Date of birth is required for Lite Screen (DDMMYYYY format)');
  }
  
  // Validate address (ONLY for "AML & Address Screening")
  // "AML Only" just screens name/DOB against watchlists, no address needed
  if (checkState.liteScreenType === 'aml-address') {
    if (!address) {
      errors.push('Address is required for AML & Address Screening');
    } else if (!validateAddress(address)) {
      errors.push('Valid address is required for AML & Address Screening (check required fields for country)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate IDV check requirements
 * Returns: { valid: boolean, errors: string[] }
 */
function validateIDV() {
  const errors = [];
  
  // IDV requires selection
  if (checkState.includeIDV === null) {
    errors.push('Please select YES or NO for IDV check');
    return { valid: false, errors: errors };
  }
  
  // If NO, no further validation needed
  if (!checkState.includeIDV) {
    return { valid: true, errors: [] };
  }
  
  // Get form values
  const firstName = document.getElementById('idvFirstName')?.value;
  const lastName = document.getElementById('idvLastName')?.value;
  
  // Validate name
  if (!validateTextField(firstName)) {
    errors.push('First name is required for IDV check');
  }
  if (!validateTextField(lastName)) {
    errors.push('Last name is required for IDV check');
  }
  
  // Validate document type selection
  if (!checkState.idvDocumentType) {
    errors.push('Please select an ID document type');
  }
  
  // Validate image selection
  if (!checkState.frontImage) {
    errors.push('Please select a front image for the ID document');
  }
  
  if (checkState.idvRequiresBack && !checkState.backImage) {
    errors.push('Please select a back image for the ID document');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate Electronic ID check requirements
 * Returns: { valid: boolean, errors: string[] }
 */
function validateElectronicID() {
  const errors = [];
  
  // Validate matter category/subtype selection
  if (!checkState.matterCategory) {
    errors.push('Please select a matter category');
    return { valid: false, errors: errors };
  }
  
  // If conveyancing or property other, need subtype
  if ((checkState.matterCategory === 'conveyancing' || checkState.matterCategory === 'property-other') && !checkState.matterSubCategory) {
    errors.push('Please select a matter sub-category');
    return { valid: false, errors: errors };
  }
  
  // Get form values
  const fullName = document.getElementById('electronicIdFullName')?.value;
  const mobile = document.getElementById('electronicIdMobile')?.value;
  const email = document.getElementById('electronicIdEmail')?.value;
  const countryCodeInput = document.getElementById('electronicIdCountryCode');
  const countryCode = countryCodeInput?.dataset.phoneCode; // Extract from data-phone-code attribute
  const reference = document.getElementById('electronicIdReference')?.value;
  
  // Validate name
  if (!validateTextField(fullName, 2)) {
    errors.push('Full name is required for Electronic ID');
  }
  
  // Validate mobile with country code using libphonenumber
  if (!countryCode || !mobile) {
    errors.push('Mobile number with country code is required for Electronic ID');
  } else {
    const phoneValidation = validatePhoneWithLibphonenumber(countryCode, mobile);
    if (!phoneValidation.valid) {
      errors.push(phoneValidation.error || 'Invalid mobile number for Electronic ID');
    }
  }
  
  // Validate email (optional but if provided must be valid)
  if (email && !validateEmail(email)) {
    errors.push('Email format is invalid');
  }
  
  // Validate reference
  if (!validateTextField(reference)) {
    errors.push('Check reference is required for Electronic ID');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate KYB check requirements
 * Returns: { valid: boolean, errors: string[] }
 */
function validateKYB() {
  const errors = [];
  
  // Get form values
  const jurisdiction = document.getElementById('kybJurisdiction')?.value;
  const companyName = document.getElementById('kybCompanyName')?.value;
  const companyNumber = document.getElementById('kybCompanyNumber')?.value;
  
  // Validate jurisdiction
  if (!validateTextField(jurisdiction, 2)) {
    errors.push('Jurisdiction is required for KYB check');
  }
  
  // Validate company name or number (at least one required)
  if (!validateTextField(companyName) && !validateTextField(companyNumber)) {
    errors.push('Either company name or company number is required for KYB check');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Main validation function - validates all selected check types
 * Returns: { valid: boolean, errors: string[] }
 */
function validateAllChecks() {
  const allErrors = [];
  
  // Validate based on selected check type
  if (checkState.checkType === 'idv-lite') {
    // Validate Lite Screen if YES
    if (checkState.includeLiteScreen) {
      const liteResult = validateLiteScreen();
      if (!liteResult.valid) {
        allErrors.push(...liteResult.errors);
      }
    }
    
    // Validate IDV if YES
    if (checkState.includeIDV) {
      const idvResult = validateIDV();
      if (!idvResult.valid) {
        allErrors.push(...idvResult.errors);
      }
    }
    
    // At least one must be selected (explicit false check, not just falsy)
    const hasLiteScreen = checkState.includeLiteScreen === true;
    const hasIDV = checkState.includeIDV === true;
    
    console.log('🔍 Lite/IDV selection check:', { 
      includeLiteScreen: checkState.includeLiteScreen, 
      includeIDV: checkState.includeIDV,
      hasLiteScreen,
      hasIDV
    });
    
    if (!hasLiteScreen && !hasIDV) {
      allErrors.push('Please select at least one check type (Lite Screen or IDV)');
    }
  } else if (checkState.checkType === 'electronic-id') {
    const electronicResult = validateElectronicID();
    if (!electronicResult.valid) {
      allErrors.push(...electronicResult.errors);
    }
  } else if (checkState.checkType === 'kyb') {
    const kybResult = validateKYB();
    if (!kybResult.valid) {
      allErrors.push(...kybResult.errors);
    }
  } else {
    allErrors.push('Please select a check type');
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors
  };
}

/**
 * Build Lite Screen transaction request object
 * Returns: Object for /v2/transactions endpoint
 */
function buildLiteScreenRequest() {
  // Get form values
  const firstName = document.getElementById('liteFirstName')?.value.trim();
  const middleName = document.getElementById('liteMiddleName')?.value.trim();
  const lastName = document.getElementById('liteLastName')?.value.trim();
  
  // Get DOB from 8 separate inputs
  const dobDigits = [
    document.getElementById('liteDob1')?.value || '',
    document.getElementById('liteDob2')?.value || '',
    document.getElementById('liteDob3')?.value || '',
    document.getElementById('liteDob4')?.value || '',
    document.getElementById('liteDob5')?.value || '',
    document.getElementById('liteDob6')?.value || '',
    document.getElementById('liteDob7')?.value || '',
    document.getElementById('liteDob8')?.value || ''
  ].join('');
  
  const countryCode = document.getElementById('liteCountry')?.value;
  
  // Get active address
  const address = liteActiveAddressType === 'current' ? liteCurrentAddressObject : litePreviousAddressObject;
  
  // Get monitoring checkbox states (only if visible)
  const pepMonitoringCard = document.getElementById('monitoringCard');
  const pepMonitoringCheckbox = document.getElementById('ongoingMonitoring');
  const pepMonitoringEnabled = pepMonitoringCard && !pepMonitoringCard.classList.contains('hidden') && pepMonitoringCheckbox?.checked;
  
  const internationalAddressCard = document.getElementById('internationalAddressCard');
  const internationalAddressCheckbox = document.getElementById('internationalAddressVerification');
  const internationalAddressEnabled = internationalAddressCard && !internationalAddressCard.classList.contains('hidden') && internationalAddressCheckbox?.checked;
  
  // Convert DDMMYYYY to ISO 8601
  let isoDate = '';
  if (dobDigits && dobDigits.length === 8) {
    const day = dobDigits.substring(0, 2);
    const month = dobDigits.substring(2, 4);
    const year = dobDigits.substring(4, 8);
    isoDate = `${year}-${month}-${day}T00:00:00.000Z`;
  }
  
  // Build expectations and tasks based on screening type
  let expectations;
  let tasks;
  
  if (checkState.liteScreenType === 'aml-only') {
    // AML Only: Standalone screening with year of birth
    const year = dobDigits.length === 8 ? dobDigits.substring(4, 8) : '';
    const countryData = document.getElementById('liteCountry')?.dataset.countryCode || 'GBR';
    
    expectations = {
      'name:lite': {
        data: {
          first: firstName,
          last: lastName
        }
      },
      yob: {
        data: year
      },
      country: {
        data: countryData
      }
    };
    
    if (middleName) {
      expectations['name:lite'].data.other = middleName;
    }
    
    tasks = [
      {
        type: 'report:screening:lite',
        opts: {
          monitored: pepMonitoringEnabled || false
        }
      }
    ];
    
  } else {
    // AML & Address: Full screening with DOB and address
    expectations = {
    name: {
      data: {
        first: firstName,
        last: lastName
      }
    },
    dob: {
      data: isoDate
    }
  };
  
  if (middleName) {
    expectations.name.data.other = middleName;
  }
  
    // Add address for AML & Address screening
    if (address) {
    expectations.address = {
      data: address
    };
  }
  
    tasks = [
    {
      type: 'report:footprint',
      opts: {
        consent: internationalAddressEnabled && countryCode !== 'GBR'
      }
    },
    {
      type: 'report:peps',
      opts: {
          monitored: pepMonitoringEnabled || false
      }
    }
  ];
  }
  
  // Get check reference from client data and prepend Val'ID'ate
  const internalRef = checkState.checkReference || checkState.clientData?.mD || 'Lite Screening Check';
  const formattedRef = `Val'ID'ate: ${internalRef}`;
  const checkName = `${firstName} ${lastName} - Lite Screening`;
  
  return {
    type: 'v2',
    ref: formattedRef, // Prepend Val'ID'ate to identify API-initiated checks
    name: checkName,
    request: {
      expectations: expectations,
      tasks: tasks
    }
  };
}

/**
 * Build Electronic ID transaction request object
 * Returns: Object for /v2/transactions endpoint
 */
function buildElectronicIDRequest() {
  // Get form values
  const fullName = document.getElementById('electronicIdFullName')?.value.trim();
  const mobile = document.getElementById('electronicIdMobile')?.value.trim();
  const email = document.getElementById('electronicIdEmail')?.value.trim();
  const countryCodeInput = document.getElementById('electronicIdCountryCode');
  const countryCode = countryCodeInput?.dataset.phoneCode; // Extract from data-phone-code attribute
  const reference = document.getElementById('electronicIdReference')?.value.trim();
  const country = document.getElementById('electronicIdCountry')?.value;
  
  // Build full phone number - use formatted version from libphonenumber if available
  let fullPhone = `${countryCode}${mobile}`;
  const phoneValidation = validatePhoneWithLibphonenumber(countryCode, mobile);
  if (phoneValidation.valid && phoneValidation.formatted) {
    fullPhone = phoneValidation.formatted;
    console.log(`📞 Using formatted phone number: ${fullPhone}`);
  }
  
  // Build actor object
  const actor = {
    name: fullName,
    phone: fullPhone
  };
  
  // Add email if provided
  if (email) {
    actor.email = email;
  }
  
  // Set actor type based on currently selected matter sub-category
  // (not client data relation, as user may have changed the selection)
  if (checkState.matterSubCategory === 'giftor') {
    actor.type = 'giftor';
  }
  
  // Build tasks array based on check type and visible checkboxes
  const tasks = [];
  
  // Add identity check based on type
  if (checkState.electronicIdType === 'standard') {
    tasks.push({
      type: 'report:identity',
      opts: {
        nfc: 'preferred' // Enhanced NFC ID
      }
    });
  }
  
  // Add footprint (address verification) - ONLY for standard ID, not additional tasks
  if (checkState.electronicIdType === 'standard') {
  const internationalAddressCard = document.getElementById('internationalAddressCard');
  const internationalAddressCheckbox = document.getElementById('internationalAddressVerification');
  const internationalAddressEnabled = !internationalAddressCard.classList.contains('hidden') && internationalAddressCheckbox?.checked;
  
  tasks.push({
    type: 'report:footprint',
    opts: {
      consent: internationalAddressEnabled && country !== 'GBR'
    }
  });
  }
  
  // Add PEPs screening (only for standard ID type)
  if (checkState.electronicIdType === 'standard') {
    const pepMonitoringCard = document.getElementById('monitoringCard');
    const pepMonitoringCheckbox = document.getElementById('ongoingMonitoring');
    const pepMonitoringEnabled = pepMonitoringCard && !pepMonitoringCard.classList.contains('hidden') && pepMonitoringCheckbox?.checked;
    
    tasks.push({
      type: 'report:peps',
      opts: {
        monitored: pepMonitoringEnabled
      }
    });
  }
  
  // Add proof of address (always included as option)
  const proofOfAddressCard = document.getElementById('proofOfAddressCard');
  if (proofOfAddressCard && !proofOfAddressCard.classList.contains('hidden')) {
    tasks.push({
      type: 'documents:poa'
    });
  }
  
  // Add proof of ownership (only if visible and checked)
  const proofOfOwnershipCard = document.getElementById('proofOfOwnershipCard');
  const proofOfOwnershipCheckbox = document.getElementById('proofOfOwnership');
  if (proofOfOwnershipCard && !proofOfOwnershipCard.classList.contains('hidden') && proofOfOwnershipCheckbox?.checked) {
    tasks.push({
      type: 'documents:poo'
    });
  }
  
  // Add eSoF questionnaire (only if visible and checked)
  const esofQuestionnaireCard = document.getElementById('esofQuestionnaireCard');
  const esofQuestionnaireCheckbox = document.getElementById('esofQuestionnaire');
  if (!esofQuestionnaireCard.classList.contains('hidden') && esofQuestionnaireCheckbox?.checked) {
    tasks.push({
      type: 'report:sof-v1'
    });
  }
  
  // Add eSoW bank linking (only if visible and checked)
  const esowBankLinkingCard = document.getElementById('esowBankLinkingCard');
  const esowBankLinkingCheckbox = document.getElementById('esowBankLinking');
  if (!esowBankLinkingCard.classList.contains('hidden') && esowBankLinkingCheckbox?.checked) {
    tasks.push({
      type: 'report:bank-statement'
    });
    tasks.push({
      type: 'report:bank-summary'
    });
  }
  
  // Build custom description based on matter category and subcategory
  let description;
  
  if (checkState.matterCategory === 'conveyancing' || checkState.matterCategory === 'property-other') {
    // For conveyancing/property-other: use subcategory + property address
    const subCategoryMap = {
      'purchaser': 'Purchase of',
      'seller': 'Sale of', 
      'landlord': 'Letting of',
      'tenant': 'Occupier\'s consent for',
      'giftor': 'Gift towards purchase of',
      'other': ''
    };
    
    const prefix = subCategoryMap[checkState.matterSubCategory] || checkState.matterSubCategory;
    description = prefix ? `${prefix} ${reference}` : reference;
  } else {
    // For private-client/other: just use the ID check reference as-is
    description = reference;
  }
  
  // ref = Internal check reference (from top input, e.g., "50/52") with Val'ID'ate prefix
  // name = Formatted description for SMS (e.g., "Sale of 21 Green Lane" OR "Estate of John Smith")
  const internalRef = checkState.checkReference || reference;
  const formattedRef = `Val'ID'ate: ${internalRef}`;
  
  return {
    type: 'v2',
    ref: formattedRef, // Prepend Val'ID'ate to identify API-initiated checks
    name: description,
    request: {
      actor: actor,
      tasks: tasks
    }
  };
}

/**
 * Build IDV documents object with S3 keys
 * Returns: Array of {side: 'front'|'back', s3Key: 'protected/...'} objects
 */
function buildIDVDocumentsObject() {
  const documents = [];
  
  if (checkState.frontImage) {
    // Extract S3 key from image object
    // Image may have: s3Key, src, url, or liveUrl
    const s3Key = checkState.frontImage.s3Key || 
                  extractS3KeyFromUrl(checkState.frontImage.src) || 
                  extractS3KeyFromUrl(checkState.frontImage.url) || 
                  extractS3KeyFromUrl(checkState.frontImage.liveUrl);
    
    if (s3Key) {
      documents.push({
        side: 'front',
        s3Key: s3Key
      });
    } else {
      console.error('❌ Front image has no valid S3 key:', checkState.frontImage);
    }
  }
  
  if (checkState.backImage) {
    // Extract S3 key from image object
    const s3Key = checkState.backImage.s3Key || 
                  extractS3KeyFromUrl(checkState.backImage.src) || 
                  extractS3KeyFromUrl(checkState.backImage.url) || 
                  extractS3KeyFromUrl(checkState.backImage.liveUrl);
    
    if (s3Key) {
      documents.push({
        side: 'back',
        s3Key: s3Key
      });
    } else {
      console.error('❌ Back image has no valid S3 key:', checkState.backImage);
    }
  }
  
  console.log('📎 Built IDV documents array:', documents);
  return documents;
}

/**
 * Extract S3 key from CloudFront or S3 URL
 * Examples:
 *  - https://d123abc.cloudfront.net/protected/abc123.jpg → protected/abc123.jpg
 *  - https://bucket.s3.region.amazonaws.com/protected/abc123.jpg → protected/abc123.jpg
 */
function extractS3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  // CloudFront URL pattern: https://d123abc.cloudfront.net/protected/abc123.jpg
  const cloudfrontMatch = url.match(/cloudfront\.net\/(.+)$/);
  if (cloudfrontMatch) {
    return cloudfrontMatch[1];
  }
  
  // S3 URL pattern: https://bucket.s3.region.amazonaws.com/protected/abc123.jpg
  const s3Match = url.match(/\.amazonaws\.com\/(.+)$/);
  if (s3Match) {
    return s3Match[1];
  }
  
  // If it's already just a key (no https://), return as-is
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  
  console.warn('⚠️ Could not extract S3 key from URL:', url);
  return null;
}

/**
 * Build KYB check request object
 * Returns: Object for /v2/checks endpoint
 */
function buildKYBRequest() {
  // Get form values
  const jurisdiction = document.getElementById('kybJurisdiction')?.value.trim();
  const companyName = document.getElementById('kybCompanyName')?.value.trim();
  const companyNumber = document.getElementById('kybCompanyNumber')?.value.trim();
  
  // Get monitoring checkbox state (correct ID)
  const monitoringCheckbox = document.getElementById('ongoingMonitoring');
  const monitoringEnabled = monitoringCheckbox?.checked || false;
  
  // Get check reference from client data and prepend Val'ID'ate
  const internalRef = checkState.checkReference || checkState.clientData?.mD || 'KYB Check';
  const checkRef = `Val'ID'ate: ${internalRef}`;
  
  // Use jurisdiction from selected company if available, otherwise use form value
  // Convert to Thirdfort jurisdiction code if needed
  const finalJurisdiction = checkState.kybCompany?.jurisdiction || jurisdiction;
  const thirdfortJurisdiction = convertJurisdictionForThirdfort(finalJurisdiction);
  
  console.log('🌍 Jurisdiction conversion:', {
    original: finalJurisdiction,
    converted: thirdfortJurisdiction,
    fromSelectedCompany: !!checkState.kybCompany?.jurisdiction
  });
  
  // Build company data object
  const companyData = {
    jurisdiction: thirdfortJurisdiction,
    number: companyNumber
  };
  
  // Add company name if provided
  if (companyName) {
    companyData.name = companyName;
  }
  
  // If we have a stored company object from search, use its ID
  if (checkState.kybCompany?.id) {
    companyData.id = checkState.kybCompany.id;
  }
  
  // Build reports array based on checkbox selections
  const reports = [];
  
  // Always include company summary
  reports.push({
    type: 'company:summary'
  });
  
  // Always include sanctions report with monitoring option
  reports.push({
    type: 'company:sanctions',
    opts: {
      monitored: monitoringEnabled
    }
  });
  
  // Add selected KYB reports based on checkboxes
  const kybReportCheckboxes = document.querySelectorAll('.kyb-reports-section input[type="checkbox"]:checked');
  kybReportCheckboxes.forEach(checkbox => {
    const reportTypes = checkbox.dataset.reportType.split(',');
    reportTypes.forEach(reportType => {
      reports.push({
        type: reportType.trim()
      });
    });
  });
  
  console.log('📋 KYB Reports selected:', reports);
  
  return {
    type: 'company',
    ref: checkRef,
    request: {
      data: companyData,
      reports: reports
    }
  };
}

/**
 * Build complete request data for all selected checks
 * Returns: Array of {endpoint: string, body: object} objects
 */
function buildCompleteRequest() {
  const requests = [];
  
  if (checkState.checkType === 'idv-lite') {
    // Lite Screen request
    if (checkState.includeLiteScreen) {
      requests.push({
        endpoint: '/v2/transactions',
        checkType: 'lite-screen',
        body: buildLiteScreenRequest()
      });
    }
    
    // IDV request (if YES)
    if (checkState.includeIDV) {
      // Note: IDV uses the same endpoint as Electronic ID but with identity task
      // We'll construct it similar to Electronic ID but simpler
      const firstName = document.getElementById('idvFirstName')?.value.trim();
      const middleName = document.getElementById('idvMiddleName')?.value.trim();
      const lastName = document.getElementById('idvLastName')?.value.trim();
      
      const fullName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
      const phone = checkState.clientData?.cI?.m?.m;
      const countryCode = checkState.clientData?.cI?.m?.c || '+44';
      const fullPhone = phone ? `${countryCode}${phone}` : null;
      
      if (fullPhone) {
        // Get internal reference and prepend Val'ID'ate
        const internalRef = checkState.checkReference || checkState.clientData?.mD || 'IDV Check';
        const formattedRef = `Val'ID'ate: ${internalRef}`;
        
        const idvRequest = {
          type: 'v2',
          ref: formattedRef, // Prepend Val'ID'ate to identify API-initiated checks
          name: `${fullName} - IDV Check`,
          request: {
            actor: {
              name: fullName,
              phone: fullPhone
            },
            tasks: [
              {
                type: 'report:identity',
                opts: {
                  nfc: 'preferred'
                }
              },
              {
                type: 'report:footprint'
              },
              {
                type: 'report:peps'
              },
              {
                type: 'documents:poa'
              }
            ]
          }
        };
        
        requests.push({
          endpoint: '/v2/transactions',
          checkType: 'idv',
          body: idvRequest
        });
      }
      
      // IDV documents object (separate)
      const documents = buildIDVDocumentsObject();
      if (documents.length > 0) {
        requests.push({
          endpoint: 'idv-documents',
          checkType: 'idv-documents',
          body: {
            documentType: checkState.idvDocumentType,
            documents: documents
          }
        });
      }
    }
  } else if (checkState.checkType === 'electronic-id') {
    requests.push({
      endpoint: '/v2/transactions',
      checkType: 'electronic-id',
      body: buildElectronicIDRequest()
    });
  } else if (checkState.checkType === 'kyb') {
    requests.push({
      endpoint: '/v2/checks',
      checkType: 'kyb',
      body: buildKYBRequest()
    });
  }
  
  return requests;
}

/**
 * Submit check request(s) to parent
 * Routes to appropriate handler based on check type
 */
function submitCheckRequest() {
  console.log('🚀 Submitting check request...');
  
  // Validate all checks
  const validation = validateAllChecks();
  
  if (!validation.valid) {
    console.error('❌ Validation failed:', validation.errors);
    showValidationErrors(validation.errors);
    return;
  }
  
  console.log('✅ Validation passed');
  
  // Route to appropriate handler based on check type
  if (checkState.checkType === 'kyb') {
    submitKYBCheck();
  } else if (checkState.checkType === 'electronic-id') {
    submitElectronicIDCheck();
  } else if (checkState.checkType === 'idv-lite') {
    submitLiteIDVCheck();
  }
  
  console.log('✅ Request sent to parent');
}

/**
 * Submit KYB check
 */
function submitKYBCheck() {
  const kybData = buildKYBRequest();
  
  const payload = {
    clientId: checkState.clientData?._id,
    timestamp: new Date().toISOString(),
    data: kybData
  };
  
  console.log('📤 Submitting KYB check:', payload);
  
  window.parent.postMessage({
    type: 'kyb-check',
    data: kybData,
    clientId: checkState.clientData?._id,
    timestamp: new Date().toISOString()
  }, '*');
}

/**
 * Submit Electronic ID check
 */
function submitElectronicIDCheck() {
  const electronicData = buildElectronicIDRequest();
  
  const payload = {
    clientId: checkState.clientData?._id,
    timestamp: new Date().toISOString(),
    data: electronicData
  };
  
  console.log('📤 Submitting Electronic ID check:', payload);
  
  window.parent.postMessage({
    type: 'electronic-check',
    data: electronicData,
    clientId: checkState.clientData?._id,
    timestamp: new Date().toISOString()
  }, '*');
}

/**
 * Submit Lite Screen and/or IDV check
 */
function submitLiteIDVCheck() {
  console.log('🔍 Lite/IDV check state:', {
    includeLiteScreen: checkState.includeLiteScreen,
    includeIDV: checkState.includeIDV,
    idvDocumentType: checkState.idvDocumentType,
    frontImage: !!checkState.frontImage,
    backImage: !!checkState.backImage
  });
  
  const payload = {
    clientId: checkState.clientData?._id,
    timestamp: new Date().toISOString()
  };
  
  // Build Lite Screen data (if selected)
  if (checkState.includeLiteScreen) {
    payload.liteScreen = buildLiteScreenRequest();
    console.log('✅ Lite Screen included in payload');
  }
  
  // Build IDV data (if selected)
  if (checkState.includeIDV) {
    console.log('✅ Building IDV object...');
    const firstName = document.getElementById('idvFirstName')?.value.trim();
    const middleName = document.getElementById('idvMiddleName')?.value.trim();
    const lastName = document.getElementById('idvLastName')?.value.trim();
    const fullName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
    
    // Build IDV check request (document verification doesn't require phone)
    const internalRef = checkState.checkReference || checkState.clientData?.mD || 'IDV Check';
    const formattedRef = `Val'ID'ate: ${internalRef}`;
    
    payload.idv = {
      type: 'document',
      ref: formattedRef, // Prepend Val'ID'ate to identify API-initiated checks
      name: `${fullName} - Document Verification`,
      request: {
        data: {
          name: {
            first: firstName,
            last: lastName,
            other: middleName || undefined
          }
        },
        reports: [
          { type: 'identity:lite' }
        ]
      }
    };
    
    // Add document images (S3 keys for backend to download and upload to Thirdfort)
    const documents = buildIDVDocumentsObject();
    if (documents.length > 0) {
      payload.idvDocuments = {
        documentType: checkState.idvDocumentType,
        documents: documents  // Array of {s3Key, side}
      };
      console.log('✅ IDV documents included:', payload.idvDocuments);
    } else {
      console.warn('⚠️ IDV selected but no documents found');
    }
    
    console.log('✅ IDV object added to payload');
  } else {
    console.log('ℹ️ IDV not included (includeIDV = false or null)');
  }
  
  console.log('📤 Submitting Lite/IDV check:', payload);
  
  window.parent.postMessage({
    type: 'lite-idv-check',
    data: payload,
    timestamp: new Date().toISOString()
  }, '*');
}

/**
 * Show validation errors to user
 */
function showValidationErrors(errors) {
  const errorPopup = document.getElementById('errorPopup');
  const errorMessage = document.getElementById('errorMessage');
  
  if (errorPopup && errorMessage) {
    const errorList = errors.map(err => `• ${err}`).join('\n');
    errorMessage.textContent = `Please fix the following errors:\n\n${errorList}`;
    errorPopup.classList.remove('hidden');
  }
}

