A.single({
  name: 'contact details',
  path: 'content/contact.json',
  view: '../',
  fields: ['name', 'inquiryEmail'],
  load: function (d, $) {
    $('name').value = d.name || '';
    $('inquiryEmail').value = d.inquiryEmail || '';
  },
  store: function (d, $) {
    d.name = $('name').value.trim();
    d.inquiryEmail = $('inquiryEmail').value.trim();
  },
  validate: function () {
    var bad = ['inquiryEmail'].filter(function (k) {
      var v = document.getElementById(k).value.trim();
      return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    });
    return bad.length ? 'Please check the email address.' : '';
  },
});
