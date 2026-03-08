import React from 'react';
import { Alert, Snackbar } from '@mui/material';

/**
 * Bottom-right notification snackbar.
 *
 * Props:
 *   open     – boolean
 *   message  – text to display
 *   severity – "success" | "error" | "warning" | "info" (default "success")
 *   onClose  – close handler
 */
const NotificationSnackbar = ({ open, message, severity = 'success', onClose }) => (
  <Snackbar
    open={open}
    autoHideDuration={6000}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
  >
    <Alert onClose={onClose} severity={severity} sx={{ width: '100%' }}>
      {message}
    </Alert>
  </Snackbar>
);

export default NotificationSnackbar;
