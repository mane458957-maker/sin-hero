import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import Lenis from 'lenis'
import { COLORS, RZ, STRAP_Y } from './cap.js'
import { buildMorph } from './morph.js'
import { createFilm } from './film.js'
import { createThreads } from './threads.js'
import { createSewing } from './sewing.js'
import { createMonogram } from './monogram.js'
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
/* parts du scroll : animation, puis coloris, puis écran immobile pendant le départ des fils */
/* sur téléphone l'écran reste immobile plus longtemps : les fils se déroulent plus lentement sous le doigt */
const PHONE = matchMedia('(max-aspect-ratio: 85/100), (max-width: 760px)').matches
const SCROLL_VH = PHONE ? 1181 : 1061
const PAINT_FROM = 0.8
const HINT_FROM = 0.82
const isDark = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b < 128
}
const COLORS_AT = 426 / SCROLL_VH
const COLORS_END = 921 / SCROLL_VH
const RUSH = 22

/* la grille ne dépend pas de l'animation */
const grid = document.getElementById('grid')
COLORS.forEach((c) => {
  const a = document.createElement('a')
  a.className = 'card'
  a.href = c.href
  /* la casquette blanche dessous, sa vraie couleur par-dessus : les photos ont le même cadrage */
  const shot = document.createElement('div')
  shot.className = 'shot'
  const blank = new Image()
  blank.src = './caps/white.jpg'
  blank.alt = ''
  const img = new Image()
  img.className = 'tint'
  img.src = `./caps/${c.id}.jpg`
  img.alt = c.title
  shot.append(blank, img)
  const name = document.createElement('span')
  name.textContent = c.title
  const price = document.createElement('small')
  price.textContent = '€50,00'
  a.append(shot, name, price)
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
  const rises = [...document.querySelectorAll('[data-rise]')].map((el) => {
    const [a, b] = el.dataset.rise.split(' ').map(Number)
    return { el, a, b }
  })
  const monogram = createMonogram(document.getElementById('monogram'))
  addEventListener('pointermove', (e) => monogram.point(e.clientX, e.clientY, e.pointerType === 'touch'), { passive: true })
  addEventListener('pointerdown', (e) => monogram.point(e.clientX, e.clientY, e.pointerType === 'touch'), { passive: true })
  addEventListener('touchmove', (e) => monogram.point(e.touches[0].clientX, e.touches[0].clientY, true), { passive: true })
  document.documentElement.addEventListener('mouseleave', () => monogram.release())
  const threads = createThreads(document.getElementById('threads'), { maxRatio: COARSE ? 1.25 : 1.5 })
  const photos = document.getElementById('photos')
  const brand = document.getElementById('brand')
  const bar = document.getElementById('bar')
  const cta = document.getElementById('cta')
  const swatches = document.getElementById('swatches')
  const swatchName = document.getElementById('swatch-name')
  const model = document.getElementById('model')
  const next = document.getElementById('next')
  const shop = document.querySelector('.c-shop')

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
    /* la casquette reste centrée pendant la rotation : les mots-clés ont la place à gauche et à droite */
    const fx = (stage.x - strap.x) * (1 - k) + shrink.x * k
    const fy = (stage.y - strap.y) * (1 - move) + shrink.y * k
    filmBox.style.transform = `translate3d(${fx.toFixed(1)}px,${fy.toFixed(1)}px,0) scale(${Math.pow(stage.zoom, 1 - move).toFixed(4)})`
    photos.style.opacity = seg(T.photoFrom, T.photoTo, p).toFixed(3)

    /* gros mots-clés : ils montent avec le scroll, derrière la casquette */
    rises.forEach(({ el, a, b }) => {
      const t = ramp(a, b, p)
      el.style.opacity = (seg(0, 0.16, t) * (1 - seg(0.84, 1, t))).toFixed(3)
      el.style.transform = `translate3d(0,${((0.5 - t) * Hh * 1.05).toFixed(1)}px,0)`
    })

    /* photo posée : le film disparaît, rien ne transparaît quand on change de coloris */
    filmBox.style.visibility = p >= T.photoTo ? 'hidden' : 'visible'

    /* les coloris défilent sur la fin, sauf si le visiteur en a choisi un */
    const idx = lockedColor >= 0 ? lockedColor : Math.min(COLORS.length - 1, Math.floor(ramp(0.82, 0.995, p) * COLORS.length))
    if (idx !== colorIndex) {
      colorIndex = idx
      updateSwatches()
    }

    /* le fond prend la lumière de la casquette, une fois la photo posée */
    const paint = p >= PAINT_FROM ? colorIndex : -1
    if (paint !== painted) {
      painted = paint
      const { glow = '', deep = '' } = COLORS[paint] || {}
      pin.style.setProperty('--g-in', glow)
      pin.style.setProperty('--g-out', deep)
      pin.style.backgroundColor = deep
      hero.style.backgroundColor = deep
      pin.classList.toggle('tinted', paint >= 0)
      pin.classList.toggle('dark', paint >= 0 && isDark(deep))
    }
  }

  let painted = -1
  let colorIndex = 0
  let lockedColor = -1
  const shots = COLORS.map((c) => {
    const img = new Image()
    img.alt = c.title
    img.decoding = 'sync'
    img.src = `./cut/${c.id}.webp`
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
      /* coloris choisi à la main : on saute à la fin du défilement des coloris,
         le prochain coup de scroll lance directement les fils */
      const r = hero.getBoundingClientRect()
      const span = Math.max(1, r.height - innerHeight)
      const s = -r.top / span
      if (s > COLORS_AT - 0.02 && s < COLORS_END - 0.06 * innerHeight / span) {
        const y = scrollY + r.top + COLORS_END * span - innerHeight * 0.05
        if (lenis) lenis.scrollTo(y, { immediate: true })
        else scrollTo({ top: y, behavior: 'instant' })
      }
    })
    swatches.append(b)
  })
  function updateSwatches() {
    ;[...swatches.children].forEach((b, i) => b.setAttribute('aria-pressed', i === colorIndex))
    swatchName.textContent = COLORS[colorIndex].name
    model.textContent = COLORS[colorIndex].title.replace('SIN RED', '').trim()
    shots.forEach((s, i) => s.classList.toggle('on', i === colorIndex))
    cta.href = COLORS[colorIndex].href
  }
  updateSwatches()

  const sewing = REDUCED
    ? null
    : createSewing({ canvas: document.getElementById('sew'), measure: document.getElementById('sew-measure'), hero, pin, copy: shop, swatches, cards: [...grid.children], colors: COLORS, holdRatio: (SCROLL_VH - 921) / (SCROLL_VH + 100) })

  let sewnWidth = 0
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
    threads.resize(W, Hh, stage.y)
    /* sur téléphone le bas est occupé : l'indication se cale à droite du titre */
    monogram.resize(W, Hh)
    /* la barre d'adresse mobile change la hauteur à chaque scroll : seul un changement de largeur recale les fils */
    if (W !== sewnWidth) sewing?.layout()
    else sewing?.fit()
    sewnWidth = W
    dirty = true
  }

  let forced = params.has('p') ? +params.get('p') : null
  let target = 0
  let current = REDUCED ? 1 : 0
  let dirty = true

  function readScroll() {
    const r = hero.getBoundingClientRect()
    const s = clamp(-r.top / Math.max(1, r.height - innerHeight))
    /* la fin du hero prend plus de scroll : environ un demi-écran par coloris */
    target = s < COLORS_AT ? (s / COLORS_AT) * 0.82 : 0.82 + (Math.min(s, COLORS_END) - COLORS_AT) / (COLORS_END - COLORS_AT) * 0.18
    if (REDUCED) target = 1
    if (forced !== null) target = forced
  }

  const lenis = COARSE || REDUCED ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })
  /* sur téléphone, la barre d'adresse revient quand on remonte et déclenche des "resize" en rafale :
     seul un vrai changement de largeur (rotation) doit tout recalculer */
  let screenWidth = innerWidth
  addEventListener('resize', () => {
    if (COARSE && innerWidth === screenWidth) return
    screenWidth = innerWidth
    resize()
  })

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
    sewing?.update(scrollY)
    /* pendant tous les coloris : on invite à continuer, jusqu'au départ des fils */
    next.classList.toggle('on', !!sewing && current >= HINT_FROM && !sewing.started())

    /* les fils vivent dès l'ouverture, sans attendre le scroll, et se resserrent quand le logo fond */
    if (visible && current < T.fadeTo) {
      threads.draw(now / 1000, seg(T.meltFrom, T.meltTo + 0.04, current), seg(0.1, 0.2, current) * (1 - seg(T.fadeFrom - 0.04, T.fadeFrom + 0.02, current)))
      /* le monogramme part dès que le logo commence à descendre */
      monogram.draw(now / 1000, 1 - seg(T.meltFrom, T.meltFrom + 0.08, current))
    }

    /* le trait vit même quand le visiteur ne scrolle pas */
    const alive = current > T.meltFrom && current < T.handTo
    morph.uniforms.uTime.value = now / 1000
    if (visible && (prev !== current || dirty || alive)) {
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
  /* les polices et les images peuvent décaler la grille : on recale les fils une fois tout chargé */
  addEventListener('load', () => sewing?.layout())
  document.fonts?.ready.then(() => sewing?.layout())
  document.documentElement.classList.add('ready')
  requestAnimationFrame(frame)
}
