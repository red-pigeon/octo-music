import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useAudioDeviceMonitor({
  nowPlaying,
  audioEl,
  refreshAudioOutputDevice,
  forceRemountAudioElement,
}) {
  let audioDeviceChangeHandler = null
  let audioDevicePollTimer = null
  let audioDeviceRemountTimer = null
  let lastAudioDeviceSignature = ''

  onMounted(() => {
    try {
      const md = navigator?.mediaDevices
      if (!md) return

      audioDeviceChangeHandler = () => {
        if (!nowPlaying.value) return

        refreshAudioOutputDevice().catch?.(() => {})

        if (audioDeviceRemountTimer) clearTimeout(audioDeviceRemountTimer)
        audioDeviceRemountTimer = setTimeout(() => {
          audioDeviceRemountTimer = null
          forceRemountAudioElement('devicechange')
        }, 250)
      }

      if (typeof md.addEventListener === 'function') {
        md.addEventListener('devicechange', audioDeviceChangeHandler)
      } else {
        md.ondevicechange = audioDeviceChangeHandler
      }

      if (typeof md.enumerateDevices === 'function') {
        audioDevicePollTimer = setInterval(async () => {
          try {
            if (!nowPlaying.value) return
            const el = audioEl.value
            if (!el || el.paused) return

            const devices = await md.enumerateDevices()
            const outputs = (devices || []).filter((d) => d?.kind === 'audiooutput')
            const signature = outputs.map((d) => String(d?.deviceId || '')).join('|')
            if (!signature) return

            if (lastAudioDeviceSignature && signature !== lastAudioDeviceSignature) {
              refreshAudioOutputDevice().catch?.(() => {})
              forceRemountAudioElement('devicechange-poll')
            }

            lastAudioDeviceSignature = signature
          } catch {}
        }, 2000)
      }
    } catch {}
  })

  onBeforeUnmount(() => {
    if (audioDeviceRemountTimer) {
      clearTimeout(audioDeviceRemountTimer)
      audioDeviceRemountTimer = null
    }

    if (audioDevicePollTimer) {
      clearInterval(audioDevicePollTimer)
      audioDevicePollTimer = null
    }
    lastAudioDeviceSignature = ''

    try {
      const md = navigator?.mediaDevices
      if (md && audioDeviceChangeHandler) {
        if (typeof md.removeEventListener === 'function') {
          md.removeEventListener('devicechange', audioDeviceChangeHandler)
        } else if (md.ondevicechange === audioDeviceChangeHandler) {
          md.ondevicechange = null
        }
      }
    } catch {}
  })
}
