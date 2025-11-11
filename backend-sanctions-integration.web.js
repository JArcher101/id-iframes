// backend-sanctions-integration.web.js
// Backend functions for UK Sanctions Checker integration
// Uses webMethod wrapper for frontend exposure

import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Import your existing helper functions (adjust paths as needed)
import { appendCashierLog, appendAuditLog } from 'backend/id-system/in-person-verification/upload.web.js';

// ============================================================================
// UK SANCTIONS CHECKER FUNCTIONS
// ============================================================================

/**
 * Fetches UK Sanctions List XML from FCDO
 * Bypasses CORS restrictions by fetching from backend
 * 
 * Called when iframe loads or requests fresh data
 * 
 * @returns {Object} Response with XML string
 */
export const getSanctionsXML = webMethod(
    Permissions.SiteMember,
    async () => {
        let response = {
            success: false,
            result: undefined,
            error: undefined,
            xml: undefined
        };

        try {
            console.log('📥 Fetching UK Sanctions List XML from FCDO...');
            
            const fetchResponse = await fetch('https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml');
            
            if (!fetchResponse.ok) {
                throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
            }
            
            const xml = await fetchResponse.text();
            
            console.log(`✅ Fetched XML (${(xml.length / 1024 / 1024).toFixed(2)} MB)`);
            
            response.xml = xml;
            response.success = true;
            response.result = 'XML fetched successfully';
            
        } catch (error) {
            console.error('❌ Error fetching sanctions XML:', error);
            response.result = 'Error fetching sanctions XML';
            response.error = {
                error,
                errorMsg: error.message,
                stack: error.stack
            };
        }

        return response;
    }
);

/**
 * Updates client entry with uploaded sanctions PDF
 * Adds PDF to idDocuments array and creates audit log entry
 * 
 * @param {Object} fileObject - File object with s3Key
 * @param {String} entryId - Client entry ID
 * @param {String} uploader - Email of user uploading
 * @returns {Object} Response with updated item
 */
export const updateEntryWithSanctionsPDF = webMethod(
    Permissions.SiteMember,
    async (fileObject, entryId, uploader) => {
        let response = {
            success: false,
            result: undefined,
            error: undefined,
            updatedItem: undefined
        };

        try {
            console.log('💾 Updating entry with sanctions PDF:', entryId);
            
            // Get current entry
            let collectionItem;
            try {
                collectionItem = await wixData.get('OutstandingID', entryId);
            } catch (error) {
                response.result = 'Entry not found';
                response.error = {
                    error,
                    errorMsg: error.message,
                    stack: error.stack
                };
                return response;
            }

            // Add to idDocuments array
            const currentDocs = Array.isArray(collectionItem.idDocuments) ? 
                collectionItem.idDocuments : [];
            
            collectionItem.idDocuments = [fileObject, ...currentDocs];

            // Add cashier log entry
            const cashierLogResult = await appendCashierLog(
                collectionItem, 
                { 
                    user: uploader, 
                    time: new Date().toLocaleString(), 
                    message: 'UK Sanctions List Search report uploaded' 
                }
            );

            if (!cashierLogResult.success) {
                console.warn('⚠️ Failed to append cashier log:', cashierLogResult);
            } else {
                collectionItem.cashierLog = cashierLogResult.updatedLog;
            }

            // Add audit log entry
            try {
                const auditLogResult = await appendAuditLog(
                    collectionItem, 
                    'UK Sanctions Search', 
                    uploader
                );

                if (auditLogResult && auditLogResult.error) {
                    console.warn('⚠️ Error adding audit log:', auditLogResult.error);
                } else if (auditLogResult && auditLogResult.updatedAuditLog) {
                    collectionItem.auditLog = auditLogResult.updatedAuditLog;
                }
            } catch (auditError) {
                console.warn('⚠️ Error in appendAuditLog:', auditError);
            }

            // Update lastUpdated timestamp
            collectionItem.lastUpdated = new Date();

            // Update the collection item
            console.log('💾 Collection item before update:', collectionItem);
            const updatedItem = await wixData.update('OutstandingID', collectionItem);
            
            response.success = true;
            response.result = 'Entry updated successfully';
            response.updatedItem = updatedItem;
            
            console.log('✅ Entry updated with sanctions PDF');
            
        } catch (error) {
            console.error('❌ Error updating entry:', error);
            response.result = 'Error updating entry';
            response.error = {
                error,
                errorMsg: error.message,
                stack: error.stack
            };
        }

        return response;
    }
);

