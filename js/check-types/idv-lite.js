/* ===================================
   IDV & Lite Screen Check Type
   =================================== */

/**
 * Initialize IDV & Lite Screen check type
 * This check type focuses on basic identity verification and light screening
 */
function init_idv_lite() {
  console.log('Initializing IDV & Lite Screen check type');
  
  // Show relevant sections
  showSection('clientDetailsSection');
  showSection('addressDetailsSection');
  
  // Hide business details (not needed for individual checks)
  hideSection('businessDetailsSection');
  
  // Configure task visibility and recommendations
  configureTasksForIDVLite();
  
  // Set default task selections
  preselectDefaultTasksIDVLite();
}

/**
 * Configure which tasks are relevant for IDV & Lite Screen
 */
function configureTasksForIDVLite() {
  // Show all individual verification tasks
  const relevantTasks = [
    'idv',
    'likeness',
    'document-verification',
    'aml-screen',
    'lite-screen',
    'address-check',
    'address-history'
  ];
  
  // Hide business-specific tasks
  const hiddenTasks = [
    'kyb',
    'ubo',
    'business-screen',
    'enhanced-screen'
  ];
  
  // Show relevant task categories
  document.querySelectorAll('.task-category').forEach(category => {
    const categoryTitle = category.querySelector('h4').textContent.toLowerCase();
    
    if (categoryTitle.includes('business')) {
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
 * Pre-select default tasks for IDV & Lite Screen
 */
function preselectDefaultTasksIDVLite() {
  const defaultTasks = ['idv', 'likeness', 'document-verification', 'lite-screen', 'address-check'];
  
  defaultTasks.forEach(taskValue => {
    const checkbox = document.querySelector(`input[name="task"][value="${taskValue}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkState.selectedTasks.add(taskValue);
    }
  });
}

/**
 * Validate IDV & Lite Screen specific requirements
 */
function validateIDVLite() {
  // Must include at least IDV and Lite Screen
  const requiredTasks = ['idv', 'lite-screen'];
  const hasRequired = requiredTasks.every(task => checkState.selectedTasks.has(task));
  
  if (!hasRequired) {
    showError('IDV & Lite Screen check requires both Identity Verification and Lite Screen tasks.');
    return false;
  }
  
  return true;
}

