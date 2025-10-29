# Meetverse - Video Calling Application

A WebRTC-based video calling application with React frontend and Node.js backend.

## Project Structure

```
meetverse/
├── client/          # React frontend
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── server/          # Node.js backend
│   ├── index.js
│   └── package.json
└── package.json     # Root package.json
```

## Setup

1. Install dependencies for both client and server:
   ```bash
   npm run install:all
   ```

2. Start the server (Terminal 1):
   ```bash
   npm run dev:server
   ```

3. Start the client (Terminal 2):
   ```bash
   npm run dev:client
   ```

4. Open two browser tabs at `http://localhost:3000` to test video calling

## Features

- WebRTC peer-to-peer video calling
- Real-time signaling with Socket.IO
- Video recording functionality
- TURN server integration for NAT traversal

## Development

- Client runs on port 3000 (Vite dev server)
- Server runs on port 3001 (Express + Socket.IO)