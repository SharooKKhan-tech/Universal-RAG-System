import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, company_name: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('rag_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Attach token to every request
  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete apiClient.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Load current user from token on mount
  useEffect(() => {
    const loadUser = async () => {
      if (!token) { setIsLoading(false); return; }
      try {
        const res = await apiClient.get('/auth/me');
        setUser(res.data);
      } catch {
        setToken(null);
        localStorage.removeItem('rag_token');
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    const { access_token, user: u } = res.data;
    localStorage.setItem('rag_token', access_token);
    setToken(access_token);
    setUser(u);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, company_name: string) => {
    const res = await apiClient.post('/auth/register', { name, email, password, company_name });
    const { access_token, user: u } = res.data;
    localStorage.setItem('rag_token', access_token);
    setToken(access_token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('rag_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
