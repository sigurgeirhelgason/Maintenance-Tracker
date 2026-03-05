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
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Snackbar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';

const ROOM_TYPES = [
  'Living room',
  'Bed room',
  'Storage',
  'Kitchen',
  'Bathroom',
  'Office',
  'Laundry',
  'Dining room',
  'Garden',
];

const Areas = () => {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [areas, setAreas] = useState([]);
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
    type: ROOM_TYPES[0],
    name: '',
    description: '',
    floor: 1,
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchAreas(selectedProperty);
    }
  }, [selectedProperty]);

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

  const getAreasByFloor = () => {
    // Group areas by floor (0 = garden, 1+ = regular floors)
    const grouped = {};
    areas.forEach(area => {
      const floor = area.floor ?? 1;  // Use nullish coalescing to allow floor 0 for gardens
      if (!grouped[floor]) {
        grouped[floor] = [];
      }
      grouped[floor].push(area);
    });
    // Sort floors numerically (0 first for gardens, then 1+) and areas by name within each floor
    return Object.keys(grouped)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .reduce((acc, floor) => {
        acc[floor] = grouped[floor].sort((a, b) => (a.name || a.type).localeCompare(b.name || b.type));
        return acc;
      }, {});
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/properties/');
      setProperties(response.data);
      if (response.data.length > 0 && !selectedProperty) {
        setSelectedProperty(response.data[0].id);
      }
    } catch (err) {
      setError('Error fetching properties');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreas = async (propertyId) => {
    try {
      const response = await axios.get(`/api/areas/?property=${propertyId}`);
      setAreas(response.data);
    } catch (err) {
      console.error('Error fetching areas:', err);
      setError('Error fetching areas');
    }
  };

  const handlePropertyChange = (e) => {
    setSelectedProperty(e.target.value);
  };

  const handleOpen = (area = null) => {
    if (area) {
      setEditing(area);
      setFormData({ type: area.type, name: area.name || '', description: area.description, floor: area.floor });
    } else {
      setEditing(null);
      setFormData({ type: ROOM_TYPES[0], name: '', description: '', floor: 1 });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
    setFormData({ type: ROOM_TYPES[0], name: '', description: '', floor: 1 });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!formData.type.trim()) {
      showNotification('Room type is required', 'warning');
      return;
    }

    try {
      if (editing) {
        const updateData = { type: formData.type, name: formData.name || null, description: formData.description, floor: parseInt(formData.floor, 10) };
        await axios.put(`/api/areas/${editing.id}/`, updateData);
      } else {
        const createData = { type: formData.type, name: formData.name || null, description: formData.description, property: selectedProperty, floor: parseInt(formData.floor, 10) };
        await axios.post('/api/areas/', createData);
      }
      fetchAreas(selectedProperty);
      handleClose();
    } catch (err) {
      console.error('Error saving:', err);
      setError('Error saving area');
    }
  };

  const handleDelete = async (id) => {
    openConfirmDialog(
      'Delete Area',
      'Are you sure you want to delete this area? This action cannot be undone.',
      async () => {
        try {
          await axios.delete(`/api/areas/${id}/`);
          showNotification('Area deleted successfully', 'success');
          fetchAreas(selectedProperty);
        } catch (err) {
          console.error('Error deleting:', err);
          showNotification('Error deleting area', 'error');
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

  const currentProperty = properties.find(p => p.id === selectedProperty);

  return (
    <Box>
      <PageHeader
        title="Areas/Rooms"
        subtitle="Manage areas or rooms in your properties"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Areas' }]}
      />

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {properties.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="textSecondary">No properties found. Create a property first.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Box>
          {/* Property Selector - Only show if more than one property */}
          {properties.length > 1 && (
            <Box sx={{ mb: 4 }}>
              <FormControl sx={{ minWidth: 200, mb: 2 }}>
                <InputLabel>Select Property</InputLabel>
                <Select
                  value={selectedProperty || ''}
                  onChange={handlePropertyChange}
                  label="Select Property"
                >
                  {properties.map(prop => (
                    <MenuItem key={prop.id} value={prop.id}>
                      {prop.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpen()}
                sx={{ ml: 2, mt: 1 }}
              >
                Add Area
              </Button>
            </Box>
          )}
          
          {/* Single Property - Add Area Button */}
          {properties.length === 1 && (
            <Box sx={{ mb: 4 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpen()}
              >
                Add Area
              </Button>
            </Box>
          )}

          {/* Property Info */}
          {currentProperty && (
            <>
              <Card sx={{ mb: 3, backgroundColor: 'rgba(37, 99, 235, 0.05)' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {currentProperty.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                    {currentProperty.address}
                  </Typography>
                </CardContent>
              </Card>
            </>
          )}

          {/* Areas Grid */}
          {areas.length === 0 ? (
            <Card>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  No areas yet. Add one to get started.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpen()}
                >
                  Add Area
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Box>
              {Object.entries(getAreasByFloor()).map(([floor, floorAreas]) => (
                <Box key={floor} sx={{ mb: 4 }}>
                  <Paper 
                    sx={{ 
                      p: 2, 
                      mb: 2, 
                      backgroundColor: floor === '0' ? '#e8f5e9' : '#f5f5f5',
                      borderLeft: floor === '0' ? '4px solid #4caf50' : '4px solid #2563eb'
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600, color: floor === '0' ? '#2e7d32' : 'inherit' }}>
                      {floor === '0' ? '🌿 Garden' : `Floor ${floor}`}
                    </Typography>
                  </Paper>
                  <Grid container spacing={2}>
                    {floorAreas.map(area => (
                      <Grid item xs={12} sm={6} md={4} key={area.id}>
                        <Card sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          flexDirection: 'column',
                          borderTop: floor === '0' ? '3px solid #4caf50' : '3px solid #2563eb'
                        }}>
                          <CardContent sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                              {area.type}
                            </Typography>
                            {area.name && (
                              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                                {area.name}
                              </Typography>
                            )}
                            {area.description && (
                              <Typography variant="body2" color="textSecondary">
                                {area.description}
                              </Typography>
                            )}
                          </CardContent>
                          <CardActions sx={{ pt: 0 }}>
                            <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(area)}>
                              Edit
                            </Button>
                            <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(area.id)}>
                              Delete
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Area' : 'New Area'}</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Room Type</InputLabel>
            <Select
              name="type"
              value={formData.type}
              onChange={handleChange}
              label="Room Type"
              autoFocus
            >
              {ROOM_TYPES.map(roomType => (
                <MenuItem key={roomType} value={roomType}>
                  {roomType}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Custom Name (Optional)"
            name="name"
            fullWidth
            placeholder="e.g., Master Bedroom, Guest Room"
            value={formData.name}
            onChange={handleChange}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Floor</InputLabel>
            <Select
              name="floor"
              value={formData.floor}
              onChange={handleChange}
              label="Floor"
            >
              {(() => {
                const property = properties.find(p => p.id === selectedProperty);
                const maxFloor = property?.num_floors || 1;
                const menuItems = [];
                
                // Add Garden option if property has garden
                if (property?.has_garden) {
                  menuItems.push(
                    <MenuItem key={0} value={0}>
                      🌿 Garden
                    </MenuItem>
                  );
                }
                
                // Add regular floors
                Array.from({ length: maxFloor }, (_, i) => i + 1).forEach(floor => {
                  menuItems.push(
                    <MenuItem key={floor} value={floor}>
                      Floor {floor}
                    </MenuItem>
                  );
                });
                
                return menuItems;
              })()}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Description"
            name="description"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={handleChange}
            variant="outlined"
          />
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

export default Areas;
