# Cutline Studio — update notes

## What changed

- **Transcription fixed and rebuilt for Roman Urdu.** The browser pulls the voice track
  out of the video (no more ffmpeg download), splits long files at quiet moments, and
  uploads compact Ogg/Opus chunks (~2 MB per 8 minutes — well under Vercel's 4.5 MB limit).
  The server tries xAI Grok STT → Groq Whisper → OpenAI Whisper, then an AI pass writes
  every word in Roman Urdu (`/api/romanize`). If no text model answers, an offline
  Urdu/Hindi → Roman converter (`src/lib/captions/roman.ts`) is used.
- **Server crash fixed.** The embedded database (PGLite) crashed the whole server when its
  data file was missing, which also broke `/api/transcribe`. It now logs and keeps running.
- **MP4 export** (`src/lib/captions/export-video.ts`): WebCodecs H.264 + AAC, faster than
  real time. Original size / 1080p / 720p buttons, frame-rate and quality options.
  Captions, colour grade and timeline cuts are burned in. Real-time recording fallback
  for browsers without WebCodecs.
- **Pro timeline:** captions / video (filmstrip) / audio (waveform) tracks, ruler, zoom
  (Ctrl + wheel, + / −), snapping, drag / trim / Alt-drag ripple, split (S), delete
  segments, restore cuts, audio extract (M4A / WAV), resizable height.
- **Caption engine** (`src/lib/captions/render.ts`): one canvas painter for preview,
  thumbnails and export. 47 templates (28 PRO), 18 motion presets, key-moments mode.
- **PRO + login:** PRO templates/motions show a crown and unlock with a free creator
  account during launch. Sign-ups are POSTed to `/api/signup`.
- **New gradient / 3D website** with features, motion picker, languages, two caption
  modes, templates, pricing (launch-free), FAQ.

## Environment variables

| Variable | Needed? | Purpose |
|---|---|---|
| `XAI_API_KEY` | Injected by the Grok platform | Grok Voice transcription + Roman Urdu AI pass |
| `GROQ_API_KEY` | Optional backup (free tier) | Whisper large-v3 transcription + romanizer |
| `OPENAI_API_KEY` | Optional backup | Whisper + romanizer |
| `TRANSCRIBE_PROVIDERS` | Optional | Order, e.g. `groq,xai` |
| `LEADS_WEBHOOK_URL` | Optional | Every creator sign-up is forwarded here (Google Apps Script, Zapier, Make, n8n…) |

## Quick edits

- Launch end date: `LAUNCH_FREE_UNTIL` / `LAUNCH_FREE_LABEL` in `src/lib/account.ts`.
- Logo: replace `public/logo.svg` (and `public/favicon.svg`).
- Which templates are PRO: `pro: true` in `src/lib/captions/templates.ts`.
- Which motions are PRO: `pro: true` in `ANIMATIONS` in `src/lib/captions/render.ts`.

## Browser notes

MP4 export is fastest in Chrome / Edge (Windows, macOS, Android). Safari 16.4+ and
Firefox 130+ also have WebCodecs. Older browsers fall back to real-time recording.
