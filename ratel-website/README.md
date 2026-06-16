# Ratel — landing page

Marketing site for **Ratel**, the operator seat for coding agents: hand it a
spec, get back a build, behind gates that hold while you step away.

This is a single-page, dependency-free static site. No build step, no
framework — just HTML, CSS, and a little vanilla JavaScript. The physics hero
and scroll animations are powered by [Matter.js](https://brm.io/matter-js/) and
[GSAP](https://gsap.com/), loaded from a CDN.

## Structure

```
.
├── index.html            # markup
├── assets/
│   ├── css/styles.css     # all styles
│   └── js/main.js         # nav, copy button, physics hero, scroll reveals
├── vercel.json            # Vercel static deploy config
└── .nojekyll              # let GitHub Pages serve assets/ untouched
```

## Run it locally

It's a static file — open `index.html` directly in a browser, or serve the
folder with any static server:

```bash
npm start          # uses npx serve (no install needed)
# or
python3 -m http.server 8080
```

Then visit the printed URL.

## Deploy

- **GitHub Pages** — push to a repo, then enable Pages on the branch root.
  `.nojekyll` is included so the `assets/` folder is served as-is.
- **Vercel / Netlify** — point it at the repo; no build command, output is the
  root directory. `vercel.json` is included.

## Before you publish

A couple of placeholders in the page still point at example values — wire them
up to the real thing:

- `assets/js/main.js` — `REPO = "your-org/ratel"` drives the live GitHub star
  count. Set it to the real `owner/repo`.
- `index.html` — the install command (`curl … ratel.dev/install.sh`) and the
  "Star on GitHub" / docs links (`href="#"`) are placeholders.

## License

Apache License 2.0 — see [LICENSE](./LICENSE). This matches the license of the
Ratel project the site is for.
