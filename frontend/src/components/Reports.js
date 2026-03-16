import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  PieChart as PieChartIcon,
  BarChart as BarChartIcon,
  TrendingUp as TrendingUpIcon,
  Assessment as AssessmentIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import PageHeader from './Layout/PageHeader';
import StatisticsCards, { StatCard } from './shared/StatisticsCards';

const Reports = () => {
  const { reportType } = useParams();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [yearFilter, setYearFilter] = useState('all');
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  // Map reportType to tab index
  useEffect(() => {
    if (reportType) {
      const tabMap = {
        'cost-analysis': 0,
        'task-status': 1,
        'vendor-performance': 2,
        'maintenance-history': 3,
        'monthly-costs': 4,
        'area-maintenance': 5,
        'schedule': 6,
        'vat-refunds': 7,
      };
      setActiveTab(tabMap[reportType] ?? 0);
    }
  }, [reportType]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tasksRes, vendorsRes, propsRes, areasRes] = await Promise.all([
        axios.get('/api/tasks/'),
        axios.get('/api/vendors/'),
        axios.get('/api/properties/'),
        axios.get('/api/areas/'),
      ]);
      setTasks(tasksRes.data);
      setVendors(vendorsRes.data);
      setProperties(propsRes.data);
      setAreas(areasRes.data);
    } catch (err) {
      setError('Error fetching report data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Get available years from tasks
  const availableYears = useMemo(() => {
    const years = new Set();
    tasks.forEach(task => {
      if (task.due_date) {
        years.add(new Date(task.due_date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [tasks]);

  // Filter tasks by year
  const filteredTasks = useMemo(() => {
    if (yearFilter === 'all') {
      return tasks;
    }
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return new Date(task.due_date).getFullYear() === parseInt(yearFilter);
    });
  }, [tasks, yearFilter]);

  // Cost Analysis by Property
  const costByProperty = useMemo(() => {
    const data = {};
    filteredTasks.forEach(task => {
      const propId = task.property;
      const prop = properties.find(p => p.id === propId);
      const propName = prop?.name || `Property ${propId}`;
      const cost = task.final_price || task.estimated_price || 0;
      
      if (!data[propName]) {
        data[propName] = { actual: 0, estimated: 0, count: 0 };
      }
      if (task.final_price) {
        data[propName].actual += task.final_price;
      } else {
        data[propName].estimated += task.estimated_price || 0;
      }
      data[propName].count += 1;
    });
    return Object.entries(data).map(([name, values]) => ({
      property: name,
      ...values,
    })).sort((a, b) => b.actual - a.actual);
  }, [filteredTasks, properties]);

  // Task Status Overview
  const taskStatusOverview = useMemo(() => {
    return {
      pending: filteredTasks.filter(t => t.status === 'pending').length,
      in_progress: filteredTasks.filter(t => t.status === 'in_progress').length,
      finished: filteredTasks.filter(t => t.status === 'finished').length,
    };
  }, [filteredTasks]);

  // Cost by Task Type
  const costByTaskType = useMemo(() => {
    const data = {};
    filteredTasks.forEach(task => {
      const typeName = task.task_type_details?.name || 'Unknown';
      const cost = task.final_price || task.estimated_price || 0;
      
      if (!data[typeName]) {
        data[typeName] = { actual: 0, estimated: 0, count: 0, finishedCount: 0 };
      }
      if (task.final_price) {
        data[typeName].actual += task.final_price;
        if (task.status === 'finished') {
          data[typeName].finishedCount += 1;
        }
      } else {
        data[typeName].estimated += task.estimated_price || 0;
      }
      data[typeName].count += 1;
    });
    return Object.entries(data).map(([name, values]) => {
      const totalCost = values.actual + values.estimated;
      return {
        type: name,
        actual: values.actual,
        estimated: values.estimated,
        total: totalCost,
        count: values.count,
        finishedCount: values.finishedCount,
        average: values.finishedCount > 0 ? Math.round(values.actual / values.finishedCount) : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredTasks]);

  // Vendor Performance
  const vendorPerformance = useMemo(() => {
    const data = {};
    filteredTasks.forEach(task => {
      const vendorId = task.vendor;
      if (!vendorId) return;
      
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) return; // Skip if vendor doesn't exist
      
      const vendorName = vendor.name;
      const cost = task.final_price || task.estimated_price || 0;
      
      if (!data[vendorName]) {
        data[vendorName] = { 
          tasks: 0, 
          total: 0, 
          completed: 0,
          is_favorite: vendor.favorite || false,
        };
      }
      data[vendorName].tasks += 1;
      data[vendorName].total += cost;
      if (task.status === 'finished') {
        data[vendorName].completed += 1;
      }
    });
    return Object.entries(data).map(([name, values]) => ({
      vendor: name,
      ...values,
      average: Math.round(values.total / values.tasks),
      completionRate: Math.round((values.completed / values.tasks) * 100),
    })).sort((a, b) => b.total - a.total);
  }, [filteredTasks, vendors]);

  // Property Maintenance History (only finished tasks)
  const maintenanceHistory = useMemo(() => {
    return filteredTasks
      .filter(task => task.status === 'finished')
      .map(task => ({
        ...task,
        property_name: properties.find(p => p.id === task.property)?.name || `Property ${task.property}`,
      }))
      .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))
      .slice(0, 50); // Show last 50
  }, [filteredTasks, properties]);

  // Monthly Cost Analysis
  const monthlyCosts = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (yearFilter === 'all') {
      // Get all year-month combinations from tasks
      const yearMonthMap = new Map();
      
      tasks.forEach(task => {
        if (!task.due_date) return;
        const taskDate = new Date(task.due_date);
        const year = taskDate.getFullYear();
        const month = taskDate.getMonth();
        const key = `${year}-${month}`;
        
        if (!yearMonthMap.has(key)) {
          yearMonthMap.set(key, {
            year,
            month,
            monthName: months[month],
            cost: 0,
            count: 0,
          });
        }
        
        const data = yearMonthMap.get(key);
        const cost = task.final_price || task.estimated_price || 0;
        data.cost += cost;
        data.count += 1;
      });
      
      // Sort by year and month, create labels with year
      return Array.from(yearMonthMap.values())
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map(item => ({
          month: `${item.monthName} ${item.year}`,
          cost: item.cost,
          count: item.count,
        }));
    } else {
      // Single year view
      const monthlyData = months.map((month, index) => ({
        month,
        cost: 0,
        count: 0,
      }));

      const targetYear = parseInt(yearFilter);
      tasks.forEach(task => {
        if (!task.due_date) return;
        
        const taskDate = new Date(task.due_date);
        const taskYear = taskDate.getFullYear();
        const taskMonth = taskDate.getMonth();

        if (taskYear === targetYear) {
          const cost = task.final_price || task.estimated_price || 0;
          monthlyData[taskMonth].cost += cost;
          monthlyData[taskMonth].count += 1;
        }
      });

      return monthlyData;
    }
  }, [tasks, yearFilter]);

  // Get tasks for selected month (only finished tasks)
  const monthTasks = useMemo(() => {
    if (!selectedMonth) return [];
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = months.indexOf(selectedMonth);
    
    // Use the same logic as monthlyCosts for target year
    let targetYear = yearFilter === 'all' ? new Date().getFullYear() : parseInt(yearFilter);
    
    return tasks
      .filter(task => {
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate.getFullYear() === targetYear && taskDate.getMonth() === monthIndex && task.status === 'finished';
      })
      .map(task => ({
        ...task,
        property_name: properties.find(p => p.id === task.property)?.name || `Property ${task.property}`,
        vendor_name: vendors.find(v => v.id === task.vendor)?.name || '-',
      }))
      .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));
  }, [selectedMonth, yearFilter, tasks, properties, vendors]);

  // Area Maintenance Analysis
  const areaMaintenanceData = useMemo(() => {
    const data = {};
    filteredTasks.forEach(task => {
      const taskAreas = task.areas || [];
      taskAreas.forEach(areaId => {
        const area = areas.find(a => a.id === areaId);
        if (!area) return;
        
        const areaLabel = area.name || area.type;
        if (!data[areaLabel]) {
          data[areaLabel] = { open: 0, finished: 0, type: area.type };
        }
        if (task.status === 'finished') {
          data[areaLabel].finished += 1;
        } else {
          data[areaLabel].open += 1;
        }
      });
    });
    return Object.entries(data).map(([name, values]) => ({
      area: name,
      ...values,
      total: values.open + values.finished,
    })).sort((a, b) => b.open - a.open);
  }, [filteredTasks, areas]);

  // Upcoming Maintenance Schedule
  const upcomingMaintenanceSchedule = useMemo(() => {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    return filteredTasks
      .filter(task => task.status === 'pending' || task.status === 'in_progress')
      .map(task => ({
        ...task,
        property_name: properties.find(p => p.id === task.property)?.name || `Property ${task.property}`,
        daysUntilDue: task.due_date ? Math.ceil((new Date(task.due_date) - now) / (1000 * 60 * 60 * 24)) : null,
      }))
      .sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
  }, [filteredTasks, properties]);

  // VAT Refund Status Analysis
  const refundStatusData = useMemo(() => {
    const notClaimed = filteredTasks.filter(t => !t.vat_refund_claimed && t.status === 'finished').length;
    const claimed = filteredTasks.filter(t => t.vat_refund_claimed && t.status === 'finished').length;
    
    // Calculate refund amounts: work price * 24% VAT * 35% refund rate
    let estimatedRefundAmount = 0;
    let totalVatAmount = 0;
    
    filteredTasks.forEach(task => {
      if (task.status === 'finished' && task.price_breakdown && Array.isArray(task.price_breakdown)) {
        task.price_breakdown.forEach(item => {
          // Only calculate for work category items that are vat_refundable
          if (item.category === 'work' && item.vat_refundable) {
            const itemAmount = item.amount || 0;
            const vatAmount = Math.round(itemAmount * 0.24);
            const refundAmount = Math.round(vatAmount * 0.35);
            
            totalVatAmount += vatAmount;
            if (!task.vat_refund_claimed) {
              estimatedRefundAmount += refundAmount;
            }
          }
        });
      }
    });
    
    return {
      notClaimed,
      claimed,
      estimatedRefundAmount,
      refundableAmount: totalVatAmount,
    };
  }, [filteredTasks]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Reports Landing Page (when no reportType is selected)
  if (!reportType) {
    const reportCategories = [
      {
        id: 'cost-analysis',
        label: 'Cost Analysis',
        description: 'Analyze maintenance costs by property and task type',
        icon: '💰',
        color: '#2563eb'
      },
      {
        id: 'task-status',
        label: 'Task Status',
        description: 'Track task progress and completion rates',
        icon: '📊',
        color: '#10b981'
      },
      {
        id: 'vendor-performance',
        label: 'Vendor Performance',
        description: 'Evaluate vendor reliability and costs',
        icon: '🏢',
        color: '#f59e0b'
      },
      {
        id: 'maintenance-history',
        label: 'Maintenance History',
        description: 'Review completed maintenance records',
        icon: '📋',
        color: '#8b5cf6'
      },
      {
        id: 'monthly-costs',
        label: 'Monthly Costs',
        description: 'View monthly cost trends and patterns',
        icon: '📈',
        color: '#ec4899'
      },
      {
        id: 'area-maintenance',
        label: 'Area Maintenance',
        description: 'Track maintenance needs by area/room',
        icon: '🏠',
        color: '#06b6d4'
      },
      {
        id: 'schedule',
        label: 'Maintenance Schedule',
        description: 'View upcoming maintenance tasks',
        icon: '📅',
        color: '#f97316'
      },
      {
        id: 'vat-refunds',
        label: 'VAT Refunds',
        description: 'Track VAT refund claims and amounts',
        icon: '💵',
        color: '#14b8a6'
      }
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PageHeader title="Reports & Analytics" subtitle="Choose a report category to view detailed insights" />

        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Grid container spacing={3}>
            {reportCategories.map((category) => (
              <Grid item xs={12} sm={6} md={4} key={category.id}>
                <Card
                  onClick={() => navigate(`/reports/${category.id}`)}
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.15)',
                    },
                    borderTop: `4px solid ${category.color}`,
                  }}
                >
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{ fontSize: 48, mb: 2 }}>
                      {category.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {category.label}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {category.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader title="Reports & Analytics" subtitle="Detailed maintenance and financial insights" />

      {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}

      <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        <Tabs 
          value={activeTab} 
          onChange={(e, newValue) => {
            const tabRoutes = [
              '/reports/cost-analysis',
              '/reports/task-status',
              '/reports/vendor-performance',
              '/reports/maintenance-history',
              '/reports/monthly-costs',
              '/reports/area-maintenance',
              '/reports/schedule',
              '/reports/vat-refunds',
            ];
            navigate(tabRoutes[newValue]);
          }} 
          sx={{ mb: 3 }}
        >
          <Tab label="Cost Analysis" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Task Status" icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label="Vendor Performance" icon={<BarChartIcon />} iconPosition="start" />
          <Tab label="Maintenance History" icon={<TrendingUpIcon />} iconPosition="start" />
          <Tab label="Monthly Costs" icon={<DateRangeIcon />} iconPosition="start" />
          <Tab label="Area Maintenance" icon={<AssessmentIcon />} iconPosition="start" />
          <Tab label="Maintenance Schedule" icon={<DateRangeIcon />} iconPosition="start" />
          <Tab label="VAT Refunds" icon={<TrendingUpIcon />} iconPosition="start" />
        </Tabs>

        {/* Cost Analysis Tab */}
        {activeTab === 0 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Filter by Year:
                </Typography>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <StatisticsCards tasks={filteredTasks} yearFilter={yearFilter} />

            {/* Charts */}
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Cost Distribution by Property" />
                  <CardContent sx={{ height: 300, minHeight: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={costByProperty}
                          dataKey="actual"
                          nameKey="property"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {costByProperty.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#1565C0', '#2E7D32', '#F57C00', '#D32F2F', '#7B1FA2', '#C2185B'][index % 6]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => value.toLocaleString('is-IS')} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Cost by Task Type" />
                  <CardContent sx={{ height: 300, minHeight: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costByTaskType}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip formatter={(value) => value.toLocaleString('is-IS')} />
                        <Legend />
                        <Bar dataKey="actual" fill="#4CAF50" name="Actual Cost" />
                        <Bar dataKey="estimated" fill="#FFC107" name="Estimated Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Detailed Tables */}
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Cost by Property (Detailed)" />
                  <CardContent>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Tasks</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Cost</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {costByProperty.map((row) => (
                            <TableRow key={row.property}>
                              <TableCell>{row.property}</TableCell>
                              <TableCell align="right">{row.count}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>{row.actual.toLocaleString('is-IS')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Cost by Task Type (Detailed)" />
                  <CardContent>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Task Type</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Total Tasks</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Finished</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Actual Cost</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Estimated</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Avg (Finished)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {costByTaskType.map((row) => (
                            <TableRow key={row.type}>
                              <TableCell>{row.type}</TableCell>
                              <TableCell align="right">{row.count}</TableCell>
                              <TableCell align="right" sx={{ color: '#4CAF50', fontWeight: 600 }}>{row.finishedCount}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: '#4CAF50' }}>{row.actual.toLocaleString('is-IS')}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600, color: '#FFC107' }}>{row.estimated.toLocaleString('is-IS')}</TableCell>
                              <TableCell align="right">{row.average.toLocaleString('is-IS')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Task Status Tab */}
        {activeTab === 1 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Filter by Year:
                </Typography>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Pending"
                  value={taskStatusOverview.pending}
                  subtitle="Not started"
                  color="#FFC107"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="In Progress"
                  value={taskStatusOverview.in_progress}
                  subtitle="Currently working"
                  color="#2196F3"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Completed"
                  value={taskStatusOverview.finished}
                  subtitle="Finished tasks"
                  color="#2E7D32"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Completion Rate"
                  value={tasks.length > 0 
                    ? Math.round((taskStatusOverview.finished / tasks.length) * 100) + '%'
                    : '0%'}
                  subtitle="Of all tasks"
                  color="#FF5722"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Task Status Distribution" />
                  <CardContent sx={{ height: 300, minHeight: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Pending', value: taskStatusOverview.pending },
                            { name: 'In Progress', value: taskStatusOverview.in_progress },
                            { name: 'Completed', value: taskStatusOverview.finished },
                          ]}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          <Cell fill="#FFC107" />
                          <Cell fill="#2196F3" />
                          <Cell fill="#2E7D32" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Progress Metrics" />
                  <CardContent>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Completion Rate
                      </Typography>
                      <Box sx={{ width: '100%', height: 10, bgcolor: '#f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${tasks.length > 0 ? (taskStatusOverview.finished / tasks.length) * 100 : 0}%`,
                            bgcolor: '#2E7D32',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#2E7D32', mt: 1 }}>
                        {tasks.length > 0 
                          ? Math.round((taskStatusOverview.finished / tasks.length) * 100)
                          : 0}%
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Overall Progress Rate
                      </Typography>
                      <Box sx={{ width: '100%', height: 10, bgcolor: '#f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                        <Box
                          sx={{
                            height: '100%',
                            width: `${tasks.length > 0 ? ((taskStatusOverview.in_progress + taskStatusOverview.finished) / tasks.length) * 100 : 0}%`,
                            bgcolor: '#2196F3',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#2196F3', mt: 1 }}>
                        {tasks.length > 0
                          ? Math.round(((taskStatusOverview.in_progress + taskStatusOverview.finished) / tasks.length) * 100)
                          : 0}%
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Vendor Performance Tab */}
        {activeTab === 2 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Filter by Year:
                </Typography>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Total Vendors"
                  value={vendorPerformance.length}
                  subtitle="In database"
                  color="#9C27B0"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Tasks Completed"
                  value={Math.round(vendorPerformance.reduce((sum, v) => sum + (v.completed || 0), 0))}
                  subtitle="By all vendors"
                  color="#2196F3"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Avg Completion Rate"
                  value={vendorPerformance.length > 0
                    ? Math.round(
                        vendorPerformance.reduce((sum, v) => sum + (v.completionRate || 0), 0) /
                          vendorPerformance.length
                      ) + '%'
                    : '0%'}
                  subtitle="Vendor average"
                  color="#2E7D32"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Favorite Vendors"
                  value={vendorPerformance.filter(v => v.is_favorite).length}
                  subtitle="Marked as favorite"
                  color="#FF5722"
                />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Card>
                  <CardHeader title="Vendor Performance Overview" />
                  <CardContent sx={{ height: 400, minHeight: 400 }}>
                    {vendorPerformance.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={vendorPerformance.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="vendor" 
                            angle={-45} 
                            textAnchor="end" 
                            height={100}
                            interval={0}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => typeof value === 'number' ? value.toFixed(2) : value}
                          />
                          <Legend />
                          <Bar dataKey="total" fill="#1565C0" name="Total Cost (kr)" />
                          <Bar dataKey="completionRate" fill="#2E7D32" name="Completion Rate (%)" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Typography color="textSecondary">No vendor data available</Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardHeader title="Top Vendors by Cost" />
                  <CardContent>
                    {vendorPerformance
                      .sort((a, b) => b.total - a.total)
                      .slice(0, 5)
                      .map((vendor, index) => (
                        <Box key={index} sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {vendor.vendor}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#1565C0' }}>
                              {vendor.total.toLocaleString('is-IS', { maximumFractionDigits: 0 })} kr
                            </Typography>
                          </Box>
                          <Box sx={{ width: '100%', height: 8, bgcolor: '#f0f0f0', borderRadius: 1, overflow: 'hidden' }}>
                            <Box
                              sx={{
                                height: '100%',
                                width: `${vendorPerformance.length > 0 ? (vendor.total / Math.max(...vendorPerformance.map(v => v.total))) * 100 : 0}%`,
                                bgcolor: '#1565C0',
                              }}
                            />
                          </Box>
                        </Box>
                      ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Card sx={{ mt: 2 }}>
              <CardHeader title="All Vendors" />
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Vendor Name</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Total Cost (kr)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Tasks</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Completed</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>Completion Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vendorPerformance.map((vendor, index) => (
                      <TableRow key={index}>
                        <TableCell>{vendor.vendor}</TableCell>
                        <TableCell align="right">
                          {vendor.total.toLocaleString('is-IS', { maximumFractionDigits: 0 })} kr
                        </TableCell>
                        <TableCell align="right">{vendor.tasks}</TableCell>
                        <TableCell align="right">{vendor.completed}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#2E7D32' }}>
                          {vendor.completionRate}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>
        )}

        {/* Maintenance History Tab */}
        {activeTab === 3 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
                <Typography variant="body2" color="textSecondary" sx={{ fontWeight: 500 }}>
                  Filter by Year:
                </Typography>
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">All Years</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <StatCard 
                  title="Completed Maintenance Tasks"
                  value={maintenanceHistory.length}
                  color="#1565C0"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <StatCard 
                  title="Total Spent"
                  value={`${(maintenanceHistory.reduce((sum, t) => sum + (t.final_price || 0), 0)).toLocaleString('is-IS', { maximumFractionDigits: 0 })} kr`}
                  color="#4CAF50"
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <StatCard 
                  title="Properties Maintained"
                  value={new Set(filteredTasks.map(t => t.property)).size}
                  color="#FF9800"
                />
              </Grid>
            </Grid>

            <Card sx={{ mb: 2 }}>
              <CardHeader title="Recent Maintenance History" />
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Cost</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {maintenanceHistory.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell sx={{ fontSize: '0.9rem' }}>{task.property_name}</TableCell>
                        <TableCell sx={{ fontSize: '0.9rem', maxWidth: 300 }}>
                          <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.9rem' }}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('is-IS') : '-'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                          {(task.final_price || 0).toLocaleString('is-IS')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Box>
        )}

        {/* Monthly Costs Tab */}
        {activeTab === 4 && (
          <Box>
            <Card sx={{ mb: 2 }}>
              <CardHeader 
                title="Monthly Cost Analysis"
                action={
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body2" color="textSecondary">Select Year:</Typography>
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid #ddd',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="all">All Years</option>
                      {availableYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </Box>
                }
              />
              <CardContent sx={{ height: 400, minHeight: 400 }}>
                {monthlyCosts.some(m => m.cost > 0) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyCosts}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => value.toLocaleString('is-IS', { maximumFractionDigits: 0 })}
                        labelFormatter={(label) => `Month: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="cost" 
                        stroke="#1565C0" 
                        name="Cost (kr)"
                        strokeWidth={2}
                        dot={{ fill: '#1565C0', r: 5, cursor: 'pointer' }}
                        activeDot={{ r: 7 }}
                        onClick={(data) => {
                          if (data && data.payload) {
                            setSelectedMonth(data.payload.month);
                            setMonthModalOpen(true);
                          }
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="textSecondary" sx={{ textAlign: 'center', mt: 10 }}>
                    No data available for {yearFilter === 'all' ? 'all years' : yearFilter}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Monthly Summary" />
                  <CardContent>
                    <TableContainer sx={{ maxHeight: 400 }}>
                      <Table size="small" stickyHeader>
                        <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Month</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Cost (kr)</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Tasks</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {monthlyCosts.map((row) => (
                            <TableRow key={row.month} sx={{ backgroundColor: row.cost > 0 ? 'rgba(21, 101, 192, 0.05)' : 'transparent' }}>
                              <TableCell sx={{ fontWeight: 500 }}>{row.month}</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {row.cost.toLocaleString('is-IS', { maximumFractionDigits: 0 })}
                              </TableCell>
                              <TableCell align="right">{row.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardHeader title="Year Statistics" />
                  <CardContent>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Total Year Cost
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#1565C0' }}>
                        {monthlyCosts.reduce((sum, m) => sum + m.cost, 0).toLocaleString('is-IS', { maximumFractionDigits: 0 })} kr
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Total Tasks
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#2E7D32' }}>
                        {monthlyCosts.reduce((sum, m) => sum + m.count, 0)}
                      </Typography>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Average Monthly Cost
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#F57C00' }}>
                        {monthlyCosts.length > 0
                          ? (monthlyCosts.reduce((sum, m) => sum + m.cost, 0) / 12).toLocaleString('is-IS', { maximumFractionDigits: 0 })
                          : 0} kr
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                        Months with Activity
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: '#9C27B0' }}>
                        {monthlyCosts.filter(m => m.cost > 0).length} / 12
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Area Maintenance Tab */}
        {activeTab === 5 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Year Filter Card */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" color="textSecondary">Year:</Typography>
                  <select 
                    value={yearFilter} 
                    onChange={(e) => setYearFilter(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </Box>
              </CardContent>
            </Card>

            {/* Metric Cards */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Areas Needing Attention"
                  value={areaMaintenanceData.filter(a => a.open > 0).length}
                  color="#D32F2F"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Open Tasks"
                  value={areaMaintenanceData.reduce((sum, a) => sum + a.open, 0)}
                  color="#FF9800"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Completed in Areas"
                  value={areaMaintenanceData.reduce((sum, a) => sum + a.finished, 0)}
                  color="#4CAF50"
                />
              </Grid>
            </Grid>

            {/* Area Maintenance Bar Chart */}
            <Card sx={{ minHeight: 400 }}>
              <CardHeader title="Maintenance by Area" />
              <CardContent sx={{ minHeight: 350 }}>
                {areaMaintenanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={areaMaintenanceData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="area" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                      />
                      <YAxis />
                      <Tooltip formatter={(value) => value} />
                      <Legend />
                      <Bar dataKey="open" stackId="a" fill="#FF9800" name="Open" />
                      <Bar dataKey="finished" stackId="a" fill="#4CAF50" name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="textSecondary" align="center" sx={{ py: 10 }}>
                    No area data available
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Areas Detail Table */}
            <Card>
              <CardHeader title="Area Details" />
              <CardContent>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table stickyHeader size="small">
                    <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Area</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Open</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Completed</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {areaMaintenanceData.map((area, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{area.area}</TableCell>
                          <TableCell>{area.type}</TableCell>
                          <TableCell align="right" sx={{ color: area.open > 0 ? '#FF9800' : '#666' }}>
                            {area.open}
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#4CAF50' }}>
                            {area.finished}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {area.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Maintenance Schedule Tab */}
        {activeTab === 6 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Year Filter Card */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" color="textSecondary">Year:</Typography>
                  <select 
                    value={yearFilter} 
                    onChange={(e) => setYearFilter(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </Box>
              </CardContent>
            </Card>

            {/* Status Cards */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Pending"
                  value={upcomingMaintenanceSchedule.filter(t => t.status === 'pending').length}
                  color="#FFC107"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="In Progress"
                  value={upcomingMaintenanceSchedule.filter(t => t.status === 'in_progress').length}
                  color="#2196F3"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Due Within 7 Days"
                  value={upcomingMaintenanceSchedule.filter(t => t.daysUntilDue !== null && t.daysUntilDue <= 7 && t.daysUntilDue > 0).length}
                  color="#D32F2F"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Overdue"
                  value={upcomingMaintenanceSchedule.filter(t => t.daysUntilDue !== null && t.daysUntilDue <= 0).length}
                  color="#B71C1C"
                />
              </Grid>
            </Grid>

            {/* Upcoming Tasks Table */}
            <Card>
              <CardHeader title="Upcoming Tasks" />
              <CardContent>
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Due Date</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>Days</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Priority</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {upcomingMaintenanceSchedule.map((task) => (
                        <TableRow key={task.id} sx={{ 
                          backgroundColor: task.daysUntilDue !== null && task.daysUntilDue <= 0 ? '#ffebee' : 
                                         task.daysUntilDue !== null && task.daysUntilDue <= 7 ? '#fff3e0' : 'transparent'
                        }}>
                          <TableCell>{task.property_name}</TableCell>
                          <TableCell sx={{ maxWidth: 250 }}>
                            <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.description || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('is-IS') : '-'}
                          </TableCell>
                          <TableCell align="center">
                            {task.daysUntilDue !== null ? (
                              <Box sx={{ 
                                display: 'inline-block',
                                px: 1.5,
                                py: 0.5,
                                bgcolor: task.daysUntilDue <= 0 ? '#D32F2F' : 
                                        task.daysUntilDue <= 7 ? '#FF9800' : '#4CAF50',
                                color: '#fff',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                                fontWeight: 500,
                              }}>
                                {task.daysUntilDue <= 0 ? `${Math.abs(task.daysUntilDue)} overdue` : `${task.daysUntilDue}d`}
                              </Box>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ 
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.5,
                              bgcolor: task.status === 'in_progress' ? '#2196F3' : '#FFC107',
                              color: '#fff',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                            }}>
                              {task.status === 'in_progress' ? 'In Progress' : 'Pending'}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ 
                              display: 'inline-block',
                              px: 1.5,
                              py: 0.5,
                              bgcolor: task.priority === 'high' ? '#D32F2F' : 
                                      task.priority === 'medium' ? '#FF9800' : '#4CAF50',
                              color: '#fff',
                              borderRadius: '4px',
                              fontSize: '0.85rem',
                              fontWeight: 500,
                            }}>
                              {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1) || '-'}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {upcomingMaintenanceSchedule.length === 0 && (
                  <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                    No upcoming tasks for {yearFilter === 'all' ? 'all years' : yearFilter}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        )}

        {/* VAT Refund Status Tab */}
        {activeTab === 7 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Year Filter Card */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Typography variant="body2" color="textSecondary">Year:</Typography>
                  <select 
                    value={yearFilter} 
                    onChange={(e) => setYearFilter(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="all">All Years</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </Box>
              </CardContent>
            </Card>

            {/* Status Cards */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Refunds Pending"
                  value={refundStatusData.notClaimed}
                  color="#FF9800"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Refunds Claimed"
                  value={refundStatusData.claimed}
                  color="#4CAF50"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Est. Refund Amount"
                  value={`${refundStatusData.estimatedRefundAmount.toLocaleString('is-IS')} kr`}
                  color="#1976D2"
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <StatCard 
                  title="Total VAT (24%)"
                  value={`${refundStatusData.refundableAmount.toLocaleString('is-IS')} kr`}
                  color="#7B1FA2"
                />
              </Grid>
            </Grid>

            {/* Refund Status Pie Chart */}
            <Card sx={{ minHeight: 400 }}>
              <CardHeader title="Refund Status Distribution" />
              <CardContent sx={{ minHeight: 350 }}>
                {refundStatusData.notClaimed + refundStatusData.claimed > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Pending', value: refundStatusData.notClaimed },
                          { name: 'Claimed', value: refundStatusData.claimed },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        <Cell fill="#FF9800" />
                        <Cell fill="#4CAF50" />
                      </Pie>
                      <Tooltip formatter={(value) => value} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography color="textSecondary" align="center" sx={{ py: 10 }}>
                    No completed tasks with refund data
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Refund Tasks Table */}
            <Card>
              <CardHeader title="Finished Tasks with Refund Status" />
              <CardContent>
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table stickyHeader size="small">
                    <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>VAT Amount (24%)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Refund Amount (35%)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTasks
                        .filter(task => task.status === 'finished' && task.price_breakdown && task.price_breakdown.length > 0)
                        .map((task) => {
                          const workItems = task.price_breakdown.filter(item => item.category === 'work' && item.vat_refundable);
                          const vatAmount = workItems.reduce((sum, item) => sum + Math.round((item.amount || 0) * 0.24), 0);
                          const estimatedRefund = Math.round(vatAmount * 0.35);
                          
                          if (vatAmount === 0) return null;
                          
                          return (
                            <TableRow key={task.id}>
                              <TableCell>{properties.find(p => p.id === task.property)?.name || `Property ${task.property}`}</TableCell>
                              <TableCell sx={{ maxWidth: 200 }}>
                                <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {task.description || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {vatAmount.toLocaleString('is-IS')} kr
                              </TableCell>
                              <TableCell>
                                <Box sx={{ 
                                  display: 'inline-block',
                                  px: 1.5,
                                  py: 0.5,
                                  bgcolor: task.vat_refund_claimed ? '#4CAF50' : '#FF9800',
                                  color: '#fff',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  fontWeight: 500,
                                }}>
                                  {task.vat_refund_claimed ? 'Claimed' : 'Pending'}
                                </Box>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {estimatedRefund.toLocaleString('is-IS')} kr
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Box>
        )}

        {/* Month Tasks Modal */}
        <Dialog 
          open={monthModalOpen} 
          onClose={() => setMonthModalOpen(false)} 
          maxWidth="md" 
          fullWidth
        >
          <DialogTitle>
            Tasks for {selectedMonth} {yearFilter === 'all' ? new Date().getFullYear() : yearFilter}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {monthTasks.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Property</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Task</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Vendor</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Cost (kr)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {monthTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>{task.property_name}</TableCell>
                        <TableCell sx={{ maxWidth: 300 }}>
                          <Typography sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {task.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>{task.vendor_name}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {(task.final_price || 0).toLocaleString('is-IS')}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ backgroundColor: '#f9f9f9', fontWeight: 700 }}>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 700 }}>
                        Total:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: '#1565C0' }}>
                        {monthTasks.reduce((sum, t) => sum + (t.final_price || 0), 0).toLocaleString('is-IS')}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="textSecondary" align="center" sx={{ py: 3 }}>
                No tasks for {selectedMonth} {yearFilter === 'all' ? new Date().getFullYear() : yearFilter}
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setMonthModalOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default Reports;
