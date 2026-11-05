import * as THREE from 'three'
import logo from './logo.json'

/* Casquette modélisée d'après les photos produit : avant à +z, dessus à +y.
   Coutures : panneau avant large (2 œillets), 2 côtés, 2 arrière. */
export const RX = 0.9
export const RZ = 1.03
export const H = 1.14
export const ARCH_W = (50 * Math.PI) / 180
export const ARCH_V = 0.19
export const STRAP_Y = 0.075
export const STRAP_H = 0.115
const DEG = Math.PI / 180
const SEAMS = [-180, -110, -38, 38, 110, 180].map((d) => d * DEG)
const EYELETS = [-145, -74, -18, 18, 74, 145].map((d) => d * DEG)
const EYELET_V = 0.6
const LOGO_TH = 106 * DEG
const LOGO_V = 0.125

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function seamDistance(th) {
  let d = Infinity
  for (const s of SEAMS) d = Math.min(d, Math.abs(wrap(th - s)))
  return d
}

function bottomV(th) {
  const d = Math.abs(wrap(th - Math.PI))
  return d < ARCH_W ? ARCH_V * Math.pow(Math.cos(((d / ARCH_W) * Math.PI) / 2), 0.55) : 0
}

export function crownPoint(th, v, lift = 0, out = new THREE.Vector3()) {
  const phi = (v * Math.PI) / 2
  const c = Math.max(0, Math.cos(phi))
  const s = Math.sin(phi)
  const back = 0.5 - 0.5 * Math.cos(th)
  const radial = Math.pow(c, 0.64 + 0.14 * back)
  const y = H * Math.pow(s, 0.94) * (1 + 0.035 * Math.cos(th)) - 0.05 * Math.sin(th) ** 2 * (1 - v)

  const d = seamDistance(th)
  const fade = smooth(0, 0.12, v) * smooth(1, 0.86, v)
  const pillow = 0.022 * smooth(0, 0.42, d) * fade - 0.007 * Math.exp(-((d * radial * 42) ** 2)) * fade

  const r = 1 + pillow + lift
  return out.set(RX * radial * Math.sin(th) * r, y + (pillow + lift) * s, RZ * radial * Math.cos(th) * r + 0.07 * s)
}

function heightToNormal(ctx, w, h, strength) {
  const src = ctx.getImageData(0, 0, w, h).data
  const out = new Uint8Array(w * h * 4)
  const at = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const il = 1 / Math.hypot(dx, dy, 255)
      const i = (y * w + x) * 4
      out[i] = (dx * il * 0.5 + 0.5) * 255
      out[i + 1] = (dy * il * 0.5 + 0.5) * 255
      out[i + 2] = (il * 255 * 0.5 + 0.5) * 255
      out[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat)
  t.flipY = true
  t.wrapS = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

function makeCanvas(w, h, fill) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, w, h)
  return [c, ctx]
}

