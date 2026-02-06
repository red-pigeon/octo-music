<template>
  <div class="songs-page">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading && allTracks.length === 0" class="page-loading">
      <Spinner :size="52" />
    </div>

    <div v-else class="songs-layout">
      <div class="controls-row" v-if="hasSongsAll">
        <PillButton
          class="shuffle-button"
          type="button"
          @click="handleShuffle"
          aria-label="Shuffle"
          title="Shuffle"
          :disabled="filteredTracks.length === 0"
        >
          <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiShuffle" /></svg></span>
        </PillButton>

        <FilterBar
          ref="filterBarRef"
          v-model="selectedFilter"
          :options="filterLetters"
          v-model:search="searchTerm"
          searchPlaceholder="Search songs"
          searchAriaLabel="Search songs"
          @change="handleFilterChanged"
        />
      </div>

      <div v-if="hasSongsAll" ref="songsContentRef" class="songs-content" @scroll="handleContentScroll">
        <div class="tracksCard">
          <div class="tracksHeader">
            <span>Tracks</span>
            <span class="tracksCount">{{ filteredTracks.length }}</span>
          </div>
          <div class="trackListHeaderRow has-cover">
            <div class="trackListIndexHeader">#</div>
            <div class="trackListCoverSpacer" aria-hidden="true"></div>
            <div class="trackListHeaderGrid">
              <span>Title</span>
              <span>Album</span>
              <span>Added date</span>
              <span>Time</span>
            </div>
          </div>
          <div class="trackList">
            <div :style="{ height: virtualRange.padTop + 'px' }" aria-hidden="true"></div>
            <Track
              v-for="(track, idx) in virtualTracks"
              :key="track.Id"
              :class="{ 'track--flash': flashedTrackId === track.Id }"
              :ref="(el) => setTrackRef(track.Id, el)"
              :track="track"
              :index="virtualRange.start + idx"
              :showIndex="true"
              :inlineIndex="false"
              :hideCover="false"
              :compact="false"
              variant="list"
              :showAlbum="true"
              :showAddedDate="true"
              :coverUrl="coverUrlFor(track, sessionStore)"
              :context="filteredTracks"
              :isCurrentlyPlaying="currentPlayingId === track.Id"
              :isPlaying="isCurrentlyPlaying && currentPlayingId === track.Id"
              :progress="currentPlayingId === track.Id ? (playbackStore.progress || 0) : 0"
              :canToggleFavorite="true"
              :isFavorite="track.UserData?.IsFavorite || false"
              :sessionStore="sessionStore"
              @play="handleTrackPlay"
              @hover="() => handleTrackHover(track)"
              @favorite-toggle="handleFavoriteToggle"
            />
            <div :style="{ height: virtualRange.padBottom + 'px' }" aria-hidden="true"></div>
          </div>

          <div v-if="!loading && filteredTracks.length === 0" class="empty">No songs found.</div>
          <div v-if="loading && allTracks.length > 0" class="loading-more">Loading more...</div>
        </div>
      </div>
      <div v-else class="empty-center">Your Songs library is empty.</div>
    </div>

    <NowPlayingLocator
      v-if="nowPlayingLocator"
      :titleText="nowPlayingLocator.title"
      :ariaLabel="nowPlayingLocator.ariaLabel"
      :subIconPath="nowPlayingLocator.subIconPath"
      :subText="nowPlayingLocator.subText"
      @click="handleNowPlayingLocatorClick"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { mdiShuffle, mdiChevronUp, mdiChevronDown, mdiMusicNote } from '@mdi/js'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import FilterBar from '../components/FilterBar.vue'
import NowPlayingLocator from '../components/NowPlayingLocator.vue'
import PillButton from '../components/PillButton.vue'
import Track from '../components/Track.vue'
import Spinner from '../components/Spinner.vue'
import { embyGetAllSongs } from '../services/emby.js'
import { coverUrlFor, isAudioItem } from '../services/mediaUtils.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { useSessionStore } from '../stores/session.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'

const router = useRouter()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()
sessionStore.hydrate()
settingsStore.hydrate()

// Large libraries can get very big; keep the array shallow to avoid deep reactivity overhead.
const allTracks = shallowRef([])
const loading = ref(false)
const error = ref('')
const currentCoverUrl = ref(null)

const selectedFilter = ref('All')
const searchTerm = ref('')
const displayLimit = ref(100)

const debouncedSearchTerm = ref('')
let searchDebounceTimer = null

