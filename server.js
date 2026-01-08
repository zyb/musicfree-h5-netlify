import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 代理目标配置 - 支持的音乐源所需的代理
// 支持的音乐源：
// - 小秋音乐 (QQ 音乐 API，需要 Referer)
// - 小蜗音乐 (酷我音乐 API，HTTP 需要代理)
// - 小芸音乐 (网易云音乐 API，需要 Referer)
// - 小枸音乐 (酷狗音乐 API，HTTP 需要代理)
// - bilibili (B站 API，需要 Referer)
// - 元力QQ (QQ 音乐 API，需要 Referer)
const proxyTargets = {
  // ============ QQ 音乐 API (小秋、元力QQ) ============
  qqmusic_c: {
    target: 'https://c.y.qq.com',
    headers: { referer: 'https://y.qq.com/' },
  },
  qqmusic_u: {
    target: 'https://u.y.qq.com',
    headers: { referer: 'https://y.qq.com/' },
  },
  qqmusic_i: {
    target: 'https://i.y.qq.com',
    headers: { referer: 'https://y.qq.com/' },
  },
  
  // ============ 酷我音乐 API (元力KW、小蜗) ============
  // 注意：使用 HTTPS 以确保 Zeabur 等海外服务器可以访问
  kuwo_search: {
    target: 'https://search.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_m: {
    target: 'https://m.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_wapi: {
    target: 'https://wapi.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_kbang: {
    target: 'https://kbangserver.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_npl: {
    target: 'https://nplserver.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_mobile: {
    target: 'https://mobileinterfaces.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  kuwo_nmobi: {
    target: 'https://nmobi.kuwo.cn',
    headers: { referer: 'https://www.kuwo.cn/' },
  },
  
  // ============ 网易云音乐 API (小芸、网易音乐) ============
  netease: {
    target: 'https://music.163.com',
    headers: { referer: 'https://music.163.com/' },
  },
  netease_interface: {
    target: 'https://interface.music.163.com',
    headers: { referer: 'https://music.163.com/' },
  },
  netease_interface3: {
    target: 'https://interface3.music.163.com',
    headers: { referer: 'https://music.163.com/' },
  },
  netease_y: {
    target: 'https://y.music.163.com',
    headers: { referer: 'https://music.163.com/' },
  },
  
  // ============ 酷狗音乐 API (元力KG、小枸) ============
  // 注意：使用 HTTPS 以确保 Zeabur 等海外服务器可以访问
  kugou_search: {
    target: 'https://msearch.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_mobilecdn: {
    target: 'https://mobilecdn.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_mobilecdnbj: {
    target: 'https://mobilecdnbj.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_lyrics: {
    target: 'https://lyrics.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_t: {
    target: 'https://t.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_www2: {
    target: 'https://www2.kugou.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_gateway: {
    target: 'https://gateway.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  kugou_songsearch: {
    target: 'https://songsearch.kugou.com',
    headers: { referer: 'https://www.kugou.com/' },
  },
  
  // ============ B站 ============
  bili: {
    target: 'https://www.bilibili.com',
    headers: { referer: 'https://www.bilibili.com/' },
  },
  biliapi: {
    target: 'https://api.bilibili.com',
    headers: { referer: 'https://www.bilibili.com/' },
  },
  
  // ============ 海棠音乐 (元力QQ) ============
  haitang: {
    target: 'http://musicapi.haitangw.net',
  },
  haitangm: {
    target: 'http://music.haitangw.net',
  },
  
  // ============ LX Music API (获取播放URL) ============
  lxmusic: {
    target: 'https://lxmusicapi.onrender.com',
  },
  
  // ============ ikun 音源 API ============
  ikun: {
    target: 'https://api.ikunshare.com',
  },
  
  // ============ 海棠音乐 (haitangw.cc) ============
  haitangcc: {
    target: 'https://music.haitangw.cc',
    headers: { referer: 'https://music.haitangw.cc/' },
  },
  
  // ============ 段兄音乐 API (元力WY) ============
  duanx: {
    target: 'https://share.duanx.cn',
  },
  
  // ============ 咪咕音乐 API ============
  migu_m: {
    target: 'https://m.music.migu.cn',
    headers: { referer: 'https://music.migu.cn/' },
  },
  migu: {
    target: 'https://music.migu.cn',
    headers: { referer: 'https://music.migu.cn/' },
  },
  migu_cdn: {
    target: 'https://cdnmusic.migu.cn',
    headers: { referer: 'https://music.migu.cn/' },
  },
  
  // ============ 插件托管 (kstore.vip) ============
  kstore: {
    target: 'https://13413.kstore.vip',
  },
  
  // ============ 插件加载所需 ============
  gitee: {
    target: 'https://gitee.com',
    headers: { referer: 'https://gitee.com/' },
  },
  github: {
    target: 'https://raw.githubusercontent.com',
  },
  jsdelivr: {
    target: 'https://fastly.jsdelivr.net',
  },
}

