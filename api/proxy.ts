import type { VercelRequest, VercelResponse } from '@vercel/node'

// 代理目标映射
const proxyTargets: Record<string, { target: string; headers?: Record<string, string> }> = {
  // ============ QQ 音乐 ============
  'qqu': { target: 'https://u.y.qq.com', headers: { referer: 'https://y.qq.com/', origin: 'https://y.qq.com' } },
  'qqc': { target: 'https://c.y.qq.com', headers: { referer: 'https://y.qq.com/', origin: 'https://y.qq.com' } },
  'qqi': { target: 'https://i.y.qq.com', headers: { referer: 'https://y.qq.com/', origin: 'https://y.qq.com' } },
  'qqshc': { target: 'https://shc.y.qq.com', headers: { referer: 'https://y.qq.com' } },
  
  // ============ 网易云音乐 ============
  'netease': { target: 'https://music.163.com', headers: { referer: 'https://music.163.com/', origin: 'https://music.163.com' } },
  'neteaseapi': { target: 'https://interface.music.163.com', headers: { referer: 'https://music.163.com/' } },
  'neteasem': { target: 'https://interface3.music.163.com', headers: { referer: 'https://music.163.com/' } },
  
  // ============ 酷狗音乐 ============
  'kugou': { target: 'https://www.kugou.com', headers: { referer: 'https://www.kugou.com/' } },
  'kugousearch': { target: 'https://songsearch.kugou.com', headers: { referer: 'https://www.kugou.com/' } },
  'kugoucomplex': { target: 'https://complexsearch.kugou.com', headers: { referer: 'https://www.kugou.com/' } },
  'kugouwww': { target: 'https://wwwapi.kugou.com', headers: { referer: 'https://www.kugou.com/' } },
  'kugougateway': { target: 'https://gateway.kugou.com' },
  'kugoutracker': { target: 'https://trackercdnbj.kugou.com' },
  'kugoumobile': { target: 'https://mobilecdn.kugou.com' },
  'kugouservice': { target: 'https://mobileservice.kugou.com' },
  
  // ============ 酷我音乐 ============
  'kuwo': { target: 'https://www.kuwo.cn', headers: { referer: 'https://www.kuwo.cn/', csrf: 'HH9GS5IV6V0', cookie: 'kw_token=HH9GS5IV6V0' } },
  'kuwoapi': { target: 'https://kuwo.cn', headers: { referer: 'https://www.kuwo.cn/', csrf: 'HH9GS5IV6V0', cookie: 'kw_token=HH9GS5IV6V0' } },
  'kuwosearch': { target: 'http://search.kuwo.cn', headers: { 'user-agent': 'kwplayer_ar_8.5.4.2' } },
  
  // ============ 咪咕音乐 ============
  'migu': { target: 'https://music.migu.cn', headers: { referer: 'https://music.migu.cn/' } },
  'migum': { target: 'https://m.music.migu.cn', headers: { referer: 'https://m.music.migu.cn/' } },
  'miguapp': { target: 'https://app.c.nf.migu.cn' },
  'migucdn': { target: 'https://c.musicapp.migu.cn' },
  'migupdms': { target: 'https://jadeite.migu.cn' },
  
  // ============ B站音频 ============
  'bili': { target: 'https://www.bilibili.com', headers: { referer: 'https://www.bilibili.com/' } },
  'biliapi': { target: 'https://api.bilibili.com', headers: { referer: 'https://www.bilibili.com/' } },
  
  // ============ 5sing ============
  '5sing': { target: 'http://5sing.kugou.com' },
  '5singfc': { target: 'http://5singfc.kugou.com' },
  
  // ============ 千千音乐 ============
  'qianqian': { target: 'https://music.91q.com', headers: { referer: 'https://music.91q.com/' } },
  
  // ============ 喜马拉雅 ============
  'xmly': { target: 'https://www.ximalaya.com', headers: { referer: 'https://www.ximalaya.com/' } },
  'xmlymobile': { target: 'https://mobile.ximalaya.com' },
  
  // ============ 懒人听书 ============
  'lrts': { target: 'https://www.lrts.me' },
  
  // ============ 猫耳 FM ============
  'missevan': { target: 'https://www.missevan.com', headers: { referer: 'https://www.missevan.com/' } },
  
  // ============ 荔枝 FM ============
  'lizhi': { target: 'https://www.lizhi.fm' },
  
  // ============ zz123 聚合搜索 ============
  'zz123': { target: 'https://zz123.com', headers: { referer: 'https://zz123.com/', origin: 'https://zz123.com' } },
  
  // ============ 歌曲宝 ============
  'gequbao': { target: 'https://www.gequbao.com', headers: { referer: 'https://www.gequbao.com/', origin: 'https://www.gequbao.com' } },
  
  // ============ Suno ============
  'suno': { target: 'https://studio-api.suno.ai', headers: { referer: 'https://suno.ai/', origin: 'https://suno.ai' } },
  
  // ============ Gitee (插件托管) ============
  'gitee': { target: 'https://gitee.com', headers: { referer: 'https://gitee.com/' } },
  'giteeraw': { target: 'https://gitee.com', headers: { referer: 'https://gitee.com/', accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } },
  
  // ============ GitHub (插件托管) ============
  'github': { target: 'https://raw.githubusercontent.com' },
  'ghproxy': { target: 'https://ghproxy.com' },
  
  // ============ 海棠音乐 ============
  'haitang': { target: 'http://musicapi.haitangw.net' },
  'haitangm': { target: 'http://music.haitangw.net' },
  
  // ============ 网易音乐解析服务 ============
  'duanx': { target: 'https://share.duanx.cn' },
  'haitangcc': { target: 'https://music.haitangw.cc' },
  'lxmusic': { target: 'https://lxmusicapi.onrender.com' },
  'netease163': { target: 'http://music.163.com', headers: { referer: 'https://music.163.com/' } },
  
  // ============ 其他常见 API ============
  'aggregator': { target: 'https://api.lolimi.cn' },
  'myfreemp3': { target: 'https://api.xingzhige.com' },
}

