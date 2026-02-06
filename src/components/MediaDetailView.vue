<template>
  <div :class="`${props.mediaType}Page`">
    <BackgroundGradient :coverUrl="gradientCoverUrl" />
    <div :class="`${props.mediaType}Layout`">
      <div
        :class="[`${props.mediaType}Hero`, { noCover: !props.coverUrl }]"
        :style="heroStyle"
      >
        <div class="heroShade" aria-hidden="true"></div>
        <div class="heroContent">
          <div class="heroHeader">
            <div v-if="props.mediaType === 'album' && resolvedCoverSrc" class="heroCover" aria-hidden="true">
              <img :src="resolvedCoverSrc" alt="" loading="lazy" />
            </div>

            <div class="heroText">
              <div class="heroKicker">{{ heroKicker }}</div>
              <h1 class="heroTitle">{{ props.title }}</h1>
              <ArtistLink
                v-if="props.subtitle"
                class="heroArtist"
                :artist-id="props.subtitleArtistId"
                :artist-name="props.subtitle"
                fallback-name=""
              />
              <div v-if="props.tracks.length" class="heroCounts">{{ props.tracks.length }} tracks</div>
            </div>
          </div>

          <div class="heroActions actionButtons">
            <button class="actionButton playButton" type="button" @click="handlePlayAll" aria-label="Play" title="Play" :disabled="!props.tracks.length">
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiPlay" /></svg></span>
            </button>
            <button class="actionButton shuffleButton" type="button" @click="handleShuffle" aria-label="Shuffle" title="Shuffle" :disabled="!props.tracks.length">
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiShuffle" /></svg></span>
            </button>
            <button
              v-if="props.mediaItem"
              class="actionButton favoriteButton"
              type="button"
              @click="handleMediaFavoriteToggle"
              :class="{ 'is-favorite': props.mediaItem?.UserData?.IsFavorite }"
              :title="props.mediaItem?.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :aria-label="props.mediaItem?.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :disabled="!props.mediaItem || togglingMediaFavorite"
            >
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="props.mediaItem?.UserData?.IsFavorite ? mdiHeartFill : mdiHeart" fill="currentColor" /></svg></span>
            </button>
          </div>
        </div>
      </div>

      <div class="tracksCard" :style="trackListVars">
        <div class="trackListHeaderRow" :class="{ 'has-cover': props.mediaType !== 'album' }">
          <div class="trackListIndexHeader">#</div>
          <div v-if="props.mediaType !== 'album'" class="trackListCoverSpacer" aria-hidden="true"></div>
          <div class="trackListHeaderGrid">
            <span>Title</span>
            <span v-if="props.mediaType !== 'album'">Album</span>
            <span v-if="props.mediaType === 'playlist'">Added date</span>
            <span>Time</span>
          </div>
        </div>
        <div class="trackList">
          <Track
            v-for="(track, idx) in tracks"
            :key="track.Id"
            :ref="(el) => trackRefs.set(track.Id, el)"
            :track="track"
            :index="idx"
            :showIndex="true"
            :inlineIndex="false"
            :hideCover="props.mediaType === 'album'"
            :compact="false"
            variant="list"
            :showAlbum="props.mediaType !== 'album'"
            :showAddedDate="props.mediaType === 'playlist'"
            :coverUrl="coverUrlFor(track, sessionStore)"
            :context="props.tracks"
            :isCurrentlyPlaying="currentPlayingId === track.Id"
            :isPlaying="isCurrentlyPlaying && currentPlayingId === track.Id"
            :progress="currentPlayingId === track.Id ? currentProgress : 0"
            :canToggleFavorite="true"
            :isFavorite="track.UserData?.IsFavorite || false"
            :sessionStore="sessionStore"
            @play="handleTrackPlay"
            @hover="(e) => { gradientCoverUrl.value = e.coverUrl || null }"
            @favorite-toggle="handleFavoriteToggle"
          />
        </div>
        <div v-if="!props.loading && !props.tracks.length" class="empty">{{ props.emptyMessage }}</div>
        <div v-if="props.error" class="error">{{ props.error }}</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BackgroundGradient from './BackgroundGradient.vue'
