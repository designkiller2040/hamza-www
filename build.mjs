// Builds the site into dist/ from the template (src/index.html) and the
// content files (content/). GitHub Actions runs this on every push to main
// and publishes dist/ to GitHub Pages (.github/workflows/pages.yml).
// Plain Node, no packages: `node build.mjs`.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const OUT = join(ROOT, 'dist');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *word* becomes italic, everything else is plain text.
const inline = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');

function readFolder(dir) {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => ({ slug: f.replace(/\.json$/, ''), ...readJSON(join(dir, f)) }));
}

const home = readJSON('content/home.json');
const about = readJSON('content/about.json');
const contact = readJSON('content/contact.json');
const rows = readJSON('content/rows.json').heights || {};
const works = readFolder('content/works');
const exhibitions = readFolder('content/exhibitions').sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// ---- Works: composed rows ------------------------------------------------
// Each work sits in a row at a left position and width (percent of the row).
// A row's height is in units of a 915 px wide row, like the old Readymag page.
const CAPTION_SPACE = 90;
function rowHeight(row, items) {
  if (rows[row]) return rows[row];
  const tallest = Math.max(...items.map((w) => (w.layout.width / 100) * 915 / (w.layout.ratio || 1)));
  return Math.round(tallest + CAPTION_SPACE);
}
const num = (n, d = 2) => Number(n).toFixed(d);

function workFigure(w) {
  const t = w.year ? `${w.title}, ${w.year}` : w.title;
  const lines = [`<span class="title">${esc(t)}</span>`];
  if (w.materials) lines.push(esc(w.materials));
  if (w.size) lines.push(esc(w.size));
  const img = w.image && w.image.src
    ? `<img src="${esc(w.image.src)}" alt="${esc(w.image.alt || t)}" width="${w.image.width}" height="${w.image.height}" loading="lazy" style="aspect-ratio:${num(w.layout.ratio, 3)}">`
    : `<div class="placeholder" style="aspect-ratio:${num(w.layout.ratio, 3)}"></div>`;
  const mail = `mailto:${esc(contact.inquiryEmail || '')}?subject=Inquiry%20${encodeURIComponent(w.slug)}`;
  return `        <figure id="work-${esc(w.slug)}" style="left:${num(w.layout.left)}%;width:${num(w.layout.width)}%">
          ${img}
          <figcaption>${lines.join('<br>')}</figcaption>
          <a class="inquire" href="${mail}">Inquire to Purchase</a>
        </figure>`;
}

const byRow = new Map();
for (const w of works) {
  if (w.hidden) continue;
  const r = Number(w.layout?.row) || 1;
  if (!byRow.has(r)) byRow.set(r, []);
  byRow.get(r).push(w);
}
const worksHTML = [...byRow.keys()].sort((a, b) => a - b).map((r) => {
  const items = byRow.get(r).sort((a, b) => a.layout.left - b.layout.left);
  return `      <div class="row" style="aspect-ratio:915/${rowHeight(r, items)}">
${items.map(workFigure).join('\n')}
      </div>`;
}).join('\n');

