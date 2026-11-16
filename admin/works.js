/* Works list: cards grouped by Works-page row, search, drag (or arrows) to
   reorder, Save order. Rows are rebuilt from the order by shape (alona
   2026-11-16): square or vertical paintings sit 3 to a row; a horizontal one
   shares its row with one other painting (square, vertical or horizontal).
   Each painting keeps its own size; a row that comes out the same as before
   is kept exactly as it was (positions, lift, top alignment). */
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
      var items = slotsOf(r).map(function (p) { placed[p.slug] = 1; return bySlug(p.slug); }).filter(Boolean);
      return { row: i, items: items };
    }).filter(function (r) { return r.items.length; });
    var loose = works.filter(function (w) { return !placed[w.slug]; });
    if (loose.length) rows.push({ row: 'none', items: loose });
  }
  // A row's frames from left to right (the reading order on the page).
  function slotsOf(r) { return r.works.slice().sort(function (a, b) { return a.x - b.x; }); }
  function flat() { return rows.filter(function (r) { return r.row !== 'none'; }).reduce(function (a, r) { return a.concat(r.items); }, []); }
  // Rows by shape: see A.H2.split in admin.js.
  var split = A.H2.split;
  // Put a flat order back into rows (the preview in this list).
  function chunk(order) {
    var none = rows.filter(function (r) { return r.row === 'none'; });
    rows = split(order).map(function (items, i) { return { row: 'r' + i, items: items }; }).concat(none);
  }
  function orderKey() { return rows.map(function (r) { return r.items.map(function (w) { return w.slug; }).join(','); }).join('|'); }

  function card(w, n, placed) {
    var d = w.data, img = d.image && d.image.src;
    var tags = [];
    if (d.year) tags.push('<span class="tag">' + A.esc(d.year) + '</span>');
    if (d.size) tags.push('<span class="tag">' + A.esc(d.size) + '</span>');
    if (!img) tags.push('<span class="tag amber">No image</span>');
    if (d.note) tags.push('<span class="tag yellow" title="' + A.esc(d.note) + '">Note</span>');
    return '<a class="card" href="work.html?slug=' + encodeURIComponent(w.slug) + '" data-slug="' + A.esc(w.slug) + '" data-title="' + A.esc((d.title || '').toLowerCase()) + '">' +
      '<div class="thumb"><span class="badge">' + n + '</span>' +
      (placed ? '<span class="move"><button type="button" class="move-btn" data-move="-1" aria-label="Move earlier" title="Move earlier"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg></button><button type="button" class="move-btn" data-move="1" aria-label="Move later" title="Move later"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></button></span>' : '') +
      (img ? '<img alt="" data-src="' + A.esc(img) + '" loading="lazy">'
           : '<div class="no-image"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg></div>') +
      '</div><div class="card-title">' + A.esc(d.title || 'Untitled') + '</div>' +
      '<div class="tags">' + tags.join('') + '</div></a>';
  }

  function render() {
    var n = 0;
    list.innerHTML = '<div class="groups">' + rows.map(function (r, gi) {
      var last = gi === rows.length - 1;
      if (r.row !== 'none') {
        // A row laid out like on the Works page (alona's sketch 2026-11-16): a
        // 6-column grid; square/vertical take 2 columns, a horizontal one 4
        // (3 each when two horizontals share the row).
        var wides = r.items.filter(A.H2.isWide).length;
        return '<div class="group wk-row-group" data-row="' + r.row + '"><div class="cards wk-row">' +
          r.items.map(function (w) {
            n++;
            var span = A.H2.isWide(w) ? (wides === 2 ? 3 : 4) : 2;
            return card(w, n, true).replace('<a class="card"', '<a class="card' + (A.H2.isWide(w) ? ' wide' : '') + '" style="grid-column:span ' + span + '"');
          }).join('') + '</div></div>';
      }
      return '<div class="group" data-row="' + r.row + '">' +
        '<div class="group-head"><h3>Not on the Works page</h3><span>' + r.items.length + (r.items.length === 1 ? ' work' : ' works') + '</span></div>' +
        '<div class="cards">' + r.items.map(function (w) { n++; return card(w, n, false); }).join('') +
        (last ? '<a class="new-card" href="work.html?new=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New work</a>' : '') +
        '</div></div>';
    }).join('') + (rows.length ? '' : '<div class="cards"><a class="new-card" href="work.html?new=1">+ New work</a></div>') +
      '</div><p class="empty-search" id="no-results" hidden>No works match that search.</p>';
    A.$$('img[data-src]', list).forEach(function (img) { A.showImage(img, img.dataset.src); });
    var placedCards = A.$$('.group:not([data-row="none"]) .card', list);
    if (placedCards.length) {
      A.$('.move-btn[data-move="-1"]', placedCards[0]).hidden = true;
      A.$('.move-btn[data-move="1"]', placedCards[placedCards.length - 1]).hidden = true;
    }
  }
  // One drag area for all rows (set up once; the list is re-rendered inside it).
  A.sortable(list, { items: '.group:not([data-row="none"]) .card', disabled: searching, onEnd: changed });
  // The arrows move a painting one place earlier or later (across rows too).
  list.addEventListener('pointerdown', function (e) { if (e.target.closest('.move-btn')) e.stopPropagation(); }, true);
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.move-btn');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var order = flat(), slug = b.closest('.card').dataset.slug;
    var i = order.map(function (w) { return w.slug; }).indexOf(slug), j = i + Number(b.dataset.move);
    if (i < 0 || j < 0 || j >= order.length) return;
    order.splice(j, 0, order.splice(i, 1)[0]);
    reorder(order);
  });

  function reorder(order) {
    chunk(order);
    render();
    if (query) search(query);
    saveBtn.hidden = orderKey() === before;
  }
  function changed() {
    // Read the new order back from the page (a card may have crossed rows).
    reorder(A.$$('.group:not([data-row="none"]) .card', list).map(function (c) { return bySlug(c.dataset.slug); }));
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

  // Write an order into home2.json (rows by shape, see A.H2.reflow).
  function fill(data, order) {
    var have = A.H2.order(data).sort().join(',');
    if (have !== order.slice().sort().join(',')) throw new Error('the works changed meanwhile. Reload the page and try again');
    A.H2.reflow(data, order, bySlug);
  }
  function saveOrder(order, message, toast) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    function done() { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; }
    return A.commit(message, [A.H2.update(function (data) { fill(data, order); })]).then(function () {
      fill(home2, order);
      group();
      before = orderKey();
      render();
      if (query) search(query);
      saveBtn.hidden = true;
      A.toast(toast);
    }).catch(function (e) {
      A.toast('Couldn’t save the order: ' + e.message, true);
    }).then(done);
  }
  saveBtn.addEventListener('click', function () {
    saveOrder(flat().map(function (w) { return w.slug; }), 'Reorder works on the Works page', 'Order saved. The site updates in about a minute.');
  });

  // TEMPORARY (alona 2026-11-16): "Return how it was" puts the Works page back
  // exactly as it was on 2026-11-16 (originalRows in home2.json) and saves.
  // To remove: delete this block, the #restore-order button in works.html and
  // "originalRows" in content/home2.json.
  var restoreBtn = A.$('#restore-order');
  if (restoreBtn) restoreBtn.addEventListener('click', function () {
    if (!home2.originalRows) { A.toast('No saved original order.', true); return; }
    function slugsOf(rs) { return rs.reduce(function (a, r) { return a.concat(slotsOf(r).map(function (p) { return p.slug; })); }, []); }
    if (JSON.stringify(home2.rows) === JSON.stringify(home2.originalRows)) {
      if (!saveBtn.hidden) { group(); render(); if (query) search(query); saveBtn.hidden = true; }
      A.toast('The works are already in their original order.');
      return;
    }
    function restore(data) {
      var orig = data.originalRows;
      if (!orig) throw new Error('no saved original order');
      var a = slugsOf(orig).slice().sort().join(','), b = slugsOf(data.rows).slice().sort().join(',');
      if (a === b) { data.rows = JSON.parse(JSON.stringify(orig)); return; }
      // Works were added or removed since: original order first, new ones after.
      var cur = slugsOf(data.rows);
      var order = slugsOf(orig).filter(function (s) { return cur.indexOf(s) >= 0; })
        .concat(cur.filter(function (s) { return slugsOf(orig).indexOf(s) < 0; }));
      fill(data, order);
    }
    saveBtn.disabled = true;
    A.commit('Works page: return the original order', [A.H2.update(restore)]).then(function () {
      restore(home2);
      group(); before = orderKey(); render(); if (query) search(query);
      saveBtn.hidden = true;
      A.toast('Original order is back. The site updates in about a minute.');
    }).catch(function (e) {
      A.toast('Couldn’t restore the order: ' + e.message, true);
    }).then(function () { saveBtn.disabled = false; });
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
