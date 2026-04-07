/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { defineStore } from 'pinia'
import { storageGetItem, storageRemoveItem, storageSetItem } from '../utils/storage.js'

const TYPE_KEY = 'octoPlayer.session.type'

function prefixFor(type) {
    return type === 'jellyfin' ? 'octoPlayer.jellyfin.' : 'octoPlayer.emby.'
}

function readType() {
    const t = storageGetItem(TYPE_KEY, 'emby') || 'emby'
    return t === 'jellyfin' ? 'jellyfin' : 'emby'
}

function read(key, def = '', type) {
    return storageGetItem(prefixFor(type) + key, def) || def
}

function write(key, val, type) {
    storageSetItem(prefixFor(type) + key, val ?? '')
}

function remove(key, type) {
    storageRemoveItem(prefixFor(type) + key)
}

export const useSessionStore = defineStore('session', {
    state: () => ({
        serverType: 'emby',
        serverUrl: '',
        token: '',
        userId: '',
        userName: '',
    }),
    actions: {
        hydrate() {
            const type = readType()
            this.serverType = type
            this.serverUrl = read('serverUrl', '', type)
            this.token = read('token', '', type)
            this.userId = read('userId', '', type)
            this.userName = read('userName', '', type)
            return this
        },
        set({ serverType, serverUrl, token, userId, userName }) {
            const type = (serverType === 'jellyfin' || serverType === 'emby') ? serverType : (this.serverType || 'emby')
            this.serverType = type
            this.serverUrl = serverUrl || ''
            this.token = token || ''
            this.userId = userId || ''
            this.userName = userName || ''
            storageSetItem(TYPE_KEY, type)
            write('serverUrl', this.serverUrl, type)
            write('token', this.token, type)
            if (this.userId) {
                write('userId', this.userId, type)
            } else {
                remove('userId', type)
            }
            if (this.userName) {
                write('userName', this.userName, type)
            } else {
                remove('userName', type)
            }
        },
        clear() {
            const type = this.serverType || 'emby'
            this.serverType = 'emby'
            this.serverUrl = ''
            this.token = ''
            this.userId = ''
            this.userName = ''
            storageRemoveItem(TYPE_KEY)
            remove('serverUrl', type)
            remove('token', type)
            remove('userId', type)
            remove('userName', type)
        },
        isAuthed() {
            return !!(this.serverUrl && this.token)
        },
    },
})
