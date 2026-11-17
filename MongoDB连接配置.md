# MongoDB 连接配置

## 📋 你的数据库凭证

```
Username: wbohan777_db_user
Password: 4vs84cT1sAjwdNpA
```

## 🔗 连接字符串

根据图片，你需要点击 "Choose a connection method" 来获取连接字符串。

### 预期的连接字符串格式：
```
mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

**重要**：需要替换 `xxxxx` 为你的实际集群地址。

---

## 🚀 下一步操作

### 1. 获取完整连接字符串

点击截图中的 **"Choose a connection method"** 按钮，然后：
1. 选择 **"Connect your application"**
2. Driver: **Node.js**
3. Version: **5.5 or later**
4. 复制显示的连接字符串

连接字符串应该类似：
```
mongodb+srv://wbohan777_db_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 2. 替换密码

将 `<password>` 替换为：`4vs84cT1sAjwdNpA`

最终连接字符串：
```
mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority
```

**注意**：我在末尾添加了 `/grab_word_game` 来指定数据库名称。

---

## 💻 本地测试配置

### 方法 1：创建 .env 文件（推荐）

在 `grab` 目录创建 `.env` 文件：

```env
MONGO_URI=mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
NODE_ENV=production
```

### 方法 2：临时环境变量（测试用）

**PowerShell：**
```powershell
$env:MONGO_URI="mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority"
$env:JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
node server.js
```

---

## 🌐 Render.com 部署配置

在 Render 的环境变量设置中添加：

### Environment Variables

**MONGO_URI**
```
mongodb+srv://wbohan777_db_user:4vs84cT1sAjwdNpA@cluster0.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority
```

**JWT_SECRET**
```
grab-word-game-jwt-secret-key-2024-super-secure-random-string
```

---

## ✅ 验证连接

### 本地测试：

```bash
cd grab
node server.js
```

如果成功，你会看到：
```
Server running at http://0.0.0.0:7777
Words loaded: 2164
MongoDB connected: grab_word_game
✓ Database connected - Full features enabled
```

如果失败，会看到：
```
⚠ Database unavailable - Guest mode only
```

---

## 🔧 故障排查

### 问题 1：IP 地址未配置
如果看到 `MongoServerSelectionError`：
1. 返回 MongoDB Atlas
2. Network Access → 确认 `0.0.0.0/0` 已添加
3. 等待 1-2 分钟生效

### 问题 2：认证失败
确保：
- 用户名：`wbohan777_db_user`（完全匹配）
- 密码：`4vs84cT1sAjwdNpA`（完全匹配）
- 密码中没有 `<>`

### 问题 3：连接超时
- 检查网络连接
- 确认防火墙未阻止 MongoDB 端口
- 尝试使用不同网络

---

## 📝 下一步

1. **获取完整连接字符串**（点击 "Choose a connection method"）
2. **告诉我完整的连接字符串**（我帮你验证格式）
3. **本地测试连接**
4. **推送到 GitHub**
5. **部署到 Render**

---

把完整的连接字符串发给我，我帮你确认格式是否正确！ 🚀
