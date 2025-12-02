const db = require('../db/connection');
const bcrypt = require('bcryptjs');

exports.getLogin = (req, res) => res.render('auth/login', { error: null });
exports.getRegister = (req, res) => res.render('auth/register', { error: null });

exports.postRegister = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        // Хешуємо пароль
        const hash = await bcrypt.hash(password, 10);
        await db.runDBCommand(`
            INSERT INTO \`User\` (username, email, password_hash) 
            VALUES ('${username}', '${email}', '${hash}')
        `);
        res.redirect('/auth/login');
    } catch (err) {
        res.render('auth/register', { error: 'Помилка реєстрації. Можливо, email зайнятий.' });
    }
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await db.runDBCommand(`SELECT * FROM \`User\` WHERE email = '${email}'`);
        if (users.length === 0) return res.render('auth/login', { error: 'Користувача не знайдено' });

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            req.session.user = user; // Зберігаємо юзера в сесії
            req.session.save(() => res.redirect('/dashboard'));
        } else {
            res.render('auth/login', { error: 'Невірний пароль' });
        }
    } catch (err) { res.status(500).send(err.message); }
};

exports.logout = (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
};