const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Налаштування сесій
app.use(session({
    secret: 'super_secret_key_123', // В реальному проекті це має бути складний ключ
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Сесія живе 1 годину
}));

// Middleware для передачі user у всі views (щоб показувати аватар в меню)
app.use(async (req, res, next) => {
    res.locals.currentUser = req.session.user || null;
    next();
});

// Підключення маршрутів
const authRoutes = require('./routes/authRoutes');
const mainRoutes = require('./routes/mainRoutes');
const studyRoutes = require('./routes/studyRoutes');

app.use('/auth', authRoutes);
app.use('/', mainRoutes);
app.use('/study', studyRoutes);

app.listen(3000, () => console.log('🚀 Server running on http://localhost:3000'));