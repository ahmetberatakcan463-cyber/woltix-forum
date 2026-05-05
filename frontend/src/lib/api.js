import axios from 'axios';

// ============================================
// WOLTIX FORUM - GÜVENLİ API İSTEMCİSİ
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Token'ları güvenli şekilde yönet (localStorage yerine memory + httpOnly cookie)
let memoryToken = null;

export function setAccessToken(token) {
  memoryToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function getAccessToken() {
  return memoryToken;
}

// ============================================
// CSRF TOKEN YÖNETİMİ
// ============================================
let csrfToken = null;

export async function fetchCsrfToken() {
  try {
    const res = await api.get('/csrf-token');
    csrfToken = res.data.token;
    return csrfToken;
  } catch {
    return null;
  }
}

// Her istekte CSRF token'ı ekle
api.interceptors.request.use((config) => {
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// ============================================
// RESPONSE INTERCEPTOR - Token yenileme
// ============================================
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    
    // 401 hatası ve daha önce retry yapılmadıysa
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      
      try {
        // Refresh token ile yeni access token al
        const res = await axios.post(
          `${API_BASE}/api/auth/refresh`,
          {},
          { withCredentials: true } // httpOnly cookie ile
        );
        
        const { accessToken } = res.data;
        setAccessToken(accessToken);
        
        // Orijinal isteği yeniden dene
        original.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // Token yenileme başarısız - logout
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login';
        }
      }
    }
    
    // Rate limit hatası
    if (err.response?.status === 429) {
      console.warn('[WOLTIX] Rate limit aşıldı, bekleniyor...');
      const retryAfter = parseInt(err.response.headers['retry-after'] || '5');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return api(original);
    }
    
    return Promise.reject(err);
  }
);

// ============================================
// GÜVENLİ API METODLARI
// ============================================

export const authApi = {
  login: async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    if (data.accessToken) setAccessToken(data.accessToken);
    return data;
  },
  
  register: async (username, email, password) => {
    const { data } = await api.post('/auth/register', { username, email, password });
    if (data.accessToken) setAccessToken(data.accessToken);
    return data;
  },
  
  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    setAccessToken(null);
  },
  
  refresh: async () => {
    const { data } = await api.post('/auth/refresh');
    if (data.accessToken) setAccessToken(data.accessToken);
    return data;
  },
};

export const userApi = {
  getProfile: (username) => api.get(`/users/${encodeURIComponent(username)}`),
  updateProfile: (data) => api.patch('/users/me', data),
  changePassword: (currentPassword, newPassword) => 
    api.patch('/users/me/password', { currentPassword, newPassword }),
  getNotifications: () => api.get('/users/me/notifications'),
  markNotificationsRead: () => api.patch('/users/me/notifications/read'),
};

export const threadApi = {
  getThread: (id) => api.get(`/threads/${id}`),
  createThread: (data) => api.post('/threads', data),
  replyToThread: (threadId, content) => api.post(`/threads/${threadId}/posts`, { content }),
  updateThread: (id, data) => api.patch(`/threads/${id}`, data),
  votePost: (postId, type) => api.post(`/threads/posts/${postId}/vote`, { type }),
  editPost: (postId, content) => api.patch(`/threads/posts/${postId}`, { content }),
};

export const categoryApi = {
  getCategories: () => api.get('/categories'),
  getCategory: (slug) => api.get(`/categories/${encodeURIComponent(slug)}`),
};

export const messageApi = {
  getConversations: () => api.get('/messages'),
  getConversation: (userId) => api.get(`/messages/${userId}`),
  sendMessage: (receiverId, content) => api.post('/messages', { receiverId, content }),
};

export const searchApi = {
  search: (query, type = 'all') => api.get('/search', { params: { q: query, type } }),
};

export const adminApi = {
  // Dashboard
  getStats: () => api.get('/admin/stats'),
  getRecentActivity: () => api.get('/admin/recent-activity'),
  getHealth: () => api.get('/admin/health'),

  // Users
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  banUser: (userId, ban, reason) => api.patch(`/admin/users/${userId}/ban`, { ban, reason }),
  updateRole: (userId, role) => api.patch(`/admin/users/${userId}/role`, { role }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resetPassword: (id, newPassword) => api.post(`/admin/users/${id}/reset-password`, { newPassword }),
  awardBadge: (userId, data) => api.post(`/admin/users/${userId}/badge`, data),

  // Categories
  getCategories: () => api.get('/admin/categories'),
  createCategory: (data) => api.post('/admin/categories', data),
  updateCategory: (id, data) => api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}`),
  reorderCategories: (order) => api.patch('/admin/categories/reorder', { order }),

  // Threads
  getThreads: (params) => api.get('/admin/threads', { params }),
  pinThread: (id) => api.patch(`/admin/threads/${id}/pin`),
  lockThread: (id) => api.patch(`/admin/threads/${id}/lock`),
  moveThread: (id, category_id) => api.patch(`/admin/threads/${id}/move`, { category_id }),
  deleteThread: (id) => api.delete(`/admin/threads/${id}`),
  hardDeleteThread: (id) => api.delete(`/admin/threads/${id}/hard`),

  // Posts
  getPosts: (params) => api.get('/admin/posts', { params }),
  restorePost: (id) => api.patch(`/admin/posts/${id}/restore`),
  deletePost: (id) => api.delete(`/admin/posts/${id}`),
  hardDeletePost: (id) => api.delete(`/admin/posts/${id}/hard`),

  // Badges
  getBadges: () => api.get('/admin/badges'),
  createBadge: (data) => api.post('/admin/badges', data),
  deleteBadge: (id) => api.delete(`/admin/badges/${id}`),

  // Tags
  getTags: () => api.get('/admin/tags'),
  createTag: (data) => api.post('/admin/tags', data),
  deleteTag: (id) => api.delete(`/admin/tags/${id}`),

  // Settings
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (settings) => api.put('/admin/settings', settings),

  // IP Bans
  getIpBans: () => api.get('/admin/ip-bans'),
  createIpBan: (data) => api.post('/admin/ip-bans', data),
  deleteIpBan: (id) => api.delete(`/admin/ip-bans/${id}`),

  // Broadcast
  sendBroadcast: (data) => api.post('/admin/broadcast', data),

  // Security Events
  getSecurityEvents: (params) => api.get('/admin/security-events', { params }),

  // Audit Log
  getAuditLog: (params) => api.get('/admin/audit-log', { params }),
  cleanAuditLog: () => api.delete('/admin/audit-log'),
};

export default api;
