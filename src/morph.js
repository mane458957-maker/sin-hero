import * as THREE from 'three'
import logo from './logo.json'
import { RX, RZ, STRAP_A, STRAP_H, STRAP_R, STRAP_Y } from './cap.js'

/* Le logo et la languette sont un seul objet : une plaque découpée par un champ de distance.
   On mélange la distance au logo et la distance au rectangle, donc les lettres fondent
   réellement en bande, puis la plaque se courbe sur l'arrière de la casquette. */
const MARGIN = 0.03
const SLICES = 14

function edt1d(f, n, d, v, z) {
  let k = 0
  v[0] = 0
  z[0] = -1e20
  z[1] = 1e20
  for (let q = 1; q < n; q++) {
    let s
    do {
      const r = v[k]
      s = (f[q] - f[r] + q * q - r * r) / (2 * q - 2 * r)
    } while (s <= z[k] && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = 1e20
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const r = v[k]
    d[q] = (q - r) * (q - r) + f[r]
  }
}

function edt(grid, w, h) {
  const n = Math.max(w, h)
  const f = new Float64Array(n)
  const d = new Float64Array(n)
  const v = new Int32Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x]
  }
}

function logoField(width) {
  const all = logo.flatMap((l) => l.pts)
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const minY = Math.min(...all.map((p) => p[1]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const lw = maxX - minX
  const lh = maxY - minY
  const aspect = (lw * (1 + 2 * MARGIN)) / (lh + lw * 2 * MARGIN)
  const w = width
  const h = Math.round(width / aspect)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const s = w / (lw * (1 + 2 * MARGIN))
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#fff'
  for (const l of logo) {
    ctx.beginPath()
    l.pts.forEach(([x, y], i) => {
      const X = (x - minX + lw * MARGIN) * s
      const Y = h - (y - minY + lw * MARGIN) * s
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
    })
    ctx.closePath()
    ctx.fill()
  }
  const px = ctx.getImageData(0, 0, w, h).data
  const inside = new Float64Array(w * h)
  const outside = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const on = px[i * 4] > 127
    outside[i] = on ? 0 : 1e20
    inside[i] = on ? 1e20 : 0
  }
  edt(outside, w, h)
  edt(inside, w, h)
  const data = new Uint16Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const d = (Math.sqrt(outside[i]) - Math.sqrt(inside[i])) / h
      data[(h - 1 - y) * w + x] = THREE.DataUtils.toHalfFloat(d)
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.HalfFloatType)
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  return { tex, aspect }
}

