<template>
  <div class="artistPage">
    <BackgroundGradient :coverUrl="gradientCoverUrl" />
    <div class="artistLayout">
      <div class="artistHero" :style="heroStyle">
        <div class="heroShade" aria-hidden="true"></div>
        <div class="heroContent">
          <div class="heroKicker">Artist</div>
          <h1 class="heroTitle">{{ artist?.Name || 'Unknown Artist' }}</h1>
          <div class="heroActions actionButtons">
            <button
              class="actionButton playButton"
              type="button"
              @click="handlePlayTopSongs"
              aria-label="Play top songs"
              title="Play top songs"
              :disabled="!topSongs.length"
            >
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiPlay" /></svg></span>
            </button>
            <button
              class="actionButton shuffleButton"
              type="button"
              @click="handleShuffleTopSongs"
              aria-label="Shuffle top songs"
              title="Shuffle top songs"
              :disabled="!topSongs.length"
            >
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiShuffle" /></svg></span>
            </button>
            <button
              class="actionButton favoriteButton"
              type="button"
              @click="handleFavoriteToggle"
              @mouseenter="isHoveringFavorite = true"
              @mouseleave="isHoveringFavorite = false"
              :class="{ 'is-favorite': artist?.UserData?.IsFavorite }"
              :title="artist?.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :aria-label="artist?.UserData?.IsFavorite ? 'Remove from favorites' : 'Add to favorites'"
              :disabled="!artist || togglingFavorite"
            >
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="isHoveringFavorite ? (artist?.UserData?.IsFavorite ? mdiHeartMinus : mdiHeartPlus) : (artist?.UserData?.IsFavorite ? mdiHeart : mdiHeartOutline)" fill="currentColor" /></svg></span>
            </button>
            <button
              v-if="artist?.Overview"
              class="actionButton aboutButton"
              type="button"
              @click="showAboutModal = true"
              aria-label="About artist"
              title="About artist"
            >
              <span class="icon"><svg viewBox="0 0 24 24"><path :d="mdiInformation" /></svg></span>
            </button>
          </div>
        </div>
      </div>

      <!-- Top Songs Section -->
      <MediaRail
        v-if="topSongs.length"
        title="Top Songs"
        :items="topSongs"
        :loading="loading"
        emptyMessage="No top songs found."
        :gridLayout="true"
        :roundCover="true"
        :showTrackFavorites="false"
        trackSubtitleMode="album"
        :coverUrlFor="(item) => coverUrlFor(item, sessionStore)"
        :isAudioItem="isAudioItem"
        :currentPlayingId="currentPlayingId"
        :isPlaying="isCurrentlyPlaying"
        :progress="currentProgress"
        :sessionStore="sessionStore"
        @trackplay="handleTrackPlay"
        @trackfavoritetoggle="handleTrackFavoriteToggle"
      />

      <!-- Albums Section -->
      <MediaRail
        v-if="albums.length"
        title="Latest Music"
        :items="albums"
        :loading="loading"
        emptyMessage="No albums found."
        :gridLayout="true"
        :roundCover="true"
        :coverUrlFor="(item) => coverUrlFor(item, sessionStore)"
        :isAudioItem="isAudioItem"
        :sessionStore="sessionStore"
        @albumplay="handleAlbumPlay"
        @albumquickplay="handleAlbumQuickPlay"
        @albumfavoritetoggle="handleAlbumFavoriteToggle"
      />

      <!-- Loading/Error States -->
      <div v-if="loading" class="loadingMessage">
        <Spinner />
      </div>
      <div v-if="error" class="errorMessage">{{ error }}</div>

      <!-- About Modal -->
      <div v-if="showAboutModal" class="aboutModalOverlay" @click="showAboutModal = false">
        <div class="aboutModalContent" @click.stop>
          <h2>{{ artist?.Name }}</h2>
          <div class="aboutModalText">
            <p>{{ artist?.Overview }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import MediaRail from '../components/MediaRail.vue'
import Spinner from '../components/Spinner.vue'
import { mdiPlay, mdiShuffle, mdiInformation, mdiHeart, mdiHeartOutline, mdiHeartPlus, mdiHeartMinus } from '@mdi/js'
import { embyFetchJson, embyMarkFavorite, embyUnmarkFavorite } from '../services/api.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor, isAudioItem, TRACK_FIELDS } from '../services/mediaUtils.js'
import { resolveEmbyImageSrc } from '../utils/embyImageUtils.js'
import { useSessionStore } from '../stores/session.js'
import { typedCacheKey } from '../composables/useSessionCache.js'
import { typedSongsCacheKey } from '../composables/useLazySongs.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'
import { usePlaybackStore } from '../stores/playback.js'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const playbackStore = usePlaybackStore()
const { handlePlayItem } = usePlaybackController()

sessionStore.hydrate()

const artist = ref(null)
const topSongs = ref([])
const albums = ref([])
const loading = ref(false)
const error = ref('')
const gradientCoverUrl = ref(null)
const showAboutModal = ref(false)
const togglingFavorite = ref(false)
const isHoveringFavorite = ref(false)

const currentPlayingId = computed(() => playbackStore.currentTrackId)
const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)
const currentProgress = computed(() => playbackStore.progress || 0)

