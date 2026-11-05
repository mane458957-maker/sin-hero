/* Fond de l'ouverture : des fils rouges flottent derrière le logo, puis se resserrent sur le trait.
   Un simple plein écran en WebGL, sans Three.js : il tourne en continu, il doit rester léger. */
const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'

const FRAGMENT = `precision highp float;
uniform vec2 uRes;
uniform float uTime, uFocus, uFocusY, uLevel;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float unit = min(uRes.x, uRes.y * 1.6);
  vec2 p = (gl_FragCoord.xy - .5 * uRes) / unit;
  float glow = 0.;
  for (int k = 0; k < 14; k++) {
    float f = float(k);
    float r = hash(vec2(f, 2.));
    float spread = (r - .5) * .62 * uRes.y / unit;
    float amp = (.05 + .09 * hash(vec2(f, 5.))) * (1. - .8 * uFocus);
    float wave = amp * sin(p.x * (4. + r * 5.) + uTime * (.3 + r * .35) + r * 6.28);
    float open = .35 + .65 * smoothstep(0., .62, abs(p.x));
    float line = mix(spread * open, uFocusY + spread * .1, uFocus) + wave;
    glow += .0007 / (abs(p.y - line) + .0014) * (.4 + .6 * r);
  }
  gl_FragColor = vec4(vec3(.82, .06, .09) * min(glow, 1.) * .6 * uLevel, 1.);
}`

export function createThreads(canvas, { maxRatio }) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false })
  if (!gl) return { resize() {}, draw() {} }

  const shader = (type, source) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, source)
    gl.compileShader(s)
    return s
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
  gl.linkProgram(program)
  gl.useProgram(program)

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'a')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(program, 'uRes')
  const uTime = gl.getUniformLocation(program, 'uTime')
  const uFocus = gl.getUniformLocation(program, 'uFocus')
  const uFocusY = gl.getUniformLocation(program, 'uFocusY')
  const uLevel = gl.getUniformLocation(program, 'uLevel')
  let focusY = 0

  return {
    /* y : position du trait en pixels depuis le haut de l'écran */
    resize(w, h, y) {
      const ratio = Math.min(devicePixelRatio || 1, maxRatio)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      focusY = (h / 2 - y) / Math.min(w, h * 1.6)
    },
    draw(time, focus, level) {
      gl.uniform1f(uTime, time)
      gl.uniform1f(uFocus, focus)
      gl.uniform1f(uFocusY, focusY)
      gl.uniform1f(uLevel, level)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
  }
}
