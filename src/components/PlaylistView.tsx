import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Music, 
  Play, 
  Trash2, 
  ListX,
  GripVertical,
  Pause,
  History,
  ListMusic,
  Heart,
  User,
  Disc,
  ListEnd,
  HeartOff,
  ArrowLeft,
  Loader2,
  Plus,
  Check,
  HardDrive,
} from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePluginStore } from '../stores/pluginStore'
import { isSongCached, getAllCachedSongs, deleteSongCache, clearAllSongCache, getCacheStats, type CachedSong } from '../lib/songCache'
import type { PluginTrack, PluginArtist, PluginAlbum, PluginPlaylist } from '../types/plugin'
type MainTabId = 'current' | 'history' | 'favorites' | 'cache'
type FavoriteTabId = 'songs' | 'artists' | 'albums' | 'playlists'
type DetailType = 'artist' | 'album' | 'playlist' | null

export function PlaylistView() {
  const [mainTab, setMainTab] = useState<MainTabId>('current')
  const [favoriteTab, setFavoriteTab] = useState<FavoriteTabId>('songs')
  
  // 详情页状态
  const [detailType, setDetailType] = useState<DetailType>(null)
  const [detailData, setDetailData] = useState<PluginArtist | PluginAlbum | PluginPlaylist | null>(null)
  const [detailTracks, setDetailTracks] = useState<PluginTrack[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  
  // 滚动位置保存
  const favoritesScrollRef = useRef<HTMLDivElement>(null)
  const favoritesScrollPositions = useRef<Map<FavoriteTabId, number>>(new Map())
  
  const {
    playlist,
    playlistName,
    playHistory,
    currentTrack,
    isPlaying,
    setPlaylist,
    appendToPlaylist,
    setCurrentTrack,
    removeFromPlaylist,
    clearPlaylist,
    removeFromHistory,
    clearHistory,
    setIsPlaying,
    addToPlaylist,
  } = usePlayerStore()
  
  const favoriteStore = useFavoriteStore()
  const { getActivePluginInstance } = usePluginStore()
  
  // 初始化收藏
  useEffect(() => {
    favoriteStore.init()
  }, [])
  
  const handlePlay = (track: PluginTrack) => {
    if (currentTrack?.id === track.id) {
      setIsPlaying(!isPlaying)
    } else {
      setCurrentTrack(track)
      setIsPlaying(true)
      // 如果从历史或收藏播放，添加到当前列表
      if (mainTab !== 'current') {
        addToPlaylist(track)
      }
    }
  }
  
  
  // 打开歌手详情
  const handleOpenArtist = async (artist: PluginArtist) => {
    // 保存当前滚动位置
    if (favoritesScrollRef.current) {
      favoritesScrollPositions.current.set(favoriteTab, favoritesScrollRef.current.scrollTop)
    }
    
    setDetailType('artist')
    setDetailData(artist)
    setDetailTracks([])
    setDetailLoading(true)
    
    const plugin = getActivePluginInstance()
    if (plugin?.getArtistSongs) {
      try {
        const result = await plugin.getArtistSongs(artist, 1)
        setDetailTracks(result.data || [])
      } catch (error) {
        console.error('加载歌手歌曲失败:', error)
      }
    }
    setDetailLoading(false)
  }
  
  // 打开专辑详情
  const handleOpenAlbum = async (album: PluginAlbum) => {
    // 保存当前滚动位置
    if (favoritesScrollRef.current) {
      favoritesScrollPositions.current.set(favoriteTab, favoritesScrollRef.current.scrollTop)
    }
    
    setDetailType('album')
    setDetailData(album)
    setDetailTracks([])
    setDetailLoading(true)
    
    const plugin = getActivePluginInstance()
    if (plugin?.getAlbumSongs) {
      try {
        const tracks = await plugin.getAlbumSongs(album)
        setDetailTracks(tracks || [])
      } catch (error) {
        console.error('加载专辑歌曲失败:', error)
      }
    }
    setDetailLoading(false)
  }
  
  // 打开歌单详情
  const handleOpenPlaylist = async (pl: PluginPlaylist) => {
    // 保存当前滚动位置
    if (favoritesScrollRef.current) {
      favoritesScrollPositions.current.set(favoriteTab, favoritesScrollRef.current.scrollTop)
    }
    
    setDetailType('playlist')
    setDetailData(pl)
    setDetailTracks([])
    setDetailLoading(true)
    
    const plugin = getActivePluginInstance()
    if (plugin?.getPlaylistSongs) {
      try {
        const tracks = await plugin.getPlaylistSongs(pl)
        setDetailTracks(tracks || [])
      } catch (error) {
        console.error('加载歌单歌曲失败:', error)
      }
    }
    setDetailLoading(false)
  }
  
  // 关闭详情页
  const handleCloseDetail = () => {
    setDetailType(null)
    setDetailData(null)
    setDetailTracks([])
    
    // 恢复滚动位置
    if (favoritesScrollRef.current) {
      const savedPosition = favoritesScrollPositions.current.get(favoriteTab)
      if (savedPosition !== undefined) {
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(() => {
          if (favoritesScrollRef.current) {
            favoritesScrollRef.current.scrollTop = savedPosition
          }
        })
      }
    }
  }
  
  // 播放全部（详情页）
  const handlePlayAll = () => {
    if (detailTracks.length > 0) {
      const name = detailType === 'artist' 
        ? (detailData as PluginArtist)?.name 
        : (detailData as PluginAlbum | PluginPlaylist)?.title || '收藏列表'
      setPlaylist(detailTracks, name)
      setCurrentTrack(detailTracks[0])
      setIsPlaying(true)
    }
  }
  
  // 播放全部收藏歌曲（追加到播放列表）
  const handlePlayAllFavorites = () => {
    if (favoriteStore.songs.length > 0) {
      appendToPlaylist(favoriteStore.songs, '我的收藏')
      // 直接开始播放第一首收藏歌曲
      setCurrentTrack(favoriteStore.songs[0])
      setIsPlaying(true)
    }
  }
  
  return (
    <div className="h-full flex flex-col px-4">
      {/* 主 Tab 切换 */}
      <div className="max-w-2xl mx-auto w-full pt-2 pb-2">
        <div className="flex gap-1 p-1 bg-surface-800/50 rounded-xl">
          <button
            onClick={() => setMainTab('current')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'current'
                ? 'bg-primary-500 text-surface-950'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <ListMusic className="w-4 h-4" />
            <span>播放中</span>
            {playlist.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                mainTab === 'current' ? 'bg-surface-950/20' : 'bg-surface-700'
              }`}>
                {playlist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'history'
                ? 'bg-primary-500 text-surface-950'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>历史</span>
            {playHistory.length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                mainTab === 'history' ? 'bg-surface-950/20' : 'bg-surface-700'
              }`}>
                {playHistory.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMainTab('favorites')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'favorites'
                ? 'bg-primary-500 text-surface-950'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>收藏</span>
          </button>
          <button
            onClick={() => setMainTab('cache')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === 'cache'
                ? 'bg-primary-500 text-surface-950'
                : 'text-surface-400 hover:text-surface-200'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>缓存</span>
          </button>
        </div>
      </div>
      
      {/* 内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* 当前播放列表 - 保持挂载 */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${
            mainTab === 'current' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <CurrentPlaylist
            playlist={playlist}
            playlistName={playlistName}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onRemove={removeFromPlaylist}
            onClear={clearPlaylist}
          />
        </div>
        
        {/* 播放历史 - 保持挂载 */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${
            mainTab === 'history' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <PlayHistory
            history={playHistory}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onRemove={removeFromHistory}
            onClear={clearHistory}
          />
        </div>
        
        {/* 收藏 - 保持挂载 */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${
            mainTab === 'favorites' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <FavoritesView
            activeTab={favoriteTab}
            onTabChange={(tab) => {
              // 切换 tab 时保存当前滚动位置
              if (favoritesScrollRef.current) {
                favoritesScrollPositions.current.set(favoriteTab, favoritesScrollRef.current.scrollTop)
              }
              setFavoriteTab(tab)
              // 恢复新 tab 的滚动位置
              requestAnimationFrame(() => {
                if (favoritesScrollRef.current) {
                  const savedPosition = favoritesScrollPositions.current.get(tab)
                  if (savedPosition !== undefined) {
                    favoritesScrollRef.current.scrollTop = savedPosition
                  } else {
                    favoritesScrollRef.current.scrollTop = 0
                  }
                }
              })
            }}
            scrollRef={favoritesScrollRef}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={handlePlay}
            onPlayAllFavorites={handlePlayAllFavorites}
            onOpenArtist={handleOpenArtist}
            onOpenAlbum={handleOpenAlbum}
            onOpenPlaylist={handleOpenPlaylist}
          />
        </div>
        
        {/* 缓存列表 - 保持挂载 */}
        <div
          className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${
            mainTab === 'cache' ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
          }`}
        >
          <CacheListView
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlay={handlePlay}
          />
        </div>
        
      </div>
      
      {/* 详情页 - 使用 AnimatePresence 作为覆盖层，不影响列表状态 */}
      <AnimatePresence>
        {detailType && detailData && (
          <FavoriteDetailView
            type={detailType}
            data={detailData}
            tracks={detailTracks}
            loading={detailLoading}
            currentTrack={currentTrack}
            playlist={playlist}
            isPlaying={isPlaying}
            onBack={handleCloseDetail}
            onPlay={handlePlay}
            onPlayAll={handlePlayAll}
            onAddToPlaylist={addToPlaylist}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// 收藏详情页
function FavoriteDetailView({
  type,
  data,
  tracks,
  loading,
  currentTrack,
  playlist,
  isPlaying,
  onBack,
  onPlay,
  onPlayAll,
  onAddToPlaylist,
}: {
  type: DetailType
  data: PluginArtist | PluginAlbum | PluginPlaylist
  tracks: PluginTrack[]
  loading: boolean
  currentTrack: PluginTrack | null
  playlist: PluginTrack[]
  isPlaying: boolean
  onBack: () => void
  onPlay: (track: PluginTrack) => void
  onPlayAll: () => void
  onAddToPlaylist: (track: PluginTrack) => void
}) {
  const isInPlaylist = (trackId: string) => playlist.some((t) => t.id === trackId)
  
  const getTitle = () => {
    if (type === 'artist') return (data as PluginArtist).name
    return (data as PluginAlbum | PluginPlaylist).title
  }
  
  const getCover = () => {
    if (type === 'artist') return (data as PluginArtist).avatar
    return (data as PluginAlbum | PluginPlaylist).coverUrl
  }
  
  const getSubtitle = () => {
    if (type === 'artist') {
      const artist = data as PluginArtist
      return artist.worksNum ? `${artist.worksNum} 首歌曲` : '歌手'
    }
    if (type === 'album') {
      const album = data as PluginAlbum
      return album.artist || '专辑'
    }
    const pl = data as PluginPlaylist
    return pl.artist || '歌单'
  }
  
  const Icon = type === 'artist' ? User : type === 'album' ? Disc : ListEnd
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-surface-950 flex flex-col overflow-y-auto"
    >
      {/* 内容容器 - 限制最大宽度 */}
      <div className="max-w-2xl mx-auto w-full px-4 pt-[70px] pb-[65px] flex flex-col flex-1">
      {/* 头部 */}
      <div className="py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden flex-shrink-0`}>
            {getCover() ? (
              <img src={getCover()} alt={getTitle()} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                <Icon className="w-10 h-10 text-surface-500" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-display font-bold text-surface-100 truncate">
              {getTitle()}
            </h2>
            <p className="text-sm text-surface-400 mt-1">{getSubtitle()}</p>
            <p className="text-xs text-surface-500 mt-1">{tracks.length} 首歌曲</p>
          </div>
        </div>
        
        {tracks.length > 0 && (
          <button
            onClick={onPlayAll}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-surface-950 text-sm font-medium hover:bg-primary-400 transition-colors"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            播放全部
          </button>
        )}
      </div>
      
      {/* 歌曲列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-surface-600 mx-auto mb-3" />
            <p className="text-surface-400">暂无歌曲</p>
            <p className="text-sm text-surface-500 mt-1">请选择一个插件源后重试</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.2) }}
                onClick={() => onPlay(track)}
                className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group ${
                  currentTrack?.id === track.id ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
                }`}
              >
                <div className="w-8 text-center text-sm text-surface-500">{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className={`text-sm font-medium truncate ${
                      currentTrack?.id === track.id ? 'text-primary-400' : 'text-surface-100'
                    }`}>
                      {track.title}
                    </h4>
                    <CachedIcon trackId={track.id} />
                  </div>
                  <p className="text-xs text-surface-400 truncate mt-0.5">
                    {track.artists?.join(' / ') || '未知艺术家'}
                  </p>
                </div>
                
                {currentTrack?.id === track.id && isPlaying && (
                  <div className="flex items-end gap-0.5 h-4 mr-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-0.5 bg-primary-400 rounded-full wave-bar" style={{ height: '100%', animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}
                
                <button
                  onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track) }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isInPlaylist(track.id)
                      ? 'bg-primary-500/20 text-primary-400'
                      : 'text-surface-400 hover:text-surface-200 opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {isInPlaylist(track.id) ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </div>
    </motion.div>
  )
}

// 收藏页面
function FavoritesView({
  activeTab,
  onTabChange,
  scrollRef,
  currentTrack,
  isPlaying,
  onPlay,
  onPlayAllFavorites,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  activeTab: FavoriteTabId
  onTabChange: (tab: FavoriteTabId) => void
  scrollRef?: React.RefObject<HTMLDivElement>
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
  onPlayAllFavorites: () => void
  onOpenArtist: (artist: PluginArtist) => void
  onOpenAlbum: (album: PluginAlbum) => void
  onOpenPlaylist: (playlist: PluginPlaylist) => void
}) {
  const { songs, artists, albums, playlists, removeSong, removeArtist, removeAlbum, removePlaylist, clearAll } = useFavoriteStore()
  
  const tabs: { id: FavoriteTabId; label: string; icon: typeof Music; count: number }[] = [
    { id: 'songs', label: '歌曲', icon: Music, count: songs.length },
    { id: 'artists', label: '歌手', icon: User, count: artists.length },
    { id: 'albums', label: '专辑', icon: Disc, count: albums.length },
    { id: 'playlists', label: '歌单', icon: ListEnd, count: playlists.length },
  ]
  
  const totalCount = songs.length + artists.length + albums.length + playlists.length
  
  return (
    <div className="h-full flex flex-col">
      {/* 子 Tab */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full py-2">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-surface-700 text-surface-100'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="text-xs text-surface-500">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      
      {/* 头部 */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full py-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-semibold text-surface-100">
              我的收藏
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              共 {totalCount} 项
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeTab === 'songs' && songs.length > 0 && (
              <button
                onClick={onPlayAllFavorites}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500 text-surface-950 text-sm font-medium hover:bg-primary-400 transition-colors"
              >
                <Play className="w-4 h-4" fill="currentColor" />
                播放全部
              </button>
            )}
            
            {totalCount > 0 && (
              <button
                onClick={() => {
                  if (confirm('确定要清空所有收藏吗？')) {
                    clearAll()
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <HeartOff className="w-4 h-4" />
                清空收藏
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* 列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto relative">
          {/* 歌曲 - 保持挂载 */}
          <div
            className={`transition-opacity duration-200 ${
              activeTab === 'songs' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
            }`}
          >
            {songs.length === 0 ? (
              <EmptyState
                icon={Music}
                title="暂无收藏歌曲"
                description="在搜索结果中点击心形图标收藏歌曲"
              />
            ) : (
              <div className="space-y-2">
                {songs.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <FavoriteTrackItem
                      track={track}
                      index={index}
                      currentTrack={currentTrack}
                      isPlaying={isPlaying}
                      onPlay={onPlay}
                      onRemove={() => removeSong(track.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          
          {/* 歌手 - 保持挂载 */}
          <div
            className={`transition-opacity duration-200 ${
              activeTab === 'artists' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
            }`}
          >
            {artists.length === 0 ? (
              <EmptyState
                icon={User}
                title="暂无收藏歌手"
                description="在搜索结果中点击心形图标收藏歌手"
              />
            ) : (
              <div className="space-y-2">
                {artists.map((artist, index) => (
                  <motion.div
                    key={artist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <FavoriteArtistItem
                      artist={artist}
                      onClick={() => onOpenArtist(artist)}
                      onRemove={() => removeArtist(artist.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          
          {/* 专辑 - 保持挂载 */}
          <div
            className={`transition-opacity duration-200 ${
              activeTab === 'albums' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
            }`}
          >
            {albums.length === 0 ? (
              <EmptyState
                icon={Disc}
                title="暂无收藏专辑"
                description="在搜索结果中点击心形图标收藏专辑"
              />
            ) : (
              <div className="space-y-2">
                {albums.map((album, index) => (
                  <motion.div
                    key={album.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <FavoriteAlbumItem
                      album={album}
                      onClick={() => onOpenAlbum(album)}
                      onRemove={() => removeAlbum(album.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
          
          {/* 歌单 - 保持挂载 */}
          <div
            className={`transition-opacity duration-200 ${
              activeTab === 'playlists' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none'
            }`}
          >
            {playlists.length === 0 ? (
              <EmptyState
                icon={ListEnd}
                title="暂无收藏歌单"
                description="在搜索结果中点击心形图标收藏歌单"
              />
            ) : (
              <div className="space-y-2">
                {playlists.map((playlist, index) => (
                  <motion.div
                    key={playlist.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <FavoritePlaylistItem
                      playlist={playlist}
                      onClick={() => onOpenPlaylist(playlist)}
                      onRemove={() => removePlaylist(playlist.id)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 缓存图标组件
function CachedIcon({ trackId }: { trackId: string }) {
  const [isCached, setIsCached] = useState(false)
  
  const checkCache = useCallback(() => {
    isSongCached(trackId).then(setIsCached)
  }, [trackId])
  
  useEffect(() => {
    checkCache()
    
    // 监听缓存完成事件，实时更新图标
    const handleSongCached = (event: CustomEvent<{ trackId: string }>) => {
      if (event.detail.trackId === trackId) {
        checkCache()
      }
    }
    
    window.addEventListener('songCached', handleSongCached as EventListener)
    
    return () => {
      window.removeEventListener('songCached', handleSongCached as EventListener)
    }
  }, [trackId, checkCache])
  
  if (!isCached) return null
  
  return <HardDrive className="w-3 h-3 text-primary-400 flex-shrink-0" />
}

// 收藏歌曲项
function FavoriteTrackItem({
  track,
  index,
  currentTrack,
  isPlaying,
  onPlay,
  onRemove,
}: {
  track: PluginTrack
  index: number
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
  onRemove: () => void
}) {
  const isCurrent = currentTrack?.id === track.id
  const [isCached, setIsCached] = useState(false)
  
  useEffect(() => {
    isSongCached(track.id).then(setIsCached)
  }, [track.id])
  
  return (
    <div
      onClick={() => onPlay(track)}
      className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group ${
        isCurrent ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
      }`}
    >
      {/* 序号/播放按钮 */}
      <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-all">
        {isCurrent ? (
          isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary-400 rounded-full wave-bar"
                  style={{ height: '100%', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          ) : (
            <Pause className="w-4 h-4 text-primary-400" />
          )
        ) : (
          <>
            <span className="text-xs text-surface-500 group-hover:hidden">
              {index + 1}
            </span>
            <Play className="w-4 h-4 text-surface-400 hidden group-hover:block" fill="currentColor" />
          </>
        )}
      </button>
      
      {/* 封面 */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
        {track.coverUrl ? (
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <Music className="w-4 h-4 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-primary-400' : 'text-surface-100'}`}>
            {track.title}
          </h4>
          {isCached && (
            <HardDrive className="w-3 h-3 text-primary-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-xs text-surface-400 truncate mt-0.5">
          {track.artists?.join(' / ') || '未知艺术家'}
        </p>
      </div>
      
      {/* 取消收藏按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Heart className="w-4 h-4" fill="currentColor" />
      </button>
    </div>
  )
}

// 收藏歌手项
function FavoriteArtistItem({
  artist,
  onClick,
  onRemove,
}: {
  artist: PluginArtist
  onClick: () => void
  onRemove: () => void
}) {
  return (
    <div 
      onClick={onClick}
      className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group"
    >
      {/* 头像 */}
      <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
        {artist.avatar ? (
          <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <User className="w-5 h-5 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌手信息 */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate text-surface-100">
          {artist.name}
        </h4>
        {artist.worksNum && (
          <p className="text-xs text-surface-400 mt-0.5">
            {artist.worksNum} 首歌曲
          </p>
        )}
      </div>
      
      {/* 箭头提示 */}
      <div className="text-surface-500 group-hover:text-surface-300 transition-colors">
        <ArrowLeft className="w-4 h-4 rotate-180" />
      </div>
      
      {/* 取消收藏按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Heart className="w-4 h-4" fill="currentColor" />
      </button>
    </div>
  )
}

// 收藏专辑项
function FavoriteAlbumItem({
  album,
  onClick,
  onRemove,
}: {
  album: PluginAlbum
  onClick: () => void
  onRemove: () => void
}) {
  return (
    <div 
      onClick={onClick}
      className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group"
    >
      {/* 封面 */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <Disc className="w-5 h-5 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 专辑信息 */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate text-surface-100">
          {album.title}
        </h4>
        <p className="text-xs text-surface-400 truncate mt-0.5">
          {album.artist || '未知艺术家'}
          {album.date && ` · ${album.date}`}
        </p>
      </div>
      
      {/* 箭头提示 */}
      <div className="text-surface-500 group-hover:text-surface-300 transition-colors">
        <ArrowLeft className="w-4 h-4 rotate-180" />
      </div>
      
      {/* 取消收藏按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Heart className="w-4 h-4" fill="currentColor" />
      </button>
    </div>
  )
}

// 收藏歌单项
function FavoritePlaylistItem({
  playlist,
  onClick,
  onRemove,
}: {
  playlist: PluginPlaylist
  onClick: () => void
  onRemove: () => void
}) {
  return (
    <div 
      onClick={onClick}
      className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group"
    >
      {/* 封面 */}
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt={playlist.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <ListEnd className="w-5 h-5 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌单信息 */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium truncate text-surface-100">
          {playlist.title}
        </h4>
        <p className="text-xs text-surface-400 truncate mt-0.5">
          {playlist.artist || ''}
          {playlist.playCount && `${playlist.playCount} 次播放`}
        </p>
      </div>
      
      {/* 箭头提示 */}
      <div className="text-surface-500 group-hover:text-surface-300 transition-colors">
        <ArrowLeft className="w-4 h-4 rotate-180" />
      </div>
      
      {/* 取消收藏按钮 */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Heart className="w-4 h-4" fill="currentColor" />
      </button>
    </div>
  )
}

// 当前播放列表
function CurrentPlaylist({
  playlist,
  playlistName: _playlistName,
  currentTrack,
  isPlaying,
  onPlay,
  onRemove,
  onClear,
}: {
  playlist: PluginTrack[]
  playlistName: string
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
  onRemove: (trackId: string) => void
  onClear: () => void
}) {
  const listContainerRef = useRef<HTMLDivElement>(null)
  const trackElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  
  // 滚动到当前播放的歌曲
  const scrollToCurrentTrack = () => {
    if (!currentTrack || !listContainerRef.current) return
    
    // 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      let trackElement = trackElementsRef.current.get(currentTrack.id)
      const container = listContainerRef.current
      
      // 如果 ref 找不到，尝试通过 data 属性查找
      if (!trackElement && container) {
        trackElement = container.querySelector(`[data-track-id="${currentTrack.id}"]`) as HTMLElement
        if (trackElement) {
          trackElementsRef.current.set(currentTrack.id, trackElement)
        }
      }
      
      if (!trackElement || !container) {
        // 如果元素还没找到，延迟再试
        setTimeout(() => {
          let retryElement = trackElementsRef.current.get(currentTrack.id)
          const retryContainer = listContainerRef.current
          
          if (!retryElement && retryContainer) {
            retryElement = retryContainer.querySelector(`[data-track-id="${currentTrack.id}"]`) as HTMLElement
            if (retryElement) {
              trackElementsRef.current.set(currentTrack.id, retryElement)
            }
          }
          
          if (retryElement && retryContainer) {
            scrollToElement(retryElement, retryContainer)
          }
        }, 100)
        return
      }
      
      scrollToElement(trackElement, container)
    })
  }
  
  // 滚动元素到容器中心
  const scrollToElement = (element: HTMLElement, container: HTMLElement) => {
    // 使用 getBoundingClientRect 获取元素和容器的位置
    const elementRect = element.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    
    // 计算元素相对于容器内容顶部的绝对位置
    // elementRect.top - containerRect.top 是元素相对于容器可视区域顶部的距离
    // 加上 container.scrollTop 得到元素在内容中的绝对位置
    const elementAbsoluteTop = elementRect.top - containerRect.top + container.scrollTop
    const elementHeight = elementRect.height
    const elementCenter = elementAbsoluteTop + elementHeight / 2
    
    // 计算目标滚动位置：使元素中心对齐容器中心
    const containerCenter = container.clientHeight / 2
    const targetScrollTop = elementCenter - containerCenter
    
    // 平滑滚动
    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth',
    })
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentTrack && playlist.length > 0 ? (
              <button
                onClick={scrollToCurrentTrack}
                className="text-base font-display font-semibold text-surface-100 hover:text-primary-400 transition-colors cursor-pointer"
                title="点击定位到当前播放"
              >
                正在播放
              </button>
            ) : (
              <h2 className="text-base font-display font-semibold text-surface-100">
                正在播放
              </h2>
            )}
            <p className="text-xs text-surface-500">
              {playlist.length} 首歌曲
            </p>
          </div>
          
          {playlist.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <ListX className="w-4 h-4" />
              清空列表
            </button>
          )}
        </div>
      </div>
      
      {/* 列表 */}
      <div ref={listContainerRef} className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          {playlist.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title="播放列表为空"
              description="选择歌单、专辑或歌手后，歌曲会添加到这里"
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {playlist.map((track, index) => (
                  <motion.div
                    key={track.id}
                    data-track-id={track.id}
                    ref={(el) => {
                      if (el) {
                        trackElementsRef.current.set(track.id, el)
                      } else {
                        trackElementsRef.current.delete(track.id)
                      }
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <TrackItem
                      track={track}
                      index={index}
                      currentTrack={currentTrack}
                      isPlaying={isPlaying}
                      showDragHandle={false}
                      onPlay={onPlay}
                      onRemove={onRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 播放历史
function PlayHistory({
  history,
  currentTrack,
  isPlaying,
  onPlay,
  onRemove,
  onClear,
}: {
  history: PluginTrack[]
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
  onRemove: (trackId: string) => void
  onClear: () => void
}) {
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-semibold text-surface-100">
              播放历史
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              最近播放的 {history.length} 首歌曲
            </p>
          </div>
          
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              清空历史
            </button>
          )}
        </div>
      </div>
      
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="暂无播放历史"
              description="播放过的歌曲会显示在这里"
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {history.map((track, index) => (
                  <motion.div
                    key={`${track.id}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                  >
                    <TrackItem
                      track={track}
                      index={index}
                      currentTrack={currentTrack}
                      isPlaying={isPlaying}
                      showDragHandle={false}
                      onPlay={onPlay}
                      onRemove={onRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 歌曲项
function TrackItem({
  track,
  index,
  currentTrack,
  isPlaying,
  showDragHandle,
  onPlay,
  onRemove,
}: {
  track: PluginTrack
  index: number
  currentTrack: PluginTrack | null
  isPlaying: boolean
  showDragHandle: boolean
  onPlay: (track: PluginTrack) => void
  onRemove: (trackId: string) => void
}) {
  const isCurrent = currentTrack?.id === track.id
  
  return (
    <div
      className={`glass rounded-xl p-3 flex items-center gap-3 group ${
        isCurrent ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
      }`}
    >
      {/* 拖拽手柄 */}
      {showDragHandle && (
        <div className="cursor-grab active:cursor-grabbing text-surface-600 hover:text-surface-400 transition-colors">
          <GripVertical className="w-5 h-5" />
        </div>
      )}
      
      {/* 序号/播放按钮 */}
      <button
        onClick={() => onPlay(track)}
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
      >
        {isCurrent ? (
          isPlaying ? (
            <div className="flex items-end gap-0.5 h-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 bg-primary-400 rounded-full wave-bar"
                  style={{ height: '100%', animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          ) : (
            <Pause className="w-4 h-4 text-primary-400" />
          )
        ) : (
          <>
            <span className="text-xs text-surface-500 group-hover:hidden">
              {index + 1}
            </span>
            <Play className="w-4 h-4 text-surface-400 hidden group-hover:block" fill="currentColor" />
          </>
        )}
      </button>
      
      {/* 封面 */}
      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
        {track.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={track.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <Music className="w-4 h-4 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0" onClick={() => onPlay(track)}>
        <div className="flex items-center gap-1.5">
          <h4 className={`text-sm font-medium truncate cursor-pointer ${
            isCurrent ? 'text-primary-400' : 'text-surface-100'
          }`}>
            {track.title}
          </h4>
          <CachedIcon trackId={track.id} />
        </div>
        <p className="text-xs text-surface-400 truncate mt-0.5">
          {track.artists?.join(' / ') || '未知艺术家'}
        </p>
      </div>
      
      {/* 删除按钮 */}
      <button
        onClick={() => onRemove(track.id)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// 空状态
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Music
  title: string
  description: string
}) {
  return (
    <div className="text-center py-16">
      <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-surface-800 flex items-center justify-center">
        <Icon className="w-10 h-10 text-surface-600" />
      </div>
      <h3 className="text-lg font-display font-medium text-surface-300 mb-2">
        {title}
      </h3>
      <p className="text-sm text-surface-500 max-w-xs mx-auto">
        {description}
      </p>
    </div>
  )
}

// 缓存列表视图
function CacheListView({
  currentTrack,
  isPlaying,
  onPlay,
}: {
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
}) {
  const [cachedSongs, setCachedSongs] = useState<CachedSong[]>([])
  const [cacheStats, setCacheStats] = useState<{ count: number; totalSize: number }>({ count: 0, totalSize: 0 })
  const [loading, setLoading] = useState(true)
  
  // 加载缓存列表
  const loadCacheList = useCallback(async () => {
    setLoading(true)
    try {
      const [songs, stats] = await Promise.all([
        getAllCachedSongs(),
        getCacheStats()
      ])
      setCachedSongs(songs)
      setCacheStats(stats)
    } catch (error) {
      console.error('加载缓存列表失败:', error)
    }
    setLoading(false)
  }, [])
  
  // 初始加载
  useEffect(() => {
    loadCacheList()
    
    // 监听缓存变化事件
    const handleSongCached = () => {
      loadCacheList()
    }
    
    window.addEventListener('songCached', handleSongCached)
    
    return () => {
      window.removeEventListener('songCached', handleSongCached)
    }
  }, [loadCacheList])
  
  // 删除单个缓存
  const handleDeleteCache = async (trackId: string) => {
    await deleteSongCache(trackId)
    setCachedSongs(prev => prev.filter(s => s.trackId !== trackId))
    setCacheStats(prev => ({
      count: prev.count - 1,
      totalSize: prev.totalSize - (cachedSongs.find(s => s.trackId === trackId)?.cachedSize || 0)
    }))
  }
  
  // 清空所有缓存
  const handleClearAll = async () => {
    if (confirm('确定要清空所有缓存吗？此操作不可恢复。')) {
      await clearAllSongCache()
      setCachedSongs([])
      setCacheStats({ count: 0, totalSize: 0 })
    }
  }
  
  // 播放缓存的歌曲
  const handlePlayCached = (song: CachedSong) => {
    const track: PluginTrack = {
      id: song.trackId,
      title: song.title,
      artists: song.artists,
      album: song.album,
      coverUrl: song.coverUrl,
      duration: song.duration,
      extra: song.extra as Record<string, unknown>,
    }
    onPlay(track)
  }
  
  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  }
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp
    
    if (diff < 60 * 1000) return '刚刚'
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60 / 1000)} 分钟前`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 60 / 60 / 1000)} 小时前`
    if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 24 / 60 / 60 / 1000)} 天前`
    
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="flex-shrink-0 max-w-2xl mx-auto w-full py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-semibold text-surface-100">
              本地缓存
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              {cacheStats.count} 首歌曲 · {formatSize(cacheStats.totalSize)}
            </p>
          </div>
          
          {cachedSongs.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors text-sm"
            >
              <Trash2 className="w-4 h-4" />
              清空缓存
            </button>
          )}
        </div>
      </div>
      
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
          ) : cachedSongs.length === 0 ? (
            <EmptyState
              icon={HardDrive}
              title="暂无缓存"
              description="播放过的歌曲会自动缓存到本地"
            />
          ) : (
            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {cachedSongs.map((song, index) => {
                  const isCurrent = currentTrack?.id === song.trackId
                  
                  return (
                    <motion.div
                      key={song.trackId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                      onClick={() => handlePlayCached(song)}
                      className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group ${
                        isCurrent ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
                      }`}
                    >
                      {/* 序号/播放按钮 */}
                      <button className="w-8 h-8 rounded-lg flex items-center justify-center transition-all">
                        {isCurrent ? (
                          isPlaying ? (
                            <div className="flex items-end gap-0.5 h-4">
                              {[1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="w-0.5 bg-primary-400 rounded-full wave-bar"
                                  style={{ height: '100%', animationDelay: `${i * 0.1}s` }}
                                />
                              ))}
                            </div>
                          ) : (
                            <Pause className="w-4 h-4 text-primary-400" />
                          )
                        ) : (
                          <>
                            <span className="text-xs text-surface-500 group-hover:hidden">
                              {index + 1}
                            </span>
                            <Play className="w-4 h-4 text-surface-400 hidden group-hover:block" fill="currentColor" />
                          </>
                        )}
                      </button>
                      
                      {/* 封面 */}
                      <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                        {song.coverUrl ? (
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                            <Music className="w-4 h-4 text-surface-500" />
                          </div>
                        )}
                      </div>
                      
                      {/* 歌曲信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-sm font-medium truncate ${
                            isCurrent ? 'text-primary-400' : 'text-surface-100'
                          }`}>
                            {song.title}
                          </h4>
                          <HardDrive className="w-3 h-3 text-primary-400 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-surface-400 truncate mt-0.5">
                          {song.artists?.join(' / ') || '未知艺术家'}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {formatSize(song.cachedSize)} · {formatTime(song.cachedAt)}
                        </p>
                      </div>
                      
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCache(song.trackId) }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
