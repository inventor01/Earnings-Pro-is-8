# Delivery Driver Earnings Dashboard

## Overview
A mobile-first web application enabling delivery drivers to track earnings, expenses, mileage, and profit across various gig platforms (DoorDash, UberEats, Instacart, GrubHub). The application aims to provide real-time financial insights, including revenue, expenses, profit, miles, $/mile, and $/hour, with data filterable by multiple time periods. It also features AI-powered earning suggestions to optimize driver income. The user interface has been recently redesigned with a "Car Dashboard Aesthetic," featuring neon-glowing KPIs, animated elements, and enhanced goal tracking.

## User Preferences
- Mobile-first design is priority #1
- Clean, Shopify-like aesthetic with Tailwind CSS
- Large touch targets for mobile usability
- Calculator-style input preferred over traditional forms

## System Architecture

### UI/UX Decisions
The application features a "Car Dashboard Aesthetic" with a dark gradient background, neon-glowing KPI gauges, and a monospace font for a digital feel. Animated car emojis, goal sections with diverse fonts (Poppins, Space Grotesk, Outfit), and subtle animations (goal-flip, money-bounce, float-glow, slide-up-fade) enhance the visual experience. Receipt upload sections have a colorful gradient background with a cloud icon and hover animations. Form fields are reordered for better UX (Category → Note → Receipt).

### Technical Implementations
The application provides a calculator-style input with add/subtract modes, real-time KPI dashboards with profit goal tracking, and time period filtering. It supports multi-platform data entry (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other), expense tracking with emoji categories, and receipt image uploads. GPS trip tracking automatically calculates distance. Users can mass select and bulk delete entries, reset daily or all data, and edit any entry via a modal sidebar. Profit goals are visually tracked with progress bars and celebratory messages. AI-powered earning suggestions provide recommendations for minimum order amounts, peak earning hours, and cost-saving strategies.

### Feature Specifications
- Calculator-style input with Add/Subtract modes.
- Real-time KPI dashboard with profit goal tracking and automatic daily rollover.
- Multi-platform support (DoorDash, UberEats, Instacart, GrubHub, Shipt, Other).
- Expense tracking with emoji-enhanced categories and receipt image upload.
- Mileage cost calculation and GPS trip tracking.
- Settings management with profit goal configuration.
- Mass select and bulk delete for entries.
- Daily data reset and "Reset All Data" features.
- Automatic date detection with notifications.
- Full CRUD operations for entries, including a modal sidebar for editing.
- AI Earning Suggestions based on driver data for optimal profit.

### System Design Choices
- **Backend**: FastAPI (Python 3.11) with SQLite (SQLAlchemy ORM) for simplicity and rapid MVP development.
- **Frontend**: React 18 with TypeScript, Vite, and Tailwind CSS for a modern, mobile-first web experience.
- **State Management**: TanStack React Query.
- **Data Storage**: Signed amounts for expenses and cancellations stored as negative values for simplified aggregation.
- **Unified Entry Ledger**: A single database table for all transaction types (ORDER, BONUS, EXPENSE, CANCELLATION) using an enum.
- **Real-Time Calculations**: Profit is dynamically calculated as revenue minus logged expenses.

## External Dependencies
- **OpenAI GPT-4o-mini**: Utilized via Replit AI Integrations for AI Earning Suggestions.
- **Tailwind CSS**: For styling and responsive design.
- **TanStack React Query**: For state management in the frontend.
- **FastAPI**: Python web framework for the backend.
- **SQLAlchemy**: ORM for interacting with the SQLite database.
- **Uvicorn**: ASGI server for the FastAPI backend.
- **Vite**: Frontend build tool.