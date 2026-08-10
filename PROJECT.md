# Chinese Companion App
(in-app display name; repo/GitHub Pages URL is still `chinese-trainer` —
not renamed, to avoid breaking the live URL and any Home Screen icons
already pointing at it)

## Goal
Personal iPhone Chinese vocabulary learning app. Building it as a plain
web app first (no build step, no framework) to validate the training
flow before ever considering a native Swift/SwiftUI port. First (and so
far only) training mode: **Vocabulary Trainer**, which drills a word
list in random order.

## Next steps (as of 2026-08-08, picking up on the Mac Mini)
The Mac Mini is now fully set up (see "Cross-machine setup" below) —
these are the two things left to actually *do* there:

1. **Sign in to Claude Code on the Mac Mini** — run `claude auth login`
   in a terminal there. This needs your own interactive
   approval, so it was left undone on purpose.
2. **Start a Remote Control session** — run `claude --remote-control`
   (add a name, e.g. `--remote-control macmini`, so it's easy to spot
   in a session picker). This should give a QR code or URL to connect
   to from the Claude mobile app / claude.ai/code, so you can drive a
   session that runs *on* the Mac Mini (full filesystem/tool access
   there) directly from your phone, instead of proxying through a
   MacBook-rooted session over SSH like this one did.
3. Once you've confirmed that flow works, the natural follow-up is
   making it persistent (tmux + a launchd job on the Mac Mini, same
   pattern as the WSJ dashboard) so it survives reboots/logouts
   instead of dying when a terminal window closes — not done yet,
   deliberately deferred until the basic flow is confirmed working.

After that, real feature work is still waiting: HSK2/3/4 word lists,
more training modes, etc. — see Status below.

## Cross-machine setup
Private GitHub remote (`nighthawk99/chinese-trainer`) is the shared
source of truth — a separate repo from `nighthawk99/wsj-market-briefing`
on purpose, kept unmixed. No dev/prod split needed (unlike the WSJ
project): this is a static site with no server-side secrets or state,
so any machine's checkout behaves identically.

**Already set up:**
- **MacBook** (where this was built) — `~/Projects/chinese-trainer`
- **Mac Mini** — also cloned to `~/Projects/chinese-trainer`, git
  identity configured to match. Reachable from the MacBook via
  `ssh macmini` (SSH config `Host macmini` in `~/.ssh/config`, now
  pointed at its **Tailscale IP `100.126.244.14`** rather than its old
  LAN-only IP `192.168.0.33` — the LAN IP only works when both
  machines share the same home WiFi; Tailscale works from anywhere).
  Node.js (v26.7.0) and the Claude Code CLI (v2.1.226,
  `@anthropic-ai/claude-code` via npm) are both installed there too,
  specifically so a Claude Code Remote Control session can run on it
  (see "Next steps" above) — not yet signed in/started.

**On any other new machine:**
```
git clone https://github.com/nighthawk99/chinese-trainer.git
cd chinese-trainer
python3 -m http.server 8420
```
Then open `http://localhost:8420`. That's the whole setup — no venv, no
env vars, no install step. (Or just use the live GitHub Pages URL
below — no local setup needed at all.)

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
- `index.html` / `style.css` / `app.js` — single-page app, eight
  screens (home, settings, vocab trainer, vocab session-complete,
  grammar category list, grammar category detail, phrases situation
  list, phrases situation detail) toggled via a CSS `.active` class.
  Grammar Review and Travel Phrases share the same generic "topic
  list → tap in → scrollable detail list" scaffolding (`.topic-list`
  / `.topic-item` / `.topic-detail-list` CSS classes, and a shared
  `renderTopicList()` helper in `app.js`) rather than each having its
  own copy.
- `data/vocab.json` / `hsk1.json` / `hsk2.json` / `hsk3.json` /
  `hsk4.json` — one file per Vocabulary Trainer word source, shape:
  ```json
  { "hanzi": "...", "pinyin": "...", "translations": ["...", "..."],
    "example": { "hanzi": "...", "pinyin": "...", "english": "..." } }
  ```
  - `vocab.json` — "My own vocabulary list" (678 words)
  - `hsk1.json` — HSK 1, complete (500 words)
  - `hsk2.json` — HSK 2, complete (749 entries)
  - `hsk3.json` / `hsk4.json` — empty `[]` placeholders
- `data/grammar.json` — Grammar Review feature's data, a flat array of
  59 constructs grouped into 15 topic categories, shape:
  ```json
  { "id": "...", "category": "...", "title": "...",
    "sourceLessons": ["L166", "..."],
    "subPatterns": [
      { "label": "... (optional, for multi-sense constructs)",
        "pattern": "... (optional slot-pattern notation)",
        "explanation": "...",
        "examples": [{ "hanzi": "...", "pinyin": "...", "english": "..." }] }
    ],
    "links": [{ "label": "...", "url": "..." }]  }
  ```
