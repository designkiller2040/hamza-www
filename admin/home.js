/* Extra homepage photos (hero.moreSlides): add, remove, reorder, show/hide.
   Each one has its own image drop zone and description. */
var homeSlides = (function () {
  var list = [], box, onChange, uid = 0;
  var I = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"></path>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"></path>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
  };
  function icon(p) { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function add(s) {
    var id = 'sl' + (++uid);
    var el = document.createElement('div');
    el.className = 'slide';
    el.innerHTML =
      '<div class="slide-head"><h3></h3><div class="slide-tools">' +
      '<label class="slide-show"><input type="checkbox" data-show> Show on the homepage</label>' +
      '<button class="btn icon ghost" type="button" data-act="up" aria-label="Move up">' + icon(I.up) + '</button>' +
      '<button class="btn icon ghost" type="button" data-act="down" aria-label="Move down">' + icon(I.down) + '</button>' +
      '<button class="btn danger" type="button" data-act="del">' + icon(I.del) + 'Remove photo</button>' +
      '</div></div>' +
      '<div class="drop"></div><div class="image-meta"></div>' +
      '<div style="max-width:640px"><label class="lbl" for="' + id + '">Image description for screen readers</label>' +
      '<input class="field" id="' + id + '" type="text" autocomplete="off" data-alt></div>';
    var item = { el: el, orig: s || null };
    el.querySelector('[data-show]').checked = !(s && s.hidden);
    el.querySelector('[data-alt]').value = (s && s.image && s.image.alt) || '';
    item.zone = A.dropZone({ el: el.querySelector('.drop'), metaEl: el.querySelector('.image-meta'), value: s && s.image, onChange: function () { onChange(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]');
      if (!b || !el.contains(b)) return;
      var i = list.indexOf(item);
      if (b.dataset.act === 'del') list.splice(i, 1);
      if (b.dataset.act === 'up' && i > 0) { list.splice(i, 1); list.splice(i - 1, 0, item); }
      if (b.dataset.act === 'down' && i < list.length - 1) { list.splice(i, 1); list.splice(i + 1, 0, item); }
      render();
      onChange();
    });
    list.push(item);
    return item;
  }
  function render() {
    box.innerHTML = '';
    if (!list.length) box.innerHTML = '<p class="slide-empty">No extra photos. The homepage shows only the hero image.</p>';
    list.forEach(function (it, i) {
      it.el.querySelector('h3').textContent = 'Photo ' + (i + 2);
      it.el.querySelector('[data-act="up"]').disabled = i === 0;
      it.el.querySelector('[data-act="down"]').disabled = i === list.length - 1;
      box.appendChild(it.el);
    });
  }
  // Only files the admin uploaded itself (images/site/) are deleted with a slide.
  function own(src) { return src && /^images\/site\//.test(src); }
  return {
    init: function (data, $, change) {
      box = $('slides'); onChange = change;
      ((data.hero && data.hero.moreSlides) || []).forEach(add);
      render();
      $('add-slide').addEventListener('click', function () {
        var it = add(null);
        render();
        onChange();
        it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    },
    state: function () {
      return list.map(function (it) {
        return [it.zone.signature(), it.el.querySelector('[data-alt]').value, it.el.querySelector('[data-show]').checked];
      });
    },
    store: function (next, data) {
      var changes = [], kept = {};
      next.hero = next.hero || {};
      next.hero.moreSlides = [];
      list.forEach(function (it) {
        var alt = it.el.querySelector('[data-alt]').value.trim();
        var old = it.orig && it.orig.image;
        var r = A.imageChanges(it.zone, null, 'site', 'home-slide', alt);
        if (!r.image) return; // no photo chosen yet: skip
        r.changes.forEach(function (c) { changes.push(c); });
        if (old && old.src !== r.image.src && own(old.src)) changes.push({ path: old.src, remove: true });
        kept[r.image.src] = true;
        var s = JSON.parse(JSON.stringify(it.orig || {}));
        s.image = r.image;
        if (it.el.querySelector('[data-show]').checked) delete s.hidden; else s.hidden = true;
        next.hero.moreSlides.push(s);
      });
      ((data.hero && data.hero.moreSlides) || []).forEach(function (s) {
        var src = s.image && s.image.src;
        if (own(src) && !kept[src] && !changes.some(function (c) { return c.path === src; })) changes.push({ path: src, remove: true });
      });
      return changes;
    },
    saved: function (data) {
      list = [];
      box.innerHTML = '';
      ((data.hero && data.hero.moreSlides) || []).forEach(add);
      render();
    },
  };
})();

A.single({
  name: 'home page',
  path: 'content/home.json',
  view: '/',
  fields: ['captionLeft', 'captionRight', 'heroAlt', 'pageTitle', 'description', 'footer'],
  extra: homeSlides,
  load: function (d, $) {
    var h = d.hero || {};
    $('captionLeft').value = h.captionLeft || '';
    $('captionRight').value = h.captionRight || '';
    $('heroAlt').value = (h.image && h.image.alt) || '';
    $('pageTitle').value = d.pageTitle || '';
    $('description').value = d.description || '';
    $('footer').value = d.footer || '';
  },
  store: function (d, $) {
    d.hero = d.hero || {};
    d.hero.captionLeft = $('captionLeft').value.trim();
    d.hero.captionRight = $('captionRight').value.trim();
    d.pageTitle = $('pageTitle').value.trim();
    d.description = $('description').value.trim();
    d.footer = $('footer').value.trim();
  },
  image: {
    base: 'hero',
    get: function (d) { return d.hero && d.hero.image; },
    set: function (d, img) { d.hero.image = img; },
    alt: function ($) { return $('heroAlt').value.trim(); },
  },
});
