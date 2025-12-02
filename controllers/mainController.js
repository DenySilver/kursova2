const db = require('../db/connection');

exports.getIndex = (req, res) => {
    res.redirect('/auth/login');
};

exports.getDashboard = async (req, res) => {
    const userId = req.params.userId;
    try {
        const languages = await db.runDBCommand('SELECT * FROM Language');
        res.render('dashboard', { languages, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getTrainingHub = async (req, res) => {
    const { userId, langId } = req.params;
    
    try {
        const lang = (await db.runDBCommand(`SELECT * FROM Language WHERE language_id=${langId}`))[0];
        
        const categories = await db.runDBCommand(`
            SELECT c.*, COUNT(w.word_id) as word_count 
            FROM Category c 
            LEFT JOIN Word w ON c.category_id = w.category_id
            WHERE c.language_id = ${langId}
            GROUP BY c.category_id
        `);

        const repetitionResult = await db.runDBCommand(`
            SELECT COUNT(*) as count 
            FROM User_Dictionary ud 
            JOIN Word w ON ud.word_id = w.word_id
            JOIN Category c ON w.category_id = c.category_id
            WHERE ud.user_id = ${userId} 
            AND c.language_id = ${langId} 
            AND ud.next_review <= NOW()
        `);
        
        const repetitionCount = repetitionResult[0].count;

        res.render('training_hub', { lang, categories, repetitionCount, userId, langId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getProfile = async (req, res) => {
    const userId = req.params.userId;
    try {
        const user = (await db.runDBCommand(`
            SELECT u.*, l.league_name, l.icon 
            FROM \`User\` u 
            JOIN League l ON u.league_id = l.league_id 
            WHERE user_id=${userId}
        `))[0];

        const totalPoints = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
        const testsCount = (await db.runDBCommand(`SELECT COUNT(*) as c FROM Test WHERE user_id=${userId}`))[0].c;
        
        const dictionary = await db.runDBCommand(`
            SELECT w.original, w.translation, ud.status, ud.repetition_level 
            FROM User_Dictionary ud JOIN Word w ON ud.word_id = w.word_id 
            WHERE ud.user_id = ${userId} LIMIT 20
        `);

        const achievements = await db.runDBCommand(`
            SELECT a.* FROM User_Achievement ua 
            JOIN Achievement a ON ua.achievement_id = a.achievement_id 
            WHERE ua.user_id = ${userId}
        `);
        
        res.render('profile', { user, totalPoints, testsCount, dictionary, achievements, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getLeaderboard = async (req, res) => {
    try {
        const userId = req.query.userId; 
        const leaders = await db.runDBCommand(`
            SELECT u.username, u.avatar_url, l.icon, SUM(p.points_amount) as score
            FROM \`User\` u
            LEFT JOIN User_Point p ON u.user_id = p.user_id
            JOIN League l ON u.league_id = l.league_id
            GROUP BY u.user_id
            ORDER BY score DESC LIMIT 10
        `);
        res.render('leaderboard', { leaders, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getEditProfile = async (req, res) => {
    const userId = req.params.userId;
    const user = (await db.runDBCommand(`SELECT * FROM \`User\` WHERE user_id=${userId}`))[0];
    res.render('edit_profile', { user, userId });
};

exports.postEditProfile = async (req, res) => {
    const userId = req.params.userId;
    const { username, avatar_url } = req.body;
    await db.runDBCommand(`UPDATE \`User\` SET username='${username}', avatar_url='${avatar_url}' WHERE user_id=${userId}`);
    res.redirect(`/user/${userId}`);
};