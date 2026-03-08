import React, { useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths } from 'date-fns';
import enUS from 'date-fns/locale/en-US';
import { Box, Typography, useTheme, Button, Paper } from '@mui/material';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './TaskCalendar.css';
import TaskDetailModal from './TaskDetailModal';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const TaskCalendar = ({ tasks = [] }) => {
  const theme = useTheme();
  const [selectedTask, setSelectedTask] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Transform tasks into calendar events
  const events = useMemo(() => {
    return tasks.filter(task => task.due_date).map(task => ({
      id: task.id,
      title: task.description?.substring(0, 30) || 'Task',
      start: new Date(task.due_date),
      end: new Date(task.due_date),
      resource: task,
    }));
  }, [tasks]);

  // Custom styles for events based on task status
  const eventStyleGetter = (event) => {
    let backgroundColor = '#2196f3'; // default
    
    if (event.resource.status === 'finished') {
      backgroundColor = '#4caf50';
    } else if (event.resource.status === 'in_progress') {
      backgroundColor = '#ff9800';
    } else if (event.resource.status === 'pending') {
      backgroundColor = '#f44336';
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '0.75rem',
        padding: '2px 4px',
        fontWeight: 500,
      },
    };
  };

  const handleSelectEvent = (event) => {
    setSelectedTask(event.resource);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handlePrevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Calendar Header with Navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Button 
          size="small" 
          onClick={handlePrevMonth}
          sx={{ minWidth: 'auto', p: 0.5 }}
        >
          <ChevronLeftIcon sx={{ fontSize: 24 }} />
        </Button>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 120, textAlign: 'center' }}>
          {format(currentDate, 'MMMM yyyy')}
        </Typography>
        <Button 
          size="small" 
          onClick={handleNextMonth}
          sx={{ minWidth: 'auto', p: 0.5 }}
        >
          <ChevronRightIcon sx={{ fontSize: 24 }} />
        </Button>
      </Box>

      {/* Calendar Grid */}
      <Box sx={{ flex: 1, minHeight: 350 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventStyleGetter}
          popup
          views={['month']}
          defaultView='month'
          toolbar={false}
          date={currentDate}
          onNavigate={setCurrentDate}
        />
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', pt: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, backgroundColor: '#f44336', borderRadius: '2px' }} />
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Pending</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, backgroundColor: '#ff9800', borderRadius: '2px' }} />
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>In Progress</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, backgroundColor: '#4caf50', borderRadius: '2px' }} />
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>Finished</Typography>
        </Box>
      </Box>

      {/* Task Detail Modal */}
      <TaskDetailModal 
        open={modalOpen}
        task={selectedTask}
        onClose={handleCloseModal}
      />
    </Box>
  );
};

export default TaskCalendar;
