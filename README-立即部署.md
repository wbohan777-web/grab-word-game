# 🎯 最简单的部署方案（5 分钟）

## 现在立即执行（复制粘贴即可）

### 步骤 1：在 GitHub 创建仓库（2 分钟）

**打开浏览器访问**：
```
https://github.com/new
```

**填写信息**：
- Repository name: `grab-word-game`
- Description: `多人实时抢词对战游戏`
- 选择：**Public**
- ⚠️ **不要勾选** README、.gitignore、license
- 点击：**Create repository**

---

### 步骤 2：推送代码（复制这些命令）

创建仓库后，GitHub 会显示命令。或者直接复制下面的：

**PowerShell 中运行**：
```powershell
cd C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab

git remote remove origin
git remote add origin https://github.com/wbohan777-web/grab-word-game.git
git branch -M main
git push -u origin main
```

如果提示输入用户名密码：
- 用户名：你的 GitHub 用户名
- 密码：需要使用 Personal Access Token（不是登录密码）

**创建 Token**（如果需要）：
1. 访问：https://github.com/settings/tokens
2. Generate new token (classic)
3. 勾选 `repo` 权限
4. 复制生成的 token 作为密码

---

### 步骤 3：部署到 Render（1 分钟）

**访问**：
```
https://dashboard.render.com/
```

**操作**：
1. 点击 **New +** → **Web Service**
2. **Connect** 你的 GitHub 账号
3. 选择 `grab-word-game` 仓库
4. 配置：
   - Name: `grab-word-game`
   - Build Command: （留空）
   - Start Command: `node server.js`
5. 点击 **Create Web Service**

---

### 步骤 4：等待部署（2-3 分钟）

Render 会自动：
- ✅ 克隆代码
- ✅ 安装依赖（npm install）
- ✅ 启动服务器
- ✅ 分配域名

---

## 🎉 完成！

部署成功后，你会得到：
```
https://grab-word-game-xxxx.onrender.com
```

**立即可以玩！** 🎮

---

## 📝 可选：添加数据库（以后再说也行）

在 Render 的 Environment 标签页添加：
```
MONGO_URI = mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority
```

（需要先从 MongoDB Atlas 获取完整连接字符串）

---

## 🚀 现在开始吧！

**第一步**：打开 https://github.com/new
**然后**：按照上面步骤操作

需要帮助随时告诉我！ 🎯