function crownTextures(size) {
  const w = size
  const h = size / 2
  const [, hc] = makeCanvas(w, h, '#808080')
  const [ac, cc] = makeCanvas(w, h, '#d8d8d8')
  const U = (th) => ((wrap(th) + Math.PI) / (2 * Math.PI)) * w
  const V = (v) => (1 - v) * h
  const px = w / 4096
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()

  const stroke = (pts, width, height, tone) => {
    for (const [ctx, col] of [[hc, height], [cc, tone]]) {
      if (!col) continue
      ctx.strokeStyle = col
      ctx.lineWidth = width * px
      ctx.lineCap = 'round'
      ctx.beginPath()
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.stroke()
    }
  }

  /* points de couture : pas constant en distance réelle, pas en UV */
  const stitches = (path) => {
    let acc = 0
    let on = true
    let run = []
    for (let i = 1; i < path.length; i++) {
      crownPoint(path[i - 1][0], path[i - 1][1], 0, a)
      crownPoint(path[i][0], path[i][1], 0, b)
      acc += a.distanceTo(b)
      const p = [U(path[i][0]), V(path[i][1])]
      if (on) run.push(p)
      if (acc > (on ? 0.021 : 0.008)) {
        if (on && run.length > 1) stroke(run, 3.2, '#c4c4c4', '#ececec')
        acc = 0
        on = !on
        run = on ? [p] : []
      }
    }
  }

  const span = (th, v0, v1, off) => {
    const pts = []
    for (let i = 0; i <= 500; i++) {
      const v = v0 + ((v1 - v0) * i) / 500
      const radial = Math.max(0.08, Math.pow(Math.cos((v * Math.PI) / 2), 0.6))
      pts.push([th + off / radial, v])
    }
    return pts
  }

  for (const s of SEAMS) {
    if (s === -Math.PI) continue
    const v0 = Math.abs(wrap(s - Math.PI)) < 0.01 ? ARCH_V + 0.01 : 0.03
    const groove = span(s, v0, 0.985, 0).map(([t, v]) => [U(t), V(v)])
    const line = (pts) => {
      const left = pts.filter(([x]) => x > w / 2)
      const right = pts.filter(([x]) => x <= w / 2)
      return [left, right]
    }
    for (const part of line(groove)) if (part.length > 1) stroke(part, 7, '#3c3c3c', '#a6a6a6')
    for (const off of [-0.018, 0.018]) {
      const p = span(s, v0, 0.97, off)
      stitches(p)
    }
  }

  /* rang de piqûre au-dessus du bord, et double rang le long de la voûte arrière */
  const around = (dv) => {
    const pts = []
    for (let i = 0; i <= 2400; i++) {
      const th = -Math.PI + (i / 2400) * 2 * Math.PI
      pts.push([th, bottomV(th) + dv])
    }
    return pts
  }
  stitches(around(0.032))
  stitches(around(0.05).filter(([th]) => Math.abs(wrap(th - Math.PI)) < ARCH_W + 0.1))

  for (const th of EYELETS) {
    const radial = Math.pow(Math.cos((EYELET_V * Math.PI) / 2), 0.6)
    const rw = (0.03 / (2 * Math.PI * RX * radial)) * w
    const rh = (0.03 / (H * 1.55)) * h
    const x = U(th)
    const y = V(EYELET_V)
    hc.fillStyle = '#d2d2d2'
    hc.beginPath()
    hc.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2)
    hc.fill()
    hc.fillStyle = '#2a2a2a'
    hc.beginPath()
    hc.ellipse(x, y, rw * 0.42, rh * 0.42, 0, 0, Math.PI * 2)
    hc.fill()
    cc.fillStyle = '#bcbcbc'
    cc.beginPath()
    cc.ellipse(x, y, rw, rh, 0, 0, Math.PI * 2)
    cc.fill()
    cc.fillStyle = '#141414'
    cc.beginPath()
    cc.ellipse(x, y, rw * 0.42, rh * 0.42, 0, 0, Math.PI * 2)
    cc.fill()
  }

  const normal = heightToNormal(hc, w, h, 2.4)
  const map = new THREE.CanvasTexture(ac)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.anisotropy = 8
  return { map, normal }
}

function visorTextures(size) {
  const w = size
  const h = size / 2
  const [, hc] = makeCanvas(w, h, '#808080')
  const [ac, cc] = makeCanvas(w, h, '#d8d8d8')
  const px = w / 2048
  /* v de la texture : 0 = crown, 0.5 = bord, >0.5 = dessous */
  for (const row of [0.46, 0.42, 0.38, 0.34, 0.3]) {
    const y = (1 - row) * h
    hc.fillStyle = '#5c5c5c'
    hc.fillRect(0, y - 3 * px, w, 6 * px)
    for (let x = 0; x < w; x += 13 * px) {
      hc.fillStyle = '#c8c8c8'
      hc.fillRect(x, y - 1.6 * px, 9 * px, 3.2 * px)
      cc.fillStyle = '#ececec'
      cc.fillRect(x, y - 1.2 * px, 9 * px, 2.4 * px)
    }
  }
  const normal = heightToNormal(hc, w, h, 2)
  const map = new THREE.CanvasTexture(ac)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = 8
  return { map, normal }
}

