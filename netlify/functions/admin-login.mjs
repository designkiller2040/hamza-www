// POST /api/admin/login  { password }  ->  { pass, exp }
import { secrets, makePass, samePassword, fromOwnSite, json } from '../lib/pass.mjs';

export default async (req) => {
  if (!fromOwnSite(req)) return json(403, { error: 'Not allowed from this address.' });
  if (req.method === 'GET') return json(200, { ready: secrets().ready });
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!secrets().ready) {
    return json(503, { error: 'Password sign-in isn’t set up yet. Use a GitHub token instead.' });
  }
  let body = {};
  try { body = await req.json(); } catch {}
  if (!samePassword(body.password)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json(401, { error: 'That password isn’t right.' });
  }
  return json(200, makePass());
};

export const config = { path: '/api/admin/login' };
