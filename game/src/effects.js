// NEON RUSH — juice: particle bursts, wingtip trails, speed lines,
// camera shake and screen flash. All procedural, no assets.
(function (global) {
  'use strict';

  var THREE = global.THREE;

  function Effects(scene) {
    this.scene = scene;
    this.shakeAmount = 0;
    this.flashEl = document.getElementById('flash');
    // Particle pool: one Points cloud, positions recycled.
    var MAX = 600;
    this.pMax = MAX;
    this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX * 3);
    this.pCol = new Float32Array(MAX * 3);
    this.pVel = new Float32Array(MAX * 3);
    this.pLife = new Float32Array(MAX);
    this.pCursor = 0;
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    var pMat = new THREE.PointsMaterial({
      size: 1.6, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.pGeo, pMat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (var i = 0; i < MAX; i++) this.pPos[i * 3 + 1] = -9999;
    // Wingtip trails: two ribbon lines with a short history.
    this.trailLen = 26;
    this.trailL = this._makeTrail(0xff2d78);
    this.trailR = this._makeTrail(0x00e5ff);
    this.histL = [];
    this.histR = [];
    // Speed lines: streaks that rush past while boosting.
    var SMAX = 90;
    this.sGeo = new THREE.BufferGeometry();
    this.sPos = new Float32Array(SMAX * 6);
    this.sGeo.setAttribute('position', new THREE.BufferAttribute(this.sPos, 3));
    var sMat = new THREE.LineBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.speedLines = new THREE.LineSegments(this.sGeo, sMat);
    this.speedLines.frustumCulled = false;
    scene.add(this.speedLines);
    this.sMax = SMAX;
    this.sData = [];
    for (var s = 0; s < SMAX; s++) {
      this.sData.push({ x: 0, y: 0, z: 0, len: 4 });
    }
  }

  Effects.prototype._makeTrail = function (color) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(this.trailLen * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    var line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    return line;
  };

  Effects.prototype.burst = function (pos, colorHex, count, power) {
    var c = new THREE.Color(colorHex);
    for (var n = 0; n < count; n++) {
      var i = this.pCursor;
      this.pCursor = (this.pCursor + 1) % this.pMax;
      this.pPos[i * 3] = pos.x;
      this.pPos[i * 3 + 1] = pos.y;
      this.pPos[i * 3 + 2] = pos.z;
      var a = Math.random() * Math.PI * 2;
      var b = Math.random() * Math.PI - Math.PI / 2;
      var sp = (0.4 + Math.random() * 0.6) * power;
      this.pVel[i * 3] = Math.cos(a) * Math.cos(b) * sp;
      this.pVel[i * 3 + 1] = Math.sin(b) * sp;
      this.pVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
      this.pCol[i * 3] = c.r;
      this.pCol[i * 3 + 1] = c.g;
      this.pCol[i * 3 + 2] = c.b;
      this.pLife[i] = 0.5 + Math.random() * 0.5;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
  };

  Effects.prototype.update = function (dt, plane, boosting, speedNorm, time) {
    var i;
    // Particles: drift, fade by sinking.
    for (i = 0; i < this.pMax; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) {
        this.pPos[i * 3 + 1] = -9999;
        continue;
      }
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      this.pVel[i * 3 + 1] -= 4 * dt;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    // Trails follow the wingtips.
    var tips = plane.wingtipWorld({ l: new THREE.Vector3(), r: new THREE.Vector3() });
    this._pushTrail(this.histL, tips.l);
    this._pushTrail(this.histR, tips.r);
    this._writeTrail(this.trailL, this.histL);
    this._writeTrail(this.trailR, this.histR);
    // Speed lines: always a few at speed, a storm while boosting. They
    // hug the screen edges (x biased away from centre) so the middle
    // stays readable.
    var target = boosting ? 0.75 : 0.1 + speedNorm * 0.4;
    var mat = this.speedLines.material;
    mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
    if (mat.opacity > 0.02) {
      var pz = plane.pos.z;
      for (i = 0; i < this.sMax; i++) {
        var s = this.sData[i];
        if (s.z > pz + 12 || s.len <= 0) {
          // Bias spawn x toward the edges: |x| 18..45 more often than centre.
          var side = Math.random() < 0.5 ? -1 : 1;
          s.x = plane.pos.x + side * (18 + Math.random() * 30);
          s.y = 4 + Math.random() * 52;
          s.z = pz - 60 - Math.random() * 90;
          s.len = 5 + Math.random() * 9;
        }
        s.z += (140 + speedNorm * 160) * dt;
        this.sPos[i * 6] = s.x;
        this.sPos[i * 6 + 1] = s.y;
        this.sPos[i * 6 + 2] = s.z;
        this.sPos[i * 6 + 3] = s.x;
        this.sPos[i * 6 + 4] = s.y;
        this.sPos[i * 6 + 5] = s.z + s.len;
      }
      this.sGeo.attributes.position.needsUpdate = true;
    }
    // Shake decay — but boosting keeps a faint constant tremble.
    if (boosting) this.shakeAmount = Math.max(this.shakeAmount, 0.1);
    if (this.shakeAmount > 0) {
      this.shakeAmount = Math.max(boosting ? 0.1 : 0, this.shakeAmount - dt * 2.2);
    }
  };

  Effects.prototype._pushTrail = function (hist, p) {
    hist.unshift(p.x, p.y, p.z);
    if (hist.length > this.trailLen * 3) hist.length = this.trailLen * 3;
  };

  Effects.prototype._writeTrail = function (line, hist) {
    var attr = line.geometry.attributes.position;
    var arr = attr.array;
    for (var i = 0; i < this.trailLen * 3; i++) {
      arr[i] = i < hist.length ? hist[i] : (i >= 3 ? arr[i - 3] : 0);
    }
    attr.needsUpdate = true;
  };

  Effects.prototype.shake = function (amount) {
    this.shakeAmount = Math.min(1.2, this.shakeAmount + amount);
  };

  Effects.prototype.shakeOffset = function (time) {
    var a = this.shakeAmount;
    if (a <= 0) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * a * 1.6,
      y: (Math.random() - 0.5) * a * 1.6,
    };
  };

  Effects.prototype.flash = function (color, strength) {
    if (!this.flashEl) return;
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = String(strength);
    var el = this.flashEl;
    requestAnimationFrame(function () {
      el.style.transition = 'opacity 320ms ease-out';
      el.style.opacity = '0';
      setTimeout(function () { el.style.transition = ''; }, 340);
    });
  };

  global.NR = global.NR || {};
  global.NR.Effects = Effects;
})(window);
