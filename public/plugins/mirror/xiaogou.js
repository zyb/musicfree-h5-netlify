/**
 * 插件镜像示例
 * 这是一个占位文件，用于演示本地镜像功能
 * 当远程插件地址无法访问时，会尝试从 mirrors 字段指定的地址加载
 * 
 * 实际使用时，应该将对应插件的完整代码放在这里
 */
;(function () {
  MusicFreeH5.registerPlugin((ctx) => {
    ctx.console.log('正在使用本地镜像版本的插件')

    return {
      name: '小枸音乐 (镜像)',
      version: '0.0.1-mirror',
      capabilities: ['search'],

      async searchSongs(query) {
        ctx.console.log('搜索 (镜像):', query)
        // 这里应该实现真正的搜索逻辑
        // 由于这只是演示，返回空结果
        return []
      },
    }
  })
})()

