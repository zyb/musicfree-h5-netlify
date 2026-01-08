# 使用 Node.js 20 作为基础镜像（某些依赖包需要 Node.js 20+）
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括 devDependencies，用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 暴露端口（Zeabur 会自动设置 PORT 环境变量）
EXPOSE 8080

# 启动命令
CMD ["node", "server.js"]

