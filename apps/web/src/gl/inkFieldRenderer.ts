// Raw WebGL2 renderer for the "ink field" background.
//
// A weave of ink threads. Each thread is an instanced triangle-strip ribbon
// whose centreline is an independent analytic curve, so threads cross freely.
// They are drawn in two passes against a depth buffer: first a paper "casing"
// (a slightly wider ribbon that only writes depth), then the ink core. A
// per-thread depth that oscillates along its length decides who passes in front
// at each crossing, and the front thread's casing masks the one behind — real
// over/under weave. At rest the threads lie parallel; while the pointer moves,
// `tangle` fills in and they braid through one another, then unwind when it
// settles. A rounded glass lens composites the weave to screen and refracts it
// beneath the cursor.
//
// Design-system aligned: monochrome ink on warm paper. Lives behind the
// useInkField composable; owns its GL resources and releases them on dispose().

// Shared GLSL: the thread centreline + its over/under depth, used by the ribbon
// vertex shader. `tangle` (0..1) scales how far a thread swings from its rest.
const THREAD_GLSL = /* glsl */ `
#define GOLDEN 2.39996323 // golden-angle per-thread phase offset

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Vertical position (uv, 0..1) of thread i at aspect-adjusted x.
float threadY(float i, float xa, float time, float tangle, float lineCount) {
  float sp = 1.0 / lineCount;      // spacing between threads
  float base = (i + 0.5) * sp;     // resting position
  float phase = i * GOLDEN;

  // calm breathing — livelier at rest, two harmonics, still under one spacing
  float y = base
    + sp * 0.34 * sin(xa * 2.1 + phase * 0.7 + time * 0.45)
    + sp * 0.16 * sin(xa * 4.3 - phase * 1.1 - time * 0.30);

  // intertwine — swings across neighbours so threads weave through each other
  float amp = tangle * sp * 2.4;
  y += amp * (
    0.60 * sin(xa * 3.0 + phase + time * 0.70) +
    0.40 * sin(xa * 4.7 - phase * 1.3 - time * 0.55) +
    0.60 * (vnoise(vec2(xa * 1.5, i * 0.7) + time * 0.25) - 0.5)
  );
  return y;
}

// Over/under ordering (0 = front), oscillating along the thread so crossings
// alternate who passes in front.
float threadDepth(float i, float xa, float time) {
  return 0.5 + 0.5 * sin(xa * 3.5 + i * 1.7 + time * 0.6);
}
`

const THREAD_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

layout(location = 0) in vec2 vert; // x = t (0..1 along thread), y = side (-1|+1)

uniform vec2 resolution;
uniform float time;
uniform float tangle;
uniform float lineCount;
uniform float halfWidth; // ribbon half-width, device px
uniform float padLines;  // threads padded above & below the viewport
uniform float converge;  // scroll progress: 0 at page top .. 1 at page bottom

out float vEdge;
out float vFade;
${THREAD_GLSL}

// Depth layers: lanes are interleaved across LAYERS planes — the nearer is
// drawn in front, thicker, darker, and gathers to centre faster; the farther
// sits behind, thinner, lighter, and gathers later. Parallax and collecting are
// the one motion: every lane travels toward the centre as the page scrolls,
// just at its own speed, so they drift apart in depth and end gathered.
#define LAYERS 3.0
#define GATHER_FAST 0.55 // near lanes gather early (small exponent = ease-out)
#define GATHER_SLOW 2.6  // far lanes gather late
#define GATHER_MAX 0.94  // residual spread once fully gathered at page end

