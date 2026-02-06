<template>
  <div
    :class="[
      'album',
      {
        'variant-tile': !isRailVariant,
        'variant-rail': isRailVariant,
        'with-details': showDetails,
        'has-artist': showDetails && showArtist,
        'has-overlay': showPlayOnHover || showViewOnHover || hoverCoverPlays || hoverInfoOpens || tilePlays,
      },
    ]"
    role="button"
    tabindex="0"
    @click="handleRootClick"
    @mouseenter="emitHover"
    @focus="emitHover"
  >
    <template v-if="isRailVariant">
      <div class="album-frame" :style="{ background: vinylGradient }">
        <div class="album-info">
          <div class="title">{{ title }}</div>
          <ArtistLink
            v-if="showDetails && showArtist"
            class="artist"
            :artist-id="album?.ArtistItems?.[0]?.Id"
            :artist-name="artist"
            fallback-name="Unknown Artist"
          />
          <div v-if="showDetails && album?.RunTimeTicks" class="submeta">
            <span>{{ formatTicksVerboseMinutesSeconds(album.RunTimeTicks) }}</span>
          </div>
        </div>
        <div class="cover-container" aria-hidden="true">
          <div class="cover-shell">
            <img :src="displayCover" :alt="title" loading="lazy" @error="handleCoverError" />
          </div>
          <div class="cover-fade"></div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="cover">
        <img :src="displayCover" :alt="title" loading="lazy" @error="handleCoverError" />

        <div
          v-if="hoverCoverPlays || tilePlays"
          class="coverPlay"
          aria-hidden="true"
        >
          <span class="coverPlayBtn" aria-hidden="true">
            <svg class="coverPlayIcon" viewBox="0 0 24 24">
              <path :d="mdiPlay" fill="currentColor" />
            </svg>
          </span>
        </div>

        <button
          v-if="canToggleFavorite"
          type="button"
          class="favorite-btn"
          :class="{ 'is-favorite': isFavorite }"
          :title="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
          :aria-label="isFavorite ? 'Remove from favorites' : 'Add to favorites'"
          @click.stop="handleToggleFavorite"
          @mouseenter="isHoveringFavorite = true"
          @mouseleave="isHoveringFavorite = false"
          :disabled="togglingFavorite"
        >
          <svg viewBox="0 0 24 24" class="favorite-icon">
            <path :d="isHoveringFavorite ? (isFavorite ? mdiHeartMinus : mdiHeartPlus) : (isFavorite ? mdiHeart : mdiHeart)" fill="currentColor" />
          </svg>
        </button>

        <div
          v-if="showPlayOnHover || showViewOnHover"
          class="overlayControls"
          aria-hidden="true"
        >
          <button
            v-if="showPlayOnHover"
            class="overlayBtn"
            type="button"
            title="Play"
            aria-label="Play album"
            @click.stop.prevent="emit('play', { album })"
            @mousedown.stop.prevent
          >
            Play
          </button>

          <button
            v-if="showViewOnHover"
            class="overlayBtn"
            type="button"
            title="View"
            aria-label="View album"
            @click.stop.prevent="emit('open', { album })"
            @mousedown.stop.prevent
          >
            View
          </button>
        </div>
      </div>

      <div class="info">
        <div v-if="hoverInfoOpens" class="infoView" aria-hidden="true">
          <span class="infoViewBtn" aria-hidden="true">
            <svg class="infoViewIcon" viewBox="0 0 24 24">
              <path :d="mdiPlaylistMusic" fill="currentColor" />
            </svg>
          </span>
        </div>
        <button
          v-if="titleOpens"
          class="title titleLink"
          type="button"
          @click.stop.prevent="emit('open', { album })"
          @mousedown.stop.prevent
        >
          {{ title }}
        </button>
        <div v-else class="title">{{ title }}</div>
        <ArtistLink
          v-if="showDetails && showArtist"
          class="artist"
          :artist-id="album?.ArtistItems?.[0]?.Id"
          :artist-name="artist"
          fallback-name="Unknown Artist"
        />
        <div v-if="showDetails && metaLine" class="meta">{{ metaLine }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { mdiPlay, mdiPlaylistMusic, mdiHeart, mdiHeartMinus, mdiHeartPlus } from '@mdi/js'
import defaultCover from '../assets/default_cover.png'
import { formatTicksVerboseMinutesSeconds } from '../utils/timeUtils.js'
import ArtistLink from './ArtistLink.vue'
import { computeVinylGradient } from '../utils/colorUtils.js'
import { useEmbyCoverImage } from '../composables/useEmbyCoverImage.js'
import { embyMarkFavorite, embyUnmarkFavorite } from '../services/emby.js'

const props = defineProps({
  album: { type: Object, default: null },
  coverUrl: { type: [String, Object], default: '' },
  variant: { type: String, default: 'tile' },
  showDetails: { type: Boolean, default: false },
  showArtist: { type: Boolean, default: true },
  showPlayOnHover: { type: Boolean, default: false },
  showViewOnHover: { type: Boolean, default: false },
  hoverCoverPlays: { type: Boolean, default: false },
  hoverInfoOpens: { type: Boolean, default: false },
  tilePlays: { type: Boolean, default: false },
  titleOpens: { type: Boolean, default: false },
  canToggleFavorite: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  sessionStore: { type: Object, default: null },
})

const emit = defineEmits(['open', 'hover', 'play', 'favorite-toggle'])

const vinylGradient = ref('linear-gradient(135deg, rgba(90,100,120,0.5), rgba(40,45,60,0.65))')
const isHoveringFavorite = ref(false)
const togglingFavorite = ref(false)

const isRailVariant = computed(() => props.variant === 'rail')

const title = computed(() => props.album?.Name || 'Unknown Album')
const artist = computed(() =>
  props.album?.ArtistItems?.[0]?.Name ||
  props.album?.AlbumArtist ||
  props.album?.Artists?.[0] ||
  'Unknown Artist'
)

const metaLine = computed(() => {
  const trackCount =
    props.album?.ChildCount ??
    props.album?.SongCount ??
    props.album?.RecursiveItemCount ??
    props.album?.ItemCounts?.SongCount

  return trackCount > 0 ? `${trackCount} songs` : ''
})

function maybeUpdateRailGradient(imageUrl) {
  if (!isRailVariant.value || !imageUrl || imageUrl === defaultCover) return
  computeVinylGradient(imageUrl, (gradient) => {
    vinylGradient.value = gradient
  })
}

const {
  coverImageUrl,
  displayCover,
  handleCoverError,
} = useEmbyCoverImage({
  watchSource: () => [props.coverUrl, props.variant],
  getFallbackImageInfo: () => props.coverUrl,
  defaultCover,
  getAlbumId: () => props.album?.Id || null,
  getArtistId: () => props.album?.ArtistItems?.[0]?.Id || null,
  onResolvedUrl: maybeUpdateRailGradient,
  fallbackToArtist: false,
})

function emitHover() {
  emit('hover', { album: props.album, coverUrl: coverImageUrl.value || props.coverUrl || defaultCover })
}

function handleRootClick(event) {
  if (props.tilePlays) {
    emit('play', { album: props.album })
    return
  }

  const target = event.target
  if (target.closest('.cover') && props.hoverCoverPlays) {
    emit('play', { album: props.album })
    return
  }
  if (target.closest('.info') && props.hoverInfoOpens) {
    emit('open', { album: props.album })
    return
  }
  emit('open', { album: props.album })
}

async function handleToggleFavorite(e) {
  e.stopPropagation()
  if (!props.canToggleFavorite || !props.sessionStore) return
  
  togglingFavorite.value = true
  try {
    const { serverUrl, token, userId } = props.sessionStore
    const itemId = props.album?.Id
    
    if (!serverUrl || !token || !userId || !itemId) {
      console.error('Missing required data for favorite toggle')
      return
    }
    
    if (props.isFavorite) {
      await embyUnmarkFavorite({ serverUrl, token, userId, itemId })
    } else {
      await embyMarkFavorite({ serverUrl, token, userId, itemId })
    }
    
    emit('favorite-toggle', { album: props.album, isFavorite: !props.isFavorite })
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
  } finally {
    togglingFavorite.value = false
  }
}
</script>

<style scoped>
.album.variant-rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  user-select: none;
  color: inherit;
  font: inherit;
  width: 100%;
  overflow: visible;
}

