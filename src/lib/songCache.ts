import type { PluginTrack, PluginStream } from '../types/plugin'

// IndexedDB 配置
const DB_NAME = 'musicfree-song-cache'
const DB_VERSION = 1
const STORE_NAME = 'songs'

// 完整的歌曲缓存数据结构
export interface CachedSong {
  // 歌曲基本信息（来自 PluginTrack）
  trackId: string
  title: string
  artists: string[]
  album?: string
  coverUrl?: string
  duration?: number
  extra?: Record<string, unknown>
  
  // 音频数据
  audioBlob: Blob
  audioMimeType?: string
  
  // 歌词数据
  lyrics?: string
  
  // 流信息（原始 URL 等）
  streamUrl?: string
  streamHeaders?: Record<string, string>
  
  // 元数据
  cachedAt: number // 缓存时间戳
  cachedSize: number // 缓存大小（字节）
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
      console.error('[SongCache] IndexedDB 打开失败:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'trackId' })
        // 创建索引以便查询
        store.createIndex('cachedAt', 'cachedAt', { unique: false })
        store.createIndex('title', 'title', { unique: false })
      }
    }
  })
}

/**
 * 保存完整的歌曲到缓存
 * @param audioBlob 音频 Blob 数据，如果为 null 则只保存元数据（URL、歌词等）
 */
export const saveSongCache = async (
  track: PluginTrack,
  audioBlob: Blob | null,
  stream: PluginStream,
  lyrics?: string
): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    // 如果 audioBlob 为 null，创建一个空的 Blob 作为占位符
    // 这样至少可以保存元数据，音频数据由浏览器缓存管理
    const blobToSave = audioBlob || new Blob([], { type: stream.mimeType || 'audio/mpeg' })
    
    const cachedSong: CachedSong = {
      trackId: track.id,
      title: track.title,
      artists: track.artists || [],
      album: track.album,
      coverUrl: track.coverUrl,
      duration: track.duration,
      extra: track.extra,
      audioBlob: blobToSave,
      audioMimeType: stream.mimeType,
      lyrics: lyrics,
      streamUrl: stream.url,
      streamHeaders: stream.headers,
      cachedAt: Date.now(),
      cachedSize: blobToSave.size,
    }
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(cachedSong)
      
      request.onsuccess = async () => {
        // 获取当前缓存数量
        const countRequest = store.count()
        countRequest.onsuccess = () => {
          const sizeText = blobToSave.size > 0 ? `${(blobToSave.size / 1024 / 1024).toFixed(2)} MB` : '元数据（音频由浏览器缓存）'
          console.log('[SongCache] ✓ 已缓存完整歌曲:', track.id, track.title, '大小:', sizeText, '当前缓存总数:', countRequest.result)
        }
        resolve()
      }
      
      request.onerror = () => {
        console.error('[SongCache] 保存歌曲缓存失败:', request.error)
        reject(request.error)
      }
    })
  } catch (error) {
    console.error('[SongCache] 保存歌曲缓存失败:', error)
    throw error
  }
}

/**
 * 检查歌曲是否已缓存（仅检查是否存在，不加载完整数据）
 */
export const isSongCached = async (trackId: string): Promise<boolean> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<boolean>((resolve) => {
      const request = store.get(trackId)
      
      request.onsuccess = () => {
        const result = request.result as CachedSong | undefined
        resolve(!!result)
      }
      
      request.onerror = () => {
        resolve(false)
      }
    })
  } catch (error) {
    console.error('[SongCache] 检查歌曲缓存失败:', error)
    return false
  }
}

/**
 * 从缓存加载完整歌曲
 */
export const loadSongCache = async (trackId: string): Promise<CachedSong | null> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<CachedSong | null>(async (resolve) => {
      const request = store.get(trackId)
      
      request.onsuccess = async () => {
        const result = request.result as CachedSong | undefined
        
        if (result) {
          // 如果 IndexedDB 中有音频 Blob，直接返回
          if (result.audioBlob instanceof Blob && result.audioBlob.size > 0) {
            console.log('[SongCache] ✓ 从 IndexedDB 加载完整歌曲（包含 Blob）:', trackId, result.title, '大小:', (result.audioBlob.size / 1024 / 1024).toFixed(2), 'MB')
            resolve(result)
            return
          }
          
          // 如果 IndexedDB 中只有元数据（没有音频 Blob），但有 streamUrl
          // 说明音频本体由 Service Worker 在 Cache Storage 中缓存
          // 直接返回元数据，播放时会使用 URL，Service Worker 会自动从缓存返回
          if (result.streamUrl) {
            console.log('[SongCache] ✓ 从 IndexedDB 加载歌曲元数据，音频本体由 Service Worker 缓存:', trackId, result.title, 'URL:', result.streamUrl.substring(0, 50))
            // 创建一个空的 Blob 作为占位符（实际播放时使用 URL）
            result.audioBlob = new Blob([], { type: result.audioMimeType || 'audio/mpeg' })
            resolve(result)
            return
          }
          
          // 如果既没有 Blob 也没有 streamUrl，返回 null
          console.log('[SongCache] ✗ 缓存中未找到歌曲数据:', trackId)
          resolve(null)
        } else {
          console.log('[SongCache] ✗ 缓存中未找到歌曲:', trackId)
          resolve(null)
        }
      }
      
      request.onerror = () => {
        console.error('[SongCache] 加载歌曲缓存失败:', request.error)
        resolve(null)
      }
    })
  } catch (error) {
    console.error('[SongCache] 加载歌曲缓存失败:', error)
    return null
  }
}


/**
 * 获取所有缓存的歌曲列表
 */
