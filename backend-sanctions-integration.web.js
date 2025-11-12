// backend-sanctions-integration.web.js
// Backend functions for UK Sanctions Checker integration
// Uses webMethod wrapper for frontend exposure

import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// Import Thirdfort helper for consistent logging
import { saveEntryWithLogs } from 'backend/thirdfort/webhook/helpers/entry-saver.web.js';

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

            // Save entry with logs using Thirdfort pattern
            await saveEntryWithLogs(collectionItem, {
                cashierMessage: 'UK Sanctions List Search report uploaded',
                auditMessage: 'UK Sanctions Search',
                chatMessage: `UK Sanctions List Search report uploaded by ${uploader}`
            });
            
            // Get the updated entry (saveEntryWithLogs returns the saved item)
            const updatedItem = await wixData.get('OutstandingID', entryId);
            
            // Build uploaded file object for request form validation
            const uploadedFile = {
                s3Key: fileObject.s3Key,
                liveUrl: `https://id-documents-london-prod.s3.eu-west-2.amazonaws.com/${fileObject.s3Key}`,
                date: fileObject.date,
                uploader: uploader,
                fileName: fileObject.data?.name || 'UK_Sanctions_Search.pdf',
                fileSize: fileObject.data?.size || 0
            };
            
            response.success = true;
            response.result = 'Entry updated successfully';
            response.updatedItem = updatedItem;
            response.uploadedFile = uploadedFile;  // Include file object for request form
            
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

