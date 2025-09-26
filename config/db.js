import mysql from "mysql2";

const db = mysql.createPool({
  host: "localhost",
  user: "root",   // XAMPP default
  password: "",   // XAMPP default is empty
  database: "chat_app",
  connectionLimit: 10
});

// ----------------- MySQL Connection Pool -----------------
// const db = mysql.createPool({
//   host: "localhost",
//   user: "komal_pubup",
//   password: "p+MOy1A(Rc^O#l{I",
//   database: "pubup",
//   connectionLimit: 10,
// });

// ----------------- Helper function to run queries -----------------
const runQuery = (query, description) => {
  db.query(query, (err, results) => {
    if (err) {
      console.error(`❌ Failed to ${description}:`, err.message);
    } else {
      console.log(`✅ ${description} successful`);
    }
  });
};

// ----------------- 1️⃣ Create myapp_user table if it doesn't exist -----------------
const createUserTableQuery = `
CREATE TABLE IF NOT EXISTS myapp_user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

runQuery(createUserTableQuery, "create myapp_user table");

// ----------------- 2️⃣ Create messages table if it doesn't exist -----------------
const createMessagesTableQuery = `
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_id VARCHAR(100),
  to_id VARCHAR(100),
  message TEXT,
  image TEXT,
  reply_to INT DEFAULT NULL,
  seen TINYINT(1) DEFAULT 0,
  is_edited TINYINT(1) DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_id) REFERENCES myapp_user(user_id) ON DELETE CASCADE,
  FOREIGN KEY (to_id) REFERENCES myapp_user(user_id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
);
`;

runQuery(createMessagesTableQuery, "create messages table");

export default db;
