/* Boundary Blast: game rules. Pure logic (no drawing), so it can be tested in Node. */
(function (root) {
  'use strict';

  /* ---------- shots: 8 directions + block. angle: 0 = straight back past the bowler, clockwise towards the off side
     (for a right-hander). Off side is on the RIGHT of the screen because we watch from behind the batsman. ---------- */
  const SHOTS = {
    N:  { name: 'Straight drive', angle: 0 },
    NE: { name: 'Cover drive', angle: 42 },
    E:  { name: 'Square cut', angle: 92 },
    SE: { name: 'Late cut', angle: 142 },
    S:  { name: 'Ramp over keeper', angle: 180 },
    SW: { name: 'Leg glance', angle: 212 },
    W:  { name: 'Pull', angle: 268 },
    NW: { name: 'On drive / slog', angle: 318 },
    C:  { name: 'Block', angle: 0 }
  };

  /* ---------- deliveries ---------- */
  const LINES = ['wide', 'off', 'middle', 'leg'];
  const LENGTHS = ['yorker', 'full', 'good', 'short', 'bouncer', 'fulltoss'];
  const LENGTH_NAME = { yorker: 'Yorker', full: 'Full', good: 'Good length', short: 'Short', bouncer: 'Bouncer', fulltoss: 'Full toss' };
  const LINE_NAME = { wide: 'wide outside off', off: 'outside off', middle: 'on the stumps', leg: 'on the pads' };
  /* where the ball pitches (metres from the batsman) and how high it arrives at the bat */
  const LENGTH_GEO = {
    yorker: { bounceZ: 0.6, arriveY: 0.12 }, full: { bounceZ: 2.6, arriveY: 0.45 }, good: { bounceZ: 5.5, arriveY: 0.8 },
    short: { bounceZ: 8.5, arriveY: 1.15 }, bouncer: { bounceZ: 11, arriveY: 1.7 }, fulltoss: { bounceZ: -1, arriveY: 0.9 }
  };
  const LINE_X = { wide: 0.75, off: 0.32, middle: 0.0, leg: -0.28 };   // + = off side

  /* How well each shot suits each ball (1 = textbook, 0 = asking for trouble). */
  function shotFit(dir, line, length) {
    if (dir === 'C') return line === 'wide' ? 0.6 : 0.9;
    const T = {
      yorker:  { N: [.75, .9, .8, .5], NE: [.45, .4, .2, .1], E: [.2, .15, .1, .05], SE: [.35, .25, .1, .05], S: [.55, .6, .55, .45], SW: [.1, .25, .4, .6], W: [.05, .1, .15, .2], NW: [.15, .35, .5, .55] },
      full:    { N: [.55, .85, 1, .6], NE: [.95, 1, .7, .3], E: [.5, .35, .15, .05], SE: [.45, .3, .15, .05], S: [.3, .35, .35, .3], SW: [.1, .3, .6, .9], W: [.1, .2, .45, .7], NW: [.2, .5, .9, 1] },
      good:    { N: [.35, .7, .85, .45], NE: [.8, .85, .5, .2], E: [.75, .55, .25, .1], SE: [.6, .45, .2, .05], S: [.15, .15, .15, .15], SW: [.1, .25, .55, .85], W: [.15, .3, .55, .75], NW: [.15, .4, .65, .7] },
      short:   { N: [.2, .35, .4, .2], NE: [.5, .45, .2, .1], E: [1, .9, .5, .2], SE: [.9, .75, .35, .1], S: [.3, .35, .35, .3], SW: [.1, .3, .55, .8], W: [.3, .65, 1, 1], NW: [.15, .4, .7, .75] },
      bouncer: { N: [.05, .1, .1, .05], NE: [.15, .15, .1, .05], E: [.75, .7, .45, .2], SE: [.85, .8, .6, .3], S: [.5, .6, .7, .6], SW: [.15, .45, .75, .85], W: [.3, .6, .9, .9], NW: [.1, .25, .4, .4] },
      fulltoss:{ N: [.7, .95, 1, .8], NE: [.95, 1, .85, .55], E: [.7, .6, .4, .2], SE: [.5, .4, .25, .1], S: [.6, .6, .6, .6], SW: [.3, .5, .75, .95], W: [.4, .6, .85, 1], NW: [.5, .8, 1, 1] }
    };
    return T[length][dir][LINES.indexOf(line)];
  }

  /* ---------- difficulty ---------- */
  const LEVELS = {
    easy:   { name: 'Easy',   perfect: 70, good: 125, ok: 190, edge: 260, flight: 1.05, bowlerSkill: 0.75 },
    pro:    { name: 'Pro',    perfect: 50, good: 95,  ok: 150, edge: 215, flight: 0.85, bowlerSkill: 0.85 },
    legend: { name: 'Legend', perfect: 35, good: 70,  ok: 112, edge: 170, flight: 0.68, bowlerSkill: 0.95 }
  };

  /** timing error (ms, + = late) -> quality 0..1 and a label */
  function timing(errMs, lvl, bonus) {
    if (errMs === null || errMs === undefined) return { q: 0, label: 'Left alone', grade: 'none' };
    const w = 1 + (bonus || 0), e = Math.abs(errMs);
    if (e <= lvl.perfect * w) return { q: 1, label: 'Perfect timing!', grade: 'perfect' };
    if (e <= lvl.good * w) return { q: 0.78, label: errMs < 0 ? 'Slightly early' : 'Slightly late', grade: 'good' };
    if (e <= lvl.ok * w) return { q: 0.5, label: errMs < 0 ? 'Early' : 'Late', grade: 'ok' };
    if (e <= lvl.edge * w) return { q: 0.18, label: errMs < 0 ? 'Way too early' : 'Edged!', grade: 'edge' };
    return { q: 0, label: errMs < 0 ? 'Far too early' : 'Missed it', grade: 'miss' };
  }

  /* ---------- random ---------- */
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function weighted(r, obj) { let t = 0; for (const k in obj) t += obj[k]; let x = r() * t; for (const k in obj) { x -= obj[k]; if (x <= 0) return k; } return Object.keys(obj)[0]; }

  /* ---------- bowlers ---------- */
  const BOWLERS = [
    { name: 'Rocket Rao', type: 'fast', speed: [138, 152], lengths: { yorker: 3, full: 3, good: 5, short: 3, bouncer: 2, fulltoss: .6 } },
    { name: 'Swing King Sam', type: 'swing', speed: [128, 140], lengths: { yorker: 2, full: 5, good: 5, short: 2, bouncer: 1, fulltoss: .6 } },
    { name: 'Thunder Tom', type: 'fast', speed: [142, 156], lengths: { yorker: 3, full: 2, good: 4, short: 4, bouncer: 3, fulltoss: .5 } },
    { name: 'Mystery Mani', type: 'spin', speed: [82, 96], lengths: { yorker: 1, full: 4, good: 6, short: 2, bouncer: 0, fulltoss: .8 } },
    { name: 'Googly Gopal', type: 'spin', speed: [78, 92], lengths: { yorker: .5, full: 4, good: 6, short: 2.5, bouncer: 0, fulltoss: 1 } }
  ];

  function makeDelivery(r, bowler, lvl) {
    const length = weighted(r, bowler.lengths);
    let line = weighted(r, { wide: 1.2 * (1.2 - lvl.bowlerSkill), off: 4, middle: 3, leg: 2 });
    if (length === 'yorker' && line === 'wide') line = 'off';
    const speed = Math.round(bowler.speed[0] + r() * (bowler.speed[1] - bowler.speed[0]));
    // swing/turn: sideways movement after bouncing (metres)
    const move = bowler.type === 'spin' ? (r() < .5 ? -1 : 1) * (0.12 + r() * 0.25) : bowler.type === 'swing' ? (r() < .5 ? -1 : 1) * (0.08 + r() * 0.16) : (r() - .5) * 0.08;
    const extra = r() < 0.035 ? 'noball' : (line === 'wide' && r() < 0.28 ? 'wide' : null);
    const geo = LENGTH_GEO[length];
    const x = LINE_X[line] + (r() - .5) * 0.1;
    const finalX = x + move;
    // does it hit the stumps if left? (stumps are +-0.12 m)
    const hitsStumps = Math.abs(finalX) < 0.15 && geo.arriveY < 0.78 && length !== 'bouncer';
    // spinners are slower in real time; game time is scaled so everything is playable
    const flight = lvl.flight * (bowler.type === 'spin' ? 1.25 : 1) * (145 / Math.max(80, speed)) ** 0.35;
    return { bowler: bowler.name, type: bowler.type, length, line, speed, move, extra, x, finalX, hitsStumps, flight,
      bounceZ: geo.bounceZ, arriveY: geo.arriveY, desc: `${LENGTH_NAME[length]}, ${LINE_NAME[line]}` };
  }

  /* ---------- fielders: 9 on the field (+ keeper & bowler), changed every over ---------- */
  function makeField(r, bowlerType, aggressive) {
    const f = [];
    const inner = bowlerType === 'spin' ? [20, 70, 110, 250, 290, 335] : [25, 60, 100, 130, 240, 300];   // ring fielders
    const deepOptions = [0, 35, 75, 115, 150, 200, 235, 270, 310, 340];
    inner.forEach(a => f.push({ angle: (a + (r() - .5) * 16 + 360) % 360, dist: 0.42 + r() * 0.06, deep: false }));
    const deepCount = aggressive ? 3 : 4;
    const pool = deepOptions.slice();
    for (let i = 0; i < deepCount; i++) { const k = Math.floor(r() * pool.length); f.push({ angle: (pool.splice(k, 1)[0] + (r() - .5) * 14 + 360) % 360, dist: 0.9, deep: true }); }
    if (f.length > 9) f.length = 9;
    return f;
  }
  const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  function nearest(field, angle, deep) {
    let best = null;
    field.forEach(p => { if (p.deep === deep) { const d = angDiff(p.angle, angle); if (!best || d < best.d) best = { d, p }; } });
    return best;
  }

  /* ---------- one ball ----------
     input: { dir, loft, errMs (null = no shot), power (bool), fire (0..), freeHit (bool) }
     returns { runs, out, how, boundary, angle, dist (0..1.2 of boundary), metres, airborne, text, grade, quality } */
  function resolve(del, input, field, lvl, r) {
    const freeHit = !!input.freeHit;
    const t = timing(input.errMs, lvl, (input.fire ? 0.15 : 0) + (input.power ? 0.2 : 0));
    const dir = input.dir || 'N';
    const fit = shotFit(dir, del.line, del.length);
    const shot = SHOTS[dir];
    let angle = (shot.angle + (r() - .5) * 18 + (t.grade === 'good' || t.grade === 'ok' ? (input.errMs < 0 ? -12 : 12) : 0) + 360) % 360;
    const res = { runs: 0, out: false, how: '', boundary: 0, angle, dist: 0, metres: 0, airborne: !!input.loft, grade: t.grade, timing: t.label, fit, quality: 0, shot: shot.name };
    const out = (how) => { if (freeHit && how !== 'run out') { res.how = how + ' (free hit, not out)'; return res; } res.out = true; res.how = how; return res; };

    if (del.extra === 'wide') { res.runs = 1; res.extra = 'wide'; return res; }

    // ---------- no shot or a complete miss ----------
    if (t.grade === 'none' || t.grade === 'miss') {
      res.dist = 0;
      if (del.hitsStumps) return out(del.line === 'leg' ? 'lbw' : 'bowled');
      if (del.line === 'middle' && (del.length === 'good' || del.length === 'full') && r() < 0.3) return out('lbw');
      res.how = 'beaten'; return res;
    }
    // block: safe, sometimes a single
    if (dir === 'C') {
      const q = t.q * fit;
      if (t.grade === 'edge') { if (r() < 0.25) return out('caught behind'); res.how = 'inside edge'; return res; }
      if (q > 0.6 && r() < 0.3) { res.runs = 1; res.dist = 0.35; res.how = 'nudged for one'; return res; }
      res.how = 'defended'; res.dist = 0.12; return res;
    }
    // edges
    if (t.grade === 'edge') {
      const x = r();
      if (x < 0.32 + (input.loft ? 0.12 : 0)) return out(r() < 0.65 ? 'caught behind' : 'caught at slip');
      if (del.hitsStumps && x < 0.45) return out('played on');
      res.angle = 150 + r() * 30; res.dist = 0.5 + r() * 0.5;
      res.runs = x > 0.85 ? 4 : (x > 0.6 ? 2 : 1); res.boundary = res.runs === 4 ? 4 : 0;
      res.how = res.runs === 4 ? 'thick edge, flies for four' : 'edged, runs taken'; return res;
    }

    const perfect = t.grade === 'perfect';
    let q = t.q * (0.35 + 0.65 * fit) + (input.power ? 0.1 : 0);
    q = Math.max(0, Math.min(1.15, q + (r() - .5) * 0.16));
    if (perfect) q = Math.max(q, 0.8 + 0.2 * fit);        // a perfectly timed shot is always well struck
    res.quality = q;

    // a badly chosen shot can still beat the bat
    if (!perfect && fit < 0.25 && r() < (0.45 - fit)) {
      if (del.hitsStumps) return out('bowled');
      if (r() < 0.4) return out('caught behind');
      res.how = 'played and missed'; return res;
    }

    // ---------- fielders are physical: a ball that passes within a fielder's reach is stopped ----------
    const ROPE_M = 64, rad = Math.PI / 180;
    const lateral = (f, a) => Math.abs(Math.sin(Math.min(90, angDiff(f.angle, a)) * rad)) * f.dist * ROPE_M;
    const reach = (f, air) => air ? (f.deep ? 4.5 - 2.5 * q : 2.2) : (f.deep ? 2.5 + 6 * Math.max(0, 1 - q) : 1.1 + 1.9 * Math.max(0.2, 1 - 0.6 * q));
    const blockers = (a, air, maxD) => field.filter(f => angDiff(f.angle, a) < 70 && f.dist <= maxD + 0.02 && lateral(f, a) < reach(f, air)).sort((x, y) => x.dist - y.dist);
    if (perfect) {   // perfect timing finds the gap: the ball is placed where nobody can reach it (within a few degrees of your aim)
      for (const off of [0, 4, -4, 8, -8, 12, -12, 16, -16]) { const a = (res.angle + off + 360) % 360;
        if (!blockers(a, !!input.loft, 1.2).length) { res.angle = a; break; } }
    }

    if (!input.loft) {
      // ---------- along the ground ----------
      res.dist = Math.min(1.05, 0.25 + q * 0.85);
      if (q < 0.25) { res.runs = r() < 0.5 ? 1 : 0; res.dist = 0.3; res.how = 'mistimed'; return res; }
      const b = blockers(res.angle, false, res.dist >= 1 ? 1.2 : res.dist)[0];
      if (b && !b.deep) { const dive = lateral(b, res.angle) > 1.2; res.dist = b.dist; res.fielder = b; res.runs = !dive && q > 0.6 && r() < 0.35 ? 1 : 0;
        res.how = dive ? 'superb diving stop!' : res.runs ? 'quick single' : 'straight to the fielder'; return res; }
      if (b && b.deep) { res.dist = b.dist; res.fielder = b; res.runs = q > 0.55 ? 2 : 1; res.how = 'cut off in the deep'; return res; }
      if (q > 0.72) { res.runs = 4; res.boundary = 4; res.dist = 1.02; res.how = 'races to the rope'; return res; }
      res.runs = q > 0.45 ? 3 : 2; res.dist = 0.85; res.how = 'into the gap'; return res;
    }

    // ---------- in the air ----------
    const sixNeed = (dir === 'S' ? 0.93 : 0.88) - (input.power ? 0.07 : 0);
    res.metres = Math.round(45 + q * 55 + (input.power ? 6 : 0) + r() * 6);
    const deep = nearest(field, res.angle, true), ring = nearest(field, res.angle, false);
    if (perfect) {     // perfect timing in the air is never caught: six if it carries, otherwise one bounce for four
      if (q >= sixNeed - 0.06) { res.runs = 6; res.boundary = 6; res.dist = 1.1 + Math.min(0.25, Math.max(0, q - sixNeed + 0.06)); res.how = 'into the stands'; return res; }
      res.runs = 4; res.boundary = 4; res.dist = 1.02; res.how = 'one bounce over the rope'; return res;
    }
    if (q >= sixNeed) {
      if (deep && deep.d < 10 && q < sixNeed + 0.1) {   // just reaches the fielder
        res.dist = 0.95; if (r() < 0.5) return out('caught on the boundary');
        res.runs = 1; res.how = 'dropped on the boundary!'; return res;
      }
      res.runs = 6; res.boundary = 6; res.dist = 1.1 + Math.min(0.25, (q - sixNeed)); res.how = 'into the stands'; return res;
    }
    if (q > 0.5) {
      res.dist = 0.82 + (q - 0.5) * 0.4;
      if (deep && deep.d < 18) { if (r() < (t.grade === 'good' ? 0.4 : 0.62)) return out('caught in the deep'); res.runs = 2; res.how = 'put down in the deep!'; return res; }
      if (q < 0.68) { res.runs = 2; res.dist = 0.9; res.how = 'falls short of the rope, two runs'; return res; }
      res.runs = 4; res.boundary = 4; res.dist = 1.02; res.how = 'one bounce over the rope'; return res;
    }
    if (q > 0.25) {
      res.dist = 0.45 + q * 0.4;
      if (ring && ring.d < 18) { if (r() < 0.7) return out('caught'); res.runs = 1; res.how = 'dropped!'; return res; }
      res.runs = r() < 0.5 ? 2 : 1; res.how = 'lands safely'; return res;
    }
    res.dist = 0.3; res.how = 'skied it';
    if (r() < 0.65) return out('caught, skied it');
    res.runs = 1; return res;
  }

  /* ---------- commentary ---------- */
  const SAY = {
    6: ['That is massive! Into the stands!', 'Six! What a hit!', 'Gone all the way! Maximum!', 'Out of the ground, that one!', 'Huge! Somebody fetch that ball!'],
    4: ['Four! Beautifully timed.', 'Races away to the boundary!', 'Pierced the gap! Four runs.', 'Cracking shot, that is four.', 'No stopping that one!'],
    out: ['Gone! Big wicket!', 'Out! The bowler is pumped!', 'That is the end of that!', 'Caught! Silence in the crowd.', 'Timber! Stumps everywhere!'],
    dot: ['Good ball, no run.', 'Beaten! Lovely delivery.', 'Defended solidly.', 'Dot ball, pressure building.'],
    run: ['They pick up a single.', 'Pushed away for runs.', 'Good running between the wickets.', 'Worked into the gap.'],
    win: ['And that wins the match! Incredible finish!', 'Victory! What a chase!'],
    lose: ['That is the end, the target was too much.', 'So close, but not today.']
  };

  const API = { SHOTS, LINES, LENGTHS, LENGTH_NAME, LINE_NAME, LEVELS, BOWLERS, SAY, shotFit, timing, rng, pick, weighted, makeDelivery, makeField, resolve, angDiff };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.Eng = API;
})(typeof window !== 'undefined' ? window : globalThis);
