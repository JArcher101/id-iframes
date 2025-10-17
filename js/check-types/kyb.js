/* ===================================
   Know Your Business (KYB) Check Type
   =================================== */

/**
 * Initialize Know Your Business check type
 * This check type focuses on business verification, UBO identification,
 * and business screening
 */
function init_kyb() {
  console.log('Initializing Know Your Business check type');
  
  // Show business-specific sections
  showSection('businessDetailsSection');
  showSection('clientDetailsSection');
  showSection('addressDetailsSection');
  
  // Configure task visibility and recommendations
  configureTasksForKYB();
  
  // Set default task selections
  preselectDefaultTasksKYB();
  
  // Add business-specific event listeners
  initializeBusinessSearch();
}

/**
 * Configure which tasks are relevant for KYB
 */
function configureTasksForKYB() {
  // Show all task categories for KYB
  const relevantTasks = [
    'idv',
    'likeness',
    'document-verification',
    'aml-screen',
    'enhanced-screen',
    'address-check',
    'kyb',
    'ubo',
    'business-screen',
    'sof',
    'sow'
  ];
  
  // Show all task categories
  document.querySelectorAll('.task-category').forEach(category => {
    category.style.display = 'block';
  });
  
  // Show all tasks
  document.querySelectorAll('input[name="task"]').forEach(checkbox => {
    checkbox.closest('.task-checkbox-label').style.display = 'flex';
  });
}

/**
 * Pre-select default tasks for KYB
 */
function preselectDefaultTasksKYB() {
  // KYB includes business verification and individual verification for UBOs
  const defaultTasks = [
    'kyb',
    'ubo',
    'business-screen',
    'idv',
    'document-verification',
    'aml-screen',
    'address-check'
  ];
  
  defaultTasks.forEach(taskValue => {
    const checkbox = document.querySelector(`input[name="task"][value="${taskValue}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkState.selectedTasks.add(taskValue);
    }
  });
}

/**
 * Initialize business search functionality
 */
function initializeBusinessSearch() {
  const businessNameInput = document.getElementById('businessName');
  const entityNumberInput = document.getElementById('entityNumber');
  
  if (businessNameInput) {
    businessNameInput.addEventListener('input', debounce(searchBusinessByName, 300));
  }
  
  if (entityNumberInput) {
    entityNumberInput.addEventListener('input', debounce(searchBusinessByNumber, 300));
  }
}

/**
 * Search for business by name
 */
async function searchBusinessByName(event) {
  const query = event.target.value;
  
  if (query.length < 3) {
    return;
  }
  
  console.log('Searching for business:', query);
  
  // TODO: Implement actual Companies House API search
  // For now, just a placeholder
}

/**
 * Search for business by entity number
 */
async function searchBusinessByNumber(event) {
  const number = event.target.value;
  
  if (number.length < 4) {
    return;
  }
  
  console.log('Searching for business by number:', number);
  
  // TODO: Implement actual Companies House API lookup
  // For now, just a placeholder
}

/**
 * Validate KYB specific requirements
 */
function validateKYB() {
  // Must include core business verification tasks
  const requiredTasks = ['kyb', 'ubo', 'business-screen'];
  const hasRequired = requiredTasks.every(task => checkState.selectedTasks.has(task));
  
  if (!hasRequired) {
    showError('Know Your Business checks require KYB, UBO identification, and Business Screening.');
    return false;
  }
  
  // Check if business details are provided
  const businessName = document.getElementById('businessName')?.value;
  const entityNumber = document.getElementById('entityNumber')?.value;
  
  if (!businessName || !entityNumber) {
    showError('Business name and entity number are required for KYB checks.');
    return false;
  }
  
  // Must also verify UBO individuals
  if (!checkState.selectedTasks.has('idv')) {
    const confirmProceed = confirm('UBO verification typically requires Identity Verification of individuals. Continue without it?');
    if (!confirmProceed) {
      return false;
    }
  }
  
  return true;
}

/**
 * Debounce utility function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

