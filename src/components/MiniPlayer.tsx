import { motion } from 'framer-motion'
import { Play, Pause, SkipForward, Loader2, Music, RotateCw } from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { getCurrentAndNextLyric } from '../lib/lyrics'

interface MiniPlayerProps {
  onExpand: () => void
  onRetry?: () => void
}

export function MiniPlayer({ onExpand, onRetry }: MiniPlayerProps) {
  
  const {
    currentTrack,
    currentStream,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    lyrics,
    error,
    setIsPlaying,
    playNext,
  } = usePlayerStore()
  
  const { current: currentLyric, isCurrentActive } = getCurrentAndNextLyric(lyrics, currentTime)
  
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPlaying(!isPlaying)
  }
  
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    playNext()
  }
  
  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onRetry) {
      onRetry()
    }
  }
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed bottom-[65px] left-0 right-0 z-40 px-4"
    >
      <div className="glass rounded-2xl overflow-hidden glow-hover shadow-xl max-w-2xl mx-auto w-full">
        {/* 进度条 */}
        <div className="h-0.5 bg-surface-700">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="flex items-center gap-2 p-2">
          {/* 封面+播放按钮合并 */}
          <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            {/* 封面图片 - 点击展开全屏播放器 */}
            <div
              onClick={onExpand}
              className={`w-full h-full cursor-pointer ${isPlaying ? 'vinyl-spin playing' : ''}`}
            >
              {currentTrack?.coverUrl ? (
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary-500/30 to-primary-700/30 flex items-center justify-center">
                  <Music className="w-4 h-4 text-primary-400" />
                </div>
              )}
            </div>
            
            {/* 播放/暂停按钮覆盖层 */}
            <button
              onClick={handlePlayPause}
              disabled={isLoading || !currentStream}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 text-white" fill="white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
              )}
            </button>
          </div>
          
          {/* 歌曲信息 - 点击展开全屏播放器 */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
            <h3 className="font-medium text-xs text-surface-100 truncate">
              {currentTrack?.title || '未选择歌曲'}
            </h3>
            <p className={`text-[10px] truncate ${
              error
                ? 'text-red-400'
                : currentLyric && isCurrentActive 
                  ? 'text-primary-400' 
                  : currentLyric 
                    ? 'text-surface-300' 
                    : 'text-surface-400'
            }`}>
              {error || currentLyric || currentTrack?.artists?.join(' / ') || '未知艺术家'}
            </p>
          </div>
          
          {/* 重试按钮 - 仅在错误时显示 */}
          {error && onRetry && (
            <button
              onClick={handleRetry}
              className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
              title="重试播放"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
          
          {/* 下一首按钮 */}
          <button
            onClick={handleNext}
            className="w-8 h-8 flex items-center justify-center text-surface-300 hover:text-surface-100 transition-colors"
          >
            <SkipForward className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
