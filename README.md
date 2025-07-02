# Task Tracker Backend API

A Node.js/Express backend API for the Task Tracker application with MongoDB integration, authentication, and real-time WebSocket support.

## 🚀 Features

- **RESTful API** for task management
- **User Authentication** with JWT sessions
- **MongoDB Integration** with Mongoose ODM
- **Real-time Updates** via WebSocket
- **CORS Support** for cross-origin requests
- **Input Validation** with Zod schemas
- **Error Handling** with proper HTTP status codes
- **Session Management** with express-session
- **OAuth Support** (GitHub, Google, Facebook) - configured but not implemented

## 📋 Prerequisites

- Node.js 18+ 
- MongoDB database (MongoDB Atlas recommended)
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository and navigate to backend:**
   ```bash
   cd TaskTracker/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables:**
   ```env
   NODE_ENV=development
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret_key
   GITHUB_CLIENT_ID=your_github_oauth_client_id
   GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
   GOOGLE_CLIENT_ID=your_google_oauth_client_id
   GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
   FACEBOOK_APP_ID=your_facebook_app_id
   FACEBOOK_APP_SECRET=your_facebook_app_secret
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```
The server will start on `http://localhost:5000`

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run check
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/logout` - User logout
- `GET /api/auth/callback` - OAuth callback

### Tasks
- `GET /api/tasks` - Get all tasks for user
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `POST /api/tasks/:id/share` - Share task with user
- `DELETE /api/tasks/:id/share/:userId` - Remove task sharing

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

### Health Check
- `GET /health` - API health status
- `GET /api/info` - API information

### WebSocket
- `WS /api/ws` - Real-time updates

## 🗄️ Database Schema

### User
```typescript
{
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}
```

### Task
```typescript
{
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdBy: string;
  category: string;
}
```

### TaskShare
```typescript
{
  taskId: ObjectId;
  userId: string;
  permission: 'view' | 'edit';
}
```

## 🔧 Configuration

### MongoDB Connection
The app uses Mongoose to connect to MongoDB. Configure your connection string in the environment variables.

### CORS Settings
CORS is configured to allow all origins in production. For development, it allows localhost:3000.

### Session Configuration
Sessions are stored in MongoDB using `connect-mongo`. Configure session secret in environment variables.

## 🚀 Deployment

### Render Deployment

1. **Create a new Web Service** on Render
2. **Connect your GitHub repository**
3. **Configure settings:**
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Root Directory:** `backend`

4. **Set Environment Variables:**
   ```
   NODE_ENV=production
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret_key
   ```

5. **Deploy and note your backend URL**

### Environment Variables for Production

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | No |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | No |
| `FACEBOOK_APP_ID` | Facebook OAuth app ID | No |
| `FACEBOOK_APP_SECRET` | Facebook OAuth app secret | No |

## 🔍 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Verify your MongoDB URI is correct
   - Check if your IP is whitelisted in MongoDB Atlas
   - Ensure the database user has proper permissions

2. **CORS Errors**
   - Backend is configured to allow all origins
   - Check if frontend URL is correct

3. **Session Issues**
   - Verify SESSION_SECRET is set
   - Check MongoDB connection for session storage

### Debug Mode
Enable debug logging by setting `NODE_ENV=development` in your environment variables.

## 📝 API Response Format

### Success Response
```json
{
  "status": "success",
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

## 🔐 Security

- **Input Validation** using Zod schemas
- **Session-based Authentication**
- **CORS Protection**
- **Environment Variable Protection**
- **MongoDB Injection Protection** via Mongoose

## 📊 Monitoring

- **Health Check Endpoint:** `/health`
- **API Info Endpoint:** `/api/info`
- **Request Logging** for API calls
- **Error Logging** for debugging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 
