// frontend-sanctions-example-complete.js
// Complete example showing how to integrate the UK Sanctions Checker
// This matches your existing Thirdfort integration pattern

import { callWithTimeout } from 'public/functions/backend-timeout.js';
import wixWindowFrontend from 'wix-window-frontend';

// Import backend functions
import { getSanctionsXML, updateEntryWithSanctionsPDF } from 'backend/sanctions-integration.web.js';
import { generateFilePUTsBackend } from 'backend/id-system/in-person-verification/upload.web.js';

/**
 * INITIALIZATION FUNCTION
 * Call this when opening the sanctions checker iframe
 * Pass client data to pre-populate search fields
 */
export async function initiateSanctions(context) {
    console.log('🚀 Initiating sanctions checker...', context);
    
    // Show loading
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
        $w('#html17').postMessage({
            type: 'sanctions-xml',
            error: error.message || 'Failed to fetch sanctions data'
        });
        $w('#loadingSwirl-v2-lightbox').hide();
        wixWindowFrontend.showNotification('Failed to load sanctions data', 'error');
        return;
    }
    
    // Send XML to iframe
    $w('#html17').postMessage({
        type: 'sanctions-xml',
        xml: sanctionsRes.xml
    });
    
    // Send initialization data if we have client context
    if (context.clientData || context.openEntryId) {
        $w('#html17').postMessage({
            type: 'init-sanctions-search',
            clientName: context.clientData?.n ? 
                [context.clientData.n.f, context.clientData.n.m, context.clientData.n.l]
                    .filter(p => p).join(' ') : '',
            yearOfBirth: context.clientData?.b ? 
                context.clientData.b.split('-')[2] : '', // Extract year from dd-mm-yyyy
            searchType: context.clientData?.entityType === 'company' ? 'entity' : 'individual',
            clientEntryId: context.openEntryId || null,
            userEmail: context.currentUser?.email || ''
        });
    }
    
    $w('#loadingSwirl-v2-lightbox').hide();
    console.log('✅ Sanctions checker initialized');
}

/**
 * MESSAGE LISTENER
 * Setup in $w.onReady() to handle iframe messages
 */
$w('#html17').onMessage(async (event) => {
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
                
                $w('#html17').postMessage({
                    type: 'sanctions-xml',
                    xml: sanctionsRes.xml
                });
                console.log('✅ Sent XML to iframe');
            } catch (error) {
                console.error('❌ Failed to fetch sanctions XML:', error);
                $w('#html17').postMessage({
                    type: 'sanctions-xml',
                    error: error.message || 'Failed to fetch sanctions data'
                });
            }
            break;
            
        case 'file-data':
            // Request S3 presigned PUT URL for PDF upload
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
                $w('#html17').postMessage({
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
                $w('#html17').postMessage({
                    type: 'put-error',
                    message: error.message || 'Failed to generate upload link',
                    _id: message._id
                });
            }
            break;
            
        case 'upload-success':
            // Update entry with uploaded sanctions PDF
            console.log('💾 Sanctions PDF uploaded, updating entry...');
            try {
                const fileObject = message.files[0];
                const entryId = message._id;
                const uploader = message.uploader;
                
                const updateRes = await callWithTimeout(
                    updateEntryWithSanctionsPDF(fileObject, entryId, uploader)
                );
                
                if (!updateRes.success) {
                    throw new Error(updateRes.result || 'Failed to update entry');
                }
                
                console.log('✅ Entry updated with sanctions PDF');
                
                // Show success notification
                wixWindowFrontend.showNotification('Sanctions report uploaded successfully', 'success');
                
                // Optionally refresh document viewer if it's open
                if ($w('#document-viewer-iframe')) {
                    $w('#document-viewer-iframe').postMessage({
                        type: 'refresh-images'
                    });
                }
                
            } catch (error) {
                console.error('❌ Failed to update entry:', error);
                wixWindowFrontend.showNotification('Upload succeeded but failed to update record', 'error');
            }
            break;
    }
});

/**
 * EXAMPLE: Button click handler for opening sanctions checker
 * Wire this to your "Check Sanctions" button
 */
export async function onCheckSanctionsButtonClick() {
    // Get current client data from your page elements
    const clientData = {
        n: {
            f: $w('#firstNameInput').value,
            m: $w('#middleNameInput').value,
            l: $w('#lastNameInput').value
        },
        b: $w('#dobInput').value, // dd-mm-yyyy format
        entityType: $w('#entityTypeDropdown').value // 'individual' or 'company'
    };
    
    const context = {
        clientData: clientData,
        openEntryId: currentEntryId, // Your global entry ID variable
        currentUser: {
            email: currentUser.email // Your global user variable
        }
    };
    
    // Initialize sanctions checker
    await initiateSanctionsChecker(context);
    
    // Show the sanctions lightbox/modal
    $w('#sanctions-lightbox').show();
}

/**
 * EXAMPLE: Standalone mode (no client entry)
 * For manual searches without saving to database
 */
export async function onManualSanctionsSearchClick() {
    // Show loading
    $w('#loadingSwirl-v2-lightbox').show();
    
    // Just fetch and send XML, no client data
    try {
        const sanctionsRes = await callWithTimeout(getSanctionsXML());
        
        if (!sanctionsRes.success || !sanctionsRes.xml) {
            throw new Error(sanctionsRes.result || 'Failed to fetch sanctions data');
        }
        
        $w('#html17').postMessage({
            type: 'sanctions-xml',
            xml: sanctionsRes.xml
        });
        
        $w('#loadingSwirl-v2-lightbox').hide();
        $w('#sanctions-lightbox').show();
        
    } catch (error) {
        console.error('❌ Failed to load sanctions:', error);
        $w('#loadingSwirl-v2-lightbox').hide();
        wixWindowFrontend.showNotification('Failed to load sanctions data', 'error');
    }
}

/**
 * PAGE ONREADY SETUP
 * Add this to your page's $w.onReady() function
 */
$w.onReady(function () {
    // Setup sanctions message listener
    setupSanctionsMessageListener();
    
    // Wire up button handlers
    $w('#checkSanctionsBtn').onClick(() => onCheckSanctionsButtonClick());
    $w('#manualSearchBtn').onClick(() => onManualSanctionsSearchClick());
    
    // Close lightbox handler
    $w('#closeSanctionsBtn').onClick(() => {
        $w('#sanctions-lightbox').hide();
    });
});

