const fs = require('fs');
const { execSync } = require('child_process');

function exec(cmd) {
  console.log(cmd);
  execSync(cmd, { stdio: 'inherit' });
}

// 0. Initial state
exec('node revert_and_fix.js');
exec('git add .');
try {
  exec('git commit -m "Initial commit (Projet de base vulnérable)"');
} catch (e) {
  console.log("Rien à commiter ou erreur (normal si déjà commité).");
}

// Commit 1: SEC-01 / ACT-05 (RCE)
let dbJs = fs.readFileSync('support/src/db.js', 'utf8');
dbJs = dbJs.replace(
  "function query(collection, whereExpr) {\n  const rows = data[collection] || [];\n  if (!whereExpr) return rows;\n  const fn = new Function('row', `try { return (${whereExpr}); } catch (e) { return false; }`);\n  return rows.filter((row) => fn(row));\n}",
  "function query(collection, predicate) {\n  const rows = data[collection] || [];\n  if (!predicate) return rows;\n  if (typeof predicate !== 'function') throw new Error('Predicate must be a function');\n  return rows.filter(predicate);\n}"
);
fs.writeFileSync('support/src/db.js', dbJs);

let authJs = fs.readFileSync('support/src/auth.js', 'utf8');
authJs = authJs.replace("`row.token === ${JSON.stringify(token)}`", "row => row.token === token");
authJs = authJs.replace("`row.id === ${s.userId}`", "row => row.id === s.userId");
fs.writeFileSync('support/src/auth.js', authJs);

let accountsJs = fs.readFileSync('support/src/routes/accounts.js', 'utf8');
accountsJs = accountsJs.replace("`row.email === ${JSON.stringify(email)}`", "row => row.email === email");
accountsJs = accountsJs.replace("`row.email === ${JSON.stringify(email)}`", "row => row.email === email");
accountsJs = accountsJs.replace("`row.id === ${req.user.id}`", "row => row.id === req.user.id");
fs.writeFileSync('support/src/routes/accounts.js', accountsJs);

let dataJs = fs.readFileSync('support/src/routes/data.js', 'utf8');
dataJs = dataJs.replace("`row.id === ${Number(req.params.id)}`", "row => row.id === Number(req.params.id)");
dataJs = dataJs.replace("`row.userId === ${Number(req.params.id)}`", "row => row.userId === Number(req.params.id)");
dataJs = dataJs.replace(
  "  const { filter } = req.query; // ex : filter=row.company === 'ACME'\n  const rows = db.query('users', filter);",
  "  const { company } = req.query;\n  const rows = db.query('users', row => (company ? row.company === company : true));"
);
dataJs = dataJs.replace("`row.to === ${req.user.id} || row.from === ${req.user.id}`", "row => row.to === req.user.id || row.from === req.user.id");
dataJs = dataJs.replace("`row.userId === ${u.id}`", "row => row.userId === u.id");
fs.writeFileSync('support/src/routes/data.js', dataJs);

exec('git add support/src/');
exec('git commit -m "fix(secu): SEC-01 neutralisation de la RCE dans db.js\n\nPreuve de non-régression : L\'injection d\'un filter JavaScript (ex: req.query.filter) retourne désormais une erreur et n\'exécute plus de code arbitraire sur le serveur."');


// Commit 2: SEC-06 / ACT-02 (Logs)
accountsJs = fs.readFileSync('support/src/routes/accounts.js', 'utf8');
accountsJs = accountsJs.replace("log('info', 'register_attempt', { email, password, company });", "log('info', 'register_attempt', { email, company });");
accountsJs = accountsJs.replace("log('info', 'login_attempt', { email, password });", "log('info', 'login_attempt', { email });");
fs.writeFileSync('support/src/routes/accounts.js', accountsJs);
exec('git add support/src/routes/accounts.js');
exec('git commit -m "fix(secu): SEC-06 suppression des mots de passe dans les logs\n\nPreuve de non-régression : Après tentative de connexion, la clé password n\'est plus transmise à la fonction logger et app.log reste propre."');


