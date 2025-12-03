// LRC 歌词解析工具

export interface LyricLine {
  time: number // 时间（秒）
  text: string // 歌词文本
}

/**
 * 解析 LRC 格式歌词
 * @param lrcText LRC 格式的歌词文本
 * @returns 解析后的歌词行数组
 */
export function parseLRC(lrcText: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') {
    return []
  }

  const lines = lrcText.split('\n')
  const lyrics: LyricLine[] = []

  // LRC 时间标签格式: [mm:ss.xx] 或 [mm:ss]
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 匹配所有时间标签
    const timeMatches = Array.from(trimmed.matchAll(timeRegex))
    if (timeMatches.length === 0) continue

    // 提取歌词文本（移除所有时间标签）
    const text = trimmed.replace(timeRegex, '').trim()

    // 为每个时间标签创建一行歌词
    for (const match of timeMatches) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0

      const time = minutes * 60 + seconds + milliseconds / 1000
      lyrics.push({ time, text })
    }
  }

  // 按时间排序
  lyrics.sort((a, b) => a.time - b.time)

  return lyrics
}

/**
 * 根据当前播放时间获取当前歌词行索引
 * @param lyrics 歌词行数组
 * @param currentTime 当前播放时间（秒）
 * @returns 当前歌词行索引，如果没有找到返回 -1
 */
export function getCurrentLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0) return -1

  // 从后往前查找，找到最后一个时间小于等于当前时间的歌词行
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      return i
    }
  }

  return -1
}

/**
 * 获取当前歌词行
 * @param lyrics 歌词行数组
 * @param currentTime 当前播放时间（秒）
 * @returns 当前歌词行，如果没有返回 null
 */
export function getCurrentLyric(lyrics: LyricLine[], currentTime: number): LyricLine | null {
  const index = getCurrentLyricIndex(lyrics, currentTime)
  return index >= 0 ? lyrics[index] : null
}

