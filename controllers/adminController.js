const db = require('../db/connection');

// таблиці, первинні ключі
const tablesConfig = {
    'User': 'user_id',
    'Language': 'language_id',
    'Category': 'category_id',
    'Word': 'word_id',
    'Achievement': 'achievement_id',
    'User_Achievement': 'collection_id',
    'League': 'league_id',
    'User_Dictionary': 'id',
    'User_Point': 'point_id'
};
// рендер сторінки
exports.getDashboard = async (req, res) => {
    res.render('admin_dashboard', { tables: Object.keys(tablesConfig) });
};

exports.getTableData = async (req, res) => {
    const { tableName } = req.params;
    const filters = req.query;

    if (!tablesConfig[tableName]) return res.status(400).json({ error: "Invalid table" });

    try {
        let query = `SELECT * FROM \`${tableName}\``;
        // фільтри
        const conditions = [];
        for (const [key, value] of Object.entries(filters)) {
            conditions.push(`\`${key}\` = '${value}'`); 
        }
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        const data = await db.runDBCommand(query);
        // назви колонок
        let columns = [];
        if (data.length > 0) {
            columns = Object.keys(data[0]);
        } else {
            const colsData = await db.runDBCommand(`SHOW COLUMNS FROM \`${tableName}\``);
            columns = colsData.map(c => c.Field);
        }
        res.json({ data, columns, pk: tablesConfig[tableName] });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// додавання
exports.addRecord = async (req, res) => {
    const { tableName } = req.params;
    const data = req.body;
    
    try {
        const keys = Object.keys(data).map(k => `\`${k}\``).join(',');
        const values = Object.values(data).map(v => `'${v}'`).join(',');
        
        await db.runDBCommand(`INSERT INTO \`${tableName}\` (${keys}) VALUES (${values})`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// оновлення
exports.updateRecord = async (req, res) => {
    const { tableName, id } = req.params;
    const data = req.body;
    const pk = tablesConfig[tableName];

    try {
        let updates = [];
        for (const [key, value] of Object.entries(data)) {
            updates.push(`\`${key}\`='${value}'`);
        }
        await db.runDBCommand(`UPDATE \`${tableName}\` SET ${updates.join(', ')} WHERE \`${pk}\`=${id}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// видалення
exports.deleteRecord = async (req, res) => {
    const { tableName, id } = req.params;
    const pk = tablesConfig[tableName];

    try {
        await db.runDBCommand(`DELETE FROM \`${tableName}\` WHERE \`${pk}\`=${id}`);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
};