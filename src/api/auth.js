const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'ligai-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

class AuthService {
  constructor(db) {
    this.db = db;
    this.ensureAdminExists();
  }

  ensureAdminExists() {
    const admin = this.db.getUserByUsername('admin');
    if (!admin) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      this.db.createUser(uuidv4(), 'admin', passwordHash, 'admin');
      console.log('👤 Usuário admin criado (senha: admin123)');
    }
  }

  async login(username, password) {
    const user = this.db.getUserByUsername(username);

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return { success: false, error: 'Senha incorreta' };
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  async createUser(username, password, role = 'operator') {
    const existing = this.db.getUserByUsername(username);
    if (existing) {
      return { success: false, error: 'Usuário já existe' };
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    this.db.createUser(id, username, passwordHash, role);

    return {
      success: true,
      user: { id, username, role }
    };
  }
}

// Middleware de autenticação
function authMiddleware(authService) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    req.user = decoded;
    next();
  };
}

module.exports = { AuthService, authMiddleware };
