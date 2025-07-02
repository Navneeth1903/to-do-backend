import {
  type User,
  type UpsertUser,
  type Task,
  type InsertTask,
  type UpdateTask,
  type TaskShare,
  type InsertTaskShare,
  type TaskWithDetails,
} from "./schema";
import { User as UserModel, Task as TaskModel, TaskShare as TaskShareModel } from "./db";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Task operations
  getTasks(userId: string, filters?: {
    status?: string;
    priority?: string;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    createdBy?: string;
  }): Promise<{ tasks: TaskWithDetails[]; total: number }>;
  getTask(id: string, userId: string): Promise<TaskWithDetails | undefined>;
  createTask(task: InsertTask, userId: string): Promise<Task>;
  updateTask(id: string, task: Partial<UpdateTask>, userId: string): Promise<Task | undefined>;
  deleteTask(id: string, userId: string): Promise<boolean>;
  
  // Task sharing operations
  shareTask(taskId: string, userId: string, permission: string): Promise<TaskShare>;
  unshareTask(taskId: string, userId: string): Promise<boolean>;
  getSharedTasks(userId: string): Promise<TaskWithDetails[]>;
  
  // Dashboard stats
  getTaskStats(userId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const user = await UserModel.findOne({ id });
    return user ? this.normalizeUser(user.toObject()) : undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { id: userData.id },
      { ...userData, updatedAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return this.normalizeUser(user.toObject());
  }

  // Task operations
  async getTasks(userId: string, filters: {
    status?: string;
    priority?: string;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
    createdBy?: string;
  } = {}): Promise<{ tasks: TaskWithDetails[]; total: number }> {
    const {
      status,
      priority,
      search,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10
    } = filters;

    console.log('getTasks filters:', filters);
    console.log('getTasks userId:', userId);
    let query: any;
    if (filters.createdBy) {
      // Only tasks created by the user (My TO-DO)
      query = { createdBy: filters.createdBy };
    } else {
      // All tasks user has access to (created or shared)
      query = {
        $or: [
          { createdBy: userId },
          { _id: { $in: await TaskShareModel.distinct('taskId', { userId }) } }
        ]
      };
    }

    // Apply filters
    if (status && status !== 'all') query.status = status;
    if (priority && priority !== 'all') query.priority = priority;
    if (category && category !== 'all') query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count
    console.log('getTasks query:', JSON.stringify(query));
    const total = await TaskModel.countDocuments(query);

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get tasks with pagination
    let tasks = await TaskModel.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // If the requested page is empty but there are tasks, return the first page
    if (tasks.length === 0 && total > 0 && page > 1) {
      tasks = await TaskModel.find(query)
        .sort(sortObj)
        .skip(0)
        .limit(limit)
        .lean();
    }
    console.log('getTasks result count:', tasks.length);
    console.log('getTasks result:', JSON.stringify(tasks, null, 2));

    // Get creators for tasks
    const creatorIds = Array.from(new Set(tasks.map(task => task.createdBy)));
    const creators = await UserModel.find({ id: { $in: creatorIds } }).lean();
    const creatorMap = new Map(creators.map(creator => [creator.id, creator]));

    // Get collaborators for each task
    const taskIds = tasks.map(task => task._id);
    const taskShares = await TaskShareModel.find({ taskId: { $in: taskIds } }).lean();
    const shareMap = new Map();
    taskShares.forEach(share => {
      if (!shareMap.has(share.taskId.toString())) {
        shareMap.set(share.taskId.toString(), []);
      }
      shareMap.get(share.taskId.toString()).push(share);
    });

    // Get users for task shares
    const shareUserIds = Array.from(new Set(taskShares.map(share => share.userId)));
    const shareUsers = await UserModel.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map(user => [user.id, user]));

    // Build tasks with details
    const tasksWithDetails: TaskWithDetails[] = tasks
      .map(task => {
        let creatorRaw = creatorMap.get(task.createdBy);
        if (!creatorRaw) {
          // Fallback: create a dummy user object
          creatorRaw = { id: task.createdBy, name: "Unknown", email: "", avatar: "" };
        }
        const creator = this.normalizeUser(creatorRaw);
        const shares = shareMap.get(task._id.toString()) || [];
        const collaborators = shares
          .map((share: any) => {
            const userRaw = shareUserMap.get(share.userId);
            if (!userRaw) return undefined;
            return {
              ...this.normalizeTaskShare(share),
              user: this.normalizeUser(userRaw)
            };
          })
          .filter((c: any): c is TaskShare & { user: User } => c !== undefined);
        return {
          ...this.normalizeTask(task),
          creator,
          collaborators,
          isShared: shares.length > 0,
          collaboratorCount: shares.length,
        };
      });
    console.log('getTasks tasksWithDetails:', JSON.stringify(tasksWithDetails, null, 2));
    
    return { tasks: tasksWithDetails, total };
  }

  async getTask(id: string, userId: string): Promise<TaskWithDetails | undefined> {
    const task = await TaskModel.findById(id).lean();
    if (!task) return undefined;

    // Check if user has access
    const hasAccess = task.createdBy === userId || 
      await TaskShareModel.exists({ taskId: id, userId });
    
    if (!hasAccess) return undefined;

    const creator = await UserModel.findOne({ id: task.createdBy }).lean();
    if (!creator) return undefined;

    const shares = await TaskShareModel.find({ taskId: id }).lean();
    const shareUserIds = shares.map(share => share.userId);
    const shareUsers = await UserModel.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map(user => [user.id, user]));

    const collaborators = shares
      .map((share: any) => {
        const userRaw = shareUserMap.get(share.userId);
        if (!userRaw) return undefined;
        return {
          ...this.normalizeTaskShare(share),
          user: this.normalizeUser(userRaw)
        };
      })
      .filter((c: any): c is TaskShare & { user: User } => c !== undefined);

    return {
      ...this.normalizeTask(task),
      creator: this.normalizeUser(creator),
      collaborators,
      isShared: shares.length > 0,
      collaboratorCount: shares.length,
    };
  }

  async createTask(taskData: InsertTask, userId: string): Promise<Task> {
    const task = new TaskModel({
      ...taskData,
      createdBy: userId,
    });
    await task.save();
    console.log('Task created with createdBy:', userId);
    console.log('Task created:', task.toObject());
    return this.normalizeTask(task.toObject());
  }

  async updateTask(id: string, taskData: Partial<UpdateTask>, userId: string): Promise<Task | undefined> {
    const task = await TaskModel.findById(id);
    if (!task) return undefined;

    // Check if user has access
    const hasAccess = task.createdBy === userId || 
      await TaskShareModel.exists({ taskId: id, userId, permission: 'edit' });
    
    if (!hasAccess) return undefined;

    const updatedTask = await TaskModel.findByIdAndUpdate(
      id,
      { ...taskData, updatedAt: new Date() },
      { new: true }
    );
    return updatedTask ? this.normalizeTask(updatedTask.toObject()) : undefined;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    const task = await TaskModel.findById(id);
    if (!task || task.createdBy !== userId) return false;

    await TaskModel.findByIdAndDelete(id);
    await TaskShareModel.deleteMany({ taskId: id });
    return true;
  }

  async shareTask(taskId: string, userId: string, permission: string = 'view'): Promise<TaskShare> {
    const taskShare = new TaskShareModel({
      taskId,
      userId,
      permission,
    });
    await taskShare.save();
    return this.normalizeTaskShare(taskShare.toObject());
  }

  async unshareTask(taskId: string, userId: string): Promise<boolean> {
    const result = await TaskShareModel.deleteOne({ taskId, userId });
    return result.deletedCount > 0;
  }

  async getSharedTasks(userId: string): Promise<TaskWithDetails[]> {
    const sharedTaskIds = await TaskShareModel.distinct('taskId', { userId });
    const tasks = await TaskModel.find({ _id: { $in: sharedTaskIds } }).lean();

    const creatorIds = Array.from(new Set(tasks.map(task => task.createdBy)));
    const creators = await UserModel.find({ id: { $in: creatorIds } }).lean();
    const creatorMap = new Map(creators.map(creator => [creator.id, creator]));

    const taskShares = await TaskShareModel.find({ taskId: { $in: sharedTaskIds } }).lean();
    const shareMap = new Map();
    taskShares.forEach(share => {
      if (!shareMap.has(share.taskId.toString())) {
        shareMap.set(share.taskId.toString(), []);
      }
      shareMap.get(share.taskId.toString()).push(share);
    });

    const shareUserIds = Array.from(new Set(taskShares.map(share => share.userId)));
    const shareUsers = await UserModel.find({ id: { $in: shareUserIds } }).lean();
    const shareUserMap = new Map(shareUsers.map(user => [user.id, user]));

    return tasks
      .map(task => {
        let creatorRaw = creatorMap.get(task.createdBy);
        if (!creatorRaw) {
          // Fallback: create a dummy user object
          creatorRaw = { id: task.createdBy, name: "Unknown", email: "", avatar: "" };
        }
        const creator = this.normalizeUser(creatorRaw);
        const shares = shareMap.get(task._id.toString()) || [];
        const collaborators = shares
          .map((share: any) => {
            const userRaw = shareUserMap.get(share.userId);
            if (!userRaw) return undefined;
            return {
              ...this.normalizeTaskShare(share),
              user: this.normalizeUser(userRaw)
            };
          })
          .filter((c: any): c is TaskShare & { user: User } => c !== undefined);
        return {
          ...this.normalizeTask(task),
          creator,
          collaborators,
          isShared: shares.length > 0,
          collaboratorCount: shares.length,
        };
      });
  }

  async getTaskStats(userId: string): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  }> {
    const query = {
      $or: [
        { createdBy: userId },
        { _id: { $in: await TaskShareModel.distinct('taskId', { userId }) } }
      ]
    };

    const [total, completed, inProgress, overdue] = await Promise.all([
      TaskModel.countDocuments(query),
      TaskModel.countDocuments({ ...query, status: 'completed' }),
      TaskModel.countDocuments({ ...query, status: { $in: ['pending', 'in-progress'] } }),
      TaskModel.countDocuments({
        ...query,
        dueDate: { $lt: new Date() },
        status: { $ne: 'completed' }
      })
    ]);

    return { total, completed, inProgress, overdue };
  }

  // Helper to convert MongoDB _id/ObjectId fields to string and normalize user/task objects
  normalizeUser(user: any): User {
    return {
      ...user,
      id: user.id,
      email: user.email || undefined,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      profileImageUrl: user.profileImageUrl || undefined,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  normalizeTask(task: any): Task {
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
      category: task.category,
    };
  }

  normalizeTaskShare(share: any): TaskShare {
    return {
      ...share,
      _id: share._id?.toString(),
      taskId: share.taskId?.toString(),
      userId: share.userId,
      permission: share.permission,
      createdAt: share.createdAt,
    };
  }
}

export const storage = new DatabaseStorage();
