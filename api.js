/**
 * API 路由模块 - RESTful API 端点
 */
'use strict';

const db = require('./database');

// 解析 JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// 发送 JSON 响应
function sendJSON(res, code, data) {
  res.writeHead(code, { 
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// 从请求头提取 token
function extractToken(req) {
  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// 验证用户身份中间件
async function authenticate(req) {
  const token = extractToken(req);
  if (!token) throw new Error('No token provided');
  
  const decoded = db.verifyToken(token);
  const user = await db.getUser(decoded.id);
  if (!user) throw new Error('User not found');
  
  return user;
}

// ========== API 路由处理器 ==========

// POST /api/auth/register
async function handleRegister(req, res) {
  try {
    const { username, password, email } = await parseBody(req);
    
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }
    
    if (username.length < 3 || username.length > 20) {
      return sendJSON(res, 400, { error: 'Username must be 3-20 characters' });
    }
    
    if (password.length < 6) {
      return sendJSON(res, 400, { error: 'Password must be at least 6 characters' });
    }
    
    const user = await db.createUser(username, password, email);
    const token = db.generateToken(user);
    
    sendJSON(res, 201, {
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        rating: user.rating,
        rank: user.rank,
      }
    });
  } catch (err) {
    sendJSON(res, 400, { error: err.message });
  }
}

// POST /api/auth/login
async function handleLogin(req, res) {
  try {
    const { username, password } = await parseBody(req);
    
    if (!username || !password) {
      return sendJSON(res, 400, { error: 'Username and password required' });
    }
    
    const user = await db.verifyUser(username, password);
    const token = db.generateToken(user);
    
    sendJSON(res, 200, {
      token,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        rating: user.rating,
        rank: user.rank,
        wins: user.wins,
        losses: user.losses,
        streak: user.streak,
      }
    });
  } catch (err) {
    sendJSON(res, 401, { error: err.message });
  }
}

// GET /api/user/profile
async function handleProfile(req, res) {
  try {
    const user = await authenticate(req);
    const rank = await db.getUserRank(user._id);
    const progress = await db.getLearningProgress(user._id);
    
    sendJSON(res, 200, {
      id: user._id,
      username: user.username,
      avatar: user.avatar,
      email: user.email,
      rating: user.rating,
      rank: user.rank,
      globalRank: rank,
      wins: user.wins,
      losses: user.losses,
      draws: user.draws,
      totalGames: user.totalGames,
      winRate: user.totalGames > 0 ? (user.wins / user.totalGames * 100).toFixed(1) : 0,
      streak: user.streak,
      maxStreak: user.maxStreak,
      totalTiles: user.totalTiles,
      totalSteals: user.totalSteals,
      achievements: user.achievements,
      learningProgress: progress,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (err) {
    sendJSON(res, 401, { error: err.message });
  }
}

// GET /api/leaderboard?limit=100
async function handleLeaderboard(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    
    const leaderboard = await db.getLeaderboard(limit);
    sendJSON(res, 200, { leaderboard });
  } catch (err) {
    sendJSON(res, 500, { error: err.message });
  }
}

// GET /api/wrong-words
async function handleWrongWords(req, res) {
  try {
    const user = await authenticate(req);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const onlyUnmastered = url.searchParams.get('mastered') !== 'all';
    
    const words = await db.getWrongWords(user._id, onlyUnmastered);
    sendJSON(res, 200, { words });
  } catch (err) {
    sendJSON(res, 401, { error: err.message });
  }
}

// POST /api/wrong-words/:word/mastered
async function handleMarkMastered(req, res, word) {
  try {
    const user = await authenticate(req);
    await db.markWordMastered(user._id, decodeURIComponent(word));
    sendJSON(res, 200, { success: true });
  } catch (err) {
    sendJSON(res, 401, { error: err.message });
  }
}

// GET /api/game-history?limit=20
async function handleGameHistory(req, res) {
  try {
    const user = await authenticate(req);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    
    const history = await db.getUserGameHistory(user._id, limit);
    sendJSON(res, 200, { history });
  } catch (err) {
    sendJSON(res, 401, { error: err.message });
  }
}

// 路由分发
async function handleAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  
  // CORS 预检
  if (method === 'OPTIONS') {
    return sendJSON(res, 200, {});
  }
  
  try {
    // 认证路由
    if (pathname === '/api/auth/register' && method === 'POST') {
      return await handleRegister(req, res);
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      return await handleLogin(req, res);
    }
    
    // 用户路由
    if (pathname === '/api/user/profile' && method === 'GET') {
      return await handleProfile(req, res);
    }
    
    // 排行榜
    if (pathname === '/api/leaderboard' && method === 'GET') {
      return await handleLeaderboard(req, res);
    }
    
    // 错词本
    if (pathname === '/api/wrong-words' && method === 'GET') {
      return await handleWrongWords(req, res);
    }
    
    // 标记单词已掌握
    const masteredMatch = pathname.match(/^\/api\/wrong-words\/([^/]+)\/mastered$/);
    if (masteredMatch && method === 'POST') {
      return await handleMarkMastered(req, res, masteredMatch[1]);
    }
    
    // 游戏历史
    if (pathname === '/api/game-history' && method === 'GET') {
      return await handleGameHistory(req, res);
    }
    
    // 404
    sendJSON(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('API error:', err);
    sendJSON(res, 500, { error: 'Internal server error' });
  }
}

module.exports = {
  handleAPI,
  authenticate,
  extractToken,
  sendJSON,
};
