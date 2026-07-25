// Raw WebGL2 renderer for the "water" background — a third pitch for the studio
// landing page.
//
// A height-field wave simulation runs on the GPU (ping-pong float targets), but
// it is rendered as *stylized ink* rather than photoreal water: the surface
// warps a slowly drifting marbled field into flowing topographic linework —
// sumi-e / fine-line engraving — quantized like a linocut and printed in the
// studio's warm-paper-and-ink palette. The cursor stirs the surface; every move
// drops a soft impulse that radiates out and ripples the linework. Left alone, a
// handful of ambient sources keep it breathing.
//
// The simulation is ported from apps/web/example (which exposed everything
// through dat.GUI); the render pass is our own ink stylization, and the motion
// is tuned a touch slower and calmer than the reference. Lives behind the
// useWater composable; owns its GL resources and frees them on dispose().

/** Simulation grid resolution (square, wave height field). */
const SIM = 256
/** Max simultaneous impulses uploaded to the update shader per step. */
const MAX_DROPS = 12

// --- interaction / motion (JS side) ---------------------------------------
const BRUSH_RADIUS = 0.032
const BRUSH_BASE = 0.01
const BRUSH_GAIN = 0.8
const BRUSH_MAX = 0.08
/** Pigment injected at the cursor each sim step while the pointer is on-screen. */
const PAINT_INJECT = 0.018

// Autonomous ripple emitters. Disabled (count 0): self-generated ripples that
// ramped up once the pointer went idle read as "uncanny" motion-without-cause.
// The surface's life now comes only from the drifting marble base + the cursor;
// bump AMBIENT_COUNT back up for an auto-animated surface.
const AMBIENT_COUNT = 0
const AMBIENT_STRENGTH = 0.016
const AMBIENT_RATE = 0.6 // slower than the reference (1.0) — calmer surface
const IDLE_AFTER = 2.2 // s of no pointer before ambient runs at full strength
const DRIVEN_MULT = 0.45 // ambient strength while the user is actively stirring

// fixed-timestep integration
const SIM_RATE = 60
const MAX_SUB = 4

type WaterOptions = {
  /** Device-pixel multiplier for the drawing buffer (0.5–2). */
  pixelDensity?: number
}

export type { WaterOptions }

const VERTEX_SHADER = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

// Wave-equation update: verlet integration of a discrete height field with
// damping and soft edges. Impulses (cursor + ambient) are added as gaussians.
const UPDATE_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uAspect;
uniform int uDropCount;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec3 uPaint;        // xy = cursor uv, z = pigment injected this step
in vec2 vUv;
out vec4 o;

const float PROP = 0.2;    // propagation speed (lower = slower ripples)
const float DAMP = 0.985;   // lower = ripples settle sooner after a gesture
const float CLAMP_H = 1.6;
const float DIFFUSE = 0.1;     // how fast spilled pigment spreads (keep < 0.25)
const float DYE_DECAY = 0.999;  // per-step fade — near 1.0 so spills linger far longer
const float PAINT_R = 0.02;   // radius of the pigment injected at the cursor

// Verlet wave update at an arbitrary sample point (no impulses). Used both for
// interior cells and, at the border, to look up the neighbour's *next* value.
float nextInterior(vec2 uv) {
  float c = texture(uState, uv).r, p = texture(uState, uv).g;
  float l = texture(uState, uv - vec2(uTexel.x, 0.0)).r;
  float r = texture(uState, uv + vec2(uTexel.x, 0.0)).r;
  float u = texture(uState, uv + vec2(0.0, uTexel.y)).r;
  float d = texture(uState, uv - vec2(0.0, uTexel.y)).r;
  return ((2.0 * c - p) + (l + r + u + d - 4.0 * c) * PROP) * DAMP;
}

