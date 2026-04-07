/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { storageGetItem, storageRemoveItem, storageSetItem } from '../utils/storage.js'

function isLikelyLocalAddress(rawNoScheme) {
    const hostPort = String(rawNoScheme || '').split('/')[0]
    const host = hostPort.split(':')[0].toLowerCase()

    if (!host) { return true }

    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
        return true
    }

    // Private IP ranges
    if (/^10\./.test(host)) { return true }
    if (/^192\.168\./.test(host)) { return true }
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) { return true }

    return false
}

function normalizeServerUrl(raw) {
    let s = String(raw || '').trim()
    if (!s) {
        return ''
    }

    if (!/^https?:\/\//i.test(s)) {
        const scheme = isLikelyLocalAddress(s) ? 'http' : 'https'
        s = `${scheme}://${s}`
    }

    s = s.replace(/\/+$/, '')

    // Strip trailing /emby if present (Jellyfin does not use this prefix)
    if (s.toLowerCase().endsWith('/emby')) {
        s = s.slice(0, -5)
    }

    return s
}

export function is401Error(error) {
    const msg = String(error?.message || error || '')
    return /Jellyfin 401:|401 Unauthorized/i.test(msg)
}

function hasOctoBridge() {
    return typeof window !== 'undefined' && !!window.octo
}

function buildClientHeaders(token) {
    const parts = [
        'Client="Octo Player"',
        'Device="Octo Web"',
        'DeviceId="octo-player-web"',
        'Version="1.0.0"',
    ]
    if (token) {
        parts.push(`Token="${token}"`)
    }

    const headers = {
        'Authorization': `MediaBrowser ${parts.join(', ')}`,
    }
    if (token) {
        headers['X-Emby-Token'] = token
    }

    return headers
}

async function fetchJsonDirect({ url, token, method = 'GET', body = null, contentType }) {
    const headers = buildClientHeaders(token)
    if (contentType) {
        headers['Content-Type'] = contentType
    }

    const res = await fetch(url, { method, headers, body })
    if (res.status === 401) {
        clearConnection()
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw new Error('Jellyfin 401: Unauthorized')
    }
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(`Jellyfin ${res.status}: ${msg || res.statusText}`)
    }

    const contentTypeHeader = res.headers.get('content-type') || ''
    if (contentTypeHeader.includes('application/json')) {
        return res.json()
    }
    return res.text()
}

// Jellyfin does NOT use an /emby path prefix — paths are served directly off the base URL
export function buildJellyfinUrl(serverUrl, apiPath) {
    const base = normalizeServerUrl(serverUrl)
    if (!base) {
        return ''
    }

    const p = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
    return `${base}${p}`
}

export function buildAuthUrl(serverUrl) {
    const base = normalizeServerUrl(serverUrl)
    if (!base) {
        return ''
    }
    return `${base}/Users/AuthenticateByName`
}

