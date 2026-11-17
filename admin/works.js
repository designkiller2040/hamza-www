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
    var on = {};
    order.forEach(function (w) { on[w.slug] = 1; });
    var loose = works.filter(function (w) { return !on[w.slug]; });
    rows = split(order).map(function (items, i) { return { row: 'r' + i, items: items }; });
    if (loose.length) rows.push({ row: 'none', items: loose });
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
          c.style.gridColumn = 'span ' + spanOf(w, wides);
          box.appendChild(c);
        });
        addSpot(r, box);
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

  /* ---------- Empty spots (alona 2026-11-17) ----------
     A row that isn't full shows a quiet note in its free place: two square or
     vertical paintings sit left and right with space between them (as on the
     page), or he can add one there: a new painting, or one he already
     uploaded. Moving one from another row marks the place it came from, so he
     can fill that too or leave it as it is. */
  // { prev, next, title } around the place a painting left. Kept for this
  // browser tab, so the mark is still there after saving or adding a painting.
  var leftFrom = null;
  try { leftFrom = JSON.parse(sessionStorage.getItem('hamzaWorksLeft') || 'null'); } catch (e) {}
  function setLeft(v) {
    leftFrom = v;
    try { if (v) sessionStorage.setItem('hamzaWorksLeft', JSON.stringify(v)); else sessionStorage.removeItem('hamzaWorksLeft'); } catch (e) {}
  }
  function spanOf(w, wides) { return A.H2.isWide(w) ? (wides === 2 ? 3 : 4) : 2; }
  function addSpot(r, box) {
    var wides = r.items.filter(A.H2.isWide).length;
    var used = r.items.reduce(function (a, w) { return a + spanOf(w, wides); }, 0);
    if (used >= 6) return;
    var pair = r.items.length === 2 && !wides;
    var slugsHere = r.items.map(function (w) { return w.slug; });
    var marked = leftFrom && (slugsHere.indexOf(leftFrom.prev) >= 0 || slugsHere.indexOf(leftFrom.next) >= 0);
    var el = document.createElement('div');
    el.className = 'wk-spot' + (marked ? ' marked' : '');
    el.style.gridColumn = 'span 2';
    if (pair) el.dataset.before = r.items[1].slug; else el.dataset.after = r.items[r.items.length - 1].slug;
    el.dataset.row = slugsHere.join(',');
    var text = marked ? '“' + A.esc(leftFrom.title) + '” was here.'
      : pair ? 'These two paintings sit left and right, with space in the middle.'
      : 'There’s room for one more painting here.';
    el.innerHTML = '<div class="wk-spot-box"><p>' + text + '<br><span>' + (marked ? 'Add a painting here, or leave it as it is.' : 'Or add one here:') + '</span></p>' +
      '<div class="wk-spot-actions"><button type="button" class="btn spot-new">New painting</button><button type="button" class="btn spot-pick">Choose from works</button>' +
      (marked ? '<button type="button" class="btn ghost spot-leave">Leave it</button>' : '') + '</div></div>';
    if (pair) box.insertBefore(el, box.children[1]); else box.appendChild(el);
  }
  function spotClick(e) {
    var spot = e.target.closest('.wk-spot');
    if (!spot) return false;
    e.preventDefault(); e.stopPropagation();
    if (e.target.closest('.spot-leave')) { setLeft(null); layout(false); return true; }
    if (e.target.closest('.spot-new')) {
      if (!saveBtn.hidden) { A.toast('Please save the order first, then add the new painting.', true); return true; }
      location.href = 'work.html?new=1&' + (spot.dataset.before ? 'before=' + encodeURIComponent(spot.dataset.before) : 'after=' + encodeURIComponent(spot.dataset.after));
      return true;
    }
    if (e.target.closest('.spot-pick')) pick(spot);
    return true;
  }
  // Choose one of the uploaded paintings (square or vertical ones fit here).
  function pick(spot) {
    var here = spot.dataset.row.split(',');
    var placed = slugs(flat());
    var fits = function (w) { return !A.H2.isWide(w) && here.indexOf(w.slug) < 0; };
    var on = flat().filter(fits);
    var off = works.filter(function (w) { return placed.indexOf(w.slug) < 0 && fits(w); });
    function tile(w) {
      var img = w.data.image && w.data.image.src;
      return '<button type="button" class="pick-tile" data-slug="' + A.esc(w.slug) + '"><span class="pick-thumb">' +
        (img ? '<img alt="" data-src="' + A.esc(img) + '">' : '') + '</span><span class="pick-title">' + A.esc(w.data.title || w.slug) + '</span></button>';
    }
    var back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="confirm pick" role="dialog" aria-modal="true" aria-labelledby="pick-t">' +
      '<p class="confirm-title" id="pick-t">Choose a painting</p>' +
      '<p class="confirm-text">Square and vertical paintings fit this place. If taking one from another row leaves an empty place there, that place is marked so you can fill it too or leave it.</p>' +
      (on.length ? '<p class="pick-head">On the Works page</p><div class="pick-grid">' + on.map(tile).join('') + '</div>' : '') +
      (off.length ? '<p class="pick-head">Not on the Works page</p><div class="pick-grid">' + off.map(tile).join('') + '</div>' : '') +
      '<div class="confirm-actions"><button class="btn" type="button" data-no>Cancel</button></div></div>';
    function close() { back.remove(); document.removeEventListener('keydown', key, true); }
    function key(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    back.addEventListener('click', function (e) {
      if (e.target === back || e.target.closest('[data-no]')) return close();
      var t = e.target.closest('.pick-tile');
      if (!t) return;
      close();
      moveInto(t.dataset.slug, spot.dataset.before, spot.dataset.after);
    });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(back);
    A.$$('img[data-src]', back).forEach(function (img) { A.showImage(img, img.dataset.src); });
  }
  function moveInto(slug, before, after) {
    var prev = slugs(flat());
    var w = bySlug(slug);
    var order = flat().filter(function (x) { return x.slug !== slug; });
    var was = prev.indexOf(slug);
    if (was >= 0) setLeft({ prev: prev[was - 1], next: prev[was + 1], title: w.data.title || slug });
    var at = before ? slugs(order).indexOf(before) : slugs(order).indexOf(after) + 1;
    if (at < 0) at = 0;
    order.splice(at, 0, w);
    reorder(order);
    remember(prev, w.data.title || slug);
  }

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
    setLeft(null);
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
    if (spotClick(e)) return;
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
    var have = A.H2.order(data);
    if (have.some(function (s) { return order.indexOf(s) < 0; })) throw new Error('the works changed meanwhile. Reload the page and try again');
    // Paintings added from "Not on the Works page": 318 wide, height from the photo.
    var extra = {};
    order.forEach(function (s) {
      if (have.indexOf(s) >= 0) return;
      var w = bySlug(s), im = w && w.data.image;
      var sh = A.H2.SHAPES[w && w.data.shape] || (A.H2.isWide(w) ? A.H2.SHAPES.horizontal : A.H2.SHAPES.square);
      var ratio = im && im.width ? im.width / im.height : sh.ratio;
      extra[s] = { w: sh.w, h: Math.round(sh.w / ratio) };
    });
    A.H2.reflow(data, order, bySlug, extra);
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
