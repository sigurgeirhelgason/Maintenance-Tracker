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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Schedule as PendingIcon,
  Autorenew as InProgressIcon,
  CheckCircle as FinishedIcon,
  Apartment as PropertiesIcon,
  Work as WorkIcon,
  Notifications as MaintenanceIcon,
  LocalOffer as RefundIcon,
} from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import TaskCalendar from './TaskCalendar';
import TaskDetailModal from './TaskDetailModal';
import VendorDetailModal from './VendorDetailModal';

const StatCard = ({ title, value, subtitle, icon: Icon, color, bgcolor, borderColor, onClick }) => {
  return (
    <Card sx={{ 
      height: '100%',
      minHeight: 140,
      borderTop: `3px solid ${color}`,
      display: 'flex',
      flexDirection: 'column',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      '&:hover': {
        boxShadow: 3,
        transform: 'translateY(-4px)',
      },
    }}
    onClick={onClick}>
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
  
  // Format number with dots as thousand separators (Icelandic format)
  const formatPrice = (num) => {
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  
  const [stats, setStats] = useState({
    openWorkOrders: 0,
    overdueTasks: 0,
    upcomingMaintenance: 0,
    possibleRefund: 0,
    totalInvestmentThisYear: 0,
    totalEstimatedCost: 0,
  });
  const [properties, setProperties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [selectedStatsCategory, setSelectedStatsCategory] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDetailModalOpen, setVendorDetailModalOpen] = useState(false);

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
      
      // Calculate possible VAT refund (35% of work price for finished tasks not yet claimed)
      const finishedTasks = tasks.filter(
        t => t.status === 'finished' && !t.vat_refund_claimed
      );
      const totalVatRefundablePrice = finishedTasks.reduce((sum, t) => {
        // Calculate from price_breakdown if available
        if (t.price_breakdown && t.price_breakdown.length > 0) {
          const vatRefundable = t.price_breakdown
            .filter(item => item.vat_refundable)
            .reduce((itemSum, item) => itemSum + (parseFloat(item.amount) || 0), 0);
          return sum + vatRefundable;
        }
        // Fall back to final_work_price for backward compatibility
        return sum + (parseFloat(t.final_work_price) || 0);
      }, 0);
      const possibleRefund = Math.floor(totalVatRefundablePrice * 0.24 * 0.35);

      // Calculate total investment this year (sum of final_price for tasks created this year)
      const currentYear = new Date().getFullYear();
      const tasksThisYear = tasks.filter(t => {
        if (!t.created_date) return false;
        const taskYear = new Date(t.created_date).getFullYear();
        return taskYear === currentYear;
      });
      const totalInvestmentThisYear = tasksThisYear.reduce((sum, t) => {
        return sum + (parseFloat(t.final_price) || 0);
      }, 0);

      // Calculate total estimated cost for all tasks this year
      const totalEstimatedCost = tasksThisYear.reduce((sum, t) => {
        return sum + (parseFloat(t.estimated_price) || 0);
      }, 0);

      setTasks(tasks.slice(0, 10));
      setProperties(properties.slice(0, 3));
      setVendors(vendors.slice(0, 5));
      
      setStats({
        openWorkOrders,
        overdueTasks: Math.floor(openWorkOrders * 0.3), // Placeholder calculation
        upcomingMaintenance: Math.floor(openWorkOrders * 0.5), // Placeholder calculation
        possibleRefund,
        totalInvestmentThisYear,
        totalEstimatedCost,
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

  const statisticsCards = [
    {
      title: 'Open Work Orders',
      value: stats.openWorkOrders,
      subtitle: `${stats.overdueTasks} Overdue`,
      icon: WorkIcon,
      color: '#2196f3',
      onClick: () => {
        setSelectedStatsCategory('openWorkOrders');
        setStatsModalOpen(true);
      },
    },
    // {
    //   title: 'Upcoming Maintenance',
    //   value: stats.upcomingMaintenance,
    //   subtitle: 'This Week',
    //   icon: MaintenanceIcon,
    //   color: '#4caf50',
    //   onClick: () => {
    //     setSelectedStatsCategory('upcomingMaintenance');
    //     setStatsModalOpen(true);
    //   },
    // },
    {
      title: 'Possible VAT Refund',
      value: `${formatPrice(stats.possibleRefund)} Kr.`,
      subtitle: '35% of VAT (24%)',
      icon: RefundIcon,
      color: '#4caf50',
      onClick: () => {
        setSelectedStatsCategory('possibleRefund');
        setStatsModalOpen(true);
      },
    },
    {
      title: 'Total Investment This Year',
      value: `${formatPrice(stats.totalInvestmentThisYear)} Kr.`,
      subtitle: 'Based on final prices',
      icon: WorkIcon,
      color: '#2196f3',
    },
    {
      title: 'Total Estimated Cost',
      value: `${formatPrice(stats.totalEstimatedCost)} Kr.`,
      subtitle: "This year's tasks",
      icon: WorkIcon,
      color: '#ff9800',
    },
  ];

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
        {statisticsCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <StatCard
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
              icon={card.icon}
              color={card.color}
              onClick={card.onClick}
            />
          </Grid>
        ))}
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
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500, flex: 1.5, minWidth: 0 }}>
                          {task.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'textSecondary', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {task.property_details?.name || 'N/A'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'textSecondary', whiteSpace: 'nowrap', flex: 0.8 }}>
                          {task.vendor_details?.name || '-'}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: 'nowrap', flex: 0.7 }}>
                          {task.cost ? `${formatPrice(task.cost)} Kr.` : '-'}
                        </Typography>
                        <Chip
                          label={task.status === 'pending' ? 'Pending' : 'In Progress'}
                          size="small"
                          color={task.status === 'pending' ? 'warning' : 'info'}
                          variant="filled"
                        />
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {vendors.filter(v => v.favorite).slice(0, 5).map((vendor) => (
                    <Box
                      key={vendor.id}
                      onClick={() => {
                        setSelectedVendor(vendor);
                        setVendorDetailModalOpen(true);
                      }}
                      sx={{
                        p: 2,
                        border: '1px solid #e0e0e0',
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#2196f3',
                          boxShadow: '0 2px 8px rgba(33, 150, 243, 0.1)',
                          transform: 'translateY(-2px)',
                        },
                        backgroundColor: '#fafafa',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: '#333' }}>
                        {vendor.name}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {vendor.phone && (
                          <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                            📞 {vendor.phone}
                          </Typography>
                        )}
                        {vendor.email && (
                          <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                            ✉️ {vendor.email}
                          </Typography>
                        )}
                        {!vendor.phone && !vendor.email && (
                          <Typography variant="caption" sx={{ color: 'textSecondary', fontStyle: 'italic' }}>
                            No contact info
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                  No favorite vendors yet. Mark vendors as favorites in the Vendors page.
                </Typography>
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

      {/* Vendor Detail Modal */}
      <VendorDetailModal
        open={vendorDetailModalOpen}
        vendor={selectedVendor}
        onClose={() => setVendorDetailModalOpen(false)}
        onEdit={() => { setVendorDetailModalOpen(false); }}
      />

      {/* Stats Category Modal */}
      <Dialog open={statsModalOpen} onClose={() => setStatsModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedStatsCategory === 'openWorkOrders' && 'Open Work Orders'}
          {selectedStatsCategory === 'upcomingMaintenance' && 'Upcoming Maintenance'}
          {selectedStatsCategory === 'possibleRefund' && 'Possible VAT Refund'}
        </DialogTitle>
        <DialogContent sx={{ maxHeight: 600, overflow: 'auto' }}>
          {selectedStatsCategory === 'openWorkOrders' && (
            <List sx={{ pt: 2 }}>
              {tasks.filter(t => t.status !== 'finished').map((task, index) => (
                <ListItem
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setStatsModalOpen(false);
                  }}
                  sx={{
                    border: '1px solid #eee',
                    borderRadius: 1,
                    mb: 2,
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f5f5f5', borderColor: '#2196f3' },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {task.description}
                    </Typography>
                    <Chip
                      label={task.status === 'pending' ? 'Pending' : 'In Progress'}
                      size="small"
                      color={task.status === 'pending' ? 'warning' : 'info'}
                      variant="filled"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, width: '100%', mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                      <strong>Property:</strong> {task.property_details?.name || 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                      <strong>Vendor:</strong> {task.vendor_details?.name || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                        <strong>Cost:</strong> {task.cost ? `${formatPrice(task.cost)} Kr.` : '-'}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}

          {selectedStatsCategory === 'upcomingMaintenance' && (
            <List sx={{ pt: 2 }}>
              {tasks.filter(t => t.status !== 'finished').map((task, index) => (
                <ListItem
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setStatsModalOpen(false);
                  }}
                  sx={{
                    border: '1px solid #eee',
                    borderRadius: 1,
                    mb: 2,
                    p: 2,
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f5f5f5', borderColor: '#4caf50' },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {task.description}
                    </Typography>
                    <Chip
                      label={task.status === 'pending' ? 'Pending' : 'In Progress'}
                      size="small"
                      color={task.status === 'pending' ? 'warning' : 'info'}
                      variant="filled"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 3, width: '100%', mt: 1 }}>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                      <strong>Property:</strong> {task.property_details?.name || 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                      <strong>Vendor:</strong> {task.vendor_details?.name || '-'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                      <strong>Cost:</strong> {task.cost ? `${formatPrice(task.cost)} Kr.` : '-'}
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}

          {selectedStatsCategory === 'possibleRefund' && (
            <List sx={{ pt: 2 }}>
              {tasks.filter(t => {
                const hasVatRefundable = t.price_breakdown && t.price_breakdown.some(item => item.vat_refundable);
                const hasFinalWorkPrice = t.final_work_price;
                return t.status === 'finished' && !t.vat_refund_claimed && (hasVatRefundable || hasFinalWorkPrice);
              }).length > 0 ? (
                tasks.filter(t => {
                  const hasVatRefundable = t.price_breakdown && t.price_breakdown.some(item => item.vat_refundable);
                  const hasFinalWorkPrice = t.final_work_price;
                  return t.status === 'finished' && !t.vat_refund_claimed && (hasVatRefundable || hasFinalWorkPrice);
                }).map((task) => {
                  let vatRefundableAmount = 0;
                  if (task.price_breakdown && task.price_breakdown.length > 0) {
                    vatRefundableAmount = task.price_breakdown
                      .filter(item => item.vat_refundable)
                      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                  } else {
                    vatRefundableAmount = parseFloat(task.final_work_price) || 0;
                  }
                  const refundAmount = Math.floor(vatRefundableAmount * 0.24 * 0.35);
                  
                  return (
                    <ListItem
                      key={task.id}
                      onClick={() => {
                        setSelectedTask(task);
                        setStatsModalOpen(false);
                      }}
                      sx={{
                        border: '1px solid #eee',
                        borderRadius: 1,
                        mb: 2,
                        p: 2,
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: '#f5f5f5', borderColor: '#4caf50' },
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {task.description}
                        </Typography>
                        <Chip
                          label="Finished"
                          size="small"
                          color="success"
                          variant="filled"
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 3, width: '100%', mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'textSecondary' }}>
                          <strong>VAT Refundable:</strong> {formatPrice(vatRefundableAmount)} Kr.
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#4caf50' }}>
                          <strong>Refund (35% of 24% VAT):</strong> {formatPrice(refundAmount)} Kr.
                        </Typography>
                      </Box>
                    </ListItem>
                  );
                })
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 4 }}>
                  No finished tasks with VAT refundable costs available for refund claim.
                </Typography>
              )}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatsModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;