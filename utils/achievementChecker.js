const db = require('../db/connection');

async function checkAndAward(userId) {
    const newUnlocked = [];

    try {
        // слова які почали вчити
        const wordsCount = (await db.runDBCommand(`
            SELECT COUNT(*) as c FROM User_Dictionary 
            WHERE user_id=${userId} AND repetition_level > 0
        `))[0].c;
        
        // тести
        const testsCount = (await db.runDBCommand(`
            SELECT COUNT(*) as c FROM User_Point 
            WHERE user_id=${userId} AND event_type IN ('test', 'sprint')
        `))[0].c;
        
        // XP
        const totalXPResult = await db.runDBCommand(`
            SELECT SUM(points_amount) as s FROM User_Point 
            WHERE user_id=${userId}
        `);
        const totalXP = totalXPResult[0].s || 0;

        const userStats = {
            'words': wordsCount,
            'tests': testsCount,
            'xp': totalXP
        };

        // вже отримані
        const existingRaw = await db.runDBCommand(`SELECT achievement_id FROM User_Achievement WHERE user_id=${userId}`);
        const existingIds = new Set(existingRaw.map(r => r.achievement_id));

        // всі ачівки і їх отримання
        const allAchievements = await db.runDBCommand("SELECT * FROM Achievement");

        // перевірка
        for (const ach of allAchievements) {
            if (existingIds.has(ach.achievement_id)) continue;

            const type = ach.condition_type;
            const target = ach.condition_value; 
            
            if (!userStats.hasOwnProperty(type) || !target) continue;

            const currentValue = userStats[type];

            if (currentValue >= target) {
                await db.runDBCommand(`
                    INSERT INTO User_Achievement (user_id, achievement_id) 
                    VALUES (${userId}, ${ach.achievement_id})
                `);
                
                newUnlocked.push(ach);
            }
        }

    } catch (err) {
        console.error("Achievement Checker Error:", err);
    }

    return newUnlocked;
}

module.exports = { checkAndAward };