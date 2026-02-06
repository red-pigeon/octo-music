import { embyFetchJson } from './emby.js'

export async function ensureUserId(sessionStore) {
    if (sessionStore?.userId || !sessionStore?.serverUrl || !sessionStore?.token) {
        return sessionStore
    }
    try {
        const me = await embyFetchJson({ serverUrl: sessionStore.serverUrl, token: sessionStore.token, apiPath: '/Users/Me' })
        if (me?.Id) {
            sessionStore.set({
                serverUrl: sessionStore.serverUrl,
                token: sessionStore.token,
                userId: me.Id,
                userName: me?.Name || sessionStore?.userName
            })
        }
    } catch { }
    return sessionStore
}
