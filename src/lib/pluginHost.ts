import type {
  InstalledPlugin,
  LoadedPlugin,
  MusicPlugin,
  PluginDescriptor,
  PluginFeed,
  PluginTrack,
  PluginPlaylist,
  PluginRecommendTag,
} from '../types/plugin'
import CryptoJS from 'crypto-js'
import bigInt from 'big-integer'

const STORAGE_KEY = 'musicfree.h5.plugins'
// 默认使用小秋音乐作为首选音乐源
export const DEFAULT_PLUGIN_FEED = 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoqiu.js'

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

// 检测是否为开发环境
const isDevelopment = () => {
  // 通过检查 hostname 判断是否为开发环境（localhost 或 127.0.0.1）
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.')
  }
  return false
}

// 获取本地代理 URL（如果匹配 Vite 配置中的代理规则）
const getLocalProxyUrl = (url: string): string | null => {
  if (!isDevelopment()) return null
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const pathname = urlObj.pathname
    
    // 匹配 Vite 配置中的代理规则
    if (hostname === 'music.haitangw.net') {
      return `/proxy/haitangm${pathname}${urlObj.search}`
    }
    if (hostname === 'musicapi.haitangw.net') {
      return `/proxy/haitang${pathname}${urlObj.search}`
    }
    if (hostname === 'raw.githubusercontent.com') {
      return `/proxy/github${pathname}${urlObj.search}`
    }
    if (hostname === 'gitee.com') {
      return `/proxy/gitee${pathname}${urlObj.search}`
    }
    // 可以添加更多匹配规则...
  } catch {
    // URL 解析失败，返回 null
  }
  
  return null
}

