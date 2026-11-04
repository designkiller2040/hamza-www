/* Exhibitions list: cards in homepage order, search, drag to reorder, Save order. */
A.start(function () {
  var list = A.$('#list');
  var saveBtn = A.$('#save-order');
  var items = [], before = '', query = '';

  function key() { return items.map(function (x) { return x.slug; }).join(','); }

  function card(x, n) {
    var d = x.data, img = d.image && d.image.src;
    var tags = [];
    if (d.line3) tags.push('<span class="tag">' + A.esc(d.line3) + '</span>');
    if (!img) tags.push('<span class="tag amber">No image</span>');
    if (d.note) tags.push('<span class="tag yellow" title="' + A.esc(d.note) + '">Note</span>');
    return '<a class="card" href="exhibition.html?slug=' + encodeURIComponent(x.slug) + '" data-slug="' + A.esc(x.slug) + '" data-title="' + A.esc((d.title || '').toLowerCase()) + '">' +
      '<div class="thumb"><span class="badge">' + n + '</span>' +
      (img ? '<img alt="" data-src="' + A.esc(img) + '" loading="lazy">'
           : '<div class="no-image"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg></div>') +
      '</div><div class="card-title">' + A.esc(d.title || 'Untitled') + '</div><div class="tags">' + tags.join('') + '</div></a>';
  }

  function render() {
    list.innerHTML = '<div class="cards" id="cards">' + items.map(function (x, i) { return card(x, i + 1); }).join('') +
      '<a class="new-card" href="exhibition.html?new=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New exhibition</a></div>' +
      '<p class="empty-search" id="no-results" hidden>No exhibitions match that search.</p>';
    A.$$('img[data-src]', list).forEach(function (img) { A.showImage(img, img.dataset.src); });
    A.sortable(A.$('#cards'), { items: '.card', disabled: function () { return !!query; }, onEnd: changed });
  }

  function changed() {
    items = A.$$('.card', list).map(function (c) { return items.filter(function (x) { return x.slug === c.dataset.slug; })[0]; });
    var n = 0;
    A.$$('.card .badge', list).forEach(function (b) { b.textContent = ++n; });
    saveBtn.hidden = key() === before;
  }

  function search(q) {
    query = q.trim().toLowerCase();
    A.$('#search').value = q; A.$('#search-phone').value = q;
    var any = false;
    A.$$('.card', list).forEach(function (c) {
      var hit = !query || c.dataset.title.indexOf(query) >= 0;
      c.hidden = !hit; if (hit) any = true;
    });
    A.$('.new-card', list).hidden = !!query;
    A.$('#no-results').hidden = any || !query;
  }
  A.$('#search').addEventListener('input', function (e) { search(e.target.value); });
  A.$('#search-phone').addEventListener('input', function (e) { search(e.target.value); });

  saveBtn.addEventListener('click', function () {
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    var changes = [];
    items.forEach(function (x, i) {
      if (x.data.order !== i + 1) {
        var d = JSON.parse(JSON.stringify(x.data)); d.order = i + 1;
        changes.push({ path: x.path, text: A.json(d), x: x, d: d });
      }
    });
    A.commit('Reorder exhibitions', changes.map(function (c) { return { path: c.path, text: c.text }; })).then(function () {
      changes.forEach(function (c) { c.x.data = c.d; });
      before = key();
      saveBtn.hidden = true;
      A.toast('Order saved. The site updates in about a minute.');
    }).catch(function (e) { A.toast('Couldn’t save the order: ' + e.message, true); })
      .then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; });
  });
  window.addEventListener('beforeunload', function (e) { if (!saveBtn.hidden) { e.preventDefault(); e.returnValue = ''; } });

  return A.readFolder('content/exhibitions').then(function (all) {
    items = all.sort(function (a, b) { return (a.data.order || 0) - (b.data.order || 0); });
    before = key();
    render();
  });
});
