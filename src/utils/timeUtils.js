export function formatSecondsMSS(seconds) {
    if (!seconds || !Number.isFinite(seconds)) {
        return '0:00'
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatTicksMSS(ticks) {
    if (!ticks || !Number.isFinite(ticks) || ticks <= 0) {
        return ''
    }
    const seconds = Math.floor(ticks / 10000000)
    return formatSecondsMSS(seconds)
}

export function formatTicksVerboseMinutesSeconds(ticks) {
    if (!ticks || !Number.isFinite(ticks) || ticks <= 0) {
        return ''
    }
    const totalSeconds = Math.floor(ticks / 10000000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')} minutes ${seconds.toString().padStart(2, '0')} seconds`
}

export function formatDateDMY(dateInput) {
    try {
        if (!dateInput) { return '' }
        const d = new Date(dateInput)
        if (isNaN(d.getTime())) { return '' }
        const day = d.getDate()
        const month = d.getMonth() + 1
        const year = d.getFullYear()
        return `${day}.${month}.${year}`
    } catch {
        return ''
    }
}
