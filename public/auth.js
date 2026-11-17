/**
 * 前端工具库 - 用户认证和 API 调用
 */

// 全局状态
const AUTH = {
  token: localStorage.getItem('token'),
  user: null,
};

// API 基础 URL
const API_BASE = location.origin;

// API 调用封装
async function apiCall(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };
  
  // 添加认证 token
  if (AUTH.token) {
    config.headers['Authorization'] = `Bearer ${AUTH.token}`;
  }
  
  const response = await fetch(API_BASE + endpoint, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

// 用户注册
async function register(username, password, email) {
  const data = await apiCall('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email }),
  });
  
  AUTH.token = data.token;
  AUTH.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  
  return data;
}

// 用户登录
async function login(username, password) {
  const data = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  
  AUTH.token = data.token;
  AUTH.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  
  return data;
}

// 退出登录
function logout() {
  AUTH.token = null;
  AUTH.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  location.reload();
}

// 检查登录状态
function isLoggedIn() {
  return !!AUTH.token;
}

// 获取用户资料
async function getProfile() {
  return await apiCall('/api/user/profile');
}

// 获取排行榜
async function getLeaderboard(limit = 100) {
  return await apiCall(`/api/leaderboard?limit=${limit}`);
}

// 获取错词本
async function getWrongWords(mastered = false) {
  const param = mastered ? 'all' : 'unmastered';
  return await apiCall(`/api/wrong-words?mastered=${param}`);
}

// 标记单词已掌握
async function markWordMastered(word) {
  return await apiCall(`/api/wrong-words/${encodeURIComponent(word)}/mastered`, {
    method: 'POST',
  });
}

// 获取游戏历史
async function getGameHistory(limit = 20) {
  return await apiCall(`/api/game-history?limit=${limit}`);
}

// 初始化：尝试从 localStorage 恢复用户信息
try {
  const savedUser = localStorage.getItem('user');
  if (savedUser && AUTH.token) {
    AUTH.user = JSON.parse(savedUser);
  }
} catch (e) {
  console.warn('Failed to restore user:', e);
}

// 导出到全局
window.AUTH = AUTH;
window.api = {
  register,
  login,
  logout,
  isLoggedIn,
  getProfile,
  getLeaderboard,
  getWrongWords,
  markWordMastered,
  getGameHistory,
};
