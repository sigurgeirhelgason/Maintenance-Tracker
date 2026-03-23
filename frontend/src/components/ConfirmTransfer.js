import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { confirmTransfer } from '../utils/dataShareAPI';

const ConfirmTransfer = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No confirmation token provided.');
      return;
    }

    // Guard against React StrictMode double-invocation in development
    if (calledRef.current) return;
    calledRef.current = true;

    const confirm = async () => {
      try {
        const data = await confirmTransfer(token);
        setPropertyName(data?.property_name || '');
        setStatus('success');
      } catch (err) {
        const message =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          'This link is invalid or has expired.';
        setErrorMessage(message);
        setStatus('error');
      }
    };

    confirm();
  }, [token]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
        px: 2,
        textAlign: 'center',
      }}
    >
      {status === 'loading' && (
        <>
          <CircularProgress size={56} />
          <Typography variant="h6" color="text.secondary">
            Confirming ownership transfer...
          </Typography>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircleOutlineIcon sx={{ fontSize: 72, color: 'success.main' }} />
          <Typography variant="h5" fontWeight={700}>
            Ownership transferred successfully!
          </Typography>
          <Alert severity="success" sx={{ maxWidth: 480 }}>
            {propertyName
              ? `"${propertyName}" is now in your account. You can manage it from your dashboard.`
              : 'The property is now in your account. You can manage it from your dashboard.'}
          </Alert>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </Button>
        </>
      )}

      {status === 'error' && (
        <>
          <ErrorOutlineIcon sx={{ fontSize: 72, color: 'error.main' }} />
          <Typography variant="h5" fontWeight={700}>
            Transfer could not be completed
          </Typography>
          <Alert severity="error" sx={{ maxWidth: 480 }}>
            {errorMessage || 'This link is invalid or has expired.'}
          </Alert>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => navigate('/')}
          >
            Go to Dashboard
          </Button>
        </>
      )}
    </Box>
  );
};

export default ConfirmTransfer;
