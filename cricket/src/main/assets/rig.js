/* Boundary Blast: jointed 2D characters (batsman side-on, bowler from behind, fielders), drawn with shading.
   Units are metres; (0,0) is between the feet; y goes UP. The caller passes a scale (pixels per metre). */
(function (root) {
  'use strict';

  /* ---------------- batsman poses (right-hander, facing screen-left, seen from the bowler's end) ---------------- */
  // hip: hip point; lean: torso tilt (rad, - = forward/left); fF/bF: front/back foot; hands: where the gloves are;
  // bat: angle of the bat from the gloves (0 = straight down, + = towards the right/behind, PI = straight up)
  const POSES = {
    stance:   { hip: [0.04, 0.9],  lean: -0.2,  fF: [-0.16, -0.03], bF: [0.2, 0.02],  hands: [-0.12, 0.84], bat: 0.42, head: 0 },
    tap:      { hip: [0.04, 0.88], lean: -0.22, fF: [-0.16, -0.03], bF: [0.2, 0.02],  hands: [-0.1, 0.88],  bat: 0.6,  head: 0 },
    backlift: { hip: [0.05, 0.9],  lean: -0.18, fF: [-0.18, -0.03], bF: [0.2, 0.02],  hands: [0.02, 1.2],   bat: 2.45, head: 0 },
    // follow-throughs
    drive:    { hip: [-0.14, 0.82], lean: -0.42, fF: [-0.46, -0.09], bF: [0.2, 0.03], hands: [-0.3, 1.42],  bat: -2.5, head: 0.1 },
    cover:    { hip: [-0.16, 0.8],  lean: -0.5,  fF: [-0.5, -0.06],  bF: [0.18, 0.03], hands: [-0.42, 1.3], bat: -2.0, head: 0.1 },
    cut:      { hip: [-0.02, 0.86], lean: -0.32, fF: [-0.2, -0.03],  bF: [0.34, 0.02], hands: [-0.46, 1.06], bat: -1.4, head: 0.2 },
    pull:     { hip: [0.16, 0.92],  lean: 0.18,  fF: [-0.06, -0.02], bF: [0.34, 0.03], hands: [0.32, 1.32],  bat: 2.1,  head: -0.1 },
    glance:   { hip: [0.0, 0.86],   lean: -0.18, fF: [-0.3, -0.06],  bF: [0.2, 0.03],  hands: [0.1, 0.98],   bat: 0.9,  head: 0 },
    ramp:     { hip: [-0.06, 0.66], lean: -0.6,  fF: [-0.4, -0.08],  bF: [0.26, 0.02], hands: [-0.24, 0.96], bat: 2.9,  head: 0.2 },
    slog:     { hip: [0.06, 0.84],  lean: -0.2,  fF: [-0.34, -0.06], bF: [0.24, 0.03], hands: [0.26, 1.5],   bat: 2.6,  head: 0 },
    block:    { hip: [-0.12, 0.84], lean: -0.4,  fF: [-0.42, -0.08], bF: [0.2, 0.03],  hands: [-0.34, 1.0],  bat: 0.08, head: 0.1 },
    leave:    { hip: [0.08, 0.92],  lean: -0.05, fF: [-0.18, -0.03], bF: [0.24, 0.03], hands: [0.05, 1.55],  bat: 2.95, head: 0 },
    out:      { hip: [0.04, 0.9],   lean: -0.05, fF: [-0.16, -0.03], bF: [0.2, 0.02],  hands: [0.0, 1.0],    bat: 0.25, head: -0.3 }
  };
  const SHOT_POSE = { N: 'drive', NE: 'cover', E: 'cut', SE: 'cut', S: 'ramp', SW: 'glance', W: 'pull', NW: 'slog', C: 'block' };

  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(p, q, t) {
    const o = {};
    for (const k in p) o[k] = Array.isArray(p[k]) ? [lerp(p[k][0], q[k][0], t), lerp(p[k][1], q[k][1], t)] : lerp(p[k], q[k], t);
    return o;
  }
  const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

  /** two-bone IK: returns the middle joint between a and b with limb lengths l1, l2; bend = +1/-1 picks the side */
  function ik(a, b, l1, l2, bend) {
    const dx = b[0] - a[0], dy = b[1] - a[1]; let d = Math.hypot(dx, dy); d = Math.min(d, l1 + l2 - 1e-4);
    const ang = Math.atan2(dy, dx), cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), off = Math.acos(Math.max(-1, Math.min(1, cos)));
    const t = ang + off * bend; return [a[0] + Math.cos(t) * l1, a[1] + Math.sin(t) * l1];
  }

  /* ---------------- drawing helpers (y up -> canvas y down) ---------------- */
  function limb(g, X, a, b, w, fill, edge) {
    const A = X(a), B = X(b);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (edge){ g.strokeStyle = edge; g.lineWidth = w + Math.max(1, w * 0.12); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
    g.strokeStyle = fill instanceof Function ? fill(A, B) : fill; g.lineWidth = w;
    g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0] + 0.01, B[1] + 0.01); g.stroke();
  }
  function shadeGrad(g, A, B, w, c1, c2) {    // light from the top-left
    const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, gr = g.createLinearGradient(mx - w, my - w * 0.3, mx + w, my + w * 0.3);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr;
  }

  /* ---------------- the batsman ---------------- */
  // kit colours
  const KIT = { shirt: '#1F5FD6', shirtDark: '#123E99', trim: '#FFC94A', pad: '#F6F6F2', padShade: '#C9CCD3', helmet: '#132B66', skin: '#B87A4B', glove: '#F2F2F2', bat: '#E9CF95', batDark: '#B8924F', shoe: '#EDEDED' };

  /**
   * Draw the batsman.
   * g: canvas context, x,y: screen point between the feet, s: pixels per metre, pose: pose object, mirror: -1 for left-handers
   */
  function drawBatsman(g, x, y, s, pose, mirror) {
    const m = mirror || 1;
    const X = p => [x + p[0] * s * m, y - p[1] * s];
    const K = KIT, p = pose;
    const hip = p.hip, torsoLen = 0.56, lean = p.lean;
    const neck = [hip[0] + Math.sin(lean) * torsoLen, hip[1] + Math.cos(lean) * torsoLen];
    const shF = [neck[0] - 0.03, neck[1] - 0.05], shB = [neck[0] + 0.08, neck[1] - 0.02];
    const head = [neck[0] + Math.sin(lean) * 0.15 - 0.02, neck[1] + 0.15];
    const kneeF = ik(hip, p.fF, 0.47, 0.47, m > 0 ? 1 : 1), kneeB = ik(hip, p.bF, 0.47, 0.47, 1);
    // knees bend forward (towards the off side = screen left for a right-hander)
    const kF = [Math.min(kneeF[0], (hip[0] + p.fF[0]) / 2 - 0.05), kneeF[1]], kB = [Math.min(kneeB[0], (hip[0] + p.bF[0]) / 2 - 0.02), kneeB[1]];
    const kneeFF = ik(hip, p.fF, 0.47, 0.47, -1), kneeBB = ik(hip, p.bF, 0.47, 0.47, -1);
    const KF = kneeFF[0] < kneeF[0] ? kneeFF : kneeF, KB = kneeBB[0] < kneeB[0] ? kneeBB : kneeB;
    // bat
    const batLen = 0.86, batEnd = [p.hands[0] + Math.sin(p.bat) * batLen, p.hands[1] - Math.cos(p.bat) * batLen];
    const handle = [p.hands[0] + Math.sin(p.bat) * 0.26, p.hands[1] - Math.cos(p.bat) * 0.26];

    // shadow
    const S = X([0, 0]); g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(S[0], S[1], 0.55 * s, 0.09 * s, 0, 0, 6.3); g.fill();

    // ---- back leg (far side, slightly darker) ----
    limb(g, X, hip, KB, 0.2 * s, '#DADCE0');
    limb(g, X, KB, p.bF, 0.17 * s, (A, B) => shadeGrad(g, A, B, 0.2 * s, K.padShade, '#9EA3AD'));
    footShape(g, X, p.bF, s, m, '#CFCFCF');
    // ---- bat behind the body when it's raised behind ----
    const batBehind = Math.cos(p.bat) < -0.2 && Math.sin(p.bat) * m > -0.2;
    if (batBehind) drawBat(g, X, handle, batEnd, s);
    // ---- back arm ----
    const elbB = ik(shB, p.hands, 0.3, 0.29, -1);
    limb(g, X, shB, elbB, 0.12 * s, K.shirtDark); limb(g, X, elbB, p.hands, 0.1 * s, K.skin);
    // ---- torso ----
    limb(g, X, hip, neck, 0.42 * s, (A, B) => shadeGrad(g, A, B, 0.3 * s, '#3D7CF0', K.shirtDark));
    // number on the back-side seam (a stripe of trim)
    limb(g, X, [hip[0] + 0.06, hip[1] + 0.12], [neck[0] + 0.07, neck[1] - 0.12], 0.035 * s, K.trim);
    // trousers / hips
    limb(g, X, [hip[0] - 0.05, hip[1] + 0.02], [hip[0] + 0.06, hip[1] + 0.03], 0.22 * s, '#F0F0EE');
    // ---- front leg (near side, pad) ----
    limb(g, X, hip, KF, 0.21 * s, '#F4F4F2');
    padShape(g, X, KF, p.fF, s, K);
    footShape(g, X, p.fF, s, m, K.shoe);
    // ---- head + helmet ----
    const H = X(head), hr = 0.13 * s;
    g.fillStyle = K.skin; g.beginPath(); g.arc(H[0] - 0.03 * s * m, H[1] + 0.03 * s, hr * 0.8, 0, 6.3); g.fill();
    const hg = g.createRadialGradient(H[0] - hr * 0.4 * m, H[1] - hr * 0.5, hr * 0.1, H[0], H[1], hr * 1.2);
    hg.addColorStop(0, '#2F57B8'); hg.addColorStop(1, K.helmet);
    g.fillStyle = hg; g.beginPath(); g.arc(H[0], H[1] - hr * 0.15, hr, Math.PI * 0.9, Math.PI * 2.15); g.closePath(); g.fill();
    g.fillRect(H[0] - hr * (m > 0 ? 1.15 : -0.1), H[1] - hr * 0.25, hr * 1.25, hr * 0.16);         // peak
    g.strokeStyle = '#D9DDE6'; g.lineWidth = Math.max(0.8, 0.012 * s);                           // grille
    const gx = H[0] - hr * 0.95 * m;
    for (let i = 0; i < 3; i++){ g.beginPath(); g.moveTo(gx, H[1] - hr * 0.05 + i * hr * 0.28); g.lineTo(H[0] - hr * 0.1 * m, H[1] + hr * 0.1 + i * hr * 0.3); g.stroke(); }
    g.beginPath(); g.moveTo(gx, H[1] - hr * 0.05); g.lineTo(gx + hr * 0.05 * m, H[1] + hr * 0.75); g.stroke();
    g.fillStyle = K.trim; g.fillRect(H[0] + hr * 0.2 * (m > 0 ? 1 : -2), H[1] - hr * 0.9, hr * 0.35, hr * 0.12);
    // ---- front arm + gloves ----
    const elbF = ik(shF, p.hands, 0.3, 0.29, -1);
    limb(g, X, shF, elbF, 0.13 * s, (A, B) => shadeGrad(g, A, B, 0.12 * s, '#2E72EE', K.shirt));
    limb(g, X, elbF, p.hands, 0.11 * s, K.skin);
    const G1 = X(p.hands); g.fillStyle = K.glove; g.beginPath(); g.ellipse(G1[0], G1[1], 0.075 * s, 0.065 * s, 0, 0, 6.3); g.fill();
    g.fillStyle = '#1F5FD6'; g.beginPath(); g.ellipse(G1[0], G1[1], 0.075 * s, 0.02 * s, 0, 0, 6.3); g.fill();
    if (!batBehind) drawBat(g, X, handle, batEnd, s);
  }
  function padShape(g, X, knee, foot, s, K) {
    const A = X([knee[0], knee[1] + 0.06]), B = X([foot[0], foot[1] + 0.06]);
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, w = 0.2 * s, nx = -dy / L * w / 2, ny = dx / L * w / 2;
    const gr = g.createLinearGradient(A[0] - w, A[1], A[0] + w, A[1]); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.6, K.pad); gr.addColorStop(1, K.padShade);
    g.fillStyle = gr; g.beginPath();
    g.moveTo(A[0] + nx * 1.15, A[1] + ny * 1.15 - 0.05 * s); g.lineTo(B[0] + nx, B[1] + ny); g.lineTo(B[0] - nx, B[1] - ny); g.lineTo(A[0] - nx * 1.15, A[1] - ny * 1.15 - 0.05 * s);
    g.quadraticCurveTo(A[0], A[1] - 0.14 * s, A[0] + nx * 1.15, A[1] + ny * 1.15 - 0.05 * s); g.fill();
    g.strokeStyle = 'rgba(150,155,165,.7)'; g.lineWidth = Math.max(0.6, 0.012 * s);           // vertical pad rolls
    for (let i = -1; i <= 1; i++){ g.beginPath(); g.moveTo(A[0] + nx * 0.55 * i, A[1] + ny * 0.55 * i); g.lineTo(B[0] + nx * 0.55 * i, B[1] + ny * 0.55 * i); g.stroke(); }
    g.fillStyle = '#C9CCD3'; g.beginPath(); g.ellipse((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, w * 0.45, w * 0.1, 0, 0, 6.3); g.fill();   // strap
  }
  function footShape(g, X, f, s, m, col) {
    const F = X(f); g.fillStyle = col; g.beginPath(); g.ellipse(F[0] - 0.07 * s * m, F[1] - 0.02 * s, 0.13 * s, 0.05 * s, 0, 0, 6.3); g.fill();
    g.fillStyle = '#2B2B2B'; g.fillRect(F[0] - 0.19 * s * (m > 0 ? 1 : -0.2), F[1] - 0.005 * s, 0.24 * s, 0.018 * s);
  }
  function drawBat(g, X, handle, end, s) {
    const A = X(handle), B = X(end), dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const H0 = X([handle[0] - (end[0] - handle[0]) * 0.42, handle[1] - (end[1] - handle[1]) * 0.42]);
    g.strokeStyle = '#2A2A2A'; g.lineWidth = Math.max(1.5, 0.045 * s); g.lineCap = 'round'; g.beginPath(); g.moveTo(H0[0], H0[1]); g.lineTo(A[0], A[1]); g.stroke();   // grip
    const w = 0.11 * s, bw = 0.06 * s;
    const gr = g.createLinearGradient(A[0] + nx * w, A[1] + ny * w, A[0] - nx * w, A[1] - ny * w); gr.addColorStop(0, '#F7E3B0'); gr.addColorStop(0.5, '#E2C27F'); gr.addColorStop(1, '#B8924F');
    g.fillStyle = gr; g.beginPath();
    g.moveTo(A[0] + nx * w * 0.35, A[1] + ny * w * 0.35); g.lineTo(A[0] + ux * bw + nx * w / 2, A[1] + uy * bw + ny * w / 2); g.lineTo(B[0] + nx * w / 2, B[1] + ny * w / 2);
    g.quadraticCurveTo(B[0] + ux * w * 0.3, B[1] + uy * w * 0.3, B[0] - nx * w / 2, B[1] - ny * w / 2); g.lineTo(A[0] + ux * bw - nx * w / 2, A[1] + uy * bw - ny * w / 2);
    g.lineTo(A[0] - nx * w * 0.35, A[1] - ny * w * 0.35); g.closePath(); g.fill();
    g.fillStyle = 'rgba(20,20,20,.75)'; g.fillRect(0, 0, 0, 0);
    const mx = A[0] + dx * 0.55, my = A[1] + dy * 0.55; g.save(); g.translate(mx, my); g.rotate(Math.atan2(dy, dx));
    g.fillStyle = '#1C1C1C'; g.font = `900 ${Math.max(5, 0.07 * s)}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BLAST', 0, 0); g.restore();
  }

  /* ---------------- the bowler (seen from behind, close to the camera) ---------------- */
  /** phase: 0..1 run-up, 1..1.5 delivery stride + release, >1.5 follow-through. */
  function drawBowler(g, x, y, s, phase, mirror) {
    const m = mirror || 1, X = p => [x + p[0] * s * m, y - p[1] * s];
    const run = Math.min(phase, 1), stride = Math.max(0, Math.min(1, (phase - 1) / 0.5)), after = Math.max(0, phase - 1.5);
    const cyc = run * Math.PI * 7;
    const bob = Math.abs(Math.sin(cyc)) * 0.06 * (1 - stride);
    const hip = [0, 0.95 + bob + stride * 0.08 - after * 0.15], neck = [0.02 - after * 0.25, hip[1] + 0.6 - after * 0.1];
    const legA = Math.sin(cyc) * 0.35 * (1 - stride), lf = [-0.15 - legA * 0.4 - stride * 0.25, 0.02 + Math.max(0, Math.sin(cyc)) * 0.18 * (1 - stride)], rf = [0.15 + legA * 0.4 + stride * 0.15, 0.02 + Math.max(0, -Math.sin(cyc)) * 0.18 * (1 - stride)];
    const S = X([0, 0]); g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(S[0], S[1], 0.45 * s, 0.08 * s, 0, 0, 6.3); g.fill();
    const kL = ik(hip, lf, 0.48, 0.48, 1), kR = ik(hip, rf, 0.48, 0.48, -1);
    limb(g, X, hip, kL, 0.2 * s, '#ECECEA'); limb(g, X, kL, lf, 0.16 * s, '#E2E2DF');
    limb(g, X, hip, kR, 0.2 * s, '#ECECEA'); limb(g, X, kR, rf, 0.16 * s, '#E2E2DF');
    [lf, rf].forEach(f => { const F = X(f); g.fillStyle = '#F6F6F6'; g.beginPath(); g.ellipse(F[0], F[1], 0.08 * s, 0.05 * s, 0, 0, 6.3); g.fill(); });
    // torso from behind with name + number
    limb(g, X, hip, neck, 0.44 * s, (A, B) => shadeGrad(g, A, B, 0.4 * s, '#E0453A', '#9A2018'));
    const T = X([(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2 + 0.05]);
    g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${0.08 * s}px system-ui`; g.fillText('RAO', T[0], T[1] - 0.1 * s); g.font = `900 ${0.17 * s}px system-ui`; g.fillText('21', T[0], T[1] + 0.04 * s);
    // arms: non-bowling arm points at the batsman, bowling arm windmills over the top at release
    const shL = [neck[0] - 0.17, neck[1] - 0.05], shR = [neck[0] + 0.17, neck[1] - 0.05];
    const armSwing = Math.sin(cyc) * 0.6 * (1 - stride);
    const bowl = stride > 0 ? Math.min(1, stride * 1.3) : 0;
    const handL = stride > 0 ? [shL[0] - 0.2 + bowl * 0.25, shL[1] + 0.45 - bowl * 0.8] : [shL[0] - 0.05 + armSwing * 0.2, shL[1] - 0.5];
    const ang = -0.6 + bowl * Math.PI * 1.35 + after * 1.2;                  // right arm goes up and over
    const handR = stride > 0 ? [shR[0] + Math.sin(ang) * 0.62 * -1, shR[1] + Math.cos(ang) * 0.62] : [shR[0] + 0.05 - armSwing * 0.2, shR[1] - 0.52];
    limb(g, X, shL, handL, 0.11 * s, '#B5362C'); limb(g, X, shR, handR, 0.11 * s, '#C8402F');
    [handL, handR].forEach(h => { const H = X(h); g.fillStyle = '#B87A4B'; g.beginPath(); g.arc(H[0], H[1], 0.05 * s, 0, 6.3); g.fill(); });
    const N = X([neck[0], neck[1] + 0.13]); g.fillStyle = '#2A1C14'; g.beginPath(); g.arc(N[0], N[1], 0.12 * s, 0, 6.3); g.fill();
    return X(handR);   // where the ball is released from
  }

  /* ---------------- fielders (small, crouched, ready) ---------------- */
  function drawFielder(g, x, y, s, keeper) {
    const X = p => [x + p[0] * s, y - p[1] * s];
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y, 0.4 * s, 0.07 * s, 0, 0, 6.3); g.fill();
    const hip = [0, keeper ? 0.55 : 0.78], neck = [0, hip[1] + 0.5];
    limb(g, X, hip, [-0.18, 0.4], 0.17 * s, '#EAEAEA'); limb(g, X, [-0.18, 0.4], [-0.22, 0], 0.14 * s, '#DADADA');
    limb(g, X, hip, [0.18, 0.4], 0.17 * s, '#EAEAEA'); limb(g, X, [0.18, 0.4], [0.22, 0], 0.14 * s, '#DADADA');
    limb(g, X, hip, neck, 0.38 * s, keeper ? '#B5362C' : '#D8433B');
    limb(g, X, [-0.15, neck[1] - 0.05], [-0.22, hip[1] + 0.05], 0.1 * s, keeper ? '#F2F2F2' : '#C8402F');
    limb(g, X, [0.15, neck[1] - 0.05], [0.22, hip[1] + 0.05], 0.1 * s, keeper ? '#F2F2F2' : '#C8402F');
    const H = X([0, neck[1] + 0.14]); g.fillStyle = keeper ? '#132B66' : '#2A1C14'; g.beginPath(); g.arc(H[0], H[1], 0.12 * s, 0, 6.3); g.fill();
    if (!keeper){ g.fillStyle = '#F6F2E4'; g.beginPath(); g.ellipse(H[0], H[1] - 0.07 * s, 0.15 * s, 0.05 * s, 0, 0, 6.3); g.fill(); }   // sun hat brim
  }

  const API = { POSES, SHOT_POSE, mix, ease, drawBatsman, drawBowler, drawFielder };
  root.Rig = API;
})(typeof window !== 'undefined' ? window : globalThis);
