import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import Hls from 'hls.js'
import { loadConnection, embyReportPlaybackProgress, embyReportPlaybackStarted } from '../services/emby.js'
import { rewriteJellyfinStreamUrl } from '../services/jellyfinTranscode.js'

const STALL_TIMEOUT_MS = 25000

export function useAudioPlayer({
  nowPlaying,
  settingsStore,
  playbackStore,
  metadataDurationSeconds,
  onNext,
}) {
  const audioEl = ref(null)
  const audioMountKey = ref(0)
  const isPlaying = ref(false)
  const isBuffering = ref(false)
  const progress = ref(0)
  const duration = ref(0)
  const currentTime = ref(0)
  const volume = ref(parseInt(localStorage.getItem('octoPlayerVolume') ?? '100', 10))
  const repeatMode = ref(parseInt(localStorage.getItem('octoPlayerRepeatMode') ?? '0', 10))
  const effectiveStreamUrl = ref(null)

  const failedTranscodeTrackIds = new Set()

  let lastProgressReportTime = 0
  let lastStreamUrl = null
  let lastSetupTrackId = null
  let lastSetupUrl = null
  let hls = null
  let pendingSeekTime = null
  let pendingAutoplay = false
  let stallMonitor = null
  let lastProgressTs = 0
  let lastProgressPos = 0
  let startWatchTimer = null
  let lastReportedPlaybackStartedKey = null
  let retryAttempt = 0
  let maxRetries = 1
  let retryTimeout = null
  let lastBufferingTime = 0
  let stallTimeoutHandle = null
  let suppressErrorLogging = false
  let playbackToken = 0
  let currentPlaybackToken = 0
  let hasPlaybackStartedForCurrentSource = false

  // Utility functions
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function withCacheBust(url) {
    if (!url || typeof url !== 'string') return url
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}_octoBust=${Date.now()}`
  }

  function isTranscodedUrl(url) {
    if (!url || typeof url !== 'string') return false
    if (url.includes('static=true')) return false
    return (
      url.includes('TranscodingProtocol') ||
      url.includes('MaxStreamingBitrate') ||
      url.includes('AudioBitrate') ||
      url.includes('AudioCodec') ||
      url.includes('MaxAudioChannels') ||
      url.includes('/universal/')
    )
  }

  function cleanupHls() {
    if (hls) {
      try {
        hls.off(Hls.Events.MEDIA_ATTACHED)
        hls.off(Hls.Events.MANIFEST_PARSED)
        hls.off(Hls.Events.FRAG_LOADED)
        hls.off(Hls.Events.LEVEL_LOADED)
        hls.off(Hls.Events.ERROR)
        if (audioEl.value) {
          try { hls.detachMedia() } catch {}
        }
        hls.media = null
        hls.destroy()
      } catch {}
      hls = null
    }
  }

  function hardResetAudioElement() {
    if (!audioEl.value) return
    try {
      suppressErrorLogging = true
      audioEl.value.pause()
      audioEl.value.src = ''
      audioEl.value.removeAttribute('src')
      const sources = audioEl.value.querySelectorAll('source')
      sources.forEach((src) => src.remove())
      audioEl.value.load()
    } catch {}
    setTimeout(() => { suppressErrorLogging = false }, 100)
  }

  function clearRetryTimeout() {
    if (retryTimeout) {
      clearTimeout(retryTimeout)
      retryTimeout = null
    }
  }

  function clearStallTimeout() {
    if (stallTimeoutHandle) {
      clearTimeout(stallTimeoutHandle)
      stallTimeoutHandle = null
    }
  }

  function startStallTimeout(reason = 'stall') {
    clearStallTimeout()
    lastBufferingTime = Date.now()
    stallTimeoutHandle = setTimeout(() => {
      stallTimeoutHandle = null
      scheduleRetry(0, reason)
    }, STALL_TIMEOUT_MS)
  }

  function abortCurrentPlayback() {
    cleanupHls()
    clearRetryTimeout()
    clearStallTimeout()
    stopPlaybackMonitor()
    if (startWatchTimer) {
      clearTimeout(startWatchTimer)
      startWatchTimer = null
    }
    isBuffering.value = false
    isPlaying.value = false
    pendingAutoplay = false
    lastProgressTs = 0
    lastProgressPos = 0
  }

  function reloadStreamSource(reason = 'retry') {
    if (!effectiveStreamUrl.value) return
    const pos = audioEl.value?.currentTime || 0
    pendingSeekTime = pos
    setupAudioSource(effectiveStreamUrl.value, true)
  }

  async function setupAudioSource(url, useCacheBust = false) {
    if (!audioEl.value || !url || typeof url !== 'string') return

    hasPlaybackStartedForCurrentSource = false
    cleanupHls()
    if (startWatchTimer) {
      clearTimeout(startWatchTimer)
      startWatchTimer = null
    }
    clearRetryTimeout()
    clearStallTimeout()
    hardResetAudioElement()

    try {
      isBuffering.value = true
      await audioEl.value.pause()
      await delay(300)

      const finalUrl = useCacheBust ? withCacheBust(url) : url
      audioEl.value.src = finalUrl

      if (audioEl.value.canPlayType?.('audio/mpeg') === '') {
        console.warn('MP3 format may not be supported on this platform')
      }

      audioEl.value.load()
      await refreshAudioOutputDevice({ resumeIfPlaying: false })

      pendingAutoplay = true
      const playPromise = audioEl.value.play()

      if (playPromise?.then) {
        playPromise.then(() => {}).catch((err) => {
          if (err.name === 'AbortError') {
            // Expected during track switch
          } else if (err.name === 'NotAllowedError') {
            console.warn('Playback blocked by browser autoplay policy')
            isBuffering.value = false
          } else if (err.name === 'NotSupportedError') {
            console.warn('Media format not supported')
            isBuffering.value = false
          } else {
            console.warn('Play failed:', err.name, err.message)
            isBuffering.value = false
          }
        })
      }
    } catch (err) {
      console.error('Failed to setup audio source:', err)
      isBuffering.value = false
    }

    startWatchTimer = setTimeout(() => {
      startWatchTimer = null
      if (!audioEl.value || hasPlaybackStartedForCurrentSource) return

      const isStalled =
        audioEl.value.paused ||
        !isFinite(audioEl.value.duration) ||
        audioEl.value.currentTime === 0

      if (isStalled) {
        console.warn('Initial load appeared stalled, attempting play')
        pendingAutoplay = true
        audioEl.value.play()?.catch(() => {})
      }
    }, 4000)

    startStallTimeout('initial-load')
  }

  async function refreshAudioOutputDevice({ resumeIfPlaying = true } = {}) {
    const el = audioEl.value
    if (!el) return

    if (typeof el.setSinkId === 'function') {
      try {
        await el.setSinkId('')
        return
      } catch {
        try {
          await el.setSinkId('default')
          return
        } catch {}
      }
    }

    const wasPaused = el.paused
    const pos = Number.isFinite(el.currentTime) ? el.currentTime : 0
    try { el.pause() } catch {}
    try { el.currentTime = pos } catch {}
    if (resumeIfPlaying && !wasPaused) {
      el.play().catch(() => {})
    }
  }

  function forceRemountAudioElement() {
    const el = audioEl.value
    const pos = el && Number.isFinite(el.currentTime) ? el.currentTime : 0
    const shouldResume = !!(el && !el.paused)

    try { cleanupHls() } catch {}

    pendingSeekTime = pos
    pendingAutoplay = shouldResume
    lastSetupTrackId = null
    lastSetupUrl = null
    audioMountKey.value += 1
  }

  // Progress and playback reporting
  function updateProgress() {
    if (!audioEl.value) return
    const t = audioEl.value.currentTime
    currentTime.value = t

    let effectiveDuration = metadataDurationSeconds.value
    const d = audioEl.value.duration
    if (!effectiveDuration && isFinite(d) && d > 0) {
      effectiveDuration = d
    }

    if (effectiveDuration && effectiveDuration > 0) {
      duration.value = effectiveDuration
      const pct = Math.max(0, Math.min(1, t / effectiveDuration))
      progress.value = pct * 100
      playbackStore.setProgress(progress.value)
      playbackStore.setCurrentTime(t)
      playbackStore.setDuration(effectiveDuration)
    } else {
      duration.value = 0
      progress.value = 0
      playbackStore.setProgress(0)
      playbackStore.setCurrentTime(0)
      playbackStore.setDuration(0)
    }

    const now = Date.now()
    if (now - lastProgressReportTime > 1000 && nowPlaying.value?.playbackSession) {
      lastProgressReportTime = now
      reportPlaybackProgress()
    }
  }

  async function reportPlaybackProgress() {
    if (!nowPlaying.value?.playbackSession || !audioEl.value) return

    const { serverUrl, token, userId } = loadConnection()
    if (!serverUrl || !token || !userId) return

    const rawCurrent = audioEl.value.currentTime
    const safeCurrent = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : 0
    const positionTicks = Math.floor(safeCurrent * 10000000)

    try {
      await embyReportPlaybackProgress({
        serverUrl,
        token,
        userId,
        itemId: nowPlaying.value.playbackSession.itemId,
        mediaSourceId: nowPlaying.value.playbackSession.mediaSourceId,
        positionTicks,
        playSessionId: nowPlaying.value.playbackSession.playSessionId,
        deviceId: nowPlaying.value.playbackSession.deviceId,
        isPaused: audioEl.value.paused,
      })
    } catch (err) {
      console.warn('Failed to report playback progress:', err)
    }
  }

  // Playback monitor
  function startPlaybackMonitor() {
    stopPlaybackMonitor()
    stallMonitor = setInterval(() => {
      if (!audioEl.value) return
      const now = Date.now()
      const pos = audioEl.value.currentTime || 0
      const paused = audioEl.value.paused
      const ready = audioEl.value.readyState || 0

      if (!lastProgressTs) {
        lastProgressTs = now
        lastProgressPos = pos
        return
      }

      const dt = (now - lastProgressTs) / 1000
      const dpos = pos - lastProgressPos

      if (!paused && dt >= 5 && dpos < 0.1 && ready < 2) {
        const now2 = Date.now()
        if (!lastBufferingTime) lastBufferingTime = now2
        const bufferingDuration = now2 - lastBufferingTime

        console.warn(`Playback appears stalled (${(bufferingDuration / 1000).toFixed(1)}s)`)
        isBuffering.value = true

        if (bufferingDuration > 15000) {
          lastBufferingTime = now2
          scheduleRetry(0, 'stall-monitor')
        }

        lastProgressTs = now
        lastProgressPos = pos
        return
      }

      if (dt >= 5) {
        lastProgressTs = now
        lastProgressPos = pos
      }
    }, 5000)
  }

  function stopPlaybackMonitor() {
    if (stallMonitor) {
      clearInterval(stallMonitor)
      stallMonitor = null
    }
    lastProgressTs = 0
    lastProgressPos = 0
  }

  function scheduleRetry(delayMs, reason = 'retry') {
    clearRetryTimeout()
    retryTimeout = setTimeout(() => {
      retryTimeout = null
      if (retryAttempt < maxRetries && effectiveStreamUrl.value) {
        retryAttempt++
        clearStallTimeout()
        reloadStreamSource(reason)
      } else if (retryAttempt >= maxRetries) {
        const trackId = nowPlaying.value?.id
        const currentUrl = effectiveStreamUrl.value

        if (trackId && currentUrl && !isTranscodedUrl(currentUrl) && !failedTranscodeTrackIds.has(trackId)) {
          console.warn(`Direct play stalled after ${maxRetries} retries, falling back to transcoding`)

          const { userId, token } = loadConnection()
          const session = nowPlaying.value?.playbackSession || {}

          const transcodeUrl = rewriteJellyfinStreamUrl(nowPlaying.value.streamUrl, {
            transcodeEnabled: true,
            bitrateKbps: settingsStore.bitrateKbps,
            format: settingsStore.format,
          }, {
            userId,
            deviceId: session.deviceId,
            playSessionId: session.playSessionId,
            mediaSourceId: session.mediaSourceId,
            apiKey: token,
          })

          if (transcodeUrl) {
            pendingSeekTime = audioEl.value?.currentTime || 0
            effectiveStreamUrl.value = transcodeUrl
            retryAttempt = 0
            reloadStreamSource('fallback-to-transcode')
            return
          }
        }

        console.error(`Playback failed after ${maxRetries} retries`)
        abortCurrentPlayback()
      }
    }, delayMs)
  }

  function resetRetries() {
    retryAttempt = 0
    clearRetryTimeout()
    clearStallTimeout()
  }

  // Event handlers
  function onError() {
    const err = audioEl.value?.error
    const currentSrc = audioEl.value?.currentSrc || audioEl.value?.src || ''
    const msg = err?.message || ''
    const code = err?.code || 0
    const emptySrcError = !currentSrc || msg.toLowerCase().includes('empty src attribute')
    const formatError = msg.toLowerCase().includes('format error')

    if (suppressErrorLogging) return

    const errorTypeMap = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' }
    const errorType = errorTypeMap[code] || `UNKNOWN(${code})`
    console.warn(`Audio error [${errorType}]:`, msg)

    if (emptySrcError) {
      if (effectiveStreamUrl.value) {
        pendingAutoplay = true
        setupAudioSource(effectiveStreamUrl.value)
      }
      return
    }

    if (formatError && nowPlaying.value?.streamUrl && currentSrc !== nowPlaying.value.streamUrl) {
      console.warn('Format error on transcoded stream, falling back to direct')
      pendingAutoplay = true
      if (nowPlaying.value?.id) failedTranscodeTrackIds.add(nowPlaying.value.id)
      effectiveStreamUrl.value = nowPlaying.value.streamUrl
      return
    }

    if (code === 2 || code === 3) {
      pendingAutoplay = false
      clearStallTimeout()
      if (effectiveStreamUrl.value) {
        scheduleRetry(0, `audio-error-${errorType}`)
      } else {
        abortCurrentPlayback()
      }
      return
    }

    console.warn(`Unhandled audio error [${errorType}]:`, err)
    pendingAutoplay = false
    clearStallTimeout()
    if (effectiveStreamUrl.value) {
      scheduleRetry(0, `audio-error-${errorType}`)
    } else {
      abortCurrentPlayback()
    }
  }

  function onLoadStart(e) {
    if (currentPlaybackToken === 0) return

    isBuffering.value = true
    pendingAutoplay = true
    lastBufferingTime = Date.now()
    startStallTimeout('loadstart')

    const p = e.currentTarget.play()
    p?.catch((err) => {
      if (err.name !== 'AbortError') {
        console.warn('Play failed during loadstart:', err.name)
        isBuffering.value = false
        isPlaying.value = false
      }
    })
  }

  function onPlaying() {
    isPlaying.value = true
    isBuffering.value = false
    pendingAutoplay = false
    hasPlaybackStartedForCurrentSource = true
    clearStallTimeout()
    lastBufferingTime = 0
    reportPlaybackProgress()
    startPlaybackMonitor()
  }

  function onPlay() {
    isPlaying.value = true
    isBuffering.value = false
    pendingAutoplay = false
    hasPlaybackStartedForCurrentSource = true
    clearStallTimeout()

    if (nowPlaying.value?.playbackSession) {
      const { serverUrl, token, userId } = loadConnection()
      if (serverUrl && token && userId) {
        const session = nowPlaying.value.playbackSession
        const startedKey = [session.playSessionId, session.itemId, session.mediaSourceId].filter(Boolean).join('|')
        if (!startedKey || startedKey !== lastReportedPlaybackStartedKey) {
          lastReportedPlaybackStartedKey = startedKey || null
          embyReportPlaybackStarted({
            serverUrl,
            token,
            userId,
            itemId: session.itemId,
            mediaSourceId: session.mediaSourceId,
            playSessionId: session.playSessionId,
            deviceId: session.deviceId,
          }).catch((err) => console.warn('Failed to report playback started:', err))
        }
      }
    }
    reportPlaybackProgress()
  }

  function onWaiting() {
    isBuffering.value = true
    lastBufferingTime = Date.now()
    startStallTimeout('waiting')
  }

  function onLoadedMetadata() {
    if (pendingSeekTime !== null && audioEl.value) {
      try { audioEl.value.currentTime = pendingSeekTime } catch {}
      pendingSeekTime = null
    }
    if (pendingAutoplay && audioEl.value) {
      audioEl.value.play()?.catch(() => {})
    }
  }

  function onCanPlay() {
    isBuffering.value = false
    clearStallTimeout()
    if (pendingSeekTime !== null && audioEl.value) {
      try { audioEl.value.currentTime = pendingSeekTime } catch {}
      pendingSeekTime = null
    }
    if (pendingAutoplay && audioEl.value) {
      audioEl.value.play()?.catch(() => {})
    }
  }

  function onCanPlayThrough() {
    clearStallTimeout()
    if (pendingAutoplay && audioEl.value) {
      audioEl.value.play()?.catch(() => {})
    }
  }

  function onStalled() {
    isBuffering.value = true
    lastBufferingTime = Date.now()
    startStallTimeout('stalled')
    if (hls) {
      try { hls.startLoad() } catch {}
    }
  }

  function onPause() {
    isPlaying.value = false
    clearStallTimeout()
    reportPlaybackProgress()
    stopPlaybackMonitor()
  }

  function onTimeUpdate() {
    updateProgress()
  }

  function handleTrackEnded() {
    if (repeatMode.value === 2) {
      if (audioEl.value) {
        audioEl.value.currentTime = 0
        audioEl.value.play().catch((e) => console.warn('Play failed:', e))
      }
    } else {
      onNext()
    }
  }

  // Controls
  async function togglePlayPause() {
    if (!audioEl.value) return
    try {
      if (audioEl.value.paused) {
        pendingAutoplay = true
        await audioEl.value.play()
      } else {
        audioEl.value.pause()
      }
    } catch (e) {
      console.warn('Play blocked or failed:', e)
    }
  }

  function handleStop() {
    if (audioEl.value) {
      audioEl.value.pause()
      audioEl.value.currentTime = 0
    }
    playbackStore.clearNowPlaying()
  }

  function handleSeek(newTime) {
    if (!audioEl.value || typeof newTime !== 'number' || !isFinite(newTime)) return

    const metaD = metadataDurationSeconds.value
    const audioD = audioEl.value.duration
    const seekableEnd = audioEl.value.seekable?.length ? audioEl.value.seekable.end(0) : 0
    const total = metaD > 0 ? metaD : (isFinite(audioD) && audioD > 0 ? audioD : seekableEnd || 0)
    if (!total) return

    audioEl.value.currentTime = Math.max(0, Math.min(newTime, total))
  }

  // Watchers
  watch(audioEl, (el) => {
    if (el) {
      el.muted = false
      el.volume = volume.value / 100
      refreshAudioOutputDevice()
    }
  })

  watch(volume, (vol) => {
    if (audioEl.value) audioEl.value.volume = vol / 100
    localStorage.setItem('octoPlayerVolume', String(vol))
  })

  watch(repeatMode, (mode) => {
    localStorage.setItem('octoPlayerRepeatMode', String(mode))
  })

  watch(() => nowPlaying.value?.streamUrl, (url) => {
    if (url && url !== lastStreamUrl) {
      playbackToken++
      currentPlaybackToken = playbackToken
      abortCurrentPlayback()
      lastReportedPlaybackStartedKey = null
      progress.value = 0
      currentTime.value = 0
      duration.value = 0
      isPlaying.value = false
      isBuffering.value = true
      lastStreamUrl = url
      lastProgressTs = 0
      lastProgressPos = 0
    }
  }, { immediate: true })

  watch(
    () => [nowPlaying.value?.streamUrl, settingsStore.transcodeEnabled, settingsStore.bitrateKbps, settingsStore.format],
    () => {
      if (nowPlaying.value?.streamUrl) {
        const trackId = nowPlaying.value?.id
        const allowTranscode = settingsStore.transcodeEnabled && trackId && !failedTranscodeTrackIds.has(trackId)
        const { userId, token } = loadConnection()
        const session = nowPlaying.value?.playbackSession || {}

        if (allowTranscode) {
          effectiveStreamUrl.value = rewriteJellyfinStreamUrl(nowPlaying.value.streamUrl, {
            transcodeEnabled: true,
            bitrateKbps: settingsStore.bitrateKbps,
            format: settingsStore.format,
          }, {
            userId,
            deviceId: session.deviceId,
            playSessionId: session.playSessionId,
            mediaSourceId: session.mediaSourceId,
            apiKey: token,
          })
        } else {
          effectiveStreamUrl.value = nowPlaying.value.streamUrl
        }
      } else {
        effectiveStreamUrl.value = null
      }
    },
    { deep: true, immediate: true }
  )

  watch(
    () => [audioEl.value, effectiveStreamUrl.value, nowPlaying.value?.id],
    () => {
      if (audioEl.value && effectiveStreamUrl.value && nowPlaying.value?.id !== lastSetupTrackId) {
        lastSetupTrackId = nowPlaying.value?.id
        lastSetupUrl = effectiveStreamUrl.value
        setupAudioSource(effectiveStreamUrl.value)
      }
    }
  )

  watch(effectiveStreamUrl, (url) => {
    if (audioEl.value && lastSetupTrackId === nowPlaying.value?.id && url && url !== lastSetupUrl) {
      const wasPlaying = !audioEl.value.paused
      const currentPos = audioEl.value.currentTime
      lastSetupUrl = url
      pendingSeekTime = currentPos
      setupAudioSource(url)
      if (wasPlaying) {
        audioEl.value.play()?.catch(() => {})
      }
    }
  })

  return {
    audioEl,
    audioMountKey,
    isPlaying,
    isBuffering,
    progress,
    duration,
    currentTime,
    volume,
    repeatMode,
    effectiveStreamUrl,
    // Event handlers
    onError,
    onLoadStart,
    onPlaying,
    onPlay,
    onWaiting,
    onLoadedMetadata,
    onCanPlay,
    onCanPlayThrough,
    onStalled,
    onPause,
    onTimeUpdate,
    handleTrackEnded,
    // Controls
    togglePlayPause,
    handleStop,
    handleSeek,
    // Utilities
    forceRemountAudioElement,
    refreshAudioOutputDevice,
    cleanupHls,
    resetRetries,
    stopPlaybackMonitor,
  }
}
