// NEON RUSH — input: keyboard, mouse steer, touch joystick + buttons.
// Normalised output: pitch/roll in [-1, 1], throttle 0..1, boost flag
// (BOOST button held = full throttle), edge-triggered roll.
(function (global) {
  'use strict';

  var util = global.NR.util;

  function Input(canvas) {
    this.keys = {};
    this.pitch = 0; // -1 (up) .. 1 (down); positive = pull down
    this.roll = 0; // -1 (left) .. 1 (right)
    this.throttle = 0.7; // stored throttle: Shift nudges up, Ctrl down, slider sets
    this.boost = false; // BOOST button held = full throttle override
    this.mouseSteer = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.joyX = 0;
    this.joyY = 0;
    this.joyActive = false;
    // Drag-anywhere steering: the touch that starts on the canvas claims
    // steering; its drag vector (from its own start point) steers the
    // plane. Dead zone + per-frame easing keep it smooth, not twitchy.
    this._steerId = null;
    this._steerOX = 0;
    this._steerOY = 0;
    this._joyTX = 0; // smoothed joystick targets
    this._joyTY = 0;
    this._rollQueued = false;
    this._pauseQueued = false;
    this._restartQueued = false;
    this._anyQueued = false;
    this._muteQueued = false;
    this._attach(canvas);
  }

  Input.prototype._attach = function (canvas) {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (e.repeat) return;
      self.keys[e.code] = true;
      if (e.code === 'Space') {
        self._rollQueued = true;
        self._anyQueued = true;
        e.preventDefault();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') self._pauseQueued = true;
      if (e.code === 'KeyR') self._restartQueued = true;
      if (e.code === 'KeyM') self._muteQueued = true;
      if (e.code === 'Enter') self._anyQueued = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.code) >= 0) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', function (e) {
      self.keys[e.code] = false;
    });
    window.addEventListener('blur', function () {
      self.keys = {};
      self.boost = false;
      self.joyActive = false;
      self.joyX = 0;
      self.joyY = 0;
      self._steerId = null;
      self._joyTX = 0;
      self._joyTY = 0;
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        self.keys = {};
        self.boost = false;
      }
    });
    // Mouse steering: hold the left button and the plane follows the pointer.
    canvas.addEventListener('mousedown', function (e) {
      self.mouseSteer = true;
      self._setMouse(e);
      self._anyQueued = true;
    });
    window.addEventListener('mousemove', function (e) {
      if (self.mouseSteer) self._setMouse(e);
    });
    window.addEventListener('mouseup', function () {
      self.mouseSteer = false;
    });
    // Touch: drag ANYWHERE on the canvas to steer. The first touch claims
    // steering from wherever it lands (relative joystick); other touches
    // (e.g. the BOOST/ROLL buttons) are DOM elements and never reach here.
    canvas.addEventListener('touchstart', function (e) {
      self._touchStart(e);
      self._anyQueued = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      self._touchMove(e);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function (e) {
      self._touchEnd(e);
    });
    canvas.addEventListener('touchcancel', function (e) {
      self._touchEnd(e);
    });
  };

  Input.prototype._setMouse = function (e) {
    var r = document.documentElement.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    this.mouseY = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  };

  Input.prototype._touchStart = function (e) {
    if (this._steerId !== null) return; // one steering finger at a time
    var t = e.changedTouches[0];
    this._steerId = t.identifier;
    this._steerOX = t.clientX;
    this._steerOY = t.clientY;
    this.joyActive = true;
    this.joyX = 0;
    this.joyY = 0;
    this._joyTX = 0;
    this._joyTY = 0;
  };

  Input.prototype._touchMove = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== this._steerId) continue;
      // Drag vector from the touch's own start point, ~70px = full deflection.
      var dx = (t.clientX - this._steerOX) / 70;
      var dy = (t.clientY - this._steerOY) / 70;
      var mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 0.12) {
        // Dead zone: tiny accidental drifts do nothing.
        this._joyTX = 0;
        this._joyTY = 0;
      } else {
        var s = Math.min(1, (mag - 0.12) / 0.88) / mag;
        this._joyTX = util.clamp(dx * s, -1, 1);
        this._joyTY = util.clamp(dy * s, -1, 1);
      }
    }
  };

  Input.prototype._touchEnd = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this._steerId) {
        this._steerId = null;
        this.joyActive = false;
        this.joyX = 0;
        this.joyY = 0;
        this._joyTX = 0;
        this._joyTY = 0;
      }
    }
  };

  // Read once per frame; returns the steering for this frame.
  // dt drives the throttle nudge rate (Shift up / Ctrl down).
  Input.prototype.poll = function (dt) {
    var k = this.keys;
    if (dt == null) dt = 0.016;
    // Throttle: Shift climbs toward full, Ctrl idles down; otherwise the
    // stored value (set by the slider or by earlier Shift/Ctrl) holds.
    if (k.ShiftLeft || k.ShiftRight) this.throttle = Math.min(1, this.throttle + 0.8 * dt);
    if (k.ControlLeft || k.ControlRight) this.throttle = Math.max(0, this.throttle - 0.8 * dt);
    var roll = 0;
    var pitch = 0;
    if (k.ArrowLeft || k.KeyA) roll -= 1;
    if (k.ArrowRight || k.KeyD) roll += 1;
    if (k.ArrowUp || k.KeyW) pitch -= 1;
    if (k.ArrowDown || k.KeyS) pitch += 1;
    if (this.joyActive) {
      // Ease the drag vector toward its target: smooth, never twitchy.
      this.joyX += (this._joyTX - this.joyX) * 0.35;
      this.joyY += (this._joyTY - this.joyY) * 0.35;
      roll += this.joyX;
      pitch += this.joyY;
    }
    if (this.mouseSteer) {
      roll += this.mouseX * 1.4;
      pitch += this.mouseY * 1.1;
    }
    this.roll = util.clamp(roll, -1, 1);
    this.pitch = util.clamp(pitch, -1, 1);
    this.boost = !!this._touchBoost;
    var rollPressed = this._rollQueued || this._touchRoll;
    this._rollQueued = false;
    this._touchRoll = false;
    var pausePressed = this._pauseQueued;
    this._pauseQueued = false;
    var restartPressed = this._restartQueued;
    this._restartQueued = false;
    var mutePressed = this._muteQueued;
    this._muteQueued = false;
    var anyPressed = this._anyQueued;
    this._anyQueued = false;
    return {
      roll: this.roll,
      pitch: this.pitch,
      throttle: this.throttle,
      boost: this.boost,
      rollPressed: rollPressed,
      pausePressed: pausePressed,
      restartPressed: restartPressed,
      mutePressed: mutePressed,
      anyPressed: anyPressed,
    };
  };

  // Called by the mobile throttle slider (hud.js wires it).
  Input.prototype.setThrottle = function (v) {
    this.throttle = util.clamp(v, 0, 1);
  };

  // Called by the DOM touch buttons (hud.js wires them).
  Input.prototype.setTouchBoost = function (on) {
    this._touchBoost = !!on;
  };

  Input.prototype.queueTouchRoll = function () {
    this._touchRoll = true;
    this._anyQueued = true;
  };

  global.NR = global.NR || {};
  global.NR.Input = Input;
})(window);
