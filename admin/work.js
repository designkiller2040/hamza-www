/* Editor for one work. */
A.start(function () {
  var slugParam = A.param('slug');
  var isNew = !slugParam || A.param('new') === '1';
  var works = [], me = null, ed = null, zone = null, slugTouched = false;
  var $ = function (id) { return document.getElementById(id); };
  var F = ['title', 'year', 'materials', 'size', 'alt', 'note', 'row', 'slug'];

  function rowOf(w) { return Number(w.data.layout && w.data.layout.row) || 1; }
  function rowNumbers() {
    var s = {};
    works.forEach(function (w) { if (!me || w.slug !== me.slug) s[rowOf(w)] = 1; });
    if (me && !isNew) s[rowOf(me)] = 1;
    return Object.keys(s).map(Number).sort(function (a, b) { return a - b; });
  }
  function fillRows() {
    var nums = rowNumbers();
    $('row').innerHTML = nums.map(function (r, i) {
      var names = works.filter(function (w) { return rowOf(w) === r && (!me || w.slug !== me.slug); })
        .sort(function (a, b) { return a.data.layout.left - b.data.layout.left; })
        .map(function (w) { return w.data.title; });
      var label = 'Row ' + (i + 1) + (names.length ? ': ' + names.join(', ') : '');
      if (label.length > 70) label = label.slice(0, 68) + '…';
      return '<option value="' + r + '">' + A.esc(label) + '</option>';
    }).join('') + '<option value="new">A new row at the bottom</option>';
  }

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
    $('slug-lock').querySelector('span').textContent = 'Page address: ' + location.host + '../#work-' + slug;
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
    var data = old ? JSON.parse(JSON.stringify(old)) : { layout: {} };
    ['title', 'year', 'materials', 'size', 'note'].forEach(function (k) { data[k] = $(k).value.trim(); });
    var alt = $('alt').value.trim();
    var img = A.imageChanges(zone, old && old.image, 'works', slug, alt);
    data.image = img.image;
    var changes = img.changes.slice();
    var forget = [];

    var oldRow = old ? rowOf(me) : null;
    var pick = $('row').value;
    var others = works.filter(function (w) { return w.slug !== slug; });
    var maxRow = Math.max.apply(null, [0].concat(works.map(rowOf)));
    var newRow = pick === 'new' ? maxRow + 1 : Number(pick);
    if (pick === 'new' && old && oldRow === maxRow && others.every(function (w) { return rowOf(w) !== oldRow; })) newRow = oldRow;

    var copies = {};
    function copy(w) { return copies[w.slug] || (copies[w.slug] = { path: w.path, data: JSON.parse(JSON.stringify(w.data)) }); }

    if (!old || newRow !== oldRow) {
      // Joining a row: lay the row out again with this work at the end.
      data.layout = data.layout || {};
      data.layout.row = newRow;
      var rowItems = others.filter(function (w) { return rowOf(w) === newRow; })
        .sort(function (a, b) { return a.data.layout.left - b.data.layout.left; }).map(function (w) { return copy(w).data; });
      A.autoLayout(rowItems.concat([data]));
      forget.push(newRow);
      if (old) {
        var left = others.filter(function (w) { return rowOf(w) === oldRow; })
          .sort(function (a, b) { return a.data.layout.left - b.data.layout.left; }).map(function (w) { return copy(w).data; });
        A.autoLayout(left);
        forget.push(oldRow);
      }
    } else if (zone.hasUpload() && A.workRatio(data) !== data.layout.ratio) {
      // New picture with a different shape: same width, new height.
      data.layout.ratio = A.workRatio(data);
      forget.push(newRow);
    }

    changes.push({ path: path, text: A.json(data) });
    Object.keys(copies).forEach(function (s) {
      var c = copies[s];
      var orig = works.filter(function (w) { return w.slug === s; })[0];
      if (JSON.stringify(c.data) !== JSON.stringify(orig.data)) changes.push({ path: c.path, text: A.json(c.data) });
    });
    if (forget.length) changes.push(A.forgetRowHeights(forget));

    var msg = (isNew ? 'Add work: ' : 'Update work: ') + data.title;
    return A.commit(msg, changes).then(function () {
      // Keep our copy of everything in step with what was saved.
      Object.keys(copies).forEach(function (s) { works.filter(function (w) { return w.slug === s; })[0].data = copies[s].data; });
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
      $('row').value = String(rowOf(me));
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
    var row = rowOf(me);
    var rest = works.filter(function (w) { return w.slug !== me.slug && rowOf(w) === row; })
      .sort(function (a, b) { return a.data.layout.left - b.data.layout.left; });
    if (rest.length) {
      var ds = rest.map(function (w) { return JSON.parse(JSON.stringify(w.data)); });
      A.autoLayout(ds);
      rest.forEach(function (w, i) { changes.push({ path: w.path, text: A.json(ds[i]) }); });
    }
    changes.push(A.forgetRowHeights([row]));
    A.commit('Delete work: ' + (me.data.title || me.slug), changes).then(function () {
      ed.leave('works.html');
    }).catch(function (e) {
      btn.disabled = false;
      btn.lastChild.textContent = 'Delete work';
      A.toast('Couldn’t delete: ' + e.message, true);
    });
  }

  return A.readFolder('content/works').then(function (all) {
    works = all;
    if (!isNew) {
      me = works.filter(function (w) { return w.slug === slugParam; })[0];
      if (!me) throw new Error('There’s no work called “' + slugParam + '”. It may have been deleted.');
    }
    var d = me ? me.data : {};
    zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: d.image, onChange: function () { ed.update(); } });
    ['title', 'year', 'materials', 'size', 'note'].forEach(function (k) { $(k).value = d[k] || ''; });
    $('alt').value = (d.image && d.image.alt) || '';
    fillRows();
    $('row').value = me ? String(rowOf(me)) : 'new';
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
