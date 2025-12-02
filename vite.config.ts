import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 通用请求头
const commonHeaders = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      // ============ QQ 音乐 ============
      '/proxy/qqu': {
        target: 'https://u.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/qqu/, ''),
        headers: { ...commonHeaders, referer: 'https://y.qq.com/', origin: 'https://y.qq.com' },
      },
      '/proxy/qqc': {
        target: 'https://c.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/qqc/, ''),
        headers: { ...commonHeaders, referer: 'https://y.qq.com/', origin: 'https://y.qq.com' },
      },
      '/proxy/qqi': {
        target: 'https://i.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/qqi/, ''),
        headers: { ...commonHeaders, referer: 'https://y.qq.com/', origin: 'https://y.qq.com' },
      },
      '/proxy/qqshc': {
        target: 'https://shc.y.qq.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/qqshc/, ''),
        headers: { ...commonHeaders, referer: 'https://y.qq.com' },
      },
      // ============ 网易云音乐 ============
      '/proxy/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/netease/, ''),
        headers: { ...commonHeaders, referer: 'https://music.163.com/', origin: 'https://music.163.com' },
      },
      '/proxy/neteaseapi': {
        target: 'https://interface.music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/neteaseapi/, ''),
        headers: { ...commonHeaders, referer: 'https://music.163.com/' },
      },
      '/proxy/neteasem': {
        target: 'https://interface3.music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/neteasem/, ''),
        headers: { ...commonHeaders, referer: 'https://music.163.com/' },
      },
      // ============ 酷狗音乐 ============
      '/proxy/kugou': {
        target: 'https://www.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugou/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kugou.com/' },
      },
      '/proxy/kugousearch': {
        target: 'https://songsearch.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugousearch/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kugou.com/' },
      },
      '/proxy/kugoucomplex': {
        target: 'https://complexsearch.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugoucomplex/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kugou.com/' },
      },
      '/proxy/kugouwww': {
        target: 'https://wwwapi.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugouwww/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kugou.com/' },
      },
      '/proxy/kugougateway': {
        target: 'https://gateway.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugougateway/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/kugoutracker': {
        target: 'https://trackercdnbj.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugoutracker/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/kugoumobile': {
        target: 'https://mobilecdn.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugoumobile/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/kugouservice': {
        target: 'https://mobileservice.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kugouservice/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 酷我音乐 ============
      '/proxy/kuwo': {
        target: 'https://www.kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kuwo/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kuwo.cn/', csrf: 'HH9GS5IV6V0', cookie: 'kw_token=HH9GS5IV6V0' },
      },
      '/proxy/kuwoapi': {
        target: 'https://kuwo.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/kuwoapi/, ''),
        headers: { ...commonHeaders, referer: 'https://www.kuwo.cn/', csrf: 'HH9GS5IV6V0', cookie: 'kw_token=HH9GS5IV6V0' },
      },
      '/proxy/kuwosearch': {
        target: 'http://search.kuwo.cn',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/proxy\/kuwosearch/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // 关键：移除浏览器添加的头，酷我服务器对这些很敏感
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('sec-ch-ua');
            proxyReq.removeHeader('sec-ch-ua-mobile');
            proxyReq.removeHeader('sec-ch-ua-platform');
            // 使用酷我客户端的 User-Agent
            proxyReq.setHeader('User-Agent', 'kwplayer_ar_8.5.4.2');
          });
        },
      },
      // ============ 咪咕音乐 ============
      '/proxy/migu': {
        target: 'https://music.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/migu/, ''),
        headers: { ...commonHeaders, referer: 'https://music.migu.cn/' },
      },
      '/proxy/migum': {
        target: 'https://m.music.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/migum/, ''),
        headers: { ...commonHeaders, referer: 'https://m.music.migu.cn/' },
      },
      '/proxy/miguapp': {
        target: 'https://app.c.nf.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/miguapp/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/migucdn': {
        target: 'https://c.musicapp.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/migucdn/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/migupdms': {
        target: 'https://jadeite.migu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/migupdms/, ''),
        headers: { ...commonHeaders },
      },
      // ============ B站音频 ============
      '/proxy/bili': {
        target: 'https://www.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/bili/, ''),
        headers: { ...commonHeaders, referer: 'https://www.bilibili.com/' },
      },
      '/proxy/biliapi': {
        target: 'https://api.bilibili.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/biliapi/, ''),
        headers: { ...commonHeaders, referer: 'https://www.bilibili.com/' },
      },
      // ============ 5sing ============
      '/proxy/5sing': {
        target: 'http://5sing.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/5sing/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/5singfc': {
        target: 'http://5singfc.kugou.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/5singfc/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 千千音乐 ============
      '/proxy/qianqian': {
        target: 'https://music.91q.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/qianqian/, ''),
        headers: { ...commonHeaders, referer: 'https://music.91q.com/' },
      },
      // ============ 喜马拉雅 ============
      '/proxy/xmly': {
        target: 'https://www.ximalaya.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/xmly/, ''),
        headers: { ...commonHeaders, referer: 'https://www.ximalaya.com/' },
      },
      '/proxy/xmlymobile': {
        target: 'https://mobile.ximalaya.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/xmlymobile/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 懒人听书 ============
      '/proxy/lrts': {
        target: 'https://www.lrts.me',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/lrts/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 猫耳 FM ============
      '/proxy/missevan': {
        target: 'https://www.missevan.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/missevan/, ''),
        headers: { ...commonHeaders, referer: 'https://www.missevan.com/' },
      },
      // ============ 荔枝 FM ============
      '/proxy/lizhi': {
        target: 'https://www.lizhi.fm',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/lizhi/, ''),
        headers: { ...commonHeaders },
      },
      // ============ zz123 聚合搜索 ============
      '/proxy/zz123': {
        target: 'https://zz123.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/zz123/, ''),
        headers: { 
          ...commonHeaders, 
          referer: 'https://zz123.com/',
          origin: 'https://zz123.com',
        },
      },
      // ============ 歌曲宝 ============
      '/proxy/gequbao': {
        target: 'https://www.gequbao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/gequbao/, ''),
        headers: { 
          ...commonHeaders, 
          referer: 'https://www.gequbao.com/',
          origin: 'https://www.gequbao.com',
        },
      },
      // ============ Suno ============
      '/proxy/suno': {
        target: 'https://studio-api.suno.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/suno/, ''),
        headers: { 
          ...commonHeaders, 
          referer: 'https://suno.ai/',
          origin: 'https://suno.ai',
        },
      },
      // ============ Gitee (插件托管) ============
      '/proxy/gitee': {
        target: 'https://gitee.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/gitee/, ''),
        headers: { ...commonHeaders, referer: 'https://gitee.com/' },
      },
      '/proxy/giteeraw': {
        target: 'https://gitee.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/giteeraw/, ''),
        headers: { 
          ...commonHeaders, 
          referer: 'https://gitee.com/',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      // ============ GitHub (插件托管) ============
      '/proxy/github': {
        target: 'https://raw.githubusercontent.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/github/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/ghproxy': {
        target: 'https://ghproxy.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/ghproxy/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 海棠音乐 ============
      '/proxy/haitang': {
        target: 'http://musicapi.haitangw.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/haitang/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/haitangm': {
        target: 'http://music.haitangw.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/haitangm/, ''),
        headers: { ...commonHeaders },
      },
      // ============ 网易音乐解析服务 ============
      '/proxy/duanx': {
        target: 'https://share.duanx.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/duanx/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/haitangcc': {
        target: 'https://music.haitangw.cc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/haitangcc/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/lxmusic': {
        target: 'https://lxmusicapi.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/lxmusic/, ''),
        headers: { ...commonHeaders },
      },
      // 网易官方音乐外链
      '/proxy/netease163': {
        target: 'http://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/netease163/, ''),
        headers: { ...commonHeaders, referer: 'https://music.163.com/' },
      },
      // ============ 其他常见 API ============
      '/proxy/aggregator': {
        target: 'https://api.lolimi.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/aggregator/, ''),
        headers: { ...commonHeaders },
      },
      '/proxy/myfreemp3': {
        target: 'https://api.xingzhige.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/myfreemp3/, ''),
        headers: { ...commonHeaders },
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
