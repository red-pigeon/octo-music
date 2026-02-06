import { TRACK_FIELDS } from '../services/mediaUtils.js'

export function useAlbumQuickPlay({
    sessionStore,
    ensureUserId,
    handlePlayItem,
    currentCoverUrl,
    embyFetchJson,
    isAudioItem,
    coverUrlFor,
    playbackStore,
}) {
    const images = '&EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1'

    const quickPlayAlbum = async (e, lastState) => {
        const album = e?.album || e
        if (!album?.Id) {
            return lastState
        }

        const now = Date.now()
        if (lastState?.id === album.Id && now - (lastState?.ts || 0) < 1500) {
            return lastState
        }
        const nextState = { id: album.Id, ts: now }

        try {
            const { serverUrl, token, userId } = (await ensureUserId()) || {}
            if (!serverUrl || !token || !userId) {
                return nextState
            }

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
                    images
            })

            const tracks = (tracksRes?.Items || []).filter(isAudioItem)
            if (tracks.length === 0) {
                return nextState
            }

            let selectedTrack = tracks[0]
            if (playbackStore?.shuffleEnabled && tracks.length > 1) {
                const randomIndex = Math.floor(Math.random() * tracks.length)
                selectedTrack = tracks[randomIndex]
            }

            await handlePlayItem(selectedTrack, false, tracks, { type: 'album', id: album.Id })
            currentCoverUrl.value = coverUrlFor(selectedTrack, sessionStore) || null
        } catch { }

        return nextState
    }

    return { quickPlayAlbum }
}
