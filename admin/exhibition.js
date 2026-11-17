/* One exhibition's page: adding a new exhibition (?new=1) or editing one (?slug=…).
   Layout from alona's design (2026-11-17): Title + Place and year left, Main image
   right; three columns of a big word over its text; "Add images" (horizontal photos
   one per row, vertical ones two side by side). Save & Publish; Preview page opens
   the page as it will look, before saving.
   Hand-made pages (src/abimal.html etc.) keep their hand-set layout: texts can be
   rewritten and photos replaced in place, saved as "pageEdits" and applied by
   build.mjs, which numbers the texts the same way as TEXT_RE below. */
A.start(function () {
  var slug = A.param('slug');
  var isNew = !slug || A.param('new') === '1';
  var $ = function (id) { return document.getElementById(id); };
  var TEXT_RE = /<(h1|p) class="(ex-label|ex-title|ex-p|rc-credit)\b([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g;
  var IMG_RE = /<img src="\{\{root\}\}([^"]+)" alt="([^"]*)" width="(\d+)" height="(\d+)"/g;
  var RESERVED = ['works', 'about', 'exhibited', 'legal', 'lens', 'admin', 'images', 'icons', 'fonts', 'home-1', 'about-1',
    'abimal', 'coldrush', 'venerate', 'regards-croises', 'snapshots', 'content', 'src', 'dist'];
  var all = [], me = null, hand = false, ed = null, zone = null;
  var texts = [], cols = [], photos = [];
  function clean(t) { return String(t || '').trim().replace(/^[„“"']+|[“”"']+$/g, ''); }
  function norm(s) { return String(s || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).join('\n').trim(); }
  function fromHTML(s) {
    s = s.replace(/&shy;/g, '').replace(/<br\s*\/?>/gi, '\u0001').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
      .replace(/ ?\u0001 ?/g, '\n').trim();
    var t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }
  function heading() {
    var t = clean($('title').value);
    $('item-name').textContent = isNew ? 'Adding new exhibition' : (t || 'Exhibition');
    document.title = (isNew ? 'New exhibition' : (t || 'Exhibition')) + ' · Hamza Shah admin';
  }

  /* ---------- Photos (both kinds of page) ---------- */
  function shapeOf(c) { return c && c.width && c.height && c.height > c.width ? 'tall' : 'wide'; }
  function photoSlot(value, opts) {
    var wrap = document.createElement('div');
    wrap.className = 'ep-ph ' + shapeOf(value);
    wrap.innerHTML = '<div class="drop"></div><div class="image-meta"></div>';
    $('photos').appendChild(wrap);
    var o = { el: wrap.querySelector('.drop'), metaEl: wrap.querySelector('.image-meta'), value: value };
    for (var k in opts) o[k] = opts[k];
    var p = { wrap: wrap };
    var change = o.onChange;
    o.onChange = function (c) {
      if (c) { wrap.classList.remove('tall', 'wide'); wrap.classList.add(shapeOf(c)); }
      change && change(c);
    };
    p.zone = A.dropZone(o);
    return p;
  }

  /* ---------- Hand-made page ---------- */
  function loadHand(html) {
    var edits = me.data.pageEdits || {};
    var et = edits.texts || {}, ep = edits.photos || {};
    var m, i = 0, para = 0;
    $('cols').hidden = true;
    $('texts').hidden = false;
    $('add-images').hidden = true;
    TEXT_RE.lastIndex = 0;
    while ((m = TEXT_RE.exec(html))) {
      var k = String(i++);
      if (m[2] === 'ex-label') continue; // "Latest / Previous exhibition" is set by the site
      var def = fromHTML(m[5]);
      var label = m[2] === 'ex-title' ? 'Title on the page' : m[2] === 'rc-credit' ? 'Credit' : 'Paragraph ' + (++para);
      var el = document.createElement('div');
      el.innerHTML = '<label class="lbl" for="tx' + k + '"></label><textarea class="field" id="tx' + k + '"></textarea>';
      el.querySelector('label').textContent = label;
      var ta = el.querySelector('textarea');
      ta.value = typeof et[k] === 'string' ? et[k] : def;
      ta.rows = Math.min(14, Math.max(2, Math.ceil(ta.value.length / 90) + (ta.value.match(/\n/g) || []).length));
      $('texts').appendChild(el);
      texts.push({ k: k, def: def, el: ta });
    }
    var list = [];
    IMG_RE.lastIndex = 0;
    while ((m = IMG_RE.exec(html))) {
      var t = document.createElement('textarea');
      t.innerHTML = m[2];
      list.push({ src: m[1], alt: t.value, width: Number(m[3]), height: Number(m[4]) });
    }
    list.forEach(function (def, n) {
      var p = { def: def, old: ep[def.src] || null };
      var opts = {
        canRemove: function (c) { return c.src !== def.src; },
        removeLabel: 'Original',
        removeConfirm: 'Put the original photo back in this place?',
        removeOk: 'Put it back',
        onChange: function (c) { if (!c) p.zone.saved(def); ed && ed.update(); },
      };
      if (n === 0) {
        opts.el = $('drop'); opts.metaEl = $('drop-meta'); opts.value = p.old || def;
        p.zone = A.dropZone(opts);
      } else {
        var s = photoSlot(p.old || def, opts);
        p.zone = s.zone;
      }
      photos.push(p);
    });
    $('ep-hint').hidden = false;
    $('ep-hint').textContent = 'This page’s layout was set by hand, so every text and photo keeps its place. Keep texts about the same length so they fit. Title and Place are what the Exhibited page shows.';
    $('photos-hint').textContent = 'Each photo keeps its place and frame on the page: you can replace one, not add or remove. “Original” brings the first photo back.';
  }
  function saveHand(d) {
    var changes = [];
    var et = {}, ep = {};
    texts.forEach(function (t) { if (norm(t.el.value) !== norm(t.def)) et[t.k] = norm(t.el.value); });
    photos.forEach(function (p, n) {
      var c = p.zone.value();
      if (!p.zone.hasUpload() && c && c.src === p.def.src) {
        if (p.old && A.ownImage(p.old.src)) changes.push({ path: p.old.src, remove: true });
        return;
      }
      var r = A.imageChanges(p.zone, p.old, 'exhibitions', slug + '-page-' + (n + 1), p.def.alt);
      r.changes.forEach(function (x) { changes.push(x); });
      if (r.image) ep[p.def.src] = r.image;
    });
    if (Object.keys(et).length || Object.keys(ep).length) d.pageEdits = { texts: et, photos: ep };
    else delete d.pageEdits;
    return { changes: changes, after: function () {
      photos.forEach(function (p) { p.old = ep[p.def.src] || null; p.zone.saved(p.old || p.def); });
    } };
  }

  /* ---------- Page made in the admin (or a new one) ---------- */
  function addPhoto(v) {
    var p = { orig: v || null };
    var s = photoSlot(v, { onChange: function () {
      // Remove takes the whole slot away.
      if (!p.zone.value()) { photos.splice(photos.indexOf(p), 1); p.wrap.remove(); }
      ed && ed.update();
    } });
    p.zone = s.zone;
    p.wrap = s.wrap;
    s.wrap._p = p;
    photos.push(p);
    return p;
  }
  function loadAuto() {
    var d = me ? me.data : {};
    zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: d.image || null, canRemove: function () { return false; },
      hint: 'Landscape works best: it opens the page across its full width. Also the photo on the Exhibited page.',
      onChange: function () { ed && ed.update(); } });
    var c = d.columns || [];
    if (!c.length && d.text) c = [{ word: '', text: d.text }];
    var ph = [['Ve', 'This installation grew out of…'], ['Ne', 'The chain connects the piece…'], ['Rate', 'Here it’s transformed into…']];
    for (var i = 0; i < 3; i++) {
      var col = document.createElement('div');
      col.className = 'ep-col';
      col.innerHTML = '<input class="field ep-word" type="text" autocomplete="off" aria-label="Big word, column ' + (i + 1) + '">' +
        '<textarea class="field ep-text" rows="12" aria-label="Text, column ' + (i + 1) + '"></textarea>';
      var w = col.querySelector('input'), t = col.querySelector('textarea');
      w.placeholder = ph[i][0]; t.placeholder = ph[i][1];
      w.value = (c[i] && c[i].word) || '';
      t.value = (c[i] && c[i].text) || '';
      $('cols').appendChild(col);
      cols.push({ word: w, text: t });
    }
    (d.photos || []).forEach(addPhoto);
    A.sortable($('photos'), { items: '.ep-ph', handle: '.pic', onEnd: function () {
      var els = A.$$('.ep-ph', $('photos'));
      photos.sort(function (a, b) { return els.indexOf(a.wrap) - els.indexOf(b.wrap); });
      ed.update();
    } });
    var pick = document.createElement('input');
    pick.type = 'file'; pick.multiple = true; pick.accept = A.ACCEPT.join(','); pick.hidden = true;
    document.body.appendChild(pick);
    $('add-images').addEventListener('click', function () { pick.click(); });
    pick.addEventListener('change', function () {
      Array.prototype.forEach.call(pick.files, function (f) { addPhoto(null).zone.take(f); });
      pick.value = '';
      ed && ed.update();
    });
    $('photos-hint').textContent = 'Horizontal photos go one per row; vertical ones sit two side by side. Drag a photo to move it.';
  }
  function saveAuto(d) {
    var changes = [], kept = {};
    d.columns = cols.map(function (c) { return { word: c.word.value.trim(), text: c.text.value.trim() }; });
    delete d.text;
    d.page = 'auto';
    var img = A.imageChanges(zone, me && me.data.image, 'exhibitions', slug, (me && me.data.image && me.data.image.alt) || clean(d.title));
    img.changes.forEach(function (c) { changes.push(c); });
    d.image = img.image;
    d.photos = photos.map(function (p, k) {
      var r = A.imageChanges(p.zone, null, 'exhibitions', slug + '-' + (k + 2), (p.orig && p.orig.alt) || clean(d.title));
      r.changes.forEach(function (c) { changes.push(c); });
      if (r.image) kept[r.image.src] = true;
      return r.image;
    }).filter(Boolean);
    ((me && me.data.photos) || []).forEach(function (p) { if (p && A.ownImage(p.src) && !kept[p.src]) changes.push({ path: p.src, remove: true }); });
    return { changes: changes, after: function () {
      zone.saved(d.image);
      photos.forEach(function (p, k) { p.orig = d.photos[k]; p.zone.saved(d.photos[k]); });
    } };
  }

  /* ---------- Preview: the page as it will look, before saving ---------- */
  function esc(s) { return A.esc(s); }
  function abs(c) { return c ? (c.preview || new URL(A.imageURL(c.src), location.href).href) : ''; }
  function previewHTML() {
    var title = clean($('title').value), place = $('place').value.trim();
    var main = (hand ? photos[0].zone : zone).value();
    var latest = isNew || (all[0] && me && all[0].slug === me.slug);
    var fig = function (c, cls) { return c ? '<figure class="' + cls + '"><img src="' + esc(abs(c)) + '" alt=""></figure>' : ''; };
    var body = '<p class="exg-label">' + (latest ? 'Latest exhibition' : 'Previous exhibition') + '</p>' +
      '<h1 class="exg-title">' + esc(title) + (place ? ' - ' + esc(place) : '') + '</h1>' + fig(main, 'exg-first');
    var paras = function (t) { return t.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean)
      .map(function (x) { return '<p class="ex-p">' + esc(x).replace(/\n/g, '<br>') + '</p>'; }).join(''); };
    if (hand) {
      body += '<div class="exg-text">' + texts.filter(function (t) { return !/^Title/.test(t.el.labels[0].textContent); })
        .map(function (t) { return paras(t.el.value); }).join('') + '</div>';
    } else if (cols.some(function (c) { return c.word.value.trim() || c.text.value.trim(); })) {
      body += '<div class="exg-cols">' + cols.map(function (c) {
        return '<div class="exg-col">' + (c.word.value.trim() ? '<p class="exg-word">' + esc(c.word.value.trim()) + '</p>' : '') + paras(c.text.value) + '</div>';
      }).join('') + '</div>';
    }
    var rest = (hand ? photos.slice(1) : photos).map(function (p) { var c = p.zone.value(); return fig(c, shapeOf(c)); }).join('');
    if (rest) body += '<div class="exg-photos">' + rest + '</div>';
    var root = new URL('../', location.href).href;
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Preview · ' + esc(title || 'New exhibition') + '</title>' +
      '<link rel="stylesheet" href="' + root + 'fonts/fonts.css"><link rel="stylesheet" href="' + root + 'style.css?p=' + Date.now() + '">' +
      '<style>.pv-bar{position:fixed;top:0;left:0;right:0;z-index:50;padding:10px 16px;background:#111;color:#fff;font:13px/1.3 system-ui,sans-serif;text-align:center}</style></head>' +
      '<body class="home2 exhibited-page exg-body"><div class="pv-bar">Preview, not published yet' + (hand ? ' (the real page keeps its hand-set layout)' : '') + '</div>' +
      '<main class="exg">' + body + '</main><div style="height:120px"></div></body></html>';
  }
  $('preview').addEventListener('click', function () {
    var w = window.open('', '_blank');
    if (!w) { A.toast('Please allow pop-ups to see the preview.', true); return; }
    w.location.href = URL.createObjectURL(new Blob([previewHTML()], { type: 'text/html' }));
  });

  /* ---------- Save & Publish ---------- */
  function state() {
    return [$('title').value, $('place').value, zone ? zone.signature() : '',
      texts.map(function (t) { return t.el.value; }),
      cols.map(function (c) { return [c.word.value, c.text.value]; }),
      photos.map(function (p) { return p.zone.signature(); })];
  }
  function validate() {
    if (!clean($('title').value)) return 'Please add a title.';
    if (!hand && !zone.value()) return 'Please add the main image.';
    return '';
  }
  function save() {
    var d = me ? JSON.parse(JSON.stringify(me.data)) : { note: '' };
    if (isNew) {
      var taken = {};
      RESERVED.concat(all.map(function (x) { return x.slug; })).forEach(function (k) { taken[k] = true; });
      var base = A.slugify(clean($('title').value)) || 'exhibition', k = 2;
      slug = base;
      while (taken[slug]) slug = base + '-' + (k++);
      // New exhibitions go first on the Exhibited page.
      d.order = all.reduce(function (m, x) { return Math.min(m, Number(x.data.order) || 0); }, 1) - 1;
      d.link = slug + '/';
    }
    d.title = clean($('title').value);
    d.place = $('place').value.trim();
    delete d.line2; delete d.line3;
    var r = hand ? saveHand(d) : saveAuto(d);
    var path = 'content/exhibitions/' + slug + '.json';
    var text = A.json(d);
    if (!me || text !== A.json(me.data)) r.changes.push({ path: path, text: text });
    if (!r.changes.length) return Promise.resolve();
    return A.commit((isNew ? 'Add exhibition: ' : 'Update exhibition: ') + d.title, r.changes).then(function () {
      if (isNew) {
        me = { slug: slug, path: path, data: d };
        all.unshift(me);
        isNew = false;
        history.replaceState(null, '', 'exhibition.html?slug=' + encodeURIComponent(slug));
      } else me.data = d;
      r.after();
      heading();
      A.toast('Published. The page is live at ' + location.host + '/' + slug + '/ in about a minute.');
    });
  }

  return A.readFolder('content/exhibitions').then(function (list) {
    all = list.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
    if (!isNew) {
      me = all.filter(function (x) { return x.slug === slug; })[0];
      if (!me) throw new Error('There’s no exhibition called “' + slug + '”. It may have been removed.');
    }
    var d = me ? me.data : {};
    $('title').value = d.title ? clean(d.title) : '';
    $('place').value = d.place != null ? d.place : [d.line2, d.line3].filter(Boolean).join(', ');
    $('title').addEventListener('input', heading);
    heading();
    if (isNew) return loadAuto();
    var page = String(d.link || slug + '/').replace(/^\/|\/$/g, '');
    return A.tree().then(function (t) {
      var src = 'src/' + page + '.html';
      hand = d.page !== 'auto' && !!t.files[src];
      if (!hand) return loadAuto();
      return A.blobText(t.files[src]).then(loadHand);
    });
  }).then(function () {
    ed = A.editor({ state: state, save: save, validate: validate });
    ed.start();
  });
});
