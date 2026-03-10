import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  IconButton,
  useTheme,
  useMediaQuery,
  Button,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Home as PropertiesIcon,
  Build as ComponentsIcon,
  Checklist as TasksIcon,
  Handshake as WorkOrdersIcon,
  Business as VendorsIcon,
  Category as CategoryIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useAuth } from '../../AuthContext';

const Sidebar = ({ open, setOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: DashboardIcon },
    { path: '/properties', label: 'Properties', icon: PropertiesIcon },
    { path: '/areas', label: 'Rooms', icon: ComponentsIcon },
    { path: '/tasks', label: 'Tasks', icon: TasksIcon },
    { path: '/vendors', label: 'Vendors', icon: VendorsIcon },
    { path: '/tasktypes', label: 'Task Types', icon: CategoryIcon },
  ];

  const drawerWidth = 240;

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Property
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Maintenance
          </Typography>
        </Box>
        {isMobile && (
          <IconButton
            onClick={() => setOpen(false)}
            sx={{ color: 'white' }}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <Divider />

      {/* Menu Items */}
      <List sx={{ flex: 1, pt: 2, px: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                component={Link}
                to={item.path}
                onClick={() => isMobile && setOpen(false)}
                sx={{
                  borderRadius: 1,
                  color: isActive ? theme.palette.primary.main : 'inherit',
                  backgroundColor: isActive
                    ? theme.palette.primary.main + '15'
                    : 'transparent',
                  borderLeft: isActive ? `4px solid ${theme.palette.primary.main}` : 'none',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isActive ? theme.palette.primary.main : 'inherit',
                  }}
                >
                  <Icon />
                </ListItemIcon>
                {open && <ListItemText primary={item.label} />}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        {user && (
          <>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              {user.username}
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ mb: 1 }}
            >
              {open ? 'Logout' : ''}
            </Button>
          </>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.7rem' }}>
          © 2026 Property Maintenance
        </Typography>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: open ? drawerWidth : 48, // Reduced collapsed width
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : 48, // Reduced collapsed width
            boxSizing: 'border-box',
            transition: 'width 0.3s ease',
            border: 'none',
            borderRight: `1px solid ${theme.palette.divider}`,
            overflowX: 'hidden',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Mobile Menu Button */}
      <Box
        sx={{
          display: { xs: 'block', sm: 'none' },
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 1300,
        }}
      >
        <IconButton
          onClick={() => setOpen(!open)}
          sx={{
            backgroundColor: 'white',
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>
    </>
  );
};

export default Sidebar;