import Track from './Track.vue'
import ArtistLink from './ArtistLink.vue'
import { mdiPlay, mdiShuffle, mdiHeart } from '@mdi/js'
import { coverUrlFor } from '../services/mediaUtils.js'
import { resolveEmbyImageSrc } from '../utils/embyImageUtils.js'
import { useSessionStore } from '../stores/session.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'
import { embyMarkFavorite, embyUnmarkFavorite } from '../services/emby.js'

const props = defineProps({
  mediaType: {
    type: String,
    default: 'album'
  },
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  subtitleArtistId: {
    type: String,
    default: ''
  },
  coverUrl: {
    type: [String, Object],
    default: ''
  },
  mediaItem: {
    type: Object,
    default: null
  },
  tracks: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  emptyMessage: {
    type: String,
    default: 'No tracks found.'
  }
})

const emit = defineEmits(['play-all', 'shuffle', 'track-play'])

const mdiHeartFill = mdiHeart
const router = useRouter()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()
sessionStore.hydrate()
settingsStore.hydrate()
const trackRefs = new Map()
const gradientCoverUrl = ref(null)
const togglingMediaFavorite = ref(false)
const { playbackStore, handlePlayItem } = usePlaybackController()
const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)
const currentPlayingId = computed(() => playbackStore.currentTrackId)
const currentProgress = computed(() => playbackStore.progress || 0)
const hasScrolledToTrack = ref(false)
let scrollAttempts = 0