// B站音频流域名列表（动态代理，不使用固定 target）
const biliAudioDomains = [
  'upos-hz-mirrorakam.akamaized.net',
  'upos-sz-mirrorcos.bilivideo.com',
  'upos-sz-mirrorhw.bilivideo.com',
  'upos-sz-mirrorali.bilivideo.com',
  'upos-sz-estgcos.bilivideo.com',
  'upos-sz-mirrorbd.bilivideo.com',
  'cn-hbcd-cu-02-10.bilivideo.com',
  'upos-hz-mirrorcos.bilivideo.com',
]

const commonHeaders = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // 处理 B站音频流代理请求 (特殊处理，支持动态域名)
  // 格式: /api/biliaudio?url=<encoded_url>
  if (pathname === '/api/biliaudio') {
    const audioUrl = url.searchParams.get('url')
    if (!audioUrl) {
      res.writeHead(400, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(JSON.stringify({ error: 'Missing url parameter' }))
      return
    }

    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    try {
      // 解码 URL
      const decodedUrl = decodeURIComponent(audioUrl)
      console.log('[BiliAudio] 代理音频流:', decodedUrl.substring(0, 80))

      // 验证域名是否是 B站音频域名
      const audioUrlObj = new URL(decodedUrl)
      const isBiliAudioDomain = biliAudioDomains.some(domain => 
        audioUrlObj.hostname === domain || audioUrlObj.hostname.endsWith('.bilivideo.com')
      )
      
      if (!isBiliAudioDomain) {
        console.warn('[BiliAudio] 非 B站音频域名，拒绝代理:', audioUrlObj.hostname)
        res.writeHead(403, { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
        res.end(JSON.stringify({ 
          error: 'Domain not allowed',
          hostname: audioUrlObj.hostname,
        }))
        return
      }

      // 构建请求头，添加 Referer
      const headers = {
        ...commonHeaders,
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com',
      }

      // 转发 Range 头（支持音频 seek）
      if (req.headers.range) {
        headers['Range'] = req.headers.range
      }

      const response = await fetch(decodedUrl, {
        method: 'GET',
        headers,
      })

      // 设置响应头
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      }

      // 复制关键响应头
      const copyHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges']
      for (const header of copyHeaders) {
        const value = response.headers.get(header)
        if (value) {
          responseHeaders[header] = value
        }
      }

      // 流式传输响应
      res.writeHead(response.status, responseHeaders)
      
      if (response.body) {
        const reader = response.body.getReader()
        const pump = async () => {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(value)
          }
          res.end()
        }
        await pump()
      } else {
        const buffer = await response.arrayBuffer()
        res.end(Buffer.from(buffer))
      }

      console.log('[BiliAudio] 代理成功:', response.status)
    } catch (error) {
      console.error('[BiliAudio] 代理失败:', error)
      res.writeHead(500, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      })
      res.end(JSON.stringify({
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : String(error),
      }))
    }
    return
  }

  // 处理 API 代理请求
  if (pathname.startsWith('/api/proxy/')) {
    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      })
      res.end()
      return
    }

    // 从 URL 中提取代理类型和路径
    const pathParts = pathname.replace(/^\/api\/proxy\/?/, '').split('/').filter(Boolean)
    const proxyType = pathParts[0]
    const targetPath = '/' + pathParts.slice(1).join('/')

    if (!proxyType || !proxyTargets[proxyType]) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: 'Invalid proxy type',
        available: Object.keys(proxyTargets),
        received: proxyType,
      }))
      return
    }

    const config = proxyTargets[proxyType]
    const targetUrl = config.target + targetPath + url.search

    // 性能计时开始
    const startTime = Date.now()
    let dnsTime = 0
    let connectTime = 0
    let requestTime = 0
    let responseTime = 0
    
    try {
      // 构建请求头
      const headers = {
        ...commonHeaders,
        ...config.headers,
      }

      // 复制原始请求的某些头
      const forwardHeaders = ['content-type', 'accept', 'accept-language']
      for (const header of forwardHeaders) {
        const value = req.headers[header.toLowerCase()]
        if (value) {
          headers[header] = Array.isArray(value) ? value[0] : value
        }
      }

      // 处理 Cookie（如果有）
      if (req.headers['x-forwarded-cookie']) {
        headers['cookie'] = req.headers['x-forwarded-cookie']
      }

      // 获取请求体
      let body = null
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = []
        for await (const chunk of req) {
          chunks.push(chunk)
        }
        body = Buffer.concat(chunks).toString()
      }

      // 发送代理请求
      const requestStartTime = Date.now()
      const response = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: body || undefined,
      })
      requestTime = Date.now() - requestStartTime

      // 设置 CORS 头
      const responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }

      // 复制响应头
      const contentType = response.headers.get('content-type')
      if (contentType) {
        responseHeaders['Content-Type'] = contentType
      }

      // 添加 Server-Timing API 头
      const totalTime = Date.now() - startTime
      const serverTiming = [
        `total;dur=${totalTime}`,
        `request;dur=${requestTime}`,
        `response;dur=${responseTime}`,
      ].join(', ')
      responseHeaders['Server-Timing'] = serverTiming

      // 使用流式传输而不是先读取完整响应
      // 这样可以更快地开始向客户端发送数据
      const responseStartTime = Date.now()
      
      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        responseTime = Date.now() - responseStartTime
        const finalTiming = [
          `total;dur=${Date.now() - startTime}`,
          `request;dur=${requestTime}`,
          `response;dur=${responseTime}`,
        ].join(', ')
        // 错误日志：详细输出失败信息
        console.error('[Proxy Error] 代理请求失败')
        console.error('[Proxy Error] 代理类型:', proxyType)
        console.error('[Proxy Error] 目标URL:', targetUrl)
        console.error('[Proxy Error] 配置:', JSON.stringify(config))
        console.error('[Proxy Error] 请求头:', JSON.stringify(headers))
        console.error('[Proxy Error] 状态码:', response.status, response.statusText)
        console.error('[Proxy Error] 响应头:', JSON.stringify(Object.fromEntries(response.headers.entries())))
        console.error('[Proxy Error] 响应内容:', errorText.substring(0, 1000))
        res.writeHead(response.status, {
          ...responseHeaders,
          'Server-Timing': finalTiming,
        })
        res.end(errorText)
        return
      }

      // 对于小响应，直接读取并检查 HTML 错误页面
      // 对于大响应，使用流式传输以提高性能
      const contentLength = response.headers.get('content-length')
      const isLargeResponse = contentLength && parseInt(contentLength) > 100000 // 大于 100KB
      
      if (!isLargeResponse) {
        // 小响应：先读取完整内容检查错误
        const responseText = await response.text()
        responseTime = Date.now() - responseStartTime
        
        // 检查是否是 HTML 错误页面
        if (responseText.trim().startsWith('<!doctype') || responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          // 错误日志：收到 HTML 错误页面
          console.error('[Proxy Error] 收到 HTML 错误页面')
          console.error('[Proxy Error] 代理类型:', proxyType)
          console.error('[Proxy Error] 目标URL:', targetUrl)
          console.error('[Proxy Error] 配置:', JSON.stringify(config))
          console.error('[Proxy Error] 请求头:', JSON.stringify(headers))
          console.error('[Proxy Error] 状态码:', response.status)
          console.error('[Proxy Error] 响应内容:', responseText.substring(0, 1000))
          const finalTiming = [
            `total;dur=${Date.now() - startTime}`,
            `request;dur=${requestTime}`,
            `response;dur=${responseTime}`,
          ].join(', ')
          res.writeHead(response.status || 500, {
            'Content-Type': 'application/json',
            'Server-Timing': finalTiming,
          })
          res.end(JSON.stringify({
            error: 'Proxy returned HTML error page',
            status: response.status,
            url: targetUrl,
            message: 'The proxy server returned an HTML error page instead of the expected response',
          }))
          return
        }
        
        // 返回响应
        const finalTiming = [
          `total;dur=${Date.now() - startTime}`,
          `request;dur=${requestTime}`,
          `response;dur=${responseTime}`,
        ].join(', ')
        res.writeHead(response.status, {
          ...responseHeaders,
          'Server-Timing': finalTiming,
        })
        res.end(responseText)
      } else {
        // 大响应：使用流式传输
        // 先读取前几个字节检查是否是 HTML
        const reader = response.body.getReader()
        const { value: firstChunk } = await reader.read()
        const preview = firstChunk ? new TextDecoder().decode(firstChunk.slice(0, 200)) : ''
        
        if (preview.trim().startsWith('<!doctype') || preview.trim().startsWith('<!DOCTYPE') || preview.trim().startsWith('<html')) {
          console.error('[Proxy] 收到 HTML 错误页面:', targetUrl, '状态码:', response.status)
          responseTime = Date.now() - responseStartTime
          const finalTiming = [
            `total;dur=${Date.now() - startTime}`,
            `request;dur=${requestTime}`,
            `response;dur=${responseTime}`,
          ].join(', ')
          res.writeHead(response.status || 500, {
            'Content-Type': 'application/json',
            'Server-Timing': finalTiming,
          })
          res.end(JSON.stringify({
            error: 'Proxy returned HTML error page',
            status: response.status,
            url: targetUrl,
            message: 'The proxy server returned an HTML error page instead of the expected response',
          }))
          return
        }

        // 流式传输响应
        const finalTiming = [
          `total;dur=${Date.now() - startTime}`,
          `request;dur=${requestTime}`,
        ].join(', ')
        res.writeHead(response.status, {
          ...responseHeaders,
          'Server-Timing': finalTiming,
        })
        
        // 先发送第一个 chunk
        if (firstChunk) {
          res.write(firstChunk)
        }
        
        // 继续读取并传输剩余的 chunks
        let totalBytes = firstChunk ? firstChunk.length : 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
          totalBytes += value.length
        }
        
        responseTime = Date.now() - responseStartTime
        const completeTiming = [
          `total;dur=${Date.now() - startTime}`,
          `request;dur=${requestTime}`,
          `response;dur=${responseTime}`,
          `bytes;desc=${totalBytes}`,
        ].join(', ')
        res.setHeader('Server-Timing', completeTiming)
        res.end()
      }
    } catch (error) {
      const errorTime = Date.now() - startTime
      const errorTiming = [
        `total;dur=${errorTime}`,
        `error;desc=${error instanceof Error ? error.message : String(error)}`,
      ].join(', ')
      // 错误日志：代理请求异常
      console.error('[Proxy Error] 代理请求异常')
      console.error('[Proxy Error] 代理类型:', proxyType)
      console.error('[Proxy Error] 目标URL:', targetUrl)
      console.error('[Proxy Error] 配置:', JSON.stringify(config))
      console.error('[Proxy Error] 错误:', error instanceof Error ? error.message : String(error))
      console.error('[Proxy Error] 堆栈:', error instanceof Error ? error.stack : 'N/A')
      res.writeHead(500, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Server-Timing': errorTiming,
      })
      res.end(JSON.stringify({
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : String(error),
        proxyType,
        targetUrl,
      }))
    }
    return
  }

  // 处理静态文件请求
  let filePath = join(__dirname, 'dist', pathname === '/' ? 'index.html' : pathname)
  
  // 安全检查：确保文件在 dist 目录内
  const distPath = join(__dirname, 'dist')
  if (!filePath.startsWith(distPath)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // 如果请求的是目录，尝试加载 index.html
  if (!extname(filePath) && !existsSync(filePath)) {
    filePath = join(filePath, 'index.html')
  }

  // 如果文件不存在，返回 index.html（SPA 路由）
  if (!existsSync(filePath)) {
    filePath = join(distPath, 'index.html')
  }

  try {
    const fileContent = readFileSync(filePath)
    const ext = extname(filePath)
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    res.writeHead(200, { 'Content-Type': contentType })
    res.end(fileContent)
  } catch (error) {
    console.error('[Server] 读取文件失败:', error)
    res.writeHead(404)
    res.end('Not Found')
  }
})

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`[Server] 服务器启动在端口 ${PORT}`)
  console.log(`[Server] 静态文件目录: ${join(__dirname, 'dist')}`)
  console.log(`[Server] API 代理路径: /api/proxy/*`)
})

