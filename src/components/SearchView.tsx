import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Search, 
  Loader2, 
  Music, 
  AlertCircle, 
  ChevronDown,
  Play,
  Plus,
  Check,
  ChevronDownCircle,
  User,
  Disc3,
  ListMusic,
  ArrowLeft,
  Radio,
  Heart,
} from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'
import { usePlayerStore } from '../stores/playerStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import type { PluginTrack, PluginArtist, PluginAlbum, PluginPlaylist, SearchType } from '../types/plugin'

const searchTabs: { id: SearchType; label: string; icon: typeof Music }[] = [
  { id: 'music', label: '歌曲', icon: Music },
  { id: 'artist', label: '歌手', icon: User },
  { id: 'album', label: '专辑', icon: Disc3 },
  { id: 'sheet', label: '歌单', icon: ListMusic },
]

export function SearchView() {
  const [inputValue, setInputValue] = useState('')
  const [showPluginSelect, setShowPluginSelect] = useState(false)
  
  const {
    plugins,
    pluginsLoading,
    activePluginId,
    searchQuery,
    searchType,
    searchResults,
    artistResults,
    albumResults,
    playlistResults,
    searching,
    searchError,
    searchHasMore,
    loadingMore,
    detailType,
    detailData,
    detailTracks,
    detailLoading,
    detailHasMore,
    setActivePlugin,
    setSearchQuery,
    setSearchType,
    search,
    loadMore,
    loadArtistDetail,
    loadAlbumDetail,
    loadPlaylistDetail,
    loadMoreDetailTracks,
    clearDetail,
  } = usePluginStore()
  
  const {
    currentTrack,
    playlist,
    setCurrentTrack,
    addToPlaylist,
    setPlaylist,
    appendToPlaylist,
    setIsPlaying,
  } = usePlayerStore()
  
  // 获取可用插件（已加载成功的）
  const readyPlugins = plugins.filter((p) => p.status === 'ready')
  const activePlugin = plugins.find((p) => p.meta.id === activePluginId)
  
  // 输入框同步
  useEffect(() => {
    if (searchQuery && !inputValue) {
      setInputValue(searchQuery)
    }
  }, [searchQuery])
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || !activePluginId) return
    setSearchQuery(inputValue)
    await search(inputValue, searchType)
  }
  
  const handleTabChange = (type: SearchType) => {
    setSearchType(type)
    if (searchQuery) {
      search(searchQuery, type)
    }
  }
  
  const handlePluginChange = (pluginId: string) => {
    setActivePlugin(pluginId)
    setShowPluginSelect(false)
    // 如果有搜索词，切换插件后重新搜索
    if (searchQuery) {
      setTimeout(() => search(searchQuery, searchType), 100)
    }
  }
  
  const handlePlay = (track: PluginTrack) => {
    setCurrentTrack(track)
    setIsPlaying(true)
    addToPlaylist(track)
  }
  
  const handlePlayAll = (tracks: PluginTrack[], name: string, append = false) => {
    if (tracks.length === 0) return
    if (append) {
      appendToPlaylist(tracks, name)
    } else {
      setPlaylist(tracks, name)
      setCurrentTrack(tracks[0])
      setIsPlaying(true)
    }
  }
  
  const handleArtistClick = (artist: PluginArtist) => {
    loadArtistDetail(artist)
  }
  
  const handleAlbumClick = (album: PluginAlbum) => {
    loadAlbumDetail(album)
  }
  
  const handlePlaylistClick = (playlist: PluginPlaylist) => {
    loadPlaylistDetail(playlist)
  }
  
  // 如果有详情页，显示详情页
  if (detailType && detailData) {
    const detailName = (detailData as PluginAlbum | PluginPlaylist).title || (detailData as PluginArtist).name || ''
    return (
      <DetailView
        type={detailType}
        data={detailData}
        tracks={detailTracks}
        loading={detailLoading}
        hasMore={detailHasMore}
        currentTrack={currentTrack}
        playlist={playlist}
        onBack={clearDetail}
        onPlay={handlePlay}
        onPlayAll={() => handlePlayAll(detailTracks, detailName)}
        onAppendAll={() => handlePlayAll(detailTracks, detailName, true)}
        onAddToPlaylist={addToPlaylist}
        onLoadMore={loadMoreDetailTracks}
      />
    )
  }
  
  return (
    <div className="h-full flex flex-col px-4">
      {/* 搜索表单 */}
      <div className="max-w-2xl mx-auto w-full pt-2 pb-4">
        <form onSubmit={handleSearch} className="space-y-3">
          {/* 搜索框 + 插件选择 */}
          <div className="flex gap-2">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="搜索歌曲、歌手、专辑..."
                className="w-full glass rounded-xl py-3.5 pl-12 pr-4 text-surface-100 placeholder-surface-500 focus:ring-2 focus:ring-primary-500/50"
                disabled={pluginsLoading || readyPlugins.length === 0}
              />
              {searching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400 animate-spin" />
              )}
            </div>
            
            {/* 插件源选择 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPluginSelect(!showPluginSelect)}
                disabled={pluginsLoading || readyPlugins.length === 0}
                className="h-full glass rounded-xl px-4 flex items-center gap-2 text-left hover:bg-surface-700/50 transition-colors disabled:opacity-50"
              >
                <Radio className="w-4 h-4 text-primary-400" />
                <span className="text-sm text-surface-200 max-w-[100px] truncate">
                  {pluginsLoading ? '加载中...' : activePlugin?.meta.name || '选择源'}
                </span>
                <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${showPluginSelect ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {showPluginSelect && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute z-30 top-full right-0 mt-2 w-48 glass rounded-xl overflow-hidden max-h-64 overflow-y-auto"
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
                          onClick={() => handlePluginChange(plugin.meta.id)}
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
            </div>
          </div>
        </form>
        
        {/* 搜索类型 Tab */}
        {searchQuery && (
          <div className="flex gap-2 mt-4">
            {searchTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  searchType === tab.id
                    ? 'bg-primary-500 text-surface-950'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* 插件加载状态 */}
      {pluginsLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-surface-400">正在加载插件...</p>
          </div>
        </div>
      )}
      
      {/* 搜索结果 */}
      {!pluginsLoading && (
        <div className="flex-1 overflow-y-auto pb-32">
          <div className="max-w-2xl mx-auto">
            {/* 错误提示 */}
            {searchError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4"
              >
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{searchError}</p>
              </motion.div>
            )}
            
            {/* 歌曲结果 */}
            {searchType === 'music' && (
              <TrackList
                tracks={searchResults}
                currentTrack={currentTrack}
                playlist={playlist}
                searching={searching}
                hasMore={searchHasMore}
                loadingMore={loadingMore}
                onPlay={handlePlay}
                onPlayAll={() => handlePlayAll(searchResults, `搜索: ${searchQuery}`)}
                onAddToPlaylist={addToPlaylist}
                onLoadMore={loadMore}
              />
            )}
            
            {/* 歌手结果 */}
            {searchType === 'artist' && (
              <ArtistList
                artists={artistResults}
                searching={searching}
                hasMore={searchHasMore}
                loadingMore={loadingMore}
                onClick={handleArtistClick}
                onLoadMore={loadMore}
              />
            )}
            
            {/* 专辑结果 */}
            {searchType === 'album' && (
              <AlbumList
                albums={albumResults}
                searching={searching}
                hasMore={searchHasMore}
                loadingMore={loadingMore}
                onClick={handleAlbumClick}
                onLoadMore={loadMore}
              />
            )}
            
            {/* 歌单结果 */}
            {searchType === 'sheet' && (
              <PlaylistList
                playlists={playlistResults}
                searching={searching}
                hasMore={searchHasMore}
                loadingMore={loadingMore}
                onClick={handlePlaylistClick}
                onLoadMore={loadMore}
              />
            )}
            
            {/* 初始状态 */}
            {!searchQuery && !pluginsLoading && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center">
                  <Music className="w-10 h-10 text-primary-400" />
                </div>
                <h3 className="text-lg font-display font-medium text-surface-200 mb-2">
                  开始搜索
                </h3>
                <p className="text-sm text-surface-500 max-w-xs mx-auto">
                  {readyPlugins.length > 0 
                    ? `已加载 ${readyPlugins.length} 个插件，输入关键词搜索音乐`
                    : '暂无可用插件，请到插件页面检查'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 歌曲列表组件
function TrackList({
  tracks,
  currentTrack,
  playlist,
  searching,
  hasMore,
  loadingMore,
  onPlay,
  onPlayAll,
  onAddToPlaylist,
  onLoadMore,
}: {
  tracks: PluginTrack[]
  currentTrack: PluginTrack | null
  playlist: PluginTrack[]
  searching: boolean
  hasMore: boolean
  loadingMore: boolean
  onPlay: (track: PluginTrack) => void
  onPlayAll: () => void
  onAddToPlaylist: (track: PluginTrack) => void
  onLoadMore: () => void
}) {
  const { isSongFavorited, toggleSong } = useFavoriteStore()
  const isInPlaylist = (trackId: string) => playlist.some((t) => t.id === trackId)
  
  if (searching && tracks.length === 0) {
    return null
  }
  
  if (!searching && tracks.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400">未找到相关歌曲</p>
      </div>
    )
  }
  
  return (
    <>
      {tracks.length > 0 && (
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-sm text-surface-400">
            找到 <span className="text-primary-400">{tracks.length}</span> 首歌曲
          </p>
          <button
            onClick={onPlayAll}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-500/20 text-primary-400 text-sm hover:bg-primary-500/30 transition-colors"
          >
            <Play className="w-4 h-4" fill="currentColor" />
            播放全部
          </button>
        </div>
      )}
      
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {tracks.map((track, index) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ delay: Math.min(index * 0.02, 0.3) }}
              onClick={() => onPlay(track)}
              className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group ${
                currentTrack?.id === track.id ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
              }`}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                    <Music className="w-5 h-5 text-surface-500" />
                  </div>
                )}
                {currentTrack?.id === track.id && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="w-0.5 bg-primary-400 rounded-full wave-bar" style={{ height: '100%', animationDelay: `${i * 0.1}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-surface-100 truncate">{track.title}</h4>
                <p className="text-xs text-surface-400 truncate mt-0.5">
                  {track.artists?.join(' / ') || '未知艺术家'}
                  {track.album && ` · ${track.album}`}
                </p>
              </div>
              
              {/* 收藏按钮 */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSong(track) }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isSongFavorited(track.id)
                    ? 'text-red-400'
                    : 'text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100'
                }`}
              >
                <Heart className="w-4 h-4" fill={isSongFavorited(track.id) ? 'currentColor' : 'none'} />
              </button>
              
              {/* 添加到播放列表按钮 */}
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
        </AnimatePresence>
      </div>
      
      {tracks.length > 0 && hasMore && (
        <div className="flex justify-center py-6">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />加载中...</> : <><ChevronDownCircle className="w-4 h-4" />加载更多</>}
          </button>
        </div>
      )}
      
      {tracks.length > 0 && !hasMore && !searching && (
        <div className="text-center py-6"><p className="text-sm text-surface-500">没有更多了</p></div>
      )}
    </>
  )
}

// 歌手列表组件
function ArtistList({
  artists,
  searching,
  hasMore,
  loadingMore,
  onClick,
  onLoadMore,
}: {
  artists: PluginArtist[]
  searching: boolean
  hasMore: boolean
  loadingMore: boolean
  onClick: (artist: PluginArtist) => void
  onLoadMore: () => void
}) {
  const { isArtistFavorited, toggleArtist } = useFavoriteStore()
  
  if (searching && artists.length === 0) return null
  
  if (!searching && artists.length === 0) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400">未找到相关歌手</p>
      </div>
    )
  }
  
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {artists.map((artist, index) => (
          <motion.div
            key={artist.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(index * 0.03, 0.3) }}
            className="glass rounded-xl p-4 cursor-pointer hover:bg-surface-700/50 transition-colors text-center relative group"
          >
            {/* 收藏按钮 */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleArtist(artist) }}
              className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                isArtistFavorited(artist.id)
                  ? 'text-red-400 bg-red-500/10'
                  : 'text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 bg-surface-800/50'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={isArtistFavorited(artist.id) ? 'currentColor' : 'none'} />
            </button>
            
            <div onClick={() => onClick(artist)}>
              <div className="w-16 h-16 mx-auto rounded-full overflow-hidden mb-3">
                {artist.avatar ? (
                  <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                    <User className="w-8 h-8 text-surface-500" />
                  </div>
                )}
              </div>
              <h4 className="text-sm font-medium text-surface-100 truncate">{artist.name}</h4>
              {artist.worksNum && <p className="text-xs text-surface-500 mt-1">{artist.worksNum} 首歌曲</p>}
            </div>
          </motion.div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center py-6">
          <button onClick={onLoadMore} disabled={loadingMore} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50">
            {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />加载中...</> : <><ChevronDownCircle className="w-4 h-4" />加载更多</>}
          </button>
        </div>
      )}
    </>
  )
}

// 专辑列表组件
function AlbumList({
  albums,
  searching,
  hasMore,
  loadingMore,
  onClick,
  onLoadMore,
}: {
  albums: PluginAlbum[]
  searching: boolean
  hasMore: boolean
  loadingMore: boolean
  onClick: (album: PluginAlbum) => void
  onLoadMore: () => void
}) {
  const { isAlbumFavorited, toggleAlbum } = useFavoriteStore()
  
  if (searching && albums.length === 0) return null
  
  if (!searching && albums.length === 0) {
    return (
      <div className="text-center py-12">
        <Disc3 className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400">未找到相关专辑</p>
      </div>
    )
  }
  
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {albums.map((album, index) => (
          <motion.div
            key={album.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(index * 0.03, 0.3) }}
            className="glass rounded-xl p-3 cursor-pointer hover:bg-surface-700/50 transition-colors relative group"
          >
            {/* 收藏按钮 */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleAlbum(album) }}
              className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                isAlbumFavorited(album.id)
                  ? 'text-red-400 bg-red-500/10'
                  : 'text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100 bg-surface-800/50'
              }`}
            >
              <Heart className="w-3.5 h-3.5" fill={isAlbumFavorited(album.id) ? 'currentColor' : 'none'} />
            </button>
            
            <div onClick={() => onClick(album)}>
              <div className="aspect-square rounded-lg overflow-hidden mb-3">
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                    <Disc3 className="w-10 h-10 text-surface-500" />
                  </div>
                )}
              </div>
              <h4 className="text-sm font-medium text-surface-100 truncate">{album.title}</h4>
              {album.artist && <p className="text-xs text-surface-500 mt-1 truncate">{album.artist}</p>}
              {album.date && <p className="text-xs text-surface-600 mt-0.5">{album.date}</p>}
            </div>
          </motion.div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center py-6">
          <button onClick={onLoadMore} disabled={loadingMore} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50">
            {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />加载中...</> : <><ChevronDownCircle className="w-4 h-4" />加载更多</>}
          </button>
        </div>
      )}
    </>
  )
}

