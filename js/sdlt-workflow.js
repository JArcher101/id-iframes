/*
=====================================================================
SDLT WORKFLOW IFRAME - JAVASCRIPT SECTION
=====================================================================

PURPOSE:
This iframe provides staff workflow management for SDLT processing entries.
It dynamically determines available workflow actions based on:
- Current status array (e.g., "New Submission", "Calculating SDLT", etc.)
- Tracking booleans (sdltPaid, sdltCalculated, idCheckSent, etc.)
- Document presence (sdltCalculation, thsInvoice, sdlt5Certificate, etc.)

WORKFLOW APPROACH:
- Status and tracking booleans are automatically set in background (not user-selected)
- Workflow shows available actions (checkboxes, dates) based on current state
- Staff selections/answers determine updates applied to the entry
- Actions are dynamically generated - only shows what's relevant and available

PARENT-CHILD COMMUNICATION:
This iframe uses window.postMessage() to communicate with parent window.

SAVE/DATA FLOW:
- Parent handles all saving - no save buttons in iframe
- When any form input changes, iframe sends 'disable-close' message
- This disables the close button on parent page, forcing user to press Save
- When parent's Save button is pressed, parent sends 'save-data' message to iframe
- Iframe responds with 'save-data-response' containing current form data
- Document uploads will be handled before save-data-response (to be implemented)

INCOMING MESSAGES (from parent):
- entry-data: Full entry data from SDLTProcessing collection
  (used to determine current state and available actions)
- save-data: Parent requests current form data to save
- put-links: S3 upload URLs for document uploads
- put-error: Upload error response

OUTGOING MESSAGES (to parent):
- disable-close: Notifies parent that form has been modified (disables close button)
  Also sent on first-time opening (New Submission + thsNotification = true)
- dont-notify: Sent on first-time opening to prevent notification, also sent when requesting ID checks
- do-notify: Sent after calculation is generated and when marking ID checks as in progress
- request-checks: Sent when "Request ID Checks" button is clicked (no data)
- file-data: Request for S3 upload URLs (contains file metadata)
- save-data-response: Response to parent's save-data request (contains form data to save)
  Format: { type: 'save-data-response', updatedFields: [...], updates: {...}, status: [...], newMessage: '...' }
  Matches dwellworks-request-form.html pattern: updatedFields array, updates object (excludes status), status separate
- validation-error: Validation error before saving
  Format: { type: 'validation-error', message: 'Error message string' }
- upload-error: Error during file upload to S3
  Format: { type: 'upload-error', message: 'Error message string' }
- workflow-upload-success: Confirm successful document upload (for non-PDF uploads)
- workflow-ready: Notifies parent that iframe is ready to receive messages

INCOMING MESSAGES (from parent):
- entry-data: Full entry data from SDLTProcessing collection
- save-data: Parent requests current form data to save (iframe responds with save-data-response)
=====================================================================
*/

// Entry data state
let entryData = null;
let currentUser = null;
let originalEntryData = null; // Store original state to track changes
let pendingUpdates = null; // Unified object storing all pending field updates { status, thsNotification, sdltCalculated, etc. }
let pendingChatMessage = null; // Store pending chat message to be saved with calculation
let accountingFiles = {
    thsInvoice: null,
    sdltInvoice: null,
    completionStatement: null,
    sdlt5Certificate: null
}; // Track which accounting files are selected (File objects)

/**
 * Status constants - matches backend STATUS enum
 */
const STATUS = {
    // Initial states
    NEW_SUBMISSION: "New Submission",
    
    // Processing states
    SUBMISSION_UPDATED: "Submission Updated",
    SUBMISSION_RECEIVED: "Submission Received",
    SUBMISSION_RECEIVED_TYPO: "Submission Recieved", // Typo spelling (backward compatibility)
    CALCULATING_SDLT: "Calculating SDLT",
    ID_CHECKS_IN_PROGRESS: "ID Checks in Progress",
    GENERATING_INVOICES: "Generating Invoices",
    INVOICES_SENT: "Invoices Sent",
    PAYMENT_RECEIVED: "Payment Received",
    PAYMENT_RECEIVED_TYPO: "Payment Recieved", // Typo spelling (backward compatibility)
    
    // Final states
    NO_SDLT_DUE: "No SDLT Due",
    NO_SDLT_DUE_ALT: "No SDLT due", // Alternative casing
    SDLT_PAID: "SDLT Paid"
};

/**
 * Determine current workflow stage based on entry data
 * Uses entry data ONLY to determine stage and what actions are needed
 * Does NOT display all entry fields - only shows workflow-relevant actions
 * 
 * Priority: Status array values > Completion flags > Default
 */
function determineCurrentStage(entry) {
    if (!entry) return 'initial_review';
    
    const statusArray = entry.status || [];
    
    // Helper function to check if status array contains any of the given statuses
    const hasStatus = (...statuses) => {
        return statuses.some(status => statusArray.includes(status));
    };
    
    // Check status array first (most reliable indicator of current state)
    
    // Final states - check first
    if (hasStatus(STATUS.NO_SDLT_DUE, STATUS.NO_SDLT_DUE_ALT)) {
        return 'completion'; // No SDLT due = completed
    }
    
    if (hasStatus(STATUS.SDLT_PAID)) {
        return 'payment'; // SDLT has been paid
    }
    
    // Payment received
    if (hasStatus(STATUS.PAYMENT_RECEIVED, STATUS.PAYMENT_RECEIVED_TYPO)) {
        return 'payment';
    }
    
    // Invoicing stages
    if (hasStatus(STATUS.INVOICES_SENT)) {
        return 'invoicing';
    }
    
    if (hasStatus(STATUS.GENERATING_INVOICES)) {
        return 'invoicing';
    }
    
    // SDLT calculation in progress
    if (hasStatus(STATUS.CALCULATING_SDLT)) {
        return 'sdlt_preparation';
    }
    
    // ID checks in progress (still in initial review phase)
    if (hasStatus(STATUS.ID_CHECKS_IN_PROGRESS)) {
        return 'initial_review';
    }
    
    // Submission received/updated (still in initial review)
    if (hasStatus(STATUS.SUBMISSION_RECEIVED, STATUS.SUBMISSION_RECEIVED_TYPO, STATUS.SUBMISSION_UPDATED)) {
        return 'initial_review';
    }
    
    // Fallback to completion flags if status array doesn't indicate state
    if (entry.completionStatementSent) {
        return 'completion';
    }
    
    if (entry.sdltPaid) {
        return 'payment';
    }
    
    if (entry.feeInvoiceSent || entry.sdltInvoiceSent) {
        return 'invoicing';
    }
    
    if (entry.sdltCalculated || entry.sdlt5Uploaded) {
        return 'sdlt_preparation';
    }
    
    // Default: New Submission or no status = initial review
    if (hasStatus(STATUS.NEW_SUBMISSION) || statusArray.length === 0) {
        return 'initial_review';
    }
    
    // Default fallback
    return 'initial_review';
}

// Upload state
let uploadInProgress = false;
let pendingFiles = [];
let pendingPdfBlob = null; // Store PDF blob for SDLT calculation upload

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    initializeWorkflow();
});

function initializeWorkflow() {
    // Setup event listeners
    setupEventListeners();
    
    // Listen for parent messages
    window.addEventListener('message', handleParentMessage);
    
    // Render initial workflow state (will show default/empty state until entry data is received)
    if (entryData) {
        const currentStage = determineCurrentStage(entryData);
        renderWorkflowStage(currentStage);
    } else {
        // Show empty/default state
        const currentStageTitle = document.getElementById('currentStageTitle');
        const currentStageDescription = document.getElementById('currentStageDescription');
        if (currentStageTitle) currentStageTitle.textContent = 'Initial Review';
        if (currentStageDescription) currentStageDescription.textContent = 'Waiting for entry data...';
    }
    
    // Notify parent that iframe is ready
    notifyParentReady();
}

function setupEventListeners() {
    // TODO: Document upload event listeners (removed for now)
    // TODO: Staff notes event listeners (removed for now)
    
    // Info inputs (fee earner, client number, matter number)
    const feeEarner = document.getElementById('feeEarner');
    const clientNumber = document.getElementById('clientNumber');
    const matterNumber = document.getElementById('matterNumber');
    
    if (feeEarner) {
        feeEarner.addEventListener('change', handleInfoInputChange);
    }
    if (clientNumber) {
        clientNumber.addEventListener('change', handleInfoInputChange);
    }
    if (matterNumber) {
        matterNumber.addEventListener('change', handleInfoInputChange);
    }
    
    // Mark as Calculating SDLT button
    const markCalculatingSdltBtn = document.getElementById('markCalculatingSdltBtn');
    if (markCalculatingSdltBtn) {
        markCalculatingSdltBtn.addEventListener('click', handleMarkCalculatingSdlt);
    }
    
    // Open SDLT Calculator button
    const openSdltCalculatorBtn = document.getElementById('openSdltCalculatorBtn');
    if (openSdltCalculatorBtn) {
        openSdltCalculatorBtn.addEventListener('click', handleOpenSdltCalculator);
    }
    
    // Request ID Checks button
    const requestIdChecksBtn = document.getElementById('requestIdChecksBtn');
    if (requestIdChecksBtn) {
        requestIdChecksBtn.addEventListener('click', handleRequestIdChecks);
    }
    
    // Mark ID Checks as in Progress button
    const markIdChecksInProgressBtn = document.getElementById('markIdChecksInProgressBtn');
    if (markIdChecksInProgressBtn) {
        markIdChecksInProgressBtn.addEventListener('click', handleMarkIdChecksInProgress);
    }
    
    // ID Checks completion checkbox
    const confirmIdChecksCompleteCheckbox = document.getElementById('confirmIdChecksCompleteCheckbox');
    if (confirmIdChecksCompleteCheckbox) {
        confirmIdChecksCompleteCheckbox.addEventListener('change', function() {
            // Update display when checkbox is toggled (shows accounting info card if checked)
            updateIdChecksCompletionDisplay();
        });
    }
    
    // Accounting card file upload handlers
    setupAccountingFileUploads();
    
    // Invoice date input
    const invoiceDateInput = document.getElementById('invoiceDate');
    if (invoiceDateInput) {
        invoiceDateInput.addEventListener('change', function() {
            updateAccountingPendingUpdates();
        });
    }
    
    // Calculator overlay close buttons
    const closeCalculatorBtn = document.getElementById('closeCalculatorBtn');
    const cancelCalculatorBtn = document.getElementById('cancelCalculatorBtn');
    const generatePdfBtn = document.getElementById('generatePdfBtn');
    
    if (closeCalculatorBtn) {
        closeCalculatorBtn.addEventListener('click', () => closeSdltCalculator(false));
    }
    if (cancelCalculatorBtn) {
        cancelCalculatorBtn.addEventListener('click', () => closeSdltCalculator(false));
    }
    if (generatePdfBtn) {
        generatePdfBtn.addEventListener('click', () => closeSdltCalculator(true));
    }
    
    // Calculator form inputs - real-time calculation
    setupCalculatorEventListeners();
    
    // Load Mock Data button (for testing)
    const loadMockDataBtn = document.getElementById('loadMockDataBtn');
    if (loadMockDataBtn) {
        loadMockDataBtn.addEventListener('click', loadMockData);
    }
}

function handleParentMessage(event) {
    // TODO: Add origin validation in production
    // if (event.origin !== 'https://expected-domain.com') return;
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'entry-data':
                handleEntryData(event.data);
                break;
                
            case 'save-data':
                handleSaveData(event.data);
                break;
                
            case 'put-links':
                handlePutLinks(event.data);
                break;
                
            case 'put-error':
                handlePutError(event.data);
                break;
                
            default:
                console.log('Received message:', event.data);
                break;
        }
    }
}

function handleEntryData(message) {
    // Store entry data (used only for stage determination and action mapping)
    // We do NOT display all entry fields - only workflow-relevant actions
    entryData = message.data || {};
    originalEntryData = JSON.parse(JSON.stringify(entryData)); // Deep copy for change tracking
    currentUser = message.user || null;
    
    // Check if this is first-time opening (New Submission + thsNotification = true)
    const statusArray = entryData.status || [];
    const isNewSubmission = statusArray.includes(STATUS.NEW_SUBMISSION);
    const isFirstOpen = isNewSubmission && entryData.thsNotification === true;
    
    if (isFirstOpen) {
        // This is the first time the submission has been opened
        // Acknowledge by sending disable-close and dont-notify messages
        window.parent.postMessage({
            type: 'disable-close'
        }, '*');
        
        window.parent.postMessage({
            type: 'dont-notify'
        }, '*');
        
        // Hold pending update: status = ["Submission Received"] (array, correct spelling), thsNotification = false (boolean)
        pendingUpdates = {
            status: [STATUS.SUBMISSION_RECEIVED], // Array with correct spelling
            thsNotification: false // boolean
        };
    } else {
        // Clear any pending updates
        pendingUpdates = null;
    }
    
    // Update inputs
    updateInfoInputs();
    
    // Determine current stage based on entry status/completion flags
    const currentStage = determineCurrentStage(entryData);
    
    // Render only the workflow actions relevant to this stage
    renderWorkflowStage(currentStage);
}

/**
 * Notify parent that form has been modified - disable close button
 */
function notifyFormChanged() {
    if (!entryData) return;
    
    window.parent.postMessage({
        type: 'disable-close'
    }, '*');
}

/**
 * Handle save-data message from parent
 * Parent requests current form data to save
 * Format matches dwellworks-request-form.html: { updatedFields: [...], updates: {...}, status: [...] }
 */
