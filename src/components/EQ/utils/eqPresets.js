export const presets = {
    'bass-boost': [4, 3, 0, -2, -4],
    'treble-boost': [-4, -2, 0, 3, 4],
    vocal: [1, 2, 3, 2, 0],
    warm: [2, 1, 0, 1, -2],
}

export const presetOrder = ['bass-boost', 'treble-boost', 'vocal', 'warm']

export const presetLabels = {
    'bass-boost': 'Bass Boost',
    'treble-boost': 'Treble Boost',
    vocal: 'Vocal Boost',
    warm: 'Warm',
}

export const bandDefinitions = [
    { label: '60 Hz', frequency: 60 },
    { label: '250 Hz', frequency: 250 },
    { label: '1 kHz', frequency: 1000 },
    { label: '4 kHz', frequency: 4000 },
    { label: '16 kHz', frequency: 16000 },
]

export const frequencyLabels = ['60 Hz', '250 Hz', '1 kHz', '4 kHz', '16 kHz']
