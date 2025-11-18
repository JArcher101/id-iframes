// =====================================================================
// SUMMARY HELPERS - Transaction and Check Summary API Calls
// =====================================================================
// File location: backend/thirdfort/webhook/helpers/summary-helpers.web.js
// 
// PURPOSE:
// - Fetch transaction/check summaries instead of full details
// - Cleaner, structured data with key outcomes
// - Better performance and easier parsing
// - Includes PII data and report outcomes in organized format
// =====================================================================

import { generateThirdfortJWT, getThirdfortAPIUrl } from 'backend/thirdfort/generate-jwt.js';
import axios from 'axios';

/**
 * Fetch transaction summary from Thirdfort API
 * Returns clean, structured data with key outcomes
 * 
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function fetchTransactionSummary(transactionId, options = {}) {
  try {
    const token = options.jwt || await generateThirdfortJWT();
    if (!token) {
      console.error('&#x274C; Failed to generate JWT');
      return { success: false, error: 'Failed to generate JWT' };
    }
    
    const baseUrl = await getThirdfortAPIUrl();
    
    const response = await axios.get(`${baseUrl}/transactions/${transactionId}/_summary`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('&#x2705; Transaction summary fetched successfully');
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('&#x274C; Error fetching transaction summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch check summary from Thirdfort API
 * Returns clean, structured data with key outcomes for KYB checks
 * Note: Checks don't have a /_summary endpoint, so we fetch the full check and parse it
 * 
 * @param {string} checkId - Check ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function fetchCheckSummary(checkId, options = {}) {
  try {
    const token = options.jwt || await generateThirdfortJWT();
    if (!token) {
      console.error('&#x274C; Failed to generate JWT');
      return { success: false, error: 'Failed to generate JWT' };
    }
    
    const baseUrl = await getThirdfortAPIUrl();
    
    // Checks don't have a /_summary endpoint, fetch full check
    const response = await axios.get(`${baseUrl}/checks/${checkId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log('&#x2705; Check fetched successfully');
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error('&#x274C; Error fetching check:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Parse transaction summary data into structured task outcomes
 * Extracts key data points for check object storage
 * 
 * @param {object} summaryData - Transaction summary from API
 * @returns {Promise<object>} Parsed task outcomes
 */
export async function parseTransactionSummary(summaryData) {
  console.log('&#xD83D;&#xDD0D; parseTransactionSummary called with:', typeof summaryData);
  const taskOutcomes = {};
  const considerReasons = [];
  
  // Safety check: return empty data if summaryData is null/undefined
  if (!summaryData) {
    console.log('⚠️ summaryData is null/undefined, returning empty');
    return {
      taskOutcomes: {},
      considerReasons: [],
      piiData: { name: {}, address: {}, dob: undefined, document: {} },
      hasAlerts: false
    };
  }
  
  // Parse PII data
  const piiData = {
    name: summaryData.pii?.name || {},
    address: summaryData.pii?.address || {},
    dob: summaryData.pii?.dob,
    document: summaryData.pii?.document || {}
  };
  console.log('&#x2705; PII data parsed');
  
  // Parse report outcomes (can be object or array for Lite Screen)
  const reports = summaryData.reports || {};
  console.log('&#xD83D;&#xDCCA; Reports type:', Array.isArray(reports) ? 'array' : 'object', 'Keys:', Object.keys(reports));
  
  // If reports is an array (Lite Screen with no reports yet)
  if (Array.isArray(reports)) {
    // Check if array has items - if so, it's a different structure we need to handle
    if (reports.length > 0) {
      // TODO: Handle array of report objects if Thirdfort ever returns this structure
      console.warn('⚠️ Reports returned as non-empty array - unexpected structure:', reports);
    }
    
    // Return with empty data structure - reports not ready yet
    // NOTE: Use empty object/array instead of null/undefined so Wix Data preserves them
    return {
      taskOutcomes: {},
      considerReasons: [],
      piiData,
      hasAlerts: false
    };
  }
  
  for (const [reportType, reportData] of Object.entries(reports)) {
    const outcome = reportData.result || 'unknown';
    const status = reportData.status || 'unknown';
    console.log(`&#xD83D;&#xDCDD; Processing report: ${reportType} - ${outcome} (${status})`);
    
    taskOutcomes[reportType] = {
      result: outcome,
      status: status,
      data: reportData.data || {}
    };
    
    // Build CONSIDER reasons based on outcomes (exclude unobtainable)
    if ((outcome === 'alert' || outcome === 'fail' || outcome === 'review') && status !== 'unobtainable') {
      if (reportType === 'peps') {
        considerReasons.push('PEP hits');
        if (reportData.data?.total_hits) {
          taskOutcomes[reportType].total_hits = reportData.data.total_hits;
        }
      } else if (reportType === 'identity') {
        considerReasons.push('document integrity');
      } else if (reportType === 'facial_similarity') {
        considerReasons.push('facial similarity');
        if (reportData.data?.comparison) {
          taskOutcomes[reportType].comparison = reportData.data.comparison;
        }
      } else if (reportType === 'address') {
        considerReasons.push('address verification');
        if (reportData.data?.quality) {
          taskOutcomes[reportType].quality = reportData.data.quality;
        }
      } else if (reportType === 'document') {
        considerReasons.push('document authenticity');
        if (reportData.data?.authenticity) {
          taskOutcomes[reportType].authenticity = reportData.data.authenticity;
        }
      }
    }
  }
  
  console.log('&#x2705; Parsing complete. TaskOutcomes keys:', Object.keys(taskOutcomes), 'Consider reasons:', considerReasons.length);
  
  return {
    taskOutcomes,
    considerReasons,
    piiData,
    hasAlerts: considerReasons.length > 0
  };
}

