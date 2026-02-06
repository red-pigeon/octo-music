<template>
  <button
    class="track-item"
    :class="{ 'is-playing': isCurrentlyPlaying, 'compact': compact, 'no-cover': hideCover, 'variant-list': variant === 'list', 'variant-flat': variant === 'flat' }"
    type="button"
    :disabled="disabled"
    :aria-disabled="disabled"
    @click="handlePlay"
    @mouseenter="emitHover"
    @focus="emitHover"
    @mouseleave="emitLeave"
    @blur="emitLeave"
  >
    <div v-if="showIndex" class="trackNumberArea">
      <div class="trackNumber">{{ trackNumber }}.</div>
    </div>
    <div v-if="!hideCover" class="cover" :class="{ 'cover--playing': isCurrentlyPlaying }" aria-hidden="true">
      <img :src="displayCover" :alt="title" loading="lazy" @error="handleCoverError" :class="{ 'cover__img--blur': isCurrentlyPlaying }" />
      <div v-if="isCurrentlyPlaying" class="play-indicator">
        <svg class="icon-playing" viewBox="0 0 24 24">
          <path :d="isPlaying ? mdiPause : mdiPlay" fill="currentColor" />
        </svg>
      </div>
    </div>
    <div class="content" :class="{ list: variant === 'list' }">
      <div class="text">
        <div class="title">{{ displayTitle }}</div>
        <router-link
          v-if="resolvedSubtitleMode === 'album' && albumId"
          class="subtitle-link"
          :to="`/album/${albumId}`"
          @click.stop
        >
          {{ subtitleText || 'Unknown Album' }}
        </router-link>
        <span v-else-if="resolvedSubtitleMode === 'album'" class="subtitle-text">
          {{ subtitleText || 'Unknown Album' }}
        </span>
        <ArtistLink
          v-else
          class="artist"
          :artist-id="track?.ArtistItems?.[0]?.Id"
          :artist-name="artist"
          fallback-name="Unknown Artist"
        />
      </div>
      <div v-if="showAlbum" class="albumCol">{{ albumName }}</div>
      <div v-if="showAddedDate" class="addedDateCol">{{ addedDate }}</div>
      <div class="duration">
        <span class="duration-text">{{ duration }}</span>
      </div>
      <button
        v-if="canToggleFavorite"
        type="button"
        class="favorite-btn"
        :class="{ 'is-favorite': isFavorite }"
        :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        :aria-label="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
        @click.stop="handleToggleFavorite"
        @mouseenter="isHoveringButton = true"
        @mouseleave="isHoveringButton = false"
        :disabled="togglingFavorite"
      >
        <svg viewBox="0 0 24 24" class="favorite-icon">
          <path :d="isHoveringButton ? (isFavorite ? mdiHeartMinus : mdiHeartPlus) : (isFavorite ? mdiHeartFill : mdiHeart)" fill="currentColor" />
        </svg>
      </button>
    </div>

    <div v-if="isCurrentlyPlaying" class="track-progress" aria-hidden="true">
      <div class="track-progress__fill" :style="{ width: `${progressPercent}%` }" />
    </div>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue'
import { mdiPlay, mdiPause, mdiHeart, mdiHeartMinus, mdiHeartPlus } from '@mdi/js'
import defaultCover from '../assets/default_cover.png'
import { formatTicksMSS, formatDateDMY } from '../utils/timeUtils.js'
import { useEmbyCoverImage } from '../composables/useEmbyCoverImage.js'
import { embyMarkFavorite, embyUnmarkFavorite } from '../services/emby.js'
import ArtistLink from './ArtistLink.vue'

const props = defineProps({
  track: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
  coverUrl: { type: [String, Object], default: '' },
  context: { type: Object, default: null },
  isCurrentlyPlaying: { type: Boolean, default: false },
  isPlaying: { type: Boolean, default: false },
  showIndex: { type: Boolean, default: false },
  inlineIndex: { type: Boolean, default: false },
  index: { type: Number, default: null },
  hideCover: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },
  variant: { type: String, default: 'card' },
  subtitleMode: { type: String, default: 'artist' },
  showAlbum: { type: Boolean, default: false },
  showAddedDate: { type: Boolean, default: false },
  canToggleFavorite: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  sessionStore: { type: Object, default: null },
})

const emit = defineEmits(['play', 'hover', 'leave', 'favorite-toggle'])

const togglingFavorite = ref(false)
const isHoveringButton = ref(false)
const mdiHeartFill = mdiHeart

