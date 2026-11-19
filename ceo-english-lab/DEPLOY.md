# Deployment

This is a static frontend; deploy the directory unchanged to any HTTPS static host (GitHub Pages, Cloudflare Pages, Netlify, Vercel static hosting).

- Entry: `index.html`
- No build command
- Output directory: project root
- HTTPS: required for microphone recording on non-localhost browsers

GitHub Pages: publish this folder as site root on a repository's Pages source branch, or enable GitHub Actions Pages deployment with `actions/upload-pages-artifact` and `actions/deploy-pages`. Pages must be configured for the repository by an authorized account owner. An accessible repository/source link alone does **not** mean Pages hosting is enabled.

Data is stored in the user's browser, not a central cloud database. Exports are manual. No copyrighted video/audio/transcript binaries are hosted.