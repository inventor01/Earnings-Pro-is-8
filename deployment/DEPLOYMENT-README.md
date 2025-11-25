# Deployment Guide

This folder contains all the files needed to deploy the Delivery Driver Earnings Dashboard application.

## Files in this Folder

- **Dockerfile** - Multi-stage Docker build configuration
- **start.sh** - Startup script that runs both backend and frontend
- **requirements.txt** - Python backend dependencies
- **package.json** - Node.js frontend dependencies
- **package-lock.json** - Locked versions for frontend dependencies
- **.dockerignore** - Docker build exclusions
- **DEPLOYMENT-README.md** - This file

## Deployment Instructions

### For Railway (or any Docker-based platform):

1. Connect your GitHub repository to Railway
2. Set these environment variables in Railway:
   - `SESSION_SECRET` - A secure random string
   - Any other secrets needed for OAuth integrations

3. Configure Railway to use this Dockerfile
4. Deploy!

### Local Docker Testing:

```bash
# Build the image
docker build -t earnings-dashboard .

# Run the container
docker run -p 5000:5000 -p 8000:8000 earnings-dashboard
```

The application will be available at:
- Frontend: http://localhost:5000
- Backend API: http://localhost:8000

## Important Notes

- The Dockerfile uses a multi-stage build that:
  1. Builds the frontend (React with Vite)
  2. Installs Python dependencies
  3. Copies the compiled frontend to be served by Python
  4. Runs both services on startup

- Frontend is built once during Docker build for production efficiency
- Backend runs on port 8000
- Frontend static files served on port 5000

## Environment Variables

Required:
- `SESSION_SECRET` - For session management

Optional:
- `DATABASE_URL` - If using external database
- `OPENAI_API_KEY` - For AI features (can be managed via integrations)

## Troubleshooting

If the build fails:
1. Ensure all source code folders (backend, frontend) exist in the root directory
2. Check that requirements.txt and package.json are valid
3. Verify the start.sh script has correct paths

The frontend directory structure should have all source files needed to build.
