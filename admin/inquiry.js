/* Works tab: the email the "Inquire to Purchase" links use (content/contact.json),
   saved with its own button. */
(function () {
  var PATH = 'content/contact.json';
  var input = document.getElementById('inquiryEmail');
  var btn = document.getElementById('save-inquiry');
  var data = null;
  function dirty() { return data && input.value.trim() !== (data.inquiryEmail || ''); }
  function update() { btn.disabled = !dirty(); }
  A.readJSON(PATH).then(function (d) {
    data = d || {};
    input.value = data.inquiryEmail || '';
    update();
  }).catch(function (e) { A.toast('Couldn’t load the inquiry email: ' + e.message, true); });
  input.addEventListener('input', update);
  btn.addEventListener('click', function () {
    var v = input.value.trim();
    if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { A.toast('Please check the email address.', true); return; }
    var next = JSON.parse(JSON.stringify(data));
    next.inquiryEmail = v;
    btn.disabled = true; btn.textContent = 'Saving…';
    A.commit('Update inquiry email', [{ path: PATH, text: A.json(next) }]).then(function () {
      data = next;
      A.toast('Saved. The site updates in about a minute.');
    }).catch(function (e) { A.toast('Couldn’t save: ' + e.message, true); })
      .then(function () { btn.textContent = 'Save email'; update(); });
  });
  window.addEventListener('beforeunload', function (e) { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });
})();
