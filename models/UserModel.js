const db = require("../config/db");

exports.findByUsernameAndRole = (username, role, callback) => {
  const sql = "SELECT * FROM users WHERE username = ? AND role = ?";
  db.query(sql, [username, role], callback);
};
