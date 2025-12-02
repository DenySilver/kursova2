const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root', // Ваш логін
    password: 'MyNewPass123!', // Ваш пароль
    database: 'LanguageDB'
});

connection.connect(err => {
    if (err) throw err;
    console.log('✅ Connected to MySQL Database');
});

// Обгортка для використання async/await
function runDBCommand(query) {
    return new Promise((resolve, reject) => {
        connection.query(query, (error, results) => {
            if (error) {
                console.error("SQL Error:", error); 
                reject(error);
            } else resolve(results);
        });
    });
}

module.exports = { runDBCommand };