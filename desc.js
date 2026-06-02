const mysql = require("mysql2");
const fs = require("fs");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "payroll"
});

db.connect(err => {
  if (err) {
    console.error("DB Error:", err);
    process.exit(1);
  }
  db.query("DESCRIBE absensi", (err, results) => {
    if (err) {
      console.error(err);
    } else {
      fs.writeFileSync("desc_absensi.json", JSON.stringify(results, null, 2));
      console.log("Done");
    }
    process.exit(0);
  });
});
