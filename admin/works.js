/* Works list: cards grouped by homepage row, search, drag to reorder, Save order. */
A.start(function () {
  var list = A.$('#list');
  var saveBtn = A.$('#save-order');
  var works = [], rows = [], before = '';

  var home2 = { rows: [] };
  function bySlug(slug) { return works.filter(function (w) { return w.slug === slug; })[0]; }
  // Groups follow the homepage rows (content/home2.json). Works that aren't
  // placed on the homepage go in a last group.
  function group() {
    var placed = {};
    rows = home2.rows.map(function (r, i) {
      var items = r.works.map(function (p) { placed[p.slug] = 1; return bySlug(p.slug); }).filter(Boolean);
      return { row: i, items: items };
    }).filter(function (r) { return r.items.length; });
    var loose = works.filter(function (w) { return !placed[w.slug]; });
    if (loose.length) rows.push({ row: 'none', items: loose });
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
        '<div class="group-head"><h3>' + (r.row === 'none' ? 'Not on the homepage' : 'Row ' + (gi + 1)) + '</h3><span>' + r.items.length + (r.items.length === 1 ? ' work' : ' works') + '</span></div>' +
        '<div class="cards">' + r.items.map(function (w) { n++; return card(w, n); }).join('') +
        (last ? '<a class="new-card" href="work.html?new=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New work</a>' : '') +
        '</div></div>';
    }).join('') + (rows.length ? '' : '<div class="cards"><a class="new-card" href="work.html?new=1">+ New work</a></div>') +
      '</div><p class="empty-search" id="no-results" hidden>No works match that search.</p>';
    A.$$('img[data-src]', list).forEach(function (img) { A.showImage(img, img.dataset.src); });
    A.$$('.group:not([data-row="none"]) .cards', list).forEach(function (c) {
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
    // New order of each homepage row that changed.
    var orders = {};
    rows.forEach(function (r) {
      if (r.row === 'none') return;
      var was = home2.rows[r.row].works.map(function (p) { return p.slug; }).join(',');
      var now = r.items.map(function (w) { return w.slug; });
      if (now.join(',') !== was) orders[r.row] = now;
    });
    function apply(data) {
      Object.keys(orders).forEach(function (i) {
        var row = data.rows[i];
        if (!row) return;
        var want = orders[i];
        var same = row.works.length === want.length && row.works.every(function (p) { return want.indexOf(p.slug) >= 0; });
        if (!same) return; // someone changed this row meanwhile; leave it
        row.works.sort(function (a, b) { return want.indexOf(a.slug) - want.indexOf(b.slug); });
        A.H2.place(row, true);
      });
    }
    function done() { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; }
    if (!Object.keys(orders).length) { saveBtn.hidden = true; done(); return; }
    A.commit('Reorder works on the homepage', [A.H2.update(apply)]).then(function () {
      apply(home2);
      before = orderKey();
      saveBtn.hidden = true;
      A.toast('Order saved. The site updates in about a minute.');
    }).catch(function (e) {
      A.toast('Couldn’t save the order: ' + e.message, true);
    }).then(done);
  });

  window.addEventListener('beforeunload', function (e) {
    if (!saveBtn.hidden) { e.preventDefault(); e.returnValue = ''; }
  });

  return Promise.all([A.readFolder('content/works'), A.readJSON(A.H2.PATH)]).then(function (res) {
    works = res[0];
    home2 = res[1] || { rows: [] };
    home2.rows = home2.rows || [];
    group();
    before = orderKey();
    render();
  });
});
