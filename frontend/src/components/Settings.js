import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PageHeader from './Layout/PageHeader';
import NotificationSnackbar from './shared/NotificationSnackbar';

const Settings = () => {
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    email: '',
    name: '',
    currency: 'Kr.',
  });

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password2: '',
  });
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/user/settings/');
      setUserSettings(response.data);
      setProfileForm({
        email: response.data.email || '',
        name: response.data.name || '',
        currency: response.data.profile?.currency || 'Kr.',
      });
    } catch (err) {
      setNotification({
        open: true,
        message: 'Failed to load user settings',
        type: 'error',
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm({
      ...profileForm,
      [name]: value,
    });
  };

  const handleProfileSave = async () => {
    try {
      setSaving(true);
      const response = await axios.put(
        '/api/user/settings/update/',
        {
          email: profileForm.email,
          name: profileForm.name,
          currency: profileForm.currency,
        }
      );
      setUserSettings(response.data);
      setNotification({
        open: true,
        message: 'Profile updated successfully!',
        type: 'success',
      });
    } catch (err) {
      setNotification({
        open: true,
        message: `Failed to update profile: ${err.response?.data?.error || err.message}`,
        type: 'error',
      });
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value,
    });
    setPasswordError('');
  };

  const handlePasswordSubmit = async () => {
    // Validate
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.new_password2) {
      setPasswordError('All fields are required');
      return;
    }

    if (passwordForm.new_password !== passwordForm.new_password2) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);
      await axios.post('/api/user/settings/change-password/', {
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
        new_password2: passwordForm.new_password2,
      });

      setPasswordDialogOpen(false);
      setPasswordForm({
        old_password: '',
        new_password: '',
        new_password2: '',
      });
      setPasswordError('');

      setNotification({
        open: true,
        message: 'Password changed successfully!',
        type: 'success',
      });
    } catch (err) {
      const errorMessage = err.response?.data?.old_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.error ||
        'Failed to change password';
      setPasswordError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
        breadcrumbs={[{ label: 'Home' }, { label: 'Settings' }]}
      />

      <Grid container spacing={3}>
        {/* Profile Settings Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Profile Information" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  value={profileForm.email}
                  onChange={handleProfileChange}
                  fullWidth
                  variant="outlined"
                />
                <TextField
                  label="Name"
                  name="name"
                  value={profileForm.name}
                  onChange={handleProfileChange}
                  fullWidth
                  variant="outlined"
                />
                <FormControl fullWidth>
                  <InputLabel>Default Currency</InputLabel>
                  <Select
                    name="currency"
                    value={profileForm.currency}
                    onChange={handleProfileChange}
                    label="Default Currency"
                  >
                    <MenuItem value="Kr.">Icelandic Króna (Kr.)</MenuItem>
                    <MenuItem value="USD">US Dollar ($)</MenuItem>
                    <MenuItem value="EUR">Euro (€)</MenuItem>
                    <MenuItem value="GBP">British Pound (£)</MenuItem>
                    <MenuItem value="SEK">Swedish Króna (kr)</MenuItem>
                    <MenuItem value="NOK">Norwegian Krone (kr)</MenuItem>
                    <MenuItem value="DKK">Danish Krone (kr)</MenuItem>
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleProfileSave}
                  disabled={saving}
                  sx={{ mt: 1 }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Settings Card */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Security" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info">
                  Keep your account secure by using a strong password
                </Alert>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  Change Password
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => !saving && setPasswordDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {passwordError && <Alert severity="error">{passwordError}</Alert>}
            <TextField
              label="Current Password"
              name="old_password"
              type="password"
              value={passwordForm.old_password}
              onChange={handlePasswordChange}
              fullWidth
              variant="outlined"
              autoFocus
            />
            <TextField
              label="New Password"
              name="new_password"
              type="password"
              value={passwordForm.new_password}
              onChange={handlePasswordChange}
              fullWidth
              variant="outlined"
            />
            <TextField
              label="Confirm New Password"
              name="new_password2"
              type="password"
              value={passwordForm.new_password2}
              onChange={handlePasswordChange}
              fullWidth
              variant="outlined"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handlePasswordSubmit} variant="contained" color="primary" disabled={saving}>
            {saving ? 'Changing...' : 'Change Password'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <NotificationSnackbar
        open={notification.open}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, open: false })}
      />
    </Box>
  );
};

export default Settings;