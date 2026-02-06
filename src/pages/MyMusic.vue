<template>
  <div class="albums-page">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading && albums.length === 0" class="page-loading">
      <Spinner :size="52" />
    </div>

    <div v-else class="albums-layout">
      <div class="controls-row" v-if="hasAlbums">
        <FilterBar
          ref="filterBarRef"
          v-model="selectedFilter"
          :options="filterLetters"
          v-model:search="searchTerm"
          searchPlaceholder="Search artists or albums"
          searchAriaLabel="Search artists or albums"
          @change="handleFilterChanged"
        />
      </div>

      <div v-if="hasAlbums" ref="albumsContentRef" class="albums-content" @scroll="handleContentScroll">
        <ArtistAlbumSection
          v-for="artist in displayedAlbums"
          :key="artist.name"
          :artist="artist"
          :sessionStore="sessionStore"
          @album-hover="handleAlbumHover"
          @album-open="handleAlbumOpen"
          @album-play="handleAlbumQuickPlay"
          @album-favorite-toggle="handleAlbumFavoriteToggle"
        />
        <div v-if="hasMore" class="loading-more">Loading more...</div>
      </div>
      <div v-else class="empty-center">Your My Music library is empty.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { embyFetchJson, embyGetAllAlbums } from '../services/emby.js'
import { useSessionStore } from '../stores/session.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor, isAudioItem } from '../services/mediaUtils.js'
import { toggleAlbumFavorite } from '../services/toggleAlbumFavorite.js'
import { useAlbumQuickPlay } from '../composables/useAlbumQuickPlay.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'
import { usePlaybackStore } from '../stores/playback.js'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import FilterBar from '../components/FilterBar.vue'
import Spinner from '../components/Spinner.vue'
import ArtistAlbumSection from '../components/ArtistAlbumSection.vue'

const albums = ref([])
const loading = ref(false)
const error = ref('')
const currentCoverUrl = ref(null)
const sessionStore = useSessionStore()
const playbackStore = usePlaybackStore()
const displayLimit = ref(30)
const searchTerm = ref('')
sessionStore.hydrate()
const router = useRouter()
const selectedFilter = ref('All')
const filterBarRef = ref(null)
const albumsContentRef = ref(null)
const { handlePlayItem } = usePlaybackController()

let lastAlbumQuickPlay = { id: null, ts: 0 }

const MY_MUSIC_STATE_KEY = 'octoPlayer.myMusicState.v1'
let pendingRestore

function saveMyMusicState() {
  try {
    const payload = {
      selectedFilter: selectedFilter.value,
      searchTerm: searchTerm.value,
      displayLimit: displayLimit.value,
      filterScrollLeft: filterBarRef.value?.getScrollLeft?.() ?? 0,
      contentScrollTop: albumsContentRef.value?.scrollTop ?? 0,
    }
    sessionStorage.setItem(MY_MUSIC_STATE_KEY, JSON.stringify(payload))
  } catch {}
}

function clearMyMusicState() {
  try {
    sessionStorage.removeItem(MY_MUSIC_STATE_KEY)
  } catch {}
}

function restoreMyMusicState() {
  try {
    const raw = sessionStorage.getItem(MY_MUSIC_STATE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed.selectedFilter === 'string') selectedFilter.value = parsed.selectedFilter
    if (typeof parsed.searchTerm === 'string') searchTerm.value = parsed.searchTerm
    if (typeof parsed.displayLimit === 'number' && Number.isFinite(parsed.displayLimit)) {
      displayLimit.value = Math.max(30, parsed.displayLimit)
    }
    pendingRestore = {
      filterScrollLeft: parsed.filterScrollLeft || 0,
      contentScrollTop: parsed.contentScrollTop || 0
    }
  } catch {}
}

const hasAlbums = computed(() => albums.value.length > 0)

const groupedAlbums = computed(() => {
  const artistMap = new Map()

  albums.value.forEach((album) => {
    const artistName = album.AlbumArtist || album.ArtistItems?.[0]?.Name || album.Artists?.[0] || 'Unknown Artist'
    const artistId = album.ArtistItems?.[0]?.Id || album.AlbumArtistId || album.AlbumArtistIds?.[0] || null
    if (!artistMap.has(artistName)) {
      artistMap.set(artistName, { name: artistName, id: artistId, albums: [] })
    }
    const entry = artistMap.get(artistName)
    if (!entry.id && artistId) entry.id = artistId
    entry.albums.push(album)
  })

  return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name))
})