// ---- Home #2 works ------------------------------------------------------
// Placed exactly as in alona's design (content/home2.json, 1512 px wide page).
// Every number is in design pixels; the CSS turns them into --u units.
const home2 = existsSync(join(ROOT, 'content/home2.json')) ? readJSON('content/home2.json') : { rows: [] };
const worksBySlug = new Map(works.map((w) => [w.slug, w]));
function home2Figure(p) {
  const w = worksBySlug.get(p.slug);
  if (!w || w.hidden) return '';
  const ratio = w.image && w.image.width ? w.image.width / w.image.height : (w.layout?.ratio || 1);
  const img = w.image && w.image.src
    ? `<img src="${esc(w.image.src)}" alt="${esc(w.image.alt || w.title)}" width="${w.image.width}" height="${w.image.height}" loading="lazy">`
    : `<div class="placeholder" style="aspect-ratio:${num(ratio, 3)}"></div>`;
  const mail = `mailto:${esc(contact.inquiryEmail || '')}?subject=Inquiry%20${encodeURIComponent(w.slug)}`;
  const inquire = `<a class="w2-inquire" href="${mail}">Inquire to Purchase</a>`;
  let caption;
  if (p.caption === 'below') {
    const lines = [esc(w.year ? `${w.title}, ${w.year}` : w.title)];
    if (w.materials) lines.push(esc(w.materials));
    if (w.size) lines.push(esc(w.size));
    caption = `<figcaption class="w2-cap-below"><span class="w2-text">${lines.join('<br>')}</span>${inquire}</figcaption>`;
  } else {
    const first = esc(`"${w.title}"`) + (w.year ? ' ' + esc(w.year) : '');
    const second = esc([w.materials, w.size].filter(Boolean).join('. '));
    caption = `<figcaption class="w2-cap-hover">${inquire}<span class="w2-text">${first}${second ? '<br>' + second : ''}</span></figcaption>`;
  }
  return `        <figure class="w2" id="work-${esc(w.slug)}" style="--x:${p.x};--y:${p.y};--w:${p.w}">
          ${img}
          ${caption}
        </figure>`;
}
const home2WorksHTML = home2.rows.map((r) => `      <div class="w2-row" style="--h:${r.height}">
${r.works.map(home2Figure).filter(Boolean).join('\n')}
      </div>`).join('\n');

// ---- Exhibitions ---------------------------------------------------------
const exhibitionsHTML = exhibitions.map((e) => {
  const img = e.image && e.image.src
    ? `<img src="${esc(e.image.src)}" alt="${esc(e.image.alt || e.title)}" width="${e.image.width}" height="${e.image.height}" loading="lazy">`
    : `<div class="placeholder wide"></div>`;
  const lines = [e.line2, e.line3].filter(Boolean).map(esc).join('<br>');
  const caption = `<span class="title">${esc(e.title)}</span>${lines ? '<br>\n            ' + lines : ''}`;
  // "link" (optional) points to the exhibition's own page, e.g. "abimal/".
  const open = e.link ? `<a class="exhibition-link" href="${esc(e.link)}">` : '';
  const close = e.link ? '</a>' : '';
  return `        <figure id="exhibition-${esc(e.slug)}">
          ${open}${img}
          <figcaption>
            ${caption}
          </figcaption>${close}
        </figure>`;
}).join('\n');

// ---- Hero slideshow ------------------------------------------------------
// The first slide is home.hero itself (edited in the admin); home.hero.moreSlides
// follow in order. On scroll, each photo crossfades into the next.
const slides = [home.hero, ...(home.hero.moreSlides || [])].filter((s) => s && s.image && s.image.src);
const heroImagesHTML = slides.map((s, i) =>
  `      <img src="${esc(s.image.src)}" alt="${esc(s.image.alt || '')}" width="${s.image.width}" height="${s.image.height}"${i ? ' aria-hidden="true"' : ''}>`
).join('\n');
// Home #2: the captions sit left and right of the photo, one per slide.
const heroSideHTML = (side) => slides.map((s, i) =>
  `        <span data-slide="${i}"${i ? ' aria-hidden="true"' : ''}>${inline(side === 'left' ? s.captionLeft : s.captionRight)}</span>`
).join('\n');
// Home #2: the exhibitions one under the other, captions left and right.
const exhibitionRowsHTML = slides.map((s) => `    <figure class="h2-hero">
      <figcaption class="h2-cap h2-cap-left">${inline(s.captionLeft)}</figcaption>
      <img src="${esc(s.image.src)}" alt="${esc(s.image.alt || '')}" width="${s.image.width}" height="${s.image.height}">
      <figcaption class="h2-cap h2-cap-right">${inline(s.captionRight)}</figcaption>
    </figure>`).join('\n');
const heroCaptionsHTML = slides.map((s, i) =>
  `      <figcaption data-slide="${i}"${i ? ' aria-hidden="true"' : ''}><span>${inline(s.captionLeft)}</span><span>${inline(s.captionRight)}</span></figcaption>`
).join('\n');

