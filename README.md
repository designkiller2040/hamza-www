# Hamza Shah www

Website for Hamza Shah, plus a small admin at `/admin/` to edit it.

## How it fits together

- `content/` holds every piece of text and the list of images: one file per work
  (`content/works/<slug>.json`), one per exhibition (`content/exhibitions/<slug>.json`),
  and `home.json`, `about.json`, `contact.json`. `rows.json` keeps the heights of the
  composed works rows.
- `src/index.html` is the page template, `style.css` its styling, `images/` the pictures.
- `build.mjs` (plain Node, no packages) fills the template from `content/` and writes the
  finished site to `dist/`, plus `dist/admin/version.json` with the commit it was built from.
  Netlify runs it on every push to `main` (see `netlify.toml`). Run `node build.mjs` to try it locally.
- `admin/` is the admin: plain HTML, CSS and JavaScript. Every Save is one commit to `main`
  through the GitHub API, which rebuilds the live site.
- `netlify/functions/` is the sign-in helper for password sign-in. It needs two environment
  variables in Netlify: `ADMIN_PASSWORD` and `GITHUB_TOKEN` (a fine-grained token for this
  repository only, Contents: read and write). Without them, sign in with a GitHub token instead.
