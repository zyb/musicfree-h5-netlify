import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
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
} from 'lucide-react'
import { usePlayerStore } from '../stores/playerStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { usePluginStore } from '../stores/pluginStore'
import type { PluginTrack, PluginArtist, PluginAlbum, PluginPlaylist } from '../types/plugin'

type MainTabId = 'current' | 'history' | 'favorites'
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
  
  const {
    playlist,
    playlistName,
    playHistory,
    currentTrack,
    isPlaying,
    setPlaylist,
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
  
  const handleReorder = (newOrder: PluginTrack[]) => {
    setPlaylist(newOrder, playlistName)
  }
  
  // 打开歌手详情
  const handleOpenArtist = async (artist: PluginArtist) => {
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
  }
  
  // 播放全部
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
  
  // 如果有详情页，显示详情
  if (detailType && detailData) {
    return (
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
    )
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
            <span className="hidden sm:inline">当前</span>
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
            <span className="hidden sm:inline">历史</span>
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
            <span className="hidden sm:inline">收藏</span>
          </button>
        </div>
      </div>
      
      {/* 内容区 */}
      <AnimatePresence mode="wait">
        {mainTab === 'current' && (
          <motion.div
            key="current"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <CurrentPlaylist
              playlist={playlist}
              playlistName={playlistName}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onReorder={handleReorder}
              onRemove={removeFromPlaylist}
              onClear={clearPlaylist}
            />
          </motion.div>
        )}
        
        {mainTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <PlayHistory
              history={playHistory}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onRemove={removeFromHistory}
              onClear={clearHistory}
            />
          </motion.div>
        )}
        
        {mainTab === 'favorites' && (
          <motion.div
            key="favorites"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <FavoritesView
              activeTab={favoriteTab}
              onTabChange={setFavoriteTab}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onPlay={handlePlay}
              onOpenArtist={handleOpenArtist}
              onOpenAlbum={handleOpenAlbum}
              onOpenPlaylist={handleOpenPlaylist}
            />
          </motion.div>
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
    <div className="h-full flex flex-col px-4">
      {/* 头部 */}
      <div className="py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          返回收藏
        </button>
        
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden flex-shrink-0`}>
            {getCover() ? (
              <img src={getCover()} alt={getTitle()} className="w-full h-full object-cover" />
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
                  <h4 className={`text-sm font-medium truncate ${
                    currentTrack?.id === track.id ? 'text-primary-400' : 'text-surface-100'
                  }`}>
                    {track.title}
                  </h4>
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
  )
}

// 收藏页面
function FavoritesView({
  activeTab,
  onTabChange,
  currentTrack,
  isPlaying,
  onPlay,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  activeTab: FavoriteTabId
  onTabChange: (tab: FavoriteTabId) => void
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
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
    <>
      {/* 子 Tab */}
      <div className="max-w-2xl mx-auto w-full py-2">
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
      <div className="max-w-2xl mx-auto w-full py-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-semibold text-surface-100">
              我的收藏
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              共 {totalCount} 项
            </p>
          </div>
          
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
      
      {/* 列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'songs' && (
              <motion.div
                key="songs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
              </motion.div>
            )}
            
            {activeTab === 'artists' && (
              <motion.div
                key="artists"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
              </motion.div>
            )}
            
            {activeTab === 'albums' && (
              <motion.div
                key="albums"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
              </motion.div>
            )}
            
            {activeTab === 'playlists' && (
              <motion.div
                key="playlists"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
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
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <Music className="w-4 h-4 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium truncate ${isCurrent ? 'text-primary-400' : 'text-surface-100'}`}>
          {track.title}
        </h4>
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
          <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
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
          <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
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
          <img src={playlist.coverUrl} alt={playlist.title} className="w-full h-full object-cover" />
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
  playlistName,
  currentTrack,
  isPlaying,
  onPlay,
  onReorder,
  onRemove,
  onClear,
}: {
  playlist: PluginTrack[]
  playlistName: string
  currentTrack: PluginTrack | null
  isPlaying: boolean
  onPlay: (track: PluginTrack) => void
  onReorder: (tracks: PluginTrack[]) => void
  onRemove: (trackId: string) => void
  onClear: () => void
}) {
  return (
    <>
      {/* 头部 */}
      <div className="max-w-2xl mx-auto w-full py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-display font-semibold text-surface-100">
              {playlistName}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
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
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          {playlist.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title="播放列表为空"
              description="选择歌单、专辑或歌手后，歌曲会添加到这里"
            />
          ) : (
            <Reorder.Group 
              axis="y" 
              values={playlist} 
              onReorder={onReorder}
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {playlist.map((track, index) => (
                  <Reorder.Item
                    key={track.id}
                    value={track}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                    className="touch-none"
                  >
                    <TrackItem
                      track={track}
                      index={index}
                      currentTrack={currentTrack}
                      isPlaying={isPlaying}
                      showDragHandle
                      onPlay={onPlay}
                      onRemove={onRemove}
                    />
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          )}
        </div>
      </div>
    </>
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
    <>
      {/* 头部 */}
      <div className="max-w-2xl mx-auto w-full py-3">
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
    </>
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
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
            <Music className="w-4 h-4 text-surface-500" />
          </div>
        )}
      </div>
      
      {/* 歌曲信息 */}
      <div className="flex-1 min-w-0" onClick={() => onPlay(track)}>
        <h4 className={`text-sm font-medium truncate cursor-pointer ${
          isCurrent ? 'text-primary-400' : 'text-surface-100'
        }`}>
          {track.title}
        </h4>
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
