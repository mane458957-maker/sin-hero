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
const FRAMES = 107
const STRAP = { x: 0.486, y: 0.658, w: 0.234 }
const FILM_END = { x: 0.4125, y: 0.5115 }
const PHOTO = { x: 0.459, y: 0.5115 }
const CAP_TOP = 0.325
const CAP_SPAN = 0.37

/* scénario : fractions du scroll */
const T = { meltFrom: 0.05, meltTo: 0.26, fadeFrom: 0.36, fadeTo: 0.47, handFrom: 0.38, handTo: 0.47, moveFrom: 0.47, moveTo: 0.56, turnFrom: 0.47, rushTo: 0.51, turnTo: 0.76, shrinkFrom: 0.73, shrinkTo: 0.79, photoFrom: 0.772, photoTo: 0.792 }

/* les 2 premières images de la vidéo sont floues : le film démarre à la 3e.
   Il passe ensuite vite sur les premières images, pour arriver tout de suite dans la rotation */
const FIRST = 2
const RUSH = 22

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
  const film = createFilm(document.getElementById('film'), { count: FRAMES, path: './film/', window: COARSE ? 16 : 48 })
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
  const shrink = { x: 0, y: 0 }
  /* la scène de révélation : la languette y est immobile, à sa place sur la casquette agrandie */
  const stage = { x: 0, y: 0, w: 1, zoom: 1 }
  let logoPx = 1

  const look = new THREE.Vector3(0, STRAP_Y, -RZ)
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const pxDistance = (world, px) => (world * Hh) / (2 * tanHalf * px)

  /* le logo descend à la place de la languette pendant qu'il fond, sur le noir : ensuite plus rien ne bouge */
  function placeCamera(t) {
    const dist = pxDistance(morph.flatW, mix(logoPx, stage.w * 0.985, t))
    camera.position.set(0, STRAP_Y, -RZ - dist)
    camera.lookAt(look)
    camera.setViewOffset(W, Hh, -(stage.x - W / 2) * t, -(stage.y - Hh / 2) * t, W, Hh)
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

    /* un seul fondu : le trait rouge s'efface pendant que tout le second plan apparaît d'un bloc */
    canvas.style.opacity = (1 - seg(T.handFrom, T.handTo, p)).toFixed(3)
    const fade = seg(T.fadeFrom, T.fadeTo, p)
    curtain.style.opacity = (1 - fade).toFixed(3)
    curtain.style.display = fade >= 1 ? 'none' : ''

    film.seek(FIRST + ramp(T.turnFrom, T.rushTo, p) * (RUSH - FIRST) + ramp(T.rushTo, T.turnTo, p) * (FRAMES - 1 - RUSH))

    /* seul le film recule, une fois le relais passé, pendant que la casquette tourne */
    const move = seg(T.moveFrom, T.moveTo, p)
    const k = seg(T.shrinkFrom, T.shrinkTo, p)
    const fx = (stage.x - strap.x) * (1 - move) + shrink.x * k
    const fy = (stage.y - strap.y) * (1 - move) + shrink.y * k
    filmBox.style.transform = `translate3d(${fx.toFixed(1)}px,${fy.toFixed(1)}px,0) scale(${Math.pow(stage.zoom, 1 - move).toFixed(4)})`
    photos.style.opacity = seg(T.photoFrom, T.photoTo, p).toFixed(3)
    /* photo posée : le film disparaît, rien ne transparaît quand on change de coloris */
    filmBox.style.visibility = p >= T.photoTo ? 'hidden' : 'visible'

    /* les coloris défilent sur la fin, sauf si le visiteur en a choisi un */
    const idx = lockedColor >= 0 ? lockedColor : Math.min(COLORS.length - 1, Math.floor(ramp(0.82, 0.985, p) * COLORS.length))
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
    filmBox.style.transformOrigin = `${STRAP.x * 100}% ${STRAP.y * 100}%`

    /* même hauteur de casquette dans la vidéo et les photos : il ne reste qu'à la glisser en place */
    shrink.x = (PHOTO.x - FILM_END.x) * ph.width + ph.left - f.left
    shrink.y = (PHOTO.y - FILM_END.y) * ph.height + ph.top - f.top

    logoPx = Math.min(W * (W < Hh ? 0.86 : 0.52), Hh * 0.9)

    /* taille de révélation : toute la casquette tient entre l'en-tête et le bas de l'écran */
    const room = Hh - 106
    /* la vidéo fait 960 px : zoom léger, sinon elle devient floue */
    const size = Math.min((room / CAP_SPAN) * 0.92, W < Hh ? W * 1.7 : f.width * 1.3)
    stage.zoom = size / f.width
    stage.w = size * STRAP.w
    stage.x = W / 2
    stage.y = 96 + (room - size * CAP_SPAN) * 0.4 + size * (STRAP.y - CAP_TOP)
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
      /* une fois la bande effacée, la 3D ne calcule plus rien */
      if (current < T.handTo) {
        const melt = seg(T.meltFrom, T.meltTo, current)
        morph.uniforms.uMelt.value = melt
        morph.uniforms.uDepth.value = mix(0.07, 0.02, melt)
        placeCamera(melt)
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
