import { create } from 'zustand'
import type { 
  LoadedPlugin, 
  PluginDescriptor,
  PluginTrack,
  PluginArtist,
  PluginAlbum,
  PluginPlaylist,
  MusicPlugin,
  SearchType,
} from '../types/plugin'
import {
  fetchPluginFeed,
  loadPluginInstance,
  forceLoadPluginInstance,
  DEFAULT_PLUGIN_FEED,
} from '../lib/pluginHost'

// 缓存相关常量
const CACHE_KEY_SUBSCRIPTIONS = 'musicfree.subscriptions'
const CACHE_KEY_PLUGINS = 'musicfree.plugins.cache'
const CACHE_KEY_ACTIVE_PLUGIN = 'musicfree.active.plugin'

// 订阅源数据结构
interface Subscription {
  id: string
  url: string
  name: string
  addedAt: number
  lastUpdated: number
}

// 插件缓存数据结构
interface PluginCache {
  subscriptionId: string
  plugins: PluginDescriptor[]
  timestamp: number
}

// 保存订阅源列表
const saveSubscriptions = (subscriptions: Subscription[]) => {
  try {
    localStorage.setItem(CACHE_KEY_SUBSCRIPTIONS, JSON.stringify(subscriptions))
  } catch (e) {
    console.warn('[Cache] 保存订阅源失败:', e)
  }
}

// 读取订阅源列表
const loadSubscriptions = (): Subscription[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_SUBSCRIPTIONS)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// 保存插件缓存
const savePluginsCache = (caches: PluginCache[]) => {
  try {
    localStorage.setItem(CACHE_KEY_PLUGINS, JSON.stringify(caches))
  } catch (e) {
    console.warn('[Cache] 保存插件缓存失败:', e)
  }
}

// 读取插件缓存
const loadPluginsCache = (): PluginCache[] => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PLUGINS)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// 保存上次选择的插件 ID
const saveActivePluginId = (pluginId: string | null) => {
  try {
    if (pluginId) {
      localStorage.setItem(CACHE_KEY_ACTIVE_PLUGIN, pluginId)
    } else {
      localStorage.removeItem(CACHE_KEY_ACTIVE_PLUGIN)
    }
  } catch (e) {
    console.warn('[Cache] 保存选择插件失败:', e)
  }
}

// 读取上次选择的插件 ID
const loadActivePluginId = (): string | null => {
  try {
    return localStorage.getItem(CACHE_KEY_ACTIVE_PLUGIN)
  } catch {
    return null
  }
}

// 生成订阅源 ID
const generateSubscriptionId = (url: string): string => {
  return `sub_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`
}

// 生成插件 ID
const generatePluginId = (subscriptionId: string, descriptor: PluginDescriptor): string => {
  return `${subscriptionId}_${descriptor.name.replace(/\s+/g, '_').toLowerCase()}`
}

export interface PluginStoreState {
  // 订阅源
  subscriptions: Subscription[]
  
  // 所有插件
  plugins: LoadedPlugin[]
  pluginsLoading: boolean
  
  // 当前选中插件
  activePluginId: string | null
  
  // 搜索状态
  searchQuery: string
  searchType: SearchType
  searchResults: PluginTrack[]
  artistResults: PluginArtist[]
  albumResults: PluginAlbum[]
  playlistResults: PluginPlaylist[]
  searching: boolean
  searchError: string | null
  searchPage: number
  searchHasMore: boolean
  loadingMore: boolean
  
  // 详情页状态
  detailType: 'artist' | 'album' | 'playlist' | null
  detailData: PluginArtist | PluginAlbum | PluginPlaylist | null
  detailTracks: PluginTrack[]
  detailLoading: boolean
  detailPage: number
  detailHasMore: boolean
  
  // 订阅源管理
  addSubscription: (url: string, name?: string) => Promise<void>
  removeSubscription: (subscriptionId: string) => void
  refreshSubscription: (subscriptionId: string) => Promise<void>
  refreshAllSubscriptions: () => Promise<void>
  
