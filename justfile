# Justfile for Property Maintenance Project
# Install just: https://github.com/casey/just#installation

# Set shell for Windows
set windows-shell := ["cmd", "/c"]

# Default recipe (run with just)
default:
    @just --list

# Django Backend Commands
migrate:
    python manage.py migrate

makemigrations:
    python manage.py makemigrations

shell:
    python manage.py shell

createsuperuser:
    python manage.py createsuperuser

collectstatic:
    python manage.py collectstatic

# Frontend Commands
frontend-install:
    cd frontend && npm install

frontend-start:
    cd frontend && npm run dev

frontend-build:
    cd frontend && npm run build

# Development Commands
start-backend:
    python manage.py runserver

start-frontend:
    cd frontend && npm run dev

start:
    @echo "Starting both servers..."
    start /B python manage.py runserver
    timeout /t 2 /nobreak > nul
    cd frontend && npm run dev

stop:
    @echo "Stopping all servers..."
    -taskkill /F /IM python.exe /T 2>nul
    -taskkill /F /IM node.exe /T 2>nul
    @echo "All servers stopped."
reset-db:
    python manage.py flush
    python manage.py migrate

backup-db:
    python manage.py dumpdata > backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%.json

restore-db FILE:
    python manage.py loaddata {{FILE}}

# Testing
test-backend:
    python manage.py test

test-frontend:
    cd frontend && "C:\Program Files\nodejs\npm.cmd" test

# Cleanup
clean:
    if exist __pycache__ rmdir /s /q __pycache__
    del /s /q *.pyc
    cd frontend && if exist node_modules rmdir /s /q node_modules
    cd frontend && if exist package-lock.json del package-lock.json

# Setup
setup: setup-backend setup-frontend

setup-backend:
    python -m venv venv
    call venv\Scripts\activate && pip install -r requirements.txt

setup-frontend:
    cd frontend && npm install

# Deployment
build-frontend:
    cd frontend && npm run build

# Utility
fmt:
    echo "Formatting not configured"
    cd frontend && echo "Frontend formatting not configured"

lint:
    echo "Linting not configured"
    cd frontend && echo "Frontend linting not configured"