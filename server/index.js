import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000","http://localhost:3001", "http://localhost:3002", "https://meetverse-frontend.onrender.com"],
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("create-room", () => {
    const roomId = uuidv4();
    rooms.set(roomId, { creator: socket.id, participants: [socket.id] });
    socket.join(roomId);
    socket.emit("room-created", roomId);
    console.log(`🏠 Room created: ${roomId} by ${socket.id}`);
  });

  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("room-error", "Room not found");
      return;
    }
    if (room.participants.length >= 2) {
      socket.emit("room-error", "Room is full");
      return;
    }
    room.participants.push(socket.id);
    socket.join(roomId);
    socket.emit("room-joined", { roomId, isCreator: room.creator === socket.id });
    socket.to(roomId).emit("user-joined");
    console.log(`👤 User ${socket.id} joined room ${roomId}`);
  });

  socket.on("offer", ({ offer, roomId }) => {
    console.log(`📩 Received offer from ${socket.id} in room ${roomId}`);
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ answer, roomId }) => {
    console.log(`📩 Received answer from ${socket.id} in room ${roomId}`);
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("candidate", ({ candidate, roomId }) => {
    console.log(`🌐 Received ICE candidate from ${socket.id} in room ${roomId}`);
    socket.to(roomId).emit("candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.includes(socket.id)) {
        room.participants = room.participants.filter(id => id !== socket.id);
        if (room.participants.length === 0) {
          rooms.delete(roomId);
        } else {
          socket.to(roomId).emit("user-left");
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:3001`));