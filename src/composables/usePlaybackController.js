import { computed } from 'vue'
import { getArtistFromItem, coverUrlFor } from '../services/mediaUtils.js'
import { playItem as playItemUtil, updateQueue, getNextTrack, getPreviousTrack } from '../services/playback.js'
import { useSessionStore } from '../stores/session.js'
import { usePlaybackStore } from '../stores/playback.js'

export function usePlaybackController() {
    const sessionStore = useSessionStore()
    const playbackStore = usePlaybackStore()

    const currentPlayingId = computed(() => playbackStore.currentTrackId)
    const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)

    async function handlePlayItem(item, skipQueueUpdate = false, queueContext = null, origin = null) {
        const { serverUrl, token, userId } = sessionStore
        const contextList = Array.isArray(queueContext)
            ? queueContext
            : queueContext?.value || playbackStore.queue
        const playbackInfo = await playItemUtil(item, { serverUrl, token, userId }, skipQueueUpdate, contextList)
        if (!playbackInfo) {
            return null
        }

        const coverInfo = coverUrlFor(playbackInfo.item, sessionStore)
        playbackStore.setNowPlaying({
            id: playbackInfo.item.Id,
            name: playbackInfo.item?.Name || 'Unknown Track',
            artist: getArtistFromItem(playbackInfo.item) || 'Unknown Artist',
            streamUrl: playbackInfo.streamUrl,
            raw: playbackInfo.item,
            coverUrl: coverInfo,
            playbackSession: playbackInfo.playbackSession,
        })

        if (!skipQueueUpdate) {
            const q = updateQueue(playbackStore.queue, playbackStore.index, playbackInfo.item, contextList)
            playbackStore.setQueue(q.queue, q.index)
        }

        if (origin) {
            playbackStore.setContext(origin)
        }

        return playbackInfo.item
    }

    function togglePlayPause() {
        const audioEl = document.querySelector('audio')
        if (audioEl) {
            if (audioEl.paused) {
                audioEl.play().catch(() => { })
            } else {
                audioEl.pause()
            }
        }
    }

    async function handleNext() {
        if (playbackStore.isLoading) {
            return
        }

        const next = getNextTrack(playbackStore.queue, playbackStore.index, playbackStore.shuffleEnabled)
        if (next) {
            playbackStore.setLoading(true)
            try {
                await handlePlayItem(next.track, false, playbackStore.queue, playbackStore.context)
                playbackStore.setIndex(next.index)
            } finally {
                playbackStore.setLoading(false)
            }
        }
    }

    async function handlePrevious() {
        if (playbackStore.isLoading) {
            return
        }

        const prev = getPreviousTrack(playbackStore.queue, playbackStore.index, playbackStore.shuffleEnabled)
        if (prev) {
            playbackStore.setLoading(true)
            try {
                await handlePlayItem(prev.track, false, playbackStore.queue, playbackStore.context)
                playbackStore.setIndex(prev.index)
            } finally {
                playbackStore.setLoading(false)
            }
        }
    }

    function handlePlayingStateChange(state) {
        playbackStore.setPlayingState(state.isPlaying, state.trackId)
    }

    return {
        playbackStore,
        currentPlayingId,
        isCurrentlyPlaying,
        handlePlayItem,
        togglePlayPause,
        handleNext,
        handlePrevious,
        handlePlayingStateChange,
    }
}
