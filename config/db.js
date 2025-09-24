import mysql from "mysql2";

// ----------------- MySQL Connection -----------------
// const db = mysql.createConnection({
//   host: "localhost",
//   user: "komal_pubup",   // XAMPP default
//   password: "p+MOy1A(Rc^O#l{I",   // XAMPP default is empty
//   database: "pubup",
// });

const db = mysql.createConnection({
  host: "localhost",
  user: "root",   // XAMPP default
  password: "",   // XAMPP default is empty
  database: "chat_app",
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
      username VARCHAR(100) NOT NULL,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

db.query(
  `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      from_id INT,
      to_id INT,
      message TEXT,
      image TEXT,                   
      reply_to INT DEFAULT NULL,
      seen TINYINT(1) DEFAULT 0,
      is_edited TINYINT(1) DEFAULT 0,
      is_deleted TINYINT(1) DEFAULT 0,
      updated_at TIMESTAMP NULL DEFAULT NULL,
      deleted_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_id) REFERENCES myapp_user(id) ON DELETE CASCADE,
      FOREIGN KEY (to_id) REFERENCES myapp_user(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
  )`
);

});

export default db;
