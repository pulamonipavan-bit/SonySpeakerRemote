/* Boundary Blast — skinned 3D cricketers.
   One smooth body mesh (skinned to 15 bones) + painted kit/face textures + rigid kit (helmet, pads, gloves, caps).
   Joint input (J) is the same structure the animation code produces: pel, chest, head, hface, face, sh[2], el[2], ha[2], hip[2], kn[2], an[2], toe[2]. */
(function () {
  'use strict';
  const V = GL3D.V, UP = [0, 1, 0], NB = 15;
  const B = { pel: 0, chest: 1, head: 2, ua: [3, 6], fa: [4, 7], hd: [5, 8], th: [9, 12], sh: [10, 13], ft: [11, 14] };

  /* ---------------- skeleton ---------------- */
  function restJ() {
    const sh = [[0.178, 1.425, 0], [-0.178, 1.425, 0]];
    const el = sh.map((s, i) => V.madd(s, V.norm([0.05 * (i ? -1 : 1), -1, -0.07]), 0.30));
    const ha = el.map((e, i) => V.madd(e, V.norm([0.02 * (i ? -1 : 1), -1, 0.12]), 0.28));
    const hip = [[0.1, 1.0, 0], [-0.1, 1.0, 0]];
    const kn = hip.map((h, i) => V.madd(h, V.norm([0.01 * (i ? -1 : 1), -1, 0.03]), 0.46));
    const an = kn.map((k, i) => V.madd(k, V.norm([0.005 * (i ? -1 : 1), -1, -0.035]), 0.45));
    return { pel: [0, 1.0, 0], chest: [0, 1.40, 0], head: [0, 1.665, 0.01], hface: [0, 0, 1], face: [0, 0, 1], sh, el, ha, hip, kn, an, toe: [[0, 0, 1], [0, 0, 1]] };
  }
  const lf = (o, Y, Xh) => { const X = V.norm(V.sub(Xh, V.mul(Y, V.dot(Xh, Y)))); return { o, X, Y, Z: V.cross(X, Y) }; };
  const toW = (F, v) => V.add(V.add(V.mul(F.X, v[0]), V.mul(F.Y, v[1])), V.mul(F.Z, v[2]));
  const toL = (F, p) => { const d = V.sub(p, F.o); return [V.dot(d, F.X), V.dot(d, F.Y), V.dot(d, F.Z)]; };
  const dirL = (F, d) => [V.dot(d, F.X), V.dot(d, F.Y), V.dot(d, F.Z)];
  let REST_N = null;
  function frames(J) {
    const F = new Array(NB);
    const tUp = V.norm(V.sub(J.chest, J.pel));
    F[0] = lf(J.pel, tUp, V.sub(J.hip[0], J.hip[1]));
    F[1] = lf(J.chest, tUp, V.sub(J.sh[0], J.sh[1]));
    const nd = V.norm(V.sub(J.head, J.chest)), Yh = V.norm(V.add(V.mul(UP, 0.55), V.mul(nd, 0.45)));
    const hf = J.hface || F[1].Z, Zh = V.norm(V.sub(hf, V.mul(Yh, V.dot(hf, Yh))));
    F[2] = { o: J.head, X: V.cross(Yh, Zh), Y: Yh, Z: Zh };
    for (let i = 0; i < 2; i++) {
      const s = J.sh[i], e = J.el[i], h = J.ha[i];
      const raw = V.cross(V.sub(e, s), V.sub(h, e)), fb = REST_N ? toW(F[1], REST_N.arm[i]) : [0, 0, 0];
      const n = V.norm(V.add(raw, V.mul(fb, 0.004))), Yu = V.norm(V.sub(e, s)), Yf = V.norm(V.sub(h, e));
      F[B.ua[i]] = lf(s, Yu, n); F[B.fa[i]] = lf(e, Yf, n); F[B.hd[i]] = lf(h, Yf, n);
      const hp = J.hip[i], k = J.kn[i], a = J.an[i];
      const rawL = V.cross(V.sub(k, hp), V.sub(a, k)), fbL = REST_N ? toW(F[0], REST_N.leg[i]) : [0, 0, 0];
      const nL = V.norm(V.add(rawL, V.mul(fbL, 0.004)));
      F[B.th[i]] = lf(hp, V.norm(V.sub(k, hp)), nL); F[B.sh[i]] = lf(k, V.norm(V.sub(a, k)), nL);
      const t = V.norm([J.toe[i][0], 0, J.toe[i][2]]);
      F[B.ft[i]] = { o: a, X: V.cross(UP, t), Y: UP, Z: t };
    }
    return F;
  }
  const RJ = restJ(); let RF = frames(RJ);
  (function () {
    const arm = [0, 1].map(i => V.norm(dirL(RF[1], V.cross(V.sub(RJ.el[i], RJ.sh[i]), V.sub(RJ.ha[i], RJ.el[i])))));
    const leg = [0, 1].map(i => V.norm(dirL(RF[0], V.cross(V.sub(RJ.kn[i], RJ.hip[i]), V.sub(RJ.an[i], RJ.kn[i])))));
    REST_N = { arm, leg }; RF = frames(RJ);
  })();

  /* ---------------- texture atlas layout (u0, v0, u1, v1) ---------------- */
  const RECT = {
    torso: [0, 0.5, 0.5, 1], head: [0.5, 0.75, 0.75, 1], neck: [0.75, 0.75, 0.875, 1],
    ua: [0.5, 0.5, 0.625, 0.75], fa: [0.625, 0.5, 0.75, 0.75], hand: [0.75, 0.5, 0.875, 0.75],
    th: [0, 0, 0.25, 0.5], sh: [0.25, 0, 0.5, 0.5], foot: [0.5, 0.25, 0.75, 0.5]
  };

  /* ---------------- mesh ---------------- */
  const DATA = [], IDX = [];
  let nV = 0;
  function vert(p, n, uv, b0, b1, w) {
    const f0 = RF[b0], f1 = RF[b1];
    DATA.push(...toL(f0, p), ...toL(f1, p), ...dirL(f0, n), ...dirL(f1, n), uv[0], uv[1], b0, b1, w);
    return nV++;
  }
  const lerpN = (pts, t) => { // piecewise-linear profile with smoothstep between keys
    for (let i = 0; i < pts.length - 1; i++) if (t <= pts[i + 1][0]) { const k = (t - pts[i][0]) / (pts[i + 1][0] - pts[i][0] || 1), e = k * k * (3 - 2 * k); return pts[i].slice(1).map((v, j) => v + (pts[i + 1][j + 1] - v) * e); }
    return pts[pts.length - 1].slice(1);
  };
  /** generic loft: centre line a->b, cross-section axes A1 (x-like) and A2 (front-like), profile keys [t, r1, r2front, r2back, off1, off2] */
  function loft(o) {
    const seg = o.seg || 14, rings = o.rings || 10, R = o.rect, base = nV;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings, c = V.lerp(o.a, o.b, t), [r1, r2f, r2b, o1, o2] = lerpN(o.prof, t);
      let b0 = o.own, b1 = o.own, w = 0;
      if (o.wfn) { const q = o.wfn(t, c); b0 = q[0]; b1 = q[1]; w = q[2]; }
      else if (o.prev !== undefined && t < (o.bA || 0.2)) { b1 = o.prev; w = 0.5 * (1 - t / (o.bA || 0.2)); }
      else if (o.next !== undefined && t > 1 - (o.bB || 0.2)) { b1 = o.next; w = 0.5 * (t - (1 - (o.bB || 0.2))) / (o.bB || 0.2); }
      for (let s = 0; s <= seg; s++) {
        const ph = s / seg * Math.PI * 2, x = Math.cos(ph), z = Math.sin(ph), r2 = z > 0 ? r2f : r2b;
        const p = V.add(c, V.add(V.mul(o.A1, x * r1 + o1), V.mul(o.A2, z * r2 + o2)));
        const n = V.norm(V.add(V.mul(o.A1, x / r1), V.mul(o.A2, z / r2)));
        const u = R[0] + (1 - s / seg) * (R[2] - R[0]), v = R[1] + (o.vFlip ? 1 - t : t) * (R[3] - R[1]);
        vert(p, n, [u, v], b0, b1, w);
      }
    }
    for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = base + r * (seg + 1) + s, b = a + seg + 1; IDX.push(a, b, a + 1, b, b + 1, a + 1); }
    // caps
    [[0, o.capA], [rings, o.capB]].forEach(([r, cap]) => {
      if (!cap) return; const t = r / rings, c = V.add(V.lerp(o.a, o.b, t), V.add(V.mul(o.A1, lerpN(o.prof, t)[3]), V.mul(o.A2, lerpN(o.prof, t)[4])));
      const d = V.norm(V.sub(o.b, o.a)), n = r ? d : V.mul(d, -1);
      const q = o.wfn ? o.wfn(t, c) : [o.own, o.own, 0], uvc = [(R[0] + R[2]) / 2, o.vFlip ? (r ? R[1] : R[3]) : (r ? R[3] : R[1])];
      const ci = vert(V.madd(c, n, cap), n, uvc, q[0], q[1], q[2]);
      for (let s = 0; s < seg; s++) { const a = base + r * (seg + 1) + s; IDX.push(ci, a, a + 1); }
    });
  }
  function buildMesh() {
    const F = RF;
    // torso: crotch -> neck base, blends pelvis -> chest
    loft({ a: [0, 0.965, 0], b: [0, 1.54, 0], A1: [1, 0, 0], A2: [0, 0, 1], seg: 24, rings: 20, rect: RECT.torso,
      prof: [[0, 0.12, 0.075, 0.075, 0, 0.0], [0.06, 0.148, 0.09, 0.098, 0, 0], [0.16, 0.152, 0.094, 0.104, 0, 0], [0.31, 0.143, 0.092, 0.098, 0, 0],
             [0.56, 0.156, 0.108, 0.1, 0, 0], [0.70, 0.172, 0.12, 0.104, 0, 0], [0.8, 0.172, 0.112, 0.1, 0, -0.004], [0.88, 0.15, 0.094, 0.09, 0, -0.008], [0.95, 0.1, 0.07, 0.07, 0, -0.01], [1, 0.062, 0.054, 0.054, 0, -0.01]],
      wfn: (t, c) => { const y = c[1], k = Math.max(0, Math.min(1, (y - 1.0) / 0.3)); return [0, 1, k * k * (3 - 2 * k)]; } });
    // neck
    loft({ a: [0, 1.49, -0.012], b: [0, 1.63, 0.0], A1: [1, 0, 0], A2: [0, 0, 1], seg: 12, rings: 4, rect: RECT.neck,
      prof: [[0, 0.056, 0.05, 0.055, 0, 0], [1, 0.05, 0.048, 0.05, 0, 0]], wfn: t => [1, 2, Math.min(1, t * 1.2)] });
    // head: deformed ellipsoid with jaw, chin and nose
    { const c = RJ.head, seg = 28, rings = 20, R = RECT.head, base = nV;
      for (let r = 0; r <= rings; r++) {
        const th = Math.PI * r / rings, dy = Math.cos(th), ring = Math.sin(th);
        for (let s = 0; s <= seg; s++) {
          const ph = s / seg * Math.PI * 2, dx = Math.cos(ph) * ring, dz = Math.sin(ph) * ring;
          const low = Math.max(0, -dy), front = Math.max(0, dz);
          let x = dx * 0.091 * (1 - 0.2 * low * low), y = dy * 0.118, z = dz * 0.103 * (1 + 0.12 * low * front) - 0.006 * low;
          if (front > 0.9 && Math.abs(dy) < 0.32 && Math.abs(dx) < 0.25) { const g = Math.exp(-((dy + 0.05) ** 2) / 0.012 - (dx ** 2) / 0.006); z += 0.02 * g; }      // nose
          if (dy > -0.05 && dy < 0.25 && front > 0.75) z -= 0.006 * Math.exp(-((dy - 0.12) ** 2) / 0.004) * (Math.abs(dx) > 0.12 ? 1 : 0);        // eye sockets
          const p = V.add(c, [x, y, z]), n = V.norm([dx / 0.091, dy / 0.118, dz / 0.103]);
          const u = R[0] + (1 - s / seg) * (R[2] - R[0]), v = R[1] + (1 - r / rings) * (R[3] - R[1]);
          vert(p, n, [u, v], 2, 2, 0);
        }
      }
      for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = base + r * (seg + 1) + s, b = a + seg + 1; IDX.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    for (let i = 0; i < 2; i++) {
      const sg = i ? -1 : 1, fu = F[B.ua[i]], ff = F[B.fa[i]], fh = F[B.hd[i]];
      // upper arm (deltoid -> biceps -> elbow)
      loft({ a: V.madd(RJ.sh[i], fu.Y, -0.075), b: RJ.el[i], A1: fu.X, A2: fu.Z, own: B.ua[i], prev: 1, bA: 0.22, next: B.fa[i], bB: 0.15, rect: RECT.ua, vFlip: true, seg: 16, rings: 10,
        prof: [[0, 0.012, 0.012, 0.012, -0.03 * sg, 0], [0.07, 0.05, 0.05, 0.05, -0.012 * sg, 0], [0.16, 0.068, 0.066, 0.064, 0, 0], [0.38, 0.066, 0.064, 0.06, 0, 0.004], [0.65, 0.056, 0.057, 0.051, 0, 0.004], [1, 0.045, 0.043, 0.045, 0, 0]], bA: 0.3 });
      const wrist = V.lerp(RJ.el[i], RJ.ha[i], 0.84);
      loft({ a: RJ.el[i], b: wrist, A1: ff.X, A2: ff.Z, own: B.fa[i], prev: B.ua[i], bA: 0.15, next: B.hd[i], bB: 0.12, rect: RECT.fa, vFlip: true, seg: 14, rings: 8,
        prof: [[0, 0.045, 0.043, 0.045, 0, 0], [0.25, 0.048, 0.042, 0.044, 0, 0], [1, 0.033, 0.026, 0.028, 0, 0]] });
      // hand (mitten)
      loft({ a: wrist, b: V.madd(RJ.ha[i], ff.Y, 0.1), A1: ff.X, A2: ff.Z, own: B.hd[i], prev: B.fa[i], bA: 0.2, rect: RECT.hand, vFlip: true, seg: 12, rings: 6,
        prof: [[0, 0.033, 0.026, 0.028, 0, 0], [0.35, 0.045, 0.024, 0.024, 0, 0.004], [0.8, 0.042, 0.02, 0.02, 0, 0.008], [1, 0.025, 0.012, 0.012, 0, 0.01]], capB: 0.01 });
      const ft = F[B.th[i]], fs = F[B.sh[i]], fo = F[B.ft[i]];
      loft({ a: V.madd(RJ.hip[i], ft.Y, -0.1), b: RJ.kn[i], A1: ft.X, A2: V.mul(ft.Z, -1), own: B.th[i], prev: 0, bA: 0.32, next: B.sh[i], bB: 0.15, rect: RECT.th, vFlip: true, seg: 16, rings: 10,
        prof: [[0, 0.085, 0.08, 0.09, -0.03 * sg, 0], [0.12, 0.1, 0.09, 0.115, -0.022 * sg, -0.012], [0.3, 0.094, 0.09, 0.1, -0.01 * sg, -0.004], [0.5, 0.084, 0.088, 0.08, 0, 0.004], [0.75, 0.07, 0.068, 0.064, 0, 0.004], [1, 0.06, 0.058, 0.058, 0, 0]] });
      loft({ a: RJ.kn[i], b: RJ.an[i], A1: fs.X, A2: V.mul(fs.Z, -1), own: B.sh[i], prev: B.th[i], bA: 0.15, next: B.ft[i], bB: 0.1, rect: RECT.sh, vFlip: true, seg: 14, rings: 10,
        prof: [[0, 0.06, 0.058, 0.058, 0, 0], [0.28, 0.064, 0.052, 0.07, 0, -0.006], [0.8, 0.044, 0.042, 0.044, 0, 0], [1, 0.042, 0.04, 0.042, 0, 0]] });
      // shoe: loft from heel to toe, cross-section in X/Y
      const an = RJ.an[i];
      loft({ a: V.add(an, [0, -0.04, -0.07]), b: V.add(an, [0, -0.05, 0.2]), A1: fo.X, A2: [0, 1, 0], own: B.ft[i], prev: B.sh[i], bA: 0.15, rect: RECT.foot, seg: 14, rings: 8,
        prof: [[0, 0.036, 0.05, 0.035, 0, 0.0], [0.25, 0.046, 0.052, 0.04, 0, 0.002], [0.65, 0.05, 0.036, 0.04, 0, 0.0], [1, 0.03, 0.022, 0.035, 0, 0.005]], capA: 0.01, capB: 0.02 });
    }
  }
  buildMesh();

  /* ---------------- kit textures ---------------- */
  const S = 512;
  function rectPx(r) { return { x: r[0] * S, y: (1 - r[3]) * S, w: (r[2] - r[0]) * S, h: (r[3] - r[1]) * S }; }
  const css = c => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const shade = (c, k) => c.map(v => Math.max(0, Math.min(1, v * k)));
  function paintKit(kit) {
    const c = document.createElement('canvas'); c.width = c.height = S * 2; const g = c.getContext('2d'); g.setTransform(2, 0, 0, 2, 0, 0);   // painted at 2x for crisp close-ups
    const shirt = css(kit.shirt), shirtD = css(shade(kit.shirt, 0.72)), trim = css(kit.trim || [1, 0.8, 0.2]), pants = css(kit.pants), skin = css(kit.skin), skinD = css(shade(kit.skin, 0.8));
    g.fillStyle = skin; g.fillRect(0, 0, S, S);
    // ---- torso ----
    let r = rectPx(RECT.torso);
    let gr = g.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, css(shade(kit.shirt, 1.08))); gr.addColorStop(0.7, shirt); gr.addColorStop(1, shirtD);
    g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    if (kit.pattern) { g.save(); g.globalAlpha = 0.18; g.fillStyle = trim; for (let k = -10; k < 20; k++) { g.beginPath(); g.moveTo(r.x + k * 22, r.y); g.lineTo(r.x + k * 22 + 10, r.y); g.lineTo(r.x + k * 22 - 60, r.y + r.h); g.lineTo(r.x + k * 22 - 70, r.y + r.h); g.fill(); } g.restore(); }
    // side panels (sides are at u = 0, 0.5 -> x = 0, w/2)
    g.fillStyle = trim; [0, r.w / 2, r.w].forEach(x => g.fillRect(r.x + x - 6, r.y + r.h * 0.08, 12, r.h * 0.66));
    g.fillStyle = shirtD; [0, r.w / 2, r.w].forEach(x => g.fillRect(r.x + x - 2, r.y + r.h * 0.08, 4, r.h * 0.66));
    // baked form shading: the sides of the body turn away from the light
    [0, r.w / 2, r.w].forEach(x => { const sg = g.createLinearGradient(r.x + x - 50, 0, r.x + x + 50, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.5, 'rgba(0,0,0,.22)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg; g.fillRect(r.x + x - 50, r.y, 100, r.h); });
    let ug = g.createLinearGradient(0, r.y, 0, r.y + r.h * 0.3); ug.addColorStop(0, 'rgba(0,0,0,.18)'); ug.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ug; g.fillRect(r.x, r.y, r.w, r.h * 0.3);
    const cg = g.createRadialGradient(r.x + r.w * 0.75, r.y + r.h * 0.42, 5, r.x + r.w * 0.75, r.y + r.h * 0.42, 70); cg.addColorStop(0, 'rgba(255,255,255,.10)'); cg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = cg; g.fillRect(r.x, r.y, r.w, r.h);
    // collar + V neck at the front (u = 0.75)
    g.fillStyle = trim; g.fillRect(r.x, r.y, r.w, r.h * 0.045);
    const fx = r.x + r.w * 0.75, bx = r.x + r.w * 0.25;
    g.beginPath(); g.moveTo(fx - 22, r.y); g.lineTo(fx, r.y + 34); g.lineTo(fx + 22, r.y); g.closePath(); g.fillStyle = css(shade(kit.skin, 0.9)); g.fill();
    g.strokeStyle = trim; g.lineWidth = 4; g.beginPath(); g.moveTo(fx - 22, r.y); g.lineTo(fx, r.y + 34); g.lineTo(fx + 22, r.y); g.stroke();
    // trousers + belt (bottom 27%)
    const wy = r.y + r.h * 0.9; g.fillStyle = pants; g.fillRect(r.x, wy, r.w, r.h - (wy - r.y));
    g.fillStyle = css(shade(kit.pants, 0.6)); g.fillRect(r.x, wy, r.w, 5);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(fx - 1, wy + 6, 2, 40);
    ug = g.createLinearGradient(0, wy - 14, 0, wy + 4); ug.addColorStop(0, 'rgba(0,0,0,0)'); ug.addColorStop(1, 'rgba(0,0,0,.28)'); g.fillStyle = ug; g.fillRect(r.x, wy - 14, r.w, 18);   // shirt tucked in
    // chest sponsor + crest, back name + number
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = kit.ink || '#FFFFFF'; g.font = '900 26px system-ui, sans-serif'; g.fillText(kit.sponsor || 'BLAST', fx, r.y + r.h * 0.38);
    g.font = '800 12px system-ui, sans-serif'; g.fillText(kit.no || '7', fx - 30, r.y + r.h * 0.2);
    g.beginPath(); g.arc(fx + 30, r.y + r.h * 0.2, 7, 0, 7); g.fillStyle = trim; g.fill();
    if (kit.back) {
      g.fillStyle = kit.ink || '#FFFFFF'; g.font = '900 20px system-ui, sans-serif'; g.fillText(kit.back[0], bx, r.y + r.h * 0.2);
      g.font = '900 64px system-ui, sans-serif'; g.fillText(kit.back[1], bx, r.y + r.h * 0.43);
    }
    // fabric folds
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 3; for (let k = 0; k < 14; k++) { const x = r.x + Math.random() * r.w, y = r.y + r.h * (0.45 + Math.random() * 0.25); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y + 12, x + 26, y + 6); g.stroke(); }
    // ---- head / face (front at u = 0.75) ----
    r = rectPx(RECT.head); g.fillStyle = skin; g.fillRect(r.x, r.y, r.w, r.h);
    const cx = r.x + r.w * 0.75, H = r.h, Y = v => r.y + (1 - v) * H;   // v: 0 chin .. 1 crown
    gr = g.createRadialGradient(cx, Y(0.55), 4, cx, Y(0.55), r.w * 0.45); gr.addColorStop(0, css(shade(kit.skin, 1.06))); gr.addColorStop(1, skin); g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
    // hair (top + back)
    g.fillStyle = kit.hair || '#1A1410';
    g.beginPath(); g.moveTo(r.x, Y(0.7)); g.lineTo(cx - 30, Y(0.78)); g.quadraticCurveTo(cx, Y(0.86), cx + 30, Y(0.78)); g.lineTo(r.x + r.w, Y(0.7)); g.lineTo(r.x + r.w, r.y); g.lineTo(r.x, r.y); g.fill();
    g.fillRect(r.x + r.w * 0.1, Y(0.75), r.w * 0.3, H * 0.4);
    // beard / stubble
    if (kit.beard) { g.fillStyle = 'rgba(30,20,15,.45)'; g.beginPath(); g.ellipse(cx, Y(0.2), 30, 22, 0, 0, 7); g.fill(); }
    // brows, eyes, nose shade, mouth
    g.fillStyle = '#1C1410'; [-1, 1].forEach(sd => { g.save(); g.translate(cx + sd * 14, Y(0.62)); g.rotate(sd * -0.12); g.fillRect(-8, -2, 16, 3.5); g.restore(); });
    [-1, 1].forEach(sd => { g.fillStyle = '#F4F1EA'; g.beginPath(); g.ellipse(cx + sd * 14, Y(0.555), 6.5, 3.4, 0, 0, 7); g.fill();
      g.fillStyle = '#2B1B10'; g.beginPath(); g.arc(cx + sd * 14, Y(0.555), 2.9, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(cx + sd * 14, Y(0.555), 1.3, 0, 7); g.fill();
      g.strokeStyle = 'rgba(40,25,15,.6)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx + sd * 14, Y(0.555), 6.5, 3.4, 0, Math.PI, 2 * Math.PI); g.stroke(); });
    g.fillStyle = 'rgba(80,45,30,.25)'; g.beginPath(); g.ellipse(cx, Y(0.44), 4, 9, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(40,20,12,.55)'; [-1, 1].forEach(sd => { g.beginPath(); g.ellipse(cx + sd * 3.2, Y(0.405), 1.6, 1.1, 0, 0, 7); g.fill(); });   // nostrils
    [-1, 1].forEach(sd => { const cg2 = g.createRadialGradient(cx + sd * 22, Y(0.4), 2, cx + sd * 22, Y(0.4), 20); cg2.addColorStop(0, 'rgba(160,70,50,.18)'); cg2.addColorStop(1, 'rgba(160,70,50,0)'); g.fillStyle = cg2; g.fillRect(cx + sd * 22 - 20, Y(0.4) - 20, 40, 40); });   // cheeks
    g.fillStyle = 'rgba(0,0,0,.18)'; [-1, 1].forEach(sd => { g.beginPath(); g.ellipse(cx + sd * 14, Y(0.585), 8, 2.2, 0, Math.PI, 2 * Math.PI); g.fill(); });   // eyelid crease
    g.fillStyle = css(shade(kit.skin, 0.58)); g.beginPath(); g.ellipse(cx, Y(0.315), 10.5, 2.0, 0, 0, 7); g.fill();          // lips
    g.fillStyle = css(shade(kit.skin, 0.75)); g.beginPath(); g.ellipse(cx, Y(0.295), 8, 2.4, 0, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(40,20,12,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - 10, Y(0.315)); g.quadraticCurveTo(cx, Y(0.305), cx + 10, Y(0.315)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(cx, Y(0.7), 20, 6, 0, 0, 7); g.fill();
    // ears (sides u = 0.5 / 1.0)
    g.fillStyle = skinD; [r.x + r.w * 0.5, r.x + 2, r.x + r.w - 2].forEach(x => { g.beginPath(); g.ellipse(x, Y(0.5), 6, 11, 0, 0, 7); g.fill(); });
    // ---- neck ----
    r = rectPx(RECT.neck); g.fillStyle = skin; g.fillRect(r.x, r.y, r.w, r.h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(r.x, r.y + r.h * 0.7, r.w, r.h * 0.3);
    // ---- arms ----
    r = rectPx(RECT.ua); g.fillStyle = kit.longSleeve ? shirt : skin; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = shirt; g.fillRect(r.x, r.y, r.w, r.h * 0.6); g.fillStyle = trim; g.fillRect(r.x, r.y + r.h * 0.56, r.w, r.h * 0.05);
    g.fillStyle = shirtD; g.fillRect(r.x, r.y, r.w, 4);
    r = rectPx(RECT.fa); g.fillStyle = kit.longSleeve ? shirt : skin; g.fillRect(r.x, r.y, r.w, r.h);
    if (kit.longSleeve) { g.fillStyle = trim; g.fillRect(r.x, r.y + r.h * 0.88, r.w, r.h * 0.06); }
    else if (kit.band) { g.fillStyle = trim; g.fillRect(r.x, r.y + r.h * 0.86, r.w, r.h * 0.1); }
    r = rectPx(RECT.hand); g.fillStyle = skin; g.fillRect(r.x, r.y, r.w, r.h); g.fillStyle = 'rgba(0,0,0,.12)'; for (let k = 1; k < 4; k++) g.fillRect(r.x + r.w * (0.55 + k * 0.03), r.y + r.h * 0.55, 1.5, r.h * 0.45);
    // ---- legs ----
    r = rectPx(RECT.th); g.fillStyle = pants; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = trim; [0, r.w / 2, r.w].forEach(x => g.fillRect(r.x + x - 4, r.y, 8, r.h));
    g.strokeStyle = 'rgba(0,0,0,.1)'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { const y = r.y + r.h * (0.6 + k * 0.06); g.beginPath(); g.moveTo(r.x + r.w * 0.6, y); g.quadraticCurveTo(r.x + r.w * 0.75, y + 8, r.x + r.w * 0.9, y); g.stroke(); }
    r = rectPx(RECT.sh); g.fillStyle = pants; g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = trim; [0, r.w / 2, r.w].forEach(x => g.fillRect(r.x + x - 4, r.y, 8, r.h * 0.8));
    g.fillStyle = kit.socks ? css(kit.socks) : '#F2F2F2'; g.fillRect(r.x, r.y + r.h * 0.84, r.w, r.h * 0.16);
    // ---- shoes (sole along u = 0.25 underneath) ----
    r = rectPx(RECT.foot); g.fillStyle = css(kit.shoes || [0.95, 0.95, 0.95]); g.fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#2A2C33'; g.fillRect(r.x + r.w * 0.12, r.y, r.w * 0.26, r.h);
    g.fillStyle = trim; g.beginPath(); g.moveTo(r.x + r.w * 0.55, r.y + r.h * 0.3); g.lineTo(r.x + r.w * 0.9, r.y + r.h * 0.45); g.lineTo(r.x + r.w * 0.55, r.y + r.h * 0.6); g.fill();
    return c;
  }

  /* ---------------- runtime ---------------- */
  function init(R) { if (!R._charMesh) { R._charMesh = R.uploadRaw(new Float32Array(DATA), IDX); R._charTex = {}; } }
  const tmp = new Float32Array(NB * 16);
  function boneMats(F) {
    for (let i = 0; i < NB; i++) {
      const f = F[i], o = i * 16;
      tmp[o] = f.X[0]; tmp[o + 1] = f.X[1]; tmp[o + 2] = f.X[2]; tmp[o + 3] = 0;
      tmp[o + 4] = f.Y[0]; tmp[o + 5] = f.Y[1]; tmp[o + 6] = f.Y[2]; tmp[o + 7] = 0;
      tmp[o + 8] = f.Z[0]; tmp[o + 9] = f.Z[1]; tmp[o + 10] = f.Z[2]; tmp[o + 11] = 0;
      tmp[o + 12] = f.o[0]; tmp[o + 13] = f.o[1]; tmp[o + 14] = f.o[2]; tmp[o + 15] = 1;
    }
    return tmp;
  }
  function kitTex(R, kit) { const key = kit.key || JSON.stringify(kit), T = R._charTex; if (!T[key]) T[key] = R.texture(paintKit(kit), false); return T[key]; }
  const at = (F, l) => V.add(F.o, toW(F, l));   // local point on a bone -> world
  function ell(R, c, X, Y, Z, mat) { R.draw(R.meshes.sphere, R.M.basis(X, Y, Z, c), mat); }
  let TOWERS = null;
  function draw(R, J, kit, opts) {
    init(R); opts = opts || {};
    if (R.shadowPass && (Math.abs(J.pel[2] - 9.5) > 18 || Math.abs(J.pel[0]) > 16)) return;   // only players near the pitch cast map shadows
    const F = frames(J);
    R.drawSkin(R._charMesh, boneMats(F), { tex: kitTex(R, kit), spec: 0.22, rim: 0.32 });
    const head = F[2], hX = head.X, hY = head.Y, hZ = head.Z;
    // ---- headgear ----
    if (kit.head === 'helmet') {
      const hm = { c: kit.helmet, spec: 1.1, rim: 0.3 };
      ell(R, at(head, [0, 0.042, -0.012]), V.mul(hX, 0.124), V.mul(hY, 0.112), V.mul(hZ, 0.132), hm);
      ell(R, at(head, [0, -0.04, -0.085]), V.mul(hX, 0.1), V.mul(hY, 0.062), V.mul(hZ, 0.05), hm);
      R.obox(at(head, [0, 0.074, 0.128]), hX, V.norm(V.madd(hY, hZ, -0.5)), 0.21, 0.016, 0.085, hm);
      ell(R, at(head, [0.105, -0.025, 0.03]), V.mul(hX, 0.025), V.mul(hY, 0.06), V.mul(hZ, 0.05), hm);
      ell(R, at(head, [-0.105, -0.025, 0.03]), V.mul(hX, 0.025), V.mul(hY, 0.06), V.mul(hZ, 0.05), hm);
      const gm = { c: [0.78, 0.8, 0.83], spec: 1.2 };
      [0.018, -0.024, -0.066].forEach(y => { const l = at(head, [-0.1, y, 0.07]), m = at(head, [0, y, 0.138]), r = at(head, [0.1, y, 0.07]); R.seg(l, m, 0.006, gm, 0.006, true); R.seg(m, r, 0.006, gm); });
      R.seg(at(head, [0, 0.03, 0.136]), at(head, [0, -0.09, 0.128]), 0.006, gm, 0.006, true);
      R.draw(R.meshes.disc, R.M.basis(V.mul(hX, 0.03), V.mul(hZ, 1), V.mul(hY, 0.03), at(head, [0, 0.105, 0.105])), { c: kit.trim || [1, 0.8, 0.2], em: 0.3 });
    } else if (kit.head === 'cap') {
      ell(R, at(head, [0, 0.04, -0.004]), V.mul(hX, 0.1), V.mul(hY, 0.084), V.mul(hZ, 0.108), { c: kit.cap, spec: 0.15, rim: 0.25 });
      R.obox(at(head, [0, 0.052, 0.128]), hX, V.norm(V.madd(hY, hZ, -0.18)), 0.16, 0.012, 0.1, { c: kit.cap });
      if (kit.shades) R.obox(at(head, [0, 0.012, 0.104]), hX, hY, 0.15, 0.03, 0.01, { c: [0.05, 0.05, 0.08], spec: 1.5 });
    } else if (kit.head === 'hat') {
      R.draw(R.meshes.disc, R.M.basis(V.mul(hX, 0.19), hY, V.mul(hZ, 0.19), at(head, [0, 0.07, 0])), { c: kit.cap, rim: 0.2 });
      ell(R, at(head, [0, 0.1, 0]), V.mul(hX, 0.1), V.mul(hY, 0.06), V.mul(hZ, 0.105), { c: kit.cap, rim: 0.2 });
      R.obox(at(head, [0, 0.075, 0]), hX, hY, 0.205, 0.02, 0.215, { c: [0.15, 0.15, 0.2] });
    }
    // ---- pads ----
    if (kit.pads) for (let i = 0; i < 2; i++) {
      // pads always sit on the FRONT of the shin: the side the toes point to
      const k0 = J.kn[i], dY = V.sub(J.an[i], k0), L = V.len(dY), Y = V.mul(dY, 1 / L);
      let fw = V.sub(J.toe[i], V.mul(Y, V.dot(J.toe[i], Y))); fw = V.len(fw) < 1e-3 ? F[B.sh[i]].Z : V.norm(fw);
      const X = V.norm(V.cross(Y, fw)), s = { o: k0, X, Y, Z: fw };
      const pm = { c: kit.padCol || [0.97, 0.97, 0.97], spec: 0.3, rim: 0.25 };
      ell(R, at(s, [0, L * 0.5, 0.045]), V.mul(s.X, 0.09), V.mul(s.Y, L * 0.5 + 0.08), V.mul(s.Z, 0.055), pm);
      [-0.05, 0, 0.05].forEach(x => R.seg(at(s, [x, 0.0, 0.085]), at(s, [x, L + 0.02, 0.085]), 0.024, pm, 0.024, true));
      ell(R, at(s, [0, -0.02, 0.085]), V.mul(s.X, 0.09), V.mul(s.Y, 0.075), V.mul(s.Z, 0.06), pm);
      ell(R, at(s, [0, -0.12, 0.07]), V.mul(s.X, 0.085), V.mul(s.Y, 0.09), V.mul(s.Z, 0.045), pm);     // thigh flap
      [0.25, 0.7].forEach(k => R.obox(at(s, [0, L * k, 0.0]), s.X, s.Y, 0.2, 0.024, 0.115, { c: [0.12, 0.12, 0.16] }));     // straps round the back
    }
    // ---- gloves ----
    for (let i = 0; i < 2; i++) {
      if (!kit.gloves) continue; const h = F[B.hd[i]];
      if (kit.bigGloves) {
        ell(R, at(h, [0, 0.07, 0.01]), V.mul(h.X, 0.095), V.mul(h.Y, 0.125), V.mul(h.Z, 0.055), { c: kit.gloves, spec: 0.4, rim: 0.25 });
        ell(R, at(h, [0, -0.05, 0]), V.mul(h.X, 0.06), V.mul(h.Y, 0.04), V.mul(h.Z, 0.05), { c: kit.gloveTrim || [0.75, 0.1, 0.1] });
      } else {
        ell(R, at(h, [0, 0.03, 0.005]), V.mul(h.X, 0.052), V.mul(h.Y, 0.07), V.mul(h.Z, 0.045), { c: kit.gloves, spec: 0.35, rim: 0.2 });
        [-0.03, -0.01, 0.01, 0.03].forEach(x => R.seg(at(h, [x, 0.0, 0.035]), at(h, [x, 0.085, 0.03]), 0.012, { c: kit.gloves, spec: 0.3 }, 0.012, true));
        ell(R, at(h, [0, -0.04, 0]), V.mul(h.X, 0.05), V.mul(h.Y, 0.03), V.mul(h.Z, 0.046), { c: kit.gloveTrim || [0.1, 0.25, 0.75] });
      }
    }
    // ---- shadows: one soft shadow per floodlight + contact shadow ----
    if (!TOWERS) TOWERS = W3.towers();
    if (opts.noShadow) return;
    const p = J.pel, h = Math.max(0.6, p[1]);
    const tb = R.shadowReady && Math.abs(p[2] - 9.5) < 17 && Math.abs(p[0]) < 15 ? 0.05 : 0.11;
    TOWERS.forEach(t => { const d = V.norm([p[0] - t[0], 0, p[2] - t[2]]); R.blob(p[0] + d[0] * 0.55 * h, p[2] + d[2] * 0.55 * h, 0.95 * h, 0.26, tb, Math.atan2(-d[2], d[0])); });
    [0, 1].forEach(i => R.blob(J.an[i][0], J.an[i][2], 0.16, 0.16, 0.3));
    R.blob(p[0], p[2], 0.42, 0.42, 0.18);
  }
  window.Char = { draw, frames, B, init };
})();
