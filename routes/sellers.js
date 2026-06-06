const express = require('express');
const router  = express.Router();
const Seller  = require('../models/Seller');
const Product = require('../models/Product');
const Order   = require('../models/Order');
const { protect, adminOnly } = require('../middleware/auth');
const { sellerProtect }      = require('../middleware/sellerAuth');

// GET /api/sellers — Public seller list
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, city } = req.query;
    const filter = { status: 'approved', isActive: true };
    if (city) filter['address.city'] = new RegExp(city, 'i');

    const [sellers, total] = await Promise.all([
      Seller.find(filter)
        .select('businessName logo description rating totalReviews totalProducts address')
        .sort('-rating')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Seller.countDocuments(filter)
    ]);

    res.json({ success: true, total, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sellers/:id — Single seller public profile
router.get('/:id', async (req, res) => {
  try {
    const seller = await Seller.findOne({ _id: req.params.id, status: 'approved' })
      .select('-password -bankDetails -cnic -adminNotes');

    if (!seller) return res.status(404).json({ success: false, message: 'Seller nahi mila' });

    // Seller ke products
    const products = await Product.find({ seller: seller._id, status: 'active' })
      .limit(12).lean();

    res.json({ success: true, seller, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  SELLER DASHBOARD
// ─────────────────────────────────────────────

// GET /api/sellers/dashboard/stats — Full dashboard stats
router.get('/dashboard/stats', sellerProtect, async (req, res) => {
  try {
    const sellerId = req.seller._id;
    const now      = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProducts,
      activeProducts,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      monthlyRevenue,
      recentOrders
    ] = await Promise.all([
      Product.countDocuments({ seller: sellerId }),
      Product.countDocuments({ seller: sellerId, status: 'active' }),
      Order.countDocuments({ 'items.seller': sellerId }),
      Order.countDocuments({ 'items.seller': sellerId, orderStatus: { $in: ['placed', 'confirmed', 'processing'] } }),
      Order.countDocuments({ 'items.seller': sellerId, orderStatus: 'delivered' }),
      Order.aggregate([
        { $match: { 'items.seller': sellerId, orderStatus: 'delivered', createdAt: { $gte: thisMonth } } },
        { $unwind: '$items' },
        { $match: { 'items.seller': sellerId } },
        { $group: { _id: null, revenue: { $sum: '$items.subtotal' } } }
      ]),
      Order.find({ 'items.seller': sellerId })
        .populate('buyer', 'name')
        .sort('-createdAt')
        .limit(5)
        .lean()
    ]);

    // Low stock products
    const lowStock = await Product.find({ seller: sellerId, stock: { $lte: 5, $gt: 0 } })
      .select('name stock').lean();

    res.json({
      success: true,
      stats: {
        totalProducts,
        activeProducts,
        totalOrders,
        pendingOrders,
        deliveredOrders,
        monthlyRevenue: monthlyRevenue[0]?.revenue || 0
      },
      recentOrders,
      lowStock
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/sellers/dashboard/inventory — Inventory management
router.get('/dashboard/inventory', sellerProtect, async (req, res) => {
  try {
    const { page = 1, limit = 30, lowStock } = req.query;
    const filter = { seller: req.seller._id };
    if (lowStock === 'true') filter.stock = { $lte: 10 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('name stock price status images category')
        .sort('stock')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.json({ success: true, total, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/sellers/dashboard/inventory/:productId — Stock update
router.put('/dashboard/inventory/:productId', sellerProtect, async (req, res) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ success: false, message: 'Valid stock value dein' });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, seller: req.seller._id },
      { stock, status: stock > 0 ? 'active' : 'out_of_stock' },
      { new: true }
    );

    if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila' });
    res.json({ success: true, message: 'Stock update ho gaya', product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────
//  ADMIN: Sellers manage
// ─────────────────────────────────────────────

// GET /api/sellers/admin/all — Admin sab sellers dekhe
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const [sellers, total] = await Promise.all([
      Seller.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Seller.countDocuments(filter)
    ]);

    res.json({ success: true, total, sellers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/sellers/admin/:id/status — Approve / Reject / Suspend
router.put('/admin/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const seller = await Seller.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    if (!seller) return res.status(404).json({ success: false, message: 'Seller nahi mila' });

    res.json({ success: true, message: `Seller ${status} kar diya gaya`, seller });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
