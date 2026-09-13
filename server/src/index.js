import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';

await mongoose.connect(env.mongoUri);
console.log('Connected to MongoDB');

// Created explicitly so Socket.IO can attach to the same server later.
const server = http.createServer(createApp());

server.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
