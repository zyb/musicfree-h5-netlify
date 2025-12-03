import type {
  InstalledPlugin,
  LoadedPlugin,
  MusicPlugin,
  PluginDescriptor,
  PluginFeed,
  PluginTrack,
} from '../types/plugin'

const STORAGE_KEY = 'musicfree.h5.plugins'
export const DEFAULT_PLUGIN_FEED =
  'https://musicfreepluginshub.2020818.xyz/plugins.json'

// 全局调试日志系统
export type DebugLogType = 'info' | 'success' | 'error' | 'request' | 'response'
export interface DebugLogEntry {
  time: number
  type: DebugLogType
  message: string
  data?: unknown
}

type DebugLogCallback = (entry: DebugLogEntry) => void
let debugLogCallbacks: DebugLogCallback[] = []
let debugLogsEnabled = false

export const enableDebugLogs = (enabled: boolean) => {
  debugLogsEnabled = enabled
}

export const subscribeDebugLogs = (callback: DebugLogCallback): (() => void) => {
  debugLogCallbacks.push(callback)
  return () => {
    debugLogCallbacks = debugLogCallbacks.filter(cb => cb !== callback)
  }
}

const debugLog = (type: DebugLogType, message: string, data?: unknown) => {
  if (!debugLogsEnabled) return
  const entry: DebugLogEntry = { time: Date.now(), type, message, data }
  debugLogCallbacks.forEach(cb => cb(entry))
}

const now = () => Date.now()

const isHttps = (url: string) => /^https:\/\//i.test(url)
const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url)

// HTTPS URL 的 CORS 代理
const httpsProxyCandidates: Array<(url: string) => string> = [
  (url) => url,
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://cors.isomorphic-git.org/${url}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
]

// HTTP URL 的 CORS 代理（需要支持非 HTTPS 源）
const httpProxyCandidates: Array<(url: string) => string> = [
  // allorigins 支持 HTTP
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // codetabs 支持 HTTP
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // 直接请求（某些情况下可能成功）
  (url) => url,
]

const defaultBuilders = (url: string) => {
  if (!isRemoteUrl(url)) return [(current: string) => current]
  return isHttps(url) ? httpsProxyCandidates : httpProxyCandidates
}

