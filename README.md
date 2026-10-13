# Greenplate — offline-first nutrition PWA

A no-build, dependency-free Progressive Web App starter for tracking meals on iPhone. The UI, food library, calculations, and storage work locally; no account or backend is required.

## Features in this first version

- Installable PWA shell with manifest and service worker.
- Offline-first app caching (after the first successful online load).
- IndexedDB storage for foods, diary entries, and goals.
- Starter searchable food library with typical nutrition values per 100 g.
- Add custom foods using nutrition per 100 g.
- Add meals, choose serving amounts in grams, and calculate calories/protein/carbs/fat.
- Edit serving amount and meal, or delete diary entries.
- Browse dates, daily goals, and recent logged-day history.
- Export/import a JSON backup.
- Dark green, mobile-first layout with iPhone safe-area padding.

## Run locally

Service workers require HTTPS or localhost; opening `index.html` directly as a `file://` URL will not enable offline caching.

### Easiest local preview

If you have Python 3 installed:

```bash
cd greenplate-pwa
python3 -m http.server 8000
```

Open `http://localhost:8000` on that computer to preview. To test on an iPhone, deploy to an HTTPS host or use a local HTTPS development setup.

## Deploy free to GitHub Pages

1. Create a GitHub repository, for example `greenplate`.
2. Upload all files in this folder to the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Wait for GitHub Pages to publish the site. Your URL will resemble `https://YOUR-USERNAME.github.io/greenplate/`.
5. Open that HTTPS URL on your iPhone in Safari.
6. Visit the page while online and wait a few seconds for the service worker to install and cache the app shell.
7. Tap **Share → Add to Home Screen**. If shown, enable **Open as Web App**, then tap **Add**.
8. Launch Greenplate from the new Home Screen icon. For a real offline test, turn on Airplane Mode and reopen it after the initial load.

Alternative static hosts such as Netlify or Cloudflare Pages work too; publish the folder as-is.

## iPhone notes

- A PWA can be installed from Safari and launched in its own app-like window.
- The first visit needs a connection so Safari can download the app and service worker. Offline use begins after the shell has been cached.
- All nutrition data is stored in IndexedDB for this site on this device. Browser/site data clearing, storage eviction, removing the installed web app, or changing devices can risk losing data. Use **Settings & data → Export backup** regularly.
- Import merges foods and meal entries by ID into the current local database; it also applies the imported daily goals.
- The built-in library is a starter dataset of typical values, not a comprehensive verified nutrition database. Treat values as estimates and use custom foods for package labels.
- Offline food search only searches the foods already bundled or saved on the device. A live external database, barcode lookup, cloud sync, Apple Health, and AI photo estimation are not included in this starter.
- Service workers and PWA installation require HTTPS except on `localhost`.

## Files

- `index.html` — app structure and dialogs
- `styles.css` — responsive dark-green styling
- `app.js` — IndexedDB, food library, nutrition calculations, CRUD, goals, history, backup
- `service-worker.js` — app-shell caching and offline navigation fallback
- `manifest.webmanifest` — PWA metadata
- `icon.svg`, `apple-touch-icon.png` — app icons

## Development / next steps

For a production release, consider adding schema migrations, stronger import validation and a confirmation preview, tests, an accessible serving unit selector, a larger licensed nutrition database, automated backups, and a clear privacy policy. PWA data is local to the browser origin; this is not a replacement for a native App Store app.
