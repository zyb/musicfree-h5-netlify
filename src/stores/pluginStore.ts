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
  PluginTopListGroup,
  PluginRecommendTag,
} from '../types/plugin'
import {
  fetchPluginFeed,
  loadPluginInstance,
  forceLoadPluginInstance,
} from '../lib/pluginHost'

const decodeHtmlEntities = (value: string): string => {
  if (!value) return ''
  const namedMap: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }
  return value
    .replace(/&(#x?[0-9a-fA-F]+);/g, (match, entity: string) => {
      if (entity.startsWith('#x') || entity.startsWith('#X')) {
        const code = parseInt(entity.slice(2), 16)
        return Number.isNaN(code) ? match : String.fromCharCode(code)
      }
      if (entity.startsWith('#')) {
        const code = parseInt(entity.slice(1), 10)
        return Number.isNaN(code) ? match : String.fromCharCode(code)
      }
      return namedMap[entity] ?? match
    })
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => namedMap[name] ?? match)
}

const pickDefaultRecommendTagId = (tags: PluginRecommendTag[]): string | null => {
  const preferred =
    tags.find((tag) => tag.title === '全部' || tag.id === '全部') ||
    tags.find((tag) => String(tag.id).toLowerCase() === 'all')
  return preferred?.id ?? tags[0]?.id ?? null
}

// 缓存相关常量
const CACHE_KEY_SUBSCRIPTIONS = 'musicfree.subscriptions'
const CACHE_KEY_PLUGINS = 'musicfree.plugins.cache'
const CACHE_KEY_ACTIVE_PLUGIN = 'musicfree.active.plugin'
const CACHE_KEY_TOP_LISTS = 'musicfree.toplists.cache'
const CACHE_KEY_RECOMMEND_TAGS = 'musicfree.recommend.tags.cache'
const CACHE_KEY_RECOMMEND_SHEETS = 'musicfree.recommend.sheets.cache'
const CACHE_KEY_PLAYLIST_DETAIL = 'musicfree.playlist.detail.cache'
const CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000 // 24小时

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

// 缓存数据结构
interface CacheData<T> {
  data: T
  pluginId: string
  timestamp: number
}

// 保存排行榜缓存
const saveTopListsCache = (pluginId: string, data: PluginTopListGroup[]) => {
  try {
    const cache: CacheData<PluginTopListGroup[]> = {
      data,
      pluginId,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${CACHE_KEY_TOP_LISTS}.${pluginId}`, JSON.stringify(cache))
  } catch (e) {
    console.warn('[Cache] 保存排行榜缓存失败:', e)
  }
}

// 读取排行榜缓存
const loadTopListsCache = (pluginId: string): PluginTopListGroup[] | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_TOP_LISTS}.${pluginId}`)
    if (!raw) {
      console.log(`[Cache] 排行榜缓存不存在 (pluginId: ${pluginId})`)
      return null
    }
    const cache: CacheData<PluginTopListGroup[]> = JSON.parse(raw)
    // 检查缓存是否过期
    if (Date.now() - cache.timestamp > CACHE_EXPIRY_TIME) {
      console.log(`[Cache] 排行榜缓存已过期 (pluginId: ${pluginId}, timestamp: ${cache.timestamp}, expiry: ${CACHE_EXPIRY_TIME})`)
      return null
    }
    // 检查是否是当前插件的缓存
    if (cache.pluginId !== pluginId) {
      console.log(`[Cache] 排行榜缓存插件ID不匹配 (期望: ${pluginId}, 实际: ${cache.pluginId})`)
      return null
    }
    console.log(`[Cache] 成功读取排行榜缓存 (pluginId: ${pluginId}, 数量: ${cache.data?.length || 0})`)
    return cache.data
  } catch (e) {
    console.warn(`[Cache] 读取排行榜缓存失败 (pluginId: ${pluginId}):`, e)
    return null
  }
}

// 保存推荐标签缓存
const saveRecommendTagsCache = (pluginId: string, data: PluginRecommendTag[]) => {
  try {
    const cache: CacheData<PluginRecommendTag[]> = {
      data,
      pluginId,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${CACHE_KEY_RECOMMEND_TAGS}.${pluginId}`, JSON.stringify(cache))
  } catch (e) {
    console.warn('[Cache] 保存推荐标签缓存失败:', e)
  }
}

// 读取推荐标签缓存
const loadRecommendTagsCache = (pluginId: string): PluginRecommendTag[] | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_RECOMMEND_TAGS}.${pluginId}`)
    if (!raw) {
      console.log(`[Cache] 推荐标签缓存不存在 (pluginId: ${pluginId})`)
      return null
    }
    const cache: CacheData<PluginRecommendTag[]> = JSON.parse(raw)
    // 检查缓存是否过期
    if (Date.now() - cache.timestamp > CACHE_EXPIRY_TIME) {
      console.log(`[Cache] 推荐标签缓存已过期 (pluginId: ${pluginId}, timestamp: ${cache.timestamp}, expiry: ${CACHE_EXPIRY_TIME})`)
      return null
    }
    // 检查是否是当前插件的缓存
    if (cache.pluginId !== pluginId) {
      console.log(`[Cache] 推荐标签缓存插件ID不匹配 (期望: ${pluginId}, 实际: ${cache.pluginId})`)
      return null
    }
    console.log(`[Cache] 成功读取推荐标签缓存 (pluginId: ${pluginId}, 数量: ${cache.data?.length || 0})`)
    return cache.data
  } catch (e) {
    console.warn(`[Cache] 读取推荐标签缓存失败 (pluginId: ${pluginId}):`, e)
    return null
  }
}

