// Helper to get accent color from CSS variables
const getAccentColor = (alpha = 1) => {
    const style = getComputedStyle(document.documentElement)
    const r = style.getPropertyValue('--accent-r').trim() || '120'
    const g = style.getPropertyValue('--accent-g').trim() || '90'
    const b = style.getPropertyValue('--accent-b').trim() || '255'
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const getCanvasCoords = (freqIndex, gainValue, canvasWidth, canvasHeight, bandCount) => {
    const padding = 32
    const curveTop = 10
    const curveBottom = 150
    const x = padding + (freqIndex / (bandCount - 1)) * (canvasWidth - 2 * padding)
    const centerY = curveTop + (curveBottom - curveTop) / 2
    const gainRange = 12
    const pixelsPerGain = (curveBottom - curveTop) / (2 * gainRange)
    const y = centerY - gainValue * pixelsPerGain

    return { x, y }
}

export const interpolatePoint = (p0, p1, p2, p3, t) => {
    const t2 = t * t
    const t3 = t2 * t

    return (
        0.5 *
        (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    )
}

export const drawEQCurve = (ctx, canvas, bands, draggedPointIndex) => {
    if (!ctx || !canvas) { return }

    const logicalWidth = 340
    const logicalHeight = 180
    const width = logicalWidth
    const height = logicalHeight

    ctx.fillStyle = 'rgba(10, 10, 12, 1)'
    ctx.fillRect(0, 0, width, height)

    const centerY = 10 + (150 - 10) / 2
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.08)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, centerY)
    ctx.lineTo(width, centerY)
    ctx.stroke()
    ctx.setLineDash([])

    const controlPoints = bands.map((band, idx) => {
        const coords = getCanvasCoords(idx, band.value, width, height, bands.length)
        return coords
    })

    const extendedPoints = [
        { x: 0, y: controlPoints[0].y },
        ...controlPoints,
        { x: width, y: controlPoints[controlPoints.length - 1].y },
    ]

    const curveResolution = 100

    ctx.beginPath()
    let isFirstPoint = true

    for (let i = 0; i < extendedPoints.length - 1; i++) {
        const p0 = i === 0 ? extendedPoints[0] : extendedPoints[i - 1]
        const p1 = extendedPoints[i]
        const p2 = extendedPoints[i + 1]
        const p3 = i === extendedPoints.length - 2 ? extendedPoints[i + 1] : extendedPoints[i + 2]

        for (let j = 0; j < curveResolution; j++) {
            const t = j / curveResolution
            const x = interpolatePoint(p0.x, p1.x, p2.x, p3.x, t)
            const y = interpolatePoint(p0.y, p1.y, p2.y, p3.y, t)

            if (isFirstPoint) {
                ctx.moveTo(x, y)
                isFirstPoint = false
            } else {
                ctx.lineTo(x, y)
            }
        }
    }

    ctx.lineTo(extendedPoints[extendedPoints.length - 1].x, extendedPoints[extendedPoints.length - 1].y)
    ctx.strokeStyle = getAccentColor(0.8)
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.lineTo(extendedPoints[extendedPoints.length - 1].x, 160)
    ctx.lineTo(0, 160)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, 10, 0, 160)
    gradient.addColorStop(0, getAccentColor(0.18))
    gradient.addColorStop(0.5, getAccentColor(0.08))
    gradient.addColorStop(1, getAccentColor(0))
    ctx.fillStyle = gradient
    ctx.fill()

    controlPoints.forEach((point, idx) => {
        const isHovered = draggedPointIndex === idx
        const radius = isHovered ? 7 : 6
        const glowRadius = isHovered ? 12 : 10

        ctx.fillStyle = isHovered
            ? getAccentColor(0.3)
            : getAccentColor(0.15)
        ctx.beginPath()
        ctx.arc(point.x, point.y, glowRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = isHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.85)'
        ctx.beginPath()
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = getAccentColor(0.6)
        ctx.lineWidth = 1
        ctx.stroke()

        const gain = bands[idx].value
        if (gain !== 0) {
            ctx.fillStyle = 'rgba(200, 200, 200, 0.4)'
            ctx.font = '10px system-ui, -apple-system, sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'bottom'
            const gainText = gain > 0 ? `+${gain}` : `${gain}`
            ctx.fillText(gainText, point.x, point.y - 12)
        }
    })
}

export const getGainFromCanvasY = (y) => {
    const curveTop = 10
    const curveBottom = 150
    const centerY = curveTop + (curveBottom - curveTop) / 2
    const gainRange = 12
    const pixelsPerGain = (curveBottom - curveTop) / (2 * gainRange)
    const gainValue = (centerY - y) / pixelsPerGain

    return Math.max(-12, Math.min(12, Math.round(gainValue)))
}
