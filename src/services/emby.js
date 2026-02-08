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
        // Default to https for remote, http for local
        const scheme = isLikelyLocalAddress(s) ? 'http' : 'https'
        s = `${scheme}://${s}`
    }

    s = s.replace(/\/+$/, '')

    if (s.toLowerCase().endsWith('/emby')) {
        s = s.slice(0, -5)
    }

    return s
}

export function is401Error(error) {
    const msg = String(error?.message || error || '')
    return /Emby 401:|401 Unauthorized/i.test(msg)
}

function hasOctoBridge() {
    return typeof window !== 'undefined' && !!window.octo
}

function buildClientHeaders(token) {
    const headers = {
        'X-Emby-Client': 'Octo Player',
        'X-Emby-Device-Name': 'Octo Web',
        'X-Emby-Device-Id': 'octo-player-web',
        'X-Emby-Client-Version': '1.0.0',
    }
    if (token) {
        headers['X-Emby-Token'] = token
    }
    // Emby/Jellyfin expect this composite header for auth context; keep it simple for browser path
    headers['X-Emby-Authorization'] = [
        'MediaBrowser',
        'Client="Octo Player"',
        'Device="Octo Web"',
        'DeviceId="octo-player-web"',
        'Version="1.0.0"'
    ].join(', ')

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
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw new Error('Emby 401: Unauthorized')
    }
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(`Emby ${res.status}: ${msg || res.statusText}`)
    }

    const contentTypeHeader = res.headers.get('content-type') || ''
    if (contentTypeHeader.includes('application/json')) {
        return res.json()
    }
    return res.text()
}

export function buildEmbyUrl(serverUrl, apiPath) {
    const base = normalizeServerUrl(serverUrl)
    if (!base) {
        return ''
    }

    const p = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
    return `${base}/emby${p}`
}

export function buildAuthUrl(serverUrl) {
    const base = normalizeServerUrl(serverUrl)
    if (!base) {
        return ''
    }
    return `${base}/emby/Users/AuthenticateByName`
}

