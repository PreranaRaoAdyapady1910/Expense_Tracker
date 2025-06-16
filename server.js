const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3001;

// Middleware
app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
}));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Database setup
const db = new sqlite3.Database('expense_tracker.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the expense_tracker database.');
});

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL
    )`);

    // Groups table
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        user_id INTEGER,
        default_payer TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
    // Migration: add default_payer if not exists
    db.all("PRAGMA table_info(groups)", (err, columns) => {
        if (columns && !columns.some(col => col.name === 'default_payer')) {
            db.run('ALTER TABLE groups ADD COLUMN default_payer TEXT');
        }
    });

    // Members table
    db.run(`CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        name TEXT NOT NULL,
        budget_preference TEXT,
        FOREIGN KEY (group_id) REFERENCES groups (id)
    )`);

    // Expenses table
    db.run(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        date TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        total_amount REAL NOT NULL,
        paid_by TEXT NOT NULL,
        split_type TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups (id)
    )`);

    // Expense splits table
    db.run(`CREATE TABLE IF NOT EXISTS expense_splits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        expense_id INTEGER,
        member_name TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (expense_id) REFERENCES expenses (id)
    )`);
});

// Routes
app.post('/api/signup', async (req, res) => {
    const { username, password, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username or email already exists' });
                }
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, username });
        });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        req.session.userId = user.id;
        res.json({ id: user.id, username: user.username });
    });
});

app.post('/api/groups', (req, res) => {
    const { name, members, budgetPreferences, defaultPayer } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.run('INSERT INTO groups (name, user_id, default_payer) VALUES (?, ?, ?)',
        [name, userId, defaultPayer],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const groupId = this.lastID;
            const stmt = db.prepare('INSERT INTO members (group_id, name, budget_preference) VALUES (?, ?, ?)');

            members.forEach((member, index) => {
                stmt.run([groupId, member, budgetPreferences[index]]);
            });

            stmt.finalize();
            res.json({ id: groupId, name });
        });
});

// Get group members
app.get('/api/group-members', (req, res) => {
    const userId = req.session.userId;
    const groupId = req.query.groupId;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    db.all('SELECT name, budget_preference FROM members WHERE group_id = ?', [groupId], (err, members) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ members });
    });
});

// Add expense
app.post('/api/expenses', (req, res) => {
    const { groupId, date, transactionType, totalAmount, splitType, splits } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    // Use groupId from request if provided, otherwise get the user's group
    function insertExpense(finalGroupId, paidBy) {
        db.run(`
            INSERT INTO expenses (group_id, date, transaction_type, total_amount, paid_by, split_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [finalGroupId, date, transactionType, totalAmount, paidBy, splitType], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const expenseId = this.lastID;
            const stmt = db.prepare('INSERT INTO expense_splits (expense_id, member_name, amount) VALUES (?, ?, ?)');

            splits.forEach(split => {
                stmt.run([expenseId, split.member, split.amount]);
            });

            stmt.finalize();
            res.json({ id: expenseId });
        });
    }

    if (groupId) {
        db.get('SELECT default_payer FROM groups WHERE id = ?', [groupId], (err, group) => {
            if (err || !group) {
                return res.status(400).json({ error: 'Group not found' });
            }
            insertExpense(groupId, group.default_payer);
        });
    } else {
        db.get('SELECT id, default_payer FROM groups WHERE user_id = ?', [userId], (err, group) => {
            if (err || !group) {
                return res.status(400).json({ error: 'No group found for user' });
            }
            insertExpense(group.id, group.default_payer);
        });
    }
});

// Report endpoint
app.get('/api/report', (req, res) => {
    const userId = req.session.userId;
    const groupId = req.query.groupId;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!groupId) {
        return res.status(400).json({ error: 'No groupId provided' });
    }
    // Get all members for the group
    db.all('SELECT name FROM members WHERE group_id = ?', [groupId], (err, members) => {
        if (err) return res.status(500).json({ error: err.message });
        // Get default payer
        db.get('SELECT default_payer FROM groups WHERE id = ?', [groupId], (err, group) => {
            if (err) return res.status(500).json({ error: err.message });
            // Get all expenses for the group
            db.all('SELECT * FROM expenses WHERE group_id = ?', [groupId], (err, expenses) => {
                if (err) return res.status(500).json({ error: err.message });
                if (!expenses.length) return res.json({ members, transactions: [] });
                const expenseIds = expenses.map(e => e.id);
                if (expenseIds.length === 0) {
                    return res.json({ members, transactions: [] });
                }
                db.all(`SELECT * FROM expense_splits WHERE expense_id IN (${expenseIds.map(() => '?').join(',')})`, expenseIds, (err, splits) => {
                    if (err) return res.status(500).json({ error: err.message });
                    // Map splits by expense_id
                    const splitsByExpense = {};
                    splits.forEach(s => {
                        if (!splitsByExpense[s.expense_id]) splitsByExpense[s.expense_id] = {};
                        splitsByExpense[s.expense_id][s.member_name] = s.amount;
                    });

                    // Format transactions with splits
                    const transactions = expenses.map(expense => ({
                        id: expense.id,
                        date: expense.date,
                        transaction_type: expense.transaction_type,
                        total_amount: expense.total_amount,
                        paid_by: expense.paid_by,
                        split_type: expense.split_type,
                        splits: splitsByExpense[expense.id] || {}
                    }));

                    res.json({ members, transactions });
                });
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 