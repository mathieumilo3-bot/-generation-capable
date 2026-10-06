/* gl.js — rendu 3D temps réel du chrome liquide (raymarching de champs de distance).
 * Passes : scène HDR → bloom (chaîne de flous) → traînée anamorphique → composite
 * (tonemapping ACES, aberration chromatique, vignettage, grain).
 */
(() => {
  const VS = `#version 300 es
  in vec2 aPos; out vec2 vUv;
  void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const COMMON = `#version 300 es
  precision highp float;
  in vec2 vUv; out vec4 outColor;
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  `;

  const SCENE = COMMON + `
  uniform vec2 uRes; uniform vec2 uJitter; uniform float uTime;
  uniform vec3 uCamPos, uCamTgt; uniform float uFov, uRoll;
  uniform vec4 uBalls[6];
  uniform float uK, uTorus, uBottle, uWobble, uShockR, uShockA, uIri, uSweep, uFloor, uSpin, uTilt, uEnvRot, uBound, uGlow;
  const float FLOOR_Y = -0.97;

  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
  float sdRoundBox(vec3 p, vec3 b, float r){ vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
  float sdCyl(vec3 p, float h, float r){ vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
  float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }

  float sdBottle(vec3 p){
    // flacon : corps à arêtes adoucies, épaule, col et bouchon sphérique
    vec3 q = p - vec3(0.0, -0.36, 0.0);
    float taper = 1.0 - 0.06 * clamp(q.y + 0.6, 0.0, 1.2);
    q.x /= taper;
    float body = sdRoundBox(q, vec3(0.56, 0.61, 0.29), 0.17) * taper;
    float neck = sdCyl(p - vec3(0.0, 0.33, 0.0), 0.1, 0.11);
    float ring = sdTorus(p - vec3(0.0, 0.27, 0.0), vec2(0.13, 0.025));
    float cap  = length((p - vec3(0.0, 0.64, 0.0)) * vec3(1.0, 1.05, 1.0)) - 0.27;
    float d = smin(body, neck, 0.06);
    d = smin(d, ring, 0.02);
    d = smin(d, cap, 0.025);
    return d;
  }

  float sdBlobs(vec3 p){
    float d = 1e5;
    for (int i = 0; i < 6; i++) {
      vec4 b = uBalls[i];
      if (b.w <= 0.0) continue;
      d = smin(d, length(p - b.xyz) - b.w, uK);
    }
    return d;
  }

  vec3 objSpace(vec3 p){ p.xz *= rot(uSpin); p.yz *= rot(uTilt); return p; }

  float map(vec3 p){
    vec3 q = objSpace(p);
    float d;
    if (uBottle > 0.999) {
      d = sdBottle(q);
    } else {
      d = sdBlobs(q);
      if (uTorus > 0.001) { vec3 tq = q; tq.yz *= rot(1.15); tq.xy *= rot(0.35); d = mix(d, sdTorus(tq, vec2(0.74, 0.25)), uTorus); }
      if (uBottle > 0.001) d = mix(d, sdBottle(q), uBottle);
    }
    if (uWobble > 0.0) {
      float w = sin(q.x * 4.3 + uTime * 2.1) * sin(q.y * 3.7 - uTime * 1.6) * sin(q.z * 4.1 + uTime * 1.3);
      w += 0.45 * sin(q.x * 9.1 - uTime * 3.3) * sin(q.y * 8.3 + uTime * 2.7) * sin(q.z * 7.7 - uTime * 2.2);
      d += uWobble * w;
    }
    if (uShockA > 0.0) {
      float r = length(q);
      d += uShockA * exp(-pow((r - uShockR) * 4.0, 2.0)) * sin((r - uShockR) * 14.0);
    }
    return d;
  }

  vec3 calcNormal(vec3 p){
    const vec2 k = vec2(1.0, -1.0);
    const float h = 0.0012;
    return normalize(k.xyy * map(p + k.xyy * h) + k.yyx * map(p + k.yyx * h) + k.yxy * map(p + k.yxy * h) + k.xxx * map(p + k.xxx * h));
  }

  float calcAO(vec3 p, vec3 n){
    float occ = 0.0, sca = 1.0;
    for (int i = 0; i < 4; i++) {
      float h = 0.03 + 0.15 * float(i) / 3.0;
      occ += (h - map(p + h * n)) * sca;
      sca *= 0.85;
    }
    return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
  }

  vec2 sphIntersect(vec3 ro, vec3 rd, float r){
    float b = dot(ro, rd);
    float c = dot(ro, ro) - r * r;
    float h = b * b - c;
    if (h < 0.0) return vec2(-1.0);
    h = sqrt(h);
    return vec2(-b - h, -b + h);
  }

  float march(vec3 ro, vec3 rd){
    vec2 bs = sphIntersect(ro, rd, uBound);
    if (bs.y < 0.0) return -1.0;
    float t = max(bs.x, 0.0);
    for (int i = 0; i < 100; i++) {
      float d = map(ro + rd * t);
      if (d < 0.0007 * t) return t;
      t += d * 0.72;
      if (t > bs.y) break;
    }
    return -1.0;
  }

  float box2(vec2 p, vec2 b, float soft){
    vec2 d = abs(p) - b;
    float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    return 1.0 - smoothstep(-soft, soft, sd);
  }
  float softbox(vec3 rd, vec3 dir, vec3 up, vec2 size, float soft){
    float c = dot(rd, dir);
    if (c <= 0.0) return 0.0;
    vec3 r = normalize(cross(up, dir));
    vec3 u = cross(dir, r);
    vec2 p = vec2(dot(rd, r), dot(rd, u)) / c;
    return box2(p, size, soft);
  }

  vec3 env(vec3 rd){
    rd.xz *= rot(uEnvRot);
    // studio sombre : dégradé d'horizon doux + quelques boîtes à lumière nettes
    vec3 col = mix(vec3(0.0015, 0.002, 0.003), vec3(0.05, 0.055, 0.068), smoothstep(-0.15, 0.95, rd.y));
    col += vec3(0.02, 0.022, 0.03) * exp(-abs(rd.y) * 9.0);
    col += vec3(1.0, 0.97, 0.93) * 2.4 * softbox(rd, normalize(vec3(0.0, 1.0, 0.25)), vec3(0.0, 0.0, 1.0), vec2(0.55, 0.32), 0.06);
    col += vec3(0.82, 0.9, 1.0) * 1.9 * softbox(rd, normalize(vec3(-1.0, 0.15, 0.35)), vec3(0.0, 1.0, 0.0), vec2(0.07, 1.1), 0.02);
    col += vec3(1.0, 0.8, 0.6) * 1.5 * softbox(rd, normalize(vec3(1.0, 0.05, -0.25)), vec3(0.0, 1.0, 0.0), vec2(0.06, 0.9), 0.02);
    col += vec3(0.3, 0.42, 1.0) * 0.45 * pow(max(dot(rd, normalize(vec3(0.25, 0.15, -1.0))), 0.0), 6.0);
    // grand diffuseur derrière la caméra + carton réflecteur au sol : dégradés subtils sur les faces planes
    col += vec3(0.11, 0.115, 0.13) * softbox(rd, normalize(vec3(0.15, 0.35, 1.0)), vec3(0.0, 1.0, 0.0), vec2(0.9, 0.5), 0.5);
    col += vec3(0.2, 0.21, 0.25) * softbox(rd, normalize(vec3(0.05, -0.32, 1.0)), vec3(0.0, 1.0, 0.0), vec2(1.1, 0.16), 0.3);
    col += vec3(0.7, 0.35, 1.0) * 0.22 * pow(max(dot(rd, normalize(vec3(-0.6, -0.2, -0.7))), 0.0), 6.0);
    if (uSweep > -1.4 && uSweep < 1.4) {
      vec3 sd = normalize(vec3(uSweep * 1.7, 0.2, 1.0));
      col += vec3(1.0) * 6.0 * softbox(rd, sd, vec3(0.0, 1.0, 0.0), vec2(0.035, 1.5), 0.02);
    }
    return col;
  }

  vec3 thinFilm(float ndv, float th){
    float d = th * 1.6 + (1.0 - ndv) * 0.9;
    return 0.55 + 0.45 * cos(6.28318 * (d + vec3(0.0, 0.33, 0.67)));
  }

  vec3 shadeObj(vec3 ro, vec3 rd, float t){
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 r = reflect(rd, n);
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    vec3 F0 = vec3(0.80, 0.82, 0.86);
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - ndv, 5.0);
    vec3 refl = env(r);
    if (uFloor > 0.5 && r.y < 0.0) {
      // le sol (noir brillant) se reflète dans le chrome
      float tf = (FLOOR_Y - p.y) / r.y;
      vec3 fp = p + r * tf;
      float fade = exp(-length(fp.xz) * 0.35);
      refl = mix(refl, vec3(0.006, 0.007, 0.01) + env(reflect(r, vec3(0.0, 1.0, 0.0))) * 0.08 * fade, 0.6);
    }
    float ao = calcAO(p, n);
    vec3 q = objSpace(p);
    vec3 film = thinFilm(ndv, 0.5 + 0.5 * sin(q.y * 3.1 + q.x * 2.3 + uTime * 0.6));
    vec3 tint = mix(vec3(1.0), film * 1.25, uIri);
    return refl * F * tint * (0.3 + 0.7 * ao);
  }

  vec3 background(vec3 rd, vec2 uv){
    vec3 col = env(rd) * 0.06;
    col += vec3(0.05, 0.06, 0.1) * uGlow * exp(-dot(uv, uv) * 1.6);
    return col;
  }

  void main(){
    vec2 frag = gl_FragCoord.xy + uJitter;
    vec2 uv = (2.0 * frag - uRes) / uRes.y;
    vec3 ww = normalize(uCamTgt - uCamPos);
    vec3 up = vec3(sin(uRoll), cos(uRoll), 0.0);
    vec3 uu = normalize(cross(ww, up));
    vec3 vv = cross(uu, ww);
    float fl = 1.0 / tan(radians(uFov) * 0.5);
    vec3 rd = normalize(uv.x * uu + uv.y * vv + fl * ww);
    vec3 ro = uCamPos;

    vec3 col = background(rd, uv);
    float tObj = march(ro, rd);
    float tFl = (uFloor > 0.5 && rd.y < 0.0) ? (FLOOR_Y - ro.y) / rd.y : 1e9;
    if (tObj > 0.0 && tObj < tFl) {
      col = shadeObj(ro, rd, tObj);
    } else if (tFl < 1e8) {
      vec3 fp = ro + rd * tFl;
      vec3 rr = reflect(rd, vec3(0.0, 1.0, 0.0));
      float tr = march(fp + rr * 0.002, rr);
      vec3 fc = vec3(0.004, 0.0045, 0.007) + env(rr) * 0.035;
      if (tr > 0.0) fc = mix(fc, shadeObj(fp, rr, tr) * 0.32, exp(-tr * 0.4));
      float cont = clamp(map(fp) / 0.6, 0.0, 1.0);
      fc *= 0.35 + 0.65 * cont;
      float fade = exp(-length(fp.xz) * 0.22);
      col = mix(col, fc, fade);
    }
    outColor = vec4(col, 1.0);
  }`;

  const PREFILTER = COMMON + `
  uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThreshold;
  void main(){
    vec3 c = vec3(0.0);
    c += texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture(uSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
    c += texture(uSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
    c += texture(uSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
    c *= 0.25;
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + 0.5, 0.0, 1.0);
    soft = soft * soft * 0.5;
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    outColor = vec4(min(c * contrib, vec3(60.0)), 1.0);
  }`;

  const DOWN = COMMON + `
  uniform sampler2D uSrc; uniform vec2 uTexel;
  void main(){
    vec2 t = uTexel;
    vec3 a = texture(uSrc, vUv + t * vec2(-2.0, 2.0)).rgb, b = texture(uSrc, vUv + t * vec2(0.0, 2.0)).rgb, c = texture(uSrc, vUv + t * vec2(2.0, 2.0)).rgb;
    vec3 d = texture(uSrc, vUv + t * vec2(-2.0, 0.0)).rgb, e = texture(uSrc, vUv).rgb, f = texture(uSrc, vUv + t * vec2(2.0, 0.0)).rgb;
    vec3 g = texture(uSrc, vUv + t * vec2(-2.0, -2.0)).rgb, h = texture(uSrc, vUv + t * vec2(0.0, -2.0)).rgb, i = texture(uSrc, vUv + t * vec2(2.0, -2.0)).rgb;
    vec3 j = texture(uSrc, vUv + t * vec2(-1.0, 1.0)).rgb, k = texture(uSrc, vUv + t * vec2(1.0, 1.0)).rgb;
    vec3 l = texture(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb, m = texture(uSrc, vUv + t * vec2(1.0, -1.0)).rgb;
    vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    outColor = vec4(o, 1.0);
  }`;

  const UP = COMMON + `
  uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uRadius;
  void main(){
    vec2 t = uTexel * uRadius;
    vec3 o = texture(uSrc, vUv).rgb * 4.0;
    o += (texture(uSrc, vUv + vec2(-t.x, 0.0)).rgb + texture(uSrc, vUv + vec2(t.x, 0.0)).rgb + texture(uSrc, vUv + vec2(0.0, -t.y)).rgb + texture(uSrc, vUv + vec2(0.0, t.y)).rgb) * 2.0;
    o += texture(uSrc, vUv + vec2(-t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(-t.x, t.y)).rgb + texture(uSrc, vUv + vec2(t.x, t.y)).rgb;
    outColor = vec4(o / 16.0, 1.0);
  }`;

  const STREAK = COMMON + `
  uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uStep;
  void main(){
    vec3 o = vec3(0.0); float wsum = 0.0;
    for (int i = -7; i <= 7; i++) {
      float w = exp(-float(i * i) / 18.0);
      o += texture(uSrc, vUv + vec2(float(i) * uStep * uTexel.x, 0.0)).rgb * w;
      wsum += w;
    }
    outColor = vec4(o / wsum, 1.0);
  }`;

  const COMPOSITE = COMMON + `
  uniform sampler2D uScene, uBloom, uStreak; uniform vec2 uRes;
  uniform float uExposure, uBloomAmt, uStreakAmt, uVignette, uSeed, uFade, uFlare, uFlareY, uCA, uGrain;
  vec3 aces(vec3 x){ const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
  void main(){
    vec2 uv = vUv;
    vec2 dir = uv - 0.5;
    float k = uCA * dot(dir, dir);
    vec3 col;
    col.r = texture(uScene, uv - dir * k).r;
    col.g = texture(uScene, uv).g;
    col.b = texture(uScene, uv + dir * k).b;
    col += texture(uBloom, uv).rgb * uBloomAmt;
    col += texture(uStreak, uv).rgb * uStreakAmt * vec3(0.55, 0.72, 1.0);
    if (uFlare > 0.001) {
      float fy = abs(uv.y - uFlareY) * uRes.y;
      col += uFlare * vec3(0.55, 0.75, 1.0) * (exp(-fy * 0.9) * 3.0 + exp(-fy * 0.08) * 0.25) * smoothstep(0.75, 0.0, abs(uv.x - 0.5));
    }
    col *= uExposure;
    col = aces(col);
    col *= mix(1.0, smoothstep(1.15, 0.3, length(dir * vec2(1.0, 0.85))), uVignette);
    col = pow(col, vec3(1.0 / 2.2));
    float g = hash12(uv * uRes + uSeed * 17.0) + hash12(uv * uRes * 1.37 + uSeed * 31.0) - 1.0;
    col += g * uGrain;
    col *= uFade;
    col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) / 255.0;
    outColor = vec4(col, 1.0);
  }`;

  class LiquidGL {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
      if (!gl) throw new Error('WebGL2 indisponible');
      if (!gl.getExtension('EXT_color_buffer_float')) gl.getExtension('EXT_color_buffer_half_float');
      this.gl = gl;
      this.W = canvas.width;
      this.H = canvas.height;
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this.p = {
        scene: this.prog(SCENE),
        pre: this.prog(PREFILTER),
        down: this.prog(DOWN),
        up: this.prog(UP),
        streak: this.prog(STREAK),
        comp: this.prog(COMPOSITE),
      };
      this.sceneFB = this.fbo(this.W, this.H);
      this.mips = [];
      let w = this.W >> 1;
      let h = this.H >> 1;
      for (let i = 0; i < 6; i++) {
        this.mips.push(this.fbo(Math.max(1, w), Math.max(1, h)));
        w >>= 1;
        h >>= 1;
      }
      this.st = [this.fbo(this.W >> 2, this.H >> 2), this.fbo(this.W >> 2, this.H >> 2)];
    }

    prog(fs) {
      const gl = this.gl;
      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const loc = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        const name = info.name.replace(/\[0\]$/, '');
        loc[name] = gl.getUniformLocation(p, info.name);
      }
      return { p, loc };
    }

    fbo(w, h) {
      const gl = this.gl;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { fb, tex, w, h };
    }

    pass(prog, target, uniforms = {}, textures = {}) {
      const gl = this.gl;
      gl.useProgram(prog.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : this.W, target ? target.h : this.H);
      let unit = 0;
      for (const [name, tex] of Object.entries(textures)) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(prog.loc[name], unit++);
      }
      for (const [name, v] of Object.entries(uniforms)) {
        const l = prog.loc[name];
        if (l == null) continue;
        if (typeof v === 'number') gl.uniform1f(l, v);
        else if (v.length === 2) gl.uniform2fv(l, v);
        else if (v.length === 3) gl.uniform3fv(l, v);
        else if (v.length === 4) gl.uniform4fv(l, v);
        else gl.uniform4fv(l, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    render(U) {
      const gl = this.gl;
      gl.bindVertexArray(this.vao);
      gl.disable(gl.BLEND);
      this.pass(this.p.scene, this.sceneFB, {
        uRes: [this.W, this.H], uJitter: U.jitter || [0, 0], uTime: U.time,
        uCamPos: U.camPos, uCamTgt: U.camTgt, uFov: U.fov, uRoll: U.roll,
        uBalls: U.balls, uK: U.k, uTorus: U.torus, uBottle: U.bottle, uWobble: U.wobble,
        uShockR: U.shockR, uShockA: U.shockA, uIri: U.iri, uSweep: U.sweep, uFloor: U.floor,
        uSpin: U.spin, uTilt: U.tilt, uEnvRot: U.envRot, uBound: U.bound, uGlow: U.glow,
      });
      // bloom
      const m = this.mips;
      this.pass(this.p.pre, m[0], { uTexel: [1 / this.W, 1 / this.H], uThreshold: U.threshold }, { uSrc: this.sceneFB.tex });
      for (let i = 1; i < m.length; i++) this.pass(this.p.down, m[i], { uTexel: [1 / m[i - 1].w, 1 / m[i - 1].h] }, { uSrc: m[i - 1].tex });
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = m.length - 1; i > 0; i--) this.pass(this.p.up, m[i - 1], { uTexel: [1 / m[i].w, 1 / m[i].h], uRadius: 1.0 }, { uSrc: m[i].tex });
      gl.disable(gl.BLEND);
      // traînée anamorphique (flou horizontal à pas croissants)
      this.pass(this.p.down, this.st[0], { uTexel: [1 / m[0].w, 1 / m[0].h] }, { uSrc: m[0].tex });
      let a = 0;
      for (const step of [1.5, 6, 24]) {
        this.pass(this.p.streak, this.st[1 - a], { uTexel: [1 / this.st[0].w, 1 / this.st[0].h], uStep: step }, { uSrc: this.st[a].tex });
        a = 1 - a;
      }
      this.pass(this.p.comp, null, {
        uRes: [this.W, this.H], uExposure: U.exposure, uBloomAmt: U.bloom, uStreakAmt: U.streak,
        uVignette: U.vignette, uSeed: U.seed, uFade: U.fade, uFlare: U.flare, uFlareY: U.flareY, uCA: U.ca, uGrain: U.grain,
      }, { uScene: this.sceneFB.tex, uBloom: m[0].tex, uStreak: this.st[a].tex });
      gl.finish();
    }
  }
  window.LiquidGL = LiquidGL;
})();
