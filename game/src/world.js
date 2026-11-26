// NEON RUSH — the synthwave world: sunset sky, striped sun, glowing grid,
// low-poly canyon walls, neon rings, obstacles and pickups.
// The player flies toward -Z; objects recycle from behind to ahead.
(function (global) {
  'use strict';

  var util = global.NR.util;
  var THREE = global.THREE;

  var CORRIDOR_X = 55;
  var MIN_Y = 5;
  var MAX_Y = 55;
  var RING_RADIUS = 7;
  var SPAWN_AHEAD = 420;

  function canvasTexture(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function makeSkyTexture() {
    return canvasTexture(16, 512, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0.0, '#0b0620');
      grad.addColorStop(0.35, '#2a0a4a');
      grad.addColorStop(0.62, '#7a1e6e');
      grad.addColorStop(0.78, '#ff2d78');
      grad.addColorStop(0.92, '#ff7a3d');
      grad.addColorStop(1.0, '#ffb347');
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
  }

  function makeSunTexture() {
    return canvasTexture(512, 512, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#ffe259');
      grad.addColorStop(0.45, '#ff7a3d');
      grad.addColorStop(1, '#ff2d78');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      g.fill();
      // Synthwave slits across the lower half.
      g.globalCompositeOperation = 'destination-out';
      var y = h * 0.52;
      var gap = 8;
      while (y < h) {
        g.fillRect(0, y, w, gap);
        y += gap + 22;
        gap += 5;
      }
      g.globalCompositeOperation = 'source-over';
    });
  }

  function makeGridTexture() {
    return canvasTexture(512, 512, function (g, w, h) {
      g.fillStyle = '#120826';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,45,120,0.85)';
      g.lineWidth = 3;
      for (var i = 0; i <= 8; i++) {
        var p = (i / 8) * w;
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
      }
      g.strokeStyle = 'rgba(0,229,255,0.55)';
      g.lineWidth = 1;
      for (var j = 0; j <= 32; j++) {
        var q = (j / 32) * w;
        g.beginPath(); g.moveTo(q, 0); g.lineTo(q, h); g.stroke();
        g.beginPath(); g.moveTo(0, q); g.lineTo(w, q); g.stroke();
      }
    });
  }

  function makeGlowTexture(color) {
    return canvasTexture(128, 128, function (g, w, h) {
      var grad = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grad.addColorStop(0, color);
      grad.addColorStop(0.35, color.replace('1)', '0.45)'));
      grad.addColorStop(1, color.replace('1)', '0)'));
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
    });
  }

  function World(scene) {
    this.scene = scene;
    this.rng = util.mulberry32(1);
    this.rings = [];
    this.obstacles = [];
    this.pickups = [];
    this.walls = [];
    this.nextRingIndex = 0;
    this.spawnCursor = 0;
    this.stage = 1;
    this._buildSky(scene);
    this._buildTerrain(scene);
    this._buildWalls(scene);
    this._buildPools(scene);
  }

  World.prototype._buildSky = function (scene) {
    var skyGeo = new THREE.SphereGeometry(900, 24, 16);
    var skyMat = new THREE.MeshBasicMaterial({
      map: makeSkyTexture(),
      side: THREE.BackSide,
      fog: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.sky);
    // Giant striped sun, far ahead.
    var sunMat = new THREE.MeshBasicMaterial({
      map: makeSunTexture(),
      transparent: true,
      fog: false,
    });
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(90, 48), sunMat);
    scene.add(this.sun);
    // Stars above.
    var starGeo = new THREE.BufferGeometry();
    var pos = new Float32Array(300 * 3);
    for (var i = 0; i < 300; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1600;
      pos[i * 3 + 1] = 120 + Math.random() * 500;
      pos[i * 3 + 2] = -Math.random() * 1400 - 100;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false,
      transparent: true, opacity: 0.8,
    }));
    scene.add(this.stars);
  };

  World.prototype._buildTerrain = function (scene) {
    var tex = makeGridTexture();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 40);
    this.gridTex = tex;
    var mat = new THREE.MeshBasicMaterial({ map: tex });
    var geo = new THREE.PlaneGeometry(700, 2400);
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    scene.add(this.ground);
    // Dark side haze planes so the horizon melts into fog.
    var hazeMat = new THREE.MeshBasicMaterial({
      color: 0x2a0a4a, transparent: true, opacity: 0.55, fog: false,
    });
    var haze = new THREE.Mesh(new THREE.PlaneGeometry(1400, 120), hazeMat);
    haze.position.set(0, 40, -800);
    this.haze = haze;
    scene.add(haze);
  };

  World.prototype._buildWalls = function (scene) {
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var matA = new THREE.MeshLambertMaterial({ color: 0x1c0b33, flatShading: true });
    var matB = new THREE.MeshLambertMaterial({ color: 0x2a0f45, flatShading: true });
    var matEdge = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    for (var i = 0; i < 44; i++) {
      var group = new THREE.Group();
      var h = 18 + Math.random() * 42;
      var w = 14 + Math.random() * 26;
      var d = 24 + Math.random() * 30;
      var block = new THREE.Mesh(geo, Math.random() < 0.5 ? matA : matB);
      block.scale.set(w, h, d);
      block.position.y = h / 2;
      group.add(block);
      var edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), matEdge);
      edge.position.y = h;
      group.add(edge);
      group.visible = true;
      scene.add(group);
      this.walls.push({ group: group, side: i % 2 === 0 ? -1 : 1, z: 0 });
    }
  };

  World.prototype._buildPools = function (scene) {
    // Rings: torus + glow sprite. Next ring is magenta, others cyan.
    var ringGeo = new THREE.TorusGeometry(RING_RADIUS, 0.55, 12, 40);
    var cyanMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    var magentaMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    var cyanGlow = new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(0,229,255,1)'),
      transparent: true, opacity: 0.55, depthWrite: false,
    });
    var magentaGlow = new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,45,120,1)'),
      transparent: true, opacity: 0.8, depthWrite: false,
    });
    for (var i = 0; i < 14; i++) {
      var mesh = new THREE.Mesh(ringGeo, cyanMat);
      var glow = new THREE.Sprite(cyanGlow);
      glow.scale.set(26, 26, 1);
      mesh.add(glow);
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({
        mesh: mesh, glow: glow, x: 0, y: 20, z: 0,
        resolved: true, active: false, cyanMat: cyanMat, magentaMat: magentaMat,
        cyanGlow: cyanGlow, magentaGlow: magentaGlow,
      });
    }
    // Obstacles: towers, arches, drones.
    var towerGeo = new THREE.BoxGeometry(6, 1, 6);
    var towerMat = new THREE.MeshLambertMaterial({ color: 0x241040, flatShading: true });
    var towerTopMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    var archGeo = new THREE.TorusGeometry(9, 1.1, 10, 32);
    var archMat = new THREE.MeshBasicMaterial({ color: 0xff7a3d });
    var droneGeo = new THREE.IcosahedronGeometry(2.2, 0);
    var droneMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    for (var j = 0; j < 22; j++) {
      var kind = j % 3;
      var obj;
      if (kind === 0) {
        var tower = new THREE.Group();
        var body = new THREE.Mesh(towerGeo, towerMat);
        body.scale.y = 30;
        body.position.y = 15;
        var top = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1, 6.6), towerTopMat);
        top.position.y = 30;
        tower.add(body);
        tower.add(top);
        tower.visible = false;
        scene.add(tower);
        obj = { mesh: tower, kind: 'tower', height: 30, baseX: 0, phase: Math.random() * 6 };
      } else if (kind === 1) {
        var arch = new THREE.Mesh(archGeo, archMat);
        arch.visible = false;
        scene.add(arch);
        obj = { mesh: arch, kind: 'arch', height: 0, baseX: 0, phase: Math.random() * 6 };
      } else {
        var drone = new THREE.Mesh(droneGeo, droneMat);
        var dglow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: makeGlowTexture('rgba(255,45,120,1)'),
          transparent: true, opacity: 0.6, depthWrite: false,
        }));
        dglow.scale.set(12, 12, 1);
        drone.add(dglow);
        drone.visible = false;
        scene.add(drone);
        obj = { mesh: drone, kind: 'drone', height: 0, baseX: 0, phase: Math.random() * 6 };
      }
      obj.x = 0; obj.y = 20; obj.z = 0;
      obj.active = false; obj.scored = false; obj.nearMissed = false;
      this.obstacles.push(obj);
    }
    // Pickups: orange octahedrons with glow.
    var pickGeo = new THREE.OctahedronGeometry(2.4, 0);
    var pickMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
    for (var k = 0; k < 8; k++) {
      var pick = new THREE.Mesh(pickGeo, pickMat);
      var pglow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('rgba(255,179,71,1)'),
        transparent: true, opacity: 0.7, depthWrite: false,
      }));
      pglow.scale.set(14, 14, 1);
      pick.add(pglow);
      pick.visible = false;
      scene.add(pick);
      this.pickups.push({ mesh: pick, x: 0, y: 20, z: 0, active: false, t: 0 });
    }
  };

  World.prototype.reset = function (seed, playerZ) {
    this.rng = util.mulberry32(seed);
    this.nextRingIndex = 0;
    this.spawnCursor = playerZ - 60;
    var i;
    for (i = 0; i < this.rings.length; i++) {
      this.rings[i].active = false;
      this.rings[i].resolved = true;
      this.rings[i].mesh.visible = false;
    }
    for (i = 0; i < this.obstacles.length; i++) {
      this.obstacles[i].active = false;
      this.obstacles[i].mesh.visible = false;
    }
    for (i = 0; i < this.pickups.length; i++) {
      this.pickups[i].active = false;
      this.pickups[i].mesh.visible = false;
    }
    // Lay out the first rings and walls ahead of the player.
    for (i = 0; i < this.walls.length; i++) {
      var w = this.walls[i];
      w.z = playerZ - 40 - Math.floor(i / 2) * 46;
      w.group.position.set(
        w.side * (78 + this.rng() * 40),
        0, w.z);
      w.group.scale.set(1, 0.8 + this.rng() * 0.9, 1);
    }
    this._spawnRing(playerZ - 70);
    for (var s = 0; s < 5; s++) this._spawnRing(this.spawnCursor);
    for (var o = 0; o < 8; o++) this._spawnObstacle(playerZ - 100 - o * 45);
    for (var p = 0; p < 3; p++) this._spawnPickup(playerZ - 130 - p * 90);
    this._markNextRing();
    // Position the sky, sun, stars, haze and ground now, not only on the
    // next update(): the very first frame (and any frozen ?shot= frame)
    // must already show the world in its proper place.
    this.update(0, playerZ, 1, 0);
  };

  World.prototype._spawnRing = function (z) {
    var ring = this.rings[this.nextRingIndex % this.rings.length];
    this.nextRingIndex++;
    var prev = this.rings[(this.nextRingIndex - 2 + this.rings.length) % this.rings.length];
    var px = prev && prev.active ? prev.x : 0;
    var py = prev && prev.active ? prev.y : 22;
    ring.x = util.clamp(px + (this.rng() - 0.5) * 44, -CORRIDOR_X + 8, CORRIDOR_X - 8);
    ring.y = util.clamp(py + (this.rng() - 0.5) * 22, MIN_Y + 6, MAX_Y - 6);
    ring.z = z;
    ring.resolved = false;
    ring.active = true;
    ring.mesh.visible = true;
    ring.mesh.position.set(ring.x, ring.y, ring.z);
    this.spawnCursor = Math.min(this.spawnCursor, z - 55 - this.rng() * 20);
    this._markNextRing();
    return ring;
  };

  World.prototype._markNextRing = function () {
    var best = null;
    for (var i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      if (!r.active || r.resolved) continue;
      if (!best || r.z > best.z) best = r; // nearest ahead = largest z (player moves -Z)
    }
    for (var j = 0; j < this.rings.length; j++) {
      var rj = this.rings[j];
      if (!rj.active) continue;
      var isNext = rj === best;
      rj.mesh.material = isNext ? rj.magentaMat : rj.cyanMat;
      rj.glow.material = isNext ? rj.magentaGlow : rj.cyanGlow;
      rj.mesh.scale.setScalar(isNext ? 1.12 : 1);
    }
    this.nextRing = best;
  };

  World.prototype._spawnObstacle = function (z) {
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.active) continue;
      o.active = true;
      o.scored = false;
      o.nearMissed = false;
      o.z = z;
      o.x = (this.rng() - 0.5) * 2 * (CORRIDOR_X - 6);
      if (o.kind === 'tower') {
        o.height = 16 + this.rng() * 30;
        o.y = 0;
        o.mesh.position.set(o.x, 0, z);
        o.mesh.children[0].scale.y = o.height;
        o.mesh.children[0].position.y = o.height / 2;
        o.mesh.children[1].position.y = o.height;
      } else if (o.kind === 'arch') {
        o.y = 6 + this.rng() * 30;
        o.mesh.position.set(o.x, o.y, z);
      } else {
        o.y = 10 + this.rng() * 34;
        o.baseX = o.x;
        o.mesh.position.set(o.x, o.y, z);
      }
      o.mesh.visible = true;
      return o;
    }
    return null;
  };

  World.prototype._spawnPickup = function (z) {
    for (var i = 0; i < this.pickups.length; i++) {
      var p = this.pickups[i];
      if (p.active) continue;
      p.active = true;
      p.x = (this.rng() - 0.5) * 2 * (CORRIDOR_X - 10);
      p.y = 12 + this.rng() * 30;
      p.z = z;
      p.mesh.visible = true;
      p.mesh.position.set(p.x, p.y, p.z);
      return p;
    }
    return null;
  };

  // Advance the world: recycle anything behind the player, keep spawning.
  World.prototype.update = function (dt, playerZ, stage, time) {
    this.stage = stage;
    var i, o;
    // Sky, sun and ground follow the player so the world never ends.
    this.sky.position.set(0, 0, playerZ - 200);
    this.sun.position.set(0, 62, playerZ - 720);
    this.stars.position.z = playerZ - 200;
    this.haze.position.z = playerZ - 780;
    this.ground.position.z = playerZ - 900;
    this.gridTex.offset.y = -playerZ / 60;
    // Walls recycle.
    for (i = 0; i < this.walls.length; i++) {
      var w = this.walls[i];
      if (w.z > playerZ + 60) {
        w.z -= 44 * 22;
        w.group.position.set(w.side * (78 + this.rng() * 40), 0, w.z);
      }
    }
    // Rings: spin gently; spawn more ahead as needed.
    for (i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      if (!r.active) continue;
      r.mesh.rotation.z += dt * 0.4;
      if (r.z > playerZ + 30) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
    if (this.spawnCursor > playerZ - SPAWN_AHEAD) this._spawnRing(this.spawnCursor);
    // Obstacles: recycle + animate drones; density grows with stage.
    var obstacleGap = stage >= 3 ? 34 : stage === 2 ? 42 : 52;
    for (i = 0; i < this.obstacles.length; i++) {
      o = this.obstacles[i];
      if (!o.active) continue;
      if (o.kind === 'drone') {
        o.mesh.position.x = o.baseX + Math.sin(time * 1.4 + o.phase) * 14;
        o.mesh.rotation.y += dt * 2;
        o.mesh.rotation.x += dt * 1.2;
      }
      if (o.z > playerZ + 30) {
        o.active = false;
        o.mesh.visible = false;
      }
    }
    // Keep a steady stream of obstacles ahead.
    var farthest = playerZ;
    for (i = 0; i < this.obstacles.length; i++) {
      if (this.obstacles[i].active) farthest = Math.min(farthest, this.obstacles[i].z);
    }
    if (farthest > playerZ - SPAWN_AHEAD) {
      this._spawnObstacle(farthest - obstacleGap - this.rng() * 20);
      if (stage >= 2 && this.rng() < 0.5) {
        this._spawnObstacle(farthest - obstacleGap * 0.6 - this.rng() * 20);
      }
    }
    // Pickups: bob, spin, recycle.
    for (i = 0; i < this.pickups.length; i++) {
      var p = this.pickups[i];
      if (!p.active) continue;
      p.t += dt;
      p.mesh.rotation.y += dt * 2.4;
      p.mesh.position.y = p.y + Math.sin(p.t * 2.2) * 1.2;
      if (p.z > playerZ + 30) {
        p.active = false;
        p.mesh.visible = false;
      }
    }
    var farPick = playerZ;
    for (i = 0; i < this.pickups.length; i++) {
      if (this.pickups[i].active) farPick = Math.min(farPick, this.pickups[i].z);
    }
    if (farPick > playerZ - 320) this._spawnPickup(farPick - 110 - this.rng() * 60);
  };

  // Ring crossing: returns {result:'pass'|'miss', ring} or null.
  World.prototype.checkRingCrossing = function (playerPos) {
    for (var i = 0; i < this.rings.length; i++) {
      var r = this.rings[i];
      if (!r.active || r.resolved) continue;
      if (playerPos.z <= r.z) {
        r.resolved = true;
        var dx = playerPos.x - r.x;
        var dy = playerPos.y - r.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var result = dist < RING_RADIUS + 0.8 ? 'pass' : 'miss';
        this._markNextRing();
        return { result: result, ring: r, dist: dist };
      }
    }
    return null;
  };

  // Obstacles: returns {type:'crash'|'near', obstacle} or null.
  World.prototype.checkHazards = function (playerPos, invulnerable) {
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (!o.active) continue;
      var dz = Math.abs(playerPos.z - o.z);
      if (dz > 6) continue;
      var dx = playerPos.x - o.x;
      var dy = playerPos.y - (o.kind === 'tower' ? o.height / 2 : o.y);
      var crash = false;
      var near = false;
      if (o.kind === 'tower') {
        if (Math.abs(dx) < 5 && playerPos.y < o.height + 1) crash = true;
        else if (Math.abs(dx) < 10 && playerPos.y < o.height + 6) near = true;
      } else if (o.kind === 'arch') {
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 7.4 && dist < 10.6) crash = true; // hit the tube
        else if (dist <= 7.4 && !o.scored) {
          o.scored = true;
          return { type: 'arch', obstacle: o };
        } else if (dist >= 10.6 && dist < 15) near = true;
      } else {
        var ddx = playerPos.x - o.mesh.position.x;
        var dist2 = Math.sqrt(ddx * ddx + dy * dy);
        if (dist2 < 3.6) crash = true;
        else if (dist2 < 7.5) near = true;
      }
      if (crash && !invulnerable) return { type: 'crash', obstacle: o };
      if (near && !o.nearMissed) {
        o.nearMissed = true;
        return { type: 'near', obstacle: o };
      }
    }
    return null;
  };

  World.prototype.checkPickups = function (playerPos) {
    for (var i = 0; i < this.pickups.length; i++) {
      var p = this.pickups[i];
      if (!p.active) continue;
      var dx = playerPos.x - p.mesh.position.x;
      var dy = playerPos.y - p.mesh.position.y;
      var dz = playerPos.z - p.z;
      if (dx * dx + dy * dy + dz * dz < 25) {
        p.active = false;
        p.mesh.visible = false;
        return p;
      }
    }
    return null;
  };

  global.NR = global.NR || {};
  global.NR.World = World;
  global.NR.CORRIDOR_X = CORRIDOR_X;
  global.NR.MIN_Y = MIN_Y;
  global.NR.MAX_Y = MAX_Y;
  global.NR.RING_RADIUS = RING_RADIUS;
})(window);
