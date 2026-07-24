// Raw WebGL2 renderer for the glass-lens cursor effect.
//
// Adapted from the regl "glass cursor" demo, reduced to the reusable lens:
// a full-screen quad whose sampled coordinates are refracted by a rounded
// capsule SDF centred on the pointer, plus a specular rim highlight. The
// refracted layer is either a supplied image (cover-fit) or a procedural
// grid so the effect is visible without an asset.

const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 position;
out vec2 uv;

void main() {
  uv = position;
  // fullscreen triangle: uv is (0,0) top-left .. (1,1) bottom-right
  gl_Position = vec4(2.0 * uv.x - 1.0, 1.0 - 2.0 * uv.y, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float time;
uniform vec2 mouseLoc;
uniform sampler2D txImage;
uniform vec2 imageResolution;
uniform float hasImage;

in vec2 uv;
out vec4 fragColor;

#define MOUSE_SIZE 0.05
#define MOUSE_EDGE 0.02
#define MOUSE_DISPLACEMENT_DIST 0.03
#define MOUSE_BASE_ALBEDO vec3(0.4)
#define MOUSE_BASE_ALPHA 0.15
#define MOUSE_SPECULAR_INTENSITY 5.0

vec2 ratioAdjust(vec2 p, float ratio) {
  return vec2(p.x * max(1.0, ratio), p.y * max(1.0, 1.0 / ratio));
}

// signed-distance + gradient of a circle; returns (d, normal.xy)
vec3 sdgCircle(in vec2 p, in vec2 c, in float r) {
  vec2 d = p - c;
  float len = length(d);
  return vec3(len - r, d / max(len, 1e-6));
}

// hard-edged impulse shaper: 0 for x < 0, quick rise then falloff
float expImpulse(float x, float k, float cut) {
  if (x < 0.0) return 0.0;
  float h = k * (x + cut);
  return h * exp(1.0 - h);
}

// subtle animated grid so the lens has something to refract without an image
vec3 proceduralBg(vec2 screenUV, float ratio) {
  vec2 g = ratioAdjust(screenUV, ratio) * 18.0 + vec2(time * 0.02, 0.0);
  vec2 grid = abs(fract(g) - 0.5);
  float line = smoothstep(0.46, 0.5, max(grid.x, grid.y));
  vec3 base = mix(vec3(0.07, 0.075, 0.095), vec3(0.10, 0.105, 0.13), screenUV.y);
  return base + line * 0.06;
}

vec3 backgroundColor(vec2 screenUV, float ratio) {
  if (hasImage > 0.5) {
    float imageRatio = imageResolution.x / imageResolution.y;
    // "cover" object-fit
    vec2 imgUV = vec2(
      0.5 + (screenUV.x - 0.5) * min(1.0, ratio / imageRatio),
      0.5 + (screenUV.y - 0.5) * min(1.0, imageRatio / ratio)
    );
    return texture(txImage, imgUV).rgb;
  }
  return proceduralBg(screenUV, ratio);
}

void main() {
  float ratio = resolution.x / resolution.y;
  vec2 p = ratioAdjust(uv, ratio);
  vec2 mouse = ratioAdjust(mouseLoc, ratio);

  // faux refraction: displace toward the lens centre, shaped by the SDF edge
  vec3 lens = sdgCircle(p, mouse, MOUSE_SIZE);
  vec2 dist = mouse - p;
  vec2 displacement = normalize(dist) * expImpulse(-lens.x / MOUSE_EDGE, 4.0, 0.175);

  vec2 distortedUV = uv + displacement * MOUSE_DISPLACEMENT_DIST;
  vec3 color = backgroundColor(distortedUV, ratio);

  // glass body tint + specular rim (light source from screen centre)
  vec4 mouseColor = vec4(MOUSE_BASE_ALBEDO, MOUSE_BASE_ALPHA);
  mouseColor = mix(
    mouseColor,
    vec4(vec3(MOUSE_SPECULAR_INTENSITY), 1.0),
    (smoothstep(-0.002, 0.0, lens.x) - smoothstep(0.0, 0.002, lens.x)) *
      abs(dot(lens.yz, normalize(vec2(0.5) - p)))
  );
  color = mix(color, mouseColor.rgb, mouseColor.a * smoothstep(0.0, -0.002, lens.x));

  fragColor = vec4(color, 1.0);
}
`

export type GlassCursorOptions = {
  /** Device-pixel multiplier for the drawing buffer. Clamped to [0.5, 2]. */
  pixelDensity?: number
}

type UniformLocations = {
  resolution: WebGLUniformLocation | null
  time: WebGLUniformLocation | null
  mouseLoc: WebGLUniformLocation | null
  txImage: WebGLUniformLocation | null
  imageResolution: WebGLUniformLocation | null
  hasImage: WebGLUniformLocation | null
}

export class GlassCursorRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly program: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly buffer: WebGLBuffer
  private readonly texture: WebGLTexture
  private readonly uniforms: UniformLocations
  private readonly pixelDensity: number

  private raf = 0
  private readonly startTime = performance.now()
  private mouse: [number, number] = [-1, -1]
  private imageResolution: [number, number] = [1, 1]
  private hasImage = false
  private disposed = false

  constructor(canvas: HTMLCanvasElement, options: GlassCursorOptions = {}) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true })
    if (!gl) throw new Error('WebGL2 is not supported in this environment')

    this.canvas = canvas
    this.gl = gl
    this.pixelDensity = clamp(options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 2), 0.5, 2)

    this.program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER)

    // fullscreen triangle in uv space (overscans the 0..1 viewport)
    this.buffer = createBuffer(gl, new Float32Array([-2, 0, 0, -2, 2, 2]))
    this.vao = createVao(gl, () => {
      const position = gl.getAttribLocation(this.program, 'position')
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    })

    this.texture = createPlaceholderTexture(gl)

    this.uniforms = {
      resolution: gl.getUniformLocation(this.program, 'resolution'),
      time: gl.getUniformLocation(this.program, 'time'),
      mouseLoc: gl.getUniformLocation(this.program, 'mouseLoc'),
      txImage: gl.getUniformLocation(this.program, 'txImage'),
      imageResolution: gl.getUniformLocation(this.program, 'imageResolution'),
      hasImage: gl.getUniformLocation(this.program, 'hasImage'),
    }

    this.resize()
  }

  /** Pointer position in normalized coordinates (0..1, top-left origin). */
  setMouse(x: number, y: number): void {
    this.mouse = [x, y]
  }

  /** Reset the pointer off-screen so the lens disappears. */
  clearMouse(): void {
    this.mouse = [-1, -1]
  }

  /** Upload a loaded image as the refracted background (cover-fit). */
  setImage(image: HTMLImageElement | ImageBitmap): void {
    if (this.disposed) return
    const { gl } = this
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    this.imageResolution = [image.width, image.height]
    this.hasImage = true
  }

  /** Fall back to the procedural grid background. */
  clearImage(): void {
    this.hasImage = false
  }

  /** Match the drawing buffer to the canvas's CSS size × pixel density. */
  resize(): void {
    if (this.disposed) return
    const width = Math.max(1, Math.round(this.canvas.clientWidth * this.pixelDensity))
    const height = Math.max(1, Math.round(this.canvas.clientHeight * this.pixelDensity))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  start(): void {
    if (this.disposed || this.raf) return
    const loop = () => {
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  private render(): void {
    if (this.disposed) return
    const { gl, uniforms } = this

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)

    gl.uniform1i(uniforms.txImage, 0)
    gl.uniform2f(uniforms.resolution, this.canvas.width, this.canvas.height)
    gl.uniform1f(uniforms.time, (performance.now() - this.startTime) / 1000)
    gl.uniform2f(uniforms.mouseLoc, this.mouse[0], this.mouse[1])
    gl.uniform2f(uniforms.imageResolution, this.imageResolution[0], this.imageResolution[1])
    gl.uniform1f(uniforms.hasImage, this.hasImage ? 1 : 0)

    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.bindVertexArray(null)
  }

  /** Cancel the loop and release every GL resource. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.stop()
    const { gl } = this
    gl.deleteTexture(this.texture)
    gl.deleteBuffer(this.buffer)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
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

function createProgram(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error('Unable to create program')
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSrc)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  // shaders can be flagged for deletion once linked
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

function createPlaceholderTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Unable to create texture')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  // 1x1 opaque pixel until a real image is uploaded
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 26, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}
