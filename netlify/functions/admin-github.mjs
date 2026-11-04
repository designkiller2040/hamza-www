// /api/admin/github/<GitHub API path>
// Swaps the admin's sign-in pass for the real GitHub key (kept secret in Netlify)
// and forwards the request to GitHub. Only this site's repo can be reached.
import { REPO, secrets, checkPass, fromOwnSite, json } from '../lib/pass.mjs';

const PREFIX = '/api/admin/github';

export default async (req) => {
  if (!fromOwnSite(req)) return json(403, { error: 'Not allowed from this address.' });
  if (!secrets().ready) return json(503, { error: 'Password sign-in isn’t set up yet.' });
  const auth = req.headers.get('authorization') || '';
  if (!checkPass(auth.replace(/^Bearer\s+/i, ''))) {
    return json(401, { error: 'Your sign-in has run out. Please sign in again.' });
  }
  const url = new URL(req.url);
  const path = url.pathname.slice(PREFIX.length) || '/';
  if (!path.startsWith(`/repos/${REPO}/`) && path !== `/repos/${REPO}`) {
    return json(403, { error: 'Only this site’s repository can be reached.' });
  }
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return json(405, { error: 'Method not allowed.' });
  }
  const headers = {
    authorization: `Bearer ${secrets().token}`,
    accept: req.headers.get('accept') || 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'hamza-www-admin',
  };
  const init = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) {
    headers['content-type'] = 'application/json';
    init.body = await req.text();
  }
  const res = await fetch(`https://api.github.com${path}${url.search}`, init);
  if (res.status === 401) {
    // The admin's pass was fine; it's the GitHub key in Netlify that GitHub refused.
    return json(502, { error: 'GitHub refused the key saved in Netlify (GITHUB_TOKEN). It may have expired.' });
  }
  const out = new Headers({ 'cache-control': 'no-store' });
  const ct = res.headers.get('content-type');
  if (ct) out.set('content-type', ct);
  return new Response(res.body, { status: res.status, headers: out });
};

export const config = { path: '/api/admin/github/*' };
