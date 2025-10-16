/*
=====================================================================
ESOF REQUEST TYPE MODULE
=====================================================================
eSoF (electronic Source of Funds) request requires:
- Standard 3 fields (work type, relation, matter description)
- Can be selected alone OR combined with Form E
- Shows eSoFOnlyHint when selected alone
- Shows eSoFHint when combined with Form E
- Message input (pre-populated)

Validation:
- Standard 3 fields must be filled
- No photo/ID requirements

Sends request-data message to parent with:
- requestType: 'esof'
- data: updated client-data object
- message: message object
=====================================================================
*/

(function() {
  'use strict';
  
  const ESoF = {
    init: function(requestData) {
      console.log('📝 Initializing eSoF request');
      
      // Check if worktype includes purchase (required for eSoF)
      if (!this.validatePurchaseWorktype()) {
        // Worktype doesn't include purchase - deselect eSoF and show error
        this.handleInvalidWorktype();
        return;
      }
      
      // Show ID Documents section
      this.showIDDocumentsSection();
      
      // Re-update ID Documents UI to show cards (they were hidden by resetFormUI)
      if (window.RequestFormCore && window.RequestFormCore.updateIDDocumentsUI) {
        window.RequestFormCore.updateIDDocumentsUI(window.RequestFormCore.requestData());
      }
      
      // Check if combined with Form E or standalone
      this.checkFormECombo();
      
      // Populate message input with eSoF text
      this.populateMessage();
      
      // Enable submit button
      this.enableSubmitButton();
      
      console.log('✅ eSoF request initialized');
    },
    
    showIDDocumentsSection: function() {
      const idDocumentsSection = document.getElementById('idDocumentsSection');
      
      if (idDocumentsSection) {
        idDocumentsSection.classList.remove('hidden');
        console.log('👁️ ID Documents section shown');
      }
    },
    
    validatePurchaseWorktype: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      
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
      
      return isPurchase;
    },
    
    handleInvalidWorktype: function() {
      // Show error
      if (window.RequestFormCore && window.RequestFormCore.showError) {
        window.RequestFormCore.showError(
          'eSoF checks are only valid for purchase transactions. Please update the Work Type to include "purchase" or select a different check type.',
          'eSoF Not Available'
        );
      }
      
      // Deselect eSoF tag
      const esofTag = document.querySelector('[data-type="esof"]');
      if (esofTag) {
        esofTag.classList.remove('selected');
      }
      
      // Reset current request type
      if (typeof currentRequestType !== 'undefined' && currentRequestType === 'esof') {
        previousRequestType = currentRequestType;
        currentRequestType = null;
      }
      
      // Reset form UI
      if (window.RequestFormCore && window.RequestFormCore.resetFormUI) {
        window.RequestFormCore.resetFormUI('esof', null);
      }
      
      console.log('❌ eSoF not available - worktype does not include purchase');
    },
    
    checkFormECombo: function() {
      const formETag = document.querySelector('[data-type="formE"]');
      const isFormESelected = formETag?.classList.contains('selected');
      
      const eSoFOnlyHint = document.getElementById('eSoFOnlyHint');
      const eSoFHint = document.getElementById('eSoFHint');
      
      if (isFormESelected) {
        // Combined with Form E - show eSoFHint
        if (eSoFHint) eSoFHint.classList.remove('hidden');
        if (eSoFOnlyHint) eSoFOnlyHint.classList.add('hidden');
        console.log('ℹ️ eSoF combined with Form E - showing eSoFHint');
      } else {
        // Standalone eSoF - show eSoFOnlyHint
        if (eSoFOnlyHint) eSoFOnlyHint.classList.remove('hidden');
        if (eSoFHint) eSoFHint.classList.add('hidden');
        console.log('ℹ️ eSoF standalone - showing eSoFOnlyHint');
      }
    },
    
    populateMessage: function() {
      const messageInput = document.getElementById('messageInput');
      const formETag = document.querySelector('[data-type="formE"]');
      const isFormESelected = formETag?.classList.contains('selected');
      
      if (messageInput) {
        if (isFormESelected) {
          // Form E + eSoF combined message
          messageInput.value = 'The client has requested an electronic check during onboarding, we attach their CDF and recent OFSI along with the BCDs entered';
        } else {
          // eSoF only message
          messageInput.value = 'The client has requested/I would like to send the client an electronic source of funds check, i include the required details below';
        }
        console.log('📝 eSoF message text populated');
      }
    },
    
    enableSubmitButton: function() {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        console.log('✅ Submit button enabled for eSoF');
      }
    },
    
    getData: function() {
      const messageObj = this.createMessageObject();
      
      // Call global submission handler
      if (window.RequestFormCore && window.RequestFormCore.prepareAndSubmitRequest) {
        window.RequestFormCore.prepareAndSubmitRequest('esof', messageObj);
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
        message: messageInput?.value.trim() || '',
        type: 'Staff'
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
      const mobileInput = document.getElementById('mobile');
      if (!mobileInput?.value?.trim()) {
        errors.push('You must enter a valid Mobile Number with country code');
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
    window.RequestFormCore.registerRequestType('esof', ESoF);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('esof', ESoF);
      }
    });
  }
  
})();
