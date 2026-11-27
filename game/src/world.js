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
  var MISSION_RINGS = 8; // the mission: fly 8 rings, then land
  var RUNWAY = { zStart: -680, zEnd: -1000, halfWidth: 8 }; // threshold .. far end

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
    this.mountains = [];
    this.nextRingIndex = 0;
    this.spawnCursor = 0;
    this.stage = 1;
    this.missionSpawned = 0;
    this.approach = false;
    this.runway = RUNWAY;
    this._buildSky(scene);
    this._buildTerrain(scene);
    this._buildWalls(scene);
    this._buildMountains(scene);
    this._buildRunway(scene);
    this._buildBeam(scene);
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
    var matA = new THREE.MeshLambertMaterial({ color: 0x2f1849, flatShading: true });
    var matB = new THREE.MeshLambertMaterial({ color: 0x3d1f5c, flatShading: true });
    var matEdge = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    // Bright neon outline so the walls never melt into the dusk sky.
    // Two concentric outlines: a full-opacity edge plus a slightly larger
    // additive glow line, so the rim reads thick even at thumbnail size.
    var edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02));
    var edgeMat = new THREE.LineBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 1.0, fog: false });
    var edgeGlowMat = new THREE.LineBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (var i = 0; i < 44; i++) {
      var group = new THREE.Group();
      var h = 18 + Math.random() * 42;
      var w = 14 + Math.random() * 26;
      var d = 24 + Math.random() * 30;
      var block = new THREE.Mesh(geo, Math.random() < 0.5 ? matA : matB);
      block.scale.set(w, h, d);
      block.position.y = h / 2;
      // Edges as a child of the block: they inherit its scale, so one
      // unit outline fits every wall.
      block.add(new THREE.LineSegments(edgeGeo, edgeMat));
      var glow = new THREE.LineSegments(edgeGeo, edgeGlowMat);
      glow.scale.set(1.05, 1.05, 1.05);
      block.add(glow);
      group.add(block);
      var edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), matEdge);
      edge.position.y = h;
      group.add(edge);
      group.visible = true;
      scene.add(group);
      this.walls.push({ group: group, side: i % 2 === 0 ? -1 : 1, z: 0 });
    }
  };

  // Low-poly neon mountains beyond the canyon walls: depth on both sides.
  // Cones with bright ridge outlines, recycled like the walls.
  World.prototype._buildMountains = function (scene) {
    var geo = new THREE.ConeGeometry(1, 1, 5);
    var matA = new THREE.MeshLambertMaterial({ color: 0x241338, flatShading: true });
    var matB = new THREE.MeshLambertMaterial({ color: 0x2f1a4d, flatShading: true });
    var edgeGeo = new THREE.EdgesGeometry(new THREE.ConeGeometry(1.02, 1.02, 5));
    var edgeMatA = new THREE.LineBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.95, fog: false });
    var edgeMatB = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8, fog: false });
    for (var i = 0; i < 14; i++) {
      var group = new THREE.Group();
      var h = 40 + Math.random() * 80;
      var w = 30 + Math.random() * 40;
      var cone = new THREE.Mesh(geo, Math.random() < 0.5 ? matA : matB);
      cone.scale.set(w, h, w * (0.7 + Math.random() * 0.6));
      cone.position.y = h / 2 - 2;
      cone.add(new THREE.LineSegments(edgeGeo, Math.random() < 0.5 ? edgeMatA : edgeMatB));
      group.add(cone);
      scene.add(group);
      this.mountains.push({ group: group, side: i % 2 === 0 ? -1 : 1, z: 0 });
    }
  };

  // The runway: a fixed landmark at the end of the mission course.
  // Dark strip, cyan edge lines, dashed centreline, threshold bars,
  // gold approach lights — visible from the final approach.
  World.prototype._buildRunway = function (scene) {
    var group = new THREE.Group();
    var midZ = (RUNWAY.zStart + RUNWAY.zEnd) / 2;
    var len = RUNWAY.zStart - RUNWAY.zEnd;
    var asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.halfWidth * 2, len),
      new THREE.MeshBasicMaterial({ color: 0x1a0f2e })
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.06, midZ);
    group.add(asphalt);
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    [-1, 1].forEach(function (s) {
      var edge = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, len), edgeMat);
      edge.position.set(s * RUNWAY.halfWidth, 0.12, midZ);
      group.add(edge);
    });
    var dashMat = new THREE.MeshBasicMaterial({ color: 0xe8ecf5 });
    for (var i = 0; i < 8; i++) {
      var dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 12), dashMat);
      dash.position.set(0, 0.12, RUNWAY.zStart - 24 - i * 36);
      group.add(dash);
    }
    var thrMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-6, -2, 2, 6].forEach(function (x) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 6), thrMat);
      bar.position.set(x, 0.12, RUNWAY.zStart - 6);
      group.add(bar);
    });
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    var lightGeo = new THREE.SphereGeometry(0.6, 8, 6);
    [-1, 1].forEach(function (s) {
      [-700, -720, -740].forEach(function (z) {
        var l = new THREE.Mesh(lightGeo, lightMat);
        l.position.set(s * (RUNWAY.halfWidth + 1.5), 0.6, z);
        group.add(l);
      });
    });
    scene.add(group);
    this.runwayGroup = group;
  };

  // Guide beam: a thin additive line from the jet to the next target
  // (next ring, or the runway threshold on final approach) plus a tall
  // glowing pillar standing on that target so it reads from far away.
  World.prototype._buildBeam = function (scene) {
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.beam = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0x00e5ff, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    this.beam.frustumCulled = false;
    this.beam.visible = false;
    scene.add(this.beam);
    this.beamPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 80, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2d78, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, fog: false,
      })
    );
    this.beamPillar.visible = false;
    scene.add(this.beamPillar);
  };

  World.prototype.setBeam = function (from, to, colorHex, visible) {
    if (!visible || !from || !to) {
      this.beam.visible = false;
      return;
    }
    var arr = this.beam.geometry.attributes.position.array;
    arr[0] = from.x; arr[1] = from.y; arr[2] = from.z;
    arr[3] = to.x; arr[4] = to.y; arr[5] = to.z;
    this.beam.geometry.attributes.position.needsUpdate = true;
    this.beam.material.color.setHex(colorHex);
    this.beam.visible = true;
  };

  World.prototype.setPillar = function (x, y, z, colorHex) {
    this.beamPillar.position.set(x, y, z);
    this.beamPillar.material.color.setHex(colorHex);
    this.beamPillar.visible = true;
  };

  World.prototype._buildPools = function (scene) {
    // Rings: torus + glow sprite. Next ring is magenta, chain rings gold,
    // others cyan.
    var ringGeo = new THREE.TorusGeometry(RING_RADIUS, 0.55, 12, 40);
    var cyanMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    var magentaMat = new THREE.MeshBasicMaterial({ color: 0xff2d78 });
    var goldMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    var cyanGlow = new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(0,229,255,1)'),
      transparent: true, opacity: 0.55, depthWrite: false,
    });
    var magentaGlow = new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,45,120,1)'),
      transparent: true, opacity: 0.8, depthWrite: false,
    });
    var goldGlow = new THREE.SpriteMaterial({
      map: makeGlowTexture('rgba(255,209,102,1)'),
      transparent: true, opacity: 0.75, depthWrite: false,
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
        resolved: true, active: false, chain: false,
        cyanMat: cyanMat, magentaMat: magentaMat, goldMat: goldMat,
        cyanGlow: cyanGlow, magentaGlow: magentaGlow, goldGlow: goldGlow,
      });
    }
    // Obstacles: towers, arches, drones.
    var towerGeo = new THREE.BoxGeometry(6, 1, 6);
    var towerMat = new THREE.MeshLambertMaterial({ color: 0x3a1c60, flatShading: true });
    var towerTopMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    // Bright cyan outline on every tower so it never blends into the sky,
    // plus a slightly larger additive glow line for a thicker rim.
    var towerEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(6.2, 1.02, 6.2));
    var towerEdgeMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 1.0, fog: false });
    var towerGlowMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
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
        // Outline rides on the body and stretches with it, plus a
        // slightly larger additive glow line for a thicker neon rim.
        body.add(new THREE.LineSegments(towerEdgeGeo, towerEdgeMat));
        var towerGlow = new THREE.LineSegments(towerEdgeGeo, towerGlowMat);
        towerGlow.scale.set(1.04, 1.04, 1.04);
        body.add(towerGlow);
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
    // RUSH power-ups: big gold stars. Collect one for 5s of invincibility
    // plus double score. Rare — about one every 400 units.
    var rushGeo = new THREE.OctahedronGeometry(3.6, 0);
    var rushMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    this.rush = [];
    for (var q = 0; q < 3; q++) {
      var star = new THREE.Mesh(rushGeo, rushMat);
      var rglow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('rgba(255,209,102,1)'),
        transparent: true, opacity: 0.85, depthWrite: false,
      }));
      rglow.scale.set(24, 24, 1);
      star.add(rglow);
      star.visible = false;
      scene.add(star);
      this.rush.push({ mesh: star, x: 0, y: 20, z: 0, active: false, t: 0 });
    }
  };

  World.prototype.reset = function (seed, playerZ) {
    this.rng = util.mulberry32(seed);
    this.nextRingIndex = 0;
    this.spawnCursor = playerZ - 60;
    this.spawnedRings = 0; // first rings are a gentle line (teaching phase)
    this.missionSpawned = 0; // the mission lays out exactly 8 rings, no more
    this.approach = false;
    this.chainLeft = 0; // remaining rings of a bonus chain
    var i;
    for (i = 0; i < this.rings.length; i++) {
      this.rings[i].active = false;
      this.rings[i].resolved = true;
      this.rings[i].chain = false;
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
    for (i = 0; i < this.rush.length; i++) {
      this.rush[i].active = false;
      this.rush[i].mesh.visible = false;
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
    for (i = 0; i < this.mountains.length; i++) {
      var m = this.mountains[i];
      m.z = playerZ - 60 - Math.floor(i / 2) * 70;
      m.group.position.set(m.side * (130 + this.rng() * 130), 0, m.z);
    }
    this.beam.visible = false;
    this.beamPillar.visible = false;
    this._spawnRing(playerZ - 70);
    for (var s = 0; s < 5; s++) this._spawnRing(this.spawnCursor);
    for (var o = 0; o < 8; o++) this._spawnObstacle(playerZ - 100 - o * 45);
    for (var p = 0; p < 3; p++) this._spawnPickup(playerZ - 130 - p * 90);
    this._spawnRush(playerZ - 400);
    this._markNextRing();
    // Position the sky, sun, stars, haze and ground now, not only on the
    // next update(): the very first frame (and any frozen ?shot= frame)
    // must already show the world in its proper place.
    this.update(0, playerZ, 1, 0);
  };

  // Ring 8 is through: stop spawning rings, move the beacon to the
  // runway threshold — the mission is now the landing.
  World.prototype.enterApproach = function () {
    this.approach = true;
    this._markNextRing();
  };

  World.prototype._spawnRing = function (z) {
    var ring = this.rings[this.nextRingIndex % this.rings.length];
    this.nextRingIndex++;
    var prev = this.rings[(this.nextRingIndex - 2 + this.rings.length) % this.rings.length];
    var px = prev && prev.active ? prev.x : 0;
    var py = prev && prev.active ? prev.y : 22;
    // First 10 seconds are a gentle line (small steps, easy to follow);
    // bonus chains are gentle too. Later rings wander and spread wider.
    var gentle = this.spawnedRings < 6;
    var chain = false;
    var gap = 50 + this.rng() * (20 + this.stage * 6);
    if (this.chainLeft > 0) {
      chain = true;
      this.chainLeft--;
      gap = 42;
    } else if (!gentle && this.rng() < 0.16) {
      // Start a 3-ring bonus chain (this ring + the next two).
      chain = true;
      this.chainLeft = 2;
      gap = 42;
    }
    var stepX = gentle || chain ? 10 : 44;
    var stepY = gentle || chain ? 5 : 22;
    ring.x = util.clamp(px + (this.rng() - 0.5) * stepX, -CORRIDOR_X + 8, CORRIDOR_X - 8);
    ring.y = util.clamp(py + (this.rng() - 0.5) * stepY, MIN_Y + 6, MAX_Y - 6);
    ring.z = z;
    ring.resolved = false;
    ring.active = true;
    ring.chain = chain;
    ring.mesh.visible = true;
    ring.mesh.position.set(ring.x, ring.y, ring.z);
    this.spawnedRings++;
    this.missionSpawned++;
    this.spawnCursor = Math.min(this.spawnCursor, z - gap);
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
      rj.mesh.material = isNext ? rj.magentaMat : rj.chain ? rj.goldMat : rj.cyanMat;
      rj.glow.material = isNext ? rj.magentaGlow : rj.chain ? rj.goldGlow : rj.cyanGlow;
      rj.mesh.scale.setScalar(isNext ? 1.12 : 1);
    }
    this.nextRing = best;
    // The beacon pillar stands on the next target: the next ring, or the
    // runway threshold once the rings are done.
    if (best) {
      this.setPillar(best.x, best.y, best.z, 0xff2d78);
    } else if (this.approach) {
      this.setPillar(0, 40, RUNWAY.zStart, 0xffd166);
    } else {
      this.beamPillar.visible = false;
    }
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
      // Never block the runway: an obstacle over the strip re-rolls
      // clear of it so the final approach is always landable.
      if (z < RUNWAY.zStart + 20 && z > RUNWAY.zEnd - 20 && Math.abs(o.x) < 18) {
        o.x = (o.x < 0 ? -1 : 1) * (20 + this.rng() * 20);
      }
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

  World.prototype._spawnRush = function (z) {
    for (var i = 0; i < this.rush.length; i++) {
      var r = this.rush[i];
      if (r.active) continue;
      r.active = true;
      r.x = (this.rng() - 0.5) * 2 * (CORRIDOR_X - 14);
      r.y = 14 + this.rng() * 28;
      r.z = z;
      r.mesh.visible = true;
      r.mesh.position.set(r.x, r.y, r.z);
      return r;
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
    // The sun pulses slowly — a living horizon, not a poster.
    var sunPulse = 1 + 0.025 * Math.sin(time * 0.9);
    this.sun.scale.set(sunPulse, sunPulse, 1);
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
    // Mountains recycle on the same rhythm, further out.
    for (i = 0; i < this.mountains.length; i++) {
      var mn = this.mountains[i];
      if (mn.z > playerZ + 60) {
        mn.z -= 44 * 22;
        mn.group.position.set(mn.side * (130 + this.rng() * 130), 0, mn.z);
      }
    }
    // The beacon pillar breathes so it reads from far away.
    if (this.beamPillar.visible) {
      this.beamPillar.material.opacity = 0.18 + 0.08 * Math.sin(time * 2);
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
    // The next ring glows brighter and grows slightly as it closes in,
    // so the player always knows exactly where to aim.
    if (this.nextRing && this.nextRing.active) {
      var n = this.nextRing;
      var closeness = util.clamp(1 - (playerZ - n.z) / 220, 0, 1);
      n.mesh.scale.setScalar(1.12 + closeness * 0.28);
      n.glow.material.opacity = 0.8 + closeness * 0.2;
    }
    if (this.spawnCursor > playerZ - SPAWN_AHEAD && this.missionSpawned < MISSION_RINGS) this._spawnRing(this.spawnCursor);
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
    // RUSH stars: spin fast, recycle, keep one in play far ahead.
    for (i = 0; i < this.rush.length; i++) {
      var ru = this.rush[i];
      if (!ru.active) continue;
      ru.t += dt;
      ru.mesh.rotation.y += dt * 3.2;
      ru.mesh.rotation.x += dt * 1.4;
      ru.mesh.position.y = ru.y + Math.sin(ru.t * 2.6) * 1.5;
      if (ru.z > playerZ + 30) {
        ru.active = false;
        ru.mesh.visible = false;
      }
    }
    var farRush = playerZ;
    for (i = 0; i < this.rush.length; i++) {
      if (this.rush[i].active) farRush = Math.min(farRush, this.rush[i].z);
    }
    if (farRush > playerZ - 500) this._spawnRush(farRush - 420 - this.rng() * 120);
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

  World.prototype.checkRush = function (playerPos) {
    for (var i = 0; i < this.rush.length; i++) {
      var r = this.rush[i];
      if (!r.active) continue;
      var dx = playerPos.x - r.mesh.position.x;
      var dy = playerPos.y - r.mesh.position.y;
      var dz = playerPos.z - r.z;
      if (dx * dx + dy * dy + dz * dz < 49) {
        r.active = false;
        r.mesh.visible = false;
        return r;
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
  global.NR.MISSION_RINGS = MISSION_RINGS;
  global.NR.RUNWAY = RUNWAY;
})(window);
