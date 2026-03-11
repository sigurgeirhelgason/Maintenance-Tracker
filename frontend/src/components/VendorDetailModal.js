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
import { Close as CloseIcon, Phone as PhoneIcon, Email as EmailIcon, LocationOn as LocationIcon, Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material';

const VendorDetailModal = ({ open, vendor, onClose, onEdit }) => {
  const [vendorTasks, setVendorTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState(null);

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
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
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
                      <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      <TableCell sx={{ fontWeight: 700, textAlign: 'right' }}>Due Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vendorTasks.map(task => (
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
        <Button onClick={onClose}>Close</Button>
        <Button onClick={() => { onClose(); onEdit?.(); }} variant="contained" color="primary">
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VendorDetailModal;