function crownGeometry(nu, nv) {
  const pos = []
  const uv = []
  const idx = []
  const p = new THREE.Vector3()
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const th = -Math.PI + (i / nu) * 2 * Math.PI
      const vb = bottomV(th)
      const v = vb + (1 - vb) * Math.pow(j / nv, 0.9) * 0.9995
      crownPoint(th, v, 0, p)
      pos.push(p.x, p.y, p.z)
      uv.push(i / nu, v)
    }
  }
  const row = nu + 1
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * row + i
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  /* soude les normales de la couture arrière (premier et dernier sommet de chaque rang) */
  const n = g.attributes.normal
  for (let j = 0; j <= nv; j++) {
    const a = j * row
    const b = a + nu
    const x = n.getX(a) + n.getX(b)
    const y = n.getY(a) + n.getY(b)
    const z = n.getZ(a) + n.getZ(b)
    const l = Math.hypot(x, y, z) || 1
    n.setXYZ(a, x / l, y / l, z / l)
    n.setXYZ(b, x / l, y / l, z / l)
  }
  return g
}

function visorPoint(a, w, out) {
  const A = 84 * DEG
  const th = a * A
  const ix = RX * Math.sin(th)
  const iz = RZ * Math.cos(th)
  const ox = 0.97 * Math.sin(th) * (1 + 0.06 * (1 - a * a))
  const reach = Math.pow(1 - a * a, 0.56)
  const oz = RZ * Math.cos(th) + 0.76 * reach
  const y0 = -0.05 * Math.sin(th) ** 2
  /* la chute dépend de la longueur réelle : nulle là où la visière rejoint la couronne */
  const drop = reach * (w * (0.1 + 0.44 * a * a) + 0.07 * w * w)
  return out.set(ix + (ox - ix) * w, y0 + 0.012 - drop, iz + (oz - iz) * w)
}

function visorGeometry(nu, nw) {
  const T = 0.034
  const rim = 8
  const pos = []
  const uv = []
  const idx = []
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  const rows = []
  for (let j = 0; j <= nw; j++) rows.push({ w: j / nw, off: 0, tv: (j / nw) * 0.5 })
  for (let k = 1; k < rim; k++) {
    const t = (k / rim) * Math.PI
    rows.push({ w: 1 + (Math.sin(t) * T * 0.55) / 0.8, off: (1 - Math.cos(t)) * 0.5, tv: 0.5 })
  }
  for (let j = nw; j >= 0; j--) rows.push({ w: j / nw, off: 1, tv: 0.5 + (1 - j / nw) * 0.5 })

  rows.forEach((r) => {
    for (let i = 0; i <= nu; i++) {
      const a = -1 + (2 * i) / nu
      const edge = 1 - a * a
      visorPoint(a, r.w, p)
      visorPoint(a, Math.min(1, r.w) + 0.001, q)
      pos.push(p.x, p.y - r.off * T * Math.min(1, edge * 6 + 0.1), p.z)
      uv.push(i / nu, r.tv)
    }
  })
  const row = nu + 1
  for (let j = 0; j < rows.length - 1; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * row + i
      idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/* Bouton sur le dessus */
function buttonGeometry() {
  const pts = []
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) * Math.PI * 0.5
    pts.push(new THREE.Vector2(0.066 * Math.pow(Math.cos(t), 0.45), 0.024 * Math.pow(Math.sin(t), 0.7)))
  }
  pts.unshift(new THREE.Vector2(0.066, -0.03))
  return new THREE.LatheGeometry(pts.reverse(), 40)
}