watch(
  () => searchTerm.value,
  (val) => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      debouncedSearchTerm.value = String(val || '')
    }, 140)
  },
  { immediate: true }
)

const filterBarRef = ref(null)
const songsContentRef = ref(null)

const contentScrollTop = ref(0)
const contentClientHeight = ref(0)
const trackListOffsetTop = ref(0)
const flashedTrackId = ref(null)

const { playbackStore, handlePlayItem } = usePlaybackController()
const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)
const currentPlayingId = computed(() => playbackStore.currentTrackId)

const trackRefs = new Map()

const SONGS_STATE_KEY = 'octoPlayer.songsState.v1'
const hasSongsAll = computed(() => allTracks.value.length > 0)
let fetchRequestId = 0
let pendingRestore = null

const ROW_HEIGHT = 56
const OVERSCAN_ROWS = 10

function saveSongsState() {
  try {
    const payload = {
      selectedFilter: selectedFilter.value,
      searchTerm: searchTerm.value,
      displayLimit: displayLimit.value,
      filterScrollLeft: filterBarRef.value?.getScrollLeft?.() ?? 0,
      contentScrollTop: songsContentRef.value?.scrollTop ?? 0,
    }
    sessionStorage.setItem(SONGS_STATE_KEY, JSON.stringify(payload))
  } catch {}
}

function clearSongsState() {
  try {
    sessionStorage.removeItem(SONGS_STATE_KEY)
  } catch {}
}

function restoreSongsState() {
  try {
    const raw = sessionStorage.getItem(SONGS_STATE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed.selectedFilter === 'string') selectedFilter.value = parsed.selectedFilter
    if (typeof parsed.searchTerm === 'string') searchTerm.value = parsed.searchTerm
    if (typeof parsed.displayLimit === 'number' && Number.isFinite(parsed.displayLimit)) {
      displayLimit.value = Math.max(100, parsed.displayLimit)
    }
    pendingRestore = {
      filterScrollLeft: parsed.filterScrollLeft || 0,
      contentScrollTop: parsed.contentScrollTop || 0
    }
  } catch {}
}

function handleContentScroll(event) {
  const element = event.target

  contentScrollTop.value = element?.scrollTop || 0
  contentClientHeight.value = element?.clientHeight || 0
  if (!trackListOffsetTop.value) {
    updateTrackListOffsetTop()
  }
}
function handleFilterChanged() {
  displayLimit.value = 100
}

function handleShuffle() {
  const list = filteredTracks.value
  if (list.length === 0) return

  const shuffled = [...list].sort(() => Math.random() - 0.5)
  handlePlayItem(shuffled[0], false, shuffled, { type: 'songs' })
  playbackStore.setShuffleEnabled(true)

  currentCoverUrl.value = coverUrlFor(shuffled[0], sessionStore) || null
}

function handleTrackHover(track) {
  currentCoverUrl.value = coverUrlFor(track, sessionStore) || null
}

function setTrackRef(id, el) {
  if (!id) return
  if (el) {
    trackRefs.set(id, el)
  } else {
    trackRefs.delete(id)
  }
}

function flashTrack(id) {
  if (!id) return
  flashedTrackId.value = id
  setTimeout(() => {
    if (flashedTrackId.value === id) {
      flashedTrackId.value = null
    }
  }, 1200)
}

function updateTrackListOffsetTop() {
  // The list lives inside the scroll container; offsetTop gives us a stable anchor.
  const container = songsContentRef.value
  if (!container) return

  const listEl = container.querySelector?.('.trackList')
  if (!listEl) return

  // Convert DOM position into the scroll container's coordinate space.
  const containerRect = container.getBoundingClientRect?.()
  const listRect = listEl.getBoundingClientRect?.()
  if (!containerRect || !listRect) return

  const top = (listRect.top - containerRect.top) + (container.scrollTop || 0)
  if (Number.isFinite(top)) trackListOffsetTop.value = top
}

function updateViewportMetrics() {
  const container = songsContentRef.value
  if (!container) return
  contentScrollTop.value = container.scrollTop || 0
  contentClientHeight.value = container.clientHeight || 0
  updateTrackListOffsetTop()
}

const nowPlayingInfo = computed(() => {
  const id = currentPlayingId.value
  if (!id) return null

  return getTrackInfoForId(id)
})

