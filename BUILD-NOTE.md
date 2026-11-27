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

## UPGRADE v3 — mission flow + real flight model (27 Nov 2026)
Upgrade builder subagent (session ed01c42c, parent main agent 7bec23f1).
Why: the live entry (claim AF-99XSE, submission 01a216eb) landed Round 1 at
**#5,069 of 6,258, judge 0.388087** — a resubmit before entries close
28 Nov 08:57 WITA. Two user briefs merged (neither cancels the other):
the 7-priority upgrade brief (09:10) + the Claude.ai-review flight brief
(09:29). No commit/push/bundle/check/submit — parent does that after Gas.

### What changed — brief 1 (7 priorities)
1. **Instant start** — title: name, one-line tagline ("Fly 8 rings. Land
   the runway. Beat the sunset."), ONE big FLY button, "Drag to steer"
   hint; full controls moved into a small "?" panel.
2. **Mobile-first** — drag-anywhere steering (dead zone + easing),
   auto-boost + large on-screen button, portrait + landscape,
   keyboard/mouse secondary, `touch-action: none`.
3. **Speed feel** — edge speed lines intensifying with speed, wider FOV +
   camera shake on boost, smooth banking, soft-lag chase cam, parallax
   grid/stars/pulsing sun.
4. **Feedback** — ring ting (pitch rises with combo), particle burst,
   screen flash, "+score" popup, combo pulses at x5/x10/x15, soft miss
   sound, crash slow-mo + shake + explosion + −5s, synthwave WebAudio
   music + mute button.
5. **Readability** — neon-outlined buildings, next ring glows/bigger when
   close, off-screen guide arrow, large high-contrast HUD.
6. **Fair difficulty** — easy first 10s (gentle ring line), then speed /
   spacing / obstacle density rise; bonus ring chains; RUSH power-up
   (invincible + ×2 score).
7. **End screen** — score, best via try/catch localStorage, rank
   Rookie/Ace/Legend, big PLAY AGAIN.
### What changed — brief 2 (flight feel + mission)
- **Flight model:** pitch/roll/yaw with smooth inertia; throttle
  (Shift/Ctrl, on-screen slider on mobile — BOOST button kept);
  banks into turns; loses speed when climbing; stall warning below
  32 speed (controls ×0.5, nose drops, STALL badge + beep).
- **Cockpit HUD (neon):** altitude (ft), speed (kt), heading tape top,
  small artificial-horizon circle, throttle bar, "RINGS n/8", timer —
  merged with the large score/combo, small on a phone.
- **3D depth:** 14 low-poly neon mountains/canyon walls both sides,
  visible runway (z −680..−1000), glowing ring checkpoints with a guide
  beam to the next ring (cyan) / runway threshold (gold in approach).
- **Mission flow:** "Fly 8 rings, then land on the runway." 90s timer is
  the mission clock; all 8 rings resolved (passed or missed — a missed
  ring never bricks the mission) opens the final approach; smooth
  touchdown before the timer ends = MISSION COMPLETE + landing grade
  (PERFECT |vy|≤4, |x|≤4, speed≤78 / GOOD / ROUGH) + time bonus
  (ceil(timer)×50) + grade bonus (2000/1200/600); timer expiry ends the
  run with the score so far + rank title. Crash still −5s + slow-mo.
  Contextual hints at the bottom ("Next ring ahead", "Final approach,
  ease her down"). Ground strike outside the runway during approach =
  crash + respawn at the fix; flying past the runway end = go-around
  respawn, no −5s.
- **Title / thumbnail:** jet parked on the runway, camera slow sway;
  first frame is the thumbnail. Hero gameplay shot shows HUD + ring +
  scenery in one frame (see below).

### Build layout change
- `game/index.template.html` + `game/src/*.js` are inlined by the new
  dev-only `inline-build.mjs` into single-file `game/index.html`
  (**759,434 bytes**, < 1 MiB cap, 0 `<script src>`, 2 script tags).
  `main.ts` unchanged and still works (requires `game/vendor/three.min.js`
  to exist — kept even though index.html inlines it).
- **inline-build.mjs bug found + fixed:** `String.replace(search, str)`
  interprets `$` patterns in the replacement; three.min.js contains one
  `$&`, which re-inserted a copy of the vendor tag inside the inlined
  code. Fix: both replacements use a function replacer `() => replacement`.
- Template bug fixed: the `#toast` rule was missing its selector.

### Headless tests — 111/111 PASS, twice in a row (CDP, Chrome 158)
Script: /tmp/test-neon-v3.mjs (111 checks). Boot, FLY, flight, steer,
throttle (Shift/Ctrl + slider), boost, roll, pause/resume, blur pause,
R restart, ring pass (+score, popup, flash), combo x5 + pulse, miss
resets combo, tower crash (−5s, slow-mo), guide arrow off-screen,
RUSH star, all 8 rings → approach, ground-strike crash (−5s, respawn at
fix), go-around past runway end, PERFECT landing (grade + time bonus +
score 11,990), timer-expiry end (rank title), replay, portrait +
landscape, zero console errors.
- **Three test bugs found and fixed (game code was correct throughout):**
  (a) crash −5s: the test read the timer AFTER the teleport eval, so it
  read the already-deducted value — verified with /tmp/debug-crash.mjs
  (timer 89.65 → 84.55 on the crash frame); fix: read the timer BEFORE
  the teleport. (b) guide arrow: the post-crash flight passes the last
  rings and flips the mission into approach (no next ring left), and a
  teleport mid-tumble is overwritten by the respawn — fix: guide test
  runs right after the first ring pass, camera snapped to the teleport.
  (c) headless fps is NOT a fixed ~4fps: it varies up to ~37fps, so the
  plane covers ~120 units/s of wall time and a fixed 800ms wait lets it
  fly past the ring — fix: wait for a single frame (plane z moves),
  not wall time.
- Headless SwiftShader ~4–37 fps (software renderer, varies with load);
  game dt clamped to 0.05 so game time runs slower than wall time —
  waits poll game state, never wall-clock.

### Screenshots re-taken (deterministic `?shot=` modes, 1280×720, JPEG q80)
Script: /tmp/shots-neon.mjs (rewritten — the old one was lost to the VM
restart). 1-ring.jpg 113,353 B sha 6f7f285c…ffc76; 2-play.jpg 124,702 B
sha 85e052b5…fe833a; 3-start.jpg 60,045 B sha d77e68f4…6ed9ed6;
4-end.jpg 75,246 B sha 06004ae6…a4ad94f76 (all ≤256 KiB). Viewed:
hero 2-play shows HUD + ring + scenery in one frame (score 2,450,
combo x5, RINGS 3/8, heading tape, horizon, 200 kn, throttle 70%,
big pink ring + guide beam, sun, neon buildings, speed lines);
1-ring shows the jet threading the gate (5,200, x8, RINGS 7/8);
3-start is a clean title (name, tagline, FLY, "Drag to steer", "?");
4-end is MISSION COMPLETE / PERFECT / 11,990 / PLAY AGAIN.

### Blind judging (2 rounds, one sentence each)
1. "A synthwave sunset flight game where a jet threads glowing neon rings
   through a neon canyon city, with a full cockpit HUD showing score,
   rings, speed, and throttle."
2. "A neon flight game in which the player flies a jet through eight
   glowing ring gates and lands on a runway, with speed lines, a striped
   sun, and a cockpit-style HUD."
Both rounds read it as a flight game with a landing mission, not just a
ring game — the brief-2 goal. No change needed.

### Retest — all green on the final build
- Full v3 suite `/tmp/test-neon-v3.mjs`: **111/111 PASS, twice in a row**
  (second run confirms the guide/crash fixes are stable, not flaky).
- `main.ts` runs clean twice to different dirs: **byte-identical**
  outputs (13 game entries, 4 screenshots, /output 2.4 MB).
  Kit caps all met (index.html 759,434 B < 1 MiB; screenshots ≤256 KiB).
- **NOT committed, NOT pushed, NOT bundled, NOT checked, NOT submitted**
  — parent does that after Udin previews + Gas. Resubmit deadline:
  28 Nov 2026 08:57 WITA. Do NOT commit `transcripts.tar.gz`
  (untracked kit-bundle artifact, 716 KB — not part of the repo).

## v3 POLISH PASS (27 Nov ~11:00–11:20 WITA) — commit 9a3af2b
Review of the v3 hero shot (2-play.jpg) found 4 real issues; all verified
against the actual screenshot before fixing. Polish only — mission flow,
flight model, cockpit HUD and all v3 features untouched.

### Fix 1 — HUD too small + score/timer clipped at the edges
`game/index.template.html`: score 42→50px, timer 40→48px, speed 30→38px,
alt/hdg 14→19px, missionHint 13→14px; HUD safe insets 16→28px (sides),
top 14→18px; toast/mute repositioned (see Fix 2). `game/src/hud.js`:
drawTape canvas 440×56→560×72, label font 20→26px, ticks/caret enlarged.
Phone sizes bumped too (score 34→40px, timer 32→38px, speed 26→32px,
alt 12→15px). Verified: score rect [28,220] and timer rect [1155,1252]
at 1280×720 — fully inside the frame, ≥28px from the edges; same at
portrait 390×844 and landscape 844×390 (≥4px margins).

### Fix 2 — control hint pill covered the flight path
Toast moved bottom-centre → top:126px under the cockpit, fainter
(opacity 0.92), 4600→3000ms at startRun; muteBtn moved to top:98px /
right:28px. Toast REMOVED from all staged `_applyShot` frames, so the
hero shot has no pill on the runway/ring line. Test confirms: toast at
top on start, opacity <0.5 after ~3.6s, flight path clear.

### Fix 3 — buildings still dark, neon outlines not prominent enough
`game/src/world.js`: wall faces 0x1c0b33/0x2a0f45→0x2f1849/0x3d1f5c,
tower face 0x241040→0x3a1c60, mountain faces lightened; edge opacities
→1.0 (walls) / 0.95 (towers) / 0.8 (mountains); plus a second additive
glow LineSegments (opacity 0.4, scale 1.04–1.05) on walls and towers.
Viewed: pink/cyan edges now read clearly against the purple sky without
drowning the scene.

### Fix 4 — hero re-staged: ring + HUD + runway in one frame
`game/src/main.js`: the 'play' shot is now the late-mission hero —
rings=7, hero ring moved to (0,20,−650), plane parked (0,22,−590),
other rings deactivated, spawnCursor=−2000, missionSpawned=8, 12-step
pre-sim. One frame shows the hero gate dead ahead, the full cockpit HUD
(score 2,450, timer 1:02, RINGS 7/8, tape, horizon, 189 kn), and the
runway glowing on the horizon past the ring (threshold −680). Viewed at
full size and reads at thumbnail size. shots.json labels updated to the
v3 reality (was: stale v1 "combo x9 / rank A / 8,740 points").

### Retest — v3-fix suite `tmp/test-neon-v3fix.mjs` (CDP, Chrome 158)
**39/39 PASS, zero console errors** (desktop 1280×720 + portrait
390×844 + landscape 844×390): HUD sizes, no clipping, toast top +
faded, clock advances, plane flies, A steers, ring pass scores, combo
shows, tower crash −5s, PERFECT landing → MISSION COMPLETE, R replay,
timer expiry → RUN OVER, P pause/resume, DPR capped at 2 (emulated
DSF 3). Two test-assertion fixes, not game bugs: the mission timer
cannot be asserted to fall monotonically (straight flight threads +1s
pickups, so it often rises net — verified in a debug run), and the
timer-expiry test parks the plane at y=80 clear of pickups.
Screenshots re-shot with `tmp/shots-neon-v3fix.mjs` (deterministic
?shot= modes, 1280×720, JPEG q80): 1-ring.jpg 124,997 B sha
52f5b998…f4; 2-play.jpg 109,104 B sha 44ddabb1…da2; 3-start.jpg 60,733 B
sha 43dd7262…31; 4-end.jpg 74,118 B sha ed1fb40f…45 (all ≤256 KiB).
`main.ts` run twice: **byte-identical**. Regenerated index.html
**761,783 B** (< 1 MiB cap), 0 `<script src>`.
Commit 9a3af2b "NEON RUSH v3 polish: bigger HUD, safe margins, top
toast, brighter neon", pushed 2b1618f..9a3af2b. Dev scripts live in
`tmp/` (untracked, kept out of the repo like /tmp before — but durable
in the workdir now, since /tmp is wiped on restart).
Pages check: at push +2 min the Pages edge still served the OLD build
(759,434 B, Last-Modified 02:17:25 UTC, 0 polish markers,
Cache-Control max-age=600) — re-check after the cache clears.
Live-link phone-style test (title → tap FLY → starts immediately) and
the make.fun bundle/check/submit are for the parent after Udin previews
+ Gas. Resubmit deadline: 28 Nov 2026 08:57 WITA. Do NOT commit
`transcripts.tar.gz` (untracked kit-bundle artifact — not part of the
repo).

## HERO RE-STAGE (27 Nov ~11:20–11:35 WITA) — parent review of the polish hero
The 9a3af2b hero (2-play.jpg) regressed: the ring read as a faint ~100px
circle around the sun and the jet as a speck — "empty purple city with a
sun" at thumbnail size, worse than the v3 hero. Root cause, found by
measuring: `_camPos` starts at (0,24,14), ~630 units from a hero staged at
z=-616, and at headless frame rates the damped chase camera (lambda 5.5)
never catches up before the screenshot — so the ring sat ~100+ units from
the camera. Moving the plane closer (z=-590 → -616, 25-step pre-sim,
ending 9 units short of the gate) alone did NOT fix it.
Fix (`game/src/main.js` only): new `Game.prototype._snapCamera()` mirrors
the live loop's chase target (14 behind, 4.8 above, 2.2 lean) and is called
at the end of `_applyShot`, gated on `this.shot.mode` — staged frames only,
normal play (including the title fly-in) untouched. Viewed new 2-play.jpg:
big bright-pink ring ~460px wide (~36% of frame width) with the jet clearly
threading it, full HUD (2,450 / 1:02 / RINGS 7/8 / x5 / tape / horizon /
198 kn / throttle 70%), sun behind the ring, runway dashes visible through
the gate, hint text at top. 1-ring/3-start/4-end re-shot and viewed — all
as intended. Retest: v3-fix suite **39/39 PASS, zero console errors**
(desktop + portrait + landscape). `main.ts` twice: **byte-identical**.
Regenerated index.html **763,245 B** (< 1 MiB cap), 0 `<script src>`.
