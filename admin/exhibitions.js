/* Exhibited tab: every exhibition on one page (content/exhibitions/*.json),
   top to bottom in the Exhibited page's order. Each: photo left, Title and
   Place and year right; arrows move it up or down; one Save for everything.
   Link, description and note already saved are kept as they are. */
A.start(function () {
  var box = A.$('#list');
  var items = [], removed = [], ed = null, uid = 0;
  var I = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"></path>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"></path>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"></path>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
  };
  function icon(p) { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function clean(t) { return t.trim().replace(/^[„“"']+|[“”"']+$/g, ''); }

  function make(x) {
    var d = (x && x.data) || {};
    var n = ++uid;
    var el = document.createElement('div');
    el.className = 'ex-grid ex-item';
    el.innerHTML =
      '<div class="ex-photo"><div class="drop"></div><div class="image-meta"></div></div>' +
      '<div class="fields">' +
        '<div><label class="lbl" for="t' + n + '">Title</label><input class="field" id="t' + n + '" data-k="title" type="text" placeholder="e.g. Abimal" autocomplete="off"><p class="hint">The „quotes“ are added on the site.</p></div>' +
        '<div><label class="lbl" for="p' + n + '">Place and year</label><input class="field" id="p' + n + '" data-k="place" type="text" placeholder="e.g. St. Elisabeth, Berlin 2026" autocomplete="off"></div>' +
        '<div class="ex-edit"><button class="btn" type="button" data-act="page">' + icon(I.edit) + 'Edit page info</button><p class="hint ex-page-link"></p></div>' +
        '<div class="ex-tools">' +
          '<button class="btn icon ghost" type="button" data-act="up" aria-label="Move up">' + icon(I.up) + '</button>' +
          '<button class="btn icon ghost" type="button" data-act="down" aria-label="Move down">' + icon(I.down) + '</button>' +
          '<button class="btn danger" type="button" data-act="del">' + icon(I.del) + 'Remove</button>' +
        '</div>' +
      '</div>';
    var it = { el: el, x: x || null, auto: !x || d.page === 'auto' };
    pageLink(it);
    el.querySelector('[data-k=title]').value = d.title || '';
    el.querySelector('[data-k=place]').value = d.place != null ? d.place : [d.line2, d.line3].filter(Boolean).join(', ');
    it.zone = A.dropZone({ el: el.querySelector('.drop'), metaEl: el.querySelector('.image-meta'), value: d.image, onChange: function () { ed && ed.update(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b || b.closest('.image-meta')) return;
      var i = items.indexOf(it);
      if (b.dataset.act === 'page') {
        // Its page's own editor: text, main photo, more photos (alona 2026-11-16).
        if (!it.x || ed.dirty()) { A.toast(it.x ? 'Please press Save first, then Edit page info.' : 'Please press Save first: the page is made when you save.', true); return; }
        location.href = 'exhibition.html?slug=' + encodeURIComponent(it.x.slug);
        return;
      }
      if (b.dataset.act === 'del') {
        var name = clean(el.querySelector('[data-k=title]').value) || 'this exhibition';
        A.confirm('Remove “' + name + '” from the Exhibited page' + (it.auto && it.x ? ' and its page' : '') + '? It goes once you press Save.').then(function (yes) {
          if (!yes) return;
          items.splice(items.indexOf(it), 1);
          if (it.x) removed.push(it.x);
          render();
          ed.update();
        });
        return;
      }
      if (b.dataset.act === 'up' && i > 0) { items.splice(i, 1); items.splice(i - 1, 0, it); }
      if (b.dataset.act === 'down' && i < items.length - 1) { items.splice(i, 1); items.splice(i + 1, 0, it); }
      render();
      ed.update();
    });
    return it;
  }
  function pageLink(it) {
    var p = it.x && (it.x.data.link || '').replace(/^\/|\/$/g, '');
    it.el.querySelector('.ex-page-link').textContent = p ? 'Its page: ' + location.host + '/' + p + '/' : 'Gets its own page when you press Save.';
  }
  function render() {
    box.innerHTML = '';
    if (!items.length) box.innerHTML = '<p class="slide-empty">No exhibitions yet.</p>';
    items.forEach(function (it, i) {
      it.el.querySelector('[data-act=up]').disabled = i === 0;
      it.el.querySelector('[data-act=down]').disabled = i === items.length - 1;
      box.appendChild(it.el);
    });
  }
  function val(it, k) { return it.el.querySelector('[data-k="' + k + '"]').value; }
  function state() {
    return items.map(function (it) {
      return [it.x ? it.x.slug : 'new', val(it, 'title'), val(it, 'place'), it.zone.signature()];
    });
  }
  function validate() {
    for (var i = 0; i < items.length; i++) {
      if (!clean(val(items[i], 'title'))) return 'Please give every exhibition a title.';
      if (!items[i].zone.value()) return 'Please add a photo for “' + clean(val(items[i], 'title')) + '”.';
    }
    return '';
  }
  function save() {
    var changes = [], taken = {}, done = [];
    items.forEach(function (it) { if (it.x) taken[it.x.slug] = true; });
    removed.forEach(function (x) { taken[x.slug] = true; });
    // Addresses the site already uses.
    ['works', 'about', 'exhibited', 'legal', 'lens', 'admin', 'images', 'icons', 'fonts', 'home-1', 'about-1',
      'abimal', 'coldrush', 'venerate', 'regards-croises', 'snapshots', 'content', 'src'].forEach(function (k) { taken[k] = true; });
    items.forEach(function (it, i) {
      var old = it.x ? it.x.data : null;
      var d = old ? JSON.parse(JSON.stringify(old)) : {};
      d.title = clean(val(it, 'title'));
      d.place = val(it, 'place').trim();
      delete d.line2; delete d.line3;
      d.order = i + 1;
      var slug = it.x ? it.x.slug : null;
      if (!slug) {
        var base = A.slugify(d.title) || 'exhibition';
        slug = base; var k = 2;
        while (taken[slug]) slug = base + '-' + (k++);
        taken[slug] = true;
        if (d.note == null) d.note = '';
      }
      var path = 'content/exhibitions/' + slug + '.json';
      if (it.auto) {
        // Its own page, made by the site from content/exhibitions/<slug>.json.
        d.page = 'auto';
        d.link = slug + '/';
        if (d.text == null) d.text = '';
        if (!d.photos) d.photos = [];
      }
      var img = A.imageChanges(it.zone, old && old.image, 'exhibitions', slug, (old && old.image && old.image.alt) || '');
      d.image = img.image;
      img.changes.forEach(function (c) { changes.push(c); });
      var text = A.json(d);
      if (!old || text !== A.json(old)) changes.push({ path: path, text: text });
      done.push({ it: it, slug: slug, path: path, data: d });
    });
    removed.forEach(function (x) {
      changes.push({ path: x.path, remove: true });
      if (x.data.image && A.ownImage(x.data.image.src)) changes.push({ path: x.data.image.src, remove: true });
      (x.data.photos || []).forEach(function (p) { if (p && A.ownImage(p.src)) changes.push({ path: p.src, remove: true }); });
      var pe = (x.data.pageEdits && x.data.pageEdits.photos) || {};
      Object.keys(pe).forEach(function (k) { if (pe[k] && A.ownImage(pe[k].src)) changes.push({ path: pe[k].src, remove: true }); });
    });
    if (!changes.length) return Promise.resolve();
    return A.commit('Update exhibitions', changes).then(function () {
      done.forEach(function (r) {
        r.it.x = { slug: r.slug, path: r.path, data: r.data };
        r.it.zone.saved(r.data.image);
        pageLink(r.it);
      });
      removed = [];
    });
  }
  A.$('#add').addEventListener('click', function () {
    var it = make(null);
    items.unshift(it);
    render();
    ed.update();
    it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  return A.readFolder('content/exhibitions').then(function (all) {
    all.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
    items = all.map(make);
    render();
    ed = A.editor({ state: state, save: save, validate: validate });
    ed.start();
  });
});