function getTrackInfoForId(id) {
  if (!id) return null

  const list = filteredTracks.value
  for (let i = 0; i < list.length; i += 1) {
    if (list[i]?.Id === id) {
      return { id, index: i, total: list.length, inFilteredList: true }
    }
  }

  const all = allTracks.value
  for (let i = 0; i < all.length; i += 1) {
    if (all[i]?.Id === id) {
      return { id, index: i, total: all.length, inFilteredList: false }
    }
  }

  return null
}

const nowPlayingLocator = computed(() => {
  if (!hasSongsAll.value) return null
  const info = nowPlayingInfo.value
  if (!info) return null

  const scrollTop = contentScrollTop.value
  const viewportH = contentClientHeight.value
  const anchor = trackListOffsetTop.value
  const visibleStart = Math.max(0, Math.floor((scrollTop - anchor) / ROW_HEIGHT))
  const visibleEnd = Math.max(visibleStart, visibleStart + Math.ceil(viewportH / ROW_HEIGHT))

  let direction = 'in'
  let delta = 0

  if (info.inFilteredList) {
    if (info.index < visibleStart) {
      direction = 'above'
      delta = visibleStart - info.index
    } else if (info.index > visibleEnd) {
      direction = 'below'
      delta = info.index - visibleEnd
    }
  } else {
    direction = 'filtered'
  }

  const iconPath = direction === 'above'
    ? mdiChevronUp
    : direction === 'below'
      ? mdiChevronDown
      : mdiMusicNote

  const subText = direction === 'above'
    ? String(delta)
    : direction === 'below'
      ? String(delta)
      : direction === 'filtered'
        ? 'Filtered out'
        : 'On screen'

  const title = direction === 'filtered'
    ? 'Currently playing song is not in the current filter/search. Click to show it.'
    : 'Scroll to the currently playing song'

  const ariaLabel = direction === 'filtered'
    ? 'Show currently playing song'
    : 'Scroll to currently playing song'

  return { subIconPath: iconPath, subText, title, ariaLabel, direction }
})

function scrollToCurrentTrack() {
  const id = currentPlayingId.value
  if (!id) return
  scrollToTrackId(id)
}

async function scrollToTrackId(id) {
  if (!id) return

  const info = getTrackInfoForId(id)
  if (!info?.id) return
  if (!info.inFilteredList) return

  // With virtualization, the row might not be mounted yet. Scroll the container directly.
  const container = songsContentRef.value
  if (!container) return

  const viewportH = container.clientHeight || contentClientHeight.value || 0
  const anchor = trackListOffsetTop.value || 0
  const targetTop = Math.max(0, anchor + (info.index * ROW_HEIGHT) - (viewportH / 2) + (ROW_HEIGHT / 2))

  try {
    container.scrollTo({ top: targetTop, behavior: 'smooth' })
  } catch {
    container.scrollTop = targetTop
  }

  // Wait for the row to mount, then flash it.
  let attempts = 0
  const tryFlash = () => {
    if (trackRefs.has(id)) {
      flashTrack(id)
      return
    }
    if (attempts < 12) {
      attempts += 1
      setTimeout(tryFlash, 80)
    }
  }
  await nextTick()
  setTimeout(tryFlash, 80)
}

async function handleNowPlayingLocatorClick() {
  const info = nowPlayingInfo.value
  if (!info?.id) return

  // If the playing song is filtered out, reset filters so it becomes visible.
  if (!info.inFilteredList) {
    selectedFilter.value = 'All'
    searchTerm.value = ''
    displayLimit.value = 100
    await nextTick()
  }

  await scrollToTrackId(info.id)
}

function handleTrackPlay(e) {
  const track = e?.track
  if (!track) return

  const queueContext = Array.isArray(e?.context) ? e.context : e?.context?.value || filteredTracks.value

  if (currentPlayingId.value === track.Id && playbackStore.nowPlaying) {
    const audioEl = document.querySelector('audio')
    if (audioEl?.paused) {
      audioEl.play().catch(() => {})
    } else {
      audioEl.pause()
    }
  } else {
    handlePlayItem(track, false, queueContext, { type: 'songs' })
  }

  currentCoverUrl.value = coverUrlFor(track, sessionStore) || null
}

function handleFavoriteToggle(e) {
  const track = e?.track
  if (!track) return

  // With a shallowRef array, replace the item to trigger UI updates.
  const list = allTracks.value
  const idx = list.findIndex(t => t?.Id === track.Id)
  if (idx < 0) return

  const prev = list[idx]
  const prevUserData = prev?.UserData || {}
  const nextUserData = { ...prevUserData, IsFavorite: !prevUserData.IsFavorite }
  const next = { ...prev, UserData: nextUserData }

  const nextList = list.slice()
  nextList[idx] = next
  allTracks.value = nextList
}

