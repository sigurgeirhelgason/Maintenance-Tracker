import React from 'react';
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
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { formatWithDots } from '../utils/formatters';
import DetailField from './shared/DetailField';

const TaskDetailModal = ({ open, task, onClose }) => {
  if (!task) return null;

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

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'low':
        return '#4caf50';
      case 'medium':
        return '#ff9800';
      case 'high':
        return '#f44336';
      default:
        return '#999';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Task Details
        <Button size="small" onClick={onClose} sx={{ minWidth: 'auto' }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ overflow: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
        {/* Description */}
        <DetailField
          label="DESCRIPTION"
          value={task.description || 'No description'}
        />

        {/* Property */}
        {task.property_details && (
          <DetailField
            label="PROPERTY"
            value={task.property_details.name || 'N/A'}
          />
        )}

        {/* Status */}
        <DetailField label="STATUS">
          <Chip
            label={getStatusLabel(task.status)}
            color={getStatusColor(task.status)}
            size="small"
            variant="filled"
          />
        </DetailField>

        {/* Priority */}
        {task.priority && (
          <DetailField label="PRIORITY">
            <Chip
              label={task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              sx={{ backgroundColor: getPriorityColor(task.priority), color: 'white' }}
              size="small"
              variant="filled"
            />
          </DetailField>
        )}

        {/* Due Date */}
        {task.due_date && (
          <DetailField
            label="DUE DATE"
            value={formatDate(task.due_date)}
          />
        )}

        {/* Task Type */}
        {task.task_type_details && (
          <DetailField
            label="TASK TYPE"
            value={task.task_type_details.name || 'N/A'}
          />
        )}

        {/* Custom Fields */}
        {task.task_type_details?.custom_field_definitions?.length > 0 && task.custom_field_values && (
          <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.01)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              {task.task_type_details.name} Details
            </Typography>
            {task.task_type_details.custom_field_definitions.map((fieldName) => (
              <DetailField
                key={fieldName}
                label={fieldName.toUpperCase()}
                value={task.custom_field_values[fieldName] || 'Not specified'}
              />
            ))}
          </Box>
        )}

        {/* Vendor */}
        {task.vendor_details && (
          <DetailField
            label="VENDOR"
            value={task.vendor_details.name || 'N/A'}
          />
        )}

        {/* Areas */}
        {task.areas_details && task.areas_details.length > 0 && (
          <DetailField label="AREAS">
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {task.areas_details.map((area) => (
                <Chip
                  key={area.id}
                  label={area.type}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </DetailField>
        )}

        {/* Estimated Price */}
        {task.estimated_price && (
          <DetailField
            label="ESTIMATED PRICE"
            value={`${formatWithDots(task.estimated_price)} ${task.currency || 'Krónur'}`}
          />
        )}

        {/* Final Price */}
        {task.final_price && (
          <DetailField
            label="FINAL PRICE"
            value={`${formatWithDots(task.final_price)} ${task.currency || 'Krónur'}`}
          />
        )}

        {/* Created Date */}
        {task.created_date && (
          <DetailField
            label="CREATED"
            value={formatDate(task.created_date)}
          />
        )}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaskDetailModal;