void main() {
  float aspect = resolution.x / resolution.y;
  float t = vert.x;
  float side = vert.y;
  // padded so lanes also sit above & below the viewport and stream in as they
  // gather toward the centre
  float i = float(gl_InstanceID) - padLines;

  float layer = mod(i, LAYERS);          // 0..LAYERS-1, interleaved across lanes
  float depth = layer / (LAYERS - 1.0);  // 0 = nearest .. 1 = farthest
  float widthScale = mix(1.0, 0.8, depth);

  // per-lane gather: depth sets the base speed, a stable per-lane jitter varies
  // it so each line moves at its own rate
  float speed = mix(GATHER_FAST, GATHER_SLOW, depth) * mix(0.75, 1.25, hash(vec2(i, 1.7)));
  float gather = pow(clamp(converge, 0.0, 1.0), speed) * GATHER_MAX;

  float xa = t * aspect;
  float epsT = 1.5 / resolution.x;
  float yc0 = mix(threadY(i, xa, time, tangle, lineCount), 0.5, gather);
  float yc1 = mix(threadY(i, (t + epsT) * aspect, time, tangle, lineCount), 0.5, gather);

  // tangent from a neighbouring sample → perpendicular offset, so width stays
  // constant in pixels even where the thread runs steeply
  vec2 dPx = vec2(epsT * resolution.x, (yc1 - yc0) * resolution.y);
  vec2 nrm = normalize(vec2(-dPx.y, dPx.x));

  vec2 posPx = vec2(t * resolution.x, yc0 * resolution.y) + nrm * side * halfWidth * widthScale;
  vec2 clip = posPx / resolution * 2.0 - 1.0;

  // depth: layer decides front/back plane; the along-thread weave gives local
  // over/under within a plane
  float z = clamp(depth * 0.7 + threadDepth(i, xa, time) * 0.3, 0.0, 1.0);

  gl_Position = vec4(clip, z * 2.0 - 1.0, 1.0);
  vEdge = side;
  vFade = mix(1.0, 0.55, depth); // farther lanes recede in weight
}
`

const THREAD_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
uniform vec3 color;
in float vEdge;
in float vFade;
out vec4 fragColor;
void main() {
  // anti-aliased across the ribbon width (casing pass runs unblended, so its
  // soft edge is harmless — paper on paper)
  float aa = fwidth(vEdge);
  float cov = 1.0 - smoothstep(1.0 - aa, 1.0, abs(vEdge));
  // vFade lightens farther layers; harmless on the unblended casing pass
  fragColor = vec4(color, cov * vFade);
}
`

const FULLSCREEN_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 position;
out vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// Presents the weave and refracts it through a rounded glass lens at the cursor.
const COMPOSITE_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D tex;
uniform vec2 resolution;
uniform vec2 pointer; // uv (0..1); offscreen when inactive
uniform float time;

in vec2 uv;
out vec4 fragColor;

#define LENS_SIZE 0.05
#define LENS_EDGE 0.02
#define LENS_DISPLACE 0.03
#define LENS_ALBEDO vec3(0.42)
#define LENS_ALPHA 0.14
#define LENS_SPECULAR 4.0
#define TAU 6.28318530718
#define SPECTRAL_TAPS 8    // wavelength slices integrated through the prism
#define DISPERSION 0.02     // how far the spectrum spreads along the refraction
#define FRINGE 1.5         // amplify only the colour the split actually produced

vec2 ratioAdjust(vec2 p, float r) {
  return vec2(p.x * max(1.0, r), p.y * max(1.0, 1.0 / r));
}

