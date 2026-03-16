import React, { useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
} from '@mui/material';

const StatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color, 
  onClick,
  modalTitle,
  modalData,
  modalColumns,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleCardClick = () => {
    if (modalData && modalData.length > 0) {
      setModalOpen(true);
    } else if (onClick) {
      onClick();
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  return (
    <>
      <Card
        sx={{
          height: '100%',
          minHeight: 140,
          borderTop: `3px solid ${color}`,
          display: 'flex',
          flexDirection: 'column',
          cursor: (onClick || modalData) ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          '&:hover': (onClick || modalData) ? {
            boxShadow: 3,
            transform: 'translateY(-4px)',
          } : {},
        }}
        onClick={handleCardClick}
      >
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

      {/* Modal for displaying data */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>{modalTitle || title}</DialogTitle>
        <DialogContent>
          {modalData && modalData.length > 0 ? (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableRow>
                    {modalColumns && modalColumns.map((col) => (
                      <TableCell 
                        key={col.field}
                        align={col.align || 'left'}
                        sx={{ fontWeight: 700 }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {modalData.map((item, idx) => (
                    <TableRow key={item.id || idx}>
                      {modalColumns && modalColumns.map((col) => (
                        <TableCell key={col.field} align={col.align || 'left'}>
                          {col.render ? col.render(item[col.field], item) : item[col.field]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="textSecondary">No data available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

/**
 * Calculates statistics from tasks
 * @param {Array} tasks - Array of task objects
 * @param {Number} yearFilter - Year to filter by (or 'all')
 * @returns {Object} Statistics object with calculated values
 */
export const calculateStatistics = (tasks = [], yearFilter = 'all') => {
  // Format number with dots as thousand separators (Icelandic format)
  const formatPrice = (num) => {
    return Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Filter tasks by year if needed
  let filteredTasks = tasks;
  if (yearFilter !== 'all') {
    const year = parseInt(yearFilter);
    filteredTasks = tasks.filter(t => {
      if (!t.due_date && !t.created_date) return false;
      const taskDate = new Date(t.due_date || t.created_date);
      return taskDate.getFullYear() === year;
    });
  }

  // Open work orders
  const openWorkOrders = filteredTasks.filter(t => t.status !== 'finished').length;

  // Possible VAT refund: 35% of (24% VAT of work price) for finished unclaimed tasks
  const finishedUnclaimedTasks = filteredTasks.filter(
    t => t.status === 'finished' && !t.vat_refund_claimed
  );
  const totalVatRefundablePrice = finishedUnclaimedTasks.reduce((sum, t) => {
    if (t.price_breakdown && Array.isArray(t.price_breakdown)) {
      const vatRefundable = t.price_breakdown
        .filter(item => item.category === 'work' && item.vat_refundable)
        .reduce((itemSum, item) => itemSum + (parseFloat(item.amount) || 0), 0);
      return sum + vatRefundable;
    }
    return sum;
  }, 0);
  const possibleRefund = Math.floor(totalVatRefundablePrice * 0.24 * 0.35);

  // Total investment: sum of final_price for finished tasks
  const totalInvestment = filteredTasks
    .filter(t => t.status === 'finished')
    .reduce((sum, t) => sum + (parseFloat(t.final_price) || 0), 0);

  // Total estimated cost: sum of estimated_price for unfinished tasks
  const totalEstimatedCost = filteredTasks
    .filter(t => t.status !== 'finished')
    .reduce((sum, t) => sum + (parseFloat(t.estimated_price) || 0), 0);

  return {
    openWorkOrders,
    possibleRefund,
    totalInvestment,
    totalEstimatedCost,
    formatPrice,
  };
};

/**
 * Statistics Cards Component
 * Displays the 4 key statistic cards
 * @param {Array} tasks - Array of task objects
 * @param {Number} yearFilter - Year to filter by (or 'all')
 * @param {Object} callbacks - Object with onClick handlers for each card
 */
const StatisticsCards = ({ tasks = [], yearFilter = 'all', callbacks = {} }) => {
  const stats = calculateStatistics(tasks, yearFilter);

  // Filter tasks by year for modal data
  let filteredTasksForModal = tasks;
  if (yearFilter !== 'all') {
    const year = parseInt(yearFilter);
    filteredTasksForModal = tasks.filter(t => {
      if (!t.due_date && !t.created_date) return false;
      const taskDate = new Date(t.due_date || t.created_date);
      return taskDate.getFullYear() === year;
    });
  }

  // Add property_name if not present
  filteredTasksForModal = filteredTasksForModal.map(t => ({
    ...t,
    property_name: t.property_name || `Property ${t.property}`,
  }));

  const cardsConfig = [
    {
      title: 'Open Work Orders',
      value: stats.openWorkOrders,
      subtitle: 'Not finished',
      color: '#2196f3',
      key: 'openWorkOrders',
      modalTitle: 'Open Work Orders',
      modalData: filteredTasksForModal.filter(t => t.status !== 'finished'),
      modalColumns: [
        { field: 'property_name', label: 'Property' },
        { field: 'description', label: 'Task', render: (val) => val || '-' },
        { field: 'due_date', label: 'Due Date', render: (val) => val ? new Date(val).toLocaleDateString('is-IS') : '-' },
        { field: 'status', label: 'Status', render: (val) => val ? val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '-' },
      ]
    },
    {
      title: 'Possible VAT Refund',
      value: `${stats.formatPrice(stats.possibleRefund)} Kr.`,
      subtitle: '35% of VAT (24%)',
      color: '#4caf50',
      key: 'possibleRefund',
      modalTitle: 'Refundable Work Items',
      modalData: filteredTasksForModal.filter(t => t.status === 'finished' && !t.vat_refund_claimed && t.price_breakdown && Array.isArray(t.price_breakdown) && t.price_breakdown.some(item => item.category === 'work' && item.vat_refundable)),
      modalColumns: [
        { field: 'property_name', label: 'Property' },
        { field: 'description', label: 'Task', render: (val) => val || '-' },
        { field: 'final_price', label: 'Price', align: 'right', render: (val) => val ? formatPrice(val) + ' kr' : '' },
      ]
    },
    {
      title: 'Total Investment',
      value: `${stats.formatPrice(stats.totalInvestment)} Kr.`,
      subtitle: 'Finished tasks',
      color: '#ff9800',
      key: 'totalInvestment',
      modalTitle: 'Finished Tasks',
      modalData: filteredTasksForModal.filter(t => t.status === 'finished'),
      modalColumns: [
        { field: 'property_name', label: 'Property' },
        { field: 'description', label: 'Task', render: (val) => val || '-' },
        { field: 'due_date', label: 'Completed Date', render: (val) => val ? new Date(val).toLocaleDateString('is-IS') : '-' },
        { field: 'final_price', label: 'Cost', align: 'right', render: (val) => val ? formatPrice(val) + ' kr' : '' },
      ]
    },
    {
      title: 'Total Estimated Cost',
      value: `${stats.formatPrice(stats.totalEstimatedCost)} Kr.`,
      subtitle: 'Unfinished tasks',
      color: '#f44336',
      key: 'totalEstimatedCost',
      modalTitle: 'Unfinished Tasks',
      modalData: filteredTasksForModal.filter(t => t.status !== 'finished'),
      modalColumns: [
        { field: 'property_name', label: 'Property' },
        { field: 'description', label: 'Task', render: (val) => val || '-' },
        { field: 'due_date', label: 'Due Date', render: (val) => val ? new Date(val).toLocaleDateString('is-IS') : '-' },
        { field: 'estimated_price', label: 'Estimated Cost', align: 'right', render: (val) => val ? formatPrice(val) + ' kr' : '' },
      ]
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {cardsConfig.map((card) => (
        <Grid item xs={12} sm={6} md={3} key={card.key}>
          <StatCard
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            color={card.color}
            onClick={callbacks[card.key]}
            modalTitle={card.modalTitle}
            modalData={card.modalData}
            modalColumns={card.modalColumns}
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatisticsCards;
export { StatCard };
