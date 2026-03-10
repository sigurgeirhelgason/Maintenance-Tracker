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

const Register = () => {
  const navigate = useNavigate();
  const { register, error, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
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

    // Validation
    if (!formData.username || !formData.email || !formData.password || !formData.password2) {
      setLocalError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.password2) {
      setLocalError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await register(formData.username, formData.email, formData.password, formData.password2);
      // After registration, redirect to login or directly to dashboard
      navigate('/login');
    } catch (err) {
      setLocalError(error || 'Registration failed');
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
              Create Account
            </Typography>
            <Typography variant="body2" sx={{ mb: 3, textAlign: 'center', color: 'textSecondary' }}>
              Sign up to get started with Maintenance Tracker
            </Typography>

            {(localError || error) && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {localError || error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                margin="normal"
                disabled={loading || authLoading}
              />

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

              <TextField
                fullWidth
                label="Confirm Password"
                name="password2"
                type="password"
                value={formData.password2}
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
                {loading || authLoading ? <CircularProgress size={24} /> : 'Create Account'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant="body2">
                Already have an account?{' '}
                <Link
                  to="/login"
                  style={{
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  Sign in
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Register;
