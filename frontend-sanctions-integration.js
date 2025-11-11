// frontend-sanctions-integration.js
// Frontend integration for UK Sanctions Checker iframe
// Add this code to your Wix frontend page

import { callWithTimeout } from 'public/functions/backend-timeout.js';
import wixWindowFrontend from 'wix-window-frontend';

// Import backend functions
import { getSanctionsXML, updateEntryWithSanctionsPDF } from 'backend/sanctions-integration.web.js';
import { generateFilePUTsBackend } from 'backend/id-system/in-person-verification/upload.web.js';

/**
 * Initialize sanctions checker iframe
 * Call this when opening the sanctions checker
 * 
 * @param {Object} context - Context data
 * @param {Object} context.clientData - Client information { fullName, yearOfBirth, etc }
 * @param {string} context.openEntryId - Entry ID if connected to a client
 * @param {Object} context.currentUser - Current user object { email }
 */
export async function initiateSanctionsChecker(context) {
    console.log('🚀 Initializing sanctions checker...', context);
    
    // Show loading overlay
    $w('#loadingSwirl-v2-lightbox').show();
    
    // Fetch XML from backend first
    let sanctionsRes;
    try {
        sanctionsRes = await callWithTimeout(getSanctionsXML());
        
        if (!sanctionsRes.success || !sanctionsRes.xml) {
            throw new Error(sanctionsRes.result || 'Failed to fetch sanctions data');
        }
    } catch (error) {
        console.error('❌ Failed to fetch sanctions XML:', error);
        $w('#sanctions-iframe').postMessage({
            type: 'sanctions-xml',
            error: error.message || 'Failed to fetch sanctions data'
        });
        $w('#loadingSwirl-v2-lightbox').hide();
        wixWindowFrontend.showNotification('Failed to load sanctions data', 'error');
        return;
    }
    
    // Send XML to iframe
    $w('#sanctions-iframe').postMessage({
        type: 'sanctions-xml',
        xml: sanctionsRes.xml
    });
    
    // Send initialization data if we have client context
    if (context.clientData || context.openEntryId) {
        $w('#sanctions-iframe').postMessage({
            type: 'init-sanctions-search',
            clientName: context.clientData?.fullName || '',
            yearOfBirth: context.clientData?.yearOfBirth || '',
            searchType: context.clientData?.entityType === 'company' ? 'entity' : 'individual',
            clientEntryId: context.openEntryId || null,
            userEmail: context.currentUser?.email || ''
        });
    }
    
    $w('#loadingSwirl-v2-lightbox').hide();
    console.log('✅ Sanctions checker initialized');
}

/**
 * Setup message listener for sanctions iframe
 * Call this in your page's $w.onReady()
 */
export function setupSanctionsMessageListener() {
    $w('#sanctions-iframe').onMessage(async (event) => {
        const message = event.data;
        
        console.log('📨 Received message from sanctions iframe:', message.type);
        
        switch (message.type) {
            case 'request-sanctions-xml':
                // Iframe is requesting XML (on page load)
                console.log('📥 Iframe requesting sanctions XML...');
                try {
                    const sanctionsRes = await callWithTimeout(getSanctionsXML());
                    
                    if (!sanctionsRes.success || !sanctionsRes.xml) {
                        throw new Error(sanctionsRes.result || 'Failed to fetch sanctions data');
                    }
                    
                    $w('#sanctions-iframe').postMessage({
                        type: 'sanctions-xml',
                        xml: sanctionsRes.xml
                    });
                } catch (error) {
                    console.error('❌ Failed to fetch sanctions XML:', error);
                    $w('#sanctions-iframe').postMessage({
                        type: 'sanctions-xml',
                        error: error.message || 'Failed to fetch sanctions data'
                    });
                }
                break;
                
            case 'file-data':
                // Request S3 presigned PUT URL for PDF upload
                await handleFileDataRequest(message);
                break;
                
            case 'upload-success':
                // Update entry with uploaded sanctions PDF
                await handleUploadSuccess(message);
                break;
        }
    });
    
    console.log('✅ Sanctions message listener setup complete');
}

/**
 * Handle file-data request from iframe
 * Generates S3 PUT link and responds to iframe
 */
async function handleFileDataRequest(message) {
    console.log('🔗 Generating S3 PUT links for sanctions PDF...');
    
    try {
        const files = message.files;
        const entryId = message._id;
        
        // Use existing generateFilePUTsBackend function
        const putLinkRes = await callWithTimeout(
            generateFilePUTsBackend(files)
        );
        
        if (!putLinkRes.success || !putLinkRes.links) {
            throw new Error(putLinkRes.result || 'Failed to generate PUT links');
        }
        
        // Send PUT links back to iframe
        $w('#sanctions-iframe').postMessage({
            type: 'put-links',
            links: putLinkRes.links.map((url, index) => ({
                url: url,
                contentType: 'application/pdf'
            })),
            s3Keys: putLinkRes.s3Keys,
            _id: entryId
        });
        
        console.log('✅ PUT links sent to iframe');
        
    } catch (error) {
        console.error('❌ Failed to generate PUT links:', error);
        $w('#sanctions-iframe').postMessage({
            type: 'put-error',
            message: error.message || 'Failed to generate upload link',
            _id: message._id
        });
    }
}

/**
 * Handle upload-success from iframe
 * Updates entry with uploaded PDF
 */
async function handleUploadSuccess(message) {
    console.log('💾 Sanctions PDF uploaded, updating entry...');
    
    try {
        const fileObject = message.files[0];
        const entryId = message._id;
        const uploader = message.uploader;
        
        // Update entry with sanctions PDF
        const updateRes = await callWithTimeout(
            updateEntryWithSanctionsPDF(fileObject, entryId, uploader)
        );
        
        if (!updateRes.success) {
            throw new Error(updateRes.result || 'Failed to update entry');
        }
        
        console.log('✅ Entry updated with sanctions PDF');
        
        // Show success notification
        wixWindowFrontend.showNotification('Sanctions report uploaded successfully', 'success');
        
        // Optionally refresh the document viewer if it's open
        // $w('#document-viewer-iframe').postMessage({ type: 'refresh-images' });
        
    } catch (error) {
        console.error('❌ Failed to update entry:', error);
        wixWindowFrontend.showNotification('Upload succeeded but failed to update record', 'error');
    }
}

/**
 * Example usage in your page code:
 * 
 * // In $w.onReady()
 * setupSanctionsMessageListener();
 * 
 * // When user clicks "Check Sanctions" button
 * async function onCheckSanctionsClick() {
 *     const context = {
 *         clientData: {
 *             fullName: $w('#nameInput').value,
 *             yearOfBirth: $w('#dobInput').value?.split('-')[0], // Extract year from date
 *             entityType: $w('#entityType').value // 'individual' or 'company'
 *         },
 *         openEntryId: currentEntryId, // Your current entry ID
 *         currentUser: {
 *             email: currentUser.email
 *         }
 *     };
 *     
 *     await initiateSanctionsChecker(context);
 *     
 *     // Show lightbox/popup containing the iframe
 *     $w('#sanctions-lightbox').show();
 * }
 */

