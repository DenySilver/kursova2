const db = require('../db/connection');

// 1. Інтервальне повторення (сторінка)
exports.getRepetition = async (req, res) => {
    const userId = req.session.user.user_id;
    const langId = req.params.langId;

    try {
        const query = `
            SELECT ud.id as record_id, w.original, w.translation, w.image_url 
            FROM User_Dictionary ud
            JOIN Word w ON ud.word_id = w.word_id
            JOIN Category c ON w.category_id = c.category_id
            WHERE ud.user_id = ${userId} 
            AND c.language_id = ${langId}
            AND ud.next_review <= NOW()
            LIMIT 10
        `;
        const words = await db.runDBCommand(query);
        res.render('modes/cards', { words, mode: 'repetition', title: 'Інтервальне повторення' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Помилка сервера");
    }
};

// 2. Флеш-картки (сторінка)
exports.getFlashcards = async (req, res) => {
    const { langId, catId } = req.params;
    try {
        let query = `
            SELECT 0 as record_id, w.word_id, w.original, w.translation, w.image_url 
            FROM Word w JOIN Category c ON w.category_id = c.category_id
            WHERE c.language_id = ${langId}
        `;
        
        if (catId) query += ` AND c.category_id = ${catId}`;
        query += ` ORDER BY RAND() LIMIT 20`; 

        const words = await db.runDBCommand(query);
        res.render('modes/cards', { words, mode: 'flashcards', title: catId ? 'Картки: Категорія' : 'Всі картки' });
    } catch (err) {
        console.error(err);
        res.status(500).send("Помилка сервера");
    }
};

// 3. Тест (сторінка)
exports.getTest = async (req, res) => {
    const langId = req.params.langId;
    try {
        const questions = await db.runDBCommand(`
            SELECT w.word_id, w.original, w.translation 
            FROM Word w JOIN Category c ON w.category_id = c.category_id
            WHERE c.language_id = ${langId}
            ORDER BY RAND() LIMIT 5
        `);

        for (let q of questions) {
            const wrong = await db.runDBCommand(`
                SELECT translation FROM Word 
                WHERE word_id != ${q.word_id} ORDER BY RAND() LIMIT 3
            `);
            q.options = [q.translation, ...wrong.map(w => w.translation)].sort(() => Math.random() - 0.5);
        }

        res.render('modes/test', { questions, langId });
    } catch (err) {
        console.error(err);
        res.status(500).send("Помилка сервера");
    }
};

// 4. Збереження результату тесту (API)
exports.postTestResult = async (req, res) => {
    const { score, total } = req.body;
    const userId = req.session.user.user_id;

    try {
        await db.runDBCommand(`INSERT INTO Test (user_id, score) VALUES (${userId}, ${score})`);
        
        const points = score * 5;
        await db.runDBCommand(`INSERT INTO User_Point (user_id, points_amount, event_type) VALUES (${userId}, ${points}, 'test')`);

        res.json({ success: true, points });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Обробка картки "Знаю/Не знаю" (API - AJAX)
// САМЕ ЦІЄЇ ФУНКЦІЇ ВАМ НЕ ВИСТАЧАЛО
exports.processReview = async (req, res) => {
    const { record_id, is_correct } = req.body;
    const userId = req.session.user.user_id;

    try {
        // Якщо це просто флеш-картки (record_id == 0), то ми не зберігаємо прогрес, тільки бали
        if (record_id == 0) {
            return res.json({ success: true, points_earned: 0, days_added: 0 });
        }

        const record = (await db.runDBCommand(`SELECT repetition_level FROM User_Dictionary WHERE id=${record_id}`))[0];
        
        if (!record) return res.json({ success: false });

        let level = record.repetition_level;
        let points = 0;

        if (is_correct === 'yes') {
            level++;
            points = 10;
        } else {
            level = 1; 
            points = 2; 
        }
        
        const days = Math.pow(2, level); 

        await db.runDBCommand(`
            UPDATE User_Dictionary 
            SET repetition_level=${level}, 
                next_review=DATE_ADD(NOW(), INTERVAL ${days} DAY), 
                last_reviewed_date=NOW(), 
                status='learning'
            WHERE id=${record_id}
        `);

        await db.runDBCommand(`
            INSERT INTO User_Point (user_id, points_amount, event_type) 
            VALUES (${userId}, ${points}, 'review')
        `);

        // Оновлення ліги
        const scoreRes = await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`);
        const totalScore = scoreRes[0].s || 0;
        const leagueRes = await db.runDBCommand(`SELECT league_id FROM League WHERE min_rating <= ${totalScore} ORDER BY min_rating DESC LIMIT 1`);
        
        if (leagueRes.length > 0) {
            await db.runDBCommand(`UPDATE \`User\` SET league_id=${leagueRes[0].league_id} WHERE user_id=${userId}`);
        }

        res.json({ success: true, points_earned: points, days_added: days });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};