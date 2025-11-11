// backend-sanctions-integration.web.js
// Backend functions for UK Sanctions Checker integration
// Uses webMethod wrapper for frontend exposure

import { fetch } from 'wix-fetch';
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Import your existing helper functions
import { s3, documentsBucketName, generateRandomBase62 } from './s3-helpers.web.js'; // Adjust path as needed
import { appendCashierLog, appendAuditLog } from './audit-helpers.web.js'; // Adjust path as needed

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
 * Generates presigned PUT URL for sanctions PDF upload
 * 
 * Follows document-viewer.html pattern for file uploads
 * Creates S3 key and presigned URL for direct upload from iframe
 * 
 * @param {Object} fileMetadata - File metadata from iframe
 * @param {String} entryId - Client entry ID
 * @returns {Object} Response with PUT URL and file object with s3Key
 */
export const generateSanctionsPutLink = webMethod(
    Permissions.SiteMember,
    async (fileMetadata, entryId) => {
        let response = {
            success: false,
            result: undefined,
            error: undefined,
            url: undefined,
            s3Key: undefined,
            fileWithS3Key: undefined
        };

        try {
            console.log('🔗 Generating S3 PUT link for sanctions PDF...');
            
            // Validate file type (PDF only)
            if (fileMetadata.data.type !== 'application/pdf' && 
                !fileMetadata.data.name.toLowerCase().endsWith('.pdf')) {
                response.result = 'Only PDF files allowed';
                response.error = {
                    error: new Error('Only PDF files allowed'),
                    errorMsg: 'Only PDF files allowed',
                    stack: 'File type validation failed'
                };
                return response;
            }

            // Validate file size (15 MB max)
            const MAX_SIZE = 15 * 1024 * 1024;
            if (fileMetadata.data.size > MAX_SIZE) {
                response.result = 'File too large (max 15MB)';
                response.error = {
                    error: new Error('File too large'),
                    errorMsg: 'File too large (max 15MB)',
                    stack: 'File size validation failed'
                };
                return response;
            }

            // Get documents bucket
            const bucket = await documentsBucketName();
            const client = await s3();

            // Generate unique S3 key using base62 random string
            const randomId = await generateRandomBase62(16);
            const s3Key = `protected/${randomId}`;

            // Generate presigned PUT URL (5 minute expiry)
            const cmd = new PutObjectCommand({
                Bucket: bucket,
                Key: s3Key,
                ContentType: 'application/pdf'
            });
            const putUrl = await getSignedUrl(client, cmd, { expiresIn: 300 });

            // Create complete file object with s3Key
            const fileWithS3Key = {
                type: fileMetadata.type,
                document: fileMetadata.document,
                uploader: fileMetadata.uploader,
                date: fileMetadata.date,
                s3Key: s3Key,
                data: fileMetadata.data
            };

            response.url = putUrl;
            response.s3Key = s3Key;
            response.fileWithS3Key = fileWithS3Key;
            response.success = true;
            response.result = 'PUT link generated successfully';
            
            console.log('✅ PUT link generated:', s3Key);
            
        } catch (error) {
            console.error('❌ Error generating PUT link:', error);
            response.result = 'Error generating PUT link';
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

