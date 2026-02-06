/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

/* global URLSearchParams */
import { embyFetchJson, embyPlaybackInfo } from './emby.js'
import { storageGetItem, storageSetItem } from '../utils/storage.js'
import { makeBaseUrl, isAudioItem } from './mediaUtils.js'

function ensureDeviceId() {
    let id = storageGetItem('octoPlayer.deviceId', '')
    if (!id) {
        id =
            globalThis.crypto?.randomUUID?.() ||
            `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
        storageSetItem('octoPlayer.deviceId', id)
    }
    return id
}

function randomId() {
    return (
        globalThis.crypto?.randomUUID?.() ||
        `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`
    )
}

async function loadFirstAudioChild({ parentId, serverUrl, token, userId }) {
    if (!parentId || !serverUrl || !token || !userId) {
        return null
    }

    const path =
        `/Users/${encodeURIComponent(userId)}/Items` +
        `?ParentId=${encodeURIComponent(parentId)}` +
        `&IncludeItemTypes=Audio` +
        `&SortBy=ParentIndexNumber,IndexNumber` +
        `&Recursive=true` +
        `&Limit=1`

    try {
        const res = await embyFetchJson({
            serverUrl,
            token,
            apiPath: path,
        })
        const items = res?.Items || []
        return items[0] || null
    } catch {
        return null
    }
}

async function enrichAudioItemIfNeeded(item, { serverUrl, token, userId }) {
    if (!item?.Id || !serverUrl || !token || !userId) {
        return item
    }

    // If AlbumId is missing, we can't reliably prefer album artwork.
    if (item?.AlbumId) {
        return item
    }

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
    ].join(',')

    try {
        const detailed = await embyFetchJson({
            serverUrl,
            token,
            apiPath: `/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(item.Id)}?Fields=${encodeURIComponent(fields)}`,
        })
        return detailed || item
    } catch {
        return item
    }
}

export async function playItem(
    item,
    { serverUrl, token, userId },
    skipQueueUpdate = false,
    queueContext = null
) {
    const id = item?.Id
    if (!serverUrl || !token || !userId || !id) {
        return null
    }

    if (!isAudioItem(item)) {
        if (item?.Type === 'MusicAlbum') {
            const firstTrack = await loadFirstAudioChild({
                parentId: id,
                serverUrl,
                token,
                userId,
            })
            if (firstTrack) {
                return await playItem(
                    firstTrack,
                    { serverUrl, token, userId },
                    skipQueueUpdate,
                    queueContext
                )
            }
        }
        return null
    }

    // Some list endpoints don't include AlbumId/ImageTags; fetch full item so the UI can
    // consistently show album cover art instead of falling back to artist images.
    const enrichedItem = await enrichAudioItemIfNeeded(item, { serverUrl, token, userId })

    const base = makeBaseUrl(serverUrl)
    const deviceId = ensureDeviceId()
    const playSessionId = randomId()

    let mediaSourceId = ''
    let directPlayUrl = null
    let supportsDirectPlay = false
    let directPlayContainer = 'mp3'

    try {
        const info = await embyPlaybackInfo({
            serverUrl,
            token,
            userId,
            itemId: id,
            deviceId,
            playSessionId,
            maxBitrate: 140000000,
        })
        const ms = info?.MediaSources?.[0]
        mediaSourceId = ms?.Id || ''

        if (ms?.SupportsDirectPlay) {
            supportsDirectPlay = true
            const container = ms?.Container
            if (container) {
                directPlayContainer = container.split(',')[0]
            }
        }
    } catch { }

    const qs = new URLSearchParams({
        UserId: userId,
        DeviceId: deviceId,
        api_key: token,
        PlaySessionId: playSessionId,
    })

    if (mediaSourceId) {
        qs.set('MediaSourceId', mediaSourceId)
    }

    if (supportsDirectPlay) {
        qs.set('static', 'true')
        qs.set('Container', directPlayContainer)
        const streamUrl = `${base}/emby/Audio/${encodeURIComponent(id)}/stream?${qs.toString()}`
        directPlayUrl = streamUrl
    } else {
        qs.set('TranscodingProtocol', 'http')
        qs.set('Container', 'mp3')
        qs.set('AudioCodec', 'mp3')
        qs.set('MaxStreamingBitrate', '320000')
        qs.set('AudioBitrate', '320000')
        const streamUrl = `${base}/emby/Audio/${encodeURIComponent(id)}/universal?${qs.toString()}`
        directPlayUrl = streamUrl
    }

    return {
        item: enrichedItem,
        streamUrl: directPlayUrl,
        skipQueueUpdate,
        queueContext,
        playbackSession: {
            itemId: id,
            playSessionId,
            mediaSourceId,
            deviceId,
            supportsDirectPlay,
            sourceContainer: directPlayContainer,
        },
    }
}

export function updateQueue(currentQueue, currentTrackIndex, item, queueContext) {
    let newQueue = [...currentQueue]
    let newIndex = currentTrackIndex

    if (queueContext && Array.isArray(queueContext)) {
        newQueue = queueContext.filter(isAudioItem)
        newIndex = newQueue.findIndex((t) => t.Id === item.Id)
        if (newIndex === -1) {
            newQueue = [item, ...newQueue]
            newIndex = 0
        } else {
            // Replace the current entry with the enriched/normalized item.
            newQueue[newIndex] = item
        }
    } else {
        if (!newQueue.find((t) => t.Id === item.Id)) {
            newQueue = [...newQueue, item]
            newIndex = newQueue.length - 1
        } else {
            newIndex = newQueue.findIndex((t) => t.Id === item.Id)
            if (newIndex >= 0) {
                newQueue[newIndex] = item
            }
        }
    }

    return { queue: newQueue, index: newIndex }
}

export function getNextTrack(currentQueue, currentTrackIndex, shuffleEnabled = false) {
    if (currentQueue.length === 0) {
        return null
    }

    if (shuffleEnabled) {
        if (currentQueue.length === 1) {
            return { track: currentQueue[0], index: 0 }
        }
        let nextIndex = currentTrackIndex
        let safety = 0
        while (nextIndex === currentTrackIndex && safety < 20) {
            nextIndex = Math.floor(Math.random() * currentQueue.length)
            safety += 1
        }
        return { track: currentQueue[nextIndex], index: nextIndex }
    }

    const nextIndex = (currentTrackIndex + 1) % currentQueue.length
    return { track: currentQueue[nextIndex], index: nextIndex }
}

export function getPreviousTrack(currentQueue, currentTrackIndex, shuffleEnabled = false) {
    if (currentQueue.length === 0) {
        return null
    }

    if (shuffleEnabled) {
        if (currentQueue.length === 1) {
            return { track: currentQueue[0], index: 0 }
        }
        let prevIndex = currentTrackIndex
        let safety = 0
        while (prevIndex === currentTrackIndex && safety < 20) {
            prevIndex = Math.floor(Math.random() * currentQueue.length)
            safety += 1
        }
        return { track: currentQueue[prevIndex], index: prevIndex }
    }

    let prevIndex = currentTrackIndex - 1
    if (prevIndex < 0) {
        prevIndex = currentQueue.length - 1
    }
    return { track: currentQueue[prevIndex], index: prevIndex }
}
