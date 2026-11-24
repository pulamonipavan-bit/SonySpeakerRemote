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
    R.draw(R.meshes.disc, M.basis([76, 0, 0], [0, 1, 0], [0, 0, 76], GC), { tex: S.tex.grass });
    R.draw(R.meshes.disc, M.basis([130, 0, 0], [0, 1, 0], [0, 0, 130], [GC[0], -0.02, GC[2]]), { c: [0.10, 0.22, 0.13] });
    R.draw(S.rope, id, { c: [0.95, 0.95, 0.98], em: 0.3 }); R.draw(S.ropeTop, id, { c: [0.95, 0.95, 0.98], em: 0.3 });
    R.draw(S.boards, id, { tex: S.tex.board, uv: [10, 1], em: 0.9 });
    R.draw(S.wall, id, { c: [0.08, 0.1, 0.16] });
    R.draw(S.tier1, id, { tex: S.tex.crowd, uv: [9, 2], c: [1.2, 1.2, 1.2], em: 0.45 });
    R.draw(S.face1, id, { tex: S.tex.board, uv: [12, 1], em: 0.85 });
    R.draw(S.tier2, id, { tex: S.tex.crowd, uv: [10, 2], c: [1.1, 1.1, 1.15], em: 0.4 });
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
    bat: { shirt: [0.12, 0.30, 0.82], pants: [0.10, 0.20, 0.52], skin: [0.58, 0.40, 0.28], head: 'helmet', helmet: [0.06, 0.11, 0.28], pads: true, gloves: [0.97, 0.97, 0.97], gloveTrim: [0.1, 0.25, 0.75], shoes: [0.95, 0.95, 0.95], trim: [1, 0.78, 0.2], back: ['BLAST', '7'] },
    field: { shirt: [0.80, 0.13, 0.12], pants: [0.62, 0.09, 0.10], skin: [0.55, 0.37, 0.26], head: 'cap', cap: [0.70, 0.08, 0.08], shoes: [0.95, 0.95, 0.95], gloves: null, trim: [1, 1, 1] },
    keeper: { shirt: [0.80, 0.13, 0.12], pants: [0.62, 0.09, 0.10], skin: [0.52, 0.36, 0.25], head: 'helmet', helmet: [0.55, 0.07, 0.07], pads: true, gloves: [0.96, 0.96, 0.92], bigGloves: true, shoes: [0.95, 0.95, 0.95], trim: [1, 1, 1], longSleeve: true, padCol: [0.95, 0.95, 0.95] },
    ump: { shirt: [0.88, 0.89, 0.92], pants: [0.10, 0.10, 0.13], skin: [0.45, 0.31, 0.22], head: 'hat', cap: [0.92, 0.92, 0.9], shoes: [0.1, 0.1, 0.1], gloves: null, trim: [0.2, 0.2, 0.25] }
  };
  function ik(a, t, l1, l2, pole) {
    let d = V.sub(t, a), L = V.len(d); const max = (l1 + l2) * 0.999; if (L > max) { t = V.madd(a, d, max / L); d = V.sub(t, a); L = max; }
    const dir = V.mul(d, 1 / (L || 1)), x = (l1 * l1 - l2 * l2 + L * L) / (2 * (L || 1)), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
    let p = V.sub(pole, V.mul(dir, V.dot(pole, dir))); p = V.len(p) < 1e-4 ? [0, -1, 0] : V.norm(p);
    return [V.madd(V.madd(a, dir, x), p, h), t];
  }
  const backCache = {};
  function backTex(R, text, num, col) {
    const key = text + num + col; if (backCache[key]) return backCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.textAlign = 'center'; g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.font = '900 26px system-ui, sans-serif'; g.strokeText(text, 64, 30); g.fillText(text, 64, 30);
    g.font = '900 74px system-ui, sans-serif'; g.strokeText(num, 64, 104); g.fillText(num, 64, 104);
    return (backCache[key] = R.texture(c, false));
  }
  function ell(R, c, X, Y, Z, mat) { R.draw(R.meshes.sphere, R.M.basis(X, Y, Z, c), mat); }
  function drawFigure(R, J, kit) {
    const sh = { c: kit.shirt, spec: 0.28 }, pa = { c: kit.pants, spec: 0.14 }, sk = { c: kit.skin, spec: 0.22 }, trim = { c: kit.trim || [1, 0.8, 0.25], spec: 0.2 };
    const face = J.face, right = V.norm(V.cross(face, UP));
    // ---- legs ----
    for (let i = 0; i < 2; i++) {
      const hip = J.hip[i], kn = J.kn[i], an = J.an[i];
      R.seg(hip, kn, 0.095, pa, 0.068, true);
      const calf = V.lerp(kn, an, 0.35); R.seg(kn, calf, 0.068, pa, 0.072); R.seg(calf, an, 0.072, pa, 0.048);
      const t = J.toe[i], ts = V.norm(V.cross(UP, t));
      if (kit.pads) {
        const dl = V.sub(kn, an), L = V.len(dl), ax = V.mul(dl, 1 / L);
        let fw = V.sub(t, V.mul(ax, V.dot(t, ax))); fw = V.len(fw) < 1e-3 ? face : V.norm(fw); const sx = V.norm(V.cross(ax, fw));
        const pc = V.madd(V.lerp(kn, an, 0.47), fw, 0.055), padM = { c: kit.padCol || [0.97, 0.97, 0.97], spec: 0.25 };
        ell(R, pc, V.mul(sx, 0.088), V.mul(ax, L * 0.5 + 0.09), V.mul(fw, 0.06), padM);
        [-0.048, 0, 0.048].forEach(o => R.seg(V.madd(V.madd(V.madd(an, ax, 0.02), sx, o), fw, 0.1), V.madd(V.madd(V.madd(kn, ax, 0.02), sx, o), fw, 0.1), 0.024, padM, 0.024, true));
        ell(R, V.madd(V.madd(kn, fw, 0.085), ax, 0.04), V.mul(sx, 0.09), V.mul(ax, 0.075), V.mul(fw, 0.06), padM);
        [0.25, 0.7].forEach(k => R.obox(V.madd(V.lerp(an, kn, k), fw, -0.03), sx, ax, 0.2, 0.025, 0.09, { c: [0.15, 0.15, 0.18] }));
      }
      // shoe: sole + rounded upper
      const sc = V.madd(V.madd(an, t, 0.07), UP, -0.035);
      ell(R, sc, V.mul(ts, 0.052), [0, 0.048, 0], V.mul(t, 0.14), { c: kit.shoes, spec: 0.4 });
      R.obox([sc[0], 0.012 + Math.max(0, an[1] - 0.08), sc[2]], ts, UP, 0.1, 0.022, 0.29, { c: [0.2, 0.2, 0.22] });
    }
    // ---- torso ----
    const tUp = V.norm(V.sub(J.chest, J.pel)), tx = V.norm(V.sub(J.sh[0], J.sh[1])), tz = V.norm(V.cross(tx, tUp));
    const hx = V.norm(V.sub(J.hip[0], J.hip[1])), hz = V.norm(V.cross(hx, UP)), tl = V.len(V.sub(J.chest, J.pel));
    ell(R, V.madd(J.pel, UP, 0.02), V.mul(hx, 0.165), [0, 0.13, 0], V.mul(hz, 0.12), pa);
    ell(R, V.lerp(J.pel, J.chest, 0.38), V.mul(tx, 0.15), V.mul(tUp, tl * 0.36), V.mul(tz, 0.11), sh);
    ell(R, V.lerp(J.pel, J.chest, 0.78), V.mul(tx, 0.195), V.mul(tUp, tl * 0.34), V.mul(tz, 0.13), sh);
    ell(R, V.madd(J.chest, tUp, 0.02), V.mul(tx, 0.08), V.mul(tUp, 0.03), V.mul(tz, 0.075), trim);   // collar
    if (kit.back) { // name + number on the back of the shirt
      const c = V.madd(V.lerp(J.pel, J.chest, 0.66), tz, -0.134);
      R.draw(R.meshes.quad, R.M.basis(V.mul(tx, -0.26), V.mul(tUp, 0.26), V.mul(tz, -1), c), { tex: backTex(R, kit.back[0], kit.back[1], kit.back[2] || '#fff'), em: 0.25, blend: true });
    }
    // ---- arms ----
    for (let i = 0; i < 2; i++) {
      const s = J.sh[i], e = J.el[i], h = J.ha[i];
      ell(R, s, V.mul(tx, 0.078), V.mul(tUp, 0.07), V.mul(tz, 0.075), sh);
      const sl = V.lerp(s, e, 0.62);
      R.seg(s, sl, 0.064, sh, 0.058); R.seg(sl, e, 0.05, kit.longSleeve ? sh : sk, 0.045);
      const wr = V.lerp(e, h, 0.86); R.seg(e, wr, 0.047, kit.longSleeve ? sh : sk, 0.034);
      const hd = V.norm(V.sub(h, e)), hs = V.norm(V.cross(hd, Math.abs(hd[1]) > 0.9 ? [1, 0, 0] : UP));
      if (kit.bigGloves) ell(R, V.madd(h, hd, 0.03), V.mul(hs, 0.095), V.mul(hd, 0.1), V.mul(V.cross(hs, hd), 0.05), { c: kit.gloves, spec: 0.3 });
      else if (kit.gloves) { ell(R, h, V.mul(hs, 0.055), V.mul(hd, 0.065), V.mul(V.cross(hs, hd), 0.048), { c: kit.gloves, spec: 0.3 }); ell(R, V.madd(h, hd, -0.045), V.mul(hs, 0.05), V.mul(hd, 0.03), V.mul(V.cross(hs, hd), 0.046), { c: kit.gloveTrim || [0.1, 0.25, 0.75] }); }
      else ell(R, V.madd(h, hd, 0.02), V.mul(hs, 0.045), V.mul(hd, 0.06), V.mul(V.cross(hs, hd), 0.025), sk);
    }
    // ---- neck + head ----
    const hd = J.head, hf = J.hface || face, hs = V.norm(V.cross(hf, UP));
    R.seg(V.madd(J.chest, tUp, 0.0), V.madd(hd, UP, -0.09), 0.052, sk, 0.048);
    ell(R, hd, V.mul(hs, 0.094), [0, 0.118, 0], V.mul(hf, 0.104), sk);
    ell(R, V.madd(V.madd(hd, hf, 0.045), UP, -0.07), V.mul(hs, 0.07), [0, 0.05, 0], V.mul(hf, 0.06), sk);            // jaw
    ell(R, V.madd(V.madd(hd, hf, 0.104), UP, -0.005), V.mul(hs, 0.016), [0, 0.028, 0], V.mul(hf, 0.022), sk);         // nose
    [-1, 1].forEach(sg => ell(R, V.madd(hd, hs, sg * 0.093), V.mul(hs, 0.014), [0, 0.03, 0], V.mul(hf, 0.02), sk));   // ears
    if (kit.head === 'helmet') {
      const hc = V.madd(V.madd(hd, UP, 0.045), hf, -0.012), hm = { c: kit.helmet, spec: 1.0 };
      ell(R, hc, V.mul(hs, 0.125), [0, 0.11, 0], V.mul(hf, 0.132), hm);
      ell(R, V.madd(V.madd(hd, hf, -0.08), UP, -0.04), V.mul(hs, 0.1), [0, 0.06, 0], V.mul(hf, 0.05), hm);           // neck guard
      R.obox(V.madd(V.madd(hd, hf, 0.13), UP, 0.075), hs, V.norm(V.madd(UP, hf, -0.5)), 0.21, 0.018, 0.085, hm);    // peak
      const gr = { c: [0.75, 0.77, 0.8], spec: 1.0 };
      [0.02, -0.025, -0.07].forEach(y => { const l = V.madd(V.madd(V.madd(hd, hs, -0.095), hf, 0.07), UP, y), m = V.madd(V.madd(hd, hf, 0.135), UP, y), r = V.madd(V.madd(V.madd(hd, hs, 0.095), hf, 0.07), UP, y);
        R.seg(l, m, 0.0065, gr, 0.0065, true); R.seg(m, r, 0.0065, gr); });
      R.seg(V.madd(V.madd(hd, hf, 0.135), UP, 0.03), V.madd(V.madd(hd, hf, 0.13), UP, -0.085), 0.0065, gr, 0.0065, true);
    } else if (kit.head === 'cap') {
      ell(R, V.madd(V.madd(hd, UP, 0.035), hf, -0.005), V.mul(hs, 0.102), [0, 0.085, 0], V.mul(hf, 0.11), { c: kit.cap, spec: 0.2 });
      R.obox(V.madd(V.madd(hd, hf, 0.13), UP, 0.055), hs, V.norm(V.madd(UP, hf, -0.15)), 0.17, 0.012, 0.1, { c: kit.cap });
      ell(R, V.madd(V.madd(hd, hf, -0.06), UP, -0.03), V.mul(hs, 0.085), [0, 0.06, 0], V.mul(hf, 0.05), { c: [0.08, 0.06, 0.05] }); // hair
    } else if (kit.head === 'hat') {
      R.draw(R.meshes.disc, R.M.basis([0.19, 0, 0], [0, 1, 0], [0, 0, 0.19], V.madd(hd, UP, 0.075)), { c: kit.cap });
      ell(R, V.madd(hd, UP, 0.1), V.mul(hs, 0.1), [0, 0.06, 0], V.mul(hf, 0.105), { c: kit.cap });
    }
    R.blob(J.pel[0], J.pel[2], 0.55, 0.55, 0.32);
  }
  function drawBat(R, top, dir, faceN) {
    const fn = V.norm(V.sub(faceN, V.mul(dir, V.dot(faceN, dir)))), wd = V.norm(V.cross(dir, fn));
    R.seg(V.madd(top, dir, -0.02), V.madd(top, dir, 0.3), 0.019, { c: [0.08, 0.08, 0.1] });
    const c = V.madd(top, dir, 0.3 + 0.28);
    R.obox(c, wd, dir, 0.108, 0.56, 0.042, { c: [0.88, 0.76, 0.52], spec: 0.35 });
    R.obox(V.madd(c, fn, -0.024), wd, dir, 0.06, 0.5, 0.02, { c: [0.8, 0.66, 0.42] });
    R.obox(V.madd(V.madd(c, fn, 0.022), dir, -0.12), wd, dir, 0.095, 0.16, 0.004, { c: [0.1, 0.3, 0.85], em: 0.3 });
  }

  /* ---------- batsman: keyframed poses in a local frame (u = towards bowler, v = towards the off side / chest, y up) ---------- */
  const B = { pel: [0, -0.02, 0.92], chest: [0.02, 0.06, 1.36], head: [0.14, 0.12, 1.58], yaw: 8, hands: [-0.12, 0.28, 0.82], bat: [-0.15, 0.1, -1], fF: [0.3, 0, 0], bF: [-0.3, 0.02, 0] };
  const pose = o => Object.assign({}, B, o);
  const POSES = {
    stance: pose({}),
    tap: pose({ hands: [-0.14, 0.27, 0.86], bat: [-0.32, 0.15, -1] }),
    backlift: pose({ hands: [-0.3, 0.2, 1.22], bat: [-0.55, 0.05, 0.85], yaw: 0, fF: [0.38, 0, 0.07] }),
    driveC: pose({ pel: [0.32, 0.05, 0.86], chest: [0.42, 0.16, 1.3], head: [0.56, 0.2, 1.5], yaw: 25, hands: [0.55, 0.32, 0.72], bat: [0.15, 0.05, -1], fF: [0.85, 0.08, 0], bF: [-0.25, 0.02, 0.03] }),
    driveF: pose({ pel: [0.32, 0.05, 0.88], chest: [0.45, 0.12, 1.34], head: [0.56, 0.18, 1.52], yaw: 40, hands: [0.55, 0.12, 1.62], bat: [-0.35, -0.25, 0.9], fF: [0.85, 0.08, 0], bF: [-0.25, 0.02, 0.06] }),
    coverC: pose({ pel: [0.3, 0.12, 0.86], chest: [0.42, 0.28, 1.3], head: [0.55, 0.33, 1.5], yaw: 15, hands: [0.48, 0.5, 0.68], bat: [0.1, 0.3, -1], fF: [0.78, 0.3, 0], bF: [-0.25, 0.04, 0.03] }),
    coverF: pose({ pel: [0.3, 0.12, 0.88], chest: [0.42, 0.24, 1.33], head: [0.55, 0.3, 1.52], yaw: 35, hands: [0.45, 0.3, 1.58], bat: [-0.3, -0.45, 0.85], fF: [0.78, 0.3, 0], bF: [-0.25, 0.04, 0.06] }),
    cutC: pose({ pel: [-0.02, 0.15, 0.93], chest: [0.05, 0.28, 1.38], head: [0.15, 0.4, 1.56], yaw: -10, hands: [0.02, 0.62, 1.02], bat: [0.25, 0.95, -0.15], fF: [0.3, 0.15, 0], bF: [-0.3, 0.32, 0] }),
    cutF: pose({ pel: [-0.02, 0.15, 0.93], chest: [0.02, 0.25, 1.38], head: [0.15, 0.38, 1.57], yaw: 5, hands: [-0.25, 0.38, 1.2], bat: [-0.85, 0.3, 0.35], fF: [0.3, 0.15, 0], bF: [-0.3, 0.32, 0] }),
    lateC: pose({ pel: [-0.05, 0.12, 0.9], chest: [-0.02, 0.25, 1.34], head: [0.05, 0.36, 1.52], yaw: -15, hands: [-0.22, 0.55, 0.88], bat: [-0.55, 0.75, -0.3], fF: [0.25, 0.12, 0], bF: [-0.32, 0.3, 0] }),
    lateF: pose({ pel: [-0.05, 0.12, 0.9], chest: [-0.04, 0.22, 1.34], head: [0.04, 0.32, 1.53], yaw: -5, hands: [-0.42, 0.3, 0.92], bat: [-0.95, 0, 0.15], fF: [0.25, 0.12, 0], bF: [-0.32, 0.3, 0] }),
    rampC: pose({ pel: [0.15, 0.05, 0.7], chest: [0.28, 0.12, 1.08], head: [0.38, 0.15, 1.28], yaw: 40, hands: [0.3, 0.18, 1.05], bat: [-0.7, 0.05, 0.6], fF: [0.65, 0.05, 0], bF: [-0.3, 0.02, 0.12] }),
    rampF: pose({ pel: [0.15, 0.05, 0.74], chest: [0.26, 0.1, 1.12], head: [0.34, 0.12, 1.32], yaw: 45, hands: [0.1, 0.1, 1.35], bat: [-0.85, 0, 0.45], fF: [0.65, 0.05, 0], bF: [-0.3, 0.02, 0.12] }),
    glanceC: pose({ pel: [0.25, 0.02, 0.9], chest: [0.35, 0.1, 1.34], head: [0.48, 0.15, 1.54], yaw: 20, hands: [0.4, 0.1, 0.72], bat: [0.05, -0.35, -1], fF: [0.6, 0, 0], bF: [-0.28, 0.02, 0.02] }),
    glanceF: pose({ pel: [0.25, 0.02, 0.9], chest: [0.33, 0.08, 1.35], head: [0.45, 0.12, 1.55], yaw: 30, hands: [0.3, -0.05, 0.82], bat: [-0.45, -0.7, -0.45], fF: [0.6, 0, 0], bF: [-0.28, 0.02, 0.02] }),
    pullC: pose({ pel: [-0.05, -0.04, 0.95], chest: [0, 0.05, 1.4], head: [0.12, 0.12, 1.58], yaw: 70, hands: [0.12, 0.1, 1.22], bat: [0.25, -0.95, 0.05], fF: [0.32, -0.05, 0], bF: [-0.35, -0.12, 0] }),
    pullF: pose({ pel: [-0.05, -0.06, 0.95], chest: [-0.02, 0, 1.4], head: [0.1, 0.06, 1.58], yaw: 95, hands: [-0.15, -0.3, 1.42], bat: [-0.6, 0.3, 0.65], fF: [0.32, -0.05, 0.04], bF: [-0.35, -0.12, 0] }),
    slogC: pose({ pel: [0.25, -0.05, 0.88], chest: [0.33, 0.05, 1.32], head: [0.45, 0.1, 1.52], yaw: 55, hands: [0.35, 0.1, 0.85], bat: [0.55, -0.55, -0.55], fF: [0.62, -0.2, 0], bF: [-0.28, 0, 0.03] }),
    slogF: pose({ pel: [0.25, -0.05, 0.9], chest: [0.3, 0, 1.36], head: [0.42, 0.04, 1.55], yaw: 85, hands: [0.15, -0.32, 1.68], bat: [-0.55, 0.15, 0.8], fF: [0.62, -0.2, 0], bF: [-0.28, 0, 0.08] }),
    blockC: pose({ pel: [0.25, 0.04, 0.88], chest: [0.38, 0.14, 1.3], head: [0.5, 0.18, 1.5], yaw: 15, hands: [0.5, 0.3, 0.82], bat: [0.12, 0, -1], fF: [0.6, 0.1, 0], bF: [-0.26, 0.02, 0] }),
    leave: pose({ pel: [0, -0.05, 0.94], chest: [0, 0, 1.4], head: [0.1, 0.05, 1.6], yaw: 10, hands: [-0.1, 0, 1.62], bat: [-0.25, -0.05, 1], fF: [0.4, 0.05, 0] }),
    out: pose({ pel: [0, -0.05, 0.95], chest: [-0.05, -0.05, 1.4], head: [0, -0.02, 1.57], yaw: 50, hands: [-0.05, 0.2, 0.7], bat: [0.2, 0.2, -1] }),
    cheer: pose({ pel: [0.05, 0, 0.96], chest: [0.05, 0.02, 1.42], head: [0.1, 0.02, 1.64], yaw: 75, hands: [0.05, 0, 1.98], bat: [0, -0.1, 1], fF: [0.32, 0, 0], bF: [-0.3, 0, 0] })
  };
  POSES.blockF = POSES.blockC;
  const SHOT_POSE = { N: 'drive', NE: 'cover', E: 'cut', SE: 'late', S: 'ramp', SW: 'glance', W: 'pull', NW: 'slog', C: 'block' };
  function mixPose(a, b, t) {
    t = Math.max(0, Math.min(1, t)); const o = {};
    for (const k in a) o[k] = Array.isArray(a[k]) ? V.lerp(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
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
    const sh = [V.madd(chest, axis, 0.18), V.madd(V.madd(chest, axis, -0.18), UP, -0.02)];
    const hip = [V.madd(pel, axH, 0.1), V.madd(pel, axH, -0.1)];
    const foot = [W(P.fF), W(P.bF)], an = foot.map(f => V.madd(f, UP, 0.08));
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, V.add(faceH, V.mul(u, 0.35)))[0]);
    const an2 = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, faceH)[1]);
    const bd = Wd(P.bat), top = W(P.hands), h2 = V.madd(top, bd, 0.11);
    const e0 = ik(sh[0], top, 0.3, 0.28, V.add(V.add(V.mul(axis, 0.6), [0, -0.6, 0]), V.mul(face, -0.1)));
    const e1 = ik(sh[1], h2, 0.3, 0.28, V.add(V.mul(axis, -0.4), [0, -0.9, 0]));
    const toe = [V.norm(V.add(faceH, V.mul(u, 0.55))), V.norm(V.add(faceH, V.mul(u, 0.1)))];
    const hface = V.norm(V.add(V.mul(face, 0.45), V.mul(V.norm(V.sub([0, 1.2, 1], head)), 1)));
    return { pel, chest, head, hface, face: faceH, sh, hip, kn, an: an2, toe, el: [e0[0], e1[0]], ha: [e0[1], e1[1]], batTop: top, batDir: bd, batFace: V.add(face, V.mul(u, 0.6)) };
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
    const sh = [V.madd(V.madd(chest, right, -0.18), UP, -0.02), V.madd(V.madd(chest, right, 0.18), UP, -0.02)];
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
    const sh = [V.madd(chest, right, -0.18), V.madd(chest, right, 0.18)], hip = [V.madd(pel, right, -0.11), V.madd(pel, right, 0.11)];
    const an = [-1, 1].map(s => V.add(V.madd(pos, right, s * (0.3 - 0.1 * rise)), [0, 0.1, 0]));
    const kn = [0, 1].map(i => ik(hip[i], an[i], 0.46, 0.45, V.add(face, V.mul(right, (i ? 1 : -1) * 0.9)))[0]);
    let ha = gloveAt ? [V.madd(gloveAt, right, -0.06), V.madd(gloveAt, right, 0.06)]
                     : [V.madd(V.madd(V.madd(pel, face, 0.45), UP, 0.02 + 0.2 * rise), right, -0.07), V.madd(V.madd(V.madd(pel, face, 0.45), UP, 0.02 + 0.2 * rise), right, 0.07)];
    const arm = [0, 1].map(i => ik(sh[i], ha[i], 0.3, 0.28, [i ? 0.6 : -0.6, -0.6, 0.2]));
    return { pel, chest, head, hface: face, face, sh, hip, kn, an, toe: [V.norm([-0.35, 0, -1]), V.norm([0.35, 0, -1])], el: arm.map(a => a[0]), ha: arm.map(a => a[1]) };
  }

  /* ---------- field geometry ---------- */
  function dirOf(angle, mirror) { const a = angle * Math.PI / 180; return [Math.sin(a) * mirror, 0, -Math.cos(a)]; }
  function ropeDist(from, d) { const p = V.sub(from, GC); p[1] = 0; const b = V.dot(p, d), c = V.dot(p, p) - ROPE * ROPE; return -b + Math.sqrt(Math.max(0, b * b - c)); }
  function fieldPos(angle, frac, mirror) { const C = [0, 0, BAT_Z], d = dirOf(angle, mirror); return V.madd(C, d, frac * ropeDist(C, d)); }

  window.W3 = { keeperJoints, init, drawStadium, drawGlows, drawStumps, drawFigure, drawBat, batsmanJoints, figure, bowlerJoints, POSES, SHOT_POSE, mixPose, ease, KITS, dirOf, ropeDist, fieldPos, GC, ROPE, BAT_Z, STUMPS_Z, ORIGIN_Z };
})();
