// =====================================================================
// THIRDFORT ADMIN - Tenant and User Management
// =====================================================================
// File location: backend/thirdfort/thirdfort-admin.web.js
// Admin functions for managing tenants, users, and teams
// =====================================================================

import { Permissions, webMethod } from 'wix-web-module';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { generateThirdfortJWT, getThirdfortAPIUrl } from 'backend/thirdfort/generate-jwt.js';
import { fetchTransactionSummary, fetchCheckSummary, parseCheckSummary, parseTransactionSummary, fetchAllCheckReports, fetchAllTransactionReports } from 'backend/thirdfort/webhook/helpers/summary-helpers.web.js';
import { downloadAndSaveTransactionPDF, downloadAndSaveCheckPDF } from 'backend/thirdfort/webhook/pdf-download-helper.web.js';
import { captureIdentityImages } from 'backend/thirdfort/webhook/helpers/identity-images.web.js';
import { saveEntryWithLogs } from 'backend/thirdfort/webhook/helpers/entry-saver.web.js';
import { generateRedFlags } from 'backend/thirdfort/webhook/helpers/red-flags-generator.web.js';
import { auth } from '@wix/essentials';
import axios from 'axios';
import { customTrigger } from '@wix/automations';
import wixData from 'wix-data';

// =====================================================================
// TENANT MANAGEMENT
// =====================================================================

/**
 * Get all tenants for your account
 * Use this to find your existing tenant ID
 */
export const getTenants = webMethod(
  Permissions.Admin,
  async () => {
    try {
      console.log('🔍 Retrieving all tenants...');
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/tenants`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        }
      });
      
      const tenants = await response.json();
      
      console.log('✅ Tenants retrieved:', tenants.length);
      tenants.forEach(tenant => {
        console.log(`  - ${tenant.name} (ID: ${tenant.id})`);
      });
      
      return {
        success: true,
        tenants: tenants,
        message: `Found ${tenants.length} tenant(s)`
      };
      
    } catch (error) {
      console.error('❌ Error retrieving tenants:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Create a new tenant for your company
 * Use this if you don't have a tenant yet
 */
export const createTenant = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('🏢 Creating new tenant...');
      console.log('📋 Tenant name:', params.tenantName);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/tenants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: params.tenantName
        })
      });
      
      const tenant = await response.json();
      
      if (response.status === 201) {
        console.log('✅ Tenant created successfully!');
        console.log(`  - Name: ${tenant.name}`);
        console.log(`  - ID: ${tenant.id}`);
        console.log(`  - Created: ${tenant.metadata.created_at}`);
        
        return {
          success: true,
          tenant: tenant,
          message: `Tenant "${tenant.name}" created with ID: ${tenant.id}`,
          // IMPORTANT: Add this ID to your THIRDFORT_TENANT_ID secret!
          tenantId: tenant.id
        };
      } else {
        console.error('❌ Failed to create tenant:', tenant);
        return { success: false, error: tenant.message || `HTTP ${response.status}` };
      }
      
    } catch (error) {
      console.error('❌ Error creating tenant:', error);
      return { success: false, error: error.message };
    }
  }
);

// =====================================================================
// USER MANAGEMENT
// =====================================================================

/**
 * Get all users for a specific tenant
 */
export const getUsers = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('👥 Retrieving users for tenant...');
      console.log('📋 Tenant ID:', params.tenantId);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'tenant-id': params.tenantId
        }
      });
      
      const users = await response.json();
      
      console.log('✅ Users retrieved:', users.length);
      users.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ID: ${user.id}`);
      });
      
      return {
        success: true,
        users: users,
        message: `Found ${users.length} user(s)`
      };
      
    } catch (error) {
      console.error('❌ Error retrieving users:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Create a new user under a tenant
 */
export const createUser = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('👤 Creating new user...');
      console.log('📋 Tenant ID:', params.tenantId);
      console.log('👤 User name:', params.userName);
      console.log('📧 User email:', params.userEmail);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'tenant-id': params.tenantId
        },
        body: JSON.stringify({
          type: 'stub',
          name: params.userName,
          email: params.userEmail,
          roles: params.roles || ['app:web', 'transactions:user', 'checks:user']
        })
      });
      
      const user = await response.json();
      
      if (response.status === 201) {
        console.log('✅ User created successfully!');
        console.log(`  - Name: ${user.name}`);
        console.log(`  - Email: ${user.email}`);
        console.log(`  - ID: ${user.id}`);
        console.log(`  - Roles: ${user.roles.join(', ')}`);
        
        return {
          success: true,
          user: user,
          message: `User "${user.name}" created with ID: ${user.id}`,
          userId: user.id
        };
      } else {
        console.error('❌ Failed to create user:', user);
        return { success: false, error: user.message || `HTTP ${response.status}` };
      }
      
    } catch (error) {
      console.error('❌ Error creating user:', error);
      return { success: false, error: error.message };
    }
  }
);

