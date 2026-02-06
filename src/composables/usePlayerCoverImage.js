import { ref, watch } from 'vue'
import { loadConnection } from '../services/emby.js'
import { makeBaseUrl } from '../services/mediaUtils.js'
import { resolveEmbyImageSrc } from '../utils/embyImageUtils.js'
import { buildArtistPrimaryFallbackSrc } from './useEmbyCoverImage.js'
import { rgbToHsl } from '../utils/colorUtils.js'
import defaultCover from '../assets/default_cover.png'

function extractBaseWithEmby(url) {
  const u = String(url || '')
  const lower = u.toLowerCase()
  const idx = lower.indexOf('/emby/')
  if (idx === -1) return ''
  return `${u.slice(0, idx)}/emby`
}

async function fetchImageAsDataUrl(url, token) {
  if (!url || !token || !window?.octo?.embyFetchImage) return ''
  try {
    const result = await window.octo.embyFetchImage({ url, token })
    if (!result?.contentType || !result?.buffer) return ''
    return `data:${result.contentType};base64,${result.buffer}`
  } catch {
    return ''
  }
}

export function usePlayerCoverImage(nowPlaying) {
  const coverImageUrl = ref('')

  function computeVinylGradient(imageUrl) {
    const img = new Image()
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'Anonymous'
    }
    img.src = imageUrl
    img.onload = () => {
      let canvas = null
      try {
        canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data

        const step = 4 * 20
        const minLum = 0.12
        const maxLum = 0.92

        const buckets = new Map()
        for (let i = 0; i < data.length; i += step) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          if (lum < minLum || lum > maxLum) continue
          const hue = rgbToHsl(r, g, b).h
          const bucket = Math.round(hue * 36) / 36
          const entry = buckets.get(bucket) || { r: 0, g: 0, b: 0, count: 0 }
          entry.r += r
          entry.g += g
          entry.b += b
          entry.count++
          buckets.set(bucket, entry)
        }

        let colors = Array.from(buckets.entries())
          .filter(([, v]) => v.count > 0)
          .map(([h, v]) => ({
            h,
            r: Math.round(v.r / v.count),
            g: Math.round(v.g / v.count),
            b: Math.round(v.b / v.count),
            count: v.count,
          }))
          .sort((a, b) => b.count - a.count)

        if (!colors.length) {
          let sr = 0, sg = 0, sb = 0, c = 0
          for (let i = 0; i < data.length; i += step) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
            if (lum < 0.06 || lum > 0.96) continue
            sr += r
            sg += g
            sb += b
            c++
          }
          if (c > 0) {
            const ar = Math.round(sr / c)
            const ag = Math.round(sg / c)
            const ab = Math.round(sb / c)
            const h = rgbToHsl(ar, ag, ab).h
            colors = [{ h, r: ar, g: ag, b: ab, count: c }]
          }
        }
      } catch (err) {
        console.warn('Failed to compute vinyl gradient:', err)
      } finally {
        if (canvas) {
          try { canvas.remove?.() } catch {}
        }
        img.onload = null
        img.onerror = null
        img.src = ''
      }
    }
    img.onerror = () => {
      img.onload = null
      img.onerror = null
      img.src = ''
    }
  }

  watch(
    () => nowPlaying.value?.coverUrl,
    async (coverInfo) => {
      const artistId = nowPlaying.value?.raw?.ArtistItems?.[0]?.Id || ''

      if (!coverInfo) {
        if (artistId) {
          const { token, serverUrl } = loadConnection()
          const base = makeBaseUrl(serverUrl)
          const artistUrl = base ? `${base}/emby/Items/${encodeURIComponent(artistId)}/Images/Primary?quality=80` : ''
          const data = await fetchImageAsDataUrl(artistUrl, token)
          if (data) {
            coverImageUrl.value = data
            computeVinylGradient(data)
            return
          }
        }
        coverImageUrl.value = defaultCover
        return
      }

      if (typeof coverInfo === 'object' && coverInfo.url && coverInfo.token) {
        try {
          const data = await fetchImageAsDataUrl(coverInfo.url, coverInfo.token)
          if (!data) throw new Error('empty image data')
          coverImageUrl.value = data
          computeVinylGradient(coverImageUrl.value)
        } catch {
          const directSrc = resolveEmbyImageSrc(coverInfo)
          if (directSrc) {
            coverImageUrl.value = directSrc
            setTimeout(() => computeVinylGradient(directSrc), 100)
            return
          }

          if (artistId) {
            const baseWithEmby = extractBaseWithEmby(coverInfo.url)
            const artistUrl = baseWithEmby
              ? `${baseWithEmby}/Items/${encodeURIComponent(artistId)}/Images/Primary?quality=80`
              : ''
            const artistData = await fetchImageAsDataUrl(artistUrl, coverInfo.token)
            if (artistData) {
              coverImageUrl.value = artistData
              computeVinylGradient(coverImageUrl.value)
              return
            }

            const artistSrc = buildArtistPrimaryFallbackSrc(coverInfo, artistId)
            if (artistSrc) {
              coverImageUrl.value = artistSrc
              setTimeout(() => computeVinylGradient(artistSrc), 100)
              return
            }
          }

          coverImageUrl.value = defaultCover
        }
      } else if (typeof coverInfo === 'string') {
        coverImageUrl.value = coverInfo
        if (coverInfo) setTimeout(() => computeVinylGradient(coverInfo), 100)
      }
    },
    { immediate: true }
  )

  return { coverImageUrl, computeVinylGradient }
}
