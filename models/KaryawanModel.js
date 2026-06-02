const db = require('../config/db');

class Karyawan {
    static getAll(cb) {
        db.query('SELECT id_user, username, role, created_at FROM users ORDER BY id_user DESC', (err, rows) => {
            cb(err, rows);
        });
    }

    static create(data, cb) {
        const { username, password, role } = data;
        db.query(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, password, role],
            (err, result) => {
                cb(err, result);
            }
        );
    }

    static update(id, data, cb) {
        const { username, role, password } = data;
        if (password) {
            db.query(
                'UPDATE users SET username = ?, role = ?, password = ? WHERE id_user = ?',
                [username, role, password, id],
                (err, result) => cb(err, result)
            );
        } else {
            db.query(
                'UPDATE users SET username = ?, role = ? WHERE id_user = ?',
                [username, role, id],
                (err, result) => cb(err, result)
            );
        }
    }

    static delete(id, cb) {
        db.query('DELETE FROM users WHERE id_user = ?', [id], (err, result) => {
            cb(err, result);
        });
    }
}

module.exports = Karyawan;