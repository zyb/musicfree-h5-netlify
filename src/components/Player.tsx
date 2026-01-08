import { useEffect, useRef } from 'react'
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
  RotateCw,
} from 'lucide-react'
import { usePlayerStore, PlayMode } from '../stores/playerStore'
import { getCurrentLyricIndex } from '../lib/lyrics'

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
  onRetry?: () => void
}

export function Player({ onClose, onSeek, onRetry }: PlayerProps) {
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
    error,
    setIsPlaying,
    setVolume,
    toggleMute,
    setPlayMode,
    playNext,
    playPrevious,
  } = usePlayerStore()
  
  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const lyricsContentRef = useRef<HTMLDivElement>(null)
  const lyricElementsRef = useRef<Map<number, HTMLElement>>(new Map())
  const currentLyricIndex = getCurrentLyricIndex(lyrics, currentTime)
  const scrollAnimationRef = useRef<number>()
  const lastLyricIndexRef = useRef<number>(-1)
  const lastTrackIdRef = useRef<string | undefined>(undefined)
  const isUserScrollingRef = useRef<boolean>(false)
  const userScrollTimeoutRef = useRef<number>()
  const isProgrammaticScrollRef = useRef<boolean>(false)
  const hasInitializedScrollRef = useRef<boolean>(false)
  
  /**
   * 将指定歌词滚动到容器中心位置
   */
  const scrollLyricToCenter = (lyricIndex: number, immediate = false) => {
    const container = lyricsContainerRef.current
    
    if (!container) return
    
    const lyricElement = lyricElementsRef.current.get(lyricIndex)
    if (!lyricElement) return
    
    // 1. 确定歌词展示区域（容器）和中心位置
    const containerHeight = container.clientHeight
    const containerCenter = containerHeight / 2
    
    // 2. 获取元素和容器的位置信息
    const elementRect = lyricElement.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    
    // 3. 计算元素中心点相对于容器顶部的距离
    const elementCenter = elementRect.top - containerRect.top + elementRect.height / 2
    
    // 4. 计算需要滚动的距离：使元素中心对齐容器中心
    const scrollDistance = elementCenter - containerCenter
    
    // 5. 如果距离很小，不需要滚动
    if (Math.abs(scrollDistance) < 1) return
    
    // 6. 清除之前的滚动动画
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current)
    }
    
    if (immediate) {
      // 立即滚动（用于歌曲切换时）
      isProgrammaticScrollRef.current = true
      container.scrollTop += scrollDistance
      // 延迟重置标记，确保 scroll 事件能检测到
      setTimeout(() => {
        isProgrammaticScrollRef.current = false
      }, 50)
      return
    }
    
    // 7. 平滑滚动动画
    let startTime: number | null = null
    const startScrollTop = container.scrollTop
    const targetScrollTop = startScrollTop + scrollDistance
    const duration = 400 // 动画时长（毫秒）
    
    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp
      }
      
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // 使用 ease-out 缓动函数
      const easeOut = 1 - Math.pow(1 - progress, 3)
      
      // 标记为程序滚动
      isProgrammaticScrollRef.current = true
      container.scrollTop = startScrollTop + scrollDistance * easeOut
      
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animate)
      } else {
        // 动画完成，精确定位
        container.scrollTop = targetScrollTop
        // 延迟重置标记，确保 scroll 事件能检测到
        setTimeout(() => {
          isProgrammaticScrollRef.current = false
        }, 50)
      }
    }
    
    scrollAnimationRef.current = requestAnimationFrame(animate)
  }
  
  // 检测用户手动滚动和其他交互操作
  useEffect(() => {
    const container = lyricsContainerRef.current
    if (!container) return
    
    const handleUserInteraction = () => {
      // 标记用户正在操作
      isUserScrollingRef.current = true
      
      // 清除之前的定时器
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
      
      // 用户停止操作 3 秒后，允许自动居中
      userScrollTimeoutRef.current = window.setTimeout(() => {
        isUserScrollingRef.current = false
      }, 3000)
    }
    
    const handleScroll = () => {
      // 如果是程序触发的滚动，不标记为用户操作
      if (isProgrammaticScrollRef.current) {
        isProgrammaticScrollRef.current = false
        return
      }
      
      // 用户主动滚动
      handleUserInteraction()
    }
    
    // 监听用户交互事件（触摸、鼠标、滚轮）
    const handleTouchStart = () => handleUserInteraction()
    const handleMouseDown = () => handleUserInteraction()
    const handleWheel = () => handleUserInteraction()
    
    container.addEventListener('scroll', handleScroll, { passive: true })
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('mousedown', handleMouseDown, { passive: true })
    container.addEventListener('wheel', handleWheel, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('wheel', handleWheel)
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
    }
  }, [])
  
  // 歌曲切换时，定位到当前播放的歌词行（如果已在播放）或第一句歌词
  useEffect(() => {
    if (!currentTrack) return
    
    if (currentTrack.id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = currentTrack.id
      lastLyricIndexRef.current = -1
      isUserScrollingRef.current = false // 重置用户滚动状态
      hasInitializedScrollRef.current = false // 重置初始化标记
      
      // 清除之前的滚动动画和定时器
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current)
      }
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current)
      }
      
      // 等待歌词渲染完成后，定位到当前播放的歌词行或第一句
      if (lyrics.length > 0) {
        const tryScrollToLyric = () => {
          requestAnimationFrame(() => {
            // 如果歌曲已经在播放中（currentTime > 0），定位到当前播放的歌词行
            const targetIndex = currentTime > 0 ? currentLyricIndex : 0
            const targetElement = lyricElementsRef.current.get(targetIndex)
            
            if (targetElement) {
              // 立即滚动到目标歌词（不重置到顶部）
              scrollLyricToCenter(targetIndex, false)
            } else {
              // 如果元素还没渲染，再等待
              setTimeout(tryScrollToLyric, 50)
            }
          })
        }
        setTimeout(tryScrollToLyric, 100)
      } else {
        // 如果没有歌词，重置到顶部
        const container = lyricsContainerRef.current
        if (container) {
          isProgrammaticScrollRef.current = true
          container.scrollTop = 0
          setTimeout(() => {
            isProgrammaticScrollRef.current = false
          }, 50)
        }
      }
    }
  }, [currentTrack?.id, lyrics.length, currentTime, currentLyricIndex])
  
  // 歌词首次加载完成时，如果歌曲正在播放，定位到当前播放的歌词行
  useEffect(() => {
    if (!currentTrack || lyrics.length === 0 || hasInitializedScrollRef.current) return
    
    // 如果歌曲已经在播放中（currentTime > 0），定位到当前播放的歌词行
    if (currentTime > 0 && currentLyricIndex >= 0) {
      const tryScrollToCurrent = () => {
        requestAnimationFrame(() => {
          const targetElement = lyricElementsRef.current.get(currentLyricIndex)
          if (targetElement) {
            scrollLyricToCenter(currentLyricIndex, false)
            hasInitializedScrollRef.current = true
          } else {
            // 如果元素还没渲染，再等待
            setTimeout(tryScrollToCurrent, 50)
          }
        })
      }
      setTimeout(tryScrollToCurrent, 100)
    } else {
      // 如果歌曲还没开始播放，标记为已初始化（会在歌曲切换时重置）
      hasInitializedScrollRef.current = true
    }
  }, [lyrics.length, currentTime, currentLyricIndex, currentTrack?.id])
  
  // 当歌词索引改变时，平滑滚动到新的歌词位置
  useEffect(() => {
    if (currentLyricIndex < 0 || currentLyricIndex === lastLyricIndexRef.current) {
      return
    }
    
    // 如果用户正在手动滚动，不自动滚动
    if (isUserScrollingRef.current) {
      lastLyricIndexRef.current = currentLyricIndex
      return
    }
    
    // 如果还没有初始化过，不自动滚动（等待初始化完成）
    if (!hasInitializedScrollRef.current) {
      lastLyricIndexRef.current = currentLyricIndex
      return
    }
    
    lastLyricIndexRef.current = currentLyricIndex
    
    // 延迟一小段时间，确保 DOM 已更新
    const timeoutId = setTimeout(() => {
      // 再次检查用户是否在滚动
      if (!isUserScrollingRef.current) {
        scrollLyricToCenter(currentLyricIndex, false)
      }
    }, 100)
    
    return () => {
      clearTimeout(timeoutId)
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current)
      }
    }
  }, [currentLyricIndex])
  
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
      <div className="max-w-2xl mx-auto w-full h-full flex flex-col">
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
        
        {/* 歌曲信息 */}
        <div className="px-6 pt-6 pb-4 text-center">
          <h2 className="font-display font-semibold text-xl text-surface-100 truncate">
            {currentTrack?.title || '未选择歌曲'}
          </h2>
          <p className="text-surface-400 text-sm mt-1 truncate">
            {currentTrack?.artists?.join(' / ') || '未知艺术家'}
          </p>
        </div>
        
        {/* 歌词区域 */}
        {lyrics.length > 0 ? (
          <div 
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto px-6 pb-4 min-h-0"
          >
            <div ref={lyricsContentRef} className="space-y-2 text-center py-8">
            {/* 顶部占位，确保第一行歌词可以居中 */}
            <div className="h-[40vh]" />
            {lyrics.map((line, index) => {
              const isActive = index === currentLyricIndex
              const isNearActive = Math.abs(index - currentLyricIndex) <= 1
              return (
                <motion.p
                  key={`${line.time}-${index}`}
                  ref={(el) => {
                    if (el) {
                      lyricElementsRef.current.set(index, el)
                    } else {
                      lyricElementsRef.current.delete(index)
                    }
                  }}
                  onClick={() => {
                    // 点击歌词时，跳转到对应时间点
                    onSeek(line.time)
                  }}
                  className={`px-4 py-1 cursor-pointer transition-colors rounded-lg ${
                    isActive
                      ? 'text-primary-400 text-2xl font-medium'
                      : 'text-surface-200 text-xl hover:text-surface-100 hover:bg-surface-800/30'
                  }`}
                  initial={false}
                  animate={{
                    opacity: isActive ? 1 : isNearActive ? 0.8 : 0.7,
                    scale: isActive ? 1.05 : 1,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: [0.25, 0.1, 0.25, 1], // 更平滑的缓动曲线
                  }}
                  style={{
                    willChange: isNearActive ? 'opacity, transform' : 'auto',
                  }}
                >
                  {line.text || '\u00A0'}
                </motion.p>
              )
            })}
            {/* 底部占位，确保最后一行歌词可以居中 */}
            <div className="h-[40vh]" />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center px-6 pb-4">
          <p className="text-surface-500 text-sm">暂无歌词</p>
        </div>
      )}
      
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
          
          {error && onRetry && (
            <button
              onClick={onRetry}
              className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
              title="重试播放"
            >
              <RotateCw className="w-5 h-5" />
            </button>
          )}
          
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
      </div>
    </motion.div>
  )
}
