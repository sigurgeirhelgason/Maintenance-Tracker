import React, { useEffect, useRef, useState } from 'react';
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
  Collapse,
  Menu,
  MenuItem,
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
  Settings as SettingsIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Assessment as ReportsIcon,
  BarChart as BarChartIcon,
  LibraryBooks as MaintenanceHistoryIcon,
  TrendingUp as TrendingUpIcon,
  Apartment as AreaMaintenanceIcon,
  DateRange as ScheduleIcon,
  AttachMoney as VATRefundIcon,
  BusinessCenter as VendorPerformanceIcon,
  AccountCircle as AccountCircleIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useAuth } from '../../AuthContext';

const Sidebar = ({ open, setOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const prevIsMobileRef = useRef(isMobile);
  const [expandedItems, setExpandedItems] = useState({});
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);

  // Handle open state transitions between mobile and desktop
  useEffect(() => {
    if (prevIsMobileRef.current !== isMobile) {
      if (!isMobile) {
        // Going back to desktop - always restore full sidebar
        setOpen(true);
      } else {
        // Going to mobile - close any open state so mobile starts closed
        setOpen(false);
      }
      prevIsMobileRef.current = isMobile;
    }
  }, [isMobile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleExpanded = (key) => {
    setExpandedItems(prev => {
      // If clicking the same item, toggle it closed
      if (prev[key]) {
        return { [key]: false };
      }
      // If clicking a different item, close all others and open this one only
      return { [key]: true };
    });
  };

  const closeAllExpanded = () => {
    setExpandedItems({});
  };

  const menuItems = [
    { 
      id: 'dashboard',
      path: '/', 
      label: 'Dashboard', 
      icon: DashboardIcon 
    },
    { 
      id: 'properties',
      path: '/properties', 
      label: 'Properties', 
      icon: PropertiesIcon,
      children: [
        { path: '/areas', label: 'Rooms', icon: ComponentsIcon }
      ]
    },
    { 
      id: 'tasks',
      path: '/tasks', 
      label: 'Tasks', 
      icon: TasksIcon,
      children: [
        { path: '/tasktypes', label: 'Task Types', icon: CategoryIcon }
      ]
    },
    { 
      id: 'vendors',
      path: '/vendors', 
      label: 'Vendors', 
      icon: VendorsIcon,
      children: [
        { path: '/vendors/global', label: 'Global Vendors', icon: VendorsIcon }
      ]
    },
    { 
      id: 'reports',
      path: '/reports', 
      label: 'Reports', 
      icon: ReportsIcon,
      children: [
        { path: '/reports/cost-analysis', label: 'Cost Analysis', icon: BarChartIcon },
        { path: '/reports/task-status', label: 'Task Status', icon: BarChartIcon },
        { path: '/reports/vendor-performance', label: 'Vendor Performance', icon: VendorPerformanceIcon },
        { path: '/reports/maintenance-history', label: 'Maintenance History', icon: MaintenanceHistoryIcon },
        { path: '/reports/monthly-costs', label: 'Monthly Costs', icon: TrendingUpIcon },
        { path: '/reports/area-maintenance', label: 'Area Maintenance', icon: AreaMaintenanceIcon },
        { path: '/reports/schedule', label: 'Maintenance Schedule', icon: ScheduleIcon },
        { path: '/reports/vat-refunds', label: 'VAT Refunds', icon: VATRefundIcon },
      ]
    },
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isMobile && (
            <IconButton
              onClick={() => setOpen(false)}
              sx={{ color: 'white' }}
              size="small"
            >
              <CloseIcon />
            </IconButton>
          )}
          <IconButton
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            sx={{
              color: 'white',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
            size="small"
          >
            <AccountCircleIcon fontSize="large" />
          </IconButton>
        </Box>
      </Box>

      {/* User Menu Dropdown */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem
          component={Link}
          to="/settings"
          onClick={() => {
            setUserMenuAnchor(null);
            isMobile && setOpen(false);
          }}
        >
          <SettingsIcon sx={{ mr: 1 }} fontSize="small" />
          Settings
        </MenuItem>
        <MenuItem
          component={Link}
          to="/data-sharing"
          onClick={() => {
            setUserMenuAnchor(null);
            isMobile && setOpen(false);
          }}
        >
          <ShareIcon sx={{ mr: 1 }} fontSize="small" />
          Data Sharing
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            setUserMenuAnchor(null);
            handleLogout();
          }}
        >
          <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
          Logout
        </MenuItem>
      </Menu>

      <Divider />

      {/* Menu Items */}
      <List sx={{ flex: 1, pt: 2, px: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const hasChildren = item.children && item.children.length > 0;
          
          // Check if any child item is active
          const isChildActive = hasChildren && item.children.some(child => location.pathname === child.path);
          
          // Keep expanded if manually expanded or if a child is active
          const isExpanded = expandedItems[item.id] || isChildActive;

          return (
            <Box key={item.id}>
              <ListItem disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  data-parent-id={item.id}
                  onClick={() => {
                    if (hasChildren) {
                      toggleExpanded(item.id);
                    } else {
                      closeAllExpanded();
                    }
                    isMobile && setOpen(false);
                  }}
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
                  {open && hasChildren && (
                    <Box sx={{ ml: 'auto' }}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                  )}
                </ListItemButton>
              </ListItem>

              {/* Child Items */}
              {hasChildren && (
                <Collapse 
                  in={isExpanded} 
                  timeout="auto" 
                  unmountOnExit
                  onExiting={() => {
                    // Move focus to parent before collapsing to prevent aria-hidden warnings
                    const parentButton = document.querySelector(`[data-parent-id="${item.id}"]`);
                    if (document.activeElement && parentButton) {
                      parentButton.focus();
                    }
                  }}
                >
                  <List component="div" disablePadding sx={{ pl: 2 }}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = location.pathname === child.path;

                      return (
                        <ListItem key={child.path} disablePadding sx={{ mb: 0.5 }}>
                          <ListItemButton
                            component={Link}
                            to={child.path}
                            onClick={() => {
                              closeAllExpanded();
                              isMobile && setOpen(false);
                            }}
                            sx={{
                              borderRadius: 1,
                              color: isChildActive ? theme.palette.primary.main : 'inherit',
                              backgroundColor: isChildActive
                                ? theme.palette.primary.main + '15'
                                : 'transparent',
                              borderLeft: isChildActive ? `4px solid ${theme.palette.primary.main}` : 'none',
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                              transition: 'all 0.2s ease',
                            }}
                          >
                            <ListItemIcon
                              sx={{
                                minWidth: 40,
                                color: isChildActive ? theme.palette.primary.main : 'inherit',
                              }}
                            >
                              <ChildIcon />
                            </ListItemIcon>
                            {open && <ListItemText primary={child.label} />}
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              )}
            </Box>
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
              color="primary"
              size="small"
              startIcon={<SettingsIcon />}
              component={Link}
              to="/settings"
              onClick={() => {
                closeAllExpanded();
                isMobile && setOpen(false);
              }}
              sx={{ mb: 1 }}
            >
              {open ? 'Settings' : ''}
            </Button>
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
        open={isMobile && open}
        onClose={() => setOpen(false)}
        disableAutoFocus
        disableEnforceFocus
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
