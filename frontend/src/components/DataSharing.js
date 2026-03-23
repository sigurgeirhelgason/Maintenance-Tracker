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
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CancelIcon from '@mui/icons-material/Cancel';
import axios from '../axiosConfig';
import PageHeader from './Layout/PageHeader';
import NotificationSnackbar from './shared/NotificationSnackbar';
import {
  createDataShare,
  getDataShares,
  deleteDataShare,
  updateDataSharePermissions,
  initiateOwnershipTransfer,
  getPendingTransfers,
  cancelTransfer,
  dismissTransfer,
} from '../utils/dataShareAPI';

// Returns a human-readable "expires in X hours" label.
const getExpiresLabel = (expiresAt) => {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt) - new Date();
  if (diffMs <= 0) return 'Expired';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `Expires in ${hours}h ${minutes}m`;
  return `Expires in ${minutes}m`;
};

const statusColor = (status) => {
  switch (status) {
    case 'pending': return 'warning';
    case 'confirmed': return 'success';
    case 'expired': return 'default';
    case 'cancelled': return 'default';
    default: return 'default';
  }
};

const DataSharing = () => {
  const [dataShares, setDataShares] = useState([]);
  const [properties, setProperties] = useState([]);
  const [sharingTabValue, setSharingTabValue] = useState(0);
  const [shareEmail, setShareEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [sharePermissions, setSharePermissions] = useState('rw');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [shareToDelete, setShareToDelete] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  const [editShareDialogOpen, setEditShareDialogOpen] = useState(false);
  const [editShare, setEditShare] = useState(null);
  const [editPermission, setEditPermission] = useState('rw');

  // Ownership transfer state
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [cancelTransferDialogOpen, setCancelTransferDialogOpen] = useState(false);
  const [transferToCancel, setTransferToCancel] = useState(null);

  useEffect(() => {
    const initializeComponent = async () => {
      try {
        const [emailResponse, sharesResponse, propertiesResponse] = await Promise.all([
          axios.get('/api/user/settings/'),
          getDataShares(),
          axios.get('/api/properties/'),
        ]);

        setUserEmail(emailResponse.data.email);
        setDataShares(sharesResponse.results || sharesResponse);
        const propsData = propertiesResponse.data;
        setProperties(propsData.results || propsData);
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

  // Fetch pending transfers whenever the first tab is active
  useEffect(() => {
    if (sharingTabValue !== 0) return;
    const fetchTransfers = async () => {
      setTransfersLoading(true);
      try {
        const data = await getPendingTransfers();
        setPendingTransfers(data.results || data);
      } catch (err) {
        console.error('Failed to fetch pending transfers:', err);
      } finally {
        setTransfersLoading(false);
      }
    };
    fetchTransfers();
  }, [sharingTabValue]);

  const handleCreateShare = async () => {
    if (!shareEmail.trim()) {
      setNotification({ open: true, message: 'Please enter an email address', type: 'error' });
      return;
    }

    // Handle "Give Ownership" separately
    if (sharePermissions === 'give_ownership') {
      if (!selectedPropertyId) {
        setNotification({ open: true, message: 'Please select a property to transfer', type: 'error' });
        return;
      }
      try {
        setSharingLoading(true);
        await initiateOwnershipTransfer(Number(selectedPropertyId), shareEmail);

        // Reset form
        setShareEmail('');
        setSharePermissions('rw');
        setSelectedPropertyId('');

        // Refresh pending transfers
        const data = await getPendingTransfers();
        setPendingTransfers(data.results || data);

        setNotification({
          open: true,
          message: 'Confirmation email sent. Check your inbox to complete the transfer.',
          type: 'success',
        });
      } catch (err) {
        const errorMessage =
          err.response?.data?.to_user_email?.[0] ||
          err.response?.data?.property?.[0] ||
          err.response?.data?.detail ||
          err.message ||
          'Failed to initiate ownership transfer';
        setNotification({ open: true, message: errorMessage, type: 'error' });
        console.error(err);
      } finally {
        setSharingLoading(false);
      }
      return;
    }

    // Regular share
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

      setShareEmail('');
      setSharePermissions('rw');

      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({
        open: true,
        message: `Data shared successfully with ${shareEmail}!`,
        type: 'success',
      });
    } catch (err) {
      const errorMessage =
        err.response?.data?.shared_with_email?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to create share';
      setNotification({ open: true, message: errorMessage, type: 'error' });
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

      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({ open: true, message: 'Share removed successfully!', type: 'success' });
    } catch (err) {
      setNotification({ open: true, message: 'Failed to remove share', type: 'error' });
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

      const shares = await getDataShares();
      setDataShares(shares.results || shares);

      setNotification({ open: true, message: 'Permissions updated successfully!', type: 'success' });
    } catch (err) {
      setNotification({ open: true, message: 'Failed to update permissions', type: 'error' });
      console.error(err);
    } finally {
      setSharingLoading(false);
      setEditShareDialogOpen(false);
      setEditShare(null);
    }
  };

  const handleCancelTransfer = (transfer) => {
    setTransferToCancel(transfer);
    setCancelTransferDialogOpen(true);
  };

  const handleConfirmCancelTransfer = async () => {
    try {
      setSharingLoading(true);
      await cancelTransfer(transferToCancel.id);

      const data = await getPendingTransfers();
      setPendingTransfers(data.results || data);

      setNotification({ open: true, message: 'Ownership transfer cancelled.', type: 'success' });
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || err.message || 'Failed to cancel transfer';
      setNotification({ open: true, message: errorMessage, type: 'error' });
      console.error(err);
    } finally {
      setSharingLoading(false);
      setCancelTransferDialogOpen(false);
      setTransferToCancel(null);
    }
  };

  const handleDismissTransfer = async (transfer) => {
    try {
      setSharingLoading(true);
      await dismissTransfer(transfer.id);

      const data = await getPendingTransfers();
      setPendingTransfers(data.results || data);

      setNotification({ open: true, message: 'Transfer record dismissed.', type: 'success' });
    } catch (err) {
      const errorMessage =
        err.response?.data?.detail || err.message || 'Failed to dismiss transfer';
      setNotification({ open: true, message: errorMessage, type: 'error' });
      console.error(err);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleSharingTabChange = (event, newValue) => {
    setSharingTabValue(newValue);
  };

  const handlePermissionsChange = (value) => {
    setSharePermissions(value);
    // When switching away from give_ownership, clear the property selection
    if (value !== 'give_ownership') {
      setSelectedPropertyId('');
    }
  };

  // Filter shares: tab 0 = my shares (owner), tab 1 = shared with me
  const myShares = dataShares.filter(share => userEmail && share.owner_email === userEmail);
  const sharedWithMe = dataShares.filter(share => userEmail && share.shared_with_email === userEmail);

  // Only show pending transfers — confirmed transfers are hidden automatically
  const visibleTransfers = pendingTransfers.filter(
    (t) => t.status === 'pending'
  );

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
                {/* Tabs */}
                <Tabs value={sharingTabValue} onChange={handleSharingTabChange} variant="fullWidth">
                  <Tab label="Share Your Data" />
                  <Tab label="Shared With Me" />
                </Tabs>

                {/* Tab 0: Share Your Data */}
                {sharingTabValue === 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="info">
                      Share all your data (properties, tasks, vendors, areas) with another user, or
                      transfer ownership of a specific property.
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
                          onChange={(e) => handlePermissionsChange(e.target.value)}
                          label="Permission Level"
                        >
                          <MenuItem value="rw">Read & Write</MenuItem>
                          <MenuItem value="ro">Read Only</MenuItem>
                          <MenuItem value="give_ownership">Give Ownership</MenuItem>
                        </Select>
                      </FormControl>

                      {/* Property selector — only shown for Give Ownership */}
                      {sharePermissions === 'give_ownership' && (
                        <FormControl fullWidth size="small">
                          <InputLabel>Select Property</InputLabel>
                          <Select
                            value={selectedPropertyId}
                            onChange={(e) => setSelectedPropertyId(e.target.value)}
                            label="Select Property"
                          >
                            {properties
                              .filter((prop) => prop.user_email === userEmail)
                              .map((prop) => (
                                <MenuItem key={prop.id} value={prop.id}>
                                  {prop.name}
                                </MenuItem>
                              ))}
                          </Select>
                        </FormControl>
                      )}

                      {/* Warning alert for Give Ownership */}
                      {sharePermissions === 'give_ownership' && (
                        <Alert severity="warning">
                          This will permanently transfer ownership of the selected property and all
                          its tasks and files to the other user. You will receive read-write access
                          to it after the transfer. A confirmation email will be sent to you to
                          complete the transfer.
                        </Alert>
                      )}

                      <Button
                        variant="contained"
                        color={sharePermissions === 'give_ownership' ? 'warning' : 'primary'}
                        onClick={handleCreateShare}
                        disabled={sharingLoading || !shareEmail}
                      >
                        {sharingLoading
                          ? 'Processing...'
                          : sharePermissions === 'give_ownership'
                          ? 'Initiate Transfer'
                          : 'Share Data'}
                      </Button>
                    </Box>

                    {/* Pending Ownership Transfers */}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                        Pending Ownership Transfers
                      </Typography>
                      {transfersLoading ? (
                        <CircularProgress size={20} />
                      ) : visibleTransfers.length > 0 ? (
                        <List disablePadding>
                          {visibleTransfers.map((transfer) => (
                            <ListItem
                              key={transfer.id}
                              disablePadding
                              sx={{
                                mb: 1,
                                p: 1.5,
                                border: '1px solid #e0e0e0',
                                borderRadius: 1,
                              }}
                            >
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                      {transfer.property_name || `Property #${transfer.property}`}
                                    </Typography>
                                    <Chip
                                      label={transfer.status}
                                      size="small"
                                      color={statusColor(transfer.status)}
                                    />
                                  </Box>
                                }
                                secondary={
                                  <Box component="span">
                                    <Typography variant="caption" display="block">
                                      Transfer to: {transfer.to_user_email}
                                    </Typography>
                                    {transfer.expires_at && (
                                      <Typography variant="caption" color="text.secondary">
                                        {getExpiresLabel(transfer.expires_at)}
                                      </Typography>
                                    )}
                                  </Box>
                                }
                              />
                              <ListItemSecondaryAction>
                                {transfer.status === 'pending' && (
                                  <IconButton
                                    edge="end"
                                    aria-label="cancel transfer"
                                    size="small"
                                    onClick={() => handleCancelTransfer(transfer)}
                                    disabled={sharingLoading}
                                  >
                                    <CancelIcon fontSize="small" />
                                  </IconButton>
                                )}
                                {transfer.status === 'confirmed' && (
                                  <IconButton
                                    edge="end"
                                    aria-label="dismiss"
                                    size="small"
                                    onClick={() => handleDismissTransfer(transfer)}
                                    disabled={sharingLoading}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Alert severity="info" sx={{ py: 0.5 }}>
                          No pending ownership transfers
                        </Alert>
                      )}
                    </Box>

                    <Divider />

                    {/* Active data shares */}
                    {myShares.length > 0 && (
                      <Box>
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
                                secondary={`Permission: ${
                                  share.permissions.properties === 'rw' ? 'Read & Write' : 'Read Only'
                                }`}
                                primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 'bold' } }}
                                secondaryTypographyProps={{ variant: 'caption' }}
                              />
                              <ListItemSecondaryAction>
                                {share.owner_email === userEmail && (
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
                                )}
                                {share.owner_email === userEmail && (
                                  <IconButton
                                    edge="end"
                                    aria-label="delete"
                                    onClick={() => handleDeleteShare(share)}
                                    disabled={sharingLoading}
                                    size="small"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                )}
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

                {/* Tab 1: Shared With Me */}
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
                                  Permission:{' '}
                                  {share.permissions.properties === 'rw'
                                    ? 'Read & Write'
                                    : 'Read Only'}
                                </Typography>
                              </Box>
                              <ListItemSecondaryAction>
                                <IconButton
                                  edge="end"
                                  aria-label="remove share"
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
                    ) : (
                      <Alert severity="info">No data has been shared with you yet</Alert>
                    )}
                  </Box>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit Permissions Dialog */}
      <Dialog
        open={editShareDialogOpen}
        onClose={() => setEditShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Share Permissions</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">
              Changing permissions for:{' '}
              <strong>{editShare?.shared_with_name || editShare?.shared_with_email}</strong>
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
          <Button
            onClick={handleConfirmEditPermissions}
            color="primary"
            variant="contained"
            disabled={sharingLoading}
          >
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
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={sharingLoading}
          >
            {sharingLoading ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Transfer Confirmation Dialog */}
      <Dialog
        open={cancelTransferDialogOpen}
        onClose={() => setCancelTransferDialogOpen(false)}
      >
        <DialogTitle>Revoke Ownership Transfer?</DialogTitle>
        <DialogContent>
          Are you sure you want to revoke the ownership transfer for{' '}
          <strong>
            {transferToCancel?.property_name || `Property #${transferToCancel?.property}`}
          </strong>{' '}
          to <strong>{transferToCancel?.to_user_email}</strong>?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelTransferDialogOpen(false)} disabled={sharingLoading}>
            Back
          </Button>
          <Button
            onClick={handleConfirmCancelTransfer}
            color="error"
            variant="contained"
            disabled={sharingLoading}
          >
            {sharingLoading ? 'Revoking...' : 'Revoke Transfer'}
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
