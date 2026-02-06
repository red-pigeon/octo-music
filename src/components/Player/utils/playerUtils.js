/**
 * Player utility functions
 * Helper functions for progress calculation and audio-related math
 */

/**
 * Calculate progress percentage from current time and duration
 * @param {number} currentTime - Current playback time in seconds
 * @param {number} duration - Total duration in seconds
 * @returns {number} Progress percentage (0-100)
 */
export function calculateProgress(currentTime, duration) {
    if (!duration) { return 0 }
    return Math.min(100, (currentTime / duration) * 100)
}

/**
 * Calculate seek time from progress percentage and duration
 * @param {number} percentage - Progress percentage (0-100)
 * @param {number} duration - Total duration in seconds
 * @returns {number} Seek time in seconds
 */
export function calculateSeekTime(percentage, duration) {
    if (!duration) { return 0 }
    return (percentage / 100) * duration
}

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value))
}

/**
 * Get volume percentage from audio element
 * @param {HTMLAudioElement} audioElement - The audio element
 * @returns {number} Volume as percentage (0-100)
 */
export function getAudioVolume(audioElement) {
    if (!audioElement) { return 0 }
    return Math.round(audioElement.volume * 100)
}

/**
 * Set volume on audio element
 * @param {HTMLAudioElement} audioElement - The audio element
 * @param {number} percentage - Volume percentage (0-100)
 */
export function setAudioVolume(audioElement, percentage) {
    if (!audioElement) { return }
    audioElement.volume = Math.max(0, Math.min(100, percentage)) / 100
}

/**
 * Format repeat mode as readable text
 * @param {number} mode - Repeat mode (0=off, 1=all, 2=once)
 * @returns {string} Readable repeat mode text
 */
export function formatRepeatMode(mode) {
    const modes = { 0: 'Repeat Off', 1: 'Repeat All', 2: 'Repeat Once' }
    return modes[mode] ?? 'Unknown'
}

/**
 * Check if audio is currently playing
 * @param {HTMLAudioElement} audioElement - The audio element
 * @returns {boolean} True if playing
 */
export function isAudioPlaying(audioElement) {
    if (!audioElement) { return false }
    return !audioElement.paused && audioElement.currentTime > 0
}

/**
 * Check if audio is currently buffering/loading
 * @param {HTMLAudioElement} audioElement - The audio element
 * @returns {boolean} True if buffering
 */
export function isAudioBuffering(audioElement) {
    if (!audioElement) { return false }
    return audioElement.buffered.length === 0 || audioElement.readyState < 3
}