export const getAllCachedSongs = async (): Promise<CachedSong[]> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<CachedSong[]>((resolve) => {
      const songs: CachedSong[] = []
      const request = store.openCursor()
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          songs.push(cursor.value as CachedSong)
          cursor.continue()
        } else {
          // 按缓存时间倒序排列（最新的在前）
          songs.sort((a, b) => b.cachedAt - a.cachedAt)
          console.log('[SongCache] 获取所有缓存歌曲，共', songs.length, '首')
          resolve(songs)
        }
      }
      
      request.onerror = () => {
        console.error('[SongCache] 获取所有缓存歌曲失败:', request.error)
        resolve([])
      }
    })
  } catch (error) {
    console.error('[SongCache] 获取所有缓存歌曲失败:', error)
    return []
  }
}

/**
 * 删除指定歌曲的缓存
 */
export const deleteSongCache = async (trackId: string): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await new Promise<void>((resolve) => {
      const request = store.delete(trackId)
      request.onsuccess = () => {
        console.log('[SongCache] ✓ 已删除歌曲缓存:', trackId)
        resolve()
      }
      request.onerror = () => {
        console.error('[SongCache] 删除歌曲缓存失败:', request.error)
        resolve() // 即使失败也继续
      }
    })
  } catch (error) {
    console.error('[SongCache] 删除歌曲缓存失败:', error)
  }
}

/**
 * 清除所有缓存
 */
export const clearAllSongCache = async (): Promise<void> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    await new Promise<void>((resolve) => {
      const request = store.clear()
      request.onsuccess = () => {
        console.log('[SongCache] ✓ 已清除所有歌曲缓存')
        resolve()
      }
      request.onerror = () => {
        console.error('[SongCache] 清除所有缓存失败:', request.error)
        resolve()
      }
    })
  } catch (error) {
    console.error('[SongCache] 清除所有缓存失败:', error)
  }
}

/**
 * 获取缓存统计信息
 */
export const getCacheStats = async (): Promise<{ count: number; totalSize: number }> => {
  try {
    const database = await initDB()
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise<{ count: number; totalSize: number }>((resolve) => {
      let totalSize = 0
      let count = 0
      const request = store.openCursor()
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const song = cursor.value as CachedSong
          totalSize += song.cachedSize || 0
          count++
          cursor.continue()
        } else {
          resolve({ count, totalSize })
        }
      }
      
      request.onerror = () => {
        resolve({ count: 0, totalSize: 0 })
      }
    })
  } catch (error) {
    console.error('[SongCache] 获取统计信息失败:', error)
    return { count: 0, totalSize: 0 }
  }
}

/**
 * 生成文件名（根据命名规则）
 */
const generateFileName = (song: CachedSong): string => {
  // 处理歌手：超过3个用"群星"，否则用顿号分割
  let artistName: string
  if (!song.artists || song.artists.length === 0) {
    artistName = '未知歌手'
  } else if (song.artists.length > 3) {
    artistName = '群星'
  } else {
    artistName = song.artists.join('、')
  }
  
  // 构建文件名
  const title = song.title || '未知歌曲'
  let fileName: string
  if (song.album && song.album.trim()) {
    fileName = `${artistName} - ${song.album} - ${title}`
  } else {
    fileName = `${artistName} - ${title}`
  }
  
  // 清理文件名中的非法字符（Windows/Linux/Mac 不支持的字符）
  fileName = fileName.replace(/[<>:"/\\|?*]/g, '')
  
  return fileName
}

/**
 * 导出歌曲缓存为文件（歌曲文件 + 歌词文件）
 */
export const exportSongCache = async (song: CachedSong): Promise<void> => {
  try {
    const baseFileName = generateFileName(song)
    
    // 获取音频文件扩展名
    const audioExt = song.audioMimeType?.split('/')[1] || 'mp3'
    
    // 创建下载链接
    const audioBlobUrl = URL.createObjectURL(song.audioBlob)
    
    // 下载音频文件
    const audioLink = document.createElement('a')
    audioLink.href = audioBlobUrl
    audioLink.download = `${baseFileName}.${audioExt}`
    document.body.appendChild(audioLink)
    audioLink.click()
    document.body.removeChild(audioLink)
    
    // 如果有歌词，下载歌词文件（.lrc 格式）
    if (song.lyrics && song.lyrics.trim().length > 0) {
      // 延迟一下，避免浏览器阻止多个下载
      await new Promise(resolve => setTimeout(resolve, 300))
      
      const lyricsBlob = new Blob([song.lyrics], { type: 'text/plain;charset=utf-8' })
      const lyricsBlobUrl = URL.createObjectURL(lyricsBlob)
      
      const lyricsLink = document.createElement('a')
      lyricsLink.href = lyricsBlobUrl
      lyricsLink.download = `${baseFileName}.lrc`
      document.body.appendChild(lyricsLink)
      lyricsLink.click()
      document.body.removeChild(lyricsLink)
      
      // 清理歌词 blob URL
      setTimeout(() => {
        URL.revokeObjectURL(lyricsBlobUrl)
      }, 100)
    }
    
    // 清理音频 blob URL
    setTimeout(() => {
      URL.revokeObjectURL(audioBlobUrl)
    }, 100)
    
    console.log('[SongCache] ✓ 已导出歌曲:', baseFileName)
  } catch (error) {
    console.error('[SongCache] 导出歌曲失败:', error)
    throw error
  }
}

/**
 * 批量导出歌曲缓存
 */
export const exportAllSongsCache = async (songs: CachedSong[]): Promise<void> => {
  for (const song of songs) {
    try {
      await exportSongCache(song)
      // 添加延迟避免浏览器阻止多个下载（每首歌需要下载音频和可能的歌词，所以延迟更长）
      await new Promise(resolve => setTimeout(resolve, 800))
    } catch (error) {
      console.error('[SongCache] 导出歌曲失败:', song.title, error)
    }
  }
}
