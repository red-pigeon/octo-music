import { computed } from 'vue'

/**
 * Composable for managing player control logic
 * Handles repeat mode cycling and play state labels
 */
export function usePlayerControls(repeatMode, isPlaying, isBuffering) {
    /**
     * Compute the display label for the play button
     */
    const playLabel = computed(() => {
        if (isBuffering && isBuffering.value) { return 'Buffering...' }
        return isPlaying && isPlaying.value ? 'Pause' : 'Play'
    })

    /**
     * Compute the aria label for the play button
     */
    const playAriaLabel = computed(() => {
        return isPlaying && isPlaying.value ? 'Pause' : 'Play'
    })

    /**
     * Cycle through repeat modes: off (0) -> all (1) -> once (2) -> off (0)
     */
    function getNextRepeatMode() {
        const currentMode = repeatMode && repeatMode.value !== undefined ? repeatMode.value : 0
        return (currentMode + 1) % 3
    }

    /**
     * Check if repeat is on (any mode)
     */
    function isRepeatOn() {
        const currentMode = repeatMode && repeatMode.value !== undefined ? repeatMode.value : 0
        return currentMode > 0
    }

    /**
     * Check if repeat once is active
     */
    function isRepeatOnce() {
        const currentMode = repeatMode && repeatMode.value !== undefined ? repeatMode.value : 0
        return currentMode === 2
    }

    return {
        playLabel,
        playAriaLabel,
        getNextRepeatMode,
        isRepeatOn,
        isRepeatOnce,
    }
}
