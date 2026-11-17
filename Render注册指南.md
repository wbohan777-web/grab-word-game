# 🚀 Render.com 注册引导

## 当前页面：创建 Workspace

### 第 1 个截图的选择：
```
Workspace name: grab-word-game (或随意)
用途: Personal projects ✓
团队规模: Just me (或 2-10)
```

点击 **Next**

---

### 第 2 个截图的选择：
```
构建类型: Website / landing page (选这个)
或者: Backend (也可以)

能力需求: 
- Developer velocity (可选)
- 或者直接跳过 (Skip Survey)
```

---

## 快速路径（推荐）

直接点击 **Skip Survey**，跳过问卷调查

然后你会进入 Render Dashboard

---

## 接下来的步骤

### 1. 连接 GitHub

Dashboard 会提示你连接 GitHub：
- 点击 "Connect GitHub"
- 授权 Render 访问你的仓库

### 2. 创建 Web Service

- 点击 "New +" → "Web Service"
- 选择 `grab-word-game` 仓库
- 配置：
  - **Name**: `grab-word-game`
  - **Build Command**: 留空
  - **Start Command**: `node server.js`
- 点击 "Create Web Service"

---

## ⚠️ 重要提醒

如果 GitHub 上还没有 `grab-word-game` 仓库，你需要先：

1. 访问 https://github.com/new
2. 创建名为 `grab-word-game` 的仓库（Public，不勾选任何初始化）
3. 然后在本地推送代码：
   ```bash
   cd C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab
   git remote add origin https://github.com/你的用户名/grab-word-game.git
   git push -u origin main
   ```

---

**现在：点击 Skip Survey 进入 Dashboard！** 🎯
