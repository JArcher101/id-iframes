/**
 * =====================================================================
 * THIRDFORT CHECKS LIST - JavaScript Functionality
 * =====================================================================
 * Handles the display and interaction of Thirdfort checks in a list format
 * with detailed modal views based on the check object structure
 * =====================================================================
 */

class ThirdfortChecksList {
    constructor() {
        this.checks = [];
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupMessageListener();
        this.showLoading();
    }
    
    setupEventListeners() {
        // Mock data button
        document.getElementById('mock-data-btn').addEventListener('click', () => {
            this.loadMockData();
        });
        
        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('check-detail-modal').addEventListener('click', (e) => {
            if (e.target.id === 'check-detail-modal') {
                this.closeModal();
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }
    
    setupMessageListener() {
        // Listen for postMessage from parent window
        window.addEventListener('message', (event) => {
            console.log('&#xD83D;&#xDCE8; Received message:', event.data);
            
            if (event.data && event.data.type === 'client-checks') {
                this.handleClientChecks(event.data.data);
            }
        });
    }
    
    handleClientChecks(checksData) {
        console.log('&#xD83D;&#xDCCB; Processing client checks data:', checksData);
        
        if (Array.isArray(checksData)) {
            this.checks = checksData;
            this.renderChecks();
            this.hideLoading();
        } else {
            console.error('&#x274C; Invalid checks data format');
            this.showError('Invalid data format received');
        }
    }
    
    showLoading() {
        this.isLoading = true;
        const loading = document.getElementById('loading');
        loading.classList.remove('hidden');
        loading.classList.add('spinner-only');
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('checks-list').innerHTML = '';
    }
    
    hideLoading() {
        this.isLoading = false;
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
        loading.classList.remove('spinner-only');
    }
    
    showError(message) {
        this.hideLoading();
        const emptyState = document.getElementById('empty-state');
        emptyState.querySelector('h3').textContent = 'Error';
        emptyState.querySelector('p').textContent = message;
        emptyState.classList.remove('hidden');
    }
    
    loadMockData() {
        console.log('&#xD83C;&#xDFAD; Loading mock data...');
        this.showLoading();
        
        // Simulate loading delay
        setTimeout(() => {
            this.checks = this.generateMockData();
            this.renderChecks();
            this.hideLoading();
        }, 1000);
    }
    
    generateMockData() {
        // Generate comprehensive mock data based on backend check types
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        
        return [
            // Electronic ID - Completed with Safe Harbour
            {
                id: "tf_electronic_001",
                type: "electronic-id",
                status: "closed",
                ref: "Property Purchase - 21 Green Lane, London",
                thirdfortData: {
                    transactionId: "tf_electronic_001",
                    actor: {
                        name: "James Mitchell",
                        phone: "+447506430094",
                        email: "james.mitchell@example.com",
                        type: "purchaser"
                    },
                    tasks: [
                        { type: "report:identity", opts: { nfc: "preferred" } },
                        { type: "report:footprint", opts: { consent: false } },
                        { type: "report:peps", opts: { monitored: true } },
                        { type: "documents:poa" },
                        { type: "report:sof-v1" }
                    ]
                },
                createdAt: threeDaysAgo.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                checkReturned: true,
                riskIndicator: false,
                pepStatus: undefined,
                safeHarbour: {
                    isCompliant: true,
                    criteria: [
                        "Enhanced NFC ID completed",
                        "Address verification passed",
                        "PEP screening clear",
                        "No risk indicators"
                    ]
                },
                esofStatus: {
                    questionnaire: "completed",
                    bankLinking: "completed",
                    bankStatement: "completed"
                },
                reports: [
                    {
                        type: "identity",
                        status: "clear",
                        completedAt: twoDaysAgo.toISOString()
                    },
                    {
                        type: "peps",
                        status: "clear",
                        completedAt: twoDaysAgo.toISOString()
                    },
                    {
                        type: "sanctions",
                        status: "clear",
                        completedAt: twoDaysAgo.toISOString()
                    }
                ],
                assessment: {
                    outcome: "CLEAR",
                    confidence: "high"
                }
            },
            
            // KYB Check - Processing
            {
                id: "tf_kyb_001",
                type: "kyb",
                status: "processing",
                ref: "Company Verification - Thurstan Hoskin Solicitors LLP",
                thirdfortData: {
                    checkId: "tf_kyb_001",
                    company: {
                        id: "223822293",
                        name: "THURSTAN HOSKIN SOLICITORS LLP",
                        number: "OC421980",
                        jurisdiction: "UK",
                        type: "LLP"
                    },
                    reports: [
                        { type: "company:summary" },
                        { type: "company:sanctions", opts: { monitored: true } },
                        { type: "company:ubo" },
                        { type: "company:registry" }
                    ]
                },
                createdAt: yesterday.toISOString(),
                checkReturned: false,
                riskIndicator: false,
                pepStatus: undefined,
                kybReports: [
                    {
                        type: "company:summary",
                        status: "processing"
                    },
                    {
                        type: "company:sanctions",
                        status: "processing"
                    },
                    {
                        type: "company:ubo",
                        status: "processing"
                    }
                ]
            },
            
            // Lite Screen - Completed with PEP Alert
            {
                id: "tf_lite_001",
                type: "lite-screen",
                status: "closed",
                ref: "Lite Screening - Property Sale",
                thirdfortData: {
                    transactionId: "tf_lite_001",
                    actor: {
                        name: "Sarah Johnson",
                        phone: "+447123456789",
                        email: "sarah.johnson@example.com"
                    },
                    tasks: [
                        { type: "report:aml" },
                        { type: "report:address" },
                        { type: "report:sanctions" }
                    ]
                },
                createdAt: twoDaysAgo.toISOString(),
                completedAt: yesterday.toISOString(),
                checkReturned: true,
                riskIndicator: true,
                pepStatus: ["PPEP"],
                pepUpdates: [
                    {
                        type: "peps",
                        status: "alert",
                        detectedAt: yesterday.toISOString(),
                        reason: "New PEP match detected",
                        alertSeverity: "high",
                        matchCount: 2,
                        affectedPerson: "Sarah Johnson",
                        alertType: "new_match",
                        detailedReason: "2 new PEP matches found for Sarah Johnson - includes Minister of Finance and MP positions",
                        riskLevel: "high",
                        requiresReview: true,
                        autoResolved: false
                    }
                ],
                reports: [
                    {
                        type: "aml",
                        status: "alert",
                        completedAt: yesterday.toISOString()
                    },
                    {
                        type: "address",
                        status: "clear",
                        completedAt: yesterday.toISOString()
                    },
                    {
                        type: "sanctions",
                        status: "clear",
                        completedAt: yesterday.toISOString()
                    }
                ],
                assessment: {
                    outcome: "CONSIDER",
                    reasons: ["PEP match detected"],
                    confidence: "medium"
                },
                taskOutcomes: {
                    peps: {
                        result: "alert",
                        status: "closed",
                        data: {
                            total_hits: 2
                        }
                    },
                    address: {
                        result: "alert",
                        status: "closed",
                        data: {
                            quality: 75
                        }
                    },
                    facial_similarity: {
                        result: "alert",
                        status: "closed",
                        data: {
                            comparison: "fair_match"
                        }
                    }
                }
            },
            
            // IDV Check - Processing
            {
                id: "tf_idv_001",
                type: "idv",
                status: "processing",
                ref: "Document Verification - Passport",
                thirdfortData: {
                    checkId: "tf_idv_001",
                    actor: {
                        name: "Michael Brown",
                        phone: "+447987654321",
                        email: "michael.brown@example.com"
                    }
                },
                createdAt: yesterday.toISOString(),
                checkReturned: false,
                riskIndicator: false,
                pepStatus: undefined,
                documents: [
                    {
                        type: "front_image",
                        s3Key: "protected/abc123/passport-front.jpg",
                        uploadedAt: yesterday.toISOString()
                    },
                    {
                        type: "back_image",
                        s3Key: "protected/abc123/passport-back.jpg",
                        uploadedAt: yesterday.toISOString()
                    }
                ],
                reports: [
                    {
                        type: "document_verification",
                        status: "processing"
                    }
                ]
            },
            
            // Electronic ID - Aborted
            {
                id: "tf_electronic_002",
                type: "electronic-id",
                status: "aborted",
                ref: "Property Purchase - 15 Oak Street",
                thirdfortData: {
                    transactionId: "tf_electronic_002",
                    actor: {
                        name: "Emma Wilson",
                        phone: "+447555123456",
                        email: "emma.wilson@example.com",
                        type: "purchaser"
                    }
                },
                createdAt: threeDaysAgo.toISOString(),
                checkReturned: false,
                riskIndicator: false,
                pepStatus: undefined,
                assessment: {
                    outcome: "ABORTED",
                    reasons: ["Consumer did not complete verification"],
                    confidence: "low"
                }
            },
            
            // KYB Check - Completed with Sanctions Alert
            {
                id: "tf_kyb_002",
                type: "kyb",
                status: "closed",
                ref: "Company Verification - ABC Corporation Ltd",
                thirdfortData: {
                    checkId: "tf_kyb_002",
                    company: {
                        id: "12345678",
                        name: "ABC CORPORATION LTD",
                        number: "12345678",
                        jurisdiction: "UK",
                        type: "LTD"
                    }
                },
                createdAt: threeDaysAgo.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                checkReturned: true,
                riskIndicator: true,
                pepStatus: ["PSANCTIONS"],
                pepUpdates: [
                    {
                        type: "sanctions",
                        status: "alert",
                        detectedAt: twoDaysAgo.toISOString(),
                        reason: "New sanctions match detected",
                        alertSeverity: "critical",
                        matchCount: 1,
                        affectedEntity: "ABC Corporation Ltd",
                        alertType: "new_match",
                        detailedReason: "1 new sanctions match found for ABC Corporation Ltd - OFAC list",
                        riskLevel: "critical",
                        requiresReview: true,
                        autoResolved: false
                    }
                ],
                kybReports: [
                    {
                        type: "company:summary",
                        status: "clear",
                        completedAt: twoDaysAgo.toISOString()
                    },
                    {
                        type: "company:sanctions",
                        status: "alert",
                        completedAt: twoDaysAgo.toISOString()
                    },
                    {
                        type: "company:ubo",
                        status: "clear",
                        completedAt: twoDaysAgo.toISOString()
                    }
                ],
                assessment: {
                    outcome: "CONSIDER",
                    reasons: ["Sanctions match detected"],
                    confidence: "high"
                },
                taskOutcomes: {
                    sanctions: {
                        result: "alert",
                        status: "closed",
                        data: {
                            total_hits: 1
                        }
                    },
                    address: {
                        result: "fail",
                        status: "closed",
                        data: {
                            quality: 65
                        }
                    }
                }
            },
            
            // Lite Screen - Open (just created)
            {
                id: "tf_lite_002",
                type: "lite-screen",
                status: "open",
                ref: "Lite Screening - New Client",
                thirdfortData: {
                    transactionId: "tf_lite_002",
                    actor: {
                        name: "David Thompson",
                        phone: "+447234567890",
                        email: "david.thompson@example.com"
                    }
                },
                createdAt: now.toISOString(),
                checkReturned: false,
                riskIndicator: false,
                pepStatus: undefined,
                reports: [
                    {
                        type: "aml",
                        status: "pending"
                    },
                    {
                        type: "address",
                        status: "pending"
                    },
                    {
                        type: "sanctions",
                        status: "pending"
                    }
                ]
            }
        ];
    }
    
    
    renderChecks() {
        const checksList = document.getElementById('checks-list');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        
        // Show loading
        loading.classList.remove('hidden');
        checksList.innerHTML = '';
        emptyState.classList.add('hidden');
        
        // Simulate loading delay
        setTimeout(() => {
            loading.classList.add('hidden');
            
            if (this.checks.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }
            
            this.checks.forEach(check => {
                const checkElement = this.createCheckElement(check);
                checksList.appendChild(checkElement);
            });
        }, 300);
    }
    
    createCheckElement(check) {
        const checkElement = document.createElement('div');
        checkElement.className = 'check-item';
        checkElement.dataset.checkId = check.id;
        
        // Check if PEP monitoring is enabled
        const isMonitoringEnabled = this.isMonitoringEnabled(check);
        
        // Get check type display name
        const checkType = this.getCheckTypeDisplayName(check.type);
        
        // Get status icon
        const statusIcon = this.getStatusIcon(check.status);
        
        // Get assessment outcome
        const assessment = this.getAssessmentOutcome(check);
        
        // Check if Safe Harbour compliant
        const isSafeHarbour = check.safeHarbour?.isCompliant && check.type === 'electronic-id';
        
        // Get initiation details
        const initiatorName = check.thirdfortData?.actor?.name || 'Unknown';
        const initiationDate = new Date(check.createdAt).toLocaleString();
        
        checkElement.innerHTML = `
            <!-- Column 1: Monitoring Dot -->
            ${isMonitoringEnabled ? '<div class="monitoring-dot"></div>' : '<div></div>'}
            
            <!-- Column 2: Status Icon -->
            <div class="status-icon ${check.status}">
                ${statusIcon}
            </div>
            
            <!-- Column 3: Check Type and Details -->
            <div class="check-type-section">
                <div class="check-type-row">
                    <span class="check-type">${checkType}</span>
                    ${check.status === 'closed' ? `
                        <span class="status-tag ${assessment.toLowerCase()}">${assessment}</span>
                        ${isSafeHarbour ? '<span class="safe-harbour-icon">&#xD83D;&#xDD12;</span>' : ''}
                    ` : ''}
                </div>
                <div class="initiation-details">
                    <span class="initiation-name">Initiated by: ${initiatorName}</span>
                    <span class="initiation-date">${initiationDate}</span>
                </div>
            </div>
            
            <!-- Column 4: Warnings and Info Tips -->
            <div class="warnings-section">
                ${this.generateWarnings(check)}
            </div>
            
            <!-- Column 5: Placeholder -->
            <div></div>
            
            <!-- Column 6: Placeholder -->
            <div></div>
        `;
        
        // Add click handler
        checkElement.addEventListener('click', () => {
            this.openCheckDetail(check);
        });
        
        return checkElement;
    }
    
    // Check if PEP monitoring is enabled
    isMonitoringEnabled(check) {
        const pepTask = check.thirdfortData?.tasks?.find(task => task.type === "report:peps");
        return pepTask && pepTask.opts && pepTask.opts.monitored === true;
    }
    
    // Get check type display name
    getCheckTypeDisplayName(type) {
        const typeMap = {
            'electronic-id': 'Enhanced ID Check',
            'idv': 'Identity Document Verification',
            'kyb': 'Know Your Business',
            'lite-screen': 'Lite Screen',
            'original-id': 'Original ID Check'
        };
        return typeMap[type] || type;
    }
    
    // Get status icon
    getStatusIcon(status) {
        switch(status) {
            case 'closed':
                return '&#x2713;';
            case 'open':
            case 'processing':
                return '&#x23F3;';
            case 'aborted':
            case 'cancelled':
                return '&#x2717;';
            default:
                return '&#x23F3;';
        }
    }
    
    // Get assessment outcome
    getAssessmentOutcome(check) {
        if (check.assessment?.outcome) {
            return check.assessment.outcome;
        }
        
        // Fallback: check if all task outcomes are clear
        if (check.taskOutcomes) {
            const outcomes = Object.values(check.taskOutcomes);
            const hasAlert = outcomes.some(outcome => outcome.result === 'alert' || outcome.result === 'fail');
            return hasAlert ? 'CONSIDER' : 'CLEAR';
        }
        
        return 'CLEAR';
    }
    
    // Generate warnings based on task outcomes (only for closed checks)
    generateWarnings(check) {
        // Only show warnings for closed checks
        if (check.status !== 'closed' || !check.taskOutcomes) {
            return '';
        }
        
        const warnings = [];
        
        // Check all task outcomes for non-clear results
        Object.entries(check.taskOutcomes).forEach(([taskType, outcome]) => {
            if (outcome.result === 'clear') {
                return; // Skip clear results
            }
            
            // Handle different task types and their specific issues
            switch (taskType) {
                case 'address':
                    if (outcome.result === 'fail') {
                        warnings.push({
                            type: 'fail',
                            icon: '&#x2717;',
                            message: 'Address count less than 2'
                        });
                    } else if (outcome.data?.quality && outcome.data.quality < 80) {
                        warnings.push({
                            type: 'warning',
                            icon: '!',
                            message: 'Address quality not sufficient'
                        });
                    }
                    break;
                    
                case 'facial_similarity':
                    if (outcome.data?.comparison && outcome.data.comparison !== 'good_match') {
                        const score = outcome.data.comparison === 'poor_match' ? '60%' : '80%';
                        warnings.push({
                            type: 'info',
                            icon: 'i',
                            message: `Facial similarity only ${score}`
                        });
                    }
                    break;
                    
                case 'document':
                    if (outcome.data?.integrity && outcome.data.integrity !== 'passed') {
                        warnings.push({
                            type: 'fail',
                            icon: '&#x2717;',
                            message: 'Document integrity failed'
                        });
                    }
                    break;
                    
                case 'identity':
                    // Enhanced ID downgrade (Original instead of Enhanced)
                    if (check.type === 'electronic-id' && outcome.data?.nfc_used === false) {
                        warnings.push({
                            type: 'info',
                            icon: 'i',
                            message: 'Enhanced Downgrade'
                        });
                    }
                    break;
                    
                case 'peps':
                    if (outcome.data?.total_hits && outcome.data.total_hits > 0) {
                        warnings.push({
                            type: 'warning',
                            icon: '!',
                            message: `${outcome.data.total_hits} PEP hits`
                        });
                    }
                    break;
                    
                case 'sanctions':
                    if (outcome.data?.total_hits && outcome.data.total_hits > 0) {
                        warnings.push({
                            type: 'warning',
                            icon: '!',
                            message: `${outcome.data.total_hits} Sanctions hits`
                        });
                    }
                    break;
                    
                default:
                    // Generic handling for any other non-clear results
                    if (outcome.result === 'alert') {
                        warnings.push({
                            type: 'warning',
                            icon: '!',
                            message: `${taskType} alert`
                        });
                    } else if (outcome.result === 'fail') {
                        warnings.push({
                            type: 'fail',
                            icon: '&#x2717;',
                            message: `${taskType} failed`
                        });
                    }
                    break;
            }
        });
        
        // Generate HTML for warnings
        if (warnings.length === 0) {
            return '';
        }
        
        return warnings.map(warning => `
            <span class="warning-item ${warning.type}">
                <span class="warning-icon">${warning.icon}</span>
                <span>${warning.message}</span>
            </span>
        `).join('');
    }
    
    getRiskIndicators(check) {
        const indicators = [];
        
        if (check.pepStatus && check.pepStatus.includes('PPEP')) {
            indicators.push({ type: 'pep', label: 'PEP Alert' });
        }
        
        if (check.riskIndicator) {
            indicators.push({ type: 'risk-indicator', label: 'Risk' });
        }
        
        if (check.safeHarbour?.isCompliant) {
            indicators.push({ type: 'safe-harbour', label: 'Safe Harbour' });
        }
        
        // Check for sanctions status
        if (check.pepStatus && check.pepStatus.includes('PSANCTIONS')) {
            indicators.push({ type: 'sanctions', label: 'Sanctions Alert' });
        }
        
        return indicators;
    }
    
    formatCheckType(type) {
        const typeMap = {
            'electronic-id': 'Electronic ID',
            'kyb': 'KYB',
            'lite-screen': 'Lite Screen',
            'idv': 'IDV'
        };
        return typeMap[type] || type;
    }
    
    openCheckDetail(check) {
        const modal = document.getElementById('check-detail-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.querySelector('.modal-body');
        
        modalTitle.textContent = `${check.ref} - Details`;
        modalBody.innerHTML = this.createCheckDetailContent(check);
        
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    createCheckDetailContent(check) {
        const actor = check.thirdfortData?.actor;
        const company = check.thirdfortData?.company;
        const reports = check.reports || [];
        const kybReports = check.kybReports || [];
        const pepUpdates = check.pepUpdates || [];
        
        return `
            <div class="detail-section">
                <h3>Basic Information</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Check ID:</span>
                        <span class="detail-value">${check.id}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${this.formatCheckType(check.type)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value status ${check.status}">${check.status}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Reference:</span>
                        <span class="detail-value">${check.ref}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value">${new Date(check.createdAt).toLocaleString()}</span>
                    </div>
                    ${check.completedAt ? `
                    <div class="detail-row">
                        <span class="detail-label">Completed:</span>
                        <span class="detail-value">${new Date(check.completedAt).toLocaleString()}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${actor ? `
            <div class="detail-section">
                <h3>Actor Information</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${actor.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${actor.email}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${actor.phone}</span>
                    </div>
                    ${actor.type ? `
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${actor.type}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${company ? `
            <div class="detail-section">
                <h3>Company Information</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Name:</span>
                        <span class="detail-value">${company.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Number:</span>
                        <span class="detail-value">${company.number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Jurisdiction:</span>
                        <span class="detail-value">${company.jurisdiction}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type:</span>
                        <span class="detail-value">${company.type}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${check.safeHarbour ? `
            <div class="detail-section">
                <h3>Safe Harbour Compliance</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Compliant:</span>
                        <span class="detail-value status ${check.safeHarbour.isCompliant ? 'clear' : 'fail'}">
                            ${check.safeHarbour.isCompliant ? 'Yes' : 'No'}
                        </span>
                    </div>
                    ${check.safeHarbour.criteria ? `
                    <div class="detail-row">
                        <span class="detail-label">Criteria:</span>
                        <span class="detail-value">
                            <ul style="margin: 0; padding-left: 20px;">
                                ${check.safeHarbour.criteria.map(criteria => `<li>${criteria}</li>`).join('')}
                            </ul>
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${check.esofStatus ? `
            <div class="detail-section">
                <h3>eSoF (Source of Funds) Status</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Questionnaire:</span>
                        <span class="detail-value status ${check.esofStatus.questionnaire}">${check.esofStatus.questionnaire}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Bank Linking:</span>
                        <span class="detail-value status ${check.esofStatus.bankLinking}">${check.esofStatus.bankLinking}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Bank Statement:</span>
                        <span class="detail-value status ${check.esofStatus.bankStatement}">${check.esofStatus.bankStatement}</span>
                    </div>
                </div>
            </div>
            ` : ''}
            
            ${reports.length > 0 ? `
            <div class="detail-section">
                <h3>Reports</h3>
                <div class="reports-section">
                    ${reports.map(report => `
                        <div class="report-item">
                            <div class="report-header">
                                <span class="report-type">${report.type}</span>
                                <span class="report-status ${report.status}">${report.status}</span>
                            </div>
                            ${report.completedAt ? `
                            <div class="detail-row">
                                <span class="detail-label">Completed:</span>
                                <span class="detail-value">${new Date(report.completedAt).toLocaleString()}</span>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${kybReports.length > 0 ? `
            <div class="detail-section">
                <h3>KYB Reports</h3>
                <div class="reports-section">
                    ${kybReports.map(report => `
                        <div class="report-item">
                            <div class="report-header">
                                <span class="report-type">${report.type}</span>
                                <span class="report-status ${report.status}">${report.status}</span>
                            </div>
                            ${report.completedAt ? `
                            <div class="detail-row">
                                <span class="detail-label">Completed:</span>
                                <span class="detail-value">${new Date(report.completedAt).toLocaleString()}</span>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${pepUpdates.length > 0 ? `
            <div class="detail-section">
                <h3>PEP/Sanctions Monitoring Updates</h3>
                <div class="reports-section">
                    ${pepUpdates.map(update => `
                        <div class="report-item">
                            <div class="report-header">
                                <span class="report-type">${update.type} Update</span>
                                <span class="report-status ${update.status}">${update.status}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Detected:</span>
                                <span class="detail-value">${new Date(update.detectedAt).toLocaleString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Reason:</span>
                                <span class="detail-value">${update.reason}</span>
                            </div>
                            ${update.alertSeverity ? `
                            <div class="detail-row">
                                <span class="detail-label">Severity:</span>
                                <span class="detail-value">${update.alertSeverity}</span>
                            </div>
                            ` : ''}
                            ${update.matchCount ? `
                            <div class="detail-row">
                                <span class="detail-label">Match Count:</span>
                                <span class="detail-value">${update.matchCount}</span>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}
            
            ${check.assessment ? `
            <div class="detail-section">
                <h3>Assessment</h3>
                <div class="detail-grid">
                    <div class="detail-row">
                        <span class="detail-label">Outcome:</span>
                        <span class="detail-value status ${check.assessment.outcome.toLowerCase()}">${check.assessment.outcome}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Confidence:</span>
                        <span class="detail-value">${check.assessment.confidence}</span>
                    </div>
                    ${check.assessment.reasons && check.assessment.reasons.length > 0 ? `
                    <div class="detail-row">
                        <span class="detail-label">Reasons:</span>
                        <span class="detail-value">
                            <ul style="margin: 0; padding-left: 20px;">
                                ${check.assessment.reasons.map(reason => `<li>${reason}</li>`).join('')}
                            </ul>
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
        `;
    }
    
    closeModal() {
        const modal = document.getElementById('check-detail-modal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ThirdfortChecksList();
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThirdfortChecksList;
}
