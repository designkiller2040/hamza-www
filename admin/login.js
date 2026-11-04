/* Sign-in screen: password (through the site's helper) or a pasted GitHub token. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var mode = 'password';
  var params = new URLSearchParams(location.search);
  var next = params.get('next') || 'works.html';
  if (!/^[\w./?=&%-]*$/.test(next) || /^\/|\/\/|:/.test(next)) next = 'works.html';

  // Already signed in: go straight on.
  if (GH.readAuth()) { location.replace(next); return; }

  if (params.get('reason') === 'expired') $('sub').textContent = 'Your sign-in ran out. Please sign in again.';

  function setMode(m) {
    mode = m;
    $('pw-wrap').hidden = m !== 'password';
    $('tk-wrap').hidden = m !== 'token';
    $('switch').textContent = m === 'password' ? 'Use a GitHub token instead' : 'Use the password instead';
    $('err').textContent = '';
    (m === 'password' ? $('password') : $('token')).focus();
  }
  $('switch').addEventListener('click', function (e) { e.preventDefault(); setMode(mode === 'password' ? 'token' : 'password'); });

  // If the password helper isn't set up yet, start with the token.
  fetch('/api/admin/login', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.ready) {
        setMode('token');
        $('sub').textContent = 'Password sign-in isn’t set up yet. Paste a GitHub token to sign in.';
      }
    }).catch(function () {});

  function busy(on) { $('go').disabled = on; $('go').textContent = on ? 'Signing in…' : 'Sign in'; }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('err').textContent = '';
    if (mode === 'password') {
      var pw = $('password').value;
      if (!pw) { $('err').textContent = 'Please enter the password.'; return; }
      busy(true);
      fetch('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
        .then(function (res) {
          if (!res.ok) throw new Error(res.d.error || (res.status === 404 ? 'Password sign-in isn’t set up yet. Use a GitHub token instead.' : 'Couldn’t sign in.'));
          GH.signIn('pass', res.d.pass, res.d.exp);
          location.replace(next);
        })
        .catch(function (err) { busy(false); $('err').textContent = err.message; });
    } else {
      var tk = $('token').value.trim();
      if (!tk) { $('err').textContent = 'Please paste a GitHub token.'; return; }
      busy(true);
      fetch('https://api.github.com/repos/' + GH.REPO, { headers: { authorization: 'Bearer ' + tk, accept: 'application/vnd.github+json' }, cache: 'no-store' })
        .then(function (r) {
          if (r.status === 401) throw new Error('GitHub doesn’t recognise that token. Check it was copied in full.');
          if (r.status === 404) throw new Error('That token can’t see ' + GH.REPO + '. Give it access to this repository.');
          if (!r.ok) throw new Error('GitHub said ' + r.status + '. Please try again.');
          return r.json();
        })
        .then(function (repo) {
          if (repo.permissions && repo.permissions.push === false) {
            throw new Error('That token can only read. Set Contents to “Read and write”.');
          }
          // Keep a token sign-in for 30 days, like the password.
          GH.signIn('token', tk, Date.now() + 30 * 24 * 60 * 60 * 1000);
          location.replace(next);
        })
        .catch(function (err) { busy(false); $('err').textContent = err.message === 'Failed to fetch' ? 'Couldn’t reach GitHub. Check the connection.' : err.message; });
    }
  });

  setMode('password');
})();