const { coverImageUrl, displayCover, handleCoverError } = useEmbyCoverImage({
  watchSource: () => props.coverUrl,
  getFallbackImageInfo: () => props.coverUrl,
  defaultCover,
  getAlbumId: () => props.track?.AlbumId || null,
  getArtistId: () => props.track?.ArtistItems?.[0]?.Id || null,
})

const title = computed(() => props.track?.Name || 'Unknown Track')

const artist = computed(() => 
  props.track?.ArtistItems?.[0]?.Name ||
  props.track?.Artists?.[0] ||
  props.track?.AlbumArtist
)

const duration = computed(() => formatTicksMSS(props.track?.RunTimeTicks))
const albumName = computed(() => props.track?.Album || props.track?.AlbumName || '')
const addedDate = computed(() => formatDateDMY(props.track?.DateCreated || props.track?.PremiereDate))

const albumId = computed(() =>
  props.track?.AlbumId || props.track?.ParentId || ''
)

const resolvedSubtitleMode = computed(() => {
  const mode = String(props.subtitleMode || '').toLowerCase()
  return mode === 'album' ? 'album' : 'artist'
})

const subtitleText = computed(() => {
  if (resolvedSubtitleMode.value === 'album') {
    return albumName.value || artist.value || ''
  }
  return artist.value || ''
})

const trackNumber = computed(() =>
  typeof props.index === 'number' ? props.index + 1 : null
)

const displayTitle = computed(() => {
  if (props.inlineIndex && typeof trackNumber.value === 'number') {
    return `${trackNumber.value}. ${title.value}`
  }
  return title.value
})

const progressPercent = computed(() => {
  const value = Number(props.progress)
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
})

function emitHover() {
  emit('hover', { coverUrl: coverImageUrl.value || props.coverUrl || defaultCover })
}

function emitLeave() {
  emit('leave')
}

function handlePlay() {
  if (props.disabled) return
  emit('play', { track: props.track, context: props.context })
}

async function handleToggleFavorite() {
  if (!props.canToggleFavorite || !props.sessionStore) return
  
  togglingFavorite.value = true
  try {
    const { serverUrl, token, userId } = props.sessionStore
    const itemId = props.track?.Id
    
    if (!serverUrl || !token || !userId || !itemId) {
      console.error('Missing required data for favorite toggle')
      return
    }
    
    if (props.isFavorite) {
      await embyUnmarkFavorite({ serverUrl, token, userId, itemId })
    } else {
      await embyMarkFavorite({ serverUrl, token, userId, itemId })
    }
    
    emit('favorite-toggle', { track: props.track, isFavorite: !props.isFavorite })
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
  } finally {
    togglingFavorite.value = false
  }
}

</script>

<style scoped>
.track-item {
  --track-indicator-size: 32px;
  --track-icon-size: 24px;
  --track-indicator-shift: 6px;
  --track-indicator-shift-y: 4px;
  list-style: none;
  margin: 0;
  padding: 0 16px 0 0;
  height: 56px;
  width: 100%;
  max-width: none;
  background: rgba(8, 10, 14, 0.32);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border-top: 1px solid rgba(255, 255, 255, 0.10);
  position: relative;
  text-align: left;
  cursor: pointer;
  user-select: none;
  color: inherit;
  font: inherit;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 0;
  overflow: hidden;
  transition: all 0.15s ease;
}

.track-item.variant-list {
  padding-right: var(--track-list-pr, 28px);
  padding-left: var(--track-list-pl, 0px);
  border-radius: 0;
  background: rgba(8, 10, 14, 0.32);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  align-items: center;
  height: 56px;
  min-height: 56px;
  padding-top: 0;
  padding-bottom: 0;
}

.track-item.variant-flat {
  --track-indicator-shift-y: -1px;
  background: rgba(8, 10, 14, 0.32);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: none;
  border-top: none;
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.10);
}

.track-item.variant-list.no-cover {
  padding-left: var(--track-list-pl, 12px);
  padding-right: var(--track-list-pr, 28px);
}

.track-item.no-cover {
  padding-left: 12px;
  padding-right: calc(16px + var(--track-indicator-shift));
}

.cover {
  position: relative;
  width: var(--track-cover-cell, 56px);
  height: var(--track-cover-cell, 56px);
  align-self: center;
  border-radius: 0;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: var(--track-cover-pad, 0px);
  box-sizing: border-box;
}

