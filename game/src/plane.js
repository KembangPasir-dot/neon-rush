// NEON RUSH — the aircraft: low-poly jet built from primitives, plus the
// arcade flight model with inertia: pitch/roll/yaw, throttle, climb
// bleeds speed, and a stall when too slow. Barrel roll dodge included.
(function (global) {
  'use strict';

  var util = global.NR.util;
  var THREE = global.THREE;
  var CORRIDOR_X = global.NR.CORRIDOR_X;
  var MIN_Y = global.NR.MIN_Y;
  var MAX_Y = global.NR.MAX_Y;

  var BASE_SPEED = 55; // cruise speed at 70% throttle, stage 1
  var STALL_SPEED = 32; // below this the jet stalls: weak controls, nose drops

  function buildJet() {
    var group = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: 0xe8ecf5, flatShading: true });
    var accentMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    var magentaMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    var darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1030, flatShading: true });

    // Fuselage: a stretched cone pointing forward (-Z).
    var fuselage = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.4, 6), bodyMat);
    fuselage.rotation.x = -Math.PI / 2;
    group.add(fuselage);
    // Cockpit canopy.
    var canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    canopy.scale.set(0.85, 0.6, 1.6);
    canopy.position.set(0, 0.55, -0.6);
    group.add(canopy);
    // Main wings.
    var wingGeo = new THREE.BoxGeometry(7.6, 0.18, 1.7);
    var wings = new THREE.Mesh(wingGeo, bodyMat);
    wings.position.set(0, -0.1, 0.9);
    group.add(wings);
    var tipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.7), magentaMat);
    tipL.position.set(-3.85, -0.1, 0.9);
    group.add(tipL);
    var tipR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.7), accentMat);
    tipR.position.set(3.85, -0.1, 0.9);
    group.add(tipR);
    // Tail fins.
    var tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 1.1), bodyMat);
    tail.position.set(0, 0.05, 2.2);
    group.add(tail);
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.3), darkMat);
    fin.position.set(0, 0.75, 2.2);
    group.add(fin);
    // Rear engine block: from directly behind, the jet needs a back, not
    // just the flat base of the nose cone. Kept small and mid-purple so it
    // reads as machinery, not a black slab.
    var engineBlock = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.7, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x3a2358, flatShading: true })
    );
    engineBlock.position.set(0, 0.1, 2.3);
    group.add(engineBlock);
    // Engine glow.
    var engine = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7a3d })
    );
    engine.position.set(0, 0, 2.85);
    engine.rotation.y = Math.PI;
    group.add(engine);
    // Wingtip lights (for the trail system).
    var tipLightGeo = new THREE.SphereGeometry(0.16, 8, 6);
    var lightL = new THREE.Mesh(tipLightGeo, magentaMat);
    lightL.position.set(-4.05, -0.1, 0.9);
    lightL.name = 'tipL';
    group.add(lightL);
    var lightR = new THREE.Mesh(tipLightGeo, accentMat);
    lightR.position.set(4.05, -0.1, 0.9);
    lightR.name = 'tipR';
    group.add(lightR);
    return group;
  }

  function Plane(scene) {
    this.mesh = buildJet();
    // POLISH (phone-first): the jet was ~35% of the screen width and hid
    // the next ring, worst in portrait. Scale it down ~28% (0.72) so the
    // rings ahead stay visible; silhouette (wings, tail, cockpit) is
    // unchanged, only smaller. Collision is point-based (pos), so
    // gameplay and scoring are untouched.
    this.mesh.scale.setScalar(0.72);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(0, 20, 0);
    this.heading = 0; // yaw, radians; 0 = straight -Z
    this.yawRate = 0; // yaw with inertia: bank feeds it, it feeds heading
    this.pitchAngle = 0;
    this.bank = 0;
    this.speed = BASE_SPEED;
    this.throttle = 0.7; // 0..1, set by Shift/Ctrl or the mobile slider
    this.boosting = false; // effective throttle > 0.85 (FOV kick, speed lines)
    this.vy = 0; // vertical speed (units/s, negative = descending)
    this.stall = false; // speed below STALL_SPEED: weak controls, nose drops
    this.rollAnim = 0; // >0 while barrel-rolling (0..1 progress)
    this.rollCooldown = 0;
    this.invulnerable = 0;
    this.crashed = 0; // >0 while tumbling after a crash
    this.crashSpin = 0;
    this.alive = true;
    this.rush = false; // RUSH power-up: +12% speed while active
    this.respawnPoint = null; // set on final approach: crash respawns at the fix
  }

  Plane.prototype.reset = function () {
    this.pos.set(0, 20, 0);
    this.heading = 0;
    this.yawRate = 0;
    this.pitchAngle = 0;
    this.bank = 0;
    this.speed = BASE_SPEED;
    this.throttle = 0.7;
    this.boosting = false;
    this.vy = 0;
    this.stall = false;
    this.rollAnim = 0;
    this.rollCooldown = 0;
    this.invulnerable = 2;
    this.crashed = 0;
    this.crashSpin = 0;
    this.alive = true;
    this.rush = false;
    this.respawnPoint = null;
    this.blinkUntil = 0;
    this.mesh.visible = true;
    this.mesh.rotation.set(0, 0, 0);
    // Place the mesh now: frozen ?shot= frames never call update(), and
    // the first live frame must not show the jet buried at the origin.
    this._applyTransform();
  };

  // Returns events: { rolled: bool } when a barrel roll completes.
  // floorY: lowest allowed altitude — 4.5 normally, 0.6 on final approach
  // so the jet can touch down on the runway.
  Plane.prototype.update = function (dt, input, stage, floorY) {
    var events = { rolled: false };
    if (this.crashed > 0) {
      // Tumble, then respawn.
      this.crashed -= dt;
      this.crashSpin += dt * 9;
      this.mesh.rotation.z = this.crashSpin;
      this.mesh.rotation.x = this.crashSpin * 0.6;
      this.pos.y = Math.max(6, this.pos.y - dt * 8);
      if (this.crashed <= 0) this._respawn();
      this._applyTransform();
      return events;
    }
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.rollCooldown > 0) this.rollCooldown -= dt;
    if (floorY == null) floorY = MIN_Y - 0.5;

    // Throttle: the input owns the stored value (Shift/Ctrl nudge it, the
    // mobile slider sets it); the BOOST button holds full throttle.
    if (input.throttle != null) this.throttle = util.clamp(input.throttle, 0, 1);
    var effThrottle = input.boost ? 1 : this.throttle;
    this.boosting = effThrottle > 0.85;

    // Barrel roll: 0.55s spin, brief invulnerability, +bonus on completion.
    if (input.rollPressed && this.rollCooldown <= 0 && this.rollAnim <= 0) {
      this.rollAnim = 0.0001;
      this.rollCooldown = 3;
      this.invulnerable = Math.max(this.invulnerable, 0.55);
    }
    var rolling = false;
    if (this.rollAnim > 0) {
      this.rollAnim += dt / 0.55;
      if (this.rollAnim >= 1) {
        this.rollAnim = 0;
        events.rolled = true;
      } else {
        rolling = true;
      }
    }

    // Steering: bank into turns, pitch with input, auto-level when released.
    // Stalling weakens the controls and drops the nose.
    var targetBank = util.clamp(input.roll, -1, 1) * 1.05;
    var targetPitch = util.clamp(input.pitch, -1, 1) * 0.55;
    if (this.stall) {
      targetBank *= 0.5;
      targetPitch = 0.22; // nose drops on its own until speed returns
    }
    this.bank = util.damp(this.bank, targetBank, 6, dt);
    this.pitchAngle = util.damp(this.pitchAngle, targetPitch, 5, dt);
    // Yaw with inertia: the bank feeds a yaw rate, the rate turns the jet.
    var targetYawRate = this.bank * 0.55;
    this.yawRate = util.damp(this.yawRate, targetYawRate, 3, dt);
    this.heading -= this.yawRate * dt;

    // Speed: throttle sets it; climbing bleeds speed, diving gains a little.
    // pitchAngle < 0 = climbing (see the vertical integration below).
    var climbBleed = util.clamp(1 + this.pitchAngle * 0.45, 0.6, 1.3);
    var targetSpeed = (30 + effThrottle * 50 + (stage - 1) * 7)
      * (this.rush ? 1.12 : 1) * climbBleed;
    this.speed = util.damp(this.speed, targetSpeed, 2.5, dt);
    this.stall = this.speed < STALL_SPEED;

    // Integrate: forward along heading, vertical from pitch.
    var oldY = this.pos.y;
    var forward = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.pos.addScaledVector(forward, this.speed * dt);
    this.pos.y += -Math.sin(this.pitchAngle) * this.speed * 0.55 * dt;
    this.pos.x = util.clamp(this.pos.x, -CORRIDOR_X, CORRIDOR_X);
    this.pos.y = util.clamp(this.pos.y, floorY, MAX_Y);
    this.vy = (this.pos.y - oldY) / Math.max(dt, 1e-4);
    if (this.pos.x <= -CORRIDOR_X || this.pos.x >= CORRIDOR_X) {
      this.heading = util.clamp(this.heading, -0.5, 0.5) * 0.9;
    }
    this._applyTransform(rolling);
    return events;
  };

  Plane.prototype._applyTransform = function (rolling) {
    this.mesh.position.copy(this.pos);
    var rollVisual = this.bank;
    if (rolling && this.rollAnim > 0) {
      rollVisual += this.rollAnim * Math.PI * 2;
    }
    this.mesh.rotation.set(this.pitchAngle, this.heading, -rollVisual, 'YXZ');
    // Blink only briefly after a crash respawn, never at spawn: a
    // screenshot must never catch the plane invisible.
    this.mesh.visible = performance.now() < this.blinkUntil
      ? Math.floor(performance.now() / 120) % 2 === 0
      : true;
  };

  Plane.prototype.crash = function () {
    if (this.crashed > 0 || this.invulnerable > 0) return false;
    this.crashed = 0.9;
    this.crashSpin = 0;
    return true;
  };

  Plane.prototype._respawn = function () {
    // On final approach the crash respawns at the approach fix, not a few
    // metres back: a go-around, not a teleport to nowhere.
    if (this.respawnPoint) {
      this.pos.copy(this.respawnPoint);
    } else {
      this.pos.set(0, 22, this.pos.z - 4);
    }
    this.heading = 0;
    this.yawRate = 0;
    this.pitchAngle = 0;
    this.bank = 0;
    this.invulnerable = 2.5;
    this.blinkUntil = performance.now() + 1400;
    this.mesh.rotation.set(0, 0, 0);
  };

  // Instant reposition (missed approach): no tumble, just back to the fix.
  Plane.prototype.teleportTo = function (x, y, z) {
    this.pos.set(x, y, z);
    this.heading = 0;
    this.yawRate = 0;
    this.pitchAngle = 0;
    this.bank = 0;
    this.crashed = 0;
    this.invulnerable = 2.5;
    this.blinkUntil = performance.now() + 800;
    this.mesh.rotation.set(0, 0, 0);
    this._applyTransform();
  };

  Plane.prototype.speedNorm = function () {
    // 30 (idle) .. 80 (full throttle) maps to 0..1 for FOV / speed lines.
    return util.clamp((this.speed - 30) / 50, 0, 1);
  };

  Plane.prototype.wingtipWorld = function (out) {
    var l = this.mesh.getObjectByName('tipL');
    var r = this.mesh.getObjectByName('tipR');
    if (l) l.getWorldPosition(out.l);
    if (r) r.getWorldPosition(out.r);
    return out;
  };

  global.NR = global.NR || {};
  global.NR.Plane = Plane;
  global.NR.BASE_SPEED = BASE_SPEED;
})(window);
