// backend-document-migration.web.js
// Backend functions for automatic document migration from Wix Media to S3
// Migrates documents from specific fields (pepReport, soFReport, etc.) to idDocuments array
// Uses direct S3 commands (not presigned PUT links) with comprehensive logging

import { Permissions, webMethod } from "wix-web-module";
import wixData from 'wix-data';
import axios from 'axios';

// Import S3 helpers (following pdf-helpers.web.js pattern)
import { s3, documentsBucketName } from 'backend/id-system/in-person-verification/upload.web.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { generateRandomBase62 } from 'backend/utils/generate.web.js';

// =====================================================================
// FIELD TO DOCUMENT TYPE MAPPING
// Based on document-viewer.html dropdown structure (lines 2959-2965)
// =====================================================================
const documentTypeMapping = {
  'pepReport': {
    type: 'PEP & Sanctions Check',
    document: 'OFSI Sanctions Search'
  },
  'soFReport': {
    type: 'SoF/SoW Check',
    document: 'SoF Questionnaire'
  },
  'kybReport': {
    type: 'AML Check',
    document: 'Know Your Business (KYB)'
  },
  'idvReport': {
    type: 'AML Check',
    document: 'Identity Document Verification (IDV)'
  },
  'liteScreen': {
    type: 'AML Check',
    document: 'Lite Screening'
  },
  'kybCheck': {
    type: 'AML Check',
    document: 'Know Your Business (KYB)'
  },
  'ofsiSanctionsSearch': {
    type: 'PEP & Sanctions Check',
    document: 'OFSI Sanctions Search'
  },
  'clientDetailsForm': {
    type: 'Details form',
    document: 'Client Details Form'
  }
};

// Fields to check for documents
const documentFields = ['pepReport', 'soFReport', 'kybReport', 'idvReport', 'liteScreen', 'kybCheck', 'ofsiSanctionsSearch', 'clientDetailsForm'];

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

/**
 * Internal helper: Converts Wix internal document URL to public URL
 * @param {string} wixUrl - wix:document://v1/{MEDIA_ID_PATH}/{FILENAME}#params
 * @returns {string} - https://www.thurstanhoskin.co.uk/_files/{MEDIA_ID_PATH}
 */
