# CEO English Lab v2.1

An independent, responsive, copyright-aware English study website for Windows, macOS and iPad browsers. Published at:

**https://kobe24xu-ctrl.github.io/shangan-practice/ceo-english-lab/**

This is a static website. No paid API, separate login, backend, scraping service or local installation is required.

## Video studies

- 10 editorial ~10-minute windows from official *The Diary of a CEO* YouTube videos, classified as science, medicine, psychology, business and technology.
- The official YouTube iframe is the only source of hosted interview video/audio. Player controls support segment seeking, playback speed and sentence looping (after importing timecoded captions).
- Deep-link URLs `#practice/<episode-id>` open a specific lesson, including after reload. Fallback opens the official video at the chosen chapter timestamp when embedding is blocked.
- True audio-only listening is possible with a **user-owned authorized** local audio clip. This is **not** a YouTube audio extraction feature.

## Interactive exercises

- **Blind listening:** Hide the site's transcript. The YouTube player's own CC must be switched off separately if displayed.
- **Intensive listening:** Import authorized subtitles and jump/loop by timed sentence. The learner can correct text in the browser.
- **Dictation:** Match typed text against the imported sentence, with missing and extra words, score and history. This is text matching, **not** a pronunciation or IELTS band score.
- **Shadowing:** Browser microphone recording with in-browser replay. Recordings remain in local IndexedDB on this device; they are not uploaded.
- **Original warm-up:** 40 original high-quality academic/spoken English sentences, four per topic; Chinese hints and expression analysis. Uses the browser/device's speech synthesis to pronounce the **original study sentences**, then grades typing and permits shadowing. These are not direct quotations or transcripts of any linked video.

## Vocabulary and analytics

- 60 bilingual IELTS/TOEFL topical terms, two original language patterns per lesson, personal words, bookmarks and browser speech pronunciation.
- Daily spaced-repetition flashcards: `again` ~10 min, `hard` ~8 h, `good` from one day, `easy` from four days. Review histories and due dates save locally.
- Export bookmarked vocabulary in Quizlet-compatible TSV (tab-separated English and Chinese).
- Saves time, per-second clip listening completion, dictation histories and reviews in browser localStorage.
- JSON export/import migrates vocabulary, transcripts, listening history and spaced-review data between devices. **Cloud account sync is not implemented.** Microphone recordings are not included in JSON backups.

## Licensed materials and accuracy

- Accepts user-supplied authorized SRT, VTT, timed TSV, JSON, or TXT. A preview confirms matched cue count and timestamps before import. Supports full-video absolute or clip-relative timestamps. Untimed TXT is split into sentences with *estimated* timing only.
- Supports deleting an imported transcript and exporting the user's currently imported clip as relative-time SRT.
- No third-party copyrighted transcripts, audio or video are bundled. No YouTube captions are downloaded or copied. The user's imported media is never sent to this site's server.
- Editorial vocab and analysis are **topic-oriented original examples**, not claims of exact words said by interviewees. Site is independent and not affiliated with the channel.

## Install and offline

A PWA manifest and scoped service worker enable adding the site to the home screen on supported browsers. Static app pages/modules can be cached for offline access after first successful online visit, including the original warm-up and saved study data. **YouTube videos/thumbnails still require an internet connection.** Browser/device speech voices may need local voice packs. Offline audio isn't downloaded or persisted by this site.

## Development and tests

From the `ceo-english-lab` directory:

```sh
python3 -m http.server 8080
# Visit http://localhost:8080
node --test tests/core.test.mjs
python tests/browser_smoke.py
```

The browser test intentionally loads a self-contained copy in memory and stubs the official player, because the test runner blocks both external and local navigation. A passing test is **not** confirmation of live YouTube embedding or real iPad microphone permission. These require real-device testing after deployment.