void main() {
  vec2 uv = vUv;
  vec4 st = texture(uState, uv);
  float c = st.r;

  bool onL = uv.x <= uTexel.x * 1.5;
  bool onR = uv.x >= 1.0 - uTexel.x * 1.5;
  bool onB = uv.y <= uTexel.y * 1.5;
  bool onT = uv.y >= 1.0 - uTexel.y * 1.5;

  float nv;
  if (onL || onR || onB || onT) {
    // 1st-order Mur absorbing boundary: outgoing ripples pass through the edge
    // and leave the domain instead of reflecting, so the water reads as endless.
    vec2 inward = vec2(onL ? 1.0 : (onR ? -1.0 : 0.0), onB ? 1.0 : (onT ? -1.0 : 0.0));
    vec2 nb = uv + inward * uTexel;
    float courant = sqrt(PROP);
    float k = (courant - 1.0) / (courant + 1.0);
    nv = texture(uState, nb).r + k * (nextInterior(nb) - c);
  } else {
    nv = nextInterior(uv);
    for (int i = 0; i < ${MAX_DROPS}; i++) {
      if (i >= uDropCount) break;
      vec2 dp = uv - uDrops[i].xy;
      dp.x *= uAspect;
      float rr = uDrops[i].w;
      nv += uDrops[i].z * exp(-dot(dp, dp) / (rr * rr));
    }
  }

  // Pigment (channel b): the cursor spills paint into the water — inject a soft
  // blob at the pointer, diffuse it into the neighbours, and let it slowly fade.
  float dc = st.b;
  float dl = texture(uState, uv - vec2(uTexel.x, 0.0)).b;
  float dr = texture(uState, uv + vec2(uTexel.x, 0.0)).b;
  float du = texture(uState, uv + vec2(0.0, uTexel.y)).b;
  float dd = texture(uState, uv - vec2(0.0, uTexel.y)).b;
  float dye = (dc + (dl + dr + du + dd - 4.0 * dc) * DIFFUSE) * DYE_DECAY;
  vec2 pp = uv - uPaint.xy;
  pp.x *= uAspect;
  dye += uPaint.z * exp(-dot(pp, pp) / (PAINT_R * PAINT_R));

  o = vec4(clamp(nv, -CLAMP_H, CLAMP_H), c, clamp(dye, 0.0, 2.0), 1.0);
}
`

// Render pass: stylized ink, not photoreal water. The wave height field warps a
// slowly drifting marbled base into flowing topographic linework (sumi-e / fine-
// line engraving), quantized into a few ink levels like a linocut and printed in
// the studio's warm-paper-and-ink palette. Cursor ripples ripple the lines.
const RENDER_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform vec2 uResolution;
uniform float uTime;
uniform float uAspect;
// palette — set per theme from JS so the ink field & spilled pigment invert
uniform vec3 uPaper;    // page field (light paper / dark near-black)
uniform vec3 uInk;      // topographic linework
uniform vec3 uPigThin;  // spilled pigment where it bleeds thin
uniform vec3 uPigThick; // spilled pigment where it pools thick
in vec2 vUv;
out vec4 frag;

const vec3 ACCENT = vec3(0.659, 0.133, 0.173); // deep vermilion, used sparingly

// contour density + wave influence
const float LINES = 3.4;   // higher = more topographic lines
const float WARP = 7.0;    // how hard ripples bend the linework
const float LEVELS = 5.0;  // ink quantization steps (linocut feel)

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}

void main() {
  vec2 t = uTexel;
  float hc = texture(uState, vUv).r;
  float hl = texture(uState, vUv - vec2(t.x, 0.0)).r, hr = texture(uState, vUv + vec2(t.x, 0.0)).r;
  float hu = texture(uState, vUv + vec2(0.0, t.y)).r, hd = texture(uState, vUv - vec2(0.0, t.y)).r;
  float hx = (hr - hl) * 0.5, hy = (hu - hd) * 0.5;
  float lap = hr + hl + hu + hd - 4.0 * hc; // curvature at wave crests
  float slope = length(vec2(hx, hy));

  vec2 p = vUv * vec2(uAspect, 1.0);

  // slowly drifting domain-warped marble — the always-present ink structure
  vec2 warp = vec2(fbm(p * 1.5 + uTime * 0.02), fbm(p * 1.5 + vec2(3.1, 1.7) - uTime * 0.016));
  float base = fbm(p * 2.0 + warp * 1.2);

  // wave height warps the contour field, so ripples visibly ripple the lines
  float field = (base * 4.0 + hc * WARP) * LINES;
  float aa = fwidth(field);
  float contour = 1.0 - smoothstep(0.0, aa * 1.6, abs(fract(field - 0.5) - 0.5));

  // tonal wash: ink pools in the low marble regions; ripple fronts deposit edges
  float wash = smoothstep(0.35, 0.85, base) * 0.35;
  float crest = clamp(slope * 5.0 + max(lap, 0.0) * 60.0, 0.0, 1.0);
  float tone = clamp(contour * 0.9 + wash + crest * 0.5, 0.0, 1.0);

  // quantize into a few ink levels for a printed / linocut feel
  tone = floor(tone * LEVELS + 0.5) / LEVELS;

  vec3 col = mix(uPaper, uInk, tone);
  // a whisper of warm only in the deepest ink pools
  col = mix(col, ACCENT, smoothstep(0.78, 1.0, tone) * 0.12);

  // spilled pigment (channel b): thin bleed vs thick pool, per theme
  float dye = texture(uState, vUv).b;
  float amt = 1.0 - exp(-dye * 3.0);
  vec3 pigment = mix(uPigThin, uPigThick, amt);
  col = mix(col, pigment, amt);

  // paper grain + soft vignette
  col -= (hash(vUv * uResolution + fract(uTime)) - 0.5) * 0.02;
  col *= mix(0.94, 1.0, smoothstep(1.1, 0.3, length((vUv - 0.5) * vec2(uAspect, 1.0))));
  frag = vec4(col, 1.0);
}
`

