import React, { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from '../axiosConfig';
import PageHeader from './Layout/PageHeader';
import NotificationSnackbar from './shared/NotificationSnackbar';
import { createDataShare, getDataShares, deleteDataShare, updateDataSharePermissions } from '../utils/dataShareAPI';

const DataSharing = () => {
  const [dataShares, setDataShares] = useState([]);
  const [sharingTabValue, setSharingTabValue] = useState(0);
  const [shareEmail, setShareEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [sharePermissions, setSharePermissions] = useState('rw');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  const [editShareDialogOpen, setEditShareDialogOpen] = useState(false);
  const [editShare, setEditShare] = useState(null);
  const [editPermission, setEditPermission] = useState('rw');

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        // First fetch user email
        const emailResponse = await axios.get('/api/user/settings/');
        const email = emailResponse.data.email;
        setUserEmail(email);
        
        // Then fetch shares (after we have the email)
        const shares = await getDataShares();
        setDataShares(shares.results || shares);
      } catch (err) {
        console.error('Failed to initialize data sharing:', err);
        setNotification({
          open: true,
          message: 'Failed to load data sharing information',
          type: 'error',
        });
      } finally {
        setLoading(false);
      }
    };
    
    initializeComponent();
  }, []);

  const handleCreateShare = async () => {
    if (!shareEmail.trim()) {
      setNotification({
        open: true,
        message: 'Please enter an email address',
        type: 'error',
      });
      return;
    }

    try {
      setSharingLoading(true);
      const permissions = {
        properties: sharePermissions,
        tasks: sharePermissions,
        vendors: sharePermissions,
        areas: sharePermissions,
        attachments: sharePermissions,
      };

      await createDataShare(shareEmail, permissions);

      // Reset form
      setShareEmail('');
      setSharePermissions('rw');
      
      // Refresh shares
      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({
        open: true,
        message: `Data shared successfully with ${shareEmail}!`,
        type: 'success',
      });
    } catch (err) {
      const errorMessage = err.response?.data?.shared_with_email?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to create share';
      setNotification({
        open: true,
        message: errorMessage,
        type: 'error',
      });
      console.error(err);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleDeleteShare = (share) => {
    setShareToDelete(share);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setSharingLoading(true);
      await deleteDataShare(shareToDelete.id);
      
      // Refresh shares
      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({
        open: true,
        message: 'Share removed successfully!',
        type: 'success',
      });
    } catch (err) {
      setNotification({
        open: true,
        message: 'Failed to remove share',
        type: 'error',
      });
      console.error(err);
    } finally {
      setSharingLoading(false);
      setDeleteConfirmOpen(false);
      setShareToDelete(null);
    }
  };

  const handleEditShare = (share) => {
    setEditShare(share);
    setEditPermission(share.permissions.properties);
    setEditShareDialogOpen(true);
  };

  const handleConfirmEditPermissions = async () => {
    try {
      setSharingLoading(true);
      const permissions = {
        properties: editPermission,
        tasks: editPermission,
        vendors: editPermission,
        areas: editPermission,
        attachments: editPermission,
      };
      
      await updateDataSharePermissions(editShare.id, permissions);
      
      // Refresh shares
      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({
        open: true,
        message: 'Permissions updated successfully!',
        type: 'success',
      });
    } catch (err) {
      setNotification({
        open: true,
        message: 'Failed to update permissions',
        type: 'error',
      });
      console.error(err);
    } finally {
      setSharingLoading(false);
      setEditShareDialogOpen(false);
      setEditShare(null);
    }
  };

  const handleSharingTabChange = (event, newValue) => {
    setSharingTabValue(newValue);
  };

  // Filter shares: tab 0 = my shares (owner), tab 1 = shared with me
  const myShares = dataShares.filter(share => userEmail && share.owner_email === userEmail);
  const sharedWithMe = dataShares.filter(share => userEmail && share.shared_with_email === userEmail);

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
        title="Data Sharing"
        subtitle="Share your data with other users or see who shared data with you"
        breadcrumbs={[{ label: 'Home' }, { label: 'Data Sharing' }]}
      />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Manage Data Sharing" titleTypographyProps={{ variant: 'h6' }} />
            <Divider />
            <CardContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Tabs for Share Your Data vs Shared With Me */}
                <Tabs value={sharingTabValue} onChange={handleSharingTabChange} variant="fullWidth">
                  <Tab label="Share Your Data" />
                  <Tab label="Shared With Me" />
                </Tabs>

                {/* Tab 1: Share Your Data */}
                {sharingTabValue === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info">
                      Share all your data (properties, tasks, vendors, areas) with another user
                    </Alert>

                    <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', maxWidth: 500 }}>
                      <TextField
                        label="User Email"
                        type="email"
                        value={shareEmail}
                        onChange={(e) => setShareEmail(e.target.value)}
                        placeholder="Enter email of user to share with"
                        fullWidth
                        variant="outlined"
                        size="small"
                      />

                      <FormControl fullWidth size="small">
                        <InputLabel>Permission Level</InputLabel>
                        <Select
                          value={sharePermissions}
                          onChange={(e) => setSharePermissions(e.target.value)}
                          label="Permission Level"
                        >
                          <MenuItem value="rw">Read & Write</MenuItem>
                          <MenuItem value="ro">Read Only</MenuItem>
                        </Select>
                      </FormControl>

                      <Button
                        variant="contained"
                        color="primary"
                        onClick={handleCreateShare}
                        disabled={sharingLoading || !shareEmail}
                      >
                        {sharingLoading ? 'Sharing...' : 'Share Data'}
                      </Button>
                    </Box>

                    {/* List of active shares */}
                    {myShares.length > 0 && (
                      <Box sx={{ mt: 3 }}>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                          Active Shares ({myShares.length})
                        </Typography>
                        <List>
                          {myShares.map((share) => (
                            <ListItem
                              key={share.id}
                              disablePadding
                              sx={{
                                mb: 1,
                                p: 1.5,
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                              }}
                            >
                              <ListItemText
                                primary={`${share.shared_with_name || 'User'} - ${share.shared_with_email}`}
                                secondary={`Permission: ${share.permissions.properties === 'rw' ? 'Read & Write' : 'Read Only'}`}
                                primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 'bold' } }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  aria-label="edit"
                                  onClick={() => handleEditShare(share)}
                                  disabled={sharingLoading}
                                  size="small"
                                  sx={{ mr: 1 }}
                                >
                                  <EditIcon />
                                </IconButton>
                                <IconButton
                                  edge="end"
                                  aria-label="delete"
                                  onClick={() => handleDeleteShare(share)}
                                  disabled={sharingLoading}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {myShares.length === 0 && (
                      <Alert severity="info">
                        You haven't shared your data with anyone yet
                      </Alert>
                    )}
                  </Box>
                )}

                {/* Tab 2: Shared With Me */}
                {sharingTabValue === 1 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sharedWithMe.length > 0 ? (
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'bold' }}>
                          Users Who Shared Data With You ({sharedWithMe.length})
                        </Typography>
                        <List>
                          {sharedWithMe.map((share) => (
                            <ListItem
                              key={share.id}
                              disablePadding
                              sx={{ mb: 1, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}
                            >
                              <Box sx={{ width: '100%' }}>
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 'bold', color: '#1976d2' }}
                                >
                                  {share.owner_name || share.owner_email}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                  Permission: {share.permissions.properties === 'rw' ? '✓ Read & Write' : '✓ Read Only'}
                                </Typography>
                              </Box>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    ) : (
                      <Alert severity="info">
                        No data has been shared with you yet
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Permissions Dialog */}
      <Dialog open={editShareDialogOpen} onClose={() => setEditShareDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Share Permissions</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">
              Changing permissions for: <strong>{editShare?.shared_with_name || editShare?.shared_with_email}</strong>
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Permission Level</InputLabel>
              <Select
                value={editPermission}
                onChange={(e) => setEditPermission(e.target.value)}
                label="Permission Level"
              >
                <MenuItem value="rw">Read & Write</MenuItem>
                <MenuItem value="ro">Read Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditShareDialogOpen(false)} disabled={sharingLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirmEditPermissions} color="primary" variant="contained" disabled={sharingLoading}>
            {sharingLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Remove Share?</DialogTitle>
        <DialogContent>
          Are you sure you want to revoke access for{' '}
          <strong>{shareToDelete?.shared_with_name || shareToDelete?.shared_with_email}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={sharingLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={sharingLoading}>
            {sharingLoading ? 'Removing...' : 'Remove'}
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

export default DataSharing;
