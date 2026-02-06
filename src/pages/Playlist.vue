<template>
  <MediaDetailView
    mediaType="playlist"
    :title="getPlaylistTitle()"
    :coverUrl="coverUrlFor(playlist, sessionStore)"
    :tracks="tracks"
    :loading="loading"
    :error="error"
    emptyMessage="No tracks found for this playlist."
    @track-play="onTrackPlay"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MediaDetailView from '../components/MediaDetailView.vue'
import { embyFetchJson, embyLatestMusic, embyRecentlyPlayedMusic, embyFrequentlyPlayedMusic } from '../services/emby.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor, isAudioItem } from '../services/mediaUtils.js'
import { useSessionStore } from '../stores/session.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'

const route = useRoute()
const sessionStore = useSessionStore()
sessionStore.hydrate()

const playlist = ref(null)
const tracks = ref([])
const loading = ref(false)
const error = ref('')
const { handlePlayItem, playbackStore } = usePlaybackController()

function getPlaylistTitle() {
  if (playlist.value?.Name) return playlist.value.Name
  const id = route.params.id || String(route.path || '').split('/').pop() || ''
  if (id === 'recent') return 'Recently Played'
  if (id === 'frequent') return 'Frequently Played'
  if (id === 'latest') return 'Latest Music'
  if (id === 'current') return 'Current Playlist'
  return ''
}

async function fetchPlaylist() {
  const id = route.params.id || String(route.path || '').split('/').pop() || ''
  error.value = ''
  loading.value = true

  try {
    const { serverUrl, token, userId } = (await ensureUserId(sessionStore)) || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')

    if (id === 'current') {
      playlist.value = { Name: 'Current Playlist' }
      tracks.value = (playbackStore.queue || []).filter(isAudioItem)
      return
    }

    if (id === 'recent') {
      playlist.value = { Name: 'Recently Played' }
      const res = await embyRecentlyPlayedMusic({ serverUrl, token, userId, limit: 200 })
      tracks.value = (res?.Items || []).filter(isAudioItem)
      return
    }

    if (id === 'frequent') {
      playlist.value = { Name: 'Frequently Played' }
      const res = await embyFrequentlyPlayedMusic({ serverUrl, token, userId, limit: 200 })
      tracks.value = (res?.Items || []).filter(isAudioItem)
      return
    }

    if (id === 'latest') {
      playlist.value = { Name: 'Latest Music' }
      const res = await embyLatestMusic({ serverUrl, token, userId, limit: 200 })
      tracks.value = (Array.isArray(res) ? res : []).filter(isAudioItem)
      return
    }

    const playlistRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath: `/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}`
    })
    playlist.value = playlistRes

    const itemsRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath: `/Playlists/${encodeURIComponent(id)}/Items?Fields=DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData`
    })

    const items = itemsRes?.Items || itemsRes || []
    tracks.value = (Array.isArray(items) ? items : []).filter(isAudioItem)
  } catch (err) {
    error.value = 'Failed to load playlist. ' + (err?.message || String(err))
  } finally {
    loading.value = false
  }
}

function onTrackPlay(e) {
  const { track, queueContext } = e
  const id = route.params.id || String(route.path || '').split('/').pop() || 'current'
  handlePlayItem(track, false, queueContext, { type: 'playlist', id })
}

onMounted(fetchPlaylist)

watch(() => route.path, fetchPlaylist)
</script>

