// Service Worker 用于拦截和缓存音频请求
const CACHE_NAME = 'musicfree-audio-cache-v1'

// 安装 Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker 安装中...')
  self.skipWaiting() // 立即激活新的 Service Worker
})

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker 激活中...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本的缓存
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  return self.clients.claim() // 立即控制所有客户端
})

// 拦截请求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // 只拦截音频文件请求（.mp3, .m4a, .flac, .wav, .ogg 等）
  const isAudioRequest = /\.(mp3|m4a|flac|wav|ogg|aac|wma|opus)(\?|$)/i.test(url.pathname) ||
                         event.request.headers.get('accept')?.includes('audio/') ||
                         url.searchParams.has('audio')
  
  if (!isAudioRequest) {
    // 非音频请求，直接返回，不拦截
    return
  }
  
  console.log('[SW] 拦截音频请求:', url.href)
  
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 首先检查缓存
      const cachedResponse = await cache.match(event.request)
      
      if (cachedResponse) {
        console.log('[SW] ✓ 从缓存返回音频:', url.href)
        return cachedResponse
      }
      
      // 缓存中没有，从网络获取
      console.log('[SW] 从网络获取音频:', url.href)
      
      try {
        const response = await fetch(event.request.clone())
        
        console.log('[SW] 网络响应状态:', response.status, response.statusText, '类型:', response.type)
        
        // 只缓存成功的响应
        const shouldCache = response.ok || (response.status === 0 && response.type === 'opaque')
        
        if (shouldCache) {
          console.log('[SW] 响应可以缓存，将在后台异步缓存，立即返回响应流以支持流式播放')
          // 克隆响应，因为响应只能读取一次
          const responseToCache = response.clone()
          
          // 在后台异步缓存，不阻塞响应返回
          // 这样音频可以立即开始流式播放，而不需要等待缓存完成
          cache.put(event.request, responseToCache).then(() => {
            const contentLength = responseToCache.headers.get('content-length') || '未知'
            console.log('[SW] ✓ 音频已在后台缓存成功:', url.href, '大小:', contentLength)
            
            // 通知主线程缓存完成（可选，不影响播放）
            self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({
                  type: 'AUDIO_CACHED',
                  url: url.href,
                  size: contentLength,
                }).catch(() => {
                  // 忽略消息发送失败，不影响功能
                })
              })
            }).catch(() => {
              // 忽略错误，不影响功能
            })
          }).catch((cacheError) => {
            console.error('[SW] ✗ 后台缓存操作失败:', cacheError)
          })
        } else {
          console.warn('[SW] ✗ 响应状态不是成功，不缓存:', response.status, response.statusText, '类型:', response.type)
        }
        
        return response
      } catch (error) {
        console.error('[SW] ✗ 获取音频失败:', url.href, error)
        console.error('[SW] 错误详情:', {
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
        throw error
      }
    }).catch((error) => {
      console.error('[SW] ✗ 打开缓存失败:', error)
      throw error
    })
  )
})

