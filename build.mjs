// Builds the site into dist/ from the template (src/index.html) and the
// content files (content/). GitHub Actions runs this on every push to main
// and publishes dist/ to GitHub Pages (.github/workflows/pages.yml).
// Plain Node, no packages: `node build.mjs`.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = new URL('.', import.meta.url).pathname;
const OUT = join(ROOT, 'dist');
// The live address of the site (custom domain on GitHub Pages).
const SITE = 'https://hamzashah.ch/';
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
  const mail = `mailto:${esc(contact.inquiryEmail || '')}?subject=${encodeURIComponent(`Inquiry: ${w.year ? `${w.title}, ${w.year}` : w.title}`)}`;
  return `        <figure id="work-${esc(w.slug)}" style="left:${num(w.layout.left)}%;width:${num(w.layout.width)}%">
          ${img}
          <figcaption>${lines.join('<br>')}</figcaption>
          <a class="inquire" href="${mail}">Inquire to Purchase</a>
        </figure>`;
}

const byRow = new Map();
for (const w of works) {
  if (w.hidden || !w.layout) continue; // works added on Home #2 only have no old-grid layout
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
// Smaller copies made by tools/resize-artworks.py (images/artworks/900/, /1400/).
// The browser picks the smallest one that is still sharp; the original is the largest.
function artworkSrcset(img) {
  const m = /^(images\/artworks\/)([^/]+)$/.exec(img.src || '');
  if (!m) return '';
  const set = [900, 1400].filter((s) => s < img.width && existsSync(join(ROOT, m[1], String(s), m[2])))
    .map((s) => `${m[1]}${s}/${m[2]} ${s}w`);
  return set.length ? set.concat(`${img.src} ${img.width}w`).join(', ') : '';
}
// Tiny blurred previews (images/artworks/blur.json, also made by the tool above):
// shown at once under each painting, which fades in over it once it has loaded.
const blurFile = join(ROOT, 'images/artworks/blur.json');
const blurs = existsSync(blurFile) ? JSON.parse(readFileSync(blurFile, 'utf8')) : {};
function blurPreview(img, map = blurs) {
  return blurStyle(map[(img.src || '').split('/').pop()]);
}
// b = {w, h, jpg (base64)}: a tiny JPEG, drawn blurred as a CSS background.
function blurStyle(b) {
  if (!b || !b.jpg) return '';
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${b.w} ${b.h}' preserveAspectRatio='none'>`
    + `<filter id='b' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='1.2'/>`
    + `<feComponentTransfer><feFuncA type='discrete' tableValues='1 1'/></feComponentTransfer></filter>`
    + `<image filter='url(%23b)' width='${b.w}' height='${b.h}' preserveAspectRatio='none' href='data:image/jpeg;base64,${b.jpg}'/></svg>`;
  return `background-image:url(&quot;data:image/svg+xml;charset=utf-8,${svg}&quot;)`;
}
function home2Figure(p, first) {
  const w = worksBySlug.get(p.slug);
  if (!w || w.hidden) return '';
  const ratio = w.image && w.image.width ? w.image.width / w.image.height : (w.layout?.ratio || 1);
  // The first row loads straight away and first in line; the rest load as you scroll.
  const srcset = w.image && w.image.src ? artworkSrcset(w.image) : '';
  const sizes = `(min-width: 992px) ${num(p.w / 15.12)}vw, (min-width: 576px) 50vw, 100vw`;
  const load = first ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  const img = w.image && w.image.src
    ? `<span class="w2-pic${blurPreview(w.image) ? ' wait' : ''}" style="${blurPreview(w.image)}"><img src="${esc(w.image.src)}"${srcset ? ` srcset="${esc(srcset)}" sizes="${sizes}"` : ''} alt="${esc(w.image.alt || w.title)}" width="${w.image.width}" height="${w.image.height}" ${load}></span>`
    : `<div class="placeholder" style="aspect-ratio:${num(ratio, 3)}"></div>`;
  const mail = `mailto:${esc(contact.inquiryEmail || '')}?subject=${encodeURIComponent(`Inquiry: ${w.year ? `${w.title}, ${w.year}` : w.title}`)}`;
  const inquire = `<a class="w2-inquire" href="${mail}">Inquire to Purchase</a>`;
  let caption;
  if (p.caption === 'below' || p.caption === 'above') {
    const lines = [esc(w.year ? `${w.title}, ${w.year}` : w.title)];
    if (w.materials) lines.push(esc(w.materials));
    if (w.size) lines.push(esc(w.size));
    caption = `<figcaption class="w2-cap-${p.caption}"><span class="w2-text">${lines.join('<br>')}</span>${inquire}</figcaption>`;
  } else {
    const first = esc(`"${w.title}"`) + (w.year ? ' ' + esc(w.year) : '');
    const second = esc([w.materials, w.size].filter(Boolean).join('. '));
    caption = `<figcaption class="w2-cap-hover">${inquire}<span class="w2-text">${first}${second ? '<br>' + second : ''}</span></figcaption>`;
  }
  // "h" crops the photo to the height drawn in the canvas; "above" puts the caption over the photo.
  const size = `--x:${p.x};--y:${p.y};--w:${p.w}` + (p.h ? `;--ih:${p.h}` : '') + (p.lift ? `;--lift:${p.lift}` : '');
  const inner = p.caption === 'above' ? `${caption}
          ${img}` : `${img}
          ${caption}`;
  return `        <figure class="w2${p.h ? ' w2-fixed' : ''}${p.caption === 'below' ? ' w2-below' : ''}${p.lift ? ' w2-lift' : ''}" id="work-${esc(w.slug)}" style="${size}">
          ${inner}
        </figure>`;
}
const home2WorksHTML = home2.rows.map((r, ri) => `      <div class="w2-row${r.align === 'top' ? ' w2-row-top' : ''}" style="--h:${r.height}">
${r.works.map((p) => home2Figure(p, ri === 0)).filter(Boolean).join('\n')}
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
// Extra slides marked "hidden" (admin: "Show on the homepage" unticked) are kept but not shown.
const slides = [home.hero, ...(home.hero.moreSlides || []).filter((s) => s && !s.hidden)].filter((s) => s && s.image && s.image.src);
const heroImagesHTML = slides.map((s, i) =>
  // Blurred preview (image.blur, made by the admin on upload) shows until the photo has loaded.
  `      <img src="${esc(s.image.src)}" alt="${esc(s.image.alt || '')}" width="${s.image.width}" height="${s.image.height}"${i ? ' aria-hidden="true"' : ''}${s.image.blur ? ` style="${blurStyle(s.image.blur)};background-size:cover;background-position:center"` : ''}>`
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
// Media cards (alona 2026-11-14): press image on top, grey panel with the
// headline (bottom-aligned, own line breaks with \n) and a link below.
// Four columns on desktop, so a 4th card fits the row.
// Press images get the same tiny blurred preview (images/media/blur.json).
const mediaBlurFile = join(ROOT, 'images/media/blur.json');
const mediaBlurs = existsSync(mediaBlurFile) ? JSON.parse(readFileSync(mediaBlurFile, 'utf8')) : {};
const aboutMedia = (about.media || []).map((m) => {
  const pre = blurPreview({ src: m.image }, mediaBlurs);
  const ext = /^https?:/.test(m.href || '') ? ' target="_blank" rel="noopener"' : '';
  return `        <article class="abt-card"${m.bg ? ` style="--bg:${esc(m.bg)}" data-bg="fixed"` : ''}>
          <span class="abt-card-pic${pre ? ' wait' : ''}" style="${pre}"><img src="../${esc(m.image)}" alt="${esc(m.alt)}" loading="lazy"></span>
          <div class="abt-card-panel">
            <p class="abt-card-title">${esc(m.title).replace(/\n/g, '<br class="abt-card-br"> ')}</p>
            <a class="abt-card-link" href="${esc(m.href || '#')}"${ext}>${esc(m.linkText)}</a>
          </div>
        </article>`;
}).join('\n');

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
  // Line breaks typed in the quote (alona's About design, 2026-11-13) show on desktop
  'about.quoteLines': String(about.quote || '').split('\n').map((l) => esc(l.trim())).join('<br class="abt-br"> '),
  'about.bio': bio,
  // The /about/ page keeps its own photo (the dark portrait); the homepage uses about.portrait.
  'aboutPage.src': (about.pagePortrait || about.portrait).src,
  'aboutPage.alt': (about.pagePortrait || about.portrait).alt,
  'aboutPage.width': (about.pagePortrait || about.portrait).width,
  'aboutPage.height': (about.pagePortrait || about.portrait).height,
  'about.soloShowsLabel': about.soloShowsLabel || 'Solo shows',
  'about.soloShows': aboutList(about.soloShows),
  'about.studiesLabel': about.studiesLabel || 'Studies',
  'about.studies': aboutList(about.studies),
  'about.links': aboutLinks,
  'about.contactsLabel': about.contactsLabel || 'Contacts',
  'about.mediaLabel': about.mediaLabel || 'Media',
  'about.media': aboutMedia,
  works: worksHTML,
  'home2.works': home2WorksHTML,
  // The /works/ page lives one folder down, so its image paths start with ../
  'home2.worksPage': home2WorksHTML.replace(/src="(?!https?:|\/|data:)/g, 'src="../')
    .replace(/srcset="([^"]*)"/g, (_, v) => `srcset="${v.replace(/(^|, )images\//g, '$1../images/')}"`),
  'home2.exhibitions': exhibitionRowsHTML,
  'hero.left': heroSideHTML('left'),
  'hero.right': heroSideHTML('right'),
  exhibitions: exhibitionsHTML,
  footer: home.footer,
};

// Shared parts ({{> header}}, {{> footer}}) come from src/partials/.
// {{root}} is the way back to the site root: "" on the home page,
// "../" on pages that live in their own folder (like /abimal/).
// style.css gets ?v=<content hash>, so a browser never pairs a new page with
// an old cached stylesheet (GitHub Pages lets browsers cache it for 10 minutes).
const cssVersion = createHash('sha1').update(read('style.css')).digest('hex').slice(0, 8);
// Marks <html class="intro"> on the first open of each page per browser session;
// style.css then plays the slide-in. Back/forward and reloads skip it.
const introScript = "try{var k='intro:'+location.pathname,s=sessionStorage;if(!s.getItem(k)){s.setItem(k,'1');var d=document.documentElement;d.classList.add('intro');setTimeout(function(){d.classList.remove('intro')},2000)}}catch(e){}";
// Which top-menu item is underlined on each page; exhibition pages count as Exhibitions.
const navFor = { index: 'home', works: 'works', exhibited: 'exhibited', abimal: 'exhibited',
  coldrush: 'exhibited', 'regards-croises': 'exhibited', venerate: 'exhibited', about: 'about' };
function render(file, root) {
  let html = read(file).replace(/^<!-- Template:.*-->\n/m, '');
  html = html.replace(/(href="(?:\{\{root\}\})?style\.css)"/g, `$1?v=${cssVersion}"`);
  // Gentle slide-in, only the first time a page is opened in a visit (alona, 2026-11-14).
  html = html.replace('</head>', `  <script>${introScript}</script>\n</head>`);
  html = html.replace(/\{\{>\s*([\w-]+)\s*\}\}\n?/g, (m, name) => read(`src/partials/${name}.html`));
  // Look closer has no menu, so there the copyright line also leads home
  // (it replaced the old "Back" link, alona 2026-11-14).
  if (basename(file, '.html') === 'lens') html = html
    .replace('<p class="h2-signature">@2027 Hamza Shah Mian. All rights reserved.</p>', `<p class="h2-signature"><a href="${root}">@2027 Hamza Shah Mian. All rights reserved.</a></p>`)
    .replace('<a class="h2-look" href=', '<a class="h2-look" aria-current="page" href=');
  // Underline the menu item of the page you're on (alona, 2026-11-14).
  const navKey = navFor[basename(file, '.html')];
  if (navKey) html = html.replace(`data-nav="${navKey}"`, `data-nav="${navKey}" aria-current="page"`);
  // Address and share tags for the live domain (hamzashah.ch since 2026-11-16).
  const slug = basename(file, '.html');
  const url = SITE + (slug === 'index' ? '' : slug + '/');
  const shareImage = SITE + String(slides[0] ? slides[0].image.src : '').replace(/^\.?\//, '');
  html = html.replace(/(<meta name="description" content="[^"]*">)/, (m) => {
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || '{{name}}';
    const desc = m.match(/content="([^"]*)"/)[1];
    return `${m}
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{{name}}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${shareImage}">
  <meta name="twitter:card" content="summary_large_image">`;
  });
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
for (const p of ['style.css', 'fonts', 'images', 'admin']) {
  if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(OUT, p), { recursive: true });
}
// Search engines: a sitemap of the public pages (not legal, not the frozen
// old versions) and a robots.txt that points to it and keeps the admin and the frozen old versions out.
const sitemapPages = ['', ...pages.map((f) => f.replace(/\.html$/, '') + '/').filter((p) => p !== 'legal/')];
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapPages.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /admin/\nSitemap: ${SITE}sitemap.xml\n`);
mkdirSync(join(OUT, 'admin'), { recursive: true });
writeFileSync(join(OUT, 'admin', 'version.json'), JSON.stringify({
  commit: process.env.COMMIT_REF || process.env.GITHUB_SHA || null,
  builtAt: new Date().toISOString(),
}) + '\n');

console.log(`Built dist/: ${works.length} works in ${byRow.size} rows, ${exhibitions.length} exhibitions, ${pages.length} extra page(s).`);