export function buildMorph({ fieldWidth = 2048, envMap }) {
  const { tex, aspect } = logoField(fieldWidth)
  const strapLength = 2 * STRAP_A * ((RX + RZ) / 2) * STRAP_R
  const flatW = strapLength
  const flatH = flatW / aspect

  const base = new THREE.PlaneGeometry(1, 1, 120, 2)
  const geo = new THREE.InstancedBufferGeometry()
  geo.index = base.index
  geo.setAttribute('position', base.attributes.position)
  geo.setAttribute('normal', base.attributes.normal)
  geo.setAttribute('uv', base.attributes.uv)
  const slice = new Float32Array(SLICES)
  for (let i = 0; i < SLICES; i++) slice[i] = i / (SLICES - 1)
  geo.setAttribute('aSlice', new THREE.InstancedBufferAttribute(slice, 1))
  geo.instanceCount = SLICES

  const uniforms = {
    uField: { value: tex },
    uAspect: { value: aspect },
    uMelt: { value: 0 },
    uBend: { value: 0 },
    uFlatW: { value: flatW },
    uFlatH: { value: flatH },
    uDepth: { value: 0.07 },
    uGlow: { value: 1 },
    uTime: { value: 0 },
  }

  const mat = new THREE.MeshPhysicalMaterial({
    color: '#e1141e',
    roughness: 0.58,
    envMap,
    side: THREE.DoubleSide,
  })
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms)
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aSlice;
        uniform float uBend, uMelt, uFlatW, uFlatH, uDepth;
        varying vec2 vPlate; varying vec3 vT; varying vec3 vB;
        vec3 plate(vec2 p, out vec3 n, out vec3 t){
          float h = mix(uFlatH, ${STRAP_H.toFixed(4)}, smoothstep(.15, 1., uMelt));
          float a = ${Math.PI.toFixed(6)} + (p.x - .5) * 2. * ${STRAP_A.toFixed(5)};
          vec3 flatP = vec3(-(p.x - .5) * uFlatW, ${STRAP_Y.toFixed(4)} + (p.y - .5) * h, -${(RZ * STRAP_R).toFixed(4)});
          vec3 curveP = vec3(${(RX * STRAP_R).toFixed(4)} * sin(a), flatP.y, ${(RZ * STRAP_R).toFixed(4)} * cos(a));
          vec3 cn = normalize(vec3(sin(a) / ${RX.toFixed(3)}, 0., cos(a) / ${RZ.toFixed(3)}));
          n = normalize(mix(vec3(0., 0., -1.), cn, uBend));
          t = normalize(cross(vec3(0., 1., 0.), n));
          return mix(flatP, curveP, uBend);
        }`
      )
      .replace(
        '#include <beginnormal_vertex>',
        `vec3 pN, pT; vec3 pP = plate(uv, pN, pT);
        vec3 objectNormal = pN;`
      )
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = pP + pN * (aSlice - 1.) * uDepth;
        vPlate = uv;
        vT = normalize(normalMatrix * pT);
        vB = normalize(normalMatrix * vec3(0., 1., 0.));`
      )
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uField; uniform float uAspect, uMelt, uGlow, uTime;
        varying vec2 vPlate; varying vec3 vT; varying vec3 vB;
        float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise2(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3. - 2. * f);
          return mix(mix(hash2(i), hash2(i + vec2(1., 0.)), f.x), mix(hash2(i + vec2(0., 1.)), hash2(i + vec2(1., 1.)), f.x), f.y);
        }
        float fbm2(vec2 p){ return .55 * noise2(p) + .3 * noise2(p * 2.03) + .15 * noise2(p * 4.1); }
        float fieldAt(vec2 p){
          float d = texture2D(uField, p).r;
          vec2 q = abs((p - .5) * vec2(uAspect, 1.)) - vec2(uAspect * .5, .5);
          float box = max(q.x, q.y);
          /* la fonte part du centre et gagne les bords */
          float t = clamp(uMelt * 1.7 - abs(p.x - .5) * 1.4, 0., 1.);
          t = t * t * (3. - 2. * t);
          /* le bord du trait respire très légèrement, comme un tissu */
          float tissue = smoothstep(.55, 1., uMelt);
          box += noise2(vec2(p.x * 7.5, uTime * .5)) * .03 * tissue;
          return mix(d, box, t);
        }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dField = fieldAt(vPlate);
        if (dField > 0.) discard;`
      )
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          vec2 e = vec2(.0025, 0.);
          vec2 g = vec2(fieldAt(vPlate + e.xy) - fieldAt(vPlate - e.xy), fieldAt(vPlate + e.yx) - fieldAt(vPlate - e.yx));
          float rim = smoothstep(-.012, 0., dField);
          if (dot(g, g) > 1e-9) normal = normalize(mix(normal, normalize(vT * -g.x + vB * g.y), rim * .85));
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          /* sangle vivante : tissage de la vraie languette et reflet qui glisse le long du trait */
          vec3 flatRed = vec3(.6, .004, .009);
          vec2 q = vPlate * vec2(620., 132.);
          float row = floor(q.y / 3.14159);
          float warp = .5 + .5 * sin(q.x + mod(row, 2.) * 3.14159);
          float weft = .5 + .5 * sin(q.y);
          float cloth = .76 + .13 * warp * weft + .3 * (fbm2(vPlate * vec2(6., 1.2) + uTime * .1) - .5);
          /* deux rangs de couture, comme sur la languette */
          float seam = smoothstep(.022, .008, abs(abs(vPlate.y - .5) - .39)) * step(.3, fract(vPlate.x * 58.));
          cloth -= .2 * seam;
          float sweep = exp(-pow((vPlate.x - (fract(uTime * .13) * 1.5 - .25)) / .19, 2.));
          vec3 woven = flatRed * pow(cloth, 2.2) * 1.7 + vec3(.3, .03, .026) * sweep * (.6 + .4 * warp);
          totalEmissiveRadiance += mix(flatRed, woven, smoothstep(.55, 1., uMelt)) * uGlow;
        }`
      )
  }

  const mesh = new THREE.Mesh(geo, mat)
  mesh.frustumCulled = false

  return {
    mesh,
    material: mat,
    uniforms,
    flatW,
    flatH,
  }
}