const filterLetters = computed(() => {
  const lettersSet = new Set()
  let hasHash = false

  groupedAlbums.value.forEach((artist) => {
    const firstChar = artist.name?.charAt(0)?.toUpperCase() || ''
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

const filteredAlbums = computed(() => {
  if (selectedFilter.value === 'All') return groupedAlbums.value
  return groupedAlbums.value.filter((artist) => {
    const firstChar = artist.name.charAt(0).toUpperCase()
    if (selectedFilter.value === '#') return !/[A-Z]/.test(firstChar)
    return firstChar === selectedFilter.value
  })
})

const searchedAlbums = computed(() => {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return filteredAlbums.value

  return filteredAlbums.value
    .map((artist) => {
      const artistMatch = artist.name?.toLowerCase().includes(q)
      const albumMatches = artist.albums.filter((album) => album?.Name?.toLowerCase().includes(q))
      if (artistMatch || albumMatches.length) {
        return { name: artist.name, albums: artistMatch ? artist.albums : albumMatches }
      }
      return null
    })
    .filter(Boolean)
})

const displayedAlbums = computed(() => searchedAlbums.value.slice(0, displayLimit.value))
const hasMore = computed(() => displayLimit.value < searchedAlbums.value.length)

function handleContentScroll(event) {
  const element = event.target
  if (element.scrollTop + element.clientHeight >= element.scrollHeight * 0.8 && hasMore.value) {
    displayLimit.value += 20
  }
}

function handleFilterChanged() {
  displayLimit.value = 30
}

function handleAlbumHover(e) {
  const album = e?.album || e
  const url = e?.coverUrl || (album ? coverUrlFor(album, sessionStore) : null)
  if (url) currentCoverUrl.value = url
}

const { quickPlayAlbum } = useAlbumQuickPlay({
  sessionStore,
  ensureUserId: () => ensureUserId(sessionStore),
  handlePlayItem,
  currentCoverUrl,
  embyFetchJson,
  isAudioItem,
  coverUrlFor,
  playbackStore,
})

async function handleAlbumQuickPlay(e) {
  lastAlbumQuickPlay = await quickPlayAlbum(e, lastAlbumQuickPlay)
}

async function fetchAlbums() {
  loading.value = true
  error.value = ''
  try {
    const { serverUrl, token, userId } = sessionStore
    const result = await embyGetAllAlbums({ serverUrl, token, userId, limit: 500 })
    albums.value = result?.Items || []
    if (!currentCoverUrl.value && result?.Items?.length) {
      currentCoverUrl.value = coverUrlFor(result.Items[0], sessionStore)
    }
  } catch (err) {
    error.value = `Failed to load albums: ${err.message}`
  } finally {
    loading.value = false
  }
}

function handleAlbumOpen(e) {
  const album = e?.album || e
  if (album?.Id) {
    saveMyMusicState()
    router.push(`/album/${album.Id}`)
  }
}

function handleAlbumFavoriteToggle(e) {
  toggleAlbumFavorite(e)
}

onBeforeRouteLeave((to) => {
  if (to?.path === '/') {
    clearMyMusicState()
  } else {
    saveMyMusicState()
  }
})

onMounted(async () => {
  restoreMyMusicState()
  await fetchAlbums()

  if (pendingRestore) {
    await nextTick()

    if (filterBarRef.value?.setScrollLeft) {
      filterBarRef.value.setScrollLeft(pendingRestore.filterScrollLeft || 0)
    }

    if (albumsContentRef.value) {
      albumsContentRef.value.scrollTop = pendingRestore.contentScrollTop || 0
    }

    pendingRestore = null
  }
})
</script>

<style scoped>
.albums-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: transparent;
  z-index: 1;
}

.albums-layout {
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


@media (max-width: 720px) {
  .controls-row {
    top: 48px;
    padding: 0 16px;
    gap: 10px;
  }

  .albums-content {
    padding-left: 16px;
    padding-right: 16px;
    max-width: calc(100% - 32px);
  }
}

.loading-more {
  color: rgba(255, 255, 255, 0.4);
  padding: 1rem;
  text-align: center;
  font-size: 0.9rem;
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

.albums-content {
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

.albums-content::-webkit-scrollbar { display: none; }
.albums-content { scrollbar-width: none; -ms-overflow-style: none; }
</style>
