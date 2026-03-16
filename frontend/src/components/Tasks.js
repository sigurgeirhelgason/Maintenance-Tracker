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
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Download as DownloadIcon, Search as SearchIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon, Delete as DeleteIcon } from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import DetailPanel from './shared/DetailPanel';
import DetailField from './shared/DetailField';
import ConfirmDialog from './shared/ConfirmDialog';
import NotificationSnackbar from './shared/NotificationSnackbar';
import StatisticsCards from './shared/StatisticsCards';
import { useNotification, useConfirmDialog } from './shared/hooks';

// Format number with dot thousand separators (e.g., 200000 -> "200.000")
const formatDotThousands = (num) => {
  if (num === '' || num === null || num === undefined) return '';
  const numStr = String(num).replace(/\D/g, ''); // Remove non-digits
  if (!numStr) return '';
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Parse dot thousand separator format back to number (e.g., "200.000" -> 200000)
const parseDotThousands = (str) => {
  if (!str) return '';
  return str.replace(/\./g, '');
};

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
  const [yearFilter, setYearFilter] = useState('all');
  const [filters, setFilters] = useState({
    status: ['pending', 'in_progress'],
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
    vat_refund_claimed: false,
    price_breakdown: [],
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
      const matchesStatus = filters.status.length === 0 || filters.status.includes(task.status);
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      const matchesProperty = !filters.property || task.property === filters.property;
      
      // Year filtering
      let matchesYear = true;
      if (yearFilter !== 'all') {
        const year = parseInt(yearFilter);
        if (task.due_date) {
          matchesYear = new Date(task.due_date).getFullYear() === year;
        }
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesProperty && matchesYear;
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
        case 'description':
          comparison = (a.description || '').localeCompare(b.description || '');
          break;
        case 'property':
          comparison = String(a.property || '').localeCompare(String(b.property || ''));
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tasks, searchTerm, filters, sortBy, sortDirection, yearFilter]);

  // Calculate available years from tasks
  const availableYears = useMemo(() => {
    const years = new Set();
    tasks.forEach(task => {
      if (task.due_date) {
        years.add(new Date(task.due_date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [tasks]);



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
        estimated_price: task.estimated_price || '',
        final_price: task.final_price || '',
        vat_refund_claimed: task.vat_refund_claimed || false,
        price_breakdown: task.price_breakdown || [],
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
        vat_refund_claimed: false,
        price_breakdown: [],
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
    
    if (name === 'estimated_price' || name === 'final_price') {
      // Format price input with dot thousand separators
      const numericValue = parseDotThousands(value);
      const formattedValue = formatDotThousands(numericValue);
      
      if (name === 'final_price') {
        // When final_price changes, update price_breakdown in real-time
        const finalPrice = parseInt(numericValue) || 0;
        
        setFormData(prev => {
          const updated = { ...prev, [name]: formattedValue };
          
          if (finalPrice > 0) {
            // Calculate sum of all non-"uncategorized" items
            let sumNonOther = 0;
            let otherIndex = -1;
            
            const newBreakdown = [...(prev.price_breakdown || [])];
            newBreakdown.forEach((item, index) => {
              if (item.category === 'uncategorized') {
                otherIndex = index;
              } else {
                sumNonOther += parseInt(item.amount) || 0;
              }
            });
            
            // Calculate what "uncategorized" should be
            const otherAmount = finalPrice - sumNonOther;
            
            if (otherAmount > 0) {
              // Update or create "uncategorized" item
              if (otherIndex >= 0) {
                newBreakdown[otherIndex].amount = otherAmount;
              } else {
                newBreakdown.push({
                  category: 'uncategorized',
                  amount: otherAmount,
                  vat_refundable: false,
                  description: ''
                });
              }
            } else {
              // Remove "uncategorized" if amount is 0 or less
              if (otherIndex >= 0) {
                newBreakdown.splice(otherIndex, 1);
              }
            }
            
            updated.price_breakdown = newBreakdown;
          } else {
            // Clear breakdown if final_price is 0
            updated.price_breakdown = [];
          }
          
          return updated;
        });
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: formattedValue,
        }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
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

  const addPriceBreakdownItem = () => {
    setFormData(prev => ({
      ...prev,
      price_breakdown: [...(prev.price_breakdown || []), { category: 'materials', amount: '', vat_refundable: false, description: '' }]
    }));
  };

  const removePriceBreakdownItem = (index) => {
    setFormData(prev => ({
      ...prev,
      price_breakdown: prev.price_breakdown.filter((_, i) => i !== index)
    }));
  };

  const updatePriceBreakdownItem = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.price_breakdown];
      // Auto-set vat_refundable based on category when category changes
      if (field === 'category') {
        updated[index] = { ...updated[index], [field]: value, vat_refundable: value === 'work' };
      } else if (field === 'amount') {
        // Format and parse price amounts
        const numericValue = parseDotThousands(value);
        updated[index] = { ...updated[index], [field]: numericValue ? parseInt(numericValue) : '' };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      
      // If amount field was changed and final_price is set, recalculate "uncategorized"
      if (field === 'amount' && prev.final_price) {
        const finalPrice = parseInt(parseDotThousands(prev.final_price)) || 0;
        
        // Calculate sum of all non-"uncategorized" items
        let sumNonOther = 0;
        let otherIndex = -1;
        
        updated.forEach((item, idx) => {
          if (item.category === 'uncategorized') {
            otherIndex = idx;
          } else {
            sumNonOther += parseInt(item.amount) || 0;
          }
        });
        
        // Calculate what "uncategorized" should be
        const otherAmount = finalPrice - sumNonOther;
        
        if (otherAmount > 0) {
          // Update or create "uncategorized" item
          if (otherIndex >= 0) {
            updated[otherIndex].amount = otherAmount;
          } else {
            updated.push({
              category: 'uncategorized',
              amount: otherAmount,
              vat_refundable: false,
              description: ''
            });
          }
        } else {
          // Remove "uncategorized" if amount is 0 or less
          if (otherIndex >= 0) {
            updated.splice(otherIndex, 1);
          }
        }
      }
      
      return { ...prev, price_breakdown: updated };
    });
  };

  const calculatePriceBreakdownTotals = () => {
    let total = 0;
    let vatRefundable = 0;
    (formData.price_breakdown || []).forEach(item => {
      const amount = parseInt(item.amount) || 0;
      total += amount;
      if (item.vat_refundable) {
        vatRefundable += amount;
      }
    });
    return { total, vatRefundable };
  };

  const handleSave = async () => {
    if (!formData.description.trim()) {
      showNotification('Task title is required', 'warning');
      return;
    }

    try {
      const submitData = {
        ...formData,
        property: selectedProperty,
        task_type: formData.task_type?.id || formData.task_type || null,
        vendor: formData.vendor?.id || formData.vendor || null,
        due_date: formData.due_date || null,
        estimated_price: formData.estimated_price ? parseInt(parseDotThousands(formData.estimated_price)) : null,
        final_price: formData.final_price ? parseInt(parseDotThousands(formData.final_price)) : null,
        vat_refund_claimed: formData.vat_refund_claimed,
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

      {/* Statistics Cards */}
      {tasks.length > 0 && <StatisticsCards tasks={tasks} yearFilter={yearFilter} />}

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
            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
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
          )}

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
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  multiple
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value }))}
                  label="Status"
                  renderValue={(selected) => {
                    const labels = {
                      pending: 'Open',
                      in_progress: 'In Progress',
                      finished: 'Completed'
                    };
                    return selected.map(s => labels[s]).join(', ');
                  }}
                >
                  <MenuItem value="pending">
                    <Checkbox size="small" checked={filters.status.includes('pending')} />
                    Open
                  </MenuItem>
                  <MenuItem value="in_progress">
                    <Checkbox size="small" checked={filters.status.includes('in_progress')} />
                    In Progress
                  </MenuItem>
                  <MenuItem value="finished">
                    <Checkbox size="small" checked={filters.status.includes('finished')} />
                    Completed
                  </MenuItem>
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
              {availableYears.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel>Year</InputLabel>
                  <Select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    label="Year"
                  >
                    <MenuItem value="all">All Years</MenuItem>
                    {availableYears.map(year => (
                      <MenuItem key={year} value={year}>{year}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {(searchTerm || filters.status.length > 0 || filters.status.length < 3 || filters.priority) && (
                <Button
                  size="small"
                  onClick={() => {
                    setSearchTerm('');
                    setFilters({ status: ['pending', 'in_progress'], priority: null, property: null });
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          </Paper>

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
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 40, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('priority')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Priority
                          {sortBy === 'priority' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 200, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('description')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Task
                          {sortBy === 'description' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 120, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('property')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Property
                          {sortBy === 'property' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 100, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('room')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Room
                          {sortBy === 'room' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 100, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('status')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Status
                          {sortBy === 'status' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 80, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('due_date')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Due Date
                          {sortBy === 'due_date' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, minWidth: 80, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('cost')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                          Cost
                          {sortBy === 'cost' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
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
                        <TableCell sx={{ fontSize: '0.9rem', textAlign: 'right', fontWeight: 500 }}>
                          {task.final_price
                            ? parseFloat(task.final_price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kr.'
                            : task.estimated_price
                            ? parseFloat(task.estimated_price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kr.'
                            : '-'
                          }
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
                  {selectedTask.task_type_details && (
                    <DetailField label="TASK TYPE" value={selectedTask.task_type_details.name} />
                  )}
                  {selectedTask.task_type_details?.custom_field_definitions?.length > 0 && selectedTask.custom_field_values && (
                    <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.01)' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                        {selectedTask.task_type_details.name} Details
                      </Typography>
                      {selectedTask.task_type_details.custom_field_definitions.map((fieldName) => (
                        <DetailField
                          key={fieldName}
                          label={fieldName.toUpperCase()}
                          value={selectedTask.custom_field_values[fieldName] || 'Not specified'}
                        />
                      ))}
                    </Box>
                  )}
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
                        {parseFloat(selectedTask.final_price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} Kr.
                      </Typography>
                    </DetailField>
                  )}
                  {selectedTask.price_breakdown && selectedTask.price_breakdown.length > 0 && (
                    <DetailField label="COST BREAKDOWN">
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {selectedTask.price_breakdown.map((item, index) => (
                          <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '0.8fr 0.6fr', gap: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 0.5, fontSize: '0.85rem' }}>
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                                {item.category}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="caption">
                                {formatDotThousands(item.amount)} Kr. {item.vat_refundable && '(VAT)'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        {selectedTask.price_breakdown.length > 0 && (
                          <Box sx={{ display: 'grid', gridTemplateColumns: '0.8fr 0.6fr', gap: 1, p: 1, borderTop: '1px solid #ccc', fontWeight: 600, fontSize: '0.9rem' }}>
                            <Box>Total</Box>
                            <Box sx={{ textAlign: 'right' }}>
                              {formatDotThousands(selectedTask.price_breakdown.reduce((sum, item) => sum + (parseInt(item.amount) || 0), 0))} Kr.
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </DetailField>
                  )}
                  {selectedTask.notes && (
                    <DetailField label="DESCRIPTION" value={selectedTask.notes} />
                  )}
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <DetailField label="ATTACHMENTS">
                      {selectedTask.attachments.map(attachment => {
                        const fileName = attachment.file ? attachment.file.split('/').pop() : 'File';
                        return (
                          <Box
                            key={attachment.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.5,
                              mb: 1,
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                              backgroundColor: '#fafafa',
                              '&:hover': {
                                backgroundColor: '#f0f0f0',
                                borderColor: '#2196f3',
                              },
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 500,
                                flex: 1,
                                ml: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fileName}
                            </Typography>
                            <Button
                              size="small"
                              href={attachment.file}
                              target="_blank"
                              rel="noopener noreferrer"
                              startIcon={<DownloadIcon />}
                              sx={{ whiteSpace: 'nowrap', minWidth: 'auto', p: 0.5, flexShrink: 0 }}
                            />
                          </Box>
                        );
                      })}
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
            label="Task title"
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
              type="text"
              value={formData.estimated_price}
              onChange={handleChange}
              variant="outlined"
              inputProps={{ min: '0' }}
              placeholder="0"
            />
          </Box>

          {formData.status === 'finished' && (
            <>
              <TextField
                margin="dense"
                label="Final Price"
                name="final_price"
                type="text"
                value={formData.final_price}
                onChange={handleChange}
                variant="outlined"
                inputProps={{ min: '0' }}
                fullWidth
                sx={{ mb: 2 }}
                placeholder="0"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    name="vat_refund_claimed"
                    checked={formData.vat_refund_claimed}
                    onChange={handleChange}
                  />
                }
                label="VAT Refund Claimed"
                sx={{ mb: 2 }}
              />

              {/* Price Breakdown Section */}
              <Box sx={{ mb: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Cost Breakdown</Typography>
                  <Button size="small" variant="outlined" onClick={addPriceBreakdownItem}>
                    + Add Item
                  </Button>
                </Box>

                {formData.price_breakdown && formData.price_breakdown.length > 0 ? (
                  <>
                    {formData.price_breakdown.map((item, index) => (
                      <Box key={index} sx={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr auto auto', gap: 1, mb: 2, alignItems: 'flex-start' }}>
                        <FormControl size="small">
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={item.category || 'materials'}
                            label="Category"
                            onChange={(e) => updatePriceBreakdownItem(index, 'category', e.target.value)}
                          >
                            <MenuItem value="materials">Materials</MenuItem>
                            <MenuItem value="work">Work/Labor</MenuItem>
                            <MenuItem value="travel">Travel</MenuItem>
                            <MenuItem value="tools">Tools</MenuItem>
                            <MenuItem value="uncategorized">Uncategorized</MenuItem>
                          </Select>
                        </FormControl>

                        <TextField
                          size="small"
                          label="Amount"
                          type="text"
                          value={formatDotThousands(item.amount || '')}
                          onChange={(e) => updatePriceBreakdownItem(index, 'amount', e.target.value)}
                          inputProps={{ min: '0' }}
                          variant="outlined"
                          placeholder="0"
                        />

                        <IconButton size="small" color="error" onClick={() => removePriceBreakdownItem(index)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}

                    {/* Description field for last item */}
                    {formData.price_breakdown.length > 0 && (
                      <TextField
                        size="small"
                        label="Description (for breakdown)"
                        fullWidth
                        placeholder="Optional: describe the items (e.g., Paint and supplies for materials)"
                        value={formData.price_breakdown[formData.price_breakdown.length - 1].description || ''}
                        onChange={(e) => updatePriceBreakdownItem(formData.price_breakdown.length - 1, 'description', e.target.value)}
                        variant="outlined"
                        sx={{ mb: 2 }}
                      />
                    )}

                    {/* Cost Totals */}
                    {(() => {
                      const { total, vatRefundable } = calculatePriceBreakdownTotals();
                      return (
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1, borderTop: '1px solid #ccc' }}>
                          <Typography variant="body2"><strong>Total:</strong> {formatDotThousands(total)} Kr.</Typography>
                          <Typography variant="body2"><strong>VAT Refundable (35%):</strong> {formatDotThousands(Math.round(vatRefundable * 0.35))} Kr.</Typography>
                        </Box>
                      );
                    })()}
                  </>
                ) : (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    No cost items added yet
                  </Typography>
                )}
              </Box>
            </>
          )}

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