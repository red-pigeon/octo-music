import { computed, ref, watch } from 'vue'
import { resolveEmbyImageSrc, buildEmbyItemImageSrcFromImageInfo } from '../utils/embyImageUtils.js'

function unwrapWatchedValue(value) {
    return Array.isArray(value) ? value[0] : value
}

/**
 * Shared cover-url handling for Emby/Jellyfin imageInfo objects.
 *
 * Preserves the existing behavior pattern used across components:
 * - derive a display URL from `coverUrl` via `resolveEmbyImageSrc`
 * - on <img> error: try artist Primary image once, then fall back to `defaultCover`
 *
 * @param {object} options
 * @param {() => any} options.watchSource Getter passed to `watch(...)` (can be `() => coverUrl` or `() => [coverUrl, otherDeps]`).
 * @param {() => any} [options.getFallbackImageInfo] Getter returning the imageInfo to use for artist fallback building.
 * @param {string} options.defaultCover URL for the default cover
 * @param {() => (string|null|undefined)} options.getArtistId Getter returning the artist id used for fallback
 * @param {(url: string) => void} [options.onResolvedUrl] Called when a non-empty URL is resolved/set
 * @param {string} [options.fallbackKind] Emby image kind for artist fallback
 */
export function useEmbyCoverImage({
    watchSource,
    getFallbackImageInfo,
    defaultCover,
    getArtistId,
    getAlbumId,
    onResolvedUrl,
    fallbackKind = 'Primary',
    fallbackToArtist = true,
}) {
    const coverImageUrl = ref('')
    const triedArtistFallback = ref(false)
    const albumFallbackStep = ref(0)

    const displayCover = computed(() => coverImageUrl.value || defaultCover)

    function setFromImageInfo(imageInfo) {
        triedArtistFallback.value = false
        albumFallbackStep.value = 0

        if (!imageInfo) {
            coverImageUrl.value = ''
            return
        }

        const imageUrl = resolveEmbyImageSrc(imageInfo)
        coverImageUrl.value = imageUrl
        if (imageUrl && typeof onResolvedUrl === 'function') {
            onResolvedUrl(imageUrl)
        }
    }

    function handleCoverError() {
        const imageInfo = getFallbackImageInfo ? getFallbackImageInfo() : unwrapWatchedValue(watchSource())

        // Album art fallback
        const albumId = getAlbumId?.()
        if (albumId && albumFallbackStep.value < 3) {
            const kind = albumFallbackStep.value === 0
                ? 'Primary'
                : albumFallbackStep.value === 1
                    ? 'Thumb'
                    : 'Backdrop'
            albumFallbackStep.value += 1
            const fallback = buildEmbyItemImageSrcFromImageInfo(imageInfo, albumId, kind)
            if (fallback) {
                coverImageUrl.value = fallback
                if (typeof onResolvedUrl === 'function') {
                    onResolvedUrl(coverImageUrl.value)
                }
                return
            }
        }

        // Artist fallback
        if (fallbackToArtist && !triedArtistFallback.value) {
            const artistId = getArtistId?.()
            if (artistId) {
                const fallback = buildEmbyItemImageSrcFromImageInfo(imageInfo, artistId, fallbackKind)
                triedArtistFallback.value = true
                coverImageUrl.value = fallback || defaultCover
                if (coverImageUrl.value && coverImageUrl.value !== defaultCover) {
                    if (typeof onResolvedUrl === 'function') {
                        onResolvedUrl(coverImageUrl.value)
                    }
                    return
                }
            }
        }

        coverImageUrl.value = defaultCover
    }

    watch(
        watchSource,
        (watchedValue) => {
            setFromImageInfo(unwrapWatchedValue(watchedValue))
        },
        { immediate: true }
    )

    return {
        coverImageUrl,
        displayCover,
        triedArtistFallback,
        handleCoverError,
        setFromImageInfo,
    }
}

/**
 * Small wrapper to keep Player code consistent with other cover helpers.
 */
export function buildArtistPrimaryFallbackSrc(imageInfo, artistId) {
    return buildEmbyItemImageSrcFromImageInfo(imageInfo, artistId, 'Primary')
}
