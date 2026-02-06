import { ref, isRef } from 'vue'
import { drawEQCurve, getGainFromCanvasY, getCanvasCoords } from '../utils/canvasHelpers.js'

export const useEQCanvas = (bands, onDragStart) => {
    const eqCanvasRef = ref(null)
    const canvasCtx = ref(null)
    const draggedPointIndex = ref(null)

    const getBandsArray = () => {
        return isRef(bands) ? bands.value : bands
    }

    const initCanvas = () => {
        const canvas = eqCanvasRef.value
        if (!canvas) { return }

        const ctx = canvas.getContext('2d', { alpha: true })
        if (!ctx) { return }

        canvasCtx.value = ctx
        const dpr = window.devicePixelRatio || 1
        canvas.width = 340 * dpr
        canvas.height = 180 * dpr
        ctx.scale(dpr, dpr)

        drawEQCurve(ctx, canvas, getBandsArray(), null)
    }

    const drawCurve = () => {
        const canvas = eqCanvasRef.value
        drawEQCurve(canvasCtx.value, canvas, getBandsArray(), draggedPointIndex.value)
    }

    const handleCanvasPointerDown = (e) => {
        const canvas = eqCanvasRef.value
        if (!canvas) { return }

        const rect = canvas.getBoundingClientRect()
        const logicalWidth = 340
        const logicalHeight = 180

        // Scale mouse coordinates from displayed size to logical canvas size
        const scaleX = logicalWidth / rect.width
        const scaleY = logicalHeight / rect.height

        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        const width = logicalWidth
        const height = logicalHeight

        const bandsArray = getBandsArray()
        const controlPoints = bandsArray.map((band, idx) => {
            const coords = getCanvasCoords(idx, band.value, width, height, bandsArray.length)
            return { ...coords, idx }
        })

        for (const point of controlPoints) {
            const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2)
            if (distance < 15) {
                draggedPointIndex.value = point.idx
                if (onDragStart) { onDragStart() }
                e.preventDefault()
                e.stopPropagation()
                break
            }
        }
    }

    const handleCanvasPointerMove = (e) => {
        const canvas = eqCanvasRef.value
        if (draggedPointIndex.value === null || !canvas) { return }

        const rect = canvas.getBoundingClientRect()
        const logicalHeight = 180

        // Scale mouse coordinates from displayed size to logical canvas size
        const scaleY = logicalHeight / rect.height
        const y = (e.clientY - rect.top) * scaleY

        const gainValue = getGainFromCanvasY(y)
        const bandsArray = getBandsArray()
        bandsArray[draggedPointIndex.value].value = gainValue

        canvas.style.cursor = 'grabbing'
        e.preventDefault()
        e.stopPropagation()
        drawCurve()
    }

    const handleCanvasPointerUp = (e) => {
        draggedPointIndex.value = null
        const canvas = eqCanvasRef.value
        if (canvas) {
            canvas.style.cursor = 'default'
        }
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    const handleCanvasPointerLeave = (e) => {
        draggedPointIndex.value = null
        const canvas = eqCanvasRef.value
        if (canvas) {
            canvas.style.cursor = 'default'
        }
        if (e) {
            e.preventDefault()
            e.stopPropagation()
        }
    }

    return {
        eqCanvasRef,
        draggedPointIndex,
        initCanvas,
        drawCurve,
        handleCanvasPointerDown,
        handleCanvasPointerMove,
        handleCanvasPointerUp,
        handleCanvasPointerLeave,
    }
}