const requestWithFallback = async <T>(
  url: string,
  handler: (response: Response, target: string) => Promise<T>,
  init?: RequestInit,
  builders?: Array<(url: string) => string>,
) => {
  const errors: string[] = []
  const candidates = builders ?? defaultBuilders(url)
  for (const builder of candidates) {
    const target = builder(url)
    try {
      const response = await fetch(target, init)
      if (response.ok) {
        try {
          return await handler(response, target)
        } catch (handlerError) {
          errors.push(
            `解析 ${target} 失败：${
              handlerError instanceof Error
                ? handlerError.message
                : String(handlerError)
            }`,
          )
          continue
        }
      }
      errors.push(`请求 ${target} 失败：${response.status}`)
    } catch (error) {
      errors.push(
        `请求 ${target} 异常：${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  throw new Error(errors.join('\n'))
}

const fetchJsonWithFallback = <T>(url: string, init?: RequestInit) =>
  requestWithFallback<T>(url, async (response) => await response.json(), init)

const fetchTextWithFallback = (url: string, init?: RequestInit) => {
  return requestWithFallback<string>(
    url,
    async (response) => await response.text(),
    init,
  )
}

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export const loadPersistedPlugins = (): InstalledPlugin[] => {
  if (typeof localStorage === 'undefined') return []
  return safeParse<InstalledPlugin[]>(localStorage.getItem(STORAGE_KEY)) ?? []
}

export const persistPlugins = (plugins: InstalledPlugin[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins))
}

export const fetchPluginFeed = async (
  feedUrl: string,
): Promise<PluginFeed> => {
  try {
    const json = await fetchJsonWithFallback<PluginFeed>(feedUrl, {
      cache: 'no-store',
    })
    return { ...json, source: 'remote' }
  } catch (error) {
    console.warn('plugin feed remote fetch failed, fallback to local', error)
    const fallback = await fetchLocalFeed()
    return fallback
  }
}

const fetchLocalFeed = async (): Promise<PluginFeed> => {
  const res = await fetch('/feeds.default.json', { cache: 'no-store' })
  if (!res.ok) {
    throw new Error('无法加载本地备份插件列表')
  }
  const data = (await res.json()) as PluginFeed
  if (!data?.plugins?.length) {
    throw new Error('本地备份为空，请检查 feeds.default.json')
  }
  return { ...data, source: 'fallback' }
}

export const buildDescriptor = (
  descriptor: PluginDescriptor,
): InstalledPlugin => ({
  ...descriptor,
  id: crypto.randomUUID?.() ?? `${descriptor.name}-${now()}`,
  enabled: true,
  installedAt: now(),
})

type RegisterFn = (
  factory: (ctx: PluginHostContext) => MusicPlugin | Promise<MusicPlugin>,
) => void

type PluginHostApi = {
  version: string
  registerPlugin: RegisterFn
  fetch: typeof fetch
  console: Console
}

type PluginHostContext = {
  fetch: typeof fetch
  console: Console
  descriptor: InstalledPlugin
}

// 检测是否为生产环境 (Netlify)
const isProduction = (import.meta as unknown as { env: { PROD: boolean } }).env.PROD
const PROXY_PREFIX = isProduction ? '/api/proxy' : '/proxy'

// URL 重写规则 - 将外部 URL 映射到本地代理
const urlRewriteRules: Array<{ pattern: RegExp; replace: string }> = [
  // ============ QQ 音乐 ============
  { pattern: /^https?:\/\/u\.y\.qq\.com\//, replace: '/proxy/qqu/' },
  { pattern: /^https?:\/\/c\.y\.qq\.com\//, replace: '/proxy/qqc/' },
  { pattern: /^https?:\/\/i\.y\.qq\.com\//, replace: '/proxy/qqi/' },
  { pattern: /^https?:\/\/shc\.y\.qq\.com\//, replace: '/proxy/qqshc/' },
  
  // ============ 网易云音乐 ============
  { pattern: /^https?:\/\/interface3\.music\.163\.com\//, replace: '/proxy/neteasem/' },
  { pattern: /^https?:\/\/interface\.music\.163\.com\//, replace: '/proxy/neteaseapi/' },
  { pattern: /^https?:\/\/music\.163\.com\//, replace: '/proxy/netease/' },
  { pattern: /^https?:\/\/share\.duanx\.cn\//, replace: '/proxy/duanx/' },
  { pattern: /^https?:\/\/music\.haitangw\.cc\//, replace: '/proxy/haitangcc/' },
  { pattern: /^https?:\/\/lxmusicapi\.onrender\.com\//, replace: '/proxy/lxmusic/' },
  
  // ============ 酷狗音乐 ============
  { pattern: /^https?:\/\/songsearch\.kugou\.com\//, replace: '/proxy/kugousearch/' },
  { pattern: /^https?:\/\/complexsearch\.kugou\.com\//, replace: '/proxy/kugoucomplex/' },
  { pattern: /^https?:\/\/wwwapi\.kugou\.com\//, replace: '/proxy/kugouwww/' },
  { pattern: /^https?:\/\/gateway\.kugou\.com\//, replace: '/proxy/kugougateway/' },
  { pattern: /^https?:\/\/trackercdnbj\.kugou\.com\//, replace: '/proxy/kugoutracker/' },
  { pattern: /^https?:\/\/mobilecdn\.kugou\.com\//, replace: '/proxy/kugoumobile/' },
  { pattern: /^https?:\/\/mobileservice\.kugou\.com\//, replace: '/proxy/kugouservice/' },
  { pattern: /^https?:\/\/www\.kugou\.com\//, replace: '/proxy/kugou/' },
  { pattern: /^https?:\/\/5singfc\.kugou\.com\//, replace: '/proxy/5singfc/' },
  { pattern: /^https?:\/\/5sing\.kugou\.com\//, replace: '/proxy/5sing/' },
  
  // ============ 酷我音乐 ============
  { pattern: /^https?:\/\/search\.kuwo\.cn\//, replace: '/proxy/kuwosearch/' },
  { pattern: /^https?:\/\/www\.kuwo\.cn\//, replace: '/proxy/kuwo/' },
  { pattern: /^https?:\/\/kuwo\.cn\//, replace: '/proxy/kuwoapi/' },
  
  // ============ 咪咕音乐 ============
  { pattern: /^https?:\/\/m\.music\.migu\.cn\//, replace: '/proxy/migum/' },
  { pattern: /^https?:\/\/app\.c\.nf\.migu\.cn\//, replace: '/proxy/miguapp/' },
  { pattern: /^https?:\/\/c\.musicapp\.migu\.cn\//, replace: '/proxy/migucdn/' },
  { pattern: /^https?:\/\/jadeite\.migu\.cn\//, replace: '/proxy/migupdms/' },
  { pattern: /^https?:\/\/music\.migu\.cn\//, replace: '/proxy/migu/' },
  
  // ============ B站 ============
  { pattern: /^https?:\/\/api\.bilibili\.com\//, replace: '/proxy/biliapi/' },
  { pattern: /^https?:\/\/www\.bilibili\.com\//, replace: '/proxy/bili/' },
  
  // ============ 千千音乐 ============
  { pattern: /^https?:\/\/music\.91q\.com\//, replace: '/proxy/qianqian/' },
  
  // ============ 喜马拉雅 ============
  { pattern: /^https?:\/\/mobile\.ximalaya\.com\//, replace: '/proxy/xmlymobile/' },
  { pattern: /^https?:\/\/www\.ximalaya\.com\//, replace: '/proxy/xmly/' },
  
  // ============ 懒人听书 ============
  { pattern: /^https?:\/\/www\.lrts\.me\//, replace: '/proxy/lrts/' },
  
  // ============ 猫耳 FM ============
  { pattern: /^https?:\/\/www\.missevan\.com\//, replace: '/proxy/missevan/' },
  
  // ============ 荔枝 FM ============
  { pattern: /^https?:\/\/www\.lizhi\.fm\//, replace: '/proxy/lizhi/' },
  
  // ============ zz123 聚合 ============
  { pattern: /^https?:\/\/(www\.)?zz123\.com\//, replace: '/proxy/zz123/' },
  { pattern: /^https?:\/\/(www\.)?zz123\.com\?/, replace: '/proxy/zz123?' },
  { pattern: /^https?:\/\/(www\.)?zz123\.com$/, replace: '/proxy/zz123' },
  
  // ============ 歌曲宝 ============
  { pattern: /^https?:\/\/(www\.)?gequbao\.com\//, replace: '/proxy/gequbao/' },
  { pattern: /^https?:\/\/(www\.)?gequbao\.com\?/, replace: '/proxy/gequbao?' },
  { pattern: /^https?:\/\/(www\.)?gequbao\.com$/, replace: '/proxy/gequbao' },
  
  // ============ Suno ============
  { pattern: /^https?:\/\/studio-api\.suno\.ai\//, replace: '/proxy/suno/' },
  { pattern: /^https?:\/\/suno\.ai\//, replace: '/proxy/suno/' },
  
  // ============ Gitee ============
  { pattern: /^https?:\/\/gitee\.com\//, replace: '/proxy/gitee/' },
  
  // ============ GitHub ============
  { pattern: /^https?:\/\/raw\.githubusercontent\.com\//, replace: '/proxy/github/' },
  { pattern: /^https?:\/\/ghproxy\.com\//, replace: '/proxy/ghproxy/' },
  
  // ============ 海棠音乐 ============
  { pattern: /^https?:\/\/musicapi\.haitangw\.net\//, replace: '/proxy/haitang/' },
  { pattern: /^https?:\/\/music\.haitangw\.net\//, replace: '/proxy/haitangm/' },
  
  // ============ 其他聚合 API ============
  { pattern: /^https?:\/\/api\.lolimi\.cn\//, replace: '/proxy/aggregator/' },
  { pattern: /^https?:\/\/api\.xingzhige\.com\//, replace: '/proxy/myfreemp3/' },
]

// 重写 URL 使用本地代理
const rewriteUrl = (url: string): string | null => {
  for (const rule of urlRewriteRules) {
    if (rule.pattern.test(url)) {
      // 根据环境替换代理前缀
      const replacement = rule.replace.replace('/proxy/', `${PROXY_PREFIX}/`)
      return url.replace(rule.pattern, replacement)
    }
  }
  return null
}

/**
 * 代理媒体 URL（用于 audio/video 元素）
 * 将外部 URL 转换为本地代理 URL
 */
export const proxyMediaUrl = (url: string): string => {
  if (!url) return url
  // 如果已经是相对路径或 data URL，直接返回
  if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }
  // 尝试重写为代理 URL
  const rewritten = rewriteUrl(url)
  if (rewritten) {
    console.log('[Media] 代理 URL:', url.substring(0, 50), '->', rewritten.substring(0, 40))
    return rewritten
  }
  // 无匹配规则，返回原 URL
  return url
}

// 创建带代理的 fetch 函数
const createProxiedFetch = (): typeof fetch => {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    
    if (!isRemoteUrl(url)) {
      return fetch(input, init)
    }
    
    // 首先尝试使用本地代理（开发环境）
    const rewrittenUrl = rewriteUrl(url)
    if (rewrittenUrl) {
      try {
        console.log('[Proxy] 本地代理:', url.substring(0, 60), '->', rewrittenUrl.substring(0, 40))
        const response = await fetch(rewrittenUrl, init)
        if (response.ok) {
          return response
        }
        console.warn('[Proxy] 本地代理返回:', response.status)
      } catch (e) {
        console.warn('[Proxy] 本地代理异常:', e)
      }
    }
    
    // 对于 GET 请求，尝试 CORS 代理
    const method = init?.method?.toUpperCase() || 'GET'
    if (method === 'GET') {
      // 尝试 allorigins 代理
      try {
        const alloriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
        console.log('[Proxy] allorigins:', url.substring(0, 50))
        const response = await fetch(alloriginsUrl)
        if (response.ok) {
          return response
        }
      } catch {
        // 继续尝试其他代理
      }
      
      // 尝试其他 CORS 代理
      const candidates = isHttps(url) ? httpsProxyCandidates : httpProxyCandidates
      for (const builder of candidates) {
        const proxiedUrl = builder(url)
        if (proxiedUrl === url) continue
        try {
          const response = await fetch(proxiedUrl)
          if (response.ok) {
            return response
          }
        } catch {
          continue
        }
      }
    }
    
    // 最后尝试直接请求（可能会 CORS 错误）
    console.log('[Proxy] 直接请求:', url.substring(0, 60))
    return fetch(input, init)
  }
}

const createHostContext = (descriptor: InstalledPlugin): PluginHostContext => ({
  fetch: createProxiedFetch(),
  console: createPluginConsole(descriptor.name),
  descriptor,
})

const createPluginConsole = (name: string): Console => {
  const prefix = `[${name}]`
  const proxyHandler: ProxyHandler<Console> = {
    get(target, prop) {
      const value = target[prop as keyof Console]
      if (typeof value !== 'function') return value
      const fn = value as (...inner: unknown[]) => unknown
      return (...args: unknown[]) => fn(prefix, ...args)
    },
  }
  return new Proxy(console, proxyHandler)
}

const createHostApi = (
  descriptor: InstalledPlugin,
  onRegister: RegisterFn,
): PluginHostApi => ({
  version: '0.1.0',
  registerPlugin: onRegister,
  fetch: createProxiedFetch(),
  console: createPluginConsole(descriptor.name),
})

// 全局歌词缓存：key 是歌曲 ID，value 是歌词文本
const lyricCache = new Map<string, string>()

// 获取歌词缓存的函数（供外部调用）
export const getLyricFromCache = (trackId: string): string | undefined => {
  return lyricCache.get(trackId)
}

// 创建 axios 兼容的模拟实现
const createAxiosShim = (_proxiedFetch: typeof fetch) => {
  const processResponse = async (response: Response, requestUrl?: string) => {
    const contentType = response.headers.get('content-type') || ''
    let data: unknown
    
    const text = await response.text()
    if (contentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    } else {
      data = text
    }
    
    // 拦截 qq_song_kw.php 请求，提取歌词
    if (requestUrl && requestUrl.includes('qq_song_kw.php')) {
      console.log('[歌词调试] 检测到 qq_song_kw.php 请求，检查响应数据')
      console.log('[歌词调试] 响应数据类型:', typeof data, '是否为对象:', typeof data === 'object', '是否有 data 字段:', data && typeof data === 'object' && 'data' in data)
      
      if (data && typeof data === 'object' && 'data' in data) {
        const responseData = data as { 
          code?: number
          msg?: string
          data?: { 
            lrc?: string
            rid?: string
            name?: string
            artist?: string
            [key: string]: unknown 
          } 
        }
        
        console.log('[歌词调试] 响应数据结构:', {
          code: responseData.code,
          msg: responseData.msg,
          hasData: !!responseData.data,
          dataKeys: responseData.data ? Object.keys(responseData.data) : [],
          hasLrc: !!responseData.data?.lrc,
          lrcType: typeof responseData.data?.lrc,
          lrcLength: typeof responseData.data?.lrc === 'string' ? responseData.data.lrc.length : 0,
          rid: responseData.data?.rid,
        })
        
        if (responseData.data?.lrc && typeof responseData.data.lrc === 'string') {
          const trackId = responseData.data.rid || ''
          if (trackId) {
            console.log('[歌词调试] 从 qq_song_kw.php 响应中提取到歌词，trackId:', trackId, '歌词长度:', responseData.data.lrc.length, '歌词预览:', responseData.data.lrc.substring(0, 100))
            lyricCache.set(String(trackId), responseData.data.lrc)
            // 触发全局事件，通知 App.tsx 更新歌词
            if (typeof window !== 'undefined') {
              console.log('[歌词调试] 触发 lyricUpdated 事件，trackId:', trackId)
              window.dispatchEvent(new CustomEvent('lyricUpdated', { 
                detail: { trackId: String(trackId), lrc: responseData.data.lrc, rid: String(trackId) } 
              }))
            }
          } else {
            console.warn('[歌词调试] 响应中有歌词但没有 rid 字段')
          }
        } else {
          console.log('[歌词调试] 响应中没有 lrc 字段或 lrc 不是字符串')
        }
      } else {
        console.log('[歌词调试] 响应数据格式不正确，不是预期的对象格式')
      }
    }
    
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      config: {},
    }
  }
  
  const request = async (config: {
    url?: string
    method?: string
    headers?: Record<string, string>
    data?: unknown
    params?: Record<string, string>
    baseURL?: string
    responseType?: string
  }) => {
    let url = config.url || ''
    if (config.baseURL && !url.startsWith('http')) {
      url = config.baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '')
    }
    
    if (config.params) {
      const params = new URLSearchParams(config.params).toString()
      url += (url.includes('?') ? '&' : '?') + params
    }
    
    const method = config.method?.toUpperCase() || 'GET'
    
    // 记录原始请求
    debugLog('request', `[axios] ${method} ${url}`, { 
      originalUrl: url,
      params: config.params,
      hasBody: !!config.data 
    })
    
    // 直接在这里做 URL 重写
    let finalUrl = url
    const rewritten = rewriteUrl(url)
    if (rewritten) {
      finalUrl = rewritten
      debugLog('info', `[axios] URL 重写: ${url} -> ${finalUrl}`)
      console.log('[axios] URL 重写:', url, '->', finalUrl)
    }
    
    const init: RequestInit = {
      method,
      headers: config.headers,
    }
    
    if (config.data && init.method !== 'GET') {
      if (typeof config.data === 'string') {
        init.body = config.data
      } else {
        init.body = JSON.stringify(config.data)
        init.headers = { ...init.headers, 'Content-Type': 'application/json' }
      }
      debugLog('info', `[axios] 请求体: ${typeof config.data === 'string' ? config.data.substring(0, 200) : JSON.stringify(config.data).substring(0, 200)}...`)
    }
    
    console.log('[axios] 请求:', init.method, finalUrl)
    
    try {
      const response = await fetch(finalUrl, init)
      const result = await processResponse(response, url) // 传递原始 URL 用于检测
      
      // 记录响应
      const dataPreview = typeof result.data === 'string' 
        ? result.data.substring(0, 300)
        : JSON.stringify(result.data).substring(0, 300)
      
      if (response.ok) {
        debugLog('response', `[axios] 响应 ${response.status}: ${dataPreview}...`, {
          status: response.status,
          dataType: typeof result.data,
        })
      } else {
        debugLog('error', `[axios] 响应错误 ${response.status}: ${dataPreview}...`, {
          status: response.status,
        })
      }
      
      console.log('[axios] 响应:', response.status)
      return result
    } catch (error) {
      debugLog('error', `[axios] 请求失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
  
  const axios = async (urlOrConfig: string | Parameters<typeof request>[0], config?: Parameters<typeof request>[0]) => {
    if (typeof urlOrConfig === 'string') {
      return request({ ...config, url: urlOrConfig })
    }
    return request(urlOrConfig)
  }
  
  axios.get = (url: string, config?: Parameters<typeof request>[0]) => 
    request({ ...config, url, method: 'GET' })
  axios.post = (url: string, data?: unknown, config?: Parameters<typeof request>[0]) => 
    request({ ...config, url, method: 'POST', data })
  axios.put = (url: string, data?: unknown, config?: Parameters<typeof request>[0]) => 
    request({ ...config, url, method: 'PUT', data })
  axios.delete = (url: string, config?: Parameters<typeof request>[0]) => 
    request({ ...config, url, method: 'DELETE' })
  axios.request = request
  axios.create = (defaults?: Parameters<typeof request>[0]) => {
    const instance = (urlOrConfig: string | Parameters<typeof request>[0], config?: Parameters<typeof request>[0]) => {
      if (typeof urlOrConfig === 'string') {
        return request({ ...defaults, ...config, url: urlOrConfig })
      }
      return request({ ...defaults, ...urlOrConfig })
    }
    instance.get = (url: string, config?: Parameters<typeof request>[0]) => 
      request({ ...defaults, ...config, url, method: 'GET' })
    instance.post = (url: string, data?: unknown, config?: Parameters<typeof request>[0]) => 
      request({ ...defaults, ...config, url, method: 'POST', data })
    instance.defaults = defaults || {}
    return instance
  }
  axios.defaults = { headers: { common: {} } }
  
  // 兼容 ES module 导入方式 (axios.default)
  ;(axios as unknown as { default: typeof axios }).default = axios
  
  return axios
}

// 简单的 cheerio 兼容实现（使用 DOM API）
const createCheerioShim = () => {
  interface CheerioWrapper {
    length: number;
    [Symbol.iterator]: () => Iterator<Element>;
    find: (sel: string) => CheerioWrapper;
    first: () => CheerioWrapper;
    last: () => CheerioWrapper;
    eq: (i: number) => CheerioWrapper;
    slice: (start?: number, end?: number) => CheerioWrapper;
    text: () => string;
    html: () => string;
    attr: (name: string) => string;
    data: (name: string) => string;
    each: (fn: (i: number, el: Element) => void) => CheerioWrapper;
    map: (fn: (i: number, el: Element) => unknown) => { get: () => unknown[]; toArray: () => unknown[] };
    toArray: () => Element[];
    get: (i?: number) => Element | Element[] | undefined;
    parent: () => CheerioWrapper;
    parents: (sel?: string) => CheerioWrapper;
    closest: (sel: string) => CheerioWrapper;
    children: (sel?: string) => CheerioWrapper;
    siblings: (sel?: string) => CheerioWrapper;
    next: () => CheerioWrapper;
    prev: () => CheerioWrapper;
    nextAll: () => CheerioWrapper;
    prevAll: () => CheerioWrapper;
    hasClass: (cls: string) => boolean;
    is: (sel: string) => boolean;
    filter: (sel: string | ((i: number, el: Element) => boolean)) => CheerioWrapper;
    not: (sel: string) => CheerioWrapper;
    add: (sel: string) => CheerioWrapper;
    contents: () => CheerioWrapper;
    index: () => number;
  }

  const load = (html: string) => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    
    // 创建一个包装器的工厂函数 - 定义在 $ 外面以便递归调用
    const createWrapper = (els: Element[]): CheerioWrapper => {
      // 确保 els 是数组且过滤掉 null/undefined
      const safeEls = Array.isArray(els) ? els.filter(Boolean) : []
      
      const wrapper: CheerioWrapper = {
        length: safeEls.length,
        [Symbol.iterator]: () => safeEls[Symbol.iterator](),
        
        find: (sel: string) => {
          try {
            const found = safeEls.flatMap(el => {
              try {
                return Array.from(el.querySelectorAll(sel))
              } catch {
                return []
              }
            })
            return createWrapper(found)
          } catch {
            return createWrapper([])
          }
        },
        
        first: () => createWrapper(safeEls.slice(0, 1)),
        last: () => createWrapper(safeEls.slice(-1)),
        eq: (i: number) => createWrapper(safeEls[i] ? [safeEls[i]] : []),
        slice: (start?: number, end?: number) => createWrapper(safeEls.slice(start, end)),
        
        text: () => safeEls.map(el => el.textContent || '').join(''),
        html: () => safeEls[0]?.innerHTML || '',
        
        attr: (name: string) => safeEls[0]?.getAttribute(name) || '',
        data: (name: string) => safeEls[0]?.getAttribute('data-' + name) || safeEls[0]?.getAttribute(name) || '',
        
        each: (fn: (i: number, el: Element) => void) => {
          safeEls.forEach((el, i) => fn(i, el))
          return wrapper
        },
        
        map: (fn: (i: number, el: Element) => unknown) => ({
          get: () => safeEls.map((el, i) => fn(i, el)),
          toArray: () => safeEls.map((el, i) => fn(i, el)),
        }),
        
        toArray: () => safeEls,
        get: (i?: number) => i !== undefined ? safeEls[i] : safeEls,
        
        parent: () => createWrapper(safeEls.map(el => el.parentElement).filter(Boolean) as Element[]),
        parents: (sel?: string) => {
          const parents: Element[] = []
          safeEls.forEach(el => {
            let parent = el.parentElement
            while (parent) {
              if (!sel || parent.matches(sel)) {
                if (!parents.includes(parent)) parents.push(parent)
              }
              parent = parent.parentElement
            }
          })
          return createWrapper(parents)
        },
        closest: (sel: string) => {
          const closests = safeEls.map(el => el.closest(sel)).filter(Boolean) as Element[]
          return createWrapper(closests)
        },
        children: (sel?: string) => {
          const children = safeEls.flatMap(el => Array.from(el.children))
          if (sel) return createWrapper(children.filter(el => el.matches(sel)))
          return createWrapper(children)
        },
        siblings: (sel?: string) => {
          const siblings: Element[] = []
          safeEls.forEach(el => {
            const parent = el.parentElement
            if (parent) {
              Array.from(parent.children).forEach(child => {
                if (child !== el && (!sel || child.matches(sel)) && !siblings.includes(child)) {
                  siblings.push(child)
                }
              })
            }
          })
          return createWrapper(siblings)
        },
        next: () => createWrapper(safeEls.map(el => el.nextElementSibling).filter(Boolean) as Element[]),
        prev: () => createWrapper(safeEls.map(el => el.previousElementSibling).filter(Boolean) as Element[]),
        nextAll: () => {
          const all: Element[] = []
          safeEls.forEach(el => {
            let next = el.nextElementSibling
            while (next) {
              all.push(next)
              next = next.nextElementSibling
            }
          })
          return createWrapper(all)
        },
        prevAll: () => {
          const all: Element[] = []
          safeEls.forEach(el => {
            let prev = el.previousElementSibling
            while (prev) {
              all.push(prev)
              prev = prev.previousElementSibling
            }
          })
          return createWrapper(all)
        },
        
        hasClass: (cls: string) => safeEls.some(el => el.classList?.contains(cls)),
        is: (sel: string) => safeEls.some(el => {
          try { return el.matches(sel) } catch { return false }
        }),
        filter: (sel: string | ((i: number, el: Element) => boolean)) => {
          if (typeof sel === 'function') {
            return createWrapper(safeEls.filter((el, i) => sel(i, el)))
          }
          return createWrapper(safeEls.filter(el => {
            try { return el.matches(sel) } catch { return false }
          }))
        },
        not: (sel: string) => createWrapper(safeEls.filter(el => {
          try { return !el.matches(sel) } catch { return true }
        })),
        add: (sel: string) => {
          const additional = Array.from(doc.querySelectorAll(sel))
          return createWrapper([...safeEls, ...additional])
        },
        contents: () => {
          const nodes = safeEls.flatMap(el => Array.from(el.childNodes) as Element[])
          return createWrapper(nodes.filter(n => n.nodeType === 1) as Element[])
        },
        index: () => {
          const el = safeEls[0]
          if (!el || !el.parentElement) return -1
          return Array.from(el.parentElement.children).indexOf(el)
        },
      }
      
      return wrapper
    }
    
    const $ = (selector: string | Element | null | undefined): CheerioWrapper => {
      if (!selector) {
        return createWrapper([])
      }
      
      if (typeof selector === 'string') {
        try {
          return createWrapper(Array.from(doc.querySelectorAll(selector)))
        } catch {
          return createWrapper([])
        }
      }
      
      if (selector instanceof Element) {
        return createWrapper([selector])
      }
      
      return createWrapper([])
    }
    
    $.html = () => doc.documentElement.outerHTML
    $.text = () => doc.body?.textContent || ''
    $.root = () => createWrapper([doc.documentElement])
    
    return $
  }
  
  return { load, default: load }
}

// CryptoJS 兼容实现
const createCryptoShim = () => {
  // WordArray 类似对象
  interface WordArrayLike {
    words: number[]
    sigBytes: number
    toString: (encoder?: { stringify: (wa: WordArrayLike) => string }) => string
  }
  
  const createWordArray = (bytes: Uint8Array): WordArrayLike => {
    const words: number[] = []
    for (let i = 0; i < bytes.length; i += 4) {
      words.push(
        ((bytes[i] || 0) << 24) |
        ((bytes[i + 1] || 0) << 16) |
        ((bytes[i + 2] || 0) << 8) |
        (bytes[i + 3] || 0)
      )
    }
    return {
      words,
      sigBytes: bytes.length,
      toString(encoder) {
        if (encoder?.stringify) {
          return encoder.stringify(this)
        }
        // 默认转为 hex
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      }
    }
  }
  
  const wordArrayToBytes = (wa: WordArrayLike): Uint8Array => {
    const bytes = new Uint8Array(wa.sigBytes)
    for (let i = 0; i < wa.sigBytes; i++) {
      bytes[i] = (wa.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
    }
    return bytes
  }
  
  const enc = {
    Utf8: {
      parse: (str: string) => createWordArray(new TextEncoder().encode(str)),
      stringify: (wa: WordArrayLike) => new TextDecoder().decode(wordArrayToBytes(wa)),
    },
    Base64: {
      stringify: (wa: WordArrayLike) => btoa(String.fromCharCode(...wordArrayToBytes(wa))),
      parse: (str: string) => {
        try {
          const decoded = atob(str)
          const bytes = new Uint8Array(decoded.length)
          for (let i = 0; i < decoded.length; i++) {
            bytes[i] = decoded.charCodeAt(i)
          }
          return createWordArray(bytes)
        } catch {
          return createWordArray(new Uint8Array(0))
        }
      },
    },
    Hex: {
      stringify: (wa: WordArrayLike) => {
        const bytes = wordArrayToBytes(wa)
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
      },
      parse: (hex: string) => {
        const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)))
        return createWordArray(bytes)
      },
    },
  }
  
  return {
    enc,
    MD5: (str: string) => createWordArray(new TextEncoder().encode(str)),
    SHA1: (str: string) => createWordArray(new TextEncoder().encode(str)),
    SHA256: (str: string) => createWordArray(new TextEncoder().encode(str)),
    AES: {
      encrypt: (data: string, _key: string) => ({ toString: () => btoa(data) }),
      decrypt: (data: string, _key: string) => ({ 
        toString: (encoder?: { stringify: (wa: WordArrayLike) => string }) => {
          try {
            const decoded = atob(data)
            if (encoder?.stringify) {
              const bytes = new Uint8Array(decoded.length)
              for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i)
              }
              return encoder.stringify(createWordArray(bytes))
            }
            return decoded
          } catch {
            return data
          }
        }
      }),
    },
  }
}

