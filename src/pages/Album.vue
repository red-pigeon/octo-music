<template>
  <MediaDetailView
    mediaType="album"
    :title="album?.Name || ''"
    :subtitle="getArtistFromItem(album) || ''"
    :subtitleArtistId="album?.ArtistItems?.[0]?.Id || ''"
    :coverUrl="coverUrlFor(album, sessionStore)"
    :mediaItem="album"
    :tracks="tracks"
    :loading="loading"
    :error="error"
    emptyMessage="No tracks found for this album."
    @track-play="onTrackPlay"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import MediaDetailView from '../components/MediaDetailView.vue'
import { embyFetchJson } from '../services/emby.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor, getArtistFromItem, isAudioItem } from '../services/mediaUtils.js'
import { useSessionStore } from '../stores/session.js'
import { usePlaybackController } from '../composables/usePlaybackController.js'

const route = useRoute()
const sessionStore = useSessionStore()
sessionStore.hydrate()

const album = ref(null)
const tracks = ref([])
const loading = ref(false)
const error = ref('')
const { handlePlayItem } = usePlaybackController()

async function fetchAlbum() {
  const id = route.params.id
  if (!id) {
    error.value = 'No album id provided'
    return
  }

  loading.value = true
  try {
    const session = await ensureUserId(sessionStore)
    const { serverUrl, token, userId } = session || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')

    album.value = await embyFetchJson({
      serverUrl,
      token,
      apiPath: `/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(id)}?Fields=UserData`
    })

    const tracksRes = await embyFetchJson({
      serverUrl,
      token,
      apiPath:
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?ParentId=${encodeURIComponent(id)}` +
        `&IncludeItemTypes=Audio` +
        `&SortBy=ParentIndexNumber,IndexNumber` +
        `&Recursive=true` +
        `&Fields=DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&Limit=200`
    })

    tracks.value = (tracksRes?.Items ?? []).filter(isAudioItem)
  } catch {}
  finally {
    loading.value = false
  }
}

function onTrackPlay(e) {
  const { track, queueContext } = e
  handlePlayItem(track, false, queueContext, { type: 'album', id: route.params.id })
}

onMounted(fetchAlbum)

watch(() => route.params.id, fetchAlbum)
</script>