function handleSaveData(message) {
    if (!entryData) {
        // Validation error: No entry data available
        window.parent.postMessage({
            type: 'validation-error',
            message: 'No entry data available'
        }, '*');
        return;
    }
    
    // Add any validation checks here
    // Example: if (someRequiredFieldMissing) {
    //     window.parent.postMessage({
    //         type: 'validation-error',
    //         message: 'Required field is missing'
    //     }, '*');
    //     return;
    // }
    
    // Check for accounting files
    const hasAccountingFiles = accountingFiles.thsInvoice || accountingFiles.sdltInvoice || accountingFiles.completionStatement;
    
    // Check if there are any files to upload (PDF blob, regular files, or accounting files)
    const hasPendingFiles = pendingPdfBlob || (pendingFiles && pendingFiles.length > 0) || hasAccountingFiles;
    
    if (hasPendingFiles) {
        // Create file metadata array for file-data message
        const fileMetadata = [];
        
        // Add PDF blob if present
        if (pendingPdfBlob) {
            fileMetadata.push({
                type: 'user',
                document: 'SDLT Calculation',
                uploader: currentUser || 'system',
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
                    type: 'application/pdf',
                    size: pendingPdfBlob.size,
                    name: 'SDLT Calculation.pdf',
                    lastModified: Date.now()
                },
                file: {}, // File object will be serialized to {} in postMessage (we'll use the blob directly for upload)
                isCalculation: true,
                fieldKey: 'sdltCalculation'
            });
        }
        
        // Add accounting files if present
        if (accountingFiles.thsInvoice) {
            fileMetadata.push({
                type: 'user',
                document: 'THS Invoice',
                uploader: currentUser || 'system',
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
                    type: 'application/pdf',
                    size: accountingFiles.thsInvoice.size,
                    name: accountingFiles.thsInvoice.name,
                    lastModified: accountingFiles.thsInvoice.lastModified || Date.now()
                },
                file: {},
                fieldKey: 'thsInvoice'
            });
        }
        
        if (accountingFiles.sdltInvoice) {
            fileMetadata.push({
                type: 'user',
                document: 'SDLT Invoice',
                uploader: currentUser || 'system',
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
                    type: 'application/pdf',
                    size: accountingFiles.sdltInvoice.size,
                    name: accountingFiles.sdltInvoice.name,
                    lastModified: accountingFiles.sdltInvoice.lastModified || Date.now()
                },
                file: {},
                fieldKey: 'sdltInvoice'
            });
        }
        
        if (accountingFiles.completionStatement) {
            fileMetadata.push({
                type: 'user',
                document: 'Completion Statement',
                uploader: currentUser || 'system',
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
                    type: 'application/pdf',
                    size: accountingFiles.completionStatement.size,
                    name: accountingFiles.completionStatement.name,
                    lastModified: accountingFiles.completionStatement.lastModified || Date.now()
                },
                file: {},
                fieldKey: 'completionStatement'
            });
        }
        
        // Add SDLT5 Certificate if present
        if (accountingFiles.sdlt5Certificate) {
            fileMetadata.push({
                type: 'user',
                document: 'SDLT5 Certificate',
                uploader: currentUser || 'system',
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
                    type: 'application/pdf',
                    size: accountingFiles.sdlt5Certificate.size,
                    name: accountingFiles.sdlt5Certificate.name,
                    lastModified: accountingFiles.sdlt5Certificate.lastModified || Date.now()
                },
                file: {},
                fieldKey: 'sdlt5Certificate'
            });
        }
        
        // Add regular files if present (for future workflow cards)
        if (pendingFiles && pendingFiles.length > 0) {
            pendingFiles.forEach(file => {
                fileMetadata.push({
                    type: 'user',
                    document: file.name || 'Document',
                    uploader: currentUser || 'system',
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
                        type: file.type || 'application/octet-stream',
                        size: file.size || 0,
                        name: file.name || 'Document',
                        lastModified: file.lastModified || Date.now()
                    },
                    file: {}
                });
            });
        }
        
        // Store blob/file references for upload (we'll use them when we get put-links)
        uploadInProgress = true;
        
        // Show upload progress overlay
        showUploadProgress(fileMetadata);
        
        // Send file-data message to parent
        window.parent.postMessage({
            type: 'file-data',
            files: fileMetadata,
            _id: entryData._id
        }, '*');
        
        // Don't return yet - wait for put-links response
        // The file upload will be handled in handlePutLinks
        return;
    }
    
    // If no pending updates, send empty response (should not happen, but handle gracefully)
    if (!pendingUpdates) {
        const response = {
            type: 'save-data-response',
            success: true
        };
        window.parent.postMessage(response, '*');
        return;
    }
    
    // Call sendSaveDataResponse to handle the response in unified format
    sendSaveDataResponse();
}

function updateInfoInputs() {
    if (!entryData) return;
    
    // Update fee earner dropdown
    const feeEarner = document.getElementById('feeEarner');
    if (feeEarner && entryData.fe) {
        feeEarner.value = entryData.fe;
    }
    
    // Update client number
    const clientNumber = document.getElementById('clientNumber');
    if (clientNumber && entryData.clientNumber !== undefined) {
        clientNumber.value = entryData.clientNumber;
    }
    
    // Update matter number
    const matterNumber = document.getElementById('matterNumber');
    if (matterNumber && entryData.matterNumber !== undefined) {
        matterNumber.value = entryData.matterNumber;
    }
}

function handleInfoInputChange() {
    if (!entryData) return;
    
    const feeEarner = document.getElementById('feeEarner');
    const clientNumber = document.getElementById('clientNumber');
    const matterNumber = document.getElementById('matterNumber');
    
    // Update entryData with new values
    if (feeEarner) {
        entryData.fe = feeEarner.value || '';
    }
    if (clientNumber) {
        entryData.clientNumber = clientNumber.value ? parseInt(clientNumber.value, 10) : null;
    }
    if (matterNumber) {
        entryData.matterNumber = matterNumber.value || '';
    }
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
}

function handlePutLinks(message) {
    if (!entryData || !uploadInProgress) return;
    
    // Extract data from message.data (put-links returns data object with links, s3Keys, and documents/images)
    const data = message.data || message;
    const links = data.links || [];
    const s3Keys = data.s3Keys || [];
    const documents = data.images || data.documents || []; // Array of updated documents with s3Keys added
    
    // Determine which files to upload
    // Need to match files with their metadata to get fieldKey
    let filesToUpload = [];
    const fileMetadataMap = new Map(); // Map to track fieldKey for each file
    
    // Build files array and map metadata
    if (pendingPdfBlob) {
        filesToUpload.push({
            file: pendingPdfBlob,
            name: 'SDLT Calculation.pdf',
            type: 'application/pdf',
            size: pendingPdfBlob.size,
            fieldKey: 'sdltCalculation'
        });
    }
    
    // Add accounting files
    if (accountingFiles.thsInvoice) {
        filesToUpload.push({
            file: accountingFiles.thsInvoice,
            name: accountingFiles.thsInvoice.name,
            type: accountingFiles.thsInvoice.type,
            size: accountingFiles.thsInvoice.size,
            fieldKey: 'thsInvoice'
        });
    }
    
    if (accountingFiles.sdltInvoice) {
        filesToUpload.push({
            file: accountingFiles.sdltInvoice,
            name: accountingFiles.sdltInvoice.name,
            type: accountingFiles.sdltInvoice.type,
            size: accountingFiles.sdltInvoice.size,
            fieldKey: 'sdltInvoice'
        });
    }
    
    if (accountingFiles.completionStatement) {
        filesToUpload.push({
            file: accountingFiles.completionStatement,
            name: accountingFiles.completionStatement.name,
            type: accountingFiles.completionStatement.type,
            size: accountingFiles.completionStatement.size,
            fieldKey: 'completionStatement'
        });
    }
    
    // Add regular files (for future workflow cards)
    if (pendingFiles && pendingFiles.length > 0) {
        pendingFiles.forEach(file => {
            filesToUpload.push({
                file: file,
                name: file.name,
                type: file.type,
                size: file.size
            });
        });
    }
    
    if (filesToUpload.length === 0) {
        return; // No files to upload
    }
    
    if (links.length !== filesToUpload.length || s3Keys.length !== filesToUpload.length || documents.length !== filesToUpload.length) {
        handlePutError({ message: 'Mismatch between files and upload links' });
        return;
    }
    
    // Extract actual File objects for upload (filesToUpload contains objects with .file property)
    const actualFiles = filesToUpload.map(item => item.file || item);
    
    // Upload files to S3
    uploadFilesToS3(actualFiles, links, s3Keys)
        .then(() => {
            console.log('✅ Documents uploaded successfully');
            
            // Hide upload progress overlay
            hideUploadProgress();
            
            // Initialize pendingUpdates if it doesn't exist
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            
            // Map documents to their field keys based on upload order
            let docIndex = 0;
            
            // SDLT calculation PDF (if present)
            if (pendingPdfBlob && documents[docIndex]) {
                pendingUpdates.sdltCalculation = documents[docIndex];
                docIndex++;
                pendingPdfBlob = null;
            }
            
            // Accounting files (match by order we uploaded them)
            if (accountingFiles.thsInvoice && documents[docIndex]) {
                pendingUpdates.thsInvoice = documents[docIndex];
                docIndex++;
                accountingFiles.thsInvoice = null;
            }
            
            if (accountingFiles.sdltInvoice && documents[docIndex]) {
                pendingUpdates.sdltInvoice = documents[docIndex];
                docIndex++;
                accountingFiles.sdltInvoice = null;
            }
            
            if (accountingFiles.completionStatement && documents[docIndex]) {
                pendingUpdates.completionStatement = documents[docIndex];
                docIndex++;
                accountingFiles.completionStatement = null;
            }
            
            if (accountingFiles.sdlt5Certificate && documents[docIndex]) {
                pendingUpdates.sdlt5Certificate = documents[docIndex];
                docIndex++;
                accountingFiles.sdlt5Certificate = null;
            }
            
            // Clear upload state
            uploadInProgress = false;
            pendingFiles = [];
            
            // Send save-data-response with all updates (including the files)
            sendSaveDataResponse();
        })
        .catch((error) => {
            console.error('❌ Upload failed:', error);
            
            // Hide upload progress overlay
            hideUploadProgress();
            
            // Send upload-error message to parent
            window.parent.postMessage({
                type: 'upload-error',
                message: error.message || 'Failed to upload file to S3'
            }, '*');
            
            // Reset upload state
            uploadInProgress = false;
            pendingFiles = [];
            pendingPdfBlob = null; // Clear pending PDF blob on error
            
            // Clear accounting files on error
            accountingFiles.thsInvoice = null;
            accountingFiles.sdltInvoice = null;
            accountingFiles.completionStatement = null;
            accountingFiles.sdlt5Certificate = null;
        });
}

function handlePutError(message) {
    console.error('❌ PUT error from parent:', message);
    
    const data = message.data || message;
    const errorMessage = data.message || data.error || 'Failed to generate upload links';
    
    // Hide upload progress overlay
    hideUploadProgress();
    
    // Send upload-error message to parent
    window.parent.postMessage({
        type: 'upload-error',
        message: errorMessage
    }, '*');
    
    // Reset upload state
    uploadInProgress = false;
    pendingFiles = [];
    pendingPdfBlob = null; // Clear pending PDF blob on error
}

/**
 * Send save-data-response with all current updates
 * Called after file upload completes
 * Format matches dwellworks-request-form.html: { updatedFields: [...], updates: {...}, status: [...] }
 */
function sendSaveDataResponse() {
    if (!entryData || !pendingUpdates) {
        console.error('Cannot send save-data-response: missing entryData or pendingUpdates');
        return;
    }
    
    // Build updatedFields array (field names that changed, excluding status)
    const updatedFields = Object.keys(pendingUpdates).filter(key => key !== 'status');
    
    // Build updates object (excludes status)
    const updates = {};
    Object.keys(pendingUpdates).forEach(key => {
        if (key !== 'status') {
            updates[key] = pendingUpdates[key];
        }
    });
    
    // Build response message
    const response = {
        type: 'save-data-response',
        success: true,
        updatedFields: updatedFields.length > 0 ? updatedFields : undefined,
        updates: Object.keys(updates).length > 0 ? updates : undefined,
        status: pendingUpdates.status || undefined,
        newMessage: pendingChatMessage || undefined
    };
    
    // Remove undefined fields
    if (!response.updatedFields) delete response.updatedFields;
    if (!response.updates) delete response.updates;
    if (!response.status) delete response.status;
    if (!response.newMessage) delete response.newMessage;
    
    console.log('📤 Sending save-data-response:', response);
    window.parent.postMessage(response, '*');
    
    // Update entryData with pending updates for local state
    Object.assign(entryData, pendingUpdates);
    
    // Clear pending updates after successful save
    pendingUpdates = null;
    pendingChatMessage = null;
    
    // Update original entry data after successful save
    originalEntryData = JSON.parse(JSON.stringify(entryData));
}

/**
 * Get available workflow actions dynamically based on entry state
 * Actions are determined by: status, tracking booleans, and document presence
 * Returns actions the staff can take to progress the workflow
 */
