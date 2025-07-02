# Deployment Guide for Task Tracker

This guide explains how to deploy the Task Tracker application on Render with separate frontend and backend services.

## Prerequisites

- Render account
- MongoDB database (MongoDB Atlas recommended)
- GitHub repository with your code

## Backend Deployment

### 1. Create Backend Service on Render

1. Go to your Render dashboard
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `task-tracker-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend` (if your backend is in a subdirectory)

### 2. Environment Variables

Add these environment variables in your Render service settings:

```
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret_key
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

### 3. Deploy Backend

Click "Create Web Service" and wait for the deployment to complete. Note the URL of your backend service (e.g., `https://your-backend-service.onrender.com`).

**Important**: After deploying the frontend, update the CORS origin in `backend/index.ts` to include your frontend URL, then redeploy the backend.

## Frontend Deployment

### 1. Create Frontend Service on Render

1. Go to your Render dashboard
2. Click "New +" and select "Static Site"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `task-tracker-frontend` (or your preferred name)
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Root Directory**: `frontend` (if your frontend is in a subdirectory)

### 2. Environment Variables

Add this environment variable:

```
VITE_API_BASE_URL=https://your-backend-service.onrender.com
```

Replace `your-backend-service.onrender.com` with the actual URL of your backend service.

### 3. Deploy Frontend

Click "Create Static Site" and wait for the deployment to complete.

## Configuration Notes

### Backend Changes Made

1. **Added `"type": "module"`** to `package.json` to fix ES module warnings
2. **Updated static file serving** to handle separate deployment
3. **Added health check endpoint** at `/health`
4. **Removed dependency on frontend build directory**
5. **Added CORS support** for production deployment
6. **Added cors package** to dependencies

### Frontend Changes Made

1. **Updated build output directory** to `frontend/dist`
2. **Added environment variable support** for API base URL
3. **Created centralized API configuration** in `src/lib/api.ts`
4. **Updated WebSocket connection** to use environment variables
5. **Updated React Query configuration** to use centralized API utility

## Testing Deployment

1. **Backend Health Check**: Visit `https://your-backend-service.onrender.com/health`
2. **Frontend**: Visit your frontend URL and test the application
3. **API Calls**: Check browser developer tools to ensure API calls are going to the correct backend URL

## Troubleshooting

### Common Issues

1. **CORS Errors**: The backend is configured to allow all origins in production
2. **WebSocket Connection**: Ensure your backend URL is correct in the frontend environment variables
3. **Environment Variables**: Double-check all environment variables are set correctly in Render

### Debug Steps

1. Check Render deployment logs for build errors
2. Verify environment variables are set correctly
3. Test API endpoints directly using tools like Postman
4. Check browser console for frontend errors

## Local Development

For local development, the frontend will automatically proxy API calls to `localhost:5000` when running in development mode. No additional configuration is needed. 