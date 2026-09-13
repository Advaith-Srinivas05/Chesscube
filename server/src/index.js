import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';

await mongoose.connect(env.mongoUri);
console.log('Connected to MongoDB');

createApp().listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
