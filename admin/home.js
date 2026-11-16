/* Home tab (alona's layout, 2026-11-16): a Slideshow on/off switch.
   Off: one big photo (the first one). On: every photo as a numbered card,
   drag to reorder, "Add image" at the end. Photos stay saved either way;
   the site shows only the first photo when the slideshow is off, and
   changes photo every 5 seconds when it is on (home.json "slideshow"). */
A.start(function () {
  var PATH = 'content/home.json';
  var $ = function (id) { return document.getElementById(id); };
  var data = null, items = [], ed = null;
  var box = $('slides');
  var I = { plus: '<path d="M12 5v14M5 12h14"></path>' };
  function icon(p, s) { return '<svg width="' + (s || 14) + '" height="' + (s || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }

  function on() { return $('slideshow').checked; }

  function make(slide) {
    var el = document.createElement('div');
    el.className = 'home-card';
    el.innerHTML = '<span class="badge"></span><div class="drop"></div><div class="image-meta"></div>';
    var it = { el: el, orig: slide || null };
    it.zone = A.dropZone({ el: el.querySelector('.drop'), metaEl: el.querySelector('.image-meta'),
      value: slide && slide.image, hint: 'Landscape works best: shown at about 2 : 1. JPG, PNG or WebP up to 20 MB.',
      onChange: function () {
        // Remove takes the card away (the first one too: the next becomes the first).
        if (!it.zone.value()) { items.splice(items.indexOf(it), 1); render(); }
        ed && ed.update();
      } });
    return it;
  }
  function render() {
    var single = !on();
    box.classList.toggle('single', single);
    box.innerHTML = '';
    items.forEach(function (it, i) {
      it.el.querySelector('.badge').textContent = i + 1;
      it.el.hidden = single && i > 0;
      box.appendChild(it.el);
    });
    if (!single || !items.length) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'home-add';
      t.innerHTML = '<span class="badge">' + (items.length + 1) + '</span>' + icon(I.plus, 28) +
        '<span class="home-add-big">Add image</span><span class="home-add-small">Landscape, about 2 : 1 (shown 1200 × 599 on a laptop). JPG, PNG or WebP, up to 20 MB.</span>';
      t.addEventListener('click', function () {
        var it = make(null);
        items.push(it);
        render();
        it.el.querySelector('input[type=file]').click();
      });
      box.appendChild(t);
    }
    $('slideshow-label').textContent = on() ? 'Slideshow on' : 'Slideshow off';
    $('slideshow-hint').textContent = on()
      ? 'The homepage changes photo every 5 seconds, in this order. Drag a photo to move it.'
      : 'The homepage shows this photo. Your other photos stay saved; switch the slideshow on to show them.';
  }
  A.sortable(box, { items: '.home-card', handle: '.pic', disabled: function () { return !on(); }, onEnd: function () {
    var els = A.$$('.home-card', box);
    items.sort(function (a, b) { return els.indexOf(a.el) - els.indexOf(b.el); });
    render();
    ed.update();
  } });

  function state() {
    return [on(), $('pageTitle').value, $('description').value, items.map(function (it) { return it.zone.signature(); })];
  }
  function save() {
    var next = JSON.parse(JSON.stringify(data));
    var changes = [], kept = {};
    var slides = [];
    items.forEach(function (it) {
      var old = it.orig && it.orig.image;
      var r = A.imageChanges(it.zone, null, 'site', 'home-slide', (old && old.alt) || '');
      if (!r.image) return; // card without a photo yet
      r.changes.forEach(function (c) { changes.push(c); });
      kept[r.image.src] = true;
      var s = it.orig ? JSON.parse(JSON.stringify(it.orig)) : {};
      delete s.moreSlides; delete s.hidden;
      s.image = r.image;
      slides.push(s);
    });
    if (!slides.length) return Promise.reject(new Error('The homepage needs at least one photo.'));
    var first = slides[0];
    next.hero = { image: first.image, captionLeft: first.captionLeft || '', captionRight: first.captionRight || '', moreSlides: slides.slice(1) };
    next.slideshow = on();
    next.pageTitle = $('pageTitle').value.trim();
    next.description = $('description').value.trim();
    // Photos the admin uploaded that are gone now.
    var old = [data.hero].concat((data.hero && data.hero.moreSlides) || []);
    old.forEach(function (s) {
      var src = s && s.image && s.image.src;
      if (A.ownImage(src) && !kept[src]) changes.push({ path: src, remove: true });
    });
    changes.push({ path: PATH, text: A.json(next) });
    return A.commit('Update home page', changes).then(function () {
      data = next;
      load();
    });
  }
  function load() {
    var h = data.hero || {};
    var more = h.moreSlides || [];
    // Before the switch existed, extra photos were each shown or hidden.
    var show = data.slideshow != null ? !!data.slideshow : more.some(function (s) { return s && !s.hidden; });
    $('slideshow').checked = show;
    items = [make({ image: h.image, captionLeft: h.captionLeft, captionRight: h.captionRight })].concat(more.map(make))
      .filter(function (it) { return it.zone.value(); });
    $('pageTitle').value = data.pageTitle || '';
    $('description').value = data.description || '';
    render();
  }

  $('slideshow').addEventListener('change', function () { render(); ed.update(); });
  return A.readJSON(PATH).then(function (d) {
    data = d || {};
    load();
    ed = A.editor({ state: state, save: save });
    ed.start();
  });
});