function getAvailableActions(entry) {
    if (!entry) return { checkboxes: [], dates: [], nextSteps: [] };
    
    const statusArray = entry.status || [];
    const hasStatus = (...statuses) => statuses.some(status => statusArray.includes(status));
    
    const actions = {
        checkboxes: [],
        dates: [],
        nextSteps: []
    };
    
    // Check document presence
    const hasSdltCalculation = !!(entry.sdltCalculation && entry.sdltCalculation.s3Key);
    const hasSdlt5Certificate = !!(entry.sdlt5Certificate && entry.sdlt5Certificate.s3Key);
    const hasThsInvoice = !!(entry.thsInvoice && entry.thsInvoice.s3Key);
    const hasSdltInvoice = !!(entry.sdltInvoice && entry.sdltInvoice.s3Key);
    
    // Initial Review / New Submission
    if (hasStatus(STATUS.NEW_SUBMISSION, STATUS.SUBMISSION_UPDATED, STATUS.SUBMISSION_RECEIVED, STATUS.SUBMISSION_RECEIVED_TYPO) || 
        (!entry.idCheckSent && !hasStatus(STATUS.CALCULATING_SDLT))) {
        
        if (!entry.idCheckSent) {
            actions.checkboxes.push({ field: 'idCheckSent', label: 'ID check sent' });
            actions.nextSteps.push({ label: 'Send ID check if needed' });
        }
    }
    
    // SDLT Calculation / Preparation
    if (hasStatus(STATUS.CALCULATING_SDLT) || 
        (entry.sdltCalculated && !entry.sdlt5Uploaded && !hasStatus(STATUS.GENERATING_INVOICES))) {
        
        if (!entry.sdltCalculated) {
            actions.checkboxes.push({ field: 'sdltCalculated', label: 'SDLT calculated' });
        }
        
        if (entry.sdltCalculated && !hasSdlt5Certificate) {
            actions.checkboxes.push({ field: 'sdlt5Uploaded', label: 'SDLT5 certificate uploaded' });
        }
        
        if (!entry.ukMoveInDate) {
            actions.dates.push({ field: 'ukMoveInDate', label: 'Move In Date' });
        }
        
        actions.nextSteps.push({ label: 'Calculate SDLT amount' });
        if (hasSdltCalculation) {
            actions.nextSteps.push({ label: 'SDLT calculation document uploaded' });
        } else {
            actions.nextSteps.push({ label: 'Upload SDLT calculation document' });
        }
    }
    
    // Invoicing
    if (hasStatus(STATUS.GENERATING_INVOICES, STATUS.INVOICES_SENT) ||
        (entry.sdltCalculated && !entry.sdltPaid && !hasStatus(STATUS.PAYMENT_RECEIVED, STATUS.PAYMENT_RECEIVED_TYPO))) {
        
        if (!entry.feeInvoiceSent) {
            actions.checkboxes.push({ field: 'feeInvoiceSent', label: 'THS fee invoice sent' });
        }
        
        if (!entry.sdltInvoiceSent) {
            actions.checkboxes.push({ field: 'sdltInvoiceSent', label: 'SDLT invoice sent' });
        }
        
        if ((entry.feeInvoiceSent || entry.sdltInvoiceSent) && !entry.invoiceDate) {
            actions.dates.push({ field: 'invoiceDate', label: 'Invoice Date' });
        }
        
        actions.nextSteps.push({ label: 'Send invoices to payees' });
        if (hasThsInvoice || hasSdltInvoice) {
            actions.nextSteps.push({ label: 'Invoice documents uploaded' });
        }
    }
    
    // Payment
    if (hasStatus(STATUS.PAYMENT_RECEIVED, STATUS.PAYMENT_RECEIVED_TYPO) ||
        (entry.feeInvoiceSent || entry.sdltInvoiceSent) && !entry.sdltPaid) {
        
        if (!entry.sdltPaid) {
            actions.checkboxes.push({ field: 'sdltPaid', label: 'SDLT paid' });
        }
        
        if (entry.sdltPaid && !entry.sdltPaid1) {
            actions.dates.push({ field: 'sdltPaid1', label: 'SDLT Paid Date' });
        }
        
        actions.nextSteps.push({ label: 'Confirm payment received' });
    }
    
    // Completion
    if (hasStatus(STATUS.SDLT_PAID, STATUS.NO_SDLT_DUE, STATUS.NO_SDLT_DUE_ALT) ||
        (entry.sdltPaid && !entry.completionStatementSent)) {
        
        if (!entry.completionStatementSent) {
            actions.checkboxes.push({ field: 'completionStatementSent', label: 'Completion statement sent' });
        }
        
        actions.nextSteps.push({ label: 'Send completion statement' });
    }
    
    // If no specific actions, show default next step
    if (actions.checkboxes.length === 0 && actions.dates.length === 0) {
        actions.nextSteps.push({ label: 'Review entry status' });
    }
    
    return actions;
}

/**
 * Get stage title and description based on entry state
 */
function getStageInfo(entry) {
    if (!entry) return { title: 'Initial Review', description: 'Loading...' };
    
    const statusArray = entry.status || [];
    const hasStatus = (...statuses) => statuses.some(status => statusArray.includes(status));
    
    if (hasStatus(STATUS.NO_SDLT_DUE, STATUS.NO_SDLT_DUE_ALT)) {
        return { title: 'Completion', description: 'No SDLT due - matter completed' };
    }
    
    if (hasStatus(STATUS.SDLT_PAID) || entry.sdltPaid) {
        return { title: 'Completion', description: 'SDLT paid - finalizing matter' };
    }
    
    if (hasStatus(STATUS.PAYMENT_RECEIVED, STATUS.PAYMENT_RECEIVED_TYPO) || entry.sdltPaid) {
        return { title: 'Payment', description: 'Payment received - awaiting completion' };
    }
    
    if (hasStatus(STATUS.INVOICES_SENT) || entry.feeInvoiceSent || entry.sdltInvoiceSent) {
        return { title: 'Payment', description: 'Invoices sent - awaiting payment' };
    }
    
    if (hasStatus(STATUS.GENERATING_INVOICES)) {
        return { title: 'Invoicing', description: 'Generating invoices' };
    }
    
    if (hasStatus(STATUS.CALCULATING_SDLT) || entry.sdltCalculated) {
        return { title: 'SDLT Preparation', description: 'Calculating SDLT and preparing return' };
    }
    
    if (hasStatus(STATUS.ID_CHECKS_IN_PROGRESS)) {
        return { title: 'Initial Review', description: 'ID checks in progress' };
    }
    
    return { title: 'Initial Review', description: 'Reviewing submission and verifying documents' };
}

/**
 * Render workflow stage - dynamically shows available actions based on entry state
 * Actions are determined by status, tracking booleans, and document presence
 * For now, only renders the current stage card (next steps, checkboxes, dates, documents, notes removed)
 */
function renderWorkflowStage(stageKey) {
    if (!entryData) {
        // If no entry data, just set default values
        const currentStageTitle = document.getElementById('currentStageTitle');
        const currentStageDescription = document.getElementById('currentStageDescription');
        if (currentStageTitle) currentStageTitle.textContent = 'Initial Review';
        if (currentStageDescription) currentStageDescription.textContent = 'Waiting for entry data...';
        
        // Hide buttons and cards
        const markCalculatingSdltBtn = document.getElementById('markCalculatingSdltBtn');
        if (markCalculatingSdltBtn) markCalculatingSdltBtn.classList.add('hidden');
        const calculatingSdltCard = document.getElementById('calculatingSdltCard');
        if (calculatingSdltCard) calculatingSdltCard.classList.add('hidden');
        return;
    }
    
    const stageInfo = getStageInfo(entryData);
    
    // Update current stage card (shows where we are in the workflow)
    const currentStageTitle = document.getElementById('currentStageTitle');
    const currentStageDescription = document.getElementById('currentStageDescription');
    
    if (currentStageTitle) currentStageTitle.textContent = stageInfo.title;
    if (currentStageDescription) currentStageDescription.textContent = stageInfo.description;
    
    // Show/hide "Mark as calculating SDLT" button based on current status
    // Button shows when status is "Submission Received" (either from pendingUpdates or saved entryData.status)
    const markCalculatingSdltBtn = document.getElementById('markCalculatingSdltBtn');
    if (markCalculatingSdltBtn) {
        const statusArray = entryData.status || [];
        const hasSubmissionReceived = statusArray.includes(STATUS.SUBMISSION_RECEIVED);
        const hasPendingSubmissionReceived = pendingUpdates && 
                                             pendingUpdates.status && 
                                             pendingUpdates.status.includes(STATUS.SUBMISSION_RECEIVED);
        
        // Show button if status is "Submission Received" (either pending or already saved)
        if (hasSubmissionReceived || hasPendingSubmissionReceived) {
            markCalculatingSdltBtn.classList.remove('hidden');
        } else {
            markCalculatingSdltBtn.classList.add('hidden');
        }
    }
    
    // Show/hide Calculating SDLT workflow card based on status
    // Card should be visible for both "Calculating SDLT" and "No SDLT Due" statuses
    const calculatingSdltCard = document.getElementById('calculatingSdltCard');
    if (calculatingSdltCard) {
        const statusArray = entryData.status || [];
        if (statusArray.includes(STATUS.CALCULATING_SDLT) || statusArray.includes(STATUS.NO_SDLT_DUE) || statusArray.includes(STATUS.NO_SDLT_DUE_ALT)) {
            calculatingSdltCard.classList.remove('hidden');
            // Update calculation result display (which also handles Request ID Checks button visibility)
            updateCalculationResultDisplay();
        } else {
            calculatingSdltCard.classList.add('hidden');
            // Hide all ID checks related elements when card is hidden
            const requestIdChecksBtn = document.getElementById('requestIdChecksBtn');
            if (requestIdChecksBtn) {
                requestIdChecksBtn.classList.add('hidden');
            }
            const idChecksRequestedHint = document.getElementById('idChecksRequestedHint');
            if (idChecksRequestedHint) {
                idChecksRequestedHint.classList.add('hidden');
            }
            const markIdChecksInProgressBtn = document.getElementById('markIdChecksInProgressBtn');
            if (markIdChecksInProgressBtn) {
                markIdChecksInProgressBtn.classList.add('hidden');
            }
            const saveToContinueHint = document.getElementById('saveToContinueHint');
            if (saveToContinueHint) {
                saveToContinueHint.classList.add('hidden');
            }
        }
    }
    
    // Check if status is "Generating Invoices" or "Invoices Sent" - show accounting card directly
    const statusArray = entryData?.status || [];
    if (statusArray.includes(STATUS.GENERATING_INVOICES) || statusArray.includes(STATUS.INVOICES_SENT)) {
        const accountingInfoCard = document.getElementById('accountingInfoCard');
        const idChecksCompletionCard = document.getElementById('idChecksCompletionCard');
        if (accountingInfoCard) {
            accountingInfoCard.classList.remove('hidden');
            renderAccountingInfoCard();
        }
        if (idChecksCompletionCard) {
            idChecksCompletionCard.classList.add('hidden');
        }
    } else {
        // Show/hide ID Checks Completion card and Accounting Information card
        // based on status and idEntries completion
        updateIdChecksCompletionDisplay();
    }
    
    // TODO: Add back next steps, checkboxes, dates, documents, notes as workflow is defined
}

/**
 * Handle "Mark as calculating SDLT" button click
 * Updates pending status from "Submission Received" to "Calculating SDLT"
 */
function handleMarkCalculatingSdlt() {
    if (!entryData) return;
    
    // Initialize pendingUpdates if it doesn't exist
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Update pending status to "Calculating SDLT"
    pendingUpdates.status = [STATUS.CALCULATING_SDLT];
    // Add dwellworksNotification = true to pending updates
    pendingUpdates.dwellworksNotification = true;
    
    // Update entryData status immediately for UI
    entryData.status = [STATUS.CALCULATING_SDLT];
    
    // Hide the button
    const markCalculatingSdltBtn = document.getElementById('markCalculatingSdltBtn');
    if (markCalculatingSdltBtn) {
        markCalculatingSdltBtn.classList.add('hidden');
    }
    
    // Update current stage card title to "Calculating SDLT"
    const currentStageTitle = document.getElementById('currentStageTitle');
    if (currentStageTitle) {
        currentStageTitle.textContent = 'Calculating SDLT';
    }
    
    // Update stage description
    const currentStageDescription = document.getElementById('currentStageDescription');
    if (currentStageDescription) {
        currentStageDescription.textContent = 'Calculating SDLT amount';
    }
    
    // Show the Calculating SDLT workflow card
    const calculatingSdltCard = document.getElementById('calculatingSdltCard');
    if (calculatingSdltCard) {
        calculatingSdltCard.classList.remove('hidden');
    }
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
}

/**
 * Handle "Open SDLT Calculator" button click
 * Opens calculator overlay
 */
function handleOpenSdltCalculator() {
    if (!entryData) return;
    
    const overlay = document.getElementById('sdltCalculatorOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        prePopulateCalculatorFields();
        performCalculation(); // Calculate with pre-populated data
    }
}

/**
 * Setup calculator form event listeners for real-time calculation
 */
function setupCalculatorEventListeners() {
    // Calculator inputs that trigger recalculation
    const calcInputs = [
        'calcEffectiveDate',
        'calcLeaseStartDate',
        'calcLeaseTerm',
        'calcAnnualRent',
        'calcRentFreePeriod',
        'calcPreviousNPV'
    ];
    
    calcInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', performCalculation);
            input.addEventListener('change', performCalculation);
        }
    });
    
    // Variation checkbox
    const calcIsVariation = document.getElementById('calcIsVariation');
    if (calcIsVariation) {
        calcIsVariation.addEventListener('change', function() {
            const variationFields = document.getElementById('calcVariationFields');
            if (variationFields) {
                if (this.checked) {
                    variationFields.classList.remove('hidden');
                } else {
                    variationFields.classList.add('hidden');
                }
            }
            performCalculation();
        });
    }
    
    // Stepped rent checkbox
    const calcUseSteppedRent = document.getElementById('calcUseSteppedRent');
    if (calcUseSteppedRent) {
        calcUseSteppedRent.addEventListener('change', function() {
            const steppedRentSection = document.getElementById('calcSteppedRentSection');
            if (steppedRentSection) {
                if (this.checked) {
                    steppedRentSection.classList.remove('hidden');
                    addSteppedRentRow(); // Add first row
                } else {
                    steppedRentSection.classList.add('hidden');
                }
            }
            performCalculation();
        });
    }
    
    // Add stepped rent row button
    const addSteppedRentRowBtn = document.getElementById('addSteppedRentRow');
    if (addSteppedRentRowBtn) {
        addSteppedRentRowBtn.addEventListener('click', addSteppedRentRow);
    }
}

/**
 * Parse Wix date string to YYYY-MM-DD format for HTML date inputs
 * Handles formats like "21 September 2025", "21/09/2025", "2025-09-21"
 */
function parseWixDate(dateString) {
    if (!dateString) return '';
    
    const dateStr = String(dateString).trim();
    
    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }
    
    // Try parsing as DD/MM/YYYY
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            // Validate year is 4 digits
            if (year.length === 4) {
                return `${year}-${month}-${day}`;
            } else if (year.length === 2) {
                // Assume 20XX for 2-digit years
                return `20${year}-${month}-${day}`;
            }
        }
    }
    
    // Try parsing as "DD Month YYYY" or "DD MMM YYYY" format (e.g., "21 September 2025", "21 Sep 2025")
    try {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    } catch (e) {
        // Parsing failed
    }
    
    return ''; // Return empty string if parsing fails
}

/**
 * Pre-populate calculator fields from entry data
 */
