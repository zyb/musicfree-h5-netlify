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
    setIsPlaying,
    setVolume,
    toggleMute,
    setPlayMode,
    playNext,
    playPrevious,
  } = usePlayerStore()
  
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
      
      {/* 封面 */}
      <div className="flex-1 flex items-center justify-center px-8 py-6">
        <motion.div
          animate={{ rotate: isPlaying ? 360 : 0 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
          className="relative"
        >
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full overflow-hidden shadow-2xl shadow-black/50 border-8 border-surface-800">
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
