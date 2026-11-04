A.single({
  name: 'about',
  path: 'content/about.json',
  view: '/#about',
  fields: ['caption', 'quote', 'bio', 'alt'],
  load: function (d, $) {
    $('caption').value = d.caption || '';
    $('quote').value = d.quote || '';
    $('bio').value = d.bio || '';
    $('alt').value = (d.portrait && d.portrait.alt) || '';
  },
  store: function (d, $) {
    d.caption = $('caption').value.trim();
    d.quote = $('quote').value.trim();
    d.bio = $('bio').value.trim();
  },
  image: {
    base: 'portrait',
    get: function (d) { return d.portrait; },
    set: function (d, img) { d.portrait = img; },
    alt: function ($) { return $('alt').value.trim(); },
  },
});
