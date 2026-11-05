/* Film au scroll, même principe que les sites modèles : les fichiers compressés restent en mémoire,
   seule une petite fenêtre d'images décodées existe autour de la position, pour tenir sur téléphone.
   Le chargement va du grossier au fin : tout point du film a vite une image proche. */
const pad = (i) => String(i + 1).padStart(4, '0')

export function createFilm(canvas, { count, path, window: size }) {
  const ctx = canvas.getContext('2d')
  const blobs = new Array(count)
  const decoded = new Map()
  const pending = new Set()
  let wanted = 0
  let shown = -1

  function order() {
    const seen = new Set([0])
    const list = [0]
    for (let step = 32; step >= 1; step >>= 1) {
      for (let i = 0; i < count; i += step) {
        if (!seen.has(i)) {
          seen.add(i)
          list.push(i)
        }
      }
    }
    return list
  }

  async function load() {
    const queue = order()
    const worker = async () => {
      while (queue.length) {
        const i = queue.shift()
        /* le serveur peut refuser une image au milieu du lot : on réessaie, sinon la plus proche la remplace */
        for (let attempt = 0; attempt < 3 && !blobs[i]; attempt++) {
          try {
            const res = await fetch(`${path}f_${pad(i)}.webp`)
            if (res.ok) blobs[i] = await res.blob()
            else await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          } catch {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
          }
        }
        if (blobs[i] && Math.abs(i - wanted) < 3) request()
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker))
  }

  function nearest(i) {
    for (let d = 0; d < count; d++) {
      if (decoded.has(i - d)) return i - d
      if (decoded.has(i + d)) return i + d
    }
    return -1
  }

  function evict() {
    if (decoded.size <= size) return
    const far = [...decoded.keys()].sort((a, b) => Math.abs(b - wanted) - Math.abs(a - wanted))
    for (const i of far.slice(0, decoded.size - size)) {
      decoded.get(i).close()
      decoded.delete(i)
    }
  }

  function decode(i) {
    if (i < 0 || i >= count || !blobs[i] || decoded.has(i) || pending.has(i)) return
    pending.add(i)
    createImageBitmap(blobs[i])
      .then((bmp) => {
        decoded.set(i, bmp)
        evict()
        paint()
      })
      .catch(() => {
        blobs[i] = undefined
      })
      .finally(() => pending.delete(i))
  }

  function request() {
    decode(wanted)
    for (let d = 1; d <= 10 && pending.size < 6; d++) {
      decode(wanted + d)
      decode(wanted - d)
    }
  }

  function paint() {
    const i = nearest(wanted)
    if (i < 0 || i === shown) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(decoded.get(i), 0, 0, canvas.width, canvas.height)
    shown = i
  }

  function seek(position) {
    const i = Math.max(0, Math.min(count - 1, Math.round(position)))
    if (i === wanted && shown === i) return
    wanted = i
    request()
    paint()
  }

  load()
  return { seek }
}
