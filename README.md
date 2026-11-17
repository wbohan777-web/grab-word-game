# 抢词房 · 占领战

> 多人实时抢词对战游戏 - 霓虹竞技场版

## 🎮 在线体验

部署后自动填写：`https://你的应用名.onrender.com`

## ✨ 特性

- 🌐 多人实时对战（WebSocket）
- 🎨 霓虹赛博朋克风格
- 💎 玻璃拟态设计
- ✨ Canvas 粒子特效
- 🎵 动态音效系统
- 📱 移动端完美适配
- 🔄 断线重连
- 🎯 翻盘机制

## 🚀 快速部署

### Render.com（推荐）

1. Fork 或导入本仓库
2. 访问 [Render.com](https://render.com)
3. New → Web Service
4. 连接仓库
5. 配置：
   - **Build Command**: (留空)
   - **Start Command**: `node server.js`
   - **Environment**: Node
6. 点击 Deploy

### Railway.app

```bash
npm install -g railway
railway login
railway init
railway up
```

### Fly.io

```bash
fly launch
fly deploy
```

## 🛠️ 本地运行

```bash
# 启动服务器
node server.js

# 访问
http://localhost:7777

# 运行测试
node test.js
```

## 📱 手机联机

### 局域网
```
http://你的电脑IP:7777
```

### 公网隧道
```bash
# Windows
.\启动公网抢词房.bat

# 或手动
cloudflared tunnel --url http://localhost:7777
```

## 📋 技术栈

- **后端**: Node.js（零依赖）
- **前端**: Vanilla JS + Canvas 2D + Web Audio
- **通信**: WebSocket（RFC6455 自实现）
- **样式**: CSS3（Grid、backdrop-filter、CSS 变量）

## 🎯 游戏规则

1. 20 个英文单词铺在棋盘上（5×4）
2. 点击格子弹出 4 个中文释义
3. 选对答案占领格子
4. 答错锁定 4 秒
5. 占满 20 格结算

### 翻盘机制
- 别人占领的格子 15 秒后可抢
- 答对抢回格子 +60 分
- 被抢的人失去格子 -40 分
- 每格只能被翻一次

## 📂 文件结构

```
grab/
├── server.js              # 服务端（零依赖）
├── public/
│   ├── index.html         # HTML 结构
│   ├── style.css          # 视觉样式
│   └── game.js            # 游戏逻辑
├── cet6-core.json         # 词库（2164 词）
├── test.js                # 自动化测试
└── package.json           # 项目配置
```

## 🧪 测试

```bash
node test.js
# 应显示：44/44 passed
```

## 📊 性能

- 帧率：60fps（PC）/ 50+fps（移动端）
- 内存：< 15 MB
- 延迟：< 100ms（隧道）/ < 20ms（局域网）

## 🎨 设计亮点

- 霓虹赛博竞技场
- 动态极光背景
- 玻璃拟态格子
- Canvas 粒子引擎
- 8 套精美配色
- 钟式泛音音效

## 📄 许可

MIT License

## 🙏 致谢

- [shougan-bao](https://github.com/saibofushou/shougan-bao) - 游戏手感理论
- [cyberpunk-ui](https://github.com/rintran720/cyberpunk-ui) - 设计灵感

---

**版本**: 2.0.0 | **更新**: 2024-11-17