function prePopulateCalculatorFields() {
    if (!entryData) return;
    
    // Property address
    const calcPropertyAddress = document.getElementById('calcPropertyAddress');
    if (calcPropertyAddress && entryData.sdltAddress) {
        const addr = entryData.sdltAddress;
        const addressParts = [];
        if (addr.building_number) addressParts.push(addr.building_number);
        if (addr.building_name) addressParts.push(addr.building_name);
        if (addr.flat_number) addressParts.push('Flat ' + addr.flat_number);
        if (addr.street) addressParts.push(addr.street);
        if (addr.sub_street) addressParts.push(addr.sub_street);
        if (addr.town) addressParts.push(addr.town);
        if (addr.postcode) addressParts.push(addr.postcode);
        calcPropertyAddress.value = addressParts.join(', ');
    }
    
    // Case reference (fe/clientNumber/matterNumber or dwellworksRef)
    const calcCaseReference = document.getElementById('calcCaseReference');
    if (calcCaseReference) {
        let caseRef = '';
        if (entryData.fe && entryData.clientNumber && entryData.matterNumber) {
            caseRef = `${entryData.fe}/${entryData.clientNumber}/${entryData.matterNumber}`;
        } else if (entryData.dwellworksRef || entryData.dwellworksReference) {
            caseRef = entryData.dwellworksRef || entryData.dwellworksReference;
        }
        if (caseRef) {
            calcCaseReference.value = caseRef;
        }
    }
    
    // Lease start date (from ukMoveInDate) - convert formatted date to YYYY-MM-DD
    const calcLeaseStartDate = document.getElementById('calcLeaseStartDate');
    if (calcLeaseStartDate && entryData.ukMoveInDate) {
        const dateValue = parseWixDate(entryData.ukMoveInDate);
        if (dateValue) {
            calcLeaseStartDate.value = dateValue;
        }
    }
    
    // Effective date (only pre-populate if variation is checked, otherwise leave empty)
    // This will be shown/hidden based on variation checkbox state
    // Note: No default value - user must enter if variation is checked
    
    // Tenant type (map from lessee field - dropdown now has exact values)
    const calcTenantType = document.getElementById('calcTenantType');
    if (calcTenantType && entryData.lessee) {
        // Set value directly since dropdown options now match lessee values
        if (entryData.lessee === "The Tenant" || 
            entryData.lessee === "The Tenant's Employer" || 
            entryData.lessee === "Dwellworks" || 
            entryData.lessee === "Other") {
            calcTenantType.value = entryData.lessee;
        }
        
        // If case reference is empty and lessee is "The Tenant's Employer", try using tenantsEmployer name
        if (calcCaseReference && !calcCaseReference.value) {
            if (entryData.lessee === "The Tenant's Employer" && entryData.tenantsEmployer) {
                calcCaseReference.value = entryData.tenantsEmployer;
            } else if (entryData.lessee === 'Other' && entryData.lesseeOther) {
                calcCaseReference.value = entryData.lesseeOther;
            }
        }
    }
}

/**
 * Add a row to the stepped rent table
 */
function addSteppedRentRow() {
    const container = document.getElementById('calcSteppedRentRows');
    if (!container) return;
    
    const rowIndex = container.children.length;
    const row = document.createElement('div');
    row.className = 'stepped-rent-row';
    row.innerHTML = `
        <input type="number" class="calculator-input stepped-rent-start" placeholder="Year start" min="1" step="1" value="${rowIndex + 1}" />
        <input type="number" class="calculator-input stepped-rent-end" placeholder="Year end" min="1" step="1" value="${rowIndex + 1}" />
        <input type="number" class="calculator-input stepped-rent-amount" placeholder="Annual rent (£)" min="0" step="0.01" />
        <button type="button" class="remove-row-btn" onclick="removeSteppedRentRow(this)">Remove</button>
    `;
    
    container.appendChild(row);
    
    // Add event listeners for calculation
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('input', performCalculation);
        input.addEventListener('change', performCalculation);
    });
    
    performCalculation();
}

/**
 * Remove a stepped rent row
 */
function removeSteppedRentRow(button) {
    const row = button.closest('.stepped-rent-row');
    if (row) {
        row.remove();
        performCalculation();
    }
}

// Make function available globally for onclick handlers
window.removeSteppedRentRow = removeSteppedRentRow;

/**
 * Calculate NPV (Net Present Value) for the lease
 */
function calculateNPV(annualRent, leaseTerm, discountRate = 0.035, rentFreePeriod = 0, steppedRent = null) {
    let npv = 0;
    const rentFreeYears = rentFreePeriod / 12;
    
    if (steppedRent && steppedRent.length > 0) {
        // Use stepped rent schedule
        steppedRent.forEach(step => {
            const startYear = step.startYear;
            const endYear = step.endYear;
            const rent = step.rent;
            
            for (let year = startYear; year <= endYear; year++) {
                if (year <= rentFreeYears) continue; // Skip rent-free period
                npv += rent / Math.pow(1 + discountRate, year);
            }
        });
    } else {
        // Use constant annual rent
        for (let year = 1; year <= leaseTerm; year++) {
            if (year <= rentFreeYears) continue; // Skip rent-free period
            npv += annualRent / Math.pow(1 + discountRate, year);
        }
    }
    
    return npv;
}

/**
 * Generate lease extension notes for first-year leases
 * @param {number} leaseTerm - Lease term in years
 * @param {number} annualRent - Annual rent amount
 * @param {number} npv - Current Net Present Value
 * @param {number} threshold - SDLT threshold (default £125,000)
 * @param {number} sdltDue - SDLT due amount
 * @returns {string} HTML formatted notes
 */
function calculateExtensionNote(leaseTerm, annualRent, npv, threshold, sdltDue) {
    let notes = [];
    
    if (leaseTerm === 1) {
        if (sdltDue > 0) {
            // SDLT is payable - note that extensions will trigger additional SDLT
            notes.push("Note: This is a first-year lease. Any extensions to the lease term will likely trigger additional SDLT payable.");
        } else {
            // No SDLT currently due - calculate how long extension would be needed before SDLT becomes payable
            // Simplified calculation: estimate years needed to reach threshold
            const discountRate = 0.035;
            let extendedTerm = leaseTerm;
            let tempNPV = npv;
            
            // Add years until NPV exceeds threshold
            while (tempNPV <= threshold && extendedTerm < 100) {
                extendedTerm += 1;
                tempNPV += annualRent / Math.pow(1 + discountRate, extendedTerm);
            }
            
            if (extendedTerm > leaseTerm && annualRent > 0) {
                const yearsNeeded = extendedTerm - leaseTerm;
                notes.push(`Note: This is a first-year lease with no SDLT currently due. An extension of approximately ${yearsNeeded} year(s) would be required before SDLT becomes payable, assuming current annual rent and discount rate.`);
            } else if (annualRent > 0) {
                notes.push("Note: This is a first-year lease with no SDLT currently due. Extensions may trigger SDLT payable depending on future rent and term.");
            }
        }
    }
    
    return notes.map(note => `<p style="margin-top: 10px; font-style: italic; color: #555;">${note}</p>`).join('');
}

/**
 * Calculate SDLT due based on NPV
 * For variations: Only charges SDLT on the increase since last assessment
 * @param {number} npv - Current Net Present Value
 * @param {number} threshold - SDLT threshold (default £125,000)
 * @param {boolean} isVariation - Whether this is a lease variation
 * @param {number} previousNPV - Previously assessed NPV (only used if SDLT was already paid)
 * @returns {object} { sdltDue, explanation, threshold }
 */
