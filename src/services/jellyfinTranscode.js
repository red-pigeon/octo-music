/* global URL */
export function rewriteJellyfinStreamUrl(streamUrl, settings, context = {}) {
    if (!streamUrl || !settings) {
        return streamUrl
    }

    const { transcodeEnabled, bitrateKbps } = settings
    const { userId, deviceId, playSessionId, mediaSourceId, apiKey } = context

    let urlObj
    try {
        urlObj = new URL(streamUrl)
    } catch {
        return streamUrl
    }

    const params = urlObj.searchParams
    const isDirectPlay = params.get('static') === 'true'

    const stripTranscodeParams = () => {
        [
            'TranscodingProtocol',
            'transcodingProtocol',
            'TranscodingContainer',
            'transcodingContainer',
            'SegmentContainer',
            'AudioCodec',
            'audioCodec',
            'MaxStreamingBitrate',
            'maxStreamingBitrate',
            'AudioBitrate',
            'audioBitrate',
            'CopyTimestamps',
            'MinSegments',
            'MaxAudioChannels',
        ].forEach((key) => params.delete(key))
    }

    const stripDirectPlayParams = () => {
        ['static', 'container', 'Container', 'audioCodec', 'AudioCodec'].forEach((key) =>
            params.delete(key)
        )
    }

    const ensureAuthParam = () => {
        if (apiKey) {
            params.set('api_key', apiKey)
        }
    }

    if (!transcodeEnabled || (isDirectPlay && !transcodeEnabled)) {
        stripTranscodeParams()
        if (isDirectPlay) {
            params.set('static', 'true')
        }
        ensureAuthParam()
        urlObj.search = params.toString()
        return urlObj.toString()
    }

    stripDirectPlayParams()
    stripTranscodeParams()

    params.set('TranscodingProtocol', 'http')
    params.set('Container', 'mp3')
    params.set('AudioCodec', 'mp3')
    params.delete('TranscodingContainer')
    params.delete('SegmentContainer')
    if (!params.get('StartTimeTicks')) {
        params.set('StartTimeTicks', '0')
    }
    params.set('MinSegments', '1')
    params.set('MaxAudioChannels', '2')
    params.set('CopyTimestamps', 'true')

    if (userId) {
        params.set('UserId', userId)
    }
    if (deviceId) {
        params.set('DeviceId', deviceId)
    }
    if (playSessionId) {
        params.set('PlaySessionId', playSessionId)
    }
    if (mediaSourceId) {
        params.set('MediaSourceId', mediaSourceId)
    }
    ensureAuthParam()

    if (bitrateKbps && Number.isFinite(bitrateKbps)) {
        const maxBitsPerSec = Math.max(1, Math.round(bitrateKbps * 1000))
        params.set('MaxStreamingBitrate', String(maxBitsPerSec))
        params.set('AudioBitrate', String(maxBitsPerSec))
    }

    urlObj.search = params.toString()
    return urlObj.toString()
}
