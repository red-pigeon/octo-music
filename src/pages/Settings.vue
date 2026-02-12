<template>
  <div class="settings-page">
    <BackgroundGradient :coverUrl="currentCoverUrl" />

    <div class="settings-layout">
      <div class="controls-row">
        <div class="pageTitle">Settings</div>
      </div>

      <div class="settings-content">
        <div class="sections">
          <div class="section sectionUnified">
            <div class="sectionHeader">User Interface</div>
            
            <div class="sectionGroup">
              <div class="row">
                <div class="row-left">
                  <div class="row-label">Accent color</div>
                  <div class="row-desc">Choose a theme color for buttons, controls, and highlights throughout the app.</div>
                </div>
                <div class="row-right">
                  <div class="color-picker">
                    <button
                      v-for="(color, key) in accentColors"
                      :key="key"
                      type="button"
                      class="color-swatch"
                      :class="{ active: settingsStore.accentColor === key }"
                      :style="{ '--swatch-color': `rgb(${color.r}, ${color.g}, ${color.b})` }"
                      :title="color.label"
                      :aria-label="`Set accent color to ${color.label}`"
                      @click="settingsStore.setAccentColor(key)"
                    >
                      <svg v-if="settingsStore.accentColor === key" class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              <div class="row">
                <div class="row-left">
                  <div class="row-label">Auto-scroll to playing track</div>
                  <div class="row-desc">When opening an album, playlist, or songs page, automatically scroll to the currently playing track.</div>
                </div>
                <div class="row-right">
                  <label class="eqLikeToggle" :class="{ active: autoScroll, disabled: busy }">
                    <input
                      type="checkbox"
                      v-model="autoScroll"
                      :disabled="busy"
                      aria-label="Auto-scroll to playing track"
                    />
                    <span class="toggleLabel">{{ autoScroll ? 'Enabled' : 'Disabled' }}</span>
                  </label>
                </div>
              </div>

              <div class="row">
                <div class="row-left">
                  <div class="row-label">Send to tray on close</div>
                  <div class="row-desc">When enabled, clicking close hides the app to the system tray instead of quitting.</div>
                </div>
                <div class="row-right">
                  <label class="eqLikeToggle" :class="{ active: closeToTray, disabled: busy }">
                    <input
                      type="checkbox"
                      v-model="closeToTray"
                      :disabled="busy"
                      aria-label="Send to tray on close"
                    />
                    <span class="toggleLabel">{{ closeToTray ? 'Enabled' : 'Disabled' }}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="section sectionUnified">
            <div class="sectionHeader">Account</div>
            
            <div class="sectionGroup">
              <div class="row">
                <div class="row-left">
                  <div class="row-label">Clear cache</div>
                  <div class="row-desc">Remove cached settings, playback history, and EQ presets. Your login will be preserved.</div>
                </div>
                <div class="row-right">
                  <button type="button" class="eqLikeButton purple" @click="doClearCache" :disabled="busy">Clear</button>
                </div>
              </div>

              <div class="row">
                <div class="row-left">
                  <div class="row-label">Logout</div>
                  <div class="row-desc">Sign out of this device. Your token will be cleared.</div>
                </div>
                <div class="row-right">
                  <button type="button" class="eqLikeButton purple" @click="doLogout" :disabled="busy">Logout</button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="status err">{{ error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../stores/session.js'
import { useSettingsStore, accentColors } from '../stores/settings.js'
import { clearConnection } from '../services/emby.js'
import BackgroundGradient from '../components/BackgroundGradient.vue'
import { storageRemoveItem } from '../utils/storage.js'

const router = useRouter()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()

sessionStore.hydrate()
settingsStore.hydrate()

const busy = ref(false)
const error = ref('')
const currentCoverUrl = ref(null)

const closeToTray = computed({
  get: () => settingsStore.closeBehavior !== 'close',
  set: (v) => settingsStore.setCloseBehavior(v ? 'tray' : 'close')
})

const autoScroll = computed({
  get: () => settingsStore.autoScrollToPlayingTrack !== false,
  set: (v) => settingsStore.setAutoScrollToPlayingTrack(v)
})

watch(
  () => settingsStore.closeBehavior,
  async (v) => {
    try {
      await window.octo?.settings?.setCloseBehavior?.(v)
      error.value = ''
    } catch (err) {
      error.value = err?.message || String(err)
    }
  },
  { immediate: true }
)

async function doLogout() {
  busy.value = true
  error.value = ''
  try {
    sessionStore.clear()
    clearConnection()
    await router.push('/login')
  } finally {
    busy.value = false
  }
}

async function doClearCache() {
  busy.value = true
  error.value = ''
  try {
    const keysToPreserve = [
      'octoPlayer.emby.serverUrl',
      'octoPlayer.emby.token',
      'octoPlayer.emby.userId',
      'octoPlayer.emby.userName',
      'octoPlayer.rememberedLogin'
    ]

    // Best-effort: clear known cached keys from whichever backend is active.
    const knownKeys = [
      'octoPlayer.settings',
      'octoPlayerEQ',
      'octoPlayerShuffle',
      'octoPlayer.deviceId'
    ]

    for (const k of knownKeys) {
      if (!keysToPreserve.includes(k)) storageRemoveItem(k)
    }
    
    settingsStore.hydrate()
  } catch (err) {
    error.value = err?.message || String(err)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.settings-page {
  position: absolute;
  inset: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  z-index: 1;
  overflow-y: auto;
}

.settings-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  position: relative;
}

.controls-row {
  position: fixed;
  top: 66px;
  z-index: 5;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 16px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
  padding: 0 56px;
  left: 0;
  right: 0;
}

.pageTitle {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2px;
  opacity: 0.9;
  color: rgba(255, 255, 255, 0.92);
}

.settings-content {
  padding-left: 56px;
  padding-right: 56px;
  padding-top: 126px;
  padding-bottom: 160px;
  width: 100%;
  max-width: 1096px;
  margin: 0 auto;
}

.sections {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (max-width: 720px) {
  .controls-row {
    top: 48px;
    padding: 0 16px;
  }

  .settings-content {
    padding-left: 16px;
    padding-right: 16px;
    padding-top: 110px;
    max-width: calc(100% - 32px);
  }
}

.section {
  width: 100%;
  background: rgba(8, 7, 12, 0.32);
  backdrop-filter: blur(14px) saturate(1.05);
  -webkit-backdrop-filter: blur(14px) saturate(1.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
}

.sectionUnified {
  padding: 0;
}

.sectionHeader {
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  padding: 16px 16px 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sectionGroup {
  width: 100%;
}

.row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  padding: 14px 16px 14px 16px;
  align-items: center;
}

.row-left {
  min-width: 0;
}

.row-label {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.row-desc {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.4;
}

.row-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}


.eqLikeToggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #fff;
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 7px 12px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, color 0.12s ease;
}

.eqLikeToggle input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.eqLikeToggle:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.eqLikeToggle.active {
  background: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.18);
  border-color: rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.6);
  color: #fff;
  box-shadow: 0 6px 16px rgba(var(--accent-r), var(--accent-g), var(--accent-b), 0.25);
}

.eqLikeToggle input:focus-visible + .toggleLabel {
  outline: 2px solid rgba(255, 255, 255, 0.9);
  outline-offset: 2px;
  border-radius: 8px;
}

.eqLikeToggle.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggleLabel {
  letter-spacing: 0.1px;
}

button {
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.88);
}

button:hover {
  background: rgba(255, 255, 255, 0.12);
}

button.primary {
  background: rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 0.9);
  color: rgba(0, 0, 0, 0.9);
}

