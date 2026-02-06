/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { defineStore } from 'pinia'
import { storageGetItem, storageSetItem } from '../utils/storage.js'

const KEY = 'octoPlayer.settings'

// Curated accent palette
export const accentColors = {
    electricBlue: { r: 59, g: 130, b: 246, label: 'Electric Blue' },
    brightOrange: { r: 249, g: 115, b: 22, label: 'Bright Orange' },
    energeticGreen: { r: 34, g: 197, b: 94, label: 'Energetic Green' },
    richPurple: { r: 120, g: 90, b: 255, label: 'Rich Purple' },
}

const defaults = { transcodeEnabled: false, bitrateKbps: 320, format: 'mp3', closeBehavior: 'close', autoScrollToPlayingTrack: true, accentColor: 'richPurple' }

function toPersisted(v) {
    const s = v || {}
    return {
        transcodeEnabled: !!s.transcodeEnabled,
        bitrateKbps: Number.isFinite(Number(s.bitrateKbps)) ? Number(s.bitrateKbps) : defaults.bitrateKbps,
        format: String(s.format || defaults.format),
        closeBehavior: (s.closeBehavior === 'tray' || s.closeBehavior === 'close') ? s.closeBehavior : defaults.closeBehavior,
        autoScrollToPlayingTrack: s.autoScrollToPlayingTrack !== false,
        accentColor: accentColors[s.accentColor] ? s.accentColor : defaults.accentColor,
    }
}

function load() {
    try {
        const raw = storageGetItem(KEY, null)
        const parsed = raw ? JSON.parse(raw) : {}
        return { ...defaults, ...toPersisted(parsed) }
    } catch {
        return { ...defaults }
    }
}

function applyAccentColor(colorKey) {
    const color = accentColors[colorKey] || accentColors.richPurple
    const { r, g, b } = color
    const lr = Math.min(255, r + 43)
    const lg = Math.min(255, g + 53)
    const lb = Math.min(255, b + 0)
    document.documentElement.style.setProperty('--accent-r', r)
    document.documentElement.style.setProperty('--accent-g', g)
    document.documentElement.style.setProperty('--accent-b', b)
    document.documentElement.style.setProperty('--accent-light-r', lr)
    document.documentElement.style.setProperty('--accent-light-g', lg)
    document.documentElement.style.setProperty('--accent-light-b', lb)
}

function save(v) {
    try {
        storageSetItem(KEY, JSON.stringify(toPersisted(v)))
    } catch { }
}

export const useSettingsStore = defineStore('settings', {
    state: () => ({ ...load() }),
    actions: {
        hydrate() {
            Object.assign(this, load())
            applyAccentColor(this.accentColor)
            return this
        },
        update(p) {
            Object.assign(this, p || {})
            save(this)
        },
        setCloseBehavior(v) {
            this.closeBehavior = (v === 'close' || v === 'tray') ? v : defaults.closeBehavior
            save(this)
        },
        setTranscodeEnabled(v) {
            this.transcodeEnabled = v
            save(this)
        },
        setBitrateKbps(v) {
            this.bitrateKbps = v
            save(this)
        },
        setFormat(v) {
            this.format = v
            save(this)
        },
        setAutoScrollToPlayingTrack(v) {
            this.autoScrollToPlayingTrack = !!v
            save(this)
        },
        setAccentColor(v) {
            this.accentColor = accentColors[v] ? v : defaults.accentColor
            applyAccentColor(this.accentColor)
            save(this)
        },
    },
})
