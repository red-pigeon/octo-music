import { ref, computed } from 'vue'
import { mdiVolumeHigh, mdiVolumeOff } from '@mdi/js'

/**
 * Composable for managing player volume state and interactions
 * Handles volume dragging, wheel scrolling, and mute toggling
 */
export function usePlayerVolume(initialVolume = 100) {
    const volume = ref(initialVolume)
    const isDraggingVolume = ref(false)
    const isShowingVolumeValue = ref(false)
    const volumeBlockRef = ref(null)
    const isHoveringIcon = ref(false)
    const lastVolume = ref(initialVolume)

    const isMuted = computed(() => volume.value <= 0)

    const iconPath = computed(() => {
        if (isMuted.value) {
            return isHoveringIcon.value ? mdiVolumeHigh : mdiVolumeOff
        }
        return isHoveringIcon.value ? mdiVolumeOff : mdiVolumeHigh
    })

    /**
     * Clamp volume between 0 and 100
     */
    function clampVolume(vol) {
        return Math.max(0, Math.min(100, vol))
    }

    /**
     * Update volume from mouse position on vertical slider
     */
    function updateVolumeFromEvent(e, el) {
        const rect = el.getBoundingClientRect()
        const pct = Math.min(1, Math.max(0, (rect.bottom - e.clientY) / rect.height))
        const newVolume = Math.round(pct * 100)
        volume.value = newVolume
    }

    /**
     * Show volume value tooltip briefly
     */
    function showVolumeValueBriefly() {
        isShowingVolumeValue.value = true
        setTimeout(() => {
            isShowingVolumeValue.value = false
        }, 800)
    }

    /**
     * Handle mouse down on volume control
     */
    function handleVolumeMouseDown(e) {
        if (!volumeBlockRef.value) { return }
        isDraggingVolume.value = true
        updateVolumeFromEvent(e, volumeBlockRef.value)
    }

    /**
     * Handle mouse move while dragging volume
     */
    function handleVolumeMouseMove(e) {
        if (!isDraggingVolume.value || !volumeBlockRef.value) { return }
        updateVolumeFromEvent(e, volumeBlockRef.value)
        isShowingVolumeValue.value = true
    }

    /**
     * Handle mouse up/leave volume control
     */
    function handleVolumeMouseUp() {
        isDraggingVolume.value = false
        isShowingVolumeValue.value = false
    }

    /**
     * Handle mouse wheel on volume control
     */
    function handleVolumeWheel(e) {
        volume.value = clampVolume(volume.value + (e.deltaY > 0 ? -5 : 5))
        showVolumeValueBriefly()
    }

    /**
     * Handle mute/unmute toggle
     */
    function handleMuteClick() {
        if (isDraggingVolume.value) { return }
        if (isMuted.value) {
            volume.value = lastVolume.value > 0 ? lastVolume.value : 50
        } else {
            lastVolume.value = volume.value || lastVolume.value || 50
            volume.value = 0
        }
        showVolumeValueBriefly()
    }

    /**
     * Set volume programmatically
     */
    function setVolume(newVolume) {
        volume.value = clampVolume(newVolume)
    }

    return {
        // State
        volume,
        isDraggingVolume,
        isShowingVolumeValue,
        volumeBlockRef,
        isHoveringIcon,
        lastVolume,
        // Computed
        isMuted,
        iconPath,
        // Methods
        clampVolume,
        updateVolumeFromEvent,
        showVolumeValueBriefly,
        handleVolumeMouseDown,
        handleVolumeMouseMove,
        handleVolumeMouseUp,
        handleVolumeWheel,
        handleMuteClick,
        setVolume,
    }
}