// =====================================================================
// TEAM MANAGEMENT
// =====================================================================

/**
 * Get all teams for a tenant
 */
export const getTeams = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('👥 Retrieving teams for tenant...');
      console.log('📋 Tenant ID:', params.tenantId);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/teams`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'tenant-id': params.tenantId
        }
      });
      
      const teams = await response.json();
      
      console.log('✅ Teams retrieved:', teams.length);
      teams.forEach(team => {
        console.log(`  - ${team.name} (ID: ${team.id})`);
      });
      
      return {
        success: true,
        teams: teams,
        message: `Found ${teams.length} team(s)`
      };
      
    } catch (error) {
      console.error('❌ Error retrieving teams:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Create a new team under a tenant
 */
export const createTeam = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('👥 Creating new team...');
      console.log('📋 Tenant ID:', params.tenantId);
      console.log('👥 Team name:', params.teamName);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/teams`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'tenant-id': params.tenantId
        },
        body: JSON.stringify({
          name: params.teamName
        })
      });
      
      const team = await response.json();
      
      if (response.status === 201) {
        console.log('✅ Team created successfully!');
        console.log(`  - Name: ${team.name}`);
        console.log(`  - ID: ${team.id}`);
        
        return {
          success: true,
          team: team,
          message: `Team "${team.name}" created with ID: ${team.id}`,
          teamId: team.id
        };
      } else {
        console.error('❌ Failed to create team:', team);
        return { success: false, error: team.message || `HTTP ${response.status}` };
      }
      
    } catch (error) {
      console.error('❌ Error creating team:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Add a user to a team by updating the user record
 */
export const addUserToTeam = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('👥 Adding user to team by updating user record...');
      console.log('📋 Team ID:', params.teamId);
      console.log('👤 User ID:', params.userId);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      // Get tenant ID from the team (we need to pass tenant-id header)
      const tenantId = await getSecret('THIRDFORT_TENANT_ID');
      
      // Since this is the first time, just add the team directly
      const updatedTeams = [params.teamId];
      
      const requestBody = {
        teams: updatedTeams
      };
      console.log('📤 Request body:', requestBody);
      
      // Update the user with the new team
      const response = await fetch(`${apiUrl}/users/${params.userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'tenant-id': tenantId
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response headers:', response.headers);
      
      if (response.status === 200 || response.status === 204) {
        console.log('✅ User updated with team successfully!');
        
        return {
          success: true,
          message: `User ${params.userId} added to team ${params.teamId}`,
          updatedTeams: updatedTeams
        };
      } else {
        // Get the response text first (before any JSON parsing)
        let errorMessage;
        try {
          const textResponse = await response.text();
          console.log('📥 Response text:', textResponse);
          
          // Try to parse as JSON if it looks like JSON
          if (textResponse.trim().startsWith('{') || textResponse.trim().startsWith('[')) {
            const error = JSON.parse(textResponse);
            errorMessage = error.message || error.error || `HTTP ${response.status}`;
          } else {
            errorMessage = textResponse || `HTTP ${response.status}`;
          }
        } catch (parseError) {
          errorMessage = `HTTP ${response.status} - Unable to parse response`;
        }
        
        console.error('❌ Failed to add user to team:', errorMessage);
        return { success: false, error: errorMessage };
      }
      
    } catch (error) {
      console.error('❌ Error adding user to team:', error);
      return { success: false, error: error.message };
    }
  }
);

// =====================================================================
// QUICK SETUP FUNCTIONS
// =====================================================================

/**
 * Complete setup: Create tenant, team, and initial users
 * Use this for initial setup
 */
export const completeSetup = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('🚀 Starting complete Thirdfort setup...');
      
      const results = {
        tenant: null,
        team: null,
        users: [],
        errors: []
      };
      
      // Step 1: Create tenant
      console.log('📋 Step 1: Creating tenant...');
      const tenantResult = await createTenant({ tenantName: params.tenantName });
      if (tenantResult.success) {
        results.tenant = tenantResult.tenant;
        console.log('✅ Tenant created:', tenantResult.tenantId);
      } else {
        results.errors.push(`Tenant creation failed: ${tenantResult.error}`);
        return { success: false, results: results };
      }
      
      // Step 2: Create team (optional)
      if (params.createTeam) {
        console.log('📋 Step 2: Creating team...');
        const teamResult = await createTeam({ 
          tenantId: tenantResult.tenantId, 
          teamName: params.teamName 
        });
        if (teamResult.success) {
          results.team = teamResult.team;
          console.log('✅ Team created:', teamResult.teamId);
        } else {
          results.errors.push(`Team creation failed: ${teamResult.error}`);
        }
      }
      
      // Step 3: Create users
      console.log('📋 Step 3: Creating users...');
      for (const user of params.users) {
        const userResult = await createUser({
          tenantId: tenantResult.tenantId,
          userName: user.name,
          userEmail: user.email,
          roles: user.roles || ['app:web', 'transactions:user', 'checks:user']
        });
        
        if (userResult.success) {
          results.users.push(userResult.user);
          console.log('✅ User created:', userResult.userId);
          
          // Add user to team if team was created
          if (results.team) {
            await addUserToTeam({
              teamId: results.team.id,
              userId: userResult.userId
            });
          }
        } else {
          results.errors.push(`User creation failed for ${user.name}: ${userResult.error}`);
        }
      }
      
      console.log('🎉 Setup complete!');
      console.log('📋 Summary:');
      console.log(`  - Tenant: ${results.tenant.name} (${results.tenant.id})`);
      if (results.team) console.log(`  - Team: ${results.team.name} (${results.team.id})`);
      console.log(`  - Users: ${results.users.length}`);
      console.log(`  - Errors: ${results.errors.length}`);
      
      return {
        success: true,
        results: results,
        message: 'Setup completed successfully!',
        // IMPORTANT: Add these IDs to your secrets!
        tenantId: results.tenant.id,
        teamId: results.team?.id,
        userIds: results.users.map(u => u.id)
      };
      
    } catch (error) {
      console.error('❌ Setup error:', error);
      return { success: false, error: error.message };
    }
  }
);

// =====================================================================
// SUMMARY API CALLS
// =====================================================================

/**
 * Get transaction summary for a given transaction ID
 * Returns clean, structured data with key outcomes instead of full details
 */
export const getTransactionSummary = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('📋 Fetching transaction summary...');
      console.log('📋 Transaction ID:', params.transactionId);
      
      const result = await fetchTransactionSummary(params.transactionId);
      
      if (result.success) {
        console.log('✅ Transaction summary fetched successfully');
        return {
          success: true,
          summary: result.data,
          message: 'Transaction summary retrieved successfully'
        };
      } else {
        console.error('❌ Failed to fetch transaction summary:', result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error('❌ Error fetching transaction summary:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Get FULL transaction object for debugging
 * Returns complete transaction data including request, metadata, reports, errors
 * 
 * @param {object} params
 * @param {string} params.transactionId - Transaction ID to fetch
 * @returns {object} { success: boolean, transaction?: object, error?: string }
 */
export const getFullTransaction = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('📋 Fetching FULL transaction object...');
      console.log('📋 Transaction ID:', params.transactionId);
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      
      const response = await fetch(`${apiUrl}/transactions/${params.transactionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API error:', response.status, errorText);
        return { 
          success: false, 
          error: `API error (${response.status}): ${errorText}` 
        };
      }
      
      const transaction = await response.json();
      
      console.log('✅ Full transaction fetched successfully');
      console.log('📊 Status:', transaction.status);
      console.log('📊 Type:', transaction.type);
      console.log('📊 Reports count:', transaction.reports?.length || 0);
      console.log('📊 Metadata reports:', transaction.metadata?.reports ? Object.keys(transaction.metadata.reports) : 'none');
      
      return {
        success: true,
        transaction: transaction,
        message: 'Full transaction retrieved successfully'
      };
      
    } catch (error) {
      console.error('❌ Error fetching full transaction:', error);
      return { success: false, error: error.message };
    }
  }
);

