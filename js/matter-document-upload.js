(function () {
  'use strict';

  var MAX_FILES = 25;
  var MAX_BYTES_PER_FILE = 25 * 1024 * 1024;
  var MAX_TOTAL_BYTES = 500 * 1024 * 1024;

  var ACCEPT_ATTR =
    'image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/rtf';

  var defaultStaffOptions = [
    { label: 'Barbara Archer', value: 'BA' },
    { label: 'Louise Deere', value: 'LJD' },
    { label: 'Stephen Morrison', value: 'SJM' },
    { label: 'Martin Biscombe', value: 'MB' },
    { label: 'Emma Lilley', value: 'EL' },
    { label: 'Maria Bury', value: 'MAB' },
    { label: 'Emma Lockie (Burden)', value: 'EJL' },
    { label: 'Samantha Newton', value: 'SN' },
    { label: 'Mollie Pellowe', value: 'MLP' },
    { label: 'Isaac McCormack', value: 'IM' },
    { label: 'Jacob Archer-Moran', value: 'JA' },
  ];

  var contextId = '';
  var lastStaffOptions = defaultStaffOptions.slice();

  var pendingUpload = [];
  var uploadInProgress = false;
  var uploadResolve = null;
  var uploadReject = null;

  function normalizeParentMessageFallback(raw) {
    if (!raw || typeof raw !== 'object') return { type: '', data: {} };
    var type = String(raw.type || '');
    var payload =
      raw.data !== undefined && raw.type !== undefined && raw.data && typeof raw.data === 'object'
        ? raw.data
        : raw;
    var out = {};
    for (var k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) out[k] = payload[k];
    }
    return { type: type, data: out };
  }

  function sendToParent(payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {
      console.error('[matter-document-upload] postMessage failed', e);
    }
  }

  function notifyParentReady() {
    sendToParent({
      type: 'iframe-ready',
      iframeType: 'matter-document-upload',
    });
  }

  function getSlotsRoot() {
    return document.getElementById('mdFileSlots');
  }

  function showError(detail, title) {
    var el = document.getElementById('mdError');
    var titleEl = document.getElementById('mdErrorTitle');
    var detailEl = document.getElementById('mdErrorDetail');
    var ok = document.getElementById('mdSuccess');
    if (ok) {
      ok.textContent = '';
      ok.classList.add('hidden');
    }
    if (!el || !titleEl || !detailEl) return;
    if (detail) {
      titleEl.textContent = title || 'Unable to submit';
      detailEl.textContent = detail;
      el.classList.remove('hidden');
    } else {
      titleEl.textContent = '';
      detailEl.textContent = '';
      el.classList.add('hidden');
    }
  }

  function showSuccess(msg) {
    var el = document.getElementById('mdSuccess');
    var er = document.getElementById('mdError');
    var titleEl = document.getElementById('mdErrorTitle');
    var detailEl = document.getElementById('mdErrorDetail');
    if (er && titleEl && detailEl) {
      titleEl.textContent = '';
      detailEl.textContent = '';
      er.classList.add('hidden');
    }
    if (!el) return;
    el.textContent = msg || '';
    if (msg) el.classList.remove('hidden');
    else el.classList.add('hidden');
  }

  function setLoading(visible, text) {
    var ov = document.getElementById('mdLoading');
    var tx = document.getElementById('mdLoadingText');
    if (tx && text) tx.textContent = text;
    if (!ov) return;
    if (visible) ov.classList.remove('hidden');
    else ov.classList.add('hidden');
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function updateLimitsSummary() {
    var el = document.getElementById('mdLimitsSummary');
    if (!el) return;
    var slots = getSlots();
    var total = 0;
    var count = 0;
    slots.forEach(function (s) {
      if (s.file) {
        total += s.file.size;
        count++;
      }
    });
    el.textContent =
      count +
      ' file(s) selected · ' +
      formatBytes(total) +
      ' of max ' +
      formatBytes(MAX_TOTAL_BYTES) +
      ' total · max ' +
      formatBytes(MAX_BYTES_PER_FILE) +
      ' per file.';
  }

  function bindUploadArea(slotEl, input, labelEl) {
    var area = slotEl.querySelector('.upload-area');
    if (!area || !input) return;

    function pick() {
      input.click();
    }

    area.addEventListener('click', pick);

    area.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pick();
      }
    });

    function preventNav(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    area.addEventListener('dragover', function (e) {
      preventNav(e);
      area.classList.add('dragover');
    });

    area.addEventListener('dragleave', function () {
      area.classList.remove('dragover');
    });

    area.addEventListener('drop', function (e) {
      preventNav(e);
      area.classList.remove('dragover');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      try {
        var dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
      } catch (err) {
        console.warn('[matter-document-upload] Could not assign dropped file', err);
        return;
      }
      input.dispatchEvent(new Event('change', { bubbles: true }));
      if (labelEl) {
        labelEl.textContent = files[0].name || '';
      }
      updateLimitsSummary();
    });

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (labelEl) {
        labelEl.textContent = f ? f.name : '';
      }
      updateLimitsSummary();
    });
  }

  function createSlot(index) {
    var wrap = document.createElement('div');
    wrap.className = 'matter-file-slot';
    wrap.dataset.slotIndex = String(index);
    wrap.innerHTML =
      '<div class="matter-slot-header">' +
      '<p class="matter-slot-title">File upload ' +
      (index + 1) +
      '</p>' +
      '<button type="button" class="matter-remove-slot hidden">Remove</button>' +
      '</div>' +
      '<div class="uploader-section">' +
      '<div class="upload-area matter-slot-upload-area" tabindex="0" role="button">' +
      '<div class="upload-icon">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="rgb(0, 60, 113)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="17,8 12,3 7,8"/>' +
      '<line x1="12" y1="3" x2="12" y2="15"/>' +
      '</svg>' +
      '</div>' +
      '<div class="upload-text">Upload document</div>' +
      '<input type="file" class="file-input matter-slot-file" />' +
      '</div>' +
      '<p class="upload-info matter-file-chosen matter-chosen-label"></p>' +
      '</div>' +
      '<div class="matter-grid matter-slot-meta-grid">' +
      '<div class="matter-grid-item">' +
      '<label class="required">Friendly name</label>' +
      '<input type="text" class="matter-friendly" placeholder="e.g. Passport scan, Lease agreement" />' +
      '</div>' +
      '<div class="matter-grid-item">' +
      '<label>Note</label>' +
      '<input type="text" class="matter-note" placeholder="Optional description for this file" />' +
      '</div>' +
      '</div>';

    var input = wrap.querySelector('.matter-slot-file');
    var chosen = wrap.querySelector('.matter-chosen-label');
    input.setAttribute('accept', ACCEPT_ATTR);

    bindUploadArea(wrap, input, chosen);

    wrap.querySelector('.matter-remove-slot').addEventListener('click', function () {
      wrap.remove();
      renumberSlots();
      refreshRemoveButtons();
      updateLimitsSummary();
      refreshAddButtonState();
    });

    return wrap;
  }

  function renumberSlots() {
    var root = getSlotsRoot();
    if (!root) return;
    var slots = root.querySelectorAll('.matter-file-slot');
    slots.forEach(function (slot, i) {
      slot.dataset.slotIndex = String(i);
      var h = slot.querySelector('.matter-slot-title');
      if (h) h.textContent = 'File upload ' + (i + 1);
    });
  }

  function refreshRemoveButtons() {
    var root = getSlotsRoot();
    if (!root) return;
    var slots = root.querySelectorAll('.matter-file-slot');
    var showRemove = slots.length > 1;
    slots.forEach(function (slot) {
      var b = slot.querySelector('.matter-remove-slot');
      if (b) {
        if (showRemove) b.classList.remove('hidden');
        else b.classList.add('hidden');
      }
    });
  }

  function refreshAddButtonState() {
    var btn = document.getElementById('mdAddFile');
    if (!btn) return;
    var n = getSlotsRoot() ? getSlotsRoot().querySelectorAll('.matter-file-slot').length : 0;
    btn.disabled = n >= MAX_FILES;
  }

  function ensureSlotsInitialized() {
    var root = getSlotsRoot();
    if (!root || root.children.length) return;
    root.appendChild(createSlot(0));
    refreshRemoveButtons();
    refreshAddButtonState();
    updateLimitsSummary();
  }

  function addSlot() {
    var root = getSlotsRoot();
    if (!root) return;
    if (root.children.length >= MAX_FILES) return;
    root.appendChild(createSlot(root.children.length));
    renumberSlots();
    refreshRemoveButtons();
    refreshAddButtonState();
    updateLimitsSummary();
  }

  function getSlots() {
    var root = getSlotsRoot();
    if (!root) return [];
    var out = [];
    root.querySelectorAll('.matter-file-slot').forEach(function (slot) {
      var input = slot.querySelector('.matter-slot-file');
      var friendly = slot.querySelector('.matter-friendly');
      var note = slot.querySelector('.matter-note');
      var f = input && input.files && input.files[0];
      out.push({
        file: f || null,
        friendlyName: friendly ? friendly.value.trim() : '',
        note: note ? note.value.trim() : '',
      });
    });
    return out;
  }

  function syncMatterUnknownFields() {
    var unknownEl = document.getElementById('mdUnknownMatter');
    var refWrap = document.getElementById('mdMatterRefWrap');
    var descWrap = document.getElementById('mdMatterDescWrap');
    var matter = document.getElementById('mdMatterRef');
    var desc = document.getElementById('mdMatterDescription');
    if (!unknownEl) return;
    var unknown = unknownEl.checked;

    if (unknown) {
      if (refWrap) refWrap.classList.add('hidden');
      if (descWrap) descWrap.classList.remove('hidden');
      if (matter) {
        matter.disabled = true;
        matter.value = '';
      }
      if (desc) desc.disabled = false;
    } else {
      if (refWrap) refWrap.classList.remove('hidden');
      if (descWrap) descWrap.classList.add('hidden');
      if (matter) matter.disabled = false;
      if (desc) {
        desc.disabled = true;
        desc.value = '';
      }
    }
  }

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function validatePhone(v) {
    return String(v || '').trim().length >= 6;
  }

  function validateForm() {
    var first = document.getElementById('mdFirstName');
    var last = document.getElementById('mdLastName');
    var phone = document.getElementById('mdPhone');
    var email = document.getElementById('mdEmail');
    var matter = document.getElementById('mdMatterRef');
    var matterDesc = document.getElementById('mdMatterDescription');
    var unknown = document.getElementById('mdUnknownMatter');
    var dealing = document.getElementById('mdDealing');

    if (!first.value.trim()) return 'Please enter your first name.';
    if (!last.value.trim()) return 'Please enter your last name.';
    if (!validatePhone(phone.value)) return 'Please enter a valid phone number.';
    if (!validateEmail(email.value.trim())) return 'Please enter a valid email address.';
    if (!unknown || !matter) return 'Form error — please reload the page.';
    if (unknown.checked) {
      if (!matterDesc || !matterDesc.value.trim())
        return 'Please describe your matter so we can identify it.';
    } else {
      if (!matter.value.trim())
        return 'Enter your client matter reference or tick “I don’t know my client matter number”.';
    }
    if (!dealing.value) return 'Please choose who is dealing with your matter.';

    if (!document.getElementById('mdPrivacyCheckbox').checked)
      return 'Please confirm that you understand how your information will be handled (Privacy Policy).';
    if (!document.getElementById('mdConsentCheckbox').checked)
      return 'Please confirm you have authority from all named parties to submit their information.';

    var slots = getSlots();
    var files = slots.filter(function (s) {
      return s.file;
    });
    if (files.length === 0) return 'Please upload at least one file.';

    var total = 0;
    for (var i = 0; i < files.length; i++) {
      var file = files[i].file;
      if (file.size > MAX_BYTES_PER_FILE) {
        return 'Each file must be at most ' + formatBytes(MAX_BYTES_PER_FILE) + '. Larger file: ' + file.name;
      }
      total += file.size;
      var friendlyOk = files[i].friendlyName || file.name;
      if (!String(friendlyOk).trim()) return 'Each uploaded file needs a friendly name.';
    }
    if (total > MAX_TOTAL_BYTES)
      return 'Total upload size exceeds ' + formatBytes(MAX_TOTAL_BYTES) + '. Remove or compress some files.';

    return null;
  }

  function buildUploadDescriptors(slotsWithFiles) {
    var email = document.getElementById('mdEmail').value.trim();
    var stamp = new Date().toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return slotsWithFiles.map(function (slot, idx) {
      var file = slot.file;
      var friendly = slot.friendlyName.trim() || file.name;
      var safeName =
        'matter-upload-' +
        Date.now() +
        '-' +
        idx +
        '-' +
        String(file.name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
      return {
        slotIndex: idx,
        friendlyLabel: friendly,
        userNote: slot.note,
        payload: {
          type: 'Matter supporting document',
          document: friendly,
          note: slot.note || '',
          uploader: email,
          date: stamp,
          data: {
            type: file.type || 'application/octet-stream',
            size: file.size,
            name: safeName,
            lastModified: file.lastModified,
          },
          file: file,
          isMatterUpload: true,
        },
      };
    });
  }

  function uploadFilesToS3(localFiles, links, s3Keys) {
    return Promise.all(
      localFiles.map(function (fileData, index) {
        return fetch(links[index], {
          method: 'PUT',
          body: fileData.file,
          headers: { 'Content-Type': fileData.file.type || 'application/octet-stream' },
        }).then(function (response) {
          if (!response.ok)
            throw new Error(
              'Upload failed (HTTP ' + response.status + '): ' + (fileData.data && fileData.data.name)
            );
          return s3Keys[index];
        });
      })
    ).then(function () {
      return s3Keys;
    });
  }

  function runUploadPipeline(descriptors) {
    return new Promise(function (resolve, reject) {
      if (descriptors.length === 0) {
        resolve([]);
        return;
      }
      pendingUpload = descriptors.map(function (d) {
        return d.payload;
      });
      uploadInProgress = true;
      uploadResolve = function (keys) {
        uploadInProgress = false;
        pendingUpload = [];
        uploadResolve = null;
        uploadReject = null;
        resolve(keys);
      };
      uploadReject = function (err) {
        uploadInProgress = false;
        pendingUpload = [];
        uploadResolve = null;
        uploadReject = null;
        reject(err);
      };

      var meta = descriptors.map(function (d) {
        var p = d.payload;
        return {
          type: p.type,
          document: p.document,
          note: p.note,
          uploader: p.uploader,
          date: p.date,
          data: p.data,
          isMatterUpload: true,
          file: {},
        };
      });
      sendToParent({
        type: 'file-data',
        files: meta,
        _id: contextId || undefined,
      });
    });
  }

  function handleParentUploadMessage(event) {
    if (!uploadInProgress) return;
    var raw = event.data;
    var parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (ex) {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    var normalizer =
      typeof window.normalizeParentMessage === 'function'
        ? window.normalizeParentMessage
        : normalizeParentMessageFallback;
    var unpacked = normalizer(parsed);
    var type = unpacked.type;
    var message = unpacked.data;

    if (type !== 'put-links' && type !== 'put-error') return;

    if (type === 'put-error') {
      var errMsg = (message && message.message) || 'Failed to prepare uploads.';
      if (uploadReject) uploadReject(new Error(errMsg));
      return;
    }

    var links = message.links;
    var s3Keys = message.s3Keys;
    if (!links || !s3Keys || links.length !== pendingUpload.length || s3Keys.length !== pendingUpload.length) {
      if (uploadReject) uploadReject(new Error('Unexpected response from server (links vs files mismatch).'));
      return;
    }

    uploadFilesToS3(pendingUpload, links, s3Keys)
      .then(function (keys) {
        if (uploadResolve) uploadResolve(keys);
      })
      .catch(function (e) {
        if (uploadReject) uploadReject(e);
      });
  }

  function mergeSubmission(descriptors, s3Keys) {
    return descriptors.map(function (d, i) {
      var keyObj = s3Keys[i];
      var row = {};
      if (keyObj && typeof keyObj === 'object' && !Array.isArray(keyObj)) {
        for (var k in keyObj) {
          if (Object.prototype.hasOwnProperty.call(keyObj, k)) row[k] = keyObj[k];
        }
      } else if (typeof keyObj === 'string') {
        row.s3Key = keyObj;
      }
      row.friendlyName = d.friendlyLabel;
      row.note = d.userNote;
      row.originalName = d.payload.file.name;
      row.size = d.payload.file.size;
      row.mimeType = d.payload.file.type || 'application/octet-stream';
      return row;
    });
  }

  function submitFinal(details, mergedFiles) {
    sendToParent({
      type: 'matter-document-upload',
      _id: contextId || undefined,
      data: {
        firstName: details.firstName,
        lastName: details.lastName,
        phone: details.phone,
        email: details.email,
        matterReference: details.matterReferenceUnknown ? '' : details.matterReference,
        matterDescription: details.matterReferenceUnknown ? details.matterDescription : '',
        matterReferenceUnknown: details.matterReferenceUnknown,
        dealingWith: details.dealingWith,
        dealingWithLabel: details.dealingWithLabel,
        generalNote: details.generalNote,
        privacyPolicy: details.privacyPolicy,
        gdprIndividualsAgreement: details.gdprIndividualsAgreement,
        limits: {
          maxFiles: MAX_FILES,
          maxBytesPerFile: MAX_BYTES_PER_FILE,
          maxTotalBytes: MAX_TOTAL_BYTES,
        },
        files: mergedFiles,
      },
    });
  }

  function populateStaff(options) {
    var sel = document.getElementById('mdDealing');
    if (!sel) return;
    sel.innerHTML = '<option value="">Choose one</option>';
    (options || []).forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      sel.appendChild(o);
    });
  }

  function initMessages() {
    window.addEventListener('message', function (e) {
      var raw = e.data;
      if (raw && typeof raw === 'object' && raw.type === 'health-ping') {
        sendToParent({ type: 'health-ping' });
        return;
      }

      var parsed;
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (ex) {
        return;
      }

      var norm = normalizeParentMessageFallback(parsed);
      if (norm.type === 'init-data') {
        var d = norm.data || {};
        if (d._id) contextId = d._id;
        if (d.instructions) {
          var intro = document.getElementById('mdIntro');
          if (intro) intro.textContent = d.instructions;
        }
        if (Array.isArray(d.staffOptions) && d.staffOptions.length) {
          lastStaffOptions = d.staffOptions.slice();
          populateStaff(d.staffOptions);
        } else {
          lastStaffOptions = defaultStaffOptions.slice();
          populateStaff(defaultStaffOptions);
        }
        return;
      }

      handleParentUploadMessage(e);
    });

    populateStaff(lastStaffOptions);
  }

  document.addEventListener('DOMContentLoaded', function () {
    ensureSlotsInitialized();

    document.getElementById('mdAddFile').addEventListener('click', function () {
      addSlot();
    });

    document.getElementById('mdUnknownMatter').addEventListener('change', syncMatterUnknownFields);

    document.getElementById('mdForm').addEventListener('submit', function (ev) {
      ev.preventDefault();
      showError('');

      var err = validateForm();
      if (err) {
        showError(err);
        return;
      }

      var slots = getSlots().filter(function (s) {
        return s.file;
      });
      var descriptors = buildUploadDescriptors(slots);

      var dealingSel = document.getElementById('mdDealing');
      var dealingVal = dealingSel.value;
      var dealingLabel = '';
      if (dealingSel.selectedOptions && dealingSel.selectedOptions[0]) {
        dealingLabel = dealingSel.selectedOptions[0].textContent || '';
      }

      var details = {
        firstName: document.getElementById('mdFirstName').value.trim(),
        lastName: document.getElementById('mdLastName').value.trim(),
        phone: document.getElementById('mdPhone').value.trim(),
        email: document.getElementById('mdEmail').value.trim(),
        matterReference: document.getElementById('mdMatterRef').value.trim(),
        matterDescription: document.getElementById('mdMatterDescription').value.trim(),
        matterReferenceUnknown: document.getElementById('mdUnknownMatter').checked,
        dealingWith: dealingVal,
        dealingWithLabel: dealingLabel,
        generalNote: document.getElementById('mdGeneralNote').value.trim(),
        privacyPolicy: document.getElementById('mdPrivacyCheckbox').checked,
        gdprIndividualsAgreement: document.getElementById('mdConsentCheckbox').checked,
      };

      setLoading(true, 'Preparing upload…');
      document.getElementById('mdSubmit').disabled = true;

      runUploadPipeline(descriptors)
        .then(function (keys) {
          setLoading(false);
          var merged = mergeSubmission(descriptors, keys || []);
          submitFinal(details, merged);
          document.getElementById('mdForm').reset();
          syncMatterUnknownFields();
          populateStaff(lastStaffOptions);
          var slotsRoot = getSlotsRoot();
          if (slotsRoot) slotsRoot.innerHTML = '';
          ensureSlotsInitialized();
          updateLimitsSummary();
          document.getElementById('mdSubmit').disabled = false;
          showError('');
          showSuccess('Thank you — your documents were sent.');
        })
        .catch(function (e2) {
          console.error(e2);
          setLoading(false);
          document.getElementById('mdSubmit').disabled = false;
          showError(e2.message || 'Upload failed. Please try again.', 'Upload failed');
        });
    });

    syncMatterUnknownFields();

    initMessages();
    notifyParentReady();

    console.log(
      '[matter-document-upload] ready · limits %s files · %s / file · %s total',
      MAX_FILES,
      formatBytes(MAX_BYTES_PER_FILE),
      formatBytes(MAX_TOTAL_BYTES)
    );
  });

  window.__MATTER_UPLOAD_CONSTANTS__ = {
    MAX_FILES: MAX_FILES,
    MAX_BYTES_PER_FILE: MAX_BYTES_PER_FILE,
    MAX_TOTAL_BYTES: MAX_TOTAL_BYTES,
  };
})();
