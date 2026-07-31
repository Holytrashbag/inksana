// Raw WebGL2 renderer for SmokeButton — a domain-warped fbm ("smoke")
// plasma, filling a canvas that sits behind the button's label. Unlike
// GlassPanel/GlassButton this doesn't sample the page background or clip
// itself to a rounded rect in the shader: it just paints a fullscreen
// animated field, and the button's own `overflow-hidden rounded-*` clips it
// via plain CSS (same trick the shader's original reference used).
// Colors read as "ink diffusing into paper" — near-black ink swirling
// through the user's chosen accent hue, flaring to paper-white at the
// hottest wisps — rather than the reference's fixed blue/magenta/yellow.

const VERTEX_SHADER = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 uResolutionPx;  // drawing-buffer size (px)
uniform float uTime;         // seconds
uniform vec3 uAccent;        // saturated ink accent (0..1 rgb)
uniform float uHover;        // 0..1, eased hover/focus amount

out vec4 fragColor;

float random(vec2 pos) {
  return fract(sin(dot(pos, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 pos) {
  vec2 i = floor(pos);
  vec2 f = fract(pos);
  float a = random(i + vec2(0.0, 0.0));
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 pos) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(20.0);
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
  for (int i = 0; i < 8; i++) {
    v += a * noise(pos);
    pos = rot * pos * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolutionPx) / uResolutionPx.y;
  uv *= 0.5;

  // Hovering speeds the swirl up a little, so the button visibly "reacts".
  float speed = mix(0.2, 0.34, uHover);
  vec2 q = vec2(fbm(uv + speed * uTime), fbm(uv + vec2(5.0, 1.0)));
  vec2 r = vec2(
    fbm(uv + 3.0 * q + vec2(1.2, 3.2) + speed * uTime),
    fbm(uv + 3.0 * q + vec2(8.8, 2.8) + speed * uTime)
  );
  float f = fbm(uv + r);

  vec3 ink = vec3(0.0510, 0.0471, 0.0431);   // --color-ink-950
  vec3 paper = vec3(0.9804, 0.9725, 0.9490); // --color-paper
  vec3 hot = mix(uAccent, paper, 0.55);

  vec3 color = mix(ink, uAccent, clamp(f * f * 6.0, 0.0, 1.0));
  color = mix(color, hot, clamp(length(q) * length(q), 0.0, 1.0));
  color = mix(color, paper, clamp(length(r.x), 0.0, 0.1));

  color = ink * 0.15 + (f * f * f + 0.6 * f * f + 0.6 * f) * (1.0 + uHover * 0.35) * color;

  fragColor = vec4(color, 1.0);
}
`

export type SmokeButtonOptions = {
  /** Device-pixel multiplier for the drawing buffer (0.5–2). */
  pixelDensity?: number
}

export class SmokeButtonRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly pixelDensity: number

  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly uniforms: Record<string, WebGLUniformLocation | null>

  private accent: readonly [number, number, number] = [0.851, 0.812, 0.761]
  private hover = 0

  constructor(canvas: HTMLCanvasElement, options: SmokeButtonOptions = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) throw new Error('WebGL2 unavailable')

    this.gl = gl
    this.canvas = canvas
    this.pixelDensity = options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 2)

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('failed to create VAO')
    this.vao = vao

    this.uniforms = locations(gl, this.program, ['uResolutionPx', 'uTime', 'uAccent', 'uHover'])
  }

  /** Set the plasma's accent hue (0..1 RGB) — the user's chosen, saturated ink accent. */
  setAccent(rgb: readonly [number, number, number]): void {
    this.accent = rgb
  }

  /** Set the eased 0..1 hover/focus amount driving swirl speed and brightness. */
  setHover(value: number): void {
    this.hover = value
  }

  /** Resize the drawing buffer to match the canvas's current CSS size. */
  resize(width: number, height: number): void {
    const { canvas, gl } = this
    const w = Math.max(1, Math.round(width * this.pixelDensity))
    const h = Math.max(1, Math.round(height * this.pixelDensity))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
  }

  /** Draw one frame at `timeSeconds`. */
  render(timeSeconds: number): void {
    const { gl, uniforms } = this

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.uniform2f(uniforms.uResolutionPx ?? null, this.canvas.width, this.canvas.height)
    gl.uniform1f(uniforms.uTime ?? null, timeSeconds)
    gl.uniform3f(uniforms.uAccent ?? null, this.accent[0], this.accent[1], this.accent[2])
    gl.uniform1f(uniforms.uHover ?? null, this.hover)

    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  /** Release every GL resource. */
  dispose(): void {
    const { gl } = this
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }
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
