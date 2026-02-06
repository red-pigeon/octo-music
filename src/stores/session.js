/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { defineStore } from 'pinia'
import { storageGetItem, storageRemoveItem, storageSetItem } from '../utils/storage.js'

const KEY_PREFIX = 'octoPlayer.emby.'

function read(key, def = '') {
    return storageGetItem(KEY_PREFIX + key, def) || def
}

function write(key, val) {
    storageSetItem(KEY_PREFIX + key, val ?? '')
}

function remove(key) {
    storageRemoveItem(KEY_PREFIX + key)
}

export const useSessionStore = defineStore('session', {
    state: () => ({
        serverUrl: '',
        token: '',
        userId: '',
        userName: '',
    }),
    actions: {
        hydrate() {
            this.serverUrl = read('serverUrl')
            this.token = read('token')
            this.userId = read('userId')
            this.userName = read('userName')
            return this
        },
        set({ serverUrl, token, userId, userName }) {
            this.serverUrl = serverUrl || ''
            this.token = token || ''
            this.userId = userId || ''
            this.userName = userName || ''
            write('serverUrl', this.serverUrl)
            write('token', this.token)
            if (this.userId) {
                write('userId', this.userId)
            } else {
                remove('userId')
            }
            if (this.userName) {
                write('userName', this.userName)
            } else {
                remove('userName')
            }
        },
        clear() {
            this.serverUrl = ''
            this.token = ''
            this.userId = ''
            this.userName = ''
            remove('serverUrl')
            remove('token')
            remove('userId')
            remove('userName')
        },
        isAuthed() {
            return !!(this.serverUrl && this.token)
        },
    },
})
