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
    const refreshToken = localStorage.getItem('refresh_token');
    
    // If we have both tokens, assume user is logged in and proceed
    // The axios interceptor will handle token refresh or logout if needed
    if (token && refreshToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Don't verify the token here - let components make normal API calls
      // When they do, the axios interceptor will handle any 401 errors
      setLoading(false);
    } else {
      // No tokens stored, user is not authenticated
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get('/api/user/me/');
      setUser(response.data);
      setError(null);
    } catch (err) {
      // Token is invalid, clear it silently
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (formData) => {
    try {
      setError(null);
      const response = await axios.post('/api/auth/register/', {
        email: formData.email,
        name: formData.name,
        password: formData.password,
        password2: formData.password2,
      });
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.email?.[0] || 
                       err.response?.data?.password?.[0] ||
                       err.response?.data?.non_field_errors?.[0] ||
                       'Registration failed';
      setError(errorMsg);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      // Get JWT token using email
      const tokenResponse = await axios.post('/api/auth/login/', {
        email,
        password,
      });

      const { access, refresh, user } = tokenResponse.data;

      // Store tokens
      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`;

      // Set user from response
      setUser(user);

      return user;
    } catch (err) {
      const errorMsg = err.response?.data?.email?.[0] ||
                       err.response?.data?.password?.[0] ||
                       err.response?.data?.detail || 
                       'Login failed';
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
    isAuthenticated: !!(localStorage.getItem('access_token') && localStorage.getItem('refresh_token')),
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
