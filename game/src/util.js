// NEON RUSH — small shared helpers: seeded RNG and math.
// Written fresh for this entry; no dependencies.
(function (global) {
  'use strict';

  // Deterministic RNG (mulberry32) so ?shot= screenshots reproduce.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Frame-rate independent exponential approach.
  function damp(current, target, lambda, dt) {
    return lerp(target, current, Math.exp(-lambda * dt));
  }

  function fmtInt(n) {
    return String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtTime(seconds) {
    var s = Math.max(0, Math.ceil(seconds));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function headingDeg(rad) {
    var d = Math.round((rad * 180) / Math.PI) % 360;
    if (d < 0) d += 360;
    return d;
  }

  function compass(deg) {
    var pts = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return pts[Math.round(deg / 45) % 8];
  }

  global.NR = global.NR || {};
  global.NR.util = {
    mulberry32: mulberry32,
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    fmtInt: fmtInt,
    fmtTime: fmtTime,
    headingDeg: headingDeg,
    compass: compass,
  };
})(window);
