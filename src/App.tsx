import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2, Rss, ListMusic, Search, Radio, ChevronDown, RefreshCw } from 'lucide-react'
import { usePluginStore } from './stores/pluginStore'
import { usePlayerStore } from './stores/playerStore'
import { parseLRC, getCurrentLyric } from './lib/lyrics'
import { loadSongCache, saveSongCache, deleteSongCache } from './lib/songCache'
import { needsMSEPlayback, loadMSEAudio, cleanupMSE, isMSESupported } from './lib/msePlayer'
import type { PluginTrack } from './types/plugin'
import { Player } from './components/Player'
import { SearchView } from './components/SearchView'
import { PlaylistView } from './components/PlaylistView'
import { PluginManager } from './components/PluginManager'
import { MiniPlayer } from './components/MiniPlayer'

type TabId = 'search' | 'playlist' | 'plugins'

const tabs = [
  { id: 'search' as const, icon: Search, label: '搜索' },
  { id: 'playlist' as const, icon: ListMusic, label: '列表' },
  { id: 'plugins' as const, icon: Rss, label: '订阅' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('search')
  const [showPlayer, setShowPlayer] = useState(false)
  const [showPluginSelect, setShowPluginSelect] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasRestoredProgressRef = useRef(false)
  const currentAudioUrlRef = useRef<string>('')
  const currentTrackIdRef = useRef<string | undefined>(undefined)
  const isStreamFromCacheRef = useRef<boolean>(false)
  const isRetryingRef = useRef<boolean>(false)
  const wasPlayingBeforeRetryRef = useRef<boolean>(false)
  const currentBlobUrlRef = useRef<string | null>(null) // 跟踪当前的 blob URL，用于释放
  const retryCountRef = useRef<number>(0) // 重试次数计数器
  const lastFailedTrackIdRef = useRef<string | undefined>(undefined) // 上次失败的 trackId，用于跟踪重试次数
  const maxRetryCount = 3 // 最大重试次数
  const pendingCacheTrackRef = useRef<{ track: PluginTrack; stream: any; lyrics?: string } | null>(null) // 待缓存的歌曲信息
  
  const init = usePluginStore((s) => s.init)
  const getActivePluginInstance = usePluginStore((s) => s.getActivePluginInstance)
  const {
    plugins,
    activePluginId,
    setActivePlugin,
  } = usePluginStore()
  
  const handleRefresh = () => {
    // 刷新整个页面，类似 Ctrl+R
    window.location.reload()
  }
  
  const readyPlugins = plugins.filter((p) => p.status === 'ready')
  const activePlugin = plugins.find((p) => p.meta.id === activePluginId)
  
  const {
    currentTrack,
    currentStream,
    isPlaying,
    volume,
    muted,
    currentTime,
    lyrics,
    setIsPlaying,
    setIsLoading,
    setDuration,
    setCurrentTime,
    setCurrentStream,
    setError,
    setLyrics,
    playNext,
    playPrevious,
  } = usePlayerStore()
  
  useEffect(() => {
    init()
    
    // 组件卸载时清理 blob URL
    return () => {
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
    }
  }, [init])
  
  // Media Session API - 设置动作处理程序（只在组件挂载和歌曲变化时设置，避免频繁刷新）
  useEffect(() => {
    // 检查 Media Session API 支持情况
    if (!('mediaSession' in navigator)) {
      console.warn('[MediaSession] Media Session API 不支持')
      console.warn('[MediaSession] 提示：锁屏界面显示需要：')
      console.warn('[MediaSession] 1. 使用 HTTPS 连接（已满足）')
      console.warn('[MediaSession] 2. 浏览器支持 Media Session API')
      console.warn('[MediaSession] 3. iOS Safari 需要添加到主屏幕（PWA）')
      console.warn('[MediaSession] 4. Android Chrome 通常直接支持')
      return
    }
    
    const mediaSession = navigator.mediaSession
    console.log('[MediaSession] ✓ Media Session API 可用')
    console.log('[MediaSession] 浏览器信息:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isSecureContext: window.isSecureContext,
    })
    
    // 设置动作处理程序
    mediaSession.setActionHandler('play', () => {
      console.log('[MediaSession] 收到播放动作')
      setIsPlaying(true)
    })
    
    mediaSession.setActionHandler('pause', () => {
      console.log('[MediaSession] 收到暂停动作')
      setIsPlaying(false)
    })
    
    mediaSession.setActionHandler('previoustrack', () => {
      console.log('[MediaSession] 收到上一首动作')
      const prev = playPrevious()
      if (prev) {
        setIsPlaying(true)
      }
    })
    
    mediaSession.setActionHandler('nexttrack', () => {
      console.log('[MediaSession] 收到下一首动作')
      const next = playNext()
      if (next) {
        setIsPlaying(true)
      }
    })
    
    // 禁用定位动作（不显示播放进度条）
    // 注意：某些浏览器可能仍然显示进度条，但禁用 seekto 可以防止用户通过通知栏调整进度
    try {
      mediaSession.setActionHandler('seekto', null)
    } catch (error) {
      // 某些浏览器可能不支持禁用 seekto
      console.log('[MediaSession] 无法禁用定位动作:', error)
    }
    
    // 明确禁用快进和快退按钮（音乐播放器通常不需要这些功能）
    // 注意：某些浏览器可能仍然显示这些按钮，但设置为 null 可以防止它们被触发
    try {
      mediaSession.setActionHandler('seekbackward', null)
      mediaSession.setActionHandler('seekforward', null)
    } catch (error) {
      // 某些浏览器可能不支持禁用这些动作
      console.log('[MediaSession] 无法禁用快进快退按钮:', error)
    }
    
    // 清理函数
    return () => {
      // 组件卸载时清除动作处理程序
      try {
        mediaSession.setActionHandler('play', null)
        mediaSession.setActionHandler('pause', null)
        mediaSession.setActionHandler('previoustrack', null)
        mediaSession.setActionHandler('nexttrack', null)
        mediaSession.setActionHandler('seekto', null)
        mediaSession.setActionHandler('seekbackward', null)
        mediaSession.setActionHandler('seekforward', null)
      } catch (error) {
        console.error('[MediaSession] 清理动作处理程序失败:', error)
      }
    }
  }, [setIsPlaying, playNext, playPrevious, setCurrentTime, isPlaying])
  
  // Media Session API - 更新媒体元数据（只在歌曲变化时更新）
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }
    
    const mediaSession = navigator.mediaSession
    
    // 更新媒体元数据
    if (currentTrack) {
      const metadata: MediaMetadataInit = {
        title: currentTrack.title || '未知标题',
        artist: currentTrack.artists?.join(' / ') || '未知艺术家',
        album: currentTrack.album || '',
        artwork: currentTrack.coverUrl ? [
          { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' },
        ] : [],
      }
      
      try {
        mediaSession.metadata = new MediaMetadata(metadata)
        console.log('[MediaSession] ✓ 已设置媒体元数据:', {
          title: currentTrack.title,
          artist: currentTrack.artists?.join(' / '),
          album: currentTrack.album,
          hasArtwork: !!currentTrack.coverUrl,
        })
      } catch (error) {
        console.error('[MediaSession] ✗ 设置媒体元数据失败:', error)
      }
    } else {
      // 没有当前歌曲时，清除元数据
      mediaSession.metadata = null
      console.log('[MediaSession] 已清除媒体元数据')
    }
  }, [currentTrack])
  
  // Media Session API - 实时更新歌词到 title（用于蓝牙车载显示）
  // 使用节流，每 1 秒更新一次，避免频繁更新导致按钮闪烁
  const lastLyricUpdateRef = useRef<number>(0)
  const lastLyricTextRef = useRef<string>('')
  
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || !isPlaying) {
      return
    }
    
    const mediaSession = navigator.mediaSession
    
    // 节流：每 1 秒更新一次歌词
    const LYRIC_UPDATE_INTERVAL = 1000
    const now = Date.now()
    
    if (now - lastLyricUpdateRef.current >= LYRIC_UPDATE_INTERVAL) {
      // 获取当前歌词行
      const currentLyricText = getCurrentLyric(lyrics, currentTime)
      
      // 只有当歌词变化时才更新，避免不必要的更新
      if (currentLyricText && currentLyricText !== lastLyricTextRef.current) {
        try {
          // 更新 metadata，将当前歌词行添加到 title 中
          // 格式：歌曲名 - 当前歌词
          const titleWithLyric = currentLyricText.trim()
            ? `${currentTrack.title} - ${currentLyricText}`
            : currentTrack.title || '未知标题'
          
          const metadata: MediaMetadataInit = {
            title: titleWithLyric,
            artist: currentTrack.artists?.join(' / ') || '未知艺术家',
            album: currentTrack.album || '',
            artwork: currentTrack.coverUrl ? [
              { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' },
              { src: currentTrack.coverUrl, sizes: '128x128', type: 'image/jpeg' },
              { src: currentTrack.coverUrl, sizes: '192x192', type: 'image/jpeg' },
              { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
              { src: currentTrack.coverUrl, sizes: '384x384', type: 'image/jpeg' },
              { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' },
            ] : [],
          }
          
          mediaSession.metadata = new MediaMetadata(metadata)
          lastLyricTextRef.current = currentLyricText
          lastLyricUpdateRef.current = now
        } catch (error) {
          // 某些浏览器可能不支持频繁更新 metadata，忽略错误
        }
      } else if (!currentLyricText) {
        // 如果没有歌词，恢复原始标题
        if (lastLyricTextRef.current) {
          try {
            const metadata: MediaMetadataInit = {
              title: currentTrack.title || '未知标题',
              artist: currentTrack.artists?.join(' / ') || '未知艺术家',
              album: currentTrack.album || '',
              artwork: currentTrack.coverUrl ? [
                { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' },
                { src: currentTrack.coverUrl, sizes: '128x128', type: 'image/jpeg' },
                { src: currentTrack.coverUrl, sizes: '192x192', type: 'image/jpeg' },
                { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
                { src: currentTrack.coverUrl, sizes: '384x384', type: 'image/jpeg' },
                { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' },
              ] : [],
            }
            mediaSession.metadata = new MediaMetadata(metadata)
            lastLyricTextRef.current = ''
            lastLyricUpdateRef.current = now
          } catch (error) {
            // 忽略错误
          }
        }
      }
    }
  }, [currentTrack, lyrics, currentTime, isPlaying])
  
  // Media Session API - 更新播放状态（只在播放状态变化时更新）
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return
    }
    
    const mediaSession = navigator.mediaSession
    
    try {
      mediaSession.playbackState = isPlaying ? 'playing' : 'paused'
      console.log('[MediaSession] ✓ 播放状态已更新:', mediaSession.playbackState)
    } catch (error) {
      console.error('[MediaSession] ✗ 设置播放状态失败:', error)
    }
  }, [isPlaying])
  
  
  // 点击外部关闭插件选择下拉菜单
  useEffect(() => {
    if (!showPluginSelect) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('[data-plugin-select]')) {
        setShowPluginSelect(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPluginSelect])
  
  // 从音频元素获取完整音频数据并缓存（包含完整的歌曲信息）
  // 方案：Service Worker 缓存音频本体（opaque 响应），页面只保存元数据（URL、歌词等）
  // 播放时，Service Worker 自动从缓存返回，无需读取内容
  const cacheAudioFromElement = async (track: PluginTrack, audioElement: HTMLAudioElement, stream: any, lyrics?: string): Promise<void> => {
    try {
      // 如果音频元素使用的是 blob URL，说明已经是从缓存加载的，不需要再次缓存
      if (audioElement.src.startsWith('blob:')) {
        console.log('[SongCache] 音频元素使用的是 blob URL，已从缓存加载，跳过缓存，trackId:', track.id)
        return
      }
      
      // 获取原始音频 URL（从 stream 获取）
      const originalUrl = stream.url
      if (!originalUrl) {
        console.warn('[SongCache] 无法获取原始音频 URL，跳过缓存，trackId:', track.id)
        return
      }
      
      // 等待音频元素完全加载（确保 Service Worker 已经缓存了音频）
      console.log('[SongCache] 等待音频元素完全加载，trackId:', track.id, 'title:', track.title, '当前 readyState:', audioElement.readyState)
      
      // 等待音频完全加载或播放一段时间
      await new Promise<void>((resolve) => {
        let resolved = false
        const startTime = Date.now()
        const minWaitTime = 2000 // 至少等待 2 秒，确保 Service Worker 已经缓存了音频
        
        const checkAndResolve = () => {
          if (resolved) return
          
          const elapsed = Date.now() - startTime
          const isFullyLoaded = audioElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
          const hasPlayedEnough = elapsed >= minWaitTime
          
          // 如果音频完全加载且已等待足够时间，可以开始保存元数据
          if (isFullyLoaded && hasPlayedEnough) {
            resolved = true
            resolve()
            return
          }
          
          // 如果音频已经结束，立即解析
          if (audioElement.ended) {
            resolved = true
            resolve()
            return
          }
          
          // 继续检查
          setTimeout(checkAndResolve, 200)
        }
        
        // 如果已经满足条件，立即解析
        if (audioElement.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && Date.now() - startTime >= minWaitTime) {
          resolve()
          return
        }
        
        // 开始检查
        checkAndResolve()
      })
      
      console.log('[SongCache] 保存歌曲元数据到 IndexedDB，trackId:', track.id, 'title:', track.title, 'url:', originalUrl.substring(0, 50))
      
      // 只保存元数据（URL、歌词、歌曲信息等）
      // 音频本体由 Service Worker 在 Cache Storage 中缓存，不需要读取内容
      await saveSongCache(track, null, stream, lyrics)
      
      console.log('[SongCache] ✓ 歌曲元数据缓存完成，trackId:', track.id, 'title:', track.title)
      console.log('[SongCache] 提示：音频本体已由 Service Worker 缓存，播放时会自动从缓存返回')
      
      // 触发缓存完成事件，通知列表组件更新缓存图标
      window.dispatchEvent(new CustomEvent('songCached', { detail: { trackId: track.id } }))
    } catch (error) {
      console.error('[SongCache] ✗ 缓存歌曲失败，trackId:', track.id, 'title:', track.title, 'error:', error)
      // 不抛出错误，避免影响播放
    }
  }
  
  // 解析音频流（优先从缓存加载，无缓存时才网络请求）
  const resolveStream = useCallback(async (skipCache = false) => {
    if (!currentTrack) return
    
    // 如果 skipCache 为 true，清除当前歌曲的缓存
    if (skipCache) {
      await deleteSongCache(currentTrack.id)
      console.log('[SongCache] 重试模式：已清除缓存，将从网络重新请求')
    }
    
    // 优先从缓存加载完整歌曲信息（如果 skipCache 为 true，则跳过）
    if (!skipCache) {
      const cachedSong = await loadSongCache(currentTrack.id)
      if (cachedSong) {
        console.log('[SongCache] ✓ 从缓存加载歌曲，trackId:', currentTrack.id, 'title:', cachedSong.title)
        isStreamFromCacheRef.current = true
        
        // 检查是否有实际的音频 Blob（大小 > 0）
        const hasAudioBlob = cachedSong.audioBlob instanceof Blob && cachedSong.audioBlob.size > 0
        
        if (hasAudioBlob) {
          // 如果有实际的 Blob，创建 blob URL 用于播放
          console.log('[SongCache] 使用 IndexedDB 中的音频 Blob，大小:', (cachedSong.audioBlob.size / 1024 / 1024).toFixed(2), 'MB')
          const blobUrl = URL.createObjectURL(cachedSong.audioBlob)
          currentBlobUrlRef.current = blobUrl // 保存 blob URL 引用，用于后续释放
          setCurrentStream({
            url: blobUrl,
            _isBlobUrl: true,
          } as any)
        } else if (cachedSong.streamUrl) {
          // 如果没有 Blob 但有 streamUrl，说明音频本体由 Service Worker 缓存
          // 直接使用原始 URL，Service Worker 会自动从缓存返回
          console.log('[SongCache] 使用 Service Worker 缓存的音频，URL:', cachedSong.streamUrl.substring(0, 50))
          setCurrentStream({
            url: cachedSong.streamUrl,
            _isBlobUrl: false,
          } as any)
          currentBlobUrlRef.current = null // 不是 blob URL，不需要释放
        } else {
          console.warn('[SongCache] 缓存中既没有 Blob 也没有 streamUrl，跳过缓存')
          // 继续执行网络请求
        }
        
        // 处理缓存的歌词数据
        if (cachedSong.lyrics && typeof cachedSong.lyrics === 'string' && cachedSong.lyrics.trim().length > 0) {
          const lyrics = parseLRC(cachedSong.lyrics)
          if (lyrics.length > 0) {
            setLyrics(lyrics)
          }
        }
        
        // 如果成功设置了 stream，不需要网络请求
        if (hasAudioBlob || cachedSong.streamUrl) {
          setIsLoading(false)
          return // 从缓存加载成功，不需要网络请求
        }
      } else {
        console.log('[SongCache] ✗ 缓存中未找到歌曲，将从网络请求，trackId:', currentTrack.id, 'title:', currentTrack.title)
      }
    }
    
    // 缓存不存在，从网络请求
    const plugin = getActivePluginInstance()
    if (!plugin?.resolveStream) {
      setError('无法解析音频地址')
      return
    }
    
    setIsLoading(true)
    console.log('[StreamCache] 开始从网络请求音频流，trackId:', currentTrack.id, 'title:', currentTrack.title)
    try {
      const stream = await plugin.resolveStream(currentTrack)
      
      console.log('[StreamCache] 网络请求成功，trackId:', currentTrack.id, 'title:', currentTrack.title, 'url:', stream.url)
      // 标记当前流来自网络请求（不是缓存）
      isStreamFromCacheRef.current = false
      
      // 先设置音频流，让用户可以先播放
      setCurrentStream(stream)
      
      // 尝试从 stream 的额外数据中获取歌词
      // 某些插件可能将歌词数据放在 stream 的 extra 字段中
      console.log('[Lyrics] 检查歌词数据，stream:', stream)
      console.log('[Lyrics] stream.extra:', (stream as any)?.extra)
      console.log('[Lyrics] stream.lrc:', (stream as any)?.lrc)
      console.log('[Lyrics] currentTrack.extra:', currentTrack.extra)
      
      let lyricsFound = false
      let lyricsText: string | undefined
      
      if ((stream as any)?.extra?.lrc) {
        const lrcText = (stream as any).extra.lrc
        console.log('[Lyrics] 从 stream.extra.lrc 获取歌词，长度:', lrcText.length)
        if (typeof lrcText === 'string' && lrcText.trim().length > 0) {
          lyricsText = lrcText
          const lyrics = parseLRC(lrcText)
          console.log('[Lyrics] 解析后的歌词行数:', lyrics.length)
          if (lyrics.length > 0) {
            console.log('[Lyrics] 前3行歌词:', lyrics.slice(0, 3))
            setLyrics(lyrics)
            lyricsFound = true
          }
        }
      }
      // 或者从 stream 的直接 lrc 字段获取
      else if ((stream as any)?.lrc && typeof (stream as any).lrc === 'string') {
        const lrcText = (stream as any).lrc
        console.log('[Lyrics] 从 stream.lrc 获取歌词，长度:', lrcText.length)
        if (lrcText.trim().length > 0) {
          lyricsText = lrcText
          const lyrics = parseLRC(lrcText)
          console.log('[Lyrics] 解析后的歌词行数:', lyrics.length)
          if (lyrics.length > 0) {
            setLyrics(lyrics)
            lyricsFound = true
          }
        }
      }
      // 或者从 currentTrack.extra 中获取歌词
      else if (currentTrack.extra?.lrc && typeof currentTrack.extra.lrc === 'string') {
        const lrcText = currentTrack.extra.lrc as string
        console.log('[Lyrics] 从 currentTrack.extra.lrc 获取歌词，长度:', lrcText.length)
        if (lrcText.trim().length > 0) {
          lyricsText = lrcText
          const lyrics = parseLRC(lrcText)
          console.log('[Lyrics] 解析后的歌词行数:', lyrics.length)
          if (lyrics.length > 0) {
            setLyrics(lyrics)
            lyricsFound = true
          }
        }
      }
      
      // 如果以上都没有找到，尝试直接调用插件的 getMediaSource 获取完整响应
      if (!lyricsFound && currentTrack.extra) {
        try {
          // 尝试直接访问原生插件的 getMediaSource 方法
          const pluginInstance = (plugin as any)
          const nativePlugin = pluginInstance.__nativePlugin || pluginInstance
          
          if (nativePlugin?.getMediaSource) {
            console.log('[Lyrics] 尝试直接调用 getMediaSource 获取完整响应')
            // 尝试不同的音质，获取完整响应
            const qualities = ['128', 'standard', '320', 'high', 'low', 'super']
            for (const quality of qualities) {
              try {
                const fullResult = await nativePlugin.getMediaSource(currentTrack.extra, quality)
                console.log('[Lyrics] getMediaSource 完整返回:', JSON.stringify(fullResult).substring(0, 500))
                
                // 检查多种可能的格式
                let lrcText: string | undefined
                if ((fullResult as any)?.data?.lrc) {
                  lrcText = (fullResult as any).data.lrc
                } else if ((fullResult as any)?.lrc) {
                  lrcText = (fullResult as any).lrc
                } else if ((fullResult as any)?.rawLrc) {
                  lrcText = (fullResult as any).rawLrc
                }
                
                if (lrcText && typeof lrcText === 'string' && lrcText.trim().length > 0) {
                  lyricsText = lrcText
                  console.log('[Lyrics] 从 getMediaSource 完整响应中找到歌词，长度:', lrcText.length)
                  const lyrics = parseLRC(lrcText)
                  if (lyrics.length > 0) {
                    setLyrics(lyrics)
                    lyricsFound = true
                    break
                  }
                }
              } catch (e) {
                continue
              }
            }
          }
          
          // 如果还是没有，尝试 getLyric 方法
          if (!lyricsFound && nativePlugin?.getLyric) {
            console.log('[Lyrics] 尝试使用 getLyric 方法获取歌词')
            const lyricResult = await nativePlugin.getLyric(currentTrack.extra)
            console.log('[Lyrics] getLyric 返回:', lyricResult)
            if (lyricResult?.rawLrc && typeof lyricResult.rawLrc === 'string') {
              lyricsText = lyricResult.rawLrc
              const lyrics = parseLRC(lyricResult.rawLrc)
              console.log('[Lyrics] 从 getLyric 解析后的歌词行数:', lyrics.length)
              if (lyrics.length > 0) {
                setLyrics(lyrics)
                lyricsFound = true
              }
            }
          }
        } catch (error) {
          console.warn('[Lyrics] 直接调用插件方法失败:', error)
        }
      }
      
      if (!lyricsFound) {
        // 如果没有歌词，清空歌词列表
        console.log('[Lyrics] 未找到歌词数据，清空歌词列表')
        setLyrics([])
      }
      
      // 标记待缓存，等待音频元素加载完成后缓存（包含完整的歌曲信息）
      pendingCacheTrackRef.current = { track: currentTrack, stream: stream, lyrics: lyricsText }
      console.log('[SongCache] ✓ 已设置待缓存标记，trackId:', currentTrack.id, 'title:', currentTrack.title, 'hasLyrics:', !!lyricsText, 'streamUrl:', stream.url.substring(0, 50))
    } catch (error) {
      console.error('[StreamCache] 网络请求失败，trackId:', currentTrack.id, 'title:', currentTrack.title, 'error:', error)
      setError(error instanceof Error ? error.message : '解析失败')
      // 如果重试失败，重置重试标记
      if (isRetryingRef.current) {
        console.log('[StreamCache] 重试失败，重置重试标记')
        isRetryingRef.current = false
        wasPlayingBeforeRetryRef.current = false
        retryCountRef.current = 0
        lastFailedTrackIdRef.current = undefined
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentTrack, getActivePluginInstance, setCurrentStream, setError, setIsLoading, setLyrics])
  
  // 当 currentTrack 改变时解析流
  useEffect(() => {
    // 如果正在重试，不触发这个 effect（避免重复请求）
    if (isRetryingRef.current) {
      return
    }
    if (currentTrack && !currentStream) {
      console.log('[StreamCache] 检测到新歌曲，开始解析流，trackId:', currentTrack.id, 'title:', currentTrack.title)
      // 重置缓存标记
      isStreamFromCacheRef.current = false
      resolveStream()
    }
  }, [currentTrack, currentStream, resolveStream])
  
  // 当 currentStream 改变时加载音频
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentStream) {
      // 释放旧的 blob URL
      if (currentBlobUrlRef.current) {
        console.log('[Audio] 释放旧的 blob URL:', currentBlobUrlRef.current)
        URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
      currentAudioUrlRef.current = ''
      if (!currentTrack) {
        currentTrackIdRef.current = undefined
      }
      return
    }
    
    // 检查是否是新的歌曲
    const isNewTrack = currentTrack?.id !== currentTrackIdRef.current
    if (isNewTrack) {
      console.log('[Audio] 检测到新歌曲，准备加载音频，trackId:', currentTrack?.id, 'title:', currentTrack?.title)
      // 释放旧的 blob URL
      if (currentBlobUrlRef.current) {
        console.log('[Audio] 释放旧的 blob URL:', currentBlobUrlRef.current)
        URL.revokeObjectURL(currentBlobUrlRef.current)
        currentBlobUrlRef.current = null
      }
      currentTrackIdRef.current = currentTrack?.id
      // 新歌曲，重置播放进度和重试计数器
      setCurrentTime(0)
      hasRestoredProgressRef.current = false
      retryCountRef.current = 0
      lastFailedTrackIdRef.current = undefined
      // 注意：不要在这里清除 pendingCacheTrackRef，因为它是在 resolveStream 中设置的
      // 如果是从缓存加载的，resolveStream 不会设置它；如果是从网络加载的，resolveStream 会设置它
    }
    
    // 检查是否是 blob URL（来自缓存）
    const isBlobUrl = (currentStream as any)?._isBlobUrl
    let newSrc: string = currentStream.url
    
    if (isBlobUrl) {
      currentBlobUrlRef.current = currentStream.url
      console.log('[Audio] 使用缓存的 blob URL，trackId:', currentTrack?.id, 'title:', currentTrack?.title)
    } else {
      console.log('[Audio] 使用原始 URL，trackId:', currentTrack?.id, 'title:', currentTrack?.title, 'url:', currentStream.url.substring(0, 60))
      currentBlobUrlRef.current = null
    }
    console.log('[Audio] 设置音频源，trackId:', currentTrack?.id, 'title:', currentTrack?.title, 'url:', currentStream.url, 'isFromCache:', isStreamFromCacheRef.current, 'isBlobUrl:', isBlobUrl)
    
    // 如果 URL 没有改变，不需要重新加载
    if (currentAudioUrlRef.current === currentStream.url) {
      // URL 相同，只需要恢复播放进度（如果有，且不是新歌曲）
      if (!isNewTrack) {
        const savedTime = usePlayerStore.getState().currentTime
        if (savedTime > 0 && (!audio.duration || savedTime < audio.duration)) {
          audio.currentTime = savedTime
        }
      } else {
        // 新歌曲，确保从 0 开始
        audio.currentTime = 0
      }
      return
    }
    
    // 保存当前播放进度（如果有，且不是新歌曲）
    const savedTime = isNewTrack ? 0 : usePlayerStore.getState().currentTime
    const wasPlaying = usePlayerStore.getState().isPlaying
    
    // 更新 URL 引用
    currentAudioUrlRef.current = currentStream.url
    
    // 重置恢复进度标记，允许新歌曲恢复进度
    hasRestoredProgressRef.current = false
    
    // 检查是否需要 MSE 播放（如 B站 m4s 格式）
    const requiresMSE = needsMSEPlayback(newSrc) && !isBlobUrl
    
    if (requiresMSE && isMSESupported()) {
      console.log('[Audio] 检测到 m4s 格式，使用 MSE 播放')
      // 清理之前的 MSE 资源
      cleanupMSE(audio)
      
      // 使用 MSE 加载音频
      loadMSEAudio(audio, newSrc)
        .then(() => {
          console.log('[Audio] MSE 加载成功')
          // 如果是新歌曲，从 0 开始；否则恢复播放进度
          if (isNewTrack) {
            audio.currentTime = 0
          } else if (savedTime > 0 && (!audio.duration || savedTime < audio.duration)) {
            audio.currentTime = savedTime
          }
          // 如果之前正在播放，继续播放
          const shouldPlay = wasPlaying || (isRetryingRef.current && wasPlayingBeforeRetryRef.current)
          if (shouldPlay) {
            audio.play().catch(() => setIsPlaying(false))
          }
          // 重置重试标记
          if (isRetryingRef.current) {
            isRetryingRef.current = false
            wasPlayingBeforeRetryRef.current = false
            retryCountRef.current = 0
            lastFailedTrackIdRef.current = undefined
          }
        })
        .catch((error) => {
          console.error('[Audio] MSE 加载失败:', error)
          setError(`音频加载失败: ${error.message}`)
        })
      return // MSE 模式下直接返回，不执行后续的 audio.src 设置
    }
    
    // 普通音频格式，直接设置 src
    audio.src = newSrc
    
    // 设置加载完成后的回调
    const handleCanPlay = () => {
      // 如果是新歌曲，从 0 开始；否则恢复播放进度（如果有）
      if (isNewTrack) {
        audio.currentTime = 0
      } else if (savedTime > 0 && (!audio.duration || savedTime < audio.duration)) {
        audio.currentTime = savedTime
      }
      // 如果之前正在播放，或者正在重试且重试前正在播放，继续播放
      const shouldPlay = wasPlaying || (isRetryingRef.current && wasPlayingBeforeRetryRef.current)
      if (shouldPlay) {
        console.log('[Audio] 恢复播放，wasPlaying:', wasPlaying, 'isRetrying:', isRetryingRef.current, 'wasPlayingBeforeRetry:', wasPlayingBeforeRetryRef.current)
        audio.play().catch(() => setIsPlaying(false))
      }
      // 重置重试标记
      if (isRetryingRef.current) {
        isRetryingRef.current = false
        wasPlayingBeforeRetryRef.current = false
        retryCountRef.current = 0
        lastFailedTrackIdRef.current = undefined
      }
      audio.removeEventListener('canplay', handleCanPlay)
    }
    
    // 设置完全加载完成后的回调（用于缓存音频数据）
    const handleCanPlayThrough = () => {
      console.log('[SongCache] canplaythrough 事件触发，readyState:', audio.readyState, 'pendingCacheTrackRef:', !!pendingCacheTrackRef.current, 'isStreamFromCache:', isStreamFromCacheRef.current, 'audio.src:', audio.src.substring(0, 50))
      // 音频完全加载完成，从音频元素获取完整音频数据并缓存完整的歌曲信息
      if (pendingCacheTrackRef.current && !isStreamFromCacheRef.current) {
        const { track, stream, lyrics } = pendingCacheTrackRef.current
        console.log('[SongCache] ✓ 音频完全加载完成，开始缓存完整歌曲数据，trackId:', track.id, 'title:', track.title)
        cacheAudioFromElement(track, audio, stream, lyrics).catch((error) => {
          console.error('[SongCache] ✗ 缓存歌曲数据失败:', error)
        })
        // 清除待缓存标记
        pendingCacheTrackRef.current = null
      } else {
        console.log('[SongCache] 跳过缓存：pendingCacheTrackRef=', !!pendingCacheTrackRef.current, 'isStreamFromCache=', isStreamFromCacheRef.current)
      }
      audio.removeEventListener('canplaythrough', handleCanPlayThrough)
    }
    
    // 监听 loadeddata 事件，作为备用缓存触发点（某些情况下 canplaythrough 可能不触发）
    const handleLoadedData = () => {
      console.log('[SongCache] loadeddata 事件触发，readyState:', audio.readyState, 'pendingCacheTrackRef:', !!pendingCacheTrackRef.current, 'isStreamFromCache:', isStreamFromCacheRef.current)
      // 如果 canplaythrough 没有触发，使用 loadeddata 作为备用
      if (pendingCacheTrackRef.current && !isStreamFromCacheRef.current && audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        const { track, stream, lyrics } = pendingCacheTrackRef.current
        console.log('[SongCache] ✓ 通过 loadeddata 事件缓存完整歌曲数据，trackId:', track.id, 'title:', track.title)
        cacheAudioFromElement(track, audio, stream, lyrics).catch((error) => {
          console.error('[SongCache] ✗ 缓存歌曲数据失败:', error)
        })
        // 清除待缓存标记
        pendingCacheTrackRef.current = null
      }
      audio.removeEventListener('loadeddata', handleLoadedData)
    }
    
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('canplaythrough', handleCanPlayThrough)
    audio.addEventListener('loadeddata', handleLoadedData)
    audio.load()
    
    // 如果音频已经可以播放，立即恢复进度
    if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      console.log('[Audio] 音频已就绪，立即调用 handleCanPlay')
      handleCanPlay()
    }
    
    // 如果音频已经完全加载，立即缓存（同步检查）
    console.log('[SongCache] 检查立即缓存条件：readyState=', audio.readyState, 'HAVE_ENOUGH_DATA=', HTMLMediaElement.HAVE_ENOUGH_DATA, 'pendingCacheTrackRef=', !!pendingCacheTrackRef.current, 'isStreamFromCache=', isStreamFromCacheRef.current)
    if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA && pendingCacheTrackRef.current && !isStreamFromCacheRef.current) {
      const { track, stream, lyrics } = pendingCacheTrackRef.current
      console.log('[SongCache] ✓ 音频已完全加载，立即缓存完整歌曲数据，trackId:', track.id, 'title:', track.title)
      cacheAudioFromElement(track, audio, stream, lyrics).catch((error) => {
        console.error('[SongCache] ✗ 缓存歌曲数据失败:', error)
      })
      pendingCacheTrackRef.current = null
    }
  }, [currentStream, currentTrack?.id, setIsPlaying, setCurrentTime])
  
  // 播放/暂停控制
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentStream) return
    
    // 检查是否是新的歌曲
    const isNewTrack = currentTrack?.id !== currentTrackIdRef.current
    
    if (isPlaying) {
      // 恢复播放时，确保使用保存的播放进度（但新歌曲从 0 开始）
      if (!isNewTrack) {
        const savedTime = usePlayerStore.getState().currentTime
        if (savedTime > 0 && Math.abs(audio.currentTime - savedTime) > 1) {
          // 如果音频的 currentTime 和保存的进度差距超过1秒，使用保存的进度
          audio.currentTime = savedTime
        }
      } else {
        // 新歌曲，确保从 0 开始
        audio.currentTime = 0
      }
      audio.play().catch(() => setIsPlaying(false))
    } else {
      // 暂停时，保存当前播放进度
      if (audio.currentTime > 0) {
        setCurrentTime(audio.currentTime)
      }
      audio.pause()
    }
  }, [isPlaying, currentStream, currentTrack?.id, setIsPlaying, setCurrentTime])
  
  // 音量同步
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
  }, [volume, muted])
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime
      setCurrentTime(newTime)
      // 注意：不在这里更新 Media Session 的播放位置，避免频繁刷新按钮
      // 播放位置只在歌曲变化或播放状态变化时更新
    }
  }
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audio = audioRef.current
      console.log('[Audio] 音频元数据加载成功，trackId:', currentTrack?.id, 'title:', currentTrack?.title, 'duration:', audio.duration, 'isFromCache:', isStreamFromCacheRef.current)
      setDuration(audio.duration)
      // 如果是首次从缓存恢复，且有保存的播放进度，则恢复进度
      // 但如果是新歌曲（track ID 改变），不应该恢复进度
      const isNewTrack = currentTrack?.id !== currentTrackIdRef.current
      if (!hasRestoredProgressRef.current && !isNewTrack) {
        const savedTime = usePlayerStore.getState().currentTime
        if (savedTime > 0 && savedTime < audio.duration) {
          console.log('[Audio] 恢复播放进度:', savedTime)
          audio.currentTime = savedTime
          hasRestoredProgressRef.current = true
        }
      } else if (isNewTrack) {
        // 新歌曲，确保从 0 开始
        audio.currentTime = 0
      }
    }
  }
  
  const handleEnded = () => {
    const next = playNext()
    if (!next) {
      setIsPlaying(false)
    }
  }
  
  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }
  
  const handleRetry = () => {
    console.log('[StreamCache] 用户点击重试，trackId:', currentTrack?.id, 'title:', currentTrack?.title)
    // 重置重试计数器（用户手动重试）
    retryCountRef.current = 0
    lastFailedTrackIdRef.current = undefined
    
    // 不清除缓存，直接尝试重新获取（成功后会自动更新缓存）
    console.log('[StreamCache] 用户手动重试，尝试重新获取音频流（不清除缓存）')
    isStreamFromCacheRef.current = false
    // 清除错误状态
    setError(null)
    // 重新设置 currentStream 为 null，触发重新解析
    setCurrentStream(null)
    // 重新解析流（跳过缓存，直接从网络请求，成功后会自动更新缓存）
    if (currentTrack) {
      resolveStream(true)
    }
  }
  
  const handleAudioError = async (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const audio = e.currentTarget
    const error = audio.error
    const errorCode = error?.code
    const errorMessage = error?.message || '未知错误'
    const currentUrl = audio.src
    
    console.error('[Audio] 音频加载失败，trackId:', currentTrack?.id, 'title:', currentTrack?.title)
    console.error('[Audio] 错误代码:', errorCode, '错误信息:', errorMessage)
    console.error('[Audio] 音频URL:', currentUrl)
    console.error('[Audio] 网络状态:', audio.networkState, '就绪状态:', audio.readyState)
    
    // 检查是否是同一个 trackId 重复失败（防止死循环）
    // 使用 trackId 而不是 URL，因为每次重试 URL 可能会变化
    if (lastFailedTrackIdRef.current === currentTrack?.id) {
      retryCountRef.current += 1
      console.warn('[Audio] 同一歌曲重复失败，重试次数:', retryCountRef.current, 'trackId:', currentTrack?.id)
    } else {
      // 新的歌曲失败，重置计数器
      lastFailedTrackIdRef.current = currentTrack?.id
      retryCountRef.current = 1
      console.log('[Audio] 新歌曲失败，初始化重试次数为 1，trackId:', currentTrack?.id)
    }
    
    // 如果超过最大重试次数，停止重试
    if (retryCountRef.current > maxRetryCount) {
      console.error('[Audio] 超过最大重试次数，停止重试，trackId:', currentTrack?.id, '重试次数:', retryCountRef.current)
      setError(`音频加载失败（已重试 ${maxRetryCount} 次）: ${errorMessage}`)
      // 停止音频元素的自动重试（清除 src 可以阻止浏览器继续尝试加载）
      const audio = audioRef.current
      if (audio && audio.src === currentUrl) {
        console.log('[Audio] 清除音频源，阻止自动重试')
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      // 重置重试标记
      isRetryingRef.current = false
      wasPlayingBeforeRetryRef.current = false
      retryCountRef.current = 0
      lastFailedTrackIdRef.current = undefined
      setIsPlaying(false)
      return
    }
    
    // 如果当前流来自缓存，检查失败原因
    if (isStreamFromCacheRef.current && currentTrack) {
      // 检查是否是 blob URL（音频文件缓存）
      const isBlobUrl = currentUrl.startsWith('blob:')
      
      if (isBlobUrl) {
        // blob URL 失败，可能是浏览器问题或 blob URL 已失效
        // 尝试重新从 IndexedDB 加载音频文件
        console.warn('[StreamCache] blob URL 加载失败，尝试重新从 IndexedDB 加载音频文件，trackId:', currentTrack.id)
        
        // 检查是否是网络错误（不应该影响 blob URL）
        const isNetworkError = errorCode === 4 || errorMessage.includes('network') || errorMessage.includes('ERR_INTERNET_DISCONNECTED')
        if (isNetworkError) {
          // 网络错误不应该影响本地 blob URL，可能是其他问题
          console.warn('[StreamCache] blob URL 在网络错误时失败，可能是浏览器问题')
        }
        
        // 尝试重新加载音频文件
        const loadAudioFile = async () => {
          try {
            const cachedSong = await loadSongCache(currentTrack.id)
            if (cachedSong) {
              // 重新创建 blob URL
              const blobUrl = URL.createObjectURL(cachedSong.audioBlob)
              console.log('[SongCache] 重新从缓存加载完整歌曲成功，创建新的 blob URL')
              
              // 释放旧的 blob URL
              if (currentBlobUrlRef.current) {
                URL.revokeObjectURL(currentBlobUrlRef.current)
              }
              
              // 设置新的音频流
              setCurrentStream({
                url: blobUrl,
                _isBlobUrl: true,
              } as any)
              
              // 如果有缓存的歌词，也设置
              if (cachedSong.lyrics) {
                const lyrics = parseLRC(cachedSong.lyrics)
                if (lyrics.length > 0) {
                  setLyrics(lyrics)
                }
              }
              
              setError(null)
              return true
            }
          } catch (error) {
            console.error('[SongCache] 重新加载歌曲缓存失败:', error)
          }
          return false
        }
        
        // 尝试重新加载，如果失败则显示错误
        const reloaded = await loadAudioFile()
        if (!reloaded) {
          console.error('[StreamCache] 无法重新加载音频文件，显示错误信息')
          setError(`音频加载失败，请点击重试按钮重新获取`)
          // 停止音频元素的自动重试
          const audio = audioRef.current
          if (audio && audio.src === currentUrl) {
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          }
          setIsPlaying(false)
        }
        return
      }
      
      // 非 blob URL（URL 缓存），检查是否是网络错误
      const isNetworkError = errorCode === 4 || errorMessage.includes('network') || errorMessage.includes('ERR_INTERNET_DISCONNECTED')
      
      // 如果是网络错误，保留缓存，只显示错误信息（不自动清除缓存）
      if (isNetworkError) {
        if (retryCountRef.current > maxRetryCount) {
          console.error('[StreamCache] 网络错误且超过重试次数，保留缓存，停止重试，trackId:', currentTrack.id)
          setError(`网络连接失败（已重试 ${maxRetryCount} 次），请检查网络连接。缓存已保留，网络恢复后可继续播放。`)
          // 停止音频元素的自动重试
          const audio = audioRef.current
          if (audio && audio.src === currentUrl) {
            console.log('[Audio] 清除音频源，阻止自动重试')
            audio.pause()
            audio.removeAttribute('src')
            audio.load()
          }
          // 重置重试标记
          isRetryingRef.current = false
          wasPlayingBeforeRetryRef.current = false
          retryCountRef.current = 0
          lastFailedTrackIdRef.current = undefined
          setIsPlaying(false)
        } else {
          // 网络错误但未超过重试次数，只显示错误，不清除缓存
          console.log('[StreamCache] 网络错误，保留缓存，等待网络恢复，重试次数:', retryCountRef.current)
          setError(`网络连接失败，正在重试... (${retryCountRef.current}/${maxRetryCount})`)
        }
        return
      }
      
      // URL 缓存失效（如 410 Gone），不清除缓存，只提示用户可以重试
      console.log('[StreamCache] 缓存的 URL 已失效，需要重新请求，trackId:', currentTrack.id, 'title:', currentTrack.title)
      console.log('[StreamCache] 注意：缓存不会被自动清除，用户可以通过重试按钮重新获取')
      
      // 设置错误信息，提示用户可以重试
      setError(`音频 URL 已失效，请点击重试按钮重新获取`)
      
      // 停止音频元素的自动重试
      const audio = audioRef.current
      if (audio && audio.src === currentUrl) {
        console.log('[Audio] 停止当前音频加载')
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      
      // 重置重试标记
      isRetryingRef.current = false
      wasPlayingBeforeRetryRef.current = false
      retryCountRef.current = 0
      lastFailedTrackIdRef.current = undefined
      setIsPlaying(false)
    } else {
      // 非缓存流失败
      // 检查是否是网络错误（错误代码 4 通常是网络错误）
      const isNetworkError = errorCode === 4 || errorMessage.includes('network') || errorMessage.includes('ERR_INTERNET_DISCONNECTED')
      
      if (isNetworkError && retryCountRef.current <= maxRetryCount) {
        // 网络错误，尝试重试
        console.log('[Audio] 网络错误，尝试重试，重试次数:', retryCountRef.current, '/', maxRetryCount, 'trackId:', currentTrack?.id)
        isRetryingRef.current = true
        wasPlayingBeforeRetryRef.current = isPlaying
        
        // 显示重试提示
        setError(`网络连接失败，正在重试... (${retryCountRef.current}/${maxRetryCount})`)
        
        // 延迟重试，避免立即重试，使用指数退避
        const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000) // 最多10秒
        console.log('[Audio] 将在', delay, '毫秒后重试')
        
        setTimeout(() => {
          // 检查是否仍然是同一首歌曲（防止切换歌曲后仍然重试）
          if (currentTrack && currentTrack.id === lastFailedTrackIdRef.current) {
            console.log('[Audio] 执行重试，重试次数:', retryCountRef.current, 'trackId:', currentTrack.id)
            setError(null)
            setCurrentStream(null)
            resolveStream(true)
          } else {
            console.log('[Audio] 歌曲已切换，取消重试，当前 trackId:', currentTrack?.id, '失败的 trackId:', lastFailedTrackIdRef.current)
            isRetryingRef.current = false
            wasPlayingBeforeRetryRef.current = false
          }
        }, delay)
      } else {
        // 非网络错误或超过重试次数，只设置错误状态
        console.log('[Audio] 音频流加载失败，设置错误状态，重试次数:', retryCountRef.current, 'isNetworkError:', isNetworkError)
        if (retryCountRef.current > maxRetryCount) {
          setError(`音频加载失败（已重试 ${maxRetryCount} 次）: ${errorMessage}`)
        } else {
          setError(`音频加载失败: ${errorMessage}`)
        }
        // 重置重试标记
        isRetryingRef.current = false
        wasPlayingBeforeRetryRef.current = false
        retryCountRef.current = 0
        lastFailedTrackIdRef.current = undefined
        
        // 停止音频元素的自动重试
        const audio = audioRef.current
        if (audio && audio.src === currentUrl) {
          console.log('[Audio] 清除音频源，阻止自动重试')
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
        setIsPlaying(false)
      }
    }
  }
  
  return (
    <div className="h-screen h-[100dvh] flex flex-col relative overflow-hidden grid-bg">
      {/* 全局音频元素 */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleAudioError}
        preload="auto"
      />
      
      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-[100px]" />
      </div>
      
      {/* 头部 */}
      <header className="relative z-50 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
          <motion.div 
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
              <Music2 className="w-5 h-5 text-surface-950" />
            </div>
            <h1 className="font-display font-semibold text-lg text-surface-100">
              MusicFree<span className="text-primary-400">H5</span>
            </h1>
          </motion.div>
          
          <motion.div
            className="relative z-50 flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            data-plugin-select
          >
            {/* 刷新按钮 */}
            {activePluginId && (
              <button
                type="button"
                onClick={handleRefresh}
                className="glass rounded-xl p-2 flex items-center justify-center hover:bg-surface-700/50 transition-colors"
                title="刷新页面"
              >
                <RefreshCw className="w-4 h-4 text-surface-400" />
              </button>
            )}
            
            <button
              type="button"
              onClick={() => setShowPluginSelect(!showPluginSelect)}
              className="glass rounded-xl px-3 py-2 flex items-center gap-2 text-left hover:bg-surface-700/50 transition-colors"
            >
              <Radio className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-surface-200 max-w-[120px] truncate">
                {activePlugin?.meta.name || '选择源'}
              </span>
              <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${showPluginSelect ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showPluginSelect && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute z-[100] top-full right-0 mt-2 w-48 glass rounded-xl overflow-hidden max-h-64 overflow-y-auto"
                >
                  {readyPlugins.length === 0 ? (
                    <div className="px-4 py-6 text-center text-surface-400 text-sm">
                      暂无可用插件
                    </div>
                  ) : (
                    readyPlugins.map((plugin) => (
                      <button
                        key={plugin.meta.id}
                        type="button"
                        onClick={() => {
                          // 用户手动切换插件时强制刷新数据
                          setActivePlugin(plugin.meta.id, true)
                          setShowPluginSelect(false)
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-surface-700/50 transition-colors ${
                          activePluginId === plugin.meta.id ? 'bg-primary-500/10' : ''
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          activePluginId === plugin.meta.id ? 'bg-primary-400' : 'bg-surface-500'
                        }`} />
                        <span className="text-sm text-surface-200 truncate">{plugin.meta.name}</span>
                      </button>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </header>
      
      {/* 主内容区 - 需要给底部导航留出空间 */}
      <main className="flex-1 relative z-10 overflow-hidden pb-[65px]">
        <div className="h-full relative">
          <div
            className={`absolute inset-0 h-full overflow-hidden transition-opacity duration-200 ${
              activeTab === 'search' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <SearchView />
          </div>
          <div
            className={`absolute inset-0 h-full overflow-hidden transition-opacity duration-200 ${
              activeTab === 'playlist' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <PlaylistView />
          </div>
          <div
            className={`absolute inset-0 h-full overflow-hidden transition-opacity duration-200 ${
              activeTab === 'plugins' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
            }`}
          >
            <PluginManager />
          </div>
        </div>
      </main>
      
      {/* 迷你播放器 - 固定在底部导航上方 */}
      <AnimatePresence>
        {currentTrack && !showPlayer && (
          <MiniPlayer onExpand={() => setShowPlayer(true)} onRetry={handleRetry} />
        )}
      </AnimatePresence>
      
      {/* 底部导航 - 固定在底部 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe bg-gradient-to-t from-surface-950 via-surface-950/95 to-transparent pt-3.5">
        <div className="glass rounded-2xl p-1.5 max-w-2xl mx-auto w-full mb-2">
          <div className="flex">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-row items-center justify-center gap-2 py-2 px-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400' 
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <tab.icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'drop-shadow-[0_0_8px_rgba(237,116,30,0.5)]' : ''}`} />
                  <span className="text-[11px] font-medium">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
      
      {/* 全屏播放器 */}
      <AnimatePresence>
        {showPlayer && (
          <Player onClose={() => setShowPlayer(false)} onSeek={handleSeek} onRetry={handleRetry} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