function edgeGeometry() {
  const pts = []
  for (let i = 0; i < 360; i++) {
    const th = -Math.PI + (i / 360) * 2 * Math.PI
    pts.push(crownPoint(th, bottomV(th) + 0.001))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 720, 0.0135, 8, true)
}

/* Broderie SIN : petit patch collé à la surface, sa propre texture pour rester nette */
function embroidery() {
  const w = 1024
  const h = 384
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  const all = logo.flatMap((l) => l.pts)
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const minY = Math.min(...all.map((p) => p[1]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const s = (h * 0.78) / (maxY - minY)
  const sx = s * 0.88
  const ox = (w - (maxX - minX) * sx) / 2
  ctx.fillStyle = '#fff'
  for (const l of logo) {
    ctx.beginPath()
    l.pts.forEach(([x, y], i) => {
      const X = ox + (x - minX) * sx
      const Y = h * 0.89 - (y - minY) * s
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
    })
    ctx.closePath()
    ctx.fill()
  }
  /* fil satin : stries obliques sur les lettres */
  ctx.globalCompositeOperation = 'source-atop'
  ctx.strokeStyle = 'rgba(0,0,0,.2)'
  ctx.lineWidth = 2
  for (let x = -h; x < w + h; x += 7) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + h * 0.25, h)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8

  const nu = 28
  const nv = 10
  const dth = 0.27 / RX / 2
  const dv = 0.052
  const pos = []
  const uv = []
  const idx = []
  const p = new THREE.Vector3()
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const th = LOGO_TH - dth + (2 * dth * i) / nu
      const v = LOGO_V - dv + (2 * dv * j) / nv
      crownPoint(th, v, 0.0055, p)
      pos.push(p.x, p.y, p.z)
      uv.push(i / nu, j / nv)
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.48, emissiveIntensity: 0.34, polygonOffset: true, polygonOffsetFactor: -2 })
  return new THREE.Mesh(g, m)
}

/* Partie fixe de la languette : passant doublé, boucle noire, petit drapeau */
function ribbon(s0, s1, off, height, thick, mat) {
  const n = 40
  const pos = []
  const idx = []
  const at = (s, o, y) => {
    const a = Math.PI + (s - 0.5) * 2 * STRAP_A
    const k = 1 + o
    return [RX * STRAP_R * Math.sin(a) * k, STRAP_Y + y, RZ * STRAP_R * Math.cos(a) * k]
  }
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n
    pos.push(...at(s, off, height / 2), ...at(s, off, -height / 2), ...at(s, off + thick, -height / 2), ...at(s, off + thick, height / 2))
  }
  for (let i = 0; i < n; i++) {
    const b = i * 4
    for (let k = 0; k < 4; k++) {
      const c = b + k
      const d = b + ((k + 1) % 4)
      idx.push(c, d, c + 4, d, d + 4, c + 4)
    }
  }
  idx.push(0, 1, 2, 0, 2, 3)
  const e = n * 4
  idx.push(e, e + 2, e + 1, e, e + 3, e + 2)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  const flat = g.toNonIndexed()
  flat.computeVertexNormals()
  return new THREE.Mesh(flat, mat)
}

export const STRAP_A = ARCH_W * 1.06
export const STRAP_R = 0.988

export const COLORS = [
  { id: 'navy', name: 'Navy', hex: '#1e2f52', thread: '#ffffff' },
  { id: 'black', name: 'Black', hex: '#141416', thread: '#ffffff' },
  { id: 'white', name: 'White', hex: '#f1f0ec', thread: '#e1141e' },
  { id: 'grey', name: 'Grey', hex: '#8d9096', thread: '#ffffff' },
  { id: 'blue', name: 'Blue', hex: '#2a62b4', thread: '#ffffff' },
  { id: 'bordeaux', name: 'Bordeaux', hex: '#5a1420', thread: '#ffffff' },
  { id: 'pink', name: 'Pink', hex: '#e887ab', thread: '#ffffff' },
  { id: 'nude', name: 'Nude Rose', hex: '#d9b0a2', thread: '#ffffff' },
  { id: 'orange', name: 'Orange', hex: '#e8701f', thread: '#ffffff' },
  { id: 'yellow', name: 'Yellow', hex: '#ecc22e', thread: '#e1141e' },
]

