import db from "../../config/db.js";

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

    res.json({message: msg, image: fileUrl});
  }

export const saveMsg = (req, res) => {
  const { from_id, to_id, msg, reply_to } = req.body;

  if (!from_id || !to_id) {
    return res.status(400).json({ error: "from_id and to_id are required" });
  }

  res.json({message: msg, reply_to: reply_to});

}

// Edit a message
export const editMessage = (req, res) => {
  const { messageId, newMessage } = req.body;

  db.query(
    `UPDATE messages 
     SET message = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [newMessage, messageId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Message updated" });
    }
  );
};

// Soft delete a message
export const deleteMessage = (req, res) => {
  const { messageId } = req.body;

  db.query(
    `UPDATE messages 
     SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [messageId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: "Message deleted" });
    }
  );
};
