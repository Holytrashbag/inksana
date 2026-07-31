import FragmentCanvas from 'https://esm.sh/fragment-canvas@1.0.7'

const fragmentShader = `
    precision mediump float;

    uniform vec2 iResolution;
    uniform float iTime;

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

    void main(void) {
        vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
        uv *= 0.5;

        vec2 q = vec2(
            fbm(uv + 0.20 * iTime),
            fbm(uv + vec2(5.0, 1.0))
        );
        vec2 r = vec2(
            fbm(uv + 3.0 * q + vec2(1.2, 3.2) + 0.2 * iTime),
            fbm(uv + 3.0 * q + vec2(8.8, 2.8) + 0.2 * iTime)
        );
        
        float f = fbm(uv + r);
        
        vec3 color = mix(
            vec3(0.0, 0.0, 0.0),
            vec3(0.0, 0.0, 1.0),
            clamp((f * f) * 6.0, 0.0, 5.0)
        );

        color = mix(
            color,
            vec3(1.0, 0.0, 1.0),
            clamp(length(q) * length(q), 0.0, 1.0)
        );

        color = mix(
            color,
            vec3(1, 1, 0.8),
            clamp(length(r.x), 0.0, 0.1)
        );

        color = vec3(0.2, 0.0, 0.15) + (f * f * f + 0.6 * f * f + 0.6 * f) * color;

        gl_FragColor = vec4(color, 1.0);
    }
`

new FragmentCanvas(canvas, {
  fragmentShader,
  uniforms: {
    offset: (gl, location, time) => gl.uniform1f(location, Math.cos(time / 1000) * 1.0),
  },
})

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio
  canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio
}

resizeCanvas()

addEventListener('resize', resizeCanvas)
