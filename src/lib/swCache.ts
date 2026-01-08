// Service Worker 缓存工具函数

/**
 * 从 Service Worker 缓存中获取音频 Blob
 */
export const getCachedAudioFromSW = async (url: string): Promise<Blob | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SWCache] Service Worker 不支持')
    return null
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()
    
    messageChannel.port1.onmessage = (event) => {
      const { success, blob, arrayBuffer, mimeType, error, isOpaque } = event.data
      if (success) {
        if (blob && blob.size > 0) {
          console.log('[SWCache] ✓ 从 Service Worker 缓存获取音频成功:', url)
          resolve(blob)
        } else if (arrayBuffer) {
          // 如果收到 ArrayBuffer，转换为 Blob
          console.log('[SWCache] ✓ 从 Service Worker 缓存获取音频成功（ArrayBuffer）:', url)
          const blob = new Blob([arrayBuffer], { type: mimeType || 'audio/mpeg' })
          resolve(blob)
        } else {
          console.log('[SWCache] ✗ Service Worker 返回的 Blob 为空:', url)
          resolve(null)
        }
      } else if (isOpaque) {
        // opaque 响应无法读取内容，返回 null
        console.log('[SWCache] ✗ Service Worker 缓存中是 opaque 响应，无法读取内容:', url)
        resolve(null)
      } else {
        console.log('[SWCache] ✗ Service Worker 缓存中未找到音频:', url, error)
        resolve(null)
      }
    }

    // 等待 Service Worker 就绪
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage(
          {
            type: 'GET_CACHED_AUDIO',
            data: { url },
          },
          [messageChannel.port2]
        )
      } else {
        console.warn('[SWCache] Service Worker 未激活')
        resolve(null)
      }
    }).catch((error) => {
      console.error('[SWCache] Service Worker 就绪失败:', error)
      resolve(null)
    })
  })
}

/**
 * 从 Service Worker 缓存中删除音频
 */
export const deleteCachedAudioFromSW = async (url: string): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()
    
    messageChannel.port1.onmessage = (event) => {
      const { success } = event.data
      resolve(success)
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage(
          {
            type: 'DELETE_CACHED_AUDIO',
            data: { url },
          },
          [messageChannel.port2]
        )
      } else {
        resolve(false)
      }
    }).catch(() => {
      resolve(false)
    })
  })
}

/**
 * 清除所有 Service Worker 缓存
 */
export const clearAllSWCache = async (): Promise<boolean> => {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()
    
    messageChannel.port1.onmessage = (event) => {
      const { success } = event.data
      resolve(success)
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage(
          {
            type: 'CLEAR_ALL_CACHE',
          },
          [messageChannel.port2]
        )
      } else {
        resolve(false)
      }
    }).catch(() => {
      resolve(false)
    })
  })
}

/**
 * 获取 Service Worker 缓存统计信息
 */
export const getSWCacheStats = async (): Promise<{ count: number; totalSize: number } | null> => {
  if (!('serviceWorker' in navigator)) {
    return null
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()
    
    messageChannel.port1.onmessage = (event) => {
      const { success, count, totalSize } = event.data
      if (success) {
        resolve({ count, totalSize })
      } else {
        resolve(null)
      }
    }

    navigator.serviceWorker.ready.then((registration) => {
      if (registration.active) {
        registration.active.postMessage(
          {
            type: 'GET_CACHE_SIZE',
          },
          [messageChannel.port2]
        )
      } else {
        resolve(null)
      }
    }).catch(() => {
      resolve(null)
    })
  })
}