vec3 hsv2rgb(vec3 c) {
  vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
  return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

vec3 sdgCircle(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  float len = length(d);
  return vec3(len - r, d / max(len, 1e-6));
}

float expImpulse(float x, float k, float cut) {
  if (x < 0.0) return 0.0;
  float h = k * (x + cut);
  return h * exp(1.0 - h);
}

void main() {
  float ratio = resolution.x / resolution.y;
  vec2 pa = ratioAdjust(uv, ratio);
  vec2 ma = ratioAdjust(pointer, ratio);
  vec3 lens = sdgCircle(pa, ma, LENS_SIZE);
  vec2 dir = ma - pa;
  float refract = expImpulse(-lens.x / LENS_EDGE, 4.0, 0.175);
  vec2 displacement = normalize(dir) * refract;
  vec2 refractUv = uv + displacement * LENS_DISPLACE;

  // Spectral dispersion — the prism. Glass bends each wavelength by a slightly
  // different amount, so we integrate several wavelength slices offset along the
  // refraction axis. On flat paper every slice lands together and cancels back
  // to neutral; across an ink edge they separate and fringe it into a spectrum.
  // Scaled by the refraction strength, so it fractures hardest at the rim where
  // light bends most — never a uniform wash.
  float inside = smoothstep(0.0, -LENS_EDGE, lens.x); // 0 at rim .. 1 well inside
  float disperse = refract * DISPERSION * inside;
  vec2 axis = normalize(dir);
  vec3 spec = vec3(0.0);
  vec3 wsum = vec3(0.0);
  for (int i = 0; i < SPECTRAL_TAPS; i++) {
    float f = (float(i) + 0.5) / float(SPECTRAL_TAPS); // 0..1 across the spectrum
    vec3 w = hsv2rgb(vec3(f * 0.82, 1.0, 1.0));         // red → violet weight
    spec += w * texture(tex, refractUv + axis * (f - 0.5) * disperse).rgb;
    wsum += w;
  }
  vec3 color = spec / wsum;

  // amplify only the chroma the split produced — neutral areas are untouched, so
  // the fracture reads as caught light rather than a painted-on tint
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color += (color - vec3(luma)) * FRINGE * inside;

  // rim glint carries a faint, slowly-drifting prism sheen — pale, not neon
  float angle = atan(pa.y - ma.y, pa.x - ma.x);
  vec3 prism = hsv2rgb(vec3(angle / TAU + time * 0.03, 0.45, 1.0));
  vec4 lensColor = vec4(LENS_ALBEDO, LENS_ALPHA);
  lensColor = mix(
    lensColor,
    vec4(vec3(LENS_SPECULAR) * mix(vec3(1.0), prism, 0.6), 1.0),
    (smoothstep(-0.002, 0.0, lens.x) - smoothstep(0.0, 0.002, lens.x)) *
      abs(dot(lens.yz, normalize(vec2(0.5) - pa)))
  );
  color = mix(color, lensColor.rgb, lensColor.a * smoothstep(0.0, -0.002, lens.x));

  fragColor = vec4(color, 1.0);
}
`

/** Warm-neutral paper, matching --color-paper in the design system. */
const PAPER_COLOR: readonly [number, number, number] = [0xfa / 255, 0xf8 / 255, 0xf2 / 255]
/** Ink stroke colour, matching --color-ink-800. */
const INK_COLOR: readonly [number, number, number] = [0x28 / 255, 0x24 / 255, 0x1f / 255]
/** Dark-theme field, a deep warm near-black (≈ --color-ink-950). */
const PAPER_DARK: readonly [number, number, number] = [0x10 / 255, 0x0e / 255, 0x0c / 255]
/** Dark-theme stroke, a warm light thread (≈ --color-ink-300) so lines read. */
const INK_DARK: readonly [number, number, number] = [0xc2 / 255, 0xbb / 255, 0xad / 255]
/** Number of threads across the viewport height. */
const DEFAULT_LINE_COUNT = 28
/** Samples along each thread ribbon; higher = smoother curves when tangled. */
const SEGMENTS = 128
/** Extra threads above and below the viewport, so parallax scroll never bares. */
const PAD_LINES = 14
/** Ink core / paper casing half-widths, in CSS px (scaled by pixel density). */
const INK_HALF_WIDTH = 1.6
const CASING_HALF_WIDTH = INK_HALF_WIDTH + 2.4

// Transition progress fills up while the pointer moves and drains once it has
// been still for MOVE_TIMEOUT ms. It advances linearly (frame-rate independent),
// then an ease-in-out curve maps it to the tangle amount, so the motion eases
// in and out like a bezier rather than gliding at a constant rate.
const MOVE_TIMEOUT = 120
const PROGRESS_RISE_PER_SEC = 1.4 // fully tangled after ~0.7s of movement
const PROGRESS_FALL_PER_SEC = 0.8 // back to calm after ~1.25s of stillness

// smootherstep — a symmetric ease-in-out S-curve (bezier-like)
function easeInOut(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

export type InkFieldOptions = {
  /** Device-pixel multiplier for the drawing buffer. Clamped to [0.5, 2]. */
  pixelDensity?: number
  /** Ink stroke colour as 0..1 RGB. Defaults to the design-system ink-800. */
  inkColor?: readonly [number, number, number]
  /** Number of threads across the height. Clamped to [8, 80]. */
  lineCount?: number
}

type ThreadUniforms = {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  tangle: WebGLUniformLocation | null
  lineCount: WebGLUniformLocation | null
  halfWidth: WebGLUniformLocation | null
  color: WebGLUniformLocation | null
  padLines: WebGLUniformLocation | null
  converge: WebGLUniformLocation | null
}

type CompositeUniforms = {
  tex: WebGLUniformLocation | null
  resolution: WebGLUniformLocation | null
  pointer: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
}

export class InkFieldRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly pixelDensity: number
  private readonly inkColor: readonly [number, number, number]
  private readonly lineCount: number
  private readonly instanceCount: number
  private readonly stripVertices: number

  private readonly threadProgram: WebGLProgram
  private readonly compositeProgram: WebGLProgram
  private readonly threadUniforms: ThreadUniforms
  private readonly compositeUniforms: CompositeUniforms

  private readonly stripBuffer: WebGLBuffer
  private readonly stripVao: WebGLVertexArrayObject
  private readonly quadBuffer: WebGLBuffer
  private readonly quadVao: WebGLVertexArrayObject

  private readonly fbo: WebGLFramebuffer
  private readonly colorTexture: WebGLTexture
  private readonly depthBuffer: WebGLRenderbuffer

  private raf = 0
  private dark = false // theme: swaps the paper field & ink thread palette
  private readonly startTime = performance.now()
  private pointer: [number, number] = [-1, 2] // uv space, offscreen
  private converge = 0 // scroll progress 0..1; gathers lanes to centre
  private progress = 0 // linear 0..1 transition driver; eased before use
  private lastMoveTime = Number.NEGATIVE_INFINITY
  private lastFrameTime = 0
  private disposed = false

  constructor(canvas: HTMLCanvasElement, options: InkFieldOptions = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false })
    if (!gl) throw new Error('WebGL2 is not supported in this environment')

    this.canvas = canvas
    this.gl = gl
    this.pixelDensity = clamp(
      options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 2),
      0.5,
      2,
    )
    this.inkColor = options.inkColor ?? INK_COLOR
    this.lineCount = Math.round(clamp(options.lineCount ?? DEFAULT_LINE_COUNT, 8, 80))
    this.instanceCount = this.lineCount + 2 * PAD_LINES

    this.threadProgram = createProgram(gl, THREAD_VERTEX_SHADER, THREAD_FRAGMENT_SHADER)
    this.compositeProgram = createProgram(gl, FULLSCREEN_VERTEX_SHADER, COMPOSITE_FRAGMENT_SHADER)
    this.threadUniforms = {
      resolution: gl.getUniformLocation(this.threadProgram, 'resolution'),
      time: gl.getUniformLocation(this.threadProgram, 'time'),
      tangle: gl.getUniformLocation(this.threadProgram, 'tangle'),
      lineCount: gl.getUniformLocation(this.threadProgram, 'lineCount'),
      halfWidth: gl.getUniformLocation(this.threadProgram, 'halfWidth'),
      color: gl.getUniformLocation(this.threadProgram, 'color'),
      padLines: gl.getUniformLocation(this.threadProgram, 'padLines'),
      converge: gl.getUniformLocation(this.threadProgram, 'converge'),
    }
    this.compositeUniforms = {
      tex: gl.getUniformLocation(this.compositeProgram, 'tex'),
      resolution: gl.getUniformLocation(this.compositeProgram, 'resolution'),
      pointer: gl.getUniformLocation(this.compositeProgram, 'pointer'),
      time: gl.getUniformLocation(this.compositeProgram, 'time'),
    }

    // ribbon template: a triangle strip of (t, side) pairs along the thread
    const strip = new Float32Array((SEGMENTS + 1) * 4)
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS
      strip[i * 4 + 0] = t
      strip[i * 4 + 1] = 1
      strip[i * 4 + 2] = t
      strip[i * 4 + 3] = -1
    }
    this.stripVertices = (SEGMENTS + 1) * 2
    this.stripBuffer = createBuffer(gl, strip)
    this.stripVao = createVao(gl, () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stripBuffer)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    })

    // fullscreen triangle for the composite pass
    this.quadBuffer = createBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]))
    this.quadVao = createVao(gl, () => {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    })

    const target = this.createTarget()
    this.fbo = target.fbo
    this.colorTexture = target.texture
    this.depthBuffer = target.depth

    this.resize()
  }

  /**
   * Pointer position in normalized coordinates (0..1, top-left origin). Moving
   * the pointer engages the tangle; it settles once the pointer holds still.
   */
  setPointer(x: number, y: number): void {
    this.pointer = [x, 1 - y] // to uv space (y up)
    this.lastMoveTime = performance.now()
  }

  /** Drop the pointer so the lens leaves and the threads settle. */
  clearPointer(): void {
    this.pointer = [-1, 2]
    this.lastMoveTime = Number.NEGATIVE_INFINITY
  }

  /** Switch between the light (paper/ink) and dark (near-black/light) palettes. */
  setTheme(isDark: boolean): void {
    if (this.dark === isDark) return
    this.dark = isDark
    if (!this.raf) this.render() // reflect the swap while paused (reduced motion)
  }

  /**
   * Scroll progress: 0 at the top of the page, 1 at the bottom. Each lane
   * travels toward the centre as this rises, at its own speed.
   */
  setScroll(progress: number): void {
    this.converge = progress
    if (!this.raf) this.render() // reflect scroll while paused (reduced motion)
  }

  /** Match the drawing buffer + render target to the canvas CSS size. */
  resize(): void {
    if (this.disposed) return
    const width = Math.max(1, Math.round(this.canvas.clientWidth * this.pixelDensity))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * this.pixelDensity))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
      this.allocateTarget(width, height)
    }
    if (!this.raf) this.render() // keep a still frame current when paused
  }

  start(): void {
    if (this.disposed || this.raf) return
    this.lastFrameTime = performance.now()
    const loop = () => {
      this.updateProgress()
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  /** Draw a single still frame without starting the loop (reduced motion). */
  settle(): void {
    this.render(0)
  }

  private updateProgress(): void {
    const now = performance.now()
    const dt = clamp((now - this.lastFrameTime) / 1000, 0, 1 / 30)
    this.lastFrameTime = now
    const engaged = now - this.lastMoveTime < MOVE_TIMEOUT
    const rate = engaged ? PROGRESS_RISE_PER_SEC : -PROGRESS_FALL_PER_SEC
    this.progress = clamp(this.progress + rate * dt, 0, 1)
  }

  private render(timeOverride?: number): void {
    if (this.disposed) return
    const { gl } = this
    const time = timeOverride ?? (performance.now() - this.startTime) / 1000
    const w = this.canvas.width
    const h = this.canvas.height
    // theme palette: the casing must match the field so the weave masks cleanly
    const bg = this.dark ? PAPER_DARK : PAPER_COLOR
    const ink = this.dark ? INK_DARK : this.inkColor

    // --- weave into the offscreen target ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, w, h)
    gl.clearColor(bg[0], bg[1], bg[2], 1)
    gl.clearDepth(1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.enable(gl.DEPTH_TEST)

    gl.useProgram(this.threadProgram)
    gl.bindVertexArray(this.stripVao)
    const u = this.threadUniforms
    gl.uniform2f(u.resolution, w, h)
    gl.uniform1f(u.time, time)
    gl.uniform1f(u.tangle, easeInOut(this.progress))
    gl.uniform1f(u.lineCount, this.lineCount)
    gl.uniform1f(u.padLines, PAD_LINES)
    gl.uniform1f(u.converge, this.converge)

    // pass 1 — paper casing: writes depth only, establishes over/under
    gl.depthFunc(gl.LESS)
    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.uniform1f(u.halfWidth, CASING_HALF_WIDTH * this.pixelDensity)
    gl.uniform3f(u.color, bg[0], bg[1], bg[2])
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, this.stripVertices, this.instanceCount)

    // pass 2 — ink core: blended, occluded by nearer casings (the weave)
    gl.depthFunc(gl.LEQUAL)
    gl.depthMask(false)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.uniform1f(u.halfWidth, INK_HALF_WIDTH * this.pixelDensity)
    gl.uniform3f(u.color, ink[0], ink[1], ink[2])
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, this.stripVertices, this.instanceCount)

    gl.depthMask(true)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.bindVertexArray(null)

    // --- composite to screen through the glass lens ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.compositeProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    const c = this.compositeUniforms
    gl.uniform1i(c.tex, 0)
    gl.uniform2f(c.resolution, w, h)
    gl.uniform2f(c.pointer, this.pointer[0], this.pointer[1])
    gl.uniform1f(c.time, time)
    gl.bindVertexArray(this.quadVao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  private createTarget(): {
    fbo: WebGLFramebuffer
    texture: WebGLTexture
    depth: WebGLRenderbuffer
  } {
    const { gl } = this
    const fbo = gl.createFramebuffer()
    const texture = gl.createTexture()
    const depth = gl.createRenderbuffer()
    if (!fbo || !texture || !depth) throw new Error('Unable to create render target')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fbo, texture, depth }
  }

  private allocateTarget(width: number, height: number): void {
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.colorTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthBuffer)
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }

  /** Cancel the loop and release every GL resource. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    const { gl } = this
    gl.deleteBuffer(this.stripBuffer)
    gl.deleteVertexArray(this.stripVao)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteVertexArray(this.quadVao)
    gl.deleteFramebuffer(this.fbo)
    gl.deleteTexture(this.colorTexture)
    gl.deleteRenderbuffer(this.depthBuffer)
    gl.deleteProgram(this.threadProgram)
    gl.deleteProgram(this.compositeProgram)
  }
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Unable to create shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${log}`)
  }
  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create program')
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSrc)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link failed: ${log}`)
  }
  return program
}

function createBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer {
  const buffer = gl.createBuffer()
  if (!buffer) throw new Error('Unable to create buffer')
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
  return buffer
}

function createVao(gl: WebGL2RenderingContext, configure: () => void): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()
  if (!vao) throw new Error('Unable to create vertex array')
  gl.bindVertexArray(vao)
  configure()
  gl.bindVertexArray(null)
  return vao
}