- `data/phrases.json` — Travel Phrases feature's data, a flat array of
  223 phrases grouped into 12 everyday-situation categories, shape:
  ```json
  { "id": "...", "situation": "...", "hanzi": "...", "pinyin": "...",
    "english": "...", "note": "... (optional, e.g. \"you'll hear this,
    not say it\")" }
  ```
- Settings (`app.js`) persist to `localStorage` under key
  `chineseTrainer.settings`: `{ pageDurationsMs: [hanziMs, englishMs,
  sentenceMs], vocabSource, speechRate }`.
- TTS via the browser's built-in Web Speech API (`speechSynthesis`,
  zh-CN / en-US voices) — free, offline, no API key, works in Safari.
  Vocabulary Trainer only — Grammar Review and Travel Phrases are
  browsed silently (by design, per the user).
- Dark/Light theme: every color in `style.css` is a CSS custom
  property on `:root` (dark, the original look) with a full override
  block on `:root[data-theme="light"]`. `applyTheme()` in `app.js`
  sets that `data-theme` attribute on `<html>` — **automatically**,
  from the device's local time of day (light 7am–7pm, dark otherwise;
  not tied to `prefers-color-scheme` and not user-configurable — an
  earlier manually-toggled version was explicitly replaced with this
  per the user). Re-checked on load, on `visibilitychange`, and every
  5 minutes so a long-open session still crosses the boundary live.
- `sw.js` — a Service Worker providing offline support (Vocabulary
  Trainer / Grammar Review / Travel Phrases all keep working with no
  signal, registered from `app.js`). Deliberately **network-first**,
  not cache-first: whenever there's a connection, the live server's
  current version always wins; the cache is purely an offline
  fallback. This was a deliberate reaction to this app's own history —
  plain HTTP caching has caused several real "why does this look
  broken/old" bugs this session, and a service-worker cache is
  stickier than HTTP cache, so cache-first would have made that
  category of bug worse, not better. Precaches the full app shell +
  every data file (including the empty `hsk3.json`/`hsk4.json`
  placeholders) on install so the app is offline-ready immediately,
  not just for screens already visited.
- `icon.svg` — the app logo/icon (gradient-blue rounded square, white
  中 character), used as favicon and, rasterized to `icon-180.png` /
  `icon-32.png` (no SVG-to-PNG tool available locally, so rendered via
  a headless-Chrome screenshot of the SVG then downscaled with
  `sips`), as the `apple-touch-icon` for "Add to Home Screen."

## Status
- [x] Vocabulary Trainer mode: random order, 3 auto-advancing pages per
      word (Hanzi+Pinyin → English → word in an example sentence), each
      spoken aloud. Quick tap left/right to go back/skip; holding a
      finger down pauses the page-turn timer for as long as it's held
      (pointer events, duration-based tap-vs-hold disambiguation).
      Explicit pause button also still there.
- [x] Works in both portrait and landscape. Text sized with `vmin`-
      based `clamp()` as an upper bound (readable at a glance, e.g.
      car-mounted phone in landscape) plus a JS shrink-to-fit pass
      (`fitContentToContainer` in app.js, driven by a `--fit-scale`
      CSS variable) that scales a page's text down only as much as
      needed so long words/sentences never overflow a narrow portrait
      screen
- [x] Settings page: independent duration slider per page (Hanzi+Pinyin
      / English / Sentence, 0–10s in 0.5s steps — the auto-advance
      timer only starts once that page's speech finishes, not on
      render), speech-rate slider (0.5x–1.5x, controls
      `SpeechSynthesisUtterance.rate`) + vocabulary source picker, all
      persisted
- [x] "My own vocabulary list" — 678 words, authored from the user's
      PDF (which turned out to be a garbled CC-CEDICT export, so
      translations/pinyin/examples were written fresh rather than
      parsed from it)
- [x] HSK 1 — 500 words, complete and verified against the official
      list
- [x] HSK 2 — 749 entries (746 unique words), complete
- [ ] HSK 3 — 973 new words, not started (empty placeholder file)
- [ ] HSK 4 — 1,000 new words, not started (empty placeholder file)
- [x] Grammar Review — second top-level feature (self-paced browsing,
      no timer, no TTS, unlike Vocabulary Trainer). 59 grammar
      constructs grouped into 15 topic categories, extracted and
      merged from a 54-lesson doc developed with the user's Chinese
      teacher. Home screen → pick a category → tap a construct to
      expand pattern/explanation/examples.
