<template>
  <div class="playbar">
    <audio
      v-if="nowPlaying"
      :key="audioMountKey"
      ref="audioEl"
      crossorigin="anonymous"
      preload="auto"
      @error="onError"
      @loadstart="onLoadStart"
      @playing="onPlaying"
      @play="onPlay"
      @waiting="onWaiting"
      @loadedmetadata="onLoadedMetadata"
      @canplay="onCanPlay"
      @canplaythrough="onCanPlayThrough"
      @stalled="onStalled"
      @pause="onPause"
      @timeupdate="onTimeUpdate"
      @ended="handleTrackEnded"
    />

    <div class="playbarContent">
      <PlayerArtwork :coverImageUrl="coverImageUrl" :fallbackCoverUrl="artistFallbackCoverUrl" />

      <PlayerControls
        :nowPlaying="nowPlaying"
        :isPlaying="isPlaying"
        :isBuffering="isBuffering"
        :repeatMode="repeatMode"
        :shuffleEnabled="shuffleEnabled"
        :currentTime="currentTime"
        :duration="duration"
        :progress="progress"
        @previous="emit('previous')"
        @next="emit('next')"
        @stop="handleStop"
        @togglePlayPause="togglePlayPause"
        @toggleShuffle="shuffleEnabled = !shuffleEnabled"
        @toggleRepeat="repeatMode = $event"
        @seek="handleSeek"
        @openContext="handleOpenContext"
      />

      <PlayerVolume v-model:volume="volume" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onBeforeUnmount, provide, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { loadConnection } from '../services/emby.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlaybackStore } from '../stores/playback.js'
import { makeBaseUrl } from '../services/mediaUtils.js'
import { buildArtistPrimaryFallbackSrc } from '../composables/useEmbyCoverImage.js'
import PlayerArtwork from './Player/PlayerArtwork.vue'
import PlayerControls from './Player/PlayerControls.vue'
import PlayerVolume from './Player/PlayerVolume.vue'
import { useAudioPlayer } from '../composables/useAudioPlayer.js'
import { useAudioDeviceMonitor } from '../composables/useAudioDeviceMonitor.js'
import { usePlayerCoverImage } from '../composables/usePlayerCoverImage.js'

const props = defineProps({ nowPlaying: { type: Object, default: null } })
const emit = defineEmits(['previous', 'next', 'close', 'trackPlayed', 'playingStateChange'])
const router = useRouter()

const settingsStore = useSettingsStore()
settingsStore.hydrate()
const playbackStore = usePlaybackStore()

const nowPlayingRef = toRef(props, 'nowPlaying')

const metadataDurationSeconds = computed(() => {
  const ticks = props.nowPlaying?.raw?.RunTimeTicks
  if (!ticks || !Number.isFinite(ticks) || ticks <= 0) return null
  return ticks / 10000000
})

// Audio player composable
const {
  audioEl,
  audioMountKey,
  isPlaying,
  isBuffering,
  progress,
  duration,
  currentTime,
  volume,
  repeatMode,
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
  togglePlayPause,
  handleStop,
  handleSeek,
  forceRemountAudioElement,
  refreshAudioOutputDevice,
  cleanupHls,
  resetRetries,
  stopPlaybackMonitor,
} = useAudioPlayer({
  nowPlaying: nowPlayingRef,
  settingsStore,
  playbackStore,
  metadataDurationSeconds,
  onNext: () => emit('next'),
})

// Cover image composable
const { coverImageUrl } = usePlayerCoverImage(nowPlayingRef)

// Artist fallback cover URL
const artistFallbackCoverUrl = computed(() => {
  const artistId = props.nowPlaying?.raw?.ArtistItems?.[0]?.Id || ''
  if (!artistId) return ''

  const baseInfo = props.nowPlaying?.coverUrl
  if (baseInfo && typeof baseInfo === 'object' && baseInfo.url && baseInfo.token) {
    const artistSrc = buildArtistPrimaryFallbackSrc(baseInfo, artistId)
    if (artistSrc) return artistSrc
  }

  const { token, serverUrl } = loadConnection()
  const base = makeBaseUrl(serverUrl)
  if (!base || !token) return ''
  return `${base}/emby/Items/${encodeURIComponent(artistId)}/Images/Primary?quality=80&X-Emby-Token=${encodeURIComponent(token)}`
})

// Audio device monitoring
useAudioDeviceMonitor({
  nowPlaying: nowPlayingRef,
  audioEl,
  refreshAudioOutputDevice,
  forceRemountAudioElement,
})

// Shuffle (synced with playback store)
const shuffleEnabled = computed({
  get: () => playbackStore.shuffleEnabled,
  set: (value) => playbackStore.setShuffleEnabled(value)
})

// EQ path toggle
const useEQAudioPath = ref(false)

// Provide refs to child components
provide('audioEl', audioEl)
provide('playerVolume', volume)
provide('isPlaying', isPlaying)
provide('playerProgress', progress)
provide('useEQAudioPath', useEQAudioPath)

// Emit playing state changes
watch([isPlaying, () => props.nowPlaying?.id], () => {
  emit('playingStateChange', {
    isPlaying: isPlaying.value,
    trackId: props.nowPlaying?.id || null,
  })
})

// Handle context navigation
function handleOpenContext() {
  const ctx = playbackStore?.context
  const scrollTarget = playbackStore?.currentTrackId

  if (ctx?.type === 'songs') {
    router.push({ path: '/songs', query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'album' && ctx?.id) {
    router.push({ path: `/album/${encodeURIComponent(ctx.id)}`, query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'playlist' && ctx?.id) {
    router.push({ path: `/playlist/${encodeURIComponent(ctx.id)}`, query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'home-recent') {
    router.push({ path: '/playlist/recent', query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'home-latest') {
    router.push({ path: '/playlist/latest', query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'home-frequent') {
    router.push({ path: '/playlist/frequent', query: { scrollTo: scrollTarget } })
    return
  }
  if (ctx?.type === 'favorites') {
    router.push({ path: '/favorites', query: { scrollTo: scrollTarget } })
    return
  }

  const raw = playbackStore?.nowPlaying?.raw
  const albumId = raw?.AlbumId || raw?.Album?.Id || raw?.ParentId
  if (albumId) {
    router.push({ path: `/album/${encodeURIComponent(albumId)}`, query: { scrollTo: scrollTarget } })
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  stopPlaybackMonitor()
  cleanupHls()
  resetRetries()

  if (audioEl.value) {
    try {
      audioEl.value.pause()
      audioEl.value.src = ''
      audioEl.value.removeAttribute('src')
      const sources = audioEl.value.querySelectorAll('source')
      sources.forEach(src => src.remove())
      audioEl.value.load()
    } catch (e) {
      console.warn('Error cleaning up audio element:', e)
    }
  }
})
</script>

<style scoped>
.playbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;
  height: 140px;
  background: rgba(10, 9, 14, 0.86);
  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.8);
  padding: 0;
  will-change: backdrop-filter;
}

.playbarContent {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 100%;
}
</style>
