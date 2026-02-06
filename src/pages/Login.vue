<template>
  <div class="container">
    <div class="header">
      <img src="../assets/logo.svg" alt="Octo Player" class="logo" />
      <div class="app-name">Octo</div>
    </div>

    <div class="card">
      <div class="grid">
        <div class="field">
          <label for="serverUrl">Server URL</label>
          <input
            id="serverUrl"
            placeholder="http://localhost:8096"
            v-model="serverUrl"
            :disabled="busy"
          />
        </div>

        <div class="field">
          <label for="username">Username</label>
          <input
            id="username"
            placeholder="Your username"
            v-model="username"
            :disabled="busy"
          />
          <div class="checkbox-field-inline">
            <label>
              <input
                type="checkbox"
                v-model="rememberMe"
                :disabled="busy"
              />
              <span>Remember server and username</span>
            </label>
          </div>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Your password"
            v-model="password"
            @keydown.enter="doLogin"
            :disabled="busy"
          />
          <div class="small">
            Password is not stored — only the access token.
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="primary" @click="doLogin" :disabled="busy">Login</button>
        <button @click="doClear" :disabled="busy">Clear</button>
      </div>

      <div class="status" :class="statusKind">{{ status }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { embyLogin, embySystemInfo, saveConnection, clearConnection, loadConnection } from '../services/emby.js'
import { useSessionStore } from '../stores/session.js'
import { storageGetItem, storageRemoveItem, storageSetItem } from '../utils/storage.js'

const router = useRouter()
const session = useSessionStore()
session.hydrate()

const remembered = JSON.parse(storageGetItem('octoPlayer.rememberedLogin', '{}') || '{}')

const serverUrl = ref(session.serverUrl || remembered.serverUrl || '')
const username = ref(session.userName || remembered.username || '')
const password = ref('')
const rememberMe = ref(!!(remembered.serverUrl || remembered.username))
const status = ref(session.token ? 'Token saved (you can re-login anytime).' : 'Not connected yet.')
const statusKind = ref('')
const busy = ref(false)

async function doLogin() {
  status.value = 'Logging in…'
  statusKind.value = ''
  busy.value = true

  try {
    const auth = await embyLogin({
      serverUrl: serverUrl.value,
      username: username.value,
      password: password.value
    })

    const connectionData = {
      serverUrl: serverUrl.value,
      token: auth.AccessToken,
      userId: auth?.User?.Id,
      userName: auth?.User?.Name || username.value
    }

    session.set(connectionData)
    saveConnection(connectionData)

    if (rememberMe.value) {
      storageSetItem('octoPlayer.rememberedLogin', JSON.stringify({
        serverUrl: serverUrl.value,
        username: username.value
      }))
    } else {
      storageRemoveItem('octoPlayer.rememberedLogin')
    }

    const info = await embySystemInfo({
      serverUrl: serverUrl.value,
      token: auth.AccessToken
    })

    const name = info?.ServerName || 'Emby'
    const version = info?.Version ? `v${info.Version}` : ''
    status.value = `Connected to ${name} ${version}`
    statusKind.value = 'ok'
    password.value = ''

    router.push('/')
  } catch (err) {
    status.value = err?.message || String(err)
    statusKind.value = 'err'
  } finally {
    busy.value = false
  }
}

function doClear() {
  session.clear()
  clearConnection()
  storageRemoveItem('octoPlayer.rememberedLogin')
  const c = loadConnection()
  serverUrl.value = c.serverUrl || ''
  username.value = c.userName || ''
  password.value = ''
  rememberMe.value = false
  status.value = c.token ? 'Token saved (you can re-login anytime).' : 'Not connected yet.'
  statusKind.value = ''
}
</script>

<style scoped>
.container {
  width: 100%;
  max-width: 420px;
  padding: 88px 24px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  z-index: 1;
}

.header {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  margin-bottom: 26px;
}

.logo {
  display: block;
  height: 56px;
  width: auto;
  opacity: 0.95;
  -webkit-app-region: no-drag;
}

.app-name {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: rgba(255, 255, 255, 0.9);
}

.card {
  width: 100%;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.field {
  width: 100%;
}

.checkbox-field input[type="checkbox"],
.checkbox-field-inline input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  margin: 6px 6px 0 0;
  flex-shrink: 0;
  accent-color: rgb(var(--accent-r), var(--accent-g), var(--accent-b));
}

.checkbox-field span,
.checkbox-field-inline span {
  font-size: 12px;
  opacity: 0.7;
  line-height: 1.5;
  position: relative;
  top: -4px;
}

.checkbox-field-inline {
  margin-top: 6px;
}

.field label {
  display: block;
  font-size: 12px;
  opacity: 0.55;
  margin-bottom: 6px;
  text-align: left;
}

.field input {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.92);
}

.field input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.field input:focus {
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 26px;
  flex-wrap: wrap;
}

.status {
  margin-top: 20px;
  font-size: 12px;
  opacity: 0.6;
  text-align: center;
}

.small {
  font-size: 12px;
  opacity: 0.45;
  margin-top: 8px;
  line-height: 1.4;
  text-align: center;
}
</style>
