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
} from '@mui/material';
import {
  Schedule as PendingIcon,
  Autorenew as InProgressIcon,
  CheckCircle as FinishedIcon,
  Apartment as PropertiesIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon: Icon, color, bgcolor }) => {
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 700, mt: 1 }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: bgcolor,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon sx={{ fontSize: 28, color: color }} />
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const [stats, setStats] = useState({
    pending: 0,
    inProgress: 0,
    finished: 0,
    totalProperties: 0,
  });
  const [pendingTasks, setPendingTasks] = useState([]);
  const [inProgressTasks, setInProgressTasks] = useState([]);
  const [finishedTasks, setFinishedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch tasks and properties
      const [tasksResponse, propertiesResponse] = await Promise.all([
        axios.get('/api/tasks/'),
        axios.get('/api/properties/'),
      ]);

      const tasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : [];
      const properties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];

      // Filter tasks by status
      const pending = tasks.filter(task => task.status === 'pending').slice(0, 5);
      const inProgress = tasks.filter(task => task.status === 'in_progress').slice(0, 5);
      const finished = tasks.filter(task => task.status === 'finished').slice(0, 5);

      setPendingTasks(pending);
      setInProgressTasks(inProgress);
      setFinishedTasks(finished);
      setStats({
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        finished: tasks.filter(t => t.status === 'finished').length,
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
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h2" sx={{ fontWeight: 700, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography color="textSecondary" variant="body1">
          Welcome back! Here's your property maintenance overview.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Tasks"
            value={stats.pending}
            icon={PendingIcon}
            color={theme.palette.warning.main}
            bgcolor={theme.palette.warning.main + '15'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={InProgressIcon}
            color={theme.palette.info.main}
            bgcolor={theme.palette.info.main + '15'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Finished Tasks"
            value={stats.finished}
            icon={FinishedIcon}
            color={theme.palette.success.main}
            bgcolor={theme.palette.success.main + '15'}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Properties"
            value={stats.totalProperties}
            icon={PropertiesIcon}
            color={theme.palette.primary.main}
            bgcolor={theme.palette.primary.main + '15'}
          />
        </Grid>
      </Grid>

      {/* Tasks Sections */}
      <Grid container spacing={3}>
        {/* Pending Tasks */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Pending Tasks"
              titleTypographyProps={{ variant: 'h5' }}
              avatar={<PendingIcon sx={{ color: theme.palette.warning.main }} />}
            />
            <CardContent>
              {pendingTasks.length > 0 ? (
                <List>
                  {pendingTasks.map(task => (
                    <ListItem key={task.id} sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {task.description}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                            {task.task_type && `Type: ${task.task_type.name}`}
                          </Typography>
                        }
                      />
                      <Chip label="Pending" color="warning" size="small" variant="filled" />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary" sx={{ py: 2 }}>
                  No pending tasks.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* In Progress Tasks */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="In Progress"
              titleTypographyProps={{ variant: 'h5' }}
              avatar={<InProgressIcon sx={{ color: theme.palette.info.main }} />}
            />
            <CardContent>
              {inProgressTasks.length > 0 ? (
                <List>
                  {inProgressTasks.map(task => (
                    <ListItem key={task.id} sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {task.description}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                            {task.vendor && `Vendor: ${task.vendor.name}`}
                          </Typography>
                        }
                      />
                      <Chip label="In Progress" color="info" size="small" variant="filled" />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary" sx={{ py: 2 }}>
                  No tasks in progress.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Finished Tasks */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              title="Recently Finished"
              titleTypographyProps={{ variant: 'h5' }}
              avatar={<FinishedIcon sx={{ color: theme.palette.success.main }} />}
            />
            <CardContent>
              {finishedTasks.length > 0 ? (
                <List>
                  {finishedTasks.map(task => (
                    <ListItem key={task.id} sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 500, textDecoration: 'line-through' }}>
                            {task.description}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                            {task.final_price && `Final: ${task.currency} ${task.final_price}`}
                          </Typography>
                        }
                      />
                      <Chip label="Finished" color="success" size="small" variant="filled" />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="textSecondary" sx={{ py: 2 }}>
                  No finished tasks yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;