export function buildCap({ textureSize = 4096, envMap }) {
  const group = new THREE.Group()
  const crownTex = crownTextures(textureSize)
  const visorTex = visorTextures(textureSize / 2)

  const fabricBase = {
    roughness: 0.7,
    sheen: 0.22,
    sheenRoughness: 0.6,
    envMap,
  }
  const crownMat = new THREE.MeshPhysicalMaterial({ ...fabricBase, map: crownTex.map, normalMap: crownTex.normal, normalScale: new THREE.Vector2(0.9, 0.9) })
  const visorMat = new THREE.MeshPhysicalMaterial({ ...fabricBase, map: visorTex.map, normalMap: visorTex.normal, normalScale: new THREE.Vector2(0.8, 0.8) })
  const plainMat = new THREE.MeshPhysicalMaterial({ ...fabricBase })
  const innerMat = new THREE.MeshStandardMaterial({ color: '#0a0b0e', roughness: 0.9, side: THREE.BackSide, envMap })
  const fabrics = [crownMat, visorMat, plainMat]

  const crownGeo = crownGeometry(textureSize >= 4096 ? 420 : 300, 120)
  const crown = new THREE.Mesh(crownGeo, crownMat)
  crown.castShadow = crown.receiveShadow = true
  const inner = new THREE.Mesh(crownGeo, innerMat)
  const visor = new THREE.Mesh(visorGeometry(120, 44), visorMat)
  visor.castShadow = visor.receiveShadow = true
  const button = new THREE.Mesh(buttonGeometry(), plainMat)
  crownPoint(0, 0.9995, 0, button.position)
  button.castShadow = true
  const edge = new THREE.Mesh(edgeGeometry(), plainMat)
  const logoPatch = embroidery()
  group.add(crown, inner, visor, button, edge, logoPatch)

  /* détails de languette : ils apparaissent quand le logo a fini de se poser */
  const red = new THREE.MeshPhysicalMaterial({ color: '#e1141e', roughness: 0.62, envMap })
  const dark = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.34, metalness: 0.3, envMap })
  const details = new THREE.Group()
  details.add(ribbon(0.2, 0.72, 0.013, STRAP_H * 0.96, 0.012, red))
  details.add(ribbon(0.7, 0.745, 0.01, STRAP_H * 1.2, 0.03, dark))
  details.add(ribbon(0.665, 0.685, 0.024, STRAP_H * 1.0, 0.006, dark))
  group.add(details)

  const setColor = (c) => {
    const col = new THREE.Color(c.hex)
    /* la map est à ~0,7 linéaire : on compense pour retrouver la teinte voulue */
    const lifted = col.clone().multiplyScalar(1.18)
    crownMat.color.copy(lifted)
    visorMat.color.copy(lifted)
    plainMat.color.copy(col)
    const sheen = col.clone().lerp(new THREE.Color('#ffffff'), 0.12)
    fabrics.forEach((m) => m.sheenColor.copy(sheen))
    logoPatch.material.color.set(c.thread)
    logoPatch.material.emissive.set(c.thread)
  }
  setColor(COLORS[0])

  const setLight = (k) => {
    fabrics.forEach((m) => (m.envMapIntensity = k))
    innerMat.envMapIntensity = k
    red.envMapIntensity = k
    dark.envMapIntensity = k
    logoPatch.material.envMapIntensity = k
    logoPatch.material.emissiveIntensity = 0.34 * Math.min(1, k * 1.3)
  }

  return { group, details, setColor, setLight }
}
