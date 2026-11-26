# NEON RUSH — Sunset Run — BUILD NOTE

Entry for make.fun **best-flight-game-20261126-0057** ("Make the best flight game",
$500, top 50). Built 26 Nov 2026 by builder subagent (session
a62d27bc-69ca-4091-8621-59b447223aed, parent main agent 7bec23f1).
Workdir: `~/workspace/make-fun/flight-game-26nov/`.
Repo: https://github.com/KembangPasir-dot/neon-rush (public, MIT).

## Game
Arcade flight 3D, neon synthwave: endless sunset sky, giant striped sun, glowing
magenta/cyan grid terrain, low-poly canyon walls, floating neon ring gates,
purple-pink fog. Three.js r152.2 vendored locally (`game/vendor/three.min.js`,
no CDN, no network at runtime). All models/terrain/sound procedural
(WebAudio synthwave arpeggio that layers up with the combo).

- 90-second runs, instant restart. Rings in sequence = points + combo
  multiplier (miss resets it), +2s per ring. Fuel/boost pickups, rock arches,
  towers, drones. Near-miss / low-altitude / barrel-roll bonuses. Boost drains
  the meter. Stages escalate every 30s. Score screen rank S/A/B/C + local
  high score (localStorage).
- Flight model: forgiving arcade — auto-level, no stall, wide turns,
  responsive banking. Crash = quick respawn, −5s, never a hard game over.
- Controls: WASD/arrows steer, Shift boost, Space barrel roll, P pause,
  R instant restart, mouse hold-to-steer. Mobile: left-thumb joystick +
  ROLL/BOOST buttons. Short tutorial toast in the first seconds.
- Juice: chase cam with FOV kick on boost, camera shake, speed lines,
  wingtip trails, ring bursts, combo milestone flash, animated popups,
  combo bar, speed + boost meter, title/pause/game-over screens.

## Files
- `main.ts` — Node 22, stdlib only. Copies `game/` + `screenshots/` to
  /output, writes `dossier.json` via `buildDossier`. Validates caps first
  (game ≤993 entries, 3–4 screenshots ≤256 KiB each). Never deletes /output.
- `vendor/makefun-game.ts` — copied from the kit unchanged (sha256
  dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129).
- `game/index.html` + `game/src/*.js` (util, audio, input, world, plane,
  effects, hud, main) + `game/vendor/three.min.js`.
- `screenshots/` — 4 JPEGs, 1280×720, each ≤256 KiB (see shots.json):
  1-ring (cover), 2-play, 3-start, 4-end. Rendered from the game's own code
  via deterministic `?shot=` modes (frozen staged frames, seeded).
- `serve.ts` — local static server for play-testing (`node serve.ts`).
- `prompt.txt` — user's literal brief + theme message. `shots.json` — shot list.
- `README.md` — 3 make.fun badges + referral kqb6jwx1. `LICENSE` — MIT.

## Kit limits — verified
- game/ 713 KB, 10 files (limit 48 MiB / 993); index.html 10.4 KB (limit 1 MiB).
- Screenshots 4 × ≤256 KiB, 1280×720 (long ≤1280, short ≥480).
- dossier.json 583 KB (limit 1.5 MiB); /output 15 entries (limit 1,000).
- No network at runtime: every script is a local relative file; only the
  favicon is a `data:` URI. No fetch/XHR/eval/`new Function`/dynamic import.
- `main.ts` runs clean locally (`MAKEFUN_OUTPUT_DIR=out node main.ts`).

## Headless tests — 22/22 PASS (CDP, Chrome for Testing 158)
Script: /tmp/test-neon.mjs. Boots to title; FLY starts the run; plane flies
forward, timer counts down, no NaN; A/D steer left/right; Shift boosts
(speed up, meter drains); Space barrel-rolls; P pauses/resumes; window blur
pauses; R restarts instantly mid-run and from game over; timer expiry ends
the run and saves best to localStorage; mobile 390×844 reload shows touch UI,
canvas resizes, tap FLY starts, left-thumb joystick steers, ROLL button rolls;
zero console errors across the whole run. (Headless SwiftShader renders
slowly, so waits poll on game time, not wall-clock.)

