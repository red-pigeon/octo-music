const { contextBridge, ipcRenderer } = require('electron')

// Help diagnose blank-screen issues in packaged builds.
try {
    ipcRenderer.send('octo:preload-ready', {
        href: typeof location !== 'undefined' ? location.href : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    })
} catch {
    // ignore
}

try {
    window.addEventListener('error', (e) => {
        try {
            ipcRenderer.send('octo:renderer-error', {
                message: e?.message,
                filename: e?.filename,
                lineno: e?.lineno,
                colno: e?.colno
            })
        } catch { }
    })

    window.addEventListener('unhandledrejection', (e) => {
        try {
            const reason = e?.reason
            ipcRenderer.send('octo:renderer-unhandledrejection', {
                message: reason?.message || String(reason)
            })
        } catch { }
    })
} catch {
    // ignore
}

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
    },
    settings: {
        setCloseBehavior: (behavior) => ipcRenderer.invoke('settings:setCloseBehavior', behavior)
    },
    storage: {
        // Synchronous by design so the renderer can hydrate stores during startup.
        // Backed by a main-process JSON file in app.getPath('userData').
        getItem: (key) => ipcRenderer.sendSync('storage:getSync', String(key)),
        setItem: (key, value) => ipcRenderer.sendSync('storage:setSync', String(key), String(value ?? '')),
        removeItem: (key) => ipcRenderer.sendSync('storage:removeSync', String(key))
    }
})
