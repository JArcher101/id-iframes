// frontend-sanctions-integration.js
// Frontend integration for UK Sanctions Checker iframe
// Add this code to your Wix frontend page

import { callWithTimeout } from 'public/functions/backend-timeout.js';

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
        // Don't return early - still send init data so form can be populated
    }
    
    // Send XML to iframe (only if we have it)
    if (sanctionsRes && sanctionsRes.xml) {
        $w('#sanctions-iframe').postMessage({
            type: 'sanctions-xml',
            xml: sanctionsRes.xml
        });
    }
    
    // Always send initialization data if we have client context (even if XML fetch failed)
    // This ensures the form is at least populated with client data
    if (context.clientData || context.openEntryId) {
        console.log('📤 Sending init-sanctions-search with:', {
            clientName: context.clientData?.clientName || context.clientData?.fullName || '',
            yearOfBirth: context.clientData?.yearOfBirth || '',
            searchType: context.clientData?.searchType || (context.clientData?.entityType === 'company' ? 'entity' : 'individual'),
            clientEntryId: context.openEntryId || null,
            returnToRequest: context.returnToRequest || false
        });
        
        $w('#sanctions-iframe').postMessage({
            type: 'init-sanctions-search',
            clientName: context.clientData?.clientName || context.clientData?.fullName || '',
            yearOfBirth: context.clientData?.yearOfBirth || '',
            searchType: context.clientData?.searchType || (context.clientData?.entityType === 'company' ? 'entity' : 'individual'),
            clientEntryId: context.openEntryId || null,
            userEmail: context.currentUser?.email || '',
            returnToRequest: context.returnToRequest || false  // Pass flag for request form integration
        });
    }
    
    $w('#loadingSwirl-v2-lightbox').hide();
    console.log('✅ Sanctions checker initialized');
}

/**
 * Setup message listener for sanctions iframe
 * Call this in your page's $w.onReady()
 * 
 * @param {string} iframeId - ID of your HTML iframe element (e.g. '#html17')
 */
export function setupSanctionsMessageListener(iframeId = '#html17') {
    $w(iframeId).onMessage(async (event) => {
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
                    
                    $w(iframeId).postMessage({
                        type: 'sanctions-xml',
                        xml: sanctionsRes.xml
                    });
                } catch (error) {
                    console.error('❌ Failed to fetch sanctions XML:', error);
                    $w(iframeId).postMessage({
                        type: 'sanctions-xml',
                        error: error.message || 'Failed to fetch sanctions data'
                    });
                }
                break;
                
            case 'file-data':
                // Request S3 presigned PUT URL for PDF upload
                await handleFileDataRequest(message, iframeId);
                break;
                
            case 'upload-success':
                // Update entry with uploaded sanctions PDF
                const updateRes = await handleUploadSuccess(message, iframeId);
                // Check if we need to return to request form
                if (message.returnToRequest && updateRes?.uploadedFile) {
                    console.log('🔄 Returning to request form with uploaded file...');
                    await returnToRequest(updateRes.uploadedFile, message._id);
                }
                break;
        }
    });
    
    console.log('✅ Sanctions message listener setup complete on', iframeId);
}

/**
 * Handle file-data request from iframe
 * Generates S3 PUT link and responds to iframe
 */
export async function handleFileDataRequest(message, iframeId) {
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
        $w(iframeId).postMessage({
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
        $w(iframeId).postMessage({
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
export async function handleUploadSuccess(message, iframeId) {
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
        
        // Optionally refresh the document viewer if it's open
        if ($w('#document-viewer-iframe')) {
            $w('#document-viewer-iframe').postMessage({
                type: 'refresh-images'
            });
        }
        
        // Return updateRes for caller to access uploadedFile data
        return updateRes;
        
    } catch (error) {
        console.error('❌ Failed to update entry:', error);
        
        // Send error to iframe to display to user
        $w(iframeId).postMessage({
            type: 'upload-error',
            message: error.message || 'Upload succeeded but failed to update record',
            _id: message._id
        });
        
        // Re-throw for caller to handle
        throw error;
    }
}

/**
 * Return to request form with uploaded file data
 * Switches view back to request form and passes file info
 * 
 * Note: This function is exported so page code can call initiateRequest
 * 
 * @param {Object} uploadedFile - The uploaded file object from backend
 * @param {string} entryId - The entry ID to reload
 */
export async function returnToRequest(uploadedFile, entryId) {
    console.log('🔄 Switching back to request form with file:', uploadedFile);
    console.log('🔄 Entry ID:', entryId);
    
    $w('#loadingSwirl-v2-lightbox').show();
    $w('#lightboxTitle').text = "New Note, Request or Update";
    $w('#PreloaderStateBox').changeState("Request");
    
    // Call page's initiateRequest function with both entryId and uploadedFile
    // The page code should implement: initiateRequest(entryId, uploadedFile)
    // This will reload the form with entry data AND include the uploaded file
    if (typeof window.initiateRequest === 'function') {
        await window.initiateRequest(entryId, uploadedFile);
    } else {
        console.error('❌ window.initiateRequest function not found - page needs to define this');
    }
    
    $w('#loadingSwirl-v2-lightbox').hide();
    console.log('✅ Returned to request form');
}

/**
 * Example usage in your page code:
 * 
 * // In $w.onReady()
 * setupSanctionsMessageListener('#html17'); // Use your iframe's ID
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
 *     await initiateSanctionsChecker(context, '#html17'); // Pass iframe ID
 *     
 *     // Show lightbox/popup containing the iframe
 *     $w('#sanctions-lightbox').show();
 * }
 */

