import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';

const StatCard = ({ title, value, subtitle, icon: Icon, color, onClick }) => {
  return (
    <Card
      sx={{
        height: '100%',
        minHeight: 140,
        borderTop: `3px solid ${color}`,
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': onClick ? {
          boxShadow: 3,
          transform: 'translateY(-4px)',
        } : {},
      }}
      onClick={onClick}
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

  const cardsConfig = [
    {
      title: 'Open Work Orders',
      value: stats.openWorkOrders,
      subtitle: 'Not finished',
      color: '#2196f3',
      key: 'openWorkOrders',
    },
    {
      title: 'Possible VAT Refund',
      value: `${stats.formatPrice(stats.possibleRefund)} Kr.`,
      subtitle: '35% of VAT (24%)',
      color: '#4caf50',
      key: 'possibleRefund',
    },
    {
      title: 'Total Investment',
      value: `${stats.formatPrice(stats.totalInvestment)} Kr.`,
      subtitle: 'Finished tasks',
      color: '#ff9800',
      key: 'totalInvestment',
    },
    {
      title: 'Total Estimated Cost',
      value: `${stats.formatPrice(stats.totalEstimatedCost)} Kr.`,
      subtitle: 'Unfinished tasks',
      color: '#f44336',
      key: 'totalEstimatedCost',
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
          />
        </Grid>
      ))}
    </Grid>
  );
};

export default StatisticsCards;
export { StatCard };
