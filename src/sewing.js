/* Fin du hero : chaque pastille lâche un fil qui descend, s'enroule autour d'une casquette blanche,
   lui donne sa couleur, puis disparaît à l'intérieur comme s'il était cousu. Tout est lié au scroll.
   La pointe glisse de la pastille jusqu'au repère HEAD_AT de l'écran : elle reste toujours visible,
   même quand la casquette est loin en bas sur téléphone. */
const SVG = 'http://www.w3.org/2000/svg'
const HEAD_AT = 0.7
const STAGGER = 22
/* repères sur les photos produit : le bouton du dessus, puis la couronne autour de laquelle le fil tourne */
const BUTTON = { x: 0.545, y: 0.33 }
const COIL = { x: 0.535, rx: 0.235, ry: 0.052, top: 0.37, bottom: 0.6, turns: 3.5 }

const clamp = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function isLight(hex) {
  const n = parseInt(hex.slice(1), 16)
  return (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255 > 0.72
}

/* un fil souple : quelques ondulations qui se calment en arrivant */
function threadPath(a, b, i, lane) {
  const side = i % 2 ? 1 : -1
  const sway = 26 + (i * 17) % 44
  const points = [a]
  /* les rangées du bas passent par l'espace entre les cartes : chaque fil ne touche que sa casquette */
  const end = lane ? { x: lane.x, y: lane.top } : b
  for (const [f, s] of [[0.28, 1], [0.58, -0.8], [0.84, 0.35]]) {
    points.push({ x: a.x + (end.x - a.x) * f + sway * s * side, y: a.y + (end.y - a.y) * f })
  }
  if (lane) points.push({ x: lane.x, y: lane.top }, { x: lane.x, y: lane.bottom })
  points.push(b)
  let d = `M${a.x} ${a.y}`
  for (let k = 1; k < points.length; k++) {
    const p = points[k - 1]
    const q = points[k]
    const h = (q.y - p.y) * 0.5
    d += ` C${p.x} ${p.y + h} ${q.x} ${q.y - h} ${q.x} ${q.y}`
  }
  return d
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

export function createSewing({ svg, hero, pin, copy, swatches, cards, colors, holdRatio }) {
  const make = (color) => {
    const path = (attrs) => {
      const p = document.createElementNS(SVG, 'path')
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke-linecap', 'round')
      p.setAttribute('stroke-linejoin', 'round')
      for (const k in attrs) p.setAttribute(k, attrs[k])
      svg.append(p)
      return p
    }
    /* les fils clairs ont un liseré, sinon ils disparaissent sur le blanc */
    const edge = isLight(color.hex) ? path({ stroke: 'rgba(0,0,0,.24)', 'stroke-width': 3.4 }) : null
    return { edge, line: path({ stroke: color.hex, 'stroke-width': 2.2 }) }
  }
  const threads = colors.map((color, i) => ({
    ...make(color),
    img: cards[i].querySelector('.tint'),
    from: 0,
    arrive: 1,
    done: 2,
    run: 1,
    length: 1,
  }))
  threads.forEach((t) => (t.img.style.opacity = 0))
  let last = -1
  let release = 0

  function layout() {
    const main = svg.parentElement.getBoundingClientRect()
    const root = pin.getBoundingClientRect()
    const heroEnd = hero.getBoundingClientRect().bottom - main.top - pin.clientHeight
    const vh = innerHeight
    const maxScroll = document.documentElement.scrollHeight - vh - 2
    const base = main.top + scrollY
    release = heroEnd + base
    const hold = hero.offsetHeight * holdRatio

    /* la position des pastilles sans le petit décalage d'apparition du texte */
    const saved = copy.style.transform
    copy.style.transform = 'none'
    const starts = [...swatches.children].map((b) => {
      const r = b.getBoundingClientRect()
      return { x: r.left + r.width / 2 - main.left, y: heroEnd + r.bottom - root.top }
    })
    copy.style.transform = saved

    const shift = svg.style.transform
    svg.style.transform = 'none'
    const top = Math.min(...starts.map((s) => s.y)) - 4
    const lastCard = cards[cards.length - 1].getBoundingClientRect()
    svg.style.top = `${top}px`
    svg.setAttribute('width', main.width)
    svg.setAttribute('height', lastCard.bottom - main.top - top)
    svg.style.transform = shift

    const firstRow = cards[0].getBoundingClientRect().top
    threads.forEach((t, i) => {
      const r = t.img.getBoundingClientRect()
      const box = { x: r.left - main.left, y: r.top - main.top - top, w: r.width, h: r.height }
      const a = { x: starts[i].x, y: starts[i].y - top }
      const b = { x: box.x + box.w * BUTTON.x, y: box.y + box.h * BUTTON.y }
      const lane = r.top - firstRow > 8 ? { x: box.x - 7 + (i % 3) - 1, top: firstRow - main.top - top - 14, bottom: box.y - 12 } : null

      const run = threadPath(a, b, i, lane)
      t.line.setAttribute('d', run)
      t.run = t.line.getTotalLength()
      const d = run + coilPath(box)
      t.line.setAttribute('d', d)
      t.edge?.setAttribute('d', d)
      t.length = t.line.getTotalLength()

      const capY = r.top + r.height * BUTTON.y + scrollY
      t.from = release - hold + i * STAGGER
      t.done = Math.min(capY - vh * HEAD_AT + vh * 0.42, maxScroll - (colors.length - i) * 2)
      t.arrive = Math.min(capY - vh * HEAD_AT, t.done - vh * 0.2)
    })
    last = -1
  }

  function update(y) {
    if (y === last) return
    last = y
    /* pendant que l'écran reste immobile, les fils restent accrochés aux pastilles */
    svg.style.transform = `translateY(${Math.min(0, y - release).toFixed(1)}px)`
    for (const t of threads) {
      const reach = clamp((y - t.from) / Math.max(1, t.arrive - t.from))
      const wrap = clamp((y - t.arrive) / Math.max(1, t.done - t.arrive))

      /* la pointe descend puis tourne ; la queue la rattrape et rentre dans la casquette */
      const head = t.run * reach + (t.length - t.run) * Math.min(1, wrap / 0.6)
      const tail = t.length * smooth(0.5, 1, wrap)
      const visible = Math.max(0, head - tail)
      for (const p of [t.line, t.edge]) {
        if (!p) continue
        p.style.strokeDasharray = `${visible.toFixed(1)} ${(t.length + 20).toFixed(0)}`
        p.style.strokeDashoffset = (-tail).toFixed(1)
        p.style.opacity = visible > 0.5 ? 1 : 0
      }
      t.img.style.opacity = smooth(0.25, 0.85, wrap).toFixed(3)
    }
  }

  return { layout, update }
}
