# Zeabur Docker 部署指南

本文档介绍如何使用 Docker 将 musicfree-h5 项目部署到 Zeabur。

## 前置要求

1. 拥有 Zeabur 账号（https://zeabur.com）
2. 项目已推送到 GitHub/GitLab/Bitbucket 等 Git 仓库
3. 项目包含 `Dockerfile`（已配置）

## 部署步骤

### 方法一：通过 Zeabur Dashboard（推荐）

1. **登录 Zeabur**
   - 访问 https://zeabur.com 并登录

2. **创建新项目**
   - 点击 "New Project" 或 "+" 按钮
   - 选择 "Deploy from Git Repository"
   - 连接你的 Git 仓库（GitHub/GitLab/Bitbucket）

3. **选择仓库和路径**
   - 选择包含 musicfree-h5-zeabur 的仓库
   - 如果项目在子目录中，需要指定路径为 `musicfree-h5-zeabur`

4. **自动检测 Docker**
   - Zeabur 会自动检测到 `Dockerfile`
   - 确认使用 Docker 构建方式
   - 无需额外配置，Dockerfile 已包含所有构建步骤

5. **环境变量（可选）**
   - 如果需要设置环境变量，可以在项目设置中添加
   - 默认端口为 8080（Zeabur 会自动设置 PORT 环境变量）

6. **部署**
   - 点击 "Deploy" 按钮
   - Zeabur 会自动：
     - 使用 Dockerfile 构建 Docker 镜像
     - 安装依赖 (`npm ci`)
     - 构建项目 (`npm run build`)
     - 启动 Node.js 服务器 (`node server.js`)

7. **获取访问地址**
   - 部署完成后，在项目页面可以看到服务状态
   - 点击服务名称进入服务详情页
   - 在 "Domains" 或 "网络" 选项卡中可以看到访问地址
   - Zeabur 会自动生成一个默认域名，格式类似：`your-project-name-xxx.zeabur.app`
   - 也可以点击 "Generate Domain" 生成自定义域名

### 方法二：通过 Zeabur CLI

1. **安装 Zeabur CLI**
   ```bash
   npm install -g @zeabur/cli
   ```

2. **登录**
   ```bash
   zeabur login
   ```

3. **部署**
   ```bash
   cd /path/to/musicfree-h5-zeabur
   zeabur deploy
   ```

## Dockerfile 说明

项目使用 Dockerfile 进行构建和部署，包含以下步骤：

1. **基础镜像**: Node.js 20 Alpine（轻量级）
2. **工作目录**: `/app`
3. **依赖安装**: 使用 `npm ci` 安装所有依赖（包括 devDependencies）
4. **项目构建**: 运行 `npm run build` 构建前端项目
5. **服务启动**: 使用 `node server.js` 启动 Node.js 服务器

### 服务器功能

`server.js` 提供以下功能：

- **静态文件服务**: 提供 `dist` 目录中的构建文件
- **API 代理**: 处理 `/api/proxy/*` 路径的代理请求
- **SPA 路由支持**: 所有路由都重定向到 `index.html`

## 注意事项

1. **Node.js 版本**
   - 项目要求 Node.js >= 20.0.0
   - Dockerfile 使用 `node:20-alpine` 镜像

2. **端口配置**
   - 默认端口为 8080
   - Zeabur 会自动设置 `PORT` 环境变量
   - `server.js` 会读取 `process.env.PORT` 或使用默认值 8080

3. **代理功能**
   - 服务器内置 API 代理功能，处理 `/api/proxy/*` 请求
   - 支持多种音乐平台的代理（QQ音乐、网易云、酷狗等）
   - 无需额外的 serverless functions

4. **构建优化**
   - Docker 构建会缓存 `package*.json` 层，加快后续构建
   - 使用 `npm ci` 确保依赖版本一致性

5. **自定义域名**
   - 部署后可以在 Zeabur Dashboard 中配置自定义域名
   - Zeabur 会自动提供 SSL 证书

## 获取访问地址

部署完成后，可以通过以下方式找到访问地址：

### 方法一：在 Dashboard 中查看

1. **项目页面**
   - 登录 Zeabur Dashboard (https://dash.zeabur.com)
   - 在项目列表中点击你的项目
   - 在服务列表中可以看到服务状态和访问地址

2. **服务详情页**
   - 点击服务名称进入服务详情页
   - 在页面顶部可以看到 "Domains" 或 "网络" 部分
   - 默认域名格式：`your-project-name-xxx.zeabur.app`
   - 点击域名可以直接访问

3. **生成自定义域名**
   - 在 "Domains" 选项卡中点击 "Generate Domain"
   - 可以生成自定义的域名（如果可用）
   - 也可以绑定自己的域名

### 方法二：通过 CLI 查看

```bash
zeabur status
```

这会显示所有部署的服务及其访问地址。

## 验证部署

部署完成后，访问 Zeabur 提供的 URL，检查：

1. ✅ 页面正常加载
2. ✅ 静态资源（JS/CSS）正常加载
3. ✅ 插件系统正常工作
4. ✅ API 代理功能正常（`/api/proxy/*`）

## 故障排查

### 构建失败

- 检查 `Dockerfile` 是否正确
- 查看 Zeabur 构建日志中的错误信息
- 确认 Node.js 版本要求（>= 20.0.0）

### 服务启动失败

- 检查 `server.js` 文件是否存在
- 查看服务日志中的错误信息
- 确认端口配置正确

### 404 错误

- 检查 `dist` 目录是否包含 `index.html`
- 确认 `server.js` 中的静态文件路径正确

### API 代理失败

- 检查浏览器控制台的错误信息
- 查看服务器日志中的代理请求日志
- 确认代理目标配置正确

## 更新部署

每次推送到 Git 仓库的主分支时，Zeabur 会自动触发重新部署。

也可以手动触发：
- 在 Zeabur Dashboard 中点击 "Redeploy"
- 或使用 CLI: `zeabur redeploy`

## 本地测试

在部署前，可以在本地测试 Docker 构建：

```bash
# 构建 Docker 镜像
docker build -t musicfree-h5 .

# 运行容器
docker run -p 8080:8080 musicfree-h5

# 访问 http://localhost:8080
```

## 相关链接

- Zeabur 文档: https://zeabur.com/docs
- Zeabur Dashboard: https://dash.zeabur.com
- Docker 文档: https://docs.docker.com
