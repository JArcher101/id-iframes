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
/** Set when starting SDLT calculation PDF upload; merged into file-data + save-data-response for parent (archive prior doc, etc.) */
let pendingSdltCalculationSaveMeta = null;
/** Set when uploading THS/SDLT invoice, completion statement, or SDLT5 — parent can archive prior S3 docs */
let pendingAccountingDocumentReplacementMeta = null;
let accountingFiles = {
    thsInvoice: null,
    sdltInvoice: null,
    completionStatement: null,
    sdlt5Certificate: null
}; // Track which accounting files are selected (File objects)

const ACCOUNTING_UPLOAD_FIELD_KEYS = ['thsInvoice', 'sdltInvoice', 'completionStatement', 'sdlt5Certificate'];

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

function formatSdltDueGbp(n) {
    const x = Number(n);
    const safe = Number.isFinite(x) ? x : 0;
    return safe.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** True if entry already had a saved or in-session calculation before replacing */
function entryHadPriorSdltCalculation(entry) {
    if (!entry) return false;
    return !!(entry.sdltCalculation && entry.sdltCalculation.s3Key) || !!entry.sdltCalculated;
}

/**
 * Strict parse for manual upload amount: empty field is invalid (do not treat as £0 / no SDLT due).
 * @returns {{ valid: boolean, value: number }}
 */
function parseOwnUploadSdltAmountInput() {
    const el = document.getElementById('sdltOwnCalculationAmount');
    if (!el) return { valid: false, value: 0 };
    const raw = String(el.value || '').trim();
    if (raw === '') return { valid: false, value: 0 };
    const n = parseFloat(raw.replace(/,/g, ''));
    if (!Number.isFinite(n) || n < 0) return { valid: false, value: 0 };
    return { valid: true, value: n };
}

function isPendingSdltPdfUserUpload() {
    return !!(pendingPdfBlob && typeof File !== 'undefined' && pendingPdfBlob instanceof File);
}

/**
 * Chat text for first-time or recalculation; includes previous and new amounts when recalculating.
 */
function buildSdltCalculationChatMessage(previousDue, newDue, options) {
    const prev = Number(previousDue) || 0;
    const next = Number(newDue) || 0;
    const isRecalculation = !!(options && options.isRecalculation);

    if (!isRecalculation) {
        if (next > 0) {
            return `I have calculated the SDLT due on this matter to be £${formatSdltDueGbp(next)}. We will now proceed to opening a matter and completing the relevant checks.`;
        }
        return 'I have reviewed the provided details and calculated that no SDLT is due on this submission. Please Log into your account to view the calculation. No further action is required. Please let me know if you need any further support.';
    }

    if (next > 0 && prev > 0) {
        return `Following a recalculation of SDLT on this matter, the amount due has been updated from £${formatSdltDueGbp(prev)} to £${formatSdltDueGbp(next)}. Please save the new calculation document; we will continue the matter using the revised figures.`;
    }
    if (next > 0 && prev === 0) {
        return `Following a recalculation of SDLT on this matter, SDLT is now due: £${formatSdltDueGbp(next)} (previously none due). Please save the new calculation document; we will proceed to opening the matter and completing the relevant checks.`;
    }
    if (next === 0 && prev > 0) {
        return `Following a recalculation of SDLT on this matter, no SDLT is now due (previously £${formatSdltDueGbp(prev)} was due). Please Log into your account to view the updated calculation. We will adjust the matter accordingly.`;
    }
    return 'Following a recalculation of SDLT on this matter, there remains no SDLT due. Please Log into your account to view the updated calculation.';
}

/** Shallow snapshot of a stored document for parent to move into a history array before replace. */
function snapshotEntryDocument(doc) {
    if (!doc || !doc.s3Key) return null;
    return {
        s3Key: doc.s3Key,
        description: doc.description,
        fieldKey: doc.fieldKey,
        url: doc.url,
        liveUrl: doc.liveUrl
    };
}

/**
 * Per-field rows for accounting uploads in this save batch (re-upload / overwrite).
 * @returns {Array<{fieldKey: string, replacesExisting: boolean, previousDocument: object|null}>|null}
 */
function buildAccountingDocumentReplacementMeta() {
    if (!entryData) return null;
    const list = [];
    for (const key of ACCOUNTING_UPLOAD_FIELD_KEYS) {
        if (!accountingFiles[key]) continue;
        const prev = snapshotEntryDocument(entryData[key]);
        list.push({
            fieldKey: key,
            replacesExisting: !!prev,
            previousDocument: prev
        });
    }
    return list.length ? list : null;
}

/**
 * Snapshot for parent: archive previous sdltCalculation document, reconcile amounts, optional workflow reset.
 */
function captureSdltCalculationSaveMeta(newSdltDue, newSdltRequired) {
    const prevRaw = Number(entryData.sdltDue);
    const previousSdltDue = Number.isFinite(prevRaw) ? prevRaw : 0;
    const previousSdltRequired = entryData.sdltRequired === true;
    const priorDoc = snapshotEntryDocument(entryData.sdltCalculation);
    const sdltRecalculation = !!(priorDoc || entryData.sdltCalculated);
    const nextRaw = Number(newSdltDue);
    const newDueSafe = Number.isFinite(nextRaw) ? nextRaw : 0;
    return {
        sdltRecalculation,
        previousSdltDue,
        previousSdltRequired,
        newSdltDue: newDueSafe,
        newSdltRequired: !!newSdltRequired,
        previousSdltCalculationDocument: priorDoc
    };
}

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
let pendingPdfBlob = null; // Store PDF Blob/File for SDLT calculation upload (generated or user-selected)

/** Filename sent in file-data metadata / upload queue (user PDF keeps original .name). */
function getPendingCalculationPdfDisplayName() {
    if (!pendingPdfBlob) return 'SDLT Calculation.pdf';
    if (typeof File !== 'undefined' && pendingPdfBlob instanceof File && pendingPdfBlob.name) {
        return pendingPdfBlob.name;
    }
    return 'SDLT Calculation.pdf';
}

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

    const toggleOwnCalculationUploadBtn = document.getElementById('toggleOwnCalculationUploadBtn');
    if (toggleOwnCalculationUploadBtn) {
        toggleOwnCalculationUploadBtn.addEventListener('click', handleToggleOwnCalculationUpload);
    }

    setupOwnCalculationPdfUpload();

    const replaceThsInvoiceBtn = document.getElementById('replaceThsInvoiceBtn');
    if (replaceThsInvoiceBtn) {
        replaceThsInvoiceBtn.addEventListener('click', () => beginReplaceAccountingDocument('thsInvoice'));
    }
    const replaceSdltInvoiceBtn = document.getElementById('replaceSdltInvoiceBtn');
    if (replaceSdltInvoiceBtn) {
        replaceSdltInvoiceBtn.addEventListener('click', () => beginReplaceAccountingDocument('sdltInvoice'));
    }
    const replaceCompletionStatementBtn = document.getElementById('replaceCompletionStatementBtn');
    if (replaceCompletionStatementBtn) {
        replaceCompletionStatementBtn.addEventListener('click', () => beginReplaceAccountingDocument('completionStatement'));
    }
    const replaceSdlt5CertificateBtn = document.getElementById('replaceSdlt5CertificateBtn');
    if (replaceSdlt5CertificateBtn) {
        replaceSdlt5CertificateBtn.addEventListener('click', () => beginReplaceAccountingDocument('sdlt5Certificate'));
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
}

function normalizeParentMessage(raw) {
    if (!raw || typeof raw !== 'object') return { type: '', data: {} };
    var type = String(raw.type || '');
    var payload = (raw.data !== undefined && raw.type !== undefined && raw.data && typeof raw.data === 'object') ? raw.data : raw;
    var out = {};
    for (var k in payload) { if (Object.prototype.hasOwnProperty.call(payload, k)) out[k] = payload[k]; }
    if (out.companies && typeof out.companies === 'object' && Array.isArray(out.companies.companies)) out.companies = out.companies.companies;
    if (out.companyData && typeof out.companyData === 'object' && out.companyData.companyData !== undefined) out.companyData = out.companyData.companyData;
    if (out.charityData && typeof out.charityData === 'object' && out.charityData.charityData !== undefined) out.charityData = out.charityData.charityData;
    if (out.suggestions && typeof out.suggestions === 'object' && Array.isArray(out.suggestions.suggestions)) out.suggestions = out.suggestions.suggestions;
    return { type: type, data: out };
}

function handleParentMessage(event) {
    var raw = event.data;
    if (!raw || typeof raw !== 'object') return;
    // Log all incoming messages on load for debugging section/stage issues
    console.log('[sdlt-workflow] message received', { type: raw.type, rawKeys: raw && typeof raw === 'object' ? Object.keys(raw) : [], raw: raw });
    var _n = typeof normalizeParentMessage === 'function' ? normalizeParentMessage(raw) : normalizeParentMessage(raw);
    var type = _n.type, data = _n.data;
    if (!type) return;
    switch (type) {
        case 'entry-data':
            handleEntryData(data);
            break;
        case 'save-data':
            handleSaveData(data);
            break;
        case 'put-links':
            handlePutLinks(data);
            break;
        case 'put-error':
            handlePutError(data);
            break;
        default:
            console.log('Received message:', type, data);
            break;
    }
}

function handleEntryData(message) {
    // Store entry data (used only for stage determination and action mapping)
    // We do NOT display all entry fields - only workflow-relevant actions
    // Message structure: { type: 'entry-data', data: { user: 'email', data: entryData } }
    console.log('[sdlt-workflow] handleEntryData received', { message, messageKeys: message && typeof message === 'object' ? Object.keys(message) : [] });
    const messageData = message.data !== undefined ? message.data : message; // support both { data: { user, data } } and flat { user, data }
    const rawEntry = (messageData && messageData.data !== undefined) ? messageData.data : messageData;
    entryData = rawEntry && typeof rawEntry === 'object' ? rawEntry : {};
    console.log('[sdlt-workflow] entry-data on load', {
        messageDataKeys: messageData && typeof messageData === 'object' ? Object.keys(messageData) : [],
        entryDataKeys: entryData && typeof entryData === 'object' ? Object.keys(entryData) : [],
        status: entryData.status,
        statusType: Array.isArray(entryData.status) ? 'array' : typeof entryData.status,
        thsNotification: entryData.thsNotification,
        sdltPaid: entryData.sdltPaid,
        sdltCalculated: entryData.sdltCalculated,
        idCheckSent: entryData.idCheckSent,
        feeInvoiceSent: entryData.feeInvoiceSent,
        sdltInvoiceSent: entryData.sdltInvoiceSent,
        completionStatementSent: entryData.completionStatementSent,
        sdlt5Uploaded: entryData.sdlt5Uploaded,
        entryData: entryData
    });
    originalEntryData = JSON.parse(JSON.stringify(entryData)); // Deep copy for change tracking
    // Get user from messageData.user (for file uploads) - fallback to 'system' if not available
    currentUser = (messageData && messageData.user) || 'system';

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

    // Pre-fill SDLT amount from entry data (for own-calculation upload section)
    const amountInput = document.getElementById('sdltOwnCalculationAmount');
    if (amountInput && amountInput.value === '' && entryData.sdltDue !== undefined && entryData.sdltDue !== null) {
        amountInput.value = Number(entryData.sdltDue).toFixed(2);
        updateSdltDueBadge();
    }

    // Determine current stage based on entry status/completion flags
    const currentStage = determineCurrentStage(entryData);
    console.log('[sdlt-workflow] determined stage (section)', { currentStage, statusArray: entryData.status });

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
    const hasAccountingFiles = accountingFiles.thsInvoice || accountingFiles.sdltInvoice || accountingFiles.completionStatement || accountingFiles.sdlt5Certificate;
    
    // Check if there are any files to upload (PDF blob, regular files, or accounting files)
    const hasPendingFiles = pendingPdfBlob || (pendingFiles && pendingFiles.length > 0) || hasAccountingFiles;
    
    if (hasPendingFiles) {
        if (!pendingPdfBlob) {
            pendingSdltCalculationSaveMeta = null;
        }
        pendingAccountingDocumentReplacementMeta = hasAccountingFiles ? buildAccountingDocumentReplacementMeta() : null;

        // User-uploaded calculation PDF requires an explicit SDLT amount (empty must not default to £0 / no SDLT due)
        if (isPendingSdltPdfUserUpload()) {
            const parsedAmount = parseOwnUploadSdltAmountInput();
            if (!parsedAmount.valid) {
                window.parent.postMessage({
                    type: 'validation-error',
                    message: 'Enter a valid SDLT amount (£) for your uploaded calculation before saving — use 0 only if no SDLT is due.'
                }, '*');
                return;
            }
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            applyOwnCalculationPdfPendingUpdates();
        }

        // Create file metadata array for file-data message
        const fileMetadata = [];
        
        // Add PDF blob if present
        if (pendingPdfBlob) {
            const calcPdfName = getPendingCalculationPdfDisplayName();
            const lastMod = (typeof File !== 'undefined' && pendingPdfBlob instanceof File && pendingPdfBlob.lastModified)
                ? pendingPdfBlob.lastModified
                : Date.now();
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
                    name: calcPdfName,
                    lastModified: lastMod
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

        if (pendingPdfBlob) {
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            pendingSdltCalculationSaveMeta = captureSdltCalculationSaveMeta(
                pendingUpdates.sdltDue !== undefined ? pendingUpdates.sdltDue : entryData.sdltDue,
                pendingUpdates.sdltRequired !== undefined ? pendingUpdates.sdltRequired : entryData.sdltRequired
            );
        }
        
        // Show upload progress overlay
        showUploadProgress(fileMetadata);
        
        // Send file-data message to parent
        const fileDataPayload = {
            type: 'file-data',
            files: fileMetadata,
            _id: entryData._id
        };
        if (pendingSdltCalculationSaveMeta) {
            fileDataPayload.sdltCalculationSaveMeta = pendingSdltCalculationSaveMeta;
        }
        if (pendingAccountingDocumentReplacementMeta && pendingAccountingDocumentReplacementMeta.length) {
            fileDataPayload.accountingDocumentReplacements = pendingAccountingDocumentReplacementMeta;
        }
        window.parent.postMessage(fileDataPayload, '*');
        
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
    
    // Initialize pendingUpdates if it doesn't exist (preserve anything already in it)
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Update entryData with new values
    let hasChanges = false;
    if (feeEarner) {
        const newFe = feeEarner.value || '';
        if (entryData.fe !== newFe) {
            entryData.fe = newFe;
            pendingUpdates.fe = newFe;
            hasChanges = true;
        }
    }
    if (clientNumber) {
        const newClientNumber = clientNumber.value ? parseInt(clientNumber.value, 10) : null;
        if (entryData.clientNumber !== newClientNumber) {
            entryData.clientNumber = newClientNumber;
            pendingUpdates.clientNumber = newClientNumber;
            hasChanges = true;
        }
    }
    if (matterNumber) {
        const newMatterNumber = matterNumber.value || '';
        if (entryData.matterNumber !== newMatterNumber) {
            entryData.matterNumber = newMatterNumber;
            pendingUpdates.matterNumber = newMatterNumber;
            hasChanges = true;
        }
    }
    
    // If changes were made, update the calculation result display (to show/hide Request ID Checks button)
    if (hasChanges) {
        updateCalculationResultDisplay();
        // Notify parent that form has changed (disable close button)
        notifyFormChanged();
    }
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
            name: getPendingCalculationPdfDisplayName(),
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
    
    if (accountingFiles.sdlt5Certificate) {
        filesToUpload.push({
            file: accountingFiles.sdlt5Certificate,
            name: accountingFiles.sdlt5Certificate.name,
            type: accountingFiles.sdlt5Certificate.type,
            size: accountingFiles.sdlt5Certificate.size,
            fieldKey: 'sdlt5Certificate'
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

            clearOwnCalculationUploadUI();
            
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
            pendingSdltCalculationSaveMeta = null;
            pendingAccountingDocumentReplacementMeta = null;
            clearOwnCalculationUploadUI();
            
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
    pendingSdltCalculationSaveMeta = null;
    pendingAccountingDocumentReplacementMeta = null;
    clearOwnCalculationUploadUI();
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

    if (pendingSdltCalculationSaveMeta) {
        response.sdltRecalculation = pendingSdltCalculationSaveMeta.sdltRecalculation;
        response.previousSdltDue = pendingSdltCalculationSaveMeta.previousSdltDue;
        response.previousSdltRequired = pendingSdltCalculationSaveMeta.previousSdltRequired;
        response.newSdltDue = pendingSdltCalculationSaveMeta.newSdltDue;
        response.newSdltRequired = pendingSdltCalculationSaveMeta.newSdltRequired;
        response.previousSdltCalculationDocument = pendingSdltCalculationSaveMeta.previousSdltCalculationDocument;
    }
    if (pendingAccountingDocumentReplacementMeta && pendingAccountingDocumentReplacementMeta.length) {
        response.accountingDocumentReplacements = pendingAccountingDocumentReplacementMeta;
    }

    // Remove undefined fields
    if (!response.updatedFields) delete response.updatedFields;
    if (!response.updates) delete response.updates;
    if (!response.status) delete response.status;
    if (!response.newMessage) delete response.newMessage;
    
    console.log('📤 Sending save-data-response:', response);
    window.parent.postMessage(response, '*');

    pendingSdltCalculationSaveMeta = null;
    pendingAccountingDocumentReplacementMeta = null;

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
    
    // Check if status is "Generating Invoices", "Invoices Sent", or "SDLT Paid" - show accounting card or payment card
    const statusArray = entryData?.status || [];
    const pendingStatusArray = pendingUpdates?.status || [];
    const effectiveStatusArray = pendingStatusArray.length > 0 ? pendingStatusArray : statusArray;
    if (effectiveStatusArray.includes(STATUS.GENERATING_INVOICES) || effectiveStatusArray.includes(STATUS.INVOICES_SENT) || effectiveStatusArray.includes(STATUS.SDLT_PAID)) {
        const accountingInfoCard = document.getElementById('accountingInfoCard');
        const sdltPaymentCard = document.getElementById('sdltPaymentCard');
        const matterCompletedCard = document.getElementById('matterCompletedCard');
        const idChecksCompletionCard = document.getElementById('idChecksCompletionCard');
        
        if (idChecksCompletionCard) {
            idChecksCompletionCard.classList.add('hidden');
        }
        
        // Check if status is SDLT_PAID (using effectiveStatusArray already calculated above)
        const isSdltPaid = effectiveStatusArray.includes(STATUS.SDLT_PAID);
        const hasSdlt5Cert = !!(entryData?.sdlt5Certificate && entryData.sdlt5Certificate.s3Key);
        
        if (isSdltPaid && hasSdlt5Cert) {
            // Matter completed - show completion card
            if (accountingInfoCard) accountingInfoCard.classList.add('hidden');
            if (sdltPaymentCard) sdltPaymentCard.classList.add('hidden');
            if (matterCompletedCard) matterCompletedCard.classList.remove('hidden');
        } else if (isSdltPaid) {
            // SDLT paid but no cert yet - show payment card with uploader
            if (accountingInfoCard) accountingInfoCard.classList.add('hidden');
            if (matterCompletedCard) matterCompletedCard.classList.add('hidden');
            if (sdltPaymentCard) {
                sdltPaymentCard.classList.remove('hidden');
                setupSdltPaymentDate();
                setupSdlt5CertificateUpload();
            }
        } else {
            // Check if all expected accounting documents are present
            const expectedDocsCheck = checkAllExpectedAccountingDocs();
            if (expectedDocsCheck.hasAll) {
                // All accounting docs present - show payment card
                if (accountingInfoCard) accountingInfoCard.classList.add('hidden');
                if (matterCompletedCard) matterCompletedCard.classList.add('hidden');
                if (sdltPaymentCard) {
                    sdltPaymentCard.classList.remove('hidden');
                    setupSdltPaymentDate();
                    setupSdlt5CertificateUpload();
                }
            } else {
                // Not all accounting docs present - show accounting card
                if (accountingInfoCard) {
                    accountingInfoCard.classList.remove('hidden');
                    renderAccountingInfoCard();
                }
                if (sdltPaymentCard) sdltPaymentCard.classList.add('hidden');
                if (matterCompletedCard) matterCompletedCard.classList.add('hidden');
            }
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
        'calcPreviousNPV',
        'calcPropertyClass',
        'calcPremium',
        'calcLesseeType'
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

    const companyReliefCb = document.getElementById('calcCompanyReliefFrom17');
    if (companyReliefCb) {
        companyReliefCb.addEventListener('change', performCalculation);
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

    // Lessee on lease (individual vs company) - inferred from lessee (who is named on the lease)
    // User can change; this is pre-set only
    const calcLesseeType = document.getElementById('calcLesseeType');
    if (calcLesseeType && entryData.lessee) {
        if (entryData.lessee === "The Tenant") {
            calcLesseeType.value = 'individual';
        } else if (entryData.lessee === "The Tenant's Employer" || entryData.lessee === "Dwellworks") {
            calcLesseeType.value = 'company';
        }
        // "Other" left as default (individual) - user confirms
    }

    // Residential vs non-residential - inferred from lessee; user can change
    // Individual (The Tenant) = residential; company (Employer/Dwellworks) = non-residential
    const calcPropertyClass = document.getElementById('calcPropertyClass');
    if (calcPropertyClass && entryData.lessee) {
        if (entryData.lessee === "The Tenant") {
            calcPropertyClass.value = 'residential';
        } else if (entryData.lessee === "The Tenant's Employer" || entryData.lessee === "Dwellworks") {
            calcPropertyClass.value = 'non-residential';
        }
        // "Other" left as default; user confirms
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

/** Statutory SDLT NPV discount rate (FA 2003 Sch 5) */
const SDLT_NPV_DISCOUNT_RATE = 0.035;

/**
 * Annual rent for a given lease year (1-based), after rent-free whole-year treatment.
 */
function rentPayableForYear(year, annualRent, steppedRent, rentFreeYears) {
    if (year <= rentFreeYears) return 0;
    if (steppedRent && steppedRent.length > 0) {
        for (const step of steppedRent) {
            if (year >= step.startYear && year <= step.endYear) return step.rent;
        }
        return 0;
    }
    return annualRent;
}

/**
 * Net present value of rent, aligned with HMRC SDLTM13075:
 * use actual rent for each of the first five years (or whole term if shorter), then
 * the highest rent payable in any of those years for all later years of the term.
 */
function calculateNPV(annualRent, leaseTerm, discountRate = SDLT_NPV_DISCOUNT_RATE, rentFreePeriod = 0, steppedRent = null) {
    const rentFreeYears = rentFreePeriod / 12;
    const maxYear = Math.max(0, Math.ceil(Number(leaseTerm) - 1e-9));
    if (maxYear < 1) return 0;

    const firstFiveCount = Math.min(5, maxYear);
    const rentsFirstFive = [];
    for (let y = 1; y <= firstFiveCount; y++) {
        rentsFirstFive.push(rentPayableForYear(y, annualRent, steppedRent, rentFreeYears));
    }
    const highestForTail = rentsFirstFive.length ? Math.max(...rentsFirstFive) : 0;

    let npv = 0;
    for (let year = 1; year <= maxYear; year++) {
        const rent = year <= 5
            ? rentPayableForYear(year, annualRent, steppedRent, rentFreeYears)
            : (year <= rentFreeYears ? 0 : highestForTail);
        npv += rent / Math.pow(1 + discountRate, year);
    }
    return npv;
}

/**
 * Highest annual rent used for years after year 5 (HMRC “highest 12-month rent” proxy from yearly figures).
 */
function highestRentFirstFiveYears(annualRent, leaseTerm, rentFreePeriod = 0, steppedRent = null) {
    const rentFreeYears = rentFreePeriod / 12;
    const maxYear = Math.max(0, Math.ceil(Number(leaseTerm) - 1e-9));
    const firstFiveCount = Math.min(5, maxYear);
    if (firstFiveCount < 1) return 0;
    let hi = 0;
    for (let y = 1; y <= firstFiveCount; y++) {
        const r = rentPayableForYear(y, annualRent, steppedRent, rentFreeYears);
        if (r > hi) hi = r;
    }
    return hi;
}

/** SDLT on residential lease rent NPV (gov.uk: 1% above £125,000). */
function sdltResidentialRentTax(npv) {
    if (npv <= 125000) return 0;
    return Math.round((npv - 125000) * 0.01 * 100) / 100;
}

/** SDLT on non-residential lease rent NPV (marginal slices per gov.uk). */
function sdltNonResidentialRentTax(npv) {
    if (npv <= 150000) return 0;
    let tax = 0;
    const slice1End = Math.min(npv, 5000000);
    tax += (slice1End - 150000) * 0.01;
    if (npv > 5000000) {
        tax += (npv - 5000000) * 0.02;
    }
    return Math.round(tax * 100) / 100;
}

function sdltRentNpvTax(npv, isResidential) {
    return isResidential ? sdltResidentialRentTax(npv) : sdltNonResidentialRentTax(npv);
}

/** Residential / lease premium — same slices as gov.uk single-property rates. */
function sdltResidentialPremiumTax(premium) {
    if (!premium || premium <= 0) return 0;
    let tax = 0;
    let rem = premium;
    const b0 = Math.min(rem, 125000);
    rem -= b0;
    const b1 = Math.min(rem, 125000);
    tax += b1 * 0.02;
    rem -= b1;
    const b2 = Math.min(rem, 675000);
    tax += b2 * 0.05;
    rem -= b2;
    const b3 = Math.min(rem, 575000);
    tax += b3 * 0.10;
    rem -= b3;
    tax += rem * 0.12;
    return Math.round(tax * 100) / 100;
}

/** Non-residential / mixed premium — gov.uk table. */
function sdltNonResidentialPremiumTax(premium) {
    if (!premium || premium <= 0) return 0;
    let tax = 0;
    let rem = premium;
    const b0 = Math.min(rem, 150000);
    rem -= b0;
    const b1 = Math.min(rem, 100000);
    tax += b1 * 0.02;
    rem -= b1;
    tax += rem * 0.05;
    return Math.round(tax * 100) / 100;
}

/** From 1 April 2025 — higher rates when companies buy residential (gov.uk additional-property style table). */
function sdltResidentialHigherRatesPremiumTax(premium) {
    if (!premium || premium <= 0) return 0;
    let tax = 0;
    let rem = premium;
    const b0 = Math.min(rem, 125000);
    tax += b0 * 0.05;
    rem -= b0;
    const b1 = Math.min(rem, 125000);
    tax += b1 * 0.07;
    rem -= b1;
    const b2 = Math.min(rem, 675000);
    tax += b2 * 0.10;
    rem -= b2;
    const b3 = Math.min(rem, 575000);
    tax += b3 * 0.15;
    rem -= b3;
    tax += rem * 0.17;
    return Math.round(tax * 100) / 100;
}

const SDLT_COMPANY_HIGHER_RATES_MIN = 40000;
const SDLT_COMPANY_17PC_THRESHOLD = 500000;

/**
 * Residential lease premium when the lessee is a company (non-natural person).
 * Under £40,000: standard residential slices. £40,000–£500,000: higher rates.
 * Above £500,000: 17% on the premium unless relief disapplies that rate (then higher rates).
 * @see https://www.gov.uk/guidance/stamp-duty-land-tax-corporate-bodies
 * @see https://www.gov.uk/guidance/stamp-duty-land-tax-buying-an-additional-residential-property (companies)
 */
function sdltCompanyResidentialPremiumTax(premium, reliefFrom17Percent) {
    if (!premium || premium <= 0) return 0;
    if (premium < SDLT_COMPANY_HIGHER_RATES_MIN) {
        return sdltResidentialPremiumTax(premium);
    }
    if (premium > SDLT_COMPANY_17PC_THRESHOLD) {
        if (!reliefFrom17Percent) {
            return Math.round(premium * 0.17 * 100) / 100;
        }
        return sdltResidentialHigherRatesPremiumTax(premium);
    }
    return sdltResidentialHigherRatesPremiumTax(premium);
}

/**
 * @param {boolean} reliefFrom17Percent - Relief from 17% rate (e.g. employee occupation); only used for company + residential + premium &gt; £500k.
 */
function sdltPremiumTax(premium, isResidential, isCompany, reliefFrom17Percent) {
    if (!premium || premium <= 0) return 0;
    if (!isResidential) return sdltNonResidentialPremiumTax(premium);
    if (!isCompany) return sdltResidentialPremiumTax(premium);
    return sdltCompanyResidentialPremiumTax(premium, reliefFrom17Percent);
}

/**
 * Full SDLT breakdown for a new grant or variation (rent NPV + premium).
 * @param {boolean} isCompany - Lessee is a company / non-natural person (affects residential premium only).
 * @param {boolean} reliefFrom17Percent - Company relief from 17% rate when premium &gt; £500k (residential).
 */
function computeLeaseSdltBreakdown(npv, premium, isResidential, isVariation, previousNPV, isCompany = false, reliefFrom17Percent = false) {
    const premTax = sdltPremiumTax(premium, isResidential, isCompany, reliefFrom17Percent);
    const fmt = (n) => n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const rentThresh = isResidential ? 125000 : 150000;
    let rentTax = 0;
    let explanationParts = [];

    if (isVariation && previousNPV > 0) {
        if (npv <= previousNPV) {
            rentTax = 0;
            explanationParts.push(`Lease variation: NPV has not increased from the previously assessed £${fmt(previousNPV)}. No additional SDLT on rent.`);
        } else {
            rentTax = Math.max(0, sdltRentNpvTax(npv, isResidential) - sdltRentNpvTax(previousNPV, isResidential));
            explanationParts.push(
                `Lease variation: marginal SDLT on rent NPV — total rent tax on £${fmt(npv)} minus tax that would apply to previous NPV £${fmt(previousNPV)} = £${rentTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
            );
        }
    } else if (isVariation && previousNPV === 0) {
        rentTax = sdltRentNpvTax(npv, isResidential);
        if (rentTax > 0) {
            explanationParts.push(
                `Lease variation: no SDLT had previously been payable on rent NPV. ${isResidential ? 'Residential' : 'Non-residential'} rent NPV rules apply (threshold £${rentThresh.toLocaleString('en-GB')}).`
            );
        } else {
            explanationParts.push(
                `Lease variation: rent NPV £${fmt(npv)} is below the ${isResidential ? '£125,000' : '£150,000'} threshold. No SDLT on rent.`
            );
        }
    } else {
        rentTax = sdltRentNpvTax(npv, isResidential);
        if (isResidential) {
            if (rentTax > 0) {
                explanationParts.push(`Residential lease: SDLT on rent — 1% on the portion of NPV above £125,000.`);
            } else {
                explanationParts.push(`Residential lease: rent NPV does not exceed £125,000. No SDLT on rent.`);
            }
        } else {
            if (rentTax > 0) {
                explanationParts.push(`Non-residential lease: SDLT on rent NPV — 1% from £150,001 to £5,000,000 and 2% above £5,000,000 (on the respective portions).`);
            } else {
                explanationParts.push(`Non-residential lease: rent NPV does not exceed £150,000. No SDLT on rent.`);
            }
        }
    }

    if (premTax > 0) {
        if (isResidential && isCompany) {
            let premDesc = 'company residential rules (higher rates from £40,000; 17% above £500,000 if no relief)';
            if (premium > SDLT_COMPANY_17PC_THRESHOLD && !reliefFrom17Percent) premDesc = '17% corporate rate on residential premium over £500,000';
            else if (premium > SDLT_COMPANY_17PC_THRESHOLD && reliefFrom17Percent) premDesc = 'higher rates (relief from 17% corporate rate)';
            else if (premium >= SDLT_COMPANY_HIGHER_RATES_MIN) premDesc = 'higher rates for company residential purchases (£40,000+)';
            else premDesc = 'standard residential slices (premium under £40,000)';
            explanationParts.push(`SDLT on lease premium (company lessee): £${premTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — ${premDesc}.`);
        } else {
            explanationParts.push(`SDLT on lease premium: £${premTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${isResidential ? 'residential' : 'non-residential'} slab rates).`);
        }
    } else if (premium > 0 && premTax === 0) {
        explanationParts.push(`Lease premium £${fmt(premium)} is within the nil-rate band for ${isResidential ? 'residential' : 'non-residential'} property.`);
    }

    const sdltDue = Math.round((rentTax + premTax) * 100) / 100;

    return {
        sdltOnRent: rentTax,
        sdltOnPremium: premTax,
        sdltDue,
        threshold: rentThresh,
        explanation: explanationParts.join(' '),
        isResidential,
        isCompany: !!isCompany,
        companyReliefFrom17: !!reliefFrom17Percent
    };
}

/**
 * Generate lease extension notes for first-year leases (rent NPV only).
 * @param {number} leaseTerm - Lease term in years
 * @param {number} annualRent - Annual rent (0 if stepped rent only)
 * @param {boolean} isResidential - Property class for rent NPV bands
 * @param {number} rentTaxTotal - SDLT on rent already due for current term
 * @param {number} [rentFreePeriod] - Rent-free period in months
 * @param {Array|null} [steppedRent] - Stepped rent steps
 * @returns {string} HTML formatted notes
 */
function calculateExtensionNote(leaseTerm, annualRent, isResidential, rentTaxTotal, rentFreePeriod = 0, steppedRent = null) {
    let notes = [];

    if (leaseTerm === 1) {
        if (rentTaxTotal > 0) {
            notes.push("Note: This is a first-year lease. Any extensions to the lease term will likely trigger additional SDLT payable on rent.");
        } else {
            const discountRate = SDLT_NPV_DISCOUNT_RATE;
            let extendedTerm = leaseTerm;
            while (extendedTerm < 100) {
                const projNpv = calculateNPV(annualRent, extendedTerm, discountRate, rentFreePeriod, steppedRent);
                if (sdltRentNpvTax(projNpv, isResidential) > 0) break;
                extendedTerm += 1;
            }

            const hasRentPattern = annualRent > 0 || (steppedRent && steppedRent.length > 0);
            if (extendedTerm > leaseTerm && hasRentPattern) {
                const yearsNeeded = extendedTerm - leaseTerm;
                notes.push(`Note: This is a first-year lease with no SDLT on rent currently due. An extension of approximately ${yearsNeeded} year(s) would be required before SDLT on rent becomes payable, assuming the same rent pattern and a ${(discountRate * 100).toFixed(1)}% NPV discount rate.`);
            } else if (hasRentPattern) {
                notes.push("Note: This is a first-year lease with no SDLT on rent currently due. Extensions may trigger SDLT depending on future rent and term.");
            }
        }
    }

    return notes.map(note => `<p style="margin-top: 10px; font-style: italic; color: #555;">${note}</p>`).join('');
}

/** Show “relief from 17%” only for residential + company + premium over £500k. */
function updateCompanyReliefRowVisibility() {
    const row = document.getElementById('calcCompanyReliefRow');
    const cb = document.getElementById('calcCompanyReliefFrom17');
    if (!row) return;
    const pc = document.getElementById('calcPropertyClass')?.value || 'residential';
    const lt = document.getElementById('calcLesseeType')?.value || 'individual';
    const prem = parseFloat(document.getElementById('calcPremium')?.value) || 0;
    const show = pc === 'residential' && lt === 'company' && prem > SDLT_COMPANY_17PC_THRESHOLD;
    if (show) {
        row.classList.remove('hidden');
    } else {
        row.classList.add('hidden');
        if (cb) cb.checked = false;
    }
}

/**
 * Perform calculation and update results display
 */
function performCalculation() {
    updateCompanyReliefRowVisibility();

    const leaseTerm = parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0;
    const annualRent = parseFloat(document.getElementById('calcAnnualRent')?.value) || 0;
    const rentFreePeriod = parseFloat(document.getElementById('calcRentFreePeriod')?.value) || 0;
    const isVariation = document.getElementById('calcIsVariation')?.checked || false;
    const previousNPV = parseFloat(document.getElementById('calcPreviousNPV')?.value) || 0;
    const premium = parseFloat(document.getElementById('calcPremium')?.value) || 0;
    const propertyClass = document.getElementById('calcPropertyClass')?.value || 'residential';
    const isResidential = propertyClass !== 'non-residential';
    const isCompany = (document.getElementById('calcLesseeType')?.value || 'individual') === 'company';
    const reliefFrom17 = document.getElementById('calcCompanyReliefFrom17')?.checked || false;

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

    const hasSteppedData = steppedRent && steppedRent.length > 0;
    if (leaseTerm <= 0 || (!hasSteppedData && annualRent <= 0)) {
        const resultsDiv = document.getElementById('calculatorResults');
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p class="results-placeholder">Enter lease details above to see calculation results.</p>';
        }
        return;
    }

    const npv = calculateNPV(annualRent, leaseTerm, SDLT_NPV_DISCOUNT_RATE, rentFreePeriod, steppedRent);
    const highestRent = highestRentFirstFiveYears(annualRent, leaseTerm, rentFreePeriod, steppedRent);
    const breakdown = computeLeaseSdltBreakdown(npv, premium, isResidential, isVariation, previousNPV, isCompany, reliefFrom17);

    displayCalculationResults(npv, highestRent, breakdown, isResidential);
}

/**
 * Display calculation results in the calculator
 */
function displayCalculationResults(npv, highestTwelveMonthRent, breakdown, isResidential) {
    const resultsDiv = document.getElementById('calculatorResults');
    if (!resultsDiv) return;

    const formattedNPV = npv.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedTotal = breakdown.sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtRent = breakdown.sdltOnRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPrem = breakdown.sdltOnPremium.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const propLabel = isResidential ? 'Residential' : 'Non-residential';
    const hiRentRow = Math.ceil(parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0) > 5
        ? `<div class="result-item">
            <div class="result-label">Highest rent (first 5 years, used for years 6+)</div>
            <div class="result-value">£${highestTwelveMonthRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
           </div>`
        : `<div class="result-item">
            <div class="result-label">Highest 12-month rent (years 1–5)</div>
            <div class="result-value">£${highestTwelveMonthRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
           </div>`;

    const lesseeLabel = breakdown.isCompany ? 'Company (non-natural person)' : 'Individual';

    resultsDiv.innerHTML = `
        <div class="result-item">
            <div class="result-label">Property class</div>
            <div class="result-value">${propLabel}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Lessee on lease</div>
            <div class="result-value">${lesseeLabel}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Net Present Value (NPV) of rent</div>
            <div class="result-value">£${formattedNPV}</div>
        </div>
        ${hiRentRow}
        <div class="result-item">
            <div class="result-label">Rent NPV threshold (nil-rate)</div>
            <div class="result-value">£${breakdown.threshold.toLocaleString('en-GB')}</div>
        </div>
        <div class="result-item">
            <div class="result-label">SDLT on rent</div>
            <div class="result-value">£${fmtRent}</div>
        </div>
        <div class="result-item">
            <div class="result-label">SDLT on premium</div>
            <div class="result-value">£${fmtPrem}</div>
        </div>
        <div class="result-item">
            <div class="result-label">Total SDLT due</div>
            <div class="result-value">£${formattedTotal}</div>
        </div>
        <div class="result-explanation">${breakdown.explanation}</div>
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
        const leaseTerm = parseFloat(document.getElementById('calcLeaseTerm')?.value) || 0;
        const annualRent = parseFloat(document.getElementById('calcAnnualRent')?.value) || 0;
        const useSteppedRentPdf = document.getElementById('calcUseSteppedRent')?.checked || false;
        let validSteppedPdf = false;
        if (useSteppedRentPdf) {
            document.querySelectorAll('.stepped-rent-row').forEach(row => {
                const startYear = parseFloat(row.querySelector('.stepped-rent-start')?.value) || 0;
                const endYear = parseFloat(row.querySelector('.stepped-rent-end')?.value) || 0;
                const rent = parseFloat(row.querySelector('.stepped-rent-amount')?.value) || 0;
                if (startYear > 0 && endYear > 0 && rent > 0) validSteppedPdf = true;
            });
        }

        if (leaseTerm <= 0 || (annualRent <= 0 && !validSteppedPdf)) {
            alert('Please enter a valid lease term and annual rent (or at least one valid stepped rent row) before generating PDF.');
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
        const premium = parseFloat(document.getElementById('calcPremium')?.value) || 0;
        const propertyClass = document.getElementById('calcPropertyClass')?.value || 'residential';
        const isResidential = propertyClass !== 'non-residential';
        const isCompany = (document.getElementById('calcLesseeType')?.value || 'individual') === 'company';
        const reliefFrom17 = document.getElementById('calcCompanyReliefFrom17')?.checked || false;
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
        
        const npv = calculateNPV(annualRentFinal, leaseTermFinal, SDLT_NPV_DISCOUNT_RATE, rentFreePeriod, steppedRent);
        const highestRentPdf = highestRentFirstFiveYears(annualRentFinal, leaseTermFinal, rentFreePeriod, steppedRent);
        const sdltResult = computeLeaseSdltBreakdown(npv, premium, isResidential, isVariation, previousNPV, isCompany, reliefFrom17);

        const priorSdltDueForMessage = Number(entryData?.sdltDue) || 0;
        const isSdltRecalculation = entryHadPriorSdltCalculation(entryData);

        const extensionNote = calculateExtensionNote(
            leaseTermFinal,
            annualRentFinal,
            isResidential,
            sdltResult.sdltOnRent,
            rentFreePeriod,
            steppedRent
        );

        try {
            const pdfBlob = await generateSdltCalculationPDF({
                caseReference,
                propertyAddress,
                tenantType,
                propertyClassLabel: isResidential ? 'Residential' : 'Non-residential',
                lesseeLabel: isCompany ? 'Company (non-natural person)' : 'Individual',
                premium,
                effectiveDate: effectiveDateFormatted || effectiveDate,
                leaseStartDate,
                leaseTerm: leaseTermFinal,
                annualRent: annualRentFinal,
                rentFreePeriod,
                isVariation,
                previousNPV,
                steppedRent,
                npv,
                highestRentFirstFive: highestRentPdf,
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

            pendingChatMessage = buildSdltCalculationChatMessage(priorSdltDueForMessage, sdltResult.sdltDue, {
                isRecalculation: isSdltRecalculation
            });
            
            // Update status based on whether SDLT is due
            // Check sdltDue directly (sdltResult doesn't have sdltRequired property, only sdltDue, explanation, threshold)
            if (sdltResult.sdltDue > 0) {
                pendingUpdates.status = [STATUS.CALCULATING_SDLT];
                entryData.status = [STATUS.CALCULATING_SDLT];
            } else if (sdltResult.sdltDue === 0) {
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
            
            // Store PDF blob for upload (clear any user-selected file UI first)
            clearOwnCalculationUploadUI();
            pendingPdfBlob = pdfBlob;
            
            // If no SDLT due, silently send archive-id message to parent (after PDF is generated and stored)
            if (sdltResult.sdltDue === 0) {
                window.parent.postMessage({
                    type: 'archive-id'
                }, '*');
            }
            
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

            const currentStageAfterCalc = determineCurrentStage(entryData);
            renderWorkflowStage(currentStageAfterCalc);
            
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
    const premiumVal = calculationData.premium || 0;
    const formattedPremium = premiumVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtSdltRent = calculationData.sdltResult.sdltOnRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtSdltPrem = calculationData.sdltResult.sdltOnPremium.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const hiRent = calculationData.highestRentFirstFive != null
        ? calculationData.highestRentFirstFive
        : highestRentFirstFiveYears(calculationData.annualRent, calculationData.leaseTerm, calculationData.rentFreePeriod || 0, calculationData.steppedRent || null);
    const formattedHiRent = hiRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const propClassPdf = calculationData.propertyClassLabel || (calculationData.sdltResult.isResidential ? 'Residential' : 'Non-residential');
    const lesseePdf = calculationData.lesseeLabel
        || (calculationData.sdltResult.isCompany ? 'Company (non-natural person)' : 'Individual');
    const showReliefRowPdf = calculationData.sdltResult.isResidential
        && calculationData.sdltResult.isCompany
        && premiumVal > SDLT_COMPANY_17PC_THRESHOLD;

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
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Residential / Non-residential:</span>
                    <span style="color: #333;">${escapeHtml(propClassPdf)}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Lessee on lease:</span>
                    <span style="color: #333;">${escapeHtml(lesseePdf)}</span>
                </div>
                ${showReliefRowPdf ? `
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Relief from 17% corporate rate:</span>
                    <span style="color: #333;">${calculationData.sdltResult.companyReliefFrom17 ? 'Yes' : 'No'}</span>
                </div>
                ` : ''}
                <div style="display: flex; gap: 10px;">
                    <span style="font-weight: bold; color: #6c757d; min-width: 140px;">Premium:</span>
                    <span style="color: #333;">£${formattedPremium}</span>
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
                <div class="info-label">Net Present Value (NPV) of rent:</div>
                <div class="info-value">£${formattedNPV}</div>
                <div class="info-label">Highest rent (years 1–5, HMRC):</div>
                <div class="info-value">£${formattedHiRent}</div>
                <div class="info-label">Rent NPV nil-rate band:</div>
                <div class="info-value">£${calculationData.sdltResult.threshold.toLocaleString('en-GB')}</div>
                <div class="info-label">SDLT on rent:</div>
                <div class="info-value">£${fmtSdltRent}</div>
                <div class="info-label">SDLT on premium:</div>
                <div class="info-value">£${fmtSdltPrem}</div>
            </div>
            
            <div class="result-box">
                <div style="font-size: 16px; font-weight: bold; color: #003c71;">Total SDLT due</div>
                <div class="result-value">£${formattedSDLT}</div>
            </div>
            
            <div style="background: #e8f4f8; border-left: 4px solid #003c71; border-radius: 4px; padding: 16px; margin-top: 20px; font-size: 13px; line-height: 1.6;">
                ${escapeHtml(calculationData.sdltResult.explanation || '')}
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
                <p>Aligned with HMRC lease rules (SDLTM13075 NPV of rent; gov.uk residential and non-residential rates for premium and rent NPV).</p>
                <p>Rent NPV uses a 3.5% statutory discount rate. Residential rent NPV: 1% above £125,000. Non-residential rent NPV: 1% from £150,001 to £5,000,000 and 2% above £5,000,000.</p>
                <p>Premium uses the same slab rates as freehold purchases for non-residential property; for residential property, individual lessees use standard slices, and company lessees use higher rates from £40,000 and 17% above £500,000 unless relief applies (see HMRC corporate bodies guidance).</p>
                <p>Generated on: ${calculationDate}</p>
                <p style="margin-top: 8px; font-style: italic;">This report is for informational purposes only. Use the official HMRC SDLT calculator and guidance for returns and edge cases.</p>
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
 * Check if matter details are complete (fee earner, client number, matter number)
 * Checks both entryData and pendingUpdates
 */
/**
 * Check if matter details are complete (fee earner, client number, matter number)
 * Checks form inputs first (real-time), then pendingUpdates, then entryData
 */
function hasMatterDetails() {
    // Check form inputs first (for real-time validation as user types)
    const feeEarnerInput = document.getElementById('feeEarner');
    const clientNumberInput = document.getElementById('clientNumber');
    const matterNumberInput = document.getElementById('matterNumber');
    
    // Get values from form inputs, or fall back to pendingUpdates, or entryData
    const feValue = feeEarnerInput?.value || pendingUpdates?.fe || entryData?.fe;
    const clientNumberRaw = clientNumberInput?.value || (pendingUpdates?.clientNumber !== undefined ? pendingUpdates.clientNumber : entryData?.clientNumber);
    const clientNumberValue = clientNumberRaw ? (typeof clientNumberRaw === 'number' ? clientNumberRaw : parseInt(clientNumberRaw, 10)) : null;
    const matterNumberValue = matterNumberInput?.value || pendingUpdates?.matterNumber || entryData?.matterNumber;
    
    // All three must be present and non-empty/non-null
    return !!(feValue && clientNumberValue && matterNumberValue);
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
    const matterDetailsRequiredHint = document.getElementById('matterDetailsRequiredHint');
    
    if (!openBtn || !resultDiv || !generatedHint) return;
    
    // Determine what to show based on pending updates or entry data
    const sdltCalculated = pendingUpdates?.sdltCalculated || entryData?.sdltCalculated;
    const sdltDue = pendingUpdates?.sdltDue ?? entryData?.sdltDue ?? 0;
    const sdltRequired = pendingUpdates?.sdltRequired ?? entryData?.sdltRequired ?? false;
    // Check if calculation document exists (uploaded PDF from previous session)
    const hasSdltCalculation = !!(pendingUpdates?.sdltCalculation?.s3Key || entryData?.sdltCalculation?.s3Key);
    const hasPendingCalculationPdf = !!pendingPdfBlob;
    
    // Check current status to determine if we should show hint for "No SDLT Due" statuses
    // Use pendingUpdates.status if available (latest), otherwise entryData.status
    const statusArray = pendingUpdates?.status || entryData?.status || [];
    const isNoSdltDue = statusArray.includes(STATUS.NO_SDLT_DUE) || statusArray.includes(STATUS.NO_SDLT_DUE_ALT);
    const isCalculatingSdlt = statusArray.includes(STATUS.CALCULATING_SDLT);
    
    // Check if ID checks have been requested
    const idCheckSent = pendingUpdates?.idCheckSent ?? entryData?.idCheckSent ?? false;
    
    // Check if matter details are complete
    const matterDetailsComplete = hasMatterDetails();
    
    // Show hint and result if calculation has been done (either sdltCalculated flag OR document exists OR PDF pending upload)
    // Also show hint for "No SDLT Due" status even if calculation flags aren't set
    if (sdltCalculated || hasSdltCalculation || isNoSdltDue || hasPendingCalculationPdf) {
        // Keep button visible (users can edit/recalculate)
        openBtn.classList.remove('hidden');
        
        // Show calculation generated hint (PDF was generated/uploaded, or status indicates calculation done)
        generatedHint.classList.remove('hidden');
        
        // Show result text
        resultDiv.classList.remove('hidden');
        
        // Format result text
        if (hasPendingCalculationPdf && pendingPdfBlob instanceof File && !hasSdltCalculation) {
            const ownAmountOk = parseOwnUploadSdltAmountInput().valid;
            resultDiv.textContent = ownAmountOk
                ? 'External calculation PDF selected — save the entry to upload'
                : 'External calculation PDF selected — enter SDLT amount (£), then save to upload';
        } else if (sdltDue === 0) {
            resultDiv.textContent = 'SDLT Calculated - none due';
        } else {
            const formattedAmount = sdltDue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            resultDiv.textContent = `SDLT Calculated - £${formattedAmount}`;
        }
        
        // Handle ID checks button and hint visibility based on idCheckSent and sdltRequired
        // Show ID checks elements when SDLT has been calculated AND is required (sdltDue > 0)
        // Both sdltCalculated and sdltRequired should be true at this point
        if (sdltCalculated && sdltRequired) {
            // SDLT is due and we're in the calculating SDLT stage
            if (idCheckSent) {
                // ID checks have been requested - hide "Request ID Checks" button, show hint and "Mark as in Progress" button
                if (requestIdChecksBtn) {
                    requestIdChecksBtn.classList.add('hidden');
                }
                if (matterDetailsRequiredHint) {
                    matterDetailsRequiredHint.classList.add('hidden');
                }
                if (idChecksRequestedHint) {
                    idChecksRequestedHint.classList.remove('hidden');
                }
                if (markIdChecksInProgressBtn) {
                    markIdChecksInProgressBtn.classList.remove('hidden');
                }
            } else {
                // ID checks not yet requested - check if matter details are complete
                if (matterDetailsComplete) {
                    // Matter details complete - show "Request ID Checks" button
                    if (requestIdChecksBtn) {
                        requestIdChecksBtn.classList.remove('hidden');
                    }
                    if (matterDetailsRequiredHint) {
                        matterDetailsRequiredHint.classList.add('hidden');
                    }
                } else {
                    // Matter details incomplete - show hint, hide button
                    if (requestIdChecksBtn) {
                        requestIdChecksBtn.classList.add('hidden');
                    }
                    if (matterDetailsRequiredHint) {
                        matterDetailsRequiredHint.classList.remove('hidden');
                    }
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
            // Not showing ID checks section - hide all related elements
            if (requestIdChecksBtn) {
                requestIdChecksBtn.classList.add('hidden');
            }
            if (matterDetailsRequiredHint) {
                matterDetailsRequiredHint.classList.add('hidden');
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
    
    // Check if status is "ID Checks in Progress" (check both entryData and pendingUpdates)
    const statusArray = entryData?.status || [];
    const pendingStatusArray = pendingUpdates?.status || [];
    const effectiveStatusArray = pendingStatusArray.length > 0 ? pendingStatusArray : statusArray;
    const isIdChecksInProgress = effectiveStatusArray.includes(STATUS.ID_CHECKS_IN_PROGRESS);
    
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
    
    // Verify matter details are complete before allowing request
    if (!hasMatterDetails()) {
        console.warn('Cannot request ID checks: matter details incomplete');
        return;
    }
    
    // Initialize pendingUpdates if it doesn't exist (preserve anything already in it)
    if (!pendingUpdates) {
        pendingUpdates = {};
    }
    
    // Ensure matter details are in pendingUpdates (preserve existing values, add if missing)
    if (!pendingUpdates.fe && entryData.fe) {
        pendingUpdates.fe = entryData.fe;
    }
    if (pendingUpdates.clientNumber === undefined && entryData.clientNumber !== undefined) {
        pendingUpdates.clientNumber = entryData.clientNumber;
    }
    if (!pendingUpdates.matterNumber && entryData.matterNumber) {
        pendingUpdates.matterNumber = entryData.matterNumber;
    }
    
    // Add idCheckSent: true to pending updates (preserve all existing pending updates)
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
    pendingChatMessage = "I have initiated the required ID checks on this submission and we are awaiting a response from the client via the Thirdfort App. Please remind your clients to complete them in a timely manner to avoid HMRC penalties for late SDLT submission. Click the button at the top of the page for a link to provide your client with information on completing their checks, which is publicly accessible on the website.";
    
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
    const samePayer = thsPayer === sdltPayer;
    
    // Set invoice date from entryData if it exists, otherwise leave empty (no preselection of today)
    const invoiceDateInput = document.getElementById('invoiceDate');
    if (invoiceDateInput) {
        if (entryData.invoiceDate) {
            // Use existing invoice date from entryData
            invoiceDateInput.value = entryData.invoiceDate;
        } else {
            // Clear any existing value (don't preselect today)
            invoiceDateInput.value = '';
        }
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
    
    // Show/hide "THS Legal Fee Payer" title based on whether payers differ
    const thsPayerTitle = document.querySelector('.payer-section .payer-title');
    if (thsPayerTitle) {
        if (samePayer) {
            thsPayerTitle.classList.add('hidden');
        } else {
            thsPayerTitle.classList.remove('hidden');
        }
    }
    
    // Render THS payer information
    renderPayerInfo('thsPayerInfo', thsPayer, 'ths');
    
    // Render SDLT payer information (if different from THS payer)
    const sdltPayerSection = document.getElementById('sdltPayerSection');
    if (sdltPayerSection) {
        if (!samePayer) {
            sdltPayerSection.classList.remove('hidden');
            renderPayerInfo('sdltPayerInfo', sdltPayer, 'sdlt');
        } else {
            sdltPayerSection.classList.add('hidden');
        }
    }
    
    // Render document cards for already-uploaded documents and show/hide uploaders accordingly
    // This will also check if all expected docs are present and auto-advance to SDLT payment card
    renderAccountingDocumentCards();
}

/**
 * Render document cards for already-uploaded accounting documents
 * Shows document cards for existing files, uploaders for missing/overwrites
 */
/**
 * Check if all expected accounting documents are present (in entryData or pendingFiles)
 * Returns: { hasAll: boolean, expectsThsInvoice: boolean, expectsSdltInvoice: boolean, expectsCompletionStatement: boolean }
 */
/**
 * Same flow as document-card "Overwrite": show uploader and open file picker.
 */
function beginReplaceAccountingDocument(fieldKey) {
    if (fieldKey === 'thsInvoice') {
        const card = document.getElementById('thsInvoiceDocumentCard');
        const wrapper = document.getElementById('thsInvoiceUploadWrapper');
        const section = wrapper ? wrapper.querySelector('.file-upload-section') : null;
        const input = document.getElementById('thsInvoiceFileInput');
        if (card) card.classList.add('hidden');
        if (section) section.style.display = 'block';
        if (input) input.click();
        notifyFormChanged();
        return;
    }
    if (fieldKey === 'sdltInvoice') {
        const card = document.getElementById('sdltInvoiceDocumentCard');
        const wrapper = document.getElementById('sdltInvoiceUploadWrapper');
        const section = wrapper ? wrapper.querySelector('.file-upload-section') : null;
        const input = document.getElementById('sdltInvoiceFileInput');
        if (card) card.classList.add('hidden');
        if (section) section.style.display = 'block';
        if (input) input.click();
        notifyFormChanged();
        return;
    }
    if (fieldKey === 'completionStatement') {
        const card = document.getElementById('completionStatementDocumentCard');
        const wrapper = document.getElementById('completionStatementUploadWrapper');
        const section = wrapper ? wrapper.querySelector('.file-upload-section') : null;
        const input = document.getElementById('completionStatementFileInput');
        if (card) card.classList.add('hidden');
        if (section) section.style.display = 'block';
        if (input) input.click();
        notifyFormChanged();
        return;
    }
    if (fieldKey === 'sdlt5Certificate') {
        const card = document.getElementById('sdlt5CertificateDocumentCard');
        const area = document.getElementById('sdlt5CertificateUpload');
        const section = area ? area.closest('.file-upload-section') : null;
        const input = document.getElementById('sdlt5CertificateFileInput');
        if (card) card.classList.add('hidden');
        if (section) section.style.display = 'block';
        if (input) input.click();
        notifyFormChanged();
    }
}

/** Header buttons: mirror calculator-style "replace" actions when a doc is already on the entry */
function updateAccountingReplaceHeaderButtons() {
    if (!entryData) return;
    const actions = document.getElementById('accountingReplaceActions');
    const btnThs = document.getElementById('replaceThsInvoiceBtn');
    const btnSdlt = document.getElementById('replaceSdltInvoiceBtn');
    const btnComp = document.getElementById('replaceCompletionStatementBtn');
    if (!actions || !btnThs || !btnSdlt || !btnComp) return;

    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    const samePayer = thsPayer === sdltPayer;
    const expectsThsInvoice = !!thsPayer;
    const expectsSdltInvoice = !!sdltPayer && !samePayer;
    const expectsCompletionStatement = !!sdltPayer;
    const hasThsInvoice = !!(entryData.thsInvoice && entryData.thsInvoice.s3Key);
    const hasSdltInvoice = !!(entryData.sdltInvoice && entryData.sdltInvoice.s3Key);
    const hasCompletionStatement = !!(entryData.completionStatement && entryData.completionStatement.s3Key);

    const showThs = expectsThsInvoice && hasThsInvoice && !accountingFiles.thsInvoice;
    const showSdlt = expectsSdltInvoice && hasSdltInvoice && !accountingFiles.sdltInvoice;
    const showComp = expectsCompletionStatement && hasCompletionStatement && !accountingFiles.completionStatement;

    btnThs.classList.toggle('hidden', !showThs);
    btnSdlt.classList.toggle('hidden', !showSdlt);
    btnComp.classList.toggle('hidden', !showComp);

    const showRow = showThs || showSdlt || showComp;
    actions.classList.toggle('hidden', !showRow);
}

function updateSdlt5ReplaceHeaderButton() {
    const actions = document.getElementById('sdlt5ReplaceActions');
    const btn = document.getElementById('replaceSdlt5CertificateBtn');
    if (!actions || !btn) return;

    const statusArray = entryData?.status || [];
    const pendingStatusArray = pendingUpdates?.status || [];
    const effectiveStatusArray = pendingStatusArray.length > 0 ? pendingStatusArray : statusArray;
    const isSdltPaid = effectiveStatusArray.includes(STATUS.SDLT_PAID);

    if (!isSdltPaid || !entryData) {
        actions.classList.add('hidden');
        btn.classList.add('hidden');
        return;
    }

    const hasCert = !!(entryData.sdlt5Certificate && entryData.sdlt5Certificate.s3Key);
    const pending = !!accountingFiles.sdlt5Certificate;
    const show = hasCert && !pending;
    btn.classList.toggle('hidden', !show);
    actions.classList.toggle('hidden', !show);
}

function checkAllExpectedAccountingDocs() {
    if (!entryData) return { hasAll: false, expectsThsInvoice: false, expectsSdltInvoice: false, expectsCompletionStatement: false };
    
    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    const samePayer = thsPayer === sdltPayer;
    
    // Determine which documents are expected
    const expectsThsInvoice = !!thsPayer;
    const expectsSdltInvoice = !!sdltPayer && !samePayer;
    const expectsCompletionStatement = !!sdltPayer;
    
    // Check which documents exist (in entryData or pendingFiles/accountingFiles)
    const hasThsInvoice = !!(entryData.thsInvoice && entryData.thsInvoice.s3Key) || !!accountingFiles.thsInvoice;
    const hasSdltInvoice = !!(entryData.sdltInvoice && entryData.sdltInvoice.s3Key) || !!accountingFiles.sdltInvoice;
    const hasCompletionStatement = !!(entryData.completionStatement && entryData.completionStatement.s3Key) || !!accountingFiles.completionStatement;
    
    // Check if we have all expected documents
    const hasAll = 
        (!expectsThsInvoice || hasThsInvoice) &&
        (!expectsSdltInvoice || hasSdltInvoice) &&
        (!expectsCompletionStatement || hasCompletionStatement);
    
    return { hasAll, expectsThsInvoice, expectsSdltInvoice, expectsCompletionStatement, samePayer };
}

function renderAccountingDocumentCards() {
    if (!entryData) return;
    
    const thsPayer = entryData.thsFeePayer;
    const sdltPayer = entryData.sdltFeePayer;
    const samePayer = thsPayer === sdltPayer;
    
    // Determine which documents are expected
    const expectsThsInvoice = !!thsPayer;
    const expectsSdltInvoice = !!sdltPayer && !samePayer;
    const expectsCompletionStatement = !!sdltPayer;
    
    // Check which documents exist (in entryData only for rendering purposes)
    const hasThsInvoice = !!(entryData.thsInvoice && entryData.thsInvoice.s3Key);
    const hasSdltInvoice = !!(entryData.sdltInvoice && entryData.sdltInvoice.s3Key);
    const hasCompletionStatement = !!(entryData.completionStatement && entryData.completionStatement.s3Key);
    
    // Get uploader containers
    const uploadersContainer = document.getElementById('accountingUploadersContainer');
    const thsInvoiceWrapper = document.getElementById('thsInvoiceUploadWrapper');
    const sdltInvoiceWrapper = document.getElementById('sdltInvoiceUploadWrapper');
    const completionStatementWrapper = document.getElementById('completionStatementUploadWrapper');
    
    // Determine how many uploaders will be visible
    let visibleUploadersCount = 0;
    if (expectsThsInvoice && !hasThsInvoice && !accountingFiles.thsInvoice) visibleUploadersCount++;
    if (expectsSdltInvoice && !hasSdltInvoice && !accountingFiles.sdltInvoice) visibleUploadersCount++;
    if (expectsCompletionStatement && !hasCompletionStatement && !accountingFiles.completionStatement) visibleUploadersCount++;
    
    // Apply 50/50 layout if exactly 2 uploaders visible
    if (uploadersContainer) {
        if (visibleUploadersCount === 2) {
            uploadersContainer.classList.add('two-columns');
        } else {
            uploadersContainer.classList.remove('two-columns');
        }
    }
    
    // Show/hide SDLT Invoice wrapper based on payer setup
    if (sdltInvoiceWrapper) {
        if (expectsSdltInvoice) {
            sdltInvoiceWrapper.classList.remove('hidden');
        } else {
            sdltInvoiceWrapper.classList.add('hidden');
        }
    }
    
    // THS Invoice
    const thsInvoiceDocumentCard = document.getElementById('thsInvoiceDocumentCard');
    const thsInvoiceUploadSection = thsInvoiceWrapper ? thsInvoiceWrapper.querySelector('.file-upload-section') : null;
    
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
    } else {
        // Hide THS invoice wrapper if not expected
        if (thsInvoiceWrapper) thsInvoiceWrapper.classList.add('hidden');
    }
    
    // SDLT Invoice (only if different payer)
    if (expectsSdltInvoice) {
        const sdltInvoiceDocumentCard = document.getElementById('sdltInvoiceDocumentCard');
        const sdltInvoiceUploadSection = sdltInvoiceWrapper ? sdltInvoiceWrapper.querySelector('.file-upload-section') : null;
        
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
        const completionStatementUploadSection = completionStatementWrapper ? completionStatementWrapper.querySelector('.file-upload-section') : null;
        
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
    } else {
        // Hide completion statement wrapper if not expected
        if (completionStatementWrapper) completionStatementWrapper.classList.add('hidden');
    }
    
    // Don't auto-advance here - that's handled in renderWorkflowStage
    // This function just renders the document cards and uploaders
    updateAccountingReplaceHeaderButtons();
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
        
        const paidDate = newInput.value;
        
        if (paidDate) {
            // Initialize pendingUpdates if it doesn't exist
            if (!pendingUpdates) {
                pendingUpdates = {};
            }
            
            // Add to pending updates
            pendingUpdates.sdltPaid = true;
            pendingUpdates.sdltPaid1 = paidDate; // Store as date string (YYYY-MM-DD)
            pendingUpdates.status = [STATUS.SDLT_PAID];
            
            // Set the newMessage for chat
            pendingChatMessage = "We have paid the SDLT on this submission, once we receive the SDLT5 Certificate we will upload it here and close the matter. No further action is required. Please let me know if you need any further support.";
            
            // Show save hint
            const saveHint = document.getElementById('sdltPaymentSaveHint');
            if (saveHint) {
                saveHint.classList.remove('hidden');
            }
            
            // Send disable-close message first
            window.parent.postMessage({
                type: 'disable-close'
            }, '*');
            
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
                delete pendingUpdates.status;
            }
            pendingChatMessage = null;
            
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
 * Only shows when status is SDLT_PAID
 */
function setupSdlt5CertificateUpload() {
    const input = document.getElementById('sdlt5CertificateFileInput');
    const area = document.getElementById('sdlt5CertificateUpload');
    const documentCard = document.getElementById('sdlt5CertificateDocumentCard');
    const uploadSection = area ? area.closest('.file-upload-section') : null;
    
    if (!input || !area) return;
    
    // Check if status is SDLT_PAID - only show SDLT5 cert section in this case
    // Check both entryData and pendingUpdates to handle unsaved status changes
    const statusArray = entryData?.status || [];
    const pendingStatusArray = pendingUpdates?.status || [];
    const effectiveStatusArray = pendingStatusArray.length > 0 ? pendingStatusArray : statusArray;
    const isSdltPaid = effectiveStatusArray.includes(STATUS.SDLT_PAID);
    
    if (!isSdltPaid) {
        // Hide SDLT5 cert section if status is not SDLT_PAID
        if (documentCard) documentCard.classList.add('hidden');
        if (uploadSection) uploadSection.style.display = 'none';
        updateSdlt5ReplaceHeaderButton();
        return;
    }
    
    const placeholder = area.querySelector('.file-upload-placeholder');
    const selected = area.querySelector('.file-upload-selected');
    const fileNameSpan = selected ? selected.querySelector('.file-name') : null;
    const removeBtn = selected ? selected.querySelector('.remove-file-btn') : null;
    
    // Check if document already exists and show document card
    if (entryData?.sdlt5Certificate?.s3Key) {
        if (documentCard) {
            documentCard.classList.remove('hidden');
            documentCard.innerHTML = `
                <div class="document-card-header">
                    <span class="document-card-title">SDLT5 Certificate (Uploaded)</span>
                    <div class="document-card-actions">
                        <a href="${entryData.sdlt5Certificate.liveUrl || entryData.sdlt5Certificate.url}" target="_blank" class="document-card-link">View</a>
                        <button type="button" class="document-card-btn overwrite-btn" data-field="sdlt5Certificate">Overwrite</button>
                    </div>
                </div>
                <div style="font-size: 0.8rem; color: #666;">
                    ${entryData.sdlt5Certificate.description || 'SDLT5 Certificate'}
                </div>
            `;
            
            // Add click handler for overwrite button
            const overwriteBtn = documentCard.querySelector('.overwrite-btn');
            if (overwriteBtn) {
                overwriteBtn.addEventListener('click', function() {
                    documentCard.classList.add('hidden');
                    if (uploadSection) {
                        uploadSection.style.display = 'block';
                    }
                    input.click();
                });
            }
        }
        // Hide uploader (can be shown via overwrite button)
        if (uploadSection && !accountingFiles.sdlt5Certificate) {
            uploadSection.style.display = 'none';
        }
    } else {
        // Hide document card, show uploader
        if (documentCard) documentCard.classList.add('hidden');
        if (uploadSection) uploadSection.style.display = 'block';
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
            
            // Set the newMessage for chat
            pendingChatMessage = "I have uploaded the SDLT5 Certificate for this submission. The matter is now complete and closed. No further action is required. Please let me know if you need any further support.";
            
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
            updateSdlt5ReplaceHeaderButton();
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
            pendingChatMessage = null;
            
            // Notify form changed
            notifyFormChanged();
            updateSdlt5ReplaceHeaderButton();
        });
    }

    updateSdlt5ReplaceHeaderButton();
}

/**
 * Setup file upload handlers for accounting card
 */
function clearOwnCalculationUploadUI() {
    const input = document.getElementById('sdltOwnCalculationFileInput');
    const area = document.getElementById('sdltOwnCalculationUpload');
    const amountInput = document.getElementById('sdltOwnCalculationAmount');
    if (!input || !area) return;
    input.value = '';
    if (amountInput) amountInput.value = '';
    updateSdltDueBadge();
    const placeholder = area.querySelector('.file-upload-placeholder');
    const selected = area.querySelector('.file-upload-selected');
    const fileNameSpan = selected ? selected.querySelector('.file-name') : null;
    if (placeholder) placeholder.classList.remove('hidden');
    if (selected) selected.classList.add('hidden');
    if (fileNameSpan) fileNameSpan.textContent = '';
    area.classList.remove('has-file');
}

function updateSdltDueBadge() {
    const amountInput = document.getElementById('sdltOwnCalculationAmount');
    const badge = document.getElementById('sdltDueBadge');
    if (!badge) return;
    const val = amountInput?.value?.trim();
    if (!val || val === '') {
        badge.textContent = '';
        badge.className = 'sdlt-due-badge empty';
        return;
    }
    const amount = parseFloat(val);
    if (isNaN(amount) || amount < 0) {
        badge.textContent = 'Enter valid amount';
        badge.className = 'sdlt-due-badge empty';
        return;
    }
    badge.className = amount > 0 ? 'sdlt-due-badge due' : 'sdlt-due-badge not-due';
    badge.textContent = amount > 0 ? 'SDLT due' : 'No SDLT due';
}

function handleToggleOwnCalculationUpload() {
    const section = document.getElementById('sdltOwnCalculationUploadSection');
    const btn = document.getElementById('toggleOwnCalculationUploadBtn');
    if (!section || !btn) return;
    const wasHidden = section.classList.contains('hidden');
    section.classList.toggle('hidden', !wasHidden);
    const nowVisible = !section.classList.contains('hidden');
    btn.setAttribute('aria-expanded', nowVisible ? 'true' : 'false');
    btn.textContent = nowVisible ? 'Hide uploader' : 'Upload own calculation (PDF)';
}

function applyOwnCalculationPdfPendingUpdates() {
    if (!entryData) return false;
    const parsed = parseOwnUploadSdltAmountInput();
    if (!parsed.valid) {
        if (pendingUpdates) {
            delete pendingUpdates.sdltCalculated;
            delete pendingUpdates.sdltDue;
            delete pendingUpdates.sdltRequired;
            delete pendingUpdates.status;
        }
        pendingChatMessage = null;
        return false;
    }

    if (!pendingUpdates) {
        pendingUpdates = {};
    }

    const priorSdltDue = Number(entryData.sdltDue) || 0;
    const isSdltRecalculation = entryHadPriorSdltCalculation(entryData);

    pendingUpdates.sdltCalculated = true;
    pendingUpdates.sdltDue = parsed.value;
    pendingUpdates.sdltRequired = parsed.value > 0;

    pendingChatMessage = buildSdltCalculationChatMessage(priorSdltDue, parsed.value, {
        isRecalculation: isSdltRecalculation
    });

    if (parsed.value > 0) {
        pendingUpdates.status = [STATUS.CALCULATING_SDLT];
        entryData.status = [STATUS.CALCULATING_SDLT];
    } else {
        pendingUpdates.status = [STATUS.NO_SDLT_DUE];
        entryData.status = [STATUS.NO_SDLT_DUE];
        const currentStageTitle = document.getElementById('currentStageTitle');
        const currentStageDescription = document.getElementById('currentStageDescription');
        if (currentStageTitle) currentStageTitle.textContent = 'No SDLT Due';
        if (currentStageDescription) currentStageDescription.textContent = 'SDLT calculation complete - no tax due';
    }
    return true;
}

function setupOwnCalculationPdfUpload() {
    const input = document.getElementById('sdltOwnCalculationFileInput');
    const area = document.getElementById('sdltOwnCalculationUpload');
    const amountInput = document.getElementById('sdltOwnCalculationAmount');
    if (!input || !area) return;

    if (amountInput) {
        amountInput.addEventListener('input', () => {
            updateSdltDueBadge();
            if (pendingPdfBlob) {
                if (applyOwnCalculationPdfPendingUpdates()) {
                    renderWorkflowStage(determineCurrentStage(entryData));
                }
                updateCalculationResultDisplay();
                notifyFormChanged();
            }
        });
        amountInput.addEventListener('change', () => {
            updateSdltDueBadge();
            if (pendingPdfBlob) {
                if (applyOwnCalculationPdfPendingUpdates()) {
                    renderWorkflowStage(determineCurrentStage(entryData));
                }
                updateCalculationResultDisplay();
                notifyFormChanged();
            }
        });
    }

    const placeholder = area.querySelector('.file-upload-placeholder');
    const selected = area.querySelector('.file-upload-selected');
    const fileNameSpan = selected ? selected.querySelector('.file-name') : null;
    const removeBtn = selected ? selected.querySelector('.remove-file-btn') : null;

    function processOwnCalculationFile(file) {
        if (!file || file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return;
        }
        pendingPdfBlob = file;
        if (applyOwnCalculationPdfPendingUpdates()) {
            renderWorkflowStage(determineCurrentStage(entryData));
        }
        updateSdltDueBadge();
        if (placeholder) placeholder.classList.add('hidden');
        if (selected) selected.classList.remove('hidden');
        if (fileNameSpan) fileNameSpan.textContent = file.name;
        area.classList.add('has-file');
        updateCalculationResultDisplay();
        notifyFormChanged();
    }

    area.addEventListener('click', () => {
        if (!pendingPdfBlob || !(pendingPdfBlob instanceof File)) {
            input.click();
        }
    });

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processOwnCalculationFile(file);
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });
    area.addEventListener('drop', (e) => {
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) processOwnCalculationFile(file);
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const wasOwnFile = pendingPdfBlob && typeof File !== 'undefined' && pendingPdfBlob instanceof File;
            pendingPdfBlob = null;
            input.value = '';
            if (amountInput) amountInput.value = '';
            updateSdltDueBadge();
            if (placeholder) placeholder.classList.remove('hidden');
            if (selected) selected.classList.add('hidden');
            area.classList.remove('has-file');
            if (wasOwnFile && pendingUpdates && !entryData.sdltCalculated && !(entryData.sdltCalculation && entryData.sdltCalculation.s3Key)) {
                delete pendingUpdates.sdltCalculated;
                delete pendingUpdates.sdltRequired;
                delete pendingUpdates.sdltDue;
            }
            updateCalculationResultDisplay();
            notifyFormChanged();
        });
    }
}

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
            updateAccountingReplaceHeaderButtons();
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
            updateAccountingReplaceHeaderButtons();
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
    
    // Check if any required documents are selected
    const hasThsInvoice = !!accountingFiles.thsInvoice;
    const hasSdltInvoice = !!accountingFiles.sdltInvoice;
    const hasCompletionStatement = !!accountingFiles.completionStatement;
    const hasAnyDocument = hasThsInvoice || hasSdltInvoice || hasCompletionStatement;
    
    // Add status "Invoices Sent" if any document is selected
    if (hasAnyDocument) {
        pendingUpdates.status = [STATUS.INVOICES_SENT];
    }
    
    // Add flags based on which files are selected
    if (hasThsInvoice) {
        pendingUpdates.feeInvoiceSent = true;
    }
    
    if (hasSdltInvoice) {
        pendingUpdates.sdltInvoiceSent = true;
    }
    
    if (hasCompletionStatement) {
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

