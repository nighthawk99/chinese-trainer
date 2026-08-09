# Chinese Trainer App

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
- [x] Settings page: per-page duration slider (0.5s–5s), speech-rate
      slider (0.5x–1.5x, controls `SpeechSynthesisUtterance.rate`) +
      vocabulary source picker, all persisted
- [x] "My own vocabulary list" — 678 words, authored from the user's
      PDF (which turned out to be a garbled CC-CEDICT export, so
      translations/pinyin/examples were written fresh rather than
      parsed from it)
- [x] HSK 1 — 500 words, complete and verified against the official
      list
- [x] HSK 2 — 749 entries (746 unique words), complete
- [ ] HSK 3 — 973 new words, not started (empty placeholder file)
- [ ] HSK 4 — 1,000 new words, not started (empty placeholder file)
- [ ] Additional training modes beyond Vocabulary Trainer (not yet
      specified by user)
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
