/* Ouverture : un monogramme SIN ton sur ton couvre le noir, et une vague de lumière rouge le traverse.
   Le motif utilise les vraies lettres du logo, dessinées une fois puis répétées. */
import logo from './logo.json'

const RED = '#d3141e'

function tile(width, ratio) {
  const all = logo.flatMap((l) => l.pts)
  const minX = Math.min(...all.map((p) => p[0]))
  const maxX = Math.max(...all.map((p) => p[0]))
  const minY = Math.min(...all.map((p) => p[1]))
  const maxY = Math.max(...all.map((p) => p[1]))
  const scale = (width * ratio) / (maxX - minX)
  const c = document.createElement('canvas')
  c.width = Math.ceil(width * ratio)
  c.height = Math.ceil((maxY - minY) * scale)
  const ctx = c.getContext('2d')
  ctx.fillStyle = RED
  for (const l of logo) {
    ctx.beginPath()
    l.pts.forEach(([x, y], i) => {
      const X = (x - minX) * scale
      const Y = c.height - (y - minY) * scale
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y)
    })
    ctx.closePath()
    ctx.fill()
  }
  return c
}

export function createMonogram(canvas) {
  const ctx = canvas.getContext('2d')
  let width = 1
  let height = 1
  let ratio = 1
  let stamp = null
  let stampW = 1
  let stampH = 1
  let gapX = 1
  let gapY = 1
  let empty = false

  return {
    resize(w, h) {
      width = w
      height = h
      ratio = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
      stampW = Math.min(46, Math.max(30, w * 0.036))
      stamp = tile(stampW, ratio)
      stampH = stamp.height / ratio
      gapX = stampW * 2.1
      gapY = stampH * 2.7
      empty = false
    },
    draw(time, level) {
      if (level <= 0) {
        if (!empty) ctx.clearRect(0, 0, canvas.width, canvas.height)
        empty = true
        return
      }
      empty = false
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      /* la vague traverse l'écran en diagonale, puis repart du coin */
      const travel = width + height
      const wave = (((time * 0.16) % 1.5) - 0.25) * travel
      const spread = travel * 0.13
      let row = 0
      for (let y = gapY * 0.3; y < height + gapY; y += gapY, row++) {
        for (let x = (row % 2) * (gapX / 2) - gapX / 2; x < width + gapX; x += gapX) {
          const d = (x + y - wave) / spread
          ctx.globalAlpha = level * (0.1 + 0.6 * Math.exp(-d * d))
          ctx.drawImage(stamp, x, y, stampW, stampH)
        }
      }
      ctx.globalAlpha = 1
    },
  }
}
