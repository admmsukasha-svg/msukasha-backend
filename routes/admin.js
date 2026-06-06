const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Seller  = require('../models/Seller');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const Message = require('../models/Message');
const Application = require('../models/Application');
const { protect, adminOnly } = require('../middleware/auth');

// Sab admin routes protected hain
router.use(protect, adminOnly);

// ─────────────────────────────────────────────
//  DASHBOARD OVERVIEW
// ─────────────────────────────────────────────

// GET /api/admin/dashboard — Main stats
router.get('/dashboard', async (req, res) => {
  try {
    const now       = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalUsers,
      totalSellers,
      pendingSellers,
      totalProducts,
      pendingProducts,
      totalOrders,
      monthlyOrders,
      unreadMessages,
      newApplications,
      revenueResult,
      recentOrders
    ] = await Promise.all([
      User.countDocuments({ role: 'buyer' }),
      Seller.countDocuments({ status: 'approved' }),
      Seller.countDocuments({ status: 'pending' }),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'pending_review' }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: thisMonth } }),
      Message.countDocuments({ status: 'unread' }),
      Application.countDocuments({ status: 'received' }),
      Order.aggregate([
        { $match: { orderStatus: 'delivered', createdAt: { $gte: thisMonth } } },
        { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
      ]),
      Order.find()
        .populate('buyer', 'name email')
        .sort('-createdAt')
        .limit(10)
        .lean()
    ]);

    res.json({
      success: true,
      stats: {
        users:            totalUsers,
        approvedSellers:  totalSellers,
        pendingSellers,
        activeProducts:   totalProducts,
        pendingProducts,
        totalOrders,
        monthlyOrders,
        unreadMessages,
        newApplications,
        monthlyRevenue:   revenueResult[0]?.revenue || 0
      },
      recentOrders
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────

// GET /api/admin/users — Sab buyers
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const filter = { role: 'buyer' };
    if (search) filter.$or = [
      { name:  new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') }
    ];

    const [users, total] = await Promise.all([
      User.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(Number(limit)).lean(),
      User.countDocuments(filter)
    ]);

    res.json({ success: true, total, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/users/:id/toggle — Active/Inactive toggle
router.put('/users/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User nahi mila' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, message: `User ${user.isActive ? 'activate' : 'deactivate'} ho gaya` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/users/:id — User delete
router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User delete ho gaya' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  REVENUE ANALYTICS
// ─────────────────────────────────────────────

// GET /api/admin/analytics — Revenue + orders graph data
router.get('/analytics', async (req, res) => {
  try {
    // Last 6 months ka data
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await Order.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, orderStatus: 'delivered' } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          orders:  { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Category wise products
    const categoryData = await Product.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Top sellers by revenue
    const topSellers = await Order.aggregate([
      { $match: { orderStatus: 'delivered' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.seller', revenue: { $sum: '$items.subtotal' }, orders: { $sum: 1 } } },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'sellers', localField: '_id', foreignField: '_id', as: 'seller' } },
      { $unwind: '$seller' },
      { $project: { businessName: '$seller.businessName', revenue: 1, orders: 1 } }
    ]);

    res.json({ success: true, monthlyData, categoryData, topSellers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: Apna account
// ─────────────────────────────────────────────

// GET /api/admin/me — Admin profile
router.get('/me', async (req, res) => {
  res.json({ success: true, admin: req.user });
});

module.exports = router;
