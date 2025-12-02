# MusicFree H5

一个“轻量级 + 插件驱动”的 Web 端音乐播放器，灵感来自原生应用版本的 [MusicFree](https://github.com/maotoumao/MusicFree)。核心理念仍然是不绑定任何音源，所有搜索与播放能力都通过插件脚本注入。

> **注意**：本项目只提供播放器壳，不内置、不托管任何音源或第三方接口。

## 能力概览

- 📦 **多订阅源管理**：支持输入任意符合 MusicFree 约定的 `plugins.json`。
- 🔌 **插件生命周期管理**：安装、启用/停用、卸载均存储在 `localStorage`，刷新页面仍会保留，且支持为插件配置 `mirrors` 字段，优先使用远程失败后回落到本地镜像。
- 🌐 **远程脚本沙箱**：插件脚本通过 `fetch + Function` 注入，运行在受控上下文中，仅允许访问受限的 `fetch / console` 能力。
- 🛡️ **内置 CORS/离线兜底**：订阅源或插件地址若因跨域失败，会自动在多条公共代理（直连、`cors.isomorphic-git.org`、`corsproxy.io`、`thingproxy.freeboard.io`、`r.jina.ai` 等）之间切换，全部失败后会回落到 `public/feeds.default.json` 这份本地备份。
- 🎧 **搜索 + 播放**：选择已启用的插件后发起搜索，播放完全依赖插件提供的 `streamUrl` 或 `resolveStream`。
- 🧩 **示例插件**：`public/plugins/demo.radio.js` 演示如何为 H5 版本编写插件，可直接通过“自定义插件”安装。

## 快速开始

```bash
cd musicfree-h5
npm install          # 或 npm install / pnpm install
npm run dev          # 启动开发环境
npm run build        # 生产构建
npm run preview      # 本地预览构建结果
```

## 插件开发约定（H5 版）

插件脚本需要在浏览器环境运行，推荐直接调用 `MusicFreeH5.registerPlugin` 注册实例：

```js
;(function () {
  MusicFreeH5.registerPlugin(() => ({
    name: 'Sample Plugin',
    version: '0.1.0',
    capabilities: ['search', 'stream'],
    async searchSongs(query) {
      const list = await fetchSongsFromSomewhere(query)
      return list.map((item) => ({
        id: item.id,
        title: item.title,
        artists: item.artists,
        streamUrl: item.stream, // 没有的话可在 resolveStream 中再补
      }))
    },
    async resolveStream(track) {
      const { url } = await getPlayableUrl(track.id)
      return { url }
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

## 自定义插件

1. 在“自定义插件”表单中填写名称与脚本 URL（可以是 CDN / object storage / 本地托管的 js 文件）。
2. 点击“安装/更新”后即可在“已安装插件”列表中看到它，启用并选择后即可使用。
3. 示例脚本：`/plugins/demo.radio.js`，直接粘贴到输入框即可体验。

## Vercel 部署

本项目支持一键部署到 Vercel，代理功能通过 Serverless Functions 实现。

### 方式一：一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zyb/musicfree-h5-vercel)

### 方式二：手动部署

1. **Fork 本仓库** 或将代码推送到你的 GitHub 仓库

2. **登录 Vercel** 并导入项目：
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "Add New" → "Project"
   - 选择你的 GitHub 仓库
   - 点击 "Import"

3. **配置构建设置**（通常自动检测）：
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **点击 Deploy**，等待部署完成

### 部署后的代理说明

在 Vercel 上部署后，所有 CORS 代理请求会自动使用 `/api/proxy/[type]/[path]` 路由，由 Serverless Functions 处理。

### 环境变量（可选）

目前不需要配置任何环境变量。如需自定义，可在 Vercel 项目设置中添加。

### 注意事项

- Vercel 免费版有 [Serverless Functions 限制](https://vercel.com/docs/functions/limitations)（每月 100GB 带宽、10 秒执行时间等）
- 部分音乐源可能因 IP 限制无法访问，建议使用国内 CDN 或其他部署方案
- 如需自定义域名，可在 Vercel 项目设置中配置

## 其他部署方式

### Docker 部署

```bash
# 构建镜像
docker build -t musicfree-h5 .

# 运行容器
docker run -p 3000:3000 musicfree-h5
```

### 静态托管（无代理功能）

如果只需要静态托管而不需要代理功能，可以使用任何静态文件服务器：

```bash
npm run build
# 将 dist 目录部署到任何静态托管服务（GitHub Pages, Netlify, Cloudflare Pages 等）
```

⚠️ **注意**：静态托管方式将无法使用大部分音乐源，因为跨域请求会被浏览器阻止。

## 已知限制

- 大部分官方 MusicFree 插件依赖 Node.js 模块（如 axios、cheerio），不能直接在浏览器运行，需要针对 H5 版本重写。
- 插件脚本目前共享页面上下文，不建议执行高危操作；如需进一步隔离，可将脚本改为 iframe/worker 方案。
- 播放器只提供基础播放控制，没有实现完整队列/歌词/下载等能力，可在插件扩展中自行补充 UI。

## 参考

- [MusicFree 原生项目](https://github.com/maotoumao/MusicFree)：H5 版的交互、插件订阅源格式与其保持一致。
