export function rgbToHsl(r, g, b) {
    r /= 255
    g /= 255
    b /= 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0,
        s = 0
    const l = (max + min) / 2

    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                break
            case g:
                h = ((b - r) / d + 2) / 6
                break
            case b:
                h = ((r - g) / d + 4) / 6
                break
        }
    }
    return { h, s, l }
}

export function hslToRgb(h, s, l) {
    let r, g, b
    if (s === 0) {
        r = g = b = l
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) {
                t += 1
            }
            if (t > 1) {
                t -= 1
            }
            if (t < 1 / 6) {
                return p + (q - p) * 6 * t
            }
            if (t < 1 / 2) {
                return q
            }
            if (t < 2 / 3) {
                return p + (q - p) * (2 / 3 - t) * 6
            }
            return p
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1 / 3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1 / 3)
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    }
}

export function blendRgb(r1, g1, b1, r2, g2, b2, factor) {
    return {
        r: Math.round(r1 * (1 - factor) + r2 * factor),
        g: Math.round(g1 * (1 - factor) + g2 * factor),
        b: Math.round(b1 * (1 - factor) + b2 * factor),
    }
}

export function generateGradientFromTitle(title) {
    if (!title || typeof title !== 'string') {
        return 'linear-gradient(135deg, #364259, #000)'
    }

    const cleanTitle = title.replace(/[^a-zA-Z]/g, '').toUpperCase()
    if (cleanTitle.length === 0) {
        return 'linear-gradient(135deg, #364259, #000)'
    }

    const colors = [
        '#5B6CFF',
        '#4FD1C5',
        '#68D391',
        '#F6AD55',
        '#FC8181'
    ]

    const firstChar = cleanTitle[0]
    const charCode = firstChar.charCodeAt(0) - 65
    const colorIndex = charCode % colors.length
    const selectedColor = colors[colorIndex]

    return `linear-gradient(135deg, ${selectedColor} 0%, #000 100%)`
}

export function computeVinylGradient(imageUrl, onGradientComputed) {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = imageUrl
    img.onload = () => {
        try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            const w = (canvas.width = img.width)
            const h = (canvas.height = img.height)
            ctx.drawImage(img, 0, 0)
            const data = ctx.getImageData(0, 0, w, h).data

            const step = 4 * 20
            const minLum = 0.12
            const maxLum = 0.92

            const buckets = new Map()
            for (let i = 0; i < data.length; i += step) {
                const r = data[i]
                const g = data[i + 1]
                const b = data[i + 2]
                const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
                if (lum < minLum || lum > maxLum) { continue }
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
                    if (lum < 0.06 || lum > 0.96) { continue }
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

            const base = colors[0] || { r: 90, g: 100, b: 120 }
            const hsl = rgbToHsl(base.r, base.g, base.b)
            const tint1 = hslToRgb(
                hsl.h,
                Math.max(0, hsl.s * 0.85),
                Math.min(1, hsl.l * 1.12)
            )
            const tint2 = hslToRgb(
                hsl.h,
                Math.max(0, hsl.s * 0.75),
                Math.max(0, hsl.l * 0.92)
            )
            const c1s = `rgba(${tint1.r}, ${tint1.g}, ${tint1.b}, 0.70)`
            const c2s = `rgba(${tint2.r}, ${tint2.g}, ${tint2.b}, 0.30)`
            onGradientComputed(`linear-gradient(135deg, ${c1s}, ${c2s})`)
            // eslint-disable-next-line no-unused-vars
        } catch (e) {
            // silently ignore errors and use default gradient
        }
    }
}
