const jwt = require('jsonwebtoken');

exports.generateToken = (user) => {
    return jwt.sign(
        { id_user: user.id_user, role: user.role },
        process.env.SECRET_CODE,
        { expiresIn: '24h' }
    );
};