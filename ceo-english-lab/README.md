# CEO English Lab

An independent, responsive, copyright-aware English study website built for Windows / macOS / iPad browsers. No build tool, backend, paid API, account, or server-side scraping required.

## What works

- Ten editorial 10-minute clips in Science, Medicine, Psychology, Business and Technology from *The Diary of a CEO*. Original videos are embedded using YouTube's official player. Each clip is linked to the official video and its corresponding chapter window.
- Blind listening hides the site's transcript. YouTube's own captions must be disabled within the YouTube player if needed.
- Import **authorized** SRT, VTT, timed TSV, JSON, or TXT transcripts. Timestamped cues align with the official clip and support individual playback, looping and edits. Untimed TXT uses *estimated* timings.
- Dictation with word-alignment matching, missing/extra word breakdown and a history of scores.
- Shadowing with microphone recording, in-browser playback and IndexedDB persistence (requires HTTPS and permissions). No cloud recording upload.
- IELTS/TOEFL topical vocabulary, original example phrases, bookmarking and personal vocabulary.
- Listening completion, study time, history and transcript persistence in localStorage. Manual JSON backup/restore allows data to be moved between browsers; recordings are excluded and stay in IndexedDB on their originating device.
- Optional, user-supplied licensed audio clip for true audio-only playback. This is not a YouTube audio downloader.

## Copyright and accuracy

This is an independent learning tool, neither affiliated with nor sponsored by *The Diary of a CEO*. Video titles and chapter anchors identify public original video pages. Videos are not copied, proxied, repackaged or extracted. No copyrighted transcripts are bundled. The vocabulary and sample expressions are original topical learning aids; **they are not represented as direct quotations from a video**. You are responsible for permission to use imported transcript/audio. The medical content is for language practice, not medical advice. Media and captions remain in your browser.

## Run locally for development

```sh
python3 -m http.server 8080
# open http://localhost:8080/
node --test tests/core.test.mjs
```

For microphone recording, the deployed site must use HTTPS or localhost. YouTube embeds may be blocked by local network and require an accessible internet connection. Native iPad Safari playback requires a user gesture. This app itself has no auto-sync server. Read `DEPLOY.md` for publishing options.