// 创建 dayjs shim
const createDayjsShim = () => {
  const createInstance = (date?: Date | number | string) => {
    const d = date !== undefined ? new Date(date) : new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    
    return {
      format: (fmt?: string) => {
        if (!fmt) return d.toISOString()
        return fmt
          .replace('YYYY', String(d.getFullYear()))
          .replace('MM', pad(d.getMonth() + 1))
          .replace('DD', pad(d.getDate()))
          .replace('HH', pad(d.getHours()))
          .replace('mm', pad(d.getMinutes()))
          .replace('ss', pad(d.getSeconds()))
      },
      valueOf: () => d.getTime(),
      unix: () => Math.floor(d.getTime() / 1000),
      toDate: () => d,
    }
  }
  
  const dayjs = (date?: Date | number | string) => createInstance(date)
  dayjs.unix = (timestamp: number) => createInstance(timestamp * 1000)
  
  return dayjs
}

// 创建 require 函数
const createRequireShim = (proxiedFetch: typeof fetch) => {
  // 获取全局加载的库
  const globalCryptoJS = (window as unknown as { CryptoJS?: unknown }).CryptoJS
  const globalBigInt = (window as unknown as { bigInt?: unknown }).bigInt
  
  const modules: Record<string, unknown> = {
    'axios': createAxiosShim(proxiedFetch),
    'cheerio': createCheerioShim(),
    'crypto-js': globalCryptoJS || createCryptoShim(),
    'big-integer': globalBigInt,
    'qs': {
      stringify: (obj: Record<string, string>) => new URLSearchParams(obj).toString(),
      parse: (str: string) => Object.fromEntries(new URLSearchParams(str)),
    },
    'dayjs': createDayjsShim(),
    'he': {
      decode: (str: string) => {
        const txt = document.createElement('textarea')
        txt.innerHTML = str
        return txt.value
      },
      encode: (str: string) => str.replace(/[&<>"']/g, (m) => 
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m)
      ),
    },
    // WebDAV 模块占位符 (H5 不支持，但需要避免报错)
    'webdav': {
      createClient: () => ({
        getDirectoryContents: async () => [],
        getFileContents: async () => '',
        putFileContents: async () => {},
        createDirectory: async () => {},
        deleteFile: async () => {},
        exists: async () => false,
      }),
    },
    // 其他可能需要的模块占位符
    'path': {
      join: (...args: string[]) => args.filter(Boolean).join('/'),
      basename: (path: string) => path.split('/').pop() || '',
      dirname: (path: string) => path.split('/').slice(0, -1).join('/'),
      extname: (path: string) => {
        const base = path.split('/').pop() || ''
        const dot = base.lastIndexOf('.')
        return dot > 0 ? base.slice(dot) : ''
      },
    },
    'url': {
      parse: (urlStr: string) => {
        try {
          const url = new URL(urlStr)
          return {
            protocol: url.protocol,
            host: url.host,
            hostname: url.hostname,
            port: url.port,
            pathname: url.pathname,
            search: url.search,
            query: url.search.slice(1),
            hash: url.hash,
            href: url.href,
          }
        } catch {
          return { href: urlStr }
        }
      },
      format: (urlObj: Record<string, string>) => {
        if (urlObj.href) return urlObj.href
        return `${urlObj.protocol || 'https:'}//${urlObj.host || urlObj.hostname || ''}${urlObj.pathname || '/'}${urlObj.search || ''}${urlObj.hash || ''}`
      },
    },
  }
  
  return (moduleName: string) => {
    if (modules[moduleName]) {
      return modules[moduleName]
    }
    // 静默返回空对象，不打印警告（减少控制台噪音）
    console.debug(`[H5] 模块 "${moduleName}" 未实现，返回空对象`)
    return {}
  }
}

