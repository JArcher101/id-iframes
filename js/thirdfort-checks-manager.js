                                                                                                                                                                                                                                        // =====================================================================
// THIRDFORT CHECKS MANAGER - Main JavaScript
// =====================================================================
// Manages Thirdfort check display in list and detail views
// Communicates with parent via postMessage
// =====================================================================

class ThirdfortChecksManager {
    constructor() {
        this.checks = [];
        this.currentCheck = null;
        this.currentView = 'loading'; // 'loading', 'list', 'detail'
        this.mode = 'edit'; // 'view' or 'edit' - controls interaction permissions
        this.checkIdentityImages = {};
        
        // DOM elements
        this.loadingState = document.getElementById('loading-state');
        this.listView = document.getElementById('list-view');
        this.detailView = document.getElementById('detail-view');
        this.checksList = document.getElementById('checks-list');
        this.mockDataBtn = document.getElementById('mock-data-btn');
        
        // Detail view elements
        this.backBtn = document.getElementById('back-btn');
        this.detailHeader = document.getElementById('detail-header');
        this.monitoringCard = document.getElementById('monitoring-card');
        this.abortCard = document.getElementById('abort-card');
        this.retryCard = document.getElementById('retry-card');
        this.detailsCard = document.getElementById('details-card');
        this.documentDetailsCard = document.getElementById('document-details-card');
        this.pepUpdatesCard = document.getElementById('pep-updates-card');
        this.redFlagsCard = document.getElementById('red-flags-card');
        this.tasksSection = document.getElementById('tasks-section');
        this.updatesSection = document.getElementById('updates-section');
        
        this.init();
    }
    
    init() {
        console.log('🔍 Thirdfort Checks Manager initialized');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Listen for messages from parent
        window.addEventListener('message', (event) => this.handleMessage(event));
        
        // Notify parent that iframe is ready
        this.sendMessage('iframe-ready', {});
    }
    
    setupEventListeners() {
        // Back button
        this.backBtn?.addEventListener('click', () => this.showListView());
        
        // Mock data button (for development/testing)
        this.mockDataBtn?.addEventListener('click', () => this.loadMockData());
    }
    
    // ===================================================================
    // MESSAGE HANDLING
    // ===================================================================
    // Parent sends 'checks-data' message with:
    //   - checks: array of check objects
    //   - mode: 'view' or 'edit' (optional, defaults to 'edit')
    //   - thirdfortEnv: 'sandbox' or 'production' (optional, defaults to 'sandbox')
    //
    // VIEW MODE: Read-only access
    //   - CAN view all check details
    //   - CAN open PDF reports
    //   - CANNOT toggle monitoring
    //   - CANNOT abort checks
    //   - CANNOT open in Thirdfort portal (expand arrow hidden)
    //
    // EDIT MODE: Full access (default)
    //   - All interactions enabled
    //   - Can toggle monitoring
    //   - Can abort checks
    //   - Can open in Thirdfort portal
    //
    // THIRDFORT ENVIRONMENT:
    //   - 'production': Opens transactions at https://app.thirdfort.com
    //   - 'sandbox': Opens transactions at https://sandbox.app.thirdfort.com (default)
    // ===================================================================
    
    handleMessage(event) {
        const { type, data } = event.data;
        
        // console.log('📨 Message received:', type, data); // Commented out to avoid logging client data
        
        switch (type) {
            case 'checks-data':
                // Close any open overlays and load new data
                this.closeAllOverlays();
                this.mode = data.mode || 'edit';
                console.log(`🔒 Mode set to: ${this.mode}`);
                this.loadChecks(data.checks || []);
                break;
                
            case 'open-check':
                // Open a specific check by ID
                this.handleOpenCheck(data);
                break;
                
            case 'current-check':
                // Respond with the currently open check ID
                this.handleCurrentCheck();
                break;
                
            case 'save-success':
                // console.log('✅ Save successful:', data); // Commented out to avoid logging client data
                this.handleSaveSuccess(data);
                break;
                
            case 'error':
                console.error('❌ Error from parent:', data.message);
                this.showError(data.message);
                break;
                
            case 'check-images':
                this.handleCheckImages((data && data.images) || []);
                break;
        }
    }
    
    
    handleCurrentCheck() {
        // Determine the current check ID if a check is open
        let checkId = undefined;
        
        if (this.currentCheck) {
            // A check is currently open - get its ID
            checkId = this.currentCheck.transactionId || this.currentCheck.checkId;
            console.log('📤 Responding with current check ID:', checkId);
        } else {
            // No check is open - we're in list view
            console.log('📤 Responding with undefined (no check open, in list view)');
        }
        
        // Send response back to parent
        this.sendMessage('refresh-entry', { check_id: checkId });
    }
    
    handleOpenCheck(data) {
        if (!data || !data.id) {
            console.error('❌ open-check message missing id:', data);
            this.showError('Invalid check ID provided');
            return;
        }
        
        const checkId = data.id;
        console.log('🔍 Opening check with ID:', checkId);
        
        // Find the check by checkId or transactionId
        const check = this.checks.find(c => 
            c.checkId === checkId || c.transactionId === checkId
        );
        
        if (!check) {
            console.error('❌ Check not found:', checkId);
            console.log('📊 Available checks:', this.checks.map(c => ({
                checkId: c.checkId,
                transactionId: c.transactionId
            })));
            this.showError(`Check with ID "${checkId}" not found in the current checks list`);
            return;
        }
        
        console.log('✅ Found check, opening detail view:', check.checkId || check.transactionId);
        
        // Close any open overlays
        this.closeAllOverlays();
        
        // Open the check detail view
        this.showDetailView(check);
    }
    
    handleSaveSuccess(data) {
        // Handle successful save based on what was saved
        if (this.pendingSave) {
            const saveType = this.pendingSave.type;
            const savedAnnotations = this.pendingSave.annotations; // Store annotations that were just saved
            
            if (saveType === 'consider') {
                // Update local check object with new annotations before generating PDF
                if (savedAnnotations && this.currentCheck) {
                    if (!this.currentCheck.considerAnnotations) {
                        this.currentCheck.considerAnnotations = [];
                    }
                    // Add user info and _id to annotations (matching backend format)
                    const userEmail = data.userEmail || 'unknown';
                    const userName = userEmail.split('@')[0];
                    
                    savedAnnotations.forEach(ann => {
                        this.currentCheck.considerAnnotations.unshift({
                            _id: 'temp_' + Date.now() + Math.random().toString(36).substr(2, 9),
                            taskType: ann.taskType,
                            objectivePath: ann.objectivePath,
                            originalStatus: ann.originalStatus,
                            newStatus: ann.newStatus,
                            reason: ann.reason,
                            timestamp: ann.timestamp,
                            user: userEmail,
                            userName: userName
                        });
                    });
                    console.log(`✅ Added ${savedAnnotations.length} annotations to local check object`);
                    console.log('📊 Total annotations now:', this.currentCheck.considerAnnotations.length);
                }
                
                // Generate PDF and open in popup (auto-save = true)
                console.log('📄 Generating consider annotations PDF...');
                this.generateConsiderPDF(true); // Pass true for auto-save
                // Close overlay after PDF generation starts
                setTimeout(() => this.closeConsiderOverlay(), 500);
            } else if (saveType === 'pep-dismissal') {
                // Update local check object with new dismissals before generating PDF
                if (this.pendingSave.dismissals && this.currentCheck) {
                    if (!this.currentCheck.pepDismissals) {
                        this.currentCheck.pepDismissals = [];
                    }
                    
                    // Add user info and _id to dismissals (matching backend format)
                    const userEmail = data.userEmail || 'unknown';
                    const userName = userEmail.split('@')[0];
                    const timestamp = new Date().toISOString();
                    
                    // Flatten all hits from all dismissal batches
                    this.pendingSave.dismissals.forEach(batch => {
                        batch.hits.forEach(hit => {
                            this.currentCheck.pepDismissals.unshift({
                                _id: 'temp_' + Date.now() + Math.random().toString(36).substr(2, 9),
                                hitId: hit.id,
                                hitName: hit.name,
                                reportId: batch.reportId,
                                reportType: hit.type,
                                reason: batch.reason,
                                timestamp: timestamp,
                                user: userEmail,
                                userName: userName
                            });
                        });
                    });
                    console.log(`✅ Added ${this.pendingSave.dismissals.reduce((sum, b) => sum + b.hits.length, 0)} dismissals to local check object`);
                    console.log('📊 Total dismissals now:', this.currentCheck.pepDismissals.length);
                }
                
                // Generate PDF and open in popup (auto-save = true)
                console.log('📄 Generating PEP dismissals PDF...');
                this.generatePepDismissalsPDF(true); // Pass true for auto-save
                // Close overlay after PDF generation starts
                setTimeout(() => this.closePepOverlay(), 500);
            } else if (saveType === 'sof') {
                // Generate PDF and open in popup (auto-save = true)
                console.log('📄 Generating SoF investigation PDF...');
                this.generateSofPDF(true); // Pass true for auto-save
                // Close overlay after PDF generation starts
                setTimeout(() => this.closeSofOverlay(), 500);
            }
            
            this.pendingSave = null;
        }
    }
    
    showError(message) {
        // Create error banner at top of current view
        const errorBanner = document.createElement('div');
        errorBanner.style.cssText = `
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            margin: 10px 0;
            border-radius: 8px;
            font-family: 'RotisRegular', sans-serif;
            font-size: 0.9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 2px 8px rgba(220, 53, 69, 0.3);
            animation: slideDown 0.3s ease;
        `;
        
        errorBanner.innerHTML = `
            <div>
                <strong style="display: block; margin-bottom: 5px;">Error</strong>
                ${message || 'An error occurred. Please try again.'}
            </div>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0 5px;
                line-height: 1;
            ">×</button>
        `;
        
        // Add to current visible view
        const activeView = document.querySelector('#list-view:not(.hidden), #detail-view:not(.hidden)');
        if (activeView) {
            activeView.insertBefore(errorBanner, activeView.firstChild);
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (errorBanner.parentElement) {
                    errorBanner.style.opacity = '0';
                    errorBanner.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => errorBanner.remove(), 300);
                }
            }, 8000);
        }
    }
    
    sendMessage(type, data) {
        window.parent.postMessage({ type, data }, '*');
    }
    
    // ===================================================================
    // ACTIONS (Post messages to parent)
    // ===================================================================
    
    abortCheck() {
        if (!this.currentCheck) return;
        
        const checkType = this.currentCheck.transactionId ? 'transaction' : 'check';
        const checkId = this.currentCheck.transactionId || this.currentCheck.checkId;
        
        this.sendMessage('cancel-check', {
            id: checkId,
            type: checkType
        });
    }
    
    toggleMonitoring(enabled) {
        if (!this.currentCheck) return;
        
        const checkType = this.currentCheck.transactionId ? 'transaction' : 'check';
        const checkId = this.currentCheck.transactionId || this.currentCheck.checkId;
        
        this.sendMessage('monitoring-patch', {
            id: checkId,
            type: checkType,
            enabled: enabled
        });
    }
    
    viewPDF(s3Key) {
        this.sendMessage('view-pdf', {
            s3Key: s3Key
        });
    }
    
    // ===================================================================
    // DATA LOADING
    // ===================================================================
    
    loadChecks(checks) {
        console.log('📊 Loading checks:', checks.length);
        
        this.checkIdentityImages = {};
        this.currentCheck = null;
        this.checks = checks;
        
        if (checks.length === 0) {
            this.showEmptyState();
        } else {
            this.renderChecksList();
            this.showListView();
        }
    }
    
    // ===================================================================
    // VIEW MANAGEMENT
    // ===================================================================
    
    /**
     * Centralized view switcher - ensures only ONE view visible at a time
     * @param {string} view - 'loading' | 'empty' | 'list' | 'detail'
     */
    switchView(view) {
        console.log('🔄 Switching view to:', view);
        
        // Step 1: Hide ALL views
        this.loadingState.classList.add('hidden');
        this.listView.classList.add('hidden');
        this.detailView.classList.add('hidden');
        
        // Step 2: Show requested view
        if (view === 'loading') {
            this.loadingState.classList.remove('hidden');
        } else if (view === 'empty') {
            this.emptyState.classList.remove('hidden');
        } else if (view === 'list') {
            this.listView.classList.remove('hidden');
        } else if (view === 'detail') {
            this.detailView.classList.remove('hidden');
        }
    }
    
    /**
     * Show list view
     */
    
    showListView() {
        // Close any open overlays when going back to list
        this.closeAllOverlays();
        this.switchView('list');
    }
    
    showDetailView(check) {
        this.currentCheck = check;
        this.switchView('detail');
        this.renderDetailView(check);
    }
    
    showEmptyState() {
        this.switchView('empty');
    }
    
    // ===================================================================
    // LIST VIEW RENDERING
    // ===================================================================
    
    renderChecksList() {
        this.checksList.innerHTML = '';
        
        this.checks.forEach(check => {
            const checkElement = this.createCheckListItem(check);
            this.checksList.appendChild(checkElement);
        });
    }
    
    createCheckListItem(check) {
        const container = document.createElement('div');
        container.className = 'check-item';
        container.onclick = () => this.showDetailView(check);
        
        // 1. PEP Icon
        container.appendChild(this.createPepIcon(check));
        
        // 2. Status Icon
        container.appendChild(this.createStatusIcon(check));
        
        // 3. Check Type Section (type, tags, initiated by)
        container.appendChild(this.createCheckTypeSection(check));
        
        // 4. Info/Warning Hints Column
        container.appendChild(this.createHintsColumn(check));
        
        // 5. Last Update Card
        container.appendChild(this.createLastUpdateCard(check));
        
        // 6. Doc Button Column (always present to maintain layout)
        const docButtonColumn = document.createElement('div');
        docButtonColumn.className = 'doc-button-column';
        const docButton = this.createDocButton(check);
        if (docButton) {
            docButtonColumn.appendChild(docButton);
        }
        container.appendChild(docButtonColumn);
        
        return container;
    }
    
    createPepIcon(check) {
        const div = document.createElement('div');
        div.className = 'pep-icon';
        
        // Don't show monitoring badge for aborted checks
        if (check.hasMonitoring && check.status !== 'aborted') {
            const badge = document.createElement('div');
            badge.className = 'pep-badge';
            div.appendChild(badge);
        }
        
        return div;
    }
    
    createStatusIcon(check) {
        const div = document.createElement('div');
        div.className = 'status-icon';
        
        const status = check.status;
        let svg = '';
        
        if (status === 'open' || status === 'processing') {
            // Sandtimer icon (from plan)
            svg = `<svg viewBox="0 0 2016.63 3158.45" xmlns="http://www.w3.org/2000/svg"><g><path d="M176.12 101.62c-40.65 0-73.73 33.08-73.73 73.73v23.06c0 40.65 33.08 73.73 73.73 73.73h1665.16c40.66 0 73.73-33.08 73.73-73.73v-23.06c0-40.65-33.07-73.73-73.73-73.73zm1665.16 272.15H176.12C79.43 373.77.77 295.1.77 198.42v-23.06C.77 78.66 79.43 0 176.12 0h1665.16c96.69 0 175.35 78.66 175.35 175.35v23.06c0 96.69-78.66 175.35-175.35 175.35Z" fill="#143b65"/><path d="M175.35 2886.3c-40.66 0-73.73 33.07-73.73 73.73v23.06c0 40.65 33.08 73.72 73.73 73.72h1665.16c40.66 0 73.73-33.07 73.73-73.72v-23.06c0-40.66-33.07-73.73-73.73-73.73zm1665.16 272.15H175.35C78.66 3158.45 0 3079.79 0 2983.1v-23.06c0-96.69 78.66-175.35 175.35-175.35h1665.16c96.69 0 175.35 78.66 175.35 175.35v23.06c0 96.69-78.66 175.35-175.35 175.35" fill="#143b65"/><path d="M206.07 2886.31c-22.66 0-43.31-15.26-49.19-38.23-14.57-56.94-23.36-121.71-26.85-198.02-3.42-74.76.24-148.23 10.86-218.35 11.36-74.92 30.77-146.49 57.69-212.71 41.27-101.53 107-196.78 190.07-275.45 44.3-41.94 94.02-75.98 142.1-108.89 10.14-6.93 20.62-14.12 30.76-21.17 54.65-38.02 123.28-89.65 169.36-151.87 35.92-48.5 35.92-116.27 0-164.78-46.08-62.21-114.71-113.84-169.36-151.87-10.14-7.04-20.62-14.23-30.75-21.16-48.09-32.92-97.81-66.95-142.1-108.89-83.07-78.67-148.79-173.92-190.07-275.46-26.92-66.22-46.33-137.79-57.69-212.71-10.63-70.12-14.28-143.59-10.86-218.35 3.49-76.31 12.27-141.08 26.85-198.02 6.96-27.19 34.63-43.58 61.82-36.62s43.58 34.64 36.63 61.82c-12.83 50.13-20.61 108.18-23.78 177.47-6.48 141.75 14.1 272.34 61.18 388.15 35.85 88.2 93.19 171.17 165.8 239.94 38.45 36.41 82.74 66.72 129.62 98.81 10.3 7.04 20.94 14.33 31.4 21.6 61.02 42.47 138.11 100.7 192.99 174.81 30.79 41.59 47.07 90.99 47.07 142.87s-16.28 101.28-47.07 142.87c-54.88 74.1-131.96 132.34-192.99 174.8-10.46 7.28-21.11 14.57-31.4 21.61-46.88 32.1-91.17 62.4-129.62 98.82-72.62 68.77-129.95 151.74-165.8 239.94-47.08 115.82-67.66 246.41-61.18 388.16 3.17 69.28 10.95 127.33 23.78 177.47 6.96 27.19-9.44 54.87-36.63 61.82-4.23 1.09-8.46 1.6-12.64 1.6Z" fill="#143b65"/><path d="M1811.34 2886.31c-4.17 0-8.41-.51-12.63-1.6-27.19-6.95-43.58-34.63-36.63-61.82 12.83-50.13 20.61-108.18 23.78-177.47 6.49-141.75-14.1-272.34-61.17-388.16-35.86-88.2-93.19-171.17-165.81-239.94-38.45-36.41-82.73-66.72-129.62-98.82-10.29-7.04-20.94-14.33-31.4-21.61-61.02-42.46-138.1-100.7-192.99-174.8-30.79-41.59-47.07-90.99-47.07-142.87s16.28-101.28 47.07-142.87c54.88-74.11 131.97-132.34 192.99-174.81 10.46-7.27 21.1-14.56 31.4-21.6 46.88-32.1 91.17-62.4 129.62-98.81 72.62-68.77 129.95-151.74 165.81-239.94 47.07-115.81 67.66-246.41 61.17-388.15-3.17-69.29-10.95-127.34-23.78-177.46-6.95-27.19 9.44-54.86 36.63-61.82s54.87 9.44 61.82 36.62c14.57 56.94 23.35 121.71 26.85 198.02 3.42 74.77-.24 148.23-10.87 218.35-11.36 74.92-30.76 146.49-57.69 212.71-41.27 101.54-106.99 196.79-190.06 275.46-44.3 41.94-94.01 75.98-142.1 108.89-10.14 6.93-20.62 14.12-30.75 21.17-54.65 38.02-123.28 89.65-169.37 151.86-35.93 48.51-35.93 116.28 0 164.78 46.08 62.22 114.72 113.85 169.37 151.87 10.14 7.05 20.62 14.23 30.75 21.17 48.09 32.92 97.81 66.95 142.1 108.89 83.07 78.67 148.79 173.92 190.06 275.45 26.93 66.23 46.33 137.8 57.69 212.71 10.63 70.13 14.28 143.59 10.87 218.35-3.5 76.31-12.28 141.09-26.85 198.02-5.88 22.97-26.53 38.23-49.19 38.23" fill="#143b65"/><path d="M1007.89 1675.69c-26.64 0-49.01-20.75-50.67-47.69-8.22-133.84-77.14-242.52-223.46-352.37-3.71-2.79-7.39-5.54-11.05-8.28-33.38-24.95-64.91-48.52-95.74-79.78-35.54-36.01-66.97-74.65-93.4-114.86-6.27-9.54-11.46-19.12-16.03-27.55-5.46-10.09-10.18-18.79-15.63-25.79a50.78 50.78 0 0 1-5.48-53.71c8.62-17.47 26.48-28.46 45.97-28.32 24.83.2 50.19.19 74.7.19h390.85c28.06 0 50.81 22.75 50.81 50.81s-22.75 50.82-50.81 50.82h-374.1c19.32 26.7 41.26 52.53 65.45 77.05 25.47 25.81 54.03 47.16 84.26 69.76 3.71 2.78 7.45 5.57 11.21 8.4 77.86 58.45 136.31 117.27 178.69 179.82 24.7 36.45 44.33 74.95 58.32 114.4 15.01 42.3 24.04 87.11 26.88 133.18 1.72 28.01-19.59 52.11-47.6 53.83-1.06.07-2.11.1-3.16.1Z" fill="#143b65"/><path d="M1007.99 1675.69c-1.06 0-2.1-.03-3.17-.1-28.01-1.72-49.32-25.82-47.6-53.83 2.83-46.07 11.87-90.88 26.87-133.18 13.99-39.45 33.61-77.95 58.32-114.4 42.38-62.55 100.83-121.37 178.68-179.82 3.76-2.83 7.51-5.62 11.22-8.41 30.23-22.59 58.79-43.94 84.25-69.75 24.2-24.53 46.14-50.36 65.47-77.07-96.22-.33-199.46-.2-299.38-.07l-74.68.09h-.05c-28.05 0-50.79-22.72-50.81-50.77-.03-28.06 22.7-50.83 50.76-50.86 24.83-.02 49.75-.06 74.66-.09 102.15-.13 207.8-.26 305.99.09 28.15.1 56.73.04 84.95-.19h.41c19.33 0 36.99 10.97 45.56 28.33 8.62 17.48 6.5 38.34-5.48 53.71-5.45 7-10.16 15.71-15.63 25.79-4.57 8.44-9.75 18.01-16.02 27.55-26.44 40.21-57.87 78.85-93.41 114.86-30.83 31.26-62.35 54.83-95.73 79.77-3.66 2.75-7.35 5.5-11.05 8.29-146.32 109.85-215.24 218.52-223.46 352.37-1.66 26.94-24.03 47.69-50.67 47.69" fill="#143b65"/><path d="M1611.93 2886.31c-23.25 0-44.23-16.06-49.53-39.69-57.58-256.43-290.45-442.54-553.7-442.54s-496.1 186.11-553.68 442.54c-6.15 27.38-33.33 44.59-60.71 38.45-27.38-6.15-44.59-33.33-38.44-60.71 16.54-73.65 45.3-143.51 85.48-207.64 39.42-62.91 88.7-118.52 146.46-165.33 58.3-47.22 123.49-84.03 193.77-109.39 72.73-26.25 149.15-39.54 227.12-39.54s154.4 13.3 227.14 39.54c70.28 25.36 135.47 62.17 193.77 109.39 57.77 46.79 107.04 102.42 146.47 165.33 40.19 64.13 68.94 133.98 85.48 207.64 6.15 27.38-11.06 54.56-38.44 60.71-3.75.84-7.5 1.24-11.18 1.24Z" fill="#143b65"/><path d="M1008.71 1916.54c-18.48 0-33.52 15.04-33.52 33.52s15.03 33.52 33.52 33.52 33.52-15.04 33.52-33.52-15.04-33.52-33.52-33.52m0 101.63c-37.55 0-68.11-30.54-68.11-68.1s30.55-68.1 68.11-68.1 68.1 30.55 68.1 68.1-30.54 68.1-68.1 68.1" fill="#143b65"/><path d="M1008.71 2103.36c-18.48 0-33.52 15.04-33.52 33.52s15.03 33.52 33.52 33.52 33.52-15.04 33.52-33.52-15.04-33.52-33.52-33.52m0 101.62c-37.55 0-68.11-30.55-68.11-68.1s30.55-68.1 68.11-68.1 68.1 30.54 68.1 68.1-30.54 68.1-68.1 68.1" fill="#143b65"/></g></svg>`;
        } else if (status === 'closed') {
            // Tick icon (from plan)
            svg = `<svg viewBox="0 0 3205.06 3205.06" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="#143b65" stroke-miterlimit="10" stroke-width="141.73" d="M3134.2 1602.53v.01c0 845.912-685.748 1531.66-1531.66 1531.66h-.01c-845.912 0-1531.66-685.748-1531.66-1531.66v-.01c0-845.912 685.748-1531.66 1531.66-1531.66h.01c845.912 0 1531.66 685.748 1531.66 1531.66z"/><path fill="none" stroke="#143b65" stroke-miterlimit="10" stroke-width="141.73" stroke-linecap="round" d="m1386.44 2324.8 827.22-1444.54"/><path fill="none" stroke="#143b65" stroke-miterlimit="10" stroke-width="141.73" stroke-linecap="round" d="M1386.44 2324.8 991.4 1767.73"/></g></svg>`;
        } else if (status === 'aborted') {
            // Cross icon (from plan)
            svg = `<svg viewBox="0 0 3205.06 3205.06" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="#143b65" stroke-linecap="round" stroke-miterlimit="10" stroke-width="141.73" d="M3134.2 1602.53v.01c0 845.912-685.748 1531.66-1531.66 1531.66h-.01c-845.912 0-1531.66-685.748-1531.66-1531.66v-.01c0-845.912 685.748-1531.66 1531.66-1531.66h.01c845.912 0 1531.66 685.748 1531.66 1531.66z"/><path fill="none" stroke="#143b65" stroke-linecap="round" stroke-miterlimit="10" stroke-width="141.73" d="M826.94 2378.12 2378.12 826.94"/><path fill="none" stroke="#143b65" stroke-linecap="round" stroke-miterlimit="10" stroke-width="141.73" d="M2378.12 2378.12 826.94 826.94"/></g></svg>`;
        }
        
        div.innerHTML = svg;
        return div;
    }
    
    createCheckTypeSection(check) {
        const div = document.createElement('div');
        div.className = 'check-type-section';
        
        // Header with type, tags, and SH icon
        const header = document.createElement('div');
        header.className = 'check-type-header';
        
        // Check type label
        const typeLabel = document.createElement('span');
        typeLabel.className = 'check-type-label';
        typeLabel.textContent = this.getCheckTypeLabel(check);
        header.appendChild(typeLabel);
        
        // Check outcome tags
        // ERROR tag for failed uploads (open checks with failed document uploads)
        const hasFailedUpload = check.status === 'open' && 
                                check.documentsUploaded === false && 
                                check.uploadAttempts && 
                                check.uploadAttempts.length > 0;
        
        if (hasFailedUpload) {
            const tag = document.createElement('span');
            tag.className = 'outcome-tag error';
            tag.textContent = 'ERROR';
            tag.title = 'Document upload failed - retry available';
            header.appendChild(tag);
        }
        // CLEAR/CONSIDER/ALERT tag (only if closed AND PDF ready)
        else if (check.status === 'closed' && check.pdfReady) {
            const tag = document.createElement('span');
            // Check for rejected documents on IDV checks - show as ALERT (red)
            const isIdvRejected = check.checkType === 'idv' && 
                check.taskOutcomes?.['identity:lite']?.breakdown?.document?.sub_result === 'rejected';
            
            if (isIdvRejected) {
                tag.className = 'outcome-tag alert';
                tag.textContent = 'ALERT';
            } else {
                tag.className = `outcome-tag ${check.hasAlerts ? 'consider' : 'clear'}`;
                tag.textContent = check.hasAlerts ? 'CONSIDER' : 'CLEAR';
            }
            header.appendChild(tag);
        }
        
        // Safe Harbour icon (only for Enhanced ID that meets criteria)
        if (this.checksSafeHarbour(check)) {
            const shIcon = document.createElement('span');
            shIcon.className = 'safe-harbour-icon';
            shIcon.innerHTML = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g><path d="M115.238 149.524H84.762c-13.304 0-24.127-10.823-24.127-24.127V105.08c0-7.702 6.266-13.968 13.968-13.968h50.794c7.702 0 13.968 6.266 13.968 13.968v20.317c0 13.303-10.823 24.127-24.127 24.127zM74.603 98.73a6.356 6.356 0 0 0-6.349 6.349v20.317c0 9.102 7.405 16.508 16.508 16.508h30.476c9.103 0 16.508-7.406 16.508-16.508v-20.317a6.356 6.356 0 0 0-6.349-6.349H74.603z" fill="#112F5B" data-color="1"></path><path d="M125.397 98.73a3.81 3.81 0 0 1-3.81-3.81V74.603c0-9.102-7.405-16.508-16.508-16.508H94.921c-9.103 0-16.508 7.406-16.508 16.508V94.92a3.81 3.81 0 1 1-7.62 0V74.603c0-13.304 10.823-24.127 24.127-24.127h10.159c13.304 0 24.127 10.823 24.127 24.127V94.92a3.809 3.809 0 0 1-3.809 3.81z" fill="#112F5B" data-color="1"></path><path d="M100 129.206a3.81 3.81 0 0 1-3.81-3.81v-10.159a3.81 3.81 0 1 1 7.62 0v10.159a3.81 3.81 0 0 1-3.81 3.81z" fill="#112F5B" data-color="1"></path><path d="M166.032 180H33.968C26.266 180 20 173.734 20 166.032V33.968C20 26.266 26.266 20 33.968 20h132.064C173.734 20 180 26.266 180 33.968v132.064c0 7.702-6.266 13.968-13.968 13.968zM33.968 27.619a6.356 6.356 0 0 0-6.349 6.349v132.064a6.356 6.356 0 0 0 6.349 6.349h132.064a6.356 6.356 0 0 0 6.349-6.349V33.968a6.356 6.356 0 0 0-6.349-6.349H33.968z" fill="#112F5B" data-color="1"></path></g></svg>`;
            shIcon.title = 'Safe Harbour Compliant';
            header.appendChild(shIcon);
        }
        
        div.appendChild(header);
        
        // Initiated by
        const initiatedBy = document.createElement('div');
        initiatedBy.className = 'initiated-by';
        const initiatedDate = new Date(check.initiatedAt).toLocaleDateString('en-GB');
        initiatedBy.innerHTML = `<strong>Initiated by:</strong> <span class="name">${check.initiatedBy}</span> <span class="date">${initiatedDate}</span>`;
        div.appendChild(initiatedBy);
        
        return div;
    }
    
    createHintsColumn(check) {
        const column = document.createElement('div');
        column.className = 'hints-column';
        
        const hints = this.generateHints(check);
        if (hints.length > 0) {
            // Show max 9 hints, prioritized
            hints.slice(0, 9).forEach(hint => {
                const hintElement = document.createElement('div');
                hintElement.className = `hint ${hint.level}`;
                hintElement.innerHTML = `<span class="hint-icon">${this.getHintIcon(hint.level)}</span>${hint.text}`;
                column.appendChild(hintElement);
            });
        }
        
        return column;
    }
    
    createLastUpdateCard(check) {
        const card = document.createElement('div');
        card.className = 'last-update-card';
        
        const updates = check.updates || [];
        const lastUpdate = updates[updates.length - 1];
        
        if (lastUpdate) {
            const date = document.createElement('div');
            date.className = 'last-update-date';
            date.textContent = new Date(lastUpdate.timestamp).toLocaleDateString('en-GB');
            card.appendChild(date);
            
            const message = document.createElement('div');
            message.className = 'last-update-message';
            message.textContent = lastUpdate.update;
            card.appendChild(message);
        } else {
            card.innerHTML = '<div class="last-update-message">No updates</div>';
        }
        
        return card;
    }
    
    createDocButton(check) {
        // Only create button if PDF is available
        if (!check.pdfReady || !check.pdfS3Key) {
            return null;
        }
        
        const btn = document.createElement('button');
        btn.className = 'doc-btn';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="#1d71b8"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`;
        btn.title = 'View PDF Report';
        btn.onclick = (e) => {
            e.stopPropagation();
            this.viewPDF(check.pdfS3Key);
        };
        
        return btn;
    }
    
    // ===================================================================
    // DETAIL VIEW RENDERING
    // ===================================================================
    
    renderDetailView(check) {
        console.log('📋 Rendering detail view for check:', check);
        
        // Render top action buttons
        this.renderTopActionButtons(check);
        
        // Render abort card FIRST (if applicable) - appears above header
        this.renderAbortCard(check);
        
        // Render retry card SECOND (if IDV with failed upload) - appears after abort
        this.renderRetryCard(check);
        
        // Render header
        this.renderDetailHeader(check);
        
        // Render monitoring card (if applicable)
        this.renderMonitoringCard(check);
        
        // Render client/company details
        this.renderDetailsCard(check);
        
        // Render document details (IDV and electronic-id with detailed properties)
        if (check.checkType === 'idv' || check.checkType === 'electronic-id') {
            this.renderDocumentDetailsCard(check);
        } else {
            // Hide document details card for other check types
            if (this.documentDetailsCard) {
                this.documentDetailsCard.classList.add('hidden');
            }
        }
        
        // Render PEP/Sanctions updates (if any)
        this.renderPepUpdatesCard(check);
        
        // Render red flags card (if any)
        this.renderRedFlagsCard(check);
        
        // Render tasks/reports
        this.renderTasksSection(check);
        
        // Render updates/audit trail
        this.renderUpdatesSection(check);
    }
    
    renderTopActionButtons(check) {
        const actionButtonsContainer = document.querySelector('.detail-action-buttons');
        if (!actionButtonsContainer) return;
        
        let buttons = '';
        
        // Button order: [Add Notes] [Dismiss PEPs] [SoF Investigation] [PDF icon] [Expand icon]
        
        // 1. Consider overlay button (Add Notes) - Text + Icon
        if (check.status === 'closed' && this.hasConsiderFailItems(check)) {
            buttons += `
                <button class="top-action-btn-text" onclick="manager.renderConsiderOverlay(manager.currentCheck)" 
                    title="Annotate Consider/Fail Items">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(0,60,113)" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    <span>Add Notes</span>
                </button>
            `;
        }
        
        // 2. PEP dismissal overlay button (Dismiss PEPs) - Text + Icon
        if (check.status === 'closed' && this.hasPepSanctionsHits(check)) {
            buttons += `
                <button class="top-action-btn-text" onclick="manager.renderPepDismissalOverlay(manager.currentCheck)" 
                    title="Whitelist PEP/Sanctions Hits">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(0,60,113)" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                    </svg>
                    <span>Dismiss PEPs</span>
                </button>
            `;
        }
        
        // 3. SoF overlay button - Text + Icon
        if (check.status === 'closed' && this.hasSofBankTasks(check)) {
            buttons += `
                <button class="top-action-btn-text" onclick="manager.renderSofOverlay(manager.currentCheck)" 
                    title="Source of Funds Investigation Notes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(0,60,113)" stroke-width="2">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                    </svg>
                    <span>SoF Investigation</span>
                </button>
            `;
        }
        
        // 4. View Report button - Icon only
        if (check.pdfReady && check.pdfS3Key) {
            buttons += `
                <button class="top-action-btn" onclick="manager.viewPDF('${check.pdfS3Key}')" title="View PDF Report">
                    <svg viewBox="0 0 24 24" fill="#1d71b8">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    </svg>
                </button>
            `;
        }
        
        // 5. Expand button - Icon only
        if (check.transactionId) {
            buttons += `
                <button class="top-action-btn" onclick="manager.openThirdfortTransaction('${check.checkType}', '${check.transactionId}')" title="View in Thirdfort Portal">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d71b8" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                    </svg>
                </button>
            `;
        }
        
        actionButtonsContainer.innerHTML = buttons;
    }
    
    openThirdfortTransaction(checkType, transactionId) {
        // Determine environment (sandbox or production)
        // For now, default to sandbox - this should be set from backend via THIRDFORT_ENV secret
        const env = this.thirdfortEnv || 'sandbox';
        
        // Build base URL
        const baseUrl = env === 'production' 
            ? 'https://app.thirdfort.com' 
            : 'https://sandbox.app.thirdfort.com';
        
        // Determine URL path based on check type
        let urlPath;
        if (checkType === 'idv') {
            urlPath = `/documents/${transactionId}`;
        } else if (checkType === 'kyb') {
            urlPath = `/know-your-business/${transactionId}`;
        } else {
            // electronic-id, idv-lite (includes all electronic checks and lite screening)
            urlPath = `/activities/${transactionId}`;
        }
        
        const thirdfortUrl = `${baseUrl}${urlPath}`;
        
        console.log('🔗 Opening Thirdfort transaction:', {
            checkType,
            transactionId,
            env,
            url: thirdfortUrl
        });
        
        // Open in popup window
        window.open(thirdfortUrl, '_blank', 'width=1400,height=900,resizable=yes,scrollbars=yes');
    }
    
    renderDetailHeader(check) {
        const isEnhanced = this.isEnhancedID(check);
        const isSafeHarbour = this.checksSafeHarbour(check);
        
        let statusTag = '';
        if (check.status === 'processing' || check.status === 'open') {
            statusTag = '<span class="status-tag processing">PROCESSING</span>';
        } else if (check.status === 'aborted') {
            statusTag = '<span class="status-tag cancelled">CANCELLED</span>';
        } else if (check.status === 'closed') {
            // Only show CLEAR/CONSIDER/ALERT if PDF is ready, otherwise show PROCESSING
            if (check.pdfReady) {
                // Check for rejected documents on IDV checks - show as ALERT (red)
                const isIdvRejected = check.checkType === 'idv' && 
                    check.taskOutcomes?.['identity:lite']?.breakdown?.document?.sub_result === 'rejected';
                
                if (isIdvRejected) {
                    statusTag = '<span class="status-tag alert">ALERT</span>';
                } else if (check.hasAlerts) {
                    statusTag = '<span class="status-tag consider">CONSIDER</span>';
                } else {
                    statusTag = '<span class="status-tag clear">CLEAR</span>';
                }
            } else {
                statusTag = '<span class="status-tag processing">PROCESSING</span>';
            }
        }
        
        const pepHitsCount = (check.pepSanctionsUpdates || []).reduce((sum, update) => 
            sum + (update.matchCount || 0), 0
        );
        
        const pepBadge = pepHitsCount > 0 
            ? `<span class="pep-hits-badge">${pepHitsCount} PEP/Sanctions hit${pepHitsCount > 1 ? 's' : ''}</span>` 
            : '';
        
        const shIcon = isSafeHarbour 
            ? `<span class="safe-harbour-icon" title="Safe Harbour Compliant"><svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><g><path d="M115.238 149.524H84.762c-13.304 0-24.127-10.823-24.127-24.127V105.08c0-7.702 6.266-13.968 13.968-13.968h50.794c7.702 0 13.968 6.266 13.968 13.968v20.317c0 13.303-10.823 24.127-24.127 24.127zM74.603 98.73a6.356 6.356 0 0 0-6.349 6.349v20.317c0 9.102 7.405 16.508 16.508 16.508h30.476c9.103 0 16.508-7.406 16.508-16.508v-20.317a6.356 6.356 0 0 0-6.349-6.349H74.603z" fill="#112F5B" data-color="1"></path><path d="M125.397 98.73a3.81 3.81 0 0 1-3.81-3.81V74.603c0-9.102-7.405-16.508-16.508-16.508H94.921c-9.103 0-16.508 7.406-16.508 16.508V94.92a3.81 3.81 0 1 1-7.62 0V74.603c0-13.304 10.823-24.127 24.127-24.127h10.159c13.304 0 24.127 10.823 24.127 24.127V94.92a3.809 3.809 0 0 1-3.809 3.81z" fill="#112F5B" data-color="1"></path><path d="M100 129.206a3.81 3.81 0 0 1-3.81-3.81v-10.159a3.81 3.81 0 1 1 7.62 0v10.159a3.81 3.81 0 0 1-3.81 3.81z" fill="#112F5B" data-color="1"></path><path d="M166.032 180H33.968C26.266 180 20 173.734 20 166.032V33.968C20 26.266 26.266 20 33.968 20h132.064C173.734 20 180 26.266 180 33.968v132.064c0 7.702-6.266 13.968-13.968 13.968zM33.968 27.619a6.356 6.356 0 0 0-6.349 6.349v132.064a6.356 6.356 0 0 0 6.349 6.349h132.064a6.356 6.356 0 0 0 6.349-6.349V33.968a6.356 6.356 0 0 0-6.349-6.349H33.968z" fill="#112F5B" data-color="1"></path></g></svg></span>` 
            : '';
        
        const pepMonIcon = (check.hasMonitoring && check.status !== 'aborted') ? '<span class="pep-badge" style="margin-right: 8px;"></span>' : '';
        
        // Build meta items dynamically (only show if data exists)
        const metaItems = [];
        
        if (check.initiatedBy) {
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">Initiated By</div>
                    <div class="meta-value">${check.initiatedBy}</div>
                </div>
            `);
        }
        
        if (check.initiatedAt) {
            const initiatedDate = new Date(check.initiatedAt).toLocaleDateString('en-GB');
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">Initiated</div>
                    <div class="meta-value">${initiatedDate}</div>
                </div>
            `);
        }
        
        if (check.updatedAt) {
            const updatedDate = new Date(check.updatedAt).toLocaleDateString('en-GB');
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">Last Updated</div>
                    <div class="meta-value">${updatedDate}</div>
                </div>
            `);
        }
        
        if (check.completedAt) {
            const completedDate = new Date(check.completedAt).toLocaleDateString('en-GB');
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">Completed</div>
                    <div class="meta-value">${completedDate}</div>
                </div>
            `);
        }
        
        // Add Transaction/Check ID for support reference
        const resourceId = check.transactionId || check.checkId;
        const resourceType = check.transactionId ? 'Transaction ID' : 'Check ID';
        if (resourceId) {
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">${resourceType}</div>
                    <div class="meta-value" style="font-family: monospace; user-select: all; cursor: text;" title="Click to select all, then copy">${resourceId}</div>
                </div>
            `);
        }
        
        // Add Reference for electronic-id checks only (sent to client in SMS)
        if (check.checkType === 'electronic-id' && check.thirdfortResponse?.ref) {
            metaItems.push(`
                <div class="meta-item">
                    <div class="meta-label">REFERENCE</div>
                    <div class="meta-value">${check.thirdfortResponse.ref}</div>
                </div>
            `);
        }
        
        // Get Thirdfort URL
        const env = 'sandbox'; // TODO: Make this dynamic
        const baseUrl = env === 'production' ? 'https://app.thirdfort.io' : 'https://sandbox.thirdfort.io';
        const thirdfortUrl = check.transactionId 
            ? `${baseUrl}/transactions/${check.transactionId}`
            : `${baseUrl}/checks/${check.checkId}`;
        
        const identityMarkup = this.getIdentityComparisonMarkup(check);
        
        // Determine header card border class based on outcome
        let headerBorderClass = '';
        if (check.status === 'closed' && check.pdfReady) {
            const isIdvRejected = check.checkType === 'idv' && 
                check.taskOutcomes?.['identity:lite']?.breakdown?.document?.sub_result === 'rejected';
            if (isIdvRejected) {
                headerBorderClass = 'alert';
            } else if (check.hasAlerts) {
                headerBorderClass = 'consider';
            } else {
                headerBorderClass = 'clear';
            }
        }
        
        // Update header card class
        this.detailHeader.className = `card header-card${headerBorderClass ? ' ' + headerBorderClass : ''}`;

        this.detailHeader.innerHTML = `
            <div class="header-top">
                ${pepMonIcon}
                <span class="check-type-large">${this.getCheckTypeLabel(check)}</span>
                ${statusTag}
                ${shIcon}
                ${pepBadge}
            </div>
            <div class="header-meta-grid">
                ${metaItems.join('')}
            </div>
            ${identityMarkup}
        `;
    }
    
    renderMonitoringCard(check) {
        // Hide in view mode or for IDV (no monitoring option)
        if (this.mode === 'view' || check.checkType === 'idv') {
            this.monitoringCard.classList.add('hidden');
            return;
        }
        
        const hasMonitoring = check.hasMonitoring === true;
        
        // Check if check has PEP/sanctions/screening tasks (required for monitoring)
        const tasks = check.tasks || [];
        const taskOutcomes = check.taskOutcomes || {};
        const hasPepSanctionsTasks = tasks.includes('report:peps') || 
                                     tasks.includes('report:screening:lite') ||
                                     taskOutcomes['peps'] || 
                                     taskOutcomes['sanctions'] ||
                                     taskOutcomes['company:peps'] ||
                                     taskOutcomes['company:sanctions'];
        
        // Can only toggle/show monitoring if check has PEP/sanctions tasks
        const canToggle = (check.checkType === 'electronic-id' || check.checkType === 'lite-screen') 
                          && check.status !== 'aborted'
                          && hasPepSanctionsTasks;
        const canDisable = check.checkType === 'kyb' && hasMonitoring && check.status !== 'aborted';
        
        if (!canToggle && !canDisable) {
            this.monitoringCard.classList.add('hidden');
            return;
        }
        
        this.monitoringCard.classList.remove('hidden');
        this.monitoringCard.className = hasMonitoring ? 'card monitoring-card' : 'card monitoring-card disabled';
        
        const title = hasMonitoring ? 'Ongoing Monitoring' : 'Enable Ongoing Monitoring';
        const description = hasMonitoring 
            ? 'This client will undergo continuous PEP and sanctions monitoring for 12 months. Updates will be sent automatically if their status changes.'
            : 'Turn on monitoring to enable continuous PEP and sanctions screening for this client. You will be notified of any status changes.';
        
        this.monitoringCard.innerHTML = `
            <div class="monitoring-header">
                <div class="monitoring-title">${title}</div>
                <div class="monitoring-toggle ${hasMonitoring ? 'enabled' : ''}" onclick="manager.toggleMonitoring(${hasMonitoring})">
                    <div class="monitoring-toggle-slider"></div>
                </div>
            </div>
            <div class="monitoring-description">${description}</div>
        `;
    }
    
    renderAbortCard(check) {
        // Hide in view mode
        if (this.mode === 'view') {
            this.abortCard.classList.add('hidden');
            return;
        }
        
        // Only show abort for:
        // 1. Status is open or processing
        // 2. It's a v2 transaction (ID starts with 'c')
        // v1 checks (IDV, etc.) and v2 checks (KYB) cannot be aborted via API
        const isOpenStatus = check.status === 'open' || check.status === 'processing';
        
        // Check both transactionId and checkId fields (either could be used)
        const checkId = check.transactionId ? true : false
        const isV2Transaction = checkId
        
        const canAbort = isOpenStatus && isV2Transaction;
        
        console.log('🔍 Abort card check:', {
            status: check.status,
            isOpenStatus,
            checkId,
            transactionId: check.transactionId,
            checkIdField: check.checkId,
            isV2Transaction,
            canAbort
        });
        
        if (!canAbort) {
            this.abortCard.classList.add('hidden');
            return;
        }
        
        this.abortCard.classList.remove('hidden');
        this.abortCard.innerHTML = `
            <div class="abort-content">
                <div class="abort-text">
                    <div class="abort-title">Cancel Check</div>
                    <div class="abort-description">If you no longer wish to conduct this check you may cancel it</div>
                </div>
                <button class="abort-btn" onclick="manager.abortCheck()">ABORT CHECK</button>
            </div>
        `;
    }
    
    renderRetryCard(check) {
        // Hide in view mode
        if (this.mode === 'view') {
            this.retryCard.classList.add('hidden');
            return;
        }
        
        // Only show retry card for IDV checks with failed upload
        const hasFailedUpload = check.checkType === 'idv' &&
                                check.status === 'open' && 
                                check.documentsUploaded === false && 
                                check.uploadAttempts && 
                                check.uploadAttempts.length > 0;
        
        if (!hasFailedUpload) {
            this.retryCard.classList.add('hidden');
            return;
        }
        
        // Get last upload attempt
        const lastAttempt = check.uploadAttempts[check.uploadAttempts.length - 1];
        const errorMessage = lastAttempt.errorMessage || 'Unknown error';
        const errorType = lastAttempt.errorType || 'unknown';
        const attemptTime = lastAttempt.timestamp ? new Date(lastAttempt.timestamp).toLocaleString() : 'Unknown';
        const attemptedBy = lastAttempt.attemptedBy || 'Unknown';
        
        // Determine hint message based on error type
        let hintMessage = '';
        if (errorType === 'fatal') {
            hintMessage = 'This image was rejected due to quality issues. The system will automatically search for alternative images when you click retry. If no alternatives are found, please upload a new photo ID first.';
        } else if (errorType === 'retryable') {
            hintMessage = 'Network or download error occurred. You can retry with the same images.';
        } else {
            hintMessage = 'An error occurred during upload. Click retry to attempt again.';
        }
        
        // Determine document description
        const docType = check.documentType || 'Unknown';
        const docTypeName = docType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const hasFront = lastAttempt.frontS3Key;
        const hasBack = lastAttempt.backS3Key;
        const docDescription = hasBack ? `${docTypeName} (front + back)` : `${docTypeName} (front)`;
        
        this.retryCard.classList.remove('hidden');
        this.retryCard.style.borderLeft = '4px solid #ff9800';
        this.retryCard.innerHTML = `
            <div class="retry-content">
                <div class="retry-header">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff9800" stroke-width="2">
                        <path d="M12 2L2 22h20L12 2z" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M12 9v4M12 17h.01" stroke-linecap="round"/>
                    </svg>
                    <h4 style="color: #ff9800; margin: 0; font-family: 'Transport', sans-serif; font-size: 1.1rem;">Document Upload Failed</h4>
                </div>
                <div class="retry-body">
                    <p><strong>Error:</strong> ${errorMessage}</p>
                    <p><strong>Last attempt:</strong> ${attemptTime} by ${attemptedBy}</p>
                    <p><strong>Failed images:</strong> ${docDescription}</p>
                    <p class="retry-hint" style="margin-top: 12px; padding: 10px; background: rgba(255,152,0,0.1); border-radius: 4px; font-size: 0.9rem; line-height: 1.4;">
                        ${hintMessage}
                    </p>
                </div>
                <button class="retry-btn" onclick="manager.retryDocumentUpload()" style="
                    background: #ff9800;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    font-family: 'Transport', sans-serif;
                    font-size: 1rem;
                    margin-top: 15px;
                    width: 100%;
                    transition: background 0.2s;
                ">RETRY DOCUMENT UPLOAD</button>
            </div>
        `;
    }
    
    renderDetailsCard(check) {
        const isPersonCheck = check.checkType === 'electronic-id' || 
                              check.checkType === 'lite-screen' || 
                              check.checkType === 'idv';
        
        let detailsContent = '';
        
        if (isPersonCheck) {
            // Person checks (Electronic ID, Lite Screen, IDV)
            const piiData = check.piiData || {};
            const expectations = check.expectations || {};  // Lite Screen expectations (available before completion)
            
            // For screening:lite checks, get data from the task outcome
            const screeningLiteData = check.taskOutcomes?.['screening:lite']?.data || {};
            const isScreeningLite = screeningLiteData && Object.keys(screeningLiteData).length > 0;
            
            // For IDV checks, also pull data from identity:lite taskOutcomes
            const idvProperties = check.checkType === 'idv' 
                ? check.taskOutcomes?.['identity:lite']?.breakdown?.document?.properties 
                : null;
            
            const consumerName = check.consumerName ? check.consumerName.trim() : '';
            const name = (consumerName || 
                        (isScreeningLite && screeningLiteData['name:lite'] ? 
                            `${screeningLiteData['name:lite'].first || ''} ${screeningLiteData['name:lite'].last || ''}`.trim() : '') ||
                        (idvProperties ? `${idvProperties.first_name || ''} ${idvProperties.last_name || ''}`.trim() : '') ||
                        (expectations.name?.data ? `${expectations.name.data.first || ''} ${expectations.name.data.last || ''}`.trim() : '') ||
                        (piiData.name ? `${piiData.name.first || ''} ${piiData.name.last || ''}`.trim() : '')) || '—';
            
            // For screening:lite, use yob (year of birth) instead of full DOB
            const dob = isScreeningLite && screeningLiteData.yob 
                ? screeningLiteData.yob  // Just show the year for screening:lite
                : idvProperties?.date_of_birth 
                    ? new Date(idvProperties.date_of_birth).toLocaleDateString('en-GB')
                    : (expectations.dob?.data ? new Date(expectations.dob.data).toLocaleDateString('en-GB') : '')
                    || (piiData.dob ? new Date(piiData.dob).toLocaleDateString('en-GB') : '—');
            
            const mobile = check.consumerPhone || check.thirdfortResponse?.request?.actor?.phone || '—';
            const email = check.consumerEmail || check.thirdfortResponse?.request?.actor?.email || '—';
            
            // Address - use piiData first, then expectations for lite-screen
            const address = piiData.address || expectations.address?.data || {};
            const fullAddress = [
                address.line1 || (address.building_number || address.building_name ? 
                    [address.building_number, address.building_name, address.street].filter(Boolean).join(', ') : ''),
                address.line2,
                address.town,
                address.postcode,
                address.country
            ].filter(Boolean).join(', ') || '—';
            
            const docInfo = check.taskOutcomes?.['document']?.data || {};
            const docNumber = docInfo.number || piiData.document?.number || 
                            (idvProperties?.document_numbers?.[0]?.value) || '—';
            const mrz = piiData.document?.mrz_line1 && piiData.document?.mrz_line2
                ? `${piiData.document.mrz_line1}\n${piiData.document.mrz_line2}`
                : '';
            
            // Additional IDV-specific fields
            const documentType = check.documentType || idvProperties?.document_type || '';
            const expiryDate = idvProperties?.date_of_expiry 
                ? new Date(idvProperties.date_of_expiry).toLocaleDateString('en-GB')
                : '';
            const issuingCountry = idvProperties?.issuing_country || '';
            const nationality = idvProperties?.nationality || '';
            
            // Build client details grid items (only show if data exists)
            const gridItems = [];
            
            if (name && name !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Name</div>
                        <div class="detail-value">${name}</div>
                    </div>
                `);
            }
            
            if (dob && dob !== '—') {
                const dobLabel = isScreeningLite ? 'Year of Birth' : 'Date of Birth';
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">${dobLabel}</div>
                        <div class="detail-value">${dob}</div>
                    </div>
                `);
            }
            
            // For screening:lite, show country
            if (isScreeningLite && screeningLiteData.country) {
                const countryCode = screeningLiteData.country;
                const countryNames = {
                    'GBR': 'United Kingdom',
                    'USA': 'United States',
                    'UK': 'United Kingdom',
                    'US': 'United States',
                    'FR': 'France',
                    'DE': 'Germany',
                    'ES': 'Spain',
                    'IT': 'Italy'
                };
                const countryName = countryNames[countryCode] || countryCode;
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Country</div>
                        <div class="detail-value">${countryName}</div>
                    </div>
                `);
            }
            
            if (mobile && mobile !== '—' && !isScreeningLite) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Mobile</div>
                        <div class="detail-value">${mobile}</div>
                    </div>
                `);
            }
            
            if (email && email !== '—' && !isScreeningLite) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${email}</div>
                    </div>
                `);
            }
            
            detailsContent = `
                <div class="details-header">
                    <div class="details-title">Client Details</div>
                </div>
                ${gridItems.length > 0 ? `<div class="details-grid">${gridItems.join('')}</div>` : ''}
                ${fullAddress && fullAddress !== '—' && check.checkType !== 'idv' && !isScreeningLite ? `
                <div class="detail-item" style="margin-top: 12px;">
                    <div class="detail-label">Address</div>
                    <div class="detail-value">${fullAddress}</div>
                </div>
                ` : ''}
                ${(() => {
                    // Check if detailed document properties exist (like Se/Jacob have)
                    const identityTask = check.taskOutcomes?.identity;
                    const docTask = identityTask?.breakdown?.document;
                    const hasDetailedDocProps = docTask?.properties && Object.keys(docTask.properties).length > 3;
                    
                    // If detailed properties exist, skip showing document number here (will show in document card)
                    if (hasDetailedDocProps) return '';
                    
                    // Otherwise show document number in client details
                    if ((docNumber !== '—' || mrz) && check.checkType !== 'idv' && !isScreeningLite) {
                        return `
                            <div class="detail-item" style="margin-top: 12px;">
                                <div class="detail-label">Document Number</div>
                                <div class="detail-value">${docNumber}</div>
                                ${mrz ? `<div class="detail-value" style="font-size: 11px; font-family: monospace; margin-top: 4px; white-space: pre;">${mrz}</div>` : ''}
                            </div>
                        `;
                    }
                    return '';
                })()}
            `;
        } else {
            // KYB Check - Get data from companyData and company:summary if available
            const companyData = check.companyData || {};
            const companySummary = check.taskOutcomes?.['company:summary']?.breakdown || {};
            
            // Prefer data from company:summary as it's more comprehensive
            const companyName = check.companyName || companySummary.name || companyData.name || '—';
            const companyNumber = companySummary.registration_number || companyData.number || '—';
            const jurisdiction = companyData.jurisdiction || companySummary.country || '—';
            const legalForm = companySummary.legal_form || '—';
            const status = companySummary.status || companySummary.detailed_operating_status || '—';
            const incorporationDate = companySummary.date_of_incorporation 
                ? new Date(companySummary.date_of_incorporation).toLocaleDateString('en-GB') 
                : '—';
            
            // Address
            const addr = companySummary.formatted_address || {};
            const fullAddress = [addr.street, addr.city, addr.zip, addr.country]
                .filter(Boolean).join(', ') || '—';
            
            const tradingAddr = companySummary.trading_address || {};
            const tradingAddress = [tradingAddr.street, tradingAddr.city, tradingAddr.zip, tradingAddr.country]
                .filter(Boolean).join(', ');
            
            const sicDesc = companySummary.sic_nace_codes_des || '';
            const website = companySummary.url || '';
            const employees = companySummary.number_of_employees || '';
            
            // Build company details grid items (only show if data exists)
            const gridItems = [];
            
            if (companyName && companyName !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Company Name</div>
                        <div class="detail-value">${companyName}</div>
                    </div>
                `);
            }
            
            if (companyNumber && companyNumber !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Company Number</div>
                        <div class="detail-value">${companyNumber}</div>
                    </div>
                `);
            }
            
            if (jurisdiction && jurisdiction !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Jurisdiction</div>
                        <div class="detail-value">${jurisdiction}</div>
                    </div>
                `);
            }
            
            if (legalForm && legalForm !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Legal Form</div>
                        <div class="detail-value">${legalForm}</div>
                    </div>
                `);
            }
            
            if (status && status !== '—') {
                const isActive = status.toLowerCase() === 'active';
                const statusIcon = isActive 
                    ? `<svg class="detail-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`
                    : `<svg class="detail-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value detail-value-with-icon">${statusIcon}${status.charAt(0).toUpperCase() + status.slice(1)}</div>
                    </div>
                `);
            }
            
            if (incorporationDate && incorporationDate !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Incorporation Date</div>
                        <div class="detail-value">${incorporationDate}</div>
                    </div>
                `);
            }
            
            if (sicDesc) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Industry</div>
                        <div class="detail-value">${sicDesc}</div>
                    </div>
                `);
            }
            
            if (employees) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Employees</div>
                        <div class="detail-value">${employees}</div>
                    </div>
                `);
            }
            
            if (website) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Website</div>
                        <div class="detail-value">${website}</div>
                    </div>
                `);
            }
            
            detailsContent = `
                <div class="details-header">
                    <div class="details-title">Company Details</div>
                </div>
                ${gridItems.length > 0 ? `<div class="details-grid">${gridItems.join('')}</div>` : ''}
                ${fullAddress && fullAddress !== '—' ? `
                <div class="detail-item" style="margin-top: 12px;">
                    <div class="detail-label">Registered Address</div>
                    <div class="detail-value">${fullAddress}</div>
                </div>
                ` : ''}
                ${tradingAddress && tradingAddress !== fullAddress ? `
                <div class="detail-item" style="margin-top: 8px;">
                    <div class="detail-label">Trading Address</div>
                    <div class="detail-value">${tradingAddress}</div>
                </div>
                ` : ''}
            `;
        }
        
        const detailIdentityMarkup = this.getIdentityComparisonMarkup(check, { compact: true, heading: 'Check Images' });
        if (detailIdentityMarkup) {
            detailsContent += detailIdentityMarkup;
        }

        this.detailsCard.innerHTML = detailsContent;
    }

    extractIdentityTimestamp(image) {
        const candidates = [
            image?.recordedAt,
            image?.timestamp,
            image?.lastModified,
            image?.lastModifiedMs,
            image?.data?.lastModified,
            image?.date ? Date.parse(image.date) : null
        ];
        for (const value of candidates) {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }
        return Date.now();
    }

    normalizeIdentityImages(images) {
        if (!Array.isArray(images)) return {};
        const sorted = images
            .map(image => ({
                ...image,
                url: image.url || image.liveUrl || '',
                recordedAt: image.recordedAt || this.extractIdentityTimestamp(image)
            }))
            .sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0));

        const normalized = { raw: sorted };
        sorted.forEach(image => {
            const key = this.getIdentityTypeKey(image);
            if (key && !normalized[key]) {
                normalized[key] = image;
            }
        });

        return normalized;
    }

    getIdentityTypeKey(image) {
        const label = (image?.type || image?.name || '').toLowerCase();
        if (label.includes('passport') || label.includes('face')) {
            return 'faceImage';
        }
        return 'selfie';
    }

    getIdentityImageData(check) {
        if (!check) return null;
        if (check.identityImages) {
            return check.identityImages;
        }
        if (check.transactionId && this.checkIdentityImages[check.transactionId]) {
            return this.checkIdentityImages[check.transactionId];
        }
        return null;
    }

    buildIdentityTileMarkup(image, label, options = {}) {
        if (!image) return '';
        const circleClass = options.compact ? 'identity-circle small' : 'identity-circle';
        const url = image.url || image.liveUrl || '';
        const uploader = image.uploader || 'Thirdfort API';
        const date = image.date || '';
        return `
            <div class="identity-tile">
                <div class="${circleClass}" style="${url ? `background-image: url('${url}')` : ''}"></div>
                <div class="identity-label">${label}</div>
                <div class="identity-meta">${uploader}${date ? `<br>${date}` : ''}</div>
            </div>
        `;
    }

    getIdentityComparisonMarkup(check, options = {}) {
        const identityData = this.getIdentityImageData(check);
        if (!identityData) return '';

        const selfie = identityData.selfie;
        const faceImage = identityData.faceImage;

        if (!selfie && !faceImage) {
            return '';
        }

        const compact = options.compact === true;
        const heading = options.heading ? `<div class="identity-comparison-heading">${options.heading}</div>` : '';

        const tiles = [];
        if (selfie) {
            tiles.push(this.buildIdentityTileMarkup(selfie, 'Selfie', { compact }));
        }
        if (faceImage) {
            tiles.push(this.buildIdentityTileMarkup(faceImage, 'Passport Image', { compact }));
        }

        return `
            <div class="identity-comparison ${compact ? 'compact' : ''}">
                ${heading}
                <div class="identity-tiles">
                    ${tiles.join('')}
                </div>
            </div>
        `;
    }
    
    renderDocumentDetailsCard(check) {
        // For IDV and electronic-id checks with detailed properties
        if (!this.documentDetailsCard) return;
        
        let docProperties = {};
        let nfcData = {};
        
        if (check.checkType === 'idv') {
            // IDV check - get from identity:lite
            docProperties = check.taskOutcomes?.['identity:lite']?.breakdown?.document?.properties || {};
        } else if (check.checkType === 'electronic-id') {
            // Electronic ID check - get from identity.breakdown.document
            const identityTask = check.taskOutcomes?.identity;
            const docTask = identityTask?.breakdown?.document;
            
            // Check for detailed document properties (Se's structure)
            if (docTask?.properties) {
                docProperties = docTask.properties;
            }
            
            // Also check for NFC data (Jacob's structure) - has additional fields
            nfcData = identityTask?.data?.nfc || {};
            
            // If no detailed properties, hide the card
            if (Object.keys(docProperties).length <= 1 && Object.keys(nfcData).length === 0) {
                this.documentDetailsCard.classList.add('hidden');
                return;
            }
        } else {
            this.documentDetailsCard.classList.add('hidden');
            return;
        }
        
        this.documentDetailsCard.classList.remove('hidden');
        
        // Use docProperties as main source (Se's structure)
        const idvProperties = docProperties;
        
        const gridItems = [];
        
        // Name (from NFC chip if available - Jacob's structure)
        if (nfcData.name) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Name (as per chip)</div>
                    <div class="detail-value">${nfcData.name}</div>
                </div>
            `);
        } else if (idvProperties.first_name || idvProperties.last_name) {
            // Se's structure - build from first/last (handle both formats)
            // New structure may have first_name as full name, or separate first/last
            let fullName = '';
            if (idvProperties.first_name && idvProperties.first_name.includes(' ')) {
                // first_name contains full name (e.g., "FREDERICK BRIAN")
                fullName = idvProperties.first_name;
                if (idvProperties.last_name) {
                    fullName += ` ${idvProperties.last_name}`;
                }
            } else {
                // Separate first and last names
                fullName = [idvProperties.first_name, idvProperties.last_name].filter(Boolean).join(' ');
            }
            if (fullName) {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Name</div>
                        <div class="detail-value">${fullName}</div>
                    </div>
                `);
            }
        }
        
        // Document Type
        const documentType = check.documentType || idvProperties.document_type || '';
        if (documentType) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Document Type</div>
                    <div class="detail-value">${documentType.charAt(0).toUpperCase() + documentType.slice(1)}</div>
                </div>
            `);
        }
        
        // Document Number (from properties or fallback to piiData)
        const docNumbers = idvProperties.document_numbers || [];
        let docNumber = '';
        if (docNumbers.length > 0) {
            docNumber = docNumbers[0].value || '';
        } else if (check.piiData?.document?.number) {
            docNumber = check.piiData.document.number;
        }
        
        if (docNumber) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Document Number</div>
                    <div class="detail-value" style="font-family: monospace;">${docNumber}</div>
                </div>
            `);
        }
        
        // Nationality
        if (idvProperties.nationality) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Nationality</div>
                    <div class="detail-value">${idvProperties.nationality}</div>
                </div>
            `);
        }
        
        // Issuing Country
        if (idvProperties.issuing_country) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Issuing Country</div>
                    <div class="detail-value">${idvProperties.issuing_country}</div>
                </div>
            `);
        }
        
        // Issuing Date
        if (idvProperties.issuing_date) {
            const issuingDate = new Date(idvProperties.issuing_date).toLocaleDateString('en-GB');
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Issuing Date</div>
                    <div class="detail-value">${issuingDate}</div>
                </div>
            `);
        }
        
        // Expiry Date (handle different formats)
        let expiryDate = '';
        if (idvProperties.date_of_expiry) {
            // Se's format: "2031-05-28" (ISO date)
            expiryDate = new Date(idvProperties.date_of_expiry).toLocaleDateString('en-GB');
        } else if (nfcData.date_of_expiry) {
            // Jacob's format: "22.08.2033" (already formatted)
            expiryDate = nfcData.date_of_expiry;
        }
        
        if (expiryDate) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Expiry Date</div>
                    <div class="detail-value">${expiryDate}</div>
                </div>
            `);
        }
        
        // Date of Birth (handle different formats)
        let dob = '';
        if (idvProperties.date_of_birth) {
            // Se's format: "1990-01-01" (ISO date)
            dob = new Date(idvProperties.date_of_birth).toLocaleDateString('en-GB');
        } else if (nfcData.dob) {
            // Jacob's format: "11.01.2001" (already formatted)
            dob = nfcData.dob;
        }
        
        if (dob) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Date of Birth</div>
                    <div class="detail-value">${dob}</div>
                </div>
            `);
        }
        
        // Gender
        if (idvProperties.gender) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Gender</div>
                    <div class="detail-value">${idvProperties.gender.charAt(0).toUpperCase() + idvProperties.gender.slice(1)}</div>
                </div>
            `);
        }
        
        // Place of Birth (new field)
        if (idvProperties.place_of_birth) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Place of Birth</div>
                    <div class="detail-value">${idvProperties.place_of_birth}</div>
                </div>
            `);
        }
        
        // Issuing Authority (new field)
        if (idvProperties.issuing_authority) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Issuing Authority</div>
                    <div class="detail-value">${idvProperties.issuing_authority}</div>
                </div>
            `);
        }
        
        // Categorisation (new field - e.g., "full" for driving licence)
        if (idvProperties.categorisation) {
            gridItems.push(`
                <div class="detail-item">
                    <div class="detail-label">Categorisation</div>
                    <div class="detail-value">${idvProperties.categorisation.charAt(0).toUpperCase() + idvProperties.categorisation.slice(1)}</div>
                </div>
            `);
        }
        
        this.documentDetailsCard.innerHTML = `
            <div class="details-header">
                <div class="details-title">Document Details</div>
            </div>
            ${gridItems.length > 0 ? `<div class="details-grid">${gridItems.join('')}</div>` : '<div style="padding: 20px; color: #666;">No document details available</div>'}
        `;
    }
    
    renderPepUpdatesCard(check) {
        const pepUpdates = check.pepSanctionsUpdates || [];
        
        if (pepUpdates.length === 0) {
            this.pepUpdatesCard.classList.add('hidden');
            return;
        }
        
        this.pepUpdatesCard.classList.remove('hidden');
        
        // Collect all hit IDs from original task outcomes and previous updates
        const allPreviousHitIds = new Set();
        
        // Get hits from original task outcomes
        const outcomes = check.taskOutcomes || {};
        const pepsTask = outcomes['peps'] || outcomes['screening:lite'] || outcomes['screening'];
        const sanctionsTask = outcomes['sanctions'];
        const companyPepsTask = outcomes['company:peps'];
        const companySanctionsTask = outcomes['company:sanctions'];
        
        if (pepsTask?.breakdown?.hits) {
            pepsTask.breakdown.hits.forEach(hit => allPreviousHitIds.add(hit.id));
        }
        if (sanctionsTask?.breakdown?.hits) {
            sanctionsTask.breakdown.hits.forEach(hit => allPreviousHitIds.add(hit.id));
        }
        if (companyPepsTask?.breakdown?.hits) {
            companyPepsTask.breakdown.hits.forEach(hit => allPreviousHitIds.add(hit.id));
        }
        if (companySanctionsTask?.breakdown?.hits) {
            companySanctionsTask.breakdown.hits.forEach(hit => allPreviousHitIds.add(hit.id));
        }
        
        // Get all dismissals from check.pepDismissals to match by hit ID
        const checkDismissals = check.pepDismissals || [];
        
        // Create a map of dismissals by hitId for quick lookup
        const dismissalsByHitId = {};
        checkDismissals.forEach(d => {
            // Use the most recent dismissal if multiple exist for the same hit
            if (!dismissalsByHitId[d.hitId] || new Date(d.timestamp) > new Date(dismissalsByHitId[d.hitId].timestamp || 0)) {
                dismissalsByHitId[d.hitId] = d;
            }
        });
        
        // Create a map of all updates by timestamp for lookup
        const updatesByTimestamp = {};
        pepUpdates.forEach(update => {
            updatesByTimestamp[update.timestamp] = update;
        });
        
        let updatesHtml = '<div class="pep-updates-header">Screening Updates</div>';
        
        // Reverse to show most recent first
        [...pepUpdates].reverse().forEach((update, index) => {
            const date = new Date(update.timestamp).toLocaleDateString('en-GB');
            
            // Get hits and dismissals from reportJson
            const reportJson = update.reportJson || {};
            const breakdown = reportJson.breakdown || {};
            const allHits = breakdown.hits || [];
            const dismissals = breakdown.dismissals || [];
            
            // Create a set of dismissed hit IDs from the report's dismissals
            const dismissedHitIds = new Set(dismissals.map(d => d.id));
            
            // Collect hit IDs from all updates that came BEFORE this one (chronologically)
            const previousHitIds = new Set(allPreviousHitIds); // Start with original task hits
            pepUpdates.forEach(prevUpdate => {
                if (new Date(prevUpdate.timestamp) < new Date(update.timestamp)) {
                    const prevReportJson = prevUpdate.reportJson || {};
                    const prevBreakdown = prevReportJson.breakdown || {};
                    const prevHits = prevBreakdown.hits || [];
                    prevHits.forEach(hit => previousHitIds.add(hit.id));
                }
            });
            
            // Separate outstanding and dismissed hits, and identify new hits
            const outstandingHits = [];
            const dismissedHits = [];
            const newHits = [];
            
            if (allHits.length > 0) {
                allHits.forEach((hit) => {
                    const isDismissed = dismissedHitIds.has(hit.id);
                    const isNew = !previousHitIds.has(hit.id);
                    
                    if (isDismissed) {
                        dismissedHits.push(hit);
                    } else {
                        outstandingHits.push(hit);
                        if (isNew) {
                            newHits.push(hit);
                        }
                    }
                });
            }
            
            // Calculate counts for subtitle
            const outstandingCount = outstandingHits.length;
            const newCount = newHits.length;
            const isCleared = outstandingCount === 0;
            
            // Determine subtitle text based on new vs outstanding
            let subtitle = '';
            if (!isCleared) {
                if (newCount > 0 && newCount === outstandingCount) {
                    // All outstanding hits are new
                    subtitle = `<div class="pep-update-subtitle">${newCount} new hit${newCount > 1 ? 's' : ''} for review</div>`;
                } else if (newCount > 0) {
                    // Some are new, some are outstanding from before
                    subtitle = `<div class="pep-update-subtitle">${outstandingCount} hit${outstandingCount > 1 ? 's' : ''} for review (${newCount} new)</div>`;
                } else {
                    // No new hits, just outstanding from before
                    subtitle = `<div class="pep-update-subtitle">${outstandingCount} hit${outstandingCount > 1 ? 's' : ''} for review</div>`;
                }
            }
            
            const title = isCleared ? 'All Hits Dismissed' : 'Updated PEP/Sanctions Screening';
            const tag = isCleared ? '<span class="outcome-tag clear">CLEAR</span>' : '<span class="outcome-tag consider">CONSIDER</span>';
            
            let hitsHtml = '';
            if (allHits.length > 0) {
                
                hitsHtml = '<div class="pep-hits-details">';
                
                // Render outstanding hits fully expanded
                outstandingHits.forEach((hit) => {
                    // Prepare hit data in the same format as screening task
                    const name = hit.name || 'Unknown';
                    const dob = this.extractDob(hit.dob);
                    const flagTypes = hit.flag_types || [];
                    const positions = hit.political_positions || [];
                    const countries = hit.countries || [];
                    const aka = hit.aka || [];
                    const score = hit.score || 0;
                    
                    // Determine primary hit type
                    let hitType = '';
                    let hitIcon = '⚠️';
                    
                    if (flagTypes.length > 0) {
                        if (flagTypes.some(f => f.includes('pep'))) {
                            hitType = 'PEP';
                            hitIcon = '👤';
                        }
                        if (flagTypes.some(f => f.includes('sanction'))) {
                            hitType = hitType ? `${hitType} + Sanctions` : 'Sanctions';
                            hitIcon = '🚫';
                        }
                        if (flagTypes.some(f => f.includes('adverse-media'))) {
                            hitType = hitType ? `${hitType} + Adverse Media` : 'Adverse Media';
                            hitIcon = '📰';
                        }
                    } else {
                        hitType = 'PEP';
                        hitIcon = '👤';
                    }
                    
                    // Create hit data object (no dismissal for outstanding hits)
                    const hitData = {
                        name,
                        dob,
                        hitType,
                        hitIcon,
                        score,
                        flagTypes,
                        positions,
                        countries,
                        aka,
                        media: hit.media || [],
                        associates: hit.associates || [],
                        fields: hit.fields || [],
                        match_types: hit.match_types || [],
                        dismissal: null
                    };
                    
                    // Render the hit card using the same function as screening task
                    hitsHtml += this.createScreeningHitCard(hitData);
                });
                
                // Add collapsible "Dismissed Hits" section if there are dismissed hits
                if (dismissedHits.length > 0) {
                    const dismissedSectionId = `dismissed-hits-${update.timestamp}-${index}`;
                    hitsHtml += `
                        <div class="dismissed-hits-section" onclick="event.stopPropagation(); document.getElementById('${dismissedSectionId}').classList.toggle('expanded'); this.classList.toggle('expanded');">
                            <div class="dismissed-hits-header">
                                <span class="dismissed-hits-title">Dismissed Hits</span>
                                <span class="dismissed-hits-count">${dismissedHits.length}</span>
                                <svg class="dismissed-hits-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M6 9l6 6 6-6"/>
                                </svg>
                            </div>
                            <div id="${dismissedSectionId}" class="dismissed-hits-content">
                    `;
                    
                    // Render dismissed hits with dismissal information
                    dismissedHits.forEach((hit) => {
                        // Prepare hit data in the same format as screening task
                        const name = hit.name || 'Unknown';
                        const dob = this.extractDob(hit.dob);
                        const flagTypes = hit.flag_types || [];
                        const positions = hit.political_positions || [];
                        const countries = hit.countries || [];
                        const aka = hit.aka || [];
                        const score = hit.score || 0;
                        
                        // Determine primary hit type
                        let hitType = '';
                        let hitIcon = '⚠️';
                        
                        if (flagTypes.length > 0) {
                            if (flagTypes.some(f => f.includes('pep'))) {
                                hitType = 'PEP';
                                hitIcon = '👤';
                            }
                            if (flagTypes.some(f => f.includes('sanction'))) {
                                hitType = hitType ? `${hitType} + Sanctions` : 'Sanctions';
                                hitIcon = '🚫';
                            }
                            if (flagTypes.some(f => f.includes('adverse-media'))) {
                                hitType = hitType ? `${hitType} + Adverse Media` : 'Adverse Media';
                                hitIcon = '📰';
                            }
                        } else {
                            hitType = 'PEP';
                            hitIcon = '👤';
                        }
                        
                        // Find dismissal info by hit ID from all dismissals
                        const dismissal = dismissalsByHitId[hit.id] || null;
                        
                        // Create hit data object with dismissal info
                        const hitData = {
                            name,
                            dob,
                            hitType,
                            hitIcon,
                            score,
                            flagTypes,
                            positions,
                            countries,
                            aka,
                            media: hit.media || [],
                            associates: hit.associates || [],
                            fields: hit.fields || [],
                            match_types: hit.match_types || [],
                            dismissal: dismissal
                        };
                        
                        // Render the hit card using the same function as screening task
                        hitsHtml += this.createScreeningHitCard(hitData);
                    });
                    
                    hitsHtml += `
                            </div>
                        </div>
                    `;
                }
                
                hitsHtml += '</div>';
            }
            
            updatesHtml += `
                <div class="pep-update-item" onclick="this.classList.toggle('expanded')">
                    <div class="pep-update-header">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="pep-update-title">${title}</span>
                                ${tag}
                            </div>
                            ${subtitle}
                        </div>
                        <div class="pep-update-right">
                            <span class="pep-update-date">${date}</span>
                        </div>
                    </div>
                    ${hitsHtml}
                </div>
            `;
        });
        
        this.pepUpdatesCard.innerHTML = updatesHtml;
    }
    
    extractRedFlags(check) {
        // Priority 1: Use pre-calculated red flags from backend (transaction:pdf webhook)
        // These are generated once and stored with the check object
        if (check.redFlags && Array.isArray(check.redFlags) && check.redFlags.length > 0) {
            console.log('🚩 Using stored red flags:', check.redFlags.length);
            return check.redFlags;
        }
        
        console.log('⚠️ No stored red flags found, checking alternative locations...');
        const allFlags = [];
        const taskOutcomes = check.taskOutcomes || {};
        
        // Fallback: Check in taskOutcomes breakdown (if stored by Thirdfort API directly)
        const sofTask = taskOutcomes['sof:v1'];
        if (sofTask?.breakdown?.red_flags && sofTask.breakdown.red_flags.length > 0) {
            sofTask.breakdown.red_flags.forEach(flag => {
                allFlags.push({
                    source: 'Source of Funds',
                    ...flag
                });
            });
        }
        
        const bankSummary = taskOutcomes['bank:summary'];
        if (bankSummary?.breakdown?.red_flags && bankSummary.breakdown.red_flags.length > 0) {
            bankSummary.breakdown.red_flags.forEach(flag => {
                allFlags.push({
                    source: 'Bank Linking',
                    ...flag
                });
            });
        }
        
        const bankStatement = taskOutcomes['bank:statement'];
        if (bankStatement?.breakdown?.red_flags && bankStatement.breakdown.red_flags.length > 0) {
            bankStatement.breakdown.red_flags.forEach(flag => {
                allFlags.push({
                    source: 'Bank Linking',
                    ...flag
                });
            });
        }
        
        // Additional fallback: Check in reports array
        if (check.reports && Array.isArray(check.reports)) {
            check.reports.forEach(report => {
                if (report.breakdown?.red_flags && report.breakdown.red_flags.length > 0) {
                    const source = report.type === 'sof:v1' ? 'Source of Funds' : 
                                   report.type.includes('bank') ? 'Bank Linking' : 
                                   'Check Report';
                    report.breakdown.red_flags.forEach(flag => {
                        allFlags.push({
                            source: source,
                            ...flag
                        });
                    });
                }
            });
        }
        
        return allFlags;
    }
    
    renderRedFlagsCard(check) {
        const allFlags = this.extractRedFlags(check);
        
        // If no flags, hide the card
        if (allFlags.length === 0) {
            this.redFlagsCard.classList.add('hidden');
            return;
        }
        
        // Show the card
        this.redFlagsCard.classList.remove('hidden');
        
        const taskOutcomes = check.taskOutcomes || {};
        const totalFlags = allFlags.length;
        const flagWord = totalFlags === 1 ? 'flag' : 'flags';
        
        // Build the HTML as a collapsible task card
        let flagsContent = '';
        
        // Process each flag with rich detail
        allFlags.forEach((flag, index) => {
            const flagType = flag.description || '';
            
            let flagHtml = '';
            if (flagType === 'Gifts Received') {
                flagHtml = this.renderGiftFlag(flag, taskOutcomes, check);
            } else if (flagType === 'Declared savings > actual savings' || flagType.includes('savings')) {
                flagHtml = this.renderSavingsFlag(flag, taskOutcomes, check);
            } else if (flagType === 'No Mortgage Used') {
                flagHtml = this.renderNoMortgageFlag(flag, taskOutcomes);
            } else if (flagType === 'Cryptocurrency Funding') {
                flagHtml = this.renderCryptoFlag(flag, taskOutcomes);
            } else if (flagType === 'Funds from Overseas') {
                flagHtml = this.renderOverseasFlag(flag, taskOutcomes);
            } else if (flagType.includes('cash deposit')) {
                flagHtml = this.renderCashDepositFlag(flag, taskOutcomes);
            } else {
                // Generic flag rendering
                flagHtml = this.renderGenericFlag(flag);
            }
            
            // Add investigation notes for this red flag
            const flagAnnotationsHtml = this.renderRedFlagAnnotations(check, index);
            
            // Wrap flag content in a container
            flagsContent += `
                <div class="red-flag-with-annotations">
                    ${flagHtml}
                    ${flagAnnotationsHtml}
                </div>
            `;
        });
        
        // Wrap in task card format (with RED consider status icon)
        const redConsiderIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#d32f2f" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        
        // Build header checks with red flag icon (using custom red consider icon)
        const redCheckIcon = `
            <svg class="task-check-icon" viewBox="0 0 24 24" width="16" height="16">
                <circle cx="12" cy="12" r="10" fill="#d32f2f"/>
                <line x1="7" y1="12" x2="17" y2="12" stroke="#ffffff" stroke-width="2"/>
            </svg>
        `;
        
        const headerChecksHtml = `
            <div class="task-header-checks">
                <div class="task-check-item">
                    ${redCheckIcon}
                    <span class="task-check-text">${totalFlags} Red ${flagWord} identified</span>
                </div>
            </div>
        `;
        
        // Count SOF annotation updates related to red flags
        const sofNotes = (check.sofAnnotations || []);
        let redFlagUpdateCount = 0;
        sofNotes.forEach(ann => {
            const fundingMethods = ann.notes?.fundingMethods || [];
            fundingMethods.forEach(fm => {
                if (fm.redFlags && fm.redFlags.length > 0) {
                    redFlagUpdateCount++;
                }
            });
            const topLevelRedFlags = ann.notes?.redFlags || [];
            if (topLevelRedFlags.length > 0) {
                redFlagUpdateCount++;
            }
        });
        
        const annotationBadge = redFlagUpdateCount > 0 ? `<span class="annotation-count-badge">${redFlagUpdateCount} Update${redFlagUpdateCount > 1 ? 's' : ''}</span>` : '';
        
        // Wrap badge in container for consistent right-alignment
        const badgesHtml = annotationBadge ? `<div class="task-header-badges">${annotationBadge}</div>` : '';
        
        let flagsHtml = `
            <div class="task-card consider" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Red Flags</div>
                    ${badgesHtml}
                    ${redConsiderIcon}
                </div>
                ${headerChecksHtml}
                <div class="task-details">
                    ${flagsContent}
                </div>
            </div>
        `;
        
        this.redFlagsCard.innerHTML = flagsHtml;
    }
    
    renderRedFlagAnnotations(check, flagIdx) {
        const sofAnnotations = check.sofAnnotations || [];
        let html = '';
        
        // Filter annotations that have notes for this red flag
        const relevantAnnotations = [];
        
        sofAnnotations.forEach(ann => {
            // Check funding methods for red flag notes
            const fundingMethods = ann.notes?.fundingMethods || [];
            fundingMethods.forEach(fm => {
                const redFlags = fm.redFlags || [];
                const flagNote = redFlags.find(rf => rf.flagIdx === flagIdx.toString());
                if (flagNote) {
                    relevantAnnotations.push({ ann, fundingMethod: fm, flagNote });
                }
            });
            
            // Check top-level red flags
            const topLevelRedFlags = ann.notes?.redFlags || [];
            const topLevelFlagNote = topLevelRedFlags.find(rf => rf.flagIdx === flagIdx.toString());
            if (topLevelFlagNote) {
                relevantAnnotations.push({ ann, fundingMethod: null, flagNote: topLevelFlagNote });
            }
        });
        
        if (relevantAnnotations.length > 0) {
            html = '<div class="red-flag-annotations-section">';
            html += '<div class="red-flag-annotations-header">Investigation Notes</div>';
            
            relevantAnnotations.forEach(({ ann, fundingMethod, flagNote }) => {
                const date = new Date(ann.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                html += '<div class="annotation-mini-card">';
                html += '<div class="annotation-mini-header">';
                html += '<div class="annotation-mini-meta">';
                html += '<strong>' + (ann.userName || ann.user) + '</strong> • ' + date;
                html += '</div>';
                html += '</div>';
                html += '<div class="annotation-mini-body">';
                
                // Show note if exists
                if (flagNote.note) {
                    html += '<p class="annotation-mini-reason">' + flagNote.note + '</p>';
                }
                
                // Show status badge
                if (flagNote.status) {
                    let statusBadge = '';
                    let statusIcon = '';
                    
                    if (flagNote.status === 'confirmed') {
                        statusIcon = '<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#d32f2f" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                        statusBadge = 'Confirmed';
                    } else if (flagNote.status === 'dismissed') {
                        statusIcon = '<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                        statusBadge = 'Dismissed';
                    }
                    
                    if (statusBadge) {
                        html += '<div class="annotation-mini-objectives">';
                        html += '<div class="annotation-objective-item">';
                        html += statusIcon;
                        html += '<span class="annotation-objective-label"><strong>Status:</strong> ' + statusBadge + '</span>';
                        html += '</div>';
                        html += '</div>';
                    }
                }
                
                html += '</div></div>';
            });
            
            html += '</div>';
        }
        
        return html;
    }
    
    renderGiftFlag(flag, taskOutcomes, check) {
        const sofTask = taskOutcomes['sof:v1'];
        if (!sofTask?.breakdown?.funds) return '';
        
        // Find gift funding methods
        const giftFunds = sofTask.breakdown.funds.filter(f => f.type === 'fund:gift');
        if (giftFunds.length === 0) return '';
        
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">Gift</div>`;
        
        giftFunds.forEach(giftFund => {
            const amount = giftFund.data?.amount || 0;
            const giftor = giftFund.data?.giftor || {};
            const giftFundIndex = sofTask.breakdown.funds.findIndex(f => f === giftFund);
            
            html += `<div class="red-flag-amount">£${(amount / 100).toLocaleString()}</div>`;
            
            // Giftor details
            if (giftor.name) {
                html += `<div class="red-flag-detail-section">`;
                html += `<div class="red-flag-detail-title">Giftor Details</div>`;
                html += `<div class="red-flag-detail-item"><strong>Name:</strong> ${giftor.name}</div>`;
                if (giftor.relationship) html += `<div class="red-flag-detail-item"><strong>Relationship:</strong> ${giftor.relationship}</div>`;
                if (giftor.phone) html += `<div class="red-flag-detail-item"><strong>Phone:</strong> ${giftor.phone}</div>`;
                if (giftor.contactable !== undefined) html += `<div class="red-flag-detail-item"><strong>Contactable:</strong> ${giftor.contactable ? 'Yes' : 'No'}</div>`;
                html += `</div>`;
            }
            
            // Get accounts for transaction lookup
            const bankStatement = taskOutcomes['bank:statement'];
            const bankSummary = taskOutcomes['bank:summary'];
            const docsBankStatement = taskOutcomes['documents:bank-statement'];
            const accounts = bankStatement?.breakdown?.accounts || 
                           bankSummary?.breakdown?.accounts || 
                           docsBankStatement?.breakdown?.accounts || 
                           {};
            
            // Get sof_matches from any source
            const sofMatches = bankSummary?.breakdown?.analysis?.sof_matches ||
                              bankStatement?.breakdown?.analysis?.sof_matches ||
                              docsBankStatement?.breakdown?.analysis?.sof_matches ||
                              {};
            
            // Use comprehensive getMatchedTransactions to get ALL linked transactions
            const matchedTxIds = this.getMatchedTransactions('fund:gift', sofMatches, giftFund, giftFundIndex, check);
            
            // Collect bank analysis items linked to this gift funding
            const linkedBankAnalysisItems = [];
            if (check) {
                const sofAnnotations = check.sofAnnotations || [];
                sofAnnotations.forEach(ann => {
                    const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                    bankAnalysisItems.forEach(item => {
                        if (item.linkedToFundIdx === giftFundIndex.toString()) {
                            linkedBankAnalysisItems.push({
                                ...item,
                                userName: ann.userName || ann.user,
                                timestamp: ann.timestamp
                            });
                        }
                    });
                });
            }
            
            // Check for gift transaction matches
            if (matchedTxIds.length > 0) {
                html += `<div class="matched-transactions-section" style="margin-top: 16px;">`;
                html += `<div class="matched-tx-label">Potential Gift Deposits:</div>`;
                
                // Helper to get transaction details from ID
                const getTransactionById = (txId) => {
                    for (const [accountId, accountData] of Object.entries(accounts)) {
                        const statement = accountData.statement || [];
                        const tx = statement.find(t => t.id === txId);
                        if (tx) {
                            const accountInfo = accountData.info || accountData;
                            return { ...tx, accountName: accountInfo.name || 'Account', accountId };
                        }
                    }
                    return null;
                };
                
                // Show matched gift transactions using comprehensive annotations
                matchedTxIds.forEach(txId => {
                    const tx = getTransactionById(txId);
                    if (tx) {
                        const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const currencySymbol = '£';
                        const txAmount = tx.amount >= 0 ? '+' : '';
                        
                        // Get comprehensive annotations for this transaction
                        const txAnnotations = this.getTransactionAnnotations(txId, check);
                        
                        // Check if this transaction has a marker
                        const marker = txAnnotations.marker;
                        let markerBadge = '';
                        if (marker === 'accepted') {
                            markerBadge = '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                        } else if (marker === 'rejected') {
                            markerBadge = '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                        }
                        
                        // Check if has flag
                        const flag = txAnnotations.flag;
                        let flagBadge = '';
                        if (flag === 'cleared') {
                            flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50; margin-left: 4px;">○ Cleared</span>';
                        } else if (flag === 'suspicious') {
                            flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336; margin-left: 4px;">✗ Suspicious</span>';
                        } else if (flag === 'review') {
                            flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; margin-left: 4px;">— Review</span>';
                        } else if (flag === 'linked') {
                            flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-left: 4px;">✓ Linked</span>';
                        }
                        
                        // Check if transaction is part of repeating group and get user comment
                        let repeatingBadge = '';
                        let userNoteBadge = '';
                        
                        const analysis = bankStatement?.breakdown?.analysis || bankSummary?.breakdown?.analysis || docsBankStatement?.breakdown?.analysis;
                        if (analysis && analysis.repeating_transactions) {
                            analysis.repeating_transactions.forEach((group, groupIdx) => {
                                if (group.items && group.items.includes(txId)) {
                                    // Add repeating badge
                                    repeatingBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f3e5f5; color: #9c27b0; border: 1px solid #9c27b0; margin-left: 4px;">Repeating</span>';
                                    
                                    // Check for user comment on this repeating group
                                    if (check && check.sofAnnotations) {
                                        check.sofAnnotations.forEach(ann => {
                                            const items = ann.notes?.bankAnalysisItems || [];
                                            items.forEach(item => {
                                                if (item.type === 'repeating-group' && item.groupIndex === groupIdx && item.comment) {
                                                    userNoteBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #eceff1; color: #607d8b; border: 1px solid #607d8b; margin-left: 4px;"><svg viewBox="0 0 24 24" style="width: 10px; height: 10px; margin-right: 3px; vertical-align: middle;"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>${item.comment}</span>`;
                                                }
                                            });
                                        });
                                    }
                                }
                            });
                        }
                        
                        html += `
                            <div class="matched-tx-row ${marker ? 'marked-' + marker : ''}">
                                <span class="matched-tx-date">${date}</span>
                                <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Gift'}${markerBadge}${flagBadge}${repeatingBadge}${userNoteBadge}</span>
                                <span class="matched-tx-account">${tx.accountName}</span>
                                <span class="matched-tx-amount">${txAmount}${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                            </div>
                        `;
                    }
                });
                
                html += `</div>`;
            } else if (Object.keys(accounts).length > 0) {
                // No matched transactions but we have bank data - check if gift document uploaded
                const hasGiftDocument = check.taskOutcomes && check.taskOutcomes['documents:gift'] && 
                                       check.taskOutcomes['documents:gift'].status === 'closed';
                
                // Only show hint if no gift document uploaded
                if (!hasGiftDocument) {
                    const considerIcon = `<svg class="task-status-icon" viewBox="0 0 300 300" style="width: 20px; height: 20px; margin-right: 8px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
                    
                    html += `
                        <div class="matched-transactions-section" style="margin-top: 16px;">
                            <div class="matched-tx-label">Potential Gift Deposits:</div>
                            <div class="no-matches-hint">
                                ${considerIcon}
                                <span>No linked bank transactions detected, manual review required</span>
                            </div>
                        </div>
                    `;
                }
            }
        });
        
        html += `</div>`;
        return html;
    }
    
    renderSavingsFlag(flag, taskOutcomes, check) {
        const sofTask = taskOutcomes['sof:v1'];
        const bankStatement = taskOutcomes['bank:statement'];
        const bankSummary = taskOutcomes['bank:summary'];
        const docsBankStatement = taskOutcomes['documents:bank-statement'];
        
        if (!sofTask?.breakdown?.funds) return '';
        
        // Find savings funding method
        const savingsFunds = sofTask.breakdown.funds.filter(f => f.type === 'fund:savings');
        if (savingsFunds.length === 0) return '';
        
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">Savings</div>`;
        html += `<div class="red-flag-subtitle">Declared savings less than actual</div>`;
        
        // Declared savings
        let totalDeclared = 0;
        savingsFunds.forEach(fund => {
            totalDeclared += fund.data?.amount || 0;
        });
        
        html += `<div class="red-flag-subsection">`;
        html += `<div class="red-flag-detail-title">Declared Savings</div>`;
        html += `<div class="red-flag-amount">£${(totalDeclared / 100).toLocaleString()}</div>`;
        
        // Show people contributing to savings
        savingsFunds.forEach(fund => {
            if (fund.data?.people && fund.data.people.length > 0) {
                html += `<div class="people-grid people-grid-${fund.data.people.length}">`;
                
                fund.data.people.forEach(person => {
                    const isActor = person.actor ? 'Primary' : 'Joint';
                    const employmentStatus = person.employment_status === 'independent' ? 'Self-employed' : 
                                            person.employment_status ? person.employment_status.charAt(0).toUpperCase() + person.employment_status.slice(1) : '';
                    
                    html += `<div class="person-card">`;
                    html += `<div class="person-card-name">${person.name}</div>`;
                    html += `<div class="person-card-role">${isActor}</div>`;
                    if (employmentStatus) {
                        html += `<div class="person-card-item">${employmentStatus}</div>`;
                    }
                    if (person.incomes && person.incomes.length > 0) {
                        person.incomes.forEach(income => {
                            html += `<div class="person-card-item">Income: ${income.source || 'N/A'}</div>`;
                            html += `<div class="person-card-item">Frequency: ${income.frequency || 'N/A'}</div>`;
                            if (income.reference) {
                                html += `<div class="person-card-item">Payslip Ref: ${income.reference}</div>`;
                            }
                        });
                    }
                    html += `</div>`;
                });
                
                html += `</div>`;
            }
        });
        html += `</div>`;
        
        // Actual savings from bank accounts
        html += `<div class="red-flag-subsection">`;
        html += `<div class="red-flag-detail-title">Actual Savings</div>`;
        
        const accounts = bankStatement?.breakdown?.accounts || 
                        bankSummary?.breakdown?.accounts || 
                        docsBankStatement?.breakdown?.accounts || 
                        {};
        let totalActual = 0;
        const providerTotals = {};
        
        Object.values(accounts).forEach(account => {
            // Handle both nested (bank:statement) and flat (bank:summary) structures
            const accountInfo = account.info || account;
            const balance = accountInfo.balance?.current || accountInfo.balance?.available || 0;
            
            if (balance > 0) {
                totalActual += balance;
                
                const providerName = accountInfo.provider?.name || 'Unknown Provider';
                const providerId = accountInfo.provider?.id || providerName;
                
                if (!providerTotals[providerId]) {
                    providerTotals[providerId] = {
                        name: providerName,
                        total: 0,
                        accounts: []
                    };
                }
                providerTotals[providerId].total += balance;
                providerTotals[providerId].accounts.push({
                    name: accountInfo.name || accountInfo.account_name || accountInfo.type || 'Account',
                    balance: balance
                });
            }
        });
        
        html += `<div class="red-flag-amount">£${totalActual.toLocaleString()}</div>`;
        
        // Breakdown by provider
        Object.values(providerTotals).forEach(provider => {
            const logoHtml = this.getBankLogo(provider.name, provider.name);
            const hasLogo = logoHtml.includes('<img');
            
            html += `<div class="red-flag-provider-item">`;
            
            // If logo exists, show it at 80x80px on left, total and accounts on right stacked
            if (hasLogo) {
                html += `<div class="red-flag-bank-logo">${logoHtml}</div>`;
                html += `<div class="red-flag-provider-details">`;
                html += `<div class="red-flag-provider-total">£${provider.total.toLocaleString()}</div>`;
                provider.accounts.forEach(acc => {
                    html += `<div class="red-flag-provider-account">${acc.name}: £${acc.balance.toLocaleString()}</div>`;
                });
                html += `</div>`;
            } else {
                // No logo - show name and accounts
                html += `<div class="red-flag-provider-details-full">`;
                html += `<div class="red-flag-provider-name-header">${provider.name}</div>`;
                html += `<div class="red-flag-provider-total">£${provider.total.toLocaleString()}</div>`;
                provider.accounts.forEach(acc => {
                    html += `<div class="red-flag-provider-account">${acc.name}: £${acc.balance.toLocaleString()}</div>`;
                });
                html += `</div>`;
            }
            
            html += `</div>`;
        });
        
        // Get sof_matches from any source
        const sofMatches = bankStatement?.breakdown?.analysis?.sof_matches ||
                          bankSummary?.breakdown?.analysis?.sof_matches ||
                          docsBankStatement?.breakdown?.analysis?.sof_matches ||
                          {};
        
        // Helper to get transaction details from ID
        const getTransactionById = (txId) => {
            for (const [accountId, accountData] of Object.entries(accounts)) {
                const statement = accountData.statement || [];
                const tx = statement.find(t => t.id === txId);
                if (tx) {
                    const accountInfo = accountData.info || accountData;
                    return { ...tx, accountName: accountInfo.name || 'Account', accountId };
                }
            }
            return null;
        };
        
        // Use comprehensive getMatchedTransactions for ALL savings funds
        const allSalaryTxIds = new Set();
        const autoMatchedTxIds = new Set();
        
        // Get auto-matched salary transactions
        if (sofMatches.salary_transactions) {
            sofMatches.salary_transactions.forEach(txId => {
                allSalaryTxIds.add(txId);
                autoMatchedTxIds.add(txId);
            });
        }
        
        // For each savings fund, get ALL matched transactions including from bank analysis
        savingsFunds.forEach((fund, idx) => {
            const fundIndex = sofTask.breakdown.funds.findIndex(f => f === fund);
            const matchedForThisFund = this.getMatchedTransactions('fund:savings', sofMatches, fund, fundIndex, check);
            matchedForThisFund.forEach(txId => allSalaryTxIds.add(txId));
        });
        
        // Collect bank analysis items linked to any savings funding
        const linkedBankAnalysisItems = [];
        if (check) {
            const sofAnnotations = check.sofAnnotations || [];
            sofAnnotations.forEach(ann => {
                const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                bankAnalysisItems.forEach(item => {
                    // Check if linked to any savings funding method
                    const linkedFundIdx = parseInt(item.linkedToFundIdx);
                    const linkedFund = sofTask.breakdown.funds[linkedFundIdx];
                    if (linkedFund && linkedFund.type === 'fund:savings') {
                        linkedBankAnalysisItems.push({
                            ...item,
                            userName: ann.userName || ann.user,
                            timestamp: ann.timestamp
                        });
                    }
                });
            });
        }
        
        if (allSalaryTxIds.size > 0) {
            html += `<div class="matched-transactions-section" style="margin-top: 16px;">`;
            html += `<div class="matched-tx-label">Verified Salary Deposits:</div>`;
            
            // Show all salary transactions with comprehensive annotations
            Array.from(allSalaryTxIds).forEach(txId => {
                const tx = getTransactionById(txId);
                if (tx) {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const currencySymbol = '£';
                    const txAmount = tx.amount >= 0 ? '+' : '';
                    
                    // Get comprehensive annotations
                    const txAnnotations = this.getTransactionAnnotations(txId, check);
                    
                    // Check if linked to any savings funding
                    const isLinkedToSavings = txAnnotations.linkedFundingMethods.some(fundIdxStr => {
                        const fund = sofTask.breakdown.funds[parseInt(fundIdxStr)];
                        return fund && fund.type === 'fund:savings';
                    });
                    
                    // Add source badge
                    const isAutoMatched = autoMatchedTxIds.has(txId);
                    let sourceBadge = '';
                    if (isLinkedToSavings && !isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge user-linked">👤 User Linked</span>';
                    } else if (isLinkedToSavings && isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge both-matched">✓ Confirmed</span>';
                    }
                    
                    // Check if has marker
                    const marker = txAnnotations.marker;
                    let markerBadge = '';
                    if (marker === 'accepted') {
                        markerBadge = '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (marker === 'rejected') {
                        markerBadge = '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Check if has flag
                    const flag = txAnnotations.flag;
                    let flagBadge = '';
                    if (flag === 'cleared') {
                        flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50; margin-left: 4px;">○ Cleared</span>';
                    } else if (flag === 'suspicious') {
                        flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336; margin-left: 4px;">✗ Suspicious</span>';
                    } else if (flag === 'review') {
                        flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; margin-left: 4px;">— Review</span>';
                    } else if (flag === 'linked') {
                        flagBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-left: 4px;">✓ Linked</span>';
                    }
                    
                    // Check if transaction is part of repeating group and get user comment
                    let repeatingBadge = '';
                    let userNoteBadge = '';
                    
                    const analysis = bankStatement?.breakdown?.analysis || bankSummary?.breakdown?.analysis || docsBankStatement?.breakdown?.analysis;
                    if (analysis && analysis.repeating_transactions) {
                        analysis.repeating_transactions.forEach((group, groupIdx) => {
                            if (group.items && group.items.includes(txId)) {
                                // Add repeating badge
                                repeatingBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f3e5f5; color: #9c27b0; border: 1px solid #9c27b0; margin-left: 4px;">Repeating</span>';
                                
                                // Check for user comment on this repeating group
                                if (check && check.sofAnnotations) {
                                    check.sofAnnotations.forEach(ann => {
                                        const items = ann.notes?.bankAnalysisItems || [];
                                        items.forEach(item => {
                                            if (item.type === 'repeating-group' && item.groupIndex === groupIdx && item.comment) {
                                                userNoteBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #eceff1; color: #607d8b; border: 1px solid #607d8b; margin-left: 4px;"><svg viewBox="0 0 24 24" style="width: 10px; height: 10px; margin-right: 3px; vertical-align: middle;"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>${item.comment}</span>`;
                                            }
                                        });
                                    });
                                }
                            }
                        });
                    }
                    
                    html += `
                        <div class="matched-tx-row">
                            <span class="matched-tx-date">${date}</span>
                            <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Salary'}${markerBadge}${flagBadge}${sourceBadge}${repeatingBadge}${userNoteBadge}</span>
                            <span class="matched-tx-account">${tx.accountName}</span>
                            <span class="matched-tx-amount">${txAmount}${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                            </div>
                        `;
                }
            });
            
            html += `</div>`;
        } else if (Object.keys(accounts).length > 0) {
            // No matched salary transactions but we have bank data
            // For savings, always show hint when no matches (even if savings document uploaded)
            // because we need to verify the income SOURCE, not just the balance
            const considerIcon = `<svg class="task-status-icon" viewBox="0 0 300 300" style="width: 20px; height: 20px; margin-right: 8px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
            
            html += `
                <div class="matched-transactions-section" style="margin-top: 16px;">
                    <div class="matched-tx-label">Verified Salary Deposits:</div>
                    <div class="no-matches-hint">
                        ${considerIcon}
                        <span>No linked bank transactions detected, manual review required</span>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        html += `</div>`;
        return html;
    }
    
    renderNoMortgageFlag(flag, taskOutcomes) {
        const sofTask = taskOutcomes['sof:v1'];
        if (!sofTask?.breakdown) return '';
        
        const property = sofTask.breakdown.property || {};
        const funds = sofTask.breakdown.funds || [];
        
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">No Mortgage Used</div>`;
        
        const propertyPrice = property.price || 0;
        html += `<div class="red-flag-detail-section">`;
        html += `<div class="red-flag-detail-title">Property Details</div>`;
        html += `<div class="red-flag-amount">£${(propertyPrice / 100).toLocaleString()}</div>`;
        if (property.address) {
            const addr = property.address;
            html += `<div class="red-flag-detail-item">${addr.building_number || ''} ${addr.street || ''}, ${addr.town || ''}, ${addr.postcode || ''}</div>`;
        }
        html += `<div class="red-flag-detail-item">Funded entirely without mortgage</div>`;
        html += `</div>`;
        
        html += `</div>`;
        return html;
    }
    
    renderCryptoFlag(flag, taskOutcomes) {
        const sofTask = taskOutcomes['sof:v1'];
        if (!sofTask?.breakdown?.funds) return '';
        
        const cryptoFunds = sofTask.breakdown.funds.filter(f => f.type === 'fund:crypto' || f.type === 'fund:cryptocurrency');
        if (cryptoFunds.length === 0) return '';
        
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">Cryptocurrency</div>`;
        
        cryptoFunds.forEach(fund => {
            const amount = fund.data?.amount || 0;
            html += `<div class="red-flag-amount">£${(amount / 100).toLocaleString()}</div>`;
            if (fund.data?.description) {
                html += `<div class="red-flag-detail-item">${fund.data.description}</div>`;
            }
        });
        
        html += `</div>`;
        return html;
    }
    
    renderOverseasFlag(flag, taskOutcomes) {
        const sofTask = taskOutcomes['sof:v1'];
        if (!sofTask?.breakdown?.funds) return '';
        
        const overseasFunds = sofTask.breakdown.funds.filter(f => {
            const loc = f.data?.location;
            return loc && loc !== 'GBR' && loc !== 'GB' && loc !== 'UK';
        });
        
        if (overseasFunds.length === 0) return '';
        
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">Funds from Overseas</div>`;
        
        overseasFunds.forEach(fund => {
            const amount = fund.data?.amount || 0;
            const location = fund.data?.location || '';
            html += `<div class="red-flag-amount">£${(amount / 100).toLocaleString()}</div>`;
            html += `<div class="red-flag-detail-item">Source: ${location}</div>`;
        });
        
        html += `</div>`;
        return html;
    }
    
    renderCashDepositFlag(flag, taskOutcomes) {
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">Cash Deposits</div>`;
        html += `<div class="red-flag-detail-section">`;
        html += `<div class="red-flag-detail-item">${flag.supporting_data || ''}</div>`;
        html += `<div class="red-flag-detail-item">${flag.threshold_amount || ''}</div>`;
        html += `</div>`;
        html += `</div>`;
        return html;
    }
    
    renderGenericFlag(flag) {
        let html = `<div class="red-flag-section">`;
        html += `<div class="red-flag-title">${flag.description || 'Flag'}</div>`;
        if (flag.supporting_data) html += `<div class="red-flag-detail-item">${flag.supporting_data}</div>`;
        if (flag.threshold_amount) html += `<div class="red-flag-detail-item">${flag.threshold_amount}</div>`;
        html += `</div>`;
        return html;
    }
    
    renderTasksSection(check) {
        const taskOutcomes = check.taskOutcomes || {};
        const isOpen = check.status === 'open' || check.status === 'processing' || check.status === 'pending';
        const isAborted = check.status === 'aborted';
        
        console.log('🎯 renderTasksSection called');
        console.log('  - Check status:', check.status);
        console.log('  - Check type:', check.checkType);
        console.log('  - taskOutcomes keys:', Object.keys(taskOutcomes));
        console.log('  - taskOutcomes:', taskOutcomes);
        console.log('  - thirdfortResponse?.request?.tasks:', check.thirdfortResponse?.request?.tasks);
        console.log('  - check.tasks:', check.tasks);
        
        // For open or aborted checks, show minimized task cards based on requested tasks
        if ((isOpen || isAborted) && Object.keys(taskOutcomes).length === 0) {
            // Get requested tasks from multiple possible locations
            let requestTasks = [];
            
            // Check thirdfortResponse.request.tasks first (most common)
            if (check.thirdfortResponse?.request?.tasks) {
                requestTasks = check.thirdfortResponse.request.tasks;
            }
            // Fallback to check.tasks array
            else if (check.tasks && Array.isArray(check.tasks)) {
                requestTasks = check.tasks;
            }
            // Check for reports in thirdfortResponse.request.reports
            else if (check.thirdfortResponse?.request?.reports) {
                requestTasks = check.thirdfortResponse.request.reports;
            }
            // Check for reports in thirdfortResponse.reports
            else if (check.thirdfortResponse?.reports) {
                requestTasks = check.thirdfortResponse.reports;
            }
            
            console.log('  - requestTasks from thirdfortResponse.request.tasks:', check.thirdfortResponse?.request?.tasks);
            console.log('  - requestTasks from check.tasks:', check.tasks);
            console.log('  - requestTasks from thirdfortResponse.request.reports:', check.thirdfortResponse?.request?.reports);
            console.log('  - requestTasks from thirdfortResponse.reports:', check.thirdfortResponse?.reports);
            console.log('  - Final requestTasks:', requestTasks);
            console.log('  - requestTasks.length:', requestTasks.length);
            
            if (requestTasks.length === 0) {
                console.log('  - No requestTasks found - showing empty tasks section');
                this.tasksSection.innerHTML = '';
                return;
            }
            
            const headerText = isAborted ? 'Requested Tasks (Cancelled)' : 'Requested Tasks (Processing)';
            let tasksHtml = `<div class="tasks-open-header">${headerText}</div>`;
            
            // Track unique task types (merge bank tasks)
            const displayedTasks = new Set();
            
            requestTasks.forEach(task => {
                const taskType = typeof task === 'string' ? task : task.type;
                // Convert task type to display format
                const displayType = this.normalizeTaskType(taskType);
                
                // Skip if already displayed (for bank tasks)
                if (displayedTasks.has(displayType)) {
                    return;
                }
                
                displayedTasks.add(displayType);
                tasksHtml += this.createOpenTaskCard(displayType, check.status);
            });
            
            this.tasksSection.innerHTML = tasksHtml;
            return;
        }
        
        // For closed checks or checks with outcomes
        if (Object.keys(taskOutcomes).length === 0) {
            console.log('❌ No taskOutcomes found - returning early');
            this.tasksSection.innerHTML = '';
            return;
        }
        
        console.log('✅ Processing taskOutcomes for closed check');
        
        // Convert screening:lite or peps to screening (combined PEP + Sanctions + Adverse Media for individuals)
        // For individual checks, PEP and Sanctions are combined into "Screening"
        if (taskOutcomes['screening:lite']) {
            taskOutcomes['screening'] = taskOutcomes['screening:lite'];
        } else if (taskOutcomes['peps'] && !taskOutcomes['company:peps']) {
            // If it's a standalone peps task (not company peps), rename to screening
            taskOutcomes['screening'] = taskOutcomes['peps'];
            delete taskOutcomes['peps'];
        }
        
        // Combine identity sub-tasks into identity.breakdown for electronic-id v2 checks
        if (taskOutcomes['identity']) {
            taskOutcomes['identity'].breakdown = taskOutcomes['identity'].breakdown || {};
            const breakdown = taskOutcomes['identity'].breakdown;
            
            // Move sub-tasks into identity breakdown (only if not already there)
            if (taskOutcomes['document'] && !breakdown.document) {
                breakdown.document = taskOutcomes['document'];
            }
            if (taskOutcomes['facial_similarity'] && !breakdown.facial_similarity) {
                breakdown.facial_similarity = taskOutcomes['facial_similarity'];
            }
            // Also handle facial_similarity_video (same as facial_similarity)
            if (taskOutcomes['facial_similarity_video'] && !breakdown.facial_similarity_video) {
                breakdown.facial_similarity_video = taskOutcomes['facial_similarity_video'];
            }
            if (taskOutcomes['nfc'] && !breakdown.nfc) {
                breakdown.nfc = taskOutcomes['nfc'];
            }
            if (taskOutcomes['biometrics'] && !breakdown.biometrics) {
                breakdown.biometrics = taskOutcomes['biometrics'];
            }
            if (taskOutcomes['liveness'] && !breakdown.liveness) {
                breakdown.liveness = taskOutcomes['liveness'];
            }
            
            // Delete top-level tasks after moving (they're now in breakdown)
            delete taskOutcomes['document'];
            delete taskOutcomes['facial_similarity'];
            delete taskOutcomes['facial_similarity_video'];
            delete taskOutcomes['nfc'];
            delete taskOutcomes['biometrics'];
            delete taskOutcomes['liveness'];
        }
        
        // Use footprint for address verification (skip separate address card)
        if (taskOutcomes['footprint']) {
            taskOutcomes['address'] = taskOutcomes['footprint'];
            delete taskOutcomes['footprint'];
        }
        
        // Get requested tasks and check for skipped tasks
        const requestTasks = check.thirdfortResponse?.request?.tasks || [];
        const requestedTaskTypes = new Set();
        requestTasks.forEach(task => {
            const taskType = typeof task === 'string' ? task : task.type;
            const normalizedType = this.normalizeTaskType(taskType);
            requestedTaskTypes.add(normalizedType);
        });
        
        // Add skipped task placeholders for requested tasks not in outcomes
        requestedTaskTypes.forEach(taskType => {
            // Skip bank tasks - they're handled specially
            if (taskType === 'bank') {
                if (!taskOutcomes['bank:summary'] && !taskOutcomes['bank:statement']) {
                    taskOutcomes[taskType] = {
                        result: 'fail',
                        status: 'skipped',
                        data: {},
                        documents: []
                    };
                }
            } else if (!taskOutcomes[taskType]) {
                // Task was requested but not completed - consumer skipped
                taskOutcomes[taskType] = {
                    result: 'fail',
                    status: 'skipped',
                    data: {},
                    documents: []
                };
            }
        });
        
        let tasksHtml = '';
        
        // Define task order
        const taskOrder = [
            'address', 'screening', 'peps', 'sanctions',
            'identity', 'identity:lite',
            'sof:v1', 'bank', // Combined bank task
            'documents:poa', 'documents:poo', 'documents:savings', 'documents:cryptocurrency', 'documents:other',
            'company:summary', 'company:sanctions', 'company:peps', 
            'company:ubo', 'company:beneficial-check', 'company:shareholders'
        ];
        
        taskOrder.forEach(taskKey => {
            // Special handling for bank task - combines bank:summary, bank:statement, or documents:bank-statement
            if (taskKey === 'bank') {
                let bankSummary = taskOutcomes['bank:summary'];
                let bankStatement = taskOutcomes['bank:statement'];
                const docsBankStatement = taskOutcomes['documents:bank-statement'];
                const sofTask = taskOutcomes['sof:v1']; // Get SoF data for linking
                
                // If bank:summary and bank:statement are rejected/unavailable, check for documents:bank-statement
                // (consumer uploaded PDFs instead of linking)
                if (docsBankStatement && docsBankStatement.breakdown?.accounts) {
                    // Use documents:bank-statement data if available
                    if (!bankStatement || bankStatement.status === 'rejected' || bankStatement.status === 'skipped') {
                        bankStatement = docsBankStatement;
                    }
                }
                
                if (bankSummary || bankStatement) {
                    tasksHtml += this.createBankTaskCard(bankSummary, bankStatement, sofTask, check);
                }
            } else if (taskOutcomes[taskKey]) {
                tasksHtml += this.createTaskCard(taskKey, taskOutcomes[taskKey], check);
            }
        });
        
        this.tasksSection.innerHTML = tasksHtml;
    }
    
    normalizeTaskType(taskType) {
        // Convert API task types to our internal format
        const typeMap = {
            'report:identity': 'identity',
            'report:footprint': 'address',
            'report:peps': 'screening',
            'report:sanctions': 'sanctions',
            'report:screening:lite': 'screening',
            'report:sof-v1': 'sof:v1',
            'report:bank-statement': 'bank',  // Both bank tasks map to 'bank'
            'report:bank-summary': 'bank'      // Merged into single card
        };
        
        return typeMap[taskType] || taskType;
    }
    
    createOpenTaskCard(taskType, checkStatus) {
        const taskTitle = this.getTaskTitle(taskType);
        const isAborted = checkStatus === 'aborted';
        
        // Only show "Task in progress" for open/processing checks, not aborted
        const summaryText = isAborted ? '' : '<div class="task-summary-inline">Task in progress</div>';
        
        return `
            <div class="task-card open-task non-expandable">
                <div class="task-header">
                    <div class="task-title">${taskTitle}</div>
                    <svg class="task-status-icon" viewBox="0 0 300 300">
                        <path fill="#999" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/>
                        <circle cx="150" cy="150" r="30" fill="#fff"/>
                    </svg>
                </div>
                ${summaryText}
            </div>
        `;
    }
    
    renderChainColumn(chain, flag) {
        let html = `<div class="chain-column">`;
        html += this.renderChainColumnContent(chain, flag);
        html += `</div>`;
        return html;
    }
    
    renderChainColumnContent(chain, flag) {
        // Renders just the content of a chain column (for use in overlay with controls)
        let html = '';
        
        // Step 1: Source income (if exists)
        if (chain.source) {
            const sourceDate = new Date(chain.source.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const sourceAmount = Math.abs(chain.source.amount).toFixed(2);
            
            html += `
                <div class="chain-card">
                    <span class="chain-card-date">${sourceDate}</span>
                    <span class="chain-card-desc">${chain.source.description || chain.source.merchant_name || 'Income'}</span>
                    <span class="chain-card-account">${chain.source.accountName}</span>
                    <span class="chain-card-amount positive">+${flag}${sourceAmount}</span>
                </div>
                <div class="chain-connector">↓</div>
            `;
        }
        
        // Step 2: Transfer out / Payment
        const outDate = new Date(chain.out.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        const outAmount = Math.abs(chain.out.amount).toFixed(2);
        
        html += `
            <div class="chain-card">
                <span class="chain-card-date">${outDate}</span>
                <span class="chain-card-desc">${chain.out.description || chain.out.merchant_name || 'Payment'}</span>
                <span class="chain-card-account">${chain.out.accountName}</span>
                <span class="chain-card-amount negative">${flag}${outAmount}</span>
            </div>
        `;
        
        // Step 3: Transfer in (if cross-account)
        if (chain.in) {
            const inDate = new Date(chain.in.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const inAmount = Math.abs(chain.in.amount).toFixed(2);
            
            html += `
                <div class="chain-connector">↓</div>
                <div class="chain-card">
                    <span class="chain-card-date">${inDate}</span>
                    <span class="chain-card-desc">${chain.in.description || chain.in.merchant_name || 'Transfer'}</span>
                    <span class="chain-card-account">${chain.in.accountName}</span>
                    <span class="chain-card-amount positive">+${flag}${inAmount}</span>
                </div>
            `;
        }
        
        // Step 4: Subsequent payment (if exists)
        if (chain.payment) {
            const paymentDate = new Date(chain.payment.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            const paymentAmount = Math.abs(chain.payment.amount).toFixed(2);
            
            html += `
                <div class="chain-connector">↓</div>
                <div class="chain-card">
                    <span class="chain-card-date">${paymentDate}</span>
                    <span class="chain-card-desc">${chain.payment.description || chain.payment.merchant_name || 'Payment'}</span>
                    <span class="chain-card-account">${chain.payment.accountName}</span>
                    <span class="chain-card-amount negative">${flag}${paymentAmount}</span>
                </div>
            `;
        }
        
        return html;
    }
    
    createBankAnalysisSections(analysis, accounts = {}, sofTask = null, check = null) {
        // Create analysis sections: repeating transactions, large one-offs, SoF matches
        if (!analysis) return '';
        
        let html = '';
        
        // Extract SoF funding details for linking
        const sofFunds = sofTask?.breakdown?.funds || [];
        
        // Get bank analysis flags from sofAnnotations
        const sofAnnotations = check?.sofAnnotations || [];
        
        // Helper to generate unique chain ID from transaction IDs
        const getChainId = (chain) => {
            const ids = [];
            if (chain.source) ids.push(chain.source.id);
            ids.push(chain.out.id);
            if (chain.in) ids.push(chain.in.id);
            if (chain.payment) ids.push(chain.payment.id);
            return ids.join('|'); // Use pipe separator to create unique ID
        };
        
        // Helper to get existing flags/comments for items from sofAnnotations
        const getItemAnnotation = (itemType, itemKey) => {
            for (const ann of sofAnnotations) {
                const items = ann.notes?.bankAnalysisItems || [];
                const found = items.find(item => {
                    if (itemType === 'repeating-group' && item.type === 'repeating-group') {
                        return item.groupIndex === itemKey;
                    } else if (itemType === 'chain' && item.type === 'chain') {
                        return item.chainId === itemKey; // Use chainId for consistency
                    } else if (itemType === 'transaction' && item.type === 'transaction') {
                        return item.transactionId === itemKey;
                    }
                    return false;
                });
                if (found) {
                    // Return the found item along with user info and timestamp from the annotation
                    return { 
                        flag: found.flag, 
                        comment: found.comment, 
                        linkedToFundIdx: found.linkedToFundIdx,
                        userName: ann.userName || ann.user,
                        timestamp: ann.timestamp
                    };
                }
            }
            return null;
        };
        
        // Helper to get transaction details from ID
        const getTransactionById = (txId) => {
            for (const [accountId, accountData] of Object.entries(accounts)) {
                const statement = accountData.statement || [];
                const tx = statement.find(t => t.id === txId);
                if (tx) {
                    const accountInfo = accountData.info || accountData;
                    return { ...tx, accountName: accountInfo.name || 'Account', accountId };
                }
            }
            return null;
        };
        
        // 1. Repeating Transactions Section
        if (analysis.repeating_transactions && analysis.repeating_transactions.length > 0) {
            let repeatingHtml = '';
            
            analysis.repeating_transactions.forEach((group, index) => {
                const amount = group.sort_score;
                const frequency = group.items.length;
                const currencySymbol = this.getCurrencyFlag('GBP');
                
                // Get all transaction details
                const transactions = group.items.map(id => getTransactionById(id)).filter(tx => tx);
                if (transactions.length === 0) return;
                
                // Separate into incoming and outgoing
                const incomingTxs = transactions.filter(tx => tx.amount > 0);
                const outgoingTxs = transactions.filter(tx => tx.amount < 0);
                
                // Apply chain detection
                const matched = [];
                const chains = [];
                
                // Pass 1: Exact cross-account transfers (same day)
                outgoingTxs.forEach(outTx => {
                    if (matched.includes(outTx.id)) return;
                    const outDate = new Date(outTx.timestamp);
                    
                    const match = incomingTxs.find(inTx => {
                        if (matched.includes(inTx.id)) return false;
                        const inDate = new Date(inTx.timestamp);
                        return inDate.toDateString() === outDate.toDateString() && 
                               inTx.account_id !== outTx.account_id;
                    });
                    
                    if (match) {
                        matched.push(match.id);
                        matched.push(outTx.id);
                        chains.push({ out: outTx, in: match });
                    }
                });
                
                // Pass 2: Same-account flows
                outgoingTxs.forEach(outTx => {
                    if (matched.includes(outTx.id)) return;
                    const outDate = new Date(outTx.timestamp);
                    
                    const match = incomingTxs.find(inTx => {
                        if (matched.includes(inTx.id)) return false;
                        const inDate = new Date(inTx.timestamp);
                        const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                        
                        return inTx.account_id === outTx.account_id && 
                               daysDiff >= 0 && daysDiff <= 3;
                    });
                    
                    if (match) {
                        matched.push(match.id);
                        matched.push(outTx.id);
                        chains.push({ source: match, out: outTx, in: null });
                    }
                });
                
                // Build chains HTML (2 per row)
                let chainsHtml = '';
                for (let i = 0; i < chains.length; i += 2) {
                    const chain1 = chains[i];
                    const chain2 = chains[i + 1];
                    
                    chainsHtml += `<div class="chains-row">`;
                    if (chain1) chainsHtml += this.renderChainColumn(chain1, currencySymbol);
                    if (chain2) chainsHtml += this.renderChainColumn(chain2, currencySymbol);
                    chainsHtml += `</div>`;
                }
                
                // Build unmatched transactions in columns
                const unmatchedIn = incomingTxs.filter(tx => !matched.includes(tx.id));
                const unmatchedOut = outgoingTxs.filter(tx => !matched.includes(tx.id));
                
                let incomingHtml = '';
                unmatchedIn.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    
                    // Get comprehensive annotations for this transaction
                    const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                    
                    // Build badges
                    let badgesHtml = '';
                    
                    // Marker badges
                    if (txAnnotations.marker === 'accepted') {
                        badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (txAnnotations.marker === 'rejected') {
                        badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Flag badges
                    if (txAnnotations.flag === 'cleared') {
                        badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (txAnnotations.flag === 'suspicious') {
                        badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (txAnnotations.flag === 'review') {
                        badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                    } else if (txAnnotations.flag === 'linked') {
                        badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // User note badge
                    if (txAnnotations.note) {
                        badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                    }
                    
                    incomingHtml += `
                        <div class="transaction-row incoming">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}${badgesHtml}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount positive">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                let outgoingHtml = '';
                unmatchedOut.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    
                    // Get comprehensive annotations for this transaction
                    const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                    
                    // Build badges
                    let badgesHtml = '';
                    
                    // Marker badges
                    if (txAnnotations.marker === 'accepted') {
                        badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (txAnnotations.marker === 'rejected') {
                        badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Flag badges
                    if (txAnnotations.flag === 'cleared') {
                        badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (txAnnotations.flag === 'suspicious') {
                        badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (txAnnotations.flag === 'review') {
                        badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                    } else if (txAnnotations.flag === 'linked') {
                        badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // User note badge
                    if (txAnnotations.note) {
                        badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                    }
                    
                    outgoingHtml += `
                        <div class="transaction-row outgoing">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}${badgesHtml}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount negative">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                // Build columns section
                let columnsHtml = '';
                const hasIncoming = incomingHtml.trim().length > 0;
                const hasOutgoing = outgoingHtml.trim().length > 0;
                
                if (hasIncoming || hasOutgoing) {
                    if (hasIncoming && hasOutgoing) {
                        columnsHtml = `
                            <div class="transactions-columns">
                                <div class="transactions-column">
                                    <div class="column-header incoming-header">Incoming</div>
                                    ${incomingHtml}
                                </div>
                                <div class="transactions-column">
                                    <div class="column-header outgoing-header">Outgoing</div>
                                    ${outgoingHtml}
                                </div>
                            </div>
                        `;
                    } else if (hasIncoming) {
                        columnsHtml = `
                            <div class="transactions-columns single-column">
                                <div class="transactions-column">
                                    <div class="column-header incoming-header">Incoming</div>
                                    ${incomingHtml}
                                </div>
                            </div>
                        `;
                    } else {
                        columnsHtml = `
                            <div class="transactions-columns single-column">
                                <div class="transactions-column">
                                    <div class="column-header outgoing-header">Outgoing</div>
                                    ${outgoingHtml}
                                </div>
                            </div>
                        `;
                    }
                }
                
                const accountsSet = [...new Set(transactions.map(tx => tx.accountName))];
                
                // Check for flags on this repeating group
                const groupAnnotation = getItemAnnotation('repeating-group', index);
                let groupBadge = '';
                let annotationBar = '';
                
                if (groupAnnotation && groupAnnotation.flag) {
                    if (groupAnnotation.flag === 'cleared') {
                        groupBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50; margin-left: 8px;">✓ Cleared</span>';
                    } else if (groupAnnotation.flag === 'suspicious') {
                        groupBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336; margin-left: 8px;">✗ Suspicious</span>';
                    } else if (groupAnnotation.flag === 'review') {
                        groupBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; margin-left: 8px;">— Review</span>';
                    }
                }
                
                // Build annotation bar with new format if annotation exists
                if (groupAnnotation && (groupAnnotation.userName || groupAnnotation.timestamp)) {
                    const date = new Date(groupAnnotation.timestamp).toLocaleString('en-GB', { 
                        day: '2-digit', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    let userName = groupAnnotation.userName || groupAnnotation.user || 'Unknown';
                    // Format user name
                    if (userName && userName.includes('.') && !userName.includes(' ')) {
                        userName = userName.split('@')[0]
                            .split('.').join(' ')
                            .split('-').join(' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                    }
                    
                    // Get linked funding method info
                    let fundingBadge = '';
                    if (groupAnnotation.linkedToFundIdx) {
                        const fundIdx = parseInt(groupAnnotation.linkedToFundIdx);
                        const fund = sofTask?.breakdown?.funds?.[fundIdx];
                        if (fund) {
                            const fundType = fund.type || '';
                            const fundLabel = fundType.replace('fund:', '').replace(/[-:_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            fundingBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-right: 4px;">${fundLabel}</span>`;
                        }
                    }
                    
                    // Get status badge
                    let statusBadge = '';
                    if (groupAnnotation.flag === 'cleared') {
                        statusBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50;">Cleared</span>';
                    } else if (groupAnnotation.flag === 'suspicious') {
                        statusBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336;">Suspicious</span>';
                    } else if (groupAnnotation.flag === 'review') {
                        statusBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800;">Review</span>';
                    }
                    
                    annotationBar = `
                        <div class="bank-analysis-link-row" style="border-left: 4px solid #2196f3; padding: 6px 10px; margin: 6px 0; background: #f5f5f5; border-radius: 3px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                <div style="flex: 1; min-width: 150px; font-size: 11px;">
                                    <strong>${userName}</strong> • ${date}
                                </div>
                                <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                                    ${fundingBadge}
                                    ${statusBadge}
                                </div>
                            </div>
                            ${groupAnnotation.comment ? `
                                <div style="margin-top: 4px; color: #666; font-size: 11px; font-style: italic;">
                                    ${groupAnnotation.comment}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }
                
                repeatingHtml += `
                    <div class="analysis-item-card">
                        <div class="analysis-card-header">
                            <div class="analysis-card-title">
                                ${currencySymbol}${Math.abs(amount).toFixed(2)} × ${frequency}
                                ${groupBadge}
                            </div>
                            <div class="analysis-card-meta">
                                ${accountsSet.length > 1 ? `Between: ${accountsSet.join(' ↔ ')}` : `Account: ${accountsSet[0]}`}
                            </div>
                        </div>
                        ${annotationBar}
                        ${chainsHtml ? `
                            <div class="internal-transfers-label">Linked Transactions</div>
                            ${chainsHtml}
                        ` : ''}
                        ${columnsHtml}
                    </div>
                `;
            });
            
            html += `
                <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                    <div class="analysis-section-header">
                        <span class="analysis-section-title">Repeating Transactions (${analysis.repeating_transactions.length} patterns)</span>
                        <span class="expand-indicator">▼</span>
                    </div>
                    <div class="analysis-section-content">
                        ${repeatingHtml}
                    </div>
                </div>
            `;
        }
        
        // 2. Large One-off Transactions Section
        if (analysis.large_one_off_transactions && analysis.large_one_off_transactions.length > 0) {
            // Get all large one-off transactions
            const oneOffTxs = analysis.large_one_off_transactions
                .map(txId => getTransactionById(txId))
                .filter(tx => tx);
            
            // Separate into incoming and outgoing
            const oneOffIn = oneOffTxs.filter(tx => tx.amount > 0);
            const oneOffOut = oneOffTxs.filter(tx => tx.amount < 0);
            
            // Apply same three-pass chain detection logic
            const matched = [];
            const transferPairs = [];
            const chains = [];
            
            // First pass: Exact cross-account transfers
            oneOffOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = oneOffIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    
                    return Math.abs(inAmount - outAmount) < 0.01 && 
                           inTx.account_id !== outTx.account_id && 
                           inDate.toDateString() === outDate.toDateString();
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transferPairs.push({ out: outTx, in: match });
                }
            });
            
            // Second pass: Same-account flows
            oneOffOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = oneOffIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return inTx.account_id === outTx.account_id && 
                           daysDiff >= 0 && daysDiff <= 3 &&
                           inAmount >= outAmount &&
                           (inAmount - outAmount) <= Math.max(500, inAmount * 0.2);
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    chains.push({ 
                        source: match, 
                        out: outTx, 
                        in: null
                    });
                }
            });
            
            // Third pass: Extend transfer pairs with preceding income / subsequent payment
            const extendedChains = [];
            transferPairs.forEach(pair => {
                const candidateIncomes = oneOffIn.filter(precedingTx => {
                    if (matched.includes(precedingTx.id)) return false;
                    const precedingDate = new Date(precedingTx.timestamp);
                    const outDate = new Date(pair.out.timestamp);
                    const daysDiff = (outDate - precedingDate) / (1000 * 60 * 60 * 24);
                    
                    return precedingTx.account_id === pair.out.account_id && 
                           daysDiff >= 0 && daysDiff <= 3;
                });
                
                const precedingIncome = candidateIncomes.length > 0
                    ? candidateIncomes.reduce((largest, tx) => 
                        Math.abs(tx.amount) > Math.abs(largest.amount) ? tx : largest
                      )
                    : null;
                
                const subsequentPayment = oneOffOut.find(paymentTx => {
                    if (matched.includes(paymentTx.id)) return false;
                    const paymentDate = new Date(paymentTx.timestamp);
                    const inDate = new Date(pair.in.timestamp);
                    const daysDiff = (paymentDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return paymentTx.account_id === pair.in.account_id && 
                           daysDiff >= 0 && daysDiff <= 2;
                });
                
                if (precedingIncome || subsequentPayment) {
                    if (precedingIncome) matched.push(precedingIncome.id);
                    if (subsequentPayment) matched.push(subsequentPayment.id);
                    
                    extendedChains.push({
                        source: precedingIncome,
                        out: pair.out,
                        in: pair.in,
                        payment: subsequentPayment
                    });
                    pair.extended = true;
                }
            });
            
            // Combine all chains (extended first, then basic chains, then unextended pairs)
            const allOneOffChains = [...extendedChains, ...chains, ...transferPairs.filter(p => !p.extended)];
            
            // Build chains HTML (2 per row)
            let chainsHtml = '';
            for (let i = 0; i < allOneOffChains.length; i += 2) {
                const chain1 = allOneOffChains[i];
                const chain2 = allOneOffChains[i + 1];
                const flag = this.getCurrencyFlag((chain1.source?.currency || chain1.out.currency) || 'GBP');
                
                chainsHtml += `<div class="chains-row">`;
                
                // Left column - Chain 1
                chainsHtml += this.renderChainColumn(chain1, flag);
                
                // Right column - Chain 2 (if exists)
                if (chain2) {
                    const flag2 = this.getCurrencyFlag((chain2.source?.currency || chain2.out.currency) || 'GBP');
                    chainsHtml += this.renderChainColumn(chain2, flag2);
                }
                
                chainsHtml += `</div>`;
            }
            
            // Build unmatched transactions in columns
            const unmatchedIn = oneOffIn.filter(tx => !matched.includes(tx.id));
            const unmatchedOut = oneOffOut.filter(tx => !matched.includes(tx.id));
            
            let incomingHtml = '';
            unmatchedIn.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const flag = this.getCurrencyFlag(tx.currency || 'GBP');
                
                incomingHtml += `
                    <div class="transaction-row incoming">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                        <span class="account-badge">${tx.accountName}</span>
                        <span class="transaction-amount positive">${flag}${Math.abs(tx.amount).toFixed(2)}</span>
                    </div>
                `;
            });
            
            let outgoingHtml = '';
            unmatchedOut.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const flag = this.getCurrencyFlag(tx.currency || 'GBP');
                
                outgoingHtml += `
                    <div class="transaction-row outgoing">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                        <span class="account-badge">${tx.accountName}</span>
                        <span class="transaction-amount negative">${flag}${Math.abs(tx.amount).toFixed(2)}</span>
                    </div>
                `;
            });
            
            // Build columns section
            let columnsHtml = '';
            const hasIncoming = incomingHtml.trim().length > 0;
            const hasOutgoing = outgoingHtml.trim().length > 0;
            
            if (hasIncoming || hasOutgoing) {
                if (hasIncoming && hasOutgoing) {
                    columnsHtml = `
                        <div class="transactions-columns">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                } else if (hasIncoming) {
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                        </div>
                    `;
                } else {
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                }
            }
            
            html += `
                <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                    <div class="analysis-section-header">
                        <span class="analysis-section-title">Large One-off Transactions (${analysis.large_one_off_transactions.length})</span>
                        <span class="expand-indicator">▼</span>
                    </div>
                    <div class="analysis-section-content">
                        ${chainsHtml ? `
                            <div class="internal-transfers-label">Linked Transactions</div>
                            ${chainsHtml}
                        ` : ''}
                        ${columnsHtml}
                    </div>
                </div>
            `;
        }
        
        // 3. SoF Matches Section
        if (analysis.sof_matches && Object.keys(analysis.sof_matches).length > 0) {
            let sofMatchesHtml = '';
            
            // Build a map of funding types to their transaction IDs (auto + user-linked)
            const allSofMatches = {};
            
            // Start with Thirdfort automatic matches
            for (const [sofType, txIds] of Object.entries(analysis.sof_matches)) {
                allSofMatches[sofType] = {
                    autoMatched: new Set(txIds),
                    userLinked: new Set()
                };
            }
            
            // Add user-linked transactions from SOF annotations (direct links AND bank analysis items)
            if (check) {
                const sofAnnotations = check.sofAnnotations || [];
                sofAnnotations.forEach(ann => {
                    // Direct transaction links
                    const transactions = ann.notes?.transactions || [];
                    transactions.forEach(tx => {
                        if (tx.linkedToFunds && tx.linkedToFunds.length > 0) {
                            tx.linkedToFunds.forEach(fundIdxStr => {
                                const fundIdx = parseInt(fundIdxStr);
                                const fund = sofFunds[fundIdx];
                                if (fund) {
                                    const fundTypeMap = {
                                        'fund:gift': 'gift',
                                        'fund:mortgage': 'mortgage',
                                        'fund:savings': 'savings',
                                        'fund:property_sale': 'property_sale',
                                        'fund:sale:property': 'property_sale',
                                        'fund:asset_sale': 'asset_sale',
                                        'fund:sale:assets': 'asset_sale',
                                        'fund:htb_lisa': 'htb_lisa',
                                        'fund:htb': 'htb_lisa',
                                        'fund:inheritance': 'inheritance'
                                    };
                                    const sofType = fundTypeMap[fund.type];
                                    if (sofType) {
                                        if (!allSofMatches[sofType]) {
                                            allSofMatches[sofType] = {
                                                autoMatched: new Set(),
                                                userLinked: new Set()
                                            };
                                        }
                                        allSofMatches[sofType].userLinked.add(tx.txId);
                                    }
                                }
                            });
                        }
                    });
                    
                    // Bank analysis items linked to funding methods
                    const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                    bankAnalysisItems.forEach(item => {
                        if (item.linkedToFundIdx) {
                            const fundIdx = parseInt(item.linkedToFundIdx);
                            const fund = sofFunds[fundIdx];
                            if (fund) {
                                const fundTypeMap = {
                                    'fund:gift': 'gift',
                                    'fund:mortgage': 'mortgage',
                                    'fund:savings': 'savings',
                                    'fund:property_sale': 'property_sale',
                                    'fund:sale:property': 'property_sale',
                                    'fund:asset_sale': 'asset_sale',
                                    'fund:sale:assets': 'asset_sale',
                                    'fund:htb_lisa': 'htb_lisa',
                                    'fund:htb': 'htb_lisa',
                                    'fund:inheritance': 'inheritance'
                                };
                                const sofType = fundTypeMap[fund.type];
                                if (sofType) {
                                    if (!allSofMatches[sofType]) {
                                        allSofMatches[sofType] = {
                                            autoMatched: new Set(),
                                            userLinked: new Set()
                                        };
                                    }
                                    
                                    // Add all transactions from this bank analysis item
                                    if (item.type === 'transaction' && item.transactionId) {
                                        allSofMatches[sofType].userLinked.add(item.transactionId);
                                    } else if (item.type === 'chain' && item.chainId) {
                                        const chainTxIds = item.chainId.split('|');
                                        chainTxIds.forEach(txId => allSofMatches[sofType].userLinked.add(txId));
                                    } else if (item.type === 'repeating-group' && item.groupIndex !== undefined) {
                                        if (analysis.repeating_transactions) {
                                            const group = analysis.repeating_transactions[item.groupIndex];
                                            if (group && group.items) {
                                                group.items.forEach(txId => allSofMatches[sofType].userLinked.add(txId));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    });
                });
            }
            
            for (const [sofType, matchSets] of Object.entries(allSofMatches)) {
                const sofLabels = {
                    'gift': 'Gift Funding',
                    'mortgage': 'Mortgage',
                    'savings': 'Savings',
                    'property_sale': 'Property Sale',
                    'asset_sale': 'Asset Sale',
                    'htb_lisa': 'Help to Buy / LISA',
                    'inheritance': 'Inheritance'
                };
                
                const label = sofLabels[sofType] || sofType;
                
                // Find matching funding method in SoF task
                const matchingFund = sofFunds.find(fund => {
                    const fundTypeMap = {
                        'fund:gift': 'gift',
                        'fund:mortgage': 'mortgage',
                        'fund:savings': 'savings',
                        'fund:property_sale': 'property_sale',
                        'fund:sale:property': 'property_sale',
                        'fund:asset_sale': 'asset_sale',
                        'fund:sale:assets': 'asset_sale',
                        'fund:htb_lisa': 'htb_lisa',
                        'fund:htb': 'htb_lisa',
                        'fund:inheritance': 'inheritance'
                    };
                    return fundTypeMap[fund.type] === sofType;
                });
                
                // Build funding details card
                let fundDetailsHtml = '';
                if (matchingFund) {
                    const fundData = matchingFund.data || {};
                    const fundAmount = fundData.amount ? `£${(fundData.amount / 100).toLocaleString()}` : '';
                    
                    let detailsContent = '';
                    
                    // Gift details
                    if (matchingFund.type === 'fund:gift') {
                        if (fundData.giftor) {
                            if (fundData.giftor.name) {
                                detailsContent += `<div class="sof-fund-detail"><strong>Giftor:</strong> ${fundData.giftor.name}</div>`;
                            }
                            if (fundData.giftor.relationship) {
                                detailsContent += `<div class="sof-fund-detail"><strong>Relationship:</strong> ${fundData.giftor.relationship}</div>`;
                            }
                            if (fundData.giftor.phone) {
                                detailsContent += `<div class="sof-fund-detail"><strong>Phone:</strong> ${fundData.giftor.phone}</div>`;
                            }
                            if (typeof fundData.giftor.contactable !== 'undefined') {
                                detailsContent += `<div class="sof-fund-detail"><strong>Contactable:</strong> ${fundData.giftor.contactable ? 'Yes' : 'No'}</div>`;
                            }
                        }
                        if (typeof fundData.repayable !== 'undefined') {
                            detailsContent += `<div class="sof-fund-detail"><strong>Repayable:</strong> ${fundData.repayable ? 'Yes' : 'No'}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = matchingFund.documents && matchingFund.documents.length > 0;
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // Property sale details
                    if (matchingFund.type === 'fund:sale:property') {
                        if (fundData.date) {
                            const saleDate = new Date(fundData.date).toLocaleDateString('en-GB');
                            detailsContent += `<div class="sof-fund-detail"><strong>Sale Date:</strong> ${saleDate}</div>`;
                        }
                        if (fundData.status) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Status:</strong> ${fundData.status}</div>`;
                        }
                        if (fundData.lawyer) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Lawyer:</strong> ${fundData.lawyer}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:sale-property'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // Asset sale details
                    if (matchingFund.type === 'fund:sale:assets') {
                        if (fundData.description) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Asset:</strong> ${fundData.description}</div>`;
                        }
                        if (fundData.date) {
                            const saleDate = new Date(fundData.date).toLocaleDateString('en-GB');
                            detailsContent += `<div class="sof-fund-detail"><strong>Sale Date:</strong> ${saleDate}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:sale-assets'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // Savings details
                    if (matchingFund.type === 'fund:savings') {
                        if (fundData.people && fundData.people.length > 0) {
                            detailsContent += `<div class="people-grid people-grid-${fundData.people.length}">`;
                            
                            fundData.people.forEach(person => {
                                if (person.name) {
                                    const isActor = person.actor ? 'Primary' : 'Joint';
                                    const employmentStatus = person.employment_status === 'independent' ? 'Self-employed' : 
                                                            person.employment_status ? person.employment_status.charAt(0).toUpperCase() + person.employment_status.slice(1) : '';
                                    
                                    detailsContent += `<div class="person-card">`;
                                    detailsContent += `<div class="person-card-name">${person.name}</div>`;
                                    detailsContent += `<div class="person-card-role">${isActor}</div>`;
                                    if (employmentStatus) {
                                        detailsContent += `<div class="person-card-item">${employmentStatus}</div>`;
                                    }
                                    if (person.incomes && person.incomes.length > 0) {
                                        person.incomes.forEach(income => {
                                            detailsContent += `<div class="person-card-item">Income: ${income.source || 'N/A'}</div>`;
                                            detailsContent += `<div class="person-card-item">Frequency: ${income.frequency || 'N/A'}</div>`;
                                            if (income.reference) {
                                                detailsContent += `<div class="person-card-item">Payslip Ref: ${income.reference}</div>`;
                                            }
                                        });
                                    }
                                    detailsContent += `</div>`;
                                }
                            });
                            
                            detailsContent += `</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:savings'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // Mortgage details
                    if (matchingFund.type === 'fund:mortgage') {
                        if (fundData.lender) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Lender:</strong> ${fundData.lender}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:mortgage'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // HTB/LISA details
                    if (matchingFund.type === 'fund:htb') {
                        if (fundData.provider) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Provider:</strong> ${fundData.provider}</div>`;
                        }
                        if (typeof fundData.is_owner !== 'undefined') {
                            detailsContent += `<div class="sof-fund-detail"><strong>Beneficiary:</strong> ${fundData.is_owner ? 'Primary' : 'Secondary'}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:htb'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    // Inheritance details
                    if (matchingFund.type === 'fund:inheritance') {
                        if (fundData.deceased) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Deceased:</strong> ${fundData.deceased}</div>`;
                        }
                        if (fundData.date_of_death) {
                            const deathDate = new Date(fundData.date_of_death).toLocaleDateString('en-GB');
                            detailsContent += `<div class="sof-fund-detail"><strong>Date of Death:</strong> ${deathDate}</div>`;
                        }
                        if (fundData.relationship) {
                            detailsContent += `<div class="sof-fund-detail"><strong>Relationship:</strong> ${fundData.relationship}</div>`;
                        }
                        
                        // Document status
                        const hasDoc = check.taskOutcomes?.['documents:inheritance'];
                        const docIcon = hasDoc ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Check the report pdf for evidence or obtain from the client and review manually';
                        detailsContent += `
                            <div class="sof-fund-detail" style="margin-top: 8px; display: flex; align-items: center; gap: 6px;">
                                ${docIcon}
                                <span style="font-size: 11px;">${docText}</span>
                            </div>
                        `;
                    }
                    
                    if (fundAmount || detailsContent) {
                        fundDetailsHtml = `
                            <div class="sof-fund-details-card">
                                ${fundAmount ? `<div class="sof-fund-amount">${fundAmount}</div>` : ''}
                                ${detailsContent}
                            </div>
                        `;
                    }
                }
                
                // Get transaction markers from SOF annotations for this funding type
                const sofAnnotations = check?.sofAnnotations || [];
                const transactionMarkers = {};
                const fundIndex = sofFunds.findIndex(f => f === matchingFund);
                sofAnnotations.forEach(ann => {
                    const fundingMethods = ann.notes?.fundingMethods || [];
                    fundingMethods.forEach(fm => {
                        if (fm.fundIdx === fundIndex.toString()) {
                            Object.assign(transactionMarkers, fm.transactionMarkers || {});
                        }
                    });
                });
                
                // Merge auto-matched and user-linked transactions
                const allTxIds = [...matchSets.autoMatched, ...matchSets.userLinked];
                
                let txListHtml = '';
                allTxIds.forEach(txId => {
                    const tx = getTransactionById(txId);
                    if (!tx) return;
                    
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const amount = tx.amount;
                    const amountClass = amount >= 0 ? 'positive' : 'negative';
                    const sign = amount >= 0 ? '+' : '';
                    const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
                    
                    // Get comprehensive annotations for this transaction
                    const txAnnotations = this.getTransactionAnnotations(txId, check);
                    
                    // Check if this transaction has a marker
                    const marker = txAnnotations.marker;
                    let markerBadge = '';
                    let markerClass = '';
                    if (marker === 'accepted') {
                        markerBadge = '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (marker === 'rejected') {
                        markerBadge = '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                        markerClass = ' marked-rejected';
                    }
                    
                    // Check if this transaction has a flag (from bank analysis or direct links)
                    const flag = txAnnotations.flag;
                    let flagBadge = '';
                    if (flag === 'cleared') {
                        flagBadge = '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (flag === 'suspicious') {
                        flagBadge = '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (flag === 'review') {
                        flagBadge = '<span class="tx-marker-badge review">— Review</span>';
                    } else if (flag === 'linked') {
                        flagBadge = '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // Add source badge
                    const isAutoMatched = matchSets.autoMatched.has(txId);
                    const isUserLinked = matchSets.userLinked.has(txId);
                    let sourceBadge = '';
                    if (isUserLinked && !isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge user-linked">👤 User Linked</span>';
                    } else if (isUserLinked && isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge both-matched">✓ Confirmed</span>';
                    }
                    
                    // Check if this transaction is part of a repeating group
                    let repeatingBadge = '';
                    let userNoteBadge = '';
                    if (analysis && analysis.repeating_transactions) {
                        for (const group of analysis.repeating_transactions) {
                            if (group.items && group.items.includes(txId)) {
                                repeatingBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f3e5f5; color: #9c27b0; border: 1px solid #9c27b0; margin-left: 4px;">Repeating</span>';
                                break;
                            }
                        }
                    }
                    
                    // Get transaction note and create user note badge
                    const txNote = txAnnotations.note || '';
                    if (txNote) {
                        userNoteBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txNote}</span>`;
                    }
                    
                    txListHtml += `
                        <div class="sof-match-tx-row${markerClass}">
                            <span class="sof-match-date">${date}</span>
                            <span class="sof-match-desc">${tx.description || tx.merchant_name || 'Transaction'}${markerBadge}${flagBadge}${sourceBadge}${repeatingBadge}${userNoteBadge}</span>
                            <span class="sof-match-account">${tx.accountName}</span>
                            <span class="sof-match-amount ${amountClass}">${sign}${currencySymbol}${Math.abs(amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                if (txListHtml) {
                    sofMatchesHtml += `
                        <div class="sof-match-group">
                            <div class="sof-match-label">${label}</div>
                            ${fundDetailsHtml}
                            ${txListHtml}
                        </div>
                    `;
                }
            }
            
            if (sofMatchesHtml) {
                html += `
                    <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                        <div class="analysis-section-header">
                            <span class="analysis-section-title">Potential SoF Matches</span>
                            <span class="expand-indicator">▼</span>
                        </div>
                        <div class="analysis-section-content">
                            ${sofMatchesHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        // 4. Flagged/Commented/Linked Transactions Summary Section
        // Only show transactions where the USER has taken action (flag, comment, marker, or link)
        if (check) {
            const sofAnnotations = check.sofAnnotations || [];
            const userInteractedTxIds = new Set();
            
            // Collect only transactions where USER has added flags, comments, links, or markers
            sofAnnotations.forEach(ann => {
                // Direct transaction annotations (always user-created)
                const transactions = ann.notes?.transactions || [];
                transactions.forEach(tx => {
                    // Include if user added flag, note, or link
                    if (tx.flag || tx.note || (tx.linkedToFunds && tx.linkedToFunds.length > 0)) {
                        userInteractedTxIds.add(tx.txId);
                    }
                });
                
                // Funding method transaction markers (user accepted/rejected)
                const fundingMethods = ann.notes?.fundingMethods || [];
                fundingMethods.forEach(fm => {
                    const markers = fm.transactionMarkers || {};
                    Object.keys(markers).forEach(txId => {
                        // These are always user interactions
                        userInteractedTxIds.add(txId);
                    });
                });
                
                // Bank analysis items (user flagged/commented/linked)
                const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                bankAnalysisItems.forEach(item => {
                    // Individual transactions
                    if (item.type === 'transaction' && item.transactionId) {
                        if (item.flag || item.comment || item.linkedToFundIdx) {
                            userInteractedTxIds.add(item.transactionId);
                        }
                    }
                    // Expand repeating groups if flagged or linked
                    else if (item.type === 'repeating-group' && (item.flag || item.comment || item.linkedToFundIdx)) {
                        if (analysis.repeating_transactions && analysis.repeating_transactions[item.groupIndex]) {
                            const group = analysis.repeating_transactions[item.groupIndex];
                            if (group.items) {
                                group.items.forEach(txId => userInteractedTxIds.add(txId));
                            }
                        }
                    }
                    // Expand chains if flagged or linked
                    else if (item.type === 'chain' && (item.flag || item.comment || item.linkedToFundIdx)) {
                        if (item.chainId) {
                            const chainTxIds = item.chainId.split('|');
                            chainTxIds.forEach(txId => userInteractedTxIds.add(txId));
                        }
                    }
                });
            });
            
            if (userInteractedTxIds.size > 0) {
                let flaggedTxHtml = '';
                
                // Group transactions by who annotated them (most recent annotation wins)
                const txAnnotationInfo = new Map();
                
                Array.from(userInteractedTxIds).forEach(txId => {
                    const transaction = getTransactionById(txId);
                    if (!transaction) return;
                    
                    // Find the most recent annotation for this transaction
                    let mostRecentAnn = null;
                    let mostRecentTime = 0;
                    
                    sofAnnotations.forEach(ann => {
                        const annTime = new Date(ann.timestamp).getTime();
                        
                        // Check all sources
                        const txs = ann.notes?.transactions || [];
                        const fms = ann.notes?.fundingMethods || [];
                        const items = ann.notes?.bankAnalysisItems || [];
                        
                        // Check if this annotation touches this transaction
                        let touchesThisTx = txs.some(t => t.txId === txId);
                        if (!touchesThisTx) {
                            touchesThisTx = fms.some(fm => fm.transactionMarkers && fm.transactionMarkers[txId]);
                        }
                        if (!touchesThisTx) {
                            touchesThisTx = items.some(item => {
                                if (item.type === 'transaction') return item.transactionId === txId;
                                if (item.type === 'chain') return item.chainId && item.chainId.split('|').includes(txId);
                                if (item.type === 'repeating-group' && analysis.repeating_transactions) {
                                    const group = analysis.repeating_transactions[item.groupIndex];
                                    return group && group.items && group.items.includes(txId);
                                }
                                return false;
                            });
                        }
                        
                        if (touchesThisTx && annTime > mostRecentTime) {
                            mostRecentTime = annTime;
                            mostRecentAnn = ann;
                        }
                    });
                    
                    if (mostRecentAnn) {
                        txAnnotationInfo.set(txId, {
                            transaction,
                            userName: mostRecentAnn.userName || mostRecentAnn.user,
                            timestamp: mostRecentAnn.timestamp
                        });
                    }
                });
                
                txAnnotationInfo.forEach(({transaction, userName, timestamp}, txId) => {
                    // For flagged/commented section, get ONLY direct annotations (not inherited from groups)
                    // Don't use getTransactionAnnotations() here as it includes inherited links from groups
                    const directAnnotations = {
                        flag: '',
                        note: '',
                        linkedFundingMethods: [],
                        marker: ''
                    };
                    
                    const notes = [];
                    
                    sofAnnotations.forEach(ann => {
                        // Only check DIRECT transaction annotations
                        const transactions = ann.notes?.transactions || [];
                        transactions.forEach(tx => {
                            if (tx.txId === txId) {
                                if (tx.flag) directAnnotations.flag = tx.flag;
                                if (tx.note) notes.push(tx.note);
                                if (tx.linkedToFunds && Array.isArray(tx.linkedToFunds)) {
                                    tx.linkedToFunds.forEach(fundIdx => {
                                        if (!directAnnotations.linkedFundingMethods.includes(fundIdx)) {
                                            directAnnotations.linkedFundingMethods.push(fundIdx);
                                        }
                                    });
                                }
                            }
                        });
                        
                        // Check funding method markers
                        const fundingMethods = ann.notes?.fundingMethods || [];
                        fundingMethods.forEach(fm => {
                            if (fm.transactionMarkers && fm.transactionMarkers[txId]) {
                                directAnnotations.marker = fm.transactionMarkers[txId];
                                if (fm.fundIdx && !directAnnotations.linkedFundingMethods.includes(fm.fundIdx)) {
                                    directAnnotations.linkedFundingMethods.push(fm.fundIdx);
                                }
                            }
                        });
                        
                        // Check ONLY individual transaction bank analysis items (not groups/chains)
                        const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                        bankAnalysisItems.forEach(item => {
                            if (item.type === 'transaction' && item.transactionId === txId) {
                                if (item.flag) directAnnotations.flag = item.flag;
                                if (item.comment) notes.push(item.comment);
                                if (item.linkedToFundIdx && !directAnnotations.linkedFundingMethods.includes(item.linkedToFundIdx)) {
                                    directAnnotations.linkedFundingMethods.push(item.linkedToFundIdx);
                                }
                            }
                        });
                    });
                    
                    directAnnotations.note = notes.join(' | ');
                    
                    const txDate = new Date(transaction.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const amount = transaction.amount;
                    const amountClass = amount >= 0 ? 'positive' : 'negative';
                    const sign = amount >= 0 ? '+' : '';
                    const currencySymbol = this.getCurrencyFlag(transaction.currency || 'GBP');
                    
                    // Format annotation date/time
                    const annDate = new Date(timestamp).toLocaleString('en-GB', { 
                        day: '2-digit', 
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    // Format user name
                    let formattedUserName = userName || 'Unknown';
                    if (formattedUserName && formattedUserName.includes('.') && !formattedUserName.includes(' ')) {
                        formattedUserName = formattedUserName.split('@')[0]
                            .split('.').join(' ')
                            .split('-').join(' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                    }
                    
                    // Build badges (using account-tag pill style)
                    let badgesHtml = '';
                    
                    // Linked funding badges (one per funding method) - ONLY direct links
                    if (directAnnotations.linkedFundingMethods && directAnnotations.linkedFundingMethods.length > 0) {
                        directAnnotations.linkedFundingMethods.forEach(fundIdxStr => {
                                const fund = sofFunds[parseInt(fundIdxStr)];
                                if (fund) {
                                    const typeMap = {
                                        'fund:mortgage': 'Mortgage',
                                        'fund:savings': 'Savings',
                                        'fund:gift': 'Gift',
                                        'fund:sale:property': 'Property Sale',
                                        'fund:sale:assets': 'Asset Sale',
                                        'fund:inheritance': 'Inheritance',
                                        'fund:htb': 'Help to Buy / LISA',
                                        'fund:income': 'Income'
                                    };
                                const fundLabel = typeMap[fund.type] || fund.type.replace('fund:', '');
                                badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3;">${fundLabel}</span>`;
                            }
                        });
                    }
                    
                    // Flag badge
                    if (directAnnotations.flag) {
                        if (directAnnotations.flag === 'suspicious') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336;">Suspicious</span>';
                        } else if (directAnnotations.flag === 'review') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800;">Review</span>';
                        } else if (directAnnotations.flag === 'cleared') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50;">Cleared</span>';
                        } else if (directAnnotations.flag === 'linked') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3;">Linked</span>';
                        }
                    }
                    
                    // Marker badge
                    if (directAnnotations.marker) {
                        if (directAnnotations.marker === 'accepted') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #388e3c; border: 1px solid #388e3c;">Accepted</span>';
                        } else if (directAnnotations.marker === 'rejected') {
                            badgesHtml += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #d32f2f; border: 1px solid #d32f2f;">Rejected</span>';
                        }
                    }
                    
                    // Build transaction inline badges (for nested card)
                    let txInlineBadges = '';
                    
                    // Marker badges for transaction
                    if (directAnnotations.marker) {
                        if (directAnnotations.marker === 'accepted') {
                            txInlineBadges += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                        } else if (directAnnotations.marker === 'rejected') {
                            txInlineBadges += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                        }
                    }
                    
                    // Flag badges for transaction
                    if (directAnnotations.flag) {
                        if (directAnnotations.flag === 'cleared') {
                            txInlineBadges += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                        } else if (directAnnotations.flag === 'suspicious') {
                            txInlineBadges += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                        } else if (directAnnotations.flag === 'review') {
                            txInlineBadges += '<span class="tx-marker-badge review">— Review</span>';
                        } else if (directAnnotations.flag === 'linked') {
                            txInlineBadges += '<span class="tx-marker-badge linked">✓ Linked</span>';
                        }
                    }
                    
                    // Linked funding method badges for transaction
                    if (directAnnotations.linkedFundingMethods && directAnnotations.linkedFundingMethods.length > 0) {
                        directAnnotations.linkedFundingMethods.forEach(fundIdxStr => {
                            const fund = sofFunds[parseInt(fundIdxStr)];
                            if (fund) {
                                const typeMap = {
                                    'fund:mortgage': 'Mortgage',
                                    'fund:savings': 'Savings',
                                    'fund:gift': 'Gift',
                                    'fund:sale:property': 'Property Sale',
                                    'fund:sale:assets': 'Asset Sale',
                                    'fund:inheritance': 'Inheritance',
                                    'fund:htb': 'Help to Buy / LISA',
                                    'fund:income': 'Income'
                                };
                                const fundLabel = typeMap[fund.type] || fund.type.replace('fund:', '');
                                txInlineBadges += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-left: 4px;">🔗 ${fundLabel}</span>`;
                            }
                        });
                    }
                    
                    // Check if transaction is part of repeating group and build badge
                    let repeatingBadge = '';
                    let repeatingNoteText = '';
                    if (analysis && analysis.repeating_transactions) {
                        analysis.repeating_transactions.forEach((group, groupIdx) => {
                            if (group.items && group.items.includes(txId)) {
                                repeatingBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f3e5f5; color: #9c27b0; border: 1px solid #9c27b0; margin-left: 4px;">Repeating</span>';
                                const groupAnnotation = getItemAnnotation('repeating-group', groupIdx);
                                if (groupAnnotation && groupAnnotation.comment) {
                                    repeatingNoteText = groupAnnotation.comment;
                                }
                            }
                        });
                    }
                    
                    // User note badge for transaction (from repeating group or direct)
                    let userNoteBadge = '';
                    if (repeatingNoteText) {
                        userNoteBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${repeatingNoteText}</span>`;
                    }
                    
                    flaggedTxHtml += `
                        <div style="margin: 12px 0; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fafafa;">
                            <!-- Header row with user, badges, and timestamp -->
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${directAnnotations.note ? '8px' : '12px'};">
                                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                    <strong style="font-size: 12px; color: #333;">${formattedUserName}</strong>
                                    ${badgesHtml ? `<div style="display: flex; gap: 4px; flex-wrap: wrap;">${badgesHtml}</div>` : ''}
                                </div>
                                <span style="font-size: 11px; color: #666; white-space: nowrap;">${annDate}</span>
                            </div>
                            
                            <!-- User note -->
                            ${directAnnotations.note ? `
                                <div style="margin-bottom: 12px; padding: 8px 10px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 3px; font-size: 12px; color: #856404;">
                                    ${directAnnotations.note}
                                </div>
                            ` : ''}
                            
                            <!-- Nested transaction data card -->
                            <div style="padding: 10px; background: white; border: 1px solid #e0e0e0; border-radius: 4px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-size: 11px; color: #666;">${txDate}</span>
                                    <span style="font-size: 13px; font-weight: 600; color: ${amount >= 0 ? '#4caf50' : '#f44336'};">${sign}${currencySymbol}${Math.abs(amount).toFixed(2)}</span>
                                </div>
                                <div style="font-size: 13px; font-weight: 500; color: #333; margin-bottom: 4px;">
                                    ${transaction.description || transaction.merchant_name || 'Transaction'}${txInlineBadges}${repeatingBadge}${userNoteBadge}
                                </div>
                                <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: #666;">
                                    <strong>${transaction.accountName}</strong>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                    <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                        <div class="analysis-section-header">
                            <span class="analysis-section-title">Flagged & Commented Transactions (${userInteractedTxIds.size})</span>
                            <span class="expand-indicator">▼</span>
                        </div>
                        <div class="analysis-section-content">
                            ${flaggedTxHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        return html;
    }
    
    createBiggestTransactionsSection(summaryByCcy, accounts = {}, check = null) {
        const currencyFlag = this.getCurrencyFlag.bind(this);
        
        // Create a map of account IDs to account names for quick lookup
        const accountNames = {};
        const accountColors = ['#93C5FD', '#86EFAC', '#FCA5A5', '#C4B5FD', '#FDBA74', '#A5F3FC', '#D1D5DB'];
        let colorIndex = 0;
        
        for (const [accountId, accountData] of Object.entries(accounts)) {
            const info = accountData.info || accountData;
            const name = info.name || 'Account';
            accountNames[accountId] = {
                name: name,
                color: accountColors[colorIndex % accountColors.length]
            };
            colorIndex++;
        }
        
        let currenciesHtml = '';
        
        for (const [currency, data] of Object.entries(summaryByCcy)) {
            const topIn = data.top_in || [];
            const topOut = data.top_out || [];
            const flag = currencyFlag(currency);
            
            // Filter transactions to only include those that actually match this currency
            let filteredTopIn = topIn.filter(tx => tx.currency === currency).slice(0, 5);
            let filteredTopOut = topOut.filter(tx => tx.currency === currency).slice(0, 5);
            
            // Enrich transactions with account names
            filteredTopIn = filteredTopIn.map(tx => ({
                ...tx,
                accountName: accountNames[tx.account_id]?.name || 'Account'
            }));
            filteredTopOut = filteredTopOut.map(tx => ({
                ...tx,
                accountName: accountNames[tx.account_id]?.name || 'Account'
            }));
            
            // Skip this currency if no matching transactions
            if (filteredTopIn.length === 0 && filteredTopOut.length === 0) {
                continue;
            }
            
            // Match internal transfers and transaction chains
            const matched = [];
            const transferPairs = [];
            const transactionChains = [];
            
            // First pass: Find exact cross-account transfers (same amount, same day, different accounts)
            filteredTopOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = filteredTopIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    
                    // Exact transfer: same amount, same day, different accounts
                    return Math.abs(inAmount - outAmount) < 0.01 && 
                           inTx.account_id !== outTx.account_id && 
                           inDate.toDateString() === outDate.toDateString();
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transferPairs.push({ out: outTx, in: match });
                }
            });
            
            // Second pass: Find same-account flows (income → payment from same account)
            filteredTopOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = filteredTopIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    // Same account flow: income before payment, within 3 days
                    return inTx.account_id === outTx.account_id && 
                           daysDiff >= 0 && daysDiff <= 3 &&
                           inAmount >= outAmount &&
                           (inAmount - outAmount) <= Math.max(500, inAmount * 0.2);
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transactionChains.push({ 
                        source: match, 
                        out: outTx, 
                        in: null  // Same account, no cross-transfer
                    });
                }
            });
            
            // Third pass: Look for extended chains (income → transfer out → transfer in → payment)
            const extendedChains = [];
            transferPairs.forEach(pair => {
                // Check for preceding income to the outgoing account
                const candidateIncomes = filteredTopIn.filter(precedingTx => {
                    if (matched.includes(precedingTx.id)) return false;
                    const precedingDate = new Date(precedingTx.timestamp);
                    const outDate = new Date(pair.out.timestamp);
                    const daysDiff = (outDate - precedingDate) / (1000 * 60 * 60 * 24);
                    
                    return precedingTx.account_id === pair.out.account_id && 
                           daysDiff >= 0 && daysDiff <= 3;
                });
                
                const precedingIncome = candidateIncomes.length > 0
                    ? candidateIncomes.reduce((largest, tx) => 
                        Math.abs(tx.amount) > Math.abs(largest.amount) ? tx : largest
                      )
                    : null;
                
                // Check for subsequent payment from the incoming account
                const subsequentPayment = filteredTopOut.find(paymentTx => {
                    if (matched.includes(paymentTx.id)) return false;
                    const paymentDate = new Date(paymentTx.timestamp);
                    const inDate = new Date(pair.in.timestamp);
                    const daysDiff = (paymentDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return paymentTx.account_id === pair.in.account_id && 
                           daysDiff >= 0 && daysDiff <= 2;
                });
                
                if (precedingIncome || subsequentPayment) {
                    if (precedingIncome) matched.push(precedingIncome.id);
                    if (subsequentPayment) matched.push(subsequentPayment.id);
                    
                    extendedChains.push({
                        source: precedingIncome,
                        out: pair.out,
                        in: pair.in,
                        payment: subsequentPayment
                    });
                    pair.extended = true; // Mark as processed
                }
            });
            
            // Create transaction chains and pairs - display 2 per row
            let transfersHtml = '';
            const allChains = [...extendedChains, ...transactionChains, ...transferPairs.filter(p => !p.extended)];
            
            for (let i = 0; i < allChains.length; i += 2) {
                const chain1 = allChains[i];
                const chain2 = allChains[i + 1];
                
                transfersHtml += `<div class="chains-row">`;
                
                // Left column - Chain 1
                if (chain1) {
                    const flag1 = this.getCurrencyFlag((chain1.source?.currency || chain1.out.currency) || currency);
                    transfersHtml += this.renderChainColumn(chain1, flag1);
                }
                
                // Right column - Chain 2
                if (chain2) {
                    const flag2 = this.getCurrencyFlag((chain2.source?.currency || chain2.out.currency) || currency);
                    transfersHtml += this.renderChainColumn(chain2, flag2);
                }
                
                transfersHtml += `</div>`;
            }
            
            // Create unmatched transaction rows
            let incomingHtml = '';
            filteredTopIn.forEach(tx => {
                if (matched.includes(tx.id)) return;
                
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const amount = tx.amount.toFixed(2);
                const description = tx.description || tx.merchant_name || 'Transaction';
                const accountInfo = accountNames[tx.account_id];
                const accountBadge = accountInfo ? accountInfo.name : '';
                
                // Get comprehensive annotations for this transaction
                const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                
                // Build badges
                let badgesHtml = '';
                
                // Marker badges
                if (txAnnotations.marker === 'accepted') {
                    badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                } else if (txAnnotations.marker === 'rejected') {
                    badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                }
                
                // Flag badges
                if (txAnnotations.flag === 'cleared') {
                    badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                } else if (txAnnotations.flag === 'suspicious') {
                    badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                } else if (txAnnotations.flag === 'review') {
                    badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                } else if (txAnnotations.flag === 'linked') {
                    badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                }
                
                // User note badge
                if (txAnnotations.note) {
                    badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                }
                
                incomingHtml += `
                    <div class="transaction-row incoming">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${description}${badgesHtml}</span>
                        ${accountBadge ? `<span class="account-badge">${accountBadge}</span>` : ''}
                        <span class="transaction-amount positive">${flag}${amount}</span>
                    </div>
                `;
            });
            
            let outgoingHtml = '';
            filteredTopOut.forEach(tx => {
                if (matched.includes(tx.id)) return;
                
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const amount = Math.abs(tx.amount).toFixed(2);
                const description = tx.description || tx.merchant_name || 'Transaction';
                const accountInfo = accountNames[tx.account_id];
                const accountBadge = accountInfo ? accountInfo.name : '';
                
                // Get comprehensive annotations for this transaction
                const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                
                // Build badges
                let badgesHtml = '';
                
                // Marker badges
                if (txAnnotations.marker === 'accepted') {
                    badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                } else if (txAnnotations.marker === 'rejected') {
                    badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                }
                
                // Flag badges
                if (txAnnotations.flag === 'cleared') {
                    badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                } else if (txAnnotations.flag === 'suspicious') {
                    badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                } else if (txAnnotations.flag === 'review') {
                    badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                } else if (txAnnotations.flag === 'linked') {
                    badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                }
                
                // User note badge
                if (txAnnotations.note) {
                    badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                }
                
                outgoingHtml += `
                    <div class="transaction-row outgoing">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${description}${badgesHtml}</span>
                        ${accountBadge ? `<span class="account-badge">${accountBadge}</span>` : ''}
                        <span class="transaction-amount negative">${flag}${amount}</span>
                    </div>
                `;
            });
            
            // Build the columns section only if there are unmatched transactions
            let columnsHtml = '';
            const hasIncoming = incomingHtml.trim().length > 0;
            const hasOutgoing = outgoingHtml.trim().length > 0;
            
            if (hasIncoming || hasOutgoing) {
                if (hasIncoming && hasOutgoing) {
                    // Both columns
                    columnsHtml = `
                        <div class="transactions-columns">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Largest Incoming</div>
                                ${incomingHtml}
                            </div>
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Largest Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                } else if (hasIncoming) {
                    // Only incoming
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Largest Incoming</div>
                                ${incomingHtml}
                            </div>
                        </div>
                    `;
                } else {
                    // Only outgoing
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Largest Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                }
            }
            
            currenciesHtml += `
                <div class="currency-transactions-row">
                    <div class="currency-label">${flag} ${currency}</div>
                    ${transfersHtml ? `
                        <div class="internal-transfers-section">
                            <div class="internal-transfers-label">Internal Transfers</div>
                            ${transfersHtml}
                        </div>
                    ` : ''}
                    ${columnsHtml}
                </div>
            `;
        }
        
        return `
            <div class="biggest-transactions-container collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                <div class="biggest-transactions-header">
                    <span class="biggest-transactions-title">Biggest Transactions by Currency</span>
                    <span class="expand-indicator">▼</span>
                </div>
                <div class="biggest-transactions-content">
                    ${currenciesHtml}
                </div>
            </div>
        `;
    }
    
    createBankTaskCard(bankSummary, bankStatement, sofTask = null, check = null) {
        // Combined bank task card - handles both linking (summary) and PDF upload (statement)
        const hasSummary = bankSummary && bankSummary.status === 'closed';
        const hasStatement = bankStatement && bankStatement.status === 'closed';
        
        // Check if this is documents:bank-statement (uploaded PDFs with OCR data)
        const isDocumentUpload = bankStatement && bankStatement.breakdown?.accounts && bankStatement.breakdown?.documents;
        
        // Check if linking was requested but skipped (rejected status)
        const linkingSkipped = (bankSummary && bankSummary.status === 'rejected') || 
                               (bankStatement && bankStatement.status === 'rejected' && !isDocumentUpload);
        
        // Determine overall status
        let borderClass = 'clear';
        let statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        let inlineWarning = '';
        
        // If linking was skipped but documents were uploaded and scanned, show as clear with warning
        if (linkingSkipped && isDocumentUpload) {
            borderClass = 'clear';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
            inlineWarning = 'Bank linking skipped but documents uploaded and scanned';
        } else if (hasSummary && bankSummary.result === 'consider') {
            borderClass = 'consider';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (hasSummary && bankSummary.result === 'fail') {
            borderClass = 'alert';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        } else if (hasStatement && !hasSummary && !isDocumentUpload) {
            // PDF upload only without OCR data - always consider (manual review)
            borderClass = 'consider';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (!hasSummary && !hasStatement) {
            // Neither provided - fail
            borderClass = 'alert';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        
        // Get accounts count for header display
        let accounts = {};
        let accountsHtml = '';
        let isManualUpload = false;
        if (hasStatement && bankStatement.breakdown && bankStatement.breakdown.accounts) {
            accounts = bankStatement.breakdown.accounts;
            isManualUpload = true; // Manual PDF upload
            
            // DEDUPLICATE all account statements for manual uploads
            // This ensures all analysis (repeating transactions, largest transactions, etc.) uses clean data
            accounts = this.deduplicateAccountsData(accounts);
        } else if (hasSummary && bankSummary.breakdown && bankSummary.breakdown.accounts) {
            accounts = bankSummary.breakdown.accounts;
            isManualUpload = false; // Open Banking linking
        }
        const accountCount = Object.keys(accounts).length;
        
        // Build header checks (visible when collapsed)
        let headerChecksHtml = '<div class="task-header-checks">';
        
        if (linkingSkipped && isDocumentUpload) {
            // Bank linking skipped but statements uploaded
            headerChecksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('CO')}
                    <span class="task-check-text">Bank linking skipped</span>
                </div>
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('CL')}
                    <span class="task-check-text">Statements uploaded and scanned</span>
                </div>
            `;
        } else if (hasSummary) {
            // Bank linking completed
            const summaryStatus = bankSummary.result === 'clear' ? 'CL' : (bankSummary.result === 'fail' ? 'AL' : 'CO');
            headerChecksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon(summaryStatus)}
                    <span class="task-check-text">Bank linking completed via Open Banking</span>
                </div>
            `;
            if (accountCount > 0) {
                headerChecksHtml += `
                    <div class="task-check-item">
                        ${this.getTaskCheckIcon('CL')}
                        <span class="task-check-text">${accountCount} account${accountCount !== 1 ? 's' : ''} linked</span>
                    </div>
                `;
            }
        } else if (hasStatement && !hasSummary) {
            // PDF upload only
            headerChecksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('CO')}
                    <span class="task-check-text">Bank linking declined - Statements uploaded for manual review</span>
                </div>
            `;
        } else if (!hasSummary && !hasStatement) {
            // Neither provided - task skipped
            headerChecksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('AL')}
                    <span class="task-check-text">Task skipped</span>
                </div>
            `;
        }
        
        headerChecksHtml += '</div>';
        
        // Build detail checks (visible when expanded)
        let checksHtml = '';
        
        // Add linked accounts section (already retrieved accounts above for header)
        
        if (Object.keys(accounts).length > 0) {
            accountsHtml = '<div class="bank-accounts-container">';
            accountsHtml += '<div class="bank-accounts-title">Linked Accounts</div>';
            
            for (const [accountId, accountData] of Object.entries(accounts)) {
                accountsHtml += this.createBankAccountCard(accountId, accountData, isManualUpload, check);
            }
            
            accountsHtml += '</div>';
        }
        
        // Add biggest transactions by currency section
        let biggestTransactionsHtml = '';
        const summaryByCcy = (hasSummary && bankSummary.breakdown && bankSummary.breakdown.summary && bankSummary.breakdown.summary.by_ccy) 
            ? bankSummary.breakdown.summary.by_ccy 
            : null;
        
        if (summaryByCcy && Object.keys(summaryByCcy).length > 0) {
            biggestTransactionsHtml = this.createBiggestTransactionsSection(summaryByCcy, accounts, check);
        }
        
        // Add analysis sections if available
        let analysisHtml = '';
        if (bankStatement?.breakdown?.analysis) {
            analysisHtml = this.createBankAnalysisSections(bankStatement.breakdown.analysis, accounts, sofTask, check);
        }
        
        // Add annotations display if check provided
        const annotationsHtml = check ? this.renderTaskAnnotations('bank', check) : '';
        
        // Calculate summary badges
        let totalLinkedTxs = 0;
        let totalReviewedAccounts = 0;
        let totalSuspiciousTxs = 0;
        
        if (check) {
            // Count reviewed accounts
            if (check.sofAnnotations) {
                const reviewedAccountIds = new Set();
                check.sofAnnotations.forEach(ann => {
                    const accounts = ann.notes?.accounts || [];
                    accounts.forEach(acc => {
                        if (acc.reviewed) {
                            reviewedAccountIds.add(acc.accountId);
                        }
                    });
                });
                totalReviewedAccounts = reviewedAccountIds.size;
            }
            
            // Count linked and suspicious transactions across all accounts
            Object.values(accounts).forEach(accountData => {
                const statement = accountData.statement || [];
                statement.forEach(tx => {
                    const txAnnotations = this.getTransactionAnnotations(tx.id, check);
                    if (txAnnotations.linkedFundingMethods.length > 0) totalLinkedTxs++;
                    if (txAnnotations.flag === 'suspicious') totalSuspiciousTxs++;
                });
            });
        }
        
        // Build badges HTML
        let badgesHtml = '';
        if (totalReviewedAccounts > 0) {
            badgesHtml += `<span class="annotation-count-badge">${totalReviewedAccounts} Account${totalReviewedAccounts > 1 ? 's' : ''} Reviewed</span>`;
        }
        if (totalLinkedTxs > 0) {
            badgesHtml += `<span class="annotation-count-badge">${totalLinkedTxs} Transaction${totalLinkedTxs > 1 ? 's' : ''} Linked</span>`;
        }
        if (totalSuspiciousTxs > 0) {
            badgesHtml += `<span class="annotation-count-badge" style="background: #ffebee; color: #d32f2f;">${totalSuspiciousTxs} Suspicious</span>`;
        }
        
        const badgesContainer = badgesHtml ? `<div class="task-header-badges">${badgesHtml}</div>` : '';
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Bank Summary</div>
                    ${badgesContainer}
                    ${statusIcon}
                </div>
                ${headerChecksHtml}
                <div class="task-details">
                    ${accountsHtml}
                    ${biggestTransactionsHtml}
                    ${analysisHtml}
                    ${annotationsHtml}
                </div>
            </div>
        `;
    }
    
    getBankBrandColors(providerId, providerName) {
        // Map of UK banks to their official brand colors (gradient pairs)
        const bankColors = {
            // High Street Banks
            'ob-barclays': { from: '#00AEEF', to: '#008CB8' },
            'barclays': { from: '#00AEEF', to: '#008CB8' },
            'ob-hsbc': { from: '#DB0011', to: '#A30009' },
            'hsbc': { from: '#DB0011', to: '#A30009' },
            'hsbc uk': { from: '#DB0011', to: '#A30009' },
            'ob-lloyds': { from: '#006F62', to: '#004D43' },
            'lloyds': { from: '#006F62', to: '#004D43' },
            'lloyds bank': { from: '#006F62', to: '#004D43' },
            'ob-halifax': { from: '#0076BE', to: '#005691' },
            'halifax': { from: '#0076BE', to: '#005691' },
            'ob-natwest': { from: '#5A287F', to: '#42205F' },
            'natwest': { from: '#5A287F', to: '#42205F' },
            'ob-rbs': { from: '#003C71', to: '#002952' },
            'rbs': { from: '#003C71', to: '#002952' },
            'royal bank of scotland': { from: '#003C71', to: '#002952' },
            'ob-santander': { from: '#EC0000', to: '#B30000' },
            'santander': { from: '#EC0000', to: '#B30000' },
            'santander uk': { from: '#EC0000', to: '#B30000' },
            'ob-nationwide': { from: '#0C2340', to: '#081629' },
            'nationwide': { from: '#0C2340', to: '#081629' },
            'nationwide building society': { from: '#0C2340', to: '#081629' },
            'ob-bankofscotland': { from: '#005EB8', to: '#004489' },
            'bank of scotland': { from: '#005EB8', to: '#004489' },
            'ob-tsb': { from: '#00A1DE', to: '#0078A8' },
            'tsb': { from: '#00A1DE', to: '#0078A8' },
            'tsb bank': { from: '#00A1DE', to: '#0078A8' },
            'ob-cooperative': { from: '#00B1E7', to: '#0088B5' },
            'cooperative bank': { from: '#00B1E7', to: '#0088B5' },
            'the co-operative bank': { from: '#00B1E7', to: '#0088B5' },
            'ob-metro': { from: '#951B81', to: '#6E1460' },
            'metro': { from: '#951B81', to: '#6E1460' },
            'metro bank': { from: '#951B81', to: '#6E1460' },
            'ob-virginmoney': { from: '#E30613', to: '#B0050F' },
            'virgin money': { from: '#E30613', to: '#B0050F' },
            'ob-firstdirect': { from: '#242833', to: '#13161E' },
            'first direct': { from: '#242833', to: '#13161E' },
            
            // Digital/Fintech Banks
            'ob-monzo': { from: '#EB3C53', to: '#D5447E' },
            'monzo': { from: '#EB3C53', to: '#D5447E' },
            'ob-starling': { from: '#6935D3', to: '#4F1FA8' },
            'starling': { from: '#6935D3', to: '#4F1FA8' },
            'starling bank': { from: '#6935D3', to: '#4F1FA8' },
            'ob-revolut': { from: '#242833', to: '#13161E' },
            'revolut': { from: '#242833', to: '#13161E' },
            'ob-chase': { from: '#117ACA', to: '#0D5C9C' },
            'chase': { from: '#117ACA', to: '#0D5C9C' },
            'chase uk': { from: '#117ACA', to: '#0D5C9C' },
            'ob-tide': { from: '#FF6B00', to: '#CC5500' },
            'tide': { from: '#FF6B00', to: '#CC5500' },
            'ob-curve': { from: '#2E3192', to: '#1F2166' },
            'curve': { from: '#2E3192', to: '#1F2166' },
            
            // Building Societies
            'ob-yorkshire': { from: '#002B5C', to: '#001A3A' },
            'yorkshire': { from: '#002B5C', to: '#001A3A' },
            'yorkshire building society': { from: '#002B5C', to: '#001A3A' },
            'ob-coventry': { from: '#E41937', to: '#B4142C' },
            'coventry': { from: '#E41937', to: '#B4142C' },
            'coventry building society': { from: '#E41937', to: '#B4142C' },
            
            // Irish Banks
            'ob-bankofireland': { from: '#005EB8', to: '#004489' },
            'bank of ireland': { from: '#005EB8', to: '#004489' },
            'bank of ireland uk': { from: '#005EB8', to: '#004489' },
            'ob-aib': { from: '#00A3E0', to: '#007DB0' },
            'aib': { from: '#00A3E0', to: '#007DB0' },
            'allied irish bank': { from: '#00A3E0', to: '#007DB0' },
            'ob-danske': { from: '#003755', to: '#00253B' },
            'danske': { from: '#003755', to: '#00253B' },
            'danske bank': { from: '#003755', to: '#00253B' },
            'ob-ulster': { from: '#E30613', to: '#B0050F' },
            'ulster': { from: '#E30613', to: '#B0050F' },
            'ulster bank': { from: '#E30613', to: '#B0050F' },
            
            // Retail Banks
            'ob-tesco': { from: '#00539F', to: '#003D75' },
            'tesco': { from: '#00539F', to: '#003D75' },
            'tesco bank': { from: '#00539F', to: '#003D75' },
            'ob-sainsburys': { from: '#F06C00', to: '#C45500' },
            'sainsburys': { from: '#F06C00', to: '#C45500' },
            'sainsburys bank': { from: '#F06C00', to: '#C45500' },
            'ob-marks': { from: '#334A2C', to: '#243520' },
            'm&s bank': { from: '#334A2C', to: '#243520' },
            'marks and spencer': { from: '#334A2C', to: '#243520' },
            
            // International/Specialist
            'ob-clydesdale': { from: '#002855', to: '#001A38' },
            'clydesdale': { from: '#002855', to: '#001A38' },
            'clydesdale bank': { from: '#002855', to: '#001A38' },
            'ob-handelsbanken': { from: '#003C71', to: '#002952' },
            'handelsbanken': { from: '#003C71', to: '#002952' },
            'handelsbanken uk': { from: '#003C71', to: '#002952' },
            'ob-clearbank': { from: '#00A3E0', to: '#007DB0' },
            'clearbank': { from: '#00A3E0', to: '#007DB0' }
        };
        
        const colors = bankColors[providerId?.toLowerCase()] || bankColors[providerName?.toLowerCase()];
        
        if (colors) {
            return colors;
        }
        // Default fallback - your current blue
        return { from: '#1d71b8', to: '#155a94' };
    }
    
    getBankLogo(providerId, providerName) {
        // Map of common UK banks to their official logo URLs
        const bankLogos = {
            // High Street Banks
            'ob-barclays': 'https://www.openbanking.org.uk/wp-content/uploads/barclays-1024x397.png',
            'barclays': 'https://www.openbanking.org.uk/wp-content/uploads/barclays-1024x397.png',
            'ob-hsbc': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/HSBC_UK_logo.svg',
            'hsbc': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/HSBC_UK_logo.svg',
            'hsbc uk': 'https://upload.wikimedia.org/wikipedia/commons/f/f5/HSBC_UK_logo.svg',
            'ob-lloyds': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyy7vaJz0i2F4dovIfcwWCdqeedJQM9qlSzQ&s',
            'lloyds': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyy7vaJz0i2F4dovIfcwWCdqeedJQM9qlSzQ&s',
            'lloyds bank': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSyy7vaJz0i2F4dovIfcwWCdqeedJQM9qlSzQ&s',
            'ob-halifax': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_h9upkpUUtuAGtTSdTLbeAV0piA87sav6aw&s',
            'halifax': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_h9upkpUUtuAGtTSdTLbeAV0piA87sav6aw&s',
            'ob-rbs': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuXPyc9O-r79u9oluVWXq5LAet4o_RtAkb-w&s',
            'rbs': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuXPyc9O-r79u9oluVWXq5LAet4o_RtAkb-w&s',
            'royal bank of scotland': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTuXPyc9O-r79u9oluVWXq5LAet4o_RtAkb-w&s',
            'ob-natwest': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVjny8JmpgBKI6JIDQSOfeoi-4_LLQMPj-Eg&s',
            'natwest': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVjny8JmpgBKI6JIDQSOfeoi-4_LLQMPj-Eg&s',
            'ob-bankofscotland': 'https://www.lloydsbankinggroup.com/assets/images/site-wide/logos/bank-of-scotland.png',
            'bank of scotland': 'https://www.lloydsbankinggroup.com/assets/images/site-wide/logos/bank-of-scotland.png',
            'ob-santander': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/1280px-Banco_Santander_Logotipo.svg.png',
            'santander': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/1280px-Banco_Santander_Logotipo.svg.png',
            'santander uk': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Banco_Santander_Logotipo.svg/1280px-Banco_Santander_Logotipo.svg.png',
            'ob-nationwide': 'https://www.inbenta.com/wp-content/uploads/2024/11/BrandLogo.org-Nationwide-Building-Society-Logo.png',
            'nationwide': 'https://www.inbenta.com/wp-content/uploads/2024/11/BrandLogo.org-Nationwide-Building-Society-Logo.png',
            'nationwide building society': 'https://www.inbenta.com/wp-content/uploads/2024/11/BrandLogo.org-Nationwide-Building-Society-Logo.png',
            'ob-tsb': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMk_WcrzS3Y8kEZ42JhexEc_ZNbTp0_IlK0w&s',
            'tsb': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMk_WcrzS3Y8kEZ42JhexEc_ZNbTp0_IlK0w&s',
            'tsb bank': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTMk_WcrzS3Y8kEZ42JhexEc_ZNbTp0_IlK0w&s',
            'ob-virginmoney': 'https://pentagram-production.imgix.net/147ad8a8-ed8d-46b0-89ee-673690e12b4d/01_VM_HeroLogo.png?auto=compress%2Cformat&crop=entropy&fit=crop&fm=jpg&h=470&q=80&rect=0%2C172%2C4133%2C2584&w=900',
            'virgin money': 'https://pentagram-production.imgix.net/147ad8a8-ed8d-46b0-89ee-673690e12b4d/01_VM_HeroLogo.png?auto=compress%2Cformat&crop=entropy&fit=crop&fm=jpg&h=470&q=80&rect=0%2C172%2C4133%2C2584&w=900',
            'ob-cooperative': 'https://www.moneyandmentalhealth.org/wp-content/uploads/2023/07/coop-bank-logo.png',
            'cooperative bank': 'https://www.moneyandmentalhealth.org/wp-content/uploads/2023/07/coop-bank-logo.png',
            'the co-operative bank': 'https://www.moneyandmentalhealth.org/wp-content/uploads/2023/07/coop-bank-logo.png',
            'ob-metro': 'https://cdn-ukwest.onetrust.com/logos/6dc470d7-9576-47d4-a63b-95cced3c427e/bf7bb4ec-806f-4b15-b89c-ad14cdef2bf0/9d9d405e-b98c-4c8d-8708-66860b4cd96a/Metro_Bank_Logo_-_Secondary_(black).png',
            'metro': 'https://cdn-ukwest.onetrust.com/logos/6dc470d7-9576-47d4-a63b-95cced3c427e/bf7bb4ec-806f-4b15-b89c-ad14cdef2bf0/9d9d405e-b98c-4c8d-8708-66860b4cd96a/Metro_Bank_Logo_-_Secondary_(black).png',
            'metro bank': 'https://cdn-ukwest.onetrust.com/logos/6dc470d7-9576-47d4-a63b-95cced3c427e/bf7bb4ec-806f-4b15-b89c-ad14cdef2bf0/9d9d405e-b98c-4c8d-8708-66860b4cd96a/Metro_Bank_Logo_-_Secondary_(black).png',
            'ob-bankofireland': 'https://d1pt6w2mt2xqso.cloudfront.net/AcuCustom/Sitename/DAM/047/LOGO-bank-of-ireland-copy-e1573823492597.png',
            'bank of ireland': 'https://d1pt6w2mt2xqso.cloudfront.net/AcuCustom/Sitename/DAM/047/LOGO-bank-of-ireland-copy-e1573823492597.png',
            'bank of ireland uk': 'https://d1pt6w2mt2xqso.cloudfront.net/AcuCustom/Sitename/DAM/047/LOGO-bank-of-ireland-copy-e1573823492597.png',
            'ob-aib': 'https://aibgb.co.uk/content/dam/gb/business/business-images/aib-logo@2x.png',
            'aib': 'https://aibgb.co.uk/content/dam/gb/business/business-images/aib-logo@2x.png',
            'allied irish bank': 'https://aibgb.co.uk/content/dam/gb/business/business-images/aib-logo@2x.png',
            'ob-danske': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Danske_Bank_logo.svg/2560px-Danske_Bank_logo.svg.png',
            'danske': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Danske_Bank_logo.svg/2560px-Danske_Bank_logo.svg.png',
            'danske bank': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Danske_Bank_logo.svg/2560px-Danske_Bank_logo.svg.png',
            'ob-ulster': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Ulsterbank_logo.gif',
            'ulster': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Ulsterbank_logo.gif',
            'ulster bank': 'https://upload.wikimedia.org/wikipedia/commons/8/81/Ulsterbank_logo.gif',
            'ob-yorkshire': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9PPhhvh95D4l0lPgy4nRU3U1a3iDihjhbGA&s',
            'yorkshire': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9PPhhvh95D4l0lPgy4nRU3U1a3iDihjhbGA&s',
            'yorkshire building society': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR9PPhhvh95D4l0lPgy4nRU3U1a3iDihjhbGA&s',
            'ob-coventry': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQB9GBYoP8kSjhhDbY4OvFF8UPAcyA_Tq-qaA&s',
            'coventry': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQB9GBYoP8kSjhhDbY4OvFF8UPAcyA_Tq-qaA&s',
            'coventry building society': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQB9GBYoP8kSjhhDbY4OvFF8UPAcyA_Tq-qaA&s',
            'ob-tesco': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXmS_yihuCLWL6sjW_-fYnCzij03VWojI9Gw&s',
            'tesco': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXmS_yihuCLWL6sjW_-fYnCzij03VWojI9Gw&s',
            'tesco bank': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXmS_yihuCLWL6sjW_-fYnCzij03VWojI9Gw&s',
            'ob-sainsburys': 'https://www.sainsburysbank.co.uk/dam/jcr:f4cf6e1c-fdfb-4595-89f0-fa3a2fa1b1cd/Sept%202022%20stacked%20logo%20clearance.png',
            'sainsburys': 'https://www.sainsburysbank.co.uk/dam/jcr:f4cf6e1c-fdfb-4595-89f0-fa3a2fa1b1cd/Sept%202022%20stacked%20logo%20clearance.png',
            'sainsburys bank': 'https://www.sainsburysbank.co.uk/dam/jcr:f4cf6e1c-fdfb-4595-89f0-fa3a2fa1b1cd/Sept%202022%20stacked%20logo%20clearance.png',
            'ob-marks': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDkOm1IEkSw1L4Vq5sQB19-0RdPozPgVxGAA&s',
            'm&s bank': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDkOm1IEkSw1L4Vq5sQB19-0RdPozPgVxGAA&s',
            'marks and spencer': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDkOm1IEkSw1L4Vq5sQB19-0RdPozPgVxGAA&s',
            'ob-firstdirect': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/First_direct_vertical_whiteonblack_logo.svg',
            'first direct': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/First_direct_vertical_whiteonblack_logo.svg',
            'ob-clydesdale': 'https://upload.wikimedia.org/wikipedia/de/0/05/Clydesdale_Bank_logo.svg',
            'clydesdale': 'https://upload.wikimedia.org/wikipedia/de/0/05/Clydesdale_Bank_logo.svg',
            'clydesdale bank': 'https://upload.wikimedia.org/wikipedia/de/0/05/Clydesdale_Bank_logo.svg',
            'ob-handelsbanken': 'https://www.handelsbanken.co.uk/tron/gbpu/info/contents/v1/document/52-99616',
            'handelsbanken': 'https://www.handelsbanken.co.uk/tron/gbpu/info/contents/v1/document/52-99616',
            'handelsbanken uk': 'https://www.handelsbanken.co.uk/tron/gbpu/info/contents/v1/document/52-99616',
            
            // Digital/Fintech Banks
            'ob-monzo': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Monzo_logo.png',
            'monzo': 'https://upload.wikimedia.org/wikipedia/en/3/3a/Monzo_logo.png',
            'ob-starling': 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Starling_Bank_Logo.png',
            'starling': 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Starling_Bank_Logo.png',
            'starling bank': 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Starling_Bank_Logo.png',
            'ob-revolut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSniinv2w7NpY0MolekyzxIkf_JMXRgz29w-A&s',
            'revolut': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSniinv2w7NpY0MolekyzxIkf_JMXRgz29w-A&s',
            'ob-chase': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDnutej6BLaFcdWo53jMYVP1NL2rhdMI4-iQ&s',
            'chase': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDnutej6BLaFcdWo53jMYVP1NL2rhdMI4-iQ&s',
            'chase uk': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQDnutej6BLaFcdWo53jMYVP1NL2rhdMI4-iQ&s',
            'ob-tide': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnYAN0m6Nw6v4vrf_P17bXALc7NdnRnWU2wQ&s',
            'tide': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRnYAN0m6Nw6v4vrf_P17bXALc7NdnRnWU2wQ&s',
            'ob-curve': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwMpHQa1OrmCghoFn6ReBgRsPScG_GOYHCmw&s',
            'curve': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTwMpHQa1OrmCghoFn6ReBgRsPScG_GOYHCmw&s',
            'ob-clearbank': 'https://www.deloitte.co.uk/fast50/assets/img/logos-winners/2021/clearbank-logo.jpg',
            'clearbank': 'https://www.deloitte.co.uk/fast50/assets/img/logos-winners/2021/clearbank-logo.jpg'
        };
        
        const logoUrl = bankLogos[providerId?.toLowerCase()] || bankLogos[providerName?.toLowerCase()];
        
        if (logoUrl) {
            return `<img src="${logoUrl}" alt="${providerName}" class="bank-logo" onerror="this.style.display='none'">`;
        }
        return '';
    }
    
    getCurrencyFlag(currency) {
        // Map currency codes to country flags (using actual Unicode emoji characters)
        const currencyFlags = {
            'GBP': '🇬🇧',
            'EUR': '🇪🇺',
            'USD': '🇺🇸',
            'CHF': '🇨🇭',
            'JPY': '🇯🇵',
            'CAD': '🇨🇦',
            'AUD': '🇦🇺',
            'NZD': '🇳🇿',
            'SGD': '🇸🇬',
            'HKD': '🇭🇰',
            'SEK': '🇸🇪',
            'NOK': '🇳🇴',
            'DKK': '🇩🇰',
            'PLN': '🇵🇱',
            'CZK': '🇨🇿',
            'HUF': '🇭🇺',
            'RON': '🇷🇴'
        };
        return currencyFlags[currency] || '💱';
    }
    
    deduplicateTransactions(transactions) {
        // Remove duplicate transactions that occur when the same statement is uploaded multiple times
        // When a PDF is uploaded twice, Thirdfort OCR assigns different transaction IDs to each instance
        // So we match on: timestamp (date only), amount, description, account_id, category
        // We DON'T use tx.id or tx.reference as these are system-generated per upload
        const seen = new Map();
        const unique = [];
        
        for (const tx of transactions) {
            // Normalize the timestamp to date only (ignore time/milliseconds)
            // This catches duplicates even if OCR processing times differ slightly
            const dateOnly = tx.timestamp ? new Date(tx.timestamp).toISOString().split('T')[0] : '';
            
            // Normalize description (trim, collapse whitespace, lowercase for comparison)
            const normalizedDesc = (tx.description || tx.merchant_name || '').trim().replace(/\s+/g, ' ').toLowerCase();
            
            // Create a unique key based on actual transaction properties
            // This will catch true duplicates from same statement uploaded twice
            const key = [
                dateOnly,               // Date only (YYYY-MM-DD) - allows same-day recurring payments to still be unique by time
                tx.amount,              // Exact amount
                normalizedDesc,         // Normalized description
                tx.account_id || '',    // Account ID
                tx.currency || 'GBP',   // Currency
                tx.category || '',      // Transaction category (DD, SO, DEBIT, CREDIT, etc.)
                tx.type || ''           // Transaction type (DEBIT/CREDIT)
            ].join('|');
            
            if (!seen.has(key)) {
                seen.set(key, true);
                unique.push(tx);
            }
        }
        
        return unique;
    }
    
    deduplicateAccountsData(accounts) {
        // Deep clone and deduplicate all transactions within all accounts
        // This ensures all downstream analysis uses clean data
        const deduplicatedAccounts = {};
        
        for (const [accountId, accountData] of Object.entries(accounts)) {
            // Clone the account data
            deduplicatedAccounts[accountId] = JSON.parse(JSON.stringify(accountData));
            
            // Deduplicate the statement array
            if (deduplicatedAccounts[accountId].statement) {
                deduplicatedAccounts[accountId].statement = this.deduplicateTransactions(deduplicatedAccounts[accountId].statement);
            }
        }
        
        return deduplicatedAccounts;
    }
    
    createBankAccountCard(accountId, accountData, isManualUpload = false, check = null) {
        // Handle both possible data structures - nested 'info' or direct properties
        const info = accountData.info || accountData;
        const number = info.number || {};
        const balance = info.balance || {};
        const provider = info.provider || {};
        const accountName = info.name || 'Bank Account';
        const accountType = info.type || 'TRANSACTION';
        const currency = info.currency || balance.currency || 'GBP';
        const statement = accountData.statement || [];
        
        // Check if this account has been reviewed in SOF annotations
        let isReviewed = false;
        if (check && check.sofAnnotations) {
            isReviewed = check.sofAnnotations.some(ann => {
                const accounts = ann.notes?.accounts || [];
                return accounts.some(acc => acc.accountId === accountId && acc.reviewed);
            });
        }
        
        // Deduplicate transactions ONLY for manual uploads (PDF statements)
        // Open Banking linking won't have duplicates
        const deduplicatedStatement = isManualUpload ? this.deduplicateTransactions(statement) : statement;
        
        // Calculate transaction annotation counts for badges
        let linkedCount = 0;
        let reviewCount = 0;
        let flaggedCount = 0;
        
        if (check) {
            deduplicatedStatement.forEach(tx => {
                const txAnnotations = this.getTransactionAnnotations(tx.id, check);
                
                if (txAnnotations.linkedFundingMethods.length > 0) linkedCount++;
                if (txAnnotations.flag === 'review') reviewCount++;
                if (txAnnotations.flag === 'suspicious') flaggedCount++;
            });
        }
        
        // Get account number details
        const accountNumber = number.number || 'N/A';
        const sortCode = number.sort_code || 'N/A';
        const iban = number.iban || '';
        const swiftBic = number.swift_bic || '';
        
        // Get account holder details (from nested info array)
        let accountHolderName = '';
        if (Array.isArray(info.info) && info.info.length > 0) {
            accountHolderName = info.info[0].full_name || '';
        }
        
        // Get balance amounts
        const availableBalance = balance.available || 0;
        const currentBalance = balance.current || 0;
        const overdraft = balance.overdraft || 0;
        
        // Transaction count (after deduplication)
        const txCount = deduplicatedStatement.length;
        
        // Get bank logo
        const bankLogo = this.getBankLogo(provider.id, provider.name);
        
        // Get currency flag
        const currencyFlag = this.getCurrencyFlag(currency);
        
        // Store the full data in a data attribute for the lightbox
        const accountDataJson = JSON.stringify({accountId, accountData}).replace(/"/g, '&quot;');
        
        // Format the collapsed text based on whether we have a logo
        let collapsedTextHtml;
        if (bankLogo) {
            collapsedTextHtml = `<span class="account-name-text">${accountName}</span>${accountHolderName ? ` - <span class="account-holder-text">${accountHolderName}</span>` : ''}`;
        } else {
            const prefix = `${provider.name || 'Bank'} - `;
            collapsedTextHtml = `<span class="account-name-text">${prefix}${accountName}</span>${accountHolderName ? ` - <span class="account-holder-text">${accountHolderName}</span>` : ''}`;
        }
        
        // Build account summary badges
        let accountBadgesHtml = '';
        
        if (isReviewed) {
            accountBadgesHtml += `<span class="account-tag reviewed">✓ Reviewed</span>`;
        }
        if (linkedCount > 0) {
            accountBadgesHtml += `<span class="account-tag linked">${linkedCount} transaction${linkedCount > 1 ? 's' : ''} linked</span>`;
        }
        if (reviewCount > 0) {
            accountBadgesHtml += `<span class="account-tag review">${reviewCount} review pending</span>`;
        }
        if (flaggedCount > 0) {
            accountBadgesHtml += `<span class="account-tag flagged">${flaggedCount} flagged</span>`;
        }
        
        const badgesContainer = accountBadgesHtml ? `<div class="account-summary-tags" style="margin-top: 4px;">${accountBadgesHtml}</div>` : '';
        
        return `
            <div class="bank-account-card collapsed" data-account-data="${accountDataJson}" data-is-manual-upload="${isManualUpload}" onclick="event.stopPropagation();">
                <!-- Collapsed/Minimized Header -->
                <div class="account-collapsed-header" onclick="event.stopPropagation(); this.closest('.bank-account-card').classList.toggle('collapsed');">
                    <div class="account-header-left">
                        ${bankLogo ? bankLogo : ''}
                        <div style="display: flex; flex-direction: column; flex: 1;">
                        <span class="account-collapsed-text">${collapsedTextHtml}</span>
                            ${badgesContainer}
                        </div>
                    </div>
                    ${txCount > 0 ? `
                        <button class="view-statement-mini-btn" onclick="event.stopPropagation(); window.thirdfortManager.showBankStatement('${accountId}', this.closest('.bank-account-card').dataset.accountData, this.closest('.bank-account-card').dataset.isManualUpload === 'true');">
                            View transactions
                        </button>
                    ` : ''}
                </div>
                
                <!-- Expanded Details -->
                <div class="account-expanded-details">
                    <div class="account-expanded-columns">
                        <div class="account-details-column">
                            <div class="account-detail-row">
                                <span class="account-detail-label">Sort Code:</span>
                                <span class="account-detail-value">${sortCode}</span>
                            </div>
                            <div class="account-detail-row">
                                <span class="account-detail-label">Account:</span>
                                <span class="account-detail-value">${accountNumber}</span>
                            </div>
                            ${iban ? `
                                <div class="account-detail-row">
                                    <span class="account-detail-label">IBAN:</span>
                                    <span class="account-detail-value">${iban}</span>
                                </div>
                            ` : ''}
                            ${swiftBic ? `
                                <div class="account-detail-row">
                                    <span class="account-detail-label">SWIFT:</span>
                                    <span class="account-detail-value">${swiftBic}</span>
                                </div>
                            ` : ''}
                            <div class="account-detail-row">
                                <span class="account-detail-label">Currency:</span>
                                <span class="account-detail-value">${currencyFlag} ${currency}</span>
                            </div>
                        </div>
                        
                        <div class="account-balance-column">
                            <div class="balance-compact-card">
                                <div class="balance-compact-title">Balance</div>
                                <div class="balance-compact-item">
                                    <span class="balance-compact-label">Available:</span>
                                    <span class="balance-compact-value">${currency} ${availableBalance.toFixed(2)}</span>
                                </div>
                                <div class="balance-compact-item">
                                    <span class="balance-compact-label">Current:</span>
                                    <span class="balance-compact-value">${currency} ${currentBalance.toFixed(2)}</span>
                                </div>
                                <div class="balance-compact-item">
                                    <span class="balance-compact-label">Overdraft:</span>
                                    <span class="balance-compact-value">${overdraft > 0 ? `${currency} ${overdraft.toFixed(2)}` : 'None'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    showBankStatement(accountId, accountDataStr, isManualUpload = false) {
        // Parse the account data
        const data = JSON.parse(accountDataStr.replace(/&quot;/g, '"'));
        const accountData = data.accountData;
        const statement = accountData.statement || accountData.transactions || [];
        const info = accountData.info || accountData;
        const number = info.number || {};
        const balance = info.balance || {};
        const provider = info.provider || {};
        const accountName = info.name || 'Bank Account';
        const currency = info.currency || 'GBP';
        const currencyFlag = this.getCurrencyFlag(currency);
        const currencySymbol = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
        
        // Get bank logo and brand colors
        const bankLogo = this.getBankLogo(provider.id, provider.name);
        const brandColors = this.getBankBrandColors(provider.id, provider.name);
        
        // Get transaction annotations from current check using comprehensive helper
        const check = this.currentCheck;
        const transactionFlags = {};
        const transactionNotes = {};
        const transactionLinks = {};
        
        if (check) {
            // Use getTransactionAnnotations which checks ALL sources:
            // - Direct transaction links
            // - Funding method markers
            // - Bank analysis items (chains, repeating groups)
            statement.forEach(tx => {
                const txAnnotations = this.getTransactionAnnotations(tx.id, check);
                if (txAnnotations.flag) transactionFlags[tx.id] = txAnnotations.flag;
                if (txAnnotations.note) transactionNotes[tx.id] = txAnnotations.note;
                if (txAnnotations.linkedFundingMethods.length > 0) {
                    transactionLinks[tx.id] = txAnnotations.linkedFundingMethods;
                }
            });
        }
        
        // DEDUPLICATE transactions ONLY for manual uploads (same PDF statement uploaded multiple times)
        // Bank linking via Open Banking API won't have duplicates
        const deduplicatedStatement = isManualUpload ? this.deduplicateTransactions(statement) : statement;
        
        // Sort transactions by timestamp (oldest first for running balance calculation)
        const sortedTransactions = [...deduplicatedStatement].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        // Calculate running balances if not provided
        let runningBalance = balance.current || 0;
        if (sortedTransactions.length > 0) {
            // Work backwards from current balance
            for (let i = sortedTransactions.length - 1; i >= 0; i--) {
                if (!sortedTransactions[i].running_balance) {
                    sortedTransactions[i].running_balance = runningBalance;
                }
                runningBalance -= sortedTransactions[i].amount;
            }
        }
        
        // Reverse for display (newest first)
        sortedTransactions.reverse();
        
        // Build transactions HTML - modern statement style
        let transactionsHtml = '';
        sortedTransactions.forEach((tx, index) => {
            const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
            const description = tx.description || tx.merchant_name || 'Transaction';
            const isDebit = tx.amount < 0;
            const amountOut = isDebit ? Math.abs(tx.amount).toFixed(2) : '';
            const amountIn = !isDebit ? tx.amount.toFixed(2) : '';
            const runningBal = tx.running_balance ? tx.running_balance.toFixed(2) : '—';
            const amountClass = isDebit ? 'negative' : 'positive';
            
            // Check for annotations on this transaction
            const hasFlag = transactionFlags[tx.id];
            const hasNote = transactionNotes[tx.id];
            const hasLinks = transactionLinks[tx.id];
            const hasAnnotations = hasFlag || hasNote || hasLinks;
            
            // Build annotation badges
            let annotationBadges = '';
            if (hasFlag) {
                let flagIcon = '';
                let flagClass = '';
                if (hasFlag === 'linked') {
                    flagIcon = '<svg viewBox="0 0 300 300" style="width: 12px; height: 12px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                    flagClass = 'linked';
                } else if (hasFlag === 'suspicious') {
                    flagIcon = '<svg viewBox="0 0 300 300" style="width: 12px; height: 12px;"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
                    flagClass = 'suspicious';
                } else if (hasFlag === 'review') {
                    flagIcon = '<svg viewBox="0 0 300 300" style="width: 12px; height: 12px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                    flagClass = 'review';
                } else if (hasFlag === 'cleared') {
                    flagIcon = '<svg viewBox="0 0 300 300" style="width: 12px; height: 12px;"><path fill="#1976d2" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><circle cx="150" cy="150" r="50" fill="none" stroke="#ffffff" stroke-width="20"/></svg>';
                    flagClass = 'cleared';
                }
                annotationBadges += `<span class="statement-tx-badge ${flagClass}">${flagIcon}</span>`;
            }
            if (hasNote) {
                annotationBadges += '<span class="statement-tx-badge note" title="Has investigation note"><svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></span>';
            }
            if (hasLinks) {
                annotationBadges += '<span class="statement-tx-badge link" title="Linked to funding method"><svg viewBox="0 0 24 24" style="width: 12px; height: 12px;"><path fill="currentColor" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg></span>';
            }
            
            const highlightClass = hasAnnotations ? ' has-annotations' : '';
            
            // Build expanded details section
            let expandedDetailsHtml = '';
            if (hasAnnotations) {
                expandedDetailsHtml = '<div class="statement-tx-expanded" onclick="event.stopPropagation();">';
                
                // Show linked funding methods
                if (hasLinks && hasLinks.length > 0) {
                    const sofTask = check.taskOutcomes?.['sof:v1'];
                    const funds = sofTask?.breakdown?.funds || [];
                    
                    expandedDetailsHtml += '<div class="tx-expanded-section">';
                    expandedDetailsHtml += '<strong>Linked to Funding Methods:</strong>';
                    expandedDetailsHtml += '<div style="margin-top: 4px;">';
                    
                    hasLinks.forEach(fundIdxStr => {
                        const fund = funds[parseInt(fundIdxStr)];
                        if (fund) {
                            const fundType = fund.type || '';
                            const fundAmount = fund.data?.amount ? `£${(fund.data.amount / 100).toLocaleString()}` : '';
                            const fundLabel = fundType.replace('fund:', '').replace(/[-:_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            expandedDetailsHtml += `<div class="tx-linked-fund-item" style="padding: 4px 8px; background: #e3f2fd; border-radius: 3px; margin-bottom: 4px;">
                                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"><path fill="#1976d2" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                                ${fundLabel} ${fundAmount}
                            </div>`;
                        }
                    });
                    
                    expandedDetailsHtml += '</div></div>';
                }
                
                // Show status/flag
                if (hasFlag) {
                    expandedDetailsHtml += '<div class="tx-expanded-section">';
                    expandedDetailsHtml += '<strong>Status:</strong> ';
                    
                    let statusText = hasFlag.charAt(0).toUpperCase() + hasFlag.slice(1);
                    let statusColor = hasFlag === 'linked' || hasFlag === 'cleared' ? '#4caf50' : 
                                     hasFlag === 'suspicious' ? '#f44336' : '#ff9800';
                    
                    expandedDetailsHtml += `<span style="color: ${statusColor}; font-weight: 600;">${statusText}</span>`;
                    expandedDetailsHtml += '</div>';
                }
                
                // Show note
                if (hasNote) {
                    expandedDetailsHtml += '<div class="tx-expanded-section">';
                    expandedDetailsHtml += '<strong>Investigation Note:</strong>';
                    expandedDetailsHtml += `<div style="margin-top: 4px; padding: 8px; background: #fff3e0; border-radius: 3px; font-style: italic; color: #666;">
                        ${hasNote}
                    </div>`;
                    expandedDetailsHtml += '</div>';
                }
                
                expandedDetailsHtml += '</div>';
            }
            
            transactionsHtml += `
                <div class="statement-transaction-row ${amountClass}${highlightClass}" onclick="event.stopPropagation(); this.classList.toggle('expanded');" style="cursor: ${hasAnnotations ? 'pointer' : 'default'};">
                    <div class="statement-tx-date">${date}</div>
                    <div class="statement-tx-description">
                        ${description}
                        ${annotationBadges ? `<span class="statement-tx-badges">${annotationBadges}</span>` : ''}
                    </div>
                    <div class="statement-tx-out">${amountOut ? currencySymbol + amountOut : '—'}</div>
                    <div class="statement-tx-in">${amountIn ? currencySymbol + amountIn : '—'}</div>
                    <div class="statement-tx-balance">${currencySymbol}${runningBal}</div>
                </div>
                ${expandedDetailsHtml}
            `;
        });
        
        // Create modern bank statement overlay
        const lightbox = document.createElement('div');
        lightbox.className = 'bank-statement-lightbox';
        lightbox.innerHTML = `
            <div class="lightbox-overlay" onclick="this.parentElement.remove()"></div>
            <div class="statement-container">
                <div class="statement-header-modern" style="background: linear-gradient(135deg, ${brandColors.from} 0%, ${brandColors.to} 100%);">
                    <div class="statement-header-top">
                        ${bankLogo ? `<div class="statement-bank-logo">${bankLogo}</div>` : ''}
                        <div class="statement-header-info">
                            <h2 class="statement-account-name">${accountName}</h2>
                            <div class="statement-provider">${provider.name || 'Bank'}</div>
                        </div>
                        <button class="statement-close-btn" onclick="this.closest('.bank-statement-lightbox').remove()">×</button>
                    </div>
                    <div class="statement-account-details">
                        ${number.sort_code ? `<span>Sort Code: ${number.sort_code}</span>` : ''}
                        ${number.number ? `<span>Account: ${number.number}</span>` : ''}
                        ${number.iban ? `<span>IBAN: ${number.iban}</span>` : ''}
                        <span>${currencyFlag} ${currency}</span>
                    </div>
                    <div class="statement-balance-summary">
                        <div class="balance-summary-item">
                            <span class="balance-summary-label">Current Balance</span>
                            <span class="balance-summary-amount">${currencySymbol}${(balance.current || 0).toFixed(2)}</span>
                        </div>
                        <div class="balance-summary-item">
                            <span class="balance-summary-label">Available</span>
                            <span class="balance-summary-amount">${currencySymbol}${(balance.available || 0).toFixed(2)}</span>
                        </div>
                        ${balance.overdraft && balance.overdraft > 0 ? `
                            <div class="balance-summary-item">
                                <span class="balance-summary-label">Overdraft Limit</span>
                                <span class="balance-summary-amount">${currencySymbol}${balance.overdraft.toFixed(2)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="statement-transactions-list">
                    <div class="statement-list-header">
                        <h3>Transactions</h3>
                        <span class="transaction-count">${sortedTransactions.length} transaction${sortedTransactions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div class="statement-column-headers">
                        <div class="header-date">Date</div>
                        <div class="header-description">Description</div>
                        <div class="header-out">Amount Out</div>
                        <div class="header-in">Amount In</div>
                        <div class="header-balance">Balance</div>
                    </div>
                    ${transactionsHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(lightbox);
    }
    
    buildFundingDetailContent(fund, { originBadge = '' } = {}) {
        if (!fund) return '';
        const type = fund.type || 'unknown';
        const data = fund.data || {};
        const htmlParts = [];
        const renderIncomeRow = (label, value, { allowEmpty = false } = {}) => {
            if (!value && !allowEmpty) return '';
            const display = value || 'Not provided';
            return `<div class="income-card-row"><span class="income-label">${label}</span><span class="income-value">${display}</span></div>`;
        };
        const renderIncomeCards = (incomes = [], sizeClass = 'full') => {
            if (!Array.isArray(incomes) || incomes.length === 0) return '';
            return incomes.map(income => {
                if (!income) return '';
                const isSalary = (income.source || '').toLowerCase() === 'salary';
                const title = isSalary ? 'Salary' : (income.description || income.source || 'Other Income');
                const frequency = this.formatFundingFrequency(income.frequency);
                const amount = this.formatCurrencyMinor(income.annual_total, { fallback: 'Not provided' });
                const reference = income.reference ? income.reference : '';
                const description = income.description ? income.description : '';
                let rows = '';
                if (isSalary) {
                    rows += renderIncomeRow('Pay Cycle', frequency, { allowEmpty: true });
                    rows += renderIncomeRow('Payment Ref', reference, { allowEmpty: true });
                    rows += renderIncomeRow('Annual Amount', amount, { allowEmpty: true });
                } else {
                    rows += renderIncomeRow('Pay Cycle', frequency, { allowEmpty: true });
                    rows += renderIncomeRow('Annual Amount', amount, { allowEmpty: true });
                    if (reference) {
                        rows += renderIncomeRow('Reference', reference);
                    }
                }
                // Determine income card width based on person card width and number of incomes
                let incomeCardClass = '';
                if (sizeClass === 'full') {
                    // Full width person card: 2 incomes = 50/50, 1 income = 100%
                    incomeCardClass = incomes.length === 2 ? 'half' : 'full';
                } else {
                    // Half width person card: incomes are stacked (full width each)
                    incomeCardClass = 'full';
                }
                return `
                    <div class="income-card ${isSalary ? 'salary' : 'other'} ${incomeCardClass}">
                        <div class="income-card-title">${title}</div>
                        ${rows}
                    </div>
                `;
            }).join('');
        };
        const renderSavingsPerson = (person, { isPrimary = false, sizeClass = 'full' } = {}) => {
            if (!person) return '';
            const role = person.actor ? 'Primary Applicant' : 'Joint Contributor';
            let status = '';
            if (person.employment_status) {
                const statusRaw = String(person.employment_status).toLowerCase();
                if (statusRaw === 'independent' || statusRaw === 'independant') {
                    status = 'Self-Employed';
                } else {
                    status = this.formatFundingLabel(person.employment_status);
                }
            }
            const contactPhone = person.phone || '';
            const contactEmail = person.email || '';
            const personOriginBadge = this.getFundingOriginBadge(person.location);
            let meta = '';
            if (status) meta += this.renderMetaRow('Status', status, { className: 'compact' });
            if (personOriginBadge) {
                meta += this.renderMetaRow('Location', personOriginBadge, { raw: true, className: 'compact' });
            }
            if (contactPhone) meta += this.renderMetaRow('Phone', contactPhone, { className: 'compact' });
            if (contactEmail) meta += this.renderMetaRow('Email', contactEmail, { className: 'compact' });
            const incomeCards = renderIncomeCards(person.incomes, sizeClass);
            const cardClasses = ['funding-person-card', sizeClass];
            if (isPrimary) cardClasses.push('primary');
            return `
                <div class="${cardClasses.join(' ')}">
                    <div class="funding-person-header">
                        <div class="funding-person-name">${person.name || 'Unknown Person'}</div>
                        <div class="funding-person-role">${role}</div>
                    </div>
                    ${meta}
                    ${incomeCards ? `<div class="income-card-list">${incomeCards}</div>` : ''}
                </div>
            `;
        };

        switch (type) {
            case 'fund:mortgage': {
                const lenderName = data.lender ? this.formatFundingLabel(data.lender) : '';
                const displayLender = lenderName || data.lender || '';
                const bankLogo = data.lender ? this.getBankLogo(data.lender, displayLender || data.lender) : '';
                if (displayLender || bankLogo) {
                    htmlParts.push(`
                        <div class="funding-bank-card">
                            ${bankLogo ? `<div class="funding-bank-logo">${bankLogo}</div>` : ''}
                            <div class="funding-bank-copy">
                                <div class="funding-bank-label">Mortgage Lender</div>
                                <div class="funding-bank-name">${displayLender || 'Not provided'}</div>
                            </div>
                        </div>
                    `);
                }
                if (data.mortgage_type) {
                    htmlParts.push(this.renderMetaRow('Product', this.formatFundingLabel(data.mortgage_type)));
                }
                if (data.account_name) {
                    htmlParts.push(this.renderMetaRow('Account Name', data.account_name));
                }
                if (data.reference) {
                    htmlParts.push(this.renderMetaRow('Reference', data.reference));
                }
                break;
            }
            case 'fund:htb':
            case 'fund:htb_lisa': {
                if (data.account_name) {
                    htmlParts.push(this.renderMetaRow('Account Name', data.account_name));
                }
                if (data.provider) {
                    htmlParts.push(this.renderMetaRow('Provider', this.formatFundingLabel(data.provider)));
                }
                if (data.reference) {
                    htmlParts.push(this.renderMetaRow('Reference', data.reference));
                }
                break;
            }
            case 'fund:savings': {
                htmlParts.push('<div class="funding-section-heading">Contributors</div>');
                if (Array.isArray(data.people) && data.people.length > 0) {
                    // Determine layout based on number of people
                    const peopleCount = data.people.length;
                    let peopleCards = '';
                    
                    if (peopleCount === 1) {
                        // 1 person: full width
                        peopleCards = renderSavingsPerson(data.people[0], { isPrimary: true, sizeClass: 'full' });
                    } else if (peopleCount === 2) {
                        // 2 people: 50/50
                        peopleCards = data.people.map((person, idx) => 
                            renderSavingsPerson(person, { isPrimary: idx === 0, sizeClass: 'half' })
                        ).join('');
                    } else {
                        // 3+ people: primary full width, others 50/50 below
                        peopleCards = renderSavingsPerson(data.people[0], { isPrimary: true, sizeClass: 'full' });
                        if (peopleCount > 1) {
                            const others = data.people.slice(1);
                            others.forEach((person, idx) => {
                                peopleCards += renderSavingsPerson(person, { isPrimary: false, sizeClass: 'half' });
                            });
                        }
                    }
                    
                    htmlParts.push(`<div class="funding-people-list">${peopleCards}</div>`);
                } else {
                    htmlParts.push('<div class="funding-meta-empty">No contributor details provided.</div>');
                }
                break;
            }
            case 'fund:gift': {
                const giftor = data.giftor || {};
                const cardTitle = giftor.name || 'Giftor';
                let detailRows = '';
                if (giftor.relationship) {
                    detailRows += this.renderMetaRow('Relationship', this.formatFundingLabel(giftor.relationship), { className: 'compact' });
                }
                if (typeof giftor.contactable === 'boolean') {
                    detailRows += this.renderMetaRow('Contactable', giftor.contactable ? 'Yes' : 'No', { className: 'compact' });
                }
                if (typeof data.repayable === 'boolean') {
                    detailRows += this.renderMetaRow('Repayable', data.repayable ? 'Yes' : 'No', { className: 'compact' });
                }
                if (giftor.phone) {
                    detailRows += this.renderMetaRow('Phone', giftor.phone, { className: 'compact' });
                }
                if (giftor.email) {
                    detailRows += this.renderMetaRow('Email', giftor.email, { className: 'compact' });
                }
                if (!detailRows) {
                    detailRows = '<div class="funding-meta-empty">No additional giftor details recorded.</div>';
                }
                // Add consider message for giftor checks
                const considerIcon = this.getTaskCheckIcon('CO');
                const giftorCheckMessage = '<div class="giftor-check-message" style="margin-top: 12px; padding: 10px; background: #fff8e6; border: 1px solid #ffd966; border-radius: 6px; display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #856404;">' +
                    considerIcon +
                    '<span>Ensure the gifter undergoes their own AML, ID and SoF/SoW Checks</span>' +
                    '</div>';
                htmlParts.push(`
                    <div class="funding-detail-card">
                        <div class="funding-detail-card-title">${cardTitle}</div>
                        ${detailRows}
                        ${giftorCheckMessage}
                    </div>
                `);
                break;
            }
            case 'fund:sale:property':
            case 'fund:property_sale': {
                const completion = this.formatShortDate(data.date);
                if (completion) {
                    htmlParts.push(this.renderMetaRow('Completion Date', completion));
                }
                if (data.status) {
                    htmlParts.push(this.renderMetaRow('Status', this.formatFundingLabel(data.status)));
                }
                if (data.lawyer || data.conveyancer) {
                    htmlParts.push(this.renderMetaRow('Conveyancer', data.lawyer || data.conveyancer));
                }
                if (data.property) {
                    htmlParts.push(this.renderMetaRow('Property', data.property));
                }
                break;
            }
            case 'fund:sale:assets':
            case 'fund:asset_sale': {
                if (data.description) {
                    htmlParts.push(this.renderMetaRow('Asset Description', data.description));
                }
                if (data.status) {
                    htmlParts.push(this.renderMetaRow('Status', this.formatFundingLabel(data.status)));
                }
                break;
            }
            case 'fund:inheritance': {
                if (data.from) {
                    htmlParts.push(this.renderMetaRow('Inherited From', data.from));
                }
                const inheritDate = this.formatShortDate(data.date || data.received_at);
                if (inheritDate) {
                    htmlParts.push(this.renderMetaRow('Inherited On', inheritDate));
                }
                if (data.account_name) {
                    htmlParts.push(this.renderMetaRow('Account Name', data.account_name));
                }
                if (typeof data.is_owner === 'boolean') {
                    htmlParts.push(this.renderMetaRow('Beneficiary', data.is_owner ? 'Applicant' : 'Third Party'));
                }
                break;
            }
            case 'fund:divorce': {
                if (data.account_name) {
                    htmlParts.push(this.renderMetaRow('Account Name', data.account_name));
                }
                if (data.lawyer) {
                    htmlParts.push(this.renderMetaRow('Conveyancer/Lawyer', data.lawyer));
                }
                const settlementDate = this.formatShortDate(data.settlement_date || data.date);
                if (settlementDate) {
                    htmlParts.push(this.renderMetaRow('Settlement Date', settlementDate));
                }
                if (typeof data.is_owner === 'boolean') {
                    htmlParts.push(this.renderMetaRow('Beneficiary', data.is_owner ? 'Applicant' : 'Third Party'));
                }
                break;
            }
            case 'fund:cryptocurrency': {
                if (data.description) {
                    htmlParts.push(this.renderMetaRow('Asset', data.description));
                }
                if (data.exchange) {
                    htmlParts.push(this.renderMetaRow('Exchange', this.formatFundingLabel(data.exchange)));
                }
                if (data.wallet_provider) {
                    htmlParts.push(this.renderMetaRow('Wallet Provider', this.formatFundingLabel(data.wallet_provider)));
                }
                break;
            }
            default: {
                const handledKeys = new Set(['amount', 'location', 'people', 'giftor', 'metadata']);
                let hasDetails = false;
                Object.entries(data || {}).forEach(([key, value]) => {
                    if (handledKeys.has(key)) return;
                    if (value === undefined || value === null) return;
                    if (typeof value === 'object') return;
                    const label = this.formatFundingLabel(key.replace(/[:_]/g, ' ')) || this.formatFundingLabel(key);
                    htmlParts.push(this.renderMetaRow(label || this.formatFundingLabel(key), value));
                    hasDetails = true;
                });
                if (!hasDetails) {
                    htmlParts.push('<div class="funding-meta-empty">No additional funding details provided.</div>');
                }
                break;
            }
        }
        return htmlParts.filter(Boolean).join('');
    }
    
    createFundingSourceCard(fund, check, index, sofMatches = {}, accounts = {}) {
        const type = fund.type || 'unknown';
        const data = fund.data || {};
        const amount = data.amount ? `£${(data.amount / 100).toLocaleString()}` : 'Not specified';
        const originBadge = this.getFundingOriginBadge(data.location);
        
        // Get matched bank transactions for this funding type
        // Map all possible funding types to their SOF match keys
        const fundTypeMap = {
            // Standard mappings
            'fund:gift': ['gift', 'gift_transactions'],
            'fund:mortgage': ['mortgage', 'mortgage_transactions'],
            'fund:savings': ['savings', 'savings_transactions', 'salary_transactions'],
            'fund:property_sale': ['property_sale', 'property_sale_transactions'],
            'fund:sale:property': ['property_sale', 'property_sale_transactions'],
            'fund:asset_sale': ['asset_sale', 'asset_sale_transactions'],
            'fund:sale:assets': ['asset_sale', 'asset_sale_transactions'],
            'fund:htb': ['htb_lisa', 'htb_transactions', 'htb_lisa_transactions'],
            'fund:htb_lisa': ['htb_lisa', 'htb_transactions', 'htb_lisa_transactions'],
            'fund:inheritance': ['inheritance', 'inheritance_transactions'],
            'fund:income': ['salary_transactions', 'income_transactions'],
            'fund:loan': ['loan', 'loan_transactions'],
            'fund:investment': ['investment', 'investment_transactions'],
            'fund:business': ['business', 'business_transactions'],
            'fund:other': ['other', 'other_transactions']
        };
        
        // For savings with people/incomes data, prioritize salary_transactions
        let matchKeys = fundTypeMap[type] || [];
        if (type === 'fund:savings' && data.people && data.people.some(p => p.incomes && p.incomes.length > 0)) {
            matchKeys = ['salary_transactions', ...matchKeys];  // Prioritize salary for income-based savings
        }
        
        // Try all possible match keys and combine results
        let matchedTxIds = [];
        for (const key of matchKeys) {
            if (sofMatches[key] && Array.isArray(sofMatches[key])) {
                matchedTxIds = [...matchedTxIds, ...sofMatches[key]];
            }
        }
        
        // Add user-linked transactions from SOF annotations
        if (check) {
            const sofAnnotations = check.sofAnnotations || [];
            sofAnnotations.forEach(ann => {
                const transactions = ann.notes?.transactions || [];
                transactions.forEach(tx => {
                    if (tx.linkedToFunds && tx.linkedToFunds.includes(index.toString())) {
                        matchedTxIds.push(tx.txId);
                    }
                });
            });
        }
        
        // Collect bank analysis items (repeating groups, chains) linked to this funding method
        const linkedBankAnalysisItems = [];
        if (check) {
            const sofAnnotations = check.sofAnnotations || [];
            sofAnnotations.forEach(ann => {
                const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                bankAnalysisItems.forEach(item => {
                    if (item.linkedToFundIdx === index.toString()) {
                        linkedBankAnalysisItems.push({
                            ...item,
                            userName: ann.userName || ann.user,
                            timestamp: ann.timestamp
                        });
                        
                        // Also add the individual transactions from this item to the matched list
                        if (item.type === 'transaction' && item.transactionId) {
                            matchedTxIds.push(item.transactionId);
                        } else if (item.type === 'chain' && item.chainId) {
                            // Chain IDs are composite of transaction IDs separated by |
                            const chainTxIds = item.chainId.split('|');
                            matchedTxIds.push(...chainTxIds);
                        } else if (item.type === 'repeating-group' && item.groupIndex !== undefined) {
                            // Get all transactions in this repeating group
                            const taskOutcomes = check.taskOutcomes || {};
                            const bankStatement = taskOutcomes['bank:statement'];
                            const bankSummary = taskOutcomes['bank:summary'];
                            const docsBankStatement = taskOutcomes['documents:bank-statement'];
                            const analysis = bankStatement?.breakdown?.analysis || 
                                           bankSummary?.breakdown?.analysis || 
                                           docsBankStatement?.breakdown?.analysis;
                            
                            if (analysis && analysis.repeating_transactions) {
                                const group = analysis.repeating_transactions[item.groupIndex];
                                if (group && group.items) {
                                    matchedTxIds.push(...group.items);
                                }
                            }
                        }
                    }
                });
            });
        }
        
        // Remove duplicates
        matchedTxIds = [...new Set(matchedTxIds)];
        
        // Map funding type to display name (handle fund: prefix) - needed for cleanType later
        const cleanType = type.replace('fund:', '').replace(/:/g, '-');
        
        // Build matched transactions HTML
        const hasMatches = matchedTxIds.length > 0;
        let matchedTxHtml = '';
        const labelMap = {
            'fund:gift': 'Potential Gift Deposits',
            'fund:mortgage': 'Potential Mortgage Deposits',
            'fund:savings': 'Verified Salary Deposits',
            'fund:income': 'Verified Salary Deposits',
            'fund:property_sale': 'Potential Property Sale Proceeds',
            'fund:sale:property': 'Potential Property Sale Proceeds',
            'fund:asset_sale': 'Potential Asset Sale Proceeds',
            'fund:sale:assets': 'Potential Asset Sale Proceeds',
            'fund:htb': 'Potential Lifetime ISA Deposits',
            'fund:htb_lisa': 'Potential Lifetime ISA Deposits',
            'fund:inheritance': 'Potential Inheritance Deposits',
            'fund:loan': 'Potential Loan Deposits',
            'fund:investment': 'Potential Investment Deposits',
            'fund:business': 'Potential Business Income',
            'fund:other': 'Potential Matched Transactions'
        };
        const matchLabel = labelMap[type] || 'Potential Matched Transactions';

        // Determine label based on funding type
        if (hasMatches) {
            matchedTxHtml = `<div class="funding-matched-section"><div class="funding-matched-header">${matchLabel} (${matchedTxIds.length})</div><div class="funding-matched-list">`;
            // Get transaction markers, notes, and links from ALL sources using comprehensive function
            const transactionMarkers = {};
            const transactionNotes = {};
            const transactionFlags = {};
            const userLinkedTxIds = new Set();
            const autoMatchedTxIds = new Set();
            
            // Get auto-matched IDs
            for (const key of matchKeys) {
                if (sofMatches[key] && Array.isArray(sofMatches[key])) {
                    sofMatches[key].forEach(txId => autoMatchedTxIds.add(txId));
                }
            }
            
            // For each matched transaction, get ALL annotations from all sources
            matchedTxIds.forEach(txId => {
                const txAnnotations = this.getTransactionAnnotations(txId, check);
                
                // Store marker (from funding method markers)
                if (txAnnotations.marker) {
                    transactionMarkers[txId] = txAnnotations.marker;
                }
                
                // Store flag (from bank analysis items or direct links)
                if (txAnnotations.flag) {
                    transactionFlags[txId] = txAnnotations.flag;
                }
                
                // Store note (combined from all sources)
                if (txAnnotations.note) {
                    transactionNotes[txId] = txAnnotations.note;
                }
                
                // Check if user-linked to THIS funding method
                if (txAnnotations.linkedFundingMethods.includes(index.toString())) {
                    userLinkedTxIds.add(txId);
                }
            });
            
            matchedTxIds.forEach(txId => {
                // Find transaction in accounts
                let tx = null;
                for (const [accountId, accountData] of Object.entries(accounts)) {
                    const statement = accountData.statement || [];
                    tx = statement.find(t => t.id === txId);
                    if (tx) {
                        tx.accountName = (accountData.info || accountData).name || 'Account';
                        break;
                    }
                }
                
                if (tx) {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
                    const txAmount = tx.amount >= 0 ? '+' : '';
                    
                    // Check if this transaction has a marker (from funding method)
                    const marker = transactionMarkers[txId];
                    let markerBadge = '';
                    if (marker === 'accepted') {
                        markerBadge = '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (marker === 'rejected') {
                        markerBadge = '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Check if this transaction has a flag (from bank analysis or direct links)
                    const flag = transactionFlags[txId];
                    let flagBadge = '';
                    if (flag === 'cleared') {
                        flagBadge = '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (flag === 'suspicious') {
                        flagBadge = '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (flag === 'review') {
                        flagBadge = '<span class="tx-marker-badge review">— Review</span>';
                    } else if (flag === 'linked') {
                        flagBadge = '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // Add source badge
                    const isUserLinked = userLinkedTxIds.has(txId);
                    const isAutoMatched = autoMatchedTxIds.has(txId);
                    let sourceBadge = '';
                    if (isUserLinked && !isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge user-linked">👤 User Linked</span>';
                    } else if (isUserLinked && isAutoMatched) {
                        sourceBadge = '<span class="tx-source-badge both-matched">✓ Confirmed</span>';
                    }
                    
                    // Check if this transaction is part of a repeating group
                    let repeatingBadge = '';
                    let userNoteBadge = '';
                    const taskOutcomes = check.taskOutcomes || {};
                    const bankStatement = taskOutcomes['bank:statement'];
                    const bankSummary = taskOutcomes['bank:summary'];
                    const docsBankStatement = taskOutcomes['documents:bank-statement'];
                    const analysis = bankStatement?.breakdown?.analysis || 
                                   bankSummary?.breakdown?.analysis || 
                                   docsBankStatement?.breakdown?.analysis;
                    
                    if (analysis && analysis.repeating_transactions) {
                        for (const group of analysis.repeating_transactions) {
                            if (group.items && group.items.includes(txId)) {
                                repeatingBadge = '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f3e5f5; color: #9c27b0; border: 1px solid #9c27b0; margin-left: 4px;">Repeating</span>';
                                break;
                            }
                        }
                    }
                    
                    // Get transaction note and create user note badge
                    const txNote = transactionNotes[txId] || '';
                    if (txNote) {
                        userNoteBadge = `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txNote}</span>`;
                    }
                    
                    matchedTxHtml += `
                        <div class="matched-tx-row ${marker ? 'marked-' + marker : ''}">
                            <span class="matched-tx-date">${date}</span>
                            <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Transaction'}${markerBadge}${flagBadge}${sourceBadge}${repeatingBadge}${userNoteBadge}</span>
                            <span class="matched-tx-account">${tx.accountName}</span>
                            <span class="matched-tx-amount">${txAmount}${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                            </div>
                        `;
                }
            });
            
            matchedTxHtml += '</div></div>';
        }
        
        // Map funding type display names
        const typeNames = {
            'mortgage': 'Mortgage',
            'savings': 'Savings',
            'gift': 'Gift',
            'sale-property': 'Sale of Property',
            'sale-assets': 'Sale of Assets',
            'inheritance': 'Inheritance',
            'divorce': 'Divorce',
            'cryptocurrency': 'Cryptocurrency',
            'htb': 'Lifetime ISA',
            'htb_lisa': 'Lifetime ISA',
            'investment': 'Investment',
            'business': 'Business Income',
            'loan': 'Loan',
            'income': 'Income',
            'other': 'Other'
        };
        const typeName = typeNames[cleanType] || cleanType;
        
        // Check if corresponding document exists in taskOutcomes
        const docTaskKey = `documents:${cleanType}`;
        const docOutcome = check.taskOutcomes ? check.taskOutcomes[docTaskKey] : null;
        const documentCount = this.getDocumentCount(docOutcome);
        const hasDocuments = documentCount > 0;
        const docLines = [];
        const defaultReminder = 'Check the report pdf for evidence or obtain from the client and review manually';
        const hasLinkedTx = hasMatches;
        const shouldShowManualReview = !hasLinkedTx && type !== 'fund:mortgage';

        if (hasDocuments) {
            const uploadedLabel = `${documentCount} document${documentCount === 1 ? '' : 's'} uploaded`;
            docLines.push({ status: 'clear', text: uploadedLabel });
            } else {
            docLines.push({ status: 'consider', text: defaultReminder });
        }

        if (shouldShowManualReview) {
            docLines.push({ status: 'consider', text: 'No linked bank transactions detected, manual review required.' });
        }

        if (docLines.length === 0) {
            docLines.push({ status: hasDocuments ? 'clear' : 'consider', text: defaultReminder });
        }

        const docStatusLines = docLines.map(line => {
            const icon = this.getTaskCheckIcon(line.status === 'clear' ? 'CL' : line.status === 'fail' ? 'FA' : 'CO');
            return `<div class="doc-status-line">${icon}<span>${line.text}</span></div>`;
        }).join('');
        
        // Build detailed information based on fund type
        const detailsHtml = this.buildFundingDetailContent(fund, { originBadge });
        
        // Get SOF annotations for this specific funding method
        const sofAnnotations = check.sofAnnotations || [];
        let fundAnnotationsHtml = '';
        
        if (sofAnnotations.length > 0) {
            // Filter annotations that affect this funding method
            const relevantAnnotations = sofAnnotations.filter(ann => {
                const fundingMethods = ann.notes?.fundingMethods || [];
                return fundingMethods.some(fm => 
                    fm.fundType === type && fm.fundIdx === index.toString()
                );
            });
            
            if (relevantAnnotations.length > 0) {
                fundAnnotationsHtml = '<div class="funding-annotations-section">';
                fundAnnotationsHtml += '<div class="funding-annotations-header">Investigation Notes</div>';
                
                relevantAnnotations.forEach(ann => {
                    const date = new Date(ann.timestamp).toLocaleString('en-GB', { 
                        day: '2-digit', 
                        month: 'short', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    // Find the specific funding method note
                    const fundingMethod = ann.notes.fundingMethods.find(fm => 
                        fm.fundType === type && fm.fundIdx === index.toString()
                    );
                    
                    if (fundingMethod) {
                        // Only show if there's actual content (note or verified items)
                        const hasNote = fundingMethod.note && fundingMethod.note.trim();
                        const hasVerified = fundingMethod.verified && fundingMethod.verified.length > 0;
                        
                        if (hasNote || hasVerified) {
                            fundAnnotationsHtml += '<div class="annotation-mini-card">';
                            fundAnnotationsHtml += '<div class="annotation-mini-header">';
                            fundAnnotationsHtml += '<div class="annotation-mini-meta">';
                            fundAnnotationsHtml += '<strong>' + (ann.userName || ann.user) + '</strong> • ' + date;
                            fundAnnotationsHtml += '</div>';
                            fundAnnotationsHtml += '</div>';
                            fundAnnotationsHtml += '<div class="annotation-mini-body">';
                            
                            // Show note if exists
                            if (hasNote) {
                                fundAnnotationsHtml += '<p class="annotation-mini-reason">' + fundingMethod.note + '</p>';
                            }
                            
                            // Show verified items
                            if (hasVerified) {
                                fundAnnotationsHtml += '<div class="annotation-mini-objectives">';
                                fundingMethod.verified.forEach(item => {
                                    const verifiedIcon = '<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                                    const label = item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    fundAnnotationsHtml += '<div class="annotation-objective-item">';
                                    fundAnnotationsHtml += verifiedIcon;
                                    fundAnnotationsHtml += '<span class="annotation-objective-label">' + label + '</span>';
                                    fundAnnotationsHtml += '</div>';
                                });
                                fundAnnotationsHtml += '</div>';
                            }
                            
                            fundAnnotationsHtml += '</div></div>';
                        }
                    }
                });
                
                fundAnnotationsHtml += '</div>';
            }
        }
        
        return `
            <div class="funding-source-card">
                <div class="funding-header">
                    <div class="funding-type">${typeName}</div>
                    <div class="funding-header-meta">
                        ${originBadge || ''}
                        <span class="funding-amount">${amount}</span>
                    </div>
                </div>
                ${detailsHtml}
                ${matchedTxHtml}
                ${fundAnnotationsHtml}
                <div class="funding-doc-status">
                    <div class="doc-status-text">${docStatusLines}</div>
                </div>
            </div>
        `;
    }
    
    createSOFTaskCard(outcome, check, sofMatches = {}) {
        const result = outcome.result || 'clear';
        const breakdown = outcome.breakdown || {};
        const property = breakdown.property || {};
        const funds = breakdown.funds || [];
        
        // Get bank statement accounts for transaction lookup - check both bank:statement and documents:bank-statement
        const bankStatement = check.taskOutcomes?.['bank:statement'];
        const docsBankStatement = check.taskOutcomes?.['documents:bank-statement'];
        const accounts = bankStatement?.breakdown?.accounts || docsBankStatement?.breakdown?.accounts || {};
        
        // Determine border class and status icon
        let borderClass = result === 'clear' ? 'clear' : (result === 'fail' ? 'alert' : 'consider');
        let statusIcon = '';
        if (result === 'clear') {
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (result === 'consider' || result === 'alert') {
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else {
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        
        // Property details as bullet points
        let propertyDetailsHtml = '';
        if (property.address) {
            const addr = property.address;
            const fullAddress = `${addr.building_number || ''} ${addr.street || ''}, ${addr.town || ''}, ${addr.postcode || ''}`.trim();
            const price = property.price ? `£${(property.price / 100).toLocaleString()}` : 'Not specified';
            const sdlt = property.stamp_duty ? `£${(property.stamp_duty / 100).toLocaleString()}` : 'Not specified';
            const newBuild = property.new_build ? 'Yes' : 'No';
            
            // Check for property SOF annotations
            const sofAnnotations = check?.sofAnnotations || [];
            let propertyAnnotationsHtml = '';
            
            if (sofAnnotations.length > 0) {
                // Find all annotations with property reviews
                const propertyAnnotations = sofAnnotations.filter(ann => 
                    ann.notes?.property && (ann.notes.property.reviewed || ann.notes.property.note)
                );
                
                if (propertyAnnotations.length > 0) {
                    propertyAnnotationsHtml = '<div class="funding-annotations-section" style="margin-top: 12px;">';
                    propertyAnnotationsHtml += '<div class="funding-annotations-header">Investigation Notes</div>';
                    
                    propertyAnnotations.forEach(ann => {
                        const date = new Date(ann.timestamp).toLocaleString('en-GB', { 
                            day: '2-digit', 
                            month: 'short', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        
                        // Format user name
                        let userName = ann.userName || ann.user;
                        if (userName && userName.includes('.') && !userName.includes(' ')) {
                            userName = userName.split('@')[0]
                                .split('.').join(' ')
                                .split('-').join(' ')
                                .replace(/\b\w/g, l => l.toUpperCase());
                        }
                        
                        const propertyNote = ann.notes.property;
                        
                        propertyAnnotationsHtml += '<div class="annotation-mini-card">';
                        propertyAnnotationsHtml += '<div class="annotation-mini-header">';
                        propertyAnnotationsHtml += '<div class="annotation-mini-meta">';
                        propertyAnnotationsHtml += '<strong>' + userName + '</strong> • ' + date;
                        propertyAnnotationsHtml += '</div>';
                        propertyAnnotationsHtml += '</div>';
                        propertyAnnotationsHtml += '<div class="annotation-mini-body">';
                        
                        if (propertyNote.note) {
                            propertyAnnotationsHtml += '<p class="annotation-mini-reason">' + propertyNote.note + '</p>';
                        }
                        
                        if (propertyNote.reviewed) {
                            propertyAnnotationsHtml += '<div class="annotation-mini-objectives">';
                            const reviewedIcon = '<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                            propertyAnnotationsHtml += '<div class="annotation-objective-item">';
                            propertyAnnotationsHtml += reviewedIcon;
                            propertyAnnotationsHtml += '<span class="annotation-objective-label"><strong>Status:</strong> Reviewed</span>';
                            propertyAnnotationsHtml += '</div>';
                            propertyAnnotationsHtml += '</div>';
                        }
                        
                        propertyAnnotationsHtml += '</div></div>';
                    });
                    
                    propertyAnnotationsHtml += '</div>';
                }
            }
            
            propertyDetailsHtml = `
                <div class="sof-property-details">
                    <div class="property-bullet">📍 <strong>Property:</strong> ${fullAddress}</div>
                    <div class="property-bullet">💷 <strong>Purchase Price:</strong> ${price}</div>
                    <div class="property-bullet">📋 <strong>Stamp Duty:</strong> ${sdlt}</div>
                    <div class="property-bullet">🏗️ <strong>New Build:</strong> ${newBuild}</div>
                    ${propertyAnnotationsHtml}
                </div>
            `;
        }
        
        // Chart iframe (shown when expanded)
        const chartData = this.prepareSOFChartData(breakdown);
        const chartIframeId = `sof-chart-${outcome.id || Math.random().toString(36).substr(2, 9)}`;
        const chartHtml = `
            <div class="sof-chart-container">
                <iframe 
                    id="${chartIframeId}" 
                    src="single-chart-viewer.html" 
                    style="width: 100%; height: 300px; border: none;"
                    onload="this.contentWindow.postMessage({type: 'chart-data', ...${JSON.stringify(chartData).replace(/"/g, '&quot;')}}, '*')"
                ></iframe>
            </div>
        `;
        
        // Individual funding source cards
        let fundingCardsHtml = '<div class="funding-sources-container">';
        funds.forEach((fund, index) => {
            fundingCardsHtml += this.createFundingSourceCard(fund, check, index, sofMatches, accounts);
        });
        fundingCardsHtml += '</div>';
        
        // Build header checks (visible when collapsed)
        const fundCount = funds.length;
        const fundStatus = fundCount === 0 ? 'AL' : 'CL';
        const fundText = fundCount === 0 ? 'Task skipped' : `${fundCount} funding method${fundCount !== 1 ? 's' : ''} identified`;
        
        const headerChecksHtml = `
            <div class="task-header-checks">
                <div class="task-check-item">
                    ${this.getTaskCheckIcon(fundStatus)}
                    <span class="task-check-text">${fundText}</span>
                </div>
            </div>
        `;
        
        // Count SoF annotation GROUPS for badge
        const sofNotes = (check.sofAnnotations || []);
        const sofAnnotationCount = sofNotes.length;
        const annotationBadge = sofAnnotationCount > 0 ? `<span class="annotation-count-badge">${sofAnnotationCount} Update${sofAnnotationCount > 1 ? 's' : ''}</span>` : '';
        
        // Wrap badge in container for consistent right-alignment
        const badgesHtml = annotationBadge ? `<div class="task-header-badges">${annotationBadge}</div>` : '';
        
        // Add annotations display
        const annotationsHtml = this.renderTaskAnnotations('sof:v1', check);
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Source of Funds Questionnaire</div>
                    ${badgesHtml}
                    ${statusIcon}
                </div>
                ${headerChecksHtml}
                <div class="task-details">
                    <div class="sof-top-section">
                        ${propertyDetailsHtml}
                        ${chartHtml}
                    </div>
                    ${fundingCardsHtml}
                    ${annotationsHtml}
                </div>
            </div>
        `;
    }
    
    createTaskCard(taskType, outcome, check) {
        const status = outcome.status || '';
        
        // Recalculate identity result BEFORE reading it
        if (taskType === 'identity' && outcome.breakdown) {
            const breakdown = outcome.breakdown;
            
            // First, recalculate document result if it has breakdown categories
            let docResult = breakdown.document?.result || '';
            if (breakdown.document?.breakdown) {
                const docBreakdown = breakdown.document.breakdown;
                let hasConsider = false;
                let hasFail = false;
                Object.values(docBreakdown).forEach(category => {
                    const catResult = category?.result || '';
                    if (catResult === 'fail') hasFail = true;
                    if (catResult === 'consider') hasConsider = true;
                });
                if (hasFail) docResult = 'fail';
                else if (hasConsider) docResult = 'consider';
                // Update the document result
                if (breakdown.document) {
                    breakdown.document.result = docResult;
                }
            }
            
            const faceResult = breakdown.facial_similarity?.result || breakdown.facial_similarity_video?.result || '';
            
            // Clear if document + facial_similarity are both clear (Original standard)
            if (docResult === 'clear' && faceResult === 'clear') {
                outcome.result = 'clear';
            } else if (docResult === 'consider' || faceResult === 'consider' || docResult === 'fail' || faceResult === 'fail') {
                outcome.result = 'consider';
            }
        }
        
        // Recalculate address result BEFORE reading it (for footprint-converted addresses)
        if (taskType === 'address' && outcome.breakdown) {
            const breakdown = outcome.breakdown;
            const data = outcome.data || {};
            
            // Check if this has footprint breakdown structure
            const dataQuality = breakdown.data_quality;
            const dataCount = breakdown.data_count;
            
            if (dataQuality || dataCount) {
                // Use breakdown results to determine overall status
                let hasFail = false;
                let hasConsider = false;
                
                if (dataQuality) {
                    const qualityResult = dataQuality.result;
                    if (qualityResult === 'fail') hasFail = true;
                    else if (qualityResult === 'consider') hasConsider = true;
                    // If no result, check score
                    else if (!qualityResult) {
                        const score = dataQuality.properties?.score || 0;
                        if (score === 0) hasFail = true;
                        else if (score < 80) hasConsider = true;
                    }
                }
                
                if (dataCount) {
                    const countResult = dataCount.result;
                    if (countResult === 'fail') hasFail = true;
                    else if (countResult === 'consider') hasConsider = true;
                    // If no result, check count/score
                    else if (!countResult) {
                        const count = dataCount.properties?.count !== undefined ? dataCount.properties.count : (dataCount.properties?.score || 0);
                        if (count === 0) hasFail = true;
                        else if (count < 2) hasConsider = true;
                    }
                }
                
                // Update outcome result based on breakdown
                if (hasFail) {
                    outcome.result = 'fail';
                } else if (hasConsider) {
                    outcome.result = 'consider';
                } else {
                    outcome.result = 'clear';
                }
            } else {
                // Use standard address data structure
                const quality = data.quality !== undefined ? data.quality : 0;
                const sources = data.sources !== undefined ? data.sources : 0;
                
                // Recalculate based on quality and sources
                if (quality === 0 || sources === 0) {
                    outcome.result = 'fail';
                } else if (quality < 80 || sources < 2) {
                    outcome.result = 'consider';
                } else {
                    outcome.result = 'clear';
                }
            }
        }
        
        // For identity:lite, check if document was rejected (sub_result: "rejected")
        // This indicates the check failed (e.g., due to glare) and should show as fail
        if (taskType === 'identity:lite' && outcome.breakdown?.document) {
            const documentTask = outcome.breakdown.document;
            if (documentTask.sub_result === 'rejected') {
                // Document was rejected - show as fail but still show nested breakdown
                outcome.result = 'fail';
                // Also update the check's hasAlerts flag so list view shows CONSIDER
                if (check) {
                    check.hasAlerts = true;
                }
            }
        }
        
        const result = outcome.result || 'unknown';
        let borderClass = '';
        let statusIcon = '';
        
        // Handle unobtainable status explicitly
        if (status === 'unobtainable') {
            borderClass = 'consider';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (result === 'clear') {
            borderClass = 'clear';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (result === 'consider' || result === 'alert') {
            borderClass = 'consider';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (result === 'fail') {
            borderClass = 'alert';
            statusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        
        const taskTitle = this.getTaskTitle(taskType);
        const taskChecks = this.getTaskChecks(taskType, outcome, check);

        // Proof of Savings evidence is displayed inside the Source of Funds task card
        // so we can skip rendering the standalone documents:savings card when SoF exists.
        if (taskType === 'documents:savings' && check?.taskOutcomes?.['sof:v1']) {
            return '';
        }
        
        // Document tasks (PoA, PoO, Savings, Crypto, Other) - Expandable if has annotations, otherwise non-expandable
        const isDocumentTask = taskType === 'documents:poa' || taskType === 'documents:poo' || 
                               taskType === 'documents:savings' || taskType === 'documents:cryptocurrency' || 
                               taskType === 'documents:other';
        
        if (isDocumentTask) {
            // Get document count from documents array or breakdown.documents array
            const docCount = outcome.documents?.length || outcome.breakdown?.documents?.length || outcome.data?.document_count || 0;
            const isSkipped = status === 'skipped';
            
            // Determine status based on document count
            // 0 docs or skipped = fail/alert, 1 doc = consider, 2+ docs = clear
            let docStatus = 'AL';
            let docText = '';
            
            if (isSkipped) {
                docStatus = 'AL';
                docText = 'Consumer skipped in app';
            } else if (docCount === 0) {
                docStatus = 'AL';
                docText = 'No documents uploaded';
            } else if (docCount === 1) {
                docStatus = 'CO';
                docText = '1 document uploaded';
            } else {
                docStatus = 'CL';
                docText = `${docCount} documents uploaded`;
            }
            
            const headerChecksHtml = `
                <div class="task-header-checks">
                    <div class="task-check-item">
                        ${this.getTaskCheckIcon(docStatus)}
                        <span class="task-check-text">${docText}</span>
                    </div>
                </div>
            `;
            
            // Count annotation GROUPS for this task
            const taskAnnotations = (check.considerAnnotations || []).filter(ann => ann.taskType === taskType);
            const annotationGroups = {};
            taskAnnotations.forEach(ann => {
                const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
                if (!annotationGroups[groupKey]) {
                    annotationGroups[groupKey] = true;
                }
            });
            const taskAnnotationCount = Object.keys(annotationGroups).length;
            
            // If there are annotations, make it expandable with badge and annotations
            if (taskAnnotationCount > 0) {
                // Get latest annotation status for badge color
                let badgeClass = '';
                if (taskAnnotations.length > 0) {
                    const latestStatus = taskAnnotations[0].newStatus;
                    if (latestStatus === 'clear') badgeClass = ' badge-clear';
                    else if (latestStatus === 'consider') badgeClass = ' badge-consider';
                    else if (latestStatus === 'fail') badgeClass = ' badge-fail';
                }
                
                const annotationBadge = `<span class="annotation-count-badge${badgeClass}">${taskAnnotationCount} Update${taskAnnotationCount > 1 ? 's' : ''}</span>`;
                const badgesHtml = `<div class="task-header-badges">${annotationBadge}</div>`;
                const annotationsHtml = this.renderTaskAnnotations(taskType, check);
                
                return `
                    <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                        <div class="task-header">
                            <div class="task-title">${taskTitle}</div>
                            ${badgesHtml}
                            ${statusIcon}
                        </div>
                        ${headerChecksHtml}
                        <div class="task-details">
                            ${annotationsHtml}
                        </div>
                    </div>
                `;
            } else {
                // No annotations - keep it non-expandable
                return `
                    <div class="task-card ${borderClass} non-expandable">
                        <div class="task-header">
                            <div class="task-title">${taskTitle}</div>
                            ${statusIcon}
                        </div>
                        ${headerChecksHtml}
                    </div>
                `;
            }
        }
        
        // Special handling for Source of Funds (sof:v1)
        if (taskType === 'sof:v1' && outcome.breakdown) {
            // Get bank analysis for SoF matching - check bank:summary, bank:statement, and documents:bank-statement
            const bankSummary = check.taskOutcomes?.['bank:summary'];
            const bankStatement = check.taskOutcomes?.['bank:statement'];
            const docsBankStatement = check.taskOutcomes?.['documents:bank-statement'];
            
            // Get sof_matches from analysis (if available from Open Banking)
            let sofMatches = bankSummary?.breakdown?.analysis?.sof_matches || 
                            bankStatement?.breakdown?.analysis?.sof_matches ||
                            docsBankStatement?.breakdown?.analysis?.sof_matches || 
                            {};
            
            // Get accounts from any source
            const accounts = bankStatement?.breakdown?.accounts || 
                           bankSummary?.breakdown?.accounts || 
                           docsBankStatement?.breakdown?.accounts || 
                           {};
            
            // Note: Manual SOF matching logic removed - can be added back if needed
            // For now, just use the automatic matches from the API
            
            return this.createSOFTaskCard(outcome, check, sofMatches);
        }
        
        // Handle skipped tasks
        if (status === 'skipped') {
            return `
                <div class="task-card ${borderClass} non-expandable">
                    <div class="task-header">
                        <div class="task-title">${taskTitle}</div>
                        ${statusIcon}
                    </div>
                    <div class="task-summary-inline">Consumer skipped in app</div>
                </div>
            `;
        }
        
        // Standard expandable task card
        let taskSummary = outcome.result ? this.formatResult(outcome.result) : 'Pending';
        
        // Add status information for unobtainable tasks
        if (outcome.status === 'unobtainable') {
            taskSummary = `<span style="color: #f7931e;">Unobtainable</span> - Some information may still be available`;
        }
        
        // Separate header checks (show when collapsed) from detail checks (show when expanded)
        const headerChecks = taskChecks.filter(c => !c.indented && !c.isPersonCard && !c.isHitCard && !c.isNestedCard);
        const detailChecks = taskChecks.filter(c => c.indented || c.isPersonCard || c.isHitCard || c.isNestedCard);
        
        let headerChecksHtml = '';
        if (headerChecks.length > 0) {
            headerChecksHtml = '<div class="task-header-checks">';
            headerChecks.forEach(check => {
                const checkIcon = this.getTaskCheckIcon(check.status);
                const indentStyle = check.isChildItem ? 'style="padding-left: 24px;"' : '';
                
                headerChecksHtml += `
                    <div class="task-check-item" ${indentStyle}>
                        ${checkIcon}
                        <span class="task-check-text">${check.text}</span>
                    </div>
                `;
            });
            headerChecksHtml += '</div>';
        }
        
        let checksHtml = '';
        if (detailChecks.length > 0) {
            checksHtml = '<div class="task-checks-grid">';
            detailChecks.forEach((check, index) => {
                // Handle person profile cards - NO ICONS
                if (check.isPersonCard === true && check.personData) {
                    // console.log(`Rendering person card ${index}:`, check.personData.name || check.personData.fullName); // Commented out to avoid logging client data
                    checksHtml += this.createPersonProfileCard(check.personData);
                } else if (check.isHitCard === true && check.hitData) {
                    // Handle screening hit cards (PEP, Sanctions, Adverse Media)
                    checksHtml += this.createScreeningHitCard(check.hitData);
                } else if (check.isNestedCard === true) {
                    // Handle nested collapsible cards (for identity sub-tasks)
                    checksHtml += this.createNestedTaskCard(check);
                } else {
                    // Standard check item with icon
                    const checkIcon = this.getTaskCheckIcon(check.status);
                    const indentedClass = check.indented ? ' indented' : '';
                    const sectionHeaderClass = check.isSectionHeader ? ' section-header' : '';
                    checksHtml += `
                        <div class="task-check-item${indentedClass}${sectionHeaderClass}">
                            ${checkIcon}
                            <span class="task-check-text">${check.text}</span>
                        </div>
                    `;
                }
            });
            checksHtml += '</div>';
        }
        
        // Add header check for unobtainable status
        if (outcome.status === 'unobtainable') {
            taskChecks.unshift({
                status: 'CO',
                text: 'Unobtainable - Some information may still be available'
            });
        }
        
        // Count annotation GROUPS (cards) for this task, not individual annotations
        const taskAnnotations = (check.considerAnnotations || []).filter(ann => ann.taskType === taskType);
        const annotationGroups = {};
        taskAnnotations.forEach(ann => {
            const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
            if (!annotationGroups[groupKey]) {
                annotationGroups[groupKey] = true;
            }
        });
        const taskAnnotationCount = Object.keys(annotationGroups).length;
        
        // Get latest annotation status (first in array since we use unshift) for badge color
        let badgeClass = '';
        if (taskAnnotations.length > 0) {
            const latestStatus = taskAnnotations[0].newStatus;
            if (latestStatus === 'clear') badgeClass = ' badge-clear';
            else if (latestStatus === 'consider') badgeClass = ' badge-consider';
            else if (latestStatus === 'fail') badgeClass = ' badge-fail';
        }
        
        const annotationBadge = taskAnnotationCount > 0 ? `<span class="annotation-count-badge${badgeClass}">${taskAnnotationCount} Update${taskAnnotationCount > 1 ? 's' : ''}</span>` : '';
        
        // Extract dismissed/outstanding counts for badge rendering in task header (screening tasks only)
        let dismissedBadge = '';
        let outstandingBadge = '';
        if (headerChecks.length > 0 && headerChecks[0].dismissedCount !== undefined) {
            if (headerChecks[0].dismissedCount > 0) {
                dismissedBadge = `<span class="hit-count-badge badge-dismissed">${headerChecks[0].dismissedCount} Dismissed</span>`;
            }
            if (headerChecks[0].outstandingCount > 0) {
                outstandingBadge = `<span class="hit-count-badge badge-outstanding">${headerChecks[0].outstandingCount} Outstanding</span>`;
            }
        }
        
        // Add CLOSED badge for screening tasks when monitoring updates exist (left-aligned next to title)
        let closedBadge = '';
        if (taskType === 'screening' && check.pepSanctionsUpdates && check.pepSanctionsUpdates.length > 0) {
            closedBadge = `<span class="hit-count-badge badge-closed">CLOSED</span>`;
        }
        
        // Always create badge container if ANY badge exists (ensures consistent right-alignment)
        const badgesHtml = (annotationBadge || dismissedBadge || outstandingBadge)
            ? `<div class="task-header-badges">${annotationBadge}${dismissedBadge}${outstandingBadge}</div>` 
            : '';
        
        // Add annotations display
        const annotationsHtml = this.renderTaskAnnotations(taskType, check);
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">${taskTitle}${closedBadge}</div>
                    ${badgesHtml}
                    ${statusIcon}
                </div>
                ${headerChecksHtml}
                ${check.status === 'closed' || outcome.status === 'unobtainable' ? `
                <div class="task-details">
                    ${outcome.status !== 'unobtainable' ? `<div class="task-summary">${taskSummary}</div>` : ''}
                    ${checksHtml}
                    ${annotationsHtml}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    createNestedTaskCard(nestedTask) {
        const { title, result, items, isUnobtainable } = nestedTask;
        
        // Determine status icon
        let statusIcon = '';
        if (isUnobtainable) {
            statusIcon = `<svg class="nested-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (result === 'clear') {
            statusIcon = `<svg class="nested-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (result === 'consider') {
            statusIcon = `<svg class="nested-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (result === 'fail') {
            statusIcon = `<svg class="nested-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        
        // If unobtainable or no items, make it non-expandable
        const hasItems = items && items.length > 0;
        const expandableClass = hasItems ? 'expandable' : 'non-expandable';
        
        // Auto-expand if result is consider or fail (to show the issues)
        const autoExpandClass = (result === 'consider' || result === 'fail') && hasItems ? ' expanded' : '';
        
        let itemsHtml = '';
        if (hasItems) {
            items.forEach(item => {
                const itemIcon = this.getTaskCheckIcon(item.status);
                const parentClass = item.isParent ? ' nested-parent' : '';
                const indentedClass = item.isIndented ? ' nested-indented' : '';
                itemsHtml += `
                    <div class="nested-item${parentClass}${indentedClass}">
                        ${itemIcon}
                        <span>${item.text}</span>
                    </div>
                `;
            });
        }
        
        let unobtainableText = '';
        if (isUnobtainable) {
            unobtainableText = '<div class="nested-unobtainable">Unobtainable</div>';
        }
        
        return `
            <div class="nested-task-card ${expandableClass}${autoExpandClass}" onclick="event.stopPropagation(); this.classList.toggle('expanded')">
                <div class="nested-header">
                    <span class="nested-title">${title}</span>
                    ${statusIcon}
                </div>
                ${unobtainableText}
                ${hasItems ? `
                <div class="nested-items">
                    ${itemsHtml}
                </div>
                ` : ''}
            </div>
        `;
    }
    
    renderTaskAnnotations(taskType, check) {
        const annotations = check.considerAnnotations || [];
        const taskAnnotations = annotations.filter(ann => ann.taskType === taskType);
        
        if (taskAnnotations.length === 0) {
            return '';
        }
        
        // Group annotations by user/timestamp/status (same grouping logic as elsewhere)
        const groups = {};
        taskAnnotations.forEach(ann => {
            const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(ann);
        });
        
        let html = '<div class="task-annotations-section">';
        html += '<div class="task-annotations-header">Cashier Updates</div>';
        
        // Render each group as a card (most recent first)
        const sortedGroups = Object.values(groups).sort((a, b) => {
            return new Date(b[0].timestamp) - new Date(a[0].timestamp);
        });
        
        sortedGroups.forEach(group => {
            const ann = group[0]; // Use first annotation in group for metadata
            const date = new Date(ann.timestamp).toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'short', 
                year: 'numeric' 
            });
            const time = new Date(ann.timestamp).toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const statusClass = ann.newStatus === 'clear' ? 'clear' : 
                               (ann.newStatus === 'fail' ? 'fail' : 'consider');
            
            html += `<div class="task-annotation-card ${statusClass}">`;
            html += '<div class="task-annotation-header">';
            html += `<div class="annotation-meta"><strong>${ann.userName || ann.user}</strong> • ${date}, ${time}</div>`;
            html += '</div>';
            html += '<div class="task-annotation-body">';
            
            // Show affected objectives if any
            if (ann.objectives && ann.objectives.length > 0) {
                ann.objectives.forEach(obj => {
                    const objectivePath = this.formatObjectivePath(obj.path);
                    html += `<div class="annotation-objective-path">${objectivePath}</div>`;
                });
            }
            
            // Show reason
            if (ann.reason) {
                html += `<div class="annotation-reason">${ann.reason}</div>`;
            }
            
            html += '</div>';
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    }
    
    renderUpdatesSection(check) {
        const updates = check.updates || [];
        
        if (updates.length === 0) {
            this.updatesSection.innerHTML = '';
            return;
        }
        
        let updatesHtml = '<div class="updates-header">Audit Trail</div>';
        
        // Show in reverse order (most recent first)
        [...updates].reverse().forEach(update => {
            const date = new Date(update.timestamp).toLocaleDateString('en-GB');
            updatesHtml += `
                <div class="update-card">
                    <div class="update-header">
                        <div class="update-message">${update.update}</div>
                        <div class="update-date">${date}</div>
                    </div>
                </div>
            `;
        });
        
        this.updatesSection.innerHTML = updatesHtml;
    }
    
    // ===================================================================
    // HELPER FUNCTIONS
    // ===================================================================
    
    getCheckTypeLabel(check) {
        const labels = {
            'kyb': 'Know Your Business',
            'lite-screen': 'Lite Screen',
            'idv': 'Identity Document Verification'
        };
        
        if (check.checkType === 'electronic-id') {
            // Determine if it's Enhanced, Original, or Additional Tasks Only
            const idType = this.getElectronicIDType(check);
            
            if (idType === 'enhanced') {
                return 'Enhanced ID Check';
            } else if (idType === 'original') {
                return 'Original ID Check';
            } else if (idType && idType !== 'additional') {
                // Specific additional task name(s)
                return idType;
            } else {
                return 'Additional Tasks';
            }
        }
        
        return labels[check.checkType] || 'Thirdfort Check';
    }
    
    getElectronicIDType(check) {
        if (check.checkType !== 'electronic-id') return null;
        
        // Check for identity task in outcomes (closed checks) or request (open checks)
        const taskOutcomes = check.taskOutcomes || {};
        const requestTasks = check.thirdfortResponse?.request?.tasks || [];
        
        // Check if identity task exists
        const hasIdentityOutcome = taskOutcomes['identity'] || taskOutcomes['nfc'];
        const hasIdentityRequest = requestTasks.find(task => task.type === 'report:identity');
        
        // If no identity task at all, determine specific additional task name
        if (!hasIdentityOutcome && !hasIdentityRequest) {
            return this.getAdditionalTasksLabel(check);
        }
        
        // For closed checks: check NFC outcome
        const nfcReport = taskOutcomes['nfc'];
        if (nfcReport) {
            return nfcReport.status !== 'unobtainable' ? 'enhanced' : 'original';
        }
        
        // For open checks: check if NFC preferred was requested
        if (hasIdentityRequest && hasIdentityRequest.opts && hasIdentityRequest.opts.nfc === 'preferred') {
            return 'enhanced';
        }
        
        // If identity task exists but no NFC, it's Original
        return 'original';
    }
    
    getAdditionalTasksLabel(check) {
        // Get all non-identity tasks from check
        const requestTasks = check.thirdfortResponse?.request?.tasks || [];
        const tasks = check.tasks || [];
        
        // Filter out identity/footprint/peps tasks to get only additional tasks
        const additionalTasks = requestTasks.filter(task => {
            const type = typeof task === 'string' ? task : task.type;
            return !['report:identity', 'report:footprint', 'report:peps', 'report:sanctions'].includes(type);
        }).map(task => typeof task === 'string' ? task : task.type);
        
        // If no additional tasks found in requestTasks, check tasks array
        if (additionalTasks.length === 0) {
            const taskTypes = tasks.filter(t => 
                !['report:identity', 'report:footprint', 'report:peps', 'report:sanctions'].includes(t)
            );
            additionalTasks.push(...taskTypes);
        }
        
        const hasPoA = additionalTasks.includes('documents:poa');
        const hasPoO = additionalTasks.includes('documents:poo');
        const hasSavings = additionalTasks.includes('documents:savings');
        const hasCrypto = additionalTasks.includes('documents:cryptocurrency');
        const hasSoF = additionalTasks.includes('report:sof-v1');
        const hasBank = additionalTasks.some(t => t.includes('bank'));
        
        // Single task scenarios
        if (additionalTasks.length === 1) {
            const taskNames = {
                'documents:poa': 'Proof of Address',
                'documents:poo': 'Proof of Ownership',
                'documents:savings': 'Proof of Savings',
                'documents:cryptocurrency': 'Proof of Cryptocurrency',
                'report:sof-v1': 'Source of Funds Questionnaire',
                'report:bank-statement': 'Bank Summary',
                'report:bank-summary': 'Bank Summary',
                'bank': 'Bank Summary'
            };
            return taskNames[additionalTasks[0]] || 'Additional Tasks';
        }
        
        // Combination scenarios
        if (hasPoA && hasPoO && !hasSoF && !hasBank) {
            return 'Proof of Ownership & Address';
        }
        
        if ((hasSoF || hasBank) && !hasPoA && !hasPoO) {
            if (hasSoF && hasBank) {
                return 'Source of Funds Questionnaire & Bank Summary';
            } else if (hasSoF) {
                return 'Source of Funds Questionnaire';
            } else {
                return 'Bank Summary';
            }
        }
        
        // Mixed proof tasks with SoF/bank tasks
        return 'Additional Tasks';
    }
    
    isEnhancedID(check) {
        return this.getElectronicIDType(check) === 'enhanced';
    }
    
    checksSafeHarbour(check) {
        if (check.checkType !== 'electronic-id') return false;
        
        const taskOutcomes = check.taskOutcomes || {};
        const considerReasons = check.considerReasons || [];
        
        const nfcReport = taskOutcomes['nfc'];
        const isEnhanced = nfcReport && nfcReport.status !== 'unobtainable';
        
        if (!isEnhanced) return false;
        
        const addressClear = !taskOutcomes['address'] || taskOutcomes['address'].result === 'clear';
        const pepClear = !taskOutcomes['peps'] || taskOutcomes['peps'].result === 'clear';
        const identityClear = !taskOutcomes['identity'] || taskOutcomes['identity'].result === 'clear';
        const nfcConfirmed = nfcReport.result === 'clear' || nfcReport.status === 'closed';
        const livenessClear = !taskOutcomes['liveness'] || taskOutcomes['liveness'].result === 'clear';
        const pooNotSkipped = !considerReasons.includes('skipped proof of ownership');
        
        return addressClear && pepClear && identityClear && nfcConfirmed && livenessClear && pooNotSkipped;
    }
    
    generateHints(check) {
        const hints = [];
        const considerReasons = check.considerReasons || [];
        
        // Map each consider reason to a hint with proper categorization
        considerReasons.forEach(reason => {
            const lowerReason = reason.toLowerCase();
            let hint = { level: 'info', text: reason, priority: 2 };
            
            // Alert/Fail level (priority 0)
            if (lowerReason.includes('document integrity') || 
                lowerReason.includes('nfc mismatch') || 
                lowerReason.includes('nfc chip') ||
                lowerReason.includes('document expired') ||
                lowerReason.includes('no address match')) {
                hint = { level: 'alert', text: this.formatHintText(reason), priority: 0 };
            }
            // Warning/Consider level (priority 1)
            else if (lowerReason.includes('pep') || 
                     lowerReason.includes('sanction') ||
                     lowerReason.includes('address quality') ||
                     lowerReason.includes('address verification') ||
                     lowerReason.includes('facial similarity') ||
                     lowerReason.includes('image quality') ||
                     lowerReason.includes('mortality') ||
                     lowerReason.includes('dob match') ||
                     lowerReason.includes('bank link') ||
                     lowerReason.includes('high-risk') ||
                     lowerReason.includes('adverse media') ||
                     lowerReason.includes('ubo')) {
                hint = { level: 'warning', text: this.formatHintText(reason), priority: 1 };
            }
            // Info level (priority 2) - already set as default
            else {
                hint = { level: 'info', text: this.formatHintText(reason), priority: 2 };
            }
            
            hints.push(hint);
        });
        
        // Check for Enhanced downgrade (from taskOutcomes)
        const nfcReport = check.taskOutcomes?.['nfc'];
        if (check.checkType === 'electronic-id' && nfcReport && nfcReport.status === 'unobtainable') {
            // Only add if not already in considerReasons
            if (!considerReasons.some(r => r.toLowerCase().includes('enhanced downgrade'))) {
                hints.push({ level: 'info', text: 'Enhanced Downgrade', priority: 2 });
            }
        }
        
        // Sort by priority (alert > warning > info)
        return hints.sort((a, b) => a.priority - b.priority);
    }
    
    formatHintText(reason) {
        // Capitalize first letter and clean up text
        return reason.charAt(0).toUpperCase() + reason.slice(1);
    }
    
    formatResult(result) {
        // Format result string (capitalize first letter)
        return result.charAt(0).toUpperCase() + result.slice(1);
    }
    
    prepareSOFChartData(sofBreakdown) {
        const funds = sofBreakdown.funds || [];
        const fundingLabels = [];
        const fundingAmounts = [];
        const fundingColors = {
            'fund:mortgage': '#93C5FD',        // Pastel Blue
            'fund:savings': '#86EFAC',         // Pastel Green
            'fund:gift': '#FCA5A5',            // Pastel Pink/Red
            'fund:sale:property': '#C4B5FD',   // Pastel Purple
            'fund:sale:assets': '#FDBA74',     // Pastel Orange
            'fund:asset_sale': '#FDBA74',
            'fund:htb': '#A5F3FC',             // Pastel Cyan
            'fund:htb_lisa': '#A5F3FC',
            'fund:inheritance': '#FDE68A',     // Pastel Yellow
            'fund:divorce': '#FBCFE8',         // Pastel Pink
            'fund:cryptocurrency': '#99F6E4',  // Pastel Teal
            'fund:crypto': '#99F6E4',
            'fund:loan': '#FDE68A',
            'fund:investment': '#BBF7D0',
            'fund:business': '#DDD6FE',
            'fund:income': '#A7F3D0',
            'fund:other': '#E5E7EB'
        };
        
        const typeLabels = {
            'fund:mortgage': 'Mortgage',
            'fund:savings': 'Savings',
            'fund:gift': 'Gift',
            'fund:sale:property': 'Property Sale',
            'fund:property_sale': 'Property Sale',
            'fund:sale:assets': 'Asset Sale',
            'fund:asset_sale': 'Asset Sale',
            'fund:htb': 'Lifetime ISA',
            'fund:htb_lisa': 'Lifetime ISA',
            'fund:inheritance': 'Inheritance',
            'fund:divorce': 'Divorce Settlement',
            'fund:cryptocurrency': 'Cryptocurrency',
            'fund:crypto': 'Cryptocurrency',
            'fund:loan': 'Loan',
            'fund:investment': 'Investment',
            'fund:business': 'Business Income',
            'fund:income': 'Income',
            'fund:other': 'Other'
        };
        
        funds.forEach(fund => {
            const label = typeLabels[fund.type] || this.formatFundingLabel(fund.type?.replace('fund:', '') || 'Other');
            const amountMinor = typeof fund.data.amount === 'number' ? fund.data.amount : 0;
            const amount = amountMinor / 100; // Convert pence to pounds
            fundingLabels.push(label);
            fundingAmounts.push(amount);
        });
        
        return {
            chartType: 'doughnut',
            title: 'Funding Breakdown',
            chartData: {
                labels: fundingLabels,
                datasets: [{
                    data: fundingAmounts,
                    backgroundColor: funds.map(f => fundingColors[f.type] || '#6B7280')
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed;
                                return `${context.label}: £${value.toLocaleString()}`;
                            }
                        }
                    }
                }
            }
        };
    }
    
    createPersonProfileCard(personData) {
        // Create a profile card for officers, PSCs, beneficial owners, etc.
        const name = personData.name || personData.fullName || personData.organizationName || 'Unknown';
        const isIndividual = personData.beneficiaryType === 'Individual' || personData.birthDate || personData.dob;
        const isBusiness = personData.businessEntityType || personData.beneficiaryType === 'Business';
        
        // Determine role badges
        let badges = '';
        const roleLabels = new Set(); // Use Set to avoid duplicates
        
        // Officer/Director/Member role from position or category
        const position = personData.position || personData.category || '';
        if (position) {
            if (position.toLowerCase().includes('director')) {
                roleLabels.add('Director');
            } else if (position.toLowerCase().includes('member')) {
                roleLabels.add('Member');
            } else {
                roleLabels.add(position);
            }
        }
        
        // PSC indicator (from nature of control types)
        if (personData.natureOfControlTypes && personData.natureOfControlTypes.length > 0) {
            roleLabels.add('PSC');
        }
        
        // UBO indicator (ultimate beneficial owner)
        if (personData.is_ubo === true) {
            roleLabels.add('UBO');
        }
        
        // Beneficial Owner (from beneficiaryType)
        if ((personData.beneficiaryType === 'Business' || personData.beneficiaryType === 'Individual') && !personData.is_ubo) {
            roleLabels.add('Beneficial Owner');
        }
        
        // Create badge HTML
        roleLabels.forEach(label => {
            let badgeClass = 'badge-officer'; // Default
            
            if (label === 'Director') {
                badgeClass = 'badge-director';
            } else if (label === 'PSC' || label === 'UBO' || label === 'Beneficial Owner') {
                badgeClass = 'badge-psc';
            } else if (label === 'Trustee') {
                badgeClass = 'badge-trustee';
            } else if (label.toLowerCase().includes('member')) {
                badgeClass = 'badge-officer';
            }
            
            badges += `<span class="people-card-badge ${badgeClass}">${label}</span>`;
        });
        
        // Build profile details HTML
        let detailsHtml = '';
        
        // Date of Birth
        const dob = personData.dob || personData.birthDate || '';
        if (dob) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">DOB:</span> ${dob}</div>`;
        }
        
        // Nationality
        const nationality = personData.nationality || '';
        if (nationality) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Nationality:</span> ${nationality}</div>`;
        }
        
        // Residence Country
        const residenceCountry = personData.residenceCountryName || '';
        if (residenceCountry && residenceCountry !== nationality) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Residence:</span> ${residenceCountry}</div>`;
        }
        
        // Business Entity Type
        if (isBusiness && personData.businessEntityType) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Entity Type:</span> ${personData.businessEntityType}</div>`;
        }
        
        // Beneficiary Type
        if (personData.beneficiaryType && !isBusiness) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Type:</span> ${personData.beneficiaryType}</div>`;
        }
        
        // Country (for businesses)
        const country = personData.country || '';
        if (country) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Country:</span> ${country}</div>`;
        }
        
        // Appointment Date
        const startDate = personData.start_date || personData.natureOfControlStartDate || '';
        if (startDate) {
            const appointDate = new Date(startDate).toLocaleDateString('en-GB');
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Appointed:</span> ${appointDate}</div>`;
        }
        
        // End Date / Resignation
        const endDate = personData.end_date || '';
        if (endDate) {
            const resignDate = new Date(endDate).toLocaleDateString('en-GB');
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Resigned:</span> ${resignDate}</div>`;
        }
        
        // Address
        let addressStr = '';
        if (typeof personData.address === 'string') {
            addressStr = personData.address;
        } else if (personData.address && typeof personData.address === 'object') {
            const addr = personData.address;
            addressStr = [addr.street, addr.city, addr.zip, addr.country]
                .filter(Boolean).join(', ');
        }
        if (addressStr) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Address:</span> ${addressStr}</div>`;
        }
        
        // DUNS Number
        if (personData.duns) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">DUNS:</span> ${personData.duns}</div>`;
        }
        
        // Member ID
        if (personData.memberID) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Member ID:</span> ${personData.memberID}</div>`;
        }
        
        // Associations
        if (personData.associations && personData.associations !== null) {
            detailsHtml += `<div class="profile-detail-row"><span class="profile-detail-label">Associations:</span> ${personData.associations}</div>`;
        }
        
        // Flags/Warnings
        let warnings = '';
        if (personData.is_disqualified_director) {
            warnings += '<div class="person-warning">⚠️ DISQUALIFIED DIRECTOR</div>';
        }
        if (personData.has_bankruptcy_history) {
            warnings += '<div class="person-warning">⚠️ BANKRUPTCY HISTORY</div>';
        }
        if (personData.isOutOfBusiness) {
            warnings += '<div class="person-warning">⚠️ OUT OF BUSINESS</div>';
        }
        
        // Ownership/Share information with Nature of Control
        let shareInfo = '';
        const shareDetails = [];
        
        // Ownership percentages
        const beneficialPct = personData.beneficialOwnershipPercentage || 0;
        const directPct = personData.directOwnershipPercentage || 0;
        const indirectPct = personData.indirectOwnershipPercentage || 0;
        const ownershipPct = personData.ownershipPercentage || 0;
        const votingPct = personData.votingPercentageHigh || 0;
        
        if (beneficialPct > 0) shareDetails.push(`${beneficialPct}% beneficial`);
        if (directPct > 0) shareDetails.push(`${directPct}% direct`);
        if (indirectPct > 0) shareDetails.push(`${indirectPct}% indirect`);
        if (ownershipPct > 0 && beneficialPct === 0 && directPct === 0) shareDetails.push(`${ownershipPct}% ownership`);
        if (votingPct > 0) shareDetails.push(`${votingPct}% voting rights`);
        
        // Nature of Control
        if (personData.natureOfControlTypes && Array.isArray(personData.natureOfControlTypes) && personData.natureOfControlTypes.length > 0) {
            const controls = this.formatNatureOfControl(personData.natureOfControlTypes);
            if (controls) {
                shareDetails.push(controls);
            }
        }
        
        if (shareDetails.length > 0) {
            shareInfo = `<div class="people-card-share">📊 ${shareDetails.join(' | ')}</div>`;
        }
        
        return `
            <div class="person-profile-card">
                <div class="people-card-header">
                    <div class="people-card-name">${name}</div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">${badges}</div>
                </div>
                <div class="people-card-details">
                    ${detailsHtml}
                </div>
                ${shareInfo}
                ${warnings}
            </div>
        `;
    }
    
    getTaskCheckIcon(status, isRed = false) {
        // Return colored circle icons for task objectives
        if (status === 'CL') {
            // Green circle with checkmark
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (status === 'CO' || status === 'CN') {
            // Orange or Red circle with minus (for red flags)
            const color = isRed ? '#d32f2f' : '#f7931e';
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="${color}" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (status === 'AL' || status === 'FA') {
            // Red circle with X
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        return '';
    }
    
    // CSS-based icons for PDF generation (html2pdf doesn't handle SVG well)
    getTaskCheckIconCSS(status, isRed = false) {
        if (status === 'CL') {
            // Green circle with white checkmark using pseudo-elements
            return `<div style="width: 16px; height: 16px; border-radius: 50%; background: #39b549; position: relative; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center;"><span style="color: white; font-size: 12px; font-weight: bold; line-height: 1;">✓</span></div>`;
        } else if (status === 'CO' || status === 'CN') {
            const color = isRed ? '#d32f2f' : '#f7931e';
            return `<div style="width: 16px; height: 16px; border-radius: 50%; background: ${color}; position: relative; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center;"><span style="color: white; font-size: 16px; font-weight: bold; line-height: 1;">−</span></div>`;
        } else if (status === 'AL' || status === 'FA') {
            return `<div style="width: 16px; height: 16px; border-radius: 50%; background: #ff0000; position: relative; flex-shrink: 0; margin-top: 2px; display: flex; align-items: center; justify-content: center;"><span style="color: white; font-size: 14px; font-weight: bold; line-height: 1;">×</span></div>`;
        }
        return '';
    }
    
    // CSS-based status icons for PDF (larger size for task headers)
    getStatusIconCSS(status) {
        if (status === 'clear') {
            return `<div style="width: 20px; height: 20px; border-radius: 50%; background: #39b549; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="color: white; font-size: 14px; font-weight: bold; line-height: 1;">✓</span></div>`;
        } else if (status === 'consider') {
            return `<div style="width: 20px; height: 20px; border-radius: 50%; background: #f7931e; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="color: white; font-size: 18px; font-weight: bold; line-height: 1;">−</span></div>`;
        } else if (status === 'fail') {
            return `<div style="width: 20px; height: 20px; border-radius: 50%; background: #ff0000; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="color: white; font-size: 16px; font-weight: bold; line-height: 1;">×</span></div>`;
        }
        return '';
    }
    
    getStatusIconSVG(status) {
        // Return smaller circular status icons for annotation objectives
        // Matches the status result strings: 'clear', 'consider', 'fail'
        if (status === 'clear') {
            // Green circle with checkmark
            return `<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (status === 'consider') {
            // Orange circle with minus
            return `<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (status === 'fail') {
            // Red circle with X
            return `<svg class="annotation-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        return '';
    }
    
    /**
     * Helper function to extract date of birth from hit data
     * Handles cases where dob is an object like {main: "", other: []} or a string
     * @param {Object|string|undefined} dob - The dob field from hit data
     * @returns {string} - A valid string value or empty string
     */
    extractDob(dob) {
        if (!dob) {
            return '';
        }
        
        // If dob is an object with a main property
        if (typeof dob === 'object' && dob !== null && 'main' in dob) {
            const mainValue = dob.main;
            // Return main value if it's a non-empty string
            if (typeof mainValue === 'string' && mainValue.trim() !== '') {
                return mainValue;
            }
            return '';
        }
        
        // If dob is already a string
        if (typeof dob === 'string') {
            return dob.trim() !== '' ? dob : '';
        }
        
        // For any other type, return empty string
        return '';
    }
    
    createScreeningHitCard(hitData) {
        const {
            name, dob, hitType, hitIcon, score, flagTypes, positions, countries, aka, media, associates, fields, match_types, dismissal,
            source_notes, institutions, spouses, roles, assets, id
        } = hitData;
        
        const uniqueId = `hit-${Math.random().toString(36).substr(2, 9)}`;
        const isDismissed = dismissal !== undefined && dismissal !== null;
        
        let html = `
            <div class="screening-hit-card ${isDismissed ? 'dismissed-hit' : ''}">
                <div class="screening-hit-header">
                    <div class="screening-hit-name">
                        ${name}
                        ${isDismissed ? `<span class="dismissal-badge">
                            <svg viewBox="0 0 300 300" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 4px;"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>
                            Dismissed
                        </span>` : ''}
                    </div>
                    <div class="screening-hit-badges">
        `;
        
        // Organize badges by type for separate rows
        const pepBadges = [];
        const sanctionBadges = [];
        const adverseBadges = [];
        const otherBadges = [];
        
        if (flagTypes && flagTypes.length > 0) {
            const uniqueFlags = [...new Set(flagTypes)];
            uniqueFlags.forEach(flag => {
                let badgeText = flag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                if (flag.includes('pep')) {
                    // Extract PEP class if available
                    if (flag.includes('class-1')) badgeText = 'PEP Class 1';
                    else if (flag.includes('class-2')) badgeText = 'PEP Class 2';
                    else if (flag.includes('class-3')) badgeText = 'PEP Class 3';
                    else if (flag.includes('class-4')) badgeText = 'PEP Class 4';
                    else if (flag === 'pep') badgeText = 'PEP';
                    pepBadges.push(badgeText);
                } else if (flag.includes('sanction')) {
                    sanctionBadges.push(badgeText);
                } else if (flag.includes('adverse-media')) {
                    adverseBadges.push(badgeText);
                } else {
                    otherBadges.push(badgeText);
                }
            });
        }
        
        // PEP badges row (purple)
        if (pepBadges.length > 0) {
            html += '<div class="hit-badge-row">';
            pepBadges.forEach(badge => {
                html += `<span class="hit-badge hit-badge-pep">${badge}</span>`;
            });
            html += '</div>';
        }
        
        // Sanctions badges row (red)
        if (sanctionBadges.length > 0) {
            html += '<div class="hit-badge-row">';
            sanctionBadges.forEach(badge => {
                html += `<span class="hit-badge hit-badge-sanction">${badge}</span>`;
            });
            html += '</div>';
        }
        
        // Adverse Media badges row (blue)
        if (adverseBadges.length > 0) {
            html += '<div class="hit-badge-row">';
            adverseBadges.forEach(badge => {
                html += `<span class="hit-badge hit-badge-adverse">${badge}</span>`;
            });
            html += '</div>';
        }
        
        // Match types row (green)
        if (match_types && match_types.length > 0) {
            html += '<div class="hit-badge-row">';
            match_types.forEach(matchType => {
                const matchText = matchType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                html += `<span class="hit-badge hit-badge-match">${matchText}</span>`;
            });
            html += '</div>';
        }
        
        // Other badges row
        if (otherBadges.length > 0) {
            html += '<div class="hit-badge-row">';
            otherBadges.forEach(badge => {
                html += `<span class="hit-badge hit-badge-default">${badge}</span>`;
            });
            html += '</div>';
        }
        
        html += `
                    </div>
                </div>
                <div class="screening-hit-body">
                    <div class="hit-main-column">
        `;
        
        // Date of Birth - only display if dob is a non-empty string
        if (dob && typeof dob === 'string' && dob.trim() !== '') {
            html += `<div class="hit-info-row"><span class="hit-info-label">Date of Birth:</span> <span class="hit-info-value">${dob}</span></div>`;
        }
        
        // Positions - show all
        if (positions && positions.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Position${positions.length > 1 ? 's' : ''}:</span> <span class="hit-info-value">${positions.join(', ')}</span></div>`;
        }
        
        // AKA - show all
        if (aka && aka.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Also Known As:</span> <span class="hit-info-value">${aka.join(', ')}</span></div>`;
        }
        
        // Countries with flag emojis - show all
        if (countries && countries.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Countries:</span> <div class="hit-countries">`;
            countries.forEach(country => {
                const flagEmoji = this.getCountryFlag(country);
                html += `<span class="country-tag">${flagEmoji} ${country}</span>`;
            });
            html += `</div></div>`;
        }
        
        // Number of sources
        if (fields && fields.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Data Sources:</span> <span class="hit-info-value">${fields.length} source${fields.length !== 1 ? 's' : ''}</span></div>`;
        }
        
        // Extract URLs from fields and source_notes to add to media
        let allMedia = media || [];
        if (fields && fields.length > 0) {
            fields.forEach(field => {
                // Extract URLs from fields (e.g., "Related URL")
                if (field.name && (field.name.toLowerCase().includes('url') || field.name.toLowerCase().includes('link') || field.name.toLowerCase().includes('related')) && field.value) {
                    const url = field.value;
                    if (url.startsWith('http') && !allMedia.some(m => m.url === url)) {
                        allMedia.push({
                            title: field.name,
                            url: url,
                            date: null,
                            snippet: ''
                        });
                    }
                }
            });
        }
        if (source_notes && Object.keys(source_notes).length > 0) {
            Object.entries(source_notes).forEach(([sourceKey, sourceData]) => {
                const sourceUrl = sourceData.url || '';
                if (sourceUrl && sourceUrl.startsWith('http') && !allMedia.some(m => m.url === sourceUrl)) {
                    const sourceName = sourceData.name || sourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    allMedia.push({
                        title: sourceName,
                        url: sourceUrl,
                        date: sourceData.listing_started_utc ? new Date(sourceData.listing_started_utc).toISOString() : null,
                        snippet: ''
                    });
                }
            });
        }
        
        // Media articles - expandable
        if (allMedia && allMedia.length > 0) {
            html += `
                <div class="hit-info-row hit-media-section">
                    <span class="hit-info-label">Media Articles:</span> 
                    <span class="hit-info-value hit-media-toggle" onclick="document.getElementById('${uniqueId}-media').classList.toggle('expanded'); event.stopPropagation();">
                        ${allMedia.length} article${allMedia.length !== 1 ? 's' : ''} ▼
                    </span>
                </div>
                <div id="${uniqueId}-media" class="hit-media-list">
            `;
            // Show first 10 articles
            allMedia.slice(0, 10).forEach((article, idx) => {
                const date = article.date && article.date !== '0001-01-01T00:00:00Z' ? new Date(article.date).toLocaleDateString() : 'Unknown date';
                const title = article.title || 'Untitled';
                const snippet = article.snippet ? article.snippet.substring(0, 200) + '...' : '';
                const url = article.url || '';
                html += `
                    <div class="media-article">
                        ${url ? `<a href="${url}" target="_blank" class="media-article-title" onclick="event.stopPropagation(); window.open('${url}', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes'); return false;">${title}</a>` : `<div class="media-article-title">${title}</div>`}
                        ${snippet ? `<div class="media-article-snippet">${snippet}</div>` : ''}
                        <div class="media-article-date">${date}</div>
                    </div>
                `;
            });
            
            // Additional articles shown when expanded
            if (allMedia.length > 10) {
                html += `<div id="${uniqueId}-media-extra" class="hit-media-list-extra">`;
                allMedia.slice(10).forEach((article, idx) => {
                    const date = article.date && article.date !== '0001-01-01T00:00:00Z' ? new Date(article.date).toLocaleDateString() : 'Unknown date';
                    const title = article.title || 'Untitled';
                    const snippet = article.snippet ? article.snippet.substring(0, 200) + '...' : '';
                    const url = article.url || '';
                    html += `
                        <div class="media-article">
                            ${url ? `<a href="${url}" target="_blank" class="media-article-title" onclick="event.stopPropagation(); window.open('${url}', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes'); return false;">${title}</a>` : `<div class="media-article-title">${title}</div>`}
                            ${snippet ? `<div class="media-article-snippet">${snippet}</div>` : ''}
                            <div class="media-article-date">${date}</div>
                        </div>
                    `;
                });
                html += `</div>`;
                html += `<div class="media-article-more" onclick="document.getElementById('${uniqueId}-media-extra').classList.toggle('expanded'); this.textContent = this.textContent.startsWith('+') ? 'Show less' : '+ ${allMedia.length - 10} more article${allMedia.length - 10 !== 1 ? 's' : ''}'; event.stopPropagation();">+ ${allMedia.length - 10} more article${allMedia.length - 10 !== 1 ? 's' : ''}</div>`;
            }
            html += `</div>`;
        }
        
        html += `
                    </div>
        `;
        
        // Associates column
        if (associates && associates.length > 0) {
            const hasMany = associates.length >= 6;
            html += `
                    <div class="hit-associates-column${hasMany ? ' has-many' : ''}">
                        <div class="associates-header">Associates (${associates.length})</div>
                        <div class="associates-grid">
            `;
            associates.forEach(assoc => {
                const assocName = assoc.name || 'Unknown';
                const assocRelation = assoc.association || 'Unknown relation';
                html += `
                    <div class="associate-card">
                        <span class="associate-name">${assocName}</span>
                        <span class="associate-badge">${assocRelation}</span>
                    </div>
                `;
            });
            html += `
                        </div>
                    </div>
            `;
        }
        
        // Source Notes (new format from lite screen) - expandable
        if (source_notes && Object.keys(source_notes).length > 0) {
            const sourceNotesId = `${uniqueId}-sources`;
            html += `
                <div class="hit-info-row hit-source-notes-section">
                    <span class="hit-info-label">Source Information:</span> 
                    <span class="hit-info-value hit-source-toggle" onclick="document.getElementById('${sourceNotesId}').classList.toggle('expanded'); event.stopPropagation();">
                        ${Object.keys(source_notes).length} source${Object.keys(source_notes).length !== 1 ? 's' : ''} ▼
                    </span>
                </div>
                <div id="${sourceNotesId}" class="hit-source-notes-list">
            `;
            Object.entries(source_notes).forEach(([sourceKey, sourceData]) => {
                const sourceName = sourceData.name || sourceKey.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const sourceUrl = sourceData.url || '';
                const amlTypes = sourceData.aml_types || [];
                const listingDate = sourceData.listing_started_utc ? new Date(sourceData.listing_started_utc).toLocaleDateString() : '';
                
                html += `
                    <div class="source-note-item">
                        <div class="source-note-header">
                            ${sourceUrl ? `<a href="${sourceUrl}" target="_blank" class="source-note-title" onclick="event.stopPropagation(); window.open('${sourceUrl}', '_blank'); return false;">${sourceName}</a>` : `<div class="source-note-title">${sourceName}</div>`}
                            ${listingDate ? `<div class="source-note-date">Listed: ${listingDate}</div>` : ''}
                        </div>
                        ${amlTypes.length > 0 ? `<div class="source-note-types">${amlTypes.map(t => `<span class="source-type-badge">${t.replace(/-/g, ' ')}</span>`).join('')}</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Institutions (new format)
        if (institutions && institutions.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Institution${institutions.length > 1 ? 's' : ''}:</span> <span class="hit-info-value">${institutions.map(inst => inst.name || inst).join(', ')}</span></div>`;
        }
        
        // Spouses (new format)
        if (spouses && spouses.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Spouse${spouses.length > 1 ? 's' : ''}:</span> <span class="hit-info-value">${spouses.map(spouse => spouse.name || spouse).join(', ')}</span></div>`;
        }
        
        // Roles (new format)
        if (roles && roles.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Role${roles.length > 1 ? 's' : ''}:</span> <span class="hit-info-value">${roles.map(role => role.name || role.title || role).join(', ')}</span></div>`;
        }
        
        // Assets (new format)
        if (assets && assets.length > 0) {
            html += `<div class="hit-info-row"><span class="hit-info-label">Asset${assets.length > 1 ? 's' : ''}:</span> <span class="hit-info-value">${assets.map(asset => asset.description || asset.value || asset).join(', ')}</span></div>`;
        }
        
        // Dismissal information (if hit was dismissed)
        if (isDismissed) {
            const dismissalDate = new Date(dismissal.timestamp).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const dismissalTime = new Date(dismissal.timestamp).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            // Format user name
            const dismissedBy = dismissal.userName || dismissal.user || 'Unknown';
            const formattedUser = dismissedBy
                .split(/[-._@]/)
                .slice(0, -1) // Remove domain
                .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                .join(' ');
            
            html += `
                <div class="dismissal-info-section">
                    <div class="dismissal-info-header">
                        <svg viewBox="0 0 300 300" style="width: 16px; height: 16px; margin-right: 6px;"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>
                        <strong>Dismissed by ${formattedUser}</strong>
                        <span class="dismissal-date">${dismissalDate} at ${dismissalTime}</span>
                    </div>
                    <div class="dismissal-reason">${dismissal.reason}</div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    getCountryFlag(countryName) {
        // Map country names to flag emojis (using actual Unicode emoji characters)
        // Comprehensive list covering common countries and variations
        const flagMap = {
            // United Kingdom and variations
            'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Great Britain': '🇬🇧', 'GB': '🇬🇧', 'GBR': '🇬🇧',
            // United States and variations
            'United States': '🇺🇸', 'USA': '🇺🇸', 'US': '🇺🇸', 'United States of America': '🇺🇸',
            // Canada and variations
            'Canada': '🇨🇦', 'CA': '🇨🇦', 'CAN': '🇨🇦',
            // European countries
            'France': '🇫🇷', 'FR': '🇫🇷', 'FRA': '🇫🇷',
            'Germany': '🇩🇪', 'DE': '🇩🇪', 'DEU': '🇩🇪',
            'Spain': '🇪🇸', 'ES': '🇪🇸', 'ESP': '🇪🇸',
            'Italy': '🇮🇹', 'IT': '🇮🇹', 'ITA': '🇮🇹',
            'Belgium': '🇧🇪', 'BE': '🇧🇪', 'BEL': '🇧🇪',
            'Ireland': '🇮🇪', 'IE': '🇮🇪', 'IRL': '🇮🇪',
            'Netherlands': '🇳🇱', 'NL': '🇳🇱', 'NLD': '🇳🇱', 'Holland': '🇳🇱',
            'Portugal': '🇵🇹', 'PT': '🇵🇹', 'PRT': '🇵🇹',
            'Greece': '🇬🇷', 'GR': '🇬🇷', 'GRC': '🇬🇷',
            'Poland': '🇵🇱', 'PL': '🇵🇱', 'POL': '🇵🇱',
            'Sweden': '🇸🇪', 'SE': '🇸🇪', 'SWE': '🇸🇪',
            'Norway': '🇳🇴', 'NO': '🇳🇴', 'NOR': '🇳🇴',
            'Denmark': '🇩🇰', 'DK': '🇩🇰', 'DNK': '🇩🇰',
            'Finland': '🇫🇮', 'FI': '🇫🇮', 'FIN': '🇫🇮',
            'Switzerland': '🇨🇭', 'CH': '🇨🇭', 'CHE': '🇨🇭',
            'Austria': '🇦🇹', 'AT': '🇦🇹', 'AUT': '🇦🇹',
            'Czech Republic': '🇨🇿', 'CZ': '🇨🇿', 'CZE': '🇨🇿', 'Czechia': '🇨🇿',
            'Hungary': '🇭🇺', 'HU': '🇭🇺', 'HUN': '🇭🇺',
            'Romania': '🇷🇴', 'RO': '🇷🇴', 'ROU': '🇷🇴',
            'Bulgaria': '🇧🇬', 'BG': '🇧🇬', 'BGR': '🇧🇬',
            'Croatia': '🇭🇷', 'HR': '🇭🇷', 'HRV': '🇭🇷',
            'Slovakia': '🇸🇰', 'SK': '🇸🇰', 'SVK': '🇸🇰',
            'Slovenia': '🇸🇮', 'SI': '🇸🇮', 'SVN': '🇸🇮',
            'Estonia': '🇪🇪', 'EE': '🇪🇪', 'EST': '🇪🇪',
            'Latvia': '🇱🇻', 'LV': '🇱🇻', 'LVA': '🇱🇻',
            'Lithuania': '🇱🇹', 'LT': '🇱🇹', 'LTU': '🇱🇹',
            'Luxembourg': '🇱🇺', 'LU': '🇱🇺', 'LUX': '🇱🇺',
            'Malta': '🇲🇹', 'MT': '🇲🇹', 'MLT': '🇲🇹',
            'Cyprus': '🇨🇾', 'CY': '🇨🇾', 'CYP': '🇨🇾',
            'Iceland': '🇮🇸', 'IS': '🇮🇸', 'ISL': '🇮🇸',
            'Liechtenstein': '🇱🇮', 'LI': '🇱🇮', 'LIE': '🇱🇮',
            'Monaco': '🇲🇨', 'MC': '🇲🇨', 'MCO': '🇲🇨',
            'San Marino': '🇸🇲', 'SM': '🇸🇲', 'SMR': '🇸🇲',
            'Vatican City': '🇻🇦', 'VA': '🇻🇦', 'VAT': '🇻🇦',
            'Andorra': '🇦🇩', 'AD': '🇦🇩', 'AND': '🇦🇩',
            // Asia
            'Japan': '🇯🇵', 'JP': '🇯🇵', 'JPN': '🇯🇵',
            'China': '🇨🇳', 'CN': '🇨🇳', 'CHN': '🇨🇳', 'People\'s Republic of China': '🇨🇳',
            'India': '🇮🇳', 'IN': '🇮🇳', 'IND': '🇮🇳',
            'South Korea': '🇰🇷', 'KR': '🇰🇷', 'KOR': '🇰🇷', 'Korea': '🇰🇷',
            'North Korea': '🇰🇵', 'KP': '🇰🇵', 'PRK': '🇰🇵',
            'Singapore': '🇸🇬', 'SG': '🇸🇬', 'SGP': '🇸🇬',
            'Malaysia': '🇲🇾', 'MY': '🇲🇾', 'MYS': '🇲🇾',
            'Thailand': '🇹🇭', 'TH': '🇹🇭', 'THA': '🇹🇭',
            'Indonesia': '🇮🇩', 'ID': '🇮🇩', 'IDN': '🇮🇩',
            'Philippines': '🇵🇭', 'PH': '🇵🇭', 'PHL': '🇵🇭',
            'Vietnam': '🇻🇳', 'VN': '🇻🇳', 'VNM': '🇻🇳',
            'Taiwan': '🇹🇼', 'TW': '🇹🇼', 'TWN': '🇹🇼',
            'Hong Kong': '🇭🇰', 'HK': '🇭🇰', 'HKG': '🇭🇰',
            'Macau': '🇲🇴', 'MO': '🇲🇴', 'MAC': '🇲🇴',
            'Bangladesh': '🇧🇩', 'BD': '🇧🇩', 'BGD': '🇧🇩',
            'Pakistan': '🇵🇰', 'PK': '🇵🇰', 'PAK': '🇵🇰',
            'Sri Lanka': '🇱🇰', 'LK': '🇱🇰', 'LKA': '🇱🇰',
            'Nepal': '🇳🇵', 'NP': '🇳🇵', 'NPL': '🇳🇵',
            'Myanmar': '🇲🇲', 'MM': '🇲🇲', 'MMR': '🇲🇲', 'Burma': '🇲🇲',
            'Cambodia': '🇰🇭', 'KH': '🇰🇭', 'KHM': '🇰🇭',
            'Laos': '🇱🇦', 'LA': '🇱🇦', 'LAO': '🇱🇦',
            'Brunei': '🇧🇳', 'BN': '🇧🇳', 'BRN': '🇧🇳',
            'Maldives': '🇲🇻', 'MV': '🇲🇻', 'MDV': '🇲🇻',
            'Afghanistan': '🇦🇫', 'AF': '🇦🇫', 'AFG': '🇦🇫',
            'Iran': '🇮🇷', 'IR': '🇮🇷', 'IRN': '🇮🇷',
            'Iraq': '🇮🇶', 'IQ': '🇮🇶', 'IRQ': '🇮🇶',
            'Israel': '🇮🇱', 'IL': '🇮🇱', 'ISR': '🇮🇱',
            'Palestine': '🇵🇸', 'PS': '🇵🇸', 'PSE': '🇵🇸',
            'Jordan': '🇯🇴', 'JO': '🇯🇴', 'JOR': '🇯🇴',
            'Lebanon': '🇱🇧', 'LB': '🇱🇧', 'LBN': '🇱🇧',
            'Syria': '🇸🇾', 'SY': '🇸🇾', 'SYR': '🇸🇾',
            'Saudi Arabia': '🇸🇦', 'SA': '🇸🇦', 'SAU': '🇸🇦',
            'United Arab Emirates': '🇦🇪', 'AE': '🇦🇪', 'ARE': '🇦🇪', 'UAE': '🇦🇪',
            'Qatar': '🇶🇦', 'QA': '🇶🇦', 'QAT': '🇶🇦',
            'Kuwait': '🇰🇼', 'KW': '🇰🇼', 'KWT': '🇰🇼',
            'Bahrain': '🇧🇭', 'BH': '🇧🇭', 'BHR': '🇧🇭',
            'Oman': '🇴🇲', 'OM': '🇴🇲', 'OMN': '🇴🇲',
            'Yemen': '🇾🇪', 'YE': '🇾🇪', 'YEM': '🇾🇪',
            'Turkey': '🇹🇷', 'TR': '🇹🇷', 'TUR': '🇹🇷',
            'Kazakhstan': '🇰🇿', 'KZ': '🇰🇿', 'KAZ': '🇰🇿',
            'Uzbekistan': '🇺🇿', 'UZ': '🇺🇿', 'UZB': '🇺🇿',
            'Azerbaijan': '🇦🇿', 'AZ': '🇦🇿', 'AZE': '🇦🇿',
            'Armenia': '🇦🇲', 'AM': '🇦🇲', 'ARM': '🇦🇲',
            'Georgia': '🇬🇪', 'GE': '🇬🇪', 'GEO': '🇬🇪',
            'Russia': '🇷🇺', 'RU': '🇷🇺', 'RUS': '🇷🇺', 'Russian Federation': '🇷🇺',
            'Mongolia': '🇲🇳', 'MN': '🇲🇳', 'MNG': '🇲🇳',
            // Americas
            'Brazil': '🇧🇷', 'BR': '🇧🇷', 'BRA': '🇧🇷',
            'Mexico': '🇲🇽', 'MX': '🇲🇽', 'MEX': '🇲🇽',
            'Argentina': '🇦🇷', 'AR': '🇦🇷', 'ARG': '🇦🇷',
            'Chile': '🇨🇱', 'CL': '🇨🇱', 'CHL': '🇨🇱',
            'Colombia': '🇨🇴', 'CO': '🇨🇴', 'COL': '🇨🇴',
            'Peru': '🇵🇪', 'PE': '🇵🇪', 'PER': '🇵🇪',
            'Venezuela': '🇻🇪', 'VE': '🇻🇪', 'VEN': '🇻🇪',
            'Ecuador': '🇪🇨', 'EC': '🇪🇨', 'ECU': '🇪🇨',
            'Uruguay': '🇺🇾', 'UY': '🇺🇾', 'URY': '🇺🇾',
            'Paraguay': '🇵🇾', 'PY': '🇵🇾', 'PRY': '🇵🇾',
            'Bolivia': '🇧🇴', 'BO': '🇧🇴', 'BOL': '🇧🇴',
            'Guyana': '🇬🇾', 'GY': '🇬🇾', 'GUY': '🇬🇾',
            'Suriname': '🇸🇷', 'SR': '🇸🇷', 'SUR': '🇸🇷',
            'French Guiana': '🇬🇫', 'GF': '🇬🇫', 'GUF': '🇬🇫',
            'Cuba': '🇨🇺', 'CU': '🇨🇺', 'CUB': '🇨🇺',
            'Jamaica': '🇯🇲', 'JM': '🇯🇲', 'JAM': '🇯🇲',
            'Haiti': '🇭🇹', 'HT': '🇭🇹', 'HTI': '🇭🇹',
            'Dominican Republic': '🇩🇴', 'DO': '🇩🇴', 'DOM': '🇩🇴',
            'Puerto Rico': '🇵🇷', 'PR': '🇵🇷', 'PRI': '🇵🇷',
            'Trinidad and Tobago': '🇹🇹', 'TT': '🇹🇹', 'TTO': '🇹🇹',
            'Barbados': '🇧🇧', 'BB': '🇧🇧', 'BRB': '🇧🇧',
            'Bahamas': '🇧🇸', 'BS': '🇧🇸', 'BHS': '🇧🇸',
            'Belize': '🇧🇿', 'BZ': '🇧🇿', 'BLZ': '🇧🇿',
            'Costa Rica': '🇨🇷', 'CR': '🇨🇷', 'CRI': '🇨🇷',
            'Panama': '🇵🇦', 'PA': '🇵🇦', 'PAN': '🇵🇦',
            'Nicaragua': '🇳🇮', 'NI': '🇳🇮', 'NIC': '🇳🇮',
            'Honduras': '🇭🇳', 'HN': '🇭🇳', 'HND': '🇭🇳',
            'El Salvador': '🇸🇻', 'SV': '🇸🇻', 'SLV': '🇸🇻',
            'Guatemala': '🇬🇹', 'GT': '🇬🇹', 'GTM': '🇬🇹',
            // Africa
            'South Africa': '🇿🇦', 'ZA': '🇿🇦', 'ZAF': '🇿🇦',
            'Egypt': '🇪🇬', 'EG': '🇪🇬', 'EGY': '🇪🇬',
            'Nigeria': '🇳🇬', 'NG': '🇳🇬', 'NGA': '🇳🇬',
            'Kenya': '🇰🇪', 'KE': '🇰🇪', 'KEN': '🇰🇪',
            'Ghana': '🇬🇭', 'GH': '🇬🇭', 'GHA': '🇬🇭',
            'Morocco': '🇲🇦', 'MA': '🇲🇦', 'MAR': '🇲🇦',
            'Algeria': '🇩🇿', 'DZ': '🇩🇿', 'DZA': '🇩🇿',
            'Tunisia': '🇹🇳', 'TN': '🇹🇳', 'TUN': '🇹🇳',
            'Libya': '🇱🇾', 'LY': '🇱🇾', 'LBY': '🇱🇾',
            'Sudan': '🇸🇩', 'SD': '🇸🇩', 'SDN': '🇸🇩',
            'Ethiopia': '🇪🇹', 'ET': '🇪🇹', 'ETH': '🇪🇹',
            'Tanzania': '🇹🇿', 'TZ': '🇹🇿', 'TZA': '🇹🇿',
            'Uganda': '🇺🇬', 'UG': '🇺🇬', 'UGA': '🇺🇬',
            'Zimbabwe': '🇿🇼', 'ZW': '🇿🇼', 'ZWE': '🇿🇼',
            'Zambia': '🇿🇲', 'ZM': '🇿🇲', 'ZMB': '🇿🇲',
            'Botswana': '🇧🇼', 'BW': '🇧🇼', 'BWA': '🇧🇼',
            'Namibia': '🇳🇦', 'NA': '🇳🇦', 'NAM': '🇳🇦',
            'Mozambique': '🇲🇿', 'MZ': '🇲🇿', 'MOZ': '🇲🇿',
            'Angola': '🇦🇴', 'AO': '🇦🇴', 'AGO': '🇦🇴',
            'Mauritius': '🇲🇺', 'MU': '🇲🇺', 'MUS': '🇲🇺',
            'Seychelles': '🇸🇨', 'SC': '🇸🇨', 'SYC': '🇸🇨',
            // Oceania
            'Australia': '🇦🇺', 'AU': '🇦🇺', 'AUS': '🇦🇺',
            'New Zealand': '🇳🇿', 'NZ': '🇳🇿', 'NZL': '🇳🇿',
            'Fiji': '🇫🇯', 'FJ': '🇫🇯', 'FJI': '🇫🇯',
            'Papua New Guinea': '🇵🇬', 'PG': '🇵🇬', 'PNG': '🇵🇬',
            'Samoa': '🇼🇸', 'WS': '🇼🇸', 'WSM': '🇼🇸',
            'Tonga': '🇹🇴', 'TO': '🇹🇴', 'TON': '🇹🇴',
            'Vanuatu': '🇻🇺', 'VU': '🇻🇺', 'VUT': '🇻🇺',
            'Solomon Islands': '🇸🇧', 'SB': '🇸🇧', 'SLB': '🇸🇧',
            'New Caledonia': '🇳🇨', 'NC': '🇳🇨', 'NCL': '🇳🇨',
            'French Polynesia': '🇵🇫', 'PF': '🇵🇫', 'PYF': '🇵🇫'
        };
        
        // Normalize country name for lookup (case-insensitive, trim whitespace)
        const normalized = countryName ? countryName.trim() : '';
        if (!normalized) return '🌍';
        
        // Try exact match first
        if (flagMap[normalized]) {
            return flagMap[normalized];
        }
        
        // Try case-insensitive match
        const upperNormalized = normalized.toUpperCase();
        for (const [key, flag] of Object.entries(flagMap)) {
            if (key.toUpperCase() === upperNormalized) {
                return flag;
            }
        }
        
        // Fallback to globe emoji
        return '🌍';
    }

    handleCheckImages(images) {
        if (!Array.isArray(images)) {
            return;
        }

        const groupedByTransaction = {};
        images.forEach(image => {
            const transactionId = image?.transactionId || image?.thirdfortTransactionId;
            if (!transactionId) return;
            if (!groupedByTransaction[transactionId]) {
                groupedByTransaction[transactionId] = [];
            }
            groupedByTransaction[transactionId].push({
                ...image,
                url: image.url || image.liveUrl || '',
                recordedAt: this.extractIdentityTimestamp(image)
            });
        });

        Object.keys(groupedByTransaction).forEach(transactionId => {
            const normalized = this.normalizeIdentityImages(groupedByTransaction[transactionId]);
            this.checkIdentityImages[transactionId] = normalized;

            const check = this.checks.find(c => c.transactionId === transactionId);
            if (check) {
                check.identityImages = normalized;
            }

            if (this.currentCheck && this.currentCheck.transactionId === transactionId) {
                this.currentCheck.identityImages = normalized;
                this.renderDetailView(this.currentCheck);
            }
        });
    }

    formatFundingLabel(value) {
        if (value === undefined || value === null) return '';
        if (typeof value !== 'string') value = String(value);
        const trimmed = value.trim();
        if (!trimmed) return '';
        const acronyms = new Set(['hsbc', 'tsb', 'rbs', 'uk', 'usa', 'isa', 'lisa', 'htb', 'aml', 'sow', 'kyc', 'pep', 'ltd']);
        return trimmed.split(/[\s_\-]+/).map(part => {
            const lower = part.toLowerCase();
            if (acronyms.has(lower) || lower.length <= 3) {
                return lower.toUpperCase();
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    }

    formatFundingFrequency(value) {
        if (!value) return '';
        return this.formatFundingLabel(value);
    }

    formatCurrencyMinor(amount, { fallback = 'Not provided', currency = '£' } = {}) {
        if (typeof amount !== 'number' || Number.isNaN(amount)) return fallback;
        const isWhole = amount % 100 === 0;
        const absolute = amount / 100;
        const options = {
            minimumFractionDigits: isWhole ? 0 : 2,
            maximumFractionDigits: isWhole ? 0 : 2
        };
        return `${currency}${absolute.toLocaleString('en-GB', options)}`;
    }

    formatShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getIso2FromLocation(location) {
        if (!location) return '';
        const trimmed = location.trim();
        if (!trimmed) return '';
        const upper = trimmed.toUpperCase();
        const iso3ToIso2 = {
            'GBR': 'GB',
            'IRL': 'IE',
            'USA': 'US',
            'CAN': 'CA',
            'AUS': 'AU',
            'NZL': 'NZ',
            'FRA': 'FR',
            'DEU': 'DE',
            'ESP': 'ES',
            'ITA': 'IT',
            'PRT': 'PT',
            'CHE': 'CH',
            'SGP': 'SG',
            'HKG': 'HK',
            'ARE': 'AE',
            'QAT': 'QA',
            'BHR': 'BH',
            'KWT': 'KW',
            'SAU': 'SA',
            'ZAF': 'ZA',
            'BRA': 'BR',
            'ARG': 'AR',
            'MEX': 'MX',
            'BEL': 'BE',
            'NLD': 'NL',
            'SWE': 'SE',
            'NOR': 'NO',
            'DNK': 'DK',
            'POL': 'PL',
            'CZE': 'CZ',
            'HUN': 'HU',
            'ROU': 'RO',
            'ISL': 'IS',
            'JPN': 'JP',
            'CHN': 'CN',
            'IND': 'IN',
            'PAK': 'PK',
            'KEN': 'KE',
            'GHA': 'GH',
            'NGA': 'NG',
            'UGA': 'UG',
            'ZMB': 'ZM',
            'ZWE': 'ZW'
        };
        if (iso3ToIso2[upper]) return iso3ToIso2[upper];
        if (upper.length === 2) return upper;
        const nameToIso2 = {
            'UNITED KINGDOM': 'GB',
            'GREAT BRITAIN': 'GB',
            'ENGLAND': 'GB',
            'SCOTLAND': 'GB',
            'WALES': 'GB',
            'NORTHERN IRELAND': 'GB',
            'UK': 'GB',
            'UNITED STATES': 'US',
            'UNITED STATES OF AMERICA': 'US',
            'AMERICA': 'US',
            'IRELAND': 'IE',
            'REPUBLIC OF IRELAND': 'IE',
            'FRANCE': 'FR',
            'GERMANY': 'DE',
            'SPAIN': 'ES',
            'ITALY': 'IT',
            'PORTUGAL': 'PT',
            'AUSTRALIA': 'AU',
            'CANADA': 'CA',
            'NEW ZEALAND': 'NZ',
            'SINGAPORE': 'SG',
            'HONG KONG': 'HK',
            'SWITZERLAND': 'CH',
            'SOUTH AFRICA': 'ZA',
            'INDIA': 'IN',
            'JAPAN': 'JP',
            'UNITED ARAB EMIRATES': 'AE',
            'UAE': 'AE'
        };
        if (nameToIso2[upper]) return nameToIso2[upper];
        return '';
    }

    countryCodeToEmoji(code) {
        if (!code || code.length !== 2) return '';
        // Convert country code to actual Unicode emoji characters
        // Each flag emoji is made of two regional indicator symbols (A-Z = 0x1F1E6-0x1F1FF)
        return code.toUpperCase().split('').map(char => {
            const base = 0x1F1E6; // Regional Indicator Symbol Letter A
            const codePoint = base + (char.charCodeAt(0) - 65); // A=65, so subtract 65
            // Convert to actual Unicode emoji character
            return String.fromCodePoint(codePoint);
        }).join('');
    }

    getLocationDisplay(location) {
        if (!location) return '';
        const trimmed = location.trim();
        if (!trimmed) return '';
        const iso2 = this.getIso2FromLocation(trimmed);
        const upper = trimmed.toUpperCase();
        const displayCode = upper.length === 2 || upper.length === 3 ? upper : (iso2 || upper);
        if (!displayCode) return '';
        const flag = iso2 ? this.countryCodeToEmoji(iso2) : '';
        return `${flag || '🌍'} ${displayCode}`;
    }

    getFundingOriginBadge(location) {
        const display = this.getLocationDisplay(location);
        if (!display) return '';
        return `<span class="funding-origin-badge">${display}</span>`;
    }

    renderMetaRow(label, value, { raw = false, className = '' } = {}) {
        if (value === undefined || value === null) return '';
        let content = raw ? value : String(value);
        if (!raw) {
            content = content.trim();
            if (!content) return '';
        }
        return `<div class="funding-meta-row${className ? ' ' + className : ''}"><span class="funding-meta-label">${label}</span><span class="funding-meta-value">${content}</span></div>`;
    }

    renderOriginMetaRow(location) {
        const badge = this.getFundingOriginBadge(location);
        if (!badge) return '';
        return this.renderMetaRow('Origin', badge, { raw: true });
    }

    getDocumentCount(outcome) {
        if (!outcome) return 0;
        if (Array.isArray(outcome.documents)) return outcome.documents.length;
        if (Array.isArray(outcome.breakdown?.documents)) return outcome.breakdown.documents.length;
        if (typeof outcome.breakdown?.document_count === 'number') return outcome.breakdown.document_count;
        if (typeof outcome.data?.document_count === 'number') return outcome.data.document_count;
        if (Array.isArray(outcome.data?.documents)) return outcome.data.documents.length;
        return 0;
    }

    formatFundingLabel(value) {
        if (value === undefined || value === null) return '';
        if (typeof value !== 'string') {
            value = String(value);
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return '';
        }
        const acronyms = new Set(['hsbc', 'tsb', 'rbs', 'lloyds', 'natwest', 'uk', 'usa', 'isa', 'lisa', 'psa', 'sow', 'aml', 'ftb', 'htb', 'fca', 'sra']);
        return trimmed.split(/[\s_\-]+/).map(part => {
            const lower = part.toLowerCase();
            if (acronyms.has(lower) || lower.length <= 3) {
                return lower.toUpperCase();
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(' ');
    }

    formatFundingFrequency(value) {
        if (!value) return '';
        return this.formatFundingLabel(value);
    }

    formatCurrencyMinor(amount, { fallback = 'Not provided', currency = '£' } = {}) {
        if (typeof amount !== 'number' || Number.isNaN(amount)) {
            return fallback;
        }
        const isWhole = amount % 100 === 0;
        const absolute = amount / 100;
        const options = {
            minimumFractionDigits: isWhole ? 0 : 2,
            maximumFractionDigits: isWhole ? 0 : 2
        };
        return `${currency}${absolute.toLocaleString('en-GB', options)}`;
    }

    formatShortDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    getIso2FromLocation(location) {
        if (!location) return '';
        const trimmed = location.trim();
        if (!trimmed) return '';
        const upper = trimmed.toUpperCase();
        const iso3ToIso2 = {
            'GBR': 'GB',
            'IRL': 'IE',
            'USA': 'US',
            'CAN': 'CA',
            'AUS': 'AU',
            'NZL': 'NZ',
            'FRA': 'FR',
            'DEU': 'DE',
            'ESP': 'ES',
            'ITA': 'IT',
            'PRT': 'PT',
            'CHE': 'CH',
            'SGP': 'SG',
            'HKG': 'HK',
            'ARE': 'AE',
            'QAT': 'QA',
            'BHR': 'BH',
            'KWT': 'KW',
            'SAU': 'SA',
            'ZAF': 'ZA',
            'BRA': 'BR',
            'ARG': 'AR',
            'MEX': 'MX',
            'BEL': 'BE',
            'NLD': 'NL',
            'SWE': 'SE',
            'NOR': 'NO',
            'DNK': 'DK',
            'POL': 'PL',
            'CZE': 'CZ',
            'HUN': 'HU',
            'ROU': 'RO',
            'ISL': 'IS',
            'JPN': 'JP',
            'CHN': 'CN',
            'IND': 'IN',
            'PAK': 'PK',
            'KEN': 'KE',
            'GHA': 'GH',
            'NGA': 'NG',
            'UGA': 'UG',
            'ZMB': 'ZM',
            'ZWE': 'ZW'
        };
        if (iso3ToIso2[upper]) {
            return iso3ToIso2[upper];
        }
        if (upper.length === 2) {
            return upper;
        }
        const nameToIso2 = {
            'UNITED KINGDOM': 'GB',
            'GREAT BRITAIN': 'GB',
            'ENGLAND': 'GB',
            'SCOTLAND': 'GB',
            'WALES': 'GB',
            'NORTHERN IRELAND': 'GB',
            'UK': 'GB',
            'UNITED STATES': 'US',
            'UNITED STATES OF AMERICA': 'US',
            'AMERICA': 'US',
            'IRELAND': 'IE',
            'REPUBLIC OF IRELAND': 'IE',
            'FRANCE': 'FR',
            'GERMANY': 'DE',
            'SPAIN': 'ES',
            'ITALY': 'IT',
            'PORTUGAL': 'PT',
            'AUSTRALIA': 'AU',
            'CANADA': 'CA',
            'NEW ZEALAND': 'NZ',
            'SINGAPORE': 'SG',
            'HONG KONG': 'HK',
            'SWITZERLAND': 'CH',
            'SOUTH AFRICA': 'ZA',
            'INDIA': 'IN',
            'JAPAN': 'JP',
            'UNITED ARAB EMIRATES': 'AE',
            'UAE': 'AE'
        };
        if (nameToIso2[upper]) {
            return nameToIso2[upper];
        }
        return '';
    }

    countryCodeToEmoji(code) {
        if (!code || code.length !== 2) return '';
        // Convert country code to actual Unicode emoji characters
        // Each flag emoji is made of two regional indicator symbols (A-Z = 0x1F1E6-0x1F1FF)
        return code.toUpperCase().split('').map(char => {
            const base = 0x1F1E6; // Regional Indicator Symbol Letter A
            const codePoint = base + (char.charCodeAt(0) - 65); // A=65, so subtract 65
            // Convert to actual Unicode emoji character
            return String.fromCodePoint(codePoint);
        }).join('');
    }

    getLocationDisplay(location) {
        if (!location) return '';
        const trimmed = location.trim();
        if (!trimmed) return '';
        const iso2 = this.getIso2FromLocation(trimmed);
        const upper = trimmed.toUpperCase();
        const displayCode = upper.length === 2 || upper.length === 3 ? upper : (iso2 || upper);
        if (!displayCode) return '';
        const flag = iso2 ? this.countryCodeToEmoji(iso2) : '';
        return `${flag || '🌍'} ${displayCode}`;
    }

    getFundingOriginBadge(location) {
        const display = this.getLocationDisplay(location);
        if (!display) return '';
        return `<span class="funding-origin-badge">${display}</span>`;
    }

    renderMetaRow(label, value, { raw = false, className = '' } = {}) {
        if (value === undefined || value === null) return '';
        let content = raw ? value : String(value);
        if (!raw) {
            content = content.trim();
            if (!content) return '';
        }
        return `<div class="funding-meta-row${className ? ' ' + className : ''}"><span class="funding-meta-label">${label}</span><span class="funding-meta-value">${content}</span></div>`;
    }

    renderOriginMetaRow(location) {
        const badge = this.getFundingOriginBadge(location);
        if (!badge) return '';
        return this.renderMetaRow('Origin', badge, { raw: true });
    }

    getDocumentCount(outcome) {
        if (!outcome) return 0;
        if (Array.isArray(outcome.documents)) {
            return outcome.documents.length;
        }
        if (Array.isArray(outcome.breakdown?.documents)) {
            return outcome.breakdown.documents.length;
        }
        if (typeof outcome.breakdown?.document_count === 'number') {
            return outcome.breakdown.document_count;
        }
        if (typeof outcome.data?.document_count === 'number') {
            return outcome.data.document_count;
        }
        if (Array.isArray(outcome.data?.documents)) {
            return outcome.data.documents.length;
        }
        return 0;
    }
    
    deduplicatePeople(owners, officers) {
        // Remove owners who are already listed as officers (same person in multiple roles)
        // Match by name and date of birth (if available)
        if (!officers || !Array.isArray(officers) || officers.length === 0) {
            return owners;
        }
        
        const officerNames = new Set();
        officers.forEach(officer => {
            const name = officer.name?.toLowerCase().trim();
            const dob = officer.dob;
            if (name) {
                // Create a unique key combining name and DOB (if available)
                const key = dob ? `${name}|${dob}` : name;
                officerNames.add(key);
            }
        });
        
        return owners.filter(owner => {
            const name = (owner.fullName || owner.organizationName || '').toLowerCase().trim();
            const dob = owner.dateOfBirth;
            if (!name) return true; // Keep if no name
            
            const key = dob ? `${name}|${dob}` : name;
            return !officerNames.has(key);
        });
    }
    
    formatNatureOfControl(controlTypes) {
        // Simplify long nature of control descriptions
        if (!controlTypes || !Array.isArray(controlTypes) || controlTypes.length === 0) {
            return '';
        }
        
        return controlTypes.map(control => {
            // Simplify common patterns
            return control
                .replace(/Ownership of (\d+% to \d+%|\d+%) of voting rights/gi, '$1 voting rights')
                .replace(/Right to share (\d+% to \d+%|\d+%) of surplus assets/gi, '$1 surplus assets')
                .replace(/Right to appoint and remove directors/gi, 'Appoint/remove directors')
                .replace(/Right to appoint and remove members/gi, 'Appoint/remove members')
                .replace(/Significant influence or control/gi, 'Significant influence')
                .replace(/of a limited liability partnership/gi, '(LLP)')
                .replace(/of a company/gi, '');
        }).join('; ');
    }
    
    calculateRiskLevel(hit, updateType) {
        // For sanctions, always show as critical
        if (updateType === 'sanctions') {
            return '<span class="risk-level critical">CRITICAL</span>';
        }
        
        // For PEP, categorize based on position (following ComplyAdvantage levels)
        const position = (hit.position || '').toLowerCase();
        
        // Level 1: High Risk - Heads of state, government, national parliament
        const level1Keywords = ['head of state', 'head of government', 'royal family', 'president', 'prime minister', 
                               'minister', 'member of parliament', 'mp ', 'senator', 'central bank', 'military', 
                               'judiciary', 'supreme court', 'political party'];
        if (level1Keywords.some(kw => position.includes(kw))) {
            return '<span class="risk-level level-1">LEVEL 1</span>';
        }
        
        // Level 2: Medium Risk - Regional government, international organizations, diplomats
        const level2Keywords = ['regional', 'ambassador', 'consul', 'diplomat', 'international', 'supranational', 
                               'united nations', 'european commission', 'high commissioner'];
        if (level2Keywords.some(kw => position.includes(kw))) {
            return '<span class="risk-level level-2">LEVEL 2</span>';
        }
        
        // Level 3: Medium Risk - State-owned enterprises, regional institutions
        const level3Keywords = ['state-owned', 'state owned', 'regional government', 'agency head', 
                               'board of directors'];
        if (level3Keywords.some(kw => position.includes(kw))) {
            return '<span class="risk-level level-3">LEVEL 3</span>';
        }
        
        // Level 4: Low Risk - Local government, local judiciary
        return '<span class="risk-level level-4">LEVEL 4</span>';
    }
    
    getHintIcon(level) {
        const icons = {
            // Info icon (blue square with i)
            info: `<svg viewBox="0 0 156.11 156.11" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" stroke="#1d71b8" stroke-linecap="round" stroke-linejoin="round" stroke-width="8.11" d="M152.05 9.72v136.66a5.67 5.67 0 0 1-5.67 5.67H9.72a5.67 5.67 0 0 1-5.67-5.67V9.72a5.67 5.67 0 0 1 5.67-5.67h136.66a5.67 5.67 0 0 1 5.67 5.67"/><path d="M88.45 39.72c.12 4.61-1.43 8.2-4.65 10.78-7.39 2.94-12.61 1.14-15.68-5.39-1.63-7.35.98-12.08 7.84-14.21 6.74-.12 10.9 2.82 12.49 8.82M73.02 58.34h14.21v66.87H68.86V58.34z" fill="#1d71b8"/></g></svg>`,
            // Warning/Consider icon (orange triangle with !)
            warning: `<svg viewBox="0 0 159.77 154.5" xmlns="http://www.w3.org/2000/svg"><g><path stroke="#f39200" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="8.5" d="m79.88 4.25-75.63 146h151.27z"/><path d="M73.63 124c0-3.37 2.78-6.35 6.25-6.35s6.25 2.98 6.25 6.35-2.78 6.25-6.25 6.25-6.25-2.88-6.25-6.25Zm11.71-56.95c0 3.67-1.09 13.1-2.38 26.99l-1.29 13.79H78.1l-1.29-13.79c-1.29-13.89-2.38-23.32-2.38-26.99 0-4.27 2.08-6.05 5.46-6.05s5.46 1.79 5.46 6.05Z" fill="#f39200" stroke-miterlimit="10" stroke-width="5.67" stroke="#f39200"/></g></svg>`,
            // Alert/Fail icon (red circle with X cross)
            alert: `<svg viewBox="0 0 156.11 156.11" xmlns="http://www.w3.org/2000/svg"><g><path stroke="#e30613" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-width="8.11" d="M152.05 78.05c0 40.87-33.13 74-74 74q0 0 0 0c-40.87 0-74-33.13-74-74q0 0 0 0c0-40.87 33.13-74 74-74q0 0 0 0c40.87 0 74 33.13 74 74"/><path fill="#1d1d1b" stroke-width="11.34" stroke="#e30613" stroke-linecap="round" stroke-linejoin="round" d="m44.82 44.82 66.47 66.47"/><path fill="#1d1d1b" stroke-width="11.34" stroke="#e30613" stroke-linecap="round" stroke-linejoin="round" d="m111.29 44.82-66.47 66.47"/></g></svg>`
        };
        return icons[level] || '';
    }
    
    getTaskTitle(taskType) {
        const titles = {
            'address': 'Address Verification',
            'footprint': 'Digital Footprint',
            'screening': 'Screening',
            'peps': 'PEP Screening',
            'sanctions': 'Sanctions Screening',
            'identity': 'Identity Verification',
            'identity:lite': 'Document Verification',
            'nfc': 'NFC Chip Verification',
            'liveness': 'Liveness Check',
            'facial_similarity': 'Facial Similarity',
            'document': 'Document Authenticity',
            'sof:v1': 'Source of Funds Questionnaire',
            'bank': 'Bank Summary',
            'bank:statement': 'Bank Summary',
            'bank:summary': 'Bank Summary',
            'documents:poa': 'Proof of Address',
            'documents:poo': 'Proof of Ownership',
            'documents:savings': 'Proof of Savings',
            'documents:cryptocurrency': 'Proof of Cryptocurrency',
            'documents:other': 'Additional Documents',
            'company:summary': 'Company Summary',
            'company:sanctions': 'Company Sanctions',
            'company:peps': 'Company PEP Screening',
            'company:ubo': 'Ultimate Beneficial Owner',
            'company:beneficial-check': 'PSC Extract',
            'company:shareholders': 'Shareholders'
        };
        return titles[taskType] || taskType;
    }
    
    getTaskSummary(taskType, outcome) {
        const result = outcome.result;
        
        if (result === 'clear') {
            return 'All checks sufficient';
        } else if (result === 'consider') {
            return 'Some concerns identified - review required';
        } else if (result === 'fail') {
            return 'Verification failed - manual review required';
        }
        
        return 'Processing...';
    }
    
    getTaskChecks(taskType, outcome, check) {
        const checks = [];
        const data = outcome.data || {};
        
        // Task-specific checks based on type
        if (taskType === 'document') {
            // Document objectives: authenticity, integrity, compromised, consistency, validation
            if (data.authenticity) {
                const isGenuine = data.authenticity === 'genuine';
                checks.push({
                    status: isGenuine ? 'CL' : 'AL',
                    text: `Authenticity: ${data.authenticity}`
                });
            }
            
            if (data.integrity) {
                const isPassed = data.integrity === 'passed';
                checks.push({
                    status: isPassed ? 'CL' : 'AL',
                    text: `Integrity: ${data.integrity}`
                });
            }
            
            if (data.compromised) {
                const isNotCompromised = data.compromised === 'no' || data.compromised === 'false';
                checks.push({
                    status: isNotCompromised ? 'CL' : 'AL',
                    text: `Compromised check: ${data.compromised}`
                });
            }
            
            if (data.consistency) {
                checks.push({
                    status: data.consistency === 'consistent' ? 'CL' : 'CO',
                    text: `Consistency: ${data.consistency}`
                });
            }
            
            if (data.validation) {
                checks.push({
                    status: data.validation === 'valid' ? 'CL' : 'AL',
                    text: `Validation: ${data.validation}`
                });
            }
        }
        else if (taskType === 'facial_similarity') {
            // Facial similarity objectives: comparison, authenticity, integrity, variant
            if (data.comparison) {
                const isGoodMatch = data.comparison === 'good_match';
                checks.push({
                    status: isGoodMatch ? 'CL' : 'CO',
                    text: `Comparison: ${data.comparison.replace('_', ' ')}`
                });
            }
            
            if (data.authenticity) {
                checks.push({
                    status: data.authenticity === 'genuine' ? 'CL' : 'AL',
                    text: `Authenticity: ${data.authenticity}`
                });
            }
            
            if (data.integrity) {
                checks.push({
                    status: data.integrity === 'passed' ? 'CL' : 'AL',
                    text: `Integrity: ${data.integrity}`
                });
            }
            
            if (data.variant) {
                checks.push({
                    status: 'CN',
                    text: `Variant: ${data.variant}`
                });
            }
        }
        else if (taskType === 'peps' || taskType === 'sanctions' || 
                 taskType === 'company:peps' || taskType === 'company:sanctions') {
            const breakdown = outcome.breakdown || {};
            const totalHits = breakdown.total_hits || data.total_hits || 0;
            const hits = breakdown.hits || data.hits || [];
            const matches = breakdown.matches || data.matches || [];
            
            checks.push({
                status: totalHits === 0 ? 'CL' : 'CO',
                text: `${totalHits} match${totalHits !== 1 ? 'es' : ''} found`
            });
            
            // Show individual hits if available
            const hitsList = hits.length > 0 ? hits : matches;
            if (hitsList.length > 0) {
                hitsList.forEach(hit => {
                    const name = hit.name || 'Unknown';
                    const list = hit.sanctions_list || hit.position || '';
                    const country = hit.country || '';
                    const reason = hit.reason || hit.relationship || '';
                    
                    let hitText = name;
                    if (list) hitText += ` - ${list}`;
                    if (country) hitText += ` [${country}]`;
                    if (reason) hitText += ` | ${reason}`;
                    
                    checks.push({
                        status: 'CO',
                        text: hitText,
                        indented: true
                    });
                });
            }
            
            if (data.monitored !== undefined || breakdown.monitored !== undefined) {
                const isMonitored = data.monitored || breakdown.monitored;
                checks.push({
                    status: isMonitored ? 'CL' : 'AL',
                    text: isMonitored ? 'Ongoing monitoring enabled' : 'Monitoring disabled'
                });
            }
        }
        else if (taskType === 'nfc') {
            // NFC chip verification with detailed breakdown
            const breakdown = outcome.breakdown || {};
            
            // Check for chip data
            if (breakdown.chip) {
                const chipBreakdown = breakdown.chip.breakdown || {};
                
                // Clone detection
                if (chipBreakdown.clone_detection) {
                    const result = chipBreakdown.clone_detection.result || '';
                    checks.push({
                        status: result === 'clear' ? 'CL' : 'AL',
                        text: 'Clone Detection'
                    });
                }
                
                // Chip verification
                if (chipBreakdown.verification) {
                    const result = chipBreakdown.verification.result || '';
                    checks.push({
                        status: result === 'clear' ? 'CL' : 'AL',
                        text: 'Chip Verification'
                    });
                }
            }
            
            // Data comparison
            if (breakdown.data_comparison) {
                const compBreakdown = breakdown.data_comparison.breakdown || {};
                
                // DOB comparison
                if (compBreakdown.dob) {
                    const result = compBreakdown.dob.result || '';
                    const daysDiff = compBreakdown.dob.properties?.days_difference;
                    let text = 'Date of Birth Match';
                    if (daysDiff !== undefined && daysDiff !== 0) {
                        text += ` (${daysDiff} days difference)`;
                    }
                    checks.push({
                        status: result === 'clear' ? 'CL' : 'CO',
                        text: text
                    });
                }
                
                // Name comparison
                if (compBreakdown.name) {
                    const result = compBreakdown.name.result || '';
                    const levenshtein = compBreakdown.name.properties?.levenshtein_pct;
                    let text = 'Name Match';
                    if (levenshtein !== undefined) {
                        text += ` (${levenshtein}% similarity)`;
                    }
                    checks.push({
                        status: result === 'clear' ? 'CL' : 'CO',
                        text: text
                    });
                }
            }
            
            // Fallback for simple data
            if (!breakdown.chip && !breakdown.data_comparison && data.chip_read !== undefined) {
                checks.push({
                    status: data.chip_read ? 'CL' : 'AL',
                    text: data.chip_read ? 'NFC chip successfully read' : 'Could not read NFC chip'
                });
            }
        }
        else if (taskType === 'biometrics') {
            // Biometric verification (liveness detection)
            const breakdown = outcome.breakdown || {};
            
            if (breakdown.attempts && Array.isArray(breakdown.attempts) && breakdown.attempts.length > 0) {
                breakdown.attempts.forEach((attempt, index) => {
                    const passed = attempt.passed;
                    const status_val = attempt.status || '';
                    checks.push({
                        status: passed ? 'CL' : 'AL',
                        text: `Liveness Attempt ${index + 1}: ${status_val === 'complete' ? 'Completed' : status_val}`
                    });
                });
            } else {
                // Simple status
                checks.push({
                    status: outcome.result === 'clear' ? 'CL' : 'CO',
                    text: outcome.result === 'clear' ? 'Biometric verification passed' : 'Biometric verification requires review'
                });
            }
        }
        else if (taskType === 'identity') {
            // Identity verification (overall check) with detailed breakdown
            const breakdown = outcome.breakdown || {};
            
            // Add header checks for NFC and Biometrics status
            const nfcTask = breakdown.nfc;
            const biometricsTask = breakdown.biometrics;
            
            // Check if Enhanced ID was requested
            const requestTasks = check.thirdfortResponse?.request?.tasks || [];
            const identityRequest = requestTasks.find(t => t.type === 'report:identity');
            const nfcPreferred = identityRequest?.opts?.nfc === 'preferred';
            
            // If Enhanced ID was requested, show NFC status and Original ID status
            if (nfcPreferred) {
                // Show NFC status
                if (nfcTask?.status === 'unobtainable') {
                    checks.push({
                        status: 'CO',
                        text: 'NFC Scan unobtainable'
                    });
                } else if (nfcTask?.result === 'consider') {
                    checks.push({
                        status: 'CO',
                        text: 'NFC verification requires review'
                    });
                } else if (nfcTask?.result === 'clear') {
                    checks.push({
                        status: 'CL',
                        text: 'NFC Scan completed'
                    });
                }
                
                // Show Biometrics status if unobtainable
                if (biometricsTask?.status === 'unobtainable') {
                    checks.push({
                        status: 'CO',
                        text: 'Biometric Scan unobtainable'
                    });
                }
                
                // Always show Original ID completion status when Enhanced was requested
                if (breakdown.document) {
                    const docResult = breakdown.document.result || 'clear';
                    const docStatus = docResult === 'clear' ? 'CL' : (docResult === 'fail' ? 'AL' : 'CO');
                    checks.push({
                        status: docStatus,
                        text: 'Original ID completed'
                    });
                }
            }
            
            // 1. Document Verification (nested collapsible card)
            if (breakdown.document) {
                const docData = breakdown.document.data || {};
                const docBreakdown = breakdown.document.breakdown || {};
                let docResult = breakdown.document.result || '';
                
                // Recalculate document result based on breakdown categories
                if (Object.keys(docBreakdown).length > 0) {
                    let hasConsider = false;
                    let hasFail = false;
                    Object.values(docBreakdown).forEach(category => {
                        const catResult = category.result || '';
                        if (catResult === 'fail') hasFail = true;
                        if (catResult === 'consider') hasConsider = true;
                    });
                    if (hasFail) docResult = 'fail';
                    else if (hasConsider) docResult = 'consider';
                }
                
                const docObjectives = [];
                
                // Check for detailed breakdown structure (like Se's check)
                if (Object.keys(docBreakdown).length > 0) {
                    // Helper function to process category and show nested items when needed
                    const processCategory = (category, categoryName) => {
                        if (!category) return;
                        
                        const catBreakdown = category.breakdown || {};
                        const catResult = category.result || '';
                        
                        // If category has nested breakdown
                        if (Object.keys(catBreakdown).length > 0) {
                            // If parent category is consider/fail, show parent + ALL nested items indented
                            if (catResult !== 'clear') {
                                // Add parent category header
                                docObjectives.push({
                                    status: catResult === 'fail' ? 'AL' : 'CO',
                                    text: categoryName,
                                    isParent: true
                                });
                                
                                // Add all nested items indented
                                Object.entries(catBreakdown).forEach(([key, subCheck]) => {
                                    const subResult = subCheck.result || '';
                                    const formattedKey = key.replace(/_/g, ' ')
                                        .split(' ')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
                                    docObjectives.push({
                                        status: subResult === 'clear' ? 'CL' : (subResult === 'fail' ? 'AL' : 'CO'),
                                        text: formattedKey,
                                        isIndented: true
                                    });
                                });
                            } else {
                                // Parent is clear - just show the category name
                                docObjectives.push({
                                    status: 'CL',
                                    text: categoryName
                                });
                            }
                        } else {
                            // No nested breakdown, show the category itself
                            docObjectives.push({
                                status: catResult === 'clear' ? 'CL' : (catResult === 'fail' ? 'AL' : 'CO'),
                                text: categoryName
                            });
                        }
                    };
                    
                    // Process all document categories
                    processCategory(docBreakdown.visual_authenticity, 'Visual Authenticity');
                    processCategory(docBreakdown.image_integrity, 'Image Integrity');
                    processCategory(docBreakdown.data_validation, 'Data Validation');
                    processCategory(docBreakdown.data_consistency, 'Data Consistency');
                    processCategory(docBreakdown.data_comparison, 'Data Comparison');
                    processCategory(docBreakdown.compromised_document, 'Compromised Check');
                    processCategory(docBreakdown.age_validation, 'Age Validation');
                    processCategory(docBreakdown.police_record, 'Police Record');
                } else if (Object.keys(docData).length > 0) {
                    // Simple data structure (like Benjamin's check)
                    if (docData.authenticity) {
                        docObjectives.push({ status: docData.authenticity === 'clear' ? 'CL' : 'AL', text: 'Authenticity' });
                    }
                    if (docData.integrity) {
                        docObjectives.push({ status: docData.integrity === 'clear' ? 'CL' : 'AL', text: 'Integrity' });
                    }
                    if (docData.compromised) {
                        docObjectives.push({ status: docData.compromised === 'clear' ? 'CL' : 'AL', text: 'Compromised Check' });
                    }
                    if (docData.consistency) {
                        docObjectives.push({ status: docData.consistency === 'clear' ? 'CL' : 'CO', text: 'Consistency' });
                    }
                    if (docData.validation) {
                        docObjectives.push({ status: docData.validation === 'clear' ? 'CL' : 'AL', text: 'Validation' });
                    }
                }
                
                checks.push({
                    isNestedCard: true,
                    title: 'Document Verification',
                    result: docResult,
                    items: docObjectives
                });
            }
            
            // 2. Facial Similarity (nested collapsible card)
            if (breakdown.facial_similarity || breakdown.facial_similarity_video) {
                // Prioritize facial_similarity_video if both exist (has more detailed breakdown)
                const faceTask = breakdown.facial_similarity_video || breakdown.facial_similarity;
                const faceData = faceTask.data || {};
                const faceBreakdown = faceTask.breakdown || {};
                const faceResult = faceTask.result || '';
                
                const faceObjectives = [];
                
                // Check for detailed breakdown structure (like Se's check)
                if (Object.keys(faceBreakdown).length > 0) {
                    // Detailed breakdown with categories and sub-checks
                    
                    // Face Comparison (with score if available)
                    if (faceBreakdown.face_comparison) {
                        const faceCompBreakdown = faceBreakdown.face_comparison.breakdown || {};
                        const faceCompResult = faceBreakdown.face_comparison.result || '';
                        
                        // Check for face_match with score
                        if (faceCompBreakdown.face_match) {
                            const score = faceCompBreakdown.face_match.properties?.score;
                            const scoreText = score ? ` (${(score * 100).toFixed(1)}% match)` : '';
                            faceObjectives.push({ 
                                status: faceCompBreakdown.face_match.result === 'clear' ? 'CL' : 'CO', 
                                text: `Face Match${scoreText}` 
                            });
                        } else {
                            faceObjectives.push({ 
                                status: faceCompResult === 'clear' ? 'CL' : 'CO', 
                                text: 'Face Comparison' 
                            });
                        }
                    }
                    
                    // Image Integrity (with sub-checks)
                    if (faceBreakdown.image_integrity) {
                        const imgIntBreakdown = faceBreakdown.image_integrity.breakdown || {};
                        
                        if (imgIntBreakdown.face_detected) {
                            faceObjectives.push({ 
                                status: imgIntBreakdown.face_detected.result === 'clear' ? 'CL' : 'AL', 
                                text: 'Face Detected' 
                            });
                        }
                        if (imgIntBreakdown.source_integrity) {
                            faceObjectives.push({ 
                                status: imgIntBreakdown.source_integrity.result === 'clear' ? 'CL' : 'AL', 
                                text: 'Source Integrity' 
                            });
                        }
                        
                        // If no sub-checks, show overall
                        if (Object.keys(imgIntBreakdown).length === 0) {
                            faceObjectives.push({ 
                                status: faceBreakdown.image_integrity.result === 'clear' ? 'CL' : 'AL', 
                                text: 'Image Integrity' 
                            });
                        }
                    }
                    
                    // Visual Authenticity (with sub-checks and scores)
                    if (faceBreakdown.visual_authenticity) {
                        const visAuthBreakdown = faceBreakdown.visual_authenticity.breakdown || {};
                        
                        if (visAuthBreakdown.liveness_detected) {
                            faceObjectives.push({ 
                                status: visAuthBreakdown.liveness_detected.result === 'clear' ? 'CL' : 'AL', 
                                text: 'Liveness Detected' 
                            });
                        }
                        if (visAuthBreakdown.spoofing_detection) {
                            const spoofScore = visAuthBreakdown.spoofing_detection.properties?.score;
                            const spoofText = spoofScore ? ` (${(spoofScore * 100).toFixed(1)}% confidence)` : '';
                            faceObjectives.push({ 
                                status: visAuthBreakdown.spoofing_detection.result === 'clear' ? 'CL' : 'AL', 
                                text: `Spoofing Detection${spoofText}` 
                            });
                        }
                        
                        // If no sub-checks, show overall
                        if (Object.keys(visAuthBreakdown).length === 0) {
                            faceObjectives.push({ 
                                status: faceBreakdown.visual_authenticity.result === 'clear' ? 'CL' : 'AL', 
                                text: 'Visual Authenticity' 
                            });
                        }
                    }
                } else if (Object.keys(faceData).length > 0) {
                    // Simple data structure (like Benjamin's check)
                    if (faceData.authenticity) {
                        faceObjectives.push({ status: faceData.authenticity === 'clear' ? 'CL' : 'AL', text: 'Authenticity' });
                    }
                    if (faceData.comparison) {
                        faceObjectives.push({ status: faceData.comparison === 'clear' ? 'CL' : 'CO', text: 'Comparison' });
                    }
                    if (faceData.integrity) {
                        faceObjectives.push({ status: faceData.integrity === 'clear' ? 'CL' : 'AL', text: 'Integrity' });
                    }
                }
                
                checks.push({
                    isNestedCard: true,
                    title: 'Facial Similarity',
                    result: faceResult,
                    items: faceObjectives
                });
            }
            
            // 3. NFC (Document) Verification (nested card with detailed breakdown)
            // Only show if NFC was actually completed (not unobtainable)
            if (breakdown.nfc && breakdown.nfc.status !== 'unobtainable') {
                const nfcResult = breakdown.nfc.result || '';
                const nfcStatus = breakdown.nfc.status || '';
                const nfcBreakdown = breakdown.nfc.breakdown || {};
                
                // Get actual data for comparison descriptions
                const nfcData = data.nfc || {};
                const providedData = data.name || {};
                const providedDob = data.dob || '';
                
                const nfcItems = [];
                
                // Chip verification details
                if (nfcBreakdown.chip) {
                    const chipBreakdown = nfcBreakdown.chip.breakdown || {};
                    
                    // Clone detection
                    if (chipBreakdown.clone_detection) {
                        nfcItems.push({
                            status: chipBreakdown.clone_detection.result === 'clear' ? 'CL' : 'AL',
                            text: 'Clone Detection'
                        });
                    }
                    
                    // Chip verification
                    if (chipBreakdown.verification) {
                        nfcItems.push({
                            status: chipBreakdown.verification.result === 'clear' ? 'CL' : 'AL',
                            text: 'Chip Verification'
                        });
                    }
                }
                
                // Data comparison details with actual values
                if (nfcBreakdown.data_comparison) {
                    const compBreakdown = nfcBreakdown.data_comparison.breakdown || {};
                    
                    // DOB comparison
                    if (compBreakdown.dob) {
                        const dobResult = compBreakdown.dob.result || '';
                        const daysDiff = compBreakdown.dob.properties?.days_difference;
                        
                        let dobText = '';
                        if (dobResult === 'clear' && daysDiff === 0) {
                            dobText = `Date of birth: ${nfcData.dob || 'N/A'}. No difference between NFC chip and client entry`;
                        } else if (daysDiff !== undefined && daysDiff !== 0) {
                            dobText = `Date of birth mismatch: ${daysDiff} days difference between NFC chip and client entry`;
                        } else {
                            dobText = 'Date of Birth Match';
                        }
                        
                        nfcItems.push({
                            status: dobResult === 'clear' ? 'CL' : 'CO',
                            text: dobText
                        });
                    }
                    
                    // Name comparison with actual values
                    if (compBreakdown.name) {
                        const nameResult = compBreakdown.name.result || '';
                        const levenshtein = compBreakdown.name.properties?.levenshtein_pct;
                        
                        // Build full name from provided data
                        const providedFullName = [providedData.first, providedData.other, providedData.last]
                            .filter(Boolean).join(' ');
                        const nfcName = nfcData.name || '';
                        
                        let nameText = '';
                        if (nameResult === 'clear') {
                            nameText = `Name: ${nfcName}. Match confirmed`;
                        } else if (levenshtein !== undefined) {
                            nameText = `Name mismatch: Client entered "${providedFullName}", NFC chip reads "${nfcName}" (${levenshtein}% similarity)`;
                        } else {
                            nameText = 'Name Match';
                        }
                        
                        nfcItems.push({
                            status: nameResult === 'clear' ? 'CL' : 'CO',
                            text: nameText
                        });
                    }
                }
                
                checks.push({
                    isNestedCard: true,
                    title: 'NFC (Document) Verification',
                    result: nfcResult,
                    items: nfcItems
                });
            }
            
            // 4. Biometric Verification (Facial Similarity) (nested card)
            // Only show if biometric was actually completed (not unobtainable)
            if (breakdown.biometrics && breakdown.biometrics.status !== 'unobtainable') {
                const bioResult = breakdown.biometrics.result || '';
                const bioStatus = breakdown.biometrics.status || '';
                const bioBreakdown = breakdown.biometrics.breakdown || {};
                
                const bioItems = [];
                
                // Liveness attempts with descriptive text
                if (bioBreakdown.attempts && Array.isArray(bioBreakdown.attempts)) {
                    const totalAttempts = bioBreakdown.attempts.length;
                    const firstAttempt = bioBreakdown.attempts[0];
                    
                    if (totalAttempts === 1 && firstAttempt.passed && firstAttempt.status === 'complete') {
                        // Single successful attempt
                        bioItems.push({
                            status: 'CL',
                            text: 'Live facial video completed on first try'
                        });
                    } else {
                        // Multiple attempts or failed
                        bioBreakdown.attempts.forEach((attempt, index) => {
                            const passed = attempt.passed;
                            const attemptStatus = attempt.status || '';
                            const attemptText = passed 
                                ? `Attempt ${index + 1}: ${attemptStatus} - Passed`
                                : `Attempt ${index + 1}: ${attemptStatus} - Failed`;
                            bioItems.push({
                                status: passed ? 'CL' : 'AL',
                                text: attemptText
                            });
                        });
                    }
                }
                
                checks.push({
                    isNestedCard: true,
                    title: 'Biometric Verification (Facial Similarity)',
                    result: bioResult,
                    items: bioItems
                });
            }
            
            // Fallback for simple data
            if (!breakdown.nfc && !breakdown.biometrics && !breakdown.document && data.verified !== undefined) {
                checks.push({
                    status: data.verified ? 'CL' : 'CO',
                    text: data.verified ? 'Identity verified' : 'Identity verification requires review'
                });
            }
        }
        else if (taskType === 'address') {
            // Address verification - includes footprint data from electronic-id checks or lite screen data
            const data = outcome.data || {};
            const breakdown = outcome.breakdown || {};
            
            // Check if this is a footprint-converted address (has breakdown fields)
            const hasFootprintBreakdown = breakdown.data_quality || breakdown.data_count;
            
            let quality, sources, qualityStatus, sourcesStatus;
            
            if (hasFootprintBreakdown) {
                // Use footprint breakdown structure - prioritize breakdown over data
                const dataQuality = breakdown.data_quality || {};
                const dataCount = breakdown.data_count || {};
                
                // Map footprint breakdown to quality/sources
                // For footprint: data_quality.score = quality, data_count.count = sources
                quality = dataQuality.properties?.score !== undefined ? dataQuality.properties.score : (data.quality !== undefined ? data.quality : 0);
                sources = dataCount.properties?.count !== undefined ? dataCount.properties.count : (dataCount.properties?.score !== undefined ? dataCount.properties.score : (data.sources !== undefined ? data.sources : 0));
                
                // Use breakdown result if available, otherwise calculate from score
                if (dataQuality.result) {
                    qualityStatus = dataQuality.result === 'clear' ? 'CL' : (dataQuality.result === 'fail' ? 'AL' : 'CO');
                } else {
                    qualityStatus = quality === 0 ? 'AL' : (quality >= 80 ? 'CL' : 'CO');
                }
                
                if (dataCount.result) {
                    sourcesStatus = dataCount.result === 'clear' ? 'CL' : (dataCount.result === 'fail' ? 'AL' : 'CO');
                } else {
                    // For data_count, count >= 2 is clear, count === 1 is consider, count === 0 is fail
                    const count = dataCount.properties?.count !== undefined ? dataCount.properties.count : sources;
                    sourcesStatus = count === 0 ? 'AL' : (count >= 2 ? 'CL' : 'CO');
                }
            } else {
                // Use standard address data structure
                quality = data.quality !== undefined ? data.quality : 0;
                sources = data.sources !== undefined ? data.sources : 0;
                
                // Determine status based on quality and sources
                // Quality: 0% = fail, 1-79% = consider, 80%+ = clear
                // Sources: 0 = fail, 1 = consider, 2+ = clear
                qualityStatus = quality === 0 ? 'AL' : (quality >= 80 ? 'CL' : 'CO');
                sourcesStatus = sources === 0 ? 'AL' : (sources >= 2 ? 'CL' : 'CO');
            }
            
            // Overall status is the worst of the two
            let overallStatus = 'CL';
            if (qualityStatus === 'AL' || sourcesStatus === 'AL') {
                overallStatus = 'AL';
            } else if (qualityStatus === 'CO' || sourcesStatus === 'CO') {
                overallStatus = 'CO';
            }
            
            // Check for footprint rules/warnings
            // Only show "No address verification data available" if we don't have footprint breakdown
            const rules = breakdown.rules || [];
            let inlineWarning = '';
            if (rules.length > 0 && rules[0].text) {
                inlineWarning = rules[0].text;
            } else if (!hasFootprintBreakdown && quality === 0 && sources === 0) {
                inlineWarning = 'No address verification data available';
            }
            
            // Check if Proof of Address documents exist when address fails/consider
            const poaTask = check?.taskOutcomes?.['documents:poa'];
            const poaDocs = poaTask?.documents || poaTask?.breakdown?.documents || [];
            
            // Show main warning as header check (visible when collapsed)
            if (inlineWarning) {
                checks.push({
                    status: overallStatus === 'AL' ? 'AL' : 'CO',
                    text: inlineWarning
                });
            }
            
            // Show PoA review prompt as header check (visible when collapsed)
            if (poaDocs.length > 0 && (outcome.result === 'consider' || outcome.result === 'fail')) {
                checks.push({
                    status: 'CO',
                    text: `Review ${poaDocs.length} uploaded Proof of Address document${poaDocs.length > 1 ? 's' : ''} to verify address`
                });
            }
            
            // Address verification summary - show sources in collapsed state for clear results
            if (outcome.result === 'clear' && sources > 0) {
                checks.push({
                    status: 'CL',
                    text: `${sources} source${sources !== 1 ? 's' : ''} verified`
                });
            }
            
            // Address verification details (shown when expanded)
            checks.push({
                status: qualityStatus,
                text: `Verification Quality: ${quality}%`,
                indented: true
            });
            
            checks.push({
                status: sourcesStatus,
                text: `Address Sources: ${sources}`,
                indented: true
            });
            
            // Add footprint details if available (from electronic-id checks)
            // When using footprint breakdown, the main quality/sources already show the breakdown values
            // So we only show additional breakdown details if they provide extra information
            if (hasFootprintBreakdown) {
                // Show service name if available
                if (breakdown.service_name) {
                    checks.push({
                        status: 'CL',
                        text: `Service: ${breakdown.service_name}`,
                        indented: true
                    });
                }
            }
        }
        else if (taskType === 'screening') {
            // Combined Screening (PEP + Sanctions + Adverse Media)
            const breakdown = outcome.breakdown || {};
            const totalHits = breakdown.total_hits || 0;
            const hits = breakdown.hits || [];
            
            // Count dismissed hits
            const pepDismissals = check.pepDismissals || [];
            const dismissedCount = hits.filter(hit => pepDismissals.some(d => d.hitId === hit.id)).length;
            const outstandingCount = totalHits - dismissedCount;
            
            checks.push({
                status: totalHits === 0 ? 'CL' : 'CO', // Always CONSIDER if hits exist, regardless of dismissals
                text: `${totalHits} match${totalHits !== 1 ? 'es' : ''} found`,
                dismissedCount: dismissedCount,
                outstandingCount: outstandingCount
            });
            
            // Show detailed hit information using the same format as PEP updates
            if (hits.length > 0) {
                hits.forEach(hit => {
                    const name = hit.name || 'Unknown';
                    const dob = this.extractDob(hit.dob);
                    const flagTypes = hit.flag_types || [];
                    const positions = hit.political_positions || [];
                    const countries = hit.countries || [];
                    const aka = hit.aka || [];
                    const score = hit.score || 0;
                    
                    // Determine primary hit type
                    let hitType = '';
                    let hitIcon = '⚠️';
                    
                    // Check flag types if available (screening:lite format)
                    if (flagTypes.length > 0) {
                        if (flagTypes.some(f => f.includes('pep'))) {
                            hitType = 'PEP';
                            hitIcon = '👤';
                        }
                        if (flagTypes.some(f => f.includes('sanction'))) {
                            hitType = hitType ? `${hitType} + Sanctions` : 'Sanctions';
                            hitIcon = '🚫';
                        }
                        if (flagTypes.some(f => f.includes('adverse-media'))) {
                            hitType = hitType ? `${hitType} + Adverse Media` : 'Adverse Media';
                            hitIcon = '📰';
                        }
                    } else {
                        // Default to PEP if no flag types (simple peps format)
                        hitType = 'PEP';
                        hitIcon = '👤';
                    }
                    
                    // Check if this hit has been dismissed
                    const pepDismissals = check.pepDismissals || [];
                    const dismissal = pepDismissals.find(d => d.hitId === hit.id);
                    
                    // Create a "hit card" structure similar to PEP updates
                    checks.push({
                        isHitCard: true,
                        hitData: {
                            name,
                            dob,
                            hitType,
                            hitIcon,
                            score,
                            flagTypes,
                            positions,
                            countries,
                            aka,
                            media: hit.media || [],
                            associates: hit.associates || [],
                            fields: hit.fields || [],
                            match_types: hit.match_types || [],
                            dismissal: dismissal // Add dismissal info if exists
                        }
                    });
                });
            }
        }
        else if (taskType === 'peps') {
            // PEP Screening (Lite Screen or standalone)
            const breakdown = outcome.breakdown || {};
            const totalHits = breakdown.total_hits || 0;
            const hits = breakdown.hits || [];
            
            // Count dismissed hits
            const pepDismissals = check.pepDismissals || [];
            const dismissedCount = hits.filter(hit => pepDismissals.some(d => d.hitId === hit.id)).length;
            const outstandingCount = totalHits - dismissedCount;
            
            checks.push({
                status: totalHits === 0 ? 'CL' : 'CO',
                text: `${totalHits} PEP match${totalHits !== 1 ? 'es' : ''} found`,
                dismissedCount: dismissedCount,
                outstandingCount: outstandingCount
            });
            
            // Show detailed hit information using hit cards (same format as screening)
            if (hits.length > 0) {
                hits.forEach(hit => {
                    const name = hit.name || 'Unknown';
                    const dob = this.extractDob(hit.dob);
                    const flagTypes = hit.flag_types || [];
                    const positions = hit.political_positions || [];
                    const countries = hit.countries || [];
                    const aka = hit.aka || [];
                    const score = hit.score || 0;
                    
                    // Determine primary hit type
                    let hitType = 'PEP';
                    let hitIcon = '👤';
                    
                    // Check flag types if available (new format from lite screen)
                    if (flagTypes.length > 0) {
                        if (flagTypes.some(f => f.includes('pep') || f === 'pep')) {
                            hitType = 'PEP';
                            hitIcon = '👤';
                        }
                        if (flagTypes.some(f => f.includes('sanction') || f === 'sanction')) {
                            hitType = hitType ? `${hitType} + Sanctions` : 'Sanctions';
                            hitIcon = '🚫';
                        }
                        if (flagTypes.some(f => f.includes('adverse-media') || f === 'adverse-media')) {
                            hitType = hitType ? `${hitType} + Adverse Media` : 'Adverse Media';
                            hitIcon = '📰';
                        }
                        // Handle other flag types like 'warning', 'fitness-probity' (from mock data)
                        if (flagTypes.some(f => f === 'warning' || f === 'fitness-probity')) {
                            // Keep as PEP but note the flag type
                            hitType = 'PEP';
                            hitIcon = '⚠️';
                        }
                    }
                    
                    // Check if this hit has been dismissed
                    const dismissal = pepDismissals.find(d => d.hitId === hit.id);
                    
                    // Extract media and countries - check multiple possible locations
                    let mediaData = hit.media || [];
                    let countriesData = hit.countries || [];
                    
                    // Check if media/countries info might be in fields (new format)
                    if (hit.fields && Array.isArray(hit.fields)) {
                        // Look for country information in fields
                        const countryFields = hit.fields.filter(f => 
                            f.name && (f.name.toLowerCase().includes('country') || f.name.toLowerCase().includes('location'))
                        );
                        if (countryFields.length > 0 && countriesData.length === 0) {
                            countriesData = countryFields.map(f => f.value).filter(Boolean);
                        }
                        
                        // Look for URL/media information in fields
                        const urlFields = hit.fields.filter(f => 
                            f.name && (f.name.toLowerCase().includes('url') || f.name.toLowerCase().includes('link') || f.name.toLowerCase().includes('related'))
                        );
                        if (urlFields.length > 0 && mediaData.length === 0) {
                            // Convert URL fields to media format
                            mediaData = urlFields.map(f => ({
                                title: f.name || 'Source Link',
                                url: f.value || '',
                                date: f.value ? new Date().toISOString() : null
                            })).filter(m => m.url);
                        }
                    }
                    
                    // Create a "hit card" structure (same as screening task)
                    checks.push({
                        isHitCard: true,
                        hitData: {
                            name,
                            dob,
                            hitType,
                            hitIcon,
                            score,
                            flagTypes,
                            positions,
                            countries: countriesData,
                            aka,
                            media: mediaData,
                            associates: hit.associates || [],
                            fields: hit.fields || [],
                            match_types: hit.match_types || [],
                            source_notes: hit.source_notes || {}, // New format from lite screen
                            institutions: hit.institutions || [],
                            spouses: hit.spouses || [],
                            roles: hit.roles || [],
                            assets: hit.assets || [],
                            id: hit.id || '', // Hit ID for dismissal tracking
                            dismissal: dismissal // Add dismissal info if exists
                        }
                    });
                });
            }
        }
        else if (taskType === 'footprint') {
            // Digital Footprint (Lite Screen)
            const breakdown = outcome.breakdown || {};
            
            // Data count
            if (breakdown.data_count) {
                const score = breakdown.data_count.properties?.score || 0;
                const result = breakdown.data_count.result || '';
                checks.push({
                    status: result === 'clear' ? 'CL' : 'CO',
                    text: `Data Count Score: ${score}`
                });
            }
            
            // Data quality
            if (breakdown.data_quality) {
                const score = breakdown.data_quality.properties?.score || 0;
                const result = breakdown.data_quality.result || '';
                checks.push({
                    status: result === 'clear' ? 'CL' : 'CO',
                    text: `Data Quality Score: ${score}`
                });
            }
            
            // Service name
            if (breakdown.service_name) {
                checks.push({
                    status: 'CN',
                    text: `Service: ${breakdown.service_name}`
                });
            }
            
            // Rules
            if (breakdown.rules && Array.isArray(breakdown.rules) && breakdown.rules.length > 0) {
                breakdown.rules.forEach(rule => {
                    if (rule.text) {
                        checks.push({
                            status: 'CO',
                            text: rule.text,
                            indented: true
                        });
                    }
                });
            }
        }
        else if (taskType === 'identity:lite') {
            // IDV document verification - Show detailed breakdown with nested items when needed
            const breakdown = outcome.breakdown?.document?.breakdown || {};
            
            // Helper function to process category and show nested items when needed (handles deeper nesting)
            const processCategory = (category, categoryName) => {
                if (!category) return;
                
                const catBreakdown = category.breakdown || {};
                const catResult = category.result;
                
                // If category result is null, don't show it at all (check wasn't performed)
                if (catResult === null || catResult === undefined) {
                    return;
                }
                
                // If category has nested breakdown
                if (Object.keys(catBreakdown).length > 0) {
                    // If parent category is consider/fail, show parent + ALL nested items indented
                    if (catResult !== 'clear') {
                        // Add parent category header
                        checks.push({
                            status: catResult === 'fail' ? 'AL' : 'CO',
                            text: categoryName,
                            isParent: true
                        });
                        
                        // Add all nested items indented (handle deeper nesting)
                        // Skip items with null results (check wasn't performed)
                        Object.entries(catBreakdown)
                            .filter(([_, subCheck]) => {
                                // Only show nested items that have actual results (not null)
                                const subResult = subCheck.result;
                                const subBreakdown = subCheck.breakdown || {};
                                
                                // Show if it has a result, or if it has nested items with results
                                if (subResult !== null && subResult !== undefined) {
                                    return true;
                                }
                                
                                // Check if it has nested items with actual results
                                if (Object.keys(subBreakdown).length > 0) {
                                    return Object.values(subBreakdown).some(nestedCheck => {
                                        const nestedResult = nestedCheck.result;
                                        return nestedResult !== null && nestedResult !== undefined;
                                    });
                                }
                                
                                return false;
                            })
                            .forEach(([key, subCheck]) => {
                                const subResult = subCheck.result;
                                const subBreakdown = subCheck.breakdown || {};
                                const subProperties = subCheck.properties || {};
                                
                                // Format the key name
                                const formattedKey = key.replace(/_/g, ' ')
                                    .split(' ')
                                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                    .join(' ');
                                
                                // If this nested item has its own breakdown (deeper nesting)
                                if (Object.keys(subBreakdown).length > 0) {
                                    // Filter out null results from deeper nesting
                                    const deeperNestedItems = Object.entries(subBreakdown).filter(([_, nestedCheck]) => {
                                        const nestedResult = nestedCheck.result;
                                        return nestedResult !== null && nestedResult !== undefined;
                                    });
                                    
                                    if (deeperNestedItems.length > 0) {
                                        // Show the nested item as a parent (use actual result or default to consider)
                                        const nestedStatus = (subResult === 'clear' ? 'CL' : (subResult === 'fail' ? 'AL' : 'CO'));
                                        checks.push({
                                            status: nestedStatus,
                                            text: formattedKey,
                                            isChildItem: true,
                                            isParent: true
                                        });
                                        
                                        // Add its nested items (only those with actual results)
                                        deeperNestedItems.forEach(([nestedKey, nestedCheck]) => {
                                            const nestedResult = nestedCheck.result || '';
                                            const nestedFormattedKey = nestedKey.replace(/_/g, ' ')
                                                .split(' ')
                                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                                .join(' ');
                                            
                                            // Check if nested item has properties with specific results
                                            const nestedProperties = nestedCheck.properties || {};
                                            
                                            // If properties contain specific checks, show them as individual nested items
                                            if (Object.keys(nestedProperties).length > 0) {
                                                const propertyResults = Object.entries(nestedProperties)
                                                    .filter(([_, val]) => val === 'clear' || val === 'fail' || val === 'consider' || val === 'unidentified');
                                                
                                                if (propertyResults.length > 0) {
                                                    // Show the parent nested item (e.g., "Image Quality")
                                                    checks.push({
                                                        status: nestedResult === 'clear' ? 'CL' : (nestedResult === 'fail' ? 'AL' : (nestedResult === 'unidentified' ? 'CO' : 'CO')),
                                                        text: nestedFormattedKey,
                                                        isChildItem: true,
                                                        isParent: true  // Mark as parent so properties show as children
                                                    });
                                                    
                                                    // Show each property as a separate nested item with its own status
                                                    propertyResults.forEach(([propKey, propVal]) => {
                                                        const propName = propKey.replace(/_/g, ' ')
                                                            .split(' ')
                                                            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                                            .join(' ');
                                                        
                                                        const propStatus = propVal === 'clear' ? 'CL' : (propVal === 'fail' ? 'AL' : 'CO');
                                                        
                                                        checks.push({
                                                            status: propStatus,
                                                            text: propName,
                                                            isChildItem: true,
                                                            indented: true  // Triple indentation for properties
                                                        });
                                                    });
                                                } else {
                                                    // No property results, just show the nested item itself
                                                    checks.push({
                                                        status: nestedResult === 'clear' ? 'CL' : (nestedResult === 'fail' ? 'AL' : (nestedResult === 'unidentified' ? 'CO' : 'CO')),
                                                        text: nestedFormattedKey,
                                                        isChildItem: true,
                                                        indented: true
                                                    });
                                                }
                                            } else {
                                                // No properties, just show the nested item
                                                checks.push({
                                                    status: nestedResult === 'clear' ? 'CL' : (nestedResult === 'fail' ? 'AL' : (nestedResult === 'unidentified' ? 'CO' : 'CO')),
                                                    text: nestedFormattedKey,
                                                    isChildItem: true,
                                                    indented: true
                                                });
                                            }
                                        });
                                    }
                                } else {
                                    // Standard nested item with actual result (already filtered to exclude null)
                                    // Check if it has properties that should be shown as nested items
                                    if (Object.keys(subProperties).length > 0) {
                                        const propertyResults = Object.entries(subProperties)
                                            .filter(([_, val]) => val === 'clear' || val === 'fail' || val === 'consider' || val === 'unidentified');
                                        
                                        if (propertyResults.length > 0) {
                                            // Show the parent nested item (e.g., "Supported Document")
                                            checks.push({
                                                status: subResult === 'clear' ? 'CL' : (subResult === 'fail' ? 'AL' : (subResult === 'unidentified' ? 'CO' : 'CO')),
                                                text: formattedKey,
                                                isChildItem: true,
                                                isParent: true  // Mark as parent so properties show as children
                                            });
                                            
                                            // Show each property as a separate nested item with its own status
                                            propertyResults.forEach(([propKey, propVal]) => {
                                                const propName = propKey.replace(/_/g, ' ')
                                                    .split(' ')
                                                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                                                    .join(' ');
                                                
                                                const propStatus = propVal === 'clear' ? 'CL' : (propVal === 'fail' ? 'AL' : 'CO');
                                                
                                                checks.push({
                                                    status: propStatus,
                                                    text: propName,
                                                    isChildItem: true,
                                                    indented: true  // Double indentation for properties
                                                });
                                            });
                                        } else {
                                            // No property results, just show the nested item itself
                                            checks.push({
                                                status: subResult === 'clear' ? 'CL' : (subResult === 'fail' ? 'AL' : (subResult === 'unidentified' ? 'CO' : 'CO')),
                                                text: formattedKey,
                                                isChildItem: true
                                            });
                                        }
                                    } else {
                                        // No properties, just show the nested item
                                        checks.push({
                                            status: subResult === 'clear' ? 'CL' : (subResult === 'fail' ? 'AL' : (subResult === 'unidentified' ? 'CO' : 'CO')),
                                            text: formattedKey,
                                            isChildItem: true
                                        });
                                    }
                                }
                            });
                    } else {
                        // Parent is clear - just show the category name (don't show nested items)
                        // This is the normal case - only show nested breakdown when there's an issue
                        checks.push({
                            status: 'CL',
                            text: categoryName
                        });
                    }
                } else {
                    // No nested breakdown, show the category itself
                    checks.push({
                        status: catResult === 'clear' ? 'CL' : (catResult === 'fail' ? 'AL' : (catResult === null ? 'CO' : 'CO')),
                        text: categoryName
                    });
                }
            };
            
            // Process all document categories (same order as electronic-id)
            processCategory(breakdown.visual_authenticity, 'Visual Authenticity');
            processCategory(breakdown.image_integrity, 'Image Integrity');
            processCategory(breakdown.data_validation, 'Data Validation');
            processCategory(breakdown.data_consistency, 'Data Consistency');
            processCategory(breakdown.data_comparison, 'Data Comparison');
            processCategory(breakdown.compromised_document, 'Compromised Check');
            processCategory(breakdown.age_validation, 'Age Validation');
            processCategory(breakdown.police_record, 'Police Record');
        }
        else if (taskType === 'company:summary') {
            // Company Summary - Show people count in header, profile cards in details
            const breakdown = outcome.breakdown || {};
            const people = breakdown.people || [];
            const peopleCount = people.length;
            
            // Header check: people count
            const peopleStatus = peopleCount === 0 ? 'AL' : 'CL';
            const peopleText = peopleCount === 0 ? '0 people found' : `${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} found`;
            checks.push({
                status: peopleStatus,
                text: peopleText
            });
            
            // Officers/People as profile cards (indented - show in details only)
            if (peopleCount > 0) {
                people.forEach(person => {
                    checks.push({
                        isPersonCard: true,
                        personData: person,
                        indented: true  // Mark as detail-only
                        // NO status or text field - only isPersonCard and personData
                    });
                });
            }
        }
        else if (taskType === 'company:ubo') {
            // Ultimate Beneficial Owners
            const breakdown = outcome.breakdown || {};
            
            // Show unobtainable message if applicable (header check)
            if (breakdown.uboUnavailable && outcome.status === 'unobtainable') {
                checks.push({
                    status: 'CO',
                    text: 'UBO information unobtainable'
                });
            }
            
            // Count all people found
            const pscsCount = breakdown.pscs?.length || 0;
            const beneficialOwnersCount = breakdown.beneficialOwners?.length || 0;
            const totalPeopleCount = pscsCount + beneficialOwnersCount;
            
            // Show people count in header
            if (totalPeopleCount > 0) {
                checks.push({
                    status: 'CL',
                    text: `${totalPeopleCount} ${totalPeopleCount === 1 ? 'person' : 'people'} found`
                });
            } else {
                checks.push({
                    status: 'AL',
                    text: '0 people found'
                });
            }
            
            // PSCs (Persons with Significant Control) as profile cards (indented - details only)
            if (breakdown.pscs && Array.isArray(breakdown.pscs) && breakdown.pscs.length > 0) {
                breakdown.pscs.forEach(psc => {
                    const person = psc.person || {};
                    // Merge PSC-level data with person data
                    const personWithControls = {
                        ...person,
                        natureOfControlTypes: psc.natureOfControlTypes,
                        natureOfControlStartDate: psc.natureOfControlStartDate
                    };
                    
                    checks.push({
                        isPersonCard: true,
                        personData: personWithControls,
                        indented: true  // Mark as detail-only
                        // NO status or text field
                    });
                });
            }
            
            // Beneficial Owners as profile cards (indented - details only)
            if (breakdown.beneficialOwners && Array.isArray(breakdown.beneficialOwners) && breakdown.beneficialOwners.length > 0) {
                breakdown.beneficialOwners.forEach(owner => {
                    checks.push({
                        isPersonCard: true,
                        personData: owner,
                        indented: true  // Mark as detail-only
                        // NO status or text field
                    });
                });
            }
            
            // Relationships (ownership structure)
            if (breakdown.relationships && Array.isArray(breakdown.relationships) && breakdown.relationships.length > 0) {
                checks.push({
                    status: 'CN',
                    text: 'Ownership Relationships',
                    isSectionHeader: true
                });
                
                breakdown.relationships.forEach(rel => {
                    const relText = `${rel.source || 'Unknown'} → ${rel.target || 'Unknown'} (${rel.type || 'relationship'})`;
                    checks.push({
                        status: 'CN',
                        text: relText,
                        indented: true
                    });
                });
            }
        }
        else if (taskType === 'company:beneficial-check') {
            // PSC Extract document
            const breakdown = outcome.breakdown || {};
            
            if (breakdown.documents && Array.isArray(breakdown.documents) && breakdown.documents.length > 0) {
                checks.push({
                    status: 'CL',
                    text: `PSC Extract document obtained`
                });
            } else if (outcome.status === 'unobtainable') {
                checks.push({
                    status: 'CO',
                    text: 'PSC Extract unobtainable - manual review required'
                });
            }
        }
        else if (taskType === 'company:shareholders') {
            // Shareholders information
            const breakdown = outcome.breakdown || {};
            
            if (breakdown.documents && Array.isArray(breakdown.documents) && breakdown.documents.length > 0) {
                checks.push({
                    status: 'CL',
                    text: `Shareholder register obtained (${breakdown.documents.length} document${breakdown.documents.length !== 1 ? 's' : ''})`
                });
            }
            
            // If we have shareholder data in breakdown
            if (breakdown.shareholders && Array.isArray(breakdown.shareholders) && breakdown.shareholders.length > 0) {
                checks.push({
                    status: 'CN',
                    text: `${breakdown.shareholders.length} Shareholder${breakdown.shareholders.length !== 1 ? 's' : ''}`,
                    isSectionHeader: true
                });
                
                breakdown.shareholders.forEach(shareholder => {
                    const name = shareholder.name || 'Unknown';
                    const shares = shareholder.shares || '';
                    const percentage = shareholder.percentage || '';
                    
                    let shareText = name;
                    if (shares) shareText += ` - ${shares} shares`;
                    if (percentage) shareText += ` (${percentage}%)`;
                    
                    checks.push({
                        status: 'CL',
                        text: shareText,
                        indented: true
                    });
                });
            }
        }
        
        return checks;
    }
    
    // ===================================================================
    // ACTIONS
    // ===================================================================
    
    viewPDF(s3Key) {
        console.log('📄 Viewing PDF:', s3Key);
        this.sendMessage('view-pdf', { s3Key });
    }
    
    toggleMonitoring(currentlyEnabled) {
        console.log('🔄 Toggling monitoring:', !currentlyEnabled);
        
        const check = this.currentCheck;
        this.sendMessage('monitoring-patch', {
            id: check.transactionId || check.checkId,
            resourceType: check.transactionId ? 'transaction' : 'check',
            enabled: !currentlyEnabled
        });
    }
    
    abortCheck() {
        if (!confirm('Are you sure you want to cancel this check? This action cannot be undone.')) {
            return;
        }
        
        console.log('🚫 Aborting check');
        
        const check = this.currentCheck;
        this.sendMessage('cancel-check', {
            id: check.transactionId || check.checkId,
            resourceType: check.transactionId ? 'transaction' : 'check'
        });
    }
    
    retryDocumentUpload() {
        console.log('🔄 Retrying document upload for check:', this.currentCheck.checkId);
        
        const check = this.currentCheck;
        
        // Get last attempt to show in console
        const lastAttempt = check.uploadAttempts?.[check.uploadAttempts.length - 1];
        if (lastAttempt) {
            console.log('📋 Last attempt error type:', lastAttempt.errorType);
            console.log('📋 Last attempt error:', lastAttempt.errorMessage);
        }
        
        this.sendMessage('retry-idv-upload', {
            id: check.checkId,
            documentType: check.documentType,
            lastAttempt: lastAttempt
        });
    }

    /**
     * Find all consider/fail items in task outcomes (recursive)
     * Only returns nested objectives, not top-level tasks
     */
    findConsiderFailItems(taskOutcomes) {
        const items = [];
        
        for (const [taskType, outcome] of Object.entries(taskOutcomes)) {
            // Skip if no outcome or status
            if (!outcome) continue;
            
            // Get reason text for this task
            const reasonText = this.getTaskConsiderReason(taskType, outcome);
            
            // Only add top-level task if it has no nested items but has consider/fail
            const hasNested = (outcome.data && Object.keys(outcome.data).length > 0) || 
                             (outcome.breakdown && Object.keys(outcome.breakdown).length > 0);
            
            // Special case: KYB tasks with unobtainable status should always be annotatable
            // Even if they have nested data (e.g., UBO with some people found, PSC extract with partial data)
            const isUnobtainableKybTask = outcome.status === 'unobtainable' && 
                                         (taskType === 'company:ubo' || taskType === 'company:beneficial-check' || 
                                          taskType === 'company:shareholders' || taskType === 'company:summary');
            
            // Special case: IDV checks (identity:lite) with consider/fail should always be annotatable
            // Even if they have nested data (like breakdown.document)
            const isIdvTask = taskType === 'identity:lite';
            const isIdvWithConsider = isIdvTask && (outcome.result === 'consider' || outcome.result === 'fail');
            
            // For unobtainable KYB tasks or IDV tasks with consider/fail, always add them (even with nested data)
            // For other tasks, add if no nested data and has consider/fail result
            // Also check if result is consider/fail OR status is unobtainable (for cases where result might not be set)
            const shouldAddTopLevel = isUnobtainableKybTask || isIdvWithConsider || 
                                      (!hasNested && (outcome.result === 'consider' || outcome.result === 'fail' || outcome.status === 'unobtainable'));
            
            if (shouldAddTopLevel) {
                // For unobtainable tasks, default to 'consider' status if result is not set
                const status = outcome.result || (outcome.status === 'unobtainable' ? 'consider' : 'clear');
                items.push({
                    taskType,
                    path: taskType,
                    label: this.getTaskTitle(taskType),
                    status: status,
                    level: 0,
                    reasonText
                });
            }
            
            // Special case: Check for address task within screening:lite or screening
            // These can have nested address verification with consider status
            if ((taskType === 'screening:lite' || taskType === 'screening') && outcome.breakdown?.address) {
                const addressTask = outcome.breakdown.address;
                if (addressTask.result === 'consider' || addressTask.result === 'fail') {
                    const addressReason = this.getTaskConsiderReason('address', addressTask);
                    items.push({
                        taskType: 'address',
                        path: `${taskType}.breakdown.address`,
                        label: 'Address Verification',
                        status: addressTask.result,
                        level: 1,
                        reasonText: addressReason
                    });
                }
            }
            
            // Recursively check nested data and breakdown
            if (outcome.data) {
                const nested = this.findNestedConsiderFail(outcome.data, taskType, taskType, 1, outcome);
                items.push(...nested);
            }
            
            if (outcome.breakdown) {
                const nestedBreakdown = this.findNestedConsiderFail(outcome.breakdown, taskType, taskType, 1, outcome);
                items.push(...nestedBreakdown);
            }
        }
        
        return items;
    }
    
    /**
     * Get consider/fail reason text for display
     */
    getTaskConsiderReason(taskType, outcome) {
        // Handle different task types and their specific reasons
        
        // Skipped tasks
        if (outcome.status === 'skipped') {
            return 'Client skipped in app';
        }
        
        // Unobtainable tasks
        if (outcome.status === 'unobtainable') {
            if (taskType === 'nfc' || taskType === 'biometrics') {
                return 'NFC unobtainable - Original ID completed instead';
            }
            if (taskType === 'company:ubo') {
                const pscsCount = outcome.breakdown?.pscs?.length || 0;
                if (pscsCount > 0) {
                    return `UBO information unobtainable - ${pscsCount} PSC${pscsCount > 1 ? 's' : ''} found from Companies House`;
                }
                return 'UBO information unobtainable - manual review required';
            }
            if (taskType === 'company:beneficial-check') {
                return 'PSC Extract unobtainable - manual review required';
            }
            if (taskType === 'company:shareholders') {
                return 'Shareholders information unobtainable - manual review required';
            }
            return 'Information unobtainable';
        }
        
        // Address/footprint specific
        if (taskType === 'address' || taskType === 'footprint') {
            const rules = outcome.breakdown?.rules || [];
            let reasonText = '';
            
            if (rules.length > 0 && rules[0].text) {
                reasonText = rules[0].text;
            } else {
                reasonText = 'Address verification issues';
            }
            
            // Check if Proof of Address documents exist
            const poaDocs = outcome.breakdown?.documents || [];
            if (poaDocs.length > 0 && (outcome.result === 'consider' || outcome.result === 'fail')) {
                reasonText += ` - Review ${poaDocs.length} uploaded Proof of Address document${poaDocs.length > 1 ? 's' : ''}`;
            }
            
            return reasonText;
        }
        
        // Identity/NFC specific - check for name mismatch details
        if (taskType === 'identity' || taskType === 'nfc') {
            // Check if Enhanced was requested but NFC unobtainable
            if (taskType === 'identity' && outcome.status === 'unobtainable') {
                return 'Enhanced ID requested but Original completed as NFC unobtainable';
            }
            
            // Check NFC data comparison for name mismatch
            const nfcComparison = outcome.breakdown?.nfc?.breakdown?.data_comparison?.breakdown?.name || 
                                 outcome.breakdown?.data_comparison?.breakdown?.name ||
                                 outcome.data?.comparison;
            
            if (nfcComparison && nfcComparison.result === 'consider') {
                const matchPct = nfcComparison.properties?.levenshtein_pct;
                const nfcName = outcome.data?.nfc?.name;
                
                // Get client-entered name
                const clientName = outcome.data?.name;
                let clientNameStr = '';
                if (clientName) {
                    const parts = [clientName.first, clientName.other, clientName.last].filter(p => p);
                    clientNameStr = parts.join(' ');
                }
                
                if (nfcName && clientNameStr && matchPct) {
                    return `Name mismatch: NFC shows "${nfcName}" but client entered "${clientNameStr}" (${matchPct}% match)`;
                } else if (nfcName && matchPct) {
                    return `Name mismatch: NFC shows "${nfcName}" (${matchPct}% match)`;
                } else if (matchPct) {
                    return `Name mismatch detected (${matchPct}% match)`;
                }
            }
            
            // Check for general NFC consider
            if (outcome.breakdown?.nfc?.result === 'consider') {
                return 'NFC verification requires review';
            }
        }
        
        // NFC/Biometrics unobtainable
        if (taskType === 'nfc' || taskType === 'biometrics') {
            if (outcome.status === 'unobtainable') {
                return 'Enhanced ID requested but Original completed as NFC unobtainable';
            }
        }
        
        // Default based on status
        if (outcome.result === 'fail') {
            return 'Failed verification';
        }
        if (outcome.result === 'consider') {
            return 'Requires review';
        }
        
        return '';
    }
    
    /**
     * Recursively find consider/fail in nested objects
     */
    findNestedConsiderFail(obj, taskType, parentPath, level, parentOutcome = null) {
        const items = [];
        
        if (!obj || typeof obj !== 'object') return items;
        
        for (const [key, value] of Object.entries(obj)) {
            if (!value || typeof value !== 'object') continue;
            
            const currentPath = `${parentPath}.${key}`;
            
            // Check if this object has a result field
            if (value.result === 'consider' || value.result === 'fail') {
                // Get reason text - try from this object or parent
                let reasonText = '';
                if (value.text) {
                    reasonText = value.text;
                } else if (value.status === 'unobtainable') {
                    reasonText = 'Information unobtainable';
                } else if (parentOutcome) {
                    reasonText = this.getTaskConsiderReason(taskType, parentOutcome);
                }
                
                items.push({
                    taskType,
                    path: currentPath,
                    label: this.formatObjectivePath(currentPath),
                    status: value.result,
                    level,
                    reasonText
                });
            }
            
            // Recurse deeper
            const deeper = this.findNestedConsiderFail(value, taskType, currentPath, level + 1, parentOutcome || value);
            items.push(...deeper);
        }
        
        return items;
    }
    
    /**
     * Format objective path for display (simplified, no parent task prefix)
     */
    formatObjectivePath(path) {
        const parts = path.split('.');
        
        // Remove first part (task type) and 'breakdown' parts
        const filteredParts = parts
            .slice(1)  // Remove task type prefix (identity, address, etc.)
            .filter(part => part !== 'breakdown' && part !== 'data')  // Remove 'breakdown' and 'data' noise
            .map(part => {
                // Convert snake_case to Title Case
                return part
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, l => l.toUpperCase());
            });
        
        // If we end up with nothing (top-level task), use the task title
        if (filteredParts.length === 0) {
            // Try to get friendly task title
            const taskTitle = this.getTaskTitle(path);
            // If we got a friendly title, use it; otherwise fall back to formatting the path
            if (taskTitle && taskTitle !== path) {
                return taskTitle;
            }
            // Fallback: format the last part
            return parts[parts.length - 1]
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return filteredParts.join(' ');
    }
    
    /**
     * Check if check has consider/fail items
     */
    hasConsiderFailItems(check) {
        if (!check.taskOutcomes || check.status !== 'closed') return false;
        const items = this.findConsiderFailItems(check.taskOutcomes);
        return items.length > 0;
    }
    
    /**
     * Check if check has SoF/Bank tasks
     */
    hasSofBankTasks(check) {
        if (check.status !== 'closed') return false;
        const outcomes = check.taskOutcomes || {};
        return outcomes['sof:v1'] || outcomes['bank:summary'] || outcomes['bank:statement'];
    }
    
    /**
     * Check if check has PEP/Sanctions hits
     * Checks all possible structures: peps, screening:lite, screening (renamed), sanctions, company:peps, company:sanctions
     */
    hasPepSanctionsHits(check) {
        if (check.status !== 'closed') return false;
        const outcomes = check.taskOutcomes || {};
        
        // Individual checks
        const peps = outcomes['peps'];
        const screeningLite = outcomes['screening:lite'];
        const screening = outcomes['screening']; // Could be renamed from 'peps' or 'screening:lite'
        const sanctions = outcomes['sanctions'];
        
        // Company checks (KYB)
        const companyPeps = outcomes['company:peps'];
        const companySanctions = outcomes['company:sanctions'];
        
        // Count hits from all sources
        const pepHits = (peps?.breakdown?.total_hits || 0);
        const screeningLiteHits = (screeningLite?.breakdown?.total_hits || 0);
        const screeningHits = (screening?.breakdown?.total_hits || 0);
        const sanctionHits = (sanctions?.breakdown?.total_hits || 0);
        const companyPepHits = (companyPeps?.breakdown?.total_hits || 0);
        const companySanctionHits = (companySanctions?.breakdown?.total_hits || 0);
        
        const totalHits = pepHits + screeningLiteHits + screeningHits + sanctionHits + companyPepHits + companySanctionHits;
        
        return totalHits > 0;
    }
    
    /**
     * Render Consider Overlay with update queue system
     */
    renderConsiderOverlay(check) {
        const items = this.findConsiderFailItems(check.taskOutcomes);
        const existingAnnotations = check.considerAnnotations || [];
        
        // Initialize pending updates array
        if (!this.pendingUpdates) {
            this.pendingUpdates = [];
        }
        
        // Build overlay HTML
        let overlayHTML = '<div class="annotation-overlay" id="considerOverlay">';
        overlayHTML += '<div class="annotation-overlay-backdrop" onclick="manager.closeConsiderOverlay()"></div>';
        overlayHTML += '<div class="annotation-overlay-content">';
        
        // Header with SAVE and EXPORT PDF buttons
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Update Task Outcomes</h2>';
        overlayHTML += '<div class="header-actions">';
        overlayHTML += '<button class="btn-secondary-small" onclick="manager.generateConsiderPDF()" style="margin-right: 8px;">EXPORT PDF</button>';
        if (this.mode === 'edit') {
            overlayHTML += '<button class="btn-primary-small" onclick="manager.savePendingUpdates()" id="saveAllBtn" disabled>SAVE</button>';
        }
        overlayHTML += '<button class="overlay-close-btn" onclick="manager.closeConsiderOverlay()">×</button>';
        overlayHTML += '</div></div>';
        
        overlayHTML += '<div class="annotation-overlay-body">';
        
        // Updates to add section (queue)
        overlayHTML += '<div class="updates-queue-section">';
        overlayHTML += '<h3>Updates to add</h3>';
        overlayHTML += '<div id="updatesQueue" class="updates-queue">';
        if (this.pendingUpdates.length === 0) {
            overlayHTML += '<p class="text-muted">No updates queued. Select objectives below and add an update.</p>';
        }
        overlayHTML += '</div></div>';
        
        // Add Update section
        if (this.mode === 'edit') {
            overlayHTML += '<div class="add-update-section">';
            overlayHTML += '<h3>Add Update</h3>';
            
            // Group items by task type
            const groupedItems = {};
            items.forEach(item => {
                if (!groupedItems[item.taskType]) {
                    groupedItems[item.taskType] = [];
                }
                groupedItems[item.taskType].push(item);
            });
            
            // Checkboxes for objectives
            overlayHTML += '<div class="objectives-grid">';
            for (const [taskType, taskItems] of Object.entries(groupedItems)) {
                overlayHTML += '<div class="objective-column">';
                overlayHTML += `<h4>${this.getTaskTitle(taskType)}</h4>`;
                
                // Show reason text once for the task group
                if (taskItems[0].reasonText) {
                    overlayHTML += '<p class="task-reason-text">' + taskItems[0].reasonText + '</p>';
                }
                
                taskItems.forEach(item => {
                    overlayHTML += '<label class="objective-radio">';
                    overlayHTML += `<input type="checkbox" name="objectives" value="${item.path}" data-task="${taskType}" data-status="${item.status}" data-label="${item.label}">`;
                    overlayHTML += '<span>' + item.label + '</span>';
                    overlayHTML += '</label>';
                });
                
                overlayHTML += '</div>';
            }
            overlayHTML += '</div>';
            
            // Status dropdown
            overlayHTML += '<div class="form-group">';
            overlayHTML += '<label for="updateStatus">Status</label>';
            overlayHTML += '<select id="updateStatus">';
            overlayHTML += '<option value="clear">CLEAR</option>';
            overlayHTML += '<option value="consider">CONSIDER</option>';
            overlayHTML += '<option value="fail">FAIL</option>';
            overlayHTML += '</select></div>';
            
            // Reason textarea
            overlayHTML += '<div class="form-group">';
            overlayHTML += '<label for="updateReason">Reason</label>';
            overlayHTML += '<textarea id="updateReason" rows="3" placeholder="Explain the reason for this status update..."></textarea>';
            overlayHTML += '</div>';
            
            // Add update button
            overlayHTML += '<button type="button" class="btn-add-update" onclick="manager.addUpdateToQueue()">Add update</button>';
            
            overlayHTML += '</div>';
        }
        
        // Show existing annotations from database (grouped by user + timestamp + newStatus)
        if (existingAnnotations.length > 0) {
            overlayHTML += '<div class="annotation-history-section">';
            overlayHTML += '<h3>Previous Updates</h3>';
            
            // Group annotations by user + timestamp + newStatus
            const groups = {};
            existingAnnotations.forEach(ann => {
                const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        user: ann.userName || ann.user,
                        timestamp: ann.timestamp,
                        newStatus: ann.newStatus,
                        reason: ann.reason,
                        objectives: []
                    };
                }
                groups[groupKey].objectives.push({
                    path: ann.objectivePath,
                    originalStatus: ann.originalStatus,
                    newStatus: ann.newStatus
                });
            });
            
            // Render each group as a mini card (same as task cards)
            Object.values(groups).forEach(group => {
                const date = new Date(group.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                overlayHTML += '<div class="annotation-mini-card">';
                overlayHTML += '<div class="annotation-mini-header">';
                overlayHTML += '<div class="annotation-mini-meta">';
                overlayHTML += '<strong>' + group.user + '</strong> • ' + date;
                overlayHTML += '</div>';
                overlayHTML += '</div>';
                overlayHTML += '<div class="annotation-mini-body">';
                overlayHTML += '<p class="annotation-mini-reason">' + group.reason + '</p>';
                overlayHTML += '<div class="annotation-mini-objectives">';
                
                // Show all affected objectives with their status icons
                group.objectives.forEach(obj => {
                    const statusIcon = this.getStatusIconSVG(obj.newStatus);
                    overlayHTML += '<div class="annotation-objective-item">';
                    overlayHTML += statusIcon;
                    overlayHTML += '<span class="annotation-objective-label">' + this.formatObjectivePath(obj.path) + '</span>';
                    overlayHTML += '</div>';
                });
                
                overlayHTML += '</div></div></div>';
            });
            
            overlayHTML += '</div>';
        }
        
        overlayHTML += '</div></div></div>';
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        
        // Render any pending updates
        this.renderPendingUpdates();
    }
    
    /**
     * Add selected objectives to update queue
     */
    addUpdateToQueue() {
        const selectedObjectives = Array.from(document.querySelectorAll('#considerOverlay input[name="objectives"]:checked'));
        const status = document.getElementById('updateStatus').value;
        const reason = document.getElementById('updateReason').value.trim();
        
        if (selectedObjectives.length === 0) {
            alert('Please select at least one objective');
            return;
        }
        
        if (!reason) {
            alert('Please provide a reason');
            return;
        }
        
        // Create update object
        const update = {
            id: Date.now(),
            objectives: selectedObjectives.map(cb => ({
                path: cb.value,
                taskType: cb.dataset.task,
                label: cb.dataset.label,
                originalStatus: cb.dataset.status
            })),
            status,
            reason
        };
        
        this.pendingUpdates.push(update);
        
        // Clear form
        selectedObjectives.forEach(cb => cb.checked = false);
        document.getElementById('updateReason').value = '';
        
        // Re-render queue
        this.renderPendingUpdates();
        
        // Enable save button
        document.getElementById('saveAllBtn').disabled = false;
    }
    
    /**
     * Render pending updates queue (styled like task cards)
     */
    renderPendingUpdates() {
        const queueContainer = document.getElementById('updatesQueue');
        if (!queueContainer) return;
        
        if (this.pendingUpdates.length === 0) {
            queueContainer.innerHTML = '<p class="text-muted">No updates queued. Select objectives below and add an update.</p>';
            return;
        }
        
        let queueHTML = '';
        this.pendingUpdates.forEach(update => {
            const taskTitle = this.getTaskTitle(update.objectives[0].taskType);
            
            // Get status icon based on new status
            let statusIcon = '';
            let borderClass = '';
            
            if (update.status === 'clear') {
                borderClass = 'clear';
                statusIcon = '<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
            } else if (update.status === 'consider') {
                borderClass = 'consider';
                statusIcon = '<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
            } else if (update.status === 'fail') {
                borderClass = 'alert';
                statusIcon = '<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
            }
            
            // Get icon code based on status
            let objectiveIconCode = 'CL';  // Default clear
            if (update.status === 'consider') {
                objectiveIconCode = 'CO';
            } else if (update.status === 'fail') {
                objectiveIconCode = 'AL';
            }
            
            // Build objectives list with matching status icons
            let objectivesHTML = '<div class="task-checks-grid">';
            update.objectives.forEach(obj => {
                objectivesHTML += '<div class="task-check-item">';
                objectivesHTML += this.getTaskCheckIcon(objectiveIconCode);
                objectivesHTML += '<span class="task-check-text">' + obj.label + '</span>';
                objectivesHTML += '</div>';
            });
            objectivesHTML += '</div>';
            
            // Render as task card
            queueHTML += '<div class="task-card update-queue-card ' + borderClass + '">';
            queueHTML += '<div class="task-header">';
            queueHTML += statusIcon;
            queueHTML += '<div class="task-title">' + taskTitle + '</div>';
            queueHTML += '<button class="remove-update-btn" onclick="manager.removeUpdateFromQueue(' + update.id + ')" title="Remove from queue">';
            queueHTML += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">';
            queueHTML += '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
            queueHTML += '</svg>';
            queueHTML += '</button>';
            queueHTML += '</div>';
            queueHTML += '<div class="task-details" style="display: block;">';
            queueHTML += '<div class="update-reason-text">' + update.reason + '</div>';
            queueHTML += objectivesHTML;
            queueHTML += '</div></div>';
        });
        
        queueContainer.innerHTML = queueHTML;
    }
    
    /**
     * Remove update from queue
     */
    removeUpdateFromQueue(updateId) {
        this.pendingUpdates = this.pendingUpdates.filter(u => u.id !== updateId);
        this.renderPendingUpdates();
        
        // Disable save button if queue is empty
        if (this.pendingUpdates.length === 0) {
            const saveBtn = document.getElementById('saveAllBtn');
            if (saveBtn) saveBtn.disabled = true;
        }
    }
    
    /**
     * Save all pending updates
     */
    savePendingUpdates() {
        if (this.pendingUpdates.length === 0) {
            alert('No updates to save');
            return;
        }
        
        const check = this.currentCheck;
        
        // Convert pending updates to annotations format
        const annotations = [];
        this.pendingUpdates.forEach(update => {
            update.objectives.forEach(obj => {
                annotations.push({
                    taskType: obj.taskType,
                    objectivePath: obj.path,
                    originalStatus: obj.originalStatus,
                    newStatus: update.status,
                    reason: update.reason,
                    timestamp: new Date().toISOString()
                });
            });
        });
        
        // Send to parent and wait for success
        this.sendMessage('save-consider-annotations', {
            checkId: check.checkId || check.transactionId,
            annotations
        });
        
        // Store context for success handler (including annotations for PDF generation)
        this.pendingSave = {
            type: 'consider',
            check: check,
            annotations: annotations
        };
        
        // Clear pending updates
        this.pendingUpdates = [];
    }
    
    closeConsiderOverlay() {
        const overlay = document.getElementById('considerOverlay');
        if (overlay) overlay.remove();
        // Clear pending updates when closing
        this.pendingUpdates = [];
    }
    
    /**
     * Render SoF Overlay
     */
    renderSofOverlay(check) {
        const outcomes = check.taskOutcomes || {};
        const sofTask = outcomes['sof:v1'];
        const bankSummary = outcomes['bank:summary'];
        const bankStatement = outcomes['bank:statement'];
        const existingAnnotations = check.sofAnnotations || [];
        
        const breakdown = sofTask?.breakdown || {};
        const funds = breakdown.funds || [];
        const property = breakdown.property || {};
        
        // Get accounts and matches - check all possible sources
        const docsBankStatement = outcomes['documents:bank-statement'];
        const accounts = bankStatement?.breakdown?.accounts || 
                        bankSummary?.breakdown?.accounts || 
                        docsBankStatement?.breakdown?.accounts || {};
        const sofMatches = bankSummary?.breakdown?.analysis?.sof_matches || 
                          bankStatement?.breakdown?.analysis?.sof_matches || 
                          docsBankStatement?.breakdown?.analysis?.sof_matches || {};
        
        // Get bank analysis data
        const analysis = bankStatement?.breakdown?.analysis || bankSummary?.breakdown?.analysis || {};
        const chains = analysis.chain_analysis || [];
        const largeTransactions = analysis.largest_individual_transactions || [];
        
        let overlayHTML = '<div class="annotation-overlay sof-investigation-overlay" id="sofOverlay">';
        overlayHTML += '<div class="annotation-overlay-backdrop" onclick="manager.closeSofOverlay()"></div>';
        overlayHTML += '<div class="annotation-overlay-content">';
        
        // Header with SAVE and EXPORT PDF buttons
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Source of Funds Investigation</h2>';
        overlayHTML += '<div class="header-actions">';
        overlayHTML += '<button class="btn-secondary-small" onclick="manager.generateSofPDF()" style="margin-right: 8px;">EXPORT PDF</button>';
        if (this.mode === 'edit') {
            overlayHTML += '<button class="btn-primary-small" type="button" onclick="manager.saveSofInvestigation()">SAVE</button>';
        }
        overlayHTML += '<button class="overlay-close-btn" onclick="manager.closeSofOverlay()">✕</button>';
        overlayHTML += '</div></div>';
        
        overlayHTML += '<div class="annotation-overlay-body">';
        overlayHTML += '<form id="sofInvestigationForm">';
        
        // Property Info Section (from task card)
        if (property.address) {
            const addr = property.address;
            const fullAddress = `${addr.building_number || ''} ${addr.street || ''}, ${addr.town || ''}, ${addr.postcode || ''}`.trim();
            const price = property.price ? `£${(property.price / 100).toLocaleString()}` : 'Not specified';
            const sdlt = property.stamp_duty ? `£${(property.stamp_duty / 100).toLocaleString()}` : 'Not specified';
            const newBuild = property.new_build ? 'Yes' : 'No';
            
            // Check for existing property review
            const propertyReview = existingAnnotations.find(ann => ann.notes?.property);
            const wasReviewed = propertyReview?.notes?.property?.reviewed || false;
            const existingPropertyNote = propertyReview?.notes?.property?.note || '';
            
            overlayHTML += '<div class="sof-section">';
            overlayHTML += '<h3>Property Details</h3>';
            overlayHTML += '<div class="sof-property-details">';
            overlayHTML += `<div class="property-bullet">📍 <strong>Property:</strong> ${fullAddress}</div>`;
            overlayHTML += `<div class="property-bullet">💷 <strong>Purchase Price:</strong> ${price}</div>`;
            overlayHTML += `<div class="property-bullet">📋 <strong>Stamp Duty:</strong> ${sdlt}</div>`;
            overlayHTML += `<div class="property-bullet">🏗️ <strong>New Build:</strong> ${newBuild}</div>`;
            overlayHTML += '</div>';
            
            // Property review section
            overlayHTML += '<div class="property-review-section">';
            overlayHTML += '<label class="property-reviewed-label">';
            overlayHTML += `<input type="checkbox" class="property-reviewed-checkbox" ${wasReviewed ? 'checked' : ''}>`;
            overlayHTML += '<strong>Property Reviewed</strong>';
            overlayHTML += '</label>';
            overlayHTML += '<div class="form-group" style="margin-top: 8px;">';
            overlayHTML += '<label><strong>Property Notes</strong></label>';
            overlayHTML += `<textarea class="property-note-input" rows="2" placeholder="Add notes about the property...">${existingPropertyNote}</textarea>`;
            overlayHTML += '</div>';
            overlayHTML += '</div>';
            
            overlayHTML += '</div>';
        }
        
        // Get red flags to associate with funding methods
        const redFlags = this.extractRedFlags(check);
        
        // Linked Bank Accounts Section
        if (Object.keys(accounts).length > 0) {
            overlayHTML += '<div class="sof-section">';
            overlayHTML += '<h3>Linked Bank Accounts</h3>';
            overlayHTML += '<div class="accounts-investigation-container">';
            
            Object.entries(accounts).forEach(([accountId, accountData], accountIdx) => {
                overlayHTML += this.createAccountInvestigationCard(accountId, accountData, accountIdx, sofMatches, existingAnnotations, check);
            });
            
            overlayHTML += '</div></div>';
        }
        
        // Funding Methods Section
        if (funds.length > 0) {
            overlayHTML += '<div class="sof-section">';
            overlayHTML += '<h3>Funding Methods</h3>';
            overlayHTML += '<div class="funding-methods-investigation-container">';
            
            funds.forEach((fund, fundIdx) => {
                // Find red flags related to this funding method
                const relatedFlags = this.getRelatedRedFlags(fund, redFlags);
                overlayHTML += this.createSofFundingCard(fund, fundIdx, sofMatches, accounts, check, relatedFlags, existingAnnotations);
            });
            
            overlayHTML += '</div>';
            overlayHTML += '</div>';
        }
        
        // Bank Analysis Section - Full analysis with selectable items
        if (Object.keys(analysis).length > 0 && Object.keys(accounts).length > 0) {
            overlayHTML += '<div class="sof-section">';
            overlayHTML += '<h3>Bank Analysis</h3>';
            overlayHTML += '<p class="section-hint">Select transactions, chains, or groups to flag or add comments</p>';
            
            // Render full bank analysis sections with selectable items
            overlayHTML += this.createSofBankAnalysisSections(analysis, accounts, check, existingAnnotations);
            
            overlayHTML += '</div>';
        }
        
        // Biggest Transactions by Currency Section (from bank:summary)
        const summaryByCcy = bankSummary?.breakdown?.summary?.by_ccy;
        if (summaryByCcy && Object.keys(summaryByCcy).length > 0) {
            overlayHTML += '<div class="sof-section">';
            overlayHTML += '<h3>Largest Transactions by Currency</h3>';
            overlayHTML += '<p class="section-hint">Top transactions for each currency with flag and comment options</p>';
            
            // Render biggest transactions section with flag buttons
            overlayHTML += this.createSofBiggestTransactionsSection(summaryByCcy, accounts, check, existingAnnotations);
            
            overlayHTML += '</div>';
        }
        
        // Previous Annotations Section
        if (existingAnnotations.length > 0) {
            overlayHTML += '<div class="annotation-history-section">';
            overlayHTML += '<h3>Investigation History</h3>';
            
            existingAnnotations.forEach((annotation, annIdx) => {
                // Format date nicely
                const dateObj = new Date(annotation.timestamp);
                const formattedDate = dateObj.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                }) + ' at ' + dateObj.toLocaleTimeString('en-GB', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                // Format user name
                const userName = annotation.userName || annotation.user || 'Unknown';
                const formattedUserName = userName
                    .split(/[-._]/)
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join(' ');
                
                const notes = annotation.notes || {};
                
                // Calculate summary tags
                const summaryTags = [];
                
                // Property
                if (notes.property) {
                    summaryTags.push({ label: 'Property', type: 'neutral' });
                }
                
                // Accounts
                if (notes.accounts && notes.accounts.length > 0) {
                    summaryTags.push({ label: `${notes.accounts.length} Account${notes.accounts.length > 1 ? 's' : ''}`, type: 'neutral' });
                }
                
                // Transactions
                if (notes.transactions && notes.transactions.length > 0) {
                    summaryTags.push({ label: `${notes.transactions.length} Transaction${notes.transactions.length > 1 ? 's' : ''}`, type: 'neutral' });
                }
                
                // Chains
                if (notes.chains && notes.chains.length > 0) {
                    summaryTags.push({ label: `${notes.chains.length} Chain${notes.chains.length > 1 ? 's' : ''}`, type: 'neutral' });
                }
                
                // Funding Methods with red flag status
                if (notes.fundingMethods && notes.fundingMethods.length > 0) {
                    notes.fundingMethods.forEach(fm => {
                        // Better formatting for funding types
                        let fundLabel = (fm.fundType || '').replace('fund:', '');
                        
                        // Map specific types to friendly names
                        const typeMap = {
                            'mortgage': 'Mortgage',
                            'savings': 'Savings',
                            'gift': 'Gift',
                            'sale-property': 'Property Sale',
                            'sale:property': 'Property Sale',
                            'sale-assets': 'Asset Sale',
                            'sale:assets': 'Asset Sale',
                            'inheritance': 'Inheritance',
                            'htb': 'Help to Buy / LISA',
                            'htb_lisa': 'Help to Buy / LISA',
                            'investment': 'Investment',
                            'business': 'Business Income',
                            'loan': 'Loan',
                            'income': 'Income',
                            'other': 'Other'
                        };
                        
                        fundLabel = typeMap[fundLabel] || fundLabel.replace(/[-:_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        
                        // Check for red flags and their statuses
                        if (fm.redFlags && fm.redFlags.length > 0) {
                            const confirmedCount = fm.redFlags.filter(rf => rf.status === 'confirmed').length;
                            const dismissedCount = fm.redFlags.filter(rf => rf.status === 'dismissed').length;
                            const pendingCount = fm.redFlags.filter(rf => !rf.status || rf.status === 'pending').length;
                            
                            if (confirmedCount > 0) {
                                summaryTags.push({ label: `${fundLabel}: ${confirmedCount} Confirmed`, type: 'confirmed' });
                            }
                            if (dismissedCount > 0) {
                                summaryTags.push({ label: `${fundLabel}: ${dismissedCount} Dismissed`, type: 'dismissed' });
                            }
                            if (pendingCount > 0) {
                                summaryTags.push({ label: `${fundLabel}: ${pendingCount} Pending`, type: 'pending' });
                            }
                        } else {
                            summaryTags.push({ label: fundLabel, type: 'neutral' });
                        }
                    });
                }
                
                overlayHTML += `<div class="annotation-card collapsed" data-annotation-idx="${annIdx}">`;
                overlayHTML += `<div class="annotation-card-header" onclick="manager.toggleAnnotationCard(event, ${annIdx});">`;
                overlayHTML += '<div class="annotation-header-main">';
                overlayHTML += '<span class="annotation-user">' + formattedUserName + '</span>';
                overlayHTML += '<span class="annotation-date">' + formattedDate + '</span>';
                overlayHTML += '</div>';
                
                // Summary tags
                if (summaryTags.length > 0) {
                    overlayHTML += '<div class="annotation-summary-tags">';
                    summaryTags.forEach(tag => {
                        overlayHTML += `<span class="annotation-summary-tag ${tag.type}">${tag.label}</span>`;
                    });
                    overlayHTML += '</div>';
                }
                
                overlayHTML += '<span class="expand-indicator">▼</span>';
                overlayHTML += '</div>';
                overlayHTML += '<div class="annotation-card-body">';
                
                // Show property review
                if (notes.property) {
                    overlayHTML += '<div class="prev-annotation-item">';
                    overlayHTML += '<strong>Property:</strong> ';
                    if (notes.property.reviewed) {
                        const reviewIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                        overlayHTML += '<span class="prev-status">' + reviewIcon + 'Reviewed</span>';
                    }
                    if (notes.property.note) overlayHTML += '<div class="prev-note">' + notes.property.note + '</div>';
                    overlayHTML += '</div>';
                }
                
                // Show account reviews
                if (notes.accounts && notes.accounts.length > 0) {
                    notes.accounts.forEach(acc => {
                        overlayHTML += '<div class="prev-annotation-item">';
                        overlayHTML += '<strong>Account ' + acc.accountIdx + ':</strong> ';
                        if (acc.reviewed) {
                            const reviewIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                            overlayHTML += '<span class="prev-status">' + reviewIcon + 'Reviewed</span>';
                        }
                        if (acc.note) overlayHTML += '<div class="prev-note">' + acc.note + '</div>';
                        overlayHTML += '</div>';
                    });
                }
                
                // Show transaction flags/notes
                if (notes.transactions && notes.transactions.length > 0) {
                    const txCount = notes.transactions.length;
                    overlayHTML += '<div class="prev-annotation-item">';
                    overlayHTML += '<strong>Transactions:</strong> ' + txCount + ' transaction' + (txCount > 1 ? 's' : '') + ' reviewed';
                    
                    const flagCounts = {};
                    notes.transactions.forEach(tx => {
                        if (tx.flag) {
                            flagCounts[tx.flag] = (flagCounts[tx.flag] || 0) + 1;
                        }
                    });
                    
                    if (Object.keys(flagCounts).length > 0) {
                        overlayHTML += '<div class="prev-tx-flags" style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">';
                        if (flagCounts.linked) overlayHTML += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3;">✓ ' + flagCounts.linked + ' linked</span>';
                        if (flagCounts.suspicious) overlayHTML += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336;">✗ ' + flagCounts.suspicious + ' suspicious</span>';
                        if (flagCounts.review) overlayHTML += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800;">— ' + flagCounts.review + ' review</span>';
                        if (flagCounts.cleared) overlayHTML += '<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50;">○ ' + flagCounts.cleared + ' cleared</span>';
                        overlayHTML += '</div>';
                    }
                    overlayHTML += '</div>';
                }
                
                // Show chains reviewed
                if (notes.chains && notes.chains.length > 0) {
                    overlayHTML += '<div class="prev-annotation-item">';
                    overlayHTML += '<strong>Transaction Chains:</strong> ' + notes.chains.length + ' chain' + (notes.chains.length > 1 ? 's' : '') + ' reviewed';
                    overlayHTML += '</div>';
                }
                
                // Show funding method annotations
                if (notes.fundingMethods && notes.fundingMethods.length > 0) {
                    notes.fundingMethods.forEach(fm => {
                        overlayHTML += '<div class="prev-annotation-item">';
                        
                        // Use friendly names for funding types
                        let fundLabel = (fm.fundType || '').replace('fund:', '');
                        const typeMap = {
                            'mortgage': 'Mortgage',
                            'savings': 'Savings',
                            'gift': 'Gift',
                            'sale-property': 'Property Sale',
                            'sale:property': 'Property Sale',
                            'sale-assets': 'Asset Sale',
                            'sale:assets': 'Asset Sale',
                            'inheritance': 'Inheritance',
                            'htb': 'Help to Buy / LISA',
                            'htb_lisa': 'Help to Buy / LISA',
                            'investment': 'Investment',
                            'business': 'Business Income',
                            'loan': 'Loan',
                            'income': 'Income',
                            'other': 'Other'
                        };
                        fundLabel = typeMap[fundLabel] || fundLabel.replace(/[-:_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        
                        overlayHTML += '<strong>' + fundLabel + ':</strong>';
                        
                        if (fm.verified && fm.verified.length > 0) {
                            const verificationLabelMap = {
                                'gift_relationship': 'Giftor relationship confirmed',
                                'gift_checks': 'Giftor ID and AML checks completed',
                                'gift_transactions': 'Transactions reviewed and linked',
                                'savings_statements': 'Account statements reviewed',
                                'savings_balance': 'Balance verified via Bank Summary',
                                'savings_income': 'Income sources verified',
                                'sale_documents': 'Supporting documents reviewed',
                                'sale_proceeds': 'Sale proceeds confirmed',
                                'mortgage_offer': 'Mortgage offer reviewed',
                                'mortgage_affordability': 'Affordability assessment completed',
                                'generic_verified': 'Source verified and documented'
                            };
                            const verifiedLabels = fm.verified.map(v => verificationLabelMap[v] || v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
                            const checkIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                            overlayHTML += '<div class="prev-checkboxes">' + checkIcon + verifiedLabels.join(', ') + '</div>';
                        }
                        
                        if (fm.transactionMarkers && Object.keys(fm.transactionMarkers).length > 0) {
                            const markerCount = Object.keys(fm.transactionMarkers).length;
                            overlayHTML += '<div class="prev-tx-markers">' + markerCount + ' transaction marker' + (markerCount > 1 ? 's' : '') + '</div>';
                        }
                        
                        if (fm.redFlags && fm.redFlags.length > 0) {
                            overlayHTML += '<div class="prev-red-flags">';
                            fm.redFlags.forEach(rf => {
                                let statusIcon = '';
                                if (rf.status === 'confirmed') {
                                    statusIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#d32f2f" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                                } else if (rf.status === 'dismissed') {
                                    statusIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                                } else {
                                    statusIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                                }
                                overlayHTML += '<div class="prev-red-flag-item">';
                                overlayHTML += statusIcon + 'Red Flag: ' + (rf.status || 'pending').charAt(0).toUpperCase() + (rf.status || 'pending').slice(1);
                                if (rf.note) overlayHTML += ' - ' + rf.note;
                                overlayHTML += '</div>';
                            });
                            overlayHTML += '</div>';
                        }
                        
                        if (fm.note) {
                            overlayHTML += '<div class="prev-note">' + fm.note + '</div>';
                        }
                        
                        overlayHTML += '</div>';
                    });
                }
                
                overlayHTML += '</div></div>';
            });
            
            overlayHTML += '</div>';
        }
        
        overlayHTML += '</form></div></div></div>';
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }
    
    createAccountInvestigationCard(accountId, accountData, accountIdx, sofMatches, existingAnnotations, check) {
        const accountInfo = accountData.info || accountData;
        const accountName = accountInfo.name || accountInfo.account_name || 'Account';
        const providerName = accountInfo.provider?.name || 'Bank';
        const balance = accountInfo.balance?.current || accountInfo.balance?.available || 0;
        const statement = accountData.statement || [];
        
        // Check if this is from manual upload (needs deduplication)
        const taskOutcomes = check.taskOutcomes || {};
        const isManualUpload = taskOutcomes['documents:bank-statement']?.breakdown?.accounts?.[accountId];
        
        // Get logo
        const logoHtml = this.getBankLogo(providerName, providerName);
        const hasLogo = logoHtml.includes('<img');
        
        // Check for existing account annotations
        const accountAnnotations = existingAnnotations.flatMap(ann => {
            const accounts = ann.notes?.accounts || [];
            return accounts.filter(acc => acc.accountId === accountId);
        });
        
        const wasReviewed = accountAnnotations.some(acc => acc.reviewed);
        const existingNote = accountAnnotations.length > 0 ? accountAnnotations[0].note : '';
        
        // Get transaction markers, notes, and SOF links from ALL annotation sources
        const transactionMarkers = {};
        const transactionNotes = {};
        const transactionSofLinks = {};
        
        statement.forEach(tx => {
            const txAnnotations = this.getTransactionAnnotations(tx.id, check);
            if (txAnnotations.flag) transactionMarkers[tx.id] = txAnnotations.flag;
            if (txAnnotations.note) transactionNotes[tx.id] = txAnnotations.note;
            if (txAnnotations.linkedFundingMethods.length > 0) {
                transactionSofLinks[tx.id] = txAnnotations.linkedFundingMethods;
            }
            // Also include marker state for visual display
            if (txAnnotations.marker) transactionMarkers[tx.id] = txAnnotations.marker;
        });
        
        // Calculate summary counts for tags
        let linkedCount = 0;
        let reviewCount = 0;
        let flaggedCount = 0;
        
        statement.forEach(tx => {
            const txFlag = transactionMarkers[tx.id];
            const txLinks = transactionSofLinks[tx.id];
            
            if (txLinks && txLinks.length > 0) linkedCount++;
            if (txFlag === 'review') reviewCount++;
            if (txFlag === 'suspicious') flaggedCount++;
        });
        
        let html = `<div class="account-investigation-card collapsed" data-account-card="${accountId}">`;
        
        // Account Header - clickable to toggle
        html += `<div class="account-investigation-header" onclick="manager.toggleAccountCard(event, '${accountId}');">`;
        
        if (hasLogo) {
            const styledLogoHtml = logoHtml.replace(
                /class="bank-logo"/,
                'class="bank-logo" style="width: auto !important; height: auto !important; max-width: 60px !important; max-height: 40px !important; object-fit: contain !important; border: none !important; background: transparent !important; padding: 0 !important; border-radius: 0 !important;"'
            );
            html += `<div style="width: 60px; height: 40px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">${styledLogoHtml}</div>`;
        } else {
            html += `<div style="font-weight: 600; color: #003c71; font-size: 12px; flex-shrink: 0; width: 60px;">${providerName}</div>`;
        }
        
        html += '<div class="account-investigation-info">';
        html += `<div class="account-investigation-name">`;
        html += accountName;
        // Add tick icon if account reviewed
        if (wasReviewed) {
            html += ' <svg viewBox="0 0 300 300" style="width: 14px; height: 14px; vertical-align: middle; margin-left: 4px;"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
        }
        html += `</div>`;
        html += `<div class="account-investigation-balance">Balance: £${balance.toLocaleString()}</div>`;
        
        // Add summary tags
        html += '<div class="account-summary-tags">';
        if (reviewCount > 0) {
            html += `<span class="account-tag review">${reviewCount} review pending</span>`;
        }
        if (linkedCount > 0) {
            html += `<span class="account-tag linked">${linkedCount} transaction${linkedCount > 1 ? 's' : ''} linked</span>`;
        }
        if (flaggedCount > 0) {
            html += `<span class="account-tag flagged">${flaggedCount} flagged</span>`;
        }
        html += '</div>';
        
        html += '</div>';
        html += '<span class="expand-indicator">▼</span>';
        html += '</div>';
        
        // Account Details (expanded)
        html += '<div class="account-investigation-details" onclick="event.stopPropagation();">';
        
        // Account review controls
        html += '<div class="account-review-section">';
        html += '<label class="account-reviewed-label">';
        html += `<input type="checkbox" class="account-reviewed-checkbox" data-account-id="${accountId}" data-account-idx="${accountIdx}" ${wasReviewed ? 'checked' : ''}>`;
        html += '<strong>Account Reviewed</strong>';
        html += '</label>';
        html += '<div class="form-group" style="margin-top: 8px;">';
        html += '<label><strong>Account Notes</strong></label>';
        html += `<textarea class="account-note-input" data-account-id="${accountId}" data-account-idx="${accountIdx}" rows="2" placeholder="Add notes about this account...">${existingNote}</textarea>`;
        html += '</div>';
        html += '</div>';
        
        // Transactions list with flagging capabilities
        if (statement.length > 0) {
            html += '<div class="account-transactions-section">';
            html += `<div class="account-transactions-header">Transactions (${statement.length})</div>`;
            
            statement.forEach((tx, txIdx) => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
                const amount = tx.amount;
                const amountClass = amount >= 0 ? 'positive' : 'negative';
                const sign = amount >= 0 ? '+' : '';
                
                const existingFlag = transactionMarkers[tx.id] || '';
                const existingTxNote = transactionNotes[tx.id] || '';
                
                const hasExpanded = existingFlag || existingTxNote || (transactionSofLinks[tx.id] && transactionSofLinks[tx.id].length > 0);
                const linkedFundIdx = (transactionSofLinks[tx.id] && transactionSofLinks[tx.id].length > 0) ? transactionSofLinks[tx.id][0] : '';
                
                html += '<div class="transaction-investigation-row">';
                html += '<div class="transaction-investigation-main">';
                html += '<div class="transaction-investigation-info">';
                html += `<span class="tx-inv-date">${date}</span>`;
                html += `<span class="tx-inv-desc">${tx.description || tx.merchant_name || 'Transaction'}</span>`;
                html += `<span class="tx-inv-amount ${amountClass}">${sign}${currencySymbol}${Math.abs(amount).toFixed(2)}</span>`;
                html += '</div>';
                
                // Transaction flag buttons - small squares inline
                html += '<div class="tx-flag-buttons-inline">';
                // Green - Clear/Verified
                html += `<button type="button" class="tx-flag-btn-square linked ${existingFlag === 'linked' ? 'active' : ''}" data-account-id="${accountId}" data-tx-id="${tx.id}" data-flag="linked" title="Clear - Verified" onclick="event.stopPropagation(); manager.toggleTransactionExpand(this);">`;
                html += '<svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                html += '</button>';
                // Red - Suspicious
                html += `<button type="button" class="tx-flag-btn-square suspicious ${existingFlag === 'suspicious' ? 'active' : ''}" data-account-id="${accountId}" data-tx-id="${tx.id}" data-flag="suspicious" title="Suspicious" onclick="event.stopPropagation(); manager.toggleTransactionExpand(this);">`;
                html += '<svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
                html += '</button>';
                // Orange - Under Review
                html += `<button type="button" class="tx-flag-btn-square review ${existingFlag === 'review' ? 'active' : ''}" data-account-id="${accountId}" data-tx-id="${tx.id}" data-flag="review" title="Under Review" onclick="event.stopPropagation(); manager.toggleTransactionExpand(this);">`;
                html += '<svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                html += '</button>';
                // Blue + - Link to Funding
                html += `<button type="button" class="tx-flag-btn-square link-funding ${linkedFundIdx ? 'active' : ''}" data-account-id="${accountId}" data-tx-id="${tx.id}" data-action="link" title="Link to Funding Method" onclick="event.stopPropagation(); manager.toggleTransactionLinking(this);">`;
                html += '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="none" fill="currentColor"/><path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" fill="none"/></svg>';
                html += '</button>';
                html += '</div>';
                html += '</div>'; // Close transaction-investigation-main
                
                // Expandable sections (hidden by default)
                html += `<div class="tx-expand-section ${hasExpanded ? '' : 'collapsed'}" onclick="event.stopPropagation();">`;
                
                // Manual SOF linking dropdown (only visible when blue + is clicked)
                html += `<div class="tx-sof-linking ${linkedFundIdx ? '' : 'hidden'}">`;
                html += '<label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>';
                html += `<select class="tx-sof-link-select" data-account-id="${accountId}" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">`;
                html += '<option value="">-- Select funding method --</option>';
                
                // Get funding methods from check
                const sofTask = check.taskOutcomes?.['sof:v1'];
                const funds = sofTask?.breakdown?.funds || [];
                funds.forEach((fund, fIdx) => {
                    const fundType = fund.type || '';
                    const fundData = fund.data || {};
                    const fundAmount = fundData.amount ? `£${(fundData.amount / 100).toLocaleString()}` : '';
                    const fundLabel = fundType.replace('fund:', '').replace(/:/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const isSelected = linkedFundIdx === fIdx.toString();
                    html += `<option value="${fIdx}" ${isSelected ? 'selected' : ''}>${fundLabel} ${fundAmount}</option>`;
                });
                
                html += '</select>';
                html += '</div>';
                
                // Transaction note (visible when any button is clicked)
                html += `<div class="tx-note-field">`;
                html += `<textarea class="tx-note-input" data-account-id="${accountId}" data-tx-id="${tx.id}" rows="2" placeholder="Add transaction notes...">${existingTxNote}</textarea>`;
                html += '</div>';
                
                html += '</div>'; // Close tx-expand-section
                
                html += '</div>';
            });
            
            html += '</div>';
        }
        
        html += '</div>'; // Close account-investigation-details
        html += '</div>'; // Close account-investigation-card
        
        return html;
    }
    
    getRelatedRedFlags(fund, allRedFlags) {
        const type = fund.type || '';
        const relatedFlags = [];
        
        allRedFlags.forEach((flag, globalIndex) => {
            const flagDesc = flag.description || '';
            
            // Map red flags to funding types and preserve global index
            if (flagDesc === 'Gifts Received' && type === 'fund:gift') {
                relatedFlags.push({ ...flag, globalIndex });
            } else if (flagDesc.includes('savings') && type === 'fund:savings') {
                relatedFlags.push({ ...flag, globalIndex });
            } else if (flagDesc === 'Cryptocurrency Funding' && type.includes('crypto')) {
                relatedFlags.push({ ...flag, globalIndex });
            } else if (flagDesc === 'Funds from Overseas' && (type.includes('overseas') || type.includes('foreign'))) {
                relatedFlags.push({ ...flag, globalIndex });
            }
        });
        
        return relatedFlags;
    }
    
    createSofFundingCard(fund, fundIdx, sofMatches, accounts, check, relatedFlags = [], existingAnnotations = []) {
        const type = fund.type || 'unknown';
        const data = fund.data || {};
        const amount = data.amount ? `£${(data.amount / 100).toLocaleString()}` : 'Not specified';
        
        // Get matched transactions (including user-linked ones)
        const matchedTxIds = this.getMatchedTransactions(type, sofMatches, fund, fundIdx, check);
        const hasMatches = matchedTxIds.length > 0;
        
        // Map funding type to display name
        const cleanType = type.replace('fund:', '').replace(/:/g, '-');
        const typeNames = {
            'mortgage': 'Mortgage',
            'savings': 'Savings',
            'gift': 'Gift',
            'sale-property': 'Sale of Property',
            'sale-assets': 'Sale of Assets',
            'inheritance': 'Inheritance',
            'divorce': 'Divorce',
            'cryptocurrency': 'Cryptocurrency',
            'htb': 'Lifetime ISA',
            'htb_lisa': 'Lifetime ISA',
            'investment': 'Investment',
            'business': 'Business Income',
            'loan': 'Loan',
            'income': 'Income',
            'other': 'Other'
        };
        const typeName = typeNames[cleanType] || cleanType;
        
        // Check for existing annotations for this funding method
        const fundAnnotations = existingAnnotations.flatMap(ann => {
            const fundingMethods = ann.notes?.fundingMethods || [];
            return fundingMethods.filter(fm => fm.fundType === type && fm.fundIdx === fundIdx.toString());
        });
        
        const verifiedItems = fundAnnotations.flatMap(fm => fm.verified || []);
        const hasNote = fundAnnotations.some(fm => fm.note && fm.note.trim());
        
        // Get transaction markers for this funding method from ALL sources
        const fundTransactionMarkers = {};
        
        // First, get markers explicitly set for this funding method
        fundAnnotations.forEach(fm => {
            Object.assign(fundTransactionMarkers, fm.transactionMarkers || {});
        });
        
        // Then, for each matched transaction, also check for annotations from other sources
        matchedTxIds.forEach(txId => {
            const txAnnotations = this.getTransactionAnnotations(txId, check);
            // If there's a marker and we don't already have one for this funding method, use it
            if (txAnnotations.marker && !fundTransactionMarkers[txId]) {
                fundTransactionMarkers[txId] = txAnnotations.marker;
            }
        });
        
        // Format verified items as readable text with proper labels
        const verificationLabelMap = {
            'gift_relationship': 'Giftor relationship confirmed',
            'gift_checks': 'Giftor ID and AML checks completed',
            'gift_transactions': 'Transactions reviewed and linked',
            'savings_statements': 'Account statements reviewed',
            'savings_balance': 'Balance verified via Bank Summary',
            'savings_income': 'Income sources verified',
            'sale_documents': 'Supporting documents reviewed',
            'sale_proceeds': 'Sale proceeds confirmed',
            'mortgage_offer': 'Mortgage offer reviewed',
            'mortgage_affordability': 'Affordability assessment completed',
            'generic_verified': 'Source verified and documented'
        };
        
        const verifiedLabels = verifiedItems.map(item => 
            verificationLabelMap[item] || item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        );
        
        // Calculate transaction status counts
        let acceptedCount = 0;
        let rejectedCount = 0;
        let reviewCount = 0;
        
        matchedTxIds.forEach(txId => {
            const marker = fundTransactionMarkers[txId];
            if (marker === 'accepted') acceptedCount++;
            else if (marker === 'rejected') rejectedCount++;
            else if (marker === 'review') reviewCount++;
        });
        
        let hasRedFlag = relatedFlags.length > 0;
        
        // Build collapsed header summary
        let summaryText = '';
        if (data.giftor?.name) summaryText = data.giftor.name;
        else if (data.lender) summaryText = data.lender;
        else if (data.people && data.people.length > 0) summaryText = data.people.map(p => p.name).filter(n => n).join(', ');
        
        const originBadge = this.getFundingOriginBadge(data.location);

        let html = `<div class="funding-investigation-card collapsed" data-funding-card="${fundIdx}">`;
        
        // Funding Header (collapsed view) - clickable to toggle
        html += `<div class="funding-investigation-header" onclick="manager.toggleFundingCard(event, ${fundIdx});">`;
        html += '<div class="funding-investigation-info">';
        html += `<div class="funding-investigation-name">${typeName}</div>`;
        html += '<div class="funding-investigation-meta">';
        if (originBadge) {
            html += originBadge;
        }
        html += `<span class="funding-investigation-amount">${amount}</span>`;
        html += '</div>';
        if (summaryText) {
            html += `<div class="funding-investigation-summary">${summaryText}</div>`;
        }
        
        // Summary tags
        html += '<div class="funding-summary-tags">';
        if (verifiedLabels.length > 0) {
            html += `<span class="funding-tag confirmed">✓ ${verifiedLabels.join(', ')}</span>`;
        }
        if (acceptedCount > 0) {
            html += `<span class="funding-tag accepted">${acceptedCount} accepted</span>`;
        }
        if (rejectedCount > 0) {
            html += `<span class="funding-tag rejected">${rejectedCount} rejected</span>`;
        }
        if (reviewCount > 0) {
            html += `<span class="funding-tag review-tx">${reviewCount} under review</span>`;
        }
        if (matchedTxIds.length > acceptedCount + rejectedCount + reviewCount) {
            const unmarkedCount = matchedTxIds.length - acceptedCount - rejectedCount - reviewCount;
            html += `<span class="funding-tag linked">${unmarkedCount} unreviewed</span>`;
        }
        if (hasRedFlag) {
            html += `<span class="funding-tag redflag">${relatedFlags.length} red flag${relatedFlags.length > 1 ? 's' : ''}</span>`;
        }
        html += '</div>';
        
        html += '</div>';
        html += '<span class="expand-indicator">▼</span>';
        html += '</div>';
        
        // Funding Details (expanded view)
        html += '<div class="funding-investigation-details" onclick="event.stopPropagation();">';
        
        // Type-specific details (same as task card)
        html += this.createFundingDetailsSection(fund, originBadge);
        
        // Matched transactions (same as task card)
        if (hasMatches) {
            html += this.createFundingMatchedTxSection(matchedTxIds, accounts, type, fundTransactionMarkers, check, fundIdx, sofMatches);
        }
        
        // Document status (same as task card)
        const docTaskKey = `documents:${cleanType}`;
        const docOutcome = check.taskOutcomes ? check.taskOutcomes[docTaskKey] : null;
        const documentCount = this.getDocumentCount(docOutcome);
        const hasDocuments = documentCount > 0;
        const docLines = [];
        const defaultReminder = 'Check the report pdf for evidence or obtain from the client and review manually';
        const shouldShowManualReview = !hasMatches && type !== 'fund:mortgage';

        if (hasDocuments) {
            const uploadedLabel = `${documentCount} document${documentCount === 1 ? '' : 's'} uploaded`;
            docLines.push({ status: 'clear', text: uploadedLabel });
            } else {
            docLines.push({ status: 'consider', text: defaultReminder });
        }

        if (shouldShowManualReview) {
            docLines.push({ status: 'consider', text: 'No linked bank transactions detected, manual review required.' });
        }

        if (docLines.length === 0) {
            docLines.push({ status: hasDocuments ? 'clear' : 'consider', text: defaultReminder });
        }
        
        html += '<div class="funding-doc-status">';
        html += '<div class="doc-status-text">';
        docLines.forEach(line => {
            const icon = this.getTaskCheckIcon(line.status === 'clear' ? 'CL' : line.status === 'fail' ? 'FA' : 'CO');
            html += `<div class="doc-status-line">${icon}<span>${line.text}</span></div>`;
        });
        html += '</div>';
        html += '</div>';
        
        // Red Flags Section (if applicable) - Show full details like in task card
        if (relatedFlags.length > 0) {
            const redCircleIcon = `<svg class="inline-icon" viewBox="0 0 24 24" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 6px;"><circle cx="12" cy="12" r="10" fill="#d32f2f"/><line x1="7" y1="12" x2="17" y2="12" stroke="white" stroke-width="2"/></svg>`;
            
            html += '<div class="red-flags-subsection">';
            html += `<div class="red-flag-header">${redCircleIcon}Red Flags</div>`;
            
            relatedFlags.forEach((flag, flagIdx) => {
                html += '<div class="red-flag-item">';
                html += `<div class="red-flag-title">${flag.description || 'Red Flag'}</div>`;
                
                // Show full details based on flag type
                const flagDesc = flag.description || '';
                
                // For savings discrepancy - show declared vs actual with accounts
                if (flagDesc.includes('savings')) {
                    // Get task outcomes for account data
                    const taskOutcomes = check.taskOutcomes || {};
                    const sofTask = taskOutcomes['sof:v1'];
                    const bankStatement = taskOutcomes['bank:statement'];
                    const bankSummary = taskOutcomes['bank:summary'];
                    const docsBankStatement = taskOutcomes['documents:bank-statement'];
                    
                    // Calculate declared savings
                    let totalDeclared = 0;
                    const savingsFunds = sofTask?.breakdown?.funds?.filter(f => f.type === 'fund:savings') || [];
                    savingsFunds.forEach(fund => {
                        totalDeclared += fund.data?.amount || 0;
                    });
                    
                    // Calculate actual savings
                    const bankAccounts = bankStatement?.breakdown?.accounts || 
                                       bankSummary?.breakdown?.accounts || 
                                       docsBankStatement?.breakdown?.accounts || 
                                       {};
                    let totalActual = 0;
                    const providerTotals = {};
                    
                    Object.values(bankAccounts).forEach(account => {
                        const accountInfo = account.info || account;
                        const balance = accountInfo.balance?.current || accountInfo.balance?.available || 0;
                        
                        if (balance > 0) {
                            totalActual += balance;
                            const providerName = accountInfo.provider?.name || 'Unknown Provider';
                            const providerId = accountInfo.provider?.id || providerName;
                            
                            if (!providerTotals[providerId]) {
                                providerTotals[providerId] = {
                                    name: providerName,
                                    total: 0,
                                    accounts: []
                                };
                            }
                            providerTotals[providerId].total += balance;
                            providerTotals[providerId].accounts.push({
                                name: accountInfo.name || accountInfo.account_name || accountInfo.type || 'Account',
                                balance: balance
                            });
                        }
                    });
                    
                    html += `<div class="red-flag-details" style="margin-top: 10px;">`;
                    html += `<div style="font-size: 12px; color: #666; margin-bottom: 8px;"><strong>Declared:</strong> £${(totalDeclared / 100).toLocaleString()}</div>`;
                    html += `<div style="font-size: 12px; color: #666; margin-bottom: 8px;"><strong>Actual:</strong> £${totalActual.toLocaleString()}</div>`;
                    
                    // Show account breakdown by provider (like in red flags task card)
                    if (Object.keys(providerTotals).length > 0) {
                        html += `<div style="margin-top: 12px;">`;
                        Object.values(providerTotals).forEach(provider => {
                            const logoHtml = this.getBankLogo(provider.name, provider.name);
                            const hasLogo = logoHtml.includes('<img');
                            
                            html += `<div style="display: flex; align-items: stretch; gap: 10px; padding: 10px 12px; background: white; border: 1px solid #e1e4e8; border-radius: 8px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">`;
                            
                            if (hasLogo) {
                                // Show logo - full height of card, no border - add inline styles directly to img tag
                                const styledLogoHtml = logoHtml.replace(
                                    /class="bank-logo"/,
                                    'class="bank-logo" style="width: auto !important; height: auto !important; max-width: 90px !important; max-height: 100% !important; object-fit: contain !important; border: none !important; background: transparent !important; padding: 0 !important; border-radius: 0 !important;"'
                                );
                                html += `<div style="width: 90px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${styledLogoHtml}</div>`;
                                html += `<div style="flex: 1;">`;
                                html += `<div style="font-size: 13px; font-weight: 600; color: #003c71; margin-bottom: 4px;">£${provider.total.toLocaleString()}</div>`;
                                provider.accounts.forEach((acc, idx) => {
                                    html += `<div style="font-size: 10px; color: #666; ${idx < provider.accounts.length - 1 ? 'margin-bottom: 1px;' : ''}">${acc.name}: £${acc.balance.toLocaleString()}</div>`;
                                });
                                html += `</div>`;
                            } else {
                                // No logo - show name
                                html += `<div style="flex: 1;">`;
                                html += `<div style="font-size: 13px; font-weight: 600; color: #003c71; margin-bottom: 3px;">${provider.name}</div>`;
                                html += `<div style="font-size: 13px; font-weight: 600; color: #388e3c; margin-bottom: 4px;">£${provider.total.toLocaleString()}</div>`;
                                provider.accounts.forEach((acc, idx) => {
                                    html += `<div style="font-size: 10px; color: #666; ${idx < provider.accounts.length - 1 ? 'margin-bottom: 1px;' : ''}">${acc.name}: £${acc.balance.toLocaleString()}</div>`;
                                });
                                html += `</div>`;
                            }
                            
                            html += `</div>`;
                        });
                        html += `</div>`;
                    }
                    
                    html += `</div>`;
                } 
                // For gift - don't duplicate giftor info (already shown in funding method details above)
                else if (flagDesc === 'Gifts Received') {
                    html += `<div class="red-flag-details" style="margin-top: 10px; font-size: 12px; color: #666;">Giftor details shown above in funding method</div>`;
                }
                // For other flags - show basic details
                else if (flag.details) {
                    html += `<div class="red-flag-details">${flag.details}</div>`;
                }
                
                // Red flag status selector with icons
                html += '<div class="red-flag-status" style="margin-top: 12px;">';
                html += '<label><strong>Status:</strong></label>';
                html += `<select class="red-flag-status-select" data-fund-idx="${fundIdx}" data-flag-idx="${flag.globalIndex}">`;
                html += '<option value="">-- Select Action --</option>';
                html += '<option value="confirmed">✗ Confirmed - Requires attention</option>';
                html += '<option value="dismissed">✓ Clear - Not applicable</option>';
                html += '<option value="review">— Consider - Under review</option>';
                html += '</select>';
                html += '</div>';
                
                // Red flag notes
                html += '<div class="form-group">';
                html += `<label><strong>Red Flag Notes</strong></label>`;
                html += `<textarea class="red-flag-note-input" data-fund-idx="${fundIdx}" data-flag-idx="${flag.globalIndex}" rows="2" placeholder="Add notes about this red flag..."></textarea>`;
                html += '</div>';
                
                html += '</div>';
            });
            
            html += '</div>';
        }
        
        // INVESTIGATION FEATURES
        html += '<div class="funding-investigation-controls">';
        
        // Verification checkboxes
        html += this.createFundingVerificationChecks(type, data, matchedTxIds, existingAnnotations);
        
        // Notes textarea
        html += '<div class="form-group" style="margin-top: 12px;">';
        html += '<label><strong>Investigation Notes</strong></label>';
        html += `<textarea class="sof-note-input" data-fund-idx="${fundIdx}" data-fund-type="${type}" rows="3" placeholder="Add investigation notes..."></textarea>`;
        html += '</div>';
        
        html += '</div>'; // Close funding-investigation-controls
        html += '</div>'; // Close funding-investigation-details
        html += '</div>'; // Close funding-investigation-card
        
        return html;
    }
    
    createFundingDetailsSection(fund, originBadge = '') {
        const detailHtml = this.buildFundingDetailContent(fund, { originBadge });
        if (!detailHtml) return '';
        return `<div class="funding-meta-container">${detailHtml}</div>`;
    }
    
    createFundingMatchedTxSection(matchedTxIds, accounts, type, transactionMarkers = {}, check = null, fundIdx = null, sofMatches = {}) {
        const labelMap = {
            'fund:gift': 'Potential Gift Deposits',
            'fund:mortgage': 'Potential Mortgage Deposits',
            'fund:savings': 'Verified Salary Deposits',
            'fund:income': 'Verified Salary Deposits',
            'fund:property_sale': 'Potential Property Sale Proceeds',
            'fund:sale:property': 'Potential Property Sale Proceeds',
            'fund:asset_sale': 'Potential Asset Sale Proceeds',
            'fund:sale:assets': 'Potential Asset Sale Proceeds',
            'fund:htb': 'Potential Lifetime ISA Deposits',
            'fund:htb_lisa': 'Potential Lifetime ISA Deposits',
            'fund:inheritance': 'Potential Inheritance Deposits',
            'fund:loan': 'Potential Loan Deposits',
            'fund:investment': 'Potential Investment Deposits',
            'fund:business': 'Potential Business Income',
            'fund:other': 'Potential Matched Transactions'
        };
        const matchLabel = labelMap[type] || 'Potential Matched Transactions';
        
        // Get comprehensive annotations for all transactions from ALL sources
        const userLinkedTxIds = new Set();
        const transactionNotes = {};
        const transactionFlags = {};
        
        if (check && fundIdx !== null) {
            // Use getTransactionAnnotations for each transaction to get ALL sources
            matchedTxIds.forEach(txId => {
                const txAnnotations = this.getTransactionAnnotations(txId, check);
                
                // Check if linked to THIS funding method
                if (txAnnotations.linkedFundingMethods.includes(fundIdx.toString())) {
                    userLinkedTxIds.add(txId);
                }
                
                // Get notes from all sources
                if (txAnnotations.note) {
                    transactionNotes[txId] = txAnnotations.note;
                }
                
                // Get flags from bank analysis items
                if (txAnnotations.flag) {
                    transactionFlags[txId] = txAnnotations.flag;
                }
            });
        }
        
        // Get Thirdfort auto-matched transaction IDs
        const autoMatchedTxIds = new Set();
        const fundTypeMap = {
            'fund:gift': ['gift', 'gift_transactions'],
            'fund:mortgage': ['mortgage', 'mortgage_transactions'],
            'fund:savings': ['savings', 'savings_transactions', 'salary_transactions'],
            'fund:income': ['salary_transactions', 'income_transactions']
        };
        const matchKeys = fundTypeMap[type] || [];
        matchKeys.forEach(key => {
            if (sofMatches[key] && Array.isArray(sofMatches[key])) {
                sofMatches[key].forEach(txId => autoMatchedTxIds.add(txId));
            }
        });
        
        let html = '<div class="matched-transactions-section"><div class="matched-tx-label">' + matchLabel + '</div>';
        
        matchedTxIds.forEach(txId => {
            let tx = null;
            let accountName = '';
            for (const [accountId, accountData] of Object.entries(accounts)) {
                const statement = accountData.statement || [];
                tx = statement.find(t => t.id === txId);
                if (tx) {
                    accountName = (accountData.info || accountData).name || 'Account';
                    break;
                }
            }
            
            if (tx) {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
                const txAmount = tx.amount >= 0 ? '+' : '';
                
                // Get existing marker for this transaction
                const existingMarker = transactionMarkers[txId] || '';
                
                // Get flag from bank analysis
                const flag = transactionFlags[txId];
                let flagBadge = '';
                if (flag === 'cleared') {
                    flagBadge = '<span class="tx-marker-badge cleared">○ Cleared</span>';
                } else if (flag === 'suspicious') {
                    flagBadge = '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                } else if (flag === 'review') {
                    flagBadge = '<span class="tx-marker-badge review">— Review</span>';
                } else if (flag === 'linked') {
                    flagBadge = '<span class="tx-marker-badge linked">✓ Linked</span>';
                }
                
                // Determine source badge
                const isUserLinked = userLinkedTxIds.has(txId);
                const isAutoMatched = autoMatchedTxIds.has(txId);
                let sourceBadge = '';
                if (isUserLinked && !isAutoMatched) {
                    sourceBadge = '<span class="tx-source-badge user-linked" title="Manually linked by cashier">👤 User Linked</span>';
                } else if (isUserLinked && isAutoMatched) {
                    sourceBadge = '<span class="tx-source-badge both-matched" title="Auto-matched by Thirdfort and confirmed by cashier">✓ Confirmed</span>';
                }
                
                // Get transaction note
                const txNote = transactionNotes[txId] || '';
                
                html += '<div class="matched-tx-row-with-markers">';
                html += '<div class="matched-tx-info">';
                html += `<span class="matched-tx-date">${date}</span>`;
                html += `<span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Transaction'}${flagBadge}${sourceBadge}</span>`;
                html += `<span class="matched-tx-account">${accountName}</span>`;
                html += `<span class="matched-tx-amount">${txAmount}${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>`;
                html += '</div>';
                html += '<div class="tx-marker-actions">';
                // Accepted icon (green tick)
                html += `<button type="button" class="tx-marker-btn accepted ${existingMarker === 'accepted' ? 'active' : ''}" data-tx-id="${txId}" data-marker="accepted" title="Accepted - Linked" onclick="event.stopPropagation(); manager.toggleTransactionMarker(this)">`;
                html += '<svg viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                html += '</button>';
                // Rejected icon (red cross)
                html += `<button type="button" class="tx-marker-btn rejected ${existingMarker === 'rejected' ? 'active' : ''}" data-tx-id="${txId}" data-marker="rejected" title="Rejected - Not linked" onclick="event.stopPropagation(); manager.toggleTransactionMarker(this)">`;
                html += '<svg viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
                html += '</button>';
                // Review icon (orange dash)
                html += `<button type="button" class="tx-marker-btn review ${existingMarker === 'review' ? 'active' : ''}" data-tx-id="${txId}" data-marker="review" title="Needs review" onclick="event.stopPropagation(); manager.toggleTransactionMarker(this)">`;
                html += '<svg viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                html += '</button>';
                html += '</div>';
                
                // Show transaction note if exists
                if (txNote) {
                    html += '<div class="matched-tx-note">';
                    html += '<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; margin-right: 4px; vertical-align: middle;"><path fill="#666" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>';
                    html += `<span style="color: #666; font-size: 12px; font-style: italic;">${txNote}</span>`;
                    html += '</div>';
                }
                
                html += '</div>';
            }
        });
        
        html += '</div>';
        
        return html;
    }
    
    createFundingVerificationChecks(type, data, matchedTxIds, existingAnnotations = []) {
        // Check which items were previously verified
        const previouslyVerified = new Set();
        existingAnnotations.forEach(ann => {
            const notes = ann.notes || {};
            const fundingMethods = notes.fundingMethods || [];
            fundingMethods.forEach(fm => {
                if (fm.fundType === type && fm.verified) {
                    fm.verified.forEach(v => previouslyVerified.add(v));
                }
            });
        });
        
        let html = '<div class="verification-checks">';
        
        const createCheckbox = (value, label) => {
            const wasVerified = previouslyVerified.has(value);
            const indicator = wasVerified ? ' <span style="color: #39b549; font-size: 11px;">(Previously verified ✓)</span>' : '';
            return `<label><input type="checkbox" name="verification" value="${value}"> ${label}${indicator}</label>`;
        };
        
        if (type === 'fund:gift') {
            html += createCheckbox('gift_relationship', 'Giftor relationship confirmed');
            html += createCheckbox('gift_checks', 'Giftor ID and AML checks completed');
            if (matchedTxIds.length > 0) {
                html += createCheckbox('gift_transactions', 'Transactions reviewed and linked');
            }
        } 
        else if (type === 'fund:savings') {
            html += createCheckbox('savings_statements', 'Account statements reviewed');
            html += createCheckbox('savings_balance', 'Balance verified via Bank Summary');
            html += createCheckbox('savings_income', 'Income sources verified');
        } 
        else if (type.includes('sale')) {
            html += createCheckbox('sale_documents', 'Supporting documents reviewed');
            html += createCheckbox('sale_proceeds', 'Sale proceeds confirmed');
        } 
        else if (type === 'fund:mortgage') {
            html += createCheckbox('mortgage_offer', 'Mortgage offer reviewed');
            html += createCheckbox('mortgage_affordability', 'Affordability assessment completed');
        } 
        else {
            html += createCheckbox('generic_verified', 'Source verified and documented');
        }
        
        html += '</div>';
        
        return html;
    }
    
    getMatchedTransactions(fundType, sofMatches, fund = null, fundIdx = null, check = null) {
        const fundTypeMap = {
            'fund:gift': ['gift', 'gift_transactions'],
            'fund:mortgage': ['mortgage', 'mortgage_transactions'],
            'fund:savings': ['savings', 'savings_transactions', 'salary_transactions'],
            'fund:property_sale': ['property_sale', 'property_sale_transactions'],
            'fund:sale:property': ['property_sale', 'property_sale_transactions'],
            'fund:asset_sale': ['asset_sale', 'asset_sale_transactions'],
            'fund:sale:assets': ['asset_sale', 'asset_sale_transactions'],
            'fund:htb': ['htb_lisa', 'htb_transactions', 'htb_lisa_transactions'],
            'fund:htb_lisa': ['htb_lisa', 'htb_transactions', 'htb_lisa_transactions'],
            'fund:inheritance': ['inheritance', 'inheritance_transactions'],
            'fund:income': ['salary_transactions', 'income_transactions']
        };
        
        let matchKeys = fundTypeMap[fundType] || [];
        
        // For savings with people/incomes data, prioritize salary_transactions
        if (fundType === 'fund:savings' && fund) {
            const data = fund.data || {};
            if (data.people && data.people.some(p => p.incomes && p.incomes.length > 0)) {
                matchKeys = ['salary_transactions', ...matchKeys];
            }
        }
        
        let matchedTxIds = [];
        
        // Get Thirdfort automatic matches
        for (const key of matchKeys) {
            if (sofMatches[key] && Array.isArray(sofMatches[key])) {
                matchedTxIds = [...matchedTxIds, ...sofMatches[key]];
            }
        }
        
        // Add user-manually-linked transactions from annotations
        if (check && fundIdx !== null) {
            const sofAnnotations = check.sofAnnotations || [];
            sofAnnotations.forEach(ann => {
                // Direct transaction links
                const transactions = ann.notes?.transactions || [];
                transactions.forEach(tx => {
                    // Check if this transaction is linked to this funding method
                    if (tx.linkedToFunds && tx.linkedToFunds.includes(fundIdx.toString())) {
                        matchedTxIds.push(tx.txId);
                    }
                });
                
                // Bank analysis items (chains, repeating groups) linked to this funding method
                const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
                bankAnalysisItems.forEach(item => {
                    if (item.linkedToFundIdx === fundIdx.toString()) {
                        // Get the transactions that are part of this item
                        if (item.type === 'transaction' && item.transactionId) {
                            matchedTxIds.push(item.transactionId);
                        } else if (item.type === 'chain' && item.chainId) {
                            // Chain IDs are composite of transaction IDs separated by |
                            const chainTxIds = item.chainId.split('|');
                            matchedTxIds.push(...chainTxIds);
                        } else if (item.type === 'repeating-group' && item.groupIndex !== undefined) {
                            // Get all transactions in this repeating group
                            const taskOutcomes = check.taskOutcomes || {};
                            const bankStatement = taskOutcomes['bank:statement'];
                            const bankSummary = taskOutcomes['bank:summary'];
                            const docsBankStatement = taskOutcomes['documents:bank-statement'];
                            const analysis = bankStatement?.breakdown?.analysis || 
                                           bankSummary?.breakdown?.analysis || 
                                           docsBankStatement?.breakdown?.analysis;
                            
                            if (analysis && analysis.repeating_transactions) {
                                const group = analysis.repeating_transactions[item.groupIndex];
                                if (group && group.items) {
                                    matchedTxIds.push(...group.items);
                                }
                            }
                        }
                    }
                });
            });
        }
        
        return [...new Set(matchedTxIds)];
    }
    
    createSofChainCard(chain, chainIdx, check, existingAnnotations = []) {
        let html = '<div class="sof-chain-card">';
        
        // Chain description
        html += '<div class="chain-description">';
        html += '<strong>Chain ' + (chainIdx + 1) + ':</strong> ';
        
        // Build chain description
        const steps = [];
        if (chain.source) steps.push('Income');
        steps.push('Transfer Out');
        if (chain.in) steps.push('Transfer In');
        html += steps.join(' → ');
        
        html += '</div>';
        
        // Chain transactions preview
        html += '<div class="chain-preview">';
        
        if (chain.source) {
            const sourceAmount = Math.abs(chain.source.amount).toFixed(2);
            html += `<span class="chain-step">£${sourceAmount} (${chain.source.description || 'Income'})</span>`;
            html += ' → ';
        }
        
        const outAmount = Math.abs(chain.out.amount).toFixed(2);
        html += `<span class="chain-step">£${outAmount} (${chain.out.description || 'Transfer'})</span>`;
        
        html += '</div>';
        
        // Flag buttons (consistent style with transaction flags)
        html += '<div class="tx-flag-buttons" style="margin-top: 12px;">';
        html += `<button type="button" class="tx-flag-btn linked" data-chain-idx="${chainIdx}" data-flag="linked" title="Linked to SoF" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn suspicious" data-chain-idx="${chainIdx}" data-flag="suspicious" title="Suspicious" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn review" data-chain-idx="${chainIdx}" data-flag="review" title="Under review" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn cleared" data-chain-idx="${chainIdx}" data-flag="cleared" title="Reviewed & Clear" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        html += '</button>';
        html += '</div>';
        
        // Notes textarea
        html += '<div class="form-group" style="margin-top: 12px;">';
        html += `<textarea class="chain-note-input" data-chain-idx="${chainIdx}" rows="2" placeholder="Add note for this chain..."></textarea>`;
        html += '</div>';
        
        html += '</div>';
        
        return html;
    }
    
    createSofTransactionCard(tx, txIdx, accounts, check, existingAnnotations = []) {
        const txDate = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const txAmount = Math.abs(tx.amount).toFixed(2);
        const txDesc = tx.description || tx.merchant_name || 'Transaction';
        const amountClass = tx.amount >= 0 ? 'positive' : 'negative';
        const sign = tx.amount >= 0 ? '+' : '';
        const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
        
        // Find account name and ID
        let accountName = '';
        let accountId = '';
        for (const [accId, accountData] of Object.entries(accounts)) {
            const statement = accountData.statement || [];
            if (statement.find(t => t.id === tx.id)) {
                accountName = (accountData.info || accountData).name || 'Account';
                accountId = accId;
                break;
            }
        }
        
        let html = '<div class="sof-tx-card">';
        
        // Transaction details
        html += '<div class="tx-details">';
        html += `<span class="tx-date">${txDate}</span>`;
        html += `<span class="tx-desc">${txDesc}</span>`;
        html += `<span class="tx-account">${accountName}</span>`;
        html += `<span class="tx-amount ${amountClass}">${sign}${currencySymbol}${txAmount}</span>`;
        html += '</div>';
        
        // Flag buttons (consistent style with transaction flags)
        html += '<div class="tx-flag-buttons" style="margin-top: 12px;">';
        html += `<button type="button" class="tx-flag-btn linked" data-large-tx-idx="${txIdx}" data-tx-id="${tx.id}" data-flag="linked" title="Linked to SoF" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn suspicious" data-large-tx-idx="${txIdx}" data-tx-id="${tx.id}" data-flag="suspicious" title="Suspicious" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn review" data-large-tx-idx="${txIdx}" data-tx-id="${tx.id}" data-flag="review" title="Under review" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 300 300" style="width: 14px; height: 14px;"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
        html += '</button>';
        html += `<button type="button" class="tx-flag-btn cleared" data-large-tx-idx="${txIdx}" data-tx-id="${tx.id}" data-flag="cleared" title="Reviewed & Clear" onclick="event.stopPropagation(); this.classList.toggle('active');">`;
        html += '<svg viewBox="0 0 24 24" style="width: 14px; height: 14px;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
        html += '</button>';
        html += '</div>';
        
        // Notes textarea
        html += '<div class="form-group" style="margin-top: 12px;">';
        html += `<textarea class="tx-note-input large-tx-note" data-large-tx-idx="${txIdx}" data-tx-id="${tx.id}" rows="2" placeholder="Add note..."></textarea>`;
        html += '</div>';
        
        html += '</div>';
        
        return html;
    }
    
    saveSofInvestigation() {
        const check = this.currentCheck;
        const form = document.getElementById('sofInvestigationForm');
        
        // Collect all data
        const investigation = {
            property: null,
            fundingMethods: [],
            accounts: [],
            transactions: [],
            chains: [],
            timestamp: new Date().toISOString()
        };
        
        // Collect property review data
        const propertyCheckbox = form.querySelector('.property-reviewed-checkbox');
        const propertyNoteField = form.querySelector('.property-note-input');
        if (propertyCheckbox || propertyNoteField) {
            const reviewed = propertyCheckbox ? propertyCheckbox.checked : false;
            const note = propertyNoteField ? propertyNoteField.value.trim() : '';
            
            if (reviewed || note) {
                investigation.property = {
                    reviewed: reviewed,
                    note: note
                };
            }
        }
        
        // Collect account review data
        const accountCards = form.querySelectorAll('.account-investigation-card');
        accountCards.forEach((card) => {
            const checkbox = card.querySelector('.account-reviewed-checkbox');
            const noteTextarea = card.querySelector('.account-note-input');
            
            if (checkbox) {
                const accountId = checkbox.dataset.accountId;
                const accountIdx = checkbox.dataset.accountIdx;
                const reviewed = checkbox.checked;
                const note = noteTextarea ? noteTextarea.value.trim() : '';
                
                if (reviewed || note) {
                    investigation.accounts.push({
                        accountId: accountId,
                        accountIdx: accountIdx,
                        reviewed: reviewed,
                        note: note
                    });
                }
            }
        });
        
        // Collect transaction flags and notes from account investigation cards
        const txInvestigationRows = form.querySelectorAll('.transaction-investigation-row');
        txInvestigationRows.forEach((row) => {
            // Get active flag button (using new square button class)
            const activeBtn = row.querySelector('.tx-flag-btn-square.active');
            const txNoteField = row.querySelector('.tx-note-input');
            const sofLinkSelect = row.querySelector('.tx-sof-link-select');
            
            // Get linked funding method (single select)
            let linkedFundIdx = '';
            if (sofLinkSelect && sofLinkSelect.value) {
                linkedFundIdx = sofLinkSelect.value;
            }
            
            if (activeBtn || (txNoteField && txNoteField.value.trim()) || linkedFundIdx) {
                const accountId = activeBtn ? activeBtn.dataset.accountId : 
                               txNoteField ? txNoteField.dataset.accountId :
                               sofLinkSelect ? sofLinkSelect.dataset.accountId : '';
                const txId = activeBtn ? activeBtn.dataset.txId : 
                           txNoteField ? txNoteField.dataset.txId :
                           sofLinkSelect ? sofLinkSelect.dataset.txId : '';
                const flag = activeBtn ? activeBtn.dataset.flag : '';
                const note = txNoteField ? txNoteField.value.trim() : '';
                
                if (flag || note || linkedFundIdx) {
                    investigation.transactions.push({
                        accountId: accountId,
                        txId: txId,
                        flag: flag,
                        note: note,
                        linkedToFunds: linkedFundIdx ? [linkedFundIdx] : []
                    });
                }
            }
        });
        
        // Collect funding method notes, verifications, and transaction markers
        // Find all funding cards to process each one
        const fundingCards = form.querySelectorAll('.funding-investigation-card');
        fundingCards.forEach((card, idx) => {
            const textarea = card.querySelector('textarea.sof-note-input');
            if (!textarea) return;
            
            const note = textarea.value.trim();
            const fundIdx = textarea.dataset.fundIdx;
            const fundType = textarea.dataset.fundType;
            
            // Get verification checkboxes WITHIN THIS FUNDING CARD ONLY
            const checkboxes = card.querySelectorAll('.verification-checks input[type="checkbox"]:checked');
            const verified = [];
            checkboxes.forEach(cb => {
                verified.push(cb.value);
            });
            
            // Get transaction markers WITHIN THIS FUNDING CARD ONLY
            const transactionMarkers = {};
            const markerButtons = card.querySelectorAll('.tx-marker-btn.active');
            markerButtons.forEach(btn => {
                const txId = btn.dataset.txId;
                const marker = btn.dataset.marker; // 'verified', 'rejected', 'review'
                if (txId) {
                    transactionMarkers[txId] = marker;
                }
            });
            
            // Get red flag status and notes for this funding method
            const redFlags = [];
            const redFlagSelects = card.querySelectorAll(`.red-flag-status-select[data-fund-idx="${fundIdx}"]`);
            redFlagSelects.forEach(select => {
                const flagIdx = select.dataset.flagIdx;
                const status = select.value;
                const noteTextarea = card.querySelector(`.red-flag-note-input[data-fund-idx="${fundIdx}"][data-flag-idx="${flagIdx}"]`);
                const flagNote = noteTextarea ? noteTextarea.value.trim() : '';
                
                if (status || flagNote) {
                    redFlags.push({
                        flagIdx: flagIdx,
                        status: status,
                        note: flagNote
                    });
                }
            });
            
            // Only add if there's a note, verification, transaction markers, or red flag annotations
            if (note || verified.length > 0 || Object.keys(transactionMarkers).length > 0 || redFlags.length > 0) {
                investigation.fundingMethods.push({
                    fundIdx: fundIdx,
                    fundType: fundType,
                    note: note,
                    verified: verified,
                    transactionMarkers: transactionMarkers,
                    redFlags: redFlags
                });
            }
        });
        
        // Collect chain flags and notes
        const chainCards = form.querySelectorAll('.sof-chain-card');
        chainCards.forEach(card => {
            const activeBtn = card.querySelector('.tx-flag-btn.active[data-chain-idx]');
            const noteTextarea = card.querySelector('textarea.chain-note-input');
            
            if (activeBtn || (noteTextarea && noteTextarea.value.trim())) {
                const chainIdx = activeBtn ? activeBtn.dataset.chainIdx : noteTextarea.dataset.chainIdx;
                const flag = activeBtn ? activeBtn.dataset.flag : '';
                const note = noteTextarea ? noteTextarea.value.trim() : '';
                
                if (flag || note) {
                    investigation.chains.push({
                        chainIdx: chainIdx,
                        flag: flag,
                        note: note
                    });
                }
            }
        });
        
        // Collect large transaction flags and notes
        const largeTxCards = form.querySelectorAll('.sof-tx-card');
        largeTxCards.forEach(card => {
            const activeBtn = card.querySelector('.tx-flag-btn.active[data-large-tx-idx]');
            const noteTextarea = card.querySelector('textarea.large-tx-note');
            
            if (activeBtn || (noteTextarea && noteTextarea.value.trim())) {
                const largeTxIdx = activeBtn ? activeBtn.dataset.largeTxIdx : noteTextarea.dataset.largeTxIdx;
                const txId = activeBtn ? activeBtn.dataset.txId : noteTextarea.dataset.txId;
                const flag = activeBtn ? activeBtn.dataset.flag : '';
                const note = noteTextarea ? noteTextarea.value.trim() : '';
                
                if (flag || note) {
                    // Add to transactions array with a special type marker
                    investigation.transactions.push({
                        txId: txId,
                        largeTxIdx: largeTxIdx,
                        type: 'large-oneoff',
                        flag: flag,
                        note: note
                    });
                }
            }
        });
        
        // Collect transaction notes and markers
        const txNotes = form.querySelectorAll('textarea.tx-note-input');
        txNotes.forEach(textarea => {
            const note = textarea.value.trim();
            const txIdx = textarea.dataset.txIdx;
            const txId = textarea.dataset.txId;
            
            if (note) {
                investigation.transactions.push({
                    txIdx: txIdx,
                    txId: txId,
                    note: note
                });
            }
        });
        
        // Collect Bank Analysis item flags and notes (repeating groups, chains, transactions)
        if (!investigation.bankAnalysisItems) {
            investigation.bankAnalysisItems = [];
        }
        
        // Track processed items to avoid duplicates
        const processedItems = new Set();
        
        // Process all analysis items (find by parent containers)
        const analysisContainers = form.querySelectorAll('[data-group-index], [data-chain-id], .transaction-row-wrapper[data-tx-id]');
        analysisContainers.forEach(itemElement => {
            let itemType, itemKey;
            
            if (itemElement.hasAttribute('data-group-index')) {
                itemType = 'repeating-group';
                itemKey = itemElement.getAttribute('data-group-index');
            } else if (itemElement.hasAttribute('data-chain-id')) {
                itemType = 'chain';
                itemKey = itemElement.getAttribute('data-chain-id');
            } else if (itemElement.hasAttribute('data-tx-id')) {
                itemType = 'transaction';
                itemKey = itemElement.getAttribute('data-tx-id');
            } else {
                return; // Skip if no identifier
            }
            
            // Create unique key to avoid duplicates
            const uniqueKey = `${itemType}:${itemKey}`;
            if (processedItems.has(uniqueKey)) return;
            processedItems.add(uniqueKey);
            
            // Get active flag button (excluding link-funding button)
            const activeBtn = itemElement.querySelector('.tx-flag-btn-square.active:not(.link-funding)');
            const flag = activeBtn ? activeBtn.dataset.flag : '';
            
            // Get note
            const noteTextarea = itemElement.querySelector('textarea.analysis-item-note-input');
            const note = noteTextarea ? noteTextarea.value.trim() : '';
            
            // Get linked funding method - ONLY if the link dropdown is visible
            const fundingLinkContainer = itemElement.querySelector('.analysis-item-funding-link');
            const fundingSelect = itemElement.querySelector('.analysis-item-funding-select');
            let linkedFundIdx = '';
            
            // Only get the value if the dropdown is visible (user clicked link button)
            if (fundingLinkContainer && !fundingLinkContainer.classList.contains('hidden') && fundingSelect && fundingSelect.value) {
                linkedFundIdx = fundingSelect.value;
            }
            
            // Only save if there's a flag, note, or linked funding
            if (flag || note || linkedFundIdx) {
                const item = {
                    type: itemType,
                    flag: flag,
                    comment: note
                };
                
                if (itemType === 'repeating-group') {
                    item.groupIndex = parseInt(itemKey);
                } else if (itemType === 'chain') {
                    item.chainId = itemKey;
                } else if (itemType === 'transaction') {
                    item.transactionId = itemKey;
                }
                
                // Only add linkedToFundIdx if actually selected AND visible
                if (linkedFundIdx) {
                    item.linkedToFundIdx = linkedFundIdx;
                }
                
                investigation.bankAnalysisItems.push(item);
            }
        });
        
        // Check if any data was collected
        const hasData = investigation.property ||
                       investigation.fundingMethods.length > 0 || 
                       investigation.accounts.length > 0 ||
                       investigation.transactions.length > 0 ||
                       investigation.chains.length > 0 ||
                       investigation.bankAnalysisItems?.length > 0;
        
        if (!hasData) {
            alert('Please add at least one note, verification, or review');
            return;
        }
        
        // Send to parent
        this.sendMessage('save-sof-annotations', {
            checkId: check.checkId || check.transactionId,
            notes: investigation
        });
        
        // Store context for success handler
        this.pendingSave = {
            type: 'sof',
            check: check
        };
    }
    
    toggleTransactionExpand(button) {
        // Toggle the button active state
        button.classList.toggle('active');
        
        // Get the parent transaction row and expand section
        const txRow = button.closest('.transaction-investigation-row');
        const expandSection = txRow.querySelector('.tx-expand-section');
        const noteField = expandSection.querySelector('.tx-note-field');
        
        // Show expand section if any button is active
        const anyActive = txRow.querySelector('.tx-flag-btn-square.active');
        if (anyActive) {
            expandSection.classList.remove('collapsed');
        } else {
            expandSection.classList.add('collapsed');
        }
    }
    
    toggleTransactionLinking(button) {
        // Toggle the button active state
        button.classList.toggle('active');
        
        // Get the parent transaction row and expand section
        const txRow = button.closest('.transaction-investigation-row');
        const expandSection = txRow.querySelector('.tx-expand-section');
        const sofLinking = expandSection.querySelector('.tx-sof-linking');
        
        // Always show expand section when blue + is clicked
        expandSection.classList.remove('collapsed');
        
        // Toggle the SOF linking dropdown
        if (button.classList.contains('active')) {
            sofLinking.classList.remove('hidden');
        } else {
            sofLinking.classList.add('hidden');
        }
    }
    
    closeSofOverlay() {
        const overlay = document.getElementById('sofOverlay');
        if (overlay) overlay.remove();
    }
    
    toggleAccountCard(event, accountId) {
        event.stopPropagation();
        const card = document.querySelector(`[data-account-card="${accountId}"]`);
        if (card) {
            card.classList.toggle('collapsed');
        }
    }
    
    toggleFundingCard(event, fundIdx) {
        event.stopPropagation();
        const card = document.querySelector(`[data-funding-card="${fundIdx}"]`);
        if (card) {
            card.classList.toggle('collapsed');
        }
    }
    
    toggleAnnotationCard(event, annIdx) {
        event.stopPropagation();
        const card = document.querySelector(`[data-annotation-idx="${annIdx}"]`);
        if (card) {
            card.classList.toggle('collapsed');
        }
    }
    
    showTransactionDetailsOverlay(txId, check) {
        // Find the transaction across all accounts
        const taskOutcomes = check.taskOutcomes || {};
        const bankStatement = taskOutcomes['bank:statement'];
        const bankSummary = taskOutcomes['bank:summary'];
        const docsBankStatement = taskOutcomes['documents:bank-statement'];
        
        const accounts = bankStatement?.breakdown?.accounts || 
                        bankSummary?.breakdown?.accounts || 
                        docsBankStatement?.breakdown?.accounts || {};
        
        let transaction = null;
        let accountInfo = null;
        
        for (const [accountId, accountData] of Object.entries(accounts)) {
            const statement = accountData.statement || [];
            transaction = statement.find(t => t.id === txId);
            if (transaction) {
                accountInfo = accountData.info || accountData;
                break;
            }
        }
        
        if (!transaction) {
            console.error('Transaction not found:', txId);
            return;
        }
        
        // Collect all annotations for this transaction
        const sofAnnotations = check.sofAnnotations || [];
        const txAnnotations = [];
        
        sofAnnotations.forEach(ann => {
            // Check direct transaction annotations
            const transactions = ann.notes?.transactions || [];
            const txAnn = transactions.find(t => t.txId === txId);
            if (txAnn) {
                txAnnotations.push({
                    ...txAnn,
                    user: ann.userName || ann.user,
                    timestamp: ann.timestamp
                });
                return; // Already found this transaction, no need to check other sources
            }
            
            // Check if transaction is linked via funding method transaction markers
            const fundingMethods = ann.notes?.fundingMethods || [];
            for (const fm of fundingMethods) {
                const transactionMarkers = fm.transactionMarkers || {};
                if (transactionMarkers[txId]) {
                    // This transaction was marked for this funding method
                    const marker = transactionMarkers[txId]; // 'accepted' or 'rejected'
                    const flag = marker === 'accepted' ? 'linked' : 'review';
                    
                    txAnnotations.push({
                        txId: txId,
                        flag: flag,
                        linkedToFunds: [fm.fundIdx],
                        note: marker === 'accepted' ? 'Linked via funding method' : 'Marked for review',
                        user: ann.userName || ann.user,
                        timestamp: ann.timestamp
                    });
                    return; // Found it, stop checking
                }
            }
            
            // Check if transaction is part of a bank analysis item (repeating group or chain) that's linked
            const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
            for (const item of bankAnalysisItems) {
                let isPartOfItem = false;
                
                if (item.type === 'transaction' && item.transactionId === txId) {
                    isPartOfItem = true;
                } else if (item.type === 'chain') {
                    // Check if this transaction is part of the chain
                    const chainIds = (item.chainId || '').split('|');
                    if (chainIds.includes(txId)) {
                        isPartOfItem = true;
                    }
                }
                
                if (isPartOfItem && item.linkedToFundIdx) {
                    // This transaction is part of an analysis item linked to a funding method
                    txAnnotations.push({
                        txId: txId,
                        flag: item.flag || 'linked',
                        linkedToFunds: [item.linkedToFundIdx],
                        note: item.comment || 'Linked via bank analysis',
                        user: ann.userName || ann.user,
                        timestamp: ann.timestamp
                    });
                    return; // Found it
                }
            }
        });
        
        // Build overlay HTML
        const date = new Date(transaction.timestamp).toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            weekday: 'short'
        });
        const time = new Date(transaction.timestamp).toLocaleTimeString('en-GB', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        const amount = transaction.amount;
        const amountClass = amount >= 0 ? 'positive' : 'negative';
        const sign = amount >= 0 ? '+' : '';
        const currencySymbol = this.getCurrencyFlag(transaction.currency || 'GBP');
        
        let overlayHTML = '<div class="annotation-overlay transaction-details-overlay" id="transactionDetailsOverlay">';
        overlayHTML += '<div class="annotation-overlay-backdrop" onclick="manager.closeTransactionDetailsOverlay()"></div>';
        overlayHTML += '<div class="annotation-overlay-content" style="max-width: 700px;">';
        
        // Header
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Transaction Details</h2>';
        overlayHTML += '<button class="overlay-close-btn" onclick="manager.closeTransactionDetailsOverlay()">✕</button>';
        overlayHTML += '</div>';
        
        overlayHTML += '<div class="annotation-overlay-body">';
        
        // Transaction Info Card
        overlayHTML += '<div class="tx-details-card">';
        overlayHTML += '<div class="tx-details-main">';
        overlayHTML += `<div class="tx-details-desc">${transaction.description || transaction.merchant_name || 'Transaction'}</div>`;
        overlayHTML += `<div class="tx-details-amount ${amountClass}">${sign}${currencySymbol}${Math.abs(amount).toFixed(2)}</div>`;
        overlayHTML += '</div>';
        overlayHTML += '<div class="tx-details-meta">';
        overlayHTML += `<div class="tx-meta-item"><strong>Date:</strong> ${date} at ${time}</div>`;
        overlayHTML += `<div class="tx-meta-item"><strong>Account:</strong> ${accountInfo.name || 'Account'}</div>`;
        if (accountInfo.provider?.name) {
            overlayHTML += `<div class="tx-meta-item"><strong>Bank:</strong> ${accountInfo.provider.name}</div>`;
        }
        overlayHTML += '</div>';
        overlayHTML += '</div>';
        
        // Annotations History
        if (txAnnotations.length > 0) {
            overlayHTML += '<div class="tx-annotations-section">';
            overlayHTML += '<h3>Investigation History</h3>';
            
            txAnnotations.forEach(ann => {
                const annDate = new Date(ann.timestamp).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                overlayHTML += '<div class="tx-annotation-card">';
                overlayHTML += '<div class="tx-annotation-header">';
                overlayHTML += `<strong>${ann.user}</strong> • ${annDate}`;
                overlayHTML += '</div>';
                
                // Flag status
                if (ann.flag) {
                    let flagIcon = '';
                    let flagLabel = '';
                    if (ann.flag === 'linked' || ann.flag === 'accepted') {
                        flagIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>';
                        flagLabel = ann.flag === 'accepted' ? 'Accepted' : 'Linked';
                    } else if (ann.flag === 'suspicious' || ann.flag === 'rejected') {
                        flagIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>';
                        flagLabel = ann.flag === 'rejected' ? 'Rejected' : 'Suspicious';
                    } else if (ann.flag === 'review') {
                        flagIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>';
                        flagLabel = 'Under Review';
                    } else if (ann.flag === 'cleared') {
                        flagIcon = '<svg class="inline-status-icon" viewBox="0 0 300 300" style="width: 16px; height: 16px;"><path fill="#1976d2" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><circle cx="150" cy="150" r="50" fill="none" stroke="#ffffff" stroke-width="20"/></svg>';
                        flagLabel = 'Cleared';
                    }
                    overlayHTML += `<div class="tx-annotation-flag">${flagIcon} <strong>Status:</strong> ${flagLabel}</div>`;
                }
                
                // Linked funding methods
                if (ann.linkedToFunds && ann.linkedToFunds.length > 0) {
                    const sofTask = taskOutcomes['sof:v1'];
                    const funds = sofTask?.breakdown?.funds || [];
                    const linkedFunds = ann.linkedToFunds.map(fundIdxStr => {
                        const fund = funds[parseInt(fundIdxStr)];
                        if (fund) {
                            const fundType = fund.type || '';
                            const fundAmount = fund.data?.amount ? `£${(fund.data.amount / 100).toLocaleString()}` : '';
                            const fundLabel = fundType.replace('fund:', '').replace(/[-:_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return `${fundLabel} ${fundAmount}`;
                        }
                        return null;
                    }).filter(f => f);
                    
                    if (linkedFunds.length > 0) {
                        overlayHTML += '<div class="tx-annotation-links">';
                        overlayHTML += '<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 4px;"><path fill="#1976d2" d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>';
                        overlayHTML += `<strong>Linked to:</strong> ${linkedFunds.join(', ')}`;
                        overlayHTML += '</div>';
                    }
                }
                
                // Note
                if (ann.note) {
                    overlayHTML += '<div class="tx-annotation-note">';
                    overlayHTML += '<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin-right: 4px;"><path fill="#666" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>';
                    overlayHTML += `<span>${ann.note}</span>`;
                    overlayHTML += '</div>';
                }
                
                overlayHTML += '</div>';
            });
            
            overlayHTML += '</div>';
        } else {
            overlayHTML += '<div class="no-annotations-message">';
            overlayHTML += '<p style="color: #666; font-style: italic;">No investigation notes or flags for this transaction yet.</p>';
            overlayHTML += '</div>';
        }
        
        overlayHTML += '</div></div></div>';
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
    }
    
    closeTransactionDetailsOverlay() {
        const overlay = document.getElementById('transactionDetailsOverlay');
        if (overlay) overlay.remove();
    }
    
    /**
     * Render PEP Dismissal Overlay with queue system
     */
    renderPepDismissalOverlay(check) {
        const outcomes = check.taskOutcomes || {};
        
        // Check if we have monitoring updates - use most recent update's reportJson
        const pepUpdates = check.pepSanctionsUpdates || [];
        let mostRecentUpdate = null;
        let reportId = null;
        let breakdown = null;
        
        if (pepUpdates.length > 0) {
            // Get most recent update (already sorted, most recent is last)
            mostRecentUpdate = pepUpdates[pepUpdates.length - 1];
            const reportJson = mostRecentUpdate.reportJson || {};
            breakdown = reportJson.breakdown || {};
            reportId = mostRecentUpdate.reportId || reportJson.id;
        }
        
        // Support multiple structures for PEP/sanctions data
        // Individual checks: 'peps', 'screening:lite', 'screening' (renamed from peps), 'sanctions'
        // Company checks: 'company:peps', 'company:sanctions'
        // Note: renderTasksSection renames 'peps' to 'screening' for individual checks
        const pepsTask = outcomes['peps'];
        const screeningLiteTask = outcomes['screening:lite'];
        const screeningTask = outcomes['screening']; // Could be renamed from 'peps' or 'screening:lite'
        const sanctionsTask = outcomes['sanctions'];
        const companyPepsTask = outcomes['company:peps'];
        const companySanctionsTask = outcomes['company:sanctions'];
        
        const existingDismissals = check.pepDismissals || [];
        
        // Initialize pending dismissals array
        if (!this.pendingDismissals) {
            this.pendingDismissals = [];
        }
        
        const dismissedIds = new Set(existingDismissals.map(d => d.hitId));
        
        // Also exclude hits in pending dismissals
        this.pendingDismissals.forEach(dismissal => {
            dismissal.hits.forEach(hit => dismissedIds.add(hit.id));
        });
        
        // Collect all undismissed hits with full details
        const hits = [];
        
        // If we have a monitoring update, use its breakdown instead of original task outcomes
        if (breakdown && breakdown.hits && breakdown.hits.length > 0) {
            // Use hits from the most recent monitoring update
            breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    // Determine hit type from flag_types
                    let hitType = 'peps';
                    if (hit.flag_types && hit.flag_types.some(f => f.includes('sanction'))) {
                        hitType = 'sanctions';
                    }
                    
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: hitType,
                        entityType: 'individual',
                        reportId: reportId,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        } else {
            // Fall back to original task outcomes if no monitoring updates
            
            // Individual PEPs (from 'peps' task - electronic-id checks like Nigel Farage)
        if (pepsTask?.breakdown?.hits) {
            pepsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'peps',
                        entityType: 'individual',
                        reportId: pepsTask.id,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        
        // Screening:lite PEPs (from 'screening:lite' task - lite-screen checks like Nigel Farage)
        if (screeningLiteTask?.breakdown?.hits) {
            screeningLiteTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'peps',
                        entityType: 'individual',
                        reportId: screeningLiteTask.id,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        
        // Screening (renamed from 'peps' or 'screening:lite' - for checks like Jacob's lite-screen)
        // Only process if not already handled by screeningLiteTask or pepsTask
        if (screeningTask?.breakdown?.hits && !screeningLiteTask && !pepsTask) {
            screeningTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'peps',
                        entityType: 'individual',
                        reportId: screeningTask.id,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        
        // Individual Sanctions
        if (sanctionsTask?.breakdown?.hits) {
            sanctionsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'sanctions',
                        entityType: 'individual',
                        reportId: sanctionsTask.id,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        
        // Company PEPs (KYB checks)
        if (companyPepsTask?.breakdown?.hits) {
            companyPepsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'peps',
                        entityType: 'company',
                        reportId: companyPepsTask.id,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        
        // Company Sanctions (KYB checks)
        if (companySanctionsTask?.breakdown?.hits) {
            companySanctionsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'sanctions',
                        entityType: 'company',
                        reportId: companySanctionsTask.id,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit
                    });
                }
            });
        }
        } // End of else block for fallback to original task outcomes
        
        // Store reportId for use in savePendingDismissals
        this.currentDismissalReportId = reportId || pepsTask?.id || screeningTask?.id || sanctionsTask?.id || companyPepsTask?.id || companySanctionsTask?.id;
        
        let overlayHTML = '<div class="annotation-overlay" id="pepOverlay">';
        overlayHTML += '<div class="annotation-overlay-backdrop" onclick="manager.closePepOverlay()"></div>';
        overlayHTML += '<div class="annotation-overlay-content">';
        
        // Header with SAVE and EXPORT PDF buttons
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Dismiss PEP & Sanctions Hits</h2>';
        overlayHTML += '<div class="header-actions">';
        overlayHTML += '<button class="btn-secondary-small" onclick="manager.generatePepDismissalsPDF()">EXPORT PDF</button>';
        if (this.mode === 'edit') {
            overlayHTML += '<button class="btn-primary-small" onclick="manager.savePendingDismissals()" id="saveDismissalsBtn" disabled>SAVE</button>';
        }
        overlayHTML += '<button class="overlay-close-btn" onclick="manager.closePepOverlay()">✕</button>';
        overlayHTML += '</div></div>';
        
        overlayHTML += '<div class="annotation-overlay-body">';
        
        // Dismissals queue section
        overlayHTML += '<div class="updates-queue-section">';
        overlayHTML += '<h3>Dismissals to add</h3>';
        overlayHTML += '<div id="dismissalsQueue" class="updates-queue">';
        if (this.pendingDismissals.length === 0) {
            overlayHTML += '<p class="text-muted">No dismissals queued. Select hits below and add a dismissal reason.</p>';
        }
        overlayHTML += '</div></div>';
        
        // Add Dismissal section
        if (this.mode === 'edit' && hits.length > 0) {
            overlayHTML += '<div class="add-update-section">';
            overlayHTML += '<h3>Add Dismissal</h3>';
            
            // Show each hit as a detailed card (like screening task card)
            overlayHTML += '<div class="pep-hits-list">';
            
            hits.forEach(hit => {
                overlayHTML += this.createPepHitCard(hit);
            });
            
            overlayHTML += '</div>';
            
            // Dismissal reason textarea
            overlayHTML += '<div class="form-group">';
            overlayHTML += '<label for="pepDismissalReason">Dismissal Reason</label>';
            overlayHTML += '<textarea id="pepDismissalReason" rows="3" placeholder="Explain why selected hits should be dismissed (e.g., \'Confirmed different person - different DOB\', \'Different spelling of name\')..."></textarea>';
            overlayHTML += '</div>';
            
            // Add dismissal button
            overlayHTML += '<button type="button" class="btn-add-update" onclick="manager.addDismissalToQueue()">Add dismissal</button>';
            
            overlayHTML += '</div>';
        } else if (hits.length === 0 && this.mode === 'edit') {
            overlayHTML += '<div class="add-update-section">';
            overlayHTML += '<p class="text-muted">All hits have been dismissed.</p>';
            overlayHTML += '</div>';
        }
        
        // Show previously dismissed hits from database
        if (existingDismissals.length > 0) {
            overlayHTML += '<div class="annotation-history-section">';
            overlayHTML += '<h3>Previously Dismissed</h3>';
            
            // Group dismissals by user + timestamp + reason
            const dismissalGroups = {};
            existingDismissals.forEach(dismissal => {
                const groupKey = `${dismissal.user}_${dismissal.timestamp}_${dismissal.reason}`;
                if (!dismissalGroups[groupKey]) {
                    dismissalGroups[groupKey] = {
                        user: dismissal.userName || dismissal.user,
                        timestamp: dismissal.timestamp,
                        reason: dismissal.reason,
                        reportType: dismissal.reportType,
                        hits: []
                    };
                }
                dismissalGroups[groupKey].hits.push(dismissal.hitName);
            });
            
            // Render each group
            Object.values(dismissalGroups).forEach(group => {
                const dateObj = new Date(group.timestamp);
                const formattedDate = dateObj.toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                // Format user name
                const formattedUser = group.user
                    .split(/[-._@]/)
                    .slice(0, -1)
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
                    .join(' ');
                
                overlayHTML += '<div class="annotation-card dismissed-hit">';
                overlayHTML += '<div class="annotation-card-header">';
                overlayHTML += '<div class="annotation-header-main">';
                overlayHTML += '<span class="annotation-user">' + formattedUser + '</span>';
                overlayHTML += '<span class="annotation-date">' + formattedDate + ' at ' + formattedTime + '</span>';
                overlayHTML += '</div>';
                overlayHTML += '</div>';
                overlayHTML += '<div class="annotation-card-body">';
                overlayHTML += '<div class="dismissal-reason-box">' + group.reason + '</div>';
                overlayHTML += '<div class="dismissed-hits-list">';
                group.hits.forEach(hitName => {
                    overlayHTML += `
                        <div class="dismissed-hit-item">
                            <svg viewBox="0 0 300 300" style="width: 14px; height: 14px; margin-right: 6px;"><path fill="#388e3c" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>
                            <span>${hitName}</span>
                        </div>
                    `;
                });
                overlayHTML += '</div>';
                overlayHTML += '</div></div>';
            });
            
            overlayHTML += '</div>';
        }
        
        overlayHTML += '</div></div></div>';
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        
        // Render any pending dismissals
        this.renderPendingDismissals();
    }
    
    /**
     * Create a PEP hit card for selection (compact layout with checkbox on left)
     */
    createPepHitCard(hit) {
        let html = '<div class="pep-hit-card">';
        
        // Checkbox on the left
        html += '<input type="checkbox" name="hits" value="' + hit.id + '" ';
        html += 'data-name="' + hit.name + '" ';
        html += 'data-type="' + hit.type + '" ';
        html += 'data-report-id="' + hit.reportId + '" class="hit-checkbox-left">';
        
        html += '<div class="pep-hit-content">';
        
        // Header: Name + all badges on one line
        html += '<div class="pep-hit-header">';
        html += '<strong class="pep-hit-name">' + hit.name + '</strong>';
        
        // All badges inline - organize by type
        const pepBadges = [];
        const sanctionBadges = [];
        const adverseBadges = [];
        
        if (hit.flagTypes && hit.flagTypes.length > 0) {
            const uniqueFlags = [...new Set(hit.flagTypes)];
            uniqueFlags.forEach(flag => {
                let badgeText = flag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                if (flag.includes('pep')) {
                    if (flag.includes('class-1')) badgeText = 'PEP Class 1';
                    else if (flag.includes('class-2')) badgeText = 'PEP Class 2';
                    else if (flag.includes('class-3')) badgeText = 'PEP Class 3';
                    else if (flag.includes('class-4')) badgeText = 'PEP Class 4';
                    else if (flag === 'pep') badgeText = 'PEP';
                    pepBadges.push(badgeText);
                } else if (flag.includes('sanction')) {
                    sanctionBadges.push(badgeText);
                } else if (flag.includes('adverse-media')) {
                    adverseBadges.push(badgeText);
                }
            });
        }
        
        html += '<div class="pep-badges-inline">';
        
        // PEP badges (purple) - first 3
        pepBadges.slice(0, 3).forEach(badge => {
            html += '<span class="hit-badge hit-badge-pep">' + badge + '</span>';
        });
        if (pepBadges.length > 3) {
            html += '<span class="hit-badge hit-badge-pep">+' + (pepBadges.length - 3) + '</span>';
        }
        
        // Sanctions badges (red) - first 3
        sanctionBadges.slice(0, 3).forEach(badge => {
            html += '<span class="hit-badge hit-badge-sanction">' + badge + '</span>';
        });
        if (sanctionBadges.length > 3) {
            html += '<span class="hit-badge hit-badge-sanction">+' + (sanctionBadges.length - 3) + '</span>';
        }
        
        // Adverse Media badges (blue) - first 3
        adverseBadges.slice(0, 3).forEach(badge => {
            html += '<span class="hit-badge hit-badge-adverse">' + badge + '</span>';
        });
        if (adverseBadges.length > 3) {
            html += '<span class="hit-badge hit-badge-adverse">+' + (adverseBadges.length - 3) + '</span>';
        }
        
        html += '</div></div>'; // Close badges and header
        
        // AKA (full width if present)
        if (hit.aka && hit.aka.length > 0) {
            const akaList = hit.aka.slice(0, 5).join(', ');
            const extra = hit.aka.length > 5 ? ' (+' + (hit.aka.length - 5) + ' more)' : '';
            html += '<div class="pep-aka">Also Known As: ' + akaList + extra + '</div>';
        }
        
        // Two-column layout for details
        html += '<div class="pep-details-grid">';
        
        // Left column
        html += '<div class="pep-detail-item">';
        if (hit.dob) {
            html += '<span class="pep-label">Date of Birth:</span> <span class="pep-value">' + hit.dob + '</span>';
        } else {
            html += '<span class="pep-label">Date of Birth:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        // Right column
        html += '<div class="pep-detail-item">';
        if (hit.score) {
            html += '<span class="pep-label">Match Score:</span> <span class="pep-value">' + hit.score + '</span>';
        } else {
            html += '<span class="pep-label">Match Score:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        // Left column
        html += '<div class="pep-detail-item">';
        if (hit.politicalPositions && hit.politicalPositions.length > 0) {
            const pos = hit.politicalPositions[0];
            const extra = hit.politicalPositions.length > 1 ? ' (+' + (hit.politicalPositions.length - 1) + ' more)' : '';
            html += '<span class="pep-label">Position:</span> <span class="pep-value">' + pos + extra + '</span>';
        } else {
            html += '<span class="pep-label">Position:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        // Right column
        html += '<div class="pep-detail-item">';
        if (hit.fields && hit.fields.length > 0) {
            html += '<span class="pep-label">Data Sources:</span> <span class="pep-value">' + hit.fields.length + '</span>';
        } else {
            html += '<span class="pep-label">Data Sources:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        // Left column
        html += '<div class="pep-detail-item">';
        if (hit.associates && hit.associates.length > 0) {
            html += '<span class="pep-label">Associates:</span> <span class="pep-value">' + hit.associates.length + '</span>';
        } else {
            html += '<span class="pep-label">Associates:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        // Right column
        html += '<div class="pep-detail-item">';
        if (hit.media && hit.media.length > 0) {
            html += '<span class="pep-label">Media Articles:</span> <span class="pep-value">' + hit.media.length + '</span>';
        } else {
            html += '<span class="pep-label">Media Articles:</span> <span class="pep-value">—</span>';
        }
        html += '</div>';
        
        html += '</div>'; // Close grid
        
        // Countries (full width)
        if (hit.countries && hit.countries.length > 0) {
            html += '<div class="pep-countries">Countries: ';
            hit.countries.slice(0, 5).forEach(country => {
                const flagEmoji = this.getCountryFlag(country);
                html += '<span class="country-tag">' + flagEmoji + ' ' + country + '</span>';
            });
            if (hit.countries.length > 5) {
                html += '<span class="country-tag">+' + (hit.countries.length - 5) + ' more</span>';
            }
            html += '</div>';
        }
        
        html += '</div>'; // Close pep-hit-content
        html += '</div>'; // Close pep-hit-card
        
        return html;
    }
    
    /**
     * Add selected hits to dismissal queue
     */
    addDismissalToQueue() {
        const selectedHits = Array.from(document.querySelectorAll('#pepOverlay input[name="hits"]:checked'));
        const reason = document.getElementById('pepDismissalReason').value.trim();
        
        if (selectedHits.length === 0) {
            alert('Please select at least one hit to dismiss');
            return;
        }
        
        if (!reason) {
            alert('Please provide a dismissal reason');
            return;
        }
        
        // Store full hit objects (each has its own reportId)
        const hits = selectedHits.map(cb => ({
            id: cb.value,
            name: cb.dataset.name,
            type: cb.dataset.type,
            reportId: cb.dataset.reportId // Each hit may have different reportId
        }));
        
        // Create dismissal batch
        const dismissal = {
            id: Date.now(),
            hits: hits, // Store full hit objects
            reason
        };
        
        this.pendingDismissals.push(dismissal);
        
        // Clear form
        selectedHits.forEach(cb => cb.checked = false);
        document.getElementById('pepDismissalReason').value = '';
        
        // Re-render to remove dismissed hits from list (don't clear queue)
        this.closePepOverlay(false);
        this.renderPepDismissalOverlay(this.currentCheck);
        
        // Enable save button
        const saveBtn = document.getElementById('saveDismissalsBtn');
        if (saveBtn) saveBtn.disabled = false;
    }
    
    /**
     * Render pending dismissals queue
     */
    renderPendingDismissals() {
        const queueContainer = document.getElementById('dismissalsQueue');
        if (!queueContainer) return;
        
        if (this.pendingDismissals.length === 0) {
            queueContainer.innerHTML = '<p class="text-muted">No dismissals queued. Select hits below and add a dismissal reason.</p>';
            return;
        }
        
        let queueHTML = '';
        this.pendingDismissals.forEach(dismissal => {
            // Create a dismissal card
            queueHTML += '<div class="dismissal-queue-card">';
            queueHTML += '<div class="dismissal-header">';
            queueHTML += '<span>Dismissing ' + dismissal.hits.length + ' hit' + (dismissal.hits.length > 1 ? 's' : '') + '</span>';
            queueHTML += '<button class="remove-update-btn" onclick="manager.removeDismissalFromQueue(' + dismissal.id + ')" title="Remove from queue">';
            queueHTML += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">';
            queueHTML += '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
            queueHTML += '</svg></button>';
            queueHTML += '</div>';
            queueHTML += '<div class="dismissal-body">';
            queueHTML += '<p class="dismissal-reason">' + dismissal.reason + '</p>';
            queueHTML += '<div class="dismissed-hits-list">';
            dismissal.hits.forEach(hit => {
                queueHTML += '<span class="dismissed-hit-name">• ' + hit.name + '</span>';
            });
            queueHTML += '</div>';
            queueHTML += '</div></div>';
        });
        
        queueContainer.innerHTML = queueHTML;
    }
    
    /**
     * Remove dismissal from queue
     */
    removeDismissalFromQueue(dismissalId) {
        this.pendingDismissals = this.pendingDismissals.filter(d => d.id !== dismissalId);
        
        // Re-render overlay to show hits again (don't clear queue)
        this.closePepOverlay(false);
        this.renderPepDismissalOverlay(this.currentCheck);
        
        // Disable save button if queue is empty
        if (this.pendingDismissals.length === 0) {
            const saveBtn = document.getElementById('saveDismissalsBtn');
            if (saveBtn) saveBtn.disabled = true;
        }
    }
    
    /**
     * Save all pending dismissals
     */
    savePendingDismissals() {
        if (this.pendingDismissals.length === 0) {
            alert('No dismissals to save');
            return;
        }
        
        const check = this.currentCheck;
        
        // Group hits by reportId across all dismissal batches
        // A single dismissal batch with same reason might have hits from different reports
        const dismissalsByReport = {};
        
        this.pendingDismissals.forEach(dismissalBatch => {
            dismissalBatch.hits.forEach(hit => {
                const reportId = hit.reportId;
                
                // Create entry for this reportId if it doesn't exist
                if (!dismissalsByReport[reportId]) {
                    dismissalsByReport[reportId] = {
                        reportId: reportId,
                        reportType: hit.type, // 'peps', 'sanctions', etc.
                        dismissals: []
                    };
                }
                
                // Find existing dismissal batch with same reason
                let existingBatch = dismissalsByReport[reportId].dismissals.find(
                    d => d.reason === dismissalBatch.reason
                );
                
                if (!existingBatch) {
                    existingBatch = {
                        reason: dismissalBatch.reason,
                        hits: []
                    };
                    dismissalsByReport[reportId].dismissals.push(existingBatch);
                }
                
                // Add hit to this batch
                existingBatch.hits.push({
                    id: hit.id,
                    name: hit.name,
                    type: hit.type
                });
            });
        });
        
        // Flatten structure for backend - array of dismissal batches with reportId
        const dismissals = [];
        Object.values(dismissalsByReport).forEach(report => {
            report.dismissals.forEach(batch => {
                dismissals.push({
                    reportId: report.reportId,
                    reportType: report.reportType,
                    hits: batch.hits,
                    reason: batch.reason
                });
            });
        });
        
        console.log('📤 Sending dismissals to backend:', dismissals);
        
        // Send single message to parent with all dismissals
        this.sendMessage('dismiss-pep-hits', {
            checkId: check.checkId || check.transactionId,
            dismissals
        });
        
        // Store context for success handler
        this.pendingSave = {
            type: 'pep-dismissal',
            check: check,
            dismissals
        };
        
        // Clear pending dismissals
        this.pendingDismissals = [];
    }
    
    closePepOverlay(clearQueue = true) {
        const overlay = document.getElementById('pepOverlay');
        if (overlay) overlay.remove();
        // Clear pending dismissals when closing (unless we're just re-rendering)
        if (clearQueue) {
            this.pendingDismissals = [];
        }
    }
    
    /**
     * Close all overlays (used when loading new checks data)
     */
    closeAllOverlays() {
        // Close consider overlay
        const considerOverlay = document.getElementById('considerOverlay');
        if (considerOverlay) {
            considerOverlay.remove();
            this.pendingUpdates = [];
        }
        
        // Close SoF overlay
        const sofOverlay = document.getElementById('sofOverlay');
        if (sofOverlay) sofOverlay.remove();
        
        // Close PEP overlay
        const pepOverlay = document.getElementById('pepOverlay');
        if (pepOverlay) {
            pepOverlay.remove();
            this.pendingDismissals = [];
        }
    }
    
    // ===================================================================
    // PDF GENERATION
    // ===================================================================
    
    generateConsiderPDF(autoSave = false) {
        const check = this.currentCheck;
        if (!check) {
            console.error('❌ No current check for PDF generation');
            return;
        }
        
        const annotations = check.considerAnnotations || [];
        
        console.log('📄 Generating PDF with annotations:', annotations.length);
        console.log('📄 Annotations:', annotations);
        
        // If no annotations exist, there's nothing to generate
        if (annotations.length === 0) {
            console.error('❌ No annotations to generate PDF for');
            alert('No annotations found to generate PDF');
            return;
        }
        
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.thirdfortResponse?.ref || check.transactionId || check.checkId;
        const checkType = this.getElectronicIDType(check) || check.checkType || 'Thirdfort Check';
        const matterName = check.thirdfortResponse?.name || check.matterName || '—';
        const checkStatus = check.status === 'closed' ? 'Closed' : 'Open';
        const now = new Date();
        const generatedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const generatedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        // Helper to get task icon background color
        const getTaskColor = (taskType) => {
            if (taskType === 'identity') return '#5e35b1';
            if (taskType === 'address') return '#1976d2';
            if (taskType === 'screening') return '#d32f2f';
            if (taskType.includes('sof')) return '#388e3c';
            return '#666';
        };
        
        // Helper to get task label
        const getTaskLabel = (taskType) => {
            if (taskType === 'identity') return 'ID';
            if (taskType === 'address') return 'AD';
            if (taskType === 'screening') return 'SC';
            if (taskType.includes('sof')) return 'SF';
            return 'CK';
        };
        
        // Helper to get status icon CSS (PDF-friendly)
        const getStatusIcon = (status) => {
            return this.getStatusIconCSS(status);
        };
        
        // Get unique task types that have annotations
        const annotatedTaskTypes = [...new Set(annotations.map(ann => ann.taskType))];
        
        // Build original task outcomes HTML (for tasks with annotations)
        let taskOutcomesHTML = '';
        annotatedTaskTypes.forEach(taskType => {
            const outcome = check.taskOutcomes?.[taskType];
            if (!outcome) return;
            
            const taskTitle = this.getTaskTitle(taskType);
            const taskColor = getTaskColor(taskType);
            const taskLabel = getTaskLabel(taskType);
            const checks = this.getTaskChecks(taskType, outcome, check);
            
            taskOutcomesHTML += `
                <div class="task-outcomes-card" style="margin-bottom: 20px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 6px; padding: 15px; page-break-inside: avoid;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #dee2e6;">
                        <div class="task-icon" style="background: ${taskColor}; flex-shrink: 0;">${taskLabel}</div>
                        <div style="font-size: 16px; font-weight: bold; color: #003c71;">${taskTitle}</div>
                    </div>
            `;
            
            // Show check items (objectives)
            checks.forEach(checkItem => {
                if (checkItem.isNestedCard || checkItem.isPersonCard || checkItem.isHitCard) return;
                
                const checkIcon = this.getTaskCheckIconCSS(checkItem.status);
                const statusColor = checkItem.status === 'CL' ? '#388e3c' : (checkItem.status === 'FA' ? '#d32f2f' : '#f7931e');
                
                taskOutcomesHTML += `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 6px 0; ${checkItem.indented ? 'margin-left: 30px;' : ''}">
                        ${checkIcon}
                        <span style="font-size: 12px; color: #333;">${checkItem.text}</span>
                    </div>
                `;
            });
            
            taskOutcomesHTML += `</div>`;
        });
        
        // Group annotations by user + timestamp + newStatus (like in task card display)
        const groups = {};
        annotations.forEach(ann => {
            const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    user: ann.userName || ann.user,
                    timestamp: ann.timestamp,
                    newStatus: ann.newStatus,
                    reason: ann.reason,
                    objectives: []
                };
            }
            groups[groupKey].objectives.push({
                taskType: ann.taskType,
                path: ann.objectivePath,
                originalStatus: ann.originalStatus,
                newStatus: ann.newStatus
            });
        });
        
        // Build annotation cards HTML (one card per group)
        let annotationsHTML = '';
        Object.values(groups).forEach(group => {
            const date = new Date(group.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const time = new Date(group.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            
            const newStatusClass = group.newStatus === 'clear' ? 'clear' : (group.newStatus === 'fail' ? 'fail' : 'consider');
            
            annotationsHTML += `
                <div class="annotation-card">
                    <div class="annotation-header">
                        <div class="annotation-task-info">
                            <div class="annotation-task-title">Update by ${group.user}</div>
                            <div class="annotation-objective">${date}, ${time}</div>
                        </div>
                    </div>
                    
                    <div class="reason-box">
                        <div class="reason-label">Reason</div>
                        <div class="reason-text">${group.reason}</div>
                    </div>
                    
                    <div class="status-change" style="display: block;">
                        <div class="reason-label" style="margin-bottom: 8px;">Affected Objectives</div>
            `;
            
            // Show all affected objectives with their status icons
            group.objectives.forEach(obj => {
                const taskTitle = this.getTaskTitle(obj.taskType);
                const objectivePath = this.formatObjectivePath(obj.path);
                const taskColor = getTaskColor(obj.taskType);
                const taskLabel = getTaskLabel(obj.taskType);
                
                annotationsHTML += `
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; min-width: 0;">
                        <div class="task-icon" style="background: ${taskColor}; flex-shrink: 0;">${taskLabel}</div>
                        <div style="flex: 1; min-width: 0; overflow: hidden;">
                            <div style="font-size: 13px; font-weight: 600; color: #003c71; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${taskTitle}</div>
                            <div style="font-size: 11px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${objectivePath}</div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 12px;">
                            ${getStatusIcon(obj.newStatus)}
                            <span style="font-size: 12px; font-weight: 600; color: ${obj.newStatus === 'clear' ? '#388e3c' : (obj.newStatus === 'fail' ? '#d32f2f' : '#f7931e')}; white-space: nowrap;">${obj.newStatus.toUpperCase()}</span>
                        </div>
                    </div>
                `;
            });
            
            annotationsHTML += `
                    </div>
                </div>
            `;
        });
        
        // Build task cards HTML (matching mockup structure exactly)
        let taskCardsHTML = '';
        
        annotatedTaskTypes.forEach(taskType => {
            const outcome = check.taskOutcomes?.[taskType];
            if (!outcome) return;
            
            const taskTitle = this.getTaskTitle(taskType);
            const result = outcome.result || 'unknown';
            const borderColor = result === 'clear' ? '#39b549' : (result === 'fail' ? '#ff0000' : '#f7931e');
            
            // Get status icon CSS (PDF-friendly)
            const statusIconHTML = this.getStatusIconCSS(result);
            
            // Get task annotations for this task type (grouped)
            const taskAnnotations = annotations.filter(ann => ann.taskType === taskType);
            const taskGroups = {};
            taskAnnotations.forEach(ann => {
                const groupKey = `${ann.user}_${ann.timestamp}_${ann.newStatus}`;
                if (!taskGroups[groupKey]) taskGroups[groupKey] = [];
                taskGroups[groupKey].push(ann);
            });
            const updateCount = Object.keys(taskGroups).length;
            const latestStatus = taskAnnotations[0]?.newStatus || 'consider';
            const badgeClass = latestStatus === 'clear' ? 'badge-clear' : (latestStatus === 'fail' ? 'badge-fail' : 'badge-consider');
            const badgeColor = latestStatus === 'clear' ? '#d4edda' : (latestStatus === 'fail' ? '#f8d7da' : '#fff3cd');
            const badgeTextColor = latestStatus === 'clear' ? '#155724' : (latestStatus === 'fail' ? '#721c24' : '#856404');
            
            // Get all objectives for this task
            const checks = this.getTaskChecks(taskType, outcome, check);
            let objectivesHTML = '';
            checks.forEach(checkItem => {
                if (checkItem.isNestedCard || checkItem.isPersonCard || checkItem.isHitCard) return;
                
                const checkIconHTML = this.getTaskCheckIconCSS(checkItem.status);
                const indentStyle = (checkItem.indented || checkItem.isChildItem) ? 'padding-left: 24px;' : '';
                
                objectivesHTML += `
                    <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #333; ${indentStyle}">
                        ${checkIconHTML}
                        <span>${checkItem.text}</span>
                    </div>
                `;
            });
            
            // Build annotation mini-cards for this task
            let annotationCardsHTML = '';
            Object.values(taskGroups).forEach(groupAnnotations => {
                const ann = groupAnnotations[0];
                const date = new Date(ann.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                const time = new Date(ann.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                
                const miniStatusColor = ann.newStatus === 'clear' ? '#e8f5e9' : (ann.newStatus === 'fail' ? '#ffebee' : '#fff3e0');
                const miniStatusTextColor = ann.newStatus === 'clear' ? '#39b549' : (ann.newStatus === 'fail' ? '#d32f2f' : '#f7931e');
                const miniStatusIconHTML = getStatusIcon(ann.newStatus);
                
                annotationCardsHTML += `
                    <div style="background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); page-break-inside: avoid;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <div style="font-size: 12px; color: #666;">
                                <span style="font-weight: bold; color: #333;">${ann.userName}</span>
                                <span> • </span>
                                <span style="font-style: italic; font-size: 11px; color: #999;">${date}, ${time}</span>
                            </div>
                            <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${miniStatusColor}; color: ${miniStatusTextColor};">
                                ${miniStatusIconHTML}
                                ${ann.newStatus.charAt(0).toUpperCase() + ann.newStatus.slice(1)}
                            </span>
                        </div>
                        <div style="font-size: 13px; color: #444; line-height: 1.5;">
                            ${ann.reason}
                        </div>
                    </div>
                `;
            });
            
            taskCardsHTML += `
                <div style="background: white; border-radius: 8px; border-left: 4px solid ${borderColor}; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 12px; page-break-inside: avoid;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 14px; font-weight: 500; color: #003c71; flex: 1;">${taskTitle}</div>
                        <span style="padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: 8px; background: ${badgeColor}; color: ${badgeTextColor};">${updateCount} Update${updateCount > 1 ? 's' : ''}</span>
                        ${statusIconHTML}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px; padding: 8px 16px;">
                        ${objectivesHTML}
                    </div>
                    <div style="padding: 12px 16px;">
                        <h4 style="font-size: 13px; font-weight: bold; color: #333; margin-bottom: 12px;">Cashier Updates</h4>
                        ${annotationCardsHTML}
                    </div>
                </div>
            `;
        });
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    :root { --primary-blue: #003c71; --secondary-blue: #1d71b8; --green: #39b549; --orange: #f7931e; --red: #d32f2f; --grey: #6c757d; --light-grey: #f8f9fa; --border-grey: #dee2e6; }
                    body { font-family: 'Trebuchet MS', 'Lucida Grande', sans-serif; padding: 40px; background: white; color: #111; line-height: 1.5; font-size: 14px; }
                    .pdf-header { border-bottom: 3px solid var(--primary-blue); padding-bottom: 20px; margin-bottom: 30px; page-break-after: avoid; }
                    .pdf-title { font-size: 26px; font-weight: bold; color: var(--primary-blue); margin-bottom: 15px; }
                    .check-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px; }
                    .check-info-item { display: flex; gap: 8px; }
                    .check-info-label { font-weight: bold; color: var(--grey); min-width: 140px; }
                    .check-info-value { color: #333; }
                    .section-title { font-size: 18px; font-weight: bold; color: var(--primary-blue); margin: 30px 0 20px 0; padding-bottom: 8px; border-bottom: 2px solid var(--border-grey); page-break-after: avoid; }
                    .task-card { page-break-inside: avoid; margin-bottom: 16px; }
                    .annotation-mini-card { page-break-inside: avoid; }
                    .pdf-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--border-grey); text-align: center; font-size: 11px; color: #999; page-break-before: avoid; }
                    .objective-icon { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
                    .icon-clear { fill: var(--green); }
                    .icon-consider { fill: var(--orange); }
                    .icon-fail { fill: var(--red); }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <div class="pdf-title">Consider Annotations Report</div>
                    <div class="check-info">
                        <div class="check-info-item"><span class="check-info-label">Check Type:</span><span class="check-info-value">${checkType}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Consumer:</span><span class="check-info-value">${checkName}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check Reference:</span><span class="check-info-value">${checkRef}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check ID:</span><span class="check-info-value">${check.checkId || check.transactionId}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Matter:</span><span class="check-info-value">${matterName}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Generated:</span><span class="check-info-value">${generatedDate}, ${generatedTime}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Status:</span><span class="check-info-value">${checkStatus}</span></div>
                    </div>
                </div>
                <div class="section-title">Tasks with Annotations</div>
                ${taskCardsHTML}
                <div class="pdf-footer">
                    <p>This report was generated from Thurstan Hoskin's Thirdfort ID Management System</p>
                    <p>Report ID: ANT-${Date.now()} | Page 1 of 1</p>
                </div>
            </body>
            </html>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `cashier-updates-${checkRef}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'css', avoid: 'div[style*="page-break-inside: avoid"]' }
        };
        
        console.log('📄 Checking for html2pdf library...');
        console.log('📄 html2pdf available:', typeof html2pdf !== 'undefined');
        
        if (typeof html2pdf !== 'undefined') {
            console.log('📄 Starting PDF generation...');
            // Generate PDF as blob and open in print dialog
            html2pdf().set(opt).from(element).outputPdf('blob').then((pdfBlob) => {
                console.log('✅ PDF blob generated:', pdfBlob.size, 'bytes');
                
                // Check if Print.js is available
                if (typeof printJS !== 'undefined') {
                    console.log('📄 Opening print dialog with Print.js...');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                    
                    // Use Print.js to open print dialog with PDF
                    printJS({
                        printable: pdfUrl,
                        type: 'pdf',
                        onPrintDialogClose: () => {
                            // Clean up blob URL after print dialog closes
                            URL.revokeObjectURL(pdfUrl);
                        }
                    });
                } else {
                    // Fallback to new tab if Print.js not loaded
                    console.warn('⚠️ Print.js not loaded, opening in new tab');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                const printWindow = window.open(pdfUrl, '_blank');
                if (!printWindow) {
                    console.error('❌ Popup blocked by browser');
                    alert('PDF generated but popup was blocked. Please allow popups for this site.');
                } else {
                    // Trigger print dialogue when PDF loads
                    printWindow.addEventListener('load', () => {
                        setTimeout(() => {
                            printWindow.print();
                        }, 100);
                    });
                    }
                }
                
                // Notify parent that PDF is generated and opened (only if auto-save)
                if (autoSave) {
                    console.log('📤 Sending pdf-generated message to parent');
                    this.sendMessage('pdf-generated', { 
                        type: 'consider',
                        checkId: check.checkId || check.transactionId 
                    });
                } else {
                    console.log('ℹ️ Manual export - not sending pdf-generated message');
                }
            }).catch(err => {
                console.error('❌ Error generating PDF:', err);
                alert('Error generating PDF: ' + err.message);
                // Still notify parent even on error so data can refresh (only if auto-save)
                if (autoSave) {
                    this.sendMessage('pdf-generated', { 
                        type: 'consider',
                        error: err.message 
                    });
                }
            });
        } else {
            console.error('❌ html2pdf library not loaded');
            alert('PDF library not loaded. Please refresh the page.');
            // Notify parent so data can refresh (only if auto-save)
            if (autoSave) {
                this.sendMessage('pdf-generated', { 
                    type: 'consider',
                    error: 'html2pdf not loaded' 
                });
            }
        }
    }
    
    toggleAnalysisItemFlag(button) {
        // Handle clicking flag buttons on analysis items (groups, chains, transactions)
        const flag = button.dataset.flag;
        
        // Find the parent item element first
        const itemElement = button.closest('[data-group-index], [data-chain-id], [data-tx-id]');
        if (!itemElement) return;
        
        // Get item type and key from parent element
        let itemType, itemKey;
        if (itemElement.hasAttribute('data-group-index')) {
            itemType = 'repeating-group';
            itemKey = itemElement.getAttribute('data-group-index');
        } else if (itemElement.hasAttribute('data-chain-id')) {
            itemType = 'chain';
            itemKey = itemElement.getAttribute('data-chain-id'); // Use chainId
        } else if (itemElement.hasAttribute('data-tx-id')) {
            itemType = 'transaction';
            itemKey = itemElement.getAttribute('data-tx-id');
        }
        
        // Find all flag buttons in this item (exclude link-funding button)
        const allButtons = itemElement.querySelectorAll('.tx-flag-btn-square:not(.link-funding)');
        
        // Check if this button is already active
        const wasActive = button.classList.contains('active');
        
        // Remove active class from all flag buttons
        allButtons.forEach(btn => btn.classList.remove('active'));
        
        // Find or show note section
        const noteSection = itemElement.querySelector('.analysis-item-note-section');
        
        if (wasActive) {
            // Clicking same button again = remove flag
            if (noteSection) {
                noteSection.classList.add('hidden');
                const noteInput = noteSection.querySelector('.analysis-item-note-input');
                if (noteInput) noteInput.value = '';
            }
            
            // Remove from sofAnnotations
            this.removeAnalysisItemFlag(itemType, itemKey);
        } else {
            // Set new flag
            button.classList.add('active');
            if (noteSection) {
                noteSection.classList.remove('hidden');
            }
            
            // Save to sofAnnotations (will be saved when user types in note or when overlay closes)
            this.saveAnalysisItemFlag(itemType, itemKey, flag);
        }
    }
    
    toggleAnalysisItemLinking(button) {
        // Handle clicking the blue + button on analysis items to link to funding methods
        
        // Find the parent item element
        const itemElement = button.closest('[data-group-index], [data-chain-id], [data-tx-id]');
        if (!itemElement) return;
        
        // Toggle button active state
        button.classList.toggle('active');
        const isActive = button.classList.contains('active');
        
        // Find the funding link dropdown
        const fundingLink = itemElement.querySelector('.analysis-item-funding-link');
        
        // Toggle visibility
        if (isActive) {
            if (fundingLink) {
                fundingLink.classList.remove('hidden');
            }
        } else {
            if (fundingLink) {
                fundingLink.classList.add('hidden');
                // Clear selection
                const select = fundingLink.querySelector('.analysis-item-funding-select');
                if (select) select.value = '';
            }
        }
    }
    
    toggleTransactionMarker(button) {
        // Handle clicking transaction marker buttons (accepted, rejected, review)
        // in funding method matched transactions sections
        
        // Find parent transaction row (could be .matched-tx-row or .matched-tx-row-with-markers)
        const txRow = button.closest('.matched-tx-row, .matched-tx-row-with-markers');
        if (!txRow) return;
        
        // Find all marker buttons in this transaction
        const allMarkerButtons = txRow.querySelectorAll('.tx-marker-btn');
        
        // Check if this button is already active
        const wasActive = button.classList.contains('active');
        
        // Remove active from all marker buttons
        allMarkerButtons.forEach(btn => btn.classList.remove('active'));
        
        // If it wasn't active, make it active
        if (!wasActive) {
            button.classList.add('active');
        }
        // If it was active, we've already removed it, so clicking again deactivates
    }
    
    /**
     * Get all annotations for a specific transaction from all sources
     * Returns { flag, note, linkedFundingMethods, marker }
     */
    getTransactionAnnotations(txId, check) {
        if (!check || !txId) return { flag: '', note: '', linkedFundingMethods: [], marker: '' };
        
        const sofAnnotations = check.sofAnnotations || [];
        const result = {
            flag: '',           // From bank analysis items (suspicious, cleared, review)
            note: '',           // Combined notes from all sources
            linkedFundingMethods: [], // Array of fund indices
            marker: ''          // From funding method markers (accepted, rejected, review)
        };
        
        const notes = [];
        
        sofAnnotations.forEach(ann => {
            // 1. Check bank analysis items (flags on transactions/chains/repeating groups)
            const bankAnalysisItems = ann.notes?.bankAnalysisItems || [];
            bankAnalysisItems.forEach(item => {
                if (item.type === 'transaction' && item.transactionId === txId) {
                    if (item.flag) result.flag = item.flag;
                    if (item.comment) notes.push(item.comment);
                    if (item.linkedToFundIdx) {
                        if (!result.linkedFundingMethods.includes(item.linkedToFundIdx)) {
                            result.linkedFundingMethods.push(item.linkedToFundIdx);
                        }
                    }
                }
                // Also check if this transaction is part of a chain
                if (item.type === 'chain' && item.chainId) {
                    // Chain IDs are composite of transaction IDs separated by |
                    const chainTxIds = item.chainId.split('|');
                    if (chainTxIds.includes(txId)) {
                        // Transaction is part of this flagged chain
                        if (item.flag && !result.flag) result.flag = item.flag;
                        const formattedNote = `Chain: ${item.comment}`;
                        if (item.comment && !notes.includes(formattedNote)) notes.push(formattedNote);
                        if (item.linkedToFundIdx) {
                            if (!result.linkedFundingMethods.includes(item.linkedToFundIdx)) {
                                result.linkedFundingMethods.push(item.linkedToFundIdx);
                            }
                        }
                    }
                }
                // Also check if this transaction is part of a repeating group
                if (item.type === 'repeating-group' && item.groupIndex !== undefined) {
                    // We need to check if this transaction belongs to this repeating group
                    // by checking the bank analysis data
                    const taskOutcomes = check.taskOutcomes || {};
                    const bankStatement = taskOutcomes['bank:statement'];
                    const bankSummary = taskOutcomes['bank:summary'];
                    const docsBankStatement = taskOutcomes['documents:bank-statement'];
                    const analysis = bankStatement?.breakdown?.analysis || 
                                   bankSummary?.breakdown?.analysis || 
                                   docsBankStatement?.breakdown?.analysis;
                    
                    if (analysis && analysis.repeating_transactions) {
                        const group = analysis.repeating_transactions[item.groupIndex];
                        if (group && group.items && group.items.includes(txId)) {
                            // Transaction is part of this repeating group
                            if (item.flag && !result.flag) result.flag = item.flag;
                            const formattedNote = `Repeating: ${item.comment}`;
                            if (item.comment && !notes.includes(formattedNote)) notes.push(formattedNote);
                            if (item.linkedToFundIdx) {
                                if (!result.linkedFundingMethods.includes(item.linkedToFundIdx)) {
                                    result.linkedFundingMethods.push(item.linkedToFundIdx);
                                }
                            }
                        }
                    }
                }
            });
            
            // 2. Check linked accounts transactions (manual linking and notes)
            const transactions = ann.notes?.transactions || [];
            transactions.forEach(tx => {
                if (tx.txId === txId) {
                    if (tx.flag && !result.flag) result.flag = tx.flag;
                    if (tx.note) notes.push(tx.note);
                    if (tx.linkedToFunds && Array.isArray(tx.linkedToFunds)) {
                        tx.linkedToFunds.forEach(fundIdx => {
                            if (!result.linkedFundingMethods.includes(fundIdx)) {
                                result.linkedFundingMethods.push(fundIdx);
                            }
                        });
                    }
                }
            });
            
            // 3. Check funding method transaction markers (accepted/rejected/review)
            const fundingMethods = ann.notes?.fundingMethods || [];
            fundingMethods.forEach(fm => {
                if (fm.transactionMarkers && fm.transactionMarkers[txId]) {
                    result.marker = fm.transactionMarkers[txId];
                }
            });
        });
        
        // Combine all notes
        result.note = notes.join(' | ');
        
        return result;
    }
    
    saveAnalysisItemFlag(itemType, itemKey, flag) {
        const check = this.currentCheck;
        if (!check.sofAnnotations) {
            check.sofAnnotations = [];
        }
        
        // Get current user
        const timestamp = new Date().toISOString();
        const user = this.userEmail || 'unknown@example.com';
        const userName = user.split('@')[0];
        
        // Find or create annotation
        let annotation = check.sofAnnotations.find(ann => 
            ann.user === user && ann.timestamp && 
            (new Date().getTime() - new Date(ann.timestamp).getTime()) < 300000 // Within 5 minutes
        );
        
        if (!annotation) {
            annotation = {
                timestamp,
                user,
                userName,
                notes: {
                    bankAnalysisItems: []
                }
            };
            check.sofAnnotations.unshift(annotation);
        }
        
        if (!annotation.notes.bankAnalysisItems) {
            annotation.notes.bankAnalysisItems = [];
        }
        
        // Remove any existing flag for this item
        annotation.notes.bankAnalysisItems = annotation.notes.bankAnalysisItems.filter(item => {
            if (itemType === 'repeating-group') {
                return !(item.type === 'repeating-group' && item.groupIndex == itemKey);
            } else if (itemType === 'chain') {
                return !(item.type === 'chain' && item.chainId === itemKey); // Use chainId
            } else if (itemType === 'transaction') {
                return !(item.type === 'transaction' && item.transactionId === itemKey);
            }
            return true;
        });
        
        // Add new flag
        const newItem = {
            type: itemType,
            flag,
            comment: ''
        };
        
        if (itemType === 'repeating-group') {
            newItem.groupIndex = parseInt(itemKey);
        } else if (itemType === 'chain') {
            newItem.chainId = itemKey; // Store chainId (which is a composite of transaction IDs)
        } else if (itemType === 'transaction') {
            newItem.transactionId = itemKey;
        }
        
        annotation.notes.bankAnalysisItems.push(newItem);
        
        console.log('✅ Saved analysis item flag:', newItem);
    }
    
    removeAnalysisItemFlag(itemType, itemKey) {
        const check = this.currentCheck;
        if (!check.sofAnnotations) return;
        
        // Remove from all annotations
        check.sofAnnotations.forEach(ann => {
            if (!ann.notes?.bankAnalysisItems) return;
            
            ann.notes.bankAnalysisItems = ann.notes.bankAnalysisItems.filter(item => {
                if (itemType === 'repeating-group') {
                    return !(item.type === 'repeating-group' && item.groupIndex == itemKey);
                } else if (itemType === 'chain') {
                    return !(item.type === 'chain' && item.chainId === itemKey); // Use chainId
                } else if (itemType === 'transaction') {
                    return !(item.type === 'transaction' && item.transactionId === itemKey);
                }
                return true;
            });
        });
        
        console.log('🗑️ Removed analysis item flag');
    }
    
    createSofBiggestTransactionsSection(summaryByCcy, accounts, check, existingAnnotations) {
        // Create biggest transactions by currency section for SOF overlay with flag buttons
        const currencyFlag = this.getCurrencyFlag.bind(this);
        const sofAnnotations = existingAnnotations || [];
        
        // Get SoF funding methods for linking
        const sofTask = check?.taskOutcomes?.['sof:v1'];
        const sofFunds = sofTask?.breakdown?.funds || [];
        
        // Helper to generate unique chain ID
        const getChainId = (chain) => {
            const ids = [];
            if (chain.source) ids.push(chain.source.id);
            ids.push(chain.out.id);
            if (chain.in) ids.push(chain.in.id);
            if (chain.payment) ids.push(chain.payment.id);
            return ids.join('|');
        };
        
        // Helper to get existing flags/comments for items
        const getItemAnnotation = (itemType, itemKey) => {
            for (const ann of sofAnnotations) {
                const items = ann.notes?.bankAnalysisItems || [];
                const found = items.find(item => {
                    if (itemType === 'transaction' && item.type === 'transaction') {
                        return item.transactionId === itemKey;
                    } else if (itemType === 'chain' && item.type === 'chain') {
                        return item.chainId === itemKey;
                    }
                    return false;
                });
                if (found) {
                    return { flag: found.flag, comment: found.comment, linkedToFundIdx: found.linkedToFundIdx };
                }
            }
            return null;
        };
        
        // Helper to get funding link
        const getItemLink = (itemType, itemKey) => {
            const annotation = getItemAnnotation(itemType, itemKey);
            return annotation?.linkedToFundIdx;
        };
        
        // Helper to create flag buttons
        const createFlagButtons = (itemType, itemKey, existingFlag = '', existingComment = '') => {
            const existingLink = getItemLink(itemType, itemKey);
            
            return `
                <div class="tx-flag-buttons-inline">
                    <button type="button" class="tx-flag-btn-square cleared ${existingFlag === 'cleared' ? 'active' : ''}" 
                        data-flag="cleared" 
                        title="Cleared" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>
                    </button>
                    <button type="button" class="tx-flag-btn-square suspicious ${existingFlag === 'suspicious' ? 'active' : ''}" 
                        data-flag="suspicious" 
                        title="Suspicious" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>
                    </button>
                    <button type="button" class="tx-flag-btn-square review ${existingFlag === 'review' ? 'active' : ''}" 
                        data-flag="review" 
                        title="Under Review" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>
                    </button>
                    ${sofFunds.length > 0 ? `
                        <button type="button" class="tx-flag-btn-square link-funding ${existingLink ? 'active' : ''}" 
                            data-action="link" 
                            title="Link to Funding Method" onclick="event.stopPropagation(); manager.toggleAnalysisItemLinking(this);">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="none" fill="currentColor"/><path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" fill="none"/></svg>
                        </button>
                    ` : ''}
                </div>
            `;
        };
        
        let html = '';
        
        for (const [currency, data] of Object.entries(summaryByCcy)) {
            const topIn = data.top_in || [];
            const topOut = data.top_out || [];
            const flag = currencyFlag(currency);
            
            // Filter transactions to only include those that actually match this currency
            let filteredTopIn = topIn.filter(tx => tx.currency === currency).slice(0, 5);
            let filteredTopOut = topOut.filter(tx => tx.currency === currency).slice(0, 5);
            
            // Enrich with account names
            filteredTopIn = filteredTopIn.map(tx => {
                const accountData = accounts[tx.account_id];
                const info = accountData?.info || accountData;
                return {
                    ...tx,
                    accountName: info?.name || 'Account'
                };
            });
            filteredTopOut = filteredTopOut.map(tx => {
                const accountData = accounts[tx.account_id];
                const info = accountData?.info || accountData;
                return {
                    ...tx,
                    accountName: info?.name || 'Account'
                };
            });
            
            // Skip if no matching transactions
            if (filteredTopIn.length === 0 && filteredTopOut.length === 0) {
                continue;
            }
            
            // Chain detection (same as task card)
            const matched = [];
            const transferPairs = [];
            const transactionChains = [];
            
            // First pass: Exact cross-account transfers
            filteredTopOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = filteredTopIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    
                    return Math.abs(inAmount - outAmount) < 0.01 && 
                           inTx.account_id !== outTx.account_id && 
                           inDate.toDateString() === outDate.toDateString();
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transferPairs.push({ out: outTx, in: match });
                }
            });
            
            // Second pass: Same-account flows
            filteredTopOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = filteredTopIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return inTx.account_id === outTx.account_id && 
                           daysDiff >= 0 && daysDiff <= 3 &&
                           inAmount >= outAmount &&
                           (inAmount - outAmount) <= Math.max(500, inAmount * 0.2);
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transactionChains.push({ 
                        source: match, 
                        out: outTx, 
                        in: null
                    });
                }
            });
            
            // Helper to render chain with controls
            const renderChainWithControls = (chain, currencyFlag) => {
                // Generate unique chain ID from transaction IDs
                const chainId = getChainId(chain);
                const chainAnnotation = getItemAnnotation('chain', chainId);
                const chainFlag = chainAnnotation ? chainAnnotation.flag : '';
                const chainComment = chainAnnotation ? chainAnnotation.comment : '';
                const hasChainFlag = chainFlag !== '';
                const chainLinkedFund = getItemLink('chain', chainId);
                
                // Build funding dropdown
                let chainFundingDropdown = '';
                if (sofFunds.length > 0) {
                    chainFundingDropdown = `
                        <div class="analysis-item-funding-link ${chainLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="chain" data-chain-id="${chainId}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.data?.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.data.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    return `<option value="${fundIdx}" ${chainLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                return `
                    <div class="chain-wrapper" data-chain-id="${chainId}">
                        ${this.renderChainColumnContent(chain, currencyFlag)}
                        <div class="chain-controls">
                            ${createFlagButtons('chain', chainId, chainFlag, chainComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasChainFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="chain" data-chain-id="${chainId}" rows="2" placeholder="Add notes about this chain...">${chainComment}</textarea>
                        </div>
                        ${chainFundingDropdown}
                    </div>
                `;
            };
            
            // Build chains HTML
            let chainsHtml = '';
            if (transferPairs.length > 0 || transactionChains.length > 0) {
                chainsHtml += '<div class="internal-transfers-label">Linked Transactions</div>';
                
                // Render transfer pairs with controls
                transferPairs.forEach((chain) => {
                    chainsHtml += renderChainWithControls(chain, flag);
                });
                
                // Render same-account chains with controls
                transactionChains.forEach((chain) => {
                    chainsHtml += renderChainWithControls(chain, flag);
                });
            }
            
            // Build unmatched transactions
            const unmatchedIn = filteredTopIn.filter(tx => !matched.includes(tx.id));
            const unmatchedOut = filteredTopOut.filter(tx => !matched.includes(tx.id));
            
            let incomingHtml = '';
            unmatchedIn.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const txAnnotation = getItemAnnotation('transaction', tx.id);
                const txFlag = txAnnotation ? txAnnotation.flag : '';
                const txComment = txAnnotation ? txAnnotation.comment : '';
                const hasTxFlag = txFlag !== '';
                const txLinkedFund = getItemLink('transaction', tx.id);
                
                // Build funding dropdown
                let txFundingDropdown = '';
                if (sofFunds.length > 0) {
                    txFundingDropdown = `
                        <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.data?.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.data.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                incomingHtml += `
                    <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                        <div class="transaction-row incoming">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount positive">+${flag}${Math.abs(tx.amount).toFixed(2)}</span>
                            ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                        </div>
                        ${txFundingDropdown}
                    </div>
                `;
            });
            
            let outgoingHtml = '';
            unmatchedOut.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const txAnnotation = getItemAnnotation('transaction', tx.id);
                const txFlag = txAnnotation ? txAnnotation.flag : '';
                const txComment = txAnnotation ? txAnnotation.comment : '';
                const hasTxFlag = txFlag !== '';
                const txLinkedFund = getItemLink('transaction', tx.id);
                
                // Build funding dropdown
                let txFundingDropdown = '';
                if (sofFunds.length > 0) {
                    txFundingDropdown = `
                        <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.data?.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.data.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                outgoingHtml += `
                    <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                        <div class="transaction-row outgoing">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount negative">${flag}${Math.abs(tx.amount).toFixed(2)}</span>
                            ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                        </div>
                        ${txFundingDropdown}
                    </div>
                `;
            });
            
            // Build columns
            let columnsHtml = '';
            if (incomingHtml || outgoingHtml) {
                if (incomingHtml && outgoingHtml) {
                    columnsHtml = `
                        <div class="transactions-columns">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                } else if (incomingHtml) {
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                        </div>
                    `;
                } else {
                    columnsHtml = `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                }
            }
            
            html += `
                <div class="currency-group-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                    <div class="currency-section-header">
                        <span class="currency-section-title">${flag} ${currency}</span>
                        <span class="expand-indicator">▼</span>
                    </div>
                    <div class="currency-section-content">
                        ${chainsHtml}
                        ${columnsHtml}
                    </div>
                </div>
            `;
        }
        
        return html;
    }
    
    createSofBankAnalysisSections(analysis, accounts, check, existingAnnotations) {
        // Create bank analysis sections for SOF overlay with SAME visualization as task card
        // But with flag buttons on chains, groups, and transactions
        
        if (!analysis) return '';
        
        let html = '';
        const sofAnnotations = existingAnnotations || [];
        const currencySymbol = this.getCurrencyFlag('GBP');
        
        // Helper to generate unique chain ID from transaction IDs
        const getChainId = (chain) => {
            const ids = [];
            if (chain.source) ids.push(chain.source.id);
            ids.push(chain.out.id);
            if (chain.in) ids.push(chain.in.id);
            if (chain.payment) ids.push(chain.payment.id);
            return ids.join('|'); // Use pipe separator to create unique ID
        };
        
        // Helper to get transaction details from ID
        const getTransactionById = (txId) => {
            for (const [accountId, accountData] of Object.entries(accounts)) {
                const statement = accountData.statement || [];
                const tx = statement.find(t => t.id === txId);
                if (tx) {
                    const accountInfo = accountData.info || accountData;
                    return { ...tx, accountName: accountInfo.name || 'Account', accountId };
                }
            }
            return null;
        };
        
        // Helper to get existing flags/comments for items
        const getItemAnnotation = (itemType, itemKey) => {
            for (const ann of sofAnnotations) {
                const items = ann.notes?.bankAnalysisItems || [];
                const found = items.find(item => {
                    if (itemType === 'repeating-group' && item.type === 'repeating-group') {
                        return item.groupIndex === itemKey;
                    } else if (itemType === 'chain' && item.type === 'chain') {
                        return item.chainId === itemKey; // Changed from chainIndex to chainId
                    } else if (itemType === 'transaction' && item.type === 'transaction') {
                        return item.transactionId === itemKey;
                    }
                    return false;
                });
                if (found) {
                    return { flag: found.flag, comment: found.comment };
                }
            }
            return null;
        };
        
        // Get SoF funding methods for linking
        const sofTask = check?.taskOutcomes?.['sof:v1'];
        const sofFunds = sofTask?.breakdown?.funds || [];
        
        // Helper to get existing link for an analysis item
        const getItemLink = (itemType, itemKey) => {
            for (const ann of sofAnnotations) {
                const items = ann.notes?.bankAnalysisItems || [];
                const found = items.find(item => {
                    if (itemType === 'repeating-group' && item.type === 'repeating-group') {
                        return item.groupIndex === itemKey;
                    } else if (itemType === 'chain' && item.type === 'chain') {
                        return item.chainId === itemKey; // Changed from chainIndex to chainId
                    } else if (itemType === 'transaction' && item.type === 'transaction') {
                        return item.transactionId === itemKey;
                    }
                    return false;
                });
                if (found && found.linkedToFundIdx) {
                    return found.linkedToFundIdx;
                }
            }
            return '';
        };
        
        // Helper to create flag buttons (same style as transaction list)
        const createFlagButtons = (itemType, itemKey, existingFlag = '', existingComment = '') => {
            // Don't add data attributes to buttons - they're on the parent card
            const existingLink = getItemLink(itemType, itemKey);
            
            return `
                <div class="tx-flag-buttons-inline">
                    <button type="button" class="tx-flag-btn-square cleared ${existingFlag === 'cleared' ? 'active' : ''}" 
                        data-flag="cleared" 
                        title="Cleared" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>
                    </button>
                    <button type="button" class="tx-flag-btn-square suspicious ${existingFlag === 'suspicious' ? 'active' : ''}" 
                        data-flag="suspicious" 
                        title="Suspicious" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>
                    </button>
                    <button type="button" class="tx-flag-btn-square review ${existingFlag === 'review' ? 'active' : ''}" 
                        data-flag="review" 
                        title="Under Review" onclick="event.stopPropagation(); manager.toggleAnalysisItemFlag(this);">
                        <svg viewBox="0 0 300 300"><path fill="currentColor" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>
                    </button>
                    ${sofFunds.length > 0 ? `
                        <button type="button" class="tx-flag-btn-square link-funding ${existingLink ? 'active' : ''}" 
                            data-action="link" 
                            title="Link to Funding Method" onclick="event.stopPropagation(); manager.toggleAnalysisItemLinking(this);">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="none" fill="currentColor"/><path d="M12 6v12M6 12h12" stroke="white" stroke-width="2" fill="none"/></svg>
                        </button>
                    ` : ''}
                </div>
            `;
        };
        
        // 1. Repeating Transactions Section
        if (analysis.repeating_transactions && analysis.repeating_transactions.length > 0) {
            let repeatingHtml = '';
            
            analysis.repeating_transactions.forEach((group, groupIdx) => {
                const amount = group.sort_score;
                const frequency = group.items.length;
                
                // Get all transaction details
                const transactions = group.items.map(id => getTransactionById(id)).filter(tx => tx);
                if (transactions.length === 0) return;
                
                // Separate into incoming and outgoing
                const incomingTxs = transactions.filter(tx => tx.amount > 0);
                const outgoingTxs = transactions.filter(tx => tx.amount < 0);
                
                // Apply chain detection (same logic as task card)
                const matched = [];
                const chains = [];
                
                // Pass 1: Exact cross-account transfers
                outgoingTxs.forEach(outTx => {
                    if (matched.includes(outTx.id)) return;
                    const outDate = new Date(outTx.timestamp);
                    
                    const match = incomingTxs.find(inTx => {
                        if (matched.includes(inTx.id)) return false;
                        const inDate = new Date(inTx.timestamp);
                        return inDate.toDateString() === outDate.toDateString() && 
                               inTx.account_id !== outTx.account_id;
                    });
                    
                    if (match) {
                        matched.push(match.id);
                        matched.push(outTx.id);
                        chains.push({ out: outTx, in: match });
                    }
                });
                
                // Pass 2: Same-account flows
                outgoingTxs.forEach(outTx => {
                    if (matched.includes(outTx.id)) return;
                    const outDate = new Date(outTx.timestamp);
                    
                    const match = incomingTxs.find(inTx => {
                        if (matched.includes(inTx.id)) return false;
                        const inDate = new Date(inTx.timestamp);
                        const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                        
                        return inTx.account_id === outTx.account_id && 
                               daysDiff >= 0 && daysDiff <= 3;
                    });
                    
                    if (match) {
                        matched.push(match.id);
                        matched.push(outTx.id);
                        chains.push({ source: match, out: outTx, in: null });
                    }
                });
                
                // Build chains HTML with flag buttons using unique chain IDs
                let chainsHtml = '';
                chains.forEach(chain => {
                    // Generate unique chain ID from transaction IDs
                    const chainId = getChainId(chain);
                    
                    // Get existing annotation for this chain using chainId
                    const chainAnnotation = getItemAnnotation('chain', chainId);
                    const chainFlag = chainAnnotation ? chainAnnotation.flag : '';
                    const chainComment = chainAnnotation ? chainAnnotation.comment : '';
                    const hasChainFlag = chainFlag !== '';
                    const chainLinkedFund = getItemLink('chain', chainId);
                    
                    // Build funding method dropdown if there are funds
                    let chainFundingDropdown = '';
                    if (sofFunds.length > 0) {
                        chainFundingDropdown = `
                            <div class="analysis-item-funding-link ${chainLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                                <select class="analysis-item-funding-select" data-item-type="chain" data-chain-id="${chainId}" style="width: 100%; font-size: 11px; padding: 6px;">
                                    <option value="">-- Select funding method --</option>
                                    ${sofFunds.map((fund, fundIdx) => {
                                        const fundLabel = fund.data?.amount ? 
                                            `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.data.amount / 100).toLocaleString()}` :
                                            fund.type.replace('fund:', '').toUpperCase();
                                        // Convert both to strings for comparison to avoid type mismatch
                                        return `<option value="${fundIdx}" ${String(chainLinkedFund) === String(fundIdx) ? 'selected' : ''}>${fundLabel}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        `;
                    }
                    
                    chainsHtml += `
                        <div class="chain-wrapper" data-chain-id="${chainId}">
                            <div class="chain-column">
                                ${this.renderChainColumnContent(chain, currencySymbol)}
                            </div>
                            <div class="chain-controls">
                                ${createFlagButtons('chain', chainId, chainFlag, chainComment)}
                            </div>
                            <div class="analysis-item-note-section ${hasChainFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <textarea class="analysis-item-note-input" data-item-type="chain" data-chain-id="${chainId}" rows="2" placeholder="Add notes about this chain...">${chainComment}</textarea>
                            </div>
                            ${chainFundingDropdown}
                        </div>
                    `;
                });
                
                // Build unmatched transactions in columns
                const unmatchedIn = incomingTxs.filter(tx => !matched.includes(tx.id));
                const unmatchedOut = outgoingTxs.filter(tx => !matched.includes(tx.id));
                
                let incomingHtml = '';
                unmatchedIn.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    
                    // Get comprehensive annotations for this transaction
                    const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                    
                    // Build badges
                    let badgesHtml = '';
                    
                    // Marker badges
                    if (txAnnotations.marker === 'accepted') {
                        badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (txAnnotations.marker === 'rejected') {
                        badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Flag badges
                    if (txAnnotations.flag === 'cleared') {
                        badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (txAnnotations.flag === 'suspicious') {
                        badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (txAnnotations.flag === 'review') {
                        badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                    } else if (txAnnotations.flag === 'linked') {
                        badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // User note badge
                    if (txAnnotations.note) {
                        badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                    }
                    
                    incomingHtml += `
                        <div class="transaction-row incoming">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}${badgesHtml}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount positive">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                let outgoingHtml = '';
                unmatchedOut.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    
                    // Get comprehensive annotations for this transaction
                    const txAnnotations = check ? this.getTransactionAnnotations(tx.id, check) : { flag: '', note: '', marker: '' };
                    
                    // Build badges
                    let badgesHtml = '';
                    
                    // Marker badges
                    if (txAnnotations.marker === 'accepted') {
                        badgesHtml += '<span class="tx-marker-badge accepted">✓ Accepted</span>';
                    } else if (txAnnotations.marker === 'rejected') {
                        badgesHtml += '<span class="tx-marker-badge rejected">✗ Rejected</span>';
                    }
                    
                    // Flag badges
                    if (txAnnotations.flag === 'cleared') {
                        badgesHtml += '<span class="tx-marker-badge cleared">○ Cleared</span>';
                    } else if (txAnnotations.flag === 'suspicious') {
                        badgesHtml += '<span class="tx-marker-badge suspicious">✗ Suspicious</span>';
                    } else if (txAnnotations.flag === 'review') {
                        badgesHtml += '<span class="tx-marker-badge review">— Review</span>';
                    } else if (txAnnotations.flag === 'linked') {
                        badgesHtml += '<span class="tx-marker-badge linked">✓ Linked</span>';
                    }
                    
                    // User note badge
                    if (txAnnotations.note) {
                        badgesHtml += `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #f5f5f5; color: #666; border: 1px solid #ddd; margin-left: 4px;">📝 ${txAnnotations.note}</span>`;
                    }
                    
                    outgoingHtml += `
                        <div class="transaction-row outgoing">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}${badgesHtml}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount negative">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                // Build columns section
                let columnsHtml = '';
                const hasIncoming = incomingHtml.trim().length > 0;
                const hasOutgoing = outgoingHtml.trim().length > 0;
                
                if (hasIncoming || hasOutgoing) {
                    if (hasIncoming && hasOutgoing) {
                        columnsHtml = `
                            <div class="transactions-columns">
                                <div class="transactions-column">
                                    <div class="column-header incoming-header">Incoming</div>
                                    ${incomingHtml}
                                </div>
                                <div class="transactions-column">
                                    <div class="column-header outgoing-header">Outgoing</div>
                                    ${outgoingHtml}
                                </div>
                            </div>
                        `;
                    } else if (hasIncoming) {
                        columnsHtml = `
                            <div class="transactions-columns single-column">
                                <div class="transactions-column">
                                    <div class="column-header incoming-header">Incoming</div>
                                    ${incomingHtml}
                                </div>
                            </div>
                        `;
                    } else {
                        columnsHtml = `
                            <div class="transactions-columns single-column">
                                <div class="transactions-column">
                                    <div class="column-header outgoing-header">Outgoing</div>
                                    ${outgoingHtml}
                                </div>
                            </div>
                        `;
                    }
                }
                
                const accountsSet = [...new Set(transactions.map(tx => tx.accountName))];
                const groupAnnotation = getItemAnnotation('repeating-group', groupIdx);
                const groupFlag = groupAnnotation ? groupAnnotation.flag : '';
                const groupComment = groupAnnotation ? groupAnnotation.comment : '';
                const hasGroupFlag = groupFlag !== '';
                const groupLinkedFund = getItemLink('repeating-group', groupIdx);
                
                // Build funding method dropdown if there are funds
                let fundingDropdown = '';
                if (sofFunds.length > 0) {
                    fundingDropdown = `
                        <div class="analysis-item-funding-link ${groupLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="repeating-group" data-group-index="${groupIdx}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.data?.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.data.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    // Convert both to strings for comparison to avoid type mismatch
                                    return `<option value="${fundIdx}" ${String(groupLinkedFund) === String(fundIdx) ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                repeatingHtml += `
                    <div class="analysis-item-card" data-group-index="${groupIdx}">
                        <div class="analysis-card-header">
                            <div class="analysis-card-title">
                                ${currencySymbol}${Math.abs(amount).toFixed(2)} × ${frequency}
                            </div>
                            <div class="analysis-card-meta">
                                ${accountsSet.length > 1 ? `Between: ${accountsSet.join(' ↔ ')}` : `Account: ${accountsSet[0]}`}
                            </div>
                            ${createFlagButtons('repeating-group', groupIdx, groupFlag, groupComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasGroupFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="repeating-group" data-group-index="${groupIdx}" rows="2" placeholder="Add notes about this pattern...">${groupComment}</textarea>
                        </div>
                        ${fundingDropdown}
                        ${chainsHtml ? `
                            <div class="internal-transfers-label">Linked Transactions</div>
                            ${chainsHtml}
                        ` : ''}
                        ${columnsHtml}
                    </div>
                `;
            });
            
            html += `
                <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                    <div class="analysis-section-header">
                        <span class="analysis-section-title">Repeating Transactions (${analysis.repeating_transactions.length} patterns)</span>
                        <span class="expand-indicator">▼</span>
                    </div>
                    <div class="analysis-section-content">
                        ${repeatingHtml}
                    </div>
                </div>
            `;
        }
        
        // 2. Large One-off Transactions Section (with chain detection)
        if (analysis.large_one_off_transactions && analysis.large_one_off_transactions.length > 0) {
            const oneOffTxs = analysis.large_one_off_transactions
                .map(txId => getTransactionById(txId))
                .filter(tx => tx);
            
            const oneOffIn = oneOffTxs.filter(tx => tx.amount > 0);
            const oneOffOut = oneOffTxs.filter(tx => tx.amount < 0);
            
            // Chain detection
            const matched = [];
            const transferPairs = [];
            const chains = [];
            
            // First pass: Exact cross-account transfers
            oneOffOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = oneOffIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    
                    return Math.abs(inAmount - outAmount) < 0.01 && 
                           inTx.account_id !== outTx.account_id && 
                           inDate.toDateString() === outDate.toDateString();
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    transferPairs.push({ out: outTx, in: match });
                }
            });
            
            // Second pass: Same-account flows
            oneOffOut.forEach(outTx => {
                if (matched.includes(outTx.id)) return;
                const outDate = new Date(outTx.timestamp);
                const outAmount = Math.abs(outTx.amount);
                
                const match = oneOffIn.find(inTx => {
                    if (matched.includes(inTx.id)) return false;
                    const inDate = new Date(inTx.timestamp);
                    const inAmount = Math.abs(inTx.amount);
                    const daysDiff = (outDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return inTx.account_id === outTx.account_id && 
                           daysDiff >= 0 && daysDiff <= 3 &&
                           inAmount >= outAmount &&
                           (inAmount - outAmount) <= Math.max(500, inAmount * 0.2);
                });
                
                if (match) {
                    matched.push(match.id);
                    matched.push(outTx.id);
                    chains.push({ 
                        source: match, 
                        out: outTx, 
                        in: null
                    });
                }
            });
            
            // Third pass: Extend with preceding/subsequent
            const extendedChains = [];
            transferPairs.forEach(pair => {
                const candidateIncomes = oneOffIn.filter(precedingTx => {
                    if (matched.includes(precedingTx.id)) return false;
                    const precedingDate = new Date(precedingTx.timestamp);
                    const outDate = new Date(pair.out.timestamp);
                    const daysDiff = (outDate - precedingDate) / (1000 * 60 * 60 * 24);
                    
                    return precedingTx.account_id === pair.out.account_id && 
                           daysDiff >= 0 && daysDiff <= 3;
                });
                
                const precedingIncome = candidateIncomes.length > 0
                    ? candidateIncomes.reduce((largest, tx) => 
                        Math.abs(tx.amount) > Math.abs(largest.amount) ? tx : largest
                      )
                    : null;
                
                const subsequentPayment = oneOffOut.find(paymentTx => {
                    if (matched.includes(paymentTx.id)) return false;
                    const paymentDate = new Date(paymentTx.timestamp);
                    const inDate = new Date(pair.in.timestamp);
                    const daysDiff = (paymentDate - inDate) / (1000 * 60 * 60 * 24);
                    
                    return paymentTx.account_id === pair.in.account_id && 
                           daysDiff >= 0 && daysDiff <= 2;
                });
                
                if (precedingIncome) matched.push(precedingIncome.id);
                if (subsequentPayment) matched.push(subsequentPayment.id);
                
                extendedChains.push({
                    source: precedingIncome,
                    out: pair.out,
                    in: pair.in,
                    payment: subsequentPayment
                });
            });
            
            // Build HTML
            let oneOffHtml = '';
            
            // Combine all chains (extended and simple) for unified rendering
            const allChains = [...extendedChains, ...chains];
            
            // Render chains with flag buttons
            if (allChains.length > 0) {
                oneOffHtml += '<div class="internal-transfers-label">Linked Transactions</div>';
                
                allChains.forEach((chain, chainIdx) => {
                    // Get existing annotation for this chain
                    const chainAnnotation = getItemAnnotation('chain', chainIdx);
                    const chainFlag = chainAnnotation ? chainAnnotation.flag : '';
                    const chainComment = chainAnnotation ? chainAnnotation.comment : '';
                    const hasChainFlag = chainFlag !== '';
                    const chainLinkedFund = getItemLink('chain', chainIdx);
                    
                    // Build funding method dropdown if there are funds
                    let chainFundingDropdown = '';
                    if (sofFunds.length > 0) {
                        chainFundingDropdown = `
                            <div class="analysis-item-funding-link ${chainLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                                <select class="analysis-item-funding-select" data-item-type="chain" data-chain-index="${chainIdx}" style="width: 100%; font-size: 11px; padding: 6px;">
                                    <option value="">-- Select funding method --</option>
                                    ${sofFunds.map((fund, fundIdx) => {
                                        const fundLabel = fund.amount ? 
                                            `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.amount / 100).toLocaleString()}` :
                                            fund.type.replace('fund:', '').toUpperCase();
                                        return `<option value="${fundIdx}" ${chainLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        `;
                    }
                    
                    oneOffHtml += `
                        <div class="chain-wrapper" data-chain-index="${chainIdx}">
                            <div class="chain-column">
                                ${this.renderChainColumnContent(chain, currencySymbol)}
                            </div>
                            <div class="chain-controls">
                                ${createFlagButtons('chain', chainIdx, chainFlag, chainComment)}
                            </div>
                            <div class="analysis-item-note-section ${hasChainFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <textarea class="analysis-item-note-input" data-item-type="chain" data-chain-index="${chainIdx}" rows="2" placeholder="Add notes about this chain...">${chainComment}</textarea>
                            </div>
                            ${chainFundingDropdown}
                        </div>
                    `;
                });
            }
            
            // Render unmatched transactions
            const unmatchedIn = oneOffIn.filter(tx => !matched.includes(tx.id));
            const unmatchedOut = oneOffOut.filter(tx => !matched.includes(tx.id));
            
            let incomingHtml = '';
            unmatchedIn.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const txAnnotation = getItemAnnotation('transaction', tx.id);
                const txFlag = txAnnotation ? txAnnotation.flag : '';
                const txComment = txAnnotation ? txAnnotation.comment : '';
                const hasTxFlag = txFlag !== '';
                const txLinkedFund = getItemLink('transaction', tx.id);
                
                // Build funding method dropdown if there are funds
                let txFundingDropdown = '';
                if (sofFunds.length > 0) {
                    txFundingDropdown = `
                        <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                incomingHtml += `
                    <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                        <div class="transaction-row incoming">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount positive">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                            ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                        </div>
                        ${txFundingDropdown}
                    </div>
                `;
            });
            
            let outgoingHtml = '';
            unmatchedOut.forEach(tx => {
                const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const txAnnotation = getItemAnnotation('transaction', tx.id);
                const txFlag = txAnnotation ? txAnnotation.flag : '';
                const txComment = txAnnotation ? txAnnotation.comment : '';
                const hasTxFlag = txFlag !== '';
                const txLinkedFund = getItemLink('transaction', tx.id);
                
                // Build funding method dropdown if there are funds
                let txFundingDropdown = '';
                if (sofFunds.length > 0) {
                    txFundingDropdown = `
                        <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                            <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                <option value="">-- Select funding method --</option>
                                ${sofFunds.map((fund, fundIdx) => {
                                    const fundLabel = fund.amount ? 
                                        `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.amount / 100).toLocaleString()}` :
                                        fund.type.replace('fund:', '').toUpperCase();
                                    return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                }).join('')}
                            </select>
                        </div>
                    `;
                }
                
                outgoingHtml += `
                    <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                        <div class="transaction-row outgoing">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount negative">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                            ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                        </div>
                        <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                            <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                        </div>
                        ${txFundingDropdown}
                    </div>
                `;
            });
            
            // Build columns
            if (incomingHtml || outgoingHtml) {
                if (incomingHtml && outgoingHtml) {
                    oneOffHtml += `
                        <div class="transactions-columns">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                } else if (incomingHtml) {
                    oneOffHtml += `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header incoming-header">Incoming</div>
                                ${incomingHtml}
                            </div>
                        </div>
                    `;
                } else {
                    oneOffHtml += `
                        <div class="transactions-columns single-column">
                            <div class="transactions-column">
                                <div class="column-header outgoing-header">Outgoing</div>
                                ${outgoingHtml}
                            </div>
                        </div>
                    `;
                }
            }
            
            html += `
                <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                    <div class="analysis-section-header">
                        <span class="analysis-section-title">Large One-Off Transactions (${analysis.large_one_off_transactions.length})</span>
                        <span class="expand-indicator">▼</span>
                    </div>
                    <div class="analysis-section-content">
                        ${oneOffHtml}
                    </div>
                </div>
            `;
        }
        
        // 3. Largest by Currency Section - using proper filtering like task card
        if (analysis.largest_individual_transactions && analysis.largest_individual_transactions.length > 0) {
            console.log('💰 Rendering Largest Transactions by Currency section:', analysis.largest_individual_transactions.length, 'transactions');
            let largestHtml = '';
            
            // Get the summary by currency data which includes top_in and top_out
            // This is more reliable than grouping the IDs ourselves
            const bankSummary = check?.taskOutcomes?.['bank:summary'];
            const summaryByCcy = bankSummary?.breakdown?.summary?.by_ccy;
            console.log('📊 Summary by currency available?', !!summaryByCcy);
            
            // Try to use summaryByCcy first, otherwise fall back to grouping the IDs
            if (summaryByCcy && Object.keys(summaryByCcy).length > 0) {
                // Use the task card filtering logic - filter by currency and take top 5
                Object.entries(summaryByCcy).forEach(([currency, data]) => {
                    const topIn = data.top_in || [];
                    const topOut = data.top_out || [];
                    const flag = this.getCurrencyFlag(currency);
                    
                    // Filter transactions to only include those that actually match this currency
                    // and take top 5 of each
                    let filteredTopIn = topIn.filter(tx => tx.currency === currency).slice(0, 5);
                    let filteredTopOut = topOut.filter(tx => tx.currency === currency).slice(0, 5);
                    
                    // Enrich with account names
                    filteredTopIn = filteredTopIn.map(tx => {
                        const accountData = accounts[tx.account_id];
                        const info = accountData?.info || accountData;
                        return {
                            ...tx,
                            accountName: info?.name || 'Account'
                        };
                    });
                    filteredTopOut = filteredTopOut.map(tx => {
                        const accountData = accounts[tx.account_id];
                        const info = accountData?.info || accountData;
                        return {
                            ...tx,
                            accountName: info?.name || 'Account'
                        };
                    });
                    
                    // Skip this currency if no matching transactions
                    if (filteredTopIn.length === 0 && filteredTopOut.length === 0) {
                        return;
                    }
                    
                    // Combine and sort all transactions for this currency
                    const allTxs = [...filteredTopIn, ...filteredTopOut];
                    allTxs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
                    
                    // Render each transaction
                    let currencyHtml = '';
                    allTxs.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const isIncoming = tx.amount > 0;
                    const txAnnotation = getItemAnnotation('transaction', tx.id);
                    const txFlag = txAnnotation ? txAnnotation.flag : '';
                    const txComment = txAnnotation ? txAnnotation.comment : '';
                    const hasTxFlag = txFlag !== '';
                    const txLinkedFund = getItemLink('transaction', tx.id);
                    
                    // Build funding method dropdown if there are funds
                    let txFundingDropdown = '';
                    if (sofFunds.length > 0) {
                        txFundingDropdown = `
                            <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                                <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                    <option value="">-- Select funding method --</option>
                                    ${sofFunds.map((fund, fundIdx) => {
                                        const fundLabel = fund.amount ? 
                                            `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.amount / 100).toLocaleString()}` :
                                            fund.type.replace('fund:', '').toUpperCase();
                                        return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        `;
                    }
                    
                    currencyHtml += `
                        <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                            <div class="transaction-row ${isIncoming ? 'incoming' : 'outgoing'}">
                                <span class="transaction-date">${date}</span>
                                <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                                <span class="account-badge">${tx.accountName}</span>
                                <span class="transaction-amount ${isIncoming ? 'positive' : 'negative'}">
                                    ${isIncoming ? '+' : ''}${flag}${Math.abs(tx.amount).toFixed(2)}
                                </span>
                                ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                            </div>
                            <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                            </div>
                            ${txFundingDropdown}
                        </div>
                    `;
                });
                
                    largestHtml += `
                        <div class="currency-group">
                            <div class="currency-group-header">${flag} ${currency}</div>
                            ${currencyHtml}
                        </div>
                    `;
                });
            } else {
                // Fallback: Group by currency from the transaction IDs
                console.log('📊 Using fallback grouping for largest transactions');
                const byCurrency = {};
                analysis.largest_individual_transactions.forEach(txId => {
                    const tx = getTransactionById(txId);
                    if (!tx) return;
                    const currency = tx.currency || 'GBP';
                    if (!byCurrency[currency]) byCurrency[currency] = [];
                    byCurrency[currency].push(tx);
                });
                
                // Render each currency group
                Object.entries(byCurrency).forEach(([currency, txs]) => {
                    const flag = this.getCurrencyFlag(currency);
                    
                    // Filter to only include transactions that match this currency
                    const filteredTxs = txs.filter(tx => tx.currency === currency);
                    if (filteredTxs.length === 0) return;
                    
                    let currencyHtml = '';
                    filteredTxs.forEach(tx => {
                        const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const isIncoming = tx.amount > 0;
                        const txAnnotation = getItemAnnotation('transaction', tx.id);
                        const txFlag = txAnnotation ? txAnnotation.flag : '';
                        const txComment = txAnnotation ? txAnnotation.comment : '';
                        const hasTxFlag = txFlag !== '';
                        const txLinkedFund = getItemLink('transaction', tx.id);
                        
                        // Build funding method dropdown if there are funds
                        let txFundingDropdown = '';
                        if (sofFunds.length > 0) {
                            txFundingDropdown = `
                                <div class="analysis-item-funding-link ${txLinkedFund ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                    <label style="font-size: 11px; color: #666; margin-bottom: 4px; display: block;">Link to Funding Method:</label>
                                    <select class="analysis-item-funding-select" data-item-type="transaction" data-tx-id="${tx.id}" style="width: 100%; font-size: 11px; padding: 6px;">
                                        <option value="">-- Select funding method --</option>
                                        ${sofFunds.map((fund, fundIdx) => {
                                            const fundLabel = fund.amount ? 
                                                `${fund.type.replace('fund:', '').toUpperCase()}: £${(fund.amount / 100).toLocaleString()}` :
                                                fund.type.replace('fund:', '').toUpperCase();
                                            return `<option value="${fundIdx}" ${txLinkedFund == fundIdx ? 'selected' : ''}>${fundLabel}</option>`;
                                        }).join('')}
                                    </select>
                                </div>
                            `;
                        }
                        
                        currencyHtml += `
                            <div class="transaction-row-wrapper" data-tx-id="${tx.id}">
                                <div class="transaction-row ${isIncoming ? 'incoming' : 'outgoing'}">
                                    <span class="transaction-date">${date}</span>
                                    <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                                    <span class="account-badge">${tx.accountName}</span>
                                    <span class="transaction-amount ${isIncoming ? 'positive' : 'negative'}">
                                        ${isIncoming ? '+' : ''}${flag}${Math.abs(tx.amount).toFixed(2)}
                                    </span>
                                    ${createFlagButtons('transaction', tx.id, txFlag, txComment)}
                                </div>
                                <div class="analysis-item-note-section ${hasTxFlag ? '' : 'hidden'}" onclick="event.stopPropagation();">
                                    <textarea class="analysis-item-note-input" data-item-type="transaction" data-tx-id="${tx.id}" rows="2" placeholder="Add notes...">${txComment}</textarea>
                                </div>
                                ${txFundingDropdown}
                            </div>
                        `;
                    });
                    
                    largestHtml += `
                        <div class="currency-group">
                            <div class="currency-group-header">${flag} ${currency}</div>
                            ${currencyHtml}
                        </div>
                    `;
                });
            }
            
            // Only render section if we have content
            if (largestHtml) {
                html += `
                    <div class="bank-analysis-section collapsed" onclick="event.stopPropagation(); this.classList.toggle('collapsed');">
                        <div class="analysis-section-header">
                            <span class="analysis-section-title">Largest Transactions by Currency</span>
                            <span class="expand-indicator">▼</span>
                        </div>
                        <div class="analysis-section-content">
                            ${largestHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        return html;
    }
    
    generateSofPDF(autoSave = false) {
        console.log('📄 Starting SoF PDF generation...');
        const check = this.currentCheck;
        if (!check) {
            console.error('❌ No current check for SoF PDF generation');
            return;
        }
        
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.thirdfortResponse?.ref || check.transactionId || check.checkId;
        const checkType = this.getElectronicIDType(check) || check.checkType || 'Thirdfort Check';
        const matterName = check.thirdfortResponse?.name || check.matterName || '—';
        const now = new Date();
        const generatedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const generatedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        // Get SoF task details
        const outcomes = check.taskOutcomes || {};
        const sofTask = outcomes['sof:v1'];
        const bankSummary = outcomes['bank:summary'];
        const bankStatement = outcomes['bank:statement'];
        const docsBankStatement = outcomes['documents:bank-statement'];
        
        const breakdown = sofTask?.breakdown || {};
        const property = breakdown.property || {};
        const funds = breakdown.funds || [];
        
        // Get accounts and sofMatches
        const accounts = bankStatement?.breakdown?.accounts || bankSummary?.breakdown?.accounts || docsBankStatement?.breakdown?.accounts || {};
        const sofMatches = bankSummary?.breakdown?.analysis?.sof_matches || bankStatement?.breakdown?.analysis?.sof_matches || docsBankStatement?.breakdown?.analysis?.sof_matches || {};
        
        // Get red flags
        const allRedFlags = this.extractRedFlags(check);
        
        // Build property HTML
        let propertyHTML = '';
        if (property.address) {
            const addr = property.address;
            const fullAddress = `${addr.building_number || ''} ${addr.street || ''}, ${addr.town || ''}, ${addr.postcode || ''}`.trim();
            const price = property.price ? `£${(property.price / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not specified';
            const sdlt = property.stamp_duty ? `£${(property.stamp_duty / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Not specified';
            const newBuild = property.new_build ? 'Yes' : 'No';
            
            propertyHTML = `
                <div style="background: white; border-radius: 8px; border-left: 4px solid #39b549; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 24px; page-break-inside: avoid;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px;">
                        <div><strong style="color: #6c757d;">Address:</strong> ${fullAddress}</div>
                        <div><strong style="color: #6c757d;">Purchase Price:</strong> ${price}</div>
                        <div><strong style="color: #6c757d;">Stamp Duty:</strong> ${sdlt}</div>
                        <div><strong style="color: #6c757d;">New Build:</strong> ${newBuild}</div>
                    </div>
                </div>
            `;
        }
        
        // Build funding cards HTML (matching mockup exactly)
        let fundingCardsHTML = '';
        funds.forEach((fund, fundIdx) => {
            const type = fund.type || 'unknown';
            const data = fund.data || {};
            const amount = data.amount ? `£${(data.amount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Amount not specified';
            
            // Get type name
            const typeNames = {
                'fund:mortgage': 'Mortgage',
                'fund:savings': 'Savings / Own Funds',
                'fund:gift': 'Gift',
                'fund:sale:property': 'Sale of Property',
                'fund:sale:assets': 'Sale of Assets',
                'fund:inheritance': 'Inheritance',
                'fund:htb': 'Help to Buy / LISA',
                'fund:htb_lisa': 'Help to Buy / LISA',
                'fund:investment': 'Investment',
                'fund:business': 'Business Income',
                'fund:loan': 'Loan',
                'fund:other': 'Other',
                'fund:income': 'Income'
            };
            const typeName = typeNames[type] || type.replace('fund:', '').replace(/:/g, ' ').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const cleanType = type.replace('fund:', '').replace(/:/g, '-');
            const originBadge = this.getFundingOriginBadge(data.location);
            const detailMarkup = this.buildFundingDetailContent(fund, { originBadge });
            
            // Get annotations for this funding method
            const fundAnnotations = (check.sofAnnotations || []).flatMap(ann => 
                (ann.notes?.fundingMethods || []).filter(fm => fm.fundIdx == fundIdx)
            );
            const latestNote = fundAnnotations[0]?.note || '';
            const verifiedItems = fundAnnotations[0]?.verified || [];
            const transactionMarkers = fundAnnotations[0]?.transactionMarkers || {};
            const redFlagsForFund = fundAnnotations[0]?.redFlags || [];
            
            // Get related red flags from task outcomes
            const relatedFlags = this.getRelatedRedFlags(fund, allRedFlags);
            const allFundRedFlags = [...relatedFlags, ...redFlagsForFund.map(rf => {
                const flag = allRedFlags[rf.flagIdx];
                return flag ? { ...flag, status: rf.status, investigationNote: rf.note } : null;
            }).filter(f => f)];
            
            // Get matched transactions
            const matchedTxIds = this.getMatchedTransactions(type, sofMatches, fund);
            const hasSomeMatches = matchedTxIds.length > 0;
            let matchedTxs = [];
            
            // Determine card status based on red flags and notes
            const hasRedFlags = allFundRedFlags.length > 0;
            const borderColor = hasRedFlags ? '#f7931e' : '#39b549';
            const statusIconHTML = hasRedFlags 
                ? this.getStatusIconCSS('consider')
                : this.getStatusIconCSS('clear');
            
            fundingCardsHTML += `
                <div style="background: white; border-radius: 8px; border-left: 4px solid ${borderColor}; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; page-break-inside: avoid;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 14px; font-weight: 500; color: #003c71; flex: 1;">${typeName}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${originBadge || ''}
                            <span style="font-size: 14px; font-weight: bold; color: #003c71;">${amount}</span>
                        ${statusIconHTML}
                        </div>
                    </div>
                    <div style="padding: 12px 16px; border-top: 1px solid #dee2e6;">
                        ${detailMarkup}
            `;

            const labelMap = {
                'fund:gift': 'Potential Gift Deposits:',
                'fund:mortgage': 'Potential Mortgage Deposits:',
                'fund:savings': 'Verified Salary Deposits:',
                'fund:income': 'Verified Salary Deposits:',
                'fund:property_sale': 'Potential Property Sale Proceeds:',
                'fund:sale:property': 'Potential Property Sale Proceeds:',
                'fund:asset_sale': 'Potential Asset Sale Proceeds:',
                'fund:sale:assets': 'Potential Asset Sale Proceeds:',
                'fund:htb': 'Potential HTB/LISA Deposits:',
                'fund:htb_lisa': 'Potential HTB/LISA Deposits:',
                'fund:inheritance': 'Potential Inheritance Deposits:',
                'fund:loan': 'Potential Loan Deposits:',
                'fund:investment': 'Potential Investment Deposits:',
                'fund:business': 'Potential Business Income:',
                'fund:other': 'Potential Matched Transactions:'
            };
            const matchLabel = labelMap[type] || 'Potential Matched Transactions:';
            
            // Matched Transactions
            if (hasSomeMatches) {
                Object.values(accounts).forEach(acc => {
                    (acc.statement || []).forEach(tx => {
                        if (matchedTxIds.includes(tx.id)) {
                            matchedTxs.push({ ...tx, accountName: acc.account?.name || 'Account' });
                        }
                    });
                });
                
                if (matchedTxs.length > 0) {
                    fundingCardsHTML += `<div style="margin-bottom: 12px;"><div style="font-size: 12px; font-weight: bold; color: #6c757d; margin-bottom: 6px;">MATCHED TRANSACTIONS (${matchedTxs.length}):</div>`;
                    fundingCardsHTML += `<div style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">`;
                    matchedTxs.slice(0, 5).forEach(tx => {
                        const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const txMarker = transactionMarkers[tx.id];
                        const markerStyle = txMarker === 'rejected' ? 'opacity: 0.65;' : '';
                        const markerText = txMarker === 'verified' ? ' ✓ VERIFIED' : (txMarker === 'rejected' ? ' × REJECTED' : (txMarker === 'review' ? ' ? REVIEW' : ''));
                        const markerColor = txMarker === 'verified' ? '#39b549' : (txMarker === 'rejected' ? '#d32f2f' : '#f7931e');
                        
                        fundingCardsHTML += `<div style="margin-bottom: 6px; ${markerStyle}"><strong>${date}:</strong> ${tx.description || 'Transaction'} — <span style="color: #39b549;">+£${Math.abs(tx.amount).toFixed(2)}</span><span style="color: ${markerColor}; font-weight: bold; margin-left: 8px;">${markerText}</span></div>`;
                    });
                    if (matchedTxs.length > 5) {
                        fundingCardsHTML += `<div style="font-style: italic; color: #999; margin-top: 6px;">... and ${matchedTxs.length - 5} more</div>`;
                    }
                    fundingCardsHTML += `</div></div>`;
                }
            }
            if ((!hasSomeMatches || matchedTxs.length === 0) && type !== 'fund:mortgage') {
                const considerIcon = this.getTaskCheckIconCSS('CO');
                fundingCardsHTML += `
                    <div style="margin: 12px 0;">
                        <div style="font-size: 12px; font-weight: bold; color: #6c757d; margin-bottom: 6px;">${matchLabel}</div>
                        <div style="display: flex; align-items: center; gap: 6px; padding: 10px 12px; background: #fff8e6; border: 1px solid #ffd966; border-radius: 6px; font-size: 11px; color: #856404;">
                            ${considerIcon}
                            <span>No linked bank transactions detected, manual review required</span>
                        </div>
                    </div>
                `;
            }
            
            // Verification checkboxes
            if (verifiedItems.length > 0) {
                fundingCardsHTML += `<div style="margin-bottom: 12px;"><div style="font-size: 12px; font-weight: bold; color: #6c757d; margin-bottom: 6px;">VERIFICATION:</div>`;
                fundingCardsHTML += `<div style="display: flex; gap: 8px; align-items: center; font-size: 12px; flex-wrap: wrap;">`;
                verifiedItems.forEach(item => {
                    const itemLabel = item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    fundingCardsHTML += `<span style="color: #39b549;">✓</span> ${itemLabel}`;
                });
                fundingCardsHTML += `</div></div>`;
            }
            
            const docTaskKey = `documents:${cleanType}`;
            const docOutcome = check.taskOutcomes ? check.taskOutcomes[docTaskKey] : null;
            const documentCount = this.getDocumentCount(docOutcome);
            const hasDocuments = documentCount > 0;
            const pdfDocLines = [];
            const pdfDefaultReminder = 'Check the report pdf for evidence or obtain from the client and review manually';
            const pdfShouldShowManualReview = (!hasSomeMatches || matchedTxs.length === 0) && type !== 'fund:mortgage';

            if (hasDocuments) {
                const uploadedLabel = `${documentCount} document${documentCount === 1 ? '' : 's'} uploaded`;
                pdfDocLines.push({ status: 'clear', text: uploadedLabel });
            } else {
                pdfDocLines.push({ status: 'consider', text: pdfDefaultReminder });
            }

            if (pdfShouldShowManualReview) {
                pdfDocLines.push({ status: 'consider', text: 'No linked bank transactions detected, manual review required.' });
            }

            if (pdfDocLines.length === 0) {
                pdfDocLines.push({ status: hasDocuments ? 'clear' : 'consider', text: pdfDefaultReminder });
            }

            fundingCardsHTML += `
                <div class="funding-doc-status pdf">
                    ${pdfDocLines.map(line => {
                        const icon = this.getTaskCheckIconCSS(line.status === 'clear' ? 'CL' : line.status === 'fail' ? 'FA' : 'CO');
                        return `<div class="doc-status-line">${icon}<span>${line.text}</span></div>`;
                    }).join('')}
                </div>
            `;
            
            // Red Flags
            if (allFundRedFlags.length > 0) {
                allFundRedFlags.forEach(flag => {
                    const flagStatus = flag.status || 'consider';
                    const flagNote = flag.investigationNote || '';
                    const statusBadgeBg = flagStatus === 'confirmed' ? '#fff3cd' : (flagStatus === 'dismissed' ? '#d4edda' : '#f8d7da');
                    const statusBadgeColor = flagStatus === 'confirmed' ? '#856404' : (flagStatus === 'dismissed' ? '#155724' : '#721c24');
                    const statusLabel = flagStatus.charAt(0).toUpperCase() + flagStatus.slice(1);
                    
                    fundingCardsHTML += `
                        <div style="background: #fff3e0; border: 1px solid #f7931e; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <div style="width: 16px; height: 16px; border-radius: 50%; background: #d32f2f; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="color: white; font-size: 16px; font-weight: bold; line-height: 1;">−</span></div>
                                <strong style="font-size: 13px; color: #d32f2f; flex: 1;">${flag.description || 'Red Flag'}</strong>
                                <span style="padding: 3px 8px; background: ${statusBadgeBg}; border-radius: 4px; font-size: 11px; font-weight: bold; color: ${statusBadgeColor};">${statusLabel}</span>
                            </div>
                            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${flag.reason || ''}</div>
                            ${flagNote ? `<div style="font-size: 12px; color: #333;"><strong>Note:</strong> ${flagNote}</div>` : ''}
                        </div>
                    `;
                });
            }
            
            // Investigation Notes
            if (latestNote) {
                fundingCardsHTML += `
                    <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 3px solid #1d71b8;">
                        <div style="font-size: 11px; font-weight: bold; color: #6c757d; margin-bottom: 4px;">INVESTIGATION NOTES:</div>
                        <div style="font-size: 13px; color: #333;">${latestNote}</div>
                    </div>
                `;
            }
            
            fundingCardsHTML += `</div></div>`;
        });
        
        // Build detailed bank analysis (including recurring, largest transactions, flags)
        let bankAnalysisHTML = '';
        const totalAccounts = Object.keys(accounts).length;
        if (totalAccounts > 0) {
            let totalTxs = 0;
            Object.values(accounts).forEach(acc => {
                totalTxs += (acc.statement || []).length;
            });
            
            // Collect all transactions with links, comments, or flags (for summary count)
            const annotatedTransactions = [];
            Object.values(accounts).forEach(acc => {
                (acc.statement || []).forEach(tx => {
                    const txAnnotations = this.getTransactionAnnotations(tx.id, check);
                    const hasLink = txAnnotations.linkedFundingMethods && txAnnotations.linkedFundingMethods.length > 0;
                    const hasComment = txAnnotations.note && txAnnotations.note.trim() !== '';
                    const hasFlag = txAnnotations.flag && txAnnotations.flag !== '';
                    const hasMarker = txAnnotations.marker && txAnnotations.marker !== '';
                    
                    if (hasLink || hasComment || hasFlag || hasMarker) {
                        annotatedTransactions.push({
                            ...tx,
                            accountName: acc.account?.name || acc.info?.name || 'Account',
                            annotations: txAnnotations
                        });
                    }
                });
            });
            
            // Sort annotated transactions by date (newest first)
            annotatedTransactions.sort((a, b) => {
                const dateA = new Date(a.timestamp || 0);
                const dateB = new Date(b.timestamp || 0);
                return dateB - dateA;
            });
            
            // Summary header
            bankAnalysisHTML = `
                <div style="background: white; border-radius: 8px; border-left: 4px solid #39b549; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 24px;">
                    <div style="padding: 12px 16px;">
                        <div style="font-size: 13px; color: #666; margin-bottom: 12px;">
                            <div><strong>Total Accounts Linked:</strong> ${totalAccounts}</div>
                            <div><strong>Statement Period:</strong> 6 months</div>
                            <div><strong>Total Transactions Analyzed:</strong> ${totalTxs}</div>
                            <div><strong>Transactions with Links/Comments/Flags:</strong> ${annotatedTransactions.length}</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Get bank analysis from task outcome
            const analysis = bankSummary?.breakdown?.analysis || bankStatement?.breakdown?.analysis || docsBankStatement?.breakdown?.analysis;
            
            if (analysis) {
                // Build detailed analysis sections (recurring, largest, etc.)
                bankAnalysisHTML += '<div style="margin-top: 20px;">';
                
                // Recurring Payments
                if (analysis.recurring_payment_groups && analysis.recurring_payment_groups.length > 0) {
                    bankAnalysisHTML += '<div style="margin-bottom: 16px;"><div style="font-weight: bold; font-size: 14px; color: var(--primary-blue); margin-bottom: 8px;">🔄 Recurring Payments</div>';
                    analysis.recurring_payment_groups.forEach((group, gIdx) => {
                        const count = group.occurrences?.length || 0;
                        const avgAmount = group.average_amount || 0;
                        const merchant = group.merchant_name || 'Unknown';
                        bankAnalysisHTML += `<div style="padding: 8px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; font-size: 12px;">`;
                        bankAnalysisHTML += `<strong>${merchant}</strong> - ${count} payments, avg £${Math.abs(avgAmount).toFixed(2)}`;
                        bankAnalysisHTML += `</div>`;
                    });
                    bankAnalysisHTML += '</div>';
                }
                
                // Transaction Chains
                if (analysis.chain_analysis && analysis.chain_analysis.length > 0) {
                    bankAnalysisHTML += '<div style="margin-bottom: 16px;"><div style="font-weight: bold; font-size: 14px; color: var(--primary-blue); margin-bottom: 8px;">🔗 Transaction Chains</div>';
                    analysis.chain_analysis.slice(0, 5).forEach((chain, cIdx) => {
                        const count = chain.transactions?.length || 0;
                        bankAnalysisHTML += `<div style="padding: 8px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; font-size: 12px;">`;
                        bankAnalysisHTML += `<strong>Chain ${cIdx + 1}</strong> - ${count} transactions`;
                        bankAnalysisHTML += `</div>`;
                    });
                    bankAnalysisHTML += '</div>';
                }
                
                // Largest Transactions
                if (analysis.largest_individual_transactions && analysis.largest_individual_transactions.length > 0) {
                    bankAnalysisHTML += '<div style="margin-bottom: 16px;"><div style="font-weight: bold; font-size: 14px; color: var(--primary-blue); margin-bottom: 8px;">💰 Largest Transactions</div>';
                    analysis.largest_individual_transactions.slice(0, 10).forEach((tx, tIdx) => {
                        const amount = tx.amount || 0;
                        const desc = tx.description || tx.merchant_name || 'Transaction';
                        const date = tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
                        const sign = amount >= 0 ? '+' : '';
                        const amountColor = amount >= 0 ? '#39b549' : '#d32f2f';
                        bankAnalysisHTML += `<div style="padding: 8px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; font-size: 12px;">`;
                        bankAnalysisHTML += `<span style="color: ${amountColor}; font-weight: bold;">${sign}£${Math.abs(amount).toFixed(2)}</span> - ${desc} <span style="color: #6c757d;">(${date})</span>`;
                        bankAnalysisHTML += `</div>`;
                    });
                    bankAnalysisHTML += '</div>';
                }
                
                bankAnalysisHTML += '</div>';
            }
            
            // Add section for transactions with links, comments, or flags
            if (annotatedTransactions.length > 0) {
                bankAnalysisHTML += '<div style="margin-top: 24px; page-break-inside: avoid;">';
                bankAnalysisHTML += '<div style="font-weight: bold; font-size: 16px; color: var(--primary-blue); margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border-grey);">📋 Transactions with Links, Comments, or Flags</div>';
                bankAnalysisHTML += `<div style="font-size: 12px; color: #666; margin-bottom: 16px;">${annotatedTransactions.length} transaction${annotatedTransactions.length > 1 ? 's' : ''} with user actions</div>`;
                
                annotatedTransactions.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const desc = tx.description || tx.merchant_name || 'Transaction';
                    const amount = tx.amount || 0;
                    const sign = amount >= 0 ? '+' : '';
                    const amountColor = amount >= 0 ? '#39b549' : '#d32f2f';
                    const ann = tx.annotations;
                    
                    // Build badges/indicators
                    let badgesHtml = '';
                    
                    // Flags
                    if (ann.flag === 'cleared') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50; margin-right: 4px;">○ Cleared</span>';
                    } else if (ann.flag === 'suspicious') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336; margin-right: 4px;">✗ Suspicious</span>';
                    } else if (ann.flag === 'review') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; margin-right: 4px;">— Review</span>';
                    } else if (ann.flag === 'linked') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-right: 4px;">✓ Linked</span>';
                    }
                    
                    // Markers
                    if (ann.marker === 'verified' || ann.marker === 'accepted') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e8f5e9; color: #4caf50; border: 1px solid #4caf50; margin-right: 4px;">✓ Verified</span>';
                    } else if (ann.marker === 'rejected') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #ffebee; color: #f44336; border: 1px solid #f44336; margin-right: 4px;">✗ Rejected</span>';
                    } else if (ann.marker === 'review') {
                        badgesHtml += '<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #fff3e0; color: #ff9800; border: 1px solid #ff9800; margin-right: 4px;">? Review</span>';
                    }
                    
                    // Linked funding methods
                    if (ann.linkedFundingMethods && ann.linkedFundingMethods.length > 0) {
                        const typeNames = {
                            'fund:mortgage': 'Mortgage',
                            'fund:savings': 'Savings',
                            'fund:gift': 'Gift',
                            'fund:sale:property': 'Property Sale',
                            'fund:sale:assets': 'Asset Sale',
                            'fund:inheritance': 'Inheritance',
                            'fund:htb': 'Help to Buy',
                            'fund:htb_lisa': 'Help to Buy / LISA',
                            'fund:investment': 'Investment',
                            'fund:business': 'Business Income',
                            'fund:loan': 'Loan',
                            'fund:other': 'Other',
                            'fund:income': 'Income'
                        };
                        ann.linkedFundingMethods.forEach(fundIdxStr => {
                            const fund = funds[parseInt(fundIdxStr)];
                            if (fund) {
                                const fundLabel = typeNames[fund.type] || fund.type.replace('fund:', '').replace(/:/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                badgesHtml += `<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; background: #e3f2fd; color: #2196f3; border: 1px solid #2196f3; margin-right: 4px;">🔗 ${fundLabel}</span>`;
                            }
                        });
                    }
                    
                    bankAnalysisHTML += `
                        <div style="background: white; border: 1px solid #dee2e6; border-radius: 6px; padding: 12px; margin-bottom: 12px; page-break-inside: avoid;">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <div style="flex: 1;">
                                    <div style="font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px;">${desc}</div>
                                    <div style="font-size: 11px; color: #666;">${tx.accountName} • ${date}</div>
                                </div>
                                <div style="font-size: 14px; font-weight: bold; color: ${amountColor}; margin-left: 12px;">
                                    ${sign}£${Math.abs(amount).toFixed(2)}
                                </div>
                            </div>
                            ${badgesHtml ? `<div style="margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 4px;">${badgesHtml}</div>` : ''}
                            ${ann.note ? `
                                <div style="background: #fff8e6; border-left: 3px solid #ffd966; padding: 8px 10px; border-radius: 3px; margin-top: 8px;">
                                    <div style="font-size: 11px; font-weight: bold; color: #856404; margin-bottom: 4px;">COMMENT:</div>
                                    <div style="font-size: 12px; color: #856404;">${ann.note}</div>
                                </div>
                            ` : ''}
                        </div>
                    `;
                });
                
                bankAnalysisHTML += '</div>';
            }
        }
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    :root { --primary-blue: #003c71; --secondary-blue: #1d71b8; --green: #39b549; --orange: #f7931e; --red: #d32f2f; --grey: #6c757d; --light-grey: #f8f9fa; --border-grey: #dee2e6; }
                    body { font-family: 'Trebuchet MS', 'Lucida Grande', sans-serif; padding: 40px; background: white; color: #111; line-height: 1.5; font-size: 14px; }
                    .pdf-header { border-bottom: 3px solid var(--primary-blue); padding-bottom: 20px; margin-bottom: 30px; }
                    .pdf-title { font-size: 26px; font-weight: bold; color: var(--primary-blue); margin-bottom: 15px; }
                    .check-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px; }
                    .check-info-item { display: flex; gap: 8px; }
                    .check-info-label { font-weight: bold; color: var(--grey); min-width: 140px; }
                    .check-info-value { color: #333; }
                    .section-title { font-size: 18px; font-weight: bold; color: var(--primary-blue); margin: 30px 0 20px 0; padding-bottom: 8px; border-bottom: 2px solid var(--border-grey); }
                    .pdf-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--border-grey); text-align: center; font-size: 11px; color: #999; }
                    @media print { body { padding: 20px; } }
                    .funding-meta-container { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
                    .funding-meta-row { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #333; margin: 4px 0; }
                    .funding-meta-row.compact { font-size: 11px; }
                    .funding-meta-label { min-width: 110px; font-weight: 600; color: #003c71; }
                    .funding-meta-value { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; color: #333; }
                    .funding-meta-empty { font-size: 12px; font-style: italic; color: #777; margin: 6px 0; }
                    .funding-origin-badge { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 12px; background: #eef2f7; font-size: 11px; font-weight: 600; color: #003c71; }
                    .funding-bank-card { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e1e4e8; border-radius: 8px; background: #f8f9fb; margin-bottom: 12px; }
                    .funding-bank-logo { display: flex; align-items: center; justify-content: center; max-width: 200px; }
                    .funding-bank-logo img { max-height: 80px; max-width: 200px; object-fit: contain; }
                    .funding-bank-copy { display: flex; flex-direction: column; gap: 4px; }
                    .funding-bank-label { font-size: 10px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: #6c757d; }
                    .funding-bank-name { font-size: 14px; font-weight: 600; color: #003c71; }
                    .funding-section-heading { font-size: 13px; font-weight: 600; color: #003c71; margin: 12px 0 8px 0; }
                    .funding-person-card { border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom: 10px; }
                    .funding-person-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
                    .funding-person-name { font-size: 13px; font-weight: 600; color: #003c71; }
                    .funding-person-role { font-size: 11px; font-weight: 600; color: #6c757d; }
                    .income-card-list { display: grid; gap: 10px; margin-top: 10px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
                    .income-card { border: 1px solid #dbe2ea; border-radius: 6px; padding: 10px; background: #f9fbfd; }
                    .income-card.salary { background: #f1f8f5; border-color: #cfe8d6; }
                    .income-card.other { background: #f8f9fa; }
                    .income-card-title { font-size: 12px; font-weight: 600; color: #003c71; margin-bottom: 6px; }
                    .income-card-row { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #333; margin: 2px 0; }
                    .income-label { font-weight: 600; color: #6c757d; }
                    .income-value { flex: 1; text-align: right; color: #333; }
                    .funding-detail-card { border: 1px solid #e1e4e8; border-radius: 8px; padding: 12px; background: #fdfdfd; box-shadow: 0 1px 3px rgba(0,0,0,0.04); margin-bottom: 12px; }
                    .funding-detail-card-title { font-size: 13px; font-weight: 600; color: #003c71; margin-bottom: 8px; }
                    .funding-doc-status.pdf { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.08); display: flex; align-items: center; gap: 6px; }
                    .funding-doc-count-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 12px; background: #e3f2fd; font-size: 11px; font-weight: 600; color: #1976d2; margin-left: auto; }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <div class="pdf-title">Source of Funds Investigation</div>
                    <div class="check-info">
                        <div class="check-info-item"><span class="check-info-label">Check Type:</span><span class="check-info-value">${checkType}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Consumer:</span><span class="check-info-value">${checkName}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check Reference:</span><span class="check-info-value">${checkRef}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check ID:</span><span class="check-info-value">${check.checkId || check.transactionId}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Matter:</span><span class="check-info-value">${matterName}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Property:</span><span class="check-info-value">${property.address ? `${property.address.building_number || ''} ${property.address.street || ''}, ${property.address.town || ''}, ${property.address.postcode || ''}`.trim() : '—'}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Generated:</span><span class="check-info-value">${generatedDate}, ${generatedTime}</span></div>
                    </div>
                </div>
                ${propertyHTML ? `<div class="section-title">Property Information</div>${propertyHTML}` : ''}
                <div class="section-title">Funding Methods</div>
                ${fundingCardsHTML}
                ${bankAnalysisHTML ? `<div class="section-title">Bank Analysis</div>${bankAnalysisHTML}` : ''}
                <div class="pdf-footer">
                    <p>This report was generated from Thurstan Hoskin's Thirdfort ID Management System</p>
                    <p>Report ID: SOF-${Date.now()} | Page 1 of 1</p>
                </div>
            </body>
            </html>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `sof-investigation-${checkRef}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'css', avoid: 'div[style*="page-break-inside: avoid"]' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            console.log('📄 Generating SoF PDF with html2pdf...');
            html2pdf().set(opt).from(element).outputPdf('blob').then((pdfBlob) => {
                console.log('✅ SoF PDF generated:', pdfBlob.size, 'bytes');
                
                // Check if Print.js is available
                if (typeof printJS !== 'undefined') {
                    console.log('📄 Opening SoF print dialog with Print.js...');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                    
                    // Use Print.js to open print dialog with PDF
                    printJS({
                        printable: pdfUrl,
                        type: 'pdf',
                        onPrintDialogClose: () => {
                            // Clean up blob URL after print dialog closes
                            URL.revokeObjectURL(pdfUrl);
                        }
                    });
                } else {
                    // Fallback to new tab if Print.js not loaded
                    console.warn('⚠️ Print.js not loaded, opening in new tab');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                const printWindow = window.open(pdfUrl, '_blank');
                if (!printWindow) {
                    console.error('❌ Popup blocked by browser');
                    alert('PDF generated but popup was blocked. Please allow popups for this site.');
                } else {
                    // Trigger print dialogue when PDF loads
                    printWindow.addEventListener('load', () => {
                        setTimeout(() => {
                            printWindow.print();
                        }, 100);
                    });
                    }
                }
                
                // Notify parent that PDF is generated and opened (only if auto-save)
                if (autoSave) {
                    console.log('📤 Sending pdf-generated message to parent');
                    this.sendMessage('pdf-generated', { 
                        type: 'sof', 
                        checkId: check.checkId || check.transactionId 
                    });
                } else {
                    console.log('ℹ️ Manual export - not sending pdf-generated message');
                }
            }).catch(err => {
                console.error('❌ Error generating SoF PDF:', err);
                alert('Error generating SoF PDF: ' + err.message);
                // Still notify parent even on error so data can refresh (only if auto-save)
                if (autoSave) {
                    this.sendMessage('pdf-generated', { 
                        type: 'sof',
                        error: err.message 
                    });
                }
            });
        } else {
            console.error('❌ html2pdf library not loaded');
            alert('PDF library not loaded. Please refresh the page.');
            // Notify parent so data can refresh (only if auto-save)
            if (autoSave) {
                this.sendMessage('pdf-generated', { 
                    type: 'sof',
                    error: 'html2pdf not loaded' 
                });
            }
        }
    }
    
    generatePepDismissalsPDF(autoSave = false) {
        const check = this.currentCheck;
        if (!check) return;
        
        const outcomes = check.taskOutcomes || {};
        const checkDismissals = check.pepDismissals || [];
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.thirdfortResponse?.ref || check.transactionId || check.checkId;
        const checkType = this.getElectronicIDType(check) || check.checkType || 'Thirdfort Check';
        const now = new Date();
        const generatedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const generatedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        
        // Collect all dismissals from all sources (check.pepDismissals and all monitoring updates)
        const allDismissals = [...checkDismissals];
        const pepUpdates = check.pepSanctionsUpdates || [];
        pepUpdates.forEach(update => {
            const reportJson = update.reportJson || {};
            const breakdown = reportJson.breakdown || {};
            const dismissals = breakdown.dismissals || [];
            // Add dismissals from monitoring updates (they may not be in check.pepDismissals yet)
            dismissals.forEach(dismissal => {
                // Only add if not already in allDismissals (avoid duplicates)
                if (!allDismissals.some(d => d.hitId === dismissal.id && d.reportId === update.reportId)) {
                    allDismissals.push({
                        hitId: dismissal.id,
                        reportId: update.reportId,
                        hitName: dismissal.name || 'Unknown',
                        reason: dismissal.reason || 'Dismissed in monitoring update',
                        timestamp: update.timestamp,
                        user: 'System',
                        userName: 'System'
                    });
                }
            });
        });
        
        // Build dismissals map for quick lookup (keyed by hitId, not reportId)
        const dismissalsMap = {};
        allDismissals.forEach(d => {
            // Use hitId as key, but keep the most recent dismissal if multiple exist
            if (!dismissalsMap[d.hitId] || new Date(d.timestamp) > new Date(dismissalsMap[d.hitId].timestamp || 0)) {
                dismissalsMap[d.hitId] = d;
            }
        });
        
        // Collect all unique PEP/Sanctions hits from all sources
        const allHits = [];
        const seenHitIds = new Set(); // Track unique hit IDs to avoid duplicates
        
        // Get hits from original task outcomes
        const pepsTask = outcomes['peps'] || outcomes['screening:lite'] || outcomes['screening'];
        const sanctionsTask = outcomes['sanctions'];
        const companyPepsTask = outcomes['company:peps'];
        const companySanctionsTask = outcomes['company:sanctions'];
        
        // Individual PEPs from original task
        if (pepsTask?.breakdown?.hits) {
            pepsTask.breakdown.hits.forEach(hit => {
                if (!seenHitIds.has(hit.id)) {
                    seenHitIds.add(hit.id);
                    const dismissal = dismissalsMap[hit.id];
                    allHits.push({
                        id: hit.id,
                        name: hit.name,
                        aka: hit.aka?.join(', ') || 'None',
                        type: 'PEP',
                        countries: hit.countries?.join(', ') || 'N/A',
                        flagTypes: hit.flag_types?.join(', ') || 'N/A',
                        score: hit.score || 'N/A',
                        dismissed: !!dismissal,
                        dismissal: dismissal
                    });
                }
            });
        }
        
        // Sanctions from original task
        if (sanctionsTask?.breakdown?.hits) {
            sanctionsTask.breakdown.hits.forEach(hit => {
                if (!seenHitIds.has(hit.id)) {
                    seenHitIds.add(hit.id);
                    const dismissal = dismissalsMap[hit.id];
                    allHits.push({
                        id: hit.id,
                        name: hit.name,
                        aka: hit.aka?.join(', ') || 'None',
                        type: 'Sanctions',
                        countries: hit.countries?.join(', ') || 'N/A',
                        flagTypes: hit.flag_types?.join(', ') || 'N/A',
                        score: hit.score || 'N/A',
                        dismissed: !!dismissal,
                        dismissal: dismissal
                    });
                }
            });
        }
        
        // Company Sanctions from original task
        if (companySanctionsTask?.breakdown?.hits) {
            companySanctionsTask.breakdown.hits.forEach(hit => {
                if (!seenHitIds.has(hit.id)) {
                    seenHitIds.add(hit.id);
                    const dismissal = dismissalsMap[hit.id];
                    allHits.push({
                        id: hit.id,
                        name: hit.name,
                        aka: hit.aka?.join(', ') || 'None',
                        type: 'Company Sanctions',
                        countries: hit.countries?.join(', ') || 'N/A',
                        flagTypes: hit.flag_types?.join(', ') || 'N/A',
                        score: hit.score || 'N/A',
                        dismissed: !!dismissal,
                        dismissal: dismissal
                    });
                }
            });
        }
        
        // Get hits from all monitoring updates
        pepUpdates.forEach(update => {
            const reportJson = update.reportJson || {};
            const breakdown = reportJson.breakdown || {};
            const hits = breakdown.hits || [];
            
            hits.forEach(hit => {
                if (!seenHitIds.has(hit.id)) {
                    seenHitIds.add(hit.id);
                    const dismissal = dismissalsMap[hit.id];
                    
                    // Determine hit type from flag_types
                    let hitType = 'PEP';
                    if (hit.flag_types && hit.flag_types.some(f => f.includes('sanction'))) {
                        hitType = 'Sanctions';
                    } else if (hit.flag_types && hit.flag_types.some(f => f.includes('adverse-media'))) {
                        hitType = 'Adverse Media';
                    }
                    
                    allHits.push({
                        id: hit.id,
                        name: hit.name,
                        aka: hit.aka?.join(', ') || 'None',
                        type: hitType,
                        countries: hit.countries?.join(', ') || 'N/A',
                        flagTypes: hit.flag_types?.join(', ') || 'N/A',
                        score: hit.score || 'N/A',
                        dismissed: !!dismissal,
                        dismissal: dismissal
                    });
                }
            });
        });
        
        // Calculate summary
        const totalHits = allHits.length;
        const dismissedCount = allHits.filter(h => h.dismissed).length;
        const outstandingCount = totalHits - dismissedCount;
        
        // Get report ID from most recent monitoring update or original task
        let reportId = 'N/A';
        if (pepUpdates.length > 0) {
            const mostRecentUpdate = pepUpdates[pepUpdates.length - 1];
            reportId = mostRecentUpdate.reportId || mostRecentUpdate.reportJson?.id || 'N/A';
        } else {
            reportId = pepsTask?.id || sanctionsTask?.id || companySanctionsTask?.id || 'N/A';
        }
        const monitoringStatus = pepsTask?.monitored || check.pepMonitoring ? 'Monitoring Active' : 'Monitoring Inactive';
        
        // Build hit cards HTML
        let hitCardsHTML = '';
        allHits.forEach(hit => {
            const borderColor = hit.dismissed ? '#39b549' : '#f7931e';
            const statusBadgeBg = hit.dismissed ? '#d4edda' : '#fff3cd';
            const statusBadgeColor = hit.dismissed ? '#155724' : '#856404';
            const statusLabel = hit.dismissed ? 'DISMISSED' : 'ACTIVE';
            const statusIcon = hit.dismissed ? this.getStatusIconCSS('clear') : this.getStatusIconCSS('consider');
            
            hitCardsHTML += `
                <div style="background: white; border-radius: 8px; border-left: 4px solid ${borderColor}; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-bottom: 16px; page-break-inside: avoid;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div style="font-size: 14px; font-weight: 500; color: #003c71; flex: 1;">${hit.name}</div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; background: ${statusBadgeBg}; color: ${statusBadgeColor};">${statusLabel}</span>
                            ${statusIcon}
                        </div>
                    </div>
                    <div style="padding: 8px 16px; border-top: 1px solid #dee2e6;">
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; color: #666; margin-bottom: 12px;">
                            <div><strong>Type:</strong> ${hit.type}</div>
                            <div><strong>Countries:</strong> ${hit.countries}</div>
                            <div><strong>Match Score:</strong> ${hit.score}</div>
                            <div><strong>Flag Types:</strong> ${hit.flagTypes}</div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <div style="font-size: 11px; font-weight: bold; color: #6c757d; margin-bottom: 4px;">ALSO KNOWN AS:</div>
                            <div style="font-size: 12px; color: #333;">${hit.aka}</div>
                        </div>
            `;
            
            // Add dismissal info if dismissed
            if (hit.dismissed && hit.dismissal) {
                const dismissDate = new Date(hit.dismissal.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const dismissTime = new Date(hit.dismissal.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                
                hitCardsHTML += `
                        <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 6px; padding: 12px; margin-top: 12px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <div style="width: 16px; height: 16px; border-radius: 50%; background: #39b549; display: flex; align-items: center; justify-content: center; flex-shrink: 0;"><span style="color: white; font-size: 12px; font-weight: bold; line-height: 1;">✓</span></div>
                                <strong style="font-size: 13px; color: #155724;">Dismissal Confirmed</strong>
                            </div>
                            <div style="font-size: 12px; color: #155724; margin-bottom: 6px;">
                                <strong>Reason:</strong> ${hit.dismissal.reason}
                            </div>
                            <div style="font-size: 11px; color: #155724;">
                                <strong>Dismissed by:</strong> ${hit.dismissal.userName || hit.dismissal.user}<br>
                                <strong>Date:</strong> ${dismissDate}, ${dismissTime}
                            </div>
                        </div>
                `;
            }
            
            hitCardsHTML += `
                    </div>
                </div>
            `;
        });
        
        // Build summary card
        const summaryBorderColor = outstandingCount === 0 ? '#39b549' : '#f7931e';
        const summaryMessage = outstandingCount === 0 
            ? '✓ All hits have been reviewed and dismissed'
            : `⚠️ ${outstandingCount} hit${outstandingCount > 1 ? 's' : ''} require${outstandingCount === 1 ? 's' : ''} review`;
        const summaryBgColor = outstandingCount === 0 ? '#e8f5e9' : '#fff3e0';
        const summaryTextColor = outstandingCount === 0 ? '#155724' : '#856404';
        
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    :root { --primary-blue: #003c71; --secondary-blue: #1d71b8; --green: #39b549; --orange: #f7931e; --red: #d32f2f; --grey: #6c757d; --light-grey: #f8f9fa; --border-grey: #dee2e6; }
                    body { font-family: 'Trebuchet MS', 'Lucida Grande', sans-serif; padding: 40px; background: white; color: #111; line-height: 1.5; font-size: 14px; }
                    .pdf-header { border-bottom: 3px solid var(--primary-blue); padding-bottom: 20px; margin-bottom: 30px; page-break-after: avoid; }
                    .pdf-title { font-size: 26px; font-weight: bold; color: var(--primary-blue); margin-bottom: 15px; }
                    .check-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px; }
                    .check-info-item { display: flex; gap: 8px; }
                    .check-info-label { font-weight: bold; color: var(--grey); min-width: 140px; }
                    .check-info-value { color: #333; }
                    .section-title { font-size: 18px; font-weight: bold; color: var(--primary-blue); margin: 30px 0 20px 0; padding-bottom: 8px; border-bottom: 2px solid var(--border-grey); page-break-after: avoid; }
                    .hit-card { page-break-inside: avoid; margin-bottom: 16px; }
                    .pdf-footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--border-grey); text-align: center; font-size: 11px; color: #999; page-break-before: avoid; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="pdf-header">
                    <div class="pdf-title">PEP & Sanctions Screening</div>
                    <div class="check-info">
                        <div class="check-info-item"><span class="check-info-label">Check Type:</span><span class="check-info-value">${checkType}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Consumer:</span><span class="check-info-value">${checkName}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check Reference:</span><span class="check-info-value">${checkRef}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Check ID:</span><span class="check-info-value">${check.checkId || check.transactionId}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Report ID:</span><span class="check-info-value">${reportId}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Generated:</span><span class="check-info-value">${generatedDate}, ${generatedTime}</span></div>
                        <div class="check-info-item"><span class="check-info-label">Status:</span><span class="check-info-value">${monitoringStatus}</span></div>
                    </div>
                </div>
                <div class="section-title">PEP/Sanctions Screening Results</div>
                ${hitCardsHTML}
                <div style="background: white; border-radius: 8px; border-left: 4px solid ${summaryBorderColor}; padding: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); margin-top: 24px; page-break-inside: avoid;">
                    <div style="padding: 12px 16px;">
                        <h4 style="font-size: 14px; font-weight: bold; color: #003c71; margin-bottom: 12px;">Screening Summary</h4>
                        <div style="font-size: 13px; color: #666; margin-bottom: 8px;">
                            <div><strong>Total Hits:</strong> ${totalHits}</div>
                            <div><strong>Dismissed:</strong> ${dismissedCount}</div>
                            <div><strong>Outstanding:</strong> ${outstandingCount}</div>
                        </div>
                        <div style="background: ${summaryBgColor}; padding: 10px; border-radius: 4px; border-left: 3px solid ${summaryBorderColor}; margin-top: 12px;">
                            <div style="font-size: 12px; color: ${summaryTextColor}; font-weight: bold;">${summaryMessage}</div>
                        </div>
                    </div>
                </div>
                <div class="pdf-footer">
                    <p>This report was generated from Thurstan Hoskin's Thirdfort ID Management System</p>
                    <p>Report ID: PEP-${Date.now()} | Page 1 of 1</p>
                </div>
            </body>
            </html>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `pep-screening-${checkName.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: 'css', avoid: 'div[style*="page-break-inside: avoid"]' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            console.log('📄 Generating PEP dismissals PDF with html2pdf...');
            // Generate PDF as blob and open in print dialog
            html2pdf().set(opt).from(element).outputPdf('blob').then((pdfBlob) => {
                console.log('✅ PEP dismissals PDF generated:', pdfBlob.size, 'bytes');
                
                // Check if Print.js is available
                if (typeof printJS !== 'undefined') {
                    console.log('📄 Opening PEP print dialog with Print.js...');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                    
                    // Use Print.js to open print dialog with PDF
                    printJS({
                        printable: pdfUrl,
                        type: 'pdf',
                        onPrintDialogClose: () => {
                            // Clean up blob URL after print dialog closes
                            URL.revokeObjectURL(pdfUrl);
                        }
                    });
                } else {
                    // Fallback to new tab if Print.js not loaded
                    console.warn('⚠️ Print.js not loaded, opening in new tab');
                    const pdfUrl = URL.createObjectURL(pdfBlob);
                const printWindow = window.open(pdfUrl, '_blank');
                if (!printWindow) {
                    console.error('❌ Popup blocked by browser');
                    alert('PDF generated but popup was blocked. Please allow popups for this site.');
                } else {
                    // Trigger print dialogue when PDF loads
                    printWindow.addEventListener('load', () => {
                        setTimeout(() => {
                            printWindow.print();
                        }, 100);
                    });
                    }
                }
                
                // Notify parent that PDF is generated and opened (only if auto-save)
                if (autoSave) {
                    console.log('📤 Sending pdf-generated message to parent');
                    this.sendMessage('pdf-generated', { 
                        type: 'pep-dismissal',
                        checkId: check.checkId || check.transactionId 
                    });
                } else {
                    console.log('ℹ️ Manual export - not sending pdf-generated message');
                }
            }).catch(err => {
                console.error('❌ Error generating PEP dismissals PDF:', err);
                alert('Error generating PDF: ' + err.message);
                // Still notify parent even on error so data can refresh (only if auto-save)
                if (autoSave) {
                    this.sendMessage('pdf-generated', { 
                        type: 'pep-dismissal',
                        error: err.message 
                    });
                }
            });
        } else {
            console.error('❌ html2pdf library not loaded');
            alert('PDF library not loaded. Please refresh the page.');
            // Notify parent so data can refresh (only if auto-save)
            if (autoSave) {
                this.sendMessage('pdf-generated', { 
                    type: 'pep-dismissal',
                    error: 'html2pdf not loaded' 
                });
            }
        }
    }
}

// Global toggle functions for collapsible annotation cards
function toggleSofAnnotationCard(event, idx) {
    event.stopPropagation();
    const card = document.querySelector(`[data-sof-annotation-idx="${idx}"]`);
    if (card) {
        card.classList.toggle('collapsed');
    }
}

function toggleBankReviewCard(event, idx) {
    event.stopPropagation();
    const card = document.querySelector(`[data-bank-review-idx="${idx}"]`);
    if (card) {
        card.classList.toggle('collapsed');
    }
}


let manager;

document.addEventListener('DOMContentLoaded', () => {
    manager = new ThirdfortChecksManager();
    window.manager = manager; // Make accessible globally for inline onclick handlers
    window.thirdfortManager = manager; // Keep for backwards compatibility
});



