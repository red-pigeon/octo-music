function hasElectronStore() {
  try {
    return !!(globalThis?.octo?.storage?.getItem && globalThis?.octo?.storage?.setItem)
  } catch {
    return false
  }
}

export function storageGetItem(key, fallback = null) {
  try {
    if (hasElectronStore()) {
      const v = globalThis.octo.storage.getItem(String(key))
      return v === undefined ? fallback : (v ?? fallback)
    }
  } catch {
    // ignore
  }

  try {
    const v = globalThis?.localStorage?.getItem?.(String(key))
    return v === null ? fallback : v
  } catch {
    return fallback
  }
}

export function storageSetItem(key, value) {
  const k = String(key)
  const v = value === null || value === undefined ? '' : String(value)

  try {
    if (hasElectronStore()) {
      const ok = globalThis.octo.storage.setItem(k, v)
      if (ok === true) return
    }
  } catch {
    // ignore
  }

  try {
    globalThis?.localStorage?.setItem?.(k, v)
  } catch {
    // ignore
  }
}

export function storageRemoveItem(key) {
  const k = String(key)

  try {
    if (hasElectronStore()) {
      const ok = globalThis.octo.storage.removeItem(k)
      if (ok === true) return
    }
  } catch {
    // ignore
  }

  try {
    globalThis?.localStorage?.removeItem?.(k)
  } catch {
    // ignore
  }
}
