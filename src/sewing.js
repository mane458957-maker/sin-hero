/* Fin du hero : chaque pastille lâche un fil qui descend coudre la casquette de sa couleur.
   Tout est lié au scroll. La pointe du fil glisse de la pastille jusqu'au repère HEAD_AT de l'écran,
   elle reste donc toujours visible, même quand la casquette est loin en bas sur téléphone. */
const SVG = 'http://www.w3.org/2000/svg'
const HEAD_AT = 0.62
const STAGGER = 14
/* repères sur les photos produit : le bouton du dessus, puis un rang de couture sur la couronne */
const BUTTON = { x: 0.545, y: 0.33 }
const SEAM = [{ x: 0.36, y: 0.5 }, { x: 0.5, y: 0.58 }, { x: 0.66, y: 0.53 }]

const clamp = (v) => Math.min(1, Math.max(0, v))

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

export function createSewing({ svg, hero, pin, copy, swatches, cards, colors }) {
  const make = (color) => {
    const path = (attrs) => {
      const p = document.createElementNS(SVG, 'path')
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke-linecap', 'round')
      for (const k in attrs) p.setAttribute(k, attrs[k])
      svg.append(p)
      return p
    }
    /* les fils clairs ont un liseré, sinon ils disparaissent sur le blanc */
    const edge = isLight(color.hex) ? path({ stroke: 'rgba(0,0,0,.22)', 'stroke-width': 3.2 }) : null
    return { edge, line: path({ stroke: color.hex, 'stroke-width': 2 }), seam: path({ stroke: color.hex, 'stroke-width': 1.8, 'stroke-dasharray': '6 5', opacity: 0 }) }
  }
  const threads = colors.map((color, i) => ({ ...make(color), img: cards[i].querySelector('img'), from: 0, to: 1, length: 1, shown: -1 }))
  let last = -1

  function layout() {
    const main = svg.parentElement.getBoundingClientRect()
    const root = pin.getBoundingClientRect()
    const heroEnd = hero.getBoundingClientRect().bottom - main.top - pin.clientHeight
    const vh = innerHeight
    const maxScroll = document.documentElement.scrollHeight - vh - 8
    const offset = main.top + scrollY

    /* la position des pastilles sans le petit décalage d'apparition du texte */
    const saved = copy.style.transform
    copy.style.transform = 'none'
    const starts = [...swatches.children].map((b) => {
      const r = b.getBoundingClientRect()
      return { x: r.left + r.width / 2 - main.left, y: heroEnd + r.bottom - root.top }
    })
    copy.style.transform = saved

    const top = Math.min(...starts.map((s) => s.y)) - 4
    const lastCard = cards[cards.length - 1].getBoundingClientRect()
    svg.style.top = `${top}px`
    svg.setAttribute('width', main.width)
    svg.setAttribute('height', lastCard.bottom - main.top - top)

    threads.forEach((t, i) => {
      const r = t.img.getBoundingClientRect()
      const at = (p) => ({ x: r.left - main.left + r.width * p.x, y: r.top - main.top + r.height * p.y - top })
      const a = { x: starts[i].x, y: starts[i].y - top }
      const b = at(BUTTON)
      const firstRow = cards[0].getBoundingClientRect().top
      const lane =
        r.top - firstRow > 8
          ? { x: r.left - main.left - 7 + (i % 3) - 1, top: firstRow - main.top - top - 14, bottom: r.top - main.top - top - 12 }
          : null
      const d = threadPath(a, b, i, lane)
      t.line.setAttribute('d', d)
      t.edge?.setAttribute('d', d)
      const [s0, s1, s2] = SEAM.map(at)
      t.seam.setAttribute('d', `M${b.x} ${b.y} L${s0.x} ${s0.y} Q${s1.x} ${s1.y} ${s2.x} ${s2.y}`)
      t.length = t.line.getTotalLength()
      for (const p of [t.line, t.edge]) if (p) p.style.strokeDasharray = t.length

      const capY = r.top + r.height * BUTTON.y + scrollY
      t.from = heroEnd + offset + i * STAGGER
      t.to = Math.min(capY - vh * HEAD_AT, maxScroll - (colors.length - i) * 4)
      t.shown = -1
    })
    last = -1
  }

  function update(y) {
    if (y === last) return
    last = y
    for (const t of threads) {
      const progress = clamp((y - t.from) / Math.max(1, t.to - t.from))
      if (progress === t.shown) continue
      t.shown = progress
      const offset = t.length * (1 - progress)
      t.line.style.strokeDashoffset = offset
      if (t.edge) t.edge.style.strokeDashoffset = offset
      t.line.style.opacity = progress > 0 ? 1 : 0
      if (t.edge) t.edge.style.opacity = progress > 0 ? 1 : 0
      /* le fil apporte la couleur : la casquette reste grise jusqu'à son arrivée */
      const sewn = clamp((progress - 0.9) / 0.1)
      t.seam.setAttribute('opacity', sewn)
      t.img.style.filter = `grayscale(${(1 - sewn).toFixed(3)})`
      t.img.style.opacity = (0.4 + 0.6 * sewn).toFixed(3)
    }
  }

  return { layout, update }
}
