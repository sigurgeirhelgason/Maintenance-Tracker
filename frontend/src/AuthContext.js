import React, { createContext, useState, useEffect } from 'react';
import axios from './axiosConfig'; // Use the configured axios instance

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Verify token by getting current user
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/user/me/');
      setUser(response.data);
      setError(null);
    } catch (err) {
      // Token is invalid, clear it
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setError('Session expired');
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, email, password, password2) => {
    try {
      setError(null);
      const response = await axios.post('/api/register/', {
        username,
        email,
        password,
        password2,
      });
      setUser(response.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.username?.[0] || 
                       err.response?.data?.email?.[0] ||
                       err.response?.data?.password?.[0] ||
                       'Registration failed';
      setError(errorMsg);
      throw err;
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      // Get JWT token
      const tokenResponse = await axios.post('/api/token/', {
        username,
        password,
      });

      const { access, refresh } = tokenResponse.data;

      // Store tokens
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // Get user info
      const userResponse = await axios.get('/api/user/me/');
      setUser(userResponse.data);

      return userResponse.data;
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Login failed';
      setError(errorMsg);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
