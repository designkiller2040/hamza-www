/* Works tab: the paintings laid out in the rows of the Works page (alona's
   sketch 2026-11-16: 6-column grid, square/vertical = 2 columns, horizontal =
   4, two horizontals 3 + 3). Row rules: three square or vertical paintings,
   or a horizontal one with one other.

   Rows stay where they are (alona 2026-11-17): dragging a painting changes
   only the row it leaves and the row it joins. If a row gets more than fits,
   its last other painting goes to "Waiting to be placed" on the right, from
   where it can be dragged into any free place. Free places show a quiet note
   with "New painting" / "Choose from works"; the place a painting left is
   marked. Arrows swap a painting with its neighbour in the row. Undo (button
   or Cmd/Ctrl+Z), Compact view, Save order (waiting paintings are hidden
   from the Works page until placed). */
A.start(function () {
  var list = A.$('#list');
  var saveBtn = A.$('#save-order');
  var works = [], home2 = { rows: [] };
  var rows = [];     // [{ id, items: [work] }] on the Works page, top to bottom
  var waiting = [];  // [work] taken out of a full row, not placed yet
  var before = '', nextId = 0, query = '';

  function bySlug(slug) { return works.filter(function (w) { return w.slug === slug; })[0]; }
  function slugs(a) { return a.map(function (w) { return w.slug; }); }
  function isWide(w) { return A.H2.isWide(w); }
  function capacity(items) { return items.some(isWide) ? 2 : 3; }
  function full(items) { return items.length >= capacity(items); }
  function rowById(id) { return rows.filter(function (r) { return r.id === id; })[0]; }
  function rowOf(slug) { return rows.filter(function (r) { return slugs(r.items).indexOf(slug) >= 0; })[0]; }
  function loose() {
    var on = rows.reduce(function (a, r) { return a.concat(slugs(r.items)); }, slugs(waiting));
    return works.filter(function (w) { return on.indexOf(w.slug) < 0; });
  }

  function group() {
    rows = home2.rows.map(function (r) {
      return { id: 'r' + (nextId++), items: A.H2.slots(r).map(function (p) { return bySlug(p.slug); }).filter(Boolean) };
    }).filter(function (r) { return r.items.length; });
    waiting = [];
  }
  function snapshot() {
    return { rows: rows.map(function (r) { return { id: r.id, items: slugs(r.items) }; }), waiting: slugs(waiting), left: leftFrom };
  }
  function restore(st) {
    rows = st.rows.map(function (r) { return { id: r.id, items: r.items.map(bySlug).filter(Boolean) }; });
    waiting = st.waiting.map(bySlug).filter(Boolean);
  }
  function key() { return JSON.stringify(rows.filter(function (r) { return r.items.length; }).map(function (r) { return slugs(r.items); })) + '|' + slugs(waiting).join(','); }
  function dirty() { saveBtn.hidden = key() === before; }

  /* ---------- Moving ---------- */
  // Take a painting out of wherever it is. Returns the row it left (if any).
  function take(slug) {
    var r = rowOf(slug);
    if (r) { r.items = r.items.filter(function (w) { return w.slug !== slug; }); return r; }
    waiting = waiting.filter(function (w) { return w.slug !== slug; });
    return null;
  }
  // Put a painting into row r at index i. If the row gets more than fits, its
  // last other painting goes to the front of "Waiting to be placed".
  function put(slug, r, i) {
    var w = bySlug(slug);
    r.items.splice(Math.max(0, Math.min(i, r.items.length)), 0, w);
    while (r.items.length > capacity(r.items)) {
      var out = r.items[r.items.length - 1] === w ? r.items.splice(r.items.length - 2, 1)[0] : r.items.pop();
      waiting.unshift(out);
    }
  }
  // dest: { ref: slug, after } next to a painting | { row: id, index } a free
  // place | { waiting: true } | { newRow: true }
  function move(slug, dest) {
    var from = take(slug);
    if (dest.ref) {
      var r = rowOf(dest.ref);
      if (r) put(slug, r, slugs(r.items).indexOf(dest.ref) + (dest.after ? 1 : 0));
      else waiting.unshift(bySlug(slug));
    } else if (dest.waiting) waiting.unshift(bySlug(slug));
    else if (dest.newRow) { var nr = { id: 'r' + (nextId++), items: [] }; rows.push(nr); put(slug, nr, 0); }
    else if (rowById(dest.row)) put(slug, rowById(dest.row), dest.index);
    else waiting.unshift(bySlug(slug));
    return from;
  }
  function tidy() { rows = rows.filter(function (r) { return r.items.length; }); }
  // Mark the place a painting left, if its old row now has room.
  function markLeft(from, slug, title, startItems) {
    if (!from || !from.items.length || full(from.items)) return;
    var i = startItems.indexOf(slug);
    setLeft({ prev: startItems[i - 1], next: startItems[i + 1], title: title });
  }

  /* ---------- Cards ---------- */
  var ARROWS = '<span class="move"><button type="button" class="move-btn" data-move="-1" aria-label="Swap with the one before" title="Swap with the one before"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg></button><button type="button" class="move-btn" data-move="1" aria-label="Swap with the one after" title="Swap with the one after"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg></button></span>';
  function card(w, placed) {
    var d = w.data, img = d.image && d.image.src;
    var tags = [];
    if (d.year) tags.push('<span class="tag">' + A.esc(d.year) + '</span>');
    if (d.size) tags.push('<span class="tag">' + A.esc(d.size) + '</span>');
    if (!img) tags.push('<span class="tag amber">No image</span>');
    if (d.note) tags.push('<span class="tag yellow" title="' + A.esc(d.note) + '">Note</span>');
    return '<a class="card" href="work.html?slug=' + encodeURIComponent(w.slug) + '" data-slug="' + A.esc(w.slug) + '" data-title="' + A.esc((d.title || '').toLowerCase()) + '" title="' + A.esc(d.title || '') + '">' +
      '<div class="thumb"><span class="badge"></span>' + (placed ? ARROWS : '') +
      (img ? '<img alt="" data-src="' + A.esc(img) + '" loading="lazy">'
           : '<div class="no-image"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="8.5" r="1.5"></circle></svg></div>') +
      '</div><div class="card-title">' + A.esc(d.title || 'Untitled') + '</div>' +
      '<div class="tags">' + tags.join('') + '</div></a>';
  }
  // Each card is made once and moved around, so images don't reload and the
  // cards can slide to their new places.
  var cards = {};
  function cardEl(w, placed) {
    var k = w.slug + (placed ? '' : ':none');
    if (!cards[k]) {
      var t = document.createElement('div');
      t.innerHTML = card(w, placed);
      cards[k] = t.firstChild;
      var img = A.$('img[data-src]', cards[k]);
      if (img) A.showImage(img, img.dataset.src);
    }
    return cards[k];
  }

  /* ---------- Free places ---------- */
  // { prev, next, title } around the place a painting left. Kept for this
  // browser tab, so the mark is still there after saving or adding a painting.
  var leftFrom = null;
  try { leftFrom = JSON.parse(sessionStorage.getItem('hamzaWorksLeft') || 'null'); } catch (e) {}
  function setLeft(v) {
    leftFrom = v;
    try { if (v) sessionStorage.setItem('hamzaWorksLeft', JSON.stringify(v)); else sessionStorage.removeItem('hamzaWorksLeft'); } catch (e) {}
  }
  function spanOf(w, wides) { return isWide(w) ? (wides === 2 ? 3 : 4) : 2; }
  function addSpot(r, box) {
    if (full(r.items)) return;
    var pair = r.items.length === 2 && !r.items.some(isWide);
    var here = slugs(r.items);
    var marked = leftFrom && (here.indexOf(leftFrom.prev) >= 0 || here.indexOf(leftFrom.next) >= 0);
    var el = document.createElement('div');
    el.className = 'wk-spot' + (marked ? ' marked' : '');
    el.style.gridColumn = 'span 2';
    el.dataset.row = r.id;
    el.dataset.index = pair ? 1 : r.items.length;
    var text = !r.items.length ? 'An empty row.'
      : marked ? '“' + A.esc(leftFrom.title) + '” was here.'
      : pair ? 'These two paintings sit left and right, with space in the middle.'
      : 'There’s room for one more painting here.';
    el.innerHTML = '<div class="wk-spot-box"><p>' + text + '<br><span>' + (marked ? 'Add a painting here, or leave it as it is.' : 'Or add one here:') + '</span></p>' +
      '<div class="wk-spot-actions"><button type="button" class="btn spot-new">New painting</button><button type="button" class="btn spot-pick">Choose from works</button>' +
      (marked ? '<button type="button" class="btn ghost spot-leave">Leave it</button>' : '') + '</div></div>';
    if (pair) box.insertBefore(el, box.children[1]); else box.appendChild(el);
  }

  /* ---------- Drawing ---------- */
  var tray = document.createElement('aside');
  tray.className = 'wk-waiting';
  tray.innerHTML = '<p class="wk-waiting-head">Waiting to be placed</p><p class="wk-waiting-hint">Drag into a free place.</p><div class="wk-waiting-list"></div>';
  document.body.appendChild(tray);

  function render() { layout(false); }
  // animate: cards slide from where they were (FLIP).
  function layout(animate) {
    var first = {};
    if (animate) Object.keys(cards).forEach(function (k) {
      if (cards[k].isConnected) first[k] = cards[k].getBoundingClientRect();
    });
    var n = 0;
    var groups = document.createElement('div');
    groups.className = 'groups';
    rows.forEach(function (r) {
      var g = document.createElement('div');
      g.className = 'group wk-row-group';
      g.dataset.row = r.id;
      var box = document.createElement('div');
      box.className = 'cards wk-row';
      var wides = r.items.filter(isWide).length;
      r.items.forEach(function (w, i) {
        var c = cardEl(w, true);
        A.$('.badge', c).textContent = ++n;
        c.classList.toggle('wide', isWide(w));
        c.style.gridColumn = 'span ' + spanOf(w, wides);
        A.$('.move-btn[data-move="-1"]', c).hidden = i === 0;
        A.$('.move-btn[data-move="1"]', c).hidden = i === r.items.length - 1;
        box.appendChild(c);
      });
      addSpot(r, box);
      g.appendChild(box);
      groups.appendChild(g);
    });
    // Shown while dragging: drop here to start a new row at the bottom.
    groups.insertAdjacentHTML('beforeend', '<div class="wk-newrow">Drop here to start a new row</div>');
    var off = loose();
    if (off.length) {
      var g = document.createElement('div');
      g.className = 'group';
      g.dataset.row = 'none';
      g.innerHTML = '<div class="group-head"><h3>Not on the Works page</h3><span>' + off.length + (off.length === 1 ? ' work' : ' works') + '</span></div>';
      var box = document.createElement('div');
      box.className = 'cards';
      off.forEach(function (w) { var c = cardEl(w, false); A.$('.badge', c).textContent = ''; box.appendChild(c); });
      g.appendChild(box);
      groups.appendChild(g);
    }
    list.innerHTML = '';
    list.appendChild(groups);
    list.insertAdjacentHTML('beforeend', '<p class="empty-search" id="no-results" hidden>No works match that search.</p>');
    // Waiting paintings: small cards in the panel on the right.
    var wl = A.$('.wk-waiting-list', tray);
    wl.innerHTML = '';
    waiting.forEach(function (w) { var c = cardEl(w, true); A.$('.badge', c).textContent = ''; c.style.gridColumn = ''; wl.appendChild(c); });
    tray.classList.toggle('show', waiting.length > 0);
    // Keep the room for the panel while dragging out of it, so the rows don't jump.
    document.body.classList.toggle('has-waiting', waiting.length > 0 || !!(drag && drag.active && drag.hadWaiting));
    if (query) search(query);
    if (!animate) return;
    Object.keys(first).forEach(function (k) {
      var c = cards[k];
      if (!c.isConnected || c.closest('.wk-waiting')) return;
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

  /* ---------- Undo ---------- */
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
    A.$('.undo-btn', undoBar).hidden = false;
    undoBar.hidden = false;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(function () { undoBar.hidden = true; }, 8000);
  }
  function undo() {
    var prev = history.pop();
    if (!prev) return;
    setLeft(prev.left || null);
    restore(prev);
    layout(true);
    dirty();
    if (undoBar) {
      A.$('span', undoBar).textContent = 'Undone.';
      A.$('.undo-btn', undoBar).hidden = !history.length;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(function () { undoBar.hidden = true; }, history.length ? 8000 : 2000);
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

  /* ---------- Clicks: arrows (swap in the row), free places ---------- */
  list.addEventListener('click', function (e) {
    var spot = e.target.closest('.wk-spot');
    if (spot) {
      e.preventDefault(); e.stopPropagation();
      if (e.target.closest('.spot-leave')) { setLeft(null); layout(false); return; }
      if (e.target.closest('.spot-new')) {
        if (!saveBtn.hidden) { A.toast('Please save the order first, then add the new painting.', true); return; }
        var r = rowById(spot.dataset.row), i = Number(spot.dataset.index);
        var q = r.items[i] ? 'before=' + encodeURIComponent(r.items[i].slug) : r.items.length ? 'after=' + encodeURIComponent(r.items[r.items.length - 1].slug) : '';
        location.href = 'work.html?new=1' + (q ? '&' + q : '');
        return;
      }
      if (e.target.closest('.spot-pick')) pick(spot);
      return;
    }
    var b = e.target.closest('.move-btn');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var slug = b.closest('.card').dataset.slug, row = rowOf(slug);
    if (!row) return;
    var a = slugs(row.items).indexOf(slug), j = a + Number(b.dataset.move);
    if (j < 0 || j >= row.items.length) return;
    var prev = snapshot();
    var t = row.items[a]; row.items[a] = row.items[j]; row.items[j] = t;
    layout(true);
    dirty();
    remember(prev, bySlug(slug).data.title || slug);
  });
  tray.addEventListener('click', function (e) { if (e.target.closest('.move-btn')) { e.preventDefault(); e.stopPropagation(); } });

  // "Choose from works": only paintings that fit the row; waiting ones first.
  function pick(spot) {
    var r = rowById(spot.dataset.row);
    var here = slugs(r.items);
    var choose = function (w) { var t = r.items.concat([w]); return here.indexOf(w.slug) < 0 && t.length <= capacity(t); };
    var wait = waiting.filter(choose);
    var on = rows.reduce(function (a, x) { return a.concat(x === r ? [] : x.items); }, []).filter(choose);
    var off = loose().filter(choose);
    function tile(w) {
      var img = w.data.image && w.data.image.src;
      return '<button type="button" class="pick-tile" data-slug="' + A.esc(w.slug) + '"><span class="pick-thumb">' +
        (img ? '<img alt="" data-src="' + A.esc(img) + '">' : '') + '</span><span class="pick-title">' + A.esc(w.data.title || w.slug) + '</span></button>';
    }
    function section(title, items) { return items.length ? '<p class="pick-head">' + title + '</p><div class="pick-grid">' + items.map(tile).join('') + '</div>' : ''; }
    var back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="confirm pick" role="dialog" aria-modal="true" aria-labelledby="pick-t">' +
      '<p class="confirm-title" id="pick-t">Choose a painting</p>' +
      '<p class="confirm-text">Only paintings that fit this row are shown. Taking one from another row leaves a free place there; it will be marked so you can fill it too or leave it.</p>' +
      section('Waiting to be placed', wait) + section('On the Works page', on) + section('Not on the Works page', off) +
      (wait.length + on.length + off.length ? '' : '<p class="confirm-text">No painting fits here. Add a new one instead.</p>') +
      '<div class="confirm-actions"><button class="btn" type="button" data-no>Cancel</button></div></div>';
    function close() { back.remove(); document.removeEventListener('keydown', esc, true); }
    function esc(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    back.addEventListener('click', function (e) {
      if (e.target === back || e.target.closest('[data-no]')) return close();
      var t = e.target.closest('.pick-tile');
      if (!t) return;
      close();
      var prev = snapshot(), slug = t.dataset.slug, w = bySlug(slug);
      var startItems = rowOf(slug) ? slugs(rowOf(slug).items) : [];
      var from = move(slug, { row: r.id, index: Number(spot.dataset.index) });
      markLeft(from, slug, w.data.title || slug, startItems);
      tidy();
      layout(true);
      dirty();
      remember(prev, w.data.title || slug);
    });
    document.addEventListener('keydown', esc, true);
    document.body.appendChild(back);
    A.$$('img[data-src]', back).forEach(function (img) { A.showImage(img, img.dataset.src); });
  }

  /* ---------- Drag: the spot where the painting will land is a dark dashed
     box; only the row it leaves and the row it joins change. ---------- */
  var drag = null;
  function onDown(e) {
    if (e.button !== 0 || query) return;
    if (e.target.closest('.move-btn, .wk-spot')) return;
    var c = e.target.closest('.wk-row .card, .wk-waiting .card');
    if (!c) return;
    var d = { x: e.clientX, y: e.clientY, id: e.pointerId, card: c, slug: c.dataset.slug, touch: e.pointerType === 'touch', active: false, timer: null, lock: 0 };
    if (d.touch) d.timer = setTimeout(function () { begin(d, d.x, d.y); }, 300);
    drag = d;
  }
  list.addEventListener('pointerdown', onDown);
  tray.addEventListener('pointerdown', onDown);
  function begin(d, x, y) {
    if (d.active) return;
    d.active = true;
    d.start = snapshot();
    d.startKey = key();
    var from = rowOf(d.slug);
    d.fromId = from && from.id;
    d.fromItems = from ? slugs(from.items) : [];
    d.dest = null;
    d.hadWaiting = waiting.length > 0;
    var r = d.card.getBoundingClientRect();
    var gw = Math.min(Math.max(r.width, 160), 280);
    d.dx = Math.min(x - r.left, gw / 2); d.dy = Math.min(y - r.top, 100);
    d.ghost = d.card.cloneNode(true);
    d.ghost.classList.add('drag-ghost', 'wk-ghost');
    d.ghost.style.transform = '';
    d.ghost.style.width = gw + 'px';
    var gt = A.$('.thumb', d.ghost);
    if (gt) gt.style.height = Math.round(gw * 0.8) + 'px';
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
    clearInterval(d.scroll);
    var edge = e.clientY < 110 ? -14 : e.clientY > innerHeight - 70 ? 14 : 0;
    if (edge) d.scroll = setInterval(function () { window.scrollBy(0, edge); target(d); }, 16);
  }, { passive: false });
  window.addEventListener('touchmove', function (e) { if (drag && drag.active) e.preventDefault(); }, { passive: false });
  // Where the pointer points: next to a painting, a free place, the waiting
  // panel or the new-row strip. Always applied to the rows as they were when
  // the drag started, so nothing else drifts.
  function target(d) {
    if (Date.now() < d.lock) return;
    var under = document.elementFromPoint(d.px, d.py);
    if (!under) return;
    var dest = null;
    var t = under.closest('.wk-row .card, .wk-waiting .card');
    var spot = under.closest('.wk-spot');
    if (under.closest('.wk-newrow')) dest = { newRow: true };
    else if (spot) dest = { row: spot.dataset.row, index: Number(spot.dataset.index) };
    else if (t && t !== d.card) {
      var rect = t.getBoundingClientRect();
      dest = rowOf(t.dataset.slug) ? { ref: t.dataset.slug, after: d.px > rect.left + rect.width / 2 } : { waiting: true };
    } else if (under.closest('.wk-waiting')) dest = { waiting: true };
    if (!dest || JSON.stringify(dest) === JSON.stringify(d.dest)) return;
    restore(d.start);
    move(d.slug, dest);
    d.dest = dest;
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
    var stop = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
    d.card.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(function () { d.card.removeEventListener('click', stop, { capture: true }); }, 50);
    var title = bySlug(d.slug).data.title || d.slug;
    var from = d.fromId && rowById(d.fromId);
    if (from && from !== rowOf(d.slug)) markLeft(from, d.slug, title, d.fromItems);
    tidy();
    layout(false);
    if (key() !== d.startKey) remember(d.start, title);
    dirty();
  }
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  [list, tray].forEach(function (el) {
    el.addEventListener('contextmenu', function (e) { if (e.target.closest('.card')) e.preventDefault(); });
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
  });

  /* ---------- Compact view: small paintings, so most of the page fits on
     one screen while sorting. Remembered in this browser. ---------- */
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

  /* ---------- Search by title ---------- */
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
      A.$$('.wk-spot', g).forEach(function (s) { s.hidden = !!query; });
      g.hidden = !shown && !!query;
      if (shown) any = true;
    });
    A.$('#no-results').hidden = any || !query;
  }
  A.$('#search').addEventListener('input', function (e) { search(e.target.value); });
  A.$('#search-phone').addEventListener('input', function (e) { search(e.target.value); });

  /* ---------- Save ---------- */
  // Write the rows into home2.json. Waiting paintings come off the Works page.
  function fill(data, groups) {
    var have = A.H2.order(data);
    // Paintings that weren't on the page: 318 wide (626 if horizontal), height from the photo.
    var extra = {};
    groups.forEach(function (g) {
      g.forEach(function (s) {
        if (have.indexOf(s) >= 0) return;
        var w = bySlug(s), im = w && w.data.image;
        var sh = A.H2.SHAPES[w && w.data.shape] || (isWide(w) ? A.H2.SHAPES.horizontal : A.H2.SHAPES.square);
        var ratio = im && im.width ? im.width / im.height : sh.ratio;
        extra[s] = { w: sh.w, h: Math.round(sh.w / ratio) };
      });
    });
    A.H2.regroup(data, groups, extra);
  }
  function groupsNow() { return rows.filter(function (r) { return r.items.length; }).map(function (r) { return slugs(r.items); }); }
  saveBtn.addEventListener('click', function () {
    var ask = waiting.length
      ? A.confirm(waiting.length + (waiting.length === 1 ? ' painting is' : ' paintings are') + ' still waiting to be placed (' +
          waiting.map(function (w) { return '“' + (w.data.title || w.slug) + '”'; }).join(', ') +
          '). They’ll be hidden from the Works page until you place them.', 'Save anyway')
      : Promise.resolve(true);
    ask.then(function (ok) {
      if (!ok) return;
      var groups = groupsNow();
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      A.commit('Reorder works on the Works page', [A.H2.update(function (data) { fill(data, groups); })]).then(function () {
        fill(home2, groups);
        group();
        before = key();
        render();
        saveBtn.hidden = true;
        forget();
        A.toast('Order saved. The site updates in about a minute.');
      }).catch(function (e) {
        A.toast('Couldn’t save the order: ' + e.message, true);
      }).then(function () { saveBtn.disabled = false; saveBtn.textContent = 'Save order'; });
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (!saveBtn.hidden) { e.preventDefault(); e.returnValue = ''; }
  });

  return Promise.all([A.readFolder('content/works'), A.readJSON(A.H2.PATH)]).then(function (res) {
    works = res[0];
    home2 = res[1] || { rows: [] };
    home2.rows = home2.rows || [];
    group();
    before = key();
    render();
  });
});
