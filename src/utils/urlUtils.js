import { URL } from 'url'

export function buildBareStreamUrl(url) {
    if (!url) { return null }
    try {
        const u = new URL(url)
        const params = u.searchParams
        const isDirectPlay = params.get('static') === 'true'

            ;[
                'MaxStreamingBitrate',
                'maxStreamingBitrate',
                'AudioBitrate',
                'audioBitrate',
                'AudioCodec',
                'audioCodec',
                'Container',
                'container',
                'TranscodingProtocol',
                'transcodingProtocol',
                'TranscodingContainer',
                'transcodingContainer',
                'SegmentContainer',
                'StartTimeTicks',
                'MinSegments',
                'MaxAudioChannels',
                'CopyTimestamps',
            ].forEach((k) => params.delete(k))

        if (isDirectPlay) {
            params.set('static', 'true')
        }

        u.search = params.toString()
        return u.toString()
    } catch {
        return null
    }
}

export function isDirectPlayUrl(url) {
    if (!url) { return false }
    try {
        const u = new URL(url)
        return u.searchParams.get('static') === 'true'
    } catch {
        return false
    }
}
