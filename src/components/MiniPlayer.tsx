import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipForward, Loader2, Music, ChevronRight, ChevronLeft } from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'

interface MiniPlayerProps {
  onExpand: () => void
}

export function MiniPlayer({ onExpand }: MiniPlayerProps) {
  const [collapsed, setCollapsed] = useState(false)
  
  const {
    currentTrack,
    currentStream,
    isPlaying,
    isLoading,
    duration,
    currentTime,
    setIsPlaying,
    playNext,
  } = usePlayerStore()
  
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsPlaying(!isPlaying)
  }
  
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    playNext()
  }
  
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  
  // 圆形进度条参数
  const circleSize = 56
  const strokeWidth = 3
  const radius = (circleSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference
  
  return (
    <>
      {/* 收缩状态 - 圆形悬浮按钮 */}
      <AnimatePresence>
        {collapsed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-[80px] right-4 z-40"
          >
            <div className="relative">
              {/* 进度条圆环 */}
              <svg
                width={circleSize}
                height={circleSize}
                className="absolute inset-0 -rotate-90"
              >
                {/* 背景圆环 */}
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth={strokeWidth}
                />
                {/* 进度圆环 */}
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-200"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ed741e" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
              </svg>
              
              {/* 中心按钮 */}
              <button
                onClick={togglePlay}
                disabled={isLoading || !currentStream}
                className="relative w-14 h-14 rounded-full overflow-hidden shadow-lg shadow-black/30 disabled:opacity-50"
              >
                {/* 封面图片（旋转） */}
                <motion.div
                  animate={{ rotate: isPlaying ? 360 : 0 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
                  className="absolute inset-1 rounded-full overflow-hidden"
                >
                  {currentTrack?.coverUrl ? (
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500/30 to-primary-700/30 flex items-center justify-center">
                      <Music className="w-5 h-5 text-primary-400" />
                    </div>
                  )}
                </motion.div>
                
                {/* 播放/暂停覆盖层 */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-5 h-5 text-white" fill="white" />
                  ) : (
                    <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                  )}
                </div>
              </button>
              
              {/* 展开按钮 */}
              <button
                onClick={() => setCollapsed(false)}
                className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors shadow-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 展开状态 - 完整播放栏 */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-[76px] left-4 right-4 z-40 max-w-lg mx-auto"
          >
            <div className="glass rounded-2xl overflow-hidden glow-hover shadow-xl">
              {/* 进度条 */}
              <div className="h-0.5 bg-surface-700">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
                  style={{ width: `${progress}%` }}
                />
              </div>
              
              <div className="flex items-center gap-3 p-3">
                {/* 封面 - 点击展开全屏播放器 */}
                <div 
                  onClick={onExpand}
                  className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer ${isPlaying ? 'vinyl-spin playing' : ''}`}
                >
                  {currentTrack?.coverUrl ? (
                    <img
                      src={currentTrack.coverUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-500/30 to-primary-700/30 flex items-center justify-center">
                      <Music className="w-5 h-5 text-primary-400" />
                    </div>
                  )}
                </div>
                
                {/* 歌曲信息 - 点击展开全屏播放器 */}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={onExpand}>
                  <h3 className="font-medium text-sm text-surface-100 truncate">
                    {currentTrack?.title || '未选择歌曲'}
                  </h3>
                  <p className="text-xs text-surface-400 truncate">
                    {currentTrack?.artists?.join(' / ') || '未知艺术家'}
                  </p>
                </div>
                
                {/* 音波动画 */}
                {isPlaying && (
                  <div className="flex items-end gap-0.5 h-4 mr-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-primary-400 rounded-full wave-bar"
                        style={{ 
                          height: '100%',
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* 控制按钮 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={togglePlay}
                    disabled={isLoading || !currentStream}
                    className="w-10 h-10 rounded-full bg-primary-500 text-surface-950 flex items-center justify-center hover:bg-primary-400 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-5 h-5" fill="currentColor" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  
                  <button
                    onClick={handleNext}
                    className="w-10 h-10 flex items-center justify-center text-surface-300 hover:text-surface-100 transition-colors"
                  >
                    <SkipForward className="w-5 h-5" fill="currentColor" />
                  </button>
                </div>
                
                {/* 收缩按钮 */}
                <button
                  onClick={() => setCollapsed(true)}
                  className="w-8 h-8 flex items-center justify-center text-surface-500 hover:text-surface-300 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
