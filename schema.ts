import { z } from "zod";

// MongoDB/Mongoose Schemas
export interface ISession {
  sid: string;
  sess: any;
  expire: Date;
}

export interface IUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITask {
  _id?: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  category?: string;
}

export interface ITaskShare {
  _id?: string;
  taskId: string;
  userId: string;
  permission: 'view' | 'edit';
  createdAt: Date;
}

// Zod Schemas for validation
export const insertTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).default('pending'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.date().optional(),
  category: z.string().default('personal'),
  shareWith: z.array(z.string().email()).optional(),
});

export const updateTaskSchema = insertTaskSchema.partial().extend({
  _id: z.string(),
});

export const insertTaskShareSchema = z.object({
  taskId: z.string(),
  userId: z.string(),
  permission: z.enum(['view', 'edit']).default('view'),
});

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Types
export type UpsertUser = Omit<IUser, 'createdAt' | 'updatedAt'>;
export type User = IUser;
export type Task = ITask;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type TaskShare = ITaskShare;
export type InsertTaskShare = z.infer<typeof insertTaskShareSchema>;

// Extended task type with creator and collaborators info
export type TaskWithDetails = Task & {
  creator: User;
  collaborators: (TaskShare & { user: User })[];
  isShared: boolean;
  collaboratorCount: number;
}; 