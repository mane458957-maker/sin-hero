/* Fin du hero : chaque pastille lâche un fil. Tous descendent en faisceau par le milieu de la page,
   puis chacun part à gauche ou à droite vers sa casquette blanche, s'enroule autour, lui donne sa
   couleur et disparaît à l'intérieur comme s'il était cousu. Tout est lié au scroll.
   Les fils sont peints sur un canvas : une ligne vectorielle ne peut pas avoir l'aspect d'un fil torsadé. */
const HEAD_AT = 0.7
const STAGGER = 22
const STEP = 3
const UP_MARGIN = 36
/* repères sur les photos produit : le bouton du dessus, puis la couronne autour de laquelle le fil tourne */
const BUTTON = { x: 0.545, y: 0.33 }
const COIL = { x: 0.535, rx: 0.235, ry: 0.052, top: 0.37, bottom: 0.6, turns: 3.5 }

const clamp = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/* l'hélice autour de la couronne, du haut vers le bord de la casquette */
function coilPath(box) {
  let d = ''
  const steps = 96
  for (let k = 0; k <= steps; k++) {
    const f = k / steps
    const angle = -Math.PI / 2 + f * COIL.turns * Math.PI * 2
    /* le fil se resserre vers le haut, là où la couronne est plus étroite */
    const rx = COIL.rx * (0.45 + 0.55 * Math.min(1, f * 1.8))
    const x = box.x + box.w * (COIL.x + rx * Math.cos(angle))
    const y = box.y + box.h * (COIL.top + (COIL.bottom - COIL.top) * f + COIL.ry * Math.sin(angle))
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return d
}

export function createSewing({ canvas, measure, hero, pin, copy, swatches, cards, colors, holdRatio }) {
  const ctx = canvas.getContext('2d')
  const threads = colors.map((color, i) => ({
    i,
    base: color.hex,
    dark: shade(color.hex, -0.38),
    light: shade(color.hex, 0.42),
    img: cards[i].querySelector('.tint'),
    xs: new Float32Array(0),
    ys: new Float32Array(0),
    from: 0,
    arrive: 1,
    done: 2,
    run: 1,
    length: 1,
  }))
  threads.forEach((t) => (t.img.style.opacity = 0))
  let last = -1
  let release = 0
  let originY = 0
  let width = 3
  let ratio = 1
  /* l'effet ne se joue qu'une fois, en descendant : on retient le point le plus bas atteint */
  let lowest = 0
  let finished = false

  function finish() {
    finished = true
    canvas.style.transition = 'opacity .5s ease'
    canvas.style.opacity = 0
    for (const t of threads) {
      t.img.style.transition = 'opacity .6s ease'
      t.img.style.opacity = 1
    }
  }

  function fit() {
    ratio = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(innerWidth * ratio)
    canvas.height = Math.round(innerHeight * ratio)
    last = -1
  }

  function sample(t, d) {
    measure.setAttribute('d', d)
    const length = measure.getTotalLength()
    const n = Math.ceil(length / STEP) + 1
    t.xs = new Float32Array(n)
    t.ys = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const p = measure.getPointAtLength(Math.min(length, k * STEP))
      t.xs[k] = p.x
      t.ys[k] = p.y
    }
    t.length = length
  }

  function layout() {
    fit()
    const main = canvas.parentElement.getBoundingClientRect()
    const root = pin.getBoundingClientRect()
    const heroBottom = hero.getBoundingClientRect().bottom - main.top
    const heroEnd = heroBottom - pin.clientHeight
    const vh = innerHeight
    const maxScroll = document.documentElement.scrollHeight - vh - 2
    originY = main.top + scrollY
    release = heroEnd + originY
    const hold = hero.offsetHeight * holdRatio
    width = main.width < 700 ? 2.6 : 3.1

    /* la position des pastilles sans le petit décalage d'apparition du texte */
    const saved = copy.style.transform
    copy.style.transform = 'none'
    const starts = [...swatches.children].map((b) => {
      const r = b.getBoundingClientRect()
      return { x: r.left + r.width / 2 - main.left, y: heroEnd + r.bottom - root.top }
    })
    copy.style.transform = saved

    const trunkTop = heroBottom + 6
    threads.forEach((t) => {
      const { i } = t
      const r = t.img.getBoundingClientRect()
      const box = { x: r.left - main.left, y: r.top - main.top, w: r.width, h: r.height }
      const a = starts[i]
      const b = { x: box.x + box.w * BUTTON.x, y: box.y + box.h * BUTTON.y }

      /* le faisceau reste dans l'espace central, entre les colonnes de cartes */
      const cx = main.width / 2 + (i - (colors.length - 1) / 2) * 0.65
      const dir = b.x > cx ? 1 : -1
      const bend = Math.min(20, Math.abs(b.x - cx) / 2)
      const exit = box.y - 9 - (i % 4) * 3
      const h = (trunkTop - a.y) * 0.62
      const run =
        `M${a.x} ${a.y} C${a.x} ${a.y + h} ${cx} ${trunkTop - h} ${cx} ${trunkTop}` +
        ` L${cx} ${exit - bend} Q${cx} ${exit} ${cx + dir * bend} ${exit}` +
        ` L${b.x - dir * bend} ${exit} Q${b.x} ${exit} ${b.x} ${exit + bend} L${b.x} ${b.y}`

      measure.setAttribute('d', run)
      t.run = measure.getTotalLength()
      sample(t, run + coilPath(box))

      /* dans le faisceau, les fils s'entrelacent légèrement */
      for (let k = 0; k < t.xs.length; k++) {
        const y = t.ys[k]
        t.xs[k] += 1.5 * Math.sin(y * 0.03 + i * 1.1) * smooth(trunkTop, trunkTop + 60, y) * (1 - smooth(exit - bend - 50, exit - bend, y)) * (k * STEP < t.run ? 1 : 0)
      }

      const capY = r.top + r.height * BUTTON.y + scrollY
      t.from = release - hold + i * STAGGER
      t.done = Math.min(capY - vh * HEAD_AT + vh * 0.42, maxScroll - (colors.length - i) * 2)
      t.arrive = Math.min(capY - vh * HEAD_AT, t.done - vh * 0.2)
    })
    last = -1
  }

  /* un fil : ombre, âme colorée, puis les brins torsadés et quelques fibres qui dépassent */
  function paint(t, k0, k1, dy) {
    const { xs, ys } = t
    const line = () => {
      ctx.beginPath()
      ctx.moveTo(xs[k0], ys[k0] + dy)
      for (let k = k0 + 1; k <= k1; k++) ctx.lineTo(xs[k], ys[k] + dy)
    }
    ctx.lineJoin = ctx.lineCap = 'round'

    ctx.save()
    ctx.translate(0.7, 1.3)
    line()
    ctx.strokeStyle = 'rgba(0,0,0,.2)'
    ctx.lineWidth = width + 0.8
    ctx.stroke()
    ctx.restore()

    line()
    ctx.strokeStyle = t.base
    ctx.lineWidth = width
    ctx.stroke()

    /* brins : traits obliques réguliers, sombres puis clairs, comme un fil retors */
    const half = width / 2
    const strands = (shift, colour, size) => {
      ctx.beginPath()
      for (let k = k0 + shift; k < k1; k += 2) {
        const tx = xs[k + 1] - xs[k]
        const ty = ys[k + 1] - ys[k]
        const l = Math.hypot(tx, ty) || 1
        const ux = tx / l
        const uy = ty / l
        const y = ys[k] + dy
        ctx.moveTo(xs[k] - uy * half - ux * 1.4, y + ux * half - uy * 1.4)
        ctx.lineTo(xs[k] + uy * half + ux * 1.4, y - ux * half + uy * 1.4)
      }
      ctx.strokeStyle = colour
      ctx.lineWidth = size
      ctx.lineCap = 'butt'
      ctx.stroke()
    }
    strands(0, t.dark, 1)
    strands(1, t.light, 0.8)

    /* fibres : rares et fines, c'est ce qui enlève le côté trop parfait */
    ctx.beginPath()
    for (let k = k0 + (k0 % 11 ? 11 - (k0 % 11) : 0); k < k1; k += 11) {
      const seed = Math.sin(k * 12.9898 + t.i * 78.233) * 43758.5453
      const r = seed - Math.floor(seed)
      if (r < 0.45) continue
      const side = r > 0.72 ? 1 : -1
      ctx.moveTo(xs[k], ys[k] + dy)
      ctx.lineTo(xs[k] + side * (half + 1.5 + r * 2.5), ys[k] + dy - 1.5 + r * 3)
    }
    ctx.strokeStyle = t.dark
    ctx.lineWidth = 0.5
    ctx.stroke()
  }

  function update(y) {
    if (finished || y === last) return
    last = y
    lowest = Math.max(lowest, y)
    /* dès qu'on remonte, les fils s'effacent et la grille reste en couleurs pour de bon */
    if (lowest > threads[0].from && y < lowest - UP_MARGIN) return finish()

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    /* pendant que l'écran reste immobile, les fils restent accrochés aux pastilles */
    const dy = originY - y + Math.min(0, y - release)
    const screenTop = -dy - 12
    const screenBottom = screenTop + innerHeight + 24

    for (const t of threads) {
      const reach = clamp((lowest - t.from) / Math.max(1, t.arrive - t.from))
      const wrap = clamp((lowest - t.arrive) / Math.max(1, t.done - t.arrive))
      t.img.style.opacity = smooth(0.25, 0.85, wrap).toFixed(3)

      /* la pointe descend puis tourne ; la queue la rattrape et rentre dans la casquette */
      const head = t.run * reach + (t.length - t.run) * Math.min(1, wrap / 0.6)
      const tail = t.length * smooth(0.5, 1, wrap)
      if (head - tail < 1) continue

      let k0 = Math.floor(tail / STEP)
      let k1 = Math.min(t.xs.length - 1, Math.floor(head / STEP))
      /* on ne peint que la partie à l'écran */
      while (k0 < k1 && t.ys[k0] < screenTop) k0++
      while (k1 > k0 && t.ys[k1] > screenBottom && k1 * STEP < t.run) k1--
      if (k1 > k0) paint(t, k0, k1, dy)
    }
  }

  return { layout, update, fit }
}
