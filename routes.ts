import express from "express";
import { storage } from "./storage";
import { insertTaskSchema, updateTaskSchema, insertTaskShareSchema } from "./schema";
import { z } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// --- User Model ---
if (mongoose.models.User) {
  delete mongoose.models.User;
}
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Simple client-side auth middleware (for tasks, not for auth routes)
function isClientAuthenticated(req: any, res: any, next: any) {
  req.user = {
    claims: {
      sub: req.headers['x-user-id'] || '1' // Use header for user ID if present
    }
  };
  next();
}

export async function registerRoutes(app: express.Express): Promise<void> {
  const router = express.Router();

  // --- AUTH ROUTES ---
  // Sign up
  router.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
      }
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: 'Email already registered.' });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, password: hashed });
      // PATCH: Ensure user.id is set for compatibility with task filtering
      user.id = user._id.toString();
      await user.save();
      res.status(201).json({ id: user._id, name: user.name, email: user.email });
    } catch (error) {
      if (error instanceof Error) {
        console.error('Signup error:', error);
        // @ts-ignore
        if ((error as any).code === 11000) {
          return res.status(409).json({ message: 'Email already registered.' });
        }
        res.status(500).json({ message: 'Internal server error', error: error.message });
      } else {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Login
  router.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required.' });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: 'Invalid credentials.' });
      }
      // Return user info and user id for session
      res.json({ id: user._id, name: user.name, email: user.email });
    } catch (error) {
      if (error instanceof Error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
      } else {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  });

  // Auth routes (for getting user info)
  router.get('/api/auth/user', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await User.findById(userId).select('-password');
      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Task routes
  router.get('/api/tasks', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        status: req.query.status as string,
        priority: req.query.priority as string,
        search: req.query.search as string,
        category: req.query.category as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc',
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        createdBy: req.query.createdBy as string,
      };
      const result = await storage.getTasks(userId, filters);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error getting tasks:", error, error.stack, "Query:", req.query);
      } else {
        console.error("Error getting tasks:", error, "Query:", req.query);
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get('/api/tasks/:id', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      
      const task = await storage.getTask(taskId, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      console.error("Error getting task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.post('/api/tasks', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Convert dueDate string to Date if present and valid
      if (req.body.dueDate && typeof req.body.dueDate === 'string') {
        const date = new Date(req.body.dueDate);
        if (!isNaN(date.getTime())) {
          req.body.dueDate = date;
        } else {
          delete req.body.dueDate;
        }
      }
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData, userId);
      // Broadcast to WebSocket clients
      broadcast('task_created', { task, userId });
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error, "Request body:", req.body);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors.map(e => e.message).join('; ') });
      } else if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  router.put('/api/tasks/:id', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      // Convert dueDate string to Date if present and valid
      if (req.body.dueDate && typeof req.body.dueDate === 'string') {
        const date = new Date(req.body.dueDate);
        if (!isNaN(date.getTime())) {
          req.body.dueDate = date;
        } else {
          delete req.body.dueDate;
        }
      }
      const validatedData = updateTaskSchema.parse({ ...req.body, _id: taskId });
      
      const task = await storage.updateTask(taskId, validatedData, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found or access denied" });
      }
       
      // Broadcast to WebSocket clients
      broadcast('task_updated', { task, userId });
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  router.delete('/api/tasks/:id', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      
      const deleted = await storage.deleteTask(taskId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found or access denied" });
      }
      
      // Broadcast to WebSocket clients
      broadcast('task_deleted', { taskId, userId });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Task sharing routes
  router.post('/api/tasks/:id/share', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      const validatedData = insertTaskShareSchema.parse(req.body);
      const share = await storage.shareTask(taskId, validatedData.userId, validatedData.permission);
      res.status(201).json(share);
    } catch (error) {
      console.error("Error sharing task:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  router.delete('/api/tasks/:id/share/:userId', isClientAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const taskId = req.params.id;
      const userId = req.params.userId;
      
      const deleted = await storage.unshareTask(taskId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Share not found" });
      }
      
      // Broadcast to WebSocket clients
      broadcast('task_unshared', { taskId, userId: userId, unsharedBy: currentUserId });
      
      res.status(204).send();
    } catch (error) {
      console.error("Error unsharing task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get('/api/tasks/shared', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tasks = await storage.getSharedTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error getting shared tasks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dashboard stats
  router.get('/api/stats', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getTaskStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.get('/api/dashboard/stats', isClientAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getTaskStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.use(router);

  // WebSocket setup with proper error handling
  try {
    const httpServer = app.get('httpServer');
    if (httpServer) {
      const wss = new WebSocketServer({ 
        server: httpServer,
        path: '/api/ws' // Use a specific path to avoid conflicts
      });

      wss.on('connection', (ws: WebSocket) => {
        console.log('TaskTracker WebSocket client connected');

        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            console.log('TaskTracker WebSocket received:', data);
          } catch (error) {
            console.error('TaskTracker WebSocket error parsing message:', error);
          }
        });

        ws.on('close', () => {
          console.log('TaskTracker WebSocket client disconnected');
        });

        ws.on('error', (error) => {
          console.error('TaskTracker WebSocket error:', error);
        });
      });

      // Store the WebSocket server for broadcasting
      app.set('wss', wss);
    }
  } catch (error) {
    console.error('TaskTracker WebSocket setup error:', error);
  }

  function broadcast(type: string, data: any) {
    const wss = app.get('wss');
    if (wss) {
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, data }));
        }
      });
    }
  }
}
