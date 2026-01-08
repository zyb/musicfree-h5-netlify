/**
 * MSE (Media Source Extensions) 音频播放器
 * 用于播放浏览器原生不支持的音频格式，如 B站的 m4s (MPEG-DASH) 格式
 */

// 检测浏览器是否支持 MSE
export const isMSESupported = (): boolean => {
  return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"')
}

// 检测是否是需要 MSE 播放的 URL
export const needsMSEPlayback = (url: string): boolean => {
  if (!url) return false
  // B站 DASH 音频流（m4s 格式）
  return url.includes('.m4s')
}

// B站音频域名列表
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

// 检测是否是B站音频 URL（需要代理）
const isBiliAudioUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return biliAudioDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.bilivideo.com')
    )
  } catch {
    return false
  }
}

// 获取代理 URL
const getProxiedUrl = (url: string): string => {
  if (isBiliAudioUrl(url)) {
    // 使用服务端代理（添加 Referer 头）
    return `/api/biliaudio?url=${encodeURIComponent(url)}`
  }
  return url
}

/**
 * 使用 MSE 加载并播放 m4s 音频
 * @param audioElement 音频元素
 * @param url m4s 音频 URL
 * @returns Promise，成功返回 MediaSource，失败抛出错误
 */
export const loadMSEAudio = async (
  audioElement: HTMLAudioElement,
  url: string
): Promise<MediaSource> => {
  if (!isMSESupported()) {
    throw new Error('浏览器不支持 Media Source Extensions')
  }

  console.log('[MSE] 开始加载 m4s 音频:', url.substring(0, 80))

  // 创建 MediaSource
  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  
  // 设置音频源
  audioElement.src = objectUrl

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('MSE 初始化超时'))
    }, 30000)

    mediaSource.addEventListener('sourceopen', async () => {
      console.log('[MSE] MediaSource 已打开')
      
      try {
        // 创建 SourceBuffer
        // B站音频通常是 AAC 编码
        const mimeType = 'audio/mp4; codecs="mp4a.40.2"'
        if (!MediaSource.isTypeSupported(mimeType)) {
          throw new Error(`不支持的音频格式: ${mimeType}`)
        }
        
        const sourceBuffer = mediaSource.addSourceBuffer(mimeType)
        console.log('[MSE] SourceBuffer 已创建')

        // 下载音频数据
        // B站 m4s 音频需要 Referer 头，通过服务端代理请求
        const proxiedUrl = getProxiedUrl(url)
        console.log('[MSE] 开始下载音频数据...', proxiedUrl.startsWith('/api/') ? '(通过代理)' : '(直接请求)')
        const response = await fetch(proxiedUrl, {
          mode: 'cors',
          credentials: 'omit', // 不发送 cookies
        })

        if (!response.ok) {
          throw new Error(`下载失败: ${response.status} ${response.statusText}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        console.log('[MSE] 音频数据下载完成，大小:', arrayBuffer.byteLength, 'bytes')

        // 等待 SourceBuffer 准备好
        const appendBuffer = () => {
          return new Promise<void>((resolveAppend, rejectAppend) => {
            const onUpdateEnd = () => {
              sourceBuffer.removeEventListener('updateend', onUpdateEnd)
              sourceBuffer.removeEventListener('error', onError)
              resolveAppend()
            }
            const onError = () => {
              sourceBuffer.removeEventListener('updateend', onUpdateEnd)
              sourceBuffer.removeEventListener('error', onError)
              rejectAppend(new Error('SourceBuffer 添加数据失败'))
            }
            sourceBuffer.addEventListener('updateend', onUpdateEnd)
            sourceBuffer.addEventListener('error', onError)
            sourceBuffer.appendBuffer(arrayBuffer)
          })
        }

        await appendBuffer()
        console.log('[MSE] 音频数据已添加到 SourceBuffer')

        // 标记流结束
        if (mediaSource.readyState === 'open') {
          mediaSource.endOfStream()
          console.log('[MSE] 流已结束')
        }

        clearTimeout(timeoutId)
        resolve(mediaSource)
      } catch (error) {
        clearTimeout(timeoutId)
        console.error('[MSE] 加载失败:', error)
        
        // 清理
        if (mediaSource.readyState === 'open') {
          try {
            mediaSource.endOfStream('decode')
          } catch {
            // 忽略
          }
        }
        
        reject(error)
      }
    })

    mediaSource.addEventListener('error', (e) => {
      clearTimeout(timeoutId)
      console.error('[MSE] MediaSource 错误:', e)
      reject(new Error('MediaSource 错误'))
    })
  })
}

/**
 * 清理 MSE 资源
 */
export const cleanupMSE = (audioElement: HTMLAudioElement): void => {
  const src = audioElement.src
  if (src && src.startsWith('blob:')) {
    URL.revokeObjectURL(src)
    console.log('[MSE] 已释放 blob URL')
  }
}
