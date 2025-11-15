/*
=====================================================================
FORM J REQUEST TYPE MODULE
=====================================================================
Form J request requires:
- Standard 3 fields (work type, relation, matter description)
- ID Images Section visible
- ID Documents Section visible
- ejHint visible if formJConditionsMet flag is true
- Optional message input
- Optional file attachment

Validation:
- formJSufficientPhotos must be true (2x Address ID + valid Photo IDs)
- formJConditionsMet must be true (has photo ID, has address ID, likeness confirmed)
- All standard 3 fields must be filled

Sends request-data message to parent with:
- request: 'formJ'
- data: updated client-data object
- message: optional message object (only if message entered)
=====================================================================
*/

(function() {
  'use strict';
  
  const FormJ = {
    // File upload state (for optional file attachments)
    pendingFile: null,
    pendingMessage: null,
    uploadingFile: false,
    
    init: function(requestData) {
      console.log('&#xD83D;&#xDCDD; Initializing Form J request');
      
      // Check Form J requirements FIRST
      const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
      const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
      
      if (!formJSufficientPhotos || !formJConditionsMet) {
        // Requirements not met - show error and deselect Form J
        this.handleRequirementsNotMet(formJSufficientPhotos, formJConditionsMet);
        return; // Don't proceed with initialization
      }
      
      // Requirements met - proceed with Form J setup
      // Show ID sections
      this.showIDSections();
      
      // Re-update ID Documents UI to show cards (they were hidden by resetFormUI)
      if (window.RequestFormCore && window.RequestFormCore.updateIDDocumentsUI) {
        window.RequestFormCore.updateIDDocumentsUI(window.RequestFormCore.requestData());
      }
      
      // Show nameVerificationHint and check for purchase worktype
      this.showHints();
      
      // Populate message input with Form J text
      this.populateMessage();
      
      // Setup worktype listener for purchase detection
      this.setupWorktypeListener();
      
      // Setup validation
      this.setupValidation();
      
      // Enable submit button (requirements are met and message is pre-populated)
      this.enableSubmitButton();
      
      // Setup file upload listener
      this.setupFileUploadListener();
      
      console.log('&#x2705; Form J request initialized');
    },
    
    enableSubmitButton: function() {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        console.log('&#x2705; Submit button enabled for Form J');
      }
    },
    
    handleRequirementsNotMet: function(formJSufficientPhotos, formJConditionsMet) {
      // Determine what's missing
      const idImages = window.RequestFormCore.idImages();
      let missingItems = [];
      
      // Count Address IDs and Photo IDs
      const addressIDs = idImages.filter(img => img.type === 'AddressID');
      const photoIDs = idImages.filter(img => img.type === 'PhotoID');
      
      // Check what's missing
      if (addressIDs.length < 2) {
        const needed = 2 - addressIDs.length;
        missingItems.push(`${needed} Address ID${needed > 1 ? 's' : ''}`);
      }
      
      if (!formJConditionsMet || photoIDs.length === 0) {
        missingItems.push('Photo ID with likeness confirmed');
      }
      
      // Build error message
      const missingText = missingItems.join(' and/or ');
      const errorMessage = `This entry is missing ${missingText}. Please ask reception to upload them, or the client to present further ID. Once uploaded you will be able to request a Form J`;
      
      // Show error popup
      if (window.RequestFormCore && window.RequestFormCore.showError) {
        window.RequestFormCore.showError(errorMessage, 'Form J Requirements Not Met');
      } else {
        alert(errorMessage);
      }
      
      // Deselect Form J tag
      const formJTag = document.querySelector('[data-type="formJ"]');
      if (formJTag) {
        formJTag.classList.remove('selected');
      }
      
      // Access the global currentRequestType variable directly
      if (typeof currentRequestType !== 'undefined' && currentRequestType === 'formJ') {
        previousRequestType = currentRequestType;
        currentRequestType = null;
      }
      
      // Reset form UI (this will clear message input)
      if (window.RequestFormCore && window.RequestFormCore.resetFormUI) {
        window.RequestFormCore.resetFormUI('formJ', null);
      }
      
      console.log('&#x274C; Form J requirements not met - tag deselected and form reset');
    },
    
    showIDSections: function() {
      const idImagesSection = document.getElementById('idImagesSection');
      const idDocumentsSection = document.getElementById('idDocumentsSection');
      
      if (idImagesSection) {
        idImagesSection.classList.remove('hidden');
      }
      
      if (idDocumentsSection) {
        idDocumentsSection.classList.remove('hidden');
      }
      
      console.log('&#xD83D;&#xDC41;&#xFE0F; ID Images and ID Documents sections shown');
    },
    
    showHints: function() {
      const nameVerificationHint = document.getElementById('nameVerificationHint');
      
      if (nameVerificationHint) {
        nameVerificationHint.classList.remove('hidden');
        console.log('&#x26A0;&#xFE0F; Name verification hint shown for Form J');
      }
      
      // Check if worktype includes "purchase" and show eSoFSkipHint
      this.checkWorktypeForPurchase();
    },
    
    checkWorktypeForPurchase: function() {
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      const eSoFSkipHint = document.getElementById('eSoFSkipHint');
      
      if (!eSoFSkipHint) return;
      
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
      
      if (isPurchase) {
        eSoFSkipHint.classList.remove('hidden');
        console.log('&#x26A0;&#xFE0F; Purchase detected - showing eSoF skip hint');
      } else {
        eSoFSkipHint.classList.add('hidden');
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
      
      console.log('&#xD83D;&#xDC42; Worktype listeners setup for purchase detection (dropdown + input)');
    },
    
    populateMessage: function() {
      const messageInput = document.getElementById('messageInput');
      
      if (messageInput) {
        messageInput.value = 'We hold sufficient Photographic and Address ID to perform a Form J check on this client, we attach the CDF and recent OFSI along with the BCDs entered';
        console.log('&#xD83D;&#xDCDD; Form J message text populated');
      }
    },
    
    setupValidation: function() {
      // For Form J, we don't need dynamic validation listeners
      // Button is enabled when Form J is selected (if requirements met)
      // Full validation only happens on submit
      // This prevents the button from toggling on/off as user types
      console.log('&#x2705; Form J validation configured (validates on submit only)');
    },
    
    setupFileUploadListener: function() {
      window.addEventListener('message', (event) => {
        if (event.data.type === 'put-links' && this.uploadingFile) {
          this.handlePutLinks(event.data);
        } else if (event.data.type === 'put-error' && this.uploadingFile) {
          this.handlePutError(event.data);
        }
      });
    },
    
    handlePutLinks: function(data) {
      const links = data.links;
      const s3Keys = data.s3Keys;
      
      if (links && links.length > 0 && s3Keys && s3Keys.length > 0) {
        this.uploadFileToS3(links[0], s3Keys[0].s3Key);
      }
    },
    
    handlePutError: function(data) {
      console.error('PUT link generation failed:', data.message);
      alert('File upload failed. Please try again.');
      this.uploadingFile = false;
      this.pendingFile = null;
      this.pendingMessage = null;
      document.getElementById('submitBtn').disabled = false;
    },
    
    uploadFileToS3: function(putLink, s3Key) {
      if (!this.pendingFile || !this.pendingMessage) {
        console.error('No file or message to upload');
        this.uploadingFile = false;
        return;
      }
      
      fetch(putLink, {
        method: 'PUT',
        body: this.pendingFile,
        headers: {
          'Content-Type': this.pendingFile.type
        }
      })
      .then(response => {
        if (response.ok) {
          console.log('File uploaded successfully to S3');
          this.sendRequestData(s3Key);
        } else {
          throw new Error(`Upload failed: ${response.status}`);
        }
      })
      .catch(error => {
        console.error('File upload failed:', error);
        alert('File upload failed. Please try again.');
        this.uploadingFile = false;
        this.pendingFile = null;
        this.pendingMessage = null;
        document.getElementById('submitBtn').disabled = false;
      });
    },
    
    sendRequestData: function(s3Key = null) {
      const updatedData = window.RequestFormCore.buildUpdatedClientData();
      const messageInput = document.getElementById('messageInput');
      const hasMessage = messageInput && messageInput.value.trim();
      
      const payload = {
        type: 'request-data',
        requestType: 'formJ',
        user: window.RequestFormCore.requestData().user || '',
        _id: window.RequestFormCore.requestData()._id || '',
        data: updatedData
      };
      
      // Only include message if there's text content or a file
      if (hasMessage || s3Key) {
        const messageObj = this.pendingMessage || (hasMessage ? this.createMessageObject() : null);
        
        if (messageObj) {
          if (s3Key && this.pendingFile) {
            messageObj.file = {
              name: this.pendingFile.name,
              size: this.pendingFile.size,
              type: this.pendingFile.type,
              s3Key: s3Key
            };
          }
          
          payload.messageObj = messageObj;
        }
      }
      
      window.parent.postMessage(payload, '*');
      
      this.uploadingFile = false;
      this.pendingFile = null;
      this.pendingMessage = null;
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
    
    getData: function() {
      const fileInput = document.getElementById('fileInput');
      const file = fileInput?.files[0];
      
      if (file) {
        this.uploadingFile = true;
        this.pendingFile = file;
        
        const messageInput = document.getElementById('messageInput');
        if (messageInput && messageInput.value.trim()) {
          this.pendingMessage = this.createMessageObject();
        }
        
        const fileName = `formj-attachment-${Date.now()}-${file.name}`;
        const fileData = {
          type: 'Document',
          document: 'Form J Attachment',
          uploader: window.RequestFormCore.requestData().user || '',
          data: {
            type: file.type,
            size: file.size,
            name: fileName,
            lastModified: file.lastModified
          },
          file: file
        };
        
        window.parent.postMessage({
          type: 'file-data',
          files: [fileData],
          _id: window.RequestFormCore.requestData()._id || ''
        }, '*');
        
        return null;
      }
      
      this.sendRequestData();
      return null;
    },
    
    validate: function() {
      const errors = [];
      
      // Standard 3 fields
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      const relationDropdown = document.getElementById('relationDropdown');
      const relationInput = document.getElementById('relation');
      const matterDescInput = document.getElementById('matterDescription');
      
      // Work Type (check both dropdown and input)
      const workTypeValue = worktypeDropdown?.value || worktypeInput?.value?.trim();
      if (!workTypeValue) {
        errors.push('You must select or enter a Work Type');
      }
      
      // Relation (check both dropdown and input)
      const relationValue = relationDropdown?.value || relationInput?.value?.trim();
      if (!relationValue) {
        errors.push('You must select or enter a Relation');
      }
      
      // Matter Description
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
      
      // Date of Birth validation (8 individual digit inputs: dob1-dob8)
      const dob1 = document.getElementById('dob1');
      const dob2 = document.getElementById('dob2');
      const dob3 = document.getElementById('dob3');
      const dob4 = document.getElementById('dob4');
      const dob5 = document.getElementById('dob5');
      const dob6 = document.getElementById('dob6');
      const dob7 = document.getElementById('dob7');
      const dob8 = document.getElementById('dob8');
      
      // Combine into DD, MM, YYYY
      const day = (dob1?.value || '') + (dob2?.value || '');
      const month = (dob3?.value || '') + (dob4?.value || '');
      const year = (dob5?.value || '') + (dob6?.value || '') + (dob7?.value || '') + (dob8?.value || '');
      
      const dobValidation = window.RequestFormCore.validateAndFormatDOB(day, month, year);
      
      if (!dobValidation.valid) {
        errors.push(dobValidation.error || 'You must enter a valid Date of Birth');
      }
      
      // Store formatted DOB for later use in request-data
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
      
      if (addressNotListed?.checked) {
        // Check manual address fields (handled by validateAddressFields)
        // These will be added by the global validation
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
      
      // ID Images checkbox
      const idImagesCheckbox = document.getElementById('idImagesConfirmationCheckbox');
      if (!idImagesCheckbox?.checked) {
        errors.push('You must check the ID Images confirmation checkbox');
      }
      
      // ID Documents checkbox
      const idDocumentsCheckbox = document.getElementById('confirmationCheckbox');
      if (!idDocumentsCheckbox?.checked) {
        errors.push('You must check the ID Documents confirmation checkbox');
      }
      
      // CDF and OFSI validation
      const idDocuments = window.RequestFormCore.idDocuments();
      const hasCDF = idDocuments.some(doc => doc.type === 'Details form');
      const hasOFSI = idDocuments.some(doc => doc.type === 'PEP & Sanctions Check');
      
      // Check if CDF file is being uploaded
      const cdfFileInput = document.getElementById('cdfFileInput');
      const cdfDocumentType = document.getElementById('cdfDocumentType');
      
      if (cdfFileInput?.files[0]) {
        // CDF file selected - require dropdown selection
        if (!cdfDocumentType?.value) {
          errors.push('You have uploaded a CDF file, please select the document type from the dropdown');
        }
      }
      
      const profileComplete = window.RequestFormCore.hasCompleteIndividualProfile();
      if (!hasCDF && !profileComplete) {
        errors.push('You must upload a CDF (Client Details Form) or complete all client data in the form');
      }
      
      if (!hasOFSI) {
        errors.push('You must upload an OFSI (Sanctions Check) or ensure one already exists');
      }
      
      // Check Form J validation flags
      const formJSufficientPhotos = window.RequestFormCore.formJSufficientPhotos();
      const formJConditionsMet = window.RequestFormCore.formJConditionsMet();
      
      if (!formJSufficientPhotos) {
        errors.push('Form J requires 2x Address ID and valid Photo IDs');
      }
      
      if (!formJConditionsMet) {
        errors.push('Form J conditions not met (Photo ID taken, Address ID taken, Likeness confirmed)');
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  };
  
  if (window.RequestFormCore) {
    window.RequestFormCore.registerRequestType('formJ', FormJ);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('formJ', FormJ);
      }
    });
  }
  
})();
