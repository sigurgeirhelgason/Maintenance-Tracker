import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
} from '@mui/material';
import { useAuth } from '../AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, error, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [localError, setLocalError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setLocalError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setLocalError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err) {
      setLocalError(error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: '#f9fafb',
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 1, fontWeight: 700, textAlign: 'center' }}>
              Welcome Back
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'textSecondary' }}>
              Sign in to your Maintenance Tracker account
            </Typography>

            {(localError || error) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {localError || error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                margin="normal"
                disabled={loading || authLoading}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                margin="normal"
                disabled={loading || authLoading}
              />

              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                type="submit"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading || authLoading}
              >
                {loading || authLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Create one
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;
