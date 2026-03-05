import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Phone as PhoneIcon, Email as EmailIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => {
    fetch();
  }, []);

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification(prev => ({ ...prev, open: false }));
  };

  const openConfirmDialog = (title, message, onConfirm) => {
    setConfirmDialog({ open: true, title, message, onConfirm });
  };

  const handleConfirmDialogClose = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleConfirmDialogConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm();
    }
    handleConfirmDialogClose();
  };

  const fetch = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/vendors/');
      setVendors(response.data);
    } catch (err) {
      setError('Error fetching vendors');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (vendor = null) => {
    if (vendor) {
      setEditing(vendor);
      setFormData(vendor);
    } else {
      setEditing(null);
      setFormData({ name: '', contact_person: '', phone: '', email: '', address: '' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await axios.put(`/api/vendors/${editing.id}/`, formData);
      } else {
        await axios.post('/api/vendors/', formData);
      }
      fetch();
      handleClose();
    } catch (err) {
      console.error('Error saving:', err);
    }
  };

  const handleDelete = async (id) => {
    openConfirmDialog(
      'Delete Vendor',
      'Are you sure you want to delete this vendor? This action cannot be undone.',
      async () => {
        try {
          await axios.delete(`/api/vendors/${id}/`);
          showNotification('Vendor deleted successfully', 'success');
          fetch();
        } catch (err) {
          console.error('Error deleting:', err);
          showNotification('Error deleting vendor', 'error');
        }
      }
    );
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <PageHeader
          title="Vendors"
          subtitle="Manage contractors and vendors"
          breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Vendors' }]}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 1 }}>
          Add Vendor
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {vendors.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="textSecondary">No vendors yet. Create one to get started.</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 2 }}>
              Add Vendor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {vendors.map(vendor => (
            <Grid item xs={12} sm={6} md={4} key={vendor.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                    {vendor.name}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {vendor.contact_person && (
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                        <strong>Contact:</strong> {vendor.contact_person}
                      </Typography>
                    )}
                    {vendor.phone && (
                      <Typography variant="body2" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PhoneIcon sx={{ fontSize: 16 }} /> {vendor.phone}
                      </Typography>
                    )}
                    {vendor.email && (
                      <Typography variant="body2" sx={{ mb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon sx={{ fontSize: 16 }} /> {vendor.email}
                      </Typography>
                    )}
                    {vendor.address && (
                      <Typography variant="body2" color="textSecondary">
                        {vendor.address}
                      </Typography>
                    )}
                  </Box>
                </CardContent>
                <CardActions sx={{ pt: 0 }}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(vendor)}>
                    Edit
                  </Button>
                  <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(vendor.id)}>
                    Delete
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{editing ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField autoFocus margin="dense" label="Vendor Name" name="name" fullWidth value={formData.name} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Contact Person" name="contact_person" fullWidth value={formData.contact_person} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Phone" name="phone" fullWidth value={formData.phone} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Email" name="email" type="email" fullWidth value={formData.email} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Address" name="address" fullWidth value={formData.address} onChange={handleChange} variant="outlined" />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={handleConfirmDialogClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          {confirmDialog.title}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose}>Cancel</Button>
          <Button
            onClick={handleConfirmDialogConfirm}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vendors;