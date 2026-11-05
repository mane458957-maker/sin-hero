import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import Lenis from 'lenis'
import { buildCap, COLORS, RZ, STRAP_Y } from './cap.js'
import { buildMorph } from './morph.js'
import './style.css'

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ramp = (a, b, x) => clamp((x - a) / (b - a))
const ease = (t) => t * t * t * (t * (6 * t - 15) + 10)
const seg = (a, b, x) => ease(ramp(a, b, x))

const COARSE = matchMedia('(pointer:coarse)').matches
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches
const hero = document.getElementById('hero')
const canvas = document.getElementById('stage')
const params = new URLSearchParams(location.search)

/* la grille ne dépend pas de la 3D */
const grid = document.getElementById('grid')
COLORS.forEach((c) => {
  const a = document.createElement('a')
  a.className = 'card'
  a.href = c.href
  const img = new Image()
  img.src = `./caps/${c.id}.jpg`
  img.alt = c.title
  img.loading = 'lazy'
  const name = document.createElement('span')
  name.textContent = c.title
  const price = document.createElement('small')
  price.textContent = '€50,00'
  a.append(img, name, price)
  grid.append(a)
})

let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
} catch {
  document.documentElement.classList.add('no-webgl')
}

if (renderer) start()

function start() {
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.VSMShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.03).texture

  const cap = buildCap({ textureSize: COARSE ? 2048 : 4096, envMap })
  const morph = buildMorph({ fieldWidth: COARSE ? 1280 : 2048, envMap })
  /* la casquette se pose nez légèrement relevé, sur le bord arrière et le bout de visière */
  const rig = new THREE.Group()
  rig.add(cap.group, morph.mesh)
  scene.add(rig)

  const key = new THREE.DirectionalLight('#fff4ea', 0)
  key.position.set(2.6, 4.4, 2.2)
  key.castShadow = true
  key.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048)
  key.shadow.radius = 9
  key.shadow.blurSamples = COARSE ? 10 : 18
  key.shadow.bias = -0.0006
  key.shadow.autoUpdate = false
  Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 1, far: 11 })
  const rim = new THREE.DirectionalLight('#ffffff', 0)
  const redKick = new THREE.PointLight('#ff2030', 0, 5, 1.6)
  redKick.position.set(0, 0.2, -1.5)
  scene.add(key, rim, rim.target, redKick)

  /* ombre de contact : c'est elle qui pose l'objet sur le sol */
  const blobCanvas = document.createElement('canvas')
  blobCanvas.width = blobCanvas.height = 256
  const bctx = blobCanvas.getContext('2d')
  const grad = bctx.createRadialGradient(128, 128, 18, 128, 128, 128)
  grad.addColorStop(0, 'rgba(0,0,0,.95)')
  grad.addColorStop(0.55, 'rgba(0,0,0,.42)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  bctx.fillStyle = grad
  bctx.fillRect(0, 0, 256, 256)
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.7, 3.4),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), transparent: true, opacity: 0, depthWrite: false, toneMapped: false })
  )
  contact.rotation.x = -Math.PI / 2
  contact.position.set(0, -0.165, 0.28)
  scene.add(contact)

  const black = new THREE.Color('#000000')
  const paper = new THREE.Color('#ededed')
  const bg = new THREE.Color()

  /* trajectoire : caméra derrière la languette, recul, puis tour jusqu'au trois-quarts avant */
  const flatTarget = new THREE.Vector3(0, STRAP_Y, -RZ)
  const capTarget = new THREE.Vector3(0, 0.36, 0.2)
  const KEYS = [
    { p: 0.0, az: 180, el: 0, fit: 'logo', t: 0 },
    { p: 0.28, az: 180, el: 1, fit: 'logo', t: 0 },
    { p: 0.46, az: 172, el: 13, fit: 'back', t: 0.55 },
    { p: 0.72, az: 58, el: 9, fit: 'cap', t: 1 },
    { p: 1.0, az: 58, el: 9, fit: 'cap', t: 1 },
  ]

  let W = 1
  let Hh = 1
  /* où se trouve la casquette dans les photos produit (toutes cadrées pareil) :
     la 3D vient se poser exactement là avant de laisser place à la photo */
  const CAP_X = 0.51
  const CAP_Y = 0.512
  const CAP_W = 0.6
  const CAP_WORLD = 2.8
  const shot = { x: 0, y: 0, w: 1 }
  const fitDistance = (w, h) => {
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    return Math.max(h / 2 / th, w / 2 / (th * camera.aspect))
  }
  const fits = () => ({
    logo: fitDistance(morph.flatW * (W < Hh ? 1.16 : 1.9), morph.flatH * 2.6),
    back: fitDistance(W < Hh ? 2.45 : 2.9, 2.6),
    cap: (CAP_WORLD * Hh) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * shot.w),
  })

  const look = new THREE.Vector3()
  const pos = new THREE.Vector3()
  let pointerX = 0
  let pointerY = 0
  let px = 0
  let py = 0
  let colorIndex = 0
  let shadowReady = false
  let lockedColor = -1

  function placeCamera(p) {
    const f = fits()
    let i = 0
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++
    const a = KEYS[i]
    const b = KEYS[i + 1]
    const t = seg(a.p, b.p, p)
    const az = THREE.MathUtils.degToRad(a.az + (b.az - a.az) * t)
    const el = THREE.MathUtils.degToRad(a.el + (b.el - a.el) * t)
    const dist = f[a.fit] + (f[b.fit] - f[a.fit]) * t
    look.lerpVectors(flatTarget, capTarget, a.t + (b.t - a.t) * t)
    pos.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(look)
    /* léger parallaxe souris */
    pos.x += px * 0.09 * dist * 0.12
    pos.y += py * 0.06 * dist * 0.12
    camera.position.copy(pos)
    camera.lookAt(look)
    const side = seg(0.5, 0.72, p)
    camera.setViewOffset(W, Hh, -shot.x * side, -shot.y * side, W, Hh)
  }

  function setScene(p) {
    const melt = seg(0.05, 0.3, p)
    const bend = seg(0.2, 0.42, p)
    const reveal = seg(0.26, 0.5, p)
    const day = seg(0.6, 0.76, p)

    morph.uniforms.uMelt.value = melt
    morph.uniforms.uBend.value = bend
    morph.uniforms.uDepth.value = 0.07 + (0.014 - 0.07) * melt
    morph.uniforms.uGlow.value = 1 - seg(0.3, 0.6, p) * 0.97

    const tilt = THREE.MathUtils.degToRad(-5.7) * seg(0.46, 0.7, p)
    if (tilt !== rig.rotation.x || !shadowReady) {
      rig.rotation.x = tilt
      key.shadow.needsUpdate = true
      shadowReady = true
    }

    cap.setLight(reveal * (0.5 + day * 0.28))
    morph.material.envMapIntensity = 0.14 + reveal * 0.3 + day * 0.5
    key.intensity = reveal * (1.4 + day * 0.9)
    rim.intensity = reveal * (1 - day) * 2.6
    rim.position.set(camera.position.x * -1 + 1.5, 3, camera.position.z * -1)
    redKick.intensity = seg(0.2, 0.42, p) * (1 - seg(0.5, 0.64, p)) * 2.4
    cap.details.visible = bend > 0.97
    cap.details.scale.y = 1

    contact.material.opacity = 0.5 * day
    bg.lerpColors(black, paper, day)
    /* couleur d'effacement et pas scene.background : elle échappe au tone mapping, donc colle au fond des photos */
    renderer.setClearColor(bg, 1)

    /* les coloris défilent sur la fin, sauf si le visiteur en a choisi un */
    const idx = lockedColor >= 0 ? lockedColor : Math.min(COLORS.length - 1, Math.floor(ramp(0.8, 0.985, p) * COLORS.length))
    if (idx !== colorIndex) {
      colorIndex = idx
      updateSwatches()
    }
    document.documentElement.style.setProperty('--day', day.toFixed(3))
  }

  const blocks = [...document.querySelectorAll('[data-in]')].map((el) => ({
    el,
    a: +el.dataset.in,
    b: +el.dataset.out,
  }))
  function setCopy(p) {
    for (const { el, a, b } of blocks) {
      const o = ramp(a, a + 0.035, p) * (1 - ramp(b - 0.035, b, p))
      el.style.opacity = o.toFixed(3)
      el.style.transform = `translate3d(0,${((1 - o) * 18).toFixed(1)}px,0)`
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none'
    }
    bar.style.transform = `scaleX(${p.toFixed(4)})`
    /* le logo du haut n'arrive que quand le grand logo a disparu : jamais deux SIN à l'écran */
    brand.style.opacity = seg(0.1, 0.3, p).toFixed(3)
    photos.style.opacity = seg(0.73, 0.77, p).toFixed(3)
  }

  const bar = document.getElementById('bar')
  const brand = document.getElementById('brand')
  const photos = document.getElementById('photos')
  const cta = document.getElementById('cta')
  const shots = COLORS.map((c, i) => {
    const img = new Image()
    img.alt = c.title
    img.decoding = 'async'
    img.src = `./caps/${c.id}.jpg`
    photos.append(img)
    return img
  })
  const swatches = document.getElementById('swatches')
  const swatchName = document.getElementById('swatch-name')
  COLORS.forEach((c, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.style.setProperty('--c', c.hex)
    b.setAttribute('aria-label', c.name)
    b.addEventListener('click', () => {
      lockedColor = i
      dirty = true
    })
    swatches.append(b)
  })
  function updateSwatches() {
    ;[...swatches.children].forEach((b, i) => b.setAttribute('aria-pressed', i === colorIndex))
    swatchName.textContent = COLORS[colorIndex].name
    shots.forEach((s, i) => s.classList.toggle('on', i === colorIndex))
    cta.href = COLORS[colorIndex].href
  }
  updateSwatches()

  /* si la machine décroche, on baisse la définition plutôt que la fluidité */
  let quality = 1
  let slow = 0
  function adapt(ms) {
    slow = ms > 30 ? slow + 1 : Math.max(0, slow - 1)
    if (slow > 24 && quality > 0.55) {
      quality -= 0.15
      slow = 0
      resize()
    }
  }

  function resize() {
    W = hero.querySelector('.pin').clientWidth
    Hh = hero.querySelector('.pin').clientHeight
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.75 : 2) * quality)
    renderer.setSize(W, Hh, false)
    camera.aspect = W / Hh
    camera.updateProjectionMatrix()
    const box = photos.getBoundingClientRect()
    const pin = hero.querySelector('.pin').getBoundingClientRect()
    shot.x = box.left - pin.left + box.width * CAP_X - W / 2
    shot.y = box.top - pin.top + box.height * CAP_Y - Hh / 2
    shot.w = box.width * CAP_W
    dirty = true
  }

  let forced = params.has('p') ? +params.get('p') : null
  let target = 0
  let current = REDUCED ? 1 : 0
  let dirty = true

  function readScroll() {
    const r = hero.getBoundingClientRect()
    target = clamp(-r.top / Math.max(1, r.height - innerHeight))
    if (REDUCED) target = 1
    if (forced !== null) target = forced
  }

  const lenis = COARSE || REDUCED ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
  addEventListener('resize', resize)
  addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / innerWidth) * 2 - 1
    pointerY = (e.clientY / innerHeight) * 2 - 1
  })

  let visible = true
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero)

  window.__seek = (p) => {
    forced = current = target = p
    dirty = true
  }

  /* coût GPU réel d'une image, indépendant de la cadence du navigateur */
  window.__bench = (p, n = 20) => {
    const gl = renderer.getContext()
    const px = new Uint8Array(4)
    placeCamera(p)
    setScene(p)
    renderer.render(scene, camera)
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const t = performance.now()
    for (let i = 0; i < n; i++) {
      renderer.render(scene, camera)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    }
    return +((performance.now() - t) / n).toFixed(1)
  }

  let last = performance.now()
  function frame(now) {
    const raw = now - last
    const dt = Math.min(120, raw)
    last = now
    lenis?.raf(now)
    readScroll()
    const k = 1 - Math.exp(-dt / (COARSE ? 40 : 60))
    const prev = current
    current += (target - current) * k
    if (Math.abs(target - current) < 0.00005) current = target
    px += (pointerX - px) * 0.05
    py += (pointerY - py) * 0.05
    const moving = prev !== current || Math.abs(pointerX - px) + Math.abs(pointerY - py) > 0.002
    if (visible && (moving || dirty)) {
      placeCamera(current)
      setScene(current)
      setCopy(current)
      /* une fois la photo posée, inutile de calculer la 3D derrière */
      if (current < 0.78) renderer.render(scene, camera)
      if (document.visibilityState === 'visible' && raw < 200) adapt(raw)
      dirty = false
    }
    requestAnimationFrame(frame)
  }

  resize()
  document.documentElement.classList.add('ready')
  requestAnimationFrame(frame)
}
