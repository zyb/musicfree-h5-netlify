import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Loader2,
  Music,
  AlertCircle,
  Play,
  Plus,
  Check,
  ChevronDownCircle,
  HardDrive,
  User,
  Disc3,
  ListMusic,
  ArrowLeft,
  Heart,
  Crown,
  Sparkles,
  X,
} from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'
import { usePlayerStore } from '../stores/playerStore'
import { useFavoriteStore } from '../stores/favoriteStore'
import { isSongCached } from '../lib/songCache'
import type {
  PluginTrack,
  PluginArtist,
  PluginAlbum,
  PluginPlaylist,
  SearchType,
  PluginRecommendTag,
  PluginTopListGroup,
  MusicPlugin,
} from '../types/plugin'

const searchTabs: { id: SearchType; label: string; icon: typeof Music }[] = [
  { id: 'music', label: '歌曲', icon: Music },
  { id: 'artist', label: '歌手', icon: User },
  { id: 'album', label: '专辑', icon: Disc3 },
  { id: 'sheet', label: '歌单', icon: ListMusic },
]

export function SearchView() {
  const [inputValue, setInputValue] = useState('')
  const [activeTab, setActiveTab] = useState<'top' | 'recommend' | 'search'>('top')
  const initializedPluginsRef = useRef<Set<string>>(new Set())
  
  // 滚动位置保存
  const contentScrollRef = useRef<HTMLDivElement>(null)
  const scrollPositions = useRef<Map<'top' | 'recommend' | 'search', number>>(new Map())
  
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
    setSearchQuery,
    setSearchType,
    search,
    loadMore,
    loadArtistDetail,
    loadAlbumDetail,
    loadPlaylistDetail,
    loadMoreDetailTracks,
    clearDetail,
    clearSearch,
    topListGroups,
    topListLoading,
    loadTopLists,
    recommendTags,
    recommendSelectedTagId,
    recommendSheets,
    recommendLoading,
    recommendHasMore,
    loadRecommendTags,
    setRecommendTag,
    loadRecommendSheets,
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
  
  // 当切换插件时重置 Tab
  useEffect(() => {
    if (!searchQuery) {
      setActiveTab('top')
    }
  }, [activePluginId, searchQuery])
  
  useEffect(() => {
    if (!activePluginId || !activePlugin?.instance) return
    // 只在插件首次加载时从缓存加载，后续切换tab时使用缓存
    const isFirstLoad = !initializedPluginsRef.current.has(activePluginId)
    if (isFirstLoad) {
      initializedPluginsRef.current.add(activePluginId)
      // 从缓存加载，如果没有缓存或出错才会从网络获取
      loadTopLists(false)
      loadRecommendTags(false)
    }
    // 注意：不在这里调用 loadTopLists(false)，因为 store 中已经有缓存逻辑
    // 切换 tab 时不会触发这个 useEffect，所以不会重新加载
  }, [activePluginId, activePlugin?.instance])
  
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
    setActiveTab('search')
    await search(inputValue, searchType)
  }
  
  const handleClearSearch = () => {
    setInputValue('')
    clearSearch()
    clearDetail()
  }
  
  const handleTabChange = (type: SearchType) => {
    setSearchType(type)
    if (searchQuery) {
      search(searchQuery, type)
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
    // 保存当前滚动位置
    if (contentScrollRef.current) {
      scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
    }
    loadArtistDetail(artist)
  }
  
  const handleAlbumClick = (album: PluginAlbum) => {
    // 保存当前滚动位置
    if (contentScrollRef.current) {
      scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
    }
    loadAlbumDetail(album)
  }
  
  const handlePlaylistClick = (playlist: PluginPlaylist) => {
    // 保存当前滚动位置
    if (contentScrollRef.current) {
      scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
    }
    loadPlaylistDetail(playlist)
  }
  
  // 处理返回详情页
  const handleBackFromDetail = () => {
    clearDetail()
    // 恢复滚动位置
    if (contentScrollRef.current) {
      const savedPosition = scrollPositions.current.get(activeTab)
      if (savedPosition !== undefined) {
        // 使用 requestAnimationFrame 确保 DOM 已更新
        requestAnimationFrame(() => {
          if (contentScrollRef.current) {
            contentScrollRef.current.scrollTop = savedPosition
          }
        })
      }
    }
  }
  
  return (
    <div className="h-full flex flex-col px-4">
      {/* Tab */}
      <div className="max-w-2xl mx-auto w-full pt-2 pb-4">
        <div className="flex gap-2 justify-between items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                // 保存当前滚动位置
                if (contentScrollRef.current) {
                  scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
                }
                setActiveTab('top')
                // 恢复新 tab 的滚动位置
                requestAnimationFrame(() => {
                  if (contentScrollRef.current) {
                    const savedPosition = scrollPositions.current.get('top')
                    if (savedPosition !== undefined) {
                      contentScrollRef.current.scrollTop = savedPosition
                    } else {
                      contentScrollRef.current.scrollTop = 0
                    }
                  }
                })
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                activeTab === 'top'
                  ? 'bg-primary-500 text-surface-950'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-100'
              }`}
            >
              <Crown className="w-4 h-4" />
              排行榜
            </button>
            <button
              type="button"
              onClick={() => {
                // 保存当前滚动位置
                if (contentScrollRef.current) {
                  scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
                }
                setActiveTab('recommend')
                // 恢复新 tab 的滚动位置
                requestAnimationFrame(() => {
                  if (contentScrollRef.current) {
                    const savedPosition = scrollPositions.current.get('recommend')
                    if (savedPosition !== undefined) {
                      contentScrollRef.current.scrollTop = savedPosition
                    } else {
                      contentScrollRef.current.scrollTop = 0
                    }
                  }
                })
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                activeTab === 'recommend'
                  ? 'bg-primary-500 text-surface-950'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              推荐歌单
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              // 保存当前滚动位置
              if (contentScrollRef.current) {
                scrollPositions.current.set(activeTab, contentScrollRef.current.scrollTop)
              }
              setActiveTab('search')
              // 恢复新 tab 的滚动位置
              requestAnimationFrame(() => {
                if (contentScrollRef.current) {
                  const savedPosition = scrollPositions.current.get('search')
                  if (savedPosition !== undefined) {
                    contentScrollRef.current.scrollTop = savedPosition
                  } else {
                    contentScrollRef.current.scrollTop = 0
                  }
                }
              })
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'search'
                ? 'bg-primary-500 text-surface-950 shadow-lg shadow-primary-500/30'
                : 'bg-primary-500/20 text-primary-400 border border-primary-500/40 hover:bg-primary-500/30 hover:border-primary-500/60 hover:text-primary-300'
            }`}
          >
            <Search className="w-4.5 h-4.5" />
            搜索
          </button>
        </div>
        
        {/* 搜索框 - 仅在搜索tab时显示 */}
        {activeTab === 'search' && (
          <div className="mt-4 space-y-3">
            <form onSubmit={handleSearch} className="w-full">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="搜索歌曲、歌手、专辑..."
                  className={`w-full glass rounded-xl py-3.5 text-surface-100 placeholder-surface-500 focus:ring-2 focus:ring-primary-500/50 ${
                    inputValue || searchQuery ? 'pl-12 pr-12' : 'pl-12 pr-4'
                  }`}
                  disabled={pluginsLoading || readyPlugins.length === 0}
                />
                {searching && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400 animate-spin" />
                )}
                {(inputValue || searchQuery) && !searching && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </form>
            
            {/* 搜索类型 Tab */}
            {searchQuery && (
              <div className="flex gap-2">
                {searchTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === tab.id
                        ? 'bg-primary-500 text-surface-950'
                        : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
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
        <div ref={contentScrollRef} className="flex-1 overflow-y-auto pb-32">
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
            
            <div className="relative">
              {/* 排行榜 - 保持挂载 */}
              <div
                className={`transition-opacity duration-200 ${
                  activeTab === 'top' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none overflow-hidden'
                }`}
              >
                <TopListSection
                  supported={!!activePlugin?.instance?.getTopLists}
                  groups={topListGroups}
                  loading={topListLoading}
                  pluginInstance={activePlugin?.instance}
                  onPlayTrack={handlePlay}
                />
              </div>
              
              {/* 推荐歌单 - 保持挂载 */}
              <div
                className={`transition-opacity duration-200 ${
                  activeTab === 'recommend' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none overflow-hidden'
                }`}
              >
                <RecommendSection
                  supported={!!activePlugin?.instance?.getRecommendSheetTags}
                  tags={recommendTags}
                  selectedTagId={recommendSelectedTagId}
                  playlists={recommendSheets}
                  loading={recommendLoading}
                  hasMore={recommendHasMore}
                  onSelectTag={setRecommendTag}
                  onLoadMore={() => loadRecommendSheets(undefined, false)}
                  onPlaylistSelect={handlePlaylistClick}
                />
              </div>
              
              {/* 搜索结果 - 保持挂载 */}
              <div
                className={`transition-opacity duration-200 ${
                  activeTab === 'search' ? 'opacity-100 relative z-10' : 'opacity-0 absolute inset-0 z-0 pointer-events-none overflow-hidden'
                }`}
              >
                {searchQuery && (
              <>
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
              </>
                )}
              </div>
            </div>
            
            {/* 初始状态 */}
            {!searchQuery && !pluginsLoading && topListGroups.length === 0 && recommendTags.length === 0 && !topListLoading && !recommendLoading && activeTab !== 'search' && (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 flex items-center justify-center">
                  <Music className="w-10 h-10 text-primary-400" />
                </div>
                <h3 className="text-lg font-display font-medium text-surface-200 mb-2">
                  选择插件以浏览排行榜和推荐
                </h3>
                <p className="text-sm text-surface-500 max-w-xs mx-auto">
                  {readyPlugins.length > 0 
                    ? `已加载 ${readyPlugins.length} 个插件`
                    : '暂无可用插件，请到插件页面检查'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 详情页 - 使用 AnimatePresence 作为覆盖层，不影响列表状态 */}
      <AnimatePresence>
        {detailType && detailData && (
          <DetailView
            type={detailType}
            data={detailData}
            tracks={detailTracks}
            loading={detailLoading}
            hasMore={detailHasMore}
            currentTrack={currentTrack}
            playlist={playlist}
            onBack={handleBackFromDetail}
            onPlay={handlePlay}
            onPlayAll={() => handlePlayAll(detailTracks, (detailData as PluginAlbum | PluginPlaylist).title || (detailData as PluginArtist).name || '')}
            onAppendAll={() => handlePlayAll(detailTracks, (detailData as PluginAlbum | PluginPlaylist).title || (detailData as PluginArtist).name || '', true)}
            onAddToPlaylist={addToPlaylist}
            onLoadMore={loadMoreDetailTracks}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// 缓存图标组件（仅在播放列表、历史、收藏列表中使用，搜索结果不需要实时更新）
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

// 歌曲列表组件
function TrackList({
  tracks,
  currentTrack,
  playlist,
  searching,
  hasMore,
  loadingMore,
  onPlay,
  onPlayAll: _onPlayAll,
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
                  <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-medium text-surface-100 truncate">{track.title}</h4>
                  <CachedIcon trackId={track.id} />
                </div>
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

function TopListSection({
  groups,
  loading,
  pluginInstance,
  onPlayTrack,
  supported = true,
}: {
  groups: PluginTopListGroup[]
  loading: boolean
  pluginInstance?: MusicPlugin
  onPlayTrack: (track: PluginTrack) => void
  supported?: boolean
}) {
  const { isSongFavorited, toggleSong } = useFavoriteStore()
  const [groupTab, setGroupTab] = useState(0)
  const [activePlaylist, setActivePlaylist] = useState<PluginPlaylist | null>(null)
  const [detailTracks, setDetailTracks] = useState<PluginTrack[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const detailCacheRef = useRef<Map<string, PluginTrack[]>>(new Map())

  useEffect(() => {
    setGroupTab(0)
    // 当 groups 变化时（比如切换插件），清空缓存
    detailCacheRef.current.clear()
  }, [groups])

  const currentGroup = groups[groupTab]

  useEffect(() => {
    if (currentGroup?.data?.length) {
      const firstPlaylist = currentGroup.data[0]
      // 只有当第一个歌单的ID变化时才更新，避免对象引用变化导致重新加载
      setActivePlaylist((prev) => {
        if (prev?.id === firstPlaylist.id) {
          return prev // 保持原对象引用，避免触发后续 useEffect
        }
        return firstPlaylist
      })
    } else {
      setActivePlaylist(null)
      setDetailTracks([])
    }
  }, [currentGroup?.data?.[0]?.id])

  useEffect(() => {
    if (!activePlaylist || !pluginInstance) {
      setDetailTracks([])
      setDetailError(null)
      return
    }
    
    // 检查缓存
    const cacheKey = activePlaylist.id
    const cachedTracks = detailCacheRef.current.get(cacheKey)
    if (cachedTracks && cachedTracks.length > 0) {
      // 有缓存，直接使用，不重新请求
      setDetailTracks(cachedTracks)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    
    // 缓存中没有，才去请求
    let cancelled = false
    const loadDetail = async () => {
      setDetailLoading(true)
      setDetailError(null)
      try {
        if (pluginInstance.getTopListDetail) {
          const result = await pluginInstance.getTopListDetail(activePlaylist)
          const tracks = (result?.musicList as PluginTrack[]) || []
          if (!cancelled) {
            setDetailTracks(tracks)
            // 缓存结果
            detailCacheRef.current.set(cacheKey, tracks)
          }
        } else if (pluginInstance.getPlaylistSongs) {
          const tracks = await pluginInstance.getPlaylistSongs(activePlaylist)
          if (!cancelled) {
            const tracksArray = tracks || []
            setDetailTracks(tracksArray)
            // 缓存结果
            detailCacheRef.current.set(cacheKey, tracksArray)
          }
        } else if (!cancelled) {
          setDetailTracks([])
          setDetailError('当前插件未提供榜单详情接口')
        }
      } catch (error) {
        console.error('[TopList] 获取榜单详情失败:', error)
        if (!cancelled) {
          setDetailTracks([])
          setDetailError('加载榜单详情失败')
        }
      } finally {
        if (!cancelled) setDetailLoading(false)
      }
    }
    loadDetail()
    return () => {
      cancelled = true
    }
  }, [activePlaylist?.id, pluginInstance])

  return (
    <section className="space-y-5">
      <div />
      {(!supported) ? (
        <div className="py-8 text-center text-surface-500 text-sm">
          当前插件暂不支持排行榜
        </div>
      ) : loading && groups.length === 0 ? (
        <div className="py-10 text-center text-surface-500 text-sm">正在获取排行榜...</div>
      ) : (
        <>
          {groups.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {groups.map((group, index) => (
                <button
                  key={group.title || index}
                  type="button"
                  onClick={() => setGroupTab(index)}
                  className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                    groupTab === index
                      ? 'bg-primary-500 text-surface-950'
                      : 'bg-surface-800 text-surface-400 hover:text-surface-100'
                  }`}
                >
                  {group.title || `分组 ${index + 1}`}
                </button>
              ))}
            </div>
          )}
          {currentGroup ? (
            <div className="flex flex-wrap gap-1.5 py-1.5">
              {currentGroup.data.map((playlist) => {
                const isActive = activePlaylist?.id === playlist.id
                return (
                  <button
                    key={`${currentGroup.title}-${playlist.id}`}
                    type="button"
                    onClick={() => setActivePlaylist(playlist)}
                    className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${
                      isActive
                        ? 'bg-primary-500/15 text-primary-200 border-primary-400/60'
                        : 'bg-surface-800/70 text-surface-400 border-surface-700 hover:text-surface-100'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Crown className="w-3 h-3 text-primary-300 flex-shrink-0" />
                      {playlist.title}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-surface-500 text-sm">
              暂无排行榜数据
            </div>
          )}

          {activePlaylist && (
            <>
              {detailLoading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-primary-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-surface-500">正在加载榜单...</p>
                </div>
              ) : detailError ? (
                <div className="py-6 text-center text-surface-500 text-sm">{detailError}</div>
              ) : detailTracks.length === 0 ? (
                <div className="py-6 text-center text-surface-500 text-sm">暂无榜单数据</div>
              ) : (
                <div className="space-y-2">
                  {detailTracks.map((track, index) => {
                    const favorited = isSongFavorited(track.id)
                    return (
                      <div
                        key={`${track.id}-${index}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => onPlayTrack(track)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onPlayTrack(track)
                          }
                        }}
                        className="glass rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-700/50 transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                          {track.coverUrl ? (
                            <img
                              src={track.coverUrl}
                              alt={track.title}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-800 flex items-center justify-center">
                              <Music className="w-5 h-5 text-surface-500" />
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSong(track)
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            favorited
                              ? 'text-red-400'
                              : 'text-surface-400 hover:text-red-400 opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Heart className="w-4 h-4" fill={favorited ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}

function RecommendSection({
  tags,
  selectedTagId,
  playlists,
  loading,
  hasMore,
  onSelectTag,
  onLoadMore,
  onPlaylistSelect,
  supported = true,
}: {
  tags: PluginRecommendTag[]
  selectedTagId: string | null
  playlists: PluginPlaylist[]
  loading: boolean
  hasMore: boolean
  onSelectTag: (tagId: string) => void
  onLoadMore: () => void
  onPlaylistSelect: (playlist: PluginPlaylist) => void
  supported?: boolean
}) {
  const [showAllTags, setShowAllTags] = useState(false)
  const preferredOrder = ['全部', '国语', '粤语', '英语']
  const orderedTags: PluginRecommendTag[] = []
  for (const title of preferredOrder) {
    const tag = tags.find((t) => t.title === title)
    if (tag && !orderedTags.some((o) => o.id === tag.id)) {
      orderedTags.push(tag)
    }
  }
  for (const tag of tags) {
    if (!orderedTags.some((o) => o.id === tag.id)) {
      orderedTags.push(tag)
    }
  }
  const collapsedTags = orderedTags.slice(0, 4)
  const visibleTags = showAllTags ? orderedTags : collapsedTags
  useEffect(() => {
    setShowAllTags(false)
  }, [tags])

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-end">
        <div />
      </div>
      {supported && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {visibleTags.map((tag) => {
            const tagId = String(tag.id ?? tag.title)
            const selected = tagId === selectedTagId
            return (
              <button
                key={tagId}
                type="button"
                onClick={() => onSelectTag(tagId)}
                className={`px-3.5 py-1.5 rounded-full text-sm transition-colors ${
                  selected
                    ? 'bg-primary-500 text-surface-950'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-100'
                }`}
              >
                {tag.title || tagId}
              </button>
            )
          })}
          {tags.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllTags(!showAllTags)}
              className="px-3 py-1.5 rounded-full text-sm text-primary-300 border border-primary-400/40 hover:bg-primary-500/10 transition-colors ml-2 flex items-center gap-1"
            >
              {showAllTags ? (
                '收起'
              ) : (
                <>
                  <span>更多</span>
                  <span className="text-xs text-primary-200/80">{tags.length - 4}</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
      {(!supported) ? (
        <div className="py-6 text-center text-surface-500 text-sm">
          当前插件暂不支持推荐歌单
        </div>
      ) : loading && playlists.length === 0 ? (
        <div className="py-10 text-center text-surface-500 text-sm">正在获取推荐歌单...</div>
      ) : (
        <>
          {playlists.length > 0 ? (
            <div className="space-y-4">
              {playlists.map((playlist) => (
                <PlaylistCard
                  key={`${playlist.id}-${playlist.title}`}
                  playlist={playlist}
                  layout="row"
                  onClick={() => onPlaylistSelect(playlist)}
                />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-surface-500 text-sm">
              {tags.length === 0
                ? '暂未获取到推荐标签'
                : '请选择标签查看推荐歌单'}
            </div>
          )}
          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={onLoadMore}
                className="px-4 py-2 rounded-full text-sm text-primary-300 border border-primary-500/40 hover:bg-primary-500/10 transition-colors disabled:opacity-50"
                disabled={loading}
              >
                {loading ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function PlaylistCard({
  playlist,
  onClick,
  layout = 'grid',
}: {
  playlist: PluginPlaylist
  onClick: () => void
  layout?: 'grid' | 'row'
}) {
  const { isPlaylistFavorited, togglePlaylist } = useFavoriteStore()
  const favorited = isPlaylistFavorited(playlist.id)
  const isRow = layout === 'row'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`w-full rounded-2xl glass overflow-hidden hover:bg-surface-700/40 transition-colors text-left ${
        isRow ? 'flex items-center gap-4 p-3' : 'p-4 relative'
      }`}
    >
      <div
        className={`rounded-xl overflow-hidden bg-surface-700 flex-shrink-0 ${
          isRow ? 'w-16 h-16' : 'w-full aspect-square mb-3'
        }`}
      >
        {playlist.coverUrl ? (
          <img
            src={playlist.coverUrl}
            alt={playlist.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-surface-500 text-sm">
            无封面
          </div>
        )}
      </div>
      <div className={`flex-1 min-w-0 ${isRow ? '' : ''}`}>
        <p className="text-sm text-surface-200 font-medium truncate">{playlist.title}</p>
        {playlist.artist && (
          <p className="text-xs text-surface-500 truncate mt-1">{playlist.artist}</p>
        )}
        {typeof playlist.playCount === 'number' && (
          <p className="text-xs text-surface-500 mt-1">
            播放 {Intl.NumberFormat('zh-CN', { notation: 'compact' }).format(playlist.playCount)}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          togglePlaylist(playlist)
        }}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
          favorited
            ? 'text-red-400 bg-red-500/10'
            : 'text-surface-400 hover:text-red-400 bg-surface-700/60'
        } ${isRow ? '' : 'absolute top-3 right-3 shadow-lg'}`}
      >
        <Heart className="w-4 h-4" fill={favorited ? 'currentColor' : 'none'} />
      </button>
    </div>
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
                  <img src={artist.avatar} alt={artist.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
                <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
  const { isPlaylistFavorited, togglePlaylist } = useFavoriteStore()
  const isInPlaylist = (trackId: string) => playlist.some((t) => t.id === trackId)
  
  const title = type === 'artist' ? (data as PluginArtist).name : (data as PluginAlbum | PluginPlaylist).title
  const cover = type === 'artist' ? (data as PluginArtist).avatar : (data as PluginAlbum | PluginPlaylist).coverUrl
  const subtitle = type === 'album' ? (data as PluginAlbum).artist : 
                   type === 'playlist' ? (data as PluginPlaylist).artist : 
                   (data as PluginArtist).worksNum ? `${(data as PluginArtist).worksNum} 首歌曲` : ''
  const playlistDetail = type === 'playlist' ? (data as PluginPlaylist) : null
  const playlistFavorited = playlistDetail ? isPlaylistFavorited(playlistDetail.id) : false
  
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
      <div className="pt-2 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-surface-400 hover:text-surface-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          返回
        </button>
        
        <div className="flex items-center gap-4">
          <div className={`w-24 h-24 ${type === 'artist' ? 'rounded-full' : 'rounded-xl'} overflow-hidden flex-shrink-0`}>
            {cover ? (
              <img src={cover} alt={title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            {(tracks.length > 0 || playlistDetail) && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {tracks.length > 0 && (
                  <>
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
                  </>
                )}
                {playlistDetail && (
                  <button
                    onClick={() => togglePlaylist(playlistDetail)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      playlistFavorited
                        ? 'bg-red-500/15 text-red-300'
                        : 'bg-surface-700 text-surface-200 hover:text-red-300'
                    }`}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={playlistFavorited ? 'currentColor' : 'none'}
                    />
                    {playlistFavorited ? '已收藏' : '收藏歌单'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 歌曲列表 */}
      <div className="flex-1 overflow-y-auto pb-32">
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
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-medium text-surface-100 truncate">{track.title}</h4>
                      <CachedIcon trackId={track.id} />
                    </div>
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
    </motion.div>
  )
}
