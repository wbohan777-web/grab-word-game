# MongoDB Atlas 免费部署指南

## 🎯 获取免费 MongoDB 数据库（512MB）

### 第 1 步：注册 MongoDB Atlas

1. **访问**：https://www.mongodb.com/cloud/atlas/register
2. **注册**：用邮箱或 Google 账号注册
3. **选择免费计划**：`M0 Sandbox`（永久免费，512MB）

### 第 2 步：创建集群

1. **选择云提供商**：AWS
2. **选择区域**：Singapore（新加坡，离中国最近）
3. **集群名称**：`GrabWordGame`
4. **点击**：`Create`

等待 3-5 分钟创建完成。

### 第 3 步：配置网络访问

1. **进入**：`Network Access`
2. **点击**：`Add IP Address`
3. **选择**：`Allow Access from Anywhere`（允许所有 IP）
4. **确认**：`0.0.0.0/0`

### 第 4 步：创建数据库用户

1. **进入**：`Database Access`
2. **点击**：`Add New Database User`
3. **用户名**：`admin`
4. **密码**：生成强密码（记住它！）
5. **权限**：`Atlas Admin`
6. **保存**

### 第 5 步：获取连接字符串

1. **回到**：`Clusters`
2. **点击**：`Connect`
3. **选择**：`Connect your application`
4. **复制**连接字符串：
   ```
   mongodb+srv://admin:<password>@grabwordgame.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **替换** `<password>` 为你的实际密码

---

## 🚀 配置游戏使用数据库

### 本地开发

在 `grab` 目录创建 `.env` 文件：

```env
MONGO_URI=mongodb+srv://admin:你的密码@grabwordgame.xxxxx.mongodb.net/grab_word_game?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

### Render 部署

在 Render 部署页面：
1. **Environment** 标签
2. **Add Environment Variable**
3. 添加：
   ```
   MONGO_URI=mongodb+srv://admin:你的密码@...
   JWT_SECRET=随机生成一个长字符串
   ```

---

## 🧪 测试数据库连接

```bash
# 启动服务器
node server.js

# 应该看到：
# Server running at http://0.0.0.0:7777
# Words loaded: 2164
# MongoDB connected: grab_word_game
# Database connected successfully
```

如果看到 "Database connection failed"，游戏仍然可以运行，只是没有用户系统和排名。

---

## 📊 功能对比

| 功能 | 无数据库 | 有数据库 |
|------|---------|---------|
| 游客对战 | ✅ | ✅ |
| 用户注册/登录 | ❌ | ✅ |
| 积分和段位 | ❌ | ✅ |
| 排行榜 | ❌ | ✅ |
| 错词本 | ❌ | ✅ |
| 游戏历史 | ❌ | ✅ |
| 背单词 | ❌ | ✅ |

---

## 🔧 故障排查

### 问题 1：连接超时
```
Error: MongooseServerSelectionError: connect ETIMEDOUT
```

**原因**：IP 白名单未配置

**解决**：
1. Network Access → Add IP Address
2. 选择 `0.0.0.0/0`（允许所有）

### 问题 2：认证失败
```
Error: Authentication failed
```

**原因**：用户名或密码错误

**解决**：
1. Database Access → 检查用户名
2. 重新生成密码
3. 更新 `.env` 中的连接字符串

### 问题 3：数据库不存在
```
Database 'grab_word_game' does not exist
```

**无需处理**：首次连接时会自动创建数据库。

---

## 💰 成本

- **免费版（M0）**：512MB 存储，够 10,000+ 用户
- **升级版（M10）**：$0.08/小时 ≈ $9/月，2GB 存储

---

## 🎮 现在可以：

1. ✅ 用户注册并登录
2. ✅ 对战后积分自动计算
3. ✅ 段位系统生效
4. ✅ 查看全球排行榜
5. ✅ 错词自动记录到错词本
6. ✅ 查看游戏历史

---

**需要帮助？** 告诉我卡在哪一步！
