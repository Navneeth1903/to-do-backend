var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// vite.ts
var vite_exports = {};
__export(vite_exports, {
  log: () => log,
  serveStatic: () => serveStatic,
  setupVite: () => setupVite
});
import express2 from "express";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    // Temporarily disable HMR to prevent auto-refresh issues
    hmr: false,
    allowedHosts: void 0
  };
  const vite = await createViteServer({
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
var init_vite = __esm({
  "vite.ts"() {
  }
});

// index.ts
import "dotenv/config";
import express3 from "express";
import { createServer } from "http";

// routes.ts
import express from "express";

// db.ts
import mongoose from "mongoose";
import "dotenv/config";
var connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI must be set. Did you forget to provision a MongoDB database?"
    );
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
var sessionSchema = new mongoose.Schema({
  sid: { type: String, required: true, unique: true },
  sess: { type: mongoose.Schema.Types.Mixed, required: true },
  expire: { type: Date, required: true }
}, { timestamps: false });
var userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  firstName: String,
  lastName: String,
  profileImageUrl: String
}, { timestamps: true });
var taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending"
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium"
  },
  dueDate: Date,
  createdBy: { type: String, required: true },
  category: { type: String, default: "personal" }
}, { timestamps: true });
var taskShareSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  userId: { type: String, required: true },
  permission: {
    type: String,
    enum: ["view", "edit"],
    default: "view"
  }
}, { timestamps: true });
sessionSchema.index({ expire: 1 }, { expireAfterSeconds: 0 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskShareSchema.index({ taskId: 1, userId: 1 }, { unique: true });
var Session = mongoose.model("Session", sessionSchema);
var User = mongoose.model("User", userSchema);
var Task = mongoose.model("Task", taskSchema);
var TaskShare = mongoose.model("TaskShare", taskShareSchema);

// storage.ts
var DatabaseStorage = class {
  // User operations (required for Replit Auth)
  async getUser(id) {
    const user = await User.findOne({ id });
    return user ? this.normalizeUser(user.toObject()) : void 0;
  }
  async upsertUser(userData) {
    const user = await User.findOneAndUpdate(
      { id: userData.id },
      { ...userData, updatedAt: /* @__PURE__ */ new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return this.normalizeUser(user.toObject());
  }
  // Task operations
  async getTasks(userId, filters = {}) {
    const {
      status,
      priority,
      search,
      category,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10
    } = filters;
    console.log("getTasks filters:", filters);
    console.log("getTasks userId:", userId);
    let query;
    if (filters.createdBy) {
      query = { createdBy: filters.createdBy };
    } else {
      query = {
        $or: [
          { createdBy: userId },
          { _id: { $in: await TaskShare.distinct("taskId", { userId }) } }
        ]
      };
    }
    if (status && status !== "all") query.status = status;
    if (priority && priority !== "all") query.priority = priority;
    if (category && category !== "all") query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }
    console.log("getTasks query:", JSON.stringify(query));
    const total = await Task.countDocuments(query);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;
    let tasks = await Task.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit).lean();
    if (tasks.length === 0 && total > 0 && page > 1) {
      tasks = await Task.find(query).sort(sortObj).skip(0).limit(limit).lean();
    }
    console.log("getTasks result count:", tasks.length);
    console.log("getTasks result:", JSON.stringify(tasks, null, 2));
    const creatorIds = Array.from(new Set(tasks.map((task) => task.createdBy)));
    const creators = await User.find({ id: { $in: creatorIds } }).lean();
    const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
    const taskIds = tasks.map((task) => task._id);
    const taskShares = await TaskShare.find({ taskId: { $in: taskIds } }).lean();
    const shareMap = /* @__PURE__ */ new Map();
    taskShares.forEach((share) => {
      if (!shareMap.has(share.taskId.toString())) {
        shareMap.set(share.taskId.toString(), []);
      }
      shareMap.get(share.taskId.toString()).push(share);
    });
    const shareUserIds = Array.from(new Set(taskShares.map((share) => share.userId)));
    const shareUsers = await User.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map((user) => [user.id, user]));
    const tasksWithDetails = tasks.map((task) => {
      let creatorRaw = creatorMap.get(task.createdBy);
      if (!creatorRaw) {
        creatorRaw = { id: task.createdBy, name: "Unknown", email: "", avatar: "" };
      }
      const creator = this.normalizeUser(creatorRaw);
      const shares = shareMap.get(task._id.toString()) || [];
      const collaborators = shares.map((share) => {
        const userRaw = shareUserMap.get(share.userId);
        if (!userRaw) return void 0;
        return {
          ...this.normalizeTaskShare(share),
          user: this.normalizeUser(userRaw)
        };
      }).filter((c) => c !== void 0);
      return {
        ...this.normalizeTask(task),
        creator,
        collaborators,
        isShared: shares.length > 0,
        collaboratorCount: shares.length
      };
    });
    console.log("getTasks tasksWithDetails:", JSON.stringify(tasksWithDetails, null, 2));
    return { tasks: tasksWithDetails, total };
  }
  async getTask(id, userId) {
    const task = await Task.findById(id).lean();
    if (!task) return void 0;
    const hasAccess = task.createdBy === userId || await TaskShare.exists({ taskId: id, userId });
    if (!hasAccess) return void 0;
    const creator = await User.findOne({ id: task.createdBy }).lean();
    if (!creator) return void 0;
    const shares = await TaskShare.find({ taskId: id }).lean();
    const shareUserIds = shares.map((share) => share.userId);
    const shareUsers = await User.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map((user) => [user.id, user]));
    const collaborators = shares.map((share) => {
      const userRaw = shareUserMap.get(share.userId);
      if (!userRaw) return void 0;
      return {
        ...this.normalizeTaskShare(share),
        user: this.normalizeUser(userRaw)
      };
    }).filter((c) => c !== void 0);
    return {
      ...this.normalizeTask(task),
      creator: this.normalizeUser(creator),
      collaborators,
      isShared: shares.length > 0,
      collaboratorCount: shares.length
    };
  }
  async createTask(taskData, userId) {
    const task = new Task({
      ...taskData,
      createdBy: userId
    });
    await task.save();
    console.log("Task created with createdBy:", userId);
    console.log("Task created:", task.toObject());
    return this.normalizeTask(task.toObject());
  }
  async updateTask(id, taskData, userId) {
    const task = await Task.findById(id);
    if (!task) return void 0;
    const hasAccess = task.createdBy === userId || await TaskShare.exists({ taskId: id, userId, permission: "edit" });
    if (!hasAccess) return void 0;
    const updatedTask = await Task.findByIdAndUpdate(
      id,
      { ...taskData, updatedAt: /* @__PURE__ */ new Date() },
      { new: true }
    );
    return updatedTask ? this.normalizeTask(updatedTask.toObject()) : void 0;
  }
  async deleteTask(id, userId) {
    const task = await Task.findById(id);
    if (!task || task.createdBy !== userId) return false;
    await Task.findByIdAndDelete(id);
    await TaskShare.deleteMany({ taskId: id });
    return true;
  }
  async shareTask(taskId, userId, permission = "view") {
    const taskShare = new TaskShare({
      taskId,
      userId,
      permission
    });
    await taskShare.save();
    return this.normalizeTaskShare(taskShare.toObject());
  }
  async unshareTask(taskId, userId) {
    const result = await TaskShare.deleteOne({ taskId, userId });
    return result.deletedCount > 0;
  }
  async getSharedTasks(userId) {
    const sharedTaskIds = await TaskShare.distinct("taskId", { userId });
    const tasks = await Task.find({ _id: { $in: sharedTaskIds } }).lean();
    const creatorIds = Array.from(new Set(tasks.map((task) => task.createdBy)));
    const creators = await User.find({ id: { $in: creatorIds } }).lean();
    const creatorMap = new Map(creators.map((creator) => [creator.id, creator]));
    const taskShares = await TaskShare.find({ taskId: { $in: sharedTaskIds } }).lean();
    const shareMap = /* @__PURE__ */ new Map();
    taskShares.forEach((share) => {
      if (!shareMap.has(share.taskId.toString())) {
        shareMap.set(share.taskId.toString(), []);
      }
      shareMap.get(share.taskId.toString()).push(share);
    });
    const shareUserIds = Array.from(new Set(taskShares.map((share) => share.userId)));
    const shareUsers = await User.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map((user) => [user.id, user]));
    return tasks.map((task) => {
      let creatorRaw = creatorMap.get(task.createdBy);
      if (!creatorRaw) {
        creatorRaw = { id: task.createdBy, name: "Unknown", email: "", avatar: "" };
      }
      const creator = this.normalizeUser(creatorRaw);
      const shares = shareMap.get(task._id.toString()) || [];
      const collaborators = shares.map((share) => {
        const userRaw = shareUserMap.get(share.userId);
        if (!userRaw) return void 0;
        return {
          ...this.normalizeTaskShare(share),
          user: this.normalizeUser(userRaw)
        };
      }).filter((c) => c !== void 0);
      return {
        ...this.normalizeTask(task),
        creator,
        collaborators,
        isShared: shares.length > 0,
        collaboratorCount: shares.length
      };
    });
  }
  async getTaskStats(userId) {
    const query = {
      $or: [
        { createdBy: userId },
        { _id: { $in: await TaskShare.distinct("taskId", { userId }) } }
      ]
    };
    const [total, completed, inProgress, overdue] = await Promise.all([
      Task.countDocuments(query),
      Task.countDocuments({ ...query, status: "completed" }),
      Task.countDocuments({ ...query, status: { $in: ["pending", "in-progress"] } }),
      Task.countDocuments({
        ...query,
        dueDate: { $lt: /* @__PURE__ */ new Date() },
        status: { $ne: "completed" }
      })
    ]);
    return { total, completed, inProgress, overdue };
  }
  // Helper to convert MongoDB _id/ObjectId fields to string and normalize user/task objects
  normalizeUser(user) {
    return {
      ...user,
      id: user.id,
      email: user.email || void 0,
      firstName: user.firstName || void 0,
      lastName: user.lastName || void 0,
      profileImageUrl: user.profileImageUrl || void 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
  normalizeTask(task) {
    return {
      ...task,
      _id: task._id?.toString(),
      createdBy: task.createdBy,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      category: task.category
    };
  }
  normalizeTaskShare(share) {
    return {
      ...share,
      _id: share._id?.toString(),
      taskId: share.taskId?.toString(),
      userId: share.userId,
      permission: share.permission,
      createdAt: share.createdAt
    };
  }
};
var storage = new DatabaseStorage();

// schema.ts
import { z } from "zod";
var insertTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(["pending", "in-progress", "completed"]).default("pending"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.date().optional(),
  category: z.string().default("personal"),
  shareWith: z.array(z.string().email()).optional()
});
var updateTaskSchema = insertTaskSchema.partial().extend({
  _id: z.string()
});
var insertTaskShareSchema = z.object({
  taskId: z.string(),
  userId: z.string(),
  permission: z.enum(["view", "edit"]).default("view")
});
var userSchema2 = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

