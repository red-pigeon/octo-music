export function resolveEmbyImageSrc(imageInfo) {
    if (!imageInfo) {
        return ''
    }

    if (typeof imageInfo === 'object' && imageInfo.url) {
        let url = String(imageInfo.url)
        const token = String(imageInfo.token || '').trim()
        
        // In dev mode, convert absolute Emby URLs to relative /emby/ paths for Vite proxy
        if (import.meta.env.DEV) {
            try {
                const parsed = new URL(url)
                const embyIdx = parsed.pathname.indexOf('/emby/')
                if (embyIdx !== -1) {
                    url = parsed.pathname.slice(embyIdx) + parsed.search
                }
            } catch {}
        }
        
        if (!token) {
            return url
        }
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}X-Emby-Token=${encodeURIComponent(token)}`
    }

    return String(imageInfo)
}

function extractEmbyBaseWithEmby(url) {
    const lower = String(url || '').toLowerCase()
    const idx = lower.indexOf('/emby/')
    return idx === -1 ? '' : `${String(url).slice(0, idx)}/emby`
}

function extractQueryParam(url, key) {
    try {
        return new globalThis.URL(String(url)).searchParams.get(key) || ''
    } catch {
        return ''
    }
}

export function buildEmbyItemImageSrcFromImageInfo(imageInfo, itemId, kind = 'Primary', { quality = 80 } = {}) {
    if (!imageInfo || !itemId) {
        return ''
    }

    const infoIsObject = typeof imageInfo === 'object' && imageInfo.url
    const sourceUrl = infoIsObject ? String(imageInfo.url) : String(imageInfo)
    const token = infoIsObject ? String(imageInfo.token || '') : extractQueryParam(sourceUrl, 'X-Emby-Token')

    const baseWithEmby = extractEmbyBaseWithEmby(sourceUrl)
    if (!baseWithEmby) {
        return ''
    }

    const rawUrl = `${baseWithEmby}/Items/${encodeURIComponent(itemId)}/Images/${encodeURIComponent(kind)}?quality=${encodeURIComponent(quality)}`
    return resolveEmbyImageSrc({ url: rawUrl, token })
}

