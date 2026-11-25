/* Boundary Blast — 3D stadium, players and animation (uses gl3d.js). */
(function () {
  'use strict';
  const V = GL3D.V, UP = [0, 1, 0];
  const GC = [0, 0, 10.06], ROPE = 66, BAT_Z = 18.6, STUMPS_Z = 20.12, ORIGIN_Z = 19.05;

  /* ================= textures ================= */
  function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function grassTex() {
    const [c, g] = cnv(1024, 1024), r = rnd(7), S = 1024 / (2 * 76);
    for (let i = 0; i < 30; i++) { g.fillStyle = i % 2 ? '#2F8A4A' : '#38995A'; g.fillRect(i * 1024 / 30, 0, 1024 / 30 + 1, 1024); }
    for (let i = 0; i < 26000; i++) { g.fillStyle = r() < .5 ? 'rgba(10,40,15,.10)' : 'rgba(170,230,150,.07)'; g.fillRect(r() * 1024, r() * 1024, 2, 2); }
    // 30-yard circle (dashed), centred on the ground
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.2; g.setLineDash([9, 9]); g.beginPath(); g.arc(512, 512, 27.4 * S, 0, 7); g.stroke(); g.setLineDash([]);
    // worn areas at both ends of the pitch
    [[0, 12], [0, -12]].forEach(([x, z]) => { const gr = g.createRadialGradient(512 + x * S, 512 + z * S, 2, 512 + x * S, 512 + z * S, 7 * S); gr.addColorStop(0, 'rgba(160,150,90,.35)'); gr.addColorStop(1, 'rgba(160,150,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024); });
    return c;
  }
  function pitchTex() {
    const [c, g] = cnv(128, 1024), r = rnd(3);
    const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#B89A68'); gr.addColorStop(.5, '#D2BA8A'); gr.addColorStop(1, '#B89A68'); g.fillStyle = gr; g.fillRect(0, 0, 128, 1024);
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() < .5 ? 'rgba(90,60,30,.12)' : 'rgba(255,240,210,.12)'; g.fillRect(r() * 128, r() * 1024, 1.5, 1.5); }
    for (let i = 0; i < 40; i++) { const y = r() < .5 ? 60 + r() * 140 : 830 + r() * 140; g.fillStyle = 'rgba(110,80,45,.18)'; g.beginPath(); g.ellipse(30 + r() * 68, y, 6 + r() * 8, 3 + r() * 4, 0, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(110,160,80,.12)'; g.fillRect(0, 0, 10, 1024); g.fillRect(118, 0, 10, 1024);
    return c;
  }
  function crowdTex() {
    const [c, g] = cnv(1024, 256), r = rnd(11);
    g.fillStyle = '#1B2238'; g.fillRect(0, 0, 1024, 256);
    const cols = ['#F0453A', '#FFC94A', '#2E6BEA', '#F4F4F4', '#19C37D', '#FF8A2B', '#8E6BFF', '#4FC3F7', '#E64A8B', '#2A2A2A', '#C9A27A'];
    for (let row = 0; row < 32; row++) {
      const y = row * 8; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y + 6, 1024, 2);
      for (let x = 0; x < 1024; x += 4 + r() * 2) { if (r() < .12) continue; g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, y + 1 + r() * 1.5, 3, 4); g.fillStyle = '#6B4A35'; g.fillRect(x + .5, y, 2, 1.6); }
    }
    return c;
  }
  function boardTex() {
    const [c, g] = cnv(1024, 64);
    const gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#1240A8'); gr.addColorStop(1, '#0A2464'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 64);
    g.font = '900 38px system-ui, sans-serif'; g.textBaseline = 'middle';
    const items = [['BOUNDARY BLAST', '#FFC94A'], ['NIGHT CRICKET', '#FFFFFF'], ['SIX = ⚡', '#FF8A2B']]; let x = 14;
    items.forEach(([t, col]) => { g.fillStyle = col; g.fillText(t, x, 34); x += g.measureText(t).width + 40; });
    return c;
  }
  function roofTex() {
    const [c, g] = cnv(256, 64); g.fillStyle = '#1A1F2B'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 256; i += 16) { g.fillStyle = '#2A3142'; g.fillRect(i, 0, 3, 64); }
    g.fillStyle = '#FFF8E0'; for (let i = 6; i < 256; i += 32) g.fillRect(i, 52, 12, 4);
    return c;
  }

  /* ================= stadium ================= */
  const S = {};
  function init(R) {
    const G = R.G;
    S.tex = { grass: R.texture(grassTex(), false), pitch: R.texture(pitchTex(), false), crowd: R.texture(crowdTex(), true), board: R.texture(boardTex(), true), roof: R.texture(roofTex(), true) };
    S.dome = G.dome([0.015, 0.03, 0.08], [0.05, 0.09, 0.2], [0.10, 0.15, 0.28]);
    S.tier1 = G.band(75, 0.8, 95, 15); S.face1 = G.band(95, 15, 96, 18.5); S.tier2 = G.band(96, 18.5, 116, 34);
    S.roof = G.band(108, 41, 126, 43.5); S.wall = G.band(75, 0, 75, 0.8);
    S.boards = G.band(72.6, 0, 72.6, 0.95, 160); S.rope = G.band(ROPE, 0.0, ROPE, 0.09, 160); S.ropeTop = G.band(ROPE - 0.15, 0.09, ROPE + 0.15, 0.09, 160);
    S.towers = [40, 140, 220, 320].map(a => { const t = a * Math.PI / 180; return [GC[0] + Math.cos(t) * 104, 0, GC[2] + Math.sin(t) * 104]; });
  }
  const MAT = {
    pitch: () => ({ tex: S.tex.pitch, c: [1, 1, 1] }), white: { c: [0.96, 0.96, 0.96], em: 0.25 }
  };
  function drawStadium(R) {
    const M = R.M;
    R.draw(S.dome, M.basis([520, 0, 0], [0, 520, 0], [0, 0, 520], [GC[0], -30, GC[2]]), { c: [1, 1, 1], em: 1 });
    const id = M.basis([1, 0, 0], [0, 1, 0], [0, 0, 1], GC);
    // outfield + grass outside the rope
    R.draw(R.meshes.disc, M.basis([76, 0, 0], [0, 1, 0], [0, 0, 76], GC), { tex: S.tex.grass, detail: true });
    R.draw(R.meshes.disc, M.basis([130, 0, 0], [0, 1, 0], [0, 0, 130], [GC[0], -0.02, GC[2]]), { c: [0.10, 0.22, 0.13] });
    R.draw(S.rope, id, { c: [0.95, 0.95, 0.98], em: 0.3 }); R.draw(S.ropeTop, id, { c: [0.95, 0.95, 0.98], em: 0.3 });
    R.draw(S.boards, id, { tex: S.tex.board, uv: [10, 1], em: 0.9 });
    R.draw(S.wall, id, { c: [0.08, 0.1, 0.16] });
    R.draw(S.tier1, id, { tex: S.tex.crowd, uv: [9, 2], c: [1.2, 1.2, 1.2], em: 0.45, anim: true });
    R.draw(S.face1, id, { tex: S.tex.board, uv: [12, 1], em: 0.85 });
    R.draw(S.tier2, id, { tex: S.tex.crowd, uv: [10, 2], c: [1.1, 1.1, 1.15], em: 0.4, anim: true });
    R.draw(S.roof, id, { tex: S.tex.roof, uv: [30, 1], c: [0.8, 0.8, 0.85] });
    // sightscreens behind each end
    [-1, 1].forEach(s => R.box([GC[0], 5, GC[2] + s * 73.2], 22, 10, 0.6, { c: [0.03, 0.035, 0.05] }));
    // pitch, creases, stumps at the bowler's end
    R.draw(R.meshes.plane, M.basis([3.05, 0, 0], [0, 1, 0], [0, 0, 24.5], [0, 0.008, 10.06]), MAT.pitch());
    const L = (x, z, w, d) => R.box([x, 0.014, z], w, 0.004, d, MAT.white);
    [0, 20.12].forEach(z => { L(0, z, 2.64, 0.05); });
    [1.22, 20.12 - 1.22].forEach(z => L(0, z, 3.66, 0.05));
    [-1, 1].forEach(s => { L(s * 1.32, 20.12 - 0.61 + 0.3, 0.05, 1.83); L(s * 1.32, 0.61 - 0.3, 0.05, 1.83); });
    // floodlight towers
    S.towers.forEach(p => {
      R.draw(R.meshes.cyl, M.basis([0.7, 0, 0], [0, 58, 0], [0, 0, 0.7], p), { c: [0.2, 0.22, 0.27] });
      const to = V.norm(V.sub([GC[0], 0, GC[2]], p)), side = V.norm(V.cross(UP, to));
      R.obox([p[0], 60, p[2]], side, V.norm([to[0] * .6, 1, to[2] * .6]), 16, 9, 1.2, { c: [0.15, 0.16, 0.2] });
      for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
        const q = V.add(V.add([p[0], 60 + j * 2.6, p[2]], V.mul(side, i * 3)), V.mul(to, 0.9));
        R.sprite(q, 3.4, { c: [1, 0.97, 0.86], em: 1, a: 0.95, add: true, tex: R.blobTex });
      }
    });
  }
  function drawGlows(R) {
    S.towers.forEach(p => { const to = V.norm(V.sub([GC[0], 0, GC[2]], p)); R.sprite(V.madd([p[0], 60, p[2]], to, 3), 70, { c: [1, 0.95, 0.8], em: 1, a: 0.32, add: true, tex: R.blobTex }); });
  }

  /* ================= stumps ================= */
  function drawStumps(R, z, k) {
    const wood = { c: [0.97, 0.93, 0.80], em: 0.15, spec: 0.3 }, bail = { c: [0.92, 0.78, 0.45], em: 0.15 };
    [-0.114, 0, 0.114].forEach((x, i) => {
      const tilt = k ? (i - 1) * 0.6 * k + (i === 1 ? 0.5 * k : 0) : 0, back = k ? 0.35 * k : 0;
      const base = [x, 0, z], top = [x + Math.sin(tilt) * 0.71, Math.cos(Math.min(1.2, Math.abs(tilt) + back)) * 0.71, z + Math.sin(back) * 0.71];
      R.seg(base, top, 0.018, wood);
    });
    if (!k) { [-0.057, 0.057].forEach(x => R.box([x, 0.725, z], 0.11, 0.022, 0.022, bail)); }
    else { [-1, 1].forEach(s => { const t = Math.min(1, k); R.box([s * (0.2 + 1.4 * t), 0.73 + Math.sin(t * Math.PI) * 1.1 - t * 0.7, z + 1.8 * t], 0.11, 0.022, 0.022, bail, t * 7 * s); }); }
  }

  /* ================= figures ================= */
  const KITS = {
    bat: { key: 'bat', shirt: [0.10, 0.28, 0.80], pants: [0.08, 0.16, 0.45], trim: [1, 0.76, 0.18], skin: [0.55, 0.37, 0.26], hair: '#14100C', beard: true, head: 'helmet', helmet: [0.05, 0.10, 0.27], pads: true,
           gloves: [0.97, 0.97, 0.97], gloveTrim: [0.1, 0.25, 0.75], shoes: [0.96, 0.96, 0.96], sponsor: 'BLAST', no: '7', back: ['BLAST', '7'], pattern: true, band: true },
    field: { key: 'field', shirt: [0.78, 0.12, 0.12], pants: [0.55, 0.07, 0.09], trim: [1, 1, 1], skin: [0.52, 0.35, 0.24], hair: '#16110D', head: 'cap', cap: [0.66, 0.07, 0.07], shoes: [0.95, 0.95, 0.95], sponsor: 'STRIKERS', back: ['KHAN', '18'], pattern: true },
    field2: { key: 'field2', shirt: [0.78, 0.12, 0.12], pants: [0.55, 0.07, 0.09], trim: [1, 1, 1], skin: [0.66, 0.47, 0.34], hair: '#2A1C12', beard: true, head: 'cap', cap: [0.66, 0.07, 0.07], shades: true, shoes: [0.95, 0.95, 0.95], sponsor: 'STRIKERS', back: ['SINGH', '33'], pattern: true },
    field3: { key: 'field3', shirt: [0.78, 0.12, 0.12], pants: [0.55, 0.07, 0.09], trim: [1, 1, 1], skin: [0.42, 0.28, 0.2], hair: '#0E0B08', head: 'cap', cap: [0.66, 0.07, 0.07], shoes: [0.95, 0.95, 0.95], sponsor: 'STRIKERS', back: ['DAS', '9'], pattern: true },
    keeper: { key: 'keeper', shirt: [0.78, 0.12, 0.12], pants: [0.55, 0.07, 0.09], trim: [1, 1, 1], skin: [0.56, 0.38, 0.27], hair: '#16110D', head: 'helmet', helmet: [0.6, 0.06, 0.06], pads: true, gloves: [0.96, 0.95, 0.9], gloveTrim: [0.75, 0.1, 0.1], bigGloves: true,
              shoes: [0.95, 0.95, 0.95], longSleeve: true, sponsor: 'STRIKERS', back: ['PANT', '17'], pattern: true },
    ump: { key: 'ump', shirt: [0.86, 0.9, 0.96], pants: [0.09, 0.09, 0.12], trim: [0.2, 0.3, 0.6], skin: [0.5, 0.34, 0.24], hair: '#8A8A88', head: 'hat', cap: [0.95, 0.95, 0.93], shoes: [0.08, 0.08, 0.1], longSleeve: true, sponsor: 'UMPIRE', ink: '#1C2B55', beard: true }
  };
  function ik(a, t, l1, l2, pole) {
    let d = V.sub(t, a), L = V.len(d); const max = (l1 + l2) * 0.999; if (L > max) { t = V.madd(a, d, max / L); d = V.sub(t, a); L = max; }
    const dir = V.mul(d, 1 / (L || 1)), x = (l1 * l1 - l2 * l2 + L * L) / (2 * (L || 1)), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let p = V.sub(pole, V.mul(dir, V.dot(pole, dir))); p = V.len(p) < 1e-4 ? [0, -1, 0] : V.norm(p);
    return [V.madd(V.madd(a, dir, x), p, h), t];
  }
  function drawFigure(R, J, kit) { Char.draw(R, J, kit); }
  function drawBat(R, top, dir, faceN) {
    const fn = V.norm(V.sub(faceN, V.mul(dir, V.dot(faceN, dir)))), wd = V.norm(V.cross(dir, fn));
    R.seg(V.madd(top, dir, -0.02), V.madd(top, dir, 0.3), 0.019, { c: [0.08, 0.08, 0.1] });
    const c = V.madd(top, dir, 0.3 + 0.28);
    R.obox(c, wd, dir, 0.108, 0.56, 0.042, { c: [0.88, 0.76, 0.52], spec: 0.35 });
    R.obox(V.madd(c, fn, -0.024), wd, dir, 0.06, 0.5, 0.02, { c: [0.8, 0.66, 0.42] });
    R.obox(V.madd(V.madd(c, fn, 0.022), dir, -0.12), wd, dir, 0.095, 0.16, 0.004, { c: [0.1, 0.3, 0.85], em: 0.3 });
  }

  /* ---------- batsman: keyframed poses in a local frame (u = towards bowler, v = towards the off side / chest, y up) ---------- */
  /* Batting is authored in two layers:
     BODY  = footwork (feet, hips, trunk, head) — the batsman reads the ball and moves into position first;
     SWING = hands, bat direction, bat-face aim and shoulder opening — driven by the HIT press.
     Local frame: u = towards the bowler, v = towards the off side (the chest), y = up. */
  const STANCE_BODY = { pel: [0, -0.03, 0.93], chest: [0.05, 0.05, 1.35], head: [0.16, 0.10, 1.57], fF: [0.28, 0, 0], bF: [-0.25, 0.02, 0] };
  const BODY = {
    front:  { pel: [0.30, 0.04, 0.86], chest: [0.42, 0.14, 1.28], head: [0.55, 0.18, 1.48], fF: [0.78, 0.08, 0], bF: [-0.25, 0.02, 0.04] },
    cover:  { pel: [0.28, 0.10, 0.86], chest: [0.40, 0.22, 1.28], head: [0.53, 0.27, 1.48], fF: [0.72, 0.30, 0], bF: [-0.25, 0.04, 0.04] },
    back:   { pel: [-0.08, 0.06, 0.95], chest: [-0.02, 0.14, 1.40], head: [0.08, 0.19, 1.60], fF: [0.24, 0.05, 0], bF: [-0.38, 0.10, 0] },
    backOff:{ pel: [-0.06, 0.16, 0.94], chest: [0.0, 0.26, 1.38], head: [0.1, 0.32, 1.58], fF: [0.26, 0.12, 0], bF: [-0.34, 0.32, 0] },
    glance: { pel: [0.22, 0.02, 0.89], chest: [0.33, 0.1, 1.32], head: [0.46, 0.15, 1.52], fF: [0.6, 0.02, 0], bF: [-0.26, 0.02, 0.02] },
    slog:   { pel: [0.2, -0.06, 0.88], chest: [0.28, 0.02, 1.32], head: [0.4, 0.07, 1.52], fF: [0.56, -0.24, 0], bF: [-0.28, 0.0, 0.03] },
    ramp:   { pel: [0.18, 0.04, 0.70], chest: [0.30, 0.1, 1.08], head: [0.4, 0.13, 1.28], fF: [0.62, 0.08, 0], bF: [-0.32, 0.03, 0.10] }
  };
  /* swing keyframes: C = moment of contact, F = end of follow-through */
  const SW = {
    stance:   { hands: [-0.05, 0.22, 0.86], bat: [-0.12, 0.09, -0.99], aim: [1, 0.3, 0], yaw: 10 },
    tap:      { hands: [-0.07, 0.22, 0.9], bat: [-0.3, 0.12, -0.95], aim: [1, 0.3, 0], yaw: 10 },
    backlift: { hands: [-0.22, 0.2, 1.08], bat: [-0.6, 0.35, 0.72], aim: [0.2, 1, 0], yaw: 4 },
    driveC:   { hands: [0.48, 0.30, 0.78], bat: [0.12, 0.02, -1], aim: [1, 0, 0], yaw: 20 },
    driveF:   { hands: [0.55, 0.15, 1.55], bat: [-0.2, -0.35, 0.92], aim: [0.5, -0.5, 0.5], yaw: 45 },
    coverC:   { hands: [0.42, 0.45, 0.72], bat: [0.1, 0.25, -1], aim: [0.75, 0.66, 0], yaw: 15 },
    coverF:   { hands: [0.45, 0.28, 1.5], bat: [-0.25, -0.45, 0.85], aim: [0.4, 0.3, 0.6], yaw: 40 },
    cutC:     { hands: [0.02, 0.62, 1.0], bat: [0.2, 0.95, -0.2], aim: [0, 1, -0.4], yaw: -5 },
    cutF:     { hands: [-0.15, 0.45, 1.02], bat: [-0.75, 0.55, -0.3], aim: [-0.3, 0.4, -0.8], yaw: 10 },
    lateC:    { hands: [-0.15, 0.5, 0.88], bat: [-0.5, 0.8, -0.3], aim: [-0.6, 0.8, 0], yaw: -15 },
    lateF:    { hands: [-0.3, 0.35, 0.85], bat: [-0.9, 0.2, -0.35], aim: [-0.8, 0.2, -0.5], yaw: 0 },
    rampC:    { hands: [0.25, 0.15, 1.0], bat: [0.75, 0.1, 0.25], aim: [0, 0, 1], yaw: 30 },
    rampF:    { hands: [0.05, 0.08, 1.35], bat: [-0.5, 0, 0.85], aim: [-0.6, 0, 0.4], yaw: 40 },
    glanceC:  { hands: [0.38, 0.12, 0.74], bat: [0.08, -0.3, -1], aim: [0.6, -0.8, 0], yaw: 25 },
    glanceF:  { hands: [0.32, -0.02, 0.8], bat: [-0.3, -0.75, -0.55], aim: [-0.2, -1, 0], yaw: 35 },
    pullC:    { hands: [0.1, 0.12, 1.22], bat: [0.2, -0.97, 0.05], aim: [0.15, -0.98, 0], yaw: 75 },
    pullF:    { hands: [-0.12, -0.25, 1.4], bat: [-0.55, 0.35, 0.7], aim: [-0.8, -0.2, 0.3], yaw: 100 },
    slogC:    { hands: [0.32, 0.1, 0.88], bat: [0.55, -0.55, -0.55], aim: [0.7, -0.7, 0], yaw: 60 },
    slogF:    { hands: [0.12, -0.3, 1.66], bat: [-0.5, 0.2, 0.82], aim: [-0.4, -0.6, 0.5], yaw: 95 },
    blockC:   { hands: [0.48, 0.28, 0.82], bat: [0.18, 0, -1], aim: [1, 0, 0.1], yaw: 15 },
    leave:    { hands: [-0.05, 0.05, 1.6], bat: [-0.3, 0.1, 0.95], aim: [0, 1, 0], yaw: 10 },
    duck:     { hands: [-0.25, 0.08, 0.72], bat: [-0.7, 0.15, -0.6], aim: [0, 1, 0], yaw: 25 },
    out:      { hands: [-0.05, 0.2, 0.7], bat: [0.2, 0.2, -1], aim: [1, 0, 0], yaw: 50 },
    cheer:    { hands: [0.05, 0, 1.98], bat: [0, -0.1, 1], aim: [1, 0, 0], yaw: 75 }
  };
  SW.blockF = SW.blockC;
  const SHOT_BODY = { drive: 'front', cover: 'cover', cut: 'backOff', late: 'backOff', ramp: 'ramp', glance: 'glance', pull: 'back', slog: 'slog', block: 'front' };
  const pose = (body, swing) => Object.assign({}, body, swing);
  const POSES = {
    stance: pose(STANCE_BODY, SW.stance), tap: pose(STANCE_BODY, SW.tap), backlift: pose(STANCE_BODY, SW.backlift),
    leave: pose(STANCE_BODY, SW.leave), out: pose(STANCE_BODY, SW.out),
    duck: pose({ pel: [0.02, -0.06, 0.6], chest: [0.16, -0.02, 0.95], head: [0.24, -0.06, 1.06], fF: [0.32, 0, 0], bF: [-0.28, 0.02, 0] }, SW.duck),
    cheer: pose({ pel: [0.05, 0, 0.96], chest: [0.05, 0.02, 1.42], head: [0.1, 0.02, 1.64], fF: [0.32, 0, 0], bF: [-0.3, 0, 0] }, SW.cheer)
  };
  Object.keys(SHOT_BODY).forEach(k => { const b = BODY[SHOT_BODY[k]]; POSES[k + 'C'] = pose(b, SW[k + 'C']); POSES[k + 'F'] = pose(b, SW[k + 'F']); });
  /** the batsman's body set for a shot, arms still in the backlift (shifted with the hips) */
  function readyPose(shotKey) {
    const b = BODY[SHOT_BODY[shotKey]] || BODY.front, d = V.sub(b.pel, STANCE_BODY.pel);
    return pose(b, Object.assign({}, SW.backlift, { hands: V.add(SW.backlift.hands, [d[0] * 0.8, d[1], d[2]]) }));
  }
  /** shift a contact/finish pose so the bat meets this particular ball (line dv along v, height dy) */
  function fitBall(p, dv, dy, horizontal) {
    const o = Object.assign({}, p); o.hands = V.add(p.hands, [0, dv, horizontal ? dy : 0]); o.fF = V.add(p.fF, [0, dv * 0.5, 0]); o.head = V.add(p.head, [0, dv * 0.4, 0]); return o;
  }

  const SHOT_POSE = { N: 'drive', NE: 'cover', E: 'cut', SE: 'late', S: 'ramp', SW: 'glance', W: 'pull', NW: 'slog', C: 'block' };
  function slerp(a, b, t) {
    a = V.norm(a); b = V.norm(b); const d = Math.max(-1, Math.min(1, V.dot(a, b))), th = Math.acos(d);
    if (th < 1e-3) return V.norm(V.lerp(a, b, t)); const s = Math.sin(th);
    return V.add(V.mul(a, Math.sin((1 - t) * th) / s), V.mul(b, Math.sin(t * th) / s));
  }
  function mixPose(a, b, t) {
    t = Math.max(0, Math.min(1, t)); const o = {};
    for (const k in a) o[k] = k === 'bat' ? slerp(a[k], b[k], t) : Array.isArray(a[k]) ? V.lerp(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
    return o;
  }
  /** follow-through midpoint: bat pointing along the line of the shot, so the swing travels through the ball instead of back over the shoulder */
  function midPose(C, F, angleDeg) {
    const o = mixPose(C, F, 0.5), a = angleDeg * Math.PI / 180, d = [Math.cos(a), Math.sin(a)];
    o.bat = V.norm([d[0], d[1], 0.3]);
    o.hands = V.add(V.lerp(C.hands, F.hands, 0.4), [d[0] * 0.16, d[1] * 0.16, 0.12]);
    return o;
  }
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

  /** batsman joints for a pose; mirror = 1 right-hander, -1 left-hander */
  function batsmanJoints(P, mirror, originX) {
    const O = [originX, 0, ORIGIN_Z], u = [0, 0, -1], v = [mirror, 0, 0];
    const W = l => [O[0] + u[0] * l[0] + v[0] * l[1], l[2], O[2] + u[2] * l[0] + v[2] * l[1]];
    const Wd = l => V.norm([u[0] * l[0] + v[0] * l[1], l[2], u[2] * l[0] + v[2] * l[1]]);
    const yw = P.yaw * Math.PI / 180, axis = V.add(V.mul(u, Math.cos(yw)), V.mul(v, -Math.sin(yw))), face = V.add(V.mul(v, Math.cos(yw)), V.mul(u, Math.sin(yw)));
    const yh = yw * 0.55, axH = V.add(V.mul(u, Math.cos(yh)), V.mul(v, -Math.sin(yh))), faceH = V.add(V.mul(v, Math.cos(yh)), V.mul(u, Math.sin(yh)));
    const pel = W(P.pel), chest = W(P.chest), head = W(P.head);
    const sh = [V.madd(V.madd(chest, axis, 0.175), UP, 0.02), V.madd(V.madd(chest, axis, -0.175), UP, 0.01)];
    const hip = [V.madd(pel, axH, 0.1), V.madd(pel, axH, -0.1)];
    const foot = [W(P.fF), W(P.bF)], an = foot.map(f => V.madd(f, UP, 0.08));
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, V.add(faceH, V.mul(u, 0.35)))[0]);
    const an2 = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, faceH)[1]);
    const bd = Wd(P.bat), top = W(P.hands), h2 = V.madd(top, bd, 0.11);
    const e0 = ik(sh[0], top, 0.3, 0.28, V.add(V.add(V.mul(axis, 0.6), [0, -0.6, 0]), V.mul(face, -0.1)));
    const e1 = ik(sh[1], h2, 0.3, 0.28, V.add(V.mul(axis, -0.4), [0, -0.9, 0]));
    const toe = [V.norm(V.add(faceH, V.mul(u, 0.55))), V.norm(V.add(faceH, V.mul(u, 0.1)))];
    const hface = V.norm(V.add(V.mul(face, 0.45), V.mul(V.norm(V.sub([0, 1.2, 1], head)), 1)));
    const J = { pel, chest, head, hface, face: faceH, sh, hip, kn, an: an2, toe, el: [e0[0], e1[0]], ha: [e0[1], e1[1]], batTop: top, batDir: bd, batFace: P.aim ? Wd(P.aim) : V.add(face, V.mul(u, 0.6)) };
    // index 0 must be the anatomical LEFT side for the skinned body; a left-hander leads with his right
    if (mirror < 0) ['sh', 'el', 'ha', 'hip', 'kn', 'an', 'toe'].forEach(k => { J[k] = [J[k][1], J[k][0]]; });
    return J;
  }

  /* ---------- generic fielder / umpire / bowler figures ---------- */
  function figure(pos, face, o) {
    o = o || {}; face = V.norm([face[0], 0, face[2]]);
    const right = V.norm(V.cross(face, UP)), cr = o.crouch || 0, run = o.run, amt = o.amt === undefined ? 1 : o.amt;
    const ph = run === undefined ? 0 : run, bob = run === undefined ? 0 : Math.abs(Math.sin(ph)) * 0.05 * amt;
    const pel = V.add(pos, [0, 0.95 - cr * 0.32 + bob, 0]); const pelF = V.madd(pel, face, cr * 0.05);
    const lean = (run === undefined ? 0 : 0.12 * amt) + cr * 0.2 + (o.lean || 0);
    const chest = V.madd(V.madd(pelF, UP, 0.45 - cr * 0.1), face, lean);
    const head = V.madd(V.madd(chest, UP, 0.23), face, 0.03 + lean * 0.25);
    const sh = [V.madd(V.madd(chest, right, -0.175), UP, 0.02), V.madd(V.madd(chest, right, 0.175), UP, 0.02)];
    const hip = [V.madd(pelF, right, -0.1), V.madd(pelF, right, 0.1)];
    const an = [0, 1].map(i => {
      const s = i ? 1 : -1;
      if (run === undefined) return V.add(V.madd(pos, right, s * (0.15 + cr * 0.16)), [0, 0.08, 0]);
      const p = ph + (i ? Math.PI : 0);
      return V.add(V.madd(V.madd(pos, right, s * 0.12), face, Math.sin(p) * 0.48 * amt), [0, 0.08 + Math.max(0, Math.cos(p)) * 0.25 * amt, 0]);
    });
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, V.add(face, [0, 0.1, 0]))[0]);
    let ha = [0, 1].map(i => {
      const s = i ? 1 : -1;
      if (o.armsUp) return V.madd(V.madd(sh[i], UP, 0.55 * o.armsUp + 0.0), right, s * 0.1);
      if (o.catchAt) return V.madd(o.catchAt, right, s * 0.07);
      if (run !== undefined) { const p = ph + (i ? 0 : Math.PI); return V.add(V.madd(sh[i], face, Math.sin(p) * 0.32 * amt), [0, -0.42 + Math.max(0, Math.sin(p)) * 0.12, 0]); }
      if (cr > 0.3) return V.madd(V.madd(V.madd(pelF, face, 0.42), right, s * 0.13), UP, -0.08);
      return V.madd(V.madd(sh[i], UP, -0.55), face, 0.06);
    });
    if (o.throwK !== undefined) { const k = o.throwK; ha[1] = V.add(sh[1], V.add(V.mul(face, -0.5 + 1.0 * k), [0, 0.5 - 0.75 * k * k, 0])); ha[0] = V.add(sh[0], V.add(V.mul(face, 0.35 - 0.2 * k), [0, -0.1, 0])); }
    if (o.hands) ha = o.hands;
    const arm = [0, 1].map(i => ik(sh[i], ha[i], 0.3, 0.28, V.add(V.mul(face, -0.6), V.mul(right, (i ? 1 : -1) * 0.5))));
    const el = arm.map(a => a[0]); ha = arm.map(a => a[1]);
    const toe = [V.norm(V.madd(face, right, -0.15)), V.norm(V.madd(face, right, 0.15))];
    return { pel: pelF, chest, head, hface: face, face, sh, hip, kn, an, toe, el, ha };
  }
  /** bowler: t = now, t0 = start of run-up, tr = release time */
  function bowlerJoints(t, t0, tr) {
    const RUN0 = -10, X = 0.42, fwd = [0, 0, 1], right = [-1, 0, 0];
    const tB = tr - 520, tDS = tr - 300;           // bound (jump) starts, then the delivery stride
    if (t < tB) {
      const k = Math.max(0, (t - t0) / (tB - t0)), z = RUN0 + (-1.2 - RUN0) * (k * (0.6 + 0.4 * k));
      return figure([X, 0, z], fwd, { run: (t - t0) / 1000 * 10.5, amt: 0.55 + 0.45 * Math.min(1, k * 1.6), lean: 0.05 });
    }
    if (t < tDS) {                                   // gather + leap
      const k = (t - tB) / (tDS - tB), z = -1.2 + 1.2 * k, air = Math.sin(k * Math.PI) * 0.32;
      const J = figure([X, air, z], [0.35, 0, 1], { lean: -0.06, crouch: 0 });
      J.an = [V.add([X - 0.08, 0.1, z + 0.1], [0, air + 0.18 * Math.sin(k * Math.PI), 0]), V.add([X + 0.06, 0.1, z - 0.25], [0, air + 0.05, 0])];
      J.kn = [0, 1].map(i => ik(J.hip[i], J.an[i], 0.46, 0.45, [0, 0.2, 1])[0]);
      J.ha[0] = V.madd(J.sh[0], V.norm([0.1, 0.9, 0.4]), 0.55); J.ha[1] = V.madd(J.sh[1], V.norm([0.05, 0.5, -0.2]), 0.5);
      J.el = [0, 1].map(i => ik(J.sh[i], J.ha[i], 0.3, 0.28, [0, -0.3, -1])[0]);
      return J;
    }
    if (t < tr + 220) {                              // delivery stride: back foot lands, arm comes over, front leg braces
      const k = (t - tDS) / (tr + 220 - tDS), kr = (tr - tDS) / (tr + 220 - tDS), z = 0 + 0.9 * W3e(k);
      const J = figure([X, 0, z], [0.45 - 0.4 * k, 0, 1], { lean: -0.15 + 0.5 * W3e(k) });
      J.sh[0] = V.madd(V.madd(J.chest, right, -0.17), fwd, 0.07 - 0.12 * k); J.sh[1] = V.madd(V.madd(J.chest, right, 0.17), fwd, -0.07 + 0.12 * k);
      const th = (-175 + 175 * (k / kr)) * Math.PI / 180;       // vertical (0) exactly at release
      J.ha[1] = V.madd(J.sh[1], V.norm([0.06, Math.cos(th), Math.sin(th)]), 0.6); J.el[1] = V.lerp(J.sh[1], J.ha[1], 0.5);
      const be = (75 - 165 * W3e(k)) * Math.PI / 180;
      J.ha[0] = V.madd(J.sh[0], V.norm([0.12, Math.sin(be), Math.cos(be)]), 0.56);
      J.el[0] = ik(J.sh[0], J.ha[0], 0.3, 0.28, [-0.5, -0.5, -0.3])[0];
      J.an[0] = [X - 0.06, 0.08 + Math.max(0, 0.3 * (1 - k * 2.2)), z + 0.62]; J.an[1] = [X + 0.12, 0.08 + 0.1 * k, z - 0.6 + 0.5 * W3e(k)];
      J.kn = [0, 1].map(i => ik(J.hip[i], J.an[i], 0.46, 0.45, [0, 0.1, 1])[0]);
      J.toe = [[0, 0, 1], [0.7, 0, 0.7]];
      return J;
    }
    // follow-through: bowling arm sweeps across the body, run off the pitch
    const k = Math.min(1, (t - tr - 220) / 1300), z = 0.9 + 3.6 * Math.sin(k * Math.PI / 2), x = X + 1.8 * W3e(k);
    const J = figure([x, 0, z], V.norm([0.4 * (1 - k) + 0.1, 0, 1]), { run: (t - tr) / 1000 * 9, amt: 0.85 * (1 - k) + 0.08, lean: 0.25 * (1 - k) });
    if (k < 0.35) { const a = k / 0.35; J.ha[1] = V.lerp(V.madd(J.pel, [1, 0, 0], 0.28), J.ha[1], a); J.el[1] = ik(J.sh[1], J.ha[1], 0.3, 0.28, [0, -1, -0.3])[0]; }
    return J;
  }
  function W3e(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }
  /** wicketkeeper: squats while the bowler runs in, rises with the ball, gloves go to the ball */
  function keeperJoints(pos, rise, gloveAt) {
    const face = [0, 0, -1], right = V.norm(V.cross(face, UP));
    const py = 0.5 + 0.4 * rise, pel = V.add(pos, [0, py, 0.05]);
    const chest = V.madd(V.madd(pel, UP, 0.4), face, 0.24 - 0.12 * rise), head = V.madd(V.madd(chest, UP, 0.22), face, 0.06);
    const sh = [V.madd(V.madd(chest, right, -0.175), UP, 0.02), V.madd(V.madd(chest, right, 0.175), UP, 0.02)], hip = [V.madd(pel, right, -0.11), V.madd(pel, right, 0.11)];
    const an = [-1, 1].map(s => V.add(V.madd(pos, right, s * (0.3 - 0.1 * rise)), [0, 0.1, 0]));
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, V.add(face, V.mul(right, (i ? 1 : -1) * 0.9)))[0]);
    let ha = gloveAt ? [V.madd(gloveAt, right, -0.06), V.madd(gloveAt, right, 0.06)]
                     : [V.madd(V.madd(V.madd(pel, face, 0.45), UP, 0.02 + 0.2 * rise), right, -0.07), V.madd(V.madd(V.madd(pel, face, 0.45), UP, 0.02 + 0.2 * rise), right, 0.07)];
    const arm = [0, 1].map(i => ik(sh[i], ha[i], 0.3, 0.28, [i ? 0.6 : -0.6, -0.6, 0.2]));
    return { pel, chest, head, hface: face, face, sh, hip, kn, an, toe: [V.norm([-0.35, 0, -1]), V.norm([0.35, 0, -1])], el: arm.map(a => a[0]), ha: arm.map(a => a[1]) };
  }

  /** keeper full-length dive: side = +1/-1 along world x, k = 0..1 through the dive, gloveAt = ball (or null) */
  function keeperDive(pos, side, k, gloveAt, faceV, dirV) {   // also used for fielders' diving stops (faceV/dirV given)
    const dir = dirV || [side, 0, 0], face = faceV || [0, 0, -1];
    const kl = Math.min(1, k / 0.5), tilt = Math.min(1, k / 0.3), fall = Math.max(0, Math.min(1, (k - 0.5) / 0.3));
    const pel = V.add(V.madd(pos, dir, 1.25 * W3e(kl)), [0, Math.max(0.2, 0.55 + 0.35 * Math.sin(kl * Math.PI) - 0.38 * fall), 0]);
    const b = V.norm(V.add(V.mul(UP, 1 - tilt * 0.95), V.mul(dir, tilt)));
    const chest = V.madd(pel, b, 0.43), head = V.madd(V.madd(chest, b, 0.22), face, 0.05);
    const ax = V.norm(V.cross(b, face));
    const sh = [V.madd(chest, ax, 0.175), V.madd(chest, ax, -0.175)], hip = [V.madd(pel, ax, 0.1), V.madd(pel, ax, -0.1)];
    let ha = gloveAt ? [V.madd(gloveAt, ax, 0.06), V.madd(gloveAt, ax, -0.06)] : [V.madd(V.madd(chest, b, 0.55), ax, 0.06), V.madd(V.madd(chest, b, 0.55), ax, -0.06)];
    const arm = [0, 1].map(i => ik(sh[i], ha[i], 0.3, 0.28, V.add(face, V.mul(b, -0.5))));
    const an = [0, 1].map(i => V.add(V.madd(V.madd(pel, b, -0.82), ax, (i ? -1 : 1) * 0.16), [0, 0.06, 0]));
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, face)[0]);
    return { pel, chest, head, hface: face, face, sh, hip, kn, an, toe: [V.norm(V.add(face, V.mul(b, -0.3))), V.norm(V.add(face, V.mul(b, -0.3)))], el: arm.map(a => a[0]), ha: arm.map(a => a[1]) };
  }
  /* ---------- field geometry ---------- */
  function dirOf(angle, mirror) { const a = angle * Math.PI / 180; return [Math.sin(a) * mirror, 0, -Math.cos(a)]; }
  function ropeDist(from, d) { const p = V.sub(from, GC); p[1] = 0; const b = V.dot(p, d), c = V.dot(p, p) - ROPE * ROPE; return -b + Math.sqrt(Math.max(0, b * b - c)); }
  function fieldPos(angle, frac, mirror) { const C = [0, 0, BAT_Z], d = dirOf(angle, mirror); return V.madd(C, d, frac * ropeDist(C, d)); }

  window.W3 = { readyPose, fitBall, midPose, slerp, towers: () => S.towers, keeperJoints, keeperDive, init, drawStadium, drawGlows, drawStumps, drawFigure, drawBat, batsmanJoints, figure, bowlerJoints, POSES, SHOT_POSE, mixPose, ease, KITS, dirOf, ropeDist, fieldPos, GC, ROPE, BAT_Z, STUMPS_Z, ORIGIN_Z };
})();
