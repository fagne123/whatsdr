const Database = require('better-sqlite3');
const path = require('path');

class DatabaseService {
  constructor(dbPath = null) {
    const defaultPath = path.join(__dirname, '../../data/ligai.db');
    this.dbPath = dbPath || process.env.DB_PATH || defaultPath;
    this.db = null;
  }

  connect() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    console.log(`📦 Banco de dados conectado: ${this.dbPath}`);
    this.runMigrations();
    return this;
  }

  runMigrations() {
    // Tabela de usuários
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'operator',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de chamadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        phone_number TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        duration_seconds INTEGER,
        status TEXT DEFAULT 'active',
        end_reason TEXT
      )
    `);

    // Tabela de transcrições
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_id) REFERENCES calls(id)
      )
    `);

    // Índices para performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
      CREATE INDEX IF NOT EXISTS idx_calls_started_at ON calls(started_at);
      CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id);
    `);

    console.log('📦 Migrações executadas com sucesso');
  }

  // === Usuários ===

  createUser(id, username, passwordHash, role = 'operator') {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, username, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(id, username, passwordHash, role);
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?');
    return stmt.get(id);
  }

  // === Chamadas ===

  createCall(id, phoneNumber = null) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const stmt = this.db.prepare(`
      INSERT INTO calls (id, phone_number, status, started_at)
      VALUES (?, ?, 'active', datetime(?, '-3 hours'))
    `);
    return stmt.run(id, phoneNumber, now);
  }

  updateCall(id, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE calls SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }

  endCall(id, endReason = 'completed') {
    const call = this.getCallById(id);
    if (!call) return null;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Calcular duração usando SQLite para evitar problemas de timezone
    // O SQLite calcula a diferença corretamente pois ambos estão no mesmo formato
    const stmt = this.db.prepare(`
      UPDATE calls
      SET ended_at = datetime(?, '-3 hours'),
          duration_seconds = CAST((julianday(datetime(?, '-3 hours')) - julianday(started_at)) * 86400 AS INTEGER),
          status = 'completed',
          end_reason = ?
      WHERE id = ?
    `);
    return stmt.run(now, now, endReason, id);
  }

  getCallById(id) {
    const stmt = this.db.prepare('SELECT * FROM calls WHERE id = ?');
    return stmt.get(id);
  }

  getActiveCalls() {
    const stmt = this.db.prepare(`
      SELECT * FROM calls
      WHERE status = 'active'
      ORDER BY started_at DESC
    `);
    return stmt.all();
  }

  getCallHistory(page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const countStmt = this.db.prepare('SELECT COUNT(*) as total FROM calls WHERE status != ?');
    const { total } = countStmt.get('active');

    const stmt = this.db.prepare(`
      SELECT * FROM calls
      WHERE status != 'active'
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);

    const calls = stmt.all(limit, offset);

    return {
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  clearCallHistory() {
    // Remove transcrições primeiro (foreign key)
    this.db.exec("DELETE FROM transcripts WHERE call_id IN (SELECT id FROM calls WHERE status != 'active')");
    // Remove chamadas completadas
    this.db.exec("DELETE FROM calls WHERE status != 'active'");
    console.log('📦 Histórico de chamadas limpo');
  }

  // === Transcrições ===

  addTranscript(callId, role, content) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const stmt = this.db.prepare(`
      INSERT INTO transcripts (call_id, role, content, timestamp)
      VALUES (?, ?, ?, datetime(?, '-3 hours'))
    `);
    return stmt.run(callId, role, content, now);
  }

  getTranscriptsByCallId(callId) {
    const stmt = this.db.prepare(`
      SELECT * FROM transcripts
      WHERE call_id = ?
      ORDER BY timestamp ASC
    `);
    return stmt.all(callId);
  }

  // === Estatísticas ===

  getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalCalls = this.db.prepare('SELECT COUNT(*) as count FROM calls').get().count;
    const activeCalls = this.db.prepare("SELECT COUNT(*) as count FROM calls WHERE status = 'active'").get().count;

    const todayCalls = this.db.prepare(`
      SELECT COUNT(*) as count FROM calls
      WHERE started_at >= datetime(?)
    `).get(today.toISOString()).count;

    const avgDuration = this.db.prepare(`
      SELECT AVG(duration_seconds) as avg FROM calls
      WHERE duration_seconds IS NOT NULL
    `).get().avg || 0;

    return {
      totalCalls,
      activeCalls,
      todayCalls,
      avgDurationSeconds: Math.round(avgDuration)
    };
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('📦 Banco de dados fechado');
    }
  }
}

module.exports = DatabaseService;