.album.variant-rail:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.35);
  outline-offset: 4px;
}

.album.variant-rail .album-frame {
  position: relative;
  width: 100%;
  height: 150px;
  border-radius: 0;
  padding: 20px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 30px;
  overflow: hidden;
}

.album.variant-rail .album-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
  flex: 1;
  z-index: 2;
  position: relative;
}

.album.variant-rail .title {
  font-weight: 700;
  font-size: 18px;
  line-height: var(--album-title-line-height, 1.2);
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album.variant-rail .artist {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.72);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album.variant-rail .submeta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.65);
}

.album.variant-rail .cover-container {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 50%;
  flex-shrink: 0;
  overflow: hidden;
}

.album.variant-rail .cover-shell {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  z-index: 1;
}

.album.variant-rail .cover-shell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  mask-image: linear-gradient(to right, transparent, black);
  -webkit-mask-image: linear-gradient(to right, transparent, black);
}

.album.variant-rail .cover-fade {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 120px;
  background: linear-gradient(to right, rgba(0, 0, 0, 0), transparent);
  z-index: 2;
  pointer-events: none;
}

.album.variant-rail:hover .album-frame {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.album.variant-rail:hover .cover-shell img {
  transform: scale(1.02);
  transition: transform 0.18s ease;
}

@media (prefers-reduced-motion: reduce) {
  .album.variant-rail:hover .album-frame,
  .album.variant-rail:hover .cover-shell img {
    transition: none;
    transform: none;
  }
}

.album {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  color: inherit;
  align-self: start;
}

.album:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.14);
}