// 保存推荐歌单缓存
const saveRecommendSheetsCache = (pluginId: string, tagId: string, data: PluginPlaylist[]) => {
  try {
    const cache: CacheData<PluginPlaylist[]> = {
      data,
      pluginId,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${CACHE_KEY_RECOMMEND_SHEETS}.${pluginId}.${tagId}`, JSON.stringify(cache))
  } catch (e) {
    console.warn('[Cache] 保存推荐歌单缓存失败:', e)
  }
}

// 读取推荐歌单缓存
const loadRecommendSheetsCache = (pluginId: string, tagId: string): PluginPlaylist[] | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_RECOMMEND_SHEETS}.${pluginId}.${tagId}`)
    if (!raw) {
      console.log(`[Cache] 推荐歌单缓存不存在 (pluginId: ${pluginId}, tagId: ${tagId})`)
      return null
    }
    const cache: CacheData<PluginPlaylist[]> = JSON.parse(raw)
    // 检查缓存是否过期
    if (Date.now() - cache.timestamp > CACHE_EXPIRY_TIME) {
      console.log(`[Cache] 推荐歌单缓存已过期 (pluginId: ${pluginId}, tagId: ${tagId}, timestamp: ${cache.timestamp}, expiry: ${CACHE_EXPIRY_TIME})`)
      return null
    }
    // 检查是否是当前插件的缓存
    if (cache.pluginId !== pluginId) {
      console.log(`[Cache] 推荐歌单缓存插件ID不匹配 (期望: ${pluginId}, 实际: ${cache.pluginId}, tagId: ${tagId})`)
      return null
    }
    console.log(`[Cache] 成功读取推荐歌单缓存 (pluginId: ${pluginId}, tagId: ${tagId}, 数量: ${cache.data?.length || 0})`)
    return cache.data
  } catch (e) {
    console.warn(`[Cache] 读取推荐歌单缓存失败 (pluginId: ${pluginId}, tagId: ${tagId}):`, e)
    return null
  }
}

// 保存歌单详情缓存
const savePlaylistDetailCache = (pluginId: string, playlistId: string, tracks: PluginTrack[]) => {
  try {
    const cache: CacheData<PluginTrack[]> = {
      data: tracks,
      pluginId,
      timestamp: Date.now(),
    }
    localStorage.setItem(`${CACHE_KEY_PLAYLIST_DETAIL}.${pluginId}.${playlistId}`, JSON.stringify(cache))
    console.log(`[Cache] 保存歌单详情缓存 (pluginId: ${pluginId}, playlistId: ${playlistId}, 数量: ${tracks.length})`)
  } catch (e) {
    console.warn('[Cache] 保存歌单详情缓存失败:', e)
  }
}

