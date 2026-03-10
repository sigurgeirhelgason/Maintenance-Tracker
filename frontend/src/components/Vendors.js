import React, { useState, useEffect, useMemo } from 'react';
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
  IconButton,
  FormControlLabel,
  FormGroup,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Phone as PhoneIcon, Email as EmailIcon, Star as StarIcon, StarBorder as StarBorderIcon, Search as SearchIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon, Favorite as FavoriteIcon, FavoriteBorder as FavoriteBorderIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import DetailPanel from './shared/DetailPanel';
import DetailField from './shared/DetailField';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [taskTypeFilter, setTaskTypeFilter] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    favorite: false,
    task_type: null,
    secondary_task_types: [],
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
      const [vendorsRes, typesRes] = await Promise.all([
        axios.get('/api/vendors/'),
        axios.get('/api/tasktypes/'),
      ]);
      setVendors(vendorsRes.data);
      setTaskTypes(typesRes.data);
    } catch (err) {
      setError('Error fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (vendor = null) => {
    if (vendor) {
      setEditing(vendor);
      setFormData({
        ...vendor,
        task_type: vendor.task_type?.id || null,
        secondary_task_types: vendor.secondary_task_types?.map(t => t.id) || [],
      });
    } else {
      setEditing(null);
      setFormData({ name: '', contact_person: '', phone: '', email: '', address: '', favorite: false, task_type: null, secondary_task_types: [] });
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

  const toggleFavorite = async (vendor) => {
    try {
      await axios.patch(`/api/vendors/${vendor.id}/`, { favorite: !vendor.favorite });
      fetch();
      showNotification(
        vendor.favorite ? 'Vendor removed from favorites' : 'Vendor added to favorites',
        'success'
      );
    } catch (err) {
      console.error('Error updating favorite:', err);
      showNotification('Error updating vendor', 'error');
    }
  };

  const handleSortClick = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedVendors = useMemo(() => {
    let result = vendors.filter(vendor => {
      const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.phone?.includes(searchTerm) ||
        vendor.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesTaskType = !taskTypeFilter || vendor.task_type?.id === taskTypeFilter;
      
      return matchesSearch && matchesTaskType;
    });

    result.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return result;
  }, [vendors, searchTerm, sortBy, sortDirection, taskTypeFilter]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const favoriteVendors = vendors.filter(v => v.favorite);
  const allVendors = vendors;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <PageHeader
          title="Vendors"
          subtitle="Manage contractors and vendors"
          breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Vendors' }]}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 1 }}>
          New Vendor
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {vendors.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="textSecondary">No vendors yet. Create one to get started.</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 2 }}>
              New Vendor
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {/* Favorite Vendors Section */}
          {favoriteVendors.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ color: '#ffc107' }} /> Favorite Vendors
              </Typography>
              <Grid container spacing={2}>
                {favoriteVendors.map(vendor => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={vendor.id}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                        <IconButton
                          size="small"
                          onClick={() => toggleFavorite(vendor)}
                          sx={{ color: '#ffc107' }}
                        >
                          <StarIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Box>
                      <CardContent sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, pr: 3 }}>
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
            </Box>
          )}

          {/* All Vendors Section */}
          <Box sx={{ mt: 4 }}>
            {/* Search and Filter Bar */}
            <Paper sx={{ p: 2, mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
                <TextField
                  placeholder="Search vendors..."
                  variant="outlined"
                  size="small"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                  }}
                  sx={{ minWidth: 250 }}
                />
                <FormControl sx={{ minWidth: 200 }} size="small">
                  <InputLabel>Task Type</InputLabel>
                  <Select
                    value={taskTypeFilter || ''}
                    onChange={(e) => setTaskTypeFilter(e.target.value || null)}
                    label="Task Type"
                  >
                    <MenuItem value="">All Task Types</MenuItem>
                    {taskTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {(searchTerm || taskTypeFilter) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setSearchTerm('');
                      setTaskTypeFilter(null);
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </Box>
            </Paper>

            {/* Sort Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                Sort By:
              </Typography>
              <Button
                size="small"
                variant={sortBy === 'name' ? 'contained' : 'outlined'}
                onClick={() => handleSortClick('name')}
                endIcon={sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
                sx={{ textTransform: 'none' }}
              >
                Name
              </Button>
              <Button
                size="small"
                variant={sortBy === 'contact_person' ? 'contained' : 'outlined'}
                onClick={() => handleSortClick('contact_person')}
                endIcon={sortBy === 'contact_person' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
                sx={{ textTransform: 'none' }}
              >
                Contact
              </Button>
            </Box>

            {/* Vendors Table and Detail Panel */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TableContainer component={Paper} sx={{ flex: 1 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F5F5F5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, minWidth: 40 }}>Favorite</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Vendor Name</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Task Types</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Contact Person</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAndSortedVendors.length > 0 ? (
                      filteredAndSortedVendors.map(vendor => (
                        <TableRow
                          key={vendor.id}
                          onClick={() => setSelectedVendor(vendor)}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: selectedVendor?.id === vendor.id ? '#E3F2FD' : 'transparent',
                            '&:hover': {
                              bgcolor: '#F5F5F5',
                            },
                          }}
                        >
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(vendor); }}
                              sx={{ color: vendor.favorite ? '#ffc107' : '#bdbdbd', padding: '4px' }}
                            >
                              {vendor.favorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                            {vendor.name}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {vendor.task_type_details && (
                                <Chip label={`Main: ${vendor.task_type_details.name}`} size="small" color="primary" variant="outlined" />
                              )}
                              {vendor.secondary_task_types_details && vendor.secondary_task_types_details.length > 0 && (
                                vendor.secondary_task_types_details.map(type => (
                                  <Chip key={type.id} label={type.name} size="small" />
                                ))
                              )}
                              {!vendor.task_type_details && (!vendor.secondary_task_types_details || vendor.secondary_task_types_details.length === 0) && '-'}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            {vendor.contact_person || '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            {vendor.phone || '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            {vendor.email || '-'}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.9rem' }}>
                            <Button
                              size="small"
                              startIcon={<EditIcon />}
                              onClick={(e) => { e.stopPropagation(); handleOpen(vendor); }}
                              sx={{ mr: 1 }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<DeleteIcon />}
                              onClick={(e) => { e.stopPropagation(); handleDelete(vendor.id); }}
                            >
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign: 'center', py: 3 }}>
                          <Typography color="textSecondary">
                            {searchTerm || taskTypeFilter ? 'No vendors match your filters' : 'No vendors to display'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Vendor Detail Panel */}
              {selectedVendor && (
                <DetailPanel
                  title="Vendor Details"
                  onClose={() => setSelectedVendor(null)}
                  onEdit={() => handleOpen(selectedVendor)}
                  onDelete={() => { handleDelete(selectedVendor.id); setSelectedVendor(null); }}
                >
                  <DetailField label="VENDOR NAME" value={selectedVendor.name} />
                  {selectedVendor.task_type_details && (
                    <DetailField label="MAIN TASK TYPE" value={selectedVendor.task_type_details.name} />
                  )}
                  {selectedVendor.secondary_task_types_details && selectedVendor.secondary_task_types_details.length > 0 && (
                    <DetailField label="SECONDARY TASK TYPES">
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {selectedVendor.secondary_task_types_details.map(type => (
                          <Chip key={type.id} label={type.name} size="small" />
                        ))}
                      </Box>
                    </DetailField>
                  )}
                  {selectedVendor.contact_person && (
                    <DetailField label="CONTACT PERSON" value={selectedVendor.contact_person} />
                  )}
                  {selectedVendor.phone && (
                    <DetailField label="PHONE" value={selectedVendor.phone} />
                  )}
                  {selectedVendor.email && (
                    <DetailField label="EMAIL" value={selectedVendor.email} />
                  )}
                  {selectedVendor.address && (
                    <DetailField label="ADDRESS" value={selectedVendor.address} />
                  )}
                  <DetailField label="FAVORITE">
                    <IconButton
                      size="small"
                      onClick={() => { toggleFavorite(selectedVendor); }}
                      sx={{ color: selectedVendor.favorite ? '#ffc107' : '#bdbdbd' }}
                    >
                      {selectedVendor.favorite ? <StarIcon /> : <StarBorderIcon />}
                    </IconButton>
                  </DetailField>
                </DetailPanel>
              )}
            </Box>
          </Box>
        </Box>
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{editing ? 'Edit Vendor' : 'New Vendor'}</span>
          <IconButton
            size="small"
            onClick={() => setFormData(prev => ({ ...prev, favorite: !prev.favorite }))}
            sx={{ color: formData.favorite ? '#e91e63' : '#bdbdbd' }}
          >
            {formData.favorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField autoFocus margin="dense" label="Vendor Name" name="name" fullWidth value={formData.name} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Contact Person" name="contact_person" fullWidth value={formData.contact_person} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Phone" name="phone" fullWidth value={formData.phone} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Email" name="email" type="email" fullWidth value={formData.email} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Address" name="address" fullWidth value={formData.address} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Main Task Type</InputLabel>
            <Select
              value={formData.task_type || ''}
              onChange={(e) => {
                const newTaskType = e.target.value || null;
                setFormData(prev => {
                  let newSecondary = [...prev.secondary_task_types];
                  // If a main task type is selected, add it to secondary if not already there
                  if (newTaskType && !newSecondary.includes(newTaskType)) {
                    newSecondary.push(newTaskType);
                  }
                  return { 
                    ...prev, 
                    task_type: newTaskType,
                    secondary_task_types: newSecondary
                  };
                });
              }}
              label="Main Task Type"
            >
              <MenuItem value="">None</MenuItem>
              {taskTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Secondary Task Types</Typography>
          <FormGroup sx={{ mb: 2, pl: 1 }}>
            {taskTypes.map((type) => (
              <FormControlLabel
                key={type.id}
                control={
                  <Checkbox
                    checked={formData.secondary_task_types.includes(type.id)}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        secondary_task_types: e.target.checked
                          ? [...prev.secondary_task_types, type.id]
                          : prev.secondary_task_types.filter(id => id !== type.id)
                      }));
                    }}
                  />
                }
                label={type.name}
              />
            ))}
          </FormGroup>
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