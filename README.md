# Cyberskills Student Management System

Full-stack web application for managing students, programmes, modules, enrollments, and grades. Built as a Final Year Project to replace spreadsheet-based workflows with a centralized database and role-based web UI.

**Author:** [Kiaran Hurley](https://github.com/kiaranhurley) · R00228237

## Features

- **Administrator dashboard** — student directory, programmes, modules, enrollments, grades, reports, user management, audit log
- **Lecturer portal** — assigned modules, class lists, grade entry
- **Student portal** — read-only view of own enrollments and results
- **REST API** — JWT authentication, role-based permissions, OpenAPI/Swagger docs
- **Data migration** — management commands to import curriculum CSV and Excel exports
- **Automated tests** — 130+ pytest tests (models, API, permissions, migration)

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Backend | Python, Django 4.2, Django REST Framework, PostgreSQL |
| Frontend | React, TypeScript, Vite, Material UI |
| Auth | JWT (`djangorestframework-simplejwt`) |
| Testing | pytest, pytest-django |

## Quick start

### Backend

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# Edit .env with database credentials and SECRET_KEY
python manage.py migrate
python manage.py create_roles
python manage.py load_programmes
python manage.py createsuperuser
python manage.py runserver
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** and sign in.

### Tests

```powershell
python -m pytest -q -W ignore
```

Set `USE_SQLITE_FALLBACK=true` in `.env` to run tests without PostgreSQL.

## Project structure

```
├── accounts/       # Users, roles, JWT auth
├── students/       # Student profiles
├── courses/        # Programmes and modules
├── enrollments/    # Enrollments and dashboard API
├── grades/         # Results and grades
├── config/         # Django settings
├── frontend/       # React application
└── data/           # Curriculum CSV seed data
```

## API documentation

With the server running: **http://localhost:8000/api/schema/swagger-ui/**

## License

This project was developed for academic assessment at MTU. Contact the author before commercial use.
