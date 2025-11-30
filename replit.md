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
The application utilizes a multi-theme system with "Dark Neon" (default, Car Dashboard Aesthetic), "Simple Light," and "B/W Neon" themes. All themes incorporate animated car emojis, diverse fonts for goal sections, and consistent animations (goal-flip, money-bounce, float-glow, slide-up-fade). UI components, including receipt uploads and form fields, adapt dynamically to the selected theme.

### Technical Implementations
Core functionalities include a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit entries via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for optimal profit. The system also includes OAuth integration for Uber Eats and Shipt for automatic order syncing, background jobs for hourly order synchronization, duplicate prevention for synced orders, and a transaction search feature. Data can be exported to CSV format, including summary statistics and all transactions.

### System Design Choices
The backend is built with FastAPI (Python 3.11) and SQLite (SQLAlchemy ORM) for rapid development. The frontend uses React 18 with TypeScript, Vite, and Tailwind CSS, focusing on a mobile-first experience. State management is handled by TanStack React Query and a Theme Context API. A three-theme system is implemented with configurations in `lib/themes.ts` and persistence via localStorage. Data storage uses signed amounts for expenses and cancellations within a unified entry ledger. Real-time profit calculations are dynamic. Secure OAuth 2.0 implementation is used for platform integrations, with APScheduler managing hourly background sync jobs. A dedicated sync service standardizes platform-specific order data into Entry records.

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