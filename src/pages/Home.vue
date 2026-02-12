<template>
  <div class="container">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="loading" class="page-loading">
      <Spinner :size="52" />
    </div>

    <div v-else class="rails">
      <template v-for="rail in railDefinitions" :key="rail.key">
        <MediaRail
          v-if="rail.show"
          :ref="(el) => (rail.ref.value = el)"
          :title="rail.title"
          :items="rail.items"
          :loading="loading"
          :emptyMessage="rail.emptyMessage"
          :gridLayout="rail.gridLayout"
          :roundCover="true"
          :coverUrlFor="(item) => coverUrlFor(item, sessionStore)"
          :isAudioItem="isAudioItem"
          :currentPlayingId="currentPlayingId"
          :isPlaying="isCurrentlyPlaying"
          :sessionStore="sessionStore"
          v-on="rail.listeners"
        />
      </template>
    </div>

    <div v-if="allRailsEmpty" class="empty-cta">
      <div class="empty-message">Nothing to show here yet.</div>
      <PillButton aria-label="Go to My Music" @click="goToMyMusic">Go to My Music</PillButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { embyFetchJson } from '../services/emby.js'
import { useSessionStore } from '../stores/session.js'
import MediaRail from '../components/MediaRail.vue'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import PillButton from '../components/PillButton.vue'
import Spinner from '../components/Spinner.vue'
import { isAudioItem, coverUrlFor, TRACK_FIELDS } from '../services/mediaUtils.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'

const latest = ref([])
const recentlyPlayed = ref([])
const frequentlyPlayed = ref([])
const loading = ref(true)
const error = ref('')
const currentCoverUrl = ref(null)
const sessionStore = useSessionStore()
sessionStore.hydrate()
const router = useRouter()
const { playbackStore, handlePlayItem } = usePlaybackController()
const latestRef = ref(null)
const recentRef = ref(null)
const frequentRef = ref(null)
const currentPlayingId = computed(() => playbackStore.currentTrackId)
const isCurrentlyPlaying = computed(() => playbackStore.isPlaying)
let railPoll = null
let lastAlbumQuickPlay = { id: null, ts: 0 }
const hydratedLatestAlbumIds = new Set()

function handleItemHover(e) {
  const url = e?.coverUrl
  if (!url) return
  currentCoverUrl.value = url
}

function handleAlbumFavoriteToggle(e) {
  const album = e?.album || e
  if (!album?.UserData) return
  const isFavorite = album.UserData.IsFavorite || false
  album.UserData.IsFavorite = !isFavorite
}

function handleTrackPlay(e) {
  const track = e?.track
  const context = e?.context
  const origin = e?.origin || null
  if (track) {
    if (currentPlayingId.value === track.Id && playbackStore.nowPlaying) {
      const audioEl = document.querySelector('audio')
      if (audioEl?.paused) {
        audioEl.play().catch(() => {})
      } else {
        audioEl.pause()
      }
    } else {
      handlePlayItem(track, false, context, origin)?.then(() => {
        fetchRails()
      })
    }
    currentCoverUrl.value = coverUrlFor(track, sessionStore) || null
  }
}

function handleAlbumPlay(e) {
  const album = e?.album
  if (album?.Id) {
    router.push(`/album/${album.Id}`)
  }
}

async function handleAlbumQuickPlay(e) {
  const album = e?.album
  if (!album?.Id) return

  const now = Date.now()
  if (lastAlbumQuickPlay.id === album.Id && now - lastAlbumQuickPlay.ts < 1500) return
  lastAlbumQuickPlay = { id: album.Id, ts: now }

  try {
    const { serverUrl, token, userId } = (await ensureUserId()) || {}
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

    await handlePlayItem(selectedTrack, false, tracks, { type: 'album', id: album.Id })
    currentCoverUrl.value = coverUrlFor(selectedTrack, sessionStore) || null
  } catch {}
}

function handleViewPlaylist(playlistId) {
  router.push(`/playlist/${playlistId}`)
}

function goToMyMusic() {
  router.push('/my-music')
}

