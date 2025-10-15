    /*
    =====================================================================
    CLIENT DETAILS FORM - JAVASCRIPT
    =====================================================================
    
    GLOBAL STATE:
    - formData: Client data from parent
    - currentAddressObject: Thirdfort-formatted current address
    - previousAddressObject: Thirdfort-formatted previous address
    - addressDebounceTimer: Debounce timer for current address
    - previousAddressDebounceTimer: Debounce timer for previous address
    - isEntityMode: Boolean flag for entity vs individual mode
    
    PARENT-CHILD COMMUNICATION:
    
    INCOMING MESSAGES:
    1. 'client-data' - Load client data with structure:
       {
         type: 'client-data',
         entity: true/false,     // Controls entity vs individual mode
         entityType: 'business'/'charity', // Type of entity (when entity=true)
         allowEdits: true/false, // Controls if user can edit inputs (default: true)
         clientData: {
           n: { t, f, m, l, b },  // name: titlePrefix, firstName, middleNames, surname, businessName/charityName
           b: '01-01-2000',       // dateOfBirth
           a: {...},              // currentAddressNEW (Thirdfort object)
           pA: {...},             // previousAddressNEW (Thirdfort object)
           rM: true/false,        // clientRecentHomeMove
           nC: true/false,        // clientRecentNameChange
           pN: 'Previous Name',   // previousName
           rNC: 'Reason',         // reasonForNameChange
           m: '+447700000000',    // mobileNumber (international format)
           e: 'email@test.com',   // email
           eN: 'EN123456',        // entityNumber (company OR charity number)
           rC: 'GB',              // registrationCountry
           eT: 'business'/'charity', // entityType
           bD: {...}              // businessData (company: directors/officers/PSCs, charity: trustees)
         }
       }
    2. 'entity-true' - Toggle entity mode { type: 'entity-true', entityType: 'business'/'charity' }
    3. 'entity-false' - Toggle individual mode
    4. 'allowEdits-true' / 'allowEdits-false' - Enable/disable user input
    5. 'request-data' - Parent requests form data (validate and return)
    6. 'address-results' - Autocomplete suggestions from getaddress.io
    7. 'address-data' - Full address object after selection
    8. 'company-results' - Company search results from Companies House API
    9. 'company-data' - Full company data (directors, officers, PSCs, registered office)
    10. 'charity-results' - Charity search results from Charity Commission API
    11. 'charity-data' - Full charity data (trustees, income, expenditure)
    
    OUTGOING MESSAGES:
    1. 'address-search' - Request autocomplete suggestions
    2. 'address-lookup' - Request full address by ID
    3. 'company-search' - Request Companies House search { type, searchTerm, searchBy, entityType: 'business' }
    4. 'company-lookup' - Request full company data { type, companyNumber, entityType: 'business' }
    5. 'charity-search' - Request Charity Commission search { type, searchTerm, searchBy, entityType: 'charity' }
    6. 'charity-lookup' - Request full charity data { type, companyNumber, entityType: 'charity' }
    7. 'new-data' - Send updated client data (includes eT: entityType)
    8. 'validation-error' - Send validation errors
    9. 'disable-close' - Notify parent of unsaved changes
    =====================================================================
    */
    
    // DOM Elements
    const detailsSection = document.getElementById('detailsSection');
    const clientForm = document.getElementById('clientForm');
    const errorPopup = document.getElementById('errorPopup');
    const errorMessage = document.getElementById('errorMessage');
    const closeError = document.getElementById('closeError');
    
    // Entity mode containers
    const entityFields = document.getElementById('entityFields');
    const individualFields = document.getElementById('individualFields');
    const entityNumberRow = document.getElementById('entityNumberRow');
    const nameChangeDobRow = document.getElementById('nameChangeDobRow');
    
    // Entity mode inputs
    const registrationCountry = document.getElementById('registrationCountry');
    const businessName = document.getElementById('businessName');
    const businessNameDropdown = document.getElementById('businessNameDropdown');
    const entityNumber = document.getElementById('entityNumber');
    const entityNumberDropdown = document.getElementById('entityNumberDropdown');
    const companyLinkBtn = document.getElementById('companyLinkBtn');
    const companyRefreshBtn = document.getElementById('companyRefreshBtn');
    const downloadSummaryBtn = document.getElementById('downloadSummaryBtn');
    const peopleRepeater = document.getElementById('peopleRepeater');
    
    // Form inputs
    const titlePrefix = document.getElementById('titlePrefix');
    const firstName = document.getElementById('firstName');
    const middleName = document.getElementById('middleName');
    const lastName = document.getElementById('lastName');
    const phoneCountryCode = document.getElementById('phoneCountryCode');
    const phoneNumber = document.getElementById('phoneNumber');
    const email = document.getElementById('email');
    const recentNameChange = document.getElementById('recentNameChange');
    const nameChangeFields = document.getElementById('nameChangeFields');
    const previousName = document.getElementById('previousName');
    const reasonForNameChange = document.getElementById('reasonForNameChange');
    const dobInputs = Array.from(document.querySelectorAll('.birthdate-inputs input'));
    
    // Address inputs
    const currentCountry = document.getElementById('currentCountry');
    const currentAddressAutocompleteRow = document.getElementById('currentAddressAutocompleteRow');
    const currentAddress = document.getElementById('currentAddress');
    const currentAddressDropdown = document.getElementById('currentAddressDropdown');
    const currentAddressLabel = document.getElementById('currentAddressLabel');
    const addressNotListedRow = document.getElementById('addressNotListedRow');
    const addressNotListed = document.getElementById('addressNotListed');
    const manualAddressFields = document.getElementById('manualAddressFields');
    const flatNumber = document.getElementById('flatNumber');
    const buildingNumber = document.getElementById('buildingNumber');
    const buildingName = document.getElementById('buildingName');
    const street = document.getElementById('street');
    const subStreet = document.getElementById('subStreet');
    const town = document.getElementById('town');
    const postcode = document.getElementById('postcode');
    const recentMove = document.getElementById('recentMove');
    const previousAddressFields = document.getElementById('previousAddressFields');
    const previousCountry = document.getElementById('previousCountry');
    const previousAddressAutocompleteRow = document.getElementById('previousAddressAutocompleteRow');
    const previousAddress = document.getElementById('previousAddress');
    const previousAddressDropdown = document.getElementById('previousAddressDropdown');
    const previousAddressLabel = document.getElementById('previousAddressLabel');
    const previousAddressNotListedRow = document.getElementById('previousAddressNotListedRow');
    const previousAddressNotListed = document.getElementById('previousAddressNotListed');
    const manualPreviousAddressFields = document.getElementById('manualPreviousAddressFields');
    const prevFlatNumber = document.getElementById('prevFlatNumber');
    const prevBuildingNumber = document.getElementById('prevBuildingNumber');
    const prevBuildingName = document.getElementById('prevBuildingName');
    const prevStreet = document.getElementById('prevStreet');
    const prevSubStreet = document.getElementById('prevSubStreet');
    const prevTown = document.getElementById('prevTown');
    const prevPostcode = document.getElementById('prevPostcode');
    
    // State variables
    let errorTimeout = null;
    let formData = {};
    let currentAddressObject = null;
    let previousAddressObject = null;
    let addressDebounceTimer = null;
    let previousAddressDebounceTimer = null;
    let companyNameDebounceTimer = null;
    let companyNumberDebounceTimer = null;
    let isEntityMode = false;
    let entityType = 'business'; // 'business' or 'charity'
    let isLoadingData = false; // Flag to prevent disable-close during initial load
    let hasUnsavedChanges = false;
    let allowEdits = true; // Flag to control if user can edit inputs
    let businessData = null; // Stores full company/charity data (directors/trustees, officers, PSCs)
    
    // Header display variables
    let currentTitleText = ''; // FE initials (BA, RP, etc.)
    let currentTitle = ''; // FE initials (BA, RP, etc.)
    let currentClientNumber = ''; // Client number (e.g., '50')
    let currentMatterNumber = ''; // Matter number (e.g., '52')
    let currentClientName = ''; // Full name (e.g., 'Mr J R Archer-Moran')
    
    // Header DOM elements
    const headerInfo = document.getElementById('headerInfo');
    const titleBadge = document.getElementById('titleBadge');
    const clientNumberBadge = document.getElementById('clientNumberBadge');
    const clientMatterNumber = document.getElementById('clientMatterNumber');
    const clientName = document.getElementById('clientName');
    const headerIcons = document.getElementById('headerIcons');
    const addressIdIcon = document.getElementById('addressIdIcon');
    const photoIdIcon = document.getElementById('photoIdIcon');
    const likenessIcon = document.getElementById('likenessIcon');
    
    // Mock buttons
    const mockIndividualBtn = document.getElementById('mockIndividualBtn');
    const mockBusinessBtn = document.getElementById('mockBusinessBtn');
    const mockCharityBtn = document.getElementById('mockCharityBtn');
    
    // Request type tags
    const requestTags = document.querySelectorAll('.request-tag');
    let selectedRequestType = null; // 'formJ', 'formK', 'formE', 'esof', 'note', 'update', or 'updatePep'
    let isEsofSelected = false; // Track if eSoF is selected (can be dual-selected with Form E)
    const ruleSelectRow = document.getElementById('ruleSelectRow');
    const ruleSelect = document.getElementById('ruleSelect');
    const nameHint = document.getElementById('nameHint');
    const formJEligibilityWarning = document.getElementById('formJEligibilityWarning');
    const esofSelectedHint = document.getElementById('esofSelectedHint');
    const esofDeselectedWarning = document.getElementById('esofDeselectedWarning');
    const esofStandaloneHint = document.getElementById('esofStandaloneHint');
    const rule3FinancialWarning = document.getElementById('rule3FinancialWarning');
    
    // Message input and file uploader
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const uploadIcon = document.getElementById('uploadIcon');
    const uploadText = document.getElementById('uploadText');
    
    // Work type and relation
    const worktype = document.getElementById('worktype');
    const worktypeDropdown = document.getElementById('worktypeDropdown');
    const relation = document.getElementById('relation');
    const relationDropdown = document.getElementById('relationDropdown');
    const matterDescription = document.getElementById('matterDescription');
    
    // Entity mode checkboxes
    const businessCheckbox = document.getElementById('businessCheckbox');
    const charityCheckbox = document.getElementById('charityCheckbox');
    const entityCheckboxContainer = document.getElementById('entityCheckboxContainer');
    
    // Submit button
    const submitButton = document.getElementById('submitButton');
    
    // Fixed bottom container elements
    const bottomContainer = document.getElementById('bottomContainer');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressText = document.getElementById('progressText');
    const expandButton = document.getElementById('expandButton');
    const expandIcon = document.getElementById('expandIcon');
    const requirementsSection = document.getElementById('requirementsSection');
    const requirementsContent = document.getElementById('requirementsContent');
    
    let currentUploadedFile = null; // Stores the selected file
    let currentClientData = null; // Stores the loaded client data
    
    // Image carousel elements
    const imageCarouselSection = document.getElementById('imageCarouselSection');
    const imageCarousel = document.getElementById('imageCarousel');
    const idVerificationCheckbox = document.getElementById('idVerificationCheckbox');
    const idVerificationCheckboxWrapper = document.getElementById('idVerificationCheckboxWrapper');
    const submissionConfirmationCheckbox = document.getElementById('submissionConfirmationCheckbox');
    
    // Debug: Log if elements are found
    console.log('Bottom container elements:', {
      bottomContainer: !!bottomContainer,
      progressBarFill: !!progressBarFill,
      progressText: !!progressText,
      expandButton: !!expandButton
    });
    
    console.log('Checkbox elements:', {
      idVerificationCheckbox: !!idVerificationCheckbox,
      idVerificationCheckboxWrapper: !!idVerificationCheckboxWrapper
    });
    
    // Debug: Check if container is visible
    if (bottomContainer) {
      console.log('Bottom container styles:', {
        display: window.getComputedStyle(bottomContainer).display,
        visibility: window.getComputedStyle(bottomContainer).visibility,
        position: window.getComputedStyle(bottomContainer).position,
        bottom: window.getComputedStyle(bottomContainer).bottom,
        zIndex: window.getComputedStyle(bottomContainer).zIndex
      });
    }
    
    // Required documents elements
    const cdfDocumentCard = document.getElementById('cdfDocumentCard');
    const cdfDocumentName = document.getElementById('cdfDocumentName');
    const cdfDocumentInfo = document.getElementById('cdfDocumentInfo');
    const cdfDocumentType = document.getElementById('cdfDocumentType');
    const cdfUploadArea = document.getElementById('cdfUploadArea');
    const cdfFileInput = document.getElementById('cdfFileInput');
    const cdfHint = document.getElementById('cdfHint');
    
    const ofsiDocumentCard = document.getElementById('ofsiDocumentCard');
    const ofsiDocumentName = document.getElementById('ofsiDocumentName');
    const ofsiDocumentInfo = document.getElementById('ofsiDocumentInfo');
    const ofsiUploadArea = document.getElementById('ofsiUploadArea');
    const ofsiFileInput = document.getElementById('ofsiFileInput');
    const ofsiHint = document.getElementById('ofsiHint');
    
    let cdfDocument = null; // Stores existing CDF document
    let ofsiDocument = null; // Stores existing OFSI document
    let uploadedCDFFile = null; // Stores newly uploaded CDF
    let uploadedOFSIFile = null; // Stores newly uploaded OFSI
    
    // ===== FORM VALIDATION =====
    
    // Validate Form J specific requirements (ID images and likeness)
    function validateFormJ() {
      if (!currentClientData) {
        return 'Unable to verify ID requirements. Please ensure client data is loaded.';
      }
      
      const idImages = currentClientData.idI || [];
      const hasPhotoConfirmed = currentClientData.i?.p === true;
      const likenessNotConfirmed = currentClientData.i?.l === true;
      
      // Check likeness confirmation
      // i.p = true AND i.l = true means likeness icon shows (photo confirmed but likeness NOT confirmed)
      // For Form J, we need likeness to be confirmed (i.l should be false or undefined)
      if (hasPhotoConfirmed && likenessNotConfirmed) {
        return 'Likeness has not been confirmed. Until likeness is confirmed you can\'t request a Form J check. Please speak to reception to update the tag or contact the client to complete further verification.';
      }
      
      // Count Address ID and Photo ID images
      const addressIdImages = idImages.filter(img => img.type === 'Address ID');
      const photoIdImages = idImages.filter(img => img.type === 'PhotoID');
      
      // Check Address ID requirement (at least 2)
      if (addressIdImages.length < 2) {
        return `There must be at least 2 Address ID images uploaded. Currently ${addressIdImages.length} uploaded. Please open the entry in the ID system and upload the required Address ID documents or ask reception to complete the upload before submitting this request.`;
      }
      
      // Check Photo ID requirement
      const hasFront = photoIdImages.some(img => img.side === 'Front');
      const hasBack = photoIdImages.some(img => img.side === 'Back');
      
      // If there's a Front or Back tag, we need both Front AND Back
      if ((hasFront || hasBack) && !(hasFront && hasBack)) {
        const missing = hasFront ? 'Back' : 'Front';
        return `Photo ID requires both Front and Back images. Missing: ${missing} side. Please open the entry in the ID system and upload the ${missing} side of the Photo ID or ask reception to complete the upload before submitting this request.`;
      }
      
      // If no Front/Back tags, we need at least 1 Photo ID
      if (!hasFront && !hasBack && photoIdImages.length < 1) {
        return 'There must be at least 1 Photo ID image uploaded. Please open the entry in the ID system and upload the required Photo ID document or ask reception to complete the upload before submitting this request.';
      }
      
      return null; // All validation passed
    }
    
    // Check if Form E entry meets Form J requirements (for warning display)
    function checkFormJEligibility() {
      if (!currentClientData) {
        return false; // Can't check without data
      }
      
      const idImages = currentClientData.idI || [];
      const hasPhotoConfirmed = currentClientData.i?.p === true;
      const likenessNotConfirmed = currentClientData.i?.l === true;
      
      // Check if likeness is confirmed
      const likenessConfirmed = hasPhotoConfirmed && !likenessNotConfirmed;
      
      // Count ID images
      const addressIdImages = idImages.filter(img => img.type === 'Address ID');
      const photoIdImages = idImages.filter(img => img.type === 'PhotoID');
      
      const hasFront = photoIdImages.some(img => img.side === 'Front');
      const hasBack = photoIdImages.some(img => img.side === 'Back');
      
      // Check if meets Form J requirements
      const hasEnoughAddressID = addressIdImages.length >= 2;
      let hasEnoughPhotoID = false;
      
      if (hasFront || hasBack) {
        hasEnoughPhotoID = hasFront && hasBack;
      } else {
        hasEnoughPhotoID = photoIdImages.length >= 1;
      }
      
      // Returns true if ALL Form J requirements are met
      return likenessConfirmed && hasEnoughAddressID && hasEnoughPhotoID;
    }
    
    // Check if worktype indicates a purchase
    function isPurchaseWorktype(worktypeValue) {
      if (!worktypeValue) return false;
      
      const worktypeLower = worktypeValue.toLowerCase();
      const purchaseKeywords = ['purchase', 'pch'];
      
      return purchaseKeywords.some(keyword => worktypeLower.includes(keyword));
    }
    
    // Check if worktype indicates a sale
    function isSaleWorktype(worktypeValue) {
      if (!worktypeValue) return false;
      
      const worktypeLower = worktypeValue.toLowerCase();
      return worktypeLower.includes('sale');
    }
    
    // Check if worktype is valid for Form K Rule 3 (out of scope - non-financial only)
    function isValidRule3Worktype(worktypeValue) {
      if (!worktypeValue) return false;
      
      const worktypeLower = worktypeValue.toLowerCase();
      const validWorktypes = ['will', 'lasting power of attorney', 'lpa', 'deed', 'declaration', 'estate'];
      
      return validWorktypes.some(keyword => worktypeLower.includes(keyword));
    }
    
    // Check if current Form K rule is valid for the worktype
    function validateFormKRuleForWorktype() {
      if (selectedRequestType !== 'formK') return null;
      
      const selectedRule = ruleSelect.value;
      if (!selectedRule) return null;
      
      const worktypeValue = worktype.value;
      
      // Rule 1 & 2: Not valid for sales (individual or entity)
      if ((selectedRule.includes('[RULE 1]') || selectedRule.includes('[RULE 2]')) && isSaleWorktype(worktypeValue)) {
        return 'Form K Rule 1 and Rule 2 are not valid for sales, new ID must be acquired';
      }
      
      // Rule 3: Only valid for non-financial matters (Wills, LPA, Deeds, Estates)
      if (selectedRule.includes('[RULE 3]') && !isValidRule3Worktype(worktypeValue)) {
        return 'Form K Rule 3 is only valid for non-financial matters: Wills, Lasting Powers of Attorney, Deeds & Declarations, and Estates';
      }
      
      return null; // No conflicts
    }
    
    // Check if current Form K rule is valid for the entity mode
    function validateFormKRuleForMode() {
      if (selectedRequestType !== 'formK') return null;
      
      const selectedRule = ruleSelect.value;
      if (!selectedRule) return null;
      
      // Rules 4-9 are entity-only (Company, Partnership, Charity, PLC, Government/Council, Regulated Institution)
      const entityOnlyRules = ['[RULE 4]', '[RULE 5]', '[RULE 6]', '[RULE 7]', '[RULE 8]', '[RULE 9]'];
      const isEntityOnlyRule = entityOnlyRules.some(rule => selectedRule.includes(rule));
      
      if (isEntityOnlyRule && !isEntityMode) {
        return 'This Form K rule is only valid for business/charity entities. Please check the Business or Charity checkbox.';
      }
      
      // Rule 6 is charity-only (must have charity checkbox checked)
      if (selectedRule.includes('[RULE 6]') && isEntityMode && entityType !== 'charity') {
        return 'Form K Rule 6 is only valid for registered charities. Please check the Charity checkbox instead of Business.';
      }
      
      return null; // No conflicts
    }
    
    // Update eSoF hints based on Form E and eSoF selection states
    function updateEsofHints() {
      const isFormE = selectedRequestType === 'formE';
      const isEsofStandalone = selectedRequestType === 'esof'; // eSoF selected as primary tag (not dual)
      const isPurchase = isPurchaseWorktype(worktype.value);
      
      // Hide all hints first
      esofSelectedHint.classList.add('hidden');
      esofDeselectedWarning.classList.add('hidden');
      esofStandaloneHint.classList.add('hidden');
      
      if (isFormE && isEsofSelected) {
        // Form E + eSoF dual selection: Show blue hint (for ANY worktype)
        esofSelectedHint.classList.remove('hidden');
      } else if (isFormE && !isEsofSelected && isPurchase) {
        // Form E purchase WITHOUT eSoF: Show red warning
        esofDeselectedWarning.classList.remove('hidden');
      } else if (isEsofStandalone) {
        // eSoF standalone (without Form E): Show blue standalone hint suggesting Form E
        esofStandaloneHint.classList.remove('hidden');
      }
      // For non-purchase Form E with eSoF deselected: no warnings shown (eSoF is optional)
    }
    
    // Update CDF hint text and dropdown options based on mode and selected rule
    function updateCDFHint() {
      const selectedRule = ruleSelect.value;
      const isFormKSelected = selectedRule && selectedRule !== '';
      
      // If Form K is selected AND we're in entity mode, show special hint and update dropdown
      if (isFormKSelected && isEntityMode) {
        cdfHint.innerHTML = '⚠️ Please supply<br><br>Companies House or Charity Register printout for registered entities<br><br>Proof of address for non-registered entities<br><br>Proof of Authority for other Commercial work';
        
        // Update CDF document type dropdown options for entity mode
        cdfDocumentType.innerHTML = `
          <option value="Companies house summary">Companies house summary</option>
          <option value="Charity Register Summary">Charity Register Summary</option>
          <option value="Proof of Address">Proof of Address</option>
          <option value="Proof of Authority">Proof of Authority</option>
        `;
      } else {
        // Default hint for individuals or non-Form K
        cdfHint.innerHTML = '⚠️ Please supply<br><br>Client Basic Details Form or Beneficiary details form for individuals';
        
        // Reset CDF document type dropdown to default options
        cdfDocumentType.innerHTML = `
          <option value="Client Details form">Client Details form</option>
          <option value="Beneficiary details form">Beneficiary details form</option>
        `;
      }
    }
    
    // Get DOB value from individual input fields
    function getDOBValue() {
      const dobDigits = dobInputs.map(inp => inp?.value || '').join('');
      if (dobDigits.length === 8) {
        return `${dobDigits.substring(0,2)}-${dobDigits.substring(2,4)}-${dobDigits.substring(4)}`;
      }
      return '';
    }
    
    // Required fields based on tag type and toggle states
    function getRequiredFields() {
      const required = {
        // Always required
        messageInput: messageInput.value.trim(),
        worktype: worktype.value.trim(),
        matterDescription: matterDescription.value.trim(),
        relation: relation.value.trim()
      };
      
      // For Note/Update/UpdatePep - only the above are required
      if (['note', 'update', 'updatePep'].includes(selectedRequestType)) {
        return required;
      }
      
      // For Form J - require name, DOB, current address, ID verification checkbox, documents, and submission confirmation (individuals only)
      if (selectedRequestType === 'formJ' && !isEntityMode) {
        required.titlePrefix = document.getElementById('titlePrefix')?.value.trim() || '';
        required.firstName = document.getElementById('firstName')?.value.trim() || '';
        required.lastName = document.getElementById('lastName')?.value.trim() || '';
        required.dob = getDOBValue() || '';
        required.currentAddress = document.getElementById('currentAddress')?.value.trim() || '';
        required.idVerification = idVerificationCheckbox?.checked || false;
        required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
        required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        required.submissionConfirmation = submissionConfirmationCheckbox?.checked || false;
      }
      
      // For Form E - require name, mobile OR email, current address, CDF, OFSI (individuals only, NO DOB required)
      if (selectedRequestType === 'formE' && !isEntityMode) {
        required.titlePrefix = document.getElementById('titlePrefix')?.value.trim() || '';
        required.firstName = document.getElementById('firstName')?.value.trim() || '';
        required.lastName = document.getElementById('lastName')?.value.trim() || '';
        required.currentAddress = document.getElementById('currentAddress')?.value.trim() || '';
        required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
        required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        
        // Mobile OR email required (at least one)
        const mobileValue = document.getElementById('mobileNumber')?.value.trim() || '';
        const emailValue = document.getElementById('email')?.value.trim() || '';
        required.mobileOrEmail = mobileValue || emailValue;
      }
      
      // For eSoF (standalone) - same requirements as Form E (individuals only, NO DOB required)
      if (selectedRequestType === 'esof' && !isEntityMode) {
        required.titlePrefix = document.getElementById('titlePrefix')?.value.trim() || '';
        required.firstName = document.getElementById('firstName')?.value.trim() || '';
        required.lastName = document.getElementById('lastName')?.value.trim() || '';
        required.currentAddress = document.getElementById('currentAddress')?.value.trim() || '';
        required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
        required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        
        // Mobile OR email required (at least one)
        const mobileValue = document.getElementById('mobileNumber')?.value.trim() || '';
        const emailValue = document.getElementById('email')?.value.trim() || '';
        required.mobileOrEmail = mobileValue || emailValue;
      }
      
      // For Form K - add rule-specific requirements
      if (selectedRequestType === 'formK') {
        // Rule dropdown is required for Form K
        required.rule = ruleSelect.value || '';
        
        // Get selected rule
        const selectedRule = ruleSelect.value;
        
        // Rules 1, 2, 10, 11: Require CDF/OFSI in both individual and entity modes
        const rulesRequiringDocs = ['[RULE 1]', '[RULE 2]', '[RULE 10]', '[RULE 11]'];
        const requiresDocuments = rulesRequiringDocs.some(rule => selectedRule.includes(rule));
        
        if (requiresDocuments) {
          required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
          required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        }
        
        // ALL Form K rules in entity mode require CDF (or linked business data) and OFSI
        if (isEntityMode && !requiresDocuments) {
          required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
          required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        }
        
        // Rule 1 & 2: Individual or Entity requirements
        if (selectedRule.includes('[RULE 1]') || selectedRule.includes('[RULE 2]')) {
          if (!isEntityMode) {
            // Individual: Title, first name, last name required
            required.titlePrefix = document.getElementById('titlePrefix')?.value.trim() || '';
            required.firstName = document.getElementById('firstName')?.value.trim() || '';
            required.lastName = document.getElementById('lastName')?.value.trim() || '';
            // DOB OR entity number required (at least one)
            const dobValue = getDOBValue() || '';
            const entityNumValue = document.getElementById('entityNumber')?.value.trim() || '';
            required.dobOrEntityNum = dobValue || entityNumValue;
          } else {
            // Business/Charity: Business name and entity number required
            required.businessName = document.getElementById('businessName')?.value.trim() || '';
            required.entityNumber = document.getElementById('entityNumber')?.value.trim() || '';
          }
          // Current address required for both
          required.currentAddress = document.getElementById('currentAddress')?.value.trim() || '';
          // CDF and OFSI required (already set above for entity mode)
          if (!isEntityMode) {
            required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
            required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
          }
        }
        
        // Rule 3: Out of scope - requires ID verification in individual mode
        if (selectedRule.includes('[RULE 3]') && !isEntityMode) {
          // Individual: Requires name, DOB, current address, ID verification, CDF, and OFSI
          required.titlePrefix = document.getElementById('titlePrefix')?.value.trim() || '';
          required.firstName = document.getElementById('firstName')?.value.trim() || '';
          required.lastName = document.getElementById('lastName')?.value.trim() || '';
          required.dob = getDOBValue() || '';
          required.currentAddress = document.getElementById('currentAddress')?.value.trim() || '';
          required.idVerification = idVerificationCheckbox?.checked || false;
          required.hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
          required.hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
        }
      }
      
      // For Form K/E/eSoF - add conditional requirements
      if (['formK', 'formE', 'esof'].includes(selectedRequestType)) {
        
        // Check toggle states
        const recentNameChange = document.getElementById('recentNameChange')?.checked || false;
        const recentMove = document.getElementById('recentMove')?.checked || false;
        const addressNotListed = document.getElementById('addressNotListed')?.checked || false;
        const previousAddressNotListed = document.getElementById('previousAddressNotListed')?.checked || false;
        
        // Previous name fields required if name change toggle is on
        if (recentNameChange) {
          required.previousName = document.getElementById('previousName')?.value.trim() || '';
          required.reasonForNameChange = document.getElementById('reasonForNameChange')?.value.trim() || '';
        }
        
        // Previous address required if recent move is on (unless prev not listed is checked)
        if (recentMove && !previousAddressNotListed) {
          // Previous address dropdown or manual fields must be filled
          const prevAddress = document.getElementById('previousAddress')?.value.trim() || '';
          const prevStreet = document.getElementById('prevStreet')?.value.trim() || '';
          const prevTown = document.getElementById('prevTown')?.value.trim() || '';
          required.previousAddress = prevAddress || (prevStreet && prevTown);
        }
        
        // Current address manual fields required if "not listed" is checked
        if (addressNotListed) {
          const street = document.getElementById('street')?.value.trim() || '';
          const town = document.getElementById('town')?.value.trim() || '';
          const postcode = document.getElementById('postcode')?.value.trim() || '';
          required.manualCurrentAddress = street && town && postcode;
        }
        
        // Previous address manual fields required if "not listed" is checked
        if (previousAddressNotListed) {
          const prevStreet = document.getElementById('prevStreet')?.value.trim() || '';
          const prevTown = document.getElementById('prevTown')?.value.trim() || '';
          const prevPostcode = document.getElementById('prevPostcode')?.value.trim() || '';
          required.manualPreviousAddress = prevStreet && prevTown && prevPostcode;
        }
      }
      
      return required;
    }
    
    // ===== PROGRESS TRACKING AND REQUIREMENTS =====
    
    // Calculate progress percentage based on required fields
    function calculateProgress() {
      // If no request type selected, progress is 0%
      if (!selectedRequestType) {
        return 0;
      }
      
      const required = getRequiredFields();
      const keys = Object.keys(required);
      
      if (keys.length === 0) return 0;
      
      let completed = 0;
      keys.forEach(key => {
        const value = required[key];
        if (typeof value === 'boolean') {
          if (value === true) completed++;
        } else if (typeof value === 'string') {
          if (value.length > 0) completed++;
        }
      });
      
      return Math.round((completed / keys.length) * 100);
    }
    
    // Update progress bar and text
    function updateProgress() {
      const progress = calculateProgress();
      progressBarFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;
      
      console.log('📊 Progress updated:', {
        progress: progress + '%',
        selectedRequestType,
        isEntityMode,
        requiredFieldsCount: Object.keys(getRequiredFields()).length
      });
      
      // Enable/disable submit button based on whether all requirements are met
      if (progress === 100) {
        submitButton.disabled = false;
      } else {
        submitButton.disabled = true;
      }
    }
    
    // Generate requirements checklist HTML based on selected request type
    function updateRequirementsDisplay() {
      const required = getRequiredFields();
      
      let html = '';
      
      // Basic Requirements Category (ALWAYS shown)
      html += '<div class="requirement-category">';
      html += '<div class="category-title">Basic Information</div>';
      html += generateRequirementItem('Request Type Selected', selectedRequestType !== null);
      html += generateRequirementItem('Work Type', required.worktype);
      html += generateRequirementItem('Relation', required.relation);
      html += generateRequirementItem('Matter Description', required.matterDescription);
      html += generateRequirementItem('Message', required.messageInput);
      
      // If no request type selected, show hint
      if (!selectedRequestType) {
        html += '</div>';
        html += '<div style="color: #999; text-align: center; padding: 15px; font-style: italic;">Select a request type above to see additional requirements</div>';
        requirementsContent.innerHTML = html;
        return;
      }
      
      // Form K rule requirement
      if (selectedRequestType === 'formK') {
        html += generateRequirementItem('Form K Rule Selected', required.rule);
      }
      html += '</div>';
      
      // Client Details Category
      if (required.titlePrefix !== undefined || required.firstName !== undefined || required.businessName !== undefined) {
        html += '<div class="requirement-category">';
        html += '<div class="category-title">Client Details</div>';
        
        if (!isEntityMode) {
          html += generateRequirementItem('Title', required.titlePrefix);
          html += generateRequirementItem('First Name', required.firstName);
          html += generateRequirementItem('Last Name', required.lastName);
          if (required.dob !== undefined) {
            html += generateRequirementItem('Date of Birth', required.dob);
          }
          if (required.dobOrEntityNum !== undefined) {
            html += generateRequirementItem('DOB or Entity Number', required.dobOrEntityNum);
          }
        } else {
          html += generateRequirementItem('Business Name', required.businessName);
          if (required.entityNumber !== undefined) {
            html += generateRequirementItem('Entity Number', required.entityNumber);
          }
        }
        
        if (required.currentAddress !== undefined) {
          html += generateRequirementItem('Current Address', required.currentAddress);
        }
        
        if (required.mobileOrEmail !== undefined) {
          html += generateRequirementItem('Mobile or Email', required.mobileOrEmail);
        }
        
        html += '</div>';
      }
      
      // ID Documents Category (for Form J and Form K Rule 3)
      if (required.idVerification !== undefined) {
        html += '<div class="requirement-category">';
        html += '<div class="category-title">ID Documents Required</div>';
        
        // Check if client has uploaded ID images
        const hasIdImages = currentClientData && currentClientData.idI && currentClientData.idI.length > 0;
        
        html += generateRequirementItem('One form of Photo ID', hasIdImages);
        html += generateRequirementItem('Two forms of Address ID', hasIdImages);
        
        html += '</div>';
      }
      
      // Conditional Fields Category
      const recentNameChange = document.getElementById('recentNameChange')?.checked || false;
      const recentMove = document.getElementById('recentMove')?.checked || false;
      
      if (recentNameChange || recentMove) {
        html += '<div class="requirement-category">';
        html += '<div class="category-title">Additional Information</div>';
        
        if (recentNameChange) {
          html += generateRequirementItem('Previous Name', required.previousName);
          html += generateRequirementItem('Reason for Name Change', required.reasonForNameChange);
        }
        
        if (recentMove) {
          const addressNotListed = document.getElementById('addressNotListed')?.checked || false;
          const previousAddressNotListed = document.getElementById('previousAddressNotListed')?.checked || false;
          
          if (!previousAddressNotListed) {
            const hasPrevAddress = required.previousAddress || required.manualPreviousAddress;
            html += generateRequirementItem('Previous Address', hasPrevAddress);
          }
        }
        
        html += '</div>';
      }
      
      // Documents Category
      if (required.hasCDF !== undefined || required.hasOFSI !== undefined) {
        html += '<div class="requirement-category">';
        html += '<div class="category-title">Required Documents</div>';
        
        if (required.hasCDF !== undefined) {
          html += generateRequirementItem('Client Details Form (CDF)', required.hasCDF);
        }
        if (required.hasOFSI !== undefined) {
          html += generateRequirementItem('OFSI Sanctions Search', required.hasOFSI);
        }
        
        html += '</div>';
      }
      
      // Verification Category
      if (required.idVerification !== undefined || required.submissionConfirmation !== undefined) {
        html += '<div class="requirement-category">';
        html += '<div class="category-title">Verification & Confirmation</div>';
        
        if (required.idVerification !== undefined) {
          html += generateRequirementItem('ID Verification Confirmed', required.idVerification);
        }
        if (required.submissionConfirmation !== undefined) {
          html += generateRequirementItem('Submission Confirmed', required.submissionConfirmation);
        }
        
        html += '</div>';
      }
      
      requirementsContent.innerHTML = html;
    }
    
    // Generate individual requirement item HTML
    function generateRequirementItem(label, value) {
      let icon = '';
      let iconClass = '';
      
      if (typeof value === 'boolean') {
        if (value === true) {
          icon = '✓';
          iconClass = 'check';
        } else {
          icon = '✗';
          iconClass = 'cross';
        }
      } else if (typeof value === 'string') {
        if (value.length > 0) {
          icon = '✓';
          iconClass = 'check';
        } else {
          icon = '○';
          iconClass = 'pending';
        }
      } else {
        icon = '○';
        iconClass = 'pending';
      }
      
      return `
        <div class="requirement-item">
          <span class="requirement-icon ${iconClass}">${icon}</span>
          <span>${label}</span>
        </div>
      `;
    }
    
    // Expand/collapse requirements section
    expandButton.addEventListener('click', () => {
      const isExpanded = requirementsSection.classList.contains('expanded');
      
      if (isExpanded) {
        requirementsSection.classList.remove('expanded');
        expandIcon.classList.remove('expanded');
      } else {
        requirementsSection.classList.add('expanded');
        expandIcon.classList.add('expanded');
        // Update requirements when expanding
        updateRequirementsDisplay();
      }
    });
    
    // Validate form before submission
    function validateForm() {
      const required = getRequiredFields();
      const errors = [];
      
      // Check always required fields
      if (!required.messageInput) errors.push('Message is required');
      if (!required.worktype) errors.push('Work Type is required');
      if (!required.matterDescription) errors.push('Matter Description is required');
      if (!required.relation) errors.push('Relation is required');
      
      // Check conditional fields
      if (required.rule === '' && required.rule !== undefined) {
        errors.push('Please select a rule for Form K submission');
      }
      if (required.titlePrefix === '' && required.titlePrefix !== undefined) {
        errors.push('Title is required for Form J');
      }
      if (required.firstName === '' && required.firstName !== undefined) {
        errors.push('First Name is required for Form J');
      }
      if (required.lastName === '' && required.lastName !== undefined) {
        errors.push('Surname is required for Form J');
      }
      if (required.dob === '' && required.dob !== undefined) {
        errors.push('Date of Birth is required for Form J');
      }
      if (required.currentAddress === '' && required.currentAddress !== undefined) {
        errors.push('Current Address is required for Form J');
      }
      if (required.idVerification === false && required.idVerification !== undefined) {
        errors.push('You must confirm the ID verification requirements for Form J');
      }
      if (required.hasCDF === false && required.hasCDF !== undefined) {
        errors.push('Client Details Form (CDF) is required for Form J - please upload or ensure one exists');
      }
      if (required.hasOFSI === false && required.hasOFSI !== undefined) {
        errors.push('OFSI Sanctions Search is required for Form J - please upload or ensure one exists');
      }
      if (required.submissionConfirmation === false && required.submissionConfirmation !== undefined) {
        errors.push('You must confirm the submission requirements for Form J');
      }
      if (required.mobileOrEmail === '' && required.mobileOrEmail !== undefined) {
        errors.push('Either Mobile Number or Email is required for Form E/eSoF');
      }
      if (required.dobOrEntityNum === '' && required.dobOrEntityNum !== undefined) {
        errors.push('Either Date of Birth or Entity Number is required for Form K Rule 1/2');
      }
      if (required.businessName === '' && required.businessName !== undefined) {
        errors.push('Business/Charity Name is required for Form K Rule 1/2 in entity mode');
      }
      if (required.previousName === '' && required.previousName !== undefined) {
        errors.push('Previous Name is required when Name Change is selected');
      }
      if (required.reasonForNameChange === '' && required.reasonForNameChange !== undefined) {
        errors.push('Reason for Name Change is required when Name Change is selected');
      }
      if (!required.previousAddress && required.previousAddress !== undefined) {
        errors.push('Previous Address is required when Recent Move is selected');
      }
      if (!required.manualCurrentAddress && required.manualCurrentAddress !== undefined) {
        errors.push('Current Address manual fields (Street, Town, Postcode) are required when "Address not listed" is checked');
      }
      if (!required.manualPreviousAddress && required.manualPreviousAddress !== undefined) {
        errors.push('Previous Address manual fields (Street, Town, Postcode) are required when "Previous Address not listed" is checked');
      }
      
      return errors;
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    function showError(msg) {
      errorMessage.textContent = msg;
      errorPopup.classList.remove('hidden');
      if (errorTimeout) clearTimeout(errorTimeout);
      errorTimeout = setTimeout(() => {
        errorPopup.classList.add('hidden');
      }, 5000);
    }
    
    function hideError() {
      errorPopup.classList.add('hidden');
      if (errorTimeout) clearTimeout(errorTimeout);
    }
    
    closeError.addEventListener('click', hideError);
    
    // Update header display with client info
    function updateHeader() {
      if (currentTitle && currentClientNumber && currentMatterNumber && currentClientName) {
        titleBadge.querySelector('span').textContent = currentTitle;
        clientMatterNumber.textContent = `${currentClientNumber}-${currentMatterNumber}`;
        clientName.textContent = currentClientName;
      } else {
        // Clear header when no data
        titleBadge.querySelector('span').textContent = '';
        clientMatterNumber.textContent = '';
        clientName.textContent = '';
      }
      
      // Update icon visibility (only in individual mode)
      if (isEntityMode) {
        // Hide all icons in business/charity mode
        headerIcons.style.display = 'none';
      } else {
        // Show icons container in individual mode
        headerIcons.style.display = 'flex';
        
        // Get icon flags from formData.i
        const icons = formData.i || {};
        
        // Address ID icon (show if i.a is true)
        if (icons.a === true) {
          addressIdIcon.classList.add('visible');
        } else {
          addressIdIcon.classList.remove('visible');
        }
        
        // Photo ID icon (show if i.p is true)
        if (icons.p === true) {
          photoIdIcon.classList.add('visible');
        } else {
          photoIdIcon.classList.remove('visible');
        }
        
        // Likeness confirmed icon (show if i.p is true AND i.l is false/undefined)
        if (icons.p === true && (icons.l === false || icons.l === undefined)) {
          likenessIcon.classList.add('visible');
        } else {
          likenessIcon.classList.remove('visible');
        }
      }
    }
    
    // ===== EDIT CONTROL =====
    
    function setEditMode(enabled) {
      allowEdits = enabled;
      
      // Get all form inputs (excluding company buttons - handled separately)
      const allFormInputs = [
        registrationCountry, businessName, entityNumber,
        titlePrefix, firstName, middleName, lastName,
        phoneCountryCode, phoneNumber, email,
        previousName, reasonForNameChange,
        currentCountry, currentAddress,
        flatNumber, buildingNumber, buildingName, street, subStreet, town, postcode,
        previousCountry, previousAddress,
        prevFlatNumber, prevBuildingNumber, prevBuildingName, prevStreet, prevSubStreet, prevTown, prevPostcode,
        recentNameChange, recentMove, addressNotListed, previousAddressNotListed
      ];
      
      // Add DOB inputs
      const allFormElements = [...allFormInputs, ...dobInputs];
      
      // Enable or disable all inputs
      allFormElements.forEach(input => {
        if (input) {
          input.disabled = !enabled;
        }
      });
      
      // Company buttons: Only disable refresh button, keep link and download enabled
      if (companyRefreshBtn) {
        companyRefreshBtn.disabled = !enabled;
      }
      // companyLinkBtn and downloadSummaryBtn stay enabled (always allow viewing and downloading)
      
      console.log(enabled ? '✏️ Edit mode enabled' : '🔒 Edit mode disabled (read-only)');
    }
    
    // ===== CHANGE DETECTION =====
    
    function notifyUnsavedChanges() {
      if (!isLoadingData && !hasUnsavedChanges) {
        hasUnsavedChanges = true;
        console.log('🔒 Unsaved changes detected, disabling close button');
        window.parent.postMessage({
          type: 'disable-close'
        }, '*');
      }
    }
    
    // ===== ENTITY MODE TOGGLE =====
    
    function switchToEntityMode(type = 'business') {
      isEntityMode = true;
      entityType = type;
      entityFields.classList.remove('hidden');
      individualFields.classList.add('hidden');
      updateEntityLabels();
      updateHeader(); // Update header to hide icons in entity mode
      
      // Hide Form J, E, and eSoF tags (only available for individuals)
      let tagWasDeselected = false;
      requestTags.forEach(tag => {
        const tagType = tag.getAttribute('data-type');
        if (['formJ', 'formE', 'esof'].includes(tagType)) {
          tag.style.display = 'none';
          // If one of these tags is selected, deselect it
          if (selectedRequestType === tagType) {
            tag.classList.remove('selected');
            selectedRequestType = null;
            isEsofSelected = false;
            nameHint.classList.add('hidden');
            imageCarouselSection.classList.add('hidden');
            rule3FinancialWarning.classList.add('hidden');
            tagWasDeselected = true;
            showError('Form J, E, and eSoF requests are only available for individuals. Please select a different request type.');
          }
        }
      });
      
      // Update CDF hint for entity mode
      updateCDFHint();
      
      // Update progress after switching modes (with delay if tag was deselected)
      if (tagWasDeselected) {
        setTimeout(() => {
          updateProgress();
          updateRequirementsDisplay();
        }, 100);
      } else {
        updateProgress();
        updateRequirementsDisplay();
      }
      
      console.log(`Switched to entity mode: ${type}`);
    }
    
    function switchToIndividualMode() {
      isEntityMode = false;
      entityFields.classList.add('hidden');
      individualFields.classList.remove('hidden');
      updateHeader(); // Update header to show icons in individual mode
      
      // Show Form J, E, and eSoF tags (available for individuals)
      requestTags.forEach(tag => {
        const tagType = tag.getAttribute('data-type');
        if (['formJ', 'formE', 'esof'].includes(tagType)) {
          tag.style.display = '';
        }
      });
      
      // Check if current Form K rule is entity-only (Rules 4-9)
      if (selectedRequestType === 'formK') {
        const modeError = validateFormKRuleForMode();
        if (modeError) {
          showError(modeError);
          ruleSelect.value = '';
          messageInput.value = '';
          rule3FinancialWarning.classList.add('hidden');
          console.log('❌ Form K rule cleared - entity-only rule not valid in individual mode');
        }
      }
      
      // Update CDF hint for individual mode
      updateCDFHint();
      
      // Update progress after switching modes
      updateProgress();
      updateRequirementsDisplay();
      
      console.log('Switched to individual mode');
    }
    
    // ===== REQUEST TYPE TAG SELECTION =====
    
    // Handle tag selection (only one can be selected at a time, EXCEPT Form E + eSoF)
    requestTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const tagType = tag.getAttribute('data-type');
        const previousRequestType = selectedRequestType;
        
        // SPECIAL CASE: Handle eSoF tag (can be primary tag OR dual-selected with Form E)
        if (tagType === 'esof') {
          if (selectedRequestType === 'formE') {
            // Form E already selected → toggle eSoF as dual selection
            if (isEsofSelected) {
              tag.classList.remove('selected');
              isEsofSelected = false;
              console.log('Deselected eSoF tag (dual mode)');
            } else {
              tag.classList.add('selected');
              isEsofSelected = true;
              console.log('Selected eSoF tag (dual mode)');
            }
            updateEsofHints();
            return;
          } else if (selectedRequestType === 'esof') {
            // eSoF already selected as primary → deselect it
            tag.classList.remove('selected');
            selectedRequestType = null;
            isEsofSelected = false;
            entityCheckboxContainer.style.display = 'flex';
            nameHint.classList.add('hidden');
            imageCarouselSection.classList.add('hidden');
            rule3FinancialWarning.classList.add('hidden');
            updateEsofHints();
            console.log('Deselected eSoF tag (standalone mode)');
            return;
          }
          // Otherwise, eSoF is being selected as primary tag → proceed with normal logic below
        }
        
        // If clicking already selected tag (non-eSoF), deselect it
        if (selectedRequestType === tagType) {
          tag.classList.remove('selected');
          selectedRequestType = null;
          ruleSelectRow.style.display = 'none';
          ruleSelect.value = '';
          nameHint.classList.add('hidden');
          entityCheckboxContainer.style.display = 'flex'; // Show checkboxes when deselecting
          imageCarouselSection.classList.add('hidden'); // Hide carousel when deselecting
          rule3FinancialWarning.classList.add('hidden'); // Hide Rule 3 warning when deselecting
          
          // Also deselect eSoF if Form E is deselected
          if (tagType === 'formE' && isEsofSelected) {
            const esofTag = Array.from(requestTags).find(t => t.getAttribute('data-type') === 'esof');
            if (esofTag) {
              esofTag.classList.remove('selected');
            }
            isEsofSelected = false;
          }
          
          // Update hints
          updateEsofHints();
          formJEligibilityWarning.classList.add('hidden');
          
          console.log('Deselected request type');
          return;
        }
        
        // Prevent selection of Form J/E/eSoF in entity mode
        if (['formJ', 'formE', 'esof'].includes(tagType) && isEntityMode) {
          showError('Form J, E, and eSoF requests are only available for individuals. Please switch to individual mode.');
          return;
        }
        
        // Validate Form J requirements before allowing selection
        if (tagType === 'formJ' && !isEntityMode) {
          const formJError = validateFormJ();
          if (formJError) {
            showError(formJError);
            return; // Prevent selection
          }
        }
        
        // Define note/update types that can preserve message content
        const noteUpdateTypes = ['note', 'update', 'updatePep'];
        const previousIsNoteUpdate = noteUpdateTypes.includes(previousRequestType);
        const currentIsNoteUpdate = noteUpdateTypes.includes(tagType);
        
        // Clear message input UNLESS switching between note/update/updatePep
        if (!(previousIsNoteUpdate && currentIsNoteUpdate)) {
          messageInput.value = '';
          console.log('Cleared message input due to request type change');
        }
        
        // Deselect all other tags (except eSoF if selecting Form E)
        requestTags.forEach(t => {
          // Keep eSoF selected if switching to Form E, otherwise deselect it
          if (t.getAttribute('data-type') === 'esof' && tagType === 'formE') {
            // Keep eSoF selection when selecting Form E
          } else if (t.getAttribute('data-type') !== tagType) {
            t.classList.remove('selected');
            
            // If deselecting eSoF, update the flag
            if (t.getAttribute('data-type') === 'esof') {
              isEsofSelected = false;
            }
          }
        });
        
        // Select this tag
        tag.classList.add('selected');
        selectedRequestType = tagType;
        
        console.log('Selected request type:', selectedRequestType);
        
        // Show rule dropdown ONLY for Form K
        if (tagType === 'formK') {
          ruleSelectRow.style.display = 'block';
        } else {
          ruleSelectRow.style.display = 'none';
          ruleSelect.value = '';
          // Hide Form K specific warnings when selecting non-Form K tags
          rule3FinancialWarning.classList.add('hidden');
        }
        
        // Show name hint for Form J or eSoF ONLY (NOT Form E - no photo ID to match)
        if (['formJ', 'esof'].includes(tagType) && !isEntityMode) {
          nameHint.classList.remove('hidden');
        } else {
          nameHint.classList.add('hidden');
        }
        
        // Hide business/charity checkboxes for Form J, E, or eSoF (individual-only requests)
        if (['formJ', 'formE', 'esof'].includes(tagType)) {
          entityCheckboxContainer.style.display = 'none';
        } else {
          entityCheckboxContainer.style.display = 'flex';
        }
        
        // Auto-populate message for Form J
        if (tagType === 'formJ') {
          messageInput.value = 'We hold sufficient Photographic and Address ID to perform a Form J check on this client, we attach the CDF and recent OFSI along with the BCDs entered';
        }
        
        // Auto-populate message for Form E
        if (tagType === 'formE') {
          messageInput.value = 'The client has requested an electronic check during onboarding, we attach their CDF and recent OFSI along with the BCDs entered';
          
          // Check if this entry meets Form J requirements and show warning
          if (checkFormJEligibility()) {
            formJEligibilityWarning.classList.remove('hidden');
          } else {
            formJEligibilityWarning.classList.add('hidden');
          }
          
          // Auto-add eSoF tag if worktype is a purchase
          if (isPurchaseWorktype(worktype.value)) {
            const esofTag = Array.from(requestTags).find(t => t.getAttribute('data-type') === 'esof');
            if (esofTag && !isEsofSelected) {
              esofTag.classList.add('selected');
              isEsofSelected = true;
              console.log('Auto-selected eSoF tag for purchase worktype');
            }
          }
          
          // Update eSoF hints
          updateEsofHints();
        } else if (tagType === 'esof') {
          // Auto-populate message for standalone eSoF (not dual-selected with Form E)
          messageInput.value = 'The client has requested/I would like to send the client an electronic source of funds check, i include the required details below';
          
          // Hide Form J warning for eSoF
          formJEligibilityWarning.classList.add('hidden');
        } else {
          // Hide warning for other tag types
          formJEligibilityWarning.classList.add('hidden');
        }
        
        // Show/hide sections for Form J, Form E, and eSoF
        if (tagType === 'formJ' && !isEntityMode) {
          // Form J: Show image carousel, ID verification checkbox, AND required documents
          imageCarouselSection.classList.remove('hidden');
          populateImageCarousel();
          populateRequiredDocuments();
          
          // Show ID verification checkbox and submission confirmation (Form J only)
          if (idVerificationCheckboxWrapper) {
            idVerificationCheckboxWrapper.classList.remove('hidden');
          }
          if (submissionConfirmationCheckbox) {
            submissionConfirmationCheckbox.parentElement.parentElement.classList.remove('hidden');
          }
        } else if ((tagType === 'formE' || tagType === 'esof') && !isEntityMode) {
          // Form E or eSoF: Show ONLY required documents section (NO image carousel, NO ID verification checkboxes)
          imageCarouselSection.classList.remove('hidden');
          
          // Hide the image carousel itself
          imageCarousel.style.display = 'none';
          
          // Hide ID verification checkbox
          if (idVerificationCheckboxWrapper) {
            idVerificationCheckboxWrapper.classList.add('hidden');
          }
          
          // Hide submission confirmation checkbox
          if (submissionConfirmationCheckbox) {
            submissionConfirmationCheckbox.parentElement.parentElement.classList.add('hidden');
          }
          
          // Show required documents (CDF and OFSI)
          populateRequiredDocuments();
          
          // Update eSoF hints (for standalone eSoF selection)
          if (tagType === 'esof') {
            updateEsofHints();
          }
        } else {
          // Other tags: Hide everything
          imageCarouselSection.classList.add('hidden');
          
          // Reset carousel display for when switching back
          imageCarousel.style.display = 'flex';
        }
        
        // TODO: Show/hide form fields based on selected type
      });
    });
    
    // ===== REQUIRED DOCUMENTS (CDF & OFSI) =====
    
    // Populate required documents section
    function populateRequiredDocuments() {
      // Always show uploaders
      cdfUploadArea.style.display = 'flex';
      ofsiUploadArea.style.display = 'flex';
      
      if (!currentClientData || !currentClientData.idD) {
        // No documents available, hide cards
        cdfDocumentCard.classList.add('hidden');
        ofsiDocumentCard.classList.add('hidden');
        return;
      }
      
      const idDocuments = currentClientData.idD || [];
      
      // Find CDF (Details form type)
      const cdfDoc = idDocuments.find(doc => 
        doc.type === 'Details form' && 
        (doc.document === 'Client Details form' || doc.document === 'Beneficiary details form')
      );
      
      // Find OFSI (PEP & Sanctions Check type)
      const ofsiDoc = idDocuments.find(doc => 
        doc.type === 'PEP & Sanctions Check' && 
        doc.document === 'OFSI Sanctions Search'
      );
      
      // Handle CDF - show card if exists, hide hint
      if (cdfDoc && cdfDoc.liveUrl) {
        cdfDocument = cdfDoc;
        cdfDocumentName.textContent = cdfDoc.document || 'Client Details Form';
        cdfDocumentInfo.innerHTML = cdfDoc.uploader && cdfDoc.date
          ? `Uploaded by <strong>${cdfDoc.uploader}</strong><br>${cdfDoc.date}`
          : 'Upload information not available';
        cdfDocumentCard.classList.remove('hidden');
        cdfHint.style.display = 'none'; // Hide hint when document exists
      } else {
        cdfDocument = null;
        cdfDocumentCard.classList.add('hidden');
        cdfHint.style.display = 'block'; // Show hint when no document
      }
      
      // Handle OFSI - show card if exists, hide hint
      if (ofsiDoc && ofsiDoc.liveUrl) {
        ofsiDocument = ofsiDoc;
        ofsiDocumentName.textContent = ofsiDoc.document || 'OFSI Sanctions Search';
        ofsiDocumentInfo.innerHTML = ofsiDoc.uploader && ofsiDoc.date
          ? `Uploaded by <strong>${ofsiDoc.uploader}</strong><br>${ofsiDoc.date}`
          : 'Upload information not available';
        ofsiDocumentCard.classList.remove('hidden');
        ofsiHint.style.display = 'none'; // Hide hint when document exists
      } else {
        ofsiDocument = null;
        ofsiDocumentCard.classList.add('hidden');
        ofsiHint.style.display = 'block'; // Show hint when no document
      }
    }
    
    // Open OFSI Search website in popup
    function openOFSISearch() {
      const width = 1200;
      const height = 900;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
      
      window.open('https://sanctionssearchapp.ofsi.hmtreasury.gov.uk/', 'ofsiSearch', features);
      console.log('Opening OFSI Search in popup');
    }
    
    // Open document in popup viewer
    function openDocument(docType) {
      const doc = docType === 'cdf' ? cdfDocument : ofsiDocument;
      
      if (!doc || !doc.liveUrl) {
        alert('Document URL not available');
        return;
      }
      
      // Open document in popup window
      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
      
      window.open(doc.liveUrl, 'documentViewer', features);
      console.log('Opening document in popup:', doc.liveUrl);
    }
    
    // Download document
    function downloadDocument(docType) {
      const doc = docType === 'cdf' ? cdfDocument : ofsiDocument;
      
      if (!doc || !doc.liveUrl) {
        alert('Document URL not available');
        return;
      }
      
      fetch(doc.liveUrl)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = doc.name || `${doc.document}-${Date.now()}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Error downloading document:', error);
          const link = document.createElement('a');
          link.href = doc.liveUrl;
          link.download = doc.name || `${doc.document}-${Date.now()}.pdf`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
    }
    
    // CDF Upload handlers
    function triggerCDFUpload() {
      cdfFileInput.click();
    }
    
    function handleCDFFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Check if file is an image
      if (file.type.startsWith('image/')) {
        showError('Please upload a document file (PDF, DOC, DOCX). Images should be uploaded in the ID Images section.');
        event.target.value = '';
        return;
      }
      
      // Only allow document types
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid document file (PDF, DOC, DOCX)');
        event.target.value = '';
        return;
      }
      
      uploadedCDFFile = file;
      
      // Update UI to show file selected
      cdfUploadArea.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; flex-shrink: 0;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style="font-size: 0.8rem; font-weight: 500; color: rgb(0, 60, 113);">${file.name}</span>
      `;
      cdfUploadArea.style.setProperty('display', 'flex', 'important');
      cdfUploadArea.style.setProperty('flex-direction', 'row', 'important');
      cdfUploadArea.style.setProperty('flex', 'none', 'important');
      
      console.log('CDF file selected:', file.name);
    }
    
    function handleCDFDrop(event) {
      event.preventDefault();
      cdfUploadArea.classList.remove('dragover');
      
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        
        // Check if file is an image
        if (file.type.startsWith('image/')) {
          showError('Please upload a document file (PDF, DOC, DOCX). Images should be uploaded in the ID Images section.');
          return;
        }
        
        // Only allow document types
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          showError('Please select a valid document file (PDF, DOC, DOCX)');
          return;
        }
        
        uploadedCDFFile = file;
        
        // Update UI
        cdfUploadArea.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; flex-shrink: 0;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="font-size: 0.8rem; font-weight: 500; color: rgb(0, 60, 113);">${file.name}</span>
        `;
        cdfUploadArea.style.setProperty('display', 'flex', 'important');
        cdfUploadArea.style.setProperty('flex-direction', 'row', 'important');
        cdfUploadArea.style.setProperty('flex', 'none', 'important');
        
        console.log('CDF file dropped:', file.name);
      }
    }
    
    // OFSI Upload handlers
    function triggerOFSIUpload() {
      ofsiFileInput.click();
    }
    
    function handleOFSIFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Check if file is an image
      if (file.type.startsWith('image/')) {
        showError('Please upload a document file (PDF, DOC, DOCX). Images should be uploaded in the ID Images section.');
        event.target.value = '';
        return;
      }
      
      // Only allow document types
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid document file (PDF, DOC, DOCX)');
        event.target.value = '';
        return;
      }
      
      uploadedOFSIFile = file;
      
      // Update UI to show file selected
      ofsiUploadArea.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; flex-shrink: 0;">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span style="font-size: 0.8rem; font-weight: 500; color: rgb(0, 60, 113);">${file.name}</span>
      `;
      ofsiUploadArea.style.setProperty('display', 'flex', 'important');
      ofsiUploadArea.style.setProperty('flex-direction', 'row', 'important');
      ofsiUploadArea.style.setProperty('flex', 'none', 'important');
      
      console.log('OFSI file selected:', file.name);
    }
    
    function handleOFSIDrop(event) {
      event.preventDefault();
      ofsiUploadArea.classList.remove('dragover');
      
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        
        // Check if file is an image
        if (file.type.startsWith('image/')) {
          showError('Please upload a document file (PDF, DOC, DOCX). Images should be uploaded in the ID Images section.');
          return;
        }
        
        // Only allow document types
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          showError('Please select a valid document file (PDF, DOC, DOCX)');
          return;
        }
        
        uploadedOFSIFile = file;
        
        // Update UI
        ofsiUploadArea.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 20px; height: 20px; flex-shrink: 0;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span style="font-size: 0.8rem; font-weight: 500; color: rgb(0, 60, 113);">${file.name}</span>
        `;
        ofsiUploadArea.style.setProperty('display', 'flex', 'important');
        ofsiUploadArea.style.setProperty('flex-direction', 'row', 'important');
        ofsiUploadArea.style.setProperty('flex', 'none', 'important');
        
        console.log('OFSI file dropped:', file.name);
      }
    }
    
    // ===== IMAGE CAROUSEL =====
    
    // Populate image carousel with ID images from currentClientData
    function populateImageCarousel() {
      if (!currentClientData || !currentClientData.idI) {
        imageCarousel.innerHTML = '<div style="color: #666; font-size: 0.85rem; padding: 20px; text-align: center;">No ID images available</div>';
        return;
      }
      
      const idImages = currentClientData.idI || [];
      
      if (idImages.length === 0) {
        imageCarousel.innerHTML = '<div style="color: #666; font-size: 0.85rem; padding: 20px; text-align: center;">No ID images uploaded</div>';
        return;
      }
      
      // Clear existing carousel
      imageCarousel.innerHTML = '';
      
      // Create image cards
      idImages.forEach((image, index) => {
        const card = document.createElement('div');
        card.className = 'carousel-image-card';
        
        const sideTag = image.side && image.side !== 'Single' 
          ? `<span class="carousel-side-tag">${image.side}</span>` 
          : '';
        
        const uploaderInfo = image.uploader && image.date
          ? `Uploaded by <strong>${image.uploader}</strong><br>${image.date}`
          : 'Upload information not available';
        
        const imageUrl = image.liveUrl || image.url || '';
        const typeBadge = image.type === 'PhotoID' ? 'Photo ID' : 'Address ID';
        
        card.innerHTML = `
          <div class="carousel-image-container">
            <div class="carousel-image-type-badge">${typeBadge}</div>
            ${imageUrl ? `<img src="${imageUrl}" alt="${image.document || 'ID Document'}" onerror="this.parentElement.innerHTML='<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:0.8rem;&quot;>Image unavailable</div>'">` : '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#999;font-size:0.8rem;">No preview</div>'}
          </div>
          <div class="carousel-image-details">
            <div class="carousel-document-name">
              ${image.document || 'Unknown Document'}
              ${sideTag}
            </div>
            <div class="carousel-uploader-info">${uploaderInfo}</div>
            <div class="carousel-image-actions">
              <button class="carousel-btn" onclick="openCarouselImage(${index})" title="View image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                View
              </button>
              ${imageUrl ? `<button class="carousel-btn" onclick="downloadCarouselImage(${index})" title="Download image">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7,14 12,19 17,14"/>
                  <line x1="12" y1="19" x2="12" y2="7"/>
                </svg>
                Download
              </button>` : ''}
            </div>
          </div>
        `;
        
        imageCarousel.appendChild(card);
      });
    }
    
    // Open image in popup viewer
    function openCarouselImage(index) {
      if (!currentClientData || !currentClientData.idI || !currentClientData.idI[index]) {
        console.error('Image data not found for index:', index);
        return;
      }
      
      const imageData = currentClientData.idI[index];
      const imageUrl = imageData.liveUrl || imageData.url;
      
      if (!imageUrl) {
        alert('Image URL not available');
        return;
      }
      
      // Prepare data for single-image-viewer.html
      const viewerData = {
        document: imageData.document,
        side: imageData.side,
        name: imageData.name,
        liveUrl: imageUrl,
        uploader: imageData.uploader,
        date: imageData.date
      };
      
      // Encode data as base64 JSON for URL hash
      const dataHash = btoa(JSON.stringify(viewerData));
      
      // Construct the iframe URL using hash
      const baseUrl = window.location.href.split('/').slice(0, -1).join('/');
      const viewerUrl = `${baseUrl}/single-image-viewer.html#${dataHash}`;
      
      // Open in centered popup window
      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
      
      window.open(viewerUrl, 'imageViewer', features);
      console.log('Opening image in popup:', viewerUrl);
    }
    
    // Download carousel image
    function downloadCarouselImage(index) {
      if (!currentClientData || !currentClientData.idI || !currentClientData.idI[index]) {
        console.error('Image data not found for index:', index);
        return;
      }
      
      const imageData = currentClientData.idI[index];
      const imageUrl = imageData.liveUrl || imageData.url;
      
      if (!imageUrl) {
        alert('Image URL not available');
        return;
      }
      
      // For cross-origin images (like S3), fetch and create a blob
      fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = imageData.name || `id-image-${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        })
        .catch(error => {
          console.error('Error downloading image:', error);
          // Fallback: try direct download
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = imageData.name || `id-image-${Date.now()}.jpg`;
          link.target = '_blank';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });
    }
    
    // ===== RULE DROPDOWN HANDLER =====
    
    // When a Form K rule is selected, populate the message input with the FULL MESSAGE
    ruleSelect.addEventListener('change', () => {
      if (ruleSelect.value) {
        // Validate rule compatibility with current worktype
        const worktypeError = validateFormKRuleForWorktype();
        if (worktypeError) {
          showError(worktypeError);
          ruleSelect.value = '';
          messageInput.value = '';
          rule3FinancialWarning.classList.add('hidden');
          updateCDFHint(); // Update hint when rule is cleared
          return;
        }
        
        // Validate rule compatibility with current mode (individual vs entity)
        const modeError = validateFormKRuleForMode();
        if (modeError) {
          showError(modeError);
          ruleSelect.value = '';
          messageInput.value = '';
          rule3FinancialWarning.classList.add('hidden');
          updateCDFHint(); // Update hint when rule is cleared
          return;
        }
        
        // Get the selected option's value (full message), not the text (label)
        const fullMessage = ruleSelect.value;
        
        // Replace current message input text with the full rule message
        messageInput.value = fullMessage;
        
        console.log('Rule selected, message populated:', fullMessage);
      }
      
      // Handle Form K rules - show appropriate sections based on rule
      const selectedRule = ruleSelect.value;
      if (selectedRule && selectedRequestType === 'formK') {
        // ALL Form K rules show the section (for CDF/OFSI)
        imageCarouselSection.classList.remove('hidden');
        populateRequiredDocuments();
        
        if (selectedRule.includes('[RULE 3]') && !isEntityMode) {
          // Rule 3 in individual mode: Show image carousel and ID verification
          imageCarousel.style.display = 'flex';
          populateImageCarousel();
          
          // Show ID verification checkbox (Rule 3 requires verification)
          if (idVerificationCheckboxWrapper) {
            idVerificationCheckboxWrapper.classList.remove('hidden');
            console.log('✅ ID verification checkbox shown for Rule 3', {
              hasHiddenClass: idVerificationCheckboxWrapper.classList.contains('hidden'),
              display: window.getComputedStyle(idVerificationCheckboxWrapper).display,
              visibility: window.getComputedStyle(idVerificationCheckboxWrapper).visibility
            });
          } else {
            console.error('❌ idVerificationCheckboxWrapper not found!');
          }
          
          // Keep submission confirmation hidden (only for Form J)
          if (submissionConfirmationCheckbox) {
            submissionConfirmationCheckbox.parentElement.parentElement.classList.add('hidden');
          }
          
          // Show Rule 3 financial warning
          rule3FinancialWarning.classList.remove('hidden');
          
          // Show name hint (Rule 3 requires photo ID that must match name)
          nameHint.classList.remove('hidden');
          
          console.log('Form K Rule 3: Image carousel and ID verification enabled');
        } else {
          // Other Form K rules (1, 2, 4-11): Hide carousel but keep CDF/OFSI visible
          imageCarousel.style.display = 'none';
          rule3FinancialWarning.classList.add('hidden');
          nameHint.classList.add('hidden');
          
          // Hide ID verification checkbox
          if (idVerificationCheckboxWrapper) {
            idVerificationCheckboxWrapper.classList.add('hidden');
            console.log('❌ ID verification checkbox hidden for non-Rule 3');
          }
          
          console.log('Form K rule selected: CDF/OFSI section shown');
        }
      } else if (selectedRequestType === 'formK' && !selectedRule) {
        // Form K selected but no rule chosen yet - hide everything except basic form
        imageCarouselSection.classList.add('hidden');
        rule3FinancialWarning.classList.add('hidden');
        nameHint.classList.add('hidden');
        if (idVerificationCheckboxWrapper) {
          idVerificationCheckboxWrapper.classList.add('hidden');
        }
      } else {
        // Non-Form K: Hide the entire section
        imageCarouselSection.classList.add('hidden');
        rule3FinancialWarning.classList.add('hidden');
        if (idVerificationCheckboxWrapper) {
          idVerificationCheckboxWrapper.classList.add('hidden');
        }
      }
      
      // Update CDF hint based on new rule selection
      updateCDFHint();
    });
    
    // ===== WORKTYPE AND RELATION DROPDOWN HANDLERS =====
    
    // Auto-fill text inputs from dropdown selections
    worktypeDropdown.addEventListener('change', () => {
      if (worktypeDropdown.value) {
        worktype.value = worktypeDropdown.value;
        worktypeDropdown.value = ''; // Reset dropdown
        
        // Trigger worktype change handler
        handleWorktypeChange();
      }
    });
    
    // Listen for manual worktype input changes
    worktype.addEventListener('input', () => {
      handleWorktypeChange();
    });
    
    // Handle worktype changes for eSoF auto-selection and Form K rule validation
    function handleWorktypeChange() {
      // Check for Form K rule conflicts with worktype
      if (selectedRequestType === 'formK') {
        const ruleError = validateFormKRuleForWorktype();
        if (ruleError) {
          // Show error and clear rule selection
          showError(ruleError);
          ruleSelect.value = '';
          messageInput.value = '';
          rule3FinancialWarning.classList.add('hidden');
          imageCarouselSection.classList.add('hidden');
          nameHint.classList.add('hidden');
          console.log('❌ Rule invalidated due to worktype change');
          return;
        }
      }
      
      // Handle Form E eSoF auto-selection
      if (selectedRequestType === 'formE') {
        const isPurchase = isPurchaseWorktype(worktype.value);
        const esofTag = Array.from(requestTags).find(t => t.getAttribute('data-type') === 'esof');
        
        if (!esofTag) return;
        
        if (isPurchase) {
          // Auto-add eSoF for purchase worktypes
          if (!isEsofSelected) {
            esofTag.classList.add('selected');
            isEsofSelected = true;
            console.log('Auto-selected eSoF tag for purchase worktype change');
          }
        }
        // Note: Don't auto-remove eSoF when switching from purchase to non-purchase
        // User must manually deselect if they don't want it
        
        // Update hints
        updateEsofHints();
      }
    }

    relationDropdown.addEventListener('change', () => {
      if (relationDropdown.value) {
        relation.value = relationDropdown.value;
        relationDropdown.value = ''; // Reset dropdown
      }
    });
    
    // ===== ENTITY MODE CHECKBOX HANDLERS =====
    
    // Handle business checkbox - mutually exclusive with charity
    businessCheckbox.addEventListener('change', () => {
      if (businessCheckbox.checked) {
        // Uncheck charity if business is checked
        charityCheckbox.checked = false;
        
        // Switch to entity mode (business)
        switchToEntityMode('business');
      } else {
        // If both are now unchecked, switch to individual mode
        if (!charityCheckbox.checked) {
          switchToIndividualMode();
        }
      }
    });
    
    // Handle charity checkbox - mutually exclusive with business
    charityCheckbox.addEventListener('change', () => {
      if (charityCheckbox.checked) {
        // Uncheck business if charity is checked
        businessCheckbox.checked = false;
        
        // Switch to entity mode (charity)
        switchToEntityMode('charity');
      } else {
        // If both are now unchecked, switch to individual mode
        if (!businessCheckbox.checked) {
          switchToIndividualMode();
        }
      }
    });
    
    // ===== GLOBAL UPLOAD STATE =====
    
    let pendingFiles = []; // Array of files to upload (CDF, OFSI, message attachment)
    let pendingS3Keys = []; // Array of s3Keys returned from parent
    let pendingPutLinks = []; // Array of PUT links returned from parent
    let currentUploadIndex = 0; // Current file being uploaded
    let userEmail = ''; // Staff member email for file objects
    
    // ===== SUBMIT HANDLER =====
    
    // Handle form submission
    submitButton.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Check if a tag is selected
      if (!selectedRequestType) {
        showError('Please select a request type tag first');
        return;
      }
      
      // Comprehensive validation for Form J
      if (selectedRequestType === 'formJ' && !isEntityMode) {
        const formJError = validateFormJForSubmission();
        if (formJError) {
          showError(formJError);
          return;
        }
      }
      
      // Comprehensive validation for Form E
      if (selectedRequestType === 'formE' && !isEntityMode) {
        const formEError = validateFormEForSubmission();
        if (formEError) {
          showError(formEError);
          return;
        }
      }
      
      // Validate form
      const errors = validateForm();
      if (errors.length > 0) {
        showError(errors.join('\n'));
        return;
      }
      
      // Disable form to prevent changes during submission
      disableForm();
      
      // Collect files that need to be uploaded
      const filesToUpload = collectFilesToUpload();
      
      // If we have files, initiate upload flow
      if (filesToUpload.length > 0) {
        pendingFiles = filesToUpload;
        console.log('📤 Requesting PUT links for', filesToUpload.length, 'file(s)');
        
        // Show uploading popup
        showUploadingPopup(filesToUpload[0]);
        
        // Request PUT links from parent (matching message-iframe.html protocol)
        window.parent.postMessage({
          type: 'file-data',
          files: filesToUpload.map(f => f.metadata),
          _id: currentClientData?._id || ''
        }, '*');
      } else {
        // No files to upload, proceed directly to submit
        submitRequest();
      }
    });
    
    // ===== FORM J COMPREHENSIVE VALIDATION (RE-CHECK ON SUBMIT) =====
    
    function validateFormJForSubmission() {
      if (!currentClientData) {
        return 'Client data not loaded. Please refresh and try again.';
      }
      
      // Re-verify ID requirements
      const idImages = currentClientData.idI || [];
      const addressIDImages = idImages.filter(img => img.type === 'AddressID');
      const photoIDImages = idImages.filter(img => img.type === 'PhotoID');
      
      // Check for at least 2 Address ID images
      if (addressIDImages.length < 2) {
        return `Form J requires at least 2 Address ID images. Currently ${addressIDImages.length} uploaded. Please open the entry in the ID system and upload the required ID images before submitting this request.`;
      }
      
      // Check Photo ID requirements
      const hasFrontTag = photoIDImages.some(img => img.side === 'Front');
      const hasBackTag = photoIDImages.some(img => img.side === 'Back');
      
      if (hasFrontTag || hasBackTag) {
        // If either Front or Back tag exists, BOTH are required
        if (!hasFrontTag || !hasBackTag) {
          return 'Form J requires both Front and Back Photo ID images when either is present. Please open the entry in the ID system and upload the missing Photo ID side before submitting this request.';
        }
      } else {
        // No Front/Back tags, just need at least 1 Photo ID
        if (photoIDImages.length < 1) {
          return 'Form J requires at least 1 Photo ID image. Please open the entry in the ID system and upload a Photo ID before submitting this request.';
        }
      }
      
      // Re-verify likeness confirmation
      const likenessNotConfirmed = currentClientData.i?.l === true;
      if (likenessNotConfirmed) {
        return 'Likeness has not been confirmed. Until likeness is confirmed you can\'t submit a Form J request. Please speak to reception to update the tag or contact the client to complete further verification.';
      }
      
      // Verify required documents (CDF and OFSI)
      const hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
      const hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
      
      if (!hasCDF) {
        return 'Client Details Form (CDF) or Beneficiary Details Form is required for Form J. Please upload one before submitting.';
      }
      
      if (!hasOFSI) {
        return 'OFSI Sanctions Search is required for Form J. Please upload one before submitting.';
      }
      
      // All checks passed
      return null;
    }
    
    // ===== FORM E COMPREHENSIVE VALIDATION (RE-CHECK ON SUBMIT) =====
    
    function validateFormEForSubmission() {
      if (!currentClientData) {
        return 'Client data not loaded. Please refresh and try again.';
      }
      
      // Verify required documents (CDF and OFSI)
      const hasCDF = (cdfDocument !== null) || (uploadedCDFFile !== null);
      const hasOFSI = (ofsiDocument !== null) || (uploadedOFSIFile !== null);
      
      if (!hasCDF) {
        return 'Client Details Form (CDF) or Beneficiary Details Form is required for Form E. Please upload one before submitting.';
      }
      
      if (!hasOFSI) {
        return 'OFSI Sanctions Search is required for Form E. Please upload one before submitting.';
      }
      
      // All checks passed
      return null;
    }
    
    // ===== FILE COLLECTION FOR UPLOAD =====
    
    function collectFilesToUpload() {
      const files = [];
      
      // Collect CDF if newly uploaded
      if (uploadedCDFFile) {
        const fileName = `cdf-${Date.now()}-${uploadedCDFFile.name}`;
        const cdfType = cdfDropdown?.value || 'Client Details form';
        
        files.push({
          file: uploadedCDFFile,
          metadata: {
            type: 'Client AML & ID',
            document: cdfType,
            uploader: userEmail,
            data: {
              type: uploadedCDFFile.type,
              size: uploadedCDFFile.size,
              name: fileName,
              lastModified: uploadedCDFFile.lastModified
            }
          },
          targetArray: 'idD' // Will be added to idD array
        });
      }
      
      // Collect OFSI if newly uploaded
      if (uploadedOFSIFile) {
        const fileName = `ofsi-${Date.now()}-${uploadedOFSIFile.name}`;
        
        files.push({
          file: uploadedOFSIFile,
          metadata: {
            type: 'PEP & Sanctions Check',
            document: 'OFSI Sanctions Search',
            uploader: userEmail,
            data: {
              type: uploadedOFSIFile.type,
              size: uploadedOFSIFile.size,
              name: fileName,
              lastModified: uploadedOFSIFile.lastModified
            }
          },
          targetArray: 'idD' // Will be added to idD array
        });
      }
      
      // Collect message attachment if present
      if (currentUploadedFile) {
        const fileName = `message-attachment-${Date.now()}-${currentUploadedFile.name}`;
        
        files.push({
          file: currentUploadedFile,
          metadata: {
            type: 'Document',
            document: 'Message Attachment',
            uploader: userEmail,
            data: {
              type: currentUploadedFile.type,
              size: currentUploadedFile.size,
              name: fileName,
              lastModified: currentUploadedFile.lastModified
            }
          },
          targetArray: 'message' // Will be added to message chat array
        });
      }
      
      return files;
    }
    
    // ===== UPLOADING POPUP FUNCTIONS =====
    
    function showUploadingPopup(fileInfo) {
      const popup = document.getElementById('uploadingPopup');
      const fileName = document.getElementById('fileName');
      const fileSize = document.getElementById('fileSize');
      
      if (fileInfo && fileInfo.file) {
        fileName.textContent = fileInfo.metadata.document || fileInfo.file.name;
        fileSize.textContent = `${(fileInfo.file.size / 1024 / 1024).toFixed(2)} MB`;
      } else {
        fileName.textContent = 'Preparing upload...';
        fileSize.textContent = '';
      }
      
      popup.classList.add('show');
    }
    
    function hideUploadingPopup() {
      const popup = document.getElementById('uploadingPopup');
      popup.classList.remove('show');
    }
    
    function updateUploadingPopup(fileInfo, currentIndex, totalFiles) {
      const fileName = document.getElementById('fileName');
      const fileSize = document.getElementById('fileSize');
      const uploadingText = document.querySelector('.uploading-text');
      
      fileName.textContent = `${fileInfo.metadata.document || fileInfo.file.name} (${currentIndex + 1}/${totalFiles})`;
      fileSize.textContent = `${(fileInfo.file.size / 1024 / 1024).toFixed(2)} MB`;
      uploadingText.textContent = `Uploading file ${currentIndex + 1} of ${totalFiles}...`;
    }
    
    // ===== FORM DISABLE/ENABLE FUNCTIONS =====
    
    function disableForm() {
      // Disable all form inputs
      const allInputs = clientForm.querySelectorAll('input, select, textarea, button');
      allInputs.forEach(input => {
        input.disabled = true;
      });
      
      // Disable request tags
      requestTags.forEach(tag => {
        tag.style.pointerEvents = 'none';
        tag.style.opacity = '0.5';
      });
      
      console.log('🔒 Form disabled during submission');
    }
    
    function enableForm() {
      // Enable all form inputs
      const allInputs = clientForm.querySelectorAll('input, select, textarea, button');
      allInputs.forEach(input => {
        input.disabled = false;
      });
      
      // Enable request tags
      requestTags.forEach(tag => {
        tag.style.pointerEvents = 'auto';
        tag.style.opacity = '1';
      });
      
      console.log('🔓 Form enabled for retry');
    }
    
    // ===== S3 FILE UPLOAD FUNCTION =====
    
    async function uploadFileToS3(file, putLink, s3Key, index, totalFiles) {
      console.log(`📤 Uploading file ${index + 1}/${totalFiles}:`, file.metadata.document);
      
      try {
        const response = await fetch(putLink, {
          method: 'PUT',
          body: file.file,
          headers: {
            'Content-Type': file.file.type
          }
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }
        
        console.log(`✅ File ${index + 1}/${totalFiles} uploaded successfully`);
        
        // Store s3Key with file metadata for later use
        file.metadata.s3Key = s3Key;
        
        // If there are more files, upload the next one
        if (index + 1 < totalFiles) {
          currentUploadIndex = index + 1;
          const nextFile = pendingFiles[currentUploadIndex];
          const nextPutLink = pendingPutLinks[currentUploadIndex];
          const nextS3Key = pendingS3Keys[currentUploadIndex];
          
          // Update popup for next file
          updateUploadingPopup(nextFile, currentUploadIndex, totalFiles);
          
          await uploadFileToS3(nextFile, nextPutLink, nextS3Key, currentUploadIndex, totalFiles);
        } else {
          // All files uploaded successfully
          console.log('✅ All files uploaded successfully');
          hideUploadingPopup();
          
          // Proceed to submit request
          submitRequest();
        }
      } catch (error) {
        console.error('❌ File upload failed:', error);
        hideUploadingPopup();
        showError('File upload failed. Please try again.');
        
        // Re-enable form for retry
        enableForm();
        
        // Clear upload state
        pendingFiles = [];
        pendingS3Keys = [];
        pendingPutLinks = [];
        currentUploadIndex = 0;
      }
    }
    
    // ===== SUBMIT REQUEST FUNCTION =====
    
    function submitRequest() {
      console.log('📤 Submitting request to parent...');
      
      // Build updated data array based on currentClientData
      const updatedData = buildUpdatedDataArray();
      
      // Build message object (matching message-iframe.html format)
      const messageObject = buildMessageObject();
      
      // Send new-request to parent
      window.parent.postMessage({
        type: 'new-request',
        data: updatedData,
        message: messageObject,
        requestType: selectedRequestType,
        rule: selectedRequestType === 'formK' ? ruleSelect.value : null,
        _id: currentClientData?._id || ''
      }, '*');
      
      console.log('✅ Request sent to parent:', {
        requestType: selectedRequestType,
        dataUpdates: updatedData,
        message: messageObject
      });
    }
    
    // ===== BUILD UPDATED DATA ARRAY =====
    
    function buildUpdatedDataArray() {
      const updates = { ...currentClientData };
      
      // Update idD array with newly uploaded documents (CDF and/or OFSI)
      if (!updates.idD) {
        updates.idD = [];
      }
      
      // Add CDF to idD if newly uploaded
      const cdfFile = pendingFiles.find(f => f.targetArray === 'idD' && f.metadata.type === 'Client AML & ID');
      if (cdfFile && cdfFile.metadata.s3Key) {
        updates.idD.push({
          type: cdfFile.metadata.type,
          document: cdfFile.metadata.document,
          uploader: cdfFile.metadata.uploader,
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          s3Key: cdfFile.metadata.s3Key,
          name: cdfFile.metadata.data.name,
          size: cdfFile.metadata.data.size,
          mimeType: cdfFile.metadata.data.type
        });
      }
      
      // Add OFSI to idD if newly uploaded
      const ofsiFile = pendingFiles.find(f => f.targetArray === 'idD' && f.metadata.type === 'PEP & Sanctions Check');
      if (ofsiFile && ofsiFile.metadata.s3Key) {
        updates.idD.push({
          type: ofsiFile.metadata.type,
          document: ofsiFile.metadata.document,
          uploader: ofsiFile.metadata.uploader,
          date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          s3Key: ofsiFile.metadata.s3Key,
          name: ofsiFile.metadata.data.name,
          size: ofsiFile.metadata.data.size,
          mimeType: ofsiFile.metadata.data.type
        });
      }
      
      return updates;
    }
    
    // ===== BUILD MESSAGE OBJECT =====
    
    function buildMessageObject() {
      const messageFile = pendingFiles.find(f => f.targetArray === 'message');
      
      const messageObj = {
        time: new Date().toLocaleString('en-GB', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        user: userEmail,
        message: messageInput.value.trim(),
        type: 'Staff' // Always Staff for request submissions
      };
      
      // Add file metadata if message attachment exists
      if (messageFile && messageFile.metadata.s3Key) {
        messageObj.file = {
          name: messageFile.metadata.data.name,
          size: messageFile.metadata.data.size,
          type: messageFile.metadata.data.type,
          s3Key: messageFile.metadata.s3Key
        };
      }
      
      return messageObj;
    }
    
    // ===== FILE UPLOAD HANDLERS =====
    
    // Trigger file input when upload area is clicked
    function triggerFileInput() {
      fileInput.click();
    }
    
    // Handle file selection from browse dialog
    function handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Check if file is an image
      if (file.type.startsWith('image/')) {
        showError('Please open the entry in the ID system to upload ID Images');
        // Reset file input
        event.target.value = '';
        return;
      }

      // Only allow document types
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/rtf'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        showError('Please select a valid document file (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF)');
        event.target.value = '';
        return;
      }
      
      console.log('Document selected:', file.name, file.type);
      
      // Store the file
      currentUploadedFile = file;
      
      // Update UI to show success
      updateUploadAreaWithFile(file);
    }
    
    // Update upload area to show checkmark and filename
    function updateUploadAreaWithFile(file) {
      // Change icon to checkmark
      uploadIcon.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      `;
      
      // Show filename (truncate if too long)
      const maxLength = 10;
      let displayName = file.name;
      if (displayName.length > maxLength) {
        const ext = displayName.substring(displayName.lastIndexOf('.'));
        displayName = displayName.substring(0, maxLength - ext.length - 3) + '...' + ext;
      }
      uploadText.textContent = displayName;
      uploadText.title = file.name; // Full name on hover
    }
    
    // Reset upload area to default state
    function resetUploadArea() {
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
      currentUploadedFile = null;
    }
    
    // Drag-and-drop handlers
    function handleDragOver(event) {
      event.preventDefault();
      uploadArea.classList.add('dragover');
    }
    
    function handleDragLeave(event) {
      uploadArea.classList.remove('dragover');
    }
    
    function handleDrop(event) {
      event.preventDefault();
      uploadArea.classList.remove('dragover');
      const files = event.dataTransfer.files;
      
      if (files.length > 0) {
        const file = files[0];
        
        // Check if file is an image
        if (file.type.startsWith('image/')) {
          showError('Please open the entry in the ID system to upload ID Images');
          return;
        }

        // Only allow document types
        const allowedTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'application/rtf'
        ];
        
        if (!allowedTypes.includes(file.type)) {
          showError('Please select a valid document file (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF)');
          return;
        }
        
        console.log('Document dropped:', file.name, file.type);
        
        // Store the file
        currentUploadedFile = file;
        
        // Set the dropped file to the input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Update UI
        updateUploadAreaWithFile(file);
      }
    }
    
    /*
    Update labels based on entity type (business vs charity)
    */
    function updateEntityLabels() {
      const isCharity = entityType === 'charity';
      
      // Update labels
      document.querySelector('label[for="businessName"]').textContent = isCharity ? 'Charity Name' : 'Business Name';
      document.querySelector('label[for="entityNumber"]').textContent = isCharity ? 'Charity Number' : 'Company Number';
      
      // Update placeholders
      businessName.placeholder = isCharity ? 'Search by charity name...' : 'Search by company name...';
      entityNumber.placeholder = isCharity ? 'Search by charity number...' : 'Search by company number...';
      
      // Update registration country label
      document.querySelector('label[for="registrationCountry"]').textContent = 'Registration Country';
      
      console.log(`✏️ Labels updated for ${entityType} mode`);
    }
    
    // ===== CACHE MANAGEMENT =====
    
    /*
    LocalStorage Cache for Address API Results
    - Reduces API calls by caching autocomplete suggestions and full address objects
    - 7-day expiry on cached items
    - LRU eviction: max 50 autocomplete results, max 50 address objects
    - Cache keys: 'auto_SEARCHTERM' for suggestions, 'addr_ADDRESSID' for full addresses
    */
    
    const CACHE_EXPIRY_DAYS = 7;
    const MAX_AUTOCOMPLETE_CACHE = 50;
    const MAX_ADDRESS_CACHE = 50;
    
    // Clear expired cache items on page load
    clearExpiredCache();
    
    function isCacheExpired(timestamp) {
      const now = Date.now();
      const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      return (now - timestamp) > expiryMs;
    }
    
    function getCachedItem(key, type) {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const parsed = JSON.parse(cached);
        
        // Check if expired
        if (isCacheExpired(parsed.timestamp)) {
          localStorage.removeItem(key);
          return null;
        }
        
        // Update timestamp for LRU (mark as recently accessed)
        parsed.timestamp = Date.now();
        localStorage.setItem(key, JSON.stringify(parsed));
        
        return parsed.data;
      } catch (error) {
        console.error('Cache read error:', error);
        return null;
      }
    }
    
    function setCachedItem(key, data, type) {
      try {
        const item = {
          data: data,
          timestamp: Date.now(),
          type: type
        };
        
        localStorage.setItem(key, JSON.stringify(item));
        
        // Enforce cache limits with LRU eviction
        enforceCacheLimit(type);
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }
    
    function enforceCacheLimit(type) {
      try {
        const prefix = type === 'autocomplete' ? 'auto_' : 'addr_';
        const maxItems = type === 'autocomplete' ? MAX_AUTOCOMPLETE_CACHE : MAX_ADDRESS_CACHE;
        
        // Get all items of this type
        const items = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const cached = localStorage.getItem(key);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                items.push({ key: key, timestamp: parsed.timestamp });
              } catch (e) {
                // Invalid item, remove it
                localStorage.removeItem(key);
              }
            }
          }
        }
        
        // If over limit, remove oldest items
        if (items.length > maxItems) {
          // Sort by timestamp (oldest first)
          items.sort((a, b) => a.timestamp - b.timestamp);
          
          // Remove oldest items until we're at the limit
          const toRemove = items.length - maxItems;
          for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(items[i].key);
          }
        }
      } catch (error) {
        console.error('Cache limit enforcement error:', error);
      }
    }
    
    function clearExpiredCache() {
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('auto_') || key.startsWith('addr_'))) {
            const cached = localStorage.getItem(key);
            if (cached) {
              try {
                const parsed = JSON.parse(cached);
                if (isCacheExpired(parsed.timestamp)) {
                  keysToRemove.push(key);
                }
              } catch (e) {
                keysToRemove.push(key); // Remove malformed items
              }
            }
          }
        }
        
        // Remove expired items
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        if (keysToRemove.length > 0) {
          console.log(`Cleared ${keysToRemove.length} expired cache items`);
        }
      } catch (error) {
        console.error('Cache cleanup error:', error);
      }
    }
    
    // ===== ADDRESS FORMATTING FUNCTIONS =====
    
    /*
    Parse manual address text into Thirdfort API format
    - Used when user types address manually (no autocomplete match)
    - Attempts to extract postcode, town, and address components
    - Returns UK-format address (no address_1/address_2 as per API spec)
    */
    function parseManualAddress(addressText, country = 'GBR') {
      if (!addressText || !addressText.trim()) return null;
      
      const text = addressText.trim();
      
      // UK addresses: Don't use address_1/address_2 (not allowed per API spec)
      if (country === 'GBR') {
        // Try to extract UK postcode
        const postcodeMatch = text.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2})\b/i);
        const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';
        
        // Split by commas
        const parts = text.split(',').map(p => p.trim()).filter(p => p);
        
        let town = '';
        let street = '';
        
        if (parts.length > 0) {
          if (postcode) {
            const postcodeIndex = parts.findIndex(p => p.toUpperCase().includes(postcode));
            if (postcodeIndex > 0) {
              town = parts[postcodeIndex - 1];
              street = parts[0]; // First part is likely the street with building number
            } else if (parts.length > 1) {
              town = parts[parts.length - 1];
              street = parts[0];
            } else {
              street = parts[0];
            }
          } else {
            if (parts.length > 1) {
              town = parts[parts.length - 1];
              street = parts[0];
            } else {
              street = parts[0];
            }
          }
        }
        
        return {
          building_name: '',
          building_number: '',
          flat_number: '',
          postcode: postcode,
          street: street || text,
          sub_street: '',
          town: town || 'Unknown',
          country: 'GBR'
        };
      }
      
      // Non-UK addresses: Use address_1, address_2
      const postcodeMatch = text.match(/\b([A-Z0-9]{3,10})\b/i);
      const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : '';
      
      const parts = text.split(',').map(p => p.trim()).filter(p => p);
      let town = '';
      let addressLines = [];
      
      if (parts.length > 0) {
        if (parts.length > 1) {
          town = parts[parts.length - 1];
          addressLines = parts.slice(0, parts.length - 1);
        } else {
          addressLines = [parts[0]];
        }
      }
      
      return {
        address_1: addressLines[0] || text,
        address_2: addressLines[1] || '',
        postcode: postcode,
        street: '',
        sub_street: '',
        town: town || 'Unknown',
        state: '',
        country: country
      };
    }
    
    /*
    Format getaddress.io address object to Thirdfort API format
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
    Format Thirdfort address object for display in input field
    - Used when loading existing data from database
    - UK addresses use individual fields (building_number, street, etc.)
    - Non-UK addresses use address_1, address_2
    - Per Thirdfort API spec: UK addresses don't have address_1/address_2
    */
    function formatThirdfortForDisplay(thirdfortAddress) {
      if (!thirdfortAddress) return '';
      
      // UK addresses: Build from individual fields
      if (thirdfortAddress.country === 'GBR') {
        const parts = [
          thirdfortAddress.flat_number,
          thirdfortAddress.building_number,
          thirdfortAddress.building_name,
          thirdfortAddress.street,
          thirdfortAddress.sub_street,
          thirdfortAddress.town,
          thirdfortAddress.postcode
        ].filter(p => p && p.trim());
        
        return parts.join(', ');
      }
      
      // Non-UK addresses: Use address_1, address_2
      const parts = [
        thirdfortAddress.address_1,
        thirdfortAddress.address_2,
        thirdfortAddress.town,
        thirdfortAddress.state,
        thirdfortAddress.postcode
      ].filter(p => p && p.trim());
      
      return parts.join(', ');
    }
    
    /*
    Format getaddress.io address for display
    */
    function formatAddressForDisplay(getAddressData) {
      if (!getAddressData) return '';
      
      const parts = [
        getAddressData.line_1,
        getAddressData.line_2,
        getAddressData.line_3,
        getAddressData.line_4,
        getAddressData.locality,
        getAddressData.town_or_city,
        getAddressData.postcode
      ].filter(p => p && p.trim());
      
      return parts.join(', ');
    }
    
    // ===== ADDRESS AUTOCOMPLETE =====
    
    /*
    Setup address autocomplete with debouncing
    */
    function setupAddressAutocomplete(inputElement, dropdownElement, timerType, isCurrentAddress) {
      let selectedIndex = -1;
      
      inputElement.addEventListener('input', (e) => {
        // Don't trigger API search during data loading
        if (isLoadingData) {
          return;
        }
        
        const searchTerm = e.target.value.trim();
        
        // Clear timer
        if (timerType === 'current') {
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
        
        // Check cache first
        const cacheKey = 'auto_' + searchTerm.toLowerCase();
        const cachedSuggestions = getCachedItem(cacheKey, 'autocomplete');
        
        if (cachedSuggestions) {
          console.log('✅ Cache hit for autocomplete:', searchTerm);
          displayAddressSuggestions(cachedSuggestions, isCurrentAddress ? 'current' : 'previous');
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
            field: isCurrentAddress ? 'current' : 'previous'
          }, '*');
        }, 300);
        
        if (timerType === 'current') {
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
    Display address suggestions in dropdown
    */
    function displayAddressSuggestions(suggestions, field) {
      const dropdownElement = field === 'current' ? currentAddressDropdown : previousAddressDropdown;
      const isCurrentAddress = field === 'current';
      
      if (!suggestions || suggestions.length === 0) {
        dropdownElement.innerHTML = '<div class="address-no-results">No addresses found</div>';
        return;
      }
      
      dropdownElement.innerHTML = '';
      
      suggestions.forEach((suggestion) => {
        const item = document.createElement('div');
        item.className = 'address-dropdown-item';
        item.textContent = suggestion.address;
        
        item.addEventListener('click', () => {
          selectAddressSuggestion(suggestion.id, suggestion.address, isCurrentAddress);
        });
        
        dropdownElement.appendChild(item);
      });
    }
    
    /*
    Handle address selection from dropdown
    */
    function selectAddressSuggestion(addressId, displayText, isCurrentAddress) {
      const inputElement = isCurrentAddress ? currentAddress : previousAddress;
      const dropdownElement = isCurrentAddress ? currentAddressDropdown : previousAddressDropdown;
      
      inputElement.value = displayText;
      dropdownElement.classList.add('hidden');
      
      // Check cache for full address first
      const cacheKey = 'addr_' + addressId;
      const cachedAddress = getCachedItem(cacheKey, 'address');
      
      if (cachedAddress) {
        console.log('✅ Cache hit for full address:', addressId);
        handleAddressData(cachedAddress, isCurrentAddress ? 'current' : 'previous');
        return;
      }
      
      // Request full address from parent
      console.log('📡 API call for full address:', addressId);
      window.parent.postMessage({
        type: 'address-lookup',
        addressId: addressId,
        field: isCurrentAddress ? 'current' : 'previous'
      }, '*');
    }
    
    /*
    Handle full address data from parent
    */
    function handleAddressData(addressData, field) {
      const country = field === 'current' ? currentCountry.value : previousCountry.value;
      const thirdfortAddress = formatToThirdfort(addressData, country);
      
      if (field === 'current') {
        currentAddressObject = thirdfortAddress;
      } else {
        previousAddressObject = thirdfortAddress;
      }
    }
    
    // ===== COMPANY SEARCH (Companies House) =====
    
    /*
    Setup company search autocomplete for business name
    */
    function setupCompanyNameAutocomplete() {
      let selectedIndex = -1;
      
      businessName.addEventListener('input', (e) => {
        // Don't trigger API search during data loading
        if (isLoadingData) {
          return;
        }
        
        const searchTerm = e.target.value.trim();
        
        // Clear timer
        if (companyNameDebounceTimer) clearTimeout(companyNameDebounceTimer);
        
        // Clear stored company data when user types
        businessData = null;
        updateCompanyButtons();
        
        // Hide dropdown if too short or not UK
        if (searchTerm.length < 2 || registrationCountry.value !== 'GB') {
          businessNameDropdown.classList.add('hidden');
          businessNameDropdown.innerHTML = '';
          return;
        }
        
        // Show loading
        businessNameDropdown.classList.remove('hidden');
        const searchingText = entityType === 'charity' ? 'Searching charities...' : 'Searching companies...';
        businessNameDropdown.innerHTML = `<div class="address-loading">${searchingText}</div>`;
        
        // Debounce 300ms
        companyNameDebounceTimer = setTimeout(() => {
          const apiType = entityType === 'charity' ? 'charity-search' : 'company-search';
          console.log(`📡 API call for ${entityType} name search:`, searchTerm);
          window.parent.postMessage({
            type: apiType,
            searchTerm: searchTerm,
            searchBy: 'name',
            entityType: entityType
          }, '*');
        }, 300);
      });
      
      // Keyboard navigation
      businessName.addEventListener('keydown', (e) => {
        const items = businessNameDropdown.querySelectorAll('.address-dropdown-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          updateSelectedCompanyItem(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelectedCompanyItem(items, selectedIndex);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          items[selectedIndex].click();
        } else if (e.key === 'Escape') {
          businessNameDropdown.classList.add('hidden');
          selectedIndex = -1;
        }
      });
      
      // Click outside to close
      document.addEventListener('click', (e) => {
        if (!businessName.contains(e.target) && !businessNameDropdown.contains(e.target)) {
          businessNameDropdown.classList.add('hidden');
          selectedIndex = -1;
        }
      });
    }
    
    /*
    Setup company search autocomplete for entity number
    */
    function setupCompanyNumberAutocomplete() {
      let selectedIndex = -1;
      
      entityNumber.addEventListener('input', (e) => {
        // Don't trigger API search during data loading
        if (isLoadingData) {
          return;
        }
        
        const searchTerm = e.target.value.trim();
        
        // Clear timer
        if (companyNumberDebounceTimer) clearTimeout(companyNumberDebounceTimer);
        
        // Clear stored company data when user types
        businessData = null;
        updateCompanyButtons();
        
        // Hide dropdown if too short or not UK
        if (searchTerm.length < 2 || registrationCountry.value !== 'GB') {
          entityNumberDropdown.classList.add('hidden');
          entityNumberDropdown.innerHTML = '';
          return;
        }
        
        // Show loading
        entityNumberDropdown.classList.remove('hidden');
        const searchingText = entityType === 'charity' ? 'Searching charities...' : 'Searching companies...';
        entityNumberDropdown.innerHTML = `<div class="address-loading">${searchingText}</div>`;
        
        // Debounce 300ms
        companyNumberDebounceTimer = setTimeout(() => {
          const apiType = entityType === 'charity' ? 'charity-search' : 'company-search';
          console.log(`📡 API call for ${entityType} number search:`, searchTerm);
          window.parent.postMessage({
            type: apiType,
            searchTerm: searchTerm,
            searchBy: 'number',
            entityType: entityType
          }, '*');
        }, 300);
      });
      
      // Keyboard navigation
      entityNumber.addEventListener('keydown', (e) => {
        const items = entityNumberDropdown.querySelectorAll('.address-dropdown-item');
        if (items.length === 0) return;
        
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
          updateSelectedCompanyItem(items, selectedIndex);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, -1);
          updateSelectedCompanyItem(items, selectedIndex);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          items[selectedIndex].click();
        } else if (e.key === 'Escape') {
          entityNumberDropdown.classList.add('hidden');
          selectedIndex = -1;
        }
      });
      
      // Click outside to close
      document.addEventListener('click', (e) => {
        if (!entityNumber.contains(e.target) && !entityNumberDropdown.contains(e.target)) {
          entityNumberDropdown.classList.add('hidden');
          selectedIndex = -1;
        }
      });
    }
    
    function updateSelectedCompanyItem(items, index) {
      items.forEach((item, i) => {
        if (i === index) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });
    }
    
    /*
    Display company suggestions in dropdown
    */
    function displayCompanySuggestions(suggestions, searchBy) {
      // Only show results in the dropdown for the field being searched
      const dropdownElement = searchBy === 'name' ? businessNameDropdown : entityNumberDropdown;
      
      if (!suggestions || suggestions.length === 0) {
        dropdownElement.innerHTML = '<div class="address-no-results">No companies found</div>';
        dropdownElement.classList.remove('hidden');
        return;
      }
      
      dropdownElement.innerHTML = '';
      
      suggestions.forEach((company) => {
        const item = document.createElement('div');
        item.className = 'address-dropdown-item';
        // Format: "Company Name (Number)"
        item.textContent = `${company.title} (${company.company_number})`;
        
        item.addEventListener('click', () => {
          selectCompany(company);
        });
        
        dropdownElement.appendChild(item);
      });
      
      dropdownElement.classList.remove('hidden');
    }
    
    /*
    Handle company selection from dropdown
    */
    function selectCompany(company) {
      // Populate BOTH form fields
      businessName.value = company.title;
      entityNumber.value = company.company_number;
      
      // Hide both dropdowns
      businessNameDropdown.classList.add('hidden');
      entityNumberDropdown.classList.add('hidden');
      
      // Request full company/charity data from parent (directors/trustees, officers, PSCs)
      const apiType = entityType === 'charity' ? 'charity-lookup' : 'company-lookup';
      console.log(`📡 Requesting full ${entityType} data for:`, company.company_number);
      window.parent.postMessage({
        type: apiType,
        companyNumber: company.company_number,
        entityType: entityType
      }, '*');
      
      // Trigger unsaved changes
      notifyUnsavedChanges();
    }
    
    /*
    Handle full company data from parent
    */
    function handleCompanyData(data) {
      businessData = data;
      console.log('✅ Received full company data:', businessData);
      // Company data now includes: directors, officers, PSCs, registered_office_address, etc.
      
      // Show the link and refresh buttons
      updateCompanyButtons();
      
      // Auto-populate registered office address if no current address exists
      if (businessData.registered_office_address) {
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
        
        // Check if we already have a current address
        const hasExistingAddress = currentAddress?.value?.trim() || currentAddressObject;
        
        if (!hasExistingAddress && addressString) {
          console.log('📍 Auto-populating registered office address:', addressString);
          
          // Set UK as country
          currentCountry.value = 'GBR';
          
          // Populate the autocomplete field
          currentAddress.value = addressString;
          
          // Trigger address search to find exact match
          if (addressString.length >= 7) {
            console.log('📡 Searching for registered office address in getaddress.io');
            window.parent.postMessage({
              type: 'address-search',
              searchTerm: addressString,
              field: 'current'
            }, '*');
          }
        } else if (hasExistingAddress) {
          console.log('ℹ️ Current address already exists, not overwriting');
        }
      }
      
      // Trigger unsaved changes
      notifyUnsavedChanges();
    }
    
    /*
    Update visibility of company link and refresh buttons
    */
    function updateCompanyButtons() {
      if (businessData && entityNumber?.value?.trim()) {
        companyLinkBtn.classList.remove('hidden');
        companyRefreshBtn.classList.remove('hidden');
        downloadSummaryBtn.classList.remove('hidden');
        populatePeopleCards();
      } else {
        companyLinkBtn.classList.add('hidden');
        companyRefreshBtn.classList.add('hidden');
        downloadSummaryBtn.classList.add('hidden');
        clearPeopleCards();
      }
    }
    
    /*
    Populate people cards (Officers, Directors, PSCs)
    */
    function populatePeopleCards() {
      if (!businessData || !peopleRepeater) return;
      
      peopleRepeater.innerHTML = '';
      
      // Use a map to merge duplicates by normalized name
      const peopleMap = new Map();
      
      // Extract Officers, Directors, and Trustees
      if (businessData.officers && businessData.officers.length > 0) {
        businessData.officers.forEach(officer => {
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
          } else {
            peopleMap.set(normalizedName, {
              displayName: officer.name,
              types: [roleType],
              share: null
            });
          }
        });
      }
      
      // Extract PSCs (with ownership info)
      if (businessData.pscs && businessData.pscs.length > 0) {
        businessData.pscs.forEach(psc => {
          const normalizedName = normalizeName(psc.name);
          const existing = peopleMap.get(normalizedName);
          
          // Extract ownership percentage from natures_of_control
          let shareInfo = null;
          if (psc.natures_of_control && psc.natures_of_control.length > 0) {
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
          } else {
            peopleMap.set(normalizedName, {
              displayName: psc.name,
              types: ['psc'],
              share: shareInfo
            });
          }
        });
      }
      
      const allPeople = Array.from(peopleMap.values());
    
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
      
      // Create cards
      if (allPeople.length === 0) {
        peopleRepeater.innerHTML = '<div class="no-people-message">No officers, directors, or PSCs found</div>';
        return;
      }
      
      allPeople.forEach(person => {
        const card = document.createElement('div');
        card.className = 'people-card';
        
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
      
      console.log(`✅ Displayed ${allPeople.length} people cards`);
    }
    
    /*
    Clear people cards
    */
    function clearPeopleCards() {
      if (peopleRepeater) {
        const message = entityType === 'charity' 
          ? 'Link a charity to view trustees and directors'
          : 'Link a company to view officers, directors, and PSCs';
        peopleRepeater.innerHTML = `<div class="no-people-message">${message}</div>`;
      }
    }
    
    /*
    Open Companies House or Charity Commission page for the linked entity
    */
    function openCompaniesHousePage() {
      if (entityNumber?.value?.trim()) {
        const entityNum = entityNumber.value.trim();
        let url;
        
        if (entityType === 'charity') {
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
        
        window.open(url, `${entityType}Register`, features);
      }
    }
    
    /*
    Open UK Sanctions List search in popup window
    */
    function openSanctionsCheck() {
      const url = 'https://sanctionssearchapp.ofsi.hmtreasury.gov.uk/';
      const width = 1000;
      const height = 800;
      const left = (screen.width - width) / 2;
      const top = (screen.height - height) / 2;
      const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
      
      window.open(url, 'sanctionsCheck', features);
      console.log('🔍 Opening OFSI Sanctions Search');
    }
    
    /*
    Refresh company data from Companies House
    */
    function refreshCompanyData() {
      if (entityNumber?.value?.trim()) {
        const companyNumber = entityNumber.value.trim();
        const apiType = entityType === 'charity' ? 'charity-lookup' : 'company-lookup';
        console.log(`🔄 Refreshing ${entityType} data for:`, companyNumber);
        window.parent.postMessage({
          type: apiType,
          companyNumber: companyNumber,
          entityType: entityType
        }, '*');
      }
    }
    
    /*
    Generate and download company/charity summary as PDF
    */
    function downloadCompanySummary() {
      if (!businessData || !window.jspdf) {
        console.error('Cannot generate PDF: missing data or jsPDF library');
        return;
      }
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'pt', 'a4');
      
      // Get current user email from parent (or use placeholder)
      const userEmail = 'user@thurstanhoskin.co.uk'; // Will be populated from parent
      const generatedDate = new Date().toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      // A4 dimensions: 595pt wide, 842pt tall
      const pageWidth = 595;
      const pageHeight = 842;
      const margin = 40;
      let yPosition = margin;
      
      // Set font
      doc.setFont('helvetica');
      
      // Header - Add logos (Note: SVGs need to be converted or we use text)
      // For now, we'll use text headers - you can add logo images later
      doc.setFontSize(24);
      doc.setTextColor(0, 60, 113);
      doc.setFont('helvetica', 'bold');
      doc.text('Thurstan Hoskin', margin, yPosition);
      
      doc.setFontSize(18);
      doc.text("Val'ID'ate", pageWidth - margin - 120, yPosition);
      
      yPosition += 10;
      
      // Header border
      doc.setDrawColor(0, 60, 113);
      doc.setLineWidth(3);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 25;
      
      // Document title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const title = entityType === 'charity' ? 'Charity Summary' : 'Company Summary';
      const titleWidth = doc.getTextWidth(title);
      doc.text(title, (pageWidth - titleWidth) / 2, yPosition);
      
      yPosition += 20;
      
      // Company/Charity name subtitle
      doc.setFontSize(14);
      doc.setTextColor(102, 102, 102);
      doc.setFont('helvetica', 'normal');
      const companyName = businessData.company_name || businessName?.value || 'Unknown';
      const subtitleWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - subtitleWidth) / 2, yPosition);
      
      yPosition += 30;
      
      // Registration Details Section
      doc.setFontSize(14);
      doc.setTextColor(0, 60, 113);
      doc.setFont('helvetica', 'bold');
      doc.text('Registration Details', margin, yPosition);
      
      yPosition += 5;
      doc.setDrawColor(221, 221, 221);
      doc.setLineWidth(1);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 15;
      
      // Company info
      doc.setFontSize(11);
      doc.setTextColor(51, 51, 51);
      const labelX = margin;
      const valueX = margin + 200;
      
      const companyInfo = [
        ['Company Name:', companyName],
        ['Company Number:', businessData.company_number || entityNumber?.value || 'N/A'],
        ['Registration Country:', registrationCountry?.value === 'GB' ? 'United Kingdom' : registrationCountry?.value || 'N/A'],
        ['Company Status:', businessData.company_status || 'N/A'],
        ['Date of Incorporation:', businessData.date_of_creation || 'N/A'],
        ['Company Type:', businessData.type || 'N/A']
      ];
      
      companyInfo.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, labelX, yPosition);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(85, 85, 85);
        doc.text(String(value), valueX, yPosition);
        doc.setTextColor(51, 51, 51);
        yPosition += 18;
      });
      
      yPosition += 10;
      
      // Registered Office Address
      doc.setFontSize(14);
      doc.setTextColor(0, 60, 113);
      doc.setFont('helvetica', 'bold');
      doc.text('Registered Office Address', margin, yPosition);
      
      yPosition += 5;
      doc.setDrawColor(221, 221, 221);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 15;
      
      doc.setFontSize(11);
      doc.setTextColor(85, 85, 85);
      doc.setFont('helvetica', 'normal');
      
      if (businessData.registered_office_address) {
        const address = businessData.registered_office_address;
        const addressLines = [
          address.premises,
          address.address_line_1,
          address.address_line_2,
          address.locality,
          address.postal_code,
          'United Kingdom'
        ].filter(line => line && line.trim());
        
        addressLines.forEach(line => {
          doc.text(line, margin, yPosition);
          yPosition += 16;
        });
      } else {
        doc.text('Address not available', margin, yPosition);
        yPosition += 16;
      }
      
      yPosition += 15;
      
      // Accounts/Financial Information
      if (entityType === 'business' && businessData.accounts) {
        doc.setFontSize(14);
        doc.setTextColor(0, 60, 113);
        doc.setFont('helvetica', 'bold');
        doc.text('Accounts Information', margin, yPosition);
        
        yPosition += 5;
        doc.setDrawColor(221, 221, 221);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        
        yPosition += 15;
        
        doc.setFontSize(11);
        doc.setTextColor(51, 51, 51);
        
        const accountsInfo = [
          ['Last Accounts Date:', businessData.accounts?.last_accounts?.made_up_to || 'N/A'],
          ['Next Accounts Due:', businessData.accounts?.next_due || businessData.accounts?.next_made_up_to || 'N/A'],
          ['Filing Status:', businessData.accounts?.overdue ? 'Overdue' : 'Up to date']
        ];
        
        accountsInfo.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold');
          doc.text(label, labelX, yPosition);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(85, 85, 85);
          doc.text(String(value), valueX, yPosition);
          doc.setTextColor(51, 51, 51);
          yPosition += 18;
        });
        
        yPosition += 10;
      } else if (entityType === 'charity') {
        doc.setFontSize(14);
        doc.setTextColor(0, 60, 113);
        doc.setFont('helvetica', 'bold');
        doc.text('Financial Information', margin, yPosition);
        
        yPosition += 5;
        doc.setDrawColor(221, 221, 221);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        
        yPosition += 15;
        
        doc.setFontSize(11);
        doc.setTextColor(51, 51, 51);
        
        const financialInfo = [
          ['Latest Income:', businessData.charity_income ? `£${businessData.charity_income.toLocaleString()}` : 'N/A'],
          ['Latest Expenditure:', businessData.charity_expenditure ? `£${businessData.charity_expenditure.toLocaleString()}` : 'N/A']
        ];
        
        financialInfo.forEach(([label, value]) => {
          doc.setFont('helvetica', 'bold');
          doc.text(label, labelX, yPosition);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(85, 85, 85);
          doc.text(String(value), valueX, yPosition);
          doc.setTextColor(51, 51, 51);
          yPosition += 18;
        });
        
        yPosition += 10;
      }
      
      // People Table (Officers, Directors, PSCs, Trustees)
      doc.setFontSize(14);
      doc.setTextColor(0, 60, 113);
      doc.setFont('helvetica', 'bold');
      const peopleTitle = entityType === 'charity' 
        ? 'Trustees & Directors' 
        : 'Officers, Directors & Persons with Significant Control';
      doc.text(peopleTitle, margin, yPosition);
      
      yPosition += 5;
      doc.setDrawColor(221, 221, 221);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      
      yPosition += 10;
      
      // Build people data for table
      const peopleMap = new Map();
      
      // Extract Officers, Directors, and Trustees
      if (businessData.officers && businessData.officers.length > 0) {
        businessData.officers.forEach(officer => {
          const normalizedName = normalizeName(officer.name);
          const existing = peopleMap.get(normalizedName);
          
          let roleType;
          if (officer.officer_role === 'director') roleType = 'Director';
          else if (officer.officer_role === 'trustee') roleType = 'Trustee';
          else roleType = 'Officer';
          
          const appointedDate = officer.appointed_on ? formatDate(officer.appointed_on) : '—';
          
          if (existing) {
            if (!existing.roles.includes(roleType)) {
              existing.roles.push(roleType);
            }
          } else {
            peopleMap.set(normalizedName, {
              name: officer.name,
              roles: [roleType],
              share: null,
              appointed: appointedDate
            });
          }
        });
      }
      
      // Extract PSCs
      if (businessData.pscs && businessData.pscs.length > 0) {
        businessData.pscs.forEach(psc => {
          const normalizedName = normalizeName(psc.name);
          const existing = peopleMap.get(normalizedName);
          
          let shareInfo = '—';
          if (psc.natures_of_control && psc.natures_of_control.length > 0) {
            const control = psc.natures_of_control[0];
            if (control.includes('25-to-50')) shareInfo = '25-50%';
            else if (control.includes('50-to-75')) shareInfo = '50-75%';
            else if (control.includes('75-to-100')) shareInfo = '75-100%';
            else if (control.includes('ownership-of-shares')) shareInfo = 'Significant';
          }
          
          if (existing) {
            if (!existing.roles.includes('PSC')) {
              existing.roles.push('PSC');
            }
            existing.share = shareInfo;
          } else {
            peopleMap.set(normalizedName, {
              name: psc.name,
              roles: ['PSC'],
              share: shareInfo,
              appointed: '—'
            });
          }
        });
      }
      
      const allPeople = Array.from(peopleMap.values());
      
      // Helper function for normalizeName (same as populatePeopleCards)
      function normalizeName(name) {
        if (!name) return '';
        return name
          .toLowerCase()
          .replace(/^(mr|mrs|ms|miss|dr|rev|sir|lord|dame|prof|professor)\s+/i, '')
          .replace(/[,\.]/g, '')
          .split(/\s+/)
          .filter(w => w)
          .sort()
          .join(' ')
          .trim();
      }
      
      // Helper function to format date
      function formatDate(dateString) {
        if (!dateString) return '—';
        try {
          const date = new Date(dateString);
          return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
          return dateString;
        }
      }
      
      // Create table data
      const tableData = allPeople.map(person => [
        person.name,
        person.roles.join(', '),
        person.share || '—',
        person.appointed
      ]);
      
      // Use autoTable plugin
      doc.autoTable({
        startY: yPosition,
        head: [['Name', 'Role(s)', 'Share', 'Appointed']],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [0, 60, 113],
          textColor: 255,
          fontSize: 11,
          fontStyle: 'bold'
        },
        bodyStyles: {
          fontSize: 11,
          textColor: [51, 51, 51]
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        },
        margin: { left: margin, right: margin }
      });
      
      yPosition = doc.lastAutoTable.finalY + 20;
      
      // Warning box
      doc.setFillColor(255, 243, 205);
      doc.setDrawColor(255, 193, 7);
      doc.roundedRect(margin, yPosition, pageWidth - (margin * 2), 50, 4, 4, 'FD');
      
      doc.setFontSize(11);
      doc.setTextColor(133, 100, 4);
      doc.setFont('helvetica', 'bold');
      doc.text('⚠️ AML & ID Verification Required', margin + 10, yPosition + 15);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const warningText = 'Ensure all directors and persons with significant control (> 25% share) have undergone';
      const warningText2 = 'appropriate Anti-Money Laundering checks and identity verification in accordance with MLR 2017.';
      doc.text(warningText, margin + 10, yPosition + 30);
      doc.text(warningText2, margin + 10, yPosition + 42);
      
      yPosition += 70;
      
      // Footer
      doc.setFontSize(10);
      doc.setTextColor(102, 102, 102);
      doc.setFont('helvetica', 'bold');
      doc.text('Generated:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(generatedDate, margin + 70, yPosition);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Downloaded by:', pageWidth - margin - 200, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(userEmail, pageWidth - margin - 120, yPosition);
      
      yPosition += 15;
      
      // Data attribution
      doc.setFontSize(9);
      doc.setTextColor(153, 153, 153);
      doc.setFont('helvetica', 'italic');
      const dataSource = entityType === 'charity' ? 'Charity Commission' : 'Companies House';
      const disclaimer = `This summary is sourced from ${dataSource} public records and should be verified independently.`;
      doc.text(disclaimer, margin, yPosition);
      
      yPosition += 12;
      
      const attribution = entityType === 'charity'
        ? 'Contains information from the Charity Commission which is made available under the Open Government Licence v3.0.'
        : 'Contains information from Companies House which is made available under the Open Government Licence v3.0.';
      
      const splitAttribution = doc.splitTextToSize(attribution, pageWidth - (margin * 2));
      doc.text(splitAttribution, margin, yPosition);
      
      // Generate filename
      const entityNum = entityNumber?.value?.trim() || 'Unknown';
      const filename = `${entityType === 'charity' ? 'Charity' : 'Company'}_Summary_${entityNum}_${Date.now()}.pdf`;
      
      // Download
      doc.save(filename);
      console.log('📄 PDF downloaded:', filename);
    }
    
    // ===== FORM VALIDATION =====
    
    function validateDOB() {
      try {
        const dobString = dobInputs.map(inp => inp?.value || '').join('');
        if (dobString.length !== 8) return false;
        const formatted = `${dobString.substring(0,2)}-${dobString.substring(2,4)}-${dobString.substring(4)}`;
        const [dd, mm, yyyy] = formatted.split('-').map(Number);
        if (!dd || !mm || !yyyy) return false;
        const d = new Date(yyyy, mm - 1, dd);
        return d && d.getMonth() === (mm - 1) && d.getDate() === dd && d.getFullYear() === yyyy;
      } catch (error) {
        console.error('DOB validation error:', error);
        return false;
      }
    }
    
    function validateForm() {
      const errors = [];
      
      try {
        if (!isEntityMode) {
          // Individual mode validation
          
          // DOB is NOT required, but if partially filled or invalid, throw error
          const dobDigits = dobInputs.map(inp => inp?.value || '').join('');
          if (dobDigits.length > 0 && dobDigits.length < 8) {
            errors.push('Please complete all 8 digits of the date of birth, or leave it blank.');
          } else if (dobDigits.length === 8 && !validateDOB()) {
            errors.push('The date of birth you have entered is not valid. Please use the format DD-MM-YYYY.');
          }
          
          // Name change fields only required if toggle is on
          if (recentNameChange?.checked) {
            if (!previousName?.value?.trim()) errors.push('Please enter previous/known as name.');
            if (!reasonForNameChange?.value?.trim()) errors.push('Please enter reason for name change.');
          }
        }
        
        // Phone and email are NOT required - no validation
      
      // Current address is NOT required
      // Manual address fields only required if "Address not listed" is checked
      if (addressNotListed?.checked) {
        const isCurrentUK = currentCountry?.value === 'GBR';
        
        if (!town?.value?.trim()) {
          errors.push('You have indicated current address not listed, please enter the Town/City.');
        }
        if (!postcode?.value?.trim()) {
          errors.push('You have indicated current address not listed, please enter the Postcode.');
        }
        // Per Thirdfort API: Must have ONE OF flat_number, building_number, or building_name
        if (!flatNumber?.value?.trim() && !buildingNumber?.value?.trim() && !buildingName?.value?.trim()) {
          errors.push('You have indicated current address not listed, please enter at least one of: Flat Number, Building Number, or Building Name.');
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
            if (!prevTown?.value?.trim()) {
              errors.push('You have indicated previous address not listed, please enter the Town/City.');
            }
            if (!prevPostcode?.value?.trim()) {
              errors.push('You have indicated previous address not listed, please enter the Postcode.');
            }
            // Must have ONE OF flat_number, building_number, or building_name
            if (!prevFlatNumber?.value?.trim() && !prevBuildingNumber?.value?.trim() && !prevBuildingName?.value?.trim()) {
              errors.push('You have indicated previous address not listed, please enter at least one of: Flat Number, Building Number, or Building Name.');
            }
          }
        }
      } catch (error) {
        console.error('Validation error:', error);
        errors.push('An error occurred during validation.');
      }
      
      return errors;
    }
    
    // ===== DATA COMPILATION =====
    
    function compileFormData() {
      try {
      // Build current address object
      const isCurrentUK = currentCountry.value === 'GBR';
      
      if (!isCurrentUK || addressNotListed?.checked) {
        // Build from manual fields
        if (isCurrentUK) {
          // UK manual: Individual fields only (no address_1/address_2)
          currentAddressObject = {
            building_name: buildingName?.value?.trim() || '',
            building_number: buildingNumber?.value?.trim() || '',
            flat_number: flatNumber?.value?.trim() || '',
            postcode: postcode?.value?.trim() || '',
            street: street?.value?.trim() || '',
            sub_street: subStreet?.value?.trim() || '',
            town: town?.value?.trim() || '',
            country: 'GBR'
          };
        } else {
          // Non-UK: address_1, address_2 (no individual building fields)
          currentAddressObject = {
            address_1: buildingName?.value?.trim() || buildingNumber?.value?.trim() || flatNumber?.value?.trim() || street?.value?.trim() || '',
            address_2: subStreet?.value?.trim() || '',
            postcode: postcode?.value?.trim() || '',
            street: street?.value?.trim() || '',
            sub_street: subStreet?.value?.trim() || '',
            town: town?.value?.trim() || '',
            state: '',
            country: currentCountry?.value || 'GBR'
          };
        }
      } else if (!currentAddressObject && currentAddress?.value?.trim()) {
        // Parse from autocomplete text if no object stored
        currentAddressObject = parseManualAddress(currentAddress.value, currentCountry.value);
      }
      
      // Ensure country is set even if object was from API
      if (currentAddressObject) {
        currentAddressObject.country = currentCountry.value;
      }
      
      // Build previous address object
      if (recentMove?.checked) {
        const isPreviousUK = previousCountry?.value === 'GBR';
        
        if (!isPreviousUK || previousAddressNotListed?.checked) {
          // Build from manual fields
          if (isPreviousUK) {
            // UK manual: Individual fields only (no address_1/address_2)
            previousAddressObject = {
              building_name: prevBuildingName?.value?.trim() || '',
              building_number: prevBuildingNumber?.value?.trim() || '',
              flat_number: prevFlatNumber?.value?.trim() || '',
              postcode: prevPostcode?.value?.trim() || '',
              street: prevStreet?.value?.trim() || '',
              sub_street: prevSubStreet?.value?.trim() || '',
              town: prevTown?.value?.trim() || '',
              country: 'GBR'
            };
          } else {
            // Non-UK: address_1, address_2 (no individual building fields)
            previousAddressObject = {
              address_1: prevBuildingName?.value?.trim() || prevBuildingNumber?.value?.trim() || prevFlatNumber?.value?.trim() || prevStreet?.value?.trim() || '',
              address_2: prevSubStreet?.value?.trim() || '',
              postcode: prevPostcode?.value?.trim() || '',
              street: prevStreet?.value?.trim() || '',
              sub_street: prevSubStreet?.value?.trim() || '',
              town: prevTown?.value?.trim() || '',
              state: '',
              country: previousCountry?.value || 'GBR'
            };
          }
        } else if (!previousAddressObject && previousAddress?.value?.trim()) {
          // Parse from autocomplete text if no object stored
          previousAddressObject = parseManualAddress(previousAddress.value, previousCountry?.value || 'GBR');
        }
      }
      
      // Format phone number in international format (undefined if no number entered)
      let formattedPhone = undefined;
      if (phoneNumber?.value?.trim()) {
        const countryCode = phoneCountryCode?.value || '+44';
        // Strip only leading zeros, but keep the number if it's all zeros or becomes empty
        let phoneNum = phoneNumber.value.trim().replace(/^0+/, '');
        // If stripping zeros left us with nothing, use original (edge case)
        if (!phoneNum) phoneNum = phoneNumber.value.trim();
        formattedPhone = countryCode + phoneNum;
      }
      
      // Compile DOB from individual inputs (only for individual mode)
      let dobFormatted = undefined;
      if (!isEntityMode) {
        const dobDigits = dobInputs.map(inp => inp?.value || '').join('');
        if (dobDigits.length === 8) {
          // Format as dd-mm-yyyy (e.g., '01-01-2000')
          dobFormatted = `${dobDigits.substring(0,2)}-${dobDigits.substring(2,4)}-${dobDigits.substring(4)}`;
        }
      }
      
      // Return data in same format as received (short keys)
      const compiled = {
        _id: formData._id || undefined,
        n: isEntityMode ? {
          b: businessName?.value?.trim() || undefined  // businessName
        } : {
          t: titlePrefix?.value || undefined,          // titlePrefix
          f: firstName?.value || undefined,            // firstName
          m: middleName?.value || undefined,           // middleNames
          l: lastName?.value || undefined              // lastName
        },
        b: dobFormatted || undefined,                        // birthdate (dd-mm-yyyy)
        a: currentAddressObject || undefined,                // address object (undefined if cleared/empty)
        pA: previousAddressObject || undefined,              // previousAddress object (undefined if cleared/empty)
        rM: recentMove?.checked || false,                    // clientRecentHomeMove
        nC: recentNameChange?.checked || false,              // clientRecentNameChange
        pN: previousName?.value || undefined,                // previousName
        rNC: reasonForNameChange?.value || undefined,        // reasonForNameChange
        m: formattedPhone || undefined,                      // mobileNumber
        e: email?.value?.trim() || undefined,                // email
        eN: entityNumber?.value?.trim() || undefined,        // entityNumber
        rC: registrationCountry?.value || undefined,         // registrationCountry
        eT: isEntityMode ? entityType : undefined,           // entityType ('business' or 'charity')
        bD: businessData || undefined                        // businessData (directors, officers, PSCs, registered office)
      };
      
      return compiled;
      } catch (error) {
        console.error('Error compiling form data:', error);
        return null;
      }
    }
    
    // ===== EVENT LISTENERS =====
    
    // Registration country change - clear autocomplete when switching from UK
    registrationCountry.addEventListener('change', () => {
      const isUK = registrationCountry.value === 'GB';
      
      if (!isUK) {
        // Hide dropdowns and clear company data for non-UK
        businessNameDropdown.classList.add('hidden');
        entityNumberDropdown.classList.add('hidden');
        businessData = null;
        updateCompanyButtons();
        console.log('⚠️ Company search only available for UK companies');
      }
    });
    
    // Country change for current address - show autocomplete for UK, manual for others
    currentCountry.addEventListener('change', () => {
      const isUK = currentCountry.value === 'GBR';
      
      if (isUK) {
        // Show autocomplete and "address not listed" checkbox
        currentAddressAutocompleteRow.classList.remove('hidden');
        addressNotListedRow.classList.remove('hidden');
        
        // Hide manual fields unless checkbox is checked
        if (!addressNotListed.checked) {
          manualAddressFields.classList.add('hidden');
        }
      } else {
        // Hide autocomplete and checkbox, show manual fields
        currentAddressAutocompleteRow.classList.add('hidden');
        addressNotListedRow.classList.add('hidden');
        manualAddressFields.classList.remove('hidden');
        
        // Uncheck "address not listed" since we're forcing manual
        addressNotListed.checked = false;
      }
    });
    
    // Country change for previous address
    previousCountry.addEventListener('change', () => {
      const isUK = previousCountry.value === 'GBR';
      
      if (isUK) {
        // Show autocomplete and "address not listed" checkbox
        previousAddressAutocompleteRow.classList.remove('hidden');
        previousAddressNotListedRow.classList.remove('hidden');
        
        // Hide manual fields unless checkbox is checked
        if (!previousAddressNotListed.checked) {
          manualPreviousAddressFields.classList.add('hidden');
        }
      } else {
        // Hide autocomplete and checkbox, show manual fields
        previousAddressAutocompleteRow.classList.add('hidden');
        previousAddressNotListedRow.classList.add('hidden');
        manualPreviousAddressFields.classList.remove('hidden');
        
        // Uncheck "address not listed" since we're forcing manual
        previousAddressNotListed.checked = false;
      }
    });
    
    // Toggle name change fields
    recentNameChange.addEventListener('change', () => {
      if (recentNameChange.checked) {
        nameChangeFields.classList.remove('hidden');
        previousName.setAttribute('required', 'true');
        reasonForNameChange.setAttribute('required', 'true');
      } else {
        nameChangeFields.classList.add('hidden');
        previousName.removeAttribute('required');
        reasonForNameChange.removeAttribute('required');
      }
    });
    
    // Toggle manual address fields for current address
    addressNotListed.addEventListener('change', () => {
      if (addressNotListed.checked) {
        // Show manual fields, hide autocomplete
        manualAddressFields.classList.remove('hidden');
        currentAddress.classList.add('hidden');
        currentAddressLabel.classList.add('hidden');
        currentAddress.removeAttribute('required');
        
        // Set required on manual fields
        town.setAttribute('required', 'true');
        postcode.setAttribute('required', 'true');
      } else {
        // Hide manual fields, show autocomplete
        manualAddressFields.classList.add('hidden');
        currentAddress.classList.remove('hidden');
        currentAddressLabel.classList.remove('hidden');
        currentAddress.setAttribute('required', 'true');
        
        // Remove required from manual fields
        town.removeAttribute('required');
        postcode.removeAttribute('required');
        
        // Clear manual fields
        flatNumber.value = '';
        buildingNumber.value = '';
        buildingName.value = '';
        street.value = '';
        subStreet.value = '';
        town.value = '';
        postcode.value = '';
      }
    });
    
    // Toggle manual address fields for previous address
    previousAddressNotListed.addEventListener('change', () => {
      if (previousAddressNotListed.checked) {
        // Show manual fields, hide autocomplete
        manualPreviousAddressFields.classList.remove('hidden');
        previousAddress.classList.add('hidden');
        previousAddressLabel.classList.add('hidden');
        previousAddress.removeAttribute('required');
        
        // Set required on manual fields
        prevTown.setAttribute('required', 'true');
        prevPostcode.setAttribute('required', 'true');
      } else {
        // Hide manual fields, show autocomplete
        manualPreviousAddressFields.classList.add('hidden');
        previousAddress.classList.remove('hidden');
        previousAddressLabel.classList.remove('hidden');
        if (recentMove.checked) {
          previousAddress.setAttribute('required', 'true');
        }
        
        // Remove required from manual fields
        prevTown.removeAttribute('required');
        prevPostcode.removeAttribute('required');
        
        // Clear manual fields
        prevFlatNumber.value = '';
        prevBuildingNumber.value = '';
        prevBuildingName.value = '';
        prevStreet.value = '';
        prevSubStreet.value = '';
        prevTown.value = '';
        prevPostcode.value = '';
      }
    });
    
    // Toggle previous address fields
    recentMove.addEventListener('change', () => {
      if (recentMove.checked) {
        previousAddressFields.classList.remove('hidden');
        if (!previousAddressNotListed.checked) {
          previousAddress.setAttribute('required', 'true');
        } else {
          prevTown.setAttribute('required', 'true');
          prevPostcode.setAttribute('required', 'true');
        }
      } else {
        previousAddressFields.classList.add('hidden');
        previousAddress.removeAttribute('required');
        prevTown.removeAttribute('required');
        prevPostcode.removeAttribute('required');
      }
    });
    
    // DOB auto-tab
    dobInputs.forEach((input, idx) => {
      input.addEventListener('focus', () => {
        input.value = '';
      });
      
      input.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value.length > 1) {
          input.value = value.slice(-1);
        }
        if (input.value.length === 1 && idx < dobInputs.length - 1) {
          dobInputs[idx + 1].focus();
        }
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && idx > 0) {
          e.preventDefault();
          dobInputs[idx - 1].focus();
          dobInputs[idx - 1].value = '';
        }
      });
    });
    
    // ===== MESSAGE LISTENER =====
    
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'load-data') {
        console.log('📥 Received load-data:', event.data);
        
        // Capture user email for file uploads
        if (event.data.uploader) {
          userEmail = event.data.uploader;
          console.log('📧 User email set:', userEmail);
        }
        
        // Determine mode from b/c flags
        const isBusiness = event.data.data?.b === true;
        const isCharity = event.data.data?.c === true;
        
        if (isBusiness) {
          switchToEntityMode('business');
        } else if (isCharity) {
          switchToEntityMode('charity');
        } else {
          switchToIndividualMode();
        }
        
        // Load the data
        loadData(event.data.data || {});
      } else if (event.data && event.data.type === 'entity-true') {
        const type = event.data.entityType || 'business'; // 'business' or 'charity'
        switchToEntityMode(type);
      } else if (event.data && event.data.type === 'entity-false') {
        switchToIndividualMode();
      } else if (event.data && event.data.type === 'allowEdits-true') {
        setEditMode(true);
      } else if (event.data && event.data.type === 'allowEdits-false') {
        setEditMode(false);
      } else if (event.data && event.data.type === 'client-data') {
        console.log('📥 Received client-data:', event.data);
        
        // Capture user email for file uploads
        if (event.data.uploader) {
          userEmail = event.data.uploader;
          console.log('📧 User email set:', userEmail);
        }
        
        // Handle entity flag from message
        if (event.data.entity === true) {
          const type = event.data.entityType || 'business'; // 'business' or 'charity'
          switchToEntityMode(type);
        } else {
          switchToIndividualMode();
        }
        
        // Handle allowEdits flag from message
        if (event.data.allowEdits === false) {
          setEditMode(false);
        } else {
          setEditMode(true);
        }
        
        // Load client data (ensure it's an object)
        const clientData = event.data.clientData;
        if (clientData && typeof clientData === 'object') {
          loadData(clientData);
        } else {
          console.warn('No valid clientData provided, loading empty form');
          loadData({});
        }
      } else if (event.data && event.data.type === 'request-data') {
        // Parent is requesting the form data (triggered by Wix save button)
        hideError();
        
        const errors = validateForm();
        if (errors.length) {
          // Send validation error to parent (don't show error popup in iframe)
          console.log('❌ Validation errors:', errors);
          window.parent.postMessage({
            type: 'validation-error',
            errors: errors
          }, '*');
          return;
        }
        
        const data = compileFormData();
        
        // Check if data compilation failed
        if (!data) {
          console.error('❌ Data compilation failed');
          window.parent.postMessage({
            type: 'validation-error',
            errors: ['Data compilation error']
          }, '*');
          return;
        }
        
        // Send to parent (DOB will be in 'dd-mm-yyyy' format)
        console.log('📤 Sending new-data to parent:', data);
        window.parent.postMessage({
          type: 'new-data',
          data: data
        }, '*');
        
        // Reset unsaved changes flag after successful save
        hasUnsavedChanges = false;
      } else if (event.data && event.data.type === 'address-results') {
        // Cache the autocomplete results
        if (event.data.searchTerm && event.data.suggestions) {
          const cacheKey = 'auto_' + event.data.searchTerm.toLowerCase();
          setCachedItem(cacheKey, event.data.suggestions, 'autocomplete');
          console.log('💾 Cached autocomplete results for:', event.data.searchTerm);
        }
        
        displayAddressSuggestions(event.data.suggestions, event.data.field);
      } else if (event.data && event.data.type === 'address-data') {
        // Cache the full address object
        if (event.data.addressId && event.data.address) {
          const cacheKey = 'addr_' + event.data.addressId;
          setCachedItem(cacheKey, event.data.address, 'address');
          console.log('💾 Cached full address for ID:', event.data.addressId);
        }
        
        handleAddressData(event.data.address, event.data.field);
      } else if (event.data && (event.data.type === 'company-results' || event.data.type === 'charity-results')) {
        // Display company/charity search results
        displayCompanySuggestions(event.data.companies, event.data.searchBy);
      } else if (event.data && (event.data.type === 'company-data' || event.data.type === 'charity-data')) {
        // Store full company/charity data (directors/trustees, officers, PSCs, etc.)
        handleCompanyData(event.data.companyData || event.data.charityData);
      } else if (event.data && event.data.type === 'sanctions-check') {
        // Open sanctions check popup when Wix button sends message
        openSanctionsCheck();
      } else if (event.data && event.data.type === 'put-links') {
        // Received S3 PUT links from parent for file upload
        console.log('📥 Received PUT links:', event.data);
        
        const links = event.data.links || [];
        const s3Keys = event.data.s3Keys || [];
        
        if (links.length > 0 && s3Keys.length > 0 && pendingFiles.length > 0) {
          // Store PUT links and s3Keys
          pendingPutLinks = links;
          pendingS3Keys = s3Keys.map(keyObj => keyObj.s3Key);
          currentUploadIndex = 0;
          
          // Start uploading first file
          uploadFileToS3(
            pendingFiles[0],
            pendingPutLinks[0],
            pendingS3Keys[0],
            0,
            pendingFiles.length
          );
        } else {
          console.error('❌ Invalid PUT links response');
          hideUploadingPopup();
          showError('Failed to prepare file upload. Please try again.');
          enableForm();
          
          // Clear upload state
          pendingFiles = [];
          pendingS3Keys = [];
          pendingPutLinks = [];
          currentUploadIndex = 0;
        }
      } else if (event.data && event.data.type === 'put-error') {
        // Parent failed to generate PUT links
        console.error('❌ PUT link generation failed:', event.data.message);
        hideUploadingPopup();
        showError('Failed to prepare file upload. Please try again.');
        enableForm();
        
        // Clear upload state
        pendingFiles = [];
        pendingS3Keys = [];
        pendingPutLinks = [];
        currentUploadIndex = 0;
      } else if (event.data && event.data.type === 'request-error') {
        // Parent encountered an error saving the request
        console.error('❌ Request submission failed:', event.data.message);
        showError('Failed to submit request. Please try again.');
        enableForm();
        
        // Clear upload state
        pendingFiles = [];
        pendingS3Keys = [];
        pendingPutLinks = [];
        currentUploadIndex = 0;
      }
    });
    
    // ===== LOAD DATA =====
    
    function loadData(data) {
      // Set loading flag to prevent change detection during data load
      isLoadingData = true;
      hasUnsavedChanges = false;
      
      formData = data || {};
      currentClientData = data || {}; // Store for validation
      
      // Extract header info from abbreviated structure (cD = clientData)
      const clientData = formData.cD || {};
      currentTitleText = clientData.fe || '';
      currentTitle = clientData.fe || '';
      currentClientNumber = clientData.cN ? String(clientData.cN) : '';
      currentMatterNumber = clientData.mN ? String(clientData.mN) : '';
      currentClientName = clientData.n || '';
      
      // Populate status icons from formData.i (icons object)
      const icons = formData.i || {}; // i = icons
      iconAddressId = icons.a || false; // a = addressIdTaken
      iconPhotoId = icons.p || false; // p = photographicIdTaken
      iconLikeness = icons.l || false; // l = likenessNOTConfirmed
      
      // Set business/charity checkboxes based on data.b and data.c
      const isBusiness = formData.b === true;
      const isCharity = formData.c === true;
      
      businessCheckbox.checked = isBusiness;
      charityCheckbox.checked = isCharity;
      
      // Switch to appropriate mode based on checkboxes
      if (isBusiness) {
        switchToEntityMode('business');
      } else if (isCharity) {
        switchToEntityMode('charity');
      } else {
        switchToIndividualMode();
      }
      
      // Update header display
      updateHeader();
      
      // Clear address objects and company data on new data load
      currentAddressObject = null;
      previousAddressObject = null;
      businessData = null;
      
      // Note: Entity mode is now set by business/charity checkboxes
      
      // Clear timers
      if (addressDebounceTimer) clearTimeout(addressDebounceTimer);
      if (previousAddressDebounceTimer) clearTimeout(previousAddressDebounceTimer);
      if (companyNameDebounceTimer) clearTimeout(companyNameDebounceTimer);
      if (companyNumberDebounceTimer) clearTimeout(companyNumberDebounceTimer);
      addressDebounceTimer = null;
      previousAddressDebounceTimer = null;
      companyNameDebounceTimer = null;
      companyNumberDebounceTimer = null;
      
      // Reset ALL form fields and UI state before loading new data
      // This ensures a clean slate regardless of previous state
      
      // Reset toggles and checkboxes
      addressNotListed.checked = false;
      previousAddressNotListed.checked = false;
      recentNameChange.checked = false;
      recentMove.checked = false;
      
      // Reset visibility - hide all conditional sections initially
      manualAddressFields.classList.add('hidden');
      manualPreviousAddressFields.classList.add('hidden');
      nameChangeFields.classList.add('hidden');
      previousAddressFields.classList.add('hidden');
      
      // Show autocomplete inputs by default (will be hidden later if needed)
      currentAddress.classList.remove('hidden');
      currentAddressLabel.classList.remove('hidden');
      previousAddress.classList.remove('hidden');
      previousAddressLabel.classList.remove('hidden');
      
      // Clear ALL input fields
      titlePrefix.value = '';
      firstName.value = '';
      middleName.value = '';
      lastName.value = '';
      businessName.value = '';
      entityNumber.value = '';
      email.value = '';
      previousName.value = '';
      reasonForNameChange.value = '';
      currentAddress.value = '';
      previousAddress.value = '';
      dobInputs.forEach(inp => inp.value = '');
      
      // Clear current address manual fields
      flatNumber.value = '';
      buildingNumber.value = '';
      buildingName.value = '';
      street.value = '';
      subStreet.value = '';
      town.value = '';
      postcode.value = '';
      
      // Clear previous address manual fields
      prevFlatNumber.value = '';
      prevBuildingNumber.value = '';
      prevBuildingName.value = '';
      prevStreet.value = '';
      prevSubStreet.value = '';
      prevTown.value = '';
      prevPostcode.value = '';
      
      // Reset country dropdowns to UK
      currentCountry.value = 'GBR';
      previousCountry.value = 'GBR';
      
      // Extract client information from abbreviated structure
      const clientInfo = formData.cI || {};
      const nameInfo = clientInfo.n || {};
      
      // Populate entity or individual fields
      if (isEntityMode) {
        // Business/Charity mode
        entityType = formData.c ? 'charity' : 'business'; // Determine from flags
        registrationCountry.value = 'GB'; // Default to GB
        businessName.value = nameInfo.b || '';
        entityNumber.value = clientInfo.eN || '';
        businessData = clientInfo.bD || null;
        
        // Update labels based on entity type
        updateEntityLabels();
        
        if (businessData) {
          console.log(`✅ Loaded ${entityType} data:`, businessData);
        }
        
        // Update button visibility
        updateCompanyButtons();
      } else {
        // Individual mode
        titlePrefix.value = nameInfo.t || '';
        firstName.value = nameInfo.f || '';
        middleName.value = nameInfo.m || '';
        lastName.value = nameInfo.l || '';
        
        // Name change - show/hide fields based on data
        if (clientInfo.nC === true) {
          recentNameChange.checked = true;
          nameChangeFields.classList.remove('hidden');
          previousName.value = clientInfo.pN || '';
          reasonForNameChange.value = clientInfo.rNC || '';
        } else {
          recentNameChange.checked = false;
          nameChangeFields.classList.add('hidden');
          previousName.value = '';
          reasonForNameChange.value = '';
        }
        
        // DOB - comes in as 'dd-mm-yyyy', display as individual digits
        if (clientInfo.b && typeof clientInfo.b === 'string') {
          const digits = clientInfo.b.replace(/[^0-9]/g, '').slice(0, 8).split('');
          dobInputs.forEach((inp, i) => {
            inp.value = digits[i] || '';
          });
        } else {
          dobInputs.forEach(inp => inp.value = '');
        }
      }
      
      // Parse phone number (handle both international and UK formats)
      if (clientInfo.m && typeof clientInfo.m === 'string') {
        const cleanPhone = clientInfo.m.trim();
        
        // Check if it already has international format (starts with +)
        if (cleanPhone.startsWith('+')) {
          // Try to match against known country codes (longest first to avoid +1 matching +1X)
          const knownCodes = ['+993', '+992', '+971', '+967', '+966', '+960', '+886', '+880', '+856', '+853', '+852', '+973', '+998', '+996', '+995', '+977', '+968', '+964', '+963', '+962', '+961', '+974', '+594', '+593', '+598', '+595', '+591', '+590', '+507', '+506', '+505', '+504', '+503', '+502', '+501', '+389', '+387', '+386', '+385', '+381', '+380', '+376', '+375', '+374', '+373', '+372', '+371', '+370', '+359', '+358', '+357', '+356', '+355', '+354', '+353', '+352', '+351', '+421', '+420', '+264', '+263', '+262', '+261', '+260', '+258', '+257', '+256', '+255', '+254', '+253', '+252', '+251', '+250', '+249', '+248', '+244', '+243', '+242', '+241', '+240', '+239', '+238', '+237', '+236', '+235', '+234', '+233', '+232', '+231', '+230', '+229', '+228', '+227', '+226', '+225', '+224', '+223', '+222', '+221', '+220', '+218', '+216', '+213', '+212', '+98', '+95', '+94', '+93', '+92', '+91', '+90', '+86', '+84', '+82', '+81', '+66', '+65', '+64', '+63', '+62', '+61', '+60', '+58', '+57', '+56', '+55', '+54', '+52', '+51', '+49', '+48', '+47', '+46', '+45', '+44', '+43', '+41', '+40', '+39', '+36', '+34', '+33', '+32', '+31', '+30', '+27', '+20', '+7', '+1'];
          
          let matched = false;
          for (const code of knownCodes) {
            if (cleanPhone.startsWith(code)) {
              phoneCountryCode.value = code;
              phoneNumber.value = cleanPhone.substring(code.length);
              console.log(`📞 Loaded international phone: ${code} + ${cleanPhone.substring(code.length)}`);
              matched = true;
              break;
            }
          }
          
          // If no known code matched, try generic pattern (shouldn't happen)
          if (!matched) {
            const genericMatch = cleanPhone.match(/^(\+\d{1,4})(.+)$/);
            if (genericMatch) {
              phoneCountryCode.value = genericMatch[1];
              phoneNumber.value = genericMatch[2];
              console.log(`📞 Loaded phone with unrecognized code: ${genericMatch[1]} + ${genericMatch[2]}`);
            }
          }
        } 
        // Check if it's UK mobile starting with 07, 08, or 09
        else if (cleanPhone.match(/^0[7-9]\d{9}$/)) {
          phoneCountryCode.value = '+44';
          phoneNumber.value = cleanPhone.substring(1); // Remove leading 0: 07700000000 → 7700000000
          console.log(`📞 Converted UK mobile ${cleanPhone} → +44${cleanPhone.substring(1)}`);
        }
        // Other UK format (starts with 0) - landlines or other
        else if (cleanPhone.startsWith('0')) {
          phoneCountryCode.value = '+44';
          phoneNumber.value = cleanPhone.substring(1); // Remove leading 0
          console.log(`📞 Converted UK number ${cleanPhone} → +44${cleanPhone.substring(1)}`);
        }
        // No recognized format, store as-is with default country code
        else {
          phoneCountryCode.value = '+44';
          phoneNumber.value = cleanPhone;
          console.log('📞 Loaded phone (no prefix):', cleanPhone, '→ assuming +44');
        }
      } else {
        phoneCountryCode.value = '+44';
        phoneNumber.value = '';
      }
      
      email.value = clientInfo.e || '';
      
      // Load worktype, relation, and matter description from formData
      worktype.value = formData.wT || '';
      relation.value = formData.r || '';
      matterDescription.value = formData.mD || '';
      
      // Load current address (clientInfo.a is the address object)
      // Show/hide fields based on country in data
      if (clientInfo.a && typeof clientInfo.a === 'object') {
        currentAddressObject = clientInfo.a;
        currentCountry.value = clientInfo.a?.country || 'GBR';
        
        const isCurrentUK = currentCountry.value === 'GBR';
        
        if (!isCurrentUK) {
          // Non-UK address - show manual fields, hide autocomplete and checkbox
          currentAddressAutocompleteRow.classList.add('hidden');
          addressNotListedRow.classList.add('hidden');
          manualAddressFields.classList.remove('hidden');
          addressNotListed.checked = false;
          
          // Populate manual fields
          flatNumber.value = clientInfo.a?.flat_number || '';
          buildingNumber.value = clientInfo.a?.building_number || '';
          buildingName.value = clientInfo.a?.building_name || '';
          street.value = clientInfo.a?.street || '';
          subStreet.value = clientInfo.a?.sub_street || '';
          town.value = clientInfo.a?.town || '';
          postcode.value = clientInfo.a?.postcode || '';
          
          // Clear autocomplete
          currentAddress.value = '';
        } else {
          // UK address - show autocomplete and checkbox, hide manual fields
          currentAddressAutocompleteRow.classList.remove('hidden');
          addressNotListedRow.classList.remove('hidden');
          manualAddressFields.classList.add('hidden');
          addressNotListed.checked = false;
          currentAddress.value = formatThirdfortForDisplay(clientInfo.a);
        }
      } else {
        // No address data - show UK autocomplete by default
        currentCountry.value = 'GBR';
        currentAddressAutocompleteRow.classList.remove('hidden');
        addressNotListedRow.classList.remove('hidden');
        manualAddressFields.classList.add('hidden');
        addressNotListed.checked = false;
        currentAddress.value = '';
      }
      
      // Load previous address (clientInfo.pA is the previous address object)
      // Show/hide fields based on data
      if (clientInfo.rM === true) {
        recentMove.checked = true;
        previousAddressFields.classList.remove('hidden');
        
        if (clientInfo.pA && typeof clientInfo.pA === 'object') {
          previousAddressObject = clientInfo.pA;
          previousCountry.value = clientInfo.pA?.country || 'GBR';
          
          const isPreviousUK = previousCountry.value === 'GBR';
          
          if (!isPreviousUK) {
            // Non-UK address - show manual fields, hide autocomplete
            previousAddressAutocompleteRow.classList.add('hidden');
            previousAddressNotListedRow.classList.add('hidden');
            manualPreviousAddressFields.classList.remove('hidden');
            
            // Populate manual fields
            prevFlatNumber.value = clientInfo.pA?.flat_number || '';
            prevBuildingNumber.value = clientInfo.pA?.building_number || '';
            prevBuildingName.value = clientInfo.pA?.building_name || '';
            prevStreet.value = clientInfo.pA?.street || '';
            prevSubStreet.value = clientInfo.pA?.sub_street || '';
            prevTown.value = clientInfo.pA?.town || '';
            prevPostcode.value = clientInfo.pA?.postcode || '';
          } else {
            // UK address - show autocomplete
            previousAddressAutocompleteRow.classList.remove('hidden');
            previousAddressNotListedRow.classList.remove('hidden');
            manualPreviousAddressFields.classList.add('hidden');
            previousAddress.value = formatThirdfortForDisplay(clientInfo.pA);
          }
        } else {
          // Recent move checked but no address data - show UK autocomplete by default
          previousCountry.value = 'GBR';
          previousAddressAutocompleteRow.classList.remove('hidden');
          previousAddressNotListedRow.classList.remove('hidden');
          manualPreviousAddressFields.classList.add('hidden');
          previousAddressNotListed.checked = false;
          previousAddress.value = '';
          
          // Clear manual fields
          prevFlatNumber.value = '';
          prevBuildingNumber.value = '';
          prevBuildingName.value = '';
          prevStreet.value = '';
          prevSubStreet.value = '';
          prevTown.value = '';
          prevPostcode.value = '';
        }
      } else {
        // No recent move - hide all previous address fields and clear data
        recentMove.checked = false;
        previousAddressFields.classList.add('hidden');
        previousAddressObject = null;
        
        // Clear and reset all previous address fields
        previousCountry.value = 'GBR';
        previousAddress.value = '';
        previousAddressNotListed.checked = false;
        manualPreviousAddressFields.classList.add('hidden');
        
        // Clear manual fields
        prevFlatNumber.value = '';
        prevBuildingNumber.value = '';
        prevBuildingName.value = '';
        prevStreet.value = '';
        prevSubStreet.value = '';
        prevTown.value = '';
        prevPostcode.value = '';
      }
      
      // Loading complete - enable change detection
      // Use setTimeout to ensure all DOM updates are complete before enabling change detection
      setTimeout(() => {
        isLoadingData = false;
        console.log('✅ Data loaded successfully, change detection enabled');
        
        // Update progress after data is loaded
        updateProgress();
        updateRequirementsDisplay();
        
        // Apply edit mode state (in case it was set before data load)
        setEditMode(allowEdits);
      }, 100);
    }
    
    // ===== CHANGE DETECTION LISTENERS =====
    
    // Add change listeners to all form inputs
    const allInputs = [
      registrationCountry, businessName, entityNumber,
      titlePrefix, firstName, middleName, lastName,
      phoneCountryCode, phoneNumber, email,
      previousName, reasonForNameChange,
      currentCountry, currentAddress,
      flatNumber, buildingNumber, buildingName, street, subStreet, town, postcode,
      previousCountry, previousAddress,
      prevFlatNumber, prevBuildingNumber, prevBuildingName, prevStreet, prevSubStreet, prevTown, prevPostcode
    ];
    
    const allCheckboxes = [recentNameChange, recentMove, addressNotListed, previousAddressNotListed];
    
    // Listen for input changes
    allInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', notifyUnsavedChanges);
        input.addEventListener('change', notifyUnsavedChanges);
      }
    });
    
    // Listen for checkbox/toggle changes
    allCheckboxes.forEach(checkbox => {
      if (checkbox) {
        checkbox.addEventListener('change', notifyUnsavedChanges);
      }
    });
    
    // Listen for DOB input changes
    dobInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', notifyUnsavedChanges);
      }
    });
    
    // Company link button - open Companies House page
    companyLinkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openCompaniesHousePage();
    });
    
    // Company refresh button - fetch latest data
    companyRefreshBtn.addEventListener('click', (e) => {
      e.preventDefault();
      refreshCompanyData();
    });
    
    // Download summary button - generate PDF
    downloadSummaryBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadCompanySummary();
    });
    
    // ===== MOCK DATA FUNCTIONS =====
    
    // Mock Individual Data
    function loadMockIndividual() {
      const mockData = {
        type: 'load-data',
        uploader: 'staff@example.com', // Add uploader email for file objects
        data: {
          _id: 'mock-individual-123',
          idI: [ // Mock ID images for Form J validation
            {
              side: 'Front',
              name: '50-52 - Mr J R Archer-Moran - Driving Licence Front',
              document: 'Driving Licence',
              type: 'PhotoID',
              s3Key: 'mock/photo-front'
            },
            {
              side: 'Back',
              name: '50-52 - Mr J R Archer-Moran - Driving Licence Back',
              document: 'Driving Licence',
              type: 'PhotoID',
              s3Key: 'mock/photo-back'
            },
            {
              side: 'Single',
              name: 'BA-50-52 - Mr J R Archer-Moran - Address ID 1',
              document: 'Bank Statement',
              type: 'Address ID',
              s3Key: 'mock/address-1'
            },
            {
              side: 'Single',
              name: 'BA-50-52 - Mr J R Archer-Moran - Address ID 2',
              document: 'Utility Bill',
              type: 'Address ID',
              s3Key: 'mock/address-2',
              liveUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop'
            }
          ],
          idD: [ // Mock documents for Form J validation
            {
              document: 'Client Details form',
              data: {
                type: 'application/pdf',
                size: 117237,
                name: 'BA-50-52 - Master J R Archer-Moran - Client Details form',
                lastModified: 1643802796878
              },
              date: '08/10/2025, 12:05:22',
              uploader: 'jacob.archer-moran@thurstanhoskin.co.uk',
              type: 'Details form',
              s3Key: 'mock/cdf',
              liveUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            },
            {
              document: 'OFSI Sanctions Search',
              data: {
                type: 'application/pdf',
                size: 32545,
                name: 'BA-50-52 - Master J R Archer-Moran - OFSI Sanctions Search',
                lastModified: 1758799014256
              },
              date: '14/10/2025, 19:53:28',
              uploader: 'jacob.archer-moran@thurstanhoskin.co.uk',
              type: 'PEP & Sanctions Check',
              s3Key: 'mock/ofsi',
              liveUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            }
          ],
          cD: { // clientData
            cN: 50, // clientNumber
            mN: 52, // matterNumber
            fe: 'BA', // title (F/E)
            n: 'Mr J R Archer-Moran', // name
          },
          mD: 'Property Sale', // idCheckReference (matter description)
          r: 'Our Client', // relation
          wT: 'Sale of', // matterDescription (work type)
          c: false, // charity
          b: false, // business
          vT: null, // validTo
          i: { // Icons
            a: true, // addressIdTaken - SHOW ADDRESS ICON
            p: true, // photographicIdTaken - SHOW PHOTO ID ICON
            l: false, // likenessNOTConfirmed - SHOW LIKENESS CONFIRMED ICON (because it's false)
          },
          cI: { // client information
            n: { // name
              t: 'Mr', // titlePrefix
              f: 'Jacob', // firstName
              m: 'Robert', // middleNames
              l: 'Archer-Moran', // surname
              b: undefined // businessName
            },
            b: '11-01-2001', // dateOfBirth
            a: { // address
              building_name: '',
              building_number: '123',
              flat_number: '',
              postcode: 'SW1A 1AA',
              street: 'Main Street',
              sub_street: '',
              town: 'London',
              country: 'GBR'
            },
            pA: null, // previousAddress
            rM: false, // recentMove
            nC: false, // recentNameChange
            pN: '', // previousName
            rNC: '', // reasonForNameChange
            m: '+447700900123', // mobile
            e: 'jacob@example.com', // email
            eN: undefined, // entityNumber
            bD: undefined, // business data
          }
        }
      };
      
      // Simulate message from parent
      window.dispatchEvent(new MessageEvent('message', { data: mockData }));
    }
    
    // Mock Business Data
    function loadMockBusiness() {
      const mockData = {
        type: 'load-data',
        uploader: 'staff@example.com', // Add uploader email for file objects
        data: {
          _id: 'mock-business-456',
          idI: [],
          idD: [],
          cD: {
            cN: 100,
            mN: 25,
            fe: 'RP',
            n: 'Acme Corp Ltd',
          },
          mD: 'Commercial Purchase',
          r: 'Buyer',
          wT: 'Purchase of',
          c: false,
          b: true, // Business mode
          vT: null,
          i: {
            a: false,
            p: false,
            l: false,
          },
          cI: {
            n: {
              t: undefined,
              f: undefined,
              m: undefined,
              l: undefined,
              b: 'Acme Corporation Ltd'
            },
            b: undefined,
            a: {
              building_name: 'Tech Tower',
              building_number: '456',
              flat_number: '',
              postcode: 'EC1A 1BB',
              street: 'Silicon Road',
              sub_street: '',
              town: 'London',
              country: 'GBR'
            },
            pA: null,
            rM: false,
            nC: false,
            pN: '',
            rNC: '',
            m: '+442079460000',
            e: 'info@acmecorp.com',
            eN: '12345678', // Company number
            bD: null, // Company data (directors, etc.)
          }
        }
      };
      
      window.dispatchEvent(new MessageEvent('message', { data: mockData }));
    }
    
    // Mock Charity Data
    function loadMockCharity() {
      const mockData = {
        type: 'load-data',
        uploader: 'staff@example.com', // Add uploader email for file objects
        data: {
          _id: 'mock-charity-789',
          idI: [],
          idD: [],
          cD: {
            cN: 200,
            mN: 15,
            fe: 'JH',
            n: 'The Wildlife Trust',
          },
          mD: 'Land Transfer',
          r: 'Beneficiary',
          wT: 'Transfer of',
          c: true, // Charity mode
          b: false,
          vT: null,
          i: {
            a: false,
            p: false,
            l: false,
          },
          cI: {
            n: {
              t: undefined,
              f: undefined,
              m: undefined,
              l: undefined,
              b: 'The Wildlife Trust'
            },
            b: undefined,
            a: {
              building_name: 'Conservation House',
              building_number: '',
              flat_number: '',
              postcode: 'OX1 3SZ',
              street: 'Park Lane',
              sub_street: '',
              town: 'Oxford',
              country: 'GBR'
            },
            pA: null,
            rM: false,
            nC: false,
            pN: '',
            rNC: '',
            m: '+441865123456',
            e: 'contact@wildlifetrust.org',
            eN: '87654321', // Charity number
            bD: null, // Charity data (trustees, etc.)
          }
        }
      };
      
      window.dispatchEvent(new MessageEvent('message', { data: mockData }));
    }
    
    // Mock button event listeners
    mockIndividualBtn.addEventListener('click', loadMockIndividual);
    mockBusinessBtn.addEventListener('click', loadMockBusiness);
    mockCharityBtn.addEventListener('click', loadMockCharity);
    
    // ===== PROGRESS TRACKING - REAL-TIME UPDATES =====
    
    // Update progress on any form input change
    const formInputs = document.querySelectorAll('input, textarea, select');
    formInputs.forEach(input => {
      input.addEventListener('input', updateProgress);
      input.addEventListener('change', updateProgress);
    });
    
    // Update progress when checkboxes change
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', updateProgress);
    });
    
    // Update progress when request type changes
    requestTags.forEach(tag => {
      const originalClickHandler = tag.onclick;
      tag.addEventListener('click', () => {
        setTimeout(() => {
          updateProgress();
          updateRequirementsDisplay();
        }, 100); // Small delay to let selection complete
      });
    });
    
    // Update progress when rule changes
    ruleSelect.addEventListener('change', () => {
      updateProgress();
      updateRequirementsDisplay();
    });
    
    // Update progress when CDF/OFSI files are uploaded
    const originalHandleCDFFileSelect = window.handleCDFFileSelect;
    window.handleCDFFileSelect = function(event) {
      if (originalHandleCDFFileSelect) originalHandleCDFFileSelect(event);
      setTimeout(updateProgress, 100);
    };
    
    const originalHandleOFSIFileSelect = window.handleOFSIFileSelect;
    window.handleOFSIFileSelect = function(event) {
      if (originalHandleOFSIFileSelect) originalHandleOFSIFileSelect(event);
      setTimeout(updateProgress, 100);
    };
    
    // Initial progress update and disable submit button
    submitButton.disabled = true; // Start disabled
    updateProgress();
    updateRequirementsDisplay();
    
    // ===== INITIALIZE =====
    setupAddressAutocomplete(currentAddress, currentAddressDropdown, 'current', true);
    setupAddressAutocomplete(previousAddress, previousAddressDropdown, 'previous', false);
    setupCompanyNameAutocomplete();
    setupCompanyNumberAutocomplete();
