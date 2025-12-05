const db = require('../db/connection');
const { generateCertificate } = require('../utils/certificateGenerator');

exports.getIndex = (req, res) => {
    res.redirect('/auth/login');
};

// вибір мов
exports.getDashboard = async (req, res) => {
    const userId = req.params.userId;
    try {
        const languages = await db.runDBCommand('SELECT * FROM Language');
        res.render('dashboard', { languages, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// після вибору мови
exports.getTrainingHub = async (req, res) => {
    const { userId, langId } = req.params;
    
    try {
        const lang = (await db.runDBCommand(`SELECT * FROM Language WHERE language_id=${langId}`))[0];
        // категорії і їх статистика
        const categories = await db.runDBCommand(`
            SELECT 
                c.*, 
                COUNT(w.word_id) as total_words,
                COUNT(w.word_id) as word_count,
                COUNT(CASE WHEN ud.status = 'learned' THEN 1 END) as learned_words
            FROM Category c 
            LEFT JOIN Word w ON c.category_id = w.category_id
            LEFT JOIN User_Dictionary ud ON w.word_id = ud.word_id AND ud.user_id = ${userId}
            WHERE c.language_id = ${langId}
            GROUP BY c.category_id
        `);

        // прогрес вивчення категорії
        categories.forEach(cat => {
            cat.progress = cat.total_words > 0 ? Math.round((cat.learned_words / cat.total_words) * 100) : 0;
        });

        // які слова треба повторити
        const repetitionResult = await db.runDBCommand(`
            SELECT COUNT(*) as count 
            FROM User_Dictionary ud 
            JOIN Word w ON ud.word_id = w.word_id
            JOIN Category c ON w.category_id = c.category_id
            WHERE ud.user_id = ${userId} 
            AND c.language_id = ${langId} 
            AND ud.status = 'learning'
        `);
        
        const repetitionCount = repetitionResult[0].count;

        res.render('training_hub', { lang, categories, repetitionCount, userId, langId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// профіль зі статистикою
exports.getProfile = async (req, res) => {
    const userId = req.params.userId;
    try {
        const user = (await db.runDBCommand(`
            SELECT u.*, l.league_name, l.icon 
            FROM \`User\` u 
            JOIN League l ON u.league_id = l.league_id 
            WHERE user_id=${userId}
        `))[0];

        const regDate = new Date(user.registration_date);
        const formattedDate = `${regDate.getDate().toString().padStart(2, '0')}/${(regDate.getMonth() + 1).toString().padStart(2, '0')}/${regDate.getFullYear()}`;
        user.formatted_date = formattedDate;

        const totalPoints = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
        
        const testsCount = (await db.runDBCommand(`
            SELECT COUNT(*) as c 
            FROM User_Point 
            WHERE user_id=${userId} AND event_type IN ('test', 'sprint')
        `))[0].c;
        
        const dictionary = await db.runDBCommand(`
            SELECT w.original, w.translation, ud.status, ud.repetition_level, ud.id 
            FROM User_Dictionary ud JOIN Word w ON ud.word_id = w.word_id 
            WHERE ud.user_id = ${userId}
            ORDER BY ud.id DESC
        `);

        const totalWords = dictionary.length;
        const learnedWords = dictionary.filter(w => w.status === 'learned').length;
        const totalLevel = dictionary.reduce((acc, w) => acc + w.repetition_level, 0);
        const avgLevel = totalWords > 0 ? (totalLevel / totalWords).toFixed(1) : 0;

        const achievements = await db.runDBCommand(`
            SELECT a.*, ua.date_earned 
            FROM User_Achievement ua 
            JOIN Achievement a ON ua.achievement_id = a.achievement_id 
            WHERE ua.user_id = ${userId}
            ORDER BY ua.date_earned DESC
        `);

        const activityDates = await db.runDBCommand(`
            SELECT DISTINCT DATE(date_earned) as activity_date 
            FROM User_Point 
            WHERE user_id = ${userId} 
            ORDER BY activity_date ASC
        `);

        let maxStreak = 0;
        let currentStreak = 0;
        let lastDate = null;

        activityDates.forEach(row => {
            const currentDate = new Date(row.activity_date);
            if (lastDate) {
                const diffTime = Math.abs(currentDate - lastDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays === 1) currentStreak++;
                else currentStreak = 1;
            } else currentStreak = 1;

            if (currentStreak > maxStreak) maxStreak = currentStreak;
            lastDate = currentDate;
        });

        const weeklyData = await db.runDBCommand(`
            SELECT WEEKDAY(date_earned) as weekday, SUM(points_amount) as score
            FROM User_Point
            WHERE user_id = ${userId} 
            AND YEARWEEK(date_earned, 1) = YEARWEEK(CURDATE(), 1)
            GROUP BY weekday
        `);
        const weeklyActivity = Array(7).fill(0);
        weeklyData.forEach(row => weeklyActivity[row.weekday] = row.score);
        const maxWeeklyScore = Math.max(...weeklyActivity, 10);
        
        const referer = req.get('Referrer');
        let backLink = `/user/${userId}/dashboard`;
        if (referer && referer.includes('/training')) {
            backLink = referer;
        }

        res.render('profile', { 
            user, totalPoints, testsCount, dictionary, achievements, userId, backLink,
            stats: { learnedWords, avgLevel, totalWords, maxStreak },
            activity: { data: weeklyActivity, max: maxWeeklyScore }
        });

    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// генерація сертифіката
exports.getCertificate = async (req, res) => {
    const userId = req.params.userId;

    try {
        const user = (await db.runDBCommand(`
            SELECT u.username, l.league_name 
            FROM \`User\` u 
            JOIN League l ON u.league_id = l.league_id 
            WHERE u.user_id=${userId}
        `))[0];
        const totalPoints = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
        
        const testsCount = (await db.runDBCommand(`SELECT COUNT(*) as c FROM User_Point WHERE user_id=${userId} AND event_type IN ('test', 'sprint')`))[0].c;
        
        const dictionary = await db.runDBCommand(`SELECT COUNT(*) as count FROM User_Dictionary WHERE user_id=${userId} AND status='learned'`);
        const learnedCount = dictionary[0].count;

        const achievements = await db.runDBCommand(`SELECT COUNT(*) as count FROM User_Achievement WHERE user_id=${userId}`);
        const achievementsCount = achievements[0].count;

        const stats = {
            totalPoints,
            testsCount,
            learnedCount,
            achievementsCount
        };

        generateCertificate(user, stats, res);

    } catch (err) {
        console.error(err);
        res.status(500).send("Помилка при генерації сертифіката");
    }
};

// редагування профілю
exports.getEditProfile = async (req, res) => {
    const userId = req.params.userId;
    const user = (await db.runDBCommand(`SELECT * FROM \`User\` WHERE user_id=${userId}`))[0];
    res.render('edit_profile', { user, userId });
};

// пост метод редагування профілю
exports.postEditProfile = async (req, res) => {
    const userId = req.params.userId;
    const { username, email, password, avatar_url } = req.body;
    
    try {
        let query = `
            UPDATE \`User\` 
            SET username='${username}', 
                email='${email}', 
                avatar_url='${avatar_url}'
        `;

        if (password && password.trim() !== "") {
            query += `, password_hash='${password}'`;
        }

        query += ` WHERE user_id=${userId}`;

        await db.runDBCommand(query);
        res.redirect(`/user/${userId}`);
    } catch (err) {
        console.error(err);
        res.status(500).send("Помилка при оновленні профілю.");
    }
};