const heroStyle = computed(() => {
  if (!gradientCoverUrl.value) return {}
  const resolvedUrl = typeof gradientCoverUrl.value === 'string' 
    ? gradientCoverUrl.value 
    : resolveEmbyImageSrc(gradientCoverUrl.value)
  return {
    backgroundImage: `url('${resolvedUrl}')`
  }
})

async function fetchArtist() {
  const id = route.params.id
  if (!id) {
    error.value = 'No artist id provided'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const session = await ensureUserId(sessionStore)
    const { serverUrl, token, userId } = session || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')

    // Fetch artist info
    artist.value = await embyFetchJson({
      serverUrl,
      token,
      apiPath: `/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}?Fields=UserData`
    })

    // Fetch top songs by this artist
    const topSongsRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?Recursive=true` +
        `&IncludeItemTypes=Audio` +
        `&CollectionTypes=music` +
        `&ArtistIds=${encodeURIComponent(id)}` +
        `&SortBy=PlayCount,SortName` +
        `&SortOrder=Descending,Ascending` +
        `&ImageTypeLimit=1` +
        `&Fields=BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&Limit=12`
    })
    topSongs.value = (topSongsRes?.Items ?? []).filter(isAudioItem)

    // Fetch albums by this artist
    const albumsRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?IncludeItemTypes=MusicAlbum` +
        `&Recursive=true` +
        `&SortBy=ProductionYear,PremiereDate,SortName` +
        `&SortOrder=Descending,Descending,Ascending` +
        `&ImageTypeLimit=1` +
        `&Fields=BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,ProductionYear` +
        `&Limit=12` +
        `&AlbumArtistIds=${encodeURIComponent(id)}`
    })
    albums.value = albumsRes?.Items ?? []
  } catch (e) {
    error.value = 'Failed to load artist information'
    console.error(e)
  } finally {
    loading.value = false
  }
}

function handlePlayTopSongs() {
  if (!topSongs.value.length) return
  handlePlayItem(topSongs.value[0], false, topSongs.value, {
    type: 'artist',
    id: route.params.id
  })
}

function handleShuffleTopSongs() {
  if (!topSongs.value.length) return
  const shuffled = [...topSongs.value].sort(() => Math.random() - 0.5)
  handlePlayItem(shuffled[0], false, shuffled, {
    type: 'artist',
    id: route.params.id,
    shuffled: true
  })
}

function handleTrackPlay(e) {
  const { track, queueContext } = e
  handlePlayItem(track, false, queueContext, {
    type: 'artist',
    id: route.params.id
  })
}

function handleAlbumPlay(e) {
  const album = e?.album
  if (album?.Id) {
    router.push(`/album/${album.Id}`)
  }
}

