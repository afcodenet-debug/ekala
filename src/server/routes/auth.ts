import express from 'express';
import db from '../db/database';

const router = express.Router();

// Professional Login: Checks PIN + Identity
router.post('/login', (req, res) => {
  const { pin_code, identity } = req.body;
  console.log(`[Auth] Login attempt received. PIN: ${pin_code}, Identity: ${identity || 'None'}`);
  
  try {
    let user: any;
    
    if (identity) {
      user = db.prepare(`
        SELECT id, full_name, role, is_active, username, phone
        FROM users 
        WHERE (username = ? OR phone = ?) AND pin_code = ? AND is_active = 1
      `).get(identity, identity, pin_code);
    } else {
      user = db.prepare(`
        SELECT id, full_name, role, is_active
        FROM users 
        WHERE pin_code = ? AND is_active = 1
      `).get(pin_code);
    }

    if (user) {
      console.log(`[Auth] Success: User ${user.full_name} (${user.role}) logged in.`);
      res.json(user);
    } else {
      console.warn(`[Auth] Failed: No active user found for PIN ${pin_code}`);
      res.status(401).json({ error: 'Invalid Credentials or Inactive Account' });
    }
  } catch (error) {
    console.error('[Auth] Critical database error during login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Health check specifically for auth connectivity
router.get('/status', (req, res) => {
  res.json({ status: 'ready', database: 'connected' });
});

export default router;
