# Chinese Trainer App

## Goal
Personal iPhone Chinese vocabulary learning app. Building it as a plain
web app first (no build step, no framework) to validate the training
flow before ever considering a native Swift/SwiftUI port. First (and so
far only) training mode: **Vocabulary Trainer**, which drills a word
list in random order.

## Cross-machine setup
Private GitHub remote (`nighthawk99/chinese-trainer`) is the shared
source of truth — a separate repo from `nighthawk99/wsj-market-briefing`
on purpose, kept unmixed. No dev/prod split needed (unlike the WSJ
project): this is a static site with no server-side secrets or state,
so any machine's checkout behaves identically.

**On a new machine (e.g. the Mac Mini):**
```
git clone https://github.com/nighthawk99/chinese-trainer.git
cd chinese-trainer
python3 -m http.server 8420
```
Then open `http://localhost:8420`. That's the whole setup — no venv, no
env vars, no install step.

**Claude Code / preview-tool gotcha:** this repo has its own
`.claude/launch.json` (config name `chinese-trainer`) which works fine
if a Claude Code session is rooted directly in this directory. But this
project was actually built from a session rooted in the *wsj-cro-briefing*
repo instead (the user was already in that session and just pointed me
at a different directory) — and the Browser-pane preview tool resolves
`.claude/launch.json` relative to the **session's root**, not relative
to wherever the target files live. So a matching `chinese-trainer` entry
also had to be added to `wsj-cro-briefing/.claude/launch.json`, using
`--directory /Users/michaeldemuth/Projects/chinese-trainer` in the
`http.server` args so it serves the right files regardless of cwd. If
you're working from a session rooted in some other repo again, remember
to check that repo's `.claude/launch.json` rather than assuming this
one's will be picked up.

## Architecture
No backend, no build step — just static files opened via a plain HTTP
server (needed for `fetch()` of the JSON data files; `file://` won't
work).
- `index.html` / `style.css` / `app.js` — single-page app, three
  screens (home, settings, trainer) toggled via a CSS `.active` class.
- `data/*.json` — one file per vocabulary source, shape:
  ```json
  { "hanzi": "...", "pinyin": "...", "translations": ["...", "..."],
    "example": { "hanzi": "...", "pinyin": "...", "english": "..." } }
  ```
  - `vocab.json` — "My own vocabulary list" (678 words)
  - `hsk1.json` — HSK 1, complete (500 words)
  - `hsk2.json` / `hsk3.json` / `hsk4.json` — empty `[]` placeholders
- Settings (`app.js`) persist to `localStorage` under key
  `chineseTrainer.settings`: `{ pageDurationMs, vocabSource }`.
- TTS via the browser's built-in Web Speech API (`speechSynthesis`,
  zh-CN / en-US voices) — free, offline, no API key, works in Safari.

## Status
- [x] Vocabulary Trainer mode: random order, 3 auto-advancing pages per
      word (Hanzi+Pinyin → English → word in an example sentence), each
      spoken aloud, tap left/right to go back/skip, pause button
- [x] Landscape-only UI (portrait shows a "rotate your phone" prompt —
      no real orientation-lock exists for a plain web page on iOS);
      text sized with `vmin`-based `clamp()` so it's readable at a
      glance (e.g. car-mounted phone)
- [x] Settings page: per-page duration slider (0.5s–5s), speech-rate
      slider (0.5x–1.5x, controls `SpeechSynthesisUtterance.rate`) +
      vocabulary source picker, all persisted
- [x] "My own vocabulary list" — 678 words, authored from the user's
      PDF (which turned out to be a garbled CC-CEDICT export, so
      translations/pinyin/examples were written fresh rather than
      parsed from it)
- [x] HSK 1 — 500 words, complete and verified against the official
      list
- [ ] HSK 2 — 772 new words, not started (empty placeholder file)
- [ ] HSK 3 — 973 new words, not started (empty placeholder file)
- [ ] HSK 4 — 1,000 new words, not started (empty placeholder file)
- [ ] Additional training modes beyond Vocabulary Trainer (not yet
      specified by user)
- [ ] Persistent phone access — user wants to reuse the same
      Tailscale + always-on Mac Mini pattern as the WSJ dashboard;
      currently only reachable via a local dev server
- [ ] Native iOS port — explicitly deferred until the web version is
      validated

## Notes / decisions log
(running log of things learned/decided along the way)

- 2026-08-08: Built the initial app end-to-end (scaffold, TTS, timing,
  tap navigation) and verified it in the Browser-pane preview at mobile
  viewport. Found the `computer` tool (synthetic click) reliably times
  out on this app's pages — looks related to `speechSynthesis`
  playback. Worked around it by dispatching synthetic `MouseEvent`s via
  `javascript_tool` for all verification instead; this was reliable
  throughout.