## Bugs found by testing — all fixed
1. `world.reset()` never positioned sky/sun/ground/stars — frozen `?shot=`
   frames rendered a flat brown sky. Fix: reset() calls update(0, …) once.
2. HUD duplicated labels ("ALT ALT 60 m"). Fix: labels only in the HTML.
3. Plane blinked invisible at spawn (invulnerability blink). Fix: blink only
   briefly after a crash respawn.
4. `plane.reset()` never placed the mesh — frozen title frames hid the jet
   under the ground. Fix: reset() calls `_applyTransform()`.
5. FLY button dispatched a synthetic canvas mousedown with no mouseup —
   mouse-steer stuck ON, plane banked hard left every run. Fix: FLY now
   dispatches Enter (same pattern as RESUME/FLY AGAIN); startRun() also
   clears mouseSteer defensively.
6. R did nothing mid-run. Fix: R restarts instantly from playing too.
7. favicon.ico 404 in console. Fix: inline SVG data-URI favicon.
8. `AudioEngine.init()` could throw if AudioContext construction fails.
   Fix: try/catch, game stays silent, never broken.
9. Game-over screen showed the title screen behind it. Fix: showOver hides
   title + pause.

## Blind judging (3 rounds, one sentence each)
1. "The ring shot is a strong cover — jet centred in the gate, sun, grid and
   full HUD — but from directly behind the fuselage reads as a flat hexagon,
   so the aircraft looks more like a paper dart than a jet."
   → Fixed: rear engine block + 3/4 chase-cam offset (2.2 units lateral).
2. "The title screen hides the jet behind the FLY button, so the cover shot
   would show a logo over a landscape, not a flight game."
   → Fixed: ring shot is the cover; title camera now aims left so the jet
   sits clear of the title text (visible right-of-centre, below FLY).
3. "The play shot's hard bank looks dramatic, but the speed lines and trails
   crowd the frame and the sun is half-hidden behind a tower, so the shot
   reads busy rather than fast."
   → Fixed: play pre-sim shortened (60 steps) — level approach, ring frames
   the sun, plane level with trails.

## POLISH — plane visibility + phone legibility + mobile check (26 Nov 2026, ~16:00 WITA)
Polish builder subagent (session e21b3f2a-d4e3-44d4-a8ac-8cdaf3305db9, parent
main agent 7bec23f1). User brief 15:45, theme/gameplay/scoring/title/pitch
UNCHANGED. No commit/push/bundle/check/submit — parent does that after Gas.

### What changed
1. **Plane visibility** (`game/src/plane.js`, `game/src/main.js`)
   - Jet mesh scaled ×0.72 (−28%): was ~35% of screen width, now ~20%;
     silhouette (wings, tail fin, canopy, engine block) unchanged, banking
     animation and wingtip trails untouched. Collision is point-based, so
     gameplay/scoring are untouched.
   - Chase camera pulled back 11 → 14 units and up 3.4 → 4.8, look-at
     +0.5 → +1.2 (jet sits lower in frame); the next ring now stays fully
     visible, worst case portrait.
