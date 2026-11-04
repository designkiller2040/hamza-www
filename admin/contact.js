A.single({
  name: 'contact details',
  path: 'content/contact.json',
  view: '/',
  fields: ['name', 'email', 'inquiryEmail'],
  load: function (d, $) {
    $('name').value = d.name || '';
    $('email').value = d.email || '';
    $('inquiryEmail').value = d.inquiryEmail || '';
  },
  store: function (d, $) {
    d.name = $('name').value.trim();
    d.email = $('email').value.trim();
    d.inquiryEmail = $('inquiryEmail').value.trim();
  },
  validate: function () {
    var bad = ['email', 'inquiryEmail'].filter(function (k) {
      var v = document.getElementById(k).value.trim();
      return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    });
    return bad.length ? 'Please check the email address.' : '';
  },
});
