// Raw WebGL2 renderer for GlassPanel — a real lens instead of a CSS
// backdrop-filter trick. It samples another canvas (the WaterField
// background, registered via useGlassBackground) live, once per frame, and:
//   - bends the sampled UV inward near the rounded-rect edge, like light
//     refracting through a lens rim
//   - softens it with a cheap multi-tap blur (standing in for backdrop-blur)
//   - tints it toward the theme's card color so slotted text stays legible
//   - adds a top-down gloss and an inset edge highlight
// (grain is temporarily disabled — the hash-based version banded visibly
// instead of reading as noise; needs a better source before it comes back)
// Clipped to the panel's own rounded-rect via an SDF (discarding outside it)
// rather than relying on CSS overflow — the canvas itself is a plain
// rectangle covering the panel's bounding box.

const VERTEX_SHADER = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D uBg;
uniform vec2 uResolutionPx;   // this canvas's drawing-buffer size (px)
uniform float uDpr;           // this canvas's device pixel ratio
uniform vec2 uPanelViewport;  // this panel's top-left, viewport CSS px (top-left origin)
uniform vec2 uViewportCss;    // background canvas's CSS size (window inner size)
uniform float uRadiusCss;     // corner radius, CSS px
uniform vec3 uTint;           // theme card tint, so text stays legible

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Rounded-rect SDF: p relative to the rect's centre, b = half-size, r = corner radius.
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  // gl_FragCoord is bottom-left-origin, in this canvas's drawing-buffer px;
  // convert to a top-left-origin CSS-px coordinate local to the panel.
  vec2 cssPx = gl_FragCoord.xy / uDpr;
  vec2 panelCss = uResolutionPx / uDpr;
  vec2 local = vec2(cssPx.x, panelCss.y - cssPx.y);

  vec2 halfSize = panelCss * 0.5;
  vec2 centered = local - halfSize;
  float d = sdRoundRect(centered, halfSize, uRadiusCss);

  float mask = 1.0 - smoothstep(-1.0, 1.0, d);
  if (mask <= 0.001) discard;

  vec2 bgUV = (uPanelViewport + local) / uViewportCss;

  // Refract inward near the rim, like light bending through a lens edge.
  float edge = smoothstep(-28.0, 0.0, d);
  vec2 inward = -centered / max(length(centered), 1e-4);
  vec2 refractedUV = clamp(bgUV + inward * edge * 0.035, 0.0, 1.0);

  // Cheap frosted blur: average a ring of jittered taps around the refracted UV.
  vec3 col = vec3(0.0);
  const int TAPS = 8;
  for (int i = 0; i < TAPS; i++) {
    float a = 6.2831853 * float(i) / float(TAPS);
    vec2 off = vec2(cos(a), sin(a)) * (2.5 / uViewportCss);
    col += texture(uBg, clamp(refractedUV + off, 0.0, 1.0)).rgb;
  }
  col /= float(TAPS);

  // Frosted glass tint toward the theme's card color.
  col = mix(col, uTint, 0.4);

  // Top-down gloss — light catching the glass surface.
  col += smoothstep(1.0, 0.0, local.y / panelCss.y) * 0.1;

  // Inset edge highlight, standing in for the old inset box-shadows.
  col += (1.0 - smoothstep(0.0, 5.0, abs(d))) * 0.12;

  fragColor = vec4(col, mask);
}
`

export type GlassPanelOptions = {
  /** Corner radius in CSS px, matching the panel's own rounded-frame border-radius. */
  radius?: number
  /** Device-pixel multiplier for the drawing buffer (0.5–2). */
  pixelDensity?: number
}

// --color-paper / --color-ink-900 (dark's --color-surface-card) from main.css —
// kept as literal RGB here since the value also feeds a uniform outside the
// CSS cascade. Update both places together if the tokens change.
const LIGHT_TINT: readonly [number, number, number] = [0.9804, 0.9725, 0.949]
const DARK_TINT: readonly [number, number, number] = [0.0902, 0.0824, 0.0745]

export class GlassPanelRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly pixelDensity: number
  private readonly radiusCss: number

  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly texture: WebGLTexture
  private readonly uniforms: Record<string, WebGLUniformLocation | null>

  private dpr = 1
  private viewportX = 0
  private viewportY = 0
  private tint: readonly [number, number, number] = LIGHT_TINT

  constructor(canvas: HTMLCanvasElement, options: GlassPanelOptions = {}) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
    })
    if (!gl) throw new Error('WebGL2 unavailable')

    this.gl = gl
    this.canvas = canvas
    this.pixelDensity = options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 2)
    this.radiusCss = options.radius ?? 28

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('failed to create VAO')
    this.vao = vao

    this.texture = createBackgroundTexture(gl)

    this.uniforms = locations(gl, this.program, [
      'uBg',
      'uResolutionPx',
      'uDpr',
      'uPanelViewport',
      'uViewportCss',
      'uRadiusCss',
      'uTint',
    ])
  }

  /** Switch the frosted tint between the light and dark theme's card color. */
  setTheme(isDark: boolean): void {
    this.tint = isDark ? DARK_TINT : LIGHT_TINT
  }

  /** Update the panel's viewport-relative position (call every frame — cheap, and covers scrolling). */
  setPosition(rect: DOMRectReadOnly): void {
    this.viewportX = rect.left
    this.viewportY = rect.top
  }

  /** Resize the drawing buffer to match the panel's current CSS size, and reposition it. */
  resize(rect: DOMRectReadOnly): void {
    const { canvas, gl } = this
    const width = Math.max(1, Math.round(rect.width * this.pixelDensity))
    const height = Math.max(1, Math.round(rect.height * this.pixelDensity))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    this.dpr = this.pixelDensity
    gl.viewport(0, 0, width, height)
    this.setPosition(rect)
  }

  /** Sample `background` live and draw one frame. */
  render(background: HTMLCanvasElement): void {
    const { gl, uniforms } = this

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, background)

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.uniform1i(uniforms.uBg ?? null, 0)
    gl.uniform2f(uniforms.uResolutionPx ?? null, this.canvas.width, this.canvas.height)
    gl.uniform1f(uniforms.uDpr ?? null, this.dpr)
    gl.uniform2f(uniforms.uPanelViewport ?? null, this.viewportX, this.viewportY)
    gl.uniform2f(uniforms.uViewportCss ?? null, window.innerWidth, window.innerHeight)
    gl.uniform1f(uniforms.uRadiusCss ?? null, this.radiusCss)
    gl.uniform3f(uniforms.uTint ?? null, this.tint[0], this.tint[1], this.tint[2])

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** Release every GL resource. */
  dispose(): void {
    const { gl } = this
    gl.deleteTexture(this.texture)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }
}

function createBackgroundTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('failed to create texture')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  return texture
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
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

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('failed to create program')
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`program link failed: ${log ?? 'unknown'}`)
  }
  return program
}

function locations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: string[],
): Record<string, WebGLUniformLocation | null> {
  const out: Record<string, WebGLUniformLocation | null> = {}
  for (const name of names) out[name] = gl.getUniformLocation(program, name)
  return out
}
