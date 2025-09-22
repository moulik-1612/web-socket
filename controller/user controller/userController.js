import db from "../../config/db.js";

const sendAllUser = async (req, res) => {
  db.query("SELECT * FROM myapp_user", (err, rows) => {
    if (err) return res.status(500).json({ error: err });
    res.json(rows);
  });
}

export default sendAllUser;