const latestRenderable = computed(() => (latest.value || []).filter((it) => isAudioItem(it) || it?.Type === 'MusicAlbum'))
const recentRenderable = computed(() => (recentlyPlayed.value || []).filter((it) => isAudioItem(it) || it?.Type === 'MusicAlbum'))
const frequentRenderable = computed(() => (frequentlyPlayed.value || []).filter((it) => isAudioItem(it) || it?.Type === 'MusicAlbum'))

const showLatestRail = computed(() => latestRenderable.value.length > 0)
const showRecentRail = computed(() => recentRenderable.value.length > 0)
const showFrequentRail = computed(() => frequentRenderable.value.length > 0)

const railDefinitions = computed(() => {
  const baseListeners = {
    trackplay: handleTrackPlay,
    albumplay: handleAlbumPlay,
    itemhover: handleItemHover,
    albumfavoritetoggle: handleAlbumFavoriteToggle,
  }

  return [
    {
      key: 'latest',
      title: 'Latest Music',
      ref: latestRef,
      items: latest.value,
      show: showLatestRail.value,
      gridLayout: false,
      emptyMessage: 'Nothing new has been added yet.',
      supportsQuickPlay: true,
      supportsPlaylistView: false,
    },
    {
      key: 'recently',
      title: 'Recently Played',
      ref: recentRef,
      items: recentlyPlayed.value,
      show: showRecentRail.value,
      gridLayout: true,
      emptyMessage: 'You haven’t played anything yet.',
      supportsQuickPlay: false,
      supportsPlaylistView: true,
    },
    {
      key: 'frequent',
      title: 'Frequently Played',
      ref: frequentRef,
      items: frequentlyPlayed.value,
      show: showFrequentRail.value,
      gridLayout: true,
      emptyMessage: 'Your most played tracks will show up here.',
      supportsQuickPlay: false,
      supportsPlaylistView: true,
    },
  ].map((rail) => ({
    ...rail,
    listeners: {
      ...baseListeners,
      ...(rail.supportsQuickPlay ? { albumquickplay: handleAlbumQuickPlay } : {}),
      ...(rail.supportsPlaylistView ? { viewplaylist: handleViewPlaylist } : {}),
    },
  }))
})

const allRailsEmpty = computed(() =>
  !loading.value &&
  latestRenderable.value.length === 0 &&
  recentRenderable.value.length === 0 &&
  frequentRenderable.value.length === 0
)

async function ensureUserId() {
  if (sessionStore?.userId) return sessionStore
  if (!sessionStore?.serverUrl || !sessionStore?.token) return sessionStore
  try {
    const me = await embyFetchJson({ serverUrl: sessionStore.serverUrl, token: sessionStore.token, apiPath: '/Users/Me' })
    if (me?.Id) {
      sessionStore.set({
        serverUrl: sessionStore.serverUrl,
        token: sessionStore.token,
        userId: me.Id,
        userName: me?.Name || sessionStore?.userName
      })
    }
  } catch {}
  return sessionStore
}

