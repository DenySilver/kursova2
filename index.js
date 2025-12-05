const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./db/connection'); // Імпортуємо db тут для middleware

const app = express();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(async (req, res, next) => {
    try {
        const languages = await db.runDBCommand('SELECT * FROM Language');
        res.locals.globalLanguages = languages;

        const leaderboardData = await db.runDBCommand(`
            SELECT u.username, u.avatar_url, l.language_name, l.language_id, SUM(p.points_amount) as score
            FROM User_Point p
            JOIN \`User\` u ON p.user_id = u.user_id
            JOIN Language l ON p.language_id = l.language_id
            GROUP BY l.language_id, u.user_id
            ORDER BY l.language_id ASC, score DESC
        `);

        const leaderboards = {};
        leaderboardData.forEach(row => {
            if (!leaderboards[row.language_name]) {
                leaderboards[row.language_name] = [];
            }
            if (leaderboards[row.language_name].length < 3) {
                leaderboards[row.language_name].push(row);
            }
        });
        
        res.locals.sidebarLeaderboards = leaderboards;
        
        next();
    } catch (err) {
        console.error("Middleware Error:", err);
        next();
    }
});

const authRoutes = require('./routes/authRoutes');
const mainRoutes = require('./routes/mainRoutes');
const studyRoutes = require('./routes/studyRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/auth', authRoutes);
app.use('/', mainRoutes);
app.use('/study', studyRoutes);
app.use('/admin', adminRoutes);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));