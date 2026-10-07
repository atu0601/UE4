const fs = require('fs');

// Revert db.js
let dbJs = fs.readFileSync('support/src/db.js', 'utf8');
dbJs = dbJs.replace(
  "function query(collection, predicate) {\n  const rows = data[collection] || [];\n  if (!predicate) return rows;\n  if (typeof predicate !== 'function') throw new Error('Predicate must be a function');\n  return rows.filter(predicate);\n}",
  "function query(collection, whereExpr) {\n  const rows = data[collection] || [];\n  if (!whereExpr) return rows;\n  const fn = new Function('row', `try { return (${whereExpr}); } catch (e) { return false; }`);\n  return rows.filter((row) => fn(row));\n}"
);
fs.writeFileSync('support/src/db.js', dbJs);

// Revert auth.js
let authJs = fs.readFileSync('support/src/auth.js', 'utf8');
authJs = authJs.replace(
  "const s = db.query('sessions', row => row.token === token)[0];\n  if (!s) return null;\n  return db.query('users', row => row.id === s.userId)[0] || null;",
  "const s = db.query('sessions', `row.token === ${JSON.stringify(token)}`)[0];\n  if (!s) return null;\n  return db.query('users', `row.id === ${s.userId}`)[0] || null;"
);
authJs = authJs.replace(
  "if (req.user.role !== 'admin') {",
  "if (req.user.role !== 'admin' && req.user.role !== 'rh') {"
);
fs.writeFileSync('support/src/auth.js', authJs);

// Revert accounts.js
let accountsJs = fs.readFileSync('support/src/routes/accounts.js', 'utf8');
accountsJs = accountsJs.replace(
  "log('info', 'register_attempt', { email, company });",
  "log('info', 'register_attempt', { email, password, company });"
);
accountsJs = accountsJs.replace(
  "if (db.query('users', row => row.email === email).length) {",
  "if (db.query('users', `row.email === ${JSON.stringify(email)}`).length) {"
);
accountsJs = accountsJs.replace(
  "marketingOptIn: false,",
  "marketingOptIn: true,"
);
accountsJs = accountsJs.replace(
  "  const token = issueToken(user);\n  const safeUser = { ...user };\n  delete safeUser.passwordHash;\n  res.status(201).json({ token, user: safeUser });",
  "  db.insert('consents', { id: db.nextId('consents'), userId: user.id, marketing: true, thirdParty: true, at: user.createdAt });\n  const token = issueToken(user);\n  res.status(201).json({ token, user });"
);
accountsJs = accountsJs.replace(
  "const { email } = req.body || {};\n  log('info', 'login_attempt', { email });\n  const user = db.query('users', row => row.email === email)[0];\n  if (!user || user.passwordHash !== db.hashPassword(req.body.password)) {",
  "const { email, password } = req.body || {};\n  log('info', 'login_attempt', { email, password });\n  const user = db.query('users', `row.email === ${JSON.stringify(email)}`)[0];\n  if (!user || user.passwordHash !== db.hashPassword(password)) {"
);
accountsJs = accountsJs.replace(
  "  const token = issueToken(user);\n  const safeUser = { ...user };\n  delete safeUser.passwordHash;\n  res.json({ token, user: safeUser });",
  "  const token = issueToken(user);\n  res.json({ token, user });"
);
accountsJs = accountsJs.replace(
  "router.get('/me', requireAuth, (req, res) => {\n  const safeUser = { ...req.user };\n  delete safeUser.passwordHash;\n  res.json(safeUser);\n});",
  "router.get('/me', requireAuth, (req, res) => res.json(req.user));"
);
accountsJs = accountsJs.replace(
  "  const fresh = db.query('users', row => row.id === req.user.id)[0];\n  log('info', 'profile_updated', { userId: req.user.id, fields: Object.keys(patch) });\n  const safeUser = { ...fresh };\n  delete safeUser.passwordHash;\n  res.json(safeUser);",
  "  const fresh = db.query('users', `row.id === ${req.user.id}`)[0];\n  log('info', 'profile_updated', { userId: req.user.id, fields: Object.keys(patch) });\n  res.json(fresh);"
);
fs.writeFileSync('support/src/routes/accounts.js', accountsJs);

