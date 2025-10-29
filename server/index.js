import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:3002"],
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  socket.on("offer", (data) => {
    console.log(`📩 Received offer from ${socket.id}`);
    socket.broadcast.emit("offer", data);
    console.log(`➡ Broadcasted offer from ${socket.id}`);
  });

  socket.on("answer", (data) => {
    console.log(`📩 Received answer from ${socket.id}`);
    socket.broadcast.emit("answer", data);
    console.log(`➡ Broadcasted answer from ${socket.id}`);
  });

  socket.on("candidate", (data) => {
    console.log(`🌐 Received ICE candidate from ${socket.id}`);
    socket.broadcast.emit("candidate", data);
    console.log(`➡ Broadcasted ICE candidate from ${socket.id}`);
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

const PORT = 3001;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:3001`));