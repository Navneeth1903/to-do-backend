import mongoose from 'mongoose';
import 'dotenv/config';

// Connect to MongoDB
export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error(
      "MONGODB_URI must be set. Did you forget to provision a MongoDB database?",
    );
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Define Mongoose Schemas
const sessionSchema = new mongoose.Schema({
  sid: { type: String, required: true, unique: true },
  sess: { type: mongoose.Schema.Types.Mixed, required: true },
  expire: { type: Date, required: true }
}, { timestamps: false });

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  firstName: String,
  lastName: String,
  profileImageUrl: String,
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { 
    type: String, 
    enum: ['pending', 'in-progress', 'completed'], 
    default: 'pending' 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  dueDate: Date,
  createdBy: { type: String, required: true },
  category: { type: String, default: 'personal' }
}, { timestamps: true });

const taskShareSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: String, required: true },
  permission: { 
    type: String, 
    enum: ['view', 'edit'], 
    default: 'view' 
  }
}, { timestamps: true });

// Create indexes
sessionSchema.index({ expire: 1 }, { expireAfterSeconds: 0 });
taskSchema.index({ createdBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ priority: 1 });
taskShareSchema.index({ taskId: 1, userId: 1 }, { unique: true });

// Export models
export const Session = mongoose.model('Session', sessionSchema);
export const User = mongoose.model('User', userSchema);
export const Task = mongoose.model('Task', taskSchema);
export const TaskShare = mongoose.model('TaskShare', taskShareSchema);

export default mongoose;