// 歌单列表组件
function PlaylistList({
  playlists,
  searching,
  hasMore,
  loadingMore,
  onClick,
  onLoadMore,
}: {
  playlists: PluginPlaylist[]
  searching: boolean
  hasMore: boolean
  loadingMore: boolean
  onClick: (playlist: PluginPlaylist) => void
  onLoadMore: () => void
}) {
  const { isPlaylistFavorited, togglePlaylist } = useFavoriteStore()
  
  if (searching && playlists.length === 0) return null
  
  if (!searching && playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <ListMusic className="w-12 h-12 text-surface-600 mx-auto mb-3" />
        <p className="text-surface-400">未找到相关歌单</p>
      </div>
    )
  }
  
  return (
    <>
      <div className="space-y-2">
        {playlists.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.03, 0.3) }}
            className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group"
          >
            <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" onClick={() => onClick(item)}>
              {item.coverUrl ? (
                <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                  <ListMusic className="w-6 h-6 text-surface-500" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0" onClick={() => onClick(item)}>
              <h4 className="text-sm font-medium text-surface-100 truncate">{item.title}</h4>
              <p className="text-xs text-surface-500 mt-1">
                {item.artist && <span>{item.artist}</span>}
                {item.playCount && <span> · {item.playCount.toLocaleString()} 次播放</span>}
                {item.worksNum && <span> · {item.worksNum} 首</span>}
              </p>
            </div>
            
            {/* 收藏按钮 */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlaylist(item) }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                isPlaylistFavorited(item.id)
                  ? 'text-red-400'
                  : 'text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100'
              }`}
            >
              <Heart className="w-4 h-4" fill={isPlaylistFavorited(item.id) ? 'currentColor' : 'none'} />
            </button>
          </motion.div>
        ))}
      </div>
      
      {hasMore && (
        <div className="flex justify-center py-6">
          <button onClick={onLoadMore} disabled={loadingMore} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50">
            {loadingMore ? <><Loader2 className="w-4 h-4 animate-spin" />加载中...</> : <><ChevronDownCircle className="w-4 h-4" />加载更多</>}
          </button>
        </div>
      )}
    </>
  )
}

// 详情页组件
function DetailView({
  type,
  data,
  tracks,
  loading,
  hasMore,
  currentTrack,
  playlist,
  onBack,
  onPlay,
  onPlayAll,
  onAppendAll,
  onAddToPlaylist,
  onLoadMore,
}: {
  type: 'artist' | 'album' | 'playlist'
  data: PluginArtist | PluginAlbum | PluginPlaylist
  tracks: PluginTrack[]
  loading: boolean
  hasMore: boolean
  currentTrack: PluginTrack | null
  playlist: PluginTrack[]
  onBack: () => void
  onPlay: (track: PluginTrack) => void
  onPlayAll: () => void
  onAppendAll: () => void
  onAddToPlaylist: (track: PluginTrack) => void
  onLoadMore: () => void
}) {
  const isInPlaylist = (trackId: string) => playlist.some((t) => t.id === trackId)
  
  const title = type === 'artist' ? (data as PluginArtist).name : (data as PluginAlbum | PluginPlaylist).title
  const cover = type === 'artist' ? (data as PluginArtist).avatar : (data as PluginAlbum | PluginPlaylist).coverUrl
  const subtitle = type === 'album' ? (data as PluginAlbum).artist : 
                   type === 'playlist' ? (data as PluginPlaylist).artist : 
                   (data as PluginArtist).worksNum ? `${(data as PluginArtist).worksNum} 首歌曲` : ''
  
  return (
    <div className="h-full flex flex-col px-4">
      {/* 头部 */}
      <div className="max-w-2xl mx-auto w-full pt-2 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          返回搜索
        </button>
        
        <div className="flex items-center gap-4">
          <div className={`w-24 h-24 ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden flex-shrink-0`}>
            {cover ? (
              <img src={cover} alt={title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                {type === 'artist' ? <User className="w-10 h-10 text-surface-500" /> :
                 type === 'album' ? <Disc3 className="w-10 h-10 text-surface-500" /> :
                 <ListMusic className="w-10 h-10 text-surface-500" />}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-display font-semibold text-surface-100 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-surface-400 mt-1">{subtitle}</p>}
            {tracks.length > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onPlayAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-surface-950 text-sm font-medium hover:bg-primary-400 transition-colors"
                >
                  <Play className="w-4 h-4" fill="currentColor" />
                  播放全部
                </button>
                <button
                  onClick={onAppendAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 text-surface-200 text-sm font-medium hover:bg-surface-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  追加到列表
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 歌曲列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto">
          {loading && tracks.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-12 h-12 text-surface-600 mx-auto mb-3" />
              <p className="text-surface-400">暂无歌曲</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-surface-500 mb-4">{tracks.length} 首歌曲</p>
              <div className="space-y-2">
                {tracks.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.3) }}
                    onClick={() => onPlay(track)}
                    className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group ${
                      currentTrack?.id === track.id ? 'ring-1 ring-primary-500/50 bg-primary-500/5' : ''
                    }`}
                  >
                    <div className="w-8 text-center text-sm text-surface-500">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-surface-100 truncate">{track.title}</h4>
                      <p className="text-xs text-surface-400 truncate mt-0.5">{track.artists?.join(' / ')}</p>
                    </div>
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
              
              {hasMore && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={onLoadMore}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />加载中...</> : <><ChevronDownCircle className="w-4 h-4" />加载更多</>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