function attemptScrollToTrack() {
  // Check if auto-scroll is enabled
  if (settingsStore.autoScrollToPlayingTrack === false) return
  
  // First check for explicit scroll target from query
  let scrollTarget = router.currentRoute.value.query.scrollTo
  
  // If no explicit target, check if current playing track is in this list
  if (!scrollTarget && playbackStore.currentTrackId) {
    const isInCurrentList = props.tracks.some(t => t.Id === playbackStore.currentTrackId)
    if (isInCurrentList) {
      scrollTarget = playbackStore.currentTrackId
    }
  }
  
  console.log('[MediaDetailView] Router query:', router.currentRoute.value.query)
  console.log('[MediaDetailView] Attempting scroll to:', scrollTarget, 'hasScrolled:', hasScrolledToTrack.value, 'trackRefs size:', trackRefs.size, 'tracks length:', props.tracks.length)
  console.log('[MediaDetailView] Current playback ID:', playbackStore.currentTrackId)
  
  if (!scrollTarget || hasScrolledToTrack.value) return
  
  if (trackRefs.has(scrollTarget)) {
    console.log('[MediaDetailView] Found track ref, scrolling...')
    hasScrolledToTrack.value = true
    nextTick(() => {
      setTimeout(() => {
        const el = trackRefs.get(scrollTarget)
        const dom = el?.$el || el
        if (dom?.scrollIntoView) {
          console.log('[MediaDetailView] Scrolling into view')
          dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 150)
    })
  } else if (scrollAttempts < 20 && props.tracks.length > 0) {
    // Track components might not be rendered yet, retry
    scrollAttempts++
    console.log('[MediaDetailView] Track ref not found, retry attempt:', scrollAttempts)
    setTimeout(() => attemptScrollToTrack(), 150)
  }
}

// Watch for tracks to be loaded and attempt scroll
watch(() => props.tracks.length, (newLength) => {
  if (newLength > 0 && !hasScrolledToTrack.value) {
    console.log('[MediaDetailView] Tracks loaded, length:', newLength)
    scrollAttempts = 0
    nextTick(() => attemptScrollToTrack())
  }
})

onMounted(() => {
  console.log('[MediaDetailView] Mounted')
  nextTick(() => attemptScrollToTrack())
})

const trackListVars = computed(() => {
  const cols = props.mediaType === 'playlist'
    ? '1fr 24ch 12ch 6ch'
    : props.mediaType === 'album'
      ? '1fr 6ch'
      : '1fr 24ch 6ch'

  return {
    '--track-list-cols': cols,
    '--track-list-gap': '10px',
    '--track-list-pr': '28px',
    '--track-list-pl': '12px',
    '--track-cover-cell': '44px',
    '--track-cover-pad': '4px'
  }
})

const heroStyle = computed(() => {
  if (props.mediaType === 'playlist') {
    return {
      backgroundColor: 'var(--octo-bg-common-color, rgba(120, 150, 190, 0.22))',
      backgroundImage: 'none'
    }
  }

  if (props.coverUrl) {
    const resolvedUrl = resolveEmbyImageSrc(props.coverUrl)
    if (resolvedUrl) {
      return {
        backgroundImage: `linear-gradient(180deg, rgba(5,7,12,0.15) 0%, rgba(5,7,12,0.4) 60%, rgba(5,7,12,0.85) 100%), url(${resolvedUrl})`
      }
    }
  }

  return {}
})

const resolvedCoverSrc = computed(() => {
  if (!props.coverUrl) return ''
  return resolveEmbyImageSrc(props.coverUrl) || ''
})

const heroKicker = computed(() => {
  if (props.mediaType === 'album') return 'Album'
  if (props.mediaType === 'playlist') return 'Playlist'
  return ''
})

watch(() => props.coverUrl, (newVal) => {
  gradientCoverUrl.value = newVal || null
}, { immediate: true })

function handlePlayAll() {
  emit('play-all', props.tracks[0])
  handlePlayItem(props.tracks[0], false, props.tracks)
}

function handleShuffle() {
  const shuffled = [...props.tracks].sort(() => Math.random() - 0.5)
  emit('shuffle', shuffled[0])
  handlePlayItem(shuffled[0], false, shuffled)
  playbackStore.setShuffleEnabled(true)
}

function handleTrackPlay(e) {
  const track = e?.track
  if (!track) return

  const queueContext = Array.isArray(e?.context) ? e.context : e?.context?.value || props.tracks
  if (currentPlayingId.value === track.Id && playbackStore.nowPlaying) {
    const audioEl = document.querySelector('audio')
    if (audioEl?.paused) {
      audioEl.play().catch((err) => window.console?.warn('Play failed:', err))
    } else {
      audioEl.pause()
    }
  } else {
    emit('track-play', { track, queueContext })
    handlePlayItem(track, false, queueContext)
  }
  const coverInfo = coverUrlFor(track, sessionStore)
  if (coverInfo) gradientCoverUrl.value = coverInfo
}

function handleFavoriteToggle(e) {
  const track = e?.track
  if (!track) return
  
  // Update the favorite state in the tracks list
  const idx = props.tracks.findIndex(t => t.Id === track.Id)
  if (idx >= 0) {
    if (!props.tracks[idx].UserData) {
      props.tracks[idx].UserData = {}
    }
    props.tracks[idx].UserData.IsFavorite = !props.tracks[idx].UserData.IsFavorite
  }
}

async function handleMediaFavoriteToggle() {
  try {
    if (!props.mediaItem) return
    
    togglingMediaFavorite.value = true
    const { serverUrl, token, userId } = sessionStore || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')
    
    const itemId = props.mediaItem.Id
    const isFavorite = props.mediaItem.UserData?.IsFavorite || false
    
    if (isFavorite) {
      await embyUnmarkFavorite({ serverUrl, token, userId, itemId })
    } else {
      await embyMarkFavorite({ serverUrl, token, userId, itemId })
    }
    
    // Update the state
    if (!props.mediaItem.UserData) {
      props.mediaItem.UserData = {}
    }
    props.mediaItem.UserData.IsFavorite = !isFavorite
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
  } finally {
    togglingMediaFavorite.value = false
  }
}

watch(
  () => props.tracks,
  (list) => {
    if (gradientCoverUrl.value || !list.length) return
    gradientCoverUrl.value = coverUrlFor(list[0], sessionStore) || null
  },
  { immediate: true }
)
</script>

<style scoped>
.albumPage, .playlistPage {
  width: 100%;
  height: calc(100vh - 32px);
  padding: 50px 0 180px;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  overflow-y: auto;
  scrollbar-width: none;
}
.albumPage::-webkit-scrollbar, .playlistPage::-webkit-scrollbar { display: none; }

.playlistPage {
  padding-bottom: 216px;
}

.albumHero, .playlistHero {
  position: relative;
  width: 100%;
  height: clamp(200px, 22vw, 220px);
  border-radius: 14px;
  overflow: hidden;
  background: linear-gradient(180deg, #0b0d14 0%, #07090f 100%);
  background-size: cover;
  background-position: center;
  box-shadow: 0 22px 48px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.albumHero.noCover, .playlistHero.noCover {
  background: linear-gradient(135deg, #192030, #0f131d);
}

.heroShade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 18%, var(--octo-bg-common-color, rgba(120, 150, 190, 0.18)) 0%, transparent 58%),
    linear-gradient(180deg, rgba(7, 9, 15, 0.10) 0%, rgba(7, 9, 15, 0.42) 55%, rgba(7, 9, 15, 0.90) 100%);
}

.playlistHero .heroShade {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.09) 0%, transparent 42%),
    radial-gradient(circle at 22% 18%, var(--octo-bg-common-color, rgba(120, 150, 190, 0.22)) 0%, transparent 58%),
    linear-gradient(180deg, rgba(7, 9, 15, 0.18) 0%, rgba(7, 9, 15, 0.55) 55%, rgba(7, 9, 15, 0.92) 100%);
}

.heroContent {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 18px 18px;
  z-index: 1;
}

.heroHeader {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  min-width: 0;
}

.heroText {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.heroCover {
  width: 108px;
  height: 108px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
  background: rgba(7, 9, 15, 0.55);
}

.heroCover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.heroActions {
  position: absolute;
  top: 14px;
  right: 14px;
}

.heroKicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.70);
}