const executePluginCode = async (
  code: string,
  descriptor: InstalledPlugin,
): Promise<MusicPlugin> => {
  const module = { exports: {} as unknown }
  const registrations: Array<
    MusicPlugin | Promise<MusicPlugin>
  > = []
  const hostContext = createHostContext(descriptor)
  const hostApi = createHostApi(descriptor, (factory) => {
    registrations.push(factory(hostContext))
  })
  
  const proxiedFetch = createProxiedFetch()
  const requireShim = createRequireShim(proxiedFetch)
  
  // 提供 env 对象（MusicFree 原版 API）
  const env = {
    getUserVariables: () => ({}),
    os: 'h5',
    appVersion: '1.0.0',
  }

  const wrapped = new Function(
    'module',
    'exports',
    'require',
    'MusicFreeH5',
    'fetch',
    'console',
    'env',
    `${code}\nreturn module.exports;`,
  )

  const previous = getGlobalHost()
  setGlobalHost(hostApi)
  try {
    wrapped(
      module, 
      module.exports, 
      requireShim,
      hostApi,
      proxiedFetch,
      createPluginConsole(descriptor.name),
      env
    )
  } finally {
    setGlobalHost(previous)
  }
  if (registrations.length > 0) {
    const candidate = await registrations[registrations.length - 1]
    return candidate
  }

  const exported =
    (module.exports as Record<string, unknown>)?.default ??
    module.exports

  if (typeof exported === 'function') {
    const result = await exported(hostContext)
    if (result?.searchSongs) return result
  }

  if (exported && typeof exported === 'object' && 'searchSongs' in exported) {
    console.log('[executePluginCode] 找到 searchSongs 实现')
    return exported as MusicPlugin
  }
  
  // 适配 MusicFree 原生插件格式
  if (exported && typeof exported === 'object' && 'search' in exported) {
    console.log('[executePluginCode] 找到 MusicFree 原生插件, platform:', (exported as MusicFreeNativePlugin).platform)
    console.log('[executePluginCode] 导出的方法:', Object.keys(exported))
    return adaptMusicFreePlugin(exported as MusicFreeNativePlugin, createProxiedFetch())
  }

  // 尝试适配其他格式的插件 (可能只有 getTopLists 等方法，没有搜索)
  if (exported && typeof exported === 'object') {
    const keys = Object.keys(exported)
    console.log('[executePluginCode] 插件导出的方法:', keys)
    
    // 如果有 getTopLists 或 getMediaSource 等方法，创建一个最小的包装器
    const exp = exported as Record<string, unknown>
    if (keys.some(k => ['getTopLists', 'getTopListDetail', 'getMediaSource', 'platform'].includes(k))) {
      console.log('[executePluginCode] 创建仅支持排行榜/播放的插件')
      return {
        name: String(exp.platform || descriptor.name),
        version: String(exp.version || '0.0.0'),
        author: String(exp.author || 'unknown'),
        capabilities: ['stream'],
        supportedSearchTypes: [],
        async searchSongs() { return { data: [], isEnd: true } },
        async searchArtists() { return { data: [], isEnd: true } },
        async searchAlbums() { return { data: [], isEnd: true } },
        async searchPlaylists() { return { data: [], isEnd: true } },
        async resolveStream(track) {
          if (typeof exp.getMediaSource === 'function') {
            try {
              const result = await (exp.getMediaSource as (t: unknown, q: string) => Promise<{ url: string }>)(track.extra || track, 'standard')
              if (result?.url) {
                return { url: result.url }
              }
            } catch (e) {
              console.error('[Plugin] resolveStream error:', e)
            }
          }
          return null
        },
      } as MusicPlugin
    }
  }

  console.log('[executePluginCode] 导出内容:', typeof exported, exported ? Object.keys(exported as object) : 'null')
  throw new Error('插件未导出有效的 searchSongs 实现')
}

