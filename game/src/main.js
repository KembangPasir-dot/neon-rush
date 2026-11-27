// NEON RUSH — game entry: state machine, loop, scoring, chase camera,
// deterministic ?shot= modes for screenshots, resize/blur handling.
(function (global) {
  'use strict';

  var util = global.NR.util;
  var THREE = global.THREE;

  var RUN_TIME = 90;
  var BEST_KEY = 'neon-rush-best';
  var MISSION_RINGS = global.NR.MISSION_RINGS || 8;
  var APPROACH_FIX = { x: 0, y: 28, z: -500 }; // go-around respawn point

  function Game() {
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x2a0a4a, 0.0075);
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
    this.scene.add(new THREE.AmbientLight(0x8a6bbf, 0.9));
    var sun = new THREE.DirectionalLight(0xffb347, 1.1);
    sun.position.set(-40, 80, -100);
    this.scene.add(sun);
    var fill = new THREE.DirectionalLight(0x00e5ff, 0.35);
    fill.position.set(60, 20, 80);
    this.scene.add(fill);

    this.world = new global.NR.World(this.scene);
    this.plane = new global.NR.Plane(this.scene);
    this.effects = new global.NR.Effects(this.scene);
    this.audio = new global.NR.AudioEngine();
    this.input = new global.NR.Input(this.canvas);
    this.hud = new global.NR.Hud();
    this.hud.wireTouch(this.input);
    this.hud.wireThrottle(this.input);
    this.hud.wireMute(this.audio);
    this.hud.wireHelp();

    this.state = 'title';
    this.time = 0;
    this.elapsed = 0;
    this.timer = RUN_TIME;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.rings = 0;
    this.nearMiss = 0;
    this.topSpeed = 0;
    this.stage = 1;
    this.lowAltAcc = 0;
    this.rushTimer = 0; // seconds of RUSH power-up left
    this.timeScale = 1; // crash slow-motion eases back to 1
    this._slowmoT = 0;
    this.phase = 'rings'; // 'rings' -> 'approach' (8 rings done) -> 'landed'
    this.landingGrade = '';
    this.timeBonus = 0;
    this._stallBeepT = -1;
    this.ringsResolved = 0; // rings flown through OR missed: all 8 resolved
    this.best = 0;
    try {
      this.best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
    } catch (e) {
      this.best = 0;
    }
    this.shot = this._readShot();
    this.seed = this.shot.seed || 1;
    this._camPos = new THREE.Vector3(0, 24, 14);
    this._lookAt = new THREE.Vector3();
    this._bindResize();
    this._bindVisibility();
    this.hud.setHi(this.best);
    if (this.hud.isTouch()) this.hud.showTouch(true);
    this._applyShot();
    // Test/debug handle (read-only inspection for automated play-tests).
    window.__neonGame = this;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  Game.prototype._readShot = function () {
    var q = new URLSearchParams(window.location.search);
    return {
      mode: q.get('shot') || '',
      seed: parseInt(q.get('seed') || '1', 10) || 1,
    };
  };

  Game.prototype._bindResize = function () {
    var self = this;
    function onResize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      self.renderer.setSize(w, h, false);
      self.camera.aspect = w / Math.max(1, h);
      self.camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    onResize();
  };

  Game.prototype._bindVisibility = function () {
    var self = this;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && self.state === 'playing') self._pause(true);
    });
    window.addEventListener('blur', function () {
      if (self.state === 'playing') self._pause(true);
    });
  };

  Game.prototype._applyShot = function () {
    var mode = this.shot.mode;
    this.world.reset(this.seed, 0);
    this.plane.reset();
    // Compose the shot: put the nearest ring dead ahead so the plane,
    // the ring and the sun line up in frame.
    var firstRing = this.world.nextRing;
    if (firstRing) {
      firstRing.x = 0;
      firstRing.y = 22;
      firstRing.mesh.position.set(0, 22, firstRing.z);
    }
    if (mode === 'start') {
      // Title: the jet parked on the runway, strip running to the sun —
      // the first frame is the thumbnail, so it has to read as a flight game.
      this.state = 'title';
      this.plane.pos.set(0, 1.2, -720);
      this.plane._applyTransform();
      this.hud.showTitle();
      this.frozen = true; // static composed title view, no autopilot drift
    } else if (mode === 'play' || mode === 'ring') {
      this.state = 'playing';
      this.phase = 'rings';
      this.score = mode === 'ring' ? 5200 : 2450;
      this.combo = mode === 'ring' ? 8 : 5;
      this.bestCombo = this.combo;
      this.rings = 7;
      this.ringsResolved = this.rings;
      this.timer = 62;
      this.input.throttle = 0.7;
      this.hud.setMission('RINGS 7/8');
      this.hud.setHint('Next ring ahead — fly the gate');
      this.hud.showCockpit(true);
      if (mode === 'play') {
        // HERO: the last ring just before the runway threshold, so one
        // frame shows ring + HUD + runway together. Park the plane ~60
        // units short of the ring; the threshold (-680) sits just past
        // it in the lower frame. Clear the other staged rings so the
        // beam and the autopilot aim at this one, and stop the world
        // spawning fresh rings during the short pre-sim.
        var hero = this.world.nextRing;
        if (hero) {
          for (var ri = 0; ri < this.world.rings.length; ri++) {
            var rr = this.world.rings[ri];
            if (rr !== hero) { rr.active = false; rr.resolved = true; rr.mesh.visible = false; }
          }
          hero.x = 0; hero.y = 20; hero.z = -650;
          hero.resolved = false; hero.active = true;
          hero.mesh.visible = true;
          hero.mesh.position.set(0, 20, -650);
          this.world.nextRing = hero;
          this.world.spawnCursor = -2000;
          this.world.missionSpawned = 8;
          this.world._markNextRing();
          // HERO RE-STAGE: park ~34 units short of the gate (like the
          // 'ring' shot) so the 25-step pre-sim ends ~11 short — the ring
          // then spans ~1/3 of the frame width instead of reading as a
          // faint circle around the sun. Runway threshold (-680) stays
          // ~30 past the ring, visible on the horizon through it.
          this.plane.pos.set(0, 22, -616);
        }
      } else {
        // Park the plane just before the next ring for the shot.
        var ring = this.world.nextRing;
        if (ring) {
          this.plane.pos.set(ring.x * 0.6, ring.y + 2, ring.z + 34);
        }
      }
      document.getElementById('title').style.display = 'none';
      // No control-hint toast in staged frames: it used to sit across
      // the flight path at the bottom-centre.
      // Pre-simulate a short autopilot flight so the frame is mid-action
      // (ring burst, trails, combo live), then freeze for the screenshot.
      // Both play and ring stop ~11 units short of the gate: level
      // approach, big ring in frame, jet clearly about to thread it,
      // runway past it. (Play used to stop ~50 short — the ring read as
      // a faint circle around the sun at thumbnail size.)
      for (var s = 0; s < 25; s++) {
        this._updatePlaying(1 / 60, this._autopilot());
      }
      this.frozen = true;
    } else if (mode === 'end') {
      // Mission complete: landed on the runway, grade PERFECT.
      this.state = 'over';
      this.phase = 'landed';
      this.score = 11990;
      this.timer = 0;
      this.landingGrade = 'PERFECT';
      this.timeBonus = 1250;
      this.plane.pos.set(0, 1.2, -800);
      this.plane._applyTransform();
      this.hud.showOver({
        title: 'MISSION COMPLETE', score: 11990, rank: 'PERFECT',
        grade: 'LANDING: PERFECT  ·  TIME BONUS +1,250',
        rows: [
          { v: '8/8', l: 'RINGS' },
          { v: 'x9', l: 'BEST COMBO' },
          { v: '+1,250', l: 'TIME BONUS' },
          { v: '342 kn', l: 'TOP SPEED' },
        ],
        best: 11990, newBest: true,
      });
      this.frozen = true;
    } else {
      this.state = 'title';
      this.plane.pos.set(0, 1.2, -720);
      this.plane._applyTransform();
      this.hud.showTitle();
    }
    // Staged frames only: snap the chase camera to the staged plane.
    // (Normal play never reaches this — shot.mode is empty there — so
    // the title fly-in is untouched.)
    if (this.shot.mode) this._snapCamera();
    this._syncHud();
  };

  // Staged ?shot= frames only: put the chase camera exactly where the
  // live loop would keep it (14 behind, 4.8 above, slight 3/4 lean).
  // Without this the camera starts at (0,24,14) — ~630 units from a hero
  // staged at z=-616 — and at headless frame rates it never catches up
  // before the screenshot, so the ring reads tiny and the jet a speck.
  Game.prototype._snapCamera = function () {
    var heading = this.plane.heading;
    var backX = Math.sin(heading);
    var backZ = Math.cos(heading);
    var rightX = Math.cos(heading);
    var rightZ = -Math.sin(heading);
    var lean = 2.2 + this.plane.bank * 1.5;
    this._camPos.set(
      this.plane.pos.x + backX * 14 + rightX * lean,
      this.plane.pos.y + 4.8,
      this.plane.pos.z + backZ * 14 + rightZ * lean
    );
    this.camera.position.copy(this._camPos);
  };

  Game.prototype._syncHud = function () {
    this.hud.setScore(this.score);
    this.hud.setCombo(this.combo);
    this.hud.setSpeed(this.plane.speed * 3.2);
    this.hud.setThrottle(this.input.throttle * 100);
    this.hud.setAlt(this.plane.pos.y * 40); // feet
    this.hud.setHeading(util.headingDeg(this.plane.heading));
    this.hud.setTimer(this.timer);
    this.hud.drawTape(util.headingDeg(this.plane.heading));
    this.hud.drawHorizon(this.plane.bank, this.plane.pitchAngle);
  };

  Game.prototype.startRun = function () {
    this.audio.init();
    this.audio.click();
    this.input.mouseSteer = false; // never carry a stale mouse steer into a run
    this.input.throttle = 0.7;
    this.world.reset((Math.random() * 1e9) | 0, 0);
    this.plane.reset();
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.rings = 0;
    this.nearMiss = 0;
    this.topSpeed = 0;
    this.elapsed = 0;
    this.timer = RUN_TIME;
    this.stage = 1;
    this.lowAltAcc = 0;
    this.rushTimer = 0;
    this.plane.rush = false;
    this.timeScale = 1;
    this._slowmoT = 0;
    this.phase = 'rings';
    this.landingGrade = '';
    this.timeBonus = 0;
    this._stallBeepT = -1;
    this.ringsResolved = 0;
    this.hud.setRush(false, 0);
    this.hud.setGuide(false, 0, 0, 0);
    this.hud.setMission('RINGS 0/8');
    this.hud.setHint('Next ring ahead — fly the gate');
    this.hud.setStall(false);
    this.hud.showCockpit(true);
    this.state = 'playing';
    document.getElementById('title').style.display = 'none';
    this.hud.hideOver();
    this.hud.showPause(false);
    // POLISH: on touch the keyboard hints are wrong and the long toast
    // overflowed a 360px screen — keep it short on phones. The toast
    // rides at the top now and fades after 3s, never on the flight path.
    this.hud.toast(this.hud.isTouch()
      ? 'Drag to steer — fly 8 rings, then land!'
      : 'Drag or WASD to steer — SHIFT/CTRL throttle · SPACE roll', 3000);
    this._syncHud();
  };

  Game.prototype._pause = function (on) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.state = on ? 'paused' : 'playing';
    this.hud.showPause(on);
  };

  Game.prototype._gameOver = function () {
    this.state = 'over';
    var score = Math.round(this.score);
    var rank = score >= 12000 ? 'LEGEND' : score >= 8000 ? 'ACE' : score >= 4000 ? 'PRO' : 'ROOKIE';
    var newBest = score > this.best;
    if (newBest) {
      this.best = score;
      try {
        window.localStorage.setItem(BEST_KEY, String(score));
      } catch (e) { /* storage unavailable; best stays in memory */ }
    }
    this.hud.setHi(this.best);
    this.hud.showOver({
      title: 'RUN OVER', score: score, rank: rank, grade: '',
      rows: [
        { v: this.rings + '/8', l: 'RINGS' },
        { v: 'x' + this.bestCombo, l: 'BEST COMBO' },
        { v: String(this.nearMiss), l: 'NEAR MISS' },
        { v: Math.round(this.topSpeed) + ' kn', l: 'TOP SPEED' },
      ],
      best: this.best, newBest: newBest,
    });
  };

  // Ring 8 is through: the mission is now the landing. The world stops
  // spawning rings and beacons the runway; crashes respawn at the fix.
  Game.prototype._enterApproach = function () {
    this.phase = 'approach';
    this.world.enterApproach();
    this.plane.respawnPoint = new THREE.Vector3(APPROACH_FIX.x, APPROACH_FIX.y, APPROACH_FIX.z);
    this.hud.setMission('FINAL APPROACH');
    this.hud.setHint('Final approach — ease her down');
    this.hud.toast('FINAL APPROACH — land on the runway', 4200);
    this.audio.approach();
  };

  // Touchdown on the runway: grade the landing, add the time bonus,
  // and show MISSION COMPLETE.
  Game.prototype._landed = function () {
    var vy = this.plane.vy; // negative = descending
    var ax = Math.abs(this.plane.pos.x);
    var spd = this.plane.speed;
    var grade = (Math.abs(vy) <= 4 && ax <= 4 && spd <= 78) ? 'PERFECT'
      : (Math.abs(vy) <= 9 && ax <= 7) ? 'GOOD' : 'ROUGH';
    var gradeBonus = grade === 'PERFECT' ? 2000 : grade === 'GOOD' ? 1200 : 600;
    var timeBonus = Math.ceil(this.timer) * 50;
    this.timeBonus = timeBonus;
    this.landingGrade = grade;
    this.phase = 'landed';
    this.score += gradeBonus + timeBonus;
    var score = Math.round(this.score);
    var newBest = score > this.best;
    if (newBest) {
      this.best = score;
      try {
        window.localStorage.setItem(BEST_KEY, String(score));
      } catch (e) { /* storage unavailable */ }
    }
    this.hud.setHi(this.best);
    this.state = 'over';
    this.audio.land();
    this.effects.burst(this.plane.pos, 0xffd166, 60, 20);
    this.effects.flash('rgba(255,209,102,0.35)', 0.5);
    this.hud.showOver({
      title: 'MISSION COMPLETE', score: score, rank: grade,
      grade: 'LANDING: ' + grade + '  ·  TIME BONUS +' + util.fmtInt(timeBonus),
      rows: [
        { v: this.rings + '/8', l: 'RINGS' },
        { v: 'x' + this.bestCombo, l: 'BEST COMBO' },
        { v: '+' + util.fmtInt(timeBonus), l: 'TIME BONUS' },
        { v: Math.round(this.topSpeed) + ' kn', l: 'TOP SPEED' },
      ],
      best: this.best, newBest: newBest,
    });
  };

  // One crash path for tower hits and ground strikes: combo gone, -5s,
  // slow-motion, shake, explosion, sound. Respawn is the plane's job
  // (approach crashes go back to the fix).
  Game.prototype._doCrash = function (popupText) {
    if (!this.plane.crash()) return false;
    this.combo = 0;
    this.audio.setCombo(0);
    this.timer = Math.max(0, this.timer - 5);
    // Brief slow-motion: the world drops to 35% speed for ~0.55s.
    this._slowmoT = 0.55;
    this.timeScale = 0.35;
    this.effects.burst(this.plane.pos, 0xff7a3d, 70, 26);
    this.effects.burst(this.plane.pos, 0xff2d78, 40, 18);
    this.effects.shake(1.1);
    this.effects.flash('rgba(255,45,45,0.4)', 0.6);
    this.audio.crash();
    this.hud.popup(popupText, 'miss');
    return true;
  };

  // Flew past the runway without landing: back to the fix, no -5s —
  // the lost time is the penalty.
  Game.prototype._goAround = function () {
    this.plane.teleportTo(APPROACH_FIX.x, APPROACH_FIX.y, APPROACH_FIX.z);
    this.hud.toast('MISSED APPROACH — going around', 2600);
    this.audio.miss();
  };

  // Autopilot for the ?shot= modes: steer at the next ring.
  Game.prototype._autopilot = function () {
    var ring = this.world.nextRing;
    var out = { roll: 0, pitch: 0, throttle: 0.7, boost: false, rollPressed: false, pausePressed: false, restartPressed: false, mutePressed: false, anyPressed: false };
    if (!ring) return out;
    var dx = ring.x - this.plane.pos.x;
    var dy = ring.y - this.plane.pos.y;
    out.roll = util.clamp(dx * 0.03, -1, 1);
    out.pitch = util.clamp(-dy * 0.03, -1, 1);
    return out;
  };

  Game.prototype._loop = function (t) {
    requestAnimationFrame(this._loop);
    var rawDt = Math.min(0.05, (t - (this._lastT || t)) / 1000 || 0.016);
    this._lastT = t;
    if (rawDt <= 0 || Number.isNaN(rawDt)) rawDt = 0.016;
    // Crash slow-motion: the world runs at 35% speed for ~0.55s, then
    // eases back to full speed. The timer slows too — a real breather.
    if (this._slowmoT > 0) {
      this._slowmoT -= rawDt;
      this.timeScale = 0.35;
    } else if (this.timeScale < 1) {
      this.timeScale = Math.min(1, this.timeScale + rawDt * 2.5);
    }
    var dt = rawDt * this.timeScale;
    this.time += dt;
    var input = this.input.poll(dt);
    if (input.mutePressed) {
      this.audio.init();
      this.hud.setMutedLabel(this.audio.toggleMuted());
    }

    // ?shot= modes freeze after staging: the screenshot shows the staged
    // frame, not whatever the live loop drifted to.
    if (!this.frozen) {
      if (this.state === 'title') {
        if (input.anyPressed || input.restartPressed) {
          this.startRun();
        } else {
          // Parked on the runway: the world stays alive (sun pulse, ring
          // spin) behind the title, the jet does not drift away.
          this.world.update(dt, this.plane.pos.z, 1, this.time);
          this.effects.update(dt, this.plane, false, 0.2, this.time);
        }
      } else if (this.state === 'playing') {
        if (input.restartPressed) {
          this.startRun();
        } else if (input.pausePressed) {
          this._pause(true);
        } else {
          this._updatePlaying(dt, input);
        }
      } else if (this.state === 'paused') {
        if (input.pausePressed || input.anyPressed) this._pause(false);
        if (input.restartPressed) this.startRun();
      } else if (this.state === 'over') {
        if (input.restartPressed || input.anyPressed) this.startRun();
        this.world.update(dt, this.plane.pos.z, 1, this.time);
        this.effects.update(dt, this.plane, false, 0, this.time);
      }
    }

    // Chase camera (all states): behind and above the plane, FOV kick on boost.
    // POLISH: pulled further back (11 -> 14) and higher (3.4 -> 4.8) with
    // the smaller jet, so the next ring stays fully in frame — especially
    // in portrait, where the old framing let the jet cover the gate.
    // UPGRADE: softer lag (damp 7 -> 5.5) so the camera trails the jet,
    // and it leans with the bank — speed you can feel.
    var heading = this.plane.heading;
    var backX = Math.sin(heading);
    var backZ = Math.cos(heading);
    // Slight lateral offset: the jet reads in 3/4, not dead behind.
    var rightX = Math.cos(heading);
    var rightZ = -Math.sin(heading);
    var lean = 2.2 + this.plane.bank * 1.5;
    var target = new THREE.Vector3(
      this.plane.pos.x + backX * 14 + rightX * lean,
      this.plane.pos.y + 4.8,
      this.plane.pos.z + backZ * 14 + rightZ * lean
    );
    this._camPos.x = util.damp(this._camPos.x, target.x, 5.5, dt);
    this._camPos.y = util.damp(this._camPos.y, target.y, 5.5, dt);
    this._camPos.z = util.damp(this._camPos.z, target.z, 5.5, dt);
    var shake = this.effects.shakeOffset(this.time);
    this.camera.position.set(
      this._camPos.x + shake.x,
      this._camPos.y + shake.y,
      this._camPos.z
    );
    // On the title screen, aim left of the plane so the jet sits clear of
    // the centred title text and FLY button. Look slightly above the jet
    // (+1.2) so it sits lower in the frame and the rings ahead stay clear.
    // A slow sway keeps the title alive without moving the parked jet.
    var titleShift = this.state === 'title' ? 10 + Math.sin(this.time * 0.25) * 8 : 0;
    this._lookAt.set(
      this.plane.pos.x - backX * 20 - rightX * titleShift,
      this.plane.pos.y + 1.2,
      this.plane.pos.z - backZ * 20 - rightZ * titleShift
    );
    this.camera.lookAt(this._lookAt);
    // Wider FOV at speed and on boost: the world rushes past.
    var targetFov = 64 + (this.plane.boosting ? 16 : 0) + this.plane.speedNorm() * 6;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = util.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
    this._updateGuide();
    this._updateBeam();
    this.audio.update(this.plane.speedNorm(), this.plane.boosting);
    this.renderer.render(this.scene, this.camera);
  };

  // Guide beam: a line from the jet to the next target — the next ring
  // while flying the gates, the runway threshold on final approach.
  // Hidden on title / pause / game-over.
  Game.prototype._updateBeam = function () {
    // Frozen ?shot= frames keep the beam: the hero shot shows the guide
    // line to the next ring. Title / pause / game-over hide it.
    if (this.state !== 'playing') {
      this.world.setBeam(null, null, 0, false);
      return;
    }
    if (this.phase === 'approach' || !this.world.nextRing) {
      this.world.setBeam(
        this.plane.pos,
        { x: 0, y: 2, z: this.world.runway.zStart },
        0xffd166, true
      );
    } else {
      this.world.setBeam(this.plane.pos, this.world.nextRing, 0x00e5ff, true);
    }
  };

  // Off-screen ring guide: project the next ring; if it is out of frame,
  // show a chevron at the screen edge pointing at it.
  Game.prototype._updateGuide = function () {
    var ring = this.world.nextRing;
    if (this.phase === 'approach') {
      // On final approach the chevron points at the runway threshold.
      ring = { x: 0, y: 2, z: this.world.runway.zStart, active: true };
    }
    if (!ring || !ring.active || this.state !== 'playing' || this.frozen) {
      this.hud.setGuide(false, 0, 0, 0);
      return;
    }
    var v = new THREE.Vector3(ring.x, ring.y, ring.z).project(this.camera);
    var off = v.z > 1 || v.x < -1 || v.x > 1 || v.y < -1 || v.y > 1;
    if (!off) {
      this.hud.setGuide(false, 0, 0, 0);
      return;
    }
    var cx = util.clamp(v.x, -0.92, 0.92);
    var cy = util.clamp(v.y, -0.88, 0.88);
    var px = (cx * 0.5 + 0.5) * window.innerWidth;
    var py = (-cy * 0.5 + 0.5) * window.innerHeight;
    var ang = Math.atan2(-(v.y - cy), v.x - cx) * 180 / Math.PI;
    this.hud.setGuide(true, px, py, ang);
  };

  Game.prototype._updatePlaying = function (dt, input) {
    var self = this;
    this.elapsed += dt;
    this.stage = Math.min(3, 1 + Math.floor(this.elapsed / 30));
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this._syncHud();
      this._gameOver();
      return;
    }
    var events = this.plane.update(dt, input, this.stage,
      this.phase === 'approach' ? 0.6 : 4.5);
    if (events.rolled) {
      this.score += 25;
      this.hud.popup('BARREL +25', 'bonus');
      this.audio.roll();
    }
    this.world.update(dt, this.plane.pos.z, this.stage, this.time);
    this.effects.update(dt, this.plane, this.plane.boosting, this.plane.speedNorm(), this.time);

    // Ring crossings.
    var cross = this.world.checkRingCrossing(this.plane.pos);
    if (cross) {
      this.ringsResolved += 1;
      if (cross.result === 'pass') {
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.rings += 1;
        var gained = 100 * this.combo;
        if (cross.ring.chain) gained = Math.round(gained * 1.5);
        if (this.rushTimer > 0) gained *= 2;
        this.score += gained;
        this.timer = Math.min(99, this.timer + 2);
        this.effects.burst(cross.ring.mesh.position, 0x00e5ff, 42, 16);
        this.effects.burst(cross.ring.mesh.position, 0xff2d78, 24, 11);
        // Every ring flashes the screen briefly — the "ting" you can see.
        this.effects.flash('rgba(0,229,255,0.16)', 0.3);
        this.audio.ring(this.combo);
        this.audio.setCombo(this.combo);
        this.hud.popup('+' + gained + '  ·  x' + this.combo + (cross.ring.chain ? '  CHAIN' : ''), 'ring');
        if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
          this.effects.flash('rgba(255,45,120,0.35)', 0.5);
          this.effects.shake(0.25);
        }
      } else {
        this.combo = 0;
        this.audio.setCombo(0);
        this.audio.miss(); // soft blip: combo gone, no harsh penalty
        this.hud.popup('MISS', 'miss');
      }
      // All 8 rings resolved (passed or missed) opens the final approach:
      // a single miss must never brick the mission.
      if (this.phase === 'rings') {
        if (this.ringsResolved >= MISSION_RINGS) {
          this._enterApproach();
        } else {
          this.hud.setMission('RINGS ' + this.rings + '/8');
        }
      }
    }

    // Hazards.
    var hazard = this.world.checkHazards(this.plane.pos, this.plane.invulnerable > 0);
    if (hazard) {
      if (hazard.type === 'crash') {
        this._doCrash('CRASH!  -5s');
      } else if (hazard.type === 'near') {
        this.nearMiss += 1;
        this.score += 50;
        this.effects.shake(0.3);
        this.audio.nearMiss();
        this.hud.popup('NEAR MISS! +50', 'bonus');
      } else if (hazard.type === 'arch') {
        this.score += 25;
        this.hud.popup('ARCH +25', 'bonus');
        this.audio.pickup();
      }
    }

    // Final approach: the runway is the only safe ground.
    if (this.phase === 'approach' && this.state === 'playing') {
      if (this.plane.pos.y <= 1.1) {
        // Touching the floor: on the strip = touchdown, elsewhere = crash.
        var rw = this.world.runway;
        var onStrip = Math.abs(this.plane.pos.x) <= rw.halfWidth + 1
          && this.plane.pos.z <= rw.zStart + 4
          && this.plane.pos.z >= rw.zEnd;
        if (onStrip) {
          this._landed();
          return;
        }
        if (this._doCrash('GROUND STRIKE!  -5s')) {
          this.hud.toast('Off the runway — go around', 2600);
        }
      } else if (this.plane.pos.z < this.world.runway.zEnd - 10) {
        // Flew past the runway without landing: back to the fix.
        this._goAround();
      }
    }

    // Stall warning: flashing badge + a low beep about twice a second.
    var stalling = this.plane.stall;
    this.hud.setStall(stalling);
    if (stalling && this.time - this._stallBeepT > 0.6) {
      this._stallBeepT = this.time;
      this.audio.stall();
    }

    // Pickups.
    var pick = this.world.checkPickups(this.plane.pos);
    if (pick) {
      this.score += 50;
      this.timer = Math.min(99, this.timer + 1);
      this.effects.burst(pick.mesh.position, 0xffb347, 30, 13);
      this.audio.pickup();
      this.hud.popup('+FUEL  +1s', 'bonus');
    }

    // RUSH power-up: 5s invincible, double score, +12% speed.
    var rush = this.world.checkRush(this.plane.pos);
    if (rush) {
      this.rushTimer = 5;
      this.plane.rush = true;
      this.effects.burst(rush.mesh.position, 0xffd166, 50, 20);
      this.effects.flash('rgba(255,209,102,0.35)', 0.5);
      this.audio.rush();
      this.hud.popup('RUSH!  ×2 SCORE', 'bonus');
    }
    if (this.rushTimer > 0) {
      this.rushTimer -= dt;
      // Stay invulnerable for the whole rush.
      this.plane.invulnerable = Math.max(this.plane.invulnerable, 0.15);
      this.hud.setRush(true, this.rushTimer);
      if (this.rushTimer <= 0) {
        this.rushTimer = 0;
        this.plane.rush = false;
        this.hud.setRush(false, 0);
      }
    }

    // Low-altitude trickle.
    var low = this.plane.pos.y < 8;
    this.hud.setLowAlt(low);
    if (low) {
      this.lowAltAcc += 10 * dt;
      if (this.lowAltAcc >= 1) {
        this.score += Math.floor(this.lowAltAcc);
        this.lowAltAcc -= Math.floor(this.lowAltAcc);
      }
    }

    // Top speed + boost SFX edge.
    var knots = this.plane.speed * 3.2;
    if (knots > this.topSpeed) this.topSpeed = knots;
    if (this.plane.boosting && !this._wasBoosting) this.audio.boost();
    this._wasBoosting = this.plane.boosting;

    this._syncHud();
  };

  // Boot once the DOM is ready.
  function boot() {
    try {
      new Game();
    } catch (err) {
      var el = document.getElementById('fatal');
      if (el) {
        el.style.display = 'block';
        el.textContent = 'NEON RUSH could not start: ' + (err && err.message ? err.message : err);
      }
      if (window.console && console.error) console.error(err);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.NR = global.NR || {};
  global.NR.Game = Game;
})(window);
