// NEON RUSH — HUD and screens: DOM overlay (crisp text for screenshots),
// animated popups, title / pause / game-over screens, touch buttons.
(function (global) {
  'use strict';

  var util = global.NR.util;

  function Hud() {
    this.els = {};
    var ids = ['score', 'combo', 'comboBar', 'speed', 'boost', 'boostFill',
      'alt', 'heading', 'timer', 'stage', 'hi', 'popup', 'title', 'pause',
      'over', 'overScore', 'overRank', 'overHi', 'toast',
      'lowAlt', 'touchUI', 'btnBoost', 'btnRoll', 'titleHi',
      'statRings', 'statCombo', 'statNear', 'statSpeed'];
    for (var i = 0; i < ids.length; i++) {
      this.els[ids[i]] = document.getElementById(ids[i]);
    }
    this._popupTimer = 0;
    this._popupQueue = [];
  }

  Hud.prototype.setScore = function (score) {
    this.els.score.textContent = util.fmtInt(score);
  };

  Hud.prototype.setCombo = function (combo) {
    this.els.combo.textContent = combo > 1 ? 'x' + combo : '';
    var pct = Math.min(100, (combo / 10) * 100);
    this.els.comboBar.style.width = pct + '%';
  };

  Hud.prototype.setSpeed = function (knots) {
    this.els.speed.textContent = Math.round(knots) + ' kn';
  };

  Hud.prototype.setBoost = function (pct) {
    this.els.boostFill.style.width = Math.round(pct) + '%';
    this.els.boostFill.style.background = pct < 25 ? '#ff2d78' : '#00e5ff';
  };

  Hud.prototype.setAlt = function (meters) {
    this.els.alt.textContent = Math.round(meters) + ' m';
  };

  Hud.prototype.setHeading = function (deg) {
    this.els.heading.textContent = String(deg).padStart(3, '0') + '° ' + util.compass(deg);
  };

  Hud.prototype.setTimer = function (seconds) {
    this.els.timer.textContent = util.fmtTime(seconds);
    this.els.timer.style.color = seconds <= 10 ? '#ff2d78' : '#ffffff';
  };

  Hud.prototype.setStage = function (stage) {
    this.els.stage.textContent = 'STAGE ' + stage;
  };

  Hud.prototype.setHi = function (hi) {
    this.els.hi.textContent = 'BEST ' + util.fmtInt(hi);
    if (this.els.titleHi) this.els.titleHi.textContent = 'BEST ' + util.fmtInt(hi);
  };

  Hud.prototype.setLowAlt = function (on) {
    this.els.lowAlt.style.opacity = on ? '1' : '0';
  };

  Hud.prototype.popup = function (text, kind) {
    var el = this.els.popup;
    el.textContent = text;
    el.className = 'show ' + (kind || '');
    var self = this;
    clearTimeout(this._popupTimer);
    this._popupTimer = setTimeout(function () {
      el.className = '';
    }, 900);
  };

  Hud.prototype.toast = function (text, ms) {
    var el = this.els.toast;
    el.textContent = text;
    el.style.opacity = '1';
    setTimeout(function () { el.style.opacity = '0'; }, ms || 4200);
  };

  Hud.prototype.showTitle = function () {
    this.els.title.style.display = 'flex';
    this.els.pause.style.display = 'none';
    this.els.over.style.display = 'none';
  };

  Hud.prototype.showPause = function (on) {
    this.els.pause.style.display = on ? 'flex' : 'none';
  };

  Hud.prototype.showOver = function (stats) {
    this.els.title.style.display = 'none';
    this.els.pause.style.display = 'none';
    this.els.overScore.textContent = util.fmtInt(stats.score);
    this.els.overRank.textContent = stats.rank;
    this.els.overRank.style.color = stats.rank === 'S' ? '#ffd166'
      : stats.rank === 'A' ? '#00e5ff' : stats.rank === 'B' ? '#ff7a3d' : '#c9b8ff';
    // POLISH: stats as a spaced 2x2 grid of big values + labels (was one
    // cramped line that wrapped unreadably on phones).
    this.els.statRings.textContent = stats.rings;
    this.els.statCombo.textContent = 'x' + stats.bestCombo;
    this.els.statNear.textContent = stats.nearMiss;
    this.els.statSpeed.textContent = Math.round(stats.topSpeed) + ' kn';
    this.els.overHi.textContent = stats.newBest
      ? '★ NEW BEST! ★'
      : 'BEST ' + util.fmtInt(stats.best);
    this.els.over.style.display = 'flex';
    this.els.pause.style.display = 'none';
  };

  Hud.prototype.hideOver = function () {
    this.els.over.style.display = 'none';
  };

  Hud.prototype.showTouch = function (on) {
    this.els.touchUI.style.display = on ? 'block' : 'none';
  };

  Hud.prototype.isTouch = function () {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  };

  // Wire the on-screen touch buttons to the input object.
  Hud.prototype.wireTouch = function (input) {
    var self = this;
    function bindHold(el, on, off) {
      if (!el) return;
      el.addEventListener('touchstart', function (e) { on(); e.preventDefault(); }, { passive: false });
      el.addEventListener('touchend', function (e) { off(); e.preventDefault(); }, { passive: false });
      el.addEventListener('mousedown', function () { on(); });
      el.addEventListener('mouseup', function () { off(); });
    }
    bindHold(this.els.btnBoost, function () { input.setTouchBoost(true); },
      function () { input.setTouchBoost(false); });
    var rollBtn = this.els.btnRoll;
    if (rollBtn) {
      rollBtn.addEventListener('touchstart', function (e) {
        input.queueTouchRoll();
        e.preventDefault();
      }, { passive: false });
      rollBtn.addEventListener('mousedown', function () { input.queueTouchRoll(); });
    }
  };

  global.NR = global.NR || {};
  global.NR.Hud = Hud;
})(window);
