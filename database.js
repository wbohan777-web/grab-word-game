/**
 * 数据库模块 - MongoDB 连接与模型
 */
'use strict';

const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'grab_word_game';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRE = '7d';

let client = null;
let db = null;

// 连接数据库
async function connect() {
  if (db) return db;
  
  try {
    client = new MongoClient(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    await client.connect();
    db = client.db(DB_NAME);
    
    // 创建索引
    await createIndexes();
    
    console.log('MongoDB connected:', DB_NAME);
    return db;
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    // 开发环境：允许无数据库运行
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Running without database (development mode)');
      return null;
    }
    throw err;
  }
}

// 创建索引
async function createIndexes() {
  try {
    const users = db.collection('users');
    await users.createIndex({ username: 1 }, { unique: true });
    await users.createIndex({ email: 1 }, { unique: true, sparse: true });
    await users.createIndex({ rating: -1 });
    
    const games = db.collection('games');
    await games.createIndex({ createdAt: -1 });
    await games.createIndex({ 'players.userId': 1 });
    
    const wrongWords = db.collection('wrong_words');
    await wrongWords.createIndex({ userId: 1, word: 1 }, { unique: true });
    
    const learningProgress = db.collection('learning_progress');
    await learningProgress.createIndex({ userId: 1 }, { unique: true });
  } catch (err) {
    console.error('Index creation warning:', err.message);
  }
}

// 获取数据库实例
function getDB() {
  return db;
}

// ========== 用户模型 ==========

// 创建用户
async function createUser(username, password, email = null) {
  if (!db) throw new Error('Database not connected');
  
  const users = db.collection('users');
  
  // 检查用户名是否已存在
  const existing = await users.findOne({ username });
  if (existing) throw new Error('Username already exists');
  
  // 加密密码
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 创建用户
  const user = {
    username,
    password: hashedPassword,
    email,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    rating: 1000,  // 初始积分
    rank: 'Bronze IV',
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    maxStreak: 0,
    totalGames: 0,
    totalTiles: 0,
    totalSteals: 0,
    achievements: [],
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };
  
  const result = await users.insertOne(user);
  user._id = result.insertedId;
  
  // 初始化学习进度
  await initLearningProgress(user._id);
  
  return user;
}

// 验证登录
async function verifyUser(username, password) {
  if (!db) throw new Error('Database not connected');
  
  const users = db.collection('users');
  const user = await users.findOne({ username });
  
  if (!user) throw new Error('User not found');
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) throw new Error('Invalid password');
  
  // 更新最后登录时间
  await users.updateOne(
    { _id: user._id },
    { $set: { lastLoginAt: new Date() } }
  );
  
  return user;
}

// 生成 JWT Token
function generateToken(user) {
  return jwt.sign(
    { 
      id: user._id.toString(), 
      username: user.username,
      rating: user.rating,
      rank: user.rank
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
}

// 验证 Token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid token');
  }
}

// 获取用户信息
async function getUser(userId) {
  if (!db) return null;
  
  const users = db.collection('users');
  return await users.findOne({ _id: new ObjectId(userId) });
}

// 更新用户积分和段位
async function updateRating(userId, ratingChange, isWin, isStealer = false) {
  if (!db) return;
  
  const users = db.collection('users');
  const user = await getUser(userId);
  if (!user) return;
  
  const newRating = Math.max(0, user.rating + ratingChange);
  const newRank = calculateRank(newRating);
  
  const update = {
    $set: { rating: newRating, rank: newRank },
    $inc: {
      totalGames: 1,
      wins: isWin ? 1 : 0,
      losses: isWin ? 0 : 1,
      streak: isWin ? 1 : 0,
      totalSteals: isStealer ? 1 : 0,
    },
  };
  
  // 重置或更新连胜
  if (!isWin) {
    update.$set.streak = 0;
  } else if (user.streak + 1 > user.maxStreak) {
    update.$set.maxStreak = user.streak + 1;
  }
  
  await users.updateOne({ _id: user._id }, update);
}

// 计算段位
function calculateRank(rating) {
  if (rating < 1000) return 'Bronze IV';
  if (rating < 1100) return 'Bronze III';
  if (rating < 1200) return 'Bronze II';
  if (rating < 1300) return 'Bronze I';
  if (rating < 1400) return 'Silver IV';
  if (rating < 1500) return 'Silver III';
  if (rating < 1600) return 'Silver II';
  if (rating < 1700) return 'Silver I';
  if (rating < 1800) return 'Gold IV';
  if (rating < 1900) return 'Gold III';
  if (rating < 2000) return 'Gold II';
  if (rating < 2100) return 'Gold I';
  if (rating < 2200) return 'Platinum IV';
  if (rating < 2300) return 'Platinum III';
  if (rating < 2400) return 'Platinum II';
  if (rating < 2500) return 'Platinum I';
  if (rating < 2600) return 'Diamond IV';
  if (rating < 2700) return 'Diamond III';
  if (rating < 2800) return 'Diamond II';
  if (rating < 2900) return 'Diamond I';
  if (rating < 3000) return 'Master IV';
  if (rating < 3200) return 'Master III';
  if (rating < 3400) return 'Master II';
  if (rating < 3600) return 'Master I';
  return 'Grandmaster';
}

