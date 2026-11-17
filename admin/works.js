/* Works list: cards grouped by Works-page row, search, drag (or arrows) to
   reorder (with Undo and a compact view), Save order. Rows are rebuilt from the order by shape (alona
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

  // Each card is made once and moved around, so images don't reload and the
  // cards can slide to their new places.
  var cards = {};
  function cardEl(w, placed) {
    var key = w.slug + (placed ? '' : ':none');
    if (!cards[key]) {
      var t = document.createElement('div');
      t.innerHTML = card(w, 0, placed);
      cards[key] = t.firstChild;
      cards[key].title = w.data.title || '';
      var img = A.$('img[data-src]', cards[key]);
      if (img) A.showImage(img, img.dataset.src);
    }
    return cards[key];
  }

  function render() { layout(false); }
  // Builds the rows. animate: cards slide from where they were (FLIP).
  function layout(animate) {
    var first = {};
    if (animate) Object.keys(cards).forEach(function (k) {
      if (cards[k].isConnected) first[k] = cards[k].getBoundingClientRect();
    });
    var n = 0;
    var groups = document.createElement('div');
    groups.className = 'groups';
    rows.forEach(function (r, gi) {
      var g = document.createElement('div');
      g.dataset.row = r.row;
      var box = document.createElement('div');
      if (r.row !== 'none') {
        // A row laid out like on the Works page (alona's sketch 2026-11-16): a
        // 6-column grid; square/vertical take 2 columns, a horizontal one 4
        // (3 each when two horizontals share the row).
        g.className = 'group wk-row-group';
        box.className = 'cards wk-row';
        var wides = r.items.filter(A.H2.isWide).length;
        r.items.forEach(function (w) {
          var c = cardEl(w, true);
          n++;
          A.$('.badge', c).textContent = n;
          c.classList.toggle('wide', A.H2.isWide(w));
          c.style.gridColumn = 'span ' + (A.H2.isWide(w) ? (wides === 2 ? 3 : 4) : 2);
          box.appendChild(c);
        });
      } else {
        g.className = 'group';
        g.innerHTML = '<div class="group-head"><h3>Not on the Works page</h3><span>' + r.items.length + (r.items.length === 1 ? ' work' : ' works') + '</span></div>';
        box.className = 'cards';
        r.items.forEach(function (w) { var c = cardEl(w, false); n++; A.$('.badge', c).textContent = n; box.appendChild(c); });
        if (gi === rows.length - 1) box.insertAdjacentHTML('beforeend', '<a class="new-card" href="work.html?new=1"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>New work</a>');
      }
      g.appendChild(box);
      groups.appendChild(g);
    });
    if (!rows.length) groups.innerHTML = '<div class="cards"><a class="new-card" href="work.html?new=1">+ New work</a></div>';
    list.innerHTML = '';
    list.appendChild(groups);
    list.insertAdjacentHTML('beforeend', '<p class="empty-search" id="no-results" hidden>No works match that search.</p>');
    var placedCards = A.$$('.wk-row .card', list);
    placedCards.forEach(function (c, i) {
      A.$('.move-btn[data-move="-1"]', c).hidden = i === 0;
      A.$('.move-btn[data-move="1"]', c).hidden = i === placedCards.length - 1;
    });
    if (query) search(query);
    if (!animate) return;
    Object.keys(first).forEach(function (k) {
      var c = cards[k];
      if (!c.isConnected) return;
      var a = first[k], b = c.getBoundingClientRect();
      var dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      c.style.transition = 'none';
      c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      c.getBoundingClientRect();
      c.style.transition = 'transform 0.25s ease';
      c.style.transform = '';
    });
  }

  function slugs(order) { return order.map(function (w) { return w.slug; }); }

  /* ---------- Undo (alona 2026-11-16) ---------- */
  var history = [], undoBar = null, undoTimer = null;
  function remember(prev, title) {
    history.push(prev);
    if (!undoBar) {
      undoBar = document.createElement('div');
      undoBar.className = 'undo-bar';
      undoBar.innerHTML = '<span></span><button type="button" class="undo-btn">Undo</button>';
      document.body.appendChild(undoBar);
      A.$('.undo-btn', undoBar).addEventListener('click', undo);
    }
    A.$('span', undoBar).textContent = 'Moved “' + title + '”.';
    undoBar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { undoBar.hidden = true; }, 8000);
  }
  function undo() {
    var prev = history.pop();
    if (!prev) return;
    reorder(prev.map(bySlug));
    if (undoBar) {
      A.$('span', undoBar).textContent = 'Undone.';
      clearTimeout(undoTimer);
      if (history.length) undoTimer = setTimeout(function () { undoBar.hidden = true; }, 8000);
      else { A.$('.undo-btn', undoBar).hidden = true; undoTimer = setTimeout(function () { undoBar.hidden = true; A.$('.undo-btn', undoBar).hidden = false; }, 2000); }
    }
  }
  function forget() { history = []; if (undoBar) undoBar.hidden = true; }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && history.length &&
        !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName)) {
      e.preventDefault();
      undo();
    }
  });

  // The arrows move a painting one place earlier or later (across rows too).
  list.addEventListener('click', function (e) {
    var b = e.target.closest('.move-btn');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var order = flat(), slug = b.closest('.card').dataset.slug;
    var i = slugs(order).indexOf(slug), j = i + Number(b.dataset.move);
    if (i < 0 || j < 0 || j >= order.length) return;
    var prev = slugs(order);
    order.splice(j, 0, order.splice(i, 1)[0]);
    reorder(order);
    remember(prev, bySlug(slug).data.title || slug);
  });

  function reorder(order) {
    chunk(order);
    layout(true);
    saveBtn.hidden = orderKey() === before;
  }

  /* ---------- Drag (alona 2026-11-16): the spot where the painting will land
     shows as a dark dashed box, the other paintings slide aside and the rows
     rebuild by shape while dragging. ---------- */
  var drag = null;
  list.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || query) return;
    if (e.target.closest('.move-btn')) return;
    var c = e.target.closest('.wk-row .card');
    if (!c) return;
    var d = { x: e.clientX, y: e.clientY, id: e.pointerId, card: c, slug: c.dataset.slug, touch: e.pointerType === 'touch', active: false, timer: null, lock: 0 };
    if (d.touch) d.timer = setTimeout(function () { begin(d, d.x, d.y); }, 300);
    drag = d;
  });
  function begin(d, x, y) {
    if (d.active) return;
    d.active = true;
    d.start = slugs(flat());
    var r = d.card.getBoundingClientRect();
    d.dx = Math.min(x - r.left, 140); d.dy = Math.min(y - r.top, 120);
    d.ghost = d.card.cloneNode(true);
    d.ghost.classList.add('drag-ghost', 'wk-ghost');
    d.ghost.style.transform = '';
    var gw = Math.min(r.width, 280);
    d.ghost.style.width = gw + 'px';
    var gt = A.$('.thumb', d.ghost);
    if (gt) gt.style.height = Math.round(gw * Math.min(1.1, A.$('.thumb', d.card).offsetHeight / r.width)) + 'px';
    document.body.appendChild(d.ghost);
    d.card.classList.add('placeholder');
    document.body.classList.add('is-dragging');
    if (navigator.vibrate && d.touch) navigator.vibrate(10);
    moveGhost(d, x, y);
  }
  function moveGhost(d, x, y) {
    d.ghost.style.left = (x - d.dx) + 'px';
    d.ghost.style.top = (y - d.dy) + 'px';
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
    d.px = e.clientX; d.py = e.clientY;
    moveGhost(d, e.clientX, e.clientY);
    target(d);
    // Scroll near the screen edges.
    clearInterval(d.scroll);
    var edge = e.clientY < 110 ? -14 : e.clientY > innerHeight - 70 ? 14 : 0;
    if (edge) d.scroll = setInterval(function () { window.scrollBy(0, edge); target(d); }, 16);
  }, { passive: false });
  window.addEventListener('touchmove', function (e) { if (drag && drag.active) e.preventDefault(); }, { passive: false });
  // Which place the pointer points at: before or after the card under it.
  function target(d) {
    if (Date.now() < d.lock) return;
    var under = document.elementFromPoint(d.px, d.py);
    var t = under && under.closest('.wk-row .card');
    if (!t || t === d.card) return;
    var r = t.getBoundingClientRect();
    var after = d.px > r.left + r.width / 2;
    var order = flat().filter(function (w) { return w.slug !== d.slug; });
    var i = slugs(order).indexOf(t.dataset.slug);
    if (i < 0) return;
    order.splice(after ? i + 1 : i, 0, bySlug(d.slug));
    if (slugs(order).join() === slugs(flat()).join()) return;
    chunk(order);
    layout(true);
    d.lock = Date.now() + 260; // let the cards finish sliding first
  }
  function end(e) {
    var d = drag;
    if (!d || (e && e.pointerId !== d.id)) return;
    clearTimeout(d.timer);
    clearInterval(d.scroll);
    drag = null;
    if (!d.active) return;
    d.ghost.remove();
    d.card.classList.remove('placeholder');
    document.body.classList.remove('is-dragging');
    // Swallow the click that follows a drag.
    var stop = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
    d.card.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(function () { d.card.removeEventListener('click', stop, { capture: true }); }, 50);
    if (slugs(flat()).join() !== d.start.join()) remember(d.start, bySlug(d.slug).data.title || d.slug);
    saveBtn.hidden = orderKey() === before;
  }
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  list.addEventListener('contextmenu', function (e) { if (e.target.closest('.wk-row .card')) e.preventDefault(); });
  list.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* ---------- Compact view (alona 2026-11-16): small paintings, so the whole
     page fits on one screen while sorting. Remembered in this browser. ---------- */
  var compactBtn = A.$('#compact');
  function setCompact(on) {
    list.classList.toggle('compact', on);
    compactBtn.setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('hamzaWorksCompact', on ? '1' : ''); } catch (e) {}
  }
  if (compactBtn) {
    compactBtn.addEventListener('click', function () { setCompact(!list.classList.contains('compact')); });
    try { if (localStorage.getItem('hamzaWorksCompact')) setCompact(true); } catch (e) {}
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
      forget();
      A.toast(toast);
    }).catch(function (e) {
      A.toast('Couldn’t save the order: ' + e.message, true);
    }).then(done);
  }
  saveBtn.addEventListener('click', function () {
    saveOrder(flat().map(function (w) { return w.slug; }), 'Reorder works on the Works page', 'Order saved. The site updates in about a minute.');
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
