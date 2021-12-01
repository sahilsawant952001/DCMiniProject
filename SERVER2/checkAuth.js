const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

module.exports = (req, res, next) => {
    let token = req.cookies['x-access-token'];
    try {
        const decoded = jwt.verify(token, process.env.JWT_KEY);
        req.userData = decoded;
        req.body.userData = decoded;
        if(decoded.role==="user")
        {
            next();
        }
        else{
            return res.status(401).json({
                success:false,
                message: 'unauthorized user'
            });
        }

    } catch (error) {
        return res.status(401).json({
            success:false,
            message: 'unauthorized user'
        });
    }
};