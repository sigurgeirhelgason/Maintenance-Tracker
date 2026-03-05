import React from 'react';
import { Box, Typography, Breadcrumbs, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';

const PageHeader = ({ title, subtitle, breadcrumbs }) => {
  return (
    <Box sx={{ mb: 4 }}>
      {breadcrumbs && (
        <Breadcrumbs sx={{ mb: 2 }}>
          {breadcrumbs.map((crumb, index) => (
            <MuiLink
              key={index}
              component={crumb.path ? Link : 'span'}
              to={crumb.path}
              sx={{ textDecoration: 'none', color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              {crumb.label}
            </MuiLink>
          ))}
        </Breadcrumbs>
      )}
      <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography color="textSecondary" variant="body1">
          {subtitle}
        </Typography>
      )}
    </Box>
  );
};

export default PageHeader;
