/* Loaded first by every admin page.
   Keeps the sign-in, and sends every GitHub request the right way:
   - password sign-in: through the site's helper (/api/admin/github/...), which
     swaps the sign-in pass for the real GitHub key kept secret in Netlify;
   - token sign-in: straight to api.github.com with the pasted token.
   Pages only call GH.request() / GH.json() and don't need to know which. */
(function () {
  var REPO = 'designkiller2040/hamza-www';
  var BRANCH = 'main';
  var KEY = 'hamzaAdminAuth';

  // Loading screen: full page on the first visit, content area only when switching tabs.
  try {
    if (sessionStorage.getItem('hamzaAdminSeen')) document.documentElement.classList.add('is-nav');
    sessionStorage.setItem('hamzaAdminSeen', '1');
  } catch (e) {}

  function readAuth() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!a || !a.secret || !a.mode) return null;
      if (a.exp && a.exp < Date.now()) { localStorage.removeItem(KEY); return null; }
      return a;
    } catch (e) { return null; }
  }

  var isLogin = /\/login(\.html)?$/.test(location.pathname);
  var here = location.pathname.replace(/^.*\/admin\//, '') + location.search;

  function toLogin(reason) {
    var q = '?next=' + encodeURIComponent(here || 'works.html') + (reason ? '&reason=' + reason : '');
    location.replace(new URL('login.html' + q, location.href.replace(/[^/]*$/, '')).href);
  }

  var auth = readAuth();
  if (!auth && !isLogin) {
    toLogin();
    // Stop the page from flashing while we leave.
    document.documentElement.style.visibility = 'hidden';
  }

  function request(path, opts) {
    opts = opts || {};
    var a = readAuth();
    if (!a) { toLogin('expired'); return Promise.reject(new Error('Signed out')); }
    var headers = { accept: opts.accept || 'application/vnd.github+json' };
    var url;
    if (a.mode === 'token') {
      url = 'https://api.github.com' + path;
      headers.authorization = 'Bearer ' + a.secret;
      headers['x-github-api-version'] = '2022-11-28';
    } else {
      url = '/api/admin/github' + path;
      headers.authorization = 'Bearer ' + a.secret;
    }
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store' };
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function (res) {
      if (res.status === 401) {
        try { localStorage.removeItem(KEY); } catch (e) {}
        toLogin('expired');
        throw new Error('Your sign-in has run out.');
      }
      return res;
    });
  }

  function json(path, opts) {
    return request(path, opts).then(function (res) {
      if (res.status === 204) return null;
      return res.text().then(function (t) {
        var data = null;
        try { data = t ? JSON.parse(t) : null; } catch (e) { data = { message: t }; }
        if (!res.ok) {
          var err = new Error((data && (data.error || data.message)) || ('GitHub said ' + res.status));
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function signIn(mode, secret, exp) {
    localStorage.setItem(KEY, JSON.stringify({ mode: mode, secret: secret, exp: exp || null }));
  }

  function signOut() {
    try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch (e) {}
    location.href = new URL('login.html?next=' + encodeURIComponent(here), location.href.replace(/[^/]*$/, '')).href;
  }

  window.GH = {
    REPO: REPO,
    BRANCH: BRANCH,
    repoPath: '/repos/' + REPO,
    auth: auth,
    readAuth: readAuth,
    request: request,
    json: json,
    signIn: signIn,
    signOut: signOut,
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-logout]');
    if (a) { e.preventDefault(); signOut(); }
  });
})();
