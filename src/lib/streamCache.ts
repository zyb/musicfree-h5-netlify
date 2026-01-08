import type { PluginTrack, PluginStream } from '../types/plugin'

// 缓存键前缀（用于 localStorage，存储 URL 缓存）
const CACHE_KEY_PREFIX = 'musicfree-stream-cache-'

// IndexedDB 配置（用于存储音频文件）
const DB_NAME = 'musicfree-audio-cache'
const DB_VERSION = 1
const STORE_NAME = 'audioFiles'

// URL 缓存数据结构（用于 localStorage）
interface StreamCacheData {
  stream: PluginStream
  trackId: string
  timestamp: number
  hasAudioFile: boolean // 标记是否有缓存的音频文件
}

// IndexedDB 中存储的数据结构
interface AudioFileCacheData {
  trackId: string
  blob: Blob
  timestamp: number
  // 可选的歌词数据
  lyrics?: string
}

/**
 * 生成缓存键
 */
const getCacheKey = (trackId: string): string => {
  return `${CACHE_KEY_PREFIX}${trackId}`
}

// IndexedDB 数据库实例
let db: IDBDatabase | null = null

/**
 * 初始化 IndexedDB
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[StreamCache] IndexedDB 打开失败:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'trackId' })
      }
    }
  })
}

/**
 * 保存音频文件到 IndexedDB（包含可选的歌词数据）
 */
export const saveAudioFileCache = async (track: PluginTrack, audioBlob: Blob, lyrics?: string): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    const cacheData: AudioFileCacheData = {
      trackId: track.id,
      blob: audioBlob,
      timestamp: Date.now(),
    }
    
    // 如果有歌词数据，也一起保存
    if (lyrics) {
      cacheData.lyrics = lyrics
    }
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(cacheData)
      
      request.onsuccess = async () => {
        // 获取当前缓存数量，用于调试
        const countRequest = store.count()
        countRequest.onsuccess = () => {
          console.log('[StreamCache] 已缓存音频文件到 IndexedDB:', track.id, track.title, '大小:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB', lyrics ? '包含歌词' : '', '当前缓存总数:', countRequest.result)
        }
        console.log('[StreamCache] 已缓存音频文件到 IndexedDB:', track.id, track.title, '大小:', (audioBlob.size / 1024 / 1024).toFixed(2), 'MB', lyrics ? '包含歌词' : '')
        resolve()
      }
      
      request.onerror = () => {
        console.error('[StreamCache] 保存音频文件到 IndexedDB 失败:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[StreamCache] 保存音频文件失败:', error)
    throw error // 重新抛出错误，让调用者知道保存失败
  }
}

/**
 * 从 IndexedDB 加载音频文件
 */
export const loadAudioFileCache = async (track: PluginTrack): Promise<{ blob: Blob; lyrics?: string } | null> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<{ blob: Blob; lyrics?: string } | null>((resolve) => {
      const request = store.get(track.id)
      
      request.onsuccess = () => {
        const result = request.result as AudioFileCacheData | undefined
        if (result && result.blob instanceof Blob) {
          console.log('[StreamCache] ✓ 从 IndexedDB 加载音频文件成功:', track.id, track.title, '大小:', (result.blob.size / 1024 / 1024).toFixed(2), 'MB', result.lyrics ? '包含歌词' : '')
          resolve({
            blob: result.blob,
            lyrics: result.lyrics,
          })
        } else {
          console.log('[StreamCache] ✗ IndexedDB 中未找到音频文件缓存:', track.id, track.title)
          resolve(null)
        }
      }
      
      request.onerror = () => {
        console.error('[StreamCache] 从 IndexedDB 加载音频文件失败:', request.error)
        resolve(null)
      }
    })
  } catch (error) {
    console.error('[StreamCache] 加载音频文件失败:', error)
    return null
  }
}

/**
 * 获取缓存的 URL（不加载音频文件）
 */
export const getCachedUrl = (trackId: string): string | null => {
  try {
    const key = getCacheKey(trackId)
    const raw = localStorage.getItem(key)
    if (raw) {
      const cacheData: StreamCacheData = JSON.parse(raw)
      if (cacheData.stream && cacheData.stream.url) {
        return cacheData.stream.url
      }
    }
    return null
  } catch (error) {
    console.warn('[StreamCache] 获取缓存的 URL 失败:', error)
    return null
  }
}

/**
 * 保存音频流 URL 到缓存（localStorage）
 */
