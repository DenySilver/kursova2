const db = require('../db/connection');

exports.getLogin = (req, res) => res.render('auth/login', { error: null });
exports.getRegister = (req, res) => res.render('auth/register', { error: null });

exports.postRegister = async (req, res) => {
    const { username, email, password } = req.body;
    try {
        await db.runDBCommand(`
            INSERT INTO \`User\` (username, email, password_hash) 
            VALUES ('${username}', '${email}', '${password}')
        `);
        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Помилка реєстрації' });
    }
};

exports.postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const users = await db.runDBCommand(`SELECT * FROM \`User\` WHERE email = '${email}'`);
        if (users.length === 0) return res.render('auth/login', { error: 'Користувача не знайдено' });

        const user = users[0];
        if (password === user.password_hash) {
            res.redirect(`/user/${user.user_id}/dashboard`);
        } else {
            res.render('auth/login', { error: 'Невірний пароль' });
        }
    } catch (err) { res.status(500).send(err.message); }
};

exports.logout = (req, res) => {
    res.redirect('/auth/login');
};