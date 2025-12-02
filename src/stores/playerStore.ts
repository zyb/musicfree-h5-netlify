import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PluginTrack, PluginStream } from '../types/plugin'

export type PlayMode = 'sequence' | 'repeat' | 'shuffle' | 'single'

export interface PlayerState {
  // 当前播放
  currentTrack: PluginTrack | null
  currentStream: PluginStream | null
  isPlaying: boolean
  isLoading: boolean
  duration: number
  currentTime: number
  volume: number
  muted: boolean
  playMode: PlayMode
  
  // 当前播放列表（来自歌单/专辑/歌手选择）
  playlist: PluginTrack[]
  playlistName: string
  
  // 播放历史
  playHistory: PluginTrack[]
  
  // 错误状态
  error: string | null
  
  // Actions
  setCurrentTrack: (track: PluginTrack | null) => void
  setCurrentStream: (stream: PluginStream | null) => void
  setIsPlaying: (playing: boolean) => void
  setIsLoading: (loading: boolean) => void
  setDuration: (duration: number) => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlayMode: (mode: PlayMode) => void
  
  // 播放列表操作
  setPlaylist: (tracks: PluginTrack[], name?: string) => void
  appendToPlaylist: (tracks: PluginTrack[], name?: string) => void
  addToPlaylist: (track: PluginTrack) => void
  removeFromPlaylist: (trackId: string) => void
  clearPlaylist: () => void
  
  // 播放历史操作
  addToHistory: (track: PluginTrack) => void
  removeFromHistory: (trackId: string) => void
  clearHistory: () => void
  
  setError: (error: string | null) => void
  
  // 播放控制
  playNext: () => PluginTrack | null
  playPrevious: () => PluginTrack | null
}

const getNextIndex = (
  currentIndex: number,
  total: number,
  mode: PlayMode
): number => {
  if (total === 0) return -1
  
  switch (mode) {
    case 'single':
      return currentIndex
    case 'shuffle':
      if (total === 1) return 0
      let next = Math.floor(Math.random() * total)
      while (next === currentIndex) {
        next = Math.floor(Math.random() * total)
      }
      return next
    case 'repeat':
      return (currentIndex + 1) % total
    case 'sequence':
    default:
      return currentIndex + 1 < total ? currentIndex + 1 : -1
  }
}

const getPrevIndex = (currentIndex: number, total: number): number => {
  if (total === 0) return -1
  return currentIndex - 1 >= 0 ? currentIndex - 1 : total - 1
}

// 最大历史记录数
const MAX_HISTORY = 200

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      currentStream: null,
      isPlaying: false,
      isLoading: false,
      duration: 0,
      currentTime: 0,
      volume: 0.8,
      muted: false,
      playMode: 'sequence',
      playlist: [],
      playlistName: '播放列表',
      playHistory: [],
      error: null,
      
      setCurrentTrack: (track) => {
        // 添加到播放历史
        if (track) {
          get().addToHistory(track)
        }
        set({ currentTrack: track, currentStream: null, error: null, currentTime: 0, duration: 0 })
      },
      setCurrentStream: (stream) => set({ currentStream: stream }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setDuration: (duration) => set({ duration }),
      setCurrentTime: (time) => set({ currentTime: time }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      toggleMute: () => set((state) => ({ muted: !state.muted })),
      setPlayMode: (mode) => set({ playMode: mode }),
      
      // 设置播放列表（替换）
      setPlaylist: (tracks, name) => set({ 
        playlist: tracks, 
        playlistName: name || '播放列表' 
      }),
      
      // 追加到播放列表
      appendToPlaylist: (tracks, name) => set((state) => {
        // 过滤已存在的歌曲
        const existingIds = new Set(state.playlist.map(t => t.id))
        const newTracks = tracks.filter(t => !existingIds.has(t.id))
        
        return { 
          playlist: [...state.playlist, ...newTracks],
          playlistName: name ? `${state.playlistName} + ${name}` : state.playlistName,
        }
      }),
      
      addToPlaylist: (track) => set((state) => {
        const exists = state.playlist.some((t) => t.id === track.id)
        if (exists) return state
        return { playlist: [...state.playlist, track] }
      }),
      
      removeFromPlaylist: (trackId) => set((state) => ({
        playlist: state.playlist.filter((t) => t.id !== trackId)
      })),
      
      clearPlaylist: () => set({ playlist: [], playlistName: '播放列表' }),
      
      // 添加到播放历史
      addToHistory: (track) => set((state) => {
        // 移除已存在的相同歌曲（避免重复）
        const filtered = state.playHistory.filter(t => t.id !== track.id)
        // 添加到最前面
        const newHistory = [track, ...filtered].slice(0, MAX_HISTORY)
        return { playHistory: newHistory }
      }),
      
      removeFromHistory: (trackId) => set((state) => ({
        playHistory: state.playHistory.filter((t) => t.id !== trackId)
      })),
      
      clearHistory: () => set({ playHistory: [] }),
      
      setError: (error) => set({ error }),
      
      playNext: () => {
        const { playlist, currentTrack, playMode } = get()
        if (playlist.length === 0) return null
        
        const currentIndex = currentTrack 
          ? playlist.findIndex((t) => t.id === currentTrack.id) 
          : -1
        const nextIndex = getNextIndex(currentIndex, playlist.length, playMode)
        
        if (nextIndex === -1) {
          set({ isPlaying: false })
          return null
        }
        const nextTrack = playlist[nextIndex]
        // 使用 setCurrentTrack 会自动添加到历史
        get().setCurrentTrack(nextTrack)
        set({ isPlaying: true })
        return nextTrack
      },
      
      playPrevious: () => {
        const { playlist, currentTrack } = get()
        if (playlist.length === 0) return null
        
        const currentIndex = currentTrack 
          ? playlist.findIndex((t) => t.id === currentTrack.id) 
          : 0
        const prevIndex = getPrevIndex(currentIndex, playlist.length)
        
        if (prevIndex === -1) return null
        const prevTrack = playlist[prevIndex]
        get().setCurrentTrack(prevTrack)
        set({ isPlaying: true })
        return prevTrack
      },
    }),
    {
      name: 'musicfree-player',
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        playMode: state.playMode,
        playHistory: state.playHistory,
        playlist: state.playlist,
        playlistName: state.playlistName,
      }),
    }
  )
)
