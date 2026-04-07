/**
 * Unified API router — import from here instead of emby.js in shared components.
 * Routes each call to the active backend (Emby or Jellyfin) based on stored session type.
 */

import { storageGetItem } from '../utils/storage.js'
import {
    embyFetchJson as _embyFetchJson,
    embyGetUserViews as _embyGetUserViews,
    embyLatestMusic as _embyLatestMusic,
    embyRecentlyPlayedMusic as _embyRecentlyPlayedMusic,
    embyFrequentlyPlayedMusic as _embyFrequentlyPlayedMusic,
    embyGetAllAlbums as _embyGetAllAlbums,
    embyGetAllSongs as _embyGetAllSongs,
    embyGetSongsPage as _embyGetSongsPage,
    embyPlaybackInfo as _embyPlaybackInfo,
    embyGetSessions as _embyGetSessions,
    embyReportPlaybackProgress as _embyReportPlaybackProgress,
    embyReportPlaybackStarted as _embyReportPlaybackStarted,
    embyMarkFavorite as _embyMarkFavorite,
    embyUnmarkFavorite as _embyUnmarkFavorite,
    loadConnection as embyLoadConnection,
} from './emby.js'
import {
    jellyfinFetchJson,
    jellyfinGetUserViews,
    jellyfinLatestMusic,
    jellyfinRecentlyPlayedMusic,
    jellyfinFrequentlyPlayedMusic,
    jellyfinGetAllAlbums,
    jellyfinGetAllSongs,
    jellyfinGetSongsPage,
    jellyfinPlaybackInfo,
    jellyfinGetSessions,
    jellyfinReportPlaybackProgress,
    jellyfinReportPlaybackStarted,
    jellyfinMarkFavorite,
    jellyfinUnmarkFavorite,
    loadConnection as jellyfinLoadConnection,
} from './jellyfin.js'

function isJellyfin() {
    return storageGetItem('octoPlayer.session.type', 'emby') === 'jellyfin'
}

export const embyFetchJson = (args) => isJellyfin() ? jellyfinFetchJson(args) : _embyFetchJson(args)
export const embyGetUserViews = (args) => isJellyfin() ? jellyfinGetUserViews(args) : _embyGetUserViews(args)
export const embyLatestMusic = (args) => isJellyfin() ? jellyfinLatestMusic(args) : _embyLatestMusic(args)
export const embyRecentlyPlayedMusic = (args) => isJellyfin() ? jellyfinRecentlyPlayedMusic(args) : _embyRecentlyPlayedMusic(args)
export const embyFrequentlyPlayedMusic = (args) => isJellyfin() ? jellyfinFrequentlyPlayedMusic(args) : _embyFrequentlyPlayedMusic(args)
export const embyGetAllAlbums = (args) => isJellyfin() ? jellyfinGetAllAlbums(args) : _embyGetAllAlbums(args)
export const embyGetAllSongs = (args) => isJellyfin() ? jellyfinGetAllSongs(args) : _embyGetAllSongs(args)
export const embyGetSongsPage = (args) => isJellyfin() ? jellyfinGetSongsPage(args) : _embyGetSongsPage(args)
export const embyPlaybackInfo = (args) => isJellyfin() ? jellyfinPlaybackInfo(args) : _embyPlaybackInfo(args)
export const embyGetSessions = (args) => isJellyfin() ? jellyfinGetSessions(args) : _embyGetSessions(args)
export const embyReportPlaybackProgress = (args) => isJellyfin() ? jellyfinReportPlaybackProgress(args) : _embyReportPlaybackProgress(args)
export const embyReportPlaybackStarted = (args) => isJellyfin() ? jellyfinReportPlaybackStarted(args) : _embyReportPlaybackStarted(args)
export const embyMarkFavorite = (args) => isJellyfin() ? jellyfinMarkFavorite(args) : _embyMarkFavorite(args)
export const embyUnmarkFavorite = (args) => isJellyfin() ? jellyfinUnmarkFavorite(args) : _embyUnmarkFavorite(args)

/** Returns active connection info plus `serverType: 'emby' | 'jellyfin'`. */
export function loadConnection() {
    const type = storageGetItem('octoPlayer.session.type', 'emby') || 'emby'
    const conn = type === 'jellyfin' ? jellyfinLoadConnection() : embyLoadConnection()
    return { ...conn, serverType: type }
}
