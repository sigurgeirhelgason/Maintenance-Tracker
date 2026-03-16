import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon, Phone as PhoneIcon, Email as EmailIcon, LocationOn as LocationIcon, Star as StarIcon, StarBorder as StarBorderIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon } from '@mui/icons-material';

const VendorDetailModal = ({ open, vendor, onClose, onEdit, onToggleFavorite }) => {
  const [vendorTasks, setVendorTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(vendor?.favorite || false);
  const [sortBy, setSortBy] = useState('description');
  const [sortDirection, setSortDirection] = useState('asc');

  useEffect(() => {
    if (vendor) {
      setIsFavorite(vendor.favorite || false);
    }
  }, [vendor?.id, vendor?.favorite]);

  useEffect(() => {
    if (open && vendor) {
      fetchVendorTasks();
    }
  }, [open, vendor?.id]);

  const fetchVendorTasks = async () => {
    try {
      setTasksLoading(true);
      setTasksError(null);
      const response = await axios.get(`/api/tasks/?vendor=${vendor.id}`);
      setVendorTasks(response.data);
    } catch (err) {
      setTasksError('Failed to load tasks');
      console.error(err);
    } finally {
      setTasksLoading(false);
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

  const sortedTasks = React.useMemo(() => {
    const tasks = [...vendorTasks];
    tasks.sort((a, b) => {
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
    return tasks;
  }, [vendorTasks, sortBy, sortDirection]);
  if (!vendor) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#ff9800'; // orange
      case 'in_progress':
        return '#2196f3'; // blue
      case 'finished':
        return '#4caf50'; // green
      default:
        return '#757575'; // gray
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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {vendor.name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => {
              setIsFavorite(!isFavorite);
              onToggleFavorite?.(vendor);
            }}
            sx={{ color: isFavorite ? '#ffc107' : 'inherit' }}
          >
            {isFavorite ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Vendor Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#666' }}>
            VENDOR INFORMATION
          </Typography>

          {/* Contact Info Grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mb: 2 }}>
            {vendor.contact_person && (
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>
                  CONTACT PERSON
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {vendor.contact_person}
                </Typography>
              </Box>
            )}

            {vendor.phone && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PhoneIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>
                    PHONE
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {vendor.phone}
                  </Typography>
                </Box>
              </Box>
            )}

            {vendor.email && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmailIcon sx={{ fontSize: 16, color: '#2196f3' }} />
                <Box>
                  <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>
                    EMAIL
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {vendor.email}
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>

          {vendor.address && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <LocationIcon sx={{ fontSize: 16, color: '#2196f3', mt: 0.3 }} />
              <Box>
                <Typography variant="caption" sx={{ color: '#999', fontWeight: 500 }}>
                  ADDRESS
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {vendor.address}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Task Types */}
          {(vendor.task_type_details || (vendor.secondary_task_types_details && vendor.secondary_task_types_details.length > 0)) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#999', fontWeight: 500, display: 'block', mb: 0.7 }}>
                TASK TYPES
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {vendor.task_type_details && (
                  <Chip label={vendor.task_type_details.name} size="small" color="primary" />
                )}
                {vendor.secondary_task_types_details && vendor.secondary_task_types_details.map(type => (
                  <Chip key={type.id} label={type.name} size="small" variant="outlined" />
                ))}
              </Box>
            </Box>
          )}
        </Box>

        {/* Vendor Tasks Section - Only render if there are tasks */}
        {!tasksLoading && vendorTasks.length > 0 && (
          <>
            <Divider sx={{ my: 3 }} />
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5, color: '#666' }}>
                ASSIGNED TASKS ({vendorTasks.length})
              </Typography>

              {tasksError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {tasksError}
                </Alert>
              )}

              <TableContainer component={Paper} sx={{ bgcolor: '#fafafa' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                      <TableCell
                        sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('description')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Task
                          {sortBy === 'description' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('property_details')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Property
                          {sortBy === 'property_details' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('status')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Status
                          {sortBy === 'status' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('priority')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          Priority
                          {sortBy === 'priority' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => handleSortClick('due_date')}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                          Due Date
                          {sortBy === 'due_date' && (sortDirection === 'asc' ? <ArrowUpIcon sx={{ fontSize: 16 }} /> : <ArrowDownIcon sx={{ fontSize: 16 }} />)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedTasks.map(task => (
                      <TableRow key={task.id} sx={{ '&:hover': { bgcolor: '#f0f0f0' } }}>
                        <TableCell sx={{ fontSize: '0.9rem', maxWidth: 250 }}>
                          <Typography sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          {task.property_details?.name || '-'}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          <Box
                            sx={{
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.5,
                              bgcolor: getStatusColor(task.status),
                              color: '#fff',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                            }}
                          >
                            {getStatusLabel(task.status)}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          <Chip
                            label={task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            size="small"
                            color={getPriorityColor(task.priority)}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem', textAlign: 'right' }}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ pt: 2, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={() => { onClose(); onEdit?.(); }} variant="contained" color="primary">
          Edit
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorDetailModal;
