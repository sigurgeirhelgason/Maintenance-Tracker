import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

/**
 * Generic confirmation dialog.
 *
 * Props:
 *   open         – boolean
 *   title        – dialog heading
 *   message      – body text
 *   onClose      – called on Cancel
 *   onConfirm    – called on confirm button
 *   confirmLabel – button text (default "Delete")
 *   confirmColor – MUI color (default "error")
 */
const ConfirmDialog = ({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  confirmColor = 'error',
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ fontWeight: 600 }}>{title}</DialogTitle>
    <DialogContent sx={{ pt: 2 }}>
      <Typography>{message}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button onClick={onConfirm} variant="contained" color={confirmColor}>
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
