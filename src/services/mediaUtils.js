export function makeBaseUrl(serverUrl) {
    let s = String(serverUrl || '')
        .trim()
        .replace(/\/+$/, '')
    if (s.toLowerCase().endsWith('/emby')) {
        s = s.slice(0, -5)
    }
    if (!/^https?:\/\//i.test(s)) {
        s = `http://${s}`
    }
    return s
}

export const TRACK_FIELDS = 'PrimaryImageAspectRatio,ImageTags,PrimaryImageItemId,PrimaryImageTag,AlbumId,AlbumPrimaryImageTag,ArtistItems,Artists,AlbumArtist,RunTimeTicks,UserData'

export const TRACK_FIELDS_WITH_DATE = `${TRACK_FIELDS},DateCreated`

export function getArtistFromItem(item) {
    return item?.ArtistItems?.[0]?.Name || item?.Artists?.[0] || item?.AlbumArtist || ''
}

export function isAudioItem(item) {
    const t = item?.Type
    const media = item?.MediaType
    return t === 'Audio' || media === 'Audio' || item?.IsAudio === true
}

export function coverUrlFor(item, session) {
    const s = session || {}
    const { serverUrl, token } = s
    const base = makeBaseUrl(serverUrl)
    if (!base || !token || !item?.Id) {
        return ''
    }

    let itemId = item.Id
    let tag = item?.ImageTags?.Primary || item?.ImageTags?.Thumb || ''
    let kind = item?.ImageTags?.Primary ? 'Primary' : item?.ImageTags?.Thumb ? 'Thumb' : ''

    // Artists: use Backdrop
    if (item?.Type === 'MusicArtist' && item?.BackdropImageTags?.[0]) {
        tag = item.BackdropImageTags[0]
        kind = 'Backdrop'
    }

    if (!kind && item?.Type === 'MusicAlbum' && item?.PrimaryImageItemId && item?.PrimaryImageTag) {
        itemId = item.PrimaryImageItemId
        tag = item.PrimaryImageTag
        kind = 'Primary'
    }

    // Tracks: use referenced album art
    if (!kind && isAudioItem(item) && item?.PrimaryImageItemId && item?.PrimaryImageTag) {
        itemId = item.PrimaryImageItemId
        tag = item.PrimaryImageTag
        kind = 'Primary'
    }

    if (!kind && item?.AlbumPrimaryImageTag && item?.AlbumId) {
        itemId = item.AlbumId
        tag = item.AlbumPrimaryImageTag
        kind = 'Primary'
    }

    // Artist fallback (tag optional)
    if (!kind) {
        const artistItem = (Array.isArray(item.ArtistItems) && item.ArtistItems[0]) || null
        if (artistItem?.Id) {
            const artistImageTags = artistItem.ImageTags || null
            const artistPrimaryTag = artistImageTags?.Primary || ''
            const artistThumbTag = artistImageTags?.Thumb || ''

            itemId = artistItem.Id
            kind = 'Primary'
            tag = artistPrimaryTag || artistThumbTag || ''
        }
    }

    if (!kind) {
        return ''
    }

    const imageUrl =
        `${base}/emby/Items/${encodeURIComponent(itemId)}/Images/${kind}?quality=80` +
        (tag ? `&tag=${encodeURIComponent(tag)}` : '')
    return {
        url: imageUrl,
        token: token,
    }
}

export async function loadImageAsDataUrl(imageInfo) {
    if (!imageInfo || !imageInfo.url) {
        return ''
    }

    try {
        const result = await window.octo.embyFetchImage({
            url: imageInfo.url,
            token: imageInfo.token,
        })
        return `data:${result.contentType};base64,${result.buffer}`
    } catch {
        return ''
    }
}
