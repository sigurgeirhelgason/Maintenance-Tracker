import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  useTheme,
  Checkbox,
  FormControlLabel,
  Paper,
  IconButton,
  Divider,
  Snackbar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material';
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
];

const Properties = () => {
  const theme = useTheme();
  const [properties, setProperties] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success', // 'success', 'error', 'warning', 'info'
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    num_floors: 1,
    has_garden: false,
    image: null,
    floors: {}, // { 1: { 'Living room': 0, 'Bed room': 0, ... }, ... }
  });
  const [imageFile, setImageFile] = useState(null); // For new/updated images
  const [imagePreview, setImagePreview] = useState(null); // For preview
  const [roomNames, setRoomNames] = useState({}); // { "floor-type-index": "Custom Name" }
  const [existingAreas, setExistingAreas] = useState([]); // Track existing area IDs for updates
  const [existingAreaMap, setExistingAreaMap] = useState({}); // { "floor-type-index": areaId }

  useEffect(() => {
    fetchProperties();
  }, []);

  const showNotification = (message, severity = 'success') => {
    setNotification({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification(prev => ({ ...prev, open: false }));
  };

  const openConfirmDialog = (title, message, onConfirm) => {
    setConfirmDialog({
      open: true,
      title,
      message,
      onConfirm,
    });
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

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/properties/');
      setProperties(response.data);
    } catch (error) {
      setError('Error fetching properties');
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeFloors = (numFloors) => {
    const floors = {};
    for (let i = 1; i <= numFloors; i++) {
      floors[i] = {};
      ROOM_TYPES.forEach(type => {
        floors[i][type] = 0;
      });
    }
    return floors;
  };

  const initializeGardenFloor = () => {
    // Floor 0 represents the garden
    return {
      0: {
        Garden: 1,  // One garden area by default
      },
    };
  };

  const handleGardenChange = (hasGarden) => {
    setFormData(prev => {
      const updatedFloors = { ...prev.floors };
      
      if (hasGarden) {
        // Add garden floor if not present
        if (!updatedFloors[0]) {
          updatedFloors[0] = { Garden: 1 };
        }
      } else {
        // Remove garden floor
        delete updatedFloors[0];
      }
      
      return {
        ...prev,
        has_garden: hasGarden,
        floors: updatedFloors,
      };
    });
  };

  const handleOpenDialog = (property = null) => {
    if (property) {
      setEditingProperty(property);
      setImagePreview(property.image || null);
      setImageFile(null);
      // Fetch areas for this property to reconstruct room counts
      fetchAreasAndPopulateFloors(property);
    } else {
      setEditingProperty(null);
      setImagePreview(null);
      setImageFile(null);
      setFormData({
        name: '',
        address: '',
        num_floors: 1,
        has_garden: false,
        image: null,
        floors: initializeFloors(1),
      });
      setRoomNames({});
      setExistingAreas([]);
      setExistingAreaMap({});
    }
    setOpenDialog(true);
  };

  const fetchAreasAndPopulateFloors = async (property) => {
    try {
      const response = await axios.get(`/api/areas/?property=${property.id}`);
      const areas = response.data;
      
      // Initialize floors with zeros
      const floors = initializeFloors(property.num_floors || 1);
      const customNames = {};
      const areaMap = {};
      
      // Populate floors with actual area counts and build area ID map
      // Sort areas by floor and type for consistent ordering
      const sortedAreas = [...areas].sort((a, b) => {
        const floorDiff = (a.floor ?? 1) - (b.floor ?? 1);
        return floorDiff !== 0 ? floorDiff : (a.type || '').localeCompare(b.type || '');
      });
      
      sortedAreas.forEach(area => {
        const floor = area.floor ?? 1;  // Use nullish coalescing to allow floor 0 for gardens
        const areaType = area.type || 'Living room';  // Use the type field from API
        const areaName = area.name;  // Custom name (if any)
        
        // Initialize floor 0 if it doesn't exist (for gardens)
        if (floor === 0 && !floors[0]) {
          floors[0] = { Garden: 0 };
        }
        
        // Count this room type on this floor
        const count = (floors[floor][areaType] || 0) + 1;
        floors[floor][areaType] = count;
        
        // Store the mapping and custom name
        const key = `${floor}-${areaType}-${count}`;
        customNames[key] = areaName;  // Store the custom name (can be null)
        areaMap[key] = area.id;
      });
      
      const finalFloors = { ...floors };
      // Only add empty garden floor if property has garden but we didn't load any gardens
      if (property.has_garden && !finalFloors[0]) {
        finalFloors[0] = { Garden: 1 };
      }
      
      setFormData({
        name: property.name,
        address: property.address,
        num_floors: property.num_floors || 1,
        has_garden: property.has_garden || false,
        image: property.image || null,
        floors: finalFloors,
      });
      setRoomNames(customNames);
      setExistingAreaMap(areaMap);
      setExistingAreas(areas);
    } catch (error) {
      console.error('Error fetching areas:', error);
      // Fallback to empty floors if there's an error
      const initialFloors = initializeFloors(property.num_floors || 1);
      if (property.has_garden) {
        initialFloors[0] = { Garden: 1 };
      }
      
      setFormData({
        name: property.name,
        address: property.address,
        num_floors: property.num_floors || 1,
        has_garden: property.has_garden || false,
        image: property.image || null,
        floors: initialFloors,
      });
      setRoomNames({});
      setExistingAreaMap({});
      setExistingAreas([]);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingProperty(null);
    setFormData({
      name: '',
      address: '',
      num_floors: 1,
      has_garden: false,
      image: null,
      floors: initializeFloors(1),
    });
    setImageFile(null);
    setImagePreview(null);
    setRoomNames({});
    setExistingAreas([]);
    setExistingAreaMap({});
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    if (name === 'num_floors') {
      const newFloors = parseInt(newValue) || 1;
      const updatedFloors = { ...formData.floors };

      // Add new floors if increased
      for (let i = 1; i <= newFloors; i++) {
        if (!updatedFloors[i]) {
          updatedFloors[i] = {};
          ROOM_TYPES.forEach(type => {
            updatedFloors[i][type] = 0;
          });
        }
      }

      // Remove old floors if decreased (but keep garden floor if it exists)
      for (let i = newFloors + 1; i <= Object.keys(updatedFloors).length; i++) {
        if (i !== 0) {  // Don't delete garden floor
          delete updatedFloors[i];
        }
      }

      setFormData(prev => ({
        ...prev,
        num_floors: newFloors,
        floors: updatedFloors,
      }));
    } else if (name === 'has_garden') {
      handleGardenChange(newValue);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: newValue,
      }));
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRoomCountChange = (floor, roomType, delta) => {
    setFormData(prev => {
      const updatedFloors = { ...prev.floors };
      updatedFloors[floor] = { ...updatedFloors[floor] };
      updatedFloors[floor][roomType] = Math.max(0, (updatedFloors[floor][roomType] || 0) + delta);
      return { ...prev, floors: updatedFloors };
    });
  };

  // Generate room list from current floor data
  const generateRoomList = () => {
    const rooms = [];
    
    // Add garden areas first (floor 0) if they exist
    if (formData.floors[0]) {
      const gardenCount = formData.floors[0].Garden || 0;
      for (let i = 1; i <= gardenCount; i++) {
        const key = `0-Garden-${i}`;
        rooms.push({
          key,
          floor: 0,
          type: 'Garden',
          index: i,
          defaultName: 'Garden',
          customName: roomNames[key] || 'Garden',
        });
      }
    }
    
    // Add regular floors (1+)
    for (let floor = 1; floor <= formData.num_floors; floor++) {
      const floorData = formData.floors[floor] || {};
      ROOM_TYPES.forEach(roomType => {
        const count = floorData[roomType] || 0;
        for (let i = 1; i <= count; i++) {
          const key = `${floor}-${roomType}-${i}`;
          rooms.push({
            key,
            floor,
            type: roomType,
            index: i,
            defaultName: `${roomType} ${i}`,
            customName: roomNames[key] || `${roomType} ${i}`,
          });
        }
      });
    }
    return rooms;
  };

  const handleRoomNameChange = (key, newName) => {
    setRoomNames(prev => ({
      ...prev,
      [key]: newName,
    }));
  };

  const generateRoomAreasWithKeys = () => {
    const rooms = [];
    
    // Add garden floor first (floor 0) if it exists
    if (formData.floors[0]) {
      const gardenCount = formData.floors[0].Garden || 0;
      for (let i = 1; i <= gardenCount; i++) {
        const key = `0-Garden-${i}`;
        const customName = roomNames[key];
        const defaultName = 'Garden';
        rooms.push({
          key,
          floor: 0,
          type: 'Garden',
          index: i,
          displayName: customName || defaultName,
          customName: customName && customName !== defaultName ? customName : null,
        });
      }
    }
    
    // Add standard room types
    for (let floor = 1; floor <= formData.num_floors; floor++) {
      const floorData = formData.floors[floor] || {};
      ROOM_TYPES.forEach(roomType => {
        const count = floorData[roomType] || 0;
        for (let i = 1; i <= count; i++) {
          const key = `${floor}-${roomType}-${i}`;
          const customName = roomNames[key];
          const defaultName = `${roomType} ${i}`;
          rooms.push({
            key,
            floor,
            type: roomType,
            index: i,
            // For display in the form
            displayName: customName || defaultName,
            // For API - only send custom name if different from default
            customName: customName && customName !== defaultName ? customName : null,
          });
        }
      });
    }
    
    // Add custom areas (those that don't match room types)
    Object.keys(roomNames).forEach(key => {
      if (key.startsWith('area-')) {
        const areaId = parseInt(key.split('-')[1]);
        const area = existingAreas.find(a => a.id === areaId);
        if (area) {
          rooms.push({
            key,
            floor: area.floor ?? 1,
            type: area.type,
            displayName: area.name || 'Unknown',
            customName: area.name,
          });
        }
      }
    });
    
    return rooms;
  };

  const generateRoomAreas = () => {
    const areas = [];
    
    // Add garden area first (floor 0) if it exists
    if (formData.floors[0]) {
      const gardenCount = formData.floors[0].Garden || 0;
      for (let i = 1; i <= gardenCount; i++) {
        const key = `0-Garden-${i}`;
        const customName = roomNames[key];
        const defaultName = 'Garden';
        areas.push({
          type: 'Garden',
          name: customName && customName !== defaultName ? customName : null,
          floor: 0,
        });
      }
    }
    
    // Add standard room types (floors 1+)
    for (let floor = 1; floor <= formData.num_floors; floor++) {
      const floorData = formData.floors[floor] || {};
      ROOM_TYPES.forEach(roomType => {
        const count = floorData[roomType] || 0;
        for (let i = 1; i <= count; i++) {
          const key = `${floor}-${roomType}-${i}`;
          const customName = roomNames[key];
          const defaultName = `${roomType} ${i}`;
          areas.push({
            type: roomType,
            // Only include custom name if it's different from the default
            name: customName && customName !== defaultName ? customName : null,
            floor: floor,
          });
        }
      });
    }
    return areas;
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      showNotification('Please fill in all required fields', 'warning');
      return;
    }

    try {
      // Use FormData if there's an image, otherwise use regular JSON
      let propertyData;
      let config = { headers: { 'Content-Type': 'application/json' } };

      if (imageFile) {
        propertyData = new FormData();
        propertyData.append('name', formData.name);
        propertyData.append('address', formData.address);
        propertyData.append('num_floors', formData.num_floors);
        propertyData.append('has_garden', formData.has_garden);
        propertyData.append('image', imageFile);
        config = {}; // Let axios set the correct Content-Type for FormData
      } else {
        propertyData = {
          name: formData.name,
          address: formData.address,
          num_floors: formData.num_floors,
          has_garden: formData.has_garden,
        };
      }

      let propertyId;
      if (editingProperty) {
        await axios.put(`/api/properties/${editingProperty.id}/`, propertyData, config);
        propertyId = editingProperty.id;
        showNotification('Property updated successfully!', 'success');
      } else {
        const response = await axios.post('/api/properties/', propertyData, config);
        propertyId = response.data.id;
        showNotification('Property created successfully!', 'success');
      }

      // Generate new areas from current form data
      const newRooms = editingProperty ? generateRoomAreasWithKeys() : generateRoomAreas();

      if (editingProperty) {
        // Smart update using area ID mapping
        const usedExistingIds = new Set();
        
        // For each new room, either update existing or create new
        for (const room of newRooms) {
          let existingAreaId = existingAreaMap[room.key];
          
          // For custom areas, the area ID is encoded in the key
          if (!existingAreaId && room.key.startsWith('area-')) {
            existingAreaId = parseInt(room.key.split('-')[1]);
          }
          
          if (existingAreaId) {
            // Update existing area
            usedExistingIds.add(existingAreaId);
            console.log(`Updating area ${existingAreaId}: type="${room.type}", name="${room.customName}", floor ${room.floor}`);
            await axios.put(`/api/areas/${existingAreaId}/`, {
              type: room.type,
              name: room.customName,
              floor: parseInt(room.floor, 10),
              description: '',
            });
          } else {
            // Create new area
            console.log(`Creating new area: type="${room.type}", name="${room.customName}", floor ${room.floor}`);
            await axios.post('/api/areas/', {
              property: propertyId,
              type: room.type,
              name: room.customName,
              floor: parseInt(room.floor, 10),
              description: '',
            });
          }
        }
        
        // Delete any existing areas that weren't used
        for (const area of existingAreas) {
          if (!usedExistingIds.has(area.id)) {
            try {
              console.log(`Deleting unused area ${area.id}: "${area.name}"`);
              await axios.delete(`/api/areas/${area.id}/`);
            } catch (error) {
              console.error('Error deleting area:', error);
            }
          }
        }
      } else {
        // New property: create all areas
        for (const area of newRooms) {
          await axios.post('/api/areas/', {
            property: propertyId,
            type: area.type,
            name: area.name,
            floor: parseInt(area.floor, 10),
            description: '',
          });
        }
      }

      fetchProperties();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving property:', error);
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || error.message || 'Error saving property. Please try again.';
      showNotification(`Error: ${errorMessage}`, 'error');
    }
  };

  const handleDelete = async (id) => {
    openConfirmDialog(
      'Delete Property',
      'Are you sure you want to delete this property? This action cannot be undone.',
      async () => {
        try {
          await axios.delete(`/api/properties/${id}/`);
          showNotification('Property deleted successfully', 'success');
          fetchProperties();
        } catch (error) {
          console.error('Error deleting property:', error);
          showNotification('Error deleting property', 'error');
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
          title="Properties"
          subtitle="Define your properties and create rooms per floor"
          breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Properties' }]}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          sx={{ mt: 1 }}
        >
          Add Property
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {properties.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="textSecondary" gutterBottom>
              No properties yet. Create one to get started.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ mt: 2 }}
            >
              Add Property
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {properties.map(property => {
            const totalRooms = property.areas?.length || 0;
            const openTasks = property.tasks?.filter(task => task.status !== 'finished')?.length || 0;
            
            return (
            <Grid item xs={12} sm={12} md={12} lg={6} key={property.id}>
              <Card 
                onClick={() => handleOpenDialog(property)}
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e0e0e0',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }
                }}
              >
                {/* Main Content Area: Text Left, Image Right with Gradient */}
                <Box
                  sx={{
                    height: 250,
                    display: 'flex',
                    position: 'relative',
                  }}
                >
                  {/* Left Side: Property Info */}
                  <Box
                    sx={{
                      flex: '1 1 40%',
                      padding: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        fontWeight: 800, 
                        color: '#1a1a1a', 
                        mb: 1, 
                        fontSize: '2rem',
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {property.name}
                    </Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        color: '#666', 
                        fontWeight: 400,
                        fontSize: '1.1rem', 
                        mb: 3 
                      }}
                    >
                      {property.address}
                    </Typography>
                    
                    {/* Inline Stats on the left */}
                    <Box sx={{ display: 'flex', gap: 4 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>Unfinished</Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                          {openTasks}
                        </Typography>
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#333' }}>Total Tasks</Typography>
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                          {property.tasks?.length || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Right Side: Image with White Gradient Overlay */}
                  <Box
                    sx={{
                      flex: '1 1 60%',
                      position: 'relative',
                      backgroundImage: property.image ? `url(${property.image})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  >
                    {/* White Gradient Overlay - fades from solid white to transparent */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(to right, #ffffff 0%, rgba(255, 255, 255, 0.95) 10%, rgba(255, 255, 255, 0.4) 40%, rgba(255, 255, 255, 0) 100%)',
                        zIndex: 1,
                      }}
                    />
                  </Box>
                </Box>

                {/* Card Footer: Badge-style stats at the bottom */}
                <Box 
                  sx={{ 
                    display: 'flex', 
                    gap: 2,
                    p: 2, 
                    backgroundColor: '#f9fafb',
                    borderTop: '1px solid #f0f0f0'
                  }}
                >
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      backgroundColor: '#fff',
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 10,
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#4b5563' }}>
                      {property.num_floors || 1} Floor{(property.num_floors || 1) !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      backgroundColor: '#fff',
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 10,
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#6366f1' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#4b5563' }}>
                      {totalRooms} {totalRooms === 1 ? 'Room' : 'Rooms'}
                    </Typography>
                  </Box>

                  <Box 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1, 
                      backgroundColor: '#fff',
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 10,
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: property.has_garden ? '#10b981' : '#d1d5db' }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#4b5563' }}>
                      Garden: {property.has_garden ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            </Grid>
          );
          })}
        </Grid>
      )}

      {/* Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingProperty ? 'Edit Property' : 'New Property'}
        </DialogTitle>
        <DialogContent sx={{ pt: 3, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
          {/* Basic Info */}
          <TextField
            autoFocus
            margin="dense"
            label="Property Name"
            name="name"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Address"
            name="address"
            fullWidth
            value={formData.address}
            onChange={handleInputChange}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          
          {/* Image Upload */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Property Image
            </Typography>
            {imagePreview && (
              <Box
                sx={{
                  mb: 2,
                  width: '100%',
                  maxHeight: 200,
                  borderRadius: 1,
                  overflow: 'hidden',
                  backgroundColor: '#f5f5f5',
                }}
              >
                <img
                  src={imagePreview}
                  alt="Property preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </Box>
            )}
            <input
              accept="image/*"
              type="file"
              onChange={handleImageChange}
              style={{ marginBottom: 8 }}
            />
            <Typography variant="caption" sx={{ color: 'textSecondary', display: 'block' }}>
              Upload a property image (JPG, PNG, etc.)
            </Typography>
          </Box>

          <TextField
            margin="dense"
            label="Number of Floors"
            name="num_floors"
            type="number"
            fullWidth
            value={formData.num_floors}
            onChange={handleInputChange}
            variant="outlined"
            inputProps={{ min: 1, max: 10 }}
            sx={{ mb: 2 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.has_garden}
                onChange={handleInputChange}
                name="has_garden"
              />
            }
            label="Has Garden"
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3 }} />

          {/* Room Counters by Floor */}
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Add Rooms per Floor
          </Typography>

          {/* Garden Section */}
          {formData.has_garden && (
            <Paper sx={{ p: 2.5, mb: 2.5, backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, color: '#2e7d32' }}>
                🌿 Garden:
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      backgroundColor: 'white',
                      borderRadius: 1,
                      border: '1px solid #81c784',
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Garden
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton
                        size="small"
                        onClick={() => handleRoomCountChange(0, 'Garden', -1)}
                        disabled={(formData.floors[0]?.Garden || 0) === 0}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>
                        {formData.floors[0]?.Garden || 0}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => handleRoomCountChange(0, 'Garden', 1)}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}

          {Array.from({ length: formData.num_floors }, (_, i) => i + 1).map(floor => (
            <Paper key={floor} sx={{ p: 2.5, mb: 2.5, backgroundColor: '#f5f5f5' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                Floor {floor}:
              </Typography>
              <Grid container spacing={2}>
                {ROOM_TYPES.map(roomType => (
                  <Grid item xs={12} sm={6} key={roomType}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        backgroundColor: 'white',
                        borderRadius: 1,
                        border: '1px solid #e0e0e0',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 100 }}>
                        {roomType}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleRoomCountChange(floor, roomType, -1)}
                          disabled={(formData.floors[floor]?.[roomType] || 0) === 0}
                          sx={{
                            backgroundColor: '#e3f2fd',
                            '&:hover': { backgroundColor: '#bbdefb' },
                            width: 32,
                            height: 32,
                          }}
                        >
                          <RemoveIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Typography
                          sx={{
                            fontWeight: 600,
                            fontSize: '1rem',
                            minWidth: 30,
                            textAlign: 'center',
                          }}
                        >
                          {formData.floors[floor]?.[roomType] || 0}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleRoomCountChange(floor, roomType, 1)}
                          sx={{
                            backgroundColor: '#81c784',
                            color: 'white',
                            '&:hover': { backgroundColor: '#66bb6a' },
                            width: 32,
                            height: 32,
                          }}
                        >
                          <AddIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          ))}

          {/* Custom Room Names Section */}
          {(generateRoomList().length > 0 || Object.keys(roomNames).length > 0) && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Customize Room Names
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Give your rooms custom names for easier identification. Leave blank to use default names.
              </Typography>
              
              {/* Garden Section in Custom Names */}
              {formData.has_garden && (formData.floors[0]?.Garden || 0) > 0 && (
                <Paper sx={{ p: 2.5, mb: 2.5, backgroundColor: '#e8f5e9', border: '2px solid #4caf50' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#2e7d32' }}>
                    🌿 Garden
                  </Typography>
                  <Grid container spacing={2}>
                    {Array.from({ length: formData.floors[0]?.Garden || 0 }, (_, i) => {
                      const key = `0-Garden-${i + 1}`;
                      return (
                        <Grid item xs={12} key={key}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                pt: 2, 
                                minWidth: 80, 
                                fontWeight: 500,
                                color: 'textSecondary'
                              }}
                            >
                              Garden {i + 1}
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder="e.g., Front Garden, Backyard"
                              value={roomNames[key] && roomNames[key] !== 'Garden' ? roomNames[key] : ''}
                              onChange={(e) => handleRoomNameChange(key, e.target.value || 'Garden')}
                              variant="outlined"
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  fontSize: '0.875rem',
                                }
                              }}
                            />
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
              )}
              
              {/* Group by floor */}
              {Array.from({ length: formData.num_floors }, (_, i) => i + 1).map(floor => {
                const floorRooms = generateRoomList().filter(room => room.floor === floor);
                // Also include custom areas stored for this floor
                const customAreaKeys = Object.keys(roomNames).filter(key => {
                  if (key.startsWith('area-')) {
                    const areaId = parseInt(key.split('-')[1]);
                    const area = existingAreas.find(a => a.id === areaId);
                    return area && (area.floor ?? 1) === floor;
                  }
                  return false;
                });
                const customAreas = customAreaKeys.map(key => {
                  const areaId = parseInt(key.split('-')[1]);
                  const area = existingAreas.find(a => a.id === areaId);
                  return {
                    key,
                    floor,
                    defaultName: area?.name || 'Unknown',
                    customName: roomNames[key] || area?.name || 'Unknown',
                  };
                });
                
                const allRooms = [...floorRooms, ...customAreas];
                
                return allRooms.length > 0 ? (
                  <Paper key={floor} sx={{ p: 2.5, mb: 2.5, backgroundColor: '#fafafa', border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: '#666' }}>
                      Floor {floor}
                    </Typography>
                    <Grid container spacing={2}>
                      {allRooms.map(room => (
                        <Grid item xs={12} key={room.key}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                pt: 2, 
                                minWidth: 120, 
                                fontWeight: 500,
                                color: 'textSecondary'
                              }}
                            >
                              {room.defaultName}
                            </Typography>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder={`e.g., ${room.defaultName}`}
                              value={room.customName === room.defaultName ? '' : room.customName}
                              onChange={(e) => handleRoomNameChange(room.key, e.target.value || room.defaultName)}
                              variant="outlined"
                              sx={{
                                '& .MuiOutlinedInput-root': {
                                  fontSize: '0.875rem',
                                }
                              }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                ) : null;
              })}
            </>
          )}
        </DialogContent>
        <DialogActions>
          {editingProperty && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => handleDelete(editingProperty.id)}
            >
              Delete
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingProperty ? 'Update' : 'Create'}
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

export default Properties;