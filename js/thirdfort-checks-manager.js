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
        
        // DOM elements
        this.loadingState = document.getElementById('loading-state');
        this.listView = document.getElementById('list-view');
        this.detailView = document.getElementById('detail-view');
        this.checksList = document.getElementById('checks-list');
        
        // Detail view elements
        this.backBtn = document.getElementById('back-btn');
        this.detailHeader = document.getElementById('detail-header');
        this.monitoringCard = document.getElementById('monitoring-card');
        this.abortCard = document.getElementById('abort-card');
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
        
        console.log('📨 Message received:', type, data);
        
        switch (type) {
            case 'checks-data':
                // Set mode (default to 'edit' if not specified)
                this.mode = data.mode || 'edit';
                console.log(`🔒 Mode set to: ${this.mode}`);
                this.loadChecks(data.checks || []);
                break;
            case 'error':
                console.error('❌ Error from parent:', data.message);
                this.showError(data.message);
                break;
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
            // Empty state uses list-view container with message
            this.checksList.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">No Thirdfort checks found</div>';
            this.listView.classList.remove('hidden');
        } else if (view === 'list') {
            this.listView.classList.remove('hidden');
        } else if (view === 'detail') {
            this.detailView.classList.remove('hidden');
        }
        
        // Step 3: Update state
        this.currentView = view;
    }
    
    showListView() {
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
        
        if (check.hasMonitoring) {
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
        
        // CLEAR/CONSIDER tag (only if closed AND PDF ready)
        if (check.status === 'closed' && check.pdfReady) {
            const tag = document.createElement('span');
            tag.className = `outcome-tag ${check.hasAlerts ? 'consider' : 'clear'}`;
            tag.textContent = check.hasAlerts ? 'CONSIDER' : 'CLEAR';
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
        
        // Render header
        this.renderDetailHeader(check);
        
        // Render monitoring card (if applicable)
        this.renderMonitoringCard(check);
        
        // Render client/company details
        this.renderDetailsCard(check);
        
        // Render document details (IDV and electronic-id with detailed properties)
        if (check.checkType === 'idv' || check.checkType === 'electronic-id') {
            this.renderDocumentDetailsCard(check);
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
            // Only show CLEAR/CONSIDER if PDF is ready, otherwise show PROCESSING
            if (check.pdfReady) {
                statusTag = check.hasAlerts 
                    ? '<span class="status-tag consider">CONSIDER</span>' 
                    : '<span class="status-tag clear">CLEAR</span>';
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
        
        const pepMonIcon = check.hasMonitoring ? '<span class="pep-badge" style="margin-right: 8px;"></span>' : '';
        
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
        
        // Get Thirdfort URL
        const env = 'sandbox'; // TODO: Make this dynamic
        const baseUrl = env === 'production' ? 'https://app.thirdfort.io' : 'https://sandbox.thirdfort.io';
        const thirdfortUrl = check.transactionId 
            ? `${baseUrl}/transactions/${check.transactionId}`
            : `${baseUrl}/checks/${check.checkId}`;
        
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
        
        this.detailsCard.innerHTML = detailsContent;
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
            // Se's structure - build from first/last
            const fullName = [idvProperties.first_name, idvProperties.last_name].filter(Boolean).join(' ');
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
        
        let updatesHtml = '<div class="pep-updates-header">PEP & Sanctions Updates</div>';
        
        // Reverse to show most recent first
        [...pepUpdates].reverse().forEach((update, index) => {
            const isCleared = update.outcome === 'clear';
            const title = isCleared ? 'All Hits Dismissed' : 'Updated PEP/Sanctions Screening';
            const tag = isCleared ? '<span class="outcome-tag clear">CLEAR</span>' : '<span class="outcome-tag consider">CONSIDER</span>';
            const hitCount = update.matchCount || 0;
            const subtitle = isCleared ? '' : `<div class="pep-update-subtitle">${hitCount} new hit${hitCount > 1 ? 's' : ''} for review</div>`;
            const date = new Date(update.timestamp).toLocaleDateString('en-GB');
            
            const matches = update.taskOutcomes?.peps?.data?.matches || 
                           update.taskOutcomes?.sanctions?.data?.matches || [];
            
            let hitsHtml = '';
            if (matches.length > 0 && !isCleared) {
                hitsHtml = '<div class="pep-hits-details">';
                matches.forEach((hit, hitIndex) => {
                    // PEP fields: name, position, country, relationship
                    // Sanctions fields: name, sanctions_list, country, reason
                    const hitName = hit.name || 'Unknown';
                    const hitType = hit.position || hit.sanctions_list || 'Match type unavailable';
                    const hitCountry = hit.country || '';
                    const hitRelationship = hit.relationship || ''; // For PEP (direct/indirect)
                    const hitReason = hit.reason || ''; // For sanctions
                    const hitDetails = hitRelationship || hitReason || '';
                    
                    // Determine risk level (1-4, or critical for sanctions)
                    const riskLevel = this.calculateRiskLevel(hit, update.type);
                    
                    hitsHtml += `
                        <div class="pep-hit-item">
                            <div class="pep-hit-row">
                                <div class="pep-hit-header">${String.fromCharCode(65 + hitIndex)}) ${hitName}</div>
                                ${riskLevel}
                            </div>
                            <div class="pep-hit-type-row">
                                <span class="pep-hit-type">${hitType}</span>
                            </div>
                            ${hitDetails || hitCountry ? `
                            <div class="pep-hit-details">
                                ${hitDetails ? `<div class="pep-hit-label">Details:</div><div class="pep-hit-value">${hitDetails}</div>` : ''}
                                ${hitCountry ? `<div class="pep-hit-label">Country:</div><div class="pep-hit-value">${hitCountry}</div>` : ''}
                            </div>
                            ` : ''}
                        </div>
                    `;
                });
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
                            <button class="pep-report-btn" onclick="event.stopPropagation(); manager.viewPDF('${update.s3Key}')" title="View PEP/Sanctions Report">
                                <svg viewBox="0 0 24 24" fill="#1d71b8">
                                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                                </svg>
                            </button>
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
            
            if (flagType === 'Gifts Received') {
                flagsContent += this.renderGiftFlag(flag, taskOutcomes, check);
            } else if (flagType === 'Declared savings > actual savings' || flagType.includes('savings')) {
                flagsContent += this.renderSavingsFlag(flag, taskOutcomes, check);
            } else if (flagType === 'No Mortgage Used') {
                flagsContent += this.renderNoMortgageFlag(flag, taskOutcomes);
            } else if (flagType === 'Cryptocurrency Funding') {
                flagsContent += this.renderCryptoFlag(flag, taskOutcomes);
            } else if (flagType === 'Funds from Overseas') {
                flagsContent += this.renderOverseasFlag(flag, taskOutcomes);
            } else if (flagType.includes('cash deposit')) {
                flagsContent += this.renderCashDepositFlag(flag, taskOutcomes);
            } else {
                // Generic flag rendering
                flagsContent += this.renderGenericFlag(flag);
            }
        });
        
        // Wrap in task card format (with red status icon)
        const redStatusIcon = `<svg class="task-status-icon" viewBox="0 0 300 300"><path fill="#d32f2f" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        
        let flagsHtml = `
            <div class="task-card consider" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Red Flags</div>
                    ${redStatusIcon}
                </div>
                <div class="task-summary-inline">${totalFlags} Red ${flagWord} identified</div>
                <div class="task-details">
                    ${flagsContent}
                </div>
            </div>
        `;
        
        this.redFlagsCard.innerHTML = flagsHtml;
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
            
            // Check for matched bank transactions in bank:summary, bank:statement, and documents:bank-statement
            const bankSummary = taskOutcomes['bank:summary'];
            const bankStatement = taskOutcomes['bank:statement'];
            const docsBankStatement = taskOutcomes['documents:bank-statement'];
            
            // Get sof_matches from any source
            const sofMatches = bankSummary?.breakdown?.analysis?.sof_matches ||
                              bankStatement?.breakdown?.analysis?.sof_matches ||
                              docsBankStatement?.breakdown?.analysis?.sof_matches ||
                              {};
            
            // Get accounts for transaction lookup
            const accounts = bankStatement?.breakdown?.accounts || 
                           bankSummary?.breakdown?.accounts || 
                           docsBankStatement?.breakdown?.accounts || 
                           {};
            
            // Check for gift transaction matches (gift key contains array of transaction IDs)
            if (sofMatches.gift && sofMatches.gift.length > 0) {
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
                
                // Show matched gift transactions using same format as SOF cards
                sofMatches.gift.forEach(txId => {
                    const tx = getTransactionById(txId);
                    if (tx) {
                        const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const currencySymbol = '£';
                        const txAmount = tx.amount >= 0 ? '+' : '';
                        
                        html += `
                            <div class="matched-tx-row">
                                <span class="matched-tx-date">${date}</span>
                                <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Gift'}</span>
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
        
        // Check for matched salary transactions (from SOF analysis)
        const sofMatches = bankStatement?.breakdown?.analysis?.sof_matches ||
                          bankSummary?.breakdown?.analysis?.sof_matches ||
                          docsBankStatement?.breakdown?.analysis?.sof_matches ||
                          {};
        
        if (sofMatches.salary_transactions && sofMatches.salary_transactions.length > 0) {
            html += `<div class="matched-transactions-section" style="margin-top: 16px;">`;
            html += `<div class="matched-tx-label">Verified Salary Deposits:</div>`;
            
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
            
            // Show matched salary transactions using same format as SOF cards
            sofMatches.salary_transactions.forEach(txId => {
                const tx = getTransactionById(txId);
                if (tx) {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const currencySymbol = '£'; // Use GBP symbol
                    const txAmount = tx.amount >= 0 ? '+' : '';
                    
                    html += `
                        <div class="matched-tx-row">
                            <span class="matched-tx-date">${date}</span>
                            <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Salary'}</span>
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
        const isOpen = check.status === 'open' || check.status === 'processing';
        
        // For open checks, show minimized task cards based on requested tasks
        if (isOpen && Object.keys(taskOutcomes).length === 0) {
            const requestTasks = check.thirdfortResponse?.request?.tasks || check.tasks || [];
            
            if (requestTasks.length === 0) {
                this.tasksSection.innerHTML = '';
                return;
            }
            
            let tasksHtml = '<div class="tasks-open-header">Requested Tasks (Processing)</div>';
            
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
                tasksHtml += this.createOpenTaskCard(displayType);
            });
            
            this.tasksSection.innerHTML = tasksHtml;
            return;
        }
        
        // For closed checks or checks with outcomes
        if (Object.keys(taskOutcomes).length === 0) {
            this.tasksSection.innerHTML = '';
            return;
        }
        
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
            'documents:poa', 'documents:poo', 'documents:other',
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
    
    createOpenTaskCard(taskType) {
        const taskTitle = this.getTaskTitle(taskType);
        
        return `
            <div class="task-card open-task non-expandable">
                <div class="task-header">
                    <div class="task-title">${taskTitle}</div>
                    <svg class="task-status-icon" viewBox="0 0 300 300">
                        <path fill="#999" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/>
                        <circle cx="150" cy="150" r="30" fill="#fff"/>
                    </svg>
                </div>
                <div class="task-summary-inline">Task in progress</div>
            </div>
        `;
    }
    
    renderChainColumn(chain, flag) {
        let html = `<div class="chain-column">`;
        
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
        
        html += `</div>`;
        return html;
    }
    
    createBankAnalysisSections(analysis, accounts = {}, sofTask = null) {
        // Create analysis sections: repeating transactions, large one-offs, SoF matches
        if (!analysis) return '';
        
        let html = '';
        
        // Extract SoF funding details for linking
        const sofFunds = sofTask?.breakdown?.funds || [];
        
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
                    incomingHtml += `
                        <div class="transaction-row incoming">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="account-badge">${tx.accountName}</span>
                            <span class="transaction-amount positive">${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                });
                
                let outgoingHtml = '';
                unmatchedOut.forEach(tx => {
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    outgoingHtml += `
                        <div class="transaction-row outgoing">
                            <span class="transaction-date">${date}</span>
                            <span class="transaction-description">${tx.description || tx.merchant_name || 'Transaction'}</span>
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
                
                repeatingHtml += `
                    <div class="analysis-item-card">
                        <div class="analysis-card-header">
                            <div class="analysis-card-title">
                                ${currencySymbol}${Math.abs(amount).toFixed(2)} × ${frequency}
                            </div>
                            <div class="analysis-card-meta">
                                ${accountsSet.length > 1 ? `Between: ${accountsSet.join(' ↔ ')}` : `Account: ${accountsSet[0]}`}
                            </div>
                        </div>
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
            
            for (const [sofType, txIds] of Object.entries(analysis.sof_matches)) {
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
                        'fund:asset_sale': 'asset_sale',
                        'fund:htb_lisa': 'htb_lisa',
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
                        const docText = hasDoc ? 'Evidence document uploaded' : 'Ensure the gifter undergoes their own AML, ID and SoF/SoW Checks';
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
                
                let txListHtml = '';
                txIds.forEach(txId => {
                    const tx = getTransactionById(txId);
                    if (!tx) return;
                    
                    const date = new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    const amount = tx.amount;
                    const amountClass = amount >= 0 ? 'positive' : 'negative';
                    const sign = amount >= 0 ? '+' : '';
                    const currencySymbol = this.getCurrencyFlag(tx.currency || 'GBP');
                    
                    txListHtml += `
                        <div class="sof-match-tx-row">
                            <span class="sof-match-date">${date}</span>
                            <span class="sof-match-desc">${tx.description || tx.merchant_name || 'Transaction'}</span>
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
        
        return html;
    }
    
    createBiggestTransactionsSection(summaryByCcy, accounts = {}) {
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
                
                incomingHtml += `
                    <div class="transaction-row incoming">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${description}</span>
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
                
                outgoingHtml += `
                    <div class="transaction-row outgoing">
                        <span class="transaction-date">${date}</span>
                        <span class="transaction-description">${description}</span>
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
        
        // Build checks HTML
        let checksHtml = '<div class="task-checks-grid">';
        
        if (hasSummary) {
            // Bank linking completed - show detailed analysis
            const summaryData = bankSummary.data || {};
            const breakdown = bankSummary.breakdown || {};
            
            checksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('CL')}
                    <span class="task-check-text">Bank linking completed via Open Banking</span>
                </div>
            `;
            
            // Show any red flags or analysis results
            if (breakdown.red_flags && breakdown.red_flags.length > 0) {
                breakdown.red_flags.forEach(flag => {
                    checksHtml += `
                        <div class="task-check-item indented">
                            ${this.getTaskCheckIcon('CO')}
                            <span class="task-check-text">${flag}</span>
                        </div>
                    `;
                });
            }
        }
        
        if (hasStatement && !hasSummary) {
            // PDF upload fallback
            checksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('CO')}
                    <span class="task-check-text">Client declined Bank linking but uploaded Statements for manual review</span>
                </div>
            `;
        }
        
        if (!hasSummary && !hasStatement) {
            checksHtml += `
                <div class="task-check-item">
                    ${this.getTaskCheckIcon('AL')}
                    <span class="task-check-text">Bank information not provided</span>
                </div>
            `;
        }
        
        checksHtml += '</div>';
        
        // Add linked accounts section - check both summary and statement data
        let accountsHtml = '';
        let accounts = {};
        
        // Try to get accounts from bank:statement first (has transaction data)
        if (hasStatement && bankStatement.breakdown && bankStatement.breakdown.accounts) {
            accounts = bankStatement.breakdown.accounts;
        }
        // Also check bank:summary for accounts
        else if (hasSummary && bankSummary.breakdown && bankSummary.breakdown.accounts) {
            accounts = bankSummary.breakdown.accounts;
        }
        
        if (Object.keys(accounts).length > 0) {
            accountsHtml = '<div class="bank-accounts-container">';
            accountsHtml += '<div class="bank-accounts-title">Linked Accounts</div>';
            
            for (const [accountId, accountData] of Object.entries(accounts)) {
                accountsHtml += this.createBankAccountCard(accountId, accountData);
            }
            
            accountsHtml += '</div>';
        }
        
        // Add biggest transactions by currency section
        let biggestTransactionsHtml = '';
        const summaryByCcy = (hasSummary && bankSummary.breakdown && bankSummary.breakdown.summary && bankSummary.breakdown.summary.by_ccy) 
            ? bankSummary.breakdown.summary.by_ccy 
            : null;
        
        if (summaryByCcy && Object.keys(summaryByCcy).length > 0) {
            biggestTransactionsHtml = this.createBiggestTransactionsSection(summaryByCcy, accounts);
        }
        
        // Add analysis sections if available
        let analysisHtml = '';
        if (bankStatement?.breakdown?.analysis) {
            analysisHtml = this.createBankAnalysisSections(bankStatement.breakdown.analysis, accounts, sofTask);
        }
        
        // Add annotations display if check provided
        const annotationsHtml = check ? this.renderTaskAnnotations('bank', check) : '';
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Bank Summary</div>
                    ${statusIcon}
                </div>
                ${inlineWarning ? `<div class="task-summary-inline">${inlineWarning}</div>` : ''}
                <div class="task-details">
                    ${checksHtml}
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
        // Map currency codes to country flags
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
    
    createBankAccountCard(accountId, accountData) {
        // Handle both possible data structures - nested 'info' or direct properties
        const info = accountData.info || accountData;
        const number = info.number || {};
        const balance = info.balance || {};
        const provider = info.provider || {};
        const accountName = info.name || 'Bank Account';
        const accountType = info.type || 'TRANSACTION';
        const currency = info.currency || balance.currency || 'GBP';
        const statement = accountData.statement || [];
        
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
        
        // Transaction count
        const txCount = statement.length;
        
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
        
        return `
            <div class="bank-account-card collapsed" data-account-data="${accountDataJson}" onclick="event.stopPropagation();">
                <!-- Collapsed/Minimized Header -->
                <div class="account-collapsed-header" onclick="event.stopPropagation(); this.closest('.bank-account-card').classList.toggle('collapsed');">
                    <div class="account-header-left">
                        ${bankLogo ? bankLogo : ''}
                        <span class="account-collapsed-text">${collapsedTextHtml}</span>
                    </div>
                    ${txCount > 0 ? `
                        <button class="view-statement-mini-btn" onclick="event.stopPropagation(); window.thirdfortManager.showBankStatement('${accountId}', this.closest('.bank-account-card').dataset.accountData);">
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
    
    showBankStatement(accountId, accountDataStr) {
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
        
        // Sort transactions by timestamp (oldest first for running balance calculation)
        const sortedTransactions = [...statement].sort((a, b) => 
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
            
            transactionsHtml += `
                <div class="statement-transaction-row ${amountClass}">
                    <div class="statement-tx-date">${date}</div>
                    <div class="statement-tx-description">${description}</div>
                    <div class="statement-tx-out">${amountOut ? currencySymbol + amountOut : '—'}</div>
                    <div class="statement-tx-in">${amountIn ? currencySymbol + amountIn : '—'}</div>
                    <div class="statement-tx-balance">${currencySymbol}${runningBal}</div>
                </div>
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
                        <button class="statement-close-btn" onclick="this.closest('.bank-statement-lightbox').remove()">✕</button>
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
    
    createFundingSourceCard(fund, check, index, sofMatches = {}, accounts = {}) {
        const type = fund.type || 'unknown';
        const data = fund.data || {};
        const amount = data.amount ? `£${(data.amount / 100).toLocaleString()}` : 'Not specified';
        
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
        
        // Remove duplicates
        matchedTxIds = [...new Set(matchedTxIds)];
        
        // Map funding type to display name (handle fund: prefix) - needed for cleanType later
        const cleanType = type.replace('fund:', '').replace(/:/g, '-');
        
        // Build matched transactions HTML
        let matchedTxHtml = '';
        
        // Determine label based on funding type
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
        
        if (matchedTxIds.length > 0) {
            matchedTxHtml = `<div class="matched-transactions-section"><div class="matched-tx-label">${matchLabel}</div>`;
            
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
                    
                    matchedTxHtml += `
                        <div class="matched-tx-row">
                            <span class="matched-tx-date">${date}</span>
                            <span class="matched-tx-desc">${tx.description || tx.merchant_name || 'Transaction'}</span>
                            <span class="matched-tx-account">${tx.accountName}</span>
                            <span class="matched-tx-amount">${txAmount}${currencySymbol}${Math.abs(tx.amount).toFixed(2)}</span>
                        </div>
                    `;
                }
            });
            
            matchedTxHtml += '</div>';
        } else {
            // No matched transactions - check if document was uploaded
            const docTaskKey = `documents:${cleanType}`;
            const hasDocument = check.taskOutcomes && check.taskOutcomes[docTaskKey] && 
                               check.taskOutcomes[docTaskKey].status === 'closed';
            
            // For savings/income, always show hint when no matches (document only proves balance, not income source)
            // For other funding types, only show hint if no document uploaded
            const isSavingsType = type === 'fund:savings' || type === 'fund:income';
            
            if (isSavingsType || !hasDocument) {
                const considerIcon = `<svg class="task-status-icon" viewBox="0 0 300 300" style="width: 20px; height: 20px; margin-right: 8px;"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
                
                matchedTxHtml = `
                    <div class="matched-transactions-section" style="margin-top: 16px;">
                        <div class="matched-tx-label">${matchLabel}</div>
                        <div class="no-matches-hint">
                            ${considerIcon}
                            <span>No linked bank transactions detected, manual review required</span>
                        </div>
                    </div>
                `;
            }
        }
        
        // Map funding type display names
        const typeNames = {
            'mortgage': 'Mortgage',
            'savings': 'Savings',
            'gift': 'Gift',
            'sale_property': 'Property Sale',
            'sale_assets': 'Asset Sale',
            'inheritance': 'Inheritance',
            'htb': 'Help to Buy / LISA',
            'investment': 'Investment',
            'business': 'Business Income',
            'loan': 'Loan',
            'other': 'Other'
        };
        const typeName = typeNames[cleanType] || cleanType;
        
        // Check if corresponding document exists in taskOutcomes
        const docTaskKey = `documents:${cleanType}`;
        const hasDocument = check.taskOutcomes && check.taskOutcomes[docTaskKey];
        const docIcon = hasDocument ? this.getTaskCheckIcon('CL') : this.getTaskCheckIcon('CO');
        
        // Specific message for gift type
        let docStatusText = 'Document uploaded';
        if (!hasDocument) {
            if (type === 'fund:gift') {
                docStatusText = 'Ensure the gifter undergoes their own AML, ID and SoF/SoW Checks';
            } else {
                docStatusText = 'Check the report pdf for evidence or obtain from the client and review manually';
            }
        }
        
        // Build detailed information based on fund type
        let detailsHtml = '';
        
        if (type === 'fund:mortgage') {
            if (data.lender) {
                detailsHtml += `<div class="funding-detail"><strong>Lender:</strong> ${data.lender}</div>`;
            }
            if (data.location) {
                detailsHtml += `<div class="funding-detail"><strong>Location:</strong> ${data.location}</div>`;
            }
        } else if (type === 'fund:savings') {
            if (data.people && data.people.length > 0) {
                detailsHtml += '<div class="funding-section-title">Income & Employment Details:</div>';
                detailsHtml += `<div class="people-grid people-grid-${data.people.length}">`;
                
                data.people.forEach(person => {
                    const isActor = person.actor ? 'Primary' : 'Joint';
                    const employmentStatus = person.employment_status === 'independent' ? 'Self-employed' : 
                                            person.employment_status ? person.employment_status.charAt(0).toUpperCase() + person.employment_status.slice(1) : '';
                    
                    detailsHtml += `<div class="person-card">`;
                    detailsHtml += `<div class="person-card-name">${person.name}</div>`;
                    detailsHtml += `<div class="person-card-role">${isActor}</div>`;
                    if (employmentStatus) {
                        detailsHtml += `<div class="person-card-item"><strong>Status:</strong> ${employmentStatus}</div>`;
                    }
                    if (person.incomes && person.incomes.length > 0) {
                        person.incomes.forEach(income => {
                            const annualAmount = income.annual_total ? `£${(income.annual_total / 100).toLocaleString()}` : 'N/A';
                            detailsHtml += `<div class="person-card-item"><strong>Source:</strong> ${income.source || 'N/A'}</div>`;
                            detailsHtml += `<div class="person-card-item"><strong>Annual:</strong> ${annualAmount}</div>`;
                            detailsHtml += `<div class="person-card-item"><strong>Frequency:</strong> ${income.frequency || 'N/A'}</div>`;
                            if (income.reference) {
                                detailsHtml += `<div class="person-card-item"><strong>Payslip:</strong> ${income.reference}</div>`;
                            }
                            if (income.description) {
                                detailsHtml += `<div class="person-card-item"><strong>Details:</strong> ${income.description}</div>`;
                            }
                        });
                    }
                    detailsHtml += `</div>`;
                });
                
                detailsHtml += `</div>`;
            }
        } else if (type === 'fund:gift') {
            if (data.giftor) {
                detailsHtml += '<div class="funding-section-title">Gift Details:</div>';
                if (data.giftor.name) {
                    detailsHtml += `<div class="funding-detail"><strong>From:</strong> ${data.giftor.name}</div>`;
                }
                if (data.giftor.relationship) {
                    detailsHtml += `<div class="funding-detail"><strong>Relationship:</strong> ${data.giftor.relationship}</div>`;
                }
                if (data.giftor.phone) {
                    detailsHtml += `<div class="funding-detail"><strong>Phone:</strong> ${data.giftor.phone}</div>`;
                }
                if (typeof data.giftor.contactable !== 'undefined') {
                    detailsHtml += `<div class="funding-detail"><strong>Contactable:</strong> ${data.giftor.contactable ? 'Yes' : 'No'}</div>`;
                }
                if (typeof data.repayable !== 'undefined') {
                    detailsHtml += `<div class="funding-detail"><strong>Repayable:</strong> ${data.repayable ? 'Yes' : 'No'}</div>`;
                }
            }
        } else if (type === 'fund:sale:property') {
            detailsHtml += '<div class="funding-section-title">Property Sale Details:</div>';
            if (data.date) {
                const saleDate = new Date(data.date).toLocaleDateString('en-GB');
                detailsHtml += `<div class="funding-detail"><strong>Completion Date:</strong> ${saleDate}</div>`;
            }
            if (data.status) {
                detailsHtml += `<div class="funding-detail"><strong>Status:</strong> ${data.status}</div>`;
            }
            if (data.lawyer) {
                detailsHtml += `<div class="funding-detail"><strong>Lawyer:</strong> ${data.lawyer}</div>`;
            }
        } else if (type === 'fund:sale:assets') {
            detailsHtml += '<div class="funding-section-title">Asset Sale Details:</div>';
            if (data.description) {
                detailsHtml += `<div class="funding-detail"><strong>Asset:</strong> ${data.description}</div>`;
            }
            if (data.location) {
                detailsHtml += `<div class="funding-detail"><strong>Location:</strong> ${data.location}</div>`;
            }
        } else if (type === 'fund:htb') {
            detailsHtml += '<div class="funding-section-title">Help to Buy / LISA:</div>';
            if (data.type) {
                detailsHtml += `<div class="funding-detail"><strong>Type:</strong> ${data.type.toUpperCase()}</div>`;
            }
            if (data.location) {
                detailsHtml += `<div class="funding-detail"><strong>Location:</strong> ${data.location}</div>`;
            }
        } else if (type === 'fund:inheritance') {
            detailsHtml += '<div class="funding-section-title">Inheritance Details:</div>';
            if (data.from) {
                detailsHtml += `<div class="funding-detail"><strong>From:</strong> ${data.from}</div>`;
            }
            if (data.date) {
                const inheritDate = new Date(data.date).toLocaleDateString('en-GB');
                detailsHtml += `<div class="funding-detail"><strong>Date:</strong> ${inheritDate}</div>`;
            }
            if (typeof data.is_owner !== 'undefined') {
                detailsHtml += `<div class="funding-detail"><strong>Beneficiary:</strong> ${data.is_owner ? 'Primary' : 'Secondary'}</div>`;
            }
        }
        
        return `
            <div class="funding-source-card">
                <div class="funding-header">
                    <div class="funding-type">${typeName}</div>
                    <div class="funding-amount">${amount}</div>
                </div>
                ${detailsHtml}
                ${matchedTxHtml}
                <div class="funding-doc-status">
                    ${docIcon}
                    <span class="doc-status-text">${docStatusText}</span>
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
            
            propertyDetailsHtml = `
                <div class="sof-property-details">
                    <div class="property-bullet">📍 <strong>Property:</strong> ${fullAddress}</div>
                    <div class="property-bullet">💷 <strong>Purchase Price:</strong> ${price}</div>
                    <div class="property-bullet">📋 <strong>Stamp Duty:</strong> ${sdlt}</div>
                    <div class="property-bullet">🏗️ <strong>New Build:</strong> ${newBuild}</div>
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
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">Source of Funds Questionnaire</div>
                    ${statusIcon}
                </div>
                <div class="task-details">
                    <div class="task-summary">Questionnaire completed with ${funds.length} funding source${funds.length !== 1 ? 's' : ''}</div>
                    <div class="sof-top-section">
                        ${propertyDetailsHtml}
                        ${chartHtml}
                    </div>
                    ${fundingCardsHtml}
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
        
        // Document tasks (PoA, PoO) - Non-expandable, just status text
        const isDocumentTask = taskType === 'documents:poa' || taskType === 'documents:poo' || taskType === 'documents:other';
        
        if (isDocumentTask) {
            // Get document count from documents array or breakdown.documents array
            const docCount = outcome.documents?.length || outcome.breakdown?.documents?.length || outcome.data?.document_count || 0;
            const isSkipped = status === 'skipped' || (result === 'fail' && docCount === 0);
            const summaryText = isSkipped ? 'Consumer skipped in app' : `${docCount} document${docCount !== 1 ? 's' : ''} uploaded`;
            
            return `
                <div class="task-card ${borderClass} non-expandable">
                    <div class="task-header">
                        <div class="task-title">${taskTitle}</div>
                        ${statusIcon}
                    </div>
                    <div class="task-summary-inline">${summaryText}</div>
                </div>
            `;
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
            
            // If no automatic matches but we have accounts, try to find potential matches manually
            if (Object.keys(sofMatches).length === 0 && Object.keys(accounts).length > 0) {
                sofMatches = this.findPotentialSOFMatches(outcome.breakdown.funds, accounts);
            }
            
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
                headerChecksHtml += `
                    <div class="task-check-item">
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
                    console.log(`Rendering person card ${index}:`, check.personData.name || check.personData.fullName);
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
        
        // Show inline status for unobtainable or inline warnings (like address verification issues)
        let inlineStatus = '';
        if (outcome.status === 'unobtainable') {
            inlineStatus = '<div class="task-summary-inline">Unobtainable - Some information may still be available</div>';
        } else if (outcome.inlineWarning) {
            // For address verification and other tasks with specific warnings
            const warningClass = result === 'fail' ? 'task-summary-inline-fail' : 'task-summary-inline-consider';
            inlineStatus = `<div class="task-summary-inline ${warningClass}">${outcome.inlineWarning}</div>`;
        }
        
        // Add annotations display
        const annotationsHtml = this.renderTaskAnnotations(taskType, check);
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">${taskTitle}</div>
                    ${statusIcon}
                </div>
                ${inlineStatus}
                ${headerChecksHtml}
                ${outcome.status === 'closed' || outcome.status === 'unobtainable' ? `
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
        const hasSoF = additionalTasks.includes('report:sof-v1');
        const hasBank = additionalTasks.some(t => t.includes('bank'));
        
        // Single task scenarios
        if (additionalTasks.length === 1) {
            const taskNames = {
                'documents:poa': 'Proof of Address',
                'documents:poo': 'Proof of Ownership',
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
            'fund:mortgage': '#93C5FD',      // Pastel Blue
            'fund:savings': '#86EFAC',        // Pastel Green
            'fund:gift': '#FCA5A5',           // Pastel Pink/Red
            'fund:sale:property': '#C4B5FD',  // Pastel Purple
            'fund:sale:assets': '#FDBA74',    // Pastel Orange
            'fund:htb': '#A5F3FC',            // Pastel Cyan
            'fund:inheritance': '#D1D5DB'     // Pastel Gray
        };
        
        const typeLabels = {
            'fund:mortgage': 'Mortgage',
            'fund:savings': 'Savings',
            'fund:gift': 'Gift',
            'fund:sale:property': 'Property Sale',
            'fund:sale:assets': 'Asset Sale',
            'fund:htb': 'Help to Buy/LISA',
            'fund:inheritance': 'Inheritance'
        };
        
        funds.forEach(fund => {
            const label = typeLabels[fund.type] || fund.type;
            const amount = fund.data.amount / 100; // Convert pence to pounds
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
    
    createScreeningHitCard(hitData) {
        const {
            name, dob, hitType, hitIcon, score, flagTypes, positions, countries, aka, media, associates, fields, match_types
        } = hitData;
        
        const uniqueId = `hit-${Math.random().toString(36).substr(2, 9)}`;
        
        let html = `
            <div class="screening-hit-card">
                <div class="screening-hit-header">
                    <div class="screening-hit-name">${name}</div>
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
        
        // Date of Birth
        if (dob) {
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
        
        // Media articles - expandable
        if (media && media.length > 0) {
            html += `
                <div class="hit-info-row hit-media-section">
                    <span class="hit-info-label">Media Articles:</span> 
                    <span class="hit-info-value hit-media-toggle" onclick="document.getElementById('${uniqueId}-media').classList.toggle('expanded'); event.stopPropagation();">
                        ${media.length} article${media.length !== 1 ? 's' : ''} ▼
                    </span>
                </div>
                <div id="${uniqueId}-media" class="hit-media-list">
            `;
            // Show first 10 articles
            media.slice(0, 10).forEach((article, idx) => {
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
            if (media.length > 10) {
                html += `<div id="${uniqueId}-media-extra" class="hit-media-list-extra">`;
                media.slice(10).forEach((article, idx) => {
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
                html += `<div class="media-article-more" onclick="document.getElementById('${uniqueId}-media-extra').classList.toggle('expanded'); this.textContent = this.textContent.startsWith('+') ? 'Show less' : '+ ${media.length - 10} more article${media.length - 10 !== 1 ? 's' : ''}'; event.stopPropagation();">+ ${media.length - 10} more article${media.length - 10 !== 1 ? 's' : ''}</div>`;
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
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    getCountryFlag(countryName) {
        // Map country names to flag emojis
        const flagMap = {
            'United Kingdom': '🇬🇧', 'UK': '🇬🇧', 'Great Britain': '🇬🇧', 'GB': '🇬🇧',
            'United States': '🇺🇸', 'USA': '🇺🇸', 'US': '🇺🇸',
            'France': '🇫🇷', 'FR': '🇫🇷',
            'Germany': '🇩🇪', 'DE': '🇩🇪',
            'Spain': '🇪🇸', 'ES': '🇪🇸',
            'Italy': '🇮🇹', 'IT': '🇮🇹',
            'Belgium': '🇧🇪', 'BE': '🇧🇪',
            'Brazil': '🇧🇷', 'BR': '🇧🇷',
            'Iran': '🇮🇷', 'IR': '🇮🇷',
            'Japan': '🇯🇵', 'JP': '🇯🇵',
            'Malta': '🇲🇹', 'MT': '🇲🇹',
            'Sri Lanka': '🇱🇰', 'LK': '🇱🇰',
            'Ireland': '🇮🇪', 'IE': '🇮🇪'
        };
        return flagMap[countryName] || '🌍';
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
            
            // Add inline status for warnings
            const nfcTask = breakdown.nfc;
            if (nfcTask?.status === 'unobtainable') {
                // Check if Enhanced ID was requested
                const requestTasks = check.thirdfortResponse?.request?.tasks || [];
                const identityRequest = requestTasks.find(t => t.type === 'report:identity');
                const nfcPreferred = identityRequest?.opts?.nfc === 'preferred';
                
                if (nfcPreferred) {
                    outcome.inlineWarning = 'NFC Scan unobtainable - Original ID completed';
                } else {
                    outcome.inlineWarning = 'NFC Scan unobtainable';
                }
            } else if (nfcTask?.result === 'consider') {
                outcome.inlineWarning = 'NFC verification requires review';
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
            const quality = data.quality !== undefined ? data.quality : 0;
            const sources = data.sources !== undefined ? data.sources : 0;
            
            // Determine status based on quality and sources
            // Quality: 0% = fail, 1-79% = consider, 80%+ = clear
            // Sources: 0 = fail, 1 = consider, 2+ = clear
            let qualityStatus = quality === 0 ? 'AL' : (quality >= 80 ? 'CL' : 'CO');
            let sourcesStatus = sources === 0 ? 'AL' : (sources >= 2 ? 'CL' : 'CO');
            
            // Overall status is the worst of the two
            let overallStatus = 'CL';
            if (qualityStatus === 'AL' || sourcesStatus === 'AL') {
                overallStatus = 'AL';
            } else if (qualityStatus === 'CO' || sourcesStatus === 'CO') {
                overallStatus = 'CO';
            }
            
            // Check for footprint rules/warnings
            const rules = breakdown.rules || [];
            let inlineWarning = '';
            if (rules.length > 0 && rules[0].text) {
                inlineWarning = rules[0].text;
            } else if (quality === 0 && sources === 0) {
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
            
            // Address verification summary
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
            if (breakdown.data_count) {
                const score = breakdown.data_count.properties?.score || 0;
                const result = breakdown.data_count.result || '';
                // Score: 0 = fail, 1-79 = consider, 80+ = clear
                const scoreStatus = score === 0 ? 'AL' : (score >= 80 ? 'CL' : 'CO');
                checks.push({
                    status: scoreStatus,
                    text: `Data Count Score: ${score}`,
                    indented: true
                });
            }
            
            if (breakdown.data_quality) {
                const score = breakdown.data_quality.properties?.score || 0;
                const result = breakdown.data_quality.result || '';
                // Score: 0 = fail, 1-79 = consider, 80+ = clear
                const scoreStatus = score === 0 ? 'AL' : (score >= 80 ? 'CL' : 'CO');
                checks.push({
                    status: scoreStatus,
                    text: `Data Quality Score: ${score}`,
                    indented: true
                });
            }
        }
        else if (taskType === 'screening') {
            // Combined Screening (PEP + Sanctions + Adverse Media)
            const breakdown = outcome.breakdown || {};
            const totalHits = breakdown.total_hits || 0;
            const hits = breakdown.hits || [];
            
            checks.push({
                status: totalHits === 0 ? 'CL' : 'CO',
                text: `${totalHits} match${totalHits !== 1 ? 'es' : ''} found`
            });
            
            // Show detailed hit information using the same format as PEP updates
            if (hits.length > 0) {
                hits.forEach(hit => {
                    const name = hit.name || 'Unknown';
                    const dob = hit.dob?.main || hit.dob;
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
                            match_types: hit.match_types || []
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
            
            checks.push({
                status: totalHits === 0 ? 'CL' : 'CO',
                text: `${totalHits} PEP match${totalHits !== 1 ? 'es' : ''} found`
            });
            
            // Show individual hits if any
            if (hits.length > 0) {
                hits.forEach(hit => {
                    const name = hit.name || 'Unknown';
                    const positions = hit.political_positions || [];
                    const countries = hit.countries || [];
                    
                    let hitText = `${name}`;
                    if (positions.length > 0) hitText += ` | ${positions.slice(0, 2).join(', ')}`;
                    if (countries.length > 0) hitText += ` [${countries.slice(0, 3).join(', ')}]`;
                    
                    checks.push({
                        status: 'CO',
                        text: hitText,
                        indented: true
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
            // IDV document verification - Show detailed breakdown
            const breakdown = outcome.breakdown?.document?.breakdown || {};
            
            // Document verification categories
            const categories = [
                { key: 'visual_authenticity', label: 'Visual Authenticity' },
                { key: 'image_integrity', label: 'Image Integrity' },
                { key: 'data_validation', label: 'Data Validation' },
                { key: 'data_consistency', label: 'Data Consistency' },
                { key: 'data_comparison', label: 'Data Comparison' },
                { key: 'compromised_document', label: 'Compromised Check' },
                { key: 'age_validation', label: 'Age Validation' },
                { key: 'police_record', label: 'Police Record' }
            ];
            
            categories.forEach(cat => {
                if (breakdown[cat.key]) {
                    const result = breakdown[cat.key].result || 'unknown';
                    checks.push({
                        status: result === 'clear' ? 'CL' : (result === 'fail' ? 'AL' : 'CO'),
                        text: cat.label
                    });
                }
            });
        }
        else if (taskType === 'company:summary') {
            // Company Summary - Show people as profile cards
            const breakdown = outcome.breakdown || {};
            
            // Officers/People as profile cards
            if (breakdown.people && Array.isArray(breakdown.people) && breakdown.people.length > 0) {
                breakdown.people.forEach(person => {
                    checks.push({
                        isPersonCard: true,
                        personData: person
                        // NO status or text field - only isPersonCard and personData
                    });
                });
            }
        }
        else if (taskType === 'company:ubo') {
            // Ultimate Beneficial Owners
            const breakdown = outcome.breakdown || {};
            
            // Show unobtainable message if applicable
            if (breakdown.uboUnavailable && outcome.status === 'unobtainable') {
                checks.push({
                    status: 'CO',
                    text: 'UBO information unobtainable - available PSC/ownership data shown below'
                });
            }
            
            // PSCs (Persons with Significant Control) as profile cards
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
                        personData: personWithControls
                        // NO status or text field
                    });
                });
            }
            
            // Beneficial Owners as profile cards
            if (breakdown.beneficialOwners && Array.isArray(breakdown.beneficialOwners) && breakdown.beneficialOwners.length > 0) {
                breakdown.beneficialOwners.forEach(owner => {
                    checks.push({
                        isPersonCard: true,
                        personData: owner
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
    
    // ===================================================================
    // MOCK DATA (for testing)
    // ===================================================================
    
    loadMockData() {
        console.log('🎭 Loading mock data...');
        
        const mockChecks = this.generateMockData();
        this.loadChecks(mockChecks);
    }
    
    generateMockData() {
        // Real KYB check data for THURSTAN HOSKIN SOLICITORS LLP
        return [
            // Mock Check 1: THURSTAN HOSKIN SOLICITORS LLP - KYB Check
            {
                checkId: 'd45v1gy23amg0306599g',
                checkType: 'kyb',
                status: 'closed',
                companyName: 'THURSTAN HOSKIN SOLICITORS LLP',
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: '2025-11-05T20:17:10.220Z',
                updatedAt: '2025-11-05T21:15:23.171Z',
                completedAt: '2025-11-05T20:17:29.568Z',
                pdfReady: true,
                pdfS3Key: 'protected/V0QcMFD',
                pdfAddedAt: '2025-11-05T20:21:46.714Z',
                hasMonitoring: true,
                hasAlerts: false,
                companyData: {
                    jurisdiction: 'UK',
                    number: 'OC421980',
                    name: 'THURSTAN HOSKIN SOLICITORS LLP',
                    numbers: ['OC421980'],
                    id: '223822293'
                },
                thirdfortResponse: {
                    request: {
                        data: {
                            jurisdiction: 'UK',
                            number: 'OC421980',
                            name: 'THURSTAN HOSKIN SOLICITORS LLP',
                            numbers: ['OC421980'],
                            id: '223822293'
                        },
                        reports: [
                            { type: 'company:summary' },
                            { type: 'company:sanctions', opts: { monitored: true } },
                            { type: 'company:ubo' },
                            { type: 'company:beneficial-check' },
                            { type: 'company:shareholders' }
                        ]
                    },
                    ref: '21 Green Lane',
                    id: 'd45v1gy23amg0306599g',
                    reports: [],
                    status: 'open',
                    type: 'company'
                },
                tasks: [],
                taskOutcomes: {
                    'company:beneficial-check': {
                        breakdown: {},
                        result: 'consider',
                        documents: [],
                        id: 'd45v1ke23amg030659dg',
                        status: 'unobtainable',
                        createdAt: '2025-11-05T20:17:17.370Z'
                    },
                    'company:summary': {
                        breakdown: {
                            people: [
                                {
                                    name: 'Barbara Archer',
                                    start_date: '2018-04-12',
                                    dob: '1974-07',
                                    position: 'Designated LLP Member'
                                },
                                {
                                    name: 'Stephen John Duncan Morrison',
                                    start_date: '2018-04-12',
                                    dob: '1972-07',
                                    position: 'Designated LLP Member'
                                }
                            ],
                            registration_number: 'OC421980',
                            status: 'active',
                            date_of_incorporation: '2018-04-12'
                        },
                        result: 'clear',
                        documents: [],
                        id: 'd45v1m623amg030659hg',
                        status: 'closed',
                        createdAt: '2025-11-05T20:17:20.796Z'
                    },
                    'company:shareholders': {
                        breakdown: {
                            documents: [
                                {
                                    id: '49621b12-655b-4fee-8715-3daefb7f9ca8',
                                    type: 'shareholders',
                                    provider: 'documents-api'
                                }
                            ]
                        },
                        result: 'clear',
                        documents: ['49621b12-655b-4fee-8715-3daefb7f9ca8'],
                        id: 'd45v1my23amg030659m0',
                        status: 'closed',
                        createdAt: '2025-11-05T20:17:23.522Z'
                    },
                    'company:sanctions': {
                        breakdown: {
                            total_hits: 0,
                            hits: []
                        },
                        result: 'clear',
                        documents: ['d45v3ed23amg030659pg'],
                        id: 'd45v1jy23amg030659b0',
                        status: 'closed',
                        createdAt: '2025-11-05T20:17:15.660Z'
                    },
                    'company:ubo': {
                        breakdown: {
                            uboUnavailable: true,
                            pscs: [
                                {
                                    natureOfControlStartDate: '2018-04-12',
                                    person: {
                                        name: 'Barbara Archer',
                                        birthDate: '1974-07',
                                        nationality: 'British'
                                    }
                                },
                                {
                                    natureOfControlStartDate: '2018-04-12',
                                    person: {
                                        name: 'Stephen John Duncan Morrison',
                                        birthDate: '1972-07',
                                        nationality: 'British'
                                    }
                                }
                            ]
                        },
                        result: 'consider',
                        documents: [],
                        id: 'd45v1kp23amg030659fg',
                        status: 'unobtainable',
                        createdAt: '2025-11-05T20:17:18.266Z'
                    }
                },
                updates: [
                    { timestamp: '2025-11-05T20:17:10.220Z', update: 'KYB check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: '2025-11-05T20:17:29.568Z', update: 'Check completed - awaiting PDF' },
                    { timestamp: '2025-11-05T20:21:46.714Z', update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: '2025-11-05T21:15:23.171Z', update: 'Refreshed from Thirdfort API - Status: closed' }
                ]
            },
            // Mock Check 2: Benjamin David Jasper Meehan - Electronic ID with CONSIDER
            {
                "taskOutcomes": {
                  "document": {
                    "result": "clear",
                    "status": "complete",
                    "data": {
                      "consistency": "clear",
                      "compromised": "clear",
                      "authenticity": "clear",
                      "integrity": "clear",
                      "validation": "clear"
                    }
                  },
                  "facial_similarity": {
                    "result": "clear",
                    "status": "complete",
                    "data": {
                      "authenticity": "clear",
                      "comparison": "clear",
                      "integrity": "clear"
                    }
                  },
                  "peps": {
                    "breakdown": {
                      "total_hits": 0,
                      "hits": []
                    },
                    "data": {
                      "dob": "2003-02-22T00:00:00.000Z",
                      "name": {
                        "first": "Benjamin",
                        "last": "Meehan",
                        "other": "David Jasepr"
                      },
                      "address": {
                        "postcode": "TR15 3SW",
                        "country": "GBR",
                        "street": "Woolf Place",
                        "building_number": "1",
                        "town": "Redruth"
                      }
                    },
                    "result": "clear",
                    "documents": [
                      "d4704s323amg030w7vdg"
                    ],
                    "id": "d4704e123amg030w7vbg",
                    "status": "closed",
                    "createdAt": "2025-11-07T14:29:12.823Z"
                  },
                  "nfc": {
                    "result": "consider",
                    "status": "unobtainable",
                    "data": {
                      "chip": {},
                      "comparison": {}
                    }
                  },
                  "documents:poo": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46gtah23amg030rwa50",
                          "type": "poo"
                        },
                        {
                          "id": "d46gtb123amg030rwa5g",
                          "type": "poo"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46gtah23amg030rwa50",
                      "d46gtb123amg030rwa5g"
                    ],
                    "id": "d46gvdn23amg030rwa70",
                    "status": "closed",
                    "createdAt": "2025-11-06T21:05:58.876Z"
                  },
                  "address": {
                    "result": "fail",
                    "status": "closed",
                    "data": {
                      "quality": 0
                    }
                  },
                  "biometrics": {
                    "result": "consider",
                    "status": "unobtainable",
                    "data": {}
                  },
                  "identity": {
                    "result": "consider",
                    "status": "closed",
                    "data": {}
                  },
                  "documents:selfie": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d4704d923amg030w7v7g",
                          "type": "selfie"
                        }
                      ]
                    },
                    "data": {},
                    "result": "unknown",
                    "documents": [
                      "d4704d923amg030w7v7g"
                    ],
                    "id": "d4704d923amg030w7v6g",
                    "status": "complete",
                    "createdAt": "2025-11-07T14:29:09.617Z"
                  },
                  "footprint": {
                    "breakdown": {
                      "data_count": {
                        "properties": {
                          "score": 0
                        },
                        "result": "consider"
                      },
                      "data_quality": {
                        "properties": {
                          "score": 0
                        },
                        "result": "consider"
                      },
                      "service_name": "Authenticateplus",
                      "documents": [
                        {
                          "id": "d47049923amg030w7tzg",
                          "type": "poa"
                        }
                      ],
                      "rules": [
                        {
                          "id": "U000",
                          "name": "",
                          "score": 0,
                          "text": "No trace of supplied Address(es), or manual Authentication required by the Applicant"
                        }
                      ]
                    },
                    "data": {
                      "dob": "2003-02-22T00:00:00.000Z",
                      "name": {
                        "first": "Benjamin",
                        "last": "Meehan",
                        "other": "David Jasepr"
                      },
                      "address": {
                        "postcode": "TR15 3SW",
                        "country": "GBR",
                        "street": "Woolf Place",
                        "building_number": "1",
                        "town": "Redruth"
                      }
                    },
                    "result": "fail",
                    "documents": [
                      "d47049923amg030w7tzg"
                    ],
                    "id": "d47049s23amg030w7v10",
                    "status": "closed",
                    "createdAt": "2025-11-07T14:28:55.660Z"
                  }
                },
                "updatedAt": "2025-11-07T14:29:17.960Z",
                "consumerPhone": "+447754241686",
                "pdfReady": true,
                "checkType": "electronic-id",
                "completedAt": "2025-11-07T14:29:17.960Z",
                "initiatedAt": "2025-11-06T16:42:43.686Z",
                "considerReasons": [
                  "address verification",
                  "digital footprint"
                ],
                "pdfS3Key": "protected/l0lXRcU",
                "consumerName": "Benjamin David Jasper Meehan",
                "tasks": [
                  "report:identity",
                  "report:footprint",
                  "report:peps",
                  "documents:poa",
                  "documents:poo"
                ],
                "updates": [
                  {
                    "timestamp": "2025-11-06T16:42:43.686Z",
                    "update": "Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-07T14:29:17.960Z",
                    "update": "Transaction completed - awaiting PDF"
                  },
                  {
                    "timestamp": "2025-11-07T14:29:59.000Z",
                    "update": "PEPs & Sanctions task completed"
                  },
                  {
                    "timestamp": "2025-11-07T14:31:21.496Z",
                    "update": "PDF received and uploaded to S3 - CONSIDER: address verification, digital footprint, document integrity"
                  },
                  {
                    "timestamp": "2025-11-07T14:33:08.542Z",
                    "update": "PDF received and uploaded to S3 - CONSIDER: address verification, digital footprint"
                  }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "piiData": {
                  "name": {
                    "first": "Benjamin",
                    "last": "Meehan",
                    "other": "David Jasepr"
                  },
                  "address": {
                    "postcode": "TR15 3SW",
                    "country": "GBR",
                    "street": "Woolf Place",
                    "building_number": "1",
                    "town": "Redruth"
                  },
                  "dob": "2003-02-22T00:00:00.000Z",
                  "document": {
                    "number": "999999999"
                  }
                },
                "hasMonitoring": true,
                "thirdfortResponse": {
                  "name": "Sale of 21 Green Lane",
                  "request": {
                    "actor": {
                      "name": "Benjamin David Jasper Meehan",
                      "phone": "+447754241686"
                    },
                    "tasks": [
                      {
                        "opts": {
                          "nfc": "preferred"
                        },
                        "type": "report:identity"
                      },
                      {
                        "opts": {
                          "consent": false
                        },
                        "type": "report:footprint"
                      },
                      {
                        "opts": {
                          "monitored": true
                        },
                        "type": "report:peps"
                      },
                      {
                        "type": "documents:poa"
                      },
                      {
                        "type": "documents:poo"
                      }
                    ]
                  },
                  "ref": "21 Green Lane",
                  "id": "d46d00g23amg030rw7s0",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "XZ9PtCPxkpoVkiKRx0KPOIz/tVztJB7bYtE1pBRbvhs=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t0auq9io6g00ak3kkg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "THS Bot"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t0auq9io6g00ak3kkg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797878"
                    },
                    "created_at": "2025-11-06T16:42:42.371Z"
                  },
                  "type": "v2",
                  "opts": {
                    "peps": {
                      "monitored": true
                    }
                  }
                },
                "hasAlerts": true,
                "pdfAddedAt": "2025-11-07T14:33:08.542Z",
                "smsSent": true,
                "transactionId": "d46d00g23amg030rw7s0"
            },
            // Mock Check 3: Jacob Robert Moran - Electronic ID with CONSIDER (NFC name mismatch)
            {
                "taskOutcomes": {
                    "documents:poa": {
                        "breakdown": {
                            "documents": [
                                {
                                    "id": "d472tyb23amg030w7vpg",
                                    "type": "poa"
                                },
                                {
                                    "id": "d472tyk23amg030w7vq0",
                                    "type": "poa"
                                }
                            ]
                        },
                        "data": {},
                        "result": "clear",
                        "documents": [
                            "d472tyb23amg030w7vpg",
                            "d472tyk23amg030w7vq0"
                        ],
                        "id": "d472vm623amg030w7w90",
                        "status": "closed",
                        "createdAt": "2025-11-07T17:35:12.907Z"
                    },
                    "peps": {
                        "breakdown": {
                            "total_hits": 0,
                            "hits": []
                        },
                        "data": {
                            "dob": "2001-01-11T00:00:00.000Z",
                            "name": {
                                "first": "Jacob",
                                "last": "Archer-Moran",
                                "other": "Robert"
                            },
                            "address": {
                                "postcode": "TR15 2ND",
                                "country": "GBR",
                                "street": "Southgate Street",
                                "building_number": "94",
                                "town": "Redruth"
                            }
                        },
                        "result": "clear",
                        "documents": [
                            "d472we123amg030w7ww0"
                        ],
                        "id": "d472wd123amg030w7wt0",
                        "status": "closed",
                        "createdAt": "2025-11-07T17:36:52.386Z"
                    },
                    "nfc": {
                        "result": "consider",
                        "status": "complete",
                        "data": {
                            "chip": {
                                "clone_detection": "clear",
                                "verification": "clear"
                            },
                            "comparison": {
                                "dob": 0,
                                "name": 72
                            }
                        }
                    },
                    "address": {
                        "result": "fail",
                        "status": "closed",
                        "data": {
                            "quality": 0
                        }
                    },
                    "biometrics": {
                        "result": "clear",
                        "status": "complete",
                        "data": {}
                    },
                    "identity": {
                        "breakdown": {
                            "nfc": {
                                "breakdown": {
                                    "chip": {
                                        "breakdown": {
                                            "clone_detection": {
                                                "result": "clear"
                                            },
                                            "verification": {
                                                "result": "clear"
                                            }
                                        },
                                        "result": "clear"
                                    },
                                    "data_comparison": {
                                        "breakdown": {
                                            "dob": {
                                                "result": "clear",
                                                "properties": {
                                                    "days_difference": 0
                                                }
                                            },
                                            "name": {
                                                "result": "consider",
                                                "properties": {
                                                    "levenshtein_pct": 72
                                                }
                                            }
                                        },
                                        "result": "consider"
                                    }
                                },
                                "result": "consider",
                                "status": "complete"
                            },
                            "documents": [
                                {
                                    "id": "d472vbd23amg030w7vqg",
                                    "type": "passport"
                                },
                                {
                                    "id": "d472vfn23amg030w7vsg",
                                    "type": "face-image"
                                },
                                {
                                    "id": "d472vky23amg030w7w7g",
                                    "type": "selfie"
                                }
                            ],
                            "biometrics": {
                                "breakdown": {
                                    "attempts": [
                                        {
                                            "frame_available": false,
                                            "passed": true,
                                            "status": "complete",
                                            "token": {
                                                "created_at": 1762536895950,
                                                "validated_at": 1762536911920,
                                                "value": "d7b0d934c8c227d6359d6b794e8dddfbd44a98ffe8fe799283855bdd1801vi07"
                                            }
                                        }
                                    ]
                                },
                                "result": "clear",
                                "status": "complete"
                            }
                        },
                        "data": {
                            "nfc": {
                                "date_of_expiry": "22.08.2033",
                                "dob": "11.01.2001",
                                "name": "MORAN, JACOB ROBERT"
                            },
                            "name": {
                                "first": "Jacob",
                                "last": "Archer-Moran",
                                "other": "Robert"
                            },
                            "dob": "2001-01-11T00:00:00.000Z"
                        },
                        "result": "consider",
                        "documents": [
                            "d472vbd23amg030w7vqg",
                            "d472vfn23amg030w7vsg",
                            "d472vky23amg030w7w7g"
                        ],
                        "id": "d472wc923amg030w7wng",
                        "status": "closed",
                        "createdAt": "2025-11-07T17:36:49.799Z"
                    },
                    "footprint": {
                        "breakdown": {
                            "data_count": {
                                "properties": {
                                    "score": 0
                                },
                                "result": "consider"
                            },
                            "data_quality": {
                                "properties": {
                                    "score": 0
                                },
                                "result": "consider"
                            },
                            "service_name": "Authenticateplus",
                            "documents": [
                                {
                                    "id": "d472wbs23amg030w7wfg",
                                    "type": "poa"
                                },
                                {
                                    "id": "d472wc123amg030w7wg0",
                                    "type": "poa"
                                }
                            ],
                            "rules": [
                                {
                                    "id": "U000",
                                    "name": "",
                                    "score": 0,
                                    "text": "No trace of supplied Address(es), or manual Authentication required by the Applicant"
                                }
                            ]
                        },
                        "data": {
                            "dob": "2001-01-11T00:00:00.000Z",
                            "name": {
                                "first": "Jacob",
                                "last": "Archer-Moran",
                                "other": "Robert"
                            },
                            "address": {
                                "postcode": "TR15 2ND",
                                "country": "GBR",
                                "street": "Southgate Street",
                                "building_number": "94",
                                "town": "Redruth"
                            }
                        },
                        "result": "fail",
                        "documents": [
                            "d472wbs23amg030w7wfg",
                            "d472wc123amg030w7wg0"
                        ],
                        "id": "d472wc923amg030w7whg",
                        "status": "closed",
                        "createdAt": "2025-11-07T17:36:49.214Z"
                    }
                },
                "updatedAt": "2025-11-07T17:36:58.969Z",
                "consumerPhone": "+447506430094",
                "pdfReady": true,
                "checkType": "electronic-id",
                "completedAt": "2025-11-07T17:36:58.969Z",
                "initiatedAt": "2025-11-07T17:23:57.085Z",
                "considerReasons": [
                    "address verification",
                    "digital footprint",
                    "document integrity"
                ],
                "pdfS3Key": "protected/FTAxKJt",
                "consumerName": "Jacob Robert Moran",
                "tasks": [
                    "report:identity",
                    "report:footprint",
                    "report:peps",
                    "documents:poa"
                ],
                "updates": [
                    {
                        "timestamp": "2025-11-07T17:23:57.085Z",
                        "update": "Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                    },
                    {
                        "timestamp": "2025-11-07T17:36:58.969Z",
                        "update": "Transaction completed - awaiting PDF"
                    },
                    {
                        "timestamp": "2025-11-07T17:37:18.427Z",
                        "update": "PDF received and uploaded to S3 - CONSIDER: address verification, digital footprint, document integrity"
                    },
                    {
                        "timestamp": "2025-11-07T17:40:18.288Z",
                        "update": "2 additional document(s) uploaded by consumer"
                    }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "piiData": {
                    "name": {
                        "first": "Jacob",
                        "last": "Archer-Moran",
                        "other": "Robert"
                    },
                    "address": {
                        "postcode": "TR15 2ND",
                        "country": "GBR",
                        "street": "Southgate Street",
                        "building_number": "94",
                        "town": "Redruth"
                    },
                    "dob": "2001-01-11T00:00:00.000Z",
                    "document": {}
                },
                "hasMonitoring": true,
                "thirdfortResponse": {
                    "name": "Purchase of 21 Green Lane",
                    "request": {
                        "actor": {
                            "name": "Jacob Robert Moran",
                            "phone": "+447506430094"
                        },
                        "tasks": [
                            {
                                "opts": {
                                    "nfc": "preferred"
                                },
                                "type": "report:identity"
                            },
                            {
                                "opts": {
                                    "consent": false
                                },
                                "type": "report:footprint"
                            },
                            {
                                "opts": {
                                    "monitored": true
                                },
                                "type": "report:peps"
                            },
                            {
                                "type": "documents:poa"
                            }
                        ]
                    },
                    "ref": "Purchase of 21 Green Lane",
                    "id": "d472pb123amg030w7vgg",
                    "reports": [],
                    "status": "open",
                    "metadata": {
                        "notify": {
                            "type": "http",
                            "data": {
                                "hmac_key": "GgUi5IyCFm4TOsMy3Q4cvq6bnQEBJq/0uRqECCRoz+4=",
                                "method": "POST",
                                "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                            }
                        },
                        "created_by": "d3t2m5q9io6g00ak3kmg",
                        "print": {
                            "team": "Cashiers",
                            "tenant": "Thurstan Hoskin Solicitors LLP",
                            "user": "Jacob Archer-Moran"
                        },
                        "context": {
                            "gid": "d3t2k5a9io6g00ak3km0",
                            "uid": "d3t2m5q9io6g00ak3kmg",
                            "team_id": "d3t2k5a9io6g00ak3km0",
                            "tenant_id": "d3t2ifa9io6g00ak3klg"
                        },
                        "ce": {
                            "uri": "/v1/checks/4151797887"
                        },
                        "created_at": "2025-11-07T17:23:55.088Z"
                    },
                    "type": "v2",
                    "opts": {
                        "peps": {
                            "monitored": true
                        }
                    }
                },
                "hasAlerts": true,
                "pdfAddedAt": "2025-11-07T17:37:18.427Z",
                "smsSent": true,
                "transactionId": "d472pb123amg030w7vgg"
            },
            // Mock Check 4: Se Idris Stewart - Electronic ID with SOF and Bank Statements
            {
    "taskOutcomes": {
      "document": {
        "result": "clear",
        "status": "complete",
        "data": {
          "consistency": "clear",
          "compromised": "clear",
          "authenticity": "clear",
          "integrity": "clear",
          "validation": "clear"
        }
      },
      "sof:v1": {
        "breakdown": {
          "property": {
            "address": {
              "building_name": "Chapel Farm House",
              "country": "GBR",
              "postcode": "TR15 1RW",
              "town": "Redruth"
            },
            "new_build": false,
            "price": 20000000,
            "stamp_duty": 150000
          },
          "funds": [
            {
              "data": {
                "amount": 1000000,
                "location": "GBR",
                "type": "lisa"
              },
              "metadata": {
                "created_at": 1762527831116
              },
              "type": "fund:htb"
            },
            {
              "data": {
                "amount": 500000,
                "giftor": {
                  "contactable": true,
                  "name": "Mum",
                  "phone": "+447493580033",
                  "relationship": "Mum"
                },
                "location": "GBR",
                "repayable": false
              },
              "metadata": {
                "created_at": 1762527831327
              },
              "type": "fund:gift"
            },
            {
              "data": {
                "amount": 150000,
                "description": "Clock",
                "location": "GBR"
              },
              "metadata": {
                "created_at": 1762527831542
              },
              "type": "fund:sale:assets"
            },
            {
              "data": {
                "amount": 18000000,
                "lender": "abc",
                "location": "GBR"
              },
              "metadata": {
                "created_at": 1762527831681
              },
              "type": "fund:mortgage"
            },
            {
              "data": {
                "amount": 500000,
                "location": "GBR",
                "people": [
                  {
                    "actor": true,
                    "name": "Se Idris Stewart",
                    "incomes": [
                      {
                        "reference": "payslip",
                        "source": "salary",
                        "description": "",
                        "annual_total": 2700000,
                        "frequency": "monthly"
                      }
                    ],
                    "employment_status": "employed",
                    "phone": "+447493580033"
                  }
                ]
              },
              "metadata": {
                "created_at": 1762527831814
              },
              "type": "fund:savings"
            }
          ]
        },
        "data": {},
        "result": "clear",
        "documents": [],
        "id": "d472vh623amg030w7w2g",
        "status": "closed",
        "createdAt": "2025-11-07T17:35:00.532Z"
      },
      "documents:savings": {
        "breakdown": {
          "documents": [
            {
              "id": "d472wna23amg030w7wz0",
              "type": "savings"
            }
          ]
        },
        "data": {},
        "result": "clear",
        "documents": [
          "d472wna23amg030w7wz0"
        ],
        "id": "d472wpa23amg030w7x6g",
        "status": "closed",
        "createdAt": "2025-11-07T17:37:29.440Z"
      },
      "documents:mortgage": {
        "breakdown": {
          "documents": [
            {
              "id": "d472w9s23amg030w7wf0",
              "type": "mortgage"
            }
          ]
        },
        "data": {},
        "result": "clear",
        "documents": [
          "d472w9s23amg030w7wf0"
        ],
        "id": "d472wp223amg030w7x20",
        "status": "closed",
        "createdAt": "2025-11-07T17:37:28.901Z"
      },
      "documents:poa": {
        "breakdown": {
          "documents": [
            {
              "id": "d470er323amg030w7vg0",
              "type": "poa"
            }
          ]
        },
        "data": {},
        "result": "clear",
        "documents": [
          "d470er323amg030w7vg0"
        ],
        "id": "d472vgy23amg030w7vxg",
        "status": "closed",
        "createdAt": "2025-11-07T17:34:59.453Z"
      },
      "facial_similarity": {
        "result": "clear",
        "status": "complete",
        "data": {
          "authenticity": "clear",
          "comparison": "clear",
          "integrity": "clear"
        }
      },
      "peps": {
        "breakdown": {
          "total_hits": 0,
          "hits": []
        },
        "data": {
          "dob": "2000-01-05T00:00:00.000Z",
          "name": {
            "first": "Sé",
            "last": "Stewart",
            "other": "Idris"
          },
          "address": {
            "postcode": "TR15 2ND",
            "country": "GBR",
            "street": "Southgate Street",
            "building_number": "94",
            "town": "Redruth"
          }
        },
        "result": "clear",
        "documents": [
          "d472x6c23amg030w7xx0"
        ],
        "id": "d472x5w23amg030w7xs0",
        "status": "closed",
        "createdAt": "2025-11-07T17:38:31.451Z"
      },
      "nfc": {
        "result": "consider",
        "status": "unobtainable",
        "data": {
          "chip": {},
          "comparison": {}
        }
      },
      "documents:bank-statement": {
        "breakdown": {
          "accounts": {
            "40163406": {
              "info": {
                "number": {
                  "iban": "",
                  "number": "40163406",
                  "sort_code": "40-20-55",
                  "swift_bic": ""
                },
                "name": "",
                "provider": {
                  "id": "",
                  "name": "HSBC"
                },
                "balance": {
                  "available": 2.75,
                  "current": 2.75,
                  "overdraft": 0
                },
                "info": [
                  {
                    "full_name": "Mr Se Idris Stewart",
                    "phones": null,
                    "date_of_birth": "",
                    "emails": null,
                    "update_timestamp": "",
                    "addresses": null
                  }
                ],
                "credentials_id": "",
                "currency": "GBP",
                "metadata": {
                  "created_at": "2025-11-07T17:35:01.470172Z",
                  "encryption": "",
                  "updated_at": "2025-11-07T17:36:32.145693Z"
                },
                "type": ""
              },
              "statement": [
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "NEST FIRST PAYMENT",
                  "amount": -60,
                  "id": "03c57712-eab4-4574-b022-607336d5b059",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "PROSPECT UNION",
                  "amount": -13.33,
                  "id": "fe049d6e-cc8d-42b2-8e02-9fad81aef643",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "2ffd97ed-ce60-4fe4-bb86-53ce568a7a02",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "fdc1f9f6-319a-4027-bd94-2c74afdbc070",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "f82f3579-3024-44f6-a2f8-af19162b97ee",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX PROPERTY",
                  "timestamp": "2025-07-01T00:00:00Z",
                  "description": "DEX PROPERTY 35 SUTHERLAND RM 1",
                  "amount": -480,
                  "rolling_account_balance": 1073.91,
                  "id": "89137c17-da6f-414b-b221-496551762f06",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Katie Havanna Reen",
                  "timestamp": "2025-07-02T00:00:00Z",
                  "description": "Katie Havanna Reen SPLITWISE-PAYMENT",
                  "amount": -32.73,
                  "rolling_account_balance": 1041.18,
                  "id": "39dd0f39-1cd7-4da0-92b7-dd4ef640b8d1",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "OBP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-08T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 941.18,
                  "id": "467dcee0-769f-4f84-b710-fae215dbca63",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-09T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -40,
                  "id": "d98c90f8-49e8-4973-8884-d0f9d0cdddf2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-09T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "id": "9099c841-dec8-4bec-8290-16d2f274bcf3",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-12T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 936.18,
                  "id": "ff7861ec-d2ff-49bc-ad98-17c256abdddf",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-16T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -60,
                  "rolling_account_balance": 876.18,
                  "id": "942cadee-2578-4cb9-98e3-bc684d9fd184",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-17T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 826.18,
                  "id": "10963733-05e5-405a-94c5-d7580b390d63",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NHSBSA",
                  "timestamp": "2025-07-18T00:00:00Z",
                  "description": "NHSBSA PPC 2",
                  "amount": -11.45,
                  "id": "5e7a8546-cca8-46e5-8add-40a412b52ec6",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-18T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 764.73,
                  "id": "0e16d88a-c79c-44d6-8fcb-c1bb6952724f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Barbara Archer",
                  "timestamp": "2025-07-19T00:00:00Z",
                  "description": "Barbara Archer Holiday Flights",
                  "amount": -140,
                  "rolling_account_balance": 624.73,
                  "id": "dc55407c-f7e7-4026-b815-53b69d1d1e85",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ",
                  "timestamp": "2025-07-20T00:00:00Z",
                  "description": "LEE CAJ Joy to the lord",
                  "amount": 40,
                  "id": "1444e1f2-3fac-4c78-a8a1-4e0dd3407bc8",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-20T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -240,
                  "id": "c5c8cc39-44dd-4467-ba8b-d115ee536ebd",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-20T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 374.73,
                  "id": "4f98cc79-7d3b-4201-968f-dba556783460",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-21T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -74.73,
                  "id": "af6a348e-f528-4a58-af07-02fb91e9c9b1",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-21T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 450,
                  "id": "79865522-6217-4bff-a470-723d0bee6d73",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-23T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -300,
                  "rolling_account_balance": 318,
                  "id": "27d47a64-4632-4973-8838-7b8b5ab85839",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ",
                  "timestamp": "2025-07-23T00:00:00Z",
                  "description": "LEE CAJ Airplane disaster",
                  "amount": 168,
                  "id": "45c7dc04-1865-460f-a857-cfad071e6831",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-24T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -120,
                  "rolling_account_balance": 198,
                  "id": "73171bb4-af3c-46d0-ab1e-f207b2d118e4",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LADYWELL ARIZONA L",
                  "timestamp": "2025-07-25T00:00:00Z",
                  "description": "LADYWELL ARIZONA L SALARY JULY 2025",
                  "amount": 2162.44,
                  "id": "18c9a740-dc6c-4eb9-8a5b-fdffd7a3564c",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-25T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 2260.44,
                  "id": "ddb0edbd-2d9a-4eb9-8c48-6f9b5646107d",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-28T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 2160.44,
                  "id": "48b02a93-b68d-4384-9800-7053bc9a48d9",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-07-29T00:00:00Z",
                  "description": "Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 2060.44,
                  "id": "7faa0e99-67c6-4d34-861d-3bcbddadeb10",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "DD PROSPECT UNION",
                  "amount": -13.33,
                  "id": "78ed938c-c5f4-4737-93df-bf0b8e085d8e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "DD NEST",
                  "amount": -60,
                  "id": "12404151-42fc-42cf-a102-d698dc9b1ab2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM SAVE",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "SO STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "93cd5860-cb98-4be2-be2d-87dddf569c35",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R CAR",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "SO Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "5b0b4661-13bb-42c8-b0af-f6771995eba2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B VODAFONE",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "SO Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "12d8601d-9b0d-4aaa-be25-a2a2c07634d9",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX PROPERTY 35 SUTHERLAND RM 1",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "SO DEX PROPERTY 35 SUTHERLAND RM 1",
                  "amount": -480,
                  "id": "091a1417-6f9d-4301-834a-893776f70189",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-01T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "rolling_account_balance": 1072.11,
                  "id": "d1945c03-afa3-4877-8ba9-4a07398240b2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-02T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -250,
                  "rolling_account_balance": 822.11,
                  "id": "5d27588c-4266-41be-8eb6-683123082255",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-08T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "rolling_account_balance": 622.11,
                  "id": "5d22cd18-a8e5-4c3d-ae5e-a7521cf60955",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-09T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -400,
                  "rolling_account_balance": 222.11,
                  "id": "8814461c-b7b1-4da5-be9a-ae93066ad667",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Katie Havanna Reen SPLITWISE-PAYMENT",
                  "timestamp": "2025-08-11T00:00:00Z",
                  "description": "OBP Katie Havanna Reen SPLITWISE-PAYMENT",
                  "amount": -15.25,
                  "id": "e1f3f7b8-5b53-4dbd-9ce0-89fcd8e65fbb",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "OBP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-11T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "id": "550bc2cf-0cd6-416b-8a2a-7a72f876fb91",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-08-11T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 50,
                  "rolling_account_balance": 56.86,
                  "id": "eb8ede2b-24ec-4da9-84ce-989f5a42af1f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-17T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -40,
                  "rolling_account_balance": 16.86,
                  "id": "d25d875c-1c2e-4ce3-b118-031cdc2d0393",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NHSBSA PPC 2",
                  "timestamp": "2025-08-18T00:00:00Z",
                  "description": "DD NHSBSA PPC 2",
                  "amount": -11.45,
                  "rolling_account_balance": 5.41,
                  "id": "21646963-a1b1-4935-8e8c-134622bc482f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-08-20T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 100,
                  "id": "0132d86a-54ef-495f-b58a-3a87e865006f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-20T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 5.41,
                  "id": "74137577-187f-4463-9783-7c877fcce6d1",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-08-22T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 100,
                  "id": "fcaba9eb-490f-45e0-8dc3-c6dbec615496",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-22T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -80,
                  "id": "7f7a993f-4b9c-4d91-9524-0e2d401d10ac",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-22T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -20,
                  "rolling_account_balance": 5.41,
                  "id": "c78819f5-6e44-47c8-bd77-1575216314ea",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R Iou",
                  "timestamp": "2025-08-23T00:00:00Z",
                  "description": "BP Arch-Mo J R Iou",
                  "amount": 50,
                  "id": "309569df-91e5-4c73-a940-13e4843d534e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-23T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 5.41,
                  "id": "ca7caec7-f74f-4273-8cc1-a9a2a25fa912",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LADYWELL ARIZONA L",
                  "timestamp": "2025-08-29T00:00:00Z",
                  "description": "CR LADYWELL ARIZONA L SALARY AUGUST 2025",
                  "amount": 2575.24,
                  "id": "2d466586-2717-4bd0-bc2e-d2bf20993242",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-08-29T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "id": "6ac5bfa3-c855-45e4-8ef1-6bede326feb9",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "CAROLINE LEE",
                  "timestamp": "2025-08-29T00:00:00Z",
                  "description": "BP CAROLINE LEE From Se",
                  "amount": -90,
                  "rolling_account_balance": 2290.65,
                  "id": "3e5fdb0d-1823-4d6e-b451-f677efb5440f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Jacob",
                  "timestamp": "2025-08-30T00:00:00Z",
                  "description": "BP Jacob Holidayxx",
                  "amount": -245,
                  "rolling_account_balance": 2045.65,
                  "id": "150be101-6bb1-4b6c-909a-c8e9c533708c",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-08-31T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "id": "3633bed0-2cfc-4db5-b1c7-d0757f514364",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-08-31T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "rolling_account_balance": 1745.65,
                  "id": "a156a3a3-fcf1-4c61-98ac-d0171fc784ac",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-08-31T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "id": "855a91b7-8f5c-4866-9bd7-fdc72b4af346",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "DD PROSPECT UNION",
                  "amount": -13.33,
                  "id": "5cc88288-d369-4ebd-88c9-9a2cd75a69d5",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "DD NEST",
                  "amount": -60,
                  "id": "444c1dbe-116b-4aab-839b-189cdb412e6e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM SAVE",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "3acdac30-7262-4fd6-9e64-210b9ed9da7b",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "cadb0d06-2792-40e1-b321-cc7969bfab91",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "0a92489f-47a6-4384-a38e-da9057fc95db",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX PROPERTY",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO DEX PROPERTY 35 SUTHERLAND RM 1",
                  "amount": -480,
                  "rolling_account_balance": 957.32,
                  "id": "dac04f2b-9549-467e-a684-fcd7167741d0",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "DD PROSPECT UNION",
                  "amount": -13.33,
                  "id": "37d6717f-7204-43ec-84bb-b276d2755ef7",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "DD NEST",
                  "amount": -60,
                  "id": "478ec493-655c-48b8-933b-577bb620fa42",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM SAVE",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "db2b6b98-fb73-4827-aafe-e9fff5a83136",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "a6effef9-3137-4b3e-8fd5-a97d5c064e00",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B",
                  "timestamp": "2025-09-01T00:00:00Z",
                  "description": "SO Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "37a8b581-5045-4d3c-95df-a0c1444e9692",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-04T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "rolling_account_balance": 757.32,
                  "id": "71f05de8-1388-4207-ae5f-2ca8c68fcc3b",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-05T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "rolling_account_balance": 557.32,
                  "id": "8fd28ae6-dc19-4e4b-b892-599bc8cfa5cf",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-07T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -150,
                  "id": "ce9f6978-3b3c-4551-8367-0c93dbd1cc89",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "KATIE HARRISON",
                  "timestamp": "2025-09-07T00:00:00Z",
                  "description": "CR KATIE HARRISON CHASE",
                  "amount": 80,
                  "rolling_account_balance": 487.32,
                  "id": "fe2584da-a62a-4ba6-b342-23fbc6b0f97f",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-07T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -150,
                  "id": "090ecd3a-c3c8-4b23-92b3-49e2ce9614b4",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-08T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "id": "82f70dd8-ed5c-467a-bf5f-ebdb199f68ca",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R",
                  "timestamp": "2025-09-08T00:00:00Z",
                  "description": "BP Arch-Mo J R Iou",
                  "amount": 100,
                  "rolling_account_balance": 537.32,
                  "id": "a45ac5a4-c462-45a0-b71e-db4d284c9110",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-08T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "id": "b6a6c8cb-d72d-4207-880e-3504367e04fa",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-12T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -60,
                  "id": "eba9dd8c-dd8f-4775-af86-cf104abfb659",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Katie Havanna Reen",
                  "timestamp": "2025-09-12T00:00:00Z",
                  "description": "OBP Katie Havanna Reen SPLITWISE-PAYMENT",
                  "amount": -15.25,
                  "id": "3f15166a-574a-4f3a-8747-961e2c79d88b",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "OBP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-12T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -280,
                  "rolling_account_balance": 182.07,
                  "id": "1fe221de-f3ba-48fe-9564-84cf0f2b95d2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-12T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -60,
                  "id": "fb9432da-6d31-45bb-94ce-ba83e1337c39",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Katie Havanna Reen",
                  "timestamp": "2025-09-12T00:00:00Z",
                  "description": "OBP Katie Havanna Reen SPLITWISE-PAYMENT",
                  "amount": -15.25,
                  "id": "a99af3fb-a2e9-4600-8130-1378110476b3",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "OBP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-14T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -180,
                  "rolling_account_balance": 2.07,
                  "id": "333bdd32-7bf2-4802-83f8-2d568d6ddca2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NHSBSA",
                  "timestamp": "2025-09-18T00:00:00Z",
                  "description": "DD NHSBSA PPC 2",
                  "amount": -11.45,
                  "id": "ff155fa3-7558-4d9d-96b6-5a941ca7dabb",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "",
                  "timestamp": "2025-09-18T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 200,
                  "id": "b2229847-7132-4733-a342-ba24b776fe16",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-18T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -90,
                  "rolling_account_balance": 100.62,
                  "id": "b1811952-4e81-4980-af93-c722de4756fa",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NHSBSA PPC 2",
                  "timestamp": "2025-09-18T00:00:00Z",
                  "description": "DD NHSBSA PPC 2",
                  "amount": -11.45,
                  "id": "db0e1cec-5c5c-41e7-b61a-95b3cda1a98a",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "",
                  "timestamp": "2025-09-18T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 200,
                  "id": "bedb8a6c-956e-435d-b17f-51683b54e795",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-20T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 0.62,
                  "id": "88be2410-9882-452c-bb63-cfdeefd1f7a2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ",
                  "timestamp": "2025-09-23T00:00:00Z",
                  "description": "CR LEE CAJ favourite parent",
                  "amount": 100,
                  "rolling_account_balance": 100.62,
                  "id": "ab5d57cd-b9cf-4475-99bd-88c08704adc3",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-25T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 0.62,
                  "id": "50daa6c9-82d6-4dc8-81a3-f68d0b81cc44",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LADYWELL ARIZONA L",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "CR LADYWELL ARIZONA L SALARY SEPTEMBER 2",
                  "amount": 2162.24,
                  "id": "d8ce6a43-3cc1-4549-8b49-49f05ee6ce97",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "CAROLINE LEE",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "BP CAROLINE LEE From Se",
                  "amount": -80,
                  "id": "f4e64bf2-7561-4698-8a40-5c4c16561379",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "id": "94c1ca78-ebbc-43fd-b325-60cae3035a8d",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "CAROLINE LEE",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "BP CAROLINE LEE From Se",
                  "amount": -110,
                  "rolling_account_balance": 1772.86,
                  "id": "99d70e7d-a03e-429d-9d54-f025681505e2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LADYWELL ARIZONA L",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "CR LADYWELL ARIZONA L SALARY SEPTEMBER 2",
                  "amount": 2162.24,
                  "id": "07bc1b6b-0abd-4d79-81fa-7e20e1de4bdc",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "CAROLINE LEE",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "BP CAROLINE LEE From Se",
                  "amount": -80,
                  "id": "d5e8c0c1-b6b2-47a8-9711-cfaf68b926e2",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-26T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -200,
                  "id": "1158f471-8ff2-4458-b0b6-21e6ab13f1c3",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Jacob",
                  "timestamp": "2025-09-28T00:00:00Z",
                  "description": "BP Jacob Holidayxx",
                  "amount": -200,
                  "rolling_account_balance": 1572.86,
                  "id": "910911cd-2761-4e9c-b00f-e8bcfc05e260",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-29T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 1472.86,
                  "id": "0dc3d8bc-f23f-440b-876c-e419abaa4178",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-30T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -400,
                  "id": "ec7d7c5a-1c65-4544-bffb-0a1bff52539c",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX Property Manag",
                  "timestamp": "2025-09-30T00:00:00Z",
                  "description": "BP DEX Property Manag 35 Sutherland RM 1",
                  "amount": -15,
                  "rolling_account_balance": 1057.86,
                  "id": "f55d11b5-39d7-4d6e-a3c2-2bc4d46c7b0a",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart",
                  "timestamp": "2025-09-30T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -400,
                  "id": "67dd0e12-7a71-433f-8a48-955fb47fa4e3",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "DD PROSPECT UNION",
                  "amount": -13.33,
                  "id": "dfb58b00-2eff-4215-912a-f0c78c8dcef0",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "DD NEST",
                  "amount": -60,
                  "id": "f0483bc5-8e4b-45b1-b8f9-b19bce9d4ee9",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM SAVE",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "6b7ff810-98ee-43b4-a0ef-29671e188261",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R CAR",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "23a7e4ba-ac19-42a1-ba6b-98118a8397a1",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B VODAFONE",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "5c210def-7546-4858-a309-ec6a8792360d",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX PROPERTY 35 SUTHERLAND RM 1",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO DEX PROPERTY 35 SUTHERLAND RM 1",
                  "amount": -480,
                  "id": "ce0a64e4-6afd-407e-a5a8-b6668b4b5e30",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ Freckle tattoo",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "CR LEE CAJ Freckle tattoo",
                  "amount": 70,
                  "rolling_account_balance": 339.53,
                  "id": "4131d8fd-f7ee-4800-b68e-c27fb2705d23",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "PROSPECT UNION",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "DD PROSPECT UNION",
                  "amount": -13.33,
                  "id": "e5341f24-0a2e-4406-88a7-d16e529689b5",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "NEST",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "DD NEST",
                  "amount": -60,
                  "id": "5b8ff667-131b-4ba0-aed5-291980cb8e16",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "STEWART S *HSM SAVE",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO STEWART S *HSM SAVE",
                  "amount": -150,
                  "id": "e284bb67-a3ad-435a-a905-0d4bbca9d4f6",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R CAR",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO Arch-Mo J R CAR",
                  "amount": -70,
                  "id": "7448df4b-aa91-47ae-be7b-4b956d921a25",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arc-McDo B VODAFONE",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO Arc-McDo B VODAFONE",
                  "amount": -15,
                  "id": "1b03f2ef-0ed0-4cca-9c45-38aba887e891",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX PROPERTY 35 SUTHERLAND RM 1",
                  "timestamp": "2025-10-01T00:00:00Z",
                  "description": "SO DEX PROPERTY 35 SUTHERLAND RM 1",
                  "amount": -480,
                  "id": "3759fb39-56a7-4d12-9a1a-bfe4edd5091b",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "SO",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "DEX Property Manag 35 Sutherland RM 1",
                  "timestamp": "2025-10-02T00:00:00Z",
                  "description": "BP DEX Property Manag 35 Sutherland RM 1",
                  "amount": -15,
                  "rolling_account_balance": 324.53,
                  "id": "f42e248f-2fda-4518-aaf7-6ed07c68212b",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-07T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 274.53,
                  "id": "59e39591-f2fc-4c00-b8d9-5389f8270196",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-08T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -50,
                  "rolling_account_balance": 224.53,
                  "id": "bebcc2a0-5d15-4387-99eb-bb2e3f6ccb98",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ FRECKLE TATTOO",
                  "timestamp": "2025-10-10T00:00:00Z",
                  "description": "CR LEE CAJ FRECKLE TATTOO",
                  "amount": 10,
                  "rolling_account_balance": 234.53,
                  "id": "a4b23fc4-a5ae-4d70-ab7e-c30133205a6e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-13T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -60,
                  "rolling_account_balance": 174.53,
                  "id": "54dc95ca-9800-4ad3-a714-4c28f33f37af",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-14T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -70,
                  "rolling_account_balance": 104.53,
                  "id": "fd19c12b-0216-4b6d-a9f0-a0b665aac64c",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Katie Havanna Reen SPLITWISE-PAYMENT",
                  "timestamp": "2025-10-15T00:00:00Z",
                  "description": "OBP Katie Havanna Reen SPLITWISE-PAYMENT",
                  "amount": -20.33,
                  "rolling_account_balance": 84.2,
                  "id": "2b685efc-1760-4766-90c5-4d63aceada7e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "OBP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-18T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -60,
                  "rolling_account_balance": 24.2,
                  "id": "95931a81-3882-4cb3-9ec5-0ab69cd24280",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 130,
                  "id": "eb750cf4-4c76-4d98-bd84-0b2ae818d74a",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -130,
                  "id": "1c4fd3f0-5278-4a89-91fa-95d2542afeaa",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 20,
                  "id": "16a7f942-5ebc-4401-9a6d-867175a74ce4",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -30,
                  "rolling_account_balance": 14.2,
                  "id": "4db514fe-e4e3-42c2-af0d-5d6bc2949101",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 130,
                  "id": "b2a8cced-3227-462b-9033-f3e8d2c9a83d",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -130,
                  "id": "40139453-6f93-40d0-b3a3-eac2092734b0",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "402055 40163414 INTERNET TRANSFER",
                  "timestamp": "2025-10-19T00:00:00Z",
                  "description": "TFR 402055 40163414 INTERNET TRANSFER",
                  "amount": 20,
                  "id": "b05e63bd-685f-43b0-a7f7-7fa07104f222",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "TFR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "NHSBSA PPC 2",
                  "timestamp": "2025-10-20T00:00:00Z",
                  "description": "DD NHSBSA PPC 2",
                  "amount": -11.45,
                  "id": "c477abc3-feb0-4ccc-b174-51d508b1a90e",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "LEE CAJ Kailab bday",
                  "timestamp": "2025-10-20T00:00:00Z",
                  "description": "CR LEE CAJ Kailab bday",
                  "amount": 150,
                  "rolling_account_balance": 152.75,
                  "id": "80758dde-2044-49c9-ab33-1d7303c44d44",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "NHSBSA PPC 2",
                  "timestamp": "2025-10-20T00:00:00Z",
                  "description": "DD NHSBSA PPC 2",
                  "amount": -11.45,
                  "id": "60a43bf0-43b4-4cf4-9d47-e361d2ca9911",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "DD",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "JACOB ARCHER-MORAN work",
                  "timestamp": "2025-10-22T00:00:00Z",
                  "description": "CR JACOB ARCHER-MORAN work",
                  "amount": 150,
                  "id": "a1f1e471-6ba2-4743-9bfd-ff4403f80c1d",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-22T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -110,
                  "rolling_account_balance": 192.75,
                  "id": "fc2994d5-d240-4c2a-b008-dee999d416a8",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "JACOB ARCHER-MORAN work",
                  "timestamp": "2025-10-22T00:00:00Z",
                  "description": "CR JACOB ARCHER-MORAN work",
                  "amount": 150,
                  "id": "e3999d67-c175-4e01-a8d1-acd910ffe838",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "CR",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-24T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -180,
                  "rolling_account_balance": 12.75,
                  "id": "3c1fa2b5-57f1-4004-83a6-8d46fb2c4c87",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R Iou",
                  "timestamp": "2025-10-27T00:00:00Z",
                  "description": "B Arch-Mo J R Iou",
                  "amount": 100,
                  "id": "075db203-c337-4556-9bb8-cf8154302c15",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "B",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-27T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -100,
                  "rolling_account_balance": 12.75,
                  "id": "9d014384-7b11-46f8-8403-861fe1f85256",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R Iou",
                  "timestamp": "2025-10-27T00:00:00Z",
                  "description": "B Arch-Mo J R Iou",
                  "amount": 100,
                  "id": "17f858bc-f4e6-43e9-aabf-f04b866ed506",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "B",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Arch-Mo J R Iou",
                  "timestamp": "2025-10-28T00:00:00Z",
                  "description": "BP Arch-Mo J R Iou",
                  "amount": 110,
                  "id": "9e7184c1-0dc7-42eb-99d0-13d09ef43241",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-28T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -110,
                  "rolling_account_balance": 12.75,
                  "id": "57ad9380-ce62-44e3-a0e3-eeead29322f6",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                },
                {
                  "merchant_name": "Arch-Mo J R Iou",
                  "timestamp": "2025-10-28T00:00:00Z",
                  "description": "BP Arch-Mo J R Iou",
                  "amount": 110,
                  "id": "537b3bdc-3585-4073-9d14-cb3bd076c738",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "CREDIT"
                },
                {
                  "merchant_name": "Se Stewart Monzo-CLGNP",
                  "timestamp": "2025-10-30T00:00:00Z",
                  "description": "BP Se Stewart Monzo-CLGNP",
                  "amount": -10,
                  "rolling_account_balance": 2.75,
                  "id": "9d21a764-3b6a-4241-bbb5-94346b6d9926",
                  "account_id": "40163406",
                  "currency": "GBP",
                  "category": "BP",
                  "classification": null,
                  "type": "DEBIT"
                }
              ]
            }
          },
          "documents": [
            {
              "id": "d472vf523amg030w7vr0",
              "type": "bank-statement"
            },
            {
              "id": "d472vfd23amg030w7vrg",
              "type": "bank-statement"
            },
            {
              "id": "d472vfn23amg030w7vs0",
              "type": "bank-statement"
            },
            {
              "id": "d472vfx23amg030w7vt0",
              "type": "bank-statement"
            },
            {
              "id": "d472vg623amg030w7vtg",
              "type": "bank-statement"
            },
            {
              "id": "d472vge23amg030w7vv0",
              "type": "bank-statement"
            }
          ],
          "analysis": {
            "id": "4151814620",
            "repeating_transactions": [
              {
                "sort_score": 2575.24,
                "items": [
                  "07bc1b6b-0abd-4d79-81fa-7e20e1de4bdc",
                  "2d466586-2717-4bd0-bc2e-d2bf20993242",
                  "d8ce6a43-3cc1-4549-8b49-49f05ee6ce97"
                ]
              },
              {
                "sort_score": 480,
                "items": [
                  "091a1417-6f9d-4301-834a-893776f70189",
                  "3759fb39-56a7-4d12-9a1a-bfe4edd5091b",
                  "ce0a64e4-6afd-407e-a5a8-b6668b4b5e30",
                  "dac04f2b-9549-467e-a684-fcd7167741d0"
                ]
              },
              {
                "sort_score": 400,
                "items": [
                  "090ecd3a-c3c8-4b23-92b3-49e2ce9614b4",
                  "0dc3d8bc-f23f-440b-876c-e419abaa4178",
                  "1158f471-8ff2-4458-b0b6-21e6ab13f1c3",
                  "1c4fd3f0-5278-4a89-91fa-95d2542afeaa",
                  "1fe221de-f3ba-48fe-9564-84cf0f2b95d2",
                  "333bdd32-7bf2-4802-83f8-2d568d6ddca2",
                  "3633bed0-2cfc-4db5-b1c7-d0757f514364",
                  "3c1fa2b5-57f1-4004-83a6-8d46fb2c4c87",
                  "40139453-6f93-40d0-b3a3-eac2092734b0",
                  "4db514fe-e4e3-42c2-af0d-5d6bc2949101",
                  "50daa6c9-82d6-4dc8-81a3-f68d0b81cc44",
                  "54dc95ca-9800-4ad3-a714-4c28f33f37af",
                  "550bc2cf-0cd6-416b-8a2a-7a72f876fb91",
                  "57ad9380-ce62-44e3-a0e3-eeead29322f6",
                  "59e39591-f2fc-4c00-b8d9-5389f8270196",
                  "5d22cd18-a8e5-4c3d-ae5e-a7521cf60955",
                  "5d27588c-4266-41be-8eb6-683123082255",
                  "67dd0e12-7a71-433f-8a48-955fb47fa4e3",
                  "6ac5bfa3-c855-45e4-8ef1-6bede326feb9",
                  "71f05de8-1388-4207-ae5f-2ca8c68fcc3b",
                  "74137577-187f-4463-9783-7c877fcce6d1",
                  "7f7a993f-4b9c-4d91-9524-0e2d401d10ac",
                  "82f70dd8-ed5c-467a-bf5f-ebdb199f68ca",
                  "855a91b7-8f5c-4866-9bd7-fdc72b4af346",
                  "8814461c-b7b1-4da5-be9a-ae93066ad667",
                  "88be2410-9882-452c-bb63-cfdeefd1f7a2",
                  "8fd28ae6-dc19-4e4b-b892-599bc8cfa5cf",
                  "94c1ca78-ebbc-43fd-b325-60cae3035a8d",
                  "95931a81-3882-4cb3-9ec5-0ab69cd24280",
                  "9d014384-7b11-46f8-8403-861fe1f85256",
                  "9d21a764-3b6a-4241-bbb5-94346b6d9926",
                  "a156a3a3-fcf1-4c61-98ac-d0171fc784ac",
                  "b1811952-4e81-4980-af93-c722de4756fa",
                  "b6a6c8cb-d72d-4207-880e-3504367e04fa",
                  "bebcc2a0-5d15-4387-99eb-bb2e3f6ccb98",
                  "c78819f5-6e44-47c8-bd77-1575216314ea",
                  "ca7caec7-f74f-4273-8cc1-a9a2a25fa912",
                  "ce9f6978-3b3c-4551-8367-0c93dbd1cc89",
                  "d1945c03-afa3-4877-8ba9-4a07398240b2",
                  "d25d875c-1c2e-4ce3-b118-031cdc2d0393",
                  "eba9dd8c-dd8f-4775-af86-cf104abfb659",
                  "ec7d7c5a-1c65-4544-bffb-0a1bff52539c",
                  "fb9432da-6d31-45bb-94ce-ba83e1337c39",
                  "fc2994d5-d240-4c2a-b008-dee999d416a8",
                  "fd19c12b-0216-4b6d-a9f0-a0b665aac64c"
                ]
              },
              {
                "sort_score": 300,
                "items": [
                  "0e16d88a-c79c-44d6-8fcb-c1bb6952724f",
                  "10963733-05e5-405a-94c5-d7580b390d63",
                  "27d47a64-4632-4973-8838-7b8b5ab85839",
                  "467dcee0-769f-4f84-b710-fae215dbca63",
                  "48b02a93-b68d-4384-9800-7053bc9a48d9",
                  "4f98cc79-7d3b-4201-968f-dba556783460",
                  "73171bb4-af3c-46d0-ab1e-f207b2d118e4",
                  "79865522-6217-4bff-a470-723d0bee6d73",
                  "7faa0e99-67c6-4d34-861d-3bcbddadeb10",
                  "9099c841-dec8-4bec-8290-16d2f274bcf3",
                  "942cadee-2578-4cb9-98e3-bc684d9fd184",
                  "af6a348e-f528-4a58-af07-02fb91e9c9b1",
                  "c5c8cc39-44dd-4467-ba8b-d115ee536ebd",
                  "d98c90f8-49e8-4973-8884-d0f9d0cdddf2",
                  "ddb0edbd-2d9a-4eb9-8c48-6f9b5646107d",
                  "ff7861ec-d2ff-49bc-ad98-17c256abdddf"
                ]
              },
              {
                "sort_score": 245,
                "items": [
                  "150be101-6bb1-4b6c-909a-c8e9c533708c",
                  "910911cd-2761-4e9c-b00f-e8bcfc05e260"
                ]
              },
              {
                "sort_score": 200,
                "items": [
                  "0132d86a-54ef-495f-b58a-3a87e865006f",
                  "16a7f942-5ebc-4401-9a6d-867175a74ce4",
                  "b05e63bd-685f-43b0-a7f7-7fa07104f222",
                  "b2229847-7132-4733-a342-ba24b776fe16",
                  "b2a8cced-3227-462b-9033-f3e8d2c9a83d",
                  "bedb8a6c-956e-435d-b17f-51683b54e795",
                  "eb750cf4-4c76-4d98-bd84-0b2ae818d74a",
                  "eb8ede2b-24ec-4da9-84ce-989f5a42af1f",
                  "fcaba9eb-490f-45e0-8dc3-c6dbec615496"
                ]
              },
              {
                "sort_score": 150,
                "items": [
                  "3acdac30-7262-4fd6-9e64-210b9ed9da7b",
                  "6b7ff810-98ee-43b4-a0ef-29671e188261",
                  "93cd5860-cb98-4be2-be2d-87dddf569c35",
                  "db2b6b98-fb73-4827-aafe-e9fff5a83136",
                  "e284bb67-a3ad-435a-a905-0d4bbca9d4f6"
                ]
              },
              {
                "sort_score": 150,
                "items": [
                  "a1f1e471-6ba2-4743-9bfd-ff4403f80c1d",
                  "e3999d67-c175-4e01-a8d1-acd910ffe838"
                ]
              },
              {
                "sort_score": 110,
                "items": [
                  "309569df-91e5-4c73-a940-13e4843d534e",
                  "537b3bdc-3585-4073-9d14-cb3bd076c738",
                  "9e7184c1-0dc7-42eb-99d0-13d09ef43241",
                  "a45ac5a4-c462-45a0-b71e-db4d284c9110"
                ]
              },
              {
                "sort_score": 110,
                "items": [
                  "3e5fdb0d-1823-4d6e-b451-f677efb5440f",
                  "99d70e7d-a03e-429d-9d54-f025681505e2",
                  "d5e8c0c1-b6b2-47a8-9711-cfaf68b926e2",
                  "f4e64bf2-7561-4698-8a40-5c4c16561379"
                ]
              },
              {
                "sort_score": 100,
                "items": [
                  "075db203-c337-4556-9bb8-cf8154302c15",
                  "17f858bc-f4e6-43e9-aabf-f04b866ed506"
                ]
              },
              {
                "sort_score": 70,
                "items": [
                  "23a7e4ba-ac19-42a1-ba6b-98118a8397a1",
                  "5b0b4661-13bb-42c8-b0af-f6771995eba2",
                  "7448df4b-aa91-47ae-be7b-4b956d921a25",
                  "a6effef9-3137-4b3e-8fd5-a97d5c064e00",
                  "cadb0d06-2792-40e1-b321-cc7969bfab91"
                ]
              },
              {
                "sort_score": 70,
                "items": [
                  "4131d8fd-f7ee-4800-b68e-c27fb2705d23",
                  "a4b23fc4-a5ae-4d70-ab7e-c30133205a6e"
                ]
              },
              {
                "sort_score": 60,
                "items": [
                  "12404151-42fc-42cf-a102-d698dc9b1ab2",
                  "444c1dbe-116b-4aab-839b-189cdb412e6e",
                  "478ec493-655c-48b8-933b-577bb620fa42",
                  "5b8ff667-131b-4ba0-aed5-291980cb8e16",
                  "f0483bc5-8e4b-45b1-b8f9-b19bce9d4ee9"
                ]
              },
              {
                "sort_score": 20.33,
                "items": [
                  "2b685efc-1760-4766-90c5-4d63aceada7e",
                  "3f15166a-574a-4f3a-8747-961e2c79d88b",
                  "a99af3fb-a2e9-4600-8130-1378110476b3",
                  "e1f3f7b8-5b53-4dbd-9ce0-89fcd8e65fbb"
                ]
              },
              {
                "sort_score": 15,
                "items": [
                  "0a92489f-47a6-4384-a38e-da9057fc95db",
                  "12d8601d-9b0d-4aaa-be25-a2a2c07634d9",
                  "1b03f2ef-0ed0-4cca-9c45-38aba887e891",
                  "37a8b581-5045-4d3c-95df-a0c1444e9692",
                  "5c210def-7546-4858-a309-ec6a8792360d"
                ]
              },
              {
                "sort_score": 15,
                "items": [
                  "f42e248f-2fda-4518-aaf7-6ed07c68212b",
                  "f55d11b5-39d7-4d6e-a3c2-2bc4d46c7b0a"
                ]
              },
              {
                "sort_score": 13.33,
                "items": [
                  "37d6717f-7204-43ec-84bb-b276d2755ef7",
                  "5cc88288-d369-4ebd-88c9-9a2cd75a69d5",
                  "78ed938c-c5f4-4737-93df-bf0b8e085d8e",
                  "dfb58b00-2eff-4215-912a-f0c78c8dcef0",
                  "e5341f24-0a2e-4406-88a7-d16e529689b5"
                ]
              },
              {
                "sort_score": 11.45,
                "items": [
                  "21646963-a1b1-4935-8e8c-134622bc482f",
                  "60a43bf0-43b4-4cf4-9d47-e361d2ca9911",
                  "c477abc3-feb0-4ccc-b174-51d508b1a90e",
                  "db0e1cec-5c5c-41e7-b61a-95b3cda1a98a",
                  "ff155fa3-7558-4d9d-96b6-5a941ca7dabb"
                ]
              }
            ],
            "large_one_off_transactions": [
              "89137c17-da6f-414b-b221-496551762f06",
              "2ffd97ed-ce60-4fe4-bb86-53ce568a7a02",
              "dc55407c-f7e7-4026-b815-53b69d1d1e85",
              "fdc1f9f6-319a-4027-bd94-2c74afdbc070",
              "03c57712-eab4-4574-b022-607336d5b059",
              "39dd0f39-1cd7-4da0-92b7-dd4ef640b8d1",
              "f82f3579-3024-44f6-a2f8-af19162b97ee",
              "fe049d6e-cc8d-42b2-8e02-9fad81aef643",
              "5e7a8546-cca8-46e5-8add-40a412b52ec6",
              "18c9a740-dc6c-4eb9-8a5b-fdffd7a3564c",
              "45c7dc04-1865-460f-a857-cfad071e6831",
              "80758dde-2044-49c9-ab33-1d7303c44d44",
              "ab5d57cd-b9cf-4475-99bd-88c08704adc3",
              "fe2584da-a62a-4ba6-b342-23fbc6b0f97f",
              "1444e1f2-3fac-4c78-a8a1-4e0dd3407bc8"
            ],
            "sof_matches": {
              "salary_transactions": [
                "07bc1b6b-0abd-4d79-81fa-7e20e1de4bdc",
                "2d466586-2717-4bd0-bc2e-d2bf20993242",
                "d8ce6a43-3cc1-4549-8b49-49f05ee6ce97"
              ]
            }
          }
        },
        "data": {},
        "result": "clear",
        "documents": [
          "d472vf523amg030w7vr0",
          "d472vfd23amg030w7vrg",
          "d472vfn23amg030w7vs0",
          "d472vfx23amg030w7vt0",
          "d472vg623amg030w7vtg",
          "d472vge23amg030w7vv0"
        ],
        "id": "d472wpj23amg030w7xag",
        "status": "closed",
        "createdAt": "2025-11-07T17:37:29.988Z"
      },
      "bank:summary": {
        "breakdown": {},
        "data": {},
        "result": "unknown",
        "documents": [],
        "id": "d472q1c23amg030w7vng",
        "status": "rejected",
        "createdAt": "2025-11-07T17:25:25.193Z"
      },
      "bank:statement": {
        "breakdown": {},
        "data": {},
        "result": "unknown",
        "documents": [],
        "id": "d472q1423amg030w7vmg",
        "status": "rejected",
        "createdAt": "2025-11-07T17:25:24.971Z"
      },
      "address": {
        "result": "fail",
        "status": "closed",
        "data": {
          "quality": 0
        }
      },
      "documents:sale-assets": {
        "breakdown": {
          "documents": [
            {
              "id": "d472wf923amg030w7wxg",
              "type": "sale-assets"
            }
          ]
        },
        "data": {},
        "result": "clear",
        "documents": [
          "d472wf923amg030w7wxg"
        ],
        "id": "d472wpa23amg030w7x5g",
        "status": "closed",
        "createdAt": "2025-11-07T17:37:29.352Z"
      },
      "biometrics": {
        "result": "consider",
        "status": "unobtainable",
        "data": {}
      },
      "identity": {
        "breakdown": {
          "biometrics": {
            "result": "consider",
            "status": "unobtainable"
          },
          "document": {
            "name": "document",
            "breakdown": {
              "compromised_document": {
                "result": "clear"
              },
              "data_consistency": {
                "breakdown": {
                  "first_name": {
                    "properties": {},
                    "result": "clear"
                  },
                  "date_of_expiry": {
                    "properties": {},
                    "result": "clear"
                  },
                  "date_of_birth": {
                    "properties": {},
                    "result": "clear"
                  },
                  "last_name": {
                    "properties": {},
                    "result": "clear"
                  },
                  "nationality": {
                    "properties": {},
                    "result": "clear"
                  },
                  "issuing_country": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_numbers": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_type": {
                    "properties": {},
                    "result": "clear"
                  },
                  "gender": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "data_comparison": {
                "breakdown": {
                  "first_name": {
                    "properties": {},
                    "result": "clear"
                  },
                  "date_of_expiry": {
                    "properties": {},
                    "result": "clear"
                  },
                  "date_of_birth": {
                    "properties": {},
                    "result": "clear"
                  },
                  "last_name": {
                    "properties": {},
                    "result": "clear"
                  },
                  "issuing_country": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_numbers": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_type": {
                    "properties": {},
                    "result": "clear"
                  },
                  "gender": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "data_validation": {
                "breakdown": {
                  "mrz": {
                    "properties": {},
                    "result": "clear"
                  },
                  "date_of_birth": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_numbers": {
                    "properties": {},
                    "result": "clear"
                  },
                  "expiry_date": {
                    "properties": {},
                    "result": "clear"
                  },
                  "document_expiration": {
                    "properties": {},
                    "result": "clear"
                  },
                  "gender": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "image_integrity": {
                "breakdown": {
                  "colour_picture": {
                    "properties": {},
                    "result": "clear"
                  },
                  "conclusive_document_quality": {
                    "properties": {},
                    "result": "clear"
                  },
                  "image_quality": {
                    "properties": {},
                    "result": "clear"
                  },
                  "supported_document": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "visual_authenticity": {
                "breakdown": {
                  "face_detection": {
                    "properties": {},
                    "result": "clear"
                  },
                  "fonts": {
                    "properties": {},
                    "result": "clear"
                  },
                  "picture_face_integrity": {
                    "properties": {},
                    "result": "clear"
                  },
                  "original_document_present": {
                    "properties": {},
                    "result": "clear"
                  },
                  "security_features": {
                    "properties": {},
                    "result": "clear"
                  },
                  "digital_tampering": {
                    "properties": {},
                    "result": "clear"
                  },
                  "template": {
                    "properties": {},
                    "result": "clear"
                  },
                  "other": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "age_validation": {
                "breakdown": {
                  "minimum_accepted_age": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "police_record": {
                "result": "clear"
              }
            },
            "result": "clear",
            "documents": [
              {
                "id": "fe4a1818-cdee-4352-bf68-f6984737cfc6"
              },
              {
                "id": "763caf59-603c-4805-89d2-606db4b2b060"
              }
            ],
            "id": "dd84fb2a-22ee-4198-9bb4-cc31181a29dc",
            "properties": {
              "first_name": "Sé",
              "date_of_expiry": "2031-05-28",
              "issuing_date": "2018-08-16",
              "date_of_birth": "1990-01-01",
              "last_name": "Stewart",
              "issuing_country": "GBR",
              "document_numbers": [
                {
                  "type": "document_number",
                  "value": "999999999"
                }
              ],
              "document_type": "passport"
            },
            "status": "complete",
            "created_at": "2025-11-07T17:38:19Z",
            "href": "/v3.6/reports/dd84fb2a-22ee-4198-9bb4-cc31181a29dc",
            "sub_result": "clear"
          },
          "nfc": {
            "result": "consider",
            "status": "unobtainable"
          },
          "facial_similarity_video": {
            "name": "facial_similarity_video",
            "breakdown": {
              "face_comparison": {
                "breakdown": {
                  "face_match": {
                    "properties": {
                      "document_id": "763caf59-603c-4805-89d2-606db4b2b060",
                      "live_video_id": "20b40a92-2295-403e-af81-dcfb25f3a976",
                      "score": 0.6512
                    },
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "image_integrity": {
                "breakdown": {
                  "face_detected": {
                    "properties": {},
                    "result": "clear"
                  },
                  "source_integrity": {
                    "properties": {},
                    "result": "clear"
                  }
                },
                "result": "clear"
              },
              "visual_authenticity": {
                "breakdown": {
                  "liveness_detected": {
                    "properties": {},
                    "result": "clear"
                  },
                  "spoofing_detection": {
                    "properties": {
                      "score": 0.9512
                    },
                    "result": "clear"
                  }
                },
                "result": "clear"
              }
            },
            "result": "clear",
            "documents": [
              {
                "id": "fe4a1818-cdee-4352-bf68-f6984737cfc6"
              },
              {
                "id": "763caf59-603c-4805-89d2-606db4b2b060"
              }
            ],
            "id": "2cd98de4-3996-48df-803c-da26b3efbd58",
            "properties": {},
            "status": "complete",
            "created_at": "2025-11-07T17:38:26Z",
            "href": "/v3.6/reports/2cd98de4-3996-48df-803c-da26b3efbd58"
          }
        },
        "data": {
          "dob": "2000-01-05T00:00:00.000Z",
          "name": {
            "first": "Sé",
            "last": "Stewart",
            "other": "Idris"
          }
        },
        "result": "consider",
        "documents": [
          "d472x5w23amg030w7xtg"
        ],
        "id": "d472x5c23amg030w7xn0",
        "status": "closed",
        "createdAt": "2025-11-07T17:38:29.711Z"
      },
      "documents:selfie": {
        "breakdown": {
          "documents": [
            {
              "id": "d472x5m23amg030w7xq0",
              "type": "selfie"
            }
          ]
        },
        "data": {},
        "result": "unknown",
        "documents": [
          "d472x5m23amg030w7xq0"
        ],
        "id": "d472x5m23amg030w7xp0",
        "status": "complete",
        "createdAt": "2025-11-07T17:38:30.434Z"
      },
      "footprint": {
        "breakdown": {
          "data_count": {
            "properties": {
              "score": 0
            },
            "result": "consider"
          },
          "data_quality": {
            "properties": {
              "score": 0
            },
            "result": "consider"
          },
          "service_name": "Authenticateplus",
          "documents": [
            {
              "id": "d472x2423amg030w7xf0",
              "type": "poa"
            }
          ],
          "rules": [
            {
              "id": "U000",
              "name": "",
              "score": 0,
              "text": "No trace of supplied Address(es), or manual Authentication required by the Applicant"
            }
          ]
        },
        "data": {
          "dob": "2000-01-05T00:00:00.000Z",
          "name": {
            "first": "Sé",
            "last": "Stewart",
            "other": "Idris"
          },
          "address": {
            "postcode": "TR15 2ND",
            "country": "GBR",
            "street": "Southgate Street",
            "building_number": "94",
            "town": "Redruth"
          }
        },
        "result": "fail",
        "documents": [
          "d472x2423amg030w7xf0"
        ],
        "id": "d472x2c23amg030w7xgg",
        "status": "closed",
        "createdAt": "2025-11-07T17:38:17.650Z"
      }
    },
    "consumerPhone": "+447493580033",
    "pdfReady": true,
    "checkType": "electronic-id",
    "initiatedAt": "2025-11-06T16:37:23.440Z",
    "considerReasons": [
      "address verification",
      "digital footprint",
      "document integrity"
    ],
    "pdfS3Key": "protected/zaRRkhW",
    "consumerName": "Se Idris Stewart",
    "tasks": [
      "report:identity",
      "report:footprint",
      "report:peps",
      "documents:poa",
      "report:sof-v1",
      "report:bank-statement",
      "report:bank-summary"
    ],
    "updates": [
      {
        "timestamp": "2025-11-06T16:37:23.440Z",
        "update": "Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
      },
      {
        "timestamp": "2025-11-07T17:38:39.262Z",
        "update": "PEPs & Sanctions task completed"
      },
      {
        "timestamp": "2025-11-07T17:39:25.999Z",
        "update": "PDF received and uploaded to S3 - CONSIDER: address verification, digital footprint, document integrity"
      }
    ],
    "status": "closed",
    "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
    "piiData": {
      "name": {
        "first": "Sé",
        "last": "Stewart",
        "other": "Idris"
      },
      "address": {
        "postcode": "TR15 2ND",
        "country": "GBR",
        "street": "Southgate Street",
        "building_number": "94",
        "town": "Redruth"
      },
      "dob": "2000-01-05T00:00:00.000Z",
      "document": {
        "number": "999999999"
      }
    },
    "hasMonitoring": true,
    "thirdfortResponse": {
      "name": "Purchase of 21 Green Lane",
      "request": {
        "actor": {
          "name": "Se Idris Stewart",
          "phone": "+447493580033"
        },
        "tasks": [
          {
            "opts": {
              "nfc": "preferred"
            },
            "type": "report:identity"
          },
          {
            "opts": {
              "consent": false
            },
            "type": "report:footprint"
          },
          {
            "opts": {
              "monitored": true
            },
            "type": "report:peps"
          },
          {
            "type": "documents:poa"
          },
          {
            "type": "report:sof-v1"
          },
          {
            "type": "report:bank-statement"
          },
          {
            "type": "report:bank-summary"
          }
        ]
      },
      "ref": "21 Green Lane",
      "id": "d46cxge23amg030rw7r0",
      "reports": [],
      "status": "open",
      "metadata": {
        "notify": {
          "type": "http",
          "data": {
            "hmac_key": "0mF1p3cyDWZ51HIsGXPecer4a7uFQIXBk0JLO56Wr0U=",
            "method": "POST",
            "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
          }
        },
        "created_by": "d3t0auq9io6g00ak3kkg",
        "print": {
          "team": "Cashiers",
          "tenant": "Thurstan Hoskin Solicitors LLP",
          "user": "THS Bot"
        },
        "context": {
          "gid": "d3t2k5a9io6g00ak3km0",
          "uid": "d3t0auq9io6g00ak3kkg",
          "team_id": "d3t2k5a9io6g00ak3km0",
          "tenant_id": "d3t2ifa9io6g00ak3klg"
        },
        "ce": {
          "uri": "/v1/checks/4151797877"
        },
        "created_at": "2025-11-06T16:37:19.858Z"
      },
      "type": "v2",
      "opts": {
        "peps": {
          "monitored": true
        }
      }
    },
    "hasAlerts": true,
    "redFlags": [
      {
        "description": "Gifts Received",
        "supporting_data": "1 gift received - £5,000",
        "threshold_amount": "Any gifts flagged",
        "source": "Source of Funds"
      },
      {
        "description": "Declared savings > actual savings",
        "declared": "£5,000",
        "actual": "£2.75",
        "source": "Bank Linking"
      }
    ],
    "pdfAddedAt": "2025-11-07T17:39:25.998Z",
    "smsSent": true,
    "transactionId": "d46cxge23amg030rw7r0"
            },
            // Mock Check 5: Jacob Robert Archer-Moran - Electronic ID - Additional Only
            {
                "taskOutcomes": {
                  "sof:v1": {
                    "breakdown": {
                      "property": {
                        "address": {
                          "postcode": "TR11 5TL",
                          "country": "GBR",
                          "street": "Poplar Terrace",
                          "building_number": "1",
                          "town": "Falmouth"
                        },
                        "new_build": false,
                        "price": 45000000,
                        "stamp_duty": 500000
                      },
                      "funds": [
                        {
                          "data": {
                            "amount": 35000000,
                            "lender": "natwest",
                            "location": "GBR"
                          },
                          "metadata": {
                            "created_at": 1762452156261
                          },
                          "type": "fund:mortgage"
                        },
                        {
                          "data": {
                            "amount": 2000000,
                            "location": "GBR",
                            "people": [
                              {
                                "actor": true,
                                "name": "Jacob Robert Archer-Moran",
                                "incomes": [
                                  {
                                    "reference": "varies",
                                    "source": "salary",
                                    "description": "",
                                    "annual_total": 3000000,
                                    "frequency": "other"
                                  }
                                ],
                                "employment_status": "independent",
                                "phone": "+447506430094"
                              },
                              {
                                "actor": false,
                                "name": "Se Stewart",
                                "incomes": [
                                  {
                                    "reference": "ladywell",
                                    "source": "salary",
                                    "description": "",
                                    "annual_total": 3000000,
                                    "frequency": "monthly"
                                  }
                                ],
                                "employment_status": "employed",
                                "phone": "+447493580033"
                              }
                            ]
                          },
                          "metadata": {
                            "created_at": 1762452156419
                          },
                          "type": "fund:savings"
                        },
                        {
                          "data": {
                            "amount": 1000000,
                            "giftor": {
                              "contactable": true,
                              "name": "Barbara Archer",
                              "phone": "+447581408576",
                              "relationship": "Mother"
                            },
                            "location": "GBR",
                            "repayable": false
                          },
                          "metadata": {
                            "created_at": 1762452156581
                          },
                          "type": "fund:gift"
                        },
                        {
                          "data": {
                            "location": "GBR",
                            "amount": 5000000,
                            "date": "2025-11-03T00:00:00.000Z",
                            "status": "complete",
                            "lawyer": "Thurstan hoskin"
                          },
                          "metadata": {
                            "created_at": 1762452156739
                          },
                          "type": "fund:sale:property"
                        },
                        {
                          "data": {
                            "amount": 500000,
                            "description": "Van",
                            "location": "GBR"
                          },
                          "metadata": {
                            "created_at": 1762452156900
                          },
                          "type": "fund:sale:assets"
                        },
                        {
                          "data": {
                            "amount": 1000000,
                            "location": "GBR",
                            "type": "lisa"
                          },
                          "metadata": {
                            "created_at": 1762452157074
                          },
                          "type": "fund:htb"
                        },
                        {
                          "data": {
                            "location": "GBR",
                            "is_owner": true,
                            "amount": 1000000,
                            "date": "2025-08-12T00:00:00.000Z",
                            "from": "Mary archer"
                          },
                          "metadata": {
                            "created_at": 1762452157228
                          },
                          "type": "fund:inheritance"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [],
                    "id": "d46e6fs23amg030rw98g",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:04:47.285Z"
                  },
                  "documents:savings": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46e76c23amg030rw9f0",
                          "type": "savings"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46e76c23amg030rw9f0"
                    ],
                    "id": "d46e77423amg030rw9tg",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:06:20.615Z"
                  },
                  "documents:mortgage": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46e6wb23amg030rw9e0",
                          "type": "mortgage"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46e6wb23amg030rw9e0"
                    ],
                    "id": "d46e77423amg030rw9mg",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:06:20.074Z"
                  },
                  "documents:poa": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46e3v723amg030rw8z0",
                          "type": "poa"
                        },
                        {
                          "id": "d46e3vf23amg030rw8zg",
                          "type": "poa"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46e3v723amg030rw8z0",
                      "d46e3vf23amg030rw8zg"
                    ],
                    "id": "d46e6fh23amg030rw910",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:04:46.035Z"
                  },
                  "bank:summary": {
                    "breakdown": {
                      "summary": {
                        "by_ccy": {
                          "EUR": {
                            "top_in": [
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-06T15:28:41.212Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 3613.9,
                                "id": "5c649b28a5641841b68b2bab28d23d05",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "JACOB ARCHER-MORANGWN25",
                                "amount": 2400,
                                "id": "ee587010c1a76619f7888e7448df3dac",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-09T10:07:54.167Z",
                                "description": "SWIFTELEX LIMITED SwiftElex Limited",
                                "amount": 2355,
                                "id": "04c554385e5106117f24163d80f2a849",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-02T00:00:00Z",
                                "description": "JACOB ARCHER-MORANGWD25",
                                "amount": 2300,
                                "id": "d5fdf791a4294d42275adabc74e82413",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-01T15:45:28.701Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 2281.4,
                                "id": "0da74102e67736d0d00b6ba34242ccf7",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-24T00:00:00Z",
                                "description": "THUR HOSK SO LLP W/E 24/10 SCREWFIX",
                                "amount": 2272.48,
                                "id": "9ff7a8f1b4bb4337e257c78ad2629d25",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-19T12:31:46.982Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 1260,
                                "id": "e3349fb77f4ca0852d5bd241627a8aad",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-01-20T10:25:12.536Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 965,
                                "id": "b62f6e06ed23090d50b4e650e60bb22f",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-05-30T07:58:04.461Z",
                                "description": "E&C EVENTS LTD BALTER 25",
                                "amount": 800,
                                "id": "e86445c66a21cf38609e252ea5d45add",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-06T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 6.9.25",
                                "amount": 800,
                                "id": "4eb4becb238395fa3a60bff26b2e4797",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 3.10.25",
                                "amount": 660,
                                "id": "65bea463c180e32c536ebf770ad4f6db",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-07T00:00:00Z",
                                "description": "Arc-McDo B Greece",
                                "amount": 500,
                                "id": "908b356faa560c1910ab62699105519e",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-15T00:00:00Z",
                                "description": "Arc-McDo B holiday BGC",
                                "amount": 250,
                                "id": "6d74678683171682a62ffc97c03953d8",
                                "account_id": "91c6769dcb61767289208a454930c7b7",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-08-30T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 245,
                                "id": "1abd212b42e55440112ca9b8e2b87d9f",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-12T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 12.9.25",
                                "amount": 220,
                                "id": "2eb349e09df20e7e811525c18130a684",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-28T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 200,
                                "id": "d1c97b4c29623482d6ff920ded9ffddc",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-27T19:27:13.285Z",
                                "description": "Arch-Mo J R work return iou",
                                "amount": 150,
                                "id": "d3cdcae5db4e4d841b712edacbea2e63",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-31T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 150,
                                "id": "db76f59f7ac5395ab94ec1a7d5648ee2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-01T00:00:00Z",
                                "description": "404434 21857479 INTERNET TRANSFER",
                                "amount": 130,
                                "id": "6260e8341669381eaa8163ab03e303e1",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-04-28T11:02:21.196Z",
                                "description": "Arch-Mo J R work",
                                "amount": 100,
                                "id": "de8f49e2fd5434dd6270b112c8022645",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              }
                            ],
                            "top_out": [
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T13:34:27.36Z",
                                "description": "Jacob Robert arche GWN25",
                                "amount": -2400,
                                "id": "573b7ae1980c153f29d339e0287e6380",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-02T13:10:35.762Z",
                                "description": "Jacob Robert arche GWD25",
                                "amount": -2300,
                                "id": "92c3449a9c1be6eee3b5ca3158f42142",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-09T18:52:09.029Z",
                                "description": "Jacob Robert arche Powderham Presents",
                                "amount": -2200,
                                "id": "09a91579d867b94d34dd00f5bfbce4a0",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-02T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -2034.26,
                                "id": "313deb3db30a087d274b7429bc9637b9",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1500,
                                "id": "f64c8549d4927508cbee937952190e20",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-21T11:14:19.861Z",
                                "description": "Jacob Robert arche EGB",
                                "amount": -1200,
                                "id": "d0725de51ca36db9224996992bea9661",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T13:31:33.02Z",
                                "description": "BARBARA ARCHER owings x8",
                                "amount": -1200,
                                "id": "b7ccd74b1bc5f769843be499609633db",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-07T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1065.68,
                                "id": "0ea56de940d75d4b26c76aeee4ba8ddc",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-02-03T10:54:24.847Z",
                                "description": "Jacob Robert arche Exeter Showbitz",
                                "amount": -1000,
                                "id": "ada94dca78b3d2e68d07a32135cad2d7",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1000,
                                "id": "282a0116410532bb12df1fce68ff2ca2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-06-02T00:31:32.136Z",
                                "description": "Jacob Robert arche Balter",
                                "amount": -800,
                                "id": "311d09c0be0d33a8e36dd4951cd8d0a8",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "B ARCHER Rent & Owings x4",
                                "amount": -600,
                                "id": "c84f0526ba6a0e5fbfb96fb23e3ae47f",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -550.67,
                                "id": "14b11a87620190e2b202574bdfb2d2e4",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-15T00:00:00Z",
                                "description": "Buy BTW2509122529521 amount in EUR364.19 on 12 SEP reference exchange rate 1.155709 Final GBP amount inc. margin £8.92",
                                "amount": -324.04,
                                "id": "a340d0e9eecc82a393a2c4cfd23d5688",
                                "account_id": "91c6769dcb61767289208a454930c7b7",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "B ARCHER Rent & Owings x2",
                                "amount": -300,
                                "id": "fc339ff805ae07fb3bc7355dce8f7050",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "B ARCHER Owings finl",
                                "amount": -200,
                                "id": "4f1d2724e46e78ebd57b6ba524790134",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-08-30T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -200,
                                "id": "7792426ac76f46c4c60e6aa0d15f15a2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-25T00:00:00Z",
                                "description": "Klarna Financial SYA777777777713C9YB",
                                "amount": -199.56,
                                "id": "2e6ee436a7394f2406fdebb7664f0dc1",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "HMRC GOV.UK SA GLASGOW",
                                "amount": -197.6,
                                "id": "85edd8e1479758f6319dbaddf1c7ea07",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "PURCHASE",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -160.31,
                                "id": "3c8640af1c234df97be59a19b6af559b",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              }
                            ]
                          },
                          "GBP": {
                            "top_in": [
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-06T15:28:41.212Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 3613.9,
                                "id": "5c649b28a5641841b68b2bab28d23d05",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "JACOB ARCHER-MORANGWN25",
                                "amount": 2400,
                                "id": "ee587010c1a76619f7888e7448df3dac",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-09T10:07:54.167Z",
                                "description": "SWIFTELEX LIMITED SwiftElex Limited",
                                "amount": 2355,
                                "id": "04c554385e5106117f24163d80f2a849",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-02T00:00:00Z",
                                "description": "JACOB ARCHER-MORANGWD25",
                                "amount": 2300,
                                "id": "d5fdf791a4294d42275adabc74e82413",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-01T15:45:28.701Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 2281.4,
                                "id": "0da74102e67736d0d00b6ba34242ccf7",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-24T00:00:00Z",
                                "description": "THUR HOSK SO LLP W/E 24/10 SCREWFIX",
                                "amount": 2272.48,
                                "id": "9ff7a8f1b4bb4337e257c78ad2629d25",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-19T12:31:46.982Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 1260,
                                "id": "e3349fb77f4ca0852d5bd241627a8aad",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-01-20T10:25:12.536Z",
                                "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                                "amount": 965,
                                "id": "b62f6e06ed23090d50b4e650e60bb22f",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-05-30T07:58:04.461Z",
                                "description": "E&C EVENTS LTD BALTER 25",
                                "amount": 800,
                                "id": "e86445c66a21cf38609e252ea5d45add",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-06T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 6.9.25",
                                "amount": 800,
                                "id": "4eb4becb238395fa3a60bff26b2e4797",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 3.10.25",
                                "amount": 660,
                                "id": "65bea463c180e32c536ebf770ad4f6db",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-07T00:00:00Z",
                                "description": "Arc-McDo B Greece",
                                "amount": 500,
                                "id": "908b356faa560c1910ab62699105519e",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-15T00:00:00Z",
                                "description": "Arc-McDo B holiday BGC",
                                "amount": 250,
                                "id": "6d74678683171682a62ffc97c03953d8",
                                "account_id": "91c6769dcb61767289208a454930c7b7",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-08-30T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 245,
                                "id": "1abd212b42e55440112ca9b8e2b87d9f",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-12T00:00:00Z",
                                "description": "THUR HOSK SO LLP work w/e 12.9.25",
                                "amount": 220,
                                "id": "2eb349e09df20e7e811525c18130a684",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-28T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 200,
                                "id": "d1c97b4c29623482d6ff920ded9ffddc",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-27T19:27:13.285Z",
                                "description": "Arch-Mo J R work return iou",
                                "amount": 150,
                                "id": "d3cdcae5db4e4d841b712edacbea2e63",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-31T00:00:00Z",
                                "description": "STEWART S Holidayxx",
                                "amount": 150,
                                "id": "db76f59f7ac5395ab94ec1a7d5648ee2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-01T00:00:00Z",
                                "description": "404434 21857479 INTERNET TRANSFER",
                                "amount": 130,
                                "id": "6260e8341669381eaa8163ab03e303e1",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-04-28T11:02:21.196Z",
                                "description": "Arch-Mo J R work",
                                "amount": 100,
                                "id": "de8f49e2fd5434dd6270b112c8022645",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "CREDIT",
                                "classification": null,
                                "type": "CREDIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              }
                            ],
                            "top_out": [
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T13:34:27.36Z",
                                "description": "Jacob Robert arche GWN25",
                                "amount": -2400,
                                "id": "573b7ae1980c153f29d339e0287e6380",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-02T13:10:35.762Z",
                                "description": "Jacob Robert arche GWD25",
                                "amount": -2300,
                                "id": "92c3449a9c1be6eee3b5ca3158f42142",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-09T18:52:09.029Z",
                                "description": "Jacob Robert arche Powderham Presents",
                                "amount": -2200,
                                "id": "09a91579d867b94d34dd00f5bfbce4a0",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-02T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -2034.26,
                                "id": "313deb3db30a087d274b7429bc9637b9",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1500,
                                "id": "f64c8549d4927508cbee937952190e20",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-07-21T11:14:19.861Z",
                                "description": "Jacob Robert arche EGB",
                                "amount": -1200,
                                "id": "d0725de51ca36db9224996992bea9661",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T13:31:33.02Z",
                                "description": "BARBARA ARCHER owings x8",
                                "amount": -1200,
                                "id": "b7ccd74b1bc5f769843be499609633db",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-07T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1065.68,
                                "id": "0ea56de940d75d4b26c76aeee4ba8ddc",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-02-03T10:54:24.847Z",
                                "description": "Jacob Robert arche Exeter Showbitz",
                                "amount": -1000,
                                "id": "ada94dca78b3d2e68d07a32135cad2d7",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -1000,
                                "id": "282a0116410532bb12df1fce68ff2ca2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-06-02T00:31:32.136Z",
                                "description": "Jacob Robert arche Balter",
                                "amount": -800,
                                "id": "311d09c0be0d33a8e36dd4951cd8d0a8",
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "B ARCHER Rent & Owings x4",
                                "amount": -600,
                                "id": "c84f0526ba6a0e5fbfb96fb23e3ae47f",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -550.67,
                                "id": "14b11a87620190e2b202574bdfb2d2e4",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-15T00:00:00Z",
                                "description": "Buy BTW2509122529521 amount in EUR364.19 on 12 SEP reference exchange rate 1.155709 Final GBP amount inc. margin £8.92",
                                "amount": -324.04,
                                "id": "a340d0e9eecc82a393a2c4cfd23d5688",
                                "account_id": "91c6769dcb61767289208a454930c7b7",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "B ARCHER Rent & Owings x2",
                                "amount": -300,
                                "id": "fc339ff805ae07fb3bc7355dce8f7050",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-08T00:00:00Z",
                                "description": "B ARCHER Owings finl",
                                "amount": -200,
                                "id": "4f1d2724e46e78ebd57b6ba524790134",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-08-30T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -200,
                                "id": "7792426ac76f46c4c60e6aa0d15f15a2",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-09-25T00:00:00Z",
                                "description": "Klarna Financial SYA777777777713C9YB",
                                "amount": -199.56,
                                "id": "2e6ee436a7394f2406fdebb7664f0dc1",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "DEBIT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "",
                                "timestamp": "2025-10-03T00:00:00Z",
                                "description": "HMRC GOV.UK SA GLASGOW",
                                "amount": -197.6,
                                "id": "85edd8e1479758f6319dbaddf1c7ea07",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "PURCHASE",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              },
                              {
                                "merchant_name": "Tesco Bank",
                                "timestamp": "2025-10-27T00:00:00Z",
                                "description": "TESCO BANK 518652******0936",
                                "amount": -160.31,
                                "id": "3c8640af1c234df97be59a19b6af559b",
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "currency": "GBP",
                                "category": "BILL_PAYMENT",
                                "classification": null,
                                "type": "DEBIT",
                                "counterparty_name": "",
                                "counterparty_iban": ""
                              }
                            ]
                          }
                        }
                      },
                      "accounts": {
                        "6d7afbac29de4842775ee1763b86fc68": {
                          "number": {
                            "iban": "GB10BUKB20272673049558",
                            "number": "73049558",
                            "sort_code": "20-27-26",
                            "swift_bic": ""
                          },
                          "name": "EUR travel wallet",
                          "provider": {
                            "id": "ob-barclays",
                            "name": "BARCLAYS"
                          },
                          "_key": "••••••",
                          "balance": {
                            "available": 20.54,
                            "current": 20.54,
                            "overdraft": 0
                          },
                          "info": [
                            {
                              "full_name": "MR JACOB ROBERT ARCHER-MORAN",
                              "phones": null,
                              "date_of_birth": "",
                              "emails": null,
                              "update_timestamp": "2025-11-06T18:04:44.3093359Z",
                              "addresses": null
                            }
                          ],
                          "credentials_id": "••••••",
                          "currency": "EUR",
                          "metadata": {
                            "created_at": 1762452286148,
                            "encryption": null,
                            "tl": {
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "debug_id": "",
                              "download_status": "complete",
                              "task_id": "2c986ba6-e546-459f-b1a3-a10c2fdcfe49"
                            },
                            "updated_at": 1762452285237
                          },
                          "type": "TRANSACTION"
                        },
                        "91c6769dcb61767289208a454930c7b7": {
                          "number": {
                            "iban": "GB10BUKB20272673049558",
                            "number": "73049558",
                            "sort_code": "20-27-26",
                            "swift_bic": ""
                          },
                          "name": "Barclays Bank Account",
                          "provider": {
                            "id": "ob-barclays",
                            "name": "BARCLAYS"
                          },
                          "_key": "••••••",
                          "balance": {
                            "available": 8.84,
                            "current": 8.84,
                            "overdraft": 0
                          },
                          "info": [
                            {
                              "full_name": "MR JACOB ROBERT ARCHER-MORAN",
                              "phones": null,
                              "date_of_birth": "",
                              "emails": null,
                              "update_timestamp": "2025-11-06T18:04:44.3093359Z",
                              "addresses": null
                            }
                          ],
                          "credentials_id": "••••••",
                          "currency": "GBP",
                          "metadata": {
                            "created_at": 1762452286048,
                            "encryption": null,
                            "tl": {
                              "account_id": "91c6769dcb61767289208a454930c7b7",
                              "debug_id": "",
                              "download_status": "complete",
                              "task_id": "e3105542-2fcd-4e05-9cfd-63d829421185"
                            },
                            "updated_at": 1762452285237
                          },
                          "type": "TRANSACTION"
                        },
                        "4c82630f5b8bccce242ff3fbb4740b8d": {
                          "number": {
                            "iban": "GB63MIDL40443471857460",
                            "number": "71857460",
                            "sort_code": "40-44-34",
                            "swift_bic": ""
                          },
                          "name": "BANK A/C",
                          "provider": {
                            "id": "ob-hsbc",
                            "name": "HSBC"
                          },
                          "_key": "••••••",
                          "balance": {
                            "available": 5.83,
                            "current": 5.83,
                            "overdraft": 0
                          },
                          "info": [
                            {
                              "full_name": "Mr Jacob Robert Archer-Moran",
                              "phones": null,
                              "date_of_birth": "",
                              "emails": null,
                              "update_timestamp": "2025-11-06T18:03:12.7946689Z",
                              "addresses": null
                            }
                          ],
                          "credentials_id": "••••••",
                          "currency": "GBP",
                          "metadata": {
                            "created_at": 1762452195837,
                            "encryption": null,
                            "tl": {
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "debug_id": "",
                              "download_status": "complete",
                              "task_id": "fa3e06c2-b9c5-4fcf-b015-a3fb91f5de2b"
                            },
                            "updated_at": 1762452194836
                          },
                          "type": "TRANSACTION"
                        },
                        "071fc97cd0cf36290a519783bb8f1114": {
                          "number": {
                            "iban": "GB13MIDL40443421857479",
                            "number": "21857479",
                            "sort_code": "40-44-34",
                            "swift_bic": ""
                          },
                          "name": "FLEX SAVER",
                          "provider": {
                            "id": "ob-hsbc",
                            "name": "HSBC"
                          },
                          "_key": "••••••",
                          "balance": {
                            "available": 50.3,
                            "current": 50.3,
                            "overdraft": 0
                          },
                          "info": [
                            {
                              "full_name": "Mr Jacob Robert Archer-Moran",
                              "phones": null,
                              "date_of_birth": "",
                              "emails": null,
                              "update_timestamp": "2025-11-06T18:03:12.7946689Z",
                              "addresses": null
                            }
                          ],
                          "credentials_id": "••••••",
                          "currency": "GBP",
                          "metadata": {
                            "created_at": 1762452195941,
                            "encryption": null,
                            "tl": {
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "debug_id": "",
                              "download_status": "complete",
                              "task_id": "6e9ab6b3-75ec-4717-99f1-e89318a60451"
                            },
                            "updated_at": 1762452194836
                          },
                          "type": "SAVINGS"
                        },
                        "6f1032d40aa61c12cec47fe3295d6a22": {
                          "number": {
                            "iban": "GB30TSBS77856600948872",
                            "number": "00948872",
                            "sort_code": "77-85-66",
                            "swift_bic": ""
                          },
                          "name": "Spend & Save Account",
                          "provider": {
                            "id": "ob-tsb",
                            "name": "TSB"
                          },
                          "_key": "••••••",
                          "balance": {
                            "available": 168.2,
                            "current": 168.2,
                            "overdraft": 0
                          },
                          "info": [
                            {
                              "full_name": "JACOB ARCHER-MORAN",
                              "phones": null,
                              "date_of_birth": "",
                              "emails": null,
                              "update_timestamp": "2025-11-06T18:03:50.8306147Z",
                              "addresses": null
                            }
                          ],
                          "credentials_id": "••••••",
                          "currency": "GBP",
                          "metadata": {
                            "created_at": 1762452231890,
                            "encryption": null,
                            "tl": {
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "debug_id": "",
                              "download_status": "complete",
                              "task_id": "1d27c4ca-4f32-42cb-b047-856c3c8af4f7"
                            },
                            "updated_at": 1762452231221
                          },
                          "type": "TRANSACTION"
                        }
                      }
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [],
                    "id": "d46e6gt23amg030rw9b0",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:04:51.181Z"
                  },
                  "bank:statement": {
                    "breakdown": {
                      "accounts": {
                        "6d7afbac29de4842775ee1763b86fc68": {
                          "info": {
                            "number": {
                              "iban": "GB10BUKB20272673049558",
                              "number": "73049558",
                              "sort_code": "20-27-26",
                              "swift_bic": ""
                            },
                            "name": "EUR travel wallet",
                            "provider": {
                              "id": "ob-barclays",
                              "name": "BARCLAYS"
                            },
                            "_key": "••••••",
                            "balance": {
                              "available": 20.54,
                              "current": 20.54,
                              "overdraft": 0
                            },
                            "info": [
                              {
                                "full_name": "MR JACOB ROBERT ARCHER-MORAN",
                                "phones": null,
                                "date_of_birth": "",
                                "emails": null,
                                "update_timestamp": "2025-11-06T18:04:44.3093359Z",
                                "addresses": null
                              }
                            ],
                            "credentials_id": "••••••",
                            "currency": "EUR",
                            "metadata": {
                              "created_at": 1762452286148,
                              "tl": {
                                "account_id": "6d7afbac29de4842775ee1763b86fc68",
                                "debug_id": "",
                                "download_status": "complete",
                                "task_id": "2c986ba6-e546-459f-b1a3-a10c2fdcfe49"
                              },
                              "updated_at": 1762452285237
                            },
                            "type": "TRANSACTION"
                          },
                          "statement": [
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-18T18:11:18Z",
                              "description": "LIXOURI ON 18/09/2025 CARD PURCHASE ATHENAS ESTIASI LIXOURI GR",
                              "amount": -33.5,
                              "id": "c1b8b38592ef0f234df4fca8de1ea202",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-17T13:07:51Z",
                              "description": "RATZAKLI ON 17/09/2025 CARD PURCHASE MARIA KEFALA RATZAKLI GR",
                              "amount": -18.7,
                              "id": "d4a9e4295f38bae8ce358fd0d8c182e6",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-17T09:52:59Z",
                              "description": "POROS KEFALLO ON 17/09/2025 CARD PURCHASE OLIVE GARDEN POROS KEFALLO GR",
                              "amount": -8,
                              "id": "4be32b8911ecda6eb1e610e7472b2268",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-17T08:35:12Z",
                              "description": "SAMI ON 17/09/2025 CARD PURCHASE FLAMIATOU CHRYSAV. SAMI GR",
                              "amount": -5,
                              "id": "730dd473547662d027b04f30a5387375",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T19:32:47Z",
                              "description": "SAMI ON 16/09/2025 CARD PURCHASE CARTONE SAMI GR",
                              "amount": -10.7,
                              "id": "03cea6c07ed020f29bedf0400d4db289",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T19:21:28Z",
                              "description": "SAMIS ON 16/09/2025 CARD PURCHASE FAMILIA SAMIS GR",
                              "amount": -59,
                              "id": "f86b8b8dfd40a6729ad20b37a740ff72",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T16:44:17Z",
                              "description": "KEFALLONIA ON 16/09/2025 CARD PURCHASE S/M BAZAAR KEFALLONIA GR",
                              "amount": -20.88,
                              "id": "ae6d7658df900f499c9ec899a36edb99",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T14:49:45Z",
                              "description": "SAMI ON 16/09/2025 CARD PURCHASE FLAMIATOU CHRYSAV. SAMI GR",
                              "amount": -4,
                              "id": "8f61b6d855559654f78783f09341f831",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T13:15:54Z",
                              "description": "DREPANO ACHAI ON 16/09/2025 CARD PURCHASE V-KTR SERVICES E.E. DREPANO ACHAI GR",
                              "amount": -8.5,
                              "id": "6c2b81caefd266efe58bbc9b42777570",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T11:49:00Z",
                              "description": "SAMI ON 16/09/2025 CARD PURCHASE EXAIL SAMI GR",
                              "amount": -40.8,
                              "id": "f2aa2bbb3872ad69dfca33f5da9483e6",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T19:25:06Z",
                              "description": "KEFALLONIA ON 15/09/2025 CARD PURCHASE GERASIMOS KAVVADIAS KEFALLONIA GR",
                              "amount": -83,
                              "id": "90b3268e9033cbe4deb0d2e0f5ea5eff",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T19:25:06Z",
                              "description": "KEFALLONIA ON 15/09/2025 CARD PURCHASE GERASIMOS KAVVADIAS KEFALLONIA GR",
                              "amount": -83,
                              "id": "b313e4d32fd1730ec75ff9a94639e447",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T12:31:05Z",
                              "description": "LIXOURI ON 15/09/2025 CARD PURCHASE IONION LINES LIXOURI GR",
                              "amount": -14,
                              "id": "ccd4e6214a5729bcd0f164f87fdaf9e6",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T12:15:42Z",
                              "description": "VASILIKH ON 15/09/2025 CARD PURCHASE KOLYVAS IOANNIS VASILIKH GR",
                              "amount": -34,
                              "id": "5767d4e379c485def6e4d82db959810b",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T11:31:51Z",
                              "description": "VASILIKI ON 15/09/2025 CARD PURCHASE SOUPER MARKET POLI VASILIKI GR",
                              "amount": -3.2,
                              "id": "6a7fd25f62c8da4faddd0df470193879",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-14T20:54:55Z",
                              "description": "LEFKADA ON 14/09/2025 CARD PURCHASE THERAPOS SPYROGIANNI LEFKADA GR",
                              "amount": -18.5,
                              "id": "4af7537252f4f07a33544cc36a8b7336",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-14T20:22:04Z",
                              "description": "LEFKADA ON 14/09/2025 CONTACTLESS ITEM KIOSK VATHIS LEFKADA GR",
                              "amount": -17.68,
                              "id": "2f14015da19ae1bd61c744d2ead4cc1d",
                              "account_id": "6d7afbac29de4842775ee1763b86fc68",
                              "currency": "EUR",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            }
                          ]
                        },
                        "91c6769dcb61767289208a454930c7b7": {
                          "info": {
                            "number": {
                              "iban": "GB10BUKB20272673049558",
                              "number": "73049558",
                              "sort_code": "20-27-26",
                              "swift_bic": ""
                            },
                            "name": "Barclays Bank Account",
                            "provider": {
                              "id": "ob-barclays",
                              "name": "BARCLAYS"
                            },
                            "_key": "••••••",
                            "balance": {
                              "available": 8.84,
                              "current": 8.84,
                              "overdraft": 0
                            },
                            "info": [
                              {
                                "full_name": "MR JACOB ROBERT ARCHER-MORAN",
                                "phones": null,
                                "date_of_birth": "",
                                "emails": null,
                                "update_timestamp": "2025-11-06T18:04:44.3093359Z",
                                "addresses": null
                              }
                            ],
                            "credentials_id": "••••••",
                            "currency": "GBP",
                            "metadata": {
                              "created_at": 1762452286048,
                              "tl": {
                                "account_id": "91c6769dcb61767289208a454930c7b7",
                                "debug_id": "",
                                "download_status": "complete",
                                "task_id": "e3105542-2fcd-4e05-9cfd-63d829421185"
                              },
                              "updated_at": 1762452285237
                            },
                            "type": "TRANSACTION"
                          },
                          "statement": [
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "Buy BTW2509122529521 amount in EUR364.19 on 12 SEP reference exchange rate 1.155709 Final GBP amount inc. margin £8.92",
                              "amount": -324.04,
                              "id": "a340d0e9eecc82a393a2c4cfd23d5688",
                              "account_id": "91c6769dcb61767289208a454930c7b7",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "Arch-Mo J R holiday BGC",
                              "amount": 15,
                              "id": "525f95c9eeeaf311e3c61196801ade8d",
                              "account_id": "91c6769dcb61767289208a454930c7b7",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "Arch-Mo J R holiday BGC",
                              "amount": 10,
                              "id": "19f23841755f5f748f6d27d11d85d597",
                              "account_id": "91c6769dcb61767289208a454930c7b7",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "Arc-McDo B holiday BGC",
                              "amount": 250,
                              "id": "6d74678683171682a62ffc97c03953d8",
                              "account_id": "91c6769dcb61767289208a454930c7b7",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            }
                          ]
                        },
                        "4c82630f5b8bccce242ff3fbb4740b8d": {
                          "info": {
                            "number": {
                              "iban": "GB63MIDL40443471857460",
                              "number": "71857460",
                              "sort_code": "40-44-34",
                              "swift_bic": ""
                            },
                            "name": "BANK A/C",
                            "provider": {
                              "id": "ob-hsbc",
                              "name": "HSBC"
                            },
                            "_key": "••••••",
                            "balance": {
                              "available": 5.83,
                              "current": 5.83,
                              "overdraft": 0
                            },
                            "info": [
                              {
                                "full_name": "Mr Jacob Robert Archer-Moran",
                                "phones": null,
                                "date_of_birth": "",
                                "emails": null,
                                "update_timestamp": "2025-11-06T18:03:12.7946689Z",
                                "addresses": null
                              }
                            ],
                            "credentials_id": "••••••",
                            "currency": "GBP",
                            "metadata": {
                              "created_at": 1762452195837,
                              "tl": {
                                "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                                "debug_id": "",
                                "download_status": "complete",
                                "task_id": "fa3e06c2-b9c5-4fcf-b015-a3fb91f5de2b"
                              },
                              "updated_at": 1762452194836
                            },
                            "type": "TRANSACTION"
                          },
                          "statement": [
                            {
                              "merchant_name": "Google",
                              "timestamp": "2025-11-06T00:00:00Z",
                              "description": "GOOGLE *Google Plag.co/helppay#",
                              "amount": -29.97,
                              "id": "0fa775e9fa58f8a57b2281d856f4677d",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-05T00:00:00Z",
                              "description": "HLTN03 VOIPSTUDIO.",
                              "amount": -18,
                              "id": "57efabbf4332c55d74b2145b3ed89a52",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-11-05T00:00:00Z",
                              "description": "HLTN05 PRIME VIDE",
                              "amount": -5,
                              "id": "05b28649733c15d4d1d0d2e9af83ad56",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-11-05T00:00:00Z",
                              "description": "HLTN04 PRIME VIDEO",
                              "amount": -4,
                              "id": "74e37a254758995c00bce013d15264e6",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Transport for London",
                              "timestamp": "2025-11-05T00:00:00Z",
                              "description": "HLTN06 TFL TRAVEL",
                              "amount": -3.1,
                              "id": "88cff579b837c22234f7e3613bf5c321",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Google",
                              "timestamp": "2025-11-04T00:00:00Z",
                              "description": "GOOGLE *Google Plag.co/helppay#",
                              "amount": -12.99,
                              "id": "5f375a74644bd908e00fd03834d1e579",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Vape Club",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "VAPE CLUB LTD WATFORD",
                              "amount": -39.97,
                              "id": "5ff7571700be937346932392ded4e84b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "b4e6e3e698d83bd34493d70b864ef210",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "CAR STEWART S",
                              "amount": 70,
                              "id": "9738cf4da5ca96b561a70e21a6b8e666",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "77bda169d7f18df9e0350118929e55c1",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "c4e8a8624a787db81490123872b4c090",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "DVLA-WF60YWP",
                              "amount": -18.81,
                              "id": "0375fd775ea648bae3eea8ec7de8b713",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "DVLA-OE62WGD",
                              "amount": -29.31,
                              "id": "8b815c0f80804a7933ef4966d278015f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "REVERSAL OF 03-11 ADMIRAL INSURANCE",
                              "amount": 90.18,
                              "id": "41f008d187aacafb9284eb4c05aa1229",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Admiral",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "ADMIRAL INSURANCE",
                              "amount": -90.18,
                              "id": "4c188f7806f94d3181ee32fc0e341764",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-03T00:00:00Z",
                              "description": "PROSPECT UNION",
                              "amount": -11.25,
                              "id": "5ecbcc1af74c6fb0b4f46f84010380c0",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-31T00:00:00Z",
                              "description": "STEWART S Holidayxx",
                              "amount": 150,
                              "id": "db76f59f7ac5395ab94ec1a7d5648ee2",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Trainline",
                              "timestamp": "2025-10-31T00:00:00Z",
                              "description": "HLTN02 TRAINLINE",
                              "amount": -14.2,
                              "id": "be44b1efe0dfa1282da88d4d90446f0f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-30T00:00:00Z",
                              "description": "Non-Sterling Transaction Fee",
                              "amount": -0.24,
                              "id": "0fed04a35afb73104eb934f0b51a734c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-30T00:00:00Z",
                              "description": "INT'L 0066211166 DUOFAX.COM PRAHA 4 EUR 10.00 @ 1.1376 Visa Rate",
                              "amount": -8.79,
                              "id": "1e9ddbd0ab75bae40bd07f0c33934013",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Trainline",
                              "timestamp": "2025-10-30T00:00:00Z",
                              "description": "TRAINLINE WWW.THETRAINL",
                              "amount": -10,
                              "id": "69fceaa63ab5cf18b7104dc18aa37cbe",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Trainline",
                              "timestamp": "2025-10-29T00:00:00Z",
                              "description": "HLTN01 TRAINLINE",
                              "amount": -10,
                              "id": "195adc7b7f10efe1bfda62c24dbd0a07",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-28T00:00:00Z",
                              "description": "Se Iou",
                              "amount": -110,
                              "id": "2789d8f6f89e6d2f4dec2a99dd406980",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-28T00:00:00Z",
                              "description": "404434 21857479 INTERNET TRANSFER",
                              "amount": 50,
                              "id": "e8dc9f623531137194dad9a1eda4b000",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "Jacob TSB work return iou",
                              "amount": -150,
                              "id": "6cc540e761172036d41dca37fce01d38",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -160.31,
                              "id": "3c8640af1c234df97be59a19b6af559b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -1000,
                              "id": "282a0116410532bb12df1fce68ff2ca2",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "B ARCHER Rent & Owings x4",
                              "amount": -600,
                              "id": "c84f0526ba6a0e5fbfb96fb23e3ae47f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "Se Iou",
                              "amount": -100,
                              "id": "8aaca016c37aae8ae9737b19a065d93a",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "The Cock Tavern",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "The Cock Tavern London",
                              "amount": -10,
                              "id": "7df7f2e338caa7671e1ae19794a33cdf",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "e5eb85608f0211749d34f470bac543e2",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "14315818ab265b9e865341971ca3cf7e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "f0f4a7e4a0b6e57308ecd882243d9d6f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T00:00:00Z",
                              "description": "HLTN PREMIUM",
                              "amount": -150,
                              "id": "4e74dc5b71f6cab998e729cb943a5805",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-24T00:00:00Z",
                              "description": "THUR HOSK SO LLP W/E 24/10 SCREWFIX",
                              "amount": 2272.48,
                              "id": "9ff7a8f1b4bb4337e257c78ad2629d25",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-22T00:00:00Z",
                              "description": "LEE CAJ CAROLINE is fab",
                              "amount": 20,
                              "id": "3a05881505230f565f56c9770184af71",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Google Moon",
                              "timestamp": "2025-10-22T00:00:00Z",
                              "description": "HLTN48 GOOGLE GOOG",
                              "amount": -25,
                              "id": "e43c2d9863475454a2b188d11b304331",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-10-20T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -22.47,
                              "id": "d09c63041f2cb6c6d38f8ff828617356",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-20T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "3fa9b21c0eb1d3c8b5c0603c6440bc7b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-20T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "15698d426b434690ca629a80c68bbc9a",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-20T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "473567e154be184192a74a2fd31e8171",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-17T00:00:00Z",
                              "description": "ICO",
                              "amount": -47,
                              "id": "efc07b773f209dd7258ffbedf7735585",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon",
                              "timestamp": "2025-10-17T00:00:00Z",
                              "description": "HLTN47 AMAZON.CO.U",
                              "amount": -7,
                              "id": "816c182fd4846287a6555db48f99500a",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon",
                              "timestamp": "2025-10-15T00:00:00Z",
                              "description": "HLTN45 AMAZON.CO.U",
                              "amount": -14,
                              "id": "1574fbd61b751b043d1a70f4eacc534f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-10-15T00:00:00Z",
                              "description": "HLTN46 PRIME VIDE",
                              "amount": -4,
                              "id": "a1655eeb312498a610245c1cc2c2b12c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon",
                              "timestamp": "2025-10-14T00:00:00Z",
                              "description": "HLTN44 AMAZON.CO.U",
                              "amount": -4,
                              "id": "787afb76f56828da3d4df278d4ab4256",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-10-13T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -25.96,
                              "id": "480b4c4823d8d7e8da089e9e95878bda",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Vape Club",
                              "timestamp": "2025-10-13T00:00:00Z",
                              "description": "VAPE CLUB LTD WATFORD",
                              "amount": -49.97,
                              "id": "6e4bfc8286eb54cbf5cf1d7030175d54",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-13T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "000fdb8c5d670d5a1cfc9298e6a9aa08",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-13T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "c104d08004a929187f8611aa62d6141b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-13T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "6d8e97047838357c619ae9de7b76e52e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-10-08T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -15.75,
                              "id": "b5a5ae621bbe8bac674b027f047bac97",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "Non-Sterling Transaction Fee",
                              "amount": -0.24,
                              "id": "61ac548a6c55b987e741d3c70b7bf82e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "INT'L 0066184243 DUOFAX.COM PRAHA 4 EUR 10.00 @ 1.1454 Visa Rate",
                              "amount": -8.73,
                              "id": "e1affbffd520a240dfcfe1636eb7edf5",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Vape Club",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "VAPE CLUB LTD WATFORD",
                              "amount": -47.98,
                              "id": "3e7088d0021f50795f1bb6636abd1f2f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -25.96,
                              "id": "7354365839e01f9ae93d96ed75ddf5ee",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Google",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "GOOGLE *Google Plag.co/helppay#",
                              "amount": -12.99,
                              "id": "92d3324c249c1da1648506bf22a36a2f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "fea61beecc5bc5a72a5bdb0976c7bb25",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "9e462d0d506872cbc794e034eb96a8bd",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "0309bc1935d09be5822855cf322f70cc",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-10-06T00:00:00Z",
                              "description": "HLTN43 PRIME VIDE",
                              "amount": -5,
                              "id": "c4dfdfe558fe18e7863df736090484b0",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-03T00:00:00Z",
                              "description": "B ARCHER Rent & Owings x2",
                              "amount": -300,
                              "id": "fc339ff805ae07fb3bc7355dce8f7050",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-03T00:00:00Z",
                              "description": "THUR HOSK SO LLP work w/e 3.10.25",
                              "amount": 660,
                              "id": "65bea463c180e32c536ebf770ad4f6db",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-03T00:00:00Z",
                              "description": "HMRC GOV.UK SA GLASGOW",
                              "amount": -197.6,
                              "id": "85edd8e1479758f6319dbaddf1c7ea07",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-03T00:00:00Z",
                              "description": "HLTN42 VOIPSTUDIO.",
                              "amount": -18,
                              "id": "689739b38b650b11fe07cffa4ae44318",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Paypal",
                              "timestamp": "2025-10-02T00:00:00Z",
                              "description": "PAYPAL *UBERTRIP 35314369001",
                              "amount": -1.5,
                              "id": "978597377aad280b5e524a94a4e97d28",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-10-02T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -2034.26,
                              "id": "313deb3db30a087d274b7429bc9637b9",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-02T00:00:00Z",
                              "description": "JACOB ARCHER-MORANGWD25",
                              "amount": 2300,
                              "id": "d5fdf791a4294d42275adabc74e82413",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Experian",
                              "timestamp": "2025-10-02T00:00:00Z",
                              "description": "HLTN41 EXPERIAN LT",
                              "amount": -15,
                              "id": "d44b2966f183387818cb0915d7782198",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Apple",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "PAYPAL *APPLE.COM/35314369001",
                              "amount": -0.99,
                              "id": "f5c08a758d1d481bcf1f07d088161874",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "CAR STEWART S",
                              "amount": 70,
                              "id": "ea13d2a5a3d225c323b8193b4a5d1dd8",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "DVLA-WF60YWP",
                              "amount": -18.81,
                              "id": "f918f881fb7eee736b8db824fb0f42bf",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "DVLA-OE62WGD",
                              "amount": -29.31,
                              "id": "43580b657664533030bf8af3bfd6ad8e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Admiral",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "ADMIRAL INSURANCE",
                              "amount": -90.18,
                              "id": "db20112ffe29f638cf31e056b0678467",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-01T00:00:00Z",
                              "description": "PROSPECT UNION",
                              "amount": -11.25,
                              "id": "148fff3918e5d81fda9aa0a6a6d32dbf",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-09-30T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -25.57,
                              "id": "748ebfbf7f8d39bed8c5eaf4e11a6eff",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Omaze Uk",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "SP OMAZE UK ALTRINCHAM",
                              "amount": -15,
                              "id": "35411103828cce4fb150e3706921a73c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Just Eat",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": -38.38,
                              "id": "66c9b09401a82e6a93c16a4686eb972f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "Just Eat.Co.UK LtdLondon",
                              "amount": 7,
                              "id": "ec03370db9358e8140d4705606e97f61",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "e3d73daf8064029bd77095eb288626df",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "725d9bb576d08331bc049efeb5175250",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-29T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "58410776ed94bee425e6802e9d8bfb08",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-28T00:00:00Z",
                              "description": "STEWART S Holidayxx",
                              "amount": 200,
                              "id": "d1c97b4c29623482d6ff920ded9ffddc",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Deliveroo",
                              "timestamp": "2025-09-25T00:00:00Z",
                              "description": "DELIVEROO LONDON",
                              "amount": -12.08,
                              "id": "db00abb4cb860f45ae492c01ef9e2678",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Vape Club",
                              "timestamp": "2025-09-25T00:00:00Z",
                              "description": "VAPE CLUB LTD WATFORD",
                              "amount": -28.99,
                              "id": "f51ae34cf58f79774ef91ff72fd2a4f4",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-25T00:00:00Z",
                              "description": "Klarna Financial SYA777777777713C9YB",
                              "amount": -199.56,
                              "id": "2e6ee436a7394f2406fdebb7664f0dc1",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Deliveroo",
                              "timestamp": "2025-09-24T00:00:00Z",
                              "description": "DELIVEROO LONDON",
                              "amount": -17.54,
                              "id": "63016b02bf97950287954693ee4e39c5",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Co-op",
                              "timestamp": "2025-09-24T00:00:00Z",
                              "description": "CO-OP GROUP FOOD LONDON",
                              "amount": -1.95,
                              "id": "42a9f5445f421a3152bbd97cf66bc2f3",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Klarna",
                              "timestamp": "2025-09-24T00:00:00Z",
                              "description": "KLARNA",
                              "amount": -19.96,
                              "id": "e85d67c773a0a59136dad03d27b89f8c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-22T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "3e30d63678a3853fa0c6c72ea04cd3cc",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-22T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "de57508d74169eda397e6758d2709f0c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-22T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "f0cb165438e9f457043b6291208f8142",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-19T00:00:00Z",
                              "description": "Non-Sterling Transaction Fee",
                              "amount": -0.04,
                              "id": "a49711695aee358ffcd41a31223ae9d8",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-19T00:00:00Z",
                              "description": "INT'L 0048286545 2CO.COM¦MALWAREBYTAMSTERDAM EUR 1.90 @ 1.1515 Visa Rate",
                              "amount": -1.65,
                              "id": "793a721d100c4c9d39da959262398a9e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-18T00:00:00Z",
                              "description": "GREAT WESTERN TRAI",
                              "amount": 75.25,
                              "id": "443f1383ff63083d556fd8bdebaba1dd",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-16T00:00:00Z",
                              "description": "HLTN40 VOIPSTUDIO.",
                              "amount": -18,
                              "id": "66794a0e3d6f8d55d6bb0bd2476c8667",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Deliveroo",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "DELIVEROO LONDON",
                              "amount": -14.4,
                              "id": "9881ca248ed50b787bb58df2f5b3c777",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Deliveroo",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "DELIVEROO LONDON",
                              "amount": -20.98,
                              "id": "fd6d855773564077849e35ffb31b0d5c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "BIG PENNY SOCIAL LONDON",
                              "amount": -30.58,
                              "id": "e3fa3c1e6b036b1f400eacf7135c0a91",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Vape Club",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "VAPE CLUB LTD WATFORD",
                              "amount": -46.97,
                              "id": "0aa200fd9617c25aa5984a9395e1ffe8",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "5f930488e74ed312a8480764c4981aa4",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "6517ef405e4e6df7ad3a02ca3303ff02",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-15T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "18cc7f418b45382939ab155c3342a88b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-12T00:00:00Z",
                              "description": "Jacob Barclays holiday",
                              "amount": -15,
                              "id": "4ff304ac4c5d83b264e2077ee5742cfd",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-12T00:00:00Z",
                              "description": "Jacob Barclays holiday",
                              "amount": -10,
                              "id": "2f48a0db6c06f72b2f2453e033c45d59",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-12T00:00:00Z",
                              "description": "THUR HOSK SO LLP work w/e 12.9.25",
                              "amount": 220,
                              "id": "2eb349e09df20e7e811525c18130a684",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Deliveroo",
                              "timestamp": "2025-09-11T00:00:00Z",
                              "description": "DELIVEROO LONDON",
                              "amount": -18.68,
                              "id": "e6c038ae8032d7c918c6816cf8f24a59",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -550.67,
                              "id": "14b11a87620190e2b202574bdfb2d2e4",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "Se Iou",
                              "amount": -100,
                              "id": "3a6fc65196ab7f60ff8cca5d9a1d6d73",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -1500,
                              "id": "f64c8549d4927508cbee937952190e20",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "B ARCHER Owings finl",
                              "amount": -200,
                              "id": "4f1d2724e46e78ebd57b6ba524790134",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "JACOB ARCHER-MORANGWN25",
                              "amount": 2400,
                              "id": "ee587010c1a76619f7888e7448df3dac",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "d75cef9e6315bb83253b19168862250f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "ae6eed564313fee88ec7c7c5438918ab",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-08T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "542682a6285d84feca8f41b770f3e51d",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-09-07T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -1065.68,
                              "id": "0ea56de940d75d4b26c76aeee4ba8ddc",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-07T00:00:00Z",
                              "description": "Arc-McDo B Greece",
                              "amount": 500,
                              "id": "908b356faa560c1910ab62699105519e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-06T00:00:00Z",
                              "description": "THUR HOSK SO LLP work w/e 6.9.25",
                              "amount": 800,
                              "id": "4eb4becb238395fa3a60bff26b2e4797",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-04T00:00:00Z",
                              "description": "Non-Sterling Transaction Fee",
                              "amount": -0.23,
                              "id": "ea0be3b2bdf96aae306c31f03a7dce57",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-04T00:00:00Z",
                              "description": "INT'L 0037058365 DUOFAX.COM PRAHA 4 EUR 10.00 @ 1.1481 Visa Rate",
                              "amount": -8.71,
                              "id": "652937aac30a98c6022e1a134f3fcb60",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Google",
                              "timestamp": "2025-09-04T00:00:00Z",
                              "description": "GOOGLE *Google Plag.co/helppay#",
                              "amount": -12.99,
                              "id": "278277a7b541c44bc889fb469bb9dfad",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-09-04T00:00:00Z",
                              "description": "HLTN39 PRIME VIDE",
                              "amount": -5,
                              "id": "99cf0d9025219e9db05846853a886e41",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco",
                              "timestamp": "2025-09-03T00:00:00Z",
                              "description": "HLTN38 TESCO STORE",
                              "amount": -3.3,
                              "id": "0d09b7e15204724f016ad93b16d0b610",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-02T00:00:00Z",
                              "description": "THUR HOSK SO LLP CPC Expenses",
                              "amount": 29.52,
                              "id": "2084d3432b19833661dd626133b0c011",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Apple",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "PAYPAL *APPLE.COM/35314369001",
                              "amount": -0.99,
                              "id": "77de55dd13ff2d0e4d5b567d0c3d64c4",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Paypal",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "PAYPAL *UBERTRIP 35314369001",
                              "amount": -4.99,
                              "id": "ea9f9e6c2df2b1ba21ee791671120703",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "404434 21857479 INTERNET TRANSFER",
                              "amount": 130,
                              "id": "6260e8341669381eaa8163ab03e303e1",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "CAR STEWART S",
                              "amount": 70,
                              "id": "fabe29bf4ded2b8b45199b2de974cacb",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "24003b987c8d8caf48030c00403c100f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "f80b053a0dec8f9fcc2f804ff9dec59b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "b4df868d5c5422886bea471a5174e409",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "DVLA-WF60YWP",
                              "amount": -18.81,
                              "id": "db806b00827eff941557b092e65eb54e",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Driver And Vehicle Licensing Agency",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "DVLA-OE62WGD",
                              "amount": -29.31,
                              "id": "95d09ab23421509f6c09ad72aac77364",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Admiral",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "ADMIRAL INSURANCE",
                              "amount": -90.18,
                              "id": "5aaed144c1a4ae4e6d79906103c4e3e9",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "PROSPECT UNION",
                              "amount": -11.25,
                              "id": "3742b35a64f665ca2dafbf728f778757",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Tesco Bank",
                              "timestamp": "2025-08-30T00:00:00Z",
                              "description": "TESCO BANK 518652******0936",
                              "amount": -200,
                              "id": "7792426ac76f46c4c60e6aa0d15f15a2",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-30T00:00:00Z",
                              "description": "STEWART S Holidayxx",
                              "amount": 245,
                              "id": "1abd212b42e55440112ca9b8e2b87d9f",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-26T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "27604ce52ddf620af046a390ebee4221",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-26T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "0455665fdc4e6f857f8aa209093f6b1c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-26T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "ed9a9f36174e9d87770cbef4723ae752",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Klarna",
                              "timestamp": "2025-08-26T00:00:00Z",
                              "description": "KLARNA",
                              "amount": -19.96,
                              "id": "b19e2c02f668f78678effca245c1f9e2",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-23T00:00:00Z",
                              "description": "Se Iou",
                              "amount": -50,
                              "id": "02747dcd4efaac2d613cd130ade34a7c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "BILL_PAYMENT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Booking.com",
                              "timestamp": "2025-08-21T00:00:00Z",
                              "description": "HLTN37 BOOKING.COM",
                              "amount": -46.9,
                              "id": "a237465f6e362d37cdc703b64a22a153",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Wix",
                              "timestamp": "2025-08-19T00:00:00Z",
                              "description": "WIX.COM LONDON",
                              "amount": -27.6,
                              "id": "a3e6fe9e6de03e974c4008c18a27161c",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-18T00:00:00Z",
                              "description": "ME GROUP INTERNATIME Group Refund",
                              "amount": 7,
                              "id": "724af9b44b895a3513293f8b501e94bf",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-18T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "36f55f318292670ffe01e57043bd6f5b",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-18T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "6d29b0e8f86cf4e577a73692c6702b67",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-18T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "11d40f95b89886b124b16f1fb2d55d78",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Amazon Prime Video",
                              "timestamp": "2025-08-15T00:00:00Z",
                              "description": "HLTN36 PRIME VIDE",
                              "amount": -4,
                              "id": "981f25ee4c213239859270fd6b1ad6c7",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "WM Morrisons",
                              "timestamp": "2025-08-11T00:00:00Z",
                              "description": "WM MORRISONS STOREFAKENHAM",
                              "amount": -51.5,
                              "id": "4dd658bb513f80a1f873c6268248b798",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "PURCHASE",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-11T00:00:00Z",
                              "description": "LISA Arc-McDo B",
                              "amount": 20,
                              "id": "5343cd69b6e062310b6c47f3191c255d",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-11T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "3ad70ec958f634869ebd7364f9ac747a",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Moneybox",
                              "timestamp": "2025-08-11T00:00:00Z",
                              "description": "MONEYBOX",
                              "amount": -30,
                              "id": "fdc93358e0c4f27e4191ac62f83ebf65",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "Nhs Prescription Prepayment Certificates",
                              "timestamp": "2025-08-11T00:00:00Z",
                              "description": "NHSBSA PPC 2",
                              "amount": -11.45,
                              "id": "3b8c304a7d6d3f2c5eaaacc4fea7b182",
                              "account_id": "4c82630f5b8bccce242ff3fbb4740b8d",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            }
                          ]
                        },
                        "071fc97cd0cf36290a519783bb8f1114": {
                          "info": {
                            "number": {
                              "iban": "GB13MIDL40443421857479",
                              "number": "21857479",
                              "sort_code": "40-44-34",
                              "swift_bic": ""
                            },
                            "name": "FLEX SAVER",
                            "provider": {
                              "id": "ob-hsbc",
                              "name": "HSBC"
                            },
                            "_key": "••••••",
                            "balance": {
                              "available": 50.3,
                              "current": 50.3,
                              "overdraft": 0
                            },
                            "info": [
                              {
                                "full_name": "Mr Jacob Robert Archer-Moran",
                                "phones": null,
                                "date_of_birth": "",
                                "emails": null,
                                "update_timestamp": "2025-11-06T18:03:12.7946689Z",
                                "addresses": null
                              }
                            ],
                            "credentials_id": "••••••",
                            "currency": "GBP",
                            "metadata": {
                              "created_at": 1762452195941,
                              "tl": {
                                "account_id": "071fc97cd0cf36290a519783bb8f1114",
                                "debug_id": "",
                                "download_status": "complete",
                                "task_id": "6e9ab6b3-75ec-4717-99f1-e89318a60451"
                              },
                              "updated_at": 1762452194836
                            },
                            "type": "SAVINGS"
                          },
                          "statement": [
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-06T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "05a65b1d49babb4d449db63687f32262",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-30T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "30f053128f38de8ef7e0262302cffc8b",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-28T00:00:00Z",
                              "description": "404434 71857460 INTERNET TRANSFER",
                              "amount": -50,
                              "id": "0e25dc2e339a922ea4d407d861cf0465",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-23T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "8b60e9df59164c3719eb8ba2a3737066",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-20T00:00:00Z",
                              "description": "GROSS INTEREST TO 19OCT2025",
                              "amount": 0.05,
                              "id": "dc8ccae8b5d94ff4a6f84b741f21c4f0",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "INTEREST",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-16T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "9c2d073f614ff5cf9c5c4c89f98c5548",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-09T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "0fd34b36a11b2a5beaed5d0bdfb71e2a",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-02T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "2f161e27a5d0124a855fb5958ba8d4ca",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-25T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "d78230be74370f682fa0ef2a3427fa9e",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-20T00:00:00Z",
                              "description": "GROSS INTEREST TO 19SEP2025",
                              "amount": 0.06,
                              "id": "e293c607abb4a95228cf43e765873533",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "INTEREST",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-18T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "5a7ab01dbe8e3f6f16da8623e1180077",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-11T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "7e155bf256e41c799e87179c9e435440",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-04T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "b4e3c8cbc22858e1f742715fcf60d9ce",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-01T00:00:00Z",
                              "description": "404434 71857460 INTERNET TRANSFER",
                              "amount": -130,
                              "id": "104b2be93860d304d1bc5e53291b36f7",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-28T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "7073d71d64314581f68658976cb5b8bd",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-21T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "3cb960a06eed48da5a7b09ab486254d8",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-20T00:00:00Z",
                              "description": "GROSS INTEREST TO 19AUG2025",
                              "amount": 0.1,
                              "id": "2e171add99d24c5785fc3f538ceefc46",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "INTEREST",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-08-14T00:00:00Z",
                              "description": "GRANDAD Arc-McDo B",
                              "amount": 10,
                              "id": "7516e2bdd553795219da981866e5510b",
                              "account_id": "071fc97cd0cf36290a519783bb8f1114",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            }
                          ]
                        },
                        "6f1032d40aa61c12cec47fe3295d6a22": {
                          "info": {
                            "number": {
                              "iban": "GB30TSBS77856600948872",
                              "number": "00948872",
                              "sort_code": "77-85-66",
                              "swift_bic": ""
                            },
                            "name": "Spend & Save Account",
                            "provider": {
                              "id": "ob-tsb",
                              "name": "TSB"
                            },
                            "_key": "••••••",
                            "balance": {
                              "available": 168.2,
                              "current": 168.2,
                              "overdraft": 0
                            },
                            "info": [
                              {
                                "full_name": "JACOB ARCHER-MORAN",
                                "phones": null,
                                "date_of_birth": "",
                                "emails": null,
                                "update_timestamp": "2025-11-06T18:03:50.8306147Z",
                                "addresses": null
                              }
                            ],
                            "credentials_id": "••••••",
                            "currency": "GBP",
                            "metadata": {
                              "created_at": 1762452231890,
                              "tl": {
                                "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                                "debug_id": "",
                                "download_status": "complete",
                                "task_id": "1d27c4ca-4f32-42cb-b047-856c3c8af4f7"
                              },
                              "updated_at": 1762452231221
                            },
                            "type": "TRANSACTION"
                          },
                          "statement": [
                            {
                              "merchant_name": "",
                              "timestamp": "2025-11-04T00:18:28.578Z",
                              "description": "PC/SIMPLY BUSINESS REFERENCE: 04AEID7113/021/101",
                              "amount": -29.17,
                              "id": "ef80b7ecc4a206ce875d0ff7a55e1e40",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-27T19:27:13.285Z",
                              "description": "Arch-Mo J R work return iou",
                              "amount": 150,
                              "id": "d3cdcae5db4e4d841b712edacbea2e63",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-22T10:55:41.267Z",
                              "description": "S I STEWART work",
                              "amount": -150,
                              "id": "ef4894288d0bd608da7f62ab0c8620ff",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-02T13:10:35.762Z",
                              "description": "Jacob Robert arche GWD25",
                              "amount": -2300,
                              "id": "92c3449a9c1be6eee3b5ca3158f42142",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-10-01T15:45:28.701Z",
                              "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                              "amount": 2281.4,
                              "id": "0da74102e67736d0d00b6ba34242ccf7",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T13:34:27.36Z",
                              "description": "Jacob Robert arche GWN25",
                              "amount": -2400,
                              "id": "573b7ae1980c153f29d339e0287e6380",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-08T13:31:33.02Z",
                              "description": "BARBARA ARCHER owings x8",
                              "amount": -1200,
                              "id": "b7ccd74b1bc5f769843be499609633db",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-09-06T15:28:41.212Z",
                              "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                              "amount": 3613.9,
                              "id": "5c649b28a5641841b68b2bab28d23d05",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-07-27T23:36:15.32Z",
                              "description": "PC/SIMPLY BUSINESS REFERENCE: 04AEID7113/020/110",
                              "amount": -31.45,
                              "id": "92375813d37ae5e6c2126206f655d6d3",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-07-21T11:14:19.861Z",
                              "description": "Jacob Robert arche EGB",
                              "amount": -1200,
                              "id": "d0725de51ca36db9224996992bea9661",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-07-19T12:31:46.982Z",
                              "description": "SHOWBITZ LTD SHOWITZ LIMITED",
                              "amount": 1260,
                              "id": "e3349fb77f4ca0852d5bd241627a8aad",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-07-09T18:52:09.029Z",
                              "description": "Jacob Robert arche Powderham Presents",
                              "amount": -2200,
                              "id": "09a91579d867b94d34dd00f5bfbce4a0",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-07-09T10:07:54.167Z",
                              "description": "SWIFTELEX LIMITED SwiftElex Limited",
                              "amount": 2355,
                              "id": "04c554385e5106117f24163d80f2a849",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-06-29T23:51:36.853Z",
                              "description": "PC/SIMPLY BUSINESS REFERENCE: 04AEID7113/020/109",
                              "amount": -31.45,
                              "id": "b663e499c45ed0724782343398e4985d",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-06-02T00:31:32.136Z",
                              "description": "Jacob Robert arche Balter",
                              "amount": -800,
                              "id": "311d09c0be0d33a8e36dd4951cd8d0a8",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-05-30T07:58:04.461Z",
                              "description": "E&C EVENTS LTD BALTER 25",
                              "amount": 800,
                              "id": "e86445c66a21cf38609e252ea5d45add",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "CREDIT",
                              "classification": null,
                              "type": "CREDIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            },
                            {
                              "merchant_name": "",
                              "timestamp": "2025-05-27T23:26:32.766Z",
                              "description": "PC/SIMPLY BUSINESS REFERENCE: 04AEID7113/020/108",
                              "amount": -31.45,
                              "id": "b180018880cdbf89cf6683a8e45f1d43",
                              "account_id": "6f1032d40aa61c12cec47fe3295d6a22",
                              "currency": "GBP",
                              "category": "DIRECT_DEBIT",
                              "classification": null,
                              "type": "DEBIT",
                              "counterparty_name": "",
                              "counterparty_iban": ""
                            }
                          ]
                        }
                      },
                      "analysis": {
                        "id": "4151814597",
                        "repeating_transactions": [
                          {
                            "sort_score": 3613.9,
                            "items": [
                              "0da74102e67736d0d00b6ba34242ccf7",
                              "5c649b28a5641841b68b2bab28d23d05",
                              "e3349fb77f4ca0852d5bd241627a8aad"
                            ]
                          },
                          {
                            "sort_score": 2400,
                            "items": [
                              "573b7ae1980c153f29d339e0287e6380",
                              "92c3449a9c1be6eee3b5ca3158f42142"
                            ]
                          },
                          {
                            "sort_score": 2400,
                            "items": [
                              "d5fdf791a4294d42275adabc74e82413",
                              "ee587010c1a76619f7888e7448df3dac"
                            ]
                          },
                          {
                            "sort_score": 2034.26,
                            "items": [
                              "0ea56de940d75d4b26c76aeee4ba8ddc",
                              "14b11a87620190e2b202574bdfb2d2e4",
                              "282a0116410532bb12df1fce68ff2ca2",
                              "313deb3db30a087d274b7429bc9637b9",
                              "3c8640af1c234df97be59a19b6af559b",
                              "7792426ac76f46c4c60e6aa0d15f15a2",
                              "f64c8549d4927508cbee937952190e20"
                            ]
                          },
                          {
                            "sort_score": 800,
                            "items": [
                              "2eb349e09df20e7e811525c18130a684",
                              "4eb4becb238395fa3a60bff26b2e4797",
                              "65bea463c180e32c536ebf770ad4f6db"
                            ]
                          },
                          {
                            "sort_score": 600,
                            "items": [
                              "c84f0526ba6a0e5fbfb96fb23e3ae47f",
                              "fc339ff805ae07fb3bc7355dce8f7050"
                            ]
                          },
                          {
                            "sort_score": 245,
                            "items": [
                              "1abd212b42e55440112ca9b8e2b87d9f",
                              "d1c97b4c29623482d6ff920ded9ffddc",
                              "db76f59f7ac5395ab94ec1a7d5648ee2"
                            ]
                          },
                          {
                            "sort_score": 130,
                            "items": [
                              "0e25dc2e339a922ea4d407d861cf0465",
                              "104b2be93860d304d1bc5e53291b36f7"
                            ]
                          },
                          {
                            "sort_score": 130,
                            "items": [
                              "6260e8341669381eaa8163ab03e303e1",
                              "e8dc9f623531137194dad9a1eda4b000"
                            ]
                          },
                          {
                            "sort_score": 110,
                            "items": [
                              "02747dcd4efaac2d613cd130ade34a7c",
                              "2789d8f6f89e6d2f4dec2a99dd406980",
                              "3a6fc65196ab7f60ff8cca5d9a1d6d73",
                              "8aaca016c37aae8ae9737b19a065d93a"
                            ]
                          },
                          {
                            "sort_score": 90.18,
                            "items": [
                              "4c188f7806f94d3181ee32fc0e341764",
                              "5aaed144c1a4ae4e6d79906103c4e3e9",
                              "db20112ffe29f638cf31e056b0678467"
                            ]
                          },
                          {
                            "sort_score": 83,
                            "items": [
                              "90b3268e9033cbe4deb0d2e0f5ea5eff",
                              "b313e4d32fd1730ec75ff9a94639e447"
                            ]
                          },
                          {
                            "sort_score": 70,
                            "items": [
                              "9738cf4da5ca96b561a70e21a6b8e666",
                              "ea13d2a5a3d225c323b8193b4a5d1dd8",
                              "fabe29bf4ded2b8b45199b2de974cacb"
                            ]
                          },
                          {
                            "sort_score": 49.97,
                            "items": [
                              "0aa200fd9617c25aa5984a9395e1ffe8",
                              "3e7088d0021f50795f1bb6636abd1f2f",
                              "5ff7571700be937346932392ded4e84b",
                              "6e4bfc8286eb54cbf5cf1d7030175d54",
                              "f51ae34cf58f79774ef91ff72fd2a4f4"
                            ]
                          },
                          {
                            "sort_score": 38.38,
                            "items": [
                              "480b4c4823d8d7e8da089e9e95878bda",
                              "66c9b09401a82e6a93c16a4686eb972f",
                              "7354365839e01f9ae93d96ed75ddf5ee",
                              "748ebfbf7f8d39bed8c5eaf4e11a6eff",
                              "b5a5ae621bbe8bac674b027f047bac97",
                              "d09c63041f2cb6c6d38f8ff828617356"
                            ]
                          },
                          {
                            "sort_score": 31.45,
                            "items": [
                              "92375813d37ae5e6c2126206f655d6d3",
                              "b180018880cdbf89cf6683a8e45f1d43",
                              "b663e499c45ed0724782343398e4985d",
                              "ef80b7ecc4a206ce875d0ff7a55e1e40"
                            ]
                          },
                          {
                            "sort_score": 30,
                            "items": [
                              "0309bc1935d09be5822855cf322f70cc",
                              "0455665fdc4e6f857f8aa209093f6b1c",
                              "11d40f95b89886b124b16f1fb2d55d78",
                              "14315818ab265b9e865341971ca3cf7e",
                              "15698d426b434690ca629a80c68bbc9a",
                              "18cc7f418b45382939ab155c3342a88b",
                              "3ad70ec958f634869ebd7364f9ac747a",
                              "473567e154be184192a74a2fd31e8171",
                              "542682a6285d84feca8f41b770f3e51d",
                              "58410776ed94bee425e6802e9d8bfb08",
                              "6517ef405e4e6df7ad3a02ca3303ff02",
                              "6d29b0e8f86cf4e577a73692c6702b67",
                              "6d8e97047838357c619ae9de7b76e52e",
                              "725d9bb576d08331bc049efeb5175250",
                              "77bda169d7f18df9e0350118929e55c1",
                              "9e462d0d506872cbc794e034eb96a8bd",
                              "ae6eed564313fee88ec7c7c5438918ab",
                              "b4df868d5c5422886bea471a5174e409",
                              "c104d08004a929187f8611aa62d6141b",
                              "c4e8a8624a787db81490123872b4c090",
                              "de57508d74169eda397e6758d2709f0c",
                              "ed9a9f36174e9d87770cbef4723ae752",
                              "f0cb165438e9f457043b6291208f8142",
                              "f0f4a7e4a0b6e57308ecd882243d9d6f",
                              "f80b053a0dec8f9fcc2f804ff9dec59b",
                              "fdc93358e0c4f27e4191ac62f83ebf65"
                            ]
                          },
                          {
                            "sort_score": 29.97,
                            "items": [
                              "0fa775e9fa58f8a57b2281d856f4677d",
                              "278277a7b541c44bc889fb469bb9dfad",
                              "5f375a74644bd908e00fd03834d1e579",
                              "92d3324c249c1da1648506bf22a36a2f"
                            ]
                          },
                          {
                            "sort_score": 29.31,
                            "items": [
                              "0375fd775ea648bae3eea8ec7de8b713",
                              "43580b657664533030bf8af3bfd6ad8e",
                              "8b815c0f80804a7933ef4966d278015f",
                              "95d09ab23421509f6c09ad72aac77364",
                              "db806b00827eff941557b092e65eb54e",
                              "f918f881fb7eee736b8db824fb0f42bf"
                            ]
                          },
                          {
                            "sort_score": 20.98,
                            "items": [
                              "63016b02bf97950287954693ee4e39c5",
                              "9881ca248ed50b787bb58df2f5b3c777",
                              "db00abb4cb860f45ae492c01ef9e2678",
                              "e6c038ae8032d7c918c6816cf8f24a59",
                              "fd6d855773564077849e35ffb31b0d5c"
                            ]
                          },
                          {
                            "sort_score": 20,
                            "items": [
                              "000fdb8c5d670d5a1cfc9298e6a9aa08",
                              "24003b987c8d8caf48030c00403c100f",
                              "27604ce52ddf620af046a390ebee4221",
                              "36f55f318292670ffe01e57043bd6f5b",
                              "3e30d63678a3853fa0c6c72ea04cd3cc",
                              "3fa9b21c0eb1d3c8b5c0603c6440bc7b",
                              "5343cd69b6e062310b6c47f3191c255d",
                              "5f930488e74ed312a8480764c4981aa4",
                              "b4e6e3e698d83bd34493d70b864ef210",
                              "d75cef9e6315bb83253b19168862250f",
                              "e3d73daf8064029bd77095eb288626df",
                              "e5eb85608f0211749d34f470bac543e2",
                              "fea61beecc5bc5a72a5bdb0976c7bb25"
                            ]
                          },
                          {
                            "sort_score": 19.96,
                            "items": [
                              "b19e2c02f668f78678effca245c1f9e2",
                              "e85d67c773a0a59136dad03d27b89f8c"
                            ]
                          },
                          {
                            "sort_score": 18,
                            "items": [
                              "57efabbf4332c55d74b2145b3ed89a52",
                              "66794a0e3d6f8d55d6bb0bd2476c8667",
                              "689739b38b650b11fe07cffa4ae44318"
                            ]
                          },
                          {
                            "sort_score": 15,
                            "items": [
                              "19f23841755f5f748f6d27d11d85d597",
                              "525f95c9eeeaf311e3c61196801ade8d"
                            ]
                          },
                          {
                            "sort_score": 15,
                            "items": [
                              "2f48a0db6c06f72b2f2453e033c45d59",
                              "4ff304ac4c5d83b264e2077ee5742cfd"
                            ]
                          },
                          {
                            "sort_score": 14.2,
                            "items": [
                              "195adc7b7f10efe1bfda62c24dbd0a07",
                              "be44b1efe0dfa1282da88d4d90446f0f"
                            ]
                          },
                          {
                            "sort_score": 14,
                            "items": [
                              "1574fbd61b751b043d1a70f4eacc534f",
                              "787afb76f56828da3d4df278d4ab4256",
                              "816c182fd4846287a6555db48f99500a"
                            ]
                          },
                          {
                            "sort_score": 11.25,
                            "items": [
                              "148fff3918e5d81fda9aa0a6a6d32dbf",
                              "3742b35a64f665ca2dafbf728f778757",
                              "5ecbcc1af74c6fb0b4f46f84010380c0"
                            ]
                          },
                          {
                            "sort_score": 10,
                            "items": [
                              "05a65b1d49babb4d449db63687f32262",
                              "0fd34b36a11b2a5beaed5d0bdfb71e2a",
                              "2f161e27a5d0124a855fb5958ba8d4ca",
                              "30f053128f38de8ef7e0262302cffc8b",
                              "3cb960a06eed48da5a7b09ab486254d8",
                              "5a7ab01dbe8e3f6f16da8623e1180077",
                              "7073d71d64314581f68658976cb5b8bd",
                              "7516e2bdd553795219da981866e5510b",
                              "7e155bf256e41c799e87179c9e435440",
                              "8b60e9df59164c3719eb8ba2a3737066",
                              "9c2d073f614ff5cf9c5c4c89f98c5548",
                              "b4e3c8cbc22858e1f742715fcf60d9ce",
                              "d78230be74370f682fa0ef2a3427fa9e"
                            ]
                          },
                          {
                            "sort_score": 8.79,
                            "items": [
                              "1e9ddbd0ab75bae40bd07f0c33934013",
                              "652937aac30a98c6022e1a134f3fcb60",
                              "e1affbffd520a240dfcfe1636eb7edf5"
                            ]
                          },
                          {
                            "sort_score": 5,
                            "items": [
                              "05b28649733c15d4d1d0d2e9af83ad56",
                              "981f25ee4c213239859270fd6b1ad6c7",
                              "99cf0d9025219e9db05846853a886e41",
                              "a1655eeb312498a610245c1cc2c2b12c",
                              "c4dfdfe558fe18e7863df736090484b0"
                            ]
                          },
                          {
                            "sort_score": 5,
                            "items": [
                              "730dd473547662d027b04f30a5387375",
                              "8f61b6d855559654f78783f09341f831"
                            ]
                          },
                          {
                            "sort_score": 4.99,
                            "items": [
                              "978597377aad280b5e524a94a4e97d28",
                              "ea9f9e6c2df2b1ba21ee791671120703"
                            ]
                          },
                          {
                            "sort_score": 0.99,
                            "items": [
                              "77de55dd13ff2d0e4d5b567d0c3d64c4",
                              "f5c08a758d1d481bcf1f07d088161874"
                            ]
                          },
                          {
                            "sort_score": 0.24,
                            "items": [
                              "0fed04a35afb73104eb934f0b51a734c",
                              "61ac548a6c55b987e741d3c70b7bf82e",
                              "a49711695aee358ffcd41a31223ae9d8",
                              "ea0be3b2bdf96aae306c31f03a7dce57"
                            ]
                          },
                          {
                            "sort_score": 0.1,
                            "items": [
                              "2e171add99d24c5785fc3f538ceefc46",
                              "dc8ccae8b5d94ff4a6f84b741f21c4f0",
                              "e293c607abb4a95228cf43e765873533"
                            ]
                          }
                        ],
                        "large_one_off_transactions": [
                          "09a91579d867b94d34dd00f5bfbce4a0",
                          "b7ccd74b1bc5f769843be499609633db",
                          "d0725de51ca36db9224996992bea9661",
                          "311d09c0be0d33a8e36dd4951cd8d0a8",
                          "a340d0e9eecc82a393a2c4cfd23d5688",
                          "4f1d2724e46e78ebd57b6ba524790134",
                          "2e6ee436a7394f2406fdebb7664f0dc1",
                          "85edd8e1479758f6319dbaddf1c7ea07",
                          "4e74dc5b71f6cab998e729cb943a5805",
                          "6cc540e761172036d41dca37fce01d38",
                          "04c554385e5106117f24163d80f2a849",
                          "9ff7a8f1b4bb4337e257c78ad2629d25",
                          "e86445c66a21cf38609e252ea5d45add",
                          "908b356faa560c1910ab62699105519e",
                          "6d74678683171682a62ffc97c03953d8",
                          "d3cdcae5db4e4d841b712edacbea2e63",
                          "41f008d187aacafb9284eb4c05aa1229",
                          "443f1383ff63083d556fd8bdebaba1dd",
                          "2084d3432b19833661dd626133b0c011",
                          "3a05881505230f565f56c9770184af71"
                        ],
                        "sof_matches": {
                          "gift": [
                            "d5fdf791a4294d42275adabc74e82413",
                            "ee587010c1a76619f7888e7448df3dac"
                          ]
                        }
                      }
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [],
                    "id": "d46e77423amg030rw9vg",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:06:20.781Z"
                  },
                  "documents:inheritance": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46e6r323amg030rw9dg",
                          "type": "inheritance"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46e6r323amg030rw9dg"
                    ],
                    "id": "d46e76w23amg030rw9gg",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:06:19.414Z"
                  },
                  "documents:sale-assets": {
                    "breakdown": {
                      "documents": [
                        {
                          "id": "d46e71m23amg030rw9eg",
                          "type": "sale-assets"
                        }
                      ]
                    },
                    "data": {},
                    "result": "clear",
                    "documents": [
                      "d46e71m23amg030rw9eg"
                    ],
                    "id": "d46e77423amg030rw9pg",
                    "status": "closed",
                    "createdAt": "2025-11-06T18:06:20.221Z"
                  }
                },
                "updatedAt": "2025-11-06T18:06:27.223Z",
                "consumerPhone": "+447506430094",
                "pdfReady": true,
                "checkType": "electronic-id",
                "completedAt": "2025-11-06T18:06:27.223Z",
                "initiatedAt": "2025-11-06T17:58:26.507Z",
                "pdfS3Key": "protected/lXlh3Yd",
                "consumerName": "Jacob Robert Moran",
                "tasks": [
                  "documents:poa",
                  "report:sof-v1",
                  "report:bank-statement",
                  "report:bank-summary"
                ],
                "updates": [
                  {
                    "timestamp": "2025-11-06T17:58:26.507Z",
                    "update": "Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-06T18:06:27.223Z",
                    "update": "Transaction completed - awaiting PDF"
                  },
                  {
                    "timestamp": "2025-11-06T18:07:35.445Z",
                    "update": "PDF received and uploaded to S3 - CLEAR"
                  }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "piiData": {
                  "name": {},
                  "address": {},
                  "document": {}
                },
                "hasMonitoring": false,
                "thirdfortResponse": {
                  "name": "Purchase of 21 Green Lane",
                  "request": {
                    "actor": {
                      "name": "Jacob Robert Moran",
                      "phone": "+447506430094"
                    },
                    "tasks": [
                      {
                        "type": "documents:poa"
                      },
                      {
                        "type": "report:sof-v1"
                      },
                      {
                        "type": "report:bank-statement"
                      },
                      {
                        "type": "report:bank-summary"
                      }
                    ]
                  },
                  "ref": "21 Green Lane",
                  "id": "d46e3ge23amg030rw8y0",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "GgUi5IyCFm4TOsMy3Q4cvq6bnQEBJq/0uRqECCRoz+4=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t0auq9io6g00ak3kkg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "THS Bot"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t0auq9io6g00ak3kkg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797881"
                    },
                    "created_at": "2025-11-06T17:58:24.527Z"
                  },
                  "type": "v2",
                  "opts": {}
                },
                "hasAlerts": false,
                "pdfAddedAt": "2025-11-06T18:07:35.445Z",
                "smsSent": true,
                "transactionId": "d46e3ge23amg030rw8y0",
                "redFlags": [
                  {
                    "description": "Gifts Received",
                    "supporting_data": "1 gift received - £10,000.00",
                    "threshold_amount": "Any gifts flagged",
                    "source": "Source of Funds"
                  },
                  {
                    "description": "Declared savings > actual savings",
                    "declared": "£20,000.00",
                    "actual": "£253.71",
                    "source": "Bank Linking"
                  }
                ]
            },
            // Mock Check 7: Se Idris Stewart - Electronic ID - PENDING
            {
                "consumerPhone": "+447493580033",
                "checkType": "electronic-id",
                "initiatedAt": "2025-11-06T16:37:23.440Z",
                "consumerName": "Se Idris Stewart",
                "tasks": [
                  "report:identity",
                  "report:footprint",
                  "report:peps",
                  "documents:poa",
                  "report:sof-v1",
                  "report:bank-statement",
                  "report:bank-summary"
                ],
                "updates": [
                  {
                    "timestamp": "2025-11-06T16:37:23.440Z",
                    "update": "Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  }
                ],
                "status": "open",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "hasMonitoring": true,
                "thirdfortResponse": {
                  "name": "Purchase of 21 Green Lane",
                  "request": {
                    "actor": {
                      "name": "Se Idris Stewart",
                      "phone": "+447493580033"
                    },
                    "tasks": [
                      {
                        "opts": {
                          "nfc": "preferred"
                        },
                        "type": "report:identity"
                      },
                      {
                        "opts": {
                          "consent": false
                        },
                        "type": "report:footprint"
                      },
                      {
                        "opts": {
                          "monitored": true
                        },
                        "type": "report:peps"
                      },
                      {
                        "type": "documents:poa"
                      },
                      {
                        "type": "report:sof-v1"
                      },
                      {
                        "type": "report:bank-statement"
                      },
                      {
                        "type": "report:bank-summary"
                      }
                    ]
                  },
                  "ref": "21 Green Lane",
                  "id": "d46cxge23amg030rw7r0",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "0mF1p3cyDWZ51HIsGXPecer4a7uFQIXBk0JLO56Wr0U=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t0auq9io6g00ak3kkg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "THS Bot"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t0auq9io6g00ak3kkg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797877"
                    },
                    "created_at": "2025-11-06T16:37:19.858Z"
                  },
                  "type": "v2",
                  "opts": {
                    "peps": {
                      "monitored": true
                    }
                  }
                },
                "smsSent": true,
                "transactionId": "d46cxge23amg030rw7r0"
            },
            // Mock Check 8: Jacob Robert Archer-Moran - IDV - COMPLETED
            {
                "taskOutcomes": {
                  "identity:lite": {
                    "breakdown": {
                      "document": {
                        "name": "document",
                        "breakdown": {
                          "compromised_document": {
                            "result": "clear"
                          },
                          "data_consistency": {
                            "breakdown": {
                              "first_name": {
                                "properties": {},
                                "result": "clear"
                              },
                              "date_of_expiry": {
                                "properties": {},
                                "result": "clear"
                              },
                              "date_of_birth": {
                                "properties": {},
                                "result": "clear"
                              },
                              "last_name": {
                                "properties": {},
                                "result": "clear"
                              },
                              "nationality": {
                                "properties": {},
                                "result": "clear"
                              },
                              "issuing_country": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_numbers": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_type": {
                                "properties": {},
                                "result": "clear"
                              },
                              "gender": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "data_comparison": {
                            "breakdown": {
                              "first_name": {
                                "properties": {},
                                "result": "clear"
                              },
                              "date_of_expiry": {
                                "properties": {},
                                "result": "clear"
                              },
                              "date_of_birth": {
                                "properties": {},
                                "result": "clear"
                              },
                              "last_name": {
                                "properties": {},
                                "result": "clear"
                              },
                              "issuing_country": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_numbers": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_type": {
                                "properties": {},
                                "result": "clear"
                              },
                              "gender": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "data_validation": {
                            "breakdown": {
                              "mrz": {
                                "properties": {},
                                "result": "clear"
                              },
                              "date_of_birth": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_numbers": {
                                "properties": {},
                                "result": "clear"
                              },
                              "expiry_date": {
                                "properties": {},
                                "result": "clear"
                              },
                              "document_expiration": {
                                "properties": {},
                                "result": "clear"
                              },
                              "gender": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "image_integrity": {
                            "breakdown": {
                              "colour_picture": {
                                "properties": {},
                                "result": "clear"
                              },
                              "conclusive_document_quality": {
                                "properties": {},
                                "result": "clear"
                              },
                              "image_quality": {
                                "properties": {},
                                "result": "clear"
                              },
                              "supported_document": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "visual_authenticity": {
                            "breakdown": {
                              "face_detection": {
                                "properties": {},
                                "result": "clear"
                              },
                              "fonts": {
                                "properties": {},
                                "result": "clear"
                              },
                              "picture_face_integrity": {
                                "properties": {},
                                "result": "clear"
                              },
                              "original_document_present": {
                                "properties": {},
                                "result": "clear"
                              },
                              "security_features": {
                                "properties": {},
                                "result": "clear"
                              },
                              "digital_tampering": {
                                "properties": {},
                                "result": "clear"
                              },
                              "template": {
                                "properties": {},
                                "result": "clear"
                              },
                              "other": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "age_validation": {
                            "breakdown": {
                              "minimum_accepted_age": {
                                "properties": {},
                                "result": "clear"
                              }
                            },
                            "result": "clear"
                          },
                          "police_record": {
                            "result": "clear"
                          }
                        },
                        "result": "clear",
                        "documents": [
                          {
                            "id": "15c3d5a5-27fe-4205-8d1e-993bdd12425f"
                          }
                        ],
                        "id": "1c6010af-de27-438f-b4fe-2925922d9233",
                        "properties": {
                          "first_name": "Jacob",
                          "date_of_expiry": "2031-05-28",
                          "issuing_date": "2018-08-16",
                          "date_of_birth": "1990-01-01",
                          "last_name": "Moran",
                          "nationality": null,
                          "issuing_country": "GBR",
                          "document_numbers": [
                            {
                              "type": "document_number",
                              "value": "999999999"
                            }
                          ],
                          "document_type": "passport",
                          "gender": null
                        },
                        "status": "complete",
                        "created_at": "2025-11-06T14:24:13Z",
                        "href": "/v3.6/reports/1c6010af-de27-438f-b4fe-2925922d9233",
                        "sub_result": "clear"
                      }
                    },
                    "data": {
                      "name": {
                        "first": "Jacob",
                        "last": "Moran",
                        "other": "Robert"
                      }
                    },
                    "result": "clear",
                    "documents": [
                      "d46az5m23amg030rw7e0"
                    ],
                    "id": "d46az5423amg030rw7d0",
                    "status": "closed",
                    "createdAt": "2025-11-06T14:24:20.118Z"
                  }
                },
                "updatedAt": "2025-11-06T14:24:24.286Z",
                "pdfReady": true,
                "checkType": "idv",
                "completedAt": "2025-11-06T14:24:24.286Z",
                "documentsUploaded": true,
                "initiatedAt": "2025-11-06T14:24:07.606Z",
                "pdfS3Key": "protected/T0pW749",
                "updates": [
                  {
                    "timestamp": "2025-11-06T14:24:07.606Z",
                    "update": "IDV check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-06T14:24:12.835Z",
                    "update": "Documents uploaded by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-06T14:24:24.286Z",
                    "update": "Check completed - awaiting PDF"
                  },
                  {
                    "timestamp": "2025-11-06T14:24:41.148Z",
                    "update": "PDF received and uploaded to S3 - CLEAR"
                  }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "documentType": "passport",
                "hasMonitoring": false,
                "thirdfortResponse": {
                  "name": "Jacob Robert Moran - Document Verification",
                  "request": {
                    "data": {
                      "name": {
                        "first": "Jacob",
                        "last": "Moran",
                        "other": "Robert"
                      }
                    },
                    "reports": [
                      {
                        "type": "identity:lite"
                      }
                    ]
                  },
                  "ref": "50/52",
                  "id": "d46az1c23amg030rw740",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "Ues4QT63f9iE7YP6/AEgfV0oAxPz9ewWRrBNN2+XrfI=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t2m5q9io6g00ak3kmg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "Jacob Archer-Moran"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t2m5q9io6g00ak3kmg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797872"
                    },
                    "created_at": "2025-11-06T14:24:05.185Z"
                  },
                  "type": "document"
                },
                "companyData": {
                  "name": {
                    "first": "Jacob",
                    "last": "Moran",
                    "other": "Robert"
                  },
                  "numbers": []
                },
                "checkId": "d46az1c23amg030rw740",
                "hasAlerts": false,
                "pdfAddedAt": "2025-11-06T14:24:41.148Z"
            },
            // Mock Check 9: Jacob Robert Archer-Moran - Lite Screen - COMPLETED
            {
                "taskOutcomes": {
                  "address": {
                    "result": "fail",
                    "status": "closed",
                    "data": {
                      "quality": 0,
                      "sources": 0
                    }
                  },
                  "peps": {
                    "breakdown": {
                      "total_hits": 0,
                      "hits": []
                    },
                    "data": {
                      "dob": "2001-01-11T00:00:00.000Z",
                      "name": {
                        "first": "Jacob",
                        "last": "Archer-Moran",
                        "other": "Robert"
                      },
                      "address": {
                        "postcode": "TR15 2ND",
                        "country": "GBR",
                        "street": "Southgate Street",
                        "building_number": "94",
                        "town": "Redruth"
                      }
                    },
                    "result": "clear",
                    "documents": [
                      "d46az3w23amg030rw79g"
                    ],
                    "id": "d46az3c23amg030rw77g",
                    "status": "closed",
                    "createdAt": "2025-11-06T14:24:13.923Z"
                  },
                  "footprint": {
                    "breakdown": {
                      "data_count": {
                        "properties": {
                          "score": 0
                        },
                        "result": "consider"
                      },
                      "data_quality": {
                        "properties": {
                          "score": 0
                        },
                        "result": "consider"
                      },
                      "rules": [
                        {
                          "id": "U000",
                          "name": "",
                          "score": 0,
                          "text": "No trace of supplied Address(es), or manual Authentication required by the Applicant"
                        }
                      ],
                      "service_name": "Authenticateplus"
                    },
                    "data": {
                      "address": {
                        "postcode": "TR15 2ND",
                        "country": "GBR",
                        "street": "Southgate Street",
                        "building_number": "94",
                        "town": "Redruth"
                      },
                      "dob": "2001-01-11T00:00:00.000Z",
                      "name": {
                        "first": "Jacob",
                        "last": "Archer-Moran",
                        "other": "Robert"
                      }
                    },
                    "result": "fail",
                    "documents": [],
                    "id": "d46az2c23amg030rw75g",
                    "status": "closed",
                    "createdAt": "2025-11-06T14:24:09.471Z"
                  }
                },
                "pdfReady": true,
                "checkType": "lite-screen",
                "initiatedAt": "2025-11-06T14:24:03.509Z",
                "considerReasons": [
                  "address verification",
                  "digital footprint"
                ],
                "pdfS3Key": "protected/UNXOQyZ",
                "consumerName": "Jacob Archer-Moran",
                "tasks": [
                  "report:footprint",
                  "report:peps"
                ],
                "updates": [
                  {
                    "timestamp": "2025-11-06T14:24:03.509Z",
                    "update": "Lite Screen check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-06T14:24:21.661Z",
                    "update": "PEPs & Sanctions task completed"
                  },
                  {
                    "timestamp": "2025-11-06T14:24:59.640Z",
                    "update": "PDF received and uploaded to S3 - CONSIDER: address verification, digital footprint"
                  }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "piiData": {
                  "name": {
                    "first": "Jacob",
                    "last": "Archer-Moran",
                    "other": "Robert"
                  },
                  "address": {
                    "postcode": "TR15 2ND",
                    "country": "GBR",
                    "street": "Southgate Street",
                    "building_number": "94",
                    "town": "Redruth"
                  },
                  "dob": "2001-01-11T00:00:00.000Z",
                  "document": {}
                },
                "hasMonitoring": true,
                "thirdfortResponse": {
                  "name": "Jacob Archer-Moran - Lite Screening",
                  "request": {
                    "tasks": [
                      {
                        "opts": {
                          "consent": false
                        },
                        "type": "report:footprint"
                      },
                      {
                        "opts": {
                          "monitored": true
                        },
                        "type": "report:peps"
                      }
                    ]
                  },
                  "ref": "21 Green Lane",
                  "id": "d46az0c23amg030rw73g",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "Ues4QT63f9iE7YP6/AEgfV0oAxPz9ewWRrBNN2+XrfI=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t2m5q9io6g00ak3kmg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "Jacob Archer-Moran"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t2m5q9io6g00ak3kmg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797871"
                    },
                    "created_at": "2025-11-06T14:24:01.434Z"
                  },
                  "type": "v2",
                  "opts": {
                    "peps": {
                      "monitored": true
                    }
                  }
                },
                "expectations": {
                  "name": {
                    "data": {
                      "first": "Jacob",
                      "last": "Archer-Moran",
                      "other": "Robert"
                    }
                  },
                  "dob": {
                    "data": "2001-01-11T00:00:00.000Z"
                  },
                  "address": {
                    "data": {
                      "postcode": "TR15 2ND",
                      "country": "GBR",
                      "building_name": "",
                      "flat_number": "",
                      "street": "Southgate Street",
                      "building_number": "94",
                      "sub_street": "",
                      "town": "Redruth"
                    }
                  }
                },
                "hasAlerts": true,
                "pdfAddedAt": "2025-11-06T14:24:59.640Z",
                "transactionId": "d46az0c23amg030rw73g"
            },
            // Mock Check 10: Nigel Farage - Lite Screen - COMPLETED
            {
                "taskOutcomes": {
                  "screening:lite": {
                    "breakdown": {
                      "total_hits": 2,
                      "hits": [
                        {
                          "name": "Farage Nigel",
                          "assets": [
                            {
                              "public_url": "http://complyadvantage-asset-development.s3.amazonaws.com/e0fe3b97-e0eb-448f-a61c-93a3111355a1.jpg",
                              "type": "picture"
                            },
                            {
                              "public_url": "http://complyadvantage-asset-development.s3.amazonaws.com/bc450214-b99b-4063-9546-9a06bfe0e74d.jpg",
                              "type": "picture"
                            },
                            {
                              "public_url": "http://complyadvantage-asset.s3.amazonaws.com/a0caf84e-0a3c-4dc6-89ee-b3e4db2fd3ac.pdf",
                              "type": "pdf"
                            }
                          ],
                          "dob": {
                            "main": "1964",
                            "other": [
                              "1964-04-03",
                              "1964-03-04"
                            ]
                          },
                          "score": 1,
                          "flag_types": [
                            "adverse-media",
                            "adverse-media-financial-crime",
                            "adverse-media-fraud",
                            "adverse-media-general",
                            "adverse-media-narcotics",
                            "adverse-media-sexual-crime",
                            "adverse-media-terrorism",
                            "adverse-media-violent-crime",
                            "pep",
                            "pep-class-1",
                            "pep-class-2",
                            "pep-class-4"
                          ],
                          "source_notes": {
                            "united-kingdom-political-parties-leadership": {
                              "aml_types": [
                                "pep-class-1"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "United Kingdom Political Parties Leadership"
                            },
                            "united-kingdom-elected-parliament": {
                              "aml_types": [
                                "pep-class-1"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "United Kingdom Elected Parliament"
                            },
                            "complyadvantage": {
                              "aml_types": [
                                "pep-class-1",
                                "pep-class-2",
                                "pep-class-4"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "ComplyAdvantage PEP Data"
                            },
                            "complyadvantage-adverse-media": {
                              "aml_types": [
                                "adverse-media",
                                "adverse-media-financial-crime",
                                "adverse-media-fraud",
                                "adverse-media-general",
                                "adverse-media-narcotics",
                                "adverse-media-sexual-crime",
                                "adverse-media-terrorism",
                                "adverse-media-violent-crime"
                              ],
                              "country_codes": [
                                "BR",
                                "ES",
                                "FR",
                                "GB",
                                "IR",
                                "LK"
                              ],
                              "name": "ComplyAdvantage Adverse Media"
                            },
                            "pep-european-parliament-meps": {
                              "aml_types": [
                                "pep-class-2"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "European Union Parliament Leadership"
                            },
                            "pep-uk-parliament": {
                              "aml_types": [
                                "pep-class-1"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "United Kingdom Parliament"
                            },
                            "company-am": {
                              "aml_types": [
                                "adverse-media",
                                "adverse-media-financial-crime",
                                "adverse-media-fraud",
                                "adverse-media-general"
                              ],
                              "country_codes": [
                                "BE",
                                "GB",
                                "JP",
                                "MT"
                              ],
                              "name": "company AM"
                            }
                          },
                          "political_positions": [
                            "Member of the European Parliament",
                            "Member of the European Parliament",
                            "Member of the National Legislature",
                            "Member of the National Legislature",
                            "Senior Political Party Official"
                          ],
                          "countries": [
                            "Belgium",
                            "Brazil",
                            "France",
                            "Iran",
                            "Japan",
                            "Malta",
                            "Spain",
                            "Sri Lanka",
                            "United Kingdom"
                          ],
                          "aka": [
                            "Farage",
                            "Nigel Farage",
                            "Nigel Farge",
                            "Modi Nigel Farage",
                            "Farage Nigel",
                            "Nigel Farange",
                            "Nigel Paul Farage"
                          ],
                          "id": "MBCV344J0BV3UD0",
                          "match_types": [
                            "name_exact",
                            "year_of_birth"
                          ],
                          "fields": [
                            {
                              "name": "Original Place of Birth Text",
                              "source": "pep-european-parliament-meps",
                              "value": "Farnborough"
                            },
                            {
                              "name": "Original Place of Birth Text",
                              "source": "complyadvantage",
                              "value": "Farnborough"
                            },
                            {
                              "name": "Country",
                              "source": "company-am",
                              "value": "Belgium"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "company-am",
                              "value": "Belgium, Malta, United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "Brazil"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "complyadvantage-adverse-media",
                              "value": "Brazil, Spain"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "France"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "complyadvantage-adverse-media",
                              "value": "France, Iran"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "Iran"
                            },
                            {
                              "name": "Country",
                              "source": "company-am",
                              "value": "Japan"
                            },
                            {
                              "name": "Country",
                              "source": "united-kingdom-elected-parliament",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "company-am",
                              "value": "Japan, United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "united-kingdom-elected-parliament",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "company-am",
                              "value": "Malta"
                            },
                            {
                              "name": "Country",
                              "source": "pep-uk-parliament",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "pep-uk-parliament",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "Spain"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "Sri Lanka"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "complyadvantage-adverse-media",
                              "value": "Sri Lanka"
                            },
                            {
                              "name": "Country",
                              "source": "pep-european-parliament-meps",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage-adverse-media",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "pep-european-parliament-meps",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "complyadvantage-adverse-media",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Country",
                              "source": "complyadvantage",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "complyadvantage",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Place of Birth",
                              "source": "pep-uk-parliament",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Place of Birth Text",
                              "source": "pep-uk-parliament",
                              "value": "Farnborough, Kent, England"
                            },
                            {
                              "name": "Active Start Date",
                              "source": "united-kingdom-elected-parliament",
                              "value": "2024-07-17"
                            },
                            {
                              "name": "Active Start Date",
                              "source": "pep-uk-parliament",
                              "value": "2024-06-03"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "complyadvantage",
                              "value": "1964"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "complyadvantage",
                              "value": "1964-04-03"
                            },
                            {
                              "name": "Country",
                              "source": "company-am",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "pep-european-parliament-meps",
                              "value": "1964-03-04"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "pep-uk-parliament",
                              "value": "1964-04-03"
                            },
                            {
                              "name": "Political Position",
                              "source": "pep-european-parliament-meps",
                              "value": "Member of the European Parliament"
                            },
                            {
                              "name": "Political Position",
                              "source": "complyadvantage",
                              "value": "Member of the European Parliament"
                            },
                            {
                              "name": "Political Position",
                              "source": "united-kingdom-elected-parliament",
                              "value": "Member of the National Legislature"
                            },
                            {
                              "name": "Political Position",
                              "source": "pep-uk-parliament",
                              "value": "Member of the National Legislature"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "complyadvantage-adverse-media",
                              "value": "1964"
                            },
                            {
                              "name": "Political Position",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "Senior Political Party Official"
                            },
                            {
                              "name": "Additional Information",
                              "source": "complyadvantage",
                              "value": "A member of the European Parliament."
                            },
                            {
                              "name": "Chamber",
                              "source": "united-kingdom-elected-parliament",
                              "value": "Parliament"
                            },
                            {
                              "name": "Chamber",
                              "source": "pep-european-parliament-meps",
                              "value": "European Parliament"
                            },
                            {
                              "name": "Chamber",
                              "source": "pep-uk-parliament",
                              "value": "Parliament"
                            },
                            {
                              "name": "Chamber",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "Reform UK"
                            },
                            {
                              "name": "Chamber",
                              "source": "complyadvantage",
                              "value": "SURREY HEATH BOROUGH"
                            },
                            {
                              "name": "City",
                              "source": "complyadvantage",
                              "value": "Surrey"
                            },
                            {
                              "name": "Function",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "Leader"
                            },
                            {
                              "name": "Function",
                              "source": "united-kingdom-elected-parliament",
                              "value": "MPs"
                            },
                            {
                              "name": "Institution Type",
                              "source": "united-kingdom-elected-parliament",
                              "value": "National Bicameral Legislature"
                            },
                            {
                              "name": "Institution Type",
                              "source": "pep-uk-parliament",
                              "value": "National Bicameral Legislature"
                            },
                            {
                              "name": "Institution Type",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "Political Party"
                            },
                            {
                              "name": "Other Info",
                              "source": "pep-european-parliament-meps",
                              "value": "Non-attached Members"
                            },
                            {
                              "name": "Other Info",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "Officers"
                            },
                            {
                              "name": "Political Group",
                              "source": "complyadvantage",
                              "value": "Europe of Freedom and Direct Democracy Group"
                            },
                            {
                              "name": "Political Party",
                              "source": "united-kingdom-elected-parliament",
                              "value": "Reform UK"
                            },
                            {
                              "name": "Political Party",
                              "source": "pep-uk-parliament",
                              "value": "Reform UK"
                            },
                            {
                              "name": "Political Party",
                              "source": "pep-european-parliament-meps",
                              "value": "The Brexit Party"
                            },
                            {
                              "name": "Political Region",
                              "source": "united-kingdom-elected-parliament",
                              "value": "Clacton"
                            },
                            {
                              "name": "Political Region",
                              "source": "pep-uk-parliament",
                              "value": "Clacton"
                            },
                            {
                              "name": "Related URL",
                              "source": "complyadvantage",
                              "value": "http://surreyheath.moderngov.co.uk/mgMemberIndexMEP.aspx?bcr=7"
                            },
                            {
                              "name": "Related URL",
                              "source": "pep-uk-parliament",
                              "value": "https://members.parliament.uk/member/5091/contact"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://dbpedia.org/data/Nigel_Farage.json"
                            },
                            {
                              "name": "Locationurl",
                              "source": "pep-uk-parliament",
                              "value": "https://en.wikipedia.org/wiki/Nigel_Farage"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://en.wikipedia.org/wiki/Nigel_Farage"
                            },
                            {
                              "name": "Locationurl",
                              "source": "united-kingdom-political-parties-leadership",
                              "value": "https://search.electoralcommission.org.uk/English/Registrations/PP7931"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://www.google.com/search?hl=en-us&q=who+is+Farage&ucbcb=1"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://www.google.com/search?hl=en-us&q=who+is+Nigel+Farage&ucbcb=1"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://www.google.com/search?hl=en-us&q=who+is+Nigel+Paul+Farage&ucbcb=1"
                            },
                            {
                              "name": "Locationurl",
                              "source": "united-kingdom-elected-parliament",
                              "value": "https://www.parallelparliament.co.uk/MPs"
                            },
                            {
                              "name": "Picture URL Internal",
                              "source": "pep-european-parliament-meps",
                              "value": "http://complyadvantage-asset-development.s3.amazonaws.com/bc450214-b99b-4063-9546-9a06bfe0e74d.jpg"
                            },
                            {
                              "name": "Picture URL Internal",
                              "source": "complyadvantage",
                              "value": "http://complyadvantage-asset-development.s3.amazonaws.com/e0fe3b97-e0eb-448f-a61c-93a3111355a1.jpg"
                            },
                            {
                              "name": "Countries",
                              "value": "Belgium, Brazil, France, Iran, Japan, Malta, Spain, Sri Lanka, United Kingdom"
                            }
                          ],
                          "media": [
                            {
                              "date": "0001-01-01T00:00:00Z",
                              "snippet": "\" Farage should face highest penalty for serious breach of EP code of conduct<\\/a><\\/blockquote>\\n",
                              "title": "(no title)",
                              "url": "https://cde.news/wp-json/oembed/1.0/embed?url=https://cde.news/farage-should-face-highest-penalty-for-serious-breach-of-ep-code-of-conduct/"
                            },
                            {
                              "date": "2025-08-14T00:00:00Z",
                              "snippet": "The public was also not informed for months that Rudakubana had been referred to the anti-terror Prevent programme multiple times, but the police had dismissed him as a threat. For having questioned if there was a potential terror motive, figures such as Reform UK leader Nigel Farage were accused of spreading \"conspiracy theories\" and establishment media even blamed the Brexit boss for stoking the riots which broke out in the wake of the attack. However, the government's independent reviewer of terrorism legislation, Jonathan Hall KC, later vindicated Farage by acknowledging that the information released by the police was \" inadequet \" and that the \"public could have been told immediately that there had been an attack by a 17-year-old male who was black, British, born in Wales and has lived in the UK all his life.\"",
                              "title": "British Police Told Reveal Ethnicity, Migration Status of Suspects in High-Profile Cases",
                              "url": "https://www.breitbart.com/europe/2025/08/14/british-police-told-reveal-ethnicity-migration-status-of-suspects-in-high-profile-cases/"
                            },
                            {
                              "date": "2024-08-12T00:00:00Z",
                              "snippet": ": atendendo ao apelo de Nigel Farange, o chefe fascista inglês, hordas de hooligans de extrema-direita depredaram albergues para imigrantes e tocaram o terror por uma semana em uma das principais economias do Ocidente. Com efeito, a cena internacional se altera rapidamente.",
                              "title": "Caminhamos bem no Brics, mas o quadro da união na América Latina é desolador – Opinião – CartaCapital",
                              "url": "https://www.cartacapital.com.br/opiniao/caminhamos-bem-no-brics-mas-o-quadro-da-uniao-na-america-latina-e-desolador/?utm_medium=leiamais"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "While Nigel Farage's successor-but-one Paul \"Dr Nutty\" Nuttall protests that he never doctored a CV with an invented university PhD, Ukip's ritzy nonpareil continues to enjoy the high life. My informant spied Farage, the self-appointed people's chief revolter, relaxing in first class on a British Airways flight from New York to Blighty. Drinking three types of champagne doesn't come cheap at £8,00 0 one-way, so either the Brexit elitist is earning big bucks or he has found a sugar daddy.",
                              "title": "Commons Confidential: Money for old Gove",
                              "url": "https://www.newstatesman.com/politics/uk/2016/12/commons-confidential-money-old-gove?page=2&qt-trending=1"
                            },
                            {
                              "date": "2016-02-11T00:00:00Z",
                              "snippet": "Cameron is well aware of this. This week, he was accused of deploying \"Project Fear\" - a tactic utilized by playing on voters' security concerns - by saying that a vote to leave the EU would result in the migrant camp in Calais moving to Dover. These may be baseless claims from the prime minister, but the bloodcurdling warnings about the dangers of leaving the EU, coupled with a weak oppositional campaign, will be enough to scare voters into staying.",
                              "title": "David Cameron's EU Deal Isn't Great - But It's Enough to Secure a Referendum Victory | Huffington Post",
                              "url": "http://www.huffingtonpost.co.uk/sami-quadri/eu-referendum_b_9204882.html"
                            },
                            {
                              "date": "2018-04-15T00:00:00Z",
                              "snippet": ": British MEP and UKIP leader Nigel Farage has been accused of employing both his wife and alleged mistress out of his Parliament allowances Want to contribute?",
                              "title": "EU Tweets of the Week: The Good, the Sad and the Ugly – 14 March 2014",
                              "url": "https://www.european-views.com/2018/04/eu-tweets-of-the-week-the-good-the-sad-and-the-ugly-14-march-2014/"
                            },
                            {
                              "date": "2001-09-11T00:00:00Z",
                              "snippet": "In the meantime, the populist radical rightwing parties have been trying to show a vociferous reaction to these terror attacks by describing them as a direct result of the multicultural policies adopted by various European states. Nigel Paul Farage, leader of the UK Independence Party, has charged Islamist groups as being a fifth column of London's enemies in the country, while Geert Wilders, leader of the Netherlands Freedom Party, has noted that it is time to fight against the Islamization of the country. In Germany, a radical group called PEGIDA, meaning the \"Patriots against the Islamization of the West\", has been organizing mass protests in various cities in Germany in protest to what it calls the Islamization of Europe.",
                              "title": "Europe's radical Right against Muslims",
                              "url": "http://english.irib.ir/radioislam/commentaries/item/205796-europe"
                            },
                            {
                              "date": "0001-01-01T00:00:00Z",
                              "snippet": "Those party leaders that oppose the EU , all seem to be taken to court . We will have to see if Petry , Le Penn , Farage etc , are found guilty , or if not , whether the EU has abused its position to make false allegations . Posted on 10/4/17",
                              "title": "Ex-AfD leader Frauke Petry charged with perjury – POLITICO",
                              "url": "https://www.politico.eu/article/frauke-petry-ex-afd-leader-charged-with-perjury/"
                            },
                            {
                              "date": "2018-02-25T00:00:00Z",
                              "snippet": "WikiLeaks published troves of hacked e-mails last year that damaged Hillary Clinton 's campaign and is suspected of having co-operated with Russia through third parties, according to recent congressional testimony by the former CIA director John Brennan, who also said the adamant denials of collusion by Assange and Russia were disingenuous. Farage has not been accused of wrongdoing and is not a suspect or a target of the US investigation. But being a 'person of interest ' means investigators believe he may have information about the acts that are under investigation and he may therefore be subject to their scrutiny.",
                              "title": "Farage ق€ ̃person of interestق€TM in FBI probe into Trump, Russia",
                              "url": "http://www.gulf-times.com/story/551866/Farage-person-of-interest-in-FBI-probe-into-Trump-Russia"
                            },
                            {
                              "date": "2018-03-16T00:00:00Z",
                              "snippet": "Farage's exploitation of the Charlie Hebdo murders is a new low Farage's exploitation of the Charlie Hebdo murders is a new low Farage 's exploitation of the Charlie Hebdo murders is a new low The Ukip leader's attack on multiculturalism is a demonstration of his malign intent.",
                              "title": "Farage's exploitation of the Charlie Hebdo murders is a new low",
                              "url": "https://www.newstatesman.com/politics/2015/01/farages-exploitation-charlie-hebdo-murders-new-low?qt-trending=1"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "What came through very quickly during the interviews was how little the Leave activists particularly Farage's gang were concerned about the official Remain campaign.",
                              "title": "Huge Egos, Dark Plotting And Deep Suspicion: Welcome To The Brexit Club",
                              "url": "http://www.huffingtonpost.co.uk/owen-bennett/brexit-club_b_12466130.html?utm_hp_ref=uk"
                            },
                            {
                              "date": "2018-03-03T00:00:00Z",
                              "snippet": "Nigel Farage could be passing secret communications to Julian Assange inside the Ecuadorian embassy, a US intelligence expert has speculated, weeks after the MEP was pictured there Roger Stone, a Republican close to Trump, said he has 'back-channel communications' with Assange through an intermediary. Asked if that person was Farage, he denied it Now a senior US intelligence source, speaking to the Observer , has poured fuel on the fire by suggesting that Farage could be a conduit for secret communications. The unnamed source said",
                              "title": "Is Farage acting as a courier for Assange? | Daily Mail Online",
                              "url": "http://www.dailymail.co.uk/news/article-4436828/Is-Farage-acting-courier-Assange.html"
                            },
                            {
                              "date": "2024-08-01T00:00:00Z",
                              "snippet": "No knife attacks or bombings or such like. I remember the NF who were much more extreme and were violent against immigrants and wanted them all out. They were known as criminals but the word terrorist never used, I think it's thrown about too easily these days",
                              "title": "Japan Today",
                              "url": "https://japantoday.com/member/jimizo"
                            },
                            {
                              "date": "2025-10-22T00:00:00Z",
                              "snippet": "Reform's leader in Wales until 2021, Mr Gill admitted eight counts of bribery after making statements in favour of Russia. In his initial statement following Mr Gill's conviction, Mr Farage took a swipe at Ukraine claiming it is \"a country beset by corruption\", while not once criticising Russia. This has seen the party make a humiliating mockup of Mr Farage and Putin as Russian dolls, suggesting Reform's energy plan would see the UK forced to rely on the Kremlin.",
                              "title": "Labour slams Farage over Putin praise: 'What's really inside Reform's energy plan?' - The Mirror",
                              "url": "https://www.mirror.co.uk/news/politics/labour-ramp-up-attacks-nigel-36114108"
                            },
                            {
                              "date": "2025-10-14T00:00:00Z",
                              "snippet": "which Mr Farage described as \"pretty chilling\". Sentencing judge Mrs Justice Steyn told Fayaz Khan she agreed with Nigel Farage that his threats to kill the politician were \"pretty chilling\". Undated handout screengrab taken from a video issued by the Crown Prosecution Service of Fayaz Khan making threats to Nigel Farage.",
                              "title": "Man who threatened to kill Farage in Tiktok post jailed for five years",
                              "url": "https://www.itv.com/news/2025-10-14/man-who-threatened-to-kill-farage-jailed-for-five-years"
                            },
                            {
                              "date": "2025-10-30T00:00:00Z",
                              "snippet": "Crypto sleuth ZachXBT said the \"wallet address belongs to George Cottrell with high confidence.\" \"He's been an adviser to Nigel Farage, is known for high-stakes gambling, and was found guilty of wire fraud,\" he added. During the lead-up to Trump's election win, the wallet named \"GCottrell93\" reportedly bought $9 million of Trump Polymarket shares and won $13 million.",
                              "title": "Nigel Farage Adviser Reportedly Whale Behind Polymarket's Major Trump Bets",
                              "url": "https://www.ccn.com/news/crypto/nigel-farage-adviser-reportedly-whale-behind-polymarkets-major-trump-bets/"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "Nigel Farage says Angela Merkel should \"take responsibility\" for Berlin attack https //t.co/A4LWiJ1oDD pic.twitter.com/lRRpyljtAO On the day of Jo Cox's murder, Farage launched an anti-immigration poster depicting a queue of refugees, with the slogan \"Breaking Point\". It was criticised by other Leave campaigners such as Douglas Carswell and Michael Gove.",
                              "title": "Nigel Farage attacks Jo Cox's widower: \"He would know more about extremists than me\"",
                              "url": "https://www.newstatesman.com/2016/12/nigel-farage-attacks-jo-coxs-widower-he-would-know-more-about-extremists-me?page=3&qt-trending=1"
                            },
                            {
                              "date": "2023-12-11T00:00:00Z",
                              "snippet": "Four other blokes stripped naked.\" Farage, 59, also revealed ITV had messed up with a drinking trial Down Your Sorrows on day seven which he did with Tony Bellew. Farage insisted he had made them change it midway through the challenge because it was too tough and claimed they would never repeat the trial in the way they had to do it because it was dangerous for their health.",
                              "title": "Nigel Farage in furious row with ITV bosses over breaching I'm A Celebrity rules - Mirror Online",
                              "url": "https://www.mirror.co.uk/tv/tv-news/nigel-farage-furious-row-itv-31648505.amp"
                            },
                            {
                              "date": "2025-11-03T00:00:00Z",
                              "snippet": "Manifesto tax cuts 'only ever aspirations' But Mr Farage is also being accused of U-turning on the tax cuts he pledged in Reform UK's 2024 general election manifesto, which was called \"Our Contract With You\". Key measures in the document included raising the minimum threshold of income tax to £20,000, raising the higher rate threshold from £50,271 to £70,000, abolishing stamp duty for properties below £750,000, and abolishing taxes on inheritances below £2m.",
                              "title": "Nigel Farage says Reform UK could cut minimum wage for young people - and defends U-turn on tax pledges",
                              "url": "https://news.sky.com/story/nigel-farage-says-reform-uk-could-cut-minimum-wage-for-young-people-and-defends-u-turn-on-tax-pledges-13463252"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "Others were equally disgusted at the Ukip politician 's comments. Farage was also accused on social media of political point-scoring in the wake of last night 's attack, which police are treating as a \"terror attack \". Some echoed Cox 's sentiments and asked whether Farage should be held to account for the actions \"of those who support your agenda \".",
                              "title": "Nigel Farage's Brendan Cox Comments Spark Outrage In Wake Of Berlin Terror Attack",
                              "url": "http://www.huffingtonpost.co.uk/entry/brendan-cox-takes-down-nigel-farage-over-berlin-terror-tweet_uk_5858f018e4b0acb6e4b8ebc4"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "\"Could I lead Ukip? Yeah, I think I could\" How much longer will Nigel Farage be in charge? His deputy leader, Paul Nuttall, has his eye on the top job.",
                              "title": "Paul Nuttall: 'Could I lead Ukip? Yeah, I think I could'",
                              "url": "https://www.newstatesman.com/politics/2015/01/paul-nuttall-could-i-lead-ukip-yeah-i-think-i-could?page=2&qt-trending=1"
                            },
                            {
                              "date": "2025-09-05T00:00:00Z",
                              "snippet": "The decision to embrace Malhotra is one of several actions by Farage that suggest Reform is heading towards closer policy alignment with Trump and Project 2025. In May 2024, Farage was himself accused by the World Health Organisation (WHO) of \"spreading misinformation\" after becoming the face of Action on World Health (AWH), a campaign for the UK to end its membership of the World Health Organisation (WHO). AWH has received favourable coverage in right-wing newspapers, repeating the narratives of groups associated with coordinated COVID disinformation that has seeped into the mainstream media via outlets like the Telegraph, GB News and TalkTV.",
                              "title": "Reform UK Conference: Anti-Vax Misinformation Doctor Given Prime Health Slot – Byline Times",
                              "url": "https://bylinetimes.com/2025/09/05/reform-conference-aseem-malhotra/"
                            },
                            {
                              "date": "2023-07-19T00:00:00Z",
                              "snippet": "- Referred to NF's controversial profile in public life and politics, reflected in the adverse press outlined in the paper presented. - Despite the adverse press, from a legal perspective NF has not been formally charged of any wrongdoing, and is not subject to any regulatory censure.",
                              "title": "Revealed: The Coutts files on Nigel Farage | The Spectator",
                              "url": "https://www.spectator.co.uk/article/the-coutts-files-on-nigel-farage/"
                            },
                            {
                              "date": "2014-05-27T00:00:00Z",
                              "snippet": "«Son mode de vie me fait peur. Nigel boit et fume beaucoup trop». La prochaine étape pour Nigel Farage est de rendre respectable son parti, très souvent assimilé à la droite extrême en Grande-Bretagne.",
                              "title": "Royaume-Uni - Nigel Farage, le visage des europhobes britanniques",
                              "url": "https://www.parismatch.com/Actu/International/Nigel-Farage-le-visage-des-europhobes-britanniques-566248"
                            },
                            {
                              "date": "2023-07-18T00:00:00Z",
                              "snippet": "\"Team uncovered adverse press. This included various reports that claimed NF incited race hate when he compared the Black Lives Matter (BLM) movement to the Taliban and Islamic extremists in relation to the toppling of the Colston statue in Bristol.\" It also cites adverse press relating to \"appearances on InfoWars (the American conspiracy show run by far-Right pundit Alex Jones) and continued support for Alex Jones\" despite him being ordered to pay $1 billion in damages to the families of the victims of the 2012 Sandy Hook mass shooting for claiming it was faked.",
                              "title": "The dossier that blows apart the Coutts claims about closing Nigel Farage's account",
                              "url": "https://www.telegraph.co.uk/news/2023/07/18/coutts-records-undermine-claim-exiting-farage-not-political/?li_medium=liftigniter-onward-journey&li_source=LI"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "The day before, she and her family had joined the \"Battle of Brexit\" on the Thames . She was known as a refugee campaigner - the morning of her murder, Nigel Farage had already sparked controversy with a \"Breaking Point\" poster featuring a line of refugees. For those who had already been complaining about the hate-fuelled rhetoric, an \"I told you so\" can't be far from their lips.",
                              "title": "The murder of Jo Cox is rallying Remain - but score political points at your peril",
                              "url": "https://www.newstatesman.com/politics/staggers/2016/06/murder-jo-cox-rallying-remain-score-political-points-your-peril?page=2&qt-trending=1"
                            },
                            {
                              "date": "2019-05-21T00:00:00Z",
                              "snippet": "Other anti-EU candidates not associated with the Brexit Party have also been targeted by milkshakes in recent weeks. Farage, a 55-year-old former commodities broker, played an instrumental role in persuading Britain 's mainstream political parties to hold a referendum on leaving the European Union in 2016, and then convincing voters to back Brexit during the subsequent campaign. Britain remains deeply divided over the issue and parliament has been unable to agree when, how or even if the country should leave the bloc.",
                              "title": "Times Online - Daily Online Edition of The Sunday Times Sri Lanka",
                              "url": "http://www.sundaytimes.lk/article/1088665/all-shook-up-brexit-partys-nigel-farage-doused-with-milkshake-on-campaign"
                            },
                            {
                              "date": "2018-03-13T00:00:00Z",
                              "snippet": "And...would Nigel Farage be in charge? Banks and Farage are close friends, and Banks has little enthusiasm for Ukip without Farage in charge. He admires his leadership abilities.",
                              "title": "Will Arron Banks' new party be Ukip 2.0 or a right-wing Momentum?",
                              "url": "https://www.newstatesman.com/politics/staggers/2017/03/will-arron-banks-new-party-be-ukip-20-or-right-wing-momentum?page=3&qt-trending=1"
                            },
                            {
                              "date": "2025-10-10T00:00:00Z",
                              "snippet": "Your Party will put the working class \"back at the heart of politics\", Zarah Sultana said, as she warned fascism is \"growling at the door\". The Independent MP for Coventry South accused Nigel Farage of \"peddling racism\" to distract people from his \"real agenda\". Co-founder Jeremy Corbyn also said the new political party must offer something \"very, very different\" from the \"simplistic appeal\" of the Reform UK leader.",
                              "title": "Your Party will put working class 'back at heart of politics' – Sultana",
                              "url": "https://www.irishnews.com/news/uk/your-party-will-put-working-class-back-at-heart-of-politics-sultana-HW323N42EJJMXF3JTNWXE5UXD4/"
                            },
                            {
                              "date": "2016-06-30T00:00:00Z",
                              "snippet": "La democracia necesita de la participación. Si a alguien un agitador como Nigel Farange o un partido sacudido por la corrupción como el PP le dan miedo, lo puede manifestar en las urnas. Por otra parte, tampoco se ha de pensar que",
                              "title": "¿Un abismo politico entre las generaciones? - Mallorca Zeitung",
                              "url": "http://www.mallorcazeitung.es/meinung/2016/06/30/abismo-politico-generaciones-54170173.html"
                            }
                          ],
                          "associates": [
                            {
                              "association": "parent",
                              "name": "Barbara Stevens"
                            },
                            {
                              "association": "former spouse",
                              "name": "Gráinne Hayes"
                            },
                            {
                              "association": "spouse",
                              "name": "Gráinne Hayes"
                            },
                            {
                              "association": "parent",
                              "name": "Guy Justus Oscar Farage"
                            },
                            {
                              "association": "child",
                              "name": "Isabelle Farage"
                            },
                            {
                              "association": "spouse",
                              "name": "Kirsten Farage"
                            },
                            {
                              "association": "spouse",
                              "name": "Kirsten Mehr"
                            },
                            {
                              "association": "child",
                              "name": "Samuel Farage"
                            },
                            {
                              "association": "child",
                              "name": "Thomas Farage"
                            },
                            {
                              "association": "child",
                              "name": "Victoria Farage"
                            }
                          ]
                        },
                        {
                          "name": "Nigel Farage",
                          "dob": {
                            "main": "1964-04-03",
                            "other": []
                          },
                          "score": 1,
                          "flag_types": [
                            "pep",
                            "pep-class-1"
                          ],
                          "source_notes": {
                            "complyadvantage": {
                              "aml_types": [
                                "pep-class-1"
                              ],
                              "name": "ComplyAdvantage PEP Data"
                            },
                            "united-kingdom-mps-and-lords-rca": {
                              "aml_types": [
                                "pep-class-1"
                              ],
                              "country_codes": [
                                "GB"
                              ],
                              "name": "United Kingdom MPs and Lords RCA"
                            }
                          },
                          "political_positions": [
                            "Member of the National Legislature"
                          ],
                          "countries": [
                            "United Kingdom"
                          ],
                          "aka": [
                            "Nigel Farage"
                          ],
                          "id": "D655PR5UHW408JL",
                          "match_types": [
                            "name_exact",
                            "year_of_birth"
                          ],
                          "fields": [
                            {
                              "name": "Country",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Country Text",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Place of Birth",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "United Kingdom"
                            },
                            {
                              "name": "Original Place of Birth Text",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "Farnborough, Kent, England"
                            },
                            {
                              "name": "Date of Birth",
                              "source": "complyadvantage",
                              "value": "1964-04-03"
                            },
                            {
                              "name": "Political Position",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "Member of the National Legislature"
                            },
                            {
                              "name": "Locationurl",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "https://en.wikipedia.org/wiki/Nigel_Farage"
                            },
                            {
                              "name": "Locationurl",
                              "source": "complyadvantage",
                              "value": "https://en.wikipedia.org/wiki/Nigel_Farage"
                            },
                            {
                              "name": "Locationurl",
                              "source": "united-kingdom-mps-and-lords-rca",
                              "value": "https://simple.wikipedia.org/wiki/Nigel_Farage#Personal_life"
                            },
                            {
                              "name": "Countries",
                              "value": "United Kingdom"
                            }
                          ],
                          "associates": [
                            {
                              "association": "parent",
                              "name": "Barbara Farage"
                            },
                            {
                              "association": "former spouse",
                              "name": "Gráinne Hayes"
                            },
                            {
                              "association": "parent",
                              "name": "Guy Justus Oscar Farage"
                            },
                            {
                              "association": "child",
                              "name": "Isabelle Farage"
                            },
                            {
                              "association": "former spouse",
                              "name": "Kirsten Mehr"
                            },
                            {
                              "association": "partner",
                              "name": "Laure Ferrari"
                            },
                            {
                              "association": "child",
                              "name": "Samuel Farage"
                            },
                            {
                              "association": "child",
                              "name": "Thomas Farage"
                            },
                            {
                              "association": "child",
                              "name": "Victoria Farage"
                            }
                          ]
                        }
                      ]
                    },
                    "data": {
                      "yob": "1964",
                      "name:lite": {
                        "first": "Nigel",
                        "last": "Farage"
                      },
                      "country": "GBR"
                    },
                    "result": "consider",
                    "documents": [
                      "d46awh223amg030rw720"
                    ],
                    "id": "d46atm223amg030rw6yg",
                    "status": "closed",
                    "createdAt": "2025-11-06T14:14:40.874Z"
                  }
                },
                "updatedAt": "2025-11-06T14:14:47.605Z",
                "pdfReady": true,
                "checkType": "lite-screen",
                "completedAt": "2025-11-06T14:14:47.605Z",
                "initiatedAt": "2025-11-06T14:14:36.793Z",
                "considerReasons": [
                  "PEP hits"
                ],
                "pdfS3Key": "protected/ptw6KVD",
                "consumerName": " ",
                "tasks": [
                  "report:screening:lite"
                ],
                "updates": [
                  {
                    "timestamp": "2025-11-06T14:14:36.793Z",
                    "update": "Lite Screen check initiated by jacob.archer-moran@thurstanhoskin.co.uk"
                  },
                  {
                    "timestamp": "2025-11-06T14:14:47.605Z",
                    "update": "Transaction completed - awaiting PDF"
                  },
                  {
                    "timestamp": "2025-11-06T14:19:01.253Z",
                    "update": "PDF received and uploaded to S3 - CONSIDER: PEP hits"
                  },
                  {
                    "timestamp": "2025-11-06T14:19:22.647Z",
                    "update": "PDF received and uploaded to S3 - CONSIDER: PEP hits"
                  }
                ],
                "status": "closed",
                "initiatedBy": "jacob.archer-moran@thurstanhoskin.co.uk",
                "piiData": {
                  "name": {},
                  "address": {},
                  "document": {}
                },
                "thirdfortResponse": {
                  "name": "Nigel Farage - Lite Screening",
                  "request": {
                    "tasks": [
                      {
                        "opts": {
                          "monitored": false
                        },
                        "type": "report:screening:lite"
                      }
                    ]
                  },
                  "ref": "Lite Screening Check",
                  "id": "d46atjj23amg030rw6x0",
                  "reports": [],
                  "status": "open",
                  "metadata": {
                    "notify": {
                      "type": "http",
                      "data": {
                        "hmac_key": "9YHj0N6aqWq3ealMttvU5hNycILlzz8zLEC3GvHBwNA=",
                        "method": "POST",
                        "uri": "https://www.thurstanhoskin.co.uk/_functions-dev/thirdfortWebhook"
                      }
                    },
                    "created_by": "d3t2m5q9io6g00ak3kmg",
                    "print": {
                      "team": "Cashiers",
                      "tenant": "Thurstan Hoskin Solicitors LLP",
                      "user": "Jacob Archer-Moran"
                    },
                    "context": {
                      "gid": "d3t2k5a9io6g00ak3km0",
                      "uid": "d3t2m5q9io6g00ak3kmg",
                      "team_id": "d3t2k5a9io6g00ak3km0",
                      "tenant_id": "d3t2ifa9io6g00ak3klg"
                    },
                    "ce": {
                      "uri": "/v1/checks/4151797870"
                    },
                    "created_at": "2025-11-06T14:14:33.622Z"
                  },
                  "type": "v2",
                  "opts": {
                    "screening": {
                      "monitored": false
                    }
                  }
                },
                "expectations": {
                  "name:lite": {
                    "data": {
                      "first": "Nigel",
                      "last": "Farage"
                    }
                  },
                  "yob": {
                    "data": "1964"
                  },
                  "country": {
                    "data": "GBR"
                  }
                },
                "hasAlerts": true,
                "pdfAddedAt": "2025-11-06T14:19:22.647Z",
                "transactionId": "d46atjj23amg030rw6x0"
            }
        ];
    }
    
    // ===================================================================
    // ANNOTATION OVERLAYS
    // ===================================================================
    
    /**
     * Render annotations for a specific task
     */
    renderTaskAnnotations(taskType, check) {
        const annotations = check.considerAnnotations || [];
        const sofNotes = check.sofAnnotations || [];
        const pepDismissals = check.pepDismissals || [];
        
        // Filter annotations for this task
        const taskAnnotations = annotations.filter(ann => ann.taskType === taskType);
        
        // Check for SoF notes if this is an SoF task
        const isSofTask = taskType === 'sof:v1';
        
        // Check for PEP dismissals if this is a screening task
        const isPepTask = taskType === 'screening' || taskType === 'peps' || taskType === 'screening:lite';
        
        if (taskAnnotations.length === 0 && (!isSofTask || sofNotes.length === 0) && (!isPepTask || pepDismissals.length === 0)) {
            return '';
        }
        
        let html = '<div class="task-annotations-section">';
        
        // Show consider annotations
        if (taskAnnotations.length > 0) {
            html += '<div class="task-annotations-header">User Annotations</div>';
            taskAnnotations.forEach(ann => {
                const date = new Date(ann.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                html += '<div class="task-annotation-card ' + ann.newStatus + '">';
                html += '<div class="task-annotation-header">';
                html += '<span class="status-badge ' + ann.originalStatus + '">' + ann.originalStatus.toUpperCase() + '</span>';
                html += '<span class="arrow">→</span>';
                html += '<span class="status-badge ' + ann.newStatus + '">' + ann.newStatus.toUpperCase() + '</span>';
                html += '</div>';
                html += '<div class="task-annotation-body">';
                html += '<p class="annotation-objective-path">' + this.formatObjectivePath(ann.objectivePath) + '</p>';
                html += '<p class="annotation-reason">' + ann.reason + '</p>';
                html += '<p class="annotation-meta">' + (ann.userName || ann.user) + ' • ' + date + '</p>';
                html += '</div></div>';
            });
        }
        
        // Show SoF notes
        if (isSofTask && sofNotes.length > 0) {
            html += '<div class="task-annotations-header">Investigation Notes</div>';
            sofNotes.forEach(note => {
                const date = new Date(note.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                const label = note.category === 'funding' ? note.fundingMethod : note.redFlagType;
                html += '<div class="task-annotation-card sof-note">';
                html += '<div class="task-annotation-header">';
                html += '<strong>' + label + '</strong>';
                html += '</div>';
                html += '<div class="task-annotation-body">';
                html += '<p class="annotation-reason">' + note.note + '</p>';
                html += '<p class="annotation-meta">' + (note.userName || note.user) + ' • ' + date + '</p>';
                html += '</div></div>';
            });
        }
        
        // Show PEP dismissals
        if (isPepTask && pepDismissals.length > 0) {
            html += '<div class="task-annotations-header">Dismissed Hits</div>';
            pepDismissals.forEach(dismissal => {
                const date = new Date(dismissal.timestamp).toLocaleString('en-GB', { 
                    day: '2-digit', 
                    month: 'short', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                html += '<div class="task-annotation-card dismissed">';
                html += '<div class="task-annotation-header">';
                html += '<span class="hit-type-badge ' + dismissal.reportType + '">' + dismissal.reportType.toUpperCase() + '</span>';
                html += '<strong>' + dismissal.hitName + '</strong>';
                html += '</div>';
                html += '<div class="task-annotation-body">';
                html += '<p class="annotation-reason">' + dismissal.reason + '</p>';
                html += '<p class="annotation-meta">Dismissed by ' + (dismissal.userName || dismissal.user) + ' • ' + date + '</p>';
                html += '</div></div>';
            });
        }
        
        html += '</div>';
        
        return html;
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
            
            if (!hasNested && (outcome.result === 'consider' || outcome.result === 'fail')) {
                items.push({
                    taskType,
                    path: taskType,
                    label: this.getTaskTitle(taskType),
                    status: outcome.result,
                    level: 0,
                    reasonText
                });
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
        
        // If we end up with nothing, use the last part of original
        if (filteredParts.length === 0) {
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
     */
    hasPepSanctionsHits(check) {
        if (check.status !== 'closed') return false;
        const outcomes = check.taskOutcomes || {};
        const peps = outcomes['peps'] || outcomes['screening:lite'];
        const sanctions = outcomes['sanctions'];
        
        const pepHits = peps?.breakdown?.total_hits || 0;
        const sanctionHits = sanctions?.breakdown?.total_hits || 0;
        
        return (pepHits + sanctionHits) > 0;
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
        
        // Header with SAVE button
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Update Task Outcomes</h2>';
        overlayHTML += '<div class="header-actions">';
        if (this.mode === 'edit') {
            overlayHTML += '<button class="btn-primary-small" onclick="manager.savePendingUpdates()" id="saveAllBtn" disabled>SAVE</button>';
        }
        overlayHTML += '<button class="overlay-close-btn" onclick="manager.closeConsiderOverlay()">✕</button>';
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
        
        // Show existing annotations from database
        if (existingAnnotations.length > 0) {
            overlayHTML += '<div class="annotation-history-section">';
            overlayHTML += '<h3>Previous Updates</h3>';
            
            existingAnnotations.forEach(ann => {
                const date = new Date(ann.timestamp).toLocaleString('en-GB');
                overlayHTML += `<div class="annotation-card ${ann.newStatus}">`;
                overlayHTML += '<div class="annotation-card-header">';
                overlayHTML += `<span class="annotation-objective">${this.formatObjectivePath(ann.objectivePath)}</span>`;
                overlayHTML += `<span class="annotation-date">${date}</span>`;
                overlayHTML += '</div>';
                overlayHTML += '<div class="annotation-card-body">';
                overlayHTML += '<div class="status-change">';
                overlayHTML += `<span class="status-badge ${ann.originalStatus}">${ann.originalStatus.toUpperCase()}</span>`;
                overlayHTML += '<span class="arrow">→</span>';
                overlayHTML += `<span class="status-badge ${ann.newStatus}">${ann.newStatus.toUpperCase()}</span>`;
                overlayHTML += '</div>';
                overlayHTML += `<p class="annotation-reason">${ann.reason}</p>`;
                overlayHTML += `<p class="annotation-user">By: ${ann.userName || ann.user}</p>`;
                overlayHTML += '</div></div>';
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
        
        // Send to parent
        this.sendMessage('save-consider-annotations', {
            checkId: check.checkId || check.transactionId,
            annotations
        });
        
        // Clear pending updates
        this.pendingUpdates = [];
        
        this.closeConsiderOverlay();
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
        const existingNotes = check.sofAnnotations || [];
        
        // Extract funding methods
        const fundingMethods = [];
        if (sofTask?.data?.funds) {
            sofTask.data.funds.forEach(fund => {
                fundingMethods.push({
                    type: fund.type || fund.fund_type,
                    amount: fund.amount,
                    description: fund.description
                });
            });
        }
        
        // Extract red flags
        const redFlags = [];
        if (bankSummary?.breakdown?.red_flags) {
            bankSummary.breakdown.red_flags.forEach(flag => {
                redFlags.push({ source: 'bank:summary', text: flag });
            });
        }
        if (bankStatement?.breakdown?.red_flags) {
            bankStatement.breakdown.red_flags.forEach(flag => {
                redFlags.push({ source: 'bank:statement', text: flag });
            });
        }
        
        let overlayHTML = `
            <div class="annotation-overlay" id="sofOverlay">
                <div class="annotation-overlay-backdrop" onclick="manager.closeSofOverlay()"></div>
                <div class="annotation-overlay-content">
                    <div class="annotation-overlay-header">
                        <h2>Source of Funds Investigation</h2>
                        <button class="overlay-close-btn" onclick="manager.closeSofOverlay()">✕</button>
                    </div>
                    
                    <div class="annotation-overlay-body">
                        <form id="sofAnnotationForm">
        `;
        
        // Funding methods section
        if (fundingMethods.length > 0) {
            overlayHTML += `
                            <div class="annotation-section">
                                <h3>Funding Methods</h3>
            `;
            
            fundingMethods.forEach((fund, idx) => {
                overlayHTML += `
                                <div class="sof-item">
                                    <h4>${fund.type ? fund.type.replace('fund:', '').replace(/_/g, ' ').toUpperCase() : 'Unknown'}</h4>
                                    ${fund.amount ? `<p>Amount: £${fund.amount.toLocaleString()}</p>` : ''}
                                    ${fund.description ? `<p>${fund.description}</p>` : ''}
                                    <div class="form-group">
                                        <label for="sofNote${idx}">Investigation Notes</label>
                                        <textarea id="sofNote${idx}" data-category="funding" data-method="${fund.type}" 
                                            rows="3" placeholder="Add investigation notes for this funding source..."></textarea>
                                    </div>
                                </div>
                `;
            });
            
            overlayHTML += `</div>`;
        }
        
        // Red flags section
        if (redFlags.length > 0) {
            overlayHTML += `
                            <div class="annotation-section">
                                <h3>Red Flags</h3>
            `;
            
            redFlags.forEach((flag, idx) => {
                overlayHTML += `
                                <div class="sof-item red-flag">
                                    <h4>⚠ ${flag.text}</h4>
                                    <p class="text-muted">Source: ${flag.source}</p>
                                    <div class="form-group">
                                        <label for="flagNote${idx}">Investigation Notes</label>
                                        <textarea id="flagNote${idx}" data-category="redFlag" data-flag="${flag.text}" 
                                            rows="3" placeholder="Add investigation notes for this red flag..."></textarea>
                                    </div>
                                </div>
                `;
            });
            
            overlayHTML += `</div>`;
        }
        
        overlayHTML += `
                            <div class="annotation-actions">
                                <button type="button" class="btn-secondary" onclick="manager.closeSofOverlay()">Close</button>
                                <button type="button" class="btn-secondary" onclick="manager.generateSofPDF()">Generate PDF</button>
                                <button type="submit" class="btn-primary">Save Notes</button>
                            </div>
                        </form>
        `;
        
        // Show existing notes
        if (existingNotes.length > 0) {
            overlayHTML += `
                        <div class="annotation-section annotation-history">
                            <h3>Previous Notes</h3>
            `;
            
            existingNotes.forEach(note => {
                const date = new Date(note.timestamp).toLocaleString('en-GB');
                overlayHTML += `
                    <div class="annotation-card sof-note">
                        <div class="annotation-card-header">
                            <span class="annotation-objective">${note.category === 'funding' ? note.fundingMethod : note.redFlagType}</span>
                            <span class="annotation-date">${date}</span>
                        </div>
                        <div class="annotation-card-body">
                            <p class="annotation-reason">${note.note}</p>
                            <p class="annotation-user">By: ${note.userName || note.user}</p>
                        </div>
                    </div>
                `;
            });
            
            overlayHTML += `</div>`;
        }
        
        overlayHTML += `
                    </div>
                </div>
            </div>
        `;
        
        // Add to DOM
        document.body.insertAdjacentHTML('beforeend', overlayHTML);
        
        // Add form submit handler
        const form = document.getElementById('sofAnnotationForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSofAnnotations(check);
        });
    }
    
    closeSofOverlay() {
        const overlay = document.getElementById('sofOverlay');
        if (overlay) overlay.remove();
    }
    
    /**
     * Save SoF annotations
     */
    saveSofAnnotations(check) {
        const form = document.getElementById('sofAnnotationForm');
        const textareas = form.querySelectorAll('textarea');
        
        const notes = [];
        textareas.forEach(textarea => {
            const note = textarea.value.trim();
            if (note) {
                notes.push({
                    category: textarea.dataset.category,
                    fundingMethod: textarea.dataset.method,
                    redFlagType: textarea.dataset.flag,
                    note,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        if (notes.length === 0) {
            alert('Please add at least one note');
            return;
        }
        
        // Send to parent
        this.sendMessage('save-sof-annotations', {
            checkId: check.checkId || check.transactionId,
            notes
        });
        
        this.closeSofOverlay();
    }
    
    /**
     * Render PEP Dismissal Overlay with queue system
     */
    renderPepDismissalOverlay(check) {
        const outcomes = check.taskOutcomes || {};
        const pepsTask = outcomes['peps'] || outcomes['screening:lite'];
        const sanctionsTask = outcomes['sanctions'];
        const existingDismissals = check.pepDismissals || [];
        
        // Initialize pending dismissals array
        if (!this.pendingDismissals) {
            this.pendingDismissals = [];
        }
        
        const dismissedIds = new Set(existingDismissals.map(d => d.hitId));
        
        // Also exclude hits in pending dismissals
        this.pendingDismissals.forEach(dismissal => {
            dismissal.hitIds.forEach(id => dismissedIds.add(id));
        });
        
        // Collect all undismissed hits with full details
        const hits = [];
        
        if (pepsTask?.breakdown?.hits) {
            pepsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'peps',
                        reportId: pepsTask.id,
                        dob: hit.dob?.main || hit.dob,
                        score: hit.score,
                        flagTypes: hit.flag_types || [],
                        politicalPositions: hit.political_positions || [],
                        countries: hit.countries || [],
                        aka: hit.aka || [],
                        fullHit: hit  // Keep full object for detailed display
                    });
                }
            });
        }
        
        if (sanctionsTask?.breakdown?.hits) {
            sanctionsTask.breakdown.hits.forEach(hit => {
                if (!dismissedIds.has(hit.id)) {
                    hits.push({
                        id: hit.id,
                        name: hit.name,
                        type: 'sanctions',
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
        
        let overlayHTML = '<div class="annotation-overlay" id="pepOverlay">';
        overlayHTML += '<div class="annotation-overlay-backdrop" onclick="manager.closePepOverlay()"></div>';
        overlayHTML += '<div class="annotation-overlay-content">';
        
        // Header with SAVE button
        overlayHTML += '<div class="annotation-overlay-header">';
        overlayHTML += '<h2>Dismiss PEP & Sanctions Hits</h2>';
        overlayHTML += '<div class="header-actions">';
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
            
            existingDismissals.forEach(dismissal => {
                const date = new Date(dismissal.timestamp).toLocaleString('en-GB');
                overlayHTML += '<div class="annotation-card dismissed-hit">';
                overlayHTML += '<div class="annotation-card-header">';
                overlayHTML += '<span class="annotation-objective">' + dismissal.hitName + '</span>';
                overlayHTML += '<span class="hit-type-badge ' + dismissal.reportType + '">' + dismissal.reportType.toUpperCase() + '</span>';
                overlayHTML += '<span class="annotation-date">' + date + '</span>';
                overlayHTML += '</div>';
                overlayHTML += '<div class="annotation-card-body">';
                overlayHTML += '<p class="annotation-reason">' + dismissal.reason + '</p>';
                overlayHTML += '<p class="annotation-user">Dismissed by: ' + (dismissal.userName || dismissal.user) + '</p>';
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
     * Create a PEP hit card for selection (like screening hit card)
     */
    createPepHitCard(hit) {
        let html = '<label class="pep-hit-card">';
        html += '<input type="checkbox" name="hits" value="' + hit.id + '" ';
        html += 'data-name="' + hit.name + '" ';
        html += 'data-type="' + hit.type + '" ';
        html += 'data-report-id="' + hit.reportId + '">';
        
        html += '<div class="hit-card-content">';
        html += '<div class="hit-card-header">';
        html += '<strong class="hit-name">' + hit.name + '</strong>';
        html += '<span class="hit-type-badge ' + hit.type + '">' + hit.type.toUpperCase() + '</span>';
        html += '</div>';
        
        // Hit details
        if (hit.dob) {
            html += '<div class="hit-info-line">DOB: ' + hit.dob + '</div>';
        }
        if (hit.score) {
            html += '<div class="hit-info-line">Match Score: ' + hit.score + '</div>';
        }
        if (hit.politicalPositions && hit.politicalPositions.length > 0) {
            html += '<div class="hit-info-line">Positions: ' + hit.politicalPositions.slice(0, 2).join(', ') + '</div>';
        }
        if (hit.countries && hit.countries.length > 0) {
            html += '<div class="hit-info-line">Countries: ' + hit.countries.slice(0, 3).join(', ') + '</div>';
        }
        if (hit.flagTypes && hit.flagTypes.length > 0) {
            const flagTypeText = hit.flagTypes.slice(0, 3).map(f => f.replace('adverse-media-', '').replace(/-/g, ' ')).join(', ');
            html += '<div class="hit-info-line hit-flags">' + flagTypeText + '</div>';
        }
        
        html += '</div></label>';
        
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
        
        // Create dismissal object
        const dismissal = {
            id: Date.now(),
            hitIds: selectedHits.map(cb => cb.value),
            hitNames: selectedHits.map(cb => cb.dataset.name),
            hitTypes: selectedHits.map(cb => cb.dataset.type),
            reportId: selectedHits[0].dataset.reportId,
            reportType: selectedHits[0].dataset.type,
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
            queueHTML += '<span>Dismissing ' + dismissal.hitIds.length + ' hit' + (dismissal.hitIds.length > 1 ? 's' : '') + '</span>';
            queueHTML += '<button class="remove-update-btn" onclick="manager.removeDismissalFromQueue(' + dismissal.id + ')" title="Remove from queue">';
            queueHTML += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">';
            queueHTML += '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
            queueHTML += '</svg></button>';
            queueHTML += '</div>';
            queueHTML += '<div class="dismissal-body">';
            queueHTML += '<p class="dismissal-reason">' + dismissal.reason + '</p>';
            queueHTML += '<div class="dismissed-hits-list">';
            dismissal.hitNames.forEach((name, idx) => {
                queueHTML += '<span class="dismissed-hit-name">• ' + name + '</span>';
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
        
        // Process each dismissal batch
        this.pendingDismissals.forEach(dismissal => {
            // Build dismissals array for Thirdfort API
            const dismissals = dismissal.hitIds.map(id => ({
                id,
                reason: dismissal.reason
            }));
            
            // Send to parent
            this.sendMessage('dismiss-pep-hits', {
                checkId: check.checkId || check.transactionId,
                transactionId: check.transactionId,
                reportId: dismissal.reportId,
                reportType: dismissal.reportType,
                dismissals
            });
        });
        
        // Clear pending dismissals
        this.pendingDismissals = [];
        
        this.closePepOverlay();
    }
    
    closePepOverlay(clearQueue = true) {
        const overlay = document.getElementById('pepOverlay');
        if (overlay) overlay.remove();
        // Clear pending dismissals when closing (unless we're just re-rendering)
        if (clearQueue) {
            this.pendingDismissals = [];
        }
    }
    
    // ===================================================================
    // PDF GENERATION
    // ===================================================================
    
    generateConsiderPDF() {
        const check = this.currentCheck;
        if (!check) return;
        
        const annotations = check.considerAnnotations || [];
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.transactionId || check.checkId;
        
        let htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #112F5B;">Consider & Fail Annotations</h1>
                <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                    <p><strong>Check:</strong> ${checkName}</p>
                    <p><strong>Reference:</strong> ${checkRef}</p>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #112F5B; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Objective</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Original</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Updated</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Reason</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">User</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        annotations.forEach(ann => {
            const date = new Date(ann.timestamp).toLocaleDateString('en-GB');
            htmlContent += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${this.formatObjectivePath(ann.objectivePath)}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${ann.originalStatus.toUpperCase()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${ann.newStatus.toUpperCase()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${ann.reason}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${ann.userName || ann.user}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                    </tbody>
                </table>
            </div>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: 10,
            filename: `consider-annotations-${checkRef}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save();
        } else {
            alert('PDF library not loaded. Please refresh the page.');
        }
    }
    
    generateSofPDF() {
        const check = this.currentCheck;
        if (!check) return;
        
        const notes = check.sofAnnotations || [];
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.transactionId || check.checkId;
        
        let htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #112F5B;">Source of Funds Investigation</h1>
                <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                    <p><strong>Check:</strong> ${checkName}</p>
                    <p><strong>Reference:</strong> ${checkRef}</p>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #112F5B; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Type</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Item</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Notes</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">User</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        notes.forEach(note => {
            const date = new Date(note.timestamp).toLocaleDateString('en-GB');
            const item = note.category === 'funding' ? note.fundingMethod : note.redFlagType;
            htmlContent += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${note.category.toUpperCase()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${item}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${note.note}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${note.userName || note.user}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                    </tbody>
                </table>
            </div>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: 10,
            filename: `sof-investigation-${checkRef}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save();
        } else {
            alert('PDF library not loaded. Please refresh the page.');
        }
    }
    
    generatePepPDF() {
        const check = this.currentCheck;
        if (!check) return;
        
        const dismissals = check.pepDismissals || [];
        const checkName = check.consumerName || check.companyName || 'Unknown';
        const checkRef = check.transactionId || check.checkId;
        
        let htmlContent = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h1 style="color: #112F5B;">PEP & Sanctions Dismissals</h1>
                <div style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                    <p><strong>Check:</strong> ${checkName}</p>
                    <p><strong>Reference:</strong> ${checkRef}</p>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString('en-GB')}</p>
                </div>
                
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead>
                        <tr style="background: #112F5B; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Hit Name</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Type</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Reason</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Dismissed By</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        dismissals.forEach(dismissal => {
            const date = new Date(dismissal.timestamp).toLocaleDateString('en-GB');
            htmlContent += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${dismissal.hitName}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${dismissal.reportType.toUpperCase()}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${dismissal.reason}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${dismissal.userName || dismissal.user}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${date}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                    </tbody>
                </table>
            </div>
        `;
        
        const element = document.createElement('div');
        element.innerHTML = htmlContent;
        
        const opt = {
            margin: 10,
            filename: `pep-dismissals-${checkRef}-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        if (typeof html2pdf !== 'undefined') {
            html2pdf().set(opt).from(element).save();
        } else {
            alert('PDF library not loaded. Please refresh the page.');
        }
    }
}


let manager;

document.addEventListener('DOMContentLoaded', () => {
    manager = new ThirdfortChecksManager();
    window.manager = manager; // Make accessible globally for inline onclick handlers
    window.thirdfortManager = manager; // Keep for backwards compatibility
});

