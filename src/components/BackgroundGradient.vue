<template>
  <div>
    <div class="background-gradient" :style="{ background: backgroundGradient }"></div>
    <div class="background-overlay"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  coverUrl: { type: [String, Object], default: null }
})

const hoverColor = ref('rgba(120, 150, 190, 0.24)')
const targetColor = ref('rgba(120, 150, 190, 0.2)')
let animationFrame = null
let loadToken = 0

function setGlobalCommonColor(color) {
  try {
    document?.documentElement?.style?.setProperty('--octo-bg-common-color', color)
  } catch {}
}

const COOL_TINT = { r: 120, g: 150, b: 190 }

function parseRgba(rgbaString) {
  const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/)
  if (!match) return { r: 0, g: 0, b: 0, a: 0 }
  return {
    r: parseInt(match[1]),
    g: parseInt(match[2]),
    b: parseInt(match[3]),
    a: parseFloat(match[4] || 1)
  }
}

function extractColorFromImage(imageUrl) {
  if (!imageUrl) return

  const img = new Image()
  img.crossOrigin = 'Anonymous'
  
  img.onerror = () => {
    // CORS or network error - silently ignore in dev mode
  }

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const step = 4 * 10
      const minLum = 0.12
      const maxLum = 0.92

      let r = 0, g = 0, b = 0, count = 0
      for (let i = 0; i < data.length; i += step) {
        const pr = data[i]
        const pg = data[i + 1]
        const pb = data[i + 2]
        const lum = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255
        if (lum < minLum || lum > maxLum) continue
        r += pr
        g += pg
        b += pb
        count++
      }

      if (count === 0) {
        for (let i = 0; i < data.length; i += step) {
          const pr = data[i]
          const pg = data[i + 1]
          const pb = data[i + 2]
          const lum = (0.2126 * pr + 0.7152 * pg + 0.0722 * pb) / 255
          if (lum < 0.06 || lum > 0.96) continue
          r += pr
          g += pg
          b += pb
          count++
        }
      }

      if (count === 0) {
        const cx = Math.floor(canvas.width / 2)
        const cy = Math.floor(canvas.height / 2)
        const idx = (cy * canvas.width + cx) * 4
        r = data[idx] || 90
        g = data[idx + 1] || 100
        b = data[idx + 2] || 120
      } else {
        r = Math.floor(r / count)
        g = Math.floor(g / count)
        b = Math.floor(b / count)
      }

      const mix = 0.35
      const br = Math.round(r * (1 - mix) + COOL_TINT.r * mix)
      const bg = Math.round(g * (1 - mix) + COOL_TINT.g * mix)
      const bb = Math.round(b * (1 - mix) + COOL_TINT.b * mix)

      targetColor.value = `rgba(${br}, ${bg}, ${bb}, 0.22)`
      animateColorTransition()
    } catch {
      // Canvas tainted by CORS - silently ignore
    }
  }

  img.src = imageUrl
}

async function resolveCoverToImageUrl(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return raw

  if (typeof raw === 'object' && raw.url && raw.token && window?.octo?.embyFetchImage) {
    try {
      const result = await window.octo.embyFetchImage({ url: raw.url, token: raw.token })
      if (result?.buffer && result?.contentType) {
        return `data:${result.contentType};base64,${result.buffer}`
      }
    } catch {
      // IPC not available (dev mode) - fall through to proxy
    }
  }

  // Dev mode: use Vite proxy to avoid CORS
  if (typeof raw === 'object' && raw.url) {
    const isDev = import.meta.env.DEV
    let url = raw.url
    
    // In dev mode, convert to relative /emby/ path for Vite proxy
    if (isDev) {
      try {
        const parsed = new URL(raw.url)
        const embyIdx = parsed.pathname.indexOf('/emby/')
        if (embyIdx !== -1) {
          url = parsed.pathname.slice(embyIdx) + parsed.search
        }
      } catch {}
    }
    
    const separator = url.includes('?') ? '&' : '?'
    const tokenPart = raw.token ? `${separator}X-Emby-Token=${encodeURIComponent(raw.token)}` : ''
    return `${url}${tokenPart}`
  }
  return null
}

function animateColorTransition() {
  if (animationFrame) cancelAnimationFrame(animationFrame)

  const start = parseRgba(hoverColor.value)
  const end = parseRgba(targetColor.value)
  const duration = 800
  const startTime = performance.now()

  const step = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)

    const r = Math.round(start.r + (end.r - start.r) * eased)
    const g = Math.round(start.g + (end.g - start.g) * eased)
    const b = Math.round(start.b + (end.b - start.b) * eased)
    const a = start.a + (end.a - start.a) * eased

    const next = `rgba(${r}, ${g}, ${b}, ${a})`
    hoverColor.value = next
    setGlobalCommonColor(next)

    if (progress < 1) {
      animationFrame = requestAnimationFrame(step)
    } else {
      animationFrame = null
    }
  }

  animationFrame = requestAnimationFrame(step)
}

watch(
  () => hoverColor.value,
  (val) => setGlobalCommonColor(val),
  { immediate: true }
)

const backgroundGradient = computed(() =>
  [
    `radial-gradient(circle at center, ${hoverColor.value} 0%, transparent 110%)`,
    'radial-gradient(circle at bottom left, rgba(0, 0, 0, 0.3) 0%, transparent 65%)',
    'radial-gradient(circle at bottom right, rgba(0, 0, 0, 0.3) 0%, transparent 65%)',
    'linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, transparent 48%, rgba(0, 0, 0, 0.5) 100%)',
    'linear-gradient(to right, rgba(0, 0, 0, 0.25) 0%, transparent 25%, transparent 75%, rgba(0, 0, 0, 0.25) 100%)'
  ].join(', ')
)

watch(
  () => props.coverUrl,
  async (url) => {
    const token = ++loadToken
    const resolved = await resolveCoverToImageUrl(url)
    if (token !== loadToken) return
    if (resolved) extractColorFromImage(resolved)
  },
  { immediate: true }
)
</script>

<style scoped>
.background-gradient {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  transition: background 6s ease;
}

.background-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;

  /* CSS-only subtle texture + extra depth.
     Tinted by the same variable the gradient logic updates. */
  background-image:
    radial-gradient(circle at 22% 18%, var(--octo-bg-common-color) 0%, transparent 58%),
    radial-gradient(circle at 78% 28%, rgba(255, 255, 255, 0.05) 0%, transparent 52%),
    radial-gradient(circle at 15% 85%, rgba(0, 0, 0, 0.22) 0%, transparent 55%),
    repeating-linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.035) 0px,
      rgba(255, 255, 255, 0.035) 1px,
      transparent 1px,
      transparent 9px
    );
  background-size: cover;
  background-position: center;
  opacity: 0.14;
}
</style>