function calculateSDLT(npv, threshold = 125000, isVariation = false, previousNPV = 0) {
    let sdltDue = 0;
    let explanation = '';
    
    if (isVariation && previousNPV > 0) {
        // Variation case: SDLT already paid on previous NPV
        // Only charge SDLT on the additional NPV (no threshold on additional amount)
        const additionalNPV = npv - previousNPV;
        if (additionalNPV > 0) {
            sdltDue = additionalNPV * 0.01;
            explanation = `Lease Variation: SDLT has previously been paid on this lease based on an NPV of £${previousNPV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. This calculation assesses additional SDLT payable on the increase in NPV of £${additionalNPV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        } else {
            explanation = `Lease Variation: No increase in NPV. No additional SDLT due.`;
        }
    } else if (isVariation && previousNPV === 0) {
        // Variation case: No SDLT previously paid (previous NPV was below threshold)
        // Calculate SDLT on total NPV, but explain it's a variation
        if (npv > threshold) {
            sdltDue = (npv - threshold) * 0.01;
            explanation = `Lease Variation: No SDLT had previously been payable in respect of this lease. This assessment represents the first occasion on which the Net Present Value exceeds the SDLT threshold. SDLT is payable on £${(npv - threshold).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`;
        } else {
            explanation = `Lease Variation: Net Present Value of £${npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remains below the SDLT threshold of £${threshold.toLocaleString('en-GB')}. No SDLT due at this time.`;
        }
    } else {
        // New lease calculation (not a variation)
        if (npv > threshold) {
            sdltDue = (npv - threshold) * 0.01;
            explanation = `Net Present Value of £${npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} exceeds the SDLT threshold of £${threshold.toLocaleString('en-GB')}. SDLT payable at 1% on amount above threshold.`;
        } else {
            explanation = `Net Present Value of £${npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is below the SDLT threshold of £${threshold.toLocaleString('en-GB')}. No SDLT due at this time.`;
        }
    }
    
    return {
        sdltDue: Math.round(sdltDue * 100) / 100, // Round to 2 decimal places
        explanation: explanation,
        threshold: threshold
    };
}

/**
 * Perform calculation and update results display
 */
function performCalculation() {
    // Get form values
    const leaseTerm = parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0;
    const annualRent = parseFloat(document.getElementById('calcAnnualRent')?.value) || 0;
    const rentFreePeriod = parseFloat(document.getElementById('calcRentFreePeriod')?.value) || 0;
    const isVariation = document.getElementById('calcIsVariation')?.checked || false;
    const previousNPV = parseFloat(document.getElementById('calcPreviousNPV')?.value) || 0;
    
    // Get stepped rent if enabled
    let steppedRent = null;
    const useSteppedRent = document.getElementById('calcUseSteppedRent')?.checked || false;
    if (useSteppedRent) {
        const rows = document.querySelectorAll('.stepped-rent-row');
        steppedRent = [];
        rows.forEach(row => {
            const startYear = parseFloat(row.querySelector('.stepped-rent-start')?.value) || 0;
            const endYear = parseFloat(row.querySelector('.stepped-rent-end')?.value) || 0;
            const rent = parseFloat(row.querySelector('.stepped-rent-amount')?.value) || 0;
            if (startYear > 0 && endYear > 0 && rent > 0) {
                steppedRent.push({ startYear, endYear, rent });
            }
        });
        if (steppedRent.length === 0) steppedRent = null;
    }
    
    // Validate inputs
    if (leaseTerm <= 0 || annualRent <= 0) {
        const resultsDiv = document.getElementById('calculatorResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p class="results-placeholder">Enter lease details above to see calculation results.</p>';
        }
        return;
    }
    
    // Calculate NPV
    const npv = calculateNPV(annualRent, leaseTerm, 0.035, rentFreePeriod, steppedRent);
    
    // Calculate SDLT
    const sdltResult = calculateSDLT(npv, 125000, isVariation, previousNPV);
    
    // Display results
    displayCalculationResults(npv, sdltResult);
}

/**
 * Display calculation results in the calculator
 */
function displayCalculationResults(npv, sdltResult) {
    const resultsDiv = document.getElementById('calculatorResults');
    if (!resultsDiv) return;
    
    const formattedNPV = npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedSDLT = sdltResult.sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    resultsDiv.innerHTML = `
        <div class="result-item">
            <div class="result-label">Net Present Value (NPV)</div>
            <div class="result-value">£${formattedNPV}</div>
        </div>
        <div class="result-item">
            <div class="result-label">SDLT Threshold</div>
            <div class="result-value">£${sdltResult.threshold.toLocaleString('en-GB')}</div>
        </div>
        <div class="result-item">
            <div class="result-label">SDLT Due</div>
            <div class="result-value">£${formattedSDLT}</div>
        </div>
        <div class="result-explanation">${sdltResult.explanation}</div>
    `;
}

/**
 * Close calculator overlay
 * @param {boolean} generatePDF - If true, generate PDF and store results
 */
async function closeSdltCalculator(generatePDF) {
    const overlay = document.getElementById('sdltCalculatorOverlay');
    if (!overlay) return;
    
    if (generatePDF) {
        // Validate required fields
        const leaseTerm = parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0;
        const annualRent = parseFloat(document.getElementById('calcAnnualRent')?.value) || 0;
        
        if (leaseTerm <= 0 || annualRent <= 0) {
            alert('Please enter valid lease term and annual rent before generating PDF.');
            return;
        }
        
        // Perform final calculation
        performCalculation();
        
        // Get calculation values
        const leaseTermFinal = parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0;
        const annualRentFinal = parseFloat(document.getElementById('calcAnnualRent')?.value) || 0;
        const rentFreePeriod = parseFloat(document.getElementById('calcRentFreePeriod')?.value) || 0;
        const isVariation = document.getElementById('calcIsVariation')?.checked || false;
        const previousNPV = parseFloat(document.getElementById('calcPreviousNPV')?.value) || 0;
        const propertyAddress = document.getElementById('calcPropertyAddress')?.value || '';
        
        // Case reference: use form value if provided, otherwise build from entry data (fe/clientNumber/matterNumber or dwellworksRef)
        let caseReference = document.getElementById('calcCaseReference')?.value || '';
        if (!caseReference) {
            if (entryData.fe && entryData.clientNumber && entryData.matterNumber) {
                caseReference = `${entryData.fe}/${entryData.clientNumber}/${entryData.matterNumber}`;
            } else if (entryData.dwellworksRef || entryData.dwellworksReference) {
                caseReference = entryData.dwellworksRef || entryData.dwellworksReference;
            }
        }
        
        const tenantType = document.getElementById('calcTenantType')?.value || 'The Tenant';
        
        // Effective date: For new leases = lease start date, for variations = variation date (date of variation)
        let effectiveDate = document.getElementById('calcEffectiveDate')?.value || '';
        const leaseStartDateForm = document.getElementById('calcLeaseStartDate')?.value || '';
        
        // If no effective date entered and it's not a variation, use lease start date
        if (!effectiveDate && !isVariation && leaseStartDateForm) {
            effectiveDate = leaseStartDateForm;
        }
        
        // Format effective date for PDF display
        let effectiveDateFormatted = '';
        if (effectiveDate) {
            const dateObj = new Date(effectiveDate);
            if (!isNaN(dateObj.getTime())) {
                effectiveDateFormatted = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            } else {
                effectiveDateFormatted = effectiveDate;
            }
        }
        
        // Get lease start date - use formatted date from entryData.ukMoveInDate if available, otherwise use form value
        let leaseStartDate = '';
        if (entryData.ukMoveInDate) {
            // Use the original formatted date string for PDF display (already formatted like "21 September 2025" or "21/09/2025")
            leaseStartDate = entryData.ukMoveInDate;
        } else if (leaseStartDateForm) {
            // Fallback to form value and format it
            const dateObj = new Date(leaseStartDateForm);
            if (!isNaN(dateObj.getTime())) {
                leaseStartDate = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            } else {
                leaseStartDate = leaseStartDateForm;
            }
        }
        
        // Get stepped rent if used
        let steppedRent = null;
        const useSteppedRent = document.getElementById('calcUseSteppedRent')?.checked || false;
        if (useSteppedRent) {
            const rows = document.querySelectorAll('.stepped-rent-row');
            steppedRent = [];
            rows.forEach(row => {
                const startYear = parseFloat(row.querySelector('.stepped-rent-start')?.value) || 0;
                const endYear = parseFloat(row.querySelector('.stepped-rent-end')?.value) || 0;
                const rent = parseFloat(row.querySelector('.stepped-rent-amount')?.value) || 0;
                if (startYear > 0 && endYear > 0 && rent > 0) {
                    steppedRent.push({ startYear, endYear, rent });
                }
            });
            if (steppedRent.length === 0) steppedRent = null;
        }
        
        // Calculate NPV and SDLT
        const npv = calculateNPV(annualRentFinal, leaseTermFinal, 0.035, rentFreePeriod, steppedRent);
        const sdltResult = calculateSDLT(npv, 125000, isVariation, previousNPV);
        
        // Calculate extension note (for first year leases)
        const extensionNote = calculateExtensionNote(
            leaseTermFinal,
            annualRentFinal,
            npv,
            125000,
            sdltResult.sdltDue
        );
        
        // Generate PDF
        try {
            const pdfBlob = await generateSdltCalculationPDF({
                caseReference,
                propertyAddress,
                tenantType,
                effectiveDate: effectiveDateFormatted || effectiveDate,
                leaseStartDate,
                leaseTerm: leaseTermFinal,
                annualRent: annualRentFinal,
                rentFreePeriod,
                isVariation,
                previousNPV,
                steppedRent,
                npv,
                sdltResult,
                extensionNote
            });
            
            // Initialize pendingUpdates if it doesn't exist
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            
            // Store calculation updates
            pendingUpdates.sdltCalculated = true;
            pendingUpdates.sdltRequired = sdltResult.sdltDue > 0;
            pendingUpdates.sdltDue = sdltResult.sdltDue;
            
            // Create pending chat message based on whether SDLT is due (just the message string - Velo will create the message object)
            const formattedAmount = sdltResult.sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (sdltResult.sdltDue > 0) {
                // SDLT is due
                pendingChatMessage = `I have calculated the SDLT due on this matter to be £${formattedAmount}. We will now proceed to opening a matter and completing the relevant checks.`;
            } else {
                // No SDLT due
                pendingChatMessage = `I have reviewed the provided details and calculated that no SDLT is due on this submission. Please Log into your account to view the calculation. No further action is required. Please let me know if you need any further support.`;
            }
            
            // Update status based on whether SDLT is due
            // Check sdltDue directly (sdltResult doesn't have sdltRequired property, only sdltDue, explanation, threshold)
            if (sdltResult.sdltDue === 0) {
                // No SDLT due - change status to "No SDLT Due"
                pendingUpdates.status = [STATUS.NO_SDLT_DUE];
                
                // Update entryData status immediately for UI
                entryData.status = pendingUpdates.status;
                
                // Update current stage card title and description
                const currentStageTitle = document.getElementById('currentStageTitle');
                const currentStageDescription = document.getElementById('currentStageDescription');
                if (currentStageTitle) {
                    currentStageTitle.textContent = 'No SDLT Due';
                }
                if (currentStageDescription) {
                    currentStageDescription.textContent = 'SDLT calculation complete - no tax due';
                }
                
                // Keep the Calculating SDLT workflow card visible (just hide the Request ID Checks button)
                // The updateCalculationResultDisplay() function will handle hiding the button
            }
            // If SDLT is due, status remains "Calculating SDLT" (no change needed)
            
            // Store PDF blob for upload
            pendingPdfBlob = pdfBlob;
            
            // Send do-notify message to parent (silently in background)
            window.parent.postMessage({
                type: 'do-notify'
            }, '*');
            
            // Download PDF directly (same approach as request-form.html)
            const propertyAddressPart = propertyAddress 
                ? propertyAddress.substring(0, 30).replace(/[^a-zA-Z0-9\s]/g, '_')
                : 'SDLT';
            const filename = `SDLT_Calculation_${propertyAddressPart}_${Date.now()}.pdf`;
            
            console.log('📥 Downloading PDF:', filename);
            downloadPDFBlob(pdfBlob, filename);
            
            // Update workflow card display
            updateCalculationResultDisplay();
            
            // Notify form changed
            notifyFormChanged();
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error generating PDF. Please try again.');
            return;
        }
    }
    
    // Close overlay
    overlay.classList.add('hidden');
}

/**
 * Build HTML template for SDLT calculation PDF
 */
function buildSdltCalculationPDFHTML(calculationData) {
    const calculationDate = new Date().toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const formattedNPV = calculationData.npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedSDLT = calculationData.sdltResult.sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedAnnualRent = calculationData.annualRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', Arial, sans-serif !important; 
                    padding: 12mm; 
                    margin: 0;
                    background: white; 
                    color: #111; 
                    line-height: 1.6; 
                    font-size: 14px; 
                }
                * {
                    font-family: 'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', Arial, sans-serif !important;
                }
                .pdf-header { border-bottom: 3px solid #003c71; padding-bottom: 24px; margin-bottom: 32px; page-break-after: avoid; }
                .section-title { font-size: 18px; font-weight: bold; color: #003c71; margin: 32px 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #dee2e6; page-break-after: avoid; }
                .pdf-footer { margin-top: 48px; padding-top: 24px; border-top: 2px solid #dee2e6; text-align: center; font-size: 11px; color: #999; line-height: 1.8; page-break-before: avoid; }
                .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 12px; margin-bottom: 16px; }
                .info-label { font-weight: bold; color: #6c757d; }
                .info-value { color: #333; }
                .result-box { background: #f8f9fa; border: 2px solid #003c71; border-radius: 8px; padding: 16px; margin: 20px 0; }
                .result-value { font-size: 24px; font-weight: bold; color: #003c71; margin-top: 8px; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <!-- PDF Header -->
            <div class="pdf-header">
                <div style="font-size: 28px; font-weight: bold; color: #003c71; margin-bottom: 20px;">
                    SDLT Calculation Report
                </div>
                <div class="info-grid">
                    <div class="info-label">Calculation Date:</div>
                    <div class="info-value">${calculationDate}</div>
                    ${calculationData.caseReference ? `
                    <div class="info-label">Case Reference:</div>
                    <div class="info-value">${escapeHtml(calculationData.caseReference)}</div>
                    ` : ''}
                    ${calculationData.propertyAddress ? `
                    <div class="info-label">Property Address:</div>
                    <div class="info-value">${escapeHtml(calculationData.propertyAddress)}</div>
                    ` : ''}
                </div>
            </div>
            
            <!-- Lease Details -->
            <div class="section-title">Lease Details</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 20px; font-size: 13px; line-height: 1.8;">
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Tenant Type:</span>
                    <span style="color: #333;">${calculationData.tenantType.charAt(0).toUpperCase() + calculationData.tenantType.slice(1)}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Effective Date:</span>
                    <span style="color: #333;">${calculationData.effectiveDate ? escapeHtml(calculationData.effectiveDate) : (calculationData.leaseStartDate ? escapeHtml(calculationData.leaseStartDate) : 'Not specified')}</span>
                </div>
                ${calculationData.leaseStartDate && calculationData.leaseStartDate !== calculationData.effectiveDate ? `
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Lease Start Date:</span>
                    <span style="color: #333;">${escapeHtml(calculationData.leaseStartDate)}</span>
                </div>
                ` : ''}
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Lease Term:</span>
                    <span style="color: #333;">${calculationData.leaseTerm} year${calculationData.leaseTerm !== 1 ? 's' : ''}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Annual Rent:</span>
                    <span style="color: #333;">£${formattedAnnualRent}</span>
                </div>
                ${calculationData.rentFreePeriod > 0 ? `
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Rent-Free Period:</span>
                    <span style="color: #333;">${calculationData.rentFreePeriod} month${calculationData.rentFreePeriod !== 1 ? 's' : ''}</span>
                </div>
                ` : ''}
                ${calculationData.isVariation ? `
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Type:</span>
                    <span style="color: #333;">Variation</span>
                </div>
                ${calculationData.previousNPV > 0 ? `
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Previous NPV:</span>
                    <span style="color: #333;">£${calculationData.previousNPV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                ` : ''}
                ` : ''}
            </div>
            
            ${calculationData.steppedRent && calculationData.steppedRent.length > 0 ? `
            <!-- Stepped Rent Schedule -->
            <div class="section-title">Stepped Rent Schedule</div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                    <tr style="background: #f5f5f5;">
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Year Start</th>
                        <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Year End</th>
                        <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Annual Rent</th>
                    </tr>
                </thead>
                <tbody>
                    ${calculationData.steppedRent.map(step => `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">${step.startYear}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${step.endYear}</td>
                        <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">£${step.rent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : ''}
            
            <!-- Calculation Results -->
            <div class="section-title">Calculation Results</div>
            <div class="info-grid">
                <div class="info-label">Net Present Value (NPV):</div>
                <div class="info-value">£${formattedNPV}</div>
                <div class="info-label">SDLT Threshold:</div>
                <div class="info-value">£${calculationData.sdltResult.threshold.toLocaleString('en-GB')}</div>
            </div>
            
            <div class="result-box">
                <div style="font-size: 16px; font-weight: bold; color: #003c71;">SDLT Due</div>
                <div class="result-value">£${formattedSDLT}</div>
            </div>
            
            <div style="background: #e8f4f8; border-left: 4px solid #003c71; border-radius: 4px; padding: 16px; margin-top: 20px; font-size: 13px; line-height: 1.6;">
                ${escapeHtml(calculationData.sdltResult.explanation)}
            </div>
            
            ${calculationData.isVariation ? `
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px; padding: 16px; margin-top: 20px; font-size: 13px; line-height: 1.6;">
                <p style="font-weight: bold; margin-bottom: 8px; color: #856404;">Lease Variation Notice:</p>
                ${calculationData.previousNPV > 0 ? `
                <p>SDLT has previously been paid on this lease based on a Net Present Value of £${calculationData.previousNPV.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>
                <p>This calculation assesses the additional SDLT payable as a result of a subsequent lease variation which increased the Net Present Value to £${calculationData.npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>
                <p>SDLT is payable only on the increase in value.</p>
                ` : `
                <p>No SDLT had previously been payable in respect of this lease.</p>
                <p>This assessment represents the first occasion on which the Net Present Value exceeds the SDLT threshold.</p>
                `}
            </div>
            ` : ''}
            
            ${calculationData.extensionNote ? `
            <!-- Additional Notes (for first-year leases) -->
            <div class="section-title">Additional Notes</div>
            <div style="background: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 4px; padding: 16px; margin-top: 20px; font-size: 13px; line-height: 1.6;">
                ${calculationData.extensionNote}
            </div>
            ` : ''}
            
            <!-- PDF Footer -->
            <div class="pdf-footer">
                <p>This calculation is based on current UK SDLT legislation for residential leases.</p>
                <p>NPV calculated using a 3.5% discount rate. SDLT rate: 1% on amount above £125,000 threshold.</p>
                <p>Generated on: ${calculationDate}</p>
                <p style="margin-top: 8px; font-style: italic;">This report is for informational purposes only. Verify all calculations with official HMRC guidance.</p>
            </div>
        </body>
        </html>
    `;
    
    return html;
}

/**
 * Generate SDLT Calculation PDF blob
 */
async function generateSdltCalculationPDF(calculationData) {
    if (typeof html2pdf === 'undefined') {
        throw new Error('PDF library not loaded. Please refresh the page.');
    }
    
    // Build HTML template
    const pdfHTML = buildSdltCalculationPDFHTML(calculationData);
    
    // Create element for html2pdf (do NOT add to document.body to avoid custom font inheritance!)
    const element = document.createElement('div');
    element.innerHTML = pdfHTML;
    
    // Configure html2pdf options (same as uk-sanctions-checker)
    const propertyAddressPart = calculationData.propertyAddress 
        ? calculationData.propertyAddress.substring(0, 30).replace(/[^a-zA-Z0-9\s]/g, '_')
        : 'SDLT';
    const options = {
        margin: [10, 10, 10, 10],
        filename: `SDLT_Calculation_${propertyAddressPart}_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            logging: false
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'css', avoid: '.result-box' }
    };
    
    // Generate PDF blob
    const pdfBlob = await html2pdf().set(options).from(element).outputPdf('blob');
    
    return pdfBlob;
}

/**
 * Download PDF blob with friendly filename (same as request-form.html)
 */
function downloadPDFBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Clean up blob URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Update calculation result display in workflow card
 */
function updateCalculationResultDisplay() {
    const openBtn = document.getElementById('openSdltCalculatorBtn');
    const resultDiv = document.getElementById('sdltCalculationResult');
    const generatedHint = document.getElementById('sdltCalculationGeneratedHint');
    const requestIdChecksBtn = document.getElementById('requestIdChecksBtn');
    const idChecksRequestedHint = document.getElementById('idChecksRequestedHint');
    const markIdChecksInProgressBtn = document.getElementById('markIdChecksInProgressBtn');
    
    if (!openBtn || !resultDiv || !generatedHint) return;
    
    // Determine what to show based on pending updates or entry data
    const sdltCalculated = pendingUpdates?.sdltCalculated || entryData?.sdltCalculated;
    const sdltDue = pendingUpdates?.sdltDue ?? entryData?.sdltDue ?? 0;
    const sdltRequired = pendingUpdates?.sdltRequired ?? entryData?.sdltRequired ?? false;
    // Check if calculation document exists (uploaded PDF from previous session)
    const hasSdltCalculation = !!(pendingUpdates?.sdltCalculation?.s3Key || entryData?.sdltCalculation?.s3Key);
    
    // Check current status to determine if we should show hint for "No SDLT Due" statuses
    const statusArray = entryData?.status || [];
    const isNoSdltDue = statusArray.includes(STATUS.NO_SDLT_DUE) || statusArray.includes(STATUS.NO_SDLT_DUE_ALT);
    const isCalculatingSdlt = statusArray.includes(STATUS.CALCULATING_SDLT);
    
    // Check if ID checks have been requested
    const idCheckSent = pendingUpdates?.idCheckSent ?? entryData?.idCheckSent ?? false;
    
    // Show hint and result if calculation has been done (either sdltCalculated flag OR document exists)
    // Also show hint for "No SDLT Due" status even if calculation flags aren't set
    if (sdltCalculated || hasSdltCalculation || isNoSdltDue) {
        // Keep button visible (users can edit/recalculate)
        openBtn.classList.remove('hidden');
        
        // Show calculation generated hint (PDF was generated/uploaded, or status indicates calculation done)
        generatedHint.classList.remove('hidden');
        
        // Show result text
        resultDiv.classList.remove('hidden');
        
        // Format result text
        if (sdltDue === 0) {
            resultDiv.textContent = 'SDLT Calculated - none due';
        } else {
            const formattedAmount = sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            resultDiv.textContent = `SDLT Calculated - £${formattedAmount}`;
        }
        
        // Handle ID checks button and hint visibility based on idCheckSent and sdltDue
        // Only show ID checks elements when status is "Calculating SDLT" and SDLT is due
        if (sdltDue > 0 && isCalculatingSdlt) {
            // SDLT is due and we're in the calculating SDLT stage
            if (idCheckSent) {
                // ID checks have been requested - hide "Request ID Checks" button, show hint and "Mark as in Progress" button
                if (requestIdChecksBtn) {
                    requestIdChecksBtn.classList.add('hidden');
                }
                if (idChecksRequestedHint) {
                    idChecksRequestedHint.classList.remove('hidden');
                }
                if (markIdChecksInProgressBtn) {
                    markIdChecksInProgressBtn.classList.remove('hidden');
                }
            } else {
                // ID checks not yet requested - show "Request ID Checks" button, hide hint and "Mark as in Progress" button
                if (requestIdChecksBtn) {
                    requestIdChecksBtn.classList.remove('hidden');
                }
                if (idChecksRequestedHint) {
                    idChecksRequestedHint.classList.add('hidden');
                }
        if (markIdChecksInProgressBtn) {
            markIdChecksInProgressBtn.classList.add('hidden');
        }
        const saveToContinueHint = document.getElementById('saveToContinueHint');
        if (saveToContinueHint) {
            saveToContinueHint.classList.add('hidden');
        }
    }
            if (requestIdChecksBtn) {
                requestIdChecksBtn.classList.add('hidden');
            }
            if (idChecksRequestedHint) {
                idChecksRequestedHint.classList.add('hidden');
            }
            if (markIdChecksInProgressBtn) {
                markIdChecksInProgressBtn.classList.add('hidden');
            }
            const saveToContinueHint = document.getElementById('saveToContinueHint');
            if (saveToContinueHint) {
                saveToContinueHint.classList.add('hidden');
            }
        }
    } else {
        // Show button, hide hint and result
        openBtn.classList.remove('hidden');
        generatedHint.classList.add('hidden');
        resultDiv.classList.add('hidden');
        // Hide all ID checks related elements until calculation is complete
        if (requestIdChecksBtn) {
            requestIdChecksBtn.classList.add('hidden');
        }
        if (idChecksRequestedHint) {
            idChecksRequestedHint.classList.add('hidden');
        }
        if (markIdChecksInProgressBtn) {
            markIdChecksInProgressBtn.classList.add('hidden');
        }
        const saveToContinueHint = document.getElementById('saveToContinueHint');
        if (saveToContinueHint) {
            saveToContinueHint.classList.add('hidden');
        }
    }
}

/**
 * Update ID Checks Completion display
 * Shows checkbox if any idEntries have status other than "Completed"
 * Shows accounting info card when all checks are completed or checkbox is checked
 */
function updateIdChecksCompletionDisplay() {
    const idChecksCompletionCard = document.getElementById('idChecksCompletionCard');
    const accountingInfoCard = document.getElementById('accountingInfoCard');
    const confirmIdChecksCompleteCheckbox = document.getElementById('confirmIdChecksCompleteCheckbox');
    
    if (!idChecksCompletionCard || !accountingInfoCard || !confirmIdChecksCompleteCheckbox) return;
    
    // Check if status is "ID Checks in Progress"
    const statusArray = entryData?.status || [];
    const isIdChecksInProgress = statusArray.includes(STATUS.ID_CHECKS_IN_PROGRESS);
    
    if (!isIdChecksInProgress) {
        // Hide both cards if not in ID Checks in Progress stage
        idChecksCompletionCard.classList.add('hidden');
        accountingInfoCard.classList.add('hidden');
        confirmIdChecksCompleteCheckbox.checked = false;
        return;
    }
    
    // Check idEntries array
    const idEntries = entryData?.idEntries || [];
    
    if (idEntries.length === 0) {
        // No idEntries - auto move on, show accounting info card
        idChecksCompletionCard.classList.add('hidden');
        accountingInfoCard.classList.remove('hidden');
        confirmIdChecksCompleteCheckbox.checked = false;
        
        // Initialize pendingUpdates if it doesn't exist
        if (!pendingUpdates) {
            pendingUpdates = {};
        }
        
        // Only update status if not already "Generating Invoices" or "Invoices Sent"
        const statusArray = entryData?.status || [];
        const isGeneratingInvoices = statusArray.includes(STATUS.GENERATING_INVOICES);
        const isInvoicesSent = statusArray.includes(STATUS.INVOICES_SENT);
        
        if (!isGeneratingInvoices && !isInvoicesSent) {
            // Update pending status to "Generating Invoices"
            pendingUpdates.status = [STATUS.GENERATING_INVOICES];
            
            // Send dont-notify and disable-close messages
            window.parent.postMessage({
                type: 'dont-notify'
            }, '*');
            
            window.parent.postMessage({
                type: 'disable-close'
            }, '*');
        }
        
        // Render accounting card content
        renderAccountingInfoCard();
        return;
    }
    
    // Check if all entries have status "Completed"
    const allCompleted = idEntries.every(entry => entry.status === 'Completed');
    
    // Check if checkbox is checked
    const checkboxChecked = confirmIdChecksCompleteCheckbox.checked;
    
    if (allCompleted || checkboxChecked) {
        // All completed or checkbox checked - show accounting info card, hide completion card
        idChecksCompletionCard.classList.add('hidden');
        accountingInfoCard.classList.remove('hidden');
        
        // Initialize pendingUpdates if it doesn't exist
        if (!pendingUpdates) {
            pendingUpdates = {};
        }
        
        // Only update status if not already "Generating Invoices" or "Invoices Sent"
        const statusArray = entryData?.status || [];
        const isGeneratingInvoices = statusArray.includes(STATUS.GENERATING_INVOICES);
        const isInvoicesSent = statusArray.includes(STATUS.INVOICES_SENT);
        
        if (!isGeneratingInvoices && !isInvoicesSent) {
            // Update pending status to "Generating Invoices"
            pendingUpdates.status = [STATUS.GENERATING_INVOICES];
            
            // Send dont-notify and disable-close messages
            window.parent.postMessage({
                type: 'dont-notify'
            }, '*');
            
            window.parent.postMessage({
                type: 'disable-close'
            }, '*');
        }
        
        // Render accounting card content
        renderAccountingInfoCard();
    } else {
        // Some entries not completed - show completion card with checkbox, hide accounting info card
        idChecksCompletionCard.classList.remove('hidden');
        accountingInfoCard.classList.add('hidden');
    }
}

/**
 * Hide multiple workflow cards by ID
 */
function hideWorkflowCards(cardIds) {
    cardIds.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.add('hidden');
        }
    });
}

/**
 * Check if all expected documents are present and show next workflow card if ready
 */
function checkAndShowNextWorkflowCard() {
    if (!entryData) return;
    
    const statusArray = entryData?.status || [];
    if (!statusArray.includes(STATUS.INVOICES_SENT)) return; // Only proceed if invoices are sent
    
    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    const samePayer = thsPayer === sdltPayer;
    
    // Determine which documents are expected
    const expectsThsInvoice = !!thsPayer;
    const expectsSdltInvoice = !!sdltPayer && !samePayer;
    const expectsCompletionStatement = !!sdltPayer;
    
    // Check which documents exist
    const hasThsInvoice = !!(entryData.thsInvoice && entryData.thsInvoice.s3Key);
    const hasSdltInvoice = !!(entryData.sdltInvoice && entryData.sdltInvoice.s3Key);
    const hasCompletionStatement = !!(entryData.completionStatement && entryData.completionStatement.s3Key);
    
    // Check if we have all expected documents
    const hasAllDocuments = 
        (!expectsThsInvoice || hasThsInvoice) &&
        (!expectsSdltInvoice || hasSdltInvoice) &&
        (!expectsCompletionStatement || hasCompletionStatement);
    
    if (hasAllDocuments) {
        // Show SDLT Payment card
        const sdltPaymentCard = document.getElementById('sdltPaymentCard');
        if (sdltPaymentCard) {
            sdltPaymentCard.classList.remove('hidden');
            setupSdltPaymentDate();
        }
    }
}

/**
 * Handle "Request ID Checks" button click
 * Adds idCheckSent to pending updates and sends messages to parent
 * UI will update when parent responds with new entry-data
 */
function handleRequestIdChecks() {
    if (!entryData) return;
    
    // Initialize pendingUpdates if it doesn't exist
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Add idCheckSent: true to pending updates
    pendingUpdates.idCheckSent = true;
    
    // Post dont-notify message to parent
    window.parent.postMessage({
        type: 'dont-notify'
    }, '*');
    
    // Post request-checks message to parent
    window.parent.postMessage({
        type: 'request-checks'
    }, '*');
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
    
    // Note: UI updates (hiding button, showing hint and "Mark as in Progress" button)
    // will happen when parent responds with new entry-data containing idCheckSent: true
}

/**
 * Handle "Mark ID Checks as in Progress" button click
 * Updates status to "ID Checks in Progress", sets pending chat message,
 * hides button and shows save hint
 */
function handleMarkIdChecksInProgress() {
    if (!entryData) return;
    
    // Initialize pendingUpdates if it doesn't exist
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Update pending status to "ID Checks in Progress"
    pendingUpdates.status = [STATUS.ID_CHECKS_IN_PROGRESS];
    
    // Set pending chat message
    pendingChatMessage = "I have initiated the required ID checks on this submission and we are awaiting a response from the client via the Thirdfort App.";
    
    // Hide the "Mark ID Checks as in Progress" button
    const markIdChecksInProgressBtn = document.getElementById('markIdChecksInProgressBtn');
    if (markIdChecksInProgressBtn) {
        markIdChecksInProgressBtn.classList.add('hidden');
    }
    
    // Show the "Please save the entry to continue" hint
    const saveToContinueHint = document.getElementById('saveToContinueHint');
    if (saveToContinueHint) {
        saveToContinueHint.classList.remove('hidden');
    }
    
    // Post do-notify message to parent
    window.parent.postMessage({
        type: 'do-notify'
    }, '*');
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
}

function renderNextSteps(nextSteps) {
    const nextStepsList = document.getElementById('nextStepsList');
    if (!nextStepsList) return;
    
    nextStepsList.innerHTML = '';
    
    nextSteps.forEach(step => {
        const item = document.createElement('div');
        item.className = 'next-step-item';
        item.innerHTML = `
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
            <span>${step.label}</span>
        `;
        nextStepsList.appendChild(item);
    });
}

function renderCheckboxes(checkboxDefinitions, entry) {
    const checkboxesContainer = document.getElementById('workflowCheckboxes');
    if (!checkboxesContainer) return;
    
    checkboxesContainer.innerHTML = '';
    
    if (!checkboxDefinitions || checkboxDefinitions.length === 0) {
        checkboxesContainer.innerHTML = '<div style="font-size: 0.75rem; color: #999; padding: 8px;">No actions for this stage</div>';
        return;
    }
    
    checkboxDefinitions.forEach(def => {
        const item = document.createElement('div');
        item.className = 'workflow-checkbox-item';
        
        const isChecked = entry && entry[def.field] === true;
        if (isChecked) {
            item.classList.add('checked');
        }
        
        // Make entire item clickable
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox' && e.target.tagName !== 'LABEL') {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    handleCheckboxChange(def.field, checkbox.checked);
                }
            }
        });
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = def.field;
        checkbox.checked = isChecked;
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            handleCheckboxChange(def.field, checkbox.checked);
        });
        
        const label = document.createElement('label');
        label.htmlFor = def.field;
        label.textContent = def.label;
        label.addEventListener('click', (e) => e.stopPropagation());
        
        item.appendChild(checkbox);
        item.appendChild(label);
        checkboxesContainer.appendChild(item);
    });
}

function renderDates(dateDefinitions, entry) {
    const datesContainer = document.getElementById('trackingDates');
    if (!datesContainer) return;
    
    datesContainer.innerHTML = '';
    
    if (!dateDefinitions || dateDefinitions.length === 0) {
        return;
    }
    
    dateDefinitions.forEach(def => {
        const dateField = document.createElement('div');
        dateField.className = 'date-field';
        
        const label = document.createElement('label');
        label.textContent = def.label;
        
        const input = document.createElement('input');
        input.type = 'date';
        input.id = def.field;
        
        // Get date value from entry, format if needed
        let dateValue = '';
        if (entry && entry[def.field]) {
            const dateStr = entry[def.field];
            // Handle ISO date strings or YYYY-MM-DD format
            if (dateStr.includes('T')) {
                dateValue = dateStr.split('T')[0];
            } else {
                dateValue = dateStr;
            }
        }
        input.value = dateValue;
        
        input.addEventListener('change', () => handleDateChange(def.field, input.value));
        
        dateField.appendChild(label);
        dateField.appendChild(input);
        datesContainer.appendChild(dateField);
    });
}

function renderStaffDocuments() {
    const documentsList = document.getElementById('staffDocumentsList');
    if (!documentsList) return;
    
    documentsList.innerHTML = '';
    
    if (!entryData) {
        documentsList.innerHTML = '<div style="font-size: 0.75rem; color: #999; padding: 8px;">No entry data loaded</div>';
        return;
    }
    
    // Get staff documents (separate from user-uploaded supportingDocuments)
    const staffDocs = [];
    
    // SDLT Calculation document
    if (entryData.sdltCalculation && entryData.sdltCalculation.s3Key) {
        staffDocs.push({
            field: 'sdltCalculation',
            name: entryData.sdltCalculation.description || 'SDLT Calculation',
            s3Key: entryData.sdltCalculation.s3Key
        });
    }
    
    // THS Invoice
    if (entryData.thsInvoice && entryData.thsInvoice.s3Key) {
        staffDocs.push({
            field: 'thsInvoice',
            name: entryData.thsInvoice.description || 'THS Invoice',
            s3Key: entryData.thsInvoice.s3Key
        });
    }
    
    // SDLT Invoice
    if (entryData.sdltInvoice && entryData.sdltInvoice.s3Key) {
        staffDocs.push({
            field: 'sdltInvoice',
            name: entryData.sdltInvoice.description || 'SDLT Invoice',
            s3Key: entryData.sdltInvoice.s3Key
        });
    }
    
    // SDLT5 Certificate
    if (entryData.sdlt5Certificate && entryData.sdlt5Certificate.s3Key) {
        staffDocs.push({
            field: 'sdlt5Certificate',
            name: entryData.sdlt5Certificate.description || 'SDLT5 Certificate',
            s3Key: entryData.sdlt5Certificate.s3Key
        });
    }
    
    // Completion Statement
    if (entryData.completionStatement && entryData.completionStatement.s3Key) {
        staffDocs.push({
            field: 'completionStatement',
            name: entryData.completionStatement.description || 'Completion Statement',
            s3Key: entryData.completionStatement.s3Key
        });
    }
    
    if (staffDocs.length === 0) {
        documentsList.innerHTML = '<div style="font-size: 0.75rem; color: #999; padding: 8px;">No staff documents uploaded</div>';
        return;
    }
    
    staffDocs.forEach((doc) => {
        const item = document.createElement('div');
        item.className = 'document-item';
        
        const name = document.createElement('span');
        name.className = 'document-name';
        name.textContent = doc.name;
        
        // Note: Staff documents shouldn't be removable through this interface
        // They are managed through specific workflow actions
        
        item.appendChild(name);
        documentsList.appendChild(item);
    });
}

function handleCheckboxChange(field, checked) {
    if (!entryData) return;
    
    // Update entry data
    entryData[field] = checked;
    
    // Update UI
    const item = document.querySelector(`#${field}`)?.closest('.workflow-checkbox-item');
    if (item) {
        if (checked) {
            item.classList.add('checked');
        } else {
            item.classList.remove('checked');
        }
    }
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
    
    // Re-render stage to reflect changes
    const currentStage = determineCurrentStage(entryData);
    renderWorkflowStage(currentStage);
}

function handleDateChange(field, value) {
    if (!entryData) return;
    
    // Update entry data
    entryData[field] = value;
    
    // Notify parent that form has changed (disable close button)
    notifyFormChanged();
}

function handleNotesChange() {
    if (!entryData) return;
    
    const staffNotes = document.getElementById('staffNotes');
    if (staffNotes) {
        entryData.note = staffNotes.value;
        
        // Notify parent that form has changed (disable close button)
        notifyFormChanged();
    }
}

function handleRemoveDocument(index) {
    // Note: Staff documents are managed through specific workflow actions
    // This function is kept for potential future use
    console.log('Document removal requested for index:', index);
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

function handleFiles(files) {
    if (uploadInProgress) {
        console.log('Upload already in progress');
        return;
    }
    
    if (files.length === 0 || !entryData) return;
    
    // Notify parent that form has changed (documents selected for upload)
    notifyFormChanged();
    
    // Add to pending files
    pendingFiles = files;
    uploadInProgress = true;
    
    // Request upload URLs from parent
    const fileMetadata = files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified
    }));
    
    window.parent.postMessage({
        type: 'workflow-document-upload',
        files: fileMetadata,
        _id: entryData._id
    }, '*');
}

async function uploadFilesToS3(files, links, s3Keys) {
    const uploadPromises = files.map((fileItem, index) => {
        return new Promise((resolve, reject) => {
            // Get the actual file/blob - could be fileItem.file (for blob) or fileItem itself (for File objects)
            const fileBlob = fileItem.file || fileItem;
            const fileType = fileItem.type || 'application/pdf';
            
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', links[index]);
            xhr.setRequestHeader('Content-Type', fileType);
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve(s3Keys[index]);
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('Upload failed'));
            };
            
            xhr.send(fileBlob);
        });
    });
    
    return Promise.all(uploadPromises);
}

/**
 * Show upload progress overlay
 */
function showUploadProgress(fileMetadata) {
    // Remove existing overlay if present
    const existing = document.getElementById('uploadProgressContainer');
    if (existing) existing.remove();
    
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
    fileMetadata.forEach((fileData, index) => {
        const fileName = fileData.data?.name || fileData.document || 'Unknown file';
        const fileSize = ((fileData.data?.size || 0) / 1024 / 1024).toFixed(2);
        
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
 * Hide upload progress overlay
 */
function hideUploadProgress() {
    const uploadContainer = document.getElementById('uploadProgressContainer');
    if (uploadContainer) {
        uploadContainer.remove();
    }
}

/**
 * Update upload progress UI
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
 * NOTE: Parent handles saving via save-data message
 * This function is kept for reference but is no longer called
 * Data is sent to parent via save-data-response when parent requests it
 */
function sendWorkflowUpdate() {
    // Deprecated - parent now handles saving via save-data message
    // Data is returned via handleSaveData() function
}

function notifyParentReady() {
    window.parent.postMessage({
        type: 'workflow-ready'
    }, '*');
}

/**
 * Render Accounting Information Card
 * Displays payer information, contact details, and file uploaders
 */
function renderAccountingInfoCard() {
    if (!entryData) return;
    
    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    
    // Set invoice date to today if not set
    const invoiceDateInput = document.getElementById('invoiceDate');
    if (invoiceDateInput && !invoiceDateInput.value) {
        const today = new Date().toISOString().split('T')[0];
        invoiceDateInput.value = today;
    }
    
    // Show/hide hint about sending invoice directly
    const sendInvoiceDirectlyHint = document.getElementById('sendInvoiceDirectlyHint');
    if (sendInvoiceDirectlyHint) {
        const shouldShowHint = entryData.sdltFeeInvoiceSending === true || entryData.thsFeesInvoiceSending === true;
        if (shouldShowHint) {
            sendInvoiceDirectlyHint.classList.remove('hidden');
        } else {
            sendInvoiceDirectlyHint.classList.add('hidden');
        }
    }
    
    // Render THS payer information
    renderPayerInfo('thsPayerInfo', thsPayer, 'ths');
    
    // Render SDLT payer information (if different from THS payer)
    const sdltPayerSection = document.getElementById('sdltPayerSection');
    if (sdltPayerSection) {
        if (thsPayer !== sdltPayer) {
            sdltPayerSection.classList.remove('hidden');
            renderPayerInfo('sdltPayerInfo', sdltPayer, 'sdlt');
        } else {
            sdltPayerSection.classList.add('hidden');
        }
    }
    
    // Completion statement section is always shown if SDLT payer exists
    const completionStatementSection = document.getElementById('completionStatementSection');
    if (completionStatementSection && sdltPayer) {
        completionStatementSection.classList.remove('hidden');
    } else if (completionStatementSection) {
        completionStatementSection.classList.add('hidden');
    }
    
    // Render document cards for already-uploaded documents and show/hide uploaders accordingly
    renderAccountingDocumentCards();
}

/**
 * Render document cards for already-uploaded accounting documents
 * Shows document cards for existing files, uploaders for missing/overwrites
 */
function renderAccountingDocumentCards() {
    if (!entryData) return;
    
    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    const samePayer = thsPayer === sdltPayer;
    
    // Determine which documents are expected
    const expectsThsInvoice = !!thsPayer;
    const expectsSdltInvoice = !!sdltPayer && !samePayer;
    const expectsCompletionStatement = !!sdltPayer;
    
    // Check which documents exist
    const hasThsInvoice = !!(entryData.thsInvoice && entryData.thsInvoice.s3Key);
    const hasSdltInvoice = !!(entryData.sdltInvoice && entryData.sdltInvoice.s3Key);
    const hasCompletionStatement = !!(entryData.completionStatement && entryData.completionStatement.s3Key);
    
    // THS Invoice
    const thsInvoiceDocumentCard = document.getElementById('thsInvoiceDocumentCard');
    const thsInvoiceUploadSection = document.querySelector('#thsInvoiceUpload')?.closest('.file-upload-section');
    
    if (expectsThsInvoice) {
        if (hasThsInvoice) {
            // Show document card
            if (thsInvoiceDocumentCard) {
                thsInvoiceDocumentCard.classList.remove('hidden');
                thsInvoiceDocumentCard.innerHTML = `
                    <div class="document-card-header">
                        <span class="document-card-title">THS Invoice (Uploaded)</span>
                        <div class="document-card-actions">
                            <a href="${entryData.thsInvoice.liveUrl || entryData.thsInvoice.url}" target="_blank" class="document-card-link">View</a>
                            <button type="button" class="document-card-btn overwrite-btn" data-field="thsInvoice">Overwrite</button>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${entryData.thsInvoice.description || 'THS Invoice'}
                    </div>
                `;
                
                // Add click handler for overwrite button
                const overwriteBtn = thsInvoiceDocumentCard.querySelector('.overwrite-btn');
                if (overwriteBtn) {
                    overwriteBtn.addEventListener('click', function() {
                        thsInvoiceDocumentCard.classList.add('hidden');
                        if (thsInvoiceUploadSection) {
                            thsInvoiceUploadSection.style.display = 'block';
                        }
                        const input = document.getElementById('thsInvoiceFileInput');
                        if (input) input.click();
                    });
                }
            }
            // Hide uploader (can be shown via overwrite button)
            if (thsInvoiceUploadSection && !accountingFiles.thsInvoice) {
                thsInvoiceUploadSection.style.display = 'none';
            }
        } else {
            // Hide document card, show uploader
            if (thsInvoiceDocumentCard) thsInvoiceDocumentCard.classList.add('hidden');
            if (thsInvoiceUploadSection) thsInvoiceUploadSection.style.display = 'block';
        }
    }
    
    // SDLT Invoice (only if different payer)
    if (expectsSdltInvoice) {
        const sdltInvoiceDocumentCard = document.getElementById('sdltInvoiceDocumentCard');
        const sdltInvoiceUploadSection = document.querySelector('#sdltInvoiceUpload')?.closest('.file-upload-section');
        
        if (hasSdltInvoice) {
            if (sdltInvoiceDocumentCard) {
                sdltInvoiceDocumentCard.classList.remove('hidden');
                sdltInvoiceDocumentCard.innerHTML = `
                    <div class="document-card-header">
                        <span class="document-card-title">SDLT Invoice (Uploaded)</span>
                        <div class="document-card-actions">
                            <a href="${entryData.sdltInvoice.liveUrl || entryData.sdltInvoice.url}" target="_blank" class="document-card-link">View</a>
                            <button type="button" class="document-card-btn overwrite-btn" data-field="sdltInvoice">Overwrite</button>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${entryData.sdltInvoice.description || 'SDLT Invoice'}
                    </div>
                `;
                
                const overwriteBtn = sdltInvoiceDocumentCard.querySelector('.overwrite-btn');
                if (overwriteBtn) {
                    overwriteBtn.addEventListener('click', function() {
                        sdltInvoiceDocumentCard.classList.add('hidden');
                        if (sdltInvoiceUploadSection) {
                            sdltInvoiceUploadSection.style.display = 'block';
                        }
                        const input = document.getElementById('sdltInvoiceFileInput');
                        if (input) input.click();
                    });
                }
            }
            if (sdltInvoiceUploadSection && !accountingFiles.sdltInvoice) {
                sdltInvoiceUploadSection.style.display = 'none';
            }
        } else {
            if (sdltInvoiceDocumentCard) sdltInvoiceDocumentCard.classList.add('hidden');
            if (sdltInvoiceUploadSection) sdltInvoiceUploadSection.style.display = 'block';
        }
    }
    
    // Completion Statement
    if (expectsCompletionStatement) {
        const completionStatementDocumentCard = document.getElementById('completionStatementDocumentCard');
        const completionStatementUploadSection = document.querySelector('#completionStatementUpload')?.closest('.file-upload-section');
        
        if (hasCompletionStatement) {
            if (completionStatementDocumentCard) {
                completionStatementDocumentCard.classList.remove('hidden');
                completionStatementDocumentCard.innerHTML = `
                    <div class="document-card-header">
                        <span class="document-card-title">Completion Statement (Uploaded)</span>
                        <div class="document-card-actions">
                            <a href="${entryData.completionStatement.liveUrl || entryData.completionStatement.url}" target="_blank" class="document-card-link">View</a>
                            <button type="button" class="document-card-btn overwrite-btn" data-field="completionStatement">Overwrite</button>
                        </div>
                    </div>
                    <div style="font-size: 0.8rem; color: #666;">
                        ${entryData.completionStatement.description || 'Completion Statement'}
                    </div>
                `;
                
                const overwriteBtn = completionStatementDocumentCard.querySelector('.overwrite-btn');
                if (overwriteBtn) {
                    overwriteBtn.addEventListener('click', function() {
                        completionStatementDocumentCard.classList.add('hidden');
                        if (completionStatementUploadSection) {
                            completionStatementUploadSection.style.display = 'block';
                        }
                        const input = document.getElementById('completionStatementFileInput');
                        if (input) input.click();
                    });
                }
            }
            if (completionStatementUploadSection && !accountingFiles.completionStatement) {
                completionStatementUploadSection.style.display = 'none';
            }
        } else {
            if (completionStatementDocumentCard) completionStatementDocumentCard.classList.add('hidden');
            if (completionStatementUploadSection) completionStatementUploadSection.style.display = 'block';
        }
    }
}

/**
 * Render payer information section
 */
function renderPayerInfo(containerId, payer, prefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!payer) {
        container.innerHTML = '<div class="payer-info-item">No payer specified</div>';
        return;
    }
    
    let html = '';
    
    // Payer name/type
    html += `<div class="payer-info-item"><span class="payer-info-label">Payer:</span><span class="payer-info-value">${escapeHtml(payer)}</span></div>`;
    
    // If "Other", show relation and name
    if (payer === 'Other') {
        const relationField = prefix === 'ths' ? 'thsFeePayerRelationToTenant' : 'sdltFeePayerRelationToTenant';
        const otherField = prefix === 'ths' ? 'thsFeePayerOther' : 'sdltFeePayerOther';
        
        if (entryData[relationField]) {
            html += `<div class="payer-info-item"><span class="payer-info-label">Relation to Tenant:</span><span class="payer-info-value">${escapeHtml(entryData[relationField])}</span></div>`;
        }
        if (entryData[otherField]) {
            html += `<div class="payer-info-item"><span class="payer-info-label">Name:</span><span class="payer-info-value">${escapeHtml(entryData[otherField])}</span></div>`;
        }
    }
    
    // Contact information
    const emailField = prefix === 'ths' ? 'thsFeePayerEmail' : 'sdltFeePayerEmail';
    const phoneField = prefix === 'ths' ? 'thsFeePayerPhoneNumber' : 'sdltFeePayerPhone';
    
    if (entryData[emailField]) {
        html += `<div class="payer-info-item"><span class="payer-info-label">Email:</span><span class="payer-info-value">${escapeHtml(entryData[emailField])}</span></div>`;
    }
    if (entryData[phoneField]) {
        html += `<div class="payer-info-item"><span class="payer-info-label">Phone:</span><span class="payer-info-value">${escapeHtml(entryData[phoneField])}</span></div>`;
    }
    
    // Employer account contact information (if employer)
    if (payer === "The Tenant's Employer") {
        const useThsFields = prefix === 'ths' || (prefix === 'sdlt' && entryData.sdltFeeEmployerDetailsMatchThsLlpFeePayer === true);
        const nameField = useThsFields ? 'thsFeeEmployersAccountsContactName' : 'sdltFeeEmployersAccountsContactName';
        const emailFieldEmp = useThsFields ? 'thsFeeEmployersAcocuntsEmail' : 'sdltFeeEmployersAccountEmail';
        const phoneFieldEmp = useThsFields ? 'thsFeeEmployersAccountsContactPhone' : 'sdltFeeEmployersAccountsContactPhone';
        
        if (entryData[nameField]) {
            html += `<div class="payer-info-item"><span class="payer-info-label">Accounts Contact Name:</span><span class="payer-info-value">${escapeHtml(entryData[nameField])}</span></div>`;
        }
        if (entryData[emailFieldEmp]) {
            html += `<div class="payer-info-item"><span class="payer-info-label">Accounts Contact Email:</span><span class="payer-info-value">${escapeHtml(entryData[emailFieldEmp])}</span></div>`;
        }
        if (entryData[phoneFieldEmp]) {
            html += `<div class="payer-info-item"><span class="payer-info-label">Accounts Contact Phone:</span><span class="payer-info-value">${escapeHtml(entryData[phoneFieldEmp])}</span></div>`;
        }
    }
    
    container.innerHTML = html;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Setup SDLT Payment date input handler
 */
function setupSdltPaymentDate() {
    const sdltPaidDateInput = document.getElementById('sdltPaidDate');
    if (!sdltPaidDateInput) return;
    
    // Pre-populate with existing date if available
    if (entryData?.sdltPaid1) {
        const paidDate = parseWixDate(entryData.sdltPaid1);
        if (paidDate) {
            sdltPaidDateInput.value = paidDate;
        }
    }
    
    // Remove existing listeners by cloning the element
    const newInput = sdltPaidDateInput.cloneNode(true);
    sdltPaidDateInput.parentNode.replaceChild(newInput, sdltPaidDateInput);
    
    newInput.addEventListener('change', function() {
        if (!entryData) return;
        
        // Initialize pendingUpdates if it doesn't exist
        if (!pendingUpdates) {
            pendingUpdates = {};
        }
        
        const paidDate = newInput.value;
        
        if (paidDate) {
            // Add to pending updates
            pendingUpdates.sdltPaid = true;
            pendingUpdates.sdltPaid1 = paidDate; // Store as date string (YYYY-MM-DD)
            pendingUpdates.status = [STATUS.SDLT_PAID];
            
            // Show save hint
            const saveHint = document.getElementById('sdltPaymentSaveHint');
            if (saveHint) {
                saveHint.classList.remove('hidden');
            }
            
            // Send do-notify message
            window.parent.postMessage({
                type: 'do-notify'
            }, '*');
            
            // Notify form changed
            notifyFormChanged();
        } else {
            // Date cleared - remove from pending updates
            if (pendingUpdates) {
                delete pendingUpdates.sdltPaid;
                delete pendingUpdates.sdltPaid1;
            }
            
            // Hide save hint
            const saveHint = document.getElementById('sdltPaymentSaveHint');
            if (saveHint) {
                saveHint.classList.add('hidden');
            }
        }
    });
}

/**
 * Setup SDLT5 Certificate file upload handler
 */
function setupSdlt5CertificateUpload() {
    const input = document.getElementById('sdlt5CertificateFileInput');
    const area = document.getElementById('sdlt5CertificateUpload');
    
    if (!input || !area) return;
    
    const placeholder = area.querySelector('.file-upload-placeholder');
    const selected = area.querySelector('.file-upload-selected');
    const fileNameSpan = selected ? selected.querySelector('.file-name') : null;
    const removeBtn = selected ? selected.querySelector('.remove-file-btn') : null;
    
    // Check if document already exists and show it
    if (entryData?.sdlt5Certificate?.s3Key) {
        if (placeholder) placeholder.classList.add('hidden');
        if (selected) selected.classList.remove('hidden');
        if (fileNameSpan) fileNameSpan.textContent = entryData.sdlt5Certificate.description || 'SDLT5 Certificate.pdf';
        if (area) area.classList.add('has-file');
    }
    
    // Remove existing listeners by cloning
    const newArea = area.cloneNode(true);
    area.parentNode.replaceChild(newArea, area);
    const newInput = document.getElementById('sdlt5CertificateFileInput');
    const newPlaceholder = newArea.querySelector('.file-upload-placeholder');
    const newSelected = newArea.querySelector('.file-upload-selected');
    const newFileNameSpan = newSelected ? newSelected.querySelector('.file-name') : null;
    const newRemoveBtn = newSelected ? newSelected.querySelector('.remove-file-btn') : null;
    
    // Click handler for upload area
    newArea.addEventListener('click', () => {
        if (!accountingFiles.sdlt5Certificate) {
            newInput.click();
        }
    });
    
    // File input change handler
    newInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate PDF
            if (file.type !== 'application/pdf') {
                alert('Please select a PDF file');
                newInput.value = '';
                return;
            }
            
            // Store file for upload
            accountingFiles.sdlt5Certificate = file;
            
            // Update UI
            if (newPlaceholder) newPlaceholder.classList.add('hidden');
            if (newSelected) newSelected.classList.remove('hidden');
            if (newFileNameSpan) newFileNameSpan.textContent = file.name;
            if (newArea) newArea.classList.add('has-file');
            
            // Initialize pendingUpdates if it doesn't exist
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            
            // Add pending update
            pendingUpdates.sdlt5Uploaded = true;
            
            // Send disable-close message
            window.parent.postMessage({
                type: 'disable-close'
            }, '*');
            
            // Send do-notify message
            window.parent.postMessage({
                type: 'do-notify'
            }, '*');
            
            // Notify form changed
            notifyFormChanged();
        }
    });
    
    // Remove file handler
    if (newRemoveBtn) {
        newRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accountingFiles.sdlt5Certificate = null;
            newInput.value = '';
            
            // Update UI
            if (newPlaceholder) newPlaceholder.classList.remove('hidden');
            if (newSelected) newSelected.classList.add('hidden');
            if (newArea) newArea.classList.remove('has-file');
            
            // Clear pending update
            if (pendingUpdates) {
                delete pendingUpdates.sdlt5Uploaded;
            }
            
            // Notify form changed
            notifyFormChanged();
        });
    }
}

/**
 * Setup file upload handlers for accounting card
 */
function setupAccountingFileUploads() {
    // THS Invoice upload
    setupFileUpload('thsInvoiceFileInput', 'thsInvoiceUpload', 'thsInvoice');
    
    // SDLT Invoice upload
    setupFileUpload('sdltInvoiceFileInput', 'sdltInvoiceUpload', 'sdltInvoice');
    
    // Completion Statement upload
    setupFileUpload('completionStatementFileInput', 'completionStatementUpload', 'completionStatement');
}

/**
 * Setup file upload for a specific uploader
 */
function setupFileUpload(inputId, areaId, fileKey) {
    const input = document.getElementById(inputId);
    const area = document.getElementById(areaId);
    
    if (!input || !area) return;
    
    const placeholder = area.querySelector('.file-upload-placeholder');
    const selected = area.querySelector('.file-upload-selected');
    const fileNameSpan = selected ? selected.querySelector('.file-name') : null;
    const removeBtn = selected ? selected.querySelector('.remove-file-btn') : null;
    
    // Click handler for upload area
    area.addEventListener('click', () => {
        if (!accountingFiles[fileKey]) {
            input.click();
        }
    });
    
    // File input change handler
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate PDF
            if (file.type !== 'application/pdf') {
                alert('Please select a PDF file');
                input.value = '';
                return;
            }
            
            accountingFiles[fileKey] = file;
            
            // Update UI
            if (placeholder) placeholder.classList.add('hidden');
            if (selected) selected.classList.remove('hidden');
            if (fileNameSpan) fileNameSpan.textContent = file.name;
            if (area) area.classList.add('has-file');
            
            // Initialize pendingUpdates if it doesn't exist
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            
            // Add pending status update to "Invoices Sent" when any document is selected
            pendingUpdates.status = [STATUS.INVOICES_SENT];
            
            // Send do-notify message immediately when any document is selected
            window.parent.postMessage({
                type: 'do-notify'
            }, '*');
            
            // Update pending updates (including invoice date and flags)
            updateAccountingPendingUpdates();
            
            // Notify form changed
            notifyFormChanged();
        }
    });
    
    // Remove file handler
    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            accountingFiles[fileKey] = null;
            input.value = '';
            
            // Update UI
            if (placeholder) placeholder.classList.remove('hidden');
            if (selected) selected.classList.add('hidden');
            if (area) area.classList.remove('has-file');
            
            // Update pending updates
            updateAccountingPendingUpdates();
            
            // Notify form changed
            notifyFormChanged();
        });
    }
}

