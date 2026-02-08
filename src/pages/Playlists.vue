<!--
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 -->
<template>
  <div class="playlists-page">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading && playlists.length === 0" class="page-loading">
      <Spinner :size="52" />
    </div>

    <div v-else class="playlists-layout">
      <div class="controls-row" v-if="playlists.length > 0">
        <FilterBar
          ref="filterBarRef"
          v-model="selectedFilter"
          :options="filterLetters"
          v-model:search="searchTerm"
          searchPlaceholder="Search playlists"
          searchAriaLabel="Search playlists"
          @change="handleFilterChanged"
        />
      </div>

      <div ref="contentRef" class="playlists-content" @scroll="handleContentScroll">
        <div v-if="filteredPlaylists.length > 0" class="section">
          <div class="sectionHeader">
            <span>Your Playlists</span>
            <span class="sectionCount">{{ filteredPlaylists.length }}</span>
          </div>
          <Grid variant="albums" gap="20px">
            <Album
              v-for="playlist in displayedPlaylists"
              :key="playlist.Id"
              :album="playlist"
              :coverUrl="coverUrlFor(playlist, sessionStore)"
              appearance="flat"
              :showDetails="true"
              :tilePlays="false"
              :titleOpens="true"
              :canToggleFavorite="false"
              :sessionStore="sessionStore"
              @hover="handlePlaylistHover"
              @open="handlePlaylistOpen"
            />
          </Grid>
        </div>

        <div v-if="!loading && playlists.length === 0" class="empty-center">
          No playlists found. Create playlists in your Emby/Jellyfin server to see them here.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import FilterBar from '../components/FilterBar.vue'
import Spinner from '../components/Spinner.vue'
import Album from '../components/Album.vue'
import Grid from '../components/Grid.vue'
import { embyFetchJson } from '../services/emby.js'
import { ensureUserId } from '../services/ensureUserId.js'
import { coverUrlFor } from '../services/mediaUtils.js'
import { useSessionStore } from '../stores/session.js'

const router = useRouter()
const sessionStore = useSessionStore()
sessionStore.hydrate()

const playlists = ref([])
const loading = ref(false)
const error = ref('')
const currentCoverUrl = ref(null)
const displayLimit = ref(50)
const searchTerm = ref('')
const selectedFilter = ref('All')
const contentRef = ref(null)
const filterBarRef = ref(null)

const PLAYLISTS_STATE_KEY = 'octoPlayer.playlistsState.v1'
let pendingRestore

function savePlaylistsState() {
  try {
    const payload = {
      selectedFilter: selectedFilter.value,
      searchTerm: searchTerm.value,
      displayLimit: displayLimit.value,
      contentScrollTop: contentRef.value?.scrollTop ?? 0,
    }
    sessionStorage.setItem(PLAYLISTS_STATE_KEY, JSON.stringify(payload))
  } catch {}
}

function clearPlaylistsState() {
  try {
    sessionStorage.removeItem(PLAYLISTS_STATE_KEY)
  } catch {}
}

function restorePlaylistsState() {
  try {
    const raw = sessionStorage.getItem(PLAYLISTS_STATE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed.selectedFilter === 'string') selectedFilter.value = parsed.selectedFilter
    if (typeof parsed.searchTerm === 'string') searchTerm.value = parsed.searchTerm
    if (typeof parsed.displayLimit === 'number') displayLimit.value = parsed.displayLimit
    if (typeof parsed.contentScrollTop === 'number') {
      pendingRestore = { contentScrollTop: parsed.contentScrollTop }
    }
    clearPlaylistsState()
  } catch {}
}

const filterLetters = computed(() => {
  const letters = new Set(['All'])
  for (const p of playlists.value) {
    const first = (p.Name || '').charAt(0).toUpperCase()
    if (/[A-Z]/.test(first)) letters.add(first)
    else if (first) letters.add('#')
  }
  return ['All', ...([...letters].filter(l => l !== 'All').sort((a, b) => {
    if (a === '#') return 1
    if (b === '#') return -1
    return a.localeCompare(b)
  }))]
})

const filteredPlaylists = computed(() => {
  let list = playlists.value
  const query = (searchTerm.value || '').toLowerCase().trim()
  if (query) {
    list = list.filter(p => (p.Name || '').toLowerCase().includes(query))
  }
  if (selectedFilter.value !== 'All') {
    list = list.filter(p => {
      const first = (p.Name || '').charAt(0).toUpperCase()
      if (selectedFilter.value === '#') return !/[A-Z]/.test(first)
      return first === selectedFilter.value
    })
  }
  return list
})

const displayedPlaylists = computed(() => filteredPlaylists.value.slice(0, displayLimit.value))

function handleFilterChanged() {
  displayLimit.value = 50
  nextTick(() => {
    if (contentRef.value) contentRef.value.scrollTop = 0
  })
}

function handleContentScroll() {
  if (!contentRef.value) return
  const el = contentRef.value
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 200
  if (nearBottom && displayLimit.value < filteredPlaylists.value.length) {
    displayLimit.value += 30
  }
}

function handlePlaylistHover(e) {
  const url = e?.coverUrl
  if (url) currentCoverUrl.value = url
}

function handlePlaylistOpen(e) {
  const playlist = e?.album || e
  if (playlist?.Id) {
    savePlaylistsState()
    router.push(`/playlist/${playlist.Id}`)
  }
}

async function fetchPlaylists() {
  error.value = ''
  loading.value = true
  try {
    const { serverUrl, token, userId } = (await ensureUserId(sessionStore)) || {}
    if (!serverUrl || !token || !userId) throw new Error('Not authenticated')

    const res = await embyFetchJson({
      serverUrl,
      token,
      apiPath: `/Users/${encodeURIComponent(userId)}/Items?IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio,DateCreated`
    })

    playlists.value = res?.Items || []
  } catch (err) {
    error.value = 'Failed to load playlists. ' + (err?.message || String(err))
  } finally {
    loading.value = false
  }
}

watch([searchTerm, selectedFilter], () => {
  displayLimit.value = 50
})

onMounted(async () => {
  restorePlaylistsState()
  await fetchPlaylists()
  if (pendingRestore) {
    nextTick(() => {
      if (contentRef.value && pendingRestore.contentScrollTop) {
        contentRef.value.scrollTop = pendingRestore.contentScrollTop
      }
      pendingRestore = null
    })
  }
})

onBeforeRouteLeave(() => {
  savePlaylistsState()
})
</script>

<style scoped>
.playlists-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background: transparent;
  z-index: 1;
}

.playlists-layout {
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

.playlists-content {
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

.playlists-content::-webkit-scrollbar { display: none; }
.playlists-content { scrollbar-width: none; -ms-overflow-style: none; }

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

@media (max-width: 720px) {
  .controls-row {
    top: 48px;
    padding: 0 16px;
    gap: 10px;
  }

  .playlists-content {
    padding-left: 16px;
    padding-right: 16px;
    max-width: calc(100% - 32px);
  }
}
</style>
