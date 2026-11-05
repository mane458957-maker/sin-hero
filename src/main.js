import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import Lenis from 'lenis'
import { COLORS, RZ, STRAP_Y } from './cap.js'
import { buildMorph } from './morph.js'
import { createFilm } from './film.js'
import './style.css'

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ramp = (a, b, x) => clamp((x - a) / (b - a))
const ease = (t) => t * t * t * (t * (6 * t - 15) + 10)
const seg = (a, b, x) => ease(ramp(a, b, x))
const mix = (a, b, t) => a + (b - a) * t

const COARSE = matchMedia('(pointer:coarse)').matches
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches
const hero = document.getElementById('hero')
const pin = hero.querySelector('.pin')
const canvas = document.getElementById('stage')
const params = new URLSearchParams(location.search)

/* repères mesurés sur la vidéo (fractions du cadre) et sur les photos produit */
const FRAMES = 243
const STRAP = { x: 0.48, y: 0.8, w: 0.3 }
const FILM_END = { x: 0.45, y: 0.526, w: 0.895 }
const PHOTO = { x: 0.459, y: 0.512, w: 0.604 }

/* scénario : fractions du scroll */
const T = { meltFrom: 0.05, meltTo: 0.3, bendFrom: 0.2, bendTo: 0.42, openFrom: 0.34, openTo: 0.5, turnFrom: 0.48, turnTo: 0.74, shrinkFrom: 0.7, shrinkTo: 0.77, photoFrom: 0.75, photoTo: 0.785 }

/* la grille ne dépend pas de l'animation */
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
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
} catch {
  document.documentElement.classList.add('no-webgl')
}

if (renderer) start()

