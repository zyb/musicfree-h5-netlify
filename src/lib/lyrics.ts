// LRC 歌词行接口
export interface LyricLine {
  time: number // 时间戳（秒）
  text: string // 歌词文本
}

// 解析 LRC 格式歌词
export function parseLRC(lrcText: string): LyricLine[] {
  if (!lrcText || typeof lrcText !== 'string') {
    return []
  }

  const lines: LyricLine[] = []
  const linesArray = lrcText.split('\n')

  // 时间戳正则：[mm:ss.xx] 或 [mm:ss]
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g

  for (const line of linesArray) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 跳过元数据行（如 [ti:...], [ar:...] 等）
    if (trimmed.startsWith('[ti:') || 
        trimmed.startsWith('[ar:') || 
        trimmed.startsWith('[al:') || 
        trimmed.startsWith('[by:') ||
        trimmed.startsWith('[offset:')) {
      continue
    }

    // 查找所有时间戳
    const timeMatches = Array.from(trimmed.matchAll(timeRegex))
    if (timeMatches.length === 0) continue

    // 提取歌词文本（移除所有时间戳）
    let text = trimmed.replace(timeRegex, '').trim()
    if (!text) continue

    // 为每个时间戳创建一行歌词
    for (const match of timeMatches) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      const milliseconds = match[3] 
        ? parseInt(match[3].padEnd(3, '0'), 10) 
        : 0

      const time = minutes * 60 + seconds + milliseconds / 1000
      lines.push({ time, text })
    }
  }

  // 按时间排序
  lines.sort((a, b) => a.time - b.time)

  return lines
}

// 根据当前播放时间获取当前歌词行索引
export function getCurrentLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0) return -1

  // 找到最后一个时间小于等于当前时间的歌词行
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      return i
    }
  }

  return -1
}

// 获取当前歌词行
export function getCurrentLyric(lyrics: LyricLine[], currentTime: number): string {
  const index = getCurrentLyricIndex(lyrics, currentTime)
  return index >= 0 ? lyrics[index].text : ''
}

// 获取当前歌词和下一句歌词（用于显示）
export function getCurrentAndNextLyric(lyrics: LyricLine[], currentTime: number): {
  current: string
  next: string
  isCurrentActive: boolean
} {
  const currentIndex = getCurrentLyricIndex(lyrics, currentTime)
  
  // 如果找到了当前歌词
  if (currentIndex >= 0) {
    const current = lyrics[currentIndex].text
    const next = currentIndex + 1 < lyrics.length ? lyrics[currentIndex + 1].text : ''
    return {
      current,
      next,
      isCurrentActive: true,
    }
  }
  
  // 如果没找到当前歌词，返回下一句歌词（如果存在）
  const nextIndex = lyrics.findIndex(line => line.time > currentTime)
  if (nextIndex >= 0) {
    return {
      current: lyrics[nextIndex].text,
      next: nextIndex + 1 < lyrics.length ? lyrics[nextIndex + 1].text : '',
      isCurrentActive: false,
    }
  }
  
  // 如果所有歌词都过了，返回最后一句
  if (lyrics.length > 0) {
    return {
      current: lyrics[lyrics.length - 1].text,
      next: '',
      isCurrentActive: false,
    }
  }
  
  return {
    current: '',
    next: '',
    isCurrentActive: false,
  }
}

