export function toggleAlbumFavorite(e) {
    const album = e?.album || e
    if (!album?.UserData) return
    const isFavorite = album.UserData.IsFavorite || false
    album.UserData.IsFavorite = !isFavorite
}
