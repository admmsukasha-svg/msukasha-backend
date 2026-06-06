const express     = require('express');
const router      = express.Router();
const Application = require('../models/Application');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/applications — Apply for job (public)
router.post('/', async (req, res) => {
  try {
    const { fullName, email, phone, city, position, department, experience, education, skills, coverLetter, cvUrl } = req.body;

    if (!fullName || !email || !phone || !position) {
      return res.status(400).json({ success: false, message: 'Name, email, phone aur position required hai' });
    }

    // Duplicate check
    const existing = await Application.findOne({ email, position });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Is position ke liye aap pehle apply kar chuke hain' });
    }

    const application = await Application.create({
      fullName, email, phone, city,
      position, department, experience,
      education,
      skills: typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : (skills || []),
      coverLetter, cvUrl
    });

    res.status(201).json({
      success: true,
      message: 'Application submit ho gayi! Hum jald review karenge.',
      id: application._id
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: Applications
// ─────────────────────────────────────────────

// GET /api/applications/admin — Sab applications
router.get('/admin', protect, adminOnly, async (req, res) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)     filter.status     = status;
    if (department) filter.department = department;

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Application.countDocuments(filter)
    ]);

    res.json({ success: true, total, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/applications/admin/:id — Single application
router.get('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application nahi mili' });
    res.json({ success: true, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/applications/admin/:id/status — Status update
router.put('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const validStatuses = ['received', 'under_review', 'shortlisted', 'interviewed', 'hired', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status, adminNotes: adminNotes || '' },
      { new: true }
    );

    if (!application) return res.status(404).json({ success: false, message: 'Application nahi mili' });

    res.json({ success: true, message: `Application ${status} kar di gayi`, application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/applications/admin/:id — Delete
router.delete('/admin/:id', protect, adminOnly, async (req, res) => {
  try {
    await Application.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Application delete ho gayi' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