// Revert data.js
let dataJs = fs.readFileSync('support/src/routes/data.js', 'utf8');
dataJs = dataJs.replace(
  "  const targetId = Number(req.params.id);\n  if (req.user.id !== targetId && req.user.role !== 'admin' && req.user.role !== 'rh') {\n    return res.status(403).json({ error: 'forbidden' });\n  }\n  const u = db.query('users', row => row.id === targetId)[0];\n  if (!u) return res.status(404).json({ error: 'not found' });\n  const safeUser = { ...u };\n  delete safeUser.passwordHash;\n  const questionnaires = db.query('questionnaires', row => row.userId === targetId);\n  res.json({ ...safeUser, questionnaires });",
  "  const u = db.query('users', `row.id === ${Number(req.params.id)}`)[0];\n  if (!u) return res.status(404).json({ error: 'not found' });\n  const questionnaires = db.query('questionnaires', `row.userId === ${Number(req.params.id)}`);\n  res.json({ ...u, questionnaires });"
);
dataJs = dataJs.replace(
  "  const company = req.user.role === 'rh' ? req.user.company : req.query.company;\n  const rows = db.query('users', row => (company ? row.company === company : true))\n    .map(u => { const su = { ...u }; delete su.passwordHash; return su; });\n  res.json(rows);",
  "  const { filter } = req.query; // ex : filter=row.company === 'ACME'\n  const rows = db.query('users', filter);\n  res.json(rows);"
);
dataJs = dataJs.replace(
  "  res.json(db.query('messages', row => row.to === req.user.id || row.from === req.user.id));",
  "  res.json(db.query('messages', `row.to === ${req.user.id} || row.from === ${req.user.id}`));"
);
dataJs = dataJs.replace(
  "  // Route désactivée pour des raisons de conformité RGPD (minimisation et confidentialité).\n  res.status(403).json({ error: 'Export assureur brut désactivé' });",
  "  const rows = db.raw().users.map((u) => ({\n    ...u,\n    questionnaires: db.query('questionnaires', `row.userId === ${u.id}`),\n  }));\n  db.insert('exports', { id: db.nextId('exports'), by: req.user.id, at: new Date().toISOString(), count: rows.length });\n  log('info', 'insurer_export', { by: req.user.id, count: rows.length });\n  res.json(rows);"
);
fs.writeFileSync('support/src/routes/data.js', dataJs);

// Revert README.md
let readme = fs.readFileSync('support/README.md', 'utf8');
readme = readme.replace(
  "| Administrateur | admin@wellwork.example | [Masqué] |\n| RH (ACME) | rh@acme.example | [Masqué] |\n| Coach | coach@wellwork.example | [Masqué] |",
  "| Administrateur | admin@wellwork.example | Admin2024! |\n| RH (ACME) | rh@acme.example | AcmeRh2024 |\n| Coach | coach@wellwork.example | coach123 |"
);
readme = readme.replace(
  "| GET | `/api/users?company=...` | recherche annuaire (modifié pour sécurité) |\n| POST/GET | `/api/messages` | messagerie |\n| GET | `/api/exports/insurer` | export vers l'assureur (Désactivé) |",
  "| GET | `/api/users?filter=...` | recherche annuaire |\n| POST/GET | `/api/messages` | messagerie |\n| GET | `/api/exports/insurer` | export vers l'assureur |"
);
fs.writeFileSync('support/README.md', readme);

// Revert seed.js
let seedJs = fs.readFileSync('support/db/seed.js', 'utf8');
seedJs = seedJs.replace(
  "const companies = ['ACME', 'Northwind', 'Globex'];",
  "const companies = ['ACME', 'Northwind', 'Globex'];\nconst antecedents = ['aucun', 'asthme', 'diabete type 2', 'hypertension', 'anxiete', 'lombalgie chronique'];\nconst traitements = ['aucun', 'ventoline', 'metformine', 'anxiolytique', 'antihypertenseur'];"
);
seedJs = seedJs.replace(
  "        stress: 1 + Math.floor(rnd() * 10),\n        tabac: rnd() < 0.25,\n      },",
  "        stress: 1 + Math.floor(rnd() * 10),\n        antecedents: pick(antecedents),\n        traitement: pick(traitements),\n        tabac: rnd() < 0.25,\n      },"
);
seedJs = seedJs.replace(
  "// Suppression de la session administrateur hardcodée pour des raisons de sécurité",
  "// Une session administrateur active laissee en base\nsessions.push({ token: Buffer.from(`${admin.id}.1.1709800000000`).toString('base64'), userId: admin.id, createdAt: '2024-03-01T08:00:00.000Z' });"
);
fs.writeFileSync('support/db/seed.js', seedJs);

// Revert index.html
let html = fs.readFileSync('support/public/index.html', 'utf8');
html = html.replace(
  "    <label>Niveau de stress (1-10) <input id=\"stress\" type=\"number\" value=\"6\"></label>\n    <button onclick=\"sendQuestionnaire()\">Envoyer</button>",
  "    <label>Niveau de stress (1-10) <input id=\"stress\" type=\"number\" value=\"6\"></label>\n    <label>Antecedents <input id=\"antecedents\" value=\"aucun\"></label>\n    <button onclick=\"sendQuestionnaire()\">Envoyer</button>"
);
html = html.replace(
  "async function sendQuestionnaire() {\n  out(await api('/questionnaires', { method: 'POST', body: JSON.stringify({ answers: { stress: Number(val('stress')) } }) }));\n}",
  "async function sendQuestionnaire() {\n  out(await api('/questionnaires', { method: 'POST', body: JSON.stringify({ answers: { stress: Number(val('stress')), antecedents: val('antecedents') } }) }));\n}"
);
fs.writeFileSync('support/public/index.html', html);
