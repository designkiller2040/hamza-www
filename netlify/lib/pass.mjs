// Sign-in pass for the admin: a small signed token that says "signed in until <date>".
// It is signed with a key made from ADMIN_PASSWORD and GITHUB_TOKEN, so it can't be
// faked, and changing the password makes every old pass invalid (everyone signs out).
import { createHmac, timingSafeEqual } from 'node:crypto';

export const REPO = 'designkiller2040/hamza-www';
export const PASS_DAYS = 30;

export function secrets() {
  const password = process.env.ADMIN_PASSWORD || '';
  const token = process.env.GITHUB_TOKEN || '';
  return { password, token, ready: Boolean(password && token) };
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function key() {
  const { password, token } = secrets();
  return createHmac('sha256', token).update('hamza-admin-pass:' + password).digest();
}

export function makePass() {
  const exp = Date.now() + PASS_DAYS * 24 * 60 * 60 * 1000;
  const body = b64url(JSON.stringify({ exp }));
  const sig = b64url(createHmac('sha256', key()).update(body).digest());
  return { pass: `${body}.${sig}`, exp };
}

export function checkPass(pass) {
  if (!pass || typeof pass !== 'string' || !pass.includes('.')) return false;
  const [body, sig] = pass.split('.');
  const want = createHmac('sha256', key()).update(body).digest();
  let got;
  try { got = Buffer.from(sig, 'base64url'); } catch { return false; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}

export function samePassword(given) {
  const a = createHmac('sha256', 'cmp').update(String(given || '')).digest();
  const b = createHmac('sha256', 'cmp').update(secrets().password).digest();
  return timingSafeEqual(a, b);
}

// Only accept requests made by the site's own pages.
export function fromOwnSite(req) {
  const site = req.headers.get('sec-fetch-site');
  if (site === 'same-origin') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const own = new URL(req.url).origin;
  const allowed = [own, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL]
    .filter(Boolean).map((u) => u.replace(/\/$/, ''));
  return allowed.includes(origin);
}

export const json = (status, data) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