/**
 * Get check summary for a given check ID
 * Returns clean, structured data with key outcomes for KYB checks
 * 
 * @param {object} params
 * @param {string} params.checkId - Check ID to fetch
 * @param {boolean} params.includeReportDetails - Whether to fetch full report details (default: false)
 */
export const getCheckSummary = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('📋 Fetching check...');
      console.log('📋 Check ID:', params.checkId);
      console.log('📋 Include report details:', params.includeReportDetails || false);
      
      const result = await fetchCheckSummary(params.checkId);
      
      if (result.success) {
        console.log('✅ Check fetched successfully');
        
        // Parse the check data to extract structured information
        const includeDetails = params.includeReportDetails || false;
        const parsedData = await parseCheckSummary(result.data, includeDetails);
        
        console.log('✅ Check summary parsed successfully');
        return {
          success: true,
          summary: parsedData,
          raw: result.data, // Include raw data for reference
          message: 'Check summary retrieved successfully'
        };
      } else {
        console.error('❌ Failed to fetch check:', result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error('❌ Error fetching check summary:', error);
      return { success: false, error: error.message };
    }
  }
);

// =====================================================================
// REFRESH/SYNC FUNCTIONS
// =====================================================================

/**
 * Refresh all Thirdfort checks on an entry from API
 * Fetches current status, outcomes, and downloads any missing PDFs
 * 
 * This function mimics the webhook behavior by:
 * - Fetching latest data from Thirdfort API for all checks
 * - Updating check status, taskOutcomes, companyData/piiData
 * - Downloading missing PDFs to S3
 * - Updating entry-level fields: pepStatus, riskIndicator, checkReturned, feUpdate
 * - Adding appropriate logs (cashier, audit, chat) with CLEAR/CONSIDER outcomes
 * - Sending email notifications for CONSIDER cases
 * - Adding entries to check.updates array for audit trail
 * 
 * @param {object} params
 * @param {string} params.entryId - OutstandingID entry _id
 * @param {boolean} params.downloadPDFs - Whether to download missing PDFs (default: true)
 * @param {boolean} params.includeReportDetails - Whether to fetch full report details for KYB checks (default: false)
 * @param {boolean} params.sendEmailAlerts - Whether to send email notifications for CONSIDER cases (default: true)
 * 
 * @returns {object} {
 *   success: boolean,
 *   entryId: string,
 *   totalChecks: number,
 *   updatedCount: number,
 *   hasAlerts: boolean,
 *   alertMessages: string[],
 *   results: array,
 *   message: string
 * }
 */
