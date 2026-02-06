<template>
  <section class="rail">
    <div class="rail-header">
      <button
        v-if="isPlaylistViewRail"
        class="rail-title-link"
        type="button"
        @click="handleViewPlaylist"
        :aria-label="`Open ${title} playlist`"
      >
        <h3>{{ title }}</h3>
      </button>
      <h3 v-else>{{ title }}</h3>
    </div>
    <div v-if="renderItems.length === 0 && !loading" class="small muted">{{ emptyMessage }}</div>
    <div v-else class="rail-wrapper">
      <!-- Left fade -->
      <div v-if="scrollState.canScrollLeft" class="fade-overlay fade-left"></div>

      <!-- Right fade -->
      <div v-if="scrollState.canScrollRight" class="fade-overlay fade-right"></div>

      <!-- Left scroll button -->
      <button
        v-if="scrollState.canScrollLeft"
        class="scroll-btn scroll-left"
        @click.stop.prevent="scrollRail($event, 'left')"
        @mousedown.stop.prevent
        aria-label="Scroll left"
      >
        ‹
      </button>

      <!-- 1-row for albums, 3-row grid for tracks -->
      <div
        ref="listElement"
        :class="['tracks-grid', { 'album-row': isAlbumRail, 'album-tiles': isAlbumRail && useCompactAlbumTiles }]"
        @scroll="handleListScroll"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
        @click="handleContainerClick"
      >
        <template v-for="it in renderItems" :key="it.Id">
          <Track
            v-if="isAudioItem(it)"
            :track="it"
            :coverUrl="coverUrlFor(it)"
            variant="flat"
            :subtitleMode="trackSubtitleMode"
            :context="renderItems"
            :isCurrentlyPlaying="currentPlayingId === it.Id"
            :isPlaying="isPlaying"
            :progress="currentPlayingId === it.Id ? currentProgress : 0"
            :roundCover="roundCover"
            @play="handleTrackPlay"
            @hover="handleItemHover"
            @leave="handleItemLeave"
          />
          <Artist
            v-else-if="it?.Type === 'MusicArtist'"
            :artist="it"
            :coverUrl="coverUrlFor(it)"
            @open="handleArtistOpen"
            @hover="handleItemHover"
            @mouseleave="handleItemLeave"
            @blur="handleItemLeave"
          />
          <Album
            v-else-if="it?.Type === 'MusicAlbum' && useCompactAlbumTiles"
            :album="it"
            :coverUrl="coverUrlFor(it)"
            variant="tile"
            appearance="flat"
            :showDetails="true"
            :tilePlays="true"
            :titleOpens="true"
            :canToggleFavorite="true"
            :isFavorite="it.UserData?.IsFavorite || false"
            :sessionStore="sessionStore"
            @open="handleAlbumOpen"
            @play="handleAlbumQuickPlay"
            @hover="handleItemHover"
            @mouseleave="handleItemLeave"
            @blur="handleItemLeave"
            @favorite-toggle="emit('albumfavoritetoggle', $event)"
          />
          <Album
            v-else-if="it?.Type === 'MusicAlbum'"
            :album="it"
            :coverUrl="coverUrlFor(it)"
            variant="rail"
            appearance="flat"
            :showDetails="true"
            :showArtist="true"
            :canToggleFavorite="true"
            :isFavorite="it.UserData?.IsFavorite || false"
            :sessionStore="sessionStore"
            @open="handleAlbumOpen"
            @hover="handleItemHover"
            @mouseleave="handleItemLeave"
            @blur="handleItemLeave"
            @favorite-toggle="emit('albumfavoritetoggle', $event)"
          />
          <div v-else class="row muted">Not playable</div>
        </template>
      </div>

      <!-- Right scroll button -->
      <button
        v-if="scrollState.canScrollRight"
        class="scroll-btn scroll-right"
        @click.stop.prevent="scrollRail($event, 'right')"
        @mousedown.stop.prevent
        aria-label="Scroll right"
      >
        ›
      </button>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Track from './Track.vue'
import Album from './Album.vue'
import Artist from './Artist.vue'
import { usePlaybackStore } from '../stores/playback.js'

const props = defineProps({
  title: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  emptyMessage: { type: String, default: 'No items found.' },
  coverUrlFor: { type: Function, default: () => '' },
  isAudioItem: { type: Function, default: () => false },
  currentPlayingId: { type: String, default: null },
  isPlaying: { type: Boolean, default: false },
  roundCover: { type: Boolean, default: false },
  trackSubtitleMode: { type: String, default: 'artist' },
  sessionStore: { type: Object, default: null },
})

const emit = defineEmits(['trackplay', 'albumplay', 'albumquickplay', 'itemhover', 'itemleave', 'viewplaylist', 'artistopen', 'albumfavoritetoggle'])

const listElement = ref(null)
const scrollState = ref({ canScrollLeft: false, canScrollRight: false })
const playbackStore = usePlaybackStore()
const currentProgress = computed(() => playbackStore.progress || 0)
let isDragging = false
let dragStartX = 0
let dragStartScrollLeft = 0
let wasDragged = false

const renderItems = computed(() =>
  props.items.filter((it) => props.isAudioItem(it) || it?.Type === 'MusicAlbum' || it?.Type === 'MusicArtist')
)

const isAlbumRail = computed(() =>
  renderItems.value.length > 0 && renderItems.value.every((it) => !props.isAudioItem(it))
)

const useCompactAlbumTiles = computed(() => props.title === 'Latest Music')

const isPlaylistViewRail = computed(() =>
  props.title === 'Recently Played' || props.title === 'Frequently Played'
)