export const saveStreamCache = (track: PluginTrack, stream: PluginStream, hasAudioFile = false): void => {
  try {
    const key = getCacheKey(track.id)
    const oldRaw = localStorage.getItem(key)
    let oldUrl: string | null = null
    
    // 检查旧的 URL
    if (oldRaw) {
      try {
        const oldCacheData: StreamCacheData = JSON.parse(oldRaw)
        oldUrl = oldCacheData.stream?.url || null
      } catch (error) {
        // 忽略解析错误
      }
    }
    
    // 检查 URL 是否变化
    const urlChanged = oldUrl !== stream.url
    
    const cacheData: StreamCacheData = {
      stream,
      trackId: track.id,
      timestamp: Date.now(),
      hasAudioFile,
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
    
    if (urlChanged && oldUrl) {
      console.log('[StreamCache] URL 已更新，trackId:', track.id, 'title:', track.title, '旧 URL:', oldUrl, '新 URL:', stream.url)
    } else {
      console.log('[StreamCache] 已缓存音频流 URL:', track.id, track.title, 'hasAudioFile:', hasAudioFile, 'url:', stream.url)
    }
  } catch (error) {
    console.warn('[StreamCache] 保存 URL 缓存失败:', error)
  }
}

/**
 * 从缓存读取音频流（优先使用音频文件缓存，其次使用 URL 缓存）
 */
export const loadStreamCache = async (track: PluginTrack): Promise<{ url: string; lyrics?: string; _isBlobUrl: boolean } | null> => {
  try {
    // 优先检查音频文件缓存（IndexedDB）
    const cacheResult = await loadAudioFileCache(track)
    if (cacheResult) {
      // 创建 blob URL
      const blobUrl = URL.createObjectURL(cacheResult.blob)
      console.log('[StreamCache] 从缓存加载音频文件，trackId:', track.id, 'title:', track.title)
      return {
        url: blobUrl,
        lyrics: cacheResult.lyrics,
        _isBlobUrl: true, // 标记这是 blob URL，需要释放
      }
    }
    
    // 如果没有音频文件缓存，检查 URL 缓存（localStorage）
    const key = getCacheKey(track.id)
    const raw = localStorage.getItem(key)
    if (raw) {
      try {
        const cacheData: StreamCacheData = JSON.parse(raw)
        
        // 验证 trackId 是否匹配
        if (cacheData.trackId !== track.id) {
          console.warn('[StreamCache] 缓存 trackId 不匹配，清除缓存')
          localStorage.removeItem(key)
          return null
        }
        
        // 验证 stream 数据是否有效
        if (!cacheData.stream || !cacheData.stream.url) {
          console.warn('[StreamCache] URL 缓存数据无效，清除缓存')
          localStorage.removeItem(key)
          return null
        }
        
        console.log('[StreamCache] 从缓存加载音频流 URL:', track.id, 'title:', track.title, 'url:', cacheData.stream.url)
        return {
          url: cacheData.stream.url,
          lyrics: (cacheData.stream as any)?.extra?.lrc || (cacheData.stream as any)?.lrc,
          _isBlobUrl: false,
        }
      } catch (error) {
        console.warn('[StreamCache] 解析 URL 缓存失败:', error)
        localStorage.removeItem(key)
        return null
      }
    }
    
    return null
  } catch (error) {
    console.warn('[StreamCache] 读取缓存失败:', error)
    return null
  }
}

/**
 * 清除指定歌曲的缓存（包括音频文件和 URL）
 */
export const clearStreamCache = async (trackId: string): Promise<void> => {
  try {
    // 清除 localStorage 中的 URL 缓存
    const key = getCacheKey(trackId)
    localStorage.removeItem(key)
    
    // 清除 IndexedDB 中的音频文件
    try {
      const database = await initDB()
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      await new Promise<void>((resolve) => {
        const request = store.delete(trackId)
        request.onsuccess = () => {
          console.log('[StreamCache] 已清除缓存（包括音频文件和 URL）:', trackId)
          resolve()
        }
        request.onerror = () => {
          console.warn('[StreamCache] 清除 IndexedDB 缓存失败:', request.error)
          resolve() // 即使失败也继续
        }
      })
    } catch (error) {
      console.warn('[StreamCache] 清除 IndexedDB 缓存失败:', error)
    }
  } catch (error) {
    console.warn('[StreamCache] 清除缓存失败:', error)
  }
}

/**
 * 清除所有缓存（包括音频文件和 URL）
 */
export const clearAllStreamCache = async (): Promise<void> => {
  try {
    // 清除 localStorage 中的 URL 缓存
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keys.push(key)
      }
    }
    keys.forEach(key => localStorage.removeItem(key))
    
    // 清除 IndexedDB 中的所有音频文件
    try {
      const database = await initDB()
      const transaction = database.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      
      await new Promise<void>((resolve) => {
        const request = store.clear()
        request.onsuccess = () => {
          console.log('[StreamCache] 已清除所有缓存（包括音频文件和 URL），共', keys.length, '条 URL 缓存')
          resolve()
        }
        request.onerror = () => {
          console.warn('[StreamCache] 清除所有 IndexedDB 缓存失败:', request.error)
          resolve() // 即使失败也继续
        }
      })
    } catch (error) {
      console.warn('[StreamCache] 清除所有 IndexedDB 缓存失败:', error)
    }
  } catch (error) {
    console.warn('[StreamCache] 清除所有缓存失败:', error)
  }
}

/**
 * 获取缓存统计信息
 */
export const getStreamCacheStats = async (): Promise<{ count: number; size: number }> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<{ count: number; size: number }>((resolve) => {
      const request = store.count()
      
      request.onsuccess = () => {
        // 计算总大小需要遍历所有记录
        let size = 0
        const countRequest = store.openCursor()
        
        countRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
          if (cursor) {
            const data = cursor.value as AudioFileCacheData
            if (data.blob instanceof Blob) {
              size += data.blob.size
            }
            cursor.continue()
          } else {
            resolve({ count: request.result, size })
          }
        }
        
        countRequest.onerror = () => {
          resolve({ count: request.result, size: 0 })
        }
      }
      
      request.onerror = () => {
        resolve({ count: 0, size: 0 })
      }
    })
  } catch (error) {
    console.warn('[StreamCache] 获取统计信息失败:', error)
    return { count: 0, size: 0 }
  }
}

