/* Ouverture : les vraies casquettes de chaque coloris tombent doucement derrière le logo.
   Dès le début du scroll, la pluie s'efface et laisse la place aux fils rouges. */
const COUNT = 16

export function createRain(canvas, { colors }) {
  const ctx = canvas.getContext('2d')
  const sprites = colors.map((c) => {
    const img = new Image()
    img.src = `./rain/${c.id}.webp`
    return img
  })
  /* positions réparties sans hasard : même rendu à chaque visite, pas d'amas */
  const drops = Array.from({ length: COUNT }, (_, i) => ({
    sprite: i % colors.length,
    x: (0.08 + i * 0.7548777) % 1,
    y: (0.31 + i * 0.5698403) % 1,
    depth: 0.55 + 0.45 * ((i * 0.3819) % 1),
    sway: i * 1.7,
  }))
  let width = 1
  let height = 1
  let ratio = 1
  let empty = false

  return {
    resize(w, h) {
      width = w
      height = h
      ratio = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(w * ratio)
      canvas.height = Math.round(h * ratio)
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
      const base = Math.min(150, Math.max(78, width * 0.11))
      for (const d of drops) {
        const img = sprites[d.sprite]
        if (!img.complete || !img.naturalWidth) continue
        const w = base * d.depth
        const h = (w * img.naturalHeight) / img.naturalWidth
        const span = height + h * 2
        /* les casquettes proches tombent plus vite, ce qui donne de la profondeur */
        const y = ((d.y * span + time * 34 * d.depth) % span) - h
        const x = d.x * (width + w) - w / 2 + Math.sin(time * 0.5 + d.sway) * 14
        ctx.save()
        ctx.globalAlpha = level * (0.32 + 0.5 * d.depth)
        ctx.translate(x, y)
        ctx.rotate(Math.sin(time * 0.6 + d.sway) * 0.16)
        ctx.drawImage(img, -w / 2, -h / 2, w, h)
        ctx.restore()
      }
    },
  }
}
