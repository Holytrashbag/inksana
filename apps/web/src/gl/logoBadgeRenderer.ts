// three.js renderer for the "logo badge" background — a third-plus pitch for the
// studio landing page (route /home3).
//
// NOTE: the web app's convention is raw WebGL2 (no Three.js). This module is a
// deliberate, user-requested exception so the real logo mesh can be loaded from
// a glTF binary rather than reconstructed as an SDF.
//
// The Inksana signet is loaded from apps/web/assets/logo-symbol.glb (a solid,
// extruded mesh — positions only, no normals) and rendered as a sharp-edged
// metal badge: a custom ShaderMaterial derives flat, faceted normals per
// fragment (screen-space derivatives) so every extrusion facet catches light
// crisply, then runs the lit tone through a pencil cross-hatch post — ported
// from webgl-shaders.com/pencil-example.html — over the studio's warm paper.
// The badge idles with a slow tilt; the pointer parallax-tilts it. Lives behind
// the useLogoBadge composable; owns its GL/three resources and frees them on
// dispose().

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import glbUrl from '../../assets/logo-symbol.glb?url'

type LogoBadgeOptions = {
  /** Device-pixel multiplier for the drawing buffer (0.5–2). */
  pixelDensity?: number
}

export type { LogoBadgeOptions }

/** World-space size the mesh's largest dimension is scaled to. */
const TARGET_SIZE = 1.7

// Shared pencil GLSL (studio palette + the webgl-shaders cross-hatch), injected
// into both the badge material and the paper background.
const PENCIL_COMMON = /* glsl */ `
const vec3 PAPER = vec3(0.980, 0.972, 0.949);
const vec3 GRAPHITE = vec3(0.098, 0.090, 0.082);
const vec3 STEEL = vec3(0.62, 0.66, 0.72);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

mat2 rot2(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }

float horizontalLine(vec2 px, float y, float width) {
  return 1.0 - smoothstep(-1.0, 1.0, abs(px.y - y) - 0.5 * width);
}

// df: surface tone in 0..1 (1 = bright -> few strokes, 0 = dark -> dense strokes)
float pencilTone(vec2 fpx, float df) {
  vec2 pos = rot2(radians(20.0)) * fpx;
  float lw = 7.0 * (1.0 - smoothstep(0.0, 0.3, df)) + 0.5;

  float sep = 16.0;
  vec2 g = vec2(pos.x, mod(pos.y, sep));
  float l1 = horizontalLine(g, sep * 0.5, lw);
  g.y = mod(pos.y + sep * 0.5, sep);
  float l2 = horizontalLine(g, sep * 0.5, lw);

  pos = rot2(radians(-50.0)) * pos;
  sep = 12.0;
  g = vec2(pos.x, mod(pos.y, sep));
  float l3 = horizontalLine(g, sep * 0.5, lw);
  g.y = mod(pos.y + sep * 0.5, sep);
  float l4 = horizontalLine(g, sep * 0.5, lw);

  float c = 1.0;
  c -= 0.8 * l1 * (1.0 - smoothstep(0.5, 0.75, df));
  c -= 0.8 * l2 * (1.0 - smoothstep(0.4, 0.5, df));
  c -= 0.8 * l3 * (1.0 - smoothstep(0.4, 0.65, df));
  c -= 0.8 * l4 * (1.0 - smoothstep(0.2, 0.4, df));
  return clamp(c, 0.05, 1.0);
}
`

// three's GLSL3 prefix supplies the built-in attributes/uniforms and maps
// `varying`, but it does NOT declare a fragment output — we declare our own.
const BADGE_VERT = /* glsl */ `
out vec3 vViewPos;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const BADGE_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uResolution;
uniform float uPixelDensity;
in vec3 vViewPos;
out vec4 outColor;

${PENCIL_COMMON}

void main() {
  // flat, faceted normal from screen-space derivatives -> sharp metal edges
  vec3 n = normalize(cross(dFdx(vViewPos), dFdy(vViewPos)));
  vec3 v = normalize(-vViewPos); // surface -> camera (view space)
  if (dot(n, v) < 0.0) n = -n;   // derivative sign can flip; keep it camera-facing

  vec3 ldir = normalize(vec3(-0.45, 0.75, 0.65));
  float diff = max(dot(n, ldir), 0.0);
  vec3 hlf = normalize(ldir + v);
  float spec = pow(max(dot(n, hlf), 0.0), 48.0);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);

  // metallic environment: reflect into a simple studio gradient (bright above)
  vec3 r = reflect(-v, n);
  float env = smoothstep(-0.6, 0.9, r.y);
  float metal = env * env;

  float shade = 0.16 + 0.42 * diff + 0.62 * spec + 0.44 * metal - 0.18 * fres;
  float df = clamp(shade, 0.0, 1.0);

  vec2 fpx = (gl_FragCoord.xy - 0.5 * uResolution) / uPixelDensity;
  float tone = pencilTone(fpx, df);

  vec3 col = mix(GRAPHITE, PAPER, tone);
  col = mix(col, STEEL, spec * 0.18);          // faint metallic sheen
  col *= 1.0 - 0.06 * hash(gl_FragCoord.xy);    // graphite grain
  outColor = vec4(col, 1.0);
}
`