- [x] Travel Phrases — third top-level feature, same self-paced/no-TTS
      style as Grammar Review. 223 freshly-authored phrases (not from
      a source doc) across 12 everyday situations a traveler in China
      would hit (airport, transport, hotel, dining, mobile payment,
      shopping/bargaining, directions, emergencies, connectivity,
      socializing, sightseeing, numbers/time). Home screen → pick a
      situation → scroll a flat list of phrase cards.
- [x] App logo (`icon.svg`, gradient-blue square + white 中) wired up
      as favicon and Home Screen icon; app renamed in-app from
      "Chinese Trainer" to "Chinese Companion" (repo/URL unchanged)
- [x] Dark/Light theme — every color tokenized as a CSS custom
      property; automatically follows the device's local time of day
      (superseded an earlier manually-toggled version per the user),
      verified across all screens in both themes and at both time
      boundaries
- [x] Offline mode (`sw.js`) — network-first Service Worker, precaches
      the full app shell + all data files on install. Verified: no
      syntax/runtime errors, every precached URL confirmed 200 on the
      live server, registration doesn't throw. **Not yet verified**:
      full install→offline→serve-from-cache lifecycle on a real
      device — headless Chrome testing hit real limits around Service
      Worker timing (see decisions log), and driving real Safari via
      `safaridriver` needs a one-time manual toggle in Safari's
      Develop menu that wasn't enabled without asking first. Ask user
      to confirm: use the app once online, then enable Airplane Mode
      and reopen it.
- [ ] Additional training modes beyond Vocabulary Trainer / Grammar
      Review / Travel Phrases (not yet specified by user)
- [x] Persistent phone access — live at
      **https://nighthawk99.github.io/chinese-trainer/** via GitHub
      Pages. Reachable from anywhere (WiFi or cellular), no Mac needs
      to be running. Went this route instead of Tailscale — simpler
      for a static site with no backend/secrets. Tip: "Add to Home
      Screen" in Safari for an app-like icon.
- [ ] Native iOS port — explicitly deferred until the web version is
      validated
- [~] Claude Code on the Mac Mini (for driving development from your
      phone) — Node.js + Claude Code CLI installed, repo cloned there,
      SSH reachable from anywhere via Tailscale. Not yet signed in or
      started — see "Next steps" at the top of this file.

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
- 2026-08-08: User asked for phone access without Tailscale. Tried
  GitHub Pages first since it needs no new account (`gh` was already
  authenticated) — confirmed via a real API call (not assumed) that it
  doesn't work on a private repo on the free plan (422 "current plan
  does not support GitHub Pages for this repository"). Presented the
  real options (make the repo public + GitHub Pages, vs. Netlify/
  Vercel which need a separate account but keep the repo private).
  User chose to make the repo public. Flipped visibility with
  `gh repo edit --visibility public`, enabled Pages via
  `gh api -X POST .../pages` with `source.branch=main, path=/` (no
  build step needed — legacy branch-deploy mode, since this is plain
  static HTML/CSS/JS with no bundler). All asset/data references in
  the app were already relative paths (no leading `/`), so it worked
  immediately at the `/chinese-trainer/` project-page subpath with no
  code changes. Verified live at
  https://nighthawk99.github.io/chinese-trainer/ (title, vocab count,
  and mobile-viewport screenshot all correct). Repo is now public —
  worth remembering if that ever needs to be reconsidered.
- 2026-08-08: Re-enabled portrait (removed the rotate-prompt gate
  added earlier). Testing surfaced a real overflow bug this exposed:
  pure `vmin`/`clamp()` sizing only knows viewport dimensions, not how
  many characters are in a given word, so a 3-character word (生病好)
  on a narrow 375px phone rendered each character on its own line at
  full size and overflowed the screen (confirmed via `scrollHeight` vs
  `clientHeight`, not just visually). Fixed with a JS shrink-to-fit
  pass rather than trying to solve it in pure CSS: every render sets
  `--fit-scale: 1` then steps it down in 0.05 increments while
  `page-content.scrollHeight > tap-zone.clientHeight`, and every large
  font-size is `calc(clamp(...) * var(--fit-scale, 1))`. Starts at the
  full vmin-based size and only shrinks exactly as much as a given
  page needs, so short words/sentences stay maximally large. Verified
  against the two real worst cases in the dataset (that 3-character
  word, and the longest 16-character example sentence in vocab.json)
  in both a small portrait viewport (375×667) and landscape — both fit
  with zero leftover overflow. Kept `overflow-y: auto` on the tap zone
  as a last-resort safety net, though it shouldn't normally trigger.
