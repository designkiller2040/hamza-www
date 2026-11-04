/* Shared by the one-form pages (Home, About, Contact). */
A.single = function (opts) {
  A.start(function () {
    var $ = function (id) { return document.getElementById(id); };
    var data = null, zone = null, ed = null;
    function state() {
      var s = {};
      opts.fields.forEach(function (k) { s[k] = $(k).value; });
      s.image = zone ? zone.signature() : '';
      return s;
    }
    if (opts.view) $('view').href = opts.view;
    return A.readJSON(opts.path).then(function (d) {
      data = d || {};
      opts.load(data, $);
      if (opts.image) {
        zone = A.dropZone({ el: $('drop'), metaEl: $('drop-meta'), value: opts.image.get(data), onChange: function () { ed.update(); } });
      }
      ed = A.editor({
        state: state,
        validate: opts.validate,
        save: function () {
          var next = JSON.parse(JSON.stringify(data));
          opts.store(next, $);
          var changes = [];
          if (zone) {
            var r = A.imageChanges(zone, opts.image.get(data), 'site', opts.image.base, opts.image.alt($));
            opts.image.set(next, r.image);
            changes = r.changes;
          }
          changes.push({ path: opts.path, text: A.json(next) });
          return A.commit('Update ' + opts.name, changes).then(function () {
            data = next;
            if (zone) zone.saved(opts.image.get(data));
          });
        },
      });
      ed.start();
    });
  });
};
