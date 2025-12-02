# Delivery Driver Earnings Dashboard

## Overview
A mobile-first web application designed for delivery drivers to track earnings, expenses, mileage, and profit across various gig platforms (DoorDash, UberEats, Instacart, GrubHub). It provides real-time financial insights, including revenue, expenses, profit, miles, $/mile, and $/hour, with data filterable by multiple time periods. The application also features AI-powered earning suggestions and a "Car Dashboard Aesthetic" UI with neon-glowing KPIs and animated elements to optimize driver income and enhance goal tracking.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application utilizes a multi-theme system with "Dark Neon" (default, Car Dashboard Aesthetic), "Simple Light," and "B/W Neon" themes. All themes incorporate animated car emojis, diverse fonts for goal sections, and consistent animations (goal-flip, money-bounce, float-glow, slide-up-fade). UI components, including receipt uploads and form fields, adapt dynamically to the selected theme. Features include calculator-style input, real-time KPI dashboards, profit goal tracking with progress bars and celebratory alerts, multi-platform data entry, expense tracking with emoji categories, and receipt image uploads. It also supports GPS trip tracking, mass selection and bulk deletion of entries, and CSV export.

### Technical Implementations
Core functionalities include a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit entries via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for optimal profit. The system also includes OAuth integration for Uber Eats and Shipt for automatic order syncing, background jobs for hourly order synchronization, duplicate prevention for synced orders, and a transaction search feature. Data can be exported to CSV format, including summary statistics and all transactions.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLite (SQLAlchemy ORM). The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A three-theme system is implemented with configurations in `lib/themes.ts` and persistence via localStorage. Data storage uses signed amounts for expenses and cancellations within a unified entry ledger. Real-time profit calculations are dynamic. Secure OAuth 2.0 implementation is used for platform integrations, with APScheduler managing hourly background sync jobs. A dedicated sync service standardizes platform-specific order data into Entry records. Passwords are secured using bcrypt hashing.

## External Dependencies
- **OpenAI GPT-4o-mini**: For AI Earning Suggestions.
- **Tailwind CSS**: For styling and responsive design.
- **TanStack React Query**: For frontend state management.
- **FastAPI**: Python web framework for the backend.
- **SQLAlchemy**: ORM for SQLite database interaction.
- **Uvicorn**: ASGI server for the FastAPI backend.
- **Vite**: Frontend build tool.
- **APScheduler**: Background job scheduler for periodic order syncing.
- **httpx**: Async HTTP client for API calls to Uber and Shipt platforms.
- **bcrypt**: For secure password hashing.
- **pytz**: For accurate timezone conversions in backend data generation.
- **aiosmtplib**: For sending password reset emails asynchronously.

## Email Configuration (Password Reset)
To enable password reset emails, set the following environment variables:
- **SMTP_HOST**: SMTP server hostname (default: smtp.gmail.com)
- **SMTP_PORT**: SMTP server port (default: 587)
- **SMTP_USER**: Email address to send from
- **SMTP_PASSWORD**: Email account password or app-specific password
- **FROM_EMAIL**: (optional) From email address if different from SMTP_USER

For Gmail, you'll need to:
1. Enable 2-Factor Authentication
2. Generate an App Password at https://myaccount.google.com/apppasswords
3. Use that App Password as SMTP_PASSWORD

Without SMTP credentials configured, reset links are logged to the console for development purposes.

## Recent Changes (December 2, 2025)
- Added default daily/weekly/monthly goals for new user signups (regular users now get default goals like demo users)
- Implemented password reset functionality with secure token-based reset flow
- Added PasswordResetToken model for secure password recovery
- Created email service for sending password reset emails (requires SMTP configuration)