const commonHeaders = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 从 URL 中提取代理类型和路径
  // URL 格式: /api/proxy/[proxyType]/[...path]
  const url = new URL(req.url || '', `https://${req.headers.host}`)
  const pathParts = url.pathname.replace(/^\/api\/proxy\/?/, '').split('/')
  const proxyType = pathParts[0]
  const targetPath = '/' + pathParts.slice(1).join('/')
  
  if (!proxyType || !proxyTargets[proxyType]) {
    return res.status(400).json({ 
      error: 'Invalid proxy type', 
      available: Object.keys(proxyTargets) 
    })
  }
  
  const config = proxyTargets[proxyType]
  const targetUrl = config.target + targetPath + url.search
  
  try {
    // 构建请求头
    const headers: Record<string, string> = {
      ...commonHeaders,
      ...config.headers,
    }
    
    // 复制原始请求的某些头
    const forwardHeaders = ['content-type', 'accept', 'accept-language']
    for (const header of forwardHeaders) {
      if (req.headers[header]) {
        headers[header] = Array.isArray(req.headers[header]) 
          ? req.headers[header]![0] 
          : req.headers[header] as string
      }
    }
    
    // 获取请求体
    let body: string | undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body
      } else if (req.body) {
        body = JSON.stringify(req.body)
      }
    }
    
    // 发送代理请求
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    })
    
    // 设置 CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }
    
    // 复制响应头
    const contentType = response.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }
    
    // 返回响应
    const data = await response.arrayBuffer()
    res.status(response.status).send(Buffer.from(data))
    
  } catch (error) {
    console.error('Proxy error:', error)
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      target: targetUrl,
    })
  }
}

