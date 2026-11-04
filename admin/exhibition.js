/* Editor for one exhibition. */
A.start(function () {
  var slugParam = A.param('slug');
  var isNew = !slugParam || A.param('new') === '1';
  var items = [], me = null, ed = null, zone = null, slugTouched = false;
  var $ = function (id) { return document.getElementById(id); };
  var F = ['title', 'line2', 'line3', 'alt', 'note', 'slug'];

  function state() {
    var s = {};
    F.forEach(function (k) { s[k] = $(k).value; });
    s.image = zone ? zone.signature() : '';
    return s;
  }
  function preview() {
    var t = $('title').value.trim();
    var lines = [t ? A.esc(t) : '<span class="empty">Title</span>'];
    ['line2', 'line3'].forEach(function (k) { if ($(k).value.trim()) lines.push(A.esc($(k).value.trim())); });
    $('preview').innerHTML = lines.join('<br>');
    $('item-name').textContent = t || (isNew ? 'New exhibition' : 'Untitled');
    document.title = (t || 'Exhibition') + ' · Hamza Shah admin';
  }
  function noteBanner(note) {
    $('note-banner').hidden = !note;
    $('note-banner').querySelector('span').textContent = note ? 'Note: ' + note : '';
  }
  function lockSlug(slug) {
    $('slug-wrap').hidden = true;
    $('slug-lock').hidden = false;
    $('slug-lock').querySelector('span').textContent = 'Page address: ' + location.host + '/#exhibition-' + slug;
    $('view').href = '/#exhibition-' + slug;
    $('view').removeAttribute('aria-disabled');
  }
  function autoSlug() {
    if (!isNew || slugTouched) return;
    $('slug').value = $('title').value.trim() ? A.slugify($('title').value) : '';
  }
  function validate() {
    if (!$('title').value.trim()) return 'Please add a title.';
    if (isNew) {
      var s = A.slugify($('slug').value);
      if (items.some(function (x) { return x.slug === s; })) return 'Another exhibition already uses the page address “' + s + '”. Please change it.';
    }
    return '';
  }
  function save() {
    var slug = isNew ? A.slugify($('slug').value || $('title').value) : me.slug;
    var path = 'content/exhibitions/' + slug + '.json';
    var old = me ? me.data : null;
    var data = old ? JSON.parse(JSON.stringify(old)) : {};
    ['title', 'line2', 'line3', 'note'].forEach(function (k) { data[k] = $(k).value.trim(); });
    if (!old) data.order = Math.max.apply(null, [0].concat(items.map(function (x) { return x.data.order || 0; }))) + 1;
    var img = A.imageChanges(zone, old && old.image, 'exhibitions', slug, $('alt').value.trim());
    data.image = img.image;
    var changes = img.changes.concat([{ path: path, text: A.json(data) }]);
    return A.commit((isNew ? 'Add exhibition: ' : 'Update exhibition: ') + data.title, changes).then(function () {
      if (isNew) {
        me = { slug: slug, path: path, data: data };
        items.push(me);
        isNew = false;
        history.replaceState(null, '', 'exhibition.html?slug=' + encodeURIComponent(slug));
        lockSlug(slug);
        $('delete').hidden = false;
      } else me.data = data;
      zone.saved(data.image);
      noteBanner(data.note);
    });
  }
  function del() {
    if (!me) return;
    if (!confirm('Delete “' + (me.data.title || me.slug) + '”? It will disappear from the website. This can’t be undone here.')) return;
    var btn = $('delete');
    btn.disabled = true; btn.lastChild.textContent = 'Deleting…';
    var changes = [{ path: me.path, remove: true }];
    if (me.data.image && me.data.image.src) changes.push({ path: me.data.image.src, remove: true });
    A.commit('Delete exhibition: ' + (me.data.title || me.slug), changes).then(function () { ed.leave('exhibitions.html'); })
      .catch(function (e) { btn.disabled = false; btn.lastChild.textContent = 'Delete exhibition'; A.toast('Couldn’t delete: ' + e.message, true); });
  }

  return A.readFolder('content/exhibitions').then(function (all) {
    items = all;
    if (!isNew) {
      me = items.filter(function (x) { return x.slug === slugParam; })[0];
      if (!me) throw new Error('There’s no exhibition called “' + slugParam + '”. It may have been deleted.');
    }
    var d = me ? me.data : {};
    zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: d.image, onChange: function () { ed.update(); } });
    ['title', 'line2', 'line3', 'note'].forEach(function (k) { $(k).value = d[k] || ''; });
    $('alt').value = (d.image && d.image.alt) || '';
    if (me) { $('slug').value = me.slug; lockSlug(me.slug); }
    else { $('delete').hidden = true; $('view').setAttribute('aria-disabled', 'true'); }
    noteBanner(d.note);
    preview();
    $('slug').addEventListener('input', function () { slugTouched = true; });
    $('title').addEventListener('input', autoSlug);
    document.addEventListener('input', preview);
    $('delete').addEventListener('click', del);
    ed = A.editor({ state: state, save: save, validate: validate });
    ed.start();
  });
});
