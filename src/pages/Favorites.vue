<template>
  <div class="favorites-page" ref="contentRef" @scroll="handleContentScroll">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading && allTracks.length === 0 && albums.length === 0 && artists.length === 0" class="page-loading">
      <Spinner :size="52" />
    </div>

    <div v-else class="favorites-layout">
      <div class="controls-row">
        <FilterBar
          ref="filterBarRef"
          v-model="selectedFilter"
          :options="filterLetters"
          v-model:search="searchTerm"
          searchPlaceholder="Search favorites"
          searchAriaLabel="Search favorites"
          @change="handleFilterChanged"
        />
      </div>

      <div class="favorites-content">
        <!-- Favorite Artists Section -->
        <div v-if="displayedArtists.length > 0" class="section">
          <div class="sectionHeader">
            <span>Favorite Artists</span>
            <span class="sectionCount">{{ filteredArtists.length }}</span>
          </div>
          <div class="artistsGrid">
            <Artist
              v-for="artist in displayedArtists"
              :key="artist.Id"
              :artist="artist"
              :coverUrl="coverUrlFor(artist, sessionStore)"
              @open="handleArtistOpen"
              @hover="handleArtistHover"
              @mouseleave="handleArtistLeave"
            />
          </div>
        </div>

        <!-- Favorite Albums Section -->
        <div v-if="displayedAlbums.length > 0" class="section">
          <div class="sectionHeader">
            <span>Favorite Albums</span>
            <span class="sectionCount">{{ filteredAlbums.length }}</span>
          </div>
          <Grid variant="albums" gap="20px">
            <Album
              v-for="album in displayedAlbums"
              :key="album.Id"
              :album="album"
              :coverUrl="coverUrlFor(album, sessionStore)"
              appearance="flat"
              :showDetails="true"
              :tilePlays="true"
              :titleOpens="true"
              :canToggleFavorite="true"
              :isFavorite="album.UserData?.IsFavorite || false"
              :sessionStore="sessionStore"
              @hover="handleAlbumHover"
              @open="handleAlbumOpen"
              @play="handleAlbumQuickPlay"
              @favorite-toggle="handleAlbumFavoriteToggle"
            />
          </Grid>
        </div>

        <!-- Favorite Tracks Section -->
        <div v-if="displayedTracks.length > 0" class="section">
          <div class="tracksCard">
            <div class="tracksHeader">
              <span>Favorite Tracks</span>
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
              <Track
                v-for="(track, idx) in displayedTracks"
                :key="track.Id"
                :ref="(el) => setTrackRef(track.Id, el)"
                :track="track"
                :index="idx"
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
                :isFavorite="true"
                :sessionStore="sessionStore"
                @play="handleTrackPlay"
                @hover="() => handleTrackHover(track)"
                @favorite-toggle="handleFavoriteToggle"
              />
            </div>
          </div>
        </div>

        <div v-if="!loading && allTracks.length === 0 && albums.length === 0 && artists.length === 0" class="empty-center">No favorites yet.</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import FilterBar from '../components/FilterBar.vue'
import Track from '../components/Track.vue'
import Spinner from '../components/Spinner.vue'
import Artist from '../components/Artist.vue'
import Album from '../components/Album.vue'
import Grid from '../components/Grid.vue'
import { embyFetchJson } from '../services/emby.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor, isAudioItem } from '../services/mediaUtils.js'
import { useAlbumQuickPlay } from '../composables/useAlbumQuickPlay.js'
import { useSessionStore } from '../stores/session.js'
import { useSettingsStore } from '../stores/settings.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'

const router = useRouter()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()
sessionStore.hydrate()
settingsStore.hydrate()

const allTracks = ref([])
const albums = ref([])
const artists = ref([])
const loading = ref(false)
const error = ref('')
const currentCoverUrl = ref(null)
const displayLimit = ref(50)
const searchTerm = ref('')
const selectedFilter = ref('All')
const contentRef = ref(null)

const {playbackStore, handlePlayItem } = usePlaybackController()
const currentPlayingId = computed(() => playbackStore.currentTrackId)
const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)

const trackRefs = new Map()

const FAVORITES_STATE_KEY = 'octoPlayer.favoritesState.v1'
let pendingRestore

function setTrackRef(id, el) {
  if (!id) return
  if (el) {
    trackRefs.set(id, el)
  } else {
    trackRefs.delete(id)
  }
}

function saveFavoritesState() {
  try {
    const payload = {
      selectedFilter: selectedFilter.value,
      searchTerm: searchTerm.value,
      displayLimit: displayLimit.value,
      contentScrollTop: contentRef.value?.scrollTop ?? 0,
    }
    sessionStorage.setItem(FAVORITES_STATE_KEY, JSON.stringify(payload))
  } catch {}
}

function clearFavoritesState() {
  try {
    sessionStorage.removeItem(FAVORITES_STATE_KEY)
  } catch {}
}