.albumHero .heroKicker {
  color: rgba(255, 255, 255, 0.76);
}

.playlistHero .heroKicker {
  color: rgba(255, 255, 255, 0.78);
}

.heroTitle {
  margin: 0;
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
  text-shadow: 0 10px 26px rgba(0, 0, 0, 0.52);
  line-height: 1.08;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.heroArtist {
  font-size: 17px;
  color: rgba(255, 255, 255, 0.86);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.heroCounts {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.albumLayout, .playlistLayout {
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
  padding: 0 56px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: stretch;
}

.actionButtons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actionButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 12, 18, 0.78);
  color: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  transition: background 0.15s ease, transform 0.12s ease, border-color 0.15s ease;
  white-space: nowrap;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
}

.actionButton:hover:not(:disabled) {
  background: rgba(10, 12, 18, 0.92);
  border-color: rgba(255, 255, 255, 0.36);
}

.actionButton:active:not(:disabled) {
  transform: translateY(1px);
}

.actionButton:focus-visible {
  outline: 2px solid rgba(237, 34, 93, 0.45);
  outline-offset: 2px;
}

.actionButton:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.actionButton .icon {
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.actionButton .icon svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.tracksCard {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  height: fit-content;
}

.trackListHeaderRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px var(--track-list-pr, 28px) 8px var(--track-list-pl, 0px);
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
  margin-left: -8px;
}

.trackListCoverSpacer {
  width: var(--track-cover-cell, 56px);
  flex-shrink: 0;
}

.trackListIndexHeader {
  width: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trackListHeaderGrid {
  flex: 1;
  min-width: 0;
  display: grid;
  align-items: center;
  gap: var(--track-list-gap, 10px);
  grid-template-columns: var(--track-list-cols, 1fr 24ch 12ch 6ch);
}

.trackListHeaderGrid > :last-child {
  text-align: right;
}
.trackList {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.empty {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px;
}

.error {
  margin-top: 10px;
  font-size: 12px;
  color: rgba(255, 140, 140, 0.95);
}

@media (max-width: 720px) {
  .albumLayout, .playlistLayout {
    padding: 0 22px;
  }

  .albumHero, .playlistHero {
    height: clamp(180px, 36vw, 220px);
  }
}
</style>
