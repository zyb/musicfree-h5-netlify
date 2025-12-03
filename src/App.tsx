import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2, Rss, ListMusic, Search } from 'lucide-react'
import { usePluginStore } from './stores/pluginStore'
import { usePlayerStore } from './stores/playerStore'
import { proxyMediaUrl } from './lib/pluginHost'
import { Player } from './components/Player'
import { SearchView } from './components/SearchView'
import { PlaylistView } from './components/PlaylistView'
import { PluginManager } from './components/PluginManager'
import { MiniPlayer } from './components/MiniPlayer'
import { parseLRC } from './utils/lyricParser'
import { getLyricFromCache } from './lib/pluginHost'

type TabId = 'search' | 'playlist' | 'plugins'

const tabs = [
  { id: 'search' as const, icon: Search, label: '搜索' },
  { id: 'playlist' as const, icon: ListMusic, label: '列表' },
  { id: 'plugins' as const, icon: Rss, label: '订阅' },
]

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('search')
  const [showPlayer, setShowPlayer] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const init = usePluginStore((s) => s.init)
  const getActivePluginInstance = usePluginStore((s) => s.getActivePluginInstance)
  
  const {
    currentTrack,
    currentStream,
    isPlaying,
    volume,
    muted,
    setIsPlaying,
    setIsLoading,
    setDuration,
    setCurrentTime,
    setCurrentStream,
    setError,
    setLyrics,
    updateCurrentTrackExtra,
    playNext,
  } = usePlayerStore()
  
  useEffect(() => {
    init()
  }, [init])
  
  // 解析音频流
  const resolveStream = useCallback(async () => {
    if (!currentTrack) {
      console.log('[歌词调试] resolveStream: currentTrack 为空')
      return
    }
    
    console.log('[歌词调试] resolveStream 开始，currentTrack:', {
      id: currentTrack.id,
      title: currentTrack.title,
      extra: currentTrack.extra,
    })
    
    if (currentTrack.streamUrl) {
      console.log('[歌词调试] 使用 streamUrl:', currentTrack.streamUrl)
      setCurrentStream({ url: currentTrack.streamUrl })
      return
    }
    
    // 尝试直接调用原生插件的 getMediaSource，以获取完整数据（包括歌词）
    const host = (globalThis as any).MusicFreeH5
    console.log('[歌词调试] host 存在:', !!host)
    
    if (host && currentTrack.extra) {
      const loadedPlugins = host.getLoadedPlugins?.() || []
      const activePluginId = usePluginStore.getState().activePluginId
      console.log('[歌词调试] activePluginId:', activePluginId, 'loadedPlugins 数量:', loadedPlugins.length)
      
      const activePlugin = loadedPlugins.find((p: any) => p.meta?.id === activePluginId)
      console.log('[歌词调试] activePlugin 找到:', !!activePlugin, '有 getMediaSource:', !!activePlugin?.instance?.getMediaSource)
      
      if (activePlugin?.instance?.getMediaSource) {
        setIsLoading(true)
        try {
          const qualities = ['128', 'standard', '320', 'high', 'low', 'super']
          for (const quality of qualities) {
            try {
              console.log(`[歌词调试] 尝试获取媒体源，quality: ${quality}`)
              // getMediaSource 可能返回包含 lrc 的完整数据
              const result = await activePlugin.instance.getMediaSource(currentTrack.extra as any, quality)
              console.log(`[歌词调试] getMediaSource 返回结果 (quality: ${quality}):`, {
                url: result?.url,
                hasLrc: !!(result as any)?.lrc,
                lrcLength: (result as any)?.lrc?.length,
                lrcPreview: (result as any)?.lrc?.substring(0, 100),
                fullResult: result,
              })
              
              if (result?.url) {
                // 如果返回的数据中包含 lrc，更新 track 的 extra
                const resultWithLrc = result as { url: string; lrc?: string; [key: string]: unknown }
                if (resultWithLrc.lrc && typeof resultWithLrc.lrc === 'string') {
                  console.log('[歌词调试] 找到歌词，更新 track.extra，歌词长度:', resultWithLrc.lrc.length)
                  updateCurrentTrackExtra({ lrc: resultWithLrc.lrc })
                  // 立即解析歌词
                  const lyrics = parseLRC(resultWithLrc.lrc)
                  console.log('[歌词调试] 解析歌词结果，行数:', lyrics.length, '前3行:', lyrics.slice(0, 3))
                  if (lyrics.length > 0) {
                    setLyrics(lyrics)
                    console.log('[歌词调试] 歌词已设置到 store')
                  } else {
                    console.warn('[歌词调试] 解析后的歌词为空')
                  }
                } else {
                  console.log('[歌词调试] 返回结果中没有 lrc 字段')
                }
                setCurrentStream({ url: result.url })
                setIsLoading(false)
                return
              }
            } catch (error) {
              console.log(`[歌词调试] getMediaSource 失败 (quality: ${quality}):`, error)
              continue
            }
          }
        } catch (error) {
          console.error('[歌词调试] resolveStream 错误:', error)
          setError(error instanceof Error ? error.message : '解析失败')
        } finally {
          setIsLoading(false)
        }
      }
    }
    
    // 回退到使用插件的 resolveStream 方法
    console.log('[歌词调试] 回退到使用插件的 resolveStream 方法')
    const plugin = getActivePluginInstance()
    if (!plugin?.resolveStream) {
      console.error('[歌词调试] 插件没有 resolveStream 方法')
      setError('无法解析音频地址')
      return
    }
    
    setIsLoading(true)
    try {
      const stream = await plugin.resolveStream(currentTrack) as { url: string; _lrc?: string }
      console.log('[歌词调试] 插件 resolveStream 返回:', {
        url: stream?.url,
        hasLrc: !!stream?._lrc,
        lrcLength: stream?._lrc?.length,
        lrcPreview: stream?._lrc?.substring(0, 100),
      })
      
      // 如果返回的数据中包含 _lrc（临时字段），提取并保存
      if (stream?._lrc) {
        console.log('[歌词调试] 从 resolveStream 返回中提取到歌词，长度:', stream._lrc.length)
        updateCurrentTrackExtra({ lrc: stream._lrc })
        // 立即解析歌词
        const lyrics = parseLRC(stream._lrc)
        console.log('[歌词调试] 解析歌词结果，行数:', lyrics.length)
        if (lyrics.length > 0) {
          setLyrics(lyrics)
          console.log('[歌词调试] 歌词已设置到 store')
        }
      }
      
      // 只传递 url 给 setCurrentStream
      setCurrentStream({ url: stream.url })
    } catch (error) {
      console.error('[歌词调试] 插件 resolveStream 错误:', error)
      setError(error instanceof Error ? error.message : '解析失败')
    } finally {
      setIsLoading(false)
    }
  }, [currentTrack, getActivePluginInstance, setCurrentStream, setError, setIsLoading, updateCurrentTrackExtra, setLyrics])
  
  // 获取歌词（从 track.extra 或缓存中读取）
  const fetchLyrics = useCallback(() => {
    console.log('[歌词调试] fetchLyrics 被调用')
    
    if (!currentTrack) {
      console.log('[歌词调试] fetchLyrics: currentTrack 为空')
      setLyrics([])
      return
    }

    try {
      // 首先从 track.extra 中读取 lrc 字段
      const extra = currentTrack.extra as { lrc?: string; rid?: string; [key: string]: unknown } | undefined
      console.log('[歌词调试] fetchLyrics - currentTrack.extra:', {
        hasExtra: !!extra,
        hasLrc: !!extra?.lrc,
        lrcType: typeof extra?.lrc,
        lrcLength: typeof extra?.lrc === 'string' ? extra.lrc.length : 0,
        lrcPreview: typeof extra?.lrc === 'string' ? extra.lrc.substring(0, 100) : undefined,
        extraKeys: extra ? Object.keys(extra) : [],
        rid: extra?.rid,
      })
      
      let lrcText: string | undefined = extra?.lrc
      
      // 如果 extra 中没有 lrc，尝试从缓存中获取
      if (!lrcText) {
        // 尝试多个可能的 trackId：rid、id、以及它们的字符串形式
        const possibleIds = [
          extra?.rid,
          currentTrack.id,
          String(extra?.rid || ''),
          String(currentTrack.id),
        ].filter(Boolean) as string[]
        
        console.log('[歌词调试] 尝试从缓存获取歌词，可能的 trackId:', possibleIds)
        
        for (const trackId of possibleIds) {
          lrcText = getLyricFromCache(trackId)
          if (lrcText) {
            console.log('[歌词调试] 从缓存中找到歌词，使用的 trackId:', trackId, '歌词长度:', lrcText.length)
            // 保存到 track.extra 中，同时保存 rid（如果找到了）
            const updateData: { lrc: string; rid?: string } = { lrc: lrcText }
            if (extra?.rid || trackId === extra?.rid || trackId === String(extra?.rid)) {
              updateData.rid = extra?.rid || trackId
            }
            updateCurrentTrackExtra(updateData)
            break
          }
        }
        
        if (!lrcText) {
          console.log('[歌词调试] 缓存中也没有找到歌词')
        }
      }
      
      if (lrcText) {
        console.log('[歌词调试] 找到 lrc 文本，长度:', lrcText.length, '前100字符:', lrcText.substring(0, 100))
        
        if (lrcText && typeof lrcText === 'string' && lrcText.trim()) {
          const lyrics = parseLRC(lrcText)
          console.log('[歌词调试] 解析歌词结果，行数:', lyrics.length)
          if (lyrics.length > 0) {
            console.log('[歌词调试] 前5行歌词:', lyrics.slice(0, 5))
            setLyrics(lyrics)
            console.log('[歌词调试] 歌词已设置到 store')
            return
          } else {
            console.warn('[歌词调试] 解析后的歌词为空，原始文本:', lrcText.substring(0, 200))
          }
        } else {
          console.warn('[歌词调试] lrc 文本无效:', { lrcText, type: typeof lrcText, isEmpty: !lrcText?.trim() })
        }
      } else {
        console.log('[歌词调试] 没有找到歌词（extra 和缓存都没有）')
      }

      // 如果没有找到歌词，清空
      console.log('[歌词调试] 没有找到歌词，清空歌词列表')
      setLyrics([])
    } catch (error) {
      console.error('[歌词调试] fetchLyrics 错误:', error)
      setLyrics([])
    }
  }, [currentTrack, setLyrics, updateCurrentTrackExtra])

  // 监听歌词更新事件
  useEffect(() => {
    const handleLyricUpdated = (event: CustomEvent<{ trackId: string; lrc: string; rid?: string }>) => {
      console.log('[歌词调试] 收到歌词更新事件:', event.detail)
      if (!currentTrack) {
        console.log('[歌词调试] 当前没有播放歌曲，忽略歌词更新事件')
        return
      }
      
      const extra = currentTrack.extra as { rid?: string; [key: string]: unknown } | undefined
      const currentRid = extra?.rid
      const currentId = currentTrack.id
      const eventTrackId = event.detail.trackId
      const eventRid = event.detail.rid || event.detail.trackId
      
      console.log('[歌词调试] 匹配检查:', {
        currentId,
        currentRid,
        eventTrackId,
        eventRid,
        idMatch: currentId === eventTrackId || currentId === eventRid,
        ridMatch: currentRid === eventTrackId || currentRid === eventRid,
      })
      
      // 匹配逻辑：id 或 rid 任一匹配即可
      if (currentId === eventTrackId || currentId === eventRid || 
          currentRid === eventTrackId || currentRid === eventRid) {
        console.log('[歌词调试] 歌词更新事件匹配当前歌曲，更新歌词')
        // 同时更新 lrc 和 rid（如果事件中有 rid）
        const updateData: { lrc: string; rid?: string } = { lrc: event.detail.lrc }
        if (eventRid) {
          updateData.rid = eventRid
        }
        updateCurrentTrackExtra(updateData)
        // 延迟一下确保 extra 已更新
        setTimeout(() => fetchLyrics(), 50)
      } else {
        console.log('[歌词调试] 歌词更新事件不匹配当前歌曲，忽略')
      }
    }
    
    window.addEventListener('lyricUpdated', handleLyricUpdated as EventListener)
    return () => {
      window.removeEventListener('lyricUpdated', handleLyricUpdated as EventListener)
    }
  }, [currentTrack, updateCurrentTrackExtra, fetchLyrics])

  // 当 currentTrack 改变时解析流和获取歌词
  useEffect(() => {
    if (currentTrack) {
      // 先尝试从现有数据中获取歌词
      fetchLyrics()
      
      if (!currentStream) {
        // 解析流时会自动提取并保存歌词
        resolveStream()
      }
    }
  }, [currentTrack, currentStream, resolveStream, fetchLyrics])
  
  // 当 currentStream 改变时加载音频
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentStream) return
    
    // 使用代理 URL 避免 CORS 问题
    audio.src = proxyMediaUrl(currentStream.url)
    audio.load()
    
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    }
  }, [currentStream])
  
  // 播放/暂停控制
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !currentStream) return
    
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, currentStream, setIsPlaying])
  
  // 音量同步
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.muted = muted
  }, [volume, muted])
  
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }
  
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
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
  
  return (
    <div className="h-screen h-[100dvh] flex flex-col relative overflow-hidden grid-bg">
      {/* 全局音频元素 */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setError('音频加载失败')}
        preload="auto"
      />
      
      {/* 背景装饰 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary-600/10 rounded-full blur-[100px]" />
      </div>
      
      {/* 头部 */}
      <header className="relative z-10 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
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
          
          <motion.p 
            className="text-xs text-surface-400 hidden sm:block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            插件驱动 · 无内置音源
          </motion.p>
        </div>
      </header>
      
      {/* 主内容区 - 需要给底部导航留出空间 */}
      <main className="flex-1 relative z-10 overflow-hidden pb-[76px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-hidden"
          >
            {activeTab === 'search' && <SearchView />}
            {activeTab === 'playlist' && <PlaylistView />}
            {activeTab === 'plugins' && <PluginManager />}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* 迷你播放器 - 固定在底部导航上方 */}
      <AnimatePresence>
        {currentTrack && !showPlayer && (
          <MiniPlayer onExpand={() => setShowPlayer(true)} />
        )}
      </AnimatePresence>
      
      {/* 底部导航 - 固定在底部 */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-safe bg-gradient-to-t from-surface-950 via-surface-950/95 to-transparent pt-4">
        <div className="glass rounded-2xl p-1.5 max-w-md mx-auto mb-2">
          <div className="flex">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-3 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary-500/20 text-primary-400' 
                      : 'text-surface-400 hover:text-surface-200'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(237,116,30,0.5)]' : ''}`} />
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
          <Player onClose={() => setShowPlayer(false)} onSeek={handleSeek} />
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