// ---- Fill the template ---------------------------------------------------
const bio = String(about.bio || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .map((p) => `          <p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');

// About page (/about/): lists and links from content/about.json.
const aboutList = (items) => (items || []).map((t) => `          <p>${esc(t)}</p>`).join('\n');
const aboutLinks = (about.links || []).map((l) =>
  `          <a href="${esc(l.href || '#')}"${/^https?:/.test(l.href || '') ? ' target="_blank" rel="noopener"' : ''}><span>${esc(l.text)}</span><span>${esc(l.label)}</span></a>`
).join('\n');
const aboutMedia = Array.from({ length: Number(about.mediaCount) || 0 }, () =>
  '        <div class="ab-media-item placeholder" aria-hidden="true"></div>').join('\n');

const vars = {
  pageTitle: home.pageTitle,
  description: home.description,
  name: contact.name,
  email: contact.email,
  'hero.count': slides.length,
  'hero.images': heroImagesHTML,
  'hero.captions': heroCaptionsHTML,
  'portrait.src': about.portrait.src,
  'portrait.alt': about.portrait.alt,
  'portrait.width': about.portrait.width,
  'portrait.height': about.portrait.height,
  'about.caption': String(about.caption || '').split('\n').map(esc).join(' <br>'),
  'about.quote': about.quote,
  'about.bio': bio,
  'about.soloShowsLabel': about.soloShowsLabel || 'Solo shows',
  'about.soloShows': aboutList(about.soloShows),
  'about.studiesLabel': about.studiesLabel || 'Studies',
  'about.studies': aboutList(about.studies),
  'about.links': aboutLinks,
  'about.mediaLabel': about.mediaLabel || 'Media',
  'about.media': aboutMedia,
  works: worksHTML,
  'home2.works': home2WorksHTML,
  'home2.exhibitions': exhibitionRowsHTML,
  'hero.left': heroSideHTML('left'),
  'hero.right': heroSideHTML('right'),
  exhibitions: exhibitionsHTML,
  footer: home.footer,
};

// Shared parts ({{> header}}, {{> footer}}) come from src/partials/.
// {{root}} is the way back to the site root: "" on the home page,
// "../" on pages that live in their own folder (like /abimal/).
function render(file, root) {
  let html = read(file).replace(/^<!-- Template:.*-->\n/m, '');
  html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}\n?/g, (m, name) => read(`src/partials/${name}.html`));
  const all = { ...vars, root };
  return html.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (m, raw, plain) => {
    const key = raw || plain;
    if (!(key in all)) throw new Error(`Unknown template field {{${key}}} in ${file}`);
    return raw ? String(all[key] ?? '') : esc(all[key]);
  });
}

// Every other src/*.html becomes its own page: src/abimal.html -> /abimal/
const pages = readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.html') && f !== 'index.html');

// ---- Write dist/ ---------------------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), render('src/index.html', ''));
for (const f of pages) {
  const dir = join(OUT, f.replace(/\.html$/, ''));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), render(join('src', f), '../'));
}
// Saved homepage versions (snapshots/home-1/ -> /home-1/) are frozen copies,
// copied as they are without filling in any content.
if (existsSync(join(ROOT, 'snapshots'))) cpSync(join(ROOT, 'snapshots'), OUT, { recursive: true });
for (const p of ['style.css', 'images', 'admin']) {
  if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(OUT, p), { recursive: true });
}
mkdirSync(join(OUT, 'admin'), { recursive: true });
writeFileSync(join(OUT, 'admin', 'version.json'), JSON.stringify({
  commit: process.env.COMMIT_REF || process.env.GITHUB_SHA || null,
  builtAt: new Date().toISOString(),
}) + '\n');

console.log(`Built dist/: ${works.length} works in ${byRow.size} rows, ${exhibitions.length} exhibitions, ${pages.length} extra page(s).`);
