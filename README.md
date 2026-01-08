# MusicFree H5

一个“轻量级 + 插件驱动”的 Web 端音乐播放器，灵感来自原生应用版本的 [MusicFree](https://github.com/maotoumao/MusicFree)。核心理念仍然是不绑定任何音源，所有搜索与播放能力都通过插件脚本注入。

> **注意**：本项目只提供播放器壳，不内置、不托管任何音源或第三方接口。

## ✨ 核心功能

### 🎵 播放功能
- **音频播放控制**：播放/暂停、上一首/下一首、进度控制、音量调节
- **播放模式**：顺序播放、随机播放、单曲循环
- **播放器界面**：MiniPlayer（底部迷你播放器）和全屏 Player
- **错误处理**：自动重试机制，播放失败时提供重试按钮

### 🔍 搜索功能
- **多类型搜索**：支持搜索歌曲、歌手、专辑、歌单
- **搜索结果展示**：分页加载、无限滚动
- **详情页**：查看歌手/专辑/歌单详情，浏览相关歌曲列表
- **快速操作**：一键播放、添加到播放列表、收藏

### 📋 播放列表管理
- **当前播放列表**：管理正在播放的歌曲队列
- **播放历史**：自动记录最近播放的 200 首歌曲
- **收藏功能**：收藏歌曲、歌手、专辑、歌单
- **列表操作**：添加、删除、清空、拖拽排序

### 💾 智能缓存系统
- **Service Worker 缓存**：自动缓存音频文件到 Cache Storage，支持离线播放
- **IndexedDB 存储**：持久化存储歌曲元数据（标题、艺术家、专辑、歌词等）
- **缓存状态显示**：在播放列表、历史、收藏中实时显示缓存图标
- **缓存策略**：优先从缓存加载，缓存未命中时自动从网络获取并缓存

### 🎤 歌词功能
- **LRC 格式支持**：自动解析和显示 LRC 格式歌词
- **歌词同步**：歌词与播放进度同步高亮显示
- **歌词缓存**：歌词数据随歌曲一起缓存到 IndexedDB

### 🔌 插件系统
- **多订阅源管理**：内置默认订阅源，支持自定义 `plugins.json`
- **插件生命周期**：安装、启用/停用、卸载，状态持久化到 localStorage
- **远程脚本沙箱**：插件脚本通过 `fetch + Function` 注入，运行在受控上下文
- **CORS 代理兜底**：自动切换多个公共代理，确保插件加载成功

## 📁 项目结构

```
src/
├── components/          # React 组件
│   ├── MiniPlayer.tsx  # 迷你播放器
│   ├── Player.tsx      # 全屏播放器
│   ├── PlaylistView.tsx # 播放列表管理
│   ├── SearchView.tsx  # 搜索界面
│   └── PluginManager.tsx # 插件管理
├── lib/                # 工具库
│   ├── lyrics.ts       # 歌词解析
│   ├── pluginHost.ts   # 插件宿主环境
│   ├── songCache.ts    # 歌曲缓存管理（IndexedDB）
│   ├── streamCache.ts  # 流缓存（已废弃）
│   └── swCache.ts      # Service Worker 缓存工具
├── stores/             # 状态管理（Zustand）
│   ├── playerStore.ts  # 播放器状态
│   ├── pluginStore.ts  # 插件状态
│   └── favoriteStore.ts # 收藏状态
├── types/              # TypeScript 类型定义
│   └── plugin.ts       # 插件类型
└── styles/            # 样式文件
    └── index.css       # 全局样式

public/
├── sw.js              # Service Worker 脚本（音频缓存）
├── plugins/           # 示例插件
│   ├── demo.radio.js  # 示例插件
│   └── mirror/        # 镜像插件
└── feeds.default.json # 默认插件订阅源
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
# 或
yarn install
```

### 开发模式

```bash
npm run dev
```

访问 `http://localhost:5173` 查看应用。

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

### 启动生产服务器

```bash
npm start
```

## 🎯 主要技术栈

- **框架**：React 18 + TypeScript
- **构建工具**：Vite 5
- **状态管理**：Zustand（带持久化）
- **UI 动画**：Framer Motion
- **样式**：Tailwind CSS
- **图标**：Lucide React
- **存储**：IndexedDB（歌曲元数据）+ Cache Storage（音频文件）
- **缓存**：Service Worker（音频缓存）

## 🔌 插件开发约定（H5 版）

插件脚本需要在浏览器环境运行，推荐直接调用 `MusicFreeH5.registerPlugin` 注册实例：

```js
;(function () {
  MusicFreeH5.registerPlugin(() => ({
    name: 'Sample Plugin',
    version: '0.1.0',
    capabilities: ['search', 'stream'],
    
    // 搜索歌曲
    async searchSongs(query, page = 1) {
      const response = await fetch(`https://api.example.com/search?q=${query}&page=${page}`)
      const data = await response.json()
      
      return data.songs.map((item) => ({
        id: item.id,
        title: item.title,
        artists: item.artists || [item.artist],
        album: item.album,
        coverUrl: item.cover,
        duration: item.duration,
      }))
    },
    
    // 解析音频流
    async resolveStream(track) {
      const response = await fetch(`https://api.example.com/stream/${track.id}`)
      const data = await response.json()
      
      return {
        url: data.streamUrl,
        // 可选：歌词数据
        extra: {
          lrc: data.lyrics, // LRC 格式歌词字符串
        },
      }
    },
    
    // 可选：搜索歌手
    async searchArtists(query, page = 1) {
      // 返回歌手列表
    },
    
    // 可选：搜索专辑
    async searchAlbums(query, page = 1) {
      // 返回专辑列表
    },
    
    // 可选：搜索歌单
    async searchPlaylists(query, page = 1) {
      // 返回歌单列表
    },
    
    // 可选：获取歌手歌曲列表
    async getArtistSongs(artist, page = 1) {
      // 返回歌曲列表
    },
    
    // 可选：获取专辑歌曲列表
    async getAlbumSongs(album, page = 1) {
      // 返回歌曲列表
    },
    
    // 可选：获取歌单歌曲列表
    async getPlaylistSongs(playlist, page = 1) {
      // 返回歌曲列表
    },
  }))
})()
```

### 插件上下文

注入时会提供以下受限能力：

| 能力            | 说明                                   |
| --------------- | -------------------------------------- |
| `fetch`         | 等同于浏览器 `fetch`，不可使用 Node API |
| `console`       | 自动带上插件前缀，便于调试             |
| `descriptor`    | 订阅源中的 name/url/version 信息       |

和原始 MusicFree 仓库的 Node 版插件不同，此处不支持 `require('axios')`、`cheerio` 等 Node 依赖，如果需要解析可以自己在浏览器环境实现。

## 💾 缓存机制说明

### Service Worker 缓存
- **音频文件缓存**：Service Worker 拦截音频请求，自动缓存到 Cache Storage
- **离线支持**：缓存的音频可以在离线状态下播放
- **透明缓存**：对用户和插件完全透明，无需额外配置

### IndexedDB 存储
- **歌曲元数据**：存储歌曲的完整信息（标题、艺术家、专辑、封面、歌词等）
- **缓存状态**：在播放列表、历史、收藏中显示缓存图标
- **实时更新**：缓存完成后自动更新列表中的缓存状态

### 缓存策略
1. **播放时**：优先从 IndexedDB 加载歌曲元数据
2. **音频加载**：如果 IndexedDB 中有元数据，使用原始 URL（Service Worker 自动从缓存返回）
3. **缓存完成**：音频播放完成后，自动保存元数据到 IndexedDB，Service Worker 自动缓存音频文件

## 🎨 UI 特性

- **响应式设计**：适配移动端和桌面端
- **流畅动画**：使用 Framer Motion 实现平滑的页面过渡和交互
- **深色主题**：现代化的深色 UI 设计
- **玻璃态效果**：使用 Tailwind CSS 实现毛玻璃效果

## 📱 功能模块

### 搜索模块（SearchView）
- 搜索歌曲、歌手、专辑、歌单
- 搜索结果分页加载
- 查看详情页（歌手/专辑/歌单）
- 一键播放、添加到播放列表、收藏

### 播放列表模块（PlaylistView）
- **当前播放**：管理播放队列，支持拖拽排序
- **播放历史**：查看最近播放的歌曲
- **收藏管理**：管理收藏的歌曲、歌手、专辑、歌单
- **缓存状态**：实时显示歌曲缓存状态

### 播放器模块（Player / MiniPlayer）
- **MiniPlayer**：底部固定迷你播放器，显示当前播放信息
- **全屏播放器**：点击 MiniPlayer 展开全屏播放界面
- **播放控制**：播放/暂停、上一首/下一首、进度控制
- **歌词显示**：同步显示歌词，高亮当前播放行

### 插件管理模块（PluginManager）
- 查看已安装的插件
- 启用/停用插件
- 卸载插件
- 添加自定义插件
- 管理插件订阅源

## 🛡️ 已知限制

- 大部分官方 MusicFree 插件依赖 Node.js 模块（如 axios、cheerio），不能直接在浏览器运行，需要针对 H5 版本重写
- 插件脚本目前共享页面上下文，不建议执行高危操作；如需进一步隔离，可将脚本改为 iframe/worker 方案
- Service Worker 缓存的音频文件无法直接读取内容（opaque 响应限制），但可以正常播放
- 缓存大小受浏览器存储限制，建议定期清理不需要的缓存

## 📚 参考

- [MusicFree 原生项目](https://github.com/maotoumao/MusicFree)：H5 版的交互、插件订阅源格式与其保持一致

## 📄 许可证

本项目遵循原 MusicFree 项目的许可证。
