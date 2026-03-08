import React from 'react';
import { Box, Button, Divider, Paper, Typography } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Close as CloseIcon } from '@mui/icons-material';

/**
 * Reusable side-panel that shows item details with Edit / Delete actions.
 *
 * Props:
 *   title    – heading text
 *   onClose  – called when X is clicked
 *   onEdit   – called when Edit button is clicked
 *   onDelete – called when Delete button is clicked
 *   children – <DetailField> rows (or any content)
 */
const DetailPanel = ({ title, onClose, onEdit, onDelete, children }) => (
  <Paper sx={{ width: 350, p: 3, maxHeight: 'calc(100vh - 400px)', overflow: 'auto', flexShrink: 0 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Button size="small" onClick={onClose}>
        <CloseIcon fontSize="small" />
      </Button>
    </Box>
    <Divider sx={{ mb: 2 }} />

    {children}

    <Divider sx={{ my: 2 }} />

    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="contained" size="small" fullWidth startIcon={<EditIcon />} onClick={onEdit}>
        Edit
      </Button>
      <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={onDelete}>
        Delete
      </Button>
    </Box>
  </Paper>
);

export default DetailPanel;
