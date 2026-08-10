const db = require('../config/db');
const bcrypt = require('bcrypt');
const { generateToken } = require('../helpers/jwt');

exports.login = (req, res) => {
    const { username, password } = req.body;

    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, results) => {
            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: 'Username tidak terdaftar'
                });
            }

            const user = results[0];

            bcrypt.compare(password, user.password, (err, isMatch) => {

                console.log('====================');
                console.log('Username DB:', user.username);
                console.log('Password Input:', password);
                console.log('Match:', isMatch);
                console.log('====================');

                if (err) {
                    return res.status(500).json({
                        error: err.message
                    });
                }

                if (!isMatch) {
                    return res.status(401).json({
                        message: 'Password salah'
                    });
                }

                const token = generateToken(user);

                res.json({
                    token,
                    role: user.role,
                    id_user: user.id_user
                });
            });
        }
    );
};

exports.changePassword = (req, res) => {
    if (!req.user || !req.user.id_user) {
        return res.status(401).json({ message: 'Akses tidak sah, token tidak valid' });
    }

    const password_saat_ini = req.body.password_saat_ini || req.body.current_password || req.body.old_password;
    const password_baru = req.body.password_baru || req.body.new_password;
    const password_baru_confirm = req.body.password_baru_confirm || req.body.confirm_password || req.body.new_password_confirmation || req.body.password_confirm;

    if (!password_saat_ini || !password_baru || !password_baru_confirm) {
        return res.status(400).json({
            message: 'Password saat ini, password baru, dan konfirmasi password baru harus diisi'
        });
    }

    if (password_baru !== password_baru_confirm) {
        return res.status(400).json({
            message: 'Konfirmasi password baru tidak cocok'
        });
    }

    const userId = req.user.id_user;

    db.query(
        'SELECT * FROM users WHERE id_user = ?',
        [userId],
        (err, results) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            if (results.length === 0) {
                return res.status(404).json({ message: 'User tidak ditemukan' });
            }

            const user = results[0];

            bcrypt.compare(password_saat_ini, user.password, (err, isMatch) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }

                if (!isMatch) {
                    return res.status(400).json({ message: 'Password saat ini salah' });
                }

                bcrypt.hash(password_baru, 10, (err, hashedPassword) => {
                    if (err) {
                        return res.status(500).json({ error: 'Gagal memproses password baru' });
                    }

                    db.query(
                        'UPDATE users SET password = ? WHERE id_user = ?',
                        [hashedPassword, userId],
                        (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: err.message });
                            }

                            return res.status(200).json({ message: 'Password berhasil diubah' });
                        }
                    );
                });
            });
        }
    );
};