export const refreshEntryChecks = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('🔄 Refreshing entry checks...');
      console.log('📋 Entry ID:', params.entryId);
      
      // Fetch entry from database (consistent read to ensure latest data)
      const entry = await wixData.get('OutstandingID', params.entryId, { suppressAuth: true, consistentRead: true });
      
      if (!entry) {
        return { success: false, error: 'Entry not found' };
      }
      
      if (!entry.thirdfortChecks || entry.thirdfortChecks.length === 0) {
        return { success: true, message: 'No Thirdfort checks found on this entry', updated: 0 };
      }
      
      console.log(`📊 Found ${entry.thirdfortChecks.length} check(s) to refresh`);
      
      let updatedCount = 0;
      const results = [];
      let needsEntryLevelUpdate = false;
      let hasAnyAlerts = false;
      let alertMessages = [];
      
      // Process each check
      for (let i = 0; i < entry.thirdfortChecks.length; i++) {
        const check = entry.thirdfortChecks[i];
        const checkResult = {
          checkId: check.transactionId || check.checkId,
          checkType: check.checkType,
          updated: false,
          error: null
        };
        
        try {
          console.log(`\n📋 Processing ${check.checkType} check: ${checkResult.checkId}`);
          
          // Determine if this is a transaction or KYB check
          if (check.transactionId) {
            // TRANSACTION: Use transaction summary
            const summaryResult = await fetchTransactionSummary(check.transactionId);
            
            if (summaryResult.success) {
              console.log('📊 Raw summary data:', JSON.stringify(summaryResult.data));
              const parsedData = await parseTransactionSummary(summaryResult.data);
              console.log('📊 Parsed data type:', typeof parsedData);
              console.log('📊 Parsed data keys:', parsedData ? Object.keys(parsedData) : 'null');
              console.log('📊 Parsed data.taskOutcomes:', parsedData?.taskOutcomes);
              console.log('📊 Parsed data.taskOutcomes keys:', parsedData?.taskOutcomes ? Object.keys(parsedData.taskOutcomes) : 'none');
              console.log('📊 Parsed data JSON:', JSON.stringify(parsedData));

              let taskOutcomes = parsedData.taskOutcomes || {};
              let considerReasons = parsedData.considerReasons || [];
              let parsedHasAlerts = parsedData.hasAlerts || false;

              const requestTasks = summaryResult.data?.request?.tasks || [];
              const normalizeTask = (task) => {
                if (!task) return '';
                if (typeof task === 'string') return task;
                if (typeof task === 'object') return task.type || '';
                return '';
              };
              const combinedTasks = [
                ...(check.tasks || []).map(normalizeTask),
                ...requestTasks.map(normalizeTask)
              ];
              const hasIdentityTask = combinedTasks.some(
                (task) => task && (task.includes('identity') || task.includes('nfc'))
              );
              const shouldFetchIdentityDocs = hasIdentityTask && (!check.selfieS3Key || !check.faceImageS3Key);

              if (shouldFetchIdentityDocs) {
                console.log('📷 Missing identity images detected, fetching full transaction reports for documents...');
                const reportsData = await fetchAllTransactionReports(check.transactionId);
                if (reportsData?.reports && Object.keys(reportsData.reports).length > 0) {
                  taskOutcomes = { ...taskOutcomes, ...reportsData.reports };
                  considerReasons = [
                    ...new Set([...(considerReasons || []), ...(reportsData.considerReasons || [])])
                  ];
                  parsedHasAlerts = parsedHasAlerts || reportsData.hasAlerts || false;
                } else {
                  console.log('⚠️ No reports returned while attempting to fetch identity documents');
                }
              }
              
              // Update check data (use || {} to ensure we always set an object, never undefined)
              check.status = summaryResult.data.status || check.status;
              check.taskOutcomes = taskOutcomes;
              check.piiData = parsedData.piiData || {};
              check.hasAlerts = parsedHasAlerts;
              check.considerReasons = (considerReasons && considerReasons.length > 0) 
                ? considerReasons 
                : undefined;  // Don't store empty arrays - use undefined instead

              // Re-run red flag generation if SoF data exists but red flags missing
              const hasSoFTask =
                !!(check.taskOutcomes['sof:v1']) ||
                (summaryResult.data?.request?.tasks || []).some((task) => {
                  const taskType = typeof task === 'string' ? task : task.type;
                  return taskType === 'report:sof-v1';
                });

              if (hasSoFTask && (!Array.isArray(check.redFlags) || check.redFlags.length === 0)) {
                const regeneratedFlags = generateRedFlags(check.taskOutcomes || {});
                if (Array.isArray(regeneratedFlags) && regeneratedFlags.length > 0) {
                  check.redFlags = regeneratedFlags;
                  if (!check.updates) check.updates = [];
                  check.updates.push({
                    timestamp: new Date().toISOString(),
                    update: `Regenerated ${regeneratedFlags.length} Source of Funds red flag(s)`
                  });
                  console.log(`✅ Regenerated ${regeneratedFlags.length} SoF red flag(s) for ${checkResult.checkId}`);
                }
              }
              
              console.log('✅ Check updated with taskOutcomes:', Object.keys(check.taskOutcomes || {}).join(', '));
              console.log('✅ check.taskOutcomes:', check.taskOutcomes);

              await syncIdentityImagesForCheck(check, entry);
              
              // Track if we need to update entry-level fields
              if (parsedHasAlerts) {
                hasAnyAlerts = true;
                if (considerReasons?.length) {
                  alertMessages.push(...considerReasons);
                }
              }
              
              // Add to updates array
              if (!check.updates) check.updates = [];
              check.updates.push({
                timestamp: new Date().toISOString(),
                update: `Refreshed from Thirdfort API - Status: ${check.status}`
              });
              
              // Download consolidated PDF only when transaction is CLOSED
              if (
                params.downloadPDFs !== false &&
                !check.pdfReady &&
                (summaryResult.data.status === 'closed')
              ) {
                console.log('📥 Downloading missing PDF...');
                const pdfResult = await downloadAndSaveTransactionPDF(check.transactionId, entry);
                if (pdfResult.success) {
                  check.pdfReady = true;
                  check.pdfS3Key = pdfResult.s3Key;
                  check.pdfAddedAt = new Date().toISOString();
                  console.log('✅ PDF downloaded and saved');

                  // Add file object to idDocuments to mirror webhook behavior
                  const consumerName = check.consumerName || entry.name || 'Client';
                  
                  // Determine document label based on check type and reports
                  let docLabel = 'Electronic ID';
                  let docType = 'AML Check';
                  
                  if (check.checkType === 'electronic-id') {
                    // Check if transaction has identity verification tasks
                    const hasIdentityTask = check.tasks?.some(t => t.includes('identity') || t.includes('nfc'));
                    
                    if (!hasIdentityTask) {
                      // No identity verification - it's a Lite Screen
                      docLabel = 'Lite Screening';
                    } else {
                      // Has identity verification - check for Original vs Enhanced
                      try {
                        const jwt = await generateThirdfortJWT();
                        const baseUrl = await getThirdfortAPIUrl();
                        
                        const reportsResponse = await axios.get(
                          `${baseUrl}/transactions/${check.transactionId}/reports`,
                          {
                            headers: {
                              'Authorization': `Bearer ${jwt}`,
                              'Accept': 'application/json'
                            }
                          }
                        );
                        
                        const reports = reportsResponse.data || [];
                        const identityReport = reports.find(r => r.type === 'identity' && r.status === 'closed');
                        
                        if (identityReport) {
                          if (identityReport.breakdown?.document) {
                            docLabel = 'Original ID';
                          } else {
                            docLabel = 'Enhanced NFC ID';
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error determining ID type:', error);
                        docLabel = 'Electronic ID';
                      }
                    }
                  } else if (check.checkType === 'lite-screen') {
                    docLabel = 'Lite Screening';
                  } else if (check.checkType === 'idv') {
                    docLabel = 'IDV Check';
                    docType = 'Identity Verification';
                  }
                  const idDocument = {
                    name: `${entry.title}-${entry.clientNumber}-${entry.matterNumber} - ${consumerName} - ${docLabel}`,
                    document: docLabel,
                    data: {
                      type: 'application/pdf',
                      size: pdfResult.size,
                      name: `thirdfort-transaction-${check.transactionId}.pdf`,
                      lastModified: Date.now()
                    },
                    date: new Date().toLocaleString('en-GB', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    }),
                    uploader: 'Thirdfort API',
                    type: docType,
                    s3Key: pdfResult.s3Key,
                    thirdfortTransactionId: check.transactionId
                  };
                  entry.idDocuments = [idDocument, ...(entry.idDocuments || [])];
                }
              }
              
              check.updatedAt = new Date().toISOString();
              checkResult.updated = true;
              updatedCount++;
              
            } else {
              checkResult.error = `Failed to fetch transaction summary: ${summaryResult.error}`;
              console.error(`❌ ${checkResult.error}`);
            }
            
          } else if (check.checkId) {
            // KYB CHECK: Use check summary
            const summaryResult = await fetchCheckSummary(check.checkId);
            
            if (summaryResult.success) {
              const includeReportDetails = params.includeReportDetails || false;
              console.log('📊 Raw check data:', JSON.stringify(summaryResult.data));
              const parsedData = await parseCheckSummary(summaryResult.data, includeReportDetails);
              console.log('📊 Parsed check data:', JSON.stringify(parsedData));
              
              // Update check data (use || {} to ensure we always set an object, never undefined)
              check.status = summaryResult.data.status || check.status;
              check.taskOutcomes = parsedData.taskOutcomes || {};
              check.companyData = parsedData.companyData || {};
              check.hasAlerts = parsedData.hasAlerts || false;
              check.considerReasons = (parsedData.considerReasons && parsedData.considerReasons.length > 0) 
                ? parsedData.considerReasons 
                : undefined;  // Don't store empty arrays - use undefined instead
              
              console.log('✅ Check updated with taskOutcomes:', Object.keys(check.taskOutcomes || {}).join(', '));
              
              // Track if we need to update entry-level fields
              if (parsedData.hasAlerts) {
                hasAnyAlerts = true;
                alertMessages.push(...parsedData.considerReasons);
              }
              
              // Add to updates array
              if (!check.updates) check.updates = [];
              check.updates.push({
                timestamp: new Date().toISOString(),
                update: `Refreshed from Thirdfort API - Status: ${check.status}`
              });
              
              // Download consolidated PDF only when KYB check is CLOSED
              if (
                params.downloadPDFs !== false &&
                !check.pdfReady &&
                (summaryResult.data.status === 'closed')
              ) {
                console.log('📥 Downloading missing PDF...');
                const pdfResult = await downloadAndSaveCheckPDF(check.checkId, entry);
                if (pdfResult.success) {
                  check.pdfReady = true;
                  check.pdfS3Key = pdfResult.s3Key;
                  check.pdfAddedAt = new Date().toISOString();
                  console.log('✅ PDF downloaded and saved');

                  // Add file object to idDocuments to mirror webhook behavior
                  const companyName = check.companyName || entry.businessName || 'Business';
                  const idDocument = {
                    name: `${entry.title}-${entry.clientNumber}-${entry.matterNumber} - ${companyName} - Know Your Business (KYB)`,
                    document: 'Know Your Business (KYB)',
                    data: {
                      type: 'application/pdf',
                      size: pdfResult.size,
                      name: `thirdfort-kyb-${check.checkId}.pdf`,
                      lastModified: Date.now()
                    },
                    date: new Date().toLocaleString('en-GB', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    }),
                    uploader: 'Thirdfort API',
                    type: 'AML Check',
                    s3Key: pdfResult.s3Key,
                    thirdfortCheckId: check.checkId
                  };
                  entry.idDocuments = [idDocument, ...(entry.idDocuments || [])];
                }
              }
              
              check.updatedAt = new Date().toISOString();
              checkResult.updated = true;
              updatedCount++;
              
            } else {
              checkResult.error = `Failed to fetch check summary: ${summaryResult.error}`;
              console.error(`❌ ${checkResult.error}`);
            }
          }
          
        } catch (error) {
          checkResult.error = error.message;
          console.error(`❌ Error processing check ${checkResult.checkId}:`, error);
        }
        
        results.push(checkResult);
      }
      
      // ===== UPDATE ENTRY-LEVEL FIELDS (Like webhooks do) =====
      if (updatedCount > 0) {
        // Update pepStatus and riskIndicator based on alerts
        if (hasAnyAlerts) {
          // Check if we have PEP-related alerts
          const hasPEPAlerts = alertMessages.some(r => r.includes('PEP') || r.includes('peps'));
          
          if (hasPEPAlerts) {
            entry.pepStatus = ["PPEP"];
            entry.riskIndicator = true;
          } else {
            // Other alerts (sanctions, document issues, etc.)
            entry.riskIndicator = true;
          }
        } else {
          // No alerts - clear PEP status but keep riskIndicator as it may be set externally
          entry.pepStatus = undefined;
        }
        
        // Update entry.pepMonitoring based on ANY check with monitoring enabled
        const anyMonitoringEnabled = (entry.thirdfortChecks || []).some(c => {
          const outcomes = c.taskOutcomes || {};
          return Object.keys(outcomes).some(k => (
            (k.includes('peps') || k.includes('sanctions')) && outcomes[k]?.data?.monitored === true
          ));
        });
        entry.pepMonitoring = anyMonitoringEnabled ? true : undefined;

        // Mark check as returned if PDF is ready
        const hasPDFs = entry.thirdfortChecks.some(c => c.pdfReady);
        if (hasPDFs) {
          entry.checkReturned = true;
          entry.feUpdate = entry.feUpdate || [];
          if (!entry.feUpdate.includes("updatePep")) {
            entry.feUpdate.push("updatePep");
          }
        }
        
        // Determine overall status label for logs
        const hasAborted = (entry.thirdfortChecks || []).some(c => c.status === 'aborted');
        const hasOpen = (entry.thirdfortChecks || []).some(c => c.status !== 'closed' && c.status !== 'aborted');
        let statusLabel;
        if (hasAborted) {
          statusLabel = 'ABORTED';
        } else if (hasOpen) {
          statusLabel = 'OPEN';
        } else {
          statusLabel = hasAnyAlerts ? 'CONSIDER' : 'CLEAR';
        }
        const reasons = statusLabel === 'CONSIDER' && alertMessages.length > 0
          ? `: ${alertMessages.join(', ')}`
          : '';
        
        await saveEntryWithLogs(entry, {
          cashierMessage: `Thirdfort checks refreshed - ${statusLabel}${reasons}`,
          auditMessage: `Refreshed ${updatedCount} Thirdfort check(s) from API`,
          chatMessage: `All Thirdfort checks refreshed - ${statusLabel}${reasons}`,
          user: 'Admin Refresh'
        });
        
        // Send email only for closed + CONSIDER cases
        if (statusLabel === 'CONSIDER' && params.sendEmailAlerts !== false) {
          console.log('📧 Sending alert email notification...');
          
          const emailPayload = {
            type: 'Thirdfort Check Refresh - CONSIDER',
            name: entry.name,
            fe: entry.title,
            mat: entry.matterNumber,
            status: entry.status?.join(" ") || "Unknown",
            message: `Thirdfort checks refreshed - potential issues detected${reasons}`,
            cli: entry.clientNumber?.toString() || "",
            staff: "Admin Refresh",
            requestType: entry.feUpdate.join(", "),
            dateTime: new Date().toLocaleDateString()
          };
          
          const triggerId = 'da4ae94e-57da-494c-9b58-637d397fb458';
          
          try {
            const triggerMethod = auth.elevate(customTrigger.runTrigger);
            await triggerMethod({ triggerId, payload: emailPayload });
            console.log("✅ Email notification sent successfully");
          } catch (emailError) {
            console.error("❌ Failed to trigger automation:", emailError);
          }
        }
        
        console.log(`✅ Entry updated with ${updatedCount} refreshed check(s)`);
      } else {
        // Just save without logs if nothing changed
        entry.lastUpdated = new Date();
        await wixData.update('OutstandingID', entry, { suppressAuth: true });
      }
      
      return {
        success: true,
        entryId: params.entryId,
        totalChecks: entry.thirdfortChecks.length,
        updatedCount: updatedCount,
        hasAlerts: hasAnyAlerts,
        alertMessages: alertMessages,
        results: results,
        message: `Refreshed ${updatedCount} of ${entry.thirdfortChecks.length} check(s)${hasAnyAlerts ? ' - CONSIDER' : ' - CLEAR'}`
      };
      
    } catch (error) {
      console.error('❌ Error refreshing entry checks:', error);
      return { success: false, error: error.message };
    }
  }
);

