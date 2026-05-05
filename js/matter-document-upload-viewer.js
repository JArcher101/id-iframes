(function () {
  'use strict';

  var IFRAME_TYPE = 'matter-document-upload-viewer';

  var state = {
    submissionId: '',
    received: false,
    files: [],
  };

  function sendToParent(payload) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, '*');
      }
    } catch (e) {
      console.error('[matter-document-upload-viewer] postMessage failed', e);
    }
  }

  function notifyReady() {
    sendToParent({
      type: 'iframe-ready',
      iframeType: IFRAME_TYPE,
    });
  }

  /** Parent integrations may listen for either spelling — emit both. */
  function notifyFilesReceivedMarked(submissionId) {
    var body = {
      iframeType: IFRAME_TYPE,
      _id: submissionId,
      relatedMessageType: 'file-upload-submission',
    };
    sendToParent(Object.assign({ type: 'files-received' }, body));
    sendToParent(Object.assign({ type: 'files-recieved' }, body));
  }

  function normalizeParentMessage(raw) {
    if (!raw || typeof raw !== 'object') return { type: '', payload: {} };
    var type = String(raw.type || '');
    var merged = {};
    var i;
    var k;
    if (raw.data !== undefined && type && raw.data && typeof raw.data === 'object') {
      for (k in raw) {
        if (Object.prototype.hasOwnProperty.call(raw, k)) merged[k] = raw[k];
      }
      for (k in raw.data) {
        if (Object.prototype.hasOwnProperty.call(raw.data, k)) merged[k] = raw.data[k];
      }
    } else {
      for (k in raw) {
        if (Object.prototype.hasOwnProperty.call(raw, k)) merged[k] = raw[k];
      }
    }
    return { type: type, payload: merged };
  }

  function formatFileSize(bytes) {
    var n = typeof bytes === 'number' ? bytes : parseInt(bytes, 10);
    if (!n || n < 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(n) / Math.log(k));
    return parseFloat((n / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function isImageMime(mime) {
    return typeof mime === 'string' && mime.indexOf('image/') === 0;
  }

  function isVideoMime(mime) {
    return typeof mime === 'string' && mime.indexOf('video/') === 0;
  }

  function resolveOpenUrl(file, index, signedUrls) {
    var direct = file.signedUrl || file.url || file.liveUrl || file.href;
    if (direct) return String(direct);

    if (signedUrls && typeof signedUrls === 'object' && !Array.isArray(signedUrls)) {
      var sk = file.s3Key;
      if (sk && signedUrls[sk] != null) return String(signedUrls[sk]);
    }

    if (Array.isArray(signedUrls)) {
      var j;
      var entry;
      if (file.s3Key) {
        for (j = 0; j < signedUrls.length; j++) {
          entry = signedUrls[j];
          if (entry && entry.s3Key === file.s3Key) {
            return String(entry.url || entry.signedUrl || entry.href || '');
          }
        }
      }
      entry = signedUrls[index];
      if (entry) return String(entry.url || entry.signedUrl || entry.href || '');
    }

    return '';
  }

  function iconImageSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>' +
      '<circle cx="8.5" cy="8.5" r="1.5"></circle>' +
      '<polyline points="21 15 16 10 5 21"></polyline>' +
      '</svg>'
    );
  }

  function iconVideoSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polygon points="23 7 16 12 23 17 23 7"></polygon>' +
      '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>' +
      '</svg>'
    );
  }

  function iconDocumentSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>' +
      '<polyline points="14 2 14 8 20 8"></polyline>' +
      '<line x1="16" y1="13" x2="8" y2="13"></line>' +
      '<line x1="16" y1="17" x2="8" y2="17"></line>' +
      '<polyline points="10 9 9 9 8 9"></polyline>' +
      '</svg>'
    );
  }

  function fileKindIcon(mime) {
    if (isImageMime(mime)) return iconImageSvg();
    if (isVideoMime(mime)) return iconVideoSvg();
    return iconDocumentSvg();
  }

  function parseReceivedFlag(payload, submission) {
    if (payload.received === true || payload.recieved === true) return true;
    if (submission && (submission.received === true || submission.recieved === true)) return true;
    return false;
  }

  function showLoading(show) {
    var loadEl = document.getElementById('mduvLoading');
    var mainEl = document.getElementById('mduvMain');
    if (loadEl) loadEl.classList.toggle('hidden', !show);
    if (mainEl) mainEl.classList.toggle('hidden', show);
  }

  function renderSubmission(sub, payload) {
    var fn = (sub.firstName || '').trim();
    var ln = (sub.lastName || '').trim();
    document.getElementById('mduvFullName').textContent = (fn + ' ' + ln).trim() || '—';

    document.getElementById('mduvPhone').textContent = sub.phone || '—';
    document.getElementById('mduvEmail').textContent = sub.email || '—';

    var matterLine = '—';
    if (sub.matterReferenceUnknown) {
      matterLine = sub.matterDescription ? String(sub.matterDescription) : 'Matter reference not known';
    } else if (sub.matterReference) {
      matterLine = String(sub.matterReference);
    }
    document.getElementById('mduvMatterLine').textContent = matterLine;

    var dealing = sub.dealingWithLabel || sub.dealingWith || '—';
    document.getElementById('mduvDealing').textContent =
      dealing != null && dealing !== '' ? String(dealing) : '—';

    var noteWrap = document.getElementById('mduvGeneralNoteWrap');
    var noteEl = document.getElementById('mduvGeneralNote');
    var gn = sub.generalNote != null ? String(sub.generalNote).trim() : '';
    if (gn) {
      noteEl.textContent = gn;
      noteWrap.classList.remove('hidden');
    } else {
      noteEl.textContent = '';
      noteWrap.classList.add('hidden');
    }

    var badge = document.getElementById('mduvSubmitBadge');
    var actions = document.getElementById('mduvReceivedActions');
    var received = state.received;

    if (received) {
      badge.classList.remove('hidden');
      actions.classList.add('hidden');
    } else {
      badge.classList.add('hidden');
      actions.classList.remove('hidden');
    }
  }

  function openUrlInNewTab(url) {
    if (!url) return;
    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
  }

  function renderFiles(files, signedUrls) {
    var grid = document.getElementById('mduvFilesGrid');
    var empty = document.getElementById('mduvEmpty');
    grid.innerHTML = '';

    if (!files || !files.length) {
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    var enriched = [];
    var i;
    for (i = 0; i < files.length; i++) {
      enriched.push({
        raw: files[i],
        openUrl: resolveOpenUrl(files[i], i, signedUrls),
      });
    }
    state.files = enriched;

    enriched.forEach(function (item, index) {
      var f = item.raw;
      var card = document.createElement('div');
      card.className = 'mduv-file-card';
      card.setAttribute('role', 'listitem');

      var mime = f.mimeType || f.type || '';
      var friendly = (f.friendlyName || '').trim() || f.originalName || 'Untitled file';
      var note = (f.note || '').trim();
      var metaParts = [];
      if (f.originalName) metaParts.push(f.originalName);
      metaParts.push(formatFileSize(f.size));
      if (mime) metaParts.push(mime);

      var btnDisabled = !item.openUrl ? ' disabled' : '';
      var btnTitle = item.openUrl ? 'Open in new tab' : 'Signed URL not available';
      var descHtml = note ? '<p class="mduv-file-desc">' + escapeHtml(note) + '</p>' : '';

      card.innerHTML =
        '<div class="mduv-file-icon-wrap" aria-hidden="true">' +
        fileKindIcon(mime) +
        '</div>' +
        '<div class="mduv-file-body">' +
        '<div class="mduv-file-title-row">' +
        '<p class="mduv-file-title">' +
        escapeHtml(friendly) +
        '</p>' +
        '<button type="button" class="mduv-open-tab-btn" data-file-index="' +
        index +
        '"' +
        btnDisabled +
        ' title="' +
        escapeHtml(btnTitle) +
        '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>' +
        '<polyline points="15 3 21 3 21 9"></polyline>' +
        '<line x1="10" y1="14" x2="21" y2="3"></line>' +
        '</svg>' +
        'Open' +
        '</button>' +
        '</div>' +
        descHtml +
        '<div class="mduv-file-meta">' +
        escapeHtml(metaParts.join(' · ')) +
        '</div>' +
        '</div>';

      var btn = card.querySelector('.mduv-open-tab-btn');
      btn.addEventListener('click', function () {
        var u = state.files[index] && state.files[index].openUrl;
        openUrlInNewTab(u);
      });

      grid.appendChild(card);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function handleFileUploadSubmission(payload) {
    var sub = payload.submission;
    if (!sub || typeof sub !== 'object') {
      console.warn('[matter-document-upload-viewer] file-upload-submission missing submission');
      return;
    }

    state.submissionId = payload._id != null ? String(payload._id) : '';
    state.received = parseReceivedFlag(payload, sub);

    showLoading(false);
    renderSubmission(sub, payload);
    renderFiles(sub.files, payload.signedUrls);

    var markBtn = document.getElementById('mduvMarkReceivedBtn');
    if (markBtn) {
      markBtn.onclick = function () {
        if (!state.submissionId) {
          console.warn('[matter-document-upload-viewer] cannot mark received without _id');
          return;
        }
        notifyFilesReceivedMarked(state.submissionId);
        state.received = true;
        renderSubmission(sub, payload);
        markBtn.disabled = true;
      };
      markBtn.disabled = state.received;
    }
  }

  window.addEventListener('message', function (event) {
    var parsed = normalizeParentMessage(event.data);
    if (parsed.type === 'file-upload-submission') {
      handleFileUploadSubmission(parsed.payload);
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    notifyReady();
  });
})();
