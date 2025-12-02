// 测试代理可用性
const proxies = [
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
]

const testUrl = 'http://music.haitangw.net/cqapi/qq.js'

for (const proxy of proxies) {
  const url = proxy + encodeURIComponent(testUrl)
  console.log('测试代理:', proxy)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    console.log('  状态:', res.status)
    if (res.ok) {
      const text = await res.text()
      console.log('  内容长度:', text.length)
      console.log('  成功!')
      break
    }
  } catch (err) {
    console.log('  失败:', err.message)
  }
}

// 也测试直接请求 QQ 音乐 API
console.log('\n测试直接请求 QQ 音乐 API...')
try {
  const res = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'referer': 'https://y.qq.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      req_1: {
        method: 'DoSearchForQQMusicDesktop',
        module: 'music.search.SearchCgiService',
        param: {
          num_per_page: 20,
          page_num: 1,
          query: '周杰伦',
          search_type: 0
        }
      }
    }),
    signal: AbortSignal.timeout(15000)
  })
  console.log('状态:', res.status)
  const data = await res.json()
  console.log('响应 code:', data.code)
  if (data.req_1?.data?.body?.song?.list) {
    console.log('找到歌曲数:', data.req_1.data.body.song.list.length)
    const first = data.req_1.data.body.song.list[0]
    if (first) {
      console.log('第一首:', first.title, '-', first.singer?.map(s => s.name).join(', '))
    }
  }
} catch (err) {
  console.log('失败:', err.message)
}