.album:active {
  transform: translateY(0px);
}

.album:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.35);
  outline-offset: 3px;
}

.cover {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  position: relative;
}

.info {
  padding-top: var(--album-info-pt, 12px);
  padding-right: 10px;
  padding-bottom: 10px;
  padding-left: 10px;
  position: relative;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: filter 0.15s ease;
}

.coverPlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}

.album.has-overlay:hover .coverPlay,
.album.has-overlay:focus-within .coverPlay {
  opacity: 1;
}

.cover:has(.favorite-btn:hover) .coverPlay {
  opacity: 0;
  pointer-events: none;
}

/* If the user is interacting with the title specifically, hide the cover play overlay. */
.album.has-overlay:has(.info .title:hover) .coverPlay {
  opacity: 0;
}

.album.has-overlay:has(.info .artist:hover) .coverPlay {
  opacity: 0;
}

.album.has-overlay:has(.info .artist:hover) .coverPlayBtn {
  opacity: 0;
  transform: translateY(8px);
}

.coverPlayBtn {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 14, 0.55);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.album.has-overlay:hover .coverPlayBtn,
.album.has-overlay:focus-within .coverPlayBtn {
  opacity: 1;
  transform: translateY(0);
}

.album.has-overlay:has(.info .title:hover) .coverPlayBtn {
  opacity: 0;
  transform: translateY(8px);
}

.coverPlayIcon {
  width: 18px;
  height: 18px;
}

.favorite-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  background: rgba(8, 10, 14, 0.6);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  color: rgba(255, 255, 255, 0.6);
  padding: 0;
  margin: 0;
  z-index: 5;
  opacity: 0;
  pointer-events: none;
}

.album:hover .favorite-btn,
.album:focus-visible .favorite-btn {
  opacity: 1;
  pointer-events: auto;
}

.favorite-btn:hover:not(:disabled) {
  background: rgba(8, 10, 14, 0.8);
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.25);
}

.favorite-btn.is-favorite {
  color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.9);
}

.favorite-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.favorite-icon {
  width: 16px;
  height: 16px;
}

.infoView {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%) scale(0.92);
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.album.has-overlay .info:hover .infoView,
.album.has-overlay .info:focus-within .infoView {
  opacity: 1;
  transform: translateY(-50%) scale(1);
}

.infoViewBtn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(8, 10, 14, 0.55);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
}

.infoViewIcon {
  width: 18px;
  height: 18px;
}

.overlayControls {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.92);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.album:hover .overlayControls,
.album:focus-visible .overlayControls {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
  pointer-events: auto;
}

.overlayBtn {
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 10, 14, 0.55);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
}

.overlayBtn:hover {
  background: rgba(8, 10, 14, 0.65);
  border-color: rgba(255, 255, 255, 0.14);
}

.overlayBtn:active {
  transform: scale(0.98);
}

.overlayBtn:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.35);
  outline-offset: 2px;
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);

  line-height: 1.2em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 1;
  -webkit-line-clamp: 1;
}

.titleLink {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 0;
  outline: none;
}

.titleLink:hover,
.titleLink:focus-visible {
  text-decoration: underline;
}

.album.variant-tile.with-details.has-artist .title {
  line-clamp: 1;
  -webkit-line-clamp: 1;
}

.artist {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5em;
  height: 1.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.85);
  width: fit-content;
}

.meta {
  font-size: 12px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5em;
  height: 1.5em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album:hover .title {
  color: rgba(255, 255, 255, 1);
}
</style>