const BG_VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
out vec4 outColor;

${PENCIL_COMMON}

void main() {
  float m = min(uResolution.x, uResolution.y);
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / m;

  vec3 col = PAPER;
  col -= (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.02; // paper grain
  col *= mix(0.9, 1.0, smoothstep(1.4, 0.2, length(uv)));     // soft vignette
  outColor = vec4(col, 1.0);
}
`

// Cursor indicator: a circular patch of the same pencil cross-hatch that tracks
// the pointer — a defined circle with hatching filling the area, denser toward
// the centre. Drawn as a transparent overlay after the badge, so it stays
// visible over the metal, and its hatch aligns with the badge's for coherence.
const RING_FRAG = /* glsl */ `
precision highp float;
uniform vec2 uResolution;
uniform vec2 uMouse;         // -1..1, y up (matches uv space below)
uniform float uPointerAlpha; // 0..1 fade as the pointer enters / leaves
uniform float uPixelDensity;
out vec4 outColor;

${PENCIL_COMMON}

void main() {
  float m = min(uResolution.x, uResolution.y);
  vec2 uv = (2.0 * gl_FragCoord.xy - uResolution) / m;
  vec2 mp = uMouse * (uResolution / m);   // mouse into the same centred uv space
  float r = length(uv - mp);
  float R = 0.2;

  // soft circular mask; hatch denser (darker) toward the centre
  float mask = smoothstep(R, R * 0.5, r);
  float df = mix(0.25, 0.9, clamp(r / R, 0.0, 1.0));
  vec2 fpx = (gl_FragCoord.xy - 0.5 * uResolution) / uPixelDensity;
  float ink = 1.0 - pencilTone(fpx, df); // cross-hatch coverage in the disc

  float alpha = clamp(ink * mask, 0.0, 1.0) * 0.7 * uPointerAlpha;
  if (alpha < 0.002) discard;
  outColor = vec4(GRAPHITE, alpha);
}
`

export class LogoBadgeRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private readonly pixelDensity: number

  private readonly scene = new THREE.Scene()
  private readonly camera: THREE.PerspectiveCamera

  private readonly bgScene = new THREE.Scene()
  private readonly bgCamera = new THREE.Camera()
  private readonly bgMaterial: THREE.ShaderMaterial

  private readonly badgeMaterial: THREE.ShaderMaterial
  private model: THREE.Group | null = null

  private readonly ringScene = new THREE.Scene()
  private readonly ringMaterial: THREE.ShaderMaterial

  // held directly so updates avoid index-into-uniforms; the Vector2 is shared
  // between both materials, so one set() resizes the badge and the paper.
  private readonly uResolution = new THREE.Vector2(1, 1)
  private readonly uTime = { value: 0 }
  private readonly uMouse = new THREE.Vector2(0, 0)
  private readonly uPointerAlpha = { value: 0 }

  private px = 0
  private py = 0
  private tx = 0 // eased pointer (badge tilt)
  private ty = 0
  private hasPointer = false
  private pa = 0 // eased pointer presence (ring fade)

  private readonly t0 = performance.now()
  private last = performance.now()
  private rafId = 0
  private running = false
  private disposed = false

  constructor(canvas: HTMLCanvasElement, options: LogoBadgeOptions = {}) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    if (!renderer.capabilities.isWebGL2) {
      renderer.dispose()
      throw new Error('WebGL2 unavailable')
    }
    this.renderer = renderer
    this.pixelDensity = options.pixelDensity ?? Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(this.pixelDensity)
    renderer.autoClear = false

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    this.camera.position.set(0, 0, 3.2)

    this.bgMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uResolution: { value: this.uResolution },
        uTime: this.uTime,
      },
    })
    const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bgMaterial)
    bgQuad.frustumCulled = false
    this.bgScene.add(bgQuad)

    this.badgeMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BADGE_VERT,
      fragmentShader: BADGE_FRAG,
      uniforms: {
        uResolution: { value: this.uResolution },
        uPixelDensity: { value: this.pixelDensity },
      },
    })

    this.ringMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BG_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uResolution: { value: this.uResolution },
        uMouse: { value: this.uMouse },
        uPointerAlpha: this.uPointerAlpha,
        uPixelDensity: { value: this.pixelDensity },
      },
    })
    const ringQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.ringMaterial)
    ringQuad.frustumCulled = false
    this.ringScene.add(ringQuad)

    this.resize()
    this.loadModel()
  }

  // --- public API ------------------------------------------------------------

  /** Pointer in 0..1 viewport coords (x = clientX/innerWidth, y = clientY/innerHeight). */
  setPointer(x: number, y: number): void {
    this.px = this.clamp(x * 2 - 1, -1, 1)
    this.py = this.clamp((1 - y) * 2 - 1, -1, 1) // y up
    this.hasPointer = true
  }

  clearPointer(): void {
    // keep px/py so the ring fades in place; the tilt returns to centre via
    // the hasPointer-gated target in the frame loop.
    this.hasPointer = false
  }

  start(): void {
    if (this.running || this.disposed) return
    this.running = true
    this.last = performance.now()
    this.rafId = requestAnimationFrame(this.frame)
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  /** Reduced-motion: present a single calm frame with no animation or tilt. */
  settle(): void {
    this.tx = 0
    this.ty = 0
    this.applyOrientation(0)
    this.renderOnce(0)
  }

  resize(): void {
    if (this.disposed) return
    const w = window.innerWidth
    const h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.renderer.getDrawingBufferSize(this.uResolution)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (!this.running) this.renderOnce((performance.now() - this.t0) / 1000)
  }

  dispose(): void {
    this.disposed = true
    this.stop()
    this.disposeModel()
    this.bgMaterial.dispose()
    this.badgeMaterial.dispose()
    this.ringMaterial.dispose()
    for (const scene of [this.bgScene, this.ringScene]) {
      for (const obj of scene.children) {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose()
      }
    }
    this.renderer.dispose()
  }

  // --- loading ---------------------------------------------------------------

  private loadModel(): void {
    new GLTFLoader().load(
      glbUrl,
      (gltf) => {
        if (this.disposed) return
        const root = gltf.scene
        // positions-only mesh: use our faceted pencil material everywhere
        root.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = this.badgeMaterial
        })
        // centre + scale the mesh to a consistent on-screen size
        const box = new THREE.Box3().setFromObject(root)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        root.position.sub(center)
        const model = new THREE.Group()
        model.add(root)
        model.scale.setScalar(TARGET_SIZE / Math.max(size.x, size.y, size.z))
        this.model = model
        this.scene.add(model)
        // draw the arrived badge once even when idle (reduced motion / paused)
        if (!this.running) this.renderOnce((performance.now() - this.t0) / 1000)
      },
      undefined,
      (error) => console.warn('[LogoBadge] glb load failed:', error),
    )
  }

  // --- loop ------------------------------------------------------------------

  private readonly frame = (now: number): void => {
    if (!this.running) return
    let dt = (now - this.last) / 1000
    if (dt > 0.1) dt = 0.1
    this.last = now
    const k = 1 - Math.exp(-dt * 6)
    // badge tilt eases back to centre when the pointer leaves; the ring stays
    // put and fades out via its presence value instead.
    const tiltX = this.hasPointer ? this.px : 0
    const tiltY = this.hasPointer ? this.py : 0
    this.tx += (tiltX - this.tx) * k
    this.ty += (tiltY - this.ty) * k
    this.pa += ((this.hasPointer ? 1 : 0) - this.pa) * k
    const time = (now - this.t0) / 1000
    this.applyOrientation(time)
    this.renderOnce(time)
    this.rafId = requestAnimationFrame(this.frame)
  }

  private applyOrientation(time: number): void {
    if (!this.model) return
    this.model.rotation.y = 0.34 * Math.sin(time * 0.3) + this.tx * 0.6
    this.model.rotation.x = 0.15 * Math.sin(time * 0.23) - this.ty * 0.4
  }

  private renderOnce(time: number): void {
    const { renderer } = this
    this.uTime.value = time
    this.uMouse.set(this.px, this.py)
    this.uPointerAlpha.value = this.pa
    renderer.clear()
    renderer.render(this.bgScene, this.bgCamera)
    renderer.render(this.scene, this.camera)
    renderer.render(this.ringScene, this.bgCamera)
  }

  // --- helpers ---------------------------------------------------------------

  private disposeModel(): void {
    if (!this.model) return
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose()
    })
    this.scene.remove(this.model)
    this.model = null
  }

  private clamp(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
  }
}
