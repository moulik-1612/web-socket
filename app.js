import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mysql from "mysql2";
import multer from "multer";
import fs from "fs";
import path from "path";

// ----------------- MySQL Connection -----------------
const db = mysql.createConnection({
  host: "localhost",
  user: "komal_pubup",   // XAMPP default
  password: "p+MOy1A(Rc^O#l{I",   // XAMPP default is empty
  database: "pubup",
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL connection failed:", err);
    return;
  }
  console.log("✅ MySQL connected");

  // Auto-create tables if not exist
  db.query(
    `CREATE TABLE IF NOT EXISTS myapp_user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL
    )`
  );
  db.query(
    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_id INT,
      to_id INT,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_id) REFERENCES myapp_user(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES myapp_user(id) ON DELETE CASCADE,
      image TEXT
    )`
  );
});

// ----------------- Ensure uploads folder exists -----------------
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 uploads folder created");
}

// ----------------- Multer Config -----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

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

// Serve uploaded files publicly
app.use("/uploads", express.static(uploadDir));

// ----------------- REST APIs -----------------

// Get all users
app.get("/users", (req, res) => {
  db.query("SELECT * FROM myapp_user", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
});

app.get("/", (req, res) => {
  res.send("welcome to socket server");
});

// Get messages between 2 users
app.get("/messages/:from/:to", (req, res) => {
  const { from, to } = req.params;
  db.query(
    "SELECT * FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY created_at ASC",
    [from, to, to, from],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    }
  );
});



app.post(
  "/upload",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: "File upload error" });
      } else if (err) {
        return res.status(500).json({ error: "Server error" });
      }
      next();
    });
  },
  (req, res) => {
    // Existing /upload logic
    const { from_id, to_id, msg } = req.body;
    if (!from_id || !to_id) {
      return res.status(400).json({ error: "from_id and to_id are required" });
    }

    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // Save both msg and image (null if not provided)
    db.query(
      "INSERT INTO messages (from_id, to_id, message, image) VALUES (?, ?, ?, ?)",
      [from_id, to_id, msg || null, fileUrl || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err });

        const savedMsg = {
          id: result.insertId,
          from_id,
          to_id,
          message: msg || null,
          image: fileUrl || null,
          created_at: new Date(),
        };

        // Emit via socket
        const targetSocket = onlineUsers.get(parseInt(to_id));
        if (targetSocket) {
          io.to(targetSocket).emit("recive-msg", savedMsg);
        }

        res.json(savedMsg);
      }
    );
  }
);

app.post("/send-message", (req, res) => {
  const { from_id, to_id, msg } = req.body;

  if (!from_id || !to_id) {
    return res.status(400).json({ error: "from_id and to_id are required" });
  }

  db.query(
    "INSERT INTO messages (from_id, to_id, message, image) VALUES (?, ?, ?, ?)",
    [from_id, to_id, msg || null, null],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      const savedMsg = {
        id: result.insertId,
        from_id,
        to_id,
        message: msg || null,
        image: null,
        created_at: new Date(),
      };

      const targetSocket = onlineUsers.get(parseInt(to_id));
      if (targetSocket) {
        io.to(targetSocket).emit("recive-msg", savedMsg);
      }

      res.json(savedMsg);
    }
  );
});

// ----------------- WebSocket -----------------
const onlineUsers = new Map();

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
