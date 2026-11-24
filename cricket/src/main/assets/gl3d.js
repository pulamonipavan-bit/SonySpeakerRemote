/* Boundary Blast — tiny WebGL renderer (no third-party code).
   Column-major matrices, one lit shader with hemisphere + sun + specular + fog,
   optional texture, vertex colours, alpha and additive glow. */
(function () {
  'use strict';
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    madd: (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s]
  };
  const M = {
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    lookAt(e, c, up) {
      const z = V.norm(V.sub(e, c)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, e), -V.dot(y, e), -V.dot(z, e), 1]);
    },
    /** model matrix from three (scaled) axis vectors and an origin */
    basis(X, Y, Z, o) { return new Float32Array([X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, o[0], o[1], o[2], 1]); },
    normal3(m) { // inverse-transpose of upper 3x3
      const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
      const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
      const det = a * A + b * B + c * C || 1e-9, k = 1 / det;
      return new Float32Array([A * k, B * k, C * k, -(b * i - c * h) * k, (a * i - c * g) * k, -(a * h - b * g) * k, (b * f - c * e) * k, -(a * f - c * d) * k, (a * e - b * d) * k]);
    }
  };

  const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec2 aT; attribute vec3 aC;
uniform mat4 uVP, uM; uniform mat3 uN; uniform vec2 uUV;
varying vec3 vN; varying vec3 vW; varying vec2 vT; varying vec3 vC;
void main(){ vec4 w = uM * vec4(aP,1.0); vW = w.xyz; vN = uN * aN; vT = aT * uUV; vC = aC; gl_Position = uVP * w; }`;
  const SVS = `
attribute vec3 aP0; attribute vec3 aP1; attribute vec3 aN0; attribute vec3 aN1; attribute vec2 aT; attribute vec3 aBW;
uniform mat4 uVP; uniform mat4 uB[15]; uniform vec2 uUV;
varying vec3 vN; varying vec3 vW; varying vec2 vT; varying vec3 vC;
void main(){
  int b0 = int(aBW.x + 0.5); int b1 = int(aBW.y + 0.5); float w = aBW.z;
  vec4 p = (uB[b0] * vec4(aP0, 1.0)) * (1.0 - w) + (uB[b1] * vec4(aP1, 1.0)) * w;
  vec3 n = (uB[b0] * vec4(aN0, 0.0)).xyz * (1.0 - w) + (uB[b1] * vec4(aN1, 0.0)).xyz * w;
  vW = p.xyz; vN = n; vT = aT * uUV; vC = vec3(1.0); gl_Position = uVP * vec4(p.xyz, 1.0);
}`;
  const FS = `