function updateScrollState() {
  if (!listElement.value) return

  const el = listElement.value
  const remainingRight = el.scrollWidth - (el.scrollLeft + el.clientWidth)

  scrollState.value = {
    canScrollLeft: el.scrollLeft > 1,
    canScrollRight: remainingRight > 1
  }
}

function getScrollStep() {
  if (!listElement.value) return 500

  const firstChild = listElement.value.firstElementChild
  const width = firstChild?.getBoundingClientRect()?.width
  if (width) return width * 1.2

  return listElement.value.clientWidth > 0 ? listElement.value.clientWidth * 0.9 : 500
}

function scrollRail(event, direction) {
  if (!listElement.value) return
  const delta = direction === 'right' ? getScrollStep() : -getScrollStep()
  listElement.value.scrollBy({ left: delta, behavior: 'smooth' })
  setTimeout(() => updateScrollState(), 220)
}

function handleListScroll() {
  updateScrollState()
}

function handleMouseDown(event) {
  if (event.button !== 0 || !listElement.value) return

  isDragging = true
  wasDragged = false
  dragStartX = event.clientX
  dragStartScrollLeft = listElement.value.scrollLeft
  event.preventDefault()
}

function handleMouseMove(event) {
  if (!isDragging || !listElement.value) return

  const deltaX = event.clientX - dragStartX

  if (Math.abs(deltaX) > 5) {
    wasDragged = true
  }

  listElement.value.scrollLeft = dragStartScrollLeft - deltaX
  updateScrollState()
}

function handleMouseUp() {
  if (wasDragged && listElement.value) {
    listElement.value.style.pointerEvents = 'none'
    setTimeout(() => {
      if (listElement.value) listElement.value.style.pointerEvents = ''
    }, 0)
  }
  isDragging = false
}

function handleContainerClick(event) {
  if (wasDragged) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }
  wasDragged = false
}

function handleTrackPlay(e) {
  if (wasDragged) return

  const originMap = {
    'Latest Music': 'home-latest',
    'Recently Played': 'home-recent',
    'Frequently Played': 'home-frequent'
  }

  const originType = originMap[props.title]
  emit('trackplay', { ...e, origin: originType ? { type: originType } : null })
}

function handleAlbumOpen(e) {
  if (!wasDragged) emit('albumplay', e)
}

function handleArtistOpen(e) {
  if (!wasDragged) emit('artistopen', e)
}

function handleAlbumQuickPlay(e) {
  if (!wasDragged) emit('albumquickplay', e)
}

function handleItemHover(e) {
  if (!isDragging) emit('itemhover', e)
}

function handleItemLeave() {
  if (!isDragging) emit('itemleave')
}

function handleViewPlaylist() {
  const playlistMap = {
    'Recently Played': 'recent',
    'Frequently Played': 'frequent'
  }

  const playlist = playlistMap[props.title]
  if (playlist) emit('viewplaylist', playlist)
}

function handleResize() {
  setTimeout(() => updateScrollState(), 0)
}

onMounted(() => {
  setTimeout(() => updateScrollState(), 0)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.rail {
  margin-bottom: 20px;
}

.rail-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.rail-title-link {
  background: none;
  border: none;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 0px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.rail-title-link h3 {
  text-decoration: none;
}

.rail-title-link:hover,
.rail-title-link:focus-visible {
  opacity: 1;
}

.rail-title-link:hover h3,
.rail-title-link:focus-visible h3 {
  text-decoration: underline;
}

.rail-title-link:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 4px;
  border-radius: 6px;
}

.rail-header h3 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2px;
  opacity: 0.9;
}

.arrow-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
  transform: translateY(2px);
}

.small {
  font-size: 13px;
}

.muted {
  opacity: 0.5;
}

.rail-wrapper {
  position: relative;
  width: 100%;
}

.tracks-grid {
  display: grid;
  grid-template-rows: repeat(3, auto);
  grid-auto-flow: column;
  grid-auto-columns: 360px;
  gap: 8px;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0;
  scrollbar-width: none;
  -ms-overflow-style: none;
  user-select: none;
  justify-content: flex-start;
  align-content: start;
}

.tracks-grid.album-row {
  grid-template-rows: auto;
  grid-auto-flow: column;
  grid-auto-columns: 360px;
  gap: 8px;
  justify-content: flex-start;
  align-content: start;
}

.tracks-grid.album-row.album-tiles {
  grid-auto-columns: 168px;
  gap: 14px;
}

.tracks-grid::-webkit-scrollbar {
  display: none;
}

.scroll-btn {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 80px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 48px;
  line-height: 1;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
  opacity: 0;
}

.rail-wrapper:hover .scroll-btn {
  opacity: 1;
}

.scroll-btn:hover {
  color: rgba(255, 255, 255, 1);
  transform: scale(1.05);
}

.scroll-btn:active {
  transform: scale(0.98);
}

.scroll-left {
  left: 0;
}

.scroll-right {
  right: 0;
}

.fade-overlay {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 80px;
  pointer-events: none;
  z-index: 9;
  transition: opacity 0.3s ease;
}

.fade-left {
  left: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.65),
    rgba(0, 0, 0, 0.25),
    transparent
  );
}

.fade-right {
  right: 0;
  background: linear-gradient(
    to left,
    rgba(0, 0, 0, 0.65),
    rgba(0, 0, 0, 0.25),
    transparent
  );
}

.row {
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
  user-select: none;
  width: 100%;
  text-align: left;
  display: block;
  color: inherit;
  font: inherit;
}

.row:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.row:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.5);
  outline-offset: 2px;
}
</style>

