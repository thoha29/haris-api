const jwt = require('jsonwebtoken');

exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: "Token tidak ditemukan" });

    try {
        const decoded = jwt.verify(token, process.env.SECRET_CODE);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(403).json({ message: "Token tidak valid" });
    }
};

exports.authorizeRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Akses ditolak: Izin tidak cukup" });
        }
        next();
    };
};