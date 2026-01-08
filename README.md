# MusicFree H5

一个"轻量级 + 插件驱动"的 Web 端音乐播放器，灵感来自原生应用版本的 [MusicFree](https://github.com/maotoumao/MusicFree)。核心理念仍然是不绑定任何音源，所有搜索与播放能力都通过插件脚本注入。

> **注意**：本项目只提供播放器壳，不内置、不托管任何音源或第三方接口。

## ✨ 核心功能

### 🎵 播放功能
- **音频播放控制**：播放/暂停、上一首/下一首、进度控制、音量调节
- **播放模式**：顺序播放、随机播放、单曲循环
- **播放器界面**：MiniPlayer（底部迷你播放器）和全屏 Player
- **错误处理**：自动重试机制，播放失败时提供重试按钮
- **MSE 支持**：支持 B站 m4s 等特殊格式的音频播放

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
- **Serverless 代理**：通过 Netlify Functions 处理所有 API 请求，解决 CORS 问题
- **媒体资源优化**：图片、音频、视频等媒体资源直接请求，不走代理

## 📁 项目结构

```
musicfree-h5-netlify/
├── src/                          # 源代码目录
│   ├── components/              # React 组件
│   │   ├── MiniPlayer.tsx       # 迷你播放器组件
│   │   ├── Player.tsx           # 全屏播放器组件
│   │   ├── PlaylistView.tsx     # 播放列表管理组件
│   │   ├── SearchView.tsx       # 搜索界面组件
│   │   └── PluginManager.tsx    # 插件管理组件
│   ├── lib/                     # 核心工具库
│   │   ├── lyrics.ts           # LRC 歌词解析工具
│   │   ├── pluginHost.ts       # 插件宿主环境（核心）
│   │   ├── songCache.ts        # 歌曲缓存管理（IndexedDB）
│   │   ├── msePlayer.ts        # MSE 音频播放器（B站 m4s 支持）
│   │   └── swCache.ts          # Service Worker 缓存工具
│   ├── stores/                  # 状态管理（Zustand）
│   │   ├── playerStore.ts      # 播放器状态管理
│   │   ├── pluginStore.ts      # 插件状态管理
│   │   └── favoriteStore.ts    # 收藏状态管理
│   ├── types/                   # TypeScript 类型定义
│   │   └── plugin.ts           # 插件相关类型定义
│   ├── styles/                  # 样式文件
│   │   └── index.css           # 全局样式（Tailwind CSS）
│   ├── App.tsx                  # 主应用组件
│   └── main.tsx                 # 应用入口文件
├── public/                      # 静态资源目录
│   ├── sw.js                   # Service Worker 脚本（音频缓存）
│   ├── plugins/                # 示例插件
│   │   ├── demo.radio.js       # 示例插件
│   │   └── mirror/             # 镜像插件目录
│   ├── feeds.default.json      # 默认插件订阅源配置
│   ├── manifest.json           # PWA 清单文件
│   └── favicon.svg             # 网站图标
├── netlify/                     # Netlify 部署配置
│   └── functions/              # Netlify Functions
│       └── proxy.js            # API 代理 Serverless 函数
├── server.js                    # 本地开发服务器（可选）
├── vite.config.ts              # Vite 构建配置
├── netlify.toml                # Netlify 部署配置
├── tailwind.config.js          # Tailwind CSS 配置
├── tsconfig.json               # TypeScript 配置
└── package.json                # 项目依赖配置
```

## 📦 模块详细说明

### 🎨 组件模块（`src/components/`）

#### `App.tsx` - 主应用组件
- **功能**：应用根组件，管理整体布局和路由
- **职责**：
  - 管理底部导航栏（搜索、列表、订阅）
  - 控制全屏播放器的显示/隐藏
  - 处理音频播放逻辑和错误重试
  - 协调各个子组件之间的交互

#### `MiniPlayer.tsx` - 迷你播放器
- **功能**：底部固定的迷你播放器
- **职责**：
  - 显示当前播放歌曲信息（封面、标题、艺术家）
  - 提供播放/暂停、上一首/下一首快捷操作
  - 显示播放进度条
  - 点击展开全屏播放器

#### `Player.tsx` - 全屏播放器
- **功能**：全屏音乐播放界面
- **职责**：
  - 显示大尺寸封面图片
  - 显示完整歌词（同步高亮）
  - 提供完整的播放控制（进度、音量、播放模式）
  - 显示播放列表

#### `SearchView.tsx` - 搜索界面
- **功能**：音乐搜索和浏览界面
- **职责**：
  - 提供搜索输入框（支持歌曲、歌手、专辑、歌单搜索）
  - 展示搜索结果列表（分页加载）
  - 显示详情页（歌手/专辑/歌单详情）
  - 提供快速操作（播放、添加到列表、收藏）

#### `PlaylistView.tsx` - 播放列表管理
- **功能**：播放列表、历史、收藏管理界面
- **职责**：
  - 管理当前播放列表（拖拽排序、删除）
  - 显示播放历史（最近 200 首）
  - 管理收藏（歌曲、歌手、专辑、歌单）
  - 显示缓存状态

#### `PluginManager.tsx` - 插件管理
- **功能**：插件和订阅源管理界面
- **职责**：
  - 显示已安装的插件列表
  - 启用/停用插件
  - 卸载插件
  - 添加自定义插件
  - 管理插件订阅源

### 🔧 核心库模块（`src/lib/`）

#### `pluginHost.ts` - 插件宿主环境（核心模块）
- **功能**：插件系统的核心，提供插件加载、执行和管理功能
- **主要职责**：
  - **插件加载**：从远程 URL 或本地文件加载插件脚本
  - **插件执行**：在受控的沙箱环境中执行插件代码
  - **API 代理**：提供带代理的 `fetch` 和 `axios` 兼容接口，解决 CORS 问题
  - **媒体资源检测**：自动识别图片、音频、视频等媒体资源，直接请求不走代理
  - **URL 重写**：将外部 API URL 重写为本地代理路径（开发环境使用 Vite 代理，生产环境使用 Netlify Functions）
  - **插件适配**：将 MusicFree 原生插件格式适配为 H5 版本
  - **错误处理**：处理插件执行错误和网络错误
- **关键函数**：
  - `loadPluginInstance()`: 加载插件实例
  - `createProxiedFetch()`: 创建带代理的 fetch 函数
  - `rewriteUrl()`: URL 重写（映射到代理路径）
  - `isMediaUrl()`: 检测是否是媒体资源

#### `lyrics.ts` - 歌词解析工具
- **功能**：解析和操作 LRC 格式歌词
- **主要函数**：
  - `parseLRC()`: 解析 LRC 格式歌词文本，返回时间轴数组
  - `getCurrentLyricIndex()`: 根据当前播放时间获取当前歌词行索引
  - `getCurrentLyric()`: 获取当前播放时间对应的歌词文本
  - `getCurrentAndNextLyric()`: 获取当前和下一句歌词（用于显示）

#### `songCache.ts` - 歌曲缓存管理
- **功能**：使用 IndexedDB 存储和管理歌曲元数据
- **主要职责**：
  - **数据存储**：存储歌曲信息（标题、艺术家、专辑、封面、歌词等）
  - **缓存查询**：根据歌曲 ID 查询缓存数据
  - **缓存更新**：更新或删除缓存数据
  - **缓存清理**：清理过期或不需要的缓存
- **数据结构**：
  - `CachedSong`: 包含歌曲元数据、音频 Blob、歌词等完整信息

#### `msePlayer.ts` - MSE 音频播放器
- **功能**：使用 Media Source Extensions API 播放特殊格式音频
- **主要职责**：
  - **格式检测**：检测是否需要使用 MSE 播放（如 B站 m4s 格式）
  - **MSE 播放**：使用 MSE API 播放浏览器原生不支持的音频格式
  - **资源清理**：播放完成后清理 MSE 资源
- **使用场景**：主要用于播放 B站的 DASH 音频流（.m4s 格式）

#### `swCache.ts` - Service Worker 缓存工具
- **功能**：与 Service Worker 通信，管理音频文件缓存
- **主要职责**：
  - **缓存查询**：从 Service Worker 缓存中获取音频 Blob
  - **缓存状态**：检查音频是否已缓存
  - **缓存清理**：清理 Service Worker 缓存

### 📊 状态管理模块（`src/stores/`）

#### `playerStore.ts` - 播放器状态管理
- **功能**：管理播放器的所有状态
- **状态包括**：
  - 当前播放歌曲和音频流
  - 播放状态（播放/暂停、加载中）
  - 播放进度（当前时间、总时长）
  - 音量设置（音量、静音）
  - 播放模式（顺序、随机、单曲循环、列表循环）
  - 歌词数据
  - 播放列表
  - 播放历史（最近 200 首）
  - 错误状态
- **持久化**：使用 Zustand 的 persist 中间件，状态持久化到 localStorage

#### `pluginStore.ts` - 插件状态管理
- **功能**：管理插件和订阅源的状态
- **状态包括**：
  - 已安装的插件列表
  - 当前激活的插件 ID
  - 插件订阅源列表
  - 插件加载状态
- **主要操作**：
  - `init()`: 初始化插件系统，加载默认订阅源
  - `installPlugin()`: 安装新插件
  - `uninstallPlugin()`: 卸载插件
  - `setActivePlugin()`: 设置当前激活的插件
  - `addSubscription()`: 添加插件订阅源
  - `removeSubscription()`: 删除订阅源
- **持久化**：状态持久化到 localStorage

#### `favoriteStore.ts` - 收藏状态管理
- **功能**：管理用户的收藏内容
- **状态包括**：
  - 收藏的歌曲列表
  - 收藏的歌手列表
  - 收藏的专辑列表
  - 收藏的歌单列表
- **主要操作**：
  - `toggleSong()`: 切换歌曲收藏状态
  - `toggleArtist()`: 切换歌手收藏状态
  - `toggleAlbum()`: 切换专辑收藏状态
  - `togglePlaylist()`: 切换歌单收藏状态
  - `clearAll()`: 清空所有收藏
- **持久化**：状态持久化到 localStorage

### 🌐 服务端模块

#### `server.js` - 本地开发服务器
- **功能**：提供本地开发环境的静态文件服务和 API 代理
- **主要职责**：
  - 提供静态文件服务（`dist/` 目录）
  - 处理 `/api/proxy/*` 代理请求（开发环境）
  - 处理 `/api/biliaudio` B站音频流代理
  - SPA 路由支持（所有路由重定向到 `index.html`）
- **使用场景**：本地开发测试，生产环境使用 Netlify Functions

#### `netlify/functions/proxy.js` - Netlify Serverless 函数
- **功能**：生产环境的 API 代理服务
- **主要职责**：
  - 处理 `/api/proxy/*` 请求
  - 代理到目标 API 服务器
  - 添加必要的请求头（Referer、User-Agent 等）
  - 处理 CORS 响应头
- **部署**：自动部署到 Netlify，无需额外配置

#### `public/sw.js` - Service Worker 脚本
- **功能**：拦截和缓存音频文件请求
- **主要职责**：
  - 拦截音频文件请求（.mp3, .m4a, .flac 等）
  - 缓存音频文件到 Cache Storage
  - 提供离线播放支持
  - 管理缓存版本和清理

### ⚙️ 配置文件

#### `vite.config.ts` - Vite 构建配置
- **功能**：配置 Vite 开发服务器和构建选项
- **主要配置**：
  - React 插件配置
  - 开发服务器代理配置（`/api/proxy/*` 和 `/proxy/*`）
  - 路径别名配置（`@` 指向 `src/`）

#### `netlify.toml` - Netlify 部署配置
- **功能**：配置 Netlify 构建和部署选项
- **主要配置**：
  - 构建命令和发布目录
  - Functions 目录配置
  - 重定向规则（API 代理和 SPA 路由）
  - 安全头设置
  - 缓存策略

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

访问 `http://localhost:3000` 查看应用。

开发环境会自动使用 Vite 的代理配置处理 `/api/proxy/*` 请求。

### 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

### 本地生产服务器（可选）

```bash
npm start
```

启动本地服务器，用于测试生产构建。

## 🌐 部署到 Netlify

### 自动部署（推荐）

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "准备部署到 Netlify"
   git push
   ```

2. **在 Netlify 中连接仓库**
   - 登录 [Netlify](https://www.netlify.com/)
   - 点击 "Add new site" → "Import an existing project"
   - 选择你的 GitHub 仓库
   - Netlify 会自动检测 `netlify.toml` 配置

3. **部署完成**
   - Netlify 会自动构建和部署
   - 部署完成后会提供一个 URL（如 `your-project.netlify.app`）

### 手动部署

如果需要手动部署，可以使用 Netlify CLI：

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 部署
netlify deploy --prod
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
- **部署**：Netlify（Serverless Functions）

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

### API 代理说明

插件中的 `fetch` 请求会自动通过代理处理：

- **开发环境**：使用 Vite 配置的代理（`vite.config.ts`）
- **生产环境**：使用 Netlify Functions（`netlify/functions/proxy.js`）
- **媒体资源**：图片、音频、视频等媒体资源直接请求，不走代理

支持的代理类型包括：
- QQ 音乐 API（`qqmusic_c`, `qqmusic_u`, `qqmusic_i`）
- 网易云音乐 API（`netease`, `netease_interface`, `netease_interface3`）
- 酷我音乐 API（`kuwo_search`, `kuwo_m`, `kuwo_wapi` 等）
- 酷狗音乐 API（`kugou_search`, `kugou_mobilecdn` 等）
- B站 API（`bili`, `biliapi`）
- 其他音乐平台 API

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
