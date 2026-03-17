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
  Download as DownloadIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import PageHeader from './Layout/PageHeader';
import TaskCalendar from './TaskCalendar';
import TaskDetailModal from './TaskDetailModal';
import VendorDetailModal from './VendorDetailModal';
import StatisticsCards from './shared/StatisticsCards';
import NotificationSnackbar from './shared/NotificationSnackbar';
import { formatWithDots } from '../utils/formatters';

const Dashboard = () => {
  const theme = useTheme();
  
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
  
  // Export/Import states
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', type: 'success' });
  const [importSummary, setImportSummary] = useState(null);

  const formatPrice = (num) => formatWithDots(num);

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

      const fetchedTasks = Array.isArray(tasksResponse.data) ? tasksResponse.data : [];
      const fetchedProperties = Array.isArray(propertiesResponse.data) ? propertiesResponse.data : [];
      const fetchedVendors = Array.isArray(vendorsResponse.data) ? vendorsResponse.data : [];

      setTasks(fetchedTasks.slice(0, 10));
      setProperties(fetchedProperties.slice(0, 3));
      setVendors(fetchedVendors.slice(0, 5));
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const response = await axios.post('/api/export/', {}, {
        responseType: 'blob',
      });

      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `maintenance_export_${new Date().toISOString().slice(0, 10)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setNotification({
        open: true,
        message: 'Data exported successfully!',
        type: 'success',
      });
    } catch (err) {
      setNotification({
        open: true,
        message: `Export failed: ${err.response?.data?.error || err.message}`,
        type: 'error',
      });
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportClick = () => {
    setImportDialogOpen(true);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/import/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportSummary(response.data);
      setNotification({
        open: true,
        message: 'Data imported successfully!',
        type: 'success',
      });

      // Refresh dashboard data after successful import
      await fetchDashboardData();
    } catch (err) {
      setNotification({
        open: true,
        message: `Import failed: ${err.response?.data?.error || err.message}`,
        type: 'error',
      });
      console.error(err);
    } finally {
      setImportLoading(false);
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

      {/* Export/Import Buttons */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={handleExport}
          disabled={exportLoading}
        >
          {exportLoading ? 'Exporting...' : 'Export Data'}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<UploadIcon />}
          onClick={handleImportClick}
          disabled={importLoading}
        >
          {importLoading ? 'Importing...' : 'Import Data'}
        </Button>
      </Box>

      {/* Statistics Cards */}
      {tasks.length > 0 && <StatisticsCards tasks={tasks} yearFilter="all" />}

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

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => !importLoading && setImportDialogOpen(false)}>
        <DialogTitle>Import Data</DialogTitle>
        <DialogContent sx={{ minWidth: 400, py: 3 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Select a ZIP file to import your maintenance data.
          </Typography>
          <input
            type="file"
            accept=".zip"
            onChange={(e) => {
              handleImportFile(e);
              setImportDialogOpen(false);
            }}
            disabled={importLoading}
            style={{ width: '100%' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importLoading}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Summary Dialog */}
      <Dialog open={!!importSummary} onClose={() => setImportSummary(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Import Summary</DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          {importSummary && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2">
                <strong>Properties Created:</strong> {importSummary.properties_created}
              </Typography>
              <Typography variant="body2">
                <strong>Properties Updated:</strong> {importSummary.properties_updated}
              </Typography>
              <Typography variant="body2">
                <strong>Areas Created:</strong> {importSummary.areas_created}
              </Typography>
              <Typography variant="body2">
                <strong>Areas Updated:</strong> {importSummary.areas_updated}
              </Typography>
              <Typography variant="body2">
                <strong>Vendors Created:</strong> {importSummary.vendors_created}
              </Typography>
              <Typography variant="body2">
                <strong>Vendors Updated:</strong> {importSummary.vendors_updated}
              </Typography>
              <Typography variant="body2">
                <strong>Tasks Created:</strong> {importSummary.tasks_created}
              </Typography>
              <Typography variant="body2">
                <strong>Tasks Updated:</strong> {importSummary.tasks_updated}
              </Typography>
              <Typography variant="body2">
                <strong>Attachments Created:</strong> {importSummary.attachments_created}
              </Typography>
              <Typography variant="body2">
                <strong>Files Restored:</strong> {importSummary.files_restored}
              </Typography>
              {importSummary.errors && importSummary.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 600, mb: 1 }}>
                    Errors:
                  </Typography>
                  <Box sx={{ pl: 2 }}>
                    {importSummary.errors.map((error, idx) => (
                      <Typography key={idx} variant="caption" sx={{ display: 'block', color: 'error.main' }}>
                        • {error}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportSummary(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <NotificationSnackbar
        open={notification.open}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ ...notification, open: false })}
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