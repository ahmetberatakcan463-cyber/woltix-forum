'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { setAccessToken } from '@/lib/api';

// ============================================
// WOLTIX FORUM - GÜVENLİ AUTH STORE
// ============================================

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      // NOT: accessToken ve refreshToken localStorage'da saklanmaz!
      // Sadece user bilgisi kalıcı olur, token'lar httpOnly cookie'de
      
      isAuthenticated: false,
      lastActivity: Date.now(),

      /**
       * Giriş yap - token'ları httpOnly cookie'ye bırak
       */
      setAuth: (user, accessToken) => {
        set({ 
          user, 
          isAuthenticated: true,
          lastActivity: Date.now(),
        });
        if (accessToken) {
          setAccessToken(accessToken);
        }
      },

      /**
       * Kullanıcı bilgisini güncelle
       */
      updateUser: (updates) => 
        set((state) => ({ 
          user: state.user ? { ...state.user, ...updates } : null 
        })),

      /**
       * Çıkış yap - tüm oturum verilerini temizle
       */
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {}
        
        setAccessToken(null);
        set({ 
          user: null, 
          isAuthenticated: false,
          lastActivity: null,
        });
      },

      /**
       * Token yenile - sadece gerekirse
       */
      refreshAccessToken: async () => {
        const { user } = get();
        if (!user) return false;
        
        try {
          const res = await api.post('/auth/refresh');
          const { accessToken } = res.data;
          if (accessToken) {
            setAccessToken(accessToken);
          }
          set({ lastActivity: Date.now() });
          return true;
        } catch {
          set({ user: null, isAuthenticated: false });
          setAccessToken(null);
          return false;
        }
      },

      /**
       * Oturum süresini kontrol et (30 dakika inaktif)
       */
      checkSessionTimeout: () => {
        const { lastActivity } = get();
        if (!lastActivity) return false;
        const inactiveTime = Date.now() - lastActivity;
        return inactiveTime < 30 * 60 * 1000; // 30 dakika
      },
    }),
    {
      name: 'woltix-auth',
      // Sadece user bilgisini localStorage'da sakla
      partialize: (state) => ({ 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