// 计算积分变化（ELO 算法简化版）
function calculateRatingChange(winnerRating, loserRating, position, totalPlayers) {
  const K = 32; // K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  
  // 位置加权
  const positionMultiplier = {
    1: 1.0,    // 第一名全额
    2: 0.5,    // 第二名减半
    3: 0.2,    // 第三名
    4: -0.2,   // 第四名负分
  }[position] || -0.5;
  
  const change = Math.round(K * (positionMultiplier - expectedScore));
  return change;
}

// ========== 游戏记录模型 ==========

async function saveGameRecord(roomCode, players, winner, duration, tiles) {
  if (!db) return;
  
  const games = db.collection('games');
  const record = {
    roomCode,
    players: players.map(p => ({
      userId: p.userId,
      username: p.username,
      score: p.score,
      tiles: p.tiles,
      position: p.position,
      steals: p.stealUsed || 0,
    })),
    winner,
    duration,
    totalTiles: tiles.length,
    createdAt: new Date(),
  };
  
  await games.insertOne(record);
  
  // 更新玩家积分
  for (const p of players) {
    if (p.userId) {
      const avgRating = players.reduce((sum, x) => sum + (x.rating || 1000), 0) / players.length;
      const change = calculateRatingChange(p.rating || 1000, avgRating, p.position, players.length);
      await updateRating(p.userId, change, p.position === 1, p.stealUsed > 0);
    }
  }
}

// 获取用户游戏历史
async function getUserGameHistory(userId, limit = 20) {
  if (!db) return [];
  
  const games = db.collection('games');
  return await games
    .find({ 'players.userId': userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

// ========== 错词本模型 ==========

// 添加错词
async function addWrongWord(userId, word, translation) {
  if (!db) return;
  
  const wrongWords = db.collection('wrong_words');
  await wrongWords.updateOne(
    { userId, word },
    {
      $set: { translation, lastWrongAt: new Date() },
      $inc: { wrongCount: 1 },
      $setOnInsert: { createdAt: new Date(), masteredAt: null },
    },
    { upsert: true }
  );
}

// 标记单词已掌握
async function markWordMastered(userId, word) {
  if (!db) return;
  
  const wrongWords = db.collection('wrong_words');
  await wrongWords.updateOne(
    { userId, word },
    { $set: { masteredAt: new Date() } }
  );
}

// 获取错词列表
async function getWrongWords(userId, onlyUnmastered = true) {
  if (!db) return [];
  
  const wrongWords = db.collection('wrong_words');
  const query = { userId };
  if (onlyUnmastered) query.masteredAt = null;
  
  return await wrongWords
    .find(query)
    .sort({ wrongCount: -1, lastWrongAt: -1 })
    .toArray();
}

// ========== 学习进度模型 ==========

// 初始化学习进度
async function initLearningProgress(userId) {
  if (!db) return;
  
  const progress = db.collection('learning_progress');
  await progress.insertOne({
    userId,
    totalWords: 0,
    masteredWords: 0,
    studyDays: 0,
    lastStudyAt: null,
    dailyGoal: 20,
    streak: 0,
    createdAt: new Date(),
  });
}

// 更新学习进度
async function updateLearningProgress(userId, wordsLearned = 0) {
  if (!db) return;
  
  const progress = db.collection('learning_progress');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const user = await progress.findOne({ userId });
  if (!user) return;
  
  const lastStudy = user.lastStudyAt ? new Date(user.lastStudyAt) : null;
  const isNewDay = !lastStudy || lastStudy < today;
  
  const update = {
    $set: { lastStudyAt: new Date() },
    $inc: { totalWords: wordsLearned },
  };
  
  if (isNewDay) {
    update.$inc.studyDays = 1;
    update.$inc.streak = 1;
  }
  
  await progress.updateOne({ userId }, update);
}

// 获取学习进度
async function getLearningProgress(userId) {
  if (!db) return null;
  
  const progress = db.collection('learning_progress');
  return await progress.findOne({ userId });
}

// ========== 排行榜 ==========

// 获取全球排行榜
async function getLeaderboard(limit = 100) {
  if (!db) return [];
  
  const users = db.collection('users');
  return await users
    .find({})
    .sort({ rating: -1 })
    .limit(limit)
    .project({ username: 1, rating: 1, rank: 1, wins: 1, totalGames: 1, avatar: 1 })
    .toArray();
}

// 获取用户排名
async function getUserRank(userId) {
  if (!db) return null;
  
  const users = db.collection('users');
  const user = await getUser(userId);
  if (!user) return null;
  
  const rank = await users.countDocuments({ rating: { $gt: user.rating } });
  return rank + 1;
}

// 关闭数据库连接
async function close() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

module.exports = {
  connect,
  getDB,
  close,
  
  // 用户相关
  createUser,
  verifyUser,
  generateToken,
  verifyToken,
  getUser,
  updateRating,
  calculateRank,
  
  // 游戏记录
  saveGameRecord,
  getUserGameHistory,
  
  // 错词本
  addWrongWord,
  markWordMastered,
  getWrongWords,
  
  // 学习进度
  initLearningProgress,
  updateLearningProgress,
  getLearningProgress,
  
  // 排行榜
  getLeaderboard,
  getUserRank,
};