// 处理来自主线程的消息
self.addEventListener('message', (event) => {
  const { type, data } = event.data
  
  if (type === 'GET_CACHED_AUDIO') {
    // 主线程请求获取缓存的音频
    const { url } = data
    console.log('[SW] 收到获取缓存请求，URL:', url)
    
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 缓存已打开，开始匹配请求')
      
      // 创建一个 Request 对象用于匹配（重要：cache.match() 需要 Request 对象，不是 URL 字符串）
      const request = new Request(url)
      console.log('[SW] 创建请求对象:', request.url)
      
      cache.match(request).then((response) => {
        console.log('[SW] 缓存匹配结果:', response ? '找到' : '未找到')
        
        if (response) {
          console.log('[SW] 找到缓存的响应，状态:', response.status, '类型:', response.type, 'content-type:', response.headers.get('content-type'))
          
          // 检查是否是 opaque 响应（no-cors 模式）
          // opaque 响应无法读取内容，blob() 会返回空 Blob
          if (response.type === 'opaque' || response.status === 0) {
            console.log('[SW] 检测到 opaque 响应，无法读取内容，只能返回 URL')
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: 'opaque_response',
                isOpaque: true,
                url: url,
              })
            }
            return
          }
          
          // 对于非 opaque 响应，尝试获取 Blob
          console.log('[SW] 尝试获取响应 Blob...')
          response.blob().then((blob) => {
            console.log('[SW] Blob 创建成功，大小:', blob.size, 'bytes')
            
            // 检查 Blob 是否为空
            if (blob.size === 0) {
              console.warn('[SW] Blob 大小为 0，可能是 opaque 响应')
              if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({
                  success: false,
                  error: 'empty_blob',
                  isOpaque: true,
                  url: url,
                })
              }
              return
            }
            
            // 通过消息传递 Blob（使用 Transferable Objects）
            if (event.ports && event.ports[0]) {
              try {
                event.ports[0].postMessage({
                  success: true,
                  blob: blob,
                }, [blob])
              } catch (transferError) {
                console.error('[SW] 传递 Blob 失败:', transferError)
                // 如果无法传递 Blob，尝试使用 ArrayBuffer
                blob.arrayBuffer().then((arrayBuffer) => {
                  event.ports[0].postMessage({
                    success: true,
                    arrayBuffer: arrayBuffer,
                    mimeType: blob.type,
                  }, [arrayBuffer])
                }).catch((abError) => {
                  console.error('[SW] 获取 ArrayBuffer 失败:', abError)
                  event.ports[0].postMessage({
                    success: false,
                    error: abError.message,
                  })
                })
              }
            } else {
              // 如果没有 port，使用 event.source.postMessage
              if (event.source) {
                event.source.postMessage({
                  type: 'GET_CACHED_AUDIO_RESPONSE',
                  success: true,
                  blob: blob,
                  url: url,
                }, { transfer: [blob] })
              }
            }
          }).catch((error) => {
            console.error('[SW] 获取 Blob 失败:', error)
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({
                success: false,
                error: error.message,
              })
            }
          })
        } else {
          console.log('[SW] 缓存中未找到，列出所有缓存的键:')
          // 列出所有缓存的键以便调试
          cache.keys().then((keys) => {
            console.log('[SW] 缓存中的键数量:', keys.length)
            keys.forEach((key, index) => {
              console.log(`[SW] 缓存键 ${index + 1}:`, key.url)
            })
          })
          
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error: '缓存中未找到',
            })
          }
        }
      }).catch((error) => {
        console.error('[SW] 匹配缓存失败:', error)
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            success: false,
            error: error.message,
          })
        }
      })
    }).catch((error) => {
      console.error('[SW] 打开缓存失败:', error)
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: false,
          error: error.message,
        })
      }
    })
  } else if (type === 'DELETE_CACHED_AUDIO') {
    // 删除指定的缓存音频
    const { url } = data
    caches.open(CACHE_NAME).then((cache) => {
      cache.delete(url).then((deleted) => {
        event.ports[0].postMessage({
          success: deleted,
        })
      })
    })
  } else if (type === 'CLEAR_ALL_CACHE') {
    // 清除所有缓存
    caches.delete(CACHE_NAME).then((deleted) => {
      event.ports[0].postMessage({
        success: deleted,
      })
    })
  } else if (type === 'GET_CACHE_SIZE') {
    // 获取缓存大小
    caches.open(CACHE_NAME).then((cache) => {
      cache.keys().then((keys) => {
        Promise.all(
          keys.map((key) => cache.match(key).then((response) => response?.headers.get('content-length') || '0'))
        ).then((sizes) => {
          const totalSize = sizes.reduce((sum, size) => sum + parseInt(size, 10), 0)
          event.ports[0].postMessage({
            success: true,
            count: keys.length,
            totalSize: totalSize,
          })
        })
      })
    })
  }
})
