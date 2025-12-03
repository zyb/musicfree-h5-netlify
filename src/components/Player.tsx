import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  ChevronDown, 
  SkipBack, 
  SkipForward, 
  Play, 
  Pause,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Volume2,
  VolumeX,
  Loader2,
} from 'lucide-react'
import { usePlayerStore, PlayMode } from '../stores/playerStore'
import { getCurrentLyricIndex } from '../utils/lyricParser'

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const playModeIcons: Record<PlayMode, typeof Repeat> = {
  sequence: ListMusic,
  repeat: Repeat,
  single: Repeat1,
  shuffle: Shuffle,
}

const playModeLabels: Record<PlayMode, string> = {
  sequence: '顺序播放',
  repeat: '列表循环',
  single: '单曲循环',
  shuffle: '随机播放',
}

interface PlayerProps {
  onClose: () => void
  onSeek: (time: number) => void
}

export function Player({ onClose, onSeek }: PlayerProps) {
  const {
    currentTrack,
    currentStream,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    volume,
    muted,
    playMode,
    lyrics,
    setIsPlaying,
    setVolume,
    toggleMute,
    setPlayMode,
    playNext,
    playPrevious,
  } = usePlayerStore()

  const [showLyricsOnly, setShowLyricsOnly] = useState(false)
  const lyricContainerRef = useRef<HTMLDivElement>(null)
  const userScrollingRef = useRef(false) // 用户是否正在滚动
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 滚动超时定时器
  const lastAutoScrollIndexRef = useRef(-1) // 上次自动滚动的歌词索引
  
  // 使用 useMemo 确保 currentLyricIndex 正确计算
  // 注意：currentTime 会频繁更新，但只有当索引真正变化时才需要重新渲染
  const currentLyricIndex = useMemo(() => {
    const index = getCurrentLyricIndex(lyrics, currentTime)
    return index
  }, [lyrics, currentTime])

  // 滚动到指定歌词行（确保歌词在容器中间）
  const scrollToLyric = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (!lyricContainerRef.current || index < 0) {
      return
    }
    
    const container = lyricContainerRef.current
    
    // 方法1: 尝试通过 data-lyric-index 属性查找
    const lyricElementByAttr = container.querySelector(`[data-lyric-index="${index}"]`) as HTMLElement
    
    // 方法2: 如果方法1失败，尝试通过 children 查找
    let lyricElement = lyricElementByAttr
    if (!lyricElement) {
      const innerContainer = container.firstElementChild as HTMLElement
      if (innerContainer && innerContainer.children[index]) {
        lyricElement = innerContainer.children[index] as HTMLElement
      }
    }
    
    if (!lyricElement) {
      return
    }
    
    // 使用 scrollIntoView 方法，确保歌词在容器中间
    try {
      lyricElement.scrollIntoView({
        behavior,
        block: 'center',
        inline: 'nearest',
      })
    } catch (error) {
      // 回退到手动计算，确保精确居中
      const containerRect = container.getBoundingClientRect()
      const elementRect = lyricElement.getBoundingClientRect()
      const scrollTop = container.scrollTop
      
      // 计算目标位置：元素顶部 - 容器高度的一半 + 元素高度的一半
      const targetScrollTop = scrollTop + (elementRect.top - containerRect.top) - (containerRect.height / 2) + (elementRect.height / 2)
      
      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior,
      })
    }
  }, [])

  // 处理用户滚动
  const handleLyricScroll = useCallback(() => {
    if (!lyricContainerRef.current) return
    
    // 标记用户正在滚动
    userScrollingRef.current = true
    
    // 清除之前的定时器
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    // 5秒后恢复自动滚动
    scrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false
      // 恢复后立即滚动到当前歌词行
      const currentIndex = getCurrentLyricIndex(lyrics, currentTime)
      if (currentIndex >= 0) {
        scrollToLyric(currentIndex)
        lastAutoScrollIndexRef.current = currentIndex
      }
    }, 5000)
  }, [lyrics, currentTime, scrollToLyric])

  // 处理歌词行点击
  const handleLyricClick = useCallback((line: { time: number; text: string }) => {
    onSeek(line.time)
    // 立即滚动到这一行
    const index = lyrics.findIndex(l => l.time === line.time)
    if (index >= 0) {
      scrollToLyric(index, 'smooth')
      lastAutoScrollIndexRef.current = index
      // 重置用户滚动标志，允许自动滚动
      userScrollingRef.current = false
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [lyrics, onSeek, scrollToLyric])

  // 当切换到仅歌词模式时，自动定位到当前歌词
  useEffect(() => {
    if (showLyricsOnly && lyrics.length > 0 && currentLyricIndex >= 0) {
      // 延迟一下确保DOM已渲染
      const timer = setTimeout(() => {
        if (lyricContainerRef.current && !userScrollingRef.current) {
          scrollToLyric(currentLyricIndex, 'smooth')
          lastAutoScrollIndexRef.current = currentLyricIndex
          userScrollingRef.current = false // 重置滚动标志
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [showLyricsOnly, lyrics.length, currentLyricIndex, scrollToLyric])

  // 当歌词加载完成时，自动定位到当前歌词
  useEffect(() => {
    if (lyrics.length > 0 && currentLyricIndex >= 0 && !userScrollingRef.current) {
      // 延迟一下确保DOM已渲染
      const timer = setTimeout(() => {
        if (lyricContainerRef.current && !userScrollingRef.current) {
          scrollToLyric(currentLyricIndex, 'smooth')
          lastAutoScrollIndexRef.current = currentLyricIndex
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [lyrics.length, currentLyricIndex, scrollToLyric])

  // 自动滚动到当前歌词行（仅在用户未主动滚动时）
  // 这是主要的自动滚动逻辑，响应 currentTime 的变化
  useEffect(() => {
    // 只有在有歌词且索引有效时才滚动
    if (lyrics.length === 0 || currentLyricIndex < 0) {
      return
    }
    
    // 如果用户正在滚动，不自动滚动
    if (userScrollingRef.current) {
      return
    }
    
    // 确保容器存在
    if (!lyricContainerRef.current) {
      // 延迟一下，等待DOM渲染
      const timer = setTimeout(() => {
        if (lyricContainerRef.current && !userScrollingRef.current) {
          scrollToLyric(currentLyricIndex, 'smooth')
          lastAutoScrollIndexRef.current = currentLyricIndex
        }
      }, 100)
      return () => clearTimeout(timer)
    }
    
    // 如果索引变化了，立即滚动到新位置
    if (currentLyricIndex !== lastAutoScrollIndexRef.current) {
      // 使用 requestAnimationFrame 确保在下一帧执行，DOM 已更新
      const rafId = requestAnimationFrame(() => {
        if (!lyricContainerRef.current || userScrollingRef.current) {
          return
        }
        
        // 执行滚动，确保歌词在中间
        scrollToLyric(currentLyricIndex, 'smooth')
        lastAutoScrollIndexRef.current = currentLyricIndex
      })
      
      return () => cancelAnimationFrame(rafId)
    }
    
    // 即使索引没变化，也定期检查并确保歌词在中间位置（防止滚动偏移）
    // 使用较长的间隔，避免过于频繁的滚动
    const checkInterval = setInterval(() => {
      if (!lyricContainerRef.current || userScrollingRef.current) {
        return
      }
      
      // 检查当前歌词是否在可视区域中间
      const container = lyricContainerRef.current
      const lyricElement = container.querySelector(`[data-lyric-index="${currentLyricIndex}"]`) as HTMLElement
      
      if (lyricElement) {
        const containerRect = container.getBoundingClientRect()
        const elementRect = lyricElement.getBoundingClientRect()
        const elementCenter = elementRect.top + elementRect.height / 2
        const containerCenter = containerRect.top + containerRect.height / 2
        const offset = Math.abs(elementCenter - containerCenter)
        
        // 如果偏移超过容器高度的 10%，重新居中
        if (offset > containerRect.height * 0.1) {
          scrollToLyric(currentLyricIndex, 'smooth')
        }
      }
    }, 500) // 每 500ms 检查一次
    
    return () => clearInterval(checkInterval)
  }, [currentLyricIndex, currentTime, scrollToLyric, lyrics.length])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    onSeek(time)
  }
  
  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }
  
  const cyclePlayMode = () => {
    const modes: PlayMode[] = ['sequence', 'repeat', 'single', 'shuffle']
    const currentIndex = modes.indexOf(playMode)
    const nextMode = modes[(currentIndex + 1) % modes.length]
    setPlayMode(nextMode)
  }
  
  const PlayModeIcon = playModeIcons[playMode]
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-surface-900 via-surface-950 to-black flex flex-col"
    >
      {/* 头部 */}
      <header className="flex items-center justify-between px-4 py-4 pt-safe">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-xs text-surface-500 uppercase tracking-wider">正在播放</p>
        </div>
        <div className="w-10" />
      </header>
      
      {/* 封面和歌词 - 可点击切换显示模式 */}
      <div 
        className="flex-1 flex flex-col items-center justify-center px-8 py-6 overflow-hidden cursor-pointer"
        onClick={() => setShowLyricsOnly(!showLyricsOnly)}
      >
        {showLyricsOnly ? (
          /* 仅显示歌词模式 */
          lyrics.length > 0 ? (
            <div 
              ref={lyricContainerRef}
              className="flex-1 w-full max-w-2xl overflow-y-auto scrollbar-thin scrollbar-thumb-surface-700 scrollbar-track-transparent"
              style={{ minHeight: 0 }} // 确保 flex-1 能正确计算高度
              onClick={(e) => e.stopPropagation()}
              onScroll={handleLyricScroll}
            >
              <div className="space-y-4 px-4 py-8">
                {lyrics.map((line, index) => {
                  const isActive = index === currentLyricIndex
                  return (
                    <div
                      key={index}
                      data-lyric-index={index}
                      onClick={() => handleLyricClick(line)}
                      className={`text-center transition-all duration-300 cursor-pointer ${
                        isActive
                          ? 'text-primary-400 text-xl font-medium scale-105'
                          : 'text-surface-400 text-base opacity-60 hover:opacity-80'
                      }`}
                    >
                      {line.text || ' '}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">
              暂无歌词
            </div>
          )
        ) : (
          /* 封面和歌词同时显示模式 */
          <>
            {/* 封面 */}
            <motion.div
              animate={{ rotate: isPlaying ? 360 : 0 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
              style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              className="relative flex-shrink-0 mb-4"
            >
              <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden shadow-2xl shadow-black/50 border-8 border-surface-800">
                {currentTrack?.coverUrl ? (
                  <img
                    src={currentTrack.coverUrl}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-surface-800 border-4 border-surface-700" />
                  </div>
                )}
              </div>
              {/* 唱片中心 */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-20 h-20 rounded-full bg-surface-900 border-4 border-surface-700 shadow-inner flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-surface-600" />
                </div>
              </div>
            </motion.div>

            {/* 歌词显示区域 */}
            {lyrics.length > 0 ? (
              <div 
                ref={lyricContainerRef}
                className="flex-1 w-full max-w-lg overflow-y-auto scrollbar-thin scrollbar-thumb-surface-700 scrollbar-track-transparent"
                style={{ maxHeight: '40vh', minHeight: 0 }}
                onClick={(e) => e.stopPropagation()}
                onScroll={handleLyricScroll}
              >
                <div className="space-y-3 px-4 py-2">
                  {lyrics.map((line, index) => {
                    const isActive = index === currentLyricIndex
                    return (
                      <div
                        key={index}
                        data-lyric-index={index}
                        onClick={() => handleLyricClick(line)}
                        className={`text-center transition-all duration-300 cursor-pointer ${
                          isActive
                            ? 'text-primary-400 text-lg font-medium scale-105'
                            : 'text-surface-400 text-sm hover:opacity-80'
                        }`}
                      >
                        {line.text || ' '}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-surface-500 text-sm">
                暂无歌词
              </div>
            )}
          </>
        )}
      </div>
      
      {/* 歌曲信息 */}
      <div className="px-6 pb-4 text-center">
        <h2 className="font-display font-semibold text-xl text-surface-100 truncate">
          {currentTrack?.title || '未选择歌曲'}
        </h2>
        <p className="text-surface-400 text-sm mt-1 truncate">
          {currentTrack?.artists?.join(' / ') || '未知艺术家'}
        </p>
      </div>
      
      {/* 进度条 */}
      <div className="px-6 pb-6">
        <div className="relative">
          <div className="absolute inset-0 h-1 bg-surface-700 rounded-full top-1/2 -translate-y-1/2">
            <div 
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-4 relative z-10"
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-surface-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      
      {/* 播放控制 */}
      <div className="px-6 pb-8">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={cyclePlayMode}
            className="w-10 h-10 flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors"
            title={playModeLabels[playMode]}
          >
            <PlayModeIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => playPrevious()}
            className="w-12 h-12 flex items-center justify-center text-surface-300 hover:text-surface-100 transition-colors"
          >
            <SkipBack className="w-6 h-6" fill="currentColor" />
          </button>
          
          <button
            onClick={togglePlay}
            disabled={isLoading || !currentStream}
            className="w-16 h-16 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center shadow-lg shadow-primary-500/40 hover:bg-primary-400 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {isLoading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-7 h-7" fill="currentColor" />
            ) : (
              <Play className="w-7 h-7 ml-1" fill="currentColor" />
            )}
          </button>
          
          <button
            onClick={() => playNext()}
            className="w-12 h-12 flex items-center justify-center text-surface-300 hover:text-surface-100 transition-colors"
          >
            <SkipForward className="w-6 h-6" fill="currentColor" />
          </button>
          
          <button
            onClick={toggleMute}
            className="w-10 h-10 flex items-center justify-center text-surface-400 hover:text-surface-200 transition-colors"
          >
            {muted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* 音量条 */}
        <div className="flex items-center justify-center gap-3 mt-6 px-12">
          <VolumeX className="w-4 h-4 text-surface-500" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-4"
          />
          <Volume2 className="w-4 h-4 text-surface-500" />
        </div>
      </div>
    </motion.div>
  )
}