/**
 * Fetch individual transaction report details
 * 
 * @param {string} transactionId - Transaction ID
 * @param {string} reportId - Report ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function fetchTransactionReport(transactionId, reportId, options = {}) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const token = options.jwt || await generateThirdfortJWT();
      if (!token) {
        console.error('&#x274C; Failed to generate JWT');
        return { success: false, error: 'Failed to generate JWT' };
      }
      
      const baseUrl = await getThirdfortAPIUrl();
      
      const response = await axios.get(`${baseUrl}/transactions/${transactionId}/reports/${reportId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      console.log(`&#x2705; Transaction report ${reportId} fetched successfully`);
      return { success: true, data: response.data };
      
    } catch (error) {
      const status = error?.response?.status;
      const shouldRetry = attempt < maxAttempts && status && (status >= 500 || status === 429);
      console.error(`&#x274C; Error fetching transaction report ${reportId} (attempt ${attempt}/${maxAttempts}):`, error.message || error, status ? `status=${status}` : '');
      
      if (!shouldRetry) {
        return { success: false, error: error.message };
      }
      
      const backoffMs = 500 * attempt;
      console.log(`&#x23F3; Retrying report ${reportId} after ${backoffMs}ms due to status ${status}...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }
}

/**
 * Fetch all reports for a transaction and populate full details
 * 
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<object>} Object with reports map, considerReasons, and hasAlerts
 */
export async function fetchAllTransactionReports(transactionId, options = {}) {
  const reportDetails = {};
  const considerReasons = [];
  
  try {
    const token = options.jwt || await generateThirdfortJWT();
    if (!token) {
      console.error('&#x274C; Failed to generate JWT');
      return { reports: {}, considerReasons: [], hasAlerts: false };
    }
    
    const baseUrl = await getThirdfortAPIUrl();
    
    // First, fetch the list of reports
    const reportsListResponse = await axios.get(`${baseUrl}/transactions/${transactionId}/reports`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    const reportsList = reportsListResponse.data || [];
    console.log(`&#xD83D;&#xDCCB; Found ${reportsList.length} report(s) for transaction ${transactionId}`);
    
    if (reportsList.length === 0) {
      return { reports: {}, considerReasons: [], hasAlerts: false };
    }
    
    // Extract report IDs
    const reportIds = reportsList.map(r => r.id);
    
    // Fetch all reports in parallel
    const fetchPromises = reportIds.map(reportId =>
      fetchTransactionReport(transactionId, reportId, { jwt: token })
    );
    const results = await Promise.all(fetchPromises);
    
    // Process results and map by type
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.success && result.data) {
        const reportData = result.data;
        const reportType = reportData.type;
        
        reportDetails[reportType] = {
          id: reportData.id,
          result: reportData.result || 'unknown',
          status: reportData.status || 'unknown',
          breakdown: reportData.breakdown || {},
          documents: reportData.documents || [],
          data: reportData.data || {},
          createdAt: reportData.metadata?.created_at
        };
        
        if (reportType === 'identity') {
          try {
            const preview = JSON.stringify(reportData, null, 2);
            console.log('&#xD83E;&#xDDFE; Full identity report JSON preview:', preview);
          } catch (stringifyError) {
            console.warn('⚠️ Unable to stringify identity report for logging:', stringifyError?.message);
          }
        }
        
        // Build consider reasons based on results (exclude unobtainable reports)
        if ((reportData.result === 'consider' || reportData.result === 'fail' || reportData.result === 'alert') && reportData.status !== 'unobtainable') {
          if (reportType === 'peps' || reportType === 'screening:lite') {
            considerReasons.push('PEP hits');
            if (reportData.data?.total_hits) {
              reportDetails[reportType].total_hits = reportData.data.total_hits;
            }
          } else if (reportType === 'identity') {
            considerReasons.push('document integrity');
          } else if (reportType === 'address') {
            considerReasons.push('address verification');
          } else if (reportType === 'footprint') {
            considerReasons.push('digital footprint');
          }
        }
      }
    }
    
    return {
      reports: reportDetails,
      considerReasons,
      hasAlerts: considerReasons.length > 0
    };
    
  } catch (error) {
    console.error('&#x274C; Error fetching transaction reports:', error);
    return { reports: {}, considerReasons: [], hasAlerts: false };
  }
}

