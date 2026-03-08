import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * A labeled detail field for use inside DetailPanel.
 * Pass `value` for plain text, or use `children` for custom content.
 *
 * Props:
 *   label    – uppercase caption string (e.g. "STATUS")
 *   value    – plain-text value (optional if using children)
 *   children – custom content (overrides value)
 */
const DetailField = ({ label, value, children }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    {children ?? (
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    )}
  </Box>
);

export default DetailField;