async function fetchRails(showSpinner = false) {
  error.value = ''
  if (showSpinner) {
    loading.value = true
  }
  try {
    const { serverUrl, token, userId } = (await ensureUserId()) || {}
    if (!serverUrl || !token || !userId) {
      if (showSpinner) {
        loading.value = false
      }
      return
    }
    const limit = 24
    const fields = [
      'PrimaryImageAspectRatio',
      'ImageTags',
      'PrimaryImageItemId',
      'PrimaryImageTag',
      'AlbumId',
      'AlbumPrimaryImageTag',
      'ArtistItems',
      'Artists',
      'AlbumArtist',
      'RunTimeTicks',
      'UserData',
      'ChildCount',
      'RecursiveItemCount',
      'ItemCounts',
    ].join(',')

    const images = '&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1'

    const latestPath =
      `/Users/${encodeURIComponent(userId)}/Items/Latest` +
      `?IncludeItemTypes=Audio` +
      `&Limit=${encodeURIComponent(limit)}` +
      `&Fields=${encodeURIComponent(fields)}` +
      images

    const recentPath =
      `/Users/${encodeURIComponent(userId)}/Items` +
      `?IncludeItemTypes=Audio` +
      `&SortBy=DatePlayed` +
      `&SortOrder=Descending` +
      `&Filters=IsPlayed` +
      `&Limit=${encodeURIComponent(limit)}` +
      `&Recursive=true` +
      `&Fields=${encodeURIComponent(fields)}` +
      images

    const frequentPath =
      `/Users/${encodeURIComponent(userId)}/Items` +
      `?IncludeItemTypes=Audio` +
      `&SortBy=PlayCount` +
      `&SortOrder=Descending` +
      `&Filters=IsPlayed` +
      `&Limit=${encodeURIComponent(limit)}` +
      `&Recursive=true` +
      `&Fields=${encodeURIComponent(fields)}` +
      images

    const [latestData, recentData, frequentData] = await Promise.all([
      embyFetchJson({ serverUrl, token, apiPath: latestPath }),
      embyFetchJson({ serverUrl, token, apiPath: recentPath }),
      embyFetchJson({ serverUrl, token, apiPath: frequentPath }),
    ])

    latest.value = Array.isArray(latestData) ? latestData : []
    recentlyPlayed.value = (recentData?.Items || []).filter(isAudioItem)
    frequentlyPlayed.value = (frequentData?.Items || []).filter(isAudioItem)

    const latestAlbumIdsToHydrate = (latest.value || [])
      .filter((it) => it?.Type === 'MusicAlbum' && it?.Id)
      .map((it) => it.Id)
      .filter((id) => !hydratedLatestAlbumIds.has(id))

    if (latestAlbumIdsToHydrate.length) {
      const batch = latestAlbumIdsToHydrate.slice(0, 60)
      batch.forEach((id) => hydratedLatestAlbumIds.add(id))

      try {
        const albumFields = [
          'PrimaryImageAspectRatio',
          'ImageTags',
          'PrimaryImageItemId',
          'PrimaryImageTag',
          'ArtistItems',
          'Artists',
          'AlbumArtist',
          'RunTimeTicks',
          'ChildCount',
          'RecursiveItemCount',
          'ItemCounts',
        ].join(',')

        const hydratePath =
          `/Users/${encodeURIComponent(userId)}/Items` +
          `?Ids=${encodeURIComponent(batch.join(','))}` +
          `&Fields=${encodeURIComponent(albumFields)}` +
          images

        const hydrated = await embyFetchJson({ serverUrl, token, apiPath: hydratePath })
        const hydratedItems = hydrated?.Items || hydrated
        const byId = new Map(
          (Array.isArray(hydratedItems) ? hydratedItems : []).map((it) => [it?.Id, it]).filter(([id]) => id)
        )

        if (byId.size) {
          latest.value = (latest.value || []).map((it) => {
            if (it?.Type !== 'MusicAlbum' || !it?.Id) return it
            const extra = byId.get(it.Id)
            return extra ? { ...it, ...extra } : it
          })
        }
      } catch {
        batch.forEach((id) => hydratedLatestAlbumIds.delete(id))
      }
    }
  } catch (err) {
    error.value = err?.message || String(err)
  } finally {
    if (showSpinner) {
      loading.value = false
    }
  }
}

const stopPoll = () => {
  if (railPoll) {
    clearInterval(railPoll)
    railPoll = null
  }
}

watch(
  isCurrentlyPlaying,
  (playing) => {
    stopPoll()
    if (playing) {
      railPoll = setInterval(() => {
        fetchRails()
      }, 5000)
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchRails(true)
})

watch(() => router.currentRoute.value.query?.section, (section) => {
  try {
    const map = {
      latest: latestRef,
      recently: recentRef,
      frequent: frequentRef,
    }
    const refObj = map[String(section || '').toLowerCase()]
    const el = refObj?.value?.$el || refObj?.value
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } catch {}
}, { immediate: true })

onUnmounted(() => {
  stopPoll()
})
</script>

<style scoped>
.container {
  position: absolute;
  inset: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1;
  overflow-y: auto;
}

.error {
  margin-top: 12px;
  font-size: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 120, 120, 0.35);
  background: rgba(255, 120, 120, 0.12);
  color: rgba(255, 220, 220, 0.95);
  width: 100%;
  max-width: 520px;
  text-align: center;
}

.rails {
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
  padding: 66px 56px 160px 56px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-cta {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateY(-60px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty-message {
  color: rgba(255, 255, 255, 0.75);
  font-size: 1rem;
  text-align: center;
}

.page-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
