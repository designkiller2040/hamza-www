/* One exhibition's own page ("Edit page info" on the Exhibited tab, alona 2026-11-16).
   Pages made in the admin ("page": "auto"): main photo, text, more photos (add/remove).
   Hand-made pages (src/abimal.html etc.): their layout is set by hand, so every text
   and photo keeps its place; texts can be rewritten and photos replaced. Those changes
   are saved as "pageEdits" in the exhibition's JSON and applied by build.mjs, which
   numbers the texts the same way as TEXT_RE below. */
A.start(function () {
  var slug = A.param('slug');
  var $ = function (id) { return document.getElementById(id); };
  var TEXT_RE = /<(h1|p) class="(ex-label|ex-title|ex-p|rc-credit)\b([^"]*)"([^>]*)>([\s\S]*?)<\/\1>/g;
  var IMG_RE = /<img src="\{\{root\}\}([^"]+)" alt="([^"]*)" width="(\d+)" height="(\d+)"/g;
  var me = null, hand = false, ed = null, zone = null;
  var texts = [], photos = []; // hand-made: [{k, def, el}] / [{def, zone, el}]; auto: photos = [{orig, zone, el}]
  var I = { plus: '<path d="M12 5v14M5 12h14"></path>' };
  function icon(p) { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function clean(t) { return String(t || '').trim().replace(/^[„“"']+|[“”"']+$/g, ''); }

  // Page HTML -> plain text as it reads on the page (line breaks kept).
  function fromHTML(s) {
    s = s.replace(/&shy;/g, '').replace(/<br\s*\/?>/gi, '\u0001').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
      .replace(/ ?\u0001 ?/g, '\n').trim();
    var t = document.createElement('textarea');
    t.innerHTML = s;
    return t.value;
  }
  function norm(s) { return String(s || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); }).join('\n').trim(); }

  function textField(label, value, hint) {
    var n = texts.length;
    var el = document.createElement('div');
    el.innerHTML = '<label class="lbl" for="tx' + n + '"></label><textarea class="field" id="tx' + n + '"></textarea>' + (hint ? '<p class="hint"></p>' : '');
    el.querySelector('label').textContent = label;
    var ta = el.querySelector('textarea');
    ta.value = value;
    ta.rows = Math.min(14, Math.max(2, Math.ceil(value.length / 60) + (value.match(/\n/g) || []).length));
    if (hint) el.querySelector('.hint').textContent = hint;
    $('texts').appendChild(el);
    return ta;
  }

  function photoSlot(value, opts) {
    var wrap = document.createElement('div');
    wrap.className = 'ex-ph';
    wrap.innerHTML = '<div class="drop"></div><div class="image-meta"></div>';
    var box = $('photos');
    box.insertBefore(wrap, box.querySelector('.ex-ph-add'));
    var o = { el: wrap.querySelector('.drop'), metaEl: wrap.querySelector('.image-meta'), value: value };
    for (var k in opts) o[k] = opts[k];
    return { wrap: wrap, zone: A.dropZone(o) };
  }

  /* ---------- Hand-made page ---------- */
  function loadHand(html) {
    var edits = me.data.pageEdits || {};
    var et = edits.texts || {}, ep = edits.photos || {};
    var m, i = 0, para = 0;
    TEXT_RE.lastIndex = 0;
    while ((m = TEXT_RE.exec(html))) {
      var k = String(i++);
      var def = fromHTML(m[5]);
      var label = m[2] === 'ex-label' ? 'Line above the title' : m[2] === 'ex-title' ? 'Title on the page'
        : m[2] === 'rc-credit' ? 'Credit' : 'Paragraph ' + (++para);
      var ta = textField(label, typeof et[k] === 'string' ? et[k] : def);
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
      var opts = {
        canRemove: function (c) { return c.src !== def.src; },
        removeLabel: 'Original',
        removeConfirm: 'Put the original photo back in this place?',
        removeOk: 'Put it back',
        onChange: function (c) { if (!c) p.zone.saved(def); ed && ed.update(); },
      };
      var p = { def: def, old: ep[def.src] || null };
      if (n === 0) {
        p.zone = A.dropZone(Object.assign({ el: $('drop'), metaEl: $('drop-meta'), value: p.old || def }, opts));
      } else {
        var s = photoSlot(p.old || def, opts);
        p.zone = s.zone;
        p.el = s.wrap;
      }
      photos.push(p);
    });
    $('ep-hint').textContent = 'This page’s layout was set by hand, so every text and photo keeps its place. Keep texts about the same length so they fit.';
    $('main-hint').textContent = 'Opens the page across its full width. Replace swaps the photo in the same frame.';
    $('photos-hint').textContent = 'Each photo keeps its place and frame on the page: you can replace one, not add or remove. “Original” brings the first photo back.';
  }
  function saveHand(d) {
    var changes = [];
    var old = me.data.pageEdits || {};
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

  /* ---------- Page made in the admin ---------- */
  function addAutoPhoto(v) {
    var p = { orig: v || null };
    var s = photoSlot(v, { onChange: function () {
      // Remove takes the whole slot away.
      if (!p.zone.value()) { photos.splice(photos.indexOf(p), 1); s.wrap.remove(); }
      ed && ed.update();
    } });
    p.zone = s.zone;
    p.el = s.wrap;
    photos.push(p);
    return p;
  }
  function loadAuto() {
    var d = me.data;
    zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: d.image, canRemove: function () { return false; },
      onChange: function () { ed && ed.update(); } });
    texts.push({ el: textField('Text on the page', d.text || '', 'Leave an empty line between paragraphs.') });
    var t = document.createElement('button');
    t.type = 'button';
    t.className = 'new-card ex-ph-add';
    t.innerHTML = icon(I.plus) + 'Add photo';
    t.addEventListener('click', function () {
      var p = addAutoPhoto(null);
      p.el.querySelector('input[type=file]').click();
      ed && ed.update();
    });
    $('photos').appendChild(t);
    (d.photos || []).forEach(addAutoPhoto);
    $('ep-hint').textContent = '';
    $('main-hint').textContent = 'Opens the page across its full width. It’s also this exhibition’s photo on the Exhibited page.';
    $('photos-hint').textContent = 'These follow the text, at the menu’s width. Upright photos sit two side by side.';
  }
  function saveAuto(d) {
    var changes = [], kept = {};
    d.text = texts[0].el.value.trim();
    var img = A.imageChanges(zone, me.data.image, 'exhibitions', slug, (me.data.image && me.data.image.alt) || '');
    img.changes.forEach(function (c) { changes.push(c); });
    d.image = img.image;
    d.photos = photos.map(function (p, k) {
      var r = A.imageChanges(p.zone, null, 'exhibitions', slug + '-' + (k + 2), (p.orig && p.orig.alt) || clean(d.title));
      r.changes.forEach(function (c) { changes.push(c); });
      if (r.image) kept[r.image.src] = true;
      return r.image;
    }).filter(Boolean);
    (me.data.photos || []).forEach(function (p) { if (p && A.ownImage(p.src) && !kept[p.src]) changes.push({ path: p.src, remove: true }); });
    return { changes: changes, after: function () {
      zone.saved(d.image);
      photos.forEach(function (p, k) { p.orig = d.photos[k]; p.zone.saved(d.photos[k]); });
    } };
  }

  function state() {
    return [zone ? zone.signature() : '', texts.map(function (t) { return t.el.value; }),
      photos.map(function (p) { return p.zone.signature(); })];
  }
  function save() {
    var d = JSON.parse(JSON.stringify(me.data));
    var r = hand ? saveHand(d) : saveAuto(d);
    var text = A.json(d);
    if (text !== A.json(me.data)) r.changes.push({ path: me.path, text: text });
    if (!r.changes.length) return Promise.resolve();
    return A.commit('Update exhibition page: ' + clean(d.title), r.changes).then(function () {
      me.data = d;
      r.after();
    });
  }

  return A.readFolder('content/exhibitions').then(function (all) {
    me = all.filter(function (x) { return x.slug === slug; })[0];
    if (!me) throw new Error('There’s no exhibition called “' + slug + '”. It may have been removed.');
    var page = String(me.data.link || slug + '/').replace(/^\/|\/$/g, '');
    $('item-name').textContent = clean(me.data.title) || 'Exhibition';
    document.title = (clean(me.data.title) || 'Exhibition') + ' · Hamza Shah admin';
    $('view').href = '../' + page + '/';
    return A.tree().then(function (t) {
      var src = 'src/' + page + '.html';
      hand = me.data.page !== 'auto' && !!t.files[src];
      if (!hand) return loadAuto();
      return A.blobText(t.files[src]).then(loadHand);
    });
  }).then(function () {
    ed = A.editor({ state: state, save: save });
    ed.start();
  });
});