async function syncIdentityImagesForCheck(check, entry) {
  try {
    if (!check?.transactionId) return;
    const documents = check?.taskOutcomes?.identity?.documents || [];
    if (!documents.length) return;

    console.log(`📷 syncIdentityImagesForCheck -> ${check.transactionId}: ${documents.length} identity document(s) available, starting download...`);

    const cachedKeys = {
      selfie: check.selfieS3Key,
      'face-image': check.faceImageS3Key
    };

    console.log('📦 Requesting identity image ZIP from Thirdfort (via captureIdentityImages)...');
    const { savedImages } = await captureIdentityImages({
      transactionId: check.transactionId,
      documents,
      cachedKeys
    });

    if (!Array.isArray(savedImages) || savedImages.length === 0) {
      console.log('⚠️ No new identity images were saved (already cached or download failed).');
      return;
    }

    console.log(`🖼️ Saved ${savedImages.length} identity image(s) to S3 for transaction ${check.transactionId}`);
    entry.idImages = entry.idImages || [];

    savedImages.forEach((image) => {
      const label = image.type === 'face-image' ? 'Passport Image' : 'Selfie';
      const keyProp = image.type === 'face-image' ? 'faceImageS3Key' : 'selfieS3Key';
      check[keyProp] = image.s3Key;

      const imageEntry = buildCheckImageEntry({
        entry,
        check,
        label,
        image
      });

      entry.idImages = [imageEntry, ...entry.idImages];
    });
  } catch (error) {
    console.error('❌ Error syncing identity images for check:', error);
  }
}

