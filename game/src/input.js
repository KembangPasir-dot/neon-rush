// NEON RUSH — input: keyboard, mouse steer, touch joystick + buttons.
// Normalised output: pitch/roll in [-1, 1], boost flag, edge-triggered roll.
(function (global) {
  'use strict';

  var util = global.NR.util;

  function Input(canvas) {
    this.keys = {};
    this.pitch = 0; // -1 (up) .. 1 (down); positive = pull down
    this.roll = 0; // -1 (left) .. 1 (right)
    this.boost = false;
    this.mouseSteer = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.joyX = 0;
    this.joyY = 0;
    this.joyActive = false;
    this._rollQueued = false;
    this._pauseQueued = false;
    this._restartQueued = false;
    this._anyQueued = false;
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
    // Touch: left half = joystick, right side buttons are DOM (see hud.js).
    canvas.addEventListener('touchstart', function (e) {
      self._touchMove(e);
      self._anyQueued = true;
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      self._touchMove(e);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', function () {
      self.joyActive = false;
      self.joyX = 0;
      self.joyY = 0;
    });
  };

  Input.prototype._setMouse = function (e) {
    var r = document.documentElement.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    this.mouseY = ((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1;
  };

  Input.prototype._touchMove = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.clientX < window.innerWidth * 0.45) {
        this.joyActive = true;
        this.joyX = util.clamp((t.clientX - window.innerWidth * 0.16) / (window.innerWidth * 0.14), -1, 1);
        this.joyY = util.clamp((t.clientY - window.innerHeight * 0.72) / (window.innerHeight * 0.14), -1, 1);
      }
    }
  };

  // Read once per frame; returns the steering for this frame.
  Input.prototype.poll = function () {
    var k = this.keys;
    var roll = 0;
    var pitch = 0;
    if (k.ArrowLeft || k.KeyA) roll -= 1;
    if (k.ArrowRight || k.KeyD) roll += 1;
    if (k.ArrowUp || k.KeyW) pitch -= 1;
    if (k.ArrowDown || k.KeyS) pitch += 1;
    if (this.joyActive) {
      roll += this.joyX;
      pitch += this.joyY;
    }
    if (this.mouseSteer) {
      roll += this.mouseX * 1.4;
      pitch += this.mouseY * 1.1;
    }
    this.roll = util.clamp(roll, -1, 1);
    this.pitch = util.clamp(pitch, -1, 1);
    this.boost = !!(k.ShiftLeft || k.ShiftRight || this._touchBoost);
    var rollPressed = this._rollQueued || this._touchRoll;
    this._rollQueued = false;
    this._touchRoll = false;
    var pausePressed = this._pauseQueued;
    this._pauseQueued = false;
    var restartPressed = this._restartQueued;
    this._restartQueued = false;
    var anyPressed = this._anyQueued;
    this._anyQueued = false;
    return {
      roll: this.roll,
      pitch: this.pitch,
      boost: this.boost,
      rollPressed: rollPressed,
      pausePressed: pausePressed,
      restartPressed: restartPressed,
      anyPressed: anyPressed,
    };
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