function start() {
  renderer.toneMapping = THREE.NeutralToneMapping
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 40)
  const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.03).texture
  const morph = buildMorph({ fieldWidth: COARSE ? 1280 : 2048, envMap })
  morph.material.envMapIntensity = 0.14
  scene.add(morph.mesh)

  const filmBox = document.getElementById('filmbox')
  const film = createFilm(document.getElementById('film'), { count: FRAMES, path: './film/', window: COARSE ? 24 : 60 })
  const curtain = document.getElementById('curtain')
  const photos = document.getElementById('photos')
  const brand = document.getElementById('brand')
  const bar = document.getElementById('bar')
  const cta = document.getElementById('cta')
  const swatches = document.getElementById('swatches')
  const swatchName = document.getElementById('swatch-name')

  let W = 1
  let Hh = 1
  const strap = { x: 0, y: 0, w: 1 }
  const shrink = { s: 1, x: 0, y: 0 }

  const look = new THREE.Vector3(0, STRAP_Y, -RZ)
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const pxDistance = (world, px) => (world * Hh) / (2 * tanHalf * px)

  function placeCamera(p) {
    const t = seg(T.bendFrom, T.bendTo, p)
    const logoPx = Math.min(W * (W < Hh ? 0.86 : 0.52), Hh * 0.9)
    const dist = mix(pxDistance(morph.flatW, logoPx), pxDistance(morph.flatW, strap.w), t)
    const el = THREE.MathUtils.degToRad(mix(0, 22, t))
    camera.position.set(0, Math.sin(el) * dist, -Math.cos(el) * dist).add(look)
    camera.lookAt(look)
    camera.setViewOffset(W, Hh, -(strap.x - W / 2) * t, -(strap.y - Hh / 2) * t, W, Hh)
  }

  const blocks = [...document.querySelectorAll('[data-in]')].map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out }))

  function setPage(p) {
    for (const { el, a, b } of blocks) {
      const o = ramp(a, a + 0.03, p) * (1 - ramp(b - 0.03, b, p))
      el.style.opacity = o.toFixed(3)
      el.style.transform = `translate3d(0,${((1 - o) * 18).toFixed(1)}px,0)`
      el.style.pointerEvents = o > 0.6 ? 'auto' : 'none'
    }
    bar.style.transform = `scaleX(${p.toFixed(4)})`
    /* le logo du haut n'arrive que quand le grand logo a disparu : jamais deux SIN à l'écran */
    brand.style.opacity = seg(0.1, 0.3, p).toFixed(3)

    /* la lumière s'ouvre autour de la languette */
    const open = seg(T.openFrom, T.openTo, p)
    curtain.style.setProperty('--r', `${(open * Math.hypot(W, Hh) * 1.25).toFixed(0)}px`)
    curtain.style.display = open >= 1 ? 'none' : ''
    canvas.style.opacity = (1 - seg(T.openFrom + 0.06, T.openTo - 0.03, p)).toFixed(3)

    film.seek(ramp(T.turnFrom, T.turnTo, p) * (FRAMES - 1))
    const k = seg(T.shrinkFrom, T.shrinkTo, p)
    filmBox.style.transform = `translate3d(${(shrink.x * k).toFixed(1)}px,${(shrink.y * k).toFixed(1)}px,0) scale(${mix(1, shrink.s, k).toFixed(4)})`
    photos.style.opacity = seg(T.photoFrom, T.photoTo, p).toFixed(3)
    /* photo posée : le film disparaît, rien ne transparaît quand on change de coloris */
    filmBox.style.visibility = p >= T.photoTo ? 'hidden' : 'visible'

    /* les coloris défilent sur la fin, sauf si le visiteur en a choisi un */
    const idx = lockedColor >= 0 ? lockedColor : Math.min(COLORS.length - 1, Math.floor(ramp(0.81, 0.985, p) * COLORS.length))
    if (idx !== colorIndex) {
      colorIndex = idx
      updateSwatches()
    }
  }

  let colorIndex = 0
  let lockedColor = -1
  const shots = COLORS.map((c) => {
    const img = new Image()
    img.alt = c.title
    img.decoding = 'sync'
    img.src = `./caps/${c.id}.jpg`
    photos.append(img)
    return img
  })
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

  function resize() {
    W = pin.clientWidth
    Hh = pin.clientHeight
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.75 : 2))
    renderer.setSize(W, Hh, false)
    camera.aspect = W / Hh
    camera.updateProjectionMatrix()

    const saved = filmBox.style.transform
    filmBox.style.transform = 'none'
    const root = pin.getBoundingClientRect()
    const f = filmBox.getBoundingClientRect()
    const ph = photos.getBoundingClientRect()
    filmBox.style.transform = saved

    strap.x = f.left - root.left + f.width * STRAP.x
    strap.y = f.top - root.top + f.height * STRAP.y
    strap.w = f.width * STRAP.w
    curtain.style.setProperty('--x', `${strap.x.toFixed(0)}px`)
    curtain.style.setProperty('--y', `${strap.y.toFixed(0)}px`)

    /* le film recule pour que la casquette prenne la taille et la place de la photo */
    shrink.s = (ph.width * PHOTO.w) / (f.width * FILM_END.w)
    const cx = f.left + f.width / 2
    const cy = f.top + f.height / 2
    shrink.x = ph.left + ph.width * PHOTO.x - (cx + (FILM_END.x - 0.5) * f.width * shrink.s)
    shrink.y = ph.top + ph.height * PHOTO.y - (cy + (FILM_END.y - 0.5) * f.height * shrink.s)
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

  let visible = true
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero)

  window.__seek = (p) => {
    forced = current = target = p
    dirty = true
  }

  let last = performance.now()
  function frame(now) {
    const dt = Math.min(120, now - last)
    last = now
    lenis?.raf(now)
    readScroll()
    const prev = current
    current += (target - current) * (1 - Math.exp(-dt / (COARSE ? 40 : 60)))
    if (Math.abs(target - current) < 0.00005) current = target
    if (visible && (prev !== current || dirty)) {
      setPage(current)
      /* passé l'ouverture, seule la vidéo travaille */
      if (current < T.openTo) {
        morph.uniforms.uMelt.value = seg(T.meltFrom, T.meltTo, current)
        morph.uniforms.uBend.value = seg(T.bendFrom, T.bendTo, current)
        morph.uniforms.uDepth.value = mix(0.07, 0.014, seg(T.meltFrom, T.meltTo, current))
        placeCamera(current)
        renderer.render(scene, camera)
      }
      dirty = false
    }
    requestAnimationFrame(frame)
  }

  resize()
  document.documentElement.classList.add('ready')
  requestAnimationFrame(frame)
}
