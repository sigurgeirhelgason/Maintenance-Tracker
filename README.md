# Property Maintenance Management System

A full-stack web application for managing property maintenance tasks with Django backend and React frontend.

## Features

- **Properties**: Manage multiple properties with components
- **Components**: Manage property components (roof, plumbing, electrical, etc.)
- **Maintenance Tasks**: Schedule recurring maintenance tasks with due dates
- **Work Orders**: Record completed maintenance work with costs and vendors
- **Vendors**: Manage contractor and vendor information
- **Attachments**: Upload and store files (invoices, images) for work orders
- **API**: RESTful API for all models with filtering
- **Navigation**: Dashboard, Properties, Components, Tasks, Work Orders, Vendors
- **Modern UI**: React frontend with Material-UI components

## Tech Stack

- **Backend**: Django 5.2, Django REST Framework, SQLite
- **Frontend**: React 18, Vite, Material-UI, Axios
- **Build Tool**: Vite (instead of Create React App)
- **API**: RESTful with filtering and CRUD operations

## Development Commands

This project uses [just](https://github.com/casey/just) for development commands.

### Available Commands
```bash
just                    # Show all available commands

# Server Commands
just start-backend      # Start Django server (http://localhost:8000)
just start-frontend     # Start Vite dev server (http://localhost:3000)
just start-all          # Start both servers simultaneously

# Database Commands
just migrate            # Run database migrations
just makemigrations     # Create new migrations
just reset-db           # Reset database (flush + migrate)
just backup-db          # Backup database to JSON
just restore-db FILE    # Restore database from JSON file

# Django Management
just shell              # Open Django shell
just createsuperuser    # Create admin user
just collectstatic      # Collect static files

# Frontend Setup
just frontend-install   # Install frontend dependencies
just build-frontend     # Build frontend for production

# Testing
just test-backend       # Run Django tests
just test-frontend      # Run frontend tests

# Cleanup & Maintenance
just clean              # Remove __pycache__, .pyc files, node_modules
just fmt                # Format code (not configured)
just lint               # Lint code (not configured)

# Initial Setup
just setup              # Initial setup (venv + dependencies + frontend install)
```

### Quick Start
```bash
# Set up PATH for just commands (run once per session)
.\setup-path.ps1

# Or manually:
$env:Path += ";$PWD"

# First time setup
just setup

# Start development
just start-all

# Database operations
just makemigrations
just migrate
```

### Frontend Development (Vite)
```bash
cd frontend

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Alternative: Batch File
If just has issues with npm PATH, use the included `run-dev.bat`:
```bash
run-dev.bat backend     # Start Django
run-dev.bat frontend    # Start Vite
run-dev.bat migrate     # Run migrations
```

## Usage

- Backend API runs on `http://localhost:8000`
- Frontend runs on `http://localhost:3000`
- Access dashboard at `/` (frontend)
- API endpoints at `/api/*` (backend)
- Admin interface at `/admin/` (backend)

## API Endpoints

- `/api/properties/` - Property CRUD
- `/api/components/` - Component CRUD
- `/api/tasks/` - Maintenance Task CRUD
- `/api/workorders/` - Work Order CRUD
- `/api/vendors/` - Vendor CRUD
- `/api/attachments/` - Attachment CRUD

## Development

- Backend: Django with DRF for API, automatic recurrence scheduling
- Frontend: React with hooks, Material-UI for components
- CORS enabled for frontend-backend communication

## Technologies

- Django 5.2.7
- Django REST Framework 3.16.1
- django-filter 25.2
- SQLite (default database)
- React 18.2.0
- Vite 5.0.0
- Material-UI 5.14.20
- Axios 1.7.0
- React Router 6.20.1

## Notes

This project was developed with assistance from AI tools (GitHub Copilot).