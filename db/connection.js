const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'MyNewPass123!', 
    database: 'LanguageDB'
});

connection.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

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