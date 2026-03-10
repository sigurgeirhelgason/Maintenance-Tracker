import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';

const TaskTypes = () => {
  const [taskTypes, setTaskTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  const [formData, setFormData] = useState({
    name: '',
    is_predefined: false,
    custom_field_definitions: [],
  });
  const [editingId, setEditingId] = useState(null);
  const [newFieldName, setNewFieldName] = useState('');

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  const fetchTaskTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tasktypes/');
      setTaskTypes(response.data);
    } catch (err) {
      setError('Error fetching task types');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddFieldDef = () => {
    if (newFieldName.trim()) {
      setFormData(prev => ({
        ...prev,
        custom_field_definitions: [...prev.custom_field_definitions, newFieldName.trim()]
      }));
      setNewFieldName('');
    }
  };

  const handleRemoveFieldDef = (index) => {
    setFormData(prev => ({
      ...prev,
      custom_field_definitions: prev.custom_field_definitions.filter((_, i) => i !== index)
    }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingId) {
        await axios.put(`/api/tasktypes/${editingId}/`, formData);
        setNotification({ open: true, message: 'Task type updated successfully', severity: 'success' });
      } else {
        await axios.post('/api/tasktypes/', formData);
        setNotification({ open: true, message: 'Task type added successfully', severity: 'success' });
      }
      handleCancel();
      fetchTaskTypes();
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: `Error ${editingId ? 'updating' : 'adding'} task type`, severity: 'error' });
    }
  };

  const handleEdit = (type) => {
    setEditingId(type.id);
    setFormData({
      name: type.name,
      is_predefined: type.is_predefined,
      custom_field_definitions: type.custom_field_definitions || [],
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ name: '', is_predefined: false, custom_field_definitions: [] });
    setNewFieldName('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task type?')) return;
    try {
      await axios.delete(`/api/tasktypes/${id}/`);
      fetchTaskTypes();
      setNotification({ open: true, message: 'Task type deleted', severity: 'success' });
    } catch (err) {
      console.error(err);
      setNotification({ open: true, message: 'Error deleting task type', severity: 'error' });
    }
  };

  return (
    <Box>
      <PageHeader
        title="Task Types"
        subtitle="Manage categories for maintenance tasks"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Task Types' }]}
      />

      <Grid container spacing={3}>
        {/* Add New Task Type */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {editingId ? 'Edit Task Type' : 'Add New Task Type'}
              </Typography>
              <form onSubmit={handleAdd}>
                <TextField
                  fullWidth
                  label="Name (e.g. Painting, Roof Cleaning)"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  sx={{ mb: 2 }}
                />
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                    Custom Fields
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      size="small"
                      placeholder="e.g. Color, Brand, Material"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      fullWidth
                    />
                    <Button 
                      variant="outlined" 
                      onClick={handleAddFieldDef}
                      disabled={!newFieldName.trim()}
                    >
                      Add
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {formData.custom_field_definitions.map((field, idx) => (
                      <Chip
                        key={idx}
                        label={field}
                        onDelete={() => handleRemoveFieldDef(idx)}
                        size="small"
                      />
                    ))}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  {editingId && (
                    <Button
                      variant="outlined"
                      fullWidth
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    startIcon={editingId ? null : <AddIcon />}
                    disabled={!formData.name.trim()}
                  >
                    {editingId ? 'Update' : 'Create'}
                  </Button>
                </Box>
              </form>
            </CardContent>
          </Card>
        </Grid>

        {/* List Task Types */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Existing Task Types</Typography>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              <List>
                {taskTypes.map((type, index) => (
                  <React.Fragment key={index}>
                    <ListItem 
                      disablePadding
                      sx={{ 
                        borderRadius: 1,
                        '&:hover': { backgroundColor: 'action.hover' },
                        cursor: 'pointer'
                      }}
                      onClick={() => handleEdit(type)}
                    >
                      <ListItemButton sx={{ borderRadius: 1 }}>
                        <ListItemText
                          primary={type.name}
                          secondary={type.is_predefined ? 'System Default' : 'User Created'}
                        />
                        {type.custom_field_definitions?.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, ml: 2 }}>
                            {type.custom_field_definitions.map((field, idx) => (
                              <Chip key={idx} label={field} size="small" variant="outlined" />
                            ))}
                          </Box>
                        )}
                        {!type.is_predefined && (
                          <ListItemSecondaryAction>
                            <IconButton 
                              edge="end" 
                              color="error" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(type.id);
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        )}
                      </ListItemButton>
                    </ListItem>
                    {index < taskTypes.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
                {taskTypes.length === 0 && !loading && (
                  <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                    No task types found.
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert severity={notification.severity} variant="filled">
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TaskTypes;