// MusicFree 原生插件接口
interface MusicFreeNativePlugin {
  platform: string
  version?: string
  author?: string
  srcUrl?: string
  supportedSearchType?: string[]
  search: (query: string, page: number, type: string) => Promise<{
    isEnd: boolean
    data: MusicFreeTrack[]
  }>
  getMediaSource?: (track: MusicFreeTrack, quality: string) => Promise<{ url: string }>
  getLyric?: (track: MusicFreeTrack) => Promise<{ rawLrc?: string }>
  getAlbumInfo?: (album: MusicFreeAlbum) => Promise<{ musicList: MusicFreeTrack[] }>
  getArtistWorks?: (artist: MusicFreeArtist, page: number, type: string) => Promise<{
    isEnd: boolean
    data: MusicFreeTrack[]
  }>
  getMusicSheetInfo?: (sheet: MusicFreePlaylist, page: number) => Promise<{
    isEnd: boolean
    musicList: MusicFreeTrack[]
  }>
}

interface MusicFreeTrack {
  id: string | number
  songmid?: string
  title: string
  artist: string
  artwork?: string
  album?: string
  lrc?: string
  url?: string
  [key: string]: unknown
}

interface MusicFreeArtist {
  id: string | number
  name: string
  avatar?: string
  worksNum?: number
  singerMID?: string
  [key: string]: unknown
}