// HTTPS URL 的 CORS 代理（按优先级排序）
const httpsProxyCandidates: Array<(url: string) => string> = [
  (url) => url, // 先尝试直接请求
  // 优先使用 codetabs（相对稳定）
  (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  // allorigins 备用（有时不稳定）
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // 其他备用代理
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://cors.isomorphic-git.org/${url}`,
]

// HTTP URL 的 CORS 代理（需要支持非 HTTPS 源）
const httpProxyCandidates: Array<(url: string) => string> = [
  // codetabs 支持 HTTP（注意：需要尾部斜杠）
  (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  // allorigins 支持 HTTP
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  // 直接请求（某些情况下可能成功）
  (url) => url,
]

const defaultBuilders = (url: string) => {
  if (!isRemoteUrl(url)) return [(current: string) => current]
  
  // 在开发环境中，优先使用本地代理
  const localProxy = getLocalProxyUrl(url)
  if (localProxy) {
    const candidates = isHttps(url) ? httpsProxyCandidates : httpProxyCandidates
    return [(_: string) => localProxy, ...candidates]
  }
  
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

const extractPluginField = (code: string, field: string): string | undefined => {
  // 先尝试简单的正则匹配（直接字符串值）
  const pattern = new RegExp(`${field}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`)
  const match = code.match(pattern)
  if (match?.[1]) {
    return match[1]
  }
  
  // 尝试匹配 module['exports'] 或 module.exports 中的字段（直接字符串值）
  const modulePattern1 = new RegExp(
    `module\\s*\\[?['"]exports['"]?\\]?\\s*=\\s*\\{[^}]*${field}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`,
    's'
  )
  const moduleMatch1 = code.match(modulePattern1)
  if (moduleMatch1?.[1]) {
    return moduleMatch1[1]
  }
  
  // 尝试匹配混淆后的代码结构：module['exports']={'platform':_0x...,...}
  // 这种情况下，值是通过函数调用生成的，需要执行代码才能获取
  // 但我们可以尝试匹配整个 module.exports 对象定义
  const modulePattern2 = new RegExp(
    `module\\s*\\[?['"]exports['"]?\\]?\\s*=\\s*\\{([^}]+)\\}`,
    's'
  )
  const moduleMatch2 = code.match(modulePattern2)
  if (moduleMatch2?.[1]) {
    // 在对象内容中查找字段
    const fieldPattern = new RegExp(`${field}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`)
    const fieldMatch = moduleMatch2[1].match(fieldPattern)
    if (fieldMatch?.[1]) {
      return fieldMatch[1]
    }
  }
  
  return undefined
}

const buildSinglePluginDescriptor = (url: string, code?: string): PluginDescriptor => {
  const fallbackName = decodeURIComponent(
    url.split('/').pop()?.split('?')[0]?.replace(/\.\w+$/, '') || '自定义插件',
  )
  
  let name = fallbackName
  let version: string | undefined
  let description: string | undefined
  
  if (code) {
    // 尝试执行代码来获取 module.exports 中的字段
    try {
      // 创建一个安全的执行环境
      const moduleExports: any = {}
      const moduleObj: any = { exports: moduleExports }
      
      // 提供必要的 require shim
      const requireShim = (_moduleName: string) => {
        // 返回空对象，避免执行错误
        return {}
      }
      
      // 执行代码（在 try-catch 中，避免错误影响）
      try {
        // 使用 Function 构造函数来执行代码，避免污染全局作用域
        // 注意：混淆的代码可能会访问全局变量，所以我们需要提供一些基本的全局变量
        const func = new Function(
          'module',
          'exports',
          'require',
          code
        )
        
        // 执行函数
        func(moduleObj, moduleExports, requireShim)
        
        // 检查 module.exports 是否被设置（可能是通过 module['exports'] 设置的）
        // 注意：混淆代码可能使用 module['exports'] 来设置，所以需要检查 moduleObj.exports
        const finalExports = moduleObj.exports || moduleExports
        
        // 从 module.exports 中提取字段
        if (finalExports && typeof finalExports === 'object') {
          console.log('[PluginHost] 从 module.exports 提取字段:', {
            platform: finalExports.platform,
            name: finalExports.name,
            version: finalExports.version,
            description: finalExports.description,
            allKeys: Object.keys(finalExports),
          })
          
          if (finalExports.platform) {
            name = String(finalExports.platform)
            console.log('[PluginHost] 找到 platform:', name)
          } else if (finalExports.name) {
            name = String(finalExports.name)
            console.log('[PluginHost] 找到 name:', name)
          }
          
          if (finalExports.version) {
            version = String(finalExports.version)
          }
          
          if (finalExports.description) {
            description = String(finalExports.description)
          }
        } else {
          console.warn('[PluginHost] module.exports 不是对象:', finalExports)
        }
        
        // 如果执行成功但没有获取到值，尝试正则表达式作为补充
        if (name === fallbackName) {
          const extractedName = extractPluginField(code, 'platform') || extractPluginField(code, 'name')
          if (extractedName) {
            name = extractedName
            console.log('[PluginHost] 通过正则表达式提取到名称:', name)
          }
        }
      } catch (execError: any) {
        // 执行失败，回退到正则表达式提取
        console.warn('[PluginHost] 执行插件代码失败，使用正则表达式提取:', execError?.message || execError)
        const extractedName = extractPluginField(code, 'platform') || extractPluginField(code, 'name')
        if (extractedName) {
          name = extractedName
        }
        version = extractPluginField(code, 'version')
        description = extractPluginField(code, 'description')
      }
    } catch (error: any) {
      // 如果执行失败，使用正则表达式提取
      console.warn('[PluginHost] 提取插件信息失败:', error?.message || error)
      const extractedName = extractPluginField(code, 'platform') || extractPluginField(code, 'name')
      if (extractedName) {
        name = extractedName
      }
      version = extractPluginField(code, 'version')
      description = extractPluginField(code, 'description')
    }
  }

  return {
    name,
    url,
    version,
    description,
  }
}

export const fetchPluginFeed = async (feedUrl: string): Promise<PluginFeed> => {
  try {
    const rawText = await fetchTextWithFallback(feedUrl, {
      cache: 'no-store',
    })

    try {
      const json = JSON.parse(rawText) as PluginFeed
      if (json?.plugins?.length) {
        return { ...json, source: 'remote' }
      }
    } catch {
      // 不是标准 JSON，继续尝试按插件脚本解析
    }

    const descriptor = buildSinglePluginDescriptor(feedUrl, rawText)
    return {
      desc: `自定义插件：${descriptor.name}`,
      plugins: [descriptor],
      source: 'remote',
    }
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

// URL 重写规则 - 将外部 URL 映射到本地代理
// 只保留支持的音乐源所需的代理：
// - 小秋/小蜗/小芸/小枸音乐 (使用 JSDelivr/GitHub，走 CORS 代理或直连)
// 支持的音乐源代理配置：
// - 小秋音乐 (QQ 音乐 API)
// - 小蜗音乐 (酷我音乐 API)
// - 小芸音乐 (网易云音乐 API)
// - 小枸音乐 (酷狗音乐 API)
// - bilibili (B站 API)
// - 元力QQ (QQ 音乐 API + 海棠音乐 API)
const urlRewriteRules: Array<{ pattern: RegExp; replace: string }> = [
  // ============ QQ 音乐 API (小秋、元力QQ) ============
  { pattern: /^https?:\/\/c\.y\.qq\.com\//, replace: '/api/proxy/qqmusic_c/' },
  { pattern: /^https?:\/\/u\.y\.qq\.com\//, replace: '/api/proxy/qqmusic_u/' },
  { pattern: /^https?:\/\/i\.y\.qq\.com\//, replace: '/api/proxy/qqmusic_i/' },
  
  // ============ 酷我音乐 API (小蜗、网易音乐灰色歌曲) ============
  { pattern: /^https?:\/\/search\.kuwo\.cn\//, replace: '/api/proxy/kuwo_search/' },
  { pattern: /^https?:\/\/m\.kuwo\.cn\//, replace: '/api/proxy/kuwo_m/' },
  { pattern: /^https?:\/\/wapi\.kuwo\.cn\//, replace: '/api/proxy/kuwo_wapi/' },
  { pattern: /^https?:\/\/kbangserver\.kuwo\.cn\//, replace: '/api/proxy/kuwo_kbang/' },
  { pattern: /^https?:\/\/nplserver\.kuwo\.cn\//, replace: '/api/proxy/kuwo_npl/' },
  { pattern: /^https?:\/\/mobileinterfaces\.kuwo\.cn\//, replace: '/api/proxy/kuwo_mobile/' },
  { pattern: /^https?:\/\/nmobi\.kuwo\.cn\//, replace: '/api/proxy/kuwo_nmobi/' },
  
  // ============ 网易云音乐 API (小芸、网易音乐) ============
  { pattern: /^https?:\/\/interface3\.music\.163\.com\//, replace: '/api/proxy/netease_interface3/' },
  { pattern: /^https?:\/\/interface\.music\.163\.com\//, replace: '/api/proxy/netease_interface/' },
  { pattern: /^https?:\/\/y\.music\.163\.com\//, replace: '/api/proxy/netease_y/' },
  { pattern: /^https?:\/\/music\.163\.com\//, replace: '/api/proxy/netease/' },
  
  // ============ 酷狗音乐 API (小枸) ============
  { pattern: /^https?:\/\/msearch\.kugou\.com\//, replace: '/api/proxy/kugou_search/' },
  { pattern: /^https?:\/\/mobilecdn\.kugou\.com\//, replace: '/api/proxy/kugou_mobilecdn/' },
  { pattern: /^https?:\/\/mobilecdnbj\.kugou\.com\//, replace: '/api/proxy/kugou_mobilecdnbj/' },
  { pattern: /^https?:\/\/lyrics\.kugou\.com\//, replace: '/api/proxy/kugou_lyrics/' },
  { pattern: /^https?:\/\/t\.kugou\.com\//, replace: '/api/proxy/kugou_t/' },
  { pattern: /^https?:\/\/www2\.kugou\.kugou\.com\//, replace: '/api/proxy/kugou_www2/' },
  { pattern: /^https?:\/\/gateway\.kugou\.com\//, replace: '/api/proxy/kugou_gateway/' },
  { pattern: /^https?:\/\/songsearch\.kugou\.com\//, replace: '/api/proxy/kugou_songsearch/' },
  
  // ============ B站 ============
  { pattern: /^https?:\/\/api\.bilibili\.com\//, replace: '/api/proxy/biliapi/' },
  { pattern: /^https?:\/\/www\.bilibili\.com\//, replace: '/api/proxy/bili/' },
  
  // ============ 海棠音乐 (元力QQ) ============
  { pattern: /^https?:\/\/musicapi\.haitangw\.net\//, replace: '/api/proxy/haitang/' },
  { pattern: /^https?:\/\/music\.haitangw\.net\//, replace: '/api/proxy/haitangm/' },
  
  // ============ LX Music API (获取播放URL) ============
  { pattern: /^https?:\/\/lxmusicapi\.onrender\.com\//, replace: '/api/proxy/lxmusic/' },
  
  // ============ ikun 音源 API ============
  { pattern: /^https?:\/\/api\.ikunshare\.com\//, replace: '/api/proxy/ikun/' },
  
  // ============ 海棠音乐 (haitangw.cc) ============
  { pattern: /^https?:\/\/music\.haitangw\.cc\//, replace: '/api/proxy/haitangcc/' },
  
  // ============ 段兄音乐 API (元力WY) ============
  { pattern: /^https?:\/\/share\.duanx\.cn\//, replace: '/api/proxy/duanx/' },
  
  // ============ 咪咕音乐 API ============
  { pattern: /^https?:\/\/m\.music\.migu\.cn\//, replace: '/api/proxy/migu_m/' },
  { pattern: /^https?:\/\/music\.migu\.cn\//, replace: '/api/proxy/migu/' },
  { pattern: /^https?:\/\/cdnmusic\.migu\.cn\//, replace: '/api/proxy/migu_cdn/' },
  
  // ============ 插件托管 (kstore.vip) ============
  { pattern: /^https?:\/\/13413\.kstore\.vip\//, replace: '/api/proxy/kstore/' },
  
  // ============ 插件加载 ============
  { pattern: /^https?:\/\/gitee\.com\//, replace: '/api/proxy/gitee/' },
  { pattern: /^https?:\/\/raw\.githubusercontent\.com\//, replace: '/api/proxy/github/' },
  { pattern: /^https?:\/\/fastly\.jsdelivr\.net\//, replace: '/api/proxy/jsdelivr/' },
]

// 重写 URL 使用代理（开发环境使用本地代理，生产环境使用 API 代理）
const rewriteUrl = (url: string): string | null => {
  for (const rule of urlRewriteRules) {
    if (rule.pattern.test(url)) {
      return url.replace(rule.pattern, rule.replace)
    }
  }
  return null
}

// 从重写的 URL 中提取原始 URL（用于回退）
const extractOriginalUrl = (rewrittenUrl: string): string | null => {
  // 匹配 /api/proxy/[type]/... 格式
  const match = rewrittenUrl.match(/^\/api\/proxy\/([^/]+)\/(.+)$/)
  if (!match) {
    // 尝试匹配带查询参数的格式
    const matchWithQuery = rewrittenUrl.match(/^\/api\/proxy\/([^/]+)\/(.+)\?(.+)$/)
    if (matchWithQuery) {
      const [, proxyType, path, query] = matchWithQuery
      return extractOriginalUrlByType(proxyType, path, query)
    }
    return null
  }
  
  const [, proxyType, pathWithQuery] = match
  const [path, query] = pathWithQuery.includes('?') 
    ? pathWithQuery.split('?', 2)
    : [pathWithQuery, '']
  
  return extractOriginalUrlByType(proxyType, path, query)
}

// 根据代理类型提取原始 URL
// 支持的音乐源代理映射
const extractOriginalUrlByType = (proxyType: string, path: string, query: string): string | null => {
  const proxyTargets: Record<string, string> = {
    // QQ 音乐 (小秋、元力QQ)
    qqmusic_c: 'https://c.y.qq.com',
    qqmusic_u: 'https://u.y.qq.com',
    qqmusic_i: 'http://i.y.qq.com',
    // 酷我音乐 (小蜗、网易音乐灰色歌曲)
    kuwo_search: 'http://search.kuwo.cn',
    kuwo_m: 'http://m.kuwo.cn',
    kuwo_wapi: 'http://wapi.kuwo.cn',
    kuwo_kbang: 'http://kbangserver.kuwo.cn',
    kuwo_npl: 'http://nplserver.kuwo.cn',
    kuwo_mobile: 'http://mobileinterfaces.kuwo.cn',
    kuwo_nmobi: 'http://nmobi.kuwo.cn',
    // 网易云音乐 (小芸、网易音乐)
    netease: 'https://music.163.com',
    netease_interface: 'https://interface.music.163.com',
    netease_interface3: 'https://interface3.music.163.com',
    netease_y: 'https://y.music.163.com',
    // 酷狗音乐 (小枸)
    kugou_search: 'http://msearch.kugou.com',
    kugou_mobilecdn: 'http://mobilecdn.kugou.com',
    kugou_mobilecdnbj: 'http://mobilecdnbj.kugou.com',
    kugou_lyrics: 'http://lyrics.kugou.com',
    kugou_t: 'http://t.kugou.com',
    kugou_www2: 'http://www2.kugou.kugou.com',
    kugou_gateway: 'https://gateway.kugou.com',
    kugou_songsearch: 'https://songsearch.kugou.com',
    // B站
    biliapi: 'https://api.bilibili.com',
    bili: 'https://www.bilibili.com',
    // 海棠音乐 (元力QQ)
    haitang: 'http://musicapi.haitangw.net',
    haitangm: 'http://music.haitangw.net',
    // LX Music API (获取播放URL)
    lxmusic: 'https://lxmusicapi.onrender.com',
    // ikun 音源 API
    ikun: 'https://api.ikunshare.com',
    // 海棠音乐 (haitangw.cc)
    haitangcc: 'https://music.haitangw.cc',
    // 段兄音乐 API (元力WY)
    duanx: 'https://share.duanx.cn',
    // 咪咕音乐
    migu_m: 'https://m.music.migu.cn',
    migu: 'https://music.migu.cn',
    migu_cdn: 'https://cdnmusic.migu.cn',
    // 插件托管
    kstore: 'https://13413.kstore.vip',
    // 插件加载
    gitee: 'https://gitee.com',
    github: 'https://raw.githubusercontent.com',
    jsdelivr: 'https://fastly.jsdelivr.net',
  }
  
  const target = proxyTargets[proxyType]
  if (!target) return null
  
  const queryString = query ? `?${query}` : ''
  return `${target}/${path}${queryString}`
}

/**
 * 代理媒体 URL（用于 audio/video 元素）
 * 将外部 URL 转换为本地代理 URL
 * 注意：媒体资源（图片、音频）一般不需要代理，直接访问即可
 */
export const proxyMediaUrl = (url: string): string => {
  if (!url) return url
  // 直接返回原 URL，不做任何代理处理
  return url
}

/**
 * 检测是否是需要 MSE 播放的音频格式（如 B站的 m4s 格式）
 */
export const isMSERequiredAudio = (url: string): boolean => {
  if (!url) return false
  // B站 DASH 音频流（m4s 格式）
  if (url.includes('.m4s')) {
    return true
  }
  return false
}

// 创建带代理的 fetch 函数
const createProxiedFetch = (): typeof fetch => {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    
    if (!isRemoteUrl(url)) {
      return fetch(input, init)
    }
    
    // 首先尝试使用代理（开发环境使用本地代理，生产环境使用 API 代理）
    const rewrittenUrl = rewriteUrl(url)
    if (rewrittenUrl) {
      try {
        if (isDevelopment()) {
          console.log('[Proxy] 本地代理:', url.substring(0, 60), '->', rewrittenUrl.substring(0, 40))
        } else {
          console.log('[Proxy] API 代理:', url.substring(0, 60), '->', rewrittenUrl.substring(0, 40))
        }
        const response = await fetch(rewrittenUrl, init)
        if (response.ok) {
          // 检查响应 Content-Type，如果是 HTML 说明 serverless function 没有工作
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('text/html')) {
            console.warn('[Proxy] API 代理返回 HTML (Content-Type: text/html)，说明 serverless function 未工作，回退到 CORS 代理')
            // 不返回 response，继续执行下面的 CORS 代理代码
            // 注意：这里不能读取 response.text()，因为 Response 只能读取一次
          } else {
            // 返回有效的响应
            return response
          }
        } else {
          console.warn('[Proxy] 代理返回:', response.status)
        }
      } catch (e) {
        console.warn('[Proxy] 代理异常:', e)
        // 如果代理失败，继续尝试 CORS 代理
      }
    }
    
    // 尝试 CORS 代理
    const method = init?.method?.toUpperCase() || 'GET'
    
    // 对于 GET 请求，优先尝试代理
    if (method === 'GET') {
      // 优先尝试 codetabs（相对稳定）
      try {
        const codetabsUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`
        console.log('[Proxy] codetabs:', url.substring(0, 50))
        const response = await fetch(codetabsUrl, {
          signal: init?.signal,
        })
        if (response.ok) {
          console.log('[Proxy] codetabs 成功')
          return response
        }
        console.warn('[Proxy] codetabs 返回:', response.status)
      } catch (e) {
        console.warn('[Proxy] codetabs 异常:', e)
      }
      
      // 尝试 allorigins 代理（备用）
      try {
        const alloriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
        console.log('[Proxy] allorigins:', url.substring(0, 50))
        const response = await fetch(alloriginsUrl, {
          signal: init?.signal,
        })
        if (response.ok) {
          console.log('[Proxy] allorigins 成功')
          return response
        }
        console.warn('[Proxy] allorigins 返回:', response.status)
      } catch (e) {
        console.warn('[Proxy] allorigins 异常:', e)
      }
      
      // 尝试其他 CORS 代理
      const candidates = isHttps(url) ? httpsProxyCandidates : httpProxyCandidates
      for (const builder of candidates) {
        const proxiedUrl = builder(url)
        if (proxiedUrl === url) continue // 跳过直接请求（最后尝试）
        try {
          console.log('[Proxy] 尝试代理:', proxiedUrl.substring(0, 60))
          const response = await fetch(proxiedUrl, {
            signal: init?.signal,
          })
          if (response.ok) {
            console.log('[Proxy] 代理成功')
            return response
          }
        } catch (e) {
          console.warn('[Proxy] 代理异常:', e)
          continue
        }
      }
    } else {
      // 对于 POST/PUT/DELETE 等非 GET 请求
      // 大部分公共 CORS 代理不支持 POST，但我们可以尝试一些方法
      console.log('[Proxy] 非 GET 请求 (', method, ')，尝试代理')
      
      // 尝试 codetabs（可能支持 POST）
      try {
        const codetabsUrl = `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`
        console.log('[Proxy] codetabs POST:', url.substring(0, 50))
        const response = await fetch(codetabsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Target-URL': url,
            ...(init?.headers as Record<string, string> || {}),
          },
          body: init?.body,
          signal: init?.signal,
        })
        if (response.ok) {
          console.log('[Proxy] codetabs POST 成功')
          return response
        }
      } catch (e) {
        console.warn('[Proxy] codetabs POST 异常:', e)
      }
      
      console.warn('[Proxy] POST 请求无法通过 CORS 代理，将直接请求（可能 CORS 错误）')
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

// 歌词缓存：key 是歌曲 ID，value 是歌词文本（全局共享，用于在 axios 响应和 resolveStream 之间传递歌词）
const lyricCache = new Map<string, string>()

// 创建 axios 兼容的模拟实现
const createAxiosShim = (_proxiedFetch: typeof fetch) => {
  const processResponse = async (response: Response, requestUrl?: string) => {
    const contentType = response.headers.get('content-type') || ''
    let data: unknown
    
    const text = await response.text()
    
    // 检查是否是 HTML 错误页面
    if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error('[axios] 收到 HTML 错误页面:', requestUrl?.substring(0, 80), '状态码:', response.status, '内容预览:', text.substring(0, 200))
      throw new Error(`Received HTML error page instead of JSON. Status: ${response.status}, URL: ${requestUrl}`)
    }
    
    // 某些插件代码（如 importMusicSheet）期望原始 JSONP 字符串，可以调用 .replace() 方法
    // 对于这些 API，我们需要保留原始 JSONP 字符串
    const needsRawJsonp = requestUrl && (
      requestUrl.includes('fcg_ucc_getcdinfo_byids_cp.fcg') || // importMusicSheet 需要原始 JSONP
      requestUrl.includes('fcg_get_diss_by_tag.fcg') // getRecommendSheetsByTag 可能需要原始 JSONP
    )
    
    if (needsRawJsonp) {
      // 对于需要原始 JSONP 的 API，保留原始文本
      console.log('[axios] 保留原始 JSONP 文本用于插件处理:', requestUrl?.substring(0, 80))
      data = text
    } else {
      // 先尝试解析 JSONP 响应
      let jsonpMatch = text.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(\s*({[\s\S]*})\s*\)\s*;?\s*$/)
      if (!jsonpMatch) {
        // 尝试匹配常见的 JSONP callback 函数名
        jsonpMatch = text.match(/(?:MusicJsonCallback|jsonpGetTagListCallback|jsonpGetPlaylistCallback|jsonCallback)\s*\(\s*({[\s\S]*})\s*\)/s)
      }
      
      if (jsonpMatch) {
        try {
          const jsonStr = jsonpMatch[1]
          data = JSON.parse(jsonStr)
          
          // 检查是否是 invalid referer 错误（code: 0, subcode: 1）
          if (typeof data === 'object' && data !== null && 'code' in data && 'subcode' in data && 'msg' in data) {
            const errorData = data as { code: number; subcode: number; msg: string }
            if (errorData.code === 0 && errorData.subcode === 1 && errorData.msg.includes('invalid referer')) {
              console.error('[axios] 检测到 invalid referer 错误，CORS 代理无法传递 Referer header:', requestUrl?.substring(0, 80))
              // 创建一个特殊错误，标记需要 Referer
              const error = new Error(`Invalid referer error: CORS proxy cannot forward Referer header. URL: ${requestUrl}`) as Error & { needsReferer?: boolean; originalUrl?: string }
              error.needsReferer = true
              error.originalUrl = requestUrl
              throw error
            }
          }
          
          console.log('[axios] 检测到 JSONP 响应，已解析:', requestUrl?.substring(0, 80), '数据预览:', JSON.stringify(data).substring(0, 200))
        } catch (e) {
          if (e instanceof Error && (e.message.includes('Invalid referer') || (e as Error & { needsReferer?: boolean }).needsReferer)) {
            throw e // 重新抛出 invalid referer 错误
          }
          console.warn('[axios] JSONP 解析失败:', e, '原始文本前500字符:', text.substring(0, 500))
          // 如果 JSONP 解析失败，尝试直接解析 JSON
          try {
            data = JSON.parse(text)
          } catch (e2) {
            data = text
          }
        }
      } else if (text.includes('"code":101') || text.includes('"code":-2') || text.includes('parameters wrong') || text.includes('parameter failed')) {
        console.warn('[axios] 检测到 API 错误响应，可能需要 Referer header:', text.substring(0, 200))
        // 返回错误对象，让调用方处理
        try {
          const errorData = JSON.parse(text.replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(|\)\s*;?\s*$/g, ''))
          data = errorData
        } catch {
          data = { code: 101, message: 'parameters wrong', rawText: text }
        }
      } else if (contentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
        try {
          data = JSON.parse(text)
          // 检查是否是 invalid referer 错误
          if (typeof data === 'object' && data !== null && 'code' in data && 'subcode' in data && 'msg' in data) {
            const errorData = data as { code: number; subcode: number; msg: string }
            if (errorData.code === 0 && errorData.subcode === 1 && errorData.msg.includes('invalid referer')) {
              console.error('[axios] 检测到 invalid referer 错误（JSON格式）:', requestUrl?.substring(0, 80))
              const error = new Error(`Invalid referer error: CORS proxy cannot forward Referer header. URL: ${requestUrl}`) as Error & { needsReferer?: boolean; originalUrl?: string }
              error.needsReferer = true
              error.originalUrl = requestUrl
              throw error
            }
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes('Invalid referer') || (e as Error & { needsReferer?: boolean }).needsReferer)) {
            throw e
          }
          data = text
        }
      } else {
        data = text
      }
    }
    
    // 拦截 qq_song_kw.php 请求，提取歌词
    if (requestUrl && (requestUrl.includes('qq_song_kw.php') || requestUrl.includes('qq_song'))) {
      console.log('[Lyrics] 检测到 qq_song_kw.php 请求，检查响应数据')
      console.log('[Lyrics] 请求 URL:', requestUrl)
      console.log('[Lyrics] 响应数据:', JSON.stringify(data).substring(0, 500))
      
      // 从 URL 中提取 id 参数
      let urlId: string | undefined
      try {
        const urlObj = new URL(requestUrl, 'http://dummy.com')
        urlId = urlObj.searchParams.get('id') || undefined
      } catch (e) {
        const match = requestUrl.match(/[?&]id=([^&]+)/)
        if (match) {
          urlId = match[1]
        }
      }
      
      // 检查响应数据格式
      if (data && typeof data === 'object' && 'data' in data) {
        const responseData = data as { 
          code?: number
          msg?: string
          data?: { 
            lrc?: string
            rid?: string
            url?: string
            [key: string]: unknown 
          } 
        }
        
        if (responseData.data?.lrc && typeof responseData.data.lrc === 'string') {
          // 优先使用响应中的 rid，如果没有则使用 URL 中的 id
          const trackId = responseData.data.rid || urlId || ''
          if (trackId) {
            console.log('[Lyrics] ✓ 从 qq_song_kw.php 响应中提取到歌词，trackId:', trackId, '歌词长度:', responseData.data.lrc.length)
            // 使用多个 key 保存歌词，确保能找到
            lyricCache.set(String(trackId), responseData.data.lrc)
            if (urlId && urlId !== trackId) {
              lyricCache.set(String(urlId), responseData.data.lrc)
            }
            // 也保存 songmid（如果存在）
            if (responseData.data.songmid) {
              lyricCache.set(String(responseData.data.songmid), responseData.data.lrc)
            }
          }
        } else {
          console.log('[Lyrics] 响应中没有 lrc 字段或 lrc 不是字符串')
        }
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
    
    // 修正部分公共音源在 quality 映射缺失时生成的 /undefined 请求
    if (/\/url\/(tx|wy)\/[^/]+\/undefined/.test(url)) {
      const fixedUrl = url.replace(/(\/url\/(tx|wy)\/[^/]+)\/undefined/, '$1/320k')
      console.warn('[axios] 质量参数缺失，自动改写为 320k:', url, '->', fixedUrl)
      url = fixedUrl
    }
    
    let method = config.method?.toUpperCase() || 'GET'
    
    // 记录原始请求
    debugLog('request', `[axios] ${method} ${url}`, { 
      originalUrl: url,
      params: config.params,
      hasBody: !!config.data 
    })
    
    // 对于 POST 请求到 musicu.fcg，尝试将 body 中的 data 参数转换为 URL 参数（如果 API 支持）
    // QQ 音乐的 musicu.fcg API 支持通过 URL 参数传递 data
    if (method === 'POST' && url.includes('musicu.fcg')) {
      console.log('[axios] 检测到 POST 请求到 musicu.fcg, data 类型:', typeof config.data, 'data 值:', config.data ? (typeof config.data === 'string' ? config.data.substring(0, 50) : JSON.stringify(config.data).substring(0, 50)) : 'null')
      
      if (config.data) {
        let dataString: string | undefined
        // 如果 data 是字符串，直接使用
        if (typeof config.data === 'string') {
          dataString = config.data
        } 
        // 如果 data 是对象，尝试转换为 JSON 字符串
        else if (typeof config.data === 'object') {
          try {
            dataString = JSON.stringify(config.data)
          } catch (e) {
            console.warn('[axios] 无法序列化 data:', e)
          }
        }
        
        if (dataString) {
          try {
            const urlObj = new URL(url)
            // 如果 URL 中已经有 data 参数，不转换
            if (!urlObj.searchParams.has('data')) {
              urlObj.searchParams.set('data', dataString)
              url = urlObj.toString()
              console.log('[axios] 将 POST body 转换为 GET 参数:', url.substring(0, 150))
              // 将方法改为 GET
              method = 'GET'
              // 清除 body
              config.data = undefined
            } else {
              console.log('[axios] URL 中已有 data 参数，不转换')
            }
          } catch (e) {
            // URL 解析失败，继续使用 POST
            console.warn('[axios] POST 转 GET 失败:', e)
          }
        } else {
          console.log('[axios] data 无法转换为字符串，保持 POST')
        }
      } else {
        console.log('[axios] POST 请求没有 data，保持 POST')
      }
    }
    
    // 直接在这里做 URL 重写（开发环境使用本地代理，生产环境使用 API 代理）
    let finalUrl = url
    const rewritten = rewriteUrl(url)
    if (rewritten) {
      finalUrl = rewritten
      debugLog('info', `[axios] URL 重写: ${url} -> ${finalUrl}`)
      console.log('[axios] URL 重写:', url, '->', finalUrl)
    }
    
    const baseHeaders =
      config.headers instanceof Headers
        ? Object.fromEntries(config.headers.entries())
        : Array.isArray(config.headers)
          ? Object.fromEntries(config.headers)
          : { ...(config.headers || {}) }
    
    const cookieHeader = baseHeaders['Cookie'] || baseHeaders['cookie']
    if (cookieHeader) {
      baseHeaders['X-Forwarded-Cookie'] = cookieHeader
      delete baseHeaders['Cookie']
      delete baseHeaders['cookie']
    }
    
    // QQ 音乐 API 需要 Referer header，否则会返回错误
    // 如果请求的是 QQ 音乐 API 且没有设置 Referer，自动添加
    if ((finalUrl.includes('c.y.qq.com') || finalUrl.includes('u.y.qq.com') || finalUrl.includes('i.y.qq.com') || finalUrl.includes('y.qq.com')) && 
        !baseHeaders['Referer'] && !baseHeaders['referer']) {
      baseHeaders['Referer'] = 'https://y.qq.com'
      console.log('[axios] 自动添加 Referer header 用于 QQ 音乐 API')
    }
    
    const init: RequestInit = {
      method: method as RequestInit['method'],
      headers: baseHeaders,
    }
    
    // 网易 EAPI 需要指定国内 IP，否则会返回 -460（Cheating）
    if (finalUrl.startsWith('/api/proxy/neteasem/') || finalUrl.startsWith('/proxy/neteasem/')) {
      const headersRecord = init.headers as Record<string, string>
      if (!headersRecord['X-Real-IP']) {
        headersRecord['X-Real-IP'] = '118.88.88.88'
      }
    }
    
    // 只有在非 GET 请求且 data 未被清除时才设置 body
    if (config.data && method !== 'GET') {
      if (typeof config.data === 'string') {
        init.body = config.data
      } else {
        init.body = JSON.stringify(config.data)
        init.headers = { ...init.headers, 'Content-Type': 'application/json' }
      }
      debugLog('info', `[axios] 请求体: ${typeof config.data === 'string' ? config.data.substring(0, 200) : JSON.stringify(config.data).substring(0, 200)}...`)
    } else if (method === 'GET' && config.data) {
      // GET 请求不应该有 body，如果还有 data，说明转换可能有问题
      console.warn('[axios] GET 请求仍有 data，已清除:', config.data)
      config.data = undefined
    }
    
    console.log('[axios] 请求:', init.method, finalUrl)
    
    try {
      // 使用 proxiedFetch 而不是直接使用 fetch，确保通过 CORS 代理
      const response = await _proxiedFetch(finalUrl, init)
      
      // 如果请求的是 API 代理且返回 HTML，说明 serverless function 没有工作
      // 需要回退到原始 URL 并使用 CORS 代理
      if (finalUrl.startsWith('/api/proxy/')) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          console.warn('[axios] API 代理返回 HTML，回退到原始 URL 并使用 CORS 代理')
          // 提取原始 URL
          const originalUrl = extractOriginalUrl(finalUrl)
          if (originalUrl) {
            // 重新请求原始 URL，这次会使用 CORS 代理（因为 rewriteUrl 会返回 null，不会再次重写）
            console.log('[axios] 回退到原始 URL:', originalUrl)
            const retryResponse = await _proxiedFetch(originalUrl, init)
            const result = await processResponse(retryResponse, originalUrl)
            console.log('[axios] CORS 代理响应:', retryResponse.status)
            return result
          }
        }
      }
      
      const result = await processResponse(response, finalUrl)
      
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
      // 如果错误是 invalid referer 错误，说明 CORS 代理无法传递 Referer header
      // 这是公共 CORS 代理的限制，无法解决
      if (error instanceof Error && (error.message.includes('Invalid referer') || (error as Error & { needsReferer?: boolean }).needsReferer)) {
        console.error('[axios] Invalid referer 错误：公共 CORS 代理无法传递 Referer header，这是已知限制')
        // 尝试使用其他 CORS 代理（虽然它们也可能无法传递 Referer）
        if (finalUrl.startsWith('/api/proxy/')) {
          const originalUrl = extractOriginalUrl(finalUrl)
          if (originalUrl && originalUrl.includes('y.qq.com')) {
            console.warn('[axios] 尝试使用 allorigins 代理（虽然可能也无法传递 Referer）')
            try {
              const alloriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalUrl)}`
              const retryResponse = await fetch(alloriginsUrl, { signal: init?.signal })
              if (retryResponse.ok) {
                const retryResult = await processResponse(retryResponse, originalUrl)
                console.log('[axios] allorigins 代理响应:', retryResponse.status)
                return retryResult
              }
            } catch (retryError) {
              console.error('[axios] allorigins 代理也失败:', retryError)
            }
          }
        }
        // 如果所有尝试都失败，抛出错误
        debugLog('error', `[axios] Invalid referer 错误，无法解决: ${error.message}`)
        throw error
      }
      
      // 如果错误是 HTML 错误且是 API 代理请求，尝试回退到原始 URL
      if (error instanceof Error && error.message.includes('HTML') && finalUrl.startsWith('/api/proxy/')) {
        console.warn('[axios] API 代理返回 HTML 错误，尝试回退到原始 URL')
        try {
          // 提取原始 URL
          const originalUrl = extractOriginalUrl(finalUrl)
          if (originalUrl) {
            console.log('[axios] 回退到原始 URL:', originalUrl)
            const retryResponse = await _proxiedFetch(originalUrl, init)
            const result = await processResponse(retryResponse, originalUrl)
            console.log('[axios] CORS 代理响应:', retryResponse.status)
            return result
          }
        } catch (retryError) {
          console.error('[axios] 回退到 CORS 代理也失败:', retryError)
        }
      }
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
  // 优先使用本地打包的库，如果没有则使用全局变量或 shim
  const globalCryptoJS = (window as unknown as { CryptoJS?: unknown }).CryptoJS
  const globalBigInt = (window as unknown as { bigInt?: unknown }).bigInt
  
  const modules: Record<string, unknown> = {
    'axios': createAxiosShim(proxiedFetch),
    'cheerio': createCheerioShim(),
    'crypto-js': CryptoJS || globalCryptoJS || createCryptoShim(),
    'big-integer': bigInt || globalBigInt,
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
  getTopLists?: () => Promise<any>
  getTopListDetail?: (topListItem: MusicFreePlaylist) => Promise<{
    topListItem?: MusicFreePlaylist
    musicList?: MusicFreeTrack[]
  }>
  getRecommendSheetTags?: () => Promise<any>
  getRecommendSheetsByTag?: (tag: unknown, page?: number) => Promise<{
    data?: MusicFreePlaylist[]
    playlist?: MusicFreePlaylist[]
    list?: MusicFreePlaylist[]
    isEnd?: boolean
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

const mapPlaylistItem = (playlist: MusicFreePlaylist): PluginPlaylist => ({
  id: String(playlist.id ?? ''),
  title: playlist.title || '',
  artist: playlist.artist,
  coverUrl: playlist.artwork,
  playCount: playlist.playCount,
  worksNum: playlist.worksNums,
  description: playlist.description,
  extra: playlist,
})

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
        const mapped = (result?.data || []).map((p: MusicFreePlaylist) => mapPlaylistItem(p))
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

    async getTopLists() {
      if (!native.getTopLists) {
        return []
      }
      try {
        const result = await native.getTopLists()
        const groups = Array.isArray(result) ? result : []
        return groups.map((group: any) => ({
          title: group?.title || group?.name || '',
          data: Array.isArray(group?.data || group?.list)
            ? (group.data || group.list).map((item: MusicFreePlaylist) => mapPlaylistItem(item))
            : [],
        }))
      } catch (error) {
        console.error('[MusicFree Plugin] getTopLists error:', error)
        return []
      }
    },

    async getTopListDetail(playlist) {
      const handler = native.getTopListDetail || native.getMusicSheetInfo
      if (!handler) {
        return { topListItem: playlist, musicList: [] }
      }
      try {
        const result: any = await handler(playlist.extra as MusicFreePlaylist, 1)
        const musicList = Array.isArray(result?.musicList) ? result.musicList.map(mapTrack) : []
        let topItem: PluginPlaylist = playlist
        if (result?.topListItem) {
          topItem = mapPlaylistItem(result.topListItem as MusicFreePlaylist)
        } else if (result?.sheetItem) {
          topItem = mapPlaylistItem(result.sheetItem as MusicFreePlaylist)
        }
        return {
          topListItem: topItem,
          musicList,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] getTopListDetail error:', error)
        return { topListItem: playlist, musicList: [] }
      }
    },

    async getRecommendSheetTags() {
      if (!native.getRecommendSheetTags) {
        return []
      }
      try {
        return await native.getRecommendSheetTags()
      } catch (error) {
        console.error('[MusicFree Plugin] getRecommendSheetTags error:', error)
        return []
      }
    },

    async getRecommendSheetsByTag(tag: PluginRecommendTag | string, page = 1) {
      if (!native.getRecommendSheetsByTag) {
        return { data: [], isEnd: true }
      }
      try {
        const payload =
          typeof tag === 'object' && tag !== null
            ? ((tag as PluginRecommendTag).raw as any) || tag
            : tag
        const result = await native.getRecommendSheetsByTag(payload, page)
        const collection = result?.data || result?.playlist || result?.list || []
        const mapped = Array.isArray(collection)
          ? collection.map((p: MusicFreePlaylist) => mapPlaylistItem(p))
          : []
        return {
          data: mapped,
          isEnd: result?.isEnd ?? mapped.length < 20,
        }
      } catch (error) {
        console.error('[MusicFree Plugin] getRecommendSheetsByTag error:', error)
        return { data: [], isEnd: true }
      }
    },
    
    async resolveStream(track) {
      if (track.streamUrl) {
        return { url: track.streamUrl }
      }
      
      if (native.getMediaSource && track.extra) {
        // 优先尝试标准/高清等约定名称，最后才尝试数字形式，避免出现 /undefined
        const qualities = ['standard', 'high', 'super', 'low', 'lossless', '128', '320']
        for (const quality of qualities) {
          try {
            const result = await native.getMediaSource(track.extra as MusicFreeTrack, quality)
            
            console.log('[Lyrics] getMediaSource 原始返回:', JSON.stringify(result).substring(0, 500))
            
            // 处理返回的数据结构：可能是多种格式
            // 1. { code: 200, data: { url, lrc, ... } }
            // 2. { data: { url, lrc, ... } }
            // 3. { url, lrc, ... }
            // 4. 直接返回 { url }
            let url: string | undefined
            let lrc: string | undefined
            
            const resultAny = result as any
            
            // 检查是否有 code 字段，如果有，说明是 { code: 200, data: {...} } 格式
            if (resultAny?.code === 200 && resultAny?.data) {
              const data = resultAny.data
              url = data.url
              lrc = data.lrc
              console.log('[Lyrics] 格式1: { code: 200, data: { url, lrc } }')
            }
            // 检查是否有 data 字段（但没有 code）
            else if (resultAny?.data && !resultAny?.code) {
              const data = resultAny.data
              url = data.url
              lrc = data.lrc
              console.log('[Lyrics] 格式2: { data: { url, lrc } }')
            }
            // 直接包含 url 和 lrc
            else {
              url = resultAny?.url || result?.url
              lrc = resultAny?.lrc
              console.log('[Lyrics] 格式3: { url, lrc } 或 { url }')
            }
            
            // 如果从返回数据中没有找到歌词，尝试从缓存中获取
            if (!lrc && track.extra) {
              const trackExtra = track.extra as any
              const trackId = trackExtra.songmid || trackExtra.id || track.id
              if (trackId) {
                const cachedLyric = lyricCache.get(String(trackId))
                if (cachedLyric) {
                  console.log('[Lyrics] ✓ 从缓存中获取歌词，trackId:', trackId, '长度:', cachedLyric.length)
                  lrc = cachedLyric
                } else {
                  console.log('[Lyrics] 缓存中没有找到歌词，trackId:', trackId, '可用缓存键:', Array.from(lyricCache.keys()))
                }
              }
            }
            
            console.log('[Lyrics] 提取结果 - url:', url ? '存在' : '不存在', 'lrc:', lrc ? `存在(${lrc.length}字符)` : '不存在')
            
            if (url) {
              // 如果返回的数据中包含 lrc，将其作为额外数据返回
              if (lrc && typeof lrc === 'string' && lrc.trim().length > 0) {
                console.log('[Lyrics] ✓ 找到歌词，长度:', lrc.length)
                console.log('[Lyrics] 歌词预览:', lrc.substring(0, 200))
                return { 
                  url: url,
                  extra: { lrc: lrc },
                } as any
              } else {
                console.log('[Lyrics] ✗ 未找到有效歌词数据')
                if (lrc) {
                  console.log('[Lyrics] lrc 类型:', typeof lrc, '长度:', lrc.length)
                }
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


