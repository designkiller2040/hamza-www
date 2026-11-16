/* About page editor (content/about.json): portrait, quote, biography,
   studies, solo shows, contacts and press cards. Section names on the site
   (Biography, Studies, Solo shows, Contacts, Press) stay as they are. */
(function () {
  var I = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"></path>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"></path>',
    del: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path>',
  };
  function icon(p) { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  var uid = 0;
  function nid() { return 'f' + (++uid); }
  function field(label, key, opts) {
    opts = opts || {};
    var id = nid();
    var input = opts.rows
      ? '<textarea class="field" id="' + id + '" rows="' + opts.rows + '" data-k="' + key + '" placeholder="' + A.esc(opts.ph || '') + '"></textarea>'
      : '<input class="field" id="' + id + '" type="text" autocomplete="off" data-k="' + key + '" placeholder="' + A.esc(opts.ph || '') + '">';
    return '<div><label class="lbl" for="' + id + '">' + label + '</label>' + input + (opts.hint ? '<p class="hint">' + opts.hint + '</p>' : '') + '</div>';
  }

  /* A reorderable list of items. spec: {box, add, name, empty, html, fill(el, v),
     read(el) -> object, zone: true when each item has a photo, onInput(item)} */
  function list(spec) {
    var items = [], onChange = function () {};
    function make(v) {
      var el = document.createElement('div');
      el.className = 'item';
      el.innerHTML =
        '<div class="slide-head"><h3></h3><div class="slide-tools">' +
        '<button class="btn icon ghost" type="button" data-act="up" aria-label="Move up">' + icon(I.up) + '</button>' +
        '<button class="btn icon ghost" type="button" data-act="down" aria-label="Move down">' + icon(I.down) + '</button>' +
        '<button class="btn danger" type="button" data-act="del">' + icon(I.del) + 'Remove</button>' +
        '</div></div>' + spec.html();
      var it = { el: el, orig: v || null };
      spec.fill(el, v || {});
      if (spec.zone) {
        it.zone = A.dropZone({ el: el.querySelector('.drop'), metaEl: el.querySelector('.image-meta'), value: v && v.image ? { src: v.image } : null,
          onChange: function () { if (spec.onInput) spec.onInput(it); onChange(); } });
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
      el.addEventListener('input', function () { if (spec.onInput) spec.onInput(it); });
      if (spec.onInput) spec.onInput(it);
      items.push(it);
      return it;
    }
    function render() {
      spec.box.innerHTML = '';
      if (!items.length) spec.box.innerHTML = '<p class="slide-empty">' + spec.empty + '</p>';
      items.forEach(function (it, i) {
        it.el.querySelector('h3').textContent = spec.name + ' ' + (i + 1);
        it.el.querySelector('[data-act="up"]').disabled = i === 0;
        it.el.querySelector('[data-act="down"]').disabled = i === items.length - 1;
        spec.box.appendChild(it.el);
      });
    }
    spec.add.addEventListener('click', function () {
      var it = make(null);
      render();
      onChange();
      it.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return {
      items: function () { return items; },
      load: function (arr, change) { items = []; if (change) onChange = change; (arr || []).forEach(make); render(); },
      state: function () { return items.map(function (it) { return [spec.read(it.el), it.zone ? it.zone.signature() : '']; }); },
    };
  }
  function val(el, k) { return el.querySelector('[data-k="' + k + '"]').value; }
  function set(el, k, v) { el.querySelector('[data-k="' + k + '"]').value = v || ''; }

  // ---- Contacts ----------------------------------------------------------
  var links = list({
    box: document.getElementById('links'),
    add: document.getElementById('add-link'),
    name: 'Contact',
    empty: 'No contacts yet.',
    html: function () {
      return '<div class="item-cols three">' +
        field('Shown as', 'text', { ph: 'e.g. @hamzashah' }) +
        field('Label', 'label', { ph: 'e.g. (ig)' }) +
        field('Link', 'href', { ph: 'e.g. https://www.instagram.com/hamzashah/', hint: 'A web address, or an email address on its own.' }) +
        '</div>';
    },
    fill: function (el, v) {
      set(el, 'text', v.text); set(el, 'label', v.label);
      set(el, 'href', String(v.href || '').replace(/^mailto:/, ''));
    },
    read: function (el) { return { text: val(el, 'text').trim(), label: val(el, 'label').trim(), href: val(el, 'href').trim() }; },
  });
  // An email address on its own becomes a mailto: link; a bare web address gets https://.
  function linkHref(h) {
    h = h.trim();
    if (!h) return '';
    if (/^[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/.test(h)) return 'mailto:' + h;
    if (/^(https?:|mailto:|tel:)/i.test(h)) return h;
    return 'https://' + h.replace(/^\/+/, '');
  }

  // ---- Press cards -------------------------------------------------------
  var press = list({
    box: document.getElementById('press'),
    add: document.getElementById('add-press'),
    name: 'Card',
    empty: 'No press cards yet.',
    zone: true,
    html: function () {
      return '<div class="info-cols">' +
        '<div class="fields">' +
          '<div class="drop"></div><div class="image-meta"></div>' +
          field('Headline', 'title', { rows: 3, ph: 'e.g. He paints with coffee and tea as a tribute to his Afghan mother', hint: 'A new line starts a new line on the card (on computers).' }) +
          '<div class="item-cols">' + field('Link text', 'linkText', { ph: 'e.g. Read full article' }) + field('Link', 'href', { ph: 'https://…' }) + '</div>' +
          field('Name of the newspaper or radio (for screen readers)', 'alt', { ph: 'e.g. 24 heures' }) +
        '</div>' +
        '<div class="panel"><div class="panel-head"><h3>On the site</h3><p>The card on the About page.</p></div>' +
          '<div class="press-card"><img alt="" hidden><div class="no-pic"></div><div class="panel-in"><span data-p="title"></span><a data-p="link"></a></div></div>' +
        '</div>' +
      '</div>';
    },
    fill: function (el, v) { ['title', 'linkText', 'href', 'alt'].forEach(function (k) { set(el, k, v[k]); }); },
    read: function (el) {
      var o = {};
      ['title', 'linkText', 'href', 'alt'].forEach(function (k) { o[k] = val(el, k).trim(); });
      return o;
    },
    onInput: function (it) {
      var el = it.el;
      var t = val(el, 'title').trim();
      el.querySelector('[data-p="title"]').innerHTML = t ? A.esc(t).replace(/\n/g, '<br>') : '<span class="empty">Headline</span>';
      el.querySelector('[data-p="link"]').textContent = val(el, 'linkText').trim() || 'Read full article';
      var c = it.zone && it.zone.value(), img = el.querySelector('.press-card img');
      img.hidden = !c; el.querySelector('.no-pic').hidden = !!c;
      if (c && c.preview) img.src = c.preview; else if (c) A.showImage(img, c.src);
    },
  });

  // ---- Previews ----------------------------------------------------------
  var $ = function (id) { return document.getElementById(id); };
  function lines(id) { return $(id).value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); }
  function preview() {
    var q = $('quote').value.trim();
    var bio = $('bio').value.trim().split(/\n\s*\n/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p style="margin:0 0 10px">' + A.esc(p.trim()).replace(/\n/g, '<br>') + '</p>'; }).join('');
    $('bio-preview').innerHTML =
      '<p style="font-size:24px;line-height:1.2;letter-spacing:-0.03em;margin:0 0 24px">' + (q ? A.esc(q).replace(/\n/g, '<br>') : '<span class="empty">Quote</span>') + '</p>' +
      '<span class="site-label">Biography</span>' + (bio || '<span class="empty">Biography</span>');
    function block(label, id) {
      var l = lines(id);
      return '<span class="site-label">' + label + '</span>' + (l.length ? l.map(function (x) { return '<div>' + A.esc(x) + '</div>'; }).join('') : '<span class="empty">Nothing yet</span>');
    }
    $('cv-preview').innerHTML = block('Studies', 'studies') + '<div style="height:20px"></div>' + block('Solo shows', 'soloShows');
  }
  document.addEventListener('input', preview);

  var pressImages = [];
  A.single({
    name: 'about page',
    path: 'content/about.json',
    view: '../about/',
    fields: ['quote', 'bio', 'alt', 'studies', 'soloShows'],
    load: function (d, $) {
      $('quote').value = d.quote || '';
      $('bio').value = d.bio || '';
      $('alt').value = (d.portrait && d.portrait.alt) || '';
      $('studies').value = (d.studies || []).join('\n');
      $('soloShows').value = (d.soloShows || []).join('\n');
      preview();
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
      alt: function ($) { return $('alt').value.trim(); },
    },
    extra: {
      init: function (data, $, change) {
        links.load(data.links, change);
        press.load(data.media, change);
        pressImages = (data.media || []).map(function (m) { return m.image; });
      },
      state: function () { return [links.state(), press.state()]; },
      store: function (next) {
        var changes = [];
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
          ['title', 'linkText', 'href', 'alt'].forEach(function (k) { v[k] = val(it.el, k).trim(); });
          v.href = linkHref(v.href);
          var cur = it.zone.value();
          if (it.zone.hasUpload()) {
            var path = 'images/press/' + A.slugify(v.alt || v.title || 'press').slice(0, 40) + '-' + A.rand(6) + '.' + cur.ext;
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
