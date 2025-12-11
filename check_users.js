const db = require('./config/database');

async function checkUsers() {
    try {
        console.log('Checking users table...');
        
        // 检查表是否存在
        const tables = await db.query("SHOW TABLES LIKE 'users'");
        console.log('Tables found:', tables);
        
        if (tables.length > 0) {
            // 查询所有用户
            const users = await db.query('SELECT * FROM users');
            console.log('Users in database:');
            console.log(users);
            
            // 查询特定用户
            const user1 = await db.query('SELECT * FROM users WHERE id = ?', [1]);
            console.log('User with id=1:');
            console.log(user1);
        } else {
            console.log('Users table does not exist!');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

checkUsers();