export async function jellyfinLogin({ serverUrl, username, password }) {
    const url = buildAuthUrl(serverUrl)
    if (!url) {
        throw new Error('Server URL is empty.')
    }

    const u = String(username || '').trim()
    const p = String(password || '')

    if (!u) {
        throw new Error('Username is empty.')
    }
    if (!p) {
        throw new Error('Password is empty.')
    }

    const urlsToTry = [url]
    // Retry over https if http auth fails
    if (/^http:\/\//i.test(url)) {
        urlsToTry.push(url.replace(/^http:\/\//i, 'https://'))
    }

    let lastErr = null
    for (const tryUrl of urlsToTry) {
        try {
            const result = await fetchJsonDirect({
                url: tryUrl,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({ Username: u, Pw: p })
            })

            const token = result?.AccessToken
            if (!token) {
                throw new Error('Login succeeded but no AccessToken returned.')
            }

            return result
        } catch (err) {
            lastErr = err
            const msg = String(err?.message || err || '')
            const looksLikeHttpAuthBlock = /Access token is invalid or expired\.?/i.test(msg)
            if (!looksLikeHttpAuthBlock) {
                throw err
            }
        }
    }

    throw lastErr || new Error('Login failed.')
}

export async function jellyfinSystemInfo({ serverUrl, token }) {
    const url = buildJellyfinUrl(serverUrl, '/System/Info')
    if (!url) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    try {
        return await fetchJsonDirect({ url, token: t })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}

export async function jellyfinFetchJson({ serverUrl, token, apiPath }) {
    const url = buildJellyfinUrl(serverUrl, apiPath)
    if (!url) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    try {
        return await fetchJsonDirect({ url, token: t })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}

export function saveConnection({ serverUrl, token, userId, userName }) {
    storageSetItem('octoPlayer.jellyfin.serverUrl', normalizeServerUrl(serverUrl))
    storageSetItem('octoPlayer.jellyfin.token', String(token || '').trim())

    if (userId) {
        storageSetItem('octoPlayer.jellyfin.userId', String(userId))
    }
    if (userName) {
        storageSetItem('octoPlayer.jellyfin.userName', String(userName))
    }
}

export function loadConnection() {
    const serverUrl = storageGetItem('octoPlayer.jellyfin.serverUrl', '') || ''
    const token = storageGetItem('octoPlayer.jellyfin.token', '') || ''
    const userId = storageGetItem('octoPlayer.jellyfin.userId', '') || ''
    const userName = storageGetItem('octoPlayer.jellyfin.userName', '') || ''
    return { serverUrl, token, userId, userName }
}

export function clearConnection() {
    storageRemoveItem('octoPlayer.jellyfin.serverUrl')
    storageRemoveItem('octoPlayer.jellyfin.token')
    storageRemoveItem('octoPlayer.jellyfin.userId')
    storageRemoveItem('octoPlayer.jellyfin.userName')
}

export function normalizeForDisplay(raw) {
    return normalizeServerUrl(raw)
}

export async function jellyfinGetUserViews({ serverUrl, token, userId }) {
    const path = `/Users/${encodeURIComponent(userId || '')}/Views`
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinLatestMusic({ serverUrl, token, userId, limit = 30, parentId = null }) {
    let path =
        `/Users/${encodeURIComponent(userId || '')}/Items/Latest` +
        `?IncludeItemTypes=Audio,MusicAlbum,Playlist` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&GroupItems=true` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`

    if (parentId) {
        path += `&ParentId=${encodeURIComponent(parentId)}`
    }

    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinRecentlyPlayedMusic({ serverUrl, token, userId, limit = 30 }) {
    const path =
        `/Users/${encodeURIComponent(userId || '')}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=DatePlayed` +
        `&SortOrder=Descending` +
        `&Filters=IsPlayed` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinFrequentlyPlayedMusic({ serverUrl, token, userId, limit = 30 }) {
    const path =
        `/Users/${encodeURIComponent(userId || '')}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=PlayCount` +
        `&SortOrder=Descending` +
        `&Filters=IsPlayed` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinGetAllAlbums({ serverUrl, token, userId, limit = 500 }) {
    const path =
        `/Users/${encodeURIComponent(userId || '')}/Items` +
        `?IncludeItemTypes=MusicAlbum` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,ArtistItems,AlbumArtist,Artists,PrimaryImageItemId,PrimaryImageTag,ChildCount,RecursiveItemCount,ItemCounts,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinGetAllSongs({ serverUrl, token, userId, limit = 500, startIndex = 0 }) {
    const path =
        `/Users/${encodeURIComponent(userId || '')}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&StartIndex=${encodeURIComponent(startIndex)}` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData,DateCreated` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinGetSongsPage({ serverUrl, token, userId, startIndex = 0, limit = 500, filters = {} }) {
    let path =
        `/Users/${encodeURIComponent(userId || '')}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&StartIndex=${encodeURIComponent(startIndex)}` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData,DateCreated` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`

    if (filters.letter && filters.letter !== 'All') {
        if (filters.letter === '#') {
            path += `&NameLessThan=A`
        } else if (/^[A-Z]$/i.test(filters.letter)) {
            const letter = filters.letter.toUpperCase()
            const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1)
            path += `&NameStartsWithOrGreater=${encodeURIComponent(letter)}`
            if (nextLetter <= 'Z') {
                path += `&NameLessThan=${encodeURIComponent(nextLetter)}`
            }
        }
    }

    if (filters.search && filters.search.trim()) {
        path += `&SearchTerm=${encodeURIComponent(filters.search.trim())}`
    }

    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinPlaybackInfo({ serverUrl, token, userId, itemId, deviceId, playSessionId }) {
    const path =
        `/Items/${encodeURIComponent(itemId || '')}/PlaybackInfo` +
        `?UserId=${encodeURIComponent(userId || '')}` +
        (deviceId ? `&DeviceId=${encodeURIComponent(deviceId)}` : '') +
        (playSessionId ? `&PlaySessionId=${encodeURIComponent(playSessionId)}` : '')
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinGetSessions({ serverUrl, token, deviceId }) {
    let path = '/Sessions'
    if (deviceId) {
        path += `?DeviceId=${encodeURIComponent(deviceId)}`
    }
    return jellyfinFetchJson({ serverUrl, token, apiPath: path })
}

export async function jellyfinReportPlaybackProgress({
    serverUrl,
    token,
    userId,
    itemId,
    mediaSourceId,
    positionTicks,
    playSessionId,
    deviceId,
    isPaused = false
}) {
    const body = {
        ItemId: String(itemId || ''),
        MediaSourceId: String(mediaSourceId || ''),
        PositionTicks: Number(positionTicks || 0),
        UserId: String(userId || ''),
        PlayMethod: 'Transcode',
        IsPaused: !!isPaused,
        CanSeek: true,
    }
    if (playSessionId) body.PlaySessionId = String(playSessionId)
    if (deviceId) body.DeviceId = String(deviceId)

    const url = buildJellyfinUrl(serverUrl, '/Sessions/Playing/Progress')
    const t = String(token || '').trim()
    try {
        return await fetchJsonDirect({ url, token: t, method: 'POST', body: JSON.stringify(body), contentType: 'application/json' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}

export async function jellyfinReportPlaybackStarted({
    serverUrl,
    token,
    userId,
    itemId,
    mediaSourceId,
    playSessionId,
    deviceId,
}) {
    const body = {
        ItemId: String(itemId || ''),
        MediaSourceId: String(mediaSourceId || ''),
        PositionTicks: 0,
        UserId: String(userId || ''),
        PlayMethod: 'Transcode',
        IsPaused: false,
        CanSeek: true,
    }
    if (playSessionId) body.PlaySessionId = String(playSessionId)
    if (deviceId) body.DeviceId = String(deviceId)

    const url = buildJellyfinUrl(serverUrl, '/Sessions/Playing')
    const t = String(token || '').trim()
    try {
        return await fetchJsonDirect({ url, token: t, method: 'POST', body: JSON.stringify(body), contentType: 'application/json' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}

export async function jellyfinMarkFavorite({ serverUrl, token, userId, itemId }) {
    const path = `/Users/${encodeURIComponent(userId || '')}/FavoriteItems/${encodeURIComponent(itemId || '')}`
    const baseUrl = buildJellyfinUrl(serverUrl, path)
    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    try {
        return await fetchJsonDirect({ url: baseUrl, token: t, method: 'POST', body: '{}', contentType: 'application/json' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}

export async function jellyfinUnmarkFavorite({ serverUrl, token, userId, itemId }) {
    const path = `/Users/${encodeURIComponent(userId || '')}/FavoriteItems/${encodeURIComponent(itemId || '')}`
    const baseUrl = buildJellyfinUrl(serverUrl, path)
    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    try {
        return await fetchJsonDirect({ url: baseUrl, token: t, method: 'DELETE' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('jellyfin:unauthorized'))
        }
        throw err
    }
}
