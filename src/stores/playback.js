/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { defineStore } from 'pinia'
import { storageGetItem, storageSetItem } from '../utils/storage.js'

function loadShuffleEnabled() {
    const saved = storageGetItem('octoPlayerShuffle', null)
    return saved === '1'
}

export const usePlaybackStore = defineStore('playback', {
    state: () => ({
        nowPlaying: null,
        queue: [],
        index: -1,
        isPlaying: false,
        currentTrackId: null,
        shuffleEnabled: loadShuffleEnabled(),
        context: null,
        isLoading: false,
        progress: 0,
        currentTime: 0,
        duration: 0,
    }),
    actions: {
        setNowPlaying(payload) {
            this.nowPlaying = payload || null
            this.currentTrackId = payload?.id || null
        },
        clearNowPlaying() {
            this.nowPlaying = null
            this.currentTrackId = null
            this.isPlaying = false
            this.context = null
        },
        setQueue(queue, index = -1) {
            this.queue = Array.isArray(queue) ? queue : []
            this.index = index
        },
        setIndex(index) {
            this.index = index
        },
        setPlayingState(isPlaying, trackId = undefined) {
            this.isPlaying = !!isPlaying
            if (trackId !== undefined) {
                this.currentTrackId = trackId
            }
        },
        toggleShuffle() {
            this.shuffleEnabled = !this.shuffleEnabled
            storageSetItem('octoPlayerShuffle', this.shuffleEnabled ? '1' : '0')
        },
        setShuffleEnabled(enabled) {
            this.shuffleEnabled = !!enabled
            storageSetItem('octoPlayerShuffle', this.shuffleEnabled ? '1' : '0')
        },
        setContext(ctx) {
            this.context = ctx || null
        },
        setLoading(loading) {
            this.isLoading = !!loading
        },
        setProgress(progress = 0) {
            this.progress = Number.isFinite(progress) ? progress : 0
        },
        setCurrentTime(time = 0) {
            this.currentTime = Number.isFinite(time) ? time : 0
        },
        setDuration(duration = 0) {
            this.duration = Number.isFinite(duration) ? duration : 0
        },
    },
})