  // 插件管理
  loadAllPlugins: () => Promise<void>
  reloadPlugin: (pluginId: string) => Promise<void>
  setActivePlugin: (pluginId: string | null) => void
  
  // 搜索
  setSearchQuery: (query: string) => void
  setSearchType: (type: SearchType) => void
  search: (query: string, type?: SearchType) => Promise<void>
  loadMore: () => Promise<void>
  clearSearch: () => void
  
  // 详情
  loadArtistDetail: (artist: PluginArtist) => Promise<void>
  loadAlbumDetail: (album: PluginAlbum) => Promise<void>
  loadPlaylistDetail: (playlist: PluginPlaylist) => Promise<void>
  loadMoreDetailTracks: () => Promise<void>
  clearDetail: () => void
  
  // 获取激活的插件实例
  getActivePluginInstance: () => MusicPlugin | null
  getReadyPlugins: () => LoadedPlugin[]
  
  // 初始化
  init: () => Promise<void>
}

export const usePluginStore = create<PluginStoreState>((set, get) => ({
  subscriptions: [],
  plugins: [],
  pluginsLoading: false,
  activePluginId: null,
  searchQuery: '',
  searchType: 'music',
  searchResults: [],
  artistResults: [],
  albumResults: [],
  playlistResults: [],
  searching: false,
  searchError: null,
  searchPage: 1,
  searchHasMore: false,
  loadingMore: false,
  detailType: null,
  detailData: null,
  detailTracks: [],
  detailLoading: false,
  detailPage: 1,
  detailHasMore: false,
  
  // 添加订阅源
  addSubscription: async (url: string, name?: string) => {
    const { subscriptions, loadAllPlugins } = get()
    
    // 检查是否已存在
    if (subscriptions.some(s => s.url === url)) {
      console.log('[Subscription] 订阅源已存在:', url)
      return
    }
    
    const subscription: Subscription = {
      id: generateSubscriptionId(url),
      url,
      name: name || `订阅源 ${subscriptions.length + 1}`,
      addedAt: Date.now(),
      lastUpdated: 0,
    }
    
    // 先添加到列表
    const newSubscriptions = [...subscriptions, subscription]
    set({ subscriptions: newSubscriptions })
    saveSubscriptions(newSubscriptions)
    
    // 获取订阅源内容
    try {
      console.log('[Subscription] 加载新订阅源:', url)
      const feed = await fetchPluginFeed(url)
      
      if (feed?.plugins?.length) {
        // 更新订阅源名称（如果 feed 有描述）
        const updatedSubscription = {
          ...subscription,
          name: feed.desc || name || subscription.name,
          lastUpdated: Date.now(),
        }
        const updatedSubscriptions = newSubscriptions.map(s => 
          s.id === subscription.id ? updatedSubscription : s
        )
        set({ subscriptions: updatedSubscriptions })
        saveSubscriptions(updatedSubscriptions)
        
        // 缓存插件列表
        const caches = loadPluginsCache()
        const newCache: PluginCache = {
          subscriptionId: subscription.id,
          plugins: feed.plugins,
          timestamp: Date.now(),
        }
        const updatedCaches = [...caches.filter(c => c.subscriptionId !== subscription.id), newCache]
        savePluginsCache(updatedCaches)
        
        // 重新加载所有插件
        await loadAllPlugins()
      }
    } catch (error) {
      console.error('[Subscription] 加载订阅源失败:', error)
      // 订阅源添加失败，移除
      const rollbackSubscriptions = subscriptions
      set({ subscriptions: rollbackSubscriptions })
      saveSubscriptions(rollbackSubscriptions)
      throw error
    }
  },
  
  // 移除订阅源
  removeSubscription: (subscriptionId: string) => {
    const { subscriptions, plugins, activePluginId } = get()
    
    // 移除订阅源
    const newSubscriptions = subscriptions.filter(s => s.id !== subscriptionId)
    set({ subscriptions: newSubscriptions })
    saveSubscriptions(newSubscriptions)
    
    // 移除该订阅源的插件缓存
    const caches = loadPluginsCache()
    const newCaches = caches.filter(c => c.subscriptionId !== subscriptionId)
    savePluginsCache(newCaches)
    
    // 移除该订阅源的插件
    const newPlugins = plugins.filter(p => !p.meta.id.startsWith(subscriptionId))
    
    // 如果当前选中的插件被移除，选择第一个可用的
    let newActiveId = activePluginId
    if (activePluginId?.startsWith(subscriptionId)) {
      const firstReady = newPlugins.find(p => p.status === 'ready')
      newActiveId = firstReady?.meta.id || null
      saveActivePluginId(newActiveId)
    }
    
    set({ plugins: newPlugins, activePluginId: newActiveId })
  },
  
  // 刷新单个订阅源（强制从网络更新）
  refreshSubscription: async (subscriptionId: string) => {
    const { subscriptions, plugins, activePluginId } = get()
    const subscription = subscriptions.find(s => s.id === subscriptionId)
    if (!subscription) return
    
    try {
      console.log('[Subscription] 刷新订阅源:', subscription.url)
      const feed = await fetchPluginFeed(subscription.url)
      
      if (feed?.plugins?.length) {
        // 更新订阅源时间
        const updatedSubscriptions = subscriptions.map(s => 
          s.id === subscriptionId ? { ...s, lastUpdated: Date.now() } : s
        )
        set({ subscriptions: updatedSubscriptions })
        saveSubscriptions(updatedSubscriptions)
        
        // 更新插件描述符缓存
        const caches = loadPluginsCache()
        const newCache: PluginCache = {
          subscriptionId,
          plugins: feed.plugins,
          timestamp: Date.now(),
        }
        const updatedCaches = [...caches.filter(c => c.subscriptionId !== subscriptionId), newCache]
        savePluginsCache(updatedCaches)
        
        // 只重新加载该订阅源的插件（强制刷新）
        const otherPlugins = plugins.filter(p => !p.meta.id.startsWith(subscriptionId))
        const newPluginDescriptors = feed.plugins.map(descriptor => ({
          meta: {
            id: generatePluginId(subscriptionId, descriptor),
            name: descriptor.name,
            url: descriptor.url,
            version: descriptor.version,
            description: descriptor.description,
            mirrors: descriptor.mirrors,
            enabled: true,
            installedAt: Date.now(),
          },
          status: 'loading' as const,
        }))
        
        set({ plugins: [...otherPlugins, ...newPluginDescriptors], pluginsLoading: true })
        
        // 并行强制加载该订阅源的插件
        const loadPromises = newPluginDescriptors.map(async (plugin) => {
          try {
            const instance = await forceLoadPluginInstance(plugin.meta)
            return {
              ...plugin,
              status: 'ready' as const,
              instance,
              error: undefined,
            }
          } catch (error) {
            console.error(`[Plugin] 强制加载失败 ${plugin.meta.name}:`, error)
            return {
              ...plugin,
              status: 'error' as const,
              error: error instanceof Error ? error.message : String(error),
            }
          }
        })
        
        const loadedPlugins = await Promise.all(loadPromises)
        const finalPlugins = [...otherPlugins, ...loadedPlugins]
        
        // 更新活跃插件
        let newActiveId = activePluginId
        if (activePluginId?.startsWith(subscriptionId)) {
          const stillExists = loadedPlugins.find(p => p.meta.id === activePluginId && p.status === 'ready')
          if (!stillExists) {
            const firstReady = finalPlugins.find(p => p.status === 'ready')
            newActiveId = firstReady?.meta.id || null
            saveActivePluginId(newActiveId)
          }
        }
        
        set({ plugins: finalPlugins, pluginsLoading: false, activePluginId: newActiveId })
      }
    } catch (error) {
      console.error('[Subscription] 刷新订阅源失败:', error)
      throw error
    }
  },
  
  // 刷新所有订阅源
  refreshAllSubscriptions: async () => {
    const { subscriptions, refreshSubscription } = get()
    for (const subscription of subscriptions) {
      try {
        await refreshSubscription(subscription.id)
      } catch {
        // 继续刷新其他订阅源
      }
    }
  },
  
  // 从缓存加载所有插件
  loadAllPlugins: async () => {
    const { subscriptions } = get()
    const caches = loadPluginsCache()
    const savedActiveId = loadActivePluginId()
    
    set({ pluginsLoading: true })
    
    // 收集所有插件描述符
    const allPluginDescriptors: { subscriptionId: string; descriptor: PluginDescriptor }[] = []
    
    for (const subscription of subscriptions) {
      const cache = caches.find(c => c.subscriptionId === subscription.id)
      if (cache?.plugins) {
        for (const descriptor of cache.plugins) {
          allPluginDescriptors.push({ subscriptionId: subscription.id, descriptor })
        }
      }
    }
    
    if (allPluginDescriptors.length === 0) {
      set({ plugins: [], pluginsLoading: false })
      return
    }
    
    // 创建所有插件的初始状态
    const initialPlugins: LoadedPlugin[] = allPluginDescriptors.map(({ subscriptionId, descriptor }) => ({
      meta: {
        id: generatePluginId(subscriptionId, descriptor),
        name: descriptor.name,
        url: descriptor.url,
        version: descriptor.version,
        description: descriptor.description,
        mirrors: descriptor.mirrors,
        enabled: true,
        installedAt: Date.now(),
      },
      status: 'loading',
    }))
    
    set({ plugins: initialPlugins })
    
    // 并行加载所有插件
    const loadPromises = initialPlugins.map(async (plugin) => {
      try {
        const instance = await loadPluginInstance(plugin.meta)
        return {
          ...plugin,
          status: 'ready' as const,
          instance,
          error: undefined,
        }
      } catch (error) {
        console.error(`[Plugin] 加载失败 ${plugin.meta.name}:`, error)
        return {
          ...plugin,
          status: 'error' as const,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })
    
    const loadedPlugins = await Promise.all(loadPromises)
    
    // 确定活跃插件
    let activeId = savedActiveId
    if (activeId) {
      const savedPlugin = loadedPlugins.find(p => p.meta.id === activeId)
      if (!savedPlugin || savedPlugin.status !== 'ready') {
        activeId = null
      }
    }
    if (!activeId) {
      const firstReady = loadedPlugins.find((p) => p.status === 'ready')
      activeId = firstReady?.meta.id || null
    }
    
    saveActivePluginId(activeId)
    
    set({ 
      plugins: loadedPlugins, 
      pluginsLoading: false,
      activePluginId: activeId,
    })
  },
  
  // 重新加载单个插件
  reloadPlugin: async (pluginId: string) => {
    const { plugins } = get()
    const plugin = plugins.find((p) => p.meta.id === pluginId)
    if (!plugin) return
    
    set({
      plugins: plugins.map((p) =>
        p.meta.id === pluginId ? { ...p, status: 'loading', error: undefined } : p
      ),
    })
    
    try {
      const instance = await loadPluginInstance(plugin.meta)
      set({
        plugins: get().plugins.map((p) =>
          p.meta.id === pluginId 
            ? { ...p, status: 'ready', instance, error: undefined } 
            : p
        ),
      })
    } catch (error) {
      set({
        plugins: get().plugins.map((p) =>
          p.meta.id === pluginId 
            ? { 
                ...p, 
                status: 'error', 
                error: error instanceof Error ? error.message : String(error) 
              } 
            : p
        ),
      })
    }
  },
  
  setActivePlugin: (pluginId) => {
    set({ activePluginId: pluginId })
    saveActivePluginId(pluginId)
  },
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchType: (type) => set({ searchType: type }),
  
  search: async (query, type) => {
    const { activePluginId, plugins, searchType } = get()
    const currentType = type || searchType
    
    if (!activePluginId || !query.trim()) {
      set({ 
        searchResults: [], 
        artistResults: [],
        albumResults: [],
        playlistResults: [],
        searchError: null, 
        searchPage: 1, 
        searchHasMore: false 
      })
      return
    }
    
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance) {
      set({ searchError: '插件未加载' })
      return
    }
    
    set({ searching: true, searchError: null, searchPage: 1, searchType: currentType })
    
    try {
      if (currentType === 'music') {
        const result = await plugin.instance.searchSongs(query, 1)
        const tracks = Array.isArray(result) ? result : (result?.data || [])
        const isEnd = Array.isArray(result) ? tracks.length < 20 : (result?.isEnd ?? tracks.length < 20)
        set({ 
          searchResults: tracks, 
          searching: false,
          searchPage: 1,
          searchHasMore: !isEnd,
        })
      } else if (currentType === 'artist' && plugin.instance.searchArtists) {
        const result = await plugin.instance.searchArtists(query, 1)
        set({ 
          artistResults: result.data || [], 
          searching: false,
          searchPage: 1,
          searchHasMore: !result.isEnd,
        })
      } else if (currentType === 'album' && plugin.instance.searchAlbums) {
        const result = await plugin.instance.searchAlbums(query, 1)
        set({ 
          albumResults: result.data || [], 
          searching: false,
          searchPage: 1,
          searchHasMore: !result.isEnd,
        })
      } else if (currentType === 'sheet' && plugin.instance.searchPlaylists) {
        const result = await plugin.instance.searchPlaylists(query, 1)
        set({ 
          playlistResults: result.data || [], 
          searching: false,
          searchPage: 1,
          searchHasMore: !result.isEnd,
        })
      } else {
        set({ searching: false, searchError: '该插件不支持此搜索类型' })
      }
    } catch (error) {
      console.error('[Search] 搜索出错:', error)
      set({ 
        searchError: error instanceof Error ? error.message : String(error),
        searching: false,
        searchHasMore: false,
      })
    }
  },
  
  loadMore: async () => {
    const { activePluginId, plugins, searchQuery, searchPage, searchType, loadingMore, searchHasMore } = get()
    
    if (!activePluginId || !searchQuery.trim() || loadingMore || !searchHasMore) {
      return
    }
    
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance) return
    
    const nextPage = searchPage + 1
    set({ loadingMore: true })
    
    try {
      if (searchType === 'music') {
        const result = await plugin.instance.searchSongs(searchQuery, nextPage)
        const tracks = Array.isArray(result) ? result : (result?.data || [])
        const isEnd = Array.isArray(result) ? tracks.length < 20 : (result?.isEnd ?? tracks.length < 20)
        set((state) => ({ 
          searchResults: [...state.searchResults, ...tracks], 
          loadingMore: false,
          searchPage: nextPage,
          searchHasMore: !isEnd && tracks.length > 0,
        }))
      } else if (searchType === 'artist' && plugin.instance.searchArtists) {
        const result = await plugin.instance.searchArtists(searchQuery, nextPage)
        set((state) => ({ 
          artistResults: [...state.artistResults, ...(result.data || [])], 
          loadingMore: false,
          searchPage: nextPage,
          searchHasMore: !result.isEnd,
        }))
      } else if (searchType === 'album' && plugin.instance.searchAlbums) {
        const result = await plugin.instance.searchAlbums(searchQuery, nextPage)
        set((state) => ({ 
          albumResults: [...state.albumResults, ...(result.data || [])], 
          loadingMore: false,
          searchPage: nextPage,
          searchHasMore: !result.isEnd,
        }))
      } else if (searchType === 'sheet' && plugin.instance.searchPlaylists) {
        const result = await plugin.instance.searchPlaylists(searchQuery, nextPage)
        set((state) => ({ 
          playlistResults: [...state.playlistResults, ...(result.data || [])], 
          loadingMore: false,
          searchPage: nextPage,
          searchHasMore: !result.isEnd,
        }))
      }
    } catch (error) {
      console.error('[Search] 加载更多出错:', error)
      set({ loadingMore: false })
    }
  },
  
  clearSearch: () => set({ 
    searchQuery: '', 
    searchResults: [],
    artistResults: [],
    albumResults: [],
    playlistResults: [],
    searchError: null,
    searchPage: 1,
    searchHasMore: false,
  }),
  
  loadArtistDetail: async (artist) => {
    const { activePluginId, plugins } = get()
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    
    if (!plugin?.instance?.getArtistSongs) {
      set({ detailType: 'artist', detailData: artist, detailTracks: [], detailHasMore: false })
      return
    }
    
    set({ detailType: 'artist', detailData: artist, detailLoading: true, detailTracks: [], detailPage: 1 })
    
    try {
      const result = await plugin.instance.getArtistSongs(artist, 1)
      set({ 
        detailTracks: result.data || [], 
        detailLoading: false,
        detailHasMore: !result.isEnd,
      })
    } catch (error) {
      console.error('[Detail] 加载歌手歌曲失败:', error)
      set({ detailLoading: false })
    }
  },
  
  loadAlbumDetail: async (album) => {
    const { activePluginId, plugins } = get()
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    
    if (!plugin?.instance?.getAlbumSongs) {
      set({ detailType: 'album', detailData: album, detailTracks: [], detailHasMore: false })
      return
    }
    
    set({ detailType: 'album', detailData: album, detailLoading: true, detailTracks: [] })
    
    try {
      const tracks = await plugin.instance.getAlbumSongs(album)
      set({ 
        detailTracks: tracks || [], 
        detailLoading: false,
        detailHasMore: false,
      })
    } catch (error) {
      console.error('[Detail] 加载专辑歌曲失败:', error)
      set({ detailLoading: false })
    }
  },
  
  loadPlaylistDetail: async (playlist) => {
    const { activePluginId, plugins } = get()
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    
    if (!plugin?.instance?.getPlaylistSongs) {
      set({ detailType: 'playlist', detailData: playlist, detailTracks: [], detailHasMore: false })
      return
    }
    
    set({ detailType: 'playlist', detailData: playlist, detailLoading: true, detailTracks: [] })
    
    try {
      const tracks = await plugin.instance.getPlaylistSongs(playlist)
      set({ 
        detailTracks: tracks || [], 
        detailLoading: false,
        detailHasMore: false,
      })
    } catch (error) {
      console.error('[Detail] 加载歌单歌曲失败:', error)
      set({ detailLoading: false })
    }
  },
  
  loadMoreDetailTracks: async () => {
    const { activePluginId, plugins, detailType, detailData, detailPage, detailHasMore } = get()
    
    if (detailType !== 'artist' || !detailHasMore) return
    
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance?.getArtistSongs) return
    
    const nextPage = detailPage + 1
    set({ detailLoading: true })
    
    try {
      const result = await plugin.instance.getArtistSongs(detailData as PluginArtist, nextPage)
      set((state) => ({ 
        detailTracks: [...state.detailTracks, ...(result.data || [])], 
        detailLoading: false,
        detailPage: nextPage,
        detailHasMore: !result.isEnd,
      }))
    } catch (error) {
      console.error('[Detail] 加载更多歌曲失败:', error)
      set({ detailLoading: false })
    }
  },
  
  clearDetail: () => set({
    detailType: null,
    detailData: null,
    detailTracks: [],
    detailLoading: false,
    detailPage: 1,
    detailHasMore: false,
  }),
  
  getActivePluginInstance: () => {
    const { activePluginId, plugins } = get()
    if (!activePluginId) return null
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    return plugin?.instance ?? null
  },
  
  getReadyPlugins: () => {
    const { plugins } = get()
    return plugins.filter((p) => p.status === 'ready')
  },
  
  init: async () => {
    console.log('[Init] 初始化插件系统...')
    
    // 1. 加载保存的订阅源
    const savedSubscriptions = loadSubscriptions()
    console.log('[Init] 已保存的订阅源:', savedSubscriptions.length, '个')
    
    // 如果没有订阅源，添加默认订阅源
    if (savedSubscriptions.length === 0) {
      console.log('[Init] 添加默认订阅源')
      set({ subscriptions: [] })
      try {
        await get().addSubscription(DEFAULT_PLUGIN_FEED, '默认订阅源')
      } catch (error) {
        console.error('[Init] 添加默认订阅源失败:', error)
      }
    } else {
      // 使用保存的订阅源
      set({ subscriptions: savedSubscriptions })
      // 从缓存加载插件
      await get().loadAllPlugins()
    }
  },
}))
