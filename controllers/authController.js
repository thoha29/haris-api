const db = require('../config/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../helpers/jwt');

exports.login = (req, res) => {
    const { username, password } = req.body;
    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ message: "username tidak terdaftar" });

        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!isMatch) return res.status(401).json({ message: "Password salah" });

            const token = generateToken(user);
            res.json({ token, role: user.role, id_user: user.id_user });
        });
    });
};