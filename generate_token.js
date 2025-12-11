const jwt = require('jsonwebtoken');
require('dotenv').config();

// 生成测试用的JWT token
const payload = {
    id: 1,
    phone: '13800138000',
    current_role: 'user'
};

const secret = process.env.JWT_SECRET || 'your-secret-key';
const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT Token:');
console.log(token);
console.log('\nUse this token in Authorization header as: Bearer ' + token);

process.exit(0);