- 2026-08-08: Added hold-to-pause. Replaced the tap zone's plain
  `click` listener with `pointerdown`/`pointerup`/`pointercancel` so
  real press duration is measurable — `pointerdown` clears the timer
  immediately, `pointerup` checks elapsed time (<300ms + <10px
  movement = tap → navigate; otherwise → just resume the timer,
  no navigation). Verified with synthetic `PointerEvent`s (not
  `MouseEvent`, which the tap zone no longer listens for) at a
  temporarily short page duration set live via the actual settings
  slider — setting `localStorage` directly in a test script does
  *not* affect a page's already-running in-memory `settings` object,
  which is only read once at load; this cost one wasted test cycle
  before catching it. Worth remembering for any future test involving
  settings on an already-open tab.
- 2026-08-08: User noticed the Claude Code session (this whole
  conversation) shows "wsj-market-briefing" as its project label in
  the mobile app, despite doing chinese-trainer work throughout —
  because the session's root working directory has been
  wsj-cro-briefing since the start (that's just where the session
  originally opened; all the actual chinese-trainer work happened via
  absolute paths in a different directory the whole time). Confirmed
  via grep that there's no real cross-contamination in the actual
  project (only PROJECT.md itself mentions WSJ, intentionally, as a
  comparison). The one real consequence: Claude's per-project auto-
  memory is scoped by session root, so everything learned about this
  project was being saved under wsj-cro-briefing's memory folder, not
  a chinese-trainer-specific one. Fixed by creating
  `~/.claude/projects/-Users-michaeldemuth-Projects-chinese-trainer/memory/`
  (matching Claude Code's own path-derived naming convention) and
  copying over the memories that actually apply to this project, so a
  future session rooted directly in chinese-trainer's own directory
  will have full context immediately instead of starting blank. This
  session itself can't be re-rooted mid-conversation though — that's
  fixed by the platform at session start — so this PROJECT.md file
  remains the one source of truth guaranteed to reach *any* session
  regardless of root, which is exactly why it matters.
- 2026-08-08: Set up Mac Mini access ahead of the user turning off
  their MacBook for the day. Local-network SSH (the `macmini` alias's
  old `HostName 192.168.0.33`, from the WSJ project setup) failed —
  confirmed via `ipconfig`/`ping` that this MacBook wasn't on the same
  network. Started Tailscale on the MacBook (installed but stopped)
  and found the Mac Mini already on the tailnet as `m4macminipro` at
  `100.126.244.14` (same IP the WSJ dashboard already uses). Updated
  `~/.ssh/config`'s `macmini` entry to that IP so it works from
  anywhere going forward, accepted its host key via `ssh-keyscan`
  (first connection from this address), and confirmed SSH access.
  Cloned this repo there, set matching git identity, and did a real
  smoke test (started the dev server over SSH, curled it, confirmed
  vocab.json returns all 678 words) before stopping that test server
  again. User then asked about connecting from their phone to "that
  session" — researched Claude Code's Remote Control feature via the
  claude-code-guide subagent rather than guessing, then verified its
  claims firsthand instead of relaying them blind: `claude` wasn't
  even installed on the Mac Mini, so installed Node.js (via
  Homebrew — also not previously present) and the Claude Code CLI
  (`@anthropic-ai/claude-code` via npm, had to explicitly
  `--allow-scripts` for its postinstall), then confirmed for real via
  `claude --help` that `--remote-control` and `claude auth login` are
  genuine, current commands. Deliberately stopped short of running
  `claude auth login` myself — that needs the user's own interactive
  approval, not something to do on their behalf. See "Next steps" at
  the top of this file for exactly what's left.
- 2026-08-08: Built HSK2 (749 entries, 746 unique words). Sourced the
  real word list the same way as HSK1 (raw `curl` of
  `krmanik/HSK-3.0`'s `HSK 2.txt`, not `WebFetch`). Found and fixed
  two source-list issues before authoring: (1) 17 words in the raw
  HSK2 list were already present in `hsk1.json` — excluded as
  not-actually-new, since the project's "new words per level, not
  cumulative" scope decision means a level-2 list re-listing a
  level-1 word is a source glitch, not a deliberate re-teach; (2) the
  adjacent lines `表`/`示` were a scraping split of the single word
  `表示` (`示` isn't a standalone modern word) — merged back into one
  entry rather than authoring two spurious single-character words.
  Also resolved 6 same-hanzi-appears-twice cases in the source: `长`
  (cháng/zhǎng), `倒` (dào/dǎo), and `得` (dé/děi) are genuine
  dual-pronunciation words and got two full entries each (matching
  the 干/地/还 precedent from HSK1); `头`, `省`, `实在` were same-
  reading duplicates (a data-entry artifact like HSK1's 地/还) and got
  one merged entry each with multiple senses in `translations`.
  Diffed the remaining 746 target words against `vocab.json` and
  reused 153 entries (152 words, +1 for `长`'s two vocab.json
  readings) directly; the other 596 needed fresh authoring. Given the
  volume, split the 596 into 6 batches of ~100 and authored them via
  6 parallel forked subagents (same session context, so each already
  knew the schema/precedents/quality bar from this conversation)
  rather than one long sequential pass — each fork wrote its batch to
  a scratchpad JSON file and self-validated count/schema before
  reporting back; all 6 landed clean on the first pass; merging and
  final validation (exact word-list coverage, no unintended duplicate
  (hanzi, pinyin) pairs, all fields present, punctuation/capitalization
  conventions matching hsk1.json/vocab.json) was done centrally
  afterward. Caught and fixed 2 minor style inconsistencies this way
  (`春节`/`英文` had capitalized word-pinyin; house style is lowercase
  even for proper nouns, e.g. `zhōngguó` in hsk1.json).
- 2026-08-09: User reported no TTS audio at all on their iPhone
  (Home Screen icon, then confirmed also silent in a plain Safari
  tab). Chased two real-but-not-the-cause code issues first: Safari's
  documented same-tick `cancel()`+`speak()` race (now fixed in
  `speak()` — only cancels when something's actually playing, then
  defers the next `speak()` by one tick), and the async-gesture-
  timing gap in `startSession()` (now mitigated with a
  `primeSpeechSynthesis()` call — a near-silent utterance fired
  synchronously in the Start/Restart button's click handler, before
  the awaited vocab fetch, so a later timer-driven `speak()` isn't
  blocked by iOS's user-gesture requirement for standalone/Home
  Screen apps). Neither fixed it, so added a temporary on-screen
  debug panel (logged every `speak()` call, voice list, and
  utterance `onstart`/`onend`/`onerror`) rather than keep guessing —
  and it showed `onstart`/`onend` firing normally with correct voices
  (`Tingting`/`Samantha`) and realistic durations, no errors at all.
  That meant speech synthesis was genuinely "succeeding" from the
  API's point of view, which pointed away from app code entirely.
  Root cause, confirmed by the user via Control Center: **iOS
  Safari's Web Speech API respects the Focus/Do Not Disturb mute
  state** (the crossed-out bell in Control Center) — toggling it off
  brought audio back immediately. This is a genuine WebKit quirk with
  no JS-level workaround: `<video>`/`<audio>` playback uses a
  different audio session category that ignores Focus/DND, but
  `speechSynthesis` doesn't, and the browser never surfaces this as
  an error (`onstart`/`onend` fire as if it played normally). Not a
  bug in this app — removed the debug panel and kept the two
  legitimate defensive fixes (the cancel/speak race guard and the
  gesture-priming call), since both address real, separately-
  documented WebKit issues even though neither was this specific
  cause. Worth remembering next time TTS audio reportedly stops:
  check Focus/Do Not Disturb before assuming a regression.
- 2026-08-09: Fixed the iOS long-press callout (Copy/Look Up/Share +
  selection handles) firing on hold-to-pause — the existing global
  `user-select: none` wasn't enough; `-webkit-touch-callout: none` is
  the separate property actually responsible for it on iOS Safari.
- 2026-08-09: Replaced the single "time per page" slider with three
  independent ones (Hanzi+Pinyin / English / Sentence, 0–10s), and
  made the auto-advance timer start only once that page's TTS
  `onend` fires rather than immediately on render (previously the
  configured duration ran in parallel with the spoken audio). Added
  an 8s safety timeout in `speak()` in case `onend`/`onerror` never
  fires (a real WebKit flakiness this app has hit before) and a
  render-generation guard so a late callback from a page the user has
  since left can't trigger a spurious advance.
- 2026-08-09: Made the Hanzi+Pinyin page's word always render on one
  line (`white-space: nowrap` + a width check added to
  `fitContentToContainer`'s existing shrink loop) instead of allowing
  wrap. Found via testing against real data that this broke for
  `vocab.json`'s ~20 grammar-pattern entries (e.g. `S + 比 + S +
  大/小 + number + 岁`, 28 characters) at the prior shrink floor —
  lowered the floor (0.25 → 0.1) and added `overflow-x: auto` on the
  tap zone as a last-resort safety net.
- 2026-08-09: Built **Grammar Review**, a second top-level feature
  alongside Vocabulary Trainer. Source: "生词+生字+语法", a Google Doc
  developed with the user's Chinese teacher (54 lessons, L158–L211,
  ~95K characters, mixing plain vocabulary with grammar constructs,
  no thematic organization, several points taught in duplicate or
  scattered across lessons). Process:
  1. Read the whole doc via forked subagents (too large for one
     context window) to scope structure before designing anything —
     confirmed the fetched content's truncation at the end matched
     the doc's real ending (L211), not a fetch error.
  2. Proposed a 15-category topic taxonomy as a published Artifact
     (grounded in a full construct inventory, not guessed) — user
     reviewed and asked for the initial "ungrouped standalone items"
     bucket to be folded into a few more invented categories rather
     than left as a flat list.
  3. Extracted full content (pattern notation, explanation, examples)
     via 6 parallel forks, each assigned a contiguous line range of
     the raw doc (mapped from the doc's own lesson-header line
     numbers) rather than splitting by category, since a single
     lesson often contains multiple different grammar points —
     avoided redundant re-reads of the same source text. Constructs
     scattered across lesson ranges (e.g. 再's 5 senses across 4
     non-adjacent lessons) were extracted piecemeal per-chunk using a
     shared canonical-title list, then merged centrally by exact
     title match afterward.
  4. Validated: schema check, no empty example fields, spot-checked
     the most-merged entries (再, 过 past-experience, Resultative
     Complements, Directions & Navigation) for correct concatenation.
     Caught and fixed 2 issues: an empty-examples subPattern left over
     from a source lesson that only briefly re-mentioned something
     taught earlier (merged into the fuller entry instead), and a
     fork's meta-commentary ("flagging for parent to decide...")
     that had leaked into a construct's user-facing explanation text.
     Also caught that the taxonomy's original 7-item guess for
     Comparisons & Equality was one over — no separate "basic
     comparison" content actually exists in the source distinct from
     "degree of difference"; real count is 6.
  Final: 59 constructs (including 2 the extraction forks found and
  flagged as legitimate but outside the original 58 — included after
  review), 15 categories, 342 examples, in `data/grammar.json`. UI:
  self-paced (no timer, no TTS, per user's explicit choice — this
  content has more to read per item than a vocab word) — home screen
  tile → category list → tap a category → expandable `<details>`
  cards per construct with pattern/explanation/examples. Text
  selection is deliberately re-enabled on these screens (unlike the
  rest of the app) since it's a reference feature, not a timed drill.
- 2026-08-09: User said to stop asking for permission before routine
  actions (commit, push, running local test servers) on this project
  — asked repeatedly through the Grammar Review build and it slowed
  things down for no real benefit on a solo project with no other
  collaborators. Saved as a standing preference in Claude's own
  cross-session memory. Still flagging genuinely destructive/
  irreversible ops (force-push, hard reset, deleting branches/files)
  regardless — the new default is "just proceed," not "anything
  goes."
- 2026-08-09: Built **Travel Phrases**, a third top-level feature —
  useful everyday phrases for a traveler in China (hanzi/pinyin/
  English), unlike Grammar Review this is freshly authored content,
  not extracted from a source document. Process: proposed 12
  situations first (airport, transport, hotel, dining, money/mobile
  payment, shopping/bargaining, directions, emergencies,
  connectivity, socializing, sightseeing, numbers/time) and got
  user sign-off before writing anything. Asked two design questions
  up front rather than assuming: TTS was declined (text-only, like
  Grammar Review — this is a lookup feature, not proven to need
  audio) and depth was set to ~15-20 phrases/situation over a
  leaner ~8-10.
  Refactored Grammar Review's category-list/detail-list CSS+JS first
  (renamed to generic `.topic-list`/`.topic-item`/`.topic-detail-list`
  classes + a shared `renderTopicList()` helper) so Travel Phrases
  could reuse the same scaffolding instead of duplicating it — a
  worthwhile few-minutes refactor since the UX pattern ("browse
  topics, tap in, scroll a detail list") is identical between the two
  features.
  Authored via 6 parallel forks (2 situations each) directly from
  each fork's own Chinese knowledge (no source doc to extract from
  this time), calibrated against vocab.json/hsk1.json's existing
  pinyin conventions. Two of the six forks ran far longer than the
  rest (~1h+ vs ~1-15 min) and still showed as "running" when the
  user asked if they were stuck; rather than assume either way,
  messaged them directly to check — while waiting on that, discovered
  both had actually already finished and written valid, high-quality
  output files, just hadn't returned their completion notification
  yet. Worth remembering: check the actual output file on disk before
  concluding a background task is stuck, since a "running" status
  from the harness can lag behind real completion.
  Final: 223 phrases across 12 situations (all within the requested
  15-20/situation range) in `data/phrases.json`. Caught and fixed one
  pinyin-consistency issue during merge (`duōshao` vs the house
  convention `duōshǎo`, plus one un-sandhi'd `Yīgòng` that should be
  `Yígòng`) before finalizing.
- 2026-08-09: User asked whether the Vocabulary Trainer keeps running
  (auto-advance + spoken audio) when the phone is locked or Safari is
  backgrounded/minimized. Answered from first-hand knowledge of iOS
  Safari rather than assuming: **no**, it doesn't — iOS suspends a
  plain web page's JS execution (including `setTimeout` timers and,
  in effect, `speechSynthesis`) once backgrounded/locked. The one
  exception iOS allows is a real `<audio>`/`<video>` element with
  Media Session metadata, which is how web-based podcast/music
  players survive a locked screen — `speechSynthesis` doesn't get
  that same treatment. There's an unofficial, undocumented workaround
  (loop a silent `<audio>` element to keep the page "alive"), but it's
  not guaranteed to keep the actual TTS voice playing behind a locked
  screen, and can't be verified without a real on-device test — user
  hasn't asked for this to be attempted yet.
- 2026-08-09: Redesigned the home screen only (user explicitly said
  not to touch the layout of Vocabulary Trainer or the other
  features) — kept the existing dark palette exactly (white text on
  near-black, per user's stated preference) but added: a small
  eyebrow tagline, a subtle radial-gradient background scoped to
  `#home-screen` only, and per-tile icon badges using real Chinese
  characters (词/语/旅) rather than generic icons or emoji, tying
  each tile to its actual content. Hit a real CSS bug restructuring
  `.mode-tile` into an icon+text+chevron row: flex items default to
  `min-width: auto`, which let the row's content force the tile wider
  than its own explicit `width`, overflowing past the screen edge on
  narrow viewports — fixed with an explicit `min-width: 0` on
  `.mode-tile`. Chased a false alarm while verifying the fix:
  headless Chrome's `--window-size` flag doesn't reliably set
  `window.innerWidth` for `--screenshot`/`--dump-dom` on this
  machine's Chrome build (kept reporting 500 regardless of the flag,
  across `--headless`/`--headless=new`, fresh profiles, and
  `--force-device-scale-factor=1`), which produced screenshots that
  looked genuinely overflowing purely because the image was saved at
  the requested pixel size while the page had actually been laid out
  at 500px and then cropped. Confirmed the real fix was correct by
  wrapping the page in a fixed-width `<iframe>` instead (immune to
  the flag issue) and reading real computed styles off an on-page
  debug overlay. Worth remembering: don't trust `--window-size` alone
  for viewport-accurate headless screenshots on this setup — verify
  `window.innerWidth` directly, or use the iframe trick.
- 2026-08-10: User reported the redesigned home screen looked broken
  in real Safari (icon/text/chevron stacked vertically instead of in
  a row). Confirmed the live server was serving the correct, current
  CSS — same stale-cache pattern hit multiple times before with this
  app (new HTML + old cached CSS = unstyled-looking layout). Resolved
  by the user force-reloading; not a real bug.
- 2026-08-10: Designed an app logo (`icon.svg`) — gradient-blue
  rounded square with a bold white 中, chosen over the feature-tile
  characters (词/语/旅) because it needed to read clearly at favicon
  size (中 is 4 strokes, simple and symmetric) and represent the whole
  app rather than one feature. No SVG→PNG tool available locally
  (checked rsvg-convert/cairosvg/imagemagick/inkscape — none
  installed, and `sips` doesn't read SVG), so rasterized by screenshotting
  the SVG in headless Chrome at 512×512 and downscaling with `sips`
  to get `icon-180.png` (apple-touch-icon) and `icon-32.png`
  (favicon fallback) — confirmed legible at both real target sizes,
  not just the source render, since small type/glyphs can break down
  at actual icon sizes even when the source looks fine. Wired up as
  favicon + apple-touch-icon, and also shown in-app above the home
  screen title, not just as a hidden browser-chrome icon.
- 2026-08-10: Renamed the app (in-app display name only) from
  "Chinese Trainer" to "Chinese Companion" — user's pick from a
  shortlist, chosen since "Trainer" undersold the app now that it's
  also a browsable grammar/phrase reference, not just a drill.
  Deliberately did NOT rename the GitHub repo or change the live
  GitHub Pages URL (`nighthawk99.github.io/chinese-trainer/`) — that
  would break the URL for any Home Screen icon already pointing at it
  with no real benefit, since the repo name isn't user-facing.
- 2026-08-10: Added a manually-switched Dark/Light theme (Settings →
  Appearance), keeping the existing look as Dark exactly as-is per
  the user's explicit preference for white-on-black. Required
  tokenizing every color in `style.css` first — several were
  hardcoded hex/rgba literals scattered across rules (border color,
  two shadow values, the home-screen glow, the primary-button text
  color) rather than CSS custom properties, so `:root[data-theme=
  "light"]` could override them. Verified all four screens (home,
  settings, Grammar Review detail, Vocabulary Trainer) in both themes
  via screenshots before considering it done, including the toggle's
  own active/inactive visual state.
- 2026-08-10: User reported the theme switch "does not work" and asked
  for it to be a real toggle. Checked the live deployed `app.js`/
  `index.html` bytes directly first — logic was correct and matched
  what had already been screenshot-verified, so almost certainly the
  same stale-cache pattern hit repeatedly before with this app, not an
  actual bug. Rebuilt the control as a proper single iOS-style switch
  (`.switch`/`.switch-thumb`, `role="switch"` + `aria-checked`)
  instead of the two-button segmented picker regardless, since that
  was the explicit ask. One CSS mistake caught before shipping:
  first draft animated the thumb via `justify-content` flex-start/
  flex-end on click, which doesn't transition (not an animatable
  property) — fixed by animating `transform: translateX()` on the
  thumb itself instead, which does.
- 2026-08-10: Added offline mode via a Service Worker (`sw.js`).
  Verified every precache URL returns 200 on the *live* site first
  (a single failing URL in `cache.addAll()` fails the entire install
  silently), rather than assuming. Chose network-first over cache-
  first/stale-while-revalidate deliberately — this app has hit
  several real "why does this look stale/broken" bugs this session
  from plain HTTP caching alone, and a Service Worker cache is
  stickier, so cache-first risked making that exact problem worse.
  Hit a real limitation trying to verify the full install→offline
  lifecycle in headless Chrome: `--virtual-time-budget` (used
  throughout this session for fast, deterministic screenshot tests)
  does not reliably let Service Worker installation complete —
  `navigator.serviceWorker.getRegistrations()` kept returning empty
  even after bumping the injected wait to 6s of *virtual* time,
  because virtual time governs page JS timers, not the browser's
  underlying SW lifecycle/disk I/O. Also discovered a fresh
  `--user-data-dir` profile reliably hangs headless Chrome on this
  machine (matches an earlier, separate hang from viewport-testing
  work) — avoid it; reuse the default profile instead.
- 2026-08-10: User asked to also verify everything works in real
  Safari specifically. Checked whether `safaridriver` (Apple's
  built-in WebDriver server, confirmed present) could drive real
  Safari for testing — it can, but requires manually enabling "Allow
  Remote Automation" in Safari's Develop menu first, a real one-time
  settings change. Deliberately did not flip that on the user's
  behalf without asking (per the safety guidance on system-affecting
  changes) — asked the user to verify offline mode on their actual
  device instead. Did confirm, from direct knowledge rather than
  guessing, that every API used across this session's features
  (CSS custom properties, `:root[data-theme]` attribute selectors,
  flexbox, Service Workers, the Cache API, `visibilitychange`) is
  mainstream and has been supported in Safari for years — the
  genuine unknowns are Safari/iOS-specific *behavior*, not API
  support: notably, iOS Safari can evict a site's Service Worker
  registration and cache entirely after roughly a week of the site
  not being opened (Apple's storage eviction policy), which is worth
  the user knowing about as a real limitation of offline mode, not a
  bug to chase if it's ever observed.
- 2026-08-10: User spotted a green-on-black debug panel ("registrations:
  1 / active: activated / cache names: [...] / cached entries: 14") on
  the live site — a leftover debug-overlay script from testing sw.js
  registration, accidentally left in `index.html` and committed
  together with the real offline-mode changes instead of being
  restored first. Silver lining: the debug output itself was real and
  confirmed the Service Worker genuinely works correctly on the user's
  actual iPhone (1 registration, state "activated", 14/14 files
  cached) — the exact real-device confirmation the offline-mode work
  couldn't get from headless-Chrome testing alone. Fixed by removing
  the injected script (one clean, isolated diff) and pushing
  immediately. Process lesson: when a workflow involves temporarily
  modifying a real source file (not a separate test_*.html copy) to
  inject test/debug code, always `git diff` before committing — don't
  trust that an earlier "restore from backup" step actually completed
  before later, unrelated edits and a commit happen on top of it.