// 读取歌单详情缓存
const loadPlaylistDetailCache = (pluginId: string, playlistId: string): PluginTrack[] | null => {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PLAYLIST_DETAIL}.${pluginId}.${playlistId}`)
    if (!raw) {
      console.log(`[Cache] 歌单详情缓存不存在 (pluginId: ${pluginId}, playlistId: ${playlistId})`)
      return null
    }
    const cache: CacheData<PluginTrack[]> = JSON.parse(raw)
    // 检查缓存是否过期
    if (Date.now() - cache.timestamp > CACHE_EXPIRY_TIME) {
      console.log(`[Cache] 歌单详情缓存已过期 (pluginId: ${pluginId}, playlistId: ${playlistId}, timestamp: ${cache.timestamp}, expiry: ${CACHE_EXPIRY_TIME})`)
      return null
    }
    // 检查是否是当前插件的缓存
    if (cache.pluginId !== pluginId) {
      console.log(`[Cache] 歌单详情缓存插件ID不匹配 (期望: ${pluginId}, 实际: ${cache.pluginId}, playlistId: ${playlistId})`)
      return null
    }
    console.log(`[Cache] 成功读取歌单详情缓存 (pluginId: ${pluginId}, playlistId: ${playlistId}, 数量: ${cache.data?.length || 0})`)
    return cache.data
  } catch (e) {
    console.warn(`[Cache] 读取歌单详情缓存失败 (pluginId: ${pluginId}, playlistId: ${playlistId}):`, e)
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
  
  // 排行&推荐
  topListGroups: PluginTopListGroup[]
  topListLoading: boolean
  topListLoadedPluginId: string | null
  recommendTags: PluginRecommendTag[]
  recommendSelectedTagId: string | null
  recommendSheets: PluginPlaylist[]
  recommendLoading: boolean
  recommendHasMore: boolean
  recommendPage: number
  recommendLoadedPluginId: string | null
  
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
  importDefaultFeeds: () => Promise<void>
  clearAllSubscriptions: () => void
  
  // 插件管理
  loadAllPlugins: () => Promise<void>
  reloadPlugin: (pluginId: string) => Promise<void>
  setActivePlugin: (pluginId: string | null, force?: boolean) => void
  
  // 搜索
  setSearchQuery: (query: string) => void
  setSearchType: (type: SearchType) => void
  search: (query: string, type?: SearchType) => Promise<void>
  loadMore: () => Promise<void>
  clearSearch: () => void
  loadTopLists: (force?: boolean) => Promise<void>
  loadRecommendTags: (force?: boolean) => Promise<void>
  setRecommendTag: (tagId: string) => void
  loadRecommendSheets: (tagId?: string, reset?: boolean) => Promise<void>
  refreshAllData: () => Promise<void>
  
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
  topListGroups: [],
  topListLoading: false,
  topListLoadedPluginId: null,
  recommendTags: [],
  recommendSelectedTagId: null,
  recommendSheets: [],
  recommendLoading: false,
  recommendHasMore: false,
  recommendPage: 0,
  recommendLoadedPluginId: null,
  detailType: null,
  detailData: null,
  detailTracks: [],
  detailLoading: false,
  detailPage: 1,
  detailHasMore: false,
  
  // 添加订阅源
  addSubscription: async (url: string, name?: string) => {
    // 检查是否已存在（使用最新的 state）
    if (get().subscriptions.some(s => s.url === url)) {
      console.log('[Subscription] 订阅源已存在:', url)
      return
    }
    
    const subscriptionId = generateSubscriptionId(url)
    const subscription: Subscription = {
      id: subscriptionId,
      url,
      name: name || `订阅源 ${get().subscriptions.length + 1}`,
      addedAt: Date.now(),
      lastUpdated: 0,
    }
    
    // 先添加到列表（使用最新的 state）
    const currentSubscriptions = get().subscriptions
    const newSubscriptions = [...currentSubscriptions, subscription]
    set({ subscriptions: newSubscriptions })
    saveSubscriptions(newSubscriptions)
    
    // 获取订阅源内容
    try {
      console.log('[Subscription] 加载新订阅源:', url)
      const feed = await fetchPluginFeed(url)
      
      if (feed?.plugins?.length) {
        // 更新订阅源名称（如果 feed 有描述）
        // 重要：重新从 state 获取最新的 subscriptions，避免覆盖其他并发操作的结果
        const latestSubscriptions = get().subscriptions
        const updatedSubscription = {
          ...subscription,
          name: feed.desc || name || subscription.name,
          lastUpdated: Date.now(),
        }
        const updatedSubscriptions = latestSubscriptions.map(s => 
          s.id === subscriptionId ? updatedSubscription : s
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
        await get().loadAllPlugins()
      }
    } catch (error) {
      console.error('[Subscription] 加载订阅源失败:', error)
      // 订阅源添加失败，移除当前添加的订阅源（保留其他订阅源）
      const latestSubscriptions = get().subscriptions
      const rollbackSubscriptions = latestSubscriptions.filter(s => s.id !== subscriptionId)
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
    }
    
    set({ plugins: newPlugins })
    // 刷新订阅源时强制刷新数据
    get().setActivePlugin(newActiveId, true)
  },
  
  // 刷新单个订阅源（强制从网络更新）
  refreshSubscription: async (subscriptionId: string) => {
    const subscription = get().subscriptions.find(s => s.id === subscriptionId)
    if (!subscription) return
    
    try {
      console.log('[Subscription] 刷新订阅源:', subscription.url)
      const feed = await fetchPluginFeed(subscription.url)
      
      if (feed?.plugins?.length) {
        // 更新订阅源时间（重新获取最新 state）
        const latestSubscriptions = get().subscriptions
        const updatedSubscriptions = latestSubscriptions.map(s => 
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
        // 重新获取最新的 plugins 状态
        const currentPlugins = get().plugins
        const otherPlugins = currentPlugins.filter(p => !p.meta.id.startsWith(subscriptionId))
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
        
        // 更新活跃插件（重新获取最新的 activePluginId）
        const currentActivePluginId = get().activePluginId
        let newActiveId = currentActivePluginId
        if (currentActivePluginId?.startsWith(subscriptionId)) {
          const stillExists = loadedPlugins.find(p => p.meta.id === currentActivePluginId && p.status === 'ready')
          if (!stillExists) {
            const firstReady = finalPlugins.find(p => p.status === 'ready')
            newActiveId = firstReady?.meta.id || null
          }
        }
        
        set({ plugins: finalPlugins, pluginsLoading: false })
        // 刷新所有订阅源时强制刷新数据
        get().setActivePlugin(newActiveId, true)
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
  
  // 导入预设配置（将 feeds.default.json 作为一个订阅源添加）
  importDefaultFeeds: async () => {
    // 预设配置的 URL（使用相对路径，指向本地的 feeds.default.json）
    const defaultFeedUrl = `${window.location.origin}/feeds.default.json`
    
    // 检查是否已存在
    if (get().subscriptions.some(s => s.url === defaultFeedUrl || s.url === '/feeds.default.json')) {
      console.log('[Subscription] 预设配置已存在')
      return
    }
    
    try {
      console.log('[Subscription] 开始导入预设配置...')
      await get().addSubscription(defaultFeedUrl, '预设音乐源')
      console.log('[Subscription] 预设配置导入完成')
    } catch (error) {
      console.error('[Subscription] 导入预设配置失败:', error)
      throw error
    }
  },
  
  // 清空所有订阅源
  clearAllSubscriptions: () => {
    console.log('[Subscription] 清空所有订阅源')
    
    // 清空订阅源列表
    set({ subscriptions: [], plugins: [], activePluginId: null })
    saveSubscriptions([])
    
    // 清空插件缓存
    savePluginsCache([])
    
    // 清空活跃插件记录
    saveActivePluginId(null)
    
    // 清空相关缓存
    try {
      localStorage.removeItem('musicfree.toplists.cache')
      localStorage.removeItem('musicfree.recommend.tags.cache')
      localStorage.removeItem('musicfree.recommend.sheets.cache')
      localStorage.removeItem('musicfree.playlist.detail.cache')
    } catch (e) {
      console.warn('[Cache] 清空缓存失败:', e)
    }
    
    console.log('[Subscription] 所有订阅源已清空')
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
    
    set({ 
      plugins: loadedPlugins, 
      pluginsLoading: false,
    })
    // 初始化时从缓存加载数据
    get().setActivePlugin(activeId, false)
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
  
  setActivePlugin: (pluginId, force = false) => {
    set({
      activePluginId: pluginId,
      topListGroups: [],
      topListLoading: false,
      topListLoadedPluginId: null,
      recommendTags: [],
      recommendSelectedTagId: null,
      recommendSheets: [],
      recommendLoading: false,
      recommendHasMore: false,
      recommendPage: 0,
      recommendLoadedPluginId: null,
    })
    saveActivePluginId(pluginId)
    if (pluginId) {
      // force = true 表示用户手动切换插件，需要强制刷新
      // force = false 表示初始化，先从缓存加载
      get().loadTopLists(force)
      get().loadRecommendTags(force)
    }
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

  loadTopLists: async (force = false) => {
    const { activePluginId, plugins, topListLoadedPluginId, topListLoading } = get()
    if (!activePluginId) {
      set({ topListGroups: [], topListLoadedPluginId: null, topListLoading: false })
      return
    }
    if (!force && !topListLoading && topListLoadedPluginId === activePluginId && get().topListGroups.length > 0) {
      return
    }
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance?.getTopLists) {
      set({ topListGroups: [], topListLoading: false, topListLoadedPluginId: activePluginId })
      return
    }
    
    // 如果不是强制刷新，尝试从缓存加载
    if (!force) {
      const cachedData = loadTopListsCache(activePluginId)
      if (cachedData && cachedData.length > 0) {
        console.log('[TopList] 从缓存加载数据，立即显示')
        // 先设置缓存数据，让页面立即显示，不设置 loading 状态
        set({
          topListGroups: cachedData,
          topListLoading: false,
          topListLoadedPluginId: activePluginId,
        })
        // 后台静默更新数据，不设置 loading 状态，避免覆盖已显示的缓存数据
        ;(async () => {
          try {
            if (!plugin?.instance?.getTopLists) return
            const groups = (await plugin.instance.getTopLists()) as PluginTopListGroup[]
            if (groups && groups.length > 0) {
              // 检查数据是否有更新（比较长度和第一个/最后一个的ID）
              const hasChanged = groups.length !== cachedData.length ||
                groups.some((group, index) => {
                  const cachedGroup = cachedData[index]
                  if (!cachedGroup) return true
                  return group.title !== cachedGroup.title ||
                    (group.data?.length || 0) !== (cachedGroup.data?.length || 0) ||
                    (group.data?.[0]?.id || '') !== (cachedGroup.data?.[0]?.id || '')
                })
              
              if (hasChanged) {
                console.log('[TopList] 排行榜数据已更新，刷新显示')
                saveTopListsCache(activePluginId, groups)
                set({
                  topListGroups: groups,
                  topListLoading: false,
                })
              } else {
                // 数据没有变化，保持缓存数据
                console.log('[TopList] 排行榜数据无变化，保持缓存')
                saveTopListsCache(activePluginId, groups) // 更新时间戳
              }
            }
          } catch (error) {
            console.error('[TopList] 后台更新失败:', error)
            // 后台更新失败不影响已显示的缓存数据
          }
        })()
        return
      }
    }
    
    set({ topListLoading: true })
    try {
      const groups = (await plugin.instance.getTopLists()) as PluginTopListGroup[]
      if (groups && groups.length > 0) {
        saveTopListsCache(activePluginId, groups)
      }
      set({
        topListGroups: groups || [],
        topListLoading: false,
        topListLoadedPluginId: activePluginId,
      })
    } catch (error) {
      console.error('[TopList] 加载失败:', error)
      // 如果加载失败，尝试使用缓存
      const cachedData = loadTopListsCache(activePluginId)
      if (cachedData && cachedData.length > 0) {
        console.log('[TopList] 加载失败，使用缓存数据')
        set({
          topListGroups: cachedData,
          topListLoading: false,
          topListLoadedPluginId: activePluginId,
        })
      } else {
        set({
          topListGroups: [],
          topListLoading: false,
          topListLoadedPluginId: activePluginId,
        })
      }
    }
  },

  loadRecommendTags: async (force = false) => {
    const {
      activePluginId,
      plugins,
      recommendLoadedPluginId,
      recommendTags,
    } = get()
    if (!activePluginId) {
      set({
        recommendTags: [],
        recommendSelectedTagId: null,
        recommendSheets: [],
        recommendHasMore: false,
        recommendPage: 0,
        recommendLoadedPluginId: null,
        recommendLoading: false,
      })
      return
    }
    if (!force && recommendLoadedPluginId === activePluginId && recommendTags.length > 0) {
      return
    }
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance?.getRecommendSheetTags) {
      set({
        recommendTags: [],
        recommendSelectedTagId: null,
        recommendSheets: [],
        recommendHasMore: false,
        recommendPage: 0,
        recommendLoadedPluginId: activePluginId,
        recommendLoading: false,
      })
      return
    }
    
    // 如果不是强制刷新，尝试从缓存加载
    if (!force) {
      const cachedTags = loadRecommendTagsCache(activePluginId)
      if (cachedTags && cachedTags.length > 0) {
        console.log('[Recommend] 从缓存加载标签数据')
        const defaultId = pickDefaultRecommendTagId(cachedTags)
        const effectiveId = defaultId ?? ''
        const currentTagId = get().recommendSelectedTagId
        const currentSheets = get().recommendSheets
        
        set({
          recommendTags: cachedTags,
          recommendSelectedTagId: effectiveId,
          recommendLoadedPluginId: activePluginId,
          recommendLoading: false,
        })
        
        // 如果当前没有歌单数据或标签ID变化了，才加载歌单
        if (currentSheets.length === 0 || effectiveId !== currentTagId) {
          await get().loadRecommendSheets(effectiveId, true)
        }
        
        // 后台静默更新标签数据，不设置 loading 状态，避免影响已显示的缓存数据
        ;(async () => {
          try {
            if (!plugin?.instance?.getRecommendSheetTags) return
            const rawTags = await plugin.instance.getRecommendSheetTags()
          let collected: PluginRecommendTag[] = []
          if (Array.isArray(rawTags)) {
            collected = rawTags
          } else if (rawTags && typeof rawTags === 'object') {
            const pinned = (rawTags as any).pinned
            if (Array.isArray(pinned)) {
              collected = collected.concat(pinned)
            }
            const groups = (rawTags as any).data
            if (Array.isArray(groups)) {
              for (const group of groups) {
                if (group && Array.isArray(group.data)) {
                  collected = collected.concat(group.data)
                }
              }
            }
          }
          const normalized = collected.map((tag) => {
            const source = typeof tag === 'object' && tag !== null ? tag : { id: tag, title: tag }
            const hasId = (source as any).id !== undefined && (source as any).id !== null
            const canonicalId = hasId
              ? String((source as any).id)
              : typeof tag === 'string'
                ? tag
                : String((source as any).title ?? '')
            const rawTitle = (source as any).title ?? canonicalId
            const canonicalTitle = decodeHtmlEntities(String(rawTitle))
            return {
              ...(source as Record<string, unknown>),
              id: canonicalId,
              title: canonicalTitle,
              raw: tag,
            } as PluginRecommendTag
          })
          const deduped: PluginRecommendTag[] = []
          const seen = new Set<string>()
          for (const tag of normalized) {
            if (!tag.id && tag.title === '全部') {
              // 允许空 ID 的"全部"标签通过
            } else {
              if (!tag.id) continue
              if (seen.has(tag.id)) continue
              seen.add(tag.id)
            }
            deduped.push(tag)
          }
          const allIndex = deduped.findIndex(
            (tag) => tag.title === '全部' || tag.id === '全部' || tag.id === ''
          )
          if (allIndex === -1) {
            deduped.unshift({
              id: '',
              title: '全部',
              raw: '',
            })
          } else if (allIndex > 0) {
            const [allTag] = deduped.splice(allIndex, 1)
            deduped.unshift(allTag)
          }
          // 检查数据是否有更新（比较长度和每个标签的ID）
          const hasChanged = deduped.length !== cachedTags.length ||
            deduped.some((tag, index) => tag.id !== cachedTags[index]?.id)
          
          if (hasChanged && deduped.length > 0) {
            console.log('[Recommend] 推荐标签数据已更新，刷新显示')
            saveRecommendTagsCache(activePluginId, deduped)
            const defaultId = pickDefaultRecommendTagId(deduped)
            const effectiveId = defaultId ?? ''
            const currentTagId = get().recommendSelectedTagId
            
            // 只有在标签真正变化时才重置列表
            if (effectiveId !== currentTagId) {
              set({
                recommendTags: deduped,
                recommendSelectedTagId: effectiveId,
                recommendLoadedPluginId: activePluginId,
                recommendLoading: false,
              })
              await get().loadRecommendSheets(effectiveId, true)
            } else {
              // 标签没变化，只更新标签列表，不重置歌单列表
              set({
                recommendTags: deduped,
                recommendLoadedPluginId: activePluginId,
                recommendLoading: false,
              })
            }
          } else {
            // 数据没有变化，保持缓存数据
            console.log('[Recommend] 推荐标签数据无变化，保持缓存')
            if (deduped.length > 0) {
              saveRecommendTagsCache(activePluginId, deduped) // 更新时间戳
            }
          }
        } catch (error) {
            console.error('[Recommend] 后台更新标签失败:', error)
            // 后台更新失败不影响已显示的缓存数据
          }
        })()
        return
      }
    }
    
    set({ recommendLoading: true })
    try {
      const rawTags = await plugin.instance.getRecommendSheetTags()
      let collected: PluginRecommendTag[] = []
      if (Array.isArray(rawTags)) {
        collected = rawTags
      } else if (rawTags && typeof rawTags === 'object') {
        const pinned = (rawTags as any).pinned
        if (Array.isArray(pinned)) {
          collected = collected.concat(pinned)
        }
        const groups = (rawTags as any).data
        if (Array.isArray(groups)) {
          for (const group of groups) {
            if (group && Array.isArray(group.data)) {
              collected = collected.concat(group.data)
            }
          }
        }
      }
      const normalized = collected.map((tag) => {
        const source = typeof tag === 'object' && tag !== null ? tag : { id: tag, title: tag }
        const hasId = (source as any).id !== undefined && (source as any).id !== null
        const canonicalId = hasId
          ? String((source as any).id)
          : typeof tag === 'string'
            ? tag
            : String((source as any).title ?? '')
        const rawTitle = (source as any).title ?? canonicalId
        const canonicalTitle = decodeHtmlEntities(String(rawTitle))
        return {
          ...(source as Record<string, unknown>),
          id: canonicalId,
          title: canonicalTitle,
          raw: tag,
        } as PluginRecommendTag
      })
      const deduped: PluginRecommendTag[] = []
      const seen = new Set<string>()
      for (const tag of normalized) {
        if (!tag.id && tag.title === '全部') {
          // 允许空 ID 的"全部"标签通过
        } else {
          if (!tag.id) continue
          if (seen.has(tag.id)) continue
          seen.add(tag.id)
        }
        deduped.push(tag)
      }
      const allIndex = deduped.findIndex(
        (tag) => tag.title === '全部' || tag.id === '全部' || tag.id === ''
      )
      if (allIndex === -1) {
        deduped.unshift({
          id: '',
          title: '全部',
          raw: '',
        })
      } else if (allIndex > 0) {
        const [allTag] = deduped.splice(allIndex, 1)
        deduped.unshift(allTag)
      }
      if (deduped.length > 0) {
        saveRecommendTagsCache(activePluginId, deduped)
      }
      const currentTagId = get().recommendSelectedTagId
      set({
        recommendTags: deduped,
        recommendLoadedPluginId: activePluginId,
      })
      if (deduped.length > 0) {
        const defaultId = pickDefaultRecommendTagId(deduped)
        const effectiveId = defaultId ?? ''
        
        // 只有在标签ID变化时才重置列表
        if (effectiveId !== currentTagId) {
          set({
            recommendSelectedTagId: effectiveId,
            recommendSheets: [],
            recommendPage: 0,
            recommendHasMore: true,
          })
          await get().loadRecommendSheets(effectiveId, true)
        } else {
          // 标签ID没变化，保持现有列表不变
          set({
            recommendSelectedTagId: effectiveId,
            recommendLoading: false,
          })
        }
      } else {
        set({
          recommendSelectedTagId: null,
          recommendSheets: [],
          recommendHasMore: false,
          recommendPage: 0,
          recommendLoading: false,
        })
      }
    } catch (error) {
      console.error('[Recommend] 加载推荐标签失败:', error)
      // 如果加载失败，尝试使用缓存
      const cachedTags = loadRecommendTagsCache(activePluginId)
      if (cachedTags && cachedTags.length > 0) {
        console.log('[Recommend] 加载失败，使用缓存标签数据')
        const defaultId = pickDefaultRecommendTagId(cachedTags)
        const effectiveId = defaultId ?? ''
        set({
          recommendTags: cachedTags,
          recommendSelectedTagId: effectiveId,
          recommendLoadedPluginId: activePluginId,
          recommendLoading: false,
        })
        await get().loadRecommendSheets(effectiveId, true)
      } else {
        set({
          recommendTags: [],
          recommendSelectedTagId: null,
          recommendSheets: [],
          recommendHasMore: false,
          recommendPage: 0,
          recommendLoadedPluginId: activePluginId,
          recommendLoading: false,
        })
      }
    }
  },

  setRecommendTag: (tagId: string) => {
    const current = get().recommendSelectedTagId
    if (tagId === undefined || tagId === null || tagId === current) return
    set({
      recommendSelectedTagId: tagId,
      recommendSheets: [],
      recommendPage: 0,
      recommendHasMore: true,
    })
    get().loadRecommendSheets(tagId, true)
  },

  loadRecommendSheets: async (tagId?: string, reset = false) => {
    const {
      activePluginId,
      plugins,
      recommendSelectedTagId,
      recommendHasMore,
      recommendLoading,
      recommendPage,
      recommendTags,
    } = get()
    const targetTag = tagId !== undefined ? tagId : recommendSelectedTagId
    if (!activePluginId || targetTag === null || targetTag === undefined) return
    if (!reset && (!recommendHasMore || recommendLoading)) return
    const plugin = plugins.find((p) => p.meta.id === activePluginId)
    if (!plugin?.instance?.getRecommendSheetsByTag) {
      set({ recommendLoading: false, recommendHasMore: false })
      return
    }
    const nextPage = reset ? 1 : recommendPage + 1
    
    // 如果是重置且不是强制刷新，尝试从缓存加载
    if (reset && nextPage === 1) {
      const cachedSheets = loadRecommendSheetsCache(activePluginId, targetTag)
      if (cachedSheets && cachedSheets.length > 0) {
        console.log('[Recommend] 从缓存加载歌单数据，立即显示')
        // 先设置缓存数据，让页面立即显示，不设置 loading 状态
        set({
          recommendSheets: cachedSheets,
          recommendPage: 1,
          recommendHasMore: true,
          recommendLoading: false,
        })
        // 后台静默更新数据，不设置 loading 状态，避免覆盖已显示的缓存数据
        ;(async () => {
          try {
            if (!plugin?.instance?.getRecommendSheetsByTag) return
            const tagEntity = recommendTags.find((tag) => tag.id === targetTag)
            const payload = (tagEntity?.raw as PluginRecommendTag | string | undefined) || tagEntity || targetTag
            const result = await plugin.instance.getRecommendSheetsByTag(payload, nextPage)
            const data = result?.data || []
            const isEnd = result?.isEnd ?? data.length < 20
            
            // 检查数据是否有更新（比较长度和每个歌单的ID）
            const hasChanged = data.length !== cachedSheets.length ||
              data.some((sheet, index) => sheet.id !== cachedSheets[index]?.id)
            
            if (hasChanged && data.length > 0) {
              console.log('[Recommend] 推荐歌单数据已更新，刷新显示')
              saveRecommendSheetsCache(activePluginId, targetTag, data)
              set({
                recommendSheets: data,
                recommendLoading: false,
                recommendPage: nextPage,
                recommendHasMore: !isEnd && data.length > 0,
              })
            } else {
              // 数据没有变化，保持缓存数据
              console.log('[Recommend] 推荐歌单数据无变化，保持缓存')
              if (data.length > 0) {
                saveRecommendSheetsCache(activePluginId, targetTag, data) // 更新时间戳
              }
            }
          } catch (error) {
            console.error('[Recommend] 后台更新歌单失败:', error)
            // 后台更新失败不影响已显示的缓存数据
          }
        })()
        return
      }
    }
    
    set({ recommendLoading: true })
    try {
      const tagEntity = recommendTags.find((tag) => tag.id === targetTag)
      const payload = (tagEntity?.raw as PluginRecommendTag | string | undefined) || tagEntity || targetTag
      const result = await plugin.instance.getRecommendSheetsByTag(payload, nextPage)
      const data = result?.data || []
      const isEnd = result?.isEnd ?? data.length < 20
      if (reset && data.length > 0) {
        saveRecommendSheetsCache(activePluginId, targetTag, data)
      }
      set((state) => ({
        recommendSheets: reset ? data : [...state.recommendSheets, ...data],
        recommendLoading: false,
        recommendPage: nextPage,
        recommendHasMore: !isEnd && data.length > 0,
      }))
    } catch (error) {
      console.error('[Recommend] 加载推荐歌单失败:', error)
      // 如果加载失败，尝试使用缓存
      if (reset && nextPage === 1) {
        const cachedSheets = loadRecommendSheetsCache(activePluginId, targetTag)
        if (cachedSheets && cachedSheets.length > 0) {
          console.log('[Recommend] 加载失败，使用缓存歌单数据')
          set({
            recommendSheets: cachedSheets,
            recommendPage: 1,
            recommendHasMore: true,
            recommendLoading: false,
          })
          return
        }
      }
      set({ recommendLoading: false, recommendHasMore: false })
    }
  },
  
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
    
    const playlistId = playlist.id || playlist.title || ''
    
    // 先尝试从缓存加载
    const cachedTracks = loadPlaylistDetailCache(activePluginId || '', playlistId)
    if (cachedTracks && cachedTracks.length > 0) {
      console.log('[Detail] 从缓存加载歌单详情')
      set({ 
        detailType: 'playlist', 
        detailData: playlist, 
        detailTracks: cachedTracks,
        detailLoading: false,
        detailHasMore: false,
      })
      
      // 后台异步更新数据
      set({ detailLoading: true })
      try {
        const tracks = await plugin.instance.getPlaylistSongs(playlist)
        const newTracks = tracks || []
        
        // 检查数据是否有更新（比较长度或内容）
        const hasChanged = newTracks.length !== cachedTracks.length || 
          newTracks.some((track, index) => track.id !== cachedTracks[index]?.id)
        
        if (hasChanged && newTracks.length > 0) {
          console.log('[Detail] 歌单详情数据已更新，刷新显示')
          savePlaylistDetailCache(activePluginId || '', playlistId, newTracks)
          set({ 
            detailTracks: newTracks,
            detailLoading: false,
          })
        } else {
          // 数据没有变化，保持缓存数据
          if (newTracks.length > 0) {
            savePlaylistDetailCache(activePluginId || '', playlistId, newTracks)
          }
          set({ detailLoading: false })
        }
      } catch (error) {
        console.error('[Detail] 后台更新歌单详情失败:', error)
        set({ detailLoading: false })
      }
      return
    }
    
    // 没有缓存，正常加载
    set({ detailType: 'playlist', detailData: playlist, detailLoading: true, detailTracks: [] })
    
    try {
      const tracks = await plugin.instance.getPlaylistSongs(playlist)
      const newTracks = tracks || []
      if (newTracks.length > 0) {
        savePlaylistDetailCache(activePluginId || '', playlistId, newTracks)
      }
      set({ 
        detailTracks: newTracks, 
        detailLoading: false,
        detailHasMore: false,
      })
    } catch (error) {
      console.error('[Detail] 加载歌单歌曲失败:', error)
      // 如果加载失败，尝试使用缓存
      if (cachedTracks && cachedTracks.length > 0) {
        console.log('[Detail] 加载失败，使用缓存数据')
        set({ 
          detailTracks: cachedTracks,
          detailLoading: false,
        })
      } else {
        set({ detailLoading: false })
      }
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
  
  refreshAllData: async () => {
    console.log('[Refresh] 强制刷新所有数据')
    const { activePluginId } = get()
    if (!activePluginId) return
    
    // 强制刷新排行榜和推荐数据
    await Promise.all([
      get().loadTopLists(true),
      get().loadRecommendTags(true),
    ])
  },
  
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
    
    // 加载保存的订阅源
    const savedSubscriptions = loadSubscriptions()
    console.log('[Init] 已保存的订阅源:', savedSubscriptions.length, '个')
    
    // 使用保存的订阅源（首次使用时为空，需要用户手动导入预设配置）
    set({ subscriptions: savedSubscriptions })
    
    // 如果有订阅源，从缓存加载插件
    if (savedSubscriptions.length > 0) {
      await get().loadAllPlugins()
    } else {
      console.log('[Init] 暂无订阅源，请点击"导入预设配置"按钮添加默认音乐源')
    }
  },
}))
