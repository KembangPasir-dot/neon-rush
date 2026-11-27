// NEON RUSH — procedural WebAudio: synthwave arpeggio + SFX.
// Everything is synthesized; no audio files. Layers join as the combo grows.
(function (global) {
  'use strict';

  var SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]; // A minor pentatonic-ish
  var ROOT = 110; // A2

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.combo = 0;
    this.tempo = 112; // BPM
    this.started = false;
    this.muted = false;
  }

  AudioEngine.prototype.init = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx;
    try {
      ctx = new AC();
    } catch (e) {
      // No audio on this machine/browser: the game stays silent, never broken.
      return;
    }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    // Engine hum: two detuned saws through a lowpass.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    var osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55.7;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    osc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    osc2.start();
    this._osc2 = osc2;
    this.nextNoteTime = ctx.currentTime + 0.1;
    this.started = true;
  };

  AudioEngine.prototype.setCombo = function (combo) {
    this.combo = combo | 0;
  };

  AudioEngine.prototype.setMuted = function (muted) {
    this.muted = !!muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.9;
  };

  AudioEngine.prototype.toggleMuted = function () {
    this.setMuted(!this.muted);
    return this.muted;
  };

  // Call every frame: schedules the arpeggio ahead of time.
  AudioEngine.prototype.update = function (speedNorm, boosting) {
    if (!this.ctx || this.muted) return;
    var ctx = this.ctx;
    var spb = 60 / this.tempo / 2; // 8th notes
    while (this.nextNoteTime < ctx.currentTime + 0.18) {
      this._scheduleStep(this.nextNoteTime, this.step, speedNorm);
      this.nextNoteTime += spb;
      this.step = (this.step + 1) % 32;
    }
    // Engine hum follows speed.
    if (this.engineOsc) {
      var f = 48 + speedNorm * 70 + (boosting ? 26 : 0);
      this.engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      if (this._osc2) this._osc2.frequency.setTargetAtTime(f * 1.012, ctx.currentTime, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.05, ctx.currentTime, 0.1);
    }
  };

  AudioEngine.prototype._scheduleStep = function (t, step, speedNorm) {
    var ctx = this.ctx;
    var combo = this.combo;
    // Arpeggio: driving 8ths, notes climb with the bar.
    var idx = (step * 2 + (step % 4 === 3 ? 1 : 0)) % SCALE.length;
    var note = ROOT * Math.pow(2, SCALE[idx] / 12) * (step >= 16 ? 2 : 1);
    this._pluck(t, note, 0.16, 'sawtooth', 0.16);
    // Bass joins at combo >= 2: root on the beat.
    if (combo >= 2 && step % 4 === 0) {
      this._pluck(t, ROOT / 2, 0.22, 'triangle', 0.5);
    }
    // Hats join at combo >= 4: off-beat ticks.
    if (combo >= 4 && step % 2 === 1) {
      this._hat(t, 0.03);
    }
    // Sparkle lead joins at combo >= 7: high octave every bar.
    if (combo >= 7 && step % 8 === 6) {
      this._pluck(t, note * 4, 0.2, 'square', 0.06);
    }
  };

  AudioEngine.prototype._pluck = function (t, freq, dur, type, vol) {
    var ctx = this.ctx;
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  AudioEngine.prototype._hat = function (t, vol) {
    var ctx = this.ctx;
    var len = Math.floor(ctx.sampleRate * 0.04);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    var gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(t);
  };

  AudioEngine.prototype._tone = function (freq, dur, type, vol, when) {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var t = ctx.currentTime + (when || 0);
    var osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  };

  AudioEngine.prototype._noise = function (dur, vol, filterFreq, when) {
    if (!this.ctx) return;
    var ctx = this.ctx;
    var t = ctx.currentTime + (when || 0);
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    var gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
  };

  AudioEngine.prototype.ring = function (combo) {
    // Two-note chime, pitch climbs with the combo.
    var base = 660 * Math.pow(2, Math.min(combo, 12) / 12);
    this._tone(base, 0.18, 'sine', 0.5);
    this._tone(base * 1.5, 0.28, 'sine', 0.4, 0.07);
  };

  AudioEngine.prototype.miss = function () {
    // Soft descending blip: the combo is gone, but it is not a punishment.
    this._tone(320, 0.16, 'sine', 0.14);
    this._tone(233, 0.22, 'sine', 0.1, 0.06);
  };

  AudioEngine.prototype.rush = function () {
    // Quick rising fanfare for the RUSH power-up.
    this._tone(523, 0.12, 'triangle', 0.35);
    this._tone(659, 0.12, 'triangle', 0.35, 0.07);
    this._tone(784, 0.22, 'triangle', 0.35, 0.14);
  };
  AudioEngine.prototype.pickup = function () {
    this._tone(880, 0.12, 'triangle', 0.4);
    this._tone(1318, 0.2, 'triangle', 0.3, 0.06);
  };

  AudioEngine.prototype.nearMiss = function () {
    this._noise(0.18, 0.35, 3000);
    this._tone(1567, 0.12, 'sine', 0.25, 0.02);
  };

  AudioEngine.prototype.boost = function () {
    this._noise(0.35, 0.3, 1800);
  };

  AudioEngine.prototype.roll = function () {
    this._noise(0.25, 0.22, 2400);
  };

  AudioEngine.prototype.crash = function () {
    this._noise(0.5, 0.6, 500);
    this._tone(70, 0.4, 'sine', 0.6);
  };

  AudioEngine.prototype.stall = function () {
    // Low two-tone warning while the jet is stalling (throttled by the
    // caller to about once every 0.6s).
    this._tone(220, 0.09, 'square', 0.12);
    this._tone(180, 0.09, 'square', 0.12, 0.12);
  };

  AudioEngine.prototype.land = function () {
    // Touchdown chime: a rising triad for a completed mission.
    this._tone(523, 0.15, 'triangle', 0.4);
    this._tone(784, 0.2, 'triangle', 0.4, 0.1);
    this._tone(1046, 0.3, 'triangle', 0.35, 0.2);
  };

  AudioEngine.prototype.approach = function () {
    // Two-note cue when the final approach opens.
    this._tone(660, 0.12, 'triangle', 0.35);
    this._tone(880, 0.18, 'triangle', 0.35, 0.1);
  };

  AudioEngine.prototype.click = function () {
    this._tone(1200, 0.06, 'square', 0.15);
  };

  AudioEngine.prototype.countTick = function () {
    this._tone(440, 0.08, 'sine', 0.3);
  };

  global.NR = global.NR || {};
  global.NR.AudioEngine = AudioEngine;
})(window);
