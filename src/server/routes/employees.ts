import express from 'express';
import db from '../db/database';
// import { syncService } from '../sync';

const router = express.Router();

// Filter users by staff roles for "employees" endpoint
router.get('/', (req, res) => {
  try {
    const employees = db.prepare(`
      SELECT id, full_name as name, role, username, permissions, is_active as active, created_at, updated_at
      FROM users
      WHERE is_active = 1
      ORDER BY full_name ASC
    `).all();

    const parsed = employees.map((emp: any) => ({
      ...emp,
      permissions: JSON.parse(emp.permissions || '[]')
    }));

    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

export default router;
