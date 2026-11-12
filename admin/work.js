/* Editor for one work. */
A.start(function () {
  var slugParam = A.param('slug');
  var isNew = !slugParam || A.param('new') === '1';
  var works = [], home2 = { rows: [] }, me = null, ed = null, zone = null, slugTouched = false;
  var $ = function (id) { return document.getElementById(id); };
  var F = ['title', 'year', 'materials', 'size', 'alt', 'note', 'row', 'slug'];

  // Rows are the homepage rows in content/home2.json.
  function title(slug) { var w = works.filter(function (x) { return x.slug === slug; })[0]; return w ? w.data.title : slug; }
  function currentRow() { return me ? A.H2.rowOf(home2, me.slug) : -1; }
  function fillRows() {
    $('row').innerHTML = home2.rows.map(function (r, i) {
      var names = r.works.filter(function (p) { return !me || p.slug !== me.slug; }).map(function (p) { return title(p.slug); });
      var label = 'Row ' + (i + 1) + (names.length ? ': ' + names.join(', ') : '');
      if (label.length > 70) label = label.slice(0, 68) + '…';
      return '<option value="' + i + '">' + A.esc(label) + '</option>';
    }).join('') + '<option value="new">A new row at the bottom</option><option value="none">Not on the homepage</option>';
  }
  function rowValue() { var r = currentRow(); return r < 0 ? (me ? 'none' : 'new') : String(r); }

  function state() {
    var s = {};
    F.forEach(function (k) { s[k] = $(k).value; });
    s.image = zone ? zone.signature() : '';
    return s;
  }

  function preview() {
    var t = $('title').value.trim(), y = $('year').value.trim();
    var lines = [];
    lines.push(t ? A.esc(y ? t + ', ' + y : t) : '<span class="empty">Title</span>');
    if ($('materials').value.trim()) lines.push(A.esc($('materials').value.trim()));
    if ($('size').value.trim()) lines.push(A.esc($('size').value.trim()));
    $('preview').innerHTML = lines.join('<br>') + '<br><span class="muted">Inquire to Purchase</span>';
    $('item-name').textContent = t || (isNew ? 'New work' : 'Untitled');
    document.title = (t || 'Work') + ' · Hamza Shah admin';
  }

  function noteBanner(note) {
    $('note-banner').hidden = !note;
    $('note-banner').querySelector('span').textContent = note ? 'Note: ' + note : '';
  }

  function lockSlug(slug) {
    $('slug-wrap').hidden = true;
    $('slug-lock').hidden = false;
    $('slug-lock').querySelector('span').textContent = 'Page address: ' + new URL('../#work-' + slug, location.href).href.replace(/^https?:\/\//, '');
    $('view').href = '../#work-' + slug;
    $('view').removeAttribute('aria-disabled');
  }

  function autoSlug() {
    if (!isNew || slugTouched) return;
    var t = $('title').value.trim(), y = $('year').value.trim();
    $('slug').value = t ? A.slugify(t + (y ? ' ' + y : '')) : '';
  }

  function validate() {
    if (!$('title').value.trim()) return 'Please add a title.';
    if (isNew) {
      var s = A.slugify($('slug').value);
      if (works.some(function (w) { return w.slug === s; })) return 'Another work already uses the page address “' + s + '”. Please change it.';
    }
    return '';
  }

  function save() {
    var slug = isNew ? A.slugify($('slug').value || $('title').value) : me.slug;
    var path = 'content/works/' + slug + '.json';
    var old = me ? me.data : null;
    var data = old ? JSON.parse(JSON.stringify(old)) : {};
    ['title', 'year', 'materials', 'size', 'note'].forEach(function (k) { data[k] = $(k).value.trim(); });
    var alt = $('alt').value.trim();
    var img = A.imageChanges(zone, old && old.image, 'works', slug, alt);
    data.image = img.image;
    var changes = img.changes.slice();
    changes.push({ path: path, text: A.json(data) });

    // Homepage placement (content/home2.json).
    var was = currentRow();
    var pick = $('row').value;
    var size = A.H2.size(data);
    var moved = isNew || pick !== rowValue();
    var reshaped = !moved && zone.hasUpload() && was >= 0;
    function place(h2) {
      if (moved) {
        var target = pick === 'new' || pick === 'none' ? null : h2.rows[Number(pick)];
        A.H2.remove(h2, slug);
        if (pick === 'new') {
          h2.rows.push(A.H2.place({ height: 0, works: [{ slug: slug, x: A.H2.LEFT, y: 0, w: size.w, h: size.h, caption: 'below' }] }));
        } else if (target && h2.rows.indexOf(target) >= 0) {
          target.works.push({ slug: slug, x: 0, y: 0, w: size.w, h: size.h, caption: 'below' });
          A.H2.place(target);
        }
      } else if (reshaped) {
        // New picture with a different shape: keep its width, adjust its height.
        h2.rows.forEach(function (r) {
          r.works.forEach(function (p) {
            if (p.slug === slug && p.h && data.image) {
              p.h = Math.round(p.w * data.image.height / data.image.width);
              A.H2.place(r);
            }
          });
        });
      }
    }
    if (moved || reshaped) changes.push(A.H2.update(place));

    var msg = (isNew ? 'Add work: ' : 'Update work: ') + data.title;
    return A.commit(msg, changes).then(function () {
      if (moved || reshaped) place(home2);
      if (isNew) {
        me = { slug: slug, path: path, data: data };
        works.push(me);
        isNew = false;
        history.replaceState(null, '', 'work.html?slug=' + encodeURIComponent(slug));
        lockSlug(slug);
        $('delete').hidden = false;
      } else {
        me.data = data;
      }
      zone.saved(data.image);
      noteBanner(data.note);
      fillRows();
      $('row').value = rowValue();
    });
  }

  function del() {
    if (!me) return;
    if (!confirm('Delete “' + (me.data.title || me.slug) + '”? It will disappear from the website. This can’t be undone here.')) return;
    var btn = $('delete');
    btn.disabled = true;
    btn.lastChild.textContent = 'Deleting…';
    var changes = [{ path: me.path, remove: true }];
    if (me.data.image && me.data.image.src) changes.push({ path: me.data.image.src, remove: true });
    var slug = me.slug;
    changes.push(A.H2.update(function (h2) { A.H2.remove(h2, slug); }));
    A.commit('Delete work: ' + (me.data.title || me.slug), changes).then(function () {
      ed.leave('works.html');
    }).catch(function (e) {
      btn.disabled = false;
      btn.lastChild.textContent = 'Delete work';
      A.toast('Couldn’t delete: ' + e.message, true);
    });
  }

  return Promise.all([A.readFolder('content/works'), A.readJSON(A.H2.PATH)]).then(function (res) {
    works = res[0];
    home2 = res[1] || { rows: [] };
    home2.rows = home2.rows || [];
    if (!isNew) {
      me = works.filter(function (w) { return w.slug === slugParam; })[0];
      if (!me) throw new Error('There’s no work called “' + slugParam + '”. It may have been deleted.');
    }
    var d = me ? me.data : {};
    zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: d.image, onChange: function () { ed.update(); } });
    ['title', 'year', 'materials', 'size', 'note'].forEach(function (k) { $(k).value = d[k] || ''; });
    $('alt').value = (d.image && d.image.alt) || '';
    fillRows();
    $('row').value = rowValue();
    if (me) { $('slug').value = me.slug; lockSlug(me.slug); }
    else { $('delete').hidden = true; $('view').setAttribute('aria-disabled', 'true'); }
    noteBanner(d.note);
    preview();

    $('slug').addEventListener('input', function () { slugTouched = true; });
    ['title', 'year'].forEach(function (k) { $(k).addEventListener('input', autoSlug); });
    document.addEventListener('input', preview);
    $('delete').addEventListener('click', del);

    ed = A.editor({ state: state, save: save, validate: validate, afterSave: preview });
    ed.start();
  });
});
