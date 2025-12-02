import { create } from 'zustand'
import type { PluginTrack, PluginArtist, PluginAlbum, PluginPlaylist } from '../types/plugin'

// 缓存 key
const CACHE_KEY = 'musicfree.favorites'

// 收藏数据结构
interface FavoriteData {
  songs: PluginTrack[]
  artists: PluginArtist[]
  albums: PluginAlbum[]
  playlists: PluginPlaylist[]
}

// 从缓存加载
const loadFavorites = (): FavoriteData => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { songs: [], artists: [], albums: [], playlists: [] }
    return JSON.parse(raw)
  } catch {
    return { songs: [], artists: [], albums: [], playlists: [] }
  }
}

// 保存到缓存
const saveFavorites = (data: FavoriteData) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('[Favorites] 保存失败:', e)
  }
}

export interface FavoriteStoreState {
  songs: PluginTrack[]
  artists: PluginArtist[]
  albums: PluginAlbum[]
  playlists: PluginPlaylist[]
  
  // 歌曲
  addSong: (song: PluginTrack) => void
  removeSong: (songId: string) => void
  isSongFavorited: (songId: string) => boolean
  
  // 歌手
  addArtist: (artist: PluginArtist) => void
  removeArtist: (artistId: string) => void
  isArtistFavorited: (artistId: string) => boolean
  
  // 专辑
  addAlbum: (album: PluginAlbum) => void
  removeAlbum: (albumId: string) => void
  isAlbumFavorited: (albumId: string) => boolean
  
  // 歌单
  addPlaylist: (playlist: PluginPlaylist) => void
  removePlaylist: (playlistId: string) => void
  isPlaylistFavorited: (playlistId: string) => boolean
  
  // 切换收藏状态
  toggleSong: (song: PluginTrack) => void
  toggleArtist: (artist: PluginArtist) => void
  toggleAlbum: (album: PluginAlbum) => void
  togglePlaylist: (playlist: PluginPlaylist) => void
  
  // 清空
  clearAll: () => void
  
  // 初始化
  init: () => void
}

export const useFavoriteStore = create<FavoriteStoreState>((set, get) => ({
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  
  // 歌曲操作
  addSong: (song) => {
    const { songs } = get()
    if (songs.some(s => s.id === song.id)) return
    const newSongs = [song, ...songs]
    set({ songs: newSongs })
    saveFavorites({ ...get(), songs: newSongs })
  },
  
  removeSong: (songId) => {
    const { songs } = get()
    const newSongs = songs.filter(s => s.id !== songId)
    set({ songs: newSongs })
    saveFavorites({ ...get(), songs: newSongs })
  },
  
  isSongFavorited: (songId) => {
    return get().songs.some(s => s.id === songId)
  },
  
  toggleSong: (song) => {
    const { isSongFavorited, addSong, removeSong } = get()
    if (isSongFavorited(song.id)) {
      removeSong(song.id)
    } else {
      addSong(song)
    }
  },
  
  // 歌手操作
  addArtist: (artist) => {
    const { artists } = get()
    if (artists.some(a => a.id === artist.id)) return
    const newArtists = [artist, ...artists]
    set({ artists: newArtists })
    saveFavorites({ ...get(), artists: newArtists })
  },
  
  removeArtist: (artistId) => {
    const { artists } = get()
    const newArtists = artists.filter(a => a.id !== artistId)
    set({ artists: newArtists })
    saveFavorites({ ...get(), artists: newArtists })
  },
  
  isArtistFavorited: (artistId) => {
    return get().artists.some(a => a.id === artistId)
  },
  
  toggleArtist: (artist) => {
    const { isArtistFavorited, addArtist, removeArtist } = get()
    if (isArtistFavorited(artist.id)) {
      removeArtist(artist.id)
    } else {
      addArtist(artist)
    }
  },
  
  // 专辑操作
  addAlbum: (album) => {
    const { albums } = get()
    if (albums.some(a => a.id === album.id)) return
    const newAlbums = [album, ...albums]
    set({ albums: newAlbums })
    saveFavorites({ ...get(), albums: newAlbums })
  },
  
  removeAlbum: (albumId) => {
    const { albums } = get()
    const newAlbums = albums.filter(a => a.id !== albumId)
    set({ albums: newAlbums })
    saveFavorites({ ...get(), albums: newAlbums })
  },
  
  isAlbumFavorited: (albumId) => {
    return get().albums.some(a => a.id === albumId)
  },
  
  toggleAlbum: (album) => {
    const { isAlbumFavorited, addAlbum, removeAlbum } = get()
    if (isAlbumFavorited(album.id)) {
      removeAlbum(album.id)
    } else {
      addAlbum(album)
    }
  },
  
  // 歌单操作
  addPlaylist: (playlist) => {
    const { playlists } = get()
    if (playlists.some(p => p.id === playlist.id)) return
    const newPlaylists = [playlist, ...playlists]
    set({ playlists: newPlaylists })
    saveFavorites({ ...get(), playlists: newPlaylists })
  },
  
  removePlaylist: (playlistId) => {
    const { playlists } = get()
    const newPlaylists = playlists.filter(p => p.id !== playlistId)
    set({ playlists: newPlaylists })
    saveFavorites({ ...get(), playlists: newPlaylists })
  },
  
  isPlaylistFavorited: (playlistId) => {
    return get().playlists.some(p => p.id === playlistId)
  },
  
  togglePlaylist: (playlist) => {
    const { isPlaylistFavorited, addPlaylist, removePlaylist } = get()
    if (isPlaylistFavorited(playlist.id)) {
      removePlaylist(playlist.id)
    } else {
      addPlaylist(playlist)
    }
  },
  
  // 清空所有收藏
  clearAll: () => {
    set({ songs: [], artists: [], albums: [], playlists: [] })
    saveFavorites({ songs: [], artists: [], albums: [], playlists: [] })
  },
  
  // 初始化
  init: () => {
    const data = loadFavorites()
    set(data)
  },
}))

