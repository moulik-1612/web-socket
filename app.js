import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const port = 3000;
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Keep track of online users (userId → socketId)
const onlineUsers = new Map();

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("no user id"));
  socket.userId = userId;
  next();
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: userId=${socket.userId}, socketId=${socket.id}`);
  onlineUsers.set(socket.userId, socket.id);

  // Private message handler
  socket.on("private-msg", ({ msg, to }) => {
    console.log(`💬 ${socket.userId} -> ${to}: ${msg}`);
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("recive-msg", {
        msg,
        from: socket.userId,
      });
    } else {
      console.log(`⚠️ User ${to} not online`);
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
    onlineUsers.delete(socket.userId);
  });
});

app.get("/", (req, res) => {
  res.send("hello web socket");
})

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
