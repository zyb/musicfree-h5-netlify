import { useState } from 'react'
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
  Download,
} from 'lucide-react'
import { usePluginStore } from '../stores/pluginStore'

export function PluginManager() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <SubscriptionsTab />
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
    importDefaultFeeds,
    clearAllSubscriptions,
  } = usePluginStore()
  
  const [showAddForm, setShowAddForm] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  
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
  
  // 导入预设配置
  const handleImportDefault = async () => {
    setImporting(true)
    setImportError(null)
    try {
      await importDefaultFeeds()
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败')
    } finally {
      setImporting(false)
    }
  }
  
  // 清空所有订阅源
  const handleClearAll = () => {
    if (confirm('确定要清空所有订阅源吗？此操作不可撤销。')) {
      clearAllSubscriptions()
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
      <div className="max-w-2xl mx-auto w-full h-full flex flex-col">
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
              <p className="text-surface-300 mb-2">暂无订阅源</p>
              <p className="text-sm mb-6">点击下方按钮导入预设音乐源，或手动添加订阅源</p>
              
              {importError && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span>{importError}</span>
                </div>
              )}
              
              <button
                onClick={handleImportDefault}
                disabled={importing}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-surface-950 font-medium transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>导入预设配置</span>
                  </>
                )}
              </button>
              
              <p className="text-xs text-surface-600 mt-4">
                预设配置包含 6 个音乐源：小秋、小蜗、小芸、小枸、bilibili、元力QQ
              </p>
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
        
        {/* 底部操作区域 */}
        {subscriptions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-surface-800">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* 导入预设配置 */}
              <button
                onClick={handleImportDefault}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm transition-colors disabled:opacity-50"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>导入中...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>导入预设配置</span>
                  </>
                )}
              </button>
              
              {/* 清空订阅列表 */}
              <button
                onClick={handleClearAll}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-800 hover:bg-red-500/20 text-surface-400 hover:text-red-400 text-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>清空订阅列表</span>
              </button>
            </div>
            
            {importError && (
              <div className="flex items-center gap-2 text-red-400 text-sm mt-3">
                <AlertCircle className="w-4 h-4" />
                <span>{importError}</span>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// 测试 Tab
