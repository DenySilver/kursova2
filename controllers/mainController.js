const db = require('../db/connection');

// Головне меню: Вибір мови
exports.getDashboard = async (req, res) => {
    const languages = await db.runDBCommand('SELECT * FROM Language');
    res.render('dashboard', { languages });
};

// Хаб тренувань (після вибору мови)
exports.getTrainingHub = async (req, res) => {
    const langId = req.params.langId;
    const lang = (await db.runDBCommand(`SELECT * FROM Language WHERE language_id=${langId}`))[0];
    const categories = await db.runDBCommand(`SELECT * FROM Category WHERE language_id=${langId}`);
    
    res.render('training_hub', { lang, categories });
};

// Профіль
exports.getProfile = async (req, res) => {
    const userId = req.session.user.user_id;
    
    // Оновлена статистика
    const user = (await db.runDBCommand(`SELECT u.*, l.league_name, l.icon FROM \`User\` u JOIN League l ON u.league_id = l.league_id WHERE user_id=${userId}`))[0];
    const totalPoints = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
    
    // Статистика по тестах
    const testsCount = (await db.runDBCommand(`SELECT COUNT(*) as c FROM Test WHERE user_id=${userId}`))[0].c;
    
    res.render('profile', { user, totalPoints, testsCount });
};

// Редагування профілю
exports.getEditProfile = (req, res) => res.render('edit_profile', { user: req.session.user });

exports.postEditProfile = async (req, res) => {
    const { username, avatar_url } = req.body;
    const userId = req.session.user.user_id;
    
    await db.runDBCommand(`UPDATE \`User\` SET username='${username}', avatar_url='${avatar_url}' WHERE user_id=${userId}`);
    
    // Оновлюємо сесію
    req.session.user.username = username;
    req.session.user.avatar_url = avatar_url;
    
    res.redirect('/profile');
};