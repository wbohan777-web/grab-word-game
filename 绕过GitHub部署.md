# 🚀 Render 手动部署教程（不需要 GitHub）

## ✅ 方法：使用 Render 的 Blueprint 或手动配置

虽然 Render Free Plan 通常需要 Git，但我们可以用其他方式：

---

## 🎯 最佳方案：使用 Railway（更简单）

Railway 支持直接从本地部署，不需要 GitHub！

### 步骤（5分钟）：

#### 1. 安装 Railway CLI
```powershell
npm install -g @railway/cli
```

#### 2. 登录 Railway
```powershell
railway login
```
会打开浏览器，用 GitHub 或 Email 登录即可

#### 3. 初始化项目
```powershell
cd C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab
railway init
```
选择：Create a new project

#### 4. 部署！
```powershell
railway up
```

等待 2-3 分钟，完成！

#### 5. 获取域名
```powershell
railway domain
```

---

## 🌐 或者：使用 Fly.io（完全免费）

Fly.io 也支持直接部署：

```powershell
# 1. 安装 Fly CLI
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 2. 注册/登录
fly auth signup

# 3. 创建并部署
cd C:\Users\admin\.xkcode\.zcode\workspace\115ec9db-f413-4c27-b0a2-810b938d33f5\grab
fly launch
```

---

## 📦 或者：压缩包已准备好

我已经创建了 `grab-game-deploy.zip`，包含所有必要文件。

你可以：
1. 去 Railway/Fly.io 网页版
2. 上传这个 ZIP
3. 配置启动命令：`node server.js`

---

## 🎯 推荐顺序

**首选 Railway**（最简单）：
1. 不需要 GitHub
2. CLI 直接部署
3. 免费额度充足
4. 5 分钟搞定

**备选 Fly.io**：
1. 完全免费
2. 性能更好
3. 配置稍多一点

---

**现在执行哪个？告诉我"Railway"或"Fly"！** 🚀
