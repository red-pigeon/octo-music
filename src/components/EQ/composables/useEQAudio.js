import { ref } from 'vue'
import { bandDefinitions } from '../utils/eqPresets.js'

export const useEQAudio = (audioElRef, playerVolume, useEQAudioPath) => {
    let audioContext = null
    let sourceNode = null
    let masterGain = null
    let analyser = null
    let filters = []
    let meterRaf = null
    let currentMediaElement = null
    const sourceNodeCache = new WeakMap()
    const eqReady = ref(false)

    const bands = ref(
        bandDefinitions.map((def) => ({
            ...def,
            value: 0,
            filter: null,
        }))
    )

    const teardownGraph = async (closeCtx = true) => {
        if (meterRaf !== null) {
            cancelAnimationFrame(meterRaf)
            meterRaf = null
        }

        filters.forEach((f) => {
            try {
                f.disconnect()
            } catch { }
        })
        filters = []

        if (masterGain) {
            try {
                masterGain.disconnect()
            } catch { }
        }
        masterGain = null

        if (analyser) {
            try {
                analyser.disconnect()
            } catch { }
        }
        analyser = null

        if (sourceNode) {
            try {
                sourceNode.disconnect()
            } catch { }
        }
        currentMediaElement = null
        eqReady.value = false

        if (closeCtx && audioContext) {
            try {
                await audioContext.close()
            } catch { }
            audioContext = null
        }
    }

    const ensureAudioContext = async () => {
        if (!audioContext || audioContext.state === 'closed') {
            audioContext = new (window.AudioContext || window.webkitAudioContext)()
        }

        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume()
            } catch { }
        }

        return audioContext.state !== 'suspended' ? audioContext : null
    }

    const buildGraph = async () => {
        const audioEl = audioElRef?.value
        if (!audioEl) { return false }

        if (currentMediaElement && currentMediaElement !== audioEl) {
            await teardownGraph(true)
        }

        const ctx = await ensureAudioContext()
        if (!ctx) { return false }

        if (!sourceNode || currentMediaElement !== audioEl) {
            try {
                const cached = sourceNodeCache.get(audioEl)
                if (cached) {
                    sourceNode = cached
                    currentMediaElement = audioEl
                } else {
                    audioEl.crossOrigin = 'anonymous'
                    sourceNode = ctx.createMediaElementSource(audioEl)
                    sourceNodeCache.set(audioEl, sourceNode)
                    currentMediaElement = audioEl
                }
            } catch {
                return false
            }
        }

        filters.forEach((f) => {
            try {
                f.disconnect()
            } catch { }
        })
        filters = []

        if (masterGain) {
            try {
                masterGain.disconnect()
            } catch { }
        }

        masterGain = ctx.createGain()
        masterGain.gain.value = playerVolume?.value ? playerVolume.value / 100 : 1

        let prevNode = sourceNode
        bands.value.forEach((band) => {
            const filter = audioContext.createBiquadFilter()
            filter.type = 'peaking'
            filter.frequency.value = band.frequency
            filter.Q.value = 1.5
            filter.gain.value = band.value

            prevNode.connect(filter)
            prevNode = filter
            filters.push(filter)
            band.filter = filter
        })

        analyser = ctx.createAnalyser()
        analyser.fftSize = 512
        analyser.smoothingTimeConstant = 0.8

        prevNode.connect(masterGain)
        masterGain.connect(analyser)
        analyser.connect(ctx.destination)

        if (useEQAudioPath) { useEQAudioPath.value = true }
        eqReady.value = true

        return true
    }

    const updateFilterGains = () => {
        if (!audioContext || audioContext.state === 'closed') { return }
        bands.value.forEach((band, index) => {
            const filter = filters[index]
            if (!filter) { return }

            filter.type = 'peaking'
            filter.frequency.value = band.frequency
            filter.Q.value = 1.5
            filter.gain.setTargetAtTime(band.value, audioContext.currentTime, 0.01)
        })
    }

    const wirePassThrough = async () => {
        const audioEl = audioElRef?.value
        if (!audioEl) { return false }

        const ctx = await ensureAudioContext()
        if (!ctx) { return false }

        if (!sourceNode) {
            try {
                audioEl.crossOrigin = 'anonymous'
                sourceNode = ctx.createMediaElementSource(audioEl)
                currentMediaElement = audioEl
            } catch {
                return false
            }
        }

        filters.forEach((f) => {
            try {
                f.disconnect()
            } catch { }
        })
        filters = []

        if (analyser) {
            try {
                analyser.disconnect()
            } catch { }
            analyser = null
        }

        if (masterGain) {
            try {
                masterGain.disconnect()
            } catch { }
        }

        masterGain = ctx.createGain()
        masterGain.gain.value = playerVolume?.value ? playerVolume.value / 100 : 1

        try {
            sourceNode.disconnect()
        } catch { }

        sourceNode.connect(masterGain)
        masterGain.connect(ctx.destination)
        eqReady.value = true
        return true
    }

    const updateMasterGainFromVolume = (vol) => {
        if (masterGain) {
            masterGain.gain.setValueAtTime((vol ?? 100) / 100, audioContext?.currentTime || 0)
        }
    }

    return {
        bands,
        eqReady,
        teardownGraph,
        ensureAudioContext,
        buildGraph,
        updateFilterGains,
        wirePassThrough,
        updateMasterGainFromVolume,
    }
}
