// NEON RUSH — HUD and screens: DOM overlay (crisp text for screenshots),
// animated popups, title / pause / game-over screens, touch buttons.
(function (global) {
  'use strict';

  var util = global.NR.util;

  function Hud() {
    this.els = {};
    var ids = ['score', 'combo', 'comboBar', 'speed', 'boostFill', 'boostLabel',
      'alt', 'heading', 'timer', 'stage', 'hi', 'popup', 'title', 'pause',
      'over', 'overTitle', 'overScore', 'overRank', 'overGrade', 'overHi', 'toast',
      'lowAlt', 'touchUI', 'btnBoost', 'btnRoll', 'titleHi',
      'statRings', 'statCombo', 'statNear', 'statSpeed',
      'statRingsL', 'statComboL', 'statNearL', 'statSpeedL',
      'muteBtn', 'helpBtn', 'help', 'helpClose', 'guide', 'rushBadge',
      'cockpit', 'tape', 'horizon', 'missionHint', 'stall',
      'thrSlider', 'thrFill', 'thrThumb'];
    for (var i = 0; i < ids.length; i++) {
      this.els[ids[i]] = document.getElementById(ids[i]);
    }
    this._popupTimer = 0;
    this._popupQueue = [];
    this._missionText = '';
    this._thrVal = -1;
    // 2D contexts for the cockpit instruments (heading tape, horizon).
    this._tapeCtx = this.els.tape ? this.els.tape.getContext('2d') : null;
    this._horCtx = this.els.horizon ? this.els.horizon.getContext('2d') : null;
  }

  Hud.prototype.setScore = function (score) {
    this.els.score.textContent = util.fmtInt(score);
  };

  Hud.prototype.setCombo = function (combo) {
    this.els.combo.textContent = combo > 1 ? 'x' + combo : '';
    var pct = Math.min(100, (combo / 10) * 100);
    this.els.comboBar.style.width = pct + '%';
    // Milestone pulse: x5 / x10 / x15 make the counter jump.
    if (combo === 5 || combo === 10 || combo === 15) {
      var el = this.els.combo;
      el.classList.remove('pulse');
      void el.offsetWidth; // restart the animation
      el.classList.add('pulse');
      var self = this;
      clearTimeout(this._pulseTimer);
      this._pulseTimer = setTimeout(function () { el.classList.remove('pulse'); }, 360);
    }
  };

  Hud.prototype.setRush = function (on, secondsLeft) {
    var el = this.els.rushBadge;
    if (!el) return;
    el.style.display = on ? 'block' : 'none';
    if (on) el.textContent = 'RUSH ×2 · ' + Math.ceil(secondsLeft) + 's';
  };

  Hud.prototype.setGuide = function (visible, x, y, angleDeg) {
    var el = this.els.guide;
    if (!el) return;
    el.style.display = visible ? 'block' : 'none';
    if (visible) {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.transform = 'translate(-50%, -50%) rotate(' + angleDeg + 'deg)';
    }
  };

  Hud.prototype.setSpeed = function (knots) {
    this.els.speed.textContent = Math.round(knots) + ' kn';
  };

  // Throttle bar (replaces the old boost meter): fill + percentage label.
  Hud.prototype.setThrottle = function (pct) {
    var p = Math.round(pct);
    this.els.boostFill.style.width = p + '%';
    this.els.boostFill.style.background = p > 85 ? '#ff7a3d' : '#00e5ff';
    if (this.els.boostLabel) this.els.boostLabel.textContent = 'THROTTLE ' + p + '%';
    // Keep the mobile slider thumb in step with keyboard throttle.
    if (p !== this._thrVal) {
      this._thrVal = p;
      if (this.els.thrFill) this.els.thrFill.style.height = (6 + p * 0.88) + '%';
      if (this.els.thrThumb) this.els.thrThumb.style.bottom = (2 + p * 1.24) + 'px';
    }
  };

  Hud.prototype.setAlt = function (feet) {
    this.els.alt.textContent = Math.round(feet) + ' FT';
  };

  Hud.prototype.setHeading = function (deg) {
    this.els.heading.textContent = String(deg).padStart(3, '0') + '° ' + util.compass(deg);
  };

  Hud.prototype.setTimer = function (seconds) {
    this.els.timer.textContent = util.fmtTime(seconds);
    this.els.timer.style.color = seconds <= 10 ? '#ff2d78' : '#ffffff';
  };

  // Mission label under the timer: 'RINGS 3/8' while flying the gates,
  // 'FINAL APPROACH' once all 8 are through.
  Hud.prototype.setMission = function (text) {
    if (this._missionText === text) return;
    this._missionText = text;
    this.els.stage.textContent = text;
  };

  Hud.prototype.setStall = function (on) {
    if (this.els.stall) this.els.stall.style.display = on ? 'block' : 'none';
  };

  Hud.prototype.setHint = function (text) {
    if (this.els.missionHint) this.els.missionHint.textContent = text;
  };

  Hud.prototype.showCockpit = function (on) {
    if (this.els.cockpit) this.els.cockpit.style.display = on ? 'flex' : 'none';
  };

  // Heading tape: scrolling degree strip, centre caret, cardinal letters.
  // Canvas is 560x72 (2x the CSS size) for crisp text; digits are drawn
  // large so the tape stays readable in a small feed thumbnail.
  Hud.prototype.drawTape = function (headingDeg) {
    var g = this._tapeCtx;
    if (!g) return;
    var W = 560, H = 72;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(18,8,38,0.55)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,229,255,0.5)';
    g.lineWidth = 2;
    g.stroke();
    var pxPerDeg = W / 120; // show +/-60 degrees around the heading
    g.textAlign = 'center';
    g.fillStyle = '#00e5ff';
    for (var d = -60; d <= 60; d += 10) {
      var deg = ((Math.round(headingDeg) + d) % 360 + 360) % 360;
      var x = W / 2 + d * pxPerDeg;
      var major = deg % 30 === 0;
      g.beginPath();
      g.moveTo(x, 10);
      g.lineTo(x, major ? 30 : 20);
      g.lineWidth = major ? 3.5 : 2;
      g.strokeStyle = major ? '#ffffff' : 'rgba(0,229,255,0.8)';
      g.stroke();
      if (major) {
        var label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W'
          : String(deg).padStart(3, '0');
        g.font = 'bold 26px system-ui, sans-serif';
        g.fillStyle = '#ffffff';
        g.fillText(label, x, 62);
      }
    }
    // Centre caret: the heading you are actually on.
    g.fillStyle = '#ff2d78';
    g.beginPath();
    g.moveTo(W / 2 - 11, 0);
    g.lineTo(W / 2 + 11, 0);
    g.lineTo(W / 2, 13);
    g.closePath();
    g.fill();
  };

  // Artificial horizon: sky/ground split rotated by bank, shifted by
  // pitch, with a fixed aircraft symbol in the middle.
  Hud.prototype.drawHorizon = function (bank, pitchAngle) {
    var g = this._horCtx;
    if (!g) return;
    var S = 112, C = S / 2, R = 52;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(C, C, R, 0, Math.PI * 2);
    g.clip();
    g.translate(C, C);
    g.rotate(-bank);
    g.translate(0, pitchAngle * 26);
    g.fillStyle = '#0e4a6b'; // sky
    g.fillRect(-60, -60, 120, 60);
    g.fillStyle = '#4a0e3a'; // ground
    g.fillRect(-60, 0, 120, 60);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-60, 0);
    g.lineTo(60, 0);
    g.stroke();
    g.restore();
    // Fixed aircraft symbol: wings + centre dot.
    g.strokeStyle = '#00e5ff';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(C - 30, C);
    g.lineTo(C - 8, C);
    g.moveTo(C + 8, C);
    g.lineTo(C + 30, C);
    g.stroke();
    g.fillStyle = '#ff2d78';
    g.beginPath();
    g.arc(C, C, 5, 0, Math.PI * 2);
    g.fill();
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
    this.showCockpit(false);
  };

  Hud.prototype.showPause = function (on) {
    this.els.pause.style.display = on ? 'flex' : 'none';
  };

  Hud.prototype.showOver = function (stats) {
    this.els.title.style.display = 'none';
    this.els.pause.style.display = 'none';
    if (this.els.overTitle) this.els.overTitle.textContent = stats.title || 'RUN OVER';
    this.els.overScore.textContent = util.fmtInt(stats.score);
    this.els.overRank.textContent = stats.rank;
    var colors = {
      LEGEND: '#ffd166', PERFECT: '#ffd166', ACE: '#00e5ff', GOOD: '#00e5ff',
      PRO: '#ff7a3d', ROUGH: '#ff7a3d', ROOKIE: '#c9b8ff',
    };
    this.els.overRank.style.color = colors[stats.rank] || '#ffffff';
    if (this.els.overGrade) {
      this.els.overGrade.textContent = stats.grade || '';
      this.els.overGrade.style.display = stats.grade ? 'block' : 'none';
    }
    // Four stat cells: value + label, both driven by the caller so the
    // mission-complete screen can show TIME BONUS instead of NEAR MISS.
    var vals = [this.els.statRings, this.els.statCombo, this.els.statNear, this.els.statSpeed];
    var labs = [this.els.statRingsL, this.els.statComboL, this.els.statNearL, this.els.statSpeedL];
    for (var i = 0; i < 4; i++) {
      if (stats.rows && stats.rows[i]) {
        vals[i].textContent = stats.rows[i].v;
        if (labs[i]) labs[i].textContent = stats.rows[i].l;
      }
    }
    this.els.overHi.textContent = stats.newBest
      ? '★ NEW BEST! ★'
      : 'BEST ' + util.fmtInt(stats.best);
    this.els.over.style.display = 'flex';
    this.els.pause.style.display = 'none';
    this.showCockpit(false);
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

  // Throttle slider (touch only): drag up for more throttle, down to idle.
  // Pointer events cover touch and mouse; the fill/thumb follow in
  // setThrottle(), so keyboard Shift/Ctrl stay in step too.
  Hud.prototype.wireThrottle = function (input) {
    var el = this.els.thrSlider;
    if (!el || !input) return;
    function setFromEvent(e) {
      var r = el.getBoundingClientRect();
      var f = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      input.setThrottle(f);
    }
    var dragging = false;
    el.addEventListener('pointerdown', function (e) {
      dragging = true;
      setFromEvent(e);
      e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) {
      if (dragging) setFromEvent(e);
    });
    window.addEventListener('pointerup', function () { dragging = false; });
    window.addEventListener('pointercancel', function () { dragging = false; });
  };

  // Mute button: toggles the synthwave music + SFX. The first tap also
  // initialises audio (a user gesture), so muting works from the title.
  Hud.prototype.wireMute = function (audio) {
    var btn = this.els.muteBtn;
    if (!btn) return;
    function refresh() {
      btn.textContent = audio.muted ? '🔇' : '🔊';
    }
    function toggle() {
      audio.init();
      audio.toggleMuted();
      refresh();
    }
    btn.addEventListener('click', toggle);
    btn.addEventListener('touchstart', function (e) { toggle(); e.preventDefault(); }, { passive: false });
    this._refreshMute = refresh;
  };

  Hud.prototype.setMutedLabel = function (muted) {
    if (this.els.muteBtn) this.els.muteBtn.textContent = muted ? '🔇' : '🔊';
  };

  // Help (?) panel: full controls list, one tap to open or close.
  Hud.prototype.wireHelp = function () {
    var btn = this.els.helpBtn;
    var panel = this.els.help;
    var close = this.els.helpClose;
    if (!btn || !panel) return;
    function show(on) {
      panel.style.display = on ? 'flex' : 'none';
    }
    btn.addEventListener('click', function () { show(panel.style.display !== 'flex'); });
    if (close) close.addEventListener('click', function () { show(false); });
    panel.addEventListener('click', function (e) {
      if (e.target === panel) show(false);
    });
  };

  global.NR = global.NR || {};
  global.NR.Hud = Hud;
})(window);