// Render palette per theme: [paper/field, ink linework, pigment-thin, pigment-thick].
type Palette = {
  paper: readonly [number, number, number]
  ink: readonly [number, number, number]
  pigThin: readonly [number, number, number]
  pigThick: readonly [number, number, number]
}
const LIGHT_PALETTE: Palette = {
  paper: [0.98, 0.972, 0.949],
  ink: [0.102, 0.09, 0.078],
  pigThin: [0.09, 0.2, 0.42], // indigo bleed
  pigThick: [0.03, 0.035, 0.05], // near-black core
}
const DARK_PALETTE: Palette = {
  paper: [0.055, 0.05, 0.043], // deep warm near-black field
  ink: [0.86, 0.83, 0.76], // warm light linework
  pigThin: [0.34, 0.5, 0.78], // brighter indigo so the bleed glows on dark
  pigThick: [0.82, 0.86, 0.94], // pale core where the pigment pools
}

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer }

type AmbientSource = {
  px: number
  py: number
  ax: number
  ay: number
  sx: number
  sy: number
  phx: number
  phy: number
  next: number
  period: number
}

export class WaterRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly pixelDensity: number

  private readonly updateProgram: WebGLProgram
  private readonly renderProgram: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private targets: [Target, Target]
  private read = 0

  private readonly uUpdate: Record<string, WebGLUniformLocation | null>
  private readonly uRender: Record<string, WebGLUniformLocation | null>

  private readonly dropData = new Float32Array(MAX_DROPS * 4)
  private pending: number[][] = []
  private sources: AmbientSource[] = []

  private vw = 1
  private vh = 1
  private px = 0.5
  private py = 0.5
  private hasPointer = false
  private lastInteract = -1e9
  private palette: Palette = LIGHT_PALETTE

  private readonly t0 = performance.now()
  private last = performance.now()
  private accum = 0
  private rafId = 0
  private running = false

  constructor(canvas: HTMLCanvasElement, options: WaterOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'high-performance',
    })
    if (!gl) throw new Error('WebGL2 unavailable')
    if (
      !gl.getExtension('EXT_color_buffer_float') &&
      !gl.getExtension('EXT_color_buffer_half_float')
    ) {
      throw new Error('float render targets unavailable')
    }
    gl.getExtension('OES_texture_half_float_linear')

    this.gl = gl
    this.canvas = canvas
    this.pixelDensity = options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 2)

    this.updateProgram = this.createProgram(VERTEX_SHADER, UPDATE_SHADER)
    this.renderProgram = this.createProgram(VERTEX_SHADER, RENDER_SHADER)
    this.uUpdate = this.locations(this.updateProgram, [
      'uState',
      'uTexel',
      'uAspect',
      'uDropCount',
      'uDrops',
      'uPaint',
    ])
    this.uRender = this.locations(this.renderProgram, [
      'uState',
      'uTexel',
      'uResolution',
      'uTime',
      'uAspect',
      'uPaper',
      'uInk',
      'uPigThin',
      'uPigThick',
    ])

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('failed to create VAO')
    this.vao = vao

    this.targets = [this.makeTarget(), this.makeTarget()]
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('float framebuffer incomplete')
    }
    this.clearTargets()
    this.initSources(AMBIENT_COUNT)
    this.resize()
  }

  // --- public API -----------------------------------------------------------

  /** Pointer in 0..1 viewport coords (x = clientX/innerWidth, y = clientY/innerHeight). */
  setPointer(x: number, y: number): void {
    const ux = this.clamp01(x)
    const uy = this.clamp01(1 - y) // sim uv has y up
    if (this.hasPointer) {
      const mag = Math.min(
        BRUSH_BASE + Math.hypot(ux - this.px, uy - this.py) * BRUSH_GAIN,
        BRUSH_MAX,
      )
      this.queueDrop(ux, uy, mag, BRUSH_RADIUS)
    }
    this.px = ux
    this.py = uy
    this.hasPointer = true
    this.lastInteract = this.now()
  }

  clearPointer(): void {
    this.hasPointer = false
  }

  /** Switch the render palette between the light and dark themes. */
  setTheme(isDark: boolean): void {
    const next = isDark ? DARK_PALETTE : LIGHT_PALETTE
    if (this.palette === next) return
    this.palette = next
    if (!this.running) this.render() // reflect the swap while paused
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  /** Reduced-motion: present a single calm frame with no animation. */
  settle(): void {
    this.clearTargets()
    this.render()
  }

  resize(): void {
    const { canvas, gl } = this
    this.vw = window.innerWidth
    this.vh = window.innerHeight
    canvas.width = Math.floor(this.vw * this.pixelDensity)
    canvas.height = Math.floor(this.vh * this.pixelDensity)
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  dispose(): void {
    this.stop()
    const { gl } = this
    for (const t of this.targets) {
      gl.deleteFramebuffer(t.fbo)
      gl.deleteTexture(t.tex)
    }
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.updateProgram)
    gl.deleteProgram(this.renderProgram)
  }

  // --- loop -----------------------------------------------------------------

  private readonly frame = (t: number): void => {
    if (!this.running) return
    let dt = (t - this.last) / 1000
    if (dt > 0.25) dt = 0.25
    this.last = t
    const step = 1 / SIM_RATE
    this.accum += dt
    let n = 0
    while (this.accum >= step && n < MAX_SUB) {
      this.simStep(step)
      this.accum -= step
      n++
    }
    if (n === 0) {
      this.simStep(step)
      this.accum = 0
    }
    this.render()
    this.rafId = requestAnimationFrame(this.frame)
  }

  private simStep(step: number): void {
    this.collectAmbient(this.now(), step)
    const count = this.uploadDrops()
    const { gl } = this
    const [a, b] = this.targets
    const src = this.read === 0 ? a : b
    const dst = this.read === 0 ? b : a
    gl.useProgram(this.updateProgram)
    gl.bindVertexArray(this.vao)
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
    gl.viewport(0, 0, SIM, SIM)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src.tex)
    gl.uniform1i(this.uUpdate.uState ?? null, 0)
    gl.uniform2f(this.uUpdate.uTexel ?? null, 1 / SIM, 1 / SIM)
    gl.uniform1f(this.uUpdate.uAspect ?? null, this.vw / this.vh)
    gl.uniform1i(this.uUpdate.uDropCount ?? null, count)
    gl.uniform4fv(this.uUpdate.uDrops ?? null, this.dropData)
    gl.uniform3f(this.uUpdate.uPaint ?? null, this.px, this.py, this.hasPointer ? PAINT_INJECT : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.read ^= 1
  }

  private render(): void {
    const { gl, canvas } = this
    gl.useProgram(this.renderProgram)
    gl.bindVertexArray(this.vao)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    const [a, b] = this.targets
    gl.bindTexture(gl.TEXTURE_2D, (this.read === 0 ? a : b).tex)
    gl.uniform1i(this.uRender.uState ?? null, 0)
    gl.uniform2f(this.uRender.uTexel ?? null, 1 / SIM, 1 / SIM)
    gl.uniform2f(this.uRender.uResolution ?? null, canvas.width, canvas.height)
    gl.uniform1f(this.uRender.uTime ?? null, this.now())
    gl.uniform1f(this.uRender.uAspect ?? null, this.vw / this.vh)
    const p = this.palette
    gl.uniform3f(this.uRender.uPaper ?? null, p.paper[0], p.paper[1], p.paper[2])
    gl.uniform3f(this.uRender.uInk ?? null, p.ink[0], p.ink[1], p.ink[2])
    gl.uniform3f(this.uRender.uPigThin ?? null, p.pigThin[0], p.pigThin[1], p.pigThin[2])
    gl.uniform3f(this.uRender.uPigThick ?? null, p.pigThick[0], p.pigThick[1], p.pigThick[2])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  // --- impulses -------------------------------------------------------------

  private queueDrop(x: number, y: number, strength: number, radius: number): void {
    if (this.pending.length < MAX_DROPS) this.pending.push([x, y, strength, radius])
  }

  private uploadDrops(): number {
    const n = Math.min(this.pending.length, MAX_DROPS)
    for (let k = 0; k < n; k++) {
      const drop = this.pending[k]
      if (drop) this.dropData.set(drop, k * 4)
    }
    this.pending = []
    return n
  }

  private initSources(count: number): void {
    this.sources = []
    for (let k = 0; k < count; k++) {
      this.sources.push({
        px: 0.2 + 0.6 * Math.random(),
        py: 0.2 + 0.6 * Math.random(),
        ax: 0.1 + 0.1 * Math.random(),
        ay: 0.1 + 0.1 * Math.random(),
        sx: 0.05 + 0.08 * Math.random(),
        sy: 0.05 + 0.08 * Math.random(),
        phx: Math.random() * 6.28,
        phy: Math.random() * 6.28,
        next: Math.random() * 1.2,
        period: 0.7 + Math.random() * 1.1,
      })
    }
  }

  private collectAmbient(time: number, step: number): void {
    const idle = time - this.lastInteract > IDLE_AFTER
    for (const s of this.sources) {
      s.next -= step
      if (s.next <= 0) {
        s.next = (s.period / Math.max(AMBIENT_RATE, 0.05)) * (0.7 + Math.random() * 0.6)
        const x = this.clamp(s.px + s.ax * Math.sin(time * s.sx * 6.28 + s.phx), 0.06, 0.94)
        const y = this.clamp(s.py + s.ay * Math.cos(time * s.sy * 6.28 + s.phy), 0.06, 0.94)
        this.queueDrop(
          x,
          y,
          AMBIENT_STRENGTH * (idle ? 1 : DRIVEN_MULT),
          0.03 + Math.random() * 0.02,
        )
      }
    }
  }

  // --- GL helpers -----------------------------------------------------------

  private makeTarget(): Target {
    const { gl } = this
    const tex = gl.createTexture()
    if (!tex) throw new Error('failed to create texture')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, SIM, SIM, 0, gl.RGBA, gl.HALF_FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fbo = gl.createFramebuffer()
    if (!fbo) throw new Error('failed to create framebuffer')
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    return { tex, fbo }
  }

  private clearTargets(): void {
    const { gl } = this
    for (const t of this.targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo)
      gl.viewport(0, 0, SIM, SIM)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const { gl } = this
    const vs = this.createShader(gl.VERTEX_SHADER, vsSource)
    const fs = this.createShader(gl.FRAGMENT_SHADER, fsSource)
    const program = gl.createProgram()
    if (!program) throw new Error('failed to create program')
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`program link failed: ${log ?? 'unknown'}`)
    }
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    return program
  }

  private createShader(type: number, source: string): WebGLShader {
    const { gl } = this
    const shader = gl.createShader(type)
    if (!shader) throw new Error('failed to create shader')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`shader compile failed: ${log ?? 'unknown'}`)
    }
    return shader
  }

  private locations(
    program: WebGLProgram,
    names: string[],
  ): Record<string, WebGLUniformLocation | null> {
    const out: Record<string, WebGLUniformLocation | null> = {}
    for (const name of names) out[name] = this.gl.getUniformLocation(program, name)
    return out
  }

  private now(): number {
    return (performance.now() - this.t0) / 1000
  }

  private clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
  }

  private clamp01(v: number): number {
    return this.clamp(v, 0, 1)
  }
}