/**
 * Update pending updates based on accounting file selections and invoice date
 */
function updateAccountingPendingUpdates() {
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Add invoice date if set
    const invoiceDateInput = document.getElementById('invoiceDate');
    if (invoiceDateInput && invoiceDateInput.value) {
        pendingUpdates.invoiceDate = invoiceDateInput.value;
    }
    
    // Add flags based on which files are selected
    if (accountingFiles.thsInvoice) {
        pendingUpdates.feeInvoiceSent = true;
    }
    
    if (accountingFiles.sdltInvoice) {
        pendingUpdates.sdltInvoiceSent = true;
    }
    
    if (accountingFiles.completionStatement) {
        pendingUpdates.completionStatementSent = true;
    }
    
    // Generate chat message based on uploaded documents
    generateAccountingChatMessage();
}

/**
 * Generate chat message based on uploaded accounting documents
 */
function generateAccountingChatMessage() {
    const hasThsInvoice = !!accountingFiles.thsInvoice;
    const hasSdltInvoice = !!accountingFiles.sdltInvoice;
    const hasCompletionStatement = !!accountingFiles.completionStatement;
    
    const sdltFeeInvoiceSending = entryData?.sdltFeeInvoiceSending === true;
    const thsFeesInvoiceSending = entryData?.thsFeesInvoiceSending === true;
    const invoiceSentCopy = sdltFeeInvoiceSending || thsFeesInvoiceSending;
    
    let messageParts = [];
    
    if (hasThsInvoice && hasCompletionStatement && !hasSdltInvoice) {
        // Same payer: THS invoice + completion statement
        messageParts.push('the invoice and completion statement');
    } else if (hasThsInvoice && hasSdltInvoice && hasCompletionStatement) {
        // Different payers: THS invoice + SDLT invoice + completion statement
        messageParts.push('the fee invoice and SDLT invoice');
    } else if (hasThsInvoice && !hasCompletionStatement && !hasSdltInvoice) {
        // Only THS invoice (shouldn't happen normally, but handle it)
        messageParts.push('the invoice');
    } else if (hasSdltInvoice && !hasThsInvoice) {
        // Only SDLT invoice (shouldn't happen normally, but handle it)
        messageParts.push('the SDLT invoice');
    } else if (hasCompletionStatement && !hasThsInvoice && !hasSdltInvoice) {
        // Only completion statement (shouldn't happen normally, but handle it)
        messageParts.push('the completion statement');
    }
    
    if (messageParts.length > 0) {
        let message = `${messageParts[0]} have been generated based on my SDLT Calculation. These are now available to view in the portal`;
        
        if (invoiceSentCopy) {
            message += '. I have also sent a copy to the payer as requested';
        }
        
        message += '. Please ensure these are dealt with promptly to avoid HMRC SDLT penalties.';
        
        pendingChatMessage = message;
    } else {
        pendingChatMessage = null;
    }
}

