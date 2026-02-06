/*
 * Octo Player
 * Copyright (c) 2026 Douwe C
 * Licensed under the MIT License.
 * See LICENSE file in the project root for full license information.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('octo', {
    embySystemInfo: (payload) => ipcRenderer.invoke('emby:systemInfo', payload),
    embyAuthenticateByName: (payload) => ipcRenderer.invoke('emby:authenticateByName', payload),
    embyFetchJson: (payload) => ipcRenderer.invoke('emby:fetchJson', payload),
    embyFetchImage: (payload) => ipcRenderer.invoke('emby:fetchImage', payload),
    embyPostJson: (payload) => ipcRenderer.invoke('emby:postJson', payload),
    embyDeleteJson: (payload) => ipcRenderer.invoke('emby:deleteJson', payload),
    windowControls: {
        minimize: () => ipcRenderer.invoke('window:minimize'),
        close: () => ipcRenderer.invoke('window:close')
    }
})
