/*
=====================================================================
FORM K REQUEST TYPE MODULE
=====================================================================
Form K request requires:
- Standard 3 fields (work type, relation, matter description)
- Rule selection from dropdown
- Shows k3Hint (warning about financial transactions)
- Message input (pre-populated based on rule)

Validation:
- Standard 3 fields must be filled
- Rule must be selected
- No photo/ID requirements (unlike Form J)

Sends request-data message to parent with:
- requestType: 'formK'
- data: updated client-data object
- message: message object
=====================================================================
*/

(function() {
  'use strict';
  
  const FormK = {
    formattedDOB: null,
    
    // Form K Rules - some apply to all, some only to entities
    rules: [
      {
        id: 'rule1',
        label: 'Rule 1 - Pass/ePass already held',
        value: 'We already hold a [Pass/ePass] result valid to ....-...... on matter ........../... for this client which is sufficient to process a form K [RULE 1] AND this matter is not a sale. I attach both the CDF and a recent OFSI for the client.',
        appliesTo: 'all' // individuals and entities
      },
      {
        id: 'rule2',
        label: 'Rule 2 - ID already Held',
        value: 'We already hold an [ID Held] result valid to ....-...... on matter ........../... for this client which is sufficient to contuct an electronic check under form K [RULE 2] AND this is not a sale. I attach both the CDF and a recent OFSI for the client.',
        appliesTo: 'all'
      },
      {
        id: 'rule3',
        label: 'Rule 3 - This matter is out of scope',
        value: 'This matter is out of scope and we hold TWO valid forms of address ID and ONE valid form of Photo ID for the client sufficient to process a form K [RULE 3]. I attach both the CDF and a recent OFSI for the client.',
        appliesTo: 'all'
      },
      {
        id: 'rule4',
        label: 'Rule 4 - Company',
        value: 'The client is a company and we enclose a print out from companies house of the register entry sufficient to process a form K [RULE 4]. I attach a recent OFSI for the client.',
        appliesTo: 'entity' // business/charity only
      },
      {
        id: 'rule5',
        label: 'Rule 5 - Partnership',
        value: 'The client is a partnership and we enclose a print out from companies house of the register entry or proof of address for the partnership sufficient to process a form K [RULE 5]. I attach a recent OFSI for the client.',
        appliesTo: 'entity'
      },
      {
        id: 'rule6',
        label: 'Rule 6 - Charity',
        value: 'The client is a charity and we enclose a print out from the charity register of the entry including a list of all registered officers sufficient to process a form K [RULE 6]. I attach a recent OFSI for the client.',
        appliesTo: 'entity'
      },
      {
        id: 'rule7',
        label: 'Rule 7 - PLC',
        value: 'The client is a PLC and we enclose a print out from the stock exchange of the registration sufficient to process a form K [RULE 7]. I attach a recent OFSI check for the client.',
        appliesTo: 'entity'
      },
      {
        id: 'rule8',
        label: 'Rule 8 - Government/Council',
        value: 'The client is a governemnt/council department and we enclose proof of its status sufficient to process a form K [RULE 8]. I attach a recent OFSI check for the client.',
        appliesTo: 'entity'
      },
      {
        id: 'rule9',
        label: 'Rule 9 - Regulated Institution',
        value: 'The client is a regulated professional and we enclose proof of the registration with the regulatory body sufficient to process a form K [RULE 9]. I attach a recent OFSI check for the client.',
        appliesTo: 'entity'
      },
      {
        id: 'rule10',
        label: 'Rule 10 - Regulated referral',
        value: 'The client has been identified by a regulated professional and proof of reliance on thier checks is included along with a recent OFSI check sufficient to process a form K [RULE 10]',
        appliesTo: 'all'
      },
      {
        id: 'rule11',
        label: 'Rule 11 - Thirdfort Secure Share',
        value: 'The client has conducted a Thirdfort Check in the last 6 months which has been securely shared to ...........@thurstanhoskin.co.uk succificent to process a form K [RULE 11].',
        appliesTo: 'all'
      }
    ],
    
    init: function(requestData) {
      console.log('📝 Initializing Form K request');
      
      // Show ID Documents section
      this.showIDDocumentsSection();
      
      // Populate and show Form K rule selector dropdown
      this.populateRuleSelector();
      this.showRuleSelector();
      
      // Update ID Documents UI based on current data
      if (window.RequestFormCore && window.RequestFormCore.updateIDDocumentsUI) {
        window.RequestFormCore.updateIDDocumentsUI(window.RequestFormCore.requestData());
      }
      
      // Setup rule selector listener
      this.setupRuleListener();
      
      // Setup checkbox listeners for dynamic rule filtering
      this.setupCheckboxListeners();
      
      // Setup worktype listener for sale validation
      this.setupWorktypeListener();
      
      // Enable submit button (will be validated on submit)
      this.enableSubmitButton();
      
      console.log('✅ Form K request initialized');
    },
    
    showIDDocumentsSection: function() {
      const idDocumentsSection = document.getElementById('idDocumentsSection');
      
      if (idDocumentsSection) {
        idDocumentsSection.classList.remove('hidden');
        console.log('👁️ ID Documents section shown for Form K');
      }
    },
    
    populateRuleSelector: function() {
      const formKruleSelector = document.getElementById('formKruleSelector');
      if (!formKruleSelector) return;
      
      // Determine if client is an entity (business or charity)
      const businessCheckbox = document.getElementById('businessCheckbox');
      const charityCheckbox = document.getElementById('charityCheckbox');
      const isEntity = businessCheckbox?.checked || charityCheckbox?.checked;
      
      // Check if worktype includes "sale"
      const isSaleWorktype = this.checkWorktypeForSale();
      
      // Check if worktype is valid for Rule 3
      const isValidForRule3 = this.checkWorktypeForRule3();
      
      // Store current selection to restore if still valid
      const currentSelection = formKruleSelector.value;
      
      // Clear existing options except the default
      formKruleSelector.innerHTML = '<option value="" disabled selected>Select a rule</option>';
      
      // Filter and add rules based on client type and worktype
      this.rules.forEach(rule => {
        // Skip rules 1 and 2 if worktype includes "sale"
        if (isSaleWorktype && (rule.id === 'rule1' || rule.id === 'rule2')) {
          return;
        }
        
        // Skip rule 3 if worktype is not valid for it
        if (!isValidForRule3 && rule.id === 'rule3') {
          return;
        }
        
        // Show all rules for entities, only 'all' rules for individuals
        if (isEntity || rule.appliesTo === 'all') {
          const option = document.createElement('option');
          option.value = rule.value;
          option.textContent = rule.label;
          option.dataset.ruleId = rule.id;
          formKruleSelector.appendChild(option);
        }
      });
      
      // Restore selection if it's still in the list
      if (currentSelection) {
        const optionExists = Array.from(formKruleSelector.options).some(opt => opt.value === currentSelection);
        if (optionExists) {
          formKruleSelector.value = currentSelection;
        }
      }
      
      console.log(`📋 Form K rules populated for ${isEntity ? 'entity' : 'individual'}${isSaleWorktype ? ' (sale worktype - rules 1&2 excluded)' : ''}${!isValidForRule3 ? ' (rule 3 excluded)' : ''}`);
    },
    
    checkWorktypeForSale: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      
      const worktypeValue = (worktypeDropdown?.value || worktypeInput?.value || '').toLowerCase();
      
      // Match "sale" as a standalone word (not "purchase")
      // Use word boundary to match "sale of" but not "purcha-se of"
      return /\bsale\b/.test(worktypeValue);
    },
    
    checkWorktypeForRule3: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      
      const worktypeValue = (worktypeDropdown?.value || worktypeInput?.value || '').toLowerCase();
      
      // Valid worktypes for Rule 3
      const validWorktypes = ['will', 'wills', 'lpa', 'lasting power of attorney', 'deeds & declarations'];
      
      return validWorktypes.some(type => worktypeValue.includes(type));
    },
    
    showRuleSelector: function() {
      const formKruleSelector = document.getElementById('formKruleSelector');
      
      if (formKruleSelector) {
        formKruleSelector.classList.remove('hidden');
        console.log('👁️ Form K rule selector shown');
      }
    },
    
    showK3Hint: function() {
      const k3Hint = document.getElementById('k3Hint');
      
      if (k3Hint) {
        k3Hint.classList.remove('hidden');
        console.log('⚠️ k3Hint shown for Form K');
      }
    },
    
    setupRuleListener: function() {
      const formKruleSelector = document.getElementById('formKruleSelector');
      const messageInput = document.getElementById('messageInput');
      
      if (!formKruleSelector) return;
      
      formKruleSelector.addEventListener('change', () => {
        const selectedRule = formKruleSelector.value;
        const selectedOption = formKruleSelector.selectedOptions[0];
        const selectedRuleId = selectedOption?.dataset?.ruleId;
        
        // Handle Rule 3 selection - requires Form J validation
        if (selectedRuleId === 'rule3') {
          const isValidWorktype = this.checkWorktypeForRule3();
          
          if (!isValidWorktype) {
            // Invalid worktype - already handled by worktype listener
            return;
          }
          
          // Check Form J requirements for Rule 3
          const formJSufficientPhotos = window.RequestFormCore?.formJSufficientPhotos();
          const formJConditionsMet = window.RequestFormCore?.formJConditionsMet();
          
          if (!formJSufficientPhotos || !formJConditionsMet) {
            this.handleRule3RequirementsNotMet(formJSufficientPhotos, formJConditionsMet);
            return;
          }
          
          // Requirements met - show ID Images section and k3Hint
          this.showIDImagesSection();
          this.showK3Hint();
          
          // Populate message
          if (selectedRule && messageInput) {
            messageInput.value = selectedRule;
            console.log('📝 Form K Rule 3 selected, message populated');
          }
        } else {
          // Other rules selected - hide ID Images section and k3Hint
          this.hideIDImagesSection();
          this.hideK3Hint();
          
          // Populate message for other rules
          if (selectedRule && messageInput) {
            messageInput.value = selectedRule;
            console.log('📝 Form K rule selected, message populated');
          }
        }
      });
      
      console.log('👂 Form K rule selector listener setup');
    },
    
    showIDImagesSection: function() {
      const idImagesSection = document.getElementById('idImagesSection');
      
      if (idImagesSection) {
        idImagesSection.classList.remove('hidden');
        console.log('👁️ ID Images section shown for Form K Rule 3');
      }
    },
    
    hideIDImagesSection: function() {
      const idImagesSection = document.getElementById('idImagesSection');
      
      if (idImagesSection) {
        idImagesSection.classList.add('hidden');
        console.log('👁️ ID Images section hidden for Form K');
      }
    },
    
    handleRule3RequirementsNotMet: function(formJSufficientPhotos, formJConditionsMet) {
      const errors = [];
      
      // Build specific error messages
      const idImages = window.RequestFormCore?.idImages() || [];
      const addressIdCount = idImages.filter(img => img.type === 'Address ID').length;
      const photoIdImages = idImages.filter(img => img.type === 'PhotoID');
      const hasPhotoIdFront = photoIdImages.some(img => img.side === 'Front' || img.side === 'Single');
      const hasPhotoIdBack = photoIdImages.some(img => img.side === 'Back');
      const hasSinglePhoto = photoIdImages.some(img => img.side === 'Single');
      
      if (!formJSufficientPhotos) {
        // Determine what's missing
        if (addressIdCount < 2) {
          const needed = 2 - addressIdCount;
          errors.push(`This entry is missing ${needed} Address ID document${needed > 1 ? 's' : ''}`);
        }
        
        const hasCompletePair = hasPhotoIdFront && hasPhotoIdBack;
        if (!hasSinglePhoto && !hasCompletePair) {
          if (!hasPhotoIdFront && !hasPhotoIdBack) {
            errors.push('This entry is missing Photo ID');
          } else if (!hasPhotoIdBack) {
            errors.push('This entry is missing Photo ID Back');
          } else {
            errors.push('This entry is missing Photo ID Front');
          }
        }
      }
      
      // Check likeness confirmed
      const iconData = window.RequestFormCore?.requestData()?.i || {};
      if (iconData.p && !iconData.l) {
        errors.push('Likeness has not been confirmed');
      }
      
      // Show combined error message
      const errorMessage = errors.length > 0 
        ? `Form K Rule 3 requires the same ID as Form J:\n\n${errors.join('\n')}\n\nPlease ask reception to upload them, or the client to present further ID. Once uploaded you will be able to use Form K Rule 3`
        : 'Form K Rule 3 requires Form J ID requirements to be met';
      
      if (window.RequestFormCore && window.RequestFormCore.showError) {
        window.RequestFormCore.showError(errorMessage);
      }
      
      // Deselect Rule 3
      const formKruleSelector = document.getElementById('formKruleSelector');
      const messageInput = document.getElementById('messageInput');
      
      if (formKruleSelector) {
        formKruleSelector.value = '';
      }
      
      if (messageInput) {
        messageInput.value = '';
      }
      
      this.hideIDImagesSection();
      this.hideK3Hint();
      
      console.log('❌ Form K Rule 3 deselected - requirements not met');
    },
    
    hideK3Hint: function() {
      const k3Hint = document.getElementById('k3Hint');
      
      if (k3Hint) {
        k3Hint.classList.add('hidden');
        console.log('👁️ k3Hint hidden');
      }
    },
    
    setupCheckboxListeners: function() {
      const businessCheckbox = document.getElementById('businessCheckbox');
      const charityCheckbox = document.getElementById('charityCheckbox');
      
      const handleCheckboxChange = () => {
        // Re-populate the dropdown when business/charity status changes
        this.populateRuleSelector();
        console.log('🔄 Form K rules refreshed due to client type change');
      };
      
      if (businessCheckbox) {
        businessCheckbox.addEventListener('change', handleCheckboxChange);
      }
      
      if (charityCheckbox) {
        charityCheckbox.addEventListener('change', handleCheckboxChange);
      }
      
      console.log('👂 Form K checkbox listeners setup');
    },
    
    setupWorktypeListener: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      const formKruleSelector = document.getElementById('formKruleSelector');
      const messageInput = document.getElementById('messageInput');
      
      const handleWorktypeChange = () => {
        const isSaleWorktype = this.checkWorktypeForSale();
        const isValidForRule3 = this.checkWorktypeForRule3();
        
        // Check which rule is currently selected
        const selectedOption = formKruleSelector?.selectedOptions[0];
        const selectedRuleId = selectedOption?.dataset?.ruleId;
        
        // Handle Rule 1 & 2 validation (not valid for sale)
        if (isSaleWorktype && (selectedRuleId === 'rule1' || selectedRuleId === 'rule2')) {
          // Show error and deselect
          if (window.RequestFormCore && window.RequestFormCore.showError) {
            window.RequestFormCore.showError('Form K Rule 1/2 not available for Sale files and new ID must be collected via Form E or J');
          }
          
          // Clear the selection and message
          formKruleSelector.value = '';
          if (messageInput) {
            messageInput.value = '';
          }
          
          this.hideK3Hint();
          console.log('❌ Form K rule 1 or 2 deselected due to sale worktype');
        }
        
        // Handle Rule 3 validation (only valid for specific worktypes)
        if (!isValidForRule3 && selectedRuleId === 'rule3') {
          // Show error and deselect
          if (window.RequestFormCore && window.RequestFormCore.showError) {
            window.RequestFormCore.showError('Form K Rule 3 is only valid for Will, Wills, LPA, Lasting Power of Attorney, or Deeds & Declarations worktypes');
          }
          
          // Clear the selection and message
          formKruleSelector.value = '';
          if (messageInput) {
            messageInput.value = '';
          }
          
          this.hideK3Hint();
          console.log('❌ Form K rule 3 deselected due to invalid worktype');
        }
        
        // Show/hide k3Hint based on Rule 3 selection and worktype validity
        if (selectedRuleId === 'rule3' && isValidForRule3) {
          this.showK3Hint();
        } else {
          this.hideK3Hint();
        }
        
        // Re-populate the dropdown to filter rules appropriately
        this.populateRuleSelector();
        console.log('🔄 Form K rules refreshed due to worktype change');
      };
      
      if (worktypeDropdown) {
        worktypeDropdown.addEventListener('change', handleWorktypeChange);
      }
      
      if (worktypeInput) {
        worktypeInput.addEventListener('input', handleWorktypeChange);
      }
      
      console.log('👂 Form K worktype listeners setup');
    },
    
    enableSubmitButton: function() {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        console.log('✅ Submit button enabled for Form K');
      }
    },
    
    getData: function() {
      const messageObj = this.createMessageObject();
      
      // Call global submission handler
      if (window.RequestFormCore && window.RequestFormCore.prepareAndSubmitRequest) {
        window.RequestFormCore.prepareAndSubmitRequest('formK', messageObj);
      }
      
      return null;
    },
    
    createMessageObject: function() {
      const messageInput = document.getElementById('messageInput');
      const userEmail = window.RequestFormCore.requestData().user || '';
      
      return {
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
        type: 'Staff',
        message: messageInput?.value.trim() || ''
      };
    },
    
    validate: function() {
      const errors = [];
      
      // ============================================
      // GENERAL REQUIREMENTS (All Rules)
      // ============================================
      
      // Standard 3 fields
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      const workTypeValue = worktypeDropdown?.value || worktypeInput?.value?.trim();
      if (!workTypeValue) {
        errors.push('You must select or enter a Work Type');
      }
      
      const relationDropdown = document.getElementById('relationDropdown');
      const relationInput = document.getElementById('relation');
      const relationValue = relationDropdown?.value || relationInput?.value?.trim();
      if (!relationValue) {
        errors.push('You must select or enter a Relation');
      }
      
      const matterDescInput = document.getElementById('matterDescription');
      if (!matterDescInput?.value?.trim()) {
        errors.push('You must enter a Matter Description');
      }
      
      // Form K Rule Selection
      const formKruleSelector = document.getElementById('formKruleSelector');
      const selectedOption = formKruleSelector?.selectedOptions[0];
      const selectedRuleId = selectedOption?.dataset?.ruleId;
      
      if (!formKruleSelector?.value) {
        errors.push('You must select a Form K rule');
      }
      
      // Rule 3 specific validation - requires Form J ID requirements
      if (selectedRuleId === 'rule3') {
        const formJSufficientPhotos = window.RequestFormCore?.formJSufficientPhotos();
        const formJConditionsMet = window.RequestFormCore?.formJConditionsMet();
        
        if (!formJSufficientPhotos) {
          errors.push('Form K Rule 3 requires 2 forms of Address ID and 1 form of Photo ID (Front/Back or Single)');
        }
        
        if (!formJConditionsMet) {
          errors.push('Form K Rule 3 requires likeness to be confirmed');
        }
      }
      
      // Name Change validation (if applicable)
      const recentNameChange = document.getElementById('recentNameChange');
      const previousName = document.getElementById('previousName');
      const reasonForNameChange = document.getElementById('reasonForNameChange');
      
      if (recentNameChange?.checked) {
        if (!previousName?.value?.trim()) {
          errors.push('You have indicated a name change/known as name, please enter the Previous/Known As Name');
        }
        if (!reasonForNameChange?.value?.trim()) {
          errors.push('You have indicated a name change/known as name, please enter the Reason for Name Change');
        }
      }
      
      // Current Address validation
      const currentAddress = document.getElementById('currentAddress');
      const addressNotListed = document.getElementById('addressNotListed');
      
      if (!currentAddress?.value?.trim() && !addressNotListed?.checked) {
        errors.push('You must enter the Current Address or manually input address details');
      }
      
      // Recent Move validation (if applicable)
      const recentMove = document.getElementById('recentMove');
      const previousAddress = document.getElementById('previousAddress');
      const previousAddressNotListed = document.getElementById('previousAddressNotListed');
      
      if (recentMove?.checked) {
        if (!previousAddress?.value?.trim() && !previousAddressNotListed?.checked) {
          errors.push('You have indicated a recent move, please enter the Previous Address or manually input address details');
        }
      }
      
      // ID Documents checkbox (always required)
      const idDocumentsCheckbox = document.getElementById('confirmationCheckbox');
      if (!idDocumentsCheckbox?.checked) {
        errors.push('You must check the ID Documents confirmation checkbox');
      }
      
      // ID Images checkbox (required for Rule 3 only)
      if (selectedRuleId === 'rule3') {
        const idImagesCheckbox = document.getElementById('idImagesConfirmationCheckbox');
        if (!idImagesCheckbox?.checked) {
          errors.push('You must check the ID Images confirmation checkbox for Form K Rule 3');
        }
      }
      
      // ============================================
      // CONDITIONAL REQUIREMENTS (Individual vs Entity)
      // ============================================
      
      // Determine if client is an entity
      const businessCheckbox = document.getElementById('businessCheckbox');
      const charityCheckbox = document.getElementById('charityCheckbox');
      const isEntity = businessCheckbox?.checked || charityCheckbox?.checked;
      
      // ============================================
      // OFSI validation (required for ALL Form K - both individuals and entities)
      // ============================================
      const idDocuments = window.RequestFormCore.idDocuments();
      const hasOFSI = idDocuments.some(doc => doc.type === 'PEP & Sanctions Check');
      
      // OFSI is always required
      if (!hasOFSI) {
        errors.push('You must upload an OFSI (Sanctions Check) or ensure one already exists');
      }
      
      const cdfFileInput = document.getElementById('cdfFileInput');
      const cdfDocumentType = document.getElementById('cdfDocumentType');
      
      // CDF file dropdown validation
      if (cdfFileInput?.files[0] && !cdfDocumentType?.value) {
        errors.push('You have uploaded a CDF file, please select the document type from the dropdown');
      }
      
      if (isEntity) {
        // ============================================
        // ENTITY REQUIREMENTS (Business/Charity)
        // ============================================
        
        // Check if entity data is successfully linked
        const requestData = window.RequestFormCore.requestData();
        const hasBusinessData = requestData?.cI?.bD && Object.keys(requestData.cI.bD).length > 0;
        
        // CDF required ONLY if no successful business link
        if (!hasBusinessData) {
          const hasCDF = idDocuments.some(doc => doc.type === 'Details form');
          
          if (!hasCDF) {
            errors.push('You must have a successful company/charity link or upload a CDF document');
          }
        } else {
          console.log('✅ Entity has linked business data - CDF not required');
        }
        
        // If no successful business link, require business name and entity number
        if (!hasBusinessData) {
          const businessName = document.getElementById('businessName');
          const entityNumber = document.getElementById('entityNumber');
          
          if (!businessName?.value?.trim()) {
            errors.push('You must enter the Business Name');
          }
          
          if (!entityNumber?.value?.trim()) {
            errors.push('You must enter the Entity Number');
          }
        }
        
      } else {
        // ============================================
        // INDIVIDUAL REQUIREMENTS
        // ============================================
        
        // CDF is always required for individuals
        const hasCDF = idDocuments.some(doc => doc.type === 'Details form');
        
        if (!hasCDF) {
          errors.push('You must upload a CDF (Client Details Form) or ensure one already exists');
        }
        
        // First and Last Name
        const firstName = document.getElementById('firstName');
        const lastName = document.getElementById('lastName');
        
        if (!firstName?.value?.trim()) {
          errors.push('You must enter the client\'s First Name');
        }
        
        if (!lastName?.value?.trim()) {
          errors.push('You must enter the client\'s Last Name');
        }
        
        // Date of Birth validation (8 individual digit inputs)
        const dob1 = document.getElementById('dob1');
        const dob2 = document.getElementById('dob2');
        const dob3 = document.getElementById('dob3');
        const dob4 = document.getElementById('dob4');
        const dob5 = document.getElementById('dob5');
        const dob6 = document.getElementById('dob6');
        const dob7 = document.getElementById('dob7');
        const dob8 = document.getElementById('dob8');
        
        const day = (dob1?.value || '') + (dob2?.value || '');
        const month = (dob3?.value || '') + (dob4?.value || '');
        const year = (dob5?.value || '') + (dob6?.value || '') + (dob7?.value || '') + (dob8?.value || '');
        
        const dobValidation = window.RequestFormCore.validateAndFormatDOB(day, month, year);
        
        if (!dobValidation.valid) {
          errors.push(dobValidation.error || 'You must enter a valid Date of Birth');
        }
        
        this.formattedDOB = dobValidation.formatted;
        
        // OFSI OR CDF (existing or uploaded)
        const idDocuments = window.RequestFormCore.idDocuments();
        const hasCDF = idDocuments.some(doc => doc.type === 'Details form');
        const hasOFSI = idDocuments.some(doc => doc.type === 'PEP & Sanctions Check');
        const cdfFileInput = document.getElementById('cdfFileInput');
        const ofsiFileInput = document.getElementById('ofsiFileInput');
        const cdfUploaded = cdfFileInput?.files[0];
        const ofsiUploaded = ofsiFileInput?.files[0];
        
        if (!hasCDF && !hasOFSI && !cdfUploaded && !ofsiUploaded) {
          errors.push('You must upload a CDF or OFSI document, or ensure at least one already exists');
        }
        
        // If CDF uploaded, dropdown required
        const cdfDocumentType = document.getElementById('cdfDocumentType');
        if (cdfUploaded && !cdfDocumentType?.value) {
          errors.push('You have uploaded a CDF file, please select the document type from the dropdown');
        }
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  };
  
  if (window.RequestFormCore) {
    window.RequestFormCore.registerRequestType('formK', FormK);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('formK', FormK);
      }
    });
  }
  
})();
