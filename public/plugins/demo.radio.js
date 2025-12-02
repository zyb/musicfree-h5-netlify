/**
 * MusicFree H5 示例插件
 * 这是一个演示插件，展示如何为 H5 版本编写插件
 * 
 * 插件需要调用 MusicFreeH5.registerPlugin 来注册
 */
;(function () {
  // 模拟的电台数据
  const radioStations = [
    {
      id: 'demo-1',
      title: '轻松爵士',
      artists: ['Jazz FM'],
      album: '网络电台',
      coverUrl: 'https://picsum.photos/seed/jazz/300/300',
      streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    },
    {
      id: 'demo-2',
      title: '古典旋律',
      artists: ['Classical Radio'],
      album: '网络电台',
      coverUrl: 'https://picsum.photos/seed/classical/300/300',
      streamUrl: 'https://ice1.somafm.com/dronezone-128-mp3',
    },
    {
      id: 'demo-3',
      title: '电子节拍',
      artists: ['Electronic FM'],
      album: '网络电台',
      coverUrl: 'https://picsum.photos/seed/electronic/300/300',
      streamUrl: 'https://ice1.somafm.com/deepspaceone-128-mp3',
    },
    {
      id: 'demo-4',
      title: '民谣时光',
      artists: ['Folk Radio'],
      album: '网络电台',
      coverUrl: 'https://picsum.photos/seed/folk/300/300',
      streamUrl: 'https://ice1.somafm.com/folkfwd-128-mp3',
    },
    {
      id: 'demo-5',
      title: '复古摇滚',
      artists: ['Rock Classics'],
      album: '网络电台',
      coverUrl: 'https://picsum.photos/seed/rock/300/300',
      streamUrl: 'https://ice1.somafm.com/metal-128-mp3',
    },
  ]

  // 注册插件
  MusicFreeH5.registerPlugin((ctx) => {
    // ctx 包含 fetch, console, descriptor 等
    ctx.console.log('Demo Radio 插件已加载')

    return {
      name: 'Demo Radio',
      version: '1.0.0',
      author: 'MusicFree H5',
      capabilities: ['search', 'stream'],

      // 搜索功能
      async searchSongs(query) {
        ctx.console.log('搜索:', query)
        
        // 模拟网络延迟
        await new Promise((resolve) => setTimeout(resolve, 500))

        // 简单的模糊匹配
        const results = radioStations.filter((station) => {
          const searchText = `${station.title} ${station.artists.join(' ')} ${station.album}`.toLowerCase()
          return searchText.includes(query.toLowerCase())
        })

        // 如果没有匹配，返回所有电台
        if (results.length === 0 && query.trim()) {
          return radioStations
        }

        return results.length > 0 ? results : radioStations
      },

      // 解析流地址（如果 searchSongs 返回的数据已经包含 streamUrl，可以不实现这个方法）
      async resolveStream(track) {
        ctx.console.log('解析流:', track.id)
        
        const station = radioStations.find((s) => s.id === track.id)
        if (!station) {
          throw new Error('未找到电台')
        }

        return {
          url: station.streamUrl,
          mimeType: 'audio/mpeg',
        }
      },
    }
  })
})()