export async function embyLogin({ serverUrl, username, password }) {
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

    const useBridge = hasOctoBridge() && window.octo.embyAuthenticateByName

    const urlsToTry = [url]
    // Retry over https if http auth fails (some proxies block it)
    if (/^http:\/\//i.test(url)) {
        urlsToTry.push(url.replace(/^http:\/\//i, 'https://'))
    }

    let lastErr = null
    for (const tryUrl of urlsToTry) {
        try {
            const result = useBridge
                ? await window.octo.embyAuthenticateByName({ url: tryUrl, username: u, password: p })
                : await fetchJsonDirect({
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

export async function embySystemInfo({ serverUrl, token }) {
    const url = buildEmbyUrl(serverUrl, '/System/Info')
    if (!url) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embySystemInfo

    try {
        if (useBridge) {
            return await window.octo.embySystemInfo({ url, token: t })
        }
        return await fetchJsonDirect({ url, token: t })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}

export async function embyFetchJson({ serverUrl, token, apiPath }) {
    const url = buildEmbyUrl(serverUrl, apiPath)
    if (!url) {
        throw new Error('Server URL is empty.')
    }

    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embyFetchJson

    try {
        if (useBridge) {
            return await window.octo.embyFetchJson({ url, token: t })
        }
        return await fetchJsonDirect({ url, token: t })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}

export function saveConnection({ serverUrl, token, userId, userName }) {
    storageSetItem('octoPlayer.emby.serverUrl', normalizeServerUrl(serverUrl))
    storageSetItem('octoPlayer.emby.token', String(token || '').trim())

    if (userId) {
        storageSetItem('octoPlayer.emby.userId', String(userId))
    }
    if (userName) {
        storageSetItem('octoPlayer.emby.userName', String(userName))
    }
}

export function loadConnection() {
    const serverUrl = storageGetItem('octoPlayer.emby.serverUrl', '') || ''
    const token = storageGetItem('octoPlayer.emby.token', '') || ''
    const userId = storageGetItem('octoPlayer.emby.userId', '') || ''
    const userName = storageGetItem('octoPlayer.emby.userName', '') || ''
    return { serverUrl, token, userId, userName }
}

export function clearConnection() {
    storageRemoveItem('octoPlayer.emby.serverUrl')
    storageRemoveItem('octoPlayer.emby.token')
    storageRemoveItem('octoPlayer.emby.userId')
    storageRemoveItem('octoPlayer.emby.userName')
}

export function normalizeForDisplay(raw) {
    return normalizeServerUrl(raw)
}

export async function embyLatestMusic({ serverUrl, token, userId, limit = 30 }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/Items/Latest` +
        `?IncludeItemTypes=Audio` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyRecentlyPlayedMusic({ serverUrl, token, userId, limit = 30 }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=DatePlayed` +
        `&SortOrder=Descending` +
        `&Filters=IsPlayed` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyFrequentlyPlayedMusic({ serverUrl, token, userId, limit = 30 }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=PlayCount` +
        `&SortOrder=Descending` +
        `&Filters=IsPlayed` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,DateCreated,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyGetAllAlbums({ serverUrl, token, userId, limit = 500 }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/Items` +
        `?IncludeItemTypes=MusicAlbum` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,ArtistItems,AlbumArtist,Artists,PrimaryImageItemId,PrimaryImageTag,ChildCount,RecursiveItemCount,ItemCounts` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyGetAllSongs({ serverUrl, token, userId, limit = 500, startIndex = 0 }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&StartIndex=${encodeURIComponent(startIndex)}` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData,DateCreated` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

/**
 * Fetch songs with optional server-side filtering.
 * Supports letter filtering and search for efficient lazy loading.
 * 
 * @param {Object} params
 * @param {string} params.serverUrl - Server URL
 * @param {string} params.token - Auth token
 * @param {string} params.userId - User ID
 * @param {number} params.startIndex - Start index for pagination
 * @param {number} params.limit - Number of items to fetch
 * @param {Object} params.filters - Optional filters
 * @param {string} params.filters.letter - Filter by first letter ('A'-'Z', '#' for non-alpha, 'All' for none)
 * @param {string} params.filters.search - Search term to filter by
 */
export async function embyGetSongsPage({ serverUrl, token, userId, startIndex = 0, limit = 500, filters = {} }) {
    let path =
        `/Users/${encodeURIComponent(userId || "")}/Items` +
        `?IncludeItemTypes=Audio` +
        `&SortBy=SortName` +
        `&SortOrder=Ascending` +
        `&StartIndex=${encodeURIComponent(startIndex)}` +
        `&Limit=${encodeURIComponent(limit)}` +
        `&Recursive=true` +
        `&Fields=PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData,DateCreated` +
        `&EnableImageTypes=Primary,Backdrop,Thumb` +
        `&ImageTypeLimit=1`
    
    // Apply letter filter using server-side filtering
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
    
    // Apply search filter (optional - for future use)
    if (filters.search && filters.search.trim()) {
        path += `&SearchTerm=${encodeURIComponent(filters.search.trim())}`
    }
    
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyPlaybackInfo({ serverUrl, token, userId, itemId, deviceId, playSessionId }) {
    const path =
        `/Items/${encodeURIComponent(itemId || "")}/PlaybackInfo` +
        `?UserId=${encodeURIComponent(userId || "")}` +
        (deviceId ? `&DeviceId=${encodeURIComponent(deviceId)}` : "") +
        (playSessionId ? `&PlaySessionId=${encodeURIComponent(playSessionId)}` : "")
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyGetSessions({ serverUrl, token, deviceId }) {
    let path = "/Sessions"
    if (deviceId) {
        path += `?DeviceId=${encodeURIComponent(deviceId)}`
    }
    return embyFetchJson({ serverUrl, token, apiPath: path })
}

export async function embyReportPlaybackProgress({
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
    const baseUrl = buildEmbyUrl(serverUrl, '/Sessions/Playing/Progress')

    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }
    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embyPostJson

    const params = new URLSearchParams({
        'X-Emby-Client': 'Octo Player',
        'X-Emby-Device-Name': 'Octo Player',
        'X-Emby-Device-Id': deviceId || 'octo-player-1',
        'X-Emby-Client-Version': '1.0.0',
        'X-Emby-Language': 'en-us',
        'reqformat': 'json',
    })

    const url = `${baseUrl}?${params.toString()}`

    const bodyParams = new URLSearchParams()
    bodyParams.set('ItemId', String(itemId || ''))
    bodyParams.set('MediaSourceId', String(mediaSourceId || ''))
    bodyParams.set('PositionTicks', String(positionTicks || 0))
    bodyParams.set('UserId', String(userId || ''))
    bodyParams.set('PlayMethod', 'Transcode')
    bodyParams.set('PlaystateRequested', 'Playing')
    if (playSessionId) {
        bodyParams.set('PlaySessionId', String(playSessionId))
    }
    if (isPaused) {
        bodyParams.set('IsPaused', 'true')
    }

    const bodyStr = bodyParams.toString()

    try {
        if (useBridge) {
            return await window.octo.embyPostJson({ url, token: t, body: bodyStr, contentType: 'application/x-www-form-urlencoded' })
        }
        return await fetchJsonDirect({ url, token: t, method: 'POST', body: bodyStr, contentType: 'application/x-www-form-urlencoded' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}

export async function embyReportPlaybackStarted({
    serverUrl,
    token,
    userId,
    itemId,
    mediaSourceId,
    playSessionId,
    deviceId,
}) {
    const baseUrl = buildEmbyUrl(serverUrl, '/Sessions/Playing')

    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }
    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embyPostJson

    const params = new URLSearchParams({
        'X-Emby-Client': 'Octo Player',
        'X-Emby-Device-Name': 'Octo Player',
        'X-Emby-Device-Id': deviceId || 'octo-player-1',
        'X-Emby-Client-Version': '1.0.0',
        'X-Emby-Language': 'en-us',
        'reqformat': 'json',
    })

    const url = `${baseUrl}?${params.toString()}`

    const bodyParams = new URLSearchParams()
    bodyParams.set('ItemId', String(itemId || ''))
    bodyParams.set('MediaSourceId', String(mediaSourceId || ''))
    bodyParams.set('PlaySessionId', String(playSessionId || ''))
    bodyParams.set('UserId', String(userId || ''))
    bodyParams.set('PositionTicks', '0')
    bodyParams.set('PlayMethod', 'Transcode')
    bodyParams.set('PlaystateRequested', 'Playing')
    bodyParams.set('CanSeek', 'true')
    bodyParams.set('IsPaused', 'false')

    const bodyStr = bodyParams.toString()

    try {
        if (useBridge) {
            return await window.octo.embyPostJson({ url, token: t, body: bodyStr, contentType: 'application/x-www-form-urlencoded' })
        }
        return await fetchJsonDirect({ url, token: t, method: 'POST', body: bodyStr, contentType: 'application/x-www-form-urlencoded' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}

export async function embyMarkFavorite({ serverUrl, token, userId, itemId }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/FavoriteItems/${encodeURIComponent(itemId || "")}`

    const baseUrl = buildEmbyUrl(serverUrl, path)
    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }
    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embyPostJson

    try {
        if (useBridge) {
            return await window.octo.embyPostJson({ url: baseUrl, token: t, body: '', contentType: 'application/json' })
        }
        return await fetchJsonDirect({ url: baseUrl, token: t, method: 'POST', body: '{}', contentType: 'application/json' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}

export async function embyUnmarkFavorite({ serverUrl, token, userId, itemId }) {
    const path =
        `/Users/${encodeURIComponent(userId || "")}/FavoriteItems/${encodeURIComponent(itemId || "")}`

    const baseUrl = buildEmbyUrl(serverUrl, path)
    if (!baseUrl) {
        throw new Error('Server URL is empty.')
    }
    const t = String(token || '').trim()
    if (!t) {
        throw new Error('Token is empty (login first).')
    }

    const useBridge = hasOctoBridge() && window.octo.embyDeleteJson

    try {
        if (useBridge) {
            return await window.octo.embyDeleteJson({ url: baseUrl, token: t })
        }
        return await fetchJsonDirect({ url: baseUrl, token: t, method: 'DELETE' })
    } catch (err) {
        if (is401Error(err)) {
            clearConnection()
            window.dispatchEvent(new CustomEvent('emby:unauthorized'))
        }
        throw err
    }
}