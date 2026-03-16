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
  Typography,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Add as AddIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import DetailPanel from './shared/DetailPanel';
import DetailField from './shared/DetailField';
import ConfirmDialog from './shared/ConfirmDialog';
import NotificationSnackbar from './shared/NotificationSnackbar';
import { useNotification, useConfirmDialog } from './shared/hooks';

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
  'Hallway',
  'Other'
];

const Areas = () => {
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [areas, setAreas] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedArea, setSelectedArea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('type');
  const [sortDirection, setSortDirection] = useState('asc');
  const { notification, showNotification, handleCloseNotification } = useNotification();
  const { confirmDialog, openConfirmDialog, handleConfirmDialogClose, handleConfirmDialogConfirm } = useConfirmDialog();
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

  const handleSortClick = (field) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
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
      setSelectedArea(null);
    } catch (err) {
      console.error('Error fetching areas:', err);
      setError('Error fetching areas');
    }
  };

  const areasByFloor = useMemo(() => {
    const grouped = {};
    (areas || []).forEach(area => {
      const floor = area.floor ?? 1;
      if (!grouped[floor]) grouped[floor] = [];
      grouped[floor].push(area);
    });
    // sort areas within each floor based on sortBy and sortDirection
    Object.keys(grouped).forEach(f => {
      grouped[f].sort((a, b) => {
        let aValue = '';
        let bValue = '';

        switch (sortBy) {
          case 'type':
            aValue = a.type || '';
            bValue = b.type || '';
            break;
          case 'name':
            aValue = a.name || '';
            bValue = b.name || '';
            break;
          case 'floor':
            aValue = a.floor ?? 1;
            bValue = b.floor ?? 1;
            break;
          case 'description':
            aValue = a.description || '';
            bValue = b.description || '';
            break;
          default:
            aValue = a.name || a.type || '';
            bValue = b.name || b.type || '';
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
          const comparison = aValue.localeCompare(bValue);
          return sortDirection === 'asc' ? comparison : -comparison;
        } else {
          const comparison = aValue - bValue;
          return sortDirection === 'asc' ? comparison : -comparison;
        }
      });
    });
    return grouped;
  }, [areas, sortBy, sortDirection]);

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

          {/* Areas Table with Detail Panel */}
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TableContainer component={Paper} sx={{ flex: 1 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F5F5F5' }}>
                    <TableRow>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 180, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('type')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Type
                          {sortBy === 'type' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 160, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('name')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Name
                          {sortBy === 'name' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 80, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('floor')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Floor
                          {sortBy === 'floor' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('description')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Description
                          {sortBy === 'description' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.keys(areasByFloor)
                      .map(k => parseInt(k, 10))
                      .sort((a, b) => a - b)
                      .map(floor => (
                        <React.Fragment key={`floor-${floor}`}>
                          <TableRow sx={{ backgroundColor: '#fafafa' }}>
                            <TableCell colSpan={4} sx={{ fontWeight: 700, py: 1 }}>
                              {floor === 0 ? '🌿 Garden' : `Floor ${floor}`}
                            </TableCell>
                          </TableRow>
                          {areasByFloor[floor].map(area => (
                            <TableRow
                              key={area.id}
                              onClick={() => setSelectedArea(area)}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: selectedArea?.id === area.id ? '#E3F2FD' : 'transparent',
                                '&:hover': { bgcolor: '#F5F5F5' },
                              }}
                            >
                              <TableCell sx={{ fontWeight: 600 }}>{area.type}</TableCell>
                              <TableCell sx={{ fontSize: '0.95rem' }}>{area.name || '-'}</TableCell>
                              <TableCell sx={{ fontSize: '0.9rem' }}>{area.floor === 0 ? 'Garden' : area.floor}</TableCell>
                              <TableCell sx={{ fontSize: '0.9rem', color: '#666' }}>{area.description || '-'}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={4} sx={{ height: 8, borderBottom: 'none' }} />
                          </TableRow>
                        </React.Fragment>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Area Detail Panel */}
              {selectedArea && (
                <DetailPanel
                  title="Area Details"
                  onClose={() => setSelectedArea(null)}
                  onEdit={() => { handleOpen(selectedArea); setSelectedArea(null); }}
                  onDelete={() => { handleDelete(selectedArea.id); setSelectedArea(null); }}
                >
                  <DetailField label="TYPE" value={selectedArea.type} />
                  {selectedArea.name && (
                    <DetailField label="NAME" value={selectedArea.name} />
                  )}
                  <DetailField
                    label="FLOOR"
                    value={selectedArea.floor === 0 ? 'Garden' : `Floor ${selectedArea.floor}`}
                  />
                  {selectedArea.description && (
                    <DetailField label="DESCRIPTION" value={selectedArea.description} />
                  )}
                </DetailPanel>
              )}
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
      <NotificationSnackbar
        open={notification.open}
        message={notification.message}
        severity={notification.severity}
        onClose={handleCloseNotification}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onClose={handleConfirmDialogClose}
        onConfirm={handleConfirmDialogConfirm}
      />
    </Box>
  );
};

export default Areas;
