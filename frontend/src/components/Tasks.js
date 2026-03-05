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
  Chip,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Paper,
  Snackbar,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Download as DownloadIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';

const Tasks = () => {
  const [properties, setProperties] = useState([]);
  const [areas, setAreas] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  const [selectedProperty, setSelectedProperty] = useState(null);
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
    description: '',
    task_type: '',
    vendor: null,
    status: 'pending',
    estimated_price: '',
    final_price: '',
    currency: 'USD',
    areas: [],
    notes: '',
  });

  const [fileToUpload, setFileToUpload] = useState(null);

  useEffect(() => {
    fetchInitialData();
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

  useEffect(() => {
    if (selectedProperty) {
      fetchAreasForProperty(selectedProperty);
      fetchTasksForProperty(selectedProperty);
    }
  }, [selectedProperty]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [propsRes, typesRes, vendorsRes] = await Promise.all([
        axios.get('/api/properties/'),
        axios.get('/api/tasktypes/'),
        axios.get('/api/vendors/'),
      ]);
      setProperties(propsRes.data);
      setTaskTypes(typesRes.data);
      setVendors(vendorsRes.data);
      if (propsRes.data.length > 0 && !selectedProperty) {
        setSelectedProperty(propsRes.data[0].id);
      }
    } catch (err) {
      setError('Error fetching data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAreasForProperty = async (propertyId) => {
    try {
      const response = await axios.get(`/api/areas/?property=${propertyId}`);
      setAreas(response.data);
    } catch (err) {
      console.error('Error fetching areas:', err);
    }
  };

  const fetchTasksForProperty = async (propertyId) => {
    try {
      const response = await axios.get(`/api/tasks/?property=${propertyId}`);
      setTasks(response.data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Error fetching tasks');
    }
  };

  const handlePropertyChange = (e) => {
    setSelectedProperty(e.target.value);
  };

  const handleOpen = (task = null) => {
    if (task) {
      setEditing(task);
      setFormData(task);
    } else {
      setEditing(null);
      setFormData({
        description: '',
        task_type: '',
        vendor: null,
        status: 'pending',
        estimated_price: '',
        final_price: '',
        currency: 'USD',
        areas: [],
        notes: '',
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
    setFileToUpload(null);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleAreaToggle = (areaId) => {
    setFormData(prev => {
      const areas = prev.areas || [];
      if (areas.includes(areaId)) {
        return { ...prev, areas: areas.filter(a => a !== areaId) };
      } else {
        return { ...prev, areas: [...areas, areaId] };
      }
    });
  };

  const handleSave = async () => {
    if (!formData.description.trim()) {
      showNotification('Task description is required', 'warning');
      return;
    }

    try {
      const submitData = {
        ...formData,
        property: selectedProperty,
        estimated_price: formData.estimated_price ? parseFloat(formData.estimated_price) : null,
        final_price: formData.final_price ? parseFloat(formData.final_price) : null,
      };

      let taskId;
      if (editing) {
        await axios.put(`/api/tasks/${editing.id}/`, submitData);
        taskId = editing.id;
      } else {
        const response = await axios.post('/api/tasks/', submitData);
        taskId = response.data.id;
      }

      // Upload file if present
      if (fileToUpload) {
        const attachmentFormData = new FormData();
        attachmentFormData.append('file', fileToUpload);
        attachmentFormData.append('task', taskId);
        try {
          await axios.post('/api/attachments/', attachmentFormData);
        } catch (err) {
          console.error('Error uploading attachment:', err);
        }
      }

      fetchTasksForProperty(selectedProperty);
      handleClose();
    } catch (err) {
      console.error('Error saving task:', err);
      setError('Error saving task');
    }
  };

  const handleDelete = async (id) => {
    openConfirmDialog(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      async () => {
        try {
          await axios.delete(`/api/tasks/${id}/`);
          showNotification('Task deleted successfully', 'success');
          fetchTasksForProperty(selectedProperty);
        } catch (err) {
          console.error('Error deleting:', err);
          showNotification('Error deleting task', 'error');
        }
      }
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'in_progress':
        return 'info';
      case 'finished':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_progress':
        return 'In Progress';
      case 'finished':
        return 'Finished';
      default:
        return status;
    }
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
        title="Maintenance Tasks"
        subtitle="Create and manage maintenance tasks"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Tasks' }]}
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
          {/* Property Selector */}
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
              New Task
            </Button>
          </Box>

          {/* Property Info */}
          {currentProperty && (
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
          )}

          {/* Tasks Grid */}
          {tasks.length === 0 ? (
            <Card>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  No tasks yet. Add one to get started.
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
                  New Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={3}>
              {tasks.map(task => (
                <Grid item xs={12} sm={6} md={4} key={task.id}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', opacity: task.status === 'finished' ? 0.8 : 1 }}>
                    <CardContent sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1, textDecoration: task.status === 'finished' ? 'line-through' : 'none' }}>
                          {task.description}
                        </Typography>
                        {task.status === 'finished' && <CheckIcon sx={{ color: 'success.main', ml: 1 }} />}
                      </Box>
                      
                      <Chip
                        label={getStatusLabel(task.status)}
                        color={getStatusColor(task.status)}
                        size="small"
                        sx={{ mb: 2 }}
                      />

                      {task.task_type && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                          <strong>Type:</strong> {task.task_type.name}
                        </Typography>
                      )}

                      {task.areas && task.areas.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 0.5 }}>
                            <strong>Areas:</strong>
                          </Typography>
                          {task.areas.map(areaId => {
                            const area = areas.find(a => a.id === areaId);
                            return area ? <Chip key={areaId} label={area.name} size="small" variant="outlined" sx={{ mr: 0.5 }} /> : null;
                          })}
                        </Box>
                      )}

                      {task.vendor && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                          <strong>Vendor:</strong> {task.vendor.name}
                        </Typography>
                      )}

                      {task.estimated_price && (
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                          <strong>Est. Price:</strong> {task.currency} {task.estimated_price}
                        </Typography>
                      )}

                      {task.final_price && (
                        <Typography variant="caption" color="success.main" sx={{ display: 'block', fontWeight: 600, mb: 1 }}>
                          <strong>Final Price:</strong> {task.currency} {task.final_price}
                        </Typography>
                      )}

                      {task.attachments && task.attachments.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          {task.attachments.map(attachment => (
                            <Button
                              key={attachment.id}
                              size="small"
                              startIcon={<DownloadIcon />}
                              href={attachment.file}
                              download
                              fullWidth
                            >
                              Download PDF
                            </Button>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                    
                    <CardActions sx={{ pt: 0 }}>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpen(task)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(task.id)}>
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Task' : 'New Task'}</DialogTitle>
        <DialogContent sx={{ pt: 3, maxHeight: 'calc(100vh - 160px)', overflow: 'auto' }}>
          <TextField
            autoFocus
            margin="dense"
            label="Task Description"
            name="description"
            fullWidth
            multiline
            rows={2}
            value={formData.description}
            onChange={handleChange}
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Task Type</InputLabel>
            <Select
              name="task_type"
              value={formData.task_type || ''}
              onChange={handleChange}
              label="Task Type"
            >
              {taskTypes.map(type => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name} ({type.category})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Areas Selection */}
          <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Select Areas
            </Typography>
            <FormGroup>
              {areas.map(area => (
                <FormControlLabel
                  key={area.id}
                  control={
                    <Checkbox
                      checked={(formData.areas || []).includes(area.id)}
                      onChange={() => handleAreaToggle(area.id)}
                    />
                  }
                  label={area.name}
                />
              ))}
            </FormGroup>
          </Paper>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Vendor (Optional)</InputLabel>
            <Select
              name="vendor"
              value={formData.vendor || ''}
              onChange={handleChange}
              label="Vendor"
            >
              <MenuItem value="">None</MenuItem>
              {vendors.map(vendor => (
                <MenuItem key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Status</InputLabel>
            <Select
              name="status"
              value={formData.status}
              onChange={handleChange}
              label="Status"
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="finished">Finished</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <TextField
              margin="dense"
              label="Estimated Price"
              name="estimated_price"
              type="number"
              value={formData.estimated_price}
              onChange={handleChange}
              variant="outlined"
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              margin="dense"
              label="Final Price"
              name="final_price"
              type="number"
              value={formData.final_price}
              onChange={handleChange}
              variant="outlined"
              inputProps={{ step: '0.01', min: '0' }}
            />
          </Box>

          <TextField
            margin="dense"
            label="Currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            variant="outlined"
            fullWidth
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Notes"
            name="notes"
            fullWidth
            multiline
            rows={2}
            value={formData.notes}
            onChange={handleChange}
            variant="outlined"
            sx={{ mb: 2 }}
          />

          {/* File Upload for PDFs */}
          {formData.status === 'finished' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Attach PDF (Vendor Invoice/Report)
              </Typography>
              <TextField
                type="file"
                inputProps={{ accept: '.pdf' }}
                onChange={(e) => setFileToUpload(e.target.files[0])}
                fullWidth
                variant="outlined"
              />
            </Box>
          )}
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

export default Tasks;