// routes.ts
import { z as z2 } from "zod";
import { WebSocketServer, WebSocket } from "ws";
import bcrypt from "bcryptjs";
import mongoose2 from "mongoose";
if (mongoose2.models.User) {
  delete mongoose2.models.User;
}
var userSchema3 = new mongoose2.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
var User2 = mongoose2.model("User", userSchema3);
function isClientAuthenticated(req, res, next) {
  req.user = {
    claims: {
      sub: req.headers["x-user-id"] || "1"
      // Use header for user ID if present
    }
  };
  next();
}
async function registerRoutes(app2) {
  const router = express.Router();
  router.post("/api/auth/signup", async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "All fields are required." });
      }
      const existing = await User2.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "Email already registered." });
      }
      const hashed = await bcrypt.hash(password, 10);
      const user = await User2.create({ name, email, password: hashed });
      user.id = user._id.toString();
      await user.save();
      res.status(201).json({ id: user._id, name: user.name, email: user.email });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Signup error:", error);
        if (error.code === 11e3) {
          return res.status(409).json({ message: "Email already registered." });
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
      } else {
        console.error("Signup error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  router.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required." });
      }
      const user = await User2.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid credentials." });
      }
      res.json({ id: user._id, name: user.name, email: user.email });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
      } else {
        console.error("Login error:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  router.get("/api/auth/user", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await User2.findById(userId).select("-password");
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  router.get("/api/tasks", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        search: req.query.search,
        category: req.query.category,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        page: req.query.page ? parseInt(req.query.page) : void 0,
        limit: req.query.limit ? parseInt(req.query.limit) : void 0,
        createdBy: req.query.createdBy
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
  router.get("/api/tasks/:id", isClientAuthenticated, async (req, res) => {
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
  router.post("/api/tasks", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      if (req.body.dueDate && typeof req.body.dueDate === "string") {
        const date = new Date(req.body.dueDate);
        if (!isNaN(date.getTime())) {
          req.body.dueDate = date;
        } else {
          delete req.body.dueDate;
        }
      }
      const validatedData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(validatedData, userId);
      broadcast("task_created", { task, userId });
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error, "Request body:", req.body);
      if (error instanceof z2.ZodError) {
        res.status(400).json({ message: error.errors.map((e) => e.message).join("; ") });
      } else if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  router.put("/api/tasks/:id", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      if (req.body.dueDate && typeof req.body.dueDate === "string") {
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
      broadcast("task_updated", { task, userId });
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
  router.delete("/api/tasks/:id", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const taskId = req.params.id;
      const deleted = await storage.deleteTask(taskId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Task not found or access denied" });
      }
      broadcast("task_deleted", { taskId, userId });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.post("/api/tasks/:id/share", isClientAuthenticated, async (req, res) => {
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
  router.delete("/api/tasks/:id/share/:userId", isClientAuthenticated, async (req, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      const taskId = req.params.id;
      const userId = req.params.userId;
      const deleted = await storage.unshareTask(taskId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Share not found" });
      }
      broadcast("task_unshared", { taskId, userId, unsharedBy: currentUserId });
      res.status(204).send();
    } catch (error) {
      console.error("Error unsharing task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.get("/api/tasks/shared", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const tasks = await storage.getSharedTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error getting shared tasks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.get("/api/stats", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getTaskStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  router.get("/api/dashboard/stats", isClientAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getTaskStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error getting dashboard stats:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.use(router);
  try {
    const httpServer2 = app2.get("httpServer");
    if (httpServer2) {
      const wss = new WebSocketServer({
        server: httpServer2,
        path: "/api/ws"
        // Use a specific path to avoid conflicts
      });
      wss.on("connection", (ws) => {
        console.log("TaskTracker WebSocket client connected");
        ws.on("message", (message) => {
          try {
            const data = JSON.parse(message.toString());
            console.log("TaskTracker WebSocket received:", data);
          } catch (error) {
            console.error("TaskTracker WebSocket error parsing message:", error);
          }
        });
        ws.on("close", () => {
          console.log("TaskTracker WebSocket client disconnected");
        });
        ws.on("error", (error) => {
          console.error("TaskTracker WebSocket error:", error);
        });
      });
      app2.set("wss", wss);
    }
  } catch (error) {
    console.error("TaskTracker WebSocket setup error:", error);
  }
  function broadcast(type, data) {
    const wss = app2.get("wss");
    if (wss) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type, data }));
        }
      });
    }
  }
}

// index.ts
init_vite();
var app = express3();
var httpServer = createServer(app);
connectDB();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  app.set("httpServer", httpServer);
  await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (process.env.NODE_ENV === "development") {
    const { setupVite: setupVite3 } = await Promise.resolve().then(() => (init_vite(), vite_exports));
    await setupVite3(app, httpServer);
  } else {
    const { serveStatic: serveStatic3 } = await Promise.resolve().then(() => (init_vite(), vite_exports));
    serveStatic3(app);
  }
  const port = 5e3;
  httpServer.listen(port, () => {
    log(`serving on port ${port}`);
  });
})();
