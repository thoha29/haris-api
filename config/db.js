require('dotenv').config();
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  //port: Number(process.env.DB_PORT),
  dateStrings: true,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

const promisePool = pool.promise();

// Test koneksi awal
pool.getConnection((err, connection) => {
  if (err) {
    console.error('DB Error:', err);
  } else {
    console.log('MySQL Connected (Pool)');
    connection.release();
  }
});

// 🔥 FUNCTION RETRY
async function queryWithRetry(sql, params = [], retries = 3) {
  try {
    return await promisePool.query(sql, params);
  } catch (err) {
    if (
      retries > 0 &&
      (err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT')
    ) {
      console.warn(`[DB] Connection lost, retrying... (${3 - retries + 1})`);

      await new Promise((res) => setTimeout(res, 1000));
      return queryWithRetry(sql, params, retries - 1);
    }

    throw err;
  }
}

// Hybrid export
const db = {
  query(sql, params, callback) {
    // callback style
    if (typeof params === 'function') {
      return pool.query(sql, params);
    }

    if (typeof callback === 'function') {
      return pool.query(sql, params, callback);
    }

    // promise style (pakai retry)
    return queryWithRetry(sql, params);
  },

  getConnection: pool.getConnection.bind(pool),
};

module.exports = db;