async function handleAlbumQuickPlay(e) {
  const { album } = e
  if (!album?.Id) return

  try {
    const session = await ensureUserId(sessionStore)
    const { serverUrl, token, userId } = session || {}
    if (!serverUrl || !token || !userId) return

    const images = '&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1'

    const tracksRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?ParentId=${encodeURIComponent(album.Id)}` +
        `&IncludeItemTypes=Audio` +
        `&SortBy=ParentIndexNumber,IndexNumber` +
        `&Recursive=true` +
        `&Limit=200` +
        `&Fields=${encodeURIComponent(TRACK_FIELDS)}` +
        images,
    })

    const tracks = (tracksRes?.Items || []).filter(isAudioItem)
    if (tracks.length === 0) return

    let selectedTrack = tracks[0]
    if (playbackStore.shuffleEnabled && tracks.length > 1) {
      const randomIndex = Math.floor(Math.random() * tracks.length)
      selectedTrack = tracks[randomIndex]
    }

    await handlePlayItem(selectedTrack, false, tracks, {
      type: 'album',
      id: album.Id
    })
  } catch {}
}

function handleAlbumFavoriteToggle(e) {
  const { album, isFavorite } = e
  if (!album) return
  
  console.log('[Artist] handleAlbumFavoriteToggle:', album.Name, 'isFavorite:', isFavorite)
  
  // Update in albums array for reactivity - create new array
  const idx = albums.value.findIndex(a => a.Id === album.Id)
  if (idx >= 0) {
    const newAlbums = [...albums.value]
    newAlbums[idx] = {
      ...newAlbums[idx],
      UserData: {
        ...newAlbums[idx].UserData,
        IsFavorite: isFavorite
      }
    }
    albums.value = newAlbums
    console.log('[Artist] Updated albums at index:', idx, 'new value:', albums.value[idx].UserData.IsFavorite)
  }
  
  // Update albums cache
  updateAlbumsCache(album.Id, isFavorite)
}

function handleTrackFavoriteToggle(e) {
  const { track, isFavorite } = e
  if (!track) return
  
  console.log('[Artist] handleTrackFavoriteToggle:', track.Name, 'isFavorite:', isFavorite)
  
  // Update in topSongs array with proper reactivity - create new array
  const idx = topSongs.value.findIndex(t => t.Id === track.Id)
  if (idx >= 0) {
    const newTopSongs = [...topSongs.value]
    newTopSongs[idx] = {
      ...newTopSongs[idx],
      UserData: {
        ...newTopSongs[idx].UserData,
        IsFavorite: isFavorite
      }
    }
    topSongs.value = newTopSongs
    console.log('[Artist] Updated topSongs at index:', idx, 'new value:', topSongs.value[idx].UserData.IsFavorite)
  }
  
  // Update songs cache
  updateSongsCache(track.Id, isFavorite)
}

function updateSongsCache(trackId, isFavorite) {
  try {
    const cacheKey = typedSongsCacheKey('songs')
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return
    
    const cacheData = JSON.parse(raw)
    if (!cacheData?.items || !Array.isArray(cacheData.items)) return
    
    // Items are stored as [[index, item], [index, item], ...] tuples
    let updated = false
    for (let i = 0; i < cacheData.items.length; i++) {
      const [itemIndex, item] = cacheData.items[i]
      if (item?.Id === trackId) {
        cacheData.items[i] = [itemIndex, {
          ...item,
          UserData: {
            ...item.UserData,
            IsFavorite: isFavorite
          }
        }]
        updated = true
        break
      }
    }
    
    if (updated) {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    }
  } catch (err) {
    console.warn('[Artist] Failed to update songs cache:', err)
  }
  
  // Update favorites cache if unfavoriting
  if (!isFavorite) {
    updateFavoritesCache(trackId, 'track')
  }
}

function updateAlbumsCache(albumId, isFavorite) {
  try {
    const cacheKey = typedCacheKey('mymusic')
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return
    
    const cacheData = JSON.parse(raw)
    if (!cacheData?.data || !Array.isArray(cacheData.data)) return
    
    let updated = false
    cacheData.data = cacheData.data.map(album => {
      if (album?.Id === albumId) {
        updated = true
        return {
          ...album,
          UserData: {
            ...album.UserData,
            IsFavorite: isFavorite
          }
        }
      }
      return album
    })
    
    if (updated) {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    }
  } catch (err) {
    console.warn('[Artist] Failed to update albums cache:', err)
  }
  
  // Update favorites cache if unfavoriting
  if (!isFavorite) {
    updateFavoritesCache(albumId, 'album')
  }
}

function updateFavoritesCache(itemId, itemType) {
  try {
    const cacheKey = typedCacheKey('favorites')
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return
    
    const cacheData = JSON.parse(raw)
    if (!cacheData?.data) return
    
    let updated = false
    if (itemType === 'track' && Array.isArray(cacheData.data.tracks)) {
      const newTracks = cacheData.data.tracks.filter(t => t.Id !== itemId)
      if (newTracks.length !== cacheData.data.tracks.length) {
        cacheData.data.tracks = newTracks
        updated = true
      }
    } else if (itemType === 'album' && Array.isArray(cacheData.data.albums)) {
      const newAlbums = cacheData.data.albums.filter(a => a.Id !== itemId)
      if (newAlbums.length !== cacheData.data.albums.length) {
        cacheData.data.albums = newAlbums
        updated = true
      }
    }
    
    if (updated) {
      localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    }
  } catch (err) {
    console.warn('[Artist] Failed to update favorites cache:', err)
  }
}

async function handleFavoriteToggle() {
  try {
    if (!artist.value) return
    
    togglingFavorite.value = true
    const session = await ensureUserId(sessionStore)
    const { serverUrl, token, userId } = session || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')
    
    const itemId = artist.value.Id
    const isFavorite = artist.value.UserData?.IsFavorite || false
    
    if (isFavorite) {
      await embyUnmarkFavorite({ serverUrl, token, userId, itemId })
    } else {
      await embyMarkFavorite({ serverUrl, token, userId, itemId })
    }
    
    // Update the state
    if (!artist.value.UserData) {
      artist.value.UserData = {}
    }
    artist.value.UserData.IsFavorite = !isFavorite
  } catch (err) {
    console.error('Failed to toggle favorite:', err)
  } finally {
    togglingFavorite.value = false
  }
}

onMounted(fetchArtist)
watch(() => route.params.id, fetchArtist)
watch(
  () => artist.value,
  (newArtist) => {
    if (newArtist) {
      const imageUrl = coverUrlFor(newArtist, sessionStore)
      if (imageUrl) {
        gradientCoverUrl.value = imageUrl
      }
    }
  }
)
</script>

<style scoped>
.artistPage {
  position: absolute;
  inset: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1;
  overflow-y: auto;
}

.artistLayout {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
  padding: 66px 56px 180px;
  align-items: stretch;
}

.artistHero {
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

.heroShade {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 18%, var(--octo-bg-common-color, rgba(120, 150, 190, 0.18)) 0%, transparent 58%),
    linear-gradient(180deg, rgba(7, 9, 15, 0.10) 0%, rgba(7, 9, 15, 0.42) 55%, rgba(7, 9, 15, 0.90) 100%);
}

.heroContent {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 6px;
  padding: 18px 18px 20px;
  z-index: 1;
}

.heroActions {
  position: absolute;
  bottom: 20px;
  right: 18px;
}

.heroKicker {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
}

.actionButtons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.actionButton {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 40px;
  height: 40px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 12, 18, 0.78);
  color: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
}

.actionButton:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.36);
  background: rgba(10, 12, 18, 0.92);
  color: white;
}

.actionButton:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.actionButton .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

/* ...existing code... */

.favoriteButton.is-favorite {
  color: #dc2626;
  border-color: #dc2626;
  background: rgba(220, 38, 38, 0.12);
}

.favoriteButton.is-favorite .icon svg {
  color: #dc2626;
  fill: #dc2626;
}

.actionButton .icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.heroTitle {
  margin: 0;
  font-size: clamp(26px, 4vw, 34px);
  font-weight: 800;
  letter-spacing: 0.2px;
  color: #fff;
  text-shadow: 0 4px 18px rgba(0, 0, 0, 0.6);
  max-width: calc(100% - 180px);
}

.heroCounts {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.section {
  padding: 40px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sectionTitle {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 24px 0;
  color: white;
}

.aboutSection {
  background: rgba(0, 0, 0, 0.2);
}

.aboutText {
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  margin: 0;
  max-width: 600px;
}

.topSongsSection {
  background: rgba(0, 0, 0, 0.1);
}

.albumsSection {
  background: rgba(0, 0, 0, 0.1);
}

.aboutModalOverlay {
  position: fixed;
  top: 40px;
  left: 0;
  right: 0;
  bottom: 140px;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.aboutModalContent {
  max-width: 600px;
  width: 100%;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  padding: 40px;
  color: white;
  position: relative;
}

.aboutModalContent h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  padding-right: 40px;
  padding-bottom: 20px;
  flex-shrink: 0;
}

.aboutModalText {
  overflow-y: auto;
  flex: 1;
}

.aboutModalText p {
  margin: 0;
  margin-right: 26px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.9);
}

.closeButton {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.closeButton:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.closeButton svg {
  width: 20px;
  height: 20px;
}

.aboutModalContent {
  padding: 24px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.6;
  overflow-y: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
