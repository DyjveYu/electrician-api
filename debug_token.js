const jwt = require('jsonwebtoken');
require('dotenv').config();

// 测试JWT token解码
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicGhvbmUiOiIxMzgwMDEzODAwMCIsImN1cnJlbnRfcm9sZSI6InVzZXIiLCJpYXQiOjE3NTg5NTMxMzcsImV4cCI6MTc1ODk1NjczN30.T0jLTZKqje9qclpmY5aF8eAoxkVhFpwBbwNcAuIySFU';

try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('Decoded JWT payload:');
    console.log(JSON.stringify(decoded, null, 2));
    console.log('decoded.id:', decoded.id);
    console.log('typeof decoded.id:', typeof decoded.id);
} catch (error) {
    console.error('JWT decode error:', error.message);
}

process.exit(0);