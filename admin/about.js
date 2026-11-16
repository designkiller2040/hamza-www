/* About page editor (content/about.json), laid out like the About page itself
   (alona 2026-11-16): Title (the quote) and Biography left of the portrait,
   Studies and Solo shows left of Contacts, then the Press cards side by side.
   Section names on the site (Biography, Studies, Solo shows, Contacts, Press)
   stay as they are. */
(function () {
  var I = {
    left: '<path d="M15 18l-6-6 6-6"></path>',
    right: '<path d="M9 18l6-6-6-6"></path>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
  };
  function icon(p) { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var uid = 0;
  function field(label, key, ph, lblClass) {
    var id = 'f' + (++uid);
    return '<div><label class="' + (lblClass || 'lbl') + '" for="' + id + '">' + label + '</label>' +
      '<input class="field" id="' + id + '" type="text" autocomplete="off" data-k="' + key + '" placeholder="' + A.esc(ph || '') + '"></div>';
  }
  function val(el, k) { return el.querySelector('[data-k="' + k + '"]').value; }
  function set(el, k, v) { el.querySelector('[data-k="' + k + '"]').value = v || ''; }

  /* A reorderable list. spec: {box, html(), tools(), fill(el, v), read(el),
     zone: each item has a photo, addTile: html of an "add" tile at the end,
     addBtn: a separate add button, empty: text when there are none} */
  function list(spec) {
    var items = [], onChange = function () {};
    function make(v) {
      var el = document.createElement('div');
      el.className = spec.cls;
      el.innerHTML = spec.html();
      var it = { el: el, orig: v || null };
      spec.fill(el, v || {});
      if (spec.zone) {
        it.zone = A.dropZone({ el: el.querySelector('.drop'), metaEl: el.querySelector('.image-meta'),
          value: v && v.image ? { src: v.image } : null, onChange: function () { onChange(); } });
      }
      el.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-act]');
        if (!b || !el.contains(b) || b.closest('.image-meta')) return;
        var i = items.indexOf(it);
        if (b.dataset.act === 'del') items.splice(i, 1);
        if (b.dataset.act === 'up' && i > 0) { items.splice(i, 1); items.splice(i - 1, 0, it); }
        if (b.dataset.act === 'down' && i < items.length - 1) { items.splice(i, 1); items.splice(i + 1, 0, it); }
        render();
        onChange();
      });
      items.push(it);
      return it;
    }
    function add() {
      var it = make(null);
      render();
      onChange();
      var f = it.el.querySelector('input');
      if (f && !spec.zone) f.focus();
    }
    function render() {
      spec.box.innerHTML = '';
      if (!items.length && spec.empty) spec.box.innerHTML = '<p class="slide-empty">' + spec.empty + '</p>';
      items.forEach(function (it, i) {
        var up = it.el.querySelector('[data-act="up"]'), down = it.el.querySelector('[data-act="down"]');
        if (up) up.disabled = i === 0;
        if (down) down.disabled = i === items.length - 1;
        spec.box.appendChild(it.el);
      });
      if (spec.addTile) {
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'new-card press-new';
        t.innerHTML = spec.addTile;
        t.addEventListener('click', add);
        spec.box.appendChild(t);
      }
    }
    if (spec.addBtn) spec.addBtn.addEventListener('click', add);
    // Drag a card by its photo to reorder (alona 2026-11-16).
    if (spec.drag) A.sortable(spec.box, { items: '.' + spec.cls, handle: '.pic', onEnd: function () {
      var els = A.$$('.' + spec.cls, spec.box);
      items.sort(function (a, b) { return els.indexOf(a.el) - els.indexOf(b.el); });
      render();
      onChange();
    } });
    return {
      items: function () { return items; },
      load: function (arr, change) { items = []; if (change) onChange = change; (arr || []).forEach(make); render(); },
      state: function () { return items.map(function (it) { return [spec.read(it.el), it.zone ? it.zone.signature() : '']; }); },
    };
  }

  // ---- Contacts: one row each, inside the grey box ------------------------
  var links = list({
    box: document.getElementById('links'),
    addBtn: document.getElementById('add-link'),
    cls: 'contact-row',
    empty: 'No contacts yet.',
    html: function () {
      return field('Shown as', 'text', 'e.g. @hamzashah') +
        field('Label', 'label', 'e.g. (ig)') +
        field('Link', 'href', 'e.g. instagram.com/hamzashah or an email') +
        '<button class="btn icon ghost" type="button" data-act="del" aria-label="Remove contact">' + icon(I.del) + '</button>';
    },
    fill: function (el, v) {
      set(el, 'text', v.text); set(el, 'label', v.label);
      set(el, 'href', String(v.href || '').replace(/^mailto:/, ''));
    },
    read: function (el) { return [val(el, 'text'), val(el, 'label'), val(el, 'href')]; },
  });
  // An email address on its own becomes a mailto: link; a bare web address gets https://.
  function linkHref(h) {
    h = h.trim();
    if (!h) return '';
    if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(h)) return 'mailto:' + h;
    if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
    return 'https://' + h.replace(/^\/+/, '');
  }

  // ---- Press cards: side by side, like on the site -------------------------
  var press = list({
    box: document.getElementById('press'),
    cls: 'press-item',
    zone: true,
    drag: true,
    addTile: icon(I.plus) + 'Add press card',
    html: function () {
      return '<div class="drop"></div><div class="image-meta"></div>' +
        '<div><label class="lbl-main" for="f' + (uid + 1) + '">Title</label><textarea class="field" id="f' + (++uid) + '" rows="3" data-k="title" placeholder="e.g. He paints with coffee and tea as a tribute to his Afghan mother"></textarea></div>' +
        field('Link text', 'linkText', 'e.g. Read full article', 'lbl-main') +
        field('Link URL', 'href', 'https://…', 'lbl-main') +
        '<div class="press-tools">' +
        '<button class="btn danger" type="button" data-act="del">' + icon(I.del) + 'Remove</button>' +
        '</div>';
    },
    fill: function (el, v) { ['title', 'linkText', 'href'].forEach(function (k) { set(el, k, v[k]); }); },
    read: function (el) { return [val(el, 'title'), val(el, 'linkText'), val(el, 'href')]; },
  });

  var $ = function (id) { return document.getElementById(id); };
  function lines(id) { return $(id).value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }

  var pressImages = [];
  A.single({
    name: 'about page',
    path: 'content/about.json',
    view: '../about/',
    fields: ['quote', 'bio', 'studies', 'soloShows'],
    load: function (d, $) {
      $('quote').value = d.quote || '';
      $('bio').value = d.bio || '';
      $('studies').value = (d.studies || []).join('\n');
      $('soloShows').value = (d.soloShows || []).join('\n');
    },
    store: function (d, $) {
      d.quote = $('quote').value.trim();
      d.bio = $('bio').value.trim();
      d.studies = lines('studies');
      d.soloShows = lines('soloShows');
    },
    validate: function () {
      if (press.items().some(function (it) { return !it.zone.value(); })) return 'Every press card needs a photo.';
      return '';
    },
    image: {
      base: 'portrait',
      get: function (d) { return d.portrait; },
      set: function (d, img) { d.portrait = img; },
      // The description for screen readers stays as it was (not shown here).
      alt: function () { return ''; },
    },
    extra: {
      init: function (data, $, change) {
        links.load(data.links, change);
        press.load(data.media, change);
        pressImages = (data.media || []).map(function (m) { return m.image; });
      },
      state: function () { return [links.state(), press.state()]; },
      store: function (next, data) {
        var changes = [];
        // Keep the portrait's screen-reader description.
        if (next.portrait && data.portrait && !next.portrait.alt) next.portrait.alt = data.portrait.alt || '';
        next.links = links.items().map(function (it) {
          var v = JSON.parse(JSON.stringify(it.orig || {}));
          v.text = val(it.el, 'text').trim();
          v.label = val(it.el, 'label').trim();
          v.href = linkHref(val(it.el, 'href'));
          return v;
        }).filter(function (v) { return v.text || v.href; });
        var kept = {};
        next.media = press.items().map(function (it) {
          var v = JSON.parse(JSON.stringify(it.orig || {}));
          ['title', 'linkText', 'href'].forEach(function (k) { v[k] = val(it.el, k).trim(); });
          v.href = linkHref(v.href);
          if (!v.alt) v.alt = v.title.split('\n')[0];
          var cur = it.zone.value();
          if (it.zone.hasUpload()) {
            var path = 'images/press/' + (A.slugify(v.title).slice(0, 40) || 'press') + '-' + A.rand(6) + '.' + cur.ext;
            changes.push({ path: path, blob: cur.blob });
            v.image = path;
            if (cur.blur) v.blur = cur.blur; else delete v.blur;
          }
          kept[v.image] = true;
          return v;
        });
        // Press photos the admin uploaded and no card uses any more are removed.
        pressImages.forEach(function (src) { if (A.ownImage(src) && !kept[src]) changes.push({ path: src, remove: true }); });
        return changes;
      },
      saved: function (data) {
        links.load(data.links);
        press.load(data.media);
        pressImages = (data.media || []).map(function (m) { return m.image; });
      },
    },
  });
})();
