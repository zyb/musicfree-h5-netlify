// Netlify Function 处理 API 代理请求
// 路径: /api/proxy/[type]/[path]

// 代理目标配置 - 支持的音乐源所需的代理
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
    target: 'http://i.y.qq.com',
    headers: { referer: 'https://y.qq.com/' },
  },
  
  // ============ 酷我音乐 API (元力KW、小蜗) ============
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

const commonHeaders = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

exports.handler = async (event, context) => {
  // 处理 OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Forwarded-Cookie',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    }
  }

  // 从路径中提取代理类型和路径
  // 路径格式: /.netlify/functions/proxy/[type]/[path] 或 /api/proxy/[type]/[path]
  let path = event.path
  console.log('[Proxy] 原始路径:', path)
  
  // 移除 /.netlify/functions/proxy 前缀
  if (path.startsWith('/.netlify/functions/proxy')) {
    path = path.replace(/^\/\.netlify\/functions\/proxy\/?/, '')
  }
  // 移除 /api/proxy 前缀（如果存在）
  if (path.startsWith('/api/proxy')) {
    path = path.replace(/^\/api\/proxy\/?/, '')
  }
  // 移除开头的斜杠
  path = path.replace(/^\//, '')
  const pathParts = path.split('/').filter(Boolean)
  
  console.log('[Proxy] 解析后的路径部分:', pathParts)
  
  if (pathParts.length === 0) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Invalid proxy path',
        message: 'Path format: /api/proxy/[type]/[path]',
      }),
    }
  }

  const proxyType = pathParts[0]
  const targetPath = '/' + pathParts.slice(1).join('/')
  
  // 构建查询字符串
  let queryString = ''
  if (event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(event.queryStringParameters)) {
      if (value) {
        params.append(key, value)
      }
    }
    queryString = '?' + params.toString()
  }

  if (!proxyType || !proxyTargets[proxyType]) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Invalid proxy type',
        available: Object.keys(proxyTargets),
        received: proxyType,
      }),
    }
  }

  const config = proxyTargets[proxyType]
  const targetUrl = config.target + targetPath + queryString

  try {
    // 构建请求头
    const headers = {
      ...commonHeaders,
      ...(config.headers || {}),
    }

    // 复制原始请求的某些头
    const forwardHeaders = ['content-type', 'accept', 'accept-language']
    for (const header of forwardHeaders) {
      const value = event.headers[header] || event.headers[header.toLowerCase()]
      if (value) {
        headers[header] = value
      }
    }

    // 处理 Cookie（如果有）
    if (event.headers['x-forwarded-cookie']) {
      headers['cookie'] = event.headers['x-forwarded-cookie']
    }

    // 获取请求体
    let body = null
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' && event.body) {
      body = event.body
    }

    // 发送代理请求
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: body || undefined,
    })

    // 读取响应内容
    const responseText = await response.text()

    // 检查是否是 HTML 错误页面
    if (responseText.trim().startsWith('<!doctype') || 
        responseText.trim().startsWith('<!DOCTYPE') || 
        responseText.trim().startsWith('<html')) {
      console.error('[Proxy Error] 收到 HTML 错误页面:', targetUrl, '状态码:', response.status)
      return {
        statusCode: response.status || 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Proxy returned HTML error page',
          status: response.status,
          url: targetUrl,
          message: 'The proxy server returned an HTML error page instead of the expected response',
        }),
      }
    }

    // 设置响应头
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Forwarded-Cookie',
    }

    // 复制响应头
    const contentType = response.headers.get('content-type')
    if (contentType) {
      responseHeaders['Content-Type'] = contentType
    }

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseText,
    }
  } catch (error) {
    console.error('[Proxy Error] 代理请求异常:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Proxy request failed',
        message: error.message,
        url: targetUrl,
      }),
    }
  }
}
