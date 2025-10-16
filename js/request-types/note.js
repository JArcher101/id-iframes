/*
=====================================================================
NOTE REQUEST TYPE MODULE
=====================================================================
Note request requires:
- Standard 3 fields (work type, relation, matter description)
- Message input
- Optional file attachment

Sends request-data message to parent with:
- request: 'note'
- data: updated client-data object
- message: message object (same format as message-iframe.html)

If file present, follows message-iframe.html upload flow:
1. Send file-data to parent
2. Wait for put-links/put-error
3. Upload to S3
4. Send request-data with message + file metadata
=====================================================================
*/

(function() {
  'use strict';
  
  const Note = {
    // File upload state
    pendingFile: null,
    pendingMessage: null,
    uploadingFile: false,
    
    init: function(requestData) {
      console.log('📝 Initializing Note request');
      
      // Enable submit button (validation happens on submit)
      this.enableSubmitButton();
      
      // Setup file upload listener
      this.setupFileUploadListener();
      
      console.log('✅ Note request initialized');
    },
    
    enableSubmitButton: function() {
      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.disabled = false;
        console.log('✅ Submit button enabled for Note');
      }
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
      const messageObj = this.pendingMessage || this.createMessageObject();
      
      if (s3Key && this.pendingFile) {
        messageObj.file = {
          name: this.pendingFile.name,
          size: this.pendingFile.size,
          type: this.pendingFile.type,
          s3Key: s3Key
        };
      }
      
      const requestData = window.RequestFormCore.requestData;
      
      window.parent.postMessage({
        type: 'request-data',
        request: 'note',
        data: requestData,
        message: messageObj
      }, '*');
      
      this.uploadingFile = false;
      this.pendingFile = null;
      this.pendingMessage = null;
    },
    
    createMessageObject: function() {
      const messageInput = document.getElementById('messageInput');
      const userEmail = window.RequestFormCore.requestData.user || '';
      
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
        this.pendingMessage = this.createMessageObject();
        
        const fileName = `note-attachment-${Date.now()}-${file.name}`;
        const fileData = {
          type: 'Document',
          document: 'Note Attachment',
          uploader: window.RequestFormCore.requestData.user || '',
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
          _id: window.RequestFormCore.requestData._id || ''
        }, '*');
        
        return null;
      }
      
      this.sendRequestData();
      return null;
    },
    
    validate: function() {
      const errors = [];
      
      // Work Type (check both dropdown and input)
      const worktypeDropdown = document.getElementById('worktypeDropdown');
      const worktypeInput = document.getElementById('worktype');
      const workTypeValue = worktypeDropdown?.value || worktypeInput?.value?.trim();
      if (!workTypeValue) {
        errors.push('You must select or enter a Work Type');
      }
      
      // Relation (check both dropdown and input)
      const relationDropdown = document.getElementById('relationDropdown');
      const relationInput = document.getElementById('relation');
      const relationValue = relationDropdown?.value || relationInput?.value?.trim();
      if (!relationValue) {
        errors.push('You must select or enter a Relation');
      }
      
      // Matter Description
      const matterDescInput = document.getElementById('matterDescription');
      if (!matterDescInput?.value?.trim()) {
        errors.push('You must enter a Matter Description');
      }
      
      // Message
      const messageInput = document.getElementById('messageInput');
      if (!messageInput?.value?.trim()) {
        errors.push('You must enter a note message');
      }
      
      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  };
  
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