/**
 * Fetch individual check report details
 * 
 * @param {string} checkId - Check ID
 * @param {string} reportId - Report ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function fetchCheckReport(checkId, reportId, options = {}) {
  try {
    const token = options.jwt || await generateThirdfortJWT();
    if (!token) {
      console.error('&#x274C; Failed to generate JWT');
      return { success: false, error: 'Failed to generate JWT' };
    }
    
    const baseUrl = await getThirdfortAPIUrl();
    
    const response = await axios.get(`${baseUrl}/checks/${checkId}/reports/${reportId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`&#x2705; Check report ${reportId} fetched successfully`);
    return { success: true, data: response.data };
    
  } catch (error) {
    console.error(`&#x274C; Error fetching check report ${reportId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all reports for a check and populate full details
 * 
 * @param {string} checkId - Check ID
 * @param {string[]} reportIds - Array of report IDs
 * @returns {Promise<object>} Map of report type to report details
 */
export async function fetchAllCheckReports(checkId, reportIds, options = {}) {
  const reportDetails = {};
  const considerReasons = [];
  
  // Fetch all reports in parallel
  const fetchPromises = reportIds.map(reportId =>
    fetchCheckReport(checkId, reportId, { jwt: options.jwt })
  );
  const results = await Promise.all(fetchPromises);
  
  // Process results and map by type
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.success && result.data) {
      const reportData = result.data;
      const reportType = reportData.type;
      
      reportDetails[reportType] = {
        id: reportData.id,
        result: reportData.result || 'unknown',
        status: reportData.status || 'unknown',
        breakdown: reportData.breakdown || {},
        documents: reportData.documents || [],
        data: reportData.data || {},
        createdAt: reportData.metadata?.created_at
      };
      
      // Build consider reasons based on results (exclude unobtainable reports)
      if (reportData.result === 'consider' && reportData.status !== 'unobtainable') {
        if (reportType === 'company:sanctions') {
          considerReasons.push('sanctions hits');
        } else if (reportType === 'company:beneficial-check') {
          considerReasons.push('beneficial ownership issues');
        } else if (reportType === 'company:ubo') {
          considerReasons.push('UBO concerns');
        } else if (reportType.includes('peps')) {
          considerReasons.push('PEP hits');
        }
      }
    }
  }
  
  return {
    reports: reportDetails,
    considerReasons,
    hasAlerts: considerReasons.length > 0
  };
}

/**
 * Parse check summary data into structured task outcomes
 * Extracts key data points for KYB check storage
 * Note: Checks API returns full check object, not summary endpoint
 * 
 * @param {object} checkData - Full check object from API
 * @param {boolean} includeReportDetails - Whether to fetch full report details
 * @returns {Promise<object>} Parsed check data
 */
export async function parseCheckSummary(checkData, includeReportDetails = false, options = {}) {
  let considerReasons = [];
  let detailedReports = {};
  
  // Parse company data from request.data
  const companyData = {
    id: checkData.request?.data?.id,
    name: checkData.request?.data?.name,
    number: checkData.request?.data?.number,
    jurisdiction: checkData.request?.data?.jurisdiction,
    numbers: checkData.request?.data?.numbers || []
  };
  
  // If requested, fetch full report details
  if (includeReportDetails && checkData.reports && checkData.reports.length > 0) {
    console.log(`&#xD83D;&#xDCCB; Fetching ${checkData.reports.length} report(s) for check ${checkData.id}...`);
    const reportsResult = await fetchAllCheckReports(checkData.id, checkData.reports, { jwt: options.jwt });
    detailedReports = reportsResult.reports;
    considerReasons = reportsResult.considerReasons;
  }
  
  // Parse report statuses from metadata.reports
  const reportStatuses = checkData.metadata?.reports || {};
  
  // Parse requested reports from request.reports
  const requestedReports = checkData.request?.reports || [];
  const taskOutcomes = {};
  
  for (const reportConfig of requestedReports) {
    const reportType = reportConfig.type;
    const reportStatus = reportStatuses[reportType];
    
    // If we have detailed report data, use that
    if (detailedReports[reportType]) {
      taskOutcomes[reportType] = detailedReports[reportType];
    } else if (reportStatus) {
      // Otherwise use basic status from metadata
      taskOutcomes[reportType] = {
        status: reportStatus.status || 'unknown',
        completedAt: reportStatus.completed_at,
      };
    } else {
      taskOutcomes[reportType] = {
        status: 'pending',
      };
    }
  }
  
  return {
    // Basic check info
    id: checkData.id,
    ref: checkData.ref,
    status: checkData.status,
    type: checkData.type,
    
    // Parsed company data
    companyData,
    
    // Report outcomes (detailed if fetched, basic status otherwise)
    taskOutcomes,
    reportIds: checkData.reports || [],
    
    // Timestamps
    createdAt: checkData.metadata?.created_at,
    updatedAt: checkData.metadata?.updated_at,
    completedAt: checkData.metadata?.completed_at,
    closedAt: checkData.metadata?.closed_at,
    
    // Consider reasons (populated if report details were fetched)
    considerReasons,
    hasAlerts: considerReasons.length > 0,
    
    // Full metadata for reference
    metadata: checkData.metadata
  };
}