precision mediump float;
varying vec3 vN; varying vec3 vW; varying vec2 vT; varying vec3 vC;
uniform vec3 uCol, uSky, uGnd, uSun, uL, uEye, uFog;
uniform float uEm, uA, uTex, uSpec, uFogD, uRim;
uniform sampler2D uS;
void main(){
  vec3 n = normalize(vN); if(dot(n, uEye - vW) < 0.0) n = -n;
  vec3 base = uCol * vC; vec4 tx = vec4(1.0);
  if(uTex > 0.5){ tx = texture2D(uS, vT); base *= tx.rgb; }
  vec3 hemi = mix(uGnd, uSky, n.y*0.5+0.5);
  float d = max(dot(n, uL), 0.0);
  vec3 v = normalize(uEye - vW); vec3 h = normalize(uL + v);
  float s = pow(max(dot(n,h),0.0), 40.0) * uSpec;
  vec3 col = base*(hemi + uSun*d) + uSun*s;
  col += uRim * pow(1.0 - max(dot(n, v), 0.0), 2.5) * vec3(0.80, 0.86, 1.0);
  col = mix(col, base, uEm);
  float f = 1.0 - exp(-length(uEye - vW) * uFogD);
  col = mix(col, uFog, clamp(f,0.0,1.0)*(1.0-uEm*0.6));
  gl_FragColor = vec4(col, uA * tx.a);
}`;

  function create(canvas, opts) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: !!(opts && opts.alpha), premultipliedAlpha: false, preserveDrawingBuffer: false })
      || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const UN = ['uVP', 'uM', 'uN', 'uUV', 'uCol', 'uSky', 'uGnd', 'uSun', 'uL', 'uEye', 'uFog', 'uEm', 'uA', 'uTex', 'uSpec', 'uFogD', 'uS', 'uRim', 'uB'];
    function mk(vs, attrs) {
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
      gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const U = {}; UN.forEach(n => U[n] = gl.getUniformLocation(p, n)); gl.useProgram(p); gl.uniform1i(U.uS, 0);
      return { p, U, nAttr: attrs.length };
    }
    const PM = mk(VS, ['aP', 'aN', 'aT', 'aC']), PS = mk(SVS, ['aP0', 'aP1', 'aN0', 'aN1', 'aT', 'aBW']);
    let cur = null, U = PM.U;
    function use(P) {
      if (cur === P) return; cur = P; gl.useProgram(P.p); U = P.U;
      for (let i = 0; i < 6; i++) { if (i < P.nAttr) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i); }
    }
    use(PM);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);

    /* ---------- meshes ---------- */
    function upload(pos, nrm, uv, col, idx) {
      const n = pos.length / 3, data = new Float32Array(n * 11);
      for (let i = 0; i < n; i++) {
        data.set([pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2], uv[i * 2], uv[i * 2 + 1],
          col ? col[i * 3] : 1, col ? col[i * 3 + 1] : 1, col ? col[i * 3 + 2] : 1], i * 11);
      }
      const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const big = n > 65535, ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      if (big && !gl.getExtension('OES_element_index_uint')) throw new Error('mesh too big');
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW);
      return { vb, ib, count: idx.length, type: big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT };
    }
    const G = {
      box() {
        const P = [], N = [], T = [], I = [];
        const faces = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
        faces.forEach(([n, u, w]) => {
          const b = P.length / 3;
          [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => {
            P.push(n[0] * .5 + u[0] * c * .5 + w[0] * a * .5, n[1] * .5 + u[1] * c * .5 + w[1] * a * .5, n[2] * .5 + u[2] * c * .5 + w[2] * a * .5);
            N.push(...n); T.push(a * .5 + .5, c * .5 + .5);
          });
          I.push(b, b + 1, b + 2, b, b + 2, b + 3);
        });
        return upload(P, N, T, null, I);
      },
      sphere(seg = 18, rings = 12) {
        const P = [], N = [], T = [], I = [];
        for (let r = 0; r <= rings; r++) { const ph = r / rings * Math.PI; for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2; const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th); P.push(x, y, z); N.push(x, y, z); T.push(s / seg, r / rings); } }
        for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
        return upload(P, N, T, null, I);
      },
      /** unit cylinder: radius 1, y from 0 to 1, capped */
      cyl(seg = 14) {
        const P = [], N = [], T = [], I = [];
        for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2, x = Math.cos(th), z = Math.sin(th); P.push(x, 0, z, x, 1, z); N.push(x, 0, z, x, 0, z); T.push(s / seg, 0, s / seg, 1); }
        for (let s = 0; s < seg; s++) { const a = s * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        [0, 1].forEach(y => { const c = P.length / 3; P.push(0, y, 0); N.push(0, y ? 1 : -1, 0); T.push(.5, .5);
          for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2; P.push(Math.cos(th), y, Math.sin(th)); N.push(0, y ? 1 : -1, 0); T.push(.5, .5); }
          for (let s = 0; s < seg; s++) I.push(c, c + 1 + s, c + 2 + s); });
        return upload(P, N, T, null, I);
      },
      /** flat disc in XZ, radius 1; uv maps x,z in [-1,1] to [0,1] */
      disc(seg = 96) {
        const P = [0, 0, 0], N = [0, 1, 0], T = [.5, .5], I = [];
        for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2, x = Math.cos(th), z = Math.sin(th); P.push(x, 0, z); N.push(0, 1, 0); T.push(x * .5 + .5, z * .5 + .5); }
        for (let s = 0; s < seg; s++) I.push(0, s + 1, s + 2);
        return upload(P, N, T, null, I);
      },
      /** surface of revolution between (r0,y0) and (r1,y1); u around, v up; normals point inwards/upwards */
      band(r0, y0, r1, y1, seg = 120, a0 = 0, a1 = Math.PI * 2) {
        const P = [], N = [], T = [], I = [];
        const dr = r1 - r0, dy = y1 - y0, nl = Math.hypot(dr, dy) || 1;
        for (let s = 0; s <= seg; s++) {
          const th = a0 + (a1 - a0) * s / seg, c = Math.cos(th), sn = Math.sin(th);
          P.push(r0 * c, y0, r0 * sn, r1 * c, y1, r1 * sn);
          const nx = -dy / nl, ny = dr / nl; // outward-ish normal rotated: points inward+up for rising bands
          N.push(-c * Math.abs(nx), Math.abs(ny), -sn * Math.abs(nx), -c * Math.abs(nx), Math.abs(ny), -sn * Math.abs(nx));
          T.push(s / seg, 0, s / seg, 1);
        }
        for (let s = 0; s < seg; s++) { const a = s * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        return upload(P, N, T, null, I);
      },
      /** big sky dome with a vertical colour gradient */
      dome(top, mid, low) {
        const P = [], N = [], T = [], C = [], I = [], seg = 32, rings = 16;
        for (let r = 0; r <= rings; r++) { const ph = r / rings * Math.PI * 0.6; for (let s = 0; s <= seg; s++) { const th = s / seg * Math.PI * 2; const x = Math.sin(ph) * Math.cos(th), y = Math.cos(ph), z = Math.sin(ph) * Math.sin(th); P.push(x, y - 0.12, z); N.push(0, 1, 0); T.push(0, 0);
          const k = r / rings, c = k < .6 ? V.lerp(top, mid, k / .6) : V.lerp(mid, low, (k - .6) / .4); C.push(...c); } }
        for (let r = 0; r < rings; r++) for (let s = 0; s < seg; s++) { const a = r * (seg + 1) + s, b = a + seg + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
        return upload(P, N, T, C, I);
      },
      quad() { return upload([-.5, -.5, 0, .5, -.5, 0, .5, .5, 0, -.5, .5, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 0, 1, 0, 1, 1, 0, 1], null, [0, 1, 2, 0, 2, 3]); },
      /** flat XZ plane centred, size 1 */
      plane() { return upload([-.5, 0, -.5, .5, 0, -.5, .5, 0, .5, -.5, 0, .5], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 0, 1, 0, 1, 1, 0, 1], null, [0, 1, 2, 0, 2, 3]); }
    };

    function texture(canvasOrImg, repeat) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasOrImg);
      const pot = v => (v & (v - 1)) === 0, ok = pot(canvasOrImg.width) && pot(canvasOrImg.height);
      if (ok) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      const w = ok && repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
      const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an && ok) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      return t;
    }

    const R = {
      gl, V, M, G, texture,
      uploadRaw(data, idx) { const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW); return { vb, ib, count: idx.length, type: gl.UNSIGNED_SHORT }; },
      meshes: { box: G.box(), sphere: G.sphere(), lowSphere: G.sphere(10, 7), cyl: G.cyl(), disc: G.disc(), quad: G.quad(), plane: G.plane() },
      VP: null, eye: [0, 0, 0], camRight: [1, 0, 0], camUp: [0, 1, 0], W: 1, H: 1, drawCalls: 0,
      env: { sky: [0.52, 0.56, 0.66], gnd: [0.26, 0.30, 0.26], sun: [0.92, 0.90, 0.84], L: V.norm([0.3, 0.85, -0.45]), fog: [0.06, 0.09, 0.17], fogD: 0.0022 },
      resize(w, h, dpr) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); R.W = w; R.H = h; gl.viewport(0, 0, canvas.width, canvas.height); },
      begin(cam) {
        const asp = R.W / R.H;
        const view = M.lookAt(cam.eye, cam.target, [0, 1, 0]);
        R.VP = M.mul(M.persp(cam.fov * Math.PI / 180, asp, cam.near || 0.3, cam.far || 900), view);
        R.eye = cam.eye; R.camRight = [view[0], view[4], view[8]]; R.camUp = [view[1], view[5], view[9]];
        gl.clearColor(R.env.fog[0], R.env.fog[1], R.env.fog[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        [PS, PM].forEach(P => { use(P);
          gl.uniformMatrix4fv(U.uVP, false, R.VP);
          gl.uniform3fv(U.uSky, R.env.sky); gl.uniform3fv(U.uGnd, R.env.gnd); gl.uniform3fv(U.uSun, R.env.sun); gl.uniform3fv(U.uL, R.env.L);
          gl.uniform3fv(U.uEye, cam.eye); gl.uniform3fv(U.uFog, R.env.fog); gl.uniform1f(U.uFogD, R.env.fogD); });
        gl.disable(gl.BLEND); gl.depthMask(true); R.drawCalls = 0;
      },
      /** mat: {c:[r,g,b], tex, em, a, spec, uv:[su,sv], add:true (additive), noDepth} */
      draw(mesh, m, mat) {
        use(PM);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 44, 24); gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 44, 32);
        gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix3fv(U.uN, false, M.normal3(m));
        R.finish(mesh, mat);
      },
      /** skinned mesh: bones = Float32Array(15*16) world matrices */
      drawSkin(mesh, bones, mat) {
        use(PS);
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ib);
        const st = 68; [3, 3, 3, 3, 2, 3].reduce((off, n, i) => { gl.vertexAttribPointer(i, n, gl.FLOAT, false, st, off); return off + n * 4; }, 0);
        gl.uniformMatrix4fv(U.uB, false, bones);
        R.finish(mesh, mat);
      },
      finish(mesh, mat) {
        gl.uniform3fv(U.uCol, mat.c || [1, 1, 1]); gl.uniform1f(U.uRim, mat.rim || 0); gl.uniform1f(U.uEm, mat.em || 0); gl.uniform1f(U.uSpec, mat.spec || 0);
        const a = mat.a === undefined ? 1 : mat.a; gl.uniform1f(U.uA, a); gl.uniform2fv(U.uUV, mat.uv || [1, 1]);
        if (mat.tex){ gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex); gl.uniform1f(U.uTex, 1); } else gl.uniform1f(U.uTex, 0);
        const blend = a < 1 || mat.add || mat.blend;
        if (blend){ gl.enable(gl.BLEND); if (mat.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
        if (mat.noDepth) gl.disable(gl.DEPTH_TEST);
        gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type, 0); R.drawCalls++;
        if (blend){ gl.disable(gl.BLEND); gl.depthMask(true); }
        if (mat.noDepth) gl.enable(gl.DEPTH_TEST);
      },
      /** capsule-ish limb: cylinder from a to b, radius r (and r2 at b), sphere at b */
      seg(a, b, r, mat, r2, capA) {
        const d = V.sub(b, a), L = V.len(d); if (L < 1e-5) return;
        const y = V.mul(d, 1 / L); let x = Math.abs(y[1]) < 0.95 ? V.norm(V.cross(y, [0, 1, 0])) : V.norm(V.cross(y, [1, 0, 0])); const z = V.cross(x, y);
        const rr = r2 === undefined ? r : (r + r2) / 2;
        R.draw(R.meshes.cyl, M.basis(V.mul(x, rr), d, V.mul(z, rr), a), mat);
        R.ball(b, r2 === undefined ? r : r2, mat);
        if (capA) R.ball(a, r, mat);
      },
      ball(p, r, mat, ry, rz) { R.draw(R.meshes.sphere, M.basis([r, 0, 0], [0, ry || r, 0], [0, 0, rz || r], p), mat); },
      /** oriented box: centre c, axes X (width dir), Y (up dir), sizes sx,sy,sz */
      obox(c, X, Y, sx, sy, sz, mat) { const x = V.norm(X), y = V.norm(Y), z = V.cross(x, y); R.draw(R.meshes.box, M.basis(V.mul(x, sx), V.mul(y, sy), V.mul(z, sz), c), mat); },
      box(c, sx, sy, sz, mat, yaw) { const cs = Math.cos(yaw || 0), sn = Math.sin(yaw || 0); R.draw(R.meshes.box, M.basis([sx * cs, 0, -sx * sn], [0, sy, 0], [sz * sn, 0, sz * cs], c), mat); },
      /** camera-facing sprite */
      sprite(p, size, mat) { R.draw(R.meshes.quad, M.basis(V.mul(R.camRight, size), V.mul(R.camUp, size), V.cross(R.camRight, R.camUp), p), mat); },
      /** flat shadow blob on the ground */
      blob(x, z, rx, rz, a, yaw) { const cs = Math.cos(yaw || 0), sn = Math.sin(yaw || 0);
        R.draw(R.meshes.disc, M.basis([rx * cs, 0, -rx * sn], [0, 1, 0], [rz * sn, 0, rz * cs], [x, 0.012, z]), { c: [0, 0, 0], a: a === undefined ? 0.35 : a, em: 1, tex: R.blobTex }); },
      project(p) { const m = R.VP, x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
        if (w <= 0) return null; return { x: (x / w * .5 + .5) * R.W, y: (1 - (y / w * .5 + .5)) * R.H, s: R.H / w }; }
    };
    // soft radial texture for shadows and glows
    const bc = document.createElement('canvas'); bc.width = bc.height = 64; const bg = bc.getContext('2d');
    const rg = bg.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.5, 'rgba(255,255,255,.6)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    bg.fillStyle = rg; bg.fillRect(0, 0, 64, 64); R.blobTex = texture(bc, false);
    return R;
  }
  window.GL3D = { create, V, M };
})();
