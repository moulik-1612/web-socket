import db from "../../config/db.js";
import { onlineUsers } from "../../app.js";

export const showChatHistory = (req, res) => {
  const { from, to } = req.params;
  db.query(
    "SELECT * FROM messages WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?) ORDER BY created_at ASC",
    [from, to, to, from],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err });
      res.json(rows);
    }
  );
}

export const saveMsgWithImg =   (req, res) => {
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

export const saveMsg = (req, res) => {
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
}