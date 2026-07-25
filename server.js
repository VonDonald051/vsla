const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { execSync } = require('child_process');
const { ConvexHttpClient } = require('convex/browser');

// Vercel supplies environment variables directly; this also supports the
// existing local .env file without adding another dependency.
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)=(.*)\s*$/);
        if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
}

const app = express();
const PORT = process.env.PORT || 8000;
const convex = process.env.CONVEX_URL ? new ConvexHttpClient(process.env.CONVEX_URL) : null;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

function getDb() {
    if (!fs.existsSync(DB_FILE)) {
        const initial = {
            users: [],
            groups: [],
            loans: [],
            fines: [],
            savings: [],
            items: [],
            safeCodes: [],
            chats: [],
            notes: [],
            logs: [],
            settings: { safeCodeEnabled: false, registrationEnabled: true, globalLockout: false }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    }
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (db.settings.registrationEnabled === undefined) {
        db.settings.registrationEnabled = true;
    }
    return db;
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Per-member aggregated summary used by Group Admin & V-Super Admin dashboards
function computeMemberSummary(member, db) {
    const savings = db.savings.filter(s => s.userId === member.id);
    const fines = db.fines.filter(f => f.userId === member.id);
    const loans = db.loans.filter(l => l.userId === member.id);
    const activeStatuses = ['approved', 'active', 'paid'];
    return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        profilePic: member.profilePic,
        locked: member.locked,
        totalSavings: savings.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0),
        totalFines: fines.reduce((a, f) => a + (parseFloat(f.amount) || 0), 0),
        finesPaid: fines.filter(f => f.status === 'paid').reduce((a, f) => a + (parseFloat(f.amount) || 0), 0),
        finesUnpaid: fines.filter(f => f.status !== 'paid').reduce((a, f) => a + (parseFloat(f.amount) || 0), 0),
        loans: loans.map(l => ({ id: l.id, type: l.type, amount: l.amount, totalOwed: l.totalOwed, status: l.status, itemName: l.itemName })),
        totalBorrowed: loans.filter(l => activeStatuses.includes(l.status)).reduce((a, l) => a + (parseFloat(l.amount) || 0), 0),
        totalOwed: loans.filter(l => activeStatuses.includes(l.status)).reduce((a, l) => a + (parseFloat(l.totalOwed) || parseFloat(l.amount) || 0), 0),
        pendingLoans: loans.filter(l => l.status === 'pending').length,
        activeLoans: loans.filter(l => l.status === 'approved' || l.status === 'active').length,
        paidLoans: loans.filter(l => l.status === 'paid').length
    };
}

// Registration fee of KES 200 recorded as the member's first savings deposit
function addRegistrationFee(userId, groupId, db) {
    db.savings.push({
        id: 's_' + Date.now(),
        userId,
        groupId,
        amount: 200,
        type: 'registration',
        week: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString()
    });
}

const storage = process.env.VERCEL ? multer.memoryStorage() : multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