async function fetchSongs() {
  const requestId = ++fetchRequestId
  loading.value = true
  error.value = ''
  try {
    const { serverUrl, token: authToken, userId } = (await ensureUserId(sessionStore)) || {}
    if (!serverUrl || !authToken || !userId) throw new Error('Not authenticated')

    const pageSize = 500
    let startIndex = 0
    let total = null

    // Batch commits to avoid re-running filters on every page append.
    let pending = []
    let pagesSinceCommit = 0

    while (true) {
      if (requestId !== fetchRequestId) return

      const res = await embyGetAllSongs({ serverUrl, token: authToken, userId, limit: pageSize, startIndex })
      const items = (res?.Items || []).filter(isAudioItem)

      if (startIndex === 0) {
        allTracks.value = items
        loading.value = false

        if (!currentCoverUrl.value && items.length) {
          currentCoverUrl.value = coverUrlFor(items[0], sessionStore) || null
        }
      } else {
        pending.push(...items)
        pagesSinceCommit += 1

        // Commit every ~2 pages (or at end) to keep UI responsive.
        if (pagesSinceCommit >= 2) {
          allTracks.value = allTracks.value.concat(pending)
          pending = []
          pagesSinceCommit = 0
          await new Promise((r) => setTimeout(r, 0))
        }
      }

      if (total === null) {
        const t = res?.TotalRecordCount
        total = typeof t === 'number' && Number.isFinite(t) ? t : null
      }

      startIndex += items.length

      if (items.length === 0) break
      if (total !== null && startIndex >= total) break
      if (items.length < pageSize) break
    }

    // Final flush.
    if (pending.length) {
      allTracks.value = allTracks.value.concat(pending)
    }
  } catch (err) {
    error.value = `Failed to load songs: ${err?.message || String(err)}`
  } finally {
    if (requestId === fetchRequestId) {
      loading.value = false
    }
  }
}

const filterLetters = computed(() => {
  const lettersSet = new Set()
  let hasHash = false

  allTracks.value.forEach((track) => {
    const firstChar = track?.Name?.charAt(0)?.toUpperCase() || ''
    if (/[A-Z]/.test(firstChar)) {
      lettersSet.add(firstChar)
    } else {
      hasHash = true
    }
  })

  const orderedBase = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z']
  const letters = orderedBase.filter((l) => lettersSet.has(l))
  if (hasHash) letters.push('#')
  return ['All', ...letters]
})

watch(filterLetters, (letters) => {
  if (!letters.includes(selectedFilter.value)) {
    selectedFilter.value = 'All'
  }
})

const filteredTracks = computed(() => {
  const q = debouncedSearchTerm.value.trim().toLowerCase()

  const letterFiltered = selectedFilter.value === 'All'
    ? allTracks.value
    : allTracks.value.filter((t) => {
        const firstChar = t?.Name?.charAt(0)?.toUpperCase() || ''
        if (selectedFilter.value === '#') return !/[A-Z]/.test(firstChar)
        return firstChar === selectedFilter.value
      })

  if (!q) return letterFiltered

  return letterFiltered.filter((t) => {
    const name = String(t?.Name || '').toLowerCase()
    const artist = String(t?.ArtistItems?.[0]?.Name || t?.Artists?.[0] || t?.AlbumArtist || '').toLowerCase()
    const album = String(t?.Album || '').toLowerCase()
    return name.includes(q) || artist.includes(q) || album.includes(q)
  })
})

const listScrollTop = computed(() => Math.max(0, (contentScrollTop.value || 0) - (trackListOffsetTop.value || 0)))

const virtualRange = computed(() => {
  const total = filteredTracks.value.length
  const viewportH = contentClientHeight.value || 0

  if (!total || !viewportH) {
    return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  }

  const start = Math.max(0, Math.floor(listScrollTop.value / ROW_HEIGHT) - OVERSCAN_ROWS)
  const visibleCount = Math.ceil(viewportH / ROW_HEIGHT) + (OVERSCAN_ROWS * 2)
  const end = Math.min(total, start + visibleCount)

  const padTop = start * ROW_HEIGHT
  const padBottom = Math.max(0, (total - end) * ROW_HEIGHT)

  return { start, end, padTop, padBottom }
})

const virtualTracks = computed(() => {
  const { start, end } = virtualRange.value
  return filteredTracks.value.slice(start, end)
})