/**
 * Load Mock Data - Simulates entry-data message from parent (for testing)
 */
function loadMockData() {
    const mockEntryData = {
        type: 'entry-data',
        user: 'test.user@example.com',
        data: {
            _id: 'mock-entry-id-123',
            _createdDate: '2025-12-09T16:54:23.281Z',
            _updatedDate: '2025-12-27T19:48:44.432Z',
            status: ['New Submission'],
            thsNotification: true, // Required for first-open detection
            tenantsFirstName: 'Se',
            tenantLastName: 'Stewart',
            sdltAddress: {
                postcode: 'TR15 2ND',
                country: 'GBR',
                building_name: '',
                flat_number: '',
                street: 'Southgate Street',
                building_number: '94',
                sub_street: '',
                town: 'Redruth'
            },
            idCheckSent: false,
            sdltCalculated: false,
            sdlt5Uploaded: false,
            feeInvoiceSent: false,
            sdltInvoiceSent: false,
            sdltPaid: false,
            completionStatementSent: false,
            ukMoveInDate: '2025-12-09',
            invoiceDate: null,
            sdltPaid1: null,
            note: '',
            supportingDocuments: []
        }
    };
    
    // Simulate parent message
    handleEntryData(mockEntryData);
}

// Export functions for potential external use
window.SDLTWorkflow = {
    getEntryData: () => entryData ? { ...entryData } : null,
    refresh: () => {
        if (entryData) {
            const currentStage = determineCurrentStage(entryData);
            renderWorkflowStage(currentStage);
        }
    }
};