- 2026-08-08: Parsed the user's vocabulary PDF
  (`20251102_ChineseVocab_USL.pdf`, in Scanbot iCloud folder). Turned
  out to be a CC-CEDICT dictionary dump where the translation column
  got mangled by PDF text-wrapping — unusable as-is. Extracted just the
  Hanzi + (sometimes-unreliable) pinyin, ignored the garbled definitions
  entirely, and authored 2-3 translations (most obvious first) and one
  original example sentence per word from scratch. Deduped exact
  repeats; kept ~20 abstract grammar-pattern rows (e.g.
  `S1+比+S2+大/小+number+岁`) as their own entries with a concrete
  filled-in example rather than dropping them. Also corrected several
  garbled/archaic pinyin readings in the source (e.g. 听→tīng not the
  listed archaic yǐn, 过→guò not guō) using own knowledge rather than
  trusting the PDF's second column blindly. Final count: 678 unique
  entries.
- 2026-08-08: User asked for landscape support with bigger text (for
  glancing at a car-mounted phone) mid-build. Switched all in-trainer
  font-sizes from fixed `rem` to `vmin`-based `clamp()` so text scales
  to fill whatever the smaller viewport dimension is, in either
  orientation. Then user said portrait doesn't need to be supported at
  all — added a `.rotate-prompt` overlay shown only via
  `@media (orientation: portrait)`, hiding the active screen instead,
  since iOS Safari has no real orientation-lock API for a plain web
  page (that's only available to installed/fullscreen PWAs on some
  other platforms).
- 2026-08-08: Discovered the preview-tool/`.claude/launch.json`
  resolution gotcha described above the hard way — `preview_start`
  launched the *wrong* app (this session's actual root project's own
  dev server) on the first attempt. Fixed by adding a same-named
  `chinese-trainer` entry to that other repo's launch.json using
  `--directory`. Worth remembering if this happens again in a
  differently-rooted session.
- 2026-08-08: Added the Settings page (duration slider 0.5-5s +
  vocabulary-source picker). Before building HSK word lists, checked
  real numbers instead of assuming: new-standard HSK1-4 is ~3,245 words
  total (not the ~1,200 old-standard figure originally assumed), too
  large to build all at once. Agreed scope with user: new HSK 3.0
  (2021) standard, per-level *new* words only (not cumulative), full
  custom example sentence per word (same bar as the personal list),
  start with HSK1 only and revisit HSK2-4 later.
- 2026-08-08: Built HSK1 (500 words). Sourced the real word list from
  GitHub `krmanik/HSK-3.0` (`New HSK (2021)/HSK List/HSK 1.txt`) via
  raw `curl`/Bash rather than `WebFetch` (which paraphrases/summarizes
  page content through a small model and silently drops list entries —
  confirmed this the hard way on the first attempt). Diffed against
  `vocab.json` and reused 277 of the 500 words directly; authored the
  other 223 fresh. Validated with a Python script: exact entry count,
  no unintended duplicate (hanzi, pinyin) pairs, every entry has all
  required fields. Two characters (地, 还) appeared twice in the source
  list as an apparent data glitch (reusing the same reading twice
  instead of representing two real pronunciations, unlike 干 gān/gàn
  which legitimately is taught both ways) — fixed by giving them a
  second, genuinely distinct reading/meaning instead of leaving a
  redundant duplicate entry.
- 2026-08-08: Committed and pushed to GitHub for the first time (no
  commits existed before this point). Created private repo
  `nighthawk99/chinese-trainer`, matching the WSJ repo's visibility,
  explicitly kept separate from it per user request.
- 2026-08-08: Added a second settings slider for speech rate
  (0.5x–1.5x, default 1.0x), independent from the per-page duration
  slider. Reused the same `.settings-slider` CSS class (generalized
  from the duration slider's originally ID-scoped rule) so both share
  styling. Verified the actual `SpeechSynthesisUtterance.rate` picks up
  the setting by monkey-patching `speechSynthesis.speak` in the
  Browser-pane console rather than relying on audible confirmation.
- 2026-08-08: User reported Chinese speech sounding "robotic, choppy,
  distorted" — false alarm, not a real bug. They were listening to the
  Browser-pane preview tab live while I was rapidly firing
  `cancel()`+`speak()` calls in quick succession to verify things
  during testing (much faster than the real 3s page pacing), which
  produces exactly that overlapping/garbled sound. Confirmed clean on
  a normal, uninterrupted play-through in the same tab, and separately
  confirmed good in the user's own actual browser. Not caused by the
  speech-rate change. Worth remembering: don't chase phantom audio
  bugs reported while rapid scripted testing was audibly running in
  the same tab the user is listening to.
