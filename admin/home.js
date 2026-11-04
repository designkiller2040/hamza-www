A.single({
  name: 'home page',
  path: 'content/home.json',
  view: '/',
  fields: ['captionLeft', 'captionRight', 'heroAlt', 'pageTitle', 'description', 'footer'],
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
