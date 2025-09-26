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
export const onlineUsers = new Map(); // userId -> socketId

// simple message rate-tracking to detect floods (in-memory)
const sendTimes = new Map(); // userId -> [timestamps]

// helper: push timestamp and return count in last N seconds
function recordAndCountRecent(userId, windowSec = 10) {
  const now = Date.now();
  const arr = sendTimes.get(userId) || [];
  // keep only recent timestamps
  const cutoff = now - windowSec * 1000;
  const filtered = arr.filter((t) => t >= cutoff);
  filtered.push(now);
  sendTimes.set(userId, filtered);
  return filtered.length;
}

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("no user id"));

  db.query("SELECT user_id FROM myapp_user WHERE user_id = ?", [userId], (err, results) => {
    if (err) return next(new Error("DB error"));
    if (results.length === 0) return next(new Error("Invalid user"));

    socket.userId = String(userId);
    next();
  });
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);

  // 1) send initial online users list to this socket
  io.to(socket.id).emit("online-users", Array.from(onlineUsers.keys()));

  // 2) notify others that this user is online
  socket.broadcast.emit("user-online", { userId: socket.userId });

  // 3) send recent last_seen for this user (optional: read from DB)
  db.query("SELECT last_seen FROM myapp_user WHERE user_id = ?", [socket.userId], (err, res) => {
    if (!err && res && res[0]) {
      io.to(socket.id).emit("my-last-seen", { last_seen: res[0].last_seen });
    }
  });

  // ---------- socket handlers ----------
  /**
   * private-msg
   * payload: { msg, to, image, reply_to }
   * Save message to DB, emit to recipient (if online) and ack sender with saved message
   */
  socket.on("private-msg", (payload) => {
  const fromUserId = socket.userId;   // string user_id from auth
  const toUserId = payload.to;        // string user_id from payload
  const msg = payload.msg || null;
  const image = payload.image || null;
  const reply_to = payload.reply_to || null;

  // --- lookup sender ---
  db.query(
    "SELECT id FROM myapp_user WHERE user_id = ?",
    [fromUserId],
    (err, fromRes) => {
      if (err || fromRes.length === 0) {
        console.error("invalid from_id", fromUserId, err);
        io.to(socket.id).emit("send-error", { error: "invalid from_id" });
        return;
      }
      const fromId = fromRes[0].id;

      // --- lookup recipient ---
      db.query(
        "SELECT id FROM myapp_user WHERE user_id = ?",
        [toUserId],
        (err2, toRes) => {
          if (err2 || toRes.length === 0) {
            console.error("invalid to_id", toUserId, err2);
            io.to(socket.id).emit("send-error", { error: "invalid to_id" });
            return;
          }
          const toId = toRes[0].id;

          // --- insert message with numeric ids ---
          const sql =
            "INSERT INTO messages (`from_id`, `to_id`, `message`, `image`, `reply_to`) VALUES (?, ?, ?, ?, ?)";
          db.query(sql, [fromUserId, toUserId, msg, image, reply_to], (err3, result) => {
            if (err3) {
              console.error("DB save error", err3);
              io.to(socket.id).emit("send-error", { error: "message save failed" });
              return;
            }

            const insertedId = result.insertId;

            // --- fetch saved message row ---
            db.query("SELECT * FROM messages WHERE id = ?", [insertedId], (err4, rows) => {
              if (err4 || rows.length === 0) {
                console.error("DB fetch after insert failed", err4);
                return;
              }
              const saved = rows[0];

              // --- emit to recipient if online ---
              const targetSocketId = onlineUsers.get(toUserId); // use user_id string for map
              if (targetSocketId) {
                io.to(targetSocketId).emit("recive-msg", {
                  id: saved.id,
                  from_id: saved.from_id,
                  to_id: saved.to_id,
                  message: saved.message,
                  image: saved.image,
                  created_at: saved.created_at,
                  seen: saved.seen,
                  reply_to: saved.reply_to,
                });
              }

              // --- ack sender with saved message ---
              io.to(socket.id).emit("message-sent", {
                id: saved.id,
                from_id: saved.from_id,
                to_id: saved.to_id,
                message: saved.message,
                image: saved.image,
                created_at: saved.created_at,
                seen: saved.seen,
                reply_to: saved.reply_to,
              });
            });
          });
        }
      );
    }
  );
});

  /**
   * typing
   * payload: { to, isTyping: true/false }
   * Broadcast to the recipient who is typing or stopped typing
   */
  socket.on("typing", ({ to, isTyping }) => {
    const targetSocketId = onlineUsers.get(String(to));
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing", {
        from: socket.userId,
        isTyping: !!isTyping,
      });
    }
  });

  /**
   * mark-seen
   * payload: { fromId }
   * Mark all messages FROM `fromId` to current user as seen, and notify the original sender
   */
  socket.on("mark-seen", ({ fromId }) => {
    const toId = socket.userId;
    db.query(
      "UPDATE messages SET seen = 1 WHERE from_id = ? AND to_id = ? AND seen = 0",
      [fromId, toId],
      (err, result) => {
        if (err) {
          console.error("mark-seen error", err);
          return;
        }
        // notify the original sender about which messages were seen
        const senderSocketId = onlineUsers.get(String(fromId));
        if (senderSocketId) {
          // for simplicity, send a count and the 'to' who marked seen
          io.to(senderSocketId).emit("message-seen", {
            from: fromId,
            to: toId,
            count: result.affectedRows,
          });
        }
      }
    );
  });

  /**
   * get-last-seen (optional): client can request last_seen of a user
   * payload: { userId }
   */
  socket.on("get-last-seen", ({ userId }) => {
    db.query("SELECT last_seen FROM myapp_user WHERE user_id = ?", [userId], (err, rows) => {
      if (err || !rows || !rows[0]) {
        io.to(socket.id).emit("last-seen", { userId, last_seen: null });
      } else {
        io.to(socket.id).emit("last-seen", { userId, last_seen: rows[0].last_seen });
      }
    });
  });

  // On disconnect - remove from onlineUsers & update last_seen
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
    onlineUsers.delete(socket.userId);

    // broadcast offline event with last_seen timestamp (now)
    const now = new Date();
    // update DB last_seen
    db.query("UPDATE myapp_user SET last_seen = ? WHERE user_id = ?", [now, socket.userId], (err) => {
      if (err) console.warn("Failed to update last_seen", err);
      // broadcast offline to others
      socket.broadcast.emit("user-offline", { userId: socket.userId, last_seen: now });
    });
  });
});

// ----------------- Start Server -----------------
const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