.track-item.variant-list .cover {
  background: transparent;
  border: none;
  height: 100%;
  width: auto;
  aspect-ratio: 1 / 1;
  align-self: center;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover--playing {
  position: relative;
}

.cover__img--blur {
  filter: blur(10px);
}

.play-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  inset: 0;
  width: var(--track-indicator-size);
  height: var(--track-indicator-size);
  margin: auto;
}

.track-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.track-progress__fill {
  height: 100%;
  width: 0%;
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 1);
  transition: width 0.3s ease;
}

.icon-playing {
  width: var(--track-icon-size);
  height: var(--track-icon-size);
  color: rgba(255, 255, 255, 0.85);
  position: relative;
  z-index: 1;
}

.track-item.is-playing {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px) saturate(125%);
  -webkit-backdrop-filter: blur(10px) saturate(125%);
  border-color: rgba(255, 255, 255, 0.14);
}

.track-item.variant-list.is-playing {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px) saturate(125%);
  -webkit-backdrop-filter: blur(10px) saturate(125%);
  border-color: rgba(255, 255, 255, 0.16);
}

.track-item.variant-flat.is-playing {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(10px) saturate(125%);
  -webkit-backdrop-filter: blur(10px) saturate(125%);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.14);
}

.content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.content.list {
  display: grid;
  font-size: 12px;
  align-items: center;
  align-content: center;
  gap: var(--track-list-gap, 10px);
  grid-template-columns: var(--track-list-cols, 1fr 24ch 12ch 6ch);
  padding-right: 0;
}

.track-item.variant-list .content {
  align-self: center;
}

.content.list .text {
  align-self: start;
  padding-top: 4px;
}

.albumCol, .addedDateCol {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  align-self: center;
}

.trackNumber {
  font-size: 13px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.78);
  text-align: center;
  transition: opacity 0.15s ease;
}

.track-item:hover:enabled .trackNumber,
.track-item:focus-visible .trackNumber {
  opacity: 0;
  pointer-events: none;
}

.trackNumberArea {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  padding-right: 6px;
  align-self: center;
  position: relative;
  top: -2px;
  right: -2px;
}

.text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  transform: translateY(-3px);
}

.content:not(.list) .text {
  flex: 1;
}

.title {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.content.list .title {
  white-space: normal;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  line-height: 1.2em;
}

.content.list .artist {
  line-height: 1.2em;
}

.subtitle-link,
.subtitle-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  align-self: flex-start;
}

.subtitle-link {
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
}

.subtitle-link:hover,
.subtitle-link:focus-visible {
  text-decoration: underline;
  color: rgba(255, 255, 255, 0.9);
}

.artist {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  max-width: 100%;
  align-self: flex-start;
}

.duration {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  flex-shrink: 0;
  white-space: nowrap;
  display: grid;
  align-items: center;
  justify-items: end;
  align-self: center;
}

.content.list .duration {
  justify-self: end;
}

.duration-text {
  grid-area: 1 / 1;
}
.track-item:hover:enabled {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.track-item.variant-list:hover:enabled {
  background: rgba(255, 255, 255, 0.035);
  border-color: rgba(255, 255, 255, 0.12);
}

.track-item.variant-flat:hover:enabled {
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.12);
}

.track-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}

.track-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.track-item.compact {
  --track-indicator-size: 28px;
  --track-icon-size: 14px;
  --track-indicator-shift: 6px;
  --track-indicator-shift-y: -1px;
  --track-cover-cell: 40px;
  --track-cover-pad: 4px;
  padding: 0 12px 0 0;
  height: 40px;
  gap: 8px;
}

.track-item.compact.no-cover {
  padding-left: 12px;
  padding-right: calc(12px + var(--track-indicator-shift));
}

.track-item.compact .cover {
  width: var(--track-cover-cell, 40px);
  height: 100%;
}

.track-item.compact .title {
  font-size: 12px;
}

.track-item.compact .artist {
  font-size: 10px;
}

.track-item.compact .duration {
  font-size: 11px;
}

.favorite-btn {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 16px;
  height: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s ease;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  pointer-events: none;
  z-index: 10;
}

.track-item:hover:enabled .favorite-btn,
.track-item:focus-visible .favorite-btn {
  opacity: 1;
  pointer-events: auto;
}

.favorite-btn:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.7);
}

.favorite-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.favorite-btn.is-favorite {
  color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.9);
}

.favorite-btn.is-favorite:hover:not(:disabled) {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.2);
}

.favorite-icon {
  width: 16px;
  height: 16px;
}
</style>