interface MusicFreeAlbum {
  id: string | number
  albumMID?: string
  title: string
  artist?: string
  artwork?: string
  date?: string
  description?: string
  [key: string]: unknown
}

interface MusicFreePlaylist {
  id: string | number
  title: string
  artist?: string
  artwork?: string
  playCount?: number
  worksNums?: number
  description?: string
  [key: string]: unknown
}

// 映射歌曲
const mapTrack = (track: MusicFreeTrack): PluginTrack => ({
  id: String(track.id || track.songmid || ''),
  title: track.title || '',
  artists: track.artist ? track.artist.split(/[,，、]/).map(s => s.trim()) : ['未知'],
  album: track.album,
  coverUrl: track.artwork,
  duration: undefined,
  streamUrl: track.url,
  extra: track,
})

// 将 MusicFree 原生插件适配为 H5 插件格式
const adaptMusicFreePlugin = (
  native: MusicFreeNativePlugin,
  _proxiedFetch: typeof fetch
): MusicPlugin => {
  console.log('[adaptMusicFreePlugin] 适配插件:', native.platform, '支持类型:', native.supportedSearchType)
  
  const supportedTypes = native.supportedSearchType || ['music']
  
  return {
    name: native.platform,
    version: native.version,
    author: native.author,
    capabilities: ['search', 'stream'],
    supportedSearchTypes: supportedTypes.map(t => {
      if (t === 'music' || t === 'song') return 'music'
      if (t === 'artist' || t === 'singer') return 'artist'
      if (t === 'album') return 'album'
      if (t === 'sheet' || t === 'playlist') return 'sheet'
      return t as 'music' | 'artist' | 'album' | 'sheet'
    }),
    
    async searchSongs(query: string, page: number = 1) {
      try {
        const result = await native.search(query, page, 'music')
        const mapped = (result?.data || []).map(mapTrack)
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] searchSongs error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async searchArtists(query: string, page: number = 1) {
      if (!supportedTypes.includes('artist')) {
        return { data: [], isEnd: true }
      }
      try {
        const result = await native.search(query, page, 'artist')
        const artistData = (result?.data || []) as unknown as MusicFreeArtist[]
        const mapped = artistData.map((a) => ({
          id: String(a.id || a.singerMID || ''),
          name: a.name || '',
          avatar: a.avatar,
          worksNum: a.worksNum,
          extra: a,
        }))
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] searchArtists error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async searchAlbums(query: string, page: number = 1) {
      if (!supportedTypes.includes('album')) {
        return { data: [], isEnd: true }
      }
      try {
        const result = await native.search(query, page, 'album')
        const mapped = (result?.data || []).map((a: MusicFreeAlbum) => ({
          id: String(a.id || a.albumMID || ''),
          title: a.title || '',
          artist: a.artist,
          coverUrl: a.artwork,
          date: a.date,
          description: a.description,
          extra: a,
        }))
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] searchAlbums error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async searchPlaylists(query: string, page: number = 1) {
      if (!supportedTypes.includes('sheet')) {
        return { data: [], isEnd: true }
      }
      try {
        const result = await native.search(query, page, 'sheet')
        const mapped = (result?.data || []).map((p: MusicFreePlaylist) => ({
          id: String(p.id || ''),
          title: p.title || '',
          artist: p.artist,
          coverUrl: p.artwork,
          playCount: p.playCount,
          worksNum: p.worksNums,
          description: p.description,
          extra: p,
        }))
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] searchPlaylists error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async getArtistSongs(artist, page = 1) {
      if (!native.getArtistWorks) {
        return { data: [], isEnd: true }
      }
      try {
        const result = await native.getArtistWorks(artist.extra as MusicFreeArtist, page, 'music')
        const mapped = (result?.data || []).map(mapTrack)
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] getArtistSongs error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async getAlbumSongs(album) {
      if (!native.getAlbumInfo) {
        return []
      }
      try {
        const result = await native.getAlbumInfo(album.extra as MusicFreeAlbum)
        return (result?.musicList || []).map(mapTrack)
      } catch (error) {
        console.error('[MusicFree Plugin] getAlbumSongs error:', error)
        return []
      }
    },
    
    async getPlaylistSongs(playlist) {
      if (!native.getMusicSheetInfo) {
        return []
      }
      try {
        const result = await native.getMusicSheetInfo(playlist.extra as MusicFreePlaylist, 1)
        return (result?.musicList || []).map(mapTrack)
      } catch (error) {
        console.error('[MusicFree Plugin] getPlaylistSongs error:', error)
        return []
      }
    },
    
    async resolveStream(track) {
      if (track.streamUrl) {
        return { url: track.streamUrl }
      }
      
      if (native.getMediaSource && track.extra) {
        const qualities = ['128', 'standard', '320', 'high', 'low', 'super']
        for (const quality of qualities) {
          try {
            const result = await native.getMediaSource(track.extra as MusicFreeTrack, quality)
            console.log('[歌词调试] pluginHost resolveStream - getMediaSource 返回:', {
              url: result?.url,
              hasLrc: !!(result as any)?.lrc,
              lrcLength: (result as any)?.lrc?.length,
              hasData: !!(result as any)?.data,
              dataLrc: !!(result as any)?.data?.lrc,
              fullResult: result,
            })
            
            // 处理返回的数据结构：可能是 { url, lrc } 或 { data: { url, lrc } }
            let url: string | undefined
            let lrc: string | undefined
            
            if ((result as any)?.data) {
              // 如果返回的是 { data: { url, lrc, ... } } 格式
              const data = (result as any).data
              url = data.url
              lrc = data.lrc
            } else {
              // 如果返回的是 { url, lrc, ... } 格式
              url = result?.url
              lrc = (result as any)?.lrc
            }
            
            if (url) {
              // 如果返回的数据中包含 lrc，需要保存到 track.extra 中
              // 但是这里无法直接更新 track，所以返回一个包含 lrc 的对象
              if (lrc) {
                console.log('[歌词调试] pluginHost 找到歌词，长度:', lrc.length)
                // 返回包含 lrc 的对象，让调用者知道有歌词数据
                return { 
                  url: url,
                  _lrc: lrc, // 使用 _lrc 作为临时字段
                } as any
              }
              return { url: url }
            }
          } catch {
            continue
          }
        }
      }
      
      throw new Error('无法获取播放地址')
    },
  }
}

const getGlobalHost = (): PluginHostApi | null => {
  if (typeof globalThis === 'undefined') return null
  return (
    (globalThis as typeof globalThis & {
      MusicFreeH5?: PluginHostApi | null
    }).MusicFreeH5 ?? null
  )
}

const setGlobalHost = (value: PluginHostApi | null) => {
  if (typeof globalThis === 'undefined') return
  ;(globalThis as typeof globalThis & {
    MusicFreeH5?: PluginHostApi | null
  }).MusicFreeH5 = value ?? undefined
}

const downloadPluginCode = async (descriptor: InstalledPlugin) => {
  const sources = [descriptor.url, ...(descriptor.mirrors ?? [])]
  const errors: string[] = []
  for (const source of sources) {
    try {
      const code = await fetchTextWithFallback(source, {
        cache: 'no-store',
      })
      return code
    } catch (error) {
      errors.push(
        `[${source}] ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }
  throw new Error(errors.join('\n'))
}

// 插件代码缓存
const PLUGIN_CODE_CACHE_KEY = 'musicfree.plugin.code.cache'

interface PluginCodeCache {
  [pluginId: string]: {
    code: string
    url: string
    version?: string
    timestamp: number
  }
}

const loadPluginCodeCache = (): PluginCodeCache => {
  try {
    const raw = localStorage.getItem(PLUGIN_CODE_CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const savePluginCodeCache = (cache: PluginCodeCache) => {
  try {
    localStorage.setItem(PLUGIN_CODE_CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('[Cache] 保存插件代码缓存失败:', e)
  }
}

const getCachedPluginCode = (pluginId: string, url: string, version?: string): string | null => {
  const cache = loadPluginCodeCache()
  const cached = cache[pluginId]
  if (!cached) return null
  
  // 如果 URL 或版本变了，缓存失效
  if (cached.url !== url) return null
  if (version && cached.version && cached.version !== version) return null
  
  console.log('[Cache] 使用缓存的插件代码:', pluginId)
  return cached.code
}

const setCachedPluginCode = (pluginId: string, url: string, code: string, version?: string) => {
  const cache = loadPluginCodeCache()
  cache[pluginId] = {
    code,
    url,
    version,
    timestamp: Date.now(),
  }
  savePluginCodeCache(cache)
  console.log('[Cache] 缓存插件代码:', pluginId)
}

export const loadPluginInstance = async (
  descriptor: InstalledPlugin,
): Promise<MusicPlugin> => {
  // 优先从缓存加载
  const cachedCode = getCachedPluginCode(descriptor.id, descriptor.url, descriptor.version)
  
  if (cachedCode) {
    return executePluginCode(cachedCode, descriptor)
  }
  
  // 从网络下载
  const code = await downloadPluginCode(descriptor)
  
  // 缓存代码
  setCachedPluginCode(descriptor.id, descriptor.url, code, descriptor.version)
  
  return executePluginCode(code, descriptor)
}

// 强制刷新插件（忽略缓存）
export const forceLoadPluginInstance = async (
  descriptor: InstalledPlugin,
): Promise<MusicPlugin> => {
  // 直接从网络下载
  const code = await downloadPluginCode(descriptor)
  
  // 更新缓存
  setCachedPluginCode(descriptor.id, descriptor.url, code, descriptor.version)
  
  return executePluginCode(code, descriptor)
}

export const buildLoadedState = (plugins: InstalledPlugin[]): LoadedPlugin[] =>
  plugins.map((meta) => ({
    meta,
    status: 'idle',
  }))

declare global {
  var MusicFreeH5: PluginHostApi | null | undefined
}