function restoreFavoritesState() {
  try {
    const raw = sessionStorage.getItem(FAVORITES_STATE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed.selectedFilter === 'string') selectedFilter.value = parsed.selectedFilter
    if (typeof parsed.searchTerm === 'string') searchTerm.value = parsed.searchTerm
    if (typeof parsed.displayLimit === 'number' && Number.isFinite(parsed.displayLimit)) {
      displayLimit.value = Math.max(50, parsed.displayLimit)
    }
    pendingRestore = {
      contentScrollTop: parsed.contentScrollTop || 0
    }
  } catch {}
}

const filterLetters = computed(() => {
  const lettersSet = new Set()
  let hasHash = false

  const allItems = [
    ...allTracks.value,
    ...albums.value,
    ...artists.value
  ]

  allItems.forEach((item) => {
    const title = item.Name || ''
    const firstChar = title.charAt(0).toUpperCase() || ''
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

// Filter by letter
function filterByLetter(items, key = 'Name') {
  if (selectedFilter.value === 'All') return items

  return items.filter((item) => {
    const firstChar = (item[key] || '').charAt(0).toUpperCase()
    if (selectedFilter.value === '#') return !/[A-Z]/.test(firstChar)
    return firstChar === selectedFilter.value
  })
}

// Search filter
function filterBySearch(items, key = 'Name') {
  const q = searchTerm.value.trim().toLowerCase()
  if (!q) return items

  return items.filter((item) => {
    const title = item[key]?.toLowerCase() || ''
    const album = item.Album?.toLowerCase() || ''
    const artist = item.Artists?.[0]?.toLowerCase() || ''
    return title.includes(q) || album.includes(q) || artist.includes(q)
  })
}

const filteredTracks = computed(() => {
  let result = filterByLetter(allTracks.value, 'Name')
  return filterBySearch(result, 'Name')
})

const filteredAlbums = computed(() => {
  const filtered = filterByLetter(albums.value, 'Name')
  return filterBySearch(filtered, 'Name')
})

const filteredArtists = computed(() => {
  const filtered = filterByLetter(artists.value, 'Name')
  return filterBySearch(filtered, 'Name')
})

const displayedTracks = computed(() => filteredTracks.value.slice(0, displayLimit.value))
const displayedAlbums = computed(() => filteredAlbums.value.slice(0, displayLimit.value))
const displayedArtists = computed(() => filteredArtists.value.slice(0, displayLimit.value))

const hasMore = computed(() => 
  displayLimit.value < Math.max(filteredTracks.value.length, filteredAlbums.value.length, filteredArtists.value.length)
)

function handleContentScroll(event) {
  const element = event.target
  if (element.scrollTop + element.clientHeight >= element.scrollHeight * 0.8 && hasMore.value) {
    displayLimit.value += 30
  }
}

function handleFilterChanged() {
  displayLimit.value = 50
}

function handleTrackHover(track) {
  const url = track ? coverUrlFor(track, sessionStore) : null
  if (url) currentCoverUrl.value = url
}

function handleAlbumHover(e) {
  const album = e?.album || e
  const url = e?.coverUrl || (album ? coverUrlFor(album, sessionStore) : null)
  if (url) currentCoverUrl.value = url
}

function handleArtistHover(e) {
  const url = e?.coverUrl
  if (url) currentCoverUrl.value = url
}

function handleArtistLeave() {
  // Keep the current cover
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
    handlePlayItem(track, false, queueContext, { type: 'favorites' })
  }

  currentCoverUrl.value = coverUrlFor(track, sessionStore) || null
}

function handleFavoriteToggle(e) {
  const track = e?.track
  if (!track) return

  removeTrackFromFavorites(track.Id)
}

function handleAlbumFavoriteToggle(e) {
  const album = e?.album
  if (!album) return

  removeAlbumFromFavorites(album.Id)
}

function removeTrackFromFavorites(trackId) {
  if (!trackId) return
  allTracks.value = allTracks.value.filter(t => t.Id !== trackId)
}

function removeAlbumFromFavorites(albumId) {
  if (!albumId) return
  albums.value = albums.value.filter(a => a.Id !== albumId)
}

async function handleAlbumOpen(e) {
  const album = e?.album || e
  if (album?.Id) {
    saveFavoritesState()
    router.push(`/album/${album.Id}`)
  }
}

function handleArtistOpen(e) {
  const artist = e?.artist
  console.log('Artist clicked:', artist?.Name)
}

let albumQuickPlayState = { id: null, ts: 0 }

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
  albumQuickPlayState = await quickPlayAlbum(e, albumQuickPlayState)
}

async function fetchFavorites() {
  loading.value = true
  error.value = ''
  try {
    const { serverUrl, token, userId } = (await ensureUserId(sessionStore)) || {}
    if (!serverUrl || !token || !userId) {
      error.value = 'Failed to authenticate'
      return
    }

    // Fetch favorite tracks
    const tracksResult = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?IncludeItemTypes=Audio` +
        `&Filters=IsFavorite` +
        `&SortBy=SortName` +
        `&Recursive=true` +
        `&Limit=500` +
        `&Fields=${encodeURIComponent('PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData,DateCreated')}`
    })
    allTracks.value = (tracksResult?.Items || []).filter(isAudioItem)

    // Fetch favorite albums
    const albumsResult = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?IncludeItemTypes=MusicAlbum` +
        `&Filters=IsFavorite` +
        `&SortBy=SortName` +
        `&Recursive=true` +
        `&Limit=500` +
        `&Fields=${encodeURIComponent('PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,UserData,ChildCount,RecursiveItemCount')}`
    })
    albums.value = albumsResult?.Items || []

    // Fetch favorite artists
    const artistsResult = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?IncludeItemTypes=MusicArtist` +
        `&Filters=IsFavorite` +
        `&SortBy=SortName` +
        `&Recursive=true` +
        `&Limit=500` +
        `&Fields=${encodeURIComponent('PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,UserData')}` +
        `&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1`
    })
    artists.value = artistsResult?.Items || []

    // Set initial cover URL
    if (!currentCoverUrl.value) {
      if (allTracks.value.length) {
        currentCoverUrl.value = coverUrlFor(allTracks.value[0], sessionStore)
      } else if (albums.value.length) {
        currentCoverUrl.value = coverUrlFor(albums.value[0], sessionStore)
      } else if (artists.value.length) {
        currentCoverUrl.value = coverUrlFor(artists.value[0], sessionStore)
      }
    }
  } catch (err) {
    error.value = `Failed to load favorites: ${err.message}`
  } finally {
    loading.value = false
  }
}

onBeforeRouteLeave((to) => {
  if (to?.path === '/') {
    clearFavoritesState()
  } else {
    saveFavoritesState()
  }
})

onMounted(async () => {
  restoreFavoritesState()
  await fetchFavorites()

  // Check if auto-scroll is enabled
  if (settingsStore.autoScrollToPlayingTrack === false) {
    if (pendingRestore) {
      await nextTick()
      if (contentRef.value) {
        contentRef.value.scrollTop = pendingRestore.contentScrollTop || 0
      }
      pendingRestore = null
    }
    return
  }

  // Check if we should scroll to a specific track
  let scrollTarget = router.currentRoute.value.query.scrollTo
  
  // If no explicit target, check if current playing track is in favorites
  if (!scrollTarget && currentPlayingId.value) {
    const isInCurrentList = allTracks.value.some(t => t.Id === currentPlayingId.value)
    if (isInCurrentList) {
      scrollTarget = currentPlayingId.value
    }
  }
  
  if (scrollTarget && trackRefs.has(scrollTarget)) {
    await nextTick()
    setTimeout(() => {
      const el = trackRefs.get(scrollTarget)
      const dom = el?.$el || el
      if (dom?.scrollIntoView) {
        dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 100)
  } else if (scrollTarget && !trackRefs.has(scrollTarget) && allTracks.value.length > 0) {
    // Track might not be rendered yet, retry
    let attempts = 0
    const tryScroll = () => {
      if (trackRefs.has(scrollTarget)) {
        const el = trackRefs.get(scrollTarget)
        const dom = el?.$el || el
        if (dom?.scrollIntoView) {
          dom.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      } else if (attempts < 10) {
        attempts++
        setTimeout(tryScroll, 150)
      }
    }
    await nextTick()
    setTimeout(tryScroll, 150)
  } else if (pendingRestore) {
    await nextTick()

    if (contentRef.value) {
      contentRef.value.scrollTop = pendingRestore.contentScrollTop || 0
    }

    pendingRestore = null
  }
})
</script>

<style scoped>
.favorites-page {
  position: absolute;
  inset: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1;
  overflow-y: auto;
}

.favorites-layout {
  display: flex;
  flex-direction: column;
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

  .tracks-content {
    padding-left: 16px;
    padding-right: 16px;
    max-width: calc(100% - 32px);
  }

  .favorites-content {
    padding-left: 16px;
    padding-right: 16px;
    max-width: calc(100% - 32px);
  }
}

.empty {
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

.favorites-content {
  padding-left: 56px;
  padding-right: 56px;
  padding-top: 146px;
  padding-bottom: 160px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
}

.section {
  margin-bottom: 40px;
}

.sectionHeader {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2px;
  opacity: 0.9;
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}

.sectionCount {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: rgba(255, 255, 255, 0.7);
  opacity: 1;
}

.artistsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

@media (max-width: 720px) {
  .artistsGrid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 15px;
  }
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

.loading-more {
  color: rgba(255, 255, 255, 0.4);
  padding: 1rem;
  text-align: center;
  font-size: 0.9rem;
}

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

.trackListIndexHeader {
  text-align: center;
  width: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trackListCoverSpacer {
  width: var(--track-cover-cell, 56px);
  flex-shrink: 0;
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
</style>