function buildCheckImageEntry({ entry, check, label, image }) {
  const timestamp = new Date();
  const mime = image.mime || 'image/jpeg';
  const safeLabel = label.replace(/\s+/g, '-').toLowerCase();
  const fileName = image.fileName || `${safeLabel}-${check.transactionId || 'image'}.jpg`;

  return {
    type: 'Check Images',
    name: label,
    document: label,
    side: 'Single',
    uploader: 'Thirdfort API',
    date: timestamp.toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }),
    data: {
      type: mime,
      size: image.size,
      name: fileName,
      lastModified: timestamp.getTime()
    },
    s3Key: image.s3Key,
    thirdfortTransactionId: image.thirdfortTransactionId || check.transactionId,
    thirdfortDocumentId: image.thirdfortDocumentId
  };
}

// =====================================================================
// FORCE CLOSE TRANSACTION
// =====================================================================

/**
 * Force close a transaction to trigger PDF generation
 * WARNING: This will close the transaction even if consumer hasn't completed all tasks
 * Use only when absolutely necessary (e.g., consumer unreachable, urgent deadline)
 * 
 * @param {object} params
 * @param {string} params.transactionId - Transaction ID to force close
 * @param {string} params.entryId - OutstandingID entry _id
 * @param {string} params.userEmail - Email of user performing the action
 * @returns {object} { success: boolean, transaction?: object, error?: string }
 */
