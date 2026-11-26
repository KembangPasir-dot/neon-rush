# NEON RUSH — Sunset Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/KembangPasir-dot/neon-rush/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/KembangPasir-dot/neon-rush/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**NEON RUSH** is a synthwave arcade flight game for the make.fun bounty
["Make the best flight game"](https://make.fun/bounty/best-flight-game-20261126-0057).
Outrun the sunset: thread neon rings through a glowing canyon at 300 knots,
chain combos, dodge towers and drones, and chase the high score.

Play it: open `game/index.html` from any static server (for example
`node serve.ts`, then http://localhost:8080). No network request, no build
step — every file the game loads lives under `game/`.

## Controls

- **Desktop:** WASD / arrows to steer, **Shift** boost, **Space** barrel roll,
  **P** pause, **R** restart. Mouse steering also works.
- **Mobile:** left-thumb joystick + BOOST and ROLL buttons on the right.

## The game

- 90-second runs: fly through neon rings in sequence, chain them for a
  combo multiplier that resets when you miss one. Every ring adds time.
- Pickups restore boost; obstacles (rock arches, towers, drones) cost you
  a crash — quick respawn, small penalty, never a hard game over.
- Risk pays: near-miss, low-altitude and barrel-roll bonuses.
- Stages escalate every 30 seconds: faster, denser, meaner.
- Rank S/A/B/C on the score screen; best score is saved locally.

Built with Three.js (vendored under `game/vendor/`), all art and sound
procedural — no external assets.

Referral: `kqb6jwx1`