onBeforeRouteLeave((to) => {
  fetchRequestId++
  if (to?.path === '/') {
    clearSongsState()
  } else {
    saveSongsState()
  }
})

onMounted(async () => {
  restoreSongsState()
  await fetchSongs()

  await nextTick()
  updateViewportMetrics()
  window.addEventListener('resize', updateViewportMetrics)

  // Check if auto-scroll is enabled
  if (settingsStore.autoScrollToPlayingTrack === false) {
    if (pendingRestore) {
      await nextTick()
      if (filterBarRef.value?.setScrollLeft) {
        filterBarRef.value.setScrollLeft(pendingRestore.filterScrollLeft || 0)
      }
      if (songsContentRef.value) {
        songsContentRef.value.scrollTop = pendingRestore.contentScrollTop || 0
      }
      pendingRestore = null
    }
    return
  }

  // Check if we should scroll to a specific track
  let scrollTarget = router.currentRoute.value.query.scrollTo
  
  // If no explicit target, check if current playing track is in the list
  if (!scrollTarget && currentPlayingId.value) {
    const isInCurrentList = allTracks.value.some(t => t.Id === currentPlayingId.value)
    if (isInCurrentList) {
      scrollTarget = currentPlayingId.value
    }
  }
  
  if (scrollTarget && allTracks.value.length > 0) {
    // Ensure the target is visible even if state restore applied a filter/search.
    const info = getTrackInfoForId(scrollTarget)
    if (info && !info.inFilteredList) {
      selectedFilter.value = 'All'
      searchTerm.value = ''
      displayLimit.value = 100
      await nextTick()
    }

    await nextTick()
    await scrollToTrackId(scrollTarget)
  } else if (pendingRestore) {
    await nextTick()

    if (filterBarRef.value?.setScrollLeft) {
      filterBarRef.value.setScrollLeft(pendingRestore.filterScrollLeft || 0)
    }

    if (songsContentRef.value) {
      songsContentRef.value.scrollTop = pendingRestore.contentScrollTop || 0
    }

    pendingRestore = null
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewportMetrics)
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
  }
})

watch(
  () => currentPlayingId.value,
  async () => {
    if (settingsStore.autoScrollToPlayingTrack === false) return
    await nextTick()
    scrollToCurrentTrack()
  }
)
</script>

<style scoped>
.songs-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: transparent;
  z-index: 1;
}

.songs-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  position: relative;
}

.controls-row {
  position: fixed;
  top: 66px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
  padding: 0 56px;
  left: 0;
  right: 0;
}

.shuffle-button .icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  transform: translateY(2px);
}

.shuffle-button .icon svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.shuffle-button {
  width: 52px !important;
  padding: 0 !important;
  justify-content: center;
}

@media (max-width: 720px) {
  .controls-row {
    top: 48px;
    padding: 0 16px;
    gap: 10px;
  }

  .songs-content {
    padding-left: 16px;
    padding-right: 16px;
    max-width: calc(100% - 32px);
  }
}

.songs-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-left: 56px;
  padding-right: 56px;
  padding-top: 146px;
  padding-bottom: 160px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
}

.songs-content::-webkit-scrollbar { display: none; }
.songs-content { scrollbar-width: none; -ms-overflow-style: none; }

.tracksCard {
  --track-list-cols: 1fr 24ch 12ch 6ch;
  --track-list-gap: 10px;
  --track-list-pr: 28px;
  --track-list-pl: 12px;
  --track-cover-cell: 44px;
  --track-cover-pad: 4px;
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  height: fit-content;
}
.tracksHeader {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2px;
  opacity: 0.9;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.tracksCount {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: rgba(255, 255, 255, 0.7);
  opacity: 1;
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

.trackList { display: flex; flex-direction: column; gap: 0; }

.empty {
  padding: 14px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
}

.empty-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  text-align: center;
  padding: 1rem;
  transform: translateY(-60px);
}

.loading-more {
  color: rgba(255, 255, 255, 0.4);
  padding: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

.page-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error {
  color: #ff8fa3;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  margin: 1rem 56px;
  max-width: 1096px;
}

.track--flash {
  animation: trackFlash 1.2s ease;
}

@keyframes trackFlash {
  0% { box-shadow: 0 0 0 0 rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.0); }
  20% { box-shadow: 0 0 0 2px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.75); }
  100% { box-shadow: 0 0 0 0 rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.0); }
}
</style>
