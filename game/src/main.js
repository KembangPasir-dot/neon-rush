// NEON RUSH — game entry: state machine, loop, scoring, chase camera,
// deterministic ?shot= modes for screenshots, resize/blur handling.
(function (global) {
  'use strict';

  var util = global.NR.util;
  var THREE = global.THREE;

  var RUN_TIME = 90;
  var BEST_KEY = 'neon-rush-best';

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
      this.state = 'title';
      this.hud.showTitle();
      this.frozen = true; // static composed title view, no autopilot drift
    } else if (mode === 'play' || mode === 'ring') {
      this.state = 'playing';
      this.score = mode === 'ring' ? 5200 : 2450;
      this.combo = mode === 'ring' ? 8 : 5;
      this.bestCombo = this.combo;
      this.rings = mode === 'ring' ? 14 : 7;
      this.timer = 62;
      this.plane.boost = 70;
      if (mode === 'ring') {
        // Park the plane just before the next ring for the shot.
        var ring = this.world.nextRing;
        if (ring) {
          this.plane.pos.set(ring.x * 0.6, ring.y + 2, ring.z + 34);
        }
      }
      document.getElementById('title').style.display = 'none';
      this.hud.toast('WASD / ARROWS steer   •   SHIFT boost   •   SPACE roll', 5000);
      // Pre-simulate ~1s of autopilot flight so the frame is mid-action
      // (ring burst, trails, combo live), then freeze for the screenshot.
      // Play stops short of the first ring: level approach, ring in frame
      // but not swallowing the sun.
      for (var s = 0; s < (mode === 'play' ? 60 : 90); s++) {
        this._updatePlaying(1 / 60, this._autopilot());
      }
      this.frozen = true;
    } else if (mode === 'end') {
      this.state = 'over';
      this.score = 8740;
      this.timer = 0;
      this.hud.showOver({
        score: 8740, rank: 'A', rings: 21, bestCombo: 9,
        nearMiss: 4, topSpeed: 342, best: 8740, newBest: true,
      });
      this.frozen = true;
    } else {
      this.state = 'title';
      this.hud.showTitle();
    }
    this._syncHud();
  };

  Game.prototype._syncHud = function () {
    this.hud.setScore(this.score);
    this.hud.setCombo(this.combo);
    this.hud.setSpeed(this.plane.speed * 3.2);
    this.hud.setBoost(this.plane.boost);
    this.hud.setAlt(this.plane.pos.y * 3);
    this.hud.setHeading(util.headingDeg(this.plane.heading));
    this.hud.setTimer(this.timer);
    this.hud.setStage(this.stage);
  };

  Game.prototype.startRun = function () {
    this.audio.init();
    this.audio.click();
    this.input.mouseSteer = false; // never carry a stale mouse steer into a run
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
    this.state = 'playing';
    document.getElementById('title').style.display = 'none';
    this.hud.hideOver();
    this.hud.showPause(false);
    // POLISH: on touch the keyboard hints are wrong and the long toast
    // overflowed a 360px screen — keep it short on phones.
    this.hud.toast(this.hud.isTouch()
      ? 'Fly the rings — chain them for combo!'
      : 'Fly the rings — chain them for combo!   SHIFT boost   •   SPACE roll', 4600);
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
    var rank = score >= 12000 ? 'S' : score >= 8000 ? 'A' : score >= 4000 ? 'B' : 'C';
    var newBest = score > this.best;
    if (newBest) {
      this.best = score;
      try {
        window.localStorage.setItem(BEST_KEY, String(score));
      } catch (e) { /* storage unavailable; best stays in memory */ }
    }
    this.hud.setHi(this.best);
    this.hud.showOver({
      score: score, rank: rank, rings: this.rings, bestCombo: this.bestCombo,
      nearMiss: this.nearMiss, topSpeed: this.topSpeed, best: this.best, newBest: newBest,
    });
  };

  // Autopilot for the title screen and ?shot= modes: steer at the next ring.
  Game.prototype._autopilot = function () {
    var ring = this.world.nextRing;
    var out = { roll: 0, pitch: 0, boost: false, rollPressed: false, pausePressed: false, restartPressed: false, anyPressed: false };
    if (!ring) return out;
    var dx = ring.x - this.plane.pos.x;
    var dy = ring.y - this.plane.pos.y;
    out.roll = util.clamp(dx * 0.03, -1, 1);
    out.pitch = util.clamp(-dy * 0.03, -1, 1);
    out.boost = Math.abs(dx) > 18;
    return out;
  };

  Game.prototype._loop = function (t) {
    requestAnimationFrame(this._loop);
    var dt = Math.min(0.05, (t - (this._lastT || t)) / 1000 || 0.016);
    this._lastT = t;
    if (dt <= 0 || Number.isNaN(dt)) dt = 0.016;
    this.time += dt;
    var input = this.input.poll();

    // ?shot= modes freeze after staging: the screenshot shows the staged
    // frame, not whatever the live loop drifted to.
    if (!this.frozen) {
      if (this.state === 'title') {
        if (input.anyPressed || input.restartPressed) {
          this.startRun();
        } else {
          var ap = this._autopilot();
          this.plane.update(dt, ap, 1);
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
    var heading = this.plane.heading;
    var backX = Math.sin(heading);
    var backZ = Math.cos(heading);
    // Slight lateral offset: the jet reads in 3/4, not dead behind.
    var rightX = Math.cos(heading);
    var rightZ = -Math.sin(heading);
    var target = new THREE.Vector3(
      this.plane.pos.x + backX * 14 + rightX * 2.2,
      this.plane.pos.y + 4.8,
      this.plane.pos.z + backZ * 14 + rightZ * 2.2
    );
    this._camPos.x = util.damp(this._camPos.x, target.x, 7, dt);
    this._camPos.y = util.damp(this._camPos.y, target.y, 7, dt);
    this._camPos.z = util.damp(this._camPos.z, target.z, 7, dt);
    var shake = this.effects.shakeOffset(this.time);
    this.camera.position.set(
      this._camPos.x + shake.x,
      this._camPos.y + shake.y,
      this._camPos.z
    );
    // On the title screen, aim left of the plane so the jet sits clear of
    // the centred title text and FLY button. Look slightly above the jet
    // (+1.2) so it sits lower in the frame and the rings ahead stay clear.
    var titleShift = this.state === 'title' ? 10 : 0;
    this._lookAt.set(
      this.plane.pos.x - backX * 20 - rightX * titleShift,
      this.plane.pos.y + 1.2,
      this.plane.pos.z - backZ * 20 - rightZ * titleShift
    );
    this.camera.lookAt(this._lookAt);
    var targetFov = 62 + (this.plane.boosting ? 13 : 0) + this.plane.speedNorm() * 4;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = util.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
    this.audio.update(this.plane.speedNorm(), this.plane.boosting);
    this.renderer.render(this.scene, this.camera);
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
    var events = this.plane.update(dt, input, this.stage);
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
      if (cross.result === 'pass') {
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.rings += 1;
        var gained = 100 * this.combo;
        this.score += gained;
        this.timer = Math.min(99, this.timer + 2);
        this.effects.burst(cross.ring.mesh.position, 0x00e5ff, 42, 16);
        this.effects.burst(cross.ring.mesh.position, 0xff2d78, 24, 11);
        this.audio.ring(this.combo);
        this.audio.setCombo(this.combo);
        this.hud.popup('RING x' + this.combo + '  +' + gained, 'ring');
        if (this.combo === 5 || this.combo === 10 || this.combo === 15) {
          this.effects.flash('rgba(255,45,120,0.35)', 0.5);
          this.effects.shake(0.25);
        }
      } else {
        this.combo = 0;
        this.audio.setCombo(0);
        this.hud.popup('MISS', 'miss');
      }
    }

    // Hazards.
    var hazard = this.world.checkHazards(this.plane.pos, this.plane.invulnerable > 0);
    if (hazard) {
      if (hazard.type === 'crash') {
        if (this.plane.crash()) {
          this.combo = 0;
          this.audio.setCombo(0);
          this.timer = Math.max(0, this.timer - 5);
          this.effects.burst(this.plane.pos, 0xff7a3d, 70, 26);
          this.effects.burst(this.plane.pos, 0xff2d78, 40, 18);
          this.effects.shake(1.1);
          this.effects.flash('rgba(255,45,45,0.4)', 0.6);
          this.audio.crash();
          this.hud.popup('CRASH!  -5s', 'miss');
        }
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

    // Pickups.
    var pick = this.world.checkPickups(this.plane.pos);
    if (pick) {
      this.plane.boost = Math.min(100, this.plane.boost + 30);
      this.timer = Math.min(99, this.timer + 1);
      this.effects.burst(pick.mesh.position, 0xffb347, 30, 13);
      this.audio.pickup();
      this.hud.popup('+BOOST', 'bonus');
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
    if (input.boost && this.plane.boosting && !this._wasBoosting) this.audio.boost();
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
