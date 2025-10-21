/*
=====================================================================
FORM E REQUEST TYPE MODULE
=====================================================================
Form E request requires:
- Standard 3 fields (work type, relation, matter description)
- ID Documents Section visible
- ejHint visible if BOTH formJ flags are true (sufficient photos AND conditions met)
- Message input (pre-populated)

Validation:
- Standard 3 fields must be filled
- Does NOT require Form J photo/ID validation (those are optional for Form E)

Sends request-data message to parent with:
- requestType: 'formE'
- data: updated client-data object
- message: message object
=====================================================================
*/

(function() {
  'use strict';
  
  const FormE = {
    formattedDOB: null,
    
    init: function(requestData) {
      console.log('📝 Initializing Form E request');
      
      // Show ID Documents section
      this.showIDDocumentsSection();
      
      // Re-update ID Documents UI to show cards (they were hidden by resetFormUI)
      if (window.RequestFormCore && window.RequestFormCore.updateIDDocumentsUI) {
        window.RequestFormCore.updateIDDocumentsUI(window.RequestFormCore.requestData());
      }
      
      // Check if we should show ejHint
      this.checkEjHint();
      
      // Check if worktype includes purchase and auto-select eSoF
      this.checkWorktypeForPurchase();
      
      // Setup worktype listener for purchase detection
      this.setupWorktypeListener();
      
      // Populate message input with Form E text
      this.populateMessage();
      
      // Enable submit button
      this.enableSubmitButton();
      
      console.log('✅ Form E request initialized');
    },
    
    showIDDocumentsSection: function() {
      const idDocumentsSection = document.getElementById('idDocumentsSection');
      
      if (idDocumentsSection) {
        idDocumentsSection.classList.remove('hidden');
        console.log('👁️ ID Documents section shown');
      }
    },
    
    checkEjHint: function() {
      const ejHint = document.getElementById('ejHint');
      
      if (!ejHint) return;
      
      // Show ejHint if BOTH Form J flags are true
      const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
      const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
      
      if (formJSufficientPhotos && formJConditionsMet) {
        ejHint.classList.remove('hidden');
        console.log('⚠️ ejHint shown (Form J requirements met)');
      } else {
        ejHint.classList.add('hidden');
        console.log('ℹ️ ejHint hidden (Form J requirements not met)');
      }
    },
    
    populateMessage: function() {
      const messageInput = document.getElementById('messageInput');
      
      if (messageInput) {
        // Form E (with or without eSoF) uses the same message
        messageInput.value = 'The client has requested an electronic check during onboarding, we attach their CDF and recent OFSI along with the BCDs entered';
        console.log('📝 Form E message text populated');
      }
    },
    
    checkWorktypeForPurchase: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      
      // Check both dropdown and input field for "purchase"
      let isPurchase = false;
      
      if (worktypeDropdown && worktypeDropdown.value) {
        const dropdownValue = worktypeDropdown.value.toLowerCase();
        if (dropdownValue.includes('purchase')) {
          isPurchase = true;
        }
      }
      
      if (worktypeInput && worktypeInput.value) {
        const inputValue = worktypeInput.value.toLowerCase();
        if (inputValue.includes('purchase')) {
          isPurchase = true;
        }
      }
      
      const esofTag = document.querySelector('[data-type="esof"]');
      const eSoFHint = document.getElementById('eSoFHint');
      const eSoFSkipHint = document.getElementById('eSoFSkipHint');
      const ejHint = document.getElementById('ejHint');
      
      // Check Form J flags for ejHint
      const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
      const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
      const shouldShowEjHint = formJSufficientPhotos && formJConditionsMet;
      
      if (isPurchase) {
        // Auto-select eSoF tag if not already selected
        if (esofTag && !esofTag.classList.contains('selected') && !esofTag.disabled) {
          esofTag.classList.add('selected');
          console.log('✅ eSoF auto-selected (purchase detected)');
        }
        
        // Show eSoFHint when both Form E + eSoF selected
        const esofSelected = esofTag?.classList.contains('selected');
        if (esofSelected) {
          if (eSoFHint) {
            eSoFHint.classList.remove('hidden');
            console.log('⚠️ eSoFHint shown (Form E + eSoF combo)');
          }
          if (eSoFSkipHint) {
            eSoFSkipHint.classList.add('hidden');
          }
        } else {
          // eSoF is disabled (entity mode) - show eSoFSkipHint
          if (eSoFSkipHint) {
            eSoFSkipHint.classList.remove('hidden');
            console.log('⚠️ eSoFSkipHint shown (purchase but eSoF disabled)');
          }
          if (eSoFHint) {
            eSoFHint.classList.add('hidden');
          }
        }
        
        // Preserve ejHint if applicable
        if (ejHint && shouldShowEjHint) {
          ejHint.classList.remove('hidden');
        }
        
      } else {
        // Deselect eSoF if purchase not in worktype
        if (esofTag && esofTag.classList.contains('selected')) {
          esofTag.classList.remove('selected');
          console.log('🗑️ eSoF deselected (no purchase in worktype)');
        }
        
        // Hide both eSoF hints
        if (eSoFHint) eSoFHint.classList.add('hidden');
        if (eSoFSkipHint) eSoFSkipHint.classList.add('hidden');
        
        // Preserve ejHint if applicable
        if (ejHint && shouldShowEjHint) {
          ejHint.classList.remove('hidden');
        }
      }
    },
    
    setupWorktypeListener: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      
      // Listen for dropdown changes
      if (worktypeDropdown) {
        worktypeDropdown.addEventListener('change', () => {
          this.checkWorktypeForPurchase();
        });
      }
      
      // Listen for input changes
      if (worktypeInput) {
        worktypeInput.addEventListener('input', () => {
          this.checkWorktypeForPurchase();
        });
      }
      
      console.log('👂 Worktype listeners setup for purchase detection (dropdown + input)');
    },
    
    enableSubmitButton: function() {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        console.log('✅ Submit button enabled for Form E');
      }
    },
    
    getData: function() {
      const messageObj = this.createMessageObject();
      
      // Call global submission handler
      if (window.RequestFormCore && window.RequestFormCore.prepareAndSubmitRequest) {
        window.RequestFormCore.prepareAndSubmitRequest('formE', messageObj);
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
      
      // Name validation
      const firstName = document.getElementById('firstName');
      const lastName = document.getElementById('lastName');
      
      if (!firstName?.value?.trim()) {
        errors.push('You must enter the client\'s First Name');
      }
      
      if (!lastName?.value?.trim()) {
        errors.push('You must enter the client\'s Last Name');
      }
      
      // Date of Birth validation (8 individual digit inputs) - OPTIONAL for Form E
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
      
      // Only validate DOB if user has started filling it in
      const dobEntered = day.length > 0 || month.length > 0 || year.length > 0;
      
      if (dobEntered) {
        const dobValidation = window.RequestFormCore.validateAndFormatDOB(day, month, year);
        
        if (!dobValidation.valid) {
          errors.push(dobValidation.error || 'Please complete all 8 digits of the Date of Birth, or leave it blank');
        }
        
        this.formattedDOB = dobValidation.formatted;
      } else {
        this.formattedDOB = null; // No DOB entered, set to null
      }
      
      // Name Change validation
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
      
      // Recent Move validation
      const recentMove = document.getElementById('recentMove');
      const previousAddress = document.getElementById('previousAddress');
      const previousAddressNotListed = document.getElementById('previousAddressNotListed');
      
      if (recentMove?.checked) {
        if (!previousAddress?.value?.trim() && !previousAddressNotListed?.checked) {
          errors.push('You have indicated a recent move, please enter the Previous Address or manually input address details');
        }
      }
      
      // Mobile number validation
      const phoneCountryCode = document.getElementById('phoneCountryCode');
      const phoneNumber = document.getElementById('phoneNumber');
      const phoneCode = phoneCountryCode?.dataset.phoneCode || '';
      
      if (!phoneNumber?.value?.trim()) {
        errors.push('You must enter a Mobile Number');
      } else if (!phoneCode) {
        errors.push('You must select a country code for the Mobile Number');
      }
      
      // ID Documents checkbox
      const idDocumentsCheckbox = document.getElementById('confirmationCheckbox');
      if (!idDocumentsCheckbox?.checked) {
        errors.push('You must check the ID Documents confirmation checkbox');
      }
      
      // CDF file dropdown validation
      const cdfFileInput = document.getElementById('cdfFileInput');
      const cdfDocumentType = document.getElementById('cdfDocumentType');
      
      if (cdfFileInput?.files[0]) {
        if (!cdfDocumentType?.value) {
          errors.push('You have uploaded a CDF file, please select the document type from the dropdown');
        }
      }
      
      // CDF or OFSI validation (must have at least one)
      const idDocuments = window.RequestFormCore.idDocuments();
      const hasCDF = idDocuments.some(doc => doc.type === 'Details form');
      const hasOFSI = idDocuments.some(doc => doc.type === 'PEP & Sanctions Check');
      
      if (!hasCDF && !hasOFSI) {
        errors.push('You must upload a CDF or OFSI document, or ensure at least one already exists');
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  };
  
  if (window.RequestFormCore) {
    window.RequestFormCore.registerRequestType('formE', FormE);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('formE', FormE);
      }
    });
  }
  
})();
