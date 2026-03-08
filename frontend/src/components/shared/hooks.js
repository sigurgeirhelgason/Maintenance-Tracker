import { useState } from 'react';

/**
 * Manages notification snackbar state.
 *
 * Returns:
 *   notification  – { open, message, severity }
 *   showNotification(message, severity?)
 *   handleCloseNotification(event, reason)
 */
export const useNotification = () => {
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification(prev => ({ ...prev, open: false }));
  };

  return { notification, showNotification, handleCloseNotification };
};

/**
 * Manages confirmation-dialog state.
 *
 * Returns:
 *   confirmDialog  – { open, title, message, onConfirm }
 *   openConfirmDialog(title, message, onConfirm)
 *   handleConfirmDialogClose()
 *   handleConfirmDialogConfirm()
 */
export const useConfirmDialog = () => {
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  const openConfirmDialog = (title, message, onConfirm) => {
    setConfirmDialog({ open: true, title, message, onConfirm });
  };

  const handleConfirmDialogClose = () => {
    setConfirmDialog(prev => ({ ...prev, open: false }));
  };

  const handleConfirmDialogConfirm = () => {
    if (confirmDialog.onConfirm) confirmDialog.onConfirm();
    handleConfirmDialogClose();
  };

  return {
    confirmDialog,
    openConfirmDialog,
    handleConfirmDialogClose,
    handleConfirmDialogConfirm,
  };
};
