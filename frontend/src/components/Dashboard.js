import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Grid,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
import {
  Schedule as PendingIcon,
  Autorenew as InProgressIcon,
  CheckCircle as FinishedIcon,
  Apartment as PropertiesIcon,
  Work as WorkIcon,
  Notifications as MaintenanceIcon,
  Approval as ApprovalIcon,
} from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import TaskCalendar from './TaskCalendar';
import TaskDetailModal from './TaskDetailModal';

const StatCard = ({ title, value, subtitle, icon: Icon, color, bgcolor, borderColor }) => {
  return (
    <Card sx={{ 
      height: '100%',
      minHeight: 140,
      borderTop: `3px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography color="textSecondary" variant="body2" sx={{ fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" sx={{ color, fontWeight: 500, mt: 1, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const [stats, setStats] = useState({
    openWorkOrders: 0,
    overdueTasks: 0,
    upcomingMaintenance: 0,
    pendingApprovals: 0,
    totalProperties: 0,
  });
  const [properties, setProperties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [tasksResponse, propertiesResponse, vendorsResponse] = await Promise.all([
        axios.get('/api/tasks/'),
        axios.get('/api/properties/'),
        axios.get('/api/vendors/'),
      ]);

      const tasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : [];
      const properties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];
      const vendors = Array.isArray(vendorsResponse.data) ? vendorsResponse.data : [];

      // Calculate stats
      const openWorkOrders = tasks.filter(t => t.status !== 'finished').length;
      const overdueTasks = tasks.filter(t => t.status !== 'finished' && t.created_date).length; // Simplified for now

      setTasks(tasks.slice(0, 10));
      setProperties(properties.slice(0, 3));
      setVendors(vendors.slice(0, 5));
      
      setStats({
        openWorkOrders,
        overdueTasks: Math.floor(openWorkOrders * 0.3), // Placeholder calculation
        upcomingMaintenance: Math.floor(openWorkOrders * 0.5), // Placeholder calculation
        pendingApprovals: Math.floor(openWorkOrders * 0.2), // Placeholder calculation
        totalProperties: properties.length,
      });
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your properties and maintenance tasks"
        breadcrumbs={[{ label: 'Home' }]}
      />

      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Open Work Orders"
            value={stats.openWorkOrders}
            subtitle={`${stats.overdueTasks} Overdue`}
            icon={WorkIcon}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Upcoming Maintenance"
            value={stats.upcomingMaintenance}
            subtitle="This Week"
            icon={MaintenanceIcon}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon={ApprovalIcon}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Properties"
            value={stats.totalProperties}
            icon={PropertiesIcon}
            color="#9c27b0"
          />
        </Grid>
      </Grid>

      {/* Main Content Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
         {/* Properties Overview */}
          <Grid item xs={12} lg={8}>
            <Card sx={{ height: '100%', minHeight: 450, display: 'flex', flexDirection: 'column' }}>
              <CardHeader
                title="Properties Overview"
                action={<Button size="small">View All →</Button>}
                titleTypographyProps={{ variant: 'h6' }}
              />
              <CardContent sx={{ flexGrow: 1 }}>
                <Grid container spacing={2}>
            {properties.length > 0 ? (
              properties.map(property => (
                <Grid item xs={12} sm={6} md={4} key={property.id}>
                  <Card sx={{ height: 450, cursor: 'pointer', '&:hover': { boxShadow: 2 }, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ height: 300, bgcolor: '#667eea', backgroundImage: property.image ? `url(${property.image})` : '', backgroundSize: 'cover', backgroundPosition: 'center' }} />
              <CardContent sx={{ pb: 1, flexGrow: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {property.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-around', pt: 1 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                {property.areas?.length || 0}
                    </Typography>
                    <Typography variant="caption">Units</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#f44336' }}>
                {property.tasks?.filter(t => t.status !== 'finished').length || 0}
                    </Typography>
                    <Typography variant="caption">Issues</Typography>
                  </Box>
                </Box>
              </CardContent>
                  </Card>
                </Grid>
              ))
            ) : (
              <Typography color="textSecondary" sx={{ p: 2 }}>No properties yet</Typography>
            )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Maintenance Calendar */}
        <Grid item xs={12} lg={4}>
          <Card sx={{ height: '100%', minHeight: 450, display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title="Maintenance Calendar"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <TaskCalendar tasks={tasks} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom Sections */}
      <Grid container spacing={3}>
        {/* Upcoming Tasks */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 350, display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title="Upcoming Tasks"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
              {tasks.filter(t => t.status !== 'finished').length > 0 ? (
                <List sx={{ p: 0 }}>
                  {tasks
                    .filter(t => t.status !== 'finished')
                    .slice(0, 5)
                    .map((task, index) => (
                      <ListItem
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        sx={{
                          px: 0,
                          py: 1.5,
                          borderBottom: index < tasks.filter(t => t.status !== 'finished').slice(0, 5).length - 1 ? '1px solid #eee' : 'none',
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: '#f5f5f5' },
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                          {task.description}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                            {task.property_details?.name || 'N/A'}
                          </Typography>
                          <Chip
                            label={task.status === 'pending' ? 'Pending' : 'In Progress'}
                            size="small"
                            color={task.status === 'pending' ? 'warning' : 'info'}
                            variant="filled"
                          />
                        </Box>
                      </ListItem>
                    ))}
                </List>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                  No upcoming tasks
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Favorite Vendor Contacts */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 350, display: 'flex', flexDirection: 'column' }}>
            <CardHeader
              title="Favorite Vendors"
              titleTypographyProps={{ variant: 'h6' }}
            />
            <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
              {vendors.filter(v => v.favorite).length > 0 ? (
                <List>
                  {vendors.filter(v => v.favorite).slice(0, 5).map((vendor, index) => (
                    <ListItem key={vendor.id} sx={{ px: 0, py: 1, borderBottom: index < vendors.filter(v => v.favorite).slice(0, 5).length - 1 ? '1px solid #eee' : 'none' }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {vendor.name}
                          </Typography>
                        }
                        secondary={vendor.phone || vendor.email}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary">No favorite vendors yet. Mark vendors as favorites in the Vendors page.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Task Detail Modal */}
      <TaskDetailModal
        open={selectedTask !== null}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </Box>
  );
};

export default Dashboard;