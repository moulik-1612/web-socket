import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import db from "./config/db.js";
import { uploadDir } from "./middleware/multer.js";
import router from "./routes/routes.js";

// ----------------- Express + Socket.IO -----------------
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files publicly
app.use("/uploads", express.static(uploadDir));

app.use(router);

// ----------------- WebSocket -----------------
export const onlineUsers = new Map();

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("no user id"));

  db.query(
    "SELECT id FROM myapp_user WHERE id = ?",
    [userId],
    (err, results) => {
      if (err) return next(new Error("DB error"));
      if (results.length === 0) return next(new Error("Invalid user"));

      socket.userId = userId;
      next();
    }
  );
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);

  socket.on("private-msg", ({ msg, to, image }) => {
    const fromId = socket.userId;

    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("recive-msg", {
        from_id: fromId,
        to_id: to,
        message: msg || null,
        image: image || null,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
    onlineUsers.delete(socket.userId);
  });
});

// ----------------- Start Server -----------------
const PORT = 3000;
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
