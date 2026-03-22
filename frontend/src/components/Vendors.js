import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
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
  Tabs,
  Tab,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Search as SearchIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import VendorDetailModal from './VendorDetailModal';
import { AuthContext } from '../AuthContext';

const Vendors = ({ initialTab = 'personal' }) => {
  const isGlobalPage = initialTab === 'global';
  const { user: authUser } = React.useContext(AuthContext);
  const [vendors, setVendors] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
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
  const [activeTab, setActiveTab] = useState(0); // 0 = My Vendors, 1 = Favorite Global Vendors
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    postal_code: '',
    city: '',
    favorite: false,
    speciality: null,
    secondary_specialities: [],
  });

  useEffect(() => {
    fetchData();
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
    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
    handleConfirmDialogClose();
  };

  const fetchData = async () => {
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
        speciality: (typeof vendor.speciality === 'object' ? vendor.speciality?.id : vendor.speciality) || null,
        secondary_specialities: (vendor.secondary_specialities_details || vendor.secondary_specialities || []).map(t =>
          typeof t === 'object' ? t.id : t
        ),
      });
    } else {
      setEditing(null);
      setFormData({
        name: '', contact_person: '', phone: '', email: '',
        address: '', postal_code: '', city: '', favorite: false,
        speciality: null, secondary_specialities: [],
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
  };

  const handleDetailModalOpen = (vendor) => {
    setSelectedVendor(vendor);
    setDetailModalOpen(true);
  };

  const handleDetailModalClose = () => {
    setDetailModalOpen(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const submitData = {
        ...formData,
        secondary_specialities: formData.secondary_specialities.filter(id => id !== null && id !== undefined),
      };
      if (editing) {
        await axios.put(`/api/vendors/${editing.id}/`, submitData);
      } else {
        await axios.post('/api/vendors/', submitData);
      }
      fetchData();
      handleClose();
      showNotification(editing ? 'Vendor updated successfully' : 'Vendor created successfully');
    } catch (err) {
      console.error('Error saving:', err);
      showNotification('Error saving vendor', 'error');
    }
  };

  const handleDelete = async (id) => {
    openConfirmDialog(
      'Delete Vendor',
      'Are you sure you want to delete this vendor? This action cannot be undone.',
      async () => {
        try {
          await axios.delete(`/api/vendors/${id}/`);
          showNotification('Vendor deleted successfully');
          fetchData();
        } catch (err) {
          console.error('Error deleting:', err);
          showNotification('Error deleting vendor', 'error');
        }
      }
    );
  };

  const toggleFavorite = async (vendor) => {
    const newFavoriteStatus = !vendor.favorite;
    setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, favorite: newFavoriteStatus } : v));
    setSelectedVendor(prev => prev?.id === vendor.id ? { ...prev, favorite: newFavoriteStatus } : prev);
    try {
      const response = await axios.post(`/api/vendors/${vendor.id}/toggle_favorite/`);
      showNotification(response.data.detail);
    } catch (err) {
      console.error('Error updating favorite:', err);
      setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, favorite: vendor.favorite } : v));
      setSelectedVendor(prev => prev?.id === vendor.id ? { ...prev, favorite: vendor.favorite } : prev);
      showNotification('Error updating vendor', 'error');
    }
  };

  const toggleSaved = async (vendor) => {
    const newSavedStatus = !vendor.saved;
    setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, saved: newSavedStatus } : v));
    setSelectedVendor(prev => prev?.id === vendor.id ? { ...prev, saved: newSavedStatus } : prev);
    try {
      const response = await axios.post(`/api/vendors/${vendor.id}/toggle_saved/`);
      showNotification(response.data.detail);
    } catch (err) {
      console.error('Error updating saved status:', err);
      setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, saved: vendor.saved } : v));
      setSelectedVendor(prev => prev?.id === vendor.id ? { ...prev, saved: vendor.saved } : prev);
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

  const handleTabChange = (_, newValue) => {
    setActiveTab(newValue);
    setSearchTerm('');
    setTaskTypeFilter(null);
  };

  // Tab counts (personal page only)
  const myVendorsCount = useMemo(() => vendors.filter(v => !v.is_global).length, [vendors]);
  const favoriteGlobalCount = useMemo(() => vendors.filter(v => v.is_global && v.favorite).length, [vendors]);

  const filteredAndSortedVendors = useMemo(() => {
    let baseList;
    if (isGlobalPage) {
      baseList = vendors.filter(v => v.is_global);
    } else {
      baseList = activeTab === 0
        ? vendors.filter(v => !v.is_global)
        : vendors.filter(v => v.is_global && v.favorite);
    }

    let result = baseList.filter(vendor => {
      const matchesSearch =
        vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.phone?.includes(searchTerm) ||
        vendor.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesTaskType =
        !taskTypeFilter ||
        vendor.speciality?.id === parseInt(taskTypeFilter) ||
        vendor.secondary_specialities_details?.some(type => type.id === parseInt(taskTypeFilter));

      return matchesSearch && matchesTaskType;
    });

    result.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      return sortDirection === 'asc'
        ? aValue > bValue ? 1 : -1
        : aValue < bValue ? 1 : -1;
    });

    return result;
  }, [vendors, isGlobalPage, activeTab, searchTerm, sortBy, sortDirection, taskTypeFilter]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const favoritePersonalVendors = vendors.filter(v => v.favorite && !v.is_global);

  // Shared toolbar JSX used in both render branches
  const toolbar = (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', px: 2, pt: 2, pb: 1 }}>
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
            <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {(searchTerm || taskTypeFilter) && (
        <Button size="small" onClick={() => { setSearchTerm(''); setTaskTypeFilter(null); }}>
          Clear Filters
        </Button>
      )}
    </Box>
  );

  // Shared vendor table JSX used in both render branches
  const vendorTable = (emptyPersonalTab) => (
    filteredAndSortedVendors.length === 0 ? (
      <Box sx={{ py: 8, textAlign: 'center' }}>
        {!searchTerm && !taskTypeFilter ? (
          emptyPersonalTab ? (
            <>
              <Typography color="textSecondary" sx={{ mb: 2 }}>
                You haven't created any vendors yet.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                New Vendor
              </Button>
            </>
          ) : (
            <Typography color="textSecondary">
              No vendors found.
            </Typography>
          )
        ) : (
          <Typography color="textSecondary">No vendors match your filters.</Typography>
        )}
      </Box>
    ) : (
      <TableContainer>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#F5F5F5' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, minWidth: 40 }}>Favorite</TableCell>
              <TableCell
                sx={{ fontWeight: 700, minWidth: 200, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSortClick('name')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Vendor Name
                  {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>Task Type</TableCell>
              <TableCell
                sx={{ fontWeight: 700, minWidth: 120, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSortClick('contact_person')}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  Contact Person
                  {sortBy === 'contact_person' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                </Box>
              </TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Email</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedVendors.map(vendor => (
              <TableRow
                key={vendor.id}
                onClick={() => handleDetailModalOpen(vendor)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#F5F5F5' } }}
              >
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(vendor); }}
                    sx={{ color: vendor.favorite ? '#ffc107' : '#bdbdbd', padding: '4px' }}
                    title={vendor.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {vendor.favorite ? <StarIcon sx={{ fontSize: 18 }} /> : <StarBorderIcon sx={{ fontSize: 18 }} />}
                  </IconButton>
                </TableCell>
                <TableCell sx={{ fontWeight: vendor.is_premium ? 700 : 500, fontSize: '0.95rem' }}>
                  {vendor.name}
                </TableCell>
                <TableCell sx={{ fontSize: '0.9rem' }}>
                  {vendor.speciality_details
                    ? <Chip label={vendor.speciality_details.name} size="small" color="primary" variant="outlined" />
                    : '-'}
                </TableCell>
                <TableCell sx={{ fontSize: '0.9rem' }}>{vendor.contact_person || '-'}</TableCell>
                <TableCell sx={{ fontSize: '0.9rem' }}>{vendor.phone || '-'}</TableCell>
                <TableCell sx={{ fontSize: '0.9rem' }}>{vendor.email || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  );

  // ── Global page: flat browse view, no tabs, no New Vendor button ──────────
  if (isGlobalPage) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <PageHeader
            title="Global Vendors"
            subtitle="Browse and star global contractors"
            breadcrumbs={[
              { label: 'Home', path: '/' },
              { label: 'Global Vendors', path: '/vendors/global' },
            ]}
          />
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Paper>
          {toolbar}
          {vendorTable(false)}
        </Paper>

        {/* Vendor Detail Modal */}
        <VendorDetailModal
          open={detailModalOpen}
          vendor={selectedVendor}
          onClose={handleDetailModalClose}
          onEdit={null}
          onToggleFavorite={toggleFavorite}
          onToggleSaved={toggleSaved}
          isAdmin={authUser?.is_staff}
        />

        {/* Notification */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    );
  }

  // ── Personal page: two-tab layout ─────────────────────────────────────────
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <PageHeader
          title="Vendors"
          subtitle="Manage your vendors and favorite global contractors"
          breadcrumbs={[
            { label: 'Home', path: '/' },
            { label: 'Vendors', path: '/vendors' },
          ]}
        />
        {activeTab === 0 && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 1 }}>
            New Vendor
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Favorite personal vendors quick-access (My Vendors tab only) */}
      {activeTab === 0 && favoritePersonalVendors.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarIcon sx={{ color: '#ffc107' }} /> Favorites
          </Typography>
          <Grid container spacing={2}>
            {favoritePersonalVendors.map(vendor => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={vendor.id}>
                <Card
                  onClick={() => handleDetailModalOpen(vendor)}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': { boxShadow: 3, transform: 'translateY(-4px)' },
                  }}
                >
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                      {vendor.name}
                    </Typography>
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
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Unified card: toolbar + tabs + table */}
      <Paper>
        {toolbar}

        {/* Tabs — flush against the table */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                My Vendors
                <Chip label={myVendorsCount} size="small" color={activeTab === 0 ? 'primary' : 'default'} />
              </Box>
            }
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <StarIcon sx={{ fontSize: 16, color: activeTab === 1 ? 'inherit' : '#bdbdbd' }} />
                Favorite Global Vendors
                <Chip label={favoriteGlobalCount} size="small" color={activeTab === 1 ? 'primary' : 'default'} />
              </Box>
            }
          />
        </Tabs>

        {vendorTable(activeTab === 0)}
      </Paper>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{editing ? 'Edit Vendor' : 'New Vendor'}</span>
          <IconButton
            size="small"
            onClick={() => setFormData(prev => ({ ...prev, favorite: !prev.favorite }))}
            sx={{ color: formData.favorite ? '#ffc107' : '#bdbdbd' }}
          >
            {formData.favorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField autoFocus margin="dense" label="Vendor Name" name="name" fullWidth value={formData.name} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Contact Person" name="contact_person" fullWidth value={formData.contact_person} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Phone" name="phone" fullWidth value={formData.phone} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Email" name="email" type="email" fullWidth value={formData.email} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField margin="dense" label="Address" name="address" fullWidth value={formData.address} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <TextField
            margin="dense"
            label="Postal Code"
            name="postal_code"
            fullWidth
            value={formData.postal_code || ''}
            onChange={(e) => {
              const postal_code = e.target.value;
              setFormData(prev => ({ ...prev, postal_code }));
              if (postal_code.length >= 2) {
                axios.get(`/api/postal-code/lookup/?postal_code=${postal_code}`)
                  .then(res => { if (res.data.city) setFormData(prev => ({ ...prev, city: res.data.city })); })
                  .catch(err => console.error('Error looking up postal code:', err));
              }
            }}
            variant="outlined"
            sx={{ mb: 2 }}
            placeholder="e.g., 101"
          />
          <TextField margin="dense" label="City" name="city" fullWidth value={formData.city || ''} onChange={handleChange} variant="outlined" sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Main Speciality</InputLabel>
            <Select
              value={formData.speciality || ''}
              onChange={(e) => {
                const newSpeciality = e.target.value || null;
                setFormData(prev => {
                  let newSecondary = [...prev.secondary_specialities];
                  if (newSpeciality && !newSecondary.includes(newSpeciality)) newSecondary.push(newSpeciality);
                  return { ...prev, speciality: newSpeciality, secondary_specialities: newSecondary };
                });
              }}
              label="Main Speciality"
            >
              <MenuItem value="">None</MenuItem>
              {taskTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>Secondary Specialities</Typography>
          <FormGroup sx={{ mb: 2, pl: 1 }}>
            {taskTypes.map((type) => (
              <FormControlLabel
                key={type.id}
                control={
                  <Checkbox
                    checked={formData.secondary_specialities.includes(type.id)}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        secondary_specialities: e.target.checked
                          ? [...prev.secondary_specialities, type.id]
                          : prev.secondary_specialities.filter(id => id !== type.id),
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
          {editing && (
            <Button
              onClick={() => { handleDelete(editing.id); handleClose(); }}
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
            >
              Delete
            </Button>
          )}
          <Button onClick={handleSave} variant="contained">
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Vendor Detail Modal */}
      <VendorDetailModal
        open={detailModalOpen}
        vendor={selectedVendor}
        onClose={handleDetailModalClose}
        onEdit={() => { handleDetailModalClose(); handleOpen(selectedVendor); }}
        onToggleFavorite={toggleFavorite}
        onToggleSaved={toggleSaved}
        isAdmin={authUser?.is_staff}
      />

      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDialog.open} onClose={handleConfirmDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>{confirmDialog.title}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose}>Cancel</Button>
          <Button onClick={handleConfirmDialogConfirm} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Vendors;