export const forceCloseTransaction = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      console.log('🔒 Force closing transaction:', params.transactionId);
      console.log('👤 Requested by:', params.userEmail);
      console.log('📋 Entry ID:', params.entryId);
      
      // Step 1: Get entry to verify check exists
      const entry = await wixData.get('OutstandingID', params.entryId, {
        suppressAuth: true,
        consistentRead: true
      });
      
      if (!entry || !entry.thirdfortChecks) {
        return {
          success: false,
          error: 'Entry not found or has no checks'
        };
      }
      
      // Find check
      const checkIndex = entry.thirdfortChecks.findIndex(c => c.transactionId === params.transactionId);
      if (checkIndex === -1) {
        return {
          success: false,
          error: 'Transaction not found in entry'
        };
      }
      
      const currentStatus = entry.thirdfortChecks[checkIndex].status;
      console.log('📊 Current status:', currentStatus);
      
      if (currentStatus === 'closed') {
        console.log('⚠️ Transaction already closed');
        return {
          success: true,
          message: 'Transaction already closed',
          transaction: { status: 'closed' }
        };
      }
      
      // Step 2: PATCH transaction to closed status
      console.log('📡 Calling Thirdfort API to force close...');
      
      const jwt = await generateThirdfortJWT();
      const apiUrl = await getThirdfortAPIUrl();
      const endpoint = `${apiUrl}/transactions/${params.transactionId}`;
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'closed'
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Thirdfort API error:', response.status, errorText);
        
        return {
          success: false,
          error: `Failed to force close (${response.status}): ${errorText}`,
          message: 'Thirdfort may not allow forcing transactions closed. Try aborting instead.'
        };
      }
      
      const transaction = await response.json();
      console.log('✅ Transaction force closed:', transaction);
      
      // Step 3: Update check in entry
      entry.thirdfortChecks[checkIndex].status = 'closed';
      
      if (!entry.thirdfortChecks[checkIndex].updates) {
        entry.thirdfortChecks[checkIndex].updates = [];
      }
      
      entry.thirdfortChecks[checkIndex].updates.push({
        timestamp: new Date().toISOString(),
        update: `Transaction force closed by ${params.userEmail} - awaiting transaction:pdf webhook`
      });
      
      // Step 4: Save with logs (webhook will handle PDF download)
      await saveEntryWithLogs(entry, {
        cashierMessage: 'Transaction force closed - awaiting PDF webhook',
        auditMessage: 'Thirdfort transaction force closed',
        chatMessage: `Transaction force closed by ${params.userEmail} - PDF will arrive via webhook`,
        user: params.userEmail
      });
      
      console.log('✅ Transaction closed - waiting for transaction:pdf webhook to deliver PDF');
      
      return {
        success: true,
        transaction: transaction,
        message: 'Transaction force closed successfully - PDF will be delivered via webhook within a few minutes'
      };
      
    } catch (error) {
      console.error('❌ Error force closing transaction:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
);

// =====================================================================
// TRACKING DATA (Update this section with your actual IDs)
// =====================================================================

/*
=== THIRDFORT SETUP TRACKING ===

TENANT INFORMATION:
- Name: [Your Company Name]
- ID: [tenant_id_here]
- Created: [date]
- Status: Active

TEAM INFORMATION (if created):
- Name: [Team Name]
- ID: [team_id_here]
- Created: [date]
- Status: Active

USERS INFORMATION:
- User 1: [Name] ([email]) - ID: [user_id_here]
- User 2: [Name] ([email]) - ID: [user_id_here]
- User 3: [Name] ([email]) - ID: [user_id_here]

SECRETS TO ADD:
- THIRDFORT_TENANT_ID = [tenant_id_here]
- THIRDFORT_TEAM_ID = [team_id_here] (optional)

NEXT STEPS:
1. Run getTenants() to check existing tenants
2. If no tenant exists, run createTenant({ tenantName: "Your Company" })
3. Create users with createUser({ tenantId: "...", userName: "...", userEmail: "..." })
4. Add tenant ID to THIRDFORT_TENANT_ID secret
5. Test check creation with tenant-id and user-id headers

=== END TRACKING ===
*/
