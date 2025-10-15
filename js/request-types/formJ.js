/*
=====================================================================
FORM J REQUEST TYPE MODULE
=====================================================================
Handles Form J request functionality including:
- Rule selection for Form J submissions
- Message input and file uploads
- Validation specific to Form J requirements
=====================================================================
*/

(function() {
  'use strict';
  
  const FormJ = {
    data: {
      selectedRule: '',
      message: '',
      files: []
    },
    
    rules: [
      {
        value: "We already hold a [Pass/ePass] result valid to ....-...... on matter ........../... for this client which is sufficient to process a form K [RULE 1] AND this matter is not a sale. I attach both the CDF and a recent OFSI for the client.",
        label: "Rule 1 - Pass/ePass already held",
        id: "rule1"
      },
      {
        value: "We already hold an [ID Held] result valid to ....-...... on matter ........../... for this client which is sufficient to contuct an electronic check under form K [RULE 2] AND this is not a sale. I attach both the CDF and a recent OFSI for the client.",
        label: "Rule 2 - ID already Held",
        id: "rule2"
      },
      {
        value: "This matter is out of scope and we hold TWO valid forms of address ID and ONE valid form of Photo ID for the client sufficient to process a form K [RULE 3]. I attach both the CDF and a recent OFSI for the client.",
        label: "Rule 3 - This matter is out of scope",
        id: "rule3"
      },
      {
        value: "The client is a company and we enclose a print out from companies house of the register entry",
        label: "Rule 4 - Company",
        id: "rule4"
      },
      {
        value: "The client is a partnership and we enclose a print out from companies house of the register entry or proof of address for the partnership sufficient to process a form K [RULE 5]. I attach a recent OFSI for the client.",
        label: "Rule 5 - Partnership",
        id: "rule5"
      },
      {
        value: "The client is a charity and we enclose a print out from the charity register of the entry including a list of all registered officers",
        label: "Rule 6 - Charity",
        id: "rule6"
      },
      {
        value: "The client is a PLC and we enclose a print out from the stock exchange of the registration sufficient to process a form K [RULE 7]. I attach a recent OFSI check for the client.",
        label: "Rule 7 - PLC",
        id: "rule7"
      },
      {
        value: "The client is a governemnt/council department and we enclose proof of its status sufficient to process a form K [RULE 8]. I attach a recent OFSI check for the client.",
        label: "Rule 8 - Government/Council",
        id: "rule8"
      },
      {
        value: "The client is a regulated professional and we enclose proof of the registration with the regulatory body sufficient to process a form K [RULE 9]. I attach a recent OFSI check for the client.",
        label: "Rule 9 - Regulated Institution",
        id: "rule9"
      },
      {
        value: "The client has been identified by a regulated professional and proof of reliance on thier checks is included along with a recent OFSI check sufficient to process a form K [RULE 10]",
        label: "Rule 10 - Regulated referral",
        id: "rule10"
      },
      {
        value: "The client has conducted a Thirdfort Check in the last 6 months which has been securely shared to ...........@thurstanhoskin.co.uk succificent to process a form K [RULE 11].",
        label: "Rule 11 - Thirdfort Secure Share",
        id: "rule11"
      }
    ],
    
    init: function(requestData) {
      this.data = {
        selectedRule: '',
        message: '',
        files: []
      };
    },
    
    render: function() {
      return `
        <div class="request-section">
          <h4>Form J Request</h4>
          <p class="section-description">Complete the form J request by selecting the appropriate rule and providing any additional details.</p>
          
          <!-- Rule Selection -->
          <div class="rules-section">
            <label for="ruleSelectFormJ" class="required">Select the rule you are submitting under</label>
            <select id="ruleSelectFormJ" name="ruleSelect">
              <option value="">Select rule...</option>
              ${this.rules.map(rule => `
                <option value="${rule.value}" data-rule-id="${rule.id}">${rule.label}</option>
              `).join('')}
            </select>
          </div>
          
          <!-- Additional Message -->
          <div class="message-section">
            <label for="messageFormJ">Additional message (optional)</label>
            <textarea id="messageFormJ" name="message" placeholder="Enter any additional details or comments..."></textarea>
          </div>
          
          <!-- File Upload -->
          <div class="file-upload-section" id="fileUploadFormJ">
            <label for="fileInputFormJ" class="file-upload-label">
              <div class="file-upload-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7,10 12,15 17,10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Click to upload files or drag and drop</span>
                <small>Upload supporting documents if required</small>
              </div>
            </label>
            <input type="file" id="fileInputFormJ" name="files" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style="display: none;">
            
            <!-- File List -->
            <div id="fileListFormJ" class="file-list" style="display: none;">
              <div class="file-list-header">Uploaded Files</div>
              <div id="fileItemsFormJ" class="file-items"></div>
            </div>
          </div>
        </div>
        
        <div class="action-buttons">
          <button type="button" class="btn btn-secondary" id="cancelFormJ">Cancel</button>
          <button type="button" class="btn btn-primary" id="submitFormJ">Submit Form J Request</button>
        </div>
      `;
    },
    
    setupEventListeners: function() {
      const ruleSelect = document.getElementById('ruleSelectFormJ');
      const messageInput = document.getElementById('messageFormJ');
      const fileInput = document.getElementById('fileInputFormJ');
      const fileUploadSection = document.getElementById('fileUploadFormJ');
      const submitBtn = document.getElementById('submitFormJ');
      const cancelBtn = document.getElementById('cancelFormJ');
      
      if (ruleSelect) {
        ruleSelect.addEventListener('change', (e) => {
          this.data.selectedRule = e.target.value;
          this.updateValidationState();
        });
      }
      
      if (messageInput) {
        messageInput.addEventListener('input', (e) => {
          this.data.message = e.target.value;
        });
      }
      
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          this.handleFileSelection(e.target.files);
        });
      }
      
      // Drag and drop functionality
      if (fileUploadSection) {
        fileUploadSection.addEventListener('dragover', (e) => {
          e.preventDefault();
          fileUploadSection.classList.add('dragover');
        });
        
        fileUploadSection.addEventListener('dragleave', (e) => {
          e.preventDefault();
          fileUploadSection.classList.remove('dragover');
        });
        
        fileUploadSection.addEventListener('drop', (e) => {
          e.preventDefault();
          fileUploadSection.classList.remove('dragover');
          this.handleFileSelection(e.dataTransfer.files);
        });
      }
      
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this.submitRequest();
        });
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.cancelRequest();
        });
      }
    },
    
    handleFileSelection: function(files) {
      Array.from(files).forEach(file => {
        // Validate file type and size
        if (this.validateFile(file)) {
          this.data.files.push({
            name: file.name,
            size: file.size,
            type: file.type,
            file: file
          });
        }
      });
      
      this.updateFileList();
    },
    
    validateFile: function(file) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/jpg',
        'image/png'
      ];
      
      if (file.size > maxSize) {
        window.RequestFormCore.showError(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return false;
      }
      
      if (!allowedTypes.includes(file.type)) {
        window.RequestFormCore.showError(`File type "${file.type}" is not supported.`);
        return false;
      }
      
      return true;
    },
    
    updateFileList: function() {
      const fileList = document.getElementById('fileListFormJ');
      const fileItems = document.getElementById('fileItemsFormJ');
      
      if (this.data.files.length === 0) {
        fileList.style.display = 'none';
        return;
      }
      
      fileList.style.display = 'block';
      fileItems.innerHTML = this.data.files.map((file, index) => `
        <div class="file-item">
          <span class="file-name">${file.name}</span>
          <span class="file-size">${this.formatFileSize(file.size)}</span>
          <button type="button" class="btn-remove-file" data-index="${index}">&times;</button>
        </div>
      `).join('');
      
      // Add remove file event listeners
      fileItems.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.data.files.splice(index, 1);
          this.updateFileList();
        });
      });
    },
    
    formatFileSize: function(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    updateValidationState: function() {
      const submitBtn = document.getElementById('submitFormJ');
      if (submitBtn) {
        submitBtn.disabled = !this.data.selectedRule;
      }
    },
    
    getData: function() {
      return {
        type: 'formJ',
        rule: this.data.selectedRule,
        message: this.data.message,
        files: this.data.files.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type
        }))
      };
    },
    
    validate: function() {
      const errors = [];
      
      if (!this.data.selectedRule) {
        errors.push('Please select a rule');
      }
      
      // Check if files are required based on selected rule
      const selectedRuleOption = document.querySelector('#ruleSelectFormJ option:checked');
      if (selectedRuleOption) {
        const ruleId = selectedRuleOption.dataset.ruleId;
        // Add file validation logic based on rule if needed
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    },
    
    submitRequest: function() {
      const validation = this.validate();
      
      if (!validation.valid) {
        validation.errors.forEach(error => {
          window.RequestFormCore.showError(error);
        });
        return;
      }
      
      const data = this.getData();
      
      // Add file uploads if any
      if (this.data.files.length > 0) {
        data.fileUploads = this.data.files;
      }
      
      window.RequestFormCore.sendMessageToParent({
        type: 'submit-request',
        requestType: 'formJ',
        data: data
      });
    },
    
    cancelRequest: function() {
      window.RequestFormCore.sendMessageToParent({
        type: 'cancel-request',
        requestType: 'formJ'
      });
    },
    
    handleMessage: function(message) {
      // Handle any specific messages for Form J
      switch (message.type) {
        case 'upload-progress':
          // Handle file upload progress if needed
          break;
        case 'upload-complete':
          // Handle upload completion
          break;
      }
    }
  };
  
  // Register the module when the core is available
  if (window.RequestFormCore) {
    window.RequestFormCore.registerRequestType('formJ', FormJ);
  } else {
    // Wait for core to be available
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('formJ', FormJ);
      }
    });
  }
  
})();
