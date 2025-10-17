/* ===================================
   Electronic ID Checks Type
   =================================== */

/**
 * Initialize Electronic ID Checks type
 * This check type includes comprehensive electronic identity verification
 * with enhanced screening and source of funds verification
 */
function init_electronic_id() {
  console.log('Initializing Electronic ID Checks type');
  
  // Show all individual verification sections
  showSection('clientDetailsSection');
  showSection('addressDetailsSection');
  
  // Hide business details (not needed for individual checks)
  hideSection('businessDetailsSection');
  
  // Configure task visibility and recommendations
  configureTasksForElectronicID();
  
  // Set default task selections
  preselectDefaultTasksElectronicID();
}

/**
 * Configure which tasks are relevant for Electronic ID Checks
 */
function configureTasksForElectronicID() {
  // Show all individual verification tasks including enhanced screening
  const relevantTasks = [
    'idv',
    'likeness',
    'document-verification',
    'aml-screen',
    'lite-screen',
    'enhanced-screen',
    'address-check',
    'address-history',
    'sof',
    'sow',
    'bank-linking'
  ];
  
  // Hide business-specific tasks
  const hiddenTasks = [
    'kyb',
    'ubo',
    'business-screen'
  ];
  
  // Show relevant task categories
  document.querySelectorAll('.task-category').forEach(category => {
    const categoryTitle = category.querySelector('h4').textContent.toLowerCase();
    
    if (categoryTitle.includes('business verification')) {
      category.style.display = 'none';
    } else {
      category.style.display = 'block';
    }
  });
  
  // Disable hidden tasks
  hiddenTasks.forEach(taskValue => {
    const checkbox = document.querySelector(`input[name="task"][value="${taskValue}"]`);
    if (checkbox) {
      checkbox.closest('.task-checkbox-label').style.display = 'none';
    }
  });
}

/**
 * Pre-select default tasks for Electronic ID Checks
 */
function preselectDefaultTasksElectronicID() {
  // Electronic ID includes comprehensive verification
  const defaultTasks = [
    'idv',
    'likeness',
    'document-verification',
    'aml-screen',
    'address-check',
    'address-history',
    'sof',
    'bank-linking'
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
 * Validate Electronic ID specific requirements
 */
function validateElectronicID() {
  // Must include core identity verification tasks
  const requiredTasks = ['idv', 'document-verification', 'aml-screen'];
  const hasRequired = requiredTasks.every(task => checkState.selectedTasks.has(task));
  
  if (!hasRequired) {
    showError('Electronic ID Checks require Identity Verification, Document Verification, and AML Screening.');
    return false;
  }
  
  // Warn if source of funds is not selected for high-value matters
  if (checkState.matterCategory === 'conveyancing' && !checkState.selectedTasks.has('sof')) {
    const confirmProceed = confirm('Conveyancing matters typically require Source of Funds verification. Continue without it?');
    if (!confirmProceed) {
      return false;
    }
  }
  
  return true;
}