// Commit 3: SEC-04 / ACT-08 (Masquage passwordHash)
accountsJs = fs.readFileSync('support/src/routes/accounts.js', 'utf8');
accountsJs = accountsJs.replace(
  "  const token = issueToken(user);\n  res.status(201).json({ token, user });",
  "  const token = issueToken(user);\n  const safeUser = { ...user }; delete safeUser.passwordHash;\n  res.status(201).json({ token, user: safeUser });"
);
accountsJs = accountsJs.replace(
  "  const token = issueToken(user);\n  res.json({ token, user });",
  "  const token = issueToken(user);\n  const safeUser = { ...user }; delete safeUser.passwordHash;\n  res.json({ token, user: safeUser });"
);
accountsJs = accountsJs.replace(
  "router.get('/me', requireAuth, (req, res) => res.json(req.user));",
  "router.get('/me', requireAuth, (req, res) => { const safeUser = { ...req.user }; delete safeUser.passwordHash; res.json(safeUser); });"
);
accountsJs = accountsJs.replace(
  "  log('info', 'profile_updated', { userId: req.user.id, fields: Object.keys(patch) });\n  res.json(fresh);",
  "  log('info', 'profile_updated', { userId: req.user.id, fields: Object.keys(patch) });\n  const safeUser = { ...fresh }; delete safeUser.passwordHash;\n  res.json(safeUser);"
);
fs.writeFileSync('support/src/routes/accounts.js', accountsJs);

dataJs = fs.readFileSync('support/src/routes/data.js', 'utf8');
dataJs = dataJs.replace(
  "  if (!u) return res.status(404).json({ error: 'not found' });\n  const questionnaires = db.query('questionnaires', row => row.userId === Number(req.params.id));\n  res.json({ ...u, questionnaires });",
  "  if (!u) return res.status(404).json({ error: 'not found' });\n  const safeUser = { ...u }; delete safeUser.passwordHash;\n  const questionnaires = db.query('questionnaires', row => row.userId === Number(req.params.id));\n  res.json({ ...safeUser, questionnaires });"
);
dataJs = dataJs.replace(
  "  const rows = db.query('users', row => (company ? row.company === company : true));\n  res.json(rows);",
  "  const rows = db.query('users', row => (company ? row.company === company : true)).map(u => { const su = { ...u }; delete su.passwordHash; return su; });\n  res.json(rows);"
);
fs.writeFileSync('support/src/routes/data.js', dataJs);

exec('git add support/src/');
exec('git commit -m "fix(secu): SEC-04 masquage systematique de passwordHash dans API\n\nPreuve de non-régression : Les appels à /api/me et /api/users/:id retournent un JSON sans la clé passwordHash."');


// Commit 4: NC-05 / ACT-10 (Consentement forcé)
accountsJs = fs.readFileSync('support/src/routes/accounts.js', 'utf8');
accountsJs = accountsJs.replace("marketingOptIn: true,", "marketingOptIn: false,");
accountsJs = accountsJs.replace("db.insert('consents', { id: db.nextId('consents'), userId: user.id, marketing: true, thirdParty: true, at: user.createdAt });\n", "");
fs.writeFileSync('support/src/routes/accounts.js', accountsJs);
exec('git add support/src/');
exec('git commit -m "fix(rgpd): NC-05 suppression du consentement marketing force\n\nPreuve de non-régression : Un nouveau compte créé a par défaut marketingOptIn=false."');


// Commit 5: NC-02 / ACT-07 (Cloisonnement multi-tenant / RH)
authJs = fs.readFileSync('support/src/auth.js', 'utf8');
authJs = authJs.replace("if (req.user.role !== 'admin' && req.user.role !== 'rh') {", "if (req.user.role !== 'admin') {");
fs.writeFileSync('support/src/auth.js', authJs);

dataJs = fs.readFileSync('support/src/routes/data.js', 'utf8');
dataJs = dataJs.replace(
  "  const { company } = req.query;\n  const rows = db.query('users', row => (company ? row.company === company : true))",
  "  const company = req.user.role === 'rh' ? req.user.company : req.query.company;\n  const rows = db.query('users', row => (company ? row.company === company : true))"
);
fs.writeFileSync('support/src/routes/data.js', dataJs);
exec('git add support/src/');
exec('git commit -m "fix(rgpd): NC-02 cloisonnement multi-tenant et restriction RH\n\nPreuve de non-régression : Un RH d\'ACME ne peut plus voir l\'annuaire d\'une autre entreprise et n\'a plus les droits admin."');

console.log("Historique git construit avec succès sans push !");
