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
    playNext,
  } = usePlayerStore()
  
  useEffect(() => {
    init()
  }, [init])
  
  // 解析音频流
  const resolveStream = useCallback(async () => {
    if (!currentTrack) return
    
    if (currentTrack.streamUrl) {
      setCurrentStream({ url: currentTrack.streamUrl })
      return
    }
    
    const plugin = getActivePluginInstance()
    if (!plugin?.resolveStream) {
      setError('无法解析音频地址')
      return
    }
    
    setIsLoading(true)
    try {
      const stream = await plugin.resolveStream(currentTrack)
      setCurrentStream(stream)
    } catch (error) {
      setError(error instanceof Error ? error.message : '解析失败')
    } finally {
      setIsLoading(false)
    }
  }, [currentTrack, getActivePluginInstance, setCurrentStream, setError, setIsLoading])
  
  // 当 currentTrack 改变时解析流
  useEffect(() => {
    if (currentTrack && !currentStream) {
      resolveStream()
    }
  }, [currentTrack, currentStream, resolveStream])
  
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
