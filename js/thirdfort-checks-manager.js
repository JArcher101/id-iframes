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
        this.pepUpdatesCard = document.getElementById('pep-updates-card');
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
    
    handleMessage(event) {
        const { type, data } = event.data;
        
        console.log('📨 Message received:', type, data);
        
        switch (type) {
            case 'checks-data':
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
        
        // Reset current check and view state when new data loads
        this.currentCheck = null;
        this.currentView = 'loading';
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
    
    showListView() {
        this.currentView = 'list';
        this.loadingState.classList.add('hidden');
        this.listView.classList.remove('hidden');
        this.detailView.classList.add('hidden');
    }
    
    showDetailView(check) {
        this.currentCheck = check;
        this.currentView = 'detail';
        this.listView.classList.add('hidden');
        this.detailView.classList.remove('hidden');
        this.renderDetailView(check);
    }
    
    showEmptyState() {
        this.currentView = 'empty';
        this.loadingState.classList.add('hidden');
        this.listView.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">No Thirdfort checks found</div>';
        this.listView.classList.remove('hidden');
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
        
        // CLEAR/CONSIDER tag (only if closed)
        if (check.status === 'closed') {
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
        
        // Render PEP/Sanctions updates (if any)
        this.renderPepUpdatesCard(check);
        
        // Render tasks/reports
        this.renderTasksSection(check);
        
        // Render updates/audit trail
        this.renderUpdatesSection(check);
    }
    
    renderTopActionButtons(check) {
        const actionButtonsContainer = document.querySelector('.detail-action-buttons');
        if (!actionButtonsContainer) return;
        
        let buttons = '';
        
        // View Report button (if PDF available)
        if (check.pdfReady && check.pdfS3Key) {
            buttons += `
                <button class="top-action-btn" onclick="manager.viewPDF('${check.pdfS3Key}')" title="View PDF Report">
                    <svg viewBox="0 0 24 24" fill="#1d71b8">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    </svg>
                </button>
            `;
        }
        
        // Expand button (always show)
        const env = 'sandbox';
        const baseUrl = env === 'production' ? 'https://app.thirdfort.io' : 'https://sandbox.thirdfort.io';
        const thirdfortUrl = check.transactionId 
            ? `${baseUrl}/transactions/${check.transactionId}`
            : `${baseUrl}/checks/${check.checkId}`;
        
        buttons += `
            <button class="top-action-btn" onclick="window.open('${thirdfortUrl}', '_blank', 'width=1200,height=800')" title="View in Thirdfort Portal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d71b8" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                </svg>
            </button>
        `;
        
        actionButtonsContainer.innerHTML = buttons;
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
            statusTag = check.hasAlerts 
                ? '<span class="status-tag consider">CONSIDER</span>' 
                : '<span class="status-tag clear">CLEAR</span>';
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
        // Hide for IDV (no monitoring option)
        if (check.checkType === 'idv') {
            this.monitoringCard.classList.add('hidden');
            return;
        }
        
        const hasMonitoring = check.hasMonitoring === true;
        const canToggle = (check.checkType === 'electronic-id' || check.checkType === 'lite-screen') 
                          && check.status !== 'aborted';
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
        // Only show abort for:
        // 1. Status is open or processing
        // 2. It's a v2 transaction (ID starts with 'c')
        // v1 checks (IDV, etc.) and v2 checks (KYB) cannot be aborted via API
        const isOpenStatus = check.status === 'open' || check.status === 'processing';
        
        // Check both transactionId and checkId fields (either could be used)
        const checkId = check.transactionId || check.checkId;
        const isV2Transaction = checkId && checkId.startsWith('c');
        
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
            const name = check.consumerName || (piiData.name ? `${piiData.name.first || ''} ${piiData.name.last || ''}`.trim() : '—');
            const dob = piiData.dob ? new Date(piiData.dob).toLocaleDateString('en-GB') : '—';
            const mobile = check.consumerPhone || check.thirdfortResponse?.request?.actor?.phone || '—';
            const email = check.consumerEmail || check.thirdfortResponse?.request?.actor?.email || '—';
            
            const address = piiData.address || {};
            const fullAddress = [
                address.line1,
                address.line2,
                address.town,
                address.postcode,
                address.country
            ].filter(Boolean).join(', ') || '—';
            
            const docInfo = check.taskOutcomes?.['document']?.data || {};
            const docNumber = docInfo.number || piiData.document?.number || '—';
            const mrz = piiData.document?.mrz_line1 && piiData.document?.mrz_line2
                ? `${piiData.document.mrz_line1}\n${piiData.document.mrz_line2}`
                : '';
            
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
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Date of Birth</div>
                        <div class="detail-value">${dob}</div>
                    </div>
                `);
            }
            
            if (mobile && mobile !== '—') {
                gridItems.push(`
                    <div class="detail-item">
                        <div class="detail-label">Mobile</div>
                        <div class="detail-value">${mobile}</div>
                    </div>
                `);
            }
            
            if (email && email !== '—') {
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
                ${fullAddress && fullAddress !== '—' ? `
                <div class="detail-item" style="margin-top: 12px;">
                    <div class="detail-label">Address</div>
                    <div class="detail-value">${fullAddress}</div>
                </div>
                ` : ''}
                ${docNumber !== '—' || mrz ? `
                <div class="detail-item" style="margin-top: 12px;">
                    <div class="detail-label">Document Details</div>
                    <div class="detail-value">${docNumber}</div>
                    ${mrz ? `<div class="detail-value" style="font-size: 11px; font-family: monospace; margin-top: 4px; white-space: pre;">${mrz}</div>` : ''}
                </div>
                ` : ''}
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
    
    renderTasksSection(check) {
        const taskOutcomes = check.taskOutcomes || {};
        
        if (Object.keys(taskOutcomes).length === 0) {
            this.tasksSection.innerHTML = '';
            return;
        }
        
        let tasksHtml = '';
        
        // Define task order
        const taskOrder = [
            'address', 'footprint', 'peps', 'sanctions',
            'identity', 'nfc', 'liveness', 'facial_similarity', 'document',
            'sof:v1', 'bank:statement', 'bank:summary',
            'documents:poa', 'documents:poo', 'documents:other',
            'company:summary', 'company:sanctions', 'company:peps', 
            'company:ubo', 'company:beneficial-check', 'company:shareholders'
        ];
        
        taskOrder.forEach(taskKey => {
            if (taskOutcomes[taskKey]) {
                tasksHtml += this.createTaskCard(taskKey, taskOutcomes[taskKey]);
            }
        });
        
        this.tasksSection.innerHTML = tasksHtml;
    }
    
    createTaskCard(taskType, outcome) {
        const result = outcome.result || 'unknown';
        const status = outcome.status || '';
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
        const taskChecks = this.getTaskChecks(taskType, outcome);
        
        // Document tasks (PoA, PoO) - Non-expandable, just status text
        const isDocumentTask = taskType === 'documents:poa' || taskType === 'documents:poo' || taskType === 'documents:other';
        
        if (isDocumentTask) {
            const docCount = outcome.data?.document_count || 0;
            const isSkipped = result === 'skipped' || result === 'consider';
            const summaryText = isSkipped ? 'Task skipped' : `${docCount} document${docCount !== 1 ? 's' : ''} uploaded`;
            
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
        
        // Standard expandable task card
        let taskSummary = outcome.result ? this.formatResult(outcome.result) : 'Pending';
        
        // Add status information for unobtainable tasks
        if (outcome.status === 'unobtainable') {
            taskSummary = `<span style="color: #f7931e;">Unobtainable</span> - Some information may still be available`;
        }
        
        let checksHtml = '';
        if (taskChecks.length > 0) {
            checksHtml = '<div class="task-checks-grid">';
            taskChecks.forEach((check, index) => {
                // Handle person profile cards - NO ICONS
                if (check.isPersonCard === true && check.personData) {
                    console.log(`Rendering person card ${index}:`, check.personData.name || check.personData.fullName);
                    checksHtml += this.createPersonProfileCard(check.personData);
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
        
        // Show inline status for unobtainable
        const inlineStatus = outcome.status === 'unobtainable' 
            ? '<div class="task-summary-inline">Unobtainable - Some information may still be available</div>' 
            : '';
        
        return `
            <div class="task-card ${borderClass}" onclick="this.classList.toggle('expanded')">
                <div class="task-header">
                    <div class="task-title">${taskTitle}</div>
                    ${statusIcon}
                </div>
                ${inlineStatus}
                ${outcome.status === 'closed' || outcome.status === 'unobtainable' ? `
                <div class="task-details">
                    ${outcome.status !== 'unobtainable' ? `<div class="task-summary">${taskSummary}</div>` : ''}
                    ${checksHtml}
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
            return this.isEnhancedID(check) ? 'Enhanced ID Check' : 'Original ID Check';
        }
        
        return labels[check.checkType] || 'Thirdfort Check';
    }
    
    isEnhancedID(check) {
        if (check.checkType !== 'electronic-id') return false;
        
        const nfcReport = check.taskOutcomes?.['nfc'];
        return nfcReport && nfcReport.status !== 'unobtainable';
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
    
    getTaskCheckIcon(status) {
        // Return colored circle icons for task objectives
        if (status === 'CL') {
            // Green circle with checkmark
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="#39b549" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m123.03 224.25-62.17-62.17 21.22-21.21 40.95 40.95 95.46-95.46 21.21 21.21z"/></svg>`;
        } else if (status === 'CO' || status === 'CN') {
            // Orange circle with minus
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="#f7931e" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="M67.36 135.15h165v30h-165z"/></svg>`;
        } else if (status === 'AL' || status === 'FA') {
            // Red circle with X
            return `<svg class="objective-icon" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 150c0 82.843-67.157 150-150 150S0 232.843 0 150 67.157 0 150 0s150 67.157 150 150"/><path fill="#ffffff" d="m102.122 81.21 116.673 116.672-21.213 21.213L80.909 102.423z"/><path fill="#ffffff" d="M218.086 102.417 101.413 219.09 80.2 197.877 196.873 81.204z"/></svg>`;
        }
        return '';
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
            'peps': 'PEP Screening',
            'sanctions': 'Sanctions Screening',
            'identity': 'Identity Verification',
            'nfc': 'NFC Chip Verification',
            'liveness': 'Liveness Check',
            'facial_similarity': 'Facial Similarity',
            'document': 'Document Authenticity',
            'sof:v1': 'Source of Funds Questionnaire',
            'bank:statement': 'Bank Statement Analysis',
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
    
    getTaskChecks(taskType, outcome) {
        const checks = [];
        const data = outcome.data || {};
        
        // Task-specific checks based on type
        if (taskType === 'address') {
            // Address objectives: sources and quality
            if (data.sources !== undefined) {
                checks.push({
                    status: data.sources >= 2 ? 'CL' : 'CO',
                    text: `${data.sources} Address source${data.sources !== 1 ? 's' : ''}`
                });
            }
            
            if (data.quality !== undefined) {
                checks.push({
                    status: data.quality >= 80 ? 'CL' : 'CO',
                    text: `Address Quality at ${data.quality}%`
                });
            }
            
            if (data.mortality_hit !== undefined) {
                checks.push({
                    status: data.mortality_hit ? 'AL' : 'CL',
                    text: data.mortality_hit ? 'Mortality hit detected' : 'No mortality hits'
                });
            }
        } 
        else if (taskType === 'document') {
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
            // NFC chip verification
            if (data.chip_read !== undefined) {
                checks.push({
                    status: data.chip_read ? 'CL' : 'AL',
                    text: data.chip_read ? 'NFC chip successfully read' : 'Could not read NFC chip'
                });
            }
        }
        else if (taskType === 'identity') {
            // Identity verification (overall check)
            if (data.verified !== undefined) {
                checks.push({
                    status: data.verified ? 'CL' : 'CO',
                    text: data.verified ? 'Identity verified' : 'Identity verification requires review'
                });
            }
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
                            vat: '',
                            people: [
                                {
                                    associations: null,
                                    name: 'Barbara Archer',
                                    start_date: '2018-04-12',
                                    dob: '1974-07',
                                    country: '',
                                    id: 'd45r1k29io6g00db42dg',
                                    is_disqualified_director: false,
                                    end_date: '',
                                    nationality: 'British',
                                    has_bankruptcy_history: false,
                                    address: 'Redruth, Cornwall, TR15 2BY',
                                    category: 'Member',
                                    position: 'Designated LLP Member'
                                },
                                {
                                    associations: null,
                                    name: 'Stephen John Duncan Morrison',
                                    start_date: '2018-04-12',
                                    dob: '1972-07',
                                    country: '',
                                    id: 'd45r1k29io6g00db42e0',
                                    is_disqualified_director: false,
                                    end_date: '',
                                    nationality: 'British',
                                    has_bankruptcy_history: false,
                                    address: 'Redruth, Cornwall, TR15 2BY',
                                    category: 'Member',
                                    position: 'Designated LLP Member'
                                }
                            ],
                            is_exporter: false,
                            sic_nace_codes: '69100',
                            is_agent: false,
                            email: '',
                            is_importer: false,
                            shareOwnership: [
                                {
                                    natureOfControlStartDate: '2018-04-12',
                                    natureOfControl: '',
                                    isOutOfBusiness: false,
                                    is_ubo: true,
                                    indirectOwnershipPercentage: 0,
                                    stockDetails: null,
                                    fullName: 'Barbara Archer',
                                    natureOfControlTypes: [
                                        'Right to share 25% to 50% of surplus assets of a limited liability partnership',
                                        'Ownership of 25% to 50% of voting rights of a limited liability partnership'
                                    ],
                                    dateOfBirth: '1974-07',
                                    organizationName: '',
                                    ownershipPercentage: 0,
                                    subjectType: { description: '' },
                                    beneficiaryType: 'Individual',
                                    duns: '',
                                    id: 'd45r1k29io6g00db42cg',
                                    votingPercentageHigh: 0,
                                    nationality: 'British',
                                    address: null,
                                    category: '',
                                    residenceCountryName: 'United Kingdom'
                                },
                                {
                                    natureOfControlStartDate: '2018-04-12',
                                    natureOfControl: '',
                                    isOutOfBusiness: false,
                                    is_ubo: true,
                                    indirectOwnershipPercentage: 0,
                                    stockDetails: null,
                                    fullName: 'Stephen John Duncan Morrison',
                                    natureOfControlTypes: [
                                        'Right to share 25% to 50% of surplus assets of a limited liability partnership',
                                        'Ownership of 25% to 50% of voting rights of a limited liability partnership'
                                    ],
                                    dateOfBirth: '1972-07',
                                    organizationName: '',
                                    ownershipPercentage: 0,
                                    subjectType: { description: '' },
                                    beneficiaryType: 'Individual',
                                    duns: '',
                                    id: 'd45r1k29io6g00db42d0',
                                    votingPercentageHigh: 0,
                                    nationality: 'British',
                                    address: null,
                                    category: '',
                                    residenceCountryName: 'United Kingdom'
                                }
                            ],
                            url: 'www.thurstanhoskin.co.uk',
                            description: '',
                            provided_status_start_date: '2018-04-13',
                            lei: '',
                            share_capital: '',
                            legal_form: 'Limited Partnership',
                            formatted_address: {
                                po_box: '',
                                city: 'REDRUTH',
                                zip: 'TR15 2BY',
                                country: 'United Kingdom',
                                cc: 'GB',
                                street: 'CHYNOWETH, CHAPEL STREET',
                                district: 'CORNWALL'
                            },
                            country: 'United Kingdom',
                            detailed_operating_status: 'active',
                            last_update: '',
                            id: '',
                            date_of_incorporation: '2018-04-12',
                            sic_nace_codes_des: 'Legal activities',
                            business_trust_index: {
                                trust_index: 0,
                                investigation_date: '',
                                data_provider: '',
                                national_percentile: 0,
                                tsrReport_date: '',
                                trust_class: ''
                            },
                            status: 'active',
                            share_currency: '',
                            number_of_employees: 20,
                            provided_status: 'Active',
                            trading_address: {
                                po_box: '',
                                city: 'REDRUTH',
                                zip: 'TR15 2BY',
                                country: 'United Kingdom',
                                cc: 'GB',
                                street: 'Chynoweth Chapel Street',
                                district: 'Cornwall'
                            },
                            tax_code: '',
                            address: 'CHYNOWETH, CHAPEL STREET, CORNWALL, REDRUTH, United Kingdom, GB, TR15 2BY',
                            dissolution_date: '',
                            registration_number: 'OC421980',
                            paidup_capital: '',
                            phone: ''
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
                            relationships: [],
                            pscs: [
                                {
                                    natureOfControl: '',
                                    natureOfControlStartDate: '2018-04-12',
                                    natureOfControlTypes: [
                                        'Right to share 25% to 50% of surplus assets of a limited liability partnership',
                                        'Ownership of 25% to 50% of voting rights of a limited liability partnership'
                                    ],
                                    person: {
                                        name: 'Barbara Archer',
                                        beneficialOwnershipPercentage: 0,
                                        businessEntityType: '',
                                        isOutOfBusiness: false,
                                        indirectOwnershipPercentage: 0,
                                        country: '',
                                        beneficiaryType: 'Individual',
                                        duns: '',
                                        isBeneficiary: false,
                                        birthDate: '1974-07',
                                        nationality: 'British',
                                        address: null,
                                        memberID: 2079789992,
                                        residenceCountryName: 'United Kingdom',
                                        directOwnershipPercentage: 0
                                    }
                                },
                                {
                                    natureOfControl: '',
                                    natureOfControlStartDate: '2018-04-12',
                                    natureOfControlTypes: [
                                        'Right to share 25% to 50% of surplus assets of a limited liability partnership',
                                        'Ownership of 25% to 50% of voting rights of a limited liability partnership'
                                    ],
                                    person: {
                                        name: 'Stephen John Duncan Morrison',
                                        beneficialOwnershipPercentage: 0,
                                        businessEntityType: '',
                                        isOutOfBusiness: false,
                                        indirectOwnershipPercentage: 0,
                                        country: '',
                                        beneficiaryType: 'Individual',
                                        duns: '',
                                        isBeneficiary: false,
                                        birthDate: '1972-07',
                                        nationality: 'British',
                                        address: null,
                                        memberID: 2079789993,
                                        residenceCountryName: 'United Kingdom',
                                        directOwnershipPercentage: 0
                                    }
                                }
                            ],
                            beneficialOwners: [
                                {
                                    name: 'THURSTAN HOSKIN SOLICITORS LLP',
                                    beneficialOwnershipPercentage: 0,
                                    businessEntityType: 'Limited Liability Partnership',
                                    isOutOfBusiness: false,
                                    indirectOwnershipPercentage: 0,
                                    country: 'GB',
                                    beneficiaryType: 'Business',
                                    duns: '223822293',
                                    isBeneficiary: false,
                                    birthDate: '',
                                    nationality: '',
                    address: {
                                        po_box: '',
                                        city: 'REDRUTH',
                                        zip: 'TR15 2BY',
                                        country: 'United Kingdom',
                                        cc: 'GB',
                                        street: '',
                                        district: ''
                                    },
                                    memberID: 287723562,
                                    residenceCountryName: '',
                                    directOwnershipPercentage: 0
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
            }
        ];
    }
}

// Removed below - keeping only the real THURSTAN HOSKIN SOLICITORS LLP check
/*
            {
                transactionId: 'mock_eid_pep_002',
                checkType: 'electronic-id',
                status: 'closed',
                consumerName: 'Michael Roberts',
                consumerPhone: '+447987654321',
                consumerEmail: 'michael.roberts@example.com',
                tasks: ['report:identity', 'report:peps', 'report:address'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: twoDaysAgo.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/xyz5678',
                pdfAddedAt: twoDaysAgo.toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    nfc: { result: 'clear', status: 'closed', data: {} },
                    identity: { result: 'clear', status: 'closed', data: {} },
                    peps: { result: 'consider', status: 'closed', data: { total_hits: 2, monitored: true } },
                    address: { result: 'clear', status: 'closed', data: { quality: 92, match_count: 2 } }
                },
                piiData: {
                    name: { first: 'Michael', last: 'Roberts' },
                    dob: '1975-03-20',
                    address: {
                        line1: '456 Park Avenue',
                        town: 'Manchester',
                        postcode: 'M1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: true,
                considerReasons: ['PEP hits'],
                pepSanctionsUpdates: [
                    {
                        timestamp: yesterday.toISOString(),
                        type: 'peps',
                        outcome: 'consider',
                        s3Key: 'protected/pep9999',
                        matchCount: 2,
                        alertSeverity: 'high',
                        taskOutcomes: {
                            peps: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 2,
                                    matches: [
                                        {
                                            name: 'Michael Roberts',
                                            position: 'City Councillor',
                                            country: 'UK',
                                            relationship: 'direct',
                                            level: 'local'
                                        },
                                        {
                                            name: 'M. Roberts',
                                            position: 'Board Member',
                                            country: 'UK',
                                            relationship: 'possible',
                                            level: 'corporate'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ],
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'Electronic ID check initiated' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'PDF received and uploaded to S3 - CONSIDER: PEP hits' },
                    { timestamp: yesterday.toISOString(), update: 'PEP monitoring alert - outstanding hits require review - CONSIDER' }
                ]
            },
            
            // 3. Original ID (Enhanced downgraded) - CLEAR
            {
                transactionId: 'mock_eid_orig_003',
                checkType: 'electronic-id',
                status: 'closed',
                consumerName: 'David Wilson',
                consumerPhone: '+447111222333',
                tasks: ['report:identity', 'report:peps', 'report:address'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: weekAgo.toISOString(),
                completedAt: weekAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/def3456',
                pdfAddedAt: weekAgo.toISOString(),
                hasMonitoring: false,
                taskOutcomes: {
                    nfc: { result: 'fail', status: 'unobtainable', data: {} },
                    identity: { result: 'clear', status: 'closed', data: {} },
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: false } },
                    address: { result: 'clear', status: 'closed', data: { quality: 88, match_count: 2 } }
                },
                piiData: {
                    name: { first: 'David', last: 'Wilson' },
                    dob: '1990-11-05',
                    address: {
                        line1: '789 Queen Street',
                        town: 'Birmingham',
                        postcode: 'B1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: false,
                considerReasons: ['Enhanced Downgrade', 'Skipped SoF', 'Skipped Bank link'], // 3 hints (all info level)
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'Electronic ID check initiated' },
                    { timestamp: weekAgo.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: weekAgo.toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' }
                ]
            },
            
            // 4. Lite Screen - CONSIDER (Address quality issues)
            {
                transactionId: 'mock_lite_004',
                checkType: 'lite-screen',
                status: 'closed',
                consumerName: 'Emma Davis',
                tasks: ['report:footprint', 'report:peps'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: twoDaysAgo.toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: yesterday.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/lite001',
                pdfAddedAt: yesterday.toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    footprint: { result: 'consider', status: 'closed', data: { quality: 65, match_count: 1 } },
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } }
                },
                piiData: {
                    name: { first: 'Emma', last: 'Davis' },
                    dob: '1988-09-12',
                    address: {
                        line1: '321 Oak Road',
                        town: 'Leeds',
                        postcode: 'LS1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: true,
                considerReasons: ['address verification', 'image quality not sufficient', 'facial similarity not sufficient', 'bank link flags'], // 4 hints (warnings)
                updates: [
                    { timestamp: twoDaysAgo.toISOString(), update: 'Lite Screen check initiated' },
                    { timestamp: yesterday.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: yesterday.toISOString(), update: 'PDF received and uploaded to S3 - CONSIDER: address verification' }
                ]
            },
            
            // 5. IDV - PROCESSING
            {
                checkId: 'mock_idv_005',
                checkType: 'idv',
                status: 'processing',
                consumerName: 'James Anderson',
                tasks: ['report:identity'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: now.toISOString(),
                updatedAt: now.toISOString(),
                pdfReady: false,
                hasMonitoring: false,
                taskOutcomes: {},
                piiData: {
                    name: { first: 'James', last: 'Anderson' }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: now.toISOString(), update: 'IDV check initiated' },
                    { timestamp: now.toISOString(), update: 'Documents uploaded - processing' }
                ]
            },
            
            // 6. KYB - CLEAR (6 hints - mix of info and warnings)
            {
                checkId: 'mock_kyb_006',
                checkType: 'kyb',
                status: 'closed',
                companyName: 'ACME Corporation Ltd',
                tasks: ['company:summary', 'company:sanctions', 'company:ubo'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: twoDaysAgo.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/kyb0001',
                pdfAddedAt: twoDaysAgo.toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    'company:summary': { result: 'clear', status: 'closed', data: {} },
                    'company:sanctions': { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } },
                    'company:ubo': { result: 'clear', status: 'closed', data: {} }
                },
                companyData: {
                    name: 'ACME Corporation Ltd',
                    number: '12345678',
                    jurisdiction: 'UK'
                },
                hasAlerts: false,
                considerReasons: ['Complex ownership structure', 'UBO in high-risk jurisdiction', 'Inactive company status', 'Multiple name changes', 'Recent director changes', 'Missing financial data'], // 6 hints
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'KYB check initiated' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'Check completed - awaiting PDF' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' }
                ]
            },
            
            // 7. KYB - CONSIDER (7 hints - sanctions + warnings)
            {
                checkId: 'mock_kyb_sanc_007',
                checkType: 'kyb',
                status: 'closed',
                companyName: 'Global Trade Partners LLP',
                tasks: ['company:summary', 'company:sanctions'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/kyb0002',
                pdfAddedAt: twoDaysAgo.toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    'company:summary': { result: 'clear', status: 'closed', data: {} },
                    'company:sanctions': { result: 'consider', status: 'closed', data: { total_hits: 1, monitored: true } }
                },
                companyData: {
                    name: 'Global Trade Partners LLP',
                    number: '87654321',
                    jurisdiction: 'UK'
                },
                hasAlerts: true,
                considerReasons: ['sanctions hits', 'UBO in high-risk jurisdiction', 'Adverse media', 'Complex ownership structure', 'Missing beneficial owner data', 'Offshore entities', 'Recent incorporation'], // 7 hints
                pepSanctionsUpdates: [
                    {
                        timestamp: yesterday.toISOString(),
                        type: 'sanctions',
                        outcome: 'consider',
                        s3Key: 'protected/sanc001',
                        matchCount: 1,
                        alertSeverity: 'medium',
                        taskOutcomes: {
                            sanctions: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 1,
                                    matches: [
                                        {
                                            name: 'Global Trade Partners',
                                            sanctions_list: 'OFAC',
                                            country: 'US',
                                            reason: 'Financial sanctions - possible match',
                                            severity: 'medium'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ],
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'KYB check initiated' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'Check completed - awaiting PDF' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'PDF received and uploaded to S3 - CONSIDER' },
                    { timestamp: yesterday.toISOString(), update: 'Sanctions monitoring alert - outstanding hits require review - CONSIDER' }
                ]
            },
            
            // 8. Electronic ID - OPEN (waiting for consumer)
            {
                transactionId: 'mock_eid_open_008',
                checkType: 'electronic-id',
                status: 'open',
                consumerName: 'Lisa Martinez',
                consumerPhone: '+447555666777',
                consumerEmail: 'lisa.martinez@example.com',
                tasks: ['report:identity', 'report:peps'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: now.toISOString(),
                updatedAt: now.toISOString(),
                pdfReady: false,
                hasMonitoring: false,
                taskOutcomes: {},
                piiData: {
                    name: { first: 'Lisa', last: 'Martinez' }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: now.toISOString(), update: 'Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: now.toISOString(), update: 'Transaction confirmed by Thirdfort' }
                ]
            },
            
            // 9. Lite Screen - ABORTED
            {
                transactionId: 'mock_lite_abort_009',
                checkType: 'lite-screen',
                status: 'aborted',
                consumerName: 'Robert Taylor',
                tasks: ['report:footprint', 'report:peps'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: twoDaysAgo.toISOString(),
                updatedAt: yesterday.toISOString(),
                pdfReady: false,
                hasMonitoring: false,
                taskOutcomes: {},
                piiData: {
                    name: { first: 'Robert', last: 'Taylor' },
                    dob: '1992-07-18'
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: twoDaysAgo.toISOString(), update: 'Lite Screen check initiated' },
                    { timestamp: yesterday.toISOString(), update: 'Transaction aborted' }
                ]
            },
            
            // 10. Enhanced ID - Document integrity issues (9 hints - alerts + warnings)
            {
                transactionId: 'mock_eid_doc_010',
                checkType: 'electronic-id',
                status: 'closed',
                consumerName: 'Jennifer White',
                tasks: ['report:identity', 'report:peps', 'report:address'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: twoDaysAgo.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/doc0010',
                pdfAddedAt: twoDaysAgo.toISOString(),
                hasMonitoring: false,
                taskOutcomes: {
                    nfc: { result: 'clear', status: 'closed', data: { chip_read: true } },
                    identity: { result: 'fail', status: 'closed', data: { verified: false } },
                    document: { result: 'fail', status: 'closed', data: { 
                        authenticity: 'questionable', 
                        integrity: 'failed',
                        compromised: 'possible',
                        consistency: 'inconsistent',
                        validation: 'invalid'
                    }},
                    facial_similarity: { result: 'consider', status: 'closed', data: {
                        comparison: 'partial_match',
                        authenticity: 'genuine',
                        integrity: 'passed'
                    }},
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: false } },
                    address: { result: 'consider', status: 'closed', data: { sources: 1, quality: 72 } },
                    'documents:poa': { result: 'clear', status: 'closed', data: { document_count: 2 } },
                    'documents:poo': { result: 'consider', status: 'closed', data: { document_count: 0 } }
                },
                piiData: {
                    name: { first: 'Jennifer', last: 'White' },
                    dob: '1995-02-28',
                    address: {
                        line1: '159 Elm Street',
                        town: 'Bristol',
                        postcode: 'BS1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: true,
                considerReasons: ['document integrity', 'NFC mismatch', 'document expired', 'PEP/Sanction hits', 'address quality not sufficient', 'facial similarity not sufficient', 'mortality hit', 'no DOB match', 'bank link flags'], // 9 hints (max display)
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'Electronic ID check initiated' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'PDF received and uploaded to S3 - CONSIDER: document integrity' }
                ]
            },
            
            // 11. KYB - PROCESSING
            {
                checkId: 'mock_kyb_proc_011',
                checkType: 'kyb',
                status: 'processing',
                companyName: 'TechStart Innovations Ltd',
                tasks: ['company:summary', 'company:sanctions', 'company:ubo'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: yesterday.toISOString(),
                updatedAt: yesterday.toISOString(),
                pdfReady: false,
                hasMonitoring: true,
                taskOutcomes: {},
                companyData: {
                    name: 'TechStart Innovations Ltd',
                    number: '11223344',
                    jurisdiction: 'UK'
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: yesterday.toISOString(), update: 'KYB check initiated' },
                    { timestamp: yesterday.toISOString(), update: 'Thirdfort processing KYB check' }
                ]
            },
            
            // 12. IDV - CLOSED - CLEAR
            {
                checkId: 'mock_idv_closed_012',
                checkType: 'idv',
                status: 'closed',
                consumerName: 'Thomas Brown',
                tasks: ['report:identity'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: twoDaysAgo.toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: yesterday.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/idv0012',
                pdfAddedAt: yesterday.toISOString(),
                hasMonitoring: false,
                taskOutcomes: {
                    identity: { result: 'clear', status: 'closed', data: {} },
                    document: { result: 'clear', status: 'closed', data: { authenticity: 'genuine' } }
                },
                piiData: {
                    name: { first: 'Thomas', last: 'Brown' },
                    dob: '1982-04-30'
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: twoDaysAgo.toISOString(), update: 'IDV check initiated' },
                    { timestamp: yesterday.toISOString(), update: 'Check completed - awaiting PDF' },
                    { timestamp: yesterday.toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' }
                ]
            },
            
            // 13. Enhanced ID - PEP hits then CLEARED (12 hints total, only 9 shown prioritized)
            {
                transactionId: 'mock_eid_pep_clear_013',
                checkType: 'electronic-id',
                status: 'closed',
                consumerName: 'Patricia Johnson',
                consumerPhone: '+447444555666',
                consumerEmail: 'patricia.johnson@example.com',
                tasks: ['report:identity', 'report:peps', 'report:address'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/pep0013',
                pdfAddedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    nfc: { result: 'clear', status: 'closed', data: {} },
                    identity: { result: 'clear', status: 'closed', data: {} },
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } },
                    address: { result: 'clear', status: 'closed', data: { quality: 93, match_count: 2 } }
                },
                piiData: {
                    name: { first: 'Patricia', last: 'Johnson' },
                    dob: '1980-12-05',
                    address: {
                        line1: '77 Station Road',
                        town: 'Edinburgh',
                        postcode: 'EH1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: false,
                considerReasons: ['document integrity', 'NFC chip error', 'document expired', 'PEP hits (cleared)', 'address quality', 'facial similarity', 'mortality hit', 'no DOB match', 'bank link flags', 'Enhanced Downgrade', 'Skipped SoF', 'Skipped PoO'], // 12 hints - only top 9 will show
                pepSanctionsUpdates: [
                    {
                        timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
                        type: 'peps',
                        outcome: 'consider',
                        s3Key: 'protected/pep0013a',
                        matchCount: 3,
                        alertSeverity: 'high',
                        taskOutcomes: {
                            peps: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 3,
                                    matches: [
                                        {
                                            name: 'Patricia Johnson',
                                            position: 'Director of Public Health',
                                            country: 'UK',
                                            relationship: 'direct',
                                            level: 'national'
                                        },
                                        {
                                            name: 'P. Johnson',
                                            position: 'NHS Executive',
                                            country: 'UK',
                                            relationship: 'possible',
                                            level: 'regional'
                                        },
                                        {
                                            name: 'Patricia A Johnson',
                                            position: 'Government Advisor',
                                            country: 'UK',
                                            relationship: 'indirect',
                                            level: 'national'
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: 'peps',
                        outcome: 'clear',
                        s3Key: 'protected/pep0013b',
                        matchCount: 0,
                        alertSeverity: 'low',
                        detailedReason: 'All hits dismissed - no matches found',
                        taskOutcomes: {
                            peps: {
                                result: 'clear',
                                status: 'closed',
                                data: {
                                    total_hits: 0,
                                    matches: []
                                }
                            }
                        }
                    }
                ],
                updates: [
                    { timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), update: 'Electronic ID check initiated' },
                    { timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), update: 'PEP monitoring alert - outstanding hits require review - CONSIDER' },
                    { timestamp: yesterday.toISOString(), update: 'PEP monitoring update - all hits dismissed or cleared - CLEAR' }
                ]
            },
            
            // 14. Enhanced ID - Additional documents uploaded post-completion
            {
                transactionId: 'mock_eid_addoc_014',
                checkType: 'electronic-id',
                status: 'closed',
                consumerName: 'Andrew Mitchell',
                consumerPhone: '+447333444555',
                consumerEmail: 'andrew.mitchell@example.com',
                tasks: ['report:identity', 'report:peps', 'documents:poa', 'documents:other'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: twoDaysAgo.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/addoc014',
                pdfAddedAt: twoDaysAgo.toISOString(),
                hasMonitoring: false,
                taskOutcomes: {
                    nfc: { result: 'clear', status: 'closed', data: {} },
                    identity: { result: 'clear', status: 'closed', data: {} },
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: false } },
                    'documents:poa': { result: 'clear', status: 'closed', data: {} },
                    'documents:other': { result: 'clear', status: 'closed', data: {} }
                },
                piiData: {
                    name: { first: 'Andrew', last: 'Mitchell' },
                    dob: '1978-08-22',
                    address: {
                        line1: '88 Bridge Street',
                        town: 'Liverpool',
                        postcode: 'L1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'Electronic ID check initiated' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: twoDaysAgo.toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: yesterday.toISOString(), update: 'Additional documents uploaded by consumer' }
                ]
            },
            
            // 15. Lite Screen - Multiple PEP updates (CONSIDER → CLEAR → CONSIDER again)
            {
                transactionId: 'mock_lite_multi_015',
                checkType: 'lite-screen',
                status: 'closed',
                consumerName: 'Catherine Harris',
                tasks: ['report:footprint', 'report:peps'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: now.toISOString(),
                completedAt: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/multi015',
                pdfAddedAt: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    footprint: { result: 'clear', status: 'closed', data: { quality: 88, match_count: 2 } },
                    peps: { result: 'consider', status: 'closed', data: { total_hits: 1, monitored: true } }
                },
                piiData: {
                    name: { first: 'Catherine', last: 'Harris' },
                    dob: '1970-05-14',
                    address: {
                        line1: '234 Castle Street',
                        town: 'Cardiff',
                        postcode: 'CF1 1AA',
                        country: 'GBR'
                    }
                },
                hasAlerts: true,
                considerReasons: ['PEP hits'],
                pepSanctionsUpdates: [
                    {
                        timestamp: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
                        type: 'peps',
                        outcome: 'consider',
                        s3Key: 'protected/pep015a',
                        matchCount: 2,
                        alertSeverity: 'medium',
                        detailedReason: '2 new PEP matches found',
                        taskOutcomes: {
                            peps: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 2,
                                    matches: [
                                        {
                                            name: 'Catherine Harris',
                                            position: 'Hospital Trust Director',
                                            country: 'UK',
                                            relationship: 'direct',
                                            level: 'local'
                                        },
                                        {
                                            name: 'C Harris',
                                            position: 'Charity Trustee',
                                            country: 'UK',
                                            relationship: 'possible',
                                            level: 'local'
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
                        type: 'peps',
                        outcome: 'clear',
                        s3Key: 'protected/pep015b',
                        matchCount: 0,
                        alertSeverity: 'low',
                        detailedReason: 'All hits dismissed - false positives confirmed',
                        taskOutcomes: {
                            peps: {
                                result: 'clear',
                                status: 'closed',
                                data: {
                                    total_hits: 0,
                                    matches: []
                                }
                            }
                        }
                    },
                    {
                        timestamp: now.toISOString(),
                        type: 'peps',
                        outcome: 'consider',
                        s3Key: 'protected/pep015c',
                        matchCount: 1,
                        alertSeverity: 'high',
                        detailedReason: '1 new PEP match found - NHS Wales Board Member',
                        taskOutcomes: {
                            peps: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 1,
                                    matches: [
                                        {
                                            name: 'Dr Catherine Harris',
                                            position: 'NHS Wales Board Member',
                                            country: 'UK',
                                            relationship: 'direct',
                                            level: 'national'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                ],
                updates: [
                    { timestamp: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(), update: 'Lite Screen check initiated' },
                    { timestamp: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: new Date(now - 28 * 24 * 60 * 60 * 1000).toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(), update: 'PEP monitoring alert - outstanding hits require review - CONSIDER' },
                    { timestamp: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), update: 'PEP monitoring update - all hits dismissed or cleared - CLEAR' },
                    { timestamp: now.toISOString(), update: 'PEP monitoring alert - outstanding hits require review - CONSIDER' }
                ]
            },
            
            // 16. KYB - Sanctions cleared after review
            {
                checkId: 'mock_kyb_sanc_clear_016',
                checkType: 'kyb',
                status: 'closed',
                companyName: 'Meridian Holdings plc',
                tasks: ['company:summary', 'company:sanctions', 'company:ubo'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/kyb0016',
                pdfAddedAt: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    'company:summary': { result: 'clear', status: 'closed', data: {} },
                    'company:sanctions': { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } },
                    'company:ubo': { result: 'clear', status: 'closed', data: {} }
                },
                companyData: {
                    name: 'Meridian Holdings plc',
                    number: '55667788',
                    jurisdiction: 'UK'
                },
                hasAlerts: false,
                considerReasons: [],
                pepSanctionsUpdates: [
                    {
                        timestamp: weekAgo.toISOString(),
                        type: 'sanctions',
                        outcome: 'consider',
                        s3Key: 'protected/sanc016a',
                        matchCount: 2,
                        alertSeverity: 'critical',
                        detailedReason: '2 sanctions matches found - OFAC and EU lists',
                        taskOutcomes: {
                            sanctions: {
                                result: 'consider',
                                status: 'closed',
                                data: {
                                    total_hits: 2,
                                    matches: [
                                        {
                                            name: 'Meridian Holdings',
                                            sanctions_list: 'OFAC',
                                            country: 'US',
                                            reason: 'Financial sanctions - trade restrictions',
                                            severity: 'high'
                                        },
                                        {
                                            name: 'Meridian Holdings PLC',
                                            sanctions_list: 'EU Sanctions',
                                            country: 'EU',
                                            reason: 'Export control violations',
                                            severity: 'critical'
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    {
                        timestamp: yesterday.toISOString(),
                        type: 'sanctions',
                        outcome: 'clear',
                        s3Key: 'protected/sanc016b',
                        matchCount: 0,
                        alertSeverity: 'low',
                        detailedReason: 'All sanctions hits dismissed - different entity confirmed',
                        taskOutcomes: {
                            sanctions: {
                                result: 'clear',
                                status: 'closed',
                                data: {
                                    total_hits: 0,
                                    matches: []
                                }
                            }
                        }
                    }
                ],
                updates: [
                    { timestamp: new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString(), update: 'KYB check initiated' },
                    { timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), update: 'Check completed - awaiting PDF' },
                    { timestamp: new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: weekAgo.toISOString(), update: 'Sanctions monitoring alert - outstanding hits require review - CONSIDER' },
                    { timestamp: yesterday.toISOString(), update: 'Sanctions monitoring update - all hits dismissed or cleared - CLEAR' }
                ]
            },
            
            // 17. KYB - CONSIDER (UBO and Beneficial Ownership issues) - Real data example
            {
                checkId: 'mock_kyb_ubo_017',
                checkType: 'kyb',
                status: 'closed',
                companyName: 'THURSTAN HOSKIN SOLICITORS LLP',
                tasks: ['company:summary', 'company:sanctions', 'company:ubo', 'company:beneficial-check', 'company:shareholders'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/JmXPHqr',
                pdfAddedAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    'company:summary': { result: 'clear', status: 'closed', data: { 
                        people: [
                            { name: 'Barbara Archer', position: 'Designated LLP Member', nationality: 'British' },
                            { name: 'Stephen John Duncan Morrison', position: 'Designated LLP Member', nationality: 'British' }
                        ]
                    }},
                    'company:sanctions': { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } },
                    'company:ubo': { result: 'consider', status: 'unobtainable', data: { uboUnavailable: true } },
                    'company:beneficial-check': { result: 'consider', status: 'unobtainable', data: {} },
                    'company:shareholders': { result: 'clear', status: 'closed', data: { document_count: 1 } }
                },
                companyData: {
                    name: 'THURSTAN HOSKIN SOLICITORS LLP',
                    number: 'OC421980',
                    jurisdiction: 'UK',
                    incorporation_date: '2018-04-12',
                    address: {
                        line1: 'Chynoweth, Chapel Street',
                        town: 'Redruth',
                        county: 'Cornwall',
                        postcode: 'TR15 2BY',
                        country: 'United Kingdom'
                    },
                    status: 'Active',
                    legal_form: 'Limited Partnership',
                    sic_code: '69100 - Legal activities',
                    employees: 20
                },
                hasAlerts: true,
                considerReasons: ['beneficial ownership issues', 'UBO concerns'],
                updates: [
                    { timestamp: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(), update: 'KYB check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(), update: 'Check completed - awaiting PDF' },
                    { timestamp: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(), update: 'PDF received and uploaded to S3 - CONSIDER: beneficial ownership issues' },
                    { timestamp: yesterday.toISOString(), update: 'Refreshed from Thirdfort API - Status: closed' }
                ]
            },
            
            // 18. IDV - OPEN (Documents uploaded, awaiting processing) - Real data example
            {
                checkId: 'mock_idv_open_018',
                checkType: 'idv',
                status: 'open',
                consumerName: 'Jacob Robert Moran',
                tasks: ['report:identity'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: yesterday.toISOString(),
                updatedAt: now.toISOString(),
                pdfReady: false,
                hasMonitoring: false,
                documentsUploaded: true,
                documentType: 'passport',
                taskOutcomes: {
                    'identity:lite': { status: 'pending', data: {} }
                },
                piiData: {
                    name: { first: 'Jacob', last: 'Moran', other: 'Robert' }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: yesterday.toISOString(), update: 'IDV check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: yesterday.toISOString(), update: 'Documents uploaded by consumer' },
                    { timestamp: now.toISOString(), update: 'Refreshed from Thirdfort API - Status: open' }
                ]
            },
            
            // 19. Enhanced ID - OPEN (Multiple tasks including SoF and Bank Statement) - Real data example
            {
                transactionId: 'mock_eid_open_019',
                checkType: 'electronic-id',
                status: 'open',
                consumerName: 'Jacob Robert Archer-Moran',
                consumerPhone: '+447506430094',
                consumerEmail: 'jacob.archer-moran@thurstanhoskin.co.uk',
                tasks: ['report:identity', 'report:footprint', 'report:peps', 'documents:poa', 'report:sof-v1', 'report:bank-statement', 'report:bank-summary'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: weekAgo.toISOString(),
                updatedAt: now.toISOString(),
                pdfReady: false,
                hasMonitoring: true,
                smsSent: true,
                taskOutcomes: {},
                piiData: {
                    name: { first: 'Jacob Robert', last: 'Archer-Moran' }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: weekAgo.toISOString(), update: 'Electronic ID check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: weekAgo.toISOString(), update: 'Transaction confirmed by Thirdfort' },
                    { timestamp: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), update: 'Refreshed from Thirdfort API - Status: open' },
                    { timestamp: yesterday.toISOString(), update: 'Refreshed from Thirdfort API - Status: open' },
                    { timestamp: now.toISOString(), update: 'Refreshed from Thirdfort API - Status: open' }
                ]
            },
            
            // 20. Lite Screen - CLOSED with PDF (Minimal consumer data) - Real data example
            {
                transactionId: 'mock_lite_020',
                checkType: 'lite-screen',
                status: 'closed',
                consumerName: 'Test Consumer',
                tasks: ['report:footprint', 'report:peps'],
                initiatedBy: 'jacob.archer-moran@thurstanhoskin.co.uk',
                initiatedAt: yesterday.toISOString(),
                updatedAt: yesterday.toISOString(),
                completedAt: yesterday.toISOString(),
                pdfReady: true,
                pdfS3Key: 'protected/fX6hWC1',
                pdfAddedAt: yesterday.toISOString(),
                hasMonitoring: true,
                taskOutcomes: {
                    footprint: { result: 'clear', status: 'closed', data: { quality: 85, match_count: 2 } },
                    peps: { result: 'clear', status: 'closed', data: { total_hits: 0, monitored: true } }
                },
                piiData: {
                    name: { first: 'Test', last: 'Consumer' }
                },
                hasAlerts: false,
                considerReasons: [],
                updates: [
                    { timestamp: yesterday.toISOString(), update: 'Lite Screen check initiated by jacob.archer-moran@thurstanhoskin.co.uk' },
                    { timestamp: yesterday.toISOString(), update: 'Transaction completed - awaiting PDF' },
                    { timestamp: yesterday.toISOString(), update: 'PDF received and uploaded to S3 - CLEAR' },
                    { timestamp: yesterday.toISOString(), update: 'Refreshed from Thirdfort API - Status: closed' }
                ]
            }
*/
// ===================================================================
// INITIALIZE
// ===================================================================

let manager;

document.addEventListener('DOMContentLoaded', () => {
    manager = new ThirdfortChecksManager();
});

