/*
=====================================================================
NOTE REQUEST TYPE MODULE
=====================================================================
Simple note request that only requires a message input.
This demonstrates the flexibility of the modular system for different request types.
=====================================================================
*/

(function() {
  'use strict';
  
  const Note = {
    data: {
      message: '',
      priority: 'normal',
      category: ''
    },
    
    categories: [
      { value: '', label: 'Select category...' },
      { value: 'general', label: 'General Note' },
      { value: 'client', label: 'Client Information' },
      { value: 'matter', label: 'Matter Update' },
      { value: 'documentation', label: 'Documentation' },
      { value: 'followup', label: 'Follow-up Required' },
      { value: 'other', label: 'Other' }
    ],
    
    init: function(requestData) {
      this.data = {
        message: '',
        priority: 'normal',
        category: ''
      };
    },
    
    render: function() {
      return `
        <div class="request-section">
          <h4>Add Note</h4>
          <p class="section-description">Add a note or comment to this client/matter.</p>
          
          <!-- Category Selection -->
          <div class="row">
            <label for="categorySelect">Category</label>
            <select id="categorySelect" name="category">
              ${this.categories.map(cat => `
                <option value="${cat.value}">${cat.label}</option>
              `).join('')}
            </select>
          </div>
          
          <!-- Priority Selection -->
          <div class="row">
            <label for="prioritySelect">Priority</label>
            <select id="prioritySelect" name="priority">
              <option value="low">Low</option>
              <option value="normal" selected>Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          
          <!-- Note Message -->
          <div class="message-section">
            <label for="noteMessage" class="required">Note</label>
            <textarea id="noteMessage" name="message" placeholder="Enter your note here..." required></textarea>
          </div>
        </div>
        
        <div class="action-buttons">
          <button type="button" class="btn btn-secondary" id="cancelNote">Cancel</button>
          <button type="button" class="btn btn-primary" id="submitNote">Add Note</button>
        </div>
      `;
    },
    
    setupEventListeners: function() {
      const categorySelect = document.getElementById('categorySelect');
      const prioritySelect = document.getElementById('prioritySelect');
      const messageInput = document.getElementById('noteMessage');
      const submitBtn = document.getElementById('submitNote');
      const cancelBtn = document.getElementById('cancelNote');
      
      if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
          this.data.category = e.target.value;
        });
      }
      
      if (prioritySelect) {
        prioritySelect.addEventListener('change', (e) => {
          this.data.priority = e.target.value;
        });
      }
      
      if (messageInput) {
        messageInput.addEventListener('input', (e) => {
          this.data.message = e.target.value;
          this.updateValidationState();
        });
      }
      
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          this.submitNote();
        });
      }
      
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          this.cancelNote();
        });
      }
    },
    
    updateValidationState: function() {
      const submitBtn = document.getElementById('submitNote');
      if (submitBtn) {
        submitBtn.disabled = !this.data.message.trim();
      }
    },
    
    getData: function() {
      return {
        type: 'note',
        category: this.data.category,
        priority: this.data.priority,
        message: this.data.message,
        timestamp: new Date().toISOString()
      };
    },
    
    validate: function() {
      const errors = [];
      
      if (!this.data.message.trim()) {
        errors.push('Note message is required');
      }
      
      if (this.data.message.trim().length < 10) {
        errors.push('Note message must be at least 10 characters long');
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    },
    
    submitNote: function() {
      const validation = this.validate();
      
      if (!validation.valid) {
        validation.errors.forEach(error => {
          window.RequestFormCore.showError(error);
        });
        return;
      }
      
      const data = this.getData();
      
      window.RequestFormCore.sendMessageToParent({
        type: 'submit-request',
        requestType: 'note',
        data: data
      });
    },
    
    cancelNote: function() {
      window.RequestFormCore.sendMessageToParent({
        type: 'cancel-request',
        requestType: 'note'
      });
    },
    
    handleMessage: function(message) {
      // Handle any specific messages for Note type
      switch (message.type) {
        case 'note-saved':
          // Handle note saved confirmation
          break;
      }
    }
  };
  
  // Register the module
  if (window.RequestFormCore) {
    window.RequestFormCore.registerRequestType('note', Note);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.RequestFormCore) {
        window.RequestFormCore.registerRequestType('note', Note);
      }
    });
  }
  
})();
