/* Works list: cards grouped by homepage row, search, drag to reorder, Save order. */
A.start(function () {
  var list = A.$('#list');
  var saveBtn = A.$('#save-order');
  var works = [], rows = [], before = '';

  function rowOf(w) { return Number(w.data.layout && w.data.layout.row) || 1; }
  function group() {
    var by = {};
    works.forEach(function (w) { (by[rowOf(w)] = by[rowOf(w)] || []).push(w); });
    rows = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (r) {
      return { row: r, items: by[r].sort(function (a, b) { return a.data.layout.left - b.data.layout.left; }) };
    });
  }
  function orderKey() { return rows.map(function (r) { return r.items.map(function (w) { return w.slug; }).join(','); }).join('|'); }

  function card(w, n) {
    var d = w.data, img = d.image && d.image.src;
    var tags = [];
    if (d.year) tags.push('<span class="tag">' + A.esc(d.year) + '</span>');
    if (d.size) tags.push('<span class="tag">' + A.esc(d.size) + '</span>');
    if (!img) tags.push('<span class="tag amber">No image</span>');
    if (d.note) tags.push('<span class="tag yellow" title="' + A.esc(d.note) + '">Note</span>');
    return '<a class="card" href="work.html?slug=' + encodeURIComponent(w.slug) + '" data-slug="' + A.esc(w.slug) + '" data-title="' + A.esc((d.title || '').toLowerCase()) + '">' +
      '<div class="thumb"><span class="badge">' + n + '</span>' +
      (img ? '<img alt="" data-src="' + A.esc(img) + '" loading="lazy">'
           : '<div class="no-image"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg></div>') +
      '</div><div class="card-title">' + A.esc(d.title || 'Untitled') + '</div>' +
      '<div class="tags">' + tags.join('') + '</div></a>';
  }

  function render() {
    var n = 0;
    list.innerHTML = '<div class="groups">' + rows.map(function (r, gi) {
      var last = gi === rows.length - 1;
      return '<div class="group" data-row="' + r.row + '">' +
        '<div class="group-head"><h3>Row ' + (gi + 1) + '</h3><span>' + r.items.length + (r.items.length === 1 ? ' work' : ' works') + '</span></div>' +
        '<div class="cards">' + r.items.map(function (w) { n++; return card(w, n); }).join('') +
        (last ? '<a class="new-card" href="work.html?new=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New work</a>' : '') +
        '</div></div>';
    }).join('') + (rows.length ? '' : '<div class="cards"><a class="new-card" href="work.html?new=1">+ New work</a></div>') +
      '</div><p class="empty-search" id="no-results" hidden>No works match that search.</p>';
    A.$$('img[data-src]', list).forEach(function (img) { A.showImage(img, img.dataset.src); });
    A.$$('.group .cards', list).forEach(function (c) {
      A.sortable(c, { items: '.card', disabled: searching, onEnd: changed });
    });
  }

  function renumber() {
    var n = 0;
    A.$$('.card .badge', list).forEach(function (b) { b.textContent = ++n; });
  }

  function changed() {
    // Read the new order back from the page.
    A.$$('.group', list).forEach(function (g) {
      var r = rows.filter(function (x) { return String(x.row) === g.dataset.row; })[0];
      r.items = A.$$('.card', g).map(function (c) { return works.filter(function (w) { return w.slug === c.dataset.slug; })[0]; });
    });
    renumber();
    saveBtn.hidden = orderKey() === before;
  }

  // Search by title
  var query = '';
  function searching() { return !!query; }
  function search(q) {
    query = q.trim().toLowerCase();
    A.$('#search').value = q; A.$('#search-phone').value = q;
    var any = false;
    A.$$('.group', list).forEach(function (g) {
      var shown = 0;
      A.$$('.card', g).forEach(function (c) {
        var hit = !query || c.dataset.title.indexOf(query) >= 0;
        c.hidden = !hit;
        if (hit) shown++;
      });
      var nc = A.$('.new-card', g);
      if (nc) nc.hidden = !!query;
      g.hidden = !shown && !!query;
      if (shown) any = true;
    });
    A.$('#no-results').hidden = any || !query;
  }
  A.$('#search').addEventListener('input', function (e) { search(e.target.value); });
  A.$('#search-phone').addEventListener('input', function (e) { search(e.target.value); });

  saveBtn.addEventListener('click', function () {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    var changes = [];
    rows.forEach(function (r) {
      var copies = r.items.map(function (w) { return { slug: w.slug, path: w.path, data: JSON.parse(JSON.stringify(w.data)) }; });
      var ds = copies.map(function (c) { return c.data; });
      // Was this row reordered?
      var was = r.items.slice().sort(function (a, b) { return a.data.layout.left - b.data.layout.left; }).map(function (w) { return w.slug; }).join(',');
      if (was === r.items.map(function (w) { return w.slug; }).join(',')) return;
      A.slotLayout(ds);
      copies.forEach(function (c, i) {
        if (JSON.stringify(c.data) !== JSON.stringify(r.items[i].data)) changes.push({ path: c.path, text: A.json(c.data), copy: c });
      });
    });
    if (!changes.length) { saveBtn.hidden = true; saveBtn.disabled = false; saveBtn.textContent = 'Save order'; return; }
    A.commit('Reorder works', changes.map(function (c) { return { path: c.path, text: c.text }; })).then(function () {
      changes.forEach(function (c) {
        var w = works.filter(function (x) { return x.slug === c.copy.slug; })[0];
        w.data = c.copy.data;
      });
      group();
      before = orderKey();
      saveBtn.hidden = true;
      A.toast('Order saved. The site updates in about a minute.');
    }).catch(function (e) {
      A.toast('Couldn’t save the order: ' + e.message, true);
    }).then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; });
  });

  window.addEventListener('beforeunload', function (e) {
    if (!saveBtn.hidden) { e.preventDefault(); e.returnValue = ''; }
  });

  return A.readFolder('content/works').then(function (all) {
    works = all;
    group();
    before = orderKey();
    render();
  });
});
