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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
} from '@mui/material';
import { Add as AddIcon, Download as DownloadIcon, Search as SearchIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import DetailPanel from './shared/DetailPanel';
import DetailField from './shared/DetailField';
import ConfirmDialog from './shared/ConfirmDialog';
import NotificationSnackbar from './shared/NotificationSnackbar';
import { useNotification, useConfirmDialog } from './shared/hooks';

const Tasks = () => {
  const [properties, setProperties] = useState([]);
  const [areas, setAreas] = useState([]);
  const [taskTypes, setTaskTypes] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filters, setFilters] = useState({
    status: null,
    priority: null,
    property: null,
  });
  const { notification, showNotification, handleCloseNotification } = useNotification();
  const { confirmDialog, openConfirmDialog, handleConfirmDialogClose, handleConfirmDialogConfirm } = useConfirmDialog();
  
  const [formData, setFormData] = useState({
    description: '',
    task_type: '',
    vendor: null,
    status: 'pending',
    priority: 'medium',
    due_date: '',
    estimated_price: '',
    final_price: '',
    areas: [],
    notes: '',
    custom_field_values: {},
  });

  const [fileToUpload, setFileToUpload] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      fetchAreasForProperty(selectedProperty);
      fetchTasksForProperty(selectedProperty);
    }
  }, [selectedProperty]);

  const getTaskStatistics = useMemo(() => {
    const today = new Date();
    const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getFullYear(), today.getMonth(), 1);

    return {
      open: tasks.filter(t => t.status === 'pending').length,
      overdue: tasks.filter(t => {
        if (!t.due_date || t.status === 'finished') return false;
        return new Date(t.due_date) < today;
      }).length,
      scheduledThisWeek: tasks.filter(t => {
        if (!t.due_date || t.status === 'finished') return false;
        const dueDate = new Date(t.due_date);
        return dueDate >= today && dueDate <= weekFromNow;
      }).length,
      completedThisMonth: tasks.filter(t => {
        if (t.status !== 'finished' || !t.completed_date) return false;
        const completed = new Date(t.completed_date);
        return completed >= monthAgo && completed <= today;
      }).length,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      const matchesSearch = task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (task.vendor?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      const matchesProperty = !filters.property || task.property === filters.property;

      return matchesSearch && matchesStatus && matchesPriority && matchesProperty;
    });

    // Sort based on sortBy
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'due_date':
          if (!a.due_date && !b.due_date) comparison = 0;
          else if (!a.due_date) comparison = 1;
          else if (!b.due_date) comparison = -1;
          else comparison = new Date(a.due_date) - new Date(b.due_date);
          break;
        case 'status':
          const statusOrder = { pending: 0, in_progress: 1, finished: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'cost':
          const costA = a.final_price || a.estimated_price || 0;
          const costB = b.final_price || b.estimated_price || 0;
          comparison = costB - costA;
          break;
        case 'room':
          const roomA = a.areas?.[0] || 0;
          const roomB = b.areas?.[0] || 0;
          comparison = roomA - roomB;
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tasks, searchTerm, filters, sortBy, sortDirection]);



  useEffect(() => {
    if (selectedProperty) {
      fetchAreasForProperty(selectedProperty);
      fetchTasksForProperty(selectedProperty);
    }
  }, [selectedProperty]);

  const handleSortClick = (newSort) => {
    if (sortBy === newSort) {
      // Toggle direction if clicking the same button
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Reset to descending when switching sort option
      setSortBy(newSort);
      setSortDirection('desc');
    }
  };

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
      setSelectedTask(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError('Error fetching tasks');
    }
  };

  const handlePropertyChange = (e) => {
    const newPropertyId = e.target.value;
    setSelectedProperty(newPropertyId);
    setFilters(prev => ({ ...prev, property: null }));
  };

  const handleOpen = (task = null) => {
    if (task) {
      setEditing(task);
      setFormData({
        ...task,
        custom_field_values: task.custom_field_values || {},
      });
    } else {
      setEditing(null);
      setFormData({
        description: '',
        task_type: '',
        vendor: null,
        status: 'pending',
        priority: 'medium',
        due_date: '',
        estimated_price: '',
        final_price: '',
        areas: [],
        notes: '',
        custom_field_values: {},
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
        task_type: formData.task_type?.id || formData.task_type || null,
        vendor: formData.vendor?.id || formData.vendor || null,
        due_date: formData.due_date || null,
        estimated_price: formData.estimated_price ? parseFloat(formData.estimated_price) : null,
        final_price: formData.final_price ? parseFloat(formData.final_price) : null,
      };

      let taskId;
      if (editing) {
        await axios.put(`/api/tasks/${editing.id}/`, submitData);
        taskId = editing.id;
        showNotification('Task updated successfully', 'success');
      } else {
        const response = await axios.post('/api/tasks/', submitData);
        taskId = response.data.id;
        showNotification('Task created successfully', 'success');
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
      showNotification('Error saving task', 'error');
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
        return '#FFA726';
      case 'in_progress':
        return '#42A5F5';
      case 'finished':
        return '#66BB6A';
      default:
        return '#BDBDBD';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#EF5350';
      case 'medium':
        return '#FFA726';
      case 'low':
        return '#66BB6A';
      default:
        return '#BDBDBD';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Open';
      case 'in_progress':
        return 'In Progress';
      case 'finished':
        return 'Completed';
      default:
        return status;
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Medium';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = (dueDate, status) => {
    if (!dueDate || status === 'finished') return false;
    return new Date(dueDate) < new Date();
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
        title="Tasks"
        subtitle="Manage maintenance tasks across properties"
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
          <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 250 }}>
              <InputLabel>Properties</InputLabel>
              <Select
                value={selectedProperty || ''}
                onChange={handlePropertyChange}
                label="Properties"
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
              sx={{ mt: 1 }}
            >
              New Task
            </Button>
          </Box>

          {/* Task Statistics Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#E8F5E9', borderLeft: '4px solid #4CAF50' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography color="textSecondary" variant="caption" sx={{ fontWeight: 600 }}>
                    OPEN TASKS
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E7D32' }}>
                    {getTaskStatistics.open}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#FFEBEE', borderLeft: '4px solid #F44336' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography color="textSecondary" variant="caption" sx={{ fontWeight: 600 }}>
                    OVERDUE
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#C62828' }}>
                    {getTaskStatistics.overdue}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#FFF3E0', borderLeft: '4px solid #FF9800' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography color="textSecondary" variant="caption" sx={{ fontWeight: 600 }}>
                    SCHEDULED THIS WEEK
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#E65100' }}>
                    {getTaskStatistics.scheduledThisWeek}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#E3F2FD', borderLeft: '4px solid #2196F3' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography color="textSecondary" variant="caption" sx={{ fontWeight: 600 }}>
                    COMPLETED THIS MONTH
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: '#1565C0' }}>
                    {getTaskStatistics.completedThisMonth}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Search and Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
              <TextField
                placeholder="Search tasks..."
                variant="outlined"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                }}
                sx={{ minWidth: 250 }}
              />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value || null }))}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="finished">Completed</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value || null }))}
                  label="Priority"
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
              {(searchTerm || filters.status || filters.priority) && (
                <Button
                  size="small"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ status: null, priority: null, property: null });
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          </Paper>

          {/* Order By Buttons */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
              Order By:
            </Typography>
            <Button
              size="small"
              variant={sortBy === 'priority' ? 'contained' : 'outlined'}
              onClick={() => handleSortClick('priority')}
              endIcon={sortBy === 'priority' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              sx={{ textTransform: 'none' }}
            >
              Priority
            </Button>
            <Button
              size="small"
              variant={sortBy === 'due_date' ? 'contained' : 'outlined'}
              onClick={() => handleSortClick('due_date')}
              endIcon={sortBy === 'due_date' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              sx={{ textTransform: 'none' }}
            >
              Due Date
            </Button>
            <Button
              size="small"
              variant={sortBy === 'status' ? 'contained' : 'outlined'}
              onClick={() => handleSortClick('status')}
              endIcon={sortBy === 'status' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              sx={{ textTransform: 'none' }}
            >
              Status
            </Button>
            <Button
              size="small"
              variant={sortBy === 'cost' ? 'contained' : 'outlined'}
              onClick={() => handleSortClick('cost')}
              endIcon={sortBy === 'cost' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              sx={{ textTransform: 'none' }}
            >
              Cost
            </Button>
            <Button
              size="small"
              variant={sortBy === 'room' ? 'contained' : 'outlined'}
              onClick={() => handleSortClick('room')}
              endIcon={sortBy === 'room' && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
              sx={{ textTransform: 'none' }}
            >
              Room
            </Button>
          </Box>

          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="textSecondary">No tasks found.</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()} sx={{ mt: 2 }}>
                  New Task
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Tasks Table */}
              <TableContainer component={Paper} sx={{ flex: 1 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#F5F5F5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, minWidth: 40 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 200 }}>Task</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Room</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 100 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>Due Date</TableCell>
                      <TableCell sx={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>Cost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTasks.map(task => (
                      <TableRow
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedTask?.id === task.id ? '#E3F2FD' : 'transparent',
                          '&:hover': {
                            bgcolor: '#F5F5F5',
                          },
                        }}
                      >
                        <TableCell>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              bgcolor: getPriorityColor(task.priority),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={getPriorityLabel(task.priority)}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                          {task.description}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          {currentProperty?.name || '-'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          {task.areas && task.areas.length > 0 
                            ? areas.filter(a => task.areas.includes(a.id)).map(a => a.name).join(', ')
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getStatusLabel(task.status)}
                            size="small"
                            sx={{
                              bgcolor: getStatusColor(task.status),
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          />
                        </TableCell>
                        <TableCell
                          sx={{
                            fontSize: '0.9rem',
                            color: isOverdue(task.due_date, task.status) ? '#F44336' : '#666',
                            fontWeight: isOverdue(task.due_date, task.status) ? 600 : 400,
                          }}
                        >
                          {formatDate(task.due_date)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Task Detail Panel */}
              {selectedTask && (
                <DetailPanel
                  title="Task Details"
                  onClose={() => setSelectedTask(null)}
                  onEdit={() => handleOpen(selectedTask)}
                  onDelete={() => { handleDelete(selectedTask.id); setSelectedTask(null); }}
                >
                  <DetailField label="TITLE" value={selectedTask.description} />
                  <DetailField label="PRIORITY">
                    <Chip
                      label={getPriorityLabel(selectedTask.priority)}
                      size="small"
                      sx={{ bgcolor: getPriorityColor(selectedTask.priority), color: 'white', fontWeight: 600 }}
                    />
                  </DetailField>
                  <DetailField label="STATUS">
                    <Chip
                      label={getStatusLabel(selectedTask.status)}
                      size="small"
                      sx={{ bgcolor: getStatusColor(selectedTask.status), color: 'white', fontWeight: 600 }}
                    />
                  </DetailField>
                  <DetailField
                    label="DUE DATE"
                    value={selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
                  />
                  {selectedTask.vendor && (
                    <DetailField label="VENDOR" value={selectedTask.vendor.name} />
                  )}
                  <DetailField
                    label="ESTIMATED COST"
                    value={selectedTask.estimated_price ? `${selectedTask.currency} ${selectedTask.estimated_price}` : 'Not specified'}
                  />
                  {selectedTask.final_price && (
                    <DetailField label="ACTUAL COST">
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#F44336' }}>
                        {selectedTask.currency} {selectedTask.final_price}
                      </Typography>
                    </DetailField>
                  )}
                  {selectedTask.notes && (
                    <DetailField label="DESCRIPTION" value={selectedTask.notes} />
                  )}
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <DetailField label="ATTACHMENTS">
                      {selectedTask.attachments.map(attachment => (
                        <Button
                          key={attachment.id}
                          size="small"
                          startIcon={<DownloadIcon />}
                          href={attachment.file}
                          download
                          fullWidth
                          sx={{ justifyContent: 'flex-start', mb: 1 }}
                        >
                          {attachment.filename ? attachment.filename() : 'Download'}
                        </Button>
                      ))}
                    </DetailField>
                  )}
                </DetailPanel>
              )}
            </Box>
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

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                label="Priority"
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Due Date (Optional)"
              name="due_date"
              type="date"
              value={formData.due_date}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Task Type</InputLabel>
            <Select
              name="task_type"
              value={formData.task_type?.id || formData.task_type || ''}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  task_type: e.target.value
                }));
              }}
              label="Task Type"
            >
              {taskTypes.map(type => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Dynamic Custom Fields based on Task Type */}
          {(() => {
            const selectedTypeObj = taskTypes.find(t => t.id === (formData.task_type?.id || formData.task_type));
            const fields = selectedTypeObj?.custom_field_definitions || [];
            
            if (fields.length === 0) return null;

            return (
              <Box sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.01)' }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  {selectedTypeObj.name} Details
                </Typography>
                <Grid container spacing={2}>
                  {fields.map((fieldName) => (
                    <Grid item xs={12} sm={fields.length > 1 ? 6 : 12} key={fieldName}>
                      <TextField
                        fullWidth
                        label={fieldName}
                        value={formData.custom_field_values?.[fieldName] || ''}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            custom_field_values: {
                              ...(prev.custom_field_values || {}),
                              [fieldName]: e.target.value
                            }
                          }));
                        }}
                        size="small"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })()}

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
              value={formData.vendor?.id || formData.vendor || ''}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  vendor: e.target.value
                }));
              }}
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

export default Tasks;