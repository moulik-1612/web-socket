import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mysql from "mysql2";

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
      FOREIGN KEY (to_id) REFERENCES myapp_user(id) ON DELETE CASCADE
    )`
  );
});

// ----------------- Express + Socket.IO -----------------
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

// ----------------- REST APIs -----------------

// Add user
app.post("/users", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username required" });

  db.query("INSERT INTO users (username) VALUES (?)", [username], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    res.json({ id: result.insertId, username });
  });
});

// Get all users
app.get("/users", (req, res) => {
  db.query("SELECT * FROM myapp_user", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
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

// Post new message
app.post("/messages", (req, res) => {
  const { from_id, to_id, message } = req.body;

  if (!from_id || !to_id || !message) {
    return res.status(400).json({ error: "from_id, to_id and message are required" });
  }

  db.query(
    "INSERT INTO messages (from_id, to_id, message) VALUES (?, ?, ?)",
    [from_id, to_id, message],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });

      res.json({
        id: result.insertId,
        from_id,
        to_id,
        message,
        created_at: new Date()
      });
    }
  );
});


// ----------------- WebSocket -----------------
const onlineUsers = new Map();

io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId;
  if (!userId) return next(new Error("no user id"));
  socket.userId = userId;
  next();
});

io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);

  // Private message
  socket.on("private-msg", ({ msg, to }) => {
    const fromId = socket.userId;

    // Save to DB
    db.query(
      "INSERT INTO messages (from_id, to_id, message) VALUES (?, ?, ?)",
      [fromId, to, msg]
    );

    // Send to recipient if online
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("recive-msg", { msg, from: fromId });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.userId}`);
    onlineUsers.delete(socket.userId);
  });
});

// ----------------- Start Server -----------------
const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
