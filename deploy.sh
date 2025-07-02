#!/bin/bash

echo "🚀 Task Tracker Deployment Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "backend/package.json" ] || [ ! -f "frontend/package.json" ]; then
    echo "❌ Error: Please run this script from the TaskTracker root directory"
    exit 1
fi

echo "📦 Building backend..."
cd backend
npm install
npm run build
cd ..

echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "✅ Build completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy backend to Render as a Web Service"
echo "2. Deploy frontend to Render as a Static Site"
echo "3. Set environment variables in Render"
echo "4. Update CORS origin in backend/index.ts with your frontend URL"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions" 