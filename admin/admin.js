/* Shared admin code: reading content from GitHub, saving it as one commit,
   the Live / Publishing pill, loading screen, images, dragging, editors. */
(function () {
  var GH = window.GH;
  var R = GH.repoPath;
  var A = {};
  window.A = A;

  /* ---------- Small helpers ---------- */
  A.$ = function (sel, root) { return (root || document).querySelector(sel); };
  A.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  A.esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  A.slugify = function (s) {
    return String(s || '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[’'‘`]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled';
  };
  A.rand = function (n) {
    var c = 'abcdefghijkmnpqrstuvwxyz23456789', s = '';
    var buf = new Uint8Array(n || 6);
    crypto.getRandomValues(buf);
    for (var i = 0; i < buf.length; i++) s += c[buf[i] % c.length];
    return s;
  };
  A.param = function (k) { return new URLSearchParams(location.search).get(k); };
  A.fmtBytes = function (b) {
    if (!b && b !== 0) return '–';
    if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
    return (b / 1024 / 1024).toFixed(1) + ' MB';
  };
  A.json = function (o) { return JSON.stringify(o, null, 2) + '\n'; };

  function b64ToText(b64) {
    var bin = atob(b64.replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  A.blobToBase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  };

  A.toast = function (msg, isError) {
    var t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isError ? 6000 : 2600);
  };

  /* ---------- Loading screen ---------- */
  A.ready = function () {
    var l = document.getElementById('loader');
    if (l) { l.classList.add('done'); setTimeout(function () { l.remove(); }, 250); }
  };
  A.fail = function (err) {
    console.error(err);
    var l = document.getElementById('loader');
    var msg = (err && err.message) || String(err);
    if (err && err.status === 404) msg = 'This sign-in can’t see the site’s files on GitHub. Check the token has access to ' + GH.REPO + '.';
    if (l) {
      l.classList.remove('done');
      l.innerHTML = '<div style="max-width:420px;padding:0 16px"><div class="loader-name" style="display:block">Couldn’t load</div><p class="error-text">' + A.esc(msg) + '</p><p><a href="" class="btn" style="margin-top:12px">Try again</a></p></div>';
    } else {
      A.toast(msg, true);
    }
  };

  /* ---------- Reading content ---------- */
  // One call lists every file on main; file contents are fetched by their
  // fingerprint (sha) and remembered for this browser tab.
  var treeCache = null;
  A.tree = function (fresh) {
    if (treeCache && !fresh) return treeCache;
    treeCache = GH.json(R + '/git/trees/' + GH.BRANCH + '?recursive=1').then(function (t) {
      var files = {};
      t.tree.forEach(function (e) { if (e.type === 'blob') files[e.path] = e.sha; });
      return { sha: t.sha, files: files };
    });
    return treeCache;
  };

  A.blobText = function (sha) {
    var key = 'blob:' + sha;
    try { var hit = sessionStorage.getItem(key); if (hit != null) return Promise.resolve(hit); } catch (e) {}
    return GH.json(R + '/git/blobs/' + sha).then(function (b) {
      var text = b64ToText(b.content);
      try { sessionStorage.setItem(key, text); } catch (e) {}
      return text;
    });
  };

  A.readJSON = function (path) {
    return A.tree().then(function (t) {
      if (!t.files[path]) return null;
      return A.blobText(t.files[path]).then(JSON.parse);
    });
  };

  // All items in a folder, e.g. content/works -> [{slug, path, data}]
  A.readFolder = function (dir) {
    return A.tree().then(function (t) {
      var paths = Object.keys(t.files).filter(function (p) {
        return p.indexOf(dir + '/') === 0 && /\.json$/.test(p) && p.slice(dir.length + 1).indexOf('/') < 0;
      }).sort();
      return Promise.all(paths.map(function (p) {
        return A.blobText(t.files[p]).then(function (txt) {
          return { slug: p.slice(dir.length + 1).replace(/\.json$/, ''), path: p, data: JSON.parse(txt) };
        });
      }));
    });
  };

  /* ---------- Saving: one commit to main ---------- */
  // changes: [{path, text}] | [{path, blob}] (images) | [{path, remove: true}]
  //          | [{path, update: function(currentText or null) -> new text, or null to delete}]
  // If someone else saved meanwhile, the commit is redone on top of the newest version.
  A.commit = function (message, changes) {
    var blobShas = {};
    function makeBlob(c) {
      if (blobShas[c.path]) return Promise.resolve(blobShas[c.path]);
      var p = c.blob
        ? A.blobToBase64(c.blob).then(function (b64) { return { content: b64, encoding: 'base64' }; })
        : Promise.resolve({ content: c.text, encoding: 'utf-8' });
      return p.then(function (body) {
        return GH.json(R + '/git/blobs', { method: 'POST', body: body });
      }).then(function (r) { blobShas[c.path] = r.sha; return r.sha; });
    }
    function currentText(path, commitSha) {
      return GH.request(R + '/contents/' + encodeURI(path) + '?ref=' + commitSha, { accept: 'application/vnd.github.raw+json' })
        .then(function (res) {
          if (res.status === 404) return null;
          if (!res.ok) throw new Error('Couldn’t read ' + path + ' (' + res.status + ')');
          return res.text();
        });
    }
    function attempt(n) {
      var head, baseTree, existing;
      return GH.json(R + '/git/ref/heads/' + GH.BRANCH).then(function (ref) {
        head = ref.object.sha;
        return GH.json(R + '/git/commits/' + head);
      }).then(function (c) {
        baseTree = c.tree.sha;
        var needList = changes.some(function (c) { return c.remove || c.update; });
        return needList ? GH.json(R + '/git/trees/' + baseTree + '?recursive=1') : null;
      }).then(function (t) {
        existing = {};
        if (t) t.tree.forEach(function (e) { existing[e.path] = true; });
        return Promise.all(changes.map(function (c) {
          if (c.remove) {
            return existing[c.path] ? { path: c.path, mode: '100644', type: 'blob', sha: null } : null;
          }
          if (c.update) {
            return currentText(c.path, head).then(function (old) {
              var next = c.update(old);
              if (next === undefined || next === old) return null;
              if (next === null) return existing[c.path] ? { path: c.path, mode: '100644', type: 'blob', sha: null } : null;
              return GH.json(R + '/git/blobs', { method: 'POST', body: { content: next, encoding: 'utf-8' } })
                .then(function (r) { return { path: c.path, mode: '100644', type: 'blob', sha: r.sha }; });
            });
          }
          return makeBlob(c).then(function (sha) { return { path: c.path, mode: '100644', type: 'blob', sha: sha }; });
        }));
      }).then(function (entries) {
        entries = entries.filter(Boolean);
        if (!entries.length) return { sha: head, unchanged: true };
        return GH.json(R + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: entries } })
          .then(function (tree) {
            return GH.json(R + '/git/commits', { method: 'POST', body: { message: message, tree: tree.sha, parents: [head] } });
          })
          .then(function (commit) {
            return GH.json(R + '/git/refs/heads/' + GH.BRANCH, { method: 'PATCH', body: { sha: commit.sha, force: false } })
              .then(function () { return { sha: commit.sha }; });
          });
      }).catch(function (err) {
        // 422 / 409: main moved on while we were saving. Try again on top of it.
        if ((err.status === 422 || err.status === 409) && n < 5) {
          return new Promise(function (r) { setTimeout(r, 400 + Math.random() * 600 * n); }).then(function () { return attempt(n + 1); });
        }
        if (err.status === 403 || err.status === 404) {
          err.message = 'GitHub refused the save. The sign-in may not have permission to change ' + GH.REPO + '. (' + err.message + ')';
        }
        throw err;
      });
    }
    return attempt(1).then(function (res) {
      treeCache = null;
      if (!res.unchanged) A.watchPublishing(res.sha);
      return res;
    });
  };

  /* ---------- Live / Publishing pill ---------- */
  var pollTimer = null, pollStart = 0, expected = null;
  function pill() { return document.getElementById('status'); }
  function showPill(state) {
    var p = pill();
    if (!p) return;
    if (!state) { p.hidden = true; return; }
    p.hidden = false;
    p.className = 'status ' + state;
    p.innerHTML = '<i></i><span class="label">' + (state === 'live' ? 'Live' : 'Publishing') + '</span>';
    p.title = state === 'live'
      ? 'The live site shows the latest save.'
      : 'Netlify is rebuilding the site with the latest save. This usually takes under a minute.';
  }
  function checkStatus() {
    return Promise.all([
      GH.json(R + '/git/ref/heads/' + GH.BRANCH).then(function (r) { return r.object.sha; }),
      fetch('/admin/version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (res) {
      var head = expected || res[0], built = res[1] && res[1].commit;
      if (!built) { showPill(null); return; }
      if (head === built || (res[0] === built)) {
        expected = null;
        showPill('live');
        stopPolling();
      } else {
        showPill('publishing');
        startPolling();
      }
    }).catch(function () { /* keep the last state */ });
  }
  function startPolling() {
    if (pollTimer) return;
    pollStart = Date.now();
    pollTimer = setInterval(function () {
      if (Date.now() - pollStart > 15 * 60 * 1000) { stopPolling(); return; }
      checkStatus();
    }, 4000);
  }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }
  A.watchPublishing = function (sha) {
    expected = sha || null;
    showPill('publishing');
    startPolling();
  };
  A.checkStatus = checkStatus;
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkStatus(); });

  /* ---------- Images ---------- */
  A.ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];
  A.MAX_BYTES = 20 * 1024 * 1024;
  A.MAX_SIDE = 2400;

  A.imageURL = function (src) { return src ? '/' + String(src).replace(/^\//, '') : ''; };
  // A new image may not be on the live site until Netlify finishes. Then load it from GitHub.
  A.showImage = function (img, src) {
    img.onerror = function () {
      img.onerror = null;
      GH.request(R + '/contents/' + encodeURI(src) + '?ref=' + GH.BRANCH, { accept: 'application/vnd.github.raw' })
        .then(function (r) { if (!r.ok) throw new Error(); return r.blob(); })
        .then(function (b) { img.src = URL.createObjectURL(b); })
        .catch(function () {});
    };
    img.src = A.imageURL(src);
  };

  // Check, shrink to 2400 px on the long side if needed, and measure an image file.
  A.prepareImage = function (file) {
    if (!file) return Promise.reject(new Error('No file.'));
    if (A.ACCEPT.indexOf(file.type) < 0) return Promise.reject(new Error('Please use a JPG, PNG or WebP image.'));
    if (file.size > A.MAX_BYTES) return Promise.reject(new Error('That image is ' + A.fmtBytes(file.size) + '. The limit is 20 MB.'));
    return loadBitmap(file).then(function (bmp) {
      var w = bmp.width, h = bmp.height;
      var long = Math.max(w, h);
      var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type];
      var passMode = (GH.readAuth() || {}).mode !== 'token';
      // Small enough already: keep the original file untouched.
      if (long <= A.MAX_SIDE && !(passMode && file.size > 4 * 1024 * 1024)) {
        return { blob: file, ext: ext, width: w, height: h, bytes: file.size, name: file.name };
      }
      var scale = Math.min(1, A.MAX_SIDE / long);
      var tw = Math.round(w * scale), th = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = tw; canvas.height = th;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      var keepPNG = file.type === 'image/png' && hasAlpha(bmp);
      if (!keepPNG) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th); }
      ctx.drawImage(bmp, 0, 0, tw, th);
      var type = keepPNG ? 'image/png' : 'image/jpeg';
      return toBlob(canvas, type, 0.88).then(function (blob) {
        if (!keepPNG && blob.size > 4.2 * 1024 * 1024) return toBlob(canvas, type, 0.78);
        return blob;
      }).then(function (blob) {
        return { blob: blob, ext: keepPNG ? 'png' : 'jpg', width: tw, height: th, bytes: blob.size, name: file.name };
      });
    });
  };
  function loadBitmap(file) {
    if (window.createImageBitmap) {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadImg(file); });
    }
    return loadImg(file);
  }
  function loadImg(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('That file couldn’t be opened as an image.')); };
      img.src = URL.createObjectURL(file);
    });
  }
  function hasAlpha(bmp) {
    try {
      var c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      var x = c.getContext('2d');
      x.drawImage(bmp, 0, 0, 64, 64);
      var d = x.getImageData(0, 0, 64, 64).data;
      for (var i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    } catch (e) {}
    return false;
  }
  function toBlob(canvas, type, q) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('Couldn’t shrink the image.')); }, type, q);
    });
  }

  /* Image drop zone. opts: {el, metaEl, onChange(image or null), hint}
     The zone's value is {src, width, height, alt} (saved) or a prepared upload. */
  A.dropZone = function (opts) {
    var el = opts.el, meta = opts.metaEl;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = A.ACCEPT.join(',');
    input.hidden = true;
    el.appendChild(input);
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.insertAdjacentHTML('beforeend',
      '<div class="drop-empty">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg>' +
      '<div class="big">Drop an image or click to upload</div>' +
      '<div class="small">' + A.esc(opts.hint || 'JPG, PNG or WebP, up to 20 MB. Large images are shrunk to 2400 px.') + '</div></div>' +
      '<img alt="">');
    el.setAttribute('aria-label', 'Image: drop a file or press to upload');
    var img = el.querySelector('img');
    var state = { saved: opts.value || null, upload: null, removed: false };

    function current() {
      if (state.upload) return state.upload;
      if (state.removed) return null;
      return state.saved && state.saved.src ? state.saved : null;
    }
    function render() {
      var c = current();
      el.classList.toggle('has-image', !!c);
      if (c && c.preview) img.src = c.preview;
      else if (c) A.showImage(img, c.src);
      if (meta) {
        var name = c ? (c.name || String(c.src).split('/').pop()) : 'None yet';
        meta.innerHTML =
          '<dl><div style="min-width:0"><dt>File</dt><dd>' + A.esc(name) + '</dd></div>' +
          '<div><dt>Size</dt><dd>' + (c && c.bytes ? A.fmtBytes(c.bytes) : '–') + '</dd></div>' +
          '<div><dt>Dimensions</dt><dd>' + (c ? c.width + ' × ' + c.height : '–') + '</dd></div></dl>' +
          '<div class="actions">' +
          '<button class="btn" type="button" data-act="replace"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M6 10l6-6 6 6M4 20h16"></path></svg>' + (c ? 'Replace' : 'Upload') + '</button>' +
          (c ? '<button class="btn ghost" type="button" data-act="remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>Remove</button>' : '') +
          '</div><p class="error-text" data-err hidden></p>';
      }
    }
    function error(msg) {
      var e = meta && meta.querySelector('[data-err]');
      if (e) { e.textContent = msg; e.hidden = !msg; } else if (msg) A.toast(msg, true);
    }
    function take(file) {
      error('');
      var busy = document.createElement('div');
      busy.className = 'busy';
      busy.textContent = 'Preparing image…';
      el.appendChild(busy);
      A.prepareImage(file).then(function (u) {
        u.preview = URL.createObjectURL(u.blob);
        state.upload = u;
        render();
        opts.onChange && opts.onChange(current());
      }).catch(function (e) { error(e.message); })
        .then(function () { busy.remove(); });
    }
    el.addEventListener('click', function (e) { if (e.target === input) return; input.click(); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('change', function () { if (input.files[0]) take(input.files[0]); input.value = ''; });
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave', function () { el.classList.remove('over'); });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      el.classList.remove('over');
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) take(f);
    });
    if (meta) meta.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'replace') input.click();
      if (b.dataset.act === 'remove') {
        state.upload = null;
        state.removed = true;
        render();
        opts.onChange && opts.onChange(null);
      }
    });
    render();
    return {
      value: current,
      // For the "has something changed" check.
      signature: function () { var c = current(); return c ? (c.preview || c.src) : ''; },
      hasUpload: function () { return !!state.upload; },
      // Called after a save, with the stored image.
      saved: function (v) { state.saved = v; state.upload = null; state.removed = false; render(); },
    };
  };

  // Work out the files for an image change: a fresh file name for a new upload,
  // and removing the image it replaces. Returns {image, changes}.
  A.imageChanges = function (zone, oldImage, folder, base, alt) {
    var cur = zone.value();
    var changes = [];
    var image = null;
    if (zone.hasUpload()) {
      var path = 'images/' + folder + '/' + A.slugify(base) + '-' + A.rand(6) + '.' + cur.ext;
      changes.push({ path: path, blob: cur.blob });
      image = { src: path, width: cur.width, height: cur.height, alt: alt || '' };
    } else if (cur) {
      image = { src: cur.src, width: cur.width, height: cur.height, alt: alt || '' };
    }
    var oldSrc = oldImage && oldImage.src;
    if (oldSrc && (!image || image.src !== oldSrc)) changes.push({ path: oldSrc, remove: true });
    return { image: image, changes: changes };
  };

  /* ---------- Editors: Save button, unsaved changes, Cmd/Ctrl+S ---------- */
  A.editor = function (opts) {
    var btn = document.getElementById('save');
    var label = document.getElementById('save-state');
    var initial = null, saving = false;
    function dirty() { return initial !== null && JSON.stringify(opts.state()) !== initial; }
    function update() {
      var d = dirty();
      btn.disabled = !d || saving;
      if (saving) return;
      label.className = 'save-state' + (d ? ' dirty' : '');
      label.textContent = d ? 'Unsaved changes' : (label.dataset.saved ? 'Saved' : '');
    }
    function save() {
      if (!dirty() || saving) return;
      var check = opts.validate && opts.validate();
      if (check) { A.toast(check, true); return; }
      saving = true;
      btn.disabled = true;
      label.className = 'save-state';
      label.textContent = 'Saving…';
      Promise.resolve().then(opts.save).then(function () {
        saving = false;
        initial = JSON.stringify(opts.state());
        label.dataset.saved = '1';
        update();
        opts.afterSave && opts.afterSave();
      }).catch(function (e) {
        saving = false;
        console.error(e);
        label.className = 'save-state error';
        label.textContent = 'Not saved';
        btn.disabled = false;
        A.toast('Couldn’t save: ' + e.message, true);
      });
    }
    btn.addEventListener('click', save);
    document.addEventListener('input', update);
    document.addEventListener('change', update);
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', function (e) {
      if (dirty() || saving) { e.preventDefault(); e.returnValue = ''; }
    });
    return {
      start: function () { initial = JSON.stringify(opts.state()); update(); },
      update: update,
      dirty: dirty,
      leave: function (href) { initial = JSON.stringify(opts.state()); location.href = href; },
    };
  };

  /* ---------- Drag to reorder (mouse, pen and touch) ---------- */
  // Touch: press and hold briefly to pick a card up, so the page still scrolls.
  A.sortable = function (container, opts) {
    var itemSel = opts.items;
    var drag = null;
    function items() { return A.$$(itemSel, container); }
    container.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || (opts.disabled && opts.disabled())) return;
      var item = e.target.closest(itemSel);
      if (!item || !container.contains(item)) return;
      var start = { x: e.clientX, y: e.clientY, id: e.pointerId, item: item, touch: e.pointerType === 'touch', ready: e.pointerType !== 'touch', active: false, timer: null };
      if (start.touch) start.timer = setTimeout(function () { start.ready = true; begin(start, start.x, start.y); }, 300);
      drag = start;
    });
    function begin(d, x, y) {
      if (d.active) return;
      d.active = true;
      var r = d.item.getBoundingClientRect();
      d.dx = x - r.left; d.dy = y - r.top;
      d.ghost = d.item.cloneNode(true);
      d.ghost.classList.add('drag-ghost');
      d.ghost.style.width = r.width + 'px';
      d.ghost.style.left = r.left + 'px';
      d.ghost.style.top = r.top + 'px';
      document.body.appendChild(d.ghost);
      d.item.classList.add('dragging');
      document.body.classList.add('is-dragging');
      if (navigator.vibrate && d.touch) navigator.vibrate(10);
    }
    window.addEventListener('pointermove', function (e) {
      var d = drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.active) {
        var moved = Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
        if (d.touch) { if (moved > 10) { clearTimeout(d.timer); drag = null; } return; }
        if (moved < 6) return;
        begin(d, e.clientX, e.clientY);
      }
      e.preventDefault();
      d.ghost.style.left = (e.clientX - d.dx) + 'px';
      d.ghost.style.top = (e.clientY - d.dy) + 'px';
      // Where to drop: the card under the pointer.
      var under = document.elementFromPoint(e.clientX, e.clientY);
      var target = under && under.closest(itemSel);
      if (target && target !== d.item && container.contains(target)) {
        var list = items();
        var from = list.indexOf(d.item), to = list.indexOf(target);
        if (from < to) target.after(d.item); else target.before(d.item);
      }
      // Scroll near the screen edges.
      if (e.clientY < 90) window.scrollBy(0, -12);
      else if (e.clientY > innerHeight - 50) window.scrollBy(0, 12);
    }, { passive: false });
    window.addEventListener('touchmove', function (e) { if (drag && drag.active) e.preventDefault(); }, { passive: false });
    function end(e) {
      var d = drag;
      if (!d || (e && e.pointerId !== d.id)) return;
      clearTimeout(d.timer);
      drag = null;
      if (!d.active) return;
      d.ghost.remove();
      d.item.classList.remove('dragging');
      document.body.classList.remove('is-dragging');
      // Swallow the click that follows a drag.
      var stop = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
      d.item.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(function () { d.item.removeEventListener('click', stop, { capture: true }); }, 50);
      opts.onEnd && opts.onEnd();
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    container.addEventListener('contextmenu', function (e) { if (e.target.closest(itemSel)) e.preventDefault(); });
    container.addEventListener('dragstart', function (e) { e.preventDefault(); });
  };

  /* ---------- Works layout (the composed rows on the homepage) ---------- */
  // Positions are percentages of the row; heights are in units of a 915 px row.
  var IMG_H = 231, MAX_W = 41.09, CAPTION = 90;
  A.workRatio = function (w) {
    var i = w.image;
    if (i && i.width && i.height) return Math.round(i.width / i.height * 1000) / 1000;
    return (w.layout && w.layout.ratio) || 0.8;
  };
  // Lay a row out from scratch: left, centre, right like the existing rows.
  A.autoLayout = function (works) {
    var n = works.length;
    if (!n) return;
    var widths = works.map(function (w) { return Math.min(MAX_W, IMG_H * A.workRatio(w) / 915 * 100); });
    var total = widths.reduce(function (a, b) { return a + b; }, 0);
    var room = 100 - (n - 1) * 4;
    if (total > room) { widths = widths.map(function (x) { return x * room / total; }); total = room; }
    var lefts;
    if (n === 1) lefts = [0];
    else if (n === 3) lefts = [0, 50 - widths[1] / 2, 100 - widths[2]];
    else {
      var gap = (100 - total) / (n - 1), x = 0;
      lefts = widths.map(function (w) { var l = x; x += w + gap; return l; });
    }
    works.forEach(function (w, i) {
      w.layout = w.layout || {};
      w.layout.left = round2(lefts[i]);
      w.layout.width = round2(widths[i]);
      w.layout.ratio = A.workRatio(w);
    });
  };
  // Put works into the slots the row already has, in a new order.
  // Each keeps its own size; first slot keeps its left edge, last its right edge,
  // the others their centre. Falls back to a fresh layout if things would overlap.
  A.slotLayout = function (ordered) {
    var slots = ordered.map(function (w) { return { left: w.layout.left, width: w.layout.width }; })
      .sort(function (a, b) { return a.left - b.left; });
    var n = slots.length;
    var next = ordered.map(function (w, i) {
      var s = slots[i], width = w.layout.width, left;
      if (i === 0) left = s.left;
      else if (i === n - 1) left = s.left + s.width - width;
      else left = s.left + s.width / 2 - width / 2;
      return { left: round2(left), width: width };
    });
    for (var i = 1; i < n; i++) {
      if (next[i].left < next[i - 1].left + next[i - 1].width + 1) { A.autoLayout(ordered); return; }
    }
    ordered.forEach(function (w, i) { w.layout.left = next[i].left; });
  };
  A.rowNeedsHeight = function (works) {
    var tallest = Math.max.apply(null, works.map(function (w) { return w.layout.width / 100 * 915 / (w.layout.ratio || 1); }));
    return tallest + 60;
  };
  // rows.json update: forget stored heights for these rows so the build sizes them.
  A.forgetRowHeights = function (rows) {
    return {
      path: 'content/rows.json',
      update: function (old) {
        var data = old ? JSON.parse(old) : { heights: {} };
        data.heights = data.heights || {};
        var changed = false;
        rows.forEach(function (r) { if (data.heights[r] != null) { delete data.heights[r]; changed = true; } });
        return changed ? A.json(data) : old;
      },
    };
  };
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- Page start ---------- */
  A.start = function (fn) {
    document.addEventListener('DOMContentLoaded', function () {
      if (!GH.readAuth()) return;
      checkStatus();
      Promise.resolve().then(fn).then(A.ready).catch(A.fail);
    });
  };
})();
