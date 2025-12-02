import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Radio,
  Link,
  Clock,
  Rss,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FlaskConical,
  Play,
  Search,
  Zap,
} from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'
import { enableDebugLogs, subscribeDebugLogs, proxyMediaUrl, type DebugLogEntry } from '../lib/pluginHost'

type TabType = 'subscriptions' | 'test'

// 测试日志类型
interface LogEntry {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'request' | 'response'
}

export function PluginManager() {
  const [activeTab, setActiveTab] = useState<TabType>('subscriptions')
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab 切换 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-800">
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'subscriptions'
              ? 'bg-primary-500/20 text-primary-400'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
          }`}
        >
          <Rss className="w-4 h-4" />
          订阅源
        </button>
        <button
          onClick={() => setActiveTab('test')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'test'
              ? 'bg-primary-500/20 text-primary-400'
              : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          测试
        </button>
      </div>
      
      {/* Tab 内容 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'subscriptions' ? (
          <SubscriptionsTab />
        ) : (
          <TestTab />
        )}
      </div>
    </div>
  )
}

// 订阅源管理 Tab
function SubscriptionsTab() {
  const {
    subscriptions,
    plugins,
    pluginsLoading,
    addSubscription,
    removeSubscription,
    refreshSubscription,
    refreshAllSubscriptions,
  } = usePluginStore()
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  
  // 获取订阅源下的插件
  const getPluginsForSubscription = (subscriptionId: string) => {
    return plugins.filter(p => p.meta.id.startsWith(subscriptionId))
  }
  
  // 添加订阅源
  const handleAdd = async () => {
    if (!newUrl.trim()) return
    
    setAdding(true)
    setAddError(null)
    
    try {
      await addSubscription(newUrl.trim(), newName.trim() || undefined)
      setNewUrl('')
      setNewName('')
      setShowAddForm(false)
    } catch (error) {
      setAddError(error instanceof Error ? error.message : '添加失败')
    } finally {
      setAdding(false)
    }
  }
  
  // 刷新单个订阅源
  const handleRefresh = async (subscriptionId: string) => {
    setRefreshingId(subscriptionId)
    try {
      await refreshSubscription(subscriptionId)
    } catch (error) {
      console.error('刷新失败:', error)
    } finally {
      setRefreshingId(null)
    }
  }
  
  // 刷新所有订阅源
  const handleRefreshAll = async () => {
    setRefreshingAll(true)
    try {
      await refreshAllSubscriptions()
    } catch (error) {
      console.error('刷新失败:', error)
    } finally {
      setRefreshingAll(false)
    }
  }
  
  // 删除订阅源
  const handleRemove = (subscriptionId: string) => {
    if (confirm('确定要删除这个订阅源吗？')) {
      removeSubscription(subscriptionId)
    }
  }
  
  // 切换展开
  const toggleExpand = (subscriptionId: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      if (next.has(subscriptionId)) {
        next.delete(subscriptionId)
      } else {
        next.add(subscriptionId)
      }
      return next
    })
  }
  
  // 格式化时间
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '从未更新'
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  // 统计插件状态
  const getPluginStats = (subscriptionId: string) => {
    const subPlugins = getPluginsForSubscription(subscriptionId)
    const ready = subPlugins.filter(p => p.status === 'ready').length
    const error = subPlugins.filter(p => p.status === 'error').length
    const loading = subPlugins.filter(p => p.status === 'loading').length
    return { total: subPlugins.length, ready, error, loading }
  }

  return (
    <div className="h-full flex flex-col px-4">
      {/* 头部 */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <Rss className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-surface-100">订阅源管理</h2>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 刷新所有 */}
          <button
            onClick={handleRefreshAll}
            disabled={refreshingAll || subscriptions.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshingAll ? 'animate-spin' : ''}`} />
            <span>全部刷新</span>
          </button>
          
          {/* 添加按钮 */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary-500 hover:bg-primary-400 text-surface-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>添加</span>
          </button>
        </div>
      </div>
      
      {/* 添加表单 */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 mb-4">
              <h3 className="text-sm font-medium text-surface-200 mb-3">添加订阅源</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">订阅源地址 *</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://example.com/plugins.json"
                      className="w-full bg-surface-800 rounded-lg py-2.5 pl-9 pr-3 text-sm text-surface-100 placeholder-surface-500"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-surface-400 mb-1 block">名称（可选）</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="我的订阅源"
                    className="w-full bg-surface-800 rounded-lg py-2.5 px-3 text-sm text-surface-100 placeholder-surface-500"
                  />
                </div>
                
                {addError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>{addError}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAdd}
                    disabled={adding || !newUrl.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 text-surface-950 text-sm font-medium hover:bg-primary-400 transition-colors disabled:opacity-50"
                  >
                    {adding ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>添加中...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>确认添加</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowAddForm(false)
                      setNewUrl('')
                      setNewName('')
                      setAddError(null)
                    }}
                    className="px-4 py-2.5 rounded-lg bg-surface-800 text-surface-300 text-sm hover:bg-surface-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 统计信息 */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1.5 text-surface-400">
          <Rss className="w-4 h-4" />
          <span>{subscriptions.length} 个订阅源</span>
        </div>
        <div className="flex items-center gap-1.5 text-surface-400">
          <Radio className="w-4 h-4" />
          <span>{plugins.length} 个插件</span>
        </div>
        {pluginsLoading && (
          <div className="flex items-center gap-1.5 text-primary-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>加载中...</span>
          </div>
        )}
      </div>
      
      {/* 订阅源列表 */}
      <div className="flex-1 overflow-y-auto pb-32 space-y-3">
        {subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-surface-500">
            <Rss className="w-12 h-12 mb-4 opacity-50" />
            <p>暂无订阅源</p>
            <p className="text-sm mt-1">点击上方"添加"按钮添加订阅源</p>
          </div>
        ) : (
          subscriptions.map((subscription) => {
            const stats = getPluginStats(subscription.id)
            const isExpanded = expandedSubs.has(subscription.id)
            const subPlugins = getPluginsForSubscription(subscription.id)
            
            return (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl overflow-hidden"
              >
                {/* 订阅源头部 */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/20 flex items-center justify-center flex-shrink-0">
                      <Rss className="w-5 h-5 text-primary-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-surface-100 truncate">
                        {subscription.name}
                      </h3>
                      <p className="text-xs text-surface-500 truncate mt-0.5">
                        {subscription.url}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        {/* 插件统计 */}
                        <div className="flex items-center gap-1.5">
                          {stats.ready > 0 && (
                            <span className="flex items-center gap-0.5 text-green-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {stats.ready}
                            </span>
                          )}
                          {stats.error > 0 && (
                            <span className="flex items-center gap-0.5 text-red-400">
                              <XCircle className="w-3 h-3" />
                              {stats.error}
                            </span>
                          )}
                          {stats.loading > 0 && (
                            <span className="flex items-center gap-0.5 text-yellow-400">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              {stats.loading}
                            </span>
                          )}
                        </div>
                        
                        <span className="text-surface-600">•</span>
                        
                        {/* 更新时间 */}
                        <div className="flex items-center gap-1 text-surface-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(subscription.lastUpdated)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleRefresh(subscription.id)}
                        disabled={refreshingId === subscription.id}
                        className="p-2 rounded-lg text-surface-400 hover:text-primary-400 hover:bg-surface-800 transition-colors disabled:opacity-50"
                        title="刷新"
                      >
                        <RefreshCw className={`w-4 h-4 ${refreshingId === subscription.id ? 'animate-spin' : ''}`} />
                      </button>
                      
                      <button
                        onClick={() => handleRemove(subscription.id)}
                        className="p-2 rounded-lg text-surface-400 hover:text-red-400 hover:bg-surface-800 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => toggleExpand(subscription.id)}
                        className="p-2 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors"
                        title={isExpanded ? '收起' : '展开'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* 插件列表 */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-surface-800"
                    >
                      <div className="p-3 bg-surface-900/50 max-h-64 overflow-y-auto">
                        {subPlugins.length === 0 ? (
                          <p className="text-center text-surface-500 text-sm py-4">
                            无插件
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {subPlugins.map((plugin) => (
                              <div
                                key={plugin.meta.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800/50"
                              >
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  plugin.status === 'ready' ? 'bg-green-400' :
                                  plugin.status === 'loading' ? 'bg-yellow-400 animate-pulse' :
                                  plugin.status === 'error' ? 'bg-red-400' :
                                  'bg-surface-500'
                                }`} />
                                
                                <span className="text-sm text-surface-200 flex-1 truncate">
                                  {plugin.meta.name}
                                </span>
                                
                                {plugin.meta.version && (
                                  <span className="text-xs text-surface-500">
                                    v{plugin.meta.version}
                                  </span>
                                )}
                                
                                {plugin.status === 'error' && plugin.error && (
                                  <span className="text-xs text-red-400 truncate max-w-[120px]" title={plugin.error}>
                                    {plugin.error}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}

// 测试 Tab
function TestTab() {
  const { plugins } = usePluginStore()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [selectedPluginId, setSelectedPluginId] = useState<string>('')
  const [query, setQuery] = useState('周杰伦')
  const [testing, setTesting] = useState(false)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  
  const readyPlugins = plugins.filter(p => p.status === 'ready')
  const selectedPlugin = readyPlugins.find(p => p.meta.id === selectedPluginId)
  
  // 订阅调试日志
  useEffect(() => {
    enableDebugLogs(true)
    
    const unsubscribe = subscribeDebugLogs((entry: DebugLogEntry) => {
      const time = new Date(entry.time).toLocaleTimeString()
      let type: 'info' | 'success' | 'error' | 'request' | 'response' = entry.type as typeof type
      
      setLogs(prev => [...prev, { time, message: entry.message, type }])
      
      setTimeout(() => {
        if (logRef.current) {
          logRef.current.scrollTop = logRef.current.scrollHeight
        }
      }, 50)
    })
    
    return () => {
      enableDebugLogs(false)
      unsubscribe()
    }
  }, [])
  
  const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, { time, message, type }])
    setTimeout(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight
      }
    }, 50)
  }
  
  const clearLogs = () => {
    setLogs([])
    setSearchResults([])
  }
  
  // 测试搜索（测试所有类型）
  const testSearch = async () => {
    log('=== 测试搜索 ===')
    
    if (!selectedPlugin?.instance) {
      log('请先选择一个插件', 'error')
      return
    }
    
    setTesting(true)
    log(`使用插件: ${selectedPlugin.meta.name}`)
    log(`搜索关键词: ${query}`)
    
    const instance = selectedPlugin.instance
    const supportedTypes = instance.supportedSearchTypes || ['music']
    log(`支持的搜索类型: ${supportedTypes.join(', ')}`)
    
    // 测试歌曲搜索
    log('\n--- 搜索歌曲 ---')
    try {
      if (instance.searchSongs) {
        const result = await instance.searchSongs(query, 1)
        const tracks = Array.isArray(result) ? result : (result?.data || [])
        
        if (tracks.length > 0) {
          log(`✓ 找到 ${tracks.length} 首歌曲`, 'success')
          setSearchResults(tracks)
          tracks.slice(0, 3).forEach((song: any, i: number) => {
            const artist = song.artists?.join(', ') || song.artist || '未知'
            log(`  ${i+1}. ${song.title} - ${artist}`)
          })
        } else {
          log('✗ 未找到歌曲', 'error')
        }
      } else {
        log('⚠️ 不支持歌曲搜索', 'error')
      }
    } catch (err: any) {
      log(`✗ 歌曲搜索失败: ${err.message}`, 'error')
    }
    
    // 测试歌手搜索
    log('\n--- 搜索歌手 ---')
    try {
      if (instance.searchArtists && supportedTypes.includes('artist')) {
        const result = await instance.searchArtists(query, 1)
        const artists = result?.data || []
        
        if (artists.length > 0) {
          log(`✓ 找到 ${artists.length} 位歌手`, 'success')
          artists.slice(0, 3).forEach((artist: any, i: number) => {
            log(`  ${i+1}. ${artist.name}`)
          })
        } else {
          log('✗ 未找到歌手', 'error')
        }
      } else {
        log('⚠️ 不支持歌手搜索')
      }
    } catch (err: any) {
      log(`✗ 歌手搜索失败: ${err.message}`, 'error')
    }
    
    // 测试专辑搜索
    log('\n--- 搜索专辑 ---')
    try {
      if (instance.searchAlbums && supportedTypes.includes('album')) {
        const result = await instance.searchAlbums(query, 1)
        const albums = result?.data || []
        
        if (albums.length > 0) {
          log(`✓ 找到 ${albums.length} 张专辑`, 'success')
          albums.slice(0, 3).forEach((album: any, i: number) => {
            log(`  ${i+1}. ${album.title} - ${album.artist || '未知'}`)
          })
        } else {
          log('✗ 未找到专辑', 'error')
        }
      } else {
        log('⚠️ 不支持专辑搜索')
      }
    } catch (err: any) {
      log(`✗ 专辑搜索失败: ${err.message}`, 'error')
    }
    
    // 测试歌单搜索
    log('\n--- 搜索歌单 ---')
    try {
      if (instance.searchPlaylists && supportedTypes.includes('sheet')) {
        const result = await instance.searchPlaylists(query, 1)
        const playlists = result?.data || []
        
        if (playlists.length > 0) {
          log(`✓ 找到 ${playlists.length} 个歌单`, 'success')
          playlists.slice(0, 3).forEach((playlist: any, i: number) => {
            log(`  ${i+1}. ${playlist.title}`)
          })
        } else {
          log('✗ 未找到歌单', 'error')
        }
      } else {
        log('⚠️ 不支持歌单搜索')
      }
    } catch (err: any) {
      log(`✗ 歌单搜索失败: ${err.message}`, 'error')
    }
    
    setTesting(false)
  }
  
  // 测试播放
  const testPlay = async () => {
    log('=== 测试播放 ===')
    
    if (!selectedPlugin?.instance) {
      log('请先选择一个插件', 'error')
      return
    }
    
    if (searchResults.length === 0) {
      log('请先搜索歌曲', 'error')
      return
    }
    
    setTesting(true)
    const song = searchResults[0]
    const artist = song.artists?.join(', ') || song.artist || '未知'
    log(`尝试播放: ${song.title} - ${artist}`)
    log(`歌曲ID: ${song.id}`)
    
    try {
      const instance = selectedPlugin.instance
      if (!instance.resolveStream) {
        log('插件没有 resolveStream 方法', 'error')
        return
      }
      
      log(`尝试获取播放地址...`)
      const result = await instance.resolveStream(song)
        
      if (result?.url) {
        log(`获取到播放地址: ${result.url.substring(0, 80)}...`, 'success')
        
        // 尝试播放（使用代理 URL）
        if (audioRef.current) {
          const proxiedUrl = proxyMediaUrl(result.url)
          log(`代理播放地址: ${proxiedUrl.substring(0, 80)}...`, 'info')
          audioRef.current.src = proxiedUrl
          audioRef.current.volume = 0.5
          try {
            await audioRef.current.play()
            log('开始播放!', 'success')
          } catch (e: unknown) {
            const error = e as Error
            log('播放失败: ' + error.message, 'error')
          }
        }
      } else {
        log('未能获取播放地址', 'error')
      }
    } catch (err: unknown) {
      const error = err as Error
      log('播放测试失败: ' + error.message, 'error')
    } finally {
      setTesting(false)
    }
  }
  
  // 测试全部插件
  const testAllPlugins = async () => {
    log('=== 测试全部插件 ===')
    log(`搜索关键词: ${query}`)
    setTesting(true)
    
    interface PluginResult {
      name: string
      songs: { count: number; error?: string }
      artists: { count: number; error?: string }
      albums: { count: number; error?: string }
      playlists: { count: number; error?: string }
    }
    
    const results: PluginResult[] = []
    
    for (const plugin of readyPlugins) {
      log(`\n========== ${plugin.meta.name} ==========`)
      
      const result: PluginResult = {
        name: plugin.meta.name,
        songs: { count: 0 },
        artists: { count: 0 },
        albums: { count: 0 },
        playlists: { count: 0 },
      }
      
      const instance = plugin.instance
      if (!instance) {
        log('  ⚠️ 插件实例不存在', 'error')
        results.push(result)
        continue
      }
      
      const supportedTypes = instance.supportedSearchTypes || ['music']
      
      // 测试歌曲
      try {
        if (instance.searchSongs) {
          const res = await instance.searchSongs(query, 1)
          const tracks = Array.isArray(res) ? res : (res?.data || [])
          result.songs.count = tracks.length
          if (tracks.length > 0) {
            log(`  歌曲: ✓ ${tracks.length} 首`, 'success')
          } else {
            log(`  歌曲: ✗ 无结果`, 'error')
          }
        } else {
          log(`  歌曲: ⚠️ 不支持`)
        }
      } catch (err: any) {
        result.songs.error = err.message
        log(`  歌曲: ✗ ${err.message}`, 'error')
      }
      
      // 测试歌手
      try {
        if (instance.searchArtists && supportedTypes.includes('artist')) {
          const res = await instance.searchArtists(query, 1)
          const artists = res?.data || []
          result.artists.count = artists.length
          if (artists.length > 0) {
            log(`  歌手: ✓ ${artists.length} 位`, 'success')
          } else {
            log(`  歌手: ✗ 无结果`, 'error')
          }
        } else {
          log(`  歌手: ⚠️ 不支持`)
        }
      } catch (err: any) {
        result.artists.error = err.message
        log(`  歌手: ✗ ${err.message}`, 'error')
      }
      
      // 测试专辑
      try {
        if (instance.searchAlbums && supportedTypes.includes('album')) {
          const res = await instance.searchAlbums(query, 1)
          const albums = res?.data || []
          result.albums.count = albums.length
          if (albums.length > 0) {
            log(`  专辑: ✓ ${albums.length} 张`, 'success')
          } else {
            log(`  专辑: ✗ 无结果`, 'error')
          }
        } else {
          log(`  专辑: ⚠️ 不支持`)
        }
      } catch (err: any) {
        result.albums.error = err.message
        log(`  专辑: ✗ ${err.message}`, 'error')
      }
      
      // 测试歌单
      try {
        if (instance.searchPlaylists && supportedTypes.includes('sheet')) {
          const res = await instance.searchPlaylists(query, 1)
          const playlists = res?.data || []
          result.playlists.count = playlists.length
          if (playlists.length > 0) {
            log(`  歌单: ✓ ${playlists.length} 个`, 'success')
          } else {
            log(`  歌单: ✗ 无结果`, 'error')
          }
        } else {
          log(`  歌单: ⚠️ 不支持`)
        }
      } catch (err: any) {
        result.playlists.error = err.message
        log(`  歌单: ✗ ${err.message}`, 'error')
      }
      
      results.push(result)
    }
    
    // 汇总表格
    log('\n========== 测试汇总 ==========')
    log('插件名称          | 歌曲 | 歌手 | 专辑 | 歌单')
    log('------------------|------|------|------|------')
    
    results.forEach(r => {
      const formatCell = (data: { count: number; error?: string }) => {
        if (data.error) return '✗'
        if (data.count > 0) return `${data.count}`
        return '-'
      }
      
      const name = r.name.padEnd(16).substring(0, 16)
      const songs = formatCell(r.songs).padStart(4)
      const artists = formatCell(r.artists).padStart(4)
      const albums = formatCell(r.albums).padStart(4)
      const playlists = formatCell(r.playlists).padStart(4)
      
      const hasSuccess = r.songs.count > 0 || r.artists.count > 0 || r.albums.count > 0 || r.playlists.count > 0
      log(`${name} |${songs} |${artists} |${albums} |${playlists}`, hasSuccess ? 'success' : 'error')
    })
    
    // 统计
    const totalWithSongs = results.filter(r => r.songs.count > 0).length
    const totalWithArtists = results.filter(r => r.artists.count > 0).length
    const totalWithAlbums = results.filter(r => r.albums.count > 0).length
    const totalWithPlaylists = results.filter(r => r.playlists.count > 0).length
    
    log(`\n可用统计: 歌曲 ${totalWithSongs}/${results.length}, 歌手 ${totalWithArtists}/${results.length}, 专辑 ${totalWithAlbums}/${results.length}, 歌单 ${totalWithPlaylists}/${results.length}`)
    
    setTesting(false)
  }
  
  return (
    <div className="h-full flex flex-col px-4">
      {/* 隐藏的音频元素 */}
      <audio ref={audioRef} />
      
      {/* 头部 */}
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-surface-100">插件测试</h2>
        </div>
        
        <button
          onClick={clearLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          清空日志
        </button>
      </div>
      
      {/* 控制面板 */}
      <div className="glass rounded-xl p-4 mb-4 space-y-4">
        {/* 插件选择 */}
        <div>
          <label className="text-xs text-surface-400 mb-2 block">选择插件</label>
          <select
            value={selectedPluginId}
            onChange={(e) => setSelectedPluginId(e.target.value)}
            className="w-full bg-surface-800 rounded-lg py-2.5 px-3 text-sm text-surface-100"
          >
            <option value="">-- 选择一个插件 --</option>
            {readyPlugins.map(p => (
              <option key={p.meta.id} value={p.meta.id}>{p.meta.name}</option>
            ))}
          </select>
        </div>
        
        {/* 搜索关键词 */}
        <div>
          <label className="text-xs text-surface-400 mb-2 block">搜索关键词</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入搜索关键词"
              className="w-full bg-surface-800 rounded-lg py-2.5 pl-9 pr-3 text-sm text-surface-100 placeholder-surface-500"
            />
          </div>
        </div>
        
        {/* 测试按钮 */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={testSearch}
            disabled={testing || !selectedPlugin}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            测试搜索
          </button>
          
          <button
            onClick={testPlay}
            disabled={testing || !selectedPlugin || searchResults.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-700 hover:bg-surface-600 text-surface-200 text-sm transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            测试播放
          </button>
          
          <button
            onClick={testAllPlugins}
            disabled={testing || readyPlugins.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-400 text-surface-950 text-sm transition-colors disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            测试全部插件
          </button>
        </div>
      </div>
      
      {/* 日志区域 */}
      <div className="flex-1 overflow-hidden pb-32">
        <div
          ref={logRef}
          className="h-full overflow-y-auto bg-surface-900 rounded-xl p-4 font-mono text-sm"
        >
          {logs.length === 0 ? (
            <div className="text-surface-500 text-center py-8">
              点击上方按钮开始测试
            </div>
          ) : (
            logs.map((entry, i) => (
              <div
                key={i}
                className={`leading-relaxed ${
                  entry.type === 'error' ? 'text-red-400' :
                  entry.type === 'success' ? 'text-green-400' :
                  entry.type === 'request' ? 'text-blue-400' :
                  entry.type === 'response' ? 'text-cyan-400' :
                  'text-surface-300'
                }`}
              >
                <span className="text-surface-500">{entry.time}</span> {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