function convertWixDocumentUrlToPublic(wixUrl) {
  if (!wixUrl || typeof wixUrl !== 'string' || !wixUrl.startsWith('wix:document://')) {
    return wixUrl; // Already public or invalid
  }
  
  try {
    // Extract media ID path from wix:document://v1/{MEDIA_ID_PATH}/{FILENAME}#...
    // Examples:
    // - wix:document://v1/ugd/a86acc_9e299f14fe7f448cacfa372dfff1dae7.pdf/filename.pdf#...
    //   → https://www.thurstanhoskin.co.uk/_files/ugd/a86acc_9e299f14fe7f448cacfa372dfff1dae7.pdf
    // - wix:document://v1/6fc0e3_319de21ab1b940a3a24977c2ca1d7b6b.pdf/filename.pdf#...
    //   → https://www.thurstanhoskin.co.uk/_files/ugd/6fc0e3_319de21ab1b940a3a24977c2ca1d7b6b.pdf
    // We need to capture everything up to the last / before the filename
    // If it doesn't start with ugd/, we need to prepend it
    const match = wixUrl.match(/wix:document:\/\/v1\/(.+?)\/[^\/]+(?:#|$)/);
    
    if (match && match[1]) {
      let mediaIdPath = match[1];
      // Ensure path starts with ugd/
      if (!mediaIdPath.startsWith('ugd/')) {
        mediaIdPath = `ugd/${mediaIdPath}`;
      }
      const publicUrl = `https://www.thurstanhoskin.co.uk/_files/${mediaIdPath}`;
      console.log(`📄 Converted Wix document URL: ${wixUrl.substring(0, 50)}... → ${publicUrl}`);
      return publicUrl;
    }
    
    console.warn('⚠️ Could not parse Wix document URL:', wixUrl);
    return wixUrl;
  } catch (error) {
    console.error('❌ Error converting Wix document URL:', error);
    return wixUrl;
  }
}

/**
 * Generates filename for document following document-viewer.html pattern
 * Pattern: ${fe}-${clientNumber}-${matterNumber} - ${name} - ${document}
 */
function generateDocumentFileName(entry, documentType) {
  const fe = String(entry.title || 'Unknown').replace(/\//g, '-');
  const clientNumber = String(entry.clientNumber || 'Unknown').replace(/\//g, '-');
  const matterNumber = String(entry.matterNumber || 'Unknown').replace(/\//g, '-');
  const name = String(entry.name || 'Unknown').replace(/\//g, '-');
  
  return `${fe}-${clientNumber}-${matterNumber} - ${name} - ${documentType}`;
}

// =====================================================================
// GET ID DOCUMENTS FUNCTION
// =====================================================================

/**
 * Internal helper: Fetches entries without docsTransferred flag that have documents in specified fields
 * @param {number|string} limitOrId - Number of entries to fetch (default: 10) OR single entry ID string
 * @returns {Object} Response with entries and their documents
 */
async function getIDDocuments(limitOrId) {
    let res = {
      success: false,
      result: undefined,
      error: undefined,
      items: undefined
    };

    let items;

    try {
      // Check if limitOrId is a string (entry ID) or number (limit)
      const isEntryId = typeof limitOrId === 'string' && limitOrId.length > 0;
      
      if (isEntryId) {
        console.log(`📥 Fetching single entry by ID: ${limitOrId}`);
        
        // Fetch single entry by ID
        const entry = await wixData.get("OutstandingID", limitOrId, { suppressAuth: true, consistentRead: true });
        
        // Check if entry has docsTransferred flag
        if (entry.docsTransferred) {
          console.log(`ℹ️ Entry ${limitOrId} already has docsTransferred flag set`);
          res.result = "Entry already processed";
          res.items = [];
          res.success = true;
          return res;
        }
        
        // Wrap single entry in array format to match query result structure
        items = { items: [entry] };
      } else {
        const limit = parseInt(limitOrId || 10, 10);
        console.log(`📥 Starting document migration fetch with limit: ${limit}`);
        
        items = await wixData.query("OutstandingID")
          .isEmpty("docsTransferred")
          .limit(limit)
          .find({ suppressAuth: true, consistentRead: true });
      }

      if (!items || !items.items || !items.items.length) {
        console.log('ℹ️ No entries found without docsTransferred flag');
        res.result = "No items found/returned";
        res.error = items;
        return res;
      }

      console.log(`✅ Found ${items.items.length} entries to process`);

      // Return full entries as-is, just add a temporary documents array for tracking
      res.items = items.items.map(entry => {
        // Check each document field directly on the entry
        entry._migrationDocuments = [];
        
        documentFields.forEach(fieldName => {
          const fieldValue = entry[fieldName];
          if (fieldValue && typeof fieldValue === 'string' && fieldValue.startsWith('wix:document://')) {
            const mapping = documentTypeMapping[fieldName];
            if (mapping) {
              const publicUrl = convertWixDocumentUrlToPublic(fieldValue);
              entry._migrationDocuments.push({
                field: fieldName,
                url: publicUrl,
                originalUrl: fieldValue,
                type: mapping.type,
                document: mapping.document
              });
              console.log(`  📄 Found document in ${fieldName} for entry ${entry._id}: ${mapping.document}`);
            }
          }
        });

        if (entry._migrationDocuments.length > 0) {
          console.log(`  ✅ Entry ${entry._id} (${entry.name}): ${entry._migrationDocuments.length} document(s) to migrate`);
        }

        return entry;
      }).filter(entry => entry._migrationDocuments && entry._migrationDocuments.length > 0);

      console.log(`📊 Total entries with documents: ${res.items.length}`);

      res.success = true;
      return res;

    } catch (e) {
      console.error('❌ Error getting entries from database:', e);
      res.result = "An error occurred getting the entries from the database";
      res.error = e;
      return res;
    }
}

// =====================================================================
// UPDATE ID DOCUMENTS FUNCTION
// =====================================================================

/**
 * Internal helper: Updates entries with migrated documents using bulkUpdate
 * CRITICAL: Fetches full entry objects from database first, then merges new fields into them
 * @param {Array} updateData - Array of objects with _id, idDocuments, docsTransferred
 * @returns {Object} Response with update results
 */
async function updateIDDocuments(updateData) {
    let res = {
      success: false,
      result: undefined,
      error: undefined,
      updated: 0,
      failed: []
    };

    // Validate input
    if (!updateData || !Array.isArray(updateData) || updateData.length === 0) {
      res.result = "No entries provided for update";
      return res;
    }

    // Extract all _id values
    const itemIds = updateData.map(item => item._id);

    console.log('📋 Updating entries with documents:', {
      count: updateData.length,
      ids: itemIds
    });

    try {
      // CRITICAL: Fetch all existing entries by _id using hasSome to get COMPLETE entry objects
      console.log('🔍 Fetching existing entries to preserve all fields...');
      const existingEntries = await wixData.query("OutstandingID")
        .hasSome("_id", itemIds)
        .find({ suppressAuth: true, consistentRead: true });

      if (!existingEntries || !existingEntries.items || existingEntries.items.length === 0) {
        res.result = "No matching entries found in database";
        res.error = { queriedIds: itemIds };
        console.error('❌ No entries found for IDs:', itemIds);
        return res;
      }

      console.log(`✅ Found ${existingEntries.items.length} existing entries`);

      // Map update data by _id for quick lookup
      const updatesMap = {};
      updateData.forEach(item => {
        updatesMap[item._id] = {
          idDocuments: item.idDocuments,
          docsTransferred: item.docsTransferred
        };
      });

      // Iterate each entry and merge new fields into full entry objects
      console.log('🔧 Merging new fields into full entry objects...');
      const entriesToUpdate = existingEntries.items.map(entry => {
        const updateDataForEntry = updatesMap[entry._id];

        if (updateDataForEntry) {
          // Get existing idDocuments array or initialize empty array
          const existingDocs = Array.isArray(entry.idDocuments) ? entry.idDocuments : [];
          
          // Merge new documents into existing array (prepend new ones)
          entry.idDocuments = [...updateDataForEntry.idDocuments, ...existingDocs];
          entry.docsTransferred = updateDataForEntry.docsTransferred;

          console.log('📝 Updating entry:', {
            _id: entry._id,
            name: entry.name,
            newDocumentsCount: updateDataForEntry.idDocuments.length,
            totalDocumentsCount: entry.idDocuments.length,
            hasAllFields: !!(entry.name && entry.clientNumber && entry.matterNumber)
          });
        }

        return entry; // Return full entry with all fields intact
      });

      // Bulk update with full entry objects (preserves all fields)
      console.log('💾 Executing bulkUpdate with full entry objects...');
      const result = await wixData.bulkUpdate("OutstandingID", entriesToUpdate, { suppressAuth: true });

      res.updated = result.updated || 0;
      res.skipped = result.skipped || 0;
      res.errors = result.errors || [];
      res.success = true;

      console.log('✅ bulkUpdate completed:', {
        updated: res.updated,
        skipped: res.skipped,
        errors: res.errors.length
      });

      // Verify one entry to confirm fields intact
      if (entriesToUpdate.length > 0) {
        const sampleId = entriesToUpdate[0]._id;
        const afterUpdate = await wixData.get("OutstandingID", sampleId, { suppressAuth: true });

        console.log('🔍 Sample entry after update:', {
          _id: afterUpdate._id,
          name: afterUpdate.name,
          clientNumber: afterUpdate.clientNumber,
          matterNumber: afterUpdate.matterNumber,
          status: afterUpdate.status,
          idDocumentsCount: afterUpdate.idDocuments?.length,
          docsTransferred: afterUpdate.docsTransferred,
          allFieldsPresent: !!(afterUpdate.name && afterUpdate.clientNumber)
        });
      }

    } catch (e) {
      console.error('❌ Update error:', e);
      res.result = "An error occurred updating the items";
      res.error = {
        message: e.message,
        stack: e.stack
      };
      return res;
    }

    return res;
}

// =====================================================================
// DOCUMENT MIGRATION PROCESSOR
// Main webMethod function - call this from backend editor
// =====================================================================

/**
 * Main function: Processes document migration for specified number of entries or single entry
 * Fetches entries, downloads documents from Wix, uploads to S3, updates database
 * 
 * Call this from the Wix backend editor:
 * import { migrateDocuments } from 'backend/backend-document-migration.web.js';
 * await migrateDocuments(10); // Process 10 entries
 * await migrateDocuments('entry-id-123'); // Process single entry by ID
 * 
 * @param {number|string} limitOrId - Number of entries to process (default: 10) OR single entry ID string
 * @returns {Object} Migration results with detailed logging
 */
export const migrateDocuments = webMethod(
  Permissions.Admin,
  async (limitOrId) => {
    const isEntryId = typeof limitOrId === 'string' && limitOrId.length > 0;
    console.log('🚀 Starting document migration process...');
    if (isEntryId) {
      console.log(`📊 Processing single entry: ${limitOrId}`);
    } else {
      console.log(`📊 Limit: ${limitOrId || 10} entries`);
    }

    const result = {
      success: false,
      entriesProcessed: 0,
      documentsUploaded: 0,
      documentsFailed: 0,
      entriesUpdated: 0,
      errors: []
    };

    try {
      // Step 1: Fetch entries with documents
      console.log('\n📥 Step 1: Fetching entries with documents...');
      const fetchResult = await getIDDocuments(limitOrId);
      
      if (!fetchResult.success || !fetchResult.items || fetchResult.items.length === 0) {
        console.log('ℹ️ No entries with documents to process');
        result.success = true;
        result.result = 'No entries with documents found';
        return result;
      }

      console.log(`✅ Found ${fetchResult.items.length} entries with documents`);

      // Step 2: Process all documents in parallel
      console.log('\n📄 Step 2: Processing documents (fetching and uploading to S3)...');
      const allDocumentPromises = [];
      const documentMetadata = [];

      fetchResult.items.forEach(entry => {
        entry._migrationDocuments.forEach(doc => {
          const promise = processDocument(entry, doc);
          allDocumentPromises.push(promise);
          documentMetadata.push({ entryId: entry._id, field: doc.field, entry: entry });
        });
      });

      console.log(`🔄 Starting Promise.all() for ${allDocumentPromises.length} document uploads...`);

      // Execute all uploads in parallel
      const uploadResults = await Promise.all(allDocumentPromises);

      // Log individual results
      uploadResults.forEach((uploadResult, index) => {
        const meta = documentMetadata[index];
        if (uploadResult.success) {
          console.log(`✅ Uploaded: ${meta.field} for entry ${meta.entryId} → ${uploadResult.s3Key} (${uploadResult.size} bytes)`);
          result.documentsUploaded++;
        } else {
          console.log(`❌ Failed: ${meta.field} for entry ${meta.entryId} → ${uploadResult.error}`);
          result.documentsFailed++;
          result.errors.push({
            entryId: meta.entryId,
            field: meta.field,
            error: uploadResult.error
          });
        }
      });

      console.log(`\n📊 Upload Summary: ${result.documentsUploaded} successful, ${result.documentsFailed} failed, ${allDocumentPromises.length} total`);

      // Step 3: Group documents by entry and prepare update objects
      console.log('\n📦 Step 3: Grouping documents by entry...');
      const entriesMap = {};

      uploadResults.forEach((uploadResult, index) => {
        const meta = documentMetadata[index];
        if (uploadResult.success) {
          if (!entriesMap[meta.entryId]) {
            entriesMap[meta.entryId] = [];
          }
          entriesMap[meta.entryId].push(uploadResult.documentObject);
        }
      });

      // Step 4: Update database with migrated documents
      console.log('\n💾 Step 4: Updating database entries...');
      const updateData = Object.keys(entriesMap).map(entryId => {
        return {
          _id: entryId,
          idDocuments: entriesMap[entryId],
          docsTransferred: true
        };
      });

      if (updateData.length > 0) {
        console.log(`📝 Preparing bulkUpdate with ${updateData.length} entries...`);
        const updateResult = await updateIDDocuments(updateData);
        
        if (updateResult.success) {
          result.entriesUpdated = updateResult.updated || 0;
          result.entriesProcessed = updateData.length;
          console.log(`✅ Database update complete: ${result.entriesUpdated} entries updated`);
        } else {
          throw new Error(`Database update failed: ${updateResult.result}`);
        }
      } else {
        console.log('⚠️ No successful uploads to update in database');
      }

      result.success = true;
      console.log('\n🎉 Document migration process complete!');
      console.log(`📊 Final Summary: ${result.entriesProcessed} entries processed, ${result.documentsUploaded} documents uploaded, ${result.documentsFailed} failed`);

    } catch (error) {
      console.error('❌ Error in document migration process:', error);
      result.success = false;
      result.error = error.message;
      result.errors.push({
        step: 'migration-process',
        error: error.message,
        stack: error.stack
      });
    }

    return result;
  }
);

/**
 * Processes a single document: fetches from Wix, uploads to S3, creates document object
 * @param {Object} entry - Entry object with _id and cD
 * @param {Object} doc - Document metadata with field, url, type, document
 * @returns {Object} Result with success, s3Key, size, documentObject, or error
 */
async function processDocument(entry, doc) {
  try {
    console.log(`📥 Fetching document: ${doc.field} for entry ${entry._id} from ${doc.url.substring(0, 60)}...`);

    // Fetch document from converted public URL using axios
    const response = await axios.get(doc.url, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    const documentBinary = Buffer.from(response.data);
    const documentSize = documentBinary.length;

    console.log(`✅ Document fetched: ${doc.field} for entry ${entry._id}, size: ${documentSize} bytes`);

    // Generate S3 key (obfuscated, single-level path)
    const randomId = await generateRandomBase62(7);
    const s3Key = `protected/${randomId}`;

    console.log(`🔑 Generated S3 key: ${s3Key} for ${doc.field} (entry ${entry._id})`);

    // Upload directly to S3
    console.log(`⬆️ Uploading to S3: ${doc.field} for entry ${entry._id} → ${s3Key}...`);
    const client = await s3();
    const bucket = await documentsBucketName();
    const buffer = documentBinary; // Already a Buffer

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: 'application/pdf'
    });

    await client.send(command);
    console.log(`✅ Uploaded to S3: ${doc.field} for entry ${entry._id} → ${s3Key}`);

    // Generate filename
    const fileName = generateDocumentFileName(entry, doc.document);

    // Create document object matching document-viewer.html format
    const documentObject = {
      type: doc.type,
      document: doc.document,
      uploader: 'System transfer',
      date: new Date().toLocaleString('en-GB', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }),
      data: {
        type: 'application/pdf',
        size: documentSize,
        name: fileName,
        lastModified: Date.now()
      },
      s3Key: s3Key
      // NO liveUrl - signed URLs are generated on-demand when needed
    };

    return {
      success: true,
      s3Key: s3Key,
      size: documentSize,
      documentObject: documentObject
    };

  } catch (error) {
    console.error(`❌ Error processing document ${doc.field} for entry ${entry._id}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

