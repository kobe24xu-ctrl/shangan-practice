# CEO English Lab deployment

Hosted as an isolated subdirectory of an existing GitHub Pages repository:

- Code: https://github.com/kobe24xu-ctrl/shangan-practice/tree/main/ceo-english-lab
- Public URL: https://kobe24xu-ctrl.github.io/shangan-practice/ceo-english-lab/
- GitHub Pages Actions build and deployment: https://github.com/kobe24xu-ctrl/shangan-practice/actions

A normal static host can deploy the directory without a build command. Keep all relative paths unchanged (`index.html`, JS modules, CSS, manifest, service worker and `/assets/`). GitHub Pages caches old files briefly; both CSS and application JS have a query-string release version in `index.html`. Increment the service-worker cache version in `sw.js` when changing files. Once installed, it caches only same-origin application shell files, never YouTube media or user data.

HTTPS is required for the microphone on non-localhost browsers. Uploading user-authorized audio/transcripts is browser-local and needs no server credentials. Cross-device cloud sync is not provided; users manually transfer backups. Network restrictions, YouTube embed policy, Safari microphone permission and available on-device speech voices need validation in their actual browsers.