button.primary:hover {
  background: rgba(var(--accent-light-r), var(--accent-light-g), var(--accent-light-b), 1);
}

button.eqLikeButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #fff;
  position: relative;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 7px 12px;
  cursor: pointer;
  user-select: none;
  transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease, color 0.12s ease;
}

button.eqLikeButton:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

button.eqLikeButton:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.9);
  outline-offset: 2px;
}

button.eqLikeButton.purple {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

button.eqLikeButton.purple:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

button.eqLikeButton.danger {
  background: rgba(255, 80, 80, 0.16);
  border-color: rgba(255, 80, 80, 0.55);
  box-shadow: 0 6px 16px rgba(255, 80, 80, 0.18);
}

button.eqLikeButton.danger:hover:not(:disabled) {
  background: rgba(255, 80, 80, 0.22);
  border-color: rgba(255, 80, 80, 0.7);
  box-shadow: 0 6px 16px rgba(255, 80, 80, 0.22);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status {
  margin-top: 2px;
  font-size: 12px;
  opacity: 0.7;
}

.status.err {
  color: rgba(255, 160, 160, 0.9);
}

.color-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  background: var(--swatch-color);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
  position: relative;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.color-swatch.active {
  border-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2), 0 4px 12px rgba(0, 0, 0, 0.3);
  transform: scale(1.1);
}

.color-swatch:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.9);
  outline-offset: 2px;
}

.check-icon {
  width: 14px;
  height: 14px;
  color: rgba(255, 255, 255, 0.95);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}
</style>
