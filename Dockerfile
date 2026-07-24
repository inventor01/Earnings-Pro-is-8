# Public web domain serves the marketing/landing site (landing/), NOT the old
# React webapp under frontend/. The backend serves the build at /app/dist.
#
# The landing site is PRE-BUILT and committed at landing/dist (Railway's
# builder failed npm ci repeatedly, so no node build stage here).
# Rebuild with `cd landing && npm run build` before pushing landing changes.
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn
COPY backend/ ./backend/
COPY landing/dist ./dist

EXPOSE 8000
ENV PYTHONUNBUFFERED=1
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "120", "backend.app:app"]
