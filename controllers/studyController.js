const db = require('../db/connection');

exports.getCategorySession = async (req, res) => {
    const { userId, langId, catId } = req.params;
    try {
        const query = `
            SELECT IFNULL(ud.id, 0) as record_id, w.word_id, w.original, w.translation, w.image_url 
            FROM Word w LEFT JOIN User_Dictionary ud ON w.word_id = ud.word_id AND ud.user_id = ${userId}
            WHERE w.category_id = ${catId} ORDER BY RAND() LIMIT 20
        `;
        const words = await db.runDBCommand(query);
        const category = (await db.runDBCommand(`SELECT category_name FROM Category WHERE category_id = ${catId}`))[0];
        res.render('modes/cards', { words, mode: 'category_learn', title: category.category_name, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getRepetition = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        const query = `
            SELECT ud.id as record_id, w.word_id, w.original, w.translation, w.image_url 
            FROM User_Dictionary ud
            JOIN Word w ON ud.word_id = w.word_id
            JOIN Category c ON w.category_id = c.category_id
            WHERE ud.user_id = ${userId} AND c.language_id = ${langId} AND ud.next_review <= NOW()
            LIMIT 15
        `;
        const words = await db.runDBCommand(query);
        res.render('modes/cards', { words, mode: 'repetition', title: 'Інтервальне повторення', userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.getTest = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        const questions = await db.runDBCommand(`
            SELECT w.word_id, w.original, w.translation 
            FROM Word w JOIN Category c ON w.category_id = c.category_id
            WHERE c.language_id = ${langId} ORDER BY RAND() LIMIT 5
        `);
        for (let q of questions) {
            const wrong = await db.runDBCommand(`SELECT translation FROM Word WHERE word_id != ${q.word_id} ORDER BY RAND() LIMIT 3`);
            q.options = [q.translation, ...wrong.map(w => w.translation)].sort(() => Math.random() - 0.5);
        }
        res.render('modes/test', { questions, langId, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

exports.postTestResult = async (req, res) => {
    const userId = req.params.userId;
    const { score } = req.body;
    await db.runDBCommand(`INSERT INTO Test (user_id, score) VALUES (${userId}, ${score})`);
    const points = score * 5;
    await db.runDBCommand(`INSERT INTO User_Point (user_id, points_amount, event_type) VALUES (${userId}, ${points}, 'test')`);
    res.json({ success: true, points });
};

exports.processReview = async (req, res) => {
    const { userId, record_id, word_id, is_correct } = req.body;

    try {
        let currentRecordId = record_id;

        if (!currentRecordId || currentRecordId == 0) {
            const result = await db.runDBCommand(`
                INSERT INTO User_Dictionary (user_id, word_id, status, repetition_level, next_review)
                VALUES (${userId}, ${word_id}, 'new', 0, NOW())
            `);
            currentRecordId = result.insertId;
        }

        const record = (await db.runDBCommand(`SELECT repetition_level FROM User_Dictionary WHERE id=${currentRecordId}`))[0];
        let level = record.repetition_level;
        let points = 0;

        if (is_correct === 'yes') { level++; points = 10; } 
        else { level = 1; points = 2; }
        
        const days = Math.pow(2, level);

        await db.runDBCommand(`
            UPDATE User_Dictionary SET repetition_level=${level}, next_review=DATE_ADD(NOW(), INTERVAL ${days} DAY), 
            last_reviewed_date=NOW(), status='learning' WHERE id=${currentRecordId}
        `);

        await db.runDBCommand(`INSERT INTO User_Point (user_id, points_amount, event_type) VALUES (${userId}, ${points}, 'review')`);

        const totalScore = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
        const newLeague = (await db.runDBCommand(`SELECT league_id FROM League WHERE min_rating <= ${totalScore} ORDER BY min_rating DESC LIMIT 1`))[0];
        if (newLeague) {
            await db.runDBCommand(`UPDATE \`User\` SET league_id=${newLeague.league_id} WHERE user_id=${userId}`);
        }

        res.json({ success: true, points_earned: points });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};