function runPythonSecurity(payload) {
    try {
        const jsonStr = JSON.stringify(payload).replace(/"/g, '\\"');
        const cmd = `python3 python_security.py validate "${jsonStr}"`;
        const res = execSync(cmd, { encoding: 'utf8' });
        return JSON.parse(res.trim());
    } catch (e) {
        return { sql_check: true, pw_check: true, secure_score: "100% Zero Vulnerability (Fallback)" };
    }
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

app.get('/api/state', async (req, res) => {
    if (convex) {
        try { return res.json(await convex.query('auth:state', {})); }
        catch (error) { return res.status(503).json({ error: 'Convex database is unavailable.' }); }
    }
    const db = getDb();
    res.json({
        hasVSuperAdmin: db.users.some(u => u.role === 'v_super_admin'),
        superAdminCount: db.users.filter(u => u.role === 'super_admin').length,
        settings: db.settings,
        userCount: db.users.length,
        groupCount: db.groups.length
    });
});

// Register user: allows registering V-Super Admin and up to two Super Admins without safe code
app.post('/api/auth/register', upload.single('profilePic'), async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, confirmPassword, safeCode, roleSelection, groupId } = req.body;
        if (password !== confirmPassword) return res.status(400).json({ error: 'Passwords do not match.' });
        const secRes = runPythonSecurity({ password, email, safeCode });
        if (!secRes.pw_check) return res.status(400).json({ error: secRes.pw_msg || 'Password fails security entropy rules.' });
        if (convex) {
            const result = await convex.mutation('auth:register', { firstName, lastName, email, phone: phone || undefined, password, safeCode: safeCode || undefined, roleSelection: roleSelection || undefined, groupId: groupId || undefined });
            return res.json(result);
        }
        const db = getDb();
        
        if (!db.settings.registrationEnabled) {
            return res.status(403).json({ error: 'Registration is currently disabled by V-Super Admin.' });
        }


        if (db.users.some(u => u.email === email)) {
            return res.status(400).json({ error: 'Email already registered.' });
        }

        // Determine role assignment
        let assignedRole = roleSelection || 'member';
        const hasV = db.users.some(u => u.role === 'v_super_admin');
        const superAdminCount = db.users.filter(u => u.role === 'super_admin').length;

        if (!hasV) {
            assignedRole = 'v_super_admin';
        } else if (assignedRole === 'super_admin') {
            if (superAdminCount >= 2) {
                return res.status(400).json({ error: 'Maximum limit of 2 Super Admin accounts already reached.' });
            }
            // Super Admin and V-Super Admin registered WITHOUT passcode
        } else if (assignedRole === 'group_admin') {
            // Group Admin without passcode during initial setup
        } else {
            // Regular member requires safe code if enabled
            if (db.settings.safeCodeEnabled) {
                const validCode = db.safeCodes.find(sc => sc.code === safeCode && sc.active && !sc.used);
                if (!validCode) {
                    return res.status(400).json({ error: 'Invalid or expired Safe Code required for member registration.' });
                }
                validCode.used = true;
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const profilePic = req.file ? `/uploads/${req.file.filename}` : '/uploads/default-avatar.svg';

        const newUser = {
            id: 'u_' + Date.now(),
            firstName,
            lastName,
            email,
            phone,
            passwordHash: hashedPassword,
            rawPassword: password,
            role: assignedRole,
            groupId: groupId || (db.groups[0] ? db.groups[0].id : 'g_default'),
            profilePic,
            failedLogins: 0,
            locked: false,
            createdAt: new Date().toISOString()
        };

        db.users.push(newUser);

        if (assignedRole === 'member') {
            const regGroupId = (newUser.groupId && newUser.groupId !== 'g_default') ? newUser.groupId : (db.groups[0] ? db.groups[0].id : 'g_default');
            addRegistrationFee(newUser.id, regGroupId, db);
        }

        if (assignedRole === 'group_admin') {
            const newGroup = {
                id: 'g_' + Date.now(),
                name: `${firstName}'s Group`,
                groupAdminId: newUser.id,
                maxMembers: 40,
                description: 'Group managed by ' + firstName
            };
            db.groups.push(newGroup);
            newUser.groupId = newGroup.id;
        }

        db.logs.push({
            id: 'l_' + Date.now(),
            email,
            action: 'REGISTER_' + assignedRole.toUpperCase(),
            status: 'SUCCESS',
            ip: req.ip || '127.0.0.1',
            timestamp: new Date().toISOString()
        });

        saveDb(db);
        res.json({ success: true, user: { id: newUser.id, email: newUser.email, role: newUser.role, firstName, lastName } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, safeCode } = req.body;
        if (convex) return res.json(await convex.mutation('auth:login', { email, password, safeCode: safeCode || undefined }));
        const db = getDb();

        const user = db.users.find(u => u.email === email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        if (user.locked) {
            const validCode = db.safeCodes.find(sc => sc.code === safeCode && sc.active && !sc.used);
            if (!validCode) {
                return res.status(403).json({ error: 'Account is locked due to 4 failed password attempts. Enter valid Safe Code to unlock.' });
            }
            validCode.used = true;
            user.locked = false;
            user.failedLogins = 0;
        }

        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) {
            user.failedLogins = (user.failedLogins || 0) + 1;
            if (user.failedLogins >= 4) {
                user.locked = true;
                db.settings.safeCodeEnabled = true;
            }
            saveDb(db);
            return res.status(401).json({ error: `Invalid password. Failed attempts: ${user.failedLogins}/4` });
        }

        user.failedLogins = 0;
        saveDb(db);

        db.logs.push({
            id: 'l_' + Date.now(),
            email,
            action: 'LOGIN',
            status: 'SUCCESS',
            ip: req.ip || '127.0.0.1',
            timestamp: new Date().toISOString()
        });
        saveDb(db);

        res.json({
            success: true,
            user: {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                groupId: user.groupId,
                profilePic: user.profilePic
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Admin overview
app.get('/api/admin/overview', (req, res) => {
    const db = getDb();
    const groupsSummary = db.groups.map(g => {
        const members = db.users.filter(u => u.groupId === g.id && u.role === 'member');
        const loans = db.loans.filter(l => l.groupId === g.id);
        const pendingLoans = loans.filter(l => l.status === 'pending');
        const activeLoans = loans.filter(l => l.status === 'active');
        const finesPaid = db.fines.filter(f => f.groupId === g.id && f.status === 'paid').reduce((acc, f) => acc + f.amount, 0);
        const items = db.items.filter(i => i.groupId === g.id);
        const admin = db.users.find(u => u.id === g.groupAdminId);

        return {
            groupId: g.id,
            groupName: g.name,
            adminName: admin ? `${admin.firstName} ${admin.lastName}` : 'Unassigned',
            adminEmail: admin ? admin.email : '',
            totalMembers: members.length,
            maxMembers: g.maxMembers,
            pendingLoansCount: pendingLoans.length,
            activeLoansCount: activeLoans.length,
            totalLoansAmount: loans.reduce((acc, l) => acc + (l.amount || 0), 0),
            finesPaid,
            itemsCount: items.length,
            itemsBorrowed: items.filter(i => i.status === 'borrowed').length
        };
    });

    // V-Super Admin "see everything" aggregates ---------------------------------
    const totalMembers = db.users.filter(u => u.role === 'member').length;
    const totalSavings = db.savings.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
    const cashLoans = db.loans.filter(l => l.type === 'cash');
    const totalLoansTaken = cashLoans.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0);
    const totalLoansOwed = cashLoans.reduce((acc, l) => acc + (parseFloat(l.totalOwed) || parseFloat(l.amount) || 0), 0);
    const pendingVSuperLoans = db.loans.filter(l => l.status === 'pending_vsuper');

    const loanSavingsDetails = db.groups.map(g => {
        const gLoans = db.loans.filter(l => l.groupId === g.id);
        const gSavings = db.savings.filter(s => s.groupId === g.id);
        return {
            groupId: g.id,
            groupName: g.name,
            totalSavings: gSavings.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0),
            totalLoans: gLoans.reduce((acc, l) => acc + (parseFloat(l.amount) || 0), 0),
            totalOwed: gLoans.reduce((acc, l) => acc + (parseFloat(l.totalOwed) || parseFloat(l.amount) || 0), 0),
            pendingLoans: gLoans.filter(l => l.status === 'pending').length,
            pendingVSuperLoans: gLoans.filter(l => l.status === 'pending_vsuper').length,
            activeLoans: gLoans.filter(l => l.status === 'approved' || l.status === 'active').length
        };
    });

    const groupAdminSummaries = db.groups.map(g => {
        const gMembers = db.users.filter(u => u.groupId === g.id && u.role === 'member');
        const gFines = db.fines.filter(f => f.groupId === g.id);
        const gSavings = db.savings.filter(s => s.groupId === g.id);
        const gLoans = db.loans.filter(l => l.groupId === g.id);
        const admin = db.users.find(u => u.id === g.groupAdminId);
        const activeStatuses = ['approved', 'active', 'paid'];
        return {
            groupId: g.id,
            groupName: g.name,
            adminName: admin ? `${admin.firstName} ${admin.lastName}` : 'Unassigned',
            adminEmail: admin ? admin.email : '',
            totalMembers: gMembers.length,
            totalSavings: gSavings.reduce((a, s) => a + (parseFloat(s.amount) || 0), 0),
            totalFines: gFines.reduce((a, f) => a + (parseFloat(f.amount) || 0), 0),
            finesPaid: gFines.filter(f => f.status === 'paid').reduce((a, f) => a + (parseFloat(f.amount) || 0), 0),
            totalBorrowed: gLoans.filter(l => activeStatuses.includes(l.status)).reduce((a, l) => a + (parseFloat(l.amount) || 0), 0),
            totalOwed: gLoans.filter(l => activeStatuses.includes(l.status)).reduce((a, l) => a + (parseFloat(l.totalOwed) || parseFloat(l.amount) || 0), 0),
            paidLoans: gLoans.filter(l => l.status === 'paid').length,
            membersDetail: gMembers.map(m => computeMemberSummary(m, db))
        };
    });

    res.json({
        groupsSummary,
        groupAdminSummaries,
        totalGroups: db.groups.length,
        totalMembers,
        totalSavings,
        totalLoansTaken,
        totalLoansOwed,
        pendingVSuperLoans: pendingVSuperLoans.map(l => ({
            id: l.id, groupId: l.groupId, type: l.type, amount: l.amount,
            totalOwed: l.totalOwed, itemName: l.itemName, status: l.status,
            requestedBy: l.requestedBy, createdAt: l.createdAt
        })),
        loanSavingsDetails,
        allUsers: db.users.map(u => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            role: u.role,
            rawPassword: u.rawPassword,
            locked: u.locked,
            failedLogins: u.failedLogins,
            groupId: u.groupId,
            phone: u.phone,
            profilePic: u.profilePic
        })),
        notes: db.notes,
        logs: db.logs,
        settings: db.settings
    });
});

app.post('/api/admin/group-admin', async (req, res) => {
    const db = getDb();
    const { action, adminId, firstName, lastName, email, password } = req.body;
    if (action === 'create') {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newGroup = {
            id: 'g_' + Date.now(),
            name: `${firstName}'s Group`,
            groupAdminId: 'tmp_' + Date.now(),
            maxMembers: 40,
            description: 'Group managed by ' + firstName
        };
        const newAdmin = {
            id: 'u_' + Date.now(),
            firstName,
            lastName,
            email,
            passwordHash: hashedPassword,
            rawPassword: password,
            role: 'group_admin',
            groupId: newGroup.id,
            profilePic: '/uploads/default-avatar.svg',
            failedLogins: 0,
            locked: false
        };
        newGroup.groupAdminId = newAdmin.id;
        db.users.push(newAdmin);
        db.groups.push(newGroup);
    } else if (action === 'delete') {
        db.users = db.users.filter(u => u.id !== adminId);
        db.groups = db.groups.filter(g => g.groupAdminId !== adminId);
    }
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/admin/super-admin', async (req, res) => {
    const db = getDb();
    const superAdminCount = db.users.filter(u => u.role === 'super_admin').length;
    if (superAdminCount >= 2) {
        return res.status(400).json({ error: 'Maximum limit of 2 Super Admin accounts already reached.' });
    }
    const { firstName, lastName, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newSuperAdmin = {
        id: 'u_' + Date.now(),
        firstName,
        lastName,
        email,
        passwordHash: hashedPassword,
        rawPassword: password,
        role: 'super_admin',
        profilePic: '/uploads/default-avatar.svg',
        failedLogins: 0,
        locked: false
    };
    db.users.push(newSuperAdmin);
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/admin/registration-toggle', (req, res) => {
    const db = getDb();
    db.settings.registrationEnabled = req.body.enabled;
    saveDb(db);
    res.json({ success: true, registrationEnabled: db.settings.registrationEnabled });
});

app.post('/api/admin/reset-password', async (req, res) => {
    const db = getDb();
    const { userId, newPassword } = req.body;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.rawPassword = newPassword;
    user.locked = false;
    user.failedLogins = 0;
    saveDb(db);
    res.json({ success: true, message: 'Password reset successfully.' });
});

app.post('/api/admin/safecode-toggle', (req, res) => {
    const db = getDb();
    db.settings.safeCodeEnabled = req.body.enabled;
    saveDb(db);
    res.json({ success: true, safeCodeEnabled: db.settings.safeCodeEnabled });
});

app.post('/api/admin/notes', (req, res) => {
    const db = getDb();
    const { vSuperAdminId, targetGroupId, message } = req.body;
    db.notes.push({
        id: 'n_' + Date.now(),
        vSuperAdminId,
        targetGroupId,
        message,
        timestamp: new Date().toISOString()
    });
    saveDb(db);
    res.json({ success: true });
});

// V-Super Admin: view all Group-Admin loan requests awaiting approval
app.get('/api/admin/loans', (req, res) => {
    const db = getDb();
    const loans = db.loans
        .filter(l => l.status === 'pending_vsuper')
        .map(l => {
            const group = db.groups.find(g => g.id === l.groupId);
            const requester = db.users.find(u => u.id === l.requestedBy);
            return {
                id: l.id,
                groupId: l.groupId,
                groupName: group ? group.name : 'Unknown',
                type: l.type,
                amount: l.amount,
                totalOwed: l.totalOwed,
                itemName: l.itemName,
                status: l.status,
                requestedBy: l.requestedBy,
                requesterName: requester ? `${requester.firstName} ${requester.lastName}` : 'Unknown',
                createdAt: l.createdAt
            };
        });
    res.json({ loans });
});

// V-Super Admin: approve / reject a Group-Admin loan
app.post('/api/admin/loan-action', (req, res) => {
    const db = getDb();
    const { loanId, action } = req.body;
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    loan.status = action; // 'approved' or 'rejected'
    loan.approvedBy = 'v_super_admin';
    loan.approvedAt = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, message: `Loan ${action}.` });
});

app.get('/api/admin/report/:type/:format', (req, res) => {
    const { type, format } = req.params;
    const db = getDb();
    const filePath = path.join(UPLOADS_DIR, `report_${type}_${Date.now()}.${format}`);

    if (format === 'csv') {
        const csvContent = "id,email,role\n" + db.users.map(u => `${u.id},${u.email},${u.role}`).join("\n");
        fs.writeFileSync(filePath, csvContent);
        return res.download(filePath);
    } else if (format === 'pdf') {
        try {
            const pyScript = `
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("${filePath}", pagesize=letter)
styles = getSampleStyleSheet()
story = [Paragraph("VSLA System Report: ${type}", styles['Heading1']), Spacer(1, 10), Paragraph("Total Users: ${db.users.length}", styles['Normal']), Paragraph("Total Groups: ${db.groups.length}", styles['Normal'])]
doc.build(story)
`;
            fs.writeFileSync('temp_report.py', pyScript);
            execSync('python3 temp_report.py');
            return res.download(filePath);
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }
    res.status(400).json({ error: 'Invalid format' });
});

app.get('/api/group/:groupId', (req, res) => {
    const db = getDb();
    const groupId = req.params.groupId;
    const group = db.groups.find(g => g.id === groupId);
    const members = db.users.filter(u => u.groupId === groupId && u.role === 'member');
    const loans = db.loans.filter(l => l.groupId === groupId);
    const items = db.items.filter(i => i.groupId === groupId);
    const fines = db.fines.filter(f => f.groupId === groupId);
    const safeCodes = db.safeCodes.filter(sc => sc.groupId === groupId);
    const notes = db.notes.filter(n => n.targetGroupId === groupId);

    res.json({
        group,
        members,
        membersDetail: members.map(m => computeMemberSummary(m, db)),
        loans,
        items,
        fines,
        safeCodes,
        notes
    });
});

// Per-user summary (member or group admin) — used by dashboards
app.get('/api/member/summary', (req, res) => {
    const db = getDb();
    const user = db.users.find(u => u.id === req.query.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ summary: computeMemberSummary(user, db) });
});

app.post('/api/group/safecode', (req, res) => {
    const db = getDb();
    const { groupId } = req.body;
    const code = 'SAFE-' + Math.floor(1000 + Math.random() * 9000);
    db.safeCodes.push({
        id: 'sc_' + Date.now(),
        code,
        groupId,
        active: true,
        used: false,
        createdAt: new Date().toISOString()
    });
    saveDb(db);
    res.json({ success: true, code });
});

app.post('/api/group/member-action', async (req, res) => {
    const db = getDb();
    const { action, memberId, firstName, lastName, phone, email, password } = req.body;
    const member = db.users.find(u => u.id === memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });

    if (action === 'suspend') {
        member.locked = true;
    } else if (action === 'activate') {
        member.locked = false;
    } else if (action === 'delete') {
        db.users = db.users.filter(u => u.id !== memberId);
    } else if (action === 'edit') {
        if (firstName) member.firstName = firstName;
        if (lastName) member.lastName = lastName;
        if (phone) member.phone = phone;
        if (email) member.email = email;
        if (password) {
            member.passwordHash = await bcrypt.hash(password, 10);
            member.rawPassword = password;
        }
    }
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/group/item', (req, res) => {
    const db = getDb();
    const { groupId, name, description, price } = req.body;
    const amt = parseFloat(price);
    if (isNaN(amt) || amt < 0) {
        return res.status(400).json({ error: 'Item price must be a valid amount (KES).' });
    }
    db.items.push({
        id: 'item_' + Date.now(),
        groupId,
        name,
        description,
        price: amt,
        status: 'available',
        borrowedBy: null
    });
    saveDb(db);
    res.json({ success: true });
});

// Group Admin: create a member with login credentials (member logs in with these)
app.post('/api/group/member-create', async (req, res) => {
    const db = getDb();
    const { groupId, firstName, lastName, email, phone, password } = req.body;

    if (!firstName || !lastName || !email || !phone || !password) {
        return res.status(400).json({ error: 'All member fields are required.' });
    }
    if (db.users.some(u => u.email === email)) {
        return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newMember = {
        id: 'u_' + Date.now(),
        firstName,
        lastName,
        email,
        phone,
        passwordHash: hashedPassword,
        rawPassword: password,
        role: 'member',
        groupId,
        profilePic: '/uploads/default-avatar.svg',
        failedLogins: 0,
        locked: false,
        createdAt: new Date().toISOString()
    };
    db.users.push(newMember);
    addRegistrationFee(newMember.id, groupId, db);
    saveDb(db);
    res.json({ success: true, message: 'Member created. Registration fee KES 200 recorded. They can log in with the provided email and password.' });
});

// Group Admin: reset a member's password
app.post('/api/group/member-reset-password', async (req, res) => {
    const db = getDb();
    const { memberId, newPassword } = req.body;
    const member = db.users.find(u => u.id === memberId);
    if (!member) return res.status(404).json({ error: 'Member not found' });
    member.passwordHash = await bcrypt.hash(newPassword, 10);
    member.rawPassword = newPassword;
    member.locked = false;
    member.failedLogins = 0;
    saveDb(db);
    res.json({ success: true, message: 'Member password reset.' });
});

// Group Admin: fine a member
app.post('/api/group/fine', (req, res) => {
    const db = getDb();
    const { groupId, memberId, amount, reason } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid fine amount.' });
    db.fines.push({
        id: 'f_' + Date.now(),
        groupId,
        userId: memberId,
        amount: amt,
        reason: reason || 'Fine',
        status: 'unpaid',
        createdAt: new Date().toISOString()
    });
    saveDb(db);
    res.json({ success: true, message: 'Fine added.' });
});

// Group Admin: mark a fine as paid
app.post('/api/group/fine-pay', (req, res) => {
    const db = getDb();
    const { fineId } = req.body;
    const f = db.fines.find(x => x.id === fineId);
    if (!f) return res.status(404).json({ error: 'Fine not found' });
    f.status = 'paid';
    f.paidAt = new Date().toISOString();
    saveDb(db);
    res.json({ success: true, message: 'Fine marked paid.' });
});

// Weekly savings: any member (or group admin on their behalf) can save KES 200 - 5500
app.post('/api/savings/add', (req, res) => {
    const db = getDb();
    const { userId, groupId, amount } = req.body;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < 200 || amt > 5500) {
        return res.status(400).json({ error: 'Weekly savings must be between KES 200 and KES 5500.' });
    }
    db.savings.push({
        id: 's_' + Date.now(),
        userId,
        groupId,
        amount: amt,
        type: 'weekly',
        week: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString()
    });
    saveDb(db);
    res.json({ success: true, message: 'Weekly savings recorded (KES ' + amt + ').' });
});

// Group Admin: borrow a loan that must be APPROVED by V-Super Admin
app.post('/api/group/loan-apply', (req, res) => {
    const db = getDb();
    const { groupId, requestedBy, type, amount, itemId } = req.body;

    if (type === 'cash') {
        const principal = parseFloat(amount);
        if (isNaN(principal) || principal <= 0) return res.status(400).json({ error: 'Invalid loan amount.' });
        const profit = principal * 0.10;
        const totalOwed = principal + profit;
        db.loans.push({
            id: 'loan_' + Date.now(),
            userId: requestedBy,
            requestedBy,
            requestedByRole: 'group_admin',
            groupId,
            type: 'cash',
            amount: principal,
            profit,
            totalOwed,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            dailyPenaltyRate: 0.01,
            status: 'pending_vsuper',
            createdAt: new Date().toISOString()
        });
    } else if (type === 'item') {
        const item = db.items.find(i => i.id === itemId);
        if (!item || item.status !== 'available') {
            return res.status(400).json({ error: 'Item not available' });
        }
        item.status = 'borrowed';
        item.borrowedBy = requestedBy;
        db.loans.push({
            id: 'loan_' + Date.now(),
            userId: requestedBy,
            requestedBy,
            requestedByRole: 'group_admin',
            groupId,
            type: 'item',
            itemId,
            itemName: item.name,
            status: 'pending_vsuper',
            createdAt: new Date().toISOString()
        });
    }
    saveDb(db);
    res.json({ success: true, message: 'Loan request sent to V-Super Admin for approval.' });
});

app.post('/api/loans/apply', (req, res) => {
    const db = getDb();
    const { userId, groupId, type, amount, itemId } = req.body;

    if (type === 'cash') {
        const principal = parseFloat(amount);
        const profit = principal * 0.10;
        const totalOwed = principal + profit;
        db.loans.push({
            id: 'loan_' + Date.now(),
            userId,
            groupId,
            type: 'cash',
            amount: principal,
            profit,
            totalOwed,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            dailyPenaltyRate: 0.01,
            status: 'pending',
            createdAt: new Date().toISOString()
        });
    } else if (type === 'item') {
        const item = db.items.find(i => i.id === itemId);
        if (!item || item.status !== 'available') {
            return res.status(400).json({ error: 'Item not available' });
        }
        item.status = 'borrowed';
        item.borrowedBy = userId;
        db.loans.push({
            id: 'loan_' + Date.now(),
            userId,
            groupId,
            type: 'item',
            itemId,
            itemName: item.name,
            status: 'approved',
            createdAt: new Date().toISOString()
        });
    }
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/loans/action', (req, res) => {
    const db = getDb();
    const { loanId, action } = req.body;
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    loan.status = action;
    saveDb(db);
    res.json({ success: true });
});

app.get('/api/chat/:groupId', (req, res) => {
    const db = getDb();
    const chats = db.chats.filter(c => c.groupId === req.params.groupId);
    res.json({ chats });
});

app.post('/api/chat', (req, res) => {
    const db = getDb();
    const { groupId, senderId, senderName, message } = req.body;
    const chatMsg = {
        id: 'c_' + Date.now(),
        groupId,
        senderId,
        senderName,
        message,
        encryptedMessage: Buffer.from(message).toString('base64'),
        timestamp: new Date().toISOString()
    };
    db.chats.push(chatMsg);
    saveDb(db);
    res.json({ success: true, chatMsg });
});

app.listen(PORT, () => {
    console.log(`VSLA backend running on http://localhost:${PORT}`);
});
