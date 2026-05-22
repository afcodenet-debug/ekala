import express from 'express';
import db from '../db/database';

const router = express.Router();

// Log application errors
router.post('/', (req, res) => {
  const { level, message, stack, component_stack, user_id } = req.body;

  try {
    db.prepare(`
      INSERT INTO app_logs (level, message, user_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(level, `${message}\n${stack || ''}\n${component_stack || ''}`, user_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to log error:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// Get logs (admin only)
router.get('/', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT l.*, u.full_name as user_name
      FROM app_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `).all();

    res.json(logs);
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

export default router;