2. **Text legibility, phone-first** (`game/index.html`, `game/src/hud.js`)
   - Title: tagline 15→16px, control hints 14→16px, BEST 14→16px, hint
     13→16px with brighter colour (#9d8fc9 → #d8ccf5); hint text shortened
     ("90s · rings add +2s · combos multiply · crash −5s").
   - Run Over: stats rebuilt from one cramped 15px line into a spaced 2×2
     grid (26px values / 13px labels: RINGS, BEST COMBO, NEAR MISS, TOP
     SPEED), score 64px + rank 92px stay the focus, all inside a subtle
     dark panel (rgba(8,4,24,0.78) + cyan border). Redundant `finalCombo`
     line removed (duplicated the grid's BEST COMBO cell).
   - HUD: on ≤640px the toast moves to the top (below the HUD row, clear of
     the plane) and wraps instead of overflowing; low-alt banner lifted to
     bottom:215px, clear of the joystick zone; popup drops to top:26%.
     Start-of-run toast is now touch-aware (short text, no keyboard hints
     on phones). DPR cap (≤2) was already in main.js — verified, no change.
3. **Mobile check** (new script `/tmp/test-neon-polish.mjs`, 22 checks)
   - 360×740 portrait + 740×360 landscape: no overflow/scroll; touch
     buttons clear of all HUD blocks. Two real bugs found and fixed by the
     checks: (a) low-alt banner overlapped the joystick hint circle
     (moved up); (b) BOOST/ROLL buttons sat 4px into the bottom-right HUD
     on short screens (new `@media (max-height: 420px)` lifts buttons to
     bottom:100px, joystick hint to 110px). Visual review also caught the
     landscape toast covering the plane for its first 4.6s — fixed by
     moving it to top:112px on short screens (popup to top:44%).
   - FPS under headless SwiftShader: 4.3 fps — software-renderer limit,
     not the game (loop advances, timer runs); DPR cap + small particle
     pool (600) + 90 speed lines keep real devices smooth. No particle or
     DPR reduction was needed.
4. **Screenshots re-taken** (deterministic `?shot=` modes, 1280×720, JPEG q80)
   - 1-ring.jpg 105,903 B sha 4d57e399…f729449; 2-play.jpg 106,529 B sha
     b5c97f94…262c81; 3-start.jpg 64,949 B sha d6a1144b…4b902e; 4-end.jpg
     57,356 B sha 1031b100…57 (all ≤256 KiB).
   - First capture came out 1280×520 (bare --window-size leaves the
     headless shell 200px short); fixed with
     Emulation.setDeviceMetricsOverride 1280×720 in /tmp/shots-neon.mjs.

### Blind judging (2 rounds, one sentence each)
1. "The cover shows the jet small and centred in the magenta gate with the
   striped sun and full HUD, but a giant cropped orange arch in the
   top-left corner competes with the hero gate."
   → Tried 4 other ring-shot seeds (3, 11, 21, 42): all worse — hard
   banking, giant cropped rings, speed-line clutter. Seed 7 stays.
2. "Across five ring-shot seeds, seed 7 frames the jet level inside the
   gate with the sun and full HUD best, so the cover stays as shot."

### Retest — all green on the final build
- Full suite `/tmp/test-neon.mjs`: **22/22 PASS** (boot, FLY, flight,
  steer, boost, roll, pause/resume, blur pause, R restart, game over +
  best save, mobile 390×844 touch + joystick + ROLL, zero console errors).
- Polish suite `/tmp/test-neon-polish.mjs`: **22/22 PASS** (overflow,
  ≥16px title text, button/HUD clearance portrait + landscape, toast +
  low-alt placement, run-over panel + 22px stats, FPS loop alive, zero
  console errors).
- Phone screenshots viewed: title / play / run-over at 360×740 and
  gameplay at 740×360 — all text readable, plane small and clear with
  rings ahead. (The big cyan squares in the portrait play shot are the
  normal ring-burst particles mid-flight, not a defect; the staged
  ?shot= frames are clean.)
- `main.ts` runs clean twice to different dirs: **byte-identical**
  outputs (12 game entries, 4 screenshots, dossier 532,973 B < 1.5 MiB,
  /output 15 entries). Kit caps all met.

## Status / what is left
- **NOT committed, NOT pushed.** The `git init` + `gh repo create neon-rush`
  exec tripped a system execution-risk check (26 Nov ~15:11). Per the
  standing pattern, git commands need Udin's fresh plain-words approval.
  The repo https://github.com/KembangPasir-dot/neon-rush WAS verified live
  by the parent (created 15:10 WITA); the local files are still uncommitted
  and no commit sha exists yet.
- **NOT bundled, NOT checked, NOT submitted** — parent does that after
  Udin's Gas.
- Local preview server still running: http://localhost:8080/ (serve.ts).
- Deadline: 28 Nov 2026 08:57 WITA. ~4,054 submissions already.

## Proposed submission copy
- **Title:** NEON RUSH — Sunset Run
- **One-line pitch:** Outrun the sunset. Thread the rings. Chase the score.
- **Description:** A fast neon-synthwave arcade flight game: 90-second runs
  through a glowing canyon, threading ring gates to build combos, dodging
  towers and drones, boosting on a draining meter, with a synthwave
  soundtrack that layers up as your combo climbs. Controls: WASD/arrows
  steer, Shift boost, Space barrel roll, P pause, R instant restart;
  mouse hold-to-steer; on mobile, left-thumb joystick + ROLL/BOOST buttons.
  No install, no network — just fly.
