const db = require('./config/db');

console.log("Checking tables...");
db.query("SHOW TABLES LIKE '%skema%'", (err, res) => {
    if (err) console.error(err);
    else {
        console.log("Tables:");
        console.log(res);
        
        // Cek isi dari tabel-tabel tersebut
        db.query("DESCRIBE skema_gaji", (err2, res2) => {
            if (err2) console.log("Table skema_gaji doesn't exist.");
            else {
                console.log("skema_gaji schema:");
                console.log(res2);
            }
            process.exit(0);
        });
    }
});
