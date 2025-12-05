const db = require('../db/connection');
const { checkAndAward } = require('../utils/achievementChecker'); 

// отримання категорій
exports.getCatalog = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        const categories = await db.runDBCommand(`
            SELECT c.*, COUNT(w.word_id) as word_count 
            FROM Category c LEFT JOIN Word w ON c.category_id = w.category_id
            WHERE c.language_id = ${langId} GROUP BY c.category_id
        `);
        const lang = (await db.runDBCommand(`SELECT language_name FROM Language WHERE language_id = ${langId}`))[0];
        res.render('modes/catalog', { categories, lang, langId, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// для вивчення флеш картками по категорії
exports.getCategorySession = async (req, res) => {
    const { userId, langId, catId } = req.params;
    try {
        const query = `
            SELECT 
                IFNULL(ud.id, 0) as record_id, 
                w.word_id, 
                w.original, 
                w.translation, 
                w.image_url,
                IFNULL(ud.status, 'learning') as status,
                IFNULL(ud.repetition_level, 0) as level
            FROM Word w 
            LEFT JOIN User_Dictionary ud ON w.word_id = ud.word_id AND ud.user_id = ${userId}
            WHERE w.category_id = ${catId} 
            ORDER BY RAND() LIMIT 20
        `;
        const words = await db.runDBCommand(query);
        const category = (await db.runDBCommand(`SELECT category_name FROM Category WHERE category_id = ${catId}`))[0];
        
        res.render('modes/cards', { words, mode: 'category_learn', title: category.category_name, userId, langId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// повторення слів картками зі словника
exports.getRepetition = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        // спочату ті що гірше знаєм і давно не повторювали
        const query = `
            SELECT 
                ud.id as record_id, 
                w.word_id, 
                w.original, 
                w.translation, 
                w.image_url,
                ud.status,
                ud.repetition_level as level
            FROM User_Dictionary ud
            JOIN Word w ON ud.word_id = w.word_id
            JOIN Category c ON w.category_id = c.category_id
            WHERE ud.user_id = ${userId} 
            AND c.language_id = ${langId}
            ORDER BY ud.repetition_level ASC, ud.last_reviewed_date ASC
            LIMIT 10
        `;
        
        const words = await db.runDBCommand(query);
        res.render('modes/cards', { words, mode: 'repetition', title: 'Повторення слів', userId, langId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// тестування
exports.getTest = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        // рандомні 5 слів для питання
        const questions = await db.runDBCommand(`
            SELECT w.word_id, w.original, w.translation 
            FROM Word w JOIN Category c ON w.category_id = c.category_id
            WHERE c.language_id = ${langId} ORDER BY RAND() LIMIT 5
        `);
        // формування рандомних 3 неправильних та 1 правильного перекладу
        for (let q of questions) {
            const wrong = await db.runDBCommand(`SELECT translation FROM Word WHERE word_id != ${q.word_id} ORDER BY RAND() LIMIT 3`);
            q.options = [q.translation, ...wrong.map(w => w.translation)].sort(() => Math.random() - 0.5);
        }
        res.render('modes/test', { questions, langId, userId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// обробка тесту
exports.postTestResult = async (req, res) => {
    const userId = req.params.userId;
    const { score, langId } = req.body;
    
    try {
        await db.runDBCommand(`INSERT INTO Test (user_id, score, language_id) VALUES (${userId}, ${score}, ${langId})`);
        const points = score * 5;
        
        if (points > 0) {
            await db.runDBCommand(`INSERT INTO User_Point (user_id, points_amount, event_type, language_id) VALUES (${userId}, ${points}, 'test', ${langId})`);
            const totalScore = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
            const newLeague = (await db.runDBCommand(`SELECT league_id FROM League WHERE min_rating <= ${totalScore} ORDER BY min_rating DESC LIMIT 1`))[0];
            if (newLeague) {
                await db.runDBCommand(`UPDATE \`User\` SET league_id=${newLeague.league_id} WHERE user_id=${userId}`);
            }
        }
        const newAchievements = await checkAndAward(userId);
        res.json({ success: true, points, newAchievements });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

// обробка результатів вивчення (повторення) слів
exports.processReview = async (req, res) => {
    const { userId, record_id, word_id, is_correct, langId, mode } = req.body;

    try {
        let currentRecordId = record_id;
        let wasLearned = false;

        if (!currentRecordId || currentRecordId == 0) {
            const result = await db.runDBCommand(`
                INSERT INTO User_Dictionary (user_id, word_id, status, repetition_level, last_reviewed_date)
                VALUES (${userId}, ${word_id}, 'learning', 0, NOW())
            `);
            currentRecordId = result.insertId;
        } else {
            const oldRecord = (await db.runDBCommand(`SELECT status FROM User_Dictionary WHERE id=${currentRecordId}`))[0];
            if (oldRecord && oldRecord.status === 'learned') wasLearned = true;
        }

        const record = (await db.runDBCommand(`SELECT repetition_level FROM User_Dictionary WHERE id=${currentRecordId}`))[0];
        let level = record.repetition_level;
        let points = 0;

        if (is_correct === 'yes') { 
            level++; 
            if (mode === 'repetition') points = 10; 
            else points = wasLearned ? 0 : 10; 
        } else { 
            level = 1; 
            points = (mode === 'repetition') ? 2 : (wasLearned ? 0 : 2);
        }
        
        let newStatus = (level >= 5) ? 'learned' : 'learning';

        // оновлення дати повторення
        await db.runDBCommand(`
            UPDATE User_Dictionary 
            SET repetition_level=${level}, 
                last_reviewed_date=NOW(), 
                status='${newStatus}' 
            WHERE id=${currentRecordId}
        `);

        if (points > 0) {
            await db.runDBCommand(`INSERT INTO User_Point (user_id, points_amount, event_type, language_id) VALUES (${userId}, ${points}, 'review', ${langId})`);
            const totalScore = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
            const newLeague = (await db.runDBCommand(`SELECT league_id FROM League WHERE min_rating <= ${totalScore} ORDER BY min_rating DESC LIMIT 1`))[0];
            if (newLeague) {
                await db.runDBCommand(`UPDATE \`User\` SET league_id=${newLeague.league_id} WHERE user_id=${userId}`);
            }
        }

        const newAchievements = await checkAndAward(userId);
        res.json({ success: true, points_earned: points, is_learned: (newStatus === 'learned'), newAchievements });

    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

// спринт
exports.getSprint = async (req, res) => {
    const { userId, langId } = req.params;
    try {
        const query = `
            SELECT w.word_id, w.original, w.translation 
            FROM Word w 
            JOIN Category c ON w.category_id = c.category_id
            WHERE c.language_id = ${langId}
            ORDER BY RAND() 
            LIMIT 100
        `;
        const words = await db.runDBCommand(query);
        res.render('modes/sprint', { words, userId, langId });
    } catch (err) { console.error(err); res.status(500).send("Error"); }
};

// обробка спринту
exports.postSprintResult = async (req, res) => {
    const { userId, score, langId } = req.body;
    
    try {
        if (score > 0) {
            await db.runDBCommand(`
                INSERT INTO User_Point (user_id, points_amount, event_type, language_id) 
                VALUES (${userId}, ${score}, 'sprint', ${langId})
            `);

            const totalScore = (await db.runDBCommand(`SELECT SUM(points_amount) as s FROM User_Point WHERE user_id=${userId}`))[0].s || 0;
            const newLeague = (await db.runDBCommand(`SELECT league_id FROM League WHERE min_rating <= ${totalScore} ORDER BY min_rating DESC LIMIT 1`))[0];
            if (newLeague) {
                await db.runDBCommand(`UPDATE \`User\` SET league_id=${newLeague.league_id} WHERE user_id=${userId}`);
            }
        }

        const newAchievements = await checkAndAward(userId);
        res.json